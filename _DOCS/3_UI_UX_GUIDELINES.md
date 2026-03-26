# 3_UI_UX_GUIDELINES.md — دستور التصميم بنيان ERP
# الإصدار 5.0 — Dark Premium SaaS Design System

---

## § 1 — فلسفة التصميم

### الهدف
نظام ERP عالمي المستوى في بيئة RTL عربية — احترافي، بسيط، سريع.
الإلهام: Linear · Vercel Dashboard · Craft.do · Raycast

### المبادئ الأساسية الثلاثة

**1. Progressive Disclosure (الإفصاح التدريجي)**
- اعرض فقط ما يحتاجه المستخدم الآن
- الحقول الاختيارية والثانوية: زر "+" يكشفها عند الطلب
- الأقسام الكبيرة (كقوائم المنتجات): مطوية بزر Toggle — لا تظهر دائماً
- الإجراءات الخطيرة: مخفية في Kebab Menu ⋯ دائماً

**2. Zero Visual Noise (الصفر البصري)**
- لا أزرار حذف/تجميد مرئية دائماً
- كل قسم في فورم الإضافة يُحدّ ببطاقة Card واضحة ومنفصلة
- لا حقول ID رقمي — Dropdowns تُظهر الأسماء وتخزن الـ ID
- لا أرقام hardcoded في الـ UI — كل بيانات من Store

**3. Enterprise-Grade Aesthetics (المظهر الاحترافي)**
- الخلفية داكنة دائماً — لا white backgrounds خارج المدخلات
- البطاقات ذات تأثير عمق لطيف (border + shadow)
- التفاعلات: micro-animations خفية عند الـ hover والـ focus
- الإضاءة والـ glow: فقط على العناصر الأساسية (CTAs، selected states)

---

## § 2 — لوحة الألوان (Design Tokens)

```
/* الألوان الأساسية */
--color-bg:           #08091A   /* خلفية الصفحة الرئيسية — navy-black */
--color-surface:      #0F1035   /* البطاقات والـ panels */
--color-surface-2:    #161A45   /* الأسطح المرتفعة — hover states, inputs */
--color-surface-3:    #0A0B22   /* الأعمق — headers الداخلية، inputs */

/* الحدود */
--color-border:       rgba(109, 40, 217, 0.2)  /* الحدود الاعتيادية */
--color-border-hover: rgba(109, 40, 217, 0.5)  /* عند التحديد */

/* Primary — Violet → Indigo */
--color-primary-from: #6D28D9
--color-primary-to:   #4F46E5
--color-primary-glow: rgba(109, 40, 217, 0.35)

/* النص */
--color-text-primary:   #F0F4FF  /* النص الرئيسي */
--color-text-secondary: #8E9AC8  /* النص الثانوي */
--color-text-muted:     #555B80  /* نص خافت، labels */

/* الحالات */
--color-success: #22C55E   /* emerald-500 */
--color-warning: #F59E0B   /* amber-500 */
--color-danger:  #EF4444   /* red-500 */
--color-info:    #38BDF8   /* sky-400 */

/* المالية */
--color-revenue:  #22C55E  /* إيرادات — أخضر */
--color-expense:  #EF4444  /* مصروفات — أحمر */
--color-balance:  #F0F4FF  /* أرصدة — محايد */
```

---

## § 3 — نظام التايبوغرافي

```
Font Family: Inter (Google Fonts) — مُحمَّل في layout.tsx بالفعل.

/* Headings */
Page Title:    font-black text-2xl tracking-tighter text-[#F0F4FF]
Card Title:    font-bold  text-sm  text-[#F0F4FF]
Stat Value:    font-black text-2xl font-mono — gradient text violet→indigo

/* Labels — حقول الفورم */
Field Label:   font-bold text-[10px] uppercase tracking-widest text-[#555B80] mb-1.5

/* Body */
Normal:        text-[13px] text-[#F0F4FF]
Muted:         text-[13px] text-[#8E9AC8]
Tiny/Caption:  text-[11px] text-[#555B80]

/* Monospace — أرقام وكودات */
Amount:        font-mono font-black text-[#F0F4FF]
Order No:      font-mono font-bold text-violet-300
Tracking Code: font-mono text-[10px] text-violet-400
```

---

## § 4 — معمارية المكونات

