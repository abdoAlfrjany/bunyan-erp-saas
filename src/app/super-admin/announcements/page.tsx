'use client';

import { useState } from 'react';
import { useDataStore } from '@/core/db/store';
import { useToast } from '@/shared/components/ui/Toast';
import { Megaphone, Plus, Trash2, Calendar, Eye, Send } from 'lucide-react';

export default function SuperAdminAnnouncements() {
  const { announcements, addAnnouncement, removeAnnouncement } = useDataStore();
  const { showToast } = useToast();
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  const [newAnnounce, setNewAnnounce] = useState({
    title: '',
    content: '',
    type: 'info' as 'info' | 'warning' | 'maintenance',
    expiresAt: ''
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAnnounce.title || !newAnnounce.content || !newAnnounce.expiresAt) return;

    addAnnouncement({
      id: `ann-${Date.now()}`,
      title: newAnnounce.title,
      content: newAnnounce.content,
      type: newAnnounce.type,
      expiresAt: new Date(newAnnounce.expiresAt).toISOString(),
      createdAt: new Date().toISOString()
    });

    showToast('تم إرسال الإعلان لجميع المتاجر بنجاح!', 'success');
    setIsModalOpen(false);
    setNewAnnounce({ title: '', content: '', type: 'info', expiresAt: '' });
  };

  const TYPE_STYLES = {
    info: { label: 'معلومة', bg: 'bg-blue-50 text-blue-700 border-blue-100' },
    warning: { label: 'تحذير', bg: 'bg-amber-50 text-amber-700 border-amber-100' },
    maintenance: { label: 'صيانة قادمة', bg: 'bg-red-50 text-red-700 border-red-100' },
  };

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900">نظام الإعلانات العامة</h1>
          <p className="text-sm text-gray-500 mt-1">إنشاء وإرسال إعلانات تظهر في لوحة تحكم جميع المتاجر (تحديثات، صيانة، تحذيرات).</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="px-4 py-2 bg-bunyan-600 hover:bg-bunyan-700 text-white rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 shadow-sm"
        >
          <Plus size={18} />
          <span>إعلان جديد</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {announcements.map((a) => {
          const style = TYPE_STYLES[a.type as keyof typeof TYPE_STYLES] || TYPE_STYLES.info;
          return (
            <div key={a.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col justify-between hover:shadow-md transition-shadow">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className={`px-2.5 py-1 rounded-lg text-xs font-bold border ${style.bg}`}>
                    {style.label}
                  </span>
                  <p className="text-[10px] font-bold text-gray-400 flex items-center gap-1">
                    <Calendar size={12} /> {new Date(a.createdAt).toLocaleDateString('ar-LY')}
                  </p>
                </div>
                <h3 className="text-base font-bold text-gray-900 mb-2">{a.title}</h3>
                <p className="text-sm text-gray-600 leading-relaxed line-clamp-3 mb-4">{a.content}</p>
              </div>
              
              <div className="pt-4 border-t border-gray-50 flex items-center justify-between mt-auto">
                <p className="text-xs text-red-500 font-semibold flex items-center gap-1">
                  ينتهي في: <Calendar size={12}/> {new Date(a.expiresAt).toLocaleDateString('ar-LY')}
                </p>
                <button 
                  onClick={() => removeAnnouncement(a.id)}
                  className="w-8 h-8 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 flex items-center justify-center transition-colors"
                  title="حذف الإعلان"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          );
        })}

        {announcements.length === 0 && (
          <div className="col-span-full py-16 text-center bg-white rounded-2xl border border-gray-100 border-dashed">
            <Megaphone size={48} className="mx-auto text-gray-300 mb-4" />
            <h3 className="text-lg font-bold text-gray-900 mb-1">لا توجد إعلانات نشطة</h3>
            <p className="text-sm text-gray-500">قم بإنشاء إعلان جديد لتنبيه المتاجر بآخر المستجدات.</p>
          </div>
        )}
      </div>

      {/* Create Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setIsModalOpen(false)} />
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden relative z-10 animate-scale-in">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h2 className="text-lg font-extrabold text-gray-900 flex items-center gap-2">
                <Megaphone size={20} className="text-bunyan-600" />
                إعلان عام لكافة المتاجر
              </h2>
            </div>
            
            <form onSubmit={handleCreate} className="p-6 space-y-5">
              <div className="space-y-2">
                <label className="block text-sm font-bold text-gray-700">عنوان الإعلان</label>
                <input 
                  type="text" 
                  required
                  value={newAnnounce.title}
                  onChange={e => setNewAnnounce({...newAnnounce, title: e.target.value})}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl bg-gray-50 focus:bg-white outline-none focus:ring-2" 
                  placeholder="مثال: تحديث النظام المالي الجديد"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-bold text-gray-700">نوع الإعلان</label>
                <div className="grid grid-cols-3 gap-3">
                  <label className={`cursor-pointer px-3 py-2 border rounded-xl flex items-center justify-center gap-2 text-sm font-bold transition-all ${newAnnounce.type === 'info' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
                    <input type="radio" value="info" checked={newAnnounce.type === 'info'} onChange={() => setNewAnnounce({...newAnnounce, type: 'info'})} className="sr-only" />
                    معلومة
                  </label>
                  <label className={`cursor-pointer px-3 py-2 border rounded-xl flex items-center justify-center gap-2 text-sm font-bold transition-all ${newAnnounce.type === 'warning' ? 'border-amber-500 bg-amber-50 text-amber-700' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
                    <input type="radio" value="warning" checked={newAnnounce.type === 'warning'} onChange={() => setNewAnnounce({...newAnnounce, type: 'warning'})} className="sr-only" />
                    تنبيه
                  </label>
                  <label className={`cursor-pointer px-3 py-2 border rounded-xl flex items-center justify-center gap-2 text-sm font-bold transition-all ${newAnnounce.type === 'maintenance' ? 'border-red-500 bg-red-50 text-red-700' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
                    <input type="radio" value="maintenance" checked={newAnnounce.type === 'maintenance'} onChange={() => setNewAnnounce({...newAnnounce, type: 'maintenance'})} className="sr-only" />
                    صيانة
                  </label>
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-bold text-gray-700">تاريخ انتهاء الإعلان (سيختفي تلقائياً)</label>
                <input 
                  type="date" 
                  required
                  value={newAnnounce.expiresAt}
                  onChange={e => setNewAnnounce({...newAnnounce, expiresAt: e.target.value})}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl bg-gray-50 focus:bg-white outline-none focus:ring-2" 
                />
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-bold text-gray-700">نص الإعلان</label>
                <textarea 
                  required
                  value={newAnnounce.content}
                  onChange={e => setNewAnnounce({...newAnnounce, content: e.target.value})}
                  className="w-full h-32 px-4 py-3 border border-gray-200 rounded-xl bg-gray-50 focus:bg-white outline-none focus:ring-2 resize-none" 
                  placeholder="اكتب التنبيه أو الوصف للإعلان بوضوح لجميع المتاجر..."
                />
              </div>

              <div className="flex gap-3 pt-4 border-t border-gray-100">
                <button type="submit" className="flex-1 bg-bunyan-600 hover:bg-bunyan-700 text-white py-3 rounded-xl font-bold flex justify-center items-center gap-2">
                  <Send size={18} />
                  نشر لجميع المتاجر
                </button>
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-6 bg-gray-100 hover:bg-gray-200 text-gray-700 py-3 rounded-xl font-bold">
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
