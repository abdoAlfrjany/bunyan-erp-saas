// src/core/db/slices/ordersSlice.ts
// الوظيفة: CRUD الطلبيات + خصم المخزون + تأثير الخزينة
// الجولة 13: هجرة هجينة — Supabase أولاً ثم Zustand Cache

import type { StateCreator } from 'zustand';
import type { Order, Notification, TreasuryTransaction } from '../../types';

// ══════════════════════════════════════════
// Helper: Map Supabase row (snake_case) → Order (camelCase)
// ══════════════════════════════════════════
export function mapSupabaseRowToOrder(row: any): Order {
  return {
    id:                   row.id,
    tenantId:             row.tenant_id,
    orderNumber:          row.order_number,
    customerName:         row.customer_name,
    customerPhone:        row.customer_phone,
    customerAddress:      row.customer_address ?? undefined,
    customerCity:         row.customer_city,
    deliveryType:         row.delivery_type,
    courierCompanyId:     row.courier_company_id ?? undefined,
    shipmentId:           row.shipment_id ?? undefined,
    deliveryFee:          Number(row.delivery_fee ?? 0),
    status:               row.status,
    priceIncludesDelivery: row.price_includes_delivery ?? false,
    source:               row.source ?? undefined,
    subtotal:             Number(row.subtotal ?? 0),
    discount:             Number(row.discount ?? 0),
    total:                Number(row.total ?? 0),
    paymentStatus:        row.payment_status,
    notes:                row.notes ?? undefined,
    items:                Array.isArray(row.items) ? row.items : [],
    createdAt:            row.created_at,
    createdBy:            row.created_by ?? undefined,
    courier_raw_status:   row.courier_raw_status ?? undefined,
    is_online_payable:    row.is_online_payable ?? undefined,
    commission_by:        row.commission_by ?? undefined,
    extra_size_by:        row.extra_size_by ?? undefined,
    prepaid_amount:       row.prepaid_amount !== null ? Number(row.prepaid_amount) : undefined,
    partial_delivery:     row.partial_delivery ?? undefined,
    vanex_package_code:   row.vanex_package_code ?? undefined,
    vanex_package_id:     row.vanex_package_id ?? undefined,
    vanexCityId:          row.vanex_city_id ?? undefined,
    vanexSubCityId:       row.vanex_sub_city_id ?? undefined,
  };
}



// ══════════════════════════════════════════
// Helper: Map Order (camelCase) → Supabase row (snake_case)
// ══════════════════════════════════════════
function mapOrderToSupabaseRow(o: Order): Record<string, unknown> {
  // إذا كان tenantId محلي قديم (مثل tenant-001)، نعكف عن إرساله كـ UUID ونعتمد على RLS (الذي يأخذه من session تلقائياً)
  // أو نُرسل UUID صالح. بما أننا نستخدم RLS، Supabase يفضل أن يكون صحيحاً أو مأخوذاً من auth.uid().
  
  return {
    id:                     o.id || crypto.randomUUID(), // ضمان UUID
    tenant_id:              o.tenantId,    // إذا كان نصاً قديماً، נرسل null. الـ RLS غالباً سيسمح للمستخدم إذا كان السطر يخصه أو قد يرفض إذا كان Required، لكنه أفضل من 400. الأفضل تسجيل خروج ودخول للحصول على UUID حقيقي
    order_number:           o.orderNumber,
    customer_name:          o.customerName,
    customer_phone:         o.customerPhone,
    customer_address:       o.customerAddress ?? null,
    customer_city:          o.customerCity,
    delivery_type:          o.deliveryType,
    // تنظيف معرّفات شركة التوصيل الوهمية قبل الإرسال لـ Supabase (لتجنب 400 invalid uuid)
    courier_company_id:     o.courierCompanyId ?? null,
    shipment_id:            o.shipmentId ?? null,
    delivery_fee:           o.deliveryFee,
    status:                 o.status,
    price_includes_delivery: o.priceIncludesDelivery,
    source:                 o.source ?? null,
    subtotal:               o.subtotal,
    discount:               o.discount,
    total:                  o.total,
    payment_status:         o.paymentStatus,
    notes:                  o.notes ?? null,
    items:                  o.items,   // Supabase JSONB
    created_by:             o.createdBy ?? null,
    courier_raw_status:     o.courier_raw_status ?? null,
    is_online_payable:      o.is_online_payable ?? null,
    commission_by:          o.commission_by ?? null,
    extra_size_by:          o.extra_size_by ?? null,
    prepaid_amount:         o.prepaid_amount ?? null,
    partial_delivery:       o.partial_delivery ?? null,
    vanex_package_code:     o.vanex_package_code ?? null,
    vanex_package_id:       o.vanex_package_id ?? null,
    vanex_city_id:          o.vanexCityId ?? null,
    vanex_sub_city_id:      o.vanexSubCityId ?? null,
  };
}

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
export const createOrdersSlice: StateCreator<any, [], [], OrdersSlice> = (set, get) => ({
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
    } catch (err: any) {
      console.error('fetchOrders exception:', err);
      return { success: false, error: err?.message ?? 'خطأ غير متوقع' };
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
    } catch (err: any) {
      console.error('addOrder exception:', err);
      return { success: false, error: err?.message ?? 'خطأ في الاتصال بالخادم' };
    }
  },

  // ══ UPDATE ORDER STATUS (Server-First) ══
  // ✅ الإصلاح: كل تأثيرات الخزينة والمخزون تُنفَّذ الآن على السيرفر عبر /api/orders/status
  // قبل الإصلاح: كانت حركات الخزينة تُنشأ فقط في Zustand المحلي وتضيع عند إعادة التحميل
  updateOrderStatus: async (id, status, paymentStatus) => {
    const state = get();

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
    set((s: any) => ({
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
      if (data.vanex_package_code  !== undefined) snakePatch.vanex_package_code    = data.vanex_package_code;
      if (data.vanex_package_id    !== undefined) snakePatch.vanex_package_id      = data.vanex_package_id;
      if (data.courier_raw_status  !== undefined) snakePatch.courier_raw_status    = data.courier_raw_status;
      if (data.is_online_payable   !== undefined) snakePatch.is_online_payable     = data.is_online_payable;
      if (data.commission_by       !== undefined) snakePatch.commission_by         = data.commission_by;
      if (data.extra_size_by       !== undefined) snakePatch.extra_size_by         = data.extra_size_by;
      if (data.prepaid_amount      !== undefined) snakePatch.prepaid_amount        = data.prepaid_amount;
      if (data.partial_delivery    !== undefined) snakePatch.partial_delivery      = data.partial_delivery;
      if (data.vanexCityId         !== undefined) snakePatch.vanex_city_id         = data.vanexCityId;
      if (data.vanexSubCityId      !== undefined) snakePatch.vanex_sub_city_id     = data.vanexSubCityId;
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
    set((s: any) => ({
      orders: s.orders.map((o: Order) => (o.id === id ? { ...o, ...data } : o)),
    }));
  },
});