### البطاقة Card (القاعدة الأساسية لكل قسم)
```tsx
// بطاقة عادية
className="bg-[#0F1035] border border-[rgba(109,40,217,0.2)] rounded-2xl p-5 
           shadow-[0_2px_24px_rgba(0,0,0,0.3)]"

// بطاقة مرتفعة (elevated — للأسطح الثانوية داخل بطاقة)
className="bg-[#161A45] rounded-xl border border-[rgba(109,40,217,0.1)]"

// بطاقة summary مالية (dark gradient)
className="bg-[radial-gradient(ellipse_at_top_right,#1E0A45_0%,#0A0B22_60%)] 
           border border-violet-700/40 rounded-2xl p-5"
```

### حقول الإدخال (Form Inputs)
```tsx
// Input / Textarea / Select
className="w-full bg-[#0A0B22] border border-[rgba(109,40,217,0.2)] 
           rounded-xl px-3 py-2.5 text-[#F0F4FF] text-[13px]
           focus:border-violet-500 focus:ring-1 focus:ring-violet-500/20 
           outline-none transition-all placeholder:text-[#555B80]"

// Label مع الحقل
className="block text-[#555B80] uppercase tracking-widest text-[10px] font-bold mb-1.5"
```

### الأزرار (Buttons)
```tsx
// Primary CTA
className="bg-gradient-to-r from-violet-600 to-indigo-600 text-white 
           font-bold rounded-xl px-6 py-2.5 
           shadow-[0_0_20px_rgba(109,40,217,0.4)]
           hover:scale-[1.02] hover:brightness-110 
           transition-all cursor-pointer"

// Secondary / Back
className="bg-[#161A45] text-[#8E9AC8] font-bold rounded-xl px-5 py-2.5
           border border-[rgba(109,40,217,0.2)]
           hover:text-[#F0F4FF] hover:border-[rgba(109,40,217,0.5)]
           transition-all cursor-pointer"

// Confirm (Success / Create)
className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white 
           font-bold rounded-xl px-6 py-3.5
           shadow-[0_0_20px_rgba(16,185,129,0.4)]
           hover:shadow-[0_0_28px_rgba(16,185,129,0.6)] hover:scale-[1.01]
           transition-all"

// Danger / Destructive
className="bg-red-900/30 text-red-400 border border-red-800/40 rounded-xl px-4 py-2.5
           hover:bg-red-900/50 hover:border-red-700/60 transition-all"

// Icon Button (small)
className="p-1.5 rounded-lg text-[#555B80] hover:text-[#F0F4FF] 
           hover:bg-[#161A45] transition-all"

// Toggle Button SELECTED
className="bg-gradient-to-r from-violet-600 to-indigo-600 text-white 
           shadow-[0_0_16px_rgba(109,40,217,0.35)] rounded-xl"

// Toggle Button UNSELECTED
className="bg-[#161A45] border border-[rgba(109,40,217,0.2)] text-[#555B80]
           hover:text-[#F0F4FF] hover:border-[rgba(109,40,217,0.4)] rounded-xl"
```

### Status Badges / Pills
```tsx
// النمط العام: bg خافت + text واضح + border
pending:        "bg-violet-900/40  text-violet-300  border border-violet-700/40"
processing:     "bg-indigo-900/40  text-indigo-300  border border-indigo-700/40"
with_courier:   "bg-cyan-900/40    text-cyan-300    border border-cyan-700/40"
ready_to_ship:  "bg-blue-900/40    text-blue-300    border border-blue-700/40"
delivered:      "bg-emerald-900/40 text-emerald-300 border border-emerald-700/40"
cancelled:      "bg-red-900/40     text-red-400     border border-red-700/40"
pending_return: "bg-amber-900/40   text-amber-300   border border-amber-700/40"
return_confirmed:"bg-gray-800/60   text-gray-400    border border-gray-700/40"

// Base classes (مشتركة)
base: "inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold"
```

### Popover / Action Menu
```tsx
className="bg-[#161A45] border border-[rgba(109,40,217,0.3)] 
           rounded-xl p-1.5 shadow-[0_8px_32px_rgba(0,0,0,0.6)]"

// كل عنصر داخل الـ Popover
className="flex items-center gap-2 w-full text-right px-3 py-2 
           text-[12px] font-medium text-[#8E9AC8] 
           hover:bg-[#1E2255] hover:text-[#F0F4FF] 
           rounded-lg transition-colors cursor-pointer"
```

### Accordion / Details
```tsx
// Summary bar
className="flex items-center justify-between px-4 py-3 
           bg-[#161A45] border border-[rgba(109,40,217,0.2)] rounded-xl
           cursor-pointer hover:border-violet-500/50 
           text-violet-300 font-bold text-sm transition-all"

// Content area
className="bg-[#0A0B22] border-t border-[rgba(109,40,217,0.15)] 
           rounded-b-xl p-4"
```

