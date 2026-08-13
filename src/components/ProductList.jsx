import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import FlashSaleSection from './FlashSaleSection';
import LocationFilterBar from './LocationFilterBar';
import { getFeaturedPromotions } from '../lib/featuredPromotions';

const DEFAULT_PRODUCTS = [
  {
    id: 1,
    title: 'Áo Sơ Mi Nam TQ Smart Oxford',
    price: 259000,
    shop_type: 'RETAIL',
    shop_name: 'TQ RETAIL SHOP',
    location: 'TP. HỒ CHÍ MINH',
    image_url: 'https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?auto=format&fit=crop&w=400&q=80',
    badge: '🛍️ Bán 259k',
    details: 'Chất vải Oxford cotton thoáng mát, chống nhăn',
    stock: 50,
    sales_count: 42,
    rating: 5.0
  },
  {
    id: 2,
    title: 'Váy Cưới Dạ Hội Đỏ Sang Trọng',
    price: 200000,
    shop_type: 'RENTAL',
    shop_name: 'TQ RENTAL STUDIO',
    location: 'HÀ NỘI',
    image_url: 'https://images.unsplash.com/photo-1594552072238-b8a33785b261?auto=format&fit=crop&w=400&q=80',
    badge: '👗 Thuê 200k/ngày',
    details: 'Size S/M/L | Cọc 500.000đ đi kèm đai nơ',
    stock: 10,
    sales_count: 28,
    rating: 4.9
  },
  {
    id: 3,
    title: 'Trà Sữa Nướng Trân Châu Hoàng Gia',
    price: 35000,
    shop_type: 'FNB',
    shop_name: 'TQ TEA & COFFEE',
    location: 'ĐÀ NẴNG',
    image_url: 'https://images.unsplash.com/photo-1558857563-b371033873b8?auto=format&fit=crop&w=400&q=80',
    badge: '🧋 F&B 35k',
    details: 'Chuẩn bị 10 phút | Topping trân châu đen đầy đặn',
    stock: 100,
    sales_count: 156,
    rating: 5.0
  },
  {
    id: 4,
    title: 'Liệu Trình Spa Chăm Sóc Da Mặt 60Phút',
    price: 290000,
    shop_type: 'BEAUTY',
    shop_name: 'TQ BEAUTY SPA',
    location: 'TP. HỒ CHÍ MINH',
    image_url: 'https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?auto=format&fit=crop&w=400&q=80',
    badge: '💄 Spa 60 phút',
    details: 'Cấp ẩm chuyên sâu & Thải độc da',
    stock: 30,
    sales_count: 85,
    rating: 4.2
  },
  {
    id: 5,
    title: 'Váy Dạ Hội Ánh Kim Lấp Lánh',
    price: 350000,
    shop_type: 'RENTAL',
    shop_name: 'TQ RENTAL STUDIO',
    location: 'TP. HỒ CHÍ MINH',
    image_url: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=400&q=80',
    badge: '👗 Thuê 350k/ngày',
    details: 'Size M | Kèm trang sức & túi xách cầm tay',
    stock: 5,
    sales_count: 19,
    rating: 5.0
  },
  {
    id: 6,
    title: 'Cơm Trưa Văn Phòng TQ Bento Sườn Nướng',
    price: 45000,
    shop_type: 'FNB',
    shop_name: 'TQ FAST FOOD',
    location: 'TP. HỒ CHÍ MINH',
    image_url: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=400&q=80',
    badge: '🧋 F&B 45k',
    details: 'Gồm sườn nướng, trứng chiên & canh nóng',
    stock: 80,
    sales_count: 210,
    rating: 4.5
  }
];

