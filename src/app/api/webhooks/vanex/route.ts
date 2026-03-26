// src/app/api/webhooks/vanex/route.ts
// الوظيفة: استقبال تحديثات حالة الشحنات من Vanex في الوقت الفعلي
// 🔒 محمي بـ token سري (VANEX_WEBHOOK_SECRET)
// ✅ return 200 دائماً — لمنع إعادة المحاولة اللانهائية من Vanex

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const VANEX_WEBHOOK_SECRET = process.env.VANEX_WEBHOOK_SECRET;

// ── نفس mapping الموجود في VanexAdapter.ts ──
const VANEX_TO_BUNYAN_STATUS: Record<string, string> = {
  store_new:           'pending',         
  pending:             'pending',         
  ship_received:       'ready_to_ship',   
  ship_preperation:    'with_courier',    
  ship_ongoing:        'with_courier',    
  ship_pending:        'with_courier',    
  shipped:             'with_courier',    
  on_track:            'with_courier',    
  enable_delivery:     'with_courier',    
  pending_office_sett: 'delivered',       
  pending_store_sett:  'delivered',       
  completed:           'delivered',       
  delivered:           'delivered',       
  complete:            'delivered',       
  ship_del_return:     'pending_return',  
  returned:            'pending_return',  
  store_return:        'return_confirmed',
  store_canceled:      'cancelled',       
  cancelled:           'cancelled',       
  canceled:            'cancelled',       
  canceled_by_admin:   'cancelled',       
  canceled_by_source:  'cancelled',       
  refused:             'pending_return',  
};

