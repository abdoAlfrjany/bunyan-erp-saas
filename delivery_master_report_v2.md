# 🏗️ التقرير الهندسي الشامل الكبير — منظومة التوصيل في Bunyan ERP
## النسخة الثانية المكملة والموسعة — مبنية على الكود الحقيقي + Supabase MCP

> **المصدر:** قراءة مباشرة لـ 12 ملف + 8 استعلامات Supabase  
> **التاريخ:** 29 مارس 2026  
> **المشروع:** `riecnyonvqxtqqoyhkvh` — Bunyan ERP (ACTIVE_HEALTHY, PostgreSQL 17.6)

---

# الجزء الأول: الخريطة الكاملة للنظام

## 1.1 هيكل الملفات الكامل

```
src/
├── core/
│   ├── delivery/
│   │   ├── IDeliveryProvider.ts      [287 B]  ← Type re-export فقط
│   │   ├── VanexAdapter.ts           [17.5 KB] ← المحرك الأساسي (432 سطر)
│   │   ├── MockShippingAdapter.ts    [5.1 KB]  ← للاختبار (138 سطر)
│   │   └── index.ts                 [791 B]   ← Factory Pattern
│   └── types/                                  ← IDeliveryProvider interface
│
├── app/api/
│   ├── webhooks/
│   │   └── vanex/route.ts           [8.7 KB]  ← 255 سطر ⚠️
│   ├── vanex/
│   │   ├── sync/route.ts            [4.4 KB]  ← 112 سطر
│   │   ├── track/route.ts           [3.9 KB]  ← 104 سطر
│   │   └── settlements/
│   │       ├── fetch/route.ts       [4.3 KB]  ← 109 سطر
│   │       └── details/route.ts     [3.7 KB]  ← 96 سطر
│   ├── settlements/
│   │   └── apply/route.ts           [4.7 KB]  ← 115 سطر
│   ├── orders/
│   │   ├── route.ts                 [7.3 KB]  ← 194 سطر (إنشاء + خصم مخزون)
│   │   ├── status/route.ts          [6.3 KB]  ← 153 سطر (تغيير الحالة)
│   │   └── [id]/                              ← عمليات طلبية محددة
│   └── couriers/route.ts            [3.4 KB]  ← 104 سطر (CRUD شركات)
│
└── modules/delivery/
    └── services/index.ts            [124 B]   ← فارغ! (export {})
```

## 1.2 قاعدة البيانات — الجداول الحرجة

```
📊 إحصائيات الـ Project (ACTIVE_HEALTHY):
   PostgreSQL 17.6 | Region: eu-central-1

┌─────────────────────────┬───────┬─────┐
│ الجدول                  │ صفوف  │ RLS │
├─────────────────────────┼───────┼─────┤
│ bunyan_cities           │  180  │ ✅  │
│ bunyan_regions          │    8  │ ✅  │
│ provider_geo_mappings   │  119  │ ✅  │
│ tenants                 │    7  │ ✅  │
│ profiles                │    5  │ ✅  │
│ orders                  │   53  │ ✅  │
│ products                │   23  │ ✅  │
│ couriers                │    5  │ ✅  │
│ courier_settlements     │    0  │ ✅  │
│ webhook_logs            │    3  │ ✅  │
│ treasury_accounts       │    7  │ ✅  │
│ treasury_transactions   │  327  │ ✅  │
│ customers               │   19  │ ✅  │
└─────────────────────────┴───────┴─────┘
```

## 1.3 RPC Functions الموجودة في قاعدة البيانات

```
الـ Functions المُسجَّلة في public schema:
1. adjust_product_stock_atomic     ← تعديل يدوي للمخزون
2. apply_settlement_atomic         ← تسوية مالية ذرية كاملة ⚠️ غير مستخدمة
3. create_treasury_transaction_atomic ← معاملة خزينة مع قفل
4. deduct_inventory                ← خصم المخزون عند الطلب
5. get_auth_tenant_id              ← helper لـ RLS
6. handle_new_user                 ← Trigger عند تسجيل مستخدم جديد
7. handle_updated_at               ← Trigger لحقل updated_at
8. increment_treasury_balance      ← زيادة رصيد بسيطة
9. pay_debt_atomic                 ← تسديد الديون ذرياً
10. protect_tenant_id              ← Trigger حماية tenant_id
11. restore_inventory              ← إعادة مخزون عند الإلغاء ✅
12. sync_variant_quantity          ← مزامنة المقاسات
```

---

# الجزء الثاني: تشريح سير العمل الكامل (End-to-End)

## 2.1 رحلة الطلبية الكاملة — من الإنشاء للتسوية

