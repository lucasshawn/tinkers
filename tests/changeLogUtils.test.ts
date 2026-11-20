import { describe, it, expect, beforeEach } from 'vitest';
import {
  CHANGE_LOG_RETENTION_MS,
  pruneExpiredChanges,
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
    it('logs a single entry with Comment when a new product is added', () => {
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
        user: adminEmail,
        change: 'Added Weeble: Strawberry Macaron',
        comment: 'New: Price: $16.50, Category: sweets, Stock: 5 (in stock)',
      });
    });

    it('logs a single entry with Comment when a product is deleted', () => {
      const entries = diffInventoryChanges(adminEmail, [baseProduct], [], fixedNow);
      expect(entries).toHaveLength(1);
      expect(entries[0]).toMatchObject({
        timestamp: fixedNow,
        user: adminEmail,
        change: 'Deleted Weeble: Chubby Bumblebee',
        comment: 'Removed: Price: $14.00, Category: animals, Stock: 3',
      });
    });

    it('logs one row per changed field with Old/New in Comment when an existing product is edited', () => {
      const updatedProduct: Product = {
        ...baseProduct,
        price: 18,
        stockCount: 0,
        inStock: false,
        description: 'Updated description',
      };

      const entries = diffInventoryChanges(adminEmail, [baseProduct], [updatedProduct], fixedNow);
      expect(entries).toHaveLength(4);
      expect(entries.map((e) => ({ change: e.change, comment: e.comment }))).toEqual([
        {
          change: "Weeble 'Chubby Bumblebee' - Description",
          comment: 'Old: Handmade bee charm -> New: Updated description',
        },
        {
          change: "Weeble 'Chubby Bumblebee' - Price",
          comment: 'Old: $14.00 -> New: $18.00',
        },
        {
          change: "Weeble 'Chubby Bumblebee' - Stock Count",
          comment: 'Old: 3 -> New: 0',
        },
        {
          change: "Weeble 'Chubby Bumblebee' - In Stock",
          comment: 'Old: true -> New: false',
        },
      ]);
    });

    it('returns empty array when no product fields changed', () => {
      expect(diffInventoryChanges(adminEmail, [baseProduct], [{ ...baseProduct }], fixedNow)).toEqual([]);
    });

    it('logs Magnet Photo and Keychain Photo additions, edits, and deletions', () => {
      const withVariantPhotos: Product = {
        ...baseProduct,
        variantImages: {
          magnet: '/images/products/bee-magnet.jpg',
          keychain: 'data:image/png;base64,abc123',
        },
      };

      const addedEntries = diffInventoryChanges(
        adminEmail,
        [baseProduct],
        [withVariantPhotos],
        fixedNow
      );
      expect(addedEntries.map((e) => ({ change: e.change, comment: e.comment }))).toEqual([
        {
          change: "Weeble 'Chubby Bumblebee' - Magnet Photo",
          comment: 'Old: (none) -> New: /images/products/bee-magnet.jpg',
        },
        {
          change: "Weeble 'Chubby Bumblebee' - Keychain Photo",
          comment: 'Old: (none) -> New: [uploaded image]',
        },
      ]);

      const editedAndDeleted: Product = {
        ...baseProduct,
        variantImages: {
          magnet: '/images/products/bee-magnet-v2.jpg',
        },
      };

      const editDeleteEntries = diffInventoryChanges(
        adminEmail,
        [withVariantPhotos],
        [editedAndDeleted],
        fixedNow
      );
      expect(editDeleteEntries.map((e) => ({ change: e.change, comment: e.comment }))).toEqual([
        {
          change: "Weeble 'Chubby Bumblebee' - Magnet Photo",
          comment: 'Old: /images/products/bee-magnet.jpg -> New: /images/products/bee-magnet-v2.jpg',
        },
        {
          change: "Weeble 'Chubby Bumblebee' - Keychain Photo",
          comment: 'Old: [uploaded image] -> New: (none)',
        },
      ]);
    });
  });

  describe('diffSettingsChanges', () => {
    it('logs one row per modified site setting field with Old/New in Comment', () => {
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
      expect(entries.map((e) => ({ change: e.change, comment: e.comment }))).toEqual([
        {
          change: 'Site Content - Announcement Banner Enabled',
          comment: 'Old: false -> New: true',
        },
        {
          change: 'Site Content - Announcement Banner Text',
          comment: 'Old: Fall restock! -> New: Winter drop live!',
        },
        {
          change: 'Site Content - General Contact Email',
          comment: 'Old: hello@weebles.com -> New: newcontact@weebles.com',
        },
        {
          change: 'Site Content - Instagram URL',
          comment: 'Old: https://instagram.com/weebles -> New: https://instagram.com/weebles_new',
        },
      ]);
    });
  });

  describe('diffAdminsChanges', () => {
    it('logs added and removed admins in Comment', () => {
      const addedEntries = diffAdminsChanges(
        adminEmail,
        ['lucasshawn@gmail.com'],
        ['lucasshawn@gmail.com', 'friend@gmail.com'],
        fixedNow
      );
      expect(addedEntries).toHaveLength(1);
      expect(addedEntries[0]).toMatchObject({
        user: adminEmail,
        change: 'Admin Whitelist - Added Admin',
        comment: 'Old: (not authorized) -> New: friend@gmail.com',
      });

      const removedEntries = diffAdminsChanges(
        adminEmail,
        ['lucasshawn@gmail.com', 'friend@gmail.com'],
        ['lucasshawn@gmail.com'],
        fixedNow
      );
      expect(removedEntries).toHaveLength(1);
      expect(removedEntries[0]).toMatchObject({
        user: adminEmail,
        change: 'Admin Whitelist - Removed Admin',
        comment: 'Old: friend@gmail.com -> New: (removed)',
      });
    });
  });

  describe('createErrorLogEntry & describeInventoryAttempt', () => {
    it('creates a diagnostic error log entry with error message, context, endpoint/status, and stack info', () => {
      const err = new Error('Backend Error: Payload Too Large (413)') as any;
      err.status = 413;
      err.endpoint = 'POST /.netlify/functions/admin-save';

      const entry = createErrorLogEntry(
        adminEmail,
        'Save Inventory',
        'Delete Weeble: Chubby Bumblebee',
        err,
        fixedNow
      );
      expect(entry.timestamp).toBe(fixedNow);
      expect(entry.user).toBe(adminEmail);
      expect(entry.change).toBe('Error: Save Inventory');
      expect(entry.comment).toContain('ERROR: Backend Error: Payload Too Large (413)');
      expect(entry.comment).toContain('Context: Delete Weeble: Chubby Bumblebee');
      expect(entry.comment).toContain('Endpoint: POST /.netlify/functions/admin-save (HTTP 413)');
      expect(entry.comment).toContain('Stack:');
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

  describe('localStorage & mergeChanges & 30-day retention & formatLocalTimestamp', () => {
    it('persists, reads, and deduplicates change entries via mergeChanges', () => {
      const now = Date.now();
      const t1 = new Date(now - 2 * 60 * 60 * 1000).toISOString();
      const t2 = new Date(now - 1 * 60 * 60 * 1000).toISOString();
      const e1 = createErrorLogEntry(adminEmail, 'Act 1', 'old1', 'err1', t1);
      const e2 = createErrorLogEntry(adminEmail, 'Act 2', 'old2', 'err2', t2);

      saveStoredChanges([e1]);
      expect(getStoredChanges()).toEqual([e1]);

      const merged = mergeChanges([e1], [e1, e2]);
      expect(merged).toHaveLength(2);
      expect(merged[0].id).toBe(e2.id);
      expect(merged[1].id).toBe(e1.id);
    });

    it('prunes entries older than 30 days in pruneExpiredChanges, mergeChanges, and getStoredChanges', () => {
      expect(CHANGE_LOG_RETENTION_MS).toBe(30 * 24 * 60 * 60 * 1000);
      const now = Date.now();
      const recentIso = new Date(now - 5 * 24 * 60 * 60 * 1000).toISOString();
      const boundaryIso = new Date(now - CHANGE_LOG_RETENTION_MS).toISOString();
      const expiredIso = new Date(now - CHANGE_LOG_RETENTION_MS - 1000).toISOString();

      const recentEntry = createErrorLogEntry(adminEmail, 'Recent', 'ctx', 'err', recentIso);
      const boundaryEntry = createErrorLogEntry(adminEmail, 'Boundary', 'ctx', 'err', boundaryIso);
      const expiredEntry = createErrorLogEntry(adminEmail, 'Expired', 'ctx', 'err', expiredIso);

      const pruned = pruneExpiredChanges([recentEntry, boundaryEntry, expiredEntry], now);
      expect(pruned.map((e) => e.id)).toEqual([recentEntry.id, boundaryEntry.id]);

      const merged = mergeChanges([expiredEntry], [recentEntry], now);
      expect(merged.map((e) => e.id)).toEqual([recentEntry.id]);
    });

    it('formats ISO timestamp into a local date/time string', () => {
      const formatted = formatLocalTimestamp('2026-11-18T17:45:00.000Z');
      expect(typeof formatted).toBe('string');
      expect(formatted).toContain('2026');
      expect(formatLocalTimestamp('invalid-date')).toBe('invalid-date');
    });
  });
});
