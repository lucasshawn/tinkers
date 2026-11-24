import { Handler, HandlerResponse } from '@netlify/functions';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { verifySessionToken } from './admin-auth';
import {
  TMP_SETTINGS_FILE,
  saveToNetlifyBlobs as saveToNetlifyBlobsImpl,
  readFromNetlifyBlobs as readFromNetlifyBlobsImpl,
  loadPersistedSettings as loadPersistedSettingsImpl,
} from './_lib/storage';
import defaultProductsData from '../../src/data/products.json';
import defaultChangesData from '../../src/data/changes.json';
import { pruneRemovedCategories } from '../../src/utils/productUtils';

const TMP_PRODUCTS_FILE = 'weebles-products.json';
const TMP_CHANGES_FILE = 'weebles-changes.json';
const CHANGE_LOG_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_CONTENT_IMAGE_BYTES = 2 * 1024 * 1024;
const CONTENT_IMAGE_MIME_BY_EXT: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
};
const SAFE_RASTER_MIME_TYPES = new Set(Object.values(CONTENT_IMAGE_MIME_BY_EXT));
const SAFE_CONTENT_IMAGE_NAME_RE = /^[a-zA-Z0-9._-]+\.(png|jpe?g|webp|gif)$/i;
const SAFE_DATA_IMAGE_PREFIX_RE = /^data:image\/(png|jpe?g|webp|gif);base64,/i;
const VALID_BASE64_RE = /^[A-Za-z0-9+/]+={0,2}$/;

function isValidRasterImageBytes(buffer: Buffer): boolean {
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return true;
  }
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return true;
  }
  if (buffer.length >= 6) {
    const gifHeader = buffer.subarray(0, 6).toString('ascii');
    if (gifHeader === 'GIF87a' || gifHeader === 'GIF89a') return true;
  }
  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return true;
  }
  return false;
}

function filterRecentChanges(entries: any[], now: number = Date.now()): any[] {
  const cutoff = now - CHANGE_LOG_RETENTION_MS;
  return entries.filter((item) => {
    if (!item || typeof item.timestamp !== 'string') return false;
    const ts = Date.parse(item.timestamp);
    return !Number.isNaN(ts) && ts >= cutoff;
  });
}

export async function saveToNetlifyBlobs(event: any, key: string, jsonString: string): Promise<boolean> {
  return saveToNetlifyBlobsImpl(event, key, jsonString);
}

export async function readFromNetlifyBlobs<T>(event: any, key: string): Promise<T | null> {
  return readFromNetlifyBlobsImpl<T>(event, key);
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
  return loadPersistedSettingsImpl(event);
}

