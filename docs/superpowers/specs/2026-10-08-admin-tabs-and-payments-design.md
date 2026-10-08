# Weebles Studio Admin: 4-Tab Management Portal & Stripe Payment Hub Specification

- **Date:** 2026-10-08
- **Status:** Approved
- **Target Platform:** Netlify (Vite + React + TypeScript + Serverless Functions)
- **Visual Design:** Hello Kitty inspired feminine pastel theme (`weeble-pink`, `weeble-pinkBg`, `font-bubble` Fredoka, Quicksand, soft cards, pill badges)

---

## 1. Overview & Objectives

Expand the existing Weebles Studio administrative portal (`/admin`) into a unified, 4-tab dashboard enabling complete operational management of the online polymer clay figurine store:

1. **👥 Manage Admins:** View authorized admin accounts, add new administrator emails with validation, remove admins (with safety guards), and persist whitelist updates.
2. **🍓 Manage Catalog:** Full CRUD lifecycle for figurines (add, edit, delete Weebles), photo file upload/replacement with base64 encoding and path sanitization, pricing, descriptions, categories, style variants (Magnet vs. Keychain), stock counts, and 1-of-1 original flags.
3. **💳 Manage Payments:** Dedicated Stripe hub displaying account connection status (Live 🟢, Test 🟡, Sandbox/Unset ⚪), revenue and order summary cards, recent checkout transactions feed (customer email, amount, payment status, figurine line items, gift notes), and a direct link to the official Stripe Dashboard.
4. **🎨 Manage Site Content:** Storefront configuration including an optional homepage **Announcement Banner** (toggle on/off + custom text), studio contact email, custom order request email, and social media URLs (TikTok, Instagram, Facebook Marketplace).

---

## 2. Architecture & Navigation

