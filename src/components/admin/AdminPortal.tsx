import React, { useState, useEffect } from 'react';
import { LogOut, ArrowLeft, Layers, Users, CreditCard, Palette, AlertCircle, X, CheckCircle2, History } from 'lucide-react';
import { adminAuth, AdminSession } from '../../services/adminAuth';
import { adminApi } from '../../services/adminApi';
import { AdminLoginCard } from './AdminLoginCard';
import { AdminsTab } from './AdminsTab';
import { InventoryTab } from './InventoryTab';
import { PaymentsTab } from './PaymentsTab';
import { ContentTab } from './ContentTab';
import { ChangesTab } from './ChangesTab';
import { useSettings, SETTINGS_STORAGE_KEY } from '../../context/SettingsContext';
import initialProductsData from '../../data/products.json';
import initialChangesData from '../../data/changes.json';
import { Product, ChangeLogEntry } from '../../types';
import { CategoryOption, SiteSettings } from '../../types/settings';
import {
  DEFAULT_CATEGORIES,
  getStoredProducts,
  saveStoredProducts,
  PRODUCTS_STORAGE_KEY,
} from '../../utils/productUtils';
import {
  getStoredChanges,
  saveStoredChanges,
  mergeChanges,
  diffInventoryChanges,
  diffSettingsChanges,
  diffAdminsChanges,
  createErrorLogEntry,
  describeInventoryAttempt,
} from '../../utils/changeLogUtils';

type AdminTab = 'admins' | 'catalog' | 'payments' | 'content' | 'changes';

