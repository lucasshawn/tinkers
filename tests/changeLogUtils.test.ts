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
