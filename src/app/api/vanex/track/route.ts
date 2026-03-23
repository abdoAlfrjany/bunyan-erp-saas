// src/app/api/vanex/track/route.ts
// الوظيفة: تتبع حالة طلبية واحدة من فانكس وتحديث Supabase
// 🔒 محمي بـ requireAuth + assertTenantMatch

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAuth, assertTenantMatch } from '@/core/server/auth';
import { vanexAdapter, VANEX_TO_BUNYAN_STATUS } from '@/core/delivery/VanexAdapter';

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;

    const { orderId } = await req.json();
    if (!orderId) {
      return NextResponse.json({ error: 'orderId مطلوب' }, { status: 400 });
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // 1. جلب الطلبية
    const { data: order, error: fetchError } = await supabaseAdmin
      .from('orders')
      .select('id, tenant_id, vanex_package_code, vanex_package_id, courier_company_id, status')
      .eq('id', orderId)
      .single();

    if (fetchError || !order) {
      return NextResponse.json({ error: 'الطلبية غير موجودة' }, { status: 404 });
    }

    // 🔒 تحقق من الملكية
    const tenantError = assertTenantMatch(auth, order.tenant_id);
    if (tenantError) return tenantError;

    if (!order.vanex_package_code) {
      return NextResponse.json({ error: 'هذه الطلبية لم تُرسل لفانكس' }, { status: 400 });
    }

    // 2. جلب token الشركة
    const { data: courier } = await supabaseAdmin
      .from('couriers')
      .select('api_credentials')
      .eq('id', order.courier_company_id)
      .single();

    const token = courier?.api_credentials?.token;
    if (!token) {
      return NextResponse.json({ error: 'لا يوجد token صالح لشركة التوصيل' }, { status: 400 });
    }

    // 3. جلب الحالة من فانكس
    const statusResult = await vanexAdapter.getShipmentStatus(order.vanex_package_code, token);
    const newBunyanStatus = statusResult.bunyanStatus;
    const rawStatus = statusResult.rawStatus;

    // 4. تحديث الحالة في Supabase إذا تغيرت
    const updatePayload: Record<string, unknown> = {
      courier_raw_status: rawStatus,
    };

    // تحديث حالة بنيان فقط إذا تغيرت وكانت الحالة الجديدة غير نهائية حالياً
    const terminalStatuses = ['delivered', 'cancelled', 'return_confirmed'];
    if (newBunyanStatus !== order.status && !terminalStatuses.includes(order.status)) {
      if (newBunyanStatus === 'cancelled') {
        const cancelUrl = new URL('/api/orders/status', req.nextUrl.origin);
        await fetch(cancelUrl.toString(), {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            cookie: req.headers.get('cookie') || ''
          },
          body: JSON.stringify({ orderId: orderId, status: 'cancelled' }),
        });
        // الـ API سيتكفل بالـ status
      } else {
        updatePayload.status = newBunyanStatus;
      }
    }

    await supabaseAdmin
      .from('orders')
      .update(updatePayload)
      .eq('id', orderId);

    return NextResponse.json({
      success: true,
      rawStatus,
      bunyanStatus: newBunyanStatus,
      lastUpdate: statusResult.lastUpdate,
      statusChanged: updatePayload.status !== undefined,
    });
  } catch (err: any) {
    console.error('[POST /api/vanex/track] Error:', err);
    return NextResponse.json({ error: err.message || 'خطأ داخلي' }, { status: 500 });
  }
}
