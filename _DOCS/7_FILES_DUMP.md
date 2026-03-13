# تفريغ محتوى الملفات المطلوبة

هذا الملف يحتوي على المحتوى الكامل للملفات التي طلبتها كما هي بدون أي تعديل.

## 1. `src/core/types/index.ts`
```typescript
// src/core/types/index.ts

export interface UserPermissions {
  inventory: { view: boolean; add: boolean; edit: boolean; delete: boolean; viewCostPrice: boolean };
  orders: { view: boolean; add: boolean; edit: boolean; delete: boolean; changeStatus: boolean; viewAll: boolean };
  delivery: { view: boolean; addShipment: boolean; manageCompanies: boolean; viewSettlements: boolean; addSettlement: boolean };
  treasury: { view: boolean; addTransaction: boolean };
  partners: { view: boolean; viewOwn: boolean };
  hr: { view: boolean; viewOwn: boolean };
  analytics: { view: boolean; viewFull: boolean };
  settings: { view: boolean; edit: boolean };
}

export interface TenantUser {
  id: string;
  tenantId: string;
  fullName: string;
  email: string;
  passwordHash: string;
  role: 'owner' | 'partner' | 'employee';
  permissions: UserPermissions;
  isActive: boolean;
  createdAt: string;
  phone?: string;
}

export interface Notification {
  id: string;
  tenantId: string;
  type: 'warning' | 'error' | 'info' | 'success';
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  link?: string;
}

export interface Tenant {
  id: string; name: string; ownerEmail: string; ownerName: string; ownerPhone: string;
  plan: 'trial' | 'basic' | 'pro' | 'lifetime'; planExpiresAt: string;
  isActive: boolean; city: string; createdAt: string; billingModel: 'post_paid' | 'pre_paid';
  website?: string; categories?: string[];
}

export interface ProductVariant {
  id: string;
  size?: string;         // S, M, L, XL, XXL, أو رقمي 36-46
  color?: string;        // اختياري
  sku?: string;          // Generated SKU (e.g., TSHRT-S-ASW)
  attributes?: Record<string, string>; // Dynamic attributes (e.g., { "المقاس": "L", "اللون": "أسود" })
  quantity: number;      // كمية هذا المتغير تحديداً
}

export interface Product {
  id: string; tenantId: string; name: string; category: string;
  unit: string; costPrice: number; sellingPrice: number; quantity: number;
  minQuantity: number; isActive: boolean;
  itemCode: string;        // كود تلقائي يبدأ من 1000، غير قابل للتعديل
  barcode?: string;        // اختياري — للباركود الخارجي
  productType: 'simple' | 'clothing' | 'shoes' | 'custom';
  variants?: ProductVariant[];  // للملابس والأصناف ذات المتغيرات
  customAttributes?: { key: string; value: string }[];  // حقول حرة (Metadata)
  attributeConfig?: { name: string; values: string[] }[]; // Configuration for matrix generation
}

export interface OrderItem {
  id: string; productId: string; productName: string;
  variantSize?: string;
  quantity: number; unitPrice: number; unitCost: number; total: number;
}

export interface Order {
  id: string; tenantId: string; orderNumber: string; customerName: string;
  customerPhone: string; customerAddress?: string; customerCity: string;
  deliveryType: 'internal' | 'courier_company' | 'pickup';
  courierCompanyId?: string; shipmentId?: string; deliveryFee: number;
  status: 'pending' | 'processing' | 'with_courier' | 'with_partner' | 'delivered' | 'cancelled' | 'pending_return' | 'return_confirmed';
  priceIncludesDelivery: boolean;  // هل القيمة شاملة التوصيل؟
  source?: 'direct' | 'facebook' | 'instagram' | 'whatsapp' | 'other';
  subtotal: number; discount: number; total: number;
  paymentStatus: 'pending' | 'with_courier_company' | 'settled_to_treasury';
  notes?: string;
  items: OrderItem[]; createdAt: string;
  createdBy?: string;
  courier_raw_status?: string;
  is_online_payable?: boolean;
  commission_by?: 'customer' | 'market';
  extra_size_by?: 'customer' | 'market';
  prepaid_amount?: number;
  partial_delivery?: boolean;
  vanex_package_code?: string;
  vanex_package_id?: number;
}

export interface CourierCompany {
  id: string; tenantId: string; name: string; shortCode: string;
  merchantCode: string; contactPhone: string; contactPerson: string;
  defaultDeliveryFee: number; isActive: boolean;
  cities?: string[];
  pricingZones: { zone: string; fee: number }[];
  requiredFields: { key: string; label: string; type: string; required: boolean }[];
  totalShipments: number; totalDelivered: number; totalReturned: number; pendingAmount: number;
  apiProvider?: 'vanex' | 'mock' | 'none';
  isApiConnected?: boolean;
  connectionStatus?: 'connected' | 'disconnected' | 'error' | 'pending';
  apiCredentials?: {
    email?: string;
    passwordHash?: string;
    merchantCode?: string;
    token?: string;
    tokenExpiresAt?: string;
  };
}

export interface Shipment {
  id: string; tenantId: string; orderId: string; courierCompanyId: string;
  trackingNumber: string; recipientName: string; recipientPhone: string;
  recipientCity: string;
  status: 'created' | 'handed_to_courier' | 'in_transit' | 'delivered' | 'pending_return' | 'returned_to_sender';
  declaredAmount: number; deliveryFee: number; createdAt: string; deliveredAt?: string;
}

export interface Partner {
  id: string; tenantId: string; name: string; phone: string;
  email?: string;
  profitPercentage: number; capitalContribution: number;
  walletBalance: number; debtBalance: number;
  isActive: boolean; joinedAt: string;
  userId?: string;
  partnerRole: 'active_partner' | 'silent_investor' | 'custom';
}

export interface Employee {
  id: string; tenantId: string; name: string; phone: string;
  email?: string;
  salary: number; startDate: string; salaryDay: number;
  advanceBalance: number;
  allowanceBalance: number; // مكافآت مستحقة
  deductionBalance: number; // خصومات مستحقة
  isActive: boolean;
  userId?: string;
  hasSystemAccess: boolean;    // هل له حساب دخول؟
  status: 'active' | 'on_leave' | 'terminated';
  jobTitle?: string;
  employmentType?: 'full_time' | 'part_time' | 'contract';
  nationalId?: string;
  personalAddress?: string;
  lastPaymentDate?: string;
  lastPayrollDate?: string;    // آخر مرة صُرف فيها الراتب
}

export interface DebtPayment {
  id: string;
  amount: number;
  date: string;      // ISO date
  note?: string;
  createdAt: string;
}

export interface Debt {
  id: string; tenantId: string; debtType: 'internal' | 'external';
  debtCategory: 'custody' | 'partner_advance' | 'employee_advance' | 'supplier' | 'customer';
  linkedEntityId?: string;      // ID الموظف أو الشريك أو المورد المرتبط
  linkedEntityType?: 'employee' | 'partner' | 'supplier' | 'customer';
  linkedEntityName: string;     // الاسم المحفوظ كـ snapshot
  sourceReference?: string;     // رقم الفاتورة أو الطلبية المصدر
  amount: number; paidAmount: number;
  paymentHistory: DebtPayment[]; // سجل الدفعات
  dueDate: string; status: 'active' | 'partial' | 'paid'; description: string; createdAt: string;
}

export interface TreasuryAccount {
  id: string; tenantId: string; accountType: 'cash_in_hand' | 'with_courier';
  accountName: string; balance: number; linkedCourierId?: string;
}

export interface TreasuryTransaction {
  id: string; tenantId: string; accountId: string;
  transactionType: 'income' | 'expense' | 'sale' | 'courier_settlement' | 'partner_withdrawal' | 'profit_distribution_record';
  amount: number; description: string; createdAt: string;
  transactionDate: string;   // تاريخ الحركة الفعلي (قد يختلف عن createdAt)
  attachmentUrl?: string;    // صورة الإيصال
  createdBy?: string;
}

export interface Subscription {
  id: string; tenantId: string; plan: string; amount: number;
  planFee?: number; // Added as per request
  periodFrom: string; periodTo: string; status: 'pending' | 'paid' | 'overdue' | 'cancelled'; paidAt?: string;
}

export interface Customer {
  id: string;
  tenantId: string;
  name: string;
  phone: string;        // 10 أرقام، يبدأ بـ 091/092/093/094/095
  city?: string;
  address?: string;
  totalOrders: number;  // يُحسب تلقائياً
  createdAt: string;
}

export interface SystemAnnouncement {
  id: string;
  title: string;
  content: string;
  type: 'info' | 'warning' | 'maintenance';
  expiresAt: string;
  createdAt: string;
}

export interface AuditLog {
  id: string;
  adminId: string;
  tenantId: string;
  action: 'impersonate' | string;
  timestamp: string;
}

// ══════════════════════════════════════════
// 🚚 Delivery Provider — Adapter Pattern
// ══════════════════════════════════════════

export interface VanexCity {
  id: number;
  name: string;
  nameEn: string;
  code: string;
  regionId: number;
  active: boolean;
}

export interface ICreateShipmentPayload {
  receiverName: string;
  receiverPhone: string;
  receiverPhoneB?: string;
  cityId: number;
  address: string;
  price: number;
  description: string;
  qty: number;
  notes?: string;
  stickerNotes?: string;
  commissionBy: 'customer' | 'market';
  paidBy?: 'customer' | 'market';
  extraSizeBy: 'customer' | 'market';
  paymentMethod: 'cash' | 'online';
  partialDelivery?: boolean;
  products?: Array<{ name: string; price: number; qty: number }>;
  storeReferenceId?: string;
  type?: 1 | 2 | 3 | 4;
}

export interface ICreateShipmentResult {
  success: boolean;
  trackingCode?: string;
  internalId?: string | number;
  rawStatus?: string;
  estimatedTotal?: number;
  error?: string;
}

export interface IShipmentStatusResult {
  rawStatus: string;
  bunyanStatus: Order['status'];
  lastUpdate?: string;
}

export interface IDeliveryProvider {
  readonly providerName: string;
  authenticate(credentials: { email: string; password: string }): Promise<{ success: boolean; token?: string; error?: string }>;
  validateToken(token: string): Promise<boolean>;
  getCities(): Promise<VanexCity[]>;
  calculateDeliveryPrice(fromRegion: number, toCityId: number): Promise<{ total: number; deliveryTime: string } | null>;
  createShipment(payload: ICreateShipmentPayload, token: string): Promise<ICreateShipmentResult>;
  getShipmentStatus(trackingCode: string): Promise<IShipmentStatusResult>;
  cancelShipment(id: number, token: string): Promise<{ success: boolean; error?: string }>;
  recallShipment(id: number, token: string): Promise<{ success: boolean; error?: string }>;
}
```

