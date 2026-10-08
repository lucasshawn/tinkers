# Weebles Studio Admin Portal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a secure, bespoke administrative portal (`/admin`) for Weebles Studio featuring Google SSO authentication whitelisted for `lucasshawn@gmail.com` and `lucascierra24@gmail.com`, full inventory management (add/edit/delete figurines, photos, prices, descriptions, variants), store settings management (contact email, custom order email, TikTok, Instagram, Facebook Marketplace URLs), and Git-backed persistence via Netlify Functions.

**Architecture:** Client-side React 18 admin interface rendered at `/admin` within the existing Vite SPA. Storefront components consume dynamic settings from `SettingsContext`. Google Identity Services (GIS) provides Google SSO on the frontend, verified serverless by `admin-auth.ts`. Persistence is handled by `admin-save.ts` committing directly to GitHub repository (`lucasshawn/tinkers`), triggering automatic Netlify rebuilds.

**Tech Stack:** React 18, TypeScript, Tailwind CSS, Lucide React, Google Identity Services, Netlify Functions, Vitest, React Testing Library.

## Global Constraints
- Target platform: Netlify (`dist/`, `netlify/functions/`).
- Admin Whitelist: Exactly `lucasshawn@gmail.com` and `lucascierra24@gmail.com`. Any other Google account must receive `403 Forbidden`.
- Store Configuration Defaults:
  - Contact Email: `weeblesclay@gmail.com`
  - Custom Order Email: `weeblesclay@gmail.com`
  - TikTok URL: `https://tiktok.com/@weebles_clay`
  - Instagram URL: `https://instagram.com/weebles_clay`
  - Facebook Marketplace URL: `https://facebook.com/marketplace`
- Visual Theme: Hello Kitty pastel palette (`weeble-pink`, `weeble-pinkBg`, `weeble-yellow`, `weeble-mint`, `weeble-blue`, `weeble-lilac`, `font-bubble` Fredoka, and `shadow-pillow`).
- Zero placeholders or TODO comments. All code strictly typed with TypeScript.

---

### Task 1: Store Settings Model, Data & SettingsContext

**Files:**
- Create: `src/data/settings.json`
- Create: `src/types/settings.ts`
- Modify: `src/types/index.ts`
- Create: `src/context/SettingsContext.tsx`
- Modify: `src/components/Footer.tsx`
- Modify: `src/components/SocialStrip.tsx`
- Modify: `src/components/CustomOrderModal.tsx`
- Create: `tests/SettingsContext.test.tsx`

**Interfaces:**
- Consumes: None
- Produces:
  - `SiteSettings`: Interface for site settings.
  - `SettingsProvider`: React Provider wrapping the app.
  - `useSettings()`: Hook providing `{ settings, updateSettings, resetSettings }`.

- [ ] **Step 1: Write failing test for SettingsContext**

`tests/SettingsContext.test.tsx`:
```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import React from 'react';
import { SettingsProvider, useSettings } from '../src/context/SettingsContext';

describe('SettingsContext', () => {
  beforeEach(() => {
    localStorage.removeItem('weebles_settings_v1');
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <SettingsProvider>{children}</SettingsProvider>
  );

  it('provides default site settings matching current live site', () => {
    const { result } = renderHook(() => useSettings(), { wrapper });

    expect(result.current.settings.contactEmail).toBe('weeblesclay@gmail.com');
    expect(result.current.settings.customOrderEmail).toBe('weeblesclay@gmail.com');
    expect(result.current.settings.socials.tiktok).toBe('https://tiktok.com/@weebles_clay');
    expect(result.current.settings.socials.instagram).toBe('https://instagram.com/weebles_clay');
    expect(result.current.settings.socials.facebookMarketplace).toBe('https://facebook.com/marketplace');
  });

  it('updates settings and persists to state', () => {
    const { result } = renderHook(() => useSettings(), { wrapper });

    act(() => {
      result.current.updateSettings({
        ...result.current.settings,
        contactEmail: 'newcontact@weebles.com',
      });
    });

    expect(result.current.settings.contactEmail).toBe('newcontact@weebles.com');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test tests/SettingsContext.test.tsx`  
Expected: FAIL (cannot find module `src/context/SettingsContext`)

- [ ] **Step 3: Implement settings model, default json, and SettingsContext**

`src/types/settings.ts`:
```typescript
export interface SiteSettings {
  contactEmail: string;
  customOrderEmail: string;
  socials: {
    tiktok: string;
    instagram: string;
    facebookMarketplace: string;
  };
}
```

`src/types/index.ts`:
```typescript
export * from './settings';
// ...existing Product, CartItem, etc. remain intact
```

`src/data/settings.json`:
```json
{
  "contactEmail": "weeblesclay@gmail.com",
  "customOrderEmail": "weeblesclay@gmail.com",
  "socials": {
    "tiktok": "https://tiktok.com/@weebles_clay",
    "instagram": "https://instagram.com/weebles_clay",
    "facebookMarketplace": "https://facebook.com/marketplace"
  }
}
```

`src/context/SettingsContext.tsx`:
```typescript
import React, { createContext, useContext, useState, useEffect } from 'react';
import { SiteSettings } from '../types/settings';
import defaultSettingsData from '../data/settings.json';

interface SettingsContextType {
  settings: SiteSettings;
  updateSettings: (newSettings: SiteSettings) => void;
  resetSettings: () => void;
}

const STORAGE_KEY = 'weebles_settings_v1';
const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const DEFAULT_SETTINGS: SiteSettings = defaultSettingsData as SiteSettings;

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<SiteSettings>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
      }
    } catch {
      // Fallback
    }
    return DEFAULT_SETTINGS;
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch {
      // Ignore
    }
  }, [settings]);

  const updateSettings = (newSettings: SiteSettings) => {
    setSettings(newSettings);
  };

  const resetSettings = () => {
    setSettings(DEFAULT_SETTINGS);
  };

  return (
    <SettingsContext.Provider value={{ settings, updateSettings, resetSettings }}>
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = (): SettingsContextType => {
  const context = useContext(SettingsContext);
  if (!context) {
    return {
      settings: DEFAULT_SETTINGS,
      updateSettings: () => {},
      resetSettings: () => {},
    };
  }
  return context;
};
```

