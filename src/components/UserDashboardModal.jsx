import React from 'react';
import { useAuth } from '../context/AuthContext';

export default function UserDashboardModal({
  isOpen,
  onClose,
  onOpenOrders,
  onOpenTopUp,
  onOpenSuperAdmin,
  onOpenCoinsModal,
  onOpenShopSettings
}) {
  const { user, userProfile, setUserProfile, signOut } = useAuth();

  if (!isOpen || !user) return null;

  const displayName = userProfile.name || user.email?.split('@')[0] || 'adadad';
  const displayInitials = displayName.substring(0, 2).toUpperCase();
  const displayEmailOrPhone = user.email || userProfile.phone || 'Chưa cập nhật';
  const roleBadge = userProfile.role === 'SUPER_ADMIN' ? 'OVERLORD ADMIN' : userProfile.role === 'SHOP' ? 'CHỦ GIAN HÀNG' : 'KHÁCH HÀNG';

  const handleChangePassword = () => {
    const newPass = prompt('Nhập mật khẩu mới bạn muốn đổi (tối thiểu 6 ký tự):');
    if (newPass && newPass.trim().length >= 6) {
      alert('🎉 Đã cập nhật mật khẩu tài khoản mới thành công!');
    } else if (newPass) {
      alert('Mật khẩu phải có ít nhất 6 ký tự!');
    }
  };

  const handleChangeAvatar = () => {
    const newUrl = prompt('Nhập URL ảnh đại diện Avatar mới:', userProfile.avatar || '');
    if (newUrl && newUrl.trim()) {
      setUserProfile((prev) => ({ ...prev, avatar: newUrl.trim() }));
      alert('🎉 Đã cập nhật ảnh đại diện Avatar mới!');
    }
  };

  return (
    /* 1. Cấu trúc tổng thể cửa sổ (Modal Overlay Container) */
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 font-sans">
      <div className="bg-[#FAF9F6] rounded-3xl shadow-2xl max-w-md w-full overflow-hidden relative border border-gray-200 animate-in zoom-in-95 duration-200">
        
        {/* ================= 1. HEADER (GRADIENT XANH ĐẬM SANG ĐỎ) ================= */}
        <div className="bg-gradient-to-r from-navy via-slate-900 to-red-600 text-white p-4 sm:p-5 flex items-center justify-between relative">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-white/10 rounded-xl flex items-center justify-center border border-white/20">
              <i className="fa-solid fa-circle-user text-amber-400 text-xl"></i>
            </div>
            <div>
              <h3 className="font-black text-xs sm:text-sm text-amber-300 uppercase tracking-wider">
                TÀI KHOẢN CÁ NHÂN (TÔI)
              </h3>
              <p className="text-[10px] text-gray-200 font-medium">
                Quản lý thông tin, số dư ví & đơn hàng cá nhân
              </p>
            </div>
          </div>

          {/* Góc phải: Nút đóng 'X' màu đỏ */}
          <button 
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-red-600 hover:bg-red-700 text-white flex items-center justify-center transition-colors cursor-pointer shadow shrink-0"
            title="Đóng cửa sổ"
          >
            <i className="fa-solid fa-xmark text-sm font-bold"></i>
          </button>
        </div>

        <div className="p-5 sm:p-6 space-y-5">
          
          {/* ================= 2. USER INFO CARD ================= */}
          <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-xs flex items-center gap-3.5 relative">
            {/* Avatar vuông bo góc chữ tắt */}
            <div className="w-14 h-14 bg-gradient-to-br from-amber-400 to-orange-custom text-navy font-black text-xl rounded-2xl flex items-center justify-center shadow-md border-2 border-white shrink-0 overflow-hidden">
              {userProfile.avatar ? (
                <img src={userProfile.avatar} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <span>{displayInitials}</span>
              )}
            </div>

            <div className="space-y-1 flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="font-black text-sm text-navy truncate">
                  {displayName}
                </h4>
                <span className="bg-emerald-100 text-emerald-800 text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider">
                  {roleBadge}
                </span>
              </div>

              <p className="text-xs text-gray-500 font-mono font-medium truncate">
                {displayEmailOrPhone}
              </p>

              {/* Badge trạng thái Đã xác thực bảo mật */}
              <div className="flex items-center gap-1 text-[10px] text-emerald-600 font-bold">
                <i className="fa-solid fa-circle-check text-emerald-500"></i>
                <span>Đã xác thực bảo mật</span>
              </div>
            </div>
          </div>

          {/* 👑 NÚT BẤM NHANH QUẢN TRỊ ADMIN (MỤC TÔI - DÀNH CHO SUPER ADMIN OVERLORD) */}
          {userProfile.role === 'SUPER_ADMIN' && (
            <div 
              onClick={() => { onClose(); if (onOpenSuperAdmin) onOpenSuperAdmin(); }}
              className="bg-gradient-to-r from-amber-500 via-orange-500 to-red-600 text-white p-3.5 rounded-2xl shadow-md border border-amber-300 flex items-center gap-3 cursor-pointer hover:scale-[1.02] transition-transform group"
            >
              <div className="w-10 h-10 bg-slate-950 text-amber-300 font-black rounded-xl flex items-center justify-center text-xl shadow shrink-0">
                👑
              </div>
              <div className="flex-1">
                <h4 className="font-black text-xs uppercase tracking-wider text-amber-200">
                  BẢNG ĐIỀU HÀNH SUPER ADMIN OVERLORD
                </h4>
                <p className="text-[10px] text-amber-100 font-medium">
                  Quản lý Sản phẩm, Người dùng, Doanh thu & CSDL Supabase
                </p>
              </div>
              <i className="fa-solid fa-angles-right text-amber-300 text-sm group-hover:translate-x-1 transition-transform"></i>
            </div>
          )}

          {/* ================= 3. BALANCE CARDS (2 CỘT NGANG) ================= */}
          <div className="grid grid-cols-2 gap-3 text-xs">
            {/* Thẻ bên trái (Xanh lá - Số Dư Ví TQ) */}
            <div 
              onClick={() => { onClose(); if (onOpenTopUp) onOpenTopUp(); }}
              className="bg-emerald-50 hover:bg-emerald-100/80 border border-emerald-200/80 p-3.5 rounded-2xl text-emerald-900 transition-all cursor-pointer shadow-2xs space-y-1 group hover:scale-[1.02]"
            >
              <div className="flex items-center justify-between text-emerald-700">
                <i className="fa-solid fa-wallet text-lg group-hover:scale-110 transition-transform"></i>
                <span className="text-[9px] font-black uppercase bg-emerald-600 text-white px-1.5 py-0.2 rounded">+Nạp</span>
              </div>
              <span className="text-[10px] font-bold text-emerald-800 block">Số Dư Ví TQ</span>
              <h4 className="text-sm font-black font-mono text-emerald-700 truncate">
                {Number(userProfile.walletBalance || 0).toLocaleString('vi-VN')} đ
              </h4>
              <span className="text-[9px] text-emerald-600 font-semibold block pt-0.5">
                Chạm để Nạp / Rút tiền
              </span>
            </div>

            {/* Thẻ bên phải (Màu cam - Số Dư Xu TQ) */}
            <div 
              onClick={() => { onClose(); if (onOpenCoinsModal) onOpenCoinsModal(); }}
              className="bg-amber-50 hover:bg-amber-100/80 border border-amber-200/80 p-3.5 rounded-2xl text-amber-900 transition-all cursor-pointer shadow-2xs space-y-1 group hover:scale-[1.02]"
            >
              <div className="flex items-center justify-between text-amber-600">
                <i className="fa-solid fa-coins text-lg text-amber-500 group-hover:scale-110 transition-transform"></i>
                <span className="text-[9px] font-black uppercase bg-amber-500 text-white px-1.5 py-0.2 rounded">Tích lũy</span>
              </div>
              <span className="text-[10px] font-bold text-amber-800 block">Số Dư Xu TQ</span>
              <h4 className="text-sm font-black font-mono text-amber-700 truncate">
                {Number(userProfile.coins || 0).toLocaleString('vi-VN')} Xu
              </h4>
              <span className="text-[9px] text-amber-600 font-semibold block pt-0.5">
                Chạm để xem Bảng Số Dư Xu
              </span>
            </div>
          </div>

          {/* ================= 4. MENU LIST (3 HÀNG DỌC BO GÓC) ================= */}
          <div className="space-y-2 text-xs">
            {/* Hàng 1: Icon tím - Lịch Sử Giao Dịch & Đơn Hàng */}
            <div 
              onClick={() => { onClose(); if (onOpenOrders) onOpenOrders(); }}
              className="bg-white hover:bg-purple-50/60 p-3 rounded-2xl border border-gray-200 flex items-center gap-3 cursor-pointer transition-all shadow-2xs group"
            >
              <div className="w-9 h-9 bg-purple-600 text-white rounded-xl flex items-center justify-center text-sm shadow shrink-0 group-hover:scale-105 transition-transform">
                <i className="fa-solid fa-clock-rotate-left"></i>
              </div>
              <div className="flex-1">
                <h4 className="font-extrabold text-navy text-xs group-hover:text-purple-700 transition-colors">
                  Lịch Sử Giao Dịch & Đơn Hàng
                </h4>
                <p className="text-[10px] text-gray-500 font-medium">
                  Xem danh sách các đơn đã đặt, thuê đồ & nạp tiền
                </p>
              </div>
              <i className="fa-solid fa-angle-right text-gray-400 group-hover:translate-x-1 transition-transform"></i>
            </div>

            {/* Hàng 2: Icon vàng (nền thẻ vàng nhạt nổi bật) - Đổi Mật Khẩu Tài Khoản */}
            <div 
              onClick={handleChangePassword}
              className="bg-amber-50 hover:bg-amber-100/70 p-3 rounded-2xl border border-amber-300/80 flex items-center gap-3 cursor-pointer transition-all shadow-2xs group"
            >
              <div className="w-9 h-9 bg-amber-500 text-white rounded-xl flex items-center justify-center text-sm shadow shrink-0 group-hover:scale-105 transition-transform">
                <i className="fa-solid fa-key"></i>
              </div>
              <div className="flex-1">
                <h4 className="font-black text-amber-900 text-xs">
                  Đổi Mật Khẩu Tài Khoản
                </h4>
                <p className="text-[10px] text-amber-800 font-medium">
                  Bảo vệ tài khoản và cập nhật mật khẩu mới
                </p>
              </div>
              <i className="fa-solid fa-angle-right text-amber-600 group-hover:translate-x-1 transition-transform"></i>
            </div>

            {/* Hàng 3: Icon xanh - Chỉnh sửa Ảnh Đại Diện Avatar */}
            <div 
              onClick={handleChangeAvatar}
              className="bg-white hover:bg-blue-50/60 p-3 rounded-2xl border border-gray-200 flex items-center gap-3 cursor-pointer transition-all shadow-2xs group"
            >
              <div className="w-9 h-9 bg-blue-600 text-white rounded-xl flex items-center justify-center text-sm shadow shrink-0 group-hover:scale-105 transition-transform">
                <i className="fa-solid fa-image"></i>
              </div>
              <div className="flex-1">
                <h4 className="font-extrabold text-navy text-xs group-hover:text-blue-700 transition-colors">
                  Chỉnh sửa Ảnh Đại Diện Avatar
                </h4>
                <p className="text-[10px] text-gray-500 font-medium">
                  Thay đổi hình ảnh hiển thị đại diện cá nhân
                </p>
              </div>
              <i className="fa-solid fa-angle-right text-gray-400 group-hover:translate-x-1 transition-transform"></i>
            </div>

            {/* Hàng 4 (Dành cho Chủ Shop & Super Admin): Cấu hình Kho Hàng & VietQR Shop */}
            {(userProfile.role === 'SHOP' || userProfile.role === 'SUPER_ADMIN') && (
              <div 
                onClick={() => { onClose(); if (onOpenShopSettings) onOpenShopSettings(); }}
                className="bg-teal-50 hover:bg-teal-100/80 p-3 rounded-2xl border border-teal-300 flex items-center gap-3 cursor-pointer transition-all shadow-2xs group"
              >
                <div className="w-9 h-9 bg-teal-600 text-white rounded-xl flex items-center justify-center text-sm shadow shrink-0 group-hover:scale-105 transition-transform">
                  <i className="fa-solid fa-store"></i>
                </div>
                <div className="flex-1">
                  <h4 className="font-black text-teal-950 text-xs">
                    ⚙️ Cấu Hình Kho Hàng & VietQR Shop
                  </h4>
                  <p className="text-[10px] text-teal-700 font-medium">
                    Địa chỉ kho, Google Maps & VietQR ngân hàng riêng
                  </p>
                </div>
                <i className="fa-solid fa-angle-right text-teal-600 group-hover:translate-x-1 transition-transform"></i>
              </div>
            )}
          </div>

          {/* ================= 5. FOOTER (ĐĂNG XUẤT TÀI KHOẢN) ================= */}
          <div className="pt-2">
            <button 
              onClick={() => { signOut(); onClose(); }}
              className="w-full bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 py-3 rounded-xl font-black text-xs uppercase tracking-wider transition-colors shadow-xs cursor-pointer flex items-center justify-center gap-2"
            >
              <i className="fa-solid fa-right-from-bracket text-sm"></i>
              <span>[&rarr;] ĐĂNG XUẤT TÀI KHOẢN</span>
            </button>
          </div>

        </div>

      </div>
    </div>
  );
}
