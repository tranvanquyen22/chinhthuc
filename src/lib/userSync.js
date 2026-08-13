import { supabase } from './supabase';

const LOCAL_STORAGE_KEY = 'tq_registered_users';

// 1. Fetch Registered Users from Supabase Cloud DB with LocalStorage Fallback
export const getCloudRegisteredUsers = async () => {
  let cloudUsers = [];

  // 1.1 Fetch from tq_registered_users (Contains encrypted/plain credentials across devices)
  let tqUsers = [];
  try {
    const { data } = await supabase
      .from('tq_registered_users')
      .select('*')
      .order('created_at', { ascending: false });

    if (data && Array.isArray(data)) {
      tqUsers = data;
    }
  } catch (err) {
    console.warn('tq_registered_users fetch notice:', err?.message);
  }

  // 1.2 Fetch from profiles table (Auto-created via Auth Trigger)
  let profilesData = [];
  try {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });

    if (data && Array.isArray(data)) {
      profilesData = data;
    }
  } catch (e) {
    console.warn('profiles fetch notice:', e?.message);
  }

  // 1.3 Merge unique by email, preserving password & credentials from tq_registered_users
  const mergedMap = {};
  [...profilesData, ...tqUsers].forEach(u => {
    const mail = (u.email || '').trim().toLowerCase();
    if (mail) {
      mergedMap[mail] = {
        ...(mergedMap[mail] || {}),
        ...u,
        // Ensure password is not overwritten if missing
        password: u.password || mergedMap[mail]?.password || ''
      };
    }
  });

  cloudUsers = Object.values(mergedMap);

  if (cloudUsers.length > 0) {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(cloudUsers));
    return cloudUsers;
  }

  // LocalStorage Fallback
  try {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch (e) {
    return [];
  }
};

// 2. Save / Upsert User to Supabase Cloud DB & LocalStorage
export const saveCloudUser = async (userObj) => {
  const cleanEmail = (userObj.email || '').trim().toLowerCase();
  if (!cleanEmail) return;

  const payload = {
    email: cleanEmail,
    name: userObj.name || cleanEmail.split('@')[0],
    phone: userObj.phone || '',
    password: userObj.password || '',
    role: userObj.role || 'CUSTOMER',
    is_locked: !!userObj.is_locked,
    created_at: userObj.created_at || new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  // Local Storage update
  try {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
    const list = saved ? JSON.parse(saved) : [];
    const filtered = list.filter(u => u.email?.toLowerCase() !== cleanEmail);
    filtered.unshift(payload);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(filtered));
  } catch (e) {
    console.error('LocalStorage save error:', e);
  }

  // Supabase Cloud DB update (upsert into both tables for 100% sync)
  try {
    await supabase.from('tq_registered_users').upsert(payload, { onConflict: 'email' });
    await supabase.from('profiles').upsert({
      email: cleanEmail,
      name: payload.name,
      role: payload.role,
      updated_at: new Date().toISOString()
    }, { onConflict: 'email' });
  } catch (err) {
    console.warn('Supabase Cloud User Save Notice:', err?.message);
  }
};

// 3. Delete User from Supabase Cloud DB & LocalStorage
export const deleteCloudUser = async (userEmail) => {
  const cleanEmail = (userEmail || '').trim().toLowerCase();
  if (!cleanEmail) return;

  // Local Storage update
  try {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (saved) {
      const list = JSON.parse(saved);
      const filtered = list.filter(u => u.email?.toLowerCase() !== cleanEmail);
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(filtered));
    }
  } catch (e) {
    console.error(e);
  }

  // Supabase Cloud DB delete
  try {
    await supabase.from('tq_registered_users').delete().eq('email', cleanEmail);
  } catch (err) {
    console.warn('Supabase Cloud Delete Notice:', err?.message);
  }
};