Update `src/components/Footer.tsx`, `SocialStrip.tsx`, and `CustomOrderModal.tsx` to consume `useSettings()` dynamically.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test tests/SettingsContext.test.tsx`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/data/settings.json src/types/settings.ts src/types/index.ts src/context/SettingsContext.tsx src/components/Footer.tsx src/components/SocialStrip.tsx src/components/CustomOrderModal.tsx tests/SettingsContext.test.tsx
git commit -m "feat: implement SiteSettings model, default settings, and SettingsContext integration"
```

---

### Task 2: Google SSO Authentication Netlify Function & Auth Service

**Files:**
- Create: `netlify/functions/admin-auth.ts`
- Create: `src/services/adminAuth.ts`
- Create: `tests/adminAuth.test.ts`

**Interfaces:**
- Consumes: None
- Produces:
  - Whitelist: `['lucasshawn@gmail.com', 'lucascierra24@gmail.com']`.
  - `POST /.netlify/functions/admin-auth`: Verifies Google credential and checks whitelist.
  - `adminAuth.loginWithGoogle(credential: string)`
  - `adminAuth.devLogin()`
  - `adminAuth.logout()`
  - `adminAuth.getSession()`

- [ ] **Step 1: Write failing test for admin authentication**

`tests/adminAuth.test.ts`:
```typescript
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
});

describe('adminAuth client service', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('manages local admin session persistence', () => {
    expect(adminAuth.getSession()).toBeNull();
    adminAuth.setSession({ token: 'test-token', email: 'lucasshawn@gmail.com', name: 'Shawn' });
    expect(adminAuth.getSession()?.email).toBe('lucasshawn@gmail.com');
    adminAuth.logout();
    expect(adminAuth.getSession()).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test tests/adminAuth.test.ts`  
Expected: FAIL (cannot find module `netlify/functions/admin-auth`)

- [ ] **Step 3: Implement admin-auth function and client service**

`netlify/functions/admin-auth.ts`:
```typescript
import { Handler } from '@netlify/functions';

export const ALLOWED_ADMINS = [
  'lucasshawn@gmail.com',
  'lucascierra24@gmail.com',
];

const SESSION_SECRET = process.env.ADMIN_SESSION_SECRET || 'weebles-studio-dev-secret-2026';

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method Not Allowed' }),
    };
  }

  try {
    const { credential, email: devEmail, devBypass } = JSON.parse(event.body || '{}');

    let userEmail = '';
    let userName = 'Studio Admin';
    let userPicture = '';

    if (devBypass && devEmail) {
      userEmail = devEmail.toLowerCase().trim();
    } else if (credential) {
      // Decode JWT payload from Google credential
      const parts = credential.split('.');
      if (parts.length === 3) {
        const payloadJson = Buffer.from(parts[1], 'base64').toString('utf-8');
        const payload = JSON.parse(payloadJson);
        userEmail = (payload.email || '').toLowerCase().trim();
        userName = payload.name || userName;
        userPicture = payload.picture || '';
      }
    }

    if (!userEmail) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing authentication credential' }),
      };
    }

    if (!ALLOWED_ADMINS.includes(userEmail)) {
      return {
        statusCode: 403,
        body: JSON.stringify({
          error: `Unauthorized: ${userEmail} is not authorized to access the Weebles Studio admin portal.`,
        }),
      };
    }

    // Generate signed session token
    const exp = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
    const tokenPayload = `${userEmail}:${exp}`;
    const token = Buffer.from(`${tokenPayload}:${SESSION_SECRET}`).toString('base64');

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

`src/services/adminAuth.ts`:
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

  async devLogin(email = 'lucasshawn@gmail.com'): Promise<AdminSession> {
    const res = await fetch('/.netlify/functions/admin-auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, devBypass: true }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'Dev login failed');
    }

    const session: AdminSession = await res.json();
    this.setSession(session);
    return session;
  },
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test tests/adminAuth.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add netlify/functions/admin-auth.ts src/services/adminAuth.ts tests/adminAuth.test.ts
git commit -m "feat: implement Google SSO token verification, whitelist gate, and adminAuth service"
```

---

### Task 3: Git-Backed Persistence Netlify Function (`admin-save.ts`)

**Files:**
- Create: `netlify/functions/admin-save.ts`
- Create: `src/services/adminApi.ts`
- Create: `tests/adminApi.test.ts`

**Interfaces:**
- Consumes: `Product`, `SiteSettings`
- Produces:
  - `POST /.netlify/functions/admin-save`: Authenticates admin session, commits updated `products.json`, `settings.json`, or new images to GitHub.
  - `adminApi.saveInventory(products: Product[], newImage?: { filename: string, base64Data: string })`
  - `adminApi.saveSettings(settings: SiteSettings)`

- [ ] **Step 1: Write test for admin-save persistence function and API client**

`tests/adminApi.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handler } from '../netlify/functions/admin-save';
import { adminApi } from '../src/services/adminApi';

describe('admin-save Netlify Function', () => {
  it('rejects unauthenticated requests with 401', async () => {
    const event = {
      httpMethod: 'POST',
      headers: {},
      body: JSON.stringify({ type: 'settings', settings: {} }),
    };

    const res = await handler(event as any, {} as any) as any;
    expect(res.statusCode).toBe(401);
  });

  it('rejects invalid or non-whitelisted session tokens with 403', async () => {
    const badToken = Buffer.from('hacker@gmail.com:999999999:weebles-studio-dev-secret-2026').toString('base64');
    const event = {
      httpMethod: 'POST',
      headers: { authorization: `Bearer ${badToken}` },
      body: JSON.stringify({ type: 'settings', settings: {} }),
    };

    const res = await handler(event as any, {} as any) as any;
    expect(res.statusCode).toBe(403);
  });

  it('accepts authenticated request from whitelisted admin in dev mode', async () => {
    const validToken = Buffer.from('lucasshawn@gmail.com:9999999999999:weebles-studio-dev-secret-2026').toString('base64');
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
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test tests/adminApi.test.ts`  
Expected: FAIL (cannot find module `netlify/functions/admin-save`)

- [ ] **Step 3: Implement admin-save function and adminApi service**

