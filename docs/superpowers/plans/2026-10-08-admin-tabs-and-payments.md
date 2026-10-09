# Weebles Studio Admin: 4-Tab Management Portal & Stripe Payment Hub Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the Weebles Studio Admin Portal into a 4-tab management center featuring: (1) Manage Admins, (2) Manage Catalog, (3) Manage Payments with live Stripe integration and transactions feed, and (4) Manage Site Content with a configurable top-of-homepage announcement banner.

**Architecture:** Extend existing Netlify serverless functions and React context to support dynamic admin whitelist persistence, server-side Stripe checkout session querying (`admin-payments.ts`), and top-level storefront announcement banner rendering. Assemble 4 dedicated tabs in `AdminPortal.tsx` with pastel aesthetics, robust validation, and full automated test coverage.

**Tech Stack:** React 18, TypeScript, Tailwind CSS, Lucide icons, Stripe Node SDK, Netlify Serverless Functions, Vitest, React Testing Library.

## Global Constraints

- **Platform Target:** Netlify (build directory `dist`, functions directory `netlify/functions`).
- **Visual Design:** Hello Kitty inspired feminine pastel theme (`#FF85A1` weeble-pink, `#FFF5F7` weeble-pinkBg, `#4A2E35` weeble-text, Fredoka bubble headings, Quicksand rounded body, soft cards, pill badges).
- **Security:** HMAC SHA-256 session tokens; `STRIPE_SECRET_KEY` remains strictly server-side in Netlify functions; admin actions require verified session and whitelist membership.
- **Initial Administrators:** `lucasshawn@gmail.com` and `lucascierra24@gmail.com`. Safety guard prevents self-removal and empty whitelist.
- **Strict Quality:** 100% strict TypeScript types, 0 `TODO`/placeholder comments, TDD methodology (failing test before code), all existing tests must continue to pass.

---

### Task 1: Dynamic Admins Whitelist Model, Settings Schema & API Persistence

**Files:**
- Modify: `src/types/settings.ts`
- Modify: `src/data/settings.json`
- Modify: `netlify/functions/admin-auth.ts`
- Modify: `netlify/functions/admin-save.ts`
- Modify: `src/services/adminApi.ts`
- Modify: `tests/adminApi.test.ts`
- Modify: `tests/adminAuth.test.ts`

**Interfaces:**
- Consumes: `SiteSettings`
- Produces:
  - `SiteSettings.admins: string[]`
  - `SiteSettings.announcementBanner: { enabled: boolean; text: string }`
  - `adminApi.saveAdmins(admins: string[]): Promise<{ success: boolean; message: string }>`
  - Dynamic whitelist verification in `admin-auth.ts` and `admin-save.ts`

- [ ] **Step 1: Write failing unit test for dynamic admins persistence in `tests/adminApi.test.ts`**

In `tests/adminApi.test.ts`, add:
```typescript
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/adminApi.test.ts`  
Expected: FAIL (handler returns 400 "Invalid save payload" for type 'admins')

- [ ] **Step 3: Update settings schema, default settings, and persistence handlers**

In `src/types/settings.ts`:
```typescript
export interface AnnouncementBannerSettings {
  enabled: boolean;
  text: string;
}

export interface SiteSettings {
  contactEmail: string;
  customOrderEmail: string;
  socials: {
    tiktok: string;
    instagram: string;
    facebookMarketplace: string;
  };
  announcementBanner?: AnnouncementBannerSettings;
  admins?: string[];
}
```

In `src/data/settings.json`:
Add `"announcementBanner": { "enabled": false, "text": "" }` and `"admins": ["lucasshawn@gmail.com", "lucascierra24@gmail.com"]`.

In `netlify/functions/admin-auth.ts` and `netlify/functions/admin-save.ts`:
Import default settings from `src/data/settings.json`. Read `admins` array dynamically from settings, falling back to `['lucasshawn@gmail.com', 'lucascierra24@gmail.com']`.
In `admin-save.ts`, handle `type === 'admins'`:
```typescript
if (type === 'admins' && Array.isArray(admins)) {
  // Read current settings, update admins array, commit/write settings.json
}
```

In `src/services/adminApi.ts`, add:
```typescript
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
    throw new Error(data.error || 'Failed to save admin whitelist');
  }

  return res.json();
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/adminApi.test.ts tests/adminAuth.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/types/settings.ts src/data/settings.json netlify/functions/admin-auth.ts netlify/functions/admin-save.ts src/services/adminApi.ts tests/adminApi.test.ts tests/adminAuth.test.ts
git commit -m "feat: implement dynamic admin whitelist model and persistence in adminApi and admin-save"
```

---

