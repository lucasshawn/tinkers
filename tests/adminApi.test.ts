import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import { handler } from '../netlify/functions/admin-save';
import { createSessionToken } from '../netlify/functions/admin-auth';
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

  const validToken = createSessionToken('lucasshawn@gmail.com', 9999999999999);
  const validCierraToken = createSessionToken('lucascierra24@gmail.com', 9999999999999);

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
    const badToken = createSessionToken('hacker@gmail.com', 9999999999999);
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
    const expiredToken = createSessionToken('lucasshawn@gmail.com', 1000);
    const event = {
      httpMethod: 'POST',
      headers: { authorization: `Bearer ${expiredToken}` },
      body: JSON.stringify({ type: 'settings', settings: {} }),
    };

    const res = await handler(event as any, {} as any) as any;
    expect(res.statusCode).toBe(403);
    expect(JSON.parse(res.body).error).toMatch(/unauthorized admin session/i);
  });

  it('rejects token with wrong secret or tampered signature with 403', async () => {
    const wrongSecretToken = createSessionToken('lucasshawn@gmail.com', 9999999999999, 'wrong-secret');
    const event = {
      httpMethod: 'POST',
      headers: { authorization: `Bearer ${wrongSecretToken}` },
      body: JSON.stringify({ type: 'settings', settings: {} }),
    };

    const res = await handler(event as any, {} as any) as any;
    expect(res.statusCode).toBe(403);

    // Tampered signature
    const tamperedRes = await handler({
      httpMethod: 'POST',
      headers: { authorization: `Bearer ${validToken}tampered` },
      body: JSON.stringify({ type: 'settings', settings: {} }),
    } as any, {} as any) as any;
    expect(tamperedRes.statusCode).toBe(403);

    // Malformed token without dot
    const malformedRes = await handler({
      httpMethod: 'POST',
      headers: { authorization: 'Bearer malformedtokennodot' },
      body: JSON.stringify({ type: 'settings', settings: {} }),
    } as any, {} as any) as any;
    expect(malformedRes.statusCode).toBe(403);
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

  it('commits multiple uploaded images from newImages array to GitHub and in dev mode', async () => {
    vi.spyOn(fs, 'existsSync').mockReturnValue(true);

    const devEvent = {
      httpMethod: 'POST',
      headers: { authorization: `Bearer ${validToken}` },
      body: JSON.stringify({
        type: 'inventory',
        products: [],
        newImages: [
          { filename: 'base.png', base64Data: 'data:image/png;base64,YmFzZQ==' },
          { filename: 'p1-magnet-m.png', base64Data: 'data:image/png;base64,bWFnbmV0' },
          { filename: 'p1-keychain-k.png', base64Data: 'data:image/png;base64,a2V5Y2hhaW4=' },
        ],
      }),
    };

    const devRes = (await handler(devEvent as any, {} as any)) as any;
    expect(devRes.statusCode).toBe(200);
    expect(fs.writeFileSync).toHaveBeenCalledWith(expect.stringContaining('base.png'), expect.any(Buffer));
    expect(fs.writeFileSync).toHaveBeenCalledWith(expect.stringContaining('p1-magnet-m.png'), expect.any(Buffer));
    expect(fs.writeFileSync).toHaveBeenCalledWith(expect.stringContaining('p1-keychain-k.png'), expect.any(Buffer));

    // Also verify GitHub commits for multiple images
    process.env.GITHUB_TOKEN = 'ghp_test_token_123';
    const mockFetch = vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 404, json: async () => ({}) }) // GET img 1
      .mockResolvedValueOnce({ ok: true, json: async () => ({ commit: { sha: 'img1-sha' } }) }) // PUT img 1
      .mockResolvedValueOnce({ ok: false, status: 404, json: async () => ({}) }) // GET img 2
      .mockResolvedValueOnce({ ok: true, json: async () => ({ commit: { sha: 'img2-sha' } }) }) // PUT img 2
      .mockResolvedValueOnce({ ok: true, json: async () => ({ sha: 'products-sha' }) }) // GET products.json
      .mockResolvedValueOnce({ ok: true, json: async () => ({ commit: { sha: 'new-products-sha' } }) }); // PUT products.json
    globalThis.fetch = mockFetch;

    const ghEvent = {
      httpMethod: 'POST',
      headers: { authorization: `Bearer ${validToken}` },
      body: JSON.stringify({
        type: 'inventory',
        products: [],
        newImages: [
          { filename: 'p1-magnet-m.jpg', base64Data: 'data:image/jpeg;base64,bWFnbmV0' },
          { filename: 'p1-keychain-k.jpg', base64Data: 'data:image/jpeg;base64,a2V5Y2hhaW4=' },
        ],
      }),
    };

    const ghRes = (await handler(ghEvent as any, {} as any)) as any;
    expect(ghRes.statusCode).toBe(200);
    expect(mockFetch).toHaveBeenCalledTimes(6);
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

  it('saves updated admin whitelist in dev mode', async () => {
    const validToken = createSessionToken('lucasshawn@gmail.com', 9999999999999);
    const event = {
      httpMethod: 'POST',
      headers: { authorization: `Bearer ${validToken}` },
      body: JSON.stringify({
        type: 'admins',
        admins: ['lucasshawn@gmail.com', 'lucascierra24@gmail.com', 'newadmin@gmail.com'],
      }),
    };

    const res = await handler(event as any, {} as any) as any;
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).success).toBe(true);
  });

  it('commits admins whitelist to GitHub when GITHUB_TOKEN is set', async () => {
    process.env.GITHUB_TOKEN = 'ghp_test_token_123';
    process.env.GITHUB_REPO = 'lucasshawn/tinkers';
    process.env.GITHUB_BRANCH = 'master';

    const mockFetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ sha: 'settings-sha-789' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ commit: { sha: 'new-admins-sha' } }),
      });
    globalThis.fetch = mockFetch;

    const event = {
      httpMethod: 'POST',
      headers: { authorization: `Bearer ${validToken}` },
      body: JSON.stringify({
        type: 'admins',
        admins: ['lucasshawn@gmail.com', 'lucascierra24@gmail.com', 'newadmin@gmail.com'],
      }),
    };

    const res = await handler(event as any, {} as any) as any;
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.message).toMatch(/committed to github/i);

    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(mockFetch).toHaveBeenNthCalledWith(
      2,
      'https://api.github.com/repos/lucasshawn/tinkers/contents/src/data/settings.json',
      expect.objectContaining({
        method: 'PUT',
        body: expect.stringContaining('"sha":"settings-sha-789"'),
      })
    );
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

  it('falls back to os.tmpdir() instead of throwing ENOENT when /var/task/src/data is missing in serverless runtime', async () => {
    vi.spyOn(fs, 'writeFileSync').mockImplementation(((filePath: fs.PathOrFileDescriptor) => {
      const p = String(filePath).replace(/\\/g, '/');
      if (p.includes('src/data/') || p.includes('public/images/products')) {
        const err: any = new Error(`ENOENT: no such file or directory, open '/var/task/src/data/products.json'`);
        err.code = 'ENOENT';
        throw err;
      }
      return undefined;
    }) as any);

    const event = {
      httpMethod: 'POST',
      headers: { authorization: `Bearer ${validToken}` },
      body: JSON.stringify({
        type: 'inventory',
        products: [
          {
            id: 'weeble-bee',
            name: 'Chubby Bumblebee',
            description: 'Honey bee',
            price: 14,
            images: ['/images/products/bumblebee.jpg'],
            category: 'animals',
            availableVariants: ['magnet'],
            inStock: true,
            stockCount: 4,
          },
        ],
      }),
    };

    const res = await handler(event as any, {} as any) as any;
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
  });

  it('persists inventory to Netlify Blobs when event.blobs context is injected by Netlify', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({}),
    });
    globalThis.fetch = mockFetch;

    const blobsPayload = Buffer.from(
      JSON.stringify({ url: 'https://edge.netlify.com', token: 'netlify-blobs-token-xyz' })
    ).toString('base64');

    const event = {
      httpMethod: 'POST',
      headers: {
        authorization: `Bearer ${validToken}`,
        'x-nf-site-id': 'site-12345',
      },
      blobs: blobsPayload,
      body: JSON.stringify({
        type: 'inventory',
        products: [
          {
            id: 'weeble-bee',
            name: 'Chubby Bumblebee',
            description: 'Honey bee',
            price: 14,
            images: ['/images/products/bumblebee.jpg'],
            category: 'animals',
            availableVariants: ['magnet'],
            inStock: true,
            stockCount: 1,
          },
        ],
      }),
    };

    const res = await handler(event as any, {} as any) as any;
    expect(res.statusCode).toBe(200);
    expect(mockFetch).toHaveBeenCalledWith(
      'https://edge.netlify.com/site-12345/site:weebles-store/products',
      expect.objectContaining({
        method: 'PUT',
        headers: expect.objectContaining({
          authorization: 'Bearer netlify-blobs-token-xyz',
        }),
      })
    );
  });

  it('returns persisted products and settings on GET with action=load', async () => {
    const event = {
      httpMethod: 'GET',
      headers: {},
      queryStringParameters: { action: 'load' },
    };

    const res = await handler(event as any, {} as any) as any;
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(Array.isArray(body.products)).toBe(true);
    expect(body.settings).toBeDefined();
  });

  it('migrates legacy Netlify Blobs settings payload with custom socials and no socialLinks on GET action=load', async () => {
    const legacyBlobSettings = {
      contactEmail: 'custom@weebles.com',
      customOrderEmail: 'orders@weebles.com',
      socials: {
        tiktok: 'https://tiktok.com/@custom_clay',
        instagram: 'https://instagram.com/custom_clay',
        facebookMarketplace: '',
      },
    };

    globalThis.fetch = vi.fn().mockImplementation(async (url: string) => {
      if (String(url).endsWith('/settings')) {
        return {
          ok: true,
          json: async () => legacyBlobSettings,
        };
      }
      return { ok: false, status: 404 };
    });

    const blobsPayload = Buffer.from(
      JSON.stringify({ url: 'https://edge.netlify.com', token: 'netlify-blobs-token-xyz' })
    ).toString('base64');

    const event = {
      httpMethod: 'GET',
      headers: {
        'x-nf-site-id': 'site-12345',
      },
      blobs: blobsPayload,
      queryStringParameters: { action: 'load' },
    };

    const res = (await handler(event as any, {} as any)) as any;
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.settings.contactEmail).toBe('custom@weebles.com');
    expect(body.settings.socialLinks).toHaveLength(3);
    expect(body.settings.socialLinks[0]).toMatchObject({
      platform: 'tiktok',
      url: 'https://tiktok.com/@custom_clay',
      enabled: true,
    });
    expect(body.settings.socialLinks[1]).toMatchObject({
      platform: 'instagram',
      url: 'https://instagram.com/custom_clay',
      enabled: true,
    });
    expect(body.settings.socialLinks[2]).toMatchObject({
      platform: 'facebookMarketplace',
      url: '',
      enabled: false,
    });
  });

  it('decodes base64-encoded event.body when event.isBase64Encoded is true', async () => {
    const payload = JSON.stringify({
      type: 'inventory',
      products: [
        {
          id: 'weeble-b64',
          name: 'Base64 Bunny',
          description: 'Encoded payload test',
          price: 15,
          images: ['/images/products/bunny.jpg'],
          category: 'animals',
          availableVariants: ['magnet'],
          inStock: true,
          stockCount: 3,
        },
      ],
    });

    const event = {
      httpMethod: 'POST',
      headers: { authorization: `Bearer ${validToken}` },
      isBase64Encoded: true,
      body: Buffer.from(payload, 'utf-8').toString('base64'),
    };

    const res = await handler(event as any, {} as any) as any;
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).success).toBe(true);
  });

  it('saves and merges change log entries when type is changes and prunes entries older than 30 days', async () => {
    const recentIso = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
    const expiredIso = new Date(Date.now() - 35 * 24 * 60 * 60 * 1000).toISOString();
    const entries = [
      {
        id: 'chg-recent',
        timestamp: recentIso,
        user: 'lucasshawn@gmail.com',
        change: 'Added Weeble: Strawberry Macaron',
        comment: 'New: Price: $16.50, Category: sweets, Stock: 5 (in stock)',
      },
      {
        id: 'chg-expired',
        timestamp: expiredIso,
        user: 'lucasshawn@gmail.com',
        change: 'Old Expired Change',
        comment: 'Should be pruned',
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
    expect(fs.writeFileSync).not.toHaveBeenCalledWith(
      expect.stringContaining('changes.json'),
      expect.stringContaining('Old Expired Change')
    );
  });

  it('saves categories and cascades removal onto products when type is categories', async () => {
    const updatedCategories = [{ id: 'animals', label: 'Critters', emoji: '🐰' }];
    const productsWithRemovedCat: Product[] = [
      {
        id: 'p1',
        name: 'Sweet Bunny',
        description: 'Bunny holding donut',
        price: 14,
        images: ['/images/products/bunny.jpg'],
        categories: ['animals', 'sweets'],
        availableVariants: ['magnet'],
        inStock: true,
        stockCount: 2,
      },
      {
        id: 'p2',
        name: 'Donut Charm',
        description: 'Glazed donut',
        price: 13,
        images: ['/images/products/donut.jpg'],
        categories: ['sweets'],
        availableVariants: ['keychain'],
        inStock: true,
        stockCount: 1,
      },
    ];

    const event = {
      httpMethod: 'POST',
      headers: { authorization: `Bearer ${validToken}` },
      body: JSON.stringify({
        type: 'categories',
        categories: updatedCategories,
        products: productsWithRemovedCat,
      }),
    };

    const res = (await handler(event as any, {} as any)) as any;
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);

    const writeCalls = (fs.writeFileSync as any).mock.calls;
    const settingsCall = writeCalls.find((c: any[]) => String(c[0]).includes('settings.json'));
    const productsCall = writeCalls.find((c: any[]) => String(c[0]).includes('products.json'));

    expect(settingsCall).toBeDefined();
    expect(JSON.parse(settingsCall[1]).categories).toEqual(updatedCategories);

    expect(productsCall).toBeDefined();
    const writtenProducts = JSON.parse(productsCall[1]);
    expect(writtenProducts[0].categories).toEqual(['animals']);
    expect(writtenProducts[1].categories).toEqual([]);
  });

  it('preserves existing categories when saving settings without a categories property', async () => {
    const existingSettings = {
      contactEmail: 'old@weebles.com',
      customOrderEmail: 'old@weebles.com',
      socials: { tiktok: '', instagram: '', facebookMarketplace: '' },
      admins: ['lucasshawn@gmail.com'],
      categories: [{ id: 'seasonal', label: 'Seasonal', emoji: '🎄' }],
    };
    vi.spyOn(fs, 'readFileSync').mockReturnValue(JSON.stringify(existingSettings));

    const event = {
      httpMethod: 'POST',
      headers: { authorization: `Bearer ${validToken}` },
      body: JSON.stringify({
        type: 'settings',
        settings: {
          contactEmail: 'new@weebles.com',
          customOrderEmail: 'new@weebles.com',
          socials: { tiktok: '', instagram: '', facebookMarketplace: '' },
        },
      }),
    };

    const res = (await handler(event as any, {} as any)) as any;
    expect(res.statusCode).toBe(200);

    const writeCalls = (fs.writeFileSync as any).mock.calls;
    const settingsCall = writeCalls.find((c: any[]) => String(c[0]).includes('settings.json'));
    expect(JSON.parse(settingsCall[1]).categories).toEqual([
      { id: 'seasonal', label: 'Seasonal', emoji: '🎄' },
    ]);
  });

  it('writes settings.json without rewriting products.json when products is omitted and persisted products are clean', async () => {
    const persistedSettings = {
      contactEmail: 'hello@weebles.com',
      customOrderEmail: 'orders@weebles.com',
      socials: { tiktok: '', instagram: '', facebookMarketplace: '' },
      admins: ['lucasshawn@gmail.com'],
      categories: [{ id: 'animals', label: 'Critters', emoji: '🐰' }],
    };
    const cleanProducts: Product[] = [
      {
        id: 'p-clean',
        name: 'Clean Bunny',
        description: 'Already normalized',
        price: 14,
        images: ['/images/products/bunny.jpg'],
        categories: ['animals'],
        availableVariants: ['magnet'],
        inStock: true,
        stockCount: 2,
      },
    ];
    vi.spyOn(fs, 'readFileSync').mockImplementation(((filePath: fs.PathOrFileDescriptor) => {
      const p = String(filePath);
      if (p.endsWith('settings.json')) return JSON.stringify(persistedSettings);
      if (p.endsWith('products.json')) return JSON.stringify(cleanProducts);
      return '[]';
    }) as any);

    const updatedCategories = [
      { id: 'animals', label: 'Critters', emoji: '🐰' },
      { id: 'sweets', label: 'Sweets', emoji: '🍩' },
    ];
    const event = {
      httpMethod: 'POST',
      headers: { authorization: `Bearer ${validToken}` },
      body: JSON.stringify({
        type: 'categories',
        categories: updatedCategories,
      }),
    };

    const res = (await handler(event as any, {} as any)) as any;
    expect(res.statusCode).toBe(200);

    const writeCalls = (fs.writeFileSync as any).mock.calls;
    const settingsCall = writeCalls.find((c: any[]) => String(c[0]).endsWith('settings.json'));
    const productsWrites = writeCalls.filter((c: any[]) => String(c[0]).endsWith('products.json'));

    expect(settingsCall).toBeDefined();
    expect(JSON.parse(settingsCall[1]).categories).toEqual(updatedCategories);
    expect(productsWrites).toHaveLength(0);
  });

  it('rewrites products.json when products is omitted and persisted products contain legacy category or deleted category IDs', async () => {
    const persistedSettings = {
      contactEmail: 'hello@weebles.com',
      customOrderEmail: 'orders@weebles.com',
      socials: { tiktok: '', instagram: '', facebookMarketplace: '' },
      admins: ['lucasshawn@gmail.com'],
      categories: [
        { id: 'animals', label: 'Critters', emoji: '🐰' },
        { id: 'sweets', label: 'Sweets', emoji: '🍩' },
      ],
    };
    const dirtyProducts = [
      {
        id: 'p-legacy',
        name: 'Legacy Bee',
        description: 'Has legacy category field',
        price: 14,
        images: ['/images/products/bee.jpg'],
        category: 'animals',
        availableVariants: ['magnet'],
        inStock: true,
        stockCount: 2,
      },
      {
        id: 'p-stale',
        name: 'Stale Donut',
        description: 'References deleted category',
        price: 15,
        images: ['/images/products/donut.jpg'],
        categories: ['animals', 'sweets'],
        availableVariants: ['keychain'],
        inStock: true,
        stockCount: 1,
      },
    ];
    vi.spyOn(fs, 'readFileSync').mockImplementation(((filePath: fs.PathOrFileDescriptor) => {
      const p = String(filePath);
      if (p.endsWith('settings.json')) return JSON.stringify(persistedSettings);
      if (p.endsWith('products.json')) return JSON.stringify(dirtyProducts);
      return '[]';
    }) as any);

    const updatedCategories = [{ id: 'animals', label: 'Critters', emoji: '🐰' }];
    const event = {
      httpMethod: 'POST',
      headers: { authorization: `Bearer ${validToken}` },
      body: JSON.stringify({
        type: 'categories',
        categories: updatedCategories,
      }),
    };

    const res = (await handler(event as any, {} as any)) as any;
    expect(res.statusCode).toBe(200);

    const writeCalls = (fs.writeFileSync as any).mock.calls;
    const productsCall = writeCalls.find((c: any[]) => String(c[0]).endsWith('products.json'));
    expect(productsCall).toBeDefined();

    const writtenProducts = JSON.parse(productsCall[1]);
    expect(writtenProducts[0].categories).toEqual(['animals']);
    expect(writtenProducts[0]).not.toHaveProperty('category');
    expect(writtenProducts[1].categories).toEqual(['animals']);
  });

  it('saves empty categories array and clears categories from all products when categories is []', async () => {
    const persistedSettings = {
      contactEmail: 'hello@weebles.com',
      customOrderEmail: 'orders@weebles.com',
      socials: { tiktok: '', instagram: '', facebookMarketplace: '' },
      admins: ['lucasshawn@gmail.com'],
      categories: [{ id: 'animals', label: 'Critters', emoji: '🐰' }],
    };
    const persistedProducts = [
      {
        id: 'p1',
        name: 'Critter Buddy',
        description: 'Has animals category',
        price: 14,
        images: ['/images/products/bee.jpg'],
        categories: ['animals'],
        availableVariants: ['magnet'],
        inStock: true,
        stockCount: 2,
      },
      {
        id: 'p2',
        name: 'Legacy Sweet',
        description: 'Has legacy category',
        price: 15,
        images: ['/images/products/donut.jpg'],
        category: 'sweets',
        availableVariants: ['keychain'],
        inStock: true,
        stockCount: 1,
      },
    ];
    vi.spyOn(fs, 'readFileSync').mockImplementation(((filePath: fs.PathOrFileDescriptor) => {
      const p = String(filePath);
      if (p.endsWith('settings.json')) return JSON.stringify(persistedSettings);
      if (p.endsWith('products.json')) return JSON.stringify(persistedProducts);
      return '[]';
    }) as any);

    const event = {
      httpMethod: 'POST',
      headers: { authorization: `Bearer ${validToken}` },
      body: JSON.stringify({
        type: 'categories',
        categories: [],
      }),
    };

    const res = (await handler(event as any, {} as any)) as any;
    expect(res.statusCode).toBe(200);

    const writeCalls = (fs.writeFileSync as any).mock.calls;
    const settingsCall = writeCalls.find((c: any[]) => String(c[0]).endsWith('settings.json'));
    const productsCall = writeCalls.find((c: any[]) => String(c[0]).endsWith('products.json'));

    expect(settingsCall).toBeDefined();
    expect(JSON.parse(settingsCall[1]).categories).toEqual([]);

    expect(productsCall).toBeDefined();
    const writtenProducts = JSON.parse(productsCall[1]);
    expect(writtenProducts).toHaveLength(2);
    expect(writtenProducts[0].categories).toEqual([]);
    expect(writtenProducts[1].categories).toEqual([]);
    expect(writtenProducts[1]).not.toHaveProperty('category');
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

    const result = await adminApi.saveInventory(mockProducts, [
      {
        filename: 'cat-new.jpg',
        base64Data: 'data:image/jpeg;base64,1234',
      },
      {
        filename: 'cat-1-magnet-m.jpg',
        base64Data: 'data:image/jpeg;base64,5678',
      },
    ]);

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
          newImages: [
            {
              filename: 'cat-new.jpg',
              base64Data: 'data:image/jpeg;base64,1234',
            },
            {
              filename: 'cat-1-magnet-m.jpg',
              base64Data: 'data:image/jpeg;base64,5678',
            },
          ],
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

  it('saveAdmins throws error when not authenticated', async () => {
    await expect(adminApi.saveAdmins(['lucasshawn@gmail.com'])).rejects.toThrow(/not authenticated/i);
  });

  it('saveAdmins posts payload with session Bearer token and returns response', async () => {
    adminAuth.setSession({
      token: 'admins-token',
      email: 'lucasshawn@gmail.com',
    });

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, message: 'Admin whitelist saved' }),
    });
    globalThis.fetch = mockFetch;

    const result = await adminApi.saveAdmins(['lucasshawn@gmail.com', 'lucascierra24@gmail.com', 'newadmin@gmail.com']);
    expect(result.success).toBe(true);
    expect(mockFetch).toHaveBeenCalledWith(
      '/.netlify/functions/admin-save',
      expect.objectContaining({
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer admins-token',
        },
        body: JSON.stringify({
          type: 'admins',
          admins: ['lucasshawn@gmail.com', 'lucascierra24@gmail.com', 'newadmin@gmail.com'],
        }),
      })
    );
  });

  it('saveAdmins throws error when API returns failure status', async () => {
    adminAuth.setSession({
      token: 'admins-token',
      email: 'lucasshawn@gmail.com',
    });

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'Forbidden' }),
    });

    await expect(adminApi.saveAdmins(['lucasshawn@gmail.com'])).rejects.toThrow('Forbidden');
  });

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
        user: 'lucasshawn@gmail.com',
        change: 'Admin Whitelist - Added Admin',
        comment: 'Old: (not authorized) -> New: new@weebles.com',
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

  it('saveCategories throws error when not authenticated', async () => {
    await expect(
      adminApi.saveCategories([{ id: 'animals', label: 'Critters', emoji: '🐰' }])
    ).rejects.toThrow(/not authenticated/i);
  });

  it('saveCategories posts categories and optional products with session Bearer token', async () => {
    adminAuth.setSession({
      token: 'cat-token',
      email: 'lucasshawn@gmail.com',
    });

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, message: 'Categories saved!' }),
    });
    globalThis.fetch = mockFetch;

    const cats = [{ id: 'animals', label: 'Critters', emoji: '🐰' }];
    const result = await adminApi.saveCategories(cats, mockProducts);
    expect(result.success).toBe(true);
    expect(mockFetch).toHaveBeenCalledWith(
      '/.netlify/functions/admin-save',
      expect.objectContaining({
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer cat-token',
        },
        body: JSON.stringify({
          type: 'categories',
          categories: cats,
          products: mockProducts,
        }),
      })
    );
  });

  it('saveCategories throws enriched error with status and endpoint when API returns failure status', async () => {
    adminAuth.setSession({
      token: 'cat-token',
      email: 'lucasshawn@gmail.com',
    });

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: 'Category sync failed' }),
    });

    let caughtError: any;
    try {
      await adminApi.saveCategories([{ id: 'animals', label: 'Critters', emoji: '🐰' }]);
    } catch (err) {
      caughtError = err;
    }

    expect(caughtError).toBeInstanceOf(Error);
    expect(caughtError.message).toBe('Category sync failed');
    expect(caughtError.status).toBe(500);
    expect(caughtError.endpoint).toBe('POST /.netlify/functions/admin-save (type=categories)');
  });
});