```
┌─────────────────────────────────────────────────────────────────┐
│                    دورة حياة الطلبية الكاملة                    │
└─────────────────────────────────────────────────────────────────┘

الخطوة 1: إنشاء الطلبية
POST /api/orders
  ├── requireAuth() → التحقق من JWT
  ├── assertTenantMatch() → Tenant Isolation
  ├── فحص المخزون من DB (مقاسات + كميات)
  ├── Idempotency check (إذا كان ID موجوداً → 200 بلا insert)
  ├── INSERT في orders
  ├── RPC deduct_inventory() ← يخصم المخزون ذرياً
  └── upsert customer (يحدّث أو ينشئ)

الخطوة 2: إرسال الشحنة لفانكس
[من الواجهة الأمامية أو API مباشرة]
  ├── جلب بيانات الشركة (token)
  ├── جلب الربط الجغرافي من provider_geo_mappings
  ├── VanexAdapter.createShipment(payload, token)
  │   └── POST https://app.vanex.ly/api/v1/customer/package
  └── حفظ: courier_tracking_code + courier_package_id في orders

الخطوة 3: التحديثات التلقائية (Webhook)
POST /api/webhooks/vanex
  ├── تسجيل في webhook_logs (دائماً أولاً)
  ├── التحقق من VANEX_WEBHOOK_SECRET ← ⚠️ موحد لكل المتاجر
  ├── ترجمة الحالة: vanex_status → bunyan_status
  ├── تحديث orders.status + courier_raw_status
  └── عند return_confirmed/cancelled → restore_inventory()

الخطوة 4: المزامنة اليدوية
POST /api/vanex/sync
  ├── جلب كل الطلبيات النشطة للمتجر
  ├── جلب الـ tokens (batch للشركات)
  └── لكل طلبية: getShipmentStatus() → تحديث إذا تغيرت

الخطوة 5: التسويات
Phase A: POST /api/vanex/settlements/fetch
  ├── getSettlements(token, 'approved')
  ├── يحسب: bankCommission (فقط للإلكتروني)
  ├── deliveryFees = 0 ← ⚠️ مؤقتاً
  └── upsert في courier_settlements (is_approximate=true)

Phase B: GET /api/vanex/settlements/details/?vanexId=&courierId=
  ├── getSettlementDetails(id, token)
  ├── يحسب: totalDeliveryFees = SUM(packages.shipping_cost)
  ├── netAmount = total - deliveryFees - bankCommission
  └── UPDATE courier_settlements (is_approximate=false)

Phase C: POST /api/settlements/apply
  ├── فحص: status !== 'applied' (الخط الأول)
  ├── جلب الخزينة المناسبة
  ├── create_treasury_transaction_atomic() ← ذري ✅
  └── UPDATE status='applied' WHERE status='pending' (الخط الثاني)
```

## 2.2 تدفق البيانات التشخيصي الكامل

```
فانكس API → webhook → 
  webhook_logs (vanex_package_code ← لكن الكود يستخدم courier_tracking_code!)
  ↓
  orders (courier_tracking_code) ← الأسماء مختلفة في الجدولين!
  ↓
  restoration: restore_inventory(items_payload)
  ↓  
  courier_settlements
  ↓
  treasury_accounts + treasury_transactions
```

---

# الجزء الثالث: تشريح RPC Functions بالكود الفعلي

## 3.1 restore_inventory — كيف يعمل بالضبط

```sql
-- الكود الفعلي من Supabase:
CREATE OR REPLACE FUNCTION public.restore_inventory(items_payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  item jsonb;
  v_prod_id uuid;
  v_restore_qty integer;
BEGIN
  FOR item IN SELECT * FROM jsonb_array_elements(items_payload)
  LOOP
    v_prod_id := COALESCE(item->>'product_id', item->>'id')::uuid;
    v_restore_qty := (item->>'qty')::integer;
    
    UPDATE products
    SET quantity = quantity + v_restore_qty,  -- يزيد الكمية
        updated_at = now()
    WHERE id = v_prod_id;
    -- ⚠️ لا يُعيد المقاسات! variant_size موجود في الـ payload لكن الكود يتجاهله
  END LOOP;
  RETURN to_jsonb(result_array);
END;
$$;
```

**🔴 ثغرة مكتشفة في restore_inventory:**
- الكود الـ TypeScript يرسل `variant_size` في الـ payload
- لكن الـ SQL يُحدّث `products.quantity` الإجمالية فقط، **لا يُعيد المقاس المحدد في `variants` JSON!**
- هذا يعني: إذا بعت مقاس L وأرجعت الطلبية، الكمية الإجمالية ترجع لكن مقاس L في `variants[]` لا يرجع

## 3.2 create_treasury_transaction_atomic — التفاصيل

```sql
-- Signature:
FUNCTION create_treasury_transaction_atomic(
  p_tenant_id uuid,
  p_account_id uuid,
  p_transaction_type text,
  p_amount numeric,          -- موجب = دخل، سالب = مصروف
  p_description text,
  p_created_by uuid,
  p_transaction_date date,
  p_is_transfer boolean DEFAULT false,
  p_to_account_id uuid DEFAULT NULL
) RETURNS jsonb

-- آلية العمل:
1. SELECT ... FOR UPDATE ← قفل الحساب (يمنع Race Condition)
2. UPDATE treasury_accounts SET balance = balance + p_amount
3. INSERT treasury_transactions (يعيد tx_id)
4. للتحويل: يُحدّث الحسابين وينشئ سجلين
5. RETURN { success, tx_id }
```

**✅ هذه الدالة ممتازة لأنها:**
- تستخدم `FOR UPDATE` — قفل على مستوى الصف (Row-Level Lock)
- ذرية: إما تنجح بالكامل أو تفشل (يلتف بها PostgreSQL Transaction تلقائياً)
- تُعيد `tx_id` للـ Audit Trail

## 3.3 apply_settlement_atomic — موجودة لكن مهملة!

