# Weebles Studio Admin: Changes & Error Audit Log Specification

- **Date:** 2026-11-18
- **Status:** Approved
- **Target Platform:** Netlify (Vite + React + TypeScript + Netlify Functions)
- **Visual Design:** Hello Kitty inspired feminine pastel theme (`bg-white rounded-3xl border-2 border-pink-200`, matching existing Admin Portal tabs)

---

## 1. Overview & Objectives

Provide a simple, persistent, line-by-line audit log in the Admin Portal that records every change made and any error encountered when an admin attempts an action:

1. **Top Navigation Tab:** Add a 5th tab button (`📋 Changes`) in the Admin Portal top navigation bar (`src/components/admin/AdminPortal.tsx`).
2. **Line-by-Line Change Tracking:** Record who (`who`), what (`what`), when (`timestamp`), old value (`oldValue`), and new value (`newValue`) in plain text. When saving an item or site settings where multiple fields changed at once, generate one row per modified field.
3. **Error Tracking:** Whenever an error occurs while an admin tries to perform an action (API save errors, validation errors in admin management, payment fetch errors, etc.), record a line in the log detailing who attempted it, what action failed, context/old state, and the error message.
4. **Sortable 5-Column View:** Render a table with 5 individually sortable columns (**When**, **Who**, **What**, **Old**, **New**). Clicking any column header toggles ascending/descending sort. **When** displays date and time in local time (`toLocaleString()`) and sorts chronologically by timestamp.
5. **Preserved Persistence:** Persist change log entries immediately in `localStorage` and via `/.netlify/functions/admin-save` (Netlify Blobs `changes` key, `src/data/changes.json`, and `/tmp/weebles-changes.json` fallback) so entries are preserved across reloads and sessions.

---

## 2. Data Model

### 2.1 `ChangeLogEntry` Interface (`src/types/changes.ts` & `src/types/index.ts`)

```typescript
export interface ChangeLogEntry {
  id: string;
  timestamp: string; // ISO 8601 string, e.g. "2026-11-18T17:45:00.000Z"
  who: string;       // Admin email, e.g. "lucasshawn@gmail.com"
  what: string;      // Plain text description of field/action
  oldValue: string;  // Plain text previous value or attempted input
  newValue: string;  // Plain text new value or "ERROR: <message>"
}
```

### 2.2 Initial Seed File (`src/data/changes.json`)
Initialize `src/data/changes.json` as an empty JSON array `[]`.

---

## 3. Diffing & Log Generation (`src/utils/changeLogUtils.ts`)

### 3.1 Local Storage Helpers
- Storage key: `CHANGES_STORAGE_KEY = 'weebles_changes_log_v1'`
- `getStoredChanges(defaults: ChangeLogEntry[] = []): ChangeLogEntry[]`
- `saveStoredChanges(entries: ChangeLogEntry[]): void`
- `mergeChanges(existing: ChangeLogEntry[], incoming: ChangeLogEntry[]): ChangeLogEntry[]` (deduplicates by `id` and sorts newest first by default).

### 3.2 Field-by-Field Diffing Helpers
All diff helpers accept `(who: string, oldState, newState, nowIso?: string): ChangeLogEntry[]`:

1. **`diffInventoryChanges(who: string, oldProducts: Product[], newProducts: Product[], nowIso?: string): ChangeLogEntry[]`**
   - **Added Product:** Product `id` present in `newProducts` but not `oldProducts`:
     - `what`: `"Added Weeble: <product.name>"`
     - `oldValue`: `"(none)"`
     - `newValue`: `"Price: $<price>, Category: <category>, Stock: <stockCount> (<inStock ? 'in stock' : 'sold out'>)"`
   - **Deleted Product:** Product `id` present in `oldProducts` but not `newProducts`:
     - `what`: `"Deleted Weeble: <product.name>"`
     - `oldValue`: `"Price: $<price>, Category: <category>, Stock: <stockCount>"`
     - `newValue`: `"(deleted)"`
   - **Edited Product:** Product `id` present in both `oldProducts` and `newProducts`. Compare each field and emit one `ChangeLogEntry` per changed field (`what: "Weeble '<oldProduct.name>' - <Field Label>"`):
     - `name`: `"Name"` (`old.name` -> `new.name`)
     - `description`: `"Description"` (`old.description` -> `new.description`)
     - `price`: `"Price"` (`formatPrice(old.price)` -> `formatPrice(new.price)`)
     - `category`: `"Category"` (`old.category` -> `new.category`)
     - `stockCount`: `"Stock Count"` (`String(old.stockCount)` -> `String(new.stockCount)`)
     - `inStock`: `"In Stock"` (`String(old.inStock)` -> `String(new.inStock)`)
     - `isOneOfAKind`: `"1-of-1"` (`String(Boolean(old.isOneOfAKind))` -> `String(Boolean(new.isOneOfAKind))`)
     - `featured`: `"Featured"` (`String(Boolean(old.featured))` -> `String(Boolean(new.featured))`)
     - `availableVariants`: `"Available Styles"` (`old.availableVariants.join(', ')` -> `new.availableVariants.join(', ')`)
     - `images[0]`: `"Product Photo"` (`old.images[0] || '(none)'` -> `new.images[0] || '(none)'`)