### SlideOver Container
```tsx
className="fixed top-0 right-0 h-full bg-[#08091A] 
           border-l border-[rgba(109,40,217,0.25)]
           shadow-[-20px_0_60px_rgba(0,0,0,0.7)]
           w-full sm:max-w-[540px] flex flex-col z-50"

// Header
className="bg-[#0F1035] border-b border-[rgba(109,40,217,0.2)] px-5 py-4 
           flex items-center justify-between flex-shrink-0"

// Footer
className="absolute bottom-0 left-0 right-0 bg-[#0F1035]
           border-t border-[rgba(109,40,217,0.2)]
           shadow-[0_-8px_32px_rgba(0,0,0,0.4)] p-4"
```

### Autocomplete Dropdown
```tsx
className="absolute top-full left-0 right-0 mt-1 
           bg-[#161A45] border border-[rgba(109,40,217,0.3)]
           rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] 
           z-50 max-h-48 overflow-y-auto"

// كل عنصر
className="w-full text-right px-3 py-2 hover:bg-[#1E2255] 
           text-[13px] text-[#F0F4FF] flex justify-between items-center
           border-b border-[rgba(109,40,217,0.07)] last:border-0 transition"

// Sub-label (provider code)
className="text-[10px] text-[#555B80] font-mono"
```

---

## § 5 — الجداول (Tables)

```tsx
// الغلاف الخارجي
className="bg-[#0F1035] rounded-2xl border border-[rgba(109,40,217,0.15)] 
           overflow-hidden shadow-[0_4px_32px_rgba(0,0,0,0.4)]"

// Header Row
className="bg-[#0A0B22] text-[#555B80] text-[11px] uppercase tracking-widest
           border-b border-[rgba(109,40,217,0.15)]"

// Data Row  
height: h-[60px] أو h-[64px]
className="border-b border-[rgba(109,40,217,0.07)] 
           hover:bg-[#161A45] 
           hover:shadow-[inset_3px_0_0_0_#6D28D9]
           transition-all duration-200"
```

---

## § 6 — إحصائيات وـ KPI Cards

```tsx
// شريط الإحصائيات (Stats Strip)
className="flex items-center bg-[#0F1035] border border-[rgba(109,40,217,0.2)] 
           rounded-2xl overflow-hidden"

// كل KPI
label: "text-[#555B80] text-[11px] uppercase tracking-widest"
value: "bg-gradient-to-r from-violet-400 to-indigo-300 bg-clip-text text-transparent 
        text-2xl font-black"

// فاصل رأسي
className="w-px h-8 bg-[rgba(109,40,217,0.2)]"
```

---

## § 7 — الـ Status Pills (API / Vanex)

```tsx
// شارة يُرسل (Not sent)
className="bg-gray-800/60 text-gray-400 border border-gray-700/40 
           text-[10px] px-1.5 py-0.5 rounded-md font-mono"

// شارة أُرسلت (Sent)
className="bg-violet-900/40 text-violet-300 border border-violet-700/40 
           text-[10px] px-1.5 py-0.5 rounded-md font-mono"

// Tracking Code chip
className="bg-violet-900/30 text-violet-400 border border-violet-700/30
           font-mono text-[10px] px-1.5 py-0.5 rounded-md"
```

---

## § 8 — مبادئ UX خاصة بالـ ERP

### فورم إنشاء طلبية (2-Step SlideOver)
1. **الخطوة 1 — السلة:** قائمة المنتجات **مطوية بزر Toggle** — لا تظهر دائماً  
   يكفي عرض السلة الحالية. الإضافة تكون بالضغط على زر "إضافة منتج"
2. **الخطوة 2 — الزبون والتوصيل:** كل قسم في بطاقة Card منفصلة:
   - Card 1: بيانات الزبون (هاتف + زر هاتف احتياطي + الاسم فقط)
   - Card 2: خيارات التوصيل (Toggle للنوع + شركة + مدينة + منطقة + ملاحظات)
   - Card 3: إعدادات فانكس (Accordion — يظهر فقط عند اختيار Vanex)
   - Card 4: الدفع والتمويل (بدون أي خيار دفع إلكتروني)
   - Card 5: ملخص مالي (dark gradient bottom)

