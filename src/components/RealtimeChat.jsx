import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { chatMessageSchema, sanitizeText } from '../lib/validation';

export default function RealtimeChat({ attachedProduct, onClearAttachedProduct }) {
  const { user, userProfile } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [unreadCount, setUnreadCount] = useState(0);
  const [channelConnected, setChannelConnected] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const messagesEndRef = useRef(null);
  const channelRef = useRef(null);

  // Auto-scroll to bottom of message list
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Fetch initial messages & set up Supabase Realtime subscription
  useEffect(() => {
    fetchInitialMessages();

    // Setup Supabase Realtime Channel
    const channel = supabase
      .channel('room_messages_live')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        (payload) => {
          addNewMessage(payload.new);
        }
      )
      .on('broadcast', { event: 'chat_msg' }, (payload) => {
        addNewMessage(payload.payload);
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setChannelConnected(true);
        }
      });

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    if (isOpen) {
      setUnreadCount(0);
      scrollToBottom();
    }
  }, [isOpen, messages]);

  // Open chat automatically if a product is attached
  useEffect(() => {
    if (attachedProduct) {
      setIsOpen(true);
      setInputText(`Chào Shop, tôi muốn hỏi thông tin sản phẩm: ${attachedProduct.title || attachedProduct.name}`);
    }
  }, [attachedProduct]);

  const fetchInitialMessages = async () => {
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .order('id', { ascending: true })
        .limit(50);

      if (error || !data || data.length === 0) {
        setMessages([
          {
            id: 1,
            user_email: 'support@tqstore.vn',
            user_name: 'TQ Store Support Bot 🤖',
            content: 'Xin chào! Bạn cần hỗ trợ thêm về sản phẩm hay đơn hàng nào không ạ?',
            sender_role: 'shop',
            created_at: new Date().toISOString()
          }
        ]);
      } else {
        setMessages(data);
      }
    } catch (err) {
      console.warn('Error fetching messages from Supabase:', err);
    }
  };

  const addNewMessage = (newMsg) => {
    // Sanitize incoming message content against XSS
    const safeContent = sanitizeText(newMsg.content);
    const safeMsg = { ...newMsg, content: safeContent };

    setMessages((prev) => {
      if (prev.some((m) => m.id === safeMsg.id || (m.content === safeMsg.content && m.created_at === safeMsg.created_at))) {
        return prev;
      }
      return [...prev, safeMsg];
    });

    if (!isOpen) {
      setUnreadCount((c) => c + 1);
    }
  };

  const handleSendMessage = async (e) => {
    e?.preventDefault();
    setErrorMsg('');

    const rawText = inputText.trim();
    const cleanText = sanitizeText(rawText);

    // Zod Input Validation
    const validation = chatMessageSchema.safeParse({ content: cleanText });
    if (!validation.success) {
      setErrorMsg(validation.error.issues[0].message);
      return;
    }

    const email = user?.email || userProfile.email || 'khachhang@tqstore.vn';
    const name = sanitizeText(userProfile.name || email.split('@')[0] || 'Khách hàng');

    const newMsgPayload = {
      user_id: user?.id || null,
      user_email: email,
      user_name: name,
      content: cleanText,
      sender_role: 'customer',
      created_at: new Date().toISOString()
    };

    setInputText('');
    if (onClearAttachedProduct) onClearAttachedProduct();

    // Optimistically update UI locally
    const tempId = Date.now();
    const localMsg = { ...newMsgPayload, id: tempId };
    addNewMessage(localMsg);

    try {
      if (channelRef.current) {
        channelRef.current.send({
          type: 'broadcast',
          event: 'chat_msg',
          payload: localMsg
        });
      }

      const { data, error } = await supabase
        .from('messages')
        .insert([newMsgPayload])
        .select();

      if (error) {
        console.warn('Supabase DB insert notice:', error.message);
      } else if (data?.[0]) {
        setMessages((prev) => prev.map((m) => (m.id === tempId ? data[0] : m)));
      }

      // Auto reply bot for live interactive demo
      setTimeout(() => {
        const botReply = {
          id: Date.now() + 1,
          user_email: 'support@tqstore.vn',
          user_name: 'TQ Store Support 🤖',
          content: `Cảm ơn ${name}! Shop đã nhận được tin nhắn và sẽ tư vấn cho bạn ngay nhé! ✨`,
          sender_role: 'shop',
          created_at: new Date().toISOString()
        };
        addNewMessage(botReply);

        if (channelRef.current) {
          channelRef.current.send({
            type: 'broadcast',
            event: 'chat_msg',
            payload: botReply
          });
        }
      }, 1200);

    } catch (err) {
      console.error('Error sending realtime message:', err);
    }
  };

  return (
    <div className="fixed bottom-5 right-5 z-50 font-sans">
      
      {/* Floating Toggle Button */}
      {!isOpen && (
        <button 
          onClick={() => setIsOpen(true)}
          className="relative bg-gradient-to-r from-navy to-indigo-900 text-white w-14 h-14 rounded-full shadow-2xl flex items-center justify-center hover:scale-110 transition-all duration-300 border-2 border-amber-400 cursor-pointer group"
          title="Mở trò chuyện trực tuyến thời gian thực"
        >
          <i className="fa-solid fa-comments text-2xl text-amber-300 group-hover:rotate-12 transition-transform"></i>
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center border-2 border-white animate-bounce">
              {unreadCount}
            </span>
          )}
          <span className="absolute -bottom-1 bg-emerald-500 text-white text-[8px] font-bold px-1.5 py-0.2 rounded-full uppercase border">
            Realtime
          </span>
        </button>
      )}

      {/* Expanded Live Chat Window */}
      {isOpen && (
        <div className="bg-white rounded-2xl shadow-2xl w-[350px] sm:w-[380px] h-[500px] flex flex-col border border-gray-200 overflow-hidden animate-in zoom-in-95 duration-200">
          
          {/* Header */}
          <div className="bg-gradient-to-r from-navy via-navy-dark to-slate-900 text-white p-3.5 flex items-center justify-between border-b border-amber-400/40">
            <div className="flex items-center gap-2.5">
              <div className="relative">
                <div className="w-9 h-9 bg-amber-400 text-navy rounded-xl flex items-center justify-center font-black text-sm shadow">
                  TQ
                </div>
                <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-400 rounded-full border border-white"></span>
              </div>
              <div>
                <h4 className="font-extrabold text-xs text-amber-300 tracking-wider">
                  TƯ VẤN TRỰC TUYẾN REALTIME
                </h4>
                <div className="flex items-center gap-1 text-[9px] text-emerald-300">
                  <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-ping"></span>
                  <span>Supabase Realtime Channel</span>
                </div>
              </div>
            </div>

            <button 
              onClick={() => setIsOpen(false)}
              className="text-gray-300 hover:text-white p-1 cursor-pointer"
            >
              <i className="fa-solid fa-xmark text-lg"></i>
            </button>
          </div>

          {/* Connected banner */}
          <div className="bg-emerald-50 text-emerald-800 text-[10px] px-3 py-1 font-semibold flex items-center justify-between border-b border-emerald-100">
            <span>⚡ Lọc Chống XSS & Kiểm Định Zod Schema</span>
            <span className="text-[9px] bg-emerald-600 text-white px-1.5 py-0.2 rounded font-mono font-bold">
              SAFE
            </span>
          </div>

          {errorMsg && (
            <div className="bg-red-50 text-red-600 text-[10px] p-2 border-b border-red-200 flex items-center gap-1 font-semibold">
              <i className="fa-solid fa-shield-halved"></i>
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Attached Product Notification */}
          {attachedProduct && (
            <div className="bg-amber-50 border-b border-amber-200 p-2 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 truncate">
                <img 
                  src={attachedProduct.image_url || attachedProduct.img || attachedProduct.image} 
                  alt="sp" 
                  className="w-8 h-8 object-cover rounded border"
                />
                <span className="font-bold text-navy text-[11px] truncate">
                  {attachedProduct.title || attachedProduct.name}
                </span>
              </div>
              <button 
                onClick={onClearAttachedProduct}
                className="text-gray-400 hover:text-red-500 text-xs px-1 cursor-pointer"
              >
                ✕
              </button>
            </div>
          )}

          {/* Message History Area */}
          <div className="flex-1 p-3 overflow-y-auto space-y-3 bg-gray-50/50">
            {messages.map((msg, index) => {
              const isMe = msg.sender_role === 'customer' || msg.user_email === (user?.email || userProfile.email);
              const senderName = msg.user_name || msg.user_email?.split('@')[0] || 'Shop';
              const timeStr = msg.created_at 
                ? new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                : 'Vừa xong';

              return (
                <div 
                  key={msg.id || index}
                  className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                >
                  <span className="text-[9px] text-gray-400 mb-0.5 px-1 font-medium">
                    {senderName} • {timeStr}
                  </span>

                  <div 
                    className={`max-w-[82%] p-2.5 rounded-2xl text-xs leading-relaxed shadow-xs ${
                      isMe 
                        ? 'bg-navy text-white rounded-br-none font-medium' 
                        : 'bg-white border border-gray-200 text-gray-800 rounded-bl-none'
                    }`}
                  >
                    <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          {/* Message Input & Send Form */}
          <form 
            onSubmit={handleSendMessage}
            className="p-2.5 bg-white border-t border-gray-200 flex items-center gap-2"
          >
            <input 
              type="text" 
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Nhập tin nhắn tới Shop..." 
              className="flex-1 bg-gray-100 border border-gray-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-navy focus:bg-white transition-all"
            />
            <button 
              type="submit"
              disabled={!inputText.trim()}
              className="bg-navy hover:bg-navy-dark text-white p-2.5 rounded-xl transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center shadow"
              title="Gửi tin nhắn"
            >
              <i className="fa-solid fa-paper-plane text-xs text-amber-300"></i>
            </button>
          </form>

        </div>
      )}

    </div>
  );
}
