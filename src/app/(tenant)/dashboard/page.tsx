// src/app/(tenant)/dashboard/page.tsx
// الوظيفة: لوحة القيادة — Fintech Dashboard مع AreaChart + مبيعات اليوم + أعلى المنتجات + آخر الطلبيات
// المرجع: الحسابات المالية في calculations.ts
// الصلاحية: OWNER, PARTNER, EMPLOYEE

'use client';

import { useMemo, useCallback, useState, useEffect } from 'react';

import Link from 'next/link';
import { useAuthStore } from '@/core/auth/store';
import {
  useTenantId,
  useTenantOrders,
  useTenantProducts,
  useCashBalance,
  useCourierPendingBalance,
} from '@/shared/hooks';
import {
  formatCurrency,
  formatRelativeTime,
} from '@/shared/utils/format';
import { calcMonthlySales, calcTodaySales, calcTopProducts } from '@/shared/utils/calculations';
import { StatusBadge } from '@/shared/components/ui';
import {
  Wallet,
  Truck,
  ShoppingCart,
  Clock,
  TrendingUp,
  ChevronLeft,
  AlertCircle,
  BarChart3,
  ShieldAlert,
  Sparkles,
} from 'lucide-react';
import { runFullSystemDiagnostic } from '@/core/utils/systemDiagnostics';
import { runUiUxAudit } from '@/core/utils/uiUxDiagnostics';
import { useToast } from '@/shared/components/ui/Toast';
import dynamic from 'next/dynamic';

// Lazy-load Recharts components (لا SSR)
const AreaChart = dynamic(() => import('recharts').then(m => m.AreaChart), { ssr: false });
const Area = dynamic(() => import('recharts').then(m => m.Area), { ssr: false });
const XAxis = dynamic(() => import('recharts').then(m => m.XAxis), { ssr: false });
const YAxis = dynamic(() => import('recharts').then(m => m.YAxis), { ssr: false });
const Tooltip = dynamic(() => import('recharts').then(m => m.Tooltip), { ssr: false });
const ResponsiveContainer = dynamic(() => import('recharts').then(m => m.ResponsiveContainer), { ssr: false });
const CartesianGrid = dynamic(() => import('recharts').then(m => m.CartesianGrid), { ssr: false });

