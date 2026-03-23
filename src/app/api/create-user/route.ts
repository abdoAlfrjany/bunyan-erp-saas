// src/app/api/create-user/route.ts
// الوظيفة: إنشاء حساب Supabase Auth لموظف أو شريك جديد
// يستخدم service_role key لتجاوز قيود الأمان
// المرجع: 1_SYSTEM_RULES.md — RBAC Integration for Partners & Employees

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password, tenantId, fullName, role, permissions, phone } = body;

    if (!email || !password || !tenantId || !fullName || !role) {
      return NextResponse.json({ error: 'بيانات ناقصة' }, { status: 400 });
    }

    // استخدام service_role key للعمليات الإدارية
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // 1. إنشاء المستخدم في Supabase Auth مع تضمين الدور في user_metadata للـ Middleware
    const { data: userData, error: userError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { role, tenant_id: tenantId },
    });

    if (userError || !userData.user) {
      return NextResponse.json(
        { error: userError?.message || 'فشل إنشاء حساب المستخدم' },
        { status: 400 }
      );
    }

    const userId = userData.user.id;

    // 2. إنشاء profile بالدور والصلاحيات المحددة
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .insert({
        id: userId,
        tenant_id: tenantId,
        full_name: fullName,
        email,
        role,
        permissions: permissions || {},
        phone: phone || null,
        is_active: true,
      });

    if (profileError) {
      // Rollback: حذف المستخدم إذا فشل إنشاء الـ profile
      await supabaseAdmin.auth.admin.deleteUser(userId);
      return NextResponse.json(
        { error: profileError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, userId });
  } catch (err: any) {
    console.error('[create-user API]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
