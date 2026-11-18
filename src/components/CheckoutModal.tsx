import React, { useEffect, useState } from 'react';
import { X, Lock } from 'lucide-react';
import { STRIPE_APPEARANCE } from '../services/stripe';

export interface CheckoutModalProps {
  clientSecret: string | null;
  onClose: () => void;
}

export const CheckoutModal: React.FC<CheckoutModalProps> = ({ clientSecret, onClose }) => {
  const [error, setError] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    if (!clientSecret) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [clientSecret, onClose]);

  useEffect(() => {
    if (!clientSecret) return;

    let cancelled = false;
    let mountedForm: StripeCheckoutForm | null = null;

    setError(null);
    setIsInitializing(true);

    const mountCheckoutForm = async () => {
      const publishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;
      if (!publishableKey) {
        setError(
          'Stripe publishable key is not configured. Set VITE_STRIPE_PUBLISHABLE_KEY in your environment.'
        );
        setIsInitializing(false);
        return;
      }

      if (typeof window.Stripe !== 'function') {
        setError('Stripe.js failed to load. Please refresh the page and try again.');
        setIsInitializing(false);
        return;
      }

      try {
        const stripe = window.Stripe(publishableKey);
        const checkout = stripe.initCheckoutFormSdk({
          clientSecret: Promise.resolve(clientSecret),
          appearance: STRIPE_APPEARANCE,
        });

        const form = checkout.createForm({ layout: 'expanded' });
        mountedForm = form;
        form.mount('#checkout-form');

        const loadActionsResult = await checkout.loadActions();
        if (cancelled) return;

        if (loadActionsResult.type === 'success' && loadActionsResult.actions) {
          const actions = loadActionsResult.actions;
          form.on('confirm', async (event) => {
            try {
              setError(null);
              const result = await actions.confirm({ formConfirmEvent: event });
              if (result && result.type === 'error' && result.error?.message) {
                setError(result.error.message);
              }
            } catch (confirmError: any) {
              console.error('Payment confirmation error:', confirmError);
              setError(confirmError?.message || 'Payment confirmation failed. Please try again.');
            }
          });
        } else if (loadActionsResult.type === 'error') {
          setError(loadActionsResult.error?.message || 'Unable to load Stripe checkout actions.');
        }
      } catch (initError: any) {
        if (!cancelled) {
          console.error('Stripe checkout initialization error:', initError);
          setError(initError?.message || 'Unable to initialize Stripe checkout form.');
        }
      } finally {
        if (!cancelled) {
          setIsInitializing(false);
        }
      }
    };

    mountCheckoutForm();

    return () => {
      cancelled = true;
      mountedForm?.unmount?.();
      mountedForm?.destroy?.();
    };
  }, [clientSecret]);

  if (!clientSecret) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
      {/* Backdrop */}
      <div
        data-testid="checkout-backdrop"
        onClick={onClose}
        className="fixed inset-0 bg-black/50 backdrop-blur-xs transition-opacity cursor-pointer"
      />

      {/* Modal */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Stripe Checkout"
        className="relative z-10 w-full max-w-lg bg-white rounded-3xl border-4 border-pink-200 shadow-2xl overflow-hidden my-8"
      >
        {/* Header */}
        <div className="p-5 border-b border-pink-100 flex items-center justify-between bg-weeble-pinkBg">
          <div className="flex items-center gap-2">
            <Lock className="w-5 h-5 text-weeble-pink" />
            <h2 className="font-bubble text-2xl font-bold text-weeble-text">
              Secure Checkout
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close checkout"
            className="w-9 h-9 rounded-full bg-white border border-pink-200 flex items-center justify-center text-weeble-text hover:bg-weeble-pinkWash hover:text-weeble-pink transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 max-h-[80vh] overflow-y-auto">
          {error && (
            <div
              role="alert"
              className="mb-4 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700"
            >
              {error}
            </div>
          )}

          {isInitializing && !error && (
            <div className="py-6 text-center text-sm text-weeble-textMuted">
              Loading secure payment form...
            </div>
          )}

          <div id="checkout-form" />
        </div>
      </div>
    </div>
  );
};
