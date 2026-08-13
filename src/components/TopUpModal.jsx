import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { sendDepositRequest, sendWithdrawalRequest, getUserDefaultBank } from '../lib/userSync';
import { isNameMatching } from '../lib/validation';
import { getSystemBankConfig, generateVietQRUrl } from '../lib/systemBankConfig';

export default function TopUpModal({ isOpen, onClose }) {
  const { user, userProfile } = useAuth();
  const [activeTab, setActiveTab] = useState('topup'); // 'topup' | 'withdraw'

  // States cho Nạp tiền
  const [topUpAmount, setTopUpAmount] = useState(500000);
  const [isSubmittingDeposit, setIsSubmittingDeposit] = useState(false);

  // States cho Rút tiền
  const [withdrawAmount, setWithdrawAmount] = useState(200000);
  const [bankName, setBankName] = useState('MBBank (NHTM CP Quân Đội)');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountHolder, setAccountHolder] = useState('');
  const [isDefaultBankLocked, setIsDefaultBankLocked] = useState(false);
  const [isSubmittingWithdrawal, setIsSubmittingWithdrawal] = useState(false);

  const registeredName = userProfile.name || user?.email?.split('@')[0] || 'Khách hàng TQ';

  // Load ngân hàng mặc định đã cố định (nếu có sau lần rút thành công đầu tiên)
  useEffect(() => {
    if (!user?.email || !isOpen) return;
    const defaultBank = getUserDefaultBank(user.email);
    if (defaultBank && defaultBank.accountNumber) {
      setBankName(defaultBank.bankName || 'MBBank (NHTM CP Quân Đội)');
      setAccountNumber(defaultBank.accountNumber || '');
      setAccountHolder(defaultBank.accountHolder || registeredName);
      setIsDefaultBankLocked(true);
    } else {
      setIsDefaultBankLocked(false);
      if (!accountHolder) {
        setAccountHolder(registeredName.toUpperCase());
      }
    }
  }, [user?.email, isOpen, registeredName]);

  if (!isOpen) return null;

  // System receiving bank config from Admin
  const systemBank = getSystemBankConfig();
  const adminBankName = systemBank.bankName;
  const adminStk = systemBank.accountNumber;
  const adminOwnerName = systemBank.accountHolder;
  const memo = `${systemBank.transferSyntaxPrefix} ${user?.email || 'user'}`;
  const vietQRUrl = generateVietQRUrl(systemBank.bankCode, systemBank.accountNumber, topUpAmount, memo);

  // Xử lý gửi lệnh NẠP TIỀN
  const handleConfirmTopUp = async () => {
    const add = Number(topUpAmount);
    if (add < 10000) {
      alert('⚠️ Số tiền nạp tối thiểu là 10.000 VNĐ!');
      return;
    }

    setIsSubmittingDeposit(true);
    try {
      await sendDepositRequest({
        email: user?.email || 'khach@tqstore.vn',
        name: registeredName,
        role: userProfile.role || 'USER',
        amount: add,
        paymentMethod: 'Chuyển Khoản Ngân Hàng VietQR',
        transactionCode: `TQ${Math.floor(100000 + Math.random() * 900000)}`
      });

      alert(`📩 Đã gửi yêu cầu nạp +${add.toLocaleString('vi-VN')} VNĐ thành công!\n\nLệnh nạp tiền đã được gửi lên hệ thống chờ Admin phê duyệt & cộng vào số dư Ví TQ Pay.`);
      onClose();
    } catch (err) {
      alert('⚠️ Lỗi gửi lệnh nạp tiền. Vui lòng thử lại!');
    } finally {
      setIsSubmittingDeposit(false);
    }
  };

  const handleCopyMemo = () => {
    navigator.clipboard.writeText(memo);
    alert(`Đã sao chép nội dung chuyển khoản: [ ${memo} ]`);
  };

  // Kiểm tra tính hợp lệ của lệnh RÚT TIỀN
  const nameMatch = isNameMatching(accountHolder, registeredName);
  const currentBalance = Number(userProfile.walletBalance || 0);
  const numWithdrawAmount = Number(withdrawAmount) || 0;
  const isBalanceEnough = numWithdrawAmount <= currentBalance;
  const isMinAmountOk = numWithdrawAmount >= 50000;
  const isAccountNumValid = accountNumber.trim().length >= 6;

  const isWithdrawValid = nameMatch && isBalanceEnough && isMinAmountOk && isAccountNumValid;

  // Xử lý gửi lệnh RÚT TIỀN
  const handleConfirmWithdraw = async () => {
    if (!isWithdrawValid) return;

    setIsSubmittingWithdrawal(true);
    try {
      await sendWithdrawalRequest({
        email: user?.email || 'khach@tqstore.vn',
        name: registeredName,
        role: userProfile.role || 'USER',
        amount: numWithdrawAmount,
        bankName,
        accountNumber: accountNumber.trim(),
        accountHolder: accountHolder.trim().toUpperCase()
      });

      alert(`📩 Đã gửi yêu cầu rút tiền thành công!\n\nLệnh rút ${numWithdrawAmount.toLocaleString('vi-VN')} VNĐ về ngân hàng [${bankName} - STK: ${accountNumber}] đang được gửi lên Admin phê duyệt giải ngân.`);
      onClose();
    } catch (err) {
      alert('⚠️ Lỗi gửi lệnh rút tiền. Vui lòng thử lại!');
    } finally {
      setIsSubmittingWithdrawal(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 font-sans">
      <div className="bg-white rounded-3xl w-full max-w-lg p-5 sm:p-6 shadow-2xl relative space-y-4 max-h-[90vh] overflow-y-auto border border-gray-200 animate-in zoom-in-95 duration-200">
        
        {/* Nút đóng X */}
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-gray-100 hover:bg-red-600 hover:text-white text-gray-500 flex items-center justify-center transition-colors cursor-pointer"
        >
          <i className="fa-solid fa-xmark text-sm font-bold"></i>
        </button>

        {/* Modal Header */}
        <div className="text-center space-y-1">
          <div className="w-12 h-12 bg-gradient-to-br from-emerald-400 to-teal-600 text-white rounded-2xl flex items-center justify-center text-xl mx-auto shadow-md">
            <i className="fa-solid fa-wallet"></i>
          </div>
          <h3 className="text-lg font-black text-navy uppercase tracking-wider">
            QUẢN LÝ VÍ ĐIỆN TỬ TQ PAY
          </h3>
          <p className="text-xs text-gray-500">Nạp tiền tích điểm hoặc rút tiền về tài khoản ngân hàng ATM chính chủ</p>
        </div>

        {/* Tab Switcher (Nạp tiền / Rút tiền) */}
        <div className="grid grid-cols-2 gap-2 bg-gray-100 p-1.5 rounded-2xl text-xs font-extrabold">
          <button 
            type="button"
            onClick={() => setActiveTab('topup')}
            className={`py-2 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === 'topup' 
                ? 'bg-emerald-600 text-white shadow-sm font-black' 
                : 'text-gray-600 hover:bg-gray-200'
            }`}
          >
            <i className="fa-solid fa-circle-arrow-down"></i>
            <span>1. NẠP TIỀN VÀO VÍ</span>
          </button>

          <button 
            type="button"
            onClick={() => setActiveTab('withdraw')}
            className={`py-2 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === 'withdraw' 
                ? 'bg-navy text-amber-300 shadow-sm font-black' 
                : 'text-gray-600 hover:bg-gray-200'
            }`}
          >
            <i className="fa-solid fa-money-bill-transfer"></i>
            <span>2. RÚT TIỀN VỀ ATM</span>
          </button>
        </div>

        {/* Bảng số dư ví hiện tại */}
        <div className="bg-emerald-50/80 p-3.5 rounded-2xl border border-emerald-200 text-center shadow-2xs space-y-0.5">
          <span className="text-gray-500 font-bold uppercase text-[10px]">Số dư Ví TQ Pay khả dụng:</span>
          <h4 className="text-2xl font-black text-emerald-700 font-mono">
            {Number(userProfile.walletBalance || 0).toLocaleString('vi-VN')} VNĐ
          </h4>
        </div>

        {/* ================= TAB 1: NẠP TIỀN VÀO VÍ ================= */}
        {activeTab === 'topup' && (
          <div className="space-y-4 text-xs">
            <div>
              <label className="block font-bold text-gray-700 mb-1">Chọn số tiền nạp nhanh:</label>
              <div className="grid grid-cols-3 gap-2">
                {[200000, 500000, 1000000].map((amt) => (
                  <button 
                    key={amt}
                    type="button" 
                    onClick={() => setTopUpAmount(amt)}
                    className={`py-2 border rounded-xl font-bold transition-all cursor-pointer ${
                      topUpAmount === amt ? 'bg-emerald-50 border-emerald-600 text-emerald-700 ring-2 ring-emerald-400/30' : 'hover:border-emerald-600'
                    }`}
                  >
                    {amt.toLocaleString('vi-VN')}đ
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block font-bold text-gray-700 mb-1">Hoặc nhập số tiền tùy chỉnh (VNĐ):</label>
              <input 
                type="number" 
                value={topUpAmount}
                onChange={(e) => setTopUpAmount(Number(e.target.value))}
                min={10000}
                step={10000}
                className="w-full px-3 py-2 border rounded-xl font-bold text-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-400"
              />
            </div>

            <div className="bg-slate-50 p-4 rounded-2xl border border-gray-200 space-y-3">
              <h4 className="font-bold text-navy text-xs flex items-center justify-between border-b pb-2">
                <span>🏦 Quét Mã VietQR Chuyển Khoản Tự Động</span>
                <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full">Tự điền số tiền</span>
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
                <div className="text-center bg-white p-2 rounded-xl border shadow-2xs">
                  <img 
                    src={vietQRUrl} 
                    alt="Mã VietQR" 
                    className="w-36 h-36 object-contain mx-auto rounded border"
                  />
                  <p className="text-[9px] text-gray-400 mt-1">Dùng App Ngân hàng / Momo quét mã</p>
                </div>

                <div className="space-y-1.5 text-xs">
                  <p className="text-gray-500">Ngân hàng: <strong className="text-navy">{adminBankName}</strong></p>
                  <p className="text-gray-500">STK: <strong className="text-emerald-600 font-mono font-black">{adminStk}</strong></p>
                  <p className="text-gray-500">Chủ TK: <strong className="text-navy uppercase">{adminOwnerName}</strong></p>

                  <div className="bg-amber-50 border border-amber-300 p-2 rounded-xl space-y-1">
                    <span className="text-[10px] text-amber-900 font-extrabold block">⚠️ Syntax Nội dung CK:</span>
                    <div className="flex items-center justify-between bg-white px-2 py-1 rounded-lg border border-amber-200">
                      <strong className="font-mono text-xs font-black text-amber-800 truncate max-w-[120px]">{memo}</strong>
                      <button 
                        type="button" 
                        onClick={handleCopyMemo}
                        className="bg-amber-500 hover:bg-amber-600 text-white px-2 py-0.5 rounded text-[9px] font-bold cursor-pointer"
                      >
                        Copy
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <button 
              onClick={handleConfirmTopUp}
              disabled={isSubmittingDeposit}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-2xl font-black text-xs uppercase tracking-wider shadow-md cursor-pointer flex items-center justify-center gap-2 transition-all disabled:opacity-50"
            >
              <i className="fa-solid fa-paper-plane"></i>
              <span>{isSubmittingDeposit ? 'ĐANG GỬI LỆNH NẠP...' : 'GỬI LỆNH NẠP TIỀN ĐỂ ADMIN DUYỆT CỘNG VÍ'}</span>
            </button>
          </div>
        )}

        {/* ================= TAB 2: RÚT TIỀN VỀ ATM NGÂN HÀNG ================= */}
        {activeTab === 'withdraw' && (
          <div className="space-y-4 text-xs">
            
            {/* Badge thông báo ngân hàng mặc định đã cố định (nếu có) */}
            {isDefaultBankLocked ? (
              <div className="bg-emerald-50 border border-emerald-300 p-3 rounded-2xl text-emerald-900 space-y-1">
                <div className="flex items-center gap-1.5 font-black text-xs text-emerald-700">
                  <i className="fa-solid fa-lock text-emerald-600"></i>
                  <span>Ngân Hàng Rút Tiền Mặc Định Đã Xác Thực (Đã Khóa An Toàn)</span>
                </div>
                <p className="text-[11px] text-emerald-800">
                  Thông tin ngân hàng dưới đây đã được lưu mặc định sau lần rút tiền thành công đầu tiên. Mọi lệnh rút tiền tiếp theo sẽ tự động giải ngân về ngân hàng này.
                </p>
              </div>
            ) : (
              <div className="bg-blue-50 border border-blue-200 p-3 rounded-2xl text-blue-900 space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-xs text-navy">
                  <i className="fa-solid fa-shield-halved text-blue-600"></i>
                  <span>Quy Tắc An Toàn Rút Tiền Lần Đầu Tiên</span>
                </div>
                <p className="text-[11px] text-gray-600">
                  Tên chủ tài khoản nhận tiền phải <strong>TRÙNG KHỚP HOÀN TOÀN</strong> với Họ và tên đăng ký tài khoản (<strong>{registeredName}</strong>). Sau khi rút tiền thành công lần đầu, ngân hàng này sẽ trở thành ngân hàng mặc định cố định.
                </p>
              </div>
            )}

            {/* Form nhập ngân hàng */}
            <div className="space-y-3">
              <div>
                <label className="block font-bold text-gray-700 mb-1">1. Chọn Ngân Hàng Nhận Tiền:</label>
                <select 
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  disabled={isDefaultBankLocked}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl font-extrabold text-navy bg-white focus:outline-none focus:ring-2 focus:ring-navy disabled:bg-gray-100 disabled:text-gray-600"
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
                <label className="block font-bold text-gray-700 mb-1">2. Số Tài Khoản Ngân Hàng (STK):</label>
                <input 
                  type="text" 
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value)}
                  readOnly={isDefaultBankLocked}
                  placeholder="Ví dụ: 0988 123 456"
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl font-mono font-bold text-navy focus:outline-none focus:ring-2 focus:ring-navy read-only:bg-gray-100 read-only:text-gray-600"
                />
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1">
                  3. Tên Chủ Tài Khoản (Yêu cầu trùng khớp với họ tên đăng ký):
                </label>
                <input 
                  type="text" 
                  value={accountHolder}
                  onChange={(e) => setAccountHolder(e.target.value.toUpperCase())}
                  readOnly={isDefaultBankLocked}
                  placeholder={`Ví dụ: ${registeredName.toUpperCase()}`}
                  className={`w-full px-3 py-2 border rounded-xl font-bold uppercase focus:outline-none focus:ring-2 read-only:bg-gray-100 ${
                    accountHolder && !nameMatch
                      ? 'border-red-500 text-red-600 focus:ring-red-400 bg-red-50' 
                      : 'border-gray-300 text-navy focus:ring-navy'
                  }`}
                />

                {/* Cảnh báo khớp tên */}
                {accountHolder && !nameMatch && (
                  <div className="bg-red-50 border border-red-300 p-2.5 rounded-xl text-red-800 text-[11px] mt-1 space-y-0.5">
                    <span className="font-extrabold block">❌ CẢNH BÁO TÊN KHÔNG TRÙNG KHỚP:</span>
                    <span>Tên chủ TK [<strong>{accountHolder}</strong>] không khớp với tên đăng ký tài khoản [<strong>{registeredName}</strong>]. Tiền rút chỉ được giải ngân cho chính chủ!</span>
                  </div>
                )}

                {accountHolder && nameMatch && (
                  <div className="flex items-center gap-1 text-[11px] text-emerald-600 font-bold mt-1">
                    <i className="fa-solid fa-circle-check"></i>
                    <span>Tên chủ tài khoản hợp lệ, trùng khớp với thông tin đăng ký ({registeredName})</span>
                  </div>
                )}
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1">4. Số Tiền Muốn Rút Về ATM (VNĐ):</label>
                <input 
                  type="number" 
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(Number(e.target.value))}
                  min={50000}
                  max={currentBalance}
                  step={50000}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl font-mono font-black text-navy focus:outline-none focus:ring-2 focus:ring-navy"
                />

                {!isBalanceEnough && (
                  <p className="text-[11px] text-red-600 font-bold mt-1">
                    ❌ Số tiền rút ({numWithdrawAmount.toLocaleString('vi-VN')}đ) vượt quá số dư khả dụng hiện tại ({currentBalance.toLocaleString('vi-VN')}đ)!
                  </p>
                )}

                {!isMinAmountOk && (
                  <p className="text-[11px] text-red-600 font-bold mt-1">
                    ❌ Số tiền rút tối thiểu là 50.000 VNĐ.
                  </p>
                )}
              </div>
            </div>

            <button 
              onClick={handleConfirmWithdraw}
              disabled={!isWithdrawValid || isSubmittingWithdrawal}
              className="w-full bg-navy hover:bg-navy-dark text-amber-300 py-3 rounded-2xl font-black text-xs uppercase tracking-wider shadow-md cursor-pointer flex items-center justify-center gap-2 transition-all disabled:opacity-40 disabled:cursor-not-allowed border border-amber-300/30"
            >
              <i className="fa-solid fa-money-bill-transfer"></i>
              <span>{isSubmittingWithdrawal ? 'ĐANG GỬI LỆNH RÚT...' : '💸 GỬI LỆNH RÚT TIỀN ĐỂ ADMIN GIẢI NGÂN'}</span>
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
