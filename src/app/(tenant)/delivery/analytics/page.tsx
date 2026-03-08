// src/app/(tenant)/delivery/analytics/page.tsx
// الوظيفة: تحليلات أداء شركات التوصيل — مقارنة نسب التسليم + مرتجعات
// الجداول: courier_companies
// الصلاحية: OWNER فقط

'use client';

import { useMemo } from 'react';
import { useAuthStore } from '@/core/auth/store';
import { useDataStore } from '@/core/db/store';
import { BarChart3, TrendingUp, Award, Activity } from 'lucide-react';

export default function DeliveryAnalyticsPage() {
  const { user } = useAuthStore();
  const { couriers, getForTenant } = useDataStore();
  const tid = user?.tenantId || '';
  const myCouriers = getForTenant(couriers, tid).filter((c) => c.isActive);

  const stats = useMemo(() => myCouriers.map((c) => {
    const deliveryRate = c.totalShipments > 0 ? ((c.totalDelivered / c.totalShipments) * 100) : 0;
    const returnRate = c.totalShipments > 0 ? ((c.totalReturned / c.totalShipments) * 100) : 0;
    return { ...c, deliveryRate, returnRate };
  }).sort((a, b) => b.deliveryRate - a.deliveryRate), [myCouriers]);

  const best = stats[0];

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <BarChart3 size={24} className="text-bunyan-600" />
            تحليلات الأداء للشركات
          </h1>
          <p className="text-sm text-gray-500 mt-1">مقارنة أداء شركات التوصيل من حيث نسب التسليم والمرتجعات</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* أفضل شركة */}
        <div className="lg:col-span-1">
          {best ? (
            <div className="bg-gradient-to-br from-bunyan-600 to-bunyan-800 rounded-3xl p-6 text-white shadow-lg relative overflow-hidden flex flex-col justify-between h-full min-h-[200px]">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none" />
              <div className="absolute bottom-0 left-0 w-24 h-24 bg-bunyan-400/20 rounded-full blur-2xl -ml-5 -mb-5 pointer-events-none" />
              
              <div className="relative z-10 flex items-center gap-2 mb-4 bg-white/20 w-fit px-3 py-1.5 rounded-full">
                <Award size={18} className="text-yellow-300" />
                <span className="text-sm font-bold shadow-sm">🏆 أفضل شركة أداءً</span>
              </div>
              
              <div className="relative z-10 mt-auto">
                <p className="text-3xl font-black mb-2 tracking-tight">{best.name}</p>
                <div className="flex items-center gap-4 text-sm font-medium bg-black/20 p-3 rounded-2xl w-fit backdrop-blur-sm">
                  <span className="flex items-center gap-1.5"><TrendingUp size={16} className="text-emerald-400" /> التسليم: {best.deliveryRate.toFixed(1)}%</span>
                  <span className="text-white/30">|</span>
                  <span className="flex items-center gap-1.5"><Activity size={16} className="text-red-300" /> المرتجع: {best.returnRate.toFixed(1)}%</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-gray-50 rounded-3xl p-6 border-2 border-dashed border-gray-200 h-full flex flex-col items-center justify-center text-center">
              <Award size={32} className="text-gray-300 mb-3" />
              <p className="text-gray-500 font-bold">لا يوجد بيانات كافية لتحديد الفائز</p>
            </div>
          )}
        </div>

        {/* مخططات شريطية */}
        <div className="bg-white rounded-3xl border border-gray-100 p-6 shadow-sm lg:col-span-2">
          <h3 className="text-base font-bold text-gray-900 mb-6 flex items-center gap-2">
            <TrendingUp size={18} className="text-bunyan-600" /> 
            مؤشر الإنجاز ونسبة التسليم الناجح
          </h3>
          <div className="space-y-5">
            {stats.map((s) => (
              <div key={s.id} className="group">
                <div className="flex justify-between items-end mb-2">
                  <span className="font-bold text-gray-700 group-hover:text-bunyan-600 transition-colors">{s.name}</span>
                  <span className="font-mono font-black text-emerald-600 text-sm bg-emerald-50 px-2 py-0.5 rounded-md">{s.deliveryRate.toFixed(1)}%</span>
                </div>
                <div className="h-4 bg-gray-100 rounded-full overflow-hidden shadow-inner">
                  <div className="h-full bg-gradient-to-l from-bunyan-400 to-emerald-400 rounded-full transition-all duration-1000 ease-out" style={{ width: `${s.deliveryRate}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* جدول مقارنة الأداء */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm mt-6">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-right">
            <thead className="bg-gray-50 text-gray-500 font-medium border-b border-gray-100">
              <tr>
                <th className="px-6 py-4">اسم الشركة</th>
                <th className="px-6 py-4">إجمالي الشحنات المعالجة</th>
                <th className="px-6 py-4">معدل التسليم الناجح</th>
                <th className="px-6 py-4">معدل الإرجاع</th>
                <th className="px-6 py-4">عدد المرتجعات الفعلي</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {stats.map((s) => (
                <tr key={s.id} className="hover:bg-gray-50/70 transition-colors">
                  <td className="px-6 py-4 font-bold text-gray-900">{s.name}</td>
                  <td className="px-6 py-4 text-gray-600 font-medium">{s.totalShipments} شحنة</td>
                  <td className="px-6 py-4">
                    <span className="bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-lg font-mono font-black border border-emerald-100 shadow-sm">{s.deliveryRate.toFixed(1)}%</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="bg-red-50 text-red-700 px-2.5 py-1 rounded-lg font-mono font-bold border border-red-100 shadow-sm">{s.returnRate.toFixed(1)}%</span>
                  </td>
                  <td className="px-6 py-4 text-red-600 font-bold">{s.totalReturned} شحنة مؤكدة</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {stats.length === 0 && (
        <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-gray-200 mt-6">
          <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <BarChart3 size={28} className="text-gray-400" />
          </div>
          <p className="text-base font-bold text-gray-900 mb-1">لا توجد بيانات أداء حتى الآن</p>
          <p className="text-sm text-gray-500">قم ببدء إرسال الشحنات وتحويل حالاتها لظهور الإحصائيات.</p>
        </div>
      )}
    </div>
  );
}
