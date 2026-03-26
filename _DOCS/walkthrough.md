# Vanex Integration Overhaul — Walkthrough

## ملخص التغييرات

أعدنا بناء منظومة ربط فانكس بالكامل — تقنياً وتصميمياً. الهدف: نظام موثوق لا يُكرر الإرسال، يُزامن الحالات، ويعرض كل شيء بوضوح للمستخدم.

---

## الملفات المعدّلة

### Backend & Logic

#### [deliverySlice.ts](file:///c:/Users/abdo/Documents/erb/1/libya-erp-saas%202/src/core/db/slices/deliverySlice.ts)
- **Dedup Guard:** فحص `vanex_package_id` من Supabase قبل الإرسال → يُرجع خطأ واضح إذا أُرسلت مسبقاً
- **Supabase Persistence:** بدلاً من حفظ بيانات فانكس في Zustand فقط (تضيع عند إعادة التحميل)، الآن تُحفظ مباشرة في DB
- أُزيل تحديث Zustand cache (الطلبيات تُجلب من React Query)

#### [VanexAdapter.ts](file:///c:/Users/abdo/Documents/erb/1/libya-erp-saas%202/src/core/delivery/VanexAdapter.ts)
- تم تصدير `VANEX_TO_BUNYAN_STATUS` للاستخدام في API routes
- حُذفت كل سطور `console.log` التشخيصية (`VANEX_AUTH`, `VANEX_API_RAW_RESPONSE`, `VANEX_DEBUG`, `VANEX_SUB_CITIES_EXTRACT`)

### API Routes الجديدة

#### [NEW] [api/vanex/track/route.ts](file:///c:/Users/abdo/Documents/erb/1/libya-erp-saas%202/src/app/api/vanex/track/route.ts)
`POST /api/vanex/track` — تتبع طلبية واحدة من فانكس:
- يجلب الطلبية + token الشركة من Supabase
- يستدعي `vanexAdapter.getShipmentStatus()`
- يحدّث `courier_raw_status` + `status` في DB (باستخدام `VANEX_TO_BUNYAN_STATUS`)
- لا يُغيّر حالات نهائية (delivered, cancelled, return_confirmed)

#### [NEW] [api/vanex/sync/route.ts](file:///c:/Users/abdo/Documents/erb/1/libya-erp-saas%202/src/app/api/vanex/sync/route.ts)
`POST /api/vanex/sync` — مزامنة جماعية:
- يجلب كل الطلبيات النشطة المرسلة لفانكس للتاجر
- يُجمّع tokens الشركات (batch optimization)
- لكل طلبية: يقارن الحالة ويُحدّث إذا تغيرت
- يُرجع عدد المُزامنة والأخطاء

### UI/UX Overhaul

#### [orders/page.tsx](file:///c:/Users/abdo/Documents/erb/1/libya-erp-saas%202/src/app/%28tenant%29/orders/page.tsx)

| الميزة | التفصيل |
|--------|---------|
| 📋 كود فانكس | Badge بنفسجي مع أيقونة Copy — نسخ بضغطة مع toast تأكيد |
| 🏷️ حالة الشحنة | Badges ملونة: 📦 لم تُرسل / 🚛 أُرسلت / 🏃 في الطريق / ✅ وصلت |
| 🔄 زر تتبع | RefreshCw — يجلب حالة حية من فانكس ويُحدث الجدول |
| 🔁 مزامنة تلقائية | `useEffect` عند فتح الصفحة يستدعي `/api/vanex/sync` بصمت |
| 🚫 Dedup Guard | زر "جاهز للشحن" يختفي إذا `vanex_package_id` موجود |
| ⚠️ ConfirmDialog | عند إلغاء طلبية مرسلة لفانكس: يُذكر إلغاء الشحنة من فانكس |
| 📑 فلتر جديد | Tab "جاهزة للشحن" (`ready_to_ship`) |
| 🔄 React Query | Invalidation بعد إرسال/تتبع لتحديث الجدول تلقائياً |

---

## Verification (يدوي)

> لا توجد اختبارات تلقائية في المشروع. التحقق يدوي عبر المتصفح.

| الاختبار | الخطوات |
|----------|---------|
| إرسال لفانكس | اضغط "جاهز للشحن" → تأكد ظهور VNX code + اختفاء الزر |
| تتبع | اضغط 🔄 بجانب طلبية مرسلة → تأكد تحديث الحالة |
| إلغاء | اضغط "إلغاء" على طلبية مرسلة → تأكد ذكر فانكس في رسالة التأكيد |
| مزامنة | أعد تحميل الصفحة → المزامنة تعمل بصمت |
