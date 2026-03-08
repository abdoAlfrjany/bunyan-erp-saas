'use client';

import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/core/auth/store';
import { useDataStore } from '@/core/db/store';
import { Store, CheckCircle2, TrendingUp, Eye, Power, PowerOff, XCircle, ArrowUpRight, CalendarDays } from 'lucide-react';
import dynamic from 'next/dynamic';
import { useState, useEffect } from 'react';
import { useToast } from '@/shared/components/ui/Toast';

const ResponsiveContainer = dynamic(() => import('recharts').then(mod => mod.ResponsiveContainer), { ssr: false });
const AreaChart = dynamic(() => import('recharts').then(mod => mod.AreaChart), { ssr: false });
const Area = dynamic(() => import('recharts').then(mod => mod.Area), { ssr: false });
const XAxis = dynamic(() => import('recharts').then(mod => mod.XAxis), { ssr: false });
const YAxis = dynamic(() => import('recharts').then(mod => mod.YAxis), { ssr: false });
const Tooltip = dynamic(() => import('recharts').then(mod => mod.Tooltip), { ssr: false });
const CartesianGrid = dynamic(() => import('recharts').then(mod => mod.CartesianGrid), { ssr: false });

const PLAN_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  trial: { label: 'تجريبية مجانية', color: 'text-gray-700', bg: 'bg-gray-100' },
  basic: { label: 'أساسي', color: 'text-blue-700', bg: 'bg-blue-50' },
  pro: { label: 'احترافي', color: 'text-bunyan-700', bg: 'bg-bunyan-50' },
  lifetime: { label: 'تجريبية مجانية', color: 'text-emerald-700', bg: 'bg-emerald-50' }, // According to request, show 'تجريبية مجانية' for all
};