// 4. Lock / Unlock User in Supabase Cloud DB & LocalStorage
export const setCloudUserLock = async (userEmail, isLocked) => {
  const cleanEmail = (userEmail || '').trim().toLowerCase();
  if (!cleanEmail) return;

  // Local Storage update
  try {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (saved) {
      const list = JSON.parse(saved);
      const updated = list.map(u => {
        if (u.email?.toLowerCase() === cleanEmail) {
          return { ...u, is_locked: isLocked };
        }
        return u;
      });
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated));
    }
  } catch (e) {
    console.error(e);
  }

  // Supabase Cloud DB update
  try {
    await supabase
      .from('tq_registered_users')
      .update({ is_locked: isLocked, updated_at: new Date().toISOString() })
      .eq('email', cleanEmail);
  } catch (err) {
    console.warn('Supabase Cloud Lock Update Notice:', err?.message);
  }
};

// 5. Update Password in Supabase Cloud DB & LocalStorage
export const setCloudUserPassword = async (userEmail, newPassword) => {
  const cleanEmail = (userEmail || '').trim().toLowerCase();
  if (!cleanEmail) return;

  // Local Storage update
  try {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (saved) {
      const list = JSON.parse(saved);
      const updated = list.map(u => {
        if (u.email?.toLowerCase() === cleanEmail) {
          return { ...u, password: newPassword };
        }
        return u;
      });
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated));
    }
  } catch (e) {
    console.error(e);
  }

  // Supabase Cloud DB update
  try {
    await supabase
      .from('tq_registered_users')
      .update({ password: newPassword, updated_at: new Date().toISOString() })
      .eq('email', cleanEmail);
  } catch (err) {
    console.warn('Supabase Cloud Password Update Notice:', err?.message);
  }
};

// =========================================================================
// 6. DỊCH VỤ YÊU CẦU KHÔI PHỤC MẬT KHẨU (PASSWORD RESET REQUESTS & ADMIN APPROVAL)
// =========================================================================
const RESET_REQUESTS_KEY = 'tq_reset_password_requests';

