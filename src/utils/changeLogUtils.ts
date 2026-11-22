import { Product, ChangeLogEntry, SiteSettings } from '../types';
import { formatPrice, getProductCategories } from './productUtils';

export const CHANGES_STORAGE_KEY = 'weebles_changes_log_v1';
export const CHANGE_LOG_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

let idCounter = 0;

function makeId(nowIso: string, suffix: string): string {
  idCounter += 1;
  return `chg-${Date.parse(nowIso) || Date.now()}-${idCounter}-${suffix}`;
}

function normalizeEntry(raw: any): ChangeLogEntry | null {
  if (!raw || typeof raw !== 'object' || typeof raw.id !== 'string') return null;
  const user = typeof raw.user === 'string' ? raw.user : typeof raw.who === 'string' ? raw.who : '';
  const change =
    typeof raw.change === 'string' ? raw.change : typeof raw.what === 'string' ? raw.what : '';
  let comment = '';
  if (typeof raw.comment === 'string') {
    comment = raw.comment;
  } else if (typeof raw.oldValue === 'string' || typeof raw.newValue === 'string') {
    const oldV = raw.oldValue ?? '';
    const newV = raw.newValue ?? '';
    comment = oldV && oldV !== '-' ? `Old: ${oldV} -> New: ${newV}` : String(newV);
  }
  return {
    id: raw.id,
    timestamp: typeof raw.timestamp === 'string' ? raw.timestamp : new Date().toISOString(),
    user,
    change,
    comment,
  };
}

export function pruneExpiredChanges(
  entries: ChangeLogEntry[],
  now: number = Date.now()
): ChangeLogEntry[] {
  const cutoff = now - CHANGE_LOG_RETENTION_MS;
  return entries.filter((entry) => {
    const ts = Date.parse(entry.timestamp);
    return !Number.isNaN(ts) && ts >= cutoff;
  });
}

export function getStoredChanges(
  defaults: ChangeLogEntry[] = [],
  now: number = Date.now()
): ChangeLogEntry[] {
  try {
    const raw = localStorage.getItem(CHANGES_STORAGE_KEY);
    if (!raw) return pruneExpiredChanges(defaults, now);
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      const normalized = parsed
        .map(normalizeEntry)
        .filter((e): e is ChangeLogEntry => e !== null);
      return pruneExpiredChanges(normalized, now);
    }
  } catch {}
  return pruneExpiredChanges(defaults, now);
}

export function saveStoredChanges(
  entries: ChangeLogEntry[],
  now: number = Date.now()
): void {
  try {
    localStorage.setItem(CHANGES_STORAGE_KEY, JSON.stringify(pruneExpiredChanges(entries, now)));
  } catch {}
}

export function mergeChanges(
  existing: ChangeLogEntry[],
  incoming: ChangeLogEntry[],
  now: number = Date.now()
): ChangeLogEntry[] {
  const byId = new Map<string, ChangeLogEntry>();
  for (const rawItem of [...incoming, ...existing]) {
    const item = normalizeEntry(rawItem);
    if (item && !byId.has(item.id)) {
      byId.set(item.id, item);
    }
  }
  return pruneExpiredChanges(Array.from(byId.values()), now).sort((a, b) => {
    const tA = Date.parse(a.timestamp) || 0;
    const tB = Date.parse(b.timestamp) || 0;
    return tB - tA;
  });
}

export function formatLocalTimestamp(isoString: string): string {
  const ms = Date.parse(isoString);
  if (Number.isNaN(ms)) return isoString;
  return new Date(ms).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
  });
}

function summarizeImage(img?: string): string {
  if (!img || !img.trim()) return '(none)';
  if (img.startsWith('data:image/')) return '[uploaded image]';
  return img;
}

