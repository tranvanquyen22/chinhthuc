import React, { useState, useEffect } from 'react';
import {
  getSystemAnnouncements,
  fetchCloudAnnouncements,
  subscribeAnnouncementsRealtime,
  getReadAnnouncementIds,
  markAnnouncementAsRead
} from '../lib/announcements';

export default function BroadcastAnnouncementModal() {
  const [announcements, setAnnouncements] = useState(getSystemAnnouncements());
  const [readIds, setReadIds] = useState(getReadAnnouncementIds());
  const [isOpenModal, setIsOpenModal] = useState(false);
  const [selectedAnnouncement, setSelectedAnnouncement] = useState(null);
  const [toastNotification, setToastNotification] = useState(null);

  useEffect(() => {
    // 1. Tải danh sách thông báo từ Supabase (Khách mới vào sau vẫn xem được)
    fetchCloudAnnouncements().then(data => {
      if (data && data.length > 0) {
        setAnnouncements(data);
      }
    });

    // 2. Lắng nghe thông báo Realtime từ Admin đẩy xuống lập tức
    const unsubscribe = subscribeAnnouncementsRealtime((newBroadcast) => {
      setAnnouncements(prev => [newBroadcast, ...prev]);
      setToastNotification(newBroadcast);
    });

    return () => unsubscribe();
  }, []);

  const unreadCount = announcements.filter(a => !readIds.includes(a.id)).length;

  const handleOpenAnnouncement = (item) => {
    setSelectedAnnouncement(item);
    markAnnouncementAsRead(item.id);
    setReadIds(getReadAnnouncementIds());
  };

  const handleCloseDetail = () => {
    setSelectedAnnouncement(null);
  };

  return (
    <>
      {/* 1. NÚT CHUÔNG THÔNG BÁO NỔI Ở GÓC DƯỚI BÊN PHẢI (FLOATING BELL WIDGET) */}
      <div className="fixed bottom-6 right-6 z-40 flex items-center gap-2">
        {unreadCount > 0 && (
          <div 
            onClick={() => setIsOpenModal(true)}
            className="hidden sm:flex bg-gradient-to-r from-red-600 to-amber-600 text-white font-extrabold text-xs px-3 py-2 rounded-2xl shadow-xl border border-amber-300 animate-bounce cursor-pointer items-center gap-1.5"
          >
            <i className="fa-solid fa-bullhorn text-amber-300"></i>
            <span>{unreadCount} thông báo mới từ Admin!</span>
          </div>
        )}

        <button 
          onClick={() => setIsOpenModal(true)}
          className="relative w-13 h-13 bg-gradient-to-r from-red-600 via-rose-600 to-amber-600 hover:scale-110 text-white rounded-full flex items-center justify-center text-xl shadow-2xl border-2 border-amber-300 transition-all cursor-pointer group"
          title="Thông báo toàn hệ thống"
        >
          <i className="fa-solid fa-bell group-hover:rotate-12 transition-transform"></i>

          {/* Unread Counter Badge */}
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-amber-400 text-navy font-black text-[10px] w-5 h-5 rounded-full flex items-center justify-center border-2 border-navy font-mono shadow-md animate-pulse">
              {unreadCount}
            </span>
          )}
        </button>
      </div>

      {/* 2. TOAST NOTIFICATION POPUP KHI ADMIN VỪA PHÁT THÔNG BÁO REALTIME */}
      {toastNotification && (
        <div className="fixed top-20 right-4 z-50 max-w-md w-full bg-gradient-to-r from-slate-950 via-navy to-slate-900 text-white p-4 rounded-3xl border-2 border-amber-400 shadow-2xl animate-in slide-in-from-top duration-300">
          <div className="flex items-start justify-between gap-3">
            <div className="w-10 h-10 bg-amber-500/30 text-amber-300 border border-amber-400/50 rounded-2xl flex items-center justify-center text-lg shrink-0">
              <i className="fa-solid fa-bullhorn animate-pulse"></i>
            </div>

            <div className="flex-1 space-y-1">
              <span className="bg-amber-400 text-navy font-black text-[9px] px-2 py-0.5 rounded-full uppercase">
                {toastNotification.badge || '📢 THÔNG BÁO REALTIME'}
              </span>
              <h5 className="font-black text-xs text-amber-300 line-clamp-1">{toastNotification.title}</h5>
              <p className="text-[11px] text-gray-200 line-clamp-2">{toastNotification.content}</p>

              <button 
                onClick={() => {
                  handleOpenAnnouncement(toastNotification);
                  setToastNotification(null);
                }}
                className="mt-2 text-[10px] font-black text-amber-300 underline cursor-pointer hover:text-white flex items-center gap-1"
              >
                <span>Xem chi tiết thông báo &rarr;</span>
              </button>
            </div>

            <button 
              onClick={() => setToastNotification(null)}
              className="text-gray-400 hover:text-white font-black text-xs cursor-pointer p-1"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* 3. MODAL DANH SÁCH THÔNG BÁO HỆ THỐNG (SYSTEM ANNOUNCEMENT LIST MODAL) */}
      {isOpenModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-xl w-full p-5 sm:p-6 space-y-4 shadow-2xl border-2 border-amber-400 max-h-[85vh] overflow-y-auto animate-in zoom-in-95 duration-200 font-sans text-xs">
            
            {/* Header */}
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 bg-red-600 text-white rounded-2xl flex items-center justify-center text-lg font-black shadow-sm">
                  <i className="fa-solid fa-bullhorn"></i>
                </div>
                <div>
                  <h4 className="font-black text-sm text-navy uppercase tracking-wider">
                    📢 THÔNG BÁO TOÀN HỆ THỐNG TỪ ADMIN
                  </h4>
                  <p className="text-[10px] text-gray-500 font-medium">
                    Các cập nhật mới nhất, mã khuyến mãi & thông báo quan trọng
                  </p>
                </div>
              </div>

              <button 
                onClick={() => setIsOpenModal(false)}
                className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 flex items-center justify-center font-black cursor-pointer text-xs"
              >
                ✕
              </button>
            </div>

            {/* Danh sách thông báo */}
            <div className="space-y-3">
              {announcements.map((item) => {
                const isRead = readIds.includes(item.id);
                const isPromo = item.type === 'PROMOTION';
                const isUrgent = item.type === 'URGENT';

                return (
                  <div 
                    key={item.id}
                    onClick={() => handleOpenAnnouncement(item)}
                    className={`p-4 rounded-2xl border transition-all cursor-pointer space-y-2 relative group ${
                      !isRead 
                        ? 'bg-amber-50/70 border-amber-400 shadow-md ring-1 ring-amber-300/50' 
                        : 'bg-white border-gray-200 hover:border-navy/40'
                    }`}
                  >
                    {!isRead && (
                      <span className="absolute top-3 right-3 w-2.5 h-2.5 bg-red-600 rounded-full animate-ping"></span>
                    )}

                    <div className="flex items-center gap-2">
                      <span className={`font-black text-[9px] px-2 py-0.5 rounded-full text-white ${
                        isUrgent ? 'bg-red-600' : isPromo ? 'bg-amber-500' : 'bg-navy'
                      }`}>
                        {item.badge || '📢 THÔNG BÁO'}
                      </span>
                      <span className="text-[10px] text-gray-400 font-mono">
                        {new Date(item.created_at || Date.now()).toLocaleDateString('vi-VN')}
                      </span>
                    </div>

                    <h5 className={`font-black text-xs text-navy group-hover:text-red-600 transition-colors ${!isRead ? 'text-red-600' : ''}`}>
                      {item.title}
                    </h5>

                    <p className="text-gray-600 text-[11px] line-clamp-2 leading-relaxed">
                      {item.content}
                    </p>

                    <div className="flex items-center justify-between text-[10px] pt-1 text-gray-400 border-t border-gray-100/80">
                      <span>Đăng bởi: <strong>{item.created_by || 'Super Admin'}</strong></span>
                      <span className="font-bold text-navy group-hover:underline">Bấm để đọc nội dung đầy đủ &rarr;</span>
                    </div>
                  </div>
                );
              })}
            </div>

          </div>
        </div>
      )}

      {/* 4. MODAL CHI TIẾT NỘI DUNG THÔNG BÁO (ANNOUNCEMENT DETAIL MODAL) */}
      {selectedAnnouncement && (
        <div className="fixed inset-0 z-[130] bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 font-sans">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-2xl border-2 border-amber-400 animate-in zoom-in-95 duration-200 text-xs">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <span className="bg-navy text-amber-300 font-black text-[10px] px-2.5 py-1 rounded-full uppercase">
                {selectedAnnouncement.badge || '📢 THÔNG BÁO HỆ THỐNG'}
              </span>

              <button 
                onClick={handleCloseDetail}
                className="w-7 h-7 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 flex items-center justify-center font-black cursor-pointer text-xs"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <h4 className="font-black text-sm text-navy leading-snug">
                {selectedAnnouncement.title}
              </h4>

              <div className="flex items-center justify-between text-[10px] text-gray-500 font-mono border-b border-gray-100 pb-2">
                <span>Người phát hành: <strong className="text-red-600">{selectedAnnouncement.created_by || 'Super Admin'}</strong></span>
                <span>Thời gian: {new Date(selectedAnnouncement.created_at || Date.now()).toLocaleString('vi-VN')}</span>
              </div>

              <div className="bg-slate-50 p-4 rounded-2xl border border-gray-200 text-gray-800 text-xs leading-relaxed space-y-2 whitespace-pre-line font-medium">
                {selectedAnnouncement.content}
              </div>
            </div>

            <button 
              onClick={handleCloseDetail}
              className="w-full bg-navy hover:bg-navy-dark text-amber-300 font-black py-2.5 rounded-xl text-xs uppercase cursor-pointer transition-all shadow-md"
            >
              ĐÃ ĐỌC THÔNG BÁO
            </button>
          </div>
        </div>
      )}
    </>
  );
}
