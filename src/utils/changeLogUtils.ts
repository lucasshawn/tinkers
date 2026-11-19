import { Product, ChangeLogEntry, SiteSettings } from '../types';
import { formatPrice } from './productUtils';

export const CHANGES_STORAGE_KEY = 'weebles_changes_log_v1';

let idCounter = 0;

function makeId(nowIso: string, suffix: string): string {
  idCounter += 1;
  return `chg-${Date.parse(nowIso) || Date.now()}-${idCounter}-${suffix}`;
}

export function getStoredChanges(defaults: ChangeLogEntry[] = []): ChangeLogEntry[] {
  try {
    const raw = localStorage.getItem(CHANGES_STORAGE_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
  } catch {}
  return defaults;
}

export function saveStoredChanges(entries: ChangeLogEntry[]): void {
  try {
    localStorage.setItem(CHANGES_STORAGE_KEY, JSON.stringify(entries));
  } catch {}
}

export function mergeChanges(
  existing: ChangeLogEntry[],
  incoming: ChangeLogEntry[]
): ChangeLogEntry[] {
  const byId = new Map<string, ChangeLogEntry>();
  for (const item of [...incoming, ...existing]) {
    if (item && typeof item.id === 'string' && !byId.has(item.id)) {
      byId.set(item.id, item);
    }
  }
  return Array.from(byId.values()).sort((a, b) => {
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
  if (!img) return '(none)';
  if (img.startsWith('data:image/')) return '[uploaded image]';
  return img;
}

export function diffInventoryChanges(
  who: string,
  oldProducts: Product[],
  newProducts: Product[],
  nowIso: string = new Date().toISOString()
): ChangeLogEntry[] {
  const entries: ChangeLogEntry[] = [];
  const oldMap = new Map(oldProducts.map((p) => [p.id, p]));
  const newMap = new Map(newProducts.map((p) => [p.id, p]));

  // 1. Added products
  for (const p of newProducts) {
    if (!oldMap.has(p.id)) {
      entries.push({
        id: makeId(nowIso, `add-${p.id}`),
        timestamp: nowIso,
        who,
        what: `Added Weeble: ${p.name}`,
        oldValue: '(none)',
        newValue: `Price: ${formatPrice(p.price)}, Category: ${p.category}, Stock: ${p.stockCount} (${
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
        who,
        what: `Deleted Weeble: ${p.name}`,
        oldValue: `Price: ${formatPrice(p.price)}, Category: ${p.category}, Stock: ${p.stockCount}`,
        newValue: '(deleted)',
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
      { label: 'Category', oldVal: oldP.category, newVal: newP.category },
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
    ];

    for (const cmp of fieldComparisons) {
      if (cmp.oldVal !== cmp.newVal) {
        entries.push({
          id: makeId(nowIso, `edit-${newP.id}-${cmp.label.toLowerCase().replace(/\s+/g, '-')}`),
          timestamp: nowIso,
          who,
          what: `${labelPrefix} - ${cmp.label}`,
          oldValue: cmp.oldVal,
          newValue: cmp.newVal,
        });
      }
    }
  }

  return entries;
}

export function diffSettingsChanges(
  who: string,
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

  for (const cmp of comparisons) {
    if (cmp.oldVal !== cmp.newVal) {
      entries.push({
        id: makeId(nowIso, cmp.label.toLowerCase().replace(/[^a-z0-9]+/g, '-')),
        timestamp: nowIso,
        who,
        what: cmp.label,
        oldValue: cmp.oldVal,
        newValue: cmp.newVal,
      });
    }
  }

  return entries;
}

export function diffAdminsChanges(
  who: string,
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
        who,
        what: 'Admin Whitelist - Added Admin',
        oldValue: '(not authorized)',
        newValue: email,
      });
    }
  }

  for (const email of oldNormalized) {
    if (!newNormalized.includes(email)) {
      entries.push({
        id: makeId(nowIso, `admin-rem-${email}`),
        timestamp: nowIso,
        who,
        what: 'Admin Whitelist - Removed Admin',
        oldValue: email,
        newValue: '(removed)',
      });
    }
  }

  return entries;
}

export function createErrorLogEntry(
  who: string,
  action: string,
  attemptedValue: string,
  errorMessage: string,
  nowIso: string = new Date().toISOString()
): ChangeLogEntry {
  return {
    id: makeId(nowIso, `err-${action.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`),
    timestamp: nowIso,
    who,
    what: `Error: ${action}`,
    oldValue: attemptedValue || '-',
    newValue: `ERROR: ${errorMessage}`,
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