export function diffInventoryChanges(
  user: string,
  oldProducts: Product[],
  newProducts: Product[],
  nowIso: string = new Date().toISOString()
): ChangeLogEntry[] {
  const entries: ChangeLogEntry[] = [];
  const formatCategories = (p: Product) => getProductCategories(p).join(', ') || '(none)';
  const oldMap = new Map(oldProducts.map((p) => [p.id, p]));
  const newMap = new Map(newProducts.map((p) => [p.id, p]));

  // 1. Added products
  for (const p of newProducts) {
    if (!oldMap.has(p.id)) {
      entries.push({
        id: makeId(nowIso, `add-${p.id}`),
        timestamp: nowIso,
        user,
        change: `Added Weeble: ${p.name}`,
        comment: `New: Price: ${formatPrice(p.price)}, Category: ${formatCategories(p)}, Stock: ${p.stockCount} (${
          p.inStock ? 'in stock' : 'sold out'
        })`,
      });
    }
  }

  // 2. Deleted products
  for (const p of oldProducts) {
    if (!newMap.has(p.id)) {
      entries.push({
        id: makeId(nowIso, `del-${p.id}`),
        timestamp: nowIso,
        user,
        change: `Deleted Weeble: ${p.name}`,
        comment: `Removed: Price: ${formatPrice(p.price)}, Category: ${formatCategories(p)}, Stock: ${p.stockCount}`,
      });
    }
  }

  // 3. Edited products (field by field)
  for (const newP of newProducts) {
    const oldP = oldMap.get(newP.id);
    if (!oldP) continue;

    const labelPrefix = `Weeble '${oldP.name}'`;

    const fieldComparisons: Array<{ label: string; oldVal: string; newVal: string }> = [
      { label: 'Name', oldVal: oldP.name, newVal: newP.name },
      { label: 'Description', oldVal: oldP.description, newVal: newP.description },
      { label: 'Price', oldVal: formatPrice(oldP.price), newVal: formatPrice(newP.price) },
      { label: 'Category', oldVal: formatCategories(oldP), newVal: formatCategories(newP) },
      { label: 'Stock Count', oldVal: String(oldP.stockCount), newVal: String(newP.stockCount) },
      { label: 'In Stock', oldVal: String(Boolean(oldP.inStock)), newVal: String(Boolean(newP.inStock)) },
      {
        label: '1-of-1',
        oldVal: String(Boolean(oldP.isOneOfAKind)),
        newVal: String(Boolean(newP.isOneOfAKind)),
      },
      {
        label: 'Featured',
        oldVal: String(Boolean(oldP.featured)),
        newVal: String(Boolean(newP.featured)),
      },
      {
        label: 'Available Styles',
        oldVal: (oldP.availableVariants || []).join(', '),
        newVal: (newP.availableVariants || []).join(', '),
      },
      {
        label: 'Product Photo',
        oldVal: summarizeImage(oldP.images?.[0]),
        newVal: summarizeImage(newP.images?.[0]),
      },
      {
        label: 'Magnet Photo',
        oldVal: summarizeImage(oldP.variantImages?.magnet),
        newVal: summarizeImage(newP.variantImages?.magnet),
      },
      {
        label: 'Keychain Photo',
        oldVal: summarizeImage(oldP.variantImages?.keychain),
        newVal: summarizeImage(newP.variantImages?.keychain),
      },
    ];

    for (const cmp of fieldComparisons) {
      if (cmp.oldVal !== cmp.newVal) {
        entries.push({
          id: makeId(nowIso, `edit-${newP.id}-${cmp.label.toLowerCase().replace(/\s+/g, '-')}`),
          timestamp: nowIso,
          user,
          change: `${labelPrefix} - ${cmp.label}`,
          comment: `Old: ${cmp.oldVal} -> New: ${cmp.newVal}`,
        });
      }
    }
  }

  return entries;
}

export function diffSettingsChanges(
  user: string,
  oldSettings: SiteSettings,
  newSettings: SiteSettings,
  nowIso: string = new Date().toISOString()
): ChangeLogEntry[] {
  const entries: ChangeLogEntry[] = [];

  const comparisons: Array<{ label: string; oldVal: string; newVal: string }> = [
    {
      label: 'Site Content - Announcement Banner Enabled',
      oldVal: String(Boolean(oldSettings.announcementBanner?.enabled)),
      newVal: String(Boolean(newSettings.announcementBanner?.enabled)),
    },
    {
      label: 'Site Content - Announcement Banner Text',
      oldVal: oldSettings.announcementBanner?.text || '(empty)',
      newVal: newSettings.announcementBanner?.text || '(empty)',
    },
    {
      label: 'Site Content - General Contact Email',
      oldVal: oldSettings.contactEmail || '(empty)',
      newVal: newSettings.contactEmail || '(empty)',
    },
    {
      label: 'Site Content - Custom Order Email',
      oldVal: oldSettings.customOrderEmail || '(empty)',
      newVal: newSettings.customOrderEmail || '(empty)',
    },
    {
      label: 'Site Content - TikTok URL',
      oldVal: oldSettings.socials?.tiktok || '(empty)',
      newVal: newSettings.socials?.tiktok || '(empty)',
    },
    {
      label: 'Site Content - Instagram URL',
      oldVal: oldSettings.socials?.instagram || '(empty)',
      newVal: newSettings.socials?.instagram || '(empty)',
    },
    {
      label: 'Site Content - Facebook Marketplace URL',
      oldVal: oldSettings.socials?.facebookMarketplace || '(empty)',
      newVal: newSettings.socials?.facebookMarketplace || '(empty)',
    },
  ];

  if (
    typeof oldSettings.socialLinksEnabled === 'boolean' ||
    typeof newSettings.socialLinksEnabled === 'boolean'
  ) {
    comparisons.push({
      label: 'Site Content - Social Media Links Enabled',
      oldVal: String(oldSettings.socialLinksEnabled ?? true),
      newVal: String(newSettings.socialLinksEnabled ?? true),
    });
  }

  if (Array.isArray(oldSettings.socialLinks) || Array.isArray(newSettings.socialLinks)) {
    const summarizeLinks = (links?: SiteSettings['socialLinks']) =>
      (links || [])
        .map((l) => `${l.platform}:${l.url || '(empty)'} [${l.enabled ? 'on' : 'off'}]`)
        .join(', ') || '(none)';

    comparisons.push({
      label: 'Site Content - Social Media Links',
      oldVal: summarizeLinks(oldSettings.socialLinks),
      newVal: summarizeLinks(newSettings.socialLinks),
    });
  }

  for (const cmp of comparisons) {
    if (cmp.oldVal !== cmp.newVal) {
      entries.push({
        id: makeId(nowIso, cmp.label.toLowerCase().replace(/[^a-z0-9]+/g, '-')),
        timestamp: nowIso,
        user,
        change: cmp.label,
        comment: `Old: ${cmp.oldVal} -> New: ${cmp.newVal}`,
      });
    }
  }

  return entries;
}

