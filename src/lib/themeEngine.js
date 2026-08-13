// Module quản lý Giao Diện Toàn Hệ Thống Realtime (Supabase Realtime Theme Engine)

import { supabase } from './supabase';

const THEME_STORAGE_KEY = 'tq_system_theme_config';

export const SYSTEM_THEME_PRESETS = {
  dark_luxury: {
    id: 'dark_luxury',
    name: '🌙 Đêm Sang Trọng (Luxury Dark)',
    bodyClass: 'theme-dark-luxury',
    bgGradient: 'bg-gradient-to-br from-slate-950 via-navy to-slate-900',
    primaryColor: '#0f172a',
    accentColor: '#f59e0b',
    headerBg: 'bg-slate-900/90 text-white',
    cardBg: 'bg-slate-900 border-slate-800'
  },
  light_modern: {
    id: 'light_modern',
    name: '☀️ Sáng Hiện Đại (Modern Light)',
    bodyClass: 'theme-light-modern',
    bgGradient: 'bg-gradient-to-br from-slate-50 via-white to-gray-100',
    primaryColor: '#ffffff',
    accentColor: '#d97706',
    headerBg: 'bg-white/95 text-slate-900 shadow-md',
    cardBg: 'bg-white border-gray-200'
  },
  cyberpunk: {
    id: 'cyberpunk',
    name: '🔮 Neon Cyberpunk (Tím Dạ Quang)',
    bodyClass: 'theme-cyberpunk',
    bgGradient: 'bg-gradient-to-br from-purple-950 via-slate-950 to-indigo-950',
    primaryColor: '#2e1065',
    accentColor: '#ec4899',
    headerBg: 'bg-purple-950/90 text-pink-300 border-b border-pink-500/30',
    cardBg: 'bg-purple-950/60 border-pink-500/30'
  },
  emerald_gold: {
    id: 'emerald_gold',
    name: '🌿 Hoàng Gia Lục Bảo (Emerald & Gold)',
    bodyClass: 'theme-emerald-gold',
    bgGradient: 'bg-gradient-to-br from-emerald-950 via-slate-950 to-teal-950',
    primaryColor: '#064e3b',
    accentColor: '#fbbf24',
    headerBg: 'bg-emerald-950/90 text-emerald-100 border-b border-emerald-500/30',
    cardBg: 'bg-emerald-950/60 border-emerald-500/30'
  },
  neon_sunset: {
    id: 'neon_sunset',
    name: '🌅 Hoàng Hôn Rực Rỡ (Neon Sunset)',
    bodyClass: 'theme-neon-sunset',
    bgGradient: 'bg-gradient-to-br from-rose-950 via-slate-950 to-orange-950',
    primaryColor: '#4c0519',
    accentColor: '#f97316',
    headerBg: 'bg-rose-950/90 text-amber-200 border-b border-orange-500/30',
    cardBg: 'bg-rose-950/60 border-orange-500/30'
  }
};

export const DEFAULT_THEME = SYSTEM_THEME_PRESETS.dark_luxury;

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

// 4. Hàm xử lý cho Admin khi bấm đổi Giao Diện (Cập nhật dữ liệu lên Supabase)
export const saveSystemThemeConfig = async (themeName, updatedBy = 'Admin') => {
  const selectedPreset = SYSTEM_THEME_PRESETS[themeName] || DEFAULT_THEME;

  const payload = {
    id: selectedPreset.id,
    theme_name: selectedPreset.id,
    name: selectedPreset.name,
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

  } catch (e) {
    console.warn('saveSystemThemeConfig Supabase Cloud notice:', e?.message);
  }

  return selectedPreset;
};

// 5. Kết nối Supabase Realtime để lắng nghe sự thay đổi giao diện từ Admin theo thời gian thực
export const subscribeSystemThemeRealtime = (onThemeChange) => {
  const channelName = `realtime_system_theme_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

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

          const activePreset = SYSTEM_THEME_PRESETS[newThemeObj.theme_name] || SYSTEM_THEME_PRESETS[newThemeObj.id] || DEFAULT_THEME;
          if (onThemeChange) {
            onThemeChange(activePreset);
          }
        }
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
};