2. **`diffSettingsChanges(who: string, oldSettings: SiteSettings, newSettings: SiteSettings, nowIso?: string): ChangeLogEntry[]`**
   - Compare each site content field and emit one `ChangeLogEntry` per changed field:
     - `announcementBanner.enabled`: `what: "Site Content - Announcement Banner Enabled"`, `String(Boolean(old))` -> `String(Boolean(new))`
     - `announcementBanner.text`: `what: "Site Content - Announcement Banner Text"`, `old || '(empty)'` -> `new || '(empty)'`
     - `contactEmail`: `what: "Site Content - General Contact Email"`, `old` -> `new`
     - `customOrderEmail`: `what: "Site Content - Custom Order Email"`, `old` -> `new`
     - `socials.tiktok`: `what: "Site Content - TikTok URL"`, `old || '(empty)'` -> `new || '(empty)'`
     - `socials.instagram`: `what: "Site Content - Instagram URL"`, `old || '(empty)'` -> `new || '(empty)'`
     - `socials.facebookMarketplace`: `what: "Site Content - Facebook Marketplace URL"`, `old || '(empty)'` -> `new || '(empty)'`

3. **`diffAdminsChanges(who: string, oldAdmins: string[], newAdmins: string[], nowIso?: string): ChangeLogEntry[]`**
   - Normalize emails (`trim().toLowerCase()`).
   - For each added email:
     - `what`: `"Admin Whitelist - Added Admin"`
     - `oldValue`: `"(not authorized)"`
     - `newValue`: `<email>`
   - For each removed email:
     - `what`: `"Admin Whitelist - Removed Admin"`
     - `oldValue`: `<email>`
     - `newValue`: `"(removed)"`

4. **`createErrorLogEntry(who: string, action: string, attemptedValue: string, errorMessage: string, nowIso?: string): ChangeLogEntry`**
   - `what`: `"Error: <action>"`
   - `oldValue`: `attemptedValue || "-"`
   - `newValue`: `"ERROR: <errorMessage>"`

5. **`formatLocalTimestamp(isoString: string): string`**
   - Parses `isoString` with `new Date(isoString)` and formats in the user's local timezone using `toLocaleString()` (with fallback to the raw string if invalid).

---

## 4. Backend & API Persistence

### 4.1 Netlify Function (`netlify/functions/admin-save.ts`)
- Add `TMP_CHANGES_FILE = 'weebles-changes.json'` and `loadPersistedChanges(event)` reading from Netlify Blobs (`'changes'`), `/tmp/weebles-changes.json`, or `src/data/changes.json` (fallback `[]`).
- Include `changes` in the `GET /.netlify/functions/admin-save?action=load` response: `{ products, settings, changes }`.
- When handling `POST /.netlify/functions/admin-save`:
  - Accept an optional `changes?: ChangeLogEntry[]` array on `inventory`, `settings`, and `admins` save payloads, as well as a standalone `type === 'changes'` payload for persisting error logs or standalone log entries.
  - Merge incoming `changes` entries with `loadPersistedChanges(event)` (deduplicating by `id`, keeping chronological order) and persist to Netlify Blobs (`'changes'`) and `src/data/changes.json` (with `/tmp` fallback, or GitHub commit if `GITHUB_TOKEN` is configured).

