# 5_MODULES_MAP.md — خريطة الوحدات والملفات والعلاقات

> دليل شامل للمطور الجديد لفهم هيكل المنظومة وكيفية الانطلاق.

---

## 1. خريطة الوحدات

### الوحدات الرئيسية (11 وحدة)

| #   | الوحدة             | المسار                    | الجدول/البيانات الرئيسية         | مفتوح لـ           |
| --- | ------------------ | ------------------------- | -------------------------------- | ------------------ |
| 1   | 📊 لوحة القيادة    | `app/(tenant)/dashboard/` | `orders`, `products`, `treasury` | الكل               |
| 2   | 📦 المخزون         | `app/(tenant)/inventory/` | `products`                       | Owner, موظف مخزن   |
| 3   | 🛒 الطلبيات        | `app/(tenant)/orders/`    | `orders`, `products`, `couriers` | Owner, موظف مبيعات |
| 4   | 🚚 التوصيل         | `app/(tenant)/delivery/`  | `couriers`, `orders`             | Owner, موظف توصيل  |
| 5   | 💰 الخزينة         | `app/(tenant)/treasury/`  | `treasury`, `transactions`       | Owner فقط          |
| 6   | 🤝 الشركاء         | `app/(tenant)/partners/`  | `partners`, `debts`              | Owner فقط          |
| 7   | 👥 الموارد البشرية | `app/(tenant)/hr/`        | `employees`, `users`             | Owner فقط          |
| 8   | 📑 الديون          | `app/(tenant)/debts/`     | `debts`                          | Owner فقط          |
| 9   | 📊 التحليلات       | `app/(tenant)/analytics/` | `orders`, `products`, `treasury` | Owner              |
| 10  | ⚙️ الإعدادات       | `app/(tenant)/settings/`  | `tenants`, `users`               | Owner فقط          |
| 11  | 🛡️ Super Admin     | `app/super-admin/`        | جميع `tenants`, `subscriptions`  | Super Admin        |

---

## 2. خريطة الملفات الكاملة

### ملفات الـ Core

```
src/
├── core/
│   ├── auth/
│   │   └── store.ts          ← Zustand auth store: login/logout/session/viewingAs
│   ├── db/
│   │   ├── store.ts          ← Zustand data store: CRUD لكل الجداول + منطق الأعمال
│   │   └── seed.ts           ← بيانات افتراضية للـ Demo (SEED_*)
│   ├── types/
│   │   └── index.ts          ← TypeScript interfaces لكل الكيانات
│   └── utils/
│       └── index.ts          ← generateSKU, cartesian, generateItemCode
│
├── shared/
│   ├── components/
│   │   └── ui/
│   │       ├── AddProductSlideOver.tsx  ← نموذج إضافة/تعديل منتج (مكون ضخم)
│   │       ├── SlideOver.tsx            ← Drawer/Panel عام
│   │       ├── ConfirmDialog.tsx        ← نافذة تأكيد قابلة للاستخدام في أي مكان
│   │       ├── Toast.tsx                ← نظام الإشعارات Toast (useToast hook)
│   │       └── index.ts                ← re-exports
│   └── utils/
│       ├── format.ts          ← formatCurrency, formatDate, formatNumber
│       └── statusColors.ts    ← ORDER_STATUS, STOCK_STATUS, getStockStatus, getStatusBadgeClasses
│
└── app/
    ├── layout.tsx             ← Root layout (theme providers)
    ├── middleware.ts          ← حماية المسارات بناءً على Cookie erp_auth
    ├── (auth)/                ← صفحات Login (بدون sidebar)
    │   └── login/page.tsx
    └── (tenant)/              ← صفحات المتجر (مع Sidebar)
        ├── layout.tsx         ← Sidebar + TopBar + Auth guard
        ├── dashboard/page.tsx
        ├── inventory/page.tsx
        ├── orders/page.tsx
        ├── delivery/page.tsx
        ├── treasury/page.tsx
        ├── partners/page.tsx
        ├── hr/page.tsx
        ├── debts/page.tsx
        ├── analytics/page.tsx
        └── settings/page.tsx
```

---

## 3. خريطة الـ Store (Zustand) الكاملة

### البيانات المُخزَّنة (State)

