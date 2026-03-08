# 3_UI_UX_GUIDELINES.md — دليل التصميم والواجهة (الواقع الحالي - الإصدار 3.3)

# ⚠️ كل مكون يُبنى وفق هذا الدليل — تم تنظيف وتحديث كل الأكواد لتعكس هذه القواعد

---

## 🎨 الهوية البصرية — نظام الألوان

### ألوان الـ Sidebar والقواعد المطبقة

```css
Sidebar BG:          background: linear-gradient(180deg, #2a1045 0%, #3a1a5a 100%) /* بنفسجي متدرج */
Sidebar Item Hover:  hover:bg-white/10
Sidebar Item Active: bg-bunyan-500 text-white shadow-lg
Sidebar Text:        text-white/70  /* أبيض مائل للرمادي */
Sidebar Text Active: text-white
Sidebar Icon:        text-white/50 group-hover:text-white

Page Background:     bg-gray-50
Card Background:     bg-white
Card Border:         border-gray-200
```

### نصوص — داكنة وواضحة (Tailwind Classes الفعّالة)

```css
Text Primary:        text-gray-900   /* للعناوين الرئيسية */
Text Secondary:      text-gray-700   /* للعناوين الثانوية */
Text Body:           text-gray-600   /* النصوص العادية */
Text Muted:          text-gray-400   /* التفاصيل الثانوية وثانوية الجدول */
Text Gradient:       bg-gradient-to-r from-bunyan-600 to-bunyan-800 bg-clip-text text-transparent
```

### ألوان وحدات النظام كبطاقات

```css
/* البطاقات الإحصائية ذات الألوان المخصصة لكل قسم */
Dashboard:     bg-bunyan-600      /* أزرق بنيان */
Inventory:     bg-blue-600        /* أزرق ساطع */
Orders:        bg-orange-500      /* برتقالي لامع */
Delivery:      bg-emerald-600     /* أخضر توصيل */
Treasury:      bg-purple-600      /* بنفسجي الخزينة */
Partners:      bg-pink-600        /* وردي الشركاء */
HR:            bg-lime-600        /* ليموني الموظفين */
Debts:         bg-red-600         /* أحمر الديون */
Settings:      bg-slate-700       /* رمادي الإعدادات */
SuperAdmin:    bg-stone-800       /* السوبر أدمن البني الداكن */
```

### ألوان الحالات (Status Colors المطبقة)

تم استخدام متغيرات الـ Tailwind الأساسية لتوحيد شارات (Badges) الحالات في كافة الملفات:

```css
Success:   text-emerald-700  bg-emerald-50   border-emerald-200
Warning:   text-amber-700    bg-amber-50     border-amber-200
Danger:    text-red-700      bg-red-50       border-red-200
Info:      text-blue-700     bg-blue-50      border-blue-200
Neutral:   text-gray-700     bg-gray-50      border-gray-200
```

---

## 🃏 مكونات التصميم القياسية المطبّقة بالكامل

### 1- بطاقة الإحصاء الجانبية (Stat Card)

استخدمت في واجهات الـ Dashboard، Delivery، Debts لتوضيح المبالغ بـ `formatCurrency`.

- خلفية بيضاء مع `border-gray-200` وزوايا مدورة `rounded-2xl` وظل `shadow-sm`.
- الرقم يظهر بخط غليظ `font-black`.

### 2- الـ SlideOver (النوافذ المنزلقة من اليمين)

تم اعتماد الـ `SlideOver` بدلاً من الـ `Modal` التقليدي في جميع عمليات الإضافة والتعديل:

- إضافة شريك `partner`
- إضافة موظف `employee`
- إضافة مستخدم للإعدادات `user`
- إضافة بطاقة دين `debt`
- يعتمد على `animate-slide-in-right` لحركة انسيابية ممتازة.

### 3- مربعات الإشعار وتنبيه النسب المئوية

- في نافذة الشركاء: يظهر النص الرمادي `<span className="text-gray-500 font-normal">المتبقي: ...%</span>` لمنع تخطي 100%.
- في نافذة الديون: يظهر التقويم `CalendarDays` ومربع النص `description` بجانب الأرقام لإعطاء توضيح إضافي للعمليات.

---

## ⚙️ تصميم وحدة الإعدادات (Settings - الأحدث تطبيقاً)

### 6 تبويبات نافيجاشن (Tab Navigation)

تم تطبيق تصميم رأسي / أفقي (يستجيب للشاشات) للتبديل بين 6 صفحات إعدادات بسلاسة:

```text
1. 🏪 عام (General)       ← شعار المتجر، اسم المتجر، الرقم الضريبي، الهواتف.
2. 💳 الفوترة (Billing)   ← تفاصيل باقة البنيان الحالية، التجديد والدفع.
3. 📦 الطلبيات (Orders)     ← صيغة أرقام الطلبيات (Prefix)، الحزمة المخصصة.
4. 📋 المخزون (Inventory) ← قياسات المنتجات، الحد الأدنى للنواقص.
5. 🔔 الإشعارات (Notifs)   ← أصوات التنبيه والخيارات الزمنية.
6. 👥 المستخدمون (Users)   ← إضافة / دعوة مستخدم جديد وتحديد دوره والصلاحيات (Permissions).
7. 🛡️ الأمان (Security)   ← تغيير الباسورد، تفريغ شامل للداتا.
```

يمتاز كل تبويب (Tab) بزر ينير بالأزرق `bg-bunyan-600` والنص بلون `white`، وإذا كان التبويب غير نشط يظهر الـ Icon بلون `text-gray-400`.

---

## 📱 قواعد التجاوب (Mobile Responsive Flex/Block)

كافة الصفحات تمركزت على أصول الـ Layout المتجاوب:

- تم تفريغ التعارضات في أكواد الـ CSS (مثل كتابة `flex block` معاً تم تصحيحها لـ `flex` فقط).
- الجدول يُظهر الـ `scroll-x` على الشاشات الصغيرة بفضل تغليفه بـ `overflow-x-auto`.
- أيقونات الـ Nav السفلية `Bottom Nav` متوفرة في الموبايل بدلاً من القائمة الجانبية (التي تختفي كلياً وتتحول لزر الـ Toggle).

---

## 🔔 إشعارات النظام (Toasts)

تم استخدام مكون `Toast` يظهر للمستخدم الرسائل الواضحة (عربي):

```typescript
showToast("تم حفظ التغييرات بنجاح", "success");
showToast("يرجى التحقق من إدخالاتك", "error");
showToast("يقتضي إضافة شركة توصيل لتنفيذ الأمر", "warning");
```

تختفي جميع الـ Toasts ذاتياً عبر موقت بداخل الـ Hook المدمج في `RootLayout`.

**نهاية الملف المحدّث**
