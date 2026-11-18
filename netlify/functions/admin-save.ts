import { Handler } from '@netlify/functions';
import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { getAllowedAdmins } from './admin-auth';
import defaultProductsData from '../../src/data/products.json';
import defaultSettingsData from '../../src/data/settings.json';

const TMP_PRODUCTS_FILE = 'weebles-products.json';
const TMP_SETTINGS_FILE = 'weebles-settings.json';
const BLOB_STORE_NAME = 'site:weebles-store';

interface BlobsContext {
  edgeURL: string;
  siteID: string;
  token: string;
}

function getBlobsContext(event: any): BlobsContext | null {
  try {
    if (event?.blobs) {
      const decoded = Buffer.from(event.blobs, 'base64').toString('utf-8');
      const data = JSON.parse(decoded);
      const siteID =
        event.headers?.['x-nf-site-id'] ||
        event.headers?.['X-Nf-Site-Id'] ||
        data.siteID;
      if (data.url && data.token && siteID) {
        return {
          edgeURL: data.url,
          siteID,
          token: data.token,
        };
      }
    }
  } catch {}
  return null;
}

async function saveToNetlifyBlobs(event: any, key: string, jsonString: string): Promise<boolean> {
  const ctx = getBlobsContext(event);
  if (!ctx) return false;
  try {
    const url = new URL(`/${ctx.siteID}/${BLOB_STORE_NAME}/${key}`, ctx.edgeURL).toString();
    const res = await fetch(url, {
      method: 'PUT',
      headers: {
        authorization: `Bearer ${ctx.token}`,
        'content-type': 'application/json',
        'cache-control': 'max-age=0, stale-while-revalidate=60',
      },
      body: jsonString,
    });
    return Boolean(res && res.ok);
  } catch {
    return false;
  }
}

async function readFromNetlifyBlobs<T>(event: any, key: string): Promise<T | null> {
  const ctx = getBlobsContext(event);
  if (!ctx) return null;
  try {
    const url = new URL(`/${ctx.siteID}/${BLOB_STORE_NAME}/${key}`, ctx.edgeURL).toString();
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        authorization: `Bearer ${ctx.token}`,
      },
    });
    if (res && res.ok) {
      return (await res.json()) as T;
    }
  } catch {}
  return null;
}

function writeJsonWithFallback(localRelativePath: string, tmpFilename: string, jsonString: string): 'local' | 'tmp' {
  const localPath = path.resolve(process.cwd(), localRelativePath);
  try {
    fs.writeFileSync(localPath, jsonString);
    return 'local';
  } catch {
    try {
      const tmpPath = path.join(os.tmpdir(), tmpFilename);
      fs.writeFileSync(tmpPath, jsonString);
    } catch {}
    return 'tmp';
  }
}

export async function loadPersistedProducts(event?: any): Promise<any[]> {
  if (event) {
    const blobProducts = await readFromNetlifyBlobs<any[]>(event, 'products');
    if (Array.isArray(blobProducts)) return blobProducts;
  }

  try {
    const tmpPath = path.join(os.tmpdir(), TMP_PRODUCTS_FILE);
    if (fs.existsSync(tmpPath)) {
      const content = fs.readFileSync(tmpPath, 'utf-8');
      if (content) {
        const parsed = JSON.parse(content);
        if (Array.isArray(parsed)) return parsed;
      }
    }
  } catch {}

  try {
    const localPath = path.resolve(process.cwd(), 'src/data/products.json');
    if (fs.existsSync(localPath)) {
      const content = fs.readFileSync(localPath, 'utf-8');
      if (content) {
        const parsed = JSON.parse(content);
        if (Array.isArray(parsed)) return parsed;
      }
    }
  } catch {}

  const raw = (defaultProductsData as any)?.products || defaultProductsData;
  return Array.isArray(raw) ? raw : [];
}

