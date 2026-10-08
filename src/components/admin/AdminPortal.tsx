import React, { useState } from 'react';
import { LogOut, ArrowLeft, Layers, Settings } from 'lucide-react';
import { adminAuth, AdminSession } from '../../services/adminAuth';
import { adminApi } from '../../services/adminApi';
import { AdminLoginCard } from './AdminLoginCard';
import { InventoryTab } from './InventoryTab';
import { SettingsTab } from './SettingsTab';
import { useSettings } from '../../context/SettingsContext';
import initialProductsData from '../../data/products.json';
import { Product } from '../../types';
import { SiteSettings } from '../../types/settings';

export const AdminPortal: React.FC = () => {
  const [session, setSession] = useState<AdminSession | null>(() => adminAuth.getSession());
  const [activeTab, setActiveTab] = useState<'inventory' | 'settings'>('inventory');
  const [products, setProducts] = useState<Product[]>(() => {
    const raw = (initialProductsData as any)?.products || initialProductsData;
    return Array.isArray(raw) ? raw : [];
  });
  const { settings, updateSettings } = useSettings();
  const [notification, setNotification] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!session) {
    return <AdminLoginCard onLoginSuccess={(s) => setSession(s)} />;
  }

  const handleLogout = () => {
    adminAuth.logout();
    setSession(null);
  };

  const handleSaveInventory = async (
    updated: Product[],
    newImage?: { filename: string; base64Data: string }
  ) => {
    setErrorMessage(null);
    try {
      const res = await adminApi.saveInventory(updated, newImage);
      setProducts(updated);
      setNotification(res.message);
      setTimeout(() => setNotification(null), 4000);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to save inventory');
      setTimeout(() => setErrorMessage(null), 5000);
    }
  };

  const handleSaveSettings = async (newSettings: SiteSettings) => {
    setErrorMessage(null);
    try {
      const res = await adminApi.saveSettings(newSettings);
      updateSettings(newSettings);
      setNotification(res.message);
      setTimeout(() => setNotification(null), 4000);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to save settings');
      setTimeout(() => setErrorMessage(null), 5000);
    }
  };

  return (
    <div className="min-h-screen bg-weeble-pinkBg flex flex-col">
      {/* Top Admin Header */}
      <header className="bg-white border-b-2 border-pink-100 sticky top-0 z-40 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-weeble-pink to-weeble-pinkLight flex items-center justify-center shadow-pillow">
              <span className="text-xl">🍓</span>
            </div>
            <div>
              <h1 className="font-bubble text-xl font-bold text-weeble-pink leading-none">
                Weebles Studio Admin
              </h1>
              <span className="text-[11px] font-semibold text-weeble-textMuted">
                Signed in as: <strong className="text-weeble-text">{session.email}</strong>
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <a
              href="/"
              className="text-xs font-bold text-weeble-text hover:text-weeble-pink px-3 py-1.5 rounded-full hover:bg-weeble-pinkWash flex items-center gap-1 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">View Store</span>
            </a>
            <button
              onClick={handleLogout}
              className="text-xs font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200 px-3 py-1.5 rounded-full flex items-center gap-1 transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Log Out</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Body */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 w-full">
        {notification && (
          <div className="mb-6 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold px-4 py-3 rounded-2xl shadow-xs">
            {notification}
          </div>
        )}

        {errorMessage && (
          <div className="mb-6 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold px-4 py-3 rounded-2xl shadow-xs">
            {errorMessage}
          </div>
        )}

        {/* Tab Navigation */}
        <div className="flex items-center gap-3 border-b-2 border-pink-200 pb-3 mb-6">
          <button
            onClick={() => setActiveTab('inventory')}
            className={`font-bubble text-sm sm:text-base font-bold px-5 py-2.5 rounded-full transition-all flex items-center gap-2 ${
              activeTab === 'inventory'
                ? 'bg-weeble-pink text-white shadow-pillow scale-102'
                : 'bg-white text-weeble-text border border-pink-200 hover:bg-weeble-pinkWash'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>🍓 Inventory Catalog</span>
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`font-bubble text-sm sm:text-base font-bold px-5 py-2.5 rounded-full transition-all flex items-center gap-2 ${
              activeTab === 'settings'
                ? 'bg-weeble-pink text-white shadow-pillow scale-102'
                : 'bg-white text-weeble-text border border-pink-200 hover:bg-weeble-pinkWash'
            }`}
          >
            <Settings className="w-4 h-4" />
            <span>⚙️ Store & Social Settings</span>
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === 'inventory' ? (
          <InventoryTab products={products} onSave={handleSaveInventory} />
        ) : (
          <SettingsTab settings={settings} onSave={handleSaveSettings} />
        )}
      </main>
    </div>
  );
};
