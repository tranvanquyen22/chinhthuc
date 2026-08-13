import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';

export default function OrderHistoryModal({ isOpen, onClose }) {
  const { user, userProfile } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen) {
      fetchOrders();
    }
  }, [isOpen]);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const email = user?.email || userProfile.email;
      
      // CHỐNG LỖI IDOR: Bắt buộc người dùng phải đăng nhập và chỉ được tải đơn của chính mình
      if (!email) {
        setOrders([]);
        setLoading(false);
        return;
      }

      // Strict query: Kiểm tra token/email người dùng trùng khớp với user_email trong DB
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .eq('user_email', email)
        .order('id', { ascending: false });

      if (error || !data || data.length === 0) {
        setOrders([]);
      } else {
        setOrders(data);
      }
    } catch (err) {
      console.error('Error fetching orders:', err);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full p-6 relative max-h-[85vh] flex flex-col animate-in zoom-in-95 duration-200">
        
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-navy cursor-pointer"
        >
          <i className="fa-solid fa-xmark text-xl"></i>
        </button>

        <div className="border-b border-gray-100 pb-3 mb-4">
          <h3 className="text-xl font-black text-navy uppercase flex items-center gap-2">
            <i className="fa-solid fa-box text-amber-500"></i>
            <span>LỊCH SỬ ĐƠN HÀNG (SUPABASE)</span>
          </h3>
          <p className="text-xs text-gray-500 mt-1">Danh sách đơn hàng của tài khoản: <strong className="text-navy">{user?.email || userProfile.name}</strong></p>
        </div>

        <div className="flex-1 overflow-y-auto space-y-4 pr-1">
          {loading ? (
            <div className="py-12 text-center text-gray-500 text-xs">
              <i className="fa-solid fa-spinner fa-spin text-xl text-navy mb-2"></i>
              <p>Đang tải lịch sử đơn từ Supabase...</p>
            </div>
          ) : orders.length > 0 ? (
            orders.map((order) => (
              <div key={order.id} className="border border-gray-200 rounded-xl p-4 bg-gray-50/70 space-y-3 text-xs">
                <div className="flex justify-between items-center pb-2 border-b border-gray-200">
                  <div>
                    <span className="font-bold text-navy">Mã đơn: #{order.id}</span>
                    <span className="text-gray-400 ml-2 text-[10px]">
                      {order.created_at ? new Date(order.created_at).toLocaleDateString('vi-VN') : 'Gần đây'}
                    </span>
                  </div>
                  <span className="bg-emerald-100 text-emerald-800 font-bold px-2.5 py-0.5 rounded-full text-[10px]">
                    ✓ {order.status === 'completed' ? 'Thành công' : order.status}
                  </span>
                </div>

                <div className="space-y-2">
                  {(order.items || [
                    {
                      product_name: 'Sản phẩm mua tại TQ Store',
                      price: order.total_amount,
                      quantity: 1,
                      image_url: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=200&q=80'
                    }
                  ]).map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between bg-white p-2.5 rounded-lg border border-gray-100">
                      <div className="flex items-center gap-3">
                        <img 
                          src={item.image_url || 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=200&q=80'} 
                          className="w-10 h-10 object-cover rounded border" 
                          alt="item"
                        />
                        <div>
                          <h4 className="font-bold text-xs text-gray-800">{item.product_name}</h4>
                          <p className="text-[10px] text-gray-500">
                            SL: <span className="font-bold">{item.quantity}</span> | Giá: <span className="text-orange-custom font-bold">{Number(item.price).toLocaleString('vi-VN')}đ</span>
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex justify-between items-center text-xs pt-1 border-t border-gray-200">
                  <span className="text-gray-600">
                    PTTT: <strong className="text-navy uppercase">{order.payment_method}</strong>
                  </span>
                  <span className="text-navy font-bold">
                    Tổng tiền: <strong className="text-orange-custom text-sm font-black">{Number(order.total_amount).toLocaleString('vi-VN')} VNĐ</strong>
                  </span>
                </div>
              </div>
            ))
          ) : (
            <div className="py-12 text-center text-gray-400">
              <i className="fa-solid fa-receipt text-4xl mb-2 text-gray-300"></i>
              <p className="text-xs">Chưa có lịch sử đơn hàng nào.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
