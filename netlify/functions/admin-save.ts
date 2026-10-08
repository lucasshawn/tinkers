import { Handler } from '@netlify/functions';
import fs from 'fs';
import path from 'path';
import { ALLOWED_ADMINS } from './admin-auth';

function verifyToken(authHeader?: string): string | null {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.replace('Bearer ', '').trim();
  try {
    const decoded = Buffer.from(token, 'base64').toString('utf-8');
    const parts = decoded.split(':');
    if (parts.length < 3) return null;
    const email = parts[0];
    const exp = parts[1];
    const secret = parts.slice(2).join(':');

    const sessionSecret = process.env.ADMIN_SESSION_SECRET || 'weebles-studio-dev-secret-2026';
    if (secret !== sessionSecret) return null;
    if (Number(exp) < Date.now()) return null;
    if (!ALLOWED_ADMINS.includes(email.toLowerCase())) return null;
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
    const { type, products, settings, newImage } = JSON.parse(event.body || '{}');
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
        if (!fs.existsSync(localDir)) fs.mkdirSync(localDir, { recursive: true });
        fs.writeFileSync(path.join(localDir, cleanFilename), Buffer.from(rawBase64, 'base64'));
      }
    }

    // 2. Handle inventory update
    if (type === 'inventory' && products) {
      const jsonString = JSON.stringify(products, null, 2) + '\n';
      const base64Content = Buffer.from(jsonString).toString('base64');

      if (githubToken) {
        await commitToGitHub('src/data/products.json', base64Content, 'chore(admin): update product inventory from studio portal');
      } else {
        const localPath = path.resolve(process.cwd(), 'src/data/products.json');
        fs.writeFileSync(localPath, jsonString);
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
      const jsonString = JSON.stringify(settings, null, 2) + '\n';
      const base64Content = Buffer.from(jsonString).toString('base64');

      if (githubToken) {
        await commitToGitHub('src/data/settings.json', base64Content, 'chore(admin): update store settings from studio portal');
      } else {
        const localPath = path.resolve(process.cwd(), 'src/data/settings.json');
        fs.writeFileSync(localPath, jsonString);
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

    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid save payload' }) };
  } catch (err: any) {
    console.error('Admin save error:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message || 'Failed to save changes' }),
    };
  }
};
