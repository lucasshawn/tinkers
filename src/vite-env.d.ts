/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_STRIPE_PUBLISHABLE_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

interface StripeCheckoutFormConfirmEvent {
  [key: string]: unknown;
}

interface StripeCheckoutForm {
  mount: (domElement: string | HTMLElement) => void;
  unmount?: () => void;
  destroy?: () => void;
  on: (
    event: 'confirm',
    handler: (event: StripeCheckoutFormConfirmEvent) => void | Promise<void>
  ) => void;
}

interface StripeCheckoutActions {
  confirm: (options: {
    formConfirmEvent: StripeCheckoutFormConfirmEvent;
  }) => Promise<{ type: 'success' | 'error'; error?: { message?: string } } | void>;
}

interface StripeCheckoutLoadActionsResult {
  type: 'success' | 'error';
  actions?: StripeCheckoutActions;
  error?: { message?: string };
}

interface StripeCheckoutFormSdk {
  createForm: (options?: { layout?: 'expanded' | 'compact' }) => StripeCheckoutForm;
  loadActions: () => Promise<StripeCheckoutLoadActionsResult>;
}

interface StripeInstance {
  initCheckoutFormSdk: (options: {
    clientSecret: string | Promise<string>;
    appearance?: Record<string, unknown>;
  }) => StripeCheckoutFormSdk;
}

interface Window {
  Stripe?: (publishableKey: string) => StripeInstance;
}
