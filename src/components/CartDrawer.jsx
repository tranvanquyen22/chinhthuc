import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { getPlatformConfig } from '../lib/platformConfig';
import { validateAndApplyVoucher, incrementVoucherUsage } from '../lib/vouchers';

export default function CartDrawer({
  isOpen,
  onClose,
  cartItems,
  onUpdateQty,
  onRemoveItem,
  onClearCart,
  onOrderSuccess
}) {
  const { user, userProfile, updateBalance, featureLocks } = useAuth();
  const platformConfig = getPlatformConfig();
  const walletDiscountPercent = platformConfig.wallet_discount_percent ?? 2;

  const [voucherCode, setVoucherCode] = useState('');
  const [appliedVoucher, setAppliedVoucher] = useState(null);
  const [useCoins, setUseCoins] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('wallet');
  const [receiveMethod, setReceiveMethod] = useState('shipping');
  const [shippingAddress, setShippingAddress] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  // Subtotal calculation
  const subtotal = cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  // Voucher discount calculation
  let voucherDiscount = appliedVoucher ? (appliedVoucher.discountAmount || 0) : 0;

  // Coin usage calculation (max 50% of subtotal)
  const maxCoinsAllowed = Math.floor(Math.max(0, subtotal - voucherDiscount) * 0.5);
  const coinsToDeduct = (useCoins && paymentMethod === 'wallet')
    ? Math.min(userProfile.coins || 0, maxCoinsAllowed)
    : 0;

  // Dynamic Wallet % discount calculation
  const priceBeforeWalletDiscount = Math.max(0, subtotal - voucherDiscount - coinsToDeduct);
  const walletDiscount = paymentMethod === 'wallet' ? Math.round(priceBeforeWalletDiscount * (walletDiscountPercent / 100)) : 0;

  // Final Total Amount
  const finalTotal = Math.max(0, priceBeforeWalletDiscount - walletDiscount);

  // Expected cashback (3%)
  const expectedCashback = Math.round(finalTotal * 0.03);

  const handleApplyVoucher = () => {
    try {
      const res = validateAndApplyVoucher(voucherCode, subtotal, paymentMethod);
      setAppliedVoucher(res);
      alert(`🎉 Đã áp dụng mã giảm giá ${res.voucher.code}: ${res.displayText}!`);
    } catch (err) {
      alert(err.message);
    }
  };

  const handleCheckout = async () => {
    if (cartItems.length === 0) return;

    if (!user) {
      alert('Vui lòng đăng nhập trước khi tiến hành đặt hàng!');
      return;
    }

    if (receiveMethod === 'shipping' && !shippingAddress.trim()) {
      alert('Vui lòng nhập địa chỉ nhận hàng!');
      return;
    }

    // Check wallet balance
    if (paymentMethod === 'wallet' && (userProfile.walletBalance || 0) < finalTotal) {
      alert(`Số dư Ví TQ Pay không đủ! (${Number(userProfile.walletBalance || 0).toLocaleString('vi-VN')}đ < ${finalTotal.toLocaleString('vi-VN')}đ). Vui lòng nạp thêm tiền vào ví.`);
      return;
    }

    setSubmitting(true);

    try {
      // 1. Insert order record into Supabase `orders` table
      const { data: orderData, error: orderErr } = await supabase
        .from('orders')
        .insert([
          {
            user_id: user?.id || null,
            user_email: user?.email || userProfile.email,
            user_name: userProfile.name || 'Khách hàng',
            total_amount: finalTotal,
            payment_method: paymentMethod,
            shipping_address: receiveMethod === 'shipping' ? shippingAddress : 'Lấy tại cửa hàng',
            status: 'completed'
          }
        ])
        .select();

      if (orderErr) {
        console.warn('Supabase orders insert warning (will fallback locally):', orderErr.message);
      }

      const orderId = orderData?.[0]?.id || Date.now();

      // 2. Insert order items into Supabase `order_items` table
      const itemsPayload = cartItems.map(item => ({
        order_id: orderId,
        product_id: item.id,
        product_name: item.title || item.name,
        price: item.price,
        quantity: item.quantity,
        image_url: item.image_url || item.img || item.image
      }));

      const { error: itemsErr } = await supabase
        .from('order_items')
        .insert(itemsPayload);

      if (itemsErr) {
        console.warn('Supabase order_items insert warning:', itemsErr.message);
      }

      // 3. Deduct balance & coins locally
      if (paymentMethod === 'wallet') {
        const newWallet = Math.max(0, (userProfile.walletBalance || 0) - finalTotal);
        const newCoins = Math.max(0, (userProfile.coins || 0) - coinsToDeduct + expectedCashback);
        updateBalance(newWallet, newCoins);
      }

      // 4. Success callback & clean up
      if (appliedVoucher?.voucher?.code) {
        await incrementVoucherUsage(appliedVoucher.voucher.code);
      }
      onClearCart();
      alert(`🎉 Đặt hàng thành công! Mã đơn: #${orderId}.\nĐã nhận ngay +${expectedCashback.toLocaleString('vi-VN')} TQ Xu tích lũy!`);
      if (onOrderSuccess) onOrderSuccess();
      onClose();
    } catch (err) {
      console.error('Checkout error:', err);
      alert('Đã xảy ra lỗi khi đặt hàng: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex justify-end">
      <div className="bg-white w-full max-w-lg h-full shadow-2xl flex flex-col justify-between overflow-y-auto animate-in slide-in-from-right duration-200">
        
        {/* Drawer Header */}
        <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-navy text-white">
          <div className="flex items-center gap-2">
            <i className="fa-solid fa-cart-shopping text-lg text-amber-400"></i>
            <h3 className="font-extrabold text-sm uppercase">Giỏ Hàng Mua Sắm ({cartItems.length})</h3>
          </div>
          <button 
            onClick={onClose}
            className="text-gray-300 hover:text-white cursor-pointer p-1"
          >
            <i className="fa-solid fa-xmark text-xl"></i>
          </button>
        </div>

        {/* Cart Item List */}
        <div className="p-4 flex-1 space-y-4 overflow-y-auto">
          {cartItems.length > 0 ? (
            <div className="divide-y divide-gray-100">
              {cartItems.map((item, index) => (
                <div key={index} className="py-3 flex items-center justify-between gap-3">
                  <img 
                    src={item.image_url || item.img || item.image || 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=200&q=80'} 
                    alt={item.title || item.name} 
                    className="w-14 h-14 object-cover rounded-lg border border-gray-200"
                  />
                  <div className="flex-1">
                    <h4 className="font-bold text-navy text-xs line-clamp-1">
                      {item.title || item.name}
                    </h4>
                    <p className="text-[10px] text-gray-400">
                      Gian hàng: <span className="font-bold text-gray-700">{item.shop_name || item.shopName || 'TQ Store'}</span>
                    </p>
                    <p className="text-orange-custom font-bold text-xs mt-0.5">
                      {Number(item.price).toLocaleString('vi-VN')} VNĐ
                    </p>
                  </div>

                  {/* Quantity Controls */}
                  <div className="flex items-center gap-3">
                    <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden shadow-xs">
                      <button 
                        onClick={() => onUpdateQty(index, item.quantity - 1)}
                        className="px-2 py-0.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs cursor-pointer"
                      >
                        -
                      </button>
                      <span className="px-2 text-xs font-bold text-navy">{item.quantity}</span>
                      <button 
                        onClick={() => onUpdateQty(index, item.quantity + 1)}
                        className="px-2 py-0.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs cursor-pointer"
                      >
                        +
                      </button>
                    </div>
                    <button 
                      onClick={() => onRemoveItem(index)}
                      className="text-red-500 hover:text-red-700 font-bold text-xs cursor-pointer"
                      title="Xóa sản phẩm"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-16 text-center text-gray-400 space-y-3">
              <i className="fa-solid fa-cart-arrow-down text-5xl text-gray-300"></i>
              <p className="text-sm font-medium">Giỏ hàng của bạn đang trống.</p>
            </div>
          )}

          {cartItems.length > 0 && (
            <div className="space-y-4 border-t border-gray-100 pt-4 text-xs">
              
              {/* Voucher Code */}
              <div className="bg-gray-50 p-3 rounded-xl border border-gray-200 space-y-2">
                <label className="block font-bold text-navy">🎫 Nhập mã giảm giá (Voucher):</label>
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    value={voucherCode}
                    onChange={(e) => setVoucherCode(e.target.value)}
                    placeholder="Nhập TQ10 hoặc TQ50K..." 
                    className="flex-1 px-3 py-1.5 border rounded-lg text-xs uppercase font-mono font-bold focus:outline-none focus:border-navy"
                  />
                  <button 
                    type="button" 
                    onClick={handleApplyVoucher}
                    className="bg-navy text-white px-3 py-1.5 rounded-lg font-bold hover:bg-navy-dark transition cursor-pointer"
                  >
                    Áp dụng
                  </button>
                </div>
                {appliedVoucher && (
                  <div className="bg-emerald-50 text-emerald-800 p-2 rounded-lg border border-emerald-200 flex items-center justify-between text-xs font-semibold">
                    <span>✓ Mã <strong>{appliedVoucher.code}</strong> ({appliedVoucher.text})</span>
                    <button onClick={() => setAppliedVoucher(null)} className="text-red-600 font-bold cursor-pointer">Xóa</button>
                  </div>
                )}
              </div>

              {/* TQ Xu deduction option */}
              {userProfile.coins > 0 && (
                <div className={`p-3 rounded-xl border space-y-1 ${paymentMethod === 'wallet' ? 'bg-amber-50 border-amber-200' : 'bg-gray-100 border-gray-200 opacity-70'}`}>
                  <label className="flex items-center justify-between cursor-pointer">
                    <span className="font-bold flex items-center gap-1 text-amber-900">
                      🪙 Dùng TQ Xu tích lũy (Tối đa 50% đơn):
                    </span>
                    <input 
                      type="checkbox" 
                      checked={useCoins}
                      disabled={paymentMethod !== 'wallet'}
                      onChange={(e) => setUseCoins(e.target.checked)}
                      className="w-4 h-4 text-amber-600 rounded cursor-pointer"
                    />
                  </label>
                  <p className="text-[10px] text-amber-800">
                    Số TQ Xu hiện có: {Number(userProfile.coins || 0).toLocaleString('vi-VN')} Xu
                  </p>
                  {paymentMethod !== 'wallet' && (
                    <p className="text-[10px] text-red-600 font-bold italic">⚠️ Chỉ áp dụng khi chọn PTTT Ví TQ Pay!</p>
                  )}
                  {paymentMethod === 'wallet' && useCoins && (
                    <span className="text-emerald-700 font-bold block">
                      - Trừ xu vào đơn: -{coinsToDeduct.toLocaleString('vi-VN')}đ
                    </span>
                  )}
                </div>
              )}

              {/* Payment Methods */}
              <div>
                <label className="block font-bold text-gray-700 mb-1.5">💳 Hình thức thanh toán:</label>
                <div className="space-y-2">
                  <label className={`flex items-center justify-between p-2.5 border rounded-lg transition-colors ${featureLocks?.wallet_payment ? 'bg-gray-100 border-red-200 opacity-60 cursor-not-allowed' : paymentMethod === 'wallet' ? 'border-emerald-500 bg-emerald-50/60 cursor-pointer' : 'cursor-pointer'}`}>
                    <div className="flex items-center gap-2">
                      <input 
                        type="radio" 
                        name="payType" 
                        value="wallet" 
                        disabled={featureLocks?.wallet_payment}
                        checked={paymentMethod === 'wallet'}
                        onChange={() => setPaymentMethod('wallet')}
                        className="text-emerald-600"
                      />
                      <div>
                        <span className="font-bold text-gray-800 block">Ví số dư cá nhân TQ Pay</span>
                        {featureLocks?.wallet_payment ? (
                          <span className="text-[10px] text-red-600 font-bold">🔒 SUPER ADMIN ĐÃ KHÓA PTTT VÍ TQ PAY</span>
                        ) : (
                          <span className="text-[10px] text-emerald-700 font-semibold">🔥 Giảm thêm {walletDiscountPercent}% & dùng được TQ Xu</span>
                        )}
                      </div>
                    </div>
                    <span className="text-[11px] font-mono text-emerald-800 font-extrabold">
                      {Number(userProfile.walletBalance || 0).toLocaleString('vi-VN')}đ
                    </span>
                  </label>

                  <label className={`flex items-center gap-2 p-2.5 border rounded-lg ${featureLocks?.cod_payment ? 'bg-gray-100 border-red-200 opacity-60 cursor-not-allowed' : paymentMethod === 'cash' ? 'border-navy bg-blue-50/50 cursor-pointer' : 'cursor-pointer'}`}>
                    <input 
                      type="radio" 
                      name="payType" 
                      value="cash" 
                      disabled={featureLocks?.cod_payment}
                      checked={paymentMethod === 'cash'}
                      onChange={() => setPaymentMethod('cash')}
                      className="text-navy"
                    />
                    <div>
                      <span className="font-bold text-gray-800 block">Thanh toán tiền mặt khi nhận hàng (COD)</span>
                      {featureLocks?.cod_payment && (
                        <span className="text-[10px] text-red-600 font-bold block">🔒 SUPER ADMIN ĐÃ KHÓA PTTT TIỀN MẶT (COD)</span>
                      )}
                    </div>
                  </label>
                </div>
              </div>

              {/* Delivery method */}
              <div>
                <label className="block font-bold text-gray-700 mb-1">📦 Hình thức nhận hàng:</label>
                <div className="grid grid-cols-2 gap-2">
                  <button 
                    type="button" 
                    disabled={featureLocks?.shipping_delivery}
                    onClick={() => setReceiveMethod('shipping')}
                    className={`py-2 rounded-lg font-bold text-xs transition ${featureLocks?.shipping_delivery ? 'bg-gray-200 text-gray-400 cursor-not-allowed border border-red-300' : receiveMethod === 'shipping' ? 'bg-navy text-white cursor-pointer' : 'bg-gray-100 text-gray-700 cursor-pointer'}`}
                  >
                    {featureLocks?.shipping_delivery ? '🔒 Giao Tận Nơi (Đã Khóa)' : 'Giao tận nơi'}
                  </button>
                  <button 
                    type="button" 
                    disabled={featureLocks?.pickup_in_store}
                    onClick={() => setReceiveMethod('pickup')}
                    className={`py-2 rounded-lg font-bold text-xs transition ${featureLocks?.pickup_in_store ? 'bg-gray-200 text-gray-400 cursor-not-allowed border border-red-300' : receiveMethod === 'pickup' ? 'bg-navy text-white cursor-pointer' : 'bg-gray-100 text-gray-700 cursor-pointer'}`}
                  >
                    {featureLocks?.pickup_in_store ? '🔒 Nhận Tại Shop (Đã Khóa)' : 'Lấy tại cửa hàng'}
                  </button>
                </div>
              </div>

              {receiveMethod === 'shipping' && (
                <div>
                  <label className="block font-bold text-gray-700 mb-1">🏠 Địa chỉ giao hàng:</label>
                  <input 
                    type="text" 
                    value={shippingAddress}
                    onChange={(e) => setShippingAddress(e.target.value)}
                    placeholder="Số nhà, tên đường, Phường/Xã..." 
                    className="w-full px-3 py-2 border rounded-lg text-xs"
                  />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Drawer Footer & Checkout */}
        {cartItems.length > 0 && (
          <div className="p-4 border-t border-gray-200 bg-gray-50 space-y-3">
            <div className="space-y-1 text-xs">
              <div className="flex justify-between text-gray-600">
                <span>Tạm tính:</span>
                <span className="font-bold">{subtotal.toLocaleString('vi-VN')} VNĐ</span>
              </div>
              {voucherDiscount > 0 && (
                <div className="flex justify-between text-emerald-600 font-semibold">
                  <span>Voucher giảm giá:</span>
                  <span>-{voucherDiscount.toLocaleString('vi-VN')}đ</span>
                </div>
              )}
              {coinsToDeduct > 0 && (
                <div className="flex justify-between text-amber-700 font-semibold">
                  <span>Trừ Xu tích lũy:</span>
                  <span>-{coinsToDeduct.toLocaleString('vi-VN')}đ</span>
                </div>
              )}
              {walletDiscount > 0 && (
                <div className="flex justify-between text-emerald-700 font-bold bg-emerald-100/60 p-1.5 rounded">
                  <span>🔥 Giảm {walletDiscountPercent}% Ví TQ Pay:</span>
                  <span>-{walletDiscount.toLocaleString('vi-VN')}đ</span>
                </div>
              )}
              <div className="flex justify-between text-sm font-black text-navy pt-2 border-t border-gray-200">
                <span>Tổng thanh toán:</span>
                <span className="text-orange-custom text-base font-black">
                  {finalTotal.toLocaleString('vi-VN')} VNĐ
                </span>
              </div>
              <p className="text-[10px] text-amber-600 font-semibold text-right">
                🎁 Tích lũy +{expectedCashback.toLocaleString('vi-VN')} TQ Xu sau khi hoàn tất!
              </p>
            </div>

            <button 
              onClick={handleCheckout}
              disabled={submitting}
              className="w-full bg-orange-custom hover:bg-orange-hover text-white py-3 rounded-xl font-black text-xs uppercase tracking-wider transition shadow-md cursor-pointer flex items-center justify-center gap-2"
            >
              {submitting ? <i className="fa-solid fa-spinner fa-spin"></i> : <i className="fa-solid fa-rocket"></i>}
              <span>HOÀN TẤT ĐẶT HÀNG (SUPABASE)</span>
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
