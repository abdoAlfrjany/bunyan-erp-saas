// src/core/delivery/VanexAdapter.ts
// الوظيفة: محوّل شركة VanEx — Adapter Pattern
// Production: https://app.vanex.ly/api/v1
// ⚠️ لا تكتب كود VanEx في أي ملف آخر

import type {
  IDeliveryProvider,
  ICreateShipmentPayload,
  ICreateShipmentResult,
  IShipmentStatusResult,
  VanexCity,
  VanexSettlement,
  Order,
} from '../types';

const BASE_URL = process.env.NEXT_PUBLIC_VANEX_URL || 'https://app.vanex.ly/api/v1';

export const VANEX_TO_BUNYAN_STATUS: Record<string, Order['status']> = {
  store_new:           'pending',         // قيد الإجراء
  pending:             'pending',         // (Legacy fallback)
  ship_received:       'ready_to_ship',   // قيد التجهيز / جاهزة للشحن
  ship_preperation:    'with_courier',    // إنتظار الشحن
  ship_ongoing:        'with_courier',    // قيد الشحن
  ship_pending:        'with_courier',    // قيد الإنتظار
  shipped:             'with_courier',    // (Legacy fallback)
  on_track:            'with_courier',    // (Legacy fallback)
  enable_delivery:     'with_courier',    // (Legacy fallback)
  pending_office_sett: 'delivered',       // قيد التسوية المالية (توصيل ناجح)
  pending_store_sett:  'delivered',       // تحت تسوية الشركة (توصيل ناجح)
  completed:           'delivered',       // مكتملة
  delivered:           'delivered',       // (Legacy fallback)
  complete:            'delivered',       // (Legacy fallback)
  ship_del_return:     'pending_return',  // قيد الاسترداد (تنبيه بأنها راجعة)
  returned:            'pending_return',  // (Legacy fallback)
  store_return:        'return_confirmed',// شحنة مستردة وتم استلامها فعلياً (تُسترد للمخزون)
  store_canceled:      'cancelled',       // مُلغاة
  cancelled:           'cancelled',       // (Legacy fallback)
  canceled:            'cancelled',       // (Common single L spelling)
  canceled_by_admin:   'cancelled',
  canceled_by_source:  'cancelled',
  refused:             'pending_return',  // رفض استلام (تتحول لراجعة)
};

export class VanexAdapter implements IDeliveryProvider {
  readonly providerName = 'vanex';

  // ═══ Stored credentials for 401 retry ═══
  private credentials?: { email: string; passwordHash: string };
  private lastToken?: string;
  private officeCities: number[] | null = null;

  setCredentials(email: string, passwordHash: string) {
    this.credentials = { email, passwordHash };
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    token?: string,
    isRetry = false
  ): Promise<{ success: boolean; data?: T; error?: string }> {
    try {
      // 1. تنظيف المنبع (Root Sanitization): تنظيف التوكين أياً كان مصدره
      const rawToken = token || this.lastToken;
      const activeToken = rawToken ? rawToken.replace(/^["']|["']$/g, '').trim() : null;

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      };
      if (activeToken) headers['Authorization'] = `Bearer ${activeToken}`;

      const res = await fetch(`${BASE_URL}${endpoint}`, { ...options, headers });

      // ═══ 401 Retry — مرة واحدة فقط ═══
      if (res.status === 401 && !isRetry && this.credentials?.email && this.credentials?.passwordHash) {
        const reauth = await this.authenticate({
          email: this.credentials.email,
          password: atob(this.credentials.passwordHash),
        });
        
        if (reauth.success && reauth.token) {
          // 2. معالجة الـ Retry Loop: تخزين التوكين الجديد فوراً للاستخدامات القادمة
          this.lastToken = reauth.token;
          return this.request<T>(endpoint, options, reauth.token, true);
        }
        
        // 3. تحسين رسالة الخطأ عند فشل المصادقة التلقائية
        return { success: false, error: 'انتهت صلاحية الجلسة وفشل تحديثها تلقائياً. يرجى إعادة تسجيل الدخول.' };
      }

      const json = await res.json();

      if (!res.ok || (json.status_code && json.status_code >= 400)) {
        // تحسين رسالة الخطأ عند الرفض بـ 401 حتى بعد الـ Retry
        if (res.status === 401) {
          return { success: false, error: "فشل الوصول: قد لا يملك الحساب صلاحية لهذه المدينة أو المنطقة أو التوكين غير صالح." };
        }
        return { success: false, error: json.message || `HTTP ${res.status}` };
      }
      return { success: true, data: json.data as T };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'خطأ في الاتصال بـ VanEx',
      };
    }
  }

