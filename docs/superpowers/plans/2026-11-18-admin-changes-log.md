# Admin Changes & Error Audit Log Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a persistent, line-by-line "Changes" tab to the Admin Portal that logs every field-level change (who, what, when in local time, old value, new value) and every admin action error, with sorting on all 5 columns.

**Architecture:** Define `ChangeLogEntry` in `src/types/changes.ts` and implement pure diffing/error-entry/storage helpers in `src/utils/changeLogUtils.ts`. Extend `netlify/functions/admin-save.ts` and `src/services/adminApi.ts` to load and persist change log entries (`src/data/changes.json`, Netlify Blobs `'changes'`, `/tmp/weebles-changes.json`). Build `ChangesTab.tsx` with 5 individually sortable columns (**When**, **Who**, **What**, **Old**, **New**) and wire `AdminPortal.tsx`, `AdminsTab.tsx`, and `PaymentsTab.tsx` to record all changes and errors.

**Tech Stack:** React 18, TypeScript, Tailwind CSS, Netlify Functions, Vitest, React Testing Library

## Global Constraints

- Add a top navigation tab for `"Changes"` in `src/components/admin/AdminPortal.tsx`.
- Track 5 columns per line: **When**, **Who**, **What**, **Old**, **New** (`timestamp`, `who`, `what`, `oldValue`, `newValue`).
- Old/New values must be plain text.
- Multi-field updates (editing a Weeble or saving site settings) must emit one row per changed field.
- Any error encountered when an admin tries to perform an action (API save errors, admin email validation/removal errors, payment load errors) must be logged as an entry with `what: "Error: <Action>"` and `newValue: "ERROR: <message>"`.
- Every column (**When**, **Who**, **What**, **Old**, **New**) must be sortable ascending and descending by clicking its column header.
- **When** must format date and time in local time (`toLocaleString()`) and sort chronologically by timestamp.

---

### Task 1: ChangeLog Data Model, Seed JSON, and Field-Level Diffing & Error Utilities

**Files:**
- Create: `src/types/changes.ts`
- Modify: `src/types/index.ts:1-2`
- Create: `src/data/changes.json`
- Create: `src/utils/changeLogUtils.ts`
- Test: `tests/changeLogUtils.test.ts`

**Interfaces:**
- Consumes: `Product` from `src/types/index.ts`, `SiteSettings` from `src/types/settings.ts`, `formatPrice` from `src/utils/productUtils.ts`
- Produces:
  - `ChangeLogEntry` in `src/types/changes.ts` (re-exported from `src/types/index.ts`)
  - `CHANGES_STORAGE_KEY = 'weebles_changes_log_v1'`
  - `getStoredChanges(defaults?: ChangeLogEntry[]): ChangeLogEntry[]`
  - `saveStoredChanges(entries: ChangeLogEntry[]): void`
  - `mergeChanges(existing: ChangeLogEntry[], incoming: ChangeLogEntry[]): ChangeLogEntry[]`
  - `diffInventoryChanges(who: string, oldProducts: Product[], newProducts: Product[], nowIso?: string): ChangeLogEntry[]`
  - `diffSettingsChanges(who: string, oldSettings: SiteSettings, newSettings: SiteSettings, nowIso?: string): ChangeLogEntry[]`
  - `diffAdminsChanges(who: string, oldAdmins: string[], newAdmins: string[], nowIso?: string): ChangeLogEntry[]`
  - `createErrorLogEntry(who: string, action: string, attemptedValue: string, errorMessage: string, nowIso?: string): ChangeLogEntry`
  - `describeInventoryAttempt(oldProducts: Product[], newProducts: Product[]): string`
  - `formatLocalTimestamp(isoString: string): string`

- [ ] **Step 1: Write the failing unit tests in `tests/changeLogUtils.test.ts`**

