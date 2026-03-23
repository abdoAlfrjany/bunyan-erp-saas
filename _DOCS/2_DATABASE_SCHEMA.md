# 2_DATABASE_SCHEMA.md — هيكل قاعدة البيانات (الواقع الحالي - الإصدار 4.2)

# ⚠️ النظام يعتمد حالياً على **Supabase (PostgreSQL + RLS)** مدعوماً بـ **React Query** لجلب البيانات من الـ Server، و **Zustand** للكاشينغ السريع على بيئة المستخدم.

---

## 📌 الحقول الأساسية في كل واجهة (Interface)

كل كيان في النظام يمتلك `id` (عادة UUID)، و `tenant_id` يحدد هوية المتجر المالك للبيانات لضمان العزل التام للمخازن. الجداول في Supabase تُكتب بـ `snake_case`، وتُحوّل في بيئة TypeScript إلى `camelCase` لتوافق الـ Models.

---

## 🌐 الطبقة الصفرية — Super Admin والمستخدمون (Auth)

### `profiles` (جدول المستخدمين المكمل لـ auth.users)
هذا الجدول هو المرآة لـ Supabase Auth `auth.users`، ويحمل كل تفاصيل المستخدمين والأدوار.

```sql
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  tenant_id UUID, -- NULL للسوبر أدمن (الـ Owners للمنصة)
  full_name TEXT,
  email TEXT,
  role TEXT CHECK (role IN ('super_admin', 'owner', 'admin', 'employee', 'partner')), -- تم تعديله لتشمل 'super_admin'
  permissions JSONB,
  phone TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);
```
*ملاحظة: السوبر أدمن الفعلي يُدار الآن عبر رتبة `super_admin` مباشرة في الـ Profiles.*

### `tenants` (المتاجر)
بنية المتاجر، ترتبط بـ `tenant_id`.

```sql
CREATE TABLE public.tenants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  owner_id UUID REFERENCES public.profiles(id),
  plan TEXT DEFAULT 'basic',
  is_active BOOLEAN DEFAULT true,
  city TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

---

## 📦 وحدة المخزون والطلبيات

### `products` (المنتجات)

```sql
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  name TEXT NOT NULL,
  category TEXT,
  unit TEXT,
  cost_price NUMERIC NOT NULL,
  selling_price NUMERIC NOT NULL,
  quantity INTEGER NOT NULL,
  min_quantity INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  item_code TEXT UNIQUE,
  barcode TEXT,
  product_type TEXT,
  variants JSONB,
  custom_attributes JSONB
);
```

### `orders` (الطلبيات/المبيعات)

```sql
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  order_number TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  customer_city TEXT,
  delivery_type TEXT,
  courier_company_id UUID,
  delivery_fee NUMERIC DEFAULT 0,
  status TEXT NOT NULL, -- 'pending', 'processing', 'with_courier', 'delivered', etc.
  price_includes_delivery BOOLEAN DEFAULT false,
  subtotal NUMERIC NOT NULL,
  discount NUMERIC DEFAULT 0,
  total NUMERIC NOT NULL,
  payment_status TEXT DEFAULT 'pending',
  items JSONB NOT NULL, -- مصفوفة العناصر المباعة مع أسعار الوحدة والكميات
  created_at TIMESTAMPTZ DEFAULT now(),
  vanex_package_code TEXT,
  vanex_city_id INTEGER
);
```

### `customers` (الزبائن)

```sql
CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  city TEXT,
  address TEXT,
  total_orders INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

---

## 🚚 وحدة التوصيل والتسويات (Couriers & Geo-Mappings)

### `couriers` (شركات التوصيل)
تُستعمل للإدارة الداخلية وربط الـ API Adapter.

```sql
CREATE TABLE couriers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  name TEXT NOT NULL,
  provider TEXT, -- 'vanex', 'aramex', 'manual'
  api_provider TEXT,
  is_api_connected BOOLEAN,
  is_active BOOLEAN DEFAULT true,
  default_delivery_fee NUMERIC,
  api_credentials JSONB -- { email, passwordHash, token, tokenExpiresAt, vanexFromRegionId }
);
```
*(ملاحظة: كود الـ Adapter الخاص بـ VanEx في `src/core/delivery/VanexAdapter.ts` يعالج التسميات الخاطئة الخاصة بـ API فانكس ويجدد الـ token ديناميكياً ليحفظه مرة أخرى في `api_credentials`)*

### `provider_geo_mappings` (ربط المدن بين بنيان والمزودين)

```sql
CREATE TABLE provider_geo_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL,
  provider_city_id INTEGER NOT NULL,
  provider_region_id INTEGER,
  bunyan_city_id INTEGER REFERENCES bunyan_cities(id),
  bunyan_region_id INTEGER REFERENCES bunyan_regions(id),
  parent_mapping_id UUID,
  is_active BOOLEAN DEFAULT true,
  UNIQUE(provider, provider_city_id, provider_region_id)
);
```

---

## 💰 المالية والخزينة (Treasury)

### `treasury_accounts` (حسابات الخزينة)

```sql
CREATE TABLE treasury_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  account_type TEXT, -- 'cash_in_hand', 'bank'
  account_name TEXT NOT NULL,
  balance NUMERIC DEFAULT 0
);
```

### `treasury_transactions` (الحركات المالية)
**ملاحظة هامة جداً:** هذا الجدول **لا** يحتوي على عمود `reference_type` (تم حذفه وتنقيح الكود التشخيصي ليستغني عنه، يتم تقييم الـ description بدلاً منه أو إضافة meta data في JSON إذا لزم).

```sql
CREATE TABLE treasury_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  account_id UUID REFERENCES treasury_accounts(id),
  transaction_type TEXT NOT NULL, -- 'income', 'expense', 'sale'
  amount NUMERIC NOT NULL,
  description TEXT,
  transaction_date TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);
```

---

## ⚖️ أدوات الحماية والتشخيص (Diagnostic Suite)

يعتمد الهيكل الآن على `SystemDiagnostics v3.0.0` الذي ينفذ:
1. **Schema Guard:** `SELECT * FROM (table) LIMIT 1` (Live Probing) كأداة حية للتأكد من وجود الأعمدة المطلوبة بشكل فعلي (بدل information_schema لمنع أخطاء الـ 캐싱).
2. **Financial Integrations:** التأكد من توازن الأرصدة (Treasury balance = initial + sum(transactions)).
3. **Idempotency Check:** فحص القيود لمنع Double Spending وتسجيل أخطاء PostgreSQL 23505 (Unique Violation) كنجاح للـ Idempotency.

**نهاية الملف**