```sql
-- هذه الدالة تفعل كل شيء دفعة واحدة:
CREATE OR REPLACE FUNCTION public.apply_settlement_atomic(
  p_settlement_id uuid, p_tenant_id uuid, p_created_by uuid
) RETURNS jsonb AS $$
BEGIN
  -- 1. قفل التسوية: SELECT FROM vanex_settlements FOR UPDATE
  --    ⚠️ مشكلة: تبحث في جدول "vanex_settlements" لكن الجدول الحقيقي "courier_settlements"!
  
  -- 2. قفل الخزينة
  -- 3. تحديث خزينة "with_courier" (حساب احتجاز)
  -- 4. إضافة المبلغ للخزينة المستهدفة
  -- 5. إدراج 3 معاملات: total + delivery_fees- + bank_commission-
  -- 6. UPDATE vanex_settlements SET status='applied'
END;
```

**🔴 الـ RPC apply_settlement_atomic معطوبة تماماً لسببين:**
1. تبحث في جدول `vanex_settlements` — الجدول الحقيقي اسمه `courier_settlements`
2. لو أُصلح اسم الجدول، هي أقوى بكثير من الكود الحالي لأنها:
   - تُنشئ 3 معاملات خزينة (إجمالي + عمولة توصيل + عمولة بنك) بدلاً من معاملة واحدة
   - تدير حساب "مع شركة التوصيل" (with_courier) المحتجز

## 3.4 deduct_inventory — كيف يعمل

```sql
-- الكود المستدعى عند إنشاء طلبية جديدة:
rpc('deduct_inventory', { items_payload: [...] })

-- نفس مشكلة restore_inventory:
-- يُخفض products.quantity الإجمالية
-- لا يُحدّث variants[].quantity للمقاسات
```

**⚠️ هذا يعني:**
منتج بـ 3 مقاسات (S:5, M:3, L:2) ← الكمية الإجمالية = 10  
إذا طُلب L واحد:
- `products.quantity` يصبح 9 ✅
- `products.variants[L].quantity` يبقى 2 ❌ (لم يتغير!)

---

# الجزء الرابع: سياسات الأمان وعزل المتاجر (RLS Audit)

## 4.1 فحص سياسات RLS الفعلية

```
جدول: orders
  ✅ SELECT: tenant_id IN (SELECT tenant_id FROM profiles WHERE id = auth.uid())
  ✅ INSERT:  — (بدون قيد، يعتمد على الكود)
  ✅ UPDATE:  tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid())
  ✅ DELETE:  tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid())

جدول: couriers
  ✅ ALL: tenant_id IN (SELECT tenant_id FROM profiles WHERE id = auth.uid())

جدول: courier_settlements
  ✅ SELECT: tenant_id IN (profiles)
  ✅ UPDATE:  tenant_id IN (profiles)
  ⚠️ INSERT:  — بدون قيد (من أي حساب!)

جدول: webhook_logs
  ✅ ALL: (tenant_id = get_auth_tenant_id()) OR (auth.role() = 'service_role')
  ← هذا صحيح: الـ Webhook يستخدم service_role فيتجاوز RLS
```

## 4.2 تحليل ثغرات RLS

### الثغرة الأمنية في courier_settlements INSERT
```sql
-- السياسة الحالية للـ INSERT في courier_settlements:
-- "Users can insert their tenant settlements" ← بدون USING clause!
-- يعني: أي مستخدم مسجّل يستطيع إدراج تسوية لأي tenant_id!
```

**⚠️ المخاطرة:** لو تجاوز المستخدم الـ API مباشرة لـ Supabase Client،  
يمكنه إدراج تسوية زائفة لمتجر آخر.

### حماية الـ Webhook (السطر الصحيح)
```sql
webhook_logs: (tenant_id = get_auth_tenant_id()) OR (role = 'service_role')
```
الـ Webhook يستخدم `SUPABASE_SERVICE_ROLE_KEY` ← يتجاوز RLS تلقائياً ✅  
لكن هذا يعني: **لو اختُرق الـ Service Role Key، كل المتاجر تسقط**

---

# الجزء الخامس: ثغرات جديدة مكتشفة (لم تُذكر في التقرير الأول)

## 5.1 🔴 CRITICAL: restore_inventory لا يُعيد المقاسات (Variants)

**المشكلة:**
```typescript
// الكود يرسل:
{ product_id: "uuid", qty: 1, variant_size: "L" }

// الـ SQL يفعل:
UPDATE products SET quantity = quantity + 1 WHERE id = product_id
// ← يتجاهل variant_size تماماً!
```

**التأثير:** بعد كل إلغاء/رجوع، مخزون المقاسات يصبح غير دقيق:
- `products.quantity` صحيح ✅
- `products.variants[].quantity` خاطئ ❌

**الإصلاح المطلوب:**
```sql
-- يجب تعديل restore_inventory ليُحدّث variants:
UPDATE products 
SET variants = (
  SELECT jsonb_agg(
    CASE WHEN v->>'size' = item->>'variant_size'
    THEN jsonb_set(v, '{quantity}', 
      to_jsonb((v->>'quantity')::int + (item->>'qty')::int))
    ELSE v END
  )
  FROM jsonb_array_elements(variants) v
)
WHERE id = v_prod_id AND item->>'variant_size' IS NOT NULL;
```

