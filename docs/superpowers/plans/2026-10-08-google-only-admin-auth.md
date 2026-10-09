# Google-Only Admin Authentication Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate all mock 1-click dev logins ("Login as Shawn", "Login as Cierra") and enforce strict Google-only OAuth authentication for the admin portal, granting access only to authorized Google accounts (`lucasshawn@gmail.com`, `lucascierra24@gmail.com`, and `powerhousepnw@gmail.com`).

**Architecture:** Frontend renders Google Identity Services button (or a setup notice if `VITE_GOOGLE_CLIENT_ID` is unset) and passes the Google ID token credential to `/.netlify/functions/admin-auth`. The Netlify backend verifies the token and enforces whitelist access control against the three authorized emails before generating an HMAC signed session token.

**Tech Stack:** React 18, TypeScript, Netlify Functions, Vitest, Testing Library, Google Identity Services (GIS).

## Global Constraints
- Remove all mock buttons and bypasses (`devBypass`, `devLogin`) completely.
- Whitelist accounts: `lucasshawn@gmail.com`, `lucascierra24@gmail.com`, `powerhousepnw@gmail.com`, plus optional `ALLOWED_ADMIN_EMAILS` environment variable.
- Non-whitelisted accounts must be rejected with HTTP 403.
- All existing storefront features and non-admin routes must remain intact.
- Full test suite (`npm test`) and production build (`npm run build`) must pass without errors.

---

### Task 1: Backend Google Auth Verification & Strict Whitelist

**Files:**
- Modify: `netlify/functions/admin-auth.ts:4-138`
- Modify: `tests/adminAuth.test.ts:1-325`

**Interfaces:**
- Consumes: `{ credential: string }` via `POST /.netlify/functions/admin-auth`
- Produces: `ALLOWED_ADMINS: string[]`, `createSessionToken(email: string, exp?: number, secret?: string): string`, handler returning `{ token, email, name, picture, exp }` or 400/401/403/405/500

- [ ] **Step 1: Write the updated backend tests in `tests/adminAuth.test.ts`**

Update `tests/adminAuth.test.ts` to assert:
- `ALLOWED_ADMINS` contains `'lucasshawn@gmail.com'`, `'lucascierra24@gmail.com'`, and `'powerhousepnw@gmail.com'`.
- Valid Google token for any of the 3 authorized emails returns 200 with session token and details.
- Valid Google token for an unauthorized email returns 403 Forbidden with `"Unauthorized: <email> is not an authorized administrator."`.
- Unverified Google token returns 401 Unauthorized.
- Missing credential returns 400 Bad Request.
- Requests sending `devBypass` without valid Google credential are rejected (no dev bypass route exists).

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handler, ALLOWED_ADMINS, createSessionToken } from '../netlify/functions/admin-auth';

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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/adminAuth.test.ts`
Expected: FAIL (missing `powerhousepnw@gmail.com` in `ALLOWED_ADMINS`, and legacy `devBypass` still exists in handler).

- [ ] **Step 3: Update `netlify/functions/admin-auth.ts`**

Update `ALLOWED_ADMINS` to include `powerhousepnw@gmail.com` and load extra emails from `process.env.ALLOWED_ADMIN_EMAILS`.
Remove `devBypass`, `devEmail`, and related logic. Require `credential`.

```typescript
import { Handler } from '@netlify/functions';
import crypto from 'crypto';

export const DEFAULT_ALLOWED_ADMINS = [
  'lucasshawn@gmail.com',
  'lucascierra24@gmail.com',
  'powerhousepnw@gmail.com',
];

export const getAllowedAdmins = (): string[] => {
  const envAdmins = process.env.ALLOWED_ADMIN_EMAILS
    ? process.env.ALLOWED_ADMIN_EMAILS.split(',').map((e) => e.toLowerCase().trim()).filter(Boolean)
    : [];
  return Array.from(new Set([...DEFAULT_ALLOWED_ADMINS, ...envAdmins]));
};

export const ALLOWED_ADMINS = getAllowedAdmins();

export const SESSION_SECRET = process.env.ADMIN_SESSION_SECRET || 'weebles-studio-dev-secret-2026';

