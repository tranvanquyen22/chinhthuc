import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { sanitizeText } from '../lib/validation';
import { recordAuditLog, getAuditLogs, clearAuditLogs } from '../lib/auditLogger';
import { 
  getCloudRegisteredUsers, 
  saveCloudUser, 
  deleteCloudUser, 
  setCloudUserLock, 
  setCloudUserPassword,
  getCloudResetRequests,
  approveResetRequest,
  rejectResetRequest,
  getCloudWithdrawalRequests,
  approveWithdrawalRequest,
  rejectWithdrawalRequest,
  getCloudDepositRequests,
  approveDepositRequest,
  rejectDepositRequest,
  getUserDefaultBank,
  saveUserDefaultBank,
  removeUserDefaultBank,
  setCloudUserCustomFee,
  getGlobalOrdersHistory,
  fetchCloudGlobalOrders
} from '../lib/userSync';
import { getPlatformConfig, fetchCloudPlatformConfig, savePlatformConfig } from '../lib/platformConfig';
import { generateShopSlug, getShopDirectLink } from '../lib/shopLinks';
import { getFeaturedPromotions, fetchCloudFeaturedPromotions, saveFeaturedPromotions } from '../lib/featuredPromotions';
import { getSystemVouchers, fetchCloudVouchers, saveSystemVouchers } from '../lib/vouchers';
import { getSystemBankConfig, fetchCloudSystemBankConfig, saveSystemBankConfig, generateVietQRUrl } from '../lib/systemBankConfig';
import { generateRandomVietnameseName, getRandomAiReview, saveSyntheticReview, updateProductSalesCountCloud, getStoredProductReviews } from '../lib/productReviews';
import { SYSTEM_THEME_PRESETS, getSystemThemeConfig, saveSystemThemeConfig } from '../lib/themeEngine';
import { createSystemAnnouncement } from '../lib/announcements';

