'use client';

import { useAppearanceStore, ThemeColor } from '@/core/appearance/store';
import { Palette, Type, Layout, CheckCircle2, MonitorSmartphone } from 'lucide-react';
import { useToast } from '@/shared/components/ui/Toast';

export default function AppearancePage() {
  const { themeColor, setThemeColor, fontSize, setFontSize, sidebarMode, setSidebarMode } = useAppearanceStore();
  const { showToast } = useToast();

  const colors: { id: ThemeColor; name: string; hex: string }[] = [
    { id: 'purple', name: 'البنفسجي (بنيان الافتراضي)', hex: '#4a2570' },
    { id: 'blue', name: 'الأزرق (مؤسسي)', hex: '#2563eb' },
    { id: 'emerald', name: 'الأخضر (طبيعة)', hex: '#10b981' },
    { id: 'amber', name: 'الكهرماني (فاخر)', hex: '#f59e0b' },
    { id: 'rose', name: 'الوردي الزاهي', hex: '#f43f5e' },
    { id: 'slate', name: 'الرمادي الداكن', hex: '#64748b' },
  ];

  const handleSave = () => {
    // القيم محفوظة بالفعل بفضل الـ Zustand Persist
    // نعرض رسالة تأكيد فقط
    showToast('تم حفظ إعدادات المظهر بنجاح وتطبيقها على جميع المنظومة', 'success');
  };

  return (
    <div className="space-y-6 animate-fade-in pb-10 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Palette size={24} className="text-bunyan-600" />
          تخصيص المظهر (Appearance)
        </h1>
        <p className="text-sm text-gray-500 mt-1">تخصيص الهوية البصرية، الألوان، وواجهات النظام.</p>
      </div>

      <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm space-y-8">
        {/* قسم الألوان */}
        <div>
          <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Palette size={20} className="text-gray-400" />
            اللون الرئيسي (Primary Theme)
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {colors.map(c => {
               const isActive = themeColor === c.id;
               return (
                 <button key={c.id} onClick={() => setThemeColor(c.id)}
                   className={`flex items-center gap-3 p-4 rounded-xl border transition-all text-right ${isActive ? 'border-bunyan-500 bg-bunyan-50 ring-2 ring-bunyan-500/20' : 'border-gray-200 hover:border-gray-300'}`}>
                   <div style={{ backgroundColor: c.hex }} className="w-8 h-8 rounded-full shadow-inner flex items-center justify-center text-white shrink-0">
                     {isActive && <CheckCircle2 size={16} />}
                   </div>
                   <span className={`text-sm font-bold ${isActive ? 'text-bunyan-800' : 'text-gray-700'}`}>{c.name}</span>
                 </button>
               )
            })}
          </div>
        </div>

        <div className="border-t border-gray-100 pt-8" />

        {/* قسم الخطوط */}
        <div>
          <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Type size={20} className="text-gray-400" />
            حجم الخط (Typography Size)
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {(['sm', 'base', 'lg'] as const).map(size => {
              const isActive = fontSize === size;
              const labels = { sm: 'صغير (مضغوط)', base: 'متوسط (الافتراضي)', lg: 'كبير (مريح للقراءة)' };
              return (
                <button key={size} onClick={() => setFontSize(size)}
                   className={`flex justify-center items-center py-4 rounded-xl border transition-all text-center ${isActive ? 'border-bunyan-500 bg-bunyan-50 ring-2 ring-bunyan-500/20' : 'border-gray-200 hover:border-gray-300'}`}>
                   <span className={`font-bold ${isActive ? 'text-bunyan-800' : 'text-gray-700'} ${size === 'sm' ? 'text-sm' : size === 'lg' ? 'text-lg' : 'text-base'}`}>{labels[size]}</span>
                </button>
              )
            })}
          </div>
        </div>

        <div className="border-t border-gray-100 pt-8" />

        {/* قسم واجهة العرض */}
        <div>
          <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Layout size={20} className="text-gray-400" />
            تخطيط القائمة الجانبية (Sidebar)
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
             <button onClick={() => setSidebarMode('expanded')}
               className={`flex items-center gap-4 p-4 rounded-xl border transition-all text-right ${sidebarMode === 'expanded' ? 'border-bunyan-500 bg-bunyan-50 ring-2 ring-bunyan-500/20' : 'border-gray-200 hover:border-gray-300'}`}>
               <div className={`w-12 h-12 rounded-lg flex items-center justify-center shrink-0 ${sidebarMode === 'expanded' ? 'bg-bunyan-200 text-bunyan-700' : 'bg-gray-100 text-gray-400'}`}>
                 <MonitorSmartphone size={24} />
               </div>
               <div>
                 <p className={`text-sm font-bold ${sidebarMode === 'expanded' ? 'text-bunyan-800' : 'text-gray-700'}`}>موسعة (الافتراضي)</p>
                 <p className="text-xs text-gray-500 mt-1">تظهر القائمة مع النصوص والأيقونات.</p>
               </div>
             </button>
             <button onClick={() => setSidebarMode('collapsed')}
               className={`flex items-center gap-4 p-4 rounded-xl border transition-all text-right ${sidebarMode === 'collapsed' ? 'border-bunyan-500 bg-bunyan-50 ring-2 ring-bunyan-500/20' : 'border-gray-200 hover:border-gray-300'}`}>
               <div className={`w-12 h-12 rounded-lg flex items-center justify-center shrink-0 ${sidebarMode === 'collapsed' ? 'bg-bunyan-200 text-bunyan-700' : 'bg-gray-100 text-gray-400'}`}>
                 <MonitorSmartphone size={24} />
               </div>
               <div>
                 <p className={`text-sm font-bold ${sidebarMode === 'collapsed' ? 'text-bunyan-800' : 'text-gray-700'}`}>مصغرة (أيقونات فقط)</p>
                 <p className="text-xs text-gray-500 mt-1">توفير مساحة أكبر للمحتوى وجداول البيانات.</p>
               </div>
             </button>
          </div>
        </div>

        <div className="pt-6">
          <button onClick={handleSave} className="px-6 py-3 bg-bunyan-600 text-white font-bold rounded-xl hover:bg-bunyan-700 transition-colors shadow-md">
            حفظ التغييرات
          </button>
        </div>

      </div>
    </div>
  );
}