export async function POST(req: NextRequest) {
  let logId: string | null = null;

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  try {
    const body = await req.json();

    // ── 0. تسجيل جميع الطلبات القادمة (حتى المرفوضة) لمعرفة طريقة إرسال الـ Token ──
    const headersObj: Record<string, string> = {};
    req.headers.forEach((value, key) => { headersObj[key] = value; });

    const { data: logData, error: logError } = await supabaseAdmin
      .from('webhook_logs')
      .insert({
        source: 'vanex',
        event_type: 'raw_incoming',
        courier_tracking_code: body['package-code'] ?? body.package_code ?? body.data?.['package-code'] ?? 'DEBUG',
        payload: { body, headers: headersObj },
        processed: false,
      })
      .select('id')
      .single();

    if (!logError && logData) {
      logId = logData.id;
    }

    // ── 1. التحقق من Token ──
    // دعم جميع الأماكن المحتملة التي قد يرسل فيها فانكس الـ Token
    const incomingToken =
      req.headers.get('x-webhook-token') ??
      req.headers.get('authorization')?.replace('Bearer ', '') ??
      req.headers.get('token') ??
      body.token ??
      null;

    if (!VANEX_WEBHOOK_SECRET || incomingToken !== VANEX_WEBHOOK_SECRET) {
      // تحديث السجل كمرجوع بسبب المصادقة
      if (logId) await supabaseAdmin.from('webhook_logs').update({ error: `Unauthorized. Expected: ${VANEX_WEBHOOK_SECRET?.slice(0,5)}..., Got: ${incomingToken}` }).eq('id', logId);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // ── 2. استخراج البيانات ──
    const code: string | null =
      body['package-code'] ??
      body.package_code ??
      body.data?.['package-code'] ??
      null;

    const rawStatus: string =
      body.status_object?.status_value ??
      body.status ??
      'unknown';

    const bunyanStatus: string =
      VANEX_TO_BUNYAN_STATUS[rawStatus] ?? 'with_courier';

    // ── 3. تسجيل الـ webhook فوراً ──
    if (!logId) {
      const { data: logData, error: logError } = await supabaseAdmin
        .from('webhook_logs')
        .insert({
          source: 'vanex',
          event_type: rawStatus,
          courier_tracking_code: code,
          payload: body,
          processed: false,
        })
        .select('id')
        .single();
  
      if (!logError && logData) {
        logId = logData.id;
      }
    } else {
      // Update the existing debug log
      await supabaseAdmin.from('webhook_logs').update({ event_type: rawStatus, payload: body }).eq('id', logId);
    }

    // ── 4. إذا لم يوجد كود الشحنة ──
    if (!code) {
      if (logId) {
        await supabaseAdmin
          .from('webhook_logs')
          .update({ error: 'missing package-code' })
          .eq('id', logId);
      }
      return NextResponse.json({ success: true });
    }

    // ── 5. Idempotency — منع المعالجة المزدوجة ──
    const { data: existingLog } = await supabaseAdmin
      .from('webhook_logs')
      .select('id')
      .eq('courier_tracking_code', code)
      .eq('event_type', rawStatus)
      .eq('processed', true)
      .neq('id', logId ?? '')
      .limit(1)
      .single();

    if (existingLog) {
      // تم المعالجة مسبقاً
      return NextResponse.json({ success: true });
    }

    // ── 6. البحث عن الطلبية ──
    const { data: order, error: orderError } = await supabaseAdmin
      .from('orders')
      .select('id, tenant_id, status, items, courier_raw_status')
      .eq('courier_tracking_code', code)
      .limit(1)
      .single();

    if (orderError || !order) {
      if (logId) {
        await supabaseAdmin
          .from('webhook_logs')
          .update({ error: `order not found: ${code}` })
          .eq('id', logId);
      }
      return NextResponse.json({ success: true });
    }

    // ── 7. معالجة كل حالة ──

    if (bunyanStatus === 'pending') {
      // لا تحديث للحالة، تبقى كما هي بانتظار استلام المندوب
    } else if (
      bunyanStatus === 'ready_to_ship' || 
      bunyanStatus === 'with_courier' || 
      bunyanStatus === 'delivered' || 
      bunyanStatus === 'pending_return'
    ) {
      // الأطوار التي تغير الحالة فقط ولا تسترد المخزون
      await supabaseAdmin
        .from('orders')
        .update({
          courier_raw_status: rawStatus,
          status: bunyanStatus,
          updated_at: new Date().toISOString(),
        })
        .eq('id', order.id);

    } else if (bunyanStatus === 'return_confirmed' || bunyanStatus === 'cancelled') {
      // تحديث الحالة
      await supabaseAdmin
        .from('orders')
        .update({
          courier_raw_status: rawStatus,
          status: bunyanStatus,
          updated_at: new Date().toISOString(),
        })
        .eq('id', order.id);

      // استرداد المخزون
      const items = Array.isArray(order.items) ? order.items : [];
      if (items.length > 0) {
        const restorePayload = items.map((i: { productId: string; quantity: number; variantSize?: string | null }) => ({
          product_id: i.productId,
          qty: i.quantity,
          variant_size: i.variantSize || null,
        }));

        const { error: rpcError } = await supabaseAdmin.rpc('restore_inventory', {
          items_payload: restorePayload,
        });

        if (rpcError) {
          console.error('[Webhook Vanex] restore_inventory failed:', rpcError.message);
          if (logId) {
            await supabaseAdmin
              .from('webhook_logs')
              .update({ error: 'inventory restore failed: ' + rpcError.message })
              .eq('id', logId);
          }
          // لا نوقف الـ webhook — نكمل
        }
      }
    }

    // ── 8. تحديث سجل الـ webhook كمعالَج ──
    if (logId) {
      await supabaseAdmin
        .from('webhook_logs')
        .update({
          processed: true,
          tenant_id: order.tenant_id,
        })
        .eq('id', logId);
    }

    return NextResponse.json({ success: true });

  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'unknown error';
    console.error('[POST /api/webhooks/vanex] Error:', errorMsg);

    // تسجيل الخطأ في webhook_logs إذا أمكن
    if (logId) {
      try {
        await supabaseAdmin
          .from('webhook_logs')
          .update({ error: (err instanceof Error ? err.message : String(err)) || 'unknown error' })
          .eq('id', logId);
      } catch { }
    }

    // دائماً return 200 — Vanex يعيد المحاولة عند أي خطأ
    return NextResponse.json({ success: true });
  }
}
