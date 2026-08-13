import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { getSystemAnnouncements, fetchCloudAnnouncements, subscribeAnnouncementsRealtime, getReadAnnouncementIds } from '../lib/announcements';

export default function Header({
  activeTab,
  setActiveTab,
  activeCategory,
  setActiveCategory,
  searchQuery,
  setSearchQuery,
  searchCategory,
  setSearchCategory,
  cartCount,
  onOpenCart,
  onOpenAuth,
  onOpenAddProduct,
  onOpenTopUp,
  onOpenOrders,
  onOpenUserDashboard,
  onOpenCoinsModal,
  onOpenAnnouncements
}) {
  const { user, userProfile } = useAuth();
  const [announcements, setAnnouncements] = useState(getSystemAnnouncements());
  const [readIds, setReadIds] = useState(getReadAnnouncementIds());

  useEffect(() => {
    fetchCloudAnnouncements().then(data => {
      if (data && data.length > 0) setAnnouncements(data);
    });

    const unsubscribe = subscribeAnnouncementsRealtime((newBroadcast) => {
      setAnnouncements(prev => [newBroadcast, ...prev]);
    });

    const handleStorageChange = () => {
      setReadIds(getReadAnnouncementIds());
      setAnnouncements(getSystemAnnouncements());
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('announcements_updated', handleStorageChange);

    return () => {
      unsubscribe();
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('announcements_updated', handleStorageChange);
    };
  }, []);

  const unreadCount = announcements.filter(a => !readIds.includes(a.id)).length;

  const handleGoHome = () => {
    setActiveTab('home');
    setActiveCategory('ALL');
    if (setSearchQuery) setSearchQuery('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <header className="bg-gradient-to-r from-red-600 via-rose-600 to-red-700 text-white shadow-md sticky top-0 z-40 font-sans border-b border-red-800">
      
      {/* 1. THANH HEADER CHÍNH CỐ ĐỊNH Ở TRÊN CÙNG (FRESH RED HEADER BACKGROUND) */}
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-2.5 flex items-center justify-between gap-2.5 sm:gap-4">
        
        {/* LOGO THƯƠNG HIỆU */}
        <div 
          className="flex items-center gap-2 cursor-pointer group shrink-0"
          onClick={handleGoHome}
        >
          <div className="w-9 h-9 bg-white text-red-600 rounded-xl flex items-center justify-center font-black text-lg shadow-md group-hover:scale-105 transition-transform">
            TQ
          </div>
          <div className="hidden sm:flex flex-col">
            <span className="text-lg font-black tracking-wider text-white leading-tight">TQ Store</span>
            <span className="text-[9px] text-amber-200 font-semibold tracking-tight">
              Siêu Chợ Việt Nam 24/7
            </span>
          </div>
        </div>

        {/* THANH TÌM KIẾM BO GÓC BÊN TRONG CÓ KÍNH LÚP */}
        <div className="flex-1 max-w-xl flex items-center bg-white rounded-full p-1 shadow-inner focus-within:ring-2 focus-within:ring-amber-300 transition-all">
          <i className="fa-solid fa-magnifying-glass text-gray-400 text-xs ml-3 mr-2 shrink-0"></i>
          
          <input 
            type="text" 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm sản phẩm, thời trang, F&B, taxi hoả tốc..." 
            className="w-full bg-transparent text-xs text-gray-900 focus:outline-none placeholder-gray-400 font-medium py-1"
          />

          <select 
            value={searchCategory}
            onChange={(e) => setSearchCategory(e.target.value)}
            className="hidden md:block bg-gray-100 text-gray-800 text-[11px] font-bold px-2.5 py-1 rounded-full border-none focus:outline-none cursor-pointer mr-1"
          >
            <option value="ALL">Tất cả</option>
            <option value="RENTAL">👗 Thuê Đồ</option>
            <option value="RETAIL">🛍️ Bán Đồ</option>
            <option value="FNB">🧋 F&B</option>
            <option value="BEAUTY">💄 Spa</option>
          </select>
        </div>

        {/* CỤM ICONS BÊN PHẢI THANH TÌM KIẾM: TIN NHẮN, CHUÔNG THÔNG BÁO, GIỎ HÀNG, NÚT "TÔI" NÂU VÀNG */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
          
          {/* ICON 1: TIN NHẮN (MESSAGE ICON) */}
          <a 
            href="#chat"
            onClick={(e) => { e.preventDefault(); alert("💬 Hộp thư nhắn tin Realtime: Kết nối trực tiếp Chủ Shop & Tài Xế!"); }}
            className="w-8 sm:w-9 h-8 sm:h-9 rounded-full bg-red-700/60 hover:bg-red-800 flex items-center justify-center text-white transition-colors cursor-pointer relative"
            title="Tin nhắn thoại / Chat"
          >
            <i className="fa-solid fa-comment-dots text-sm"></i>
          </a>

          {/* ICON 2: CHUÔNG THÔNG BÁO (NOTIFICATION BELL WITH RED BADGE COUNTER) */}
          <button 
            onClick={onOpenAnnouncements}
            className="w-8 sm:w-9 h-8 sm:h-9 rounded-full bg-red-700/60 hover:bg-red-800 flex items-center justify-center text-white transition-colors cursor-pointer relative"
            title="Thông báo toàn hệ thống từ Admin"
          >
            <i className={`fa-solid fa-bell text-sm ${unreadCount > 0 ? 'text-amber-300 animate-bounce' : 'text-white'}`}></i>
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-amber-400 text-red-950 font-black text-[9px] min-w-[17px] h-4 rounded-full flex items-center justify-center border-2 border-red-600 px-1 shadow-md animate-pulse font-mono">
                {unreadCount}
              </span>
            )}
          </button>

          {/* ICON 3: GIỎ HÀNG (SHOPPING CART ICON WITH BADGE) */}
          <button 
            onClick={onOpenCart}
            className="w-8 sm:w-9 h-8 sm:h-9 rounded-full bg-red-700/60 hover:bg-red-800 flex items-center justify-center text-white transition-colors cursor-pointer relative"
            title="Xem giỏ hàng"
          >
            <i className="fa-solid fa-cart-shopping text-sm"></i>
            <span className="absolute -top-1 -right-1 bg-amber-400 text-red-950 text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center shadow font-mono border border-red-600">
              {cartCount}
            </span>
          </button>

          {/* ICON 4: NÚT 'TÔI' BO GÓC MÀU NÂU VÀNG (GOLDEN-BROWN PROFILE BUTTON) */}
          {!user ? (
            <button 
              onClick={() => onOpenAuth('login')}
              className="bg-gradient-to-r from-amber-600 via-amber-700 to-yellow-700 hover:from-amber-700 hover:to-yellow-800 text-white font-extrabold text-xs px-3.5 sm:px-4 py-1.5 rounded-full shadow-md transition-all cursor-pointer flex items-center gap-1.5 border border-amber-300/80"
              title="Đăng nhập / Đăng ký"
            >
              <div className="w-4 h-4 rounded-full bg-amber-200 text-amber-900 flex items-center justify-center text-[10px] font-black">
                <i className="fa-solid fa-user"></i>
              </div>
              <span>Tôi</span>
            </button>
          ) : (
            <button 
              onClick={onOpenUserDashboard}
              className="bg-gradient-to-r from-amber-600 via-amber-700 to-yellow-700 hover:from-amber-700 hover:to-yellow-800 text-white font-extrabold text-xs px-3 sm:px-4 py-1.5 rounded-full shadow-md transition-all cursor-pointer flex items-center gap-1.5 border border-amber-300/80 hover:scale-105"
              title="Trang quản lý cá nhân - Mục Tôi"
            >
              <div className="w-4 h-4 rounded-full bg-amber-300 text-amber-950 font-black flex items-center justify-center text-[9px] shrink-0 overflow-hidden border border-white">
                {userProfile.avatar ? (
                  <img src={userProfile.avatar} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <i className="fa-solid fa-user"></i>
                )}
              </div>
              <span className="font-black text-white">Tôi</span>
            </button>
          )}

        </div>
      </div>

      {/* 2. THANH DANH MỤC PHỤ (NỀN ĐỎ - SUB-CATEGORY NAVBAR BELOW HEADER) */}
      <nav className="bg-red-700 text-white border-t border-red-500/50 shadow-inner">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 flex items-center space-x-1.5 overflow-x-auto scrollbar-none text-xs font-bold py-1.5">
          <button 
            onClick={handleGoHome}
            className={`px-3.5 py-1.5 rounded-full flex items-center gap-1.5 transition-all cursor-pointer shrink-0 ${
              activeTab === 'home' && activeCategory === 'ALL' ? 'bg-amber-400 text-red-950 font-black shadow' : 'hover:bg-red-600 text-white'
            }`}
          >
            <i className="fa-solid fa-house"></i>
            <span>Trang chủ</span>
          </button>

          <button 
            onClick={() => { setActiveTab('home'); setActiveCategory('RENTAL'); }}
            className={`px-3.5 py-1.5 rounded-full transition-all cursor-pointer shrink-0 ${
              activeTab === 'home' && activeCategory === 'RENTAL' ? 'bg-amber-400 text-red-950 font-black shadow' : 'hover:bg-red-600 text-white'
            }`}
          >
            👗 Thuê Đồ Cưới
          </button>

          <button 
            onClick={() => { setActiveTab('home'); setActiveCategory('RETAIL'); }}
            className={`px-3.5 py-1.5 rounded-full transition-all cursor-pointer shrink-0 ${
              activeTab === 'home' && activeCategory === 'RETAIL' ? 'bg-amber-400 text-red-950 font-black shadow' : 'hover:bg-red-600 text-white'
            }`}
          >
            🛍️ Shop Bán Đồ
          </button>

          <button 
            onClick={() => { setActiveTab('home'); setActiveCategory('FNB'); }}
            className={`px-3.5 py-1.5 rounded-full transition-all cursor-pointer shrink-0 ${
              activeTab === 'home' && activeCategory === 'FNB' ? 'bg-amber-400 text-red-950 font-black shadow' : 'hover:bg-red-600 text-white'
            }`}
          >
            🧋 Đồ Ăn & Trà Sữa
          </button>

          <button 
            onClick={() => { setActiveTab('home'); setActiveCategory('BEAUTY'); }}
            className={`px-3.5 py-1.5 rounded-full transition-all cursor-pointer shrink-0 ${
              activeTab === 'home' && activeCategory === 'BEAUTY' ? 'bg-amber-400 text-red-950 font-black shadow' : 'hover:bg-red-600 text-white'
            }`}
          >
            💄 Làm Đẹp & Spa
          </button>

          {user && (
            <button 
              onClick={onOpenOrders}
              className={`px-3.5 py-1.5 rounded-full transition-all flex items-center gap-1 text-amber-200 hover:text-white cursor-pointer shrink-0 ${
                activeTab === 'orders' ? 'bg-amber-400 text-red-950 font-black shadow' : 'hover:bg-red-600'
              }`}
            >
              📦 Lịch sử đơn hàng
            </button>
          )}
        </div>
      </nav>

    </header>
  );
}
