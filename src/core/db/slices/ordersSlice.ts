// src/core/db/slices/ordersSlice.ts
// الوظيفة: CRUD الطلبيات + خصم المخزون + تأثير الخزينة
// الجولة 13: هجرة هجينة — Supabase أولاً ثم Zustand Cache

import type { StateCreator } from 'zustand';
import type { Order } from '../../types';

// ══════════════════════════════════════════
// Helper: Map Supabase row (snake_case) → Order (camelCase)
// ══════════════════════════════════════════
export function mapSupabaseRowToOrder(row: Record<string, unknown>): Order {
  const getNum = (key: string) => row[key] !== null ? Number(row[key]) : 0;
  const getStr = (key: string) => (row[key] as string) || '';
  const getOptStr = (key: string) => (row[key] as string) || undefined;
  const getBool = (key: string) => !!row[key];

  return {
    id:                   getStr('id'),
    tenantId:             getStr('tenant_id'),
    orderNumber:          getStr('order_number'),
    customerName:         getStr('customer_name'),
    customerPhone:        getStr('customer_phone'),
    customerAddress:      getOptStr('customer_address'),
    customerCity:         getStr('customer_city'),
    deliveryType:         (row['delivery_type'] as 'internal' | 'courier_company' | 'pickup') || 'internal',
    courierCompanyId:     getOptStr('courier_company_id'),
    shipmentId:           getOptStr('shipment_id'),
    deliveryFee:          getNum('delivery_fee'),
    status:               (row['status'] as Order['status']) || 'pending',
    priceIncludesDelivery: getBool('price_includes_delivery'),
    source:               (row['source'] as Order['source']),
    subtotal:             getNum('subtotal'),
    discount:             getNum('discount'),
    total:                getNum('total'),
    paymentStatus:        (row['payment_status'] as Order['paymentStatus']) || 'pending',
    notes:                getOptStr('notes'),
    items:                Array.isArray(row['items']) ? row['items'] : [],
    createdAt:            getStr('created_at'),
    createdBy:            getOptStr('created_by'),
    courier_raw_status:   getOptStr('courier_raw_status'),
    is_online_payable:    row['is_online_payable'] as boolean | undefined,
    commission_by:        row['commission_by'] as 'customer' | 'market' | undefined,
    extra_size_by:        row['extra_size_by'] as 'customer' | 'market' | undefined,
    prepaid_amount:       row['prepaid_amount'] !== null ? Number(row['prepaid_amount']) : undefined,
    partial_delivery:     row['partial_delivery'] as boolean | undefined,
    courier_tracking_code:   getOptStr('courier_tracking_code'),
    courier_package_id:     row['courier_package_id'] as number | undefined,
    courierCityId:          row['courier_city_id'] as number | undefined,
    courierSubCityId:       row['courier_sub_city_id'] as number | undefined,
  };
}



// ══════════════════════════════════════════
// Helper: Map Order (camelCase) → Supabase row (snake_case)
// ══════════════════════════════════════════


// ══════════════════════════════════════════
// Interface
// ══════════════════════════════════════════
export interface OrdersSlice {
  orders: Order[];
  fetchOrders: (tenantId: string) => Promise<{ success: boolean; error?: string }>;
  addOrder: (o: Order) => Promise<{ success: boolean; error?: string }>;
  updateOrderStatus: (id: string, status: Order['status'], paymentStatus?: Order['paymentStatus']) => Promise<void>;
  patchOrder: (id: string, data: Partial<Order>) => Promise<void>;
}

