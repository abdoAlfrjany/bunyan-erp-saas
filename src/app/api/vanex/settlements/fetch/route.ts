// src/app/api/vanex/settlements/fetch/route.ts
// الوظيفة: جلب التسويات من فانكس وحفظها في قاعدة البيانات
// 🔒 محمي بـ requireAuth

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAuth } from '@/core/server/auth';
import { VanexAdapter } from '@/core/delivery/VanexAdapter';

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;

    const { courierId } = await req.json();
    if (!courierId) {
      return NextResponse.json({ error: 'courierId مطلوب' }, { status: 400 });
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // 1. جلب بيانات الشركة والتوكين
    const { data: courier, error: courierError } = await supabaseAdmin
      .from('couriers')
      .select('id, api_credentials, api_provider')
      .eq('id', courierId)
      .eq('tenant_id', auth.tenantId)
      .single();

    if (courierError || !courier) {
      return NextResponse.json({ error: 'الشركة غير موجودة' }, { status: 404 });
    }

    const token = courier.api_credentials?.token;
    if (!token) {
      return NextResponse.json({ error: 'الشركة غير مربوطة بـ API — يرجى تسجيل الدخول لحساب الشركة أولاً' }, { status: 400 });
    }

    // 2. جلب التسويات من فانكس
    const adapter = new VanexAdapter();
    const settlements = await adapter.getSettlements(token, 'approved');

    if (!settlements || settlements.length === 0) {
      return NextResponse.json({ success: true, inserted: 0, skipped: 0, message: 'لا توجد تسويات جديدة من فانكس' });
    }

    // 3. حفظ التسويات في قاعدة البيانات (UNIQUE constraint يمنع التكرار تلقائياً)
    const rows = settlements.map((s) => ({
      tenant_id: auth.tenantId,
      courier_company_id: courierId,
      vanex_settlement_id: s.vanexSettlementId,
      settlement_number: s.settlementNumber,
      total_amount: s.totalAmount,
      delivery_fees: s.deliveryFees,
      bank_commission: s.bankCommission,
      net_amount: s.netAmount,
      payment_method: s.paymentMethod,
      target_account_type: s.targetAccountType,
      status: 'pending',
      package_count: s.packageCount,
      is_approximate: !!s.isApproximate,
      created_at: s.createdAt || new Date().toISOString(),
    }));

    const { data: inserted, error: insertError } = await supabaseAdmin
      .from('vanex_settlements')
      .upsert(rows, {
        onConflict: 'tenant_id,vanex_settlement_id',
        ignoreDuplicates: true, // تجاهل المكررة — لا نُحدّث المطبّقة!
      })
      .select('id');

    if (insertError) {
      console.error('[fetch-settlements] DB insert error:', insertError.message);
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    const insertedCount = inserted?.length ?? 0;
    const skippedCount = settlements.length - insertedCount;

    return NextResponse.json({
      success: true,
      inserted: insertedCount,
      skipped: skippedCount,
      total: settlements.length,
    });
  } catch (err: any) {
    console.error('[POST /api/vanex/settlements/fetch] Error:', err);
    return NextResponse.json({ error: err.message || 'خطأ داخلي' }, { status: 500 });
  }
}
