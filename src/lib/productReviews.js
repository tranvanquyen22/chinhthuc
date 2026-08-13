// Helper module for managing product sales counts & AI synthetic virtual reviews

import { supabase } from './supabase';

const PRODUCT_REVIEWS_KEY = 'tq_product_reviews_store';

// AI Realistic Vietnamese Name Generator
const FIRST_NAMES = ['Nguyễn', 'Trần', 'Lê', 'Phạm', 'Hoàng', 'Huỳnh', 'Phan', 'Vũ', 'Võ', 'Đặng', 'Bùi', 'Đỗ', 'Hồ', 'Ngo', 'Dương', 'Lý'];
const MIDDLE_NAMES = ['Văn', 'Thị', 'Hoàng', 'Minh', 'Đức', 'Thu', 'Ngọc', 'Gia', 'Phuơng', 'Thanh', 'Hải', 'Quang', 'Anh', 'Khánh'];
const LAST_NAMES = ['Anh', 'Tuấn', 'Hùng', 'Linh', 'Trang', 'Hương', 'Hà', 'Nam', 'Kiên', 'Long', 'Dũng', 'Phương', 'Thảo', 'Nhung', 'Yến', 'Quân', 'Bảo', 'Vy', 'Nhi', 'Đạt'];

export const generateRandomVietnameseName = () => {
  const f = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)];
  const m = MIDDLE_NAMES[Math.floor(Math.random() * MIDDLE_NAMES.length)];
  const l = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)];
  return `${f} ${m} ${l}`;
};

// AI Realistic Review Text Presets according to category
export const AI_REVIEW_PRESETS = [
  "Sản phẩm giao cực nhanh, đóng gói đẹp cẩn thận. Chất lượng trên cả tuyệt vời so với tầm giá!",
  "Đã nhận hàng, vải mềm mịn form chuẩn đẹp đúng mô tả. Đóng gói 5 sao sẽ ủng hộ shop dài dài!",
  "Giao hàng hoả tốc, shop tư vấn siêu nhiệt tình dễ thương. Hàng chính hãng chất lượng 10/10!",
  "Mua lần thứ 3 tại shop rồi vẫn cực kỳ hài lòng. Sản phẩm nét căng, dùng rất êm thích lắm!",
  "Rất đáng tiền nhé mọi người, săn sale giá hời chất lượng vượt mong đợi. Cho shop 5 sao nhen!",
  "Hàng đẹp y như hình chụp, chất liệu xịn sò giao đúng mẫu đúng size. Cảm ơn shop nhiều!",
  "Trải nghiệm tuyệt vời, nhân viên giao hàng lịch sự chu đáo. Đánh giá 5 sao uy tín!",
  "Đồ ăn / nước uống ngon đậm đà, giao còn nóng hổi. Đóng gói rất sạch sẽ và chu đáo!"
];

export const getRandomAiReview = () => {
  return AI_REVIEW_PRESETS[Math.floor(Math.random() * AI_REVIEW_PRESETS.length)];
};

// Local storage for injected synthetic reviews by product ID
export const getStoredProductReviews = (productId) => {
  try {
    const saved = localStorage.getItem(PRODUCT_REVIEWS_KEY);
    if (saved) {
      const store = JSON.parse(saved);
      return store[productId] || [];
    }
  } catch (e) {
    console.error('getStoredProductReviews error:', e);
  }
  return [];
};

export const saveSyntheticReview = async (productId, reviewData) => {
  const newReview = {
    id: 'rev_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
    product_id: productId,
    user_name: reviewData.userName || generateRandomVietnameseName(),
    user_avatar: reviewData.avatar || `https://i.pravatar.cc/100?u=${encodeURIComponent(reviewData.userName || 'user')}`,
    rating: Number(reviewData.rating || 5),
    comment: reviewData.comment || getRandomAiReview(),
    is_synthetic: true,
    created_at: reviewData.createdAt || new Date().toISOString()
  };

  try {
    const saved = localStorage.getItem(PRODUCT_REVIEWS_KEY);
    const store = saved ? JSON.parse(saved) : {};
    const existing = store[productId] || [];
    const updated = [newReview, ...existing];
    store[productId] = updated;
    localStorage.setItem(PRODUCT_REVIEWS_KEY, JSON.stringify(store));
  } catch (e) {
    console.error('saveSyntheticReview localStorage error:', e);
  }

  // Also sync to Supabase Cloud DB `reviews` table if available
  try {
    await supabase.from('reviews').insert([{
      product_id: productId,
      user_name: newReview.user_name,
      rating: newReview.rating,
      comment: newReview.comment,
      created_at: newReview.created_at
    }]);
  } catch (err) {
    console.warn('Supabase reviews insert notice:', err?.message);
  }

  return newReview;
};

// Direct update for Product Sales Count
export const updateProductSalesCountCloud = async (productId, newSalesCount) => {
  const cleanCount = Math.max(0, parseInt(newSalesCount) || 0);

  try {
    const { error } = await supabase
      .from('products')
      .update({ sales_count: cleanCount })
      .eq('id', productId);

    if (error) {
      console.warn('Supabase products sales_count update notice:', error.message);
    }
  } catch (err) {
    console.warn('Cloud sales count update notice:', err?.message);
  }

  return cleanCount;
};