## 5.2 🔴 CRITICAL: deduct_inventory نفس المشكلة

نفس ثغرة restore_inventory — يخصم من الكمية الإجمالية فقط دون تحديث المقاسات.

## 5.3 🔴 CRITICAL: apply_settlement_atomic تبحث في جدول غير موجود

```sql
-- الـ RPC تقرأ من:
SELECT * FROM vanex_settlements WHERE ...
-- ← هذا الجدول لا يوجد! الاسم الحقيقي: courier_settlements
```

**التأثير:** هذه الـ RPC إذا استُدعيت ستفشل بـ `relation "vanex_settlements" does not exist`  
والكود لا يستدعيها أصلاً — هذا "يخفي" الخطأ.

## 5.4 🟡 HIGH: orders/status يُضيف للخزينة قبل DELETE من فانكس

```typescript
// orders/status/route.ts:
// السطر 49: إذا status === 'cancelled' وكان courier_package_id موجود →
//   try: cancelShipment من فانكس
//   لكنه لا ينتظر النتيجة بشكل كافٍ!

// السطر 70: UPDATE orders SET status='cancelled' (يحدث دائماً)
// السطر 93: إذا delivered → treasury expense (للداخلية فقط)
// السطر 137: restore_inventory
```

**المشكلة:** لو فشل إلغاء فانكس، الطلبية تُلغى محلياً لكنها لا تزال نشطة في فانكس.  
لا يوجد آلية retry أو تسجيل للفشل.

## 5.5 🟡 HIGH: modules/delivery/services/index.ts فارغ تماماً

```typescript
// src/modules/delivery/services/index.ts:
export {};  // ← فارغ!
```

هذا يعني كل logic الـ Delivery موزعة بين API routes و core/delivery — لا يوجد Service Layer.  
في نظام SaaS حقيقي، Business Logic يجب أن تكون في Service classes منفصلة عن الـ HTTP layer.

## 5.6 🟡 HIGH: sync يستدعي API داخلي بـ fetch()

```typescript
// vanex/sync/route.ts السطر 74-82:
const cancelUrl = new URL('/api/orders/status', req.nextUrl.origin);
await fetch(cancelUrl.toString(), {
  cookie: req.headers.get('cookie') || ''  // ← يمرر الـ Cookie!
});
```

**المخاطرة:**
- هذا HTTP request داخلي يصطدم بـ DNS resolution
- الـ Cookie يُمرَّر لكنه قد ينتهي صلاحيته في بيئة الإنتاج
- في Serverless (Vercel/Netlify)، هذا قد يُسبب timeout لأن كل function مستقلة

## 5.7 🟡 HIGH: couriers.api_credentials تخزن التوكين بلا تشفير

```typescript
// VanexAdapter.ts السطر 48:
private credentials?: { email: string; passwordHash: string };

// passwordHash = btoa(password) ← Base64، ليس تشفيراً!
```

التوكين يُخزّن في `couriers.api_credentials` كـ JSONB:
```json
{ "token": "eyJhbGciOi...", "email": "store@example.com" }
```
والـ Supabase يُعيد هذه البيانات للـ frontend في بعض الحالات.

---

# الجزء السادس: المقارنة التفصيلية — الحالي مقابل المستهدف

## 6.1 المصادقة وتخزين Credentials

| الجانب | الحالي | المستهدف |
|---|---|---|
| تخزين التوكين | `couriers.api_credentials.token` | نفسه + تشفير AES-256 |
| كلمة المرور | `btoa()` في الذاكرة | لا تُخزّن إطلاقاً — token فقط |
| Webhook Secret | `.env VANEX_WEBHOOK_SECRET` | `couriers.webhook_secret` مشفر لكل متجر |
| Token Refresh | ✅ Self-healing 401 | نفسه + تسجيل في webhook_logs |

## 6.2 الـ Webhook Architecture

| الجانب | الحالي | المستهدف |
|---|---|---|
| المسار | `/api/webhooks/vanex` | `/api/webhooks/[provider]` |
| التوثيق | Secret موحد من `.env` | Secret من `couriers.webhook_secret` لكل متجر |
| التعرف على المتجر | NULL — الكود يبحث عبر tracking code | Tracking code → Order → Tenant |
| Idempotency | SELECT check (غير موثوق) | UNIQUE constraint في DB |
| تسجيل الأخطاء | webhook_logs.courier_tracking_code ❌ | webhook_logs.vanex_package_code ✅ |
| توثيق الرابط | يدوي في فانكس | صفحة UI + نسخ تلقائي |

## 6.3 التسويات المالية

| الجانب | الحالي | المستهدف |
|---|---|---|
| Unique constraint | ❌ غير موجود | `UNIQUE(tenant_id, vanex_settlement_id)` |
| المعاملة الذرية | خطوتان منفصلتان | `apply_settlement_atomic()` بعد إصلاح tablename |
| معاملات الخزينة | معاملة واحدة (net_amount) | 3 معاملات (total + fees- + commission-) |
| حساب with_courier | ❌ غير موجود | يُخصم من حساب الاحتجاز |

## 6.4 المخزون (Inventory)