export default function DashboardPage() {
  const [mounted, setMounted] = useState(false);
  const user = useAuthStore(useCallback(s => s.user, []));
  const tid = useTenantId();
  const { showToast } = useToast();
  const [isDiagnosing, setIsDiagnosing] = useState(false);
  const [isAuditing, setIsAuditing] = useState(false);

  useEffect(() => {
    setMounted(true);
    console.log('📱 Dashboard Mounted - User:', user?.email);
  }, [user]);

  // ═══ بيانات مُحسَّنة بـ selectors (لا يُعاد render إلا عند تغيير البيانات المعنية) ═══
  const myOrders = useTenantOrders();
  const myProducts = useTenantProducts();
  const cashBalance = useCashBalance();
  const courierPending = useCourierPendingBalance();

  const handleRunDiagnostic = async () => {
    if (!tid) return;
    setIsDiagnosing(true);
    try {
      showToast('بدء الفحص الآلي للمتجر. يرجى مراقبة Console...', 'success');
      const report = await runFullSystemDiagnostic(tid);
      const passed = report.summary.failed === 0;
      const score = report.summary.healthScore;
      const msg = passed
        ? `✅ Health Score: ${score}/100 — ${report.summary.passed}/${report.summary.total} اختبار ناجح`
        : `⚠️ Health Score: ${score}/100 — ${report.summary.failed} فشل من ${report.summary.total} — راجع Console`;
      showToast(msg, passed ? 'success' : 'error');
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'حدث خطأ أثناء الفحص الآلي', 'error');
    } finally {
      setIsDiagnosing(false);
    }
  };

  const handleRunUiAudit = async () => {
    setIsAuditing(true);
    try {
      showToast('جاري فحص تناسق التصميم وتجربة المستخدم (UI/UX)...', 'success');
      const report = await runUiUxAudit();
      const score = report.summary.score;
      const grade = report.summary.grade;
      const msg = `🎨 تقييم التصميم: ${score}/100 — الدرجة: ${grade} | راجع Console للتفاصيل`;
      showToast(msg, score > 80 ? 'success' : 'warning');
    } catch {
      showToast('حدث خطأ أثناء فحص التصميم', 'error');
    } finally {
      setIsAuditing(false);
    }
  };

  // ═══ الحسابات المالية (مُذكّرة) ═══
  const todaySales = useMemo(() => calcTodaySales(myOrders), [myOrders]);
  const pendingOrdersCount = useMemo(
    () => myOrders.filter(o => o.status === 'pending').length,
    [myOrders]
  );
  const monthlySalesData = useMemo(() => calcMonthlySales(myOrders), [myOrders]);
  const topProducts = useMemo(() => calcTopProducts(myOrders), [myOrders]);

  // آخر 5 طلبيات
  const recentOrders = useMemo(() => {
    if (!Array.isArray(myOrders)) return [];
    return [...myOrders]
      .filter(o => o && o.createdAt) // تأكد من وجود التاريخ
      .sort((a, b) => {
        const timeA = new Date(a.createdAt).getTime();
        const timeB = new Date(b.createdAt).getTime();
        return (isNaN(timeB) ? 0 : timeB) - (isNaN(timeA) ? 0 : timeA);
      })
      .slice(0, 5);
  }, [myOrders]);

  // نواقص المخزون
  const lowStockCount = useMemo(
    () => myProducts.filter(p => p.quantity > 0 && p.quantity <= p.minQuantity).length,
    [myProducts]
  );

  // تحية مع التاريخ
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'صباح الخير';
    if (hour < 17) return 'مساء الخير';
    return 'مساء الخير';
  }, []);

  const todayFormatted = useMemo(() => {
    return new Date().toLocaleDateString('ar-LY', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  }, []);

  // ═══ بطاقات الإحصاءات ═══
  const stats = [
    {
      label: 'مبيعات اليوم',
      value: todaySales,
      icon: TrendingUp,
      colorBg: 'bg-emerald-50',
      colorIcon: 'text-emerald-600',
    },
    {
      label: 'الخزينة النقدية',
      value: cashBalance,
      icon: Wallet,
      colorBg: 'bg-purple-50',
      colorIcon: 'text-purple-600',
    },
    {
      label: 'طلبيات معلقة',
      value: pendingOrdersCount,
      icon: Clock,
      colorBg: 'bg-amber-50',
      colorIcon: 'text-amber-600',
      isCurrency: false,
    },
    {
      label: 'قيد التحصيل',
      value: courierPending,
      icon: Truck,
      colorBg: 'bg-blue-50',
      colorIcon: 'text-blue-600',
    },
  ];

  if (!mounted) return null; // منع الـ rendering قبل التحميل الكامل للمتصفح

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      {/* رأس الصفحة — تحية + تنبيه النواقص */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900 flex items-center gap-2">
            {greeting}، {user?.fullName?.split(' ')[0] || 'المستخدم'}
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">{todayFormatted}</p>
        </div>
        <div className="flex items-center gap-3">
          {user?.role === 'owner' && (
            <button
              onClick={handleRunDiagnostic}
              disabled={isDiagnosing}
              aria-label="تشغيل فحص صحة النظام"
              className="flex items-center gap-2 px-4 py-2 bg-red-50 border border-red-200
                rounded-xl text-red-700 text-sm hover:bg-red-100 transition-all font-bold disabled:opacity-50 shadow-sm"
            >
              <ShieldAlert className="w-4 h-4" />
              <span>{isDiagnosing ? 'جاري الفحص...' : 'فحص صحة النظام'}</span>
            </button>
          )}
          {user?.role === 'owner' && (
            <button
              onClick={handleRunUiAudit}
              disabled={isAuditing}
              aria-label="تشغيل فحص جودة التصميم"
              className="flex items-center gap-2 px-4 py-2 bg-indigo-50 border border-indigo-200
                rounded-xl text-indigo-700 text-sm hover:bg-indigo-100 transition-all font-bold disabled:opacity-50 shadow-sm"
            >
              <Sparkles className="w-4 h-4" />
              <span>{isAuditing ? 'جاري التدقيق...' : 'فحص جودة التصميم'}</span>
            </button>
          )}
          {lowStockCount > 0 && (
            <Link
              href="/inventory"
              aria-label="عرض المنتجات التي تنفد من المخزون"
              className="flex items-center gap-2 px-4 py-2 bg-amber-50 border border-amber-200
                rounded-xl text-amber-700 text-sm hover:bg-amber-100 transition-colors font-medium"
            >
              <AlertCircle className="w-4 h-4" />
              <span>{lowStockCount} أصناف تنفد من المخزون</span>
              <ChevronLeft className="w-4 h-4 text-amber-500" />
            </Link>
          )}
        </div>
      </div>

      {/* 4 بطاقات إحصاءات */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(s => (
          <div
            key={s.label}
            className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6
              hover:shadow-md transition-all duration-200"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-500">{s.label}</p>
                <p className="text-3xl font-black text-gray-900 mt-1 tracking-tight">
                  {s.isCurrency === false
                    ? s.value.toLocaleString('ar-LY')
                    : formatCurrency(s.value)}
                </p>
              </div>
              <div className={`w-12 h-12 rounded-xl ${s.colorBg} flex items-center justify-center flex-shrink-0`}>
                <s.icon className={`w-6 h-6 ${s.colorIcon}`} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* المنطقة الرئيسية: مخطط المبيعات + أعلى المنتجات */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* مخطط مبيعات 30 يوم — AreaChart مع Gradient */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
              <div className="w-2 h-6 bg-bunyan-500 rounded-full" />
              تطور المبيعات (آخر 30 يوم)
            </h2>
          </div>
          <div style={{ width: '100%', height: 280 }}>
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={monthlySalesData} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#7c3aed" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#7c3aed" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 10, fill: '#9ca3af' }}
                  axisLine={false}
                  tickLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tick={{ fontSize: 11, fill: '#9ca3af' }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v: number) => formatCurrency(v)}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: '12px',
                    border: '1px solid #e5e7eb',
                    boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
                    fontSize: 12,
                    fontFamily: 'Cairo',
                    direction: 'rtl',
                  }}
                  formatter={(v) =>
                    v != null ? [formatCurrency(Number(v)), 'المبيعات'] : ['0', '']
                  }
                />
                <Area
                  type="monotone"
                  dataKey="sales"
                  stroke="#7c3aed"
                  strokeWidth={2.5}
                  fill="url(#salesGrad)"
                  dot={false}
                  activeDot={{ r: 5, fill: '#7c3aed' }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* أعلى 5 منتجات مبيعاً */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
          <h2 className="text-base font-bold text-gray-900 mb-5 flex items-center gap-2">
            <div className="w-2 h-6 bg-bunyan-500 rounded-full" />
            أعلى المنتجات مبيعاً
          </h2>
          {topProducts.length > 0 ? (
            <div className="space-y-4">
              {topProducts.map((p, i) => (
                <div key={p.id} className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-bunyan-50 flex items-center justify-center
                    flex-shrink-0 text-sm font-black text-bunyan-600">
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{p.name}</p>
                    <p className="text-xs text-gray-500">{p.qty} قطعة مباعة</p>
                  </div>
                  <p className="text-sm font-bold text-gray-900 flex-shrink-0">
                    {formatCurrency(p.revenue)}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-10">
              <div className="w-14 h-14 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-3">
                <BarChart3 className="w-6 h-6 text-gray-400" />
              </div>
              <p className="text-sm text-gray-500">
                لا توجد مبيعات بعد
              </p>
            </div>
          )}
        </div>
      </div>

      {/* آخر 5 طلبيات */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
            <div className="w-2 h-6 bg-bunyan-500 rounded-full" />
            آخر الطلبيات
          </h2>
          <Link
            href="/orders"
            aria-label="عرض جميع الطلبيات"
            className="text-sm font-semibold text-bunyan-600 hover:text-bunyan-700
              flex items-center gap-1 transition-colors"
          >
            عرض الكل
            <ChevronLeft className="w-4 h-4" />
          </Link>
        </div>

        {recentOrders.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-right">
              <thead className="bg-gray-50 text-gray-500 font-medium border-b border-gray-100">
                <tr>
                  <th className="px-6 py-3">رقم الطلبية</th>
                  <th className="px-6 py-3">الزبون</th>
                  <th className="px-6 py-3">المدينة</th>
                  <th className="px-6 py-3">الإجمالي</th>
                  <th className="px-6 py-3">الحالة</th>
                  <th className="px-6 py-3">الوقت</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {recentOrders.map(order => {
                  return (
                    <tr key={order.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <span className="font-mono font-bold text-bunyan-700 text-sm tracking-wide">
                          #{order.orderNumber}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-gray-700 font-medium">
                        {order.customerName}
                      </td>
                      <td className="px-6 py-4 text-gray-500">
                        {order.customerCity}
                      </td>
                      <td className="px-6 py-4 font-bold text-gray-900">
                        {formatCurrency(order.total)}
                      </td>
                      <td className="px-6 py-4">
                        <StatusBadge
                          status={order.status as 'pending' | 'processing' | 'delivered' | 'cancelled' | 'with_courier' | 'pending_return' | 'return_confirmed'}
                        />
                      </td>
                      <td className="px-6 py-4 text-gray-500 text-xs">
                        {formatRelativeTime(order.createdAt)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-3">
              <ShoppingCart className="w-6 h-6 text-gray-400" />
            </div>
            <p className="text-base font-semibold text-gray-700 mb-1">
              لا توجد طلبيات بعد
            </p>
            <p className="text-sm text-gray-500">
              عندما يقوم الزبائن بالطلب، ستظهر هنا.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
