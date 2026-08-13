import React from 'react';

export default function Footer() {
  return (
    <footer className="bg-slate-950 text-white mt-12 pt-12 pb-8 border-t-4 border-amber-400 font-sans relative overflow-hidden">
      
      {/* Container chính 4 cột */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 pb-10 border-b border-slate-800 text-xs">
        
        {/* ================= CỘT 1: THÔNG TIN THƯƠNG HIỆU & LIÊN HỆ ================= */}
        <div className="space-y-4">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 bg-amber-400 text-navy font-black rounded-xl flex items-center justify-center text-xl shadow-md shrink-0">
              TQ
            </div>
            <div className="flex flex-col">
              <span className="text-base font-black tracking-wider text-amber-400">TQ STORE SYSTEM</span>
              <span className="text-[10px] text-gray-400 font-semibold uppercase">HỆ THỐNG MUA SẮM ĐA MÔ HÌNH</span>
            </div>
          </div>

          <p className="text-gray-300 leading-relaxed font-medium">
            Nền tảng thương mại điện tử đa mô hình tiên phong tại Việt Nam, tích hợp Cho Thuê Đồ, Shop Bán Đồ, F&B Giao Nhanh & Làm Đẹp Spa thời gian thực.
          </p>

          <div className="space-y-2.5 pt-1 text-gray-300">
            <div className="flex items-start gap-2.5">
              <i className="fa-solid fa-location-dot text-amber-400 text-sm mt-0.5 shrink-0"></i>
              <span>TQ Tower, 123 Tôn Đức Thắng, Q.1, TP. Hồ Chí Minh</span>
            </div>
            <div className="flex items-center gap-2.5">
              <i className="fa-solid fa-phone text-emerald-400 text-sm shrink-0"></i>
              <span className="font-mono font-bold text-white">1900 6868 - 0988 123 456</span>
            </div>
            <div className="flex items-center gap-2.5">
              <i className="fa-solid fa-envelope text-cyan-400 text-sm shrink-0"></i>
              <span className="font-mono">support@tqstore.vn</span>
            </div>
          </div>
        </div>

        {/* ================= CỘT 2: DANH MỤC NỔI BẬT ================= */}
        <div className="space-y-4">
          <h3 className="text-sm font-black text-amber-400 uppercase tracking-wider flex items-center gap-2 border-b border-slate-800 pb-2">
            <i className="fa-solid fa-layer-group text-amber-400"></i>
            <span>DANH MỤC NỔI BẬT</span>
          </h3>

          <ul className="space-y-2.5 text-gray-300">
            <li>
              <a href="#rental" className="hover:text-amber-400 transition-colors flex items-center gap-2">
                <i className="fa-solid fa-shirt text-pink-400 text-xs w-4"></i>
                <span>Cho Thuê Trang Phục Dạ Hội & Cưới</span>
              </a>
            </li>
            <li>
              <a href="#retail" className="hover:text-amber-400 transition-colors flex items-center gap-2">
                <i className="fa-solid fa-bag-shopping text-emerald-400 text-xs w-4"></i>
                <span>Thời Trang & Phụ Kiện Nam Nữ</span>
              </a>
            </li>
            <li>
              <a href="#fnb" className="hover:text-amber-400 transition-colors flex items-center gap-2">
                <i className="fa-solid fa-mug-hot text-amber-400 text-xs w-4"></i>
                <span>Đồ Ăn & Trà Sữa Đặt Giao 24/7</span>
              </a>
            </li>
            <li>
              <a href="#beauty" className="hover:text-amber-400 transition-colors flex items-center gap-2">
                <i className="fa-solid fa-sparkles text-rose-400 text-xs w-4"></i>
                <span>Gói Chăm Sóc Da & Spa Beauty</span>
              </a>
            </li>
            <li>
              <a href="#taxi" className="hover:text-amber-400 transition-colors flex items-center gap-2">
                <i className="fa-solid fa-taxi text-yellow-400 text-xs w-4"></i>
                <span>Đặt Xe Taxi & Dịch Vụ Đưa Đón</span>
              </a>
            </li>
          </ul>
        </div>

        {/* ================= CỘT 3: CHÍNH SÁCH & TỔNG ĐÀI ================= */}
        <div className="space-y-4">
          <h3 className="text-sm font-black text-amber-400 uppercase tracking-wider flex items-center gap-2 border-b border-slate-800 pb-2">
            <i className="fa-solid fa-shield-halved text-amber-400"></i>
            <span>CHÍNH SÁCH & HỖ TRỢ</span>
          </h3>

          <ul className="space-y-2 text-gray-300">
            <li><a href="#privacy" className="hover:text-amber-400 transition-colors">Chính sách bảo mật thông tin</a></li>
            <li><a href="#terms" className="hover:text-amber-400 transition-colors">Điều khoản sử dụng dịch vụ</a></li>
            <li><a href="#returns" className="hover:text-amber-400 transition-colors">Hướng dẫn mua hàng & Đổi trả</a></li>
            <li><a href="#shipping" className="hover:text-amber-400 transition-colors">Chính sách giao hàng & Kiểm hàng</a></li>
          </ul>

          {/* Khung Tổng đài CSKH 24/7 */}
          <div className="bg-slate-900 border border-amber-400/40 p-3.5 rounded-xl space-y-1 shadow-md">
            <span className="text-[10px] text-amber-400 font-extrabold uppercase tracking-wider block">
              📞 TỔNG ĐÀI CSKH 24/7
            </span>
            <p className="text-base font-black text-white font-mono tracking-wider">
              1900 6868 - 0988 123 456
            </p>
            <p className="text-[9px] text-gray-400">Hỗ trợ khiếu nại, tư vấn miễn phí 24/7</p>
          </div>
        </div>

        {/* ================= CỘT 4: PHƯƠNG THỨC THANH TOÁN & MẠNG XÃ HỘI ================= */}
        <div className="space-y-5">
          {/* Phương thức thanh toán */}
          <div className="space-y-3">
            <h3 className="text-xs font-black text-amber-400 uppercase tracking-wider border-b border-slate-800 pb-2">
              PHƯƠNG THỨC THANH TOÁN
            </h3>

            {/* Lưới 4 badge/nút phương thức thanh toán */}
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-emerald-600 text-white p-2 rounded-lg font-extrabold flex items-center justify-center gap-1.5 shadow-sm text-[11px]">
                <i className="fa-solid fa-wallet text-xs"></i>
                <span>Ví TQ Pay</span>
              </div>
              <div className="bg-blue-600 text-white p-2 rounded-lg font-extrabold flex items-center justify-center gap-1.5 shadow-sm text-[11px]">
                <i className="fa-solid fa-qrcode text-xs"></i>
                <span>VietQR Bank</span>
              </div>
              <div className="bg-amber-600 text-white p-2 rounded-lg font-extrabold flex items-center justify-center gap-1.5 shadow-sm text-[11px]">
                <i className="fa-solid fa-money-bill-wave text-xs"></i>
                <span>COD Tiền Mặt</span>
              </div>
              <div className="bg-purple-600 text-white p-2 rounded-lg font-extrabold flex items-center justify-center gap-1.5 shadow-sm text-[11px]">
                <i className="fa-solid fa-credit-card text-xs"></i>
                <span>Visa / Master</span>
              </div>
            </div>
          </div>

          {/* Mạng xã hội */}
          <div className="space-y-2.5 pt-1">
            <h3 className="text-xs font-black text-amber-400 uppercase tracking-wider">
              KẾT NỐI VỚI CHÚNG TÔI
            </h3>

            {/* Cụm icon mạng xã hội nằm ngang */}
            <div className="flex items-center gap-2.5">
              <a href="#facebook" className="w-8 h-8 bg-blue-600 hover:bg-blue-500 text-white rounded-full flex items-center justify-center text-sm transition-transform hover:scale-110 shadow" title="Facebook">
                <i className="fa-brands fa-facebook-f"></i>
              </a>
              <a href="#zalo" className="w-8 h-8 bg-blue-500 hover:bg-blue-400 text-white rounded-full flex items-center justify-center text-sm transition-transform hover:scale-110 shadow font-black" title="Zalo">
                Z
              </a>
              <a href="#youtube" className="w-8 h-8 bg-red-600 hover:bg-red-500 text-white rounded-full flex items-center justify-center text-sm transition-transform hover:scale-110 shadow" title="YouTube">
                <i className="fa-brands fa-youtube"></i>
              </a>
              <a href="#tiktok" className="w-8 h-8 bg-slate-800 hover:bg-slate-700 text-white rounded-full flex items-center justify-center text-sm transition-transform hover:scale-110 shadow" title="TikTok">
                <i className="fa-brands fa-tiktok"></i>
              </a>
            </div>
          </div>
        </div>

      </div>

      {/* Copyright Bottom Bar */}
      <div className="max-w-7xl mx-auto px-4 pt-6 text-center text-[11px] text-gray-400 flex flex-col sm:flex-row items-center justify-between gap-2">
        <p>© 2026 TQ Store System. Unified Super Admin Overlord & Multi-Model Platform.</p>
        <p className="text-amber-400 font-semibold">Supabase Endpoint: ecbaoadsoepqlzxzsehu.supabase.co</p>
      </div>
    </footer>
  );
}
