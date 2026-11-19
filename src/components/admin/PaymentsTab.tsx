import React, { useState, useEffect, useCallback } from 'react';
import {
  CreditCard,
  ExternalLink,
  RefreshCw,
  DollarSign,
  ShoppingBag,
  TrendingUp,
  AlertCircle,
  Gift,
  CheckCircle2,
  Clock,
  XCircle,
} from 'lucide-react';
import { adminPayments } from '../../services/adminPayments';
import { PaymentsResponse } from '../../types/payments';

export interface PaymentsTabProps {
  onLogError?: (action: string, attemptedValue: string, errorMessage: string) => void;
}

export const PaymentsTab: React.FC<PaymentsTabProps> = ({ onLogError }) => {
  const [data, setData] = useState<PaymentsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await adminPayments.fetchPayments();
      setData(response);
    } catch (err: any) {
      const errMsg = err.message || 'Failed to load payments data';
      setError(errMsg);
      onLogError?.('Load Payments', 'Stripe payments sync', errMsg);
    } finally {
      setLoading(false);
    }
  }, [onLogError]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (loading && !data) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <RefreshCw className="w-10 h-10 text-weeble-pink animate-spin mb-4" />
        <h3 className="font-bubble text-xl text-neutral-800 mb-1">Loading Stripe Payments...</h3>
        <p className="text-sm text-neutral-500">Syncing recent checkout sessions & studio metrics</p>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="bg-rose-50 border border-rose-200 rounded-3xl p-8 text-center max-w-lg mx-auto">
        <AlertCircle className="w-12 h-12 text-rose-500 mx-auto mb-3" />
        <h3 className="font-bubble text-xl text-rose-800 mb-2">Unable to Load Payments</h3>
        <p className="text-sm text-rose-600 mb-6">{error}</p>
        <button
          onClick={loadData}
          className="inline-flex items-center gap-2 px-6 py-2.5 bg-rose-500 hover:bg-rose-600 text-white font-medium rounded-2xl shadow-sm transition-all"
        >
          <RefreshCw className="w-4 h-4" />
          Try Again
        </button>
      </div>
    );
  }

  const mode = data?.mode || 'demo';
  const summary = data?.summary || { totalRevenue: 0, orderCount: 0, averageOrderValue: 0 };
  const transactions = data?.transactions || [];

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white/80 backdrop-blur-xs p-6 rounded-3xl border border-pink-100 shadow-xs">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h2 className="font-bubble text-2xl text-neutral-800 flex items-center gap-2">
              <CreditCard className="w-6 h-6 text-weeble-pink" />
              Manage Payments
            </h2>
            {mode === 'live' && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-full text-xs font-semibold">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                Live Stripe Connected
              </span>
            )}
            {mode === 'test' && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-100 text-amber-800 border border-amber-300 rounded-full text-xs font-semibold">
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                Stripe Test Mode Active
              </span>
            )}
            {mode === 'demo' && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-pink-100 text-pink-700 border border-pink-300 rounded-full text-xs font-semibold">
                <span className="w-2 h-2 rounded-full bg-pink-400" />
                Sandbox Preview (Key Unset)
              </span>
            )}
          </div>
          <p className="text-sm text-neutral-500">
            View recent checkout sessions, studio revenue metrics, and jump to your Stripe dashboard.
          </p>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <button
            onClick={loadData}
            disabled={loading}
            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 text-sm font-medium rounded-2xl transition-all disabled:opacity-50"
            title="Refresh payments"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-weeble-pink' : ''}`} />
            Refresh
          </button>
          <a
            href="https://dashboard.stripe.com"
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-pink-500 to-rose-400 hover:from-pink-600 hover:to-rose-500 text-white text-sm font-semibold rounded-2xl shadow-sm hover:shadow-md transition-all"
          >
            <span>Open Stripe Dashboard</span>
            <ExternalLink className="w-4 h-4" />
          </a>
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white/80 backdrop-blur-xs p-6 rounded-3xl border border-pink-100 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-pink-100 text-weeble-pink flex items-center justify-center shrink-0">
            <DollarSign className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Total Revenue</div>
            <div className="font-bubble text-3xl text-neutral-800">
              ${summary.totalRevenue.toFixed(2)}
            </div>
            <div className="text-xs text-neutral-500 mt-0.5">Completed checkout sessions</div>
          </div>
        </div>

        <div className="bg-white/80 backdrop-blur-xs p-6 rounded-3xl border border-pink-100 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center shrink-0">
            <ShoppingBag className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Completed Orders</div>
            <div className="font-bubble text-3xl text-neutral-800">
              {summary.orderCount}
            </div>
            <div className="text-xs text-neutral-500 mt-0.5">Paid figurine transactions</div>
          </div>
        </div>

        <div className="bg-white/80 backdrop-blur-xs p-6 rounded-3xl border border-pink-100 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Average Basket</div>
            <div className="font-bubble text-3xl text-neutral-800">
              ${summary.averageOrderValue.toFixed(2)}
            </div>
            <div className="text-xs text-neutral-500 mt-0.5">Per customer transaction</div>
          </div>
        </div>
      </div>

      {/* Orders Feed */}
      <div className="bg-white/80 backdrop-blur-xs rounded-3xl border border-pink-100 shadow-xs overflow-hidden">
        <div className="p-6 border-b border-pink-100/60 flex items-center justify-between">
          <div>
            <h3 className="font-bubble text-lg text-neutral-800">Recent Customer Orders</h3>
            <p className="text-xs text-neutral-500">Live feed of orders through Stripe Checkout</p>
          </div>
          <span className="text-xs font-medium text-neutral-400">
            {transactions.length} {transactions.length === 1 ? 'order' : 'orders'} recorded
          </span>
        </div>

        {transactions.length === 0 ? (
          <div className="p-12 text-center text-neutral-400">
            <ShoppingBag className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="font-medium text-neutral-600">No checkout transactions yet.</p>
            <p className="text-xs mt-1">Orders placed on the storefront will appear here automatically.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-pink-100 bg-pink-50/50 text-[11px] font-semibold text-neutral-500 uppercase tracking-wider">
                  <th className="py-3 px-6">Date</th>
                  <th className="py-3 px-6">Customer</th>
                  <th className="py-3 px-6">Amount</th>
                  <th className="py-3 px-6">Status</th>
                  <th className="py-3 px-6">Items & Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-pink-100/60 text-sm">
                {transactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-pink-50/20 transition-colors">
                    <td className="py-4 px-6 text-xs text-neutral-600 whitespace-nowrap">
                      {new Date(tx.created).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="py-4 px-6 font-medium text-neutral-800 whitespace-nowrap">
                      {tx.customerEmail}
                    </td>
                    <td className="py-4 px-6 font-semibold text-neutral-900 whitespace-nowrap">
                      ${tx.amount.toFixed(2)}
                    </td>
                    <td className="py-4 px-6 whitespace-nowrap">
                      {tx.status === 'paid' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Paid
                        </span>
                      )}
                      {tx.status === 'pending' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                          <Clock className="w-3.5 h-3.5" />
                          Pending
                        </span>
                      )}
                      {tx.status === 'failed' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                          <XCircle className="w-3.5 h-3.5" />
                          Failed
                        </span>
                      )}
                    </td>
                    <td className="py-4 px-6 space-y-1">
                      <div className="text-xs text-neutral-700">
                        {tx.items && tx.items.length > 0 ? (
                          tx.items.map((item, idx) => (
                            <span key={idx} className="mr-2">
                              {item.quantity}x {item.name}
                            </span>
                          ))
                        ) : (
                          <span className="text-neutral-400 italic">Custom item</span>
                        )}
                      </div>
                      {tx.giftNote && (
                        <div className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-lg bg-pink-100/80 text-pink-700">
                          <Gift className="w-3 h-3 shrink-0" />
                          <span className="italic">{tx.giftNote}</span>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
