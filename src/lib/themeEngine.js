// Module quản lý Giao Diện & Sự Kiện Lễ Hội Toàn Hệ Thống Realtime (Supabase Realtime Theme Engine)

import { supabase } from './supabase';

const THEME_STORAGE_KEY = 'tq_system_theme_config';

export const SYSTEM_THEME_PRESETS = {
  tet_nguyen_dan: {
    id: 'tet_nguyen_dan',
    name: '🌸 Tết Nguyên Đán - Chợ Tết TQ (Đỏ Vàng Hoa Mai)',
    eventTag: '🌸 SỰ KIỆN TẾT TQ',
    bodyClass: 'theme-tet-nguyen-dan',
    bgGradient: 'bg-gradient-to-br from-red-900 via-amber-900 to-red-950',
    primaryColor: '#991b1b',
    accentColor: '#f59e0b',
    headerBg: 'bg-gradient-to-r from-red-700 via-amber-600 to-red-800 text-white',
    cardBg: 'bg-red-950/80 border-amber-400/40',
    bannerTitle: '🧧 CHỢ TẾT TQ - ĐẦU XUÂN SUM VẦY RƯỚC LỘC VÀNG 🧧',
    badgeBg: 'bg-amber-400 text-red-950 font-black'
  },
  giang_sinh: {
    id: 'giang_sinh',
    name: '🎄 Giáng Sinh & Năm Mới (Đỏ Noel & Xanh Tuyết)',
    eventTag: '🎄 MÙA GIÁNG SINH',
    bodyClass: 'theme-giang-sinh',
    bgGradient: 'bg-gradient-to-br from-emerald-950 via-slate-900 to-red-950',
    primaryColor: '#064e3b',
    accentColor: '#ef4444',
    headerBg: 'bg-gradient-to-r from-emerald-800 via-red-700 to-emerald-900 text-white',
    cardBg: 'bg-emerald-950/80 border-red-500/40',
    bannerTitle: '🎅 MÙA LỄ HỘI GIÁNG SINH - SẮM QUÀ GIẢM GIÁ 50% 🎁',
    badgeBg: 'bg-red-600 text-white font-black'
  },
  quoc_khanh: {
    id: 'quoc_khanh',
    name: '🇻🇳 Quốc Khánh 2/9 - Cờ Đỏ Sao Vàng (Rực Rỡ Cờ Hoa)',
    eventTag: '🇻🇳 MÙA QUỐC KHÁNH',
    bodyClass: 'theme-quoc-khanh',
    bgGradient: 'bg-gradient-to-br from-red-950 via-yellow-950 to-rose-950',
    primaryColor: '#b91c1c',
    accentColor: '#eab308',
    headerBg: 'bg-gradient-to-r from-red-700 via-red-800 to-amber-600 text-white',
    cardBg: 'bg-red-950/80 border-yellow-400/50',
    bannerTitle: '🇻🇳 CHÀO MỪNG QUỐC KHÁNH 2/9 - RỰC RỠ CỜ HOA TQ STORE 🇻🇳',
    badgeBg: 'bg-yellow-400 text-red-950 font-black'
  },
  black_friday: {
    id: 'black_friday',
    name: '🛍️ Siêu Sale Black Friday (Đen Metallic & Gold Neon)',
    eventTag: '⚡ BLACK FRIDAY SALE',
    bodyClass: 'theme-black-friday',
    bgGradient: 'bg-gradient-to-br from-neutral-950 via-slate-950 to-zinc-950',
    primaryColor: '#09090b',
    accentColor: '#facc15',
    headerBg: 'bg-gradient-to-r from-black via-zinc-900 to-amber-950 text-amber-300 border-b border-amber-400/50',
    cardBg: 'bg-zinc-900/90 border-amber-400/40',
    bannerTitle: '⚡ SIÊU BÃO XẢ HÀNG BLACK FRIDAY - GIẢM SÂU ĐẾN 80% ⚡',
    badgeBg: 'bg-amber-400 text-black font-black'
  },
  halloween: {
    id: 'halloween',
    name: '🎃 Lễ Hội Halloween (Cam Đen Bí Ngô Ma Mị)',
    eventTag: '🎃 HALLOWEEN PARTY',
    bodyClass: 'theme-halloween',
    bgGradient: 'bg-gradient-to-br from-purple-950 via-orange-950 to-black',
    primaryColor: '#581c87',
    accentColor: '#f97316',
    headerBg: 'bg-gradient-to-r from-purple-950 via-orange-950 to-purple-900 text-orange-300',
    cardBg: 'bg-purple-950/80 border-orange-500/40',
    bannerTitle: '🎃 LỄ HỘI HALLOWEEN MA MỊ - NHẬN QUÀ BÍ NGÔ MAY MẮN 👻',
    badgeBg: 'bg-orange-500 text-black font-black'
  },
  mua_he: {
    id: 'mua_he',
    name: '☀️ Mùa Hè Rực Rỡ (Xanh Biển Nhiệt Đới)',
    eventTag: '🏖️ SUMMER VIBES',
    bodyClass: 'theme-mua-he',
    bgGradient: 'bg-gradient-to-br from-sky-950 via-teal-950 to-cyan-950',
    primaryColor: '#0c4a6e',
    accentColor: '#38bdf8',
    headerBg: 'bg-gradient-to-r from-cyan-600 via-teal-600 to-sky-700 text-white',
    cardBg: 'bg-sky-950/80 border-cyan-400/40',
    bannerTitle: '🌊 MÙA HÈ RỰC RỠ - SẮM ĐỒ DU LỊCH & TAXI VI VU SEASIDE 🏖️',
    badgeBg: 'bg-cyan-400 text-sky-950 font-black'
  },
  fresh_red: {
    id: 'fresh_red',
    name: '🔴 Đỏ Tươi Shopee Style (Chợ Việt Nam Mặc Định)',
    eventTag: '🔴 TRANG CHỦ CHỢ VIỆT',
    bodyClass: 'theme-fresh-red',
    bgGradient: 'bg-gradient-to-br from-red-950 via-slate-900 to-rose-950',
    primaryColor: '#dc2626',
    accentColor: '#d97706',
    headerBg: 'bg-gradient-to-r from-red-600 via-rose-600 to-red-700 text-white',
    cardBg: 'bg-slate-900/90 border-red-500/30',
    bannerTitle: '🔥 CHỢ VIỆT NAM TQ STORE - MUA SẮM & DỊCH VỤ GIAO HOẢ TỐC 🚀',
    badgeBg: 'bg-amber-400 text-red-950 font-black'
  },
  dark_luxury: {
    id: 'dark_luxury',
    name: '🌙 Đêm Sang Trọng (Luxury Dark)',
    eventTag: '🌙 VIP LUXURY',
    bodyClass: 'theme-dark-luxury',
    bgGradient: 'bg-gradient-to-br from-slate-950 via-navy to-slate-900',
    primaryColor: '#0f172a',
    accentColor: '#f59e0b',
    headerBg: 'bg-slate-900/90 text-white',
    cardBg: 'bg-slate-900 border-slate-800',
    bannerTitle: '✨ TQ STORE VIP LUXURY - TRẢI NGHIỆM ĐẲNG CẤP BẬC NHẤT ✨',
    badgeBg: 'bg-amber-400 text-slate-950 font-black'
  },
  light_modern: {
    id: 'light_modern',
    name: '☀️ Sáng Hiện Đại (Modern Light)',
    eventTag: '☀️ LIGHT MODERN',
    bodyClass: 'theme-light-modern',
    bgGradient: 'bg-gradient-to-br from-slate-50 via-white to-gray-100',
    primaryColor: '#ffffff',
    accentColor: '#d97706',
    headerBg: 'bg-white/95 text-slate-900 shadow-md',
    cardBg: 'bg-white border-gray-200',
    bannerTitle: '🛒 SIÊU CHỢ TQ STORE - TRẢI NGHIỆM MUA SẮM HIỆN ĐẠI DỄ DÀNG 🛍️',
    badgeBg: 'bg-navy text-amber-300 font-black'
  },
  cyberpunk: {
    id: 'cyberpunk',
    name: '🔮 Neon Cyberpunk (Tím Dạ Quang)',
    eventTag: '🔮 CYBERPUNK NEON',
    bodyClass: 'theme-cyberpunk',
    bgGradient: 'bg-gradient-to-br from-purple-950 via-slate-950 to-indigo-950',
    primaryColor: '#2e1065',
    accentColor: '#ec4899',
    headerBg: 'bg-purple-950/90 text-pink-300 border-b border-pink-500/30',
    cardBg: 'bg-purple-950/60 border-pink-500/30',
    bannerTitle: '🔮 CÔNG NGHỆ CYBERPUNK 2026 - GIAO DỊCH TỰ ĐỘNG THÔNG MINH ⚡',
    badgeBg: 'bg-pink-500 text-white font-black'
  },
  emerald_gold: {
    id: 'emerald_gold',
    name: '🌿 Hoàng Gia Lục Bảo (Emerald & Gold)',
    eventTag: '🌿 EMERALD GOLD',
    bodyClass: 'theme-emerald-gold',
    bgGradient: 'bg-gradient-to-br from-emerald-950 via-slate-950 to-teal-950',
    primaryColor: '#064e3b',
    accentColor: '#fbbf24',
    headerBg: 'bg-emerald-950/90 text-emerald-100 border-b border-emerald-500/30',
    cardBg: 'bg-emerald-950/60 border-emerald-500/30',
    bannerTitle: '🌿 HOÀNG GIA LỤC BẢO - ƯU ĐÃI ĐẶC QUYỀN TÀI KHOẢN TQ STORE 👑',
    badgeBg: 'bg-emerald-400 text-emerald-950 font-black'
  }
};

