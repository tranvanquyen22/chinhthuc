import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { getUserLocation, saveUserLocation, startLiveLocationTracking } from '../lib/userLocation';

export default function UserLocationModal({ isOpen, onClose }) {
  const { userProfile } = useAuth();
  const [currentLoc, setCurrentLoc] = useState(getUserLocation());
  const [customInputAddress, setCustomInputAddress] = useState(currentLoc.address || '');
  const [isLocating, setIsLocating] = useState(false);
  const [isLiveTrackingActive, setIsLiveTrackingActive] = useState(false);
  const [watchId, setWatchId] = useState(null);

  useEffect(() => {
    if (isOpen) {
      const loc = getUserLocation();
      setCurrentLoc(loc);
      setCustomInputAddress(loc.address || '');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Lấy vị trí GPS chính xác ngay lập tức
  const handleFetchCurrentGps = () => {
    if (!navigator.geolocation) {
      alert('Trình duyệt không hỗ trợ GPS.');
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const saved = await saveUserLocation(lat, lng, null, userProfile?.email);
        setCurrentLoc(saved);
        setCustomInputAddress(saved.address);
        setIsLocating(false);
        alert('🎉 Đã tự động cập nhật vị trí GPS Google Maps hiện tại của bạn!');
      },
      (err) => {
        setIsLocating(false);
        alert('Không thể lấy vị trí GPS. Vui lòng kiểm tra quyền vị trí trên thiết bị.');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // Bật/tắt chế độ tự động di chuyển (Live Auto Tracking)
  const toggleLiveTracking = () => {
    if (isLiveTrackingActive) {
      if (watchId) {
        navigator.geolocation.clearWatch(watchId);
        setWatchId(null);
      }
      setIsLiveTrackingActive(false);
      alert('Đã tắt chế độ tự động di chuyển.');
    } else {
      const id = startLiveLocationTracking((newLoc) => {
        setCurrentLoc(newLoc);
        setCustomInputAddress(newLoc.address);
      });
      setWatchId(id);
      setIsLiveTrackingActive(true);
      alert('🟢 ĐÃ BẬT TỰ ĐỘNG THEO DÕI DI CHUYỂN LIVE GPS! Khi bạn di chuyển, địa chỉ sẽ tự cập nhật theo.');
    }
  };

  const handleSaveCustomAddress = async (e) => {
    e.preventDefault();
    if (!customInputAddress.trim()) return;

    const saved = await saveUserLocation(currentLoc.lat, currentLoc.lng, customInputAddress.trim(), userProfile?.email);
    setCurrentLoc(saved);
    alert('🎉 Đã lưu địa chỉ định vị mới cho tài khoản của bạn!');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 font-sans text-xs">
      <div className="bg-white rounded-3xl max-w-xl w-full p-5 sm:p-6 space-y-4 shadow-2xl border-2 border-amber-400 max-h-[85vh] overflow-y-auto animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 bg-red-600 text-white rounded-2xl flex items-center justify-center text-lg font-black shadow-md">
              <i className="fa-solid fa-map-location-dot"></i>
            </div>
            <div>
              <h4 className="font-black text-sm text-navy uppercase tracking-wider">
                📍 QUẢN LÝ ĐỊNH VỊ GOOGLE MAPS CỦA BẢN THÂN
              </h4>
              <p className="text-[10px] text-gray-500 font-medium">
                Tự động cập nhật vị trí khi di chuyển & gắn vào mọi yêu cầu đặt hàng / đặt xe
              </p>
            </div>
          </div>

          <button 
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 flex items-center justify-center font-black cursor-pointer text-xs"
          >
            ✕
          </button>
        </div>

        {/* NÚT THAO TÁC ĐỊNH VỊ GPS VÀ LIVE TRACKING */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <button 
            type="button"
            onClick={handleFetchCurrentGps}
            disabled={isLocating}
            className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 text-white font-black py-3 px-4 rounded-2xl shadow-md transition-all cursor-pointer flex items-center justify-center gap-2 border border-emerald-300"
          >
            <i className={`fa-solid ${isLocating ? 'fa-spinner fa-spin' : 'fa-crosshairs'} text-amber-300 text-sm`}></i>
            <span>{isLocating ? 'ĐANG ĐỊNH VỊ GPS...' : '📍 LẤY VỊ TRÍ HIỆN TẠI (GPS)'}</span>
          </button>

          <button 
            type="button"
            onClick={toggleLiveTracking}
            className={`font-black py-3 px-4 rounded-2xl shadow-md transition-all cursor-pointer flex items-center justify-center gap-2 border ${
              isLiveTrackingActive 
                ? 'bg-red-600 hover:bg-red-700 text-white border-amber-300 animate-pulse' 
                : 'bg-navy hover:bg-navy-dark text-amber-300 border-amber-400'
            }`}
          >
            <i className={`fa-solid ${isLiveTrackingActive ? 'fa-stop text-white' : 'fa-play text-amber-300'} text-sm`}></i>
            <span>{isLiveTrackingActive ? '🔴 TẮT CHẾ ĐỘ DI CHUYỂN' : '🟢 BẬT TỰ ĐỘNG DI CHUYỂN GPS'}</span>
          </button>
        </div>

        {/* FORM NHẬP ĐỊA CHỈ & XEM BẢN ĐỒ GOOGLE MAPS */}
        <form onSubmit={handleSaveCustomAddress} className="space-y-4">
          <div>
            <label className="block font-bold text-gray-700 mb-1">
              📍 Địa chỉ định vị Google Maps hiển thị trên hệ thống:
            </label>
            <input 
              type="text" 
              value={customInputAddress}
              onChange={(e) => setCustomInputAddress(e.target.value)}
              required
              placeholder="Nhập địa chỉ của bạn hoặc bấm nút Định vị GPS ở trên..." 
              className="w-full bg-slate-50 border border-gray-300 rounded-xl px-3.5 py-2.5 text-xs text-navy font-bold focus:outline-none focus:border-amber-500"
            />
          </div>

          {/* KHUNG HIỂN THỊ BẢN ĐỒ GOOGLE MAPS LIVE */}
          <div className="bg-slate-50 p-3 rounded-2xl border border-gray-200 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-extrabold text-navy text-[11px] flex items-center gap-1">
                <i className="fa-solid fa-map text-red-600"></i>
                <span>Xem Ghim Vị Trí Bản Đồ Google Maps:</span>
              </span>

              <a 
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(currentLoc.lat ? `${currentLoc.lat},${currentLoc.lng}` : customInputAddress)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-navy text-amber-300 font-extrabold text-[10px] px-2.5 py-1 rounded-full flex items-center gap-1 transition-all"
              >
                <i className="fa-solid fa-arrow-up-right-from-square"></i>
                <span>MỞ GOOGLE MAPS</span>
              </a>
            </div>

            <div className="w-full h-44 rounded-xl overflow-hidden border border-gray-300 shadow-inner bg-gray-100">
              <iframe 
                title="Google Maps Live Location Pin View"
                width="100%"
                height="100%"
                style={{ border: 0 }}
                loading="lazy"
                src={`https://maps.google.com/maps?q=${currentLoc.lat ? `${currentLoc.lat},${currentLoc.lng}` : encodeURIComponent(customInputAddress)}&z=16&output=embed`}
              ></iframe>
            </div>
          </div>

          <button 
            type="submit" 
            className="w-full bg-navy hover:bg-navy-dark text-amber-300 font-black py-3 rounded-2xl text-xs uppercase tracking-wider transition-all shadow-md cursor-pointer border border-amber-400/50"
          >
            💾 LƯU ĐỊA CHỈ ĐỊNH VỊ NÀY CHO TÀI KHOẢN
          </button>
        </form>

      </div>
    </div>
  );
}
