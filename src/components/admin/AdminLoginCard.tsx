import React, { useEffect, useState } from 'react';
import { Lock, ArrowLeft, AlertCircle, AlertTriangle } from 'lucide-react';
import { adminAuth, AdminSession } from '../../services/adminAuth';

interface AdminLoginCardProps {
  onLoginSuccess: (session: AdminSession) => void;
}

export const AdminLoginCard: React.FC<AdminLoginCardProps> = ({ onLoginSuccess }) => {
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const clientId =
    (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID ||
    (typeof process !== 'undefined' ? (process as any).env?.VITE_GOOGLE_CLIENT_ID : undefined);

  useEffect(() => {
    if (!clientId) return;

    const setupGoogleBtn = () => {
      if ((window as any).google?.accounts?.id) {
        try {
          (window as any).google.accounts.id.initialize({
            client_id: clientId,
            callback: async (response: any) => {
              if (response.credential) {
                setIsLoading(true);
                setErrorMessage('');
                try {
                  const session = await adminAuth.loginWithCredential(response.credential);
                  onLoginSuccess(session);
                } catch (err: any) {
                  setErrorMessage(err.message || 'Access denied');
                } finally {
                  setIsLoading(false);
                }
              }
            },
          });
          const btnContainer = document.getElementById('googleSignInBtn');
          if (btnContainer) {
            btnContainer.innerHTML = '';
            (window as any).google.accounts.id.renderButton(btnContainer, {
              theme: 'outline',
              size: 'large',
              shape: 'pill',
              text: 'signin_with',
            });
          }
          return true;
        } catch (err) {
          console.error('Google SSO init error', err);
        }
      }
      return false;
    };

    if (!setupGoogleBtn()) {
      const interval = setInterval(() => {
        if (setupGoogleBtn()) {
          clearInterval(interval);
        }
      }, 250);
      return () => clearInterval(interval);
    }
  }, [clientId, onLoginSuccess]);

  return (
    <div className="min-h-screen bg-weeble-pinkBg flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-3xl border-4 border-pink-200 p-8 shadow-2xl text-center">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-weeble-pink to-weeble-pinkLight flex items-center justify-center mx-auto mb-4 shadow-pillow">
          <span className="text-3xl">🍓</span>
        </div>

        <span className="bg-pink-100 text-pink-700 text-xs font-bold px-3 py-1 rounded-full inline-flex items-center gap-1 mb-2">
          <Lock className="w-3.5 h-3.5" /> Studio Administration
        </span>

        <h1 className="font-bubble text-3xl font-bold text-weeble-text mb-2">
          Weebles Studio Manager
        </h1>
        <p className="text-xs text-weeble-textMuted mb-6">
          Sign in with an authorized Google account to manage inventory, catalog prices, and store settings.
        </p>

        {errorMessage && (
          <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl p-3 mb-6 flex items-start gap-2 text-left">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        {isLoading && (
          <div className="text-xs font-bold text-weeble-pink mb-4 animate-pulse">
            Signing in...
          </div>
        )}

        {!clientId ? (
          <div className="bg-amber-50 border border-amber-200 text-amber-800 text-xs rounded-2xl p-4 mb-6 flex items-start gap-2.5 text-left">
            <AlertTriangle className="w-5 h-5 shrink-0 text-amber-600 mt-0.5" />
            <div>
              <div className="font-bold text-amber-900 mb-1">Google OAuth Client ID Missing</div>
              <p className="text-amber-700 leading-relaxed">
                Google OAuth Client ID is not configured. Please set <code className="bg-amber-100 px-1 py-0.5 rounded font-mono text-[11px]">VITE_GOOGLE_CLIENT_ID</code> in your environment variables to enable admin login.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex justify-center mb-6 min-h-[44px]" id="googleSignInBtn" />
        )}

        <a
          href="/"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-weeble-pink hover:underline"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Return to Storefront</span>
        </a>
      </div>
    </div>
  );
};
