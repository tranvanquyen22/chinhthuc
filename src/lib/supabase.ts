import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Đọc biến môi trường từ Vite (.env hoặc Vercel Environment Variables)
const rawUrl = import.meta.env.VITE_SUPABASE_URL;
const rawAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(
  rawUrl && 
  rawAnonKey && 
  rawUrl !== 'https://placeholder.supabase.co' && 
  !rawUrl.includes('placeholder')
);

const supabaseUrl = isSupabaseConfigured ? rawUrl : 'https://ecbaoadsoepqlzxzsehu.supabase.co';
const supabaseAnonKey = isSupabaseConfigured ? rawAnonKey : 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVjYmFvYWRzb2VwcWx6eHpzZWh1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY1Nzk5MzAsImV4cCI6MjEwMjE1NTkzMH0.lPtLWnJfbxkqUia-fZTO1TMdGEy4cSnsAhwjfVWwNtM';

if (!isSupabaseConfigured) {
  console.warn(
    '⚠️ [SUPABASE AUTO-FALLBACK]: Chưa phát hiện VITE_SUPABASE_URL hoặc VITE_SUPABASE_ANON_KEY trên Vercel. Đã tự động kích hoạt Cloud Credentials dự phòng!'
  );
}

// Khởi tạo Supabase Client an toàn tuyệt đối
export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
});