export function diffAdminsChanges(
  user: string,
  oldAdmins: string[],
  newAdmins: string[],
  nowIso: string = new Date().toISOString()
): ChangeLogEntry[] {
  const entries: ChangeLogEntry[] = [];
  const oldNormalized = oldAdmins.map((e) => e.trim().toLowerCase()).filter(Boolean);
  const newNormalized = newAdmins.map((e) => e.trim().toLowerCase()).filter(Boolean);

  for (const email of newNormalized) {
    if (!oldNormalized.includes(email)) {
      entries.push({
        id: makeId(nowIso, `admin-add-${email}`),
        timestamp: nowIso,
        user,
        change: 'Admin Whitelist - Added Admin',
        comment: `Old: (not authorized) -> New: ${email}`,
      });
    }
  }

  for (const email of oldNormalized) {
    if (!newNormalized.includes(email)) {
      entries.push({
        id: makeId(nowIso, `admin-rem-${email}`),
        timestamp: nowIso,
        user,
        change: 'Admin Whitelist - Removed Admin',
        comment: `Old: ${email} -> New: (removed)`,
      });
    }
  }

  return entries;
}

export function createErrorLogEntry(
  user: string,
  action: string,
  attemptedContext: string,
  errorOrMessage: unknown,
  nowIso: string = new Date().toISOString()
): ChangeLogEntry {
  let errorMessage = 'Unknown error';
  let statusInfo = '';
  let endpointInfo = '';
  let stackSnippet = '';

  if (typeof errorOrMessage === 'string') {
    errorMessage = errorOrMessage;
  } else if (errorOrMessage && typeof errorOrMessage === 'object') {
    const errObj = errorOrMessage as any;
    if (typeof errObj.message === 'string' && errObj.message) {
      errorMessage = errObj.message;
    }
    if (errObj.endpoint) {
      endpointInfo = String(errObj.endpoint);
    }
    if (errObj.status) {
      statusInfo = `HTTP ${errObj.status}`;
    }
    if (typeof errObj.stack === 'string' && errObj.stack) {
      const stackLines = errObj.stack
        .split('\n')
        .map((l: string) => l.trim())
        .filter(Boolean)
        .slice(0, 3);
      if (stackLines.length > 0) {
        stackSnippet = stackLines.join(' <- ');
      }
    }
  }

  const parts: string[] = [`ERROR: ${errorMessage}`];
  if (attemptedContext && attemptedContext !== '-') {
    parts.push(`Context: ${attemptedContext}`);
  }
  if (endpointInfo || statusInfo) {
    const ep = [endpointInfo, statusInfo ? `(${statusInfo})` : ''].filter(Boolean).join(' ');
    parts.push(`Endpoint: ${ep}`);
  }
  if (stackSnippet) {
    parts.push(`Stack: ${stackSnippet}`);
  }

  return {
    id: makeId(nowIso, `err-${action.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`),
    timestamp: nowIso,
    user,
    change: `Error: ${action}`,
    comment: parts.join(' | '),
  };
}

export function describeInventoryAttempt(oldProducts: Product[], newProducts: Product[]): string {
  const oldMap = new Map(oldProducts.map((p) => [p.id, p]));
  const newMap = new Map(newProducts.map((p) => [p.id, p]));

  for (const p of newProducts) {
    if (!oldMap.has(p.id)) return `Add Weeble: ${p.name}`;
  }
  for (const p of oldProducts) {
    if (!newMap.has(p.id)) return `Delete Weeble: ${p.name}`;
  }
  for (const newP of newProducts) {
    const oldP = oldMap.get(newP.id);
    if (oldP && JSON.stringify(oldP) !== JSON.stringify(newP)) {
      return `Edit Weeble: ${oldP.name}`;
    }
  }
  return 'Update Catalog';
}
