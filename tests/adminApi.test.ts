import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import { handler } from '../netlify/functions/admin-save';
import { adminApi } from '../src/services/adminApi';
import { adminAuth } from '../src/services/adminAuth';
import { Product } from '../src/types';
import { SiteSettings } from '../src/types/settings';

describe('admin-save Netlify Function', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.restoreAllMocks();
    process.env = { ...originalEnv };
    delete process.env.GITHUB_TOKEN;
    vi.spyOn(fs, 'writeFileSync').mockImplementation((() => undefined) as any);
    vi.spyOn(fs, 'mkdirSync').mockImplementation((() => undefined) as any);
    vi.spyOn(fs, 'existsSync').mockReturnValue(true);
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  const validToken = Buffer.from('lucasshawn@gmail.com:9999999999999:weebles-studio-dev-secret-2026').toString('base64');
  const validCierraToken = Buffer.from('lucascierra24@gmail.com:9999999999999:weebles-studio-dev-secret-2026').toString('base64');

  it('rejects non-POST HTTP methods with 405', async () => {
    const event = {
      httpMethod: 'GET',
      headers: {},
    };

    const res = await handler(event as any, {} as any) as any;
    expect(res.statusCode).toBe(405);
    expect(JSON.parse(res.body).error).toMatch(/method not allowed/i);
  });

  it('rejects unauthenticated requests with 401', async () => {
    const event = {
      httpMethod: 'POST',
      headers: {},
      body: JSON.stringify({ type: 'settings', settings: {} }),
    };

    const res = await handler(event as any, {} as any) as any;
    expect(res.statusCode).toBe(401);
    expect(JSON.parse(res.body).error).toMatch(/authentication required/i);
  });

  it('rejects non-Bearer authorization header with 403', async () => {
    const event = {
      httpMethod: 'POST',
      headers: { authorization: 'Basic 123456' },
      body: JSON.stringify({ type: 'settings', settings: {} }),
    };

    const res = await handler(event as any, {} as any) as any;
    expect(res.statusCode).toBe(403);
    expect(JSON.parse(res.body).error).toMatch(/unauthorized admin session/i);
  });

  it('rejects invalid or non-whitelisted session tokens with 403', async () => {
    const badToken = Buffer.from('hacker@gmail.com:9999999999999:weebles-studio-dev-secret-2026').toString('base64');
    const event = {
      httpMethod: 'POST',
      headers: { authorization: `Bearer ${badToken}` },
      body: JSON.stringify({ type: 'settings', settings: {} }),
    };

    const res = await handler(event as any, {} as any) as any;
    expect(res.statusCode).toBe(403);
    expect(JSON.parse(res.body).error).toMatch(/unauthorized admin session/i);
  });

  it('rejects expired session tokens with 403', async () => {
    const expiredToken = Buffer.from('lucasshawn@gmail.com:1000:weebles-studio-dev-secret-2026').toString('base64');
    const event = {
      httpMethod: 'POST',
      headers: { authorization: `Bearer ${expiredToken}` },
      body: JSON.stringify({ type: 'settings', settings: {} }),
    };

    const res = await handler(event as any, {} as any) as any;
    expect(res.statusCode).toBe(403);
    expect(JSON.parse(res.body).error).toMatch(/unauthorized admin session/i);
  });

  it('rejects token with wrong secret with 403', async () => {
    const wrongSecretToken = Buffer.from('lucasshawn@gmail.com:9999999999999:wrong-secret').toString('base64');
    const event = {
      httpMethod: 'POST',
      headers: { authorization: `Bearer ${wrongSecretToken}` },
      body: JSON.stringify({ type: 'settings', settings: {} }),
    };

    const res = await handler(event as any, {} as any) as any;
    expect(res.statusCode).toBe(403);
  });

  it('accepts authenticated request from whitelisted admin in dev mode (settings)', async () => {
    const event = {
      httpMethod: 'POST',
      headers: { authorization: `Bearer ${validToken}` },
      body: JSON.stringify({
        type: 'settings',
        settings: {
          contactEmail: 'test@weebles.com',
          customOrderEmail: 'test@weebles.com',
          socials: { tiktok: '', instagram: '', facebookMarketplace: '' }
        }
      }),
    };

    const res = await handler(event as any, {} as any) as any;
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.message).toMatch(/dev mode/i);
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      expect.stringContaining('settings.json'),
      expect.stringContaining('test@weebles.com')
    );
  });

  it('accepts authenticated request from Cierra in dev mode (inventory)', async () => {
    const mockProducts: Product[] = [
      {
        id: 'p1',
        name: 'Mini Dino',
        description: 'Cute clay dinosaur',
        price: 12,
        images: ['/images/products/dino.jpg'],
        category: 'animals',
        availableVariants: ['magnet'],
        inStock: true,
        stockCount: 5,
      },
    ];

    const event = {
      httpMethod: 'POST',
      headers: { Authorization: `Bearer ${validCierraToken}` },
      body: JSON.stringify({
        type: 'inventory',
        products: mockProducts,
      }),
    };

    const res = await handler(event as any, {} as any) as any;
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.message).toMatch(/dev mode/i);
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      expect.stringContaining('products.json'),
      expect.stringContaining('Mini Dino')
    );
  });

  it('handles image upload in dev mode, creating directory if necessary', async () => {
    vi.spyOn(fs, 'existsSync').mockReturnValue(false);

    const event = {
      httpMethod: 'POST',
      headers: { authorization: `Bearer ${validToken}` },
      body: JSON.stringify({
        type: 'inventory',
        products: [],
        newImage: {
          filename: 'cute_bunny.png',
          base64Data: 'data:image/png;base64,aGVsbG8=',
        },
      }),
    };

    const res = await handler(event as any, {} as any) as any;
    expect(res.statusCode).toBe(200);
    expect(fs.mkdirSync).toHaveBeenCalledWith(expect.stringContaining('products'), { recursive: true });
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      expect.stringContaining('cute_bunny.png'),
      expect.any(Buffer)
    );
  });

  it('commits settings to GitHub when GITHUB_TOKEN is set', async () => {
    process.env.GITHUB_TOKEN = 'ghp_test_token_123';
    process.env.GITHUB_REPO = 'lucasshawn/tinkers';
    process.env.GITHUB_BRANCH = 'master';

    const mockFetch = vi.fn()
      // First call: GET existing file sha
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ sha: 'existing-sha-123' }),
      })
      // Second call: PUT new content
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ commit: { sha: 'new-commit-sha' } }),
      });
    globalThis.fetch = mockFetch;

    const event = {
      httpMethod: 'POST',
      headers: { authorization: `Bearer ${validToken}` },
      body: JSON.stringify({
        type: 'settings',
        settings: {
          contactEmail: 'owner@weebles.com',
          customOrderEmail: 'owner@weebles.com',
          socials: { tiktok: '', instagram: '', facebookMarketplace: '' }
        }
      }),
    };

    const res = await handler(event as any, {} as any) as any;
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.message).toMatch(/committed to github/i);

    expect(mockFetch).toHaveBeenCalledTimes(2);
    // GET check
    expect(mockFetch).toHaveBeenNthCalledWith(
      1,
      'https://api.github.com/repos/lucasshawn/tinkers/contents/src/data/settings.json?ref=master',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer ghp_test_token_123',
        }),
      })
    );
    // PUT update
    expect(mockFetch).toHaveBeenNthCalledWith(
      2,
      'https://api.github.com/repos/lucasshawn/tinkers/contents/src/data/settings.json',
      expect.objectContaining({
        method: 'PUT',
        body: expect.stringContaining('"sha":"existing-sha-123"'),
      })
    );
  });

  it('commits inventory and uploaded image to GitHub when GITHUB_TOKEN is set', async () => {
    process.env.GITHUB_TOKEN = 'ghp_test_token_123';

    const mockFetch = vi.fn()
      // 1. GET image (not found / 404)
      .mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => ({}),
      })
      // 2. PUT image
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ commit: { sha: 'img-sha' } }),
      })
      // 3. GET products.json
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ sha: 'products-sha-456' }),
      })
      // 4. PUT products.json
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ commit: { sha: 'new-products-sha' } }),
      });
    globalThis.fetch = mockFetch;

    const event = {
      httpMethod: 'POST',
      headers: { authorization: `Bearer ${validToken}` },
      body: JSON.stringify({
        type: 'inventory',
        products: [],
        newImage: {
          filename: 'mushroom.jpg',
          base64Data: 'data:image/jpeg;base64,bXVzaHJvb20=',
        },
      }),
    };

    const res = await handler(event as any, {} as any) as any;
    expect(res.statusCode).toBe(200);
    expect(mockFetch).toHaveBeenCalledTimes(4);
  });

  it('returns 500 when GitHub commit API returns error', async () => {
    process.env.GITHUB_TOKEN = 'ghp_test_token_123';

    const mockFetch = vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 404 })
      .mockResolvedValueOnce({
        ok: false,
        status: 409,
        json: async () => ({ message: 'Conflict: sha does not match' }),
      });
    globalThis.fetch = mockFetch;

    const event = {
      httpMethod: 'POST',
      headers: { authorization: `Bearer ${validToken}` },
      body: JSON.stringify({
        type: 'settings',
        settings: { contactEmail: 'test@weebles.com' },
      }),
    };

    const res = await handler(event as any, {} as any) as any;
    expect(res.statusCode).toBe(500);
    const body = JSON.parse(res.body);
    expect(body.error).toMatch(/Conflict: sha does not match/i);
  });

  it('rejects invalid save payload with 400', async () => {
    const event = {
      httpMethod: 'POST',
      headers: { authorization: `Bearer ${validToken}` },
      body: JSON.stringify({
        type: 'unknown-type',
      }),
    };

    const res = await handler(event as any, {} as any) as any;
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).error).toMatch(/invalid save payload/i);
  });

  it('handles malformed JSON body with 500', async () => {
    const event = {
      httpMethod: 'POST',
      headers: { authorization: `Bearer ${validToken}` },
      body: '{ bad-json',
    };

    const res = await handler(event as any, {} as any) as any;
    expect(res.statusCode).toBe(500);
  });
});

