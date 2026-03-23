// src/middleware.ts
// الوظيفة: حماية الصفحات — server-side route protection via Supabase SSR
// الأمان: نعتمد على supabase.auth.getUser() بدلاً من cookie عادي قابل للتزوير
// القاعدة: /super-admin → super_admin فقط | /dashboard → مسجل دخول | /login,/register → عام

import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// الصفحات العامة التي لا تحتاج مصادقة
const PUBLIC_PATHS = ['/login', '/register'];

// الصفحات التي تحتاج super_admin فقط
const SUPER_ADMIN_PATHS = ['/super-admin'];

// الصفحات التي يجوز للمالك فقط الوصول إليها
const OWNER_ONLY_PATHS = ['/treasury', '/hr', '/analytics', '/partners', '/debts', '/settings'];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // تجاهل الملفات الثابتة و API routes
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  // ══ بناء response مؤقت لتمرير الكوكيز ══
  let response = NextResponse.next({ request });

  // ══ إنشاء Supabase Client مع cookie adapter آمن ══
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          // تحديث الكوكيز في الطلب والرد معاً (لضمان تجديد الـ session)
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, {
              ...options,
              sameSite: 'lax',
              secure: process.env.NODE_ENV === 'production',
            })
          );
        },
      },
    }
  );

  // ══ التحقق من الجلسة عبر Supabase (JWT موقّع — لا يمكن تزويره) ══
  // getUser() يُرسل طلب تحقق مباشر لـ Supabase Auth Server تضمن الصحة
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isPublicPath = PUBLIC_PATHS.some((p) => pathname === p || pathname === '/');
  const isSuperAdminPath = SUPER_ADMIN_PATHS.some((p) => pathname.startsWith(p));

  // ── الصفحات العامة (login / register) ──
  if (isPublicPath) {
    if (user) {
      // المستخدم مسجّل → توجيه حسب دوره
      // نجلب الدور من الـ user_metadata أو نحوّله للـ dashboard
      const role = (user.user_metadata?.role as string) ?? 'owner';
      if (role === 'super_admin') {
        return NextResponse.redirect(new URL('/super-admin', request.url));
      }
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
    return response;
  }

  // ── الصفحات المحمية: إذا لم يتحقق المستخدم → إعادة توجيه لتسجيل الدخول ──
  if (!user) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // ══ التحقق من الدور (RBAC) — نقرأ الدور من user_metadata المخزن في Supabase ══
  // يتم تعيين user_metadata.role عند إنشاء الـ Profile في /api/register
  const userRole = (user.user_metadata?.role as string) ?? 'employee';

  // حماية صفحة /super-admin
  if (isSuperAdminPath && userRole !== 'super_admin') {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  // حماية الصفحات الخاصة بالمالك فقط
  const isOwnerOnlyPath = OWNER_ONLY_PATHS.some((p) => pathname.startsWith(p));
  if (isOwnerOnlyPath && userRole !== 'owner' && userRole !== 'super_admin') {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * يطابق كل المسارات عدا:
     * - _next/static (ملفات البناء الثابتة)
     * - _next/image (تحسين الصور)
     * - favicon.ico
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
