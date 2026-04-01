// src/middleware.ts
// الوظيفة: حماية الصفحات — server-side route protection via Supabase SSR
// ✅ Performance: getUser() يُستدعى فقط للصفحات المحمية (وفّر ~150ms للصفحات العامة)

import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const PUBLIC_PATHS = ['/login', '/register'];
const SUPER_ADMIN_PATHS = ['/super-admin'];
const OWNER_ONLY_PATHS = ['/treasury', '/hr', '/analytics', '/partners', '/debts', '/settings'];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ═══ Early exit: static files و API routes (لا تحتاج middleware) ═══
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  // ═══ بناء Supabase Client مع cookie adapter ═══
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
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

  const isPublicPath = PUBLIC_PATHS.some((p) => pathname === p || pathname === '/');

  // ═══ Fast path: صفحات عامة — نتحقق من الجلسة فقط للتوجيه ═══
  if (isPublicPath) {
    // استخدام getSession بدلاً من getUser للصفحات العامة (أسرع — لا يتحقق من Auth Server)
    const { data: { session } } = await supabase.auth.getSession();
    
    if (session?.user) {
      const role = (session.user.user_metadata?.role as string) ?? 'owner';
      if (role === 'super_admin') {
        return NextResponse.redirect(new URL('/super-admin', request.url));
      }
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
    return response;
  }

  // ═══ Protected path: نستدعي getUser() فقط هنا (secure verification) ═══
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // ═══ RBAC ═══
  const userRole = (user.user_metadata?.role as string) ?? 'employee';
  const isSuperAdminPath = SUPER_ADMIN_PATHS.some((p) => pathname.startsWith(p));

  if (isSuperAdminPath && userRole !== 'super_admin') {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  const isOwnerOnlyPath = OWNER_ONLY_PATHS.some((p) => pathname.startsWith(p));
  if (isOwnerOnlyPath && userRole !== 'owner' && userRole !== 'super_admin') {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