| الحقل              | النوع                        | محتواه                                     |
| ------------------ | ---------------------------- | ------------------------------------------ |
| `tenants`          | `Tenant[]`                   | بيانات المتاجر الكاملة                     |
| `products`         | `Product[]`                  | المنتجات (isActive=false = محذوف)          |
| `orders`           | `Order[]`                    | الطلبيات بكل حالاتها                       |
| `couriers`         | `CourierCompany[]`           | شركات التوصيل                              |
| `partners`         | `Partner[]`                  | الشركاء ومحافظهم                           |
| `employees`        | `Employee[]`                 | الموظفون وسلفهم ومكافآتهم                  |
| `debts`            | `Debt[]`                     | سجل الديون                                 |
| `treasury`         | `TreasuryAccount[]`          | حسابات الخزينة (نقد / شركات توصيل)         |
| `transactions`     | `TreasuryTransaction[]`      | كل الحركات المالية                         |
| `users`            | `TenantUser[]`               | حسابات الدخول                              |
| `customers`        | `Customer[]`                 | الزبائن (يُحدَّث تلقائياً من الطلبيات)     |
| `notifications`    | `Notification[]`             | الإشعارات الداخلية                         |
| `customCategories` | `Record<tenantId, string[]>` | فئات المنتجات المخصصة (معزولة بـ tenantId) |
| `customUnits`      | `string[]`                   | وحدات القياس المخصصة (عامة)                |
| `announcements`    | `SystemAnnouncement[]`       | إعلانات Super Admin                        |
| `auditLogs`        | `AuditLog[]`                 | سجل نشاط Super Admin                       |

### الدوال الرئيسية في Store

#### المنتجات

| الدالة                    | ما تفعل                                                   |
| ------------------------- | --------------------------------------------------------- |
| `addProduct(p)`           | إضافة منتج + التحقق من الخزينة + خصم التكلفة + تسجيل حركة |
| `updateProduct(id, data)` | تحديث منتج، إذا زادت الكمية: خصم WAC من الخزينة           |
| `deleteProduct(id)`       | Soft delete (isActive=false) إذا لا يوجد طلبية نشطة       |

#### الطلبيات

| الدالة                          | ما تفعل                                                                  |
| ------------------------------- | ------------------------------------------------------------------------ |
| `addOrder(o)`                   | إنشاء طلبية + التحقق من المخزون + خصم المخزون + إشعارات                  |
| `updateOrderStatus(id, status)` | تغيير حالة + إعادة المخزون عند الإلغاء/الإرجاع + إضافة إيراد عند التسليم |

#### الخزينة

| الدالة                  | ما تفعل                                    |
| ----------------------- | ------------------------------------------ |
| `addTransaction(t)`     | إضافة حركة مالية يدوية + تحديث رصيد الحساب |
| `addTreasuryAccount(a)` | إضافة حساب جديد                            |

#### الشركاء

| الدالة                   | ما تفعل                                             |
| ------------------------ | --------------------------------------------------- |
| `withdrawPartnerFunds()` | سحب من محفظة الشريك + خصم من الخزينة + تسوية الديون |
| `distributeProfits()`    | توزيع الأرباح على محافظ الشركاء حسب النسب           |

#### الموارد البشرية

| الدالة                      | ما تفعل                                                    |
| --------------------------- | ---------------------------------------------------------- |
| `addEmployee(e)`            | إضافة موظف                                                 |
| `recordEmployeeFinancial()` | تسجيل سلفة/مكافأة/خصم — السلف تخصم من الخزينة فوراً        |
| `issuePayroll()`            | إصدار مسير الرواتب + خصم إجمالي من الخزينة + تصفير الأرصدة |

#### التصنيف والوحدات

| الدالة                             | ما تفعل                         |
| ---------------------------------- | ------------------------------- |
| `addCustomCategory(cat, tenantId)` | إضافة فئة مخصصة معزولة لكل متجر |
| `addCustomUnit(unit)`              | إضافة وحدة قياس مخصصة           |

### Persistence في localStorage

```
المفتاح في localStorage: "bunyan-data-store"
يحتوي على: { state: { ...كل البيانات }, version: 0 }
يُحدَّث تلقائياً عبر middleware "persist" من Zustand
```

---

## 4. علاقات البيانات

### Product ↔ Order ↔ Treasury

```
Product (products[])
  ├── يُخصم مخزونه فور إنشاء Order
  ├── يُعاد مخزونه عند إلغاء/إرجاع Order
  ├── costPrice يُخصم من treasury عند addProduct
  └── WAC يُحسب ويُحفظ في costPrice عند كل addQty

Order (orders[])
  ├── items[].productId → يربطها بالمنتجات
  ├── courierCompanyId → يربطها بشركة التوصيل
  ├── status=delivered → يُضيف إيراد في treasury[cash_in_hand]
  └── يُنشئ/يُحدث سجل Customer تلقائياً

TreasuryAccount (treasury[])
  ├── accountType='cash_in_hand' → الرصيد النقدي الرئيسي
  ├── accountType='with_courier' → أموال عند شركة توصيل
  └── كل العمليات المالية تمر عبر TreasuryTransaction
```

### Employee ↔ HR ↔ Treasury

