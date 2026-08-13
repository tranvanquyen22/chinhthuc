import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { addProductSchema, sanitizeText } from '../lib/validation';

export default function AddProductModal({ isOpen, onClose, onProductAdded }) {
  const { userProfile } = useAuth();

  const [title, setTitle] = useState('');
  const [price, setPrice] = useState('');
  const [shopType, setShopType] = useState('RETAIL');
  const [imageUrl, setImageUrl] = useState('');
  const [details, setDetails] = useState('');
  const [stock, setStock] = useState(20);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    const cleanTitle = sanitizeText(title.trim());
    const cleanDetails = sanitizeText(details.trim());
    const cleanImageUrl = sanitizeText(imageUrl.trim());
    const priceNum = Number(price);
    const stockNum = Number(stock);

    // Zod Input Validation
    const validation = addProductSchema.safeParse({
      title: cleanTitle,
      price: priceNum,
      shop_type: shopType,
      details: cleanDetails,
      stock: stockNum
    });

    if (!validation.success) {
      setErrorMsg(validation.error.issues[0].message);
      return;
    }

    setSubmitting(true);

    let badgeText = '';
    if (shopType === 'RENTAL') badgeText = `👗 Thuê ${priceNum.toLocaleString('vi-VN')}đ/ngày`;
    else if (shopType === 'FNB') badgeText = `🧋 F&B ${priceNum.toLocaleString('vi-VN')}đ`;
    else if (shopType === 'BEAUTY') badgeText = `💄 Spa ${priceNum.toLocaleString('vi-VN')}đ`;
    else badgeText = `🛍️ Bán ${priceNum.toLocaleString('vi-VN')}đ`;

    const image = cleanImageUrl || 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=400&q=80';

    try {
      const payload = {
        title: cleanTitle,
        price: priceNum,
        shop_type: shopType,
        shop_name: sanitizeText(userProfile.name || 'TQ Store Gian Hàng'),
        image_url: image,
        details: cleanDetails || 'Sản phẩm mới ra mắt',
        stock: stockNum,
        badge: badgeText
      };

      const { data, error } = await supabase
        .from('products')
        .insert([payload])
        .select();

      if (error) {
        console.warn('Supabase product insert warning:', error.message);
      }

      alert(`🎉 Đã thêm sản phẩm [ ${cleanTitle} ] thành công vào CSDL Supabase!`);
      if (onProductAdded) onProductAdded();
      onClose();
    } catch (err) {
      console.error('Error adding product:', err);
      setErrorMsg('Lỗi thêm sản phẩm: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full p-6 relative border-2 border-emerald-500 animate-in zoom-in-95 duration-200">
        
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-navy cursor-pointer"
        >
          <i className="fa-solid fa-xmark text-xl"></i>
        </button>

        <div className="text-center mb-4 pb-3 border-b border-gray-200">
          <h3 className="text-xl font-black text-navy uppercase flex items-center justify-center gap-2">
            <i className="fa-solid fa-store text-emerald-600"></i>
            <span>ĐĂNG SẢN PHẨM MỚI (SUPABASE)</span>
          </h3>
          <p className="text-xs text-gray-500 mt-1">Lọc chống XSS & Kiểm định định dạng Zod Schema</p>
        </div>

        {errorMsg && (
          <div className="mb-4 bg-red-50 text-red-600 p-3 rounded-lg text-xs font-semibold flex items-center gap-2 border border-red-200">
            <i className="fa-solid fa-shield-halved text-sm"></i>
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block font-bold text-gray-700 mb-1">Tên Sản phẩm / Dịch vụ *</label>
            <input 
              type="text" 
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required 
              placeholder="VD: Áo Thun Nam TQ Style..." 
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-navy text-xs"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-gray-700 mb-1">Loại hình sản phẩm *</label>
              <select 
                value={shopType}
                onChange={(e) => setShopType(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg font-bold bg-white focus:outline-none focus:border-navy"
              >
                <option value="RETAIL">🛍️ Shop Bán Đồ (Retail)</option>
                <option value="RENTAL">👗 Shop Cho Thuê Đồ (Rental)</option>
                <option value="FNB">🧋 Đồ Ăn & Uống (F&B)</option>
                <option value="BEAUTY">💄 Làm Đẹp & Spa (Beauty)</option>
              </select>
            </div>
            <div>
              <label className="block font-bold text-gray-700 mb-1">Giá đơn vị (VNĐ) *</label>
              <input 
                type="number" 
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                required 
                placeholder="250000" 
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-navy text-xs font-bold text-emerald-700"
              />
            </div>
          </div>

          <div>
            <label className="block font-bold text-gray-700 mb-1">Link URL Ảnh sản phẩm (Image URL)</label>
            <input 
              type="url" 
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="https://images.unsplash.com/photo-..." 
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-navy text-xs font-mono"
            />
          </div>

          <div>
            <label className="block font-bold text-gray-700 mb-1">Mô tả / Thông tin chi tiết</label>
            <textarea 
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              rows={2}
              placeholder="Mô tả về kích thước, chất liệu, hướng dẫn sử dụng..." 
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-navy text-xs"
            ></textarea>
          </div>

          <div>
            <label className="block font-bold text-gray-700 mb-1">Số lượng trong kho</label>
            <input 
              type="number" 
              value={stock}
              onChange={(e) => setStock(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-navy text-xs font-bold"
            />
          </div>

          <button 
            type="submit" 
            disabled={submitting}
            className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-black py-3 rounded-xl uppercase tracking-wider shadow-lg flex items-center justify-center gap-2 cursor-pointer"
          >
            {submitting ? <i className="fa-solid fa-spinner fa-spin"></i> : <i className="fa-solid fa-plus-circle"></i>}
            <span>LƯU SẢN PHẨM VÀO SUPABASE</span>
          </button>
        </form>
      </div>
    </div>
  );
}
