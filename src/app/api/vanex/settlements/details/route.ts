// src/app/api/vanex/settlements/details/route.ts
// الوظيفة: جلب تفاصيل تسوية محددة من فانكس (للحصول على المبالغ الدقيقة)
// 🔒 محمي بـ requireAuth

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAuth } from '@/core/server/auth';
import { VanexAdapter } from '@/core/delivery/VanexAdapter';

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;

    const { searchParams } = new URL(req.url);
    const vanexId = searchParams.get('vanexId');
    const courierId = searchParams.get('courierId');

    if (!vanexId || !courierId) {
      return NextResponse.json({ error: 'vanexId و courierId مطلوبان' }, { status: 400 });
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // 1. جلب بيانات التوكين للشركة
    const { data: courier, error: courierError } = await supabaseAdmin
      .from('couriers')
      .select('api_credentials')
      .eq('id', courierId)
      .eq('tenant_id', auth.tenantId)
      .single();

    if (courierError || !courier) {
      return NextResponse.json({ error: 'الشركة غير موجودة أو غير مصرح لك' }, { status: 404 });
    }

    const token = courier.api_credentials?.token;
    if (!token) {
      return NextResponse.json({ error: 'الشركة غير مربوطة بـ API' }, { status: 400 });
    }

    // 2. جلب نسبة عمولة البنك للمستأجر
    const { data: tenant } = await supabaseAdmin
      .from('tenants')
      .select('bank_commission_percentage')
      .eq('id', auth.tenantId)
      .single();

    const commissionRate = (tenant?.bank_commission_percentage ?? 2.0) / 100;

    // 3. طلب التفاصيل من الـ Adapter (الذي يتصل بـ Vanex)
    const adapter = new VanexAdapter();
    const settlement = await adapter.getSettlementDetails(Number(vanexId), token, commissionRate);

    if (!settlement) {
      return NextResponse.json({ error: 'لم يتم العثور على تفاصيل التسوية في فانكس' }, { status: 404 });
    }

    // 3. تحديث القيمة في قاعدة البيانات لتصبح دقيقة نهائياً
    // نستخدم الـ Admin client لتحديث الحقول المالية التي تم جلبها الآن
    const { error: updateError } = await supabaseAdmin
      .from('courier_settlements')
      .update({
        delivery_fees: settlement.deliveryFees,
        bank_commission: settlement.bankCommission,
        net_amount: settlement.netAmount,
        package_count: settlement.packageCount,
        is_approximate: false, // لم تعد تقريبية
      })
      .eq('vanex_settlement_id', Number(vanexId))
      .eq('tenant_id', auth.tenantId)
      .eq('status', 'pending'); // لا نحدث إذا كانت قد طُبقت بالفعل

    if (updateError) {
      console.warn('[details-route] Could not update DB with exact amounts:', updateError.message);
    }

    return NextResponse.json({
      success: true,
      settlement: {
        ...settlement,
        isApproximate: false, 
        courierCompanyId: courierId,
      }
    });

  } catch (err: unknown) {
    console.error('[GET /api/vanex/settlements/details] Error:', err);
    return NextResponse.json({ error: (err as Error).message || 'خطأ داخلي' }, { status: 500 });
  }
}
