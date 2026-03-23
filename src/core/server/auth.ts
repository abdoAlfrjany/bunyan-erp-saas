// src/core/server/auth.ts
// الوظيفة: مساعد مصادقة مشترك لجميع مسارات API
// يتحقق من جلسة المستخدم عبر Supabase SSR ويعيد بيانات المستخدم أو خطأ

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export interface AuthResult {
  userId: string;
  tenantId: string;
  role: string;
}

/**
 * يتحقق من جلسة المستخدم من الـ cookies.
 * يعيد AuthResult عند النجاح، أو NextResponse خطأ عند الفشل.
 *
 * الاستخدام:
 *   const auth = await requireAuth(req);
 *   if (auth instanceof NextResponse) return auth;
 *   // auth.userId, auth.tenantId, auth.role متاحة هنا
 */
export async function requireAuth(): Promise<AuthResult | NextResponse> {
  try {
    const cookieStore = await cookies();

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            // في API routes لا نحتاج لتعيين cookies (القراءة فقط)
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              );
            } catch {
              // يُتجاهل في Server Components
            }
          },
        },
      }
    );

    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
      const errMsg = error?.message || 'No user found';
      console.error('[requireAuth] Authentication Failed:', errMsg);
      return NextResponse.json(
        { error: `غير مصرح — ${errMsg}` },
        { status: 401 }
      );
    }

    const tenantId = user.user_metadata?.tenant_id as string | undefined;
    const role = user.user_metadata?.role as string | undefined;

    if (!tenantId) {
      return NextResponse.json(
        { error: 'بيانات المستخدم غير مكتملة — tenant_id مفقود' },
        { status: 403 }
      );
    }

    return {
      userId: user.id,
      tenantId,
      role: role || 'employee',
    };
  } catch (err: any) {
    console.error('[requireAuth] Exception:', err.message);
    return NextResponse.json(
      { error: 'خطأ داخلي في التحقق من الهوية' },
      { status: 500 }
    );
  }
}

/**
 * يتحقق من أن tenantId في body الطلب يتطابق مع tenant المستخدم.
 * يحمي من IDOR attacks حيث يرسل المستخدم tenantId خاص بمستأجر آخر.
 */
export function assertTenantMatch(
  auth: AuthResult,
  requestedTenantId: string | undefined
): NextResponse | null {
  if (!requestedTenantId) {
    return NextResponse.json(
      { error: 'tenantId مفقود في الطلب' },
      { status: 400 }
    );
  }
  // super_admin مسموح له بالوصول لأي tenant
  if (auth.role === 'super_admin') return null;

  if (auth.tenantId !== requestedTenantId) {
    return NextResponse.json(
      { error: 'غير مصرح — لا يمكنك الوصول لبيانات مستأجر آخر' },
      { status: 403 }
    );
  }
  return null;
}
