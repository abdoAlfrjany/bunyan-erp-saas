// src/core/db/supabase.ts
// الوظيفة: إنشاء Supabase client للاستخدام في جانب العميل
// المرجع: _DOCS/1_SYSTEM_RULES.md — Database: Supabase (PostgreSQL + RLS)
// ⚠️ لا يُستخدم للعمليات المالية — فقط للقراءة والعرض

import { createBrowserClient } from '@supabase/ssr';

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
