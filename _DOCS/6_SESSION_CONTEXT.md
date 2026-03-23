# _DOCS/6_SESSION_CONTEXT.md
# سياق الجلسات — Bunyan ERP SaaS

## معلومات المشروع
- **المسار المحلي:** `C:\Users\abdo\Documents\erb\1\libya-erp-saas 2`
- **GitHub:** https://github.com/abdoAlfrjany/bunyan-erp-saas (Public)
- **السوق المستهدف:** ليبيا
- **العملة:** د.ل (دينار ليبي) — Math.round فقط، ممنوع .toFixed(2)
- **الحالة:** يعمل محلياً ✅

## المستخدم
- ليس مبرمجاً — لديه أساس فقط
- يستخدم Antigravity لتعديل الملفات مباشرة
- الأدوات: Claude (المساعد الأول) + Antigravity (المنفذ) + GitHub

## نظام العمل
- **Claude:** يقرأ المشروع ويعطي أوامر مفصلة جاهزة
- **Antigravity:** ينفذ الأوامر مباشرة على الملفات
- **القاعدة الذهبية:** كل أمر يبدأ بقراءة الملفات المعنية أولاً

## قواعد الأوامر الثابتة
- تبدأ دائماً بـ "اقرأ هذه الملفات أولاً"
- تنتهي دائماً بـ "لا تشغّل أي أوامر في Terminal. عدّل الملف مباشرة فقط."
- **قانون التوثيق الإلزامي:** يجب تحديث ملفات `_DOCS/` تلقائياً في نهاية كل جلسة.
- لا terminal، لا build، لا run، لا npm

## توزيع النماذج
| النموذج | متى تستخدمه |
|---------|-------------|
| Gemini Flash | تعديلات بسيطة: نص، لون، padding، حذف سطر |
| Gemini Pro + Planning | منطق متوسط، ربط مكونات، تصميم جديد |
| Claude Sonnet + Planning | منطق مالي معقد، Zustand، معمارية |
| Claude Opus | فقط إذا فشل Sonnet مرتين |

---

## الاستراتيجيات المعتمدة

### Design Patterns المطبقة
- **Adapter Pattern:** كل شركة توصيل = ملف Adapter مستقل في `src/core/delivery/`
- **Strategy Pattern:** عزل خوارزميات الحساب في دوال منفصلة
- **Observer Pattern:** تغيير حالة الطلبية يشعل الخزينة تلقائياً
- **State Pattern:** تدفق الطلبية مغلق — لا انتقال عشوائي
- **Facade Pattern:** الواجهة تستدعي دالة واحدة تخفي التعقيد
- **Singleton Pattern:** store.ts هو Single Source of Truth

### قواعد Adapter ثابتة (محظورات)
- ❌ ممنوع كتابة كود API لأي شركة داخل store.ts أو أي page
- ❌ ممنوع استدعاء fetch() من خارج ملف الـ Adapter
- ❌ ممنوع إضافة شركة جديدة بدون ملف [Name]Adapter.ts

### Two-Layer Status Strategy
- `status` → يتحكم في الخزينة والمخزون (مغلق)
- `courier_raw_status` → نص مفتوح من API للعرض فقط

---

## VanEx API — التوثيق الكامل

### المعلومات الأساسية
- **Production:** `https://app.vanex.ly/api/v1`
- **Staging:** `https://test.dev.vanex.ly/api/v1`
- **Auth Header:** `Authorization: Bearer {token}`
- **تحذير:** حد أقصى 5 tokens نشطة — الأقدم يُحذف عند التجاوز
- **تحذير:** الحساب يُقفل بعد 5 محاولات فاشلة

### Response Format القياسي
```json
{
"status_code": 200,
"message": "نجحت العملية",
"data": {},
"errors": null
}
```

---

### §1 — Authentication

