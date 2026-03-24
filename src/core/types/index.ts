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
  status: 'pending' | 'processing' | 'ready_to_ship' | 'with_courier' | 'with_partner' | 'delivered' | 'cancelled' | 'pending_return' | 'return_confirmed';
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
  vanexCityId?: number;
  vanexSubCityId?: number;
  dimLength?: number;
  dimWidth?: number;
  dimHeight?: number;
  insureShipment?: boolean;
  matchShipment?: boolean;
  allowInspection?: boolean;
  fragile?: boolean;
  allowTryOn?: boolean;
  partialAllowed?: boolean;
  noHeat?: boolean;
}

export interface CourierCompany {
  id: string; tenantId: string; name: string; shortCode?: string;
  merchantCode?: string; contactPhone?: string; contactPerson?: string;
  phone?: string; trackingUrl?: string; isInternal?: boolean; provider?: 'vanex' | 'presto' | 'zajil' | 'mock' | 'none' | string;
  createdAt?: string;
  defaultDeliveryFee?: number; isActive: boolean;
  cities?: string[];
  pricingZones?: { zone: string; fee: number }[];
  requiredFields?: { key: string; label: string; type: string; required: boolean }[];
  totalShipments?: number; totalDelivered?: number; totalReturned?: number; pendingAmount?: number;
  apiProvider?: 'vanex' | 'mock' | 'none';
  isApiConnected?: boolean;
  connectionStatus?: 'connected' | 'disconnected' | 'error' | 'pending';
  apiCredentials?: {
    email?: string;
    passwordHash?: string;
    merchantCode?: string;
    token?: string;
    tokenExpiresAt?: string;
    vanexFromRegionId?: number;
  };
}

export interface SuperAdminCourier {
  id: string;
  provider: 'vanex' | 'presto' | 'zajil' | 'mock' | 'none';
  name: string;
  isActive: boolean;
  apiCredentials?: {
    email?: string;
    passwordHash?: string;
    token?: string;
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
  deliveryFeePerOrder?: number;
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
  dueDate: string; status: 'active' | 'partial' | 'paid' | 'pending'; description?: string; notes?: string; createdAt: string;
}

export interface TreasuryAccount {
  id: string; tenantId: string; accountType: 'cash_in_hand' | 'bank' | 'with_courier';
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
  phoneAlt?: string;
  city?: string;
  region?: string;
  address?: string;
  totalOrders: number;  // يُحسب تلقائياً
  successOrders?: number;
  totalSpent?: number;
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
  isActive?: boolean;
  deliveryFee?: number;
  returnFee?: number;
  hasSubRegions?: boolean;
  hasPermission?: boolean;
}

export interface VanexSubCity {
  id: number;
  name: string;
  cityId: number;
}

export interface ICreateShipmentPayload {
  receiverName: string;
  receiverPhone: string;
  receiverPhoneB?: string;
  cityId: number;
  subCityId?: number;
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
  dimLength?: number;
  dimWidth?: number;
  dimHeight?: number;
  insureShipment?: boolean;
  matchShipment?: boolean;
  allowInspection?: boolean;
  fragile?: boolean;
  allowTryOn?: boolean;
  partialAllowed?: boolean;
  noHeat?: boolean;
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

// ══════════════════════════════════════════
// 🗺️ City Mapping — ربط مدن بنيان بمدن شركات التوصيل
// ══════════════════════════════════════════
export interface BunyanCity {
  id: number;
  name_ar: string;
}

export interface BunyanRegion {
  id: number;
  city_id: number;
  name_ar: string;
}

export interface ShippingCityMapping {
  id: string; // uuid in supabase
  provider: 'vanex' | 'presto' | 'zajil' | 'mock' | 'none';
  bunyan_city_id: number | null; // ID in bunyan_cities
  bunyan_region_id?: number | null; // ID in bunyan_regions for cross-mapping
  parent_mapping_id: string | null;   // null for cities, used for regions
  provider_city_id: number; // ID المدينة في شركة التوصيل
  is_active: boolean;
  
  // UI Helpers (Not in DB directly, populated via join or manual mapping in frontend)
  bunyanCityName?: string; 
  providerCityName?: string; 
}

export interface ShippingRegionMapping {
  id: string; // uuid
  city_mapping_id: string;    // ID of provider_geo_mappings (City level)
  provider: 'vanex' | 'presto' | 'zajil' | 'mock' | 'none';
  provider_city_id: number;
  provider_region_id: number; // ID المنطقة في شركة التوصيل
  bunyan_region_id: number;   // ID in bunyan_regions
  is_active: boolean;

  // UI Helpers
  bunyanRegionName?: string; 
  providerRegionName?: string;
}

// ══════════════════════════════════════════
// 💰 VanEx Settlement — التسويات المالية
// ══════════════════════════════════════════
export interface VanexSettlement {
  id: string;
  tenantId: string;
  vanexSettlementId: number;
  settlementNumber: string;
  totalAmount: number;
  deliveryFees: number;
  bankCommission: number;
  netAmount: number;
  paymentMethod: 'cash' | 'bank_transfer' | 'online';
  targetAccountType: 'cash_in_hand' | 'bank';
  status: 'pending' | 'applied' | 'approved' | 'rejected';
  appliedAt?: string;
  createdAt: string;
  packageCount: number;
  courierCompanyId: string;
  isApproximate?: boolean;
}

export interface IDeliveryProvider {
  readonly providerName: string;
  setCredentials(email: string, passwordHash: string): void;
  authenticate(credentials: { email: string; password: string }): Promise<{ success: boolean; token?: string; error?: string }>;
  validateToken(token: string): Promise<boolean>;
  getCities(token?: string): Promise<VanexCity[]>;
  getSubCities?(cityId: number, token?: string): Promise<import('./index').VanexSubCity[]>;
  calculateDeliveryPrice(fromRegion: number, toCityId: number): Promise<{ total: number; deliveryTime: string } | null>;
  createShipment(payload: ICreateShipmentPayload, token: string): Promise<ICreateShipmentResult>;
  getShipmentStatus(trackingCode: string, token?: string): Promise<IShipmentStatusResult>;
  cancelShipment(id: number | string, token: string): Promise<{ success: boolean; error?: string }>;
  recallShipment(id: number | string, token: string, reason?: string): Promise<{ success: boolean; error?: string }>;
  getSettlements(token: string, status?: string): Promise<VanexSettlement[]>;
  getSettlementDetails(id: number | string, token: string): Promise<VanexSettlement | null>;
}
