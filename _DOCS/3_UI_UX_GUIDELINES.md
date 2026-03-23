# 3_UI_UX_GUIDELINES.md — دستور التصميم Enterprise SaaS
# الإصدار 4.0

---

## § 1 — فلسفة التصميم

### Progressive Disclosure
- اعرض فقط ما يحتاجه المستخدم الآن
- الحقول الاختيارية: زر "+ إضافة" يظهرها عند الطلب
- الإجراءات الخطيرة: مخفية في Kebab Menu ⋮ دائماً

### Zero Visual Noise
- لا أزرار حذف/تجميد مرئية دائماً
- لا حقول للـ ID الرقمي — Dropdowns تُظهر الأسماء وتخزن الـ ID

### Real Data Only
- كل رقم من Zustand Store
- القوائم الفارغة: EmptyState أنيق — لا أرقام وهمية
- ممنوع hardcoded values في الـ UI

---

## § 2 — المكونات المحرمة والبدائل

| محرم | البديل |
|------|--------|
| `<select>` | Custom Dropdown + shadow-md |
| Checkbox في الصلاحيات | Toggle Switch |
| Progress Bar للبيانات | Recharts |
| CSS مخصص | Tailwind فقط |
| أيقونة Heart للمالية | Wallet أو Landmark |
| حقل Net Pay قابل للكتابة | Read-only محسوب آلياً |
| أرقام hardcoded | قراءة من Zustand Store |

---

## § 3 — معمارية النوافذ

- **SlideOver:** للإضافات (> 5 حقول → Tabs/Wizard)
- **Split-Pane POS:** لإنشاء الطلبيات فقط
- **Modal صغير:** للتأكيد فقط
- **Kebab Menu ⋮:** للإجراءات الخطيرة

---

## § 4 — معايير FinTech

- الإيرادات: text-emerald-600 مع +
- المصروفات: text-red-600 مع -
- الأرصدة: text-gray-900 (لا أحمر للرصيد)
- formatCurrency() → "1,500 د.ل" | Math.round() دائماً
- Quick Actions: [25%] [50%] [الكل] في نوافذ المال
- الخزائن: فصل بصري دائم (نقدية / مصرفية / قيد التحصيل)
- صافي الراتب: Read-only محسوب آلياً من الـ Store

---

## § 5 — Data Visualization

- Stat Cards: رقم من الـ Store + Trend Badge + Sparkline
- Donut Chart: للمقارنات النسبية
- Area Chart: للبيانات الزمنية مع gradient fill
- ممنوع Progress Bars للبيانات المعقدة
- إذا لا بيانات: EmptyState بدلاً من Chart فارغ

---

## § 6 — الهوية البصرية

- Primary: bunyan-600 | Page BG: bg-gray-50 | Card: bg-white
- Sidebar: linear-gradient(180deg, #2a1045, #3a1a5a)
- البطاقات: rounded-2xl | الحقول: rounded-xl | Badges: rounded-full
- shadow-sm عادي | hover:shadow-md

---

## § 7 — Status Badges

- Success:  text-emerald-700 bg-emerald-50 border-emerald-200
- Warning:  text-amber-700   bg-amber-50   border-amber-200
- Danger:   text-red-700     bg-red-50     border-red-200
- Info:     text-blue-700    bg-blue-50    border-blue-200
- Neutral:  text-gray-700    bg-gray-50    border-gray-200

---

## § 8 — مكونات API خاصة (جديدة)

### API Action Button (زر الإجراء عبر API)
- الحالة الانتظارية (Loading): خلفية رمادية + `cursor-not-allowed` + حلقة `animate-spin`
- الحالة الجاهزة: `bg-violet-50 hover:bg-violet-100 text-violet-700 border-violet-200`
- قاعدة: **زر API الواحد يستبدل كل أزرار الحالة الاعتيادية** — لا يظهران معاً أبداً

```jsx
// نمط Loading Spinner داخل زر
<span className="w-3 h-3 border-2 border-violet-400 border-t-transparent rounded-full animate-spin" />
```

### API Connection Badge (شارة الاتصال)
- في Dropdown شركات التوصيل: `{c.name} — أساسي: {fee}` + `🟢` إذا isApiConnected
- في بطاقات الشركات: Connection Badge مستقل

### Tracker / Sync Actions (أزرار التتبع والمزامنة)
- **مزامنة جماعية:** يدوية عبر زر `Sync` أعلى الجداول أو تلقائية. تظهر `Toast` بنتيجة التحديثات.
- **تتبع فردي:** زر المجهر `🔍`، يعرض حالة التحميل (Spinner) ثم يُظهر `Toast` يحتوي على الحالة.
- **التشخيص الدقيق (Raw Status):** في حالات التشخيص العميق للـ APIs المتمردة، يُنصح بعرض `rawStatus` (النص الخام من الـ API) مؤقتاً في الـ Toast بدلاً من الكلمة المترجمة لتسهيل بناء `Status Map`.

### Smart City Autocomplete (المدينة الذكية)
- حقل نصي عادي مع `onFocus` / `onBlur` + قائمة مقترحات ديناميكية
- **الفلترة:** من `shippingCityMappings` النشطة فقط (is_active: true)
- **التأثير الجانبي:** عند الاختيار الصحيح يُعبّأ `vanexCityId` تلقائياً ويُجلب `vanexSubCities`
- **إعادة الضبط:** عند تغيير المدينة → `vanexSubCityId = undefined`
- **لا Dropdown مخصص** — نص حر مع تحقق عند الحفظ