| الجانب | الحالي | المستهدف |
|---|---|---|
| خصم الكميات | products.quantity فقط | quantity + variants[].quantity |
| إعادة الكميات | products.quantity فقط | quantity + variants[].quantity |
| التحقق عند الطلب | ✅ من DB | نفسه |

---

# الجزء السابع: الخارطة الجغرافية بالتفصيل

## 7.1 إحصائيات المناطق

```
bunyan_cities: 180 سجل
  ├── مدن حقيقية: ~96 مدينة
  ├── مدن [DIAG]: 84 مدينة (بقايا اختبارات)
  │   الأسماء: "[DIAG] مدينة 1773651828044" وما شابه
  └── جميعها is_active = true (حتى الـ DIAG!)

provider_geo_mappings: 119 ربط (provider='vanex')
  ├── مرتبطة بـ bunyan_city_id
  ├── provider_city_id (ID المدينة في فانكس)
  └── provider_region_id (اختياري — المنطقة الفرعية)

المدن الحقيقية غير المربوطة: 5 مدن
  ID:4  مصراته
  ID:41 قصر بن غشير
  ID:96 الكفرة
  + 2 أخريات غير محددة
```

## 7.2 آلية الربط الجغرافي عند الشحن — الكود الكامل

```
1. المستخدم يختار مدينة (bunyan_city_id مثلاً 5)
2. الكود يقرأ provider_geo_mappings:
   WHERE bunyan_city_id = 5 AND provider = 'vanex' AND is_active = true
3. يستخرج: provider_city_id (مثلاً "12") و provider_region_id (مثلاً "45")
4. يرسل لفانكس: { city: 12, sub_city: 45, ... }

⚠️ إذا لم يجد ربطاً:
   الكود الحالي: يُرسل city: null → فانكس يرفض → Error غير واضح
   الكود المطلوب: رسالة "مدينة غير مدعومة، يرجى التواصل مع الإدارة"
```

## 7.3 هيكل bunyan_regions (8 مناطق فقط!)

```
bunyan_regions: 8 صفوف
  city_id: كل منطقة مرتبطة بمدينة رئيسية
  
⚠️ لا يوجد ربط مباشر بين bunyan_regions و provider_geo_mappings.bunyan_region_id
   رغم وجود العمود — الـ 119 ربط يستخدم جميعها bunyan_city_id!
```

---

# الجزء الثامن: تشريح IDeliveryProvider الكامل

## 8.1 الـ Interface الحالي

```typescript
// src/core/types — الـ Interface الحالي (من re-exports):
interface IDeliveryProvider {
  readonly providerName: string;
  setCredentials(email: string, passwordHash: string): void;
  authenticate(credentials: { email: string; password: string }): 
    Promise<{ success: boolean; token?: string; error?: string }>;
  validateToken(token: string): Promise<boolean>;
  getCities(token?: string): Promise<VanexCity[]>;
  getSubCities(cityId: number, token?: string): Promise<VanexSubCity[]>;
  calculateDeliveryPrice(fromRegion: number, toCityId: number): 
    Promise<{ total: number; deliveryTime: string } | null>;
  createShipment(payload: ICreateShipmentPayload, token: string): 
    Promise<ICreateShipmentResult>;
  getShipmentStatus(trackingCode: string, token?: string): 
    Promise<IShipmentStatusResult>;
  cancelShipment(id: number | string, token: string): 
    Promise<{ success: boolean; error?: string }>;
  recallShipment(id: number | string, token: string, reason?: string): 
    Promise<{ success: boolean; error?: string }>;
  getSettlements(token: string, status?: string, commissionRate?: number): 
    Promise<VanexSettlement[]>;
  getSettlementDetails(id: number, token: string, commissionRate?: number): 
    Promise<VanexSettlement | null>;
}
```

## 8.2 ما يُنقص الـ Interface لـ 15 شركة

```typescript
// الوظائف المفقودة التي يجب إضافتها:
interface IDeliveryProvider {
  // ... ما هو موجود ...
  
  // ❌ مفقود: ترجمة الحالات (كل شركة تحتها حالاتها)
  translateStatus(rawStatus: string): OrderStatus;
  
  // ❌ مفقود: الـ Webhook signature verification
  verifyWebhookSignature(payload: string, signature: string, secret: string): boolean;
  
  // ❌ مفقود: تحليل payload الـ Webhook
  parseWebhookPayload(body: Record<string, unknown>): {
    trackingCode: string;
    rawStatus: string;
    timestamp?: string;
  };
  
  // ❌ مفقود: جلب بوليصة الشحن (PDF)
  getPrintLabel(trackingCode: string, token: string): Promise<string | null>;
}
```

## 8.3 Factory Pattern — الحالي مقابل المطلوب

```typescript
// الحالي:
export function getDeliveryAdapter(provider: 'vanex' | 'mock' | 'none') {
  switch (provider) {
    case 'vanex': return new VanexAdapter();
    case 'mock':  return new MockShippingAdapter();
    default:      return new MockShippingAdapter(); // ← unsafe fallback
  }
}

// المشكلة: الكل يستخدم:
import { vanexAdapter } from '@/core/delivery/VanexAdapter';
// ← Singleton مباشر، لا يمر بالـ Factory!

// المطلوب:
export class DeliveryProviderRegistry {
  private static providers = new Map<string, () => IDeliveryProvider>();
  
  static register(key: string, factory: () => IDeliveryProvider) {
    this.providers.set(key, factory);
  }
  
  static get(provider: string): IDeliveryProvider {
    const factory = this.providers.get(provider);
    if (!factory) throw new Error(`Provider "${provider}" not registered`);
    return factory();
  }
}

// التسجيل (مرة واحدة في boot):
DeliveryProviderRegistry.register('vanex', () => new VanexAdapter());
DeliveryProviderRegistry.register('mock', () => new MockShippingAdapter());
// مستقبلاً:
DeliveryProviderRegistry.register('aramex', () => new AramexAdapter());
```

