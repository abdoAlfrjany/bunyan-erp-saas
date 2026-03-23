# 5_MODULES_MAP.md — خريطة الوحدات والملفات والعلاقات (v4.2)

> دليل شامل للمطور الجديد لفهم هيكل المنظومة بعد تطبيق قواعد Hybrid State وأدوات التشخيص (System Diagnostics).

---

## 1. خريطة الوحدات (11 وحدة رئيسية + Diagnostics)

| #   | الوحدة                    | المسار                            | الجدول/البيانات الرئيسية         | مفتوح لـ           |
| --- | ------------------------- | --------------------------------- | -------------------------------- | ------------------ |
| 1   | 📊 لوحة القيادة           | `app/(tenant)/dashboard/`         | `orders`, `products`, `treasury` | الكل               |
| 2   | 📦 المخزون                | `app/(tenant)/inventory/`         | `products`                       | Owner, موظف مخزن   |
| 3   | 🛒 الطلبيات               | `app/(tenant)/orders/`            | `orders`, `products`, `couriers` | Owner, موظف مبيعات |
| 4   | 🚚 التوصيل                | `app/(tenant)/delivery/`          | `couriers`, `orders`             | Owner, موظف توصيل  |
| 5   | 💰 الخزينة                | `app/(tenant)/treasury/`          | `treasury`, `transactions`       | Owner فقط          |
| 6   | 🤝 الشركاء                | `app/(tenant)/partners/`          | `profiles`, `debts`              | Owner فقط          |
| 7   | 👥 الموارد البشرية        | `app/(tenant)/hr/`                | `profiles`, `users`              | Owner فقط          |
| 8   | 📑 الديون                 | `app/(tenant)/debts/`             | `debts`                          | Owner فقط          |
| 9   | 📊 التحليلات              | `app/(tenant)/analytics/`         | `orders`, `products`, `treasury` | Owner              |
| 10  | ⚙️ الإعدادات              | `app/(tenant)/settings/`          | `tenants`, `profiles`            | Owner فقط          |
| 11  | 🛡️ Super Admin            | `app/super-admin/`                | جميع `tenants`, `subscriptions`  | Super Admin        |
| **12**| 🩺 **التشخيص (API)**      | `app/api/diagnostics/schema/`     | يفحص جميع جداول قاعدة البيانات   | النظام (للأمان)    |

---

## 2. خريطة الملفات الكاملة المدمجة (Hybrid Stack)

### ملفات الـ Core (قلب المنطق)

```
src/
├── app/
│   ├── api/
│   │   ├── diagnostics/
│   │   │   └── schema/route.ts      ← نقطة نهاية API لفحص صحة النظام (Live Probing)
│   │   └── vanex/
│   │       ├── track/route.ts       ← API لتتبع حالة شحنة فردية وإرجاع/إلغاء المبالغ
│   │       └── sync/route.ts        ← API لمزامنة حالات كل الطلبيات المفتوحة
│   ├── layout.tsx                   ← Root layout (theme providers, QueryClientProvider)
│   ├── middleware.ts                ← حماية المسارات (Supabase Middleware)
│   ├── login/page.tsx               ← صفحة الدخول (Supabase Auth)
│   ├── (tenant)/                    ← صفحات المتجر (مع Sidebar)
│   └── super-admin/                 ← لوحة Super Admin (Protected by super_admin role)
│
├── core/
│   ├── auth/
│   │   └── store.ts                 ← Zustand auth store مدمج كـ Session Manager محلي
│   ├── db/
│   │   ├── supabase.ts              ← Supabase Database Client المركزي للـ React Hooks
│   │   └── slices/                  ← Zustand UI Slices للتحكم بالمودال والفلاتر فقط
│   ├── delivery/
│   │   ├── IDeliveryProvider.ts     ← تصدير واجهة المحولات
│   │   ├── index.ts                 ← Factory: getDeliveryAdapter()
│   │   ├── VanexAdapter.ts          ← محوّل VanEx API (مجهز لمعالجة الأخطاء الإملائية)
│   │   └── MockShippingAdapter.ts   ← محاكي للتطوير وللمدن الليبية
│   └── utils/
│       ├── systemDiagnostics.ts     ← 🚨 محرك الفحص الذكي (Schema Guard, Audit, Idempotency)
│       └── index.ts                 ← generateSKU, cartesian, formatters
│
└── shared/
    ├── components/
    │   └── ui/
    │       ├── AddProductSlideOver.tsx  ← نموذج إضافة/تعديل منتج (يتفاعل مع UI State + Req)
    │       └── Toast.tsx                ← نظام الإشعارات
    └── utils/
        └── statusColors.ts              ← خرائط ألوان المخزون والطلبيات (Yellow, Green, Red)
```

