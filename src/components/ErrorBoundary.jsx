import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('CRITICAL FRONTEND RENDER ERROR CATCHED BY BOUNDARY:', error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.reload();
  };

  handleClearCacheAndReset = () => {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch (e) {
      console.error(e);
    }
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      const errorMsg = this.state.error?.message || 'Lỗi giao diện hoặc kết nối hệ thống không xác định.';
      const isSupabaseMissingEnv = !import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY;

      return (
        <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-4 font-sans">
          <div className="bg-slate-900 border-2 border-red-500/80 rounded-3xl max-w-xl w-full p-6 sm:p-8 shadow-2xl space-y-5 animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 border-b border-slate-800 pb-4">
              <div className="w-12 h-12 bg-red-600/30 text-red-400 border border-red-500/50 rounded-2xl flex items-center justify-center text-2xl font-black shrink-0">
                <i className="fa-solid fa-triangle-exclamation animate-bounce"></i>
              </div>
              <div>
                <h3 className="font-black text-lg text-amber-300 uppercase tracking-wider">
                  ⚠️ PHÁT HIỆN SỰ CỐ GIAO DIỆN (SYSTEM ERROR CATCHED)
                </h3>
                <p className="text-xs text-gray-400">
                  Hệ thống đã tự động ngăn ngừa màn hình trắng (White Screen of Death)
                </p>
              </div>
            </div>

            {isSupabaseMissingEnv && (
              <div className="bg-amber-950/80 border border-amber-400 text-amber-200 p-4 rounded-2xl text-xs space-y-1">
                <div className="font-black flex items-center gap-1.5 text-amber-300">
                  <i className="fa-solid fa-circle-exclamation"></i>
                  <span>CẢNH BÁO CHƯA CẤU HÌNH SUPABASE ON VERCEL:</span>
                </div>
                <p className="text-[11px] text-amber-100/90 leading-relaxed">
                  Vercel Project Settings chưa có <code>VITE_SUPABASE_URL</code> và <code>VITE_SUPABASE_ANON_KEY</code>. Vui lòng thêm biến môi trường trên Vercel Dashboard rồi Redeploy.
                </p>
              </div>
            )}

            <div className="space-y-2">
              <label className="block text-xs font-black text-gray-300 uppercase tracking-wider">
                Chi tiết nguyên nhân lỗi:
              </label>
              <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 text-red-400 font-mono text-xs overflow-x-auto whitespace-pre-wrap max-h-44">
                {errorMsg}
                {this.state.errorInfo?.componentStack && (
                  <span className="block mt-2 text-[10px] text-gray-500">
                    {this.state.errorInfo.componentStack}
                  </span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <button 
                onClick={this.handleReset}
                className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 text-white font-black py-3 rounded-2xl text-xs uppercase tracking-wider shadow-md transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <i className="fa-solid fa-rotate-right"></i>
                <span>TẢI LẠI TRANG WEB</span>
              </button>

              <button 
                onClick={this.handleClearCacheAndReset}
                className="w-full bg-slate-800 hover:bg-slate-700 text-amber-300 font-black py-3 rounded-2xl text-xs uppercase tracking-wider shadow-md transition-all cursor-pointer flex items-center justify-center gap-2 border border-slate-700"
              >
                <i className="fa-solid fa-broom"></i>
                <span>XÓA CACHE & THỬ LẠI</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
