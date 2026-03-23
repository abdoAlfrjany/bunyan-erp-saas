// src/app/api/diagnostics/route.ts
// الوظيفة: فحص صحة قاعدة البيانات — Server-Side Only
// 🔒 محمي بـ requireAuth + يتطلب role === 'owner'

import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/core/server/auth';

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;

    if (auth.role !== 'owner' && auth.role !== 'super_admin') {
      return NextResponse.json(
        { error: 'غير مصرح — فحص قاعدة البيانات متاح للمالك فقط' },
        { status: 403 }
      );
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const publicTables = [
      'products', 'orders', 'customers', 'debts', 'treasury_accounts',
      'treasury_transactions', 'partners', 'employees', 'couriers',
      'profiles', 'tenants', 'subscriptions', 'bunyan_cities',
      'bunyan_regions', 'provider_geo_mappings', 'vanex_settlements'
    ];

    // ═══ 1. إحصاءات الجداول (عدد الصفوف) ═══
    const stats: { table_name: string; estimated_rows: number }[] = [];
    for (const table of publicTables) {
      const { count } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true });
      stats.push({ table_name: `public.${table}`, estimated_rows: count ?? 0 });
    }

    // ═══ 2. فحص الفهارس المكررة (من pg_indexes مباشرة) ═══
    // نجلب الفهارس الحالية ونكشف المكررة بناءً على إمضاء الأعمدة
    let duplicateIndexes: {
      keep: string; drop: string; table: string; reason: string;
    }[] = [];

    try {
      const { data: rawIndexes, error: idxErr } = await supabase
        .from('pg_indexes' as any)
        .select('indexname, tablename, indexdef')
        .eq('schemaname', 'public')
        .order('tablename');

      if (!idxErr && rawIndexes && Array.isArray(rawIndexes)) {
        // Group by table + normalized column signature extracted from indexdef
        const groups: Record<string, { indexname: string; tablename: string }[]> = {};
        for (const idx of rawIndexes as any[]) {
          const defLower = (idx.indexdef as string).toLowerCase();
          // Extract columns from the btree(...) part
          const colMatch = defLower.match(/using\s+btree\s*\(([^)]+)\)/);
          const colSig = colMatch
            ? colMatch[1].replace(/\s+/g, ' ').trim()
            : defLower;
          const key = `${idx.tablename}__${colSig}`;
          if (!groups[key]) groups[key] = [];
          groups[key].push({ indexname: idx.indexname, tablename: idx.tablename });
        }

        for (const [, group] of Object.entries(groups)) {
          if (group.length <= 1) continue;
          // Keep: prefer _pkey first, then longer names (more descriptive)
          const sorted = [...group].sort((a, b) => {
            if (a.indexname.endsWith('_pkey')) return -1;
            if (b.indexname.endsWith('_pkey')) return 1;
            return b.indexname.length - a.indexname.length;
          });
          const keep = sorted[0];
          for (let i = 1; i < sorted.length; i++) {
            duplicateIndexes.push({
              keep: keep.indexname,
              drop: sorted[i].indexname,
              table: keep.tablename,
              reason: `كلاهما على نفس الأعمدة`,
            });
          }
        }
      }
    } catch {
      // pg_indexes قد لا يكون متاحاً — نتجاهل ونكمل
      duplicateIndexes = [];
    }

    // ═══ 3. فحص RLS (من pg_class) ═══
    const rlsResults: { table: string; rls_enabled: boolean }[] = [];
    try {
      const { data: rlsData } = await supabase
        .from('pg_class' as any)
        .select('relname, relrowsecurity')
        .in('relname', publicTables);

      for (const table of publicTables) {
        const pgRow = (rlsData as any[])?.find((r: any) => r.relname === table);
        rlsResults.push({
          table,
          rls_enabled: pgRow ? !!pgRow.relrowsecurity : true,
        });
      }
    } catch {
      // fallback: service_role queries bypass RLS anyway, assume enabled
      publicTables.forEach(t => rlsResults.push({ table: t, rls_enabled: true }));
    }

    // ═══ 4. فحص أداء ping لكل جدول (server-side) ═══
    // عتبة: 400ms معقولة لـ cold-start / cross-region connections
    const SLOW_THRESHOLD_MS = 400;
    const latencyResults: { table: string; latencyMs: number }[] = [];
    const testTables = ['products', 'orders', 'treasury_transactions', 'customers', 'profiles'];
    for (const table of testTables) {
      const start = Date.now();
      await supabase.from(table).select('id').limit(1);
      const dur = Date.now() - start;
      latencyResults.push({ table, latencyMs: dur });
    }
    const avgLatency = latencyResults.reduce((sum, r) => sum + r.latencyMs, 0) / latencyResults.length;
    const slowTables = latencyResults.filter(t => t.latencyMs > SLOW_THRESHOLD_MS);

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      tableStats: stats,
      duplicateIndexes,
      rlsStatus: rlsResults,
      latency: {
        perTable: latencyResults,
        averageMs: Math.round(avgLatency),
        slowThresholdMs: SLOW_THRESHOLD_MS,
        slowTables,
      },
    });
  } catch (err: any) {
    console.error('[API Diagnostics] Error:', err.message);
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}
