// src/app/(tenant)/delivery/page.tsx
// الوظيفة: صفحة شركات التوصيل — بطاقات الشركات مع إحصائيات
// الجداول: courier_companies
// الصلاحية: OWNER (كامل), EMPLOYEE (قراءة فقط)

'use client';

import { useAuthStore } from '@/core/auth/store';
import { useDataStore } from '@/core/db/store';
import { formatCurrency } from '@/shared/utils/format';
import Link from 'next/link';
import { Truck, Package, CheckCircle2, RotateCcw, Wallet, Building2, ChevronLeft } from 'lucide-react';

export default function DeliveryPage() {
  const { user } = useAuthStore();
  const { couriers, getForTenant } = useDataStore();
  const tid = user?.tenantId || '';
  const myCouriers = getForTenant(couriers, tid);

  const totalPending = myCouriers.reduce((s, c) => s + c.pendingAmount, 0);
  const totalShipments = myCouriers.reduce((s, c) => s + c.totalShipments, 0);
  const totalDelivered = myCouriers.reduce((s, c) => s + c.totalDelivered, 0);

  const tabs = [
    { label: 'الشركات', href: '/delivery' },
    { label: 'الشحنات', href: '/delivery/shipments' },
    { label: 'التسويات', href: '/delivery/settlements' },
    { label: 'التحليلات', href: '/delivery/analytics' },
  ];

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Truck size={24} className="text-bunyan-600" />
            شركات التوصيل
          </h1>
          <p className="text-sm text-gray-500 mt-1">إدارة الشركات المتعاقد معها ومتابعة أدائها</p>
        </div>
      </div>

      {/* إحصاءات عامة */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
          <p className="text-sm font-medium text-gray-500 mb-2">إجمالي قيد التحصيل</p>
          <p className="text-2xl font-black text-gray-900 font-currency">{formatCurrency(totalPending)}</p>
        </div>
        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
          <p className="text-sm font-medium text-gray-500 mb-2">إجمالي الشحنات</p>
          <p className="text-2xl font-black text-gray-900">{totalShipments}</p>
        </div>
        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
          <p className="text-sm font-medium text-gray-500 mb-2">نسبة التسليم</p>
          <p className="text-2xl font-black text-emerald-600">{totalShipments > 0 ? Math.round((totalDelivered / totalShipments) * 100) : 0}%</p>
        </div>
      </div>

      {/* التبويبات */}
      <div className="flex gap-2 border-b border-gray-200 pb-px overflow-x-auto">
        {tabs.map((t) => (
          <Link key={t.href} href={t.href}
            className={`px-5 py-3 rounded-t-xl text-sm font-bold transition-all whitespace-nowrap ${t.href === '/delivery' ? 'bg-bunyan-600 text-white' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900'}`}>
            {t.label}
          </Link>
        ))}
      </div>

      {/* بطاقات الشركات */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2 gap-4">
        {myCouriers.map((c) => {
          const deliveryRate = c.totalShipments > 0 ? Math.round((c.totalDelivered / c.totalShipments) * 100) : 0;
          return (
            <div key={c.id} className="bg-white rounded-2xl p-6 border border-gray-100 border-r-4 border-r-bunyan-600 shadow-sm hover:shadow-md transition-all">
              <div className="flex items-start justify-between mb-5">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-bunyan-50 flex items-center justify-center">
                    <Building2 size={24} className="text-bunyan-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">{c.name}</h3>
                    <p className="text-xs text-gray-500 mt-1 font-mono hover:text-bunyan-600 transition-colors">كود التاجر: {c.merchantCode}</p>
                  </div>
                </div>
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${c.isActive ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                  {c.isActive ? '🟢 نشطة' : '🔴 متوقفة'}
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center shrink-0">
                    <Package size={14} className="text-blue-600" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-gray-400">شحنات نشطة</p>
                    <p className="text-sm font-black text-gray-900">{c.totalShipments - c.totalDelivered - c.totalReturned}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-emerald-50 flex items-center justify-center shrink-0">
                    <CheckCircle2 size={14} className="text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-gray-400">توصيل ({deliveryRate}%)</p>
                    <p className="text-sm font-black text-gray-900">{c.totalDelivered}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-red-50 flex items-center justify-center shrink-0">
                    <RotateCcw size={14} className="text-red-600" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-gray-400">مرتجعات</p>
                    <p className="text-sm font-black text-gray-900">{c.totalReturned}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-bunyan-50 flex items-center justify-center shrink-0">
                    <Wallet size={14} className="text-bunyan-600" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-gray-400">قيد التحصيل</p>
                    <p className="text-sm font-black text-gray-900 font-currency truncate" title={formatCurrency(c.pendingAmount)}>{formatCurrency(c.pendingAmount)}</p>
                  </div>
                </div>
              </div>
              <div className="mt-5 pt-4 border-t border-gray-50 flex justify-end">
                <Link href="/delivery/companies" className="text-xs font-bold text-bunyan-600 hover:text-bunyan-800 flex items-center gap-1 transition-colors">
                  إدارة التفاصيل <ChevronLeft size={14} />
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
