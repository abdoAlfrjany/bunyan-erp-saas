// src/app/api/orders/[id]/route.ts
// الميزة: حذف وتعديل الطلبيات بأمان — مع قواعد عمل صارمة
// 🔒 محمي بـ requireAuth + assertTenantMatch
// قواعد العمل:
//   - الحذف: مسموح فقط للطلبيات Pending غير المرسلة لفانكس
//   - التعديل: مسموح فقط للطلبيات Pending غير المرسلة لفانكس
//   - الإلغاء يتم عبر /api/orders/status وليس هنا

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAuth, assertTenantMatch } from '@/core/server/auth';

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

// ══════════════════════════════════════════
// DELETE /api/orders/[id]  — حذف نهائي
// ══════════════════════════════════════════
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;

    const supabase = getAdminClient();

    // 1. جلب الطلبية
    const { data: order, error: fetchError } = await supabase
      .from('orders')
      .select('id, tenant_id, status, vanex_package_id, vanex_package_code, items')
      .eq('id', params.id)
      .single();

    if (fetchError || !order) {
      return NextResponse.json({ error: 'الطلبية غير موجودة' }, { status: 404 });
    }

    // 🔒 2. التحقق من الملكية
    const tenantError = assertTenantMatch(auth, order.tenant_id);
    if (tenantError) return tenantError;

    // 🛡️ 3. قاعدة العمل: لا يمكن الحذف إذا أُرسلت لفانكس
    if (order.vanex_package_id || order.vanex_package_code) {
      return NextResponse.json(
        { error: 'لا يمكن حذف طلبية مرسلة لشركة التوصيل. استخدم خيار الإلغاء بدلاً من ذلك.' },
        { status: 403 }
      );
    }

    // 🛡️ 4. قاعدة العمل: الحذف متاح فقط للحالة Pending
    if (order.status !== 'pending') {
      return NextResponse.json(
        { error: `لا يمكن حذف طلبية في حالة "${order.status}". يمكن حذف الطلبيات الجديدة (Pending) فقط.` },
        { status: 403 }
      );
    }

    // 5. استعادة المخزون قبل الحذف (لأن الطلبية خصمت المخزون عند الإنشاء)
    if (order.items?.length > 0) {
      const restorePayload = order.items.map((i: any) => ({
        product_id: i.productId,
        qty: i.quantity,
        variant_size: i.variantSize || null,
      }));
      const { error: rpcError } = await supabase.rpc('restore_inventory', {
        items_payload: restorePayload,
      });
      if (rpcError) {
        console.error('[DELETE /api/orders] restore_inventory error:', rpcError.message);
      }
    }

    // 6. الحذف النهائي
    const { error: deleteError } = await supabase
      .from('orders')
      .delete()
      .eq('id', params.id);

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[DELETE /api/orders] exception:', err);
    return NextResponse.json({ error: err.message || 'خطأ داخلي' }, { status: 500 });
  }
}

// ══════════════════════════════════════════
// PATCH /api/orders/[id]  — تعديل بيانات الطلبية
// ══════════════════════════════════════════
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;

    const supabase = getAdminClient();

    // 1. جلب الطلبية
    const { data: order, error: fetchError } = await supabase
      .from('orders')
      .select('id, tenant_id, status, vanex_package_id, vanex_package_code, items')
      .eq('id', params.id)
      .single();

    if (fetchError || !order) {
      return NextResponse.json({ error: 'الطلبية غير موجودة' }, { status: 404 });
    }

    // 🔒 2. التحقق من الملكية
    const tenantError = assertTenantMatch(auth, order.tenant_id);
    if (tenantError) return tenantError;

    // 🛡️ 3. قاعدة العمل: لا يمكن التعديل بعد الإرسال لفانكس
    if (order.vanex_package_id || order.vanex_package_code) {
      return NextResponse.json(
        { error: 'لا يمكن تعديل طلبية بعد إرسالها لشركة التوصيل.' },
        { status: 403 }
      );
    }

    // 🛡️ 4. قاعدة العمل: التعديل متاح فقط للحالة Pending
    if (order.status !== 'pending') {
      return NextResponse.json(
        { error: 'لا يمكن تعديل طلبية غير معلقة.' },
        { status: 403 }
      );
    }

    const updates = await req.json();

    // 5. حقول مسموح بتعديلها
    const allowedFields = [
      'customer_name', 'customer_phone', 'customer_city', 'customer_address', 'notes', 
      'delivery_type', 'courier_company_id', 'total_amount', 'discount'
    ];

    const filteredUpdates: Record<string, unknown> = {};
    for (const field of allowedFields) {
      if (field in updates) filteredUpdates[field] = updates[field];
    }

    // 6. التعامل مع تعديل المنتجات (Inventory Shift)
    if (updates.items && Array.isArray(updates.items)) {
      // أ. استعادة المخزون القديم أولاً (إذا وُجد)
      if (order.items?.length > 0) {
        const restorePayload = (order.items as any[]).map((i: any) => ({
          product_id: i.productId,
          qty: i.quantity,
          variant_size: i.variantSize || null,
        }));
        await supabase.rpc('restore_inventory', { items_payload: restorePayload });
      }

      // ب. خصم المخزون الجديد
      const deductPayload = (updates.items as any[]).map((i: any) => ({
          product_id: i.productId,
          qty: i.quantity,
          variant_size: i.variantSize || null,
      }));
      const { error: deductError } = await supabase.rpc('deduct_inventory', {
          items_payload: deductPayload,
      });

      if (deductError) {
          // إذا فشل الخصم (نقص مخزون مثلاً)، يجب إعادة المخزون القديم لضمان الاتساق
          if (order.items?.length > 0) {
            const restoreAgain = (order.items as any[]).map((i: any) => ({
                product_id: i.productId,
                qty: i.quantity,
                variant_size: i.variantSize || null,
            }));
            await supabase.rpc('deduct_inventory', { items_payload: restoreAgain });
          }
          return NextResponse.json({ error: `فشل تحديث المخزون: ${deductError.message}` }, { status: 400 });
      }

      filteredUpdates.items = updates.items;
    }

    filteredUpdates.updated_at = new Date().toISOString();

    const { error: updateError } = await supabase
      .from('orders')
      .update(filteredUpdates)
      .eq('id', params.id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[PATCH /api/orders/[id]] exception:', err);
    return NextResponse.json({ error: err.message || 'خطأ داخلي' }, { status: 500 });
  }
}