export const DEFAULT_THEME = SYSTEM_THEME_PRESETS.fresh_red;

// 1. Áp dụng Theme trực tiếp lên thẻ <html> / <body> của trình duyệt
export const applyThemeToDocument = (themeObj) => {
  if (!themeObj) return;
  const root = document.documentElement;
  const body = document.body;

  // Xóa toàn bộ theme class cũ
  Object.values(SYSTEM_THEME_PRESETS).forEach(t => {
    body.classList.remove(t.bodyClass);
    root.classList.remove(t.bodyClass);
  });

  const activeTheme = SYSTEM_THEME_PRESETS[themeObj.theme_name] || SYSTEM_THEME_PRESETS[themeObj.id] || DEFAULT_THEME;

  // Thêm class & data-theme attribute mới
  body.classList.add(activeTheme.bodyClass);
  root.setAttribute('data-theme', activeTheme.id);
  root.style.setProperty('--primary-color', activeTheme.primaryColor);
  root.style.setProperty('--accent-color', activeTheme.accentColor);
  
  // Phát tín hiệu Event để các Component Header/Banner tự động cập nhật banner/bannerTitle sự kiện
  window.dispatchEvent(new CustomEvent('system_theme_changed', { detail: activeTheme }));
};

// 2. Đọc Theme từ LocalStorage (Fallback nhanh)
export const getSystemThemeConfig = () => {
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      return SYSTEM_THEME_PRESETS[parsed.theme_name] || SYSTEM_THEME_PRESETS[parsed.id] || DEFAULT_THEME;
    }
  } catch (e) {
    console.error('getSystemThemeConfig error:', e);
  }
  return DEFAULT_THEME;
};