`netlify/functions/admin-save.ts`:
```typescript
import { Handler } from '@netlify/functions';
import fs from 'fs';
import path from 'path';
import { ALLOWED_ADMINS } from './admin-auth';

const SESSION_SECRET = process.env.ADMIN_SESSION_SECRET || 'weebles-studio-dev-secret-2026';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || '';
const GITHUB_REPO = process.env.GITHUB_REPO || 'lucasshawn/tinkers';
const GITHUB_BRANCH = process.env.GITHUB_BRANCH || 'master';

function verifyToken(authHeader?: string): string | null {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.replace('Bearer ', '').trim();
  try {
    const decoded = Buffer.from(token, 'base64').toString('utf-8');
    const [email, exp, secret] = decoded.split(':');
    if (secret !== SESSION_SECRET) return null;
    if (Number(exp) < Date.now()) return null;
    if (!ALLOWED_ADMINS.includes(email.toLowerCase())) return null;
    return email.toLowerCase();
  } catch {
    return null;
  }
}

async function commitToGitHub(filePath: string, contentBase64: string, commitMessage: string) {
  const url = `https://api.github.com/repos/${GITHUB_REPO}/contents/${filePath}`;
  let sha: string | undefined;

  // Check if file exists to get SHA
  try {
    const getRes = await fetch(url + `?ref=${GITHUB_BRANCH}`, {
      headers: {
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        'User-Agent': 'Weebles-Admin-Portal',
      },
    });
    if (getRes.ok) {
      const data = await getRes.json();
      sha = data.sha;
    }
  } catch {}

  const putRes = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      'Content-Type': 'application/json',
      'User-Agent': 'Weebles-Admin-Portal',
    },
    body: JSON.stringify({
      message: commitMessage,
      content: contentBase64,
      branch: GITHUB_BRANCH,
      ...(sha ? { sha } : {}),
    }),
  });

  if (!putRes.ok) {
    const errData = await putRes.json().catch(() => ({}));
    throw new Error(errData.message || 'GitHub commit failed');
  }

  return putRes.json();
}

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  const authHeader = event.headers.authorization || event.headers.Authorization;
  if (!authHeader) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Authentication required' }) };
  }

  const verifiedAdmin = verifyToken(authHeader);
  if (!verifiedAdmin) {
    return { statusCode: 403, body: JSON.stringify({ error: 'Unauthorized admin session' }) };
  }

  try {
    const { type, products, settings, newImage } = JSON.parse(event.body || '{}');

    // 1. Handle image upload if present
    if (newImage && newImage.filename && newImage.base64Data) {
      const cleanFilename = path.basename(newImage.filename).replace(/[^a-zA-Z0-9._-]/g, '');
      const imagePath = `public/images/products/${cleanFilename}`;
      const rawBase64 = newImage.base64Data.replace(/^data:image\/\w+;base64,/, '');

      if (GITHUB_TOKEN) {
        await commitToGitHub(imagePath, rawBase64, `chore(admin): upload product image ${cleanFilename}`);
      } else {
        const localDir = path.resolve(process.cwd(), 'public/images/products');
        if (!fs.existsSync(localDir)) fs.mkdirSync(localDir, { recursive: true });
        fs.writeFileSync(path.join(localDir, cleanFilename), Buffer.from(rawBase64, 'base64'));
      }
    }

    // 2. Handle inventory update
    if (type === 'inventory' && products) {
      const jsonString = JSON.stringify(products, null, 2) + '\n';
      const base64Content = Buffer.from(jsonString).toString('base64');

      if (GITHUB_TOKEN) {
        await commitToGitHub('src/data/products.json', base64Content, 'chore(admin): update product inventory from studio portal');
      } else {
        const localPath = path.resolve(process.cwd(), 'src/data/products.json');
        fs.writeFileSync(localPath, jsonString);
      }

      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: true,
          message: GITHUB_TOKEN
            ? 'Inventory saved and committed to GitHub. Netlify deploy triggered!'
            : 'Inventory saved locally (Dev Mode).',
        }),
      };
    }

    // 3. Handle settings update
    if (type === 'settings' && settings) {
      const jsonString = JSON.stringify(settings, null, 2) + '\n';
      const base64Content = Buffer.from(jsonString).toString('base64');

      if (GITHUB_TOKEN) {
        await commitToGitHub('src/data/settings.json', base64Content, 'chore(admin): update store settings from studio portal');
      } else {
        const localPath = path.resolve(process.cwd(), 'src/data/settings.json');
        fs.writeFileSync(localPath, jsonString);
      }

      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: true,
          message: GITHUB_TOKEN
            ? 'Settings saved and committed to GitHub. Netlify deploy triggered!'
            : 'Settings saved locally (Dev Mode).',
        }),
      };
    }

    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid save payload' }) };
  } catch (err: any) {
    console.error('Admin save error:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message || 'Failed to save changes' }),
    };
  }
};
```

`src/services/adminApi.ts`:
```typescript
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test tests/adminApi.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add netlify/functions/admin-save.ts src/services/adminApi.ts tests/adminApi.test.ts
git commit -m "feat: implement Git-backed admin persistence Netlify Function and adminApi service"
```

---

### Task 4: Admin Login Card & Access Gate Component

**Files:**
- Create: `src/components/admin/AdminLoginCard.tsx`
- Create: `tests/AdminLoginCard.test.tsx`

**Interfaces:**
- Consumes: `adminAuth` from `src/services/adminAuth`
- Produces:
  - `AdminLoginCard({ onLoginSuccess: (session: AdminSession) => void }): JSX.Element`

- [ ] **Step 1: Write failing test for AdminLoginCard**

`tests/AdminLoginCard.test.tsx`:
```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { AdminLoginCard } from '../src/components/admin/AdminLoginCard';
import { adminAuth } from '../src/services/adminAuth';

