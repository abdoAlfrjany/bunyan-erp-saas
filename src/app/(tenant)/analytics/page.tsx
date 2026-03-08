'use client';

import { useState, useMemo } from 'react';
import { useAuthStore } from '@/core/auth/store';
import { useDataStore } from '@/core/db/store';
import { formatCurrency, formatDate } from '@/shared/utils/format';
import { BarChart3, TrendingUp, ShoppingCart, Package, DollarSign, Award, Truck, XCircle, Clock, CalendarDays, AlertTriangle, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import type { Order } from '@/core/types';

export default function AnalyticsPage() {
  const { user } = useAuthStore();
  const { orders, products, getForTenant } = useDataStore();
  const tid = user?.tenantId || '';
  const myOrders = getForTenant(orders, tid);
  const myProducts = getForTenant(products, tid);

  const [period, setPeriod] = useState<'today' | 'this_week' | 'this_month' | 'last_month' | 'last_3_months' | 'this_year' | 'custom'>('this_month');
  const [customRange, setCustomRange] = useState({ start: '', end: '' });

  const canViewProfit = user?.role === 'owner' || user?.permissions?.analytics?.viewFull;

  // --- Date Filtering Logic ---
  const getFilterDates = (p: typeof period, custom?: { start: string, end: string }) => {
    const now = new Date();
    // استخدام Date.UTC لتوحيد المنطقة الزمنية (Timezone) ومنع التضارب
    const today = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
    let start = new Date(today);
    let end = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999));
    
    let prevStart = new Date(start);
    let prevEnd = new Date(end);

    switch (p) {
      case 'today':
        prevStart.setUTCDate(prevStart.getUTCDate() - 1);
        prevEnd.setUTCDate(prevEnd.getUTCDate() - 1);
        break;
      case 'this_week':
        start.setUTCDate(today.getUTCDate() - today.getUTCDay()); 
        prevStart = new Date(start); prevStart.setUTCDate(prevStart.getUTCDate() - 7);
        prevEnd = new Date(end); prevEnd.setUTCDate(prevEnd.getUTCDate() - 7);
        break;
      case 'this_month':
        start.setUTCDate(1);
        prevStart = new Date(start); prevStart.setUTCMonth(prevStart.getUTCMonth() - 1);
        prevEnd = new Date(start); prevEnd.setUTCDate(0);
        break;
      case 'last_month':
        start.setUTCMonth(start.getUTCMonth() - 1); start.setUTCDate(1);
        end = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 0, 23, 59, 59, 999));
        prevStart = new Date(start); prevStart.setUTCMonth(prevStart.getUTCMonth() - 1);
        prevEnd = new Date(start); prevEnd.setUTCDate(0);
        break;
      case 'last_3_months':
        start.setUTCMonth(start.getUTCMonth() - 3); start.setUTCDate(1);
        prevStart = new Date(start); prevStart.setUTCMonth(prevStart.getUTCMonth() - 3);
        prevEnd = new Date(start); prevEnd.setUTCDate(0);
        break;
      case 'this_year':
        start.setUTCMonth(0); start.setUTCDate(1);
        prevStart = new Date(start); prevStart.setUTCFullYear(prevStart.getUTCFullYear() - 1);
        prevEnd = new Date(start); prevEnd.setUTCDate(0);
        break;
      case 'custom':
        if (custom?.start) start = new Date(custom.start + 'T00:00:00Z');
        if (custom?.end) end = new Date(custom.end + 'T23:59:59Z');
        const diffTime = Math.abs(end.getTime() - start.getTime());
        prevStart = new Date(start.getTime() - diffTime);
        prevEnd = new Date(start.getTime() - 1);
        break;
    }
    return { start, end, prevStart, prevEnd };
  };

  const { start, end, prevStart, prevEnd } = getFilterDates(period, customRange);

  const filterOrdersByDate = (ordersList: Order[], s: Date, e: Date) => {
    return ordersList.filter(o => {
      const d = new Date(o.createdAt);
      return d >= s && d <= e;
    });
  };

  const currentOrders = filterOrdersByDate(myOrders, start, end);
  const previousOrders = filterOrdersByDate(myOrders, prevStart, prevEnd);

  // --- KPI Calculations ---
  const calcMetrics = (ordersList: Order[]) => {
    const delivered = ordersList.filter((o) => o.status === 'delivered');
    const revenue = delivered.reduce((s, o) => s + o.total, 0);
    const cogs = delivered.reduce((s, o) => s + o.items.reduce((is, it) => is + it.unitCost * it.quantity, 0), 0);
    const profit = revenue - cogs;
    const avgOrder = delivered.length > 0 ? revenue / delivered.length : 0;
    const profitMargin = revenue > 0 ? (profit / revenue) * 100 : 0;
    
    // معدل الإرجاع
    const returnedCount = ordersList.filter((o) => o.status === 'pending_return' || o.status === 'return_confirmed').length;
    const returnRate = ordersList.length > 0 ? (returnedCount / ordersList.length) * 100 : 0;

    return { deliveredCount: delivered.length, totalOrders: ordersList.length, revenue, cogs, profit, avgOrder, profitMargin, returnRate, returnedCount };
  };

  const currentMetrics = calcMetrics(currentOrders);
  const prevMetrics = calcMetrics(previousOrders);

  // Helper for trend calculation
  const getTrend = (current: number, prev: number) => {
    if (prev === 0) return current > 0 ? { value: 100, isUp: true } : { value: 0, isUp: true };
    const diff = current - prev;
    const percent = (Math.abs(diff) / prev) * 100;
    return { value: percent, isUp: diff >= 0 };
  };

  // Top products by frequency (current period)
  const productFreq: Record<string, { id: string, name: string; count: number; revenue: number }> = {};
  currentOrders.filter(o => o.status === 'delivered').forEach((o) => {
    o.items.forEach((it) => {
      if (!productFreq[it.productId]) productFreq[it.productId] = { id: it.productId, name: it.productName, count: 0, revenue: 0 };
      productFreq[it.productId].count += it.quantity;
      productFreq[it.productId].revenue += it.total;
    });
  });
  const topProducts = Object.values(productFreq).sort((a, b) => b.revenue - a.revenue).slice(0, 5);

  const stats = [
    { label: 'إجمالي المبيعات المحققة', value: currentMetrics.revenue, format: formatCurrency, icon: DollarSign, color: 'text-bunyan-600', bg: 'bg-bunyan-50', trend: getTrend(currentMetrics.revenue, prevMetrics.revenue) },
    ...(canViewProfit ? [{ label: 'صافي الأرباح', value: currentMetrics.profit, format: formatCurrency, icon: TrendingUp, color: 'text-emerald-600', bg: 'bg-emerald-50', trend: getTrend(currentMetrics.profit, prevMetrics.profit) }] : []),
    { label: 'الطلبيات المسلّمة بنجاح', value: currentMetrics.deliveredCount, format: String, icon: ShoppingCart, color: 'text-blue-600', bg: 'bg-blue-50', trend: getTrend(currentMetrics.deliveredCount, prevMetrics.deliveredCount) },
    { label: 'متوسط قيمة الطلبية AOV', value: currentMetrics.avgOrder, format: formatCurrency, icon: BarChart3, color: 'text-purple-600', bg: 'bg-purple-50', trend: getTrend(currentMetrics.avgOrder, prevMetrics.avgOrder) },
  ];

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 rounded-3xl border border-gray-100 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <BarChart3 size={24} className="text-bunyan-600" />
            تحليلات المبيعات والأداء
          </h1>
          <p className="text-sm text-gray-500 mt-1">نظرة شاملة على مبيعات متجرك والأصناف الأكثر طلباً</p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-3 items-center bg-gray-50 p-2 rounded-2xl border border-gray-200">
           <div className="flex items-center gap-2 px-2">
             <CalendarDays size={16} className="text-gray-400" />
             <span className="text-xs font-bold text-gray-600">الفترة:</span>
           </div>
           <select value={period} onChange={(e) => setPeriod(e.target.value as any)} 
             className="px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-bunyan-500/30 transition-colors shadow-sm">
             <option value="today">اليوم</option>
             <option value="this_week">هذا الأسبوع</option>
             <option value="this_month">هذا الشهر</option>
             <option value="last_month">الشهر الماضي</option>
             <option value="last_3_months">آخر 3 أشهر</option>
             <option value="this_year">هذا العام</option>
             <option value="custom">مخصص (من/إلى)</option>
           </select>
           
           {period === 'custom' && (
             <div className="flex items-center gap-2">
               <input type="date" value={customRange.start} onChange={e => setCustomRange(p => ({...p, start: e.target.value}))} className="px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs focus:outline-none" />
               <span className="text-gray-400 text-xs">إلى</span>
               <input type="date" value={customRange.end} onChange={e => setCustomRange(p => ({...p, end: e.target.value}))} className="px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs focus:outline-none" />
             </div>
           )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s, idx) => (
          <div key={idx} className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
            <div className={`absolute top-0 right-0 w-24 h-24 rounded-bl-full opacity-50 transition-transform group-hover:scale-110 ${s.bg}`} />
            <div className="relative z-10 flex items-center justify-between mb-4">
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${s.bg}`}>
                <s.icon size={24} className={s.color} />
              </div>
            </div>
            <div className="relative z-10 space-y-1 block">
              <p className="text-sm font-bold text-gray-500">{s.label}</p>
              <div className="flex items-baseline justify-between">
                <p className={`text-2xl font-black ${s.color.replace('text-', 'text-gray-900 font-currency tracking-tight')}`}>
                  {s.format(s.value)}
                </p>
                
                <div className={`flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-md border ${s.trend.isUp ? 'text-emerald-700 bg-emerald-50 border-emerald-100' : 'text-red-700 bg-red-50 border-red-100'}`} title="مقارنة بالفترة السابقة">
                  {s.trend.isUp ? <ArrowUpRight size={12}/> : <ArrowDownRight size={12}/>}
                  {s.trend.value.toFixed(1)}%
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* هامش الربح وأفضل منتج وتكلفة البضاعة */}
        <div className="lg:col-span-2 space-y-4 flex flex-col">
           {canViewProfit && (
             <div className="bg-gradient-to-br from-gray-900 to-[#111827] rounded-3xl p-6 text-white shadow-lg relative overflow-hidden flex flex-col justify-center">
                <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none" />
                <div className="relative z-10">
                   <p className="text-sm text-gray-400 font-bold mb-1">هامش صافي الربح</p>
                   <div className="flex items-end gap-3 mb-4">
                     <h2 className="text-4xl font-black text-emerald-400">{currentMetrics.profitMargin.toFixed(1)}%</h2>
                     <span className="text-xs bg-emerald-500/20 text-emerald-300 px-2 py-1 rounded-md mb-1 border border-emerald-500/30">+من المبيعات</span>
                   </div>
                   <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500 rounded-full transition-all duration-1000" style={{ width: `${currentMetrics.profitMargin}%` }} />
                   </div>
                </div>
             </div>
           )}

           {canViewProfit && (
              <div className="bg-red-50 rounded-3xl p-5 border border-red-100 shadow-sm flex items-center justify-between hover:shadow-md transition-shadow">
                <div>
                   <p className="text-xs text-red-800 font-bold mb-1 flex items-center gap-1.5"><Package size={14}/> تكلفة البضائع المباعة (COGS)</p>
                   <p className="text-xl font-black text-red-600 font-currency">{formatCurrency(currentMetrics.cogs)}</p>
                </div>
                <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center text-red-500">
                   <TrendingUp size={20} className="rotate-180" />
                </div>
              </div>
           )}

           <div className={`rounded-3xl p-5 border shadow-sm flex items-center justify-between transition-shadow relative overflow-hidden ${currentMetrics.returnRate > 10 ? 'bg-amber-50 border-amber-200' : 'bg-white border-gray-100'}`}>
              {currentMetrics.returnRate > 10 && <div className="absolute top-1 right-2 text-[10px] bg-amber-200 text-amber-800 font-bold px-2 py-0.5 rounded flex items-center gap-1"><AlertTriangle size={10}/> مرتفع</div>}
              <div>
                 <p className="text-xs text-gray-500 font-bold mb-1 flex items-center gap-1.5"><XCircle size={14} className={currentMetrics.returnRate > 10 ? 'text-amber-500' : 'text-gray-400'}/> معدل الإرجاع</p>
                 <div className="flex items-baseline gap-2">
                   <p className={`text-xl font-black ${currentMetrics.returnRate > 10 ? 'text-amber-600' : 'text-gray-900'}`}>{currentMetrics.returnRate.toFixed(1)}%</p>
                   <p className="text-[10px] text-gray-400 font-mono">({currentMetrics.returnedCount} طلبية)</p>
                 </div>
              </div>
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${currentMetrics.returnRate > 10 ? 'bg-amber-100 text-amber-600' : 'bg-gray-50 text-gray-400'}`}>
                 <Truck size={20} />
              </div>
           </div>

           <div className="bg-white rounded-3xl p-5 border border-gray-100 shadow-sm flex flex-col justify-center text-center">
              <Award size={28} className="text-yellow-400 mx-auto mb-2" />
              <p className="text-[11px] text-gray-400 font-bold mb-1">المنتج الأكثر إيراداً (هذه الفترة)</p>
              {topProducts.length > 0 ? (
                 <>
                   <p className="text-lg font-bold text-gray-900 leading-snug truncate px-2" title={topProducts[0].name}>{topProducts[0].name}</p>
                   <p className="text-sm font-black text-bunyan-600 font-currency mt-0.5">{formatCurrency(topProducts[0].revenue)}</p>
                 </>
              ) : (
                <p className="text-xs font-bold text-gray-400 pt-2">لا توجد مبيعات</p>
              )}
           </div>
        </div>

        {/* توزيع حالات الطلبيات وأعلى المنتجات مبيعاً */}
        <div className="lg:col-span-3 space-y-4">
          <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm">
            <h2 className="text-base font-bold text-gray-900 mb-5 flex items-center gap-2">
              <Package size={18} className="text-bunyan-600" /> أعلى المنتجات مبيعاً (كميات)
            </h2>
            <div className="space-y-4">
              {topProducts.map((p, i) => {
                const productRecord = myProducts.find(pr => pr.id === p.id);
                
                let isLowStock = false;
                if (productRecord) {
                  // حساب المخزون الصحيح بعد جمع المتغيرات (Variants) إن وجدت
                  const totalStock = productRecord.variants && productRecord.variants.length > 0 
                    ? productRecord.variants.reduce((sum: number, v: any) => sum + v.quantity, 0)
                    : productRecord.quantity;
                  isLowStock = totalStock <= (productRecord.minQuantity || 0);
                }

                return (
                <div key={i} className="flex items-center justify-between group">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-gray-50 flex items-center justify-center text-xs font-black text-gray-400 border border-gray-100 group-hover:bg-bunyan-50 group-hover:text-bunyan-600 transition-colors">
                      {i + 1}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-bold text-gray-900 group-hover:text-bunyan-700 transition-colors">{p.name}</p>
                        {isLowStock && (
                          <span className="text-[9px] bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded font-bold flex items-center gap-0.5">
                            <AlertTriangle size={10}/> مخزون منخفض
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-gray-500 font-mono mt-0.5">{p.count} عنصر مباع</p>
                    </div>
                  </div>
                  <div className="text-left bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-100">
                    <p className="text-sm font-black text-gray-900 font-currency">{formatCurrency(p.revenue)}</p>
                  </div>
                </div>
              )})}
              {topProducts.length === 0 && (
                <p className="text-sm text-center text-gray-400 py-8 border border-dashed border-gray-100 rounded-xl">لا توجد منتجات مسلّمة في هذه الفترة.</p>
              )}
            </div>
          </div>

          <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm">
            <h2 className="text-base font-bold text-gray-900 mb-5 flex items-center gap-2">
              <ShoppingCart size={18} className="text-bunyan-600" /> مسار حالات الطلبيات
            </h2>
            <div className="space-y-3">
              {[
                { label: 'تم التسليم بنجاح', count: currentOrders.filter((o) => o.status === 'delivered').length, color: 'bg-emerald-500', bg: 'bg-emerald-50', text: 'text-emerald-700', icon: CheckCircle2 },
                { label: 'قيد التوصيل (مع المندوب)', count: currentOrders.filter((o) => o.status === 'with_partner' || o.status === 'with_courier').length, color: 'bg-blue-500', bg: 'bg-blue-50', text: 'text-blue-700', icon: Truck },
                { label: 'طلبيات جديدة (معلقة التحضير)', count: currentOrders.filter((o) => o.status === 'pending' || o.status === 'processing').length, color: 'bg-orange-500', bg: 'bg-orange-50', text: 'text-orange-700', icon: Clock },
                { label: 'مرتجعات أو معلقة للإرجاع', count: currentOrders.filter((o) => o.status === 'pending_return' || o.status === 'return_confirmed').length, color: 'bg-red-400', bg: 'bg-red-50', text: 'text-red-700', icon: XCircle },
                { label: 'طلبيات ملغاة تماماً', count: currentOrders.filter((o) => o.status === 'cancelled').length, color: 'bg-gray-400', bg: 'bg-gray-50', text: 'text-gray-700', icon: XCircle },
              ].map((s) => {
                const percentage = currentOrders.length > 0 ? (s.count / currentOrders.length) * 100 : 0;
                return (
                  <div key={s.label} className="relative">
                     <div className="flex items-center justify-between mb-1.5 z-10 relative">
                        <div className="flex items-center gap-2">
                           <s.icon size={14} className={s.text} />
                           <span className="text-xs font-bold text-gray-700">{s.label}</span>
                        </div>
                        <span className={`text-xs font-black px-2 py-0.5 rounded border ${s.bg} ${s.text} border-current/20`}>{s.count} طلب ({percentage.toFixed(0)}%)</span>
                     </div>
                     <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className={`h-full ${s.color} rounded-full transition-all duration-1000 ease-out`} style={{ width: `${percentage}%` }} />
                     </div>
                  </div>
                );
              })}
            </div>
            <p className="text-[10px] text-gray-400 mt-4 text-center">بناءً على إجمالي عدد {currentOrders.length} طلبية مسجلة في المتجر للفترة المحددة.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// Temporary fallback icons since lucide-react doesn't have CheckCircle2 locally sometimes
const CheckCircle2 = ({ size, className }: { size: number, className: string }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
