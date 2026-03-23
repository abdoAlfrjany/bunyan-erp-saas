// src/app/api/orders/status/route.ts
// الميزة: تحديث حالة الطلبية بشكل ذري — مع تأثيرات الخزينة والمخزون على السيرفر
// يحل مشكلة: Ghost Treasury Transactions التي كانت تُنشأ فقط في Zustand
// 🔒 محمي بـ requireAuth + assertTenantMatch

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAuth, assertTenantMatch } from '@/core/server/auth';
import { vanexAdapter } from '@/core/delivery/VanexAdapter';

export async function PATCH(req: NextRequest) {
  try {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;

    const { orderId, status, paymentStatus } = await req.json();

    if (!orderId || !status) {
      return NextResponse.json({ error: 'orderId و status مطلوبان' }, { status: 400 });
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // 1. جلب الطلبية الحالية وقفلها (للتحقق من الملكية والحالة)
    const { data: order, error: fetchError } = await supabaseAdmin
      .from('orders')
      .select('id, tenant_id, status, total, delivery_type, items, order_number, vanex_package_id, courier_company_id')
      .eq('id', orderId)
      .single();

    if (fetchError || !order) {
      return NextResponse.json({ error: 'الطلبية غير موجودة' }, { status: 404 });
    }

    // 🔒 تحقق من الملكية
    const tenantError = assertTenantMatch(auth, order.tenant_id);
    if (tenantError) return tenantError;

    const prevStatus = order.status;
    const isInternal = ['internal', 'pickup'].includes(order.delivery_type);
    const updatePayload: Record<string, unknown> = { status };
    if (paymentStatus) updatePayload.payment_status = paymentStatus;

    // 1.5 إلغاء الشحنة من فانكس إذا لزم الأمر
    if (status === 'cancelled' && order.vanex_package_id && order.courier_company_id) {
      try {
        const { data: courier } = await supabaseAdmin
          .from('couriers')
          .select('api_credentials')
          .eq('id', order.courier_company_id)
          .single();

        const token = courier?.api_credentials?.token;
        if (token) {
          const cancelResult = await vanexAdapter.cancelShipment(order.vanex_package_id, token);
          if (!cancelResult.success) {
            console.error(`[Vanex] Failed to cancel shipment ${order.vanex_package_id}:`, cancelResult.error);
          }
        }
      } catch (cancelError) {
        console.error('[Vanex] Exception during cancellation:', cancelError);
      }
    }

    // 2. تحديث حالة الطلبية
    const { error: updateError } = await supabaseAdmin
      .from('orders')
      .update(updatePayload)
      .eq('id', orderId);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    // 3. تأثيرات الخزينة — فقط للطلبيات الداخلية
    if (isInternal) {
      const { data: cashAccount } = await supabaseAdmin
        .from('treasury_accounts')
        .select('id, balance')
        .eq('tenant_id', order.tenant_id)
        .eq('account_type', 'cash_in_hand')
        .single();

      if (cashAccount) {
        let treasuryAmount: number | null = null;
        let txDescription = '';

        // تسليم جديد ← إيراد
        if (status === 'delivered' && prevStatus !== 'delivered') {
          treasuryAmount = Math.abs(order.total);
          txDescription = `إيراد طلبية ${order.order_number}`;
        }
        // إلغاء طلبية كانت مسلّمة ← مصروف (استرجاع)
        else if (status === 'cancelled' && prevStatus === 'delivered') {
          treasuryAmount = -Math.abs(order.total);
          txDescription = `إلغاء طلبية مسلّمة ${order.order_number}`;
        }
        // تأكيد مرتجع ← مصروف
        else if (status === 'return_confirmed') {
          treasuryAmount = -Math.abs(order.total);
          txDescription = `مرتجع طلبية ${order.order_number}`;
        }

        // تسجيل الحركة المالية ذرياً
        if (treasuryAmount !== null) {
          const { error: rpcError } = await supabaseAdmin.rpc('create_treasury_transaction_atomic', {
            p_tenant_id: order.tenant_id,
            p_account_id: cashAccount.id,
            p_transaction_type: treasuryAmount > 0 ? 'sale' : 'expense',
            p_amount: treasuryAmount,
            p_description: txDescription,
            p_created_by: auth.userId,
            p_transaction_date: new Date().toISOString().split('T')[0],
            p_is_transfer: false,
            p_to_account_id: null,
          });

          if (rpcError) {
            console.error('[orders/status] Treasury RPC error:', rpcError.message);
            // الحالة تحدّثت — نُسجّل الخطأ لكن لا نُعيد فشلاً للـ UI
          }
        }
      }
    }

    // 4. استعادة المخزون عند الإلغاء أو المرتجع
    if (['cancelled', 'return_confirmed'].includes(status) && order.items?.length > 0) {
      const restorePayload = order.items.map((i: any) => ({
        product_id: i.productId,
        qty: i.quantity,
        variant_size: i.variantSize || null,
      }));

      const { error: rpcError } = await supabaseAdmin.rpc('restore_inventory', {
        items_payload: restorePayload,
      });

      if (rpcError) {
        console.error('[orders/status] restore_inventory RPC error:', rpcError.message);
      }
    }

    return NextResponse.json({ success: true, newStatus: status });
  } catch (err: any) {
    console.error('[PATCH /api/orders/status] Error:', err);
    return NextResponse.json({ error: err.message || 'خطأ داخلي' }, { status: 500 });
  }
}
