// src/app/api/diagnostics/schema/route.ts
// الوظيفة: جلب هيكل قاعدة البيانات (Schema) — Server-Side Only
// 🔒 محمي بـ requireAuth + يتطلب role === 'owner' | 'super_admin'

import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { requireAuth } from '@/core/server/auth';

// الجداول التي نراقبها
const MONITORED_TABLES = [
  'products', 'orders', 'customers', 'debts',
  'treasury_accounts', 'treasury_transactions',
  'employees', 'partners', 'profiles', 'couriers',
  'bunyan_cities', 'bunyan_regions', 'provider_geo_mappings',
];

// الـ Indexes الجوهرية المطلوبة — أي غياب = تحذير
const REQUIRED_INDEXES: { table: string; columns: string; label: string }[] = [
  { table: 'products',              columns: 'tenant_id',    label: 'فهرس tenant للمنتجات' },
  { table: 'orders',                columns: 'tenant_id',    label: 'فهرس tenant للطلبيات' },
  { table: 'orders',                columns: 'order_number', label: 'فهرس رقم الطلبية' },
  { table: 'treasury_transactions', columns: 'tenant_id',    label: 'فهرس tenant للمعاملات المالية' },
  { table: 'treasury_transactions', columns: 'account_id',   label: 'فهرس الحساب للمعاملات' },
  { table: 'customers',             columns: 'tenant_id',    label: 'فهرس tenant للعملاء' },
  { table: 'debts',                 columns: 'tenant_id',    label: 'فهرس tenant للديون' },
  { table: 'employees',             columns: 'tenant_id',    label: 'فهرس tenant للموظفين' },
  { table: 'partners',              columns: 'tenant_id',    label: 'فهرس tenant للشركاء' },
];

export async function GET() {
  try {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;

    if (auth.role !== 'owner' && auth.role !== 'super_admin') {
      return NextResponse.json(
        { error: 'غير مصرح — فحص Schema متاح للمالك فقط' },
        { status: 403 }
      );
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // ═══ 1. الأعمدة من information_schema ═══
    let columns: { table_name: string; column_name: string; data_type: string; is_nullable: string }[] = [];
    try {
      const { data: colData, error: colErr } = await supabase
        .rpc('get_schema_columns')
        .select('*');

      if (colErr || !colData) {
        // Fallback: استعلام مباشر على information_schema
        type SupabaseTableQuery = { from: (t: string) => { select: (c: string) => { eq: (k: string, v: string) => { in: (k: string, v: string[]) => Promise<{ data: unknown[] | null }> } } } };
        const { data: rawCols } = await (supabase as unknown as SupabaseTableQuery)
          .from('information_schema.columns')
          .select('table_name, column_name, data_type, is_nullable')
          .eq('table_schema', 'public')
          .in('table_name', MONITORED_TABLES);
        columns = (rawCols as unknown as { table_name: string; column_name: string; data_type: string; is_nullable: string }[]) || [];
      } else {
        columns = (colData as unknown as { table_name: string; column_name: string; data_type: string; is_nullable: string }[]) || [];
      }
    } catch {
      // استعلام SQL مباشر عبر execute_sql إن توفر
      columns = [];
    }

    // ═══ 2. الفهارس من pg_indexes ═══
    let indexes: { table: string; name: string; def: string; columns: string }[] = [];
    let missingIndexes: typeof REQUIRED_INDEXES = [];
    try {
      const { data: idxData } = await supabase
        .from('pg_indexes' as unknown as 'profiles')
        .select('tablename, indexname, indexdef')
        .eq('schemaname', 'public')
        .in('tablename', MONITORED_TABLES);

      if (idxData && Array.isArray(idxData)) {
        interface PgIndex { tablename: string; indexname: string; indexdef: string; }
        indexes = (idxData as unknown as PgIndex[]).map(i => ({
          table: i.tablename,
          name: i.indexname,
          def: i.indexdef,
          columns: i.indexdef.match(/\(([^)]+)\)/)?.[1] ?? '',
        }));

        // كشف الـ Indexes المفقودة
        missingIndexes = REQUIRED_INDEXES.filter(req => {
          return !indexes.some(idx =>
            idx.table === req.table &&
            idx.def.toLowerCase().includes(req.columns.toLowerCase())
          );
        });
      }
    } catch {
      indexes = [];
    }

    // ═══ 3. مقارنة الرقابة على أنواع الأعمدة الحساسة ═══
    // تحقق أن الأعمدة المالية هي numeric/decimal وليست integer
    const financialColumnGuard: { table: string; column: string; currentType: string; expectedType: string; ok: boolean }[] = [];
    const FINANCIAL_COLUMNS = [
      { table: 'treasury_accounts', column: 'balance' },
      { table: 'treasury_transactions', column: 'amount' },
      { table: 'debts', column: 'amount' },
      { table: 'debts', column: 'paid_amount' },
      { table: 'orders', column: 'total' },
      { table: 'partners', column: 'profit_percentage' },
    ];

    for (const fc of FINANCIAL_COLUMNS) {
      const colInfo = columns.find(c => c.table_name === fc.table && c.column_name === fc.column);
      if (colInfo) {
        const isNumeric = ['numeric', 'decimal', 'double precision', 'real', 'float8', 'money'].includes(
          colInfo.data_type.toLowerCase()
        );
        financialColumnGuard.push({
          table: fc.table,
          column: fc.column,
          currentType: colInfo.data_type,
          expectedType: 'numeric/decimal',
          ok: isNumeric,
        });
      }
    }

    // ═══ 4. إحصاءات الجداول (عدد الأعمدة لكل جدول) ═══
    const tableColumnCount: Record<string, number> = {};
    for (const col of columns) {
      tableColumnCount[col.table_name] = (tableColumnCount[col.table_name] || 0) + 1;
    }

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      columns,
      indexes,
      missingIndexes,
      financialColumnGuard,
      tableColumnCount,
      monitoredTables: MONITORED_TABLES,
      summary: {
        totalColumns: columns.length,
        totalIndexes: indexes.length,
        missingIndexesCount: missingIndexes.length,
        financialColumnsChecked: financialColumnGuard.length,
        financialColumnsOk: financialColumnGuard.filter(f => f.ok).length,
      },
    });
  } catch (err: unknown) {
    console.error('[API Schema Guard] Error:', (err as Error).message);
    return NextResponse.json(
      { success: false, error: (err as Error).message },
      { status: 500 }
    );
  }
}