#### POST /authenticate — تسجيل الدخول
**Request Body:**
- `email` string ✅ — يقبل بريد إلكتروني أو رقم هاتف
- `password` string ✅
- `device_token` string ❌ اختياري

**Response 200:**
```json
{
"data": {
"access_token": "TOKEN_HERE",
"token_type": "Bearer",
"user": {}
}
}
```
**ملاحظة:** النظام يكتشف تلقائياً إذا كان الإدخال email أو phone

#### GET /validate-token — التحقق من التوكن
- Response 200: التوكن صالح + بيانات المستخدم
- Response 401: التوكن منتهي أو غير صالح

#### GET /logout — تسجيل الخروج
- يُلغي التوكن الحالي فقط

---

### §2 — Packages (الطرود)

#### GET /customer/package — قائمة الطرود (V2 موصى به)
**Query Parameters:**
- `status`: pending | shipped | delivered | returned | cancelled | on_track | enable_delivery
- `per_page`: integer (default: 10)
- `page`: integer (default: 1)

**Response 200:** قائمة مُصفَّحة مع تفاصيل كاملة + city + sub_city + status_object

#### POST /customer/package — إنشاء طرد (V2 موصى به)

**أنواع الطرود:**
| Type | الاسم | ملاحظة |
|------|-------|--------|
| 1 | Commercial تجاري | كل الحقول إلزامية |
| 2 | Return/Exchange مرتجع | price و paid_by اختياريان |
| 3 | Document وثيقة | الأبعاد اختيارية، sub_type إلزامي |
| 4 | Other أخرى | التحقق القياسي |

**حقول الطلب الكاملة:**
| الحقل | النوع | إلزامي | الوصف |
|-------|-------|--------|-------|
| type | integer | ✅ | 1-4 |
| reciever | string | ✅ | ⚠️ هجاء VanEx الأصلي |
| phone | string | ✅ | الهاتف الأساسي |
| phone_b | string | ❌ | الهاتف الثانوي |
| city | integer | ⚠️ | إلزامي إذا لم يُرسل unified_city |
| unified_city | integer | ⚠️ | بديل عن city |
| address | string | ✅ | عنوان التوصيل |
| address_child | string | ❌ | تفاصيل إضافية |
| address_code | string | ❌ | كود عنوان محفوظ |
| sub_city | integer | ❌ | رقم الحي |
| price | float | ⚠️ | غير إلزامي لـ type=2 |
| payment_methode | string | ✅ | ⚠️ هجاء VanEx: cash أو online |
| paid_by | string | ⚠️ | customer أو market (إلزامي لـ type=1) |
| description | string | ✅ | وصف الطرد |
| qty | integer | ✅ | الكمية |
| notes | string | ❌ | ملاحظات |
| sticker_notes | string | ❌ | تُطبع على الملصق |
| height | integer | ⚠️ | غير إلزامي لـ type=3 |
| leangh | integer | ⚠️ | ⚠️ هجاء VanEx الأصلي (يقصد length) |
| width | integer | ⚠️ | غير إلزامي لـ type=3 |
| extra_size_by | string | ✅ | market أو customer |
| commission_by | string | ✅ | market أو customer |
| partial_delivery | boolean | ❌ | تفعيل التسليم الجزئي |
| products | array | ⚠️ | إلزامي إذا partial_delivery=true |
| currency_type_id | integer | ❌ | دعم العملات |
| photo | file | ❌ | multipart/form-data |
| sub_type | integer | ⚠️ | إلزامي لـ type=3 |
| store_reference_id | string | ❌ | رقم مرجعي خاص بالمتجر |

**Response 201:**
```json
{
"data": {
"id": 123,
"package-code": "VNX123456",
"type": 1,
"price": 50.0,
"total": 55.0,
"status": "pending"
}
}
```

#### POST /customer/package/search — بحث متقدم
**Request Body:**
- `search`: كلمة بحث (كود، اسم مستلم)
- `status`: فلتر الحالة
- `date_from` / `date_to`: YYYY-MM-DD
- `city_id`: فلتر المدينة