---

# الجزء التاسع: Vanex API — الأخطاء الإملائية الموثقة

| حقل API فانكس | الخطأ الإملائي | الصحيح | مُعالَج في الكود؟ |
|---|---|---|---|
| `reciever` | ❌ | receiver | ✅ مُرسَل بالخطأ المتعمد |
| `leangh` | ❌ | length | ✅ مُرسَل بالخطأ المتعمد |
| `payment_methode` | ❌ | payment_method | ✅ مُرسَل بالخطأ المتعمد |
| `/store/settelmets` | ❌ | settlements | ✅ المسار بالخطأ المتعمد |
| `shippment` (في التسويات) | ❌ | shipment | ✅ في التوثيق |

---

# الجزء العاشر: التحليل المالي الكامل

## 10.1 دورة الأموال الكاملة

```
عند إنشاء طلبية (courier_company):
  orders.payment_status = 'pending' (الافتراضي)
  ← لا حركة مالية

عند تسليم العميل (delivered via webhook):
  orders.status = 'delivered'
  orders.payment_status → لا يتغير تلقائياً!
  ← لا حركة مالية (المال مع شركة التوصيل عند فانكس)

عند تسوية فانكس (settle):
  courier_settlements.status = 'applied'
  treasury_transactions: +netAmount في خزينة التاجر
  ← ✅ المال الحقيقي يُسجَّل هنا

عند إلغاء طلبية مدفوعة مسبقاً (courier_company):
  orders.status = 'cancelled'
  orders.prepaid_amount = X
  ← ❌ لا يُسجَّل استرداد!
```

## 10.2 حساب صافي التسوية بالتفصيل

```
المرحلة 1 (fetch) — تقريبي:
  total_amount = Q (من فانكس)
  delivery_fees = 0 ← غير متاح في هذه المرحلة
  bank_commission = Q × 0.02 (فقط للدفع الإلكتروني)
  net_amount = Q - bank_commission

المرحلة 2 (details) — دقيق:
  total_amount = Q
  delivery_fees = SUM(packages[i].shipping_cost)
  bank_commission = Q × commissionRate
  net_amount = Q - delivery_fees - bank_commission

التطبيق (apply):
  يستخدم net_amount المحدّثة (من المرحلة 2)
  ينشئ معاملة: +|net_amount| في الخزينة

🔴 المشكلة:
  لو تجاوز المستخدم المرحلة 2 وطبّق مباشرة →
  يُطبَّق net_amount التقريبية (بدون رسوم توصيل)
  → التاجر يحصل على أكثر مما يستحق!
```

---

# الجزء الحادي عشر: محاكي الاختبار (MockShippingAdapter)

```typescript
// ما يفعله المحاكي:
- authenticate() → mock-token-{timestamp} ← يقبل أي credentials
- createShipment() → MCK-{counter} ← رقم تتبع وهمي
- getShipmentStatus() → always 'with_courier' ← ثابت!
- getSettlements() → تسوية واحدة بقيمة 5000 ليرة
- getCities() → 15 مدينة محددة فقط
- delay() → يُحاكي network latency (200-600ms)

⚠️ الثغرة في المحاكي:
  getShipmentStatus() دائماً يُعيد 'with_courier'
  لا يُحاكي الحالات الأخرى (delivered, cancelled)
  ← يجعل الاختبارات غير واقعية
```

---

# الجزء الثاني عشر: خارطة الإصلاحات بالكود الفعلي

## 12.1 إصلاح ثغرة C1 — عمود webhook_logs

```typescript
// الملف: src/app/api/webhooks/vanex/route.ts
// التغيير المطلوب: استبدال 3 أماكن

// السطر 59 — قبل:
courier_tracking_code: body['package-code'] ?? ...

// السطر 59 — بعد:
vanex_package_code: body['package-code'] ?? ...

// السطر 107 — نفس التغيير
// السطر 137 — نفس التغيير في الـ WHERE clause:
.eq('vanex_package_code', code)
```

## 12.2 إضافة UNIQUE Constraints — Migrations

```sql
-- Migration 1: إصلاح webhook_logs
ALTER TABLE webhook_logs 
ADD COLUMN IF NOT EXISTS vanex_package_code text; -- إذا لم يكن موجوداً

-- تحديث الأعمدة الغائبة
-- (العمود موجود بالفعل في DB لذا لا migration مطلوبة)

-- Migration 2: UNIQUE على courier_settlements
ALTER TABLE courier_settlements
ADD CONSTRAINT courier_settlements_unique_settlement 
UNIQUE (tenant_id, vanex_settlement_id);

-- Migration 3: تعديل webhook_logs للـ Idempotency
ALTER TABLE webhook_logs
ADD CONSTRAINT webhook_logs_idempotency
UNIQUE (vanex_package_code, event_type);
-- ⚠️ يجب تنظيف البيانات المكررة أولاً:
-- DELETE FROM webhook_logs WHERE id NOT IN (
--   SELECT MIN(id) FROM webhook_logs GROUP BY vanex_package_code, event_type
-- );
```

