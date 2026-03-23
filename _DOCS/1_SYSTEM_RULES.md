# 1_SYSTEM_RULES.md — دستور المنظومة (البنيان المرصوص الإصدار 4.2)

# ⚠️ هذا الملف هو القانون الأعلى — لا يوجد كود يتجاوز هذه القواعد
# 🛑 قانون التوثيق الإلزامي: يُمنع إنهاء أي جلسة برمجية دون تحديث ملفات الـ _DOCS تلقائياً لتعكس التغييرات الجديدة.
# أي مبرمج أو ذكاء اصطناعي يقرأ هذا المشروع ملزم بتحديث التوثيق فوراً كجزء من منطق التنفيذ.

# 📅 آخر تحديث: (الإصدار 4.2) تطبيق Hybrid State Management (React Query + Supabase) وأداة الفحص التشخيصي v3.0.0.

---

## 🔧 Stack التقني الفعلي المطبق حالياً

- **Framework:** Next.js 14 (App Router)
- **Database Backend:** Supabase (PostgreSQL + RLS) بشكل نشط (فعلي ومطبق للموارد والمستخدمين الأساسيين).
- **State Management (Hybrid Matured):**
  - **Server State:** `@tanstack/react-query` لجلب وعمل Mutations ومزامنة البيانات من Supabase بصورة متفائلة (Optimistic Updates).
  - **Client State (Sliced):** `Zustand` مُقسّم إلى 6 شرائح (Slices) مستقلة لمنع الـ God Object، ويدير فقط حالات الـ UI المريحة (Modal States, Filters, Auth Session).
- **Language:** TypeScript (strict mode — منع استخدام `any` واستبداله بالأنواع الصحيحة كـ `UserPermissions`).
- **Styling:** Tailwind CSS فقط (تم تنظيف تعارضات CSS).
- **Diagnostics:** أداة فحص ذاتي (System Diagnostics v3.0.0) للتحقق من تكامل البيانات مالياً ومعمارياً (Live Probe).

---

## 💰 العملة والأرقام (قانون لا يُكسر)

- **العملة الوحيدة:** دينار ليبي (LYD)
- **تنسيق الأرقام:** `1,500 د.ل` (بدون خانات عشرية — `Math.round` يقرّب لأقرب عدد صحيح). التسامح في التدقيق المالي هو 5% أو التدقيق المباشر.
- **القاعدة الذهبية:** نسبة الشركاء مجتمعة **لا يمكن** أن تتجاوز 100% مطلقاً.
- لا يمكن إضافة ديون أو مبالغ بدون تحديد وجهتها، وكل تحديث مالي يعتمد على **Atomic Decrement/Increment** (تجنباً لقراءة-تعديل-كتابة RMW قدر الإمكان).

---

## 🏗️ الهيكل المعماري الفعلي المطبق — طبقتان رئيسيتان

### 👑 الطبقة الصفرية: Super Admin (مدير منصة Bunyan)

إدارة شاملة لجميع المتاجر في الـ DB:
- **دخول مخصص:** عبر حسابات بـ Role = `owner` أو `super_admin` في جدول profiles.
- **نظام التصفح الداخلي (Tenant Browsing):** يمكن لمدير المنصة دخول أي متجر.
- إحصائيات عامة عبر كافة المتاجر.

### 🏢 الطبقة الأولى: بيئة التاجر (Tenant Workspace)

كل تاجر يملك `tenant_id` (UUID) خاص به يعزل بياناته بصرامة عبر Row Level Security (RLS) في Supabase.

---

## 🗂️ الأقسام التشغيلية الموجودة المكتملة (11 وحدة)

