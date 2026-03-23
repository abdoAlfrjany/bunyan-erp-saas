-- ═══════════════════════════════════════════════════════════════════════════
--  Bunyan ERP SaaS — Phase 2 Database Optimizations
--  تاريخ: 2026-03-16
--  تنفيذ هذا الملف مرة واحدة فقط في Supabase → SQL Editor
-- ═══════════════════════════════════════════════════════════════════════════


-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
--  SECTION 1: Critical Performance Indexes
--  الهدف: تسريع أكثر الاستعلامات تكراراً بـ 10–100 مرة
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

-- Composite index on orders: tenant filter + date sort (most critical query)
-- يُقلل scan من O(n) إلى O(log n) لكل عملية جلب طلبيات
CREATE INDEX IF NOT EXISTS idx_orders_tenant_created
  ON orders(tenant_id, created_at DESC);

-- Index on products per tenant
CREATE INDEX IF NOT EXISTS idx_products_tenant
  ON products(tenant_id);

-- Index on profiles per tenant (used in RBAC lookups)
CREATE INDEX IF NOT EXISTS idx_profiles_tenant
  ON profiles(tenant_id);

-- Composite index on customers: phone lookup within a tenant
-- يُسرّع عمليات البحث عن العميل عند إنشاء الطلبية
CREATE INDEX IF NOT EXISTS idx_customers_phone_tenant
  ON customers(phone, tenant_id);

-- Index on orders tenant for non-date queries (status filters etc.)
CREATE INDEX IF NOT EXISTS idx_orders_tenant_status
  ON orders(tenant_id, status);

-- Index for treasury transactions per account (balance calculations)
CREATE INDEX IF NOT EXISTS idx_treasury_tx_account
  ON treasury_transactions(account_id, created_at DESC);

-- Index for debts by linked entity (partner/employee debt lookups)
CREATE INDEX IF NOT EXISTS idx_debts_linked_entity
  ON debts(linked_entity_id, tenant_id);


-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
--  SECTION 2: RPC Function — deduct_inventory (Batch Atomic Update)
--  الهدف: استبدال N+1 HTTP calls بـ RPC واحد لكل طلبية
--  المدخل:  items_payload = [{ "product_id": "uuid", "qty": 2, "variant_size": "L" }, ...]
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CREATE OR REPLACE FUNCTION deduct_inventory(items_payload JSONB)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  item        JSONB;
  product_row RECORD;
  updated_variants JSONB;
  new_qty     NUMERIC;
  v_item      JSONB;
  found_variant BOOLEAN;
BEGIN
  -- تكرار على كل عنصر في المصفوفة
  FOR item IN SELECT * FROM jsonb_array_elements(items_payload)
  LOOP
    -- جلب سجل المنتج مع قفل للتحديث المتزامن (FOR UPDATE)
    SELECT id, quantity, product_type, variants
    INTO product_row
    FROM products
    WHERE id = (item->>'product_id')::UUID
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Product not found: %', item->>'product_id';
    END IF;

    -- التحقق من الكمية
    IF product_row.quantity < (item->>'qty')::NUMERIC THEN
      RAISE EXCEPTION 'Insufficient stock for product: %. Available: %, Requested: %',
        item->>'product_id',
        product_row.quantity,
        (item->>'qty')::NUMERIC;
    END IF;

    new_qty := product_row.quantity - (item->>'qty')::NUMERIC;

    -- خصم المنتجات ذات المقاسات (Variants)
    IF product_row.product_type != 'simple'
       AND item->>'variant_size' IS NOT NULL
       AND item->>'variant_size' != ''
       AND product_row.variants IS NOT NULL
    THEN
      updated_variants := '[]'::JSONB;
      found_variant := FALSE;

      FOR v_item IN SELECT * FROM jsonb_array_elements(product_row.variants)
      LOOP
        IF (v_item->>'size') = (item->>'variant_size') THEN
          updated_variants := updated_variants || jsonb_build_array(
            jsonb_set(v_item, '{quantity}',
              to_jsonb(GREATEST(0, (v_item->>'quantity')::NUMERIC - (item->>'qty')::NUMERIC))
            )
          );
          found_variant := TRUE;
        ELSE
          updated_variants := updated_variants || jsonb_build_array(v_item);
        END IF;
      END LOOP;

      UPDATE products
      SET
        quantity = new_qty,
        variants = updated_variants
      WHERE id = (item->>'product_id')::UUID;
    ELSE
      -- منتج بسيط — فقط تحديث الكمية
      UPDATE products
      SET quantity = new_qty
      WHERE id = (item->>'product_id')::UUID;
    END IF;

  END LOOP;
END;
$$;

-- منح صلاحية التنفيذ للمستخدمين المصادق عليهم
GRANT EXECUTE ON FUNCTION deduct_inventory(JSONB) TO authenticated;


-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
--  SECTION 3: RPC Function — restore_inventory (Batch Restore on Cancel/Return)
--  الهدف: استخدامه عند الإلغاء أو المرتجع بدلاً من N+1 updates
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CREATE OR REPLACE FUNCTION restore_inventory(items_payload JSONB)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  item          JSONB;
  product_row   RECORD;
  updated_variants JSONB;
  v_item        JSONB;
BEGIN
  FOR item IN SELECT * FROM jsonb_array_elements(items_payload)
  LOOP
    SELECT id, quantity, product_type, variants
    INTO product_row
    FROM products
    WHERE id = (item->>'product_id')::UUID
    FOR UPDATE;

    IF NOT FOUND THEN CONTINUE; END IF;

    IF product_row.product_type != 'simple'
       AND item->>'variant_size' IS NOT NULL
       AND item->>'variant_size' != ''
       AND product_row.variants IS NOT NULL
    THEN
      updated_variants := '[]'::JSONB;
      FOR v_item IN SELECT * FROM jsonb_array_elements(product_row.variants)
      LOOP
        IF (v_item->>'size') = (item->>'variant_size') THEN
          updated_variants := updated_variants || jsonb_build_array(
            jsonb_set(v_item, '{quantity}',
              to_jsonb((v_item->>'quantity')::NUMERIC + (item->>'qty')::NUMERIC)
            )
          );
        ELSE
          updated_variants := updated_variants || jsonb_build_array(v_item);
        END IF;
      END LOOP;

      UPDATE products
      SET
        quantity = product_row.quantity + (item->>'qty')::NUMERIC,
        variants = updated_variants
      WHERE id = (item->>'product_id')::UUID;
    ELSE
      UPDATE products
      SET quantity = product_row.quantity + (item->>'qty')::NUMERIC
      WHERE id = (item->>'product_id')::UUID;
    END IF;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION restore_inventory(JSONB) TO authenticated;


-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
--  SECTION 4: Optionally analyze tables after creating indexes
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ANALYZE orders;
ANALYZE products;
ANALYZE profiles;
ANALYZE customers;
ANALYZE treasury_transactions;
ANALYZE debts;

-- ═══════════════════════════════════════════════
--  ✅ تم بنجاح — النظام أصبح جاهزاً للتوسع
-- ═══════════════════════════════════════════════