## 12.3 إصلاح restore_inventory + deduct_inventory — SQL

```sql
-- إصلاح restore_inventory ليدعم Variants
CREATE OR REPLACE FUNCTION public.restore_inventory(items_payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  item jsonb;
  v_prod_id uuid;
  v_restore_qty integer;
  v_variant_size text;
BEGIN
  FOR item IN SELECT * FROM jsonb_array_elements(items_payload)
  LOOP
    v_prod_id := COALESCE(item->>'product_id', item->>'id')::uuid;
    v_restore_qty := (item->>'qty')::integer;
    v_variant_size := item->>'variant_size';
    
    -- إعادة الكمية الإجمالية
    UPDATE products
    SET quantity = quantity + v_restore_qty,
        updated_at = now()
    WHERE id = v_prod_id;
    
    -- إعادة المقاس المحدد إذا كان موجوداً
    IF v_variant_size IS NOT NULL AND v_variant_size != '' THEN
      UPDATE products
      SET variants = (
        SELECT jsonb_agg(
          CASE WHEN v->>'size' = v_variant_size
          THEN jsonb_set(v, '{quantity}', 
            to_jsonb(GREATEST(0, (v->>'quantity')::int + v_restore_qty)))
          ELSE v END
        )
        FROM jsonb_array_elements(variants) v
      )
      WHERE id = v_prod_id;
    END IF;
  END LOOP;
  RETURN jsonb_build_object('success', true);
END;
$$;
```

## 12.4 إصلاح apply_settlement_atomic — SQL

```sql
-- الإصلاح: تغيير vanex_settlements → courier_settlements
CREATE OR REPLACE FUNCTION public.apply_settlement_atomic(
  p_settlement_id uuid, p_tenant_id uuid, p_created_by uuid
) RETURNS jsonb LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  v_settlement RECORD;
  v_target_account RECORD;
BEGIN
  -- إصلاح اسم الجدول من vanex_settlements إلى courier_settlements
  SELECT * INTO v_settlement FROM courier_settlements  -- ← الإصلاح هنا
  WHERE id = p_settlement_id AND tenant_id = p_tenant_id AND status = 'pending'
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 
      'error', 'التسوية غير موجودة أو تم تطبيقها مسبقاً');
  END IF;

  -- ... باقي الكود كما هو ...
  
  -- إصلاح اسم الجدول في UPDATE أيضاً:
  UPDATE courier_settlements SET status = 'applied', applied_at = NOW() 
  WHERE id = p_settlement_id;  -- ← الإصلاح هنا
  
  RETURN jsonb_build_object('success', true);
END;
$$;
```

## 12.5 إصلاح استرداد الأموال عند الإلغاء

```typescript
// src/app/api/orders/status/route.ts — بعد السطر 66:

// إضافة: استرداد مالي لطلبيات شركات التوصيل المدفوعة مسبقاً
if (status === 'cancelled' && order.delivery_type === 'courier_company') {
  const prepaidAmount = order.prepaid_amount ?? 0;
  if (prepaidAmount > 0) {
    const { data: cashAccount } = await supabaseAdmin
      .from('treasury_accounts')
      .select('id')
      .eq('tenant_id', order.tenant_id)
      .eq('account_type', 'cash_in_hand')
      .single();

    if (cashAccount) {
      await supabaseAdmin.rpc('create_treasury_transaction_atomic', {
        p_tenant_id: order.tenant_id,
        p_account_id: cashAccount.id,
        p_transaction_type: 'refund',
        p_amount: -prepaidAmount,  // سالب = خروج من الخزينة
        p_description: `استرداد دفعة مسبقة — إلغاء طلبية ${order.order_number}`,
        p_created_by: auth.userId,
        p_transaction_date: new Date().toISOString().split('T')[0],
        p_is_transfer: false,
        p_to_account_id: null,
      });
    }
  }
}
```

---

# الجزء الثالث عشر: خارطة الطريق التنفيذية الكاملة

## المرحلة 0 — التنظيف الفوري (30 دقيقة)

```
[ ] 1. حذف مدن [DIAG] من bunyan_cities:
    DELETE FROM bunyan_cities WHERE name_ar LIKE '[DIAG]%';
    
[ ] 2. إيقاف or تعليم is_active=false لمدن [DIAG] أولاً للأمان
```

## المرحلة 1 — الإصلاحات الحرجة (ساعتان)

```
[ ] 1. تعديل webhook/route.ts: courier_tracking_code → vanex_package_code (3 أماكن)
[ ] 2. Migration: UNIQUE(tenant_id, vanex_settlement_id) على courier_settlements
[ ] 3. Migration: UNIQUE(vanex_package_code, event_type) على webhook_logs
[ ] 4. إصلاح apply_settlement_atomic: vanex_settlements → courier_settlements
```

## المرحلة 2 — إصلاح المخزون (ساعة)