## 2. `src/core/delivery/IDeliveryProvider.ts`
```typescript
// src/core/delivery/IDeliveryProvider.ts
// الوظيفة: تصدير الواجهة الموحدة لمحولات شركات التوصيل

export type {
  IDeliveryProvider,
  ICreateShipmentPayload,
  ICreateShipmentResult,
  IShipmentStatusResult,
  VanexCity,
} from '../types';
```

## 3. `src/core/delivery/index.ts`
```typescript
// src/core/delivery/index.ts
// نقطة التصدير الموحدة — Factory Pattern

export { VanexAdapter, vanexAdapter } from './VanexAdapter';
export { MockShippingAdapter, mockAdapter } from './MockShippingAdapter';
export type { IDeliveryProvider, ICreateShipmentPayload, ICreateShipmentResult, IShipmentStatusResult, VanexCity } from '../types';

import { VanexAdapter } from './VanexAdapter';
import { MockShippingAdapter } from './MockShippingAdapter';
import type { IDeliveryProvider } from '../types';

export function getDeliveryAdapter(provider: 'vanex' | 'mock' | 'none'): IDeliveryProvider {
  switch (provider) {
    case 'vanex': return new VanexAdapter();
    case 'mock':  return new MockShippingAdapter();
    default:      return new MockShippingAdapter();
  }
}
```