#### GET /customer/package/count — عدد الطرود بالحالة
**Response:** total, pending, shipped, delivered, returned

#### GET /customer/package/dashboard — إحصائيات
**Response:** total_packages, pending_packages, delivered_packages, cancelled_packages, total_revenue

#### GET /customer/package/{id} — تفاصيل طرد
**Response 200:** تفاصيل كاملة + city + sub_city + status_object + dates + dimensions

#### PUT /customer/package/{id} — تعديل طرد
⚠️ ممكن فقط قبل الشحن
**Body:** receiver_name, phone, phone_b, address, city_id, sub_city_id, notes, price

#### DELETE /customer/package/{id} — إلغاء طرد
⚠️ ممكن فقط قبل الشحن

#### GET /customer/package/{code}/logs — سجل التتبع
**Response:** مصفوفة PackageLog (id, status, status_ar, description, location, created_at)

#### GET /customer/package/{code}/check — فحص سريع للحالة
**Response:** code, status, status_ar, can_be_delivered (bool), estimated_delivery

#### PUT /customer/package/{id}/recall — استرداد طرد
**Body:** `reason` string — سبب الاسترداد

#### PUT /customer/package/{id}/resend — إعادة إرسال مرتجع
**Body:** `new_address`, `new_phone` — اختياريان

#### GET /customer/package/export — تصدير
**Query:** status, date_from, date_to, format (excel|csv|pdf)

---

### §3 — Settlements (التسويات)

#### GET /store/settelmets — قائمة التسويات
⚠️ هجاء VanEx الأصلي: settelmets (بدون t)
**Query:** status (pending|approved|rejected|paid), page
**Response:** قائمة مُصفَّحة من Settlement objects

#### GET /store/settelmets/{id}/show — تفاصيل تسوية
**Response يشمل:**
- id, store_id, settlement_number, total_amount, status, status_ar
- payment_method (id, name, name_en, active)
- notes, created_at, approved_at, paid_at
- packages[] — كل الطرود المرتبطة بالتسوية
- store object (id, name, email, phone, address, category, balance)

---

### §4 — Transactions (المعاملات المالية)

#### GET /store/transactions — سجل المعاملات
**Query:**
- `type`: credit | debit | settlement | money_transfer | package_fee
- `from_date` / `to_date`: YYYY-MM-DD
- `per_page`: default 10

**Response لكل معاملة:**
id, amount, type, type_ar, balance, description, method, method_ar, status, date, created_at, package (مرتبط)

---

### §5 — Geography (الجغرافيا والأسعار)

#### GET /delivery-calculator — حاسبة سعر التوصيل
**Query:** from_region, to_city✅, to_sub_city, package_type (1-5)
**Response:** base_price, region_price, total_price, currency (LYD), delivery_time

#### GET /delivery/price — أسعار التوصيل للمدن
**Query:** region_id, city_id
**Response:** مصفوفة DeliveryPrice (city_id, city_name, sub_city_id, price, region)

#### GET /city/all — كل المدن
**Response لكل مدينة:** id, name (عربي), name_en, code, region_id, active (bool)

---

### §7 — Support Tickets (تذاكر الدعم)

#### POST /tickets — إنشاء تذكرة (multipart/form-data)
**Body:**
- `title` ✅ — عنوان التذكرة
- `content` ✅ — محتوى التذكرة
- `priority` ✅ — الأولوية
- `category` ✅ — التصنيف
- `attachment` ❌ — ملف اختياري

**Response 201:** تذكرة أُنشئت بنجاح

#### GET /tickets — قائمة التذاكر
**Query:** status (open|in_progress|closed), page

---

### خريطة حالات VanEx → Bunyan
| VanEx | Bunyan |
|-------|--------|
| pending | pending |
| shipped | with_courier |
| on_track | with_courier |
| enable_delivery | with_courier |
| delivered | delivered |
| complete | delivered |
| returned | return_confirmed |
| cancelled | cancelled |
| store_canceled | cancelled |

