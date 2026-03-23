// src/core/db/slices/deliverySlice.ts
// الوظيفة: كل ما يتعلق بتكامل شركات التوصيل (VanEx وغيرها)
// شاملاً: sendOrderToVanex, settlements, subCities, provider cities

import type { StateCreator } from 'zustand';
import type {
  VanexCity,
  VanexSubCity,
  VanexSettlement,
  TreasuryTransaction,
  SuperAdminCourier,
} from '../../types';
import { vanexAdapter } from '../../delivery/VanexAdapter';
import { useProviderAuthStore } from '../providerAuthStore';
import { mapSupabaseRowToOrder } from './ordersSlice';

export interface DeliverySlice {
  // ══ State ══
  vanexCities: VanexCity[];
  vanexSettlements: VanexSettlement[];
  vanexSubCities: Record<number, VanexSubCity[]>;
  superAdminCouriers: SuperAdminCourier[];
  providerCitiesData: VanexCity[];
  providerRegionsData: Record<number, VanexSubCity[]>;
  activeProviderToken?: string | null;

  // ══ Super Admin Couriers ══
  addSuperAdminCourier: (courier: SuperAdminCourier) => void;
  updateSuperAdminCourier: (id: string, data: Partial<SuperAdminCourier>) => void;

  // ══ VanEx Integration ══
  sendOrderToVanex: (orderId: string) => Promise<{ success: boolean; error?: string }>;
  fetchVanexSettlements: (courierId: string) => Promise<{ success: boolean; count?: number; error?: string }>;
  applyVanexSettlement: (settlementId: string, courierId: string) => Promise<{ success: boolean; error?: string }>;
  fetchVanexSubCities: (cityId: number, courierId: string) => Promise<{ success: boolean; error?: string }>;
  fetchVanexCities: () => Promise<{ success: boolean; error?: string }>;
  authenticateSeedVanex: (email: string, passwordHash: string) => Promise<{ success: boolean; error?: string }>;
  fetchVanexSeedSubCities: (cityId: number) => Promise<{ success: boolean; error?: string }>;

  // ══ Provider Generic (City Mappings UI) ══
  fetchProviderCities: (provider: string, credentials: { email: string; password: string }) => Promise<{ success: boolean; error?: string }>;
  fetchProviderRegions: (cityId: number) => Promise<{ success: boolean; error?: string }>;
}

