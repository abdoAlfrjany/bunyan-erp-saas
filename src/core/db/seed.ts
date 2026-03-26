// src/core/db/seed.ts
// الوظيفة: بيانات تجريبية مبدئية لمتجر واحد فقط للتجربة (وباقي الجداول فارغة)
// الصلاحية: يُستخدم لإعداد النظام عند أول تشغيل

export * from '../types';
import {
  UserPermissions, TenantUser, Notification, Tenant, Product, Order,
  CourierCompany, Partner, Employee, Debt, TreasuryAccount,
  TreasuryTransaction, Subscription, VanexSettlement
} from '../types';

export const FULL_OWNER_PERMISSIONS: UserPermissions = {
  inventory: { view: true, add: true, edit: true, delete: true, viewCostPrice: true },
  orders: { view: true, add: true, edit: true, delete: true, changeStatus: true, viewAll: true },
  delivery: { view: true, addShipment: true, manageCompanies: true, viewSettlements: true, addSettlement: true },
  treasury: { view: true, addTransaction: true },
  partners: { view: true, viewOwn: false },
  hr: { view: true, viewOwn: false },
  analytics: { view: true, viewFull: true },
  settings: { view: true, edit: true },
};

export const SALES_EMPLOYEE_PERMISSIONS: UserPermissions = {
  inventory: { view: true, add: false, edit: false, delete: false, viewCostPrice: false },
  orders: { view: true, add: true, edit: false, delete: false, changeStatus: true, viewAll: false },
  delivery: { view: true, addShipment: true, manageCompanies: false, viewSettlements: false, addSettlement: false },
  treasury: { view: false, addTransaction: false },
  partners: { view: false, viewOwn: false },
  hr: { view: false, viewOwn: true },
  analytics: { view: false, viewFull: false },
  settings: { view: false, edit: false },
};

export const PARTNER_PERMISSIONS: UserPermissions = {
  inventory: { view: true, add: false, edit: false, delete: false, viewCostPrice: false },
  orders: { view: true, add: true, edit: false, delete: false, changeStatus: true, viewAll: false },
  delivery: { view: true, addShipment: false, manageCompanies: false, viewSettlements: false, addSettlement: false },
  treasury: { view: false, addTransaction: false },
  partners: { view: false, viewOwn: true },
  hr: { view: false, viewOwn: false },
  analytics: { view: true, viewFull: false },
  settings: { view: false, edit: false },
};

// ═══════════════════════════════════════════
// SEED DATA
// ═══════════════════════════════════════════



// ═══ المتاجر ═══
export const SEED_TENANTS: Tenant[] = [];

// ═══ المستخدمون ═══
export const SEED_USERS: TenantUser[] = [];

// ═══ الخزينة ═══
export const SEED_TREASURY: TreasuryAccount[] = [];