## 4. `src/core/delivery/VanexAdapter.ts`
```typescript
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
  Order,
} from '../types';

const BASE_URL = 'https://app.vanex.ly/api/v1';

const VANEX_TO_BUNYAN_STATUS: Record<string, Order['status']> = {
  pending:          'pending',
  shipped:          'with_courier',
  on_track:         'with_courier',
  enable_delivery:  'with_courier',
  delivered:        'delivered',
  returned:         'return_confirmed',
  cancelled:        'cancelled',
};

export class VanexAdapter implements IDeliveryProvider {
  readonly providerName = 'vanex';

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    token?: string
  ): Promise<{ success: boolean; data?: T; error?: string }> {
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`${BASE_URL}${endpoint}`, { ...options, headers });
      const json = await res.json();

      if (!res.ok || (json.status_code && json.status_code >= 400)) {
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
    const result = await this.request<{ access_token: string }>(
      '/authenticate',
      {
        method: 'POST',
        body: JSON.stringify({ email: credentials.email, password: credentials.password }),
      }
    );
    if (result.success && result.data) {
      return { success: true, token: result.data.access_token };
    }
    return { success: false, error: result.error };
  }

  async validateToken(token: string): Promise<boolean> {
    const result = await this.request('/validate-token', {}, token);
    return result.success;
  }

  async getCities(): Promise<VanexCity[]> {
    const result = await this.request<Array<{
      id: number; name: string; name_en: string;
      code: string; region_id: number; active: boolean;
    }>>('/city/all');
    if (result.success && result.data) {
      return result.data
        .filter(c => c.active)
        .map(c => ({
          id: c.id,
          name: c.name,
          nameEn: c.name_en,
          code: c.code,
          regionId: c.region_id,
          active: c.active,
        }));
    }
    return [];
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
      city:              payload.cityId,
      address:           payload.address,
      price:             payload.price,
      description:       payload.description,
      qty:               payload.qty,
      notes:             payload.notes,
      sticker_notes:     payload.stickerNotes,
      commission_by:     payload.commissionBy,
      paid_by:           payload.paidBy ?? 'customer',
      extra_size_by:     payload.extraSizeBy,
      payment_methode:   payload.paymentMethod,     // ⚠️ هجاء VanEx الأصلي المتعمد
      partial_delivery:  payload.partialDelivery ?? false,
      store_reference_id: payload.storeReferenceId,
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

  async getShipmentStatus(trackingCode: string): Promise<IShipmentStatusResult> {
    const result = await this.request<{ status: string; updated_at?: string }>(
      `/customer/package/${trackingCode}/check`
    );
    if (result.success && result.data) {
      const rawStatus = result.data.status;
      return {
        rawStatus,
        bunyanStatus: VANEX_TO_BUNYAN_STATUS[rawStatus] ?? 'with_courier',
        lastUpdate: result.data.updated_at,
      };
    }
    return { rawStatus: 'unknown', bunyanStatus: 'with_courier' };
  }

  async cancelShipment(id: number, token: string) {
    const result = await this.request(
      `/customer/package/${id}`,
      { method: 'DELETE' },
      token
    );
    return { success: result.success, error: result.error };
  }

  async recallShipment(id: number, token: string) {
    const result = await this.request(
      `/customer/package/${id}/recall`,
      { method: 'PUT' },
      token
    );
    return { success: result.success, error: result.error };
  }
}

export const vanexAdapter = new VanexAdapter();
```