  async authenticate(credentials: { email: string; password: string }) {
    const result = await this.request<{ user: { office_cities: number[] }; access_token: string }>(
      '/authenticate',
      {
        method: 'POST',
        body: JSON.stringify({ email: credentials.email, password: credentials.password }),
      }
    );
    if (result.success && result.data) {
      // Capture office_cities permissions
      if (result.data.user && Array.isArray(result.data.user.office_cities)) {
        this.officeCities = result.data.user.office_cities.map((id: string | number) => Number(id));
      } else {
        this.officeCities = null;
      }

      return { success: true, token: result.data.access_token };
    }
    return { success: false, error: result.error };
  }

  async validateToken(token: string): Promise<boolean> {
    const result = await this.request('/validate-token', {}, token);
    return result.success;
  }

  async getCities(token?: string): Promise<VanexCity[]> {
    const result = await this.request<unknown>('/city/all', {}, token);
    
    if (!result.success) {
      // 3. Throw explicit error instead of returning []
      throw new Error(result.error || "فشل الاتصال بـ API فانكس أو مشكلة CORS");
    }

    // 4. Flexible parsing: look for data in result.data or result directly
    const rawData = Array.isArray(result.data) ? result.data : (Array.isArray(result) ? result : []);
    
    if (rawData.length === 0) {
       // No data from API
    }

    // 2. Disable filtering by active for now to ensure we see data
    return rawData.map((c: { id: number; name: string; name_en: string; code: string; region_id: number; active: number }) => ({
      id: c.id,
      name: c.name,
      nameEn: c.name_en,
      code: c.code,
      regionId: c.region_id,
      active: !!c.active, // Ensure boolean conversion
      hasPermission: true,
    }));
  }

  async getSubCities(cityId: number, token?: string): Promise<import('../types').VanexSubCity[]> {

    
    // جلب كل المدن للحصول على المناطق المدمجة بداخلها
    const result = await this.request<unknown>('/city/all', { method: 'GET' }, token);
    
    if (!result.success) {
      throw new Error(result.error || "فشل جلب المناطق من مسار المدن");
    }

    // استخراج المصفوفة بأمان
    const rawData = Array.isArray(result.data) 
      ? result.data 
      : ((result.data as { data?: unknown[] })?.data || []);
    
    // البحث عن المدينة المطلوبة
    const targetCity = (rawData as { id: number | string; locations?: { id: number; name: string; name_ar?: string; parent_city?: number }[] }[]).find((c) => Number(c.id) === Number(cityId));
    
    // سحب المناطق من مصفوفة locations
    const subs = targetCity?.locations || [];
    return subs.map((sub: { id: number; name: string; name_ar?: string; parent_city?: number }) => ({
      id: Number(sub.id),
      name: sub.name || sub.name_ar || "بدون اسم",
      cityId: Number(sub.parent_city || cityId)
    }));
  }

  async calculateDeliveryPrice(fromRegion: number, toCityId: number) {
    const result = await this.request<{ total_price: number; delivery_time: string }>(
      `/delivery-calculator?from_region=${fromRegion}&to_city=${toCityId}&package_type=1`
    );
    if (result.success && result.data) {
      return {
        total: Math.round(result.data.total_price),
        deliveryTime: result.data.delivery_time,
      };
    }
    return null;
  }

