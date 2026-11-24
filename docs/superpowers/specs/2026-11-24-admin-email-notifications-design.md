# Admin Email Notifications Design

**Date:** 2026-11-24
**Status:** Draft for Review

## Overview

Send email notifications to **all site administrators** whenever:
1. A customer completes a Stripe purchase (`checkout.session.completed` / `checkout.session.async_payment_succeeded` with `payment_status === 'paid'`).
2. A customer submits a custom Weeble request via the storefront's **Custom Order** modal.

Emails are sent through **Gmail SMTP via Nodemailer** (no custom domain required) from Netlify Functions, with `Reply-To` set to the customer's email so any admin can reply directly.

## Goals & Non-Goals

### Goals
- Email every site admin configured in persisted site settings (`settings.admins`, falling back to `getAllowedAdmins()` when empty/missing).
- Send all outgoing notifications from `GMAIL_USER` (defaulting to `weeblesclay@gmail.com` when configured) via Gmail SMTP (`GMAIL_APP_PASSWORD`).
- Reliably deliver purchase notifications server-to-server via a verified Stripe Webhook, even if the customer closes their browser before reaching `/order-success`.
- Prevent duplicate purchase notification emails when Stripe retries webhook delivery.
- Email admins immediately when a custom order request is submitted, including any optional reference photo as an email attachment, while preserving Netlify Forms submission as a non-blocking backup log.
- Escape all user-supplied text before rendering into HTML email bodies.
- Keep local development and automated tests working cleanly when SMTP env vars are absent.

### Non-Goals
- Sending customer-facing order confirmation emails (Stripe already sends customer receipts).
- Building an email template editor or per-admin notification toggle UI in the Admin Portal.
- Supporting multiple email providers simultaneously (only Gmail SMTP via Nodemailer).

## Architecture

### 1. Shared Email Utility (`netlify/functions/_lib/email.ts`)

Placed under `_lib/` so Netlify does not deploy it as a public HTTP function endpoint.

**Responsibilities:**
- **`resolveAdminNotificationRecipients(event)`**:
  - Loads live settings via `loadPersistedSettings(event)`.
  - Uses `settings.admins` when it is a non-empty array; otherwise falls back to `getAllowedAdmins()`.
  - Trims, lowercases, filters to valid email-shaped strings, and deduplicates.
- **`escapeHtml(value)`**:
  - Escapes `&`, `<`, `>`, `"`, `'` for all interpolated user fields.
- **`sendAdminEmail({ to, subject, text, html, replyTo, attachments })`**:
  - Reads `process.env.GMAIL_USER` and `process.env.GMAIL_APP_PASSWORD` (and optional `process.env.EMAIL_FROM_NAME`, defaulting to `Weebles Studio`).
  - If `GMAIL_USER` or `GMAIL_APP_PASSWORD` is missing, logs a warning and returns `{ sent: false, skipped: true, reason: 'missing_config' }` without throwing.
  - If `to` is empty, logs a warning and returns `{ sent: false, skipped: true, reason: 'no_recipients' }`.
  - Creates a Nodemailer Gmail SMTP transport (`service: 'gmail'`, `auth: { user, pass }`) and sends the message with `from: "${fromName}" <${gmailUser}>`, `to: recipients.join(', ')`, optional `replyTo`, `subject`, `text`, `html`, and optional `attachments`.

### 2. Purchase Notification Webhook (`netlify/functions/stripe-webhook.ts`)

**Endpoint:** `POST /.netlify/functions/stripe-webhook`

**Flow:**
1. Reject non-POST requests with `405 Method Not Allowed`.
2. Require `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET`; return `500` with a clear error message if missing.
3. Require the `stripe-signature` (or `Stripe-Signature`) header; return `400` if absent.
4. Reconstruct the exact raw body (`event.isBase64Encoded ? Buffer.from(event.body || '', 'base64') : (event.body || '')`) and verify with `stripe.webhooks.constructEvent(rawBody, signature, webhookSecret)`. Return `400` on signature verification failure.
5. Handle `checkout.session.completed` and `checkout.session.async_payment_succeeded`:
   - Ignore sessions where `session.payment_status !== 'paid'` (return `200 { received: true, skipped: 'unpaid' }`).
   - **Deduplication:** Check Netlify Blobs (reusing the Blobs pattern from `admin-save.ts`, exported via helper or shared Blobs helper) for key `notified-order:${session.id}`. If already recorded, return `200 { received: true, duplicate: true }`.
   - Fetch line items via `stripe.checkout.sessions.listLineItems(session.id, { limit: 100 })` (falling back gracefully if unavailable).
   - Resolve all admin recipients via `resolveAdminNotificationRecipients(event)`.
   - Build HTML + plain-text email containing:
     - **Subject:** `New Weebles Order! ${formattedTotal} from ${customerLabel}`
     - Order total and currency
     - Customer name & email (also set as `replyTo` when present)
     - Itemized table/list: item description (includes Weeble name & variant), quantity, line total
     - Gift note (`session.metadata?.giftNote`), when non-empty
     - Billing/shipping address summary, when present on `session.customer_details?.address` or `session.collected_information?.shipping_details?.address`
     - Stripe Checkout Session ID and timestamp
   - Send via `sendAdminEmail(...)`.
   - If sent successfully, record `notified-order:${session.id}` in Netlify Blobs (best-effort; non-fatal if Blobs is unavailable locally).
6. For any other Stripe event types, return `200 { received: true, ignored: true }`.
7. If sending the email fails unexpectedly (SMTP error), return `500` so Stripe retries webhook delivery automatically.

