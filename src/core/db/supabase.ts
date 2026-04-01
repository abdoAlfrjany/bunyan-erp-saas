/* eslint-disable @typescript-eslint/no-explicit-any */
// src/core/db/supabase.ts
// الوظيفة: Supabase client — Singleton Pattern
// المرجع: _DOCS/1_SYSTEM_RULES.md — Database: Supabase (PostgreSQL + RLS)
// ⚠️ لا يُستخدم للعمليات المالية — فقط للقراءة والعرض
// ✅ Performance: Singleton يمنع إنشاء 8-15 instance لكل صفحة

import { createBrowserClient } from '@supabase/ssr';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

import { SupabaseClient } from '@supabase/supabase-js';

// ═══ Singleton: Browser Client ═══
let _browserClient: any = null;

/**
 * Supabase client للاستخدام في Client Components — Singleton
 * يعيد نفس الـ instance في كل استدعاء لتجنب تسريب الذاكرة والـ auth handshakes المتكررة
 */
export function createClient(): SupabaseClient<any, 'public', any> {
  if (_browserClient) return _browserClient;
  _browserClient = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  return _browserClient;
}

// ═══ Singleton: Service Role Client (Server-Only) ═══
let _serviceClient: any = null;

/**
 * Supabase Admin client للاستخدام في Server Components و API Routes فقط.
 * يستخدم service_role key — يتجاوز RLS.
 * ✅ Singleton: يعيد نفس الـ instance لتقليل cold-start latency
 */
export function createServiceClient(): SupabaseClient<any, 'public', any> {
  if (typeof window !== 'undefined') {
    throw new Error('createServiceClient can only be used on the server side to protect the service key.');
  }
  if (_serviceClient) return _serviceClient;
  _serviceClient = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
  return _serviceClient;
}

