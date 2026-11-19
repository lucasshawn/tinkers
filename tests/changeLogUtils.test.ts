import { describe, it, expect, beforeEach } from 'vitest';
import {
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
