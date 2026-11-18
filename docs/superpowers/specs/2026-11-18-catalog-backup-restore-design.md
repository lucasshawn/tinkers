# Specification: Daily Catalog & Configuration Backup and Restore (3-Day Retention)

- **Date:** 2026-11-18
- **Status:** Approved
- **Target Platform:** Netlify (Vite + React + TypeScript + Serverless Functions)

---

## 1. Overview & Objectives

To protect the live Weebles store against accidental deletions, bad edits, or storage glitches, the Admin Portal (`/admin`) will maintain automatic daily backups of **all store configuration and catalog data** (`products` and `settings`) with a **3-day retention window**, alongside manual JSON download (export) and file upload/local snapshot restore capabilities.

Key capabilities:
1. **Automatic Daily Snapshots (Full Catalog + Config):**
   - Captures a complete snapshot of `products` (all catalog items, stock counts, variants, prices, images, timestamps) and `settings` (announcement banner, contact emails, social links, authorized admin whitelist).
   - Automatically records a daily snapshot (keyed by calendar date `YYYY-MM-DD` in UTC/local ISO date) when the admin portal loads or before the first destructive/modifying save of the day.
2. **3-Day Automatic Aging / Retention:**
   - Daily backups older than **3 days** are automatically pruned on every read and write operation, keeping storage compact while guaranteeing a 3-day rollback window.
3. **Downloadable JSON Backups:**
   - Administrators can download the current live store state or any of the saved daily backups as a formatted `.json` file (`weebles-backup-YYYY-MM-DD.json`) to inspect, archive offline, or edit manually.
4. **Flexible Restore (Saved Daily Snapshot or Uploaded JSON File):**
   - Administrators can choose to restore **Everything (Catalog + Site Config)** (default) or **Catalog Only**.
   - Restore can be triggered either from one of the **Saved Daily Backups** in the portal or by **Uploading a `.json` Backup File** from disk.

---

## 2. Data Model & Retention Logic (`src/utils/backupUtils.ts`)

### 2.1 Backup Snapshot Schema
```typescript
import { Product } from '../types';
import { SiteSettings } from '../types/settings';

export interface WeeblesBackupSnapshot {
  version: 1;
  dateKey: string; // 'YYYY-MM-DD'
  createdAt: string; // ISO 8601 timestamp
  label: string; // e.g. 'Daily Backup (2026-11-18)'
  products: Product[];
  settings: SiteSettings;
}

export type RestoreScope = 'all' | 'catalog-only';
```

### 2.2 3-Day Retention Rule (`pruneExpiredBackups`)
- `BACKUP_RETENTION_DAYS = 3` (`3 * 24 * 60 * 60 * 1000` ms).
- Given a list of `WeeblesBackupSnapshot[]` and a reference timestamp `nowMs = Date.now()`:
  1. Parse each snapshot's `createdAt` timestamp (or `dateKey` if `createdAt` is missing).
  2. Filter out any snapshot where `nowMs - snapshotTimeMs > 3 * 24 * 60 * 60 * 1000`.
  3. Deduplicate by `dateKey` (keeping the latest snapshot for each `dateKey`, sorted newest first) and cap at 3 daily entries.

### 2.3 Validation & Parsing (`parseBackupJson`)
- Accepts a JSON string (from an uploaded `.json` file).
- Supports either:
  - A full `WeeblesBackupSnapshot` object containing `{ products: Product[], settings?: SiteSettings }`, or
  - A raw `Product[]` array (for backward compatibility if an admin uploads a raw `products.json` file).
- Validates that `products` is an array where each item has a valid string `id`, string `name`, numeric `price`, and `images` array.
- Throws a descriptive validation error if the JSON is malformed or missing required product fields.

---

## 3. Storage & Backend Architecture

### 3.1 Dual-Layer Persistence
1. **Browser Persistence (`localStorage` key `weebles_backups_v1`):**
   - Stores the pruned array of `WeeblesBackupSnapshot[]`.
   - Helper `ensureDailyBackup(products, settings, now?)`:
     - Loads existing stored backups, prunes entries older than 3 days, and checks if a snapshot for today's `dateKey` (`YYYY-MM-DD`) already exists.
     - If no snapshot exists for today, prepends a new `WeeblesBackupSnapshot` for today, saves to `localStorage`, and returns the updated list.
   - Helper `createManualBackupSnapshot(products, settings, now?)`:
     - Creates or overwrites today's snapshot with the current live `products` and `settings`.
