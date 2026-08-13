import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import Header from './components/Header';
import HeroBanner from './components/HeroBanner';
import ProductList from './components/ProductList';
import AuthModal from './components/AuthModal';
import CartDrawer from './components/CartDrawer';
import RealtimeChat from './components/RealtimeChat';
import AddProductModal from './components/AddProductModal';
import OrderHistoryModal from './components/OrderHistoryModal';
import TopUpModal from './components/TopUpModal';
import UserDashboardModal from './components/UserDashboardModal';
import CoinsModal from './components/CoinsModal';
import SuperAdminModal from './components/SuperAdminModal';
import ShopSettingsModal from './components/ShopSettingsModal';
import BroadcastAnnouncementModal from './components/BroadcastAnnouncementModal';
import TaxiBookingModal from './components/TaxiBookingModal';
import UserLocationModal from './components/UserLocationModal';
import JobsModal from './components/JobsModal';
import MaintenanceOverlay from './components/MaintenanceOverlay';
import Footer from './components/Footer';
import { fetchCloudSystemThemeConfig, subscribeSystemThemeRealtime, getSystemThemeConfig } from './lib/themeEngine';

function AppContent() {
  const { userProfile, isImpersonating, exitImpersonation } = useAuth();
  const [currentTheme, setCurrentTheme] = useState(getSystemThemeConfig());
  const [activeTab, setActiveTab] = useState('home');

  useEffect(() => {
    // 1. Lấy giá trị theme từ Supabase khi user truy cập trang
    fetchCloudSystemThemeConfig().then(t => {
      if (t) setCurrentTheme(t);
    });

    // 2. Thiết lập kết nối Supabase Realtime để lắng nghe sự thay đổi giao diện từ Admin mà không cần F5
    const unsubscribe = subscribeSystemThemeRealtime((newTheme) => {
      setCurrentTheme(newTheme);
    });

    return () => unsubscribe();
  }, []);
  const [activeCategory, setActiveCategory] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchCategory, setSearchCategory] = useState('ALL');

  // Cart State
  const [cartItems, setCartItems] = useState(() => {
    try {
      const saved = localStorage.getItem('tq_cart_items');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('tq_cart_items', JSON.stringify(cartItems));
    } catch (e) {
      console.error(e);
    }
  }, [cartItems]);

  // Modal States
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [authTab, setAuthTab] = useState('login');
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isAddProductOpen, setIsAddProductOpen] = useState(false);
  const [isOrdersOpen, setIsOrdersOpen] = useState(false);
  const [isTopUpOpen, setIsTopUpOpen] = useState(false);
  const [isUserDashboardOpen, setIsUserDashboardOpen] = useState(false);
  const [isCoinsModalOpen, setIsCoinsModalOpen] = useState(false);
  const [isSuperAdminOpen, setIsSuperAdminOpen] = useState(false);
  const [isShopSettingsOpen, setIsShopSettingsOpen] = useState(false);
  const [isAnnouncementsOpen, setIsAnnouncementsOpen] = useState(false);
  const [isTaxiModalOpen, setIsTaxiModalOpen] = useState(false);
  const [isUserLocationOpen, setIsUserLocationOpen] = useState(false);
  const [isJobsOpen, setIsJobsOpen] = useState(false);
  const [attachedChatProduct, setAttachedChatProduct] = useState(null);
  const [refreshProductsTrigger, setRefreshProductsTrigger] = useState(0);

  // Cart Action Handlers
  const handleAddToCart = (product) => {
    setCartItems((prev) => {
      const title = product.title || product.name;
      const index = prev.findIndex((item) => (item.title || item.name) === title);

      if (index > -1) {
        const updated = [...prev];
        updated[index].quantity += 1;
        return updated;
      } else {
        return [...prev, { ...product, quantity: 1 }];
      }
    });
  };

  const handleUpdateCartQty = (index, newQty) => {
    setCartItems((prev) => {
      const updated = [...prev];
      if (newQty <= 0) {
        updated.splice(index, 1);
      } else {
        updated[index].quantity = newQty;
      }
      return updated;
    });
  };

  const handleRemoveCartItem = (index) => {
    setCartItems((prev) => {
      const updated = [...prev];
      updated.splice(index, 1);
      return updated;
    });
  };

  const handleClearCart = () => {
    setCartItems([]);
  };

  const handleOpenChatWithProduct = (product) => {
    setAttachedChatProduct(product);
  };

  // Direct Shop Link Query Filter State (?shop=slug)
  const [activeShopFilter, setActiveShopFilter] = useState(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      return params.get('shop') || null;
    } catch (e) {
      return null;
    }
  });

  useEffect(() => {
    const handleUrlCheck = () => {
      const params = new URLSearchParams(window.location.search);
      const shopParam = params.get('shop');
      if (shopParam) {
        setActiveShopFilter(shopParam);
      }
    };
    window.addEventListener('popstate', handleUrlCheck);
    return () => window.removeEventListener('popstate', handleUrlCheck);
  }, []);

  const totalCartCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 text-gray-800 font-sans">
      {/* Maintenance Overlay for non-admin users */}
      <MaintenanceOverlay 
        onOpenAuth={(tab) => { setAuthTab(tab); setIsAuthOpen(true); }} 
      />

      {/* Super Admin Impersonation Mode Top Bar */}
      {isImpersonating && (
        <div className="bg-gradient-to-r from-amber-500 via-amber-600 to-orange-600 text-slate-950 font-sans px-4 py-2.5 shadow-md flex items-center justify-between gap-3 sticky top-0 z-50 animate-in slide-in-from-top duration-300">
          <div className="flex items-center gap-2 text-xs sm:text-sm font-black truncate">
            <span className="bg-slate-950 text-amber-300 px-2.5 py-0.5 rounded-lg text-[11px] uppercase tracking-wider shrink-0 shadow-xs">
              🎭 CHẾ ĐỘ XEM GIAO DIỆN
            </span>
            <span className="truncate">
              Đang xem màn hình tài khoản: <strong className="underline decoration-slate-950">{userProfile.name}</strong> ({userProfile.email}) [{userProfile.role}]
            </span>
          </div>

          <button 
            onClick={() => {
              exitImpersonation();
              setIsSuperAdminOpen(true);
            }}
            className="bg-slate-950 hover:bg-slate-900 text-amber-300 border border-amber-400/50 font-black text-xs px-4 py-1.5 rounded-full shadow-md hover:scale-105 transition-all cursor-pointer shrink-0 flex items-center gap-1.5"
          >
            <span>🔙 QUAY LẠI GIAO DIỆN QUẢN TRỊ SUPER ADMIN</span>
          </button>
        </div>
      )}

      {/* Header Navigation */}
      <Header 
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        activeCategory={activeCategory}
        setActiveCategory={setActiveCategory}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        searchCategory={searchCategory}
        setSearchCategory={setSearchCategory}
        cartCount={totalCartCount}
        onOpenCart={() => setIsCartOpen(true)}
        onOpenAuth={(tab) => { setAuthTab(tab); setIsAuthOpen(true); }}
        onOpenAddProduct={() => setIsAddProductOpen(true)}
        onOpenTopUp={() => setIsTopUpOpen(true)}
        onOpenOrders={() => setIsOrdersOpen(true)}
        onOpenUserDashboard={() => setIsUserDashboardOpen(true)}
        onOpenCoinsModal={() => setIsCoinsModalOpen(true)}
        onOpenAnnouncements={() => setIsAnnouncementsOpen(true)}
      />

      {/* Main Content Area */}
      <main className="flex-grow max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-8">
        
        {activeTab === 'home' && (
          <>
            {/* Promotional Banner & Category Quick Links (Ẩn khi truy cập link shop riêng) */}
            {!activeShopFilter && (
              <HeroBanner 
                activeCategory={activeCategory}
                setActiveCategory={setActiveCategory}
                onOpenTopUp={() => setIsTopUpOpen(true)}
                onOpenOrders={() => setIsOrdersOpen(true)}
                onOpenTaxiModal={() => setIsTaxiModalOpen(true)}
                onOpenJobsModal={() => setIsJobsOpen(true)}
              />
            )}

            {/* Product Grid Connected to Supabase */}
            <ProductList 
              activeCategory={activeCategory}
              setActiveCategory={setActiveCategory}
              searchQuery={searchQuery}
              searchCategory={searchCategory}
              activeShopFilter={activeShopFilter}
              onClearShopFilter={() => {
                setActiveShopFilter(null);
                const url = new URL(window.location.href);
                url.searchParams.delete('shop');
                window.history.pushState({}, '', url.toString());
              }}
              onAddToCart={handleAddToCart}
              onOpenChat={handleOpenChatWithProduct}
              refreshTrigger={refreshProductsTrigger}
              onOpenLocationModal={() => setIsUserLocationOpen(true)}
            />
          </>
        )}

      </main>

      {/* Floating Supabase Realtime Live Chat Widget */}
      <RealtimeChat 
        attachedProduct={attachedChatProduct}
        onClearAttachedProduct={() => setAttachedChatProduct(null)}
      />

      {/* Modals & Drawers */}
      <AuthModal 
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        initialTab={authTab}
      />

      <CartDrawer 
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        cartItems={cartItems}
        onUpdateQty={handleUpdateCartQty}
        onRemoveItem={handleRemoveCartItem}
        onClearCart={handleClearCart}
        onOrderSuccess={() => setIsOrdersOpen(true)}
      />

      <AddProductModal 
        isOpen={isAddProductOpen}
        onClose={() => setIsAddProductOpen(false)}
        onProductAdded={() => setRefreshProductsTrigger((c) => c + 1)}
      />

      <OrderHistoryModal 
        isOpen={isOrdersOpen}
        onClose={() => setIsOrdersOpen(false)}
      />

      <TopUpModal 
        isOpen={isTopUpOpen}
        onClose={() => setIsTopUpOpen(false)}
      />

      <UserDashboardModal 
        isOpen={isUserDashboardOpen}
        onClose={() => setIsUserDashboardOpen(false)}
        onOpenOrders={() => setIsOrdersOpen(true)}
        onOpenTopUp={() => setIsTopUpOpen(true)}
        onOpenSuperAdmin={() => setIsSuperAdminOpen(true)}
        onOpenCoinsModal={() => setIsCoinsModalOpen(true)}
        onOpenShopSettings={() => setIsShopSettingsOpen(true)}
      />

      <CoinsModal 
        isOpen={isCoinsModalOpen}
        onClose={() => setIsCoinsModalOpen(false)}
      />

      <SuperAdminModal 
        isOpen={isSuperAdminOpen}
        onClose={() => setIsSuperAdminOpen(false)}
        onOpenAddProduct={() => setIsAddProductOpen(true)}
      />

      <ShopSettingsModal 
        isOpen={isShopSettingsOpen}
        onClose={() => setIsShopSettingsOpen(false)}
      />

      {/* Broadcast Announcement Modal & Floating Widget */}
      <BroadcastAnnouncementModal 
        isOpen={isAnnouncementsOpen}
        onClose={() => setIsAnnouncementsOpen(false)}
      />

      {/* Taxi Booking & Ride Choices Modal */}
      <TaxiBookingModal 
        isOpen={isTaxiModalOpen}
        onClose={() => setIsTaxiModalOpen(false)}
      />

      {/* User Live GPS Location Management Modal */}
      <UserLocationModal 
        isOpen={isUserLocationOpen}
        onClose={() => setIsUserLocationOpen(false)}
      />

      {/* Quick Job Search & Recruitment Suite Modal */}
      <JobsModal 
        isOpen={isJobsOpen}
        onClose={() => setIsJobsOpen(false)}
      />

      {/* Footer */}
      <Footer />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