Create `tests/changeLogUtils.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import {
  CHANGES_STORAGE_KEY,
  getStoredChanges,
  saveStoredChanges,
  mergeChanges,
  diffInventoryChanges,
  diffSettingsChanges,
  diffAdminsChanges,
  createErrorLogEntry,
  describeInventoryAttempt,
  formatLocalTimestamp,
} from '../src/utils/changeLogUtils';
import { Product } from '../src/types';
import { SiteSettings } from '../src/types/settings';

const baseProduct: Product = {
  id: 'weeble-bee',
  name: 'Chubby Bumblebee',
  description: 'Handmade bee charm',
  price: 14,
  images: ['/images/products/bumblebee.jpg'],
  category: 'animals',
  availableVariants: ['magnet', 'keychain'],
  inStock: true,
  stockCount: 3,
  isOneOfAKind: false,
  featured: false,
};

const baseSettings: SiteSettings = {
  contactEmail: 'hello@weebles.com',
  customOrderEmail: 'custom@weebles.com',
  socials: {
    tiktok: 'https://tiktok.com/@weebles',
    instagram: 'https://instagram.com/weebles',
    facebookMarketplace: 'https://facebook.com/marketplace/weebles',
  },
  announcementBanner: {
    enabled: false,
    text: 'Fall restock!',
  },
  admins: ['lucasshawn@gmail.com'],
};

describe('changeLogUtils', () => {
  const fixedNow = '2026-11-18T17:45:00.000Z';
  const adminEmail = 'lucasshawn@gmail.com';

  beforeEach(() => {
    localStorage.clear();
  });

  describe('diffInventoryChanges', () => {
    it('logs a single entry when a new product is added', () => {
      const added: Product = {
        ...baseProduct,
        id: 'weeble-macaron',
        name: 'Strawberry Macaron',
        price: 16.5,
        category: 'sweets',
        stockCount: 5,
        inStock: true,
      };

      const entries = diffInventoryChanges(adminEmail, [baseProduct], [added, baseProduct], fixedNow);
      expect(entries).toHaveLength(1);
      expect(entries[0]).toMatchObject({
        timestamp: fixedNow,
        who: adminEmail,
        what: 'Added Weeble: Strawberry Macaron',
        oldValue: '(none)',
        newValue: 'Price: $16.50, Category: sweets, Stock: 5 (in stock)',
      });
    });

    it('logs a single entry when a product is deleted', () => {
      const entries = diffInventoryChanges(adminEmail, [baseProduct], [], fixedNow);
      expect(entries).toHaveLength(1);
      expect(entries[0]).toMatchObject({
        timestamp: fixedNow,
        who: adminEmail,
        what: 'Deleted Weeble: Chubby Bumblebee',
        oldValue: 'Price: $14.00, Category: animals, Stock: 3',
        newValue: '(deleted)',
      });
    });

    it('logs one row per changed field when an existing product is edited', () => {
      const updatedProduct: Product = {
        ...baseProduct,
        price: 18,
        stockCount: 0,
        inStock: false,
        description: 'Updated description',
      };

      const entries = diffInventoryChanges(adminEmail, [baseProduct], [updatedProduct], fixedNow);
      expect(entries).toHaveLength(4);
      expect(entries.map((e) => ({ what: e.what, oldValue: e.oldValue, newValue: e.newValue }))).toEqual([
        {
          what: "Weeble 'Chubby Bumblebee' - Description",
          oldValue: 'Handmade bee charm',
          newValue: 'Updated description',
        },
        {
          what: "Weeble 'Chubby Bumblebee' - Price",
          oldValue: '$14.00',
          newValue: '$18.00',
        },
        {
          what: "Weeble 'Chubby Bumblebee' - Stock Count",
          oldValue: '3',
          newValue: '0',
        },
        {
          what: "Weeble 'Chubby Bumblebee' - In Stock",
          oldValue: 'true',
          newValue: 'false',
        },
      ]);
    });

    it('returns empty array when no product fields changed', () => {
      expect(diffInventoryChanges(adminEmail, [baseProduct], [{ ...baseProduct }], fixedNow)).toEqual([]);
    });
  });

  describe('diffSettingsChanges', () => {
    it('logs one row per modified site setting field', () => {
      const updated: SiteSettings = {
        ...baseSettings,
        contactEmail: 'newcontact@weebles.com',
        announcementBanner: {
          enabled: true,
          text: 'Winter drop live!',
        },
        socials: {
          ...baseSettings.socials,
          instagram: 'https://instagram.com/weebles_new',
        },
      };

      const entries = diffSettingsChanges(adminEmail, baseSettings, updated, fixedNow);
      expect(entries).toHaveLength(4);
      expect(entries.map((e) => ({ what: e.what, oldValue: e.oldValue, newValue: e.newValue }))).toEqual([
        {
          what: 'Site Content - Announcement Banner Enabled',
          oldValue: 'false',
          newValue: 'true',
        },
        {
          what: 'Site Content - Announcement Banner Text',
          oldValue: 'Fall restock!',
          newValue: 'Winter drop live!',
        },
        {
          what: 'Site Content - General Contact Email',
          oldValue: 'hello@weebles.com',
          newValue: 'newcontact@weebles.com',
        },
        {
          what: 'Site Content - Instagram URL',
          oldValue: 'https://instagram.com/weebles',
          newValue: 'https://instagram.com/weebles_new',
        },
      ]);
    });
  });

  describe('diffAdminsChanges', () => {
    it('logs added and removed admins', () => {
      const addedEntries = diffAdminsChanges(
        adminEmail,
        ['lucasshawn@gmail.com'],
        ['lucasshawn@gmail.com', 'friend@gmail.com'],
        fixedNow
      );
      expect(addedEntries).toHaveLength(1);
      expect(addedEntries[0]).toMatchObject({
        who: adminEmail,
        what: 'Admin Whitelist - Added Admin',
        oldValue: '(not authorized)',
        newValue: 'friend@gmail.com',
      });

      const removedEntries = diffAdminsChanges(
        adminEmail,
        ['lucasshawn@gmail.com', 'friend@gmail.com'],
        ['lucasshawn@gmail.com'],
        fixedNow
      );
      expect(removedEntries).toHaveLength(1);
      expect(removedEntries[0]).toMatchObject({
        who: adminEmail,
        what: 'Admin Whitelist - Removed Admin',
        oldValue: 'friend@gmail.com',
        newValue: '(removed)',
      });
    });
  });

  describe('createErrorLogEntry & describeInventoryAttempt', () => {
    it('creates a standardized error log entry', () => {
      const entry = createErrorLogEntry(
        adminEmail,
        'Save Inventory',
        'Deleted Weeble: Chubby Bumblebee',
        'Backend Error: Payload Too Large (413)',
        fixedNow
      );
      expect(entry).toMatchObject({
        timestamp: fixedNow,
        who: adminEmail,
        what: 'Error: Save Inventory',
        oldValue: 'Deleted Weeble: Chubby Bumblebee',
        newValue: 'ERROR: Backend Error: Payload Too Large (413)',
      });
    });

    it('describes inventory attempt for add, delete, and edit', () => {
      const added: Product = { ...baseProduct, id: 'p2', name: 'New Frog' };
      expect(describeInventoryAttempt([baseProduct], [added, baseProduct])).toBe('Add Weeble: New Frog');
      expect(describeInventoryAttempt([baseProduct], [])).toBe('Delete Weeble: Chubby Bumblebee');
      expect(
        describeInventoryAttempt([baseProduct], [{ ...baseProduct, price: 25 }])
      ).toBe('Edit Weeble: Chubby Bumblebee');
    });
  });

  describe('localStorage & mergeChanges & formatLocalTimestamp', () => {
    it('persists, reads, and deduplicates change entries via mergeChanges', () => {
      const e1 = createErrorLogEntry(adminEmail, 'Act 1', 'old1', 'err1', '2026-11-18T10:00:00.000Z');
      const e2 = createErrorLogEntry(adminEmail, 'Act 2', 'old2', 'err2', '2026-11-18T12:00:00.000Z');

      saveStoredChanges([e1]);
      expect(getStoredChanges()).toEqual([e1]);

      const merged = mergeChanges([e1], [e1, e2]);
      expect(merged).toHaveLength(2);
      expect(merged[0].id).toBe(e2.id);
      expect(merged[1].id).toBe(e1.id);
    });

    it('formats ISO timestamp into a local date/time string', () => {
      const formatted = formatLocalTimestamp('2026-11-18T17:45:00.000Z');
      expect(typeof formatted).toBe('string');
      expect(formatted).toContain('2026');
      expect(formatLocalTimestamp('invalid-date')).toBe('invalid-date');
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/changeLogUtils.test.ts`
Expected: FAIL (`Failed to resolve import "../src/utils/changeLogUtils"`)

