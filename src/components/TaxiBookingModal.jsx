import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { getUserLocation } from '../lib/userLocation';

const TAXI_SERVICE_OPTIONS = [
  {
    id: 'tq_bike',
    name: '🛵 TQ Bike (Xe Máy Công Nghệ)',
    desc: 'Di chuyển siêu nhanh, tiết kiệm, tránh tắc đường nội thành',
    ratePerKm: 10000,
    baseFare: 12000,
    icon: 'fa-motorcycle',
    badge: '⚡ TIẾT KIỆM',
    color: 'from-emerald-600 to-teal-600'
  },
  {
    id: 'tq_car_4',
    name: '🚗 TQ Car 4 Chỗ (Ô Tô Tiêu Chuẩn)',
    desc: 'Xe 4 chỗ sang trọng, điều hòa mát lạnh, tài xế lịch sự',
    ratePerKm: 14000,
    baseFare: 20000,
    icon: 'fa-car',
    badge: '👑 THOẢI MÁI',
    color: 'from-navy to-slate-900'
  },
  {
    id: 'tq_car_7',
    name: '🚙 TQ Car 7 Chỗ (Xe Gia Đình / Nhóm)',
    desc: 'Rộng rãi chở cả gia đình hoặc nhóm bạn kèm hành lý gọn gàng',
    ratePerKm: 18000,
    baseFare: 30000,
    icon: 'fa-van-shuttle',
    badge: '👨‍👩‍👧‍👦 GIA ĐÌNH',
    color: 'from-purple-900 to-indigo-950'
  },
  {
    id: 'tq_express',
    name: '📦 TQ Express (Giao Hàng Siêu Tốc)',
    desc: 'Giao tài liệu, bưu phẩm, đồ ăn nội thành tận tay trong 20 phút',
    ratePerKm: 9000,
    baseFare: 15000,
    icon: 'fa-box-fast',
    badge: '🚀 SIÊU TỐC 20P',
    color: 'from-amber-600 to-orange-600'
  },
  {
    id: 'tq_airport',
    name: '✈️ TQ Airport (Đưa Đón Sân Bay)',
    desc: 'Xe đưa đón sân bay trọn gói không lo tăng giá vào giờ cao điểm',
    ratePerKm: 12000,
    baseFare: 150000,
    icon: 'fa-plane-departure',
    badge: '✈️ TRỌN GÓI',
    color: 'from-sky-700 to-blue-900'
  }
];

