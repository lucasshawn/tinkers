# Specification: Google-Only Admin Authentication

## 1. Overview
The current Weebles Studio admin portal includes 1-click dev/mock login buttons ("Login as Shawn", "Login as Cierra") that bypass real authentication. This design eliminates all bypass buttons and mock logic, enforcing real Google OAuth 2.0 authentication via Google Identity Services (GIS). Only pre-authorized Google email accounts will be allowed to access the admin portal; any other accounts will be strictly rejected with a `403 Forbidden` response.

---

## 2. Authorized Administrator Accounts
The authorized administrator accounts are:
1. `lucasshawn@gmail.com`
2. `lucascierra24@gmail.com`
3. `powerhousepnw@gmail.com`

Additionally, the backend function will support an optional environment variable `ALLOWED_ADMIN_EMAILS` (comma-separated list of emails) to permit runtime configuration without modifying source code.

---

## 3. Frontend Architecture

### 3.1 `AdminLoginCard.tsx`
* **Removal of Mock Buttons**:
  * Delete the "Choose Studio Profile" container and all buttons referencing "Login as Shawn" or "Login as Cierra".
  * Delete the `handleDevLogin` handler.
* **Google Identity Services (GIS) Rendering**:
  * Read `VITE_GOOGLE_CLIENT_ID` from environment.
  * If `VITE_GOOGLE_CLIENT_ID` is missing, render an informative alert explaining that `VITE_GOOGLE_CLIENT_ID` is required.
  * If `VITE_GOOGLE_CLIENT_ID` is configured, ensure Google Identity Services (`window.google.accounts.id`) is loaded.
  * Initialize Google Identity Services:
    ```typescript
    window.google.accounts.id.initialize({
      client_id: clientId,
      callback: handleCredentialResponse,
    });
    window.google.accounts.id.renderButton(
      document.getElementById('googleSignInBtn'),
      { theme: 'outline', size: 'large', shape: 'pill', text: 'signin_with' }
    );
    ```
* **Credential Handling & Feedback**:
  * On credential callback, set loading state and invoke `adminAuth.loginWithCredential(credential)`.
  * If login fails or returns an error, set `errorMessage` (displayed in an alert banner).
  * If login succeeds, pass session to `onLoginSuccess`.

### 3.2 `src/services/adminAuth.ts`
* Remove `devLogin()` completely.
* Maintain `loginWithCredential(credential)` and `loginWithGoogle(credential)` for sending `{ credential }` to `/.netlify/functions/admin-auth`.
* Maintain session persistence in `localStorage` (`weebles_admin_session_v1`) and `logout()`.

---

## 4. Backend Architecture (`netlify/functions/admin-auth.ts`)

### 4.1 Token Verification
* Remove `devBypass` handling, `devEmail`, and dev bypass flags.
* Reject any request without `{ credential }` with `400 Bad Request`.
* Verify Google ID token using Google's tokeninfo API:
  `https://oauth2.googleapis.com/tokeninfo?id_token=<credential>`
* Require `tokenInfo.email_verified === true || tokenInfo.email_verified === 'true'`.
* Fallback parsing for test/mock environments where Google's public endpoint is unreachable.

### 4.2 Whitelist Authorization
* Normalize email to lowercase and trim whitespace.
* Check against authorized admin list (`DEFAULT_ALLOWED_ADMINS` plus `ALLOWED_ADMIN_EMAILS` env var).
* If not whitelisted:
  * Return `403 Forbidden` with:
    `{ error: "Unauthorized: <email> is not an authorized administrator." }`
* If whitelisted:
  * Generate signed HMAC session token using `ADMIN_SESSION_SECRET` with 24-hour expiration.
  * Return `200 OK` with `{ token, email, name, picture, exp }`.

---

## 5. Testing & Verification Plan

### 5.1 Unit & Integration Tests
* **`tests/adminAuth.test.ts`**:
  * Verify `ALLOWED_ADMINS` contains the 3 authorized accounts.
  * Test Google token authorization succeeds for Shawn, Cierra, and powerhousepnw.
  * Test Google token authorization fails with `403` for non-whitelisted emails.
  * Test unverified Google emails fail with `401`.
  * Test missing credential returns `400`.
  * Remove `devBypass` / `devLogin` test cases.
* **`tests/AdminLoginCard.test.tsx`**:
  * Verify mock buttons are absent.
  * Verify message displays when `VITE_GOOGLE_CLIENT_ID` is missing.
  * Verify Google button container renders and callback logs in or shows error.
* **`tests/AdminPortal.test.tsx` & `tests/smoke.test.ts`**:
  * Update tests previously expecting "Login as Shawn" buttons to expect Google sign-in container and authorized session state.

### 5.2 Build & Verification
* Run `npm test` across the full test suite.
* Run `npm run build` to verify clean TypeScript compilation and Vite production bundling.
