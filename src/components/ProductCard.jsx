import React from 'react';

export default function ProductCard({ product, onAddToCart, onOpenChat }) {
  const title = product.title || product.name || 'Sản phẩm TQ Store';
  const price = Number(product.price || 0);
  const shopType = product.shop_type || product.shopType || 'RETAIL';
  const shopName = product.shop_name || product.shopName || product.shop || 'TQ Store';
  const image = product.image_url || product.img || product.image || 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=400&q=80';
  const badge = product.badge || (shopType === 'RENTAL' ? '👗 Thuê Đồ' : shopType === 'FNB' ? '🧋 F&B' : shopType === 'BEAUTY' ? '💄 Spa' : '🛍️ Bán Đồ');
  const details = product.details || 'Sản phẩm chất lượng cao TQ Store';
  const cashback = Math.round(price * 0.03);

  const getBadgeBg = (type) => {
    switch (type) {
      case 'RENTAL': return 'bg-pink-600';
      case 'RETAIL': return 'bg-emerald-600';
      case 'FNB': return 'bg-amber-600';
      case 'BEAUTY': return 'bg-rose-500';
      default: return 'bg-navy';
    }
  };

  return (
    <div className="bg-white rounded-xl p-3 border border-gray-100 shadow-xs flex flex-col justify-between product-card relative">
      {/* Category Badge */}
      <span className={`absolute top-4 left-4 text-[9px] font-black px-2 py-0.5 rounded-full shadow-xs z-10 uppercase text-white ${getBadgeBg(shopType)}`}>
        {badge}
      </span>

      {/* Cashback badge */}
      <span className="absolute top-4 right-4 bg-amber-500 text-white text-[8px] font-black px-1.5 py-0.5 rounded shadow-xs z-10">
        🪙 3% Xu
      </span>

      <div className="space-y-2">
        {/* Product Image */}
        <div className="bg-gray-50 rounded-lg overflow-hidden h-36 flex items-center justify-center relative border border-gray-100">
          <img 
            src={image} 
            alt={title} 
            className="h-full w-full object-cover"
            onError={(e) => {
              e.target.src = 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=400&q=80';
            }}
          />
        </div>

        {/* Shop Name */}
        <div className="text-[9px] text-gray-400 font-bold tracking-tight uppercase truncate">
          {shopName}
        </div>

        {/* Title */}
        <h3 className="font-bold text-xs text-gray-800 line-clamp-2 min-h-[32px]">
          {title}
        </h3>

        {/* Price & Cashback */}
        <div className="flex items-baseline justify-between">
          <p className="text-orange-custom font-extrabold text-xs">
            {price.toLocaleString('vi-VN')} VNĐ
          </p>
          <span className="text-[9px] text-amber-700 font-semibold">
            Hoàn ~{cashback.toLocaleString('vi-VN')} Xu
          </span>
        </div>

        <p className="text-[9px] text-gray-500 line-clamp-1 italic">
          {details}
        </p>

        {/* Rating Stars */}
        <div className="flex items-center gap-1 text-[10px] text-amber-400 font-bold">
          <i className="fa-solid fa-star"></i>
          <span className="text-gray-700">5.0</span>
          <span className="text-gray-400 text-[8px]">(24 đánh giá)</span>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="space-y-1.5 mt-3">
        <button 
          onClick={() => onAddToCart(product)}
          className="w-full bg-navy hover:bg-navy-dark text-white text-xs font-semibold py-1.5 rounded-md transition-colors flex items-center justify-center gap-1 cursor-pointer"
        >
          <i className="fa-solid fa-cart-plus text-[10px]"></i> Đặt mua ngay
        </button>

        <button 
          onClick={() => onOpenChat(product)}
          className="w-full bg-amber-500 hover:bg-amber-600 text-white text-[11px] font-bold py-1 rounded-md transition-colors flex items-center justify-center gap-1 cursor-pointer"
        >
          <i className="fa-solid fa-comments text-[10px]"></i> Hỏi Shop sản phẩm
        </button>
      </div>
    </div>
  );
}