export default function TaxiBookingModal({ isOpen, onClose }) {
  const { userProfile } = useAuth();
  const [selectedService, setSelectedService] = useState(TAXI_SERVICE_OPTIONS[0]);
  const [coords, setCoords] = useState(null); // { lat, lng }
  const [isLocatingGps, setIsLocatingGps] = useState(false);
  const [showMapPreview, setShowMapPreview] = useState(false);
  const [pickupAddress, setPickupAddress] = useState('');
  const [destinationAddress, setDestinationAddress] = useState('');
  const [distanceKm, setDistanceKm] = useState(5);
  const [note, setNote] = useState('');
  const [isBookingSuccess, setIsBookingSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isAutoGpsFilled, setIsAutoGpsFilled] = useState(false);

  // 1. TỰ ĐỘNG ĐỊNH VỊ ĐIỂM ĐÓN GPS THỜI GIAN THỰC (0 THAO TÁC CẦN LÀM)
  useEffect(() => {
    if (!isOpen) return;

    const userLoc = getUserLocation();
    if (userLoc && userLoc.address) {
      setPickupAddress(userLoc.address);
      if (userLoc.lat && userLoc.lng) {
        setCoords({ lat: userLoc.lat, lng: userLoc.lng });
      }
      setIsAutoGpsFilled(true);
      setShowMapPreview(true);
    }

    // Lắng nghe di chuyển vị trí Live GPS khi mở cửa sổ đặt xe
    const handleLocationUpdate = (e) => {
      if (e.detail && e.detail.address) {
        setPickupAddress(e.detail.address);
        if (e.detail.lat && e.detail.lng) {
          setCoords({ lat: e.detail.lat, lng: e.detail.lng });
        }
        setIsAutoGpsFilled(true);
        setShowMapPreview(true);
      }
    };

    window.addEventListener('user_location_updated', handleLocationUpdate);
    return () => window.removeEventListener('user_location_updated', handleLocationUpdate);
  }, [isOpen]);

  // Hàm định vị vị trí đón trực tiếp qua GPS & Google Maps
  const handleLocateCurrentGps = () => {
    if (!navigator.geolocation) {
      alert('Trình duyệt của bạn không hỗ trợ định vị GPS trực tiếp.');
      return;
    }

    setIsLocatingGps(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        setCoords({ lat, lng });

        const addressText = `📍 Tọa độ GPS: ${lat.toFixed(5)}, ${lng.toFixed(5)} (Vị trí hiện tại)`;
        setPickupAddress(addressText);
        setShowMapPreview(true);
        setIsLocatingGps(false);
      },
      (error) => {
        setIsLocatingGps(false);
        alert('Không thể định vị GPS. Vui lòng bật quyền truy cập vị trí trên thiết bị hoặc tự nhập địa chỉ.');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  if (!isOpen) return null;

  const estimatedFare = selectedService.baseFare + (distanceKm * selectedService.ratePerKm);

  const handleBookingSubmit = (e) => {
    e.preventDefault();
    if (!pickupAddress.trim() || !destinationAddress.trim()) {
      alert('Vui lòng nhập điểm đón và điểm đến!');
      return;
    }

    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setIsBookingSuccess(true);
    }, 800);
  };

  const handleClose = () => {
    setIsBookingSuccess(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 font-sans text-xs">
      <div className="bg-white rounded-3xl max-w-2xl w-full p-5 sm:p-7 space-y-5 shadow-2xl border-2 border-amber-400 max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 pb-3.5">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-amber-400 text-navy rounded-2xl flex items-center justify-center text-2xl font-black shadow-md">
              <i className="fa-solid fa-taxi"></i>
            </div>
            <div>
              <h3 className="font-black text-base text-navy uppercase tracking-wider">
                🚖 DỊCH VỤ TAXI TQ - ĐẶT XE CÔNG NGHỆ HOẢ TỐC
              </h3>
              <p className="text-[11px] text-gray-500 font-medium">
                Tài xế đón tận nơi trong 3 phút • Giá cước minh bạch 0% phí sàn phụ phụ
              </p>
            </div>
          </div>

          <button 
            onClick={handleClose}
            className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 flex items-center justify-center font-black cursor-pointer text-xs"
          >
            ✕
          </button>
        </div>

        {isBookingSuccess ? (
          <div className="text-center py-8 space-y-4 animate-in zoom-in-95 duration-300">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center text-3xl mx-auto border-2 border-emerald-400 shadow-md">
              <i className="fa-solid fa-check"></i>
            </div>
            <div className="space-y-1">
              <h4 className="font-black text-lg text-navy">🎉 ĐẶT XE CHUYẾN {selectedService.name} THÀNH CÔNG!</h4>
              <p className="text-xs text-gray-600">
                Hệ thống đang phát tín hiệu tới các Tài xế TQ gần nhất tại điểm đón: <strong className="text-navy">{pickupAddress}</strong>
              </p>
            </div>

            <div className="bg-slate-50 border border-gray-200 p-4 rounded-2xl max-w-md mx-auto space-y-2 text-left text-xs font-mono">
              <div className="flex justify-between border-b border-gray-200 pb-1">
                <span>Dịch vụ chọn:</span>
                <strong className="text-navy">{selectedService.name}</strong>
              </div>
              <div className="flex justify-between border-b border-gray-200 pb-1">
                <span>Điểm đón:</span>
                <strong className="text-gray-800">{pickupAddress}</strong>
              </div>
              <div className="flex justify-between border-b border-gray-200 pb-1">
                <span>Điểm đến:</span>
                <strong className="text-gray-800">{destinationAddress}</strong>
              </div>
              <div className="flex justify-between border-b border-gray-200 pb-1">
                <span>Khoảng cách ước tính:</span>
                <strong className="text-gray-800">{distanceKm} Km</strong>
              </div>
              <div className="flex justify-between text-emerald-700 font-bold text-sm pt-1">
                <span>Tổng cước phí chuyến xe:</span>
                <span>{estimatedFare.toLocaleString('vi-VN')}đ</span>
              </div>
            </div>

            <button 
              onClick={handleClose}
              className="bg-navy hover:bg-navy-dark text-amber-300 font-black px-8 py-3 rounded-2xl text-xs uppercase cursor-pointer transition-all shadow-md"
            >
              HOÀN TẤT & TRỞ VỀ TRANG CHỦ
            </button>
          </div>
        ) : (
          <form onSubmit={handleBookingSubmit} className="space-y-5">
            
            {/* 1. DANH SÁCH LỰA CHỌN CÁC LOẠI HÌNH DỊCH VỤ TAXI */}
            <div className="space-y-2">
              <label className="block font-black text-navy uppercase tracking-wider text-xs">
                1. Chọn Loại Hình Dịch Vụ Xe Mong Muốn:
              </label>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {TAXI_SERVICE_OPTIONS.map((srv) => {
                  const isSelected = selectedService.id === srv.id;

                  return (
                    <div 
                      key={srv.id}
                      onClick={() => setSelectedService(srv)}
                      className={`p-3.5 rounded-2xl border-2 transition-all cursor-pointer space-y-2 flex flex-col justify-between ${
                        isSelected 
                          ? 'border-amber-400 bg-amber-50/60 shadow-md ring-2 ring-amber-300/40' 
                          : 'border-gray-200 bg-white hover:border-navy/40'
                      }`}
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className={`text-[9px] font-black px-2 py-0.5 rounded-full text-white bg-gradient-to-r ${srv.color}`}>
                            {srv.badge}
                          </span>
                          <i className={`fa-solid ${srv.icon} text-lg ${isSelected ? 'text-amber-600' : 'text-gray-400'}`}></i>
                        </div>

                        <h5 className="font-black text-xs text-navy leading-snug">{srv.name}</h5>
                        <p className="text-[10px] text-gray-500 leading-tight">{srv.desc}</p>
                      </div>

                      <div className="text-[10px] font-mono text-gray-700 border-t border-gray-100 pt-2 flex items-center justify-between">
                        <span>Giá cước:</span>
                        <strong className="text-emerald-700">{srv.ratePerKm.toLocaleString('vi-VN')}đ/km</strong>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 2. NHẬP LỘ TRÌNH ĐIỂM ĐÓN & ĐIỂM ĐẾN */}
            <div className="bg-slate-50 p-4 rounded-2xl border border-gray-200 space-y-4">
              <h4 className="font-black text-navy text-xs uppercase tracking-wider flex items-center gap-1.5">
                <i className="fa-solid fa-route text-amber-500"></i>
                <span>2. Nhập Lộ Trình & Ước Tính Cước Phí</span>
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  {isAutoGpsFilled && (
                    <div className="text-[9px] bg-emerald-100/90 text-emerald-900 font-black px-2.5 py-1 rounded-xl border border-emerald-300 mb-1.5 flex items-center gap-1.5 animate-in fade-in duration-200">
                      <span className="w-2 h-2 bg-emerald-500 rounded-full animate-ping shrink-0"></span>
                      <span>✨ ĐÃ TỰ ĐỘNG ĐỊNH VỊ ĐIỂM ĐÓN GPS BẢN THÂN (0 THAO TÁC)</span>
                    </div>
                  )}

                  <div className="flex items-center justify-between mb-1">
                    <label className="block font-bold text-gray-700">
                      🟢 Điểm Đón Tận Nơi:
                    </label>
                    <button 
                      type="button"
                      onClick={handleLocateCurrentGps}
                      disabled={isLocatingGps}
                      className="text-[10px] font-black text-emerald-700 hover:text-emerald-800 bg-emerald-100 hover:bg-emerald-200 px-2.5 py-0.5 rounded-full transition-all flex items-center gap-1 cursor-pointer shadow-2xs"
                    >
                      <i className={`fa-solid ${isLocatingGps ? 'fa-spinner fa-spin' : 'fa-location-crosshairs'}`}></i>
                      <span>{isLocatingGps ? 'ĐANG ĐỊNH VỊ...' : '📍 ĐỊNH VỊ GPS'}</span>
                    </button>
                  </div>

                  <input 
                    type="text" 
                    value={pickupAddress}
                    onChange={(e) => setPickupAddress(e.target.value)}
                    required
                    placeholder="Ví dụ: 123 Nguyễn Trãi, Quận 1 hoặc bấm Định Vị GPS..." 
                    className="w-full bg-white border border-gray-300 rounded-xl px-3.5 py-2.5 text-xs text-navy font-bold focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block font-bold text-gray-700 mb-1">
                    🔴 Điểm Đến Mong Muốn:
                  </label>
                  <input 
                    type="text" 
                    value={destinationAddress}
                    onChange={(e) => setDestinationAddress(e.target.value)}
                    required
                    placeholder="Ví dụ: Sân Bay Tân Sơn Nhất..." 
                    className="w-full bg-white border border-gray-300 rounded-xl px-3.5 py-2.5 text-xs text-navy font-bold focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              {/* BẢN ĐỒ ĐỊNH VỊ GOOGLE MAPS TRỰC TIẾP */}
              {pickupAddress && (
                <div className="bg-white p-3 rounded-2xl border border-gray-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-navy text-[11px] flex items-center gap-1">
                      <i className="fa-solid fa-map-location-dot text-red-600"></i>
                      <span>Bản Đồ Định Vị Google Maps Điểm Đón:</span>
                    </span>

                    <a 
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(coords ? `${coords.lat},${coords.lng}` : pickupAddress)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="bg-navy text-amber-300 hover:bg-navy-dark font-extrabold text-[10px] px-2.5 py-1 rounded-full flex items-center gap-1 transition-all"
                    >
                      <i className="fa-solid fa-arrow-up-right-from-square"></i>
                      <span>MỞ BẢN ĐỒ LỚN</span>
                    </a>
                  </div>

                  <div className="w-full h-40 rounded-xl overflow-hidden border border-gray-300 shadow-inner bg-gray-100">
                    <iframe 
                      title="Google Maps Pickup Location Pin"
                      width="100%"
                      height="100%"
                      style={{ border: 0 }}
                      loading="lazy"
                      src={`https://maps.google.com/maps?q=${coords ? `${coords.lat},${coords.lng}` : encodeURIComponent(pickupAddress)}&z=15&output=embed`}
                    ></iframe>
                  </div>
                </div>
              )}

              {/* Slider khoảng cách Km */}
              <div className="space-y-1 pt-1">
                <div className="flex items-center justify-between text-xs font-bold text-navy">
                  <span>Khoảng cách di chuyển ước tính:</span>
                  <span className="bg-navy text-amber-300 px-2.5 py-0.5 rounded-full font-mono">{distanceKm} Km</span>
                </div>
                <input 
                  type="range" 
                  min="1" 
                  max="100" 
                  value={distanceKm}
                  onChange={(e) => setDistanceKm(Number(e.target.value))}
                  className="w-full accent-amber-500 cursor-pointer"
                />
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1">
                  📝 Ghi chú thêm cho Tài xế (Tùy chọn):
                </label>
                <input 
                  type="text" 
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Ví dụ: Mang theo nón bảo hiểm trẻ em, xe đi 2 người..." 
                  className="w-full bg-white border border-gray-300 rounded-xl px-3.5 py-2 text-xs text-gray-800"
                />
              </div>
            </div>

            {/* 3. TỔNG CƯỚC & NÚT ĐẶT XE */}
            <div className="bg-gradient-to-r from-navy via-slate-900 to-slate-950 text-white p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md border border-amber-400/40">
              <div className="space-y-0.5">
                <span className="text-[10px] text-amber-300 font-mono uppercase">ƯỚC TÍNH CƯỚC CHUYẾN XE (0% PHÍ SÀN):</span>
                <div className="text-xl font-black text-amber-400 font-mono">
                  {estimatedFare.toLocaleString('vi-VN')} VNĐ
                </div>
              </div>

              <button 
                type="submit" 
                disabled={loading}
                className="bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-400 text-white font-black px-8 py-3.5 rounded-2xl text-xs uppercase tracking-wider shadow-lg transition-all cursor-pointer flex items-center justify-center gap-2 border border-amber-300"
              >
                <i className={`fa-solid ${loading ? 'fa-spinner fa-spin' : 'fa-paper-plane'} text-sm`}></i>
                <span>{loading ? 'ĐANG KẾT NỐI TÀI XẾ...' : '🚖 XÁC NHẬN ĐẶT XE NGAY'}</span>
              </button>
            </div>

          </form>
        )}

      </div>
    </div>
  );
}