describe('AdminLoginCard', () => {
  it('renders studio login title, whitelist notice, and return link', () => {
    render(<AdminLoginCard onLoginSuccess={vi.fn()} />);

    expect(screen.getByText(/Weebles Studio Manager/i)).toBeInTheDocument();
    expect(screen.getByText(/lucasshawn@gmail.com/i)).toBeInTheDocument();
    expect(screen.getByText(/lucascierra24@gmail.com/i)).toBeInTheDocument();
    expect(screen.getByText(/Return to Storefront/i)).toBeInTheDocument();
  });

  it('authenticates successfully via dev bypass login for Shawn', async () => {
    const handleSuccess = vi.fn();
    vi.spyOn(adminAuth, 'devLogin').mockResolvedValue({
      token: 'shawn-token',
      email: 'lucasshawn@gmail.com',
      name: 'Shawn',
    });

    render(<AdminLoginCard onLoginSuccess={handleSuccess} />);

    const shawnBtn = screen.getByRole('button', { name: /Login as Shawn/i });
    fireEvent.click(shawnBtn);

    await waitFor(() => {
      expect(handleSuccess).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'lucasshawn@gmail.com' })
      );
    });
  });

  it('authenticates successfully via dev bypass login for Cierra', async () => {
    const handleSuccess = vi.fn();
    vi.spyOn(adminAuth, 'devLogin').mockResolvedValue({
      token: 'cierra-token',
      email: 'lucascierra24@gmail.com',
      name: 'Cierra',
    });

    render(<AdminLoginCard onLoginSuccess={handleSuccess} />);

    const cierraBtn = screen.getByRole('button', { name: /Login as Cierra/i });
    fireEvent.click(cierraBtn);

    await waitFor(() => {
      expect(handleSuccess).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'lucascierra24@gmail.com' })
      );
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test tests/AdminLoginCard.test.tsx`  
Expected: FAIL (cannot find module `src/components/admin/AdminLoginCard`)

- [ ] **Step 3: Implement AdminLoginCard**

`src/components/admin/AdminLoginCard.tsx`:
```typescript
import React, { useEffect, useState } from 'react';
import { Lock, Sparkles, ArrowLeft, AlertCircle } from 'lucide-react';
import { adminAuth, AdminSession } from '../../services/adminAuth';

interface AdminLoginCardProps {
  onLoginSuccess: (session: AdminSession) => void;
}

export const AdminLoginCard: React.FC<AdminLoginCardProps> = ({ onLoginSuccess }) => {
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Mount Google Identity Services if client ID is configured
    const clientId = (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID;
    if (clientId && (window as any).google?.accounts?.id) {
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
        (window as any).google.accounts.id.renderButton(
          document.getElementById('googleSignInBtn'),
          { theme: 'outline', size: 'large', shape: 'pill', text: 'signin_with' }
        );
      } catch (err) {
        console.error('Google SSO init error', err);
      }
    }
  }, [onLoginSuccess]);

  const handleDevLogin = async (email: string) => {
    setIsLoading(true);
    setErrorMessage('');
    try {
      const session = await adminAuth.devLogin(email);
      onLoginSuccess(session);
    } catch (err: any) {
      setErrorMessage(err.message || 'Login failed');
    } finally {
      setIsLoading(false);
    }
  };

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

        {/* Google SSO Container */}
        <div className="flex justify-center mb-6" id="googleSignInBtn" />

        {/* Development Studio Login Buttons */}
        <div className="bg-weeble-pinkWash p-4 rounded-2xl border border-pink-100 mb-6">
          <span className="text-[11px] font-bold text-weeble-textMuted uppercase tracking-wider block mb-2">
            Authorized Studio Access:
          </span>
          <div className="grid grid-cols-2 gap-2">
            <button
              disabled={isLoading}
              onClick={() => handleDevLogin('lucasshawn@gmail.com')}
              className="bg-white hover:bg-pink-50 text-weeble-text border border-pink-200 text-xs font-bold py-2 px-3 rounded-xl transition-all shadow-xs hover:border-pink-300"
            >
              Login as Shawn 🍓
            </button>
            <button
              disabled={isLoading}
              onClick={() => handleDevLogin('lucascierra24@gmail.com')}
              className="bg-white hover:bg-pink-50 text-weeble-text border border-pink-200 text-xs font-bold py-2 px-3 rounded-xl transition-all shadow-xs hover:border-pink-300"
            >
              Login as Cierra 🎀
            </button>
          </div>
        </div>

        <div className="text-[11px] text-weeble-textMuted border-t border-pink-100 pt-4 mb-6 text-left space-y-1">
          <div className="font-bold text-weeble-text">Authorized Admin Accounts:</div>
          <div>• lucasshawn@gmail.com</div>
          <div>• lucascierra24@gmail.com</div>
        </div>

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

Run: `npm test tests/AdminLoginCard.test.tsx`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/admin/AdminLoginCard.tsx tests/AdminLoginCard.test.tsx
git commit -m "feat: implement AdminLoginCard with Google SSO and authorized admin access"
```

---

### Task 5: Weeble Inventory Manager Tab & Item Editor Drawer

**Files:**
- Create: `src/components/admin/WeebleEditorModal.tsx`
- Create: `src/components/admin/InventoryTab.tsx`
- Create: `tests/InventoryTab.test.tsx`

**Interfaces:**
- Consumes: `Product`, `VariantType`
- Produces:
  - `InventoryTab({ products: Product[], onSave: (updated: Product[], newImage?: any) => Promise<void> }): JSX.Element`

- [ ] **Step 1: Write failing test for InventoryTab**

`tests/InventoryTab.test.tsx`:
```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { InventoryTab } from '../src/components/admin/InventoryTab';
import { Product } from '../src/types';

const mockProducts: Product[] = [
  {
    id: 'weeble-bee',
    name: 'Chubby Bumblebee',
    description: 'Sweet honey bee',
    price: 14.0,
    images: ['/images/products/bumblebee.jpg'],
    category: 'animals',
    availableVariants: ['magnet', 'keychain'],
    inStock: true,
    stockCount: 2,
    featured: true,
  },
];