// 3. Đọc Theme mặc định từ CSDL Cloud Supabase
export const fetchCloudSystemThemeConfig = async () => {
  try {
    const { data, error } = await supabase
      .from('tq_platform_config')
      .select('system_theme')
      .limit(1)
      .single();

    if (!error && data?.system_theme) {
      const themeObj = data.system_theme;
      localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(themeObj));
      applyThemeToDocument(themeObj);
      return SYSTEM_THEME_PRESETS[themeObj.theme_name] || SYSTEM_THEME_PRESETS[themeObj.id] || DEFAULT_THEME;
    }
  } catch (err) {
    console.warn('Supabase Cloud System Theme Fetch Notice:', err?.message);
  }
  
  const current = getSystemThemeConfig();
  applyThemeToDocument(current);
  return current;
};

// 4. Hàm xử lý cho Admin khi bấm đổi Giao Diện Sự Kiện (Cập nhật dữ liệu lên Supabase Realtime)
export const saveSystemThemeConfig = async (themeName, updatedBy = 'Admin') => {
  const selectedPreset = SYSTEM_THEME_PRESETS[themeName] || DEFAULT_THEME;

  const payload = {
    id: selectedPreset.id,
    theme_name: selectedPreset.id,
    name: selectedPreset.name,
    eventTag: selectedPreset.eventTag,
    bannerTitle: selectedPreset.bannerTitle,
    primaryColor: selectedPreset.primaryColor,
    accentColor: selectedPreset.accentColor,
    updated_by: updatedBy,
    updated_at: new Date().toISOString()
  };

  // Lưu vào LocalStorage
  localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(payload));
  applyThemeToDocument(payload);

  // Cập nhật dữ liệu lên Supabase Cloud Database để kích hoạt Realtime cho toàn bộ người dùng
  try {
    const { data } = await supabase
      .from('tq_platform_config')
      .select('system_theme')
      .limit(1)
      .single();

    await supabase
      .from('tq_platform_config')
      .upsert({
        id: 1,
        system_theme: payload,
        updated_at: new Date().toISOString()
      });
  } catch (err) {
    console.warn('Supabase Cloud System Theme Upsert Notice:', err?.message);
  }

  return selectedPreset;
};

// 5. Đăng ký nhận Sự Kiện Thay Đổi Theme Realtime từ Supabase (Realtime Channel per subscriber)
export const subscribeSystemThemeRealtime = (onThemeUpdate) => {
  const channelName = `realtime_theme_channel_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const channel = supabase
    .channel(channelName)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'tq_platform_config'
      },
      (payload) => {
        if (payload.new && payload.new.system_theme) {
          const newThemeObj = payload.new.system_theme;
          localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(newThemeObj));
          applyThemeToDocument(newThemeObj);
          if (onThemeUpdate) {
            onThemeUpdate(SYSTEM_THEME_PRESETS[newThemeObj.theme_name] || SYSTEM_THEME_PRESETS[newThemeObj.id] || DEFAULT_THEME);
          }
        }
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
};
