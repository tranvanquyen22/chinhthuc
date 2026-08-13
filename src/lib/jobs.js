// Việc Làm TQ - Job Listings & Recruitment Data Engine

import { supabase } from './supabase';

const JOBS_STORAGE_KEY = 'tq_job_listings_storage';

export const DEFAULT_JOBS = [
  {
    id: 101,
    title: '🚗 Tài Xế Taxi TQ & Giao Hàng Công Nghệ',
    company: 'TQ TAXI SERVICES',
    category: 'TAXI_DRIVER',
    salary: '15.000.000đ - 25.000.000đ / tháng',
    location: 'TP. HỒ CHÍ MINH & HÀ NỘI',
    type: 'Toàn thời gian / Tự do',
    phone: '0901234567',
    description: 'Chạy xe máy hoặc xe 4/7 chỗ theo thời gian rảnh. Thu nhập nhận hàng ngày, 0% phí sàn phụ thu.',
    requirements: 'Có bằng lái xe hợp lệ, xe máy hoặc ô tô cá nhân, thái độ lịch sự.',
    created_at: new Date().toISOString()
  },
  {
    id: 102,
    title: '👗 Quản Lý Gian Hàng & Tư Vấn Trang Phục Cưới',
    company: 'TQ RENTAL BOUTIQUE',
    category: 'RETAIL_SALES',
    salary: '9.000.000đ - 14.000.000đ / tháng',
    location: 'TP. HỒ CHÍ MINH (QUẬN 1)',
    type: 'Toàn thời gian',
    phone: '0988776655',
    description: 'Tư vấn thử váy cưới, trang phục dạ hội cho khách hàng, quản lý đơn thuê đồ và hàng tồn kho.',
    requirements: 'Giao tiếp tốt, yêu thích thời trang, có kinh nghiệm bán hàng là một lợi thế.',
    created_at: new Date().toISOString()
  },
  {
    id: 103,
    title: '🧋 Thu Ngân & Pha Chế Trà Sữa F&B',
    company: 'TQ TEA & COFFEE',
    category: 'FNB',
    salary: '35.000đ - 45.000đ / giờ',
    location: 'ĐÀ NẴNG & TP. HỒ CHÍ MINH',
    type: 'Bán thời gian / Xoay ca',
    phone: '0911223344',
    description: 'Pha chế trà nướng, chuẩn bị topping, tính tiền thu ngân và giữ vệ sinh khu vực quầy.',
    requirements: 'Nhanh nhẹn, trung thực, ưu tiên sinh viên cần tìm việc xoay ca linh hoạt.',
    created_at: new Date().toISOString()
  },
  {
    id: 104,
    title: '💄 Chuyên Viên Trang Điểm & Kỹ Thuật Viên Spa',
    company: 'TQ BEAUTY SPA',
    category: 'BEAUTY_SPA',
    salary: '12.000.000đ - 20.000.000đ / tháng',
    location: 'HÀ NỘI & TP. HỒ CHÍ MINH',
    type: 'Toàn thời gian',
    phone: '0933445566',
    description: 'Thực hiện liệu trình chăm sóc da mặt, trang điểm cô dâu và làm tóc theo yêu cầu khách.',
    requirements: 'Có chứng chỉ spa/makeup hoặc kinh nghiệm làm việc 1 năm trở lên.',
    created_at: new Date().toISOString()
  }
];

export const getJobListings = () => {
  try {
    const saved = localStorage.getItem(JOBS_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) {
    console.error('getJobListings error:', e);
  }
  return DEFAULT_JOBS;
};

export const createJobListing = async (newJob) => {
  const jobObj = {
    id: Date.now(),
    title: newJob.title,
    company: newJob.company || 'Gian Hàng TQ Store',
    category: newJob.category || 'OTHER',
    salary: newJob.salary,
    location: newJob.location,
    type: newJob.type || 'Toàn thời gian',
    phone: newJob.phone,
    description: newJob.description,
    requirements: newJob.requirements || 'Nhanh nhẹn, có trách nhiệm trong công việc.',
    created_at: new Date().toISOString()
  };

  const existing = getJobListings();
  const updated = [jobObj, ...existing];
  localStorage.setItem(JOBS_STORAGE_KEY, JSON.stringify(updated));

  // Tải lên Supabase Cloud nếu khả dụng
  try {
    await supabase.from('tq_job_listings').insert([jobObj]);
  } catch (e) {
    console.warn('createJobListing cloud sync notice:', e?.message);
  }

  return jobObj;
};
