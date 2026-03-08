'use client';

import { useAuthStore } from '@/core/auth/store';
import { useDataStore } from '@/core/db/store';
import { formatCurrency } from '@/shared/utils/format';
import { User, Wallet, PieChart, TrendingUp, HandCoins, ArrowRightLeft } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function PartnerAccountPage() {
  const { user } = useAuthStore();
  const { partners, getForTenant, debts } = useDataStore();
  
  const tid = user?.tenantId || '';
  const myPartners = getForTenant(partners, tid);
  const myDebts = getForTenant(debts, tid);

  // البحث عن الشريك المرتبط بهذا الحساب
  const partnerData = myPartners.find(p => p.name === user?.fullName || (user?.phone && p.phone === user?.phone));

  // الديون/السحوبات الخاصة بهذا الشريك
  const myAdvances = myDebts.filter(d => 
     d.debtType === 'internal' && 
     d.debtCategory === 'partner_advance' && 
    d.linkedEntityName === partnerData?.name
  );

  // بيانات افتراضية للمخطط البياني (محاكاة العوائد)
  // في بيئة الإنتاج الفعلية سيتم استقاء هذه الأرقام من إغلاقات الأشهر وتقسيم الأرباح حسب النسبة
  const mockChartData = [
    { name: 'يناير', revenue: Math.floor(Math.random() * 5000) + 1000 },
    { name: 'فبراير', revenue: Math.floor(Math.random() * 5000) + 2000 },
    { name: 'مارس', revenue: Math.floor(Math.random() * 5000) + 3000 },
    { name: 'أبريل', revenue: Math.floor(Math.random() * 5000) + 2500 },
    { name: 'مايو', revenue: Math.floor(Math.random() * 5000) + 4000 },
    { name: 'يونيو', revenue: Math.floor(Math.random() * 5000) + 5000 },
  ];

  return (
    <div className="space-y-6 animate-fade-in pb-10 max-w-6xl mx-auto">
      <div className="flex items-center gap-4 border-b border-gray-100 pb-6 mt-4">
        <div className="w-16 h-16 bg-amber-600 text-white rounded-2xl flex items-center justify-center text-2xl font-black shadow-md">
          {user?.fullName?.charAt(0) || 'ش'}
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{user?.fullName}</h1>
          <p className="text-sm text-gray-500 mt-1 flex items-center gap-2">
            <PieChart size={16} className="text-amber-600" />
            لوحة تحكم الشريك الاستراتيجي
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* المحفظة القابلة للسحب */}
        <div className="bg-gradient-to-br from-amber-600 to-amber-800 rounded-3xl p-6 text-white shadow-lg relative overflow-hidden md:col-span-2">
          <div className="absolute top-0 left-0 w-32 h-32 bg-white/10 rounded-full blur-3xl -ml-10 -mt-10 pointer-events-none" />
          <div className="flex justify-between items-start mb-4 relative z-10">
            <div>
              <p className="text-amber-100 text-sm font-bold mb-1">الرصيد المتاح للسحب (المحفظة)</p>
              <h2 className="text-3xl font-black font-currency tracking-tight">
                  {partnerData ? formatCurrency(partnerData.walletBalance) : '—'}
              </h2>
            </div>
            <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm">
              <Wallet size={24} className="text-white" />
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-white/20 relative z-10">
            <p className="text-xs text-amber-100 flex items-center gap-1.5">
              <TrendingUp size={14} /> يتم تحديث هذا الرصيد مع كل دورة توزيع أرباح
            </p>
          </div>
        </div>

        {/* رأس المال */}
        <div className="bg-white border border-gray-100 rounded-3xl p-6 shadow-sm">
           <h3 className="text-sm font-bold text-gray-500 mb-2 flex items-center gap-2">
               <HandCoins size={16} /> إجمالي رأس المال
           </h3>
           <p className="text-2xl font-black text-gray-900 font-currency mt-2">
               {partnerData ? formatCurrency(partnerData.capitalContribution) : '—'}
           </p>
           <p className="text-xs text-gray-400 mt-2 border-t border-gray-50 pt-2">
             رأس المال المبدئي المسجل عند الانضمام
           </p>
        </div>

        {/* حصة الأرباح */}
        <div className="bg-white border border-gray-100 rounded-3xl p-6 shadow-sm flex flex-col justify-center items-center text-center">
           <div className="w-14 h-14 rounded-full border-4 border-amber-100 flex items-center justify-center mb-2">
               <span className="text-xl font-black text-amber-600 font-mono">{partnerData?.profitPercentage || 0}%</span>
           </div>
           <p className="text-sm font-bold text-gray-900">حصة الأرباح الشهرية</p>
           <p className="text-[10px] text-gray-500 mt-1">من صافي ربح المتجر</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
              {/* مخطط العوائد والأرباح */}
              <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm">
                  <h3 className="text-base font-bold text-gray-900 mb-6 flex items-center gap-2">
                      <TrendingUp size={18} className="text-amber-600" /> نمو الأرباح الموزعة (آخر 6 أشهر)
                  </h3>
                  <div className="h-64 w-full" dir="ltr">
                      <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={mockChartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                              <defs>
                                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                                      <stop offset="5%" stopColor="#d97706" stopOpacity={0.8}/>
                                      <stop offset="95%" stopColor="#d97706" stopOpacity={0}/>
                                  </linearGradient>
                              </defs>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6b7280' }} dy={10} />
                              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6b7280' }} dx={-10} tickFormatter={(value) => `${value}`} />
                              <Tooltip 
                                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontFamily: 'Cairo, sans-serif' }}
                              />
                              <Area type="monotone" dataKey="revenue" name="أرباحك (د.ل)" stroke="#d97706" strokeWidth={3} fillOpacity={1} fill="url(#colorRevenue)" />
                          </AreaChart>
                      </ResponsiveContainer>
                  </div>
              </div>
          </div>

          <div className="lg:col-span-1 space-y-6">
            <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm">
                <h3 className="text-base font-bold text-gray-900 mb-4 flex items-center gap-2">
                <ArrowRightLeft size={18} className="text-amber-600" /> سحوبات وذمم مالية
                </h3>
                <div className="divide-y divide-gray-50">
                {myAdvances.length > 0 ? myAdvances.map(adv => (
                    <div key={adv.id} className="py-4 flex items-center justify-between">
                        <div>
                            <p className="text-sm font-bold text-gray-900 leading-relaxed mb-0.5">{adv.description || 'سحبة شريك'}</p>
                            <p className="text-xs text-gray-400 font-mono">{adv.createdAt}</p>
                        </div>
                        <div className="text-left">
                            <p className="text-sm font-black text-red-600 font-currency">{formatCurrency(adv.amount)}</p>
                            <p className="text-[10px] text-gray-500 mt-1">
                                {adv.status === 'paid' ? <span className="text-emerald-600 font-bold">تمت التسوية</span> : `ذمة معلقة: ${formatCurrency(adv.amount - adv.paidAmount)}`}
                            </p>
                        </div>
                    </div>
                )) : (
                    <div className="text-center py-8">
                        <p className="text-sm text-gray-500 font-bold">لا يوجد سحوبات أو ديون مسجلة باسمك</p>
                    </div>
                )}
                </div>
            </div>
            
            <div className="bg-gray-50 rounded-3xl p-6 border border-gray-100 shadow-sm text-center">
                <User size={32} className="text-gray-400 mx-auto mb-3" />
                <h4 className="text-sm font-bold text-gray-900 mb-1">{partnerData?.phone || 'لا يوجد هاتف'}</h4>
                <p className="text-xs text-gray-500 mb-4">{user?.email}</p>
                <div className="text-[10px] bg-white px-3 py-2 rounded-lg border border-gray-200 text-gray-500">
                    كشريك في المنظومة، وصولك مقتصر على لوحة المحفظة والمراقبة المالية ولا يمكنك تغيير الإعدادات الرئيسية.
                </div>
            </div>
          </div>
      </div>
    </div>
  );
}
