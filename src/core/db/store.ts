// src/core/db/store.ts
// ══════════════════════════════════════════════════════════════════
// ROOT STORE — نقطة التجميع (Root Combiner) فقط
// ══════════════════════════════════════════════════════════════════
// القاعدة المعمارية: لا تضف أي State أو دالة هنا مباشرة.
// كل حالة أو دالة جديدة تُضاف في الـ Slice المختص داخل slices/
//
// الهيكل:
//   slices/coreSlice.ts          ← Couriers, Debts, Tenants, Treasury, Users, Notifications, Super Admin
//   slices/productsSlice.ts      ← المنتجات + WAC + حماية الخزينة
//   slices/ordersSlice.ts        ← دورة الطلبيات + خصم المخزون
//   slices/partnersEmployeesSlice.ts ← الشركاء + الموظفين + الرواتب
//   slices/geoMappingSlice.ts    ← Supabase geo_mappings
//   slices/deliverySlice.ts      ← VanEx API + التسويات + المدن
// ══════════════════════════════════════════════════════════════════

import { create } from 'zustand';
import {
  SEED_TENANTS, SEED_TREASURY, SEED_USERS,
} from './seed';

// ── Slice imports ──
import { createCoreSlice, type CoreSlice } from './slices/coreSlice';
import { createProductsSlice, type ProductsSlice } from './slices/productsSlice';
import { createOrdersSlice, type OrdersSlice } from './slices/ordersSlice';
import { createPartnersEmployeesSlice, type PartnersEmployeesSlice } from './slices/partnersEmployeesSlice';
import { createGeoMappingSlice, type GeoMappingSlice } from './slices/geoMappingSlice';
import { createDeliverySlice, type DeliverySlice } from './slices/deliverySlice';

// ── Combined State Type ──
export type DataState = CoreSlice & ProductsSlice & OrdersSlice & PartnersEmployeesSlice & GeoMappingSlice & DeliverySlice & {
  resetDatabase: () => void;
};

// ── Provider Auth Store (مستقل لجلسة ربط City Mappings) ──
// مُعرَّف في providerAuthStore.ts — يُعاد تصديره هنا للتوافق مع الاستيرادات القديمة
export { useProviderAuthStore, type ProviderAuthState } from './providerAuthStore';

// ══════════════════════════════════════════════════════════════════
// MAIN STORE — الدمج الكامل
// ══════════════════════════════════════════════════════════════════
export const useDataStore = create<DataState>()(
  (...args) => {
    const [set] = args;
    return {
      // ── دمج الـ Slices أولاً (تُعرّف القيم الابتدائية كـ []) ──
      ...createCoreSlice(...args),
      ...createProductsSlice(...args),
      ...createOrdersSlice(...args),
      ...createPartnersEmployeesSlice(...args),
      ...createGeoMappingSlice(...args),
      ...createDeliverySlice(...args),

      // ── لا يوجد بيانات وهمية (SEED) تتجاوز الحالة الابتدائية بعد الآن ──
      // الاعتماد الكلي على Supabase لجلب البيانات

      // ── Reset DB (يعيد كل الحالة للـ Seed) ──
      resetDatabase: () => {
        set({
          tenants: SEED_TENANTS,
          users: SEED_USERS,
          treasury: SEED_TREASURY,
          products: [],
          orders: [],
          couriers: [],
          partners: [],
          employees: [],
          debts: [],
          transactions: [],
          subscriptions: [],
          notifications: [],
          customers: [],
          announcements: [],
          auditLogs: [],
          customCategories: {},
          customUnits: {},
          shippingCityMappings: [],
          shippingRegionMappings: [],
          bunyanCities: [],
          bunyanRegions: [],
          superAdminCouriers: [
            {
              id: 'sac-1',
              provider: 'vanex' as const,
              name: 'VanEx Logistics',
              isActive: true,
            },
          ],
          vanexCities: [],
          vanexSettlements: [],
          vanexSubCities: {},
        });
      },
    };
  }
);
