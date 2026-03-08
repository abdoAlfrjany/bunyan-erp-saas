// src/app/(tenant)/delivery/shipments/page.tsx
// الوظيفة: جدول الشحنات + فلترة بالحالة والشركة
// الجداول: shipments, orders, courier_companies
// الصلاحية: OWNER + EMPLOYEE (قراءة)

'use client';

import { useState, useMemo } from 'react';
import { useAuthStore } from '@/core/auth/store';
import { useDataStore } from '@/core/db/store';
import { formatCurrency, formatDate } from '@/shared/utils/format';
import { SHIPMENT_STATUS, getStatusBadgeClasses } from '@/shared/utils/statusColors';
import { Package, Search, Truck } from 'lucide-react';

export default function ShipmentsPage() {
  const { user } = useAuthStore();
  const { orders, couriers, getForTenant } = useDataStore();
  const tid = user?.tenantId || '';
  const myOrders = getForTenant(orders, tid);
  const myCouriers = getForTenant(couriers, tid);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [courierFilter, setCourierFilter] = useState('all');

  // نبني "شحنات" من الطلبيات التي لها شركة توصيل
  const shipments = useMemo(() => {
    return myOrders
      .filter((o) => o.courierCompanyId && o.deliveryType === 'courier_company')
      .map((o) => {
        const courier = myCouriers.find((c) => c.id === o.courierCompanyId);
        const shipmentStatus = o.status === 'delivered' ? 'delivered'
          : o.status === 'with_courier' ? 'in_transit'
          : o.status === 'pending_return' ? 'pending_return'
          : o.status === 'return_confirmed' ? 'returned_to_sender'
          : o.status === 'processing' ? 'handed_to_courier'
          : o.status === 'cancelled' ? 'cancelled'
          : 'created';
        return {
          id: o.id, orderNumber: o.orderNumber, customerName: o.customerName,
          customerPhone: o.customerPhone, customerCity: o.customerCity,
          courierName: courier?.name || '—', courierShortCode: courier?.shortCode || '',
          courierId: o.courierCompanyId || '',
          trackingNumber: `${courier?.shortCode || 'TRK'}-${o.orderNumber.split('-').pop()}`,
          status: shipmentStatus, amount: o.total, deliveryFee: o.deliveryFee, createdAt: o.createdAt,
        };
      });
  }, [myOrders, myCouriers]);

  const filtered = useMemo(() => shipments.filter((s) => {
    if (statusFilter !== 'all' && s.status !== statusFilter) return false;
    if (courierFilter !== 'all' && s.courierId !== courierFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return s.orderNumber.toLowerCase().includes(q) || s.customerName.toLowerCase().includes(q) || s.trackingNumber.toLowerCase().includes(q);
    }
    return true;
  }), [shipments, statusFilter, courierFilter, search]);

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Package size={24} className="text-bunyan-600" />
            الشحنات المُرسلة
          </h1>
          <p className="text-sm text-gray-500 mt-1">تتبع حالة تسليم الشحنات عن طريق شركات التوصيل</p>
        </div>
      </div>

      {/* فلاتر */}
      <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="بحث بالرقم أو اسم الزبون أو التتبع..."
            className="w-full pr-10 pl-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-bunyan-500/30 focus:border-bunyan-500 transition-all font-mono" />
        </div>
        <div className="flex gap-2">
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
            className="w-1/2 md:w-auto px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-bunyan-500 font-semibold text-gray-700">
            <option value="all">كل حالات التوصيل</option>
            {Object.entries(SHIPMENT_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          <select value={courierFilter} onChange={(e) => setCourierFilter(e.target.value)}
            className="w-1/2 md:w-auto px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-bunyan-500 font-semibold text-gray-700">
            <option value="all">كل الشركات</option>
            {myCouriers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      </div>

      {/* الجدول */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-right">
            <thead className="bg-gray-50 text-gray-500 font-medium border-b border-gray-100">
              <tr>
                <th className="px-6 py-4">رقم الطلبية</th>
                <th className="px-6 py-4">الزبون و المدينة</th>
                <th className="px-6 py-4">الشركة الناقلة</th>
                <th className="px-6 py-4">رقم بوليصة التتبع</th>
                <th className="px-6 py-4">حالة الشحنة</th>
                <th className="px-6 py-4">المبلغ المستحق</th>
                <th className="px-6 py-4">تاريخ الخروج</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map((s) => {
                const st = SHIPMENT_STATUS[s.status as keyof typeof SHIPMENT_STATUS] || SHIPMENT_STATUS.created;
                return (
                  <tr key={s.id} className="hover:bg-gray-50/70 transition-colors">
                    <td className="px-6 py-4 font-black font-mono text-gray-900">{s.orderNumber}</td>
                    <td className="px-6 py-4">
                      <p className="font-semibold text-gray-900">{s.customerName}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{s.customerCity}</p>
                    </td>
                    <td className="px-6 py-4 text-bunyan-600 font-bold">{s.courierName}</td>
                    <td className="px-6 py-4">
                      <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded font-mono text-xs font-bold border border-gray-200">{s.trackingNumber}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={getStatusBadgeClasses(st)}>{st.label}</span>
                    </td>
                    <td className="px-6 py-4 font-bold text-gray-900 font-currency">{formatCurrency(s.amount)}</td>
                    <td className="px-6 py-4 text-xs text-gray-500">{formatDate(s.createdAt)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && (
          <div className="text-center py-16">
            <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <Truck size={28} className="text-gray-400" />
            </div>
            <p className="text-base font-bold text-gray-900 mb-1">لا توجد شحنات مطابقة</p>
            <p className="text-sm text-gray-500">جرب تعديل الفلاتر أو إضافتها.</p>
          </div>
        )}
      </div>
    </div>
  );
}