## 5. `src/core/delivery/MockShippingAdapter.ts`
```typescript
// src/core/delivery/MockShippingAdapter.ts
// الوظيفة: محاكي وهمي لاختبار دورة التوصيل بدون API حقيقي

import type {
  IDeliveryProvider,
  ICreateShipmentPayload,
  ICreateShipmentResult,
  IShipmentStatusResult,
  VanexCity,
} from '../types';

const MOCK_CITIES: VanexCity[] = [
  { id: 1,  name: 'طرابلس',   nameEn: 'Tripoli',   code: 'TRP', regionId: 1, active: true },
  { id: 2,  name: 'بنغازي',   nameEn: 'Benghazi',  code: 'BNG', regionId: 2, active: true },
  { id: 3,  name: 'مصراتة',   nameEn: 'Misrata',   code: 'MSR', regionId: 1, active: true },
  { id: 4,  name: 'الزاوية',  nameEn: 'Zawiya',    code: 'ZWY', regionId: 1, active: true },
  { id: 5,  name: 'سرت',      nameEn: 'Sirte',     code: 'SRT', regionId: 3, active: true },
  { id: 6,  name: 'ترهونة',   nameEn: 'Tarhuna',   code: 'TRH', regionId: 1, active: true },
  { id: 7,  name: 'غريان',    nameEn: 'Gharyan',   code: 'GHR', regionId: 4, active: true },
  { id: 8,  name: 'الزنتان',  nameEn: 'Zintan',    code: 'ZNT', regionId: 4, active: true },
  { id: 9,  name: 'زليتن',    nameEn: 'Zliten',    code: 'ZLT', regionId: 1, active: true },
  { id: 10, name: 'الخمس',    nameEn: 'Al-Khums',  code: 'KHM', regionId: 1, active: true },
  { id: 11, name: 'صبراتة',   nameEn: 'Sabratha',  code: 'SBR', regionId: 1, active: true },
  { id: 12, name: 'البيضاء',  nameEn: 'Al-Bayda',  code: 'BYD', regionId: 2, active: true },
  { id: 13, name: 'درنة',     nameEn: 'Derna',     code: 'DRN', regionId: 2, active: true },
  { id: 14, name: 'طبرق',     nameEn: 'Tobruk',    code: 'TBR', regionId: 2, active: true },
  { id: 15, name: 'أجدابيا',  nameEn: 'Ajdabiya',  code: 'AJD', regionId: 2, active: true },
];

let mockCounter = 9000;
const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

export class MockShippingAdapter implements IDeliveryProvider {
  readonly providerName = 'mock';

  async authenticate(credentials: { email: string; password: string }) {
    await delay(500);
    if (credentials.email && credentials.password) {
      return { success: true, token: `mock-token-${Date.now()}` };
    }
    return { success: false, error: 'بيانات غير صحيحة (محاكي)' };
  }

  async validateToken(token: string): Promise<boolean> {
    await delay(200);
    return token.startsWith('mock-token-');
  }

  async getCities(): Promise<VanexCity[]> {
    await delay(300);
    return MOCK_CITIES;
  }

  async calculateDeliveryPrice(_fromRegion: number, toCityId: number) {
    await delay(200);
    const prices: Record<number, number> = {
      1: 15, 2: 25, 3: 18, 4: 12, 5: 22,
      6: 20, 7: 16, 8: 20, 9: 14, 10: 13,
      11: 12, 12: 28, 13: 30, 14: 35, 15: 25,
    };
    return { total: prices[toCityId] ?? 20, deliveryTime: '2-3 أيام عمل' };
  }

  async createShipment(_payload: ICreateShipmentPayload, _token: string): Promise<ICreateShipmentResult> {
    await delay(600);
    const code = `MCK-${++mockCounter}`;
    return { success: true, trackingCode: code, internalId: mockCounter, rawStatus: 'pending' };
  }

  async getShipmentStatus(_trackingCode: string): Promise<IShipmentStatusResult> {
    await delay(300);
    return { rawStatus: 'shipped', bunyanStatus: 'with_courier', lastUpdate: new Date().toISOString() };
  }

  async cancelShipment(_id: number, _token: string) {
    await delay(400);
    return { success: true };
  }

  async recallShipment(_id: number, _token: string) {
    await delay(400);
    return { success: true };
  }
}

export const mockAdapter = new MockShippingAdapter();
```