---

## 3. هندسة جلب البيانات والتخزين (React Query + Zustand)

### الـ Server-State (React Query)
تُستعمل لجلب وعمل Mutations لحقائق الـ Database:
- `useOrdersQuery`: جلب وتحديث الطلبيات لحفظ حالة الـ UI نظيفة ومتزامنة عبر كل الـ Tabs.
- `useProductsQuery`: معالجة WAC وخصم كميات المخزون بناءً على حسابات متفائلة (Optimistic Updates).

### الـ UI/Client State (Zustand Slices)
كل `store.ts` القديم تقلص إلى State بسيط يحكم ظهور القوائم ونوافذ الإضافة، بحيث لا يكون هناك عبء مزامنة يدوي بين الـ Frontend والجداول:
- `openModal` (للقرار بعرض نموذج التعديل).
- `filters` (حالة الفرز والبحث الجارية للجدول قبل إرسالها لـ React Query).
- `sessionUser` (مخزّن معلومات الدخول المعزولة محلياً لعدم استدعاء Supabase Auth مراراً وتكراراً على نفس الـ Page).

---

## 4. علاقات وعمليات متطورة (Couriers & Finances)

### CourierAdapter (Pattern + Workarounds)

```typescript
VanexAdapter (محوّل توصيل API):
  ├── يتعامل مع أخطاء VanEx المطبعية (`leangh`, `reciever`, `payment_methode`).
  ├── يحتفظ بآلية Auto-Retry للـ 401 Unauthorized Tokens ويحدث `api_credentials`.
  ├── يستخدم `/customer/package/${trackingCode}` للتتبع الموثوق والدقيق.
  └── يعمل كوسيط، يستقبل Types نظيفة من Bunyan ERP ويحولها إلى شواذ VanEx.
```

### Treasury (النظام المالي المحدّث)

```
TreasuryAccount (الحسابات)
  ├── 💰 cash_in_hand (رئيسي)
  ├── 💳 bank (تحويلات بنكية/أونلاين)
  └── 📦 with_courier (ذمم لشركات التوصيل لم تحصل بعد)

القيود (TreasuryTransaction)
  ├── 🚫 بدون عمود `reference_type` (تم التخلي عنه للحفاظ على الاستقرار).
  ├── تُدوَّن الـ Metadata داخل الـ description كنص.
  └── أُضيفت فلاتر System Diagnostics للتحقق من عدم اختلال الرصيد (Sum == Balance).
```

---

## 5. كيف تبدأ أو تضيف ميزة كمطور

```
1. قواعد ومحظورات النظام: اقرأ `1_SYSTEM_RULES.md`
2. تشريح هيكل البيانات: مرّ على `2_DATABASE_SCHEMA.md`
3. دورة حياة البيانات: راجع `4_WORKFLOWS.md`
4. لفحص وتأكيد النظام: تذكر تشغيل أداة Diagnostics (`systemDiagnostics.ts`).
```

**خطوات إضافة شركة توصيل جديدة (كـ Aramex أو Presto):**
1. أنشئ محولاً في `core/delivery/PrestoAdapter.ts`.
2. طبّق واجهة `IDeliveryProvider`.
3. لا تقيّد الكود الداخلي للبنيان بكلمات شاذة للـ API الهدف، بل غيّر مفاتيح JSON ضمن الـ Adapter فقط.
4. سجل الشركة في Factory `getDeliveryAdapter()`.

**نهاية الملف**
