import { createClient } from '@supabase/supabase-js';

// Đọc biến môi trường từ Vite (.env hoặc Vercel Environment Variables)
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'placeholder-anon-key';

if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY) {
  console.warn(
    '[THÔNG BÁO VERCEL] Chưa cấu hình VITE_SUPABASE_URL hoặc VITE_SUPABASE_ANON_KEY trên Vercel Environment Variables. Ứng dụng sẽ sử dụng chế độ offline/local storage fallback cho tới khi bạn thêm biến môi trường trên Vercel Dashboard.'
  );
}

// Khởi tạo Supabase Client
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
