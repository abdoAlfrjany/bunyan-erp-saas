'use client';

import { useRulesStore } from '@/core/settings/rules.store';
import { Settings2, ShieldAlert, Calculator, RotateCcw } from 'lucide-react';
import { useToast } from '@/shared/components/ui/Toast';

export default function LogicRulesPage() {
  const { rules, updateRules, resetRules } = useRulesStore();
  const { showToast } = useToast();

  const handleToggle = (key: keyof typeof rules) => {
    updateRules({ [key]: !rules[key] } as Partial<typeof rules>);
    showToast('تم تحديث القاعدة المنطقية بنجاح', 'success');
  };

  const handleReset = () => {
    if(confirm('هل أنت متأكد من استعادة القواعد الافتراضية الصارمة؟')) {
        resetRules();
        showToast('تمت استعادة القواعد الافتراضية للنظام', 'success');
    }
  };

  return (
    <div className="space-y-6 animate-fade-in pb-10 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Settings2 size={24} className="text-bunyan-600" />
            تخصيص القواعد المنطقية (Business Logic)
          </h1>
          <p className="text-sm text-gray-500 mt-1">التحكم في السلوكيات البرمجية للمنظومة دون الحاجة لتعديل الكود (No-Code Rules).</p>
        </div>
        <button onClick={handleReset} 
          className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-xl text-sm font-bold hover:bg-gray-200 transition-colors shadow-sm">
          <RotateCcw size={18} /> استعادة الافتراضي
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
        {/* قواعد الخزينة والمحاسبة */}
        <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm space-y-6">
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2 border-b border-gray-100 pb-3">
            <Calculator size={20} className="text-amber-500" />
            المالية والمحاسبة
          </h2>
          
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-bold text-gray-900 mb-1">السماح بالأرصدة السالبة في الخزينة</p>
              <p className="text-xs text-gray-500 leading-relaxed md:w-3/4">
                في حال التفعيل، يمكن تسجيل سحوبات تتجاوز الرصيد الفعلي للخزينة. يفيد إذا كانت بعض الحسابات تسجل آجلًا.
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-1">
              <input type="checkbox" className="sr-only peer" checked={rules.allowNegativeTreasury} onChange={() => handleToggle('allowNegativeTreasury')} />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:right-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-bunyan-500"></div>
            </label>
          </div>

          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-bold text-gray-900 mb-1">إلزام التسوية مع شركات التوصيل</p>
              <p className="text-xs text-gray-500 leading-relaxed md:w-3/4">
                تفعيل هذا الخيار يمنع تسليم مبالغ الشحنات مباشرة للخزينة ويشترط مرورها بـ (محفظة قيد التحصيل) ثم عمل تسوية رسمية.
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-1">
              <input type="checkbox" className="sr-only peer" checked={rules.requireCourierSettlement} onChange={() => handleToggle('requireCourierSettlement')} />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:right-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-bunyan-500"></div>
            </label>
          </div>
        </div>

        {/* الحماية والبيانات */}
        <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm space-y-6">
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2 border-b border-gray-100 pb-3">
            <ShieldAlert size={20} className="text-red-500" />
            حماية الكيانات الهامة
          </h2>
          
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-bold text-gray-900 mb-1">السماح بحذف کیانات ذات ارتباطات مالية</p>
              <p className="text-xs text-red-600/80 font-bold leading-relaxed md:w-3/4">
                (خطر): يتيح للمالك حذف موظفين عليهم سلف، أو شركاء لهم محافظ نشطة. يؤدي لظهور سجلات ديون يتيمة (Orphans).
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-1">
              <input type="checkbox" className="sr-only peer" checked={rules.allowDeleteActiveActors} onChange={() => handleToggle('allowDeleteActiveActors')} />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:right-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-500"></div>
            </label>
          </div>
        </div>


      </div>
    </div>
  );
}