### سياسات VanEx التشغيلية
- **الرواجع:** مجانية بالكامل
- **الاستبدال:** يُكتب "استبدال" في الوصف فقط
- **التسوية:** تاني يوم من تسليم الزبون مباشرة
- **عمولة الدفع الإلكتروني:** 2% تُخصم في التسويات
- **الدفع المسبق:** يُرسل price: 0 للمندوب
- **التوصيل المجاني:** commission_by: "market"

---

## الوحدات المكتملة ✅

### وحدة المخزون والعهدة (2026-03-09)
- WAC Engine، حماية الخزينة في Store Layer
- Pivot Table للمتغيرات، لوحة تحليلات المنتج
- التصنيف الديناميكي، شريط فلترة ديناميكي

**الملفات:**
- `src/app/(tenant)/inventory/page.tsx`
- `src/shared/components/ui/AddProductSlideOver.tsx`
- `src/core/db/store.ts`

---

### Sprint 1 — Adapter Pattern (2026-03-13)
- `IDeliveryProvider.ts` — الواجهة الموحدة
- `VanexAdapter.ts` — محوّل VanEx الكامل
- `MockShippingAdapter.ts` — محاكي بـ 15 مدينة ليبية
- `getDeliveryAdapter()` Factory

**الملفات:**
- `src/core/types/index.ts`
- `src/core/delivery/IDeliveryProvider.ts`
- `src/core/delivery/VanexAdapter.ts` (جديد)
- `src/core/delivery/MockShippingAdapter.ts` (جديد)
- `src/core/delivery/index.ts`

---

### Sprint 2 — تطوير الطلبيات (2026-03-13)
- عمود شركة التوصيل + كود VanEx + courier_raw_status
- قسم خيارات الدفع في نموذج الطلبية
- فلتر بالشركة، Dropdown المفعّلة فقط

**الملفات:**
- `src/app/(tenant)/orders/page.tsx`

---

### Sprint 3A — صفحة إدارة الشركات (2026-03-13)
- App Store Model: كروت VanEx / السريع / المعيار
- Connection Badge: 🟢 متصل / 🔴 غير متصل
- ربط حساب VanEx + اختبار اتصال + حفظ token
- زر قطع الاتصال مع تحذير window.confirm
- حقل الربط يقبل email أو رقم هاتف

**الملفات:**
- `src/app/(tenant)/delivery/companies/page.tsx`

### Sprint 4 — ربط VanEx بدورة الطلبيات (2026-03-13)
- ShippingCityMapping — 18 مدينة ليبية مربوطة بـ VanEx IDs
- sendOrderToVanex() — دالة مركزية في store.ts
- زر "جاهز للشحن" بنفسجي في orders/page.tsx
- منطق ذكي: شركة API متصلة = زر واحد فقط (منع التجاوز)
- رسالة نجاح ديناميكية باسم الشركة الحقيقي

**الملفات:**
- `src/core/types/index.ts` (ready_to_ship + ShippingCityMapping)
- `src/core/db/seed.ts` (SEED_CITY_MAPPINGS)
- `src/core/db/store.ts` (sendOrderToVanex + city CRUD)
- `src/app/(tenant)/orders/page.tsx`
- `src/shared/utils/statusColors.ts`

### Sprint 5 — التسويات التلقائية (2026-03-13)
- VanexSettlement interface — نموذج بيانات التسوية الكاملة
- accountType 'bank' — خزينة مصرفية جديدة بجانب النقدية
- fetchVanexSettlements() — جلب التسويات من VanEx وحفظها محلياً
- applyVanexSettlement() — تطبيق Gross Method المحاسبي الصحيح
- صفحة التسويات كاملة مع فلاتر + PaymentBadge + Accordion

