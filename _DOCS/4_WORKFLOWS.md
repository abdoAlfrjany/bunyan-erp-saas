# 4_WORKFLOWS.md — دورات حياة العمليات الرئيسية في المنظومة (v4.2)

> يوثّق هذا الملف دورات الحياة (Workflows) في المنظومة، وما يحدث خلف الكواليس شاملة تحديثات (Hybrid SQL + Diagnostics).

---

## 1. دورة حياة الطلبية المعقدة

### المراحل والحالات

```
PENDING → PROCESSING → WITH_COURIER / WITH_PARTNER → DELIVERED
                                                    → PENDING_RETURN → RETURN_CONFIRMED
       → CANCELLED (في أي مرحلة مبكرة)
```

### تفصيل كل حالة وتأثيرها المالي/المخزني

| الحالة             | تأثير على المخزون                 | تأثير على الخزينة                                                                                           |
| ------------------ | --------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `pending`          | **خصم فوري** عند الإنشاء          | بدون تأثير                                                                                                  |
| `processing`       | بدون تأثير (مخصوم مسبقاً)         | بدون تأثير                                                                                                  |
| `with_courier`     | بدون تأثير                        | بدون تأثير (يضاف لحساب `with_courier` لاحقاً عند التسوية) |
| `delivered`        | بدون تأثير                        | **إضافة كجزء من المبيعات** لحساب `cash_in_hand` للطلبيات المباشرة |
| `cancelled`        | **يُعاد كامل المنتجات للمخزون**   | إذا سبق الدفع: **سحب مالي عكسي**                                                                            |
| `return_confirmed` | **يُعاد للمخزون**                 | يُسحب المبلغ (إذا كان داخلي)                                                                                |

---

## 2. دورة التشخيص الذاتي (System Diagnostics Workflow) v3.0.0

أصبحت المنظومة مزودة بأداة فحص ذاتي (Diagnostics) تمنع الانهيار وتبني الشفافية:

1. **الاستدعاء (Trigger):** يُستدعى الفحص عبر API Route (`/api/diagnostics/schema`) من الـ Dashboard أو يدوياً بنهاية كل Sprint عبر `check_tables.mjs`.
2. **Schema Guard:** الأداة تنفذ استعلام `SELECT` نشط (Live Probe) للتحقق من أن أعمدة جداول قاعدة البيانات (PostgreSQL) صحيحة والمسميات مطابقة لبيانات الـ TypeScript. **إذا فشلت، يتم إيقاف التعديلات العشوائية.**
3. **Financial Audit:** يتم جمع مبلغ العمليات (TreasuryTransactions) وحساب التوازن الأولي للخزينة (`balance = sum(transactions)`). التسامح الآمن 5%.
4. **Idempotency & Concurrency:** النظام يجرب إعادة إنشاء مستخدم مرتين متتاليتين؛ يتم اصطياد `23505 (Unique Constraint)` واعتباره نجاحاً للايديمبوتينسي، بدلاً من الفشل، لمنع الـ Double Spend.
5. **التقارير:** يُنشيء النظام ملف تقرير بتنسيق HTML ديناميكي داخل بيئة التاجر (DiagnosticReport).

---

## 3. التدفق المالي: تسوية الرواتب والسحب للماليات

1. `issuePayroll(month)` → مسير الرواتب:
   - يحسب الراتب كالتالي: `netAmount = salary - advanceDeduction + allowanceApplied - deductionApplied`
   - يتم خصم الإجمالي كدفعة من `cash_in_hand` في جدول `treasury_accounts`.
   - تُصفّر سجلات السلف المؤقتة في بيانات الموظف.
2. `withdrawPartnerFunds(amount)` → السحب للشركاء:
   - يخصم الرصيد من `walletBalance` الخاص بالشريك.
   - إذا تم تفعيل خصم الديون (`deductDebt`)، يسجل الـ `transaction` كتنظيف للديون ثم نقل للشركاء عبر `profit_distribution_record`.

