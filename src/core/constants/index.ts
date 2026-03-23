// src/core/constants/index.ts
// الوظيفة: ثوابت مركزية — لا magic strings في أي مكان آخر
// المرجع: 1_SYSTEM_RULES.md

// ═══ أنواع المنتجات ═══
export const PRODUCT_TYPES = ['simple', 'clothing', 'shoes', 'custom'] as const;
export type ProductType = (typeof PRODUCT_TYPES)[number];

export const PRODUCT_TYPE_LABELS: Record<ProductType, string> = {
  simple: 'منتج عادي',
  clothing: 'ملابس',
  shoes: 'أحذية',
  custom: 'مخصص',
};

// ═══ حالات الطلبيات ═══
export const ORDER_STATUSES = [
  'pending', 'processing', 'ready_to_ship', 'with_courier',
  'with_partner', 'delivered', 'cancelled', 'pending_return', 'return_confirmed',
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

// ═══ أنواع حسابات الخزينة ═══
export const ACCOUNT_TYPES = ['cash_in_hand', 'bank', 'with_courier'] as const;
export type AccountType = (typeof ACCOUNT_TYPES)[number];

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  cash_in_hand: 'الخزينة النقدية',
  bank: 'الخزينة المصرفية',
  with_courier: 'أموال قيد التحصيل',
};

// ═══ أنواع الديون ═══
export const DEBT_CATEGORIES = [
  'supplier', 'employee_advance', 'partner_advance', 'customer', 'custody',
] as const;
export type DebtCategory = (typeof DEBT_CATEGORIES)[number];

export const DEBT_CATEGORY_LABELS: Record<DebtCategory, string> = {
  supplier: 'مورد بضاعة',
  employee_advance: 'سلفة موظف',
  partner_advance: 'سلفة شريك',
  customer: 'دين على زبون',
  custody: 'عهدة',
};

// ═══ أنواع حركات الخزينة ═══
export const TRANSACTION_TYPES = [
  'income', 'expense', 'sale', 'courier_settlement',
  'partner_withdrawal', 'profit_distribution_record',
] as const;
export type TransactionType = (typeof TRANSACTION_TYPES)[number];

// ═══ حالات الدفع ═══
export const PAYMENT_STATUSES = [
  'pending', 'with_courier_company', 'settled_to_treasury',
] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

// ═══ أدوار المستخدم ═══
export const USER_ROLES = ['owner', 'partner', 'employee', 'super_admin'] as const;
export type UserRole = (typeof USER_ROLES)[number];

// ═══ أنواع التوصيل ═══
export const DELIVERY_TYPES = ['internal', 'courier_company', 'pickup'] as const;
export type DeliveryType = (typeof DELIVERY_TYPES)[number];

// ═══ أنواع مزودي API ═══
export const API_PROVIDERS = ['vanex', 'mock', 'none'] as const;
export type ApiProvider = (typeof API_PROVIDERS)[number];

// ═══ حالات الاتصال ═══
export const CONNECTION_STATUSES = ['connected', 'disconnected', 'error', 'pending'] as const;
export type ConnectionStatus = (typeof CONNECTION_STATUSES)[number];

// ═══ مقاسات الملابس والأحذية ═══
export const SIZES_CLOTHING = ['S', 'M', 'L', 'XL', 'XXL'] as const;
export const SIZES_SHOES = ['38', '39', '40', '41', '42', '43', '44', '45'] as const;

// ═══ مصادر الطلبيات ═══
export const ORDER_SOURCES = ['direct', 'facebook', 'instagram', 'whatsapp', 'other'] as const;
export type OrderSource = (typeof ORDER_SOURCES)[number];

// ═══ الانتقالات المسموحة لحالات الطلبيات ═══
export const ALLOWED_STATUS_TRANSITIONS: Record<string, OrderStatus[]> = {
  pending: ['processing', 'cancelled'],
  processing: ['ready_to_ship', 'cancelled'],
  ready_to_ship: ['with_courier', 'with_partner', 'cancelled'],
  with_courier: ['delivered', 'pending_return'],
  with_partner: ['delivered', 'pending_return'],
  delivered: ['pending_return'],
  pending_return: ['return_confirmed'],
  cancelled: [],
  return_confirmed: [],
};

// ═══ ألوان الوحدات ═══
export const MODULE_COLORS = {
  dashboard: 'bunyan-600',
  inventory: 'blue-600',
  orders: 'orange-500',
  delivery: 'emerald-600',
  treasury: 'purple-600',
  partners: 'pink-600',
  hr: 'lime-600',
  debts: 'red-600',
  analytics: 'indigo-600',
  settings: 'slate-700',
} as const;

// ═══ قواعد التحقق من الهاتف الليبي ═══
export const LIBYAN_PHONE_REGEX = /^09[1-5]\d{7}$/;
export const LIBYAN_PHONE_PREFIXES = ['091', '092', '093', '094', '095'] as const;
