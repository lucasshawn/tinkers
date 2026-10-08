import React, { useEffect, useState } from 'react';
import { Lock, ArrowLeft, AlertCircle } from 'lucide-react';
import { adminAuth, AdminSession } from '../../services/adminAuth';

interface AdminLoginCardProps {
  onLoginSuccess: (session: AdminSession) => void;
}

export const AdminLoginCard: React.FC<AdminLoginCardProps> = ({ onLoginSuccess }) => {
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Mount Google Identity Services if client ID is configured
    const clientId =
      (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID ||
      (typeof process !== 'undefined' ? (process as any).env?.VITE_GOOGLE_CLIENT_ID : undefined);
    if (clientId && (window as any).google?.accounts?.id) {
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
        (window as any).google.accounts.id.renderButton(
          document.getElementById('googleSignInBtn'),
          { theme: 'outline', size: 'large', shape: 'pill', text: 'signin_with' }
        );
      } catch (err) {
        console.error('Google SSO init error', err);
      }
    }
  }, [onLoginSuccess]);

  const handleDevLogin = async (email: string) => {
    setIsLoading(true);
    setErrorMessage('');
    try {
      const session = await adminAuth.devLogin(email);
      onLoginSuccess(session);
    } catch (err: any) {
      setErrorMessage(err.message || 'Login failed');
    } finally {
      setIsLoading(false);
    }
  };

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

        {/* Google SSO Container */}
        <div className="flex justify-center mb-6" id="googleSignInBtn" />

        {/* Development Studio Login Buttons */}
        <div className="bg-weeble-pinkWash p-4 rounded-2xl border border-pink-100 mb-6">
          <span className="text-[11px] font-bold text-weeble-textMuted uppercase tracking-wider block mb-2">
            Authorized Studio Access:
          </span>
          <div className="grid grid-cols-2 gap-2">
            <button
              disabled={isLoading}
              onClick={() => handleDevLogin('lucasshawn@gmail.com')}
              className="bg-white hover:bg-pink-50 text-weeble-text border border-pink-200 text-xs font-bold py-2 px-3 rounded-xl transition-all shadow-xs hover:border-pink-300"
            >
              Login as Shawn 🍓
            </button>
            <button
              disabled={isLoading}
              onClick={() => handleDevLogin('lucascierra24@gmail.com')}
              className="bg-white hover:bg-pink-50 text-weeble-text border border-pink-200 text-xs font-bold py-2 px-3 rounded-xl transition-all shadow-xs hover:border-pink-300"
            >
              Login as Cierra 🎀
            </button>
          </div>
        </div>

        <div className="text-[11px] text-weeble-textMuted border-t border-pink-100 pt-4 mb-6 text-left space-y-1">
          <div className="font-bold text-weeble-text">Authorized Admin Accounts:</div>
          <div>• lucasshawn@gmail.com</div>
          <div>• lucascierra24@gmail.com</div>
        </div>

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