- [ ] **Step 3: Create `src/types/changes.ts`, `src/data/changes.json`, update `src/types/index.ts`, and implement `src/utils/changeLogUtils.ts`**

Create `src/types/changes.ts`:

```typescript
export interface ChangeLogEntry {
  id: string;
  timestamp: string;
  who: string;
  what: string;
  oldValue: string;
  newValue: string;
}
```

Update `src/types/index.ts` line 1 to also export `./changes`:

```typescript
export * from './settings';
export * from './changes';
```

Create `src/data/changes.json`:

```json
[]
```

Create `src/utils/changeLogUtils.ts`:

```typescript
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/changeLogUtils.test.ts`
Expected: PASS (all tests in `tests/changeLogUtils.test.ts` pass)

---

### Task 2: Backend & Client API Persistence for Changes Log

**Files:**
- Modify: `netlify/functions/admin-save.ts`
- Modify: `src/services/adminApi.ts`
- Test: `tests/adminApi.test.ts`

**Interfaces:**
- Consumes: `ChangeLogEntry` from `src/types/changes.ts`
- Produces:
  - `loadPersistedChanges(event?: any): Promise<ChangeLogEntry[]>` in `netlify/functions/admin-save.ts`
  - `GET /.netlify/functions/admin-save?action=load` returns `{ products, settings, changes }`
  - `POST /.netlify/functions/admin-save` with `{ type: 'changes', changes: ChangeLogEntry[] }` merges & persists `changes` to Netlify Blobs (`'changes'`) and `src/data/changes.json` (or `/tmp/weebles-changes.json` fallback)
  - `adminApi.loadStoreData()` returns `Promise<{ products?: Product[]; settings?: SiteSettings; changes?: ChangeLogEntry[] } | null>`
  - `adminApi.saveChanges(changes: ChangeLogEntry[]): Promise<{ success: boolean; message: string }>`

