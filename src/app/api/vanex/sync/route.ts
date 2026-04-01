/* eslint-disable @typescript-eslint/no-explicit-any */
// src/app/api/vanex/sync/route.ts
// الوظيفة: مزامنة حالات كل الطلبيات النشطة مع فانكس
// 🔒 محمي بـ requireAuth

import { NextResponse } from 'next/server';
import { createServiceClient } from '@/core/db/supabase';
import { requireAuth } from '@/core/server/auth';
import { vanexAdapter } from '@/core/delivery/VanexAdapter';
import { applyCancelSideEffects } from '@/core/delivery/cancelOrderSideEffects';

export async function POST() {
  try {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;

    const supabaseAdmin = createServiceClient();

    // 1. جلب كل الطلبيات النشطة المرسلة لفانكس لهذا التاجر
    const { data: orders, error: fetchError } = await supabaseAdmin
      .from('orders')
      .select('id, courier_tracking_code, courier_package_id, courier_company_id, status, courier_raw_status, tenant_id, total, delivery_type, items, order_number, prepaid_amount')
      .eq('tenant_id', auth.tenantId)
      .not('courier_tracking_code', 'is', null)
      .not('status', 'in', '(delivered,cancelled,return_confirmed)');

    if (fetchError || !orders || orders.length === 0) {
      return NextResponse.json({ success: true, synced: 0, message: 'لا توجد طلبيات تحتاج مزامنة' });
    }

    // 2. تجميع tokens الشركات
    const courierIds = Array.from(new Set(orders.map((o: any) => o.courier_company_id).filter(Boolean)));
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

    // 3. مزامنة كل طلبية باستخدام نظام الـ Chunking لتجنب 504 Timeout
    let synced = 0;
    const errors: string[] = [];
    const terminalStatuses = ['delivered', 'cancelled', 'return_confirmed'];
    const CHUNK_SIZE = 15; // معالجة 15 طلبية معاً كحد أقصى لتجنب إغراق السيرفر أو Rate Limits

    for (let i = 0; i < orders.length; i += CHUNK_SIZE) {
      const chunk = orders.slice(i, i + CHUNK_SIZE);
      
      const promises = chunk.map(async (order: any) => {
        if (!order.courier_tracking_code || !order.courier_company_id) return;

        const token = tokenMap[order.courier_company_id];
        if (!token) {
          errors.push(`${order.id}: لا يوجد token`);
          return;
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
              if (statusResult.bunyanStatus === 'cancelled' || statusResult.bunyanStatus === 'return_confirmed') {
                // استخدام الدالة المشتركة بدلاً من fetch() الداخلي
                updatePayload.status = statusResult.bunyanStatus;
                await supabaseAdmin.from('orders').update(updatePayload).eq('id', order.id);

                await applyCancelSideEffects(supabaseAdmin, order, {
                  newStatus: statusResult.bunyanStatus as 'cancelled' | 'return_confirmed',
                  userId: auth.userId,
                  cancelVanexShipment: false, // فانكس أبلغتنا بالإلغاء — لا نلغي منها
                });
              } else {
                updatePayload.status = statusResult.bunyanStatus;
                await supabaseAdmin.from('orders').update(updatePayload).eq('id', order.id);
              }
            } else {
              await supabaseAdmin.from('orders').update(updatePayload).eq('id', order.id);
            }

            synced++;
          }
        } catch (err) {
          errors.push(`${order.id}: ${err instanceof Error ? (err as Error).message : 'خطأ'}`);
        }
      });

      // الانتظار حتى تنتهي الحزمة بالكامل לפני الانتقال للتي تليها (Safe Concurrency)
      await Promise.allSettled(promises);
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
