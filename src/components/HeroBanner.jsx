import React, { useState, useEffect } from 'react';
import { getSystemThemeConfig } from '../lib/themeEngine';

export default function HeroBanner({ activeCategory, setActiveCategory, onOpenTopUp, onOpenOrders, onOpenTaxiModal, onOpenJobsModal }) {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [activeThemeConfig, setActiveThemeConfig] = useState(getSystemThemeConfig());

  useEffect(() => {
    const handleThemeChange = (e) => {
      if (e.detail) setActiveThemeConfig(e.detail);
    };

    window.addEventListener('system_theme_changed', handleThemeChange);
    return () => window.removeEventListener('system_theme_changed', handleThemeChange);
  }, []);

  const mainSlides = [
    {
      id: 1,
      badge: activeThemeConfig.eventTag || 'FREESHIP EXTRA',
      title: activeThemeConfig.bannerTitle || 'GIAN HÀNG CHÍNH HÃNG 100%',
      subTitle: 'Trải nghiệm mua sắm, thuê đồ & dịch vụ chất lượng cao với ưu đãi độc quyền TQ Store',
      btnText: 'MUA SẮM NGAY',
      img: 'https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=1000&q=80',
      bgGradient: activeThemeConfig.bgGradient || 'from-navy via-indigo-950 to-slate-900'
    },
    {
      id: 2,
      badge: 'ƯU ĐÃI THÀNH VIÊN',
      title: 'THANH TOÁN VÍ TQ PAY GIẢM THÊM 2%',
      subTitle: 'Dùng TQ Xu khấu trừ tới 50% đơn hàng. Đánh giá hoàn 3% Xu tức thì!',
      btnText: 'NẠP VÍ TQ PAY',
      img: 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?auto=format&fit=crop&w=1000&q=80',
      bgGradient: 'from-emerald-900 via-teal-900 to-slate-900'
    },
    {
      id: 3,
      badge: 'BỘ SƯU TẬP MỚI',
      title: 'CHO THUÊ TRANG PHỤC CƯỚI & DẠ HỘI',
      subTitle: 'Hơn 500+ mẫu váy cưới, veston cao cấp với chi phí cọc cực ưu đãi',
      btnText: 'THUÊ ĐỒ NGAY',
      img: 'https://images.unsplash.com/photo-1594552072238-b8a33785b261?auto=format&fit=crop&w=1000&q=80',
      bgGradient: 'from-purple-950 via-pink-950 to-slate-900'
    }
  ];

  // Auto-play main slides
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % mainSlides.length);
    }, 4500);
    return () => clearInterval(timer);
  }, [mainSlides.length]);

  // Shortcut Category Grid (4 cols x 2 rows = 8 icons)
  const categoryShortcuts = [
    {
      id: 'RENTAL',
      title: 'Cho Thuê Đồ Cưới',
      icon: 'fa-solid fa-vest-patches',
      bg: 'bg-gradient-to-br from-pink-500 to-purple-600',
      action: () => setActiveCategory('RENTAL')
    },
    {
      id: 'RETAIL',
      title: 'Shop Bán Đồ',
      icon: 'fa-solid fa-bag-shopping',
      bg: 'bg-gradient-to-br from-emerald-500 to-teal-600',
      action: () => setActiveCategory('RETAIL')
    },
    {
      id: 'FNB',
      title: 'Đồ Ăn & Trà Sữa',
      icon: 'fa-solid fa-mug-hot',
      bg: 'bg-gradient-to-br from-amber-500 to-orange-600',
      action: () => setActiveCategory('FNB')
    },
    {
      id: 'BEAUTY',
      title: 'Làm Đẹp & Spa',
      icon: 'fa-solid fa-sparkles',
      bg: 'bg-gradient-to-br from-rose-500 to-pink-600',
      action: () => setActiveCategory('BEAUTY')
    },
    {
      id: 'JOBS',
      title: 'Việc Làm TQ',
      icon: 'fa-solid fa-briefcase',
      bg: 'bg-gradient-to-br from-blue-600 to-indigo-700',
      action: onOpenJobsModal
    },
    {
      id: 'FLASH_SALE',
      title: 'Flash Sale 50%',
      icon: 'fa-solid fa-bolt-lightning',
      bg: 'bg-gradient-to-br from-red-500 to-amber-500',
      action: () => alert('⚡ Chương trình Flash Sale 50% đang diễn ra cho các gian hàng chính hãng!')
    },
    {
      id: 'VOUCHER',
      title: 'Voucher Độc Quyền',
      icon: 'fa-solid fa-ticket',
      bg: 'bg-gradient-to-br from-purple-600 to-indigo-600',
      action: () => alert('🎟️ Bạn có 2 mã giảm giá khả dụng: TQ10 (Giảm 10%) và TQ50K (Giảm 50.000đ)!')
    },
    {
      id: 'TAXI',
      title: '🚖 Taxi TQ Đặt Xe',
      icon: 'fa-solid fa-taxi',
      bg: 'bg-gradient-to-br from-amber-500 to-yellow-600',
      action: onOpenTaxiModal
    },
    {
      id: 'WALLET',
      title: 'Nạp Ví TQ Pay',
      icon: 'fa-solid fa-wallet',
      bg: 'bg-gradient-to-br from-teal-500 to-cyan-600',
      action: onOpenTopUp
    }
  ];

  return (
    <div className="space-y-6 font-sans">
      
      {/* ================= 2. KHU VỰC HERO BANNER (TỶ LỆ 2/3 - 1/3) ================= */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        
        {/* BANNER CHÍNH (BÊN TRÁI - CHIẾM 2/3 CHIỀU RỘNG) */}
        <div className="lg:col-span-2 relative rounded-2xl overflow-hidden shadow-lg border border-gray-200/80 min-h-[280px] sm:min-h-[320px] flex flex-col justify-between p-6 text-white group">
          {/* Background image & gradient overlay */}
          <div className="absolute inset-0 z-0">
            <img 
              src={mainSlides[currentSlide].img} 
              alt="Main Banner" 
              className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
            />
            <div className={`absolute inset-0 bg-gradient-to-r ${mainSlides[currentSlide].bgGradient} opacity-85 backdrop-blur-xs`}></div>
          </div>

          {/* Banner Content */}
          <div className="relative z-10 space-y-3 max-w-lg">
            <span className="inline-block bg-orange-custom text-white text-[10px] font-black uppercase px-3 py-1 rounded-full tracking-wider shadow-sm">
              ⚡ {mainSlides[currentSlide].badge}
            </span>

            <h1 className="text-2xl sm:text-3xl font-black text-amber-300 tracking-wide leading-tight uppercase drop-shadow-sm">
              {mainSlides[currentSlide].title}
            </h1>

            <p className="text-xs sm:text-sm text-gray-200 font-medium leading-relaxed">
              {mainSlides[currentSlide].subTitle}
            </p>

            <div className="pt-2">
              <button 
                onClick={() => {
                  if (currentSlide === 1) onOpenTopUp();
                  else setActiveCategory('RENTAL');
                }}
                className="bg-amber-400 hover:bg-amber-500 text-navy font-black px-6 py-2.5 rounded-xl shadow-md transition-all text-xs tracking-wider uppercase cursor-pointer hover:scale-105"
              >
                {mainSlides[currentSlide].btnText} ➔
              </button>
            </div>
          </div>

          {/* Pagination Dots (Bộ chấm chuyển slide ở mép dưới) */}
          <div className="relative z-10 flex items-center justify-center gap-2 pt-4">
            {mainSlides.map((slide, index) => (
              <button
                key={slide.id}
                onClick={() => setCurrentSlide(index)}
                className={`h-2.5 rounded-full transition-all cursor-pointer ${
                  currentSlide === index ? 'w-8 bg-amber-400' : 'w-2.5 bg-white/50 hover:bg-white'
                }`}
                title={`Slide ${index + 1}`}
              />
            ))}
          </div>
        </div>

        {/* BANNER PHỤ (BÊN PHẢI - CHIẾM 1/3 CHIỀU RỘNG, 2 Ô XẾP CHỒNG THEO CHIỀU DỌC) */}
        <div className="lg:col-span-1 flex flex-col gap-4">
          
          {/* Sub-banner Ô Trên (Gradient Tím/Hồng - Thuê Đồ Cưới) */}
          <div className="flex-1 bg-gradient-to-r from-purple-700 via-pink-600 to-rose-500 text-white p-5 rounded-2xl shadow-md border border-purple-400/30 flex flex-col justify-between relative overflow-hidden group">
            <div className="absolute -right-4 -bottom-4 opacity-20 text-6xl text-white">👗</div>
            <div className="space-y-1.5 z-10">
              <span className="bg-white/20 text-white text-[9px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                🎫 COUPON EXCLUSIVE
              </span>
              <h3 className="font-extrabold text-sm text-white leading-tight">
                Thuê Đồ Cưới & Trang Phục Cao Cấp
              </h3>
              <p className="text-[11px] text-pink-100 font-medium">Hơn 500+ mẫu đầm tiệc & vest sang trọng</p>
            </div>
            <button 
              onClick={() => setActiveCategory('RENTAL')}
              className="mt-3 text-xs font-black text-amber-300 hover:text-white flex items-center gap-1 group-hover:translate-x-1 transition-transform cursor-pointer"
            >
              <span>Khám phá ngay</span>
              <i className="fa-solid fa-arrow-right text-xs"></i>
            </button>
          </div>

          {/* Sub-banner Ô Dưới (Gradient Cam - Đồ Ăn & Trà Sữa 50%) */}
          <div className="flex-1 bg-gradient-to-r from-orange-500 via-amber-500 to-yellow-500 text-white p-5 rounded-2xl shadow-md border border-orange-400/30 flex flex-col justify-between relative overflow-hidden group">
            <div className="absolute -right-4 -bottom-4 opacity-20 text-6xl text-white">🧋</div>
            <div className="space-y-1.5 z-10">
              <span className="bg-white text-orange-600 text-[9px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider shadow-xs">
                🔥 HOT DEAL 50%
              </span>
              <h3 className="font-extrabold text-sm text-navy leading-tight">
                Đồ Ăn & Trà Sữa Giảm 50%
              </h3>
              <p className="text-[11px] text-amber-950 font-semibold">Giao nhanh 15 phút, freeship toàn quốc</p>
            </div>
            <button 
              onClick={() => setActiveCategory('FNB')}
              className="mt-3 text-xs font-black text-navy hover:text-white flex items-center gap-1 group-hover:translate-x-1 transition-transform cursor-pointer"
            >
              <span>Đặt món ngay</span>
              <i className="fa-solid fa-arrow-right text-xs"></i>
            </button>
          </div>

        </div>

      </div>

      {/* ================= 3. LƯỚI DANH MỤC TIỆN ÍCH (4 CỘT X 2 HÀNG = 8 ICON BO TRÒN) ================= */}
      <section className="bg-white p-5 rounded-2xl border border-gray-200/80 shadow-xs space-y-3">
        <div className="flex items-center justify-between border-b border-gray-100 pb-2">
          <h3 className="text-xs font-black text-navy uppercase tracking-wider flex items-center gap-1.5">
            <i className="fa-solid fa-grip text-orange-custom"></i>
            <span>DANH MỤC TIỆN ÍCH & DỊCH VỤ NHANH</span>
          </h3>
          <span className="text-[11px] text-gray-400 font-semibold">8 dịch vụ hàng đầu</span>
        </div>

        {/* Grid 4 columns x 2 rows */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
          {categoryShortcuts.map((item) => (
            <div
              key={item.id}
              onClick={item.action}
              className="flex items-center gap-3 p-2.5 rounded-xl border border-gray-100 hover:border-navy/30 hover:bg-gray-50/80 transition-all cursor-pointer group shadow-2xs"
            >
              {/* Icon vuông bo góc rực rỡ */}
              <div className={`w-11 h-11 ${item.bg} text-white rounded-xl flex items-center justify-center shadow-md group-hover:scale-110 transition-transform shrink-0`}>
                <i className={`${item.icon} text-lg`}></i>
              </div>

              {/* Nhãn tên bên cạnh/bên dưới */}
              <div className="flex flex-col">
                <span className="font-extrabold text-xs text-navy group-hover:text-orange-custom transition-colors line-clamp-1">
                  {item.title}
                </span>
                <span className="text-[9px] text-gray-400 font-semibold">TQ Marketplace</span>
              </div>
            </div>
          ))}
        </div>
      </section>

    </div>
  );
}