- [ ] **Step 1: Write the failing unit tests in `tests/adminApi.test.ts`**

Add tests in `tests/adminApi.test.ts` inside `describe('admin-save Netlify Function', ...)` and `describe('adminApi client service', ...)`:

```typescript
  it('saves and merges change log entries when type is changes', async () => {
    const entries = [
      {
        id: 'chg-1',
        timestamp: '2026-11-18T17:45:00.000Z',
        who: 'lucasshawn@gmail.com',
        what: 'Added Weeble: Strawberry Macaron',
        oldValue: '(none)',
        newValue: 'Price: $16.50, Category: sweets, Stock: 5 (in stock)',
      },
    ];

    const event = {
      httpMethod: 'POST',
      headers: { authorization: `Bearer ${validToken}` },
      body: JSON.stringify({
        type: 'changes',
        changes: entries,
      }),
    };

    const res = (await handler(event as any, {} as any)) as any;
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      expect.stringContaining('changes.json'),
      expect.stringContaining('Strawberry Macaron')
    );
  });
```

And in `describe('adminApi client service', ...)`:

```typescript
  it('saveChanges posts change log entries with session Bearer token', async () => {
    adminAuth.setSession({
      token: 'changes-token',
      email: 'lucasshawn@gmail.com',
    });

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, message: 'Changes logged' }),
    });
    globalThis.fetch = mockFetch;

    const entries = [
      {
        id: 'chg-1',
        timestamp: '2026-11-18T17:45:00.000Z',
        who: 'lucasshawn@gmail.com',
        what: 'Admin Whitelist - Added Admin',
        oldValue: '(not authorized)',
        newValue: 'new@weebles.com',
      },
    ];

    const result = await adminApi.saveChanges(entries);
    expect(result.success).toBe(true);
    expect(mockFetch).toHaveBeenCalledWith(
      '/.netlify/functions/admin-save',
      expect.objectContaining({
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer changes-token',
        },
        body: JSON.stringify({
          type: 'changes',
          changes: entries,
        }),
      })
    );
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/adminApi.test.ts`
Expected: FAIL (`expected 400 to be 200` and `adminApi.saveChanges is not a function`)

- [ ] **Step 3: Implement change log persistence in `netlify/functions/admin-save.ts` and `src/services/adminApi.ts`**

In `netlify/functions/admin-save.ts`:
1. Import `defaultChangesData from '../../src/data/changes.json';` and define `const TMP_CHANGES_FILE = 'weebles-changes.json';`.
2. Add `loadPersistedChanges(event?: any): Promise<any[]>`:

```typescript
export async function loadPersistedChanges(event?: any): Promise<any[]> {
  if (event) {
    const blobChanges = await readFromNetlifyBlobs<any[]>(event, 'changes');
    if (Array.isArray(blobChanges)) return blobChanges;
  }

  try {
    const tmpPath = path.join(os.tmpdir(), TMP_CHANGES_FILE);
    if (fs.existsSync(tmpPath)) {
      const content = fs.readFileSync(tmpPath, 'utf-8');
      if (content) {
        const parsed = JSON.parse(content);
        if (Array.isArray(parsed)) return parsed;
      }
    }
  } catch {}

  try {
    const localPath = path.resolve(process.cwd(), 'src/data/changes.json');
    if (fs.existsSync(localPath)) {
      const content = fs.readFileSync(localPath, 'utf-8');
      if (content) {
        const parsed = JSON.parse(content);
        if (Array.isArray(parsed)) return parsed;
      }
    }
  } catch {}

  return Array.isArray(defaultChangesData) ? defaultChangesData : [];
}
```

3. Update `GET` with `action=load` in `netlify/functions/admin-save.ts` to also return `changes`:

```typescript
  if (event.httpMethod === 'GET' && event.queryStringParameters?.action === 'load') {
    const products = await loadPersistedProducts(event);
    const settings = await loadPersistedSettings(event);
    const changes = await loadPersistedChanges(event);
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ products, settings, changes }),
    };
  }
```

