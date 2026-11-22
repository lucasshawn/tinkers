export const CONTENT_IMAGES_STORAGE_KEY = 'weebles_content_images_v1';
const CONTENT_IMAGE_PREFIX = '/images/content/';
const SAFE_FILENAME_RE = /^[a-zA-Z0-9._-]+\.(png|jpe?g|webp|gif)$/i;
const SAFE_DATA_IMAGE_RE = /^data:image\/(png|jpeg|jpg|webp|gif);base64,/i;

const memoryCache = new Map<string, string>();

function readStoredMap(): Record<string, string> {
  try {
    const raw = localStorage.getItem(CONTENT_IMAGES_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, string>) : {};
  } catch {
    return {};
  }
}

export function cacheContentImagePreview(url: string, dataUrl: string): void {
  if (!url || !dataUrl || !SAFE_DATA_IMAGE_RE.test(dataUrl)) return;
  memoryCache.set(url, dataUrl);
  try {
    const existing = readStoredMap();
    existing[url] = dataUrl;
    localStorage.setItem(CONTENT_IMAGES_STORAGE_KEY, JSON.stringify(existing));
  } catch {
    // Ignore localStorage quota errors; memoryCache still provides instant preview
  }
}

export function resolveContentImageUrl(src: string): string {
  if (!src.startsWith(CONTENT_IMAGE_PREFIX)) return src;
  const fromMemory = memoryCache.get(src);
  if (fromMemory && SAFE_DATA_IMAGE_RE.test(fromMemory)) return fromMemory;
  const stored = readStoredMap();
  if (typeof stored[src] === 'string' && SAFE_DATA_IMAGE_RE.test(stored[src])) {
    memoryCache.set(src, stored[src]);
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
