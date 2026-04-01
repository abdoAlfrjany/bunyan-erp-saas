// src/app/api/treasury/transactions/route.ts
// الميزة: مسار آمن لتسجيل الحركات المالية (ذري عبر RPC)
// 🔒 محمي بـ requireAuth + assertTenantMatch

import { createServiceClient } from '@/core/db/supabase';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, assertTenantMatch } from '@/core/server/auth';

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;

    const { 
      tenantId, accountId, transactionType, amount, description, 
      transactionDate, isTransfer, toAccountId 
    } = await req.json();

    if (!tenantId || !accountId || !transactionType || !amount) {
      return NextResponse.json({ success: false, error: 'Missing required parameters' }, { status: 400 });
    }

    const tenantError = assertTenantMatch(auth, tenantId);
    if (tenantError) return tenantError;

    const supabase = createServiceClient();

    const { data, error } = await supabase.rpc('create_treasury_transaction_atomic', {
      p_tenant_id: tenantId,
      p_account_id: accountId,
      p_transaction_type: transactionType,
      p_amount: amount,
      p_description: description,
      p_created_by: auth.userId, // ✅ UUID المستخدم المصادق
      p_transaction_date: transactionDate,
      p_is_transfer: !!isTransfer,
      p_to_account_id: toAccountId || null
    });

    if (error) {
      console.error('RPC Error (create_treasury_transaction_atomic):', (error as Error).message);
      return NextResponse.json({ success: false, error: (error as Error).message }, { status: 500 });
    }

    if (data && !data.success) {
      return NextResponse.json({ success: false, error: data.error }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error('API Error (treasury-transaction):', (err as Error).message);
    return NextResponse.json({ success: false, error: (err as Error).message }, { status: 500 });
  }
}
