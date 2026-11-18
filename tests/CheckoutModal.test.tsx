import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { CheckoutModal } from '../src/components/CheckoutModal';
import { STRIPE_APPEARANCE } from '../src/services/stripe';

describe('CheckoutModal', () => {
  const originalStripe = window.Stripe;

  beforeEach(() => {
    vi.unstubAllEnvs();
    delete window.Stripe;
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    window.Stripe = originalStripe;
    vi.restoreAllMocks();
  });

  it('does not render when clientSecret is null', () => {
    render(<CheckoutModal clientSecret={null} onClose={vi.fn()} />);
    expect(screen.queryByRole('dialog', { name: /Stripe Checkout/i })).not.toBeInTheDocument();
  });

  it('initializes Stripe Checkout Form SDK, mounts form, and confirms on submit', async () => {
    vi.stubEnv('VITE_STRIPE_PUBLISHABLE_KEY', 'pk_test_mock_key');

    let confirmHandler: ((event: any) => Promise<void> | void) | undefined;
    const mockMount = vi.fn();
    const mockUnmount = vi.fn();
    const mockDestroy = vi.fn();
    const mockOn = vi.fn((eventName: string, handler: (event: any) => Promise<void> | void) => {
      if (eventName === 'confirm') {
        confirmHandler = handler;
      }
    });
    const mockConfirm = vi.fn().mockResolvedValue({ type: 'success' });
    const mockLoadActions = vi.fn().mockResolvedValue({
      type: 'success',
      actions: { confirm: mockConfirm },
    });
    const mockCreateForm = vi.fn().mockReturnValue({
      mount: mockMount,
      unmount: mockUnmount,
      destroy: mockDestroy,
      on: mockOn,
    });
    const mockInitCheckoutFormSdk = vi.fn().mockReturnValue({
      createForm: mockCreateForm,
      loadActions: mockLoadActions,
    });
    const mockStripeFactory = vi.fn().mockReturnValue({
      initCheckoutFormSdk: mockInitCheckoutFormSdk,
    });
    window.Stripe = mockStripeFactory;

    const { unmount } = render(
      <CheckoutModal clientSecret="cs_test_secret_123" onClose={vi.fn()} />
    );

    expect(screen.getByRole('dialog', { name: /Stripe Checkout/i })).toBeInTheDocument();
    expect(document.getElementById('checkout-form')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.queryByText(/Loading secure payment form/i)).not.toBeInTheDocument();
    });

    expect(mockLoadActions).toHaveBeenCalledTimes(1);
    expect(mockStripeFactory).toHaveBeenCalledWith('pk_test_mock_key');
    expect(mockInitCheckoutFormSdk).toHaveBeenCalledWith({
      clientSecret: expect.any(Promise),
      appearance: STRIPE_APPEARANCE,
    });
    const passedClientSecret = await mockInitCheckoutFormSdk.mock.calls[0][0].clientSecret;
    expect(passedClientSecret).toBe('cs_test_secret_123');
    expect(mockCreateForm).toHaveBeenCalledWith({ layout: 'expanded' });
    expect(mockMount).toHaveBeenCalledWith('#checkout-form');
    expect(mockOn).toHaveBeenCalledWith('confirm', expect.any(Function));

    const fakeEvent = { preventDefault: vi.fn() };
    await act(async () => {
      await confirmHandler?.(fakeEvent);
    });
    expect(mockConfirm).toHaveBeenCalledWith({ formConfirmEvent: fakeEvent });

    unmount();
    expect(mockUnmount).toHaveBeenCalledTimes(1);
    expect(mockDestroy).toHaveBeenCalledTimes(1);
  });

  it('shows error when VITE_STRIPE_PUBLISHABLE_KEY is not configured', async () => {
    vi.stubEnv('VITE_STRIPE_PUBLISHABLE_KEY', '');

    render(<CheckoutModal clientSecret="cs_test_secret_123" onClose={vi.fn()} />);

    expect(
      await screen.findByText(/VITE_STRIPE_PUBLISHABLE_KEY/i)
    ).toBeInTheDocument();
  });

  it('shows error when Stripe.js is not loaded', async () => {
    vi.stubEnv('VITE_STRIPE_PUBLISHABLE_KEY', 'pk_test_mock_key');

    render(<CheckoutModal clientSecret="cs_test_secret_123" onClose={vi.fn()} />);

    expect(
      await screen.findByText(/Stripe\.js failed to load/i)
    ).toBeInTheDocument();
  });

  it('closes when clicking close button, backdrop, or pressing Escape', () => {
    vi.stubEnv('VITE_STRIPE_PUBLISHABLE_KEY', '');
    const onClose = vi.fn();

    render(<CheckoutModal clientSecret="cs_test_secret_123" onClose={onClose} />);

    fireEvent.click(screen.getByRole('button', { name: /Close checkout/i }));
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByTestId('checkout-backdrop'));
    expect(onClose).toHaveBeenCalledTimes(2);

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(3);
  });
});
