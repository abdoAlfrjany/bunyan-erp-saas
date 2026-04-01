# 🏗️ التقرير التشخيصي الهندسي الشامل — منظومة التوصيل في Bunyan ERP
> **المصدر:** قراءة مباشرة للكود + استجواب Supabase عبر MCP  
> **التاريخ:** 29 مارس 2026  
> **المشروع:** `riecnyonvqxtqqoyhkvh` — Bunyan ERP (ACTIVE_HEALTHY)

---

## 🗺️ خريطة الملفات الفعلية الموجودة

```
src/core/delivery/
  ├── IDeliveryProvider.ts      ← يُصدّر الأنواع فقط (Type re-export)
  ├── VanexAdapter.ts           ← 432 سطر — الملف الرئيسي ✅
  ├── MockShippingAdapter.ts    ← 5118 بايت — للاختبار
  └── index.ts                  ← Factory Pattern (getDeliveryAdapter)

src/app/api/
  ├── webhooks/vanex/route.ts   ← 255 سطر — Webhook handler ⚠️
  ├── vanex/
  │   ├── sync/route.ts         ← مزامنة كل الطلبيات
  │   ├── track/route.ts        ← تتبع طلبية واحدة
  │   └── settlements/
  │       ├── fetch/route.ts    ← جلب التسويات من Vanex
  │       └── details/route.ts  ← تفاصيل تسوية محددة
  ├── settlements/apply/route.ts ← تطبيق التسوية في الخزينة
  ├── orders/status/route.ts    ← تحديث الحالة + تأثيرات جانبية
  └── couriers/route.ts         ← CRUD شركات التوصيل
```

---

## 1️⃣ سير عمل Vanex API بالتفصيل الدقيق (Workflow)

### أ) تسجيل الدخول والمصادقة

**المسار في فانكس:** `POST /authenticate`  
**الحماية من الحظر:** الكود يعرف أن فانكس يسمح بـ **5 جلسات نشطة فقط** لكل حساب.

**الحل المُطبَّق:**
```
1. يرسل البريد + كلمة المرور → يحصل على access_token
2. يخزن التوكين في: couriers.api_credentials (JSONB) = { "token": "..." }
3. عند انتهاء التوكين (HTTP 401):
   - يقوم بـ Self-Healing تلقائي: يسجل دخول جديد بصمت
   - يكرر الطلب الأصلي مرة واحدة فقط (isRetry = true لمنع الحلقة)
4. إذا فشل الـ Retry → رسالة خطأ واضحة للمستخدم
```

**ملاحظة مكتشفة:** كلمة المرور تُخزّن في الكلاس محلياً كـ `atob(passwordHash)` وهو base64. هذا ليس تشفيراً (غير آمن لكنه لمنع العرض المكشوف).

### ب) إنشاء الشحنة

**المسار في فانكس:** `POST /customer/package`  
**الطبق الذي يرسله بنيان:**

| حقل الكود | اسم الحقل لفانكس | ملاحظة |
|---|---|---|
| receiverName | `reciever` | ⚠️ خطأ إملائي متعمد في API فانكس |
| dimLength | `leangh` | ⚠️ خطأ إملائي متعمد في API فانكس |
| paymentMethod | `payment_methode` | ⚠️ خطأ إملائي متعمد في API فانكس |
| cityId | `city` | رقم ID المدينة في فانكس |
| subCityId | `sub_city` | اختياري |

**الاستجابة:** فانكس يُرجع:
```json
{
  "id": 12345,          ← يُخزّن في orders.courier_package_id
  "package-code": "VNX-XXX", ← يُخزّن في orders.courier_tracking_code
  "status": "store_new"
}
```

### ج) التتبع

**المسار في فانكس:** `GET /customer/package/{trackingCode}`  
**يُستخدم في:** `vanexAdapter.getShipmentStatus()` من:
- `/api/vanex/track` — تتبع طلبية واحدة يدوياً
- `/api/vanex/sync` — مزامنة كل الطلبيات النشطة

### د) الإلغاء والاسترداد

**محاولة الحذف:** `DELETE /customer/package/{id}`  
**إذا فشلت → Fallback تلقائي:** `PUT /customer/package/{id}/recall`

هذا الـ Fallback مبرمج ويعمل. لكن المشكلة في **من يستدعيه** (راجع القسم 4).

### هـ) المدن والمناطق

