// src/app/api/couriers/route.ts
// 🔒 محمي بـ requireAuth + assertTenantMatch

import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { mapCourierToSupabaseRow } from '@/core/db/slices/coreSlice';
import { requireAuth, assertTenantMatch } from '@/core/server/auth';

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function POST(req: Request) {
  try {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;

    const courier = await req.json();
    if (!courier.tenantId || !courier.name) {
      return NextResponse.json({ success: false, error: 'Missing required data' }, { status: 400 });
    }

    const tenantError = assertTenantMatch(auth, courier.tenantId);
    if (tenantError) return tenantError;

    const supabase = getAdminClient();
    const row = mapCourierToSupabaseRow(courier);
    
    const { data, error } = await supabase
      .from('couriers')
      .insert([row])
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;

    const { id, ...updates } = await req.json();
    if (!id) return NextResponse.json({ success: false, error: 'Missing ID' }, { status: 400 });

    const supabase = getAdminClient();

    // تحقق من ملكية التنانت: اقرأ الـ courier أولاً
    const { data: existing } = await supabase
      .from('couriers')
      .select('tenant_id')
      .eq('id', id)
      .single();

    const tenantError = assertTenantMatch(auth, existing?.tenant_id);
    if (tenantError) return tenantError;

    const row = mapCourierToSupabaseRow(updates);
    const { error } = await supabase.from('couriers').update(row).eq('id', id);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ success: false, error: 'Missing ID' }, { status: 400 });

    const supabase = getAdminClient();

    // تحقق من الملكية قبل الحذف
    const { data: existing } = await supabase
      .from('couriers')
      .select('tenant_id')
      .eq('id', id)
      .single();

    const tenantError = assertTenantMatch(auth, existing?.tenant_id);
    if (tenantError) return tenantError;

    const { error } = await supabase.from('couriers').delete().eq('id', id);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
