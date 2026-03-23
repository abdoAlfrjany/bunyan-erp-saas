// src/core/db/supabase.ts
// الوظيفة: إنشاء Supabase client للاستخدام في جانب العميل
// المرجع: _DOCS/1_SYSTEM_RULES.md — Database: Supabase (PostgreSQL + RLS)
// ⚠️ لا يُستخدم للعمليات المالية — فقط للقراءة والعرض

import { createBrowserClient } from '@supabase/ssr';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

/**
 * Supabase client للاستخدام في Client Components
 * القيم تُقرأ من environment variables
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

/**
 * Supabase Admin client للاستخدام في Server Components و API Routes فقط.
 * يستخدم service_role key — يتجاوز RLS.
 * ✅ تم الإصلاح: يستخدم createClient من @supabase/supabase-js بدلاً من createBrowserClient
 */
export function createServiceClient() {
  if (typeof window !== 'undefined') {
    throw new Error('createServiceClient can only be used on the server side to protect the service key.');
  }
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

