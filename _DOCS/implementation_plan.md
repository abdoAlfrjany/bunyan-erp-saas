# إعادة بناء منظومة ربط فانكس — خطة التنفيذ الشاملة

## ملخص المشكلة

النظام يرسل الشحنات لفانكس بنجاح ولكنه يعاني من:
1. **غياب التزامن** — تغيير الحالة في فانكس لا ينعكس في بنيان
2. **إرسال مكرر** — نفس الطلبية تُرسل أكثر من مرة (`vanex_package_id` يُحفظ في Zustand فقط!)
3. **إلغاء أحادي** — الإلغاء من بنيان يلغي من فانكس (أُضيف مؤخراً) ولكن بدون feedback واضح
4. **واجهة ناقصة** — كود فانكس غير بارز، لا تتبع، لا مؤشرات حالة واضحة

---

## User Review Required

> [!IMPORTANT]
> **قرار تصميمي:** المزامنة ستكون عبر **زر "مزامنة" يدوي** + **تتبع فردي بالضغط** بدلاً من polling تلقائي. هذا أنسب لبيئة الإنترنت الليبي غير المستقر ولا يُرهق API فانكس.

> [!WARNING] 
> **تغيير جوهري:** دالة [sendOrderToVanex](file:///c:/Users/abdo/Documents/erb/1/libya-erp-saas%202/src/core/db/slices/deliverySlice.ts#132-238) ستُحفظ نتائجها في **Supabase مباشرة** (وليس Zustand فقط). هذا يعني أن `vanex_package_id` لن يضيع عند إعادة تحميل الصفحة.

---

## Proposed Changes

### Component 1: Backend — حماية التكرار وحفظ البيانات

#### [MODIFY] [deliverySlice.ts](file:///c:/Users/abdo/Documents/erb/1/libya-erp-saas%202/src/core/db/slices/deliverySlice.ts)

**في [sendOrderToVanex](file:///c:/Users/abdo/Documents/erb/1/libya-erp-saas%202/src/core/db/slices/deliverySlice.ts#132-238):**
- ✅ **Dedup guard:** فحص `vanex_package_id` من الـ row المجلوب من Supabase — إذا موجود → `return { success: false, error: 'أُرسلت مسبقاً' }`
- ✅ **حفظ في DB:** بعد نجاح [createShipment](file:///c:/Users/abdo/Documents/erb/1/libya-erp-saas%202/src/core/types/index.ts#394-395)، تحديث الطلبية في Supabase بـ:
  - `vanex_package_code`, `vanex_package_id`, `courier_raw_status`, `status = 'ready_to_ship'`
- ✅ إزالة التحديث في Zustand cache (الطلبيات تُجلب من React Query)
- ✅ إرجاع `trackingCode` و `packageId` في نتيجة الدالة للاستخدام في UI

---

### Component 2: Backend — API Routes للتتبع والمزامنة

#### [NEW] [track/route.ts](file:///c:/Users/abdo/Documents/erb/1/libya-erp-saas%202/src/app/api/vanex/track/route.ts)

**`POST /api/vanex/track`** — تتبع طلبية واحدة:
- يستقبل: `{ orderId }`
- يجلب الطلبية + شركة التوصيل من Supabase
- يستدعي `vanexAdapter.getShipmentStatus(packageCode)`
- يحدّث `courier_raw_status` + `status` (عبر `VANEX_TO_BUNYAN_STATUS`) في DB
- يُرجع: `{ success, rawStatus, bunyanStatus, lastUpdate }`

#### [NEW] [sync/route.ts](file:///c:/Users/abdo/Documents/erb/1/libya-erp-saas%202/src/app/api/vanex/sync/route.ts)

**`POST /api/vanex/sync`** — مزامنة جماعية:
- يجلب كل الطلبيات التي `vanex_package_code IS NOT NULL` و `status NOT IN ('delivered', 'cancelled', 'return_confirmed')` للـ tenant
- لكل طلبية: يستدعي [getShipmentStatus](file:///c:/Users/abdo/Documents/erb/1/libya-erp-saas%202/src/core/types/index.ts#395-396) ويحدّث الحالة
- يُرجع: `{ synced: number, errors: string[] }`
- محمي بـ `requireAuth + assertTenantMatch`

---

### Component 3: VanexAdapter — تحسينات

#### [MODIFY] [VanexAdapter.ts](file:///c:/Users/abdo/Documents/erb/1/libya-erp-saas%202/src/core/delivery/VanexAdapter.ts)

- تصدير `VANEX_TO_BUNYAN_STATUS` (حالياً مخفي داخل الملف)
- حذف `console.log` للـ debugging (مثل `VANEX_AUTH`, `VANEX_API_RAW_RESPONSE`, `VANEX_DEBUG`)
- إضافة `getPackageByCode(code, token)` لجلب تفاصيل الشحنة

---

### Component 4: API Route الحالي — تحسين الإلغاء

#### [MODIFY] [route.ts](file:///c:/Users/abdo/Documents/erb/1/libya-erp-saas%202/src/app/api/orders/status/route.ts)

- إضافة `vanex_package_code` للـ select query (لاستخدامه في التتبع)
- عند الإلغاء أو `return_confirmed`: تنظيف حقول فانكس في DB (`vanex_package_code = null` بعد إلغاء ناجح)
- تحسين رسائل الخطأ لتشمل نتيجة فانكس

---

### Component 5: UI — صفحة الطلبيات

#### [MODIFY] [page.tsx](file:///c:/Users/abdo/Documents/erb/1/libya-erp-saas%202/src/app/%28tenant%29/orders/page.tsx)

**1. كود فانكس مرئي وقابل للنسخ:**
- عند وجود `vanex_package_code`: عرض badge بنفسجي مع أيقونة نسخ
- عند النسخ: toast "تم نسخ كود الشحنة"

**2. مؤشر حالة الشحنة:**
- badge ملون بجانب حالة الطلبية يُظهر:
  - `📦 لم تُرسل` (processing بدون vanex code)
  - `🚛 أُرسلت` (ready_to_ship / pending في فانكس)
  - `🏃 في الطريق` (with_courier / shipped/on_track في فانكس)
  - `✅ وصلت` (delivered)
  - `🔄 مرتجعة` (returned / return_confirmed)
  - `❌ ملغاة` (cancelled)

**3. زر "تتبع" (Refresh Icon):**
- يظهر لكل طلبية لها `vanex_package_code`
- يستدعي `POST /api/vanex/track` 
- يُظهر spinner أثناء الجلب ثم يُحدث الحالة + toast

**4. حماية زر "جاهز للشحن":**
- إذا `vanex_package_id` موجود → لا يَظهر الزر (أُرسلت مسبقاً)
- إضافة `disabled` state لمنع الضغطات المتزامنة (موجود جزئياً)

**5. تجربة الإلغاء المحسنة:**
- عند إلغاء طلبية لها vanex code: رسالة تأكيد تشرح أن الإلغاء سيتم من فانكس وبنيان
- بعد الإلغاء: toast يوضح النتيجة (نجح فانكس + نجح بنيان / فشل فانكس ونجح بنيان)

**6. زر "مزامنة الحالات":**
- زر في رأس الصفحة بجانب الفلاتر
- يستدعي `POST /api/vanex/sync`
- يُظهر عداد "تم مزامنة X طلبيات"

**7. إضافة `ready_to_ship` لفلتر الحالات:**
- إضافة tab "جاهزة للشحن" في القائمة (موجود في `statusFiltersList` لكن مفقود حالياً)

---

### Component 6: StatusColors — تحسين

#### [MODIFY] [statusColors.ts](file:///c:/Users/abdo/Documents/erb/1/libya-erp-saas%202/src/shared/utils/statusColors.ts)

- إضافة `ready_to_ship` للـ filter tabs (التعريف موجود لكن الـ tab غير مضاف)

---

## Verification Plan

### Manual Verification

> [!NOTE]
> لا توجد اختبارات تلقائية في المشروع حالياً. التحقق سيكون يدوي عبر المتصفح.

**اختبار 1 — إرسال طلبية لفانكس:**
1. افتح صفحة الطلبيات في المتصفح
2. ابحث عن طلبية بحالة `processing` ومرتبطة بشركة توصيل فانكس
3. اضغط "جاهز للشحن" — تأكد ظهور toast نجاح
4. تأكد ظهور كود VNX بجانب الطلبية
5. اضغط "جاهز للشحن" مرة ثانية — يجب ألا يظهر الزر أصلاً (dedup)

**اختبار 2 — تتبع طلبية:**
1. اضغط زر "تتبع" (🔄) بجانب طلبية مرسلة
2. تأكد ظهور spinner ثم تحديث حالة الشحنة
3. تحقق من تحديث `courier_raw_status` في Supabase

**اختبار 3 — المزامنة الجماعية:**
1. اضغط زر "مزامنة" في رأس صفحة الطلبيات
2. تأكد ظهور toast "تم مزامنة X طلبيات"

**اختبار 4 — إلغاء طلبية مرسلة لفانكس:**
1. اضغط "إلغاء" على طلبية لها vanex code
2. تأكد ظهور رسالة تأكيد تذكر فانكس
3. أكد الإلغاء — تأكد من toast يوضح نتيجة الإلغاء من الطرفين