  async createShipment(payload: ICreateShipmentPayload, token: string): Promise<ICreateShipmentResult> {
    const body: Record<string, unknown> = {
      type:              payload.type ?? 1,
      reciever:          payload.receiverName,      // ⚠️ هجاء VanEx الأصلي المتعمد
      phone:             payload.receiverPhone,
      phone_b:           payload.receiverPhoneB,
      city:              Number(payload.cityId),
      sub_city:          payload.subCityId ? Number(payload.subCityId) : undefined,
      address:           payload.address,
      price:             payload.price,
      description:       payload.description,
      qty:               payload.qty,
      leangh:            payload.dimLength ? Number(payload.dimLength) : 10,
      width:             payload.dimWidth  ? Number(payload.dimWidth)  : 10,
      height:            payload.dimHeight ? Number(payload.dimHeight) : 10,
      notes:             payload.notes,
      sticker_notes:     payload.stickerNotes,
      commission_by:     payload.commissionBy,
      paid_by:           payload.paidBy ?? 'customer',
      extra_size_by:     payload.extraSizeBy,
      payment_methode:   payload.paymentMethod,     // ⚠️ هجاء VanEx الأصلي المتعمد
      partial_delivery:  payload.partialDelivery ?? false,
      store_reference_id: payload.storeReferenceId,
      insure:            payload.insureShipment ?? false,
      matching:          payload.matchShipment ?? false,
      allow_inspection:  payload.allowInspection ?? false,
      fragile:           payload.fragile ?? false,
      allow_try_on:      payload.allowTryOn ?? false,
      partial_allowed:   payload.partialAllowed ?? false,
      no_heat:           payload.noHeat ?? false,
    };

    if (payload.partialDelivery && payload.products?.length) {
      body.products = payload.products;
    }

    const result = await this.request<{
      id: number;
      'package-code': string;
      status: string;
      total: number;
    }>(
      '/customer/package',
      { method: 'POST', body: JSON.stringify(body) },
      token
    );

    if (result.success && result.data) {
      return {
        success: true,
        trackingCode: result.data['package-code'],
        internalId: result.data.id,
        rawStatus: result.data.status,
        estimatedTotal: Math.round(result.data.total ?? 0),
      };
    }
    return { success: false, error: result.error };
  }

  async getShipmentStatus(trackingCode: string, token?: string): Promise<IShipmentStatusResult> {
    const result = await this.request<{ status_object: { status_value: string }; updated_at: string }>(
      `/customer/package/${trackingCode}`,
      {},
      token
    );
    if (result.success && result.data) {
      const statusValue = result.data.status_object?.status_value ?? 'unknown';
      return {
        rawStatus: statusValue,
        bunyanStatus: VANEX_TO_BUNYAN_STATUS[statusValue] ?? 'with_courier',
        lastUpdate: result.data.updated_at,
      };
    }
    return { rawStatus: result.error ?? 'unknown', bunyanStatus: 'with_courier' };
  }

  async cancelShipment(id: number | string, token: string) {
    console.log(`[VanexAdapter] Attempting to DELETE package ID/Code: ${id}`);
    let result = await this.request<unknown>(
      `/customer/package/${id}`,
      { method: 'DELETE' },
      token
    );
    console.log(`[VanexAdapter] DELETE Response:`, result);

    // Some VanEx states don't allow DELETE but allow RECALL. 
    // If DELETE fails, we automatically fall back to RECALL.
    if (!result.success) {
      console.log(`[VanexAdapter] DELETE failed (${result.error}), attempting RECALL (PUT) for package ID/Code: ${id}`);
      result = await this.recallShipment(id, token, 'إلغاء من نظام التاجر (تلقائي)');
      console.log(`[VanexAdapter] RECALL Response:`, result);
    }

    return { success: result.success, error: result.error };
  }

  async recallShipment(id: number | string, token: string, reason?: string) {
    const result = await this.request(
      `/customer/package/${id}/recall`,
      { method: 'PUT', body: JSON.stringify({ reason: reason || 'استرجاع من النظام' }) },
      token
    );
    return { success: result.success, error: result.error };
  }