**المسار في فانكس:** `GET /city/all`  
يرجع مصفوفة من المدن، وكل مدينة تحتوي على `locations[]` (المناطق الفرعية).

**الخلل الموجود:** دالة `getCities()` تُرجع `hasPermission: true` لكل المدن دائماً (السطر 159)، وتجاهلت الفلترة بالـ `active` مؤقتاً. هذا يعني أن مدناً غير مفعّلة في حساب فانكس ستظهر في الواجهة.

---

## 2️⃣ الـ Webhook — الصحة الكاملة والتحقق الدقيق

### ما الموجود فعلاً؟

```
المسار: POST /api/webhooks/vanex
الحماية: Token في بيئة .env (VANEX_WEBHOOK_SECRET)
```

**مسار التوكين المدعوم:** الكود يبحث في 4 أماكن:
1. Header: `x-webhook-token`
2. Header: `authorization: Bearer ...`
3. Header: `token`
4. Body: `{ token: "..." }`

هذا جيد لأنه **لا توثيق رسمي** من فانكس لكيفية إرسال التوكين بالضبط.

### 🔴 المشكلة الحرجة #1: خطأ عمود قاعدة البيانات (مُكتشف بالمسح)

**قاعدة البيانات الحقيقية في Supabase:**
```
webhook_logs.vanex_package_code   ← الاسم الحقيقي في DB
```

**الكود في route.ts (السطر 59، 107، 137):**
```typescript
courier_tracking_code: body['package-code'] ...  ← ❌ هذا العمود غير موجود!
```

**النتيجة:** كل عملية `insert` و `select` على هذا العمود **تفشل بصمت** لأن Supabase لا يُعيد خطأً صريحاً عند كتابة عمود غير موجود في بعض الحالات — فقط يتجاهله.

**التأثير المباشر:**
- الـ Idempotency check (منع المعالجة المزدوجة في السطر 134) يعمل على عمود لا قيمة فيه → **غير موثوق تماماً**
- عند البحث عن الطلبية (السطر 150)، يبحث في `orders.courier_tracking_code` ← هذا صحيح ✅

### 🔴 المشكلة الحرجة #2: Secret موحد = خرق Tenant Isolation

```typescript
const VANEX_WEBHOOK_SECRET = process.env.VANEX_WEBHOOK_SECRET;
// سطر واحد، متغير بيئي واحد، لكل المتاجر
```

**الخطر:** لو اختُرق هذا المتغير أو نشره أحد العملاء بالخطأ، **كل المتاجر في خطر**. كما أنه يعني أن أي متجر يعرف هذا السر يستطيع نظرياً تزوير تحديثات لمتاجر أخرى.

**الحل المُقترح:** كل متجر يملك `couriers.webhook_secret` خاص به، والـ Router يتعرف على المتجر عبر `courier_tracking_code` ثم يتحقق من سره.

### 🔴 المشكلة الحرجة #3: لا يوجد Unique Constraint للـ Idempotency

**نتيجة الفحص:**
```
webhook_logs constraints:
  - webhook_logs_pkey (PRIMARY KEY id)
  ← لا يوجد UNIQUE(courier_tracking_code, event_type) !
```

هذا يعني أن آلية منع التكرار (السطر 134-147) تعتمد على `SELECT` بدلاً من constraint في DB — وهو **غير موثوق** تحت الضغط العالي (Race Condition).

### ✅ ما يعمل صحيحاً:
- الـ Response دائماً 200 ← يمنع إعادة المحاولة اللانهائية من فانكس ✅
- تسجيل الطلبيات في webhook_logs قبل المعالجة ✅
- التحقق من وجود كود الشحنة قبل البحث ✅
- معالجة إرجاع المخزون عبر RPC ✅

### كيف يوضع رابط الـ Webhook في فانكس؟

> **الحقيقة الموثقة:** فانكس **لا يملك API** لوضع الرابط برمجياً.

الحل الوحيد المتاح حالياً: **يدوياً** من لوحة تحكم فانكس.  
رابط الـ Webhook الحالي: `https://[your-domain]/api/webhooks/vanex`

**ما ينقص لأتمتة هذه التجربة:**
- صفحة إعدادات في بنيان تُظهر الرابط + الـ Secret للنسخ
- لكن الوضع اليدوي في فانكس لا يمكن تجاوزه تقنياً

