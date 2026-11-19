import { Product, ChangeLogEntry } from '../types';
import { SiteSettings } from '../types/settings';
import { adminAuth } from './adminAuth';

export const adminApi = {
  async loadStoreData(): Promise<{ products?: Product[]; settings?: SiteSettings; changes?: ChangeLogEntry[] } | null> {
    try {
      const res = await fetch('/.netlify/functions/admin-save?action=load', {
        method: 'GET',
        headers: { 'Cache-Control': 'no-cache' },
      });
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  },

  async saveInventory(
    products: Product[],
    newImage?: { filename: string; base64Data: string }
  ): Promise<{ success: boolean; message: string }> {
    const session = adminAuth.getSession();
    if (!session) throw new Error('Not authenticated');

    const res = await fetch('/.netlify/functions/admin-save', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.token}`,
      },
      body: JSON.stringify({
        type: 'inventory',
        products,
        newImage,
      }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      const statusDetail = res.status ? ` (HTTP ${res.status})` : '';
      throw new Error(data.error || `Failed to save inventory${statusDetail}`);
    }

    return res.json();
  },

  async saveSettings(settings: SiteSettings): Promise<{ success: boolean; message: string }> {
    const session = adminAuth.getSession();
    if (!session) throw new Error('Not authenticated');

    const res = await fetch('/.netlify/functions/admin-save', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.token}`,
      },
      body: JSON.stringify({
        type: 'settings',
        settings,
      }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      const statusDetail = res.status ? ` (HTTP ${res.status})` : '';
      throw new Error(data.error || `Failed to save settings${statusDetail}`);
    }

    return res.json();
  },

  async saveAdmins(admins: string[]): Promise<{ success: boolean; message: string }> {
    const session = adminAuth.getSession();
    if (!session) throw new Error('Not authenticated');

    const res = await fetch('/.netlify/functions/admin-save', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.token}`,
      },
      body: JSON.stringify({
        type: 'admins',
        admins,
      }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      const statusDetail = res.status ? ` (HTTP ${res.status})` : '';
      throw new Error(data.error || `Failed to save admin whitelist${statusDetail}`);
    }

    return res.json();
  },

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
};