export const createDeliverySlice: StateCreator<any, [], [], DeliverySlice> = (set, get) => ({
  vanexCities: [],
  vanexSettlements: [],
  vanexSubCities: {},
  superAdminCouriers: [
    {
      id: crypto.randomUUID(),
      provider: 'vanex',
      name: 'VanEx Logistics',
      isActive: true,
    },
  ],
  providerCitiesData: [],
  providerRegionsData: {},

  addSuperAdminCourier: (courier) =>
    set((s: any) => ({ superAdminCouriers: [courier, ...s.superAdminCouriers] })),

  updateSuperAdminCourier: (id, data) =>
    set((s: any) => ({
      superAdminCouriers: s.superAdminCouriers.map((c: SuperAdminCourier) =>
        c.id === id ? { ...c, ...data } : c
      ),
    })),

  fetchProviderCities: async (provider, credentials) => {
    if (provider !== 'vanex') {
      return { success: false, error: 'مزود الخدمة غير مدعوم حالياً' };
    }
    try {
      const authRes = await vanexAdapter.authenticate(credentials);
      if (!authRes.success || !authRes.token) {
        return { success: false, error: authRes.error || 'بيانات الدخول غير صحيحة' };
      }

      vanexAdapter.setCredentials(credentials.email, btoa(credentials.password));

      const cities = await vanexAdapter.getCities(authRes.token);

      if (!cities || cities.length === 0) {
        return { success: false, error: 'الاستجابة نجحت ولكن مصفوفة المدن فارغة من جهة المزود' };
      }

      const processedCities = cities.map((c) => {
        const hasRegions = ['طرابلس', 'بنغازي', 'مصراتة', 'سرت', 'الزاوية', 'الخمس', 'Tripoli', 'Benghazi', 'Misrata'].some(
          (name) => c.name?.includes(name) || c.nameEn?.includes(name)
        );
        return { ...c, isActive: c.active, hasSubRegions: hasRegions };
      });

      set({ providerCitiesData: processedCities });
      useProviderAuthStore.getState().setActiveProviderToken(authRes.token || null);

      return { success: true };
    } catch (err: any) {
      console.error('fetchProviderCities ERROR:', err);
      return { success: false, error: `خطأ Integration: ${err.message || 'فشل الاتصال بالخادم'}` };
    }
  },

  fetchProviderRegions: async (cityId) => {
    const state = get();
    const token = state.activeProviderToken || useProviderAuthStore.getState().activeProviderToken;
    console.log(`STORE_DEBUG: fetchProviderRegions for City ${cityId}, Token found: ${token ? 'YES' : 'NO'}`);

    if (!token) {
      console.warn('fetchProviderRegions: No token found in State');
      return { success: false, error: 'انتهت جلسة الربط أو يجب تحديث بيانات الـ API أولاً' };
    }

    try {
      const regions = await vanexAdapter.getSubCities(cityId, token);

      if (regions && regions.length > 0) {
        set((s: any) => ({
          providerRegionsData: { ...s.providerRegionsData, [cityId]: regions },
        }));
        return { success: true };
      } else {
        return { success: true, error: 'تم استلام استجابة ناجحة ولكن لا توجد مناطق جغرافية لهذه المدينة' };
      }
    } catch (err: any) {
      console.error('fetchProviderRegions ERROR:', err);
      return { success: false, error: `خطأ Integration: ${err.message || 'خطأ في جلب المناطق'}` };
    }
  },

  sendOrderToVanex: async (orderId) => {
    const state = get();
    
    // جلب الطلبية مباشرة من Supabase لضمان الحصول على أحدث البيانات
    const { createClient } = await import('../supabase');
    const supabase = createClient();
    
    const { data: row, error: fetchError } = await supabase
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single();

    if (fetchError || !row) {
      return { success: false, error: 'الطلبية غير موجودة في قاعدة البيانات' };
    }

    // ═══ Dedup Guard: منع الإرسال المكرر ═══
    if (row.vanex_package_id) {
      return { success: false, error: `هذه الطلبية أُرسلت مسبقاً لفانكس (كود: ${row.vanex_package_code || row.vanex_package_id})` };
    }

    const order = mapSupabaseRowToOrder(row);

    // جلب شركة التوصيل من Supabase
    const { data: courierData } = await supabase
      .from('couriers')
      .select('*')
      .eq('id', order.courierCompanyId)
      .single();

    const courier = courierData ? {
      id: courierData.id,
      name: courierData.name,
      isApiConnected: courierData.is_api_connected,
      apiCredentials: courierData.api_credentials,
      apiProvider: courierData.api_provider,
      provider: courierData.provider,
    } : null;
    if (!courier) return { success: false, error: 'لا توجد شركة توصيل مرتبطة بهذه الطلبية' };
    if (!courier.isApiConnected || !courier.apiCredentials?.token) {
      return { success: false, error: `شركة ${courier.name} غير مربوطة بـ API — اربط حسابك أولاً من إدارة الشركات` };
    }
    if (!courier.apiProvider || courier.apiProvider === 'none') {
      return { success: false, error: 'هذه الشركة لا تدعم الإرسال التلقائي' };
    }

    const cityMapping = state.shippingCityMappings.find(
      (m: any) => m.bunyanCityName === order.customerCity && m.is_active
    );
    if (!cityMapping) {
      return {
        success: false,
        error: `المدينة "${order.customerCity}" غير مربوطة بنظام VanEx — تواصل مع المسؤول لإضافة الربط`,
      };
    }

    const priceForCourier =
      order.prepaid_amount && order.prepaid_amount > 0
        ? Math.max(0, order.total - order.prepaid_amount)
        : order.total;

    const payload = {
      type: 1 as const,
      receiverName: order.customerName,
      receiverPhone: order.customerPhone,
      cityId: cityMapping.provider_city_id,
      subCityId: order.vanexSubCityId,
      address: order.customerAddress || order.customerCity,
      price: priceForCourier,
      description: order.items.map((i: any) => `${i.productName} × ${i.quantity}`).join('، '),
      qty: order.items.reduce((sum: number, i: any) => sum + i.quantity, 0),
      notes: order.notes,
      commissionBy: (order.commission_by ?? 'customer') as 'customer' | 'market',
      paidBy: (order.commission_by ?? 'customer') as 'customer' | 'market',
      extraSizeBy: (order.extra_size_by ?? 'customer') as 'customer' | 'market',
      paymentMethod: order.is_online_payable ? ('online' as const) : ('cash' as const),
      storeReferenceId: order.orderNumber,
    };

    try {
      const { getDeliveryAdapter } = await import('../../delivery');
      if (!courier.apiProvider) return { success: false, error: 'المحول غير محدد' };
      const adapter = getDeliveryAdapter(courier.apiProvider);
      const result = await adapter.createShipment(payload, courier.apiCredentials.token);

      if (result.success && result.trackingCode) {
        // ═══ حفظ بيانات فانكس في Supabase مباشرة ═══
        const vanexPackageId = typeof result.internalId === 'number' ? result.internalId : null;
        const { error: updateError } = await supabase
          .from('orders')
          .update({
            status: 'ready_to_ship',
            vanex_package_code: result.trackingCode,
            vanex_package_id: vanexPackageId,
            courier_raw_status: result.rawStatus ?? 'pending',
          })
          .eq('id', orderId);

        if (updateError) {
          console.error('[sendOrderToVanex] Failed to save to Supabase:', updateError.message);
          // الشحنة أُرسلت لفانكس بنجاح لكن فشل حفظها محلياً
          return { success: true, error: 'تم الإرسال لفانكس لكن فشل التحديث في قاعدة البيانات — أعد تحميل الصفحة' };
        }

        return { success: true, trackingCode: result.trackingCode, packageId: vanexPackageId };
      } else {
        return { success: false, error: result.error || 'فشل إرسال الشحنة لـ VanEx' };
      }
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'خطأ غير متوقع في الاتصال بـ VanEx',
      };
    }
  },

  fetchVanexCities: async () => {
    const state = get();
    if (state.vanexCities.length > 0) return { success: true };

    try {
      const { getDeliveryAdapter } = await import('../../delivery');
      const adapter = getDeliveryAdapter('vanex');

      const saCourier = state.superAdminCouriers.find(
        (c: SuperAdminCourier) => c.provider === 'vanex' && c.isActive
      );

      if (!saCourier || !saCourier.apiCredentials?.token) {
        set({
          vanexCities: [
            { id: 1, name: 'طرابلس', nameEn: 'Tripoli', code: 'TRP', regionId: 1, active: true },
            { id: 2, name: 'بنغازي', nameEn: 'Benghazi', code: 'BEN', regionId: 2, active: true },
            { id: 3, name: 'مصراتة', nameEn: 'Misrata', code: 'MIS', regionId: 3, active: true },
            { id: 4, name: 'الزاوية', nameEn: 'Zawiya', code: 'ZAW', regionId: 1, active: true },
            { id: 5, name: 'سرت', nameEn: 'Sirte', code: 'SRT', regionId: 3, active: true },
            { id: 6, name: 'ترهونة', nameEn: 'Tarhuna', code: 'TRH', regionId: 1, active: true },
          ],
        });
        return { success: true };
      }

      const token = saCourier.apiCredentials?.token;
      const cities = await adapter.getCities(token);
      set({ vanexCities: cities });
      return { success: true };
    } catch (err) {
      return { success: false, error: 'خطأ أثناء جلب المدن' };
    }
  },

  authenticateSeedVanex: async (email, passwordHash) => {
    try {
      const { getDeliveryAdapter } = await import('../../delivery');
      const adapter = getDeliveryAdapter('vanex');
      const result = await adapter.authenticate({ email, password: passwordHash });

      if (result.success && result.token) {
        set((state: any) => ({
          superAdminCouriers: state.superAdminCouriers.map((c: SuperAdminCourier) =>
            c.provider === 'vanex'
              ? { ...c, apiCredentials: { email, passwordHash, token: result.token } }
              : c
          ),
        }));
        return { success: true };
      }
      return { success: false, error: result.error || 'فشل المصادقة' };
    } catch (err) {
      return { success: false, error: 'حدث خطأ في الاتصال' };
    }
  },

  fetchVanexSeedSubCities: async (cityId) => {
    const state = get();
    if (state.vanexSubCities[cityId]) return { success: true };

    const saCourier = state.superAdminCouriers.find(
      (c: SuperAdminCourier) => c.provider === 'vanex' && c.isActive
    );
    if (!saCourier?.apiCredentials?.token) {
      return { success: false, error: 'غير مسجل الدخول بحساب البذور' };
    }

    try {
      const { getDeliveryAdapter } = await import('../../delivery');
      const adapter = getDeliveryAdapter('vanex');

      if (!('getSubCities' in adapter) || typeof adapter.getSubCities !== 'function') {
        return { success: false, error: 'المحول لا يدعم جلب المناطق' };
      }

      const subCities = await adapter.getSubCities(cityId);
      set((s: any) => ({
        vanexSubCities: { ...s.vanexSubCities, [cityId]: subCities },
      }));
      return { success: true };
    } catch (err) {
      return { success: false, error: 'خطأ أثناء جلب المناطق' };
    }
  },

  fetchVanexSubCities: async (cityId, courierId) => {
    const state = get();
    if (state.vanexSubCities[cityId]) return { success: true };

    const courier = state.couriers.find((c: any) => c.id === courierId);
    if (!courier?.isApiConnected || !courier.apiCredentials?.token) {
      return { success: false, error: 'الشركة غير مربوطة بـ API' };
    }

    try {
      const { getDeliveryAdapter } = await import('../../delivery');
      if (!courier.apiProvider) return { success: false, error: 'المحول غير محدد' };
      const adapter = getDeliveryAdapter(courier.apiProvider);

      if (!('getSubCities' in adapter) || typeof adapter.getSubCities !== 'function') {
        return { success: false, error: 'المحول لا يدعم جلب المناطق' };
      }

      const subCities = await adapter.getSubCities(cityId);
      set((s: any) => ({
        vanexSubCities: { ...s.vanexSubCities, [cityId]: subCities },
      }));
      return { success: true };
    } catch (err) {
      return { success: false, error: 'خطأ أثناء جلب المناطق' };
    }
  },

  fetchVanexSettlements: async (courierId) => {
    try {
      // استدعاء API الخلفية التي تقوم بالتحقق من الربط وحفظ التسويات
      const res = await fetch('/api/vanex/settlements/fetch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ courierId }),
      });

      const result = await res.json();

      if (!result.success && result.error) {
        return { success: false, error: result.error };
      }

      // البيانات محفوظة في DB — React Query سيُعيد جلبها أوتوماتيكياً
      // (الـ useSettlementsQuery في settlements page ستعمل بـ staleTime=2min)
      return { success: true, count: result.inserted ?? 0 };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'خطأ في جلب التسويات',
      };
    }
  },


  applyVanexSettlement: async (settlementId, tenantId) => {
    try {
      const { useAuthStore } = await import('../../auth/store');
      const user = useAuthStore.getState().user;
      
      const res = await fetch('/api/settlements/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          settlementId,
          tenantId,
          createdBy: user?.fullName || user?.email || 'System'
        })
      });
      
      const result = await res.json();
      if (!result.success) throw new Error(result.error);

      // We still update local state for immediate feedback, 
      // but React Query will handle the source of truth
      set((st: any) => ({
        vanexSettlements: st.vanexSettlements.map((s: VanexSettlement) =>
          s.id === settlementId ? { ...s, status: 'applied' as const, appliedAt: new Date().toISOString() } : s
        ),
      }));

      return { success: true };
    } catch (err: any) {
      console.error('Error applying settlement:', err.message);
      return { success: false, error: err.message };
    }
  },
});