---

## 3️⃣ آلية التسويات المالية بالتفصيل

### المرحلة 1 — الجلب `POST /api/vanex/settlements/fetch`

```
1. يجلب بيانات الشركة من couriers (token, api_provider)
2. يجلب نسبة عمولة البنك من tenants.bank_commission_percentage (افتراضي 2%)
3. يستدعي adapter.getSettlements(token, 'approved', commissionRate)
4. فانكس يرد بـ: [{ id, settlement_number, total_amount, payment_method }]
5. يُحسب:
   - bankCommission = total_amount × commissionRate (فقط للدفع الإلكتروني)
   - netAmount = total_amount - bankCommission
   - deliveryFees = 0 ← ❌ غير موجود في هذا الـ API!
```

**يُخزّن في:** `courier_settlements` مع `is_approximate = true`

**التوكين:** يتحقق من `typeof rawCreds === 'string'` قبل parse ← جيد

**المشكلة:** الكود يستخدم `upsert` مع `onConflict: 'tenant_id,vanex_settlement_id'` لكن **لا يوجد UNIQUE constraint** على هذين العمودين في قاعدة البيانات فعلاً! (فحصنا: لا يوجد إلا PRIMARY KEY).

### المرحلة 2 — التفاصيل `GET /api/vanex/settlements/details`

```
فانكس يرد بـ: {
  id, settlement_number, total_amount,
  packages: [{ shipping_cost: 15 }, ...]  ← هنا تظهر رسوم الشحن!
}

الحساب الصحيح:
  totalDeliveryFees = SUM(packages[i].shipping_cost)
  netAmount = total_amount - totalDeliveryFees - bankCommission
```

يُحدّث `courier_settlements` بالقيم الدقيقة ويضع `is_approximate = false`

### المرحلة 3 — التطبيق `POST /api/settlements/apply`

**الحماية من التطبيق المزدوج:**
```
الخط الأول:  IF settlement.status === 'applied' → رفض (409 Conflict)
الخط الثاني: UPDATE SET status='applied' WHERE status='pending' 
              ← لو ضغط 10 مرات في نفس اللحظة، فقط أول واحدة ستنجح
```

**يستدعي RPC:** `create_treasury_transaction_atomic` ← موجود ✅  
**يربط:** `treasury_tx_id` ← للـ Audit Trail ✅

**🔴 الثغرة:** `courier_settlements.apply_settlement_atomic` موجودة كـ RPC لكن **غير مستخدمة** في كود apply! الكود يعمل على خطوتين (update treasury ثم update status) بدلاً من RPC ذري واحد.

---

## 4️⃣ الرواجع والطلبات الملغية — المنطق الكامل

### مسار الإلغاء اليدوي (من التاجر)

```
PATCH /api/orders/status { orderId, status: 'cancelled' }
  ↓
1. جلب الطلبية + التحقق من التابعية (assertTenantMatch)
2. إذا courier_package_id موجود → إلغاء من فانكس:
   - محاولة DELETE → إذا فشلت → RECALL تلقائي
3. تحديث orders.status = 'cancelled'
4. إذا delivery_type = 'internal':
   - فقط إذا كانت delivered سابقاً → يسجل expense في الخزينة
5. استعادة المخزون عبر RPC restore_inventory ← موجود ✅
```

### مسار الإلغاء من Webhook (فانكس يُلغي)

```
POST /api/webhooks/vanex
  ↓ يستقبل: { status: 'cancelled' or 'store_canceled' }
  ↓
1. يترجم الحالة → 'cancelled'
2. يُحدّث orders.status = 'cancelled'
3. يستدعي restore_inventory ← موجود ✅
```

**🔴 الثغرة الحرجة — استرداد الأموال المفقود:**

عند الإلغاء عبر Webhook أو من التاجر لطلبية **courier_company** (ليست internal):
```typescript
// سطر 80 في orders/status/route.ts:
if (isInternal) {  // ← فقط للداخلية!
  // تسجيل خزينة
}
// للـ courier_company: لا يوجد استرداد للمبلغ المدفوع مسبقاً!
```

**الوضع:** إذا دفع العميل مسبقاً (prepaid_amount موجود) والطلبية ملغاة من شركة التوصيل، **لا يُسجّل أي استرداد في الخزينة**.

### حالة Return Confirmed