```
الوحدات الرئيسية للتاجر:

1. dashboard/       ← 👁️  لوحة القيادة المركزية
2. inventory/       ← 📦  المخزون والعهدة المكانية
3. orders/          ← 🛒  الطلبيات والمبيعات
4. delivery/        ← 🚚  إدارة شركات التوصيل والتسويات (دعم Vanex Adapter)
5. treasury/        ← 💰  الخزينة والمركز المالي
6. partners/        ← 🤝  الشركاء والمستثمرون
7. hr/              ← 👥  الموارد البشرية والموظفون
8. debts/           ← 📑  سجل الديون المركزي
9. analytics/       ← 📊  التحليلات المتقدمة
10. settings/       ← ⚙️  الإعدادات المتقدمة
11. super-admin/    ← 🛡️  المدير العام (قيد التطوير المستمر لربط Supabase)
```

---

## 🔐 نظام Auth والمصادقة الحالي

المنظومة انتقلت من Local Storage إلى Supabase Auth:
- **Supabase Auth:** تسجيل الدخول يتم عبر Supabase، وتُربط حسابات `auth.users` بجدول `public.profiles`.
- **هرم الرتب (Roles):** `owner` يملك صلاحيات `super_admin`. `employee`, `partner` يملكون صلاحيات مخصصة مقيدة.
- **الحماية:** يتم فحص الجلسة عبر Supabase Middleware و Zustand Auth Store المربوط به.

---

## 🚫 محظورات مطلقة (عبر الكود الحالي)

- ❌ لا `any` في Typescript.
- ❌ لا يُسمح بتعديل قاعدة البيانات دون المرور بالاختبار التشخيصي `System Diagnostics v3.0.0` للتحقق من الـ Schema Guard و Financial Audit.
- ❌ نسبة الشركاء لا تتخطى 100%.
- ❌ لا يُسمح بتجاوز الأدوار برمجياً.
- ❌ لا يُخصم المخزون من الرصيد العام في المتغيرات (Variants)، الخصم يحترم أعداد المتغيرات بدقة.
- ❌ ممنوع استخدام .toFixed(2) للأرقام المالية — استخدم Math.round فقط في الحسابات والتخزين.
- ❌ عند تحديث كميات (Double Write)، حاول استخدام Atomic Updates (`UPDATE products SET quantity = quantity - N`) لتجنب Race Conditions.
- ❌ ممنوع كتابة كود API لأي شركة توصيل داخل الـ UI — كل شركة لها ملف Adapter مستقل (مثل VanexAdapter).
- ❌ ممنوع إنشاء طلبية عبر شركة API متصلة بدون التحقق من وجود المدينة (Geo Mapping).

---

## 🗓️ خارطة المراحل (الحديثة)

### ✅ تم الانتهاء من:
- ✅ تحويل البيانات إلى Supabase (Hybridization مع React Query).
- ✅ بناء أداة فحص ذاتي (Diagnostics Tool v3) تفحص المطابقة المالية (Treasury Reconciliation)، تكامل الهيكل (Schema Guard عبر Live Select Probe)، اختبارات الضغط والـ Idempotency، وإنشاء تقارير HTML.
- ✅ ربط VanEx API: إرسال شحنات + Auto-Retry.
- ✅ تتبع حالة شحنات VanEx (Tracking & Sync): التحديث التلقائي للحالة والمزامنة الدقيقة باستخدام `/customer/package/{code}` وقراءة البيانات من `status_object` مع ترجمة معقدة لـ `VANEX_TO_BUNYAN_STATUS` شاملة `complete` و `store_canceled`.
- ✅ إعدادات الصلاحيات وبناء الـ RLS لجداول المتاجر (Tenants).

### 🔮 المرحلة الحالية/التالية (Next Steps):
- تجهيز ونشر النسخة التجريبية الأولى على بيئة أمنية مثل Vercel (Production Build).
- رفع كفاءة Atomic Updates لتقليل Race Conditions داخل Supabase Functions بدل Client.
- تخصيص واجهات الـ Middleware والمصادقة المتقدمة في الـ Super Admin.
- إكمال ربط شركات شحن إضافية (مثل Aramex) بنفس نمط `VanexAdapter` المعتمد.

**نهاية الملف**
