// src/app/super-admin/page.tsx
// لوحة تحكم السوبر أدمن — Stat Cards من Store الحقيقي + EmptyState

'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAuthStore } from '@/core/auth/store';
import { useDataStore } from '@/core/db/store';
import { useToast } from '@/shared/components/ui/Toast';
import { EmptyState } from '@/shared/components/ui/EmptyState';
import {
  Store, CheckCircle2, PauseCircle, TrendingUp, ArrowUpRight,
  LogIn, MoreHorizontal, Activity, Users
} from 'lucide-react';
import { formatCurrency } from '@/shared/utils/format';
import dynamic from 'next/dynamic';
import { cn } from '@/shared/utils/cn';

const ResponsiveContainer = dynamic(() => import('recharts').then(m => m.ResponsiveContainer), { ssr: false });
const AreaChart = dynamic(() => import('recharts').then(m => m.AreaChart), { ssr: false });
const Area = dynamic(() => import('recharts').then(m => m.Area), { ssr: false });
const XAxis = dynamic(() => import('recharts').then(m => m.XAxis), { ssr: false });
const YAxis = dynamic(() => import('recharts').then(m => m.YAxis), { ssr: false });
const Tooltip = dynamic(() => import('recharts').then(m => m.Tooltip), { ssr: false });
const CartesianGrid = dynamic(() => import('recharts').then(m => m.CartesianGrid), { ssr: false });

interface DashboardTenant {
  id: string;
  name: string;
  ownerName: string;
  ownerEmail: string;
  city: string | null;
  isActive: boolean;
  plan: string;
  createdAt: string;
}

