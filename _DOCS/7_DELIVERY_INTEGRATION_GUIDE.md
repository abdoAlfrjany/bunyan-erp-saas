# _DOCS/7_DELIVERY_INTEGRATION_GUIDE.md — الدليل التقني الشامل لدمج شركات التوصيل

> **الإصدار:** 2.0 | **تاريخ التحديث:** مارس 2026  
> **يغطي هذا الدليل:** Adapter Pattern + Branding + Webhooks + استراتيجية الأخطاء

---

## ⚠️ القوانين الصارمة (يُمنع تجاوزها)

```
❌ ممنوع كتابة كود API أي شركة توصيل خارج ملف الـ Adapter الخاص بها
❌ ممنوع استدعاء fetch() لشركات التوصيل من store.ts أو أي page مباشرة
❌ ممنوع إضافة شركة جديدة بدون ملف [CompanyName]Adapter.ts يُطبق IDeliveryProvider
❌ ممنوع تمرير token بدون تنظيفه: token.replace(/^["']|["']$/g, '').trim()
❌ ممنوع تغيير Order.status إلى with_courier يدوياً — الحالة الصحيحة ready_to_ship أولاً
```

---

## 🏗️ 1. البنية المعمارية لطبقة التوصيل

```
src/core/delivery/
├── IDeliveryProvider.ts    ← نقطة تصدير الواجهات (re-export من types)
├── index.ts                ← Factory Function: getDeliveryAdapter(provider)
├── VanexAdapter.ts         ← Production Provider (VanEx API v1)
├── MockShippingAdapter.ts  ← Development/Testing Provider
└── [NewProvider]Adapter.ts ← أضف هنا فقط
```

**مبدأ Factory:**
```typescript
// src/core/delivery/index.ts
export function getDeliveryAdapter(provider: 'vanex' | 'mock' | 'none'): IDeliveryProvider {
  switch (provider) {
    case 'vanex': return new VanexAdapter();
    case 'mock':  return new MockShippingAdapter();
    default:      return new MockShippingAdapter();
  }
}
```

---

## 📋 2. واجهة المزود الموحدة (IDeliveryProvider)

كل مزود يجب أن يُطبق الواجهة التالية المعرفة في `src/core/types/index.ts`:

```typescript
interface IDeliveryProvider {
  readonly providerName: string;

  // ═══ المصادقة ═══
  setCredentials(email: string, passwordHash: string): void;
  authenticate(credentials: { email: string; password: string }): Promise<{
    success: boolean; token?: string; error?: string;
  }>;
  validateToken(token: string): Promise<boolean>;

  // ═══ الجغرافيا ═══
  getCities(token?: string): Promise<VanexCity[]>;
  getSubCities(cityId: number, token: string): Promise<VanexSubCity[]>;

  // ═══ عمليات الشحن ═══
  createShipment(payload: ICreateShipmentPayload, token: string): Promise<ICreateShipmentResult>;
  getShipmentStatus(trackingCode: string): Promise<IShipmentStatusResult>;
  cancelShipment(id: number, token: string): Promise<{ success: boolean; error?: string }>;

  // ═══ اختياري (للمزودين المتقدمين) ═══
  calculateDeliveryPrice?(fromRegion: number, toCityId: number): Promise<{ total: number; deliveryTime: string } | null>;
  getSettlements?(token: string, status?: string): Promise<VanexSettlement[]>;
  recallShipment?(id: number, token: string, reason?: string): Promise<{ success: boolean; error?: string }>;
}
```

---

## 🔌 3. خطوات إضافة مزود توصيل جديد

### الخطوة 1 — إنشاء ملف الـ Adapter

```
src/core/delivery/PrestoAdapter.ts  ← مثال
```