  async getSettlements(token: string, status?: string, commissionRate?: number): Promise<import('../types').VanexSettlement[]> {
    const query = status ? `?status=${status}` : '';
    const result = await this.request<{
      data: Array<{
        id: number;
        settlement_number: string;
        total_amount: number;
        status: string;
        payment_method: { id: number; name: string; name_en: string };
        created_at: string;
      }>
    }>(`/store/settelmets${query}`, {}, token);

    if (result.success && result.data) {
      const list = Array.isArray(result.data)
        ? result.data
        : ((result.data as { data?: unknown[] }).data ?? []);

      return (list as Array<{
        id: number;
        settlement_number: string;
        total_amount: number;
        payment_method: { name_en: string };
        created_at: string;
      }>).map(s => {
        const paymentNameEn = s.payment_method?.name_en?.toLowerCase() ?? '';
        const paymentMethod: 'cash' | 'bank_transfer' | 'online' =
          paymentNameEn.includes('cash') ? 'cash' :
          paymentNameEn.includes('online') || paymentNameEn.includes('electronic') ? 'online' :
          'bank_transfer';

        const bankCommission = paymentMethod === 'online'
          ? Math.round((s.total_amount ?? 0) * (commissionRate ?? 0.02))
          : 0;

        const netAmount = Math.round((s.total_amount ?? 0) - bankCommission);

        const rawStatus = (s as { status?: string }).status?.toLowerCase() ?? 'pending';
        const status: VanexSettlement['status'] =
          rawStatus === 'paid' ? 'applied' :
          rawStatus === 'approved' ? 'approved' :
          rawStatus === 'rejected' ? 'rejected' :
          'pending';

        return {
          id: `vs-${s.id}`,
          tenantId: '',
          vanexSettlementId: s.id,
          settlementNumber: s.settlement_number,
          totalAmount: Math.round(s.total_amount ?? 0),
          deliveryFees: 0, // ❌ غير موجود في رد مصفوفة التسويات الكلي
          bankCommission,
          netAmount,
          paymentMethod,
          targetAccountType: (paymentMethod === 'cash' ? 'cash_in_hand' : 'bank') as 'cash_in_hand' | 'bank',
          status,
          createdAt: s.created_at,
          packageCount: 0,
          courierCompanyId: '',
          isApproximate: true,
        };
      });
    }
    return [];
  }

  async getSettlementDetails(id: number, token: string, commissionRate?: number): Promise<import('../types').VanexSettlement | null> {
    const result = await this.request<{
      id: number;
      settlement_number: string;
      total_amount: number;
      payment_method: { name_en: string };
      packages: Array<{ shipping_cost: number }>;
      created_at: string;
    }>(`/store/settelmets/${id}/show`, {}, token);

    if (result.success && result.data) {
      const s = result.data;
      const paymentNameEn = s.payment_method?.name_en?.toLowerCase() ?? '';
      const paymentMethod: 'cash' | 'bank_transfer' | 'online' =
        paymentNameEn.includes('cash') ? 'cash' :
        paymentNameEn.includes('online') || paymentNameEn.includes('electronic') ? 'online' :
        'bank_transfer';

      const totalDeliveryFees = (s.packages ?? [])
        .reduce((sum: number, p: { shipping_cost: number }) =>
          sum + Math.round(p.shipping_cost ?? 0), 0);

      const bankCommission = paymentMethod === 'online'
        ? Math.round(s.total_amount * (commissionRate ?? 0.02))
        : 0;

      const netAmount = Math.round(s.total_amount - totalDeliveryFees - bankCommission);

      const rawStatus = (s as { status?: string }).status?.toLowerCase() ?? 'pending';
      const status: VanexSettlement['status'] =
        rawStatus === 'paid' ? 'applied' :
        rawStatus === 'approved' ? 'approved' :
        rawStatus === 'rejected' ? 'rejected' :
        'pending';

      return {
        id: `vs-${s.id}`,
        tenantId: '',
        vanexSettlementId: s.id,
        settlementNumber: s.settlement_number,
        totalAmount: Math.round(s.total_amount),
        deliveryFees: totalDeliveryFees,
        bankCommission,
        netAmount,
        paymentMethod,
        targetAccountType: (paymentMethod === 'cash' ? 'cash_in_hand' : 'bank') as 'cash_in_hand' | 'bank',
        status,
        createdAt: s.created_at,
        packageCount: (s.packages ?? []).length,
        courierCompanyId: '',
        isApproximate: false,
      };
    }
    return null;
  }
}

export const vanexAdapter = new VanexAdapter();