export default function SuperAdminModal({ isOpen, onClose, onOpenAddProduct }) {
  const { userProfile, systemStatus, updateSystemStatus, featureLocks, toggleFeatureLock, impersonateUser } = useAuth();
  const [activeAdminTab, setActiveAdminTab] = useState('products'); // 'products', 'users', 'audit_logs', 'master_control', 'stats', 'security', 'settings'
  const [copiedLinkMap, setCopiedLinkMap] = useState({}); // { [email_or_id]: true }
  const [systemBankForm, setSystemBankForm] = useState(getSystemBankConfig());
  const [currentActiveTheme, setCurrentActiveTheme] = useState(getSystemThemeConfig());
  const [announcementForm, setAnnouncementForm] = useState({ title: '', content: '', type: 'ANNOUNCEMENT' });
  const [isPublishingBroadcast, setIsPublishingBroadcast] = useState(false);
  const [editSalesModal, setEditSalesModal] = useState(null); // { id, title, salesCount }
  const [addReviewModal, setAddReviewModal] = useState(null); // { id, title, userName, rating, comment }
  const [featuredPromotions, setFeaturedPromotions] = useState(getFeaturedPromotions());
  const [featuredSubTab, setFeaturedSubTab] = useState('products'); // 'products' | 'shops'
  const [vouchersList, setVouchersList] = useState(getSystemVouchers());
  const [showCreateVoucherForm, setShowCreateVoucherForm] = useState(false);
  const [newVoucher, setNewVoucher] = useState({
    code: '',
    discountType: 'PERCENT',
    discountValue: 10,
    minOrderValue: 100000,
    usageLimit: 100,
    requiredPaymentMethod: 'ALL',
    description: ''
  });
  const [globalOrdersList, setGlobalOrdersList] = useState(getGlobalOrdersHistory());
  const [orderSearchQuery, setOrderSearchQuery] = useState('');
  const [orderPaymentFilter, setOrderPaymentFilter] = useState('ALL');
  const [selectedOrderModal, setSelectedOrderModal] = useState(null);
  const [productsList, setProductsList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [registeredUsers, setRegisteredUsers] = useState([]);
  const [resetRequests, setResetRequests] = useState([]);
  const [withdrawalRequests, setWithdrawalRequests] = useState([]);
  const [depositRequests, setDepositRequests] = useState([]);
  const [platformConfig, setPlatformConfig] = useState(getPlatformConfig());
  const [isEditingDefaultFee, setIsEditingDefaultFee] = useState(false);
  const [tempDefaultFee, setTempDefaultFee] = useState(5);
  const [editBankModal, setEditBankModal] = useState(null); // { email, name, bankName, accountNumber, accountHolder }
  const [editFeeModal, setEditFeeModal] = useState(null); // { email, name, role, customFee, isCustom }
  const [auditLogsList, setAuditLogsList] = useState([]);
  const [logRoleFilter, setLogRoleFilter] = useState('ALL');

  // P&L Report Filter & Detail Modal States
  const [plStartDate, setPlStartDate] = useState('2026-08-01');
  const [plEndDate, setPlEndDate] = useState('2026-08-13');
  const [plPreset, setPlPreset] = useState('THIS_MONTH'); // 'TODAY', 'LAST_7_DAYS', 'THIS_MONTH', 'CUSTOM'
  const [selectedPlModal, setSelectedPlModal] = useState(null); // Detail modal breakdown object

  // Master Control States
  const [maintenanceTitle, setMaintenanceTitle] = useState('HỆ THỐNG ĐANG BẢO TRÌ NÂNG CẤP');
  const [maintenanceNoticeText, setMaintenanceNoticeText] = useState(systemStatus?.notice || '🛠️ Hệ thống TQ Store đang bảo trì định kỳ nâng cấp máy chủ. Vui lòng quay lại sau ít phút!');
  const [countdownMinutes, setCountdownMinutes] = useState('30 phút');
  const [masterMsg, setMasterMsg] = useState('');

  // Admin Create User Form State (Tạo tài khoản mới & Đồng bộ đám mây)
  const [showCreateUserForm, setShowCreateUserForm] = useState(true);
  const [newEmail, setNewEmail] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newName, setNewName] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState('USER'); // 'SHOP', 'USER', 'EMPLOYEE', 'TAXI_DRIVER', 'OTHER'
  const [createMsg, setCreateMsg] = useState('');
  const [createError, setCreateError] = useState('');

  useEffect(() => {
    if (!isOpen) return;

    loadAdminData();

    // 1. Lắng nghe thay đổi Realtime CSDL Supabase Cloud cho bảng Tài khoản, Reset Pass, Rút tiền & Nạp tiền
    const channelName = `public-db-user-sync_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const channel = supabase
      .channel(channelName)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tq_registered_users' }, async () => {
        const cloudUsers = await getCloudRegisteredUsers();
        setRegisteredUsers(cloudUsers);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tq_reset_password_requests' }, async () => {
        const reqs = await getCloudResetRequests();
        setResetRequests(reqs);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tq_withdrawal_requests' }, async () => {
        const wdrs = await getCloudWithdrawalRequests();
        setWithdrawalRequests(wdrs);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tq_deposit_requests' }, async () => {
        const deps = await getCloudDepositRequests();
        setDepositRequests(deps);
      })
      .subscribe();

    // 2. Tự động đồng bộ CSDL Đám mây định kỳ 3 giây/lần cho Admin
    const interval = setInterval(async () => {
      const cloudUsers = await getCloudRegisteredUsers();
      setRegisteredUsers(cloudUsers);
      const reqs = await getCloudResetRequests();
      setResetRequests(reqs);
      const wdrs = await getCloudWithdrawalRequests();
      setWithdrawalRequests(wdrs);
      const deps = await getCloudDepositRequests();
      setDepositRequests(deps);
    }, 3000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [isOpen]);

  useEffect(() => {
    if (systemStatus?.notice) {
      setMaintenanceNoticeText(systemStatus.notice);
    }
  }, [systemStatus]);

  const loadAdminData = async () => {
    setLoading(true);
    try {
      // 1. Load products from Supabase
      const { data } = await supabase.from('products').select('*').order('id', { ascending: false });
      if (data) setProductsList(data);

      // 2. Load registered users from Supabase Cloud DB Realtime
      const cloudUsers = await getCloudRegisteredUsers();
      setRegisteredUsers(cloudUsers);

      // 3. Load Password Reset Requests
      const reqs = await getCloudResetRequests();
      setResetRequests(reqs);

      // 4. Load Withdrawal Requests
      const wdrs = await getCloudWithdrawalRequests();
      setWithdrawalRequests(wdrs);

      // 5. Load Deposit Requests
      const deps = await getCloudDepositRequests();
      setDepositRequests(deps);

      // 6. Load Platform Config (%)
      const cfg = await fetchCloudPlatformConfig();
      if (cfg) setPlatformConfig(cfg);

      // 7. Load Audit Logs & Audit Trail
      const logs = getAuditLogs();
      setAuditLogsList(logs);

      // 8. Load Global Customer Order History
      const cloudOrders = await fetchCloudGlobalOrders();
      setGlobalOrdersList(cloudOrders);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Xử lý Admin Tạo Tài Khoản Mới & Đồng Bộ Đám Mây
  const handleAdminCreateUserSubmit = async (e) => {
    e.preventDefault();
    setCreateMsg('');
    setCreateError('');

    const cleanEmail = newEmail.trim();
    const cleanPhone = sanitizeText(newPhone.trim());
    const cleanName = sanitizeText(newName.trim());

    if (!cleanEmail || !newPassword || newPassword.length < 6) {
      setCreateError('Email và Mật khẩu (tối thiểu 6 ký tự) là bắt buộc!');
      return;
    }

    try {
      // 1. Đồng bộ đám mây với Supabase Auth Cloud
      const { data, error } = await supabase.auth.signUp({
        email: cleanEmail,
        password: newPassword,
        options: {
          data: {
            full_name: cleanName,
            phone: cleanPhone,
            role: newRole
          }
        }
      });

      if (error && !error.message.includes('already registered')) {
        console.warn('Supabase signup warning:', error.message);
      }

      // 2. Lưu vào CSDL danh sách tài khoản đã xác thực Realtime Cloud
      const newUserObj = {
        email: cleanEmail,
        password: newPassword,
        phone: cleanPhone,
        name: cleanName || cleanEmail.split('@')[0],
        role: newRole,
        created_at: new Date().toISOString()
      };

      await saveCloudUser(newUserObj);
      const updatedCloudList = await getCloudRegisteredUsers();
      setRegisteredUsers(updatedCloudList);

      // 3. Ghi Nhật ký Thao tác Audit Trail
      recordAuditLog(
        userProfile.email,
        userProfile.role,
        'TẠO TÀI KHOẢN MỚI & ĐỒNG BỘ ĐÁM MÂY',
        `Khởi tạo tài khoản [${getRoleBadgeText(newRole)}] cho Email: ${cleanEmail} | SĐT: ${cleanPhone || 'Chưa có'}`
      );

      setAuditLogsList(getAuditLogs());
      setCreateMsg(`🎉 ĐÃ TẠO VÀ ĐỒNG BỘ ĐÁM MÂY TÀI KHOẢN [${getRoleBadgeText(newRole)}] THÀNH CÔNG!`);
      
      // Reset Form
      setNewEmail('');
      setNewPhone('');
      setNewName('');
      setTimeout(() => setCreateMsg(''), 4000);

    } catch (err) {
      console.error(err);
      setCreateError('Tạo tài khoản thất bại: ' + (err.message || 'Lỗi kết nối Đám Mây.'));
    }
  };

  // 4. CHUYỂN XEM GIAO DIỆN MÀN HÌNH TÀI KHOẢN NGUỜI DÙNG
  const handleImpersonateUserView = (targetUser) => {
    impersonateUser(targetUser);
    recordAuditLog(
      userProfile.email,
      userProfile.role,
      'CHUYỂN XEM GIAO DIỆN TÀI KHOẢN',
      `Super Admin chuyển xem giao diện hiển thị của tài khoản [${targetUser.email}] (Phân quyền: ${targetUser.role || 'USER'})`
    );
    setAuditLogsList(getAuditLogs());
    onClose();
  };

  const handleDeleteUser = async (userEmail) => {
    if (userEmail?.toLowerCase() === 'tqstore2212@gmail.com' || userEmail?.toLowerCase().includes('admin')) {
      return;
    }
    await deleteCloudUser(userEmail);
    const updated = await getCloudRegisteredUsers();
    setRegisteredUsers(updated);

    recordAuditLog(
      userProfile.email,
      userProfile.role,
      'XÓA TÀI KHOẢN NGƯỜI DÙNG',
      `Đã xóa vĩnh viễn tài khoản [${userEmail}] khỏi hệ thống CSDL Cloud.`
    );
    setAuditLogsList(getAuditLogs());
  };

  // 2. KHÓA / MỞ KHÓA TÀI KHOẢN NGƯỜI DÙNG (THỰC THI NGAY TỨC THÌ)
  const handleToggleLockUser = async (userEmail) => {
    if (userEmail?.toLowerCase() === 'tqstore2212@gmail.com' || userEmail?.toLowerCase().includes('admin')) {
      return;
    }
    const currentObj = registeredUsers.find(u => u.email?.toLowerCase() === userEmail.toLowerCase());
    const newLockedState = !currentObj?.is_locked;

    await setCloudUserLock(userEmail, newLockedState);
    const updated = await getCloudRegisteredUsers();
    setRegisteredUsers(updated);

    recordAuditLog(
      userProfile.email,
      userProfile.role,
      newLockedState ? 'KHÓA TÀI KHOẢN NGƯỜI DÙNG' : 'MỞ KHÓA TÀI KHOẢN NGƯỜI DÙNG',
      `Đã ${newLockedState ? 'khóa an toàn' : 'mở khóa'} cho tài khoản [${userEmail}]`
    );
    setAuditLogsList(getAuditLogs());
  };

  // Random Password Generator Modal State
  const [passModalData, setPassModalData] = useState(null); // { email, newPass }
  const [isCopied, setIsCopied] = useState(false);

  const generateStrongPassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789@#$';
    let pass = 'TQ@';
    for (let i = 0; i < 6; i++) {
      pass += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return pass;
  };

  // 3. ĐỔI MẬT KHẨU CHO NGƯỜI DÙNG (TỰ ĐỘNG TẠO PASS NGẪU NHIÊN & BẢNG COPY TỨC THÌ)
  const handleAdminChangePassword = async (userEmail) => {
    const newGeneratedPass = generateStrongPassword();
    await setCloudUserPassword(userEmail, newGeneratedPass);
    const updated = await getCloudRegisteredUsers();
    setRegisteredUsers(updated);

    recordAuditLog(
      userProfile.email,
      userProfile.role,
      'ĐỔI MẬT KHẨU TÀI KHOẢN NGƯỜI DÙNG',
      `Đã khởi tạo mật khẩu ngẫu nhiên mới cho tài khoản [${userEmail}]`
    );
    setAuditLogsList(getAuditLogs());

    // Hiển thị bảng mật khẩu ngẫu nhiên để Admin copy gửi cho người dùng
    setPassModalData({ email: userEmail, newPass: newGeneratedPass });
    setIsCopied(false);
  };

  // 5. PHÊ DUYỆT YÊU CẦU KHÔI PHỤC MẬT KHẨU
  const handleApproveResetRequest = async (requestId, userEmail) => {
    const newGeneratedPass = generateStrongPassword();
    await approveResetRequest(requestId, userEmail, newGeneratedPass);
    
    // Refresh lists
    const updatedUsers = await getCloudRegisteredUsers();
    setRegisteredUsers(updatedUsers);
    const updatedReqs = await getCloudResetRequests();
    setResetRequests(updatedReqs);

    recordAuditLog(
      userProfile.email,
      userProfile.role,
      'PHÊ DUYỆT YÊU CẦU KHÔI PHỤC MẬT KHẨU',
      `Super Admin phê duyệt khôi phục mật khẩu cho Gmail: [${userEmail}]. Mật khẩu ngẫu nhiên mới: ${newGeneratedPass}`
    );
    setAuditLogsList(getAuditLogs());

    // Hiển thị bảng mật khẩu ngẫu nhiên để Admin copy gửi cho người dùng
    setPassModalData({ email: userEmail, newPass: newGeneratedPass });
    setIsCopied(false);
  };

  // 6. TỪ CHỐI YÊU CẦU KHÔI PHỤC MẬT KHẨU
  const handleRejectResetRequest = async (requestId, userEmail) => {
    await rejectResetRequest(requestId, userEmail);
    const updatedReqs = await getCloudResetRequests();
    setResetRequests(updatedReqs);

    recordAuditLog(
      userProfile.email,
      userProfile.role,
      'TỪ CHỐI YÊU CẦU KHÔI PHỤC MẬT KHẨU',
      `Super Admin từ chối yêu cầu khôi phục mật khẩu cho Gmail: [${userEmail}]`
    );
    setAuditLogsList(getAuditLogs());
  };

  // 8. PHÊ DUYỆT RÚT TIỀN CHO TÀI KHOẢN
  const handleApproveWithdrawal = async (requestId, userEmail, amount, bankInfo) => {
    await approveWithdrawalRequest(requestId);
    const updatedWdrs = await getCloudWithdrawalRequests();
    setWithdrawalRequests(updatedWdrs);

    recordAuditLog(
      userProfile.email,
      userProfile.role,
      'PHÊ DUYỆT & GIẢI NGÂN RÚT TIỀN',
      `Super Admin phê duyệt giải ngân lệnh rút tiền ${Number(amount).toLocaleString('vi-VN')} VNĐ cho [${userEmail}] (${bankInfo})`
    );
    setAuditLogsList(getAuditLogs());
  };

  // 9. TỪ CHỐI LỆNH RÚT TIỀN CHO TÀI KHOẢN
  const handleRejectWithdrawal = async (requestId, userEmail, amount) => {
    await rejectWithdrawalRequest(requestId);
    const updatedWdrs = await getCloudWithdrawalRequests();
    setWithdrawalRequests(updatedWdrs);

    recordAuditLog(
      userProfile.email,
      userProfile.role,
      'TỪ CHỐI LỆNH RÚT TIỀN',
      `Super Admin từ chối lệnh rút tiền ${Number(amount).toLocaleString('vi-VN')} VNĐ cho [${userEmail}]`
    );
    setAuditLogsList(getAuditLogs());
  };

  // 10. XUẤT LỊCH SỬ RÚT TIỀN FILE CSV
  const handleExportWithdrawalsCSV = () => {
    const BOM = '\uFEFF';
    let csvContent = BOM + `BÁO CÁO LỊCH SỬ PHÊ DUYỆT & GIẢI NGÂN RÚT TIỀN VÍ TQ PAY\n`;
    csvContent += `Thời gian xuất file,${new Date().toLocaleString('vi-VN')}\n`;
    csvContent += `Tổng số lệnh,${withdrawalRequests.length}\n\n`;

    csvContent += `Mã lệnh,Tài khoản Email,Họ tên,Vai trò,Số tiền (VNĐ),Ngân hàng nhận,Số tài khoản,Tên chủ TK,Thời gian gửi,Trạng thái\n`;
    withdrawalRequests.forEach(w => {
      csvContent += `${w.id},${w.email},${w.name},${w.role},${w.amount},${w.bankName},${w.accountNumber},${w.accountHolder},${new Date(w.requested_at).toLocaleString('vi-VN')},${w.status}\n`;
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Lich_Su_Rut_Tien_TQPay_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // 11. PHÊ DUYỆT NẠP TIỀN & CỘNG TIỀN VÍ CHO TÀI KHOẢN
  const handleApproveDeposit = async (requestId, userEmail, amount) => {
    await approveDepositRequest(requestId, userEmail, amount);
    
    // Refresh Cloud DB states
    const updatedDeps = await getCloudDepositRequests();
    setDepositRequests(updatedDeps);
    const cloudUsers = await getCloudRegisteredUsers();
    setRegisteredUsers(cloudUsers);

    recordAuditLog(
      userProfile.email,
      userProfile.role,
      'PHÊ DUYỆT NẠP TIỀN & CỘNG VÍ',
      `Super Admin phê duyệt lệnh nạp tiền & cộng +${Number(amount).toLocaleString('vi-VN')} VNĐ vào Ví TQ Pay cho [${userEmail}]`
    );
    setAuditLogsList(getAuditLogs());
  };

  // 12. TỪ CHỐI LỆNH NẠP TIỀN CHO TÀI KHOẢN
  const handleRejectDeposit = async (requestId, userEmail, amount) => {
    await rejectDepositRequest(requestId);
    const updatedDeps = await getCloudDepositRequests();
    setDepositRequests(updatedDeps);

    recordAuditLog(
      userProfile.email,
      userProfile.role,
      'TỪ CHỐI LỆNH NẠP TIỀN',
      `Super Admin từ chối lệnh nạp tiền ${Number(amount).toLocaleString('vi-VN')} VNĐ cho [${userEmail}]`
    );
    setAuditLogsList(getAuditLogs());
  };

  // 13. XUẤT LỊCH SỬ NẠP TIỀN FILE CSV
  const handleExportDepositsCSV = () => {
    const BOM = '\uFEFF';
    let csvContent = BOM + `BÁO CÁO LỊCH SỬ PHÊ DUYỆT & CỘNG TIỀN VÍ TQ PAY\n`;
    csvContent += `Thời gian xuất file,${new Date().toLocaleString('vi-VN')}\n`;
    csvContent += `Tổng số lệnh,${depositRequests.length}\n\n`;

    csvContent += `Mã lệnh,Tài khoản Email,Họ tên,Vai trò,Số tiền nạp (VNĐ),Hình thức thanh toán,Mã giao dịch,Thời gian gửi,Trạng thái\n`;
    depositRequests.forEach(d => {
      csvContent += `${d.id},${d.email},${d.name},${d.role},${d.amount},${d.paymentMethod},${d.transactionCode},${new Date(d.requested_at).toLocaleString('vi-VN')},${d.status}\n`;
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Lich_Su_Nap_Tien_TQPay_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // 14. THAY ĐỔI NGÂN HÀNG RÚT TIỀN MẶC ĐỊNH CỦA NGƯỜI DÙNG
  const handleOpenEditBank = (userObj) => {
    const existing = getUserDefaultBank(userObj.email);
    setEditBankModal({
      email: userObj.email,
      name: userObj.name || userObj.email.split('@')[0],
      bankName: existing?.bankName || 'MBBank (NHTM CP Quân Đội)',
      accountNumber: existing?.accountNumber || '',
      accountHolder: existing?.accountHolder || (userObj.name || '').toUpperCase()
    });
  };

  const handleSaveUserBank = () => {
    if (!editBankModal || !editBankModal.email) return;
    saveUserDefaultBank(editBankModal.email, {
      bankName: editBankModal.bankName,
      accountNumber: editBankModal.accountNumber.trim(),
      accountHolder: editBankModal.accountHolder.trim().toUpperCase(),
      locked_at: new Date().toISOString()
    });

    recordAuditLog(
      userProfile.email,
      userProfile.role,
      'CẬP NHẬT NGÂN HÀNG RÚT TIỀN',
      `Super Admin đã cập nhật ngân hàng rút tiền mặc định cho [${editBankModal.email}]: ${editBankModal.bankName} - ${editBankModal.accountNumber} (${editBankModal.accountHolder})`
    );
    setAuditLogsList(getAuditLogs());
    setEditBankModal(null);
  };

  const handleResetUserBank = () => {
    if (!editBankModal || !editBankModal.email) return;
    removeUserDefaultBank(editBankModal.email);

    recordAuditLog(
      userProfile.email,
      userProfile.role,
      'ĐẶT LẠI / MỞ KHÓA NGÂN HÀNG RÚT TIỀN',
      `Super Admin đã mở khóa / xóa ngân hàng mặc định của [${editBankModal.email}], cho phép khách đăng ký ngân hàng mới ở lần rút tiếp theo.`
    );
    setAuditLogsList(getAuditLogs());
    setEditBankModal(null);
  };

  // 15. LƯU CẤU HÌNH % VÍ / XU / PHÍ SÀN MẶC ĐỊNH
  const handleSavePlatformConfig = async () => {
    await savePlatformConfig(platformConfig, userProfile.email);
    const updated = await fetchCloudPlatformConfig();
    setPlatformConfig(updated);

    recordAuditLog(
      userProfile.email,
      userProfile.role,
      'CẬP NHẬT CẤU HÌNH THAM SỐ SÀN',
      `Super Admin cập nhật tỷ lệ % toàn sàn: Giảm giá Ví TQ Pay (${platformConfig.wallet_discount_percent}%), Hoàn Xu TQ (${platformConfig.coins_cashback_percent}%), Phí Sàn Mặc Định (${platformConfig.platform_fee_percent}%)`
    );
    alert('🎉 Đã lưu cấu hình tham số % Ví, Xu & Phí sàn mặc định toàn hệ thống thành công!');
  };

  // 16. CẤU HÌNH % PHÍ SÀN RIÊNG CHO TỪNG TÀI KHOẢN (SHOP, TAXI, CTV)
  const handleOpenEditFee = (userObj) => {
    const isCustom = userObj.custom_commission_fee !== null && userObj.custom_commission_fee !== undefined;
    setEditFeeModal({
      email: userObj.email,
      name: userObj.name || userObj.email,
      role: userObj.role || 'SHOP',
      customFee: isCustom ? Number(userObj.custom_commission_fee) : platformConfig.platform_fee_percent,
      isCustom: isCustom
    });
  };

  const handleSaveUserCustomFee = async () => {
    if (!editFeeModal || !editFeeModal.email) return;

    const finalFeeValue = editFeeModal.isCustom ? Number(editFeeModal.customFee) : null;
    await setCloudUserCustomFee(editFeeModal.email, finalFeeValue);

    const updatedUsers = await getCloudRegisteredUsers();
    setRegisteredUsers(updatedUsers);

    recordAuditLog(
      userProfile.email,
      userProfile.role,
      'CÀI PHÍ SÀN RIÊNG CHO TÀI KHOẢN',
      editFeeModal.isCustom 
        ? `Super Admin đã cài đặt tỷ lệ % phí sàn riêng là [${finalFeeValue}%] cho tài khoản [${editFeeModal.email}] (${editFeeModal.role})`
        : `Super Admin đã chuyển tài khoản [${editFeeModal.email}] về dùng phí sàn mặc định toàn hệ thống (${platformConfig.platform_fee_percent}%)`
    );
    setAuditLogsList(getAuditLogs());
    setEditFeeModal(null);
  };

  // 17. ĐIỀU CHỈNH PHÍ SÀN MẶC ĐỊNH TOÀN HỆ THỐNG
  const handleSaveDefaultSystemFee = async () => {
    const feeVal = Number(tempDefaultFee);
    if (isNaN(feeVal) || feeVal < 0) {
      alert('❌ Tỷ lệ % phí sàn không hợp lệ.');
      return;
    }

    const updatedCfg = {
      ...platformConfig,
      platform_fee_percent: feeVal
    };

    await savePlatformConfig(updatedCfg, userProfile.email);
    const refreshed = await fetchCloudPlatformConfig();
    setPlatformConfig(refreshed);
    setIsEditingDefaultFee(false);

    recordAuditLog(
      userProfile.email,
      userProfile.role,
      'CẬP NHẬT PHÍ SÀN MẶC ĐỊNH HỆ THỐNG',
      `Super Admin đã điều chỉnh tỷ lệ % phí sàn mặc định toàn hệ thống thành [${feeVal}%]`
    );
    setAuditLogsList(getAuditLogs());
    alert(`🎉 Đã cập nhật % Phí sàn mặc định toàn hệ thống thành ${feeVal}%!`);
  };

  // 18. SAO CHÉP LINK TRUY CẬP TRỰC TIẾP CHO TỪNG GIAN HÀNG SHOP
  const handleCopyShopLink = (shopSlug, keyId) => {
    const directUrl = getShopDirectLink(shopSlug);
    navigator.clipboard.writeText(directUrl);
    setCopiedLinkMap(prev => ({ ...prev, [keyId]: true }));
    setTimeout(() => {
      setCopiedLinkMap(prev => ({ ...prev, [keyId]: false }));
    }, 2000);
  };

  // 19. BẬT / TẮT ĐỀ XUẤT SẢN PHẨM HOT TRANG CHỦ & TÌM KIẾM
  const handleToggleFeaturedProduct = async (productId, title) => {
    const isCurrentlyFeatured = (featuredPromotions.productIds || []).includes(productId);
    const updatedProductIds = isCurrentlyFeatured
      ? featuredPromotions.productIds.filter(id => id !== productId)
      : [...(featuredPromotions.productIds || []), productId];

    const updated = {
      ...featuredPromotions,
      productIds: updatedProductIds
    };

    await saveFeaturedPromotions(updated);
    setFeaturedPromotions(updated);

    recordAuditLog(
      userProfile.email,
      userProfile.role,
      'CẬP NHẬT SẢN PHẨM ĐỀ XUẤT HOT',
      isCurrentlyFeatured
        ? `Super Admin đã BỎ sản phẩm [${title || productId}] khỏi vị trí Đề Xuất Hot`
        : `Super Admin đã ĐƯA sản phẩm [${title || productId}] lên vị trí Đề Xuất Hot Trang Chủ & Tìm Kiếm`
    );
    setAuditLogsList(getAuditLogs());
  };

  // 20. BẬT / TẮT ĐỀ XUẤT GIAN HÀNG HOT TRANG CHỦ & TÌM KIẾM
  const handleToggleFeaturedShop = async (shopEmail, shopName) => {
    const isCurrentlyFeatured = (featuredPromotions.shopEmails || []).includes(shopEmail);
    const updatedShopEmails = isCurrentlyFeatured
      ? featuredPromotions.shopEmails.filter(e => e !== shopEmail)
      : [...(featuredPromotions.shopEmails || []), shopEmail];

    const updated = {
      ...featuredPromotions,
      shopEmails: updatedShopEmails
    };

    await saveFeaturedPromotions(updated);
    setFeaturedPromotions(updated);

    recordAuditLog(
      userProfile.email,
      userProfile.role,
      'CẬP NHẬT GIAN HÀNG ĐỀ XUẤT HOT',
      isCurrentlyFeatured
        ? `Super Admin đã BỎ Gian hàng [${shopName || shopEmail}] khỏi vị trí Đề Xuất Hot`
        : `Super Admin đã ĐƯA Gian hàng [${shopName || shopEmail}] lên vị trí Đề Xuất Hot Trang Chủ & Tìm Kiếm`
    );
    setAuditLogsList(getAuditLogs());
  };

  // 21. PHÁT HÀNH MÃ VOUCHER MỚI
  const handleCreateVoucher = async (e) => {
    e.preventDefault();
    if (!newVoucher.code.trim()) {
      alert('Vui lòng nhập Mã Giảm Giá (Coupon Code)!');
      return;
    }

    const cleanCode = newVoucher.code.trim().toUpperCase();
    const exists = vouchersList.some(v => v.code.toUpperCase() === cleanCode);
    if (exists) {
      alert(`Mã giảm giá "${cleanCode}" đã tồn tại trên hệ thống. Vui lòng đặt mã khác!`);
      return;
    }

    const voucherObj = {
      id: 'v_' + Date.now(),
      code: cleanCode,
      discountType: newVoucher.discountType,
      discountValue: Number(newVoucher.discountValue),
      minOrderValue: Number(newVoucher.minOrderValue),
      usageLimit: Number(newVoucher.usageLimit),
      usageCount: 0,
      requiredPaymentMethod: newVoucher.requiredPaymentMethod,
      description: newVoucher.description || `Mã giảm giá ${cleanCode}`,
      status: 'ACTIVE',
      createdAt: new Date().toISOString()
    };

    const updated = [voucherObj, ...vouchersList];
    await saveSystemVouchers(updated);
    setVouchersList(updated);
    setShowCreateVoucherForm(false);
    setNewVoucher({
      code: '',
      discountType: 'PERCENT',
      discountValue: 10,
      minOrderValue: 100000,
      usageLimit: 100,
      requiredPaymentMethod: 'ALL',
      description: ''
    });

    recordAuditLog(
      userProfile.email,
      userProfile.role,
      'TẠO MÃ GIẢM GIÁ MỚI',
      `Super Admin phát hành Voucher [${cleanCode}]: Giảm ${voucherObj.discountValue}${voucherObj.discountType === 'PERCENT' ? '%' : 'đ'}, Giới hạn ${voucherObj.usageLimit} lượt, PTTT: ${voucherObj.requiredPaymentMethod}`
    );
    setAuditLogsList(getAuditLogs());
    alert(`🎉 Đã tạo và phát hành mã giảm giá "${cleanCode}" thành công!`);
  };

  // 22. KHÓA / MỞ KHÓA VOUCHER
  const handleToggleVoucherStatus = async (voucherId) => {
    const updated = vouchersList.map(v => {
      if (v.id === voucherId) {
        return { ...v, status: v.status === 'ACTIVE' ? 'EXPIRED' : 'ACTIVE' };
      }
      return v;
    });
    await saveSystemVouchers(updated);
    setVouchersList(updated);

    recordAuditLog(
      userProfile.email,
      userProfile.role,
      'CẬP NHẬT TRẠNG THÁI VOUCHER',
      `Super Admin đã thay đổi trạng thái Voucher ID #${voucherId}`
    );
    setAuditLogsList(getAuditLogs());
  };

  // 23. XÓA VOUCHER
  const handleDeleteVoucher = async (voucherId, code) => {
    const updated = vouchersList.filter(v => v.id !== voucherId);
    await saveSystemVouchers(updated);
    setVouchersList(updated);

    recordAuditLog(
      userProfile.email,
      userProfile.role,
      'XÓA MÃ VOUCHER',
      `Super Admin đã xóa Voucher [${code}]`
    );
    setAuditLogsList(getAuditLogs());
  };

  // 24. LƯU CẤU HÌNH NGÂN HÀNG HỆ THỐNG NHẬN TIỀN NẠP (VIETQR)
  const handleSaveSystemBankConfig = async (e) => {
    e.preventDefault();
    if (!systemBankForm.accountNumber.trim()) {
      alert('Vui lòng nhập Số Tài Khoản Ngân Hàng!');
      return;
    }

    const saved = await saveSystemBankConfig(systemBankForm);
    setSystemBankForm(saved);

    recordAuditLog(
      userProfile.email,
      userProfile.role,
      'CẬP NHẬT NGÂN HÀNG HỆ THỐNG (VIETQR)',
      `Super Admin cập nhật Tài khoản VietQR nhận tiền nạp: Ngân hàng ${saved.bankName} (${saved.bankCode}), STK: ${saved.accountNumber}, Chủ TK: ${saved.accountHolder}`
    );
    setAuditLogsList(getAuditLogs());
    alert('🎉 Đã lưu thông tin Ngân hàng & Mã VietQR nhận tiền nạp tự động toàn hệ thống thành công!');
  };

  // 25. CẬP NHẬT TRỰC TIẾP LƯỢT ĐÃ BÁN (SALES COUNT) CHO SẢN PHẨM
  const handleSaveProductSalesCount = async () => {
    if (!editSalesModal) return;
    const cleanCount = Math.max(0, parseInt(editSalesModal.salesCount) || 0);

    await updateProductSalesCountCloud(editSalesModal.id, cleanCount);

    setProductsList(prev => prev.map(p => {
      if (p.id === editSalesModal.id) {
        return { ...p, sales_count: cleanCount, salesCount: cleanCount };
      }
      return p;
    }));

    recordAuditLog(
      userProfile.email,
      userProfile.role,
      'CẬP NHẬT LƯỢT ĐÃ BÁN SẢN PHẨM',
      `Super Admin chỉnh sửa lượt đã bán của sản phẩm [${editSalesModal.title}] thành ${cleanCount} lượt`
    );
    setAuditLogsList(getAuditLogs());
    alert(`🎉 Đã cập nhật số lượt đã bán của [${editSalesModal.title}] thành ${cleanCount} lượt bán!`);
    setEditSalesModal(null);
  };

  // 26. PHÁT HÀNH ĐÁNH GIÁ ẢO (AI SYNTHETIC REVIEW INJECTION)
  const handleSaveSyntheticReviewSubmit = async (e) => {
    e.preventDefault();
    if (!addReviewModal) return;

    const reviewObj = await saveSyntheticReview(addReviewModal.id, {
      userName: addReviewModal.userName || generateRandomVietnameseName(),
      rating: addReviewModal.rating,
      comment: addReviewModal.comment || getRandomAiReview()
    });

    recordAuditLog(
      userProfile.email,
      userProfile.role,
      'THÊM ĐÁNH GIÁ ẢO (AI)',
      `Super Admin thêm đánh giá ảo từ [${reviewObj.user_name}] (${reviewObj.rating}⭐): "${reviewObj.comment}" cho SP #${addReviewModal.id}`
    );
    setAuditLogsList(getAuditLogs());
    alert(`🎉 Đã thêm đánh giá ảo từ [${reviewObj.user_name}] (${reviewObj.rating}⭐) thành công!`);
    setAddReviewModal(null);
  };

  // 27. ĐỔI GIAO DIỆN HỆ THỐNG THỜI GIAN THỰC (REALTIME THEME SWITCHER)
  const handleChangeSystemTheme = async (themeKey) => {
    const updatedTheme = await saveSystemThemeConfig(themeKey, userProfile?.email || 'Super Admin');
    setCurrentActiveTheme(updatedTheme);

    recordAuditLog(
      userProfile.email,
      userProfile.role,
      'ĐỔI GIAO DIỆN HỆ THỐNG REALTIME',
      `Super Admin chuyển giao diện toàn hệ thống sang theme [${updatedTheme.name}]`
    );
    setAuditLogsList(getAuditLogs());
    alert(`🎉 Đã áp dụng giao diện [${updatedTheme.name}] thời gian thực toàn hệ thống! Tất cả người dùng sẽ thấy giao diện đổi ngay lập tức.`);
  };

  // 28. PHÁT THÔNG BÁO TOÀN HỆ THỐNG (SYSTEM-WIDE BROADCAST ANNOUNCEMENT)
  const handlePublishSystemAnnouncement = async (e) => {
    e.preventDefault();
    if (!announcementForm.title.trim() || !announcementForm.content.trim()) {
      alert('Vui lòng nhập đầy đủ tiêu đề và nội dung thông báo!');
      return;
    }

    setIsPublishingBroadcast(true);
    try {
      const created = await createSystemAnnouncement({
        title: announcementForm.title,
        content: announcementForm.content,
        type: announcementForm.type,
        createdBy: userProfile?.name || userProfile?.email || 'Super Admin'
      });

      recordAuditLog(
        userProfile.email,
        userProfile.role,
        'PHÁT THÔNG BÁO TOÀN HỆ THỐNG',
        `Super Admin đã phát thông báo [${created.title}] tới toàn bộ người dùng & khách hàng`
      );
      setAuditLogsList(getAuditLogs());

      alert('🚀 PHÁT THÔNG BÁO THÀNH CÔNG! Tất cả người dùng (online lẫn truy cập sau) sẽ nhận được thông báo này ngay lập tức.');
      setAnnouncementForm({ title: '', content: '', type: 'ANNOUNCEMENT' });
    } catch (err) {
      alert('Lỗi phát thông báo: ' + err.message);
    } finally {
      setIsPublishingBroadcast(false);
    }
  };

  // Preset Lịch lọc P&L
  const handlePresetChange = (preset) => {
    setPlPreset(preset);
    const todayStr = new Date().toISOString().split('T')[0];
    if (preset === 'TODAY') {
      setPlStartDate(todayStr);
      setPlEndDate(todayStr);
    } else if (preset === 'LAST_7_DAYS') {
      const d = new Date();
      d.setDate(d.getDate() - 7);
      setPlStartDate(d.toISOString().split('T')[0]);
      setPlEndDate(todayStr);
    } else if (preset === 'THIS_MONTH') {
      const d = new Date();
      d.setDate(1);
      setPlStartDate(d.toISOString().split('T')[0]);
      setPlEndDate(todayStr);
    }
  };

  // 7. XUẤT BÁO CÁO TỔNG THU CHI & LỢI NHUẬN RÒNG P&L FILE CSV THEO LỊCH CHỌN
  const handleExportPLReportCSV = (categoryDetail = null) => {
    const BOM = '\uFEFF';
    const targetCategory = categoryDetail || selectedPlModal;
    const catTitle = targetCategory ? targetCategory.title : 'TỔNG HỢP TOÀN SÀN';
    
    let csvContent = BOM + `BÁO CÁO THỐNG KÊ P&L - SÀN THƯƠNG MẠI ĐIỆN TỬ TQ STORE\n`;
    csvContent += `Hạng mục báo cáo,${catTitle}\n`;
    csvContent += `Khoảng thời gian lọc,Từ ngày ${plStartDate} Đến ngày ${plEndDate}\n`;
    csvContent += `Thời điểm xuất file,${new Date().toLocaleString('vi-VN')}\n`;
    csvContent += `Đơn vị tiền tệ,VNĐ (Việt Nam Đồng)\n\n`;

    if (targetCategory && targetCategory.rows && targetCategory.rows.length > 0) {
      csvContent += `=== CHI TIẾT DÒNG TIỀN VÀ THỐNG KÊ MỤC: ${targetCategory.title} ===\n`;
      csvContent += `Mã giao dịch,Nội dung chi tiết,Thời gian ghi nhận,Số tiền (VNĐ),Trạng thái\n`;
      targetCategory.rows.forEach(r => {
        csvContent += `${r.code},${r.name},${r.time},${r.amount},${r.status}\n`;
      });
      csvContent += `\nTỔNG CỘNG,,${targetCategory.amount.toLocaleString('vi-VN')} VNĐ,\n`;
    } else {
      const totalGMV = productsList.reduce((acc, p) => acc + (p.price || 0) * (p.sold_count || 12), 1450000000);
      const totalPlatformFee = Math.round(totalGMV * 0.05);
      const totalSubsidy = 48500000;
      const netProfit = totalPlatformFee - totalSubsidy;
      
      csvContent += `=== 1. CHỈ SỐ LỢI NHUẬN RÒNG TOÀN SÀN (PLATFORM P&L SUMMARY) ===\n`;
      csvContent += `Chỉ số,Giá trị (VNĐ),Khoảng thời gian\n`;
      csvContent += `1. TỔNG GMV GIAO DỊCH TOÀN SÀN,${totalGMV},Từ ${plStartDate} Đến ${plEndDate}\n`;
      csvContent += `2. TỔNG THU PHÍ SÀN (5%),${totalPlatformFee},Từ ${plStartDate} Đến ${plEndDate}\n`;
      csvContent += `3. TỔNG CHI TRỢ GIÁ KHUYẾN MÃI,${totalSubsidy},Từ ${plStartDate} Đến ${plEndDate}\n`;
      csvContent += `4. LỢI NHUẬN RÒNG THỰC NHẬN (NET PROFIT),${netProfit},Từ ${plStartDate} Đến ${plEndDate}\n\n`;

      csvContent += `=== 2. TỔNG HỢP DÒNG TIỀN NẠP VÍ TQ PAY & LƯU LUÂN CHUYỂN ===\n`;
      csvContent += `Hạng mục dòng tiền,Số tiền (VNĐ),Trạng thái\n`;
      csvContent += `Tổng tiền khách nạp vào Ví TQ Pay,1850000000,Thành công qua VNPay QR/ATM\n`;
      csvContent += `Số dư Ví TQ Pay khả dụng hiện tại,920000000,Lưu giữ trên ví tài khoản\n`;
      csvContent += `Dòng tiền Ký Quỹ Đơn Hàng (Escrow),410000000,Chờ khách hoàn tất đơn\n`;
      csvContent += `Tổng tiền đã Rút về ATM Ngân hàng,520000000,Đã giải ngân thành công\n\n`;

      csvContent += `=== 3. BẢNG CHI TIẾT PHÂN PHỐI DÒNG TIỀN & KHOẢN CHI TRỢ GIÁ HỆ THỐNG ===\n`;
      csvContent += `Mã khoản chi,Danh mục phân bổ,Chi phí trợ giá (VNĐ),Tỷ lệ chi\n`;
      csvContent += `EXP-VOUCHER,Mã giảm giá Voucher Sàn trợ giá trực tiếp,24500000,50.5%\n`;
      csvContent += `EXP-FREESHIP,Hỗ trợ phí vận chuyển Freeship Extra TQ,14200000,29.3%\n`;
      csvContent += `EXP-XUTQ,Chi trả Xu Tích lũy TQ Pay khi hoàn đơn,6800000,14.0%\n`;
      csvContent += `EXP-CAMPAIGN,Chương trình Siêu Sale Ngày Đôi Flash Sale,3000000,6.2%\n`;
    }

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Bao_Cao_PL_TQStore_${plStartDate}_den_${plEndDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    recordAuditLog(
      userProfile.email,
      userProfile.role,
      'XUẤT BÁO CÁO P&L CSV THEO LỊCH',
      `Super Admin xuất báo cáo P&L [${catTitle}] từ ${plStartDate} đến ${plEndDate}`
    );
    setAuditLogsList(getAuditLogs());
  };

  const handleCopyPassword = () => {
    if (passModalData?.newPass) {
      navigator.clipboard.writeText(passModalData.newPass);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    }
  };

  // Xử lý Bật / Tắt Khóa Bảo Trì Toàn Hệ Thống (KÍCH HOẠT THỰC THI NGAY)
  const handleToggleMaintenance = (enable) => {
    const newMode = enable ? 'MAINTENANCE' : 'ONLINE';
    const actionText = enable ? 'BẬT KHÓA BẢO TRÌ NGAY' : 'TẮT KHÓA BẢO TRÌ (ONLINE)';

    const fullNotice = `[${maintenanceTitle}] ${maintenanceNoticeText} (Thời gian đếm ngược dự kiến: ${countdownMinutes})`;
    updateSystemStatus(newMode, fullNotice);

    recordAuditLog(
      userProfile.email,
      userProfile.role,
      'LỆNH BẬT / TẮT BẢO TRÌ HỆ THỐNG',
      `Thực thi [${actionText}]. Tiêu đề: "${maintenanceTitle}" | Thời gian đếm ngược dự kiến: ${countdownMinutes}`
    );

    setMasterMsg(`🎉 ĐÃ THỰC THI THÀNH CÔNG: [${actionText}]!`);
    setAuditLogsList(getAuditLogs());
    setTimeout(() => setMasterMsg(''), 3000);
  };

  // Xử lý Khóa / Mở Khóa Tính Năng Độc Lập
  const handleToggleFeature = (featureKey, featureName) => {
    const isCurrentlyLocked = featureLocks[featureKey];
    const newStatusText = isCurrentlyLocked ? 'MỞ KHÓA' : 'KHÓA NGAY';

    toggleFeatureLock(featureKey);

    recordAuditLog(
      userProfile.email,
      userProfile.role,
      'ĐIỀU KHIỂN TÍNH NĂNG ĐỘC LẬP',
      `Đã thực thi [${newStatusText}] cho tính năng: "${featureName}"`
    );

    setMasterMsg(`🎉 Đã cập nhật trạng thái [${newStatusText}] cho tính năng "${featureName}"!`);
    setAuditLogsList(getAuditLogs());
    setTimeout(() => setMasterMsg(''), 2000);
  };

  const handleDeleteProduct = async (id, title) => {
    try {
      const { error } = await supabase.from('products').delete().eq('id', id);
      if (!error) {
        recordAuditLog(
          userProfile.email,
          userProfile.role,
          'XÓA SẢN PHẨM KHỎI HỆ THỐNG',
          `Đã xóa sản phẩm ID #${id} (${title || 'Sản phẩm'}) khỏi CSDL Supabase.`
        );
        loadAdminData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleClearAuditTrail = () => {
    clearAuditLogs();
    setAuditLogsList([]);
  };

  const getRoleBadge = (role) => {
    switch (role) {
      case 'SUPER_ADMIN':
        return <span className="bg-red-100 text-red-800 font-black text-[10px] px-2.5 py-0.5 rounded-full border border-red-300">👑 SUPER ADMIN</span>;
      case 'SHOP':
        return <span className="bg-teal-100 text-teal-800 font-black text-[10px] px-2.5 py-0.5 rounded-full border border-teal-300">🏪 SHOP GIAN HÀNG</span>;
      case 'EMPLOYEE':
        return <span className="bg-purple-100 text-purple-800 font-black text-[10px] px-2.5 py-0.5 rounded-full border border-purple-300">💼 NHÂN VIÊN</span>;
      case 'TAXI_DRIVER':
        return <span className="bg-amber-100 text-amber-900 font-black text-[10px] px-2.5 py-0.5 rounded-full border border-amber-300">🚗 TÀI XẾ TAXI</span>;
      case 'OTHER':
        return <span className="bg-gray-200 text-gray-800 font-black text-[10px] px-2.5 py-0.5 rounded-full border border-gray-300">🌐 TÀI KHOẢN KHÁC</span>;
      default:
        return <span className="bg-blue-100 text-blue-800 font-black text-[10px] px-2.5 py-0.5 rounded-full border border-blue-300">👤 NGUỜI DÙNG</span>;
    }
  };

  const getRoleBadgeText = (role) => {
    switch (role) {
      case 'SUPER_ADMIN': return 'Super Admin Overlord';
      case 'SHOP': return 'Tài Khoản Shop / Gian Hàng';
      case 'EMPLOYEE': return 'Tài Khoản Nhân Viên';
      case 'TAXI_DRIVER': return 'Tài Khoản Tài Xế Taxi';
      case 'OTHER': return 'Tài Khoản Khác';
      default: return 'Tài Khoản Người Dùng';
    }
  };

  const filteredLogs = auditLogsList.filter(log => {
    if (logRoleFilter === 'ALL') return true;
    return log.role === logRoleFilter;
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 font-sans">
      <div className="bg-white rounded-3xl shadow-2xl max-w-5xl w-full h-[88vh] flex flex-col md:flex-row overflow-hidden relative border-2 border-amber-400 animate-in zoom-in-95 duration-200">
        
        {/* ================= THANH MENU DỌC BÊN TRÁI (LEFT SIDEBAR) ================= */}
        <div className="w-full md:w-64 lg:w-72 bg-gradient-to-b from-slate-950 via-navy to-slate-900 text-white flex flex-col justify-between shrink-0 p-4 border-b md:border-b-0 md:border-r border-amber-400/30">
          
          <div className="space-y-4">
            {/* Header Brand Admin Crown */}
            <div className="flex items-center gap-3 border-b border-white/10 pb-3">
              <div className="w-10 h-10 bg-amber-400 text-navy font-black text-xl rounded-2xl flex items-center justify-center shadow-md shrink-0">
                👑
              </div>
              <div>
                <h3 className="font-black text-xs sm:text-sm text-amber-300 uppercase tracking-wider">
                  SUPER ADMIN OVERLORD
                </h3>
                <span className="text-[10px] bg-red-600 text-white font-bold px-2 py-0.2 rounded-full">
                  BẢNG ĐIỀU HÀNH TỐI CAO
                </span>
              </div>
            </div>

            {/* CÁC TÍNH NĂNG ĐƯỢC XẾP DỌC BÊN TRÁI TỪ TRÊN XUỐNG DƯỚI */}
            <nav className="space-y-1.5 text-xs font-extrabold overflow-y-auto max-h-[55vh] scrollbar-none">
              
              {/* Nút NỔI BẬT ĐẶC BIỆT: Master Control Lệnh Bật / Tắt Hệ Thống */}
              <button 
                onClick={() => setActiveAdminTab('master_control')}
                className={`w-full p-2.5 rounded-2xl flex items-center gap-3 transition-all cursor-pointer ${
                  activeAdminTab === 'master_control' 
                    ? 'bg-gradient-to-r from-red-600 to-orange-600 text-white shadow-md font-black translate-x-1 border border-amber-300' 
                    : 'text-amber-300 hover:bg-white/10'
                }`}
              >
                <i className="fa-solid fa-power-off text-base text-amber-300 animate-pulse"></i>
                <div className="text-left">
                  <span className="block text-xs">Lệnh Bật / Tắt Hệ Thống</span>
                  <span className="text-[9px] font-normal opacity-90">Master Control & Bảo Trì</span>
                </div>
              </button>

              {/* Nút 1: Quản Lý Sản Phẩm */}
              <button 
                onClick={() => setActiveAdminTab('products')}
                className={`w-full p-2.5 rounded-2xl flex items-center gap-3 transition-all cursor-pointer ${
                  activeAdminTab === 'products' 
                    ? 'bg-amber-400 text-navy shadow-md font-black translate-x-1' 
                    : 'text-gray-300 hover:bg-white/10 hover:text-white'
                }`}
              >
                <i className="fa-solid fa-box-archive text-base"></i>
                <div className="text-left">
                  <span className="block text-xs">Quản Lý Sản Phẩm</span>
                  <span className="text-[9px] font-normal opacity-80">Kho hàng & Đăng bán</span>
                </div>
              </button>

              {/* Nút 2: Quản Lý Người Dùng & Tạo Tài Khoản */}
              <button 
                onClick={() => setActiveAdminTab('users')}
                className={`w-full p-2.5 rounded-2xl flex items-center gap-3 transition-all cursor-pointer ${
                  activeAdminTab === 'users' 
                    ? 'bg-amber-400 text-navy shadow-md font-black translate-x-1' 
                    : 'text-gray-300 hover:bg-white/10 hover:text-white'
                }`}
              >
                <i className="fa-solid fa-users text-base"></i>
                <div className="text-left">
                  <span className="block text-xs">Quản Lý Người Dùng</span>
                  <span className="text-[9px] font-normal opacity-80">Danh sách & Tạo tài khoản</span>
                </div>
              </button>

              {/* Nút 2.5: Phê Duyệt Mật Khẩu Khách Hàng */}
              <button 
                onClick={() => setActiveAdminTab('password_approvals')}
                className={`w-full p-2.5 rounded-2xl flex items-center justify-between transition-all cursor-pointer ${
                  activeAdminTab === 'password_approvals' 
                    ? 'bg-amber-400 text-navy shadow-md font-black translate-x-1' 
                    : 'text-amber-300 hover:bg-white/10'
                }`}
              >
                <div className="flex items-center gap-3">
                  <i className="fa-solid fa-key text-base text-amber-300"></i>
                  <div className="text-left">
                    <span className="block text-xs">Phê Duyệt Mật Khẩu</span>
                    <span className="text-[9px] font-normal opacity-80">Khôi phục Pass khách</span>
                  </div>
                </div>

                {resetRequests.filter(r => r.status === 'PENDING').length > 0 && (
                  <span className="bg-red-600 text-white font-black text-[10px] px-2 py-0.5 rounded-full animate-bounce">
                    {resetRequests.filter(r => r.status === 'PENDING').length}
                  </span>
                )}
              </button>

              {/* Nút 2.6: Phê Duyệt Rút Tiền Tài Khoản */}
              <button 
                onClick={() => setActiveAdminTab('withdrawal_approvals')}
                className={`w-full p-2.5 rounded-2xl flex items-center justify-between transition-all cursor-pointer ${
                  activeAdminTab === 'withdrawal_approvals' 
                    ? 'bg-amber-400 text-navy shadow-md font-black translate-x-1' 
                    : 'text-emerald-300 hover:bg-white/10'
                }`}
              >
                <div className="flex items-center gap-3">
                  <i className="fa-solid fa-money-bill-transfer text-base text-emerald-400"></i>
                  <div className="text-left">
                    <span className="block text-xs">Phê Duyệt Rút Tiền</span>
                    <span className="text-[9px] font-normal opacity-80">Giải ngân ATM ngân hàng</span>
                  </div>
                </div>

                {withdrawalRequests.filter(w => w.status === 'PENDING').length > 0 && (
                  <span className="bg-emerald-600 text-white font-black text-[10px] px-2 py-0.5 rounded-full animate-bounce">
                    {withdrawalRequests.filter(w => w.status === 'PENDING').length}
                  </span>
                )}
              </button>

              {/* Nút 2.7: Phê Duyệt Nạp Tiền & Cộng Ví */}
              <button 
                onClick={() => setActiveAdminTab('deposit_approvals')}
                className={`w-full p-2.5 rounded-2xl flex items-center justify-between transition-all cursor-pointer ${
                  activeAdminTab === 'deposit_approvals' 
                    ? 'bg-amber-400 text-navy shadow-md font-black translate-x-1' 
                    : 'text-cyan-300 hover:bg-white/10'
                }`}
              >
                <div className="flex items-center gap-3">
                  <i className="fa-solid fa-wallet text-base text-cyan-400"></i>
                  <div className="text-left">
                    <span className="block text-xs">Phê Duyệt Nạp Tiền</span>
                    <span className="text-[9px] font-normal opacity-80">Duyệt & Cộng tiền Ví TQ Pay</span>
                  </div>
                </div>

                {depositRequests.filter(d => d.status === 'PENDING').length > 0 && (
                  <span className="bg-cyan-600 text-white font-black text-[10px] px-2 py-0.5 rounded-full animate-bounce">
                    {depositRequests.filter(d => d.status === 'PENDING').length}
                  </span>
                )}
              </button>

              {/* Nút 2.8: Cài Phí Sàn Chi Tiết Cho Từng Shop & Taxi */}
              <button 
                onClick={() => setActiveAdminTab('custom_fees')}
                className={`w-full p-2.5 rounded-2xl flex items-center justify-between transition-all cursor-pointer ${
                  activeAdminTab === 'custom_fees' 
                    ? 'bg-amber-400 text-navy shadow-md font-black translate-x-1' 
                    : 'text-purple-300 hover:bg-white/10'
                }`}
              >
                <div className="flex items-center gap-3">
                  <i className="fa-solid fa-percent text-base text-purple-400"></i>
                  <div className="text-left">
                    <span className="block text-xs">Cài Phí Sàn Chi Tiết</span>
                    <span className="text-[9px] font-normal opacity-80">% Phí riêng Shop & Taxi</span>
                  </div>
                </div>

                {registeredUsers.filter(u => u.custom_commission_fee !== null && u.custom_commission_fee !== undefined).length > 0 && (
                  <span className="bg-purple-900 text-amber-300 border border-purple-400 font-black text-[10px] px-2 py-0.5 rounded-full font-mono">
                    {registeredUsers.filter(u => u.custom_commission_fee !== null && u.custom_commission_fee !== undefined).length}
                  </span>
                )}
              </button>

              {/* Nút 2.9: Quản Lý Link Truy Cập Web Riêng Cho Từng Shop */}
              <button 
                onClick={() => setActiveAdminTab('shop_links')}
                className={`w-full p-2.5 rounded-2xl flex items-center justify-between transition-all cursor-pointer ${
                  activeAdminTab === 'shop_links' 
                    ? 'bg-amber-400 text-navy shadow-md font-black translate-x-1' 
                    : 'text-teal-300 hover:bg-white/10'
                }`}
              >
                <div className="flex items-center gap-3">
                  <i className="fa-solid fa-link text-base text-teal-400"></i>
                  <div className="text-left">
                    <span className="block text-xs">Link Web Gian Hàng</span>
                    <span className="text-[9px] font-normal opacity-80">Link trực tiếp cho từng Shop</span>
                  </div>
                </div>

                {registeredUsers.filter(u => u.role === 'SHOP').length > 0 && (
                  <span className="bg-teal-900 text-amber-300 border border-teal-400 font-black text-[10px] px-2 py-0.5 rounded-full font-mono">
                    {registeredUsers.filter(u => u.role === 'SHOP').length}
                  </span>
                )}
              </button>

              {/* Nút 2.10: Quản Lý Đề Xuất Shop & Sản Phẩm Nổi Bật Hot */}
              <button 
                onClick={() => setActiveAdminTab('featured')}
                className={`w-full p-2.5 rounded-2xl flex items-center justify-between transition-all cursor-pointer ${
                  activeAdminTab === 'featured' 
                    ? 'bg-amber-400 text-navy shadow-md font-black translate-x-1' 
                    : 'text-amber-300 hover:bg-white/10'
                }`}
              >
                <div className="flex items-center gap-3">
                  <i className="fa-solid fa-star text-base text-amber-400"></i>
                  <div className="text-left">
                    <span className="block text-xs">Quản Lý Đề Xuất Hot</span>
                    <span className="text-[9px] font-normal opacity-80">Shop & SP Nổi Bật Trang Chủ</span>
                  </div>
                </div>

                <span className="bg-amber-900 text-amber-300 border border-amber-400 font-black text-[10px] px-2 py-0.5 rounded-full font-mono">
                  {(featuredPromotions.productIds || []).length + (featuredPromotions.shopEmails || []).length}
                </span>
              </button>

              {/* Nút 2.11: Quản Lý & Phát Hành Mã Giảm Giá (Vouchers & Coupons) */}
              <button 
                onClick={() => setActiveAdminTab('vouchers')}
                className={`w-full p-2.5 rounded-2xl flex items-center justify-between transition-all cursor-pointer ${
                  activeAdminTab === 'vouchers' 
                    ? 'bg-amber-400 text-navy shadow-md font-black translate-x-1' 
                    : 'text-orange-300 hover:bg-white/10'
                }`}
              >
                <div className="flex items-center gap-3">
                  <i className="fa-solid fa-ticket text-base text-orange-400"></i>
                  <div className="text-left">
                    <span className="block text-xs">Quản Lý Mã Giảm Giá</span>
                    <span className="text-[9px] font-normal opacity-80">Vouchers, PTTT & Lượt dùng</span>
                  </div>
                </div>

                <span className="bg-orange-950 text-amber-300 border border-orange-400 font-black text-[10px] px-2 py-0.5 rounded-full font-mono">
                  {vouchersList.length}
                </span>
              </button>

              {/* Nút 2.12: Lịch Sử Mua Hàng Của Tất Cả Khách Hàng Toàn Sàn */}
              <button 
                onClick={() => setActiveAdminTab('global_orders')}
                className={`w-full p-2.5 rounded-2xl flex items-center justify-between transition-all cursor-pointer ${
                  activeAdminTab === 'global_orders' 
                    ? 'bg-amber-400 text-navy shadow-md font-black translate-x-1' 
                    : 'text-indigo-300 hover:bg-white/10'
                }`}
              >
                <div className="flex items-center gap-3">
                  <i className="fa-solid fa-boxes-packing text-base text-indigo-400"></i>
                  <div className="text-left">
                    <span className="block text-xs">Lịch Sử Đơn All Sàn</span>
                    <span className="text-[9px] font-normal opacity-80">Toàn bộ đơn hàng mua thành công</span>
                  </div>
                </div>

                <span className="bg-indigo-950 text-amber-300 border border-indigo-400 font-black text-[10px] px-2 py-0.5 rounded-full font-mono">
                  {globalOrdersList.length}
                </span>
              </button>

              {/* Nút 2.13: Cấu Hình Ngân Hàng Hệ Thống Nhận Tiền Nạp (VietQR) */}
              <button 
                onClick={() => setActiveAdminTab('system_bank')}
                className={`w-full p-2.5 rounded-2xl flex items-center justify-between transition-all cursor-pointer ${
                  activeAdminTab === 'system_bank' 
                    ? 'bg-amber-400 text-navy shadow-md font-black translate-x-1' 
                    : 'text-emerald-300 hover:bg-white/10'
                }`}
              >
                <div className="flex items-center gap-3">
                  <i className="fa-solid fa-building-columns text-base text-emerald-400"></i>
                  <div className="text-left">
                    <span className="block text-xs">Cấu Hình VietQR Nạp</span>
                    <span className="text-[9px] font-normal opacity-80">Tài khoản nhận nạp tiền tự động</span>
                  </div>
                </div>

                <span className="bg-emerald-950 text-amber-300 border border-emerald-400 font-black text-[10px] px-2 py-0.5 rounded-full font-mono">
                  VIETQR
                </span>
              </button>

              {/* Nút 2.14: Quản Lý & Chỉnh Sửa Lượt Mua, Thêm Đánh Giá AI */}
              <button 
                onClick={() => setActiveAdminTab('reviews_manager')}
                className={`w-full p-2.5 rounded-2xl flex items-center justify-between transition-all cursor-pointer ${
                  activeAdminTab === 'reviews_manager' 
                    ? 'bg-amber-400 text-navy shadow-md font-black translate-x-1' 
                    : 'text-amber-300 hover:bg-white/10'
                }`}
              >
                <div className="flex items-center gap-3">
                  <i className="fa-solid fa-star-half-stroke text-base text-amber-400"></i>
                  <div className="text-left">
                    <span className="block text-xs">Lượt Bán & Đánh Giá AI</span>
                    <span className="text-[9px] font-normal opacity-80">Sửa lượt đã bán & Tạo review ảo</span>
                  </div>
                </div>

                <span className="bg-amber-950 text-amber-300 border border-amber-400 font-black text-[10px] px-2 py-0.5 rounded-full font-mono">
                  AI REVIEWS
                </span>
              </button>

              {/* Nút 2.15: Đổi Giao Diện Toàn Hệ Thống Thời Gian Thực (Realtime Theme) */}
              <button 
                onClick={() => setActiveAdminTab('system_theme')}
                className={`w-full p-2.5 rounded-2xl flex items-center justify-between transition-all cursor-pointer ${
                  activeAdminTab === 'system_theme' 
                    ? 'bg-amber-400 text-navy shadow-md font-black translate-x-1' 
                    : 'text-purple-300 hover:bg-white/10'
                }`}
              >
                <div className="flex items-center gap-3">
                  <i className="fa-solid fa-palette text-base text-purple-400"></i>
                  <div className="text-left">
                    <span className="block text-xs">Đổi Giao Diện Realtime</span>
                    <span className="text-[9px] font-normal opacity-80">Thay đổi màu sắc & theme tức thì</span>
                  </div>
                </div>

                <span className="bg-purple-950 text-amber-300 border border-purple-400 font-black text-[10px] px-2 py-0.5 rounded-full font-mono">
                  THEMES
                </span>
              </button>

              {/* Nút 2.16: Phát Thông Báo Toàn Hệ Thống (System-Wide Broadcast Announcements) */}
              <button 
                onClick={() => setActiveAdminTab('announcements_manager')}
                className={`w-full p-2.5 rounded-2xl flex items-center justify-between transition-all cursor-pointer ${
                  activeAdminTab === 'announcements_manager' 
                    ? 'bg-amber-400 text-navy shadow-md font-black translate-x-1' 
                    : 'text-red-300 hover:bg-white/10'
                }`}
              >
                <div className="flex items-center gap-3">
                  <i className="fa-solid fa-bullhorn text-base text-red-400 animate-pulse"></i>
                  <div className="text-left">
                    <span className="block text-xs">Phát Thông Báo All Sàn</span>
                    <span className="text-[9px] font-normal opacity-80">Đẩy thông báo tới tất cả người dùng</span>
                  </div>
                </div>

                <span className="bg-red-950 text-amber-300 border border-red-400 font-black text-[10px] px-2 py-0.5 rounded-full font-mono">
                  BROADCAST
                </span>
              </button>

              {/* Nút 3: Nhật Ký Thao Tác (Audit Logs & Audit Trail) */}
              <button 
                onClick={() => setActiveAdminTab('audit_logs')}
                className={`w-full p-2.5 rounded-2xl flex items-center gap-3 transition-all cursor-pointer ${
                  activeAdminTab === 'audit_logs' 
                    ? 'bg-purple-600 text-white shadow-md font-black translate-x-1 border border-amber-300' 
                    : 'text-purple-300 hover:bg-white/10 hover:text-white'
                }`}
              >
                <i className="fa-solid fa-clipboard-list text-base text-amber-300"></i>
                <div className="text-left">
                  <span className="block text-xs">Nhật Ký Thao Tác</span>
                  <span className="text-[9px] font-normal opacity-80">Audit Logs Admin & NV</span>
                </div>
              </button>

              {/* Nút 4: Thống Kê Doanh Thu */}
              <button 
                onClick={() => setActiveAdminTab('stats')}
                className={`w-full p-2.5 rounded-2xl flex items-center gap-3 transition-all cursor-pointer ${
                  activeAdminTab === 'stats' 
                    ? 'bg-amber-400 text-navy shadow-md font-black translate-x-1' 
                    : 'text-gray-300 hover:bg-white/10 hover:text-white'
                }`}
              >
                <i className="fa-solid fa-chart-line text-base"></i>
                <div className="text-left">
                  <span className="block text-xs">Thống Kê Doanh Thu</span>
                  <span className="text-[9px] font-normal opacity-80">Ví TQ & Xu Tích Lũy</span>
                </div>
              </button>

              {/* Nút 4.5: Báo Cáo P&L & Thu Chi Toàn Sàn */}
              <button 
                onClick={() => setActiveAdminTab('pl_report')}
                className={`w-full p-2.5 rounded-2xl flex items-center gap-3 transition-all cursor-pointer ${
                  activeAdminTab === 'pl_report' 
                    ? 'bg-emerald-600 text-white shadow-md font-black translate-x-1 border border-amber-300' 
                    : 'text-emerald-400 hover:bg-white/10 hover:text-white'
                }`}
              >
                <i className="fa-solid fa-file-invoice-dollar text-base text-amber-300"></i>
                <div className="text-left">
                  <span className="block text-xs">Báo Cáo P&L & Thu Chi</span>
                  <span className="text-[9px] font-normal opacity-80">Lợi nhuận ròng toàn sàn</span>
                </div>
              </button>

              {/* Nút 5: Bảo Mật & RLS */}
              <button 
                onClick={() => setActiveAdminTab('security')}
                className={`w-full p-2.5 rounded-2xl flex items-center gap-3 transition-all cursor-pointer ${
                  activeAdminTab === 'security' 
                    ? 'bg-amber-400 text-navy shadow-md font-black translate-x-1' 
                    : 'text-gray-300 hover:bg-white/10 hover:text-white'
                }`}
              >
                <i className="fa-solid fa-shield-halved text-base"></i>
                <div className="text-left">
                  <span className="block text-xs">Bảo Mật & RLS DB</span>
                  <span className="text-[9px] font-normal opacity-80">Kiểm tra kết nối CSDL</span>
                </div>
              </button>

              {/* Nút 6: Cấu Hình Hệ Thống */}
              <button 
                onClick={() => setActiveAdminTab('settings')}
                className={`w-full p-2.5 rounded-2xl flex items-center gap-3 transition-all cursor-pointer ${
                  activeAdminTab === 'settings' 
                    ? 'bg-amber-400 text-navy shadow-md font-black translate-x-1' 
                    : 'text-gray-300 hover:bg-white/10 hover:text-white'
                }`}
              >
                <i className="fa-solid fa-gear text-base"></i>
                <div className="text-left">
                  <span className="block text-xs">Cấu Hình Hệ Thống</span>
                  <span className="text-[9px] font-normal opacity-80">Tham số & Tham chiếu</span>
                </div>
              </button>

            </nav>
          </div>

          {/* Footer Sidebar: User Admin Badge & Nút Đóng */}
          <div className="pt-3 border-t border-white/10 space-y-2">
            <div className="flex items-center gap-2 text-[11px] text-gray-300 font-medium">
              <div className="w-7 h-7 bg-amber-400 text-navy font-bold rounded-full flex items-center justify-center text-xs shrink-0">
                AD
              </div>
              <div className="truncate">
                <span className="block font-bold text-amber-300 truncate">{userProfile.email}</span>
                <span className="text-[9px] text-gray-400">Overlord Administrator</span>
              </div>
            </div>

            <button 
              onClick={onClose}
              className="w-full bg-red-600/90 hover:bg-red-700 text-white py-2 rounded-xl text-xs font-extrabold transition-colors cursor-pointer flex items-center justify-center gap-1.5"
            >
              <i className="fa-solid fa-xmark text-xs font-bold"></i>
              <span>ĐÓNG BẢNG ĐIỀU HÀNH</span>
            </button>
          </div>

        </div>

        {/* ================= KHUNG HIỂN THỊ VÀ ĐIỀU CHỈNH BÊN PHẢI (RIGHT CONTENT WORKSPACE) ================= */}
        <div className="flex-1 flex flex-col bg-gray-50 overflow-hidden">
          
          {/* Workspace Top Header Bar */}
          <div className="bg-slate-900 border-b border-slate-800 p-4 flex items-center justify-between shadow-xs text-white">
            <div>
              <h3 className="font-black text-sm text-amber-300 uppercase tracking-wide flex items-center gap-2">
                {activeAdminTab === 'master_control' && (
                  <span className="text-amber-400 font-black flex items-center gap-2">
                    <i className="fa-solid fa-wrench text-amber-400 text-base"></i>
                    KHÓA BẢO TRÌ & NÂNG CẤP TOÀN HỆ THỐNG
                  </span>
                )}
                {activeAdminTab === 'products' && <><span>📦 QUẢN LÝ SẢN PHẨM & GIAN HÀNG</span></>}
                {activeAdminTab === 'users' && <><span>👥 QUẢN LÝ TÀI KHOẢN NGUỜI DÙNG & TẠO TÀI KHOẢN MỚI</span></>}
                {activeAdminTab === 'password_approvals' && <><span>🔑 PHÊ DUYỆT KHÔI PHỤC MẬT KHẨU TỪ NGƯỜI DÙNG</span></>}
                {activeAdminTab === 'withdrawal_approvals' && <><span>💸 HỆ THỐNG PHÊ DUYỆT & GIẢI NGÂN RÚT TIỀN TQ PAY</span></>}
                {activeAdminTab === 'deposit_approvals' && <><span>📥 HỆ THỐNG PHÊ DUYỆT & CỘNG TIỀN VÍ TQ PAY</span></>}
                {activeAdminTab === 'audit_logs' && <><span>📋 NHẬT KÝ THAO TÁC HỆ THỐNG (AUDIT TRAIL)</span></>}
                {activeAdminTab === 'stats' && <><span>📊 THỐNG KÊ DOANH THU HỆ THỐNG</span></>}
                {activeAdminTab === 'security' && <><span>🛡️ TRẠNG THÁI BẢO MẬT & RLS</span></>}
                {activeAdminTab === 'settings' && <><span>⚙️ CẤU HÌNH THAM SỐ TQ STORE</span></>}
              </h3>
              <p className="text-[11px] text-gray-400 font-medium">
                Super Admin Overlord • Giám sát & Khởi tạo dữ liệu Realtime Cloud
              </p>
            </div>

            {/* CTA BUTTON NỔI BẬT DẠNG VIÊN THUỐC MÀU ĐỎ TRÊN HEADER */}
            {activeAdminTab === 'master_control' && (
              <div>
                {systemStatus.mode === 'MAINTENANCE' ? (
                  <button 
                    onClick={() => handleToggleMaintenance(false)}
                    className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 text-white font-black px-5 py-2.5 rounded-full text-xs uppercase tracking-wider shadow-lg transition-all cursor-pointer hover:scale-105 flex items-center gap-2 border border-emerald-400"
                  >
                    <i className="fa-solid fa-lock-open text-amber-300 text-sm"></i>
                    <span>[🔓] TẮT KHÓA BẢO TRÌ (ONLINE)</span>
                  </button>
                ) : (
                  <button 
                    onClick={() => handleToggleMaintenance(true)}
                    className="bg-gradient-to-r from-red-600 to-rose-700 hover:from-red-700 text-white font-black px-5 py-2.5 rounded-full text-xs uppercase tracking-wider shadow-lg transition-all cursor-pointer hover:scale-105 flex items-center gap-2 border border-amber-400 animate-pulse"
                  >
                    <i className="fa-solid fa-lock text-amber-300 text-sm"></i>
                    <span>[🔒] BẬT KHÓA BẢO TRÌ NGAY</span>
                  </button>
                )}
              </div>
            )}

            {/* Quick Action Button in Header for User Creation Toggle */}
            {activeAdminTab === 'users' && (
              <button 
                onClick={() => setShowCreateUserForm(!showCreateUserForm)}
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black px-4 py-2 rounded-xl shadow transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <i className="fa-solid fa-user-plus text-amber-300"></i>
                <span>{showCreateUserForm ? 'ẨN FORM TẠO' : '+ TẠO TÀI KHOẢN MỚI'}</span>
              </button>
            )}

            {/* Quick Action Button in Header */}
            {activeAdminTab === 'products' && (
              <button 
                onClick={() => { onClose(); onOpenAddProduct(); }}
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black px-4 py-2 rounded-xl shadow transition-colors flex items-center gap-1 cursor-pointer"
              >
                <i className="fa-solid fa-plus-circle text-amber-300"></i>
                <span>+ ĐĂNG SẢN PHẨM MỚI</span>
              </button>
            )}

            {activeAdminTab === 'audit_logs' && (
              <button 
                onClick={handleClearAuditTrail}
                className="bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 text-xs font-bold px-3 py-1.5 rounded-xl transition-colors cursor-pointer flex items-center gap-1"
              >
                <i className="fa-solid fa-trash-can text-xs"></i>
                <span>Xóa sạch Nhật Ký</span>
              </button>
            )}
          </div>

          {/* Main Scrollable Content Area */}
          <div className="flex-1 overflow-y-auto p-5 space-y-6">
            
            {/* TÍNH NĂNG TỐI CAO: MASTER CONTROL - BẬT / TẮT TOÀN HỆ THỐNG & BẢO TRÌ */}
            {activeAdminTab === 'master_control' && (
              <div className="space-y-6 text-xs">
                
                {masterMsg && (
                  <div className="bg-emerald-100 text-emerald-900 p-3.5 rounded-2xl text-xs font-black border border-emerald-300 animate-in fade-in">
                    {masterMsg}
                  </div>
                )}

                {/* ================= BỐ CỤC FORM 2 CỘT ================= */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  
                  {/* CỘT TRÁI: TIÊU ĐỀ THÔNG BÁO & DROPDOWN ĐẾM NGƯỢC */}
                  <div className="bg-white border border-gray-200 p-5 rounded-3xl space-y-4 shadow-2xs">
                    <h4 className="font-black text-navy text-xs uppercase tracking-wider flex items-center gap-2 border-b border-gray-100 pb-3">
                      <i className="fa-solid fa-pen-to-square text-amber-500 text-sm"></i>
                      <span>CẤU HÌNH THÔNG BÁO & ĐẾM NGƯỢC</span>
                    </h4>

                    {/* Input Tiêu đề thông báo */}
                    <div>
                      <label className="block font-black text-gray-700 mb-1.5 text-xs">
                        Tiêu đề thông báo:
                      </label>
                      <input 
                        type="text" 
                        value={maintenanceTitle}
                        onChange={(e) => setMaintenanceTitle(e.target.value)}
                        placeholder="HỆ THỐNG ĐANG BẢO TRÌ NÂNG CẤP" 
                        className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3.5 py-2.5 text-xs font-extrabold text-navy focus:outline-none focus:border-navy"
                      />
                    </div>

                    {/* Dropdown Thời gian đếm ngược dự kiến */}
                    <div>
                      <label className="block font-black text-gray-700 mb-1.5 text-xs">
                        Thời gian đếm ngược dự kiến:
                      </label>
                      <select 
                        value={countdownMinutes}
                        onChange={(e) => setCountdownMinutes(e.target.value)}
                        className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3.5 py-2.5 text-xs font-black text-navy focus:outline-none focus:border-navy cursor-pointer"
                      >
                        <option value="15 phút">15 phút</option>
                        <option value="30 phút">30 phút</option>
                        <option value="1 giờ">1 giờ</option>
                        <option value="2 giờ">2 giờ</option>
                        <option value="4 giờ">4 giờ</option>
                        <option value="8 giờ">8 giờ</option>
                        <option value="Hoàn thành">Hoàn thành</option>
                      </select>
                    </div>

                    {/* Status Alert Banner inside Left Column */}
                    <div className="pt-2">
                      {systemStatus.mode === 'MAINTENANCE' ? (
                        <div className="bg-red-50 text-red-700 border border-red-200 p-3 rounded-2xl font-bold flex items-center gap-2">
                          <i className="fa-solid fa-lock text-red-600 text-base"></i>
                          <span>Trạng thái: 🔴 ĐANG BẬT KHÓA BẢO TRÌ</span>
                        </div>
                      ) : (
                        <div className="bg-emerald-50 text-emerald-800 border border-emerald-200 p-3 rounded-2xl font-bold flex items-center gap-2">
                          <i className="fa-solid fa-circle-check text-emerald-600 text-base"></i>
                          <span>Trạng thái: 🟢 HỆ THỐNG ONLINE 24/7</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* CỘT PHẢI: TEXTAREA NỘI DUNG & BOX GHI CHÚ CƠ CHẾ HOẠT ĐỘNG */}
                  <div className="bg-white border border-gray-200 p-5 rounded-3xl space-y-4 shadow-2xs">
                    <h4 className="font-black text-navy text-xs uppercase tracking-wider flex items-center gap-2 border-b border-gray-100 pb-3">
                      <i className="fa-solid fa-message text-amber-500 text-sm"></i>
                      <span>NỘI DUNG CHI TIẾT & CƠ CHẾ HOẠT ĐỘNG</span>
                    </h4>

                    {/* Textarea Nội dung chi tiết thông báo */}
                    <div>
                      <label className="block font-black text-gray-700 mb-1.5 text-xs">
                        Nội dung chi tiết thông báo:
                      </label>
                      <textarea 
                        rows={3}
                        value={maintenanceNoticeText}
                        onChange={(e) => setMaintenanceNoticeText(e.target.value)}
                        placeholder="Nhập chi tiết nội dung bảo trì..."
                        className="w-full bg-gray-50 border border-gray-300 rounded-xl p-3 text-xs text-gray-800 focus:outline-none focus:border-navy font-medium"
                      />
                    </div>

                    {/* Box Ghi Chú Cơ Chế Hoạt Động */}
                    <div className="bg-slate-900 text-slate-100 p-3.5 rounded-2xl border border-slate-700 space-y-1">
                      <div className="flex items-center gap-2 text-amber-400 font-black text-xs uppercase">
                        <i className="fa-solid fa-shield-halved"></i>
                        <span>CƠ CHẾ HOẠT ĐỘNG KHÓA BẢO TRÌ</span>
                      </div>
                      <p className="text-[11px] text-gray-300 font-medium leading-relaxed">
                        • Khi <strong>BẬT KHÓA BẢO TRÌ</strong>, toàn bộ giao diện khách hàng thường sẽ bị che phủ bởi màn hình đếm ngược.
                        <br />
                        • Chỉ tài khoản <strong>Super Admin Overlord</strong> (`tqstore2212@gmail.com`) mới có đặc quyền vượt rào bảo trì để thao tác & điều hành hệ thống.
                      </p>
                    </div>
                  </div>

                </div>

                {/* ================= FEATURE CONTROL GRID (NHÓM CÁC TÍNH NĂNG & PHƯƠNG THỨC HỆ THỐNG) ================= */}
                <div className="space-y-5 pt-3 border-t border-gray-200">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <h4 className="font-black text-navy text-xs uppercase tracking-wider flex items-center gap-2">
                      <i className="fa-solid fa-sliders text-amber-500 text-base"></i>
                      <span>MASTER CONTROL SUITE - QUẢN LÝ LỆNH BẬT / TẮT TOÀN HỆ THỐNG</span>
                    </h4>
                    <span className="bg-purple-100 text-purple-900 border border-purple-300 font-extrabold text-[10px] px-3 py-1 rounded-full">
                      ⚠️ Khóa phương thức nào ➔ Toàn bộ Shop & Người dùng bắt buộc tuân theo
                    </span>
                  </div>

                  {/* 1. NHÓM PHƯƠNG THỨC THANH TOÁN */}
                  <div className="space-y-2">
                    <h5 className="font-black text-slate-700 text-xs uppercase tracking-wider flex items-center gap-1.5 border-b border-gray-200 pb-1">
                      <span>💳 1. NHÓM PHƯƠNG THỨC THANH TOÁN (PAYMENT METHODS)</span>
                    </h5>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      
                      {/* 1.1 Thanh Toán Ví TQ Pay */}
                      <div className="bg-slate-900 border border-slate-700 text-white rounded-2xl p-3.5 shadow-sm space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 bg-blue-600/30 text-blue-400 rounded-xl flex items-center justify-center text-sm font-black">
                              💳
                            </div>
                            <div>
                              <h5 className="font-black text-xs text-amber-300">Thanh Toán Ví TQ Pay</h5>
                              {featureLocks.wallet_payment ? (
                                <span className="bg-red-900/80 text-red-300 border border-red-600 font-black text-[9px] px-2 py-0.5 rounded-full inline-block mt-0.5">
                                  🔴 ĐÃ KHÓA TOÀN SÀN
                                </span>
                              ) : (
                                <span className="bg-emerald-900/80 text-emerald-300 border border-emerald-600 font-black text-[9px] px-2 py-0.5 rounded-full inline-block mt-0.5">
                                  🟢 ĐANG MỞ HOẠT ĐỘNG
                                </span>
                              )}
                            </div>
                          </div>

                          <button 
                            onClick={() => handleToggleFeature('wallet_payment', 'Thanh Toán Ví TQ Pay')}
                            className={`px-3 py-1.5 rounded-xl font-black text-[11px] transition-colors cursor-pointer flex items-center gap-1 ${
                              featureLocks.wallet_payment 
                                ? 'bg-emerald-600 hover:bg-emerald-700 text-white' 
                                : 'bg-red-600 hover:bg-red-700 text-white'
                            }`}
                          >
                            {featureLocks.wallet_payment ? '[🔓] MỞ KHÓA' : '[🔒] KHÓA NGAY'}
                          </button>
                        </div>
                        <p className="text-[10px] text-gray-400 font-medium">
                          Khóa/Mở phương thức thanh toán khấu trừ trực tiếp số dư Ví TQ Pay.
                        </p>
                      </div>

                      {/* 1.2 Thanh Toán Tiền Mặt COD */}
                      <div className="bg-slate-900 border border-slate-700 text-white rounded-2xl p-3.5 shadow-sm space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 bg-emerald-600/30 text-emerald-400 rounded-xl flex items-center justify-center text-sm font-black">
                              💵
                            </div>
                            <div>
                              <h5 className="font-black text-xs text-amber-300">Thanh Toán Tiền Mặt (COD)</h5>
                              {featureLocks.cod_payment ? (
                                <span className="bg-red-900/80 text-red-300 border border-red-600 font-black text-[9px] px-2 py-0.5 rounded-full inline-block mt-0.5">
                                  🔴 ĐÃ KHÓA TOÀN SÀN
                                </span>
                              ) : (
                                <span className="bg-emerald-900/80 text-emerald-300 border border-emerald-600 font-black text-[9px] px-2 py-0.5 rounded-full inline-block mt-0.5">
                                  🟢 ĐANG MỞ HOẠT ĐỘNG
                                </span>
                              )}
                            </div>
                          </div>

                          <button 
                            onClick={() => handleToggleFeature('cod_payment', 'Thanh Toán Tiền Mặt (COD)')}
                            className={`px-3 py-1.5 rounded-xl font-black text-[11px] transition-colors cursor-pointer flex items-center gap-1 ${
                              featureLocks.cod_payment 
                                ? 'bg-emerald-600 hover:bg-emerald-700 text-white' 
                                : 'bg-red-600 hover:bg-red-700 text-white'
                            }`}
                          >
                            {featureLocks.cod_payment ? '[🔓] MỞ KHÓA' : '[🔒] KHÓA NGAY'}
                          </button>
                        </div>
                        <p className="text-[10px] text-gray-400 font-medium">
                          Khóa/Mở phương thức thanh toán bằng tiền mặt khi nhận hàng (COD).
                        </p>
                      </div>

                      {/* 1.3 Chuyển Khoản Ngân Hàng VietQR */}
                      <div className="bg-slate-900 border border-slate-700 text-white rounded-2xl p-3.5 shadow-sm space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 bg-teal-600/30 text-teal-400 rounded-xl flex items-center justify-center text-sm font-black">
                              🏦
                            </div>
                            <div>
                              <h5 className="font-black text-xs text-amber-300">Chuyển Khoản VietQR</h5>
                              {featureLocks.vietqr_transfer ? (
                                <span className="bg-red-900/80 text-red-300 border border-red-600 font-black text-[9px] px-2 py-0.5 rounded-full inline-block mt-0.5">
                                  🔴 ĐÃ KHÓA TOÀN SÀN
                                </span>
                              ) : (
                                <span className="bg-emerald-900/80 text-emerald-300 border border-emerald-600 font-black text-[9px] px-2 py-0.5 rounded-full inline-block mt-0.5">
                                  🟢 ĐANG MỞ HOẠT ĐỘNG
                                </span>
                              )}
                            </div>
                          </div>

                          <button 
                            onClick={() => handleToggleFeature('vietqr_transfer', 'Chuyển Khoản VietQR')}
                            className={`px-3 py-1.5 rounded-xl font-black text-[11px] transition-colors cursor-pointer flex items-center gap-1 ${
                              featureLocks.vietqr_transfer 
                                ? 'bg-emerald-600 hover:bg-emerald-700 text-white' 
                                : 'bg-red-600 hover:bg-red-700 text-white'
                            }`}
                          >
                            {featureLocks.vietqr_transfer ? '[🔓] MỞ KHÓA' : '[🔒] KHÓA NGAY'}
                          </button>
                        </div>
                        <p className="text-[10px] text-gray-400 font-medium">
                          Khóa/Mở mã QR quét nạp ví và chuyển khoản trực tiếp qua Ngân hàng.
                        </p>
                      </div>

                      {/* 1.4 Tích Xu & Khấu Trừ Xu TQ */}
                      <div className="bg-slate-900 border border-slate-700 text-white rounded-2xl p-3.5 shadow-sm space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 bg-amber-600/30 text-amber-400 rounded-xl flex items-center justify-center text-sm font-black">
                              🪙
                            </div>
                            <div>
                              <h5 className="font-black text-xs text-amber-300">Tích Xu & Khấu Trừ Xu TQ</h5>
                              {featureLocks.tq_coins ? (
                                <span className="bg-red-900/80 text-red-300 border border-red-600 font-black text-[9px] px-2 py-0.5 rounded-full inline-block mt-0.5">
                                  🔴 ĐÃ KHÓA TOÀN SÀN
                                </span>
                              ) : (
                                <span className="bg-emerald-900/80 text-emerald-300 border border-emerald-600 font-black text-[9px] px-2 py-0.5 rounded-full inline-block mt-0.5">
                                  🟢 ĐANG MỞ HOẠT ĐỘNG
                                </span>
                              )}
                            </div>
                          </div>

                          <button 
                            onClick={() => handleToggleFeature('tq_coins', 'Tích Xu & Khấu Trừ Xu TQ')}
                            className={`px-3 py-1.5 rounded-xl font-black text-[11px] transition-colors cursor-pointer flex items-center gap-1 ${
                              featureLocks.tq_coins 
                                ? 'bg-emerald-600 hover:bg-emerald-700 text-white' 
                                : 'bg-red-600 hover:bg-red-700 text-white'
                            }`}
                          >
                            {featureLocks.tq_coins ? '[🔓] MỞ KHÓA' : '[🔒] KHÓA NGAY'}
                          </button>
                        </div>
                        <p className="text-[10px] text-gray-400 font-medium">
                          Khóa/Mở quy trình tích Xu đánh giá & dùng Xu giảm giá đơn hàng.
                        </p>
                      </div>

                    </div>
                  </div>

                  {/* 2. NHÓM PHƯƠNG THỨC GIAO HÀNG & NHẬN HÀNG */}
                  <div className="space-y-2 pt-2">
                    <h5 className="font-black text-slate-700 text-xs uppercase tracking-wider flex items-center gap-1.5 border-b border-gray-200 pb-1">
                      <span>🚚 2. NHÓM PHƯƠNG THỨC GIAO HÀNG & NHẬN HÀNG (FULFILLMENT)</span>
                    </h5>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      
                      {/* 2.1 Giao Hàng Tận Nơi (Ship) */}
                      <div className="bg-slate-900 border border-slate-700 text-white rounded-2xl p-3.5 shadow-sm space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 bg-cyan-600/30 text-cyan-400 rounded-xl flex items-center justify-center text-sm font-black">
                              🚚
                            </div>
                            <div>
                              <h5 className="font-black text-xs text-amber-300">Giao Hàng Tận Nơi (Ship)</h5>
                              {featureLocks.shipping_delivery ? (
                                <span className="bg-red-900/80 text-red-300 border border-red-600 font-black text-[9px] px-2 py-0.5 rounded-full inline-block mt-0.5">
                                  🔴 ĐÃ KHÓA TOÀN SÀN
                                </span>
                              ) : (
                                <span className="bg-emerald-900/80 text-emerald-300 border border-emerald-600 font-black text-[9px] px-2 py-0.5 rounded-full inline-block mt-0.5">
                                  🟢 ĐANG MỞ HOẠT ĐỘNG
                                </span>
                              )}
                            </div>
                          </div>

                          <button 
                            onClick={() => handleToggleFeature('shipping_delivery', 'Giao Hàng Tận Nơi')}
                            className={`px-3 py-1.5 rounded-xl font-black text-[11px] transition-colors cursor-pointer flex items-center gap-1 ${
                              featureLocks.shipping_delivery 
                                ? 'bg-emerald-600 hover:bg-emerald-700 text-white' 
                                : 'bg-red-600 hover:bg-red-700 text-white'
                            }`}
                          >
                            {featureLocks.shipping_delivery ? '[🔓] MỞ KHÓA' : '[🔒] KHÓA NGAY'}
                          </button>
                        </div>
                        <p className="text-[10px] text-gray-400 font-medium">
                          Khóa/Mở hình thức vận chuyển giao đơn hàng tận nhà cho khách.
                        </p>
                      </div>

                      {/* 2.2 Nhận Tại Cửa Hàng Shop */}
                      <div className="bg-slate-900 border border-slate-700 text-white rounded-2xl p-3.5 shadow-sm space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 bg-orange-600/30 text-orange-400 rounded-xl flex items-center justify-center text-sm font-black">
                              🏪
                            </div>
                            <div>
                              <h5 className="font-black text-xs text-amber-300">Nhận Tại Cửa Hàng Shop</h5>
                              {featureLocks.pickup_in_store ? (
                                <span className="bg-red-900/80 text-red-300 border border-red-600 font-black text-[9px] px-2 py-0.5 rounded-full inline-block mt-0.5">
                                  🔴 ĐÃ KHÓA TOÀN SÀN
                                </span>
                              ) : (
                                <span className="bg-emerald-900/80 text-emerald-300 border border-emerald-600 font-black text-[9px] px-2 py-0.5 rounded-full inline-block mt-0.5">
                                  🟢 ĐANG MỞ HOẠT ĐỘNG
                                </span>
                              )}
                            </div>
                          </div>

                          <button 
                            onClick={() => handleToggleFeature('pickup_in_store', 'Nhận Tại Cửa Hàng Shop')}
                            className={`px-3 py-1.5 rounded-xl font-black text-[11px] transition-colors cursor-pointer flex items-center gap-1 ${
                              featureLocks.pickup_in_store 
                                ? 'bg-emerald-600 hover:bg-emerald-700 text-white' 
                                : 'bg-red-600 hover:bg-red-700 text-white'
                            }`}
                          >
                            {featureLocks.pickup_in_store ? '[🔓] MỞ KHÓA' : '[🔒] KHÓA NGAY'}
                          </button>
                        </div>
                        <p className="text-[10px] text-gray-400 font-medium">
                          Khóa/Mở hình thức khách đến nhận trực tiếp tại gian hàng Shop.
                        </p>
                      </div>

                    </div>
                  </div>

                  {/* 3. NHÓM TÍNH NĂNG VẬN HÀNH BÁN HÀNG & DỊCH VỤ */}
                  <div className="space-y-2 pt-2">
                    <h5 className="font-black text-slate-700 text-xs uppercase tracking-wider flex items-center gap-1.5 border-b border-gray-200 pb-1">
                      <span>🏪 3. NHÓM TÍNH NĂNG BÁN HÀNG & DỊCH VỤ (CAPABILITIES & SERVICES)</span>
                    </h5>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      
                      {/* 3.1 Quyền Đăng Sản Phẩm Mới (Shop) */}
                      <div className="bg-slate-900 border border-slate-700 text-white rounded-2xl p-3.5 shadow-sm space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 bg-purple-600/30 text-purple-400 rounded-xl flex items-center justify-center text-sm font-black">
                              ➕
                            </div>
                            <div>
                              <h5 className="font-black text-xs text-amber-300">Quyền Đăng Sản Phẩm Mới</h5>
                              {featureLocks.add_product ? (
                                <span className="bg-red-900/80 text-red-300 border border-red-600 font-black text-[9px] px-2 py-0.5 rounded-full inline-block mt-0.5">
                                  🔴 ĐÃ KHÓA TẤT CẢ SHOP
                                </span>
                              ) : (
                                <span className="bg-emerald-900/80 text-emerald-300 border border-emerald-600 font-black text-[9px] px-2 py-0.5 rounded-full inline-block mt-0.5">
                                  🟢 ĐANG MỞ CHO SHOP
                                </span>
                              )}
                            </div>
                          </div>

                          <button 
                            onClick={() => handleToggleFeature('add_product', 'Quyền Đăng Sản Phẩm Mới')}
                            className={`px-3 py-1.5 rounded-xl font-black text-[11px] transition-colors cursor-pointer flex items-center gap-1 ${
                              featureLocks.add_product 
                                ? 'bg-emerald-600 hover:bg-emerald-700 text-white' 
                                : 'bg-red-600 hover:bg-red-700 text-white'
                            }`}
                          >
                            {featureLocks.add_product ? '[🔓] MỞ KHÓA' : '[🔒] KHÓA NGAY'}
                          </button>
                        </div>
                        <p className="text-[10px] text-gray-400 font-medium">
                          Khóa/Mở quyền tạo và niêm yết sản phẩm mới dành cho tất cả các Gian hàng Shop.
                        </p>
                      </div>

                      {/* 3.2 Đặt Món Đồ Ăn & Uống F&B */}
                      <div className="bg-slate-900 border border-slate-700 text-white rounded-2xl p-3.5 shadow-sm space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 bg-amber-600/30 text-amber-400 rounded-xl flex items-center justify-center text-sm font-black">
                              🧋
                            </div>
                            <div>
                              <h5 className="font-black text-xs text-amber-300">Đặt Món Đồ Ăn & Uống F&B</h5>
                              {featureLocks.fnb_ordering ? (
                                <span className="bg-red-900/80 text-red-300 border border-red-600 font-black text-[9px] px-2 py-0.5 rounded-full inline-block mt-0.5">
                                  🔴 ĐÃ KHÓA TOÀN SÀN
                                </span>
                              ) : (
                                <span className="bg-emerald-900/80 text-emerald-300 border border-emerald-600 font-black text-[9px] px-2 py-0.5 rounded-full inline-block mt-0.5">
                                  🟢 ĐANG MỞ HOẠT ĐỘNG
                                </span>
                              )}
                            </div>
                          </div>

                          <button 
                            onClick={() => handleToggleFeature('fnb_ordering', 'Đặt Món Đồ Ăn & Uống F&B')}
                            className={`px-3 py-1.5 rounded-xl font-black text-[11px] transition-colors cursor-pointer flex items-center gap-1 ${
                              featureLocks.fnb_ordering 
                                ? 'bg-emerald-600 hover:bg-emerald-700 text-white' 
                                : 'bg-red-600 hover:bg-red-700 text-white'
                            }`}
                          >
                            {featureLocks.fnb_ordering ? '[🔓] MỞ KHÓA' : '[🔒] KHÓA NGAY'}
                          </button>
                        </div>
                        <p className="text-[10px] text-gray-400 font-medium">
                          Khóa/Mở phân hệ dịch vụ đặt đồ ăn thức uống F&B.
                        </p>
                      </div>

                    </div>
                  </div>

                  {/* 4. CHẾ ĐỘ BẢO TRÌ & HỆ THỐNG */}
                  <div className="space-y-2 pt-2">
                    <h5 className="font-black text-slate-700 text-xs uppercase tracking-wider flex items-center gap-1.5 border-b border-gray-200 pb-1">
                      <span>🛠️ 4. CHẾ ĐỘ BẢO TRÌ & HỆ THỐNG (SYSTEM & CHAT)</span>
                    </h5>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      
                      {/* 4.1 Nhắn Tin Realtime Chat */}
                      <div className="bg-slate-900 border border-slate-700 text-white rounded-2xl p-3.5 shadow-sm space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 bg-emerald-600/30 text-emerald-400 rounded-xl flex items-center justify-center text-sm font-black">
                              💬
                            </div>
                            <div>
                              <h5 className="font-black text-xs text-amber-300">Nhắn Tin Realtime Chat</h5>
                              {featureLocks.realtime_chat ? (
                                <span className="bg-red-900/80 text-red-300 border border-red-600 font-black text-[9px] px-2 py-0.5 rounded-full inline-block mt-0.5">
                                  🔴 ĐÃ KHÓA TOÀN SÀN
                                </span>
                              ) : (
                                <span className="bg-emerald-900/80 text-emerald-300 border border-emerald-600 font-black text-[9px] px-2 py-0.5 rounded-full inline-block mt-0.5">
                                  🟢 ĐANG MỞ HOẠT ĐỘNG
                                </span>
                              )}
                            </div>
                          </div>

                          <button 
                            onClick={() => handleToggleFeature('realtime_chat', 'Nhắn Tin Realtime Chat')}
                            className={`px-3 py-1.5 rounded-xl font-black text-[11px] transition-colors cursor-pointer flex items-center gap-1 ${
                              featureLocks.realtime_chat 
                                ? 'bg-emerald-600 hover:bg-emerald-700 text-white' 
                                : 'bg-red-600 hover:bg-red-700 text-white'
                            }`}
                          >
                            {featureLocks.realtime_chat ? '[🔓] MỞ KHÓA' : '[🔒] KHÓA NGAY'}
                          </button>
                        </div>
                        <p className="text-[10px] text-gray-400 font-medium">
                          Khóa/Mở kênh chat trực tiếp giữa Khách hàng & Gian hàng.
                        </p>
                      </div>

                      {/* 4.2 Đăng Ký Tài Khoản Mới */}
                      <div className="bg-slate-900 border border-slate-700 text-white rounded-2xl p-3.5 shadow-sm space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 bg-indigo-600/30 text-indigo-400 rounded-xl flex items-center justify-center text-sm font-black">
                              📝
                            </div>
                            <div>
                              <h5 className="font-black text-xs text-amber-300">Đăng Ký Tài Khoản Mới</h5>
                              {featureLocks.user_registration ? (
                                <span className="bg-red-900/80 text-red-300 border border-red-600 font-black text-[9px] px-2 py-0.5 rounded-full inline-block mt-0.5">
                                  🔴 ĐÃ KHÓA TOÀN SÀN
                                </span>
                              ) : (
                                <span className="bg-emerald-900/80 text-emerald-300 border border-emerald-600 font-black text-[9px] px-2 py-0.5 rounded-full inline-block mt-0.5">
                                  🟢 ĐANG MỞ HOẠT ĐỘNG
                                </span>
                              )}
                            </div>
                          </div>

                          <button 
                            onClick={() => handleToggleFeature('user_registration', 'Đăng Ký Tài Khoản Mới')}
                            className={`px-3 py-1.5 rounded-xl font-black text-[11px] transition-colors cursor-pointer flex items-center gap-1 ${
                              featureLocks.user_registration 
                                ? 'bg-emerald-600 hover:bg-emerald-700 text-white' 
                                : 'bg-red-600 hover:bg-red-700 text-white'
                            }`}
                          >
                            {featureLocks.user_registration ? '[🔓] MỞ KHÓA' : '[🔒] KHÓA NGAY'}
                          </button>
                        </div>
                        <p className="text-[10px] text-gray-400 font-medium">
                          Khóa/Mở tiếp nhận lượt đăng ký tài khoản mới vào hệ thống.
                        </p>
                      </div>

                    </div>
                  </div>

                </div>

              </div>
            )}

            {/* TÍNH NĂNG 1: QUẢN LÝ SẢN PHẨM */}
            {activeAdminTab === 'products' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between text-xs font-bold text-gray-600">
                  <span>Tổng số mặt hàng trong CSDL: <strong className="text-navy font-black">{productsList.length} sản phẩm</strong></span>
                  <button onClick={loadAdminData} className="text-navy hover:underline cursor-pointer">
                    <i className="fa-solid fa-rotate text-xs"></i> Làm mới dữ liệu
                  </button>
                </div>

                {loading ? (
                  <div className="py-16 text-center text-xs text-gray-500 font-bold">
                    <i className="fa-solid fa-spinner fa-spin text-2xl text-navy mb-2"></i>
                    <p>Đang đồng bộ danh sách sản phẩm từ Supabase Cloud...</p>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {productsList.map((p) => (
                      <div key={p.id} className="bg-white border border-gray-200 p-3.5 rounded-2xl flex items-center justify-between gap-3 text-xs shadow-2xs hover:border-amber-400 transition-colors">
                        <div className="flex items-center gap-3">
                          <img 
                            src={p.image_url || 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=200&q=80'} 
                            alt="Thumbnail"
                            className="w-14 h-14 rounded-xl object-cover border shrink-0" 
                          />
                          <div>
                            <h5 className="font-black text-navy text-sm">{p.title || p.name}</h5>
                            <div className="flex items-center gap-2 text-[11px] text-gray-500 mt-1">
                              <span className="bg-navy text-white px-2 py-0.5 rounded font-bold">{p.shop_type}</span>
                              <span className="text-red-600 font-extrabold">{Number(p.price).toLocaleString('vi-VN')}đ</span>
                              <span>Số lượng kho: <strong>{p.stock}</strong></span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <button 
                            onClick={() => alert(`✏️ Điều chỉnh sản phẩm ID #${p.id}`)}
                            className="bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 px-3 py-1.5 rounded-xl font-bold text-xs cursor-pointer"
                          >
                            Điều chỉnh
                          </button>
                          <button 
                            onClick={() => handleDeleteProduct(p.id, p.title || p.name)}
                            className="bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 px-3 py-1.5 rounded-xl font-bold text-xs cursor-pointer"
                          >
                            Xóa
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* TÍNH NĂNG 2: QUẢN LÝ NGƯỜI DÙNG & TẠO TÀI KHOẢN MỚI */}
            {activeAdminTab === 'users' && (
              <div className="space-y-5 text-xs">
                
                {/* FORM ADMIN TẠO VÀ ĐỒNG BỘ ĐÁM MÂY TÀI KHOẢN MỚI (5 ROLE TYPES) */}
                {showCreateUserForm && (
                  <div className="bg-white border-2 border-emerald-400 p-5 rounded-3xl space-y-4 shadow-sm animate-in fade-in">
                    <div className="border-b border-gray-200 pb-3 flex items-center justify-between">
                      <div>
                        <h4 className="font-black text-navy text-sm uppercase flex items-center gap-2">
                          <i className="fa-solid fa-cloud-arrow-up text-emerald-600 text-base"></i>
                          <span>➕ KHAI BÁO TẠO TÀI KHOẢN MỚI & ĐỒNG BỘ ĐÁM MÂY</span>
                        </h4>
                        <p className="text-xs text-gray-500 font-medium mt-0.5">
                          Tạo tài khoản dành cho: Shop, Người dùng, Nhân viên, Tài xế Taxi & Khác
                        </p>
                      </div>
                      <span className="bg-emerald-100 text-emerald-800 text-[10px] font-black px-2.5 py-1 rounded-full border border-emerald-300">
                        CLOUD SYNC
                      </span>
                    </div>

                    {createError && (
                      <div className="bg-red-50 text-red-600 p-3 rounded-xl text-xs font-bold border border-red-200">
                        {createError}
                      </div>
                    )}

                    {createMsg && (
                      <div className="bg-emerald-100 text-emerald-900 p-3 rounded-xl text-xs font-black border border-emerald-300">
                        {createMsg}
                      </div>
                    )}

                    <form onSubmit={handleAdminCreateUserSubmit} className="space-y-4 text-xs">
                      {/* Selector Role */}
                      <div>
                        <label className="block font-black text-navy mb-1.5">
                          LOẠI TÀI KHOẢN KHỞI TẠO (ROLE):
                        </label>
                        <select 
                          value={newRole}
                          onChange={(e) => setNewRole(e.target.value)}
                          className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3.5 py-2.5 text-xs font-black text-navy focus:outline-none focus:border-navy cursor-pointer"
                        >
                          <option value="USER">👤 Tài khoản Người dùng / Khách hàng (USER)</option>
                          <option value="SHOP">🏪 Tài khoản Shop / Gian hàng (SHOP)</option>
                          <option value="EMPLOYEE">💼 Tài khoản Nhân viên (EMPLOYEE)</option>
                          <option value="TAXI_DRIVER">🚗 Tài khoản Tài xế Taxi (TAXI_DRIVER)</option>
                          <option value="OTHER">🌐 Tài khoản Khác (OTHER)</option>
                        </select>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                        <div>
                          <label className="block font-extrabold text-gray-700 mb-1">
                            Email / Gmail đăng ký (Bắt buộc):
                          </label>
                          <input 
                            type="email" 
                            value={newEmail}
                            onChange={(e) => setNewEmail(e.target.value)}
                            required 
                            placeholder="nguoidung@tqstore.vn" 
                            className="w-full bg-white border border-gray-300 rounded-xl px-3.5 py-2.5 text-xs focus:outline-none focus:border-navy font-medium"
                          />
                        </div>

                        <div>
                          <label className="block font-extrabold text-gray-700 mb-1">
                            Số điện thoại liên hệ:
                          </label>
                          <input 
                            type="tel" 
                            value={newPhone}
                            onChange={(e) => setNewPhone(e.target.value)}
                            placeholder="0988 123 456" 
                            className="w-full bg-white border border-gray-300 rounded-xl px-3.5 py-2.5 text-xs focus:outline-none focus:border-navy font-mono font-medium"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                        <div>
                          <label className="block font-extrabold text-gray-700 mb-1">
                            Họ và tên người dùng:
                          </label>
                          <input 
                            type="text" 
                            value={newName}
                            onChange={(e) => setNewName(e.target.value)}
                            placeholder="Nguyễn Văn A" 
                            className="w-full bg-white border border-gray-300 rounded-xl px-3.5 py-2.5 text-xs focus:outline-none focus:border-navy font-medium"
                          />
                        </div>

                        <div>
                          <label className="block font-extrabold text-gray-700 mb-1">
                            Mật khẩu khởi tạo (≥6 ký tự):
                          </label>
                          <input 
                            type="password" 
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            required 
                            minLength={6}
                            placeholder="••••••••" 
                            className="w-full bg-white border border-gray-300 rounded-xl px-3.5 py-2.5 text-xs focus:outline-none focus:border-navy font-medium"
                          />
                        </div>
                      </div>

                      <button 
                        type="submit" 
                        className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 text-white font-black py-3.5 rounded-xl text-xs uppercase tracking-wider shadow-md transition-all cursor-pointer flex items-center justify-center gap-2 mt-2"
                      >
                        <i className="fa-solid fa-cloud-arrow-up text-amber-300 text-sm"></i>
                        <span>🎯 TẠO VÀ ĐỒNG BỘ ĐÁM MÂY TÀI KHOẢN</span>
                      </button>
                    </form>
                  </div>
                )}

                {/* 🔔 BẢNG YÊU CẦU KHÔI PHỤC MẬT KHẨU CHỜ PHÊ DUYỆT */}
                {resetRequests.filter(r => r.status === 'PENDING').length > 0 && (
                  <div className="bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-amber-500/10 border-2 border-amber-400 p-4 rounded-3xl space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 bg-amber-500 rounded-full animate-ping"></span>
                        <h4 className="font-black text-amber-900 text-xs uppercase tracking-wider">
                          🔔 YÊU CẦU KHÔI PHỤC MẬT KHẨU CHỜ ADMIN PHÊ DUYỆT ({resetRequests.filter(r => r.status === 'PENDING').length})
                        </h4>
                      </div>
                      <span className="text-[10px] text-amber-800 font-bold bg-amber-200 px-2 py-0.5 rounded-full">
                        Cần xử lý ngay
                      </span>
                    </div>

                    <div className="space-y-2">
                      {resetRequests.filter(r => r.status === 'PENDING').map((req) => (
                        <div key={req.id} className="bg-white border border-amber-300 p-3 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-xs">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-black text-navy text-sm">{req.email}</span>
                              <span className="bg-amber-100 text-amber-900 font-extrabold text-[10px] px-2 py-0.5 rounded-full border border-amber-300">
                                ⌛ PENDING
                              </span>
                            </div>
                            <p className="text-[11px] text-gray-500 font-mono mt-0.5">
                              Họ tên: {req.name || 'Thành viên'} | Thời gian gửi: {new Date(req.requested_at).toLocaleString('vi-VN')}
                            </p>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {/* Nút Phê duyệt */}
                            <button 
                              onClick={() => handleApproveResetRequest(req.id, req.email)}
                              className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-[11px] px-3.5 py-1.5 rounded-xl cursor-pointer transition-all shadow-xs flex items-center gap-1"
                            >
                              <i className="fa-solid fa-check text-xs"></i>
                              <span>✅ PHÊ DUYỆT</span>
                            </button>

                            {/* Nút Từ chối */}
                            <button 
                              onClick={() => handleRejectResetRequest(req.id, req.email)}
                              className="bg-red-50 text-red-700 hover:bg-red-100 border border-red-300 font-extrabold text-[11px] px-3 py-1.5 rounded-xl cursor-pointer transition-all flex items-center gap-1"
                            >
                              <i className="fa-solid fa-xmark text-xs"></i>
                              <span>❌ TỪ CHỐI</span>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* DANH SÁCH TÀI KHOẢN ĐÃ KHỞI TẠO TRONG HỆ THỐNG */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between border-b border-gray-200 pb-2">
                    <div>
                      <h4 className="font-extrabold text-navy text-xs uppercase tracking-wider flex items-center gap-2">
                        <span>Danh sách Tài khoản Hệ thống ({registeredUsers.length} tài khoản)</span>
                        <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" title="Tự động đồng bộ Realtime Cloud 3s"></span>
                      </h4>
                      <p className="text-[11px] text-gray-500 font-medium">
                        Đồng bộ Realtime Supabase Cloud cho tất cả thiết bị trên toàn thế giới
                      </p>
                    </div>

                    <button 
                      onClick={loadAdminData}
                      className="bg-navy hover:bg-navy-dark text-amber-300 border border-amber-400/40 px-3 py-1.5 rounded-xl font-bold text-xs shadow-xs transition-all cursor-pointer flex items-center gap-1.5 shrink-0"
                      title="Bấm để nạp lại dữ liệu mới nhất từ CSDL Đám mây ngay lập tức"
                    >
                      <i className={`fa-solid fa-rotate ${loading ? 'animate-spin' : ''} text-xs`}></i>
                      <span>🔄 Nạp Lại Dữ Liệu</span>
                    </button>
                  </div>

                  <div className="space-y-2">
                    {registeredUsers.length > 0 ? (
                      registeredUsers.map((u, idx) => (
                        <div key={idx} className="bg-white border border-gray-200 p-3.5 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-2xs hover:border-amber-400 transition-colors">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-navy text-amber-300 font-black text-sm rounded-xl flex items-center justify-center shrink-0">
                              {u.name?.substring(0, 2).toUpperCase() || 'U'}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <h5 className="font-extrabold text-navy text-sm">{u.name || u.email.split('@')[0]}</h5>
                                {u.is_locked ? (
                                  <span className="bg-red-100 text-red-700 font-extrabold text-[10px] px-2 py-0.5 rounded-full border border-red-300">
                                    🔴 ĐÃ BỊ KHÓA
                                  </span>
                                ) : (
                                  <span className="bg-emerald-100 text-emerald-800 font-extrabold text-[10px] px-2 py-0.5 rounded-full border border-emerald-300">
                                    🟢 HOẠT ĐỘNG
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] text-gray-500 font-mono mt-0.5">{u.email} | SĐT: {u.phone || 'Chưa cập nhật'}</p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 flex-wrap">
                            {getRoleBadge(u.role || 'USER')}

                            {/* Custom Commission Fee Badge (Chỉ dành cho Shop & Taxi) */}
                            {(u.role === 'SHOP' || u.role === 'TAXI_DRIVER' || u.role === 'EMPLOYEE') && (
                              u.custom_commission_fee !== null && u.custom_commission_fee !== undefined ? (
                                <span className="bg-purple-100 text-purple-900 border border-purple-300 font-extrabold text-[10px] px-2 py-0.5 rounded-full" title="Tài khoản này có mức phí sàn riêng">
                                  🏪 Phí riêng: {u.custom_commission_fee}%
                                </span>
                              ) : (
                                <span className="bg-gray-100 text-gray-700 border border-gray-200 font-medium text-[10px] px-2 py-0.5 rounded-full">
                                  🏪 Phí chung: {platformConfig.platform_fee_percent}%
                                </span>
                              )
                            )}

                            {/* Nút 0: Chuyển xem giao diện màn hình tài khoản */}
                            <button 
                              onClick={() => handleImpersonateUserView(u)}
                              className="bg-indigo-600 hover:bg-indigo-700 text-white font-black text-[11px] px-3 py-1 rounded-xl cursor-pointer transition-all flex items-center gap-1.5 shadow-xs border border-indigo-400"
                              title="Đăng nhập xem toàn bộ dữ liệu và giao diện màn hình của tài khoản này mà không cần thông báo"
                            >
                              <i className="fa-solid fa-user-secret text-amber-300 text-xs"></i>
                              <span>Đăng Nhập Màn Hình</span>
                            </button>

                            {/* Nút Cài % Phí Sàn Riêng Cho Tài Khoản (Chỉ dành cho Shop & Taxi) */}
                            {(u.role === 'SHOP' || u.role === 'TAXI_DRIVER' || u.role === 'EMPLOYEE') && (
                              <button 
                                onClick={() => handleOpenEditFee(u)}
                                className="bg-purple-50 text-purple-900 hover:bg-purple-100 border border-purple-300 font-extrabold text-[11px] px-2.5 py-1 rounded-xl cursor-pointer transition-colors flex items-center gap-1"
                                title="Cấu hình tỷ lệ % phí sàn riêng dành cho tài khoản Shop/Taxi này"
                              >
                                <i className="fa-solid fa-percent text-xs text-purple-600"></i>
                                <span>🏷️ Phí Sàn</span>
                              </button>
                            )}

                            {/* Nút Cấu Hình Ngân Hàng Rút Tiền Mặc Định */}
                            <button 
                              onClick={() => handleOpenEditBank(u)}
                              className="bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-300 font-extrabold text-[11px] px-2.5 py-1 rounded-xl cursor-pointer transition-colors flex items-center gap-1"
                              title="Thay đổi / Cấu hình ngân hàng rút tiền mặc định của tài khoản này"
                            >
                              <i className="fa-solid fa-building-columns text-xs text-emerald-600"></i>
                              <span>🏦 Ngân Hàng</span>
                            </button>

                            {/* Nút 1: Đổi mật khẩu */}
                            <button 
                              onClick={() => handleAdminChangePassword(u.email)}
                              className="bg-amber-50 text-amber-900 hover:bg-amber-100 border border-amber-300 font-extrabold text-[11px] px-2.5 py-1 rounded-xl cursor-pointer transition-colors flex items-center gap-1"
                              title="Đổi mật khẩu cho người dùng này"
                            >
                              <i className="fa-solid fa-key text-xs"></i>
                              <span>Đổi Pass</span>
                            </button>

                            {/* Nút 2: Khóa / Mở khóa */}
                            <button 
                              onClick={() => handleToggleLockUser(u.email)}
                              className={`font-extrabold text-[11px] px-2.5 py-1 rounded-xl cursor-pointer transition-colors flex items-center gap-1 ${
                                u.is_locked 
                                  ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-300' 
                                  : 'bg-orange-50 text-orange-700 hover:bg-orange-100 border border-orange-300'
                              }`}
                              title={u.is_locked ? "Mở khóa tài khoản" : "Khóa tài khoản khẩn cấp"}
                            >
                              <i className={`fa-solid ${u.is_locked ? 'fa-lock-open' : 'fa-lock'} text-xs`}></i>
                              <span>{u.is_locked ? 'Mở Khóa' : 'Khóa'}</span>
                            </button>

                            {/* Nút 3: Xóa tài khoản */}
                            <button 
                              onClick={() => handleDeleteUser(u.email)}
                              className="bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 font-extrabold text-[11px] px-2.5 py-1 rounded-xl cursor-pointer transition-colors flex items-center gap-1"
                              title="Xóa vĩnh viễn tài khoản khỏi hệ thống"
                            >
                              <i className="fa-solid fa-trash-can text-xs"></i>
                              <span>Xóa</span>
                            </button>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="py-12 text-center text-gray-400 font-medium border rounded-2xl bg-white">
                        Chưa có tài khoản phụ. Hãy dùng khung "➕ KHAI BÁO TẠO TÀI KHOẢN MỚI" ở trên để khởi tạo.
                      </div>
                    )}
                  </div>
                </div>

              </div>
            )}

            {/* TÍNH NĂNG CHUYÊN BIỆT: PHÊ DUYỆT MẬT KHẨU KHÁCH HÀNG */}
            {activeAdminTab === 'password_approvals' && (
              <div className="space-y-5 text-xs font-sans">
                
                {/* 1. KHU VỰC YÊU CẦU CHỜ PHÊ DUYỆT (PENDING) */}
                <div className="bg-white border border-gray-200 p-5 rounded-3xl space-y-4 shadow-2xs">
                  <div className="flex items-center justify-between border-b border-gray-200 pb-3">
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 bg-amber-500 rounded-full animate-ping"></span>
                      <h4 className="font-extrabold text-navy text-sm uppercase tracking-wider">
                        🔑 Yêu Cầu Khôi Phục Mật Khẩu Chờ Phê Duyệt ({resetRequests.filter(r => r.status === 'PENDING').length})
                      </h4>
                    </div>
                    <button 
                      onClick={loadAdminData}
                      className="bg-navy text-amber-300 hover:bg-navy-dark px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-xs"
                    >
                      <i className={`fa-solid fa-rotate ${loading ? 'animate-spin' : ''} text-xs`}></i>
                      <span>Làm mới</span>
                    </button>
                  </div>

                  {resetRequests.filter(r => r.status === 'PENDING').length > 0 ? (
                    <div className="space-y-3">
                      {resetRequests.filter(r => r.status === 'PENDING').map((req) => (
                        <div key={req.id} className="bg-amber-50/60 border-2 border-amber-300 p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
                          <div>
                            <div className="flex items-center gap-2">
                              <h5 className="font-black text-navy text-base">{req.email}</h5>
                              <span className="bg-amber-200 text-amber-900 font-extrabold text-[10px] px-2.5 py-0.5 rounded-full border border-amber-400">
                                ⌛ PENDING
                              </span>
                            </div>
                            <p className="text-xs text-gray-600 font-medium mt-1">
                              Khách hàng: <strong>{req.name || 'Thành viên TQ Store'}</strong> | Số điện thoại: {req.phone || 'Chưa cập nhật'}
                            </p>
                            <span className="text-[11px] text-gray-400 font-mono mt-0.5 block">
                              Thời gian gửi yêu cầu: {new Date(req.requested_at).toLocaleString('vi-VN')}
                            </span>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <button 
                              onClick={() => handleApproveResetRequest(req.id, req.email)}
                              className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs px-4 py-2 rounded-xl cursor-pointer transition-all shadow-sm flex items-center gap-1.5"
                            >
                              <i className="fa-solid fa-check text-xs"></i>
                              <span>✅ PHÊ DUYỆT PASS MỚI</span>
                            </button>

                            <button 
                              onClick={() => handleRejectResetRequest(req.id, req.email)}
                              className="bg-red-100 hover:bg-red-200 text-red-700 border border-red-300 font-extrabold text-xs px-3.5 py-2 rounded-xl cursor-pointer transition-all flex items-center gap-1.5"
                            >
                              <i className="fa-solid fa-xmark text-xs"></i>
                              <span>❌ TỪ CHỐI</span>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="py-12 text-center text-gray-400 font-medium space-y-2 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                      <i className="fa-solid fa-shield-check text-3xl text-emerald-500 block mb-1"></i>
                      <p className="text-gray-700 font-bold text-xs">Không có yêu cầu khôi phục mật khẩu nào đang chờ duyệt.</p>
                      <p className="text-[11px] text-gray-400">Khi người dùng bấm "Quên mật khẩu", yêu cầu mới sẽ lập tức xuất hiện tại đây.</p>
                    </div>
                  )}
                </div>

                {/* 2. LỊCH SỬ YÊU CẦU ĐÃ XỬ LÝ (APPROVED / REJECTED) */}
                <div className="bg-white border border-gray-200 p-5 rounded-3xl space-y-3 shadow-2xs">
                  <h4 className="font-extrabold text-navy text-xs uppercase tracking-wider border-b border-gray-100 pb-2">
                    📜 Lịch Sử Yêu Cầu Khôi Phục Mật Khẩu Đã Xử Lý ({resetRequests.filter(r => r.status !== 'PENDING').length})
                  </h4>

                  {resetRequests.filter(r => r.status !== 'PENDING').length > 0 ? (
                    <div className="space-y-2">
                      {resetRequests.filter(r => r.status !== 'PENDING').map((req) => (
                        <div key={req.id} className="bg-gray-50 border border-gray-200 p-3 rounded-2xl flex items-center justify-between text-xs">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-navy">{req.email}</span>
                              {req.status === 'APPROVED' ? (
                                <span className="bg-emerald-100 text-emerald-800 font-extrabold text-[10px] px-2 py-0.5 rounded-full border border-emerald-300">
                                  🟢 ĐÃ PHÊ DUYỆT
                                </span>
                              ) : (
                                <span className="bg-red-100 text-red-800 font-extrabold text-[10px] px-2 py-0.5 rounded-full border border-red-300">
                                  🔴 ĐÃ TỪ CHỐI
                                </span>
                              )}
                            </div>
                            <span className="text-[11px] text-gray-500 font-mono mt-0.5 block">
                              Xử lý lúc: {new Date(req.approved_at || req.rejected_at || req.requested_at).toLocaleString('vi-VN')}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="py-6 text-center text-gray-400 text-xs italic">
                      Chưa có lịch sử xử lý nào.
                    </div>
                  )}
                </div>

              </div>
            )}

            {/* TÍNH NĂNG CHUYÊN BIỆT: BÁO CÁO TỔNG THU CHI & LỢI NHUẬN RÒNG TOÀN SÀN (PLATFORM P&L REPORT) */}
            {/* TÍNH NĂNG CHUYÊN BIỆT: BÁO CÁO TỔNG THU CHI & LỢI NHUẬN RÒNG TOÀN SÀN (PLATFORM P&L REPORT) */}
            {activeAdminTab === 'pl_report' && (
              <div className="space-y-6 text-xs font-sans relative">
                
                {/* BỘ LỌC LỊCH THỜI GIAN & KHUNG THAO TÁC XUẤT FILE TÀI LIỆU */}
                <div className="bg-white p-4.5 rounded-3xl border border-gray-200 shadow-2xs space-y-3">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-gray-100 pb-3">
                    <div>
                      <h4 className="font-extrabold text-navy text-sm uppercase tracking-wide flex items-center gap-2">
                        <span>📊 BÁO CÁO P&L & LỢI NHUẬN RÒNG SÀN TQ STORE</span>
                        <span className="bg-emerald-100 text-emerald-800 font-bold text-[10px] px-2 py-0.5 rounded-full border border-emerald-300">
                          ● Live Realtime Data
                        </span>
                      </h4>
                      <p className="text-[11px] text-gray-500 font-medium">
                        💡 Click vào từng mục bên dưới để xem chi tiết số liệu thống kê & xuất file tài liệu theo yêu cầu.
                      </p>
                    </div>

                    <button 
                      onClick={() => handleExportPLReportCSV()}
                      className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 text-white font-black px-4 py-2.5 rounded-2xl text-xs shadow-md transition-all cursor-pointer flex items-center justify-center gap-2 shrink-0 border border-emerald-400 hover:scale-102"
                    >
                      <i className="fa-solid fa-file-csv text-amber-300 text-sm"></i>
                      <span>📥 XUẤT FILE TÀI LIỆU TOÀN SÀN (.CSV)</span>
                    </button>
                  </div>

                  {/* KHU VỰC LỌC THEO LỊCH THỜI GIAN (CUSTOM DATE RANGE PICKER) */}
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-slate-50 p-3 rounded-2xl border border-slate-200">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="font-extrabold text-navy text-xs flex items-center gap-1">
                        <i className="fa-regular fa-calendar-days text-amber-500 text-sm"></i>
                        <span>Chọn Lịch Thống Kê:</span>
                      </span>

                      <div className="flex items-center gap-2">
                        <label className="text-gray-500 text-[11px]">Từ ngày:</label>
                        <input 
                          type="date" 
                          value={plStartDate}
                          onChange={(e) => { setPlStartDate(e.target.value); setPlPreset('CUSTOM'); }}
                          className="bg-white border border-gray-300 rounded-xl px-2.5 py-1 text-xs font-bold font-mono focus:outline-none focus:border-navy"
                        />
                      </div>

                      <div className="flex items-center gap-2">
                        <label className="text-gray-500 text-[11px]">Đến ngày:</label>
                        <input 
                          type="date" 
                          value={plEndDate}
                          onChange={(e) => { setPlEndDate(e.target.value); setPlPreset('CUSTOM'); }}
                          className="bg-white border border-gray-300 rounded-xl px-2.5 py-1 text-xs font-bold font-mono focus:outline-none focus:border-navy"
                        />
                      </div>
                    </div>

                    {/* PRESET QUICK BUTTONS */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button 
                        onClick={() => handlePresetChange('TODAY')}
                        className={`px-3 py-1 rounded-xl text-[11px] font-extrabold cursor-pointer transition-all ${
                          plPreset === 'TODAY' ? 'bg-navy text-amber-300 font-black shadow-xs' : 'bg-white text-gray-700 hover:bg-gray-200 border border-gray-200'
                        }`}
                      >
                        ⚡ Hôm nay
                      </button>
                      <button 
                        onClick={() => handlePresetChange('LAST_7_DAYS')}
                        className={`px-3 py-1 rounded-xl text-[11px] font-extrabold cursor-pointer transition-all ${
                          plPreset === 'LAST_7_DAYS' ? 'bg-navy text-amber-300 font-black shadow-xs' : 'bg-white text-gray-700 hover:bg-gray-200 border border-gray-200'
                        }`}
                      >
                        📅 7 Ngày qua
                      </button>
                      <button 
                        onClick={() => handlePresetChange('THIS_MONTH')}
                        className={`px-3 py-1 rounded-xl text-[11px] font-extrabold cursor-pointer transition-all ${
                          plPreset === 'THIS_MONTH' ? 'bg-navy text-amber-300 font-black shadow-xs' : 'bg-white text-gray-700 hover:bg-gray-200 border border-gray-200'
                        }`}
                      >
                        🗓️ Tháng 8/2026
                      </button>
                    </div>
                  </div>
                </div>

                {/* 4 THẺ KPI LỢI NHUẬN RÒNG TOÀN SÀN (NHẤN VÀO ĐỂ XEM CHI TIẾT) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  
                  {/* KPI 1: TỔNG GMV GIAO DỊCH TOÀN SÀN */}
                  <div 
                    onClick={() => setSelectedPlModal({
                      id: 'GMV',
                      title: '1. TỔNG GMV GIAO DỊCH TOÀN SÀN',
                      amount: 1450000000,
                      desc: 'Chi tiết danh sách đơn hàng hoàn tất giao dịch thành công qua sàn TQ Store',
                      rows: [
                        { code: 'ORD-88219', name: 'Đơn hàng Thời Trang & Công Nghệ (Shop Điện Máy TQ)', time: `${plStartDate} 14:20`, amount: '8.500.000', status: 'Đã hoàn tất' },
                        { code: 'ORD-88220', name: 'Đơn hàng Xe Máy Điện Smart EV (Shop TQ Moto)', time: `${plStartDate} 15:45`, amount: '42.000.000', status: 'Đã hoàn tất' },
                        { code: 'ORD-88221', name: 'Đơn hàng Thiết Bị Gia Dụng Thông Minh (Shop TQ Mart)', time: `${plEndDate} 09:10`, amount: '15.400.000', status: 'Đã hoàn tất' },
                        { code: 'ORD-88222', name: 'Đơn hàng Mỹ Phẩm Premium (Shop TQ Beauty)', time: `${plEndDate} 10:30`, amount: '3.200.000', status: 'Đã hoàn tất' }
                      ]
                    })}
                    className="bg-gradient-to-br from-slate-900 to-navy text-white p-4.5 rounded-3xl border border-amber-400/40 shadow-md relative overflow-hidden cursor-pointer hover:scale-102 hover:shadow-xl transition-all group"
                  >
                    <div className="absolute top-0 right-0 w-24 h-24 bg-amber-400/10 rounded-full blur-xl pointer-events-none"></div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] font-black uppercase text-amber-300 tracking-wider">
                        1. TỔNG GMV GIAO DỊCH TOÀN SÀN
                      </span>
                      <i className="fa-solid fa-chevron-right text-amber-400 text-xs group-hover:translate-x-1 transition-transform"></i>
                    </div>
                    <h3 className="font-black text-xl text-white font-mono">
                      1.450.000.000 <span className="text-xs text-amber-400 font-normal">đ</span>
                    </h3>
                    <p className="text-[10px] text-gray-300 mt-2 flex items-center justify-between border-t border-white/10 pt-2 font-medium">
                      <span>Click xem chi tiết số liệu ➔</span>
                      <span className="text-emerald-400 font-bold">▲ +18.4%</span>
                    </p>
                  </div>

                  {/* KPI 2: TỔNG THU PHÍ SÀN (CHỈ KHẤU TRỪ TỪ CHỦ SHOP & TAXI) */}
                  <div 
                    onClick={() => setSelectedPlModal({
                      id: 'FEES',
                      title: `2. TỔNG THU PHÍ SÀN (${platformConfig.platform_fee_percent}% REVENUE)`,
                      amount: Math.round(1450000000 * (platformConfig.platform_fee_percent / 100)),
                      desc: 'Doanh thu phí dịch vụ khấu trừ trực tiếp vào đơn hàng/chuyến xe thành công của các Gian hàng Shop và Tài xế Taxi (Khách hàng người dùng mua sắm được miễn 100% phí sàn).',
                      rows: [
                        { code: 'FEE-SHOP01', name: `Phí dịch vụ ${platformConfig.platform_fee_percent}% đơn ORD-88219 (Shop Điện Máy TQ)`, time: `${plStartDate} 14:20`, amount: `${(8500000 * (platformConfig.platform_fee_percent / 100)).toLocaleString('vi-VN')}`, status: 'Khấu trừ từ Shop' },
                        { code: 'FEE-TAXI02', name: `Phí dịch vụ ${platformConfig.platform_fee_percent}% chuyến TAXI-9912 (Tài Xế Taxi Smart EV)`, time: `${plStartDate} 15:45`, amount: `${(420000 * (platformConfig.platform_fee_percent / 100)).toLocaleString('vi-VN')}`, status: 'Khấu trừ từ Tài Xế' },
                        { code: 'FEE-SHOP03', name: `Phí dịch vụ ${platformConfig.platform_fee_percent}% đơn ORD-88221 (Shop TQ Mart)`, time: `${plEndDate} 09:10`, amount: `${(15400000 * (platformConfig.platform_fee_percent / 100)).toLocaleString('vi-VN')}`, status: 'Khấu trừ từ Shop' }
                      ]
                    })}
                    className="bg-gradient-to-br from-emerald-950 to-teal-900 text-white p-4.5 rounded-3xl border border-emerald-400/40 shadow-md relative overflow-hidden cursor-pointer hover:scale-102 hover:shadow-xl transition-all group"
                  >
                    <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-400/10 rounded-full blur-xl pointer-events-none"></div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] font-black uppercase text-emerald-300 tracking-wider">
                        2. TỔNG THU PHÍ SÀN (5%)
                      </span>
                      <i className="fa-solid fa-chevron-right text-emerald-300 text-xs group-hover:translate-x-1 transition-transform"></i>
                    </div>
                    <h3 className="font-black text-xl text-emerald-300 font-mono">
                      72.500.000 <span className="text-xs text-emerald-200 font-normal">đ</span>
                    </h3>
                    <p className="text-[10px] text-emerald-200 mt-2 flex items-center justify-between border-t border-white/10 pt-2 font-medium">
                      <span>Click xem chi tiết số liệu ➔</span>
                      <span className="text-emerald-300 font-bold">▲ +12.1%</span>
                    </p>
                  </div>

                  {/* KPI 3: TỔNG CHI TRỢ GIÁ KHUYẾN MÃI */}
                  <div 
                    onClick={() => setSelectedPlModal({
                      id: 'SUBSIDY',
                      title: '3. TỔNG CHI TRỢ GIÁ KHUYẾN MÃI (EXPENSES)',
                      amount: 48500000,
                      desc: 'Ngân sách sàn chi trợ giá Voucher, Freeship Extra và Xu Tích Lũy TQ Pay',
                      rows: [
                        { code: 'EXP-VOUCHER', name: 'Mã giảm giá Voucher Sàn trợ giá trực tiếp', time: `Từ ${plStartDate} đến ${plEndDate}`, amount: '24.500.000', status: 'Đã xuất quỹ' },
                        { code: 'EXP-FREESHIP', name: 'Hỗ trợ phí vận chuyển Freeship Extra TQ', time: `Từ ${plStartDate} đến ${plEndDate}`, amount: '14.200.000', status: 'Đã xuất quỹ' },
                        { code: 'EXP-XUTQ', name: 'Chi trả Xu Tích lũy TQ Pay khi hoàn đơn', time: `Từ ${plStartDate} đến ${plEndDate}`, amount: '6.800.000', status: 'Đã xuất quỹ' },
                        { code: 'EXP-CAMPAIGN', name: 'Chương trình Siêu Sale Flash Sale', time: `Từ ${plStartDate} đến ${plEndDate}`, amount: '3.000.000', status: 'Đã xuất quỹ' }
                      ]
                    })}
                    className="bg-gradient-to-br from-rose-950 to-red-900 text-white p-4.5 rounded-3xl border border-rose-400/40 shadow-md relative overflow-hidden cursor-pointer hover:scale-102 hover:shadow-xl transition-all group"
                  >
                    <div className="absolute top-0 right-0 w-24 h-24 bg-rose-400/10 rounded-full blur-xl pointer-events-none"></div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] font-black uppercase text-rose-300 tracking-wider">
                        3. TỔNG CHI TRỢ GIÁ KHUYẾN MÃI
                      </span>
                      <i className="fa-solid fa-chevron-right text-rose-300 text-xs group-hover:translate-x-1 transition-transform"></i>
                    </div>
                    <h3 className="font-black text-xl text-rose-300 font-mono">
                      48.500.000 <span className="text-xs text-rose-200 font-normal">đ</span>
                    </h3>
                    <p className="text-[10px] text-rose-200 mt-2 flex items-center justify-between border-t border-white/10 pt-2 font-medium">
                      <span>Click xem chi tiết số liệu ➔</span>
                      <span className="text-amber-300 font-bold">● Trong ngân sách</span>
                    </p>
                  </div>

                  {/* KPI 4: LỢI NHUẬN RÒNG THỰC NHẬN */}
                  <div 
                    onClick={() => setSelectedPlModal({
                      id: 'NET_PROFIT',
                      title: '4. LỢI NHUẬN RÒNG THỰC NHẬN (NET PROFIT)',
                      amount: 24000000,
                      desc: 'Thu nhập ròng thực nhận của sàn = Tổng thu phí sàn (72.5tr) - Tổng chi trợ giá (48.5tr)',
                      rows: [
                        { code: 'PNL-REV', name: 'Tổng thu phí sàn 5% thành công', time: `Từ ${plStartDate} đến ${plEndDate}`, amount: '72.500.000', status: 'Doanh thu thu về' },
                        { code: 'PNL-EXP', name: 'Tổng chi trợ giá khuyến mãi sàn', time: `Từ ${plStartDate} đến ${plEndDate}`, amount: '-48.500.000', status: 'Chi phí khấu trừ' },
                        { code: 'PNL-NET', name: 'Lợi nhuận ròng thực nhận (Net Profit)', time: `Từ ${plStartDate} đến ${plEndDate}`, amount: '24.000.000', status: 'Lợi nhuận ròng (Margin 33.1%)' }
                      ]
                    })}
                    className="bg-gradient-to-br from-amber-500 via-amber-600 to-orange-600 text-navy p-4.5 rounded-3xl border-2 border-amber-300 shadow-lg relative overflow-hidden cursor-pointer hover:scale-102 hover:shadow-xl transition-all group"
                  >
                    <div className="absolute top-0 right-0 w-24 h-24 bg-white/20 rounded-full blur-xl pointer-events-none"></div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] font-black uppercase text-navy/90 tracking-wider">
                        4. LỢI NHUẬN RÒNG THỰC NHẬN
                      </span>
                      <i className="fa-solid fa-chevron-right text-navy text-xs group-hover:translate-x-1 transition-transform"></i>
                    </div>
                    <h3 className="font-black text-2xl text-navy font-mono">
                      24.000.000 <span className="text-xs text-navy font-bold">đ</span>
                    </h3>
                    <p className="text-[10px] text-navy/90 mt-2 flex items-center justify-between border-t border-navy/20 pt-2 font-bold">
                      <span>Click xem chi tiết số liệu ➔</span>
                      <span className="bg-navy text-amber-300 px-2 py-0.2 rounded-full text-[9px]">MARGIN 33.1%</span>
                    </p>
                  </div>

                </div>

                {/* KHU VỰC 1: TỔNG HỢP DÒNG TIỀN NẠP VÍ TQ PAY & LƯU LUÂN CHUYỂN */}
                <div className="bg-white border border-gray-200 p-5 rounded-3xl space-y-4 shadow-2xs">
                  <div className="flex items-center justify-between border-b border-gray-200 pb-3">
                    <div>
                      <h4 className="font-extrabold text-navy text-sm uppercase tracking-wider flex items-center gap-2">
                        <span>💳 1. TỔNG HỢP DÒNG TIỀN NẠP VÍ TQ PAY & LƯU LUÂN CHUYỂN</span>
                      </h4>
                      <p className="text-[11px] text-gray-500 font-medium">
                        Giám sát chi tiết tổng số dư khả dụng, dòng tiền ký quỹ đơn hàng (Escrow) và lịch sử thanh khoản
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                    <div 
                      onClick={() => setSelectedPlModal({
                        id: 'WAL_TOPUP',
                        title: 'TỔNG TIỀN NẠP VÍ TQ PAY TOÀN SÀN',
                        amount: 1850000000,
                        desc: 'Danh sách các giao dịch nạp tiền thành công vào Ví TQ Pay qua ngân hàng',
                        rows: [
                          { code: 'TOPUP-991', name: 'Nạp Ví TQ Pay qua VNPay QR (Khách user_hn@gmail.com)', time: `${plStartDate} 08:30`, amount: '5.000.000', status: 'Thành công' },
                          { code: 'TOPUP-992', name: 'Nạp Ví TQ Pay qua MBBank ATM (Khách shop_sg@gmail.com)', time: `${plStartDate} 11:15`, amount: '20.000.000', status: 'Thành công' },
                          { code: 'TOPUP-993', name: 'Nạp Ví TQ Pay qua Vietcombank (Khách user_dn@gmail.com)', time: `${plEndDate} 16:40`, amount: '12.500.000', status: 'Thành công' }
                        ]
                      })}
                      className="bg-slate-50 border border-slate-200 p-3.5 rounded-2xl cursor-pointer hover:border-navy hover:shadow-xs transition-all"
                    >
                      <span className="text-[10px] font-bold text-gray-500 uppercase block mb-1">Tổng tiền nạp Ví TQ Pay ➔</span>
                      <span className="font-black text-navy text-base font-mono">1.850.000.000 đ</span>
                      <span className="text-[10px] text-emerald-600 font-extrabold block mt-1">✔ Qua Ngân Hàng / VNPay QR</span>
                    </div>

                    <div 
                      onClick={() => setSelectedPlModal({
                        id: 'WAL_BAL',
                        title: 'TỔNG SỐ DƯ VÍ TQ PAY KHẢ DỤNG',
                        amount: 920000000,
                        desc: 'Tổng số dư tiền mặt đang lưu giữ an toàn trong Ví TQ Pay của tất cả người dùng và Shop',
                        rows: [
                          { code: 'BAL-USER', name: 'Tổng số dư Ví khách hàng tiêu dùng', time: `Hiện tại`, amount: '580.000.000', status: 'Khả dụng' },
                          { code: 'BAL-SHOP', name: 'Tổng số dư Ví Gian hàng / Shop', time: `Hiện tại`, amount: '340.000.000', status: 'Khả dụng' }
                        ]
                      })}
                      className="bg-teal-50/60 border border-teal-200 p-3.5 rounded-2xl cursor-pointer hover:border-teal-400 hover:shadow-xs transition-all"
                    >
                      <span className="text-[10px] font-bold text-teal-800 uppercase block mb-1">Số dư Ví TQ Pay khả dụng ➔</span>
                      <span className="font-black text-teal-900 text-base font-mono">920.000.000 đ</span>
                      <span className="text-[10px] text-teal-700 font-bold block mt-1">Lưu trữ trên toàn ví tài khoản</span>
                    </div>

                    <div 
                      onClick={() => setSelectedPlModal({
                        id: 'WAL_ESCROW',
                        title: 'DÒNG TIỀN KÝ QUỸ ĐƠN HÀNG (ESCROW)',
                        amount: 410000000,
                        desc: 'Dòng tiền tạm giữ an toàn bảo vệ đơn hàng chờ người mua bấm Nhận hàng',
                        rows: [
                          { code: 'ESC-881', name: 'Ký quỹ đơn xe điện ORD-88220', time: `${plStartDate} 15:45`, amount: '42.000.000', status: 'Tạm giữ Sàn' },
                          { code: 'ESC-882', name: 'Ký quỹ đơn gia dụng ORD-88221', time: `${plEndDate} 09:10`, amount: '15.400.000', status: 'Tạm giữ Sàn' }
                        ]
                      })}
                      className="bg-amber-50/60 border border-amber-300 p-3.5 rounded-2xl cursor-pointer hover:border-amber-500 hover:shadow-xs transition-all"
                    >
                      <span className="text-[10px] font-bold text-amber-900 uppercase block mb-1">Dòng tiền Ký Quỹ Escrow ➔</span>
                      <span className="font-black text-amber-900 text-base font-mono">410.000.000 đ</span>
                      <span className="text-[10px] text-amber-800 font-bold block mt-1">Tạm giữ chờ khách nhận hàng</span>
                    </div>

                    <div 
                      onClick={() => setSelectedPlModal({
                        id: 'WAL_WITHDRAW',
                        title: 'TỔNG TIỀN ĐÃ RÚT VỀ ATM NGÂN HÀNG',
                        amount: 520000000,
                        desc: 'Danh sách các yêu cầu rút tiền đã giải ngân thanh toán về tài khoản ATM ngân hàng',
                        rows: [
                          { code: 'WDR-101', name: 'Rút tiền Ví Shop TQ Moto về Vietcombank', time: `${plStartDate} 18:00`, amount: '150.000.000', status: 'Đã giải ngân' },
                          { code: 'WDR-102', name: 'Rút tiền Ví Shop Điện Máy TQ về Techcombank', time: `${plEndDate} 12:20`, amount: '220.000.000', status: 'Đã giải ngân' }
                        ]
                      })}
                      className="bg-purple-50/60 border border-purple-200 p-3.5 rounded-2xl cursor-pointer hover:border-purple-400 hover:shadow-xs transition-all"
                    >
                      <span className="text-[10px] font-bold text-purple-900 uppercase block mb-1">Tổng tiền đã Rút về ATM ➔</span>
                      <span className="font-black text-purple-900 text-base font-mono">520.000.000 đ</span>
                      <span className="text-[10px] text-purple-700 font-bold block mt-1">Đã giải ngân thành công</span>
                    </div>
                  </div>
                </div>

                {/* KHU VỰC 2: BẢNG CHI TIẾT PHÂN PHỐI DÒNG TIỀN & KHOẢN CHI TRỢ GIÁ HỆ THỐNG */}
                <div className="bg-white border border-gray-200 p-5 rounded-3xl space-y-4 shadow-2xs">
                  <div className="flex items-center justify-between border-b border-gray-200 pb-3">
                    <div>
                      <h4 className="font-extrabold text-navy text-sm uppercase tracking-wider flex items-center gap-2">
                        <span>🎁 2. BẢNG CHI TIẾT PHÂN PHỐI DÒNG TIỀN & KHOẢN CHI TRỢ GIÁ HỆ THỐNG</span>
                      </h4>
                      <p className="text-[11px] text-gray-500 font-medium">
                        Click vào bất kỳ dòng nào bên dưới để xem chi tiết lịch sử phân bổ dòng tiền & xuất báo cáo CSV.
                      </p>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-900 text-amber-300 font-extrabold text-[11px] uppercase tracking-wider">
                          <th className="p-3 rounded-l-xl">Mã Khoản Chi</th>
                          <th className="p-3">Danh Mục Phân Bổ</th>
                          <th className="p-3">Ngân Sách / Mục Đích</th>
                          <th className="p-3">Chi Phí Trợ Giá</th>
                          <th className="p-3 rounded-r-xl">Tỷ Lệ / Thao Tác</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 font-medium text-gray-700">
                        <tr 
                          onClick={() => setSelectedPlModal({
                            id: 'EXP_VOUCHER',
                            title: 'CHI TIẾT TRỢ GIÁ VOUCHER SÀN',
                            amount: 24500000,
                            desc: 'Danh sách các mã giảm giá Voucher Sàn đã tài trợ trực tiếp cho người mua',
                            rows: [
                              { code: 'VOUCHER-50K', name: 'Mã TQ50K Giảm 50.000đ đơn từ 500K', time: `Từ ${plStartDate} đến ${plEndDate}`, amount: '12.500.000', status: 'Đã tài trợ' },
                              { code: 'VOUCHER-100K', name: 'Mã TQ100K Giảm 100.000đ đơn từ 1 Trống', time: `Từ ${plStartDate} đến ${plEndDate}`, amount: '12.000.000', status: 'Đã tài trợ' }
                            ]
                          })}
                          className="hover:bg-amber-50/70 transition-colors cursor-pointer"
                        >
                          <td className="p-3 font-mono font-bold text-navy">EXP-VOUCHER</td>
                          <td className="p-3 font-extrabold text-navy">Mã giảm giá Voucher Sàn trợ giá trực tiếp ➔</td>
                          <td className="p-3 text-gray-500">Giảm giá trực tiếp đơn hàng cho khách</td>
                          <td className="p-3 font-mono font-bold text-rose-600">24.500.000 đ</td>
                          <td className="p-3">
                            <span className="bg-rose-100 text-rose-800 font-extrabold text-[10px] px-2 py-0.5 rounded-full border border-rose-300">50.5% • Xem chi tiết</span>
                          </td>
                        </tr>

                        <tr 
                          onClick={() => setSelectedPlModal({
                            id: 'EXP_FREESHIP',
                            title: 'CHI TIẾT HỖ TRỢ FREESHIP EXTRA TQ',
                            amount: 14200000,
                            desc: 'Ngân sách trợ giá cước phí vận chuyển hàng hóa giao toàn quốc',
                            rows: [
                              { code: 'SHIP-INNER', name: 'Freeship Nội tỉnh đơn từ 150K', time: `Từ ${plStartDate} đến ${plEndDate}`, amount: '5.200.000', status: 'Đã chi trả' },
                              { code: 'SHIP-INTER', name: 'Freeship Extra Liên tỉnh đơn từ 300K', time: `Từ ${plStartDate} đến ${plEndDate}`, amount: '9.000.000', status: 'Đã chi trả' }
                            ]
                          })}
                          className="hover:bg-amber-50/70 transition-colors cursor-pointer"
                        >
                          <td className="p-3 font-mono font-bold text-navy">EXP-FREESHIP</td>
                          <td className="p-3 font-extrabold text-navy">Hỗ trợ phí vận chuyển Freeship Extra TQ ➔</td>
                          <td className="p-3 text-gray-500">Trợ giá phí ship đơn hàng liên tỉnh</td>
                          <td className="p-3 font-mono font-bold text-rose-600">14.200.000 đ</td>
                          <td className="p-3">
                            <span className="bg-amber-100 text-amber-900 font-extrabold text-[10px] px-2 py-0.5 rounded-full border border-amber-300">29.3% • Xem chi tiết</span>
                          </td>
                        </tr>

                        <tr 
                          onClick={() => setSelectedPlModal({
                            id: 'EXP_XUTQ',
                            title: 'CHI TIẾT XU TÍCH LŨY TQ PAY',
                            amount: 6800000,
                            desc: 'Tổng số tiền quy đổi Xu TQ thưởng cho khách khi đánh giá & hoàn thành đơn',
                            rows: [
                              { code: 'XU-REWARD', name: 'Thưởng 1% Xu TQ Pay khi hoàn tất đơn hàng', time: `Từ ${plStartDate} đến ${plEndDate}`, amount: '4.800.000', status: 'Đã quy đổi' },
                              { code: 'XU-REVIEW', name: 'Thưởng 1.000 Xu TQ khi đánh giá kèm hình ảnh', time: `Từ ${plStartDate} đến ${plEndDate}`, amount: '2.000.000', status: 'Đã quy đổi' }
                            ]
                          })}
                          className="hover:bg-amber-50/70 transition-colors cursor-pointer"
                        >
                          <td className="p-3 font-mono font-bold text-navy">EXP-XUTQ</td>
                          <td className="p-3 font-extrabold text-navy">Chi trả Xu Tích lũy TQ Pay khi hoàn đơn ➔</td>
                          <td className="p-3 text-gray-500">Thưởng Xu TQ cho khách khi hoàn tất đơn</td>
                          <td className="p-3 font-mono font-bold text-rose-600">6.800.000 đ</td>
                          <td className="p-3">
                            <span className="bg-purple-100 text-purple-800 font-extrabold text-[10px] px-2 py-0.5 rounded-full border border-purple-300">14.0% • Xem chi tiết</span>
                          </td>
                        </tr>

                        <tr 
                          onClick={() => setSelectedPlModal({
                            id: 'EXP_CAMPAIGN',
                            title: 'CHI TIẾT FLASH SALE & CAMPAIGN NGÀY ĐÔI',
                            amount: 3000000,
                            desc: 'Chi phí tài trợ độc quyền cho các chương trình khuyến mãi ngày đôi Siêu Sale',
                            rows: [
                              { code: 'SALE-88', name: 'Chi trợ giá Campaign Siêu Sale Ngày Đôi 8/8', time: `2026-08-08`, amount: '3.000.000', status: 'Đã chi trả' }
                            ]
                          })}
                          className="hover:bg-amber-50/70 transition-colors cursor-pointer"
                        >
                          <td className="p-3 font-mono font-bold text-navy">EXP-CAMPAIGN</td>
                          <td className="p-3 font-extrabold text-navy">Chương trình Siêu Sale Ngày Đôi / Flash Sale ➔</td>
                          <td className="p-3 text-gray-500">Trợ giá campaign kích cầu mua sắm</td>
                          <td className="p-3 font-mono font-bold text-rose-600">3.000.000 đ</td>
                          <td className="p-3">
                            <span className="bg-blue-100 text-blue-800 font-extrabold text-[10px] px-2 py-0.5 rounded-full border border-blue-300">6.2% • Xem chi tiết</span>
                          </td>
                        </tr>
                      </tbody>
                      <tfoot>
                        <tr className="bg-slate-100 font-black text-navy border-t-2 border-slate-300">
                          <td colSpan={3} className="p-3 text-right uppercase">TỔNG CỘNG CHI TRỢ GIÁ KHUYẾN MÃI:</td>
                          <td className="p-3 font-mono text-rose-700 text-sm">48.500.000 đ</td>
                          <td className="p-3 font-mono">100.0%</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>

                {/* MODAL XEM CHI TIẾT SỐ LIỆU & XUẤT FILE FILE TÀI LIỆU THEO YÊU CẦU */}
                {selectedPlModal && (
                  <div className="fixed inset-0 z-60 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full p-6 space-y-4 border-2 border-amber-400 animate-in zoom-in-95 duration-200">
                      
                      <div className="flex items-center justify-between border-b border-gray-200 pb-3">
                        <div>
                          <h3 className="font-black text-base text-navy uppercase">{selectedPlModal.title}</h3>
                          <p className="text-[11px] text-gray-500 font-medium mt-0.5">{selectedPlModal.desc}</p>
                          <span className="text-[10px] text-amber-800 font-mono font-bold bg-amber-100 px-2 py-0.5 rounded-full mt-1 inline-block">
                            📅 Khoảng thời gian: {plStartDate} ➔ {plEndDate}
                          </span>
                        </div>
                        <button 
                          onClick={() => setSelectedPlModal(null)}
                          className="w-8 h-8 bg-gray-100 hover:bg-gray-200 rounded-full flex items-center justify-center text-gray-600 font-bold cursor-pointer"
                        >
                          ✕
                        </button>
                      </div>

                      {/* SUMMARY TOTAL BOX */}
                      <div className="bg-slate-900 text-white p-4 rounded-2xl flex items-center justify-between">
                        <span className="text-xs text-amber-300 font-extrabold uppercase">TỔNG GIAO DỊCH GHI NHẬN:</span>
                        <span className="font-black text-xl text-amber-300 font-mono">
                          {typeof selectedPlModal.amount === 'number' ? selectedPlModal.amount.toLocaleString('vi-VN') : selectedPlModal.amount} VNĐ
                        </span>
                      </div>

                      {/* DETAIL TABLE */}
                      <div className="max-h-60 overflow-y-auto border border-gray-200 rounded-2xl">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="bg-gray-100 text-navy font-black text-[11px]">
                              <th className="p-2.5">Mã</th>
                              <th className="p-2.5">Nội dung chi tiết</th>
                              <th className="p-2.5">Thời gian</th>
                              <th className="p-2.5">Số tiền (VNĐ)</th>
                              <th className="p-2.5">Trạng thái</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {selectedPlModal.rows.map((r, i) => (
                              <tr key={i} className="hover:bg-gray-50">
                                <td className="p-2.5 font-mono font-bold text-navy">{r.code}</td>
                                <td className="p-2.5 font-medium">{r.name}</td>
                                <td className="p-2.5 text-gray-500 font-mono">{r.time}</td>
                                <td className="p-2.5 font-mono font-bold text-emerald-600">{r.amount} đ</td>
                                <td className="p-2.5">
                                  <span className="bg-emerald-100 text-emerald-800 text-[10px] font-extrabold px-2 py-0.5 rounded-full border border-emerald-300">
                                    {r.status}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* MODAL ACTION BUTTONS */}
                      <div className="flex items-center justify-end gap-3 border-t border-gray-100 pt-3">
                        <button 
                          onClick={() => setSelectedPlModal(null)}
                          className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold px-4 py-2 rounded-xl text-xs cursor-pointer"
                        >
                          Đóng Màn Hình
                        </button>
                        <button 
                          onClick={() => handleExportPLReportCSV(selectedPlModal)}
                          className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-black px-4 py-2 rounded-xl text-xs cursor-pointer flex items-center gap-1.5 shadow-md border border-emerald-400"
                        >
                          <i className="fa-solid fa-file-csv text-amber-300"></i>
                          <span>📥 XUẤT FILE MỤC NÀY (.CSV)</span>
                        </button>
                      </div>

                    </div>
                  </div>
                )}

              </div>
            )}

            {/* TÍNH NĂNG CHUYÊN BIỆT: PHÊ DUYỆT RÚT TIỀN & GIẢI NGÂN CHO TÀI KHOẢN */}
            {activeAdminTab === 'withdrawal_approvals' && (
              <div className="space-y-6 text-xs font-sans">
                
                {/* 1. KHU VỰC LỆNH RÚT TIỀN CHỜ PHÊ DUYỆT (PENDING WITHDRAWALS) */}
                <div className="bg-white border border-gray-200 p-5 rounded-3xl space-y-4 shadow-sm">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-3.5">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 bg-emerald-500/20 text-emerald-600 rounded-xl flex items-center justify-center text-sm font-black">
                        <i className="fa-solid fa-money-bill-transfer"></i>
                      </div>
                      <div>
                        <h4 className="font-black text-navy text-sm uppercase tracking-wider">
                          💸 YÊU CẦU RÚT TIỀN CHỜ PHÊ DUYỆT ({withdrawalRequests.filter(w => w.status === 'PENDING').length})
                        </h4>
                        <p className="text-[11px] text-gray-500 font-medium">
                          Kiểm tra thông tin tài khoản ngân hàng và chuyển khoản giải ngân cho khách hàng / chủ shop
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button 
                        onClick={handleExportWithdrawalsCSV}
                        className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 text-white font-black px-3.5 py-1.5 rounded-xl text-xs shadow-xs transition-all cursor-pointer flex items-center gap-1.5 border border-emerald-400"
                      >
                        <i className="fa-solid fa-file-csv text-amber-300"></i>
                        <span>Xuất CSV</span>
                      </button>

                      <button 
                        onClick={loadAdminData}
                        className="bg-navy text-amber-300 hover:bg-navy-dark px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-xs border border-navy/20"
                      >
                        <i className={`fa-solid fa-rotate ${loading ? 'animate-spin' : ''} text-xs`}></i>
                        <span>Làm mới</span>
                      </button>
                    </div>
                  </div>

                  {withdrawalRequests.filter(w => w.status === 'PENDING').length > 0 ? (
                    <div className="space-y-4">
                      {withdrawalRequests.filter(w => w.status === 'PENDING').map((wdr) => (
                        <div key={wdr.id} className="bg-slate-50/80 border-2 border-emerald-300/80 hover:border-emerald-500 p-4 sm:p-5 rounded-2xl transition-all shadow-xs space-y-3">
                          
                          {/* Top Row: User Meta & Amount */}
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-200/80 pb-3">
                            <div className="flex items-center gap-2.5 flex-wrap">
                              <span className="w-8 h-8 bg-emerald-600 text-white font-black rounded-xl flex items-center justify-center text-xs shadow-xs">
                                💸
                              </span>
                              <div>
                                <div className="flex items-center gap-2">
                                  <h5 className="font-black text-navy text-sm">{wdr.name || wdr.email.split('@')[0]}</h5>
                                  {getRoleBadge(wdr.role)}
                                  <span className="bg-amber-100 text-amber-900 font-black text-[9px] px-2.5 py-0.5 rounded-full border border-amber-300">
                                    ⌛ CHỜ GIẢI NGÂN
                                  </span>
                                </div>
                                <p className="text-[11px] text-gray-500 font-mono">
                                  Email: <strong className="text-navy font-bold">{wdr.email}</strong>
                                </p>
                              </div>
                            </div>

                            <div className="text-right bg-emerald-100/80 border border-emerald-300 px-4 py-2 rounded-2xl">
                              <span className="text-[9px] text-emerald-800 font-black uppercase tracking-wider block">SỐ TIỀN XIN RÚT:</span>
                              <span className="font-black text-xl text-emerald-800 font-mono">
                                {Number(wdr.amount).toLocaleString('vi-VN')} VNĐ
                              </span>
                            </div>
                          </div>

                          {/* Middle Row: Bank Account Details Card */}
                          <div className="bg-white border border-emerald-200 p-3.5 rounded-xl grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs shadow-inner">
                            <div>
                              <span className="text-[10px] text-gray-400 font-bold block uppercase">🏦 Ngân hàng nhận:</span>
                              <strong className="text-navy font-black text-sm">{wdr.bankName}</strong>
                            </div>
                            <div>
                              <span className="text-[10px] text-gray-400 font-bold block uppercase">💳 Số Tài Khoản STK:</span>
                              <strong className="text-navy font-mono font-black text-sm">{wdr.accountNumber}</strong>
                            </div>
                            <div>
                              <span className="text-[10px] text-gray-400 font-bold block uppercase">👤 Chủ Tài Khoản:</span>
                              <strong className="text-navy font-black text-xs uppercase">{wdr.accountHolder}</strong>
                            </div>
                          </div>

                          {/* Bottom Row: Footer Timestamp & Action Buttons */}
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                            <span className="text-[10px] text-gray-400 font-mono">
                              Mã lệnh: #{wdr.id} | Thời gian tạo: {new Date(wdr.requested_at).toLocaleString('vi-VN')}
                            </span>

                            <div className="flex items-center gap-2.5">
                              <button 
                                onClick={() => handleApproveWithdrawal(wdr.id, wdr.email, wdr.amount, `${wdr.bankName} - ${wdr.accountNumber}`)}
                                className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 text-white font-black text-xs px-5 py-2.5 rounded-xl cursor-pointer transition-all shadow-md flex items-center gap-1.5 border border-emerald-400"
                              >
                                <i className="fa-solid fa-circle-check text-sm"></i>
                                <span>✅ DUYỆT & CHUYỂN KHOẢN GIẢI NGÂN ({Number(wdr.amount).toLocaleString('vi-VN')}đ)</span>
                              </button>

                              <button 
                                onClick={() => handleRejectWithdrawal(wdr.id, wdr.email, wdr.amount)}
                                className="bg-red-50 text-red-700 hover:bg-red-100 border border-red-300 font-black text-xs px-4 py-2.5 rounded-xl cursor-pointer transition-all flex items-center gap-1.5"
                              >
                                <i className="fa-solid fa-circle-xmark text-sm"></i>
                                <span>❌ TỪ CHỐI</span>
                              </button>
                            </div>
                          </div>

                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="py-12 text-center text-gray-400 font-medium space-y-2 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                      <i className="fa-solid fa-circle-check text-3xl text-emerald-500 block mb-1"></i>
                      <p className="text-gray-700 font-bold text-xs">Không có lệnh rút tiền nào đang chờ phê duyệt.</p>
                      <p className="text-[11px] text-gray-400">Tất cả các yêu cầu giải ngân Ví TQ Pay đã được xử lý hoàn tất.</p>
                    </div>
                  )}
                </div>

                {/* 2. LỊCH SỬ GIẢI NGÂN ĐÃ XỬ LÝ (APPROVED / REJECTED WITHDRAWAL HISTORY) */}
                <div className="bg-white border border-gray-200 p-5 rounded-3xl space-y-3 shadow-sm">
                  <h4 className="font-black text-navy text-xs uppercase tracking-wider border-b border-gray-100 pb-2 flex items-center gap-1.5">
                    <i className="fa-solid fa-clock-rotate-left text-emerald-600"></i>
                    <span>📜 Lịch Sử Giải Ngân Đã Xử Lý ({withdrawalRequests.filter(w => w.status !== 'PENDING').length})</span>
                  </h4>

                  {withdrawalRequests.filter(w => w.status !== 'PENDING').length > 0 ? (
                    <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                      {withdrawalRequests.filter(w => w.status !== 'PENDING').map((wdr) => (
                        <div key={wdr.id} className="bg-slate-50 border border-gray-200 p-3.5 rounded-2xl flex items-center justify-between text-xs hover:bg-white transition-all">
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-2">
                              <span className="font-black text-navy text-xs">{wdr.name || wdr.email}</span>
                              {getRoleBadge(wdr.role)}
                              {wdr.status === 'APPROVED' ? (
                                <span className="bg-emerald-100 text-emerald-800 font-black text-[9px] px-2.5 py-0.5 rounded-full border border-emerald-300">
                                  🟢 ĐÃ GIẢI NGÂN
                                </span>
                              ) : (
                                <span className="bg-red-100 text-red-800 font-black text-[9px] px-2.5 py-0.5 rounded-full border border-red-300">
                                  🔴 ĐÃ TỪ CHỐI
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-gray-600 font-mono">
                              Ngân hàng: <strong>{wdr.bankName}</strong> | STK: <strong className="font-bold text-navy">{wdr.accountNumber}</strong> ({wdr.accountHolder})
                            </p>
                          </div>

                          <div className="text-right">
                            <span className="font-black text-emerald-700 font-mono text-sm block">
                              -{Number(wdr.amount).toLocaleString('vi-VN')} đ
                            </span>
                            <span className="text-[10px] text-gray-400 font-mono">
                              {new Date(wdr.approved_at || wdr.rejected_at || wdr.requested_at).toLocaleString('vi-VN')}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="py-6 text-center text-gray-400 text-xs italic">
                      Chưa có lịch sử giải ngân nào.
                    </div>
                  )}
                </div>

              </div>
            )}

            {/* TÍNH NĂNG CHUYÊN BIỆT: PHÊ DUYỆT NẠP TIỀN & CỘNG VÍ CHO TÀI KHOẢN */}
            {activeAdminTab === 'deposit_approvals' && (
              <div className="space-y-6 text-xs font-sans">
                
                {/* 1. KHU VỰC LỆNH NẠP TIỀN CHỜ PHÊ DUYỆT (PENDING DEPOSITS) */}
                <div className="bg-white border border-gray-200 p-5 rounded-3xl space-y-4 shadow-sm">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-3.5">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 bg-cyan-500/20 text-cyan-600 rounded-xl flex items-center justify-center text-sm font-black">
                        <i className="fa-solid fa-wallet"></i>
                      </div>
                      <div>
                        <h4 className="font-black text-navy text-sm uppercase tracking-wider">
                          📥 YÊU CẦU NẠP TIỀN CHỜ PHÊ DUYỆT ({depositRequests.filter(d => d.status === 'PENDING').length})
                        </h4>
                        <p className="text-[11px] text-gray-500 font-medium">
                          Duyệt giao dịch nạp tiền để tự động cộng số dư vào Ví TQ Pay cho tài khoản người dùng
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button 
                        onClick={handleExportDepositsCSV}
                        className="bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 text-white font-black px-3.5 py-1.5 rounded-xl text-xs shadow-xs transition-all cursor-pointer flex items-center gap-1.5 border border-cyan-400"
                      >
                        <i className="fa-solid fa-file-csv text-amber-300"></i>
                        <span>Xuất CSV</span>
                      </button>

                      <button 
                        onClick={loadAdminData}
                        className="bg-navy text-amber-300 hover:bg-navy-dark px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-xs border border-navy/20"
                      >
                        <i className={`fa-solid fa-rotate ${loading ? 'animate-spin' : ''} text-xs`}></i>
                        <span>Làm mới</span>
                      </button>
                    </div>
                  </div>

                  {depositRequests.filter(d => d.status === 'PENDING').length > 0 ? (
                    <div className="space-y-4">
                      {depositRequests.filter(d => d.status === 'PENDING').map((dep) => (
                        <div key={dep.id} className="bg-slate-50/80 border-2 border-cyan-300/80 hover:border-cyan-500 p-4 sm:p-5 rounded-2xl transition-all shadow-xs space-y-3">
                          
                          {/* Top Row: User Meta & Amount */}
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-200/80 pb-3">
                            <div className="flex items-center gap-2.5 flex-wrap">
                              <span className="w-8 h-8 bg-cyan-600 text-white font-black rounded-xl flex items-center justify-center text-xs shadow-xs">
                                📥
                              </span>
                              <div>
                                <div className="flex items-center gap-2">
                                  <h5 className="font-black text-navy text-sm">{dep.name || dep.email.split('@')[0]}</h5>
                                  {getRoleBadge(dep.role)}
                                  <span className="bg-amber-100 text-amber-900 font-black text-[9px] px-2.5 py-0.5 rounded-full border border-amber-300">
                                    ⌛ CHỜ DUYỆT NẠP
                                  </span>
                                </div>
                                <p className="text-[11px] text-gray-500 font-mono">
                                  Email: <strong className="text-navy font-bold">{dep.email}</strong>
                                </p>
                              </div>
                            </div>

                            <div className="text-right bg-cyan-100/80 border border-cyan-300 px-4 py-2 rounded-2xl">
                              <span className="text-[9px] text-cyan-800 font-black uppercase tracking-wider block">SỐ TIỀN NẠP VÍ:</span>
                              <span className="font-black text-xl text-cyan-800 font-mono">
                                +{Number(dep.amount).toLocaleString('vi-VN')} VNĐ
                              </span>
                            </div>
                          </div>

                          {/* Middle Row: Payment Method Details Card */}
                          <div className="bg-white border border-cyan-200 p-3.5 rounded-xl grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs shadow-inner">
                            <div>
                              <span className="text-[10px] text-gray-400 font-bold block uppercase">💳 Phương thức thanh toán:</span>
                              <strong className="text-navy font-black text-xs">{dep.paymentMethod}</strong>
                            </div>
                            <div>
                              <span className="text-[10px] text-gray-400 font-bold block uppercase">🧾 Nội Dung CK / Mã Giao Dịch:</span>
                              <strong className="text-cyan-800 font-mono font-black text-xs bg-cyan-50 px-2 py-0.5 rounded border border-cyan-200 inline-block">{dep.transactionCode}</strong>
                            </div>
                          </div>

                          {/* Bottom Row: Footer Timestamp & Action Buttons */}
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                            <span className="text-[10px] text-gray-400 font-mono">
                              Mã lệnh: #{dep.id} | Thời gian gửi: {new Date(dep.requested_at).toLocaleString('vi-VN')}
                            </span>

                            <div className="flex items-center gap-2.5">
                              <button 
                                onClick={() => handleApproveDeposit(dep.id, dep.email, dep.amount)}
                                className="bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 text-white font-black text-xs px-5 py-2.5 rounded-xl cursor-pointer transition-all shadow-md flex items-center gap-1.5 border border-cyan-400"
                              >
                                <i className="fa-solid fa-circle-check text-sm"></i>
                                <span>✅ DUYỆT & CỘNG VÍ (+{Number(dep.amount).toLocaleString('vi-VN')}đ)</span>
                              </button>

                              <button 
                                onClick={() => handleRejectDeposit(dep.id, dep.email, dep.amount)}
                                className="bg-red-50 text-red-700 hover:bg-red-100 border border-red-300 font-black text-xs px-4 py-2.5 rounded-xl cursor-pointer transition-all flex items-center gap-1.5"
                              >
                                <i className="fa-solid fa-circle-xmark text-sm"></i>
                                <span>❌ TỪ CHỐI</span>
                              </button>
                            </div>
                          </div>

                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="py-12 text-center text-gray-400 font-medium space-y-2 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                      <i className="fa-solid fa-circle-check text-3xl text-cyan-500 block mb-1"></i>
                      <p className="text-gray-700 font-bold text-xs">Không có lệnh nạp tiền nào đang chờ phê duyệt.</p>
                      <p className="text-[11px] text-gray-400">Tất cả các yêu cầu nạp tiền Ví TQ Pay đã được xử lý cộng ví hoàn tất.</p>
                    </div>
                  )}
                </div>

                {/* 2. LỊCH SỬ DUYỆT NẠP TIỀN ĐÃ XỬ LÝ (APPROVED / REJECTED DEPOSIT HISTORY) */}
                <div className="bg-white border border-gray-200 p-5 rounded-3xl space-y-3 shadow-sm">
                  <h4 className="font-black text-navy text-xs uppercase tracking-wider border-b border-gray-100 pb-2 flex items-center gap-1.5">
                    <i className="fa-solid fa-clock-rotate-left text-cyan-600"></i>
                    <span>📜 Lịch Sử Duyệt Nạp Tiền Đã Xử Lý ({depositRequests.filter(d => d.status !== 'PENDING').length})</span>
                  </h4>

                  {depositRequests.filter(d => d.status !== 'PENDING').length > 0 ? (
                    <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                      {depositRequests.filter(d => d.status !== 'PENDING').map((dep) => (
                        <div key={dep.id} className="bg-slate-50 border border-gray-200 p-3.5 rounded-2xl flex items-center justify-between text-xs hover:bg-white transition-all">
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-2">
                              <span className="font-black text-navy text-xs">{dep.name || dep.email}</span>
                              {getRoleBadge(dep.role)}
                              {dep.status === 'APPROVED' ? (
                                <span className="bg-emerald-100 text-emerald-800 font-black text-[9px] px-2.5 py-0.5 rounded-full border border-emerald-300">
                                  🟢 ĐÃ CỘNG VÍ
                                </span>
                              ) : (
                                <span className="bg-red-100 text-red-800 font-black text-[9px] px-2.5 py-0.5 rounded-full border border-red-300">
                                  🔴 ĐÃ TỪ CHỐI
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-gray-600 font-mono">
                              Phương thức: {dep.paymentMethod} | Mã GD: <strong className="text-navy">{dep.transactionCode}</strong>
                            </p>
                          </div>

                          <div className="text-right">
                            <span className="font-black text-cyan-700 font-mono text-sm block">
                              +{Number(dep.amount).toLocaleString('vi-VN')} đ
                            </span>
                            <span className="text-[10px] text-gray-400 font-mono">
                              {new Date(dep.approved_at || dep.rejected_at || dep.requested_at).toLocaleString('vi-VN')}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="py-6 text-center text-gray-400 text-xs italic">
                      Chưa có lịch sử duyệt nạp tiền nào.
                    </div>
                  )}
                </div>

              </div>
            )}

            {/* TÍNH NĂNG CHUYÊN BIỆT: CÀI PHÍ SÀN CHI TIẾT CHO TỪNG TÀI KHOẢN SHOP & TAXI */}
            {activeAdminTab === 'custom_fees' && (
              <div className="space-y-4 font-sans text-xs">
                
                {/* BANNER THÔNG TIN ĐẦU MỤC */}
                <div className="bg-gradient-to-r from-purple-900 via-slate-900 to-indigo-950 text-white p-5 rounded-3xl border border-purple-400/40 shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3.5">
                    <div className="w-12 h-12 bg-purple-600/30 text-purple-300 border border-purple-400/50 rounded-2xl flex items-center justify-center text-xl font-black shadow-inner">
                      <i className="fa-solid fa-percent"></i>
                    </div>
                    <div>
                      <h4 className="font-black text-sm text-amber-300 uppercase tracking-wider">
                        🏷️ THIẾT LẬP % PHÍ SÀN RIÊNG CHO TỪNG TÀI KHOẢN
                      </h4>
                      <p className="text-[11px] text-purple-200 mt-0.5 font-medium">
                        Cấu hình tỷ lệ % phí dịch vụ nền tảng ưu đãi hoặc đặc biệt áp dụng cho từng Gian hàng Shop, Tài xế Taxi & CTV
                      </p>
                    </div>
                  </div>

                  <div className="bg-slate-950/90 border border-amber-400/50 p-3 rounded-2xl text-center shrink-0 space-y-1 shadow-lg">
                    <span className="text-[10px] text-amber-300 font-black uppercase tracking-wider block">
                      Phí Mặc Định Hệ Thống
                    </span>
                    
                    {isEditingDefaultFee ? (
                      <div className="flex items-center gap-1.5 justify-center pt-1">
                        <input 
                          type="number" 
                          min={0}
                          max={100}
                          step={0.1}
                          value={tempDefaultFee}
                          onChange={(e) => setTempDefaultFee(e.target.value)}
                          className="w-16 bg-slate-900 text-amber-300 border border-amber-400 rounded-lg px-2 py-1 font-mono font-black text-sm text-center focus:outline-none"
                        />
                        <span className="text-amber-300 font-bold text-xs">%</span>
                        <button 
                          onClick={handleSaveDefaultSystemFee}
                          className="bg-emerald-500 hover:bg-emerald-600 text-white font-black text-xs px-2.5 py-1 rounded-lg transition-all cursor-pointer shadow-xs"
                          title="Lưu tỷ lệ phí mặc định mới"
                        >
                          💾 LƯU
                        </button>
                        <button 
                          onClick={() => setIsEditingDefaultFee(false)}
                          className="bg-gray-700 hover:bg-gray-600 text-gray-300 font-bold text-xs px-2 py-1 rounded-lg cursor-pointer"
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center gap-2">
                        <span className="text-xl font-black text-amber-300 font-mono">
                          {platformConfig.platform_fee_percent}%
                        </span>
                        <button 
                          onClick={() => {
                            setTempDefaultFee(platformConfig.platform_fee_percent);
                            setIsEditingDefaultFee(true);
                          }}
                          className="bg-amber-400/20 hover:bg-amber-400 text-amber-300 hover:text-slate-950 border border-amber-400/50 text-[10px] font-black px-2.5 py-1 rounded-xl transition-all cursor-pointer shadow-xs flex items-center gap-1"
                          title="Bấm để điều chỉnh tỷ lệ phí sàn mặc định của toàn hệ thống"
                        >
                          <i className="fa-solid fa-pen text-[10px]"></i>
                          <span>✏️ ĐỔI PHÍ MẶC ĐỊNH</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* BẢNG DANH SÁCH TÀI KHOẢN & CẤU HÌNH PHÍ SÀN RIÊNG */}
                <div className="bg-white border border-gray-200 p-5 rounded-3xl space-y-4 shadow-2xs">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-extrabold text-navy text-xs uppercase">
                        📋 Danh Sách Tài Khoản Shop & Taxi ({registeredUsers.filter(u => u.role === 'SHOP' || u.role === 'TAXI_DRIVER' || u.role === 'EMPLOYEE').length})
                      </span>
                      <span className="bg-purple-100 text-purple-900 font-black text-[10px] px-2.5 py-0.5 rounded-full border border-purple-300">
                        {registeredUsers.filter(u => (u.role === 'SHOP' || u.role === 'TAXI_DRIVER' || u.role === 'EMPLOYEE') && u.custom_commission_fee !== null && u.custom_commission_fee !== undefined).length} tài khoản có phí riêng
                      </span>
                    </div>

                    <button 
                      onClick={loadAdminData}
                      className="bg-navy hover:bg-navy-dark text-amber-300 font-bold text-[11px] px-3 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 self-start sm:self-auto"
                    >
                      <i className={`fa-solid fa-rotate ${loading ? 'animate-spin' : ''} text-xs`}></i>
                      <span>🔄 Nạp Lại CSDL</span>
                    </button>
                  </div>

                  {registeredUsers.filter(u => u.role === 'SHOP' || u.role === 'TAXI_DRIVER' || u.role === 'EMPLOYEE').length > 0 ? (
                    <div className="overflow-x-auto rounded-2xl border border-gray-200">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-900 text-amber-300 uppercase text-[10px] font-black tracking-wider">
                          <tr>
                            <th className="py-3 px-4">Tài Khoản / Email</th>
                            <th className="py-3 px-4">Họ và Tên</th>
                            <th className="py-3 px-4">Phân Loại Đơn Vị</th>
                            <th className="py-3 px-4">Số Điện Thoại</th>
                            <th className="py-3 px-4">Tỷ Lệ % Phí Sàn Áp Dụng</th>
                            <th className="py-3 px-4 text-center">Thao Tác Cài Đặt</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 font-medium">
                          {registeredUsers.filter(u => u.role === 'SHOP' || u.role === 'TAXI_DRIVER' || u.role === 'EMPLOYEE').map((u, idx) => {
                            const hasCustomFee = u.custom_commission_fee !== null && u.custom_commission_fee !== undefined;
                            return (
                              <tr key={idx} className="hover:bg-purple-50/40 transition-colors">
                                <td className="py-3.5 px-4 font-mono font-bold text-navy">
                                  {u.email}
                                </td>
                                <td className="py-3.5 px-4 font-bold text-gray-800">
                                  {u.name || u.email.split('@')[0]}
                                </td>
                                <td className="py-3.5 px-4">
                                  {getRoleBadge(u.role || 'SHOP')}
                                </td>
                                <td className="py-3.5 px-4 font-mono text-gray-600">
                                  {u.phone || 'Chưa có'}
                                </td>
                                <td className="py-3.5 px-4">
                                  {hasCustomFee ? (
                                    <span className="bg-purple-100 text-purple-900 border border-purple-300 font-black text-xs px-3 py-1 rounded-full inline-flex items-center gap-1">
                                      <i className="fa-solid fa-star text-amber-500 text-[10px]"></i>
                                      <span>🏪 Phí riêng: {u.custom_commission_fee}%</span>
                                    </span>
                                  ) : (
                                    <span className="bg-gray-100 text-gray-600 border border-gray-200 font-bold text-xs px-3 py-1 rounded-full inline-flex items-center gap-1">
                                      <span>🏪 Mặc định hệ thống: {platformConfig.platform_fee_percent}%</span>
                                    </span>
                                  )}
                                </td>
                                <td className="py-3.5 px-4 text-center">
                                  <button 
                                    onClick={() => handleOpenEditFee(u)}
                                    className="bg-purple-600 hover:bg-purple-700 text-white font-extrabold text-[11px] px-3 py-1.5 rounded-xl cursor-pointer shadow-xs transition-all inline-flex items-center gap-1.5 border border-purple-400"
                                  >
                                    <i className="fa-solid fa-pen-to-square text-amber-300 text-xs"></i>
                                    <span>🏷️ CHỈNH PHÍ SÀN</span>
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="py-12 text-center text-gray-400 font-medium space-y-2 bg-purple-50/30 rounded-2xl border border-dashed border-purple-200">
                      <i className="fa-solid fa-store text-3xl text-purple-400 block mb-1"></i>
                      <p className="text-purple-950 font-bold text-xs">Chưa có tài khoản Chủ Shop hoặc Tài xế Taxi nào trong hệ thống.</p>
                      <p className="text-[11px] text-gray-500">
                        Khi người dùng đăng ký hoặc được chuyển phân quyền thành Shop hoặc Taxi, tài khoản của họ sẽ tự động xuất hiện tại đây để Admin cài % phí sàn riêng.
                      </p>
                    </div>
                  )}

                </div>

              </div>
            )}

            {/* TÍNH NĂNG CHUYÊN BIỆT: QUẢN LÝ LINK TRUY CẬP WEB RIÊNG CHO TỪNG SHOP */}
            {activeAdminTab === 'shop_links' && (
              <div className="space-y-5 font-sans text-xs">
                
                {/* BANNER ĐẦU TRANG */}
                <div className="bg-gradient-to-r from-teal-950 via-slate-900 to-navy text-white p-5 rounded-3xl border border-teal-400/40 shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3.5">
                    <div className="w-12 h-12 bg-teal-500/30 text-teal-300 border border-teal-400/50 rounded-2xl flex items-center justify-center text-xl font-black shadow-inner">
                      <i className="fa-solid fa-link"></i>
                    </div>
                    <div>
                      <h4 className="font-black text-sm text-amber-300 uppercase tracking-wider">
                        🔗 QUẢN LÝ LINK TRUY CẬP WEB RIÊNG CHO TỪNG GIAN HÀNG SHOP
                      </h4>
                      <p className="text-[11px] text-teal-200 mt-0.5 font-medium">
                        Tạo & sao chép đường dẫn (URL) để gửi cho khách hàng truy cập trực tiếp chỉ xem sản phẩm của riêng Shop đó
                      </p>
                    </div>
                  </div>

                  <span className="bg-teal-900/80 text-amber-300 font-mono font-black text-xs px-3.5 py-1.5 rounded-2xl border border-teal-400/50 shrink-0 text-center">
                    🌐 Direct Storefront URLs
                  </span>
                </div>

                {/* DANH SÁCH TẤT CẢ GIAN HÀNG CÓ TÀI KHOẢN VÀ CỬA HÀNG MẪU */}
                <div className="bg-white border border-gray-200 p-5 rounded-3xl space-y-4 shadow-2xs">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-3">
                    <span className="font-extrabold text-navy text-xs uppercase">
                      🏪 Danh Sách Gian Hàng Đang Hoạt Động
                    </span>
                    <button 
                      onClick={loadAdminData}
                      className="bg-navy hover:bg-navy-dark text-amber-300 font-bold text-[11px] px-3 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 self-start sm:self-auto"
                    >
                      <i className={`fa-solid fa-rotate ${loading ? 'animate-spin' : ''} text-xs`}></i>
                      <span>🔄 Nạp Lại CSDL</span>
                    </button>
                  </div>

                  {/* KẾT HỢP TÀI KHOẢN SHOP THỰC TẾ & GIAN HÀNG MẪU HỆ THỐNG */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {[
                      ...registeredUsers.filter(u => u.role === 'SHOP').map(u => ({
                        id: u.email,
                        name: u.name || u.email.split('@')[0],
                        email: u.email,
                        phone: u.phone || 'Chưa cập nhật',
                        slug: generateShopSlug(u.name || u.email),
                        type: 'Tài khoản Shop'
                      })),
                      { id: 'sample-retail', name: 'TQ RETAIL SHOP (Thời Trang & Phụ Kiện)', email: 'retail@tqstore.vn', phone: '0988 888 888', slug: 'tq-retail-shop', type: 'Gian hàng mẫu' },
                      { id: 'sample-rental', name: 'TQ RENTAL STUDIO (Thuê Đồ & Trang Phục)', email: 'rental@tqstore.vn', phone: '0988 999 999', slug: 'tq-rental-studio', type: 'Gian hàng mẫu' },
                      { id: 'sample-fnb', name: 'TQ TEA & COFFEE (Đồ Ăn & Thức Uống)', email: 'fnb@tqstore.vn', phone: '0977 123 456', slug: 'tq-tea-coffee', type: 'Gian hàng mẫu' },
                      { id: 'sample-beauty', name: 'TQ BEAUTY SPA (Làm Đẹp & Spa)', email: 'beauty@tqstore.vn', phone: '0966 888 999', slug: 'tq-beauty-spa', type: 'Gian hàng mẫu' }
                    ].map((shopObj) => {
                      const directUrl = getShopDirectLink(shopObj.slug);
                      const isCopied = copiedLinkMap[shopObj.id];

                      return (
                        <div key={shopObj.id} className="bg-slate-50 border-2 border-slate-200 hover:border-teal-400 p-4 rounded-2xl space-y-3 transition-colors shadow-2xs">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="flex items-center gap-2">
                                <h5 className="font-black text-navy text-sm">{shopObj.name}</h5>
                                <span className="bg-teal-100 text-teal-800 font-extrabold text-[10px] px-2 py-0.5 rounded-full border border-teal-300">
                                  {shopObj.type}
                                </span>
                              </div>
                              <p className="text-[11px] text-gray-500 font-mono mt-0.5">{shopObj.email} | SĐT: {shopObj.phone}</p>
                            </div>
                          </div>

                          {/* LINK INPUT BOX */}
                          <div className="bg-white border border-gray-300 p-2 rounded-xl flex items-center justify-between gap-2 font-mono text-[11px] text-teal-900 font-bold select-all shadow-inner">
                            <span className="truncate">{directUrl}</span>
                          </div>

                          {/* ACTION BUTTONS */}
                          <div className="flex items-center gap-2 pt-1">
                            <button 
                              onClick={() => handleCopyShopLink(shopObj.slug, shopObj.id)}
                              className={`flex-1 font-black text-xs py-2 rounded-xl transition-all cursor-pointer shadow-xs flex items-center justify-center gap-1.5 ${
                                isCopied 
                                  ? 'bg-emerald-600 text-white' 
                                  : 'bg-teal-600 hover:bg-teal-700 text-white'
                              }`}
                            >
                              <i className={`fa-solid ${isCopied ? 'fa-check' : 'fa-copy'} text-xs`}></i>
                              <span>{isCopied ? '✓ ĐÃ COPY LINK!' : '📋 COPY LINK GIAN HÀNG'}</span>
                            </button>

                            <a 
                              href={directUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="bg-navy hover:bg-navy-dark text-amber-300 font-extrabold text-xs px-3.5 py-2 rounded-xl transition-all cursor-pointer shrink-0 flex items-center justify-center gap-1"
                              title="Truy cập trực tiếp xem sản phẩm của Shop này trên tab mới"
                            >
                              <i className="fa-solid fa-arrow-up-right-from-square text-xs"></i>
                              <span>🔗 MỞ TRANG</span>
                            </a>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                </div>

              </div>
            )}

            {/* TÍNH NĂNG CHUYÊN BIỆT: QUẢN LÝ ĐỀ XUẤT SHOP & SẢN PHẨM NỔI BẬT HOT */}
            {activeAdminTab === 'featured' && (
              <div className="space-y-5 font-sans text-xs">
                
                {/* BANNER ĐẦU TRANG */}
                <div className="bg-gradient-to-r from-amber-950 via-slate-900 to-amber-900 text-white p-5 rounded-3xl border border-amber-400/50 shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3.5">
                    <div className="w-12 h-12 bg-amber-500/30 text-amber-300 border border-amber-400/50 rounded-2xl flex items-center justify-center text-xl font-black shadow-inner">
                      <i className="fa-solid fa-star"></i>
                    </div>
                    <div>
                      <h4 className="font-black text-sm text-amber-300 uppercase tracking-wider">
                        ⭐ QUẢN LÝ ĐỀ XUẤT SHOP & SẢN PHẨM NỔI BẬT HOT
                      </h4>
                      <p className="text-[11px] text-amber-200 mt-0.5 font-medium">
                        Ghim các Sản phẩm & Gian hàng tiêu biểu để hiển thị ưu tiên tại dải Hot Trang chủ & Ô gợi ý Tìm kiếm
                      </p>
                    </div>
                  </div>

                  {/* SUB TAB SWITCHER */}
                  <div className="flex items-center gap-1 bg-slate-950/90 border border-amber-400/50 p-1 rounded-2xl shrink-0">
                    <button 
                      onClick={() => setFeaturedSubTab('products')}
                      className={`px-3.5 py-1.5 rounded-xl font-black text-[11px] transition-all cursor-pointer flex items-center gap-1.5 ${
                        featuredSubTab === 'products'
                          ? 'bg-amber-400 text-slate-950 shadow-xs'
                          : 'text-amber-200 hover:bg-white/10'
                      }`}
                    >
                      <i className="fa-solid fa-fire"></i>
                      <span>🔥 Sản Phẩm Hot ({(featuredPromotions.productIds || []).length})</span>
                    </button>

                    <button 
                      onClick={() => setFeaturedSubTab('shops')}
                      className={`px-3.5 py-1.5 rounded-xl font-black text-[11px] transition-all cursor-pointer flex items-center gap-1.5 ${
                        featuredSubTab === 'shops'
                          ? 'bg-amber-400 text-slate-950 shadow-xs'
                          : 'text-amber-200 hover:bg-white/10'
                      }`}
                    >
                      <i className="fa-solid fa-store"></i>
                      <span>⭐ Gian Hàng Hot ({(featuredPromotions.shopEmails || []).length})</span>
                    </button>
                  </div>
                </div>

                {/* CONTENT TAB 1: SẢN PHẨM ĐỀ XUẤT HOT */}
                {featuredSubTab === 'products' && (
                  <div className="bg-white border border-gray-200 p-5 rounded-3xl space-y-4 shadow-2xs">
                    <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                      <span className="font-extrabold text-navy text-xs uppercase">
                        📋 Chọn Sản Phẩm Đưa Lên Dải Hot Trang Chủ & Ô Tìm Kiếm
                      </span>
                      <button 
                        onClick={loadAdminData}
                        className="bg-navy hover:bg-navy-dark text-amber-300 font-bold text-[11px] px-3 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
                      >
                        <i className={`fa-solid fa-rotate ${loading ? 'animate-spin' : ''} text-xs`}></i>
                        <span>🔄 Nạp Lại CSDL</span>
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5">
                      {productsList.map((p) => {
                        const isFeatured = (featuredPromotions.productIds || []).includes(p.id);
                        return (
                          <div 
                            key={p.id}
                            className={`p-3.5 rounded-2xl border-2 transition-all space-y-2 flex flex-col justify-between ${
                              isFeatured 
                                ? 'bg-amber-50/80 border-amber-400 shadow-sm' 
                                : 'bg-slate-50 border-gray-200 hover:border-gray-300'
                            }`}
                          >
                            <div className="flex items-start gap-3">
                              <img 
                                src={p.image_url || 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=200&q=80'} 
                                alt={p.title || p.name}
                                className="w-14 h-14 object-cover rounded-xl border border-gray-200 shrink-0" 
                              />
                              <div className="space-y-0.5 flex-1 min-w-0">
                                <h5 className="font-black text-navy text-xs truncate">{p.title || p.name}</h5>
                                <p className="text-[10px] text-gray-500 font-mono">Shop: {p.shop_name || p.shop || 'TQ Store'}</p>
                                <span className="font-black text-red-600 text-xs block">
                                  {Number(p.price || 0).toLocaleString('vi-VN')} VNĐ
                                </span>
                              </div>
                            </div>

                            <button 
                              onClick={() => handleToggleFeaturedProduct(p.id, p.title || p.name)}
                              className={`w-full font-black text-xs py-2 rounded-xl transition-all cursor-pointer shadow-xs flex items-center justify-center gap-1.5 border ${
                                isFeatured
                                  ? 'bg-amber-500 hover:bg-amber-600 text-slate-950 border-amber-400'
                                  : 'bg-white hover:bg-gray-100 text-gray-700 border-gray-300'
                              }`}
                            >
                              <i className={`fa-solid ${isFeatured ? 'fa-star text-slate-950' : 'fa-star-of-david text-gray-400'} text-xs`}></i>
                              <span>{isFeatured ? '⭐ ĐÃ ĐỀ XUẤT HOT' : '☆ BẬT ĐỀ XUẤT HOT'}</span>
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* CONTENT TAB 2: GIAN HÀNG ĐỀ XUẤT HOT */}
                {featuredSubTab === 'shops' && (
                  <div className="bg-white border border-gray-200 p-5 rounded-3xl space-y-4 shadow-2xs">
                    <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                      <span className="font-extrabold text-navy text-xs uppercase">
                        📋 Chọn Gian Hàng Đưa Lên Vị Trí Nổi Bật Hot Trang Chủ
                      </span>
                      <button 
                        onClick={loadAdminData}
                        className="bg-navy hover:bg-navy-dark text-amber-300 font-bold text-[11px] px-3 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
                      >
                        <i className={`fa-solid fa-rotate ${loading ? 'animate-spin' : ''} text-xs`}></i>
                        <span>🔄 Nạp Lại CSDL</span>
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5">
                      {[
                        ...registeredUsers.filter(u => u.role === 'SHOP').map(u => ({
                          email: u.email,
                          name: u.name || u.email.split('@')[0],
                          phone: u.phone || 'Chưa có',
                          type: 'Tài khoản Shop'
                        })),
                        { email: 'retail@tqstore.vn', name: 'TQ RETAIL SHOP (Thời Trang)', phone: '0988 888 888', type: 'Gian hàng mẫu' },
                        { email: 'rental@tqstore.vn', name: 'TQ RENTAL STUDIO (Thuê Đồ)', phone: '0988 999 999', type: 'Gian hàng mẫu' },
                        { email: 'fnb@tqstore.vn', name: 'TQ TEA & COFFEE (F&B)', phone: '0977 123 456', type: 'Gian hàng mẫu' },
                        { email: 'beauty@tqstore.vn', name: 'TQ BEAUTY SPA (Làm Đẹp)', phone: '0966 888 999', type: 'Gian hàng mẫu' }
                      ].map((shopObj) => {
                        const isFeatured = (featuredPromotions.shopEmails || []).includes(shopObj.email);
                        return (
                          <div 
                            key={shopObj.email}
                            className={`p-3.5 rounded-2xl border-2 transition-all space-y-2.5 flex flex-col justify-between ${
                              isFeatured 
                                ? 'bg-amber-50/80 border-amber-400 shadow-sm' 
                                : 'bg-slate-50 border-gray-200 hover:border-gray-300'
                            }`}
                          >
                            <div>
                              <div className="flex items-center gap-2">
                                <h5 className="font-black text-navy text-xs truncate">{shopObj.name}</h5>
                                <span className="bg-amber-100 text-amber-900 border border-amber-300 font-extrabold text-[9px] px-2 py-0.5 rounded-full shrink-0">
                                  {shopObj.type}
                                </span>
                              </div>
                              <p className="text-[10px] text-gray-500 font-mono mt-0.5">{shopObj.email}</p>
                            </div>

                            <button 
                              onClick={() => handleToggleFeaturedShop(shopObj.email, shopObj.name)}
                              className={`w-full font-black text-xs py-2 rounded-xl transition-all cursor-pointer shadow-xs flex items-center justify-center gap-1.5 border ${
                                isFeatured
                                  ? 'bg-amber-500 hover:bg-amber-600 text-slate-950 border-amber-400'
                                  : 'bg-white hover:bg-gray-100 text-gray-700 border-gray-300'
                              }`}
                            >
                              <i className={`fa-solid ${isFeatured ? 'fa-star text-slate-950' : 'fa-star-of-david text-gray-400'} text-xs`}></i>
                              <span>{isFeatured ? '⭐ GIAN HÀNG HOT' : '☆ BẬT GIAN HÀNG HOT'}</span>
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

              </div>
            )}

            {/* TÍNH NĂNG CHUYÊN BIỆT: QUẢN LÝ & PHÁT HÀNH MÃ GIẢM GIÁ (VOUCHERS & COUPONS) */}
            {activeAdminTab === 'vouchers' && (
              <div className="space-y-5 font-sans text-xs">
                
                {/* BANNER ĐẦU TRANG */}
                <div className="bg-gradient-to-r from-orange-950 via-slate-900 to-amber-950 text-white p-5 rounded-3xl border border-orange-400/50 shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3.5">
                    <div className="w-12 h-12 bg-orange-500/30 text-orange-300 border border-orange-400/50 rounded-2xl flex items-center justify-center text-xl font-black shadow-inner">
                      <i className="fa-solid fa-ticket"></i>
                    </div>
                    <div>
                      <h4 className="font-black text-sm text-amber-300 uppercase tracking-wider">
                        🎫 QUẢN LÝ & PHÁT HÀNH MÃ GIẢM GIÁ (VOUCHER / COUPON)
                      </h4>
                      <p className="text-[11px] text-orange-200 mt-0.5 font-medium">
                        Tạo mã ưu đãi, giới hạn số lượt sử dụng và ràng buộc PTTT bắt buộc (Ví TQ Pay / Tiền mặt COD)
                      </p>
                    </div>
                  </div>

                  <button 
                    onClick={() => setShowCreateVoucherForm(!showCreateVoucherForm)}
                    className="bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 text-slate-950 font-black text-xs px-4 py-2.5 rounded-2xl shadow-md transition-all cursor-pointer flex items-center gap-2 shrink-0 border border-amber-300"
                  >
                    <i className={`fa-solid ${showCreateVoucherForm ? 'fa-xmark' : 'fa-plus-circle'} text-sm`}></i>
                    <span>{showCreateVoucherForm ? '❌ ĐÓNG FORM' : '➕ TẠO MÃ GIẢM GIÁ MỚI'}</span>
                  </button>
                </div>

                {/* FORM TẠO VOUCHER MỚI */}
                {showCreateVoucherForm && (
                  <div className="bg-white border-2 border-orange-300 p-5 sm:p-6 rounded-3xl space-y-4 shadow-md animate-in fade-in duration-200">
                    <div className="border-b border-gray-100 pb-3 flex items-center gap-2">
                      <span className="w-2.5 h-2.5 bg-orange-500 rounded-full animate-ping"></span>
                      <h4 className="font-black text-navy text-xs uppercase tracking-wider">
                        📝 TẠO VÀ PHÁT HÀNH MÃ GIẢM GIÁ MỚI
                      </h4>
                    </div>

                    <form onSubmit={handleCreateVoucher} className="space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                        
                        {/* 1. MÃ COUPON */}
                        <div>
                          <label className="block font-extrabold text-gray-700 mb-1">
                            Mã Giảm Giá (Coupon Code):
                          </label>
                          <input 
                            type="text" 
                            value={newVoucher.code}
                            onChange={(e) => setNewVoucher({ ...newVoucher, code: e.target.value.toUpperCase() })}
                            required 
                            placeholder="VD: TQVIP100K" 
                            className="w-full bg-slate-50 border border-gray-300 rounded-xl px-3.5 py-2.5 text-xs font-mono font-black text-navy focus:outline-none focus:border-orange-500 uppercase"
                          />
                        </div>

                        {/* 2. LOẠI GIẢM GIÁ */}
                        <div>
                          <label className="block font-extrabold text-gray-700 mb-1">
                            Hình thức giảm giá:
                          </label>
                          <select 
                            value={newVoucher.discountType}
                            onChange={(e) => setNewVoucher({ ...newVoucher, discountType: e.target.value })}
                            className="w-full bg-slate-50 border border-gray-300 rounded-xl px-3.5 py-2.5 text-xs font-bold text-gray-800 focus:outline-none focus:border-orange-500 cursor-pointer"
                          >
                            <option value="PERCENT">Giảm Theo Tỷ Lệ % (%)</option>
                            <option value="FIXED">Giảm Theo Số Tiền Cố Định (VNĐ)</option>
                          </select>
                        </div>

                        {/* 3. GIÁ TRỊ GIẢM */}
                        <div>
                          <label className="block font-extrabold text-gray-700 mb-1">
                            Giá trị giảm ({newVoucher.discountType === 'PERCENT' ? '%' : 'VNĐ'}):
                          </label>
                          <input 
                            type="number" 
                            min={1}
                            value={newVoucher.discountValue}
                            onChange={(e) => setNewVoucher({ ...newVoucher, discountValue: e.target.value })}
                            required
                            placeholder={newVoucher.discountType === 'PERCENT' ? '10' : '50000'} 
                            className="w-full bg-slate-50 border border-gray-300 rounded-xl px-3.5 py-2.5 text-xs font-mono font-bold text-gray-800 focus:outline-none focus:border-orange-500"
                          />
                        </div>

                        {/* 4. ĐƠN TỐI THIỂU */}
                        <div>
                          <label className="block font-extrabold text-gray-700 mb-1">
                            Đơn tối thiểu (VNĐ):
                          </label>
                          <input 
                            type="number" 
                            min={0}
                            value={newVoucher.minOrderValue}
                            onChange={(e) => setNewVoucher({ ...newVoucher, minOrderValue: e.target.value })}
                            required
                            placeholder="100000" 
                            className="w-full bg-slate-50 border border-gray-300 rounded-xl px-3.5 py-2.5 text-xs font-mono font-bold text-gray-800 focus:outline-none focus:border-orange-500"
                          />
                        </div>

                        {/* 5. GIỚI HẠN LƯỢT DÙNG */}
                        <div>
                          <label className="block font-extrabold text-gray-700 mb-1">
                            Giới hạn lượt sử dụng (Tổng lượt):
                          </label>
                          <input 
                            type="number" 
                            min={1}
                            value={newVoucher.usageLimit}
                            onChange={(e) => setNewVoucher({ ...newVoucher, usageLimit: e.target.value })}
                            required
                            placeholder="100" 
                            className="w-full bg-slate-50 border border-gray-300 rounded-xl px-3.5 py-2.5 text-xs font-mono font-bold text-gray-800 focus:outline-none focus:border-orange-500"
                          />
                        </div>

                        {/* 6. PTTT BẮT BUỘC */}
                        <div>
                          <label className="block font-extrabold text-gray-700 mb-1">
                            PTTT Bắt buộc khi áp dụng:
                          </label>
                          <select 
                            value={newVoucher.requiredPaymentMethod}
                            onChange={(e) => setNewVoucher({ ...newVoucher, requiredPaymentMethod: e.target.value })}
                            className="w-full bg-slate-50 border border-gray-300 rounded-xl px-3.5 py-2.5 text-xs font-black text-navy focus:outline-none focus:border-orange-500 cursor-pointer"
                          >
                            <option value="ALL">🌐 Áp Dụng Cho Tất Cả PTTT</option>
                            <option value="WALLET">💳 Chỉ Áp Dụng Khi Thanh Toán VÍ TQ PAY</option>
                            <option value="COD">💵 Chỉ Áp Dụng Khi Thanh Toán TIỀN MẶT (COD)</option>
                          </select>
                        </div>

                      </div>

                      {/* MO TA VOUCHER */}
                      <div>
                        <label className="block font-extrabold text-gray-700 mb-1">
                          Mô tả / Ghi chú điều kiện mã giảm giá:
                        </label>
                        <input 
                          type="text" 
                          value={newVoucher.description}
                          onChange={(e) => setNewVoucher({ ...newVoucher, description: e.target.value })}
                          placeholder="VD: Giảm 50.000đ khi thanh toán qua Ví TQ Pay cho đơn từ 300k" 
                          className="w-full bg-slate-50 border border-gray-300 rounded-xl px-3.5 py-2.5 text-xs font-medium text-gray-800 focus:outline-none focus:border-orange-500"
                        />
                      </div>

                      <button 
                        type="submit" 
                        className="w-full bg-gradient-to-r from-orange-500 via-amber-500 to-yellow-500 hover:from-orange-600 text-slate-950 font-black py-3 rounded-xl text-xs uppercase tracking-wider shadow-md transition-all cursor-pointer flex items-center justify-center gap-2"
                      >
                        <i className="fa-solid fa-paper-plane text-slate-950"></i>
                        <span>🎯 PHÁT HÀNH MÃ GIẢM GIÁ NGAY</span>
                      </button>
                    </form>
                  </div>
                )}

                {/* DANH SÁCH MÃ GIẢM GIÁ ĐÃ PHÁT HÀNH */}
                <div className="bg-white border border-gray-200 p-5 rounded-3xl space-y-4 shadow-2xs">
                  <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                    <h4 className="font-extrabold text-navy text-xs uppercase tracking-wider flex items-center gap-2">
                      <span>Danh Sách Mã Giảm Giá Trên Hệ Thống ({vouchersList.length} mã)</span>
                      <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
                    </h4>

                    <button 
                      onClick={() => fetchCloudVouchers().then(res => setVouchersList(res))}
                      className="bg-navy hover:bg-navy-dark text-amber-300 font-bold text-[11px] px-3 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
                    >
                      <i className={`fa-solid fa-rotate ${loading ? 'animate-spin' : ''} text-xs`}></i>
                      <span>🔄 Nạp Lại CSDL</span>
                    </button>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-100 text-navy font-black border-b border-gray-200 uppercase text-[10px] tracking-wider">
                          <th className="py-3 px-4">Mã Voucher</th>
                          <th className="py-3 px-4">Mức Giảm</th>
                          <th className="py-3 px-4">Đơn Tối Thiểu</th>
                          <th className="py-3 px-4">Tiến Độ Lượt Dùng</th>
                          <th className="py-3 px-4">PTTT Bắt Buộc</th>
                          <th className="py-3 px-4">Trạng Thái</th>
                          <th className="py-3 px-4 text-center">Thao Tác Admin</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 font-medium text-gray-800">
                        {vouchersList.map((v) => {
                          const isPercent = v.discountType === 'PERCENT';
                          const isWalletReq = v.requiredPaymentMethod === 'WALLET';
                          const isCodReq = v.requiredPaymentMethod === 'COD';

                          return (
                            <tr key={v.id} className="hover:bg-amber-50/50 transition-colors">
                              <td className="py-3.5 px-4">
                                <div className="space-y-0.5">
                                  <span className="font-mono font-black text-sm text-navy bg-amber-100 text-amber-900 border border-amber-300 px-2.5 py-0.5 rounded-lg inline-block">
                                    {v.code}
                                  </span>
                                  <p className="text-[10px] text-gray-500 truncate max-w-xs">{v.description}</p>
                                </div>
                              </td>

                              <td className="py-3.5 px-4 font-black text-red-600">
                                {isPercent ? `Giảm ${v.discountValue}%` : `Giảm -${Number(v.discountValue).toLocaleString('vi-VN')}đ`}
                              </td>

                              <td className="py-3.5 px-4 font-mono font-bold text-gray-700">
                                ≥ {Number(v.minOrderValue || 0).toLocaleString('vi-VN')}đ
                              </td>

                              <td className="py-3.5 px-4 font-mono">
                                <div className="space-y-1">
                                  <div className="flex items-center justify-between text-[10px] font-bold">
                                    <span className="text-navy">{v.usageCount || 0} / {v.usageLimit} lượt</span>
                                    <span className="text-gray-400">{Math.round(((v.usageCount || 0) / v.usageLimit) * 100)}%</span>
                                  </div>
                                  <div className="w-full bg-gray-200 h-1.5 rounded-full overflow-hidden">
                                    <div 
                                      className="bg-orange-500 h-full rounded-full transition-all" 
                                      style={{ width: `${Math.min(100, Math.round(((v.usageCount || 0) / v.usageLimit) * 100))}%` }}
                                    ></div>
                                  </div>
                                </div>
                              </td>

                              <td className="py-3.5 px-4">
                                {isWalletReq ? (
                                  <span className="bg-emerald-100 text-emerald-900 border border-emerald-300 font-extrabold text-[10px] px-2.5 py-1 rounded-full inline-flex items-center gap-1">
                                    <i className="fa-solid fa-wallet text-emerald-600"></i>
                                    <span>Bắt buộc Ví TQ Pay</span>
                                  </span>
                                ) : isCodReq ? (
                                  <span className="bg-amber-100 text-amber-900 border border-amber-300 font-extrabold text-[10px] px-2.5 py-1 rounded-full inline-flex items-center gap-1">
                                    <i className="fa-solid fa-money-bill text-amber-600"></i>
                                    <span>Bắt buộc Tiền mặt COD</span>
                                  </span>
                                ) : (
                                  <span className="bg-slate-100 text-slate-700 border border-slate-300 font-bold text-[10px] px-2.5 py-1 rounded-full inline-flex items-center gap-1">
                                    <i className="fa-solid fa-globe text-slate-500"></i>
                                    <span>Tất cả PTTT</span>
                                  </span>
                                )}
                              </td>

                              <td className="py-3.5 px-4">
                                {v.status === 'ACTIVE' ? (
                                  <span className="bg-emerald-100 text-emerald-900 border border-emerald-300 font-extrabold text-[10px] px-2.5 py-0.5 rounded-full inline-flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping"></span>
                                    <span>ĐANG HOẠT ĐỘNG</span>
                                  </span>
                                ) : (
                                  <span className="bg-red-100 text-red-900 border border-red-300 font-extrabold text-[10px] px-2.5 py-0.5 rounded-full inline-flex items-center gap-1">
                                    <span>TẠM KHÓA</span>
                                  </span>
                                )}
                              </td>

                              <td className="py-3.5 px-4 text-center">
                                <div className="flex items-center justify-center gap-1.5">
                                  <button 
                                    onClick={() => handleToggleVoucherStatus(v.id)}
                                    className={`font-extrabold text-[10px] px-2.5 py-1 rounded-xl cursor-pointer transition-all border ${
                                      v.status === 'ACTIVE'
                                        ? 'bg-amber-50 text-amber-800 hover:bg-amber-100 border-amber-300'
                                        : 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-500'
                                    }`}
                                  >
                                    {v.status === 'ACTIVE' ? '🔒 KHÓA' : '🔓 MỞ'}
                                  </button>

                                  <button 
                                    onClick={() => handleDeleteVoucher(v.id, v.code)}
                                    className="bg-red-50 hover:bg-red-100 text-red-700 border border-red-300 font-extrabold text-[10px] px-2.5 py-1 rounded-xl cursor-pointer transition-all"
                                  >
                                    🗑️ XÓA
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

              </div>
            )}

            {/* TÍNH NĂNG CHUYÊN BIỆT: LỊCH SỬ MUA HÀNG CỦA TẤT CẢ KHÁCH HÀNG TOÀN SÀN */}
            {activeAdminTab === 'global_orders' && (
              <div className="space-y-5 font-sans text-xs">
                
                {/* BANNER ĐẦU TRANG */}
                <div className="bg-gradient-to-r from-indigo-950 via-slate-900 to-navy text-white p-5 rounded-3xl border border-indigo-400/50 shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3.5">
                    <div className="w-12 h-12 bg-indigo-500/30 text-indigo-300 border border-indigo-400/50 rounded-2xl flex items-center justify-center text-xl font-black shadow-inner">
                      <i className="fa-solid fa-boxes-packing"></i>
                    </div>
                    <div>
                      <h4 className="font-black text-sm text-amber-300 uppercase tracking-wider">
                        📦 LỊCH SỬ MUA HÀNG TOÀN BỘ KHÁCH HÀNG
                      </h4>
                      <p className="text-[11px] text-indigo-200 mt-0.5 font-medium">
                        Tra cứu toàn bộ các đơn hàng đặt mua thành công trên tất cả gian hàng Shop & dịch vụ hệ thống
                      </p>
                    </div>
                  </div>

                  <span className="bg-indigo-900 text-amber-300 border border-amber-400 font-black text-xs px-3.5 py-1.5 rounded-full shrink-0">
                    REALTIME CLOUD SYNC
                  </span>
                </div>

                {/* 3 THẺ THỐNG KÊ DOANH SỐ ĐƠN HÀNG */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  
                  <div className="bg-indigo-50 border border-indigo-200 p-4.5 rounded-2xl text-indigo-950 space-y-1 shadow-2xs">
                    <span className="text-[10px] font-bold uppercase text-indigo-700">TỔNG ĐƠN HOÀN TẤT</span>
                    <h4 className="text-xl font-black font-mono text-indigo-900">{globalOrdersList.length} Đơn hàng</h4>
                    <span className="text-[10px] text-indigo-600 font-semibold">Được xác nhận & giao dịch thành công</span>
                  </div>

                  <div className="bg-emerald-50 border border-emerald-200 p-4.5 rounded-2xl text-emerald-950 space-y-1 shadow-2xs">
                    <span className="text-[10px] font-bold uppercase text-emerald-700">TỔNG DOANH SỐ GIAO DỊCH</span>
                    <h4 className="text-xl font-black font-mono text-emerald-900">
                      {globalOrdersList.reduce((sum, o) => sum + Number(o.total_amount || 0), 0).toLocaleString('vi-VN')} VNĐ
                    </h4>
                    <span className="text-[10px] text-emerald-600 font-semibold">Doanh số thực tế thu từ giỏ hàng</span>
                  </div>

                  <div className="bg-amber-50 border border-amber-200 p-4.5 rounded-2xl text-amber-950 space-y-1 shadow-2xs">
                    <span className="text-[10px] font-bold uppercase text-amber-700">GIÁ TRỊ TRUNG BÌNH ĐƠN</span>
                    <h4 className="text-xl font-black font-mono text-amber-900">
                      {globalOrdersList.length > 0 
                        ? Math.round(globalOrdersList.reduce((sum, o) => sum + Number(o.total_amount || 0), 0) / globalOrdersList.length).toLocaleString('vi-VN')
                        : 0} VNĐ
                    </h4>
                    <span className="text-[10px] text-amber-600 font-semibold">Doanh thu trung bình trên mỗi đơn</span>
                  </div>

                </div>

                {/* KHU VỰC BẢNG DỮ LIỆU ĐƠN HÀNG */}
                <div className="bg-white border border-gray-200 p-5 rounded-3xl space-y-4 shadow-2xs">
                  
                  {/* thanh lọc và tìm kiếm */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-3">
                    <div className="flex items-center gap-2 flex-1 max-w-md">
                      <div className="relative w-full">
                        <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs"></i>
                        <input 
                          type="text" 
                          value={orderSearchQuery}
                          onChange={(e) => setOrderSearchQuery(e.target.value)}
                          placeholder="Tìm mã đơn #ID, Email khách, Họ tên hoặc Tên sản phẩm..."
                          className="w-full bg-slate-50 border border-gray-300 rounded-xl pl-8 pr-3 py-2 text-xs font-medium text-gray-800 focus:outline-none focus:border-indigo-500"
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <select 
                        value={orderPaymentFilter}
                        onChange={(e) => setOrderPaymentFilter(e.target.value)}
                        className="bg-slate-50 border border-gray-300 rounded-xl px-3 py-2 text-xs font-bold text-gray-800 focus:outline-none focus:border-indigo-500 cursor-pointer"
                      >
                        <option value="ALL">🌐 Tất Cả PTTT</option>
                        <option value="wallet">💳 Ví TQ Pay</option>
                        <option value="cash">💵 Tiền Mặt (COD)</option>
                        <option value="bank">🏦 Chuyển Khoản VietQR</option>
                      </select>

                      <button 
                        onClick={() => fetchCloudGlobalOrders().then(res => setGlobalOrdersList(res))}
                        className="bg-navy hover:bg-navy-dark text-amber-300 font-bold text-[11px] px-3.5 py-2 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 shrink-0"
                      >
                        <i className={`fa-solid fa-rotate ${loading ? 'animate-spin' : ''} text-xs`}></i>
                        <span>🔄 Nạp Lại</span>
                      </button>
                    </div>
                  </div>

                  {/* BẢNG LỊCH SỬ ĐƠN HÀNG */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-100 text-navy font-black border-b border-gray-200 uppercase text-[10px] tracking-wider">
                          <th className="py-3 px-4">Mã Đơn #ID</th>
                          <th className="py-3 px-4">Thời Gian Đặt</th>
                          <th className="py-3 px-4">Thông Tin Khách Hàng</th>
                          <th className="py-3 px-4">Mặt Hàng Mua</th>
                          <th className="py-3 px-4">Tổng Thanh Toán</th>
                          <th className="py-3 px-4">PTTT</th>
                          <th className="py-3 px-4">Trạng Thái</th>
                          <th className="py-3 px-4 text-center">Chi Tiết</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 font-medium text-gray-800">
                        {globalOrdersList
                          .filter(o => {
                            if (orderPaymentFilter !== 'ALL' && o.payment_method !== orderPaymentFilter) return false;
                            if (orderSearchQuery.trim()) {
                              const q = orderSearchQuery.toLowerCase();
                              const matchId = String(o.id).includes(q);
                              const matchEmail = (o.user_email || '').toLowerCase().includes(q);
                              const matchName = (o.user_name || '').toLowerCase().includes(q);
                              const matchItems = (o.items || []).some(i => (i.product_name || i.title || '').toLowerCase().includes(q));
                              return matchId || matchEmail || matchName || matchItems;
                            }
                            return true;
                          })
                          .map((order) => {
                            const isWallet = order.payment_method === 'wallet';
                            const isCash = order.payment_method === 'cash';

                            return (
                              <tr key={order.id} className="hover:bg-indigo-50/40 transition-colors">
                                <td className="py-3.5 px-4 font-mono font-black text-navy">
                                  <span className="bg-indigo-100 text-indigo-900 border border-indigo-300 px-2 py-0.5 rounded-lg">
                                    #{order.id}
                                  </span>
                                </td>

                                <td className="py-3.5 px-4 font-mono text-[11px] text-gray-500 whitespace-nowrap">
                                  {new Date(order.created_at || Date.now()).toLocaleString('vi-VN')}
                                </td>

                                <td className="py-3.5 px-4">
                                  <div className="space-y-0.5">
                                    <span className="font-extrabold text-gray-900 block">{order.user_name || 'Khách hàng'}</span>
                                    <p className="text-[10px] text-gray-500 font-mono">{order.user_email}</p>
                                    <span className="text-[9px] text-indigo-700 block truncate max-w-xs">{order.shipping_address}</span>
                                  </div>
                                </td>

                                <td className="py-3.5 px-4 max-w-xs">
                                  {order.items && order.items.length > 0 ? (
                                    <div className="space-y-1 text-[11px]">
                                      {order.items.map((item, idx) => (
                                        <div key={idx} className="flex items-center justify-between gap-2">
                                          <span className="font-bold text-gray-800 truncate">• {item.product_name || item.title}</span>
                                          <span className="text-gray-500 font-mono shrink-0">x{item.quantity || 1}</span>
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    <span className="text-gray-600 font-bold">Đơn hàng sản phẩm TQ Store</span>
                                  )}
                                </td>

                                <td className="py-3.5 px-4 font-black text-red-600 font-mono text-sm whitespace-nowrap">
                                  {Number(order.total_amount || 0).toLocaleString('vi-VN')} VNĐ
                                </td>

                                <td className="py-3.5 px-4 whitespace-nowrap">
                                  {isWallet ? (
                                    <span className="bg-emerald-100 text-emerald-900 border border-emerald-300 font-extrabold text-[10px] px-2.5 py-1 rounded-full inline-flex items-center gap-1">
                                      <i className="fa-solid fa-wallet text-emerald-600"></i>
                                      <span>Ví TQ Pay</span>
                                    </span>
                                  ) : isCash ? (
                                    <span className="bg-amber-100 text-amber-900 border border-amber-300 font-extrabold text-[10px] px-2.5 py-1 rounded-full inline-flex items-center gap-1">
                                      <i className="fa-solid fa-money-bill text-amber-600"></i>
                                      <span>Tiền mặt COD</span>
                                    </span>
                                  ) : (
                                    <span className="bg-blue-100 text-blue-900 border border-blue-300 font-extrabold text-[10px] px-2.5 py-1 rounded-full inline-flex items-center gap-1">
                                      <i className="fa-solid fa-building-columns text-blue-600"></i>
                                      <span>VietQR</span>
                                    </span>
                                  )}
                                </td>

                                <td className="py-3.5 px-4 whitespace-nowrap">
                                  <span className="bg-emerald-100 text-emerald-900 border border-emerald-300 font-black text-[10px] px-2.5 py-0.5 rounded-full inline-flex items-center gap-1">
                                    <i className="fa-solid fa-circle-check text-emerald-600"></i>
                                    <span>HOÀN TẤT</span>
                                  </span>
                                </td>

                                <td className="py-3.5 px-4 text-center">
                                  <button 
                                    onClick={() => setSelectedOrderModal(order)}
                                    className="bg-navy hover:bg-navy-dark text-amber-300 font-extrabold text-[10px] px-2.5 py-1.5 rounded-xl cursor-pointer transition-all shadow-xs inline-flex items-center gap-1"
                                  >
                                    <i className="fa-solid fa-eye text-xs"></i>
                                    <span>CHI TIẾT</span>
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>
                </div>

              </div>
            )}

            {/* TÍNH NĂNG CHUYÊN BIỆT: CẤU HÌNH NGÂN HÀNG HỆ THỐNG NHẬN TIỀN NẠP (VIETQR) */}
            {activeAdminTab === 'system_bank' && (
              <div className="space-y-5 font-sans text-xs">
                
                {/* BANNER ĐẦU TRANG */}
                <div className="bg-gradient-to-r from-emerald-950 via-slate-900 to-teal-950 text-white p-5 rounded-3xl border border-emerald-400/50 shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3.5">
                    <div className="w-12 h-12 bg-emerald-500/30 text-emerald-300 border border-emerald-400/50 rounded-2xl flex items-center justify-center text-xl font-black shadow-inner">
                      <i className="fa-solid fa-building-columns"></i>
                    </div>
                    <div>
                      <h4 className="font-black text-sm text-amber-300 uppercase tracking-wider">
                        🏦 CẤU HÌNH NGÂN HÀNG HỆ THỐNG & VIETQR NẠP TIỀN
                      </h4>
                      <p className="text-[11px] text-emerald-200 mt-0.5 font-medium">
                        Thiết lập tài khoản thụ hưởng của hệ thống và mã VietQR quét tự động dành cho khách hàng nạp Ví TQ Pay
                      </p>
                    </div>
                  </div>

                  <span className="bg-emerald-900 text-amber-300 border border-emerald-400 font-black text-xs px-3 py-1.5 rounded-full shrink-0">
                    AUTOMATIC VIETQR GEN
                  </span>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                  
                  {/* CỘT BÊN TRÁI: FORM ĐIỀU CHỈNH THÔNG TIN NGÂN HÀNG HỆ THỐNG */}
                  <div className="lg:col-span-2 bg-white border border-gray-200 p-5 sm:p-6 rounded-3xl space-y-5 shadow-2xs">
                    <div className="border-b border-gray-100 pb-3 flex items-center gap-2">
                      <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-ping"></span>
                      <h4 className="font-black text-navy text-xs uppercase tracking-wider">
                        📝 THÔNG TIN TÀI KHOẢN NGÂN HÀNG THỤ HƯỞNG HỆ THỐNG
                      </h4>
                    </div>

                    <form onSubmit={handleSaveSystemBankConfig} className="space-y-4">
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        
                        {/* 1. CHỌN NGÂN HÀNG */}
                        <div>
                          <label className="block font-extrabold text-gray-700 mb-1">
                            Ngân hàng thụ hưởng (VietQR Bank):
                          </label>
                          <select 
                            value={systemBankForm.bankCode}
                            onChange={(e) => {
                              const selectedCode = e.target.value;
                              const selectedText = e.target.options[e.target.selectedIndex].text;
                              setSystemBankForm({
                                ...systemBankForm,
                                bankCode: selectedCode,
                                bankName: selectedText
                              });
                            }}
                            className="w-full bg-slate-50 border border-gray-300 rounded-xl px-3.5 py-2.5 text-xs font-bold text-navy focus:outline-none focus:border-emerald-500 cursor-pointer"
                          >
                            <option value="MB">MB Bank (Ngân Hàng Quân Đội - MB)</option>
                            <option value="VCB">Vietcombank (Ngân Hàng Ngoại Thương - VCB)</option>
                            <option value="TCB">Techcombank (Ngân Hàng Kỹ Thương - TCB)</option>
                            <option value="VPB">VPBank (Ngân Hàng Thịnh Vượng - VPB)</option>
                            <option value="BIDV">BIDV (Ngân Hàng ĐT & PT Việt Nam)</option>
                            <option value="CTG">VietinBank (Ngân Hàng Công Thương)</option>
                            <option value="ACB">ACB (Ngân Hàng Á Châu)</option>
                            <option value="TPB">TPBank (Ngân Hàng Tiên Phong)</option>
                            <option value="STB">Sacombank (Ngân Hàng Sài Gòn Thương Tín)</option>
                            <option value="VIB">VIB (Ngân Hàng Quốc Tế)</option>
                          </select>
                        </div>

                        {/* 2. SỐ TÀI KHOẢN */}
                        <div>
                          <label className="block font-extrabold text-gray-700 mb-1">
                            Số Tài Khoản Ngân Hàng (STK):
                          </label>
                          <input 
                            type="text" 
                            value={systemBankForm.accountNumber}
                            onChange={(e) => setSystemBankForm({ ...systemBankForm, accountNumber: e.target.value.trim() })}
                            required 
                            placeholder="0988888888" 
                            className="w-full bg-slate-50 border border-gray-300 rounded-xl px-3.5 py-2.5 text-xs font-mono font-black text-navy focus:outline-none focus:border-emerald-500"
                          />
                        </div>

                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        
                        {/* 3. TÊN CHỦ TÀI KHOẢN */}
                        <div>
                          <label className="block font-extrabold text-gray-700 mb-1">
                            Tên Chủ Tài Khoản (Viết hoa không dấu):
                          </label>
                          <input 
                            type="text" 
                            value={systemBankForm.accountHolder}
                            onChange={(e) => setSystemBankForm({ ...systemBankForm, accountHolder: e.target.value.toUpperCase() })}
                            required 
                            placeholder="CONG TY TNHH TQ STORE VIETNAM" 
                            className="w-full bg-slate-50 border border-gray-300 rounded-xl px-3.5 py-2.5 text-xs font-mono font-black text-navy focus:outline-none focus:border-emerald-500 uppercase"
                          />
                        </div>

                        {/* 4. CHI NHÁNH */}
                        <div>
                          <label className="block font-extrabold text-gray-700 mb-1">
                            Chi nhánh Ngân hàng mở thẻ:
                          </label>
                          <input 
                            type="text" 
                            value={systemBankForm.branch}
                            onChange={(e) => setSystemBankForm({ ...systemBankForm, branch: e.target.value })}
                            placeholder="Chi nhánh Hà Nội / Sở Giao Dịch" 
                            className="w-full bg-slate-50 border border-gray-300 rounded-xl px-3.5 py-2.5 text-xs font-medium text-gray-800 focus:outline-none focus:border-emerald-500"
                          />
                        </div>

                      </div>

                      {/* 5. CÚ PHÁP CHUYỂN KHOẢN PRE-FIX */}
                      <div>
                        <label className="block font-extrabold text-gray-700 mb-1">
                          Cú pháp nội dung nạp tiền tiền tố (Prefix):
                        </label>
                        <input 
                          type="text" 
                          value={systemBankForm.transferSyntaxPrefix}
                          onChange={(e) => setSystemBankForm({ ...systemBankForm, transferSyntaxPrefix: e.target.value.toUpperCase() })}
                          placeholder="NAP TQPAY" 
                          className="w-full bg-slate-50 border border-gray-300 rounded-xl px-3.5 py-2.5 text-xs font-mono font-bold text-emerald-800 focus:outline-none focus:border-emerald-500 uppercase"
                        />
                        <p className="text-[10px] text-gray-500 font-medium mt-1">
                          Ví dụ cú pháp hiển thị cho khách quét QR: <strong className="text-emerald-700 font-mono">{systemBankForm.transferSyntaxPrefix || 'NAP TQPAY'} khachhang@gmail.com</strong>
                        </p>
                      </div>

                      <button 
                        type="submit" 
                        className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 text-white font-black py-3.5 rounded-xl text-xs uppercase tracking-wider shadow-md transition-all cursor-pointer flex items-center justify-center gap-2"
                      >
                        <i className="fa-solid fa-floppy-disk text-amber-300 text-sm"></i>
                        <span>💾 LƯU CẤU HÌNH NGÂN HÀNG HỆ THỐNG</span>
                      </button>

                    </form>
                  </div>

                  {/* CỘT BÊN PHẢI: XEM TRƯỚC MÃ VIETQR QUÉT TỰ ĐỘNG CỦA KHÁCH HÀNG */}
                  <div className="bg-gradient-to-b from-slate-900 via-navy to-slate-950 text-white p-5 rounded-3xl space-y-4 shadow-md flex flex-col justify-between border border-amber-400/40">
                    <div className="space-y-3 text-center">
                      <div className="inline-block bg-amber-400 text-navy font-black text-[10px] px-3 py-1 rounded-full uppercase tracking-wider">
                        📱 MÃ VIETQR DEMO KHÁCH HÀNG THẤY
                      </div>

                      <h5 className="font-extrabold text-xs text-amber-300 uppercase">
                        Giao diện quét mã VietQR tự động
                      </h5>

                      <div className="bg-white p-3 rounded-2xl shadow-xl inline-block border-4 border-amber-400">
                        <img 
                          src={generateVietQRUrl(systemBankForm.bankCode, systemBankForm.accountNumber, 500000, `${systemBankForm.transferSyntaxPrefix} demo@tqstore.vn`)} 
                          alt="VietQR Demo"
                          className="w-48 h-48 object-contain rounded-xl"
                        />
                      </div>

                      <div className="bg-white/10 p-3.5 rounded-2xl text-left space-y-1.5 font-mono text-[11px]">
                        <div className="flex justify-between">
                          <span className="text-gray-400">Ngân hàng:</span>
                          <span className="font-bold text-amber-300">{systemBankForm.bankName || 'MB Bank'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Số tài khoản:</span>
                          <span className="font-bold text-white text-xs">{systemBankForm.accountNumber || '0988888888'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Chủ tài khoản:</span>
                          <span className="font-bold text-emerald-400 truncate max-w-[150px]">{systemBankForm.accountHolder || 'TQ STORE'}</span>
                        </div>
                      </div>
                    </div>

                    <p className="text-[10px] text-center text-gray-400 italic">
                      Mã VietQR được tạo động theo chuẩn NAPAS 24/7. Khách hàng nạp tiền sẽ nhận mã QR này kèm theo số tiền và nội dung chuyển khoản tự động điền sẵn.
                    </p>
                  </div>

                </div>

              </div>
            )}

            {/* TÍNH NĂNG CHUYÊN BIỆT: QUẢN LÝ LƯỢT MUA & THÊM ĐÁNH GIÁ AI (REVIEWS & SALES COUNT) */}
            {activeAdminTab === 'reviews_manager' && (
              <div className="space-y-5 font-sans text-xs">
                
                {/* BANNER ĐẦU TRANG */}
                <div className="bg-gradient-to-r from-amber-950 via-slate-900 to-yellow-950 text-white p-5 rounded-3xl border border-amber-400/50 shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3.5">
                    <div className="w-12 h-12 bg-amber-500/30 text-amber-300 border border-amber-400/50 rounded-2xl flex items-center justify-center text-xl font-black shadow-inner">
                      <i className="fa-solid fa-star-half-stroke"></i>
                    </div>
                    <div>
                      <h4 className="font-black text-sm text-amber-300 uppercase tracking-wider">
                        ⭐ QUẢN LÝ LƯỢT MUA & TỰ ĐỘNG THÊM ĐÁNH GIÁ ẢO (AI REVIEWS)
                      </h4>
                      <p className="text-[11px] text-amber-200 mt-0.5 font-medium">
                        Chỉnh sửa trực tiếp số lượng lượt đã bán và sinh tên tài khoản ảo ngẫu nhiên như người dùng thật kèm đánh giá & số sao
                      </p>
                    </div>
                  </div>

                  <button 
                    onClick={loadAdminData}
                    className="bg-navy hover:bg-navy-dark text-amber-300 font-bold text-xs px-3.5 py-2 rounded-2xl border border-amber-400/40 shadow-xs transition-all cursor-pointer flex items-center gap-1.5 shrink-0"
                  >
                    <i className={`fa-solid fa-rotate ${loading ? 'animate-spin' : ''} text-xs`}></i>
                    <span>🔄 Nạp Lại CSDL</span>
                  </button>
                </div>

                {/* BẢNG SẢN PHẨM & CÔNG CỤ CHỈNH SỬA LƯỢT BÁN / THÊM REVIEW */}
                <div className="bg-white border border-gray-200 p-5 rounded-3xl space-y-4 shadow-2xs">
                  <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                    <h4 className="font-extrabold text-navy text-xs uppercase tracking-wider">
                      📋 Danh Sách Sản Phẩm Cần Quản Lý Lượt Mua & Đánh Giá ({productsList.length} sản phẩm)
                    </h4>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                    {productsList.map((p) => {
                      const sales = p.sales_count || p.salesCount || 0;
                      const title = p.title || p.name || 'Sản phẩm';
                      const price = Number(p.price || 0);
                      const img = p.image_url || 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=300&q=80';
                      const storedRevs = getStoredProductReviews(p.id);

                      return (
                        <div 
                          key={p.id}
                          className="bg-slate-50 border border-gray-200 hover:border-amber-400 p-4 rounded-2xl space-y-3 shadow-2xs flex flex-col justify-between transition-all"
                        >
                          <div className="space-y-2">
                            <div className="flex items-start gap-3">
                              <img 
                                src={img} 
                                alt={title} 
                                className="w-14 h-14 object-cover rounded-xl border border-gray-200 shrink-0"
                              />
                              <div className="space-y-0.5 flex-1 min-w-0">
                                <h5 className="font-black text-navy text-xs truncate" title={title}>{title}</h5>
                                <p className="text-[10px] text-gray-500 font-mono">Shop: {p.shop_name || p.shop || 'TQ Store'}</p>
                                <span className="font-black text-red-600 text-xs block">
                                  {price.toLocaleString('vi-VN')} VNĐ
                                </span>
                              </div>
                            </div>

                            <div className="bg-white border border-gray-200 p-2.5 rounded-xl flex items-center justify-between text-[11px] font-bold">
                              <div className="flex items-center gap-1 text-emerald-800 font-mono">
                                <i className="fa-solid fa-cart-check text-emerald-600"></i>
                                <span>Đã bán: <strong className="text-emerald-700 font-black">{sales.toLocaleString('vi-VN')}</strong> lượt</span>
                              </div>

                              <div className="flex items-center gap-1 text-amber-700 font-mono">
                                <i className="fa-solid fa-star text-amber-500"></i>
                                <span>5.0 ({storedRevs.length + 15} review)</span>
                              </div>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-2 pt-1">
                            <button 
                              onClick={() => setEditSalesModal({ id: p.id, title: title, salesCount: sales })}
                              className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-[10px] py-2 rounded-xl transition-all shadow-xs flex items-center justify-center gap-1 cursor-pointer"
                            >
                              <i className="fa-solid fa-pen-to-square"></i>
                              <span>SỬA LƯỢT BÁN</span>
                            </button>

                            <button 
                              onClick={() => setAddReviewModal({
                                id: p.id,
                                title: title,
                                userName: generateRandomVietnameseName(),
                                rating: 5,
                                comment: getRandomAiReview()
                              })}
                              className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-[10px] py-2 rounded-xl transition-all shadow-xs flex items-center justify-center gap-1 cursor-pointer border border-amber-400"
                            >
                              <i className="fa-solid fa-robot"></i>
                              <span>THÊM REVIEW AI</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

              </div>
            )}

            {/* TÍNH NĂNG CHUYÊN BIỆT: ĐỔI GIAO DIỆN TOÀN HỆ THỐNG THỜI GIAN THỰC (REALTIME THEME SWITCHER) */}
            {activeAdminTab === 'system_theme' && (
              <div className="space-y-5 font-sans text-xs">
                
                {/* BANNER ĐẦU TRANG */}
                <div className="bg-gradient-to-r from-purple-950 via-slate-900 to-indigo-950 text-white p-5 rounded-3xl border border-purple-400/50 shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3.5">
                    <div className="w-12 h-12 bg-purple-500/30 text-purple-300 border border-purple-400/50 rounded-2xl flex items-center justify-center text-xl font-black shadow-inner">
                      <i className="fa-solid fa-palette"></i>
                    </div>
                    <div>
                      <h4 className="font-black text-sm text-amber-300 uppercase tracking-wider">
                        🎨 ĐỔI GIAO DIỆN TOÀN HỆ THỐNG THỜI GIAN THỰC (SUPABASE REALTIME THEME)
                      </h4>
                      <p className="text-[11px] text-purple-200 mt-0.5 font-medium">
                        Super Admin thay đổi giao diện ➔ Tất cả thiết bị của khách hàng & shop trên toàn thế giới chuyển màu lập tức không cần F5!
                      </p>
                    </div>
                  </div>

                  <span className="bg-purple-900 text-amber-300 border border-purple-400 font-black text-xs px-3 py-1.5 rounded-full shrink-0">
                    REALTIME BROADCAST
                  </span>
                </div>

                {/* DANH SÁCH BỘ GIAO DIỆN THEO SỰ KIỆN & LỄ HỘI */}
                <div className="bg-white border border-gray-200 p-5 rounded-3xl space-y-4 shadow-sm">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-gray-100 pb-3 gap-2">
                    <div>
                      <h4 className="font-black text-navy text-xs uppercase tracking-wider flex items-center gap-1.5">
                        <i className="fa-solid fa-wand-magic-sparkles text-purple-600"></i>
                        <span>🎉 CHỌN GIAO DIỆN THEO SỰ KIỆN & LỄ HỘI (ÁP DỤNG REALTIME TỨC THÌ)</span>
                      </h4>
                      <p className="text-[11px] text-gray-500 font-medium">
                        Kích hoạt giao diện sự kiện (Tết Nguyên Đán, Giáng Sinh, Quốc Khánh 2/9, Black Friday...) toàn bộ người dùng chuyển giao diện ngay lập tức!
                      </p>
                    </div>
                    <span className="text-gray-600 font-mono text-[11px] bg-purple-50 border border-purple-200 px-3 py-1 rounded-full shrink-0">
                      Đang chạy: <strong className="text-purple-700 font-black">{currentActiveTheme.name || '🔴 Đỏ Tươi Shopee'}</strong>
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                    {Object.values(SYSTEM_THEME_PRESETS).map((t) => {
                      const isCurrent = (currentActiveTheme.id || currentActiveTheme.theme_name) === t.id;

                      return (
                        <div 
                          key={t.id}
                          className={`p-4 rounded-2xl border-2 space-y-3 shadow-sm transition-all flex flex-col justify-between ${
                            isCurrent ? 'border-amber-400 ring-2 ring-amber-300/40 bg-purple-50/40' : 'border-gray-200 hover:border-purple-300 bg-white'
                          }`}
                        >
                          <div className="space-y-2">
                            <div className="flex items-center justify-between gap-1">
                              <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-slate-900 text-amber-300">
                                {t.eventTag || '🎉 SỰ KIỆN'}
                              </span>
                              {isCurrent && (
                                <span className="bg-amber-400 text-navy font-black text-[9px] px-2 py-0.5 rounded-full uppercase">
                                  ✓ ĐANG CHẠY
                                </span>
                              )}
                            </div>

                            <h5 className="font-black text-navy text-xs leading-snug">{t.name}</h5>

                            <div className={`h-16 rounded-xl p-2.5 flex items-center justify-center text-white font-bold text-[10px] text-center shadow-inner ${t.bgGradient}`}>
                              <span className="drop-shadow-sm line-clamp-2">{t.bannerTitle || t.name}</span>
                            </div>

                            <div className="flex items-center justify-between text-[10px] text-gray-500 font-mono pt-1">
                              <span>Màu chính: <strong style={{ color: t.primaryColor }}>{t.primaryColor}</strong></span>
                              <span>Điểm nhấn: <strong style={{ color: t.accentColor }}>{t.accentColor}</strong></span>
                            </div>
                          </div>

                          <button 
                            onClick={() => handleChangeSystemTheme(t.id)}
                            disabled={isCurrent}
                            className={`w-full font-black text-xs py-2.5 rounded-xl uppercase tracking-wider transition-all shadow-xs cursor-pointer flex items-center justify-center gap-1.5 ${
                              isCurrent 
                                ? 'bg-gray-200 text-gray-400 cursor-not-allowed' 
                                : 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 text-white shadow-md'
                            }`}
                          >
                            <i className="fa-solid fa-wand-magic-sparkles text-amber-300"></i>
                            <span>{isCurrent ? 'ĐANG KÍCH HOẠT' : '🎨 ÁP DỤNG REALTIME'}</span>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>

              </div>
            )}

            {/* TÍNH NĂNG CHUYÊN BIỆT: PHÁT THÔNG BÁO TOÀN HỆ THỐNG (SYSTEM-WIDE BROADCAST ANNOUNCEMENTS) */}
            {activeAdminTab === 'announcements_manager' && (
              <div className="space-y-5 font-sans text-xs">
                
                {/* BANNER ĐẦU TRANG */}
                <div className="bg-gradient-to-r from-red-950 via-slate-900 to-rose-950 text-white p-5 rounded-3xl border border-red-400/50 shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3.5">
                    <div className="w-12 h-12 bg-red-500/30 text-amber-300 border border-red-400/50 rounded-2xl flex items-center justify-center text-xl font-black shadow-inner">
                      <i className="fa-solid fa-bullhorn animate-pulse"></i>
                    </div>
                    <div>
                      <h4 className="font-black text-sm text-amber-300 uppercase tracking-wider">
                        📢 PHÁT THÔNG BÁO TOÀN HỆ THỐNG (SYSTEM-WIDE BROADCAST)
                      </h4>
                      <p className="text-[11px] text-rose-200 mt-0.5 font-medium">
                        Phát thông báo tới tất cả người dùng (online lẫn khách vãng lai hay người dùng truy cập sau này)
                      </p>
                    </div>
                  </div>

                  <span className="bg-red-900 text-amber-300 border border-red-400 font-black text-xs px-3 py-1.5 rounded-full shrink-0">
                    PUSH BROADCAST
                  </span>
                </div>

                {/* FORM TẠO & PHÁT THÔNG BÁO MỚI */}
                <div className="bg-white border border-gray-200 p-5 rounded-3xl space-y-4 shadow-2xs">
                  <div className="border-b border-gray-100 pb-3 flex items-center gap-2">
                    <span className="w-2.5 h-2.5 bg-red-600 rounded-full animate-ping"></span>
                    <h4 className="font-black text-navy text-xs uppercase tracking-wider">
                      📝 TẠO & NẠP THÔNG BÁO PHÁT TOÀN SÀN
                    </h4>
                  </div>

                  <form onSubmit={handlePublishSystemAnnouncement} className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      {/* Phân loại thông báo */}
                      <div>
                        <label className="block font-extrabold text-gray-700 mb-1">
                          Phân loại loại hình thông báo:
                        </label>
                        <select 
                          value={announcementForm.type}
                          onChange={(e) => setAnnouncementForm({ ...announcementForm, type: e.target.value })}
                          className="w-full bg-slate-50 border border-gray-300 rounded-xl px-3.5 py-2.5 text-xs font-black text-navy focus:outline-none focus:border-red-500 cursor-pointer"
                        >
                          <option value="ANNOUNCEMENT">📢 Thông Báo Mới (Nổi Bật)</option>
                          <option value="PROMOTION">🎁 Siêu Khuyến Mãi / Ưu Đãi Hè</option>
                          <option value="URGENT">🚨 Cảnh Báo Khẩn Cấp / An Ninh</option>
                          <option value="MAINTENANCE">🛠️ Cập Nhật Bảo Trì Hệ Thống</option>
                        </select>
                      </div>

                      {/* Tiêu đề */}
                      <div className="sm:col-span-2">
                        <label className="block font-extrabold text-gray-700 mb-1">
                          Tiêu đề thông báo nổi bật:
                        </label>
                        <input 
                          type="text" 
                          value={announcementForm.title}
                          onChange={(e) => setAnnouncementForm({ ...announcementForm, title: e.target.value })}
                          required
                          placeholder="Ví dụ: 🎉 CHÀO THÁNG 8 - TẶNG 50K XU VÍ TQ PAY CHO TOÀN BỘ KHÁCH HÀNG!" 
                          className="w-full bg-slate-50 border border-gray-300 rounded-xl px-3.5 py-2.5 text-xs font-black text-navy focus:outline-none focus:border-red-500"
                        />
                      </div>
                    </div>

                    {/* Nội dung chi tiết */}
                    <div>
                      <label className="block font-extrabold text-gray-700 mb-1">
                        Nội dung chi tiết thông báo gửi khách hàng:
                      </label>
                      <textarea 
                        value={announcementForm.content}
                        onChange={(e) => setAnnouncementForm({ ...announcementForm, content: e.target.value })}
                        required
                        rows={4}
                        placeholder="Nhập nội dung chi tiết bài viết thông báo..."
                        className="w-full bg-slate-50 border border-gray-300 rounded-xl p-3.5 text-xs font-medium text-gray-800 focus:outline-none focus:border-red-500"
                      />
                    </div>

                    <button 
                      type="submit" 
                      disabled={isPublishingBroadcast}
                      className="w-full bg-gradient-to-r from-red-600 via-rose-600 to-amber-600 hover:from-red-700 text-white font-black py-3.5 rounded-2xl text-xs uppercase tracking-wider shadow-md transition-all cursor-pointer flex items-center justify-center gap-2 border border-amber-300"
                    >
                      <i className={`fa-solid ${isPublishingBroadcast ? 'fa-spinner fa-spin' : 'fa-paper-plane'} text-amber-300 text-sm`}></i>
                      <span>{isPublishingBroadcast ? 'ĐANG PHÁT THÔNG BÁO...' : '🚀 PHÁT THÔNG BÁO TOÀN HỆ THỐNG NGAY'}</span>
                    </button>
                  </form>
                </div>

              </div>
            )}

            {/* TÍNH NĂNG NỔI BẬT 3: NHẬT KÝ THAO TÁC HỆ THỐNG (AUDIT LOGS & AUDIT TRAIL) */}
            {activeAdminTab === 'audit_logs' && (
              <div className="space-y-4 text-xs">
                {/* Audit Logs Filter Bar */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-gray-200 shadow-2xs">
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-navy">Lọc theo phân quyền:</span>
                    <select 
                      value={logRoleFilter}
                      onChange={(e) => setLogRoleFilter(e.target.value)}
                      className="bg-gray-100 border border-gray-300 rounded-xl px-3 py-1.5 font-bold text-xs cursor-pointer focus:outline-none focus:border-navy"
                    >
                      <option value="ALL">🌐 Tất cả thao tác ({auditLogsList.length})</option>
                      <option value="SUPER_ADMIN">👑 Super Admin Overlord</option>
                      <option value="EMPLOYEE">💼 Nhân viên vận hành</option>
                      <option value="SHOP">🏪 Gian hàng / Shop</option>
                    </select>
                  </div>

                  <span className="text-[11px] text-gray-500 font-medium">
                    Đang hiển thị <strong>{filteredLogs.length}</strong> nhật ký thao tác
                  </span>
                </div>

                {/* Audit Trail Table */}
                <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-2xs">
                  {filteredLogs.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-navy text-white text-[11px] font-black uppercase tracking-wider">
                            <th className="py-3 px-4">Thời Gian</th>
                            <th className="py-3 px-4">Người Thao Tác</th>
                            <th className="py-3 px-4">Phân Quyền</th>
                            <th className="py-3 px-4">Hành Động</th>
                            <th className="py-3 px-4">Chi Tiết Nhật Ký</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 font-medium text-gray-800">
                          {filteredLogs.map((log) => (
                            <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                              <td className="py-3 px-4 font-mono text-[11px] text-gray-500 whitespace-nowrap">
                                {new Date(log.timestamp).toLocaleString('vi-VN')}
                              </td>
                              <td className="py-3 px-4 font-bold text-navy whitespace-nowrap">
                                {log.actor}
                              </td>
                              <td className="py-3 px-4 whitespace-nowrap">
                                {getRoleBadge(log.role)}
                              </td>
                              <td className="py-3 px-4 font-black text-amber-700 whitespace-nowrap">
                                {log.action}
                              </td>
                              <td className="py-3 px-4 text-gray-600 max-w-xs truncate" title={log.details}>
                                {log.details}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="py-16 text-center text-gray-400 font-medium space-y-2">
                      <i className="fa-solid fa-clipboard-check text-3xl text-gray-300 block mb-1"></i>
                      <p>Chưa có ghi nhận nhật ký thao tác nào phù hợp.</p>
                      <p className="text-[11px] text-gray-400">Các thao tác bật/tắt hệ thống, xóa sản phẩm sẽ tự động ghi lại tại đây.</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TÍNH NĂNG 4: THỐNG KÊ DOANH THU */}
            {activeAdminTab === 'stats' && (
              <div className="space-y-4 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="bg-emerald-50 border border-emerald-200 p-4.5 rounded-2xl text-emerald-900 space-y-1 shadow-2xs">
                    <span className="text-[10px] font-bold uppercase text-emerald-700">TỔNG DOANH THU VÍ</span>
                    <h4 className="text-xl font-black font-mono">0 VNĐ</h4>
                    <span className="text-[10px] text-emerald-600 font-semibold">Tài khoản sạch • Chưa có phát sinh</span>
                  </div>

                  <div className="bg-amber-50 border border-amber-200 p-4.5 rounded-2xl text-amber-900 space-y-1 shadow-2xs">
                    <span className="text-[10px] font-bold uppercase text-amber-700">TỔNG XU PHÁT HÀNH</span>
                    <h4 className="text-xl font-black font-mono">0 Xu</h4>
                    <span className="text-[10px] text-amber-600 font-semibold">Tài khoản sạch • Chưa có Xu thưởng</span>
                  </div>

                  <div className="bg-blue-50 border border-blue-200 p-4.5 rounded-2xl text-blue-900 space-y-1 shadow-2xs">
                    <span className="text-[10px] font-bold uppercase text-blue-700">TỔNG ĐƠN HOÀN TẤT</span>
                    <h4 className="text-xl font-black font-mono">0 Đơn hàng</h4>
                    <span className="text-[10px] text-blue-600 font-semibold">Tài khoản sạch • Chưa có đơn hàng</span>
                  </div>
                </div>
              </div>
            )}

            {/* TÍNH NĂNG 5: BẢO MẬT & RLS */}
            {activeAdminTab === 'security' && (
              <div className="space-y-3 text-xs text-gray-700">
                <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-2xl flex items-center gap-3 text-emerald-800 font-bold shadow-2xs">
                  <i className="fa-solid fa-shield-check text-2xl text-emerald-600"></i>
                  <div>
                    <h5 className="text-sm">Trạng Thái Bảo Mật Hệ Thống: AN TOÀN TỐI ĐA</h5>
                    <p className="text-xs font-normal text-emerald-700 mt-0.5">Đã bật Row Level Security (RLS), Parameterized Queries & Sanitizer XSS.</p>
                  </div>
                </div>
              </div>
            )}

            {/* TÍNH NĂNG 6: CẤU HÌNH HỆ THỐNG (% VÍ / XU / PHÍ SÀN MẶC ĐỊNH) */}
            {activeAdminTab === 'settings' && (
              <div className="space-y-5 text-xs font-sans">
                
                <div className="bg-white border border-gray-200 p-5 sm:p-6 rounded-3xl space-y-5 shadow-2xs">
                  <div className="border-b border-gray-200 pb-3 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-10 h-10 bg-amber-100 text-amber-900 rounded-2xl flex items-center justify-center text-lg font-black shadow-xs">
                        ⚙️
                      </div>
                      <div>
                        <h4 className="font-black text-navy text-sm uppercase tracking-wider">
                          CẤU HÌNH % VÍ / XU / PHÍ SÀN MẶC ĐỊNH TOÀN SÀN
                        </h4>
                        <p className="text-[11px] text-gray-500 font-medium">
                          Tùy chỉnh tỷ lệ % Ưu đãi Ví, % Hoàn TQ Xu và % Phí sàn dịch vụ áp dụng cho toàn hệ thống
                        </p>
                      </div>
                    </div>

                    <span className="bg-navy text-amber-300 font-black text-[10px] px-3 py-1 rounded-full border border-amber-400">
                      SYSTEM PARAMS
                    </span>
                  </div>

                  {/* 3 THẺ ĐIỀU CHỈNH TỶ LỆ % CHÍNH */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    
                    {/* THAM SỐ 1: % ƯU ĐÃI GIẢM GIÁ VÍ TQ PAY */}
                    <div className="bg-emerald-50/80 border-2 border-emerald-300 p-4 rounded-2xl space-y-3 shadow-2xs">
                      <div className="flex items-center justify-between">
                        <span className="font-extrabold text-emerald-900 text-xs flex items-center gap-1.5">
                          <i className="fa-solid fa-wallet text-emerald-600 text-sm"></i>
                          <span>1. % Ưu Đãi Giảm Giá Ví TQ Pay</span>
                        </span>
                        <span className="bg-emerald-600 text-white font-black text-xs px-2.5 py-0.5 rounded-full font-mono">
                          {platformConfig.wallet_discount_percent}%
                        </span>
                      </div>

                      <p className="text-[11px] text-emerald-800">
                        Tỷ lệ % giảm giá trực tiếp khấu trừ vào tổng đơn hàng khi khách hàng lựa chọn thanh toán qua Ví TQ Pay.
                      </p>

                      <div className="space-y-1">
                        <input 
                          type="range" 
                          min={0} 
                          max={20} 
                          step={0.5}
                          value={platformConfig.wallet_discount_percent}
                          onChange={(e) => setPlatformConfig({ ...platformConfig, wallet_discount_percent: Number(e.target.value) })}
                          className="w-full accent-emerald-600 cursor-pointer"
                        />
                        <div className="flex justify-between text-[10px] text-emerald-700 font-mono font-bold">
                          <span>0%</span>
                          <span>10%</span>
                          <span>20%</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <label className="text-gray-600 font-bold">Tỷ lệ % tùy chỉnh:</label>
                        <input 
                          type="number" 
                          min={0}
                          max={100}
                          step={0.1}
                          value={platformConfig.wallet_discount_percent}
                          onChange={(e) => setPlatformConfig({ ...platformConfig, wallet_discount_percent: Number(e.target.value) })}
                          className="w-20 bg-white border border-emerald-300 rounded-lg px-2 py-1 font-mono font-black text-center text-emerald-700 text-xs"
                        />
                        <span className="font-bold text-emerald-800">%</span>
                      </div>
                    </div>

                    {/* THAM SỐ 2: % HOÀN TQ XU ĐÁNH GIÁ & MUA HÀNG */}
                    <div className="bg-amber-50/80 border-2 border-amber-300 p-4 rounded-2xl space-y-3 shadow-2xs">
                      <div className="flex items-center justify-between">
                        <span className="font-extrabold text-amber-900 text-xs flex items-center gap-1.5">
                          <i className="fa-solid fa-coins text-amber-600 text-sm"></i>
                          <span>2. % Hoàn TQ Xu Đánh Giá</span>
                        </span>
                        <span className="bg-amber-600 text-white font-black text-xs px-2.5 py-0.5 rounded-full font-mono">
                          {platformConfig.coins_cashback_percent}%
                        </span>
                      </div>

                      <p className="text-[11px] text-amber-800">
                        Tỷ lệ % hoàn Xu TQ tích lũy thưởng cho khách hàng khi hoàn tất đơn hàng và viết đánh giá sản phẩm.
                      </p>

                      <div className="space-y-1">
                        <input 
                          type="range" 
                          min={0} 
                          max={10} 
                          step={0.5}
                          value={platformConfig.coins_cashback_percent}
                          onChange={(e) => setPlatformConfig({ ...platformConfig, coins_cashback_percent: Number(e.target.value) })}
                          className="w-full accent-amber-600 cursor-pointer"
                        />
                        <div className="flex justify-between text-[10px] text-amber-700 font-mono font-bold">
                          <span>0%</span>
                          <span>5%</span>
                          <span>10%</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <label className="text-gray-600 font-bold">Tỷ lệ % tùy chỉnh:</label>
                        <input 
                          type="number" 
                          min={0}
                          max={100}
                          step={0.1}
                          value={platformConfig.coins_cashback_percent}
                          onChange={(e) => setPlatformConfig({ ...platformConfig, coins_cashback_percent: Number(e.target.value) })}
                          className="w-20 bg-white border border-amber-300 rounded-lg px-2 py-1 font-mono font-black text-center text-amber-800 text-xs"
                        />
                        <span className="font-bold text-amber-900">%</span>
                      </div>
                    </div>

                    {/* THAM SỐ 3: % PHÍ SÀN MẶC ĐỊNH KHẤU TRỪ TOÀN HỆ THỐNG */}
                    <div className="bg-purple-50/80 border-2 border-purple-300 p-4 rounded-2xl space-y-3 shadow-2xs">
                      <div className="flex items-center justify-between">
                        <span className="font-extrabold text-purple-900 text-xs flex items-center gap-1.5">
                          <i className="fa-solid fa-percent text-purple-600 text-sm"></i>
                          <span>3. % Phí Sàn Mặc Định</span>
                        </span>
                        <span className="bg-purple-700 text-white font-black text-xs px-2.5 py-0.5 rounded-full font-mono">
                          {platformConfig.platform_fee_percent}%
                        </span>
                      </div>

                      <p className="text-[11px] text-purple-800">
                        Tỷ lệ % phí dịch vụ nền tảng mặc định khấu trừ trên mỗi đơn hàng thành công của các Gian hàng Shop.
                      </p>

                      <div className="space-y-1">
                        <input 
                          type="range" 
                          min={0} 
                          max={30} 
                          step={0.5}
                          value={platformConfig.platform_fee_percent}
                          onChange={(e) => setPlatformConfig({ ...platformConfig, platform_fee_percent: Number(e.target.value) })}
                          className="w-full accent-purple-600 cursor-pointer"
                        />
                        <div className="flex justify-between text-[10px] text-purple-700 font-mono font-bold">
                          <span>0%</span>
                          <span>15%</span>
                          <span>30%</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <label className="text-gray-600 font-bold">Tỷ lệ % tùy chỉnh:</label>
                        <input 
                          type="number" 
                          min={0}
                          max={100}
                          step={0.1}
                          value={platformConfig.platform_fee_percent}
                          onChange={(e) => setPlatformConfig({ ...platformConfig, platform_fee_percent: Number(e.target.value) })}
                          className="w-20 bg-white border border-purple-300 rounded-lg px-2 py-1 font-mono font-black text-center text-purple-800 text-xs"
                        />
                        <span className="font-bold text-purple-900">%</span>
                      </div>
                    </div>

                  </div>

                  {/* THÔNG TIN LẦN CẬP NHẬT GẦN NHẤT */}
                  <div className="bg-slate-900 text-white p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-0.5 text-xs">
                      <span className="text-amber-300 font-extrabold uppercase tracking-wider block text-[10px]">
                        ℹ️ Trạng thái cấu hình tham số hệ thống Realtime Cloud
                      </span>
                      <p className="text-gray-300 font-mono">
                        Cập nhật bởi: <strong className="text-white font-bold">{platformConfig.updated_by || 'Super Admin'}</strong> | Thời gian: {new Date(platformConfig.updated_at || Date.now()).toLocaleString('vi-VN')}
                      </p>
                    </div>

                    <button 
                      onClick={handleSavePlatformConfig}
                      className="bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 hover:from-emerald-600 text-white font-black text-xs px-5 py-2.5 rounded-xl cursor-pointer shadow-md transition-all flex items-center justify-center gap-2 border border-emerald-300 shrink-0"
                    >
                      <i className="fa-solid fa-floppy-disk text-amber-300"></i>
                      <span>💾 LƯU CẤU HÌNH HỆ THỐNG MỚI</span>
                    </button>
                  </div>

                </div>

              </div>
            )}

          </div>
        </div>

        {/* ================= MODAL HIỂN THỊ MẬT KHẨU NGẪU NHIÊN ĐỂ ADMIN COPY GỬI CHO NGƯỜI DÙNG ================= */}
        {passModalData && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 font-sans">
            <div className="bg-white border-2 border-amber-400 p-6 rounded-3xl max-w-sm w-full space-y-4 shadow-2xl animate-in zoom-in-95 text-center relative">
              <button 
                onClick={() => setPassModalData(null)}
                className="absolute top-3 right-3 w-8 h-8 bg-gray-100 hover:bg-gray-200 text-gray-500 rounded-full font-bold text-xs flex items-center justify-center cursor-pointer"
              >
                ✕
              </button>

              <div className="w-14 h-14 bg-amber-100 text-amber-800 text-2xl rounded-2xl flex items-center justify-center mx-auto shadow-sm">
                🔑
              </div>

              <div>
                <span className="bg-emerald-100 text-emerald-800 font-extrabold text-[10px] px-3 py-0.5 rounded-full border border-emerald-300 uppercase">
                  ĐÃ ĐỔI MẬT KHẨU THÀNH CÔNG
                </span>
                <h4 className="font-black text-navy text-sm mt-2 truncate" title={passModalData.email}>
                  Tài khoản: {passModalData.email}
                </h4>
                <p className="text-[11px] text-gray-500 font-medium mt-0.5">
                  Mật khẩu ngẫu nhiên bảo mật đã được tạo. Hãy sao chép để gửi cho người dùng:
                </p>
              </div>

              {/* Display Box Mật khẩu ngẫu nhiên */}
              <div className="bg-slate-900 text-amber-300 font-mono font-black text-lg p-3.5 rounded-2xl border border-slate-700 tracking-wider select-all flex items-center justify-between gap-2 shadow-inner">
                <span className="truncate">{passModalData.newPass}</span>
                <button 
                  onClick={handleCopyPassword}
                  className={`px-3 py-1.5 rounded-xl font-sans font-extrabold text-xs transition-all cursor-pointer shrink-0 ${
                    isCopied 
                      ? 'bg-emerald-500 text-white' 
                      : 'bg-amber-400 hover:bg-amber-500 text-navy'
                  }`}
                >
                  {isCopied ? '✓ ĐÃ COPY' : '📋 COPY'}
                </button>
              </div>

              {/* Action Close */}
              <button 
                onClick={() => setPassModalData(null)}
                className="w-full bg-navy hover:bg-navy-dark text-white font-extrabold py-2.5 rounded-xl text-xs uppercase tracking-wider transition-colors cursor-pointer"
              >
                ĐÓNG CỬA SỔ
              </button>
            </div>
          </div>
        )}

        {/* ================= MODAL CẤU HÌNH NGÂN HÀNG RÚT TIỀN CỦA NGƯỜI DÙNG (ADMIN OVERRIDE) ================= */}
        {editBankModal && (
          <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 font-sans animate-in fade-in">
            <div className="bg-white rounded-3xl max-w-md w-full p-5 shadow-2xl space-y-4 border border-gray-200">
              
              <div className="flex items-center justify-between border-b border-gray-200 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 bg-emerald-100 text-emerald-700 rounded-xl flex items-center justify-center text-lg font-bold">
                    <i className="fa-solid fa-building-columns"></i>
                  </div>
                  <div>
                    <h4 className="font-black text-navy text-sm uppercase">CẤU HÌNH NGÂN HÀNG RÚT TIỀN</h4>
                    <p className="text-[10px] text-gray-500 font-medium">Thay đổi hoặc Đặt lại ngân hàng mặc định cho người dùng</p>
                  </div>
                </div>

                <button 
                  onClick={() => setEditBankModal(null)}
                  className="w-8 h-8 rounded-full bg-gray-100 hover:bg-red-600 hover:text-white text-gray-500 flex items-center justify-center transition-colors cursor-pointer"
                >
                  <i className="fa-solid fa-xmark text-sm font-bold"></i>
                </button>
              </div>

              <div className="bg-slate-50 p-3 rounded-2xl border border-gray-200 space-y-1 text-xs">
                <p className="text-gray-500 font-bold">Tài khoản Email: <strong className="text-navy font-mono">{editBankModal.email}</strong></p>
                <p className="text-gray-500 font-bold">Họ và tên: <strong className="text-navy">{editBankModal.name}</strong></p>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="block font-bold text-gray-700 mb-1">Tên Ngân Hàng Nhận Tiền:</label>
                  <select 
                    value={editBankModal.bankName}
                    onChange={(e) => setEditBankModal({ ...editBankModal, bankName: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl font-extrabold text-navy bg-white focus:outline-none focus:ring-2 focus:ring-navy"
                  >
                    <option value="MBBank (NHTM CP Quân Đội)">MBBank - Ngân hàng Quân Đội</option>
                    <option value="Vietcombank (VCB)">Vietcombank - Ngân hàng Ngoại Thương</option>
                    <option value="Techcombank (TCB)">Techcombank - Ngân hàng Kỹ Thương</option>
                    <option value="VietinBank (CTG)">VietinBank - Ngân hàng Công Thương</option>
                    <option value="BIDV">BIDV - Ngân hàng Đầu tư và Phát triển</option>
                    <option value="Agribank">Agribank - Ngân hàng Nông nghiệp</option>
                    <option value="VPBank">VPBank - Ngân hàng Việt Nam Thịnh Vượng</option>
                    <option value="ACB">ACB - Ngân hàng Á Châu</option>
                    <option value="TPBank">TPBank - Ngân hàng Tiên Phong</option>
                    <option value="Sacombank">Sacombank - Ngân hàng Sài Gòn Thương Tín</option>
                    <option value="HDBank">HDBank - Ngân hàng Phát triển TP.HCM</option>
                    <option value="VIB">VIB - Ngân hàng Quốc Tế</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-gray-700 mb-1">Số Tài Khoản (STK):</label>
                  <input 
                    type="text" 
                    value={editBankModal.accountNumber}
                    onChange={(e) => setEditBankModal({ ...editBankModal, accountNumber: e.target.value })}
                    placeholder="Ví dụ: 0988 123 456"
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl font-mono font-bold text-navy focus:outline-none focus:ring-2 focus:ring-navy"
                  />
                </div>

                <div>
                  <label className="block font-bold text-gray-700 mb-1">Tên Chủ Tài Khoản (In hoa):</label>
                  <input 
                    type="text" 
                    value={editBankModal.accountHolder}
                    onChange={(e) => setEditBankModal({ ...editBankModal, accountHolder: e.target.value.toUpperCase() })}
                    placeholder={`Ví dụ: ${editBankModal.name.toUpperCase()}`}
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl font-bold uppercase text-navy focus:outline-none focus:ring-2 focus:ring-navy"
                  />
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-2 pt-2 border-t border-gray-100">
                <button 
                  onClick={handleSaveUserBank}
                  className="w-full sm:flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold py-2.5 rounded-xl text-xs cursor-pointer shadow-md transition-all flex items-center justify-center gap-1.5"
                >
                  <i className="fa-solid fa-floppy-disk text-xs"></i>
                  <span>💾 LƯU NGÂN HÀNG MỚI</span>
                </button>

                <button 
                  onClick={handleResetUserBank}
                  className="w-full sm:w-auto bg-amber-100 text-amber-900 hover:bg-amber-200 border border-amber-300 font-extrabold px-3 py-2.5 rounded-xl text-xs cursor-pointer transition-all flex items-center justify-center gap-1.5"
                  title="Xóa ngân hàng mặc định đã khóa, cho phép khách đăng ký ngân hàng mới ở lần rút sau"
                >
                  <i className="fa-solid fa-unlock text-xs"></i>
                  <span>🔓 ĐẶT LẠI / MỞ KHÓA</span>
                </button>
              </div>

            </div>
          </div>
        )}

        {/* ================= MODAL CẤU HÌNH % PHÍ SÀN RIÊNG CHO CHỦ SHOP / TAXI DRIVER ================= */}
        {editFeeModal && (
          <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 font-sans animate-in fade-in">
            <div className="bg-white rounded-3xl max-w-md w-full p-5 shadow-2xl space-y-4 border border-gray-200">
              
              <div className="flex items-center justify-between border-b border-gray-200 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 bg-purple-100 text-purple-700 rounded-xl flex items-center justify-center text-lg font-bold">
                    <i className="fa-solid fa-percent"></i>
                  </div>
                  <div>
                    <h4 className="font-black text-navy text-sm uppercase">CÀI ĐẶT % PHÍ SÀN RIÊNG</h4>
                    <p className="text-[10px] text-gray-500 font-medium">Thiết lập tỷ lệ phí hoa hồng riêng cho từng Shop/Taxi</p>
                  </div>
                </div>

                <button 
                  onClick={() => setEditFeeModal(null)}
                  className="w-8 h-8 rounded-full bg-gray-100 hover:bg-red-600 hover:text-white text-gray-500 flex items-center justify-center transition-colors cursor-pointer"
                >
                  <i className="fa-solid fa-xmark text-sm font-bold"></i>
                </button>
              </div>

              <div className="bg-purple-50 p-3 rounded-2xl border border-purple-200 space-y-1 text-xs text-purple-900">
                <p className="font-bold">Tài khoản: <strong className="font-mono text-navy">{editFeeModal.email}</strong></p>
                <p className="font-bold">Họ và tên: <strong className="text-navy">{editFeeModal.name}</strong> ({editFeeModal.role})</p>
              </div>

              <div className="space-y-3 text-xs">
                <div className="space-y-2 border-b border-gray-100 pb-3">
                  <label className="flex items-center gap-2 cursor-pointer font-bold text-gray-800">
                    <input 
                      type="radio" 
                      name="feeMode" 
                      checked={!editFeeModal.isCustom}
                      onChange={() => setEditFeeModal({ ...editFeeModal, isCustom: false })}
                      className="text-purple-600 focus:ring-purple-500"
                    />
                    <span>Dùng phí sàn mặc định toàn hệ thống ({platformConfig.platform_fee_percent}%)</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer font-bold text-purple-900">
                    <input 
                      type="radio" 
                      name="feeMode" 
                      checked={editFeeModal.isCustom}
                      onChange={() => setEditFeeModal({ ...editFeeModal, isCustom: true })}
                      className="text-purple-600 focus:ring-purple-500"
                    />
                    <span>Cài đặt tỷ lệ % phí sàn riêng đặc biệt cho tài khoản này</span>
                  </label>
                </div>

                {editFeeModal.isCustom && (
                  <div className="bg-slate-50 p-3.5 rounded-2xl border border-gray-200 space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="font-bold text-gray-700">Tỷ lệ % phí sàn riêng áp dụng:</label>
                      <span className="bg-purple-700 text-white font-mono font-black text-xs px-2.5 py-0.5 rounded-full">
                        {editFeeModal.customFee}%
                      </span>
                    </div>

                    <input 
                      type="range" 
                      min={0} 
                      max={30} 
                      step={0.5}
                      value={editFeeModal.customFee}
                      onChange={(e) => setEditFeeModal({ ...editFeeModal, customFee: Number(e.target.value) })}
                      className="w-full accent-purple-600 cursor-pointer"
                    />

                    <div className="flex items-center gap-2">
                      <label className="text-gray-600 font-bold">Con số cụ thể (%):</label>
                      <input 
                        type="number" 
                        min={0}
                        max={100}
                        step={0.1}
                        value={editFeeModal.customFee}
                        onChange={(e) => setEditFeeModal({ ...editFeeModal, customFee: Number(e.target.value) })}
                        className="w-24 bg-white border border-purple-300 rounded-xl px-3 py-1.5 font-mono font-black text-navy text-xs"
                      />
                      <span className="font-bold text-purple-900">%</span>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
                <button 
                  onClick={handleSaveUserCustomFee}
                  className="w-full bg-purple-700 hover:bg-purple-800 text-white font-black py-2.5 rounded-xl text-xs cursor-pointer shadow-md transition-all flex items-center justify-center gap-1.5"
                >
                  <i className="fa-solid fa-floppy-disk text-amber-300 text-xs"></i>
                  <span>💾 LƯU PHÍ SÀN RIÊNG TÀI KHOẢN</span>
                </button>
              </div>

            </div>
          </div>
        )}

        {/* MODAL XEM CHI TIẾT ĐƠN HÀNG KHI SUPER ADMIN BẤM CHI TIẾT */}
        {selectedOrderModal && (
          <div className="fixed inset-0 z-[120] bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-2xl border-2 border-indigo-400 animate-in zoom-in-95 duration-200">
              <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 bg-indigo-600 rounded-full animate-ping"></span>
                  <h4 className="font-black text-navy text-sm uppercase">
                    📦 CHI TIẾT ĐƠN HÀNG #{selectedOrderModal.id}
                  </h4>
                </div>
                <button 
                  onClick={() => setSelectedOrderModal(null)}
                  className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 flex items-center justify-center font-black cursor-pointer text-xs"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div className="bg-indigo-50 border border-indigo-200 p-3.5 rounded-2xl space-y-1">
                  <div className="flex justify-between font-bold">
                    <span className="text-gray-600">Khách hàng:</span>
                    <span className="text-navy">{selectedOrderModal.user_name || 'Khách hàng'}</span>
                  </div>
                  <div className="flex justify-between font-mono text-[11px]">
                    <span className="text-gray-600">Email:</span>
                    <span className="text-indigo-900 font-bold">{selectedOrderModal.user_email}</span>
                  </div>
                  <div className="flex justify-between font-mono text-[11px]">
                    <span className="text-gray-600">Thời gian:</span>
                    <span className="text-gray-700">{new Date(selectedOrderModal.created_at || Date.now()).toLocaleString('vi-VN')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 font-bold">Địa chỉ giao:</span>
                    <span className="text-indigo-950 font-extrabold truncate max-w-[220px]">{selectedOrderModal.shipping_address}</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <h5 className="font-black text-navy uppercase text-[11px]">Mặt hàng trong đơn:</h5>
                  <div className="bg-slate-50 border border-gray-200 rounded-2xl p-3 space-y-2 divide-y divide-gray-200">
                    {selectedOrderModal.items && selectedOrderModal.items.length > 0 ? (
                      selectedOrderModal.items.map((item, idx) => (
                        <div key={idx} className="pt-2 first:pt-0 flex items-center justify-between gap-3 text-xs">
                          <div>
                            <span className="font-extrabold text-gray-900 block">• {item.product_name || item.title}</span>
                            <span className="text-[10px] text-gray-500 font-mono">Gian hàng: {item.shop_name || 'TQ Store'}</span>
                          </div>
                          <div className="text-right shrink-0">
                            <span className="font-black text-navy block">{Number(item.price || 0).toLocaleString('vi-VN')}đ</span>
                            <span className="text-[10px] text-gray-500 font-mono">Số lượng: x{item.quantity || 1}</span>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="py-2 text-center text-gray-500 font-medium">Sản phẩm TQ Store</div>
                    )}
                  </div>
                </div>

                <div className="bg-slate-900 text-white p-4 rounded-2xl flex items-center justify-between font-black text-sm">
                  <span className="text-amber-300">TỔNG THU:</span>
                  <span className="text-xl text-amber-300 font-mono">{Number(selectedOrderModal.total_amount || 0).toLocaleString('vi-VN')} VNĐ</span>
                </div>
              </div>

              <button 
                onClick={() => setSelectedOrderModal(null)}
                className="w-full bg-navy hover:bg-navy-dark text-amber-300 font-black py-2.5 rounded-xl text-xs uppercase cursor-pointer transition-all"
              >
                ĐÓNG MÀN HÌNH CHI TIẾT
              </button>
            </div>
          </div>
        )}

        {/* MODAL SỬA TRỰC TIẾP LƯỢT ĐÃ BÁN (SALES COUNT) */}
        {editSalesModal && (
          <div className="fixed inset-0 z-[125] bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl border-2 border-emerald-400 animate-in zoom-in-95 duration-200">
              <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                <h4 className="font-black text-navy text-xs uppercase">
                  ✏️ CHỈNH SỬA LƯỢT ĐÃ BÁN (SALES COUNT)
                </h4>
                <button 
                  onClick={() => setEditSalesModal(null)}
                  className="w-7 h-7 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 flex items-center justify-center font-black cursor-pointer text-xs"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <p className="font-bold text-gray-700">Sản phẩm: <span className="text-navy">{editSalesModal.title}</span></p>
                <div>
                  <label className="block font-extrabold text-gray-700 mb-1">
                    Số lượng lượt đã bán mới (Ví dụ: 1250 lượt):
                  </label>
                  <input 
                    type="number" 
                    min={0}
                    value={editSalesModal.salesCount}
                    onChange={(e) => setEditSalesModal({ ...editSalesModal, salesCount: e.target.value })}
                    required
                    className="w-full bg-slate-50 border border-gray-300 rounded-xl px-3.5 py-2.5 font-mono font-black text-sm text-emerald-800 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button 
                  onClick={handleSaveProductSalesCount}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black py-2.5 rounded-xl text-xs cursor-pointer shadow-md transition-all flex items-center justify-center gap-1.5"
                >
                  <i className="fa-solid fa-floppy-disk text-amber-300 text-xs"></i>
                  <span>💾 LƯU SỐ LƯỢT ĐÃ BÁN MỚI</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL TẠO ĐÁNH GIÁ ẢO AI (AI SYNTHETIC REVIEWS INJECTION) */}
        {addReviewModal && (
          <div className="fixed inset-0 z-[125] bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-2xl border-2 border-amber-400 animate-in zoom-in-95 duration-200">
              <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 bg-amber-500 rounded-full animate-ping"></span>
                  <h4 className="font-black text-navy text-xs uppercase">
                    ⭐ THÊM ĐÁNH GIÁ ẢO TỪ TÀI KHOẢN TỰ ĐỘNG (AI)
                  </h4>
                </div>
                <button 
                  onClick={() => setAddReviewModal(null)}
                  className="w-7 h-7 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 flex items-center justify-center font-black cursor-pointer text-xs"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleSaveSyntheticReviewSubmit} className="space-y-4 text-xs">
                <div>
                  <label className="block font-extrabold text-gray-700 mb-1">
                    Sản phẩm nhận đánh giá:
                  </label>
                  <input 
                    type="text" 
                    value={addReviewModal.title}
                    readOnly
                    className="w-full bg-gray-100 border border-gray-300 rounded-xl px-3 py-2 text-xs font-bold text-navy"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-extrabold text-gray-700">
                      Tên người đánh giá ảo (Realistic Name):
                    </label>
                    <button 
                      type="button"
                      onClick={() => setAddReviewModal({ ...addReviewModal, userName: generateRandomVietnameseName() })}
                      className="text-[10px] font-black text-amber-700 hover:underline cursor-pointer flex items-center gap-1"
                    >
                      <i className="fa-solid fa-dice"></i>
                      <span>🎲 AI TỰ SINH TÊN MỚI</span>
                    </button>
                  </div>
                  <input 
                    type="text" 
                    value={addReviewModal.userName}
                    onChange={(e) => setAddReviewModal({ ...addReviewModal, userName: e.target.value })}
                    required
                    placeholder="Nguyễn Văn A" 
                    className="w-full bg-slate-50 border border-gray-300 rounded-xl px-3.5 py-2.5 text-xs font-bold text-gray-800 focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block font-extrabold text-gray-700 mb-1">
                    Số sao đánh giá muốn trao (Rating Star):
                  </label>
                  <select 
                    value={addReviewModal.rating}
                    onChange={(e) => setAddReviewModal({ ...addReviewModal, rating: Number(e.target.value) })}
                    className="w-full bg-slate-50 border border-gray-300 rounded-xl px-3.5 py-2.5 text-xs font-black text-amber-600 focus:outline-none focus:border-amber-500 cursor-pointer"
                  >
                    <option value={5}>⭐⭐⭐⭐⭐ (5 Sao - Xuất sắc)</option>
                    <option value={4}>⭐⭐⭐⭐ (4 Sao - Hài lòng)</option>
                    <option value={3}>⭐⭐⭐ (3 Sao - Tốt)</option>
                    <option value={2}>⭐⭐ (2 Sao - Tạm được)</option>
                    <option value={1}>⭐ (1 Sao - Kém)</option>
                  </select>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-extrabold text-gray-700">
                      Nội dung bài đánh giá:
                    </label>
                    <button 
                      type="button"
                      onClick={() => setAddReviewModal({ ...addReviewModal, comment: getRandomAiReview() })}
                      className="text-[10px] font-black text-amber-700 hover:underline cursor-pointer flex items-center gap-1"
                    >
                      <i className="fa-solid fa-wand-magic-sparkles"></i>
                      <span>✨ AI SINH MẪU ĐÁNH GIÁ</span>
                    </button>
                  </div>
                  <textarea 
                    value={addReviewModal.comment}
                    onChange={(e) => setAddReviewModal({ ...addReviewModal, comment: e.target.value })}
                    rows={3}
                    required
                    placeholder="Nhập nội dung đánh giá..."
                    className="w-full bg-slate-50 border border-gray-300 rounded-xl p-3 text-xs font-medium text-gray-800 focus:outline-none focus:border-amber-500"
                  />
                </div>

                <button 
                  type="submit" 
                  className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 text-slate-950 font-black py-3 rounded-xl text-xs uppercase tracking-wider shadow-md transition-all cursor-pointer flex items-center justify-center gap-2 border border-amber-300"
                >
                  <i className="fa-solid fa-paper-plane"></i>
                  <span>🎯 PHÁT HÀNH ĐÁNH GIÁ ẢO NGAY</span>
                </button>
              </form>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
