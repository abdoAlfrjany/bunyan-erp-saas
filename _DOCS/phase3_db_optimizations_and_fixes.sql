-- ==========================================================
-- 🚀 Bunyan ERP — System Diagnostics & Repair
-- Phase 3: DB Optimizations & Atomic Operations (Double Write Fix)
-- ==========================================================

-- 1. فهرس تسريع عمليات الخزينة (موجود مسبقاً في قاعدة البيانات ولكن هذا للتوثيق)
CREATE INDEX IF NOT EXISTS idx_treasury_transactions_tenant_created
  ON public.treasury_transactions USING btree (tenant_id, created_at DESC);

-- ==========================================================
-- 2. دالة التعامل الذري مع المخزون (Atomic Stock Update)
-- تحمي النظام من الـ Race Conditions و Double Spends عند التعديل المتزامن
-- ==========================================================
CREATE OR REPLACE FUNCTION public.adjust_product_stock_atomic(p_product_id uuid, p_qty_delta numeric)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  updated_row RECORD;
BEGIN
  UPDATE products
  SET quantity = quantity + p_qty_delta,
      updated_at = now()
  WHERE id = p_product_id
  RETURNING * INTO updated_row;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Product not found';
  END IF;

  RETURN row_to_json(updated_row)::JSONB;
END;
$function$;

-- السماح للمستخدمين بتنفيذ الدالة
GRANT EXECUTE ON FUNCTION adjust_product_stock_atomic(UUID, NUMERIC) TO authenticated;

-- ==========================================================
-- ✅ DONE.
-- تم تطبيق هذا الملف آلياً من خلال AI Agent على قاعدة البيانات مباشرة
-- ==========================================================
