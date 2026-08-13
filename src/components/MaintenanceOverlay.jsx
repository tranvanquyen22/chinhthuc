import React from 'react';
import { useAuth } from '../context/AuthContext';

export default function MaintenanceOverlay({ onOpenAuth }) {
  const { userProfile, systemStatus } = useAuth();

  // Super Admin Overlord bypasses maintenance overlay to keep full control of system
  if (systemStatus.mode === 'ONLINE' || userProfile.role === 'SUPER_ADMIN') {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/95 backdrop-blur-md flex items-center justify-center p-4 font-sans text-white">
      <div className="bg-gradient-to-b from-navy to-slate-900 border-2 border-amber-400 p-6 sm:p-8 rounded-3xl max-w-lg w-full text-center space-y-5 shadow-2xl animate-in zoom-in-95 duration-200">
        
        {/* Animated Maintenance Icon */}
        <div className="w-20 h-20 bg-amber-400 text-navy font-black text-4xl rounded-3xl flex items-center justify-center mx-auto shadow-lg animate-bounce">
          🛠️
        </div>

        <div className="space-y-2">
          <span className="bg-red-600 text-white font-extrabold text-[10px] px-3 py-1 rounded-full uppercase tracking-wider">
            THÔNG BÁO TỪ HỆ THỐNG
          </span>
          <h2 className="text-2xl font-black text-amber-300 uppercase tracking-wide">
            HỆ THỐNG ĐANG BẢO TRÌ NÂNG CẤP
          </h2>
          <p className="text-xs text-gray-300 font-medium leading-relaxed bg-white/5 p-4 rounded-2xl border border-white/10">
            {systemStatus.notice || 'Hệ thống đang tiến hành nâng cấp máy chủ. Vui lòng quay lại sau ít phút!'}
          </p>
        </div>

        <div className="pt-2 text-xs text-gray-400 font-mono space-y-1">
          <p>Trạng thái: <strong className="text-red-400">🔴 SYSTEM MAINTENANCE ACTIVE</strong></p>
          <p className="text-[10px] text-gray-500">Cập nhật lúc: {new Date(systemStatus.updatedAt).toLocaleString('vi-VN')}</p>
        </div>

        {/* Emergency Admin Login Button */}
        <div className="pt-3 border-t border-white/10">
          <button 
            onClick={() => onOpenAuth && onOpenAuth('login')}
            className="text-amber-300 hover:text-white font-bold text-xs underline cursor-pointer"
          >
            🔑 Đăng nhập dành cho Quản trị viên Super Admin
          </button>
        </div>

      </div>
    </div>
  );
}