```
Employee (employees[])
  ├── salary, advanceBalance, allowanceBalance, deductionBalance
  ├── إضافة موظف → ينشئ TenantUser (إذا hasSystemAccess)
  ├── حذف موظف → isActive=false لـ TenantUser المرتبط
  └── issuePayroll → يخصم من treasury[cash_in_hand]

recordEmployeeFinancial(advance):
  → يُضيف للـ advanceBalance في Employee
  → يخصم فوراً من treasury[cash_in_hand]

issuePayroll():
  → netAmount = salary - advance - deductions + bonuses
  → treasury.balance -= sum(netAmounts)
  → employees[x].advanceBalance, allowanceBalance, deductionBalance → 0
```

### Partner ↔ Order ↔ Treasury

```
Partner (partners[])
  ├── profitPercentage → نسبة الأرباح
  ├── walletBalance → مبلغ مستحق للسحب
  ├── debtBalance → ديون على الشريك
  └── userId → يربطه بحساب TenantUser

distributeProfits(amount):
  → partner.walletBalance += amount × (profitPercentage/100)
  → لا يؤثر على treasury مباشرة (يُسجل كـ profit_distribution_record)

withdrawPartnerFunds(amount):
  → partner.walletBalance -= amount
  → treasury[cash_in_hand].balance -= actualPaid
  → إذا deductDebt: يُسدَّد من الديون أولاً
```

---

## 5. نقاط الدخول للمطور الجديد

### أهم 5 ملفات يجب قراءتها أولاً (بهذا الترتيب)

```
1. _DOCS/1_SYSTEM_RULES.md      ← قواعد المنظومة والمحظورات المطلقة
2. src/core/types/index.ts       ← جميع الـ TypeScript interfaces للكيانات
3. src/core/db/store.ts          ← قلب المنظومة: منطق الأعمال والـ CRUD
4. src/core/db/seed.ts           ← البيانات الافتراضية (لفهم شكل البيانات)
5. src/app/(tenant)/layout.tsx   ← بنية الـ Layout والـ Auth guard
```

### كيف تضيف وحدة جديدة

```
1. أنشئ مجلداً: src/app/(tenant)/[module-name]/
2. أنشئ الملف: page.tsx بنمط: 'use client'; + useAuthStore + useDataStore
3. أضف الـ interface في src/core/types/index.ts
4. أضف البيانات الـ Seed في src/core/db/seed.ts
5. أضف الـ State والدوال في src/core/db/store.ts
6. أضف رابط الوحدة في Sidebar التنقل
7. حدّث Middleware لحماية المسار إذا لزم
```

### كيف تعدّل حالة طلبية أو منتج

```typescript
// كل الكتابة تمر عبر store.ts — لا تعدّل البيانات في الـ component مباشرة
const { updateOrderStatus, updateProduct } = useDataStore();

updateOrderStatus(orderId, "delivered"); // يُشغّل منطق الخزينة تلقائياً
updateProduct(productId, { quantity: newQty, costPrice: newWAC }); // يُشغّل الحماية المالية
```

### كيف تتعامل مع الخزينة

```typescript
// القراءة
const cashAccount = treasury.find(
  (a) => a.tenantId === tid && a.accountType === "cash_in_hand",
);
const balance = cashAccount?.balance || 0;

// الكتابة (يدوي)
addTransaction({
  id: `tt-${Date.now()}`,
  tenantId: tid,
  accountId: cashAccount.id,
  transactionType: "expense",
  amount: -Math.abs(amount),
  description: "وصف الحركة",
  createdAt: new Date().toISOString(),
  transactionDate: new Date().toISOString(),
});
// ملاحظة: addTransaction تُحدّث الرصيد تلقائياً
```

### قواعد التنسيق المالي (لا استثناء)

```typescript
// ✅ صحيح
Math.round(value);
formatCurrency(value); // → "1,500 د.ل"

// ❌ خاطئ
value.toFixed(2);
parseFloat(value.toFixed(2));
```

---

## ملاحظات للنموذج الذكي الذي يقرأ هذا الملف

1. **النظام حالياً Pure Mock** — لا يوجد اتصال بقاعدة بيانات حقيقية. كل البيانات في Zustand + localStorage.
2. **كل العمليات المالية تمر عبر `store.ts`** — لا تُضف منطق مالياً في الـ Components.
3. **WAC إجباري** عند كل إضافة كمية — `Math.round(newWAC)` لا `toFixed`.
4. **الصلاحيات تُفحص في مكانين:** الـ UI (شرط العرض) والـ Middleware (حجب المسار).
5. **Soft Delete فقط** للمنتجات — `isActive = false` لا حذف من المصفوفة.
6. **`customCategories` معزولة بـ tenantId** — استخدم `customCategories[tenantId] || []`.
7. **تنسيق IDs:** `p-${Date.now()}` للمنتجات، `ord-${Date.now()}` للطلبيات، `tt-${Date.now()}` للحركات المالية.

**نهاية الملف**
