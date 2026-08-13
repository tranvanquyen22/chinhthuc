import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { getShopSettings, saveShopSettings } from '../lib/shopSettings';

export default function ShopSettingsModal({ isOpen, onClose }) {
  const { userProfile } = useAuth();
  const [form, setForm] = useState(getShopSettings(userProfile?.email));
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (userProfile?.email && isOpen) {
      setForm(getShopSettings(userProfile.email));
    }
  }, [userProfile?.email, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await saveShopSettings(userProfile.email, form);
      alert('🎉 Đã lưu cấu hình Kho Hàng, Google Maps & VietQR Ngân Hàng Gian Hàng thành công!');
      onClose();
    } catch (err) {
      alert('⚠️ Lỗi khi lưu cấu hình Shop: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const generatedQrUrl = `https://img.vietqr.io/image/${form.bankCode || 'MB'}-${form.accountNumber || '0988888888'}-compact2.png`;

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-2xl w-full p-6 space-y-5 shadow-2xl border-2 border-teal-500 max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200">
        
        {/* Header Banner */}
        <div className="flex items-center justify-between border-b border-gray-100 pb-3 bg-gradient-to-r from-teal-900 to-navy p-4 rounded-2xl text-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-teal-500/30 border border-teal-300 rounded-xl flex items-center justify-center text-xl text-amber-300">
              <i className="fa-solid fa-store"></i>
            </div>
            <div>
              <h3 className="font-black text-sm uppercase text-amber-300">
                ⚙️ CẤU HÌNH NHẬN HÀNG & THANH TOÁN GIAN HÀNG
              </h3>
              <p className="text-[11px] text-teal-200 font-mono">
                Shop: {userProfile.name || userProfile.email}
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center font-black cursor-pointer text-xs"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 text-xs">
          
          {/* PHẦN 1: ĐỊA CHỈ KHO HÀNG & ĐỊNH VỊ GOOGLE MAPS */}
          <div className="bg-slate-50 border border-gray-200 p-4 rounded-2xl space-y-3">
            <h4 className="font-black text-navy text-xs uppercase flex items-center gap-1.5 border-b border-gray-200 pb-2">
              <i className="fa-solid fa-location-dot text-red-500"></i>
              <span>1. ĐỊA CHỈ KHO HÀNG & ĐỊNH VỊ GOOGLE MAPS</span>
            </h4>

            <div>
              <label className="block font-extrabold text-gray-700 mb-1">
                Địa chỉ Kho hàng / Cửa hàng nhận hàng:
              </label>
              <input 
                type="text" 
                value={form.warehouseAddress}
                onChange={(e) => setForm({ ...form, warehouseAddress: e.target.value })}
                required 
                placeholder="245 Nguyễn Trãi, Phường Bến Thành, Quận 1, TP. Hồ Chí Minh" 
                className="w-full bg-white border border-gray-300 rounded-xl px-3.5 py-2.5 text-xs font-medium focus:outline-none focus:border-teal-500"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-extrabold text-gray-700 mb-1">
                  Đường dẫn Google Maps (Maps Link / Embed URL):
                </label>
                <input 
                  type="url" 
                  value={form.googleMapsUrl}
                  onChange={(e) => setForm({ ...form, googleMapsUrl: e.target.value })}
                  placeholder="https://maps.google.com/?q=10.7719,106.6983" 
                  className="w-full bg-white border border-gray-300 rounded-xl px-3.5 py-2.5 text-xs font-mono font-medium focus:outline-none focus:border-teal-500"
                />
              </div>

              <div>
                <label className="block font-extrabold text-gray-700 mb-1">
                  Số điện thoại Hotline kho:
                </label>
                <input 
                  type="tel" 
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="0988 888 888" 
                  className="w-full bg-white border border-gray-300 rounded-xl px-3.5 py-2.5 text-xs font-mono font-bold focus:outline-none focus:border-teal-500"
                />
              </div>
            </div>

            <div className="flex items-center gap-4 pt-1">
              <label className="flex items-center gap-2 cursor-pointer font-bold text-gray-800">
                <input 
                  type="checkbox" 
                  checked={form.allowPickup}
                  onChange={(e) => setForm({ ...form, allowPickup: e.target.checked })}
                  className="accent-teal-600 w-4 h-4 rounded cursor-pointer"
                />
                <span>🏠 Cho phép Khách Lấy Tại Cửa Hàng (Store Pickup)</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer font-bold text-gray-800">
                <input 
                  type="checkbox" 
                  checked={form.allowShipping}
                  onChange={(e) => setForm({ ...form, allowShipping: e.target.checked })}
                  className="accent-teal-600 w-4 h-4 rounded cursor-pointer"
                />
                <span>🚚 Cho phép Giao Tận Nơi (Shipping)</span>
              </label>
            </div>
          </div>

          {/* PHẦN 2: TÀI KHOẢN NGÂN HÀNG & VIETQR RIÊNG CỦA SHOP */}
          <div className="bg-slate-50 border border-gray-200 p-4 rounded-2xl space-y-3">
            <h4 className="font-black text-navy text-xs uppercase flex items-center gap-1.5 border-b border-gray-200 pb-2">
              <i className="fa-solid fa-qrcode text-teal-600"></i>
              <span>2. TÀI KHOẢN NGÂN HÀNG & MÃ VIETQR CHUYỂN KHOẢN RIÊNG CỦA SHOP</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-extrabold text-gray-700 mb-1">
                  Ngân hàng thụ hưởng riêng của Shop:
                </label>
                <select 
                  value={form.bankCode}
                  onChange={(e) => {
                    const code = e.target.value;
                    const text = e.target.options[e.target.selectedIndex].text;
                    setForm({ ...form, bankCode: code, bankName: text });
                  }}
                  className="w-full bg-white border border-gray-300 rounded-xl px-3.5 py-2.5 text-xs font-bold text-navy focus:outline-none focus:border-teal-500 cursor-pointer"
                >
                  <option value="MB">MB Bank (Ngân Hàng Quân Đội - MB)</option>
                  <option value="VCB">Vietcombank (Ngân Hàng Ngoại Thương - VCB)</option>
                  <option value="TCB">Techcombank (Ngân Hàng Kỹ Thương - TCB)</option>
                  <option value="VPB">VPBank (Ngân Hàng Thịnh Vượng - VPB)</option>
                  <option value="BIDV">BIDV (Ngân Hàng ĐT & PT Việt Nam)</option>
                  <option value="CTG">VietinBank (Ngân Hàng Công Thương)</option>
                  <option value="ACB">ACB (Ngân Hàng Á Châu)</option>
                  <option value="TPB">TPBank (Ngân Hàng Tiên Phong)</option>
                </select>
              </div>

              <div>
                <label className="block font-extrabold text-gray-700 mb-1">
                  Số tài khoản Ngân hàng (STK):
                </label>
                <input 
                  type="text" 
                  value={form.accountNumber}
                  onChange={(e) => setForm({ ...form, accountNumber: e.target.value.trim() })}
                  required 
                  placeholder="0988888888" 
                  className="w-full bg-white border border-gray-300 rounded-xl px-3.5 py-2.5 text-xs font-mono font-black text-navy focus:outline-none focus:border-teal-500"
                />
              </div>
            </div>

            <div>
              <label className="block font-extrabold text-gray-700 mb-1">
                Tên Chủ Tài Khoản Shop (Viết hoa không dấu):
              </label>
              <input 
                type="text" 
                value={form.accountHolder}
                onChange={(e) => setForm({ ...form, accountHolder: e.target.value.toUpperCase() })}
                required 
                placeholder="CHU GIAN HANG TQ STORE" 
                className="w-full bg-white border border-gray-300 rounded-xl px-3.5 py-2.5 text-xs font-mono font-black text-navy focus:outline-none focus:border-teal-500 uppercase"
              />
            </div>

            {/* PREVIEW VIETQR SHOP */}
            <div className="bg-slate-900 text-white p-3.5 rounded-xl flex items-center justify-between gap-4">
              <div className="space-y-1">
                <span className="text-amber-300 font-extrabold text-[10px] uppercase">
                  📱 Mã VietQR chuyển khoản trực tiếp Shop:
                </span>
                <p className="text-gray-300 font-mono text-[11px]">
                  Tự động sinh theo chuẩn NAPAS 24/7 cho STK: <strong className="text-white font-bold">{form.accountNumber || 'Chưa có'}</strong>
                </p>
              </div>

              <img 
                src={generatedQrUrl} 
                alt="Shop VietQR" 
                className="w-16 h-16 object-contain rounded-lg bg-white p-1 border border-amber-400 shrink-0" 
              />
            </div>
          </div>

          <button 
            type="submit" 
            disabled={isSaving}
            className="w-full bg-gradient-to-r from-teal-600 via-emerald-600 to-teal-700 hover:from-teal-700 text-white font-black py-3.5 rounded-2xl text-xs uppercase tracking-wider shadow-md transition-all cursor-pointer flex items-center justify-center gap-2"
          >
            <i className={`fa-solid ${isSaving ? 'fa-spinner fa-spin' : 'fa-floppy-disk'} text-amber-300 text-sm`}></i>
            <span>{isSaving ? 'ĐANG LƯU CẤU HÌNH...' : '💾 LƯU CẤU HÌNH GIAN HÀNG'}</span>
          </button>
        </form>

      </div>
    </div>
  );
}