### Task 2: Manage Admins Tab Component (`AdminsTab.tsx`)

**Files:**
- Create: `src/components/admin/AdminsTab.tsx`
- Create: `tests/AdminsTab.test.tsx`

**Interfaces:**
- Consumes: `admins: string[]`, `currentAdminEmail: string`, `onSave: (updatedAdmins: string[]) => Promise<void>`
- Produces: `AdminsTab` component

- [ ] **Step 1: Write failing test in `tests/AdminsTab.test.tsx`**

Create `tests/AdminsTab.test.tsx`:
```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { AdminsTab } from '../src/components/admin/AdminsTab';

describe('AdminsTab', () => {
  const mockAdmins = ['lucasshawn@gmail.com', 'lucascierra24@gmail.com'];

  it('renders authorized admins list and marks current session', () => {
    render(
      <AdminsTab
        admins={mockAdmins}
        currentAdminEmail="lucasshawn@gmail.com"
        onSave={vi.fn()}
      />
    );

    expect(screen.getByText('lucasshawn@gmail.com')).toBeInTheDocument();
    expect(screen.getByText('lucascierra24@gmail.com')).toBeInTheDocument();
    expect(screen.getByText(/Active Session/i)).toBeInTheDocument();
  });

  it('allows adding a new valid admin email', async () => {
    const handleSave = vi.fn().mockResolvedValue(undefined);
    render(
      <AdminsTab
        admins={mockAdmins}
        currentAdminEmail="lucasshawn@gmail.com"
        onSave={handleSave}
      />
    );

    const input = screen.getByPlaceholderText(/friend@gmail.com/i);
    fireEvent.change(input, { target: { value: 'assistant@weebles.com' } });

    const addBtn = screen.getByRole('button', { name: /Add Admin/i });
    fireEvent.click(addBtn);

    await waitFor(() => {
      expect(handleSave).toHaveBeenCalledWith([
        'lucasshawn@gmail.com',
        'lucascierra24@gmail.com',
        'assistant@weebles.com',
      ]);
    });
  });

  it('prevents removing current active user or having 0 admins', () => {
    render(
      <AdminsTab
        admins={['lucasshawn@gmail.com']}
        currentAdminEmail="lucasshawn@gmail.com"
        onSave={vi.fn()}
      />
    );

    expect(screen.queryByRole('button', { name: /Remove Admin/i })).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/AdminsTab.test.tsx`  
Expected: FAIL (cannot find module `src/components/admin/AdminsTab`)

- [ ] **Step 3: Implement `AdminsTab.tsx`**

Create `src/components/admin/AdminsTab.tsx`:
- List authorized admin accounts with avatar badge (`🍓` or email initial).
- Highlight current session admin (`You (Active Session)` badge).
- Input field with validation (non-empty, valid email pattern, not already in list).
- "+ Add Admin" action button calling `onSave(updated)`.
- Delete action button on other admins with confirmation prompt.
- Prevents deleting the logged-in admin or dropping admin count below 1.
- Hello Kitty pastel card layout with `UserPlus`, `Shield`, `Trash2` icons.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/AdminsTab.test.tsx`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/admin/AdminsTab.tsx tests/AdminsTab.test.tsx
git commit -m "feat: implement AdminsTab component with email validation and self-removal guard"
```

---

### Task 3: Stripe Payments Serverless Function (`admin-payments.ts`) & API Service

**Files:**
- Create: `src/types/payments.ts`
- Create: `netlify/functions/admin-payments.ts`
- Create: `src/services/adminPayments.ts`
- Create: `tests/adminPayments.test.ts`

**Interfaces:**
- Consumes: `STRIPE_SECRET_KEY` (env), `verifyToken`
- Produces: `GET /.netlify/functions/admin-payments` returning `PaymentsResponse`

- [ ] **Step 1: Create types and write failing test in `tests/adminPayments.test.ts`**

Create `src/types/payments.ts`:
```typescript
export interface PaymentItem {
  name: string;
  quantity: number;
  amount: number;
}

export interface TransactionRecord {
  id: string;
  customerEmail: string;
  amount: number;
  currency: string;
  status: 'paid' | 'pending' | 'failed';
  created: number;
  giftNote?: string;
  items: PaymentItem[];
}

export interface PaymentsSummary {
  totalRevenue: number;
  orderCount: number;
  averageOrderValue: number;
}

export interface PaymentsResponse {
  connected: boolean;
  mode: 'live' | 'test' | 'demo';
  summary: PaymentsSummary;
  transactions: TransactionRecord[];
}
```