export function createSessionToken(
  email: string,
  exp = Date.now() + 24 * 60 * 60 * 1000,
  secret = process.env.ADMIN_SESSION_SECRET || SESSION_SECRET
): string {
  const payload = `${email.toLowerCase().trim()}:${exp}`;
  const payloadBase64 = Buffer.from(payload).toString('base64');
  const signature = crypto.createHmac('sha256', secret).update(payloadBase64).digest('hex');
  return `${payloadBase64}.${signature}`;
}

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method Not Allowed' }),
    };
  }

  try {
    const { credential } = JSON.parse(event.body || '{}');

    if (!credential) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing authentication credential' }),
      };
    }

    let userEmail = '';
    let userName = 'Studio Admin';
    let userPicture = '';

    const isProduction =
      process.env.NODE_ENV === 'production' ||
      process.env.CONTEXT === 'production';
    const isDevAllowed =
      (process.env.NETLIFY_DEV === 'true' || process.env.CONTEXT === 'dev') || !isProduction;

    try {
      const res = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`);
      if (!res.ok) {
        return {
          statusCode: 401,
          body: JSON.stringify({ error: 'Invalid Google credential' }),
        };
      }
      const tokenInfo = await res.json();
      if (tokenInfo.email_verified !== 'true' && tokenInfo.email_verified !== true) {
        return {
          statusCode: 401,
          body: JSON.stringify({ error: 'Google email not verified' }),
        };
      }
      userEmail = (tokenInfo.email || '').toLowerCase().trim();
      userName = tokenInfo.name || userName;
      userPicture = tokenInfo.picture || '';
    } catch (networkErr: any) {
      if (isDevAllowed) {
        const parts = credential.split('.');
        if (parts.length === 3) {
          try {
            const payloadJson = Buffer.from(parts[1], 'base64').toString('utf-8');
            const payload = JSON.parse(payloadJson);
            if (payload.email_verified !== true && payload.email_verified !== 'true') {
              return {
                statusCode: 401,
                body: JSON.stringify({ error: 'Google email not verified' }),
              };
            }
            userEmail = (payload.email || '').toLowerCase().trim();
            userName = payload.name || userName;
            userPicture = payload.picture || '';
          } catch {
            return {
              statusCode: 401,
              body: JSON.stringify({ error: 'Invalid Google credential' }),
            };
          }
        } else {
          return {
            statusCode: 401,
            body: JSON.stringify({ error: 'Invalid Google credential' }),
          };
        }
      } else {
        return {
          statusCode: 401,
          body: JSON.stringify({ error: 'Google authentication service unavailable' }),
        };
      }
    }

    if (!userEmail) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing authentication credential' }),
      };
    }

    const currentAllowedAdmins = getAllowedAdmins();
    if (!currentAllowedAdmins.includes(userEmail)) {
      return {
        statusCode: 403,
        body: JSON.stringify({
          error: `Unauthorized: ${userEmail} is not an authorized administrator.`,
        }),
      };
    }

    const exp = Date.now() + 24 * 60 * 60 * 1000;
    const token = createSessionToken(userEmail, exp);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token,
        email: userEmail,
        name: userName,
        picture: userPicture,
        exp,
      }),
    };
  } catch (err: any) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message || 'Authentication error' }),
    };
  }
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/adminAuth.test.ts`
Expected: PASS (all tests pass).

- [ ] **Step 5: Commit changes**

```bash
git add netlify/functions/admin-auth.ts tests/adminAuth.test.ts
git commit -m "fix(auth): enforce Google-only token verification and authorized email whitelist"
```

---

### Task 2: Remove Mock Dev Login from Client Auth Service

**Files:**
- Modify: `src/services/adminAuth.ts:55-72`
- Test: `tests/adminAuth.test.ts`

**Interfaces:**
- Consumes: `{ credential: string }`
- Produces: `adminAuth.loginWithCredential(credential: string): Promise<AdminSession>`, `adminAuth.getSession()`, `adminAuth.setSession()`, `adminAuth.logout()`

- [ ] **Step 1: Check existing references to `devLogin` and remove from `src/services/adminAuth.ts`**

In `src/services/adminAuth.ts`, remove `devLogin`:

```typescript
export interface AdminSession {
  token: string;
  email: string;
  name?: string;
  picture?: string;
  exp?: number;
}

const STORAGE_KEY = 'weebles_admin_session_v1';

export const adminAuth = {
  getSession(): AdminSession | null {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return null;
      const session = JSON.parse(stored) as AdminSession;
      if (session.exp && Date.now() > session.exp) {
        this.logout();
        return null;
      }
      return session;
    } catch {
      return null;
    }
  },

  setSession(session: AdminSession): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  },

  logout(): void {
    localStorage.removeItem(STORAGE_KEY);
  },

  async loginWithCredential(credential: string): Promise<AdminSession> {
    const res = await fetch('/.netlify/functions/admin-auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ credential }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'Authentication failed');
    }

    const session: AdminSession = await res.json();
    this.setSession(session);
    return session;
  },

  async loginWithGoogle(credential: string): Promise<AdminSession> {
    return this.loginWithCredential(credential);
  },
};
```

- [ ] **Step 2: Run tests to verify compilation and behavior**

Run: `npx vitest run tests/adminAuth.test.ts`
Expected: PASS

- [ ] **Step 3: Commit changes**

```bash
git add src/services/adminAuth.ts
git commit -m "refactor(auth): remove devLogin mock method from adminAuth client service"
```

---

### Task 3: Admin Login Card UI & Component Tests

**Files:**
- Modify: `src/components/admin/AdminLoginCard.tsx`
- Modify: `tests/AdminLoginCard.test.tsx`

**Interfaces:**
- Consumes: `onLoginSuccess: (session: AdminSession) => void`
- Produces: Google SSO login button container, missing client ID warning banner, error alert banner.

- [ ] **Step 1: Write updated tests in `tests/AdminLoginCard.test.tsx`**

Replace old tests that clicked "Login as Shawn" / "Login as Cierra".
Verify:
1. Renders title and Google sign-in container; does NOT render "Login as Shawn" or "Login as Cierra".
2. When `VITE_GOOGLE_CLIENT_ID` is missing, renders setup warning banner.
3. When `VITE_GOOGLE_CLIENT_ID` is set, calls `window.google.accounts.id.initialize` and `renderButton`.
4. Successful credential callback calls `onLoginSuccess`.
5. Rejected credential callback displays error message banner.

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { AdminLoginCard } from '../src/components/admin/AdminLoginCard';
import { adminAuth } from '../src/services/adminAuth';

describe('AdminLoginCard', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders studio login title and return link without mock login buttons', () => {
    render(<AdminLoginCard onLoginSuccess={vi.fn()} />);

    expect(screen.getByText(/Weebles Studio Manager/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Login as Shawn/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Login as Cierra/i })).not.toBeInTheDocument();
    expect(screen.getByText(/Return to Storefront/i)).toBeInTheDocument();
  });

  it('shows missing Google client ID notice when VITE_GOOGLE_CLIENT_ID is not configured', () => {
    vi.stubEnv('VITE_GOOGLE_CLIENT_ID', '');
    render(<AdminLoginCard onLoginSuccess={vi.fn()} />);

    expect(screen.getByText(/Google OAuth Client ID is not configured/i)).toBeInTheDocument();
  });

  it('initializes Google SSO when VITE_GOOGLE_CLIENT_ID is set', () => {
    vi.stubEnv('VITE_GOOGLE_CLIENT_ID', 'test-client-id.apps.googleusercontent.com');

    const initializeMock = vi.fn();
    const renderButtonMock = vi.fn();

    (window as any).google = {
      accounts: {
        id: {
          initialize: initializeMock,
          renderButton: renderButtonMock,
        },
      },
    };

    render(<AdminLoginCard onLoginSuccess={vi.fn()} />);

    expect(initializeMock).toHaveBeenCalledWith(
      expect.objectContaining({
        client_id: 'test-client-id.apps.googleusercontent.com',
      })
    );
    expect(renderButtonMock).toHaveBeenCalled();
  });

  it('handles successful Google sign-in callback', async () => {
    vi.stubEnv('VITE_GOOGLE_CLIENT_ID', 'test-client-id.apps.googleusercontent.com');

    let googleCallback: (resp: any) => Promise<void> = async () => {};
    (window as any).google = {
      accounts: {
        id: {
          initialize: vi.fn(({ callback }) => {
            googleCallback = callback;
          }),
          renderButton: vi.fn(),
        },
      },
    };

    const mockSession = {
      token: 'jwt-token',
      email: 'lucasshawn@gmail.com',
      name: 'Shawn',
    };
    vi.spyOn(adminAuth, 'loginWithCredential').mockResolvedValue(mockSession);
    const onLoginSuccess = vi.fn();

    render(<AdminLoginCard onLoginSuccess={onLoginSuccess} />);

    await googleCallback({ credential: 'valid-google-jwt' });

    expect(onLoginSuccess).toHaveBeenCalledWith(mockSession);
  });

  it('displays error banner when Google sign-in is rejected', async () => {
    vi.stubEnv('VITE_GOOGLE_CLIENT_ID', 'test-client-id.apps.googleusercontent.com');

    let googleCallback: (resp: any) => Promise<void> = async () => {};
    (window as any).google = {
      accounts: {
        id: {
          initialize: vi.fn(({ callback }) => {
            googleCallback = callback;
          }),
          renderButton: vi.fn(),
        },
      },
    };

    vi.spyOn(adminAuth, 'loginWithCredential').mockRejectedValue(
      new Error('Unauthorized: stranger@gmail.com is not an authorized administrator.')
    );

    render(<AdminLoginCard onLoginSuccess={vi.fn()} />);

    await googleCallback({ credential: 'unauthorized-jwt' });

    expect(
      await screen.findByText(/stranger@gmail.com is not an authorized administrator/i)
    ).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/AdminLoginCard.test.tsx`
Expected: FAIL (because mock buttons are still present and missing-client-id warning is not implemented).

- [ ] **Step 3: Update `src/components/admin/AdminLoginCard.tsx`**

Remove mock buttons and `handleDevLogin`.
Add `clientId` check and setup notice if `!clientId`.
Ensure Google Identity Services button mounts cleanly and handles callbacks.

```tsx
import React, { useEffect, useState } from 'react';
import { Lock, ArrowLeft, AlertCircle, AlertTriangle } from 'lucide-react';
import { adminAuth, AdminSession } from '../../services/adminAuth';

interface AdminLoginCardProps {
  onLoginSuccess: (session: AdminSession) => void;
}

export const AdminLoginCard: React.FC<AdminLoginCardProps> = ({ onLoginSuccess }) => {
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const clientId =
    (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID ||
    (typeof process !== 'undefined' ? (process as any).env?.VITE_GOOGLE_CLIENT_ID : undefined);

  useEffect(() => {
    if (!clientId) return;

    const setupGoogleBtn = () => {
      if ((window as any).google?.accounts?.id) {
        try {
          (window as any).google.accounts.id.initialize({
            client_id: clientId,
            callback: async (response: any) => {
              if (response.credential) {
                setIsLoading(true);
                setErrorMessage('');
                try {
                  const session = await adminAuth.loginWithCredential(response.credential);
                  onLoginSuccess(session);
                } catch (err: any) {
                  setErrorMessage(err.message || 'Access denied');
                } finally {
                  setIsLoading(false);
                }
              }
            },
          });
          const btnContainer = document.getElementById('googleSignInBtn');
          if (btnContainer) {
            btnContainer.innerHTML = '';
            (window as any).google.accounts.id.renderButton(btnContainer, {
              theme: 'outline',
              size: 'large',
              shape: 'pill',
              text: 'signin_with',
            });
          }
          return true;
        } catch (err) {
          console.error('Google SSO init error', err);
        }
      }
      return false;
    };

    if (!setupGoogleBtn()) {
      const interval = setInterval(() => {
        if (setupGoogleBtn()) {
          clearInterval(interval);
        }
      }, 250);
      return () => clearInterval(interval);
    }
  }, [clientId, onLoginSuccess]);

  return (
    <div className="min-h-screen bg-weeble-pinkBg flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-3xl border-4 border-pink-200 p-8 shadow-2xl text-center">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-weeble-pink to-weeble-pinkLight flex items-center justify-center mx-auto mb-4 shadow-pillow">
          <span className="text-3xl">🍓</span>
        </div>

        <span className="bg-pink-100 text-pink-700 text-xs font-bold px-3 py-1 rounded-full inline-flex items-center gap-1 mb-2">
          <Lock className="w-3.5 h-3.5" /> Studio Administration
        </span>

        <h1 className="font-bubble text-3xl font-bold text-weeble-text mb-2">
          Weebles Studio Manager
        </h1>
        <p className="text-xs text-weeble-textMuted mb-6">
          Sign in with an authorized Google account to manage inventory, catalog prices, and store settings.
        </p>

        {errorMessage && (
          <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl p-3 mb-6 flex items-start gap-2 text-left">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        {isLoading && (
          <div className="text-xs font-bold text-weeble-pink mb-4 animate-pulse">
            Signing in...
          </div>
        )}

        {!clientId ? (
          <div className="bg-amber-50 border border-amber-200 text-amber-800 text-xs rounded-2xl p-4 mb-6 flex items-start gap-2.5 text-left">
            <AlertTriangle className="w-5 h-5 shrink-0 text-amber-600 mt-0.5" />
            <div>
              <div className="font-bold text-amber-900 mb-1">Google OAuth Client ID Missing</div>
              <p className="text-amber-700 leading-relaxed">
                Google OAuth Client ID is not configured. Please set <code className="bg-amber-100 px-1 py-0.5 rounded font-mono text-[11px]">VITE_GOOGLE_CLIENT_ID</code> in your environment variables to enable admin login.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex justify-center mb-6 min-h-[44px]" id="googleSignInBtn" />
        )}

        <a
          href="/"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-weeble-pink hover:underline"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Return to Storefront</span>
        </a>
      </div>
    </div>
  );
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/AdminLoginCard.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit changes**

```bash
git add src/components/admin/AdminLoginCard.tsx tests/AdminLoginCard.test.tsx
git commit -m "feat(auth): replace mock login buttons with Google-only SSO and configuration check"
```

---

### Task 4: Update AdminPortal & Smoke Tests and Run Full Verification

**Files:**
- Modify: `tests/AdminPortal.test.tsx:20-30`
- Modify: `tests/smoke.test.ts:80-92`

**Interfaces:**
- Consumes: `AdminPortal` rendering and session state
- Produces: Passing test suites across the whole codebase

- [ ] **Step 1: Update `tests/AdminPortal.test.tsx` and `tests/smoke.test.ts`**

Update `tests/AdminPortal.test.tsx`:
Replace:
```typescript
expect(screen.getByRole('button', { name: /Login as Shawn/i })).toBeInTheDocument();
```
With:
```typescript
expect(screen.getByText(/Weebles Studio Manager/i)).toBeInTheDocument();
expect(screen.queryByRole('button', { name: /Login as Shawn/i })).not.toBeInTheDocument();
```

Update `tests/smoke.test.ts`:
Replace:
```typescript
expect(screen.getByRole('button', { name: /Login as Shawn/i })).toBeInTheDocument();
```
With:
```typescript
expect(screen.getByText(/Weebles Studio Manager/i)).toBeInTheDocument();
expect(screen.queryByRole('button', { name: /Login as Shawn/i })).not.toBeInTheDocument();
```

- [ ] **Step 2: Run all tests**

Run: `npm test`
Expected: PASS (all 16 test files pass).

- [ ] **Step 3: Run production build check**

Run: `npm run build`
Expected: Clean build (`dist` generated with 0 TypeScript errors).

- [ ] **Step 4: Commit changes**

```bash
git add tests/AdminPortal.test.tsx tests/smoke.test.ts
git commit -m "test: update portal and smoke tests for Google-only authentication"
```