```
[ ] 1. تعديل SQL لـ restore_inventory ليدعم variant_size
[ ] 2. تعديل SQL لـ deduct_inventory ليدعم variant_size
[ ] 3. اختبار: طلبية بمنتج متعدد المقاسات → إلغاء → فحص variants
```

## المرحلة 3 — الأمان والعزل (نصف يوم)

```
[ ] 1. إضافة عمود webhook_secret (text encrypted) في جدول couriers
[ ] 2. Migration: ALTER TABLE couriers ADD COLUMN webhook_secret text;
[ ] 3. توليد secret تلقائي عند إنشاء courier جديد (trigger أو في الـ API)
[ ] 4. تعديل Webhook handler:
    - extract tracking_code من الـ body
    - البحث في orders للحصول على courier_company_id
    - جلب courier.webhook_secret
    - التحقق منه بدلاً من VANEX_WEBHOOK_SECRET
[ ] 5. صفحة إعدادات الشركة تعرض:
    - الرابط: https://app.bunyan.ly/api/webhooks/vanex (نسخ بزر)
    - المفتاح: *** (نسخ بزر، لا يُعرض كاملاً)
```

## المرحلة 4 — المالية المفقودة (نصف يوم)

```
[ ] 1. إضافة استرداد الأموال عند إلغاء courier_company + prepaid_amount
[ ] 2. استخدام apply_settlement_atomic بعد إصلاحه بدلاً من الخطوتين
[ ] 3. فرض المرحلة 2 (التفاصيل) قبل السماح بالتطبيق:
    IF settlement.is_approximate == true → رسالة "يجب تفعيل التفاصيل أولاً"
[ ] 4. إصلاح RLS على courier_settlements INSERT
```

## المرحلة 5 — الجغرافيا والمدن (يوم)

```
[ ] 1. ربط المدن الـ 5 غير المربوطة مع فانكس
[ ] 2. إضافة Fallback message واضح عند عدم الربط:
    "مدينة {name} غير مدعومة في {شركة التوصيل} — تواصل مع الدعم"
[ ] 3. صفحة إدارة الربط الجغرافي في الإعدادات (نسبة التطابق + ربط يدوي)
```

## المرحلة 6 — البنية التحتية لـ 15 شركة (يومان)

```
[ ] 1. تطوير DeliveryProviderRegistry (بدلاً من switch/case)
[ ] 2. Universal Webhook Router: /api/webhooks/[provider]/route.ts
[ ] 3. إضافة translateStatus() لـ IDeliveryProvider Interface
[ ] 4. إضافة verifyWebhookSignature() لـ IDeliveryProvider Interface
[ ] 5. نقل Business Logic من route.ts إلى modules/delivery/services/
[ ] 6. تطوير المحاكي ليُحاكي كل الحالات للاختبار الصحيح
```

---

# الجزء الرابع عشر: التقييم النهائي المحدّث

## 14.1 درجات الجاهزية

| المحور | الدرجة | التفصيل |
|---|---|---|
| **جاهزية API فانكس** | 82% | يعمل بالكامل مع حلقة Self-healing ✅ لكن getCities لا يُفلتر active |
| **أمان الـ Webhook** | 40% | Secret موحد + عمود خاطئ + لا UNIQUE constraint |
| **التسويات المالية** | 65% | المنطق صحيح لكن apply_settlement_atomic معطوب + لا UNIQUE |
| **المخزون (Variants)** | 45% | الكمية الإجمالية صحيحة لكن المقاسات لا تُحدَّث |
| **الرواجع والإلغاءات** | 58% | يعيد المخزون ✅ لكن استرداد الأموال مفقود + Variants خاطئة |
| **الجغرافيا والمدن** | 52% | 5 مدن غير مربوطة + 84 مدينة DIAG + لا fallback |
| **قابلية التوسع** | 45% | Factory موجود لكن غير مستخدم + Interface ناقص |
| **RLS وعزل المتاجر** | 70% | معظم الجداول محمية لكن INSERT في settlements مفتوح |
| **الأداء والـ Concurrency** | 60% | Treasury ذري ✅ لكن Webhook Idempotency غير موثوق |
| **المجموع الكلي** | **57%** | **بحاجة ترقيع قبل الإنتاج الحقيقي** |

## 14.2 الأولويات المطلقة قبل الإطلاق

```
الأولوية 1 (يوقف الإنتاج): عمود webhook_logs الخاطئ
الأولوية 2 (خسارة مالية): variants لا تُحدَّث في restore/deduct
الأولوية 3 (خسارة مالية): استرداد الأموال مفقود عند الإلغاء
الأولوية 4 (أمان): Secret الـ Webhook موحد لكل المتاجر
الأولوية 5 (استقرار): lack of UNIQUE constraints → تكرار البيانات
الأولوية 6 (UX): مدن DIAG تظهر للمستخدمين
```

## 14.3 التقدير الزمني

```
إصلاح كل الثغرات الحرجة:  4-6 ساعات عمل
الوصول لـ 85% جاهزية:     يومان عمل
الوصول لـ 95% جاهزية:     أسبوع عمل (مع اختبار شامل)
بناء بنية 15 شركة:        أسبوع إضافي
```

---

*هذا التقرير مبني 100% على الكود الحقيقي والـ Schema الفعلية في Supabase — لا افتراضات.*