**الملفات:**
- `src/core/types/index.ts` (VanexSettlement + bank accountType)
- `src/core/delivery/VanexAdapter.ts` (getSettlements + getSettlementDetails)
- `src/core/db/seed.ts` (SEED_VANEX_SETTLEMENTS)
- `src/core/db/store.ts` (fetchVanexSettlements + applyVanexSettlement)
- `src/app/(tenant)/delivery/settlements/page.tsx`

### Sprint 7 — City Mappings للسوبر أدمن (2026-03-13)
- صفحة src/app/super-admin/city-mappings/page.tsx (جديدة)
- جدول ربط 18 مدينة ليبية بـ VanEx IDs
- بحث ذكي عربي/إنجليزي + بطاقات إحصاء
- SlideOver إضافة/تعديل مع parseInt للـ ID
- رابط "ربط المدن" في super-admin/layout.tsx

---

### Sprint 8 — إصلاح VanEx API + 401 Auto-Retry (2026-03-14)
- إصلاح مشكلة encode الباسورد: `atob(passwordHash)` بدلاً من إرسال الـ hash مباشرة
- نظام Auto-Retry كامل: `isRetry` flag + `setCredentials()` على Adapter
- Token Root Sanitization: `token.replace(/^["']|["']$/g, '').trim()`
- نظام `office_cities`: الـ Adapter يلتقط صلاحيات المدن من response المصادقة
- Permission-based city filtering: رسالة واضحة عند 401 بدلاً من array فارغة
- `getCities()` يرمي Error صريح بدلاً من إرجاع []

**الملفات:**
- `src/core/delivery/VanexAdapter.ts`

---

### Sprint 9 — إصلاح أخطاء TypeScript في الطلبيات (2026-03-14)
- تحديث `ShippingCityMapping`: تغيير `isActive` ← `is_active`، `providerCityId` ← `provider_city_id`
- تحديث `ShippingRegionMapping`: تغيير `isActive` ← `is_active`
- إصلاح كل الاستخدامات في `orders/page.tsx` و `seed.ts` و `store.ts`
- تأكيد أن `seed.ts` يستخدم `is_active` و `bunyan_city_id` و `provider_city_id` (snake_case)

**الملفات:**
- `src/core/types/index.ts` (ShippingCityMapping + ShippingRegionMapping)
- `src/core/db/seed.ts` (SEED_CITY_MAPPINGS)
- `src/app/(tenant)/orders/page.tsx`

### Sprint 10 — Cross-Mapping + Smart Match + Pending Filter (2026-03-15)
- Cross-Mapping: مدينة مزود يمكن ربطها بمنطقة بنيان (Polymorphic Dropdown بـ `city_`/`region_` prefix)
- Smart Auto-Match: مطابقة 92 مدينة تلقائياً بضغطة زر (🪄)
- Pending Filter: زر "المعلق فقط" (🔍) للمدن والمناطق لتسهيل إيجاد غير المربوطة
- تحديث `provider_geo_mappings`: إضافة `bunyan_region_id` و `parent_mapping_id` في Supabase
- إعادة كتابة `7_DELIVERY_INTEGRATION_GUIDE.md` من دليل branding → دليل تقني شامل
- تحديث `2_DATABASE_SCHEMA.md` ليعكس هيكل Cross-Mapping الفعلي

**الملفات:**
- `src/app/super-admin/city-mappings/page.tsx` (Polymorphic dropdown, Smart Match, Pending Filter)
- `src/core/db/store.ts` (addCityMapping, addRegionMapping payloads)
- `src/core/types/index.ts` (bunyan_region_id, parent_mapping_id)
- `src/core/db/seed.ts` (parent_mapping_id: null for all seed mappings)
- `_DOCS/7_DELIVERY_INTEGRATION_GUIDE.md` (rewritten)
- `_DOCS/2_DATABASE_SCHEMA.md` (updated)

---