**الـ Webhook** عند استلام `store_return`:
```
1. يترجم → 'return_confirmed'
2. يُحدّث orders.status
3. يستدعي restore_inventory ← ✅
```

لكن **لا يُسجّل** أي حركة مالية في الخزينة. وهذا **صحيح جزئياً** — لأن المال لم يصل أصلاً لخزينة التاجر (هو مع فانكس). لكن إذا كان العميل دفع بشكل مسبق، نفس مشكلة استرداد الأموال.

---

## 5️⃣ جدول ترجمة حالات فانكس ← بنيان

> **مُكتشف:** الجدول موجود في ملفين بشكل متطابق:
> - `VanexAdapter.ts` (سطر 18) → `VANEX_TO_BUNYAN_STATUS`
> - `webhooks/vanex/route.ts` (سطر 12) → نفس الجدول بكود مكرر

|  حالة فانكس (rawStatus) | حالة بنيان | التأثير |
|---|---|---|
| `store_new` | `pending` | — |
| `pending` | `pending` | — |
| `ship_received` | `ready_to_ship` | — |
| `ship_preperation` | `with_courier` | — |
| `ship_ongoing` | `with_courier` | — |
| `ship_pending` | `with_courier` | — |
| `shipped` | `with_courier` | Legacy |
| `on_track` | `with_courier` | Legacy |
| `enable_delivery` | `with_courier` | Legacy |
| `pending_office_sett` | `delivered` | ✅ التسوية ستنجح |
| `pending_store_sett` | `delivered` | ✅ |
| `completed` | `delivered` | ✅ |
| `delivered` | `delivered` | Legacy |
| `complete` | `delivered` | Legacy |
| `ship_del_return` | `pending_return` | ⚠️ لا يُعاد المخزون (صحيح) |
| `returned` | `pending_return` | Legacy |
| `refused` | `pending_return` | ⚠️ لا يُعاد المخزون (صحيح) |
| `store_return` | `return_confirmed` | ✅ يُعاد مخزون |
| `store_canceled` | `cancelled` | ✅ يُعاد مخزون |
| `cancelled` | `cancelled` | ✅ |
| `canceled` | `cancelled` | ✅ (إملاء بحرف واحد) |
| `canceled_by_admin` | `cancelled` | ✅ |
| `canceled_by_source` | `cancelled` | ✅ |

**الغياب:** `refused` → لا تُعاد المخزون لأن البضاعة لا تزال مع المندوب — **هذا صحيح تماماً**.

---

## 6️⃣ نظام المدن والمناطق — الحالة الفعلية بالأرقام

### ما كشفته قاعدة البيانات:

| الجدول | الصفوف |
|---|---|
| `bunyan_cities` | **180 مدينة** |
| `bunyan_regions` | **8 مناطق** |
| `provider_geo_mappings` | **119 ربط** (provider = 'vanex') |

### المدن الغير مربوطة:
```
المدن الحقيقية الغير مربوطة: 5 مدن فعلية
  - مصراته (ID: 4)
  - قصر بن غشير (ID: 41)
  - الكفرة (ID: 96)
  + 2 أخريات

المدن [DIAG]: 84 مدينة بأسماء تجريبية (1773...) 
  ← هذه بقايا اختبارات قديمة يجب حذفها!
```

### هيكل جدول provider_geo_mappings:
```
id, provider, bunyan_city_id, bunyan_region_id, 
provider_city_id, provider_region_id, is_active, parent_mapping_id
```

**كيف يعمل الربط عند إنشاء شحنة:**
1. المستخدم يختار المدينة من قائمة بنيان
2. الكود يبحث في `provider_geo_mappings WHERE bunyan_city_id = ? AND provider = 'vanex'`
3. يستخرج `provider_city_id` و `provider_region_id`
4. يرسلهما لفانكس في حقلي `city` و `sub_city`

**إذا لم يُوجد ربط:** الكود حالياً لا يملك Fallback — **يفشل بصمت** أو يُرسل قيمة `null/undefined` لفانكس.

---

## 7️⃣ جاهزية API فانكس — التقييم الشامل

