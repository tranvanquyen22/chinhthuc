import { z } from 'zod';

// =========================================================================
// 1. STRICT REGEX FORMAT VALIDATORS (GMAIL & SỐ ĐIỆN THOẠI VIỆT NAM)
// =========================================================================

// Validate Gmail / Email Format
export const isValidEmail = (email) => {
  if (!email || typeof email !== 'string') return false;
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return emailRegex.test(email.trim());
};

// Validate Vietnamese Phone Number Format (10 chữ số bắt đầu bằng 03, 05, 07, 08, 09)
export const isValidVNPhone = (phone) => {
  if (!phone || typeof phone !== 'string') return false;
  const cleanPhone = phone.trim().replace(/\s+/g, '');
  const vnPhoneRegex = /^(0|84|\+84)(3|5|7|8|9)[0-9]{8}$/;
  return vnPhoneRegex.test(cleanPhone);
};

// XSS Sanitizer Utility
export const sanitizeText = (str) => {
  if (typeof str !== 'string') return str;
  
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;')
    .replace(/javascript:/gi, '')
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
};

// =========================================================================
// 2. ZOD VALIDATION SCHEMAS (XÁC THỰC ĐỊNH DẠNG DỮ LIỆU ĐẦU VÀO)
// =========================================================================

// A. Xác thực Đăng nhập (Cho phép Email hoặc Số điện thoại)
export const loginSchema = z.object({
  identifier: z.string().min(3, 'Vui lòng nhập Email / Gmail hoặc Số điện thoại hợp lệ.'),
  password: z.string().min(6, 'Mật khẩu phải có ít nhất 6 ký tự.')
});

// B. Xác thực Đăng ký
export const registerSchema = z.object({
  name: z.string().min(2, 'Họ tên phải có ít nhất 2 ký tự.').max(100, 'Họ tên tối đa 100 ký tự.'),
  phone: z.string().min(9, 'Số điện thoại bắt buộc, tối thiểu 9 chữ số.').max(15, 'Số điện thoại không hợp lệ.'),
  email: z.string().email('Địa chỉ Email / Gmail bắt buộc, không đúng định dạng.'),
  password: z.string().min(6, 'Mật khẩu phải có ít nhất 6 ký tự.')
});

// C. Xác thực Thêm sản phẩm mới
export const addProductSchema = z.object({
  title: z.string().min(3, 'Tên sản phẩm phải có ít nhất 3 ký tự.').max(200, 'Tên sản phẩm quá dài.'),
  price: z.number().min(1000, 'Giá sản phẩm tối thiểu là 1.000 VNĐ.'),
  shop_type: z.enum(['RETAIL', 'RENTAL', 'FNB', 'BEAUTY']),
  details: z.string().max(1000, 'Mô tả tối đa 1000 ký tự.').optional(),
  stock: z.number().min(1, 'Số lượng tồn kho tối thiểu là 1.')
});

// D. Xác thực Đặt hàng & Giao hàng
export const checkoutSchema = z.object({
  shipping_address: z.string().min(5, 'Địa chỉ giao hàng phải chi tiết hơn (ít nhất 5 ký tự).').max(300),
  payment_method: z.enum(['wallet', 'cash', 'transfer'])
});

// E. Xác thực Tin nhắn Live Chat
export const chatMessageSchema = z.object({
  content: z.string().min(1, 'Nội dung tin nhắn không được để trống.').max(1000, 'Tin nhắn quá dài (tối đa 1000 ký tự).')
});

// Remove Vietnamese diacritics / accents for exact name matching comparison
export const removeVNAccents = (str) => {
  if (!str || typeof str !== 'string') return '';
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .trim()
    .toUpperCase();
};

export const isNameMatching = (name1, name2) => {
  const clean1 = removeVNAccents(name1);
  const clean2 = removeVNAccents(name2);
  if (!clean1 || !clean2) return false;
  return clean1 === clean2;
};