// ═══ ربط مدن بنيان بمدن VanEx (مهم لبقاء دمج الـ API يعمل) ═══
export const SEED_CITY_MAPPINGS: import('../types').ShippingCityMapping[] = [
  { id: 'cm-1',  provider: 'vanex', bunyanCityName: 'طرابلس',    bunyan_city_id: 1, parent_mapping_id: null, provider_city_id: 1,  providerCityName: 'Tripoli',    is_active: true },
  { id: 'cm-2',  provider: 'vanex', bunyanCityName: 'بنغازي',    bunyan_city_id: 2, parent_mapping_id: null, provider_city_id: 2,  providerCityName: 'Benghazi',   is_active: true },
  { id: 'cm-3',  provider: 'vanex', bunyanCityName: 'مصراتة',    bunyan_city_id: 3, parent_mapping_id: null, provider_city_id: 3,  providerCityName: 'Misrata',    is_active: true },
  { id: 'cm-4',  provider: 'vanex', bunyanCityName: 'الزاوية',   bunyan_city_id: 4, parent_mapping_id: null, provider_city_id: 4,  providerCityName: 'Zawiya',     is_active: true },
  { id: 'cm-5',  provider: 'vanex', bunyanCityName: 'سرت',       bunyan_city_id: 5, parent_mapping_id: null, provider_city_id: 5,  providerCityName: 'Sirte',      is_active: true },
  { id: 'cm-6',  provider: 'vanex', bunyanCityName: 'ترهونة',    bunyan_city_id: 6, parent_mapping_id: null, provider_city_id: 6,  providerCityName: 'Tarhuna',    is_active: true },
  { id: 'cm-7',  provider: 'vanex', bunyanCityName: 'غريان',     bunyan_city_id: 7, parent_mapping_id: null, provider_city_id: 7,  providerCityName: 'Gharyan',    is_active: true },
  { id: 'cm-8',  provider: 'vanex', bunyanCityName: 'الزنتان',   bunyan_city_id: 8, parent_mapping_id: null, provider_city_id: 8,  providerCityName: 'Zintan',     is_active: true },
  { id: 'cm-9',  provider: 'vanex', bunyanCityName: 'زليتن',     bunyan_city_id: 9, parent_mapping_id: null, provider_city_id: 9,  providerCityName: 'Zliten',     is_active: true },
  { id: 'cm-10', provider: 'vanex', bunyanCityName: 'الخمس',     bunyan_city_id: 10,parent_mapping_id: null, provider_city_id: 10, providerCityName: 'Al-Khums',   is_active: true },
  { id: 'cm-11', provider: 'vanex', bunyanCityName: 'صبراتة',    bunyan_city_id: 11,parent_mapping_id: null, provider_city_id: 11, providerCityName: 'Sabratha',   is_active: true },
  { id: 'cm-12', provider: 'vanex', bunyanCityName: 'البيضاء',   bunyan_city_id: 12,parent_mapping_id: null, provider_city_id: 12, providerCityName: 'Al-Bayda',   is_active: true },
  { id: 'cm-13', provider: 'vanex', bunyanCityName: 'درنة',      bunyan_city_id: 13,parent_mapping_id: null, provider_city_id: 13, providerCityName: 'Derna',      is_active: true },
  { id: 'cm-14', provider: 'vanex', bunyanCityName: 'طبرق',      bunyan_city_id: 14,parent_mapping_id: null, provider_city_id: 14, providerCityName: 'Tobruk',     is_active: true },
  { id: 'cm-15', provider: 'vanex', bunyanCityName: 'أجدابيا',   bunyan_city_id: 15,parent_mapping_id: null, provider_city_id: 15, providerCityName: 'Ajdabiya',   is_active: true },
  { id: 'cm-16', provider: 'vanex', bunyanCityName: 'تاجوراء',   bunyan_city_id: 16,parent_mapping_id: null, provider_city_id: 16, providerCityName: 'Tajoura',    is_active: true },
  { id: 'cm-17', provider: 'vanex', bunyanCityName: 'جنزور',     bunyan_city_id: 17,parent_mapping_id: null, provider_city_id: 17, providerCityName: 'Janzur',     is_active: true },
  { id: 'cm-18', provider: 'vanex', bunyanCityName: 'بني وليد',  bunyan_city_id: 18,parent_mapping_id: null, provider_city_id: 18, providerCityName: 'Bani Walid', is_active: true },
];

// ═══════════════════════════════════════════
// Empty arrays for everything else to clear all test data
// ═══════════════════════════════════════════
export const SEED_NOTIFICATIONS: Notification[] = [];
export const SEED_PRODUCTS: Product[] = [];
export const SEED_COURIERS: CourierCompany[] = [];
export const SEED_PARTNERS: Partner[] = [];
export const SEED_EMPLOYEES: Employee[] = [];
export const SEED_ORDERS: Order[] = [];
export const SEED_CUSTOMERS: import('../types').Customer[] = [];
export const SEED_DEBTS: Debt[] = [];
export const SEED_TRANSACTIONS: TreasuryTransaction[] = [];
export const SEED_SUBSCRIPTIONS: Subscription[] = [];
export const SEED_VANEX_SETTLEMENTS: VanexSettlement[] = [];