```typescript
// src/core/delivery/PrestoAdapter.ts
import type { IDeliveryProvider, ICreateShipmentPayload, ICreateShipmentResult, IShipmentStatusResult } from '../types';

const BASE_URL = process.env.NEXT_PUBLIC_PRESTO_URL || 'https://api.presto.ly/v1';

// نقشة تحويل حالات المزود → حالات بنيان
const PRESTO_TO_BUNYAN_STATUS: Record<string, string> = {
  'pending':   'pending',
  'delivered': 'delivered',
  'returned':  'return_confirmed',
  'cancelled': 'cancelled',
};

export class PrestoAdapter implements IDeliveryProvider {
  readonly providerName = 'presto';
  private credentials?: { email: string; passwordHash: string };
  private lastToken?: string;

  setCredentials(email: string, passwordHash: string) {
    this.credentials = { email, passwordHash };
  }

  // ← مهم: استخدم نفس نمط request() الموجود في VanexAdapter
  // يجب أن يتضمن: Root Token Sanitization + 401 Auto-Retry
  private async request<T>(endpoint: string, options: RequestInit = {}, token?: string, isRetry = false) {
    const rawToken = token || this.lastToken;
    const activeToken = rawToken ? rawToken.replace(/^["']|["']$/g, '').trim() : null;
    // ... نفس منطق VanexAdapter.request()
  }

  async authenticate(credentials: { email: string; password: string }) {
    // POST /auth/login أو ما يعادله لدى Presto
    // يجب إرجاع { success: true, token: '...' }
  }

  // ... تطبيق باقي الدوال
}

export const prestoAdapter = new PrestoAdapter();
```

### الخطوة 2 — تسجيل المزود في Factory

```typescript
// src/core/delivery/index.ts — أضف السطرين التاليين
export { PrestoAdapter, prestoAdapter } from './PrestoAdapter';

export function getDeliveryAdapter(provider: 'vanex' | 'presto' | 'mock' | 'none'): IDeliveryProvider {
  switch (provider) {
    case 'vanex':  return new VanexAdapter();
    case 'presto': return new PrestoAdapter();   // ← أضف هنا
    case 'mock':   return new MockShippingAdapter();
    default:       return new MockShippingAdapter();
  }
}
```

### الخطوة 3 — إضافة `provider` للنوع الموحد

```typescript
// src/core/types/index.ts — وسّع الـ Union Type
provider: 'vanex' | 'presto' | 'zajil' | 'mock' | 'none';
```

### الخطوة 4 — إضافة شعار المزود

```
public/logos/presto.png   ← PNG بخلفية شفافة، أبعاد 1:1 أو 4:3
```

لا حاجة لتعديل كود إضافي — مكون `<Logo providerName="presto" />` يجلب الصورة تلقائياً من `/logos/presto.png` مع Fallback نصي.

### الخطوة 5 — ربط المدن الجغرافية

1. من لوحة Super Admin، اذهب إلى **City Mappings**.
2. اختر المزود الجديد من قائمة المزودين.
3. اضغط "جلب المدن الآن" لاستدعاء `getCities()`.
4. استخدم "المطابقة الذكية" أو يدوياً لربط مدن المزود ببنيان.

---

## 🔐 4. معايير الأمان والأخطاء

### تنظيف التوكين (Root Sanitization) — إلزامي
```typescript
const activeToken = rawToken ? rawToken.replace(/^["']|["']$/g, '').trim() : null;
```

### Auto-Retry 401 — إلزامي
```typescript
if (res.status === 401 && !isRetry && this.credentials) {
  const reauth = await this.authenticate({ ... });
  if (reauth.success && reauth.token) {
    this.lastToken = reauth.token;
    return this.request(endpoint, options, reauth.token, true); // isRetry = true
  }
  return { success: false, error: 'انتهت الجلسة وفشل التجديد التلقائي' };
}
```

### تطبيع الأخطاء — معيار موحد
```typescript
// ✅ صحيح — خطأ واضح قابل للعرض في UI
return { success: false, error: 'فشل الاتصال: قد لا يملك الحساب صلاحية هذه المدينة' };

// ❌ خاطئ — لا ترجع رسالة خطأ تقنية مباشرة للـ UI
return { success: false, error: err.stack };
```

---

## 🔔 5. استراتيجية Webhooks (للتطوير المستقبلي)

عند إضافة webhook support، أنشئ:

```
src/app/api/webhooks/[provider]/route.ts
```

