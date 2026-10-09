import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { PaymentsTab } from '../src/components/admin/PaymentsTab';
import { adminPayments } from '../src/services/adminPayments';

describe('PaymentsTab', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders loading state initially', () => {
    vi.spyOn(adminPayments, 'fetchPayments').mockReturnValue(new Promise(() => {}));
    render(<PaymentsTab />);
    expect(screen.getByText(/Loading Stripe Payments/i)).toBeInTheDocument();
  });

  it('renders metrics cards, orders feed, and dashboard link in live mode', async () => {
    vi.spyOn(adminPayments, 'fetchPayments').mockResolvedValue({
      connected: true,
      mode: 'live',
      summary: {
        totalRevenue: 154.5,
        orderCount: 8,
        averageOrderValue: 19.31,
      },
      transactions: [
        {
          id: 'cs_test_123',
          customerEmail: 'customer@gmail.com',
          amount: 28.0,
          currency: 'usd',
          status: 'paid',
          created: 1773000000000,
          giftNote: 'Happy Birthday Cierra!',
          items: [{ name: 'Chubby Bumblebee (Keychain)', quantity: 2, amount: 28.0 }],
        },
      ],
    });

    render(<PaymentsTab />);

    await waitFor(() => {
      expect(screen.getByText('$154.50')).toBeInTheDocument();
      expect(screen.getByText('8')).toBeInTheDocument();
      expect(screen.getByText('$19.31')).toBeInTheDocument();
      expect(screen.getByText('customer@gmail.com')).toBeInTheDocument();
      expect(screen.getByText('Happy Birthday Cierra!')).toBeInTheDocument();
      expect(screen.getByText(/Live Stripe Connected/i)).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /Open Stripe Dashboard/i })).toHaveAttribute(
        'href',
        'https://dashboard.stripe.com'
      );
    });
  });

  it('renders demo sandbox badge in demo mode', async () => {
    vi.spyOn(adminPayments, 'fetchPayments').mockResolvedValue({
      connected: false,
      mode: 'demo',
      summary: {
        totalRevenue: 48.0,
        orderCount: 2,
        averageOrderValue: 24.0,
      },
      transactions: [],
    });

    render(<PaymentsTab />);

    await waitFor(() => {
      expect(screen.getByText(/Sandbox Preview/i)).toBeInTheDocument();
    });
  });

  it('handles error state and allows retry', async () => {
    const fetchSpy = vi.spyOn(adminPayments, 'fetchPayments');
    fetchSpy.mockRejectedValueOnce(new Error('Network error loading payments'));

    render(<PaymentsTab />);

    await waitFor(() => {
      expect(screen.getByText(/Network error loading payments/i)).toBeInTheDocument();
    });

    // Mock successful retry
    fetchSpy.mockResolvedValueOnce({
      connected: false,
      mode: 'demo',
      summary: { totalRevenue: 0, orderCount: 0, averageOrderValue: 0 },
      transactions: [],
    });

    const retryBtn = screen.getByRole('button', { name: /Try Again/i });
    fireEvent.click(retryBtn);

    await waitFor(() => {
      expect(screen.queryByText(/Network error loading payments/i)).not.toBeInTheDocument();
    });
  });

  it('reloads data when refresh button is clicked', async () => {
    const fetchSpy = vi.spyOn(adminPayments, 'fetchPayments').mockResolvedValue({
      connected: true,
      mode: 'test',
      summary: { totalRevenue: 10, orderCount: 1, averageOrderValue: 10 },
      transactions: [],
    });

    render(<PaymentsTab />);

    await waitFor(() => {
      expect(screen.getByText(/Stripe Test Mode/i)).toBeInTheDocument();
    });

    const refreshBtn = screen.getByRole('button', { name: /Refresh/i });
    fireEvent.click(refreshBtn);

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledTimes(2);
    });
  });
});
