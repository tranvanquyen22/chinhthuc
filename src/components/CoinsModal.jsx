import React from 'react';
import { useAuth } from '../context/AuthContext';

export default function CoinsModal({ isOpen, onClose }) {
  const { userProfile } = useAuth();

  if (!isOpen) return null;

  const coins = Number(userProfile.coins || 0);
  const vndValue = coins * 1000;

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 font-sans">
      <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden relative border border-amber-300 animate-in zoom-in-95 duration-200">
        
        {/* Header Modal - Gradient Cam Vàng */}
        <div className="bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 text-white p-5 flex items-center justify-between relative shadow-md">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 bg-white/20 rounded-2xl flex items-center justify-center border border-white/30 text-2xl shadow-inner">
              🪙
            </div>
            <div>
              <h3 className="font-black text-sm uppercase tracking-wider text-amber-100">
                VÍ XU TÍCH LŨY (TQ COINS)
              </h3>
              <p className="text-[11px] text-amber-50 font-medium">
                Khấu trừ trực tiếp tới 50% giá trị đơn hàng
              </p>
            </div>
          </div>

          {/* Nút đóng X */}
          <button 
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 text-white flex items-center justify-center transition-colors cursor-pointer shrink-0"
            title="Đóng cửa sổ"
          >
            <i className="fa-solid fa-xmark text-sm font-bold"></i>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5">
          
          {/* Card Hiển thị Số Dư Xu */}
          <div className="bg-gradient-to-br from-amber-50 to-orange-50/80 p-5 rounded-2xl border-2 border-amber-300/80 text-center space-y-2 shadow-xs">
            <span className="text-xs font-bold text-amber-800 uppercase tracking-wide block">
              SỐ DƯ XU KHẢ DỤNG
            </span>
            <div className="text-3xl font-black text-amber-600 font-mono tracking-tight">
              {coins.toLocaleString('vi-VN')} <span className="text-sm font-bold">Xu</span>
            </div>
            <div className="inline-block bg-white px-3.5 py-1 rounded-full border border-amber-200 text-xs font-bold text-gray-700 shadow-2xs">
              Tương đương: <strong className="text-orange-custom">{vndValue.toLocaleString('vi-VN')} VNĐ</strong>
            </div>
          </div>

          {/* Hướng dẫn & Quyền lợi tích Xu */}
          <div className="space-y-3 text-xs text-gray-700 bg-gray-50 p-4 rounded-2xl border border-gray-200">
            <h4 className="font-black text-navy uppercase text-[11px] tracking-wider flex items-center gap-1.5 border-b border-gray-200 pb-2">
              <i className="fa-solid fa-circle-info text-amber-500"></i>
              <span>QUYỀN LỢI & CÁCH SỬ DỤNG TQ XU</span>
            </h4>

            <div className="space-y-2">
              <div className="flex items-start gap-2">
                <span className="text-base leading-none">🛍️</span>
                <div>
                  <strong className="text-navy">Tích Xu Tự Động:</strong> Nhận hoàn Xu 3% giá trị đơn hàng sau khi hoàn tất mua sắm & thuê trang phục.
                </div>
              </div>

              <div className="flex items-start gap-2">
                <span className="text-base leading-none">💡</span>
                <div>
                  <strong className="text-navy">Khấu Trừ Đơn Hàng:</strong> Tự động giảm giá trực tiếp vào tổng tiền khi chọn dùng Xu tại giỏ hàng.
                </div>
              </div>

              <div className="flex items-start gap-2">
                <span className="text-base leading-none">⭐</span>
                <div>
                  <strong className="text-navy">Đánh Giá Sản Phẩm:</strong> Nhận ngay +50 Xu thưởng cho mỗi bài đánh giá có ảnh thành công.
                </div>
              </div>
            </div>
          </div>

          {/* Nút bấm hành động */}
          <button 
            onClick={onClose}
            className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 text-white font-black py-3 rounded-xl text-xs uppercase tracking-wider shadow-md transition-all cursor-pointer flex items-center justify-center gap-2"
          >
            <i className="fa-solid fa-bag-shopping text-sm"></i>
            <span>MUA SẮM ĐỂ TÍCH XU NGAY</span>
          </button>

        </div>

      </div>
    </div>
  );
}
