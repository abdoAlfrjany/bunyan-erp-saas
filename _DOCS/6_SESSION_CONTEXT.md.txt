# _DOCS/6_SESSION_CONTEXT.md
# سياق الجلسات — Bunyan ERP SaaS

## معلومات المشروع
- **المسار المحلي:** `C:\Users\abdo\Documents\erb\1\libya-erp-saas 2`
- **GitHub:** https://github.com/abdoAlfrjany/bunyan-erp-saas (Public)
- **السوق المستهدف:** ليبيا
- **العملة:** د.ل (دينار ليبي) — Math.round فقط، ممنوع .toFixed(2)
- **الحالة:** يعمل محلياً ✅ — npm run build بدون أخطاء ✅

## المستخدم
- ليس مبرمجاً — لديه أساس فقط
- يستخدم Antigravity لتعديل الملفات مباشرة
- الأدوات: Claude (المساعد الأول) + Antigravity (المنفذ) + GitHub

## نظام العمل
- **Claude:** يقرأ المشروع ويعطي أوامر مفصلة جاهزة
- **Antigravity:** ينفذ الأوامر مباشرة على الملفات
- **القاعدة الذهبية:** كل أمر يبدأ بقراءة الملفات المعنية أولاً

## توزيع النماذج
| النموذج | متى تستخدمه |
|---------|-------------|
| Gemini Flash + Fast | تعديلات بسيطة: نص، لون، padding، حذف سطر |
| Gemini Pro + Planning | منطق متوسط، ربط مكونات، تصميم جديد |
| Claude Sonnet + Planning | منطق مالي معقد، Zustand، معمارية |
| Claude Opus | فقط إذا فشل Sonnet مرتين |

## قواعد Antigravity
- دائماً: "لا تشغّل أي أوامر في Terminal. عدّل الملف مباشرة فقط."
- دائماً: أضف قراءة الملفات المعنية في بداية كل أمر
- عند التعديل المعقد: أضف قراءة _DOCS في البداية

## بداية كل جلسة جديدة
أرسل هذا لـ Claude أولاً:
```
اقرأ هذه الملفات أولاً:
- _DOCS/1_SYSTEM_RULES.md
- _DOCS/2_DATABASE_SCHEMA.md
- _DOCS/3_UI_UX_GUIDELINES.md
- _DOCS/4_WORKFLOWS.md
- _DOCS/5_MODULES_MAP.md
- _DOCS/6_SESSION_CONTEXT.md
```

## نهاية كل جلسة
```
git add .
git commit -m "وصف التعديل"
git push
```

---

## الوحدات المكتملة ✅

### وحدة المخزون والعهدة (مكتملة - 2026-03-09)
**ما تم بناؤه:**
- زر + للإضافة السريعة (منتج بسيط + متغيرات)
- WAC Engine (متوسط التكلفة المرجح)
- حماية الخزينة في Store Layer + UI Layer
- جدول محوري (Pivot Table) للمتغيرات
- لوحة تحليلات المنتج (📊) مع Recharts
- Smart Variant Badges بألوان ديناميكية
- التصنيف الديناميكي (Combo-box + فئات مخصصة)
- شريط فلترة ديناميكي (متاح/ينفذ/نفذ + فئات)
- رسائل Toast تفصيلية (المبلغ + WAC الجديد)
- ConfirmDialog قبل إضافة منتج
- نافذة إضافة منتج → Modal مركزي

**الملفات المعدّلة:**
- `src/app/(tenant)/inventory/page.tsx`
- `src/shared/components/ui/AddProductSlideOver.tsx`
- `src/core/db/store.ts`
- `_DOCS/1_SYSTEM_RULES.md`
- `_DOCS/2_DATABASE_SCHEMA.md`

**القواعد المضافة للـ DOCS:**
- الحماية من الخزينة السالبة في Store Layer إجبارية
- Math.round فقط للأرقام المالية
- customCategories و customUnits تُعزل بـ tenantId

---

## الوحدات القادمة 🔄
1. **المبيعات والطلبيات** — الأولوية القادمة
2. **الخزينة** — تقارير وحركات مالية
3. **الموارد البشرية** — رواتب وعمولات
4. **التقارير والتحليلات** — Dashboard

---

## ملاحظات تقنية مهمة
- Zustand store في: `src/core/db/store.ts`
- Types في: `src/core/types/index.ts`
- المكونات المشتركة: `src/shared/components/ui/`
- Super Admin: `super@bunyan.ly`
- الصفحات المحمية (Owner فقط): treasury, hr, analytics, settings
- tenantId يجب أن يكون في كل عملية إضافة/تعديل/حذف

## آخر تحديث
**التاريخ:** 2026-03-09
**الجلسة:** بناء وحدة المخزون كاملة + فحص معماري شامل + إصلاح 11 مشكلة حرجة
```

---

أرسل هذا المحتوى لـ **Gemini Flash** وقل له:
```
أنشئ ملف جديد في المسار:
_DOCS/6_SESSION_CONTEXT.md

وضع فيه هذا المحتوى كاملاً كما هو.
لا تشغّل أي أوامر في Terminal.
```

ثم:
```
git add .
git commit -m "docs: add session context file"
git push