```typescript
// مثال: src/app/api/webhooks/vanex/route.ts
export async function POST(req: Request) {
  const payload = await req.json();
  // 1. التحقق من توقيع الـ Webhook (HMAC أو secret header)
  // 2. تطبيع الحالة: VANEX_TO_BUNYAN_STATUS[payload.status]
  // 3. تحديث shipment_status_history في Supabase
  // 4. إرجاع 200 فوراً لضمان استلام VanEx للتأكيد
  return new Response('ok', { status: 200 });
}
```

**قواعد Webhooks:**
- يجب الرد بـ `200 OK` خلال 5 ثواني
- معالجة الأحداث بشكل Idempotent (نفس الحدث مرتين = نفس النتيجة)
- تخزين كل incoming payload في `webhook_logs` قبل المعالجة

---

## 📡 6. التتبع والمزامنة (Tracking & Synchronization)

عند تتبع شحنة (عبر `getShipmentStatus`):
1. **استخدام المسار الموثوق:** يُفضل استخدام مسارات `customer` (مثل `/customer/package/{code}`) مع تمرير الـ token بدلاً من المسارات العامة لأنها تُرجع بيانات أكثر دقة وموثوقية عن الشحنة.
2. **تنظيف كود التتبع:** بعض الـ APIs قد تُولّد أكواد بلاحقات أو سوابق إضافية غير مقبولة عند الاستعلام مرة أخرى (مثل إضافة `STOREID-` للكود). يجب تنظيف `trackingCode` أولاً بالـ Regex.
3. **قراءة الحالة الصحيحة (Status Object):** الرد قد يكون معقداً ولا يحوي `status` بصورة مباشرة على الـ root. دائماً ابحث عن الأوبجكت الداخلي، مثلاً: `result.data.status_object?.status_value` أو `result.data.package?.status`.
4. **تطبيع الحالات (Normalization):** تأكد من إضافة حالات التوصيل والإنهاء غير المعروفة مسبقاً (مثل `complete` أو `store_canceled`) إلى خريطة التحويل الخاصة بالـ Adapter ليتم تحويلها إلى حالات متوافقة مع `Bunyan ERP` (`delivered`، `cancelled`).

---

## 🎨 7. الجانب البصري (Branding Guide)

### مسار الشعارات
```
public/logos/[providerName].png   ← الاسم يطابق قيمة providerName
```

**أمثلة:**
- `public/logos/bunyan.png` — شعار بنيان الرئيسي
- `public/logos/vanex.png` — شعار VanEx
- `public/logos/presto.png` — شعار Presto (عند الإضافة)

### استخدام مكون `<Logo />`
```tsx
import { Logo } from '@/shared/components/ui/Logo';

<Logo providerName="vanex" size="md" variant="dark" />
// size: 'sm' | 'md' | 'lg'
// variant: 'dark' | 'light'
// Fallback تلقائي: حرف أول من الاسم في حاوية منمقة
```

### قواعد الشعار الإلزامية
- الصيغة: `PNG` بخلفية شفافة
- الأبعاد: نسبة 1:1 أو 4:3 (مربع أو قريب منه)
- ممنوع: استيراد الصورة بـ `import` من `src/` — يجب أن تُحمل من المسار العام `/logos/`

---

## ✅ 8. قائمة التحقق قبل اعتماد مزود جديد

```
[ ] إنشاء [Name]Adapter.ts  يُطبق IDeliveryProvider كاملاً
[ ] Root Token Sanitization موجود في request()
[ ] 401 Auto-Retry منفذ
[ ] تسجيل المزود في getDeliveryAdapter() في index.ts
[ ] توسيع Union Type لـ provider في types/index.ts
[ ] إضافة الشعار في public/logos/[name].png
[ ] اختبار getCities() وإرجاع بيانات صحيحة
[ ] اختبار createShipment() في بيئة Sandbox
[ ] ربط المدن عبر City Mappings في Super Admin
[ ] التحقق من City Validation في handleCreateOrder
[ ] التوثيق: تحديث 5_MODULES_MAP.md و1_SYSTEM_RULES.md
```

**نهاية الدليل**