Create `tests/adminPayments.test.ts` testing:
1. Rejection of unauthenticated requests with 401.
2. Rejection of invalid tokens with 403.
3. Successful demo mode response with mock orders when `STRIPE_SECRET_KEY` is unset.
4. Successful live mode response querying Stripe `checkout.sessions.list` when `STRIPE_SECRET_KEY` is set.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/adminPayments.test.ts`  
Expected: FAIL (cannot find module `netlify/functions/admin-payments`)

- [ ] **Step 3: Implement `netlify/functions/admin-payments.ts` and `adminPayments.ts`**

In `netlify/functions/admin-payments.ts`:
- Validate authorization Bearer token via HMAC verification.
- If `STRIPE_SECRET_KEY` is not configured, return `mode: 'demo'`, realistic mock transactions (e.g. Chubby Bumblebee keychain, Strawberry Bunny magnet, Ghost figurine), and calculated summary metrics.
- If `STRIPE_SECRET_KEY` is configured:
  - Query Stripe Node SDK: `stripe.checkout.sessions.list({ limit: 25, expand: ['data.line_items'] })`.
  - Determine mode (`live` if session `livemode === true`, else `test`).
  - Map sessions to `TransactionRecord[]` and calculate metrics.
- Return HTTP 200 with `PaymentsResponse`.

In `src/services/adminPayments.ts`:
Export `fetchPayments(): Promise<PaymentsResponse>` sending `Authorization: Bearer <session.token>`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/adminPayments.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/types/payments.ts netlify/functions/admin-payments.ts src/services/adminPayments.ts tests/adminPayments.test.ts
git commit -m "feat: implement admin-payments Netlify function with Stripe SDK and demo fallback"
```

---

### Task 4: Manage Payments Tab Component (`PaymentsTab.tsx`)

**Files:**
- Create: `src/components/admin/PaymentsTab.tsx`
- Create: `tests/PaymentsTab.test.tsx`

**Interfaces:**
- Consumes: `adminPayments.fetchPayments`
- Produces: `PaymentsTab` component

- [ ] **Step 1: Write failing test in `tests/PaymentsTab.test.tsx`**

Create `tests/PaymentsTab.test.tsx`:
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { PaymentsTab } from '../src/components/admin/PaymentsTab';
import { adminPayments } from '../src/services/adminPayments';

describe('PaymentsTab', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders metrics cards and transactions feed', async () => {
    vi.spyOn(adminPayments, 'fetchPayments').mockResolvedValue({
      connected: true,
      mode: 'live',
      summary: {
        totalRevenue: 154.5,
        orderCount: 8,
        averageOrderValue: 19.31,
      },
      transactions: [
        {
          id: 'cs_test_123',
          customerEmail: 'customer@gmail.com',
          amount: 28.0,
          currency: 'usd',
          status: 'paid',
          created: 1773000000000,
          giftNote: 'Happy Birthday Cierra!',
          items: [{ name: 'Chubby Bumblebee (Keychain)', quantity: 2, amount: 28.0 }],
        },
      ],
    });

    render(<PaymentsTab />);

    expect(screen.getByText(/Loading Stripe Payments/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('$154.50')).toBeInTheDocument();
      expect(screen.getByText('8')).toBeInTheDocument();
      expect(screen.getByText('customer@gmail.com')).toBeInTheDocument();
      expect(screen.getByText('Happy Birthday Cierra!')).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /Open Stripe Dashboard/i })).toHaveAttribute(
        'href',
        'https://dashboard.stripe.com'
      );
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/PaymentsTab.test.tsx`  
Expected: FAIL (cannot find module `src/components/admin/PaymentsTab`)

- [ ] **Step 3: Implement `PaymentsTab.tsx`**

Create `src/components/admin/PaymentsTab.tsx`:
- Header banner showing Stripe connection badge (Live Mode 🟢, Test Mode 🟡, Sandbox/Key Unset ⚪) and button to open Stripe Dashboard (`https://dashboard.stripe.com`).
- 3 summary cards with pastel accents: Total Revenue, Completed Orders, Average Basket.
- Orders feed table:
  - Date & Time
  - Customer Email
  - Amount
  - Status badge (`Paid`, `Pending`, `Failed`)
  - Items summary
  - Gift message pill if present
- Refresh button to reload data on demand.
- Error banner if fetch fails.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/PaymentsTab.test.tsx`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/admin/PaymentsTab.tsx tests/PaymentsTab.test.tsx
git commit -m "feat: implement PaymentsTab component with metrics, status badge, and orders feed"
```

---

### Task 5: Storefront Announcement Banner & ContentTab Extension

**Files:**
- Create: `src/components/AnnouncementBanner.tsx`
- Create: `src/components/admin/ContentTab.tsx`
- Create: `tests/AnnouncementBanner.test.tsx`
- Create: `tests/ContentTab.test.tsx`