---

## 4. تدفق الشحن مع VanEx API (Courier Integration)

تغيَّر نظام الـ Adapter ليدعم تصحيح تلقائي لحقول الـ API لشركة Vanex.

### تدفق `sendOrderToVanex(orderId)` المحدث:

1. **المصادقة:** يتحقق المحول `VanexAdapter` من وجود رمز جلسة صالح `token`.
2. **الـ Payload:** المعالجة الحرفية (Mapping) قبل الإرسال (حتى لو كانت بها أخطاء إملائية في الـ API الرسمي).
   - `receiver` ← يتحول إلى `reciever` (مع `e`).
   - `length` ← يتحول إلى `leangh` (بالأمر `a`).
   - `payment_method` ← يتحول إلى `payment_methode`.
3. **حالة 401 Re-Auth:** إذا رفض VanEx الطلب بـ `401 Unauthorized`، يقوم المحوّل آلياً بتنفيذ دالة الـ Auto-Retry لطلب رمز توثيق جديد ومعاودة إرسال الطلبية بصمت (IsRetry=true)، ثم تحديث Token المخبأ.
4. **تحديث الحالة (`processing` → `ready_to_ship`):** يضاف `package_code` لـ `Order` وتتم عملية الإرسال لشركة فانكس **تلقائياً** بمجرد انتقال الطلبية إلى حالة `processing` عبر واجهة المستخدم أو الـ API.

### تدفق التتبع والمزامنة (Tracking & Sync):
1. دالة `getShipmentStatus` تستخدم رابط `/customer/package/{code}` (مع التصريح) بدلاً من الفحص السطحي.
2. تقوم بتصحيح الكود، إذا كان بصيغة `-MERCHANT-CODE` لا تقوم الكود بتمريره بل تستخدمه كما هو، لأننا نعتمد الآن على الـ Endpoint الخاص بالـ `customer` وليس الـ Endpoint العام.
3. قراءة الحالة من `result.data.status_object.status_value` لضمان الحصول على أحدث حالة معتمدة (تمت إضافة حالات `complete`، و `store_canceled`).
4. **الإلغاء (Cancellation):** عند مزامنة حالة `cancelled` من Vanex (سواء عبر الزر الفردي للتتبع أو المزامنة الجماعية عبر زر Sync)، يقوم النظام تلقائياً باستدعاء كود الإلغاء الشامل (والذي يعيد المخزون، ويلغي القيود المالية) بدلاً من تغيير النص فقط.

---

## 5. قواعد الصلاحيات الحديثة لـ بيئة Supabase (RBAC)

- **AUTH:** لم نعد نعتمد بالكامل على Cookies المشفرة فقط للـ Roles؛ انتقل العبء لجدول `profiles`.
- **SUPER_ADMIN / OWNER:** `test@bunyan.ly` و `super@bunyan.ly` (بعد تحويل الرتبة) هم ملُّاك المنصة الفعليين، يمرون عبر RLS ويغيرون جداول `tenants` كاملة.
- الـ UI يستخدم **Guard Router** (مثلاً `layout.tsx`) للتحقق من قيم `Supabase Session` الحقيقية ورتبة المستخدم لمنع اختراق الـ مسارات مثل `/super-admin`.

---

## 6. التعامل مع الديون والتوريد (WAC)

- عند إنشاء أمر Add Quantity للمنتجات، النظام يحسب المتوسط المرجح **WAC**:
  - `newCostPrice = ((oldQty × oldCost) + (addedQty × purchasePrice)) / (oldQty + addedQty)`
  - الناتج يكون مقرباً عبر `Math.round(newCostPrice)`.
- أي محاولة توريد تزيد كلفتها عن رصيد حساب `cash_in_hand` المتاح سيتم **رفضها** حماية للخزينة من القيم السالبة.

**نهاية الملف**