4. In `POST` handler of `netlify/functions/admin-save.ts`, parse `const { type, products, settings, admins, newImage, changes } = JSON.parse(rawBody);` and add handling for `type === 'changes' && Array.isArray(changes)`:

```typescript
    // 5. Handle changes audit log update
    if (type === 'changes' && Array.isArray(changes)) {
      const existingChanges = await loadPersistedChanges(event);
      const byId = new Map<string, any>();
      for (const item of [...changes, ...existingChanges]) {
        if (item && typeof item.id === 'string' && !byId.has(item.id)) {
          byId.set(item.id, item);
        }
      }
      const mergedChanges = Array.from(byId.values());
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
```

In `src/services/adminApi.ts`, import `ChangeLogEntry` from `../types`, update `loadStoreData()` return type to `{ products?: Product[]; settings?: SiteSettings; changes?: ChangeLogEntry[] } | null`, and add `saveChanges`:

```typescript
  async saveChanges(changes: ChangeLogEntry[]): Promise<{ success: boolean; message: string }> {
    const session = adminAuth.getSession();
    if (!session) throw new Error('Not authenticated');

    const res = await fetch('/.netlify/functions/admin-save', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.token}`,
      },
      body: JSON.stringify({
        type: 'changes',
        changes,
      }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'Failed to save change log');
    }

    return res.json();
  },
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/adminApi.test.ts`
Expected: PASS

---

### Task 3: Sortable `ChangesTab` Component and `AdminPortal` Integration with Error Logging

**Files:**
- Create: `src/components/admin/ChangesTab.tsx`
- Modify: `src/components/admin/AdminPortal.tsx`
- Modify: `src/components/admin/AdminsTab.tsx`
- Modify: `src/components/admin/PaymentsTab.tsx`
- Test: `tests/ChangesTab.test.tsx`
- Test: `tests/AdminPortal.test.tsx`

**Interfaces:**
- Consumes: `ChangeLogEntry` from `src/types`, diffing/error helpers from `src/utils/changeLogUtils.ts`, `adminApi.saveChanges` from `src/services/adminApi.ts`
- Produces:
  - `ChangesTab` component in `src/components/admin/ChangesTab.tsx` with 5 sortable columns: **When**, **Who**, **What**, **Old**, **New**
  - `Changes` tab button in `AdminPortal.tsx`
  - Automatic line-by-line logging of all inventory, site content, and admin whitelist changes, plus error logging when any save, validation, or payment load fails

- [ ] **Step 1: Write the failing component & integration tests in `tests/ChangesTab.test.tsx` and `tests/AdminPortal.test.tsx`**

Create `tests/ChangesTab.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { ChangesTab } from '../src/components/admin/ChangesTab';
import { ChangeLogEntry } from '../src/types';

const sampleEntries: ChangeLogEntry[] = [
  {
    id: 'chg-1',
    timestamp: '2026-11-18T10:00:00.000Z',
    who: 'zoe@weebles.com',
    what: "Weeble 'Ghost' - Price",
    oldValue: '$12.00',
    newValue: '$15.00',
  },
  {
    id: 'chg-2',
    timestamp: '2026-11-18T14:30:00.000Z',
    who: 'alice@weebles.com',
    what: 'Added Weeble: Berry Macaron',
    oldValue: '(none)',
    newValue: 'Price: $18.00',
  },
  {
    id: 'chg-3',
    timestamp: '2026-11-18T12:15:00.000Z',
    who: 'bob@weebles.com',
    what: 'Error: Save Inventory',
    oldValue: 'Delete Weeble: Ghost',
    newValue: 'ERROR: Network timeout',
  },
];

