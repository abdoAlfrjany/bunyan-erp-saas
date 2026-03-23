import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password, storeName, ownerName, phone, city } = body;
    if (!email || !password || !storeName || !ownerName) {
      return NextResponse.json({ error: 'بيانات ناقصة' }, { status: 400 });
    }
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );
    // 1. إنشاء حساب Auth مع تأكيد البريد وتضمين الدور في user_metadata للـ Middleware
    const { data: userData, error: userError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { role: 'owner' },
    });
    if (userError || !userData.user) {
      return NextResponse.json({ error: userError?.message || 'فشل إنشاء الحساب' }, { status: 400 });
    }
    const userId = userData.user.id;
    const planExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    // 2. إنشاء المتجر
    const { data: tenantData, error: tenantError } = await supabaseAdmin
      .from('tenants')
      .insert({
        name: storeName,
        owner_email: email,
        owner_name: ownerName,
        owner_phone: phone || '0900000000',
        city: city || 'طرابلس',
        plan: 'trial',
        plan_expires_at: planExpiresAt,
        is_active: true,
        billing_model: 'post_paid',
      })
      .select()
      .single();
    if (tenantError || !tenantData) {
      await supabaseAdmin.auth.admin.deleteUser(userId);
      return NextResponse.json({ error: 'فشل إنشاء المتجر' }, { status: 500 });
    }
    const tenantId = tenantData.id;
    // 3. إنشاء Profile
    const ownerPermissions = {
      inventory: { view: true, add: true, edit: true, delete: true, viewCostPrice: true },
      orders: { view: true, add: true, edit: true, delete: true, changeStatus: true, viewAll: true },
      delivery: { view: true, addShipment: true, manageCompanies: true, viewSettlements: true, addSettlement: true },
      treasury: { view: true, addTransaction: true },
      partners: { view: true, viewOwn: true },
      hr: { view: true, viewOwn: true },
      analytics: { view: true, viewFull: true },
      settings: { view: true, edit: true },
    };
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .insert({
        id: userId,
        tenant_id: tenantId,
        full_name: ownerName,
        email,
        role: 'owner',
        permissions: ownerPermissions,
        phone: phone || null,
        is_active: true,
      });
    if (profileError) {
      await supabaseAdmin.auth.admin.deleteUser(userId);
      return NextResponse.json({ error: 'فشل إنشاء الملف الشخصي' }, { status: 500 });
    }
    // 4. إنشاء الخزينة
    await supabaseAdmin.from('treasury_accounts').insert({
      tenant_id: tenantId,
      account_name: 'الخزينة الرئيسية',
      account_type: 'cash_in_hand',
      balance: 0,
    });
    return NextResponse.json({ success: true, userId, tenantId, ownerPermissions });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
