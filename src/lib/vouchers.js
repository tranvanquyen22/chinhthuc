// Helper module for managing, creating, and validating system-wide Vouchers & Promo Coupons

import { supabase } from './supabase';

const VOUCHERS_KEY = 'tq_system_vouchers';

const DEFAULT_VOUCHERS = [
  {
    id: 'v1',
    code: 'TQ10',
    discountType: 'PERCENT',
    discountValue: 10,
    minOrderValue: 100000,
    usageLimit: 1000,
    usageCount: 142,
    requiredPaymentMethod: 'ALL',
    description: 'Giảm 10% cho đơn hàng từ 100.000đ',
    status: 'ACTIVE',
    createdAt: '2026-08-01T00:00:00.000Z'
  },
  {
    id: 'v2',
    code: 'TQ50K',
    discountType: 'FIXED',
    discountValue: 50000,
    minOrderValue: 300000,
    usageLimit: 500,
    usageCount: 88,
    requiredPaymentMethod: 'WALLET',
    description: 'Giảm 50.000đ khi thanh toán qua Ví TQ Pay cho đơn từ 300.000đ',
    status: 'ACTIVE',
    createdAt: '2026-08-05T00:00:00.000Z'
  },
  {
    id: 'v3',
    code: 'FREESHIP',
    discountType: 'FIXED',
    discountValue: 30000,
    minOrderValue: 150000,
    usageLimit: 300,
    usageCount: 52,
    requiredPaymentMethod: 'ALL',
    description: 'Giảm 30.000đ phí vận chuyển cho đơn từ 150.000đ',
    status: 'ACTIVE',
    createdAt: '2026-08-10T00:00:00.000Z'
  }
];

export const getSystemVouchers = () => {
  try {
    const saved = localStorage.getItem(VOUCHERS_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    console.error('getSystemVouchers error:', e);
  }
  return DEFAULT_VOUCHERS;
};

export const fetchCloudVouchers = async () => {
  try {
    const { data, error } = await supabase
      .from('tq_platform_config')
      .select('vouchers_list')
      .limit(1)
      .single();

    if (!error && data?.vouchers_list && Array.isArray(data.vouchers_list)) {
      localStorage.setItem(VOUCHERS_KEY, JSON.stringify(data.vouchers_list));
      return data.vouchers_list;
    }
  } catch (err) {
    console.warn('Supabase Cloud Vouchers Notice:', err?.message);
  }
  return getSystemVouchers();
};

export const saveSystemVouchers = async (vouchersList) => {
  localStorage.setItem(VOUCHERS_KEY, JSON.stringify(vouchersList));
  try {
    await supabase
      .from('tq_platform_config')
      .upsert({ id: 1, vouchers_list: vouchersList, updated_at: new Date().toISOString() });
  } catch (err) {
    console.warn('Cloud Vouchers save notice:', err?.message);
  }
  return vouchersList;
};

export const validateAndApplyVoucher = (code, subtotal, paymentMethod) => {
  if (!code || !code.trim()) {
    throw new Error('Vui lòng nhập mã giảm giá.');
  }

  const cleanCode = code.trim().toUpperCase();
  const vouchers = getSystemVouchers();
  const found = vouchers.find(v => v.code.toUpperCase() === cleanCode);

  if (!found) {
    throw new Error('Mã giảm giá không tồn tại trên hệ thống.');
  }

  if (found.status !== 'ACTIVE') {
    throw new Error('Mã giảm giá này đã tạm ngưng hoặc hết hạn.');
  }

  if (found.usageCount >= found.usageLimit) {
    throw new Error(`Mã giảm giá này đã hết lượt sử dụng (${found.usageCount}/${found.usageLimit} lượt).`);
  }

  if (subtotal < found.minOrderValue) {
    throw new Error(`Đơn hàng chưa đạt giá trị tối thiểu ${found.minOrderValue.toLocaleString('vi-VN')}đ để áp dụng mã này.`);
  }

  if (found.requiredPaymentMethod === 'WALLET' && paymentMethod !== 'wallet') {
    throw new Error('❌ Mã giảm giá này chỉ áp dụng khi chọn PTTT Ví TQ Pay!');
  }

  if (found.requiredPaymentMethod === 'COD' && paymentMethod !== 'cash') {
    throw new Error('❌ Mã giảm giá này chỉ áp dụng khi chọn PTTT Tiền mặt (COD)!');
  }

  let discountAmount = 0;
  if (found.discountType === 'PERCENT') {
    discountAmount = Math.round(subtotal * (found.discountValue / 100));
  } else {
    discountAmount = Math.min(subtotal, found.discountValue);
  }

  return {
    voucher: found,
    discountAmount,
    displayText: found.discountType === 'PERCENT' ? `Giảm ${found.discountValue}%` : `Giảm -${found.discountValue.toLocaleString('vi-VN')}đ`
  };
};

export const incrementVoucherUsage = async (code) => {
  if (!code) return;
  const cleanCode = code.trim().toUpperCase();
  const vouchers = getSystemVouchers();
  const updated = vouchers.map(v => {
    if (v.code.toUpperCase() === cleanCode) {
      return { ...v, usageCount: (v.usageCount || 0) + 1 };
    }
    return v;
  });
  await saveSystemVouchers(updated);
};
