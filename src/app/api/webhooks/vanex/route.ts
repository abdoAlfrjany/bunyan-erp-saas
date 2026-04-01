// src/app/api/webhooks/vanex/route.ts
// الوظيفة: استقبال تحديثات حالة الشحنات من Vanex في الوقت الفعلي
// 🔒 محمي بـ webhook_secret لكل شركة توصيل (مع fallback لـ VANEX_WEBHOOK_SECRET)
// ✅ return 200 دائماً — لمنع إعادة المحاولة اللانهائية من Vanex

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { VANEX_TO_BUNYAN_STATUS } from '@/core/delivery/VanexAdapter';
import { applyCancelSideEffects } from '@/core/delivery/cancelOrderSideEffects';

const VANEX_WEBHOOK_SECRET = process.env.VANEX_WEBHOOK_SECRET;

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
        vanex_package_code: body['package-code'] ?? body.package_code ?? body.data?.['package-code'] ?? 'DEBUG',
        payload: { body, headers: headersObj },
        processed: false,
      })
      .select('id')
      .single();

    if (!logError && logData) {
      logId = logData.id;
    }

    // ── 1. التحقق من Token ──
    // 1a. استخراج Token من كل الأماكن المحتملة
    const incomingToken =
      req.headers.get('x-webhook-token') ??
      req.headers.get('authorization')?.replace('Bearer ', '') ??
      req.headers.get('token') ??
      body.token ??
      null;

    // 1b. محاولة التحقق من webhook_secret الخاص بشركة التوصيل أولاً
    let isAuthorized = false;

    if (incomingToken) {
      // أولاً: تحقق من الـ secret الموحد (Fallback)
      if (VANEX_WEBHOOK_SECRET && incomingToken === VANEX_WEBHOOK_SECRET) {
        isAuthorized = true;
      }

      // ثانياً: تحقق من الـ secret الخاص بشركة التوصيل (Tenant-specific)
      if (!isAuthorized) {
        const { data: courierMatch } = await supabaseAdmin
          .from('couriers')
          .select('id')
          .eq('webhook_secret', incomingToken)
          .eq('api_provider', 'vanex')
          .limit(1)
          .maybeSingle();

        if (courierMatch) {
          isAuthorized = true;
        }
      }
    }

    if (!isAuthorized) {
      if (logId) await supabaseAdmin.from('webhook_logs').update({ error: `Unauthorized. Got: ${incomingToken?.slice(0, 8)}...` }).eq('id', logId);
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

    // ── 3. تحديث سجل الـ webhook ──
    if (logId) {
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
    // الآن يعمل بشكل صحيح لأننا نستخدم vanex_package_code (العمود الحقيقي)
    const { data: existingLog } = await supabaseAdmin
      .from('webhook_logs')
      .select('id')
      .eq('vanex_package_code', code)
      .eq('event_type', rawStatus)
      .eq('processed', true)
      .neq('id', logId ?? '')
      .limit(1)
      .maybeSingle();

    if (existingLog) {
      return NextResponse.json({ success: true });
    }

    // ── 6. البحث عن الطلبية ──
    const { data: order, error: orderError } = await supabaseAdmin
      .from('orders')
      .select('id, tenant_id, status, items, courier_raw_status, total, delivery_type, order_number, courier_package_id, courier_company_id, prepaid_amount')
      .eq('courier_tracking_code', code)
      .limit(1)
      .maybeSingle();

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
      // لا تحديث للحالة
    } else if (
      bunyanStatus === 'ready_to_ship' || 
      bunyanStatus === 'with_courier' || 
      bunyanStatus === 'delivered' || 
      bunyanStatus === 'pending_return'
    ) {
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

      // تطبيق التأثيرات الجانبية (مخزون + ماليات) عبر الدالة المشتركة
      const sideEffects = await applyCancelSideEffects(supabaseAdmin, order, {
        newStatus: bunyanStatus as 'cancelled' | 'return_confirmed',
        userId: order.tenant_id, // webhook = system action → tenant as actor
        cancelVanexShipment: false, // لا إلغاء من فانكس — فانكس هي من أرسلت!
      });

      if (!sideEffects.inventoryRestored && logId) {
        await supabaseAdmin
          .from('webhook_logs')
          .update({ error: 'inventory restore failed' })
          .eq('id', logId);
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

    if (logId) {
      try {
        await supabaseAdmin
          .from('webhook_logs')
          .update({ error: (err instanceof Error ? err.message : String(err)) || 'unknown error' })
          .eq('id', logId);
      } catch (logErr) {
        console.error('[webhook] Failed to update error log:', logErr);
      }
    }

    // دائماً return 200 — Vanex يعيد المحاولة عند أي خطأ
    return NextResponse.json({ success: true });
  }
}
