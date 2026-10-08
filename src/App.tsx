import React, { useState } from 'react';
import { CartProvider, useCart } from './context/CartContext';
import { Navbar } from './components/Navbar';
import { HeroBanner } from './components/HeroBanner';
import { CatalogGrid } from './components/CatalogGrid';
import { CartDrawer } from './components/CartDrawer';
import { CustomOrderModal } from './components/CustomOrderModal';
import { SocialStrip } from './components/SocialStrip';
import { Footer } from './components/Footer';
import { OrderSuccess } from './components/OrderSuccess';
import { createCheckoutSession } from './services/stripe';
import { SettingsProvider } from './context/SettingsContext';
import { AdminPortal } from './components/admin/AdminPortal';
import productsData from './data/products.json';
import { Product } from './types';

export const AppContent: React.FC = () => {
  const { items } = useCart();
  const [isCustomModalOpen, setIsCustomModalOpen] = useState(false);
  const [isLoadingCheckout, setIsLoadingCheckout] = useState(false);

  // Defensively normalize productsData
  const rawProducts = (productsData as any)?.products || productsData;
  const products: Product[] = Array.isArray(rawProducts) ? rawProducts : [];

  // Check if viewing order success
  const isSuccessPage =
    window.location.pathname === '/order-success' ||
    window.location.search.includes('session_id') ||
    window.location.search.includes('demo_mode');

  if (isSuccessPage) {
    return <OrderSuccess />;
  }

  if (window.location.pathname === '/admin') {
    return <AdminPortal />;
  }

  const handleCheckout = async (giftNote: string) => {
    setIsLoadingCheckout(true);
    try {
      const session = await createCheckoutSession(items, giftNote);
      window.location.href = session.url;
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
