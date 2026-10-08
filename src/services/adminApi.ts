import { Product } from '../types';
import { SiteSettings } from '../types/settings';
import { adminAuth } from './adminAuth';

export const adminApi = {
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
      throw new Error(data.error || 'Failed to save inventory');
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
      throw new Error(data.error || 'Failed to save settings');
    }

    return res.json();
  },
};
