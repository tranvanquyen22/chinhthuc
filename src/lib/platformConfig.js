import { supabase } from './supabase';

const PLATFORM_CONFIG_KEY = 'tq_platform_config';

const DEFAULT_CONFIG = {
  wallet_discount_percent: 2,   // % Ưu đãi giảm giá trực tiếp khi thanh toán Ví TQ Pay (Mặc định 2%)
  coins_cashback_percent: 1,    // % Hoàn TQ Xu khi mua hàng & đánh giá (Mặc định 1%)
  platform_fee_percent: 5,      // % Phí sàn dịch vụ khấu trừ đơn hàng toàn hệ thống (Mặc định 5%)
  updated_at: new Date().toISOString(),
  updated_by: 'tqstore2212@gmail.com'
};

// Đọc cấu hình tham số hệ thống hiện tại
export const getPlatformConfig = () => {
  try {
    const saved = localStorage.getItem(PLATFORM_CONFIG_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      return {
        wallet_discount_percent: Number(parsed.wallet_discount_percent ?? DEFAULT_CONFIG.wallet_discount_percent),
        coins_cashback_percent: Number(parsed.coins_cashback_percent ?? DEFAULT_CONFIG.coins_cashback_percent),
        platform_fee_percent: Number(parsed.platform_fee_percent ?? DEFAULT_CONFIG.platform_fee_percent),
        updated_at: parsed.updated_at || DEFAULT_CONFIG.updated_at,
        updated_by: parsed.updated_by || DEFAULT_CONFIG.updated_by
      };
    }
  } catch (e) {
    console.error(e);
  }
  return DEFAULT_CONFIG;
};

// Đọc cấu hình từ Supabase Cloud DB Realtime
export const fetchCloudPlatformConfig = async () => {
  try {
    const { data, error } = await supabase
      .from('tq_platform_config')
      .select('*')
      .limit(1)
      .single();

    if (!error && data) {
      const configObj = {
        wallet_discount_percent: Number(data.wallet_discount_percent ?? 2),
        coins_cashback_percent: Number(data.coins_cashback_percent ?? 1),
        platform_fee_percent: Number(data.platform_fee_percent ?? 5),
        updated_at: data.updated_at || new Date().toISOString(),
        updated_by: data.updated_by || 'Admin'
      };
      localStorage.setItem(PLATFORM_CONFIG_KEY, JSON.stringify(configObj));
      return configObj;
    }
  } catch (err) {
    console.warn('Supabase Cloud Platform Config Notice:', err?.message);
  }

  return getPlatformConfig();
};

// Lưu & Cập nhật cấu hình tham số toàn sàn từ Admin
export const savePlatformConfig = async (newConfig, adminEmail = 'Admin') => {
  const configObj = {
    id: 1,
    wallet_discount_percent: Number(newConfig.wallet_discount_percent ?? 2),
    coins_cashback_percent: Number(newConfig.coins_cashback_percent ?? 1),
    platform_fee_percent: Number(newConfig.platform_fee_percent ?? 5),
    updated_at: new Date().toISOString(),
    updated_by: adminEmail
  };

  // 1. Lưu LocalStorage
  try {
    localStorage.setItem(PLATFORM_CONFIG_KEY, JSON.stringify(configObj));
  } catch (e) {
    console.error(e);
  }

  // 2. Cập nhật Supabase Cloud DB
  try {
    await supabase.from('tq_platform_config').upsert(configObj, { onConflict: 'id' });
  } catch (err) {
    console.warn('Supabase Cloud Save Platform Config Notice:', err?.message);
  }

  return configObj;
};
