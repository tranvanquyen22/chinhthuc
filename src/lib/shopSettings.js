// Helper module for managing Shop Settings: Warehouse address, Google Maps geolocation, Bank account & custom VietQR

import { supabase } from './supabase';

const SHOP_SETTINGS_KEY = 'tq_shop_settings_store';

const DEFAULT_SHOP_SETTINGS = {
  shopEmail: 'retail@tqstore.vn',
  shopName: 'TQ RETAIL SHOP (Thời Trang)',
  warehouseAddress: '245 Nguyễn Trãi, Phường Bến Thành, Quận 1, TP. Hồ Chí Minh',
  googleMapsUrl: 'https://maps.google.com/?q=10.7719,106.6983',
  latitude: 10.7719,
  longitude: 106.6983,
  phone: '0988 888 888',
  bankName: 'MB Bank (Ngân Hàng Quân Đội)',
  bankCode: 'MB',
  accountNumber: '0988888888',
  accountHolder: 'CHU GIAN HANG TQ RETAIL',
  qrCodeUrl: 'https://img.vietqr.io/image/MB-0988888888-compact2.png',
  allowPickup: true,
  allowShipping: true,
  updatedAt: new Date().toISOString()
};

export const getShopSettings = (shopEmail) => {
  if (!shopEmail) return DEFAULT_SHOP_SETTINGS;
  const cleanEmail = shopEmail.trim().toLowerCase();
  try {
    const saved = localStorage.getItem(SHOP_SETTINGS_KEY);
    if (saved) {
      const store = JSON.parse(saved);
      if (store[cleanEmail]) {
        return store[cleanEmail];
      }
    }
  } catch (e) {
    console.error('getShopSettings error:', e);
  }

  return {
    ...DEFAULT_SHOP_SETTINGS,
    shopEmail: cleanEmail
  };
};

export const fetchCloudShopSettings = async (shopEmail) => {
  if (!shopEmail) return DEFAULT_SHOP_SETTINGS;
  const cleanEmail = shopEmail.trim().toLowerCase();
  try {
    const { data, error } = await supabase
      .from('tq_platform_config')
      .select('shop_settings')
      .limit(1)
      .single();

    if (!error && data?.shop_settings && data.shop_settings[cleanEmail]) {
      const shopObj = data.shop_settings[cleanEmail];
      const saved = localStorage.getItem(SHOP_SETTINGS_KEY);
      const store = saved ? JSON.parse(saved) : {};
      store[cleanEmail] = shopObj;
      localStorage.setItem(SHOP_SETTINGS_KEY, JSON.stringify(store));
      return shopObj;
    }
  } catch (err) {
    console.warn('Supabase Cloud Shop Settings Notice:', err?.message);
  }
  return getShopSettings(cleanEmail);
};

export const saveShopSettings = async (shopEmail, settingsObj) => {
  if (!shopEmail) return;
  const cleanEmail = shopEmail.trim().toLowerCase();
  const bankCode = settingsObj.bankCode || 'MB';
  const accountNumber = settingsObj.accountNumber || '';
  const qrUrl = `https://img.vietqr.io/image/${bankCode}-${accountNumber}-compact2.png`;

  const payload = {
    shopEmail: cleanEmail,
    shopName: settingsObj.shopName || cleanEmail,
    warehouseAddress: settingsObj.warehouseAddress || '',
    googleMapsUrl: settingsObj.googleMapsUrl || '',
    latitude: Number(settingsObj.latitude || 10.7719),
    longitude: Number(settingsObj.longitude || 106.6983),
    phone: settingsObj.phone || '',
    bankName: settingsObj.bankName || 'MB Bank',
    bankCode: bankCode,
    accountNumber: accountNumber,
    accountHolder: (settingsObj.accountHolder || '').toUpperCase(),
    qrCodeUrl: qrUrl,
    allowPickup: settingsObj.allowPickup !== false,
    allowShipping: settingsObj.allowShipping !== false,
    updatedAt: new Date().toISOString()
  };

  try {
    const saved = localStorage.getItem(SHOP_SETTINGS_KEY);
    const store = saved ? JSON.parse(saved) : {};
    store[cleanEmail] = payload;
    localStorage.setItem(SHOP_SETTINGS_KEY, JSON.stringify(store));

    // Also sync to Supabase Cloud DB
    const { data } = await supabase
      .from('tq_platform_config')
      .select('shop_settings')
      .limit(1)
      .single();
    
    const cloudStore = data?.shop_settings || {};
    cloudStore[cleanEmail] = payload;

    await supabase
      .from('tq_platform_config')
      .upsert({ id: 1, shop_settings: cloudStore, updated_at: new Date().toISOString() });

  } catch (e) {
    console.error('saveShopSettings error:', e);
  }

  return payload;
};
