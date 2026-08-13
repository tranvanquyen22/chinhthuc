import React from 'react';

export default function LocationFilterBar({
  selectedCity,
  setSelectedCity,
  selectedDistrict,
  setSelectedDistrict
}) {
  const cities = [
    { id: 'ALL', name: 'Tất Cả Tỉnh Thành Việt Nam' },
    { id: 'TP. HỒ CHÍ MINH', name: 'TP. Hồ Chí Minh' },
    { id: 'HÀ NỘI', name: 'Hà Nội' },
    { id: 'ĐÀ NẴNG', name: 'Đà Nẵng' },
    { id: 'HẢI PHÒNG', name: 'Hải Phòng' },
    { id: 'CẦN THƠ', name: 'Cần Thơ' }
  ];

  const districts = [
    { id: 'ALL', name: 'Tất Cả Quận/Huyện' },
    { id: 'Q1', name: 'Quận 1' },
    { id: 'Q3', name: 'Quận 3' },
    { id: 'Q7', name: 'Quận 7' },
    { id: 'Q_BINHTHANH', name: 'Quận Bình Thạnh' },
    { id: 'Q_TANBINH', name: 'Quận Tân Bình' },
    { id: 'Q_CAUGIAY', name: 'Quận Cầu Giấy' },
    { id: 'Q_HOANKIEM', name: 'Quận Hoàn Kiếm' }
  ];

  return (
    <section className="bg-gradient-to-r from-navy via-slate-900 to-indigo-950 text-white rounded-2xl p-4 sm:p-5 shadow-md border border-amber-400/30 font-sans space-y-3">
      {/* Tiêu đề section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b border-white/10 pb-2.5">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-amber-400 text-navy rounded-lg flex items-center justify-center text-xs font-black shadow">
            <i className="fa-solid fa-location-dot"></i>
          </div>
          <div>
            <h3 className="font-black text-xs sm:text-sm text-amber-300 uppercase tracking-wider">
              KHU VỰC & TỈNH THÀNH BẠN MUỐN XEM
            </h3>
            <p className="text-[11px] text-gray-300 font-medium">
              Lọc danh sách sản phẩm & gian hàng theo đúng vị trí Kho / Google Maps của Shop
            </p>
          </div>
        </div>

        <span className="text-[10px] bg-emerald-500/20 text-emerald-300 font-bold px-2.5 py-0.5 rounded-full border border-emerald-400/30 self-start sm:self-center">
          📍 Định vị kho toàn quốc
        </span>
      </div>

      {/* Thanh chọn Địa điểm (Dropdown Selectors ngang) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs pt-1">
        {/* Dropdown Tỉnh/Thành */}
        <div className="flex items-center bg-white/10 border border-white/20 rounded-xl px-3 py-2 text-white focus-within:border-amber-400 transition-all">
          <i className="fa-solid fa-map-location-dot text-amber-400 text-sm mr-2 shrink-0"></i>
          <select 
            value={selectedCity}
            onChange={(e) => setSelectedCity(e.target.value)}
            className="bg-transparent text-white font-bold text-xs focus:outline-none w-full cursor-pointer [&>option]:text-gray-900"
          >
            {cities.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        {/* Dropdown Quận/Huyện */}
        <div className="flex items-center bg-white/10 border border-white/20 rounded-xl px-3 py-2 text-white focus-within:border-amber-400 transition-all">
          <i className="fa-solid fa-street-view text-amber-400 text-sm mr-2 shrink-0"></i>
          <select 
            value={selectedDistrict}
            onChange={(e) => setSelectedDistrict(e.target.value)}
            className="bg-transparent text-white font-bold text-xs focus:outline-none w-full cursor-pointer [&>option]:text-gray-900"
          >
            {districts.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>
      </div>
    </section>
  );
}
