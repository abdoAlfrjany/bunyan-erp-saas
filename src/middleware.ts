// src/middleware.ts
// الوظيفة: حماية الصفحات — server-side route protection
// المرجع: 1_SYSTEM_RULES.md — RBAC + حماية الطبقات
// القاعدة: /super-admin → super_admin فقط | /dashboard وكل tenant → مسجل دخول | /login,/register → عام

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// الصفحات العامة التي لا تحتاج مصادقة
const PUBLIC_PATHS = ['/login', '/register'];

// الصفحات التي تحتاج super_admin
const SUPER_ADMIN_PATHS = ['/super-admin'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // تجاهل الملفات الثابتة و API
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.includes('.') // ملفات ثابتة مثل favicon.ico
  ) {
    return NextResponse.next();
  }

  // قراءة بيانات المستخدم من cookie أو header
  // ⚠️ حالياً: نعتمد على cookie بسيط لأن الـ auth في localStorage
  // عند ربط Supabase: نستخدم Supabase session cookie
  const userCookie = request.cookies.get('erp_auth');
  const userData = userCookie ? safeParseJSON(userCookie.value) : null;

  const isPublicPath = PUBLIC_PATHS.some((p) => pathname === p || pathname === '/');
  const isSuperAdminPath = SUPER_ADMIN_PATHS.some((p) => pathname.startsWith(p));

  // الصفحات العامة: إذا مسجل دخول → redirect حسب الدور
  if (isPublicPath) {
    if (userData) {
      if (userData.role === 'super_admin') {
        return NextResponse.redirect(new URL('/super-admin', request.url));
      }
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
    return NextResponse.next();
  }

  // صفحات محمية: إذا ليس مسجل دخول → redirect login
  if (!userData) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // منع الموظفين والشركاء من الوصول لصفحة الإعدادات
  const isSettingsPath = pathname.startsWith('/settings');
  if (isSettingsPath && userData.role !== 'owner') {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  // منع غير المالك من الوصول للخزينة والموارد البشرية والتحليلات الكاملة
  const ownerOnlyPaths = ['/treasury', '/hr', '/analytics'];
  const isOwnerOnlyPath = ownerOnlyPaths.some((p) => pathname.startsWith(p));
  if (isOwnerOnlyPath && userData.role !== 'owner') {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  // صفحات Super Admin: يجب أن يكون super_admin
  if (isSuperAdminPath && userData.role !== 'super_admin') {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return NextResponse.next();
}

function safeParseJSON(str: string): { role?: string } | null {
  try {
    return JSON.parse(decodeURIComponent(str));
  } catch {
    return null;
  }
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