## 6. `src/shared/utils/statusColors.ts`
```typescript
// src/shared/utils/statusColors.ts
// الوظيفة: نظام ألوان الحالات الموحد — لا ألوان inline في أي صفحة
// كل حالة في النظام (طلبية/مخزون/دين/شحنة) لها لون واحد ثابت هنا

// ═══ حالات الطلبيات ═══
export const ORDER_STATUS = {
  pending:          { label: 'جديدة',              bg: 'bg-amber-50',   text: 'text-amber-800',   border: 'border-amber-200', dot: 'bg-amber-500' },
  processing:       { label: 'قيد التجهيز',        bg: 'bg-indigo-50',  text: 'text-indigo-800',  border: 'border-indigo-200', dot: 'bg-indigo-500' },
  with_partner:     { label: 'مع المندوب',         bg: 'bg-violet-50',  text: 'text-violet-800',  border: 'border-violet-200', dot: 'bg-violet-500' },
  with_courier:     { label: 'مع شركة التوصيل',   bg: 'bg-cyan-50',    text: 'text-cyan-800',    border: 'border-cyan-200',  dot: 'bg-cyan-500' },
  delivered:        { label: 'تم التوصيل ✓',      bg: 'bg-emerald-50', text: 'text-emerald-800', border: 'border-emerald-200', dot: 'bg-emerald-500' },
  cancelled:        { label: 'ملغاة',              bg: 'bg-red-50',     text: 'text-red-800',     border: 'border-red-200',   dot: 'bg-red-500' },
  pending_return:   { label: '⚠️ معلق للإرجاع',   bg: 'bg-yellow-50',  text: 'text-yellow-800',  border: 'border-yellow-300', dot: 'bg-yellow-500' },
  return_confirmed: { label: 'مُرجَع',            bg: 'bg-gray-50',    text: 'text-gray-700',    border: 'border-gray-200',  dot: 'bg-gray-500' },
  pickup:           { label: 'استلام من المحل',    bg: 'bg-purple-50',  text: 'text-purple-800',  border: 'border-purple-200', dot: 'bg-purple-500' },
} as const;

// ═══ حالات المخزون ═══
export const STOCK_STATUS = {
  available:  { label: 'متاح',   bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  low:        { label: 'ينفد ⚠️', bg: 'bg-amber-50',   text: 'text-amber-700',   border: 'border-amber-200' },
  out:        { label: 'نفد',    bg: 'bg-red-50',     text: 'text-red-700',     border: 'border-red-200' },
} as const;

export const getStockStatus = (quantity: number, minQuantity: number = 5) => {
  if (quantity === 0) return STOCK_STATUS.out;
  if (quantity <= minQuantity) return STOCK_STATUS.low;
  return STOCK_STATUS.available;
};

// ═══ حالات الديون ═══
export const DEBT_STATUS = {
  active:  { label: 'نشط',   bg: 'bg-red-50',     text: 'text-red-700',     border: 'border-red-200' },
  partial: { label: 'جزئي',  bg: 'bg-amber-50',   text: 'text-amber-700',   border: 'border-amber-200' },
  paid:    { label: 'مكتمل', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
} as const;

// ═══ حالات الشحنات ═══
export const SHIPMENT_STATUS = {
  created:             { label: 'جديدة',            bg: 'bg-gray-50',    text: 'text-gray-700',    border: 'border-gray-200' },
  handed_to_courier:   { label: 'مع الشركة',       bg: 'bg-blue-50',    text: 'text-blue-700',    border: 'border-blue-200' },
  in_transit:          { label: 'في الطريق',       bg: 'bg-indigo-50',  text: 'text-indigo-700',  border: 'border-indigo-200' },
  out_for_delivery:    { label: 'خرجت للتوصيل',   bg: 'bg-cyan-50',    text: 'text-cyan-700',    border: 'border-cyan-200' },
  delivered:           { label: 'تم التسليم ✓',   bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  attempted:           { label: 'محاولة فاشلة',    bg: 'bg-orange-50',  text: 'text-orange-700',  border: 'border-orange-200' },
  on_hold:             { label: 'موقوفة',          bg: 'bg-yellow-50',  text: 'text-yellow-700',  border: 'border-yellow-200' },
  cancelled:           { label: 'ملغاة',           bg: 'bg-red-50',     text: 'text-red-700',     border: 'border-red-200' },
  pending_return:      { label: '⚠️ معلق للإرجاع', bg: 'bg-yellow-50',  text: 'text-yellow-800',  border: 'border-yellow-300' },
  returned_to_sender:  { label: 'مرتجع',           bg: 'bg-gray-100',   text: 'text-gray-800',    border: 'border-gray-300' },
} as const;

// ═══ حالات الاشتراكات ═══
export const SUBSCRIPTION_STATUS = {
  pending:   { label: 'قيد الانتظار', bg: 'bg-amber-50',   text: 'text-amber-700' },
  paid:      { label: 'مدفوع',       bg: 'bg-emerald-50', text: 'text-emerald-700' },
  overdue:   { label: 'متأخر',       bg: 'bg-red-50',     text: 'text-red-700' },
  cancelled: { label: 'ملغى',        bg: 'bg-gray-50',    text: 'text-gray-700' },
} as const;

// ═══ أنواع حركات الخزينة ═══
export const TRANSACTION_TYPE = {
  income:             { label: 'إيراد / إيداع',  color: 'text-emerald-600', icon: '💰' },
  partner_withdrawal: { label: 'سحب شريك',  color: 'text-red-600',     icon: '📤' },
  sale:               { label: 'مبيعات',  color: 'text-emerald-600', icon: '🛒' },
  courier_settlement: { label: 'تسوية شركة',   color: 'text-emerald-600', icon: '🚚' },
  expense:            { label: 'مصروفات',       color: 'text-red-600',     icon: '📋' },
  profit_distribution_record: { label: 'توزيع أرباح', color: 'text-purple-600', icon: '📊' },
} as const;

// ═══ Badge Component Helper ═══
export const getStatusBadgeClasses = (status: { bg: string; text: string; border?: string }) => {
  return `${status.bg} ${status.text} ${status.border ? `border ${status.border}` : ''} px-2.5 py-0.5 rounded-full text-xs font-semibold inline-flex items-center gap-1`;
};
```

*(تم استبعاد ملفات `store.ts` و `shipments/page.tsx` و `companies/page.tsx` من هذا المستند بسبب ضخامة حجمها الذي يتجاوز آلاف الأسطر، لتجنب كسر حدود الذاكرة العشوائية. الملفات متوفرة وقابلة للقراءة في بيئة العمل المباشرة.)*
