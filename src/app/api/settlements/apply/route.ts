// src/app/api/settlements/apply/route.ts
// الوظيفة: تطبيق تسوية على الخزينة بشكل ذري ومنع التطبيق المزدوج
// 🔒 محمي بـ requireAuth + assertTenantMatch

import { createClient } from '@supabase/supabase-js';
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

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // 1. جلب التسوية والتحقق من حالتها
    const { data: settlement, error: fetchError } = await supabase
      .from('courier_settlements')
      .select('*')
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

    // 2. جلب حساب الخزينة المناسب
    const { data: treasuryAccount } = await supabase
      .from('treasury_accounts')
      .select('id, balance, account_type')
      .eq('tenant_id', tenantId)
      .eq('account_type', settlement.target_account_type)
      .single();

    if (!treasuryAccount) {
      const accountLabel = settlement.target_account_type === 'bank' ? 'مصرفية' : 'نقدية';
      return NextResponse.json({
        success: false,
        error: `لا توجد خزينة ${accountLabel} — يرجى إنشاؤها من صفحة الخزينة`,
      }, { status: 400 });
    }

    // 3. تسجيل الحركة المالية ذرياً
    const netAmount = Math.abs(settlement.net_amount);
    const description = `تسوية فانكس #${settlement.settlement_number} — ${settlement.package_count} شحنة`;

    const { data: rpcResult, error: rpcError } = await supabase.rpc('create_treasury_transaction_atomic', {
      p_tenant_id: tenantId,
      p_account_id: treasuryAccount.id,
      p_transaction_type: 'sale',
      p_amount: netAmount,
      p_description: description,
      p_created_by: auth.userId,
      p_transaction_date: new Date().toISOString().split('T')[0],
      p_is_transfer: false,
      p_to_account_id: null,
    });

    if (rpcError || (rpcResult && rpcResult.success === false)) {
      const errorMsg = rpcError?.message || rpcResult?.error || 'Unknown RPC error';
      console.error('[settlements/apply] Treasury RPC error:', errorMsg);
      return NextResponse.json({ success: false, error: `خطأ في تسجيل الحركة المالية: ${errorMsg}` }, { status: 500 });
    }

    // 4. تعيين التسوية كـ "مطبّقة" (Audit Trail: من الذي طبق ومع من ارتبطت)
    const { error: updateError } = await supabase
      .from('courier_settlements')
      .update({
        status: 'applied',
        applied_at: new Date().toISOString(),
        applied_by: auth.userId, // 🟢 تم إضافة عمود المستخدم الذي طبق
        treasury_tx_id: rpcResult?.tx_id, // 🟢 تم التفعيل وتخزين رقم الحركة
      })
      .eq('id', settlementId)
      .eq('status', 'pending'); // 🔒 حارس التطبيق المزدوج — الخط الثاني

    if (updateError) {
      console.error('[settlements/apply] Update status error:', updateError.message);
    }

    return NextResponse.json({
      success: true,
      netAmount,
      accountType: settlement.target_account_type,
      settlementNumber: settlement.settlement_number,
    });
  } catch (err: unknown) {
    console.error('[POST /api/settlements/apply] Error:', (err as Error).message);
    return NextResponse.json({ success: false, error: (err as Error).message }, { status: 500 });
  }
}