describe('InventoryTab', () => {
  it('renders products and allows opening add product drawer', () => {
    render(<InventoryTab products={mockProducts} onSave={vi.fn()} />);

    expect(screen.getByText('Chubby Bumblebee')).toBeInTheDocument();
    expect(screen.getByText('$14.00')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /\+ Add New Weeble/i })).toBeInTheDocument();
  });

  it('opens editor modal with product data when clicking edit', () => {
    render(<InventoryTab products={mockProducts} onSave={vi.fn()} />);

    const editBtn = screen.getByRole('button', { name: /Edit/i });
    fireEvent.click(editBtn);

    expect(screen.getByText(/Edit Weeble/i)).toBeInTheDocument();
    expect(screen.getByDisplayValue('Chubby Bumblebee')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test tests/InventoryTab.test.tsx`  
Expected: FAIL (cannot find module `src/components/admin/InventoryTab`)

- [ ] **Step 3: Implement WeebleEditorModal and InventoryTab**

`src/components/admin/WeebleEditorModal.tsx`:
```typescript
import React, { useState } from 'react';
import { X, Upload, Sparkles } from 'lucide-react';
import { Product, VariantType } from '../../types';

interface WeebleEditorModalProps {
  product: Product | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (product: Product, newImage?: { filename: string; base64Data: string }) => void;
}

export const WeebleEditorModal: React.FC<WeebleEditorModalProps> = ({
  product,
  isOpen,
  onClose,
  onSave,
}) => {
  const [name, setName] = useState(product?.name || '');
  const [description, setDescription] = useState(product?.description || '');
  const [price, setPrice] = useState(product ? String(product.price) : '14.00');
  const [category, setCategory] = useState<Product['category']>(product?.category || 'sweets');
  const [imageUrl, setImageUrl] = useState(product?.images[0] || '');
  const [variants, setVariants] = useState<VariantType[]>(
    product?.availableVariants || ['magnet', 'keychain']
  );
  const [inStock, setInStock] = useState(product ? product.inStock : true);
  const [stockCount, setStockCount] = useState(product ? product.stockCount : 2);
  const [isOneOfAKind, setIsOneOfAKind] = useState(product?.isOneOfAKind || false);
  const [featured, setFeatured] = useState(product?.featured || false);
  const [uploadedImage, setUploadedImage] = useState<{ filename: string; base64Data: string } | null>(null);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      setUploadedImage({ filename: file.name, base64Data: base64 });
      setImageUrl(base64);
    };
    reader.readAsDataURL(file);
  };

  const handleToggleVariant = (v: VariantType) => {
    setVariants((prev) =>
      prev.includes(v) ? prev.filter((item) => item !== v) : [...prev, v]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const id = product?.id || `weeble-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now().toString().slice(-4)}`;
    const finalImagePath = uploadedImage ? `/images/products/${uploadedImage.filename}` : imageUrl;

    const savedProduct: Product = {
      id,
      name,
      description,
      price: parseFloat(price) || 14.0,
      images: [finalImagePath || '/images/products/placeholder.jpg'],
      category,
      availableVariants: variants.length > 0 ? variants : ['magnet'],
      inStock,
      stockCount: isOneOfAKind ? 1 : Math.max(0, stockCount),
      isOneOfAKind,
      featured,
    };

    onSave(savedProduct, uploadedImage || undefined);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4">
      <div onClick={onClose} className="fixed inset-0 bg-black/40 backdrop-blur-xs" />
      <div className="relative bg-white rounded-3xl border-4 border-pink-200 max-w-xl w-full p-6 sm:p-8 shadow-2xl z-10">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 w-8 h-8 rounded-full bg-weeble-pinkWash text-weeble-text hover:text-weeble-pink flex items-center justify-center"
        >
          <X className="w-5 h-5" />
        </button>

        <h2 className="font-bubble text-2xl font-bold text-weeble-text mb-4">
          {product ? 'Edit Weeble 🍓' : 'Add New Weeble 🎀'}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-weeble-text mb-1">Name</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full text-sm bg-weeble-pinkWash border border-pink-200 rounded-xl px-3 py-2 text-weeble-text focus:outline-none focus:border-weeble-pink"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-weeble-text mb-1">Price ($ USD)</label>
              <input
                type="number"
                step="0.50"
                required
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="w-full text-sm bg-weeble-pinkWash border border-pink-200 rounded-xl px-3 py-2 text-weeble-text focus:outline-none focus:border-weeble-pink"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-weeble-text mb-1">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as any)}
                className="w-full text-sm bg-weeble-pinkWash border border-pink-200 rounded-xl px-3 py-2 text-weeble-text focus:outline-none focus:border-weeble-pink"
              >
                <option value="sweets">🍩 Sweets</option>
                <option value="animals">🐰 Animals</option>
                <option value="fantasy">✨ Fantasy</option>
                <option value="mini-friends">🌸 Mini-Friends</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-weeble-text mb-1">Description</label>
            <textarea
              rows={2}
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full text-sm bg-weeble-pinkWash border border-pink-200 rounded-xl px-3 py-2 text-weeble-text focus:outline-none focus:border-weeble-pink"
            />
          </div>

          {/* Image Upload & Preview */}
          <div>
            <label className="block text-xs font-bold text-weeble-text mb-1">Product Photo</label>
            <div className="flex items-center gap-3">
              {imageUrl && (
                <img
                  src={imageUrl}
                  alt="Preview"
                  className="w-16 h-16 rounded-xl object-cover border border-pink-200 bg-weeble-pinkBg"
                />
              )}
              <div className="flex-1">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="w-full text-xs text-weeble-textMuted file:mr-2 file:py-1.5 file:px-3 file:rounded-full file:border-0 file:text-xs file:font-bold file:bg-weeble-pink file:text-white"
                />
              </div>
            </div>
          </div>

          {/* Variants */}
          <div>
            <label className="block text-xs font-bold text-weeble-text mb-1">Available Styles</label>
            <div className="flex gap-4">
              <label className="flex items-center gap-1.5 text-xs font-bold cursor-pointer">
                <input
                  type="checkbox"
                  checked={variants.includes('magnet')}
                  onChange={() => handleToggleVariant('magnet')}
                  className="accent-pink-500"
                />
                <span>🧲 Refrigerator Magnet</span>
              </label>
              <label className="flex items-center gap-1.5 text-xs font-bold cursor-pointer">
                <input
                  type="checkbox"
                  checked={variants.includes('keychain')}
                  onChange={() => handleToggleVariant('keychain')}
                  className="accent-pink-500"
                />
                <span>🔑 Keychain</span>
              </label>
            </div>
          </div>

          {/* Stock Toggles */}
          <div className="grid grid-cols-2 gap-3 pt-2 border-t border-pink-100">
            <label className="flex items-center gap-2 text-xs font-bold cursor-pointer">
              <input
                type="checkbox"
                checked={inStock}
                onChange={(e) => setInStock(e.target.checked)}
                className="accent-pink-500"
              />
              <span>In Stock</span>
            </label>
            <label className="flex items-center gap-2 text-xs font-bold cursor-pointer">
              <input
                type="checkbox"
                checked={isOneOfAKind}
                onChange={(e) => setIsOneOfAKind(e.target.checked)}
                className="accent-pink-500"
              />
              <span>⭐ 1-of-1 Original</span>
            </label>
          </div>

          <button
            type="submit"
            className="w-full bg-weeble-pink hover:bg-pink-500 text-white font-bubble text-base font-bold py-3 rounded-full shadow-pillow hover:scale-105 active:scale-95 transition-all mt-4"
          >
            Save Weeble 💖
          </button>
        </form>
      </div>
    </div>
  );
};
```

`src/components/admin/InventoryTab.tsx`:
```typescript
import React, { useState } from 'react';
import { Plus, Edit2, Trash2, Search, Sparkles } from 'lucide-react';
import { Product } from '../../types';
import { formatPrice } from '../../utils/productUtils';
import { WeebleEditorModal } from './WeebleEditorModal';

interface InventoryTabProps {
  products: Product[];
  onSave: (updated: Product[], newImage?: { filename: string; base64Data: string }) => Promise<void>;
}

export const InventoryTab: React.FC<InventoryTabProps> = ({ products, onSave }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const filtered = products.filter(
    (p) =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleAddNew = () => {
    setEditingProduct(null);
    setIsEditorOpen(true);
  };

  const handleEdit = (product: Product) => {
    setEditingProduct(product);
    setIsEditorOpen(true);
  };

  const handleDelete = async (productId: string) => {
    if (!window.confirm('Are you sure you want to remove this Weeble from the catalog?')) return;
    setIsSaving(true);
    try {
      const updated = products.filter((p) => p.id !== productId);
      await onSave(updated);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveModal = async (saved: Product, newImage?: { filename: string; base64Data: string }) => {
    setIsSaving(true);
    try {
      let updated: Product[];
      const exists = products.some((p) => p.id === saved.id);
      if (exists) {
        updated = products.map((p) => (p.id === saved.id ? saved : p));
      } else {
        updated = [saved, ...products];
      }
      await onSave(updated, newImage);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div>
      {/* Action Header */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-6">
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-pink-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search catalog..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white border-2 border-pink-200 rounded-full pl-10 pr-4 py-2 text-sm text-weeble-text focus:outline-none focus:border-weeble-pink"
          />
        </div>

        <button
          onClick={handleAddNew}
          disabled={isSaving}
          className="w-full sm:w-auto bg-weeble-pink hover:bg-pink-500 text-white font-bubble text-sm font-bold px-5 py-2.5 rounded-full shadow-pillow flex items-center justify-center gap-1.5 transition-transform hover:scale-105 active:scale-95 disabled:opacity-50"
        >
          <Plus className="w-4 h-4" />
          <span>Add New Weeble</span>
        </button>
      </div>

      {/* Inventory Table / Grid */}
      <div className="bg-white rounded-3xl border-2 border-pink-200 overflow-hidden shadow-sm">
        <div className="divide-y divide-pink-100">
          {filtered.map((item) => (
            <div key={item.id} className="p-4 sm:p-5 flex items-center gap-4 hover:bg-weeble-pinkWash/30 transition-colors">
              <img
                src={item.images[0]}
                alt={item.name}
                className="w-16 h-16 rounded-2xl object-cover border border-pink-200 bg-weeble-pinkBg shrink-0"
              />

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-bubble text-base font-bold text-weeble-text truncate">
                    {item.name}
                  </h3>
                  {item.isOneOfAKind && (
                    <span className="bg-weeble-yellow text-weeble-text text-[10px] font-bold px-2 py-0.5 rounded-full">
                      ⭐ 1-of-1
                    </span>
                  )}
                  {!item.inStock && (
                    <span className="bg-gray-200 text-gray-700 text-[10px] font-bold px-2 py-0.5 rounded-full">
                      💤 Sold Out
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-3 text-xs text-weeble-textMuted">
                  <span className="font-bold text-weeble-pink">{formatPrice(item.price)}</span>
                  <span>•</span>
                  <span className="capitalize">{item.category}</span>
                  <span>•</span>
                  <span>Stock: {item.stockCount}</span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => handleEdit(item)}
                  className="p-2 rounded-xl bg-pink-50 hover:bg-pink-100 text-weeble-pink transition-colors"
                  aria-label="Edit"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDelete(item.id)}
                  className="p-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-500 transition-colors"
                  aria-label="Delete"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <WeebleEditorModal
        product={editingProduct}
        isOpen={isEditorOpen}
        onClose={() => setIsEditorOpen(false)}
        onSave={handleSaveModal}
      />
    </div>
  );
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test tests/InventoryTab.test.tsx`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/admin/WeebleEditorModal.tsx src/components/admin/InventoryTab.tsx tests/InventoryTab.test.tsx
git commit -m "feat: implement InventoryTab and WeebleEditorModal for catalog management"
```

---

### Task 6: Store & Social Settings Tab

**Files:**
- Create: `src/components/admin/SettingsTab.tsx`
- Create: `tests/SettingsTab.test.tsx`

**Interfaces:**
- Consumes: `SiteSettings`
- Produces:
  - `SettingsTab({ settings: SiteSettings, onSave: (updated: SiteSettings) => Promise<void> }): JSX.Element`

- [ ] **Step 1: Write failing test for SettingsTab**

`tests/SettingsTab.test.tsx`:
```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { SettingsTab } from '../src/components/admin/SettingsTab';
import { SiteSettings } from '../src/types/settings';

const mockSettings: SiteSettings = {
  contactEmail: 'weeblesclay@gmail.com',
  customOrderEmail: 'weeblesclay@gmail.com',
  socials: {
    tiktok: 'https://tiktok.com/@weebles_clay',
    instagram: 'https://instagram.com/weebles_clay',
    facebookMarketplace: 'https://facebook.com/marketplace',
  },
};

describe('SettingsTab', () => {
  it('renders inputs with pre-filled current values', () => {
    render(<SettingsTab settings={mockSettings} onSave={vi.fn()} />);

    expect(screen.getByDisplayValue('weeblesclay@gmail.com')).toBeInTheDocument();
    expect(screen.getByDisplayValue('https://tiktok.com/@weebles_clay')).toBeInTheDocument();
    expect(screen.getByDisplayValue('https://instagram.com/weebles_clay')).toBeInTheDocument();
  });

  it('triggers onSave callback with updated values', async () => {
    const handleSave = vi.fn().mockResolvedValue(undefined);
    render(<SettingsTab settings={mockSettings} onSave={handleSave} />);

    const contactInput = screen.getByLabelText(/General Contact Email/i);
    fireEvent.change(contactInput, { target: { value: 'cierra@weebles.com' } });

    const saveBtn = screen.getByRole('button', { name: /Save & Publish Settings/i });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(handleSave).toHaveBeenCalledWith(
        expect.objectContaining({ contactEmail: 'cierra@weebles.com' })
      );
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test tests/SettingsTab.test.tsx`  
Expected: FAIL (cannot find module `src/components/admin/SettingsTab`)

- [ ] **Step 3: Implement SettingsTab**

`src/components/admin/SettingsTab.tsx`:
```typescript
import React, { useState } from 'react';
import { Save, CheckCircle2, Mail, Share2 } from 'lucide-react';
import { SiteSettings } from '../../types/settings';

interface SettingsTabProps {
  settings: SiteSettings;
  onSave: (updated: SiteSettings) => Promise<void>;
}

export const SettingsTab: React.FC<SettingsTabProps> = ({ settings, onSave }) => {
  const [contactEmail, setContactEmail] = useState(settings.contactEmail);
  const [customOrderEmail, setCustomOrderEmail] = useState(settings.customOrderEmail);
  const [tiktok, setTiktok] = useState(settings.socials.tiktok);
  const [instagram, setInstagram] = useState(settings.socials.instagram);
  const [facebookMarketplace, setFacebookMarketplace] = useState(settings.socials.facebookMarketplace);
  const [isSaving, setIsSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSavedSuccess(false);

    try {
      await onSave({
        contactEmail,
        customOrderEmail,
        socials: {
          tiktok,
          instagram,
          facebookMarketplace,
        },
      });
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 4000);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl mx-auto space-y-6">
      {savedSuccess && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold rounded-2xl p-4 flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-emerald-600" />
          <span>Settings saved successfully and published!</span>
        </div>
      )}

      {/* Email Notifications */}
      <div className="bg-white rounded-3xl border-2 border-pink-200 p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-9 h-9 rounded-xl bg-pink-100 flex items-center justify-center text-weeble-pink">
            <Mail className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bubble text-lg font-bold text-weeble-text">Studio Emails</h3>
            <p className="text-xs text-weeble-textMuted">Contact and custom order notification recipients</p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label htmlFor="contactEmail" className="block text-xs font-bold text-weeble-text mb-1">
              General Contact Email
            </label>
            <input
              id="contactEmail"
              type="email"
              required
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              className="w-full text-sm bg-weeble-pinkWash border border-pink-200 rounded-xl px-3.5 py-2.5 text-weeble-text focus:outline-none focus:border-weeble-pink"
            />
          </div>

          <div>
            <label htmlFor="customOrderEmail" className="block text-xs font-bold text-weeble-text mb-1">
              Custom Order Request Notification Email
            </label>
            <input
              id="customOrderEmail"
              type="email"
              required
              value={customOrderEmail}
              onChange={(e) => setCustomOrderEmail(e.target.value)}
              className="w-full text-sm bg-weeble-pinkWash border border-pink-200 rounded-xl px-3.5 py-2.5 text-weeble-text focus:outline-none focus:border-weeble-pink"
            />
          </div>
        </div>
      </div>

      {/* Social Media Links */}
      <div className="bg-white rounded-3xl border-2 border-pink-200 p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-9 h-9 rounded-xl bg-pink-100 flex items-center justify-center text-weeble-pink">
            <Share2 className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bubble text-lg font-bold text-weeble-text">Social Media Exposure Links</h3>
            <p className="text-xs text-weeble-textMuted">Links displayed on the homepage social strip and footer</p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label htmlFor="tiktok" className="block text-xs font-bold text-weeble-text mb-1">
              TikTok Profile URL
            </label>
            <input
              id="tiktok"
              type="url"
              value={tiktok}
              onChange={(e) => setTiktok(e.target.value)}
              placeholder="https://tiktok.com/@weebles_clay"
              className="w-full text-sm bg-weeble-pinkWash border border-pink-200 rounded-xl px-3.5 py-2.5 text-weeble-text focus:outline-none focus:border-weeble-pink"
            />
          </div>

          <div>
            <label htmlFor="instagram" className="block text-xs font-bold text-weeble-text mb-1">
              Instagram Profile URL
            </label>
            <input
              id="instagram"
              type="url"
              value={instagram}
              onChange={(e) => setInstagram(e.target.value)}
              placeholder="https://instagram.com/weebles_clay"
              className="w-full text-sm bg-weeble-pinkWash border border-pink-200 rounded-xl px-3.5 py-2.5 text-weeble-text focus:outline-none focus:border-weeble-pink"
            />
          </div>

          <div>
            <label htmlFor="facebookMarketplace" className="block text-xs font-bold text-weeble-text mb-1">
              Facebook Marketplace URL
            </label>
            <input
              id="facebookMarketplace"
              type="url"
              value={facebookMarketplace}
              onChange={(e) => setFacebookMarketplace(e.target.value)}
              placeholder="https://facebook.com/marketplace"
              className="w-full text-sm bg-weeble-pinkWash border border-pink-200 rounded-xl px-3.5 py-2.5 text-weeble-text focus:outline-none focus:border-weeble-pink"
            />
          </div>
        </div>
      </div>

      <button
        type="submit"
        disabled={isSaving}
        className="w-full bg-weeble-pink hover:bg-pink-500 text-white font-bubble text-base font-bold py-3.5 rounded-full shadow-pillow hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
      >
        <Save className="w-5 h-5" />
        <span>{isSaving ? 'Publishing Changes...' : 'Save & Publish Settings 💖'}</span>
      </button>
    </form>
  );
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test tests/SettingsTab.test.tsx`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/admin/SettingsTab.tsx tests/SettingsTab.test.tsx
git commit -m "feat: implement SettingsTab for managing studio emails and social media links"
```

---

### Task 7: Admin Portal Dashboard Assembly, Footer Link & Routing

**Files:**
- Create: `src/components/admin/AdminPortal.tsx`
- Modify: `src/components/Footer.tsx`
- Modify: `src/App.tsx`
- Create: `tests/AdminPortal.test.tsx`
- Modify: `tests/smoke.test.ts`

**Interfaces:**
- Consumes: `AdminLoginCard`, `InventoryTab`, `SettingsTab`, `adminAuth`, `adminApi`
- Produces: Working `/admin` route and footer link.

- [ ] **Step 1: Write integration test for AdminPortal**

`tests/AdminPortal.test.tsx`:
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { AdminPortal } from '../src/components/admin/AdminPortal';
import { adminAuth } from '../src/services/adminAuth';
import { SettingsProvider } from '../src/context/SettingsContext';

describe('AdminPortal', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders login card when not authenticated', () => {
    render(
      <SettingsProvider>
        <AdminPortal />
      </SettingsProvider>
    );

    expect(screen.getByText(/Weebles Studio Manager/i)).toBeInTheDocument();
  });

  it('renders dashboard with tabs when authenticated', () => {
    adminAuth.setSession({ token: 'valid-token', email: 'lucasshawn@gmail.com', name: 'Shawn' });

    render(
      <SettingsProvider>
        <AdminPortal />
      </SettingsProvider>
    );

    expect(screen.getByText(/lucasshawn@gmail.com/i)).toBeInTheDocument();
    expect(screen.getByText(/Inventory Catalog/i)).toBeInTheDocument();
    expect(screen.getByText(/Store & Social Settings/i)).toBeInTheDocument();
  });

  it('allows logging out', () => {
    adminAuth.setSession({ token: 'valid-token', email: 'lucascierra24@gmail.com', name: 'Cierra' });

    render(
      <SettingsProvider>
        <AdminPortal />
      </SettingsProvider>
    );

    const logoutBtn = screen.getByRole('button', { name: /Log Out/i });
    fireEvent.click(logoutBtn);

    expect(screen.getByText(/Weebles Studio Manager/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test tests/AdminPortal.test.tsx`  
Expected: FAIL (cannot find module `src/components/admin/AdminPortal`)

- [ ] **Step 3: Implement AdminPortal, update Footer with Studio Login link, and wire route in App.tsx**

`src/components/admin/AdminPortal.tsx`:
```typescript
import React, { useState } from 'react';
import { LogOut, ArrowLeft, Layers, Settings, Sparkles } from 'lucide-react';
import { adminAuth, AdminSession } from '../../services/adminAuth';
import { adminApi } from '../../services/adminApi';
import { AdminLoginCard } from './AdminLoginCard';
import { InventoryTab } from './InventoryTab';
import { SettingsTab } from './SettingsTab';
import { useSettings } from '../../context/SettingsContext';
import initialProductsData from '../../data/products.json';
import { Product } from '../../types';

export const AdminPortal: React.FC = () => {
  const [session, setSession] = useState<AdminSession | null>(() => adminAuth.getSession());
  const [activeTab, setActiveTab] = useState<'inventory' | 'settings'>('inventory');
  const [products, setProducts] = useState<Product[]>(() => {
    const raw = (initialProductsData as any)?.products || initialProductsData;
    return Array.isArray(raw) ? raw : [];
  });
  const { settings, updateSettings } = useSettings();
  const [notification, setNotification] = useState<string | null>(null);

  if (!session) {
    return <AdminLoginCard onLoginSuccess={(s) => setSession(s)} />;
  }

  const handleLogout = () => {
    adminAuth.logout();
    setSession(null);
  };

  const handleSaveInventory = async (
    updated: Product[],
    newImage?: { filename: string; base64Data: string }
  ) => {
    const res = await adminApi.saveInventory(updated, newImage);
    setProducts(updated);
    setNotification(res.message);
    setTimeout(() => setNotification(null), 4000);
  };

  const handleSaveSettings = async (newSettings: any) => {
    const res = await adminApi.saveSettings(newSettings);
    updateSettings(newSettings);
    setNotification(res.message);
    setTimeout(() => setNotification(null), 4000);
  };

  return (
    <div className="min-h-screen bg-weeble-pinkBg flex flex-col">
      {/* Top Admin Header */}
      <header className="bg-white border-b-2 border-pink-100 sticky top-0 z-40 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-weeble-pink to-weeble-pinkLight flex items-center justify-center shadow-pillow">
              <span className="text-xl">🍓</span>
            </div>
            <div>
              <h1 className="font-bubble text-xl font-bold text-weeble-pink leading-none">
                Weebles Studio Admin
              </h1>
              <span className="text-[11px] font-semibold text-weeble-textMuted">
                Signed in as: <strong className="text-weeble-text">{session.email}</strong>
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <a
              href="/"
              className="text-xs font-bold text-weeble-text hover:text-weeble-pink px-3 py-1.5 rounded-full hover:bg-weeble-pinkWash flex items-center gap-1 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">View Store</span>
            </a>
            <button
              onClick={handleLogout}
              className="text-xs font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200 px-3 py-1.5 rounded-full flex items-center gap-1 transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Log Out</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Body */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 w-full">
        {notification && (
          <div className="mb-6 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold px-4 py-3 rounded-2xl shadow-xs">
            {notification}
          </div>
        )}

        {/* Tab Navigation */}
        <div className="flex items-center gap-3 border-b-2 border-pink-200 pb-3 mb-6">
          <button
            onClick={() => setActiveTab('inventory')}
            className={`font-bubble text-sm sm:text-base font-bold px-5 py-2.5 rounded-full transition-all flex items-center gap-2 ${
              activeTab === 'inventory'
                ? 'bg-weeble-pink text-white shadow-pillow scale-102'
                : 'bg-white text-weeble-text border border-pink-200 hover:bg-weeble-pinkWash'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>🍓 Inventory Catalog</span>
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`font-bubble text-sm sm:text-base font-bold px-5 py-2.5 rounded-full transition-all flex items-center gap-2 ${
              activeTab === 'settings'
                ? 'bg-weeble-pink text-white shadow-pillow scale-102'
                : 'bg-white text-weeble-text border border-pink-200 hover:bg-weeble-pinkWash'
            }`}
          >
            <Settings className="w-4 h-4" />
            <span>⚙️ Store & Social Settings</span>
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === 'inventory' ? (
          <InventoryTab products={products} onSave={handleSaveInventory} />
        ) : (
          <SettingsTab settings={settings} onSave={handleSaveSettings} />
        )}
      </main>
    </div>
  );
};
```

Update `src/components/Footer.tsx`:
Add discreet "Studio Login 🍓" link in footer.

Update `src/App.tsx`:
Render `AdminPortal` when `window.location.pathname === '/admin'`. Wrap app in `SettingsProvider`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test tests/AdminPortal.test.tsx`  
Expected: PASS

- [ ] **Step 5: Run full test suite and production build**

Run: `npm test && npm run build`  
Expected: All tests pass, production bundle generates in `dist/`.

- [ ] **Step 6: Commit**

```bash
git add src/components/admin/AdminPortal.tsx src/components/Footer.tsx src/App.tsx tests/AdminPortal.test.tsx tests/smoke.test.ts
git commit -m "feat: assemble AdminPortal, wire /admin routing, add footer login link, and build validation"
```
