import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handler, ALLOWED_ADMINS } from '../netlify/functions/admin-auth';
import { adminAuth } from '../src/services/adminAuth';

describe('admin-auth Netlify Function', () => {
  it('defines the authorized admin whitelist', () => {
    expect(ALLOWED_ADMINS).toContain('lucasshawn@gmail.com');
    expect(ALLOWED_ADMINS).toContain('lucascierra24@gmail.com');
    expect(ALLOWED_ADMINS.length).toBe(2);
  });

  it('rejects unauthorized email with 403 Forbidden', async () => {
    const event = {
      httpMethod: 'POST',
      body: JSON.stringify({ email: 'intruder@gmail.com', devBypass: true }),
    };

    const res = await handler(event as any, {} as any) as any;
    expect(res.statusCode).toBe(403);
    expect(JSON.parse(res.body).error).toMatch(/unauthorized/i);
  });

  it('authorizes whitelisted email and returns session token', async () => {
    const event = {
      httpMethod: 'POST',
      body: JSON.stringify({ email: 'lucasshawn@gmail.com', devBypass: true }),
    };

    const res = await handler(event as any, {} as any) as any;
    expect(res.statusCode).toBe(200);
    const data = JSON.parse(res.body);
    expect(data.token).toBeDefined();
    expect(data.email).toBe('lucasshawn@gmail.com');
  });

  it('authorizes Cierra whitelisted email and returns session token', async () => {
    const event = {
      httpMethod: 'POST',
      body: JSON.stringify({ email: 'lucascierra24@gmail.com', devBypass: true }),
    };

    const res = await handler(event as any, {} as any) as any;
    expect(res.statusCode).toBe(200);
    const data = JSON.parse(res.body);
    expect(data.token).toBeDefined();
    expect(data.email).toBe('lucascierra24@gmail.com');
  });

  it('rejects non-POST HTTP methods with 405 Method Not Allowed', async () => {
    const event = {
      httpMethod: 'GET',
    };

    const res = await handler(event as any, {} as any) as any;
    expect(res.statusCode).toBe(405);
    expect(JSON.parse(res.body).error).toBe('Method Not Allowed');
  });

  it('rejects request with missing credentials with 400', async () => {
    const event = {
      httpMethod: 'POST',
      body: JSON.stringify({}),
    };

    const res = await handler(event as any, {} as any) as any;
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).error).toMatch(/missing authentication credential/i);
  });

  it('decodes Google JWT credential and authenticates whitelisted user', async () => {
    const payload = {
      email: 'LUCASSHAWN@GMAIL.COM',
      name: 'Shawn Lucas',
      picture: 'https://example.com/shawn.jpg',
    };
    const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64');
    const dummyJwt = `header.${encodedPayload}.signature`;

    const event = {
      httpMethod: 'POST',
      body: JSON.stringify({ credential: dummyJwt }),
    };

    const res = await handler(event as any, {} as any) as any;
    expect(res.statusCode).toBe(200);
    const data = JSON.parse(res.body);
    expect(data.token).toBeDefined();
    expect(data.email).toBe('lucasshawn@gmail.com');
    expect(data.name).toBe('Shawn Lucas');
    expect(data.picture).toBe('https://example.com/shawn.jpg');
    expect(data.exp).toBeGreaterThan(Date.now());
  });

  it('rejects non-whitelisted email from Google JWT credential with 403', async () => {
    const payload = {
      email: 'random@gmail.com',
      name: 'Random User',
    };
    const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64');
    const dummyJwt = `header.${encodedPayload}.signature`;

    const event = {
      httpMethod: 'POST',
      body: JSON.stringify({ credential: dummyJwt }),
    };

    const res = await handler(event as any, {} as any) as any;
    expect(res.statusCode).toBe(403);
    expect(JSON.parse(res.body).error).toMatch(/unauthorized/i);
  });
});

describe('adminAuth client service', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('manages local admin session persistence', () => {
    expect(adminAuth.getSession()).toBeNull();
    adminAuth.setSession({ token: 'test-token', email: 'lucasshawn@gmail.com', name: 'Shawn' });
    expect(adminAuth.getSession()?.email).toBe('lucasshawn@gmail.com');
    adminAuth.logout();
    expect(adminAuth.getSession()).toBeNull();
  });

  it('clears expired sessions automatically', () => {
    const expiredSession = {
      token: 'old-token',
      email: 'lucasshawn@gmail.com',
      exp: Date.now() - 1000,
    };
    adminAuth.setSession(expiredSession);
    expect(adminAuth.getSession()).toBeNull();
  });

  it('handles malformed localStorage data gracefully', () => {
    localStorage.setItem('weebles_admin_session_v1', 'invalid-json{');
    expect(adminAuth.getSession()).toBeNull();
  });

  it('performs devLogin and sets session on success', async () => {
    const mockSession = {
      token: 'mock-dev-token',
      email: 'lucasshawn@gmail.com',
      name: 'Studio Admin',
      exp: Date.now() + 86400000,
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockSession,
    } as any);

    const session = await adminAuth.devLogin('lucasshawn@gmail.com');
    expect(session.email).toBe('lucasshawn@gmail.com');
    expect(adminAuth.getSession()?.token).toBe('mock-dev-token');
    expect(globalThis.fetch).toHaveBeenCalledWith(
      '/.netlify/functions/admin-auth',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ email: 'lucasshawn@gmail.com', devBypass: true }),
      })
    );
  });

  it('throws error when devLogin fails', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'Unauthorized: stranger@gmail.com' }),
    } as any);

    await expect(adminAuth.devLogin('stranger@gmail.com')).rejects.toThrow('Unauthorized: stranger@gmail.com');
  });

  it('performs loginWithCredential and sets session on success', async () => {
    const mockSession = {
      token: 'mock-google-token',
      email: 'lucascierra24@gmail.com',
      name: 'Cierra',
      exp: Date.now() + 86400000,
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockSession,
    } as any);

    const session = await adminAuth.loginWithCredential('google-jwt-token');
    expect(session.email).toBe('lucascierra24@gmail.com');
    expect(adminAuth.getSession()?.token).toBe('mock-google-token');
    expect(globalThis.fetch).toHaveBeenCalledWith(
      '/.netlify/functions/admin-auth',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ credential: 'google-jwt-token' }),
      })
    );
  });

  it('throws error when loginWithCredential fails', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'Missing authentication credential' }),
    } as any);

    await expect(adminAuth.loginWithCredential('')).rejects.toThrow('Missing authentication credential');
  });

  it('provides loginWithGoogle as an alias for loginWithCredential', async () => {
    const mockSession = {
      token: 'mock-google-token-2',
      email: 'lucasshawn@gmail.com',
      name: 'Shawn',
      exp: Date.now() + 86400000,
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockSession,
    } as any);

    const session = await adminAuth.loginWithGoogle('google-jwt-test');
    expect(session.email).toBe('lucasshawn@gmail.com');
    expect(adminAuth.getSession()?.token).toBe('mock-google-token-2');
  });
});
