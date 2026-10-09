import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handler, ALLOWED_ADMINS, createSessionToken } from '../netlify/functions/admin-auth';
import { adminAuth } from '../src/services/adminAuth';

function makeJwt(payload: Record<string, any>): string {
  const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64');
  return `${header}.${body}.signature`;
}

describe('admin-auth Netlify Function', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('exports the authorized admin whitelist containing Shawn, Cierra, and powerhousepnw', () => {
    expect(ALLOWED_ADMINS).toContain('lucasshawn@gmail.com');
    expect(ALLOWED_ADMINS).toContain('lucascierra24@gmail.com');
    expect(ALLOWED_ADMINS).toContain('powerhousepnw@gmail.com');
    expect(createSessionToken).toBeDefined();
  });

  it('authorizes valid Google token for lucasshawn@gmail.com', async () => {
    const cred = makeJwt({
      email: 'lucasshawn@gmail.com',
      name: 'Shawn Lucas',
      picture: 'https://example.com/shawn.jpg',
      email_verified: true,
    });

    const event = {
      httpMethod: 'POST',
      body: JSON.stringify({ credential: cred }),
    };

    const res = await handler(event as any, {} as any) as any;
    expect(res.statusCode).toBe(200);
    const data = JSON.parse(res.body);
    expect(data.token).toBeDefined();
    expect(data.email).toBe('lucasshawn@gmail.com');
    expect(data.name).toBe('Shawn Lucas');
  });

  it('authorizes valid Google token for powerhousepnw@gmail.com', async () => {
    const cred = makeJwt({
      email: 'powerhousepnw@gmail.com',
      name: 'Powerhouse Admin',
      picture: 'https://example.com/powerhouse.jpg',
      email_verified: true,
    });

    const event = {
      httpMethod: 'POST',
      body: JSON.stringify({ credential: cred }),
    };

    const res = await handler(event as any, {} as any) as any;
    expect(res.statusCode).toBe(200);
    const data = JSON.parse(res.body);
    expect(data.email).toBe('powerhousepnw@gmail.com');
  });

  it('rejects unauthorized Google email with 403 Forbidden', async () => {
    const cred = makeJwt({
      email: 'randomuser@gmail.com',
      name: 'Stranger',
      email_verified: true,
    });

    const event = {
      httpMethod: 'POST',
      body: JSON.stringify({ credential: cred }),
    };

    const res = await handler(event as any, {} as any) as any;
    expect(res.statusCode).toBe(403);
    const data = JSON.parse(res.body);
    expect(data.error).toMatch(/unauthorized: randomuser@gmail\.com is not an authorized administrator/i);
  });

  it('rejects unverified Google email with 401 Unauthorized', async () => {
    const cred = makeJwt({
      email: 'lucasshawn@gmail.com',
      name: 'Shawn Lucas',
      email_verified: false,
    });

    // Mock Google tokeninfo API return
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        email: 'lucasshawn@gmail.com',
        email_verified: false,
      }),
    } as any);

    const event = {
      httpMethod: 'POST',
      body: JSON.stringify({ credential: cred }),
    };

    const res = await handler(event as any, {} as any) as any;
    expect(res.statusCode).toBe(401);
    expect(JSON.parse(res.body).error).toMatch(/email not verified/i);
  });

  it('rejects requests with missing credential with 400 Bad Request', async () => {
    const event = {
      httpMethod: 'POST',
      body: JSON.stringify({}),
    };

    const res = await handler(event as any, {} as any) as any;
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).error).toMatch(/missing authentication credential/i);
  });

  it('rejects legacy devBypass payload without credential with 400 Bad Request', async () => {
    const event = {
      httpMethod: 'POST',
      body: JSON.stringify({ email: 'lucasshawn@gmail.com', devBypass: true }),
    };

    const res = await handler(event as any, {} as any) as any;
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).error).toMatch(/missing authentication credential/i);
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