// ══════════════════════════════════════════
// Slice Implementation
// ══════════════════════════════════════════
export const createOrdersSlice: StateCreator<OrdersSlice, [], [], OrdersSlice> = (set) => ({
  orders: [],

  // ══ FETCH ══
  fetchOrders: async (tenantId) => {
    try {
      const { createClient } = await import('@/core/db/supabase');
      const supabase = createClient();

      const { data, error } = await supabase
        .from('orders')
        .select('id, tenant_id, order_number, customer_name, customer_phone, customer_city, delivery_type, status, total, payment_status, created_at, delivery_fee') // Column selection
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .limit(200); // Pagination limit to protect memory

      if (error) {
        console.error('fetchOrders error:', error.message);
        return { success: false, error: error.message };
      }

      const mapped: Order[] = (data ?? []).map(mapSupabaseRowToOrder);
      set({ orders: mapped });
      return { success: true };
    } catch (err) {
      console.error('fetchOrders exception:', err);
      const msg = err instanceof Error ? err.message : 'خطأ غير متوقع';
      return { success: false, error: msg };
    }
  },

  // ══ ADD ORDER (Server API Route) ══
  addOrder: async (o) => {
    try {
      // إرسال الطلبية إلى الخادم الآمن (API Route)
      // الخادم سيقوم بفحص المخزون المباشر، إدراج الطلبية، وتنفيذ خصم المخزون RPC وتحديث العميل
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(o)
      });
      
      const data = await res.json();
      
      if (!res.ok || data.error) {
        return { success: false, error: data.error || 'فشل في حفظ الطلبية' };
      }

      // We do NOT update the local Zustand arrays here anymore.
      // The calling components (like OrdersPage) will call React Query's refetch()

      return { success: true };
    } catch (err) {
      console.error('addOrder exception:', err);
      const msg = err instanceof Error ? err.message : 'خطأ في الاتصال بالخادم';
      return { success: false, error: msg };
    }
  },

  // ══ UPDATE ORDER STATUS (Server-First) ══
  // ✅ الإصلاح: كل تأثيرات الخزينة والمخزون تُنفَّذ الآن على السيرفر عبر /api/orders/status
  // قبل الإصلاح: كانت حركات الخزينة تُنشأ فقط في Zustand المحلي وتضيع عند إعادة التحميل
  updateOrderStatus: async (id, status, paymentStatus) => {

    try {
      const res = await fetch('/api/orders/status', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: id, status, paymentStatus }),
      });

      const result = await res.json();
      if (!res.ok || !result.success) {
        console.error('updateOrderStatus server error:', result.error);
        return;
      }
    } catch (err) {
      console.error('updateOrderStatus network error:', err);
      return;
    }

    // تحديث الـ Cache المحلي (optimistic) بعد تأكيد السيرفر
    set((s: OrdersSlice) => ({
      orders: s.orders.map((o: Order) =>
        o.id === id ? { ...o, status, ...(paymentStatus ? { paymentStatus } : {}) } : o
      ),
    }));
  },



  // ══ PATCH ORDER (Hybrid) ══
  patchOrder: async (id, data) => {
    // ── Supabase أولاً — تحويل الحقول إلى snake_case ──
    try {
      const { createClient } = await import('@/core/db/supabase');
      const supabase = createClient();

      // بناء كائن التحديث بـ snake_case
      const snakePatch: Record<string, unknown> = {};
      if (data.status              !== undefined) snakePatch.status               = data.status;
      if (data.paymentStatus       !== undefined) snakePatch.payment_status        = data.paymentStatus;
      if (data.notes               !== undefined) snakePatch.notes                 = data.notes;
      if (data.courierCompanyId    !== undefined) snakePatch.courier_company_id    = data.courierCompanyId;
      if (data.deliveryType        !== undefined) snakePatch.delivery_type         = data.deliveryType;
      if (data.shipmentId          !== undefined) snakePatch.shipment_id           = data.shipmentId;
      if (data.deliveryFee         !== undefined) snakePatch.delivery_fee          = data.deliveryFee;
      if (data.courier_tracking_code  !== undefined) snakePatch.courier_tracking_code    = data.courier_tracking_code;
      if (data.courier_package_id    !== undefined) snakePatch.courier_package_id      = data.courier_package_id;
      if (data.courier_raw_status  !== undefined) snakePatch.courier_raw_status    = data.courier_raw_status;
      if (data.is_online_payable   !== undefined) snakePatch.is_online_payable     = data.is_online_payable;
      if (data.commission_by       !== undefined) snakePatch.commission_by         = data.commission_by;
      if (data.extra_size_by       !== undefined) snakePatch.extra_size_by         = data.extra_size_by;
      if (data.prepaid_amount      !== undefined) snakePatch.prepaid_amount        = data.prepaid_amount;
      if (data.partial_delivery    !== undefined) snakePatch.partial_delivery      = data.partial_delivery;
      if (data.courierCityId         !== undefined) snakePatch.courier_city_id         = data.courierCityId;
      if (data.courierSubCityId      !== undefined) snakePatch.courier_sub_city_id     = data.courierSubCityId;
      if (data.customerName        !== undefined) snakePatch.customer_name         = data.customerName;
      if (data.customerPhone       !== undefined) snakePatch.customer_phone        = data.customerPhone;
      if (data.customerAddress     !== undefined) snakePatch.customer_address      = data.customerAddress;
      if (data.customerCity        !== undefined) snakePatch.customer_city         = data.customerCity;

      if (Object.keys(snakePatch).length > 0) {
        const { error } = await supabase.from('orders').update(snakePatch).eq('id', id);
        if (error) {
          console.error('patchOrder Supabase error:', error.message);
          // نكمل محلياً حتى لا يتجمد الـ UI
        }
      }
    } catch (err) {
      console.error('patchOrder exception:', err);
    }

    // ── تحديث الـ Cache المحلي ──
    set((s: OrdersSlice) => ({
      orders: s.orders.map((o: Order) => (o.id === id ? { ...o, ...data } : o)),
    }));
  },
});