describe('adminApi client service', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  const mockSettings: SiteSettings = {
    contactEmail: 'contact@weebles.com',
    customOrderEmail: 'orders@weebles.com',
    socials: {
      tiktok: 'https://tiktok.com/@weebles',
      instagram: 'https://instagram.com/weebles',
      facebookMarketplace: '',
    },
  };

  const mockProducts: Product[] = [
    {
      id: 'cat-1',
      name: 'Calico Cat',
      description: 'Handmade cat magnet',
      price: 15,
      images: ['/images/products/cat.jpg'],
      category: 'animals',
      availableVariants: ['magnet'],
      inStock: true,
      stockCount: 3,
    },
  ];

  it('saveInventory throws error when not authenticated', async () => {
    await expect(adminApi.saveInventory(mockProducts)).rejects.toThrow(/not authenticated/i);
  });

  it('saveInventory posts payload with session Bearer token and returns response', async () => {
    adminAuth.setSession({
      token: 'client-test-token',
      email: 'lucasshawn@gmail.com',
    });

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, message: 'Saved successfully' }),
    });
    globalThis.fetch = mockFetch;

    const result = await adminApi.saveInventory(mockProducts, {
      filename: 'cat-new.jpg',
      base64Data: 'data:image/jpeg;base64,1234',
    });

    expect(result.success).toBe(true);
    expect(result.message).toBe('Saved successfully');
    expect(mockFetch).toHaveBeenCalledWith(
      '/.netlify/functions/admin-save',
      expect.objectContaining({
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer client-test-token',
        },
        body: JSON.stringify({
          type: 'inventory',
          products: mockProducts,
          newImage: {
            filename: 'cat-new.jpg',
            base64Data: 'data:image/jpeg;base64,1234',
          },
        }),
      })
    );
  });

  it('saveInventory throws error when API returns failure status', async () => {
    adminAuth.setSession({
      token: 'client-test-token',
      email: 'lucasshawn@gmail.com',
    });

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'GitHub rate limit exceeded' }),
    });

    await expect(adminApi.saveInventory([])).rejects.toThrow('GitHub rate limit exceeded');
  });

  it('saveSettings throws error when not authenticated', async () => {
    await expect(adminApi.saveSettings(mockSettings)).rejects.toThrow(/not authenticated/i);
  });

  it('saveSettings posts payload with session Bearer token and returns response', async () => {
    adminAuth.setSession({
      token: 'settings-token',
      email: 'lucascierra24@gmail.com',
    });

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, message: 'Settings saved' }),
    });
    globalThis.fetch = mockFetch;

    const result = await adminApi.saveSettings(mockSettings);
    expect(result.success).toBe(true);
    expect(mockFetch).toHaveBeenCalledWith(
      '/.netlify/functions/admin-save',
      expect.objectContaining({
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer settings-token',
        },
        body: JSON.stringify({
          type: 'settings',
          settings: mockSettings,
        }),
      })
    );
  });

  it('saveSettings throws error when API returns failure status', async () => {
    adminAuth.setSession({
      token: 'settings-token',
      email: 'lucascierra24@gmail.com',
    });

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'Disk full' }),
    });

    await expect(adminApi.saveSettings(mockSettings)).rejects.toThrow('Disk full');
  });
});