// Fetch Password Reset Requests
export const getCloudResetRequests = async () => {
  try {
    const { data, error } = await supabase
      .from('tq_reset_password_requests')
      .select('*')
      .order('requested_at', { ascending: false });

    if (!error && data && Array.isArray(data) && data.length > 0) {
      localStorage.setItem(RESET_REQUESTS_KEY, JSON.stringify(data));
      return data;
    }
  } catch (err) {
    console.warn('Supabase Cloud Reset Requests Notice:', err?.message);
  }

  try {
    const saved = localStorage.getItem(RESET_REQUESTS_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch (e) {
    return [];
  }
};

// Send Password Reset Request from User to Admin
export const sendPasswordResetRequest = async (email, userName = '', phone = '') => {
  const cleanEmail = (email || '').trim().toLowerCase();
  const reqObj = {
    id: `req_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    email: cleanEmail,
    name: userName || cleanEmail.split('@')[0],
    phone: phone || '',
    status: 'PENDING', // 'PENDING', 'APPROVED', 'REJECTED'
    requested_at: new Date().toISOString()
  };

  // Local Storage update
  try {
    const saved = localStorage.getItem(RESET_REQUESTS_KEY);
    const list = saved ? JSON.parse(saved) : [];
    const filtered = list.filter(r => r.email?.toLowerCase() !== cleanEmail || r.status !== 'PENDING');
    filtered.unshift(reqObj);
    localStorage.setItem(RESET_REQUESTS_KEY, JSON.stringify(filtered));
  } catch (e) {
    console.error(e);
  }

  // Supabase Cloud DB update
  try {
    await supabase.from('tq_reset_password_requests').upsert(reqObj, { onConflict: 'id' });
  } catch (err) {
    console.warn('Supabase Cloud Reset Request Send Notice:', err?.message);
  }

  return reqObj;
};

// Approve Password Reset Request by Admin
export const approveResetRequest = async (requestId, email, newPassword) => {
  const cleanEmail = (email || '').trim().toLowerCase();

  // 1. Update user's password
  await setCloudUserPassword(cleanEmail, newPassword);

  // 2. Mark request as APPROVED
  try {
    const saved = localStorage.getItem(RESET_REQUESTS_KEY);
    if (saved) {
      const list = JSON.parse(saved);
      const updated = list.map(r => {
        if (r.id === requestId || r.email?.toLowerCase() === cleanEmail) {
          return { ...r, status: 'APPROVED', newPassword: newPassword, approved_at: new Date().toISOString() };
        }
        return r;
      });
      localStorage.setItem(RESET_REQUESTS_KEY, JSON.stringify(updated));
    }
  } catch (e) {
    console.error(e);
  }

  try {
    await supabase
      .from('tq_reset_password_requests')
      .update({ status: 'APPROVED', approved_at: new Date().toISOString() })
      .or(`id.eq.${requestId},email.eq.${cleanEmail}`);
  } catch (err) {
    console.warn('Supabase Cloud Approve Notice:', err?.message);
  }
};

// Reject Password Reset Request by Admin
export const rejectResetRequest = async (requestId, email) => {
  const cleanEmail = (email || '').trim().toLowerCase();
  try {
    const saved = localStorage.getItem(RESET_REQUESTS_KEY);
    if (saved) {
      const list = JSON.parse(saved);
      const updated = list.map(r => {
        if (r.id === requestId || r.email?.toLowerCase() === cleanEmail) {
          return { ...r, status: 'REJECTED', rejected_at: new Date().toISOString() };
        }
        return r;
      });
      localStorage.setItem(RESET_REQUESTS_KEY, JSON.stringify(updated));
    }
  } catch (e) {
    console.error(e);
  }

  try {
    await supabase
      .from('tq_reset_password_requests')
      .update({ status: 'REJECTED', rejected_at: new Date().toISOString() })
      .or(`id.eq.${requestId},email.eq.${cleanEmail}`);
  } catch (err) {
    console.warn('Supabase Cloud Reject Notice:', err?.message);
  }
};

// =========================================================================
// 7. DỊCH VỤ YÊU CẦU RÚT TIỀN (WITHDRAWAL REQUESTS & ADMIN APPROVAL)
// =========================================================================
const WITHDRAWAL_REQUESTS_KEY = 'tq_withdrawal_requests';

const DEFAULT_WITHDRAWAL_REQUESTS = [
  {
    id: 'wdr_1001',
    email: 'shopdienmaytq@gmail.com',
    name: 'Gian hàng Điện Máy TQ',
    role: 'SHOP',
    amount: 15000000,
    bankName: 'MBBank (NHTM CP Quân Đội)',
    accountNumber: '0988 123 456',
    accountHolder: 'NGUYEN VAN DIEN MAY',
    status: 'PENDING',
    requested_at: new Date(Date.now() - 3600000 * 2).toISOString()
  },
  {
    id: 'wdr_1002',
    email: 'khachhang88@gmail.com',
    name: 'Trần Văn Khách',
    role: 'USER',
    amount: 2500000,
    bankName: 'Vietcombank (VCB)',
    accountNumber: '1018 889 999',
    accountHolder: 'TRAN VAN KHACH',
    status: 'PENDING',
    requested_at: new Date(Date.now() - 3600000 * 5).toISOString()
  }
];

export const getCloudWithdrawalRequests = async () => {
  try {
    const { data, error } = await supabase
      .from('tq_withdrawal_requests')
      .select('*')
      .order('requested_at', { ascending: false });

    if (!error && data && Array.isArray(data) && data.length > 0) {
      localStorage.setItem(WITHDRAWAL_REQUESTS_KEY, JSON.stringify(data));
      return data;
    }
  } catch (err) {
    console.warn('Supabase Cloud Withdrawal Requests Notice:', err?.message);
  }

  try {
    const saved = localStorage.getItem(WITHDRAWAL_REQUESTS_KEY);
    if (saved) {
      return JSON.parse(saved);
    } else {
      localStorage.setItem(WITHDRAWAL_REQUESTS_KEY, JSON.stringify(DEFAULT_WITHDRAWAL_REQUESTS));
      return DEFAULT_WITHDRAWAL_REQUESTS;
    }
  } catch (e) {
    return DEFAULT_WITHDRAWAL_REQUESTS;
  }
};

export const sendWithdrawalRequest = async (wdrObj) => {
  const cleanEmail = (wdrObj.email || '').trim().toLowerCase();
  const reqObj = {
    id: wdrObj.id || `wdr_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    email: cleanEmail,
    name: wdrObj.name || cleanEmail.split('@')[0],
    role: wdrObj.role || 'USER',
    amount: Number(wdrObj.amount) || 0,
    bankName: wdrObj.bankName || 'Ngân hàng ATM',
    accountNumber: wdrObj.accountNumber || '',
    accountHolder: wdrObj.accountHolder || '',
    status: 'PENDING',
    requested_at: new Date().toISOString()
  };

  try {
    const saved = localStorage.getItem(WITHDRAWAL_REQUESTS_KEY);
    const list = saved ? JSON.parse(saved) : [];
    list.unshift(reqObj);
    localStorage.setItem(WITHDRAWAL_REQUESTS_KEY, JSON.stringify(list));
  } catch (e) {
    console.error(e);
  }

  try {
    await supabase.from('tq_withdrawal_requests').upsert(reqObj, { onConflict: 'id' });
  } catch (err) {
    console.warn('Supabase Cloud Withdrawal Request Send Notice:', err?.message);
  }

  return reqObj;
};

export const getUserDefaultBank = (userEmail) => {
  if (!userEmail) return null;
  const cleanEmail = userEmail.trim().toLowerCase();
  try {
    const saved = localStorage.getItem(`tq_default_bank_${cleanEmail}`);
    return saved ? JSON.parse(saved) : null;
  } catch (e) {
    return null;
  }
};

export const saveUserDefaultBank = (userEmail, bankObj) => {
  if (!userEmail || !bankObj) return;
  const cleanEmail = userEmail.trim().toLowerCase();
  try {
    localStorage.setItem(`tq_default_bank_${cleanEmail}`, JSON.stringify(bankObj));
  } catch (e) {
    console.error(e);
  }
};

export const removeUserDefaultBank = (userEmail) => {
  if (!userEmail) return;
  const cleanEmail = userEmail.trim().toLowerCase();
  try {
    localStorage.removeItem(`tq_default_bank_${cleanEmail}`);
  } catch (e) {
    console.error(e);
  }
};

export const approveWithdrawalRequest = async (requestId) => {
  let targetReq = null;
  try {
    const saved = localStorage.getItem(WITHDRAWAL_REQUESTS_KEY);
    if (saved) {
      const list = JSON.parse(saved);
      const updated = list.map(r => {
        if (r.id === requestId) {
          targetReq = r;
          return { ...r, status: 'APPROVED', approved_at: new Date().toISOString() };
        }
        return r;
      });
      localStorage.setItem(WITHDRAWAL_REQUESTS_KEY, JSON.stringify(updated));
    }
  } catch (e) {
    console.error(e);
  }

  try {
    await supabase
      .from('tq_withdrawal_requests')
      .update({ status: 'APPROVED', approved_at: new Date().toISOString() })
      .eq('id', requestId);
  } catch (err) {
    console.warn('Supabase Cloud Approve Withdrawal Notice:', err?.message);
  }

  // Lock default bank account upon first successful withdrawal
  if (targetReq && targetReq.email) {
    const existingDefault = getUserDefaultBank(targetReq.email);
    if (!existingDefault) {
      saveUserDefaultBank(targetReq.email, {
        bankName: targetReq.bankName,
        accountNumber: targetReq.accountNumber,
        accountHolder: targetReq.accountHolder,
        locked_at: new Date().toISOString()
      });
    }
  }
};

export const rejectWithdrawalRequest = async (requestId) => {
  try {
    const saved = localStorage.getItem(WITHDRAWAL_REQUESTS_KEY);
    if (saved) {
      const list = JSON.parse(saved);
      const updated = list.map(r => {
        if (r.id === requestId) {
          return { ...r, status: 'REJECTED', rejected_at: new Date().toISOString() };
        }
        return r;
      });
      localStorage.setItem(WITHDRAWAL_REQUESTS_KEY, JSON.stringify(updated));
    }
  } catch (e) {
    console.error(e);
  }

  try {
    await supabase
      .from('tq_withdrawal_requests')
      .update({ status: 'REJECTED', rejected_at: new Date().toISOString() })
      .eq('id', requestId);
  } catch (err) {
    console.warn('Supabase Cloud Reject Withdrawal Notice:', err?.message);
  }
};

// =========================================================================
// 8. DỊCH VỤ YÊU CẦU NẠP TIỀN & CỘNG TIỀN VÍ (DEPOSIT REQUESTS & WALLET CREDIT)
// =========================================================================
const DEPOSIT_REQUESTS_KEY = 'tq_deposit_requests';

const DEFAULT_DEPOSIT_REQUESTS = [
  {
    id: 'dep_2001',
    email: 'khachhang99@gmail.com',
    name: 'Phạm Minh Tuấn',
    role: 'USER',
    amount: 5000000,
    paymentMethod: 'Chuyển Khoản Ngân Hàng MBBank',
    transactionCode: 'TQ992812',
    status: 'PENDING',
    requested_at: new Date(Date.now() - 3600000 * 1).toISOString()
  },
  {
    id: 'dep_2002',
    email: 'shopmoto@gmail.com',
    name: 'Gian Hàng TQ Moto',
    role: 'SHOP',
    amount: 20000000,
    paymentMethod: 'Quét Mã VNPay QR Code',
    transactionCode: 'TQ883109',
    status: 'PENDING',
    requested_at: new Date(Date.now() - 3600000 * 4).toISOString()
  }
];

export const getCloudDepositRequests = async () => {
  try {
    const { data, error } = await supabase
      .from('tq_deposit_requests')
      .select('*')
      .order('requested_at', { ascending: false });

    if (!error && data && Array.isArray(data) && data.length > 0) {
      localStorage.setItem(DEPOSIT_REQUESTS_KEY, JSON.stringify(data));
      return data;
    }
  } catch (err) {
    console.warn('Supabase Cloud Deposit Requests Notice:', err?.message);
  }

  try {
    const saved = localStorage.getItem(DEPOSIT_REQUESTS_KEY);
    if (saved) {
      return JSON.parse(saved);
    } else {
      localStorage.setItem(DEPOSIT_REQUESTS_KEY, JSON.stringify(DEFAULT_DEPOSIT_REQUESTS));
      return DEFAULT_DEPOSIT_REQUESTS;
    }
  } catch (e) {
    return DEFAULT_DEPOSIT_REQUESTS;
  }
};

export const sendDepositRequest = async (depObj) => {
  const cleanEmail = (depObj.email || '').trim().toLowerCase();
  const reqObj = {
    id: depObj.id || `dep_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    email: cleanEmail,
    name: depObj.name || cleanEmail.split('@')[0],
    role: depObj.role || 'USER',
    amount: Number(depObj.amount) || 0,
    paymentMethod: depObj.paymentMethod || 'Chuyển Khoản Ngân Hàng',
    transactionCode: depObj.transactionCode || `TQ${Math.floor(100000 + Math.random() * 900000)}`,
    status: 'PENDING',
    requested_at: new Date().toISOString()
  };

  try {
    const saved = localStorage.getItem(DEPOSIT_REQUESTS_KEY);
    const list = saved ? JSON.parse(saved) : [];
    list.unshift(reqObj);
    localStorage.setItem(DEPOSIT_REQUESTS_KEY, JSON.stringify(list));
  } catch (e) {
    console.error(e);
  }

  try {
    await supabase.from('tq_deposit_requests').upsert(reqObj, { onConflict: 'id' });
  } catch (err) {
    console.warn('Supabase Cloud Deposit Request Send Notice:', err?.message);
  }

  return reqObj;
};

// Approve Deposit Request & Automatically Credit User Wallet Balance!
export const approveDepositRequest = async (requestId, userEmail, amount) => {
  const cleanEmail = (userEmail || '').trim().toLowerCase();
  const creditAmount = Number(amount) || 0;

  // 1. Mark Deposit Request as APPROVED
  try {
    const saved = localStorage.getItem(DEPOSIT_REQUESTS_KEY);
    if (saved) {
      const list = JSON.parse(saved);
      const updated = list.map(r => {
        if (r.id === requestId) {
          return { ...r, status: 'APPROVED', approved_at: new Date().toISOString() };
        }
        return r;
      });
      localStorage.setItem(DEPOSIT_REQUESTS_KEY, JSON.stringify(updated));
    }
  } catch (e) {
    console.error(e);
  }

  try {
    await supabase
      .from('tq_deposit_requests')
      .update({ status: 'APPROVED', approved_at: new Date().toISOString() })
      .eq('id', requestId);
  } catch (err) {
    console.warn('Supabase Cloud Approve Deposit Notice:', err?.message);
  }

  // 2. Credit Amount to User Wallet Balance in Registered Users table
  try {
    const savedUsersStr = localStorage.getItem('tq_registered_users');
    if (savedUsersStr) {
      const usersList = JSON.parse(savedUsersStr);
      const updatedUsers = usersList.map(u => {
        if (u.email?.toLowerCase() === cleanEmail) {
          const currentBal = Number(u.wallet_balance) || 0;
          return { ...u, wallet_balance: currentBal + creditAmount };
        }
        return u;
      });
      localStorage.setItem('tq_registered_users', JSON.stringify(updatedUsers));
    }
  } catch (e) {
    console.error(e);
  }

  try {
    // Increment wallet balance in Supabase via RPC or Direct Update
    const { error: rpcError } = await supabase.rpc('credit_user_wallet', {
      target_email: cleanEmail,
      add_amount: creditAmount
    });

    if (rpcError) {
      const { data: userObj } = await supabase.from('tq_registered_users').select('wallet_balance').eq('email', cleanEmail).single();
      if (userObj) {
        const newBal = (Number(userObj.wallet_balance) || 0) + creditAmount;
        await supabase.from('tq_registered_users').update({ wallet_balance: newBal }).eq('email', cleanEmail);
      }
    }
  } catch (err) {
    console.warn('Supabase Cloud Credit Wallet Balance Notice:', err?.message);
  }
};

export const rejectDepositRequest = async (requestId) => {
  try {
    const saved = localStorage.getItem(DEPOSIT_REQUESTS_KEY);
    if (saved) {
      const list = JSON.parse(saved);
      const updated = list.map(r => {
        if (r.id === requestId) {
          return { ...r, status: 'REJECTED', rejected_at: new Date().toISOString() };
        }
        return r;
      });
      localStorage.setItem(DEPOSIT_REQUESTS_KEY, JSON.stringify(updated));
    }
  } catch (e) {
    console.error(e);
  }

  try {
    await supabase
      .from('tq_deposit_requests')
      .update({ status: 'REJECTED', rejected_at: new Date().toISOString() })
      .eq('id', requestId);
  } catch (err) {
    console.warn('Supabase Cloud Reject Deposit Notice:', err?.message);
  }
};

// =========================================================================
// 9. CÀI ĐẶT % PHÍ SÀN RIÊNG CHO TỪNG TÀI KHOẢN (SHOP, TAXI, CTV)
// =========================================================================
export const setCloudUserCustomFee = async (userEmail, customFeePercent) => {
  const cleanEmail = (userEmail || '').trim().toLowerCase();
  if (!cleanEmail) return;

  const feeValue = (customFeePercent !== null && customFeePercent !== undefined && customFeePercent !== '' && !isNaN(customFeePercent)) 
    ? Number(customFeePercent) 
    : null;

  // Local Storage update
  try {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (saved) {
      const list = JSON.parse(saved);
      const updated = list.map(u => {
        if (u.email?.toLowerCase() === cleanEmail) {
          return { ...u, custom_commission_fee: feeValue, updated_at: new Date().toISOString() };
        }
        return u;
      });
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated));
    }
  } catch (e) {
    console.error(e);
  }

  // Supabase Cloud DB update
  try {
    await supabase
      .from('tq_registered_users')
      .update({ custom_commission_fee: feeValue, updated_at: new Date().toISOString() })
      .eq('email', cleanEmail);
  } catch (err) {
    console.warn('Supabase Cloud Custom Fee Update Notice:', err?.message);
  }
};

// =========================================================================
// QUẢN LÝ LỊCH SỬ MUA HÀNG CỦA TẤT CẢ KHÁCH HÀNG TOÀN SÀN
// =========================================================================
const GLOBAL_ORDERS_KEY = 'tq_global_orders_history';

const DEFAULT_GLOBAL_ORDERS = [
  {
    id: 10492,
    user_email: 'nguyenvanan@gmail.com',
    user_name: 'Nguyễn Văn An',
    total_amount: 259000,
    payment_method: 'wallet',
    shipping_address: '123 Nguyễn Trãi, Q1, TP. Hồ Chí Minh',
    status: 'completed',
    created_at: '2026-08-12T15:30:00.000Z',
    items: [
      { product_name: 'Áo Sơ Mi Nam TQ Smart Oxford', price: 259000, quantity: 1, shop_name: 'TQ RETAIL SHOP' }
    ]
  },
  {
    id: 10491,
    user_email: 'tranthib@gmail.com',
    user_name: 'Trần Thị B',
    total_amount: 1200000,
    payment_method: 'wallet',
    shipping_address: 'Lấy tại cửa hàng TQ Rental Studio',
    status: 'completed',
    created_at: '2026-08-13T09:15:00.000Z',
    items: [
      { product_name: 'Váy Cưới Công Chúa Cao Cấp Lưới Xòe', price: 1200000, quantity: 1, shop_name: 'TQ RENTAL STUDIO' }
    ]
  },
  {
    id: 10490,
    user_email: 'lethi.c@gmail.com',
    user_name: 'Lê Thị C',
    total_amount: 45000,
    payment_method: 'cash',
    shipping_address: '456 Lê Lợi, Q3, TP. Hồ Chí Minh',
    status: 'completed',
    created_at: '2026-08-13T11:40:00.000Z',
    items: [
      { product_name: 'Trà Sữa TQ Matcha Macchiato Kèm Trân Châu', price: 45000, quantity: 1, shop_name: 'TQ TEA & COFFEE' }
    ]
  }
];

export const getGlobalOrdersHistory = () => {
  try {
    const saved = localStorage.getItem(GLOBAL_ORDERS_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    console.error('getGlobalOrdersHistory error:', e);
  }
  return DEFAULT_GLOBAL_ORDERS;
};

export const fetchCloudGlobalOrders = async () => {
  try {
    const { data: cloudOrders, error } = await supabase
      .from('orders')
      .select('*')
      .order('id', { ascending: false });

    if (!error && cloudOrders && Array.isArray(cloudOrders) && cloudOrders.length > 0) {
      localStorage.setItem(GLOBAL_ORDERS_KEY, JSON.stringify(cloudOrders));
      return cloudOrders;
    }
  } catch (err) {
    console.warn('Supabase Cloud Global Orders fetch notice:', err?.message);
  }
  return getGlobalOrdersHistory();
};