export async function loadPersistedSettings(event?: any): Promise<any> {
  if (event) {
    const blobSettings = await readFromNetlifyBlobs<any>(event, 'settings');
    if (blobSettings && typeof blobSettings === 'object') {
      return { ...defaultSettingsData, ...blobSettings };
    }
  }

  try {
    const tmpPath = path.join(os.tmpdir(), TMP_SETTINGS_FILE);
    if (fs.existsSync(tmpPath)) {
      const content = fs.readFileSync(tmpPath, 'utf-8');
      if (content) {
        return { ...defaultSettingsData, ...JSON.parse(content) };
      }
    }
  } catch {}

  try {
    const localPath = path.resolve(process.cwd(), 'src/data/settings.json');
    if (fs.existsSync(localPath)) {
      const content = fs.readFileSync(localPath, 'utf-8');
      if (content) {
        return { ...defaultSettingsData, ...JSON.parse(content) };
      }
    }
  } catch {}

  return { ...defaultSettingsData };
}

function verifyToken(authHeader?: string): string | null {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.replace('Bearer ', '').trim();
  try {
    const [payloadBase64, signature] = token.split('.');
    if (!payloadBase64 || !signature) return null;
    const sessionSecret = process.env.ADMIN_SESSION_SECRET || 'weebles-studio-dev-secret-2026';
    const expectedSig = crypto.createHmac('sha256', sessionSecret).update(payloadBase64).digest('hex');
    if (signature !== expectedSig) return null;
    const decoded = Buffer.from(payloadBase64, 'base64').toString('utf-8');
    const [email, exp] = decoded.split(':');
    if (!email || !exp || isNaN(Number(exp))) return null;
    if (Number(exp) < Date.now()) return null;
    const allowedAdmins = getAllowedAdmins();
    if (!allowedAdmins.includes(email.toLowerCase())) return null;
    return email.toLowerCase();
  } catch {
    return null;
  }
}

