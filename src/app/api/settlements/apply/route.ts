// src/app/api/settlements/apply/route.ts
// الوظيفة: تطبيق تسوية على الخزينة — 3 معاملات مفصلة (إيراد + عمولة توصيل + عمولة بنك)
// يستخدم apply_settlement_atomic RPC الذرية
// 🔒 محمي بـ requireAuth + assertTenantMatch

import { createServiceClient } from '@/core/db/supabase';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, assertTenantMatch } from '@/core/server/auth';

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;

    const { settlementId, tenantId } = await req.json();

    if (!settlementId || !tenantId) {
      return NextResponse.json({ success: false, error: 'settlementId و tenantId مطلوبان' }, { status: 400 });
    }

    // 🔒 تحقق من الملكية
    const tenantError = assertTenantMatch(auth, tenantId);
    if (tenantError) return tenantError;

    const supabase = createServiceClient();

    // 1. فحص سريع — هل التسوية موجودة وليست مطبّقة؟
    const { data: settlement, error: fetchError } = await supabase
      .from('courier_settlements')
      .select('id, status, settlement_number, net_amount, target_account_type, package_count')
      .eq('id', settlementId)
      .eq('tenant_id', tenantId)
      .single();

    if (fetchError || !settlement) {
      return NextResponse.json({ success: false, error: 'التسوية غير موجودة' }, { status: 404 });
    }

    // 🔒 حارس التطبيق المزدوج — الخط الأول
    if (settlement.status === 'applied') {
      return NextResponse.json({
        success: false,
        error: `هذه التسوية مُطبَّقة بالفعل — لا يمكن تطبيقها مرة ثانية!`,
      }, { status: 409 });
    }

    // 2. تطبيق ذري عبر الـ RPC (يُنشئ 3 معاملات خزينة + يقفل الصفوف بـ FOR UPDATE)
    const { data: rpcResult, error: rpcError } = await supabase.rpc('apply_settlement_atomic', {
      p_settlement_id: settlementId,
      p_tenant_id: tenantId,
      p_created_by: auth.userId,
    });

    if (rpcError) {
      console.error('[settlements/apply] RPC error:', rpcError.message);
      return NextResponse.json({ success: false, error: `خطأ في تطبيق التسوية: ${rpcError.message}` }, { status: 500 });
    }

    if (rpcResult && rpcResult.success === false) {
      return NextResponse.json({ success: false, error: rpcResult.error }, { status: 409 });
    }

    return NextResponse.json({
      success: true,
      netAmount: settlement.net_amount,
      accountType: settlement.target_account_type,
      settlementNumber: settlement.settlement_number,
    });
  } catch (err: unknown) {
    console.error('[POST /api/settlements/apply] Error:', (err as Error).message);
    return NextResponse.json({ success: false, error: (err as Error).message }, { status: 500 });
  }
}