export const AdminPortal: React.FC = () => {
  const [session, setSession] = useState<AdminSession | null>(() => adminAuth.getSession());
  const [activeTab, setActiveTab] = useState<AdminTab>('catalog');
  const [products, setProducts] = useState<Product[]>(() => {
    const raw = (initialProductsData as any)?.products || initialProductsData;
    const defaults = Array.isArray(raw) ? raw : [];
    return getStoredProducts(defaults);
  });
  const [changes, setChanges] = useState<ChangeLogEntry[]>(() => {
    const defaults = Array.isArray(initialChangesData) ? (initialChangesData as ChangeLogEntry[]) : [];
    return getStoredChanges(defaults);
  });
  const { settings, updateSettings, hydrateSettings } = useSettings();
  const [notification, setNotification] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (import.meta.env.MODE === 'test') return;
    adminApi.loadStoreData().then((data) => {
      if (!localStorage.getItem(PRODUCTS_STORAGE_KEY) && data?.products && Array.isArray(data.products)) {
        setProducts(data.products);
        saveStoredProducts(data.products);
      }
      if (!localStorage.getItem(SETTINGS_STORAGE_KEY) && data?.settings && typeof data.settings === 'object') {
        hydrateSettings(data.settings);
      }
      if (data?.changes && Array.isArray(data.changes)) {
        setChanges((prev) => {
          const merged = mergeChanges(prev, data.changes!);
          saveStoredChanges(merged);
          return merged;
        });
      }
    });
  }, [hydrateSettings]);

  if (!session) {
    return <AdminLoginCard onLoginSuccess={(s) => setSession(s)} />;
  }

  const handleLogout = () => {
    adminAuth.logout();
    setSession(null);
  };

  const recordChanges = (newEntries: ChangeLogEntry[]) => {
    if (newEntries.length === 0) return;
    setChanges((prev) => {
      const updated = mergeChanges(prev, newEntries);
      saveStoredChanges(updated);
      return updated;
    });
    adminApi.saveChanges(newEntries).catch(() => {});
  };

  const recordError = (action: string, attemptedValue: string, errorOrMessage: unknown) => {
    const entry = createErrorLogEntry(session.email, action, attemptedValue, errorOrMessage);
    recordChanges([entry]);
  };

  const handleSaveInventory = async (
    updated: Product[],
    newImage?: { filename: string; base64Data: string }
  ) => {
    setErrorMessage(null);
    const previousProducts = products;
    const diffEntries = diffInventoryChanges(session.email, previousProducts, updated);

    // If a new image was uploaded, embed its data URL into the local catalog so it renders immediately
    // even before a static site rebuild finishes.
    const localUpdated =
      newImage && newImage.filename && newImage.base64Data
        ? updated.map((p) =>
            p.images[0] === `/images/products/${newImage.filename}`
              ? { ...p, images: [newImage.base64Data] }
              : p
          )
        : updated;

    // Optimistically update catalog and localStorage immediately so new/edited items appear right away
    setProducts(localUpdated);
    saveStoredProducts(localUpdated);

    try {
      const res = await adminApi.saveInventory(updated, newImage);
      recordChanges(diffEntries);
      setNotification(res.message);
      setTimeout(() => setNotification(null), 5000);
    } catch (err: any) {
      const errMsg = err.message || 'Failed to save inventory';
      setErrorMessage(errMsg);
      recordError('Save Inventory', describeInventoryAttempt(previousProducts, updated), err);
    }
  };

  const handleSaveSettings = async (newSettings: SiteSettings) => {
    setErrorMessage(null);
    const previousSettings = settings;
    const diffEntries = diffSettingsChanges(session.email, previousSettings, newSettings);
    updateSettings(newSettings);
    try {
      const res = await adminApi.saveSettings(newSettings);
      recordChanges(diffEntries);
      setNotification(res.message);
      setTimeout(() => setNotification(null), 5000);
    } catch (err: any) {
      const errMsg = err.message || 'Failed to save settings';
      setErrorMessage(errMsg);
      recordError('Save Site Content', 'Site settings update', err);
    }
  };

  const handleSaveAdmins = async (updatedAdmins: string[]) => {
    setErrorMessage(null);
    const previousAdmins = settings.admins || [];
    const diffEntries = diffAdminsChanges(session.email, previousAdmins, updatedAdmins);
    updateSettings({
      ...settings,
      admins: updatedAdmins,
    });
    try {
      const res = await adminApi.saveAdmins(updatedAdmins);
      recordChanges(diffEntries);
      setNotification(res.message);
      setTimeout(() => setNotification(null), 5000);
    } catch (err: any) {
      const errMsg = err.message || 'Failed to save admin whitelist';
      setErrorMessage(errMsg);
      recordError('Save Admin Whitelist', updatedAdmins.join(', '), err);
    }
  };

  const categories = settings.categories ?? DEFAULT_CATEGORIES;

  const handleSaveCategories = async (
    updatedCategories: CategoryOption[],
    updatedProducts?: Product[]
  ) => {
    setErrorMessage(null);
    const previousProducts = products;
    try {
      const res = await adminApi.saveCategories(updatedCategories, updatedProducts);
      updateSettings({
        ...settings,
        categories: updatedCategories,
      });
      if (updatedProducts) {
        setProducts(updatedProducts);
        saveStoredProducts(updatedProducts);
        recordChanges(diffInventoryChanges(session.email, previousProducts, updatedProducts));
      }
      setNotification(res.message);
      setTimeout(() => setNotification(null), 5000);
    } catch (err: any) {
      const errMsg = err?.message || 'Failed to save categories';
      setErrorMessage(errMsg);
      recordError(
        'Save Categories',
        updatedCategories.map((c) => c.label).join(', '),
        err && typeof err === 'object' && 'message' in err && err.message ? err : errMsg
      );
      throw err;
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
              className="text-xs font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200 px-3 py-1.5 rounded-full flex items-center gap-1 transition-colors cursor-pointer"
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
          <div className="mb-6 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold px-4 py-3 rounded-2xl shadow-xs flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{notification}</span>
            </div>
            <button
              type="button"
              onClick={() => setNotification(null)}
              aria-label="Dismiss notification"
              className="text-emerald-700 hover:text-emerald-900 p-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {errorMessage && (
          <div
            role="alert"
            className="mb-6 bg-rose-50 border-2 border-rose-300 text-rose-800 text-xs font-bold px-4 py-3.5 rounded-2xl shadow-sm flex items-center justify-between gap-3 sticky top-20 z-30"
          >
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMessage}</span>
            </div>
            <button
              type="button"
              onClick={() => setErrorMessage(null)}
              aria-label="Dismiss error"
              className="text-rose-600 hover:text-rose-900 p-1 rounded-lg hover:bg-rose-100 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* 4-Tab Navigation */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 border-b-2 border-pink-200 pb-3 mb-6">
          <button
            onClick={() => setActiveTab('admins')}
            className={`font-bubble text-sm sm:text-base font-bold px-4 sm:px-5 py-2.5 rounded-full transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'admins'
                ? 'bg-weeble-pink text-white shadow-pillow scale-102'
                : 'bg-white text-weeble-text border border-pink-200 hover:bg-weeble-pinkWash'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>👥 Manage Admins</span>
          </button>

          <button
            onClick={() => setActiveTab('catalog')}
            className={`font-bubble text-sm sm:text-base font-bold px-4 sm:px-5 py-2.5 rounded-full transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'catalog'
                ? 'bg-weeble-pink text-white shadow-pillow scale-102'
                : 'bg-white text-weeble-text border border-pink-200 hover:bg-weeble-pinkWash'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>🍓 Manage Catalog</span>
          </button>

          <button
            onClick={() => setActiveTab('payments')}
            className={`font-bubble text-sm sm:text-base font-bold px-4 sm:px-5 py-2.5 rounded-full transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'payments'
                ? 'bg-weeble-pink text-white shadow-pillow scale-102'
                : 'bg-white text-weeble-text border border-pink-200 hover:bg-weeble-pinkWash'
            }`}
          >
            <CreditCard className="w-4 h-4" />
            <span>💳 Manage Payments</span>
          </button>

          <button
            onClick={() => setActiveTab('content')}
            className={`font-bubble text-sm sm:text-base font-bold px-4 sm:px-5 py-2.5 rounded-full transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'content'
                ? 'bg-weeble-pink text-white shadow-pillow scale-102'
                : 'bg-white text-weeble-text border border-pink-200 hover:bg-weeble-pinkWash'
            }`}
          >
            <Palette className="w-4 h-4" />
            <span>🎨 Manage Site Content</span>
          </button>

          <button
            onClick={() => setActiveTab('changes')}
            className={`font-bubble text-sm sm:text-base font-bold px-4 sm:px-5 py-2.5 rounded-full transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'changes'
                ? 'bg-weeble-pink text-white shadow-pillow scale-102'
                : 'bg-white text-weeble-text border border-pink-200 hover:bg-weeble-pinkWash'
            }`}
          >
            <History className="w-4 h-4" />
            <span>📋 Changes</span>
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === 'admins' && (
          <AdminsTab
            admins={settings.admins || []}
            currentAdminEmail={session.email}
            onSave={handleSaveAdmins}
            onLogError={recordError}
          />
        )}

        {activeTab === 'catalog' && (
          <InventoryTab
            products={products}
            categories={categories}
            onSave={handleSaveInventory}
            onSaveCategories={handleSaveCategories}
          />
        )}

        {activeTab === 'payments' && (
          <PaymentsTab onLogError={recordError} />
        )}

        {activeTab === 'content' && (
          <ContentTab
            settings={settings}
            onSave={handleSaveSettings}
          />
        )}

        {activeTab === 'changes' && (
          <ChangesTab changes={changes} />
        )}
      </main>
    </div>
  );
};