describe('ChangesTab', () => {
  it('renders empty state when there are no change entries', () => {
    render(<ChangesTab changes={[]} />);
    expect(screen.getByText(/No changes recorded yet/i)).toBeInTheDocument();
  });

  it('renders line-by-line rows sorted by When descending by default with local time', () => {
    render(<ChangesTab changes={sampleEntries} />);

    const rows = screen.getAllByTestId('change-log-row');
    expect(rows).toHaveLength(3);

    // Default sort is When descending: chg-2 (14:30) -> chg-3 (12:15) -> chg-1 (10:00)
    expect(within(rows[0]).getByText('alice@weebles.com')).toBeInTheDocument();
    expect(within(rows[1]).getByText('bob@weebles.com')).toBeInTheDocument();
    expect(within(rows[2]).getByText('zoe@weebles.com')).toBeInTheDocument();
  });

  it('allows sorting by each column (When, Who, What, Old, New) ascending and descending', () => {
    render(<ChangesTab changes={sampleEntries} />);

    // 1. Toggle When to ascending -> chg-1 (10:00), chg-3 (12:15), chg-2 (14:30)
    fireEvent.click(screen.getByRole('button', { name: /Sort by When/i }));
    let rows = screen.getAllByTestId('change-log-row');
    expect(within(rows[0]).getByText('zoe@weebles.com')).toBeInTheDocument();
    expect(within(rows[2]).getByText('alice@weebles.com')).toBeInTheDocument();

    // 2. Sort by Who ascending -> alice, bob, zoe
    fireEvent.click(screen.getByRole('button', { name: /Sort by Who/i }));
    rows = screen.getAllByTestId('change-log-row');
    expect(within(rows[0]).getByText('alice@weebles.com')).toBeInTheDocument();
    expect(within(rows[1]).getByText('bob@weebles.com')).toBeInTheDocument();
    expect(within(rows[2]).getByText('zoe@weebles.com')).toBeInTheDocument();

    // Toggle Who descending -> zoe, bob, alice
    fireEvent.click(screen.getByRole('button', { name: /Sort by Who/i }));
    rows = screen.getAllByTestId('change-log-row');
    expect(within(rows[0]).getByText('zoe@weebles.com')).toBeInTheDocument();
    expect(within(rows[2]).getByText('alice@weebles.com')).toBeInTheDocument();

    // 3. Sort by What ascending -> "Added Weeble...", "Error: Save Inventory", "Weeble 'Ghost' - Price"
    fireEvent.click(screen.getByRole('button', { name: /Sort by What/i }));
    rows = screen.getAllByTestId('change-log-row');
    expect(within(rows[0]).getByText('Added Weeble: Berry Macaron')).toBeInTheDocument();
    expect(within(rows[1]).getByText('Error: Save Inventory')).toBeInTheDocument();
    expect(within(rows[2]).getByText("Weeble 'Ghost' - Price")).toBeInTheDocument();

    // 4. Sort by Old ascending -> "$12.00", "(none)", "Delete Weeble: Ghost"
    fireEvent.click(screen.getByRole('button', { name: /Sort by Old/i }));
    rows = screen.getAllByTestId('change-log-row');
    expect(within(rows[0]).getByText('$12.00')).toBeInTheDocument();

    // 5. Sort by New ascending -> "$15.00", "ERROR: Network timeout", "Price: $18.00"
    fireEvent.click(screen.getByRole('button', { name: /Sort by New/i }));
    rows = screen.getAllByTestId('change-log-row');
    expect(within(rows[0]).getByText('$15.00')).toBeInTheDocument();
    expect(within(rows[1]).getByText('ERROR: Network timeout')).toBeInTheDocument();
    expect(within(rows[2]).getByText('Price: $18.00')).toBeInTheDocument();
  });
});
```

In `tests/AdminPortal.test.tsx`, add tests verifying the `Changes` tab renders and records both successful changes and errors:

```tsx
  it('logs changes line-by-line in the Changes tab when edits are saved', async () => {
    adminAuth.setSession({ token: 'valid-token', email: 'lucasshawn@gmail.com', name: 'Shawn' });
    vi.spyOn(adminApi, 'saveAdmins').mockResolvedValue({
      success: true,
      message: 'Admin whitelist saved successfully!',
    });
    vi.spyOn(adminApi, 'saveChanges').mockResolvedValue({
      success: true,
      message: 'Change log saved.',
    });

    render(
      <SettingsProvider>
        <AdminPortal />
      </SettingsProvider>
    );

    // Add a new admin
    fireEvent.click(screen.getByRole('button', { name: /Manage Admins/i }));
    fireEvent.change(screen.getByPlaceholderText(/friend@gmail.com/i), {
      target: { value: 'logger@weebles.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Add Admin/i }));

    await waitFor(() => {
      expect(adminApi.saveAdmins).toHaveBeenCalled();
    });

    // Switch to Changes tab and verify log row
    fireEvent.click(screen.getByRole('button', { name: /Changes/i }));
    expect(screen.getByText('Admin Whitelist - Added Admin')).toBeInTheDocument();
    expect(screen.getByText('logger@weebles.com')).toBeInTheDocument();
  });

  it('logs errors in the Changes tab when an admin action or save fails', async () => {
    adminAuth.setSession({ token: 'valid-token', email: 'lucasshawn@gmail.com', name: 'Shawn' });
    vi.spyOn(adminApi, 'saveInventory').mockRejectedValue(new Error('GitHub API 500 error'));
    vi.spyOn(adminApi, 'saveChanges').mockResolvedValue({
      success: true,
      message: 'Change log saved.',
    });
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    render(
      <SettingsProvider>
        <AdminPortal />
      </SettingsProvider>
    );

    // Trigger failed inventory delete
    const deleteBtns = screen.getAllByRole('button', { name: /Delete/i });
    fireEvent.click(deleteBtns[0]);

    await waitFor(() => {
      expect(screen.getByText(/GitHub API 500 error/i)).toBeInTheDocument();
    });

    // Also trigger an admin email validation error
    fireEvent.click(screen.getByRole('button', { name: /Manage Admins/i }));
    fireEvent.change(screen.getByPlaceholderText(/friend@gmail.com/i), {
      target: { value: 'invalid-email' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Add Admin/i }));

    // Open Changes tab and verify both errors are logged
    fireEvent.click(screen.getByRole('button', { name: /Changes/i }));
    expect(screen.getByText('Error: Save Inventory')).toBeInTheDocument();
    expect(screen.getByText('ERROR: GitHub API 500 error')).toBeInTheDocument();
    expect(screen.getByText('Error: Add Admin')).toBeInTheDocument();
    expect(screen.getByText(/ERROR: Please enter a valid email address/i)).toBeInTheDocument();
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/ChangesTab.test.tsx tests/AdminPortal.test.tsx`
Expected: FAIL (`Failed to resolve import "../src/components/admin/ChangesTab"` and missing `Changes` tab in `AdminPortal`)

- [ ] **Step 3: Implement `ChangesTab.tsx` and integrate into `AdminPortal.tsx`, `AdminsTab.tsx`, and `PaymentsTab.tsx`**

Create `src/components/admin/ChangesTab.tsx`:

```tsx
import React, { useState, useMemo } from 'react';
import { ArrowUpDown, ArrowUp, ArrowDown, History, AlertCircle } from 'lucide-react';
import { ChangeLogEntry } from '../../types';
import { formatLocalTimestamp } from '../../utils/changeLogUtils';

export interface ChangesTabProps {
  changes: ChangeLogEntry[];
}

type SortField = 'timestamp' | 'who' | 'what' | 'oldValue' | 'newValue';
type SortDirection = 'asc' | 'desc';

export const ChangesTab: React.FC<ChangesTabProps> = ({ changes }) => {
  const [sortField, setSortField] = useState<SortField>('timestamp');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection(field === 'timestamp' ? 'desc' : 'asc');
    }
  };

  const sortedChanges = useMemo(() => {
    const copy = [...changes];
    copy.sort((a, b) => {
      let comparison = 0;
      if (sortField === 'timestamp') {
        const tA = Date.parse(a.timestamp) || 0;
        const tB = Date.parse(b.timestamp) || 0;
        comparison = tA - tB;
      } else {
        const valA = String(a[sortField] ?? '');
        const valB = String(b[sortField] ?? '');
        comparison = valA.localeCompare(valB, undefined, { numeric: true, sensitivity: 'base' });
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });
    return copy;
  }, [changes, sortField, sortDirection]);

  const renderSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="w-3.5 h-3.5 text-neutral-400" />;
    }
    return sortDirection === 'asc' ? (
      <ArrowUp className="w-3.5 h-3.5 text-weeble-pink" />
    ) : (
      <ArrowDown className="w-3.5 h-3.5 text-weeble-pink" />
    );
  };

  const getAriaSort = (field: SortField): 'ascending' | 'descending' | 'none' => {
    if (sortField !== field) return 'none';
    return sortDirection === 'asc' ? 'ascending' : 'descending';
  };

  const columns: Array<{ field: SortField; label: string }> = [
    { field: 'timestamp', label: 'When' },
    { field: 'who', label: 'Who' },
    { field: 'what', label: 'What' },
    { field: 'oldValue', label: 'Old' },
    { field: 'newValue', label: 'New' },
  ];

  return (
    <div className="bg-white rounded-3xl border-2 border-pink-200 overflow-hidden shadow-sm">
      <div className="p-5 sm:p-6 border-b border-pink-100 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-pink-100 flex items-center justify-center text-weeble-pink">
            <History className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-bubble text-lg font-bold text-weeble-text">Changes & Error Log</h2>
            <p className="text-xs text-weeble-textMuted">
              Line-by-line history of all admin changes and errors in local time
            </p>
          </div>
        </div>
        <span className="text-xs font-bold text-weeble-textMuted">
          {changes.length} {changes.length === 1 ? 'entry' : 'entries'}
        </span>
      </div>

      {sortedChanges.length === 0 ? (
        <div className="p-10 text-center text-weeble-textMuted text-sm">
          No changes recorded yet.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-pink-100 bg-pink-50/50 text-[11px] font-bold text-neutral-600 uppercase tracking-wider">
                {columns.map((col) => (
                  <th
                    key={col.field}
                    aria-sort={getAriaSort(col.field)}
                    className="py-3 px-4 whitespace-nowrap"
                  >
                    <button
                      type="button"
                      onClick={() => handleSort(col.field)}
                      aria-label={`Sort by ${col.label}`}
                      className="inline-flex items-center gap-1.5 font-bold uppercase tracking-wider hover:text-weeble-pink transition-colors cursor-pointer"
                    >
                      <span>{col.label}</span>
                      {renderSortIcon(col.field)}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-pink-100 text-xs">
              {sortedChanges.map((entry) => {
                const isError =
                  entry.what.startsWith('Error:') || entry.newValue.startsWith('ERROR:');
                return (
                  <tr
                    key={entry.id}
                    data-testid="change-log-row"
                    className={
                      isError
                        ? 'bg-rose-50/60 hover:bg-rose-50 transition-colors'
                        : 'hover:bg-weeble-pinkWash/30 transition-colors'
                    }
                  >
                    <td className="py-3 px-4 text-neutral-600 whitespace-nowrap font-mono text-[11px]">
                      {formatLocalTimestamp(entry.timestamp)}
                    </td>
                    <td className="py-3 px-4 font-semibold text-weeble-text whitespace-nowrap">
                      {entry.who}
                    </td>
                    <td className="py-3 px-4 font-semibold whitespace-nowrap">
                      {isError ? (
                        <span className="inline-flex items-center gap-1 text-rose-700">
                          <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                          <span>{entry.what}</span>
                        </span>
                      ) : (
                        <span className="text-weeble-text">{entry.what}</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-neutral-600 break-words max-w-xs">
                      {entry.oldValue}
                    </td>
                    <td
                      className={`py-3 px-4 break-words max-w-xs font-medium ${
                        isError ? 'text-rose-700 font-bold' : 'text-weeble-text'
                      }`}
                    >
                      {entry.newValue}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
```

Update `src/components/admin/AdminsTab.tsx`:
- Add optional `onLogError?: (action: string, attemptedValue: string, errorMessage: string) => void;` to `AdminsTabProps`.
- In `handleAddAdmin`: when `validationError` is returned, also call `onLogError?.('Add Admin', newEmail.trim() || '(empty)', validationError);`.
- In `handleRemoveAdmin`: when `isCurrent` or `admins.length <= 1` fails validation, also call `onLogError?.('Remove Admin', emailToRemove, msg);`.

Update `src/components/admin/PaymentsTab.tsx`:
- Add optional `onLogError?: (action: string, attemptedValue: string, errorMessage: string) => void;` to `PaymentsTabProps` (`export interface PaymentsTabProps { onLogError?: (action: string, attemptedValue: string, errorMessage: string) => void; }`).
- In `loadData` catch block: call `onLogError?.('Load Payments', 'Stripe payments sync', errMsg);`.

Update `src/components/admin/AdminPortal.tsx`:
- Extend `AdminTab` to `'admins' | 'catalog' | 'payments' | 'content' | 'changes'`.
- Import `History` from `lucide-react`, `ChangesTab` from `./ChangesTab`, `initialChangesData` from `../../data/changes.json`, `ChangeLogEntry` from `../../types`, and `{ getStoredChanges, saveStoredChanges, mergeChanges, diffInventoryChanges, diffSettingsChanges, diffAdminsChanges, createErrorLogEntry, describeInventoryAttempt } from '../../utils/changeLogUtils'`.
- Maintain `changes` state initialized via `getStoredChanges(Array.isArray(initialChangesData) ? initialChangesData : [])`.
- On mount when `adminApi.loadStoreData()` resolves, if `Array.isArray(data?.changes)`, merge with `getStoredChanges()` via `mergeChanges` and persist to `localStorage`.
- Add `recordChanges(newEntries: ChangeLogEntry[])` and `recordError(action: string, attemptedValue: string, errMsg: string)` helpers that update `changes` state, call `saveStoredChanges`, and call `adminApi.saveChanges(newEntries).catch(() => {})`.
- Call `diffInventoryChanges`, `diffSettingsChanges`, and `diffAdminsChanges` in `handleSaveInventory`, `handleSaveSettings`, and `handleSaveAdmins` (recording diffs on success and calling `recordError` in `catch`), and render the `📋 Changes` tab button and `<ChangesTab changes={changes} />`.

- [ ] **Step 4: Run the full test suite to verify all tests pass**

Run: `npx vitest run`
Expected: PASS across all test files.
