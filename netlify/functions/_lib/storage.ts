import fs from 'fs';
import os from 'os';
import path from 'path';
import defaultSettingsData from '../../../src/data/settings.json';
import { SiteSettings } from '../../../src/types/settings';
import { normalizeSettings } from '../../../src/utils/socialPlatforms';

export const TMP_SETTINGS_FILE = 'weebles-settings.json';
export const BLOB_STORE_NAME = 'site:weebles-store';

export interface BlobsContext {
  edgeURL: string;
  siteID: string;
  token: string;
}

export function getBlobsContext(event: any): BlobsContext | null {
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
    const envCtx = process.env.NETLIFY_BLOBS_CONTEXT;
    if (envCtx) {
      const decoded = Buffer.from(envCtx, 'base64').toString('utf-8');
      const data = JSON.parse(decoded);
      const edgeURL = data.edgeURL || data.url;
      const siteID = data.siteID || event?.headers?.['x-nf-site-id'];
      if (edgeURL && data.token && siteID) {
        return {
          edgeURL,
          siteID,
          token: data.token,
        };
      }
    }
  } catch {}
  return null;
}

export async function saveToNetlifyBlobs(
  event: any,
  key: string,
  jsonString: string
): Promise<boolean> {
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

export async function readFromNetlifyBlobs<T>(event: any, key: string): Promise<T | null> {
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

export async function loadPersistedSettings(event?: any): Promise<any> {
  if (event) {
    const blobSettings = await readFromNetlifyBlobs<any>(event, 'settings');
    if (blobSettings && typeof blobSettings === 'object') {
      return normalizeSettings(blobSettings, defaultSettingsData as SiteSettings);
    }
  }

  try {
    const tmpPath = path.join(os.tmpdir(), TMP_SETTINGS_FILE);
    if (fs.existsSync(tmpPath)) {
      const content = fs.readFileSync(tmpPath, 'utf-8');
      if (content) {
        return normalizeSettings(
          JSON.parse(content) || undefined,
          defaultSettingsData as SiteSettings
        );
      }
    }
  } catch {}

  try {
    const localPath = path.resolve(process.cwd(), 'src/data/settings.json');
    if (fs.existsSync(localPath)) {
      const content = fs.readFileSync(localPath, 'utf-8');
      if (content) {
        return normalizeSettings(
          JSON.parse(content) || undefined,
          defaultSettingsData as SiteSettings
        );
      }
    }
  } catch {}

  return normalizeSettings(undefined, defaultSettingsData as SiteSettings);
}