**Interfaces:**
- Consumes: `SiteSettings`, `useSettings`
- Produces: `AnnouncementBanner`, `ContentTab` components

- [ ] **Step 1: Write failing tests for AnnouncementBanner and ContentTab**

`tests/AnnouncementBanner.test.tsx`:
```typescript
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { AnnouncementBanner } from '../src/components/AnnouncementBanner';

describe('AnnouncementBanner', () => {
  it('renders message when enabled and text is present', () => {
    render(<AnnouncementBanner banner={{ enabled: true, text: '🌸 Fall Restock is live!' }} />);
    expect(screen.getByText(/Fall Restock is live!/i)).toBeInTheDocument();
  });

  it('renders nothing when disabled or empty text', () => {
    const { container } = render(<AnnouncementBanner banner={{ enabled: false, text: 'Sale!' }} />);
    expect(container.firstChild).toBeNull();
  });
});
```

`tests/ContentTab.test.tsx`:
Verifies editing announcement banner toggle and text, studio emails, and social links, calling `onSave(updatedSettings)`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/AnnouncementBanner.test.tsx tests/ContentTab.test.tsx`  
Expected: FAIL

- [ ] **Step 3: Implement `AnnouncementBanner.tsx` and `ContentTab.tsx`**

Create `src/components/AnnouncementBanner.tsx`:
- Render at top of page when `banner.enabled && banner.text.trim()`.
- Hello Kitty pastel gradient (`bg-gradient-to-r from-pink-400 via-rose-300 to-pink-400 text-white font-bubble text-xs py-2 px-4 shadow-xs text-center flex items-center justify-center gap-2`).

Create `src/components/admin/ContentTab.tsx`:
- Section 1: Homepage Announcement Bar (toggle switch, text input with placeholder).
- Section 2: Studio Notification Emails (General Contact Email, Custom Order Notification Email).
- Section 3: Social Media Links (TikTok, Instagram, Facebook Marketplace).
- Save & Publish Settings CTA button calling `onSave`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/AnnouncementBanner.test.tsx tests/ContentTab.test.tsx`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/AnnouncementBanner.tsx src/components/admin/ContentTab.tsx tests/AnnouncementBanner.test.tsx tests/ContentTab.test.tsx
git commit -m "feat: implement AnnouncementBanner storefront component and ContentTab admin editor"
```

---

### Task 6: AdminPortal 4-Tab Dashboard Assembly, Routing & Full Smoke Tests

**Files:**
- Modify: `src/components/admin/AdminPortal.tsx`
- Modify: `src/App.tsx`
- Modify: `tests/AdminPortal.test.tsx`
- Modify: `tests/smoke.test.ts`

**Interfaces:**
- Consumes: `AdminsTab`, `InventoryTab`, `PaymentsTab`, `ContentTab`, `AnnouncementBanner`
- Produces: 4-tab unified Admin Portal and storefront announcement banner rendering

- [ ] **Step 1: Write integration tests in `tests/AdminPortal.test.tsx` for 4-tab switching**

Update `tests/AdminPortal.test.tsx` to verify switching between all 4 tabs:
- "Manage Admins"
- "Manage Catalog"
- "Manage Payments"
- "Manage Site Content"

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/AdminPortal.test.tsx`  
Expected: FAIL (missing tabs)

- [ ] **Step 3: Update `AdminPortal.tsx` and `App.tsx`**

In `src/components/admin/AdminPortal.tsx`:
- Add 4-tab pill navigation:
  - `activeTab === 'admins'` -> `<AdminsTab admins={settings.admins || []} currentAdminEmail={session.email} onSave={handleSaveAdmins} />`
  - `activeTab === 'catalog'` -> `<InventoryTab products={products} onSave={handleSaveInventory} />`
  - `activeTab === 'payments'` -> `<PaymentsTab />`
  - `activeTab === 'content'` -> `<ContentTab settings={settings} onSave={handleSaveSettings} />`
- Wire `handleSaveAdmins` to call `adminApi.saveAdmins` and update `settings.admins`.

In `src/App.tsx`:
- Render `<AnnouncementBanner banner={settings.announcementBanner} />` directly above `<Navbar />`.

- [ ] **Step 4: Run full test suite and production build**

Run: `npm test && npm run build`  
Expected: All 18+ test files pass, 100% green tests, and production build succeeds with 0 errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/admin/AdminPortal.tsx src/App.tsx tests/AdminPortal.test.tsx tests/smoke.test.ts
git commit -m "feat: assemble 4-tab admin portal with Stripe hub, admin management, and announcement banner"
```
