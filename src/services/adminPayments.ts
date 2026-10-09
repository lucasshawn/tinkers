import { adminAuth } from './adminAuth';
import { PaymentsResponse } from '../types/payments';

export const adminPayments = {
  async fetchPayments(): Promise<PaymentsResponse> {
    const session = adminAuth.getSession();
    if (!session) {
      throw new Error('Not authenticated');
    }

    const res = await fetch('/.netlify/functions/admin-payments', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${session.token}`,
      },
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'Failed to fetch payments');
    }

    return res.json();
  },
};
