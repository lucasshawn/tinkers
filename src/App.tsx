import React, { useState, useEffect } from 'react';
import { CartProvider, useCart } from './context/CartContext';
import { Navbar } from './components/Navbar';
import { HeroBanner } from './components/HeroBanner';
import { CatalogGrid } from './components/CatalogGrid';
import { CartDrawer } from './components/CartDrawer';
import { CheckoutModal } from './components/CheckoutModal';
import { CustomOrderModal } from './components/CustomOrderModal';
import { SocialStrip } from './components/SocialStrip';
import { Footer } from './components/Footer';
import { OrderSuccess } from './components/OrderSuccess';
import { createCheckoutSession } from './services/stripe';
import { SettingsProvider, useSettings } from './context/SettingsContext';
import { AdminPortal } from './components/admin/AdminPortal';
import { AnnouncementBanner } from './components/AnnouncementBanner';
import productsData from './data/products.json';
import { Product } from './types';
import { getStoredProducts, saveStoredProducts, PRODUCTS_STORAGE_KEY } from './utils/productUtils';
import { adminApi } from './services/adminApi';

export const AppContent: React.FC = () => {
  const { items, setIsCartOpen } = useCart();
  const { settings } = useSettings();
  const [isCustomModalOpen, setIsCustomModalOpen] = useState(false);
  const [isLoadingCheckout, setIsLoadingCheckout] = useState(false);
  const [checkoutClientSecret, setCheckoutClientSecret] = useState<string | null>(null);

  // Defensively normalize productsData and hydrate from persisted admin updates
  const [products, setProducts] = useState<Product[]>(() => {
    const rawProducts = (productsData as any)?.products || productsData;
    const defaults: Product[] = Array.isArray(rawProducts) ? rawProducts : [];
    return getStoredProducts(defaults);
  });

  useEffect(() => {
    if (import.meta.env.MODE === 'test') return;
    if (localStorage.getItem(PRODUCTS_STORAGE_KEY)) return;
    adminApi.loadStoreData().then((data) => {
      if (data?.products && Array.isArray(data.products)) {
        setProducts(data.products);
        saveStoredProducts(data.products);
      }
    });
  }, []);

  // Check if viewing order success
  const isSuccessPage =
    window.location.pathname === '/order-success' ||
    window.location.search.includes('session_id') ||
    window.location.search.includes('demo_mode');

  if (isSuccessPage) {
    return <OrderSuccess />;
  }

  if (['/admin', '/admin/'].includes(window.location.pathname)) {
    return <AdminPortal />;
  }

  const handleCheckout = async (giftNote: string) => {
    setIsLoadingCheckout(true);
    try {
      const session = await createCheckoutSession(items, giftNote);
      if (session.client_secret) {
        setIsCartOpen(false);
        setCheckoutClientSecret(session.client_secret);
      } else if (session.url) {
        window.location.href = session.url;
      } else {
        throw new Error('Checkout session response missing client_secret');
      }
    } catch (err: any) {
      alert(`Checkout error: ${err.message || 'Please try again.'}`);
    } finally {
      setIsLoadingCheckout(false);
    }
  };

  const scrollToCatalog = () => {
    const el = document.getElementById('catalog');
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen flex flex-col bg-weeble-pinkBg">
      <AnnouncementBanner banner={settings.announcementBanner} />
      <Navbar onOpenCustomModal={() => setIsCustomModalOpen(true)} />

      <main className="flex-1">
        <HeroBanner
          onExploreClick={scrollToCatalog}
          onCustomClick={() => setIsCustomModalOpen(true)}
        />

        <SocialStrip />

        <CatalogGrid
          products={products}
          onOpenCustomModal={() => setIsCustomModalOpen(true)}
        />
      </main>

      <Footer />

      <CartDrawer
        onCheckout={handleCheckout}
        isLoadingCheckout={isLoadingCheckout}
      />

      <CheckoutModal
        clientSecret={checkoutClientSecret}
        onClose={() => setCheckoutClientSecret(null)}
      />

      <CustomOrderModal
        isOpen={isCustomModalOpen}
        onClose={() => setIsCustomModalOpen(false)}
      />
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <SettingsProvider>
      <CartProvider>
        <AppContent />
      </CartProvider>
    </SettingsProvider>
  );
};

export default App;