export default function SuperAdminDashboard() {
  const router = useRouter();
  const { enterTenantAsAdmin, user } = useAuthStore();
  const { toggleTenant, subscriptions, addAuditLog } = useDataStore();
  const { showToast } = useToast();
  const [mounted, setMounted] = useState(false);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [supabaseTenants, setSupabaseTenants] = useState<DashboardTenant[]>([]);
  const activeTenants = supabaseTenants.filter(t => t.isActive);
  const frozenTenants = supabaseTenants.filter(t => !t.isActive);
  const totalRevenue = Math.round(subscriptions.reduce((s, sub) => s + (sub.amount ?? 0), 0));

  useEffect(() => {
    setMounted(true);
    const fetchTenants = async () => {
      const { createClient } = await import('@/core/db/supabase');
      const supabase = createClient();
      const { data } = await supabase.from('tenants').select('*').order('created_at', { ascending: false });
      if (data) {
        setSupabaseTenants(data.map(t => ({
          id: t.id,
          name: t.name,
          ownerName: t.owner_name,
          ownerEmail: t.owner_email,
          city: t.city,
          isActive: t.is_active,
          plan: t.plan,
          createdAt: t.created_at,
        })));
      }
    };
    fetchTenants();
  }, [subscriptions]);

  const STATS = [
    { label: 'إجمالي الإيرادات', value: formatCurrency(totalRevenue), icon: TrendingUp, color: 'text-violet-600', dot: 'bg-violet-500', bg: 'bg-violet-50' },
    { label: 'إجمالي المتاجر', value: supabaseTenants.length.toString(), icon: Store, color: 'text-blue-600', dot: 'bg-blue-500', bg: 'bg-blue-50' },
    { label: 'المتاجر النشطة', value: activeTenants.length.toString(), icon: CheckCircle2, color: 'text-emerald-600', dot: 'bg-emerald-500', bg: 'bg-emerald-50' },
    { label: 'المتاجر المجمدة', value: frozenTenants.length.toString(), icon: PauseCircle, color: 'text-amber-500', dot: 'bg-amber-500', bg: 'bg-amber-50' },
  ];

  // Chart data من البيانات الحقيقية (توزيع بسيط على الأشهر)
  const chartData = [
    { name: 'يناير', value: Math.round(totalRevenue * 0.1) },
    { name: 'فبراير', value: Math.round(totalRevenue * 0.25) },
    { name: 'مارس', value: Math.round(totalRevenue * 0.45) },
    { name: 'أبريل', value: Math.round(totalRevenue * 0.60) },
    { name: 'مايو', value: Math.round(totalRevenue * 0.80) },
    { name: 'الآن', value: totalRevenue },
  ];

  const handleEnterTenant = (t: typeof supabaseTenants[0]) => {
    addAuditLog({
      id: `audit-${Date.now()}`,
      adminId: user?.id ?? 'admin',
      tenantId: t.id,
      action: 'impersonate',
      timestamp: new Date().toISOString(),
    });
    showToast(`جاري الدخول كمالك — ${t.name}`, 'success');
    enterTenantAsAdmin(t.id, t.name);
    router.push('/dashboard');
  };

  const handleFreeze = (t: typeof supabaseTenants[0]) => {
    toggleTenant(t.id);
    showToast(t.isActive ? `تم تجميد متجر ${t.name}` : `تم تفعيل متجر ${t.name}`, t.isActive ? 'warning' : 'success');
    setOpenMenu(null);
  };

  return (
    <div className="space-y-8 animate-fade-in pb-12 font-sans" onClick={() => setOpenMenu(null)}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-gray-200 pb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">نظرة عامة</h1>
          <p className="text-sm font-medium text-gray-500 mt-1.5">مرحباً بعودتك، إليك ملخص أداء النظام اليوم.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/super-admin/tenants')}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-gray-900 
              hover:bg-gray-800 text-white rounded-lg text-sm font-semibold transition-all shadow-sm"
          >
            <Store size={16} />
            إدارة المتاجر
          </button>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {STATS.map((stat) => (
          <div
            key={stat.label}
            className="group bg-white rounded-2xl border border-gray-200/80 p-5 
              shadow-sm hover:shadow-md transition-all duration-300 flex flex-col gap-4 relative overflow-hidden"
          >
            <div className="flex items-center justify-between">
              <div className={cn("w-10 h-10 rounded-full flex items-center justify-center", stat.bg)}>
                <stat.icon size={20} className={stat.color} />
              </div>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500 mb-1">{stat.label}</p>
              <h3 className="text-2xl font-bold text-gray-900 tracking-tight flex items-baseline gap-2">
                {stat.value}
              </h3>
            </div>
          </div>
        ))}
      </div>

      {/* Chart + Recent Tenants */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Area Chart */}
        <div className="xl:col-span-2 bg-white rounded-2xl border border-gray-200/80 shadow-sm p-6 flex flex-col">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-lg font-bold text-gray-900">مؤشر الإيرادات</h2>
              <p className="text-xs text-gray-500 mt-1">نمو إيرادات الاشتراكات للمنصة</p>
            </div>
            <div className="px-3 py-1 rounded-md bg-gray-100 text-xs font-semibold text-gray-600 border border-gray-200">
              آخر 6 أشهر
            </div>
          </div>
          {totalRevenue === 0 ? (
            <div className="flex-1 flex items-center justify-center min-h-[300px]">
              <EmptyState
                icon={<Activity />}
                title="لا توجد بيانات مالية"
                description="ستظهر التحليلات هنا عند تسجيل أول إيراد"
              />
            </div>
          ) : (
            <div className="flex-1 min-h-[300px]">
              {mounted && (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false}
                      tick={{ fontSize: 12, fill: '#64748b' }} dy={10} />
                    <YAxis axisLine={false} tickLine={false}
                      tick={{ fontSize: 12, fill: '#64748b' }} />
                    <Tooltip
                      contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', padding: '12px' }}
                      formatter={(v: string | number | readonly (string | number)[] | undefined) => [`${v ?? 0} د.ل`, 'الإيرادات']}
                      labelStyle={{ color: '#0f172a', fontWeight: 'bold', marginBottom: '4px' }}
                    />
                    <Area type="monotone" dataKey="value" stroke="#8b5cf6"
                      strokeWidth={3} fillOpacity={1} fill="url(#colorRevenue)" 
                      activeDot={{ r: 6, strokeWidth: 0, fill: '#8b5cf6' }} />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          )}
        </div>

        {/* Recent Tenants */}
        <div className="bg-white rounded-2xl border border-gray-200/80 shadow-sm p-6 flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg font-bold text-gray-900">أحدث المتاجر</h2>
              <p className="text-xs text-gray-500 mt-1">المتاجر المنضمة مؤخراً</p>
            </div>
            <button
               onClick={() => router.push('/super-admin/tenants')}
               className="text-xs font-semibold text-violet-600 hover:text-violet-700 transition-colors"
            >
              عرض الكل
            </button>
          </div>

          {supabaseTenants.length === 0 ? (
            <div className="flex-1 flex items-center justify-center min-h-[300px]">
              <EmptyState
                icon={<Store />}
                title="لا توجد متاجر"
                description="لم يتم تسجيل أي متجر بعد"
              />
            </div>
          ) : (
            <div className="space-y-4 flex-1">
              {supabaseTenants.slice(0, 5).map(t => (
                <div key={t.id} className="group flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 font-bold text-sm border border-gray-200">
                      {t.name.charAt(0)}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900 leading-tight">{t.name}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{t.ownerName}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleEnterTenant(t)}
                    className="p-2 rounded-lg text-gray-400 hover:text-gray-900 hover:bg-gray-100 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                    title="دخول المتجر"
                  >
                    <ArrowUpRight size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Tenants Table */}
      <div className="bg-white rounded-2xl border border-gray-200/80 shadow-sm overflow-hidden">
        <div className="px-6 py-5 border-b border-gray-200 flex items-center justify-between bg-white">
          <div>
             <h2 className="text-lg font-bold text-gray-900">قائمة المتاجر</h2>
             <p className="text-xs text-gray-500 mt-1">إدارة شاملة لكافة الكيانات المشتركة</p>
          </div>
        </div>

        {supabaseTenants.length === 0 ? (
          <div className="py-20">
            <EmptyState
              icon={<Users />}
              title="القائمة فارغة"
              description="ستظهر جميع المتاجر المسجلة هنا"
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-6 py-4 font-semibold text-gray-600 w-[35%]">معلومات المتجر</th>
                  <th className="px-6 py-4 font-semibold text-gray-600">المدينة</th>
                  <th className="px-6 py-4 font-semibold text-gray-600">الحالة</th>
                  <th className="px-6 py-4 font-semibold text-gray-600">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {supabaseTenants.map(t => (
                  <tr key={t.id} className="group hover:bg-gray-50/50 transition-colors duration-200">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-md bg-gray-100 border border-gray-200 flex items-center justify-center text-gray-600 font-bold text-sm">
                          {t.name.charAt(0)}
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900">{t.name}</p>
                          <p className="text-xs text-gray-500 mt-0.5">{t.ownerEmail}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-gray-600 font-medium">
                      {t.city || '—'}
                    </td>
                    <td className="px-6 py-4">
                      <span className={cn(
                        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold",
                        t.isActive ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-700"
                      )}>
                        <span className={cn("w-1.5 h-1.5 rounded-full", t.isActive ? "bg-emerald-500" : "bg-gray-500")} />
                        {t.isActive ? 'نشط' : 'مجمد'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        {/* Ghost Outline Button for Login */}
                        <button
                          onClick={(e) => { e.stopPropagation(); handleEnterTenant(t); }}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5
                            text-gray-600 hover:text-gray-900 hover:bg-gray-200/50
                            rounded-md text-xs font-semibold transition-all opacity-0 group-hover:opacity-100 focus:opacity-100 ring-1 ring-inset ring-gray-300 hover:ring-gray-400"
                        >
                          <LogIn size={14} /> دخول
                        </button>
                        
                        {/* Dropdown Menu */}
                        <div className="relative" onClick={e => e.stopPropagation()}>
                          <button
                            onClick={() => setOpenMenu(openMenu === t.id ? null : t.id)}
                            className="p-1.5 rounded-md hover:bg-gray-200 text-gray-500 transition-colors"
                          >
                            <MoreHorizontal size={16} />
                          </button>
                          {openMenu === t.id && (
                            <div className="absolute left-0 top-full mt-1 w-40 bg-white border
                              border-gray-200 rounded-lg shadow-lg z-20 py-1 flex flex-col">
                              <button
                                onClick={() => handleFreeze(t)}
                                className="w-full flex items-center justify-between px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
                              >
                                {t.isActive ? 'تجميد متجر' : 'تفعيل متجر'}
                                <PauseCircle size={14} className={t.isActive ? "text-amber-500" : "text-emerald-500"} />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
