import React, { useState, useEffect } from 'react';

export default function FlashSaleSection({ products, onAddToCart, onOpenChat }) {
  const [timeLeft, setTimeLeft] = useState({ hours: 2, minutes: 45, seconds: 18 });

  // Countdown Timer Simulation
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev.seconds > 0) return { ...prev, seconds: prev.seconds - 1 };
        if (prev.minutes > 0) return { ...prev, minutes: 59, seconds: 59 };
        if (prev.hours > 0) return { hours: prev.hours - 1, minutes: 59, seconds: 59 };
        return { hours: 2, minutes: 45, seconds: 18 };
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatDigit = (num) => (num < 10 ? `0${num}` : `${num}`);

  // Get flash sale items
  const flashSaleItems = products.slice(0, 6);

  return (
    <section className="bg-gradient-to-r from-red-600 via-rose-600 to-orange-600 rounded-2xl p-4 sm:p-6 shadow-md text-white font-sans space-y-4">
      {/* 1. Header Flash Sale */}
      <div className="flex items-center justify-between border-b border-white/20 pb-3">
        {/* Góc trái: Badge FLASH SALE & Tia sét & Countdown */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="bg-amber-400 text-slate-950 font-black px-3.5 py-1.5 rounded-full text-xs tracking-wider flex items-center gap-1.5 shadow-sm uppercase animate-pulse">
            <i className="fa-solid fa-bolt-lightning text-red-600 text-sm"></i>
            <span>FLASH SALE</span>
          </div>

          <div className="flex items-center gap-1.5 text-xs font-bold bg-black/30 px-3 py-1 rounded-full border border-white/20">
            <span className="text-gray-200">KẾT THÚC TRONG:</span>
            <span className="bg-amber-400 text-slate-950 px-1.5 py-0.5 rounded font-mono font-black">
              {formatDigit(timeLeft.hours)}
            </span>
            <span>:</span>
            <span className="bg-amber-400 text-slate-950 px-1.5 py-0.5 rounded font-mono font-black">
              {formatDigit(timeLeft.minutes)}
            </span>
            <span>:</span>
            <span className="bg-amber-400 text-slate-950 px-1.5 py-0.5 rounded font-mono font-black">
              {formatDigit(timeLeft.seconds)}
            </span>
          </div>
        </div>

        {/* Góc phải: Xem Tất Cả */}
        <button 
          onClick={() => alert('🔥 Bạn đang xem toàn bộ danh sách sản phẩm Flash Sale 50%!')}
          className="text-xs font-bold text-amber-300 hover:text-white flex items-center gap-1 transition-colors cursor-pointer"
        >
          <span>Xem Tất Cả</span>
          <i className="fa-solid fa-angle-right text-xs"></i>
        </button>
      </div>

      {/* 2. Horizontal Product Cards Carousel */}
      <div className="flex items-center gap-4 overflow-x-auto scrollbar-none pb-2 pt-1">
        {flashSaleItems.map((p) => {
          const originalPrice = Math.round(Number(p.price || 100000) * 1.4);
          const salePrice = Number(p.price || 0);

          return (
            <div 
              key={p.id}
              className="bg-white text-gray-800 rounded-xl p-3 shadow-sm min-w-[200px] max-w-[210px] shrink-0 border border-gray-100 flex flex-col justify-between relative group hover:scale-[1.02] transition-transform"
            >
              {/* Badge -40% */}
              <span className="absolute top-2 left-2 bg-red-600 text-white text-[9px] font-black px-2 py-0.5 rounded-full z-10 uppercase shadow-xs">
                -40% OFF
              </span>

              <div>
                <div className="h-32 bg-gray-50 rounded-lg overflow-hidden mb-2 relative border">
                  <img 
                    src={p.image_url || p.img || p.image || 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=300&q=80'} 
                    alt={p.title || p.name} 
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                  />
                </div>

                <div className="text-[9px] text-gray-400 font-bold uppercase truncate">
                  {p.shop_name || p.shopName || 'TQ Store'}
                </div>

                <h4 className="font-bold text-xs text-navy line-clamp-1">
                  {p.title || p.name}
                </h4>

                <div className="mt-1 space-y-0.5">
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-red-600 font-black text-xs">
                      {salePrice.toLocaleString('vi-VN')}đ
                    </span>
                    <span className="text-[9px] text-gray-400 line-through">
                      {originalPrice.toLocaleString('vi-VN')}đ
                    </span>
                  </div>
                </div>

                {/* Progress bar Đã bán 85% */}
                <div className="mt-2 space-y-0.5">
                  <div className="w-full bg-red-100 h-3 rounded-full overflow-hidden relative flex items-center justify-center">
                    <div className="bg-gradient-to-r from-red-500 to-orange-500 h-full w-[85%] absolute left-0 top-0 rounded-full"></div>
                    <span className="relative z-10 text-[8px] font-black text-white uppercase tracking-tighter">
                      🔥 ĐÃ BÁN 85%
                    </span>
                  </div>
                </div>
              </div>

              {/* Action buttons */}
              <div className="mt-3 space-y-1">
                <button 
                  onClick={() => onAddToCart(p)}
                  className="w-full bg-navy hover:bg-navy-dark text-white text-[10px] font-bold py-1.5 rounded-full transition-colors cursor-pointer"
                >
                  Thêm vào giỏ
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