### 3. Custom Order Notification (`netlify/functions/custom-order.ts` + `src/components/CustomOrderModal.tsx`)

**Endpoint:** `POST /.netlify/functions/custom-order`

**Request payload (JSON):**
```ts
interface CustomOrderRequestBody {
  name: string;
  email: string;
  finish: 'magnet' | 'keychain' | 'figurine' | string;
  description: string;
  referencePhoto?: {
    filename: string;
    contentType: string;
    base64: string; // raw base64 payload without data: prefix
  };
}
```

**Server-side (`netlify/functions/custom-order.ts`):**
1. Reject non-POST requests with `405`.
2. Parse JSON body and validate:
   - `name`, `email`, `description` are non-empty trimmed strings (return `400` if missing).
   - `email` matches basic email syntax (return `400` if invalid).
   - `finish` defaults to `'magnet'` if omitted; allowed values or trimmed short string.
   - Optional `referencePhoto`:
     - Must have `contentType` matching `^image\/(png|jpe?g|webp|gif)$`.
     - Decoded byte size must be `<= 4 * 1024 * 1024` (4 MB) to stay safely under Netlify Functions' 6 MB payload limit.
     - Sanitize `filename` to safe basename characters.
     - Return `400` if an invalid or oversized attachment is supplied.
3. Resolve all admin recipients via `resolveAdminNotificationRecipients(event)`.
4. Build HTML + plain-text email containing:
   - **Subject:** `New Custom Weeble Request from ${name} (${finishLabel})`
   - Customer name & email (`replyTo` set to customer email)
   - Preferred finish (Magnet / Keychain / Figurine)
   - Full vision description
   - Note if a reference photo is attached, plus attach the decoded `Buffer` in Nodemailer `attachments`
5. Call `sendAdminEmail(...)`. Return `200 { ok: true, emailed: result.sent }` on success (or graceful skip when SMTP is unconfigured in local dev), and `500 { error: ... }` if SMTP delivery throws an error.

**Client-side (`src/components/CustomOrderModal.tsx`):**
- On submit:
  1. Read form fields (`name`, `email`, `finish`, `description`) and optional `reference_photo` file.
  2. If a `reference_photo` file is selected, validate size (`<= 4 MB`) client-side with a friendly inline error before submitting, and read it as base64 via `FileReader`.
  3. Send `POST /.netlify/functions/custom-order` with JSON payload.
  4. Fire-and-forget the existing Netlify Forms `POST /` with `FormData` as a non-blocking backup log (never blocking or failing the user if `/` fails in local dev).
  5. If `/.netlify/functions/custom-order` returns a non-OK error response, display an inline error banner in the modal instead of falsely showing "Request Sent!". (Keep graceful offline/dev behavior cleanly tested.)

## Environment Variables & Setup

Add to [.env.example](../../../.env.example) and document in [STRIPE_INTEGRATION_TODO.md](../../../STRIPE_INTEGRATION_TODO.md):

| Variable | Scope | Purpose |
|----------|-------|---------|
| `GMAIL_USER` | Netlify Functions | Gmail address sending notifications (e.g., `weeblesclay@gmail.com`) |
| `GMAIL_APP_PASSWORD` | Netlify Functions | 16-character Google App Password (requires 2-Step Verification on the Google account) |
| `EMAIL_FROM_NAME` | Netlify Functions *(optional)* | Display name for outgoing emails (defaults to `Weebles Studio`) |
| `STRIPE_WEBHOOK_SECRET` | Netlify Functions | Webhook signing secret (`whsec_...`) for `https://weebleweb.netlify.app/.netlify/functions/stripe-webhook` |

**Stripe Dashboard Webhook Setup:**
- Endpoint URL: `https://weebleweb.netlify.app/.netlify/functions/stripe-webhook`
- Events to listen for: `checkout.session.completed`, `checkout.session.async_payment_succeeded`

## Dependencies

- Add `nodemailer` (and `@types/nodemailer` in `devDependencies`) to `package.json`.

## Testing Strategy

1. **`tests/emailService.test.ts`**:
   - Recipient resolution from `settings.admins`, fallback to `getAllowedAdmins()`, merging `ALLOWED_ADMIN_EMAILS`, deduplication.
   - HTML escaping for XSS/special characters.
   - Nodemailer transport call with `from`, `to`, `replyTo`, `subject`, `text`, `html`, `attachments`.
   - Graceful skip when `GMAIL_USER` or `GMAIL_APP_PASSWORD` is missing.
2. **`tests/stripeWebhook.test.ts`**:
   - 405 for non-POST, 400 for missing/invalid Stripe signature, 500 when webhook secret is missing.
   - Ignores unrelated event types and unpaid sessions (`payment_status !== 'paid'`).
   - Handles `checkout.session.completed` with `payment_status: 'paid'`, fetches line items, includes gift note and customer details, sets `Reply-To`, emails all admins.
   - Handles base64-encoded Netlify event body.
   - Deduplicates already-notified session IDs via Netlify Blobs.
   - Returns 500 when SMTP fails so Stripe retries.
3. **`tests/customOrderFunction.test.ts`**:
   - 405 for non-POST, 400 for missing required fields, invalid email, unsupported image MIME type, or oversized attachment (> 4 MB).
   - Sends formatted email with `Reply-To` and optional image attachment to all admins.
4. **`tests/CustomOrderModal.test.tsx`**:
   - Submits JSON payload to `/.netlify/functions/custom-order` (including base64 photo when attached).
   - Displays inline error when server returns an error or photo exceeds 4 MB.
   - Keeps existing modal UX, Escape close, and confirmation screen working.