| الوظيفة | API Endpoint | الجاهزية | ملاحظات |
|---|---|---|---|
| تسجيل الدخول | `POST /authenticate` | ✅ جاهز | Self-healing 401 مُطبَّق |
| إنشاء شحنة | `POST /customer/package` | ✅ جاهز | الأخطاء الإملائية مُعالَجة |
| تتبع شحنة | `GET /customer/package/{code}` | ✅ جاهز | |
| إلغاء شحنة | `DELETE /customer/package/{id}` | ✅ جاهز | Fallback RECALL مُطبَّق |
| استرداد | `PUT /customer/package/{id}/recall` | ✅ جاهز | |
| التسويات | `GET /store/settelmets` | ✅ جاهز | ⚠️ الإملاء الخاطئ مُعالَج |
| تفاصيل تسوية | `GET /store/settelmets/{id}/show` | ✅ جاهز | |
| المدن | `GET /city/all` | ✅ جاهز | ⚠️ لا فلتر active |
| حساب السعر | `GET /delivery-calculator` | ✅ جاهز | |
| Webhook | غير موجود | ❌ غير متاح | يدوي فقط |
| تسجيل Webhook URL | غير موجود | ❌ غير متاح | يدوي فقط |

---

## 8️⃣ ملخص الثغرات المكتشفة — مرتبة بالخطورة

### 🔴 CRITICAL — يجب علاج فوري

#### ثغرة C1: عمود webhook_logs خاطئ في الكود
```
DB:   webhook_logs.vanex_package_code
Code: courier_tracking_code  ← خطأ في كل مسارات الـ Webhook
```
**التأثير:** Idempotency check معطل + تتبع الأخطاء مستحيل  
**الإصلاح:** تغيير `courier_tracking_code` → `vanex_package_code` في webhook/route.ts

#### ثغرة C2: لا يوجد UNIQUE constraint لمنع التشغيل المزدوج
```
courier_settlements: لا يوجد UNIQUE(tenant_id, vanex_settlement_id)
webhook_logs: لا يوجد UNIQUE(vanex_package_code, event_type)
```
**التأثير:** عند الضغط العالي، تسوية واحدة قد تُضاف مرتين، webhook يُعالَج مرتين  
**الإصلاح:** migrations تُضيف الـ UNIQUE constraints

#### ثغرة C3: استرداد الأموال مفقود عند إلغاء طلبيات شركات التوصيل
```typescript
// orders/status/route.ts السطر 80
if (isInternal) { // ← فقط للداخلية!
  // لا يُعالَج: courier_company + prepaid_amount
}
```
**التأثير:** العميل يدفع مسبقاً، الطلبية تُلغى، الخزينة لا تُحدَّث، فقدان تتبع الأموال

### 🟡 HIGH — يُعالَج قريباً

#### ثغرة H1: كلمة السر الموحدة (Webhook Secret)
```
VANEX_WEBHOOK_SECRET = متغير بيئة واحد لجميع المتاجر
```
**التأثير:** خرق حماية عزل المتاجر (Tenant Isolation)

#### ثغرة H2: ازدواجية جدول ترجمة الحالات
نفس الجدول `VANEX_TO_BUNYAN_STATUS` موجود في ملفين مختلفين.  
**التأثير:** إذا عُدِّل أحدهما ونُسي الآخر → تناقض في الحالات

#### ثغرة H3: مدن [DIAG] في قاعدة البيانات
84 مدينة تجريبية بأسماء `[DIAG] مدينة 1773...` موجودة في `bunyan_cities`  
**التأثير:** تظهر للمستخدم في قوائم الاختيار!

#### ثغرة H4: getCities() تتجاهل فلتر is_active
```typescript
// VanexAdapter.ts السطر 152-160
// active: !!c.active,  ← يُعاد كـ property لكنه لا يُفلتر!
// hasPermission: true,  ← دائماً true بغض النظر
```

#### ثغرة H5: لا يوجد UNIQUE constraint لـ upsert التسويات
الكود يستخدم `onConflict: 'tenant_id,vanex_settlement_id'` لكن هذا الـ UNIQUE غير موجود فعلاً في DB.

### 🟢 LOW — تحسينات مستقبلية

#### ثغرة L1: apply_settlement_atomic RPC غير مُستخدم
يوجد في DB дополнительный RPC لكنه غير مستدعى في الكود.

#### ثغرة L2: delivery_fees = 0 في المرحلة الأولى
متوقع بسبب قيود API فانكس، لكن يجب توثيقه للمستخدم بشكل أوضح.

#### ثغرة L3: 5 مدن حقيقية غير مربوطة
مصراته، قصر بن غشير، الكفرة وغيرها لا ربط لها مع فانكس.

