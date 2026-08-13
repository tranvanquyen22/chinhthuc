import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { getJobListings, createJobListing } from '../lib/jobs';

export default function JobsModal({ isOpen, onClose }) {
  const { userProfile } = useAuth();
  const [activeTab, setActiveTab] = useState('search'); // 'search' | 'post'
  const [jobs, setJobs] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');

  // Form State Đăng Tuyển Dụng
  const [postTitle, setPostTitle] = useState('');
  const [postCompany, setPostCompany] = useState('');
  const [postCategory, setPostCategory] = useState('RETAIL_SALES');
  const [postSalary, setPostSalary] = useState('');
  const [postLocation, setPostLocation] = useState('');
  const [postType, setPostType] = useState('Toàn thời gian');
  const [postPhone, setPostPhone] = useState('');
  const [postDescription, setPostDescription] = useState('');
  const [postRequirements, setPostRequirements] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [appliedJobSuccess, setAppliedJobSuccess] = useState(null);

  useEffect(() => {
    if (isOpen) {
      setJobs(getJobListings());
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const filteredJobs = jobs.filter((item) => {
    if (selectedCategory !== 'ALL' && item.category !== selectedCategory) return false;
    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase();
      const matchTitle = item.title?.toLowerCase().includes(q);
      const matchCompany = item.company?.toLowerCase().includes(q);
      const matchLoc = item.location?.toLowerCase().includes(q);
      return matchTitle || matchCompany || matchLoc;
    }
    return true;
  });

  const handlePostSubmit = async (e) => {
    e.preventDefault();
    if (!postTitle.trim() || !postSalary.trim() || !postLocation.trim() || !postPhone.trim()) {
      alert('Vui lòng điền đầy đủ các thông tin tuyển dụng bắt buộc!');
      return;
    }

    setIsSubmitting(true);
    const newJobObj = await createJobListing({
      title: postTitle.trim(),
      company: postCompany.trim() || userProfile?.name || 'Gian Hàng TQ Store',
      category: postCategory,
      salary: postSalary.trim(),
      location: postLocation.trim(),
      type: postType,
      phone: postPhone.trim(),
      description: postDescription.trim(),
      requirements: postRequirements.trim()
    });

    setIsSubmitting(false);
    setJobs(getJobListings());
    setActiveTab('search');
    alert('🎉 ĐĂNG BÀI TUYỂN DỤNG THÀNH CÔNG! Bài đăng tuyển của bạn đã hiển thị tức thì cho ứng viên!');
    
    // Reset form
    setPostTitle('');
    setPostCompany('');
    setPostSalary('');
    setPostLocation('');
    setPostPhone('');
    setPostDescription('');
    setPostRequirements('');
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 font-sans text-xs">
      <div className="bg-white rounded-3xl max-w-3xl w-full p-5 sm:p-7 space-y-5 shadow-2xl border-2 border-amber-400 max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 pb-3.5">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-indigo-600 to-navy text-white rounded-2xl flex items-center justify-center text-2xl font-black shadow-md">
              <i className="fa-solid fa-briefcase"></i>
            </div>
            <div>
              <h3 className="font-black text-base text-navy uppercase tracking-wider">
                💼 VIỆC LÀM TQ - TÌM VIỆC LÀM & ĐĂNG TUYỂN DỤNG
              </h3>
              <p className="text-[11px] text-gray-500 font-medium">
                Kết nối ứng viên & Nhà tuyển dụng tức thì • 100% Miễn phí không qua trung gian
              </p>
            </div>
          </div>

          <button 
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 flex items-center justify-center font-black cursor-pointer text-xs"
          >
            ✕
          </button>
        </div>

        {/* TOP TAB SWITCHER: TÌM VIỆC LÀM vs ĐĂNG TUYỂN DỤNG */}
        <div className="grid grid-cols-2 gap-2 bg-gray-100 p-1.5 rounded-2xl border border-gray-200 font-black text-xs">
          <button 
            onClick={() => setActiveTab('search')}
            className={`py-3 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 ${
              activeTab === 'search' 
                ? 'bg-navy text-amber-300 shadow-md border border-amber-400/40' 
                : 'text-gray-600 hover:text-navy'
            }`}
          >
            <i className="fa-solid fa-magnifying-glass"></i>
            <span>🔍 TÌM VIỆC LÀM ({jobs.length} VỊ TRÍ)</span>
          </button>

          <button 
            onClick={() => setActiveTab('post')}
            className={`py-3 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 ${
              activeTab === 'post' 
                ? 'bg-red-600 text-white shadow-md border border-amber-300' 
                : 'text-gray-600 hover:text-navy'
            }`}
          >
            <i className="fa-solid fa-pen-to-square"></i>
            <span>📝 ĐĂNG BÀI TUYỂN DỤNG NGAY</span>
          </button>
        </div>

        {/* TAB 1: DANH SÁCH BÀI ĐĂNG TÌM VIỆC LÀM */}
        {activeTab === 'search' && (
          <div className="space-y-4">
            {/* Thanh Tìm Kiếm & Bộ Lọc Danh Mục */}
            <div className="flex flex-col sm:flex-row items-center gap-2.5">
              <div className="relative flex-1 w-full">
                <i className="fa-solid fa-search absolute left-3.5 top-3 text-gray-400"></i>
                <input 
                  type="text" 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Tìm theo tên công việc, công ty, địa điểm làm việc..." 
                  className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-gray-300 rounded-xl text-xs text-navy font-bold focus:outline-none focus:border-amber-500"
                />
              </div>

              <select 
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full sm:w-auto bg-slate-50 border border-gray-300 rounded-xl px-3 py-2.5 font-bold text-xs text-navy focus:outline-none cursor-pointer"
              >
                <option value="ALL">🌐 Tất Cả Ngành Nghề</option>
                <option value="TAXI_DRIVER">🚗 Tài Xế & Giao Hàng</option>
                <option value="RETAIL_SALES">👗 Bán Hàng & Thời Trang</option>
                <option value="FNB">🧋 F&B, Thu Ngân & Pha Chế</option>
                <option value="BEAUTY_SPA">💄 Spa & Làm Đẹp</option>
                <option value="OTHER">🏢 Khác</option>
              </select>
            </div>

            {/* DANH SÁCH THẺ VIỆC LÀM */}
            <div className="space-y-3.5">
              {filteredJobs.length === 0 ? (
                <div className="text-center py-10 text-gray-500 space-y-2">
                  <i className="fa-solid fa-folder-open text-4xl text-gray-300"></i>
                  <p className="font-bold">Chưa tìm thấy bài tuyển dụng phù hợp với tìm kiếm của bạn.</p>
                </div>
              ) : (
                filteredJobs.map((item) => (
                  <div 
                    key={item.id}
                    className="p-4 bg-slate-50 rounded-2xl border-2 border-gray-200 hover:border-amber-400 transition-all space-y-3 shadow-xs"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2 border-b border-gray-200 pb-2.5">
                      <div className="space-y-1">
                        <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-navy text-amber-300 font-mono">
                          {item.type}
                        </span>
                        <h4 className="font-black text-sm text-navy">{item.title}</h4>
                        <p className="text-[11px] font-bold text-gray-600 flex items-center gap-1">
                          <i className="fa-solid fa-building text-amber-500"></i>
                          <span>{item.company}</span>
                        </p>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="text-xs font-mono font-black text-emerald-700 bg-emerald-100 px-3 py-1 rounded-full border border-emerald-300 inline-block">
                          💰 {item.salary}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-gray-700 font-medium">
                      <p>📍 <strong>Địa điểm:</strong> {item.location}</p>
                      <p>📞 <strong>Hotline/Zalo:</strong> <span className="font-mono text-navy font-bold">{item.phone}</span></p>
                    </div>

                    <div className="bg-white p-3 rounded-xl border border-gray-200 text-[11px] space-y-1">
                      <p className="text-gray-800"><strong>Mô tả:</strong> {item.description}</p>
                      {item.requirements && (
                        <p className="text-gray-600"><strong>Yêu cầu:</strong> {item.requirements}</p>
                      )}
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[9px] text-gray-400">
                        Đăng ngày: {new Date(item.created_at).toLocaleDateString('vi-VN')}
                      </span>

                      <button 
                        onClick={() => {
                          setAppliedJobSuccess(item);
                          alert(`🎉 ĐÃ GỬI ỨNG TUYỂN! Vui lòng gọi trực tiếp hotline/Zalo: ${item.phone} để hẹn lịch phỏng vấn!`);
                        }}
                        className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 text-white font-black px-5 py-2 rounded-xl text-xs uppercase cursor-pointer transition-all shadow-md flex items-center gap-1.5"
                      >
                        <i className="fa-solid fa-paper-plane"></i>
                        <span>ỨNG TUYỂN NGAY (GỌI {item.phone})</span>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* TAB 2: FORM ĐĂNG TUYỂN DỤNG BÀI MỚI */}
        {activeTab === 'post' && (
          <form onSubmit={handlePostSubmit} className="space-y-4">
            <div className="bg-amber-50 border border-amber-300 p-3 rounded-2xl text-amber-900 text-[11px] font-medium flex items-center gap-2">
              <i className="fa-solid fa-bullhorn text-amber-600 text-base shrink-0"></i>
              <span>Điền thông tin vị trí bạn cần tuyển dụng. Bài đăng sẽ hiển thị trực tiếp cho hàng ngàn ứng viên trên hệ thống TQ Store!</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-navy mb-1">
                  1. Tên Vị Trí Tuyển Dụng (*):
                </label>
                <input 
                  type="text" 
                  value={postTitle}
                  onChange={(e) => setPostTitle(e.target.value)}
                  required
                  placeholder="Ví dụ: Nhân viên bán hàng thời trang / Tài xế xe 4 chỗ..." 
                  className="w-full bg-slate-50 border border-gray-300 rounded-xl px-3 py-2 text-xs text-navy font-bold focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block font-bold text-navy mb-1">
                  2. Tên Công Ty / Gian Hàng (*):
                </label>
                <input 
                  type="text" 
                  value={postCompany}
                  onChange={(e) => setPostCompany(e.target.value)}
                  placeholder="Ví dụ: TQ Retail Boutique / TQ Spa..." 
                  className="w-full bg-slate-50 border border-gray-300 rounded-xl px-3 py-2 text-xs text-navy font-bold focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block font-bold text-navy mb-1">
                  3. Danh Mục Ngành Nghề (*):
                </label>
                <select 
                  value={postCategory}
                  onChange={(e) => setPostCategory(e.target.value)}
                  className="w-full bg-slate-50 border border-gray-300 rounded-xl px-3 py-2 text-xs text-navy font-bold focus:outline-none cursor-pointer"
                >
                  <option value="RETAIL_SALES">👗 Bán Hàng & Thời Trang</option>
                  <option value="TAXI_DRIVER">🚗 Tài Xế & Giao Hàng</option>
                  <option value="FNB">🧋 F&B, Thu Ngân & Pha Chế</option>
                  <option value="BEAUTY_SPA">💄 Spa & Làm Đẹp</option>
                  <option value="OTHER">🏢 Khác</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-navy mb-1">
                  4. Mức Lương Dự Kiến (*):
                </label>
                <input 
                  type="text" 
                  value={postSalary}
                  onChange={(e) => setPostSalary(e.target.value)}
                  required
                  placeholder="Ví dụ: 10 - 15 triệu/tháng hoặc 35k/giờ..." 
                  className="w-full bg-slate-50 border border-gray-300 rounded-xl px-3 py-2 text-xs text-navy font-bold focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block font-bold text-navy mb-1">
                  5. Loại Hình Làm Việc:
                </label>
                <select 
                  value={postType}
                  onChange={(e) => setPostType(e.target.value)}
                  className="w-full bg-slate-50 border border-gray-300 rounded-xl px-3 py-2 text-xs text-navy font-bold focus:outline-none cursor-pointer"
                >
                  <option value="Toàn thời gian">Toàn thời gian</option>
                  <option value="Bán thời gian">Bán thời gian</option>
                  <option value="Xoay ca linh hoạt">Xoay ca linh hoạt</option>
                  <option value="Tự do / Freelance">Tự do / Freelance</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-navy mb-1">
                  6. Địa Điểm Làm Việc (*):
                </label>
                <input 
                  type="text" 
                  value={postLocation}
                  onChange={(e) => setPostLocation(e.target.value)}
                  required
                  placeholder="Ví dụ: Quận 1, TP. Hồ Chí Minh..." 
                  className="w-full bg-slate-50 border border-gray-300 rounded-xl px-3 py-2 text-xs text-navy font-bold focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block font-bold text-navy mb-1">
                  7. Số Điện Thoại / Zalo Liên Hệ (*):
                </label>
                <input 
                  type="text" 
                  value={postPhone}
                  onChange={(e) => setPostPhone(e.target.value)}
                  required
                  placeholder="Ví dụ: 0901234567..." 
                  className="w-full bg-slate-50 border border-gray-300 rounded-xl px-3 py-2 text-xs text-navy font-bold focus:outline-none focus:border-amber-500 font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block font-bold text-navy mb-1">
                8. Mô Tả Chi Tiết Công Việc:
              </label>
              <textarea 
                rows="3"
                value={postDescription}
                onChange={(e) => setPostDescription(e.target.value)}
                placeholder="Mô tả công việc hàng ngày, quyền lợi được hưởng..." 
                className="w-full bg-slate-50 border border-gray-300 rounded-xl p-3 text-xs text-gray-800 focus:outline-none focus:border-amber-500"
              ></textarea>
            </div>

            <div>
              <label className="block font-bold text-navy mb-1">
                9. Yêu Cầu Đối Với Ứng Viên:
              </label>
              <input 
                type="text" 
                value={postRequirements}
                onChange={(e) => setPostRequirements(e.target.value)}
                placeholder="Ví dụ: Có kinh nghiệm bán hàng 1 năm, thật thà, nhanh nhẹn..." 
                className="w-full bg-slate-50 border border-gray-300 rounded-xl px-3 py-2 text-xs text-gray-800 focus:outline-none focus:border-amber-500"
              />
            </div>

            <button 
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-gradient-to-r from-red-600 via-rose-600 to-amber-600 hover:from-red-700 text-white font-black py-3.5 rounded-2xl text-xs uppercase tracking-wider shadow-lg transition-all cursor-pointer flex items-center justify-center gap-2 border border-amber-300"
            >
              <i className={`fa-solid ${isSubmitting ? 'fa-spinner fa-spin' : 'fa-paper-plane'}`}></i>
              <span>{isSubmitting ? 'ĐANG TẢI BÀI TUYỂN DỤNG...' : '🚀 ĐĂNG BÀI TUYỂN DỤNG NGAY HOÀN TOÀN MIỄN PHÍ'}</span>
            </button>

          </form>
        )}

      </div>
    </div>
  );
}