### 4.2 Client Service (`src/services/adminApi.ts`)
- Update `loadStoreData()` return type to include `changes?: ChangeLogEntry[]`.
- Allow passing `changes?: ChangeLogEntry[]` in `saveInventory`, `saveSettings`, and `saveAdmins`.
- Add `saveChanges(changes: ChangeLogEntry[]): Promise<{ success: boolean; message: string }>` to persist error entries or standalone log updates (best-effort, catching network errors silently so logging an error never throws an unhandled exception).

---

## 5. UI Components

### 5.1 `ChangesTab` Component (`src/components/admin/ChangesTab.tsx`)
- **Props:** `{ changes: ChangeLogEntry[] }`
- **Sorting State:**
  - `sortField`: `'timestamp' | 'who' | 'what' | 'oldValue' | 'newValue'` (default: `'timestamp'`)
  - `sortDirection`: `'asc' | 'desc'` (default: `'desc'`)
- **Column Headers:**
  - 5 clickable `<button>` headers inside `<th>`: **When**, **Who**, **What**, **Old**, **New**.
  - Clicking the active sort column toggles `asc` / `desc`.
  - Clicking a different column sorts by that column (`desc` for `timestamp`, `asc` for text columns `who`, `what`, `oldValue`, `newValue`).
  - `aria-sort="ascending" | "descending" | "none"` on `<th>` elements for accessibility and testing.
- **Row Rendering:**
  - **When:** `formatLocalTimestamp(entry.timestamp)` (local date & time, `whitespace-nowrap`).
  - **Who:** `entry.who`
  - **What:** `entry.what` (highlighted with rose badge/text if `entry.newValue.startsWith('ERROR:')` or `entry.what.startsWith('Error:')`).
  - **Old:** `entry.oldValue` (plain text).
  - **New:** `entry.newValue` (plain text; styled in rose red if it is an error entry).
- **Empty State:**
  - If `changes.length === 0`, display a friendly message: `"No changes recorded yet."`

### 5.2 `AdminPortal` Integration (`src/components/admin/AdminPortal.tsx`)
- Extend `AdminTab` union type: `'admins' | 'catalog' | 'payments' | 'content' | 'changes'`.
- Maintain `changes` state initialized from `getStoredChanges()`, and synced on mount when `adminApi.loadStoreData()` resolves.
- Helper `recordChanges(newEntries: ChangeLogEntry[])` updates `changes` state and `saveStoredChanges()`.
- Helper `recordError(action: string, attemptedValue: string, errorMessage: string)` creates an error entry via `createErrorLogEntry(session.email, action, attemptedValue, errorMessage)`, appends it locally via `recordChanges`, and calls `adminApi.saveChanges([entry])` best-effort.
- In `handleSaveInventory`, `handleSaveSettings`, and `handleSaveAdmins`:
  - Compute field-level diffs before updating state.
  - On success: append diff entries to `changes` state + `localStorage` and include them in the `adminApi.save*` call.
  - On error: call `recordError(...)` with the action name, target description, and error message.
- Pass an optional `onError?: (action: string, attemptedValue: string, errorMessage: string) => void` callback to `AdminsTab` and `PaymentsTab` so validation errors (e.g., invalid/duplicate admin email, trying to remove self) and payment fetch failures are also logged to the Changes tab.

---

## 6. Testing Strategy

1. **Unit Tests (`tests/changeLogUtils.test.ts`):**
   - `diffInventoryChanges`: detects added product, deleted product, and multiple individual field changes on an edited product as separate rows.
   - `diffSettingsChanges`: detects each modified site setting field as a separate row and ignores unchanged fields.
   - `diffAdminsChanges`: detects added and removed admin emails.
   - `createErrorLogEntry`: creates an error row with `ERROR: <message>`.
   - `formatLocalTimestamp`: returns a formatted local date/time string.
2. **Component Tests (`tests/ChangesTab.test.tsx`):**
   - Renders empty state when `changes` is empty.
   - Renders all 5 columns (**When**, **Who**, **What**, **Old**, **New**) with local time formatting.
   - Sorts by each of the 5 columns in both ascending and descending order when column headers are clicked.
   - Renders error entries clearly.
3. **Integration Tests (`tests/AdminPortal.test.tsx`, `tests/AdminsTab.test.tsx`, `tests/adminApi.test.ts`):**
   - Renders the new `Changes` tab in `AdminPortal` and switches to it.
   - Logs field-level changes when inventory, site content, or admins are saved.
   - Logs error entries when a save fails or when an admin action fails validation.
