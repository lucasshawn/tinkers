import {
  CACHE_TTL_MS,
  getCacheTimestampKey,
  readExpiringStorageItem,
  writeExpiringStorageItem,
} from './cacheUtils';

export const CONTENT_IMAGES_STORAGE_KEY = 'weebles_content_images_v1';
const CONTENT_IMAGE_PREFIX = '/images/content/';
const SAFE_FILENAME_RE = /^[a-zA-Z0-9._-]+\.(png|jpe?g|webp|gif)$/i;
const SAFE_DATA_IMAGE_RE = /^data:image\/(png|jpeg|jpg|webp|gif);base64,/i;

const memoryCache = new Map<string, { dataUrl: string; savedAt: number }>();

function readStoredMap(now: number = Date.now()): Record<string, string> {
  try {
    const raw = readExpiringStorageItem(CONTENT_IMAGES_STORAGE_KEY, CACHE_TTL_MS, now);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, string>) : {};
  } catch {
    return {};
  }
}

export function cacheContentImagePreview(
  url: string,
  dataUrl: string,
  now: number = Date.now()
): void {
  if (!url || !dataUrl || !SAFE_DATA_IMAGE_RE.test(dataUrl)) return;
  memoryCache.set(url, { dataUrl, savedAt: now });
  const existing = readStoredMap(now);
  existing[url] = dataUrl;
  writeExpiringStorageItem(CONTENT_IMAGES_STORAGE_KEY, JSON.stringify(existing), now);
}

export function resolveContentImageUrl(src: string, now: number = Date.now()): string {
  if (!src.startsWith(CONTENT_IMAGE_PREFIX)) return src;
  const fromMemory = memoryCache.get(src);
  if (fromMemory) {
    if (now - fromMemory.savedAt < CACHE_TTL_MS && SAFE_DATA_IMAGE_RE.test(fromMemory.dataUrl)) {
      return fromMemory.dataUrl;
    }
    memoryCache.delete(src);
  }
  const stored = readStoredMap(now);
  if (typeof stored[src] === 'string' && SAFE_DATA_IMAGE_RE.test(stored[src])) {
    let savedAt = now;
    try {
      const rawTs = localStorage.getItem(getCacheTimestampKey(CONTENT_IMAGES_STORAGE_KEY));
      const parsedTs = rawTs ? Number(rawTs) : NaN;
      if (Number.isFinite(parsedTs) && parsedTs > 0) {
        savedAt = parsedTs;
      }
    } catch {
      // Ignore storage read errors
    }
    memoryCache.set(src, { dataUrl: stored[src], savedAt });
    return stored[src];
  }
  return src;
}

export function getContentImageFallbackUrl(src: string): string | null {
  if (!src.startsWith(CONTENT_IMAGE_PREFIX)) return null;
  const filename = src.slice(CONTENT_IMAGE_PREFIX.length);
  if (!SAFE_FILENAME_RE.test(filename)) return null;
  return `/.netlify/functions/admin-save?action=content-image&name=${encodeURIComponent(filename)}`;
}
