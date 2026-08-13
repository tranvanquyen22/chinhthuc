// Dynamic Live GPS & Google Maps Location Engine for All Users

import { supabase } from './supabase';

const LOCATION_STORAGE_KEY = 'tq_user_live_gps_location';

export const DEFAULT_LOCATION = {
  lat: 10.7769,
  lng: 106.7009,
  address: '📍 TP. Hồ Chí Minh (Đã bật GPS tự động)',
  city: 'TP. HỒ CHÍ MINH',
  district: 'QUẬN 1',
  updated_at: new Date().toISOString()
};

// 1. Đọc vị trí hiện tại từ Storage
export const getUserLocation = () => {
  try {
    const saved = localStorage.getItem(LOCATION_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed && parsed.address) return parsed;
    }
  } catch (e) {
    console.error('getUserLocation error:', e);
  }
  return DEFAULT_LOCATION;
};

// 2. Cập nhật vị trí GPS mới vào CSDL Cloud & LocalStorage
export const saveUserLocation = async (lat, lng, customAddress = null, email = null) => {
  const addressText = customAddress || `📍 Tọa độ GPS: ${lat.toFixed(5)}, ${lng.toFixed(5)} (Ví trí hiện tại)`;
  
  const locationObj = {
    lat: Number(lat),
    lng: Number(lng),
    address: addressText,
    updated_at: new Date().toISOString()
  };

  localStorage.setItem(LOCATION_STORAGE_KEY, JSON.stringify(locationObj));
  window.dispatchEvent(new CustomEvent('user_location_updated', { detail: locationObj }));

  // Cập nhật CSDL Cloud Supabase nếu có email tài khoản
  if (email) {
    try {
      await supabase
        .from('profiles')
        .update({
          phone: addressText,
          updated_at: new Date().toISOString()
        })
        .eq('email', email);
    } catch (e) {
      console.warn('saveUserLocation Cloud sync notice:', e?.message);
    }
  }

  return locationObj;
};

// 3. Theo dõi di chuyển thời gian thực (Realtime GPS Watcher)
export const startLiveLocationTracking = (onLocationUpdate) => {
  if (!navigator.geolocation) {
    console.warn('Browser does not support Geolocation API');
    return null;
  }

  const watchId = navigator.geolocation.watchPosition(
    (position) => {
      const lat = position.coords.latitude;
      const lng = position.coords.longitude;
      const updatedObj = {
        lat,
        lng,
        address: `📍 GPS Live: ${lat.toFixed(5)}, ${lng.toFixed(5)} (Đang di chuyển)`,
        updated_at: new Date().toISOString()
      };

      localStorage.setItem(LOCATION_STORAGE_KEY, JSON.stringify(updatedObj));
      window.dispatchEvent(new CustomEvent('user_location_updated', { detail: updatedObj }));

      if (onLocationUpdate) {
        onLocationUpdate(updatedObj);
      }
    },
    (err) => {
      console.warn('Geolocation watch position notice:', err?.message);
    },
    {
      enableHighAccuracy: true,
      maximumAge: 10000,
      timeout: 15000
    }
  );

  return watchId;
};

export const stopLiveLocationTracking = (watchId) => {
  if (watchId && navigator.geolocation) {
    navigator.geolocation.clearWatch(watchId);
  }
};