### Sprint 11 — Zustand Slices Pattern / معالجة الخطر R4 God Object (2026-03-15)
- **الهدف:** تفكيك `store.ts` (1856 سطر) إلى وحدات منطقية مستقلة باستخدام Zustand Slices Pattern
- **النتيجة:** صفر أخطاء TypeScript بعد إعادة الهيكلة الكاملة
- **الأثر:** store.ts انخفض من 1856 → 120 سطر (Root Combiner فقط)

**الشرائح المُنشأة:**
| Slice | المحتوى | السطور التقريبية |
|-------|---------|----------------|
| `coreSlice.ts` | Couriers, Debts, Tenants, Treasury, Users, Notifications, Super Admin | ~140 |
| `productsSlice.ts` | المنتجات + WAC + حماية الخزينة | ~160 |
| `ordersSlice.ts` | دورة الطلبيات + خصم المخزون | ~200 |
| `partnersEmployeesSlice.ts` | الشركاء + الموظفون + الرواتب | ~250 |
| `geoMappingSlice.ts` | Supabase geo_mappings | ~170 |
| `deliverySlice.ts` | VanEx API + التسويات + المدن | ~280 |

**نقاط تقنية حرجة:**
- `providerAuthStore.ts` مُفصول لتجنب Circular Import بين deliverySlice و store.ts
- الـ SEED تُكتب بعد spread الـ Slices في store.ts لتتجاوز القيم الابتدائية الفارغة
- `persist` middleware محفوظ بنفس key `bunyan-erp-v1` (لا ضياع بيانات localStorage)
- `useProviderAuthStore` يُعاد تصديره من store.ts للتوافق مع الاستيرادات القديمة

**الملفات:**
- `src/core/db/store.ts` (أُعيد كتابته كـ Root Combiner)
- `src/core/db/providerAuthStore.ts` (جديد — مستقل)
- `src/core/db/slices/` (6 ملفات جديدة)
- `_DOCS/1_SYSTEM_RULES.md` (إصدار 4.2 + قانون Zustand Slices)
- `_DOCS/5_MODULES_MAP.md` (هيكل slices/ المُحدَّث)

---

### Sprint 12 — VanEx Tracking & Sync Finalization (2026-03-22)
- **Auto-Send to VanEx:** يتم إرسال الطلبية لشركة الشحن (VanEx) تلقائياً عند تغيير الحقل `status` إلى `processing` (من خلال `store.ts`).
- **Hide Cancellation:** إخفاء زر الإلغاء المجاني للطلبيات بعد إرسالها لشركة التوصيل لمنع الخلافات في الـ Status.
- **Full Cancellation Hook:** في ملف `sync/route.ts` و `track/route.ts`، أي شحنة تستقبل حالة `cancelled` من مسار VanEx تقوم باستدعاء كود الـ API الخاص بـ `/api/orders/status` لضمان استرجاع المخزون والخزينة.
- **Status Normalization:** تم ترقية دالة `getShipmentStatus` واستخدام الـ endpoint: `/customer/package/${trackingCode}` مباشرة.
- **Mapping Update:** إضافة حالتي `complete` (تُعادل `delivered`) و `store_canceled` (تُعادل `cancelled`).

**الملفات:**
- `src/app/(tenant)/orders/page.tsx`
- `src/core/delivery/VanexAdapter.ts`
- `src/app/api/vanex/track/route.ts`
- `src/app/api/vanex/sync/route.ts`
- `src/core/types/index.ts`

---

## الوحدات القادمة 🔄
1. نشر تجريبي على Vercel
2. إضافة شركة توصيل ثانية (Adapter جديد)
3. الخطر R2: نقل بيانات Tenant من localStorage → Supabase

---

## آخر تحديث
**التاريخ:** 2026-03-22
**الجلسة:** Sprint 12 — VanEx Tracking & Sync Finalization
**التالي:** نشر تجريبي

لا تشغّل أي أوامر في Terminal. عدّل الملف مباشرة فقط.