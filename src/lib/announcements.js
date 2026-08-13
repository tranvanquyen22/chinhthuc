// Helper module for System-Wide Broadcast Announcements via Supabase Realtime

import { supabase } from './supabase';

const ANNOUNCEMENTS_KEY = 'tq_system_announcements_store';
const READ_ANNOUNCEMENTS_KEY = 'tq_read_announcements_list';

const DEFAULT_ANNOUNCEMENTS = [
  {
    id: 1,
    title: '📢 CHÀO MỪNG BẠN ĐẾN VỚI TQ STORE - SÀN THƯƠNG MẠI ĐIỆN TỬ ĐA GIAN HÀNG',
    content: 'TQ Store chính thức ra mắt giao diện mới với hàng ngàn ưu đãi nạp Ví TQ Pay hoàn Xu tích lũy, miễn phí sàn cho Chủ gian hàng và giao hàng hoả tốc toàn quốc!',
    type: 'ANNOUNCEMENT',
    badge: '📢 THÔNG BÁO NỔI BẬT',
    is_active: true,
    created_by: 'Super Admin Overlord',
    created_at: new Date().toISOString()
  }
];

// 1. Đọc thông báo từ LocalStorage (Guest & Users)
export const getSystemAnnouncements = () => {
  try {
    const saved = localStorage.getItem(ANNOUNCEMENTS_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    console.error('getSystemAnnouncements error:', e);
  }
  return DEFAULT_ANNOUNCEMENTS;
};

// 2. Lấy thông báo mới nhất từ Supabase Cloud CSDL (Cho cả khách vãng lai & người dùng vào sau)
export const fetchCloudAnnouncements = async () => {
  try {
    const { data, error } = await supabase
      .from('system_announcements')
      .select('*')
      .eq('is_active', true)
      .order('id', { ascending: false });

    if (!error && data && data.length > 0) {
      localStorage.setItem(ANNOUNCEMENTS_KEY, JSON.stringify(data));
      return data;
    }
  } catch (err) {
    console.warn('Supabase Cloud Announcements Fetch Notice:', err?.message);
  }
  return getSystemAnnouncements();
};

// 3. Tạo và phát thông báo mới (Dành cho Super Admin)
export const createSystemAnnouncement = async (announcementData) => {
  const newAnnouncement = {
    title: announcementData.title.trim(),
    content: announcementData.content.trim(),
    type: announcementData.type || 'ANNOUNCEMENT',
    badge: announcementData.type === 'PROMOTION' ? '🎁 SIÊU KHUYẾN MÃI' 
         : announcementData.type === 'URGENT' ? '🚨 KHẨN CẤP' 
         : announcementData.type === 'MAINTENANCE' ? '🛠️ THÔNG BÁO BẢO TRÌ' 
         : '📢 THÔNG BÁO MỚI',
    is_active: true,
    created_by: announcementData.createdBy || 'Super Admin',
    created_at: new Date().toISOString()
  };

  try {
    // 3.1 Ghi vào Supabase Cloud Database để lưu trữ vĩnh viễn cho tất cả khách vào sau
    const { data, error } = await supabase
      .from('system_announcements')
      .insert([newAnnouncement])
      .select();

    if (!error && data && data[0]) {
      const createdObj = data[0];
      const existing = getSystemAnnouncements();
      const updated = [createdObj, ...existing];
      localStorage.setItem(ANNOUNCEMENTS_KEY, JSON.stringify(updated));
      return createdObj;
    }
  } catch (e) {
    console.warn('Supabase Announcements Insert Notice:', e?.message);
  }

  // Fallback local storage
  const fallbackObj = { id: Date.now(), ...newAnnouncement };
  const existing = getSystemAnnouncements();
  const updated = [fallbackObj, ...existing];
  localStorage.setItem(ANNOUNCEMENTS_KEY, JSON.stringify(updated));
  return fallbackObj;
};

// 4. Kết nối Supabase Realtime phát thông báo tức thì tới tất cả thiết bị đang truy cập
export const subscribeAnnouncementsRealtime = (onNewAnnouncement) => {
  const channelName = `realtime_announcements_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  
  const channel = supabase
    .channel(channelName)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'system_announcements' },
      (payload) => {
        if (payload.new && payload.new.is_active) {
          const newBroadcast = payload.new;
          const existing = getSystemAnnouncements();
          const updated = [newBroadcast, ...existing];
          localStorage.setItem(ANNOUNCEMENTS_KEY, JSON.stringify(updated));

          if (onNewAnnouncement) {
            onNewAnnouncement(newBroadcast);
          }
        }
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
};

// 5. Đánh dấu danh sách thông báo đã đọc
export const getReadAnnouncementIds = () => {
  try {
    const saved = localStorage.getItem(READ_ANNOUNCEMENTS_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch (e) {
    return [];
  }
};

export const markAnnouncementAsRead = (announcementId) => {
  try {
    const readIds = getReadAnnouncementIds();
    if (!readIds.includes(announcementId)) {
      const updated = [...readIds, announcementId];
      localStorage.setItem(READ_ANNOUNCEMENTS_KEY, JSON.stringify(updated));
    }
  } catch (e) {
    console.error(e);
  }
};
