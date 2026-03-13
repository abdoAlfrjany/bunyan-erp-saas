# 2_DATABASE_SCHEMA.md — هيكل قاعدة البيانات (الواقع الحالي - الإصدار 3.3)

# ⚠️ النظام يعتمد حالياً على Zustand + LocalStorage (Persist) كمحرك بيانات

# وسيتم نقل هذا المخطط إلى Supabase SQL لاحقاً عند النشر الإنتاجي.

---

## 📌 الحقول الأساسية في كل واجهة (Interface)

كل كيان في النظام يمتلك `id` كسلسلة فريدة، و `tenantId` يحدد هوية المتجر المالك للبيانات لضمان العزل التام للمخازن.

---

## ══════════════════════════════════════════

## 🌐 الطبقة الصفرية — Super Admin

## ══════════════════════════════════════════

### `Tenant` (المتجر)

```typescript
interface Tenant {
  id: string; // مثال: 't1' أو UUID
  name: string; // اسم المتجر
  ownerEmail: string; // البريد الإلكتروني للمالك
  plan: "trial" | "basic" | "pro" | "lifetime";
  isActive: boolean; // يحدد ما إذا كان المتجر يمكنه العمل أم موقوف (Kill-Switch)
  createdAt: string;
}
```

### `TenantUser` (مستخدمو المتاجر)

هو الجدول الفعلي للمستخدمين داخل أي متجر (يستطيعون الدخول به عبر `login`).

```typescript
interface TenantUser {
  id: string;
  tenantId: string;
  fullName: string;
  email: string;
  passwordHash: string; // حالياً: btoa(password) كـ Mock
  role: "owner" | "partner" | "employee"; // دور المستخدم
  permissions: UserPermissions; // كائن يحدد بدقة 100% ما يستطيع عمله
  phone?: string;
  isActive: boolean;
  createdAt: string;
}
```

#### `UserPermissions` (الصلاحيات المطبّقة بالكامل للصلاحيات)

```typescript
interface UserPermissions {
  inventory: {
    view: boolean;
    add: boolean;
    edit: boolean;
    delete: boolean;
    viewCostPrice: boolean;
  };
  orders: {
    view: boolean;
    add: boolean;
    edit: boolean;
    delete: boolean;
    changeStatus: boolean;
    viewAll: boolean;
  };
  delivery: {
    view: boolean;
    addShipment: boolean;
    manageCompanies: boolean;
    viewSettlements: boolean;
    addSettlement: boolean;
  };
  treasury: { view: boolean; addTransaction: boolean };
  partners: { view: boolean; viewOwn: boolean };
  hr: { view: boolean; viewOwn: boolean };
  analytics: { view: boolean; viewFull: boolean };
  settings: { view: boolean; edit: boolean };
}
```

---

## ══════════════════════════════════════════

## 📦 وحدة المخزون والطلبيات

## ══════════════════════════════════════════

### `Product` (المنتجات)

```typescript
interface Product {
  id: string;
  tenantId: string;
  name: string;
  category: string; // "منتج عادي" | "أحذية" | "ملابس" | أو اسم الصنف المخصص
  unit: string;
  costPrice: number; // مرتبطة مباشرة بإدخالات الخزينة وحركاتها المالية التلقائية
  sellingPrice: number;
  quantity: number;
  minQuantity: number;
  isActive: boolean;
  itemCode: string; // كود تلقائي يبدأ من 1000، يُعرض في الواجهة مع بادئة BN مثل BN1000
  barcode?: string;
  productType: "simple" | "clothing" | "shoes" | "custom";
  variants?: {
    id: string;
    size?: string;
    color?: string;
    sku?: string;
    attributes?: Record<string, string>;
    quantity: number;
  }[];
  customAttributes?: { key: string; value: string }[];
  attributeConfig?: { name: string; values: string[] }[]; // إعدادات الخصائص لتوليد المصفوفة
}
```

### `Order` (المبيعات)

```typescript
interface Order {
  id: string;
  tenantId: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  total: number;
  status: "pending" | "delivered" | "cancelled";
  courierId?: string; // يتم ربط الطلبية بشركة توصيل (إلزامي إذا تم التوصيل الخارجي)
  shipmentTracking?: string;
  createdBy: string; // إجباري — يجب تعبئته عند إنشاء الطلبية
  createdAt: string;

  // ══ حقول شركات التوصيل الخارجية ══
  courier_raw_status?: string;      // حالة الشركة التفصيلية — للعرض فقط لا تؤثر على الخزينة
  is_online_payable?: boolean;      // دفع إلكتروني عبر المندوب (عمولة 2% في التسويات)
  commission_by?: 'customer' | 'market'; // من يدفع رسوم التوصيل
  extra_size_by?: 'customer' | 'market'; // من يدفع رسوم الحجم الزائد
  prepaid_amount?: number;          // مبلغ دفعه الزبون مسبقاً (حوالة)
  partial_delivery?: boolean;       // تسليم جزئي مفعّل
  vanex_package_code?: string;      // كود الشحنة في VanEx مثال: VNX123456
  vanex_package_id?: number;        // ID الداخلي في VanEx
}
```