2. **Serverless Function Persistence (`netlify/functions/admin-save.ts`):**
   - `TMP_BACKUPS_FILE = 'weebles-backups.json'` and Netlify Blobs key `'backups'`.
   - `loadPersistedBackups(event)` loads saved backups from Netlify Blobs -> `os.tmpdir()` -> local `src/data/backups.json` (if present), and runs `pruneExpiredBackups` to age out backups older than 3 days.
   - Before applying any `POST` update (`inventory`, `settings`, `admins`), `admin-save.ts` automatically ensures a daily backup of the pre-change state exists for today's `dateKey` and saves the pruned backup list.
   - Supports `type: 'restore'` with `{ products, settings, scope: 'all' | 'catalog-only' }`:
     - Atomically persists the restored `products` (and `settings` when `scope === 'all'`) to Netlify Blobs, GitHub (if `GITHUB_TOKEN` is configured), and local/`/tmp` fallback.
   - `GET /.netlify/functions/admin-save?action=load` includes `backups` in its JSON response `{ products, settings, backups }`.

---

## 4. Admin Portal UI Components

### 4.1 `BackupRestoreModal.tsx` (`src/components/admin/BackupRestoreModal.tsx`)
A modal accessible via a **`💾 Backup & Restore`** button in the action bar of `InventoryTab.tsx` (and `ContentTab.tsx`):

1. **Header & Current Live State Export Card:**
   - Displays current active catalog count and config summary.
   - **`⬇ Download Backup (.json)`** button: Triggers browser file download of `weebles-backup-YYYY-MM-DD.json` containing the current live `products` and `settings`.
   - **`📸 Update Today's Snapshot`** button: Immediately updates today's saved backup snapshot with the current live state.
2. **Restore Scope Selector:**
   - Two selectable pills/radio options:
     - **`Restore Everything (Catalog + Site Config)`** (default)
     - **`Restore Catalog Only (Keep Current Site Config)`**
3. **Saved Daily Backups List (Auto-pruned after 3 days):**
   - Lists each available daily snapshot (`dateKey`, formatted timestamp, product count).
   - Each row provides:
     - **`⬇ Download JSON`**: Downloads that specific snapshot as `weebles-backup-<dateKey>.json`.
     - **`↺ Restore`**: Confirms with the admin (`window.confirm`), then invokes `onRestore(snapshot, scope)`.
4. **Restore from Uploaded JSON File:**
   - File input (`accept=".json,application/json"`) allowing the admin to pick a local `.json` backup file.
   - Parses and validates the file via `parseBackupJson`.
   - Shows a validation error banner if invalid, or a green preview card showing the file's product count, date, and whether site config is included, along with a **`↺ Restore Uploaded Backup`** button.

---

## 5. Testing & Verification Plan

1. **Unit Tests (`tests/backupUtils.test.ts`):**
   - Verify `pruneExpiredBackups` retains snapshots within 3 days and removes snapshots older than 3 days.
   - Verify `ensureDailyBackup` creates a snapshot once per day (`dateKey`) without overwriting earlier pre-change snapshots from the same day, while `createManualBackupSnapshot` updates today's snapshot.
   - Verify `parseBackupJson` accepts valid full backup JSON and raw product arrays, and rejects malformed JSON or invalid product schemas.
2. **Component Tests (`tests/BackupRestoreModal.test.tsx` & `tests/AdminPortal.test.tsx`):**
   - Verify opening the Backup & Restore modal from the catalog tab.
   - Verify downloading a backup JSON file.
   - Verify restoring from a saved daily backup (both `all` and `catalog-only` scopes).
   - Verify uploading a valid/invalid `.json` backup file and restoring from it.
3. **Backend Function Tests (`tests/adminApi.test.ts`):**
   - Verify `admin-save` automatically captures a daily backup and prunes backups older than 3 days.
   - Verify `type: 'restore'` restores catalog and settings and returns `200 OK`.