export async function loadPersistedChanges(event?: any): Promise<any[]> {
  if (event) {
    const blobChanges = await readFromNetlifyBlobs<any[]>(event, 'changes');
    if (Array.isArray(blobChanges)) return filterRecentChanges(blobChanges);
  }

  try {
    const tmpPath = path.join(os.tmpdir(), TMP_CHANGES_FILE);
    if (fs.existsSync(tmpPath)) {
      const content = fs.readFileSync(tmpPath, 'utf-8');
      if (content) {
        const parsed = JSON.parse(content);
        if (Array.isArray(parsed)) return filterRecentChanges(parsed);
      }
    }
  } catch {}

  try {
    const localPath = path.resolve(process.cwd(), 'src/data/changes.json');
    if (fs.existsSync(localPath)) {
      const content = fs.readFileSync(localPath, 'utf-8');
      if (content) {
        const parsed = JSON.parse(content);
        if (Array.isArray(parsed)) return filterRecentChanges(parsed);
      }
    }
  } catch {}

  return Array.isArray(defaultChangesData) ? filterRecentChanges(defaultChangesData) : [];
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

export const handler: Handler = async (event): Promise<HandlerResponse> => {
  if (event.httpMethod === 'GET' && event.queryStringParameters?.action === 'load') {
    const products = await loadPersistedProducts(event);
    const settings = await loadPersistedSettings(event);
    const changes = await loadPersistedChanges(event);
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
      },
      body: JSON.stringify({ products, settings, changes }),
    };
  }

  if (event.httpMethod === 'GET' && event.queryStringParameters?.action === 'content-image') {
    const name = event.queryStringParameters?.name || '';
    if (!SAFE_CONTENT_IMAGE_NAME_RE.test(name) || name.includes('..') || path.basename(name) !== name) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Invalid image filename' }),
      };
    }
    const ext = path.extname(name).toLowerCase();
    const contentType = CONTENT_IMAGE_MIME_BY_EXT[ext] || 'application/octet-stream';

    const blobImg = await readFromNetlifyBlobs<{ contentType?: string; base64?: string }>(
      event,
      `content-image:${name}`
    );
    if (blobImg?.base64) {
      return {
        statusCode: 200,
        headers: {
          'Content-Type': contentType,
          'Cache-Control': 'public, max-age=3600',
          'X-Content-Type-Options': 'nosniff',
        },
        body: blobImg.base64,
        isBase64Encoded: true,
      };
    }

    const candidates = [
      path.resolve(process.cwd(), 'public/images/content', name),
      path.join(os.tmpdir(), `weebles-content-img-${name}`),
    ];
    for (const candidate of candidates) {
      try {
        if (fs.existsSync(candidate)) {
          const buf = fs.readFileSync(candidate);
          return {
            statusCode: 200,
            headers: {
              'Content-Type': contentType,
              'Cache-Control': 'public, max-age=3600',
              'X-Content-Type-Options': 'nosniff',
            },
            body: buf.toString('base64'),
            isBase64Encoded: true,
          };
        }
      } catch {}
    }

    return {
      statusCode: 404,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Image not found' }),
    };
  }

  if (event.httpMethod === 'GET' && event.queryStringParameters?.action === 'product-image') {
    const name = event.queryStringParameters?.name || '';
    if (!SAFE_CONTENT_IMAGE_NAME_RE.test(name) || name.includes('..') || path.basename(name) !== name) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Invalid image filename' }),
      };
    }
    const ext = path.extname(name).toLowerCase();
    const extContentType = CONTENT_IMAGE_MIME_BY_EXT[ext] || 'image/jpeg';

    const blobImg = await readFromNetlifyBlobs<{ contentType?: string; base64?: string }>(
      event,
      `product-image:${name}`
    );
    if (blobImg?.base64) {
      const normalizedBlobMime = blobImg.contentType?.toLowerCase() === 'image/jpg'
        ? 'image/jpeg'
        : blobImg.contentType?.toLowerCase();
      const safeContentType =
        normalizedBlobMime && SAFE_RASTER_MIME_TYPES.has(normalizedBlobMime)
          ? normalizedBlobMime
          : extContentType;
      return {
        statusCode: 200,
        headers: {
          'Content-Type': safeContentType,
          'Cache-Control': 'public, max-age=43200, must-revalidate',
          'X-Content-Type-Options': 'nosniff',
        },
        body: blobImg.base64,
        isBase64Encoded: true,
      };
    }

    const candidates = [
      path.resolve(process.cwd(), 'public/images/products', name),
      path.join(os.tmpdir(), `weebles-img-${name}`),
    ];
    for (const candidate of candidates) {
      try {
        if (fs.existsSync(candidate)) {
          const buf = fs.readFileSync(candidate);
          return {
            statusCode: 200,
            headers: {
              'Content-Type': extContentType,
              'Cache-Control': 'public, max-age=43200, must-revalidate',
              'X-Content-Type-Options': 'nosniff',
            },
            body: buf.toString('base64'),
            isBase64Encoded: true,
          };
        }
      } catch {}
    }

    return {
      statusCode: 404,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Image not found' }),
    };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  const authHeader = event.headers.authorization || event.headers.Authorization;
  if (!authHeader) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Authentication required' }) };
  }

  const verifiedAdmin = await verifySessionToken(authHeader, event);
  if (!verifiedAdmin) {
    return { statusCode: 403, body: JSON.stringify({ error: 'Unauthorized admin session' }) };
  }

  try {
    const rawBody =
      event.isBase64Encoded && event.body
        ? Buffer.from(event.body, 'base64').toString('utf-8')
        : event.body || '{}';
    const { type, products, settings, admins, categories, newImage, newImages, changes, contentImage } = JSON.parse(rawBody);
    const githubToken = process.env.GITHUB_TOKEN || '';

    // 1. Handle image upload(s) if present (supports newImages[] and legacy single newImage)
    const imagesToUpload: Array<{ filename: string; base64Data: string }> = Array.isArray(newImages)
      ? newImages
      : newImage
      ? [newImage]
      : [];

    for (const img of imagesToUpload) {
      if (!img || !img.filename || !img.base64Data) continue;
      const cleanFilename = path.basename(img.filename).replace(/[^a-zA-Z0-9._-]/g, '');
      const imagePath = `public/images/products/${cleanFilename}`;
      const rawBase64 = img.base64Data.replace(/^data:image\/[\w+.-]+;base64,/, '');

      const dataUrlMatch = img.base64Data.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,/i);
      const ext = path.extname(cleanFilename).toLowerCase();
      const rawMime = dataUrlMatch ? dataUrlMatch[1].toLowerCase() : '';
      const normalizedMime = rawMime === 'image/jpg' ? 'image/jpeg' : rawMime;
      const contentType = SAFE_RASTER_MIME_TYPES.has(normalizedMime)
        ? normalizedMime
        : CONTENT_IMAGE_MIME_BY_EXT[ext] || 'image/jpeg';

      await saveToNetlifyBlobs(
        event,
        `product-image:${cleanFilename}`,
        JSON.stringify({ contentType, base64: rawBase64 })
      );

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
      // Preserve existing admins, categories, and pageContent when not explicitly provided in settings update
      if (
        !mergedSettings.admins ||
        mergedSettings.categories === undefined ||
        mergedSettings.pageContent === undefined
      ) {
        const currentSettings = await loadPersistedSettings(event);
        if (!mergedSettings.admins && currentSettings.admins) {
          mergedSettings.admins = currentSettings.admins;
        }
        if (mergedSettings.categories === undefined && currentSettings.categories !== undefined) {
          mergedSettings.categories = currentSettings.categories;
        }
        if (mergedSettings.pageContent === undefined && currentSettings.pageContent !== undefined) {
          mergedSettings.pageContent = currentSettings.pageContent;
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

    // 5. Handle changes audit log update
    if (type === 'changes' && Array.isArray(changes)) {
      const existingChanges = await loadPersistedChanges(event);
      const byId = new Map<string, any>();
      for (const item of [...changes, ...existingChanges]) {
        if (item && typeof item.id === 'string' && !byId.has(item.id)) {
          byId.set(item.id, item);
        }
      }
      const mergedChanges = filterRecentChanges(Array.from(byId.values()));
      const jsonString = JSON.stringify(mergedChanges, null, 2) + '\n';
      const base64Content = Buffer.from(jsonString).toString('base64');

      await saveToNetlifyBlobs(event, 'changes', jsonString);

      if (githubToken) {
        await commitToGitHub('src/data/changes.json', base64Content, 'chore(admin): update audit change log');
      } else {
        writeJsonWithFallback('src/data/changes.json', TMP_CHANGES_FILE, jsonString);
      }

      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: true,
          message: 'Change log saved.',
        }),
      };
    }

    // 6. Handle categories update (with cascade cleanup on products)
    if (type === 'categories' && Array.isArray(categories)) {
      const sanitizedCategories = categories
        .filter((c: any) => c && typeof c.id === 'string' && typeof c.label === 'string')
        .map((c: any) => {
          const entry: { id: string; label: string; emoji?: string } = {
            id: c.id.trim(),
            label: c.label.trim(),
          };
          if (typeof c.emoji === 'string' && c.emoji.trim()) {
            entry.emoji = c.emoji.trim();
          }
          return entry;
        })
        .filter((c: any) => c.id && c.label);

      const currentSettings = await loadPersistedSettings(event);
      currentSettings.categories = sanitizedCategories;
      const settingsJson = JSON.stringify(currentSettings, null, 2) + '\n';
      const settingsBase64 = Buffer.from(settingsJson).toString('base64');

      await saveToNetlifyBlobs(event, 'settings', settingsJson);
      if (githubToken) {
        await commitToGitHub(
          'src/data/settings.json',
          settingsBase64,
          'chore(admin): update catalog categories from studio portal'
        );
      } else {
        writeJsonWithFallback('src/data/settings.json', TMP_SETTINGS_FILE, settingsJson);
      }

      const validIds = new Set(sanitizedCategories.map((c: any) => c.id));
      const baseProducts = Array.isArray(products) ? products : await loadPersistedProducts(event);
      const cleanedProducts = pruneRemovedCategories(baseProducts, validIds);
      let productsChanged = Array.isArray(products);
      if (!productsChanged) {
        productsChanged = baseProducts.some((p: any, idx: number) => {
          const cleaned = cleanedProducts[idx];
          if (!Array.isArray(p.categories) || 'category' in p) return true;
          if ((cleaned.categories?.length ?? 0) !== p.categories.length) return true;
          return (cleaned.categories || []).some((id, i) => id !== p.categories[i]);
        });
      }

      if (productsChanged) {
        const productsJson = JSON.stringify(cleanedProducts, null, 2) + '\n';
        const productsBase64 = Buffer.from(productsJson).toString('base64');
        await saveToNetlifyBlobs(event, 'products', productsJson);
        if (githubToken) {
          await commitToGitHub(
            'src/data/products.json',
            productsBase64,
            'chore(admin): remove deleted categories from catalog items'
          );
        } else {
          writeJsonWithFallback('src/data/products.json', TMP_PRODUCTS_FILE, productsJson);
        }
      }

      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: true,
          message: githubToken
            ? 'Categories saved and committed to GitHub. Netlify deploy triggered!'
            : 'Categories saved locally (Dev Mode).',
        }),
      };
    }

    // 7. Handle inline content PNG/image upload
    if (type === 'content-image') {
      if (
        !contentImage ||
        typeof contentImage.filename !== 'string' ||
        typeof contentImage.base64Data !== 'string' ||
        !contentImage.filename.trim() ||
        !contentImage.base64Data.trim()
      ) {
        return {
          statusCode: 400,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: 'Missing content image filename or data.' }),
        };
      }

      const rawDataStr = contentImage.base64Data.trim();
      if (/^data:/i.test(rawDataStr) && !SAFE_DATA_IMAGE_PREFIX_RE.test(rawDataStr)) {
        return {
          statusCode: 400,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            error: 'Unsupported image MIME type. Please upload a PNG, JPG, WEBP, or GIF file.',
          }),
        };
      }

      const sanitized = path
        .basename(contentImage.filename)
        .replace(/[^a-zA-Z0-9._-]/g, '');
      const ext = path.extname(sanitized).toLowerCase();
      const contentType = CONTENT_IMAGE_MIME_BY_EXT[ext];
      if (!contentType || !SAFE_CONTENT_IMAGE_NAME_RE.test(sanitized)) {
        return {
          statusCode: 400,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            error: 'Unsupported image format. Please upload a PNG, JPG, WEBP, or GIF file.',
          }),
        };
      }

      const rawBase64 = rawDataStr.replace(SAFE_DATA_IMAGE_PREFIX_RE, '').replace(/\s+/g, '');
      if (!VALID_BASE64_RE.test(rawBase64)) {
        return {
          statusCode: 400,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: 'Invalid base64 image data.' }),
        };
      }

      const buffer = Buffer.from(rawBase64, 'base64');
      if (buffer.length === 0) {
        return {
          statusCode: 400,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: 'Image file is empty.' }),
        };
      }
      if (buffer.length > MAX_CONTENT_IMAGE_BYTES) {
        return {
          statusCode: 413,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: 'Image exceeds 2 MB limit. Please use a smaller PNG.' }),
        };
      }
      if (!isValidRasterImageBytes(buffer)) {
        return {
          statusCode: 400,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            error: 'Invalid raster image content. Please upload a valid PNG, JPG, WEBP, or GIF file.',
          }),
        };
      }

      const canonicalBase64 = buffer.toString('base64');
      const stem =
        sanitized
          .slice(0, sanitized.length - ext.length)
          .replace(/\.+/g, '-')
          .replace(/^-+|-+$/g, '')
          .slice(0, 48) || 'image';
      const cleanFilename = `${stem}-${Date.now()}${ext}`;
      const imagePath = `public/images/content/${cleanFilename}`;

      const savedToBlobs = await saveToNetlifyBlobs(
        event,
        `content-image:${cleanFilename}`,
        JSON.stringify({ contentType, base64: canonicalBase64 })
      );

      let persisted = savedToBlobs;
      if (githubToken) {
        await commitToGitHub(
          imagePath,
          canonicalBase64,
          `chore(admin): upload storefront content image ${cleanFilename}`
        );
        persisted = true;
      } else {
        const localDir = path.resolve(process.cwd(), 'public/images/content');
        try {
          if (!fs.existsSync(localDir)) fs.mkdirSync(localDir, { recursive: true });
          fs.writeFileSync(path.join(localDir, cleanFilename), buffer);
          persisted = true;
        } catch {
          try {
            fs.writeFileSync(path.join(os.tmpdir(), `weebles-content-img-${cleanFilename}`), buffer);
            persisted = true;
          } catch {}
        }
      }

      if (!persisted) {
        return {
          statusCode: 500,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: 'Failed to persist uploaded image' }),
        };
      }

      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: true,
          url: `/images/content/${cleanFilename}`,
          filename: cleanFilename,
          message: githubToken
            ? 'Image uploaded and committed to GitHub!'
            : 'Image uploaded locally (Dev Mode).',
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
