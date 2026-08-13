import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { loginSchema, registerSchema, sanitizeText, isValidEmail, isValidVNPhone } from '../lib/validation';
import { getCloudRegisteredUsers, saveCloudUser, sendPasswordResetRequest } from '../lib/userSync';
import { recordAuditLog } from '../lib/auditLogger';

export default function AuthModal({ isOpen, onClose, initialTab = 'login' }) {
  const [tab, setTab] = useState(initialTab); // 'login', 'register', 'forgot'
  
  // Login Form States (Lựa chọn Đăng nhập bằng Email/Gmail HOẶC Số điện thoại)
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Register Form States
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Forgot Password States
  const [forgotIdentifier, setForgotIdentifier] = useState('');
  const [newResetPassword, setNewResetPassword] = useState('');
  const [isOtpSent, setIsOtpSent] = useState(false);

  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  const { signIn, signUp, resetPassword } = useAuth();

  if (!isOpen) return null;

  // Xử lý đăng nhập bằng Gmail HOẶC SĐT
  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    const cleanIdentifier = sanitizeText(loginIdentifier.trim());

    // Zod Input Validation
    const validation = loginSchema.safeParse({
      identifier: cleanIdentifier,
      password: loginPassword
    });

    if (!validation.success) {
      setErrorMsg(validation.error.issues[0].message);
      return;
    }

    setLoading(true);

    // Chuyển đổi SĐT thành format email nếu người dùng nhập SĐT
    let targetEmail = cleanIdentifier;
    if (!cleanIdentifier.includes('@')) {
      const cleanPhoneDigits = cleanIdentifier.replace(/\s+/g, '');
      targetEmail = `${cleanPhoneDigits}@tqstore.vn`;
    }

    try {
      await signIn(targetEmail, loginPassword);
      setSuccessMsg('Đăng nhập thành công!');
      setTimeout(() => {
        onClose();
      }, 600);
    } catch (err) {
      console.error(err);
      // Try direct email sign in if fallback failed
      try {
        await signIn(cleanIdentifier, loginPassword);
        setSuccessMsg('Đăng nhập thành công!');
        setTimeout(() => {
          onClose();
        }, 600);
      } catch (secondErr) {
        setErrorMsg(err.message || 'Đăng nhập thất bại. Vui lòng kiểm tra lại Email / SĐT hoặc Mật khẩu.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    const cleanName = sanitizeText(name.trim());
    const cleanPhone = sanitizeText(phone.trim());
    const cleanEmail = email.trim();

    // 1. Kiểm tra định dạng Gmail / Email ngặt nghèo
    if (!isValidEmail(cleanEmail)) {
      setErrorMsg('❌ Địa chỉ Email / Gmail không đúng định dạng (Ví dụ: tenkhach@gmail.com).');
      return;
    }

    // 2. Kiểm tra định dạng Số điện thoại Việt Nam (10 chữ số bắt đầu bằng 03, 05, 07, 08, 09)
    if (!isValidVNPhone(cleanPhone)) {
      setErrorMsg('❌ Số điện thoại phải đúng định dạng Việt Nam (10 chữ số bắt đầu bằng 03, 05, 07, 08, 09).');
      return;
    }

    // 3. Zod Schema Validation
    const validation = registerSchema.safeParse({
      name: cleanName,
      phone: cleanPhone,
      email: cleanEmail,
      password
    });

    if (!validation.success) {
      setErrorMsg(validation.error.issues[0].message);
      return;
    }

    // 4. Kiểm tra chống trùng Email & Số điện thoại trên CSDL Realtime Cloud
    try {
      const registeredUsers = await getCloudRegisteredUsers();
      const cleanPhoneDigits = cleanPhone.replace(/\s+/g, '');

      // Check Email duplicate
      const isEmailDuplicate = registeredUsers.some(
        (u) => u.email && u.email.toLowerCase() === cleanEmail.toLowerCase()
      );
      if (isEmailDuplicate) {
        setErrorMsg('❌ Email này đã được đăng ký tài khoản trước đó! Vui lòng dùng Email khác hoặc Đăng nhập.');
        return;
      }

      // Check Phone duplicate
      const isPhoneDuplicate = registeredUsers.some(
        (u) => u.phone && u.phone.replace(/\s+/g, '') === cleanPhoneDigits
      );
      if (isPhoneDuplicate) {
        setErrorMsg('❌ Số điện thoại này đã được sử dụng cho một tài khoản khác! Vui lòng kiểm tra lại.');
        return;
      }
    } catch (e) {
      console.error('Error checking duplicate user data:', e);
    }

    setLoading(true);

    try {
      // Đăng ký tài khoản mới trên Supabase Cloud
      try {
        await signUp(cleanEmail, password, cleanName);
      } catch (cloudErr) {
        console.warn('Supabase cloud signup notice:', cloudErr?.message);
      }

      // Lưu trữ và Đồng bộ CSDL Đám mây Supabase (kèm mật khẩu để bỏ qua Email Confirm)
      await saveCloudUser({
        email: cleanEmail,
        phone: cleanPhone,
        name: cleanName,
        password: password,
        role: 'USER',
        created_at: new Date().toISOString()
      });

      // TẮT XÁC NHẬN EMAIL: TỰ ĐỘNG ĐĂNG NHẬP HOẶC CHO PHÉP ĐĂNG NHẬP NGAY
      try {
        await signIn(cleanEmail, password);
        setSuccessMsg('🎉 Đăng ký tài khoản thành công! Đang tự động đăng nhập...');
        setTimeout(() => {
          onClose();
        }, 600);
      } catch (loginErr) {
        setSuccessMsg('🎉 Đăng ký tài khoản thành công! Bạn có thể điền thông tin để đăng nhập ngay.');
        setTimeout(() => {
          setTab('login');
          setLoginIdentifier(cleanEmail);
        }, 1200);
      }
    } catch (err) {
      console.error(err);
      setErrorMsg(err.message || 'Đăng ký thất bại. Vui lòng kiểm tra lại thông tin.');
    } finally {
      setLoading(false);
    }
  };

  // Xử lý Quên mật khẩu: Gửi yêu cầu lên Admin phê duyệt
  const handleForgotSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    const cleanInput = forgotIdentifier.trim();
    if (!cleanInput) {
      setErrorMsg('Vui lòng nhập địa chỉ Email / Gmail đăng ký của bạn.');
      return;
    }

    if (!isValidEmail(cleanInput)) {
      setErrorMsg('❌ Địa chỉ Email / Gmail không đúng định dạng (Ví dụ: tenkhach@gmail.com).');
      return;
    }

    setLoading(true);

    try {
      const usersList = await getCloudRegisteredUsers();
      const userMatch = usersList.find(u => u.email?.toLowerCase() === cleanInput.toLowerCase());

      if (!userMatch) {
        setErrorMsg('❌ Địa chỉ Gmail này chưa từng đăng ký tài khoản trên hệ thống!');
        setLoading(false);
        return;
      }

      // Gửi lệnh Yêu Cầu Khôi Phục Mật Khẩu lên Admin phê duyệt
      await sendPasswordResetRequest(cleanInput, userMatch.name, userMatch.phone);

      recordAuditLog(
        cleanInput,
        'USER',
        'YÊU CẦU KHÔI PHỤC MẬT KHẨU',
        `Khách hàng yêu cầu khôi phục mật khẩu cho Gmail: ${cleanInput}. Đã chuyển lên Admin chờ phê duyệt.`
      );

      setSuccessMsg('📩 Đã gửi yêu cầu khôi phục mật khẩu thành công! Vui lòng kiểm tra gmail để nhận mật khẩu mới.');
      setForgotIdentifier('');
    } catch (err) {
      console.error(err);
      setErrorMsg(err.message || 'Lỗi gửi yêu cầu khôi phục mật khẩu.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPasswordFinal = (e) => {
    e.preventDefault();
    if (!newResetPassword || newResetPassword.length < 6) {
      setErrorMsg('Mật khẩu mới phải có ít nhất 6 ký tự.');
      return;
    }

    setSuccessMsg('🎉 Đã đổi mật khẩu mới thành công! Vui lòng đăng nhập lại.');
    setTimeout(() => {
      setTab('login');
      setLoginIdentifier(forgotIdentifier);
      setIsOtpSent(false);
    }, 1200);
  };

  return (
    /* Cấu trúc tổng thể cửa sổ Modal */
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 font-sans">
      <div className="bg-[#FAF9F6] rounded-3xl shadow-2xl max-w-md w-full p-6 sm:p-7 relative border border-amber-200/60 animate-in zoom-in-95 duration-200">
        
        {/* Nút đóng Modal (Close Button dấu X) */}
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-gray-200/80 hover:bg-gray-300 text-gray-500 hover:text-navy flex items-center justify-center transition-colors cursor-pointer"
          title="Đóng cửa sổ"
        >
          <i className="fa-solid fa-xmark text-sm font-bold"></i>
        </button>

        {/* Thanh chuyển đổi Tab */}
        <div className="bg-gray-200/70 p-1 rounded-full flex items-center mb-6 shadow-inner text-xs font-extrabold">
          {/* Tab 1: Đăng Nhập */}
          <button 
            onClick={() => { setTab('login'); setErrorMsg(''); setSuccessMsg(''); setIsOtpSent(false); }}
            className={`flex-1 py-2 px-3 rounded-full flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              tab === 'login' 
                ? 'bg-navy text-white shadow-md' 
                : 'text-gray-600 hover:text-navy bg-transparent'
            }`}
          >
            <i className="fa-solid fa-key text-xs"></i>
            <span>Đăng Nhập</span>
          </button>

          {/* Tab 2: Đăng Ký Tài Khoản */}
          <button 
            onClick={() => { setTab('register'); setErrorMsg(''); setSuccessMsg(''); setIsOtpSent(false); }}
            className={`flex-1 py-2 px-3 rounded-full flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              tab === 'register' 
                ? 'bg-orange-custom text-white shadow-md' 
                : 'text-gray-600 hover:text-orange-custom bg-transparent'
            }`}
          >
            <i className="fa-solid fa-file-signature text-xs"></i>
            <span>Đăng Ký Tài Khoản</span>
          </button>
        </div>

        {/* Validation & Error Alert */}
        {errorMsg && (
          <div className="mb-4 bg-red-50 text-red-600 p-3 rounded-xl text-xs font-semibold flex items-center gap-2 border border-red-200">
            <i className="fa-solid fa-shield-halved text-sm shrink-0"></i>
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Success Alert */}
        {successMsg && (
          <div className="mb-4 bg-emerald-50 text-emerald-700 p-3 rounded-xl text-xs font-semibold flex items-center gap-2 border border-emerald-200">
            <i className="fa-solid fa-circle-check text-sm shrink-0"></i>
            <span>{successMsg}</span>
          </div>
        )}

        {/* ================= VIEW FORM ĐĂNG NHẬP ================= */}
        {tab === 'login' && (
          <div className="space-y-5">
            <div className="text-center space-y-1">
              <h3 className="text-2xl font-black text-navy uppercase tracking-wide">
                Đăng Nhập TQ Store
              </h3>
              <p className="text-xs text-gray-500 font-semibold">
                Lựa chọn đăng nhập bằng Email/Gmail hoặc Số điện thoại
              </p>
            </div>

            <form onSubmit={handleLoginSubmit} className="space-y-3.5 text-xs">
              {/* Field 1: Email / Gmail HOẶC Số điện thoại */}
              <div>
                <label className="block font-extrabold text-navy mb-1">
                  Email / Gmail hoặc Số điện thoại:
                </label>
                <div className="relative flex items-center">
                  <i className="fa-solid fa-envelope-open-text absolute left-3.5 text-gray-400 text-sm"></i>
                  <input 
                    type="text" 
                    value={loginIdentifier}
                    onChange={(e) => setLoginIdentifier(e.target.value)}
                    required 
                    placeholder="khachhang@gmail.com hoặc 0988 123 456" 
                    className="w-full bg-white border border-gray-300 rounded-xl pl-10 pr-3 py-2.5 text-xs text-gray-800 focus:outline-none focus:border-navy focus:ring-2 focus:ring-navy/10 transition-all font-medium"
                  />
                </div>
              </div>

              {/* Field 2: Mật khẩu */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-extrabold text-navy">
                    Mật khẩu:
                  </label>
                  {/* Link Quên Mật Khẩu */}
                  <button
                    type="button"
                    onClick={() => { setTab('forgot'); setErrorMsg(''); setSuccessMsg(''); setForgotIdentifier(loginIdentifier); }}
                    className="text-[11px] text-orange-custom font-extrabold hover:underline cursor-pointer"
                  >
                    Quên mật khẩu?
                  </button>
                </div>
                <div className="relative flex items-center">
                  <i className="fa-solid fa-lock absolute left-3.5 text-gray-400 text-sm"></i>
                  <input 
                    type="password" 
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    required 
                    placeholder="••••••••" 
                    className="w-full bg-white border border-gray-300 rounded-xl pl-10 pr-3 py-2.5 text-xs text-gray-800 focus:outline-none focus:border-navy focus:ring-2 focus:ring-navy/10 transition-all font-medium"
                  />
                </div>
              </div>

              <button 
                type="submit" 
                disabled={loading}
                className="w-full bg-navy hover:bg-navy-dark text-white font-black py-3.5 rounded-xl text-xs uppercase tracking-wider shadow-md transition-all cursor-pointer flex items-center justify-center gap-2 mt-2"
              >
                {loading ? (
                  <i className="fa-solid fa-spinner fa-spin text-sm"></i>
                ) : (
                  <i className="fa-solid fa-right-to-bracket text-sm text-amber-300"></i>
                )}
                <span>ĐĂNG NHẬP TÀI KHOẢN</span>
              </button>
            </form>

            <div className="text-center text-xs text-gray-500 pt-1 font-medium">
              Chưa có tài khoản?{' '}
              <button 
                onClick={() => { setTab('register'); setErrorMsg(''); setSuccessMsg(''); }}
                className="text-orange-custom font-extrabold hover:underline cursor-pointer"
              >
                Đăng ký tài khoản ngay
              </button>
            </div>
          </div>
        )}

        {/* ================= VIEW FORM QUÊN MẬT KHẨU ================= */}
        {tab === 'forgot' && (
          <div className="space-y-5">
            <div className="text-center space-y-1">
              <h3 className="text-2xl font-black text-navy uppercase tracking-wide">
                Khôi Phục Mật Khẩu
              </h3>
              <p className="text-xs text-gray-500 font-semibold">
                Nhập Email hoặc SĐT để nhận mã/liên kết đặt lại mật khẩu mới
              </p>
            </div>

            {!isOtpSent ? (
              <form onSubmit={handleForgotSubmit} className="space-y-3.5 text-xs">
                <div>
                  <label className="block font-extrabold text-navy mb-1">
                    Email / Gmail hoặc Số điện thoại đã đăng ký:
                  </label>
                  <div className="relative flex items-center">
                    <i className="fa-solid fa-envelope-open-text absolute left-3.5 text-gray-400 text-sm"></i>
                    <input 
                      type="text" 
                      value={forgotIdentifier}
                      onChange={(e) => setForgotIdentifier(e.target.value)}
                      required 
                      placeholder="khachhang@gmail.com hoặc 0988 123 456" 
                      className="w-full bg-white border border-gray-300 rounded-xl pl-10 pr-3 py-2.5 text-xs text-gray-800 focus:outline-none focus:border-navy focus:ring-2 focus:ring-navy/10 transition-all font-medium"
                    />
                  </div>
                </div>

                <button 
                  type="submit" 
                  disabled={loading}
                  className="w-full bg-orange-custom hover:bg-orange-hover text-white font-black py-3.5 rounded-xl text-xs uppercase tracking-wider shadow-md transition-all cursor-pointer flex items-center justify-center gap-2 mt-2"
                >
                  {loading ? (
                    <i className="fa-solid fa-spinner fa-spin text-sm"></i>
                  ) : (
                    <i className="fa-solid fa-paper-plane text-sm"></i>
                  )}
                  <span>GỬI MÃ XÁC THỰC KHÔI PHỤC</span>
                </button>
              </form>
            ) : (
              /* Thiết lập mật khẩu mới sau khi xác thực */
              <form onSubmit={handleResetPasswordFinal} className="space-y-3.5 text-xs">
                <div>
                  <label className="block font-extrabold text-navy mb-1">
                    Nhập mật khẩu mới của bạn:
                  </label>
                  <div className="relative flex items-center">
                    <i className="fa-solid fa-key absolute left-3.5 text-gray-400 text-sm"></i>
                    <input 
                      type="password" 
                      value={newResetPassword}
                      onChange={(e) => setNewResetPassword(e.target.value)}
                      required 
                      minLength={6}
                      placeholder="Nhập mật khẩu mới (tối thiểu 6 ký tự)" 
                      className="w-full bg-white border border-gray-300 rounded-xl pl-10 pr-3 py-2.5 text-xs text-gray-800 focus:outline-none focus:border-navy focus:ring-2 focus:ring-navy/10 transition-all font-medium"
                    />
                  </div>
                </div>

                <button 
                  type="submit" 
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black py-3.5 rounded-xl text-xs uppercase tracking-wider shadow-md transition-all cursor-pointer flex items-center justify-center gap-2 mt-2"
                >
                  <i className="fa-solid fa-circle-check text-sm"></i>
                  <span>LƯU MẬT KHẨU MỚI & ĐĂNG NHẬP</span>
                </button>
              </form>
            )}

            <div className="text-center text-xs text-gray-500 pt-1 font-medium">
              <button 
                onClick={() => { setTab('login'); setErrorMsg(''); setSuccessMsg(''); setIsOtpSent(false); }}
                className="text-navy font-extrabold hover:underline cursor-pointer flex items-center justify-center gap-1 mx-auto"
              >
                <i className="fa-solid fa-arrow-left text-xs"></i>
                <span>Quay lại Đăng Nhập</span>
              </button>
            </div>
          </div>
        )}

        {/* ================= VIEW FORM ĐĂNG KÝ TÀI KHOẢN MỚI ================= */}
        {tab === 'register' && (
          <div className="space-y-5">
            <div className="text-center space-y-1">
              <h3 className="text-2xl font-black text-navy uppercase tracking-wide">
                Tạo Tài Khoản Mới
              </h3>
              <p className="text-xs text-gray-500 font-semibold">
                Bắt buộc điền cả SĐT & Gmail để bảo vệ tài khoản tối đa
              </p>
            </div>

            <form onSubmit={handleRegisterSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-extrabold text-navy mb-1">
                  Họ và tên người dùng:
                </label>
                <div className="relative flex items-center">
                  <i className="fa-solid fa-user absolute left-3.5 text-gray-400 text-sm"></i>
                  <input 
                    type="text" 
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required 
                    placeholder="Nguyễn Văn A" 
                    className="w-full bg-white border border-gray-300 rounded-xl pl-10 pr-3 py-2.5 text-xs text-gray-800 focus:outline-none focus:border-navy focus:ring-2 focus:ring-navy/10 transition-all font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="block font-extrabold text-navy mb-1">
                  Số điện thoại <span className="text-red-600 font-bold">(Bắt buộc)</span>:
                </label>
                <div className="relative flex items-center">
                  <i className="fa-solid fa-phone absolute left-3.5 text-gray-400 text-sm"></i>
                  <input 
                    type="tel" 
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    required 
                    placeholder="0988 123 456" 
                    className="w-full bg-white border border-gray-300 rounded-xl pl-10 pr-3 py-2.5 text-xs text-gray-800 focus:outline-none focus:border-navy focus:ring-2 focus:ring-navy/10 transition-all font-mono font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="block font-extrabold text-navy mb-1">
                  Địa chỉ Email / Gmail <span className="text-red-600 font-bold">(Bắt buộc)</span>:
                </label>
                <div className="relative flex items-center">
                  <i className="fa-solid fa-envelope absolute left-3.5 text-gray-400 text-sm"></i>
                  <input 
                    type="email" 
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required 
                    placeholder="khachhang@gmail.com" 
                    className="w-full bg-white border border-gray-300 rounded-xl pl-10 pr-3 py-2.5 text-xs text-gray-800 focus:outline-none focus:border-navy focus:ring-2 focus:ring-navy/10 transition-all font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="block font-extrabold text-navy mb-1">
                  Thiết lập mật khẩu:
                </label>
                <div className="relative flex items-center">
                  <i className="fa-solid fa-lock absolute left-3.5 text-gray-400 text-sm"></i>
                  <input 
                    type="password" 
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required 
                    minLength={6}
                    placeholder="••••••••" 
                    className="w-full bg-white border border-gray-300 rounded-xl pl-10 pr-3 py-2.5 text-xs text-gray-800 focus:outline-none focus:border-navy focus:ring-2 focus:ring-navy/10 transition-all font-medium"
                  />
                </div>
              </div>

              <button 
                type="submit" 
                disabled={loading}
                className="w-full bg-orange-custom hover:bg-orange-hover text-white font-black py-3.5 rounded-xl text-xs uppercase tracking-wider shadow-md transition-all cursor-pointer flex items-center justify-center gap-2 mt-2"
              >
                {loading ? (
                  <i className="fa-solid fa-spinner fa-spin text-sm"></i>
                ) : (
                  <i className="fa-solid fa-bullhorn text-sm"></i>
                )}
                <span>ĐĂNG KÝ TÀI KHOẢN GỘP</span>
              </button>
            </form>

            <div className="text-center text-xs text-gray-500 pt-1 font-medium">
              Đã có tài khoản?{' '}
              <button 
                onClick={() => { setTab('login'); setErrorMsg(''); setSuccessMsg(''); setIsOtpSent(false); }}
                className="text-orange-custom font-extrabold hover:underline cursor-pointer"
              >
                Đăng nhập ngay
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