export default function SuperAdminDashboard() {
  const router = useRouter();
  const { enterTenantAsAdmin, user } = useAuthStore();
  const { tenants, toggleTenant, subscriptions, addAuditLog } = useDataStore();
  const { showToast } = useToast();
  const [mounted, setMounted] = useState(false);
  const [period, setPeriod] = useState<'this_month' | 'last_month' | 'this_year'>('this_month');

  useEffect(() => {
    setMounted(true);
  }, []);

  const activeTenants = tenants.filter((t) => t.isActive).length;
  const inactiveTenants = tenants.filter((t) => !t.isActive).length;

  const now = new Date();
  
  const isDateInPeriod = (dateString: string, p: typeof period) => {
    const d = new Date(dateString);
    if (p === 'this_month') {
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    } else if (p === 'last_month') {
      let lm = now.getMonth() - 1;
      let ly = now.getFullYear();
      if (lm < 0) { lm = 11; ly--; }
      return d.getMonth() === lm && d.getFullYear() === ly;
    } else {
      return d.getFullYear() === now.getFullYear();
    }
  };

  // يتم حساب الإيرادات المتكررة بناءً على حالة التجديد ودورة الاشتراك والنشاط في الفترة المحددة
  const periodSubscriptions = subscriptions.filter(s => {
    if (s.status !== 'paid') return false;
    const fromDate = new Date(s.periodFrom || new Date().toISOString());
    const toDate = new Date(s.periodTo || new Date().toISOString());
    const d = new Date();
    
    if (period === 'this_month') {
      return (fromDate.getFullYear() < d.getFullYear() || (fromDate.getFullYear() === d.getFullYear() && fromDate.getMonth() <= d.getMonth())) &&
             (toDate.getFullYear() > d.getFullYear() || (toDate.getFullYear() === d.getFullYear() && toDate.getMonth() >= d.getMonth()));
    } else if (period === 'last_month') {
      let lm = d.getMonth() - 1;
      let ly = d.getFullYear();
      if (lm < 0) { lm = 11; ly--; }
      return (fromDate.getFullYear() < ly || (fromDate.getFullYear() === ly && fromDate.getMonth() <= lm)) &&
             (toDate.getFullYear() > ly || (toDate.getFullYear() === ly && toDate.getMonth() >= lm));
    } else {
      return fromDate.getFullYear() <= d.getFullYear() && toDate.getFullYear() >= d.getFullYear();
    }
  });

  const mrr = periodSubscriptions.reduce((sum, s) => sum + s.amount, 0);

  const getChartData = () => {
    if (period === 'this_month') {
      return [
        { name: 'الأسبوع 1', value: mrr * 0.2 },
        { name: 'الأسبوع 2', value: mrr * 0.4 },
        { name: 'الأسبوع 3', value: mrr * 0.7 },
        { name: 'الأسبوع 4', value: mrr },
      ];
    } else if (period === 'last_month') {
      return [
        { name: 'الأسبوع 1', value: mrr * 0.3 },
        { name: 'الأسبوع 2', value: mrr * 0.5 },
        { name: 'الأسبوع 3', value: mrr * 0.8 },
        { name: 'الأسبوع 4', value: mrr },
      ];
    } else {
      return [
        { name: 'يناير', value: mrr * 0.1 },
        { name: 'فبراير', value: mrr * 0.3 },
        { name: 'مارس', value: mrr * 0.5 },
        { name: 'أبريل', value: mrr * 0.7 },
        { name: 'مايو', value: mrr * 0.8 },
        { name: 'إلى الآن', value: mrr },
      ];
    }
  };

  const chartData = getChartData();

  const handleEnterTenant = (t: typeof tenants[0]) => {
    // تسجيل الحدث في السجلات
    addAuditLog({
      id: `audit-${Date.now()}`,
      adminId: user?.id || 'admin',
      tenantId: t.id,
      action: 'impersonate',
      timestamp: new Date().toISOString()
    });
    
    showToast(`تم تسجيل الدخول بصلاحية المالك للمتجر: ${t.name}`, 'success');
    enterTenantAsAdmin(t.id, t.name);
    router.push('/dashboard');
  };

  const stats = [
    { label: 'المتاجر النشطة اليوم', value: activeTenants, icon: CheckCircle2, color: 'text-emerald-500', bg: 'bg-emerald-50' },
    { label: 'المتاجر المجمدة', value: inactiveTenants, icon: XCircle, color: 'text-red-500', bg: 'bg-red-50' },
    { label: 'إجمالي المتاجر', value: tenants.length, icon: Store, color: 'text-blue-500', bg: 'bg-blue-50' },
    { label: period === 'this_month' ? 'إجمالي الإيرادات هذا الشهر' : period === 'last_month' ? 'إجمالي إيرادات الشهر الماضي' : 'إجمالي الإيرادات هذا العام', value: `${mrr.toLocaleString()} د.ل`, icon: TrendingUp, color: 'text-bunyan-500', bg: 'bg-bunyan-50' },
  ];

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-gray-900">نظرة عامة على النظام</h1>
          <p className="text-sm text-gray-500 mt-1">مرحباً بك، إليك ملخص أداء المتاجر والاشتراكات.</p>
        </div>
        <button onClick={() => router.push('/super-admin/tenants')} className="px-4 py-2 bg-gray-900 hover:bg-gray-800 text-white rounded-xl text-sm font-bold transition-all flex items-center gap-2 shadow-sm">
          <span>إدارة المتاجر</span>
          <ArrowUpRight size={16} />
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s) => (
          <div key={s.label} className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm relative overflow-hidden group">
            <div className="flex items-center justify-between relative z-10">
              <div>
                <p className="text-sm font-semibold text-gray-500 mb-1">{s.label}</p>
                <p className="text-2xl font-black text-gray-900">{s.value}</p>
              </div>
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${s.bg}`}>
                <s.icon size={22} className={s.color} />
              </div>
            </div>
            <div className={`absolute -bottom-4 -right-4 w-24 h-24 rounded-full ${s.bg} opacity-50 group-hover:scale-150 transition-transform duration-500 ease-out`} />
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-3">
            <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
              <div className="w-2 h-6 bg-bunyan-500 rounded-full" />
              نمو الإيرادات
            </h2>
            <div className="flex items-center gap-2 bg-gray-50 px-2 py-1 rounded-xl border border-gray-200">
              <CalendarDays size={16} className="text-gray-400" />
              <select value={period} onChange={(e) => setPeriod(e.target.value as any)} className="bg-transparent border-none text-sm font-bold text-gray-700 py-1 outline-none cursor-pointer">
                <option value="this_month">هذا الشهر</option>
                <option value="last_month">الشهر الماضي</option>
                <option value="this_year">هذا العام</option>
              </select>
            </div>
          </div>
          <div className="h-72 w-full">
            {mounted && (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#4a2570" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#4a2570" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#6B7280' }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#6B7280' }} />
                  <Tooltip 
                    contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}
                    formatter={(value: any) => [`${value} د.ل`, 'الإيرادات']}
                  />
                  <Area type="monotone" dataKey="value" stroke="#4a2570" strokeWidth={3} fillOpacity={1} fill="url(#colorValue)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex flex-col">
          <h2 className="text-base font-bold text-gray-900 flex items-center gap-2 mb-6">
            <div className="w-2 h-6 bg-blue-500 rounded-full" />
            أحدث المتاجر
          </h2>
          <div className="space-y-4 flex-1">
            {tenants.slice(0, 5).map((t) => (
              <div key={t.id} className="flex items-center justify-between p-3 rounded-xl border border-gray-100 hover:bg-gray-50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center font-bold text-gray-700">
                    {t.name.charAt(0)}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-900">{t.name}</p>
                    <p className="text-xs text-gray-500">{t.ownerName}</p>
                  </div>
                </div>
                <button onClick={() => handleEnterTenant(t)} className="w-8 h-8 flex items-center justify-center rounded-lg bg-bunyan-50 text-bunyan-600 hover:bg-bunyan-100 transition-colors" title="دخول كمالك المتجر">
                  <Eye size={16} />
                </button>
              </div>
            ))}
          </div>
          <button onClick={() => router.push('/super-admin/tenants')} className="w-full mt-4 py-2.5 rounded-xl border-2 border-dashed border-gray-200 text-gray-500 font-semibold text-sm hover:border-gray-300 hover:text-gray-700 transition-colors">
            عرض كل المتاجر
          </button>
        </div>
      </div>

      {/* Main Tenant Table Preview */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-6 py-5 border-b border-gray-100 flex justify-between items-center">
          <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
            <div className="w-2 h-6 bg-emerald-500 rounded-full" />
            جدول المتاجر
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-right">
            <thead>
              <tr className="bg-gray-50/50 border-b border-gray-100 text-xs text-gray-500">
                <th className="px-6 py-4 font-semibold w-1/4">المتجر / المالك</th>
                <th className="px-6 py-4 font-semibold w-1/5">الباقة</th>
                <th className="px-6 py-4 font-semibold w-1/5">المدينة</th>
                <th className="px-6 py-4 font-semibold w-1/5">الحالة</th>
                <th className="px-6 py-4 font-semibold w-24">إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {tenants.map((t) => {
                // إزالة القيمة الصلبة وعرض الباقة الحقيقية
                const plan = PLAN_LABELS[t.plan || 'trial'] || PLAN_LABELS.trial;
                return (
                  <tr key={t.id} className="border-b border-gray-50 hover:bg-gray-50/80 transition-colors">
                    <td className="px-6 py-4">
                      <p className="text-sm font-bold text-gray-900 mb-0.5">{t.name}</p>
                      <p className="text-xs text-gray-500">{t.ownerEmail}</p>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex px-2.5 py-1 rounded-md text-xs font-bold ${plan.bg} ${plan.color}`}>
                        {plan.label}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm text-gray-600">{t.city}</p>
                    </td>
                    <td className="px-6 py-4">
                      {t.isActive ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-md text-xs font-bold">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> نشط
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-red-50 text-red-700 rounded-md text-xs font-bold">
                          <span className="w-1.5 h-1.5 rounded-full bg-red-500" /> مجمد
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <button onClick={() => toggleTenant(t.id)} className={`px-2 py-1.5 rounded-lg flex items-center justify-center transition-colors text-xs font-bold ${t.isActive ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'}`} title={t.isActive ? 'تجميد المتجر' : 'تفعيل'}>
                          {t.isActive ? <PowerOff size={14} className="ml-1" /> : <Power size={14} className="ml-1" />}
                          {t.isActive ? 'تجميد' : 'تفعيل'}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
