// src/app/(tenant)/delivery/shipments/page.tsx
// الوظيفة: جدول الشحنات + courier_raw_status + زر مزامنة VanEx
// Sprint 3B — Two-Layer Status Strategy
// status → يتحكم في الخزينة (مغلق) | courier_raw_status → عرض فقط من API

'use client';

import { useState, useMemo, useCallback } from 'react';
import { useUser } from '@/core/auth/hooks';
import { useAllOrders, useAllCouriers, useGetForTenant, usePatchOrder } from '@/core/db/hooks';
import { formatCurrency, formatDate } from '@/shared/utils/format';
import { SHIPMENT_STATUS, getStatusBadgeClasses } from '@/shared/utils/statusColors';
import { getDeliveryAdapter } from '@/core/delivery';
import { useToast } from '@/shared/components/ui/Toast';
import {
  Package, Search, Truck, RefreshCw, ExternalLink, Wifi, WifiOff
} from 'lucide-react';

export default function ShipmentsPage() {
  const user = useUser();
  const orders = useAllOrders();
  const couriers = useAllCouriers();
  const getForTenant = useGetForTenant();
  const patchOrder = usePatchOrder();
  const { showToast } = useToast();
  const tid = user?.tenantId || '';
  const myOrders = useMemo(() => getForTenant(orders, tid), [orders, tid, getForTenant]);
  const myCouriers = useMemo(() => getForTenant(couriers, tid), [couriers, tid, getForTenant]);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [courierFilter, setCourierFilter] = useState('all');
  const [syncingIds, setSyncingIds] = useState<Set<string>>(new Set());

  // نبني "شحنات" من الطلبيات التي لها شركة توصيل
  const shipments = useMemo(() => {
    return myOrders
      .filter((o) => o.courierCompanyId && o.deliveryType === 'courier_company')
      .map((o) => {
        const courier = myCouriers.find((c) => c.id === o.courierCompanyId);
        const shipmentStatus =
          o.status === 'delivered'        ? 'delivered'
          : o.status === 'with_courier'   ? 'in_transit'
          : o.status === 'pending_return' ? 'pending_return'
          : o.status === 'return_confirmed' ? 'returned_to_sender'
          : o.status === 'processing'     ? 'handed_to_courier'
          : o.status === 'cancelled'      ? 'cancelled'
          : 'created';

        // كود التتبع: VanEx أولاً، ثم المولّد
        const trackingCode = o.courier_tracking_code
          || `${courier?.shortCode || 'TRK'}-${o.orderNumber.split('-').pop()}`;

        return {
          id: o.id,
          orderNumber: o.orderNumber,
          customerName: o.customerName,
          customerPhone: o.customerPhone,
          customerCity: o.customerCity,
          courierName: courier?.name || '—',
          courierShortCode: courier?.shortCode || '',
          courierId: o.courierCompanyId || '',
          courierApiProvider: courier?.apiProvider,
          courierIsConnected: courier?.isApiConnected ?? false,
          courierToken: courier?.apiCredentials?.token,
          trackingCode,
          vanexPackageCode: o.courier_tracking_code,
          vanexPackageId: o.courier_package_id,
          courierRawStatus: o.courier_raw_status,
          status: shipmentStatus,
          amount: o.total,
          deliveryFee: o.deliveryFee,
          createdAt: o.createdAt,
        };
      });
  }, [myOrders, myCouriers]);

  const filtered = useMemo(() => shipments.filter((s) => {
    if (statusFilter !== 'all' && s.status !== statusFilter) return false;
    if (courierFilter !== 'all' && s.courierId !== courierFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        s.orderNumber.toLowerCase().includes(q) ||
        s.customerName.toLowerCase().includes(q) ||
        s.trackingCode.toLowerCase().includes(q) ||
        (s.vanexPackageCode?.toLowerCase().includes(q) ?? false)
      );
    }
    return true;
  }), [shipments, statusFilter, courierFilter, search]);

  // ══ زر المزامنة — يستدعي API ويحدث courier_raw_status فقط ══
  const handleSync = useCallback(async (shipment: typeof shipments[0]) => {
    if (!shipment.vanexPackageCode) {
      showToast('لا يوجد كود VanEx لهذه الشحنة', 'warning');
      return;
    }
    if (!shipment.courierApiProvider || shipment.courierApiProvider === 'none') {
      showToast('هذه الشركة غير مربوطة بـ API', 'warning');
      return;
    }

    setSyncingIds((prev) => new Set(prev).add(shipment.id));
    try {
      const adapter = getDeliveryAdapter(shipment.courierApiProvider as 'vanex' | 'mock');
      const result = await adapter.getShipmentStatus(shipment.vanexPackageCode);

      // Two-Layer Strategy: نحدث courier_raw_status فقط — لا نغير status
      await patchOrder(shipment.id, {
        courier_raw_status: result.rawStatus,
      });

      showToast(`تم تحديث حالة ${shipment.vanexPackageCode}: ${result.rawStatus}`, 'success');
    } catch {
      showToast('فشل تحديث الحالة — حاول مجدداً', 'error');
    } finally {
      setSyncingIds((prev) => {
        const next = new Set(prev);
        next.delete(shipment.id);
        return next;
      });
    }
  }, [patchOrder, showToast]);

  // مزامنة كل الشحنات المرئية دفعة واحدة
  const handleSyncAll = useCallback(async () => {
    const syncable = filtered.filter(
      (s) => s.vanexPackageCode && s.courierApiProvider && s.courierApiProvider !== 'none'
    );
    if (syncable.length === 0) {
      showToast('لا توجد شحنات قابلة للمزامنة', 'warning');
      return;
    }
    for (const s of syncable) {
      await handleSync(s);
    }
  }, [filtered, handleSync, showToast]);

  return (
    <div className="space-y-6 animate-fade-in pb-10">

      {/* الهيدر */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900 flex items-center gap-2">
            <Package size={24} className="text-bunyan-600" />
            الشحنات المُرسلة
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            تتبع حالة التوصيل — حالة VanEx للعرض فقط ولا تؤثر على الخزينة
          </p>
        </div>
        <button
          onClick={handleSyncAll}
          className="inline-flex items-center gap-2 bg-white border border-gray-200 hover:border-bunyan-400 hover:bg-bunyan-50 text-gray-700 hover:text-bunyan-800 px-4 py-2.5 rounded-xl text-sm font-bold transition-colors shadow-sm"
        >
          <RefreshCw size={15} />
          مزامنة الكل
        </button>
      </div>

      {/* فلاتر */}
      <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="بحث بالرقم أو اسم الزبون أو كود VanEx..."
            className="w-full pr-10 pl-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-bunyan-500/30 focus:border-bunyan-500 transition-all"
          />
        </div>
        <div className="flex gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-1/2 md:w-auto px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-bunyan-500 font-semibold text-gray-700"
          >
            <option value="all">كل الحالات</option>
            {Object.entries(SHIPMENT_STATUS).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
          <select
            value={courierFilter}
            onChange={(e) => setCourierFilter(e.target.value)}
            className="w-1/2 md:w-auto px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-bunyan-500 font-semibold text-gray-700"
          >
            <option value="all">كل الشركات</option>
            {myCouriers.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* الجدول */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-right">
            <thead className="bg-gray-50 text-gray-500 font-medium border-b border-gray-100">
              <tr>
                <th className="px-5 py-4">رقم الطلبية</th>
                <th className="px-5 py-4">الزبون والمدينة</th>
                <th className="px-5 py-4">الشركة الناقلة</th>
                <th className="px-5 py-4">كود VanEx</th>
                <th className="px-5 py-4">حالة بنيان</th>
                <th className="px-5 py-4">حالة VanEx الفعلية</th>
                <th className="px-5 py-4">المبلغ</th>
                <th className="px-5 py-4">التاريخ</th>
                <th className="px-5 py-4">مزامنة</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map((s) => {
                const st = SHIPMENT_STATUS[s.status as keyof typeof SHIPMENT_STATUS] || SHIPMENT_STATUS.created;
                const isSyncing = syncingIds.has(s.id);
                const canSync = !!s.vanexPackageCode && !!s.courierApiProvider && s.courierApiProvider !== 'none';

                return (
                  <tr key={s.id} className="hover:bg-gray-50/70 transition-colors">

                    {/* رقم الطلبية */}
                    <td className="px-5 py-4 font-black font-mono text-gray-900 text-xs">
                      {s.orderNumber}
                    </td>

                    {/* الزبون */}
                    <td className="px-5 py-4">
                      <p className="font-semibold text-gray-900">{s.customerName}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{s.customerCity}</p>
                    </td>

                    {/* الشركة */}
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-1.5">
                        {s.courierIsConnected ? (
                          <Wifi size={11} className="text-emerald-500" />
                        ) : (
                          <WifiOff size={11} className="text-gray-300" />
                        )}
                        <span className="text-bunyan-600 font-bold">{s.courierName}</span>
                      </div>
                    </td>

                    {/* كود VanEx */}
                    <td className="px-5 py-4">
                      {s.vanexPackageCode ? (
                        <span className="inline-flex items-center gap-1 bg-orange-50 text-orange-700 border border-orange-200 px-2 py-1 rounded-lg font-mono text-xs font-bold">
                          <ExternalLink size={9} />
                          {s.vanexPackageCode}
                        </span>
                      ) : (
                        <span className="bg-gray-100 text-gray-500 px-2 py-1 rounded font-mono text-xs border border-gray-200">
                          {s.trackingCode}
                        </span>
                      )}
                    </td>

                    {/* حالة بنيان — تتحكم في الخزينة */}
                    <td className="px-5 py-4">
                      <span className={getStatusBadgeClasses(st)}>{st.label}</span>
                    </td>

                    {/* حالة VanEx — للعرض فقط */}
                    <td className="px-5 py-4">
                      {s.courierRawStatus ? (
                        <span className="inline-block bg-slate-100 text-slate-600 border border-slate-200 px-2 py-0.5 rounded-full text-xs font-mono">
                          {s.courierRawStatus}
                        </span>
                      ) : (
                        <span className="text-gray-300 text-xs">—</span>
                      )}
                    </td>

                    {/* المبلغ */}
                    <td className="px-5 py-4 font-bold text-gray-900">
                      {formatCurrency(s.amount)}
                    </td>

                    {/* التاريخ */}
                    <td className="px-5 py-4 text-xs text-gray-400">
                      {formatDate(s.createdAt)}
                    </td>

                    {/* زر المزامنة */}
                    <td className="px-5 py-4">
                      <button
                        onClick={() => handleSync(s)}
                        disabled={isSyncing || !canSync}
                        title={
                          !canSync
                            ? 'لا يوجد كود VanEx أو الشركة غير مربوطة'
                            : 'مزامنة حالة VanEx'
                        }
                        className={`p-2 rounded-lg transition-colors ${
                          canSync
                            ? 'text-gray-400 hover:text-bunyan-600 hover:bg-bunyan-50'
                            : 'text-gray-200 cursor-not-allowed'
                        }`}
                      >
                        <RefreshCw
                          size={14}
                          className={isSyncing ? 'animate-spin text-bunyan-500' : ''}
                        />
                      </button>
                    </td>

                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {filtered.length === 0 && (
          <div className="text-center py-16">
            <div className="w-16 h-16 bg-gray-50 rounded-[2rem] flex items-center justify-center mx-auto mb-4 border border-gray-100 shadow-sm">
              <Truck size={28} className="text-gray-400" />
            </div>
            <p className="text-base font-bold text-gray-900 mb-1">لا توجد شحنات مطابقة</p>
            <p className="text-sm text-gray-500">جرب تعديل الفلاتر أو إضافة طلبيات بشركة توصيل.</p>
          </div>
        )}
      </div>

    </div>
  );
}
