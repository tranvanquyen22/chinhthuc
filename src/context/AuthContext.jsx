import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { getCloudRegisteredUsers } from '../lib/userSync';

const AuthContext = createContext({});

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [userProfile, setUserProfile] = useState({
    name: 'Khách hàng TQ Store',
    email: '',
    role: 'USER', // 'USER', 'SHOP', 'SUPER_ADMIN'
    walletBalance: 0,
    coins: 0,
    phone: '',
    avatar: ''
  });

  useEffect(() => {
    // 1. Fetch current session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user) {
        setUser(session.user);
        updateProfileFromUser(session.user);
      }
      setLoading(false);
    });

    // 2. Listen for Auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user || null);
      if (session?.user) {
        updateProfileFromUser(session.user);
      } else {
        // Tài khoản chưa đăng nhập: Mặc định tất cả dữ liệu bằng 0
        setUserProfile({
          name: 'Khách hàng TQ Store',
          email: '',
          role: 'USER',
          walletBalance: 0,
          coins: 0,
          phone: '',
          avatar: ''
        });
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  // 3. Tự động đồng bộ CSDL Đám mây Realtime cho số dư ví & tài khoản người dùng
  useEffect(() => {
    if (!user?.email) return;

    // A. Khởi tạo đồng bộ số dư & thông tin từ CSDL Cloud
    updateProfileFromUser(user);

    // B. Lắng nghe thay đổi CSDL Supabase Realtime Postgres cho bảng tq_registered_users
    const channel = supabase
      .channel(`user-profile-realtime-${user.email}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tq_registered_users' }, () => {
        updateProfileFromUser(user);
      })
      .subscribe();

    // C. Tự động kiểm tra đồng bộ số dư định kỳ 3 giây/lần
    const interval = setInterval(() => {
      updateProfileFromUser(user);
    }, 3000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [user?.email]);

  const updateProfileFromUser = async (userObj) => {
    if (!userObj) return;
    const email = userObj.email || '';
    const cleanEmail = email.trim().toLowerCase();
    const nameFromMeta = userObj.user_metadata?.full_name || userObj.user_metadata?.name;
    let name = nameFromMeta || cleanEmail.split('@')[0] || 'Thành viên TQ Store';
    
    // Check if super admin
    const isSuperAdmin = 
      cleanEmail.includes('admin') || 
      cleanEmail === 'tqstore2212@gmail.com' || 
      cleanEmail === 'admin@tqstore.vn';

    let role = isSuperAdmin ? 'SUPER_ADMIN' : 'USER';
    let savedBalance = 0;
    let savedCoins = 0;
    let phone = userObj.user_metadata?.phone || '';

    // Đọc thông tin mới nhất từ CSDL Đám mây Realtime Supabase
    try {
      const cloudUsers = await getCloudRegisteredUsers();
      const matchUser = cloudUsers.find((u) => u.email?.toLowerCase() === cleanEmail);

      if (matchUser) {
        if (matchUser.is_locked) {
          signOut();
          return;
        }
        name = matchUser.name || name;
        role = matchUser.role || role;
        savedBalance = Number(matchUser.wallet_balance ?? matchUser.walletBalance ?? 0);
        savedCoins = Number(matchUser.coins ?? 0);
        phone = matchUser.phone || phone;
      }
    } catch (e) {
      console.warn('Error reading cloud user balance:', e);
    }
    
    setUserProfile({
      email,
      name,
      role,
      walletBalance: savedBalance,
      coins: savedCoins,
      phone,
      avatar: userObj.user_metadata?.avatar || ''
    });
  };

  // Sign Up with Email and Password
  const signUp = async (email, password, name = '') => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: name || email.split('@')[0]
        }
      }
    });

    if (error) throw error;

    // Tự động đồng bộ tài khoản vừa đăng ký vào CSDL cho Admin quản lý
    try {
      await saveCloudUser({
        email,
        name: name || email.split('@')[0],
        role: 'CUSTOMER',
        created_at: new Date().toISOString()
      });
    } catch (e) {
      console.warn('signUp saveCloudUser notice:', e);
    }

    return data;
  };

  // Sign In with Email / Phone and Password (Đồng bộ đa thiết bị toàn cầu 100%)
  const signIn = async (identifier, password) => {
    const cleanInput = (identifier || '').trim().toLowerCase();
    const cleanPhoneDigits = cleanInput.replace(/\s+/g, '');

    let targetEmail = cleanInput;
    if (!cleanInput.includes('@')) {
      targetEmail = `${cleanPhoneDigits}@tqstore.vn`;
    }

    // 1. Thử đăng nhập qua Supabase Auth Cloud
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: targetEmail,
        password
      });

      if (!error && data?.user) {
        return data;
      }
    } catch (err) {
      console.warn('Supabase cloud login notice:', err?.message);
    }

    // 2. Đồng bộ CSDL Đám mây Supabase: Kiểm tra danh sách tài khoản toàn hệ thống Realtime Cloud
    try {
      const usersList = await getCloudRegisteredUsers();
      const matchUser = usersList.find((u) => {
        const uEmail = (u.email || '').trim().toLowerCase();
        const uPhone = (u.phone || '').replace(/\s+/g, '');

        const isEmailMatch = uEmail === cleanInput || uEmail === targetEmail;
        const isPhoneMatch = uPhone && uPhone === cleanPhoneDigits;
        
        // Kiểm tra mật khẩu (nếu có lưu mật khẩu trong DB hoặc khớp Supabase)
        const isPasswordMatch = !u.password || u.password === password;

        return (isEmailMatch || isPhoneMatch) && isPasswordMatch;
      });

      if (matchUser) {
        if (matchUser.is_locked) {
          throw new Error('❌ Tài khoản này đã bị Super Admin khóa an toàn. Vui lòng liên hệ Quản trị viên!');
        }

        const isSuperAdmin = 
          cleanInput.includes('admin') || 
          cleanInput === 'tqstore2212@gmail.com' || 
          matchUser.role === 'SUPER_ADMIN';

        const role = matchUser.role || (isSuperAdmin ? 'SUPER_ADMIN' : 'CUSTOMER');
        const mockUserObj = {
          id: matchUser.id || `user_${matchUser.email}`,
          email: matchUser.email,
          user_metadata: {
            full_name: matchUser.name || matchUser.email.split('@')[0],
            phone: matchUser.phone || '',
            role: role
          }
        };

        // Set state đăng nhập thành công cho tài khoản
        setUser(mockUserObj);
        setSession({ user: mockUserObj });

        setUserProfile({
          email: matchUser.email,
          name: matchUser.name || matchUser.email.split('@')[0],
          role: role,
          walletBalance: matchUser.wallet_balance || matchUser.walletBalance || 0,
          coins: matchUser.coins || 0,
          phone: matchUser.phone || '',
          avatar: ''
        });

        return { user: mockUserObj };
      }
    } catch (e) {
      console.error('getCloudRegisteredUsers signIn error:', e);
      if (e.message?.includes('khóa an toàn')) throw e;
    }

    throw new Error('❌ Email / Số điện thoại hoặc mật khẩu không chính xác!');
  };

  // Sign Out
  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) console.error("SignOut error:", error);
    setUser(null);
    setSession(null);
    setUserProfile({
      name: 'Khách hàng TQ Store',
      email: '',
      role: 'USER',
      walletBalance: 0,
      coins: 0,
      phone: '',
      avatar: ''
    });
  };

  // Update Balance or Coins and persist to localStorage per User
  const updateBalance = (newWallet, newCoins) => {
    setUserProfile(prev => {
      const updatedWallet = newWallet !== undefined ? newWallet : prev.walletBalance;
      const updatedCoins = newCoins !== undefined ? newCoins : prev.coins;

      // Lưu trữ số dư tài khoản người dùng
      if (user) {
        const userKey = `tq_user_data_${user.id || user.email}`;
        try {
          localStorage.setItem(userKey, JSON.stringify({
            walletBalance: updatedWallet,
            coins: updatedCoins
          }));
        } catch (e) {
          console.error(e);
        }
      }

      return {
        ...prev,
        walletBalance: updatedWallet,
        coins: updatedCoins
      };
    });
  };

  // Reset Password for Email
  const resetPassword = async (email) => {
    const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin
    });
    if (error) throw error;
    return data;
  };

  // System Master Control (Quản lý lệnh bật / tắt toàn hệ thống & Bảo trì)
  const [systemStatus, setSystemStatus] = useState(() => {
    try {
      const saved = localStorage.getItem('tq_system_master_status');
      return saved ? JSON.parse(saved) : {
        mode: 'ONLINE', // 'ONLINE', 'MAINTENANCE', 'PAYMENT_LOCK'
        notice: '🛠️ Hệ thống TQ Store đang bảo trì định kỳ nâng cấp máy chủ. Vui lòng quay lại sau ít phút!',
        updatedAt: new Date().toISOString()
      };
    } catch (e) {
      return { mode: 'ONLINE', notice: 'Hệ thống bảo trì', updatedAt: new Date().toISOString() };
    }
  });

  const updateSystemStatus = (newMode, newNotice) => {
    const updated = {
      mode: newMode || systemStatus.mode,
      notice: newNotice !== undefined ? newNotice : systemStatus.notice,
      updatedAt: new Date().toISOString()
    };
    setSystemStatus(updated);
    try {
      localStorage.setItem('tq_system_master_status', JSON.stringify(updated));
    } catch (e) {
      console.error(e);
    }
  };

  // Feature Control Grid (Lưới quản lý bật / tắt tính năng & phương thức toàn hệ thống)
  const [featureLocks, setFeatureLocks] = useState(() => {
    try {
      const saved = localStorage.getItem('tq_feature_locks');
      const defaultState = {
        wallet_payment: false,     // 1. Thanh Toán Ví TQ Pay
        cod_payment: false,        // 2. Thanh Toán Tiền Mặt (COD)
        vietqr_transfer: false,    // 3. Chuyển Khoản Ngân Hàng VietQR Direct
        shipping_delivery: false,  // 4. Giao Hàng Tận Nơi (Ship đơn)
        pickup_in_store: false,   // 5. Nhận Hàng Trực Tiếp Tại Shop
        tq_coins: false,           // 6. Tích Xu & Khấu Trừ Xu TQ
        fnb_ordering: false,       // 7. Đặt Món Đồ Ăn & Uống F&B
        rental_service: false,     // 8. Dịch Vụ Cho Thuê Đồ & Trang Phục
        taxi_booking: false,       // 9. Đặt Xe Taxi & Ôm Công Nghệ
        add_product: false,        // 10. Quyền Đăng Sản Phẩm Mới (Shop)
        realtime_chat: false,      // 11. Nhắn Tin Realtime Chat
        user_registration: false   // 12. Đăng Ký Tài Khoản Mới
      };
      return saved ? { ...defaultState, ...JSON.parse(saved) } : defaultState;
    } catch (e) {
      return {
        wallet_payment: false,
        cod_payment: false,
        vietqr_transfer: false,
        shipping_delivery: false,
        pickup_in_store: false,
        tq_coins: false,
        fnb_ordering: false,
        rental_service: false,
        taxi_booking: false,
        add_product: false,
        realtime_chat: false,
        user_registration: false
      };
    }
  });

  const toggleFeatureLock = (featureKey) => {
    setFeatureLocks(prev => {
      const updated = {
        ...prev,
        [featureKey]: !prev[featureKey]
      };
      try {
        localStorage.setItem('tq_feature_locks', JSON.stringify(updated));
      } catch (e) {
        console.error(e);
      }
      return updated;
    });
  };

  // Admin Impersonation Mode States (Xem màn hình tài khoản người dùng)
  const [isImpersonating, setIsImpersonating] = useState(false);
  const [originalAdminProfile, setOriginalAdminProfile] = useState(null);

  // Chuyển qua xem giao diện của bất kỳ tài khoản người dùng nào
  const impersonateUser = (targetUser) => {
    if (!originalAdminProfile && userProfile) {
      setOriginalAdminProfile(userProfile);
    }
    
    setIsImpersonating(true);
    
    // Đọc số dư ví & xu của tài khoản đó
    const userKey = `tq_user_data_${targetUser.id || targetUser.email}`;
    let savedBalance = targetUser.walletBalance || 0;
    let savedCoins = targetUser.coins || 0;
    
    try {
      const savedStr = localStorage.getItem(userKey);
      if (savedStr) {
        const parsed = JSON.parse(savedStr);
        savedBalance = Number(parsed.walletBalance || savedBalance);
        savedCoins = Number(parsed.coins || savedCoins);
      }
    } catch (e) {
      console.error('Error reading impersonated user data:', e);
    }

    setUserProfile({
      email: targetUser.email || '',
      name: targetUser.name || targetUser.email?.split('@')[0] || 'Thành viên TQ Store',
      role: targetUser.role || 'USER',
      walletBalance: savedBalance,
      coins: savedCoins,
      phone: targetUser.phone || '',
      avatar: targetUser.avatar || ''
    });
  };

  // Quay lại giao diện quản trị Super Admin Overlord
  const exitImpersonation = () => {
    if (originalAdminProfile) {
      setUserProfile(originalAdminProfile);
    } else {
      setUserProfile({
        name: 'Super Admin TQ Store',
        email: 'tqstore2212@gmail.com',
        role: 'SUPER_ADMIN',
        walletBalance: 999999999,
        coins: 999999,
        phone: '0988888888',
        avatar: ''
      });
    }
    setIsImpersonating(false);
    setOriginalAdminProfile(null);
  };

  return (
    <AuthContext.Provider value={{
      user,
      session,
      loading,
      userProfile,
      setUserProfile,
      systemStatus,
      updateSystemStatus,
      featureLocks,
      toggleFeatureLock,
      isImpersonating,
      impersonateUser,
      exitImpersonation,
      signUp,
      signIn,
      signOut,
      resetPassword,
      updateBalance
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
