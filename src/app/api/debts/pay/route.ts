// src/app/api/debts/pay/route.ts
// الميزة: مسار آمن لسداد الديون بشكل ذري (Atomic)
// 🔒 محمي بـ requireAuth + assertTenantMatch

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAuth, assertTenantMatch } from '@/core/server/auth';

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;

    const { debtId, amount, tenantId, accountId, description } = await req.json();

    if (!debtId || !amount || !tenantId || !accountId) {
      return NextResponse.json({ error: 'بيانات السداد غير كاملة' }, { status: 400 });
    }

    const tenantError = assertTenantMatch(auth, tenantId);
    if (tenantError) return tenantError;

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // 1. جلب تفاصيل الدين للتأكد من النوع وهل هو إيراد أم مصروف للخزينة
    const { data: debt, error: fetchError } = await supabaseAdmin
      .from('debts')
      .select('*')
      .eq('id', debtId)
      .eq('tenant_id', tenantId)
      .single();

    if (fetchError || !debt) {
      return NextResponse.json({ error: 'لم يتم العثور على سجل الدين' }, { status: 404 });
    }

    const isIncome = ['customer', 'employee_advance', 'partner_advance', 'custody'].includes(debt.debt_category);
    const treasury_amount = isIncome ? Math.abs(amount) : -Math.abs(amount);

    // 2. تنفيذ العملية الذرية عبر RPC
    const { data: result, error: rpcError } = await supabaseAdmin.rpc('pay_debt_atomic', {
      p_debt_id: debtId,
      p_payment_amount: amount,
      p_treasury_amount: treasury_amount,
      p_tenant_id: tenantId,
      p_account_id: accountId,
      p_description: description || `سداد دين: ${debt.linked_entity_name}`,
      p_created_by: auth.userId, // ✅ UUID المستخدم المصادق
    });

    if (rpcError) {
      console.error('[Debts Pay API] RPC Error:', rpcError.message);
      return NextResponse.json({ error: rpcError.message }, { status: 500 });
    }

    if (result && !result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[POST /api/debts/pay] Error:', error);
    return NextResponse.json({ error: 'خطأ داخلي في النظام' }, { status: 500 });
  }
}
