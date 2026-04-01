// src/core/delivery/cancelOrderSideEffects.ts
// الوظيفة: دالة مشتركة للتأثيرات الجانبية عند إلغاء / إرجاع طلبية
// تُستدعى من: orders/status/route.ts، vanex/sync/route.ts، vanex/track/route.ts، webhooks/vanex/route.ts
// ⚠️ تحل محل استدعاء fetch() الداخلي الخطير في بيئة Serverless

import { SupabaseClient } from '@supabase/supabase-js';
import { vanexAdapter } from './VanexAdapter';

interface OrderForCancel {
  id: string;
  tenant_id: string;
  total: number;
  delivery_type: string;
  items: unknown;
  order_number: string;
  courier_package_id?: number | null;
  courier_company_id?: string | null;
  prepaid_amount?: number | null;
  status: string;
}

interface CancelOptions {
  newStatus: 'cancelled' | 'return_confirmed';
  userId: string;
  cancelVanexShipment?: boolean;
}

interface CancelResult {
  success: boolean;
  inventoryRestored: boolean;
  treasuryAdjusted: boolean;
  vanexCancelled?: boolean;
  error?: string;
}

export async function applyCancelSideEffects(
  supabaseAdmin: SupabaseClient,
  order: OrderForCancel,
  options: CancelOptions
): Promise<CancelResult> {
  const result: CancelResult = {
    success: true,
    inventoryRestored: false,
    treasuryAdjusted: false,
  };

  // ════════════════════════════════════════
  // 1. إلغاء الشحنة من فانكس (إذا طُلب)
  // ════════════════════════════════════════
  if (options.cancelVanexShipment && order.courier_package_id && order.courier_company_id) {
    try {
      const { data: courier } = await supabaseAdmin
        .from('couriers')
        .select('api_credentials')
        .eq('id', order.courier_company_id)
        .single();

      const token = courier?.api_credentials?.token;
      if (token) {
        const cancelResult = await vanexAdapter.cancelShipment(order.courier_package_id, token);
        result.vanexCancelled = cancelResult.success;
        if (!cancelResult.success) {
          console.error(`[cancelOrderSideEffects] Vanex cancel failed for ${order.courier_package_id}:`, cancelResult.error);
        }
      }
    } catch (err) {
      console.error('[cancelOrderSideEffects] Vanex cancel exception:', err);
      result.vanexCancelled = false;
    }
  }

  // ════════════════════════════════════════
  // 2. استعادة المخزون (مع دعم المقاسات)
  // ════════════════════════════════════════
  const items = Array.isArray(order.items) ? order.items : [];
  if (items.length > 0) {
    const restorePayload = (items as { productId: string; quantity: number; variantSize?: string }[]).map((i) => ({
      product_id: i.productId,
      qty: i.quantity,
      variant_size: i.variantSize || null,
    }));

    const { error: rpcError } = await supabaseAdmin.rpc('restore_inventory', {
      items_payload: restorePayload,
    });

    if (rpcError) {
      console.error('[cancelOrderSideEffects] restore_inventory failed:', rpcError.message);
    } else {
      result.inventoryRestored = true;
    }
  }

  // ════════════════════════════════════════
  // 3. تأثيرات الخزينة
  // ════════════════════════════════════════
  const isInternal = ['internal', 'pickup'].includes(order.delivery_type);
  const prevStatus = order.status;

  // 3a. استرداد أموال الطلبيات الداخلية التي كانت مسلّمة
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

      if (options.newStatus === 'cancelled' && prevStatus === 'delivered') {
        treasuryAmount = -Math.abs(order.total);
        txDescription = `إلغاء طلبية مسلّمة ${order.order_number}`;
      } else if (options.newStatus === 'return_confirmed') {
        treasuryAmount = -Math.abs(order.total);
        txDescription = `مرتجع طلبية ${order.order_number}`;
      }

      if (treasuryAmount !== null) {
        const { error: rpcError } = await supabaseAdmin.rpc('create_treasury_transaction_atomic', {
          p_tenant_id: order.tenant_id,
          p_account_id: cashAccount.id,
          p_transaction_type: 'expense',
          p_amount: treasuryAmount,
          p_description: txDescription,
          p_created_by: options.userId,
          p_transaction_date: new Date().toISOString().split('T')[0],
          p_is_transfer: false,
          p_to_account_id: null,
        });

        if (rpcError) {
          console.error('[cancelOrderSideEffects] Treasury RPC error:', rpcError.message);
        } else {
          result.treasuryAdjusted = true;
        }
      }
    }
  }

  // 3b. C6 FIX: استرداد الدفعة المسبقة لطلبيات شركات التوصيل
  if (!isInternal && order.prepaid_amount && order.prepaid_amount > 0) {
    const { data: cashAccount } = await supabaseAdmin
      .from('treasury_accounts')
      .select('id')
      .eq('tenant_id', order.tenant_id)
      .eq('account_type', 'cash_in_hand')
      .single();

    if (cashAccount) {
      const { error: rpcError } = await supabaseAdmin.rpc('create_treasury_transaction_atomic', {
        p_tenant_id: order.tenant_id,
        p_account_id: cashAccount.id,
        p_transaction_type: 'expense',
        p_amount: -Math.abs(order.prepaid_amount),
        p_description: `استرداد دفعة مسبقة — إلغاء طلبية ${order.order_number}`,
        p_created_by: options.userId,
        p_transaction_date: new Date().toISOString().split('T')[0],
        p_is_transfer: false,
        p_to_account_id: null,
      });

      if (rpcError) {
        console.error('[cancelOrderSideEffects] Prepaid refund error:', rpcError.message);
      } else {
        result.treasuryAdjusted = true;
      }
    }
  }

  return result;
}
