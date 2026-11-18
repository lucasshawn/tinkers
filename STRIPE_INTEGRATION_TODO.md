# Stripe Checkout Integration TODO

This file is the single source of truth for completing and going live with the Stripe Embedded Form Checkout integration.

## Values to Replace

The following values are placeholders and must be updated before going live.

> **Note on Checkout Session parameters:** Because this project already creates Checkout Sessions dynamically from the authoritative product catalog in [netlify/functions/create-checkout.ts](netlify/functions/create-checkout.ts), `mode` (`"payment"`) and `line_items` (built from catalog prices and variants) already use real, non-placeholder values and were preserved.

**Files containing placeholders:**
- [.env.example](.env.example)

| Field | Current Value | What to Set |
|-------|--------------|-------------|
| `VITE_STRIPE_PUBLISHABLE_KEY` | `pk_test_...` | Your Stripe Publishable Key from the [Stripe Dashboard API Keys](https://dashboard.stripe.com/test/apikeys). Must keep the `VITE_` prefix for Vite client access. |
| `STRIPE_SECRET_KEY` | `sk_test_...` | Your Stripe Secret Key from the [Stripe Dashboard API Keys](https://dashboard.stripe.com/test/apikeys). Must **not** use the `VITE_` prefix (server-only Netlify Function). |

## Configured Parameters

These parameters were configured in Checkout Studio and are already set correctly.

**Files containing these parameters:**
- [netlify/functions/create-checkout.ts](netlify/functions/create-checkout.ts)
- [src/services/stripe.ts](src/services/stripe.ts)

### Server-side Checkout Session Parameters

| Parameter | Value |
|-----------|-------|
| `ui_mode` | `"form"` |
| `mode` | `"payment"` *(preserved existing one-time payment mode)* |
| `billing_address_collection` | `"auto"` |
| `phone_number_collection` | `{ "enabled": false }` |
| `automatic_tax` | `{ "enabled": false }` |
| `submit_type` | `"auto"` |
| `integration_identifier` | `"custom_embedded_web_0001"` |
| `line_items` | Dynamic catalog line items *(preserved existing authoritative pricing)* |
| `return_url` | `` `${origin}/order-success?session_id={CHECKOUT_SESSION_ID}` `` |
| `apiVersion` | `"2026-03-25.dahlia"` |

> **Note on `payment_method_collection`:** Configured as `"always"` in Checkout Studio, but intentionally omitted from `stripe.checkout.sessions.create(...)` because `mode` is `"payment"` (Stripe only accepts `payment_method_collection` when `mode` is `"subscription"`). If you add recurring products and switch `mode` to `"subscription"`, include `payment_method_collection: "always"`.

### Client-side Appearance Configuration

Configured in [`STRIPE_APPEARANCE`](src/services/stripe.ts):
- `theme`: `"stripe"`
- `labels`: `"auto"`
- `inputs`: `"spaced"`
- `variables`: `borderRadius: "4px"`, `colorBackground: "#ffffff"`, `colorDanger: "#df1b41"`, `colorPrimary: "#0570de"`, `colorSuccess: "#00c853"`, `colorText: "#30313d"`, `fontFamily: "default"`, `fontSizeBase: "16px"`, `spacingUnit: "4px"`

## Setup Instructions

### 1. Environment Variables

Copy [.env.example](.env.example) to `.env` for local development (never commit `.env`):

```text
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_your_publishable_key
STRIPE_SECRET_KEY=sk_test_your_secret_key
```

For production on Netlify, configure the exact same variable names in **Site configuration → Environment variables**:
- `VITE_STRIPE_PUBLISHABLE_KEY` (exposed to Vite frontend at build time)
- `STRIPE_SECRET_KEY` (available only to Netlify Functions on the server)

### 2. Dependencies

The Stripe Node SDK has been upgraded to `stripe@^22.0.0` in [package.json](package.json) to support API version `2026-03-25.dahlia`. Run `npm install` if setting up a fresh clone.

Stripe.js is loaded directly from `https://js.stripe.com/dahlia/stripe.js` in [index.html](index.html) (never bundled or self-hosted, per PCI requirements).

## Project Structure

### New Files Created
- [src/components/CheckoutModal.tsx](src/components/CheckoutModal.tsx) — Modal dialog hosting `<div id="checkout-form" />`, initializing `stripe.initCheckoutFormSdk(...)`, mounting the expanded form, and handling `form.on('confirm', ...)` via `checkout.loadActions()`.
- [.env.example](.env.example) — Template documenting the required `VITE_STRIPE_PUBLISHABLE_KEY` and `STRIPE_SECRET_KEY` environment variables.
- [tests/CheckoutModal.test.tsx](tests/CheckoutModal.test.tsx) — Unit tests covering embedded form initialization, mounting, confirmation, error states, and cleanup.
- [STRIPE_INTEGRATION_TODO.md](STRIPE_INTEGRATION_TODO.md) — This setup and verification guide.

### Existing Files Updated
- [netlify/functions/create-checkout.ts](netlify/functions/create-checkout.ts) — Upgraded Stripe API version to `2026-03-25.dahlia`, updated `stripe.checkout.sessions.create(...)` with the Checkout Studio `ui_mode: "form"` parameters, and returned `{ client_secret: session.client_secret }`.
- [index.html](index.html) — Added `<script src="https://js.stripe.com/dahlia/stripe.js"></script>` in `<head>`.
- [src/services/stripe.ts](src/services/stripe.ts) — Updated `createCheckoutSession` response typing to `{ client_secret?: string; url?: string }` and exported `STRIPE_APPEARANCE`.
- [src/App.tsx](src/App.tsx) — Wired `handleCheckout` to open `CheckoutModal` when `client_secret` is returned (while preserving demo-mode URL fallback when `STRIPE_SECRET_KEY` is unset).
- [src/vite-env.d.ts](src/vite-env.d.ts) — Added TypeScript declarations for `VITE_STRIPE_PUBLISHABLE_KEY` and the Dahlia `window.Stripe` Checkout Form SDK.
- [package.json](package.json) — Upgraded `stripe` to `^22.0.0`.
- [tests/stripeService.test.ts](tests/stripeService.test.ts) & [tests/smoke.test.ts](tests/smoke.test.ts) — Updated assertions for the embedded form session parameters and `{ client_secret }` flow.

## How the Integration Works

1. Customer adds items to the cart, optionally enters a gift note in [src/components/CartDrawer.tsx](src/components/CartDrawer.tsx), and clicks **Checkout with Stripe**.
2. [src/App.tsx](src/App.tsx) calls `createCheckoutSession(items, giftNote)` in [src/services/stripe.ts](src/services/stripe.ts), sending a `POST` request to `/.netlify/functions/create-checkout`.
3. [netlify/functions/create-checkout.ts](netlify/functions/create-checkout.ts) validates inventory and computes authoritative prices from the catalog, calls `stripe.checkout.sessions.create(...)` with `ui_mode: "form"` on API version `2026-03-25.dahlia`, and returns JSON `{ client_secret: session.client_secret }`.
4. [src/App.tsx](src/App.tsx) closes the cart drawer and opens [src/components/CheckoutModal.tsx](src/components/CheckoutModal.tsx) with the `client_secret`.
5. `CheckoutModal` initializes `Stripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY)`, calls `stripe.initCheckoutFormSdk({ clientSecret, appearance })`, mounts `checkout.createForm({ layout: 'expanded' })` into `#checkout-form`, loads actions via `checkout.loadActions()`, and confirms payment on `form.on('confirm', ...)`.
6. Upon payment completion, Stripe redirects the customer to `/order-success?session_id={CHECKOUT_SESSION_ID}`, rendering [src/components/OrderSuccess.tsx](src/components/OrderSuccess.tsx) and clearing the cart.

## Testing

Use Stripe **Test Mode** (`pk_test_...` / `sk_test_...`) with the following test card numbers (any future expiration date and any 3-digit CVC):

| Scenario | Card Number |
|----------|-------------|
| Successful Visa payment | `4242 4242 4242 4242` |
| 3D Secure authentication required | `4000 0025 0000 3155` |
| Generic decline | `4000 0000 0000 0002` |
| Insufficient funds | `4000 0000 0000 9995` |

Run `netlify dev` locally to serve both the Vite storefront and the `/.netlify/functions/create-checkout` endpoint together.

## Next Steps

1. **Configure Test Keys:** Add your test `VITE_STRIPE_PUBLISHABLE_KEY` and `STRIPE_SECRET_KEY` to `.env` (locally) and Netlify environment variables, then test a full checkout end-to-end.
2. **Webhook Fulfillment (Recommended for Production):** Add a Stripe webhook endpoint listening for `checkout.session.completed` (using `STRIPE_WEBHOOK_SECRET` from [Stripe Workbench Webhooks](https://dashboard.stripe.com/workbench/webhooks)) to decrement inventory, send custom order confirmation emails, and handle asynchronous payment methods reliably.
3. **Order Tracking & Products:** Keep product inventory and pricing updated via the Admin Portal (`src/data/products.json` / Netlify persistence); `create-checkout.ts` automatically calculates authoritative line item prices from the catalog.
4. **Go Live:** When ready for production payments, replace your test keys with live keys (`pk_live_...` and `sk_live_...`) in Netlify environment variables and trigger a fresh deploy so Vite bundles the live `VITE_STRIPE_PUBLISHABLE_KEY`.

## Resources

- Stripe Support: https://support.stripe.com
- Stripe MCP & Documentation: https://docs.stripe.com/mcp
