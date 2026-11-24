# Admin Email Notifications Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Email all site administrators via Gmail SMTP (from `weeblesclay@gmail.com`) whenever a Stripe purchase succeeds or a custom Weeble order request is submitted.

**Architecture:** A shared helper (`netlify/functions/_lib/email.ts`) resolves all admin emails from persisted settings (`settings.admins`, falling back to `getAllowedAdmins()`) and sends HTML + plain-text emails through Nodemailer Gmail SMTP (`GMAIL_USER` + `GMAIL_APP_PASSWORD`). Two Netlify Functions consume it: `stripe-webhook.ts` (verified with `STRIPE_WEBHOOK_SECRET`, deduplicated via Netlify Blobs) for purchases, and `custom-order.ts` (called by `CustomOrderModal.tsx` with optional base64 reference photo attachment) for custom order requests.

**Tech Stack:** TypeScript, React, Vite, Netlify Functions, Stripe Node SDK (`^22.0.0`), Nodemailer, Vitest.

## Global Constraints

- Recipients must come from the site's Admin Portal admin list (`settings.admins`, falling back to `getAllowedAdmins()` when empty/missing).
- All outgoing emails authenticate via Gmail SMTP (`GMAIL_USER`, defaulting to `weeblesclay@gmail.com` when `GMAIL_APP_PASSWORD` is configured, and `GMAIL_APP_PASSWORD`).
- All customer-supplied values must be HTML-escaped before interpolating into HTML email templates.
- Reference photo attachments on custom order requests must be validated as `image/(png|jpeg|jpg|webp|gif)` and `<= 4 MB`.
- Shared helper lives in `netlify/functions/_lib/email.ts` so Netlify does not expose it as a public endpoint.

---

### Task 1: Shared Gmail Email Utility (`netlify/functions/_lib/email.ts`)
- Export `escapeHtml`, `resolveAdminNotificationRecipients`, `sendAdminEmail`.
- Export `saveToNetlifyBlobs` and `readFromNetlifyBlobs` from `netlify/functions/admin-save.ts` for webhook deduplication.
- Unit tests in `tests/emailService.test.ts`.

### Task 2: Stripe Purchase Webhook (`netlify/functions/stripe-webhook.ts`)
- Verify `stripe-signature` against raw/base64 body using `STRIPE_WEBHOOK_SECRET`.
- Handle `checkout.session.completed` and `checkout.session.async_payment_succeeded` when `payment_status === 'paid'`.
- Fetch line items, deduplicate via Netlify Blobs (`notified-order:${session.id}`), build formatted order email with gift note, address, items, total, and `Reply-To`, and send to all admins.
- Unit tests in `tests/stripeWebhook.test.ts`.

### Task 3: Custom Order Request Function & Modal (`netlify/functions/custom-order.ts`, `src/components/CustomOrderModal.tsx`)
- Validate `name`, `email`, `finish`, `description`, and optional `referencePhoto` (MIME type + 4 MB cap).
- Email all admins with `Reply-To` set to customer email and optional image attachment.
- Update `CustomOrderModal.tsx` to POST JSON to `/.netlify/functions/custom-order`, keep Netlify Forms POST `/` as non-blocking backup, validate photo size client-side, and surface server/validation errors cleanly.
- Unit tests in `tests/customOrderFunction.test.ts` and updated `tests/CustomOrderModal.test.tsx`.

### Task 4: Docs, Verification, and Push
- Update `.env.example` and `STRIPE_INTEGRATION_TODO.md` with Gmail SMTP and Stripe Webhook setup steps.
- Run `npm run build` and `npx vitest run --exclude ".worktrees/**"`.
- Commit and push changes to `origin/master`.