export default function ProductList({
  activeCategory,
  setActiveCategory,
  searchQuery,
  searchCategory,
  activeShopFilter,
  onClearShopFilter,
  onAddToCart,
  onOpenChat,
  refreshTrigger
}) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isFromSupabase, setIsFromSupabase] = useState(false);

  // Sorting, Location & Price Filter state
  const [sortTab, setSortTab] = useState('relevance');
  const [minPriceInput, setMinPriceInput] = useState('');
  const [maxPriceInput, setMaxPriceInput] = useState('');
  const [priceFilter, setPriceFilter] = useState({ min: 0, max: Infinity });

  // Location & Customer Rating Filters
  const [selectedCity, setSelectedCity] = useState('ALL');
  const [selectedDistrict, setSelectedDistrict] = useState('ALL');
  const [ratingFilter, setRatingFilter] = useState(0); // 0: All, 5: 5 Stars, 4: 4 Stars and above

  useEffect(() => {
    fetchProducts();
  }, [refreshTrigger]);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('id', { ascending: false });

      if (error || !data || data.length === 0) {
        setProducts(DEFAULT_PRODUCTS);
        setIsFromSupabase(false);
      } else {
        setProducts(data);
        setIsFromSupabase(true);
      }
    } catch (err) {
      console.error('Error fetching products from Supabase:', err);
      setProducts(DEFAULT_PRODUCTS);
      setIsFromSupabase(false);
    } finally {
      setLoading(false);
    }
  };

  const handleApplyPriceFilter = () => {
    const min = minPriceInput ? Number(minPriceInput) : 0;
    const max = maxPriceInput ? Number(maxPriceInput) : Infinity;
    setPriceFilter({ min, max });
  };

  // Filter & Sort Logic
  const filteredProducts = products.filter((p) => {
    const shopType = (p.shop_type || p.shopType || '').toUpperCase();
    const title = (p.title || p.name || '').toLowerCase();
    const details = (p.details || '').toLowerCase();
    const price = Number(p.price || 0);
    const location = (p.location || 'TP. HỒ CHÍ MINH').toUpperCase();
    const rating = Number(p.rating || 5.0);

    // Active Direct Shop Link Filter (?shop=slug)
    if (activeShopFilter) {
      const slug = activeShopFilter.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      const pShopName = (p.shop_name || p.shop_slug || p.user_email || p.title || '').toLowerCase().replace(/[^a-z0-9]+/g, '-');
      if (!pShopName.includes(slug) && !slug.includes(pShopName)) {
        return false;
      }
    }

    // Active Category Filter
    if (activeCategory !== 'ALL' && shopType !== activeCategory) {
      return false;
    }

    // Search Category Dropdown Filter
    if (searchCategory !== 'ALL' && shopType !== searchCategory) {
      return false;
    }

    // City Location Filter
    if (selectedCity !== 'ALL' && !location.includes(selectedCity.toUpperCase())) {
      return false;
    }

    // Rating Filter
    if (ratingFilter === 5 && rating < 5.0) {
      return false;
    }
    if (ratingFilter === 4 && rating < 4.0) {
      return false;
    }

    // Search Text Query
    if (searchQuery.trim() !== '') {
      const q = searchQuery.trim().toLowerCase();
      if (!title.includes(q) && !details.includes(q)) {
        return false;
      }
    }

    // Price Filter
    if (price < priceFilter.min || price > priceFilter.max) {
      return false;
    }

    return true;
  });

  // Apply Sorting
  const sortedProducts = [...filteredProducts].sort((a, b) => {
    if (sortTab === 'latest') {
      return b.id - a.id;
    } else if (sortTab === 'bestseller') {
      return (b.sales_count || b.salesCount || 0) - (a.sales_count || a.salesCount || 0);
    }
    return 0; // relevance
  });

  return (
    <div className="space-y-8 font-sans">
      
      {/* ================= 1. KHU VỰC FLASH SALE CAROUSEL (Ẩn khi truy cập link shop riêng) ================= */}
      {!activeShopFilter && (
        <FlashSaleSection 
          products={products}
          onAddToCart={onAddToCart}
          onOpenChat={onOpenChat}
        />
      )}

      {/* ================= 2. KHU VỰC LỌC THEO VỊ TRÍ ĐỊA LÝ (Ẩn khi truy cập link shop riêng) ================= */}
      {!activeShopFilter && (
        <LocationFilterBar 
          selectedCity={selectedCity}
          setSelectedCity={setSelectedCity}
          selectedDistrict={selectedDistrict}
          setSelectedDistrict={setSelectedDistrict}
        />
      )}

      {/* ================= 3. HEADER GỢI Ý HÔM NAY & THANH SẮP XẾP ================= */}
      <div className="space-y-4">
        
        {/* Section Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-200 pb-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-black text-navy uppercase tracking-wide">
                {activeShopFilter ? `DANH SÁCH SẢN PHẨM GIAN HÀNG (${sortedProducts.length})` : 'GỢI Ý HÔM NAY - TẤT CẢ GIAN HÀNG & SẢN PHẨM'}
              </h2>
              {isFromSupabase && (
                <span className="text-[9px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping"></span>
                  Live DB
                </span>
              )}
            </div>
            <p className="text-xs text-gray-500 font-medium mt-0.5">
              {activeShopFilter ? `Các mặt hàng thuộc gian hàng chính hãng` : 'Sản phẩm chính hãng, dịch vụ uy tín được tuyển chọn hàng ngày'}
            </p>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-center">
            <button 
              onClick={fetchProducts}
              className="text-xs text-gray-600 hover:text-navy font-semibold px-2.5 py-1 border border-gray-300 rounded-lg bg-white hover:bg-gray-50 cursor-pointer shadow-2xs"
            >
              <i className="fa-solid fa-rotate-right mr-1"></i>Làm mới
            </button>
            <span className="text-xs font-bold bg-navy/10 text-navy px-3 py-1 rounded-full">
              Hiển thị: {sortedProducts.length} mặt hàng
            </span>
          </div>
        </div>

        {/* Thanh Sắp Xếp (Sorting Bar - Ẩn khi xem link shop riêng) */}
        {!activeShopFilter && (
          <div className="bg-gray-100 p-3 rounded-xl border border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="font-bold text-gray-700">Sắp xếp theo:</span>
              
              {/* Tab Liên Quan (Pill shape viền/nền đỏ) */}
              <button 
                onClick={() => setSortTab('relevance')}
                className={`px-4 py-1.5 rounded-full font-bold transition-all cursor-pointer ${
                  sortTab === 'relevance'
                    ? 'bg-red-600 text-white shadow-sm ring-2 ring-red-400/30'
                    : 'bg-white text-gray-700 hover:bg-gray-200 border border-gray-300'
                }`}
              >
                Liên Quan
              </button>

              {/* Tab Mới Nhất */}
              <button 
                onClick={() => setSortTab('latest')}
                className={`px-4 py-1.5 rounded-full font-bold transition-all cursor-pointer ${
                  sortTab === 'latest'
                    ? 'bg-red-600 text-white shadow-sm ring-2 ring-red-400/30'
                    : 'bg-white text-gray-700 hover:bg-gray-200 border border-gray-300'
                }`}
              >
                Mới Nhất
              </button>

              {/* Tab Bán Chạy */}
              <button 
                onClick={() => setSortTab('bestseller')}
                className={`px-4 py-1.5 rounded-full font-bold transition-all cursor-pointer ${
                  sortTab === 'bestseller'
                    ? 'bg-red-600 text-white shadow-sm ring-2 ring-red-400/30'
                    : 'bg-white text-gray-700 hover:bg-gray-200 border border-gray-300'
                }`}
              >
                Bán Chạy
              </button>
            </div>

            <div className="flex items-center gap-2 text-gray-500 font-semibold self-end sm:self-center">
              <span>Trang <strong className="text-navy font-bold">1/1</strong></span>
              <div className="flex gap-1">
                <button disabled className="w-6 h-6 border rounded bg-white text-gray-300 cursor-not-allowed flex items-center justify-center">‹</button>
                <button disabled className="w-6 h-6 border rounded bg-white text-gray-300 cursor-not-allowed flex items-center justify-center">›</button>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* ================= 4. BỐ CỤC MAIN (ẨN SIDEBAR LỌC KHI XEM LINK SHOP RIÊNG) ================= */}
      <div className={`grid grid-cols-1 ${activeShopFilter ? '' : 'lg:grid-cols-4'} gap-6 items-start`}>
        
        {/* ================= CỘT BÊN TRÁI: BỘ LỌC TÌM KIẾM (Ẩn khi xem link shop riêng) ================= */}
        {!activeShopFilter && (
          <aside className="bg-white p-4 sm:p-5 rounded-2xl border border-gray-200/80 shadow-xs space-y-6 lg:sticky lg:top-24">
            
            {/* Header Sidebar Filter */}
            <div className="flex items-center gap-2 border-b border-gray-200 pb-3">
              <i className="fa-solid fa-filter text-red-600 text-sm"></i>
              <h3 className="font-black text-navy text-xs uppercase tracking-wider">
                BỘ LỌC TÌM KIẾM
              </h3>
            </div>

            {/* Danh mục (Categories List) */}
            <div className="space-y-2">
              <h4 className="font-extrabold text-navy text-xs uppercase tracking-wider mb-2">
                Danh Mục Sản Phẩm
              </h4>

              <div className="space-y-1 text-xs">
                {[
                  { id: 'ALL', label: 'Tất cả sản phẩm', icon: '🌐' },
                  { id: 'RENTAL', label: 'Cho Thuê Đồ', icon: '👗' },
                  { id: 'RETAIL', label: 'Shop Bán Đồ', icon: '🛍️' },
                  { id: 'FNB', label: 'Đồ Ăn & Uống', icon: '🧋' },
                  { id: 'BEAUTY', label: 'Làm Đẹp & Spa', icon: '💄' }
                ].map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setActiveCategory(cat.id)}
                    className={`w-full text-left px-3 py-2 rounded-xl font-bold flex items-center gap-2 transition-all cursor-pointer ${
                      activeCategory === cat.id
                        ? 'bg-red-50 text-red-600 border border-red-200'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <span>{cat.icon}</span>
                    <span className="flex-1">{cat.label}</span>
                    {activeCategory === cat.id && <i className="fa-solid fa-check text-xs text-red-600"></i>}
                  </button>
                ))}
              </div>
            </div>

            {/* ĐÁNH GIÁ CỦA KHÁCH */}
            <div className="border-t border-gray-200 pt-4 space-y-2.5">
              <h4 className="font-extrabold text-navy text-xs uppercase tracking-wider">
                ĐÁNH GIÁ CỦA KHÁCH
              </h4>

              <div className="space-y-1.5 text-xs">
                <label className="flex items-center gap-2 cursor-pointer p-1.5 rounded-lg hover:bg-gray-50">
                  <input 
                    type="radio" 
                    name="ratingFilter" 
                    checked={ratingFilter === 0} 
                    onChange={() => setRatingFilter(0)}
                    className="text-red-600"
                  />
                  <span className="font-semibold text-gray-700">Tất cả mức đánh giá</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer p-1.5 rounded-lg hover:bg-gray-50">
                  <input 
                    type="radio" 
                    name="ratingFilter" 
                    checked={ratingFilter === 5} 
                    onChange={() => setRatingFilter(5)}
                    className="text-red-600"
                  />
                  <div className="flex items-center gap-1">
                    <span className="text-amber-400 font-bold">★★★★★</span>
                    <span className="font-bold text-navy">5 Sao</span>
                  </div>
                </label>

                <label className="flex items-center gap-2 cursor-pointer p-1.5 rounded-lg hover:bg-gray-50">
                  <input 
                    type="radio" 
                    name="ratingFilter" 
                    checked={ratingFilter === 4} 
                    onChange={() => setRatingFilter(4)}
                    className="text-red-600"
                  />
                  <div className="flex items-center gap-1">
                    <span className="text-amber-400 font-bold">★★★★☆</span>
                    <span className="font-semibold text-gray-700">Từ 4 Sao trở lên</span>
                  </div>
                </label>
              </div>
            </div>

          {/* Khoảng Giá Filter (Price Range Filter) */}
          <div className="border-t border-gray-200 pt-4 space-y-3">
            <h4 className="font-extrabold text-navy text-xs uppercase tracking-wider">
              KHOẢNG GIÁ (VNĐ)
            </h4>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <label className="text-[10px] font-bold text-gray-500 block mb-1">Từ (đ):</label>
                <input 
                  type="number" 
                  value={minPriceInput}
                  onChange={(e) => setMinPriceInput(e.target.value)}
                  placeholder="0" 
                  className="w-full bg-gray-50 border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs font-semibold focus:outline-none focus:border-red-600"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-gray-500 block mb-1">Đến (đ):</label>
                <input 
                  type="number" 
                  value={maxPriceInput}
                  onChange={(e) => setMaxPriceInput(e.target.value)}
                  placeholder="500000" 
                  className="w-full bg-gray-50 border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs font-semibold focus:outline-none focus:border-red-600"
                />
              </div>
            </div>

            <button 
              onClick={handleApplyPriceFilter}
              className="w-full bg-red-600 hover:bg-red-700 text-white font-black py-2 rounded-lg text-xs uppercase tracking-wider transition-colors shadow-sm cursor-pointer"
            >
              ÁP DỤNG KHOẢNG GIÁ
            </button>
          </div>

        </aside>
        )}

        {/* ================= CỘT BÊN PHẢI: LƯỚI SẢN PHẨM & THẺ CHI TIẾT (MAIN GRID 3/4 KHÔNG BỘ LỌC) ================= */}
        <div className={activeShopFilter ? 'w-full' : 'lg:col-span-3'}>
          
          {loading ? (
            <div className="py-16 text-center space-y-2 bg-white rounded-2xl border border-gray-200">
              <i className="fa-solid fa-spinner fa-spin text-3xl text-navy"></i>
              <p className="text-xs text-gray-500 font-bold">Đang tải danh sách sản phẩm từ CSDL Supabase...</p>
            </div>
          ) : sortedProducts.length > 0 ? (
            <div className={`grid grid-cols-2 ${activeShopFilter ? 'sm:grid-cols-3 md:grid-cols-4' : 'sm:grid-cols-3'} gap-4`}>
              {sortedProducts.map((p) => {
                const title = p.title || p.name || 'Sản phẩm TQ Store';
                const price = Number(p.price || 0);
                const shopType = p.shop_type || p.shopType || 'RETAIL';
                const shopName = p.shop_name || p.shopName || p.shop || 'TQ STORE';
                const location = p.location || 'TP. HỒ CHÍ MINH';
                const image = p.image_url || p.img || p.image || 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=400&q=80';
                const badge = p.badge || (shopType === 'RENTAL' ? '👗 Thuê Đồ' : shopType === 'FNB' ? '🧋 F&B' : shopType === 'BEAUTY' ? '💄 Spa' : '🛍️ Bán Đồ');
                const details = p.details || 'Chất liệu cao cấp, bảo hành chính hãng';
                const salesCount = p.sales_count || p.salesCount || 15;
                const rating = p.rating || 5.0;

                const featuredPromos = getFeaturedPromotions();
                const isFeaturedProduct = (featuredPromos.productIds || []).includes(p.id);

                return (
                  <div 
                    key={p.id}
                    className={`bg-white rounded-2xl p-3 border shadow-xs flex flex-col justify-between product-card relative group transition-all ${
                      isFeaturedProduct 
                        ? 'border-2 border-amber-400 shadow-md ring-2 ring-amber-300/30' 
                        : 'border-gray-200/80 hover:border-navy/40'
                    }`}
                  >
                    {/* Badge giá/ưu đãi nhỏ đè trên góc ảnh */}
                    <div className="absolute top-4 left-4 flex flex-col gap-1 z-10">
                      <span className="bg-navy text-amber-300 text-[9px] font-black px-2.5 py-0.5 rounded-full shadow-md uppercase">
                        {badge}
                      </span>
                      {isFeaturedProduct && (
                        <span className="bg-gradient-to-r from-amber-500 to-orange-500 text-white text-[9px] font-black px-2 py-0.5 rounded-full shadow-md uppercase flex items-center gap-1 animate-pulse">
                          <i className="fa-solid fa-star text-amber-200"></i>
                          <span>HOT ĐỀ XUẤT</span>
                        </span>
                      )}
                    </div>

                    <div className="space-y-2">
                      {/* Product Thumbnail */}
                      <div className="bg-gray-50 rounded-xl overflow-hidden h-40 flex items-center justify-center relative border border-gray-100">
                        <img 
                          src={image} 
                          alt={title} 
                          className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      </div>

                      {/* Label Tên Shop / Khu Vực */}
                      <div className="flex items-center justify-between text-[9px] font-bold text-gray-400 uppercase tracking-tight">
                        <span className="text-navy font-extrabold truncate max-w-[110px]">{shopName}</span>
                        <span className="text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded">{location}</span>
                      </div>

                      {/* Tên Sản Phẩm */}
                      <h3 className="font-extrabold text-xs text-gray-800 line-clamp-2 min-h-[34px] leading-snug">
                        {title}
                      </h3>

                      {/* Giá Tiền Màu Đỏ */}
                      <div className="flex items-baseline justify-between pt-0.5">
                        <p className="text-red-600 font-black text-sm">
                          {price.toLocaleString('vi-VN')} VNĐ
                        </p>
                      </div>

                      {/* Mô tả chất liệu ngắn */}
                      <p className="text-[10px] text-gray-500 line-clamp-1 italic">
                        {details}
                      </p>

                      {/* Đánh giá sao (★ 5.0) & Đã bán */}
                      <div className="flex items-center justify-between text-[10px] pt-1 border-t border-gray-100 text-gray-500">
                        <div className="flex items-center gap-1 text-amber-400 font-bold">
                          <span>★</span>
                          <span className="text-gray-800 font-extrabold">{rating}</span>
                        </div>
                        <span className="font-semibold">Đã bán {salesCount}</span>
                      </div>
                    </div>

                    {/* Cụm Nút Hành Động (Action Buttons) */}
                    <div className="space-y-1.5 mt-3 pt-2">
                      {/* Nút Thêm Vào Giỏ (Dạng viên thuốc bo tròn bg-navy) */}
                      <button 
                        onClick={() => onAddToCart(p)}
                        className="w-full bg-navy hover:bg-navy-dark text-white text-xs font-extrabold py-1.5 rounded-full transition-colors flex items-center justify-center gap-1 cursor-pointer shadow-xs"
                      >
                        <i className="fa-solid fa-cart-plus text-[10px] text-amber-300"></i>
                        <span>Thêm vào giỏ</span>
                      </button>

                      {/* Nút Nhắn Tin (Màu cam phía dưới) */}
                      <button 
                        onClick={() => onOpenChat(p)}
                        className="w-full bg-orange-custom hover:bg-orange-hover text-white text-xs font-bold py-1.5 rounded-full transition-colors flex items-center justify-center gap-1 cursor-pointer shadow-xs"
                      >
                        <i className="fa-solid fa-comments text-[10px]"></i>
                        <span>Nhắn tin</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="py-16 text-center text-gray-400 bg-white rounded-2xl border border-gray-200 space-y-2">
              <i className="fa-solid fa-box-open text-4xl text-gray-300 mb-1"></i>
              <p className="text-xs font-semibold">Không có sản phẩm nào phù hợp với bộ lọc khoảng giá hay địa điểm này.</p>
            </div>
          )}

        </div>

      </div>

    </div>
  );
}