---

## ══════════════════════════════════════════

## 🚚 وحدة التوصيل والتسويات (Courier Companies)

## ══════════════════════════════════════════

### `CourierCompany` (الشركات)

```typescript
interface CourierCompany {
  id: string;
  tenantId: string;
  name: string;
  defaultDeliveryFee: number; // رسوم التوصيل الافتراضية

  pricingZones: {
    zone: string;
    fee: number;
  }[];

  requiredFields: {
    key: string;
    label: string;
    type: string;
    required: boolean;
  }[];

  totalShipments: number;
  totalDelivered: number;
  totalReturned: number;
  pendingAmount: number; // ديون عالقة بحوزة الشركة قيد التحصيل

  isActive: boolean;

  // ══ حقول ربط الـ API ══
  apiProvider?: 'vanex' | 'mock' | 'none';
  isApiConnected?: boolean;
  connectionStatus?: 'connected' | 'disconnected' | 'error' | 'pending';
  apiCredentials?: {
    email?: string;
    passwordHash?: string;   // btoa(password) مؤقتاً
    merchantCode?: string;
    token?: string;
    tokenExpiresAt?: string;
  };
}
```

### `IDeliveryProvider` (واجهة محوّلات التوصيل)

الملف: src/core/delivery/IDeliveryProvider.ts

الشركات المدعومة حالياً:
- MockShippingAdapter (للتطوير والاختبار)
- VanexAdapter (VanEx API v1 — Production: https://app.vanex.ly/api/v1)

للإضافة شركة جديدة: أنشئ src/core/delivery/[Name]Adapter.ts 
يُطبّق IDeliveryProvider ويستدعيه getDeliveryAdapter() في index.ts


---

## ══════════════════════════════════════════

## 🤝 وحدة الشركاء وديون الاستحقاق

## ══════════════════════════════════════════

### `Partner` (الشركاء)

ملاحظة هامة: المنطق الرياضي في الـ UI يمنع إجمالي الـ `profitPercentage` لجميع الشركاء من تجاوز 100%.

```typescript
interface Partner {
  id: string;
  tenantId: string;
  name: string;
  phone: string;
  profitPercentage: number; // يجب أن يخضع للحد الأقصى (الكمية المتبقية من 100%)
  capitalContribution: number;
  deliveryFeePerOrder?: number; // رسوم التوصيل لكل طلبية
  walletBalance: number;
  debtBalance: number;
  isActive: boolean;
}
```

### `Debt` (الديون)

````typescript
interface Debt {
  id: string;
  tenantId: string;
  debtType: "internal" | "external";
  debtCategory:
    | "custody"
    | "partner_advance"
    | "employee_advance"
    | "supplier"
    | "customer";
  linkedEntityId?: string; // ID الموظف أو الشريك المرتبط
  linkedEntityType?: "employee" | "partner" | "supplier" | "customer";
  linkedEntityName: string;
  sourceReference?: string; // رقم الفاتورة/الطلبية
  amount: number;
  paidAmount: number;
  paymentHistory: { id: string; amount: number; date: string; note?: string }[];
  dueDate: string;
  status: "active" | "partial" | "paid";
  description: string;
  createdAt: string;
}

### `TreasuryTransaction` (الحركات المالية)

```typescript
interface TreasuryTransaction {
  id: string;
  tenantId: string;
  accountId: string;
  transactionType: "income" | "expense" | "sale" | "courier_settlement" | "partner_withdrawal" | "profit_distribution_record";
  amount: number;
  description: string;
  createdBy: string; // إجباري — يجب تعبئته عند تسجيل الحركة المالية
  createdAt: string;
  transactionDate: string;
}
````

````

---

## ══════════════════════════════════════════

## 👥 الموارد البشرية (HR)

## ══════════════════════════════════════════

### `Employee` (الموظفون)

ملاحظة: عند إضافة موظف إلى هذا الكيان يتم آلياً إرسال طلب لدالة `addUser` لصناعة `TenantUser` له بالمنظومة للتمكن من تسجيل الدخول والمياشرة.

```typescript
interface Employee {
  id: string;
  tenantId: string;
  name: string;
  phone: string;
  role: string;
  salary: number;
  advanceBalance: number;
  isActive: boolean;
}
````

---

## 💎 خطة التنفيذ لقواعد البيانات (Supabase Migration Plan)

بمجرد التحويل للسحابة، سيصبح هذا الهيكل هو جداول الـ `tables` التابعة لمخطط PostgreSQL:

1. سيستبدل `TenantUser` بأساسيات `auth.users` مع تعزيزها بـ Metadata.
2. ستُستخدم تقنية الـ **RLS (Row Level Security)** لتأكيد عزل `tenantId` بين التجار.
3. استبدال `Array` الـ `Zustand` بالـ `Hooks (React Query + Supabase Async)` لتقليل التحميل اللانهائي أثناء عمل الـ Client.