### 2.1 Tab Layout & Header
The admin container ([`src/components/admin/AdminPortal.tsx`](file:///c:/Users/lucas/source/repos/tinkers/src/components/admin/AdminPortal.tsx)) provides a top navigation bar with 4 rounded pill buttons:
- `👥 Manage Admins` (`activeTab === 'admins'`)
- `🍓 Manage Catalog` (`activeTab === 'catalog'`)
- `💳 Manage Payments` (`activeTab === 'payments'`)
- `🎨 Manage Site Content` (`activeTab === 'content'`)

Header displays:
- Strawberry icon 🍓 & "Weebles Studio Admin" bubble branding
- Currently signed-in email address (`session.email`)
- "View Store" link (`/`)
- "Log Out" button invoking `adminAuth.logout()`

---

## 3. Tab Specifications

### 3.1 Tab 1: 👥 Manage Admins (`src/components/admin/AdminsTab.tsx`)
- **Current Admins List:**
  - Displays all authorized emails. Initial defaults: `lucasshawn@gmail.com` and `lucascierra24@gmail.com`.
  - Badges: `You (Active Session)` for the current user's email.
- **Add Administrator:**
  - Input field for new admin email.
  - Validates valid email format (e.g. Gmail / Google Workspace).
  - Normalizes email to lowercase.
  - Rejects duplicates.
  - Calls `onSave(updatedAdminList)` which calls `adminApi.saveAdmins(updatedList)`.
- **Remove Administrator:**
  - Trash icon button per non-current admin row.
  - Confirmation prompt before deletion.
  - **Safety Guards:**
    - Cannot delete oneself (`session.email`).
    - Cannot leave the admin list empty (minimum 1 administrator required at all times).
- **Backend Whitelist Sync:**
  - Both [`admin-auth.ts`](file:///c:/Users/lucas/source/repos/tinkers/netlify/functions/admin-auth.ts) and [`admin-save.ts`](file:///c:/Users/lucas/source/repos/tinkers/netlify/functions/admin-save.ts) read the authoritative list from `src/data/settings.json` (or `admins.json`), maintaining dynamic whitelist synchronization.

### 3.2 Tab 2: 🍓 Manage Catalog (`src/components/admin/InventoryTab.tsx`)
- **Search & Filter:** Instant search by name and description.
- **Item Summary Rows:** Image thumbnail, figurine name, formatted USD price (`formatPrice`), category badge, stock count, and badges (`⭐ 1-of-1`, `💤 Sold Out`).
- **Modal / Drawer Editor ([`WeebleEditorModal.tsx`](file:///c:/Users/lucas/source/repos/tinkers/src/components/admin/WeebleEditorModal.tsx)):**
  - Name, price, category dropdown (`sweets`, `animals`, `fantasy`, `mini-friends`), description.
  - **Photo Upload:** File input accepting `image/*`. Client converts to base64, cleans filenames (`replace(/[^a-zA-Z0-9._-]/g, '')`), updates preview, and commits to `public/images/products/`.
  - **Styles:** Checkboxes for `🧲 Refrigerator Magnet` (`magnet`) and `🔑 Keychain` (`keychain`).
  - **Stock Controls:** `inStock` toggle, `stockCount` numeric field, and `isOneOfAKind` toggle.
- **Delete Item:** Confirmation dialog before removing product from catalog.

### 3.3 Tab 3: 💳 Manage Payments (`src/components/admin/PaymentsTab.tsx`)
- **Stripe Connection Card:**
  - Badges:
    - 🟢 **Live Mode** (`mode: 'live'`): Stripe API key is active in production.
    - 🟡 **Test Mode** (`mode: 'test'`): Test API keys active.
    - ⚪ **Demo / Sandbox Mode** (`mode: 'demo'` or unset): Helpful banner explaining that `STRIPE_SECRET_KEY` can be added in Netlify environment variables, while providing realistic mock orders for previewing.
  - **Direct Dashboard CTA:** `"Open Stripe Dashboard ↗"` button linking to `https://dashboard.stripe.com` in a new browser tab.
- **Summary Metrics Cards:**
  - **Total Revenue ($)**: Total volume processed.
  - **Completed Orders**: Count of successful transactions.
  - **Average Basket ($)**: Average order value.
- **Recent Transactions Feed:**
  - Table of recent checkout sessions:
    - **Date & Time** (formatted nicely, e.g., `Oct 8, 2026, 2:15 PM`)
    - **Customer Email**
    - **Amount Paid** (e.g., `$28.00`)
    - **Payment Status** badge (`Paid`, `Pending`, `Failed`)
    - **Purchased Items** summary (e.g., `Chubby Bumblebee (Keychain) x1, Strawberry Bunny (Magnet) x1`)
    - **Gift Message**: Displays customer gift note if entered.
- **Serverless Endpoint ([`netlify/functions/admin-payments.ts`](file:///c:/Users/lucas/source/repos/tinkers/netlify/functions/admin-payments.ts)):**
  - Authenticates request using admin session Bearer token.
  - When `STRIPE_SECRET_KEY` is present, queries `stripe.checkout.sessions.list({ limit: 25, expand: ['data.line_items'] })`.
  - Aggregates metrics and returns structured payload.
  - When `STRIPE_SECRET_KEY` is absent, returns realistic mock orders with `mode: 'demo'`.

### 3.4 Tab 4: 🎨 Manage Site Content (`src/components/admin/ContentTab.tsx`)
- **Announcement Banner Configuration:**
  - `announcementBanner`: `{ enabled: boolean; text: string }`
  - Toggle switch: **Show Announcement Banner on Homepage**.
  - Text input: **Banner Message** (e.g., `"🌸 Fall Restock is live! Free shipping on orders over $35 🍓"`).
- **Studio Notification Emails:**
  - **General Contact Email** (inquiries displayed in footer).
  - **Custom Order Request Notification Email** (recipient for custom requests submitted through Netlify forms).
- **Social Media Exposure Links:**
  - **TikTok Profile URL**
  - **Instagram Profile URL**
  - **Facebook Marketplace URL**
- **Storefront Display ([`src/components/AnnouncementBanner.tsx`](file:///c:/Users/lucas/source/repos/tinkers/src/components/AnnouncementBanner.tsx)):**
  - Placed at the top of the storefront (`App.tsx`) above `Navbar`.
  - Rendered only when `settings.announcementBanner?.enabled` is true and text is non-empty.
  - Styled with soft pastel pink gradient, sparkles icon, and centered text.

---

## 4. Data Models & API Contracts

### 4.1 Extended Site Settings Model (`src/types/settings.ts`)
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

### 4.2 Payments API Payload (`src/types/payments.ts`)
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

### 4.3 Serverless Functions
- **`GET /.netlify/functions/admin-payments`**:
  - Headers: `Authorization: Bearer <token>`
  - Response: `PaymentsResponse`
- **`POST /.netlify/functions/admin-save`**:
  - Payload types:
    - `{ type: 'inventory', products: Product[], newImage?: ImagePayload }`
    - `{ type: 'settings', settings: SiteSettings }`
    - `{ type: 'admins', admins: string[] }`

---

## 5. Security & Verification

1. **Strict Admin Whitelist Gate:**
   - Evaluated dynamically in `admin-auth.ts` and `admin-save.ts` using the persisted admin list.
   - Initial root admins: `lucasshawn@gmail.com` and `lucascierra24@gmail.com`.
2. **HMAC SHA-256 Signed Sessions:**
   - All admin requests require a valid, non-expired signature.
3. **Stripe Secret Isolation:**
   - `STRIPE_SECRET_KEY` remains purely server-side in `netlify/functions`. No client-side exposure.
4. **Automated Testing:**
   - Unit tests for `AdminsTab`, `PaymentsTab`, `ContentTab`, `AnnouncementBanner`, `admin-payments.ts`, and `adminApi.ts`.
   - Smoke test verification for storefront announcement banner and full admin dashboard navigation.