---

## 9️⃣ تصميم البنية المستقبلية لـ 15 شركة توصيل

### الوضع الحالي (Factory Pattern — جاهز جزئياً)

```typescript
// src/core/delivery/index.ts
export function getDeliveryAdapter(provider: 'vanex' | 'mock' | 'none') {
  switch (provider) {
    case 'vanex': return new VanexAdapter();
    case 'mock':  return new MockShippingAdapter();
    default:      return new MockShippingAdapter();
  }
}
```

**المشكلة:** الكل يستخدم `vanexAdapter` (singleton) مباشرة، ولا أحد يستخدم `getDeliveryAdapter()`.

### البنية المستهدفة

#### 1. IDeliveryProvider الكامل (Interface)
```typescript
interface IDeliveryProvider {
  readonly providerName: string;
  authenticate(creds: object): Promise<{ token: string }>;
  createShipment(payload, token): Promise<ICreateShipmentResult>;
  cancelShipment(id, token): Promise<{ success: boolean }>;
  getShipmentStatus(code, token): Promise<IShipmentStatusResult>;
  getCities(token): Promise<ProviderCity[]>;
  getSettlements(token): Promise<ProviderSettlement[]>;
  translateStatus(rawStatus: string): OrderStatus; // ← مفقود حالياً
}
```

#### 2. Registry مع Webhook Router موحد
```
/api/webhooks/[provider]/route.ts
  ↓
1. استخراج provider من URL
2. استخراج tracking code من الـ body
3. البحث عن الطلبية في orders
4. جلب Tenant → جلب Webhook Secret الخاص به
5. التحقق من الـ Secret
6. توجيه للـ Adapter المناسب للترجمة
7. تحديث قاعدة البيانات
```

#### 3. Geo-Mapping محسّن
```
provider_geo_mappings يحتاج:
  - UNIQUE(provider, bunyan_city_id)
  - واجهة إدارية لعرض التطابق ونسبته
  - Fallback Message عند عدم وجود ربط
```

---

## 🎯 خارطة الطريق — ما ينقص لاكتمال ربط فانكس 100%

### المرحلة 1 — الإصلاحات الحرجة (ساعتان)

- [ ] إصلاح عمود `courier_tracking_code` → `vanex_package_code` في webhook/route.ts
- [ ] إضافة `UNIQUE(tenant_id, vanex_settlement_id)` على `courier_settlements`
- [ ] إضافة `UNIQUE(vanex_package_code, event_type)` على `webhook_logs`

### المرحلة 2 — الأمان والعزل (نصف يوم)

- [ ] إضافة عمود `webhook_secret` في جدول `couriers`
- [ ] توليد secret تلقائي لكل شركة توصيل عند إنشائها
- [ ] تحديث Webhook handler ليتحقق من secret الشركة
- [ ] صفحة إعدادات تُظهر الرابط + السر للنسخ

### المرحلة 3 — المالية (نصف يوم)

- [ ] إضافة استرداد الأموال في orders/status عند إلغاء courier_company مع prepaid_amount
- [ ] توحيد جدول ترجمة الحالات في ملف واحد مستقل

### المرحلة 4 — البنية التحتية (يوم)

- [ ] حذف مدن [DIAG] من bunyan_cities
- [ ] ربط المدن الـ 5 الحقيقية غير المربوطة مع فانكس
- [ ] تنفيذ Fallback واضح عند غياب الربط الجغرافي
- [ ] Universal Webhook Router لاستقبال أي شركة مستقبلاً

---

## 📊 التقييم الإجمالي للنظام

| المحور | الدرجة | التقييم |
|---|---|---|
| جاهزية API فانكس | 85% | جيد جداً — يعمل بالكامل |
| أمان الـ Webhook | 45% | ⚠️ بحاجة إصلاح عاجل |
| التسويات المالية | 70% | جيد مع ثغرات UNIQUE |
| الرواجع والإلغاءات | 60% | ⚠️ استرداد الأموال مفقود |
| الجغرافيا والمدن | 55% | مدن [DIAG] + مدن غير مربوطة |
| قابلية التوسع (15 شركة) | 50% | هيكل جاهز لكن غير مُفعَّل |
| **المجموع** | **61%** | **بحاجة ترقيع قبل الإنتاج** |
