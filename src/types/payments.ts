export interface PaymentItem {
  name: string;
  quantity: number;
  amount: number;
}

export interface TransactionRecord {
  id: string;
  customerEmail: string;
  amount: number;
  currency: string;
  status: 'paid' | 'pending' | 'failed';
  created: number;
  giftNote?: string;
  items: PaymentItem[];
}

export interface PaymentsSummary {
  totalRevenue: number;
  orderCount: number;
  averageOrderValue: number;
}

export interface PaymentsResponse {
  connected: boolean;
  mode: 'live' | 'test' | 'demo';
  summary: PaymentsSummary;
  transactions: TransactionRecord[];
}