async function commitToGitHub(filePath: string, contentBase64: string, commitMessage: string) {
  const githubToken = process.env.GITHUB_TOKEN || '';
  const githubRepo = process.env.GITHUB_REPO || 'lucasshawn/tinkers';
  const githubBranch = process.env.GITHUB_BRANCH || 'master';

  const url = `https://api.github.com/repos/${githubRepo}/contents/${filePath}`;
  let sha: string | undefined;

  // Check if file exists to get SHA
  try {
    const getRes = await fetch(url + `?ref=${githubBranch}`, {
      headers: {
        Authorization: `Bearer ${githubToken}`,
        'User-Agent': 'Weebles-Admin-Portal',
      },
    });
    if (getRes.ok) {
      const data = await getRes.json();
      sha = data.sha;
    }
  } catch {}

  const putRes = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${githubToken}`,
      'Content-Type': 'application/json',
      'User-Agent': 'Weebles-Admin-Portal',
    },
    body: JSON.stringify({
      message: commitMessage,
      content: contentBase64,
      branch: githubBranch,
      ...(sha ? { sha } : {}),
    }),
  });

  if (!putRes.ok) {
    const errData = await putRes.json().catch(() => ({}));
    throw new Error(errData.message || 'GitHub commit failed');
  }

  return putRes.json();
}

export const handler: Handler = async (event) => {
  if (event.httpMethod === 'GET' && event.queryStringParameters?.action === 'load') {
    const products = await loadPersistedProducts(event);
    const settings = await loadPersistedSettings(event);
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ products, settings }),
    };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  const authHeader = event.headers.authorization || event.headers.Authorization;
  if (!authHeader) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Authentication required' }) };
  }

  const verifiedAdmin = verifyToken(authHeader);
  if (!verifiedAdmin) {
    return { statusCode: 403, body: JSON.stringify({ error: 'Unauthorized admin session' }) };
  }

  try {
    const { type, products, settings, admins, newImage } = JSON.parse(event.body || '{}');
    const githubToken = process.env.GITHUB_TOKEN || '';

    // 1. Handle image upload if present
    if (newImage && newImage.filename && newImage.base64Data) {
      const cleanFilename = path.basename(newImage.filename).replace(/[^a-zA-Z0-9._-]/g, '');
      const imagePath = `public/images/products/${cleanFilename}`;
      const rawBase64 = newImage.base64Data.replace(/^data:image\/\w+;base64,/, '');

      if (githubToken) {
        await commitToGitHub(imagePath, rawBase64, `chore(admin): upload product image ${cleanFilename}`);
      } else {
        const localDir = path.resolve(process.cwd(), 'public/images/products');
        try {
          if (!fs.existsSync(localDir)) fs.mkdirSync(localDir, { recursive: true });
          fs.writeFileSync(path.join(localDir, cleanFilename), Buffer.from(rawBase64, 'base64'));
        } catch {
          try {
            const tmpImgPath = path.join(os.tmpdir(), `weebles-img-${cleanFilename}`);
            fs.writeFileSync(tmpImgPath, Buffer.from(rawBase64, 'base64'));
          } catch {}
        }
      }
    }

    // 2. Handle inventory update
    if (type === 'inventory' && products) {
      const jsonString = JSON.stringify(products, null, 2) + '\n';
      const base64Content = Buffer.from(jsonString).toString('base64');

      await saveToNetlifyBlobs(event, 'products', jsonString);

      if (githubToken) {
        await commitToGitHub('src/data/products.json', base64Content, 'chore(admin): update product inventory from studio portal');
      } else {
        writeJsonWithFallback('src/data/products.json', TMP_PRODUCTS_FILE, jsonString);
      }

      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: true,
          message: githubToken
            ? 'Inventory saved and committed to GitHub. Netlify deploy triggered!'
            : 'Inventory saved locally (Dev Mode).',
        }),
      };
    }

    // 3. Handle settings update
    if (type === 'settings' && settings) {
      const mergedSettings = { ...settings };
      // Preserve existing admins if not explicitly provided in settings update
      if (!mergedSettings.admins) {
        const currentSettings = await loadPersistedSettings(event);
        if (currentSettings.admins) {
          mergedSettings.admins = currentSettings.admins;
        }
      }

      const jsonString = JSON.stringify(mergedSettings, null, 2) + '\n';
      const base64Content = Buffer.from(jsonString).toString('base64');

      await saveToNetlifyBlobs(event, 'settings', jsonString);

      if (githubToken) {
        await commitToGitHub('src/data/settings.json', base64Content, 'chore(admin): update store settings from studio portal');
      } else {
        writeJsonWithFallback('src/data/settings.json', TMP_SETTINGS_FILE, jsonString);
      }

      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: true,
          message: githubToken
            ? 'Settings saved and committed to GitHub. Netlify deploy triggered!'
            : 'Settings saved locally (Dev Mode).',
        }),
      };
    }

    // 4. Handle admins update
    if (type === 'admins' && Array.isArray(admins)) {
      const currentSettings = await loadPersistedSettings(event);
      currentSettings.admins = admins.map((e: string) => e.toLowerCase().trim());
      const jsonString = JSON.stringify(currentSettings, null, 2) + '\n';
      const base64Content = Buffer.from(jsonString).toString('base64');

      await saveToNetlifyBlobs(event, 'settings', jsonString);

      if (githubToken) {
        await commitToGitHub('src/data/settings.json', base64Content, 'chore(admin): update admin whitelist from studio portal');
      } else {
        writeJsonWithFallback('src/data/settings.json', TMP_SETTINGS_FILE, jsonString);
      }

      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: true,
          message: githubToken
            ? 'Admin whitelist saved and committed to GitHub. Netlify deploy triggered!'
            : 'Admin whitelist saved locally (Dev Mode).',
        }),
      };
    }

    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid save payload' }) };
  } catch (err: any) {
    console.error('Admin save error:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message || 'Failed to save changes' }),
    };
  }
};
