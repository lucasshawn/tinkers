export const CACHE_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

const MAX_FUTURE_SKEW_MS = 60 * 1000;

export function getCacheTimestampKey(storageKey: string): string {
  return `${storageKey}:savedAt`;
}

/**
 * Returns true only when `storageKey` exists in localStorage AND has a valid
 * companion timestamp within `ttlMs` (default 12 hours).
 * Legacy entries without a timestamp return false so callers refresh them from remote.
 */
export function isStorageEntryFresh(
  storageKey: string,
  ttlMs: number = CACHE_TTL_MS,
  now: number = Date.now()
): boolean {
  try {
    if (localStorage.getItem(storageKey) === null) return false;
    const rawTs = localStorage.getItem(getCacheTimestampKey(storageKey));
    if (!rawTs) return false;
    const savedAt = Number(rawTs);
    if (!Number.isFinite(savedAt) || savedAt <= 0) return false;
    if (savedAt > now + MAX_FUTURE_SKEW_MS) return false;
    return now - savedAt < ttlMs;
  } catch {
    return false;
  }
}

/**
 * Reads a localStorage value, automatically removing and returning null if its
 * companion timestamp is invalid or older than `ttlMs` (default 12 hours).
 * Entries without a companion timestamp are returned as-is for backwards compatibility,
 * while `isStorageEntryFresh` treats them as stale so remote hydration replaces them.
 */
export function readExpiringStorageItem(
  storageKey: string,
  ttlMs: number = CACHE_TTL_MS,
  now: number = Date.now()
): string | null {
  try {
    const raw = localStorage.getItem(storageKey);
    const tsKey = getCacheTimestampKey(storageKey);
    if (raw === null) {
      localStorage.removeItem(tsKey);
      return null;
    }

    const rawTs = localStorage.getItem(tsKey);
    if (rawTs !== null) {
      const savedAt = Number(rawTs);
      if (
        !Number.isFinite(savedAt) ||
        savedAt <= 0 ||
        now - savedAt >= ttlMs ||
        savedAt > now + MAX_FUTURE_SKEW_MS
      ) {
        localStorage.removeItem(storageKey);
        localStorage.removeItem(tsKey);
        return null;
      }
    }

    return raw;
  } catch {
    return null;
  }
}

export function writeExpiringStorageItem(
  storageKey: string,
  value: string,
  now: number = Date.now()
): void {
  try {
    localStorage.setItem(storageKey, value);
    localStorage.setItem(getCacheTimestampKey(storageKey), String(now));
  } catch {
    // Ignore storage quota errors
  }
}

export function removeExpiringStorageItem(storageKey: string): void {
  try {
    localStorage.removeItem(storageKey);
    localStorage.removeItem(getCacheTimestampKey(storageKey));
  } catch {
    // Ignore storage errors
  }
}