### جدول الطلبيات
- عمود **رقم الطلبية**: يحتوي أسفله كود التتبع + زر مزامنة صغير
- عمود **المدينة** مستقل: يظهر اسم المدينة واسم المنطقة (sub-region) أسفله إن وُجد
- أعمدة **التاريخ / التوصيل / الحالة** موجودة دائماً

### Progressive Disclosure في الحقول
- هاتف احتياطي: زر صغير بجانب الهاتف → slide-in animation
- إعدادات فانكس: `<details>` accordion — مخفية حتى تُختار شركة فانكس
- الدفع المسبق: checkbox → يكشف input المبلغ

### التوصيل — نوع التوصيل
- ليس `<select>` بل 3 أزرار Toggle جنباً لجنب (Segmented Control)
- [🏍 شركة توصيل] [🚶 استلام شخصي] [🛵 توصيل داخلي]

---

## § 9 — معايير FinTech

- الإيرادات: `text-emerald-400` مع +
- المصروفات: `text-red-400` مع -
- الأرصدة: `text-[#F0F4FF]` (محايد — لا لون)
- `formatCurrency()` دائماً → "1,500 د.ل" مع `Math.round()`
- Quick Actions: [25%] [50%] [الكل] في نوافذ المال
- صافي الراتب: Read-only محسوب آلياً من الـ Store
- **الإجمالي الصافي** في SlideOver الطلبية:
  `bg-gradient-to-r from-emerald-400 to-cyan-300 bg-clip-text text-transparent text-2xl font-black`

---

## § 10 — المكونات المحرمة والبدائل

| محرم ❌ | البديل ✅ |
|----------|-----------|
| `<select>` بدون styled | Custom styled select + chevron icon |
| Plain checkbox في الخيارات | Toggle Card (border يتغير عند التحديد) |
| Progress Bar للبيانات | Recharts/sparklines |
| CSS مخصص خارج Tailwind | Tailwind فقط |
| Light/White backgrounds | Dark surfaces فقط (`#0F1035`, `#161A45`) |
| قائمة منتجات ظاهرة دائماً | Collapsed بزر Toggle |
| صفحات تأكيد منفصلة | Confirm Dialog في نفس الصفحة |
| Toast messages طويلة | Toast أقل من 60 حرف |
| أكثر من 3 CTAs في نفس الـ view | أزرار ثانوية في Kebab Menu |

---

## § 11 — Micro-animations (المعيار)

```css
/* Transition عالمي */
transition-all duration-200 cubic-bezier(0.4, 0, 0.2, 1)

/* Slide-down للعروض الديناميكية */
@keyframes slideDown {
  from { opacity: 0; transform: translateY(-8px); }
  to   { opacity: 1; transform: translateY(0); }
}

/* Spin للـ Loading */
animate-spin  /* border-white/30 border-t-white دائماً */

/* Pulse للـ indicators */
animate-pulse  /* على نقاط الحالة الحية فقط */

/* Hover Scale للـ CTAs الرئيسية فقط */
hover:scale-[1.02]
```

---

## § 12 — Scrollbar المخصص

```css
/* في globals.css */
* {
  scrollbar-width: thin;
  scrollbar-color: rgba(109, 40, 217, 0.4) transparent;
}
::-webkit-scrollbar { width: 4px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: rgba(109, 40, 217, 0.4); border-radius: 2px; }
```

---

## § 13 — Smart City Autocomplete

- حقل نصي عادي مع `onFocus`/`onBlur` + قائمة مقترحات ديناميكية
- الفلترة: من `shippingCityMappings` النشطة فقط (`is_active: true`)
- عند الاختيار: يُعبّأ `vanexCityId` تلقائياً ويُجلب `vanexSubCities`
- عند تغيير المدينة → `vanexSubCityId = undefined`
- مدينة موقوفة: تحذير `text-red-400 bg-red-900/20 rounded-lg px-2 py-1`

---

## § 14 — API Components

### API Action Button
```tsx
<button
  disabled={isLoading}
  className={`... ${isLoading ? 'opacity-50 cursor-not-allowed' : 'hover:scale-[1.02]'}`}
>
  {isLoading 
    ? <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" /> 
    : <Icon size={14} />}
  {isLoading ? 'جارٍ التنفيذ...' : 'الإجراء'}
</button>
```

### Tracker Sync Button (صغير — داخل جدول)
```tsx
<button onClick={handleTrack} disabled={isTracking} className="text-[#555B80] hover:text-violet-400 transition ml-1">
  <RefreshCw size={10} className={isTracking ? 'animate-spin' : ''} />
</button>
```
