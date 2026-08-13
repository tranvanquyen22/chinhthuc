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
  const { user, userProfile, signOut } = useAuth();
  const [announcements, setAnnouncements] = useState(getSystemAnnouncements());
  const [readIds, setReadIds] = useState(getReadAnnouncementIds());
  const [lang, setLang] = useState('VIE');

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

  return (
    <header className="bg-white shadow-sm sticky top-0 z-40 border-b border-gray-100 font-sans">
      {/* Top Main Navigation Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2.5 flex items-center justify-between gap-4">
        
        {/* ================= GÓC TRÁI: LOGO & SLOGAN ================= */}
        <div 
          className="flex items-center gap-2.5 cursor-pointer group shrink-0"
          onClick={() => { setActiveTab('home'); setActiveCategory('ALL'); }}
        >
          <div className="w-10 h-10 bg-navy rounded-xl flex items-center justify-center text-amber-400 font-black text-xl shadow-md group-hover:scale-105 transition-transform">
            TQ
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-1">
              <span className="text-2xl font-black tracking-wider text-navy">TQ Store</span>
              <span className="w-2.5 h-2.5 bg-orange-custom rounded-full group-hover:scale-125 transition-transform"></span>
            </div>
            <span className="text-[10px] text-gray-500 font-semibold tracking-tight">
              Marketplace Multi-Model & Realtime
            </span>
          </div>
        </div>

        {/* ================= KHU VỰC GIỮA: DROPDOWN & THANH TÌM KIẾM ================= */}
        <div className="flex-1 max-w-2xl hidden md:flex items-center bg-gray-100 rounded-full border border-gray-200 focus-within:border-navy focus-within:bg-white focus-within:shadow-md transition-all p-0.5">
          {/* Dropdown Menu: Tất cả sản phẩm */}
          <select 
            value={searchCategory}
            onChange={(e) => setSearchCategory(e.target.value)}
            className="bg-transparent px-3.5 py-2 text-xs font-bold text-gray-700 border-r border-gray-300 focus:outline-none cursor-pointer hover:text-navy"
          >
            <option value="ALL">Tất cả sản phẩm</option>
            <option value="RENTAL">👗 Thuê Đồ</option>
            <option value="RETAIL">🛍️ Bán Đồ</option>
            <option value="FNB">🧋 Đồ Ăn & Uống</option>
            <option value="BEAUTY">💄 Làm Đẹp & Spa</option>
          </select>

          {/* Search Input Bar */}
          <input 
            type="text" 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm trang phục thuê, sản phẩm, đồ ăn..." 
            className="w-full bg-transparent px-4 py-2 text-xs text-gray-800 focus:outline-none placeholder-gray-400 font-medium"
          />

          {/* Search Button (Biểu tượng Kính Lúp Bo Tròn Xanh Thẫm) */}
          <button className="bg-navy hover:bg-navy-dark text-amber-300 w-9 h-9 rounded-full flex items-center justify-center transition-all cursor-pointer shrink-0 mr-0.5 shadow-sm">
            <i className="fa-solid fa-magnifying-glass text-xs"></i>
          </button>
        </div>

        {/* ================= GÓC PHẢI: CTA, NÚT TÀI KHOẢN VIÊN THUỐC & ICONS ================= */}
        <div className="flex items-center gap-3 shrink-0">

          {/* Nút Call to Action (CTA): Việc Làm TQ (Viền Xanh Lá) */}
          <a
            href="#jobs"
            onClick={(e) => { e.preventDefault(); alert("🚀 Phân hệ Việc Làm TQ Store: Tuyển dụng Nhân viên, CTV Shop & Tài xế giao hàng!"); }}
            className="bg-white hover:bg-emerald-50 text-emerald-700 border-2 border-emerald-600 px-3.5 py-1.5 rounded-full font-bold text-xs transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
          >
            <i className="fa-solid fa-briefcase text-emerald-600 text-xs"></i>
            <span>Việc Làm TQ</span>
          </a>

          {/* Nút Đăng sản phẩm mới (dành cho Vendor/Shop) */}
          {user && (userProfile.role === 'SHOP' || userProfile.role === 'SUPER_ADMIN') && (
            <button 
              onClick={onOpenAddProduct}
              className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 text-white px-3.5 py-1.5 rounded-full text-xs font-black shadow-md transition-all flex items-center gap-1 cursor-pointer"
            >
              <i className="fa-solid fa-plus-circle text-amber-300"></i> ĐĂNG SP
            </button>
          )}

          {/* Nút "Tôi" (Hình Người) & Cụm Nút Ví Số Dư - Ví Xu */}
          {!user ? (
            <button 
              onClick={() => onOpenAuth('login')}
              className="bg-navy hover:bg-navy-dark text-white px-4 py-1.5 rounded-full text-xs font-extrabold shadow-sm transition-all flex items-center gap-1.5 cursor-pointer border border-amber-400/50"
              title="Tôi - Đăng nhập / Đăng ký"
            >
              <div className="w-5 h-5 bg-amber-400 text-navy rounded-full flex items-center justify-center text-xs font-black">
                <i className="fa-solid fa-user"></i>
              </div>
              <span>Tôi</span>
            </button>
          ) : (
            <div className="flex items-center gap-2">
              {/* Nút 1: Nút Ví Số Dư TQ Pay */}
              <div 
                onClick={onOpenTopUp}
                className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 text-white text-xs font-black px-3 py-1.5 rounded-full shadow-sm flex items-center gap-1 cursor-pointer hover:scale-105 transition-transform"
                title="Số dư Ví TQ Pay - Chạm để Nạp / Rút tiền"
              >
                <i className="fa-solid fa-wallet text-amber-300 text-xs"></i>
                <span>Ví: {Number(userProfile.walletBalance || 0).toLocaleString('vi-VN')}đ</span>
              </div>

              {/* Nút 2: Nút Ví Xu TQ -> Mở Bảng Số Dư Xu TQ */}
              <div 
                onClick={onOpenCoinsModal}
                className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 text-white text-xs font-black px-3 py-1.5 rounded-full shadow-sm flex items-center gap-1 cursor-pointer hover:scale-105 transition-transform"
                title="Số dư Xu TQ - Chạm để xem Bảng Số Dư Xu"
              >
                <i className="fa-solid fa-coins text-yellow-200 text-xs"></i>
                <span>Xu: {Number(userProfile.coins || 0).toLocaleString('vi-VN')} Xu</span>
              </div>

              {/* Nút 3: Nút "Tôi" (Hình người) -> Mở Dashboard Tác Vụ Nhanh */}
              <button 
                onClick={onOpenUserDashboard}
                className="bg-navy hover:bg-navy-dark text-white px-3.5 py-1.5 rounded-full text-xs font-extrabold flex items-center gap-1.5 border border-amber-400/80 shadow transition-all cursor-pointer hover:scale-105"
                title="Mở Các Nút Tác Vụ Nhanh - Mục Tôi"
              >
                <div className="w-5 h-5 rounded-full bg-amber-400 text-navy font-black flex items-center justify-center text-[10px] shrink-0 overflow-hidden border border-white">
                  {userProfile.avatar ? (
                    <img src={userProfile.avatar} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    <i className="fa-solid fa-user"></i>
                  )}
                </div>
                <span className="font-extrabold text-amber-300">Tôi</span>
              </button>
            </div>
          )}

          {/* Cụm Icon Tiện Ích: Ngôn Ngữ, Thông Báo (Chuông) & Giỏ Hàng */}
          <div className="flex items-center gap-2 pl-1 border-l border-gray-200">
            
            {/* Icon Ngôn Ngữ / Chung */}
            <button 
              onClick={() => setLang(lang === 'VIE' ? 'ENG' : 'VIE')}
              className="w-8 h-8 rounded-full flex items-center justify-center text-gray-600 hover:text-navy hover:bg-gray-100 transition-colors cursor-pointer text-xs font-bold"
              title="Đổi ngôn ngữ"
            >
              <i className="fa-solid fa-globe text-sm"></i>
            </button>

            {/* Icon Thông Báo (Chuông Trên Cùng - Nhận Thông Báo Realtime từ Admin) */}
            <button 
              onClick={onOpenAnnouncements}
              className="relative w-8.5 h-8.5 rounded-full flex items-center justify-center text-gray-700 hover:text-navy hover:bg-gray-100 transition-colors cursor-pointer"
              title="Thông báo toàn hệ thống từ Admin"
            >
              <i className={`fa-solid fa-bell text-base ${unreadCount > 0 ? 'text-red-600 animate-bounce' : 'text-gray-700'}`}></i>
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 bg-red-600 text-white font-black text-[9px] min-w-[17px] h-4 rounded-full flex items-center justify-center border-2 border-white px-1 shadow-md animate-pulse font-mono">
                  {unreadCount}
                </span>
              )}
            </button>

            {/* Icon Giỏ Hàng (Cart) */}
            <button 
              onClick={onOpenCart}
              className="relative w-8 h-8 rounded-full flex items-center justify-center text-navy hover:text-orange-custom hover:bg-orange-50 transition-colors cursor-pointer"
              title="Xem giỏ hàng"
            >
              <i className="fa-solid fa-cart-shopping text-sm"></i>
              <span className="absolute -top-1 -right-1 bg-orange-custom text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center shadow">
                {cartCount}
              </span>
            </button>

          </div>

        </div>
      </div>

      {/* Navigation Sub-Menu Categories */}
      <nav className="bg-navy text-white shadow-inner">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center space-x-1 overflow-x-auto scrollbar-none text-xs font-semibold py-1">
          <button 
            onClick={() => { setActiveTab('home'); setActiveCategory('ALL'); }}
            className={`px-4 py-2 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer ${
              activeTab === 'home' && activeCategory === 'ALL' ? 'bg-orange-custom text-white' : 'hover:bg-navy-light'
            }`}
          >
            <i className="fa-solid fa-house"></i> Trang chủ
          </button>

          <button 
            onClick={() => { setActiveTab('home'); setActiveCategory('RENTAL'); }}
            className={`px-3.5 py-2 rounded-lg transition-colors cursor-pointer ${
              activeTab === 'home' && activeCategory === 'RENTAL' ? 'bg-orange-custom text-white' : 'hover:bg-navy-light'
            }`}
          >
            👗 Cho Thuê Đồ
          </button>

          <button 
            onClick={() => { setActiveTab('home'); setActiveCategory('RETAIL'); }}
            className={`px-3.5 py-2 rounded-lg transition-colors cursor-pointer ${
              activeTab === 'home' && activeCategory === 'RETAIL' ? 'bg-orange-custom text-white' : 'hover:bg-navy-light'
            }`}
          >
            🛍️ Shop Bán Đồ
          </button>

          <button 
            onClick={() => { setActiveTab('home'); setActiveCategory('FNB'); }}
            className={`px-3.5 py-2 rounded-lg transition-colors cursor-pointer ${
              activeTab === 'home' && activeCategory === 'FNB' ? 'bg-orange-custom text-white' : 'hover:bg-navy-light'
            }`}
          >
            🧋 Đồ Ăn & Uống
          </button>

          <button 
            onClick={() => { setActiveTab('home'); setActiveCategory('BEAUTY'); }}
            className={`px-3.5 py-2 rounded-lg transition-colors cursor-pointer ${
              activeTab === 'home' && activeCategory === 'BEAUTY' ? 'bg-orange-custom text-white' : 'hover:bg-navy-light'
            }`}
          >
            💄 Làm Đẹp & Spa
          </button>

          {user && (
            <button 
              onClick={onOpenOrders}
              className={`px-3.5 py-2 rounded-lg transition-colors flex items-center gap-1 text-amber-300 cursor-pointer ${
                activeTab === 'orders' ? 'bg-orange-custom text-white' : 'hover:bg-navy-light'
              }`}
            >
              📦 Lịch sử đơn & Ví Xu
            </button>
          )}
        </div>
      </nav>
    </header>
  );
}
