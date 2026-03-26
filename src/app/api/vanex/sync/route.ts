// src/app/api/vanex/sync/route.ts
// الوظيفة: مزامنة حالات كل الطلبيات النشطة مع فانكس
// 🔒 محمي بـ requireAuth

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAuth } from '@/core/server/auth';
import { vanexAdapter } from '@/core/delivery/VanexAdapter';

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // 1. جلب كل الطلبيات النشطة المرسلة لفانكس لهذا التاجر
    const { data: orders, error: fetchError } = await supabaseAdmin
      .from('orders')
      .select('id, courier_tracking_code, courier_package_id, courier_company_id, status, courier_raw_status, tenant_id')
      .eq('tenant_id', auth.tenantId)
      .not('courier_tracking_code', 'is', null)
      .not('status', 'in', '(delivered,cancelled,return_confirmed)');

    if (fetchError || !orders || orders.length === 0) {
      return NextResponse.json({ success: true, synced: 0, message: 'لا توجد طلبيات تحتاج مزامنة' });
    }

    // 2. تجميع tokens الشركات (لتجنب جلبها لكل طلبية)
    const courierIds = Array.from(new Set(orders.map(o => o.courier_company_id).filter(Boolean)));
    const { data: couriers } = await supabaseAdmin
      .from('couriers')
      .select('id, api_credentials')
      .in('id', courierIds);

    const tokenMap: Record<string, string> = {};
    for (const c of couriers || []) {
      if (c.api_credentials?.token) {
        tokenMap[c.id] = c.api_credentials.token;
      }
    }

    // 3. مزامنة كل طلبية
    let synced = 0;
    const errors: string[] = [];
    const terminalStatuses = ['delivered', 'cancelled', 'return_confirmed'];

    for (const order of orders) {
      if (!order.courier_tracking_code || !order.courier_company_id) continue;

      const token = tokenMap[order.courier_company_id];
      if (!token) {
        errors.push(`${order.id}: لا يوجد token`);
        continue;
      }

      try {
        const statusResult = await vanexAdapter.getShipmentStatus(order.courier_tracking_code, token);
        
        // تحديث فقط إذا تغيرت الحالة
        if (statusResult.rawStatus !== order.courier_raw_status) {
          const updatePayload: Record<string, unknown> = {
            courier_raw_status: statusResult.rawStatus,
          };

          // تحديث حالة بنيان إذا لم تكن حالة نهائية
          if (!terminalStatuses.includes(order.status) && statusResult.bunyanStatus !== order.status) {
            if (statusResult.bunyanStatus === 'cancelled') {
              // استدعاء API الإلغاء لتشغيل التأثيرات الجانبية (إرجاع مخزون/ماليات)
              const cancelUrl = new URL('/api/orders/status', req.nextUrl.origin);
              await fetch(cancelUrl.toString(), {
                method: 'PATCH',
                headers: {
                  'Content-Type': 'application/json',
                  cookie: req.headers.get('cookie') || ''
                },
                body: JSON.stringify({ orderId: order.id, status: 'cancelled' }),
              });
              // لن نُضيف status لـ updatePayload لأن الـ API يتكفل بذلك
            } else {
              updatePayload.status = statusResult.bunyanStatus;
            }
          }

          await supabaseAdmin
            .from('orders')
            .update(updatePayload)
            .eq('id', order.id);

          synced++;
        }
      } catch (err) {
        errors.push(`${order.id}: ${err instanceof Error ? (err as Error).message : 'خطأ'}`);
      }
    }

    return NextResponse.json({
      success: true,
      synced,
      total: orders.length,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (err: unknown) {
    console.error('[POST /api/vanex/sync] Error:', err);
    return NextResponse.json({ error: (err as Error).message || 'خطأ داخلي' }, { status: 500 });
  }
}
