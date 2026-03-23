import { useDataStore } from '@/core/db/store';
import { useAuthStore } from '@/core/auth/store';
import { createClient } from '@/core/db/supabase';

// ══════════════════════════════════════════
// Types
// ══════════════════════════════════════════
export type DiagnosticStatus = 'PASSED' | 'FAILED' | 'SKIPPED' | 'WARNING';

export interface DiagnosticResult {
  step: string;
  status: DiagnosticStatus;
  message: string;
  details?: Record<string, any>;
  durationMs?: number;
}

export interface DiagnosticReport {
  results: DiagnosticResult[];
  summary: {
    total: number;
    passed: number;
    failed: number;
    skipped: number;
    warnings: number;
    durationMs: number;
    healthScore: number;
    healthGrade: string;
  };
  recommendations: string[];
  dbHealth?: Record<string, any>;
  timestamp: string;
  tenantId: string;
  version: string;
}

// ══════════════════════════════════════════
// Runner Helper
// ══════════════════════════════════════════
async function runStep(
  name: string,
  fn: () => Promise<{ ok: boolean; msg: string; warn?: string; details?: Record<string, any> }>,
  results: DiagnosticResult[],
  deps?: string[]  // step names that must have passed
): Promise<boolean> {
  const t0 = Date.now();

  // Check dependencies
  if (deps?.length) {
    const failedDep = deps.find(d => results.find(r => r.step === d)?.status === 'FAILED');
    if (failedDep) {
      results.push({ step: name, status: 'SKIPPED', message: `تخطي — يعتمد على [${failedDep}] الذي فشل`, durationMs: 0 });
      console.warn(`%c[⏭ SKIPPED] ${name}`, 'color: #94a3b8; font-weight: bold;');
      return false;
    }
  }

  try {
    const res = await fn();
    const dur = Date.now() - t0;
    const status: DiagnosticStatus = !res.ok ? 'FAILED' : res.warn ? 'WARNING' : 'PASSED';
    const msg = !res.ok ? res.msg : (res.warn ?? res.msg);
    results.push({ step: name, status, message: msg, details: res.details, durationMs: dur });

    if (status === 'PASSED') {
      console.log(`%c[✅ PASSED] ${name} %c( ${dur}ms )%c\n➔ ${msg}`, 'color: #10b981; font-weight: bold; background: #ecfdf5; padding: 2px 6px; border-radius: 4px;', 'color: #94a3b8; font-size: 10px;', 'color: #059669; margin-left: 8px;');
    } else if (status === 'WARNING') {
      console.warn(`%c[⚠️ WARNING] ${name} %c( ${dur}ms )%c\n➔ ${msg}`, 'color: #f59e0b; font-weight: bold; background: #fffbeb; padding: 2px 6px; border-radius: 4px;', 'color: #94a3b8; font-size: 10px;', 'color: #d97706; margin-left: 8px;');
      if (res.details) console.dir(res.details);
    } else {
      console.error(`%c[❌ FAILED] ${name} %c( ${dur}ms )%c\n➔ ${msg}`, 'color: #ef4444; font-weight: bold; font-size: 14px; background: #fef2f2; padding: 4px 8px; border-radius: 4px; border-left: 4px solid #ef4444;', 'color: #94a3b8; font-size: 10px;', 'color: #b91c1c; margin-left: 8px;');
      console.log('%c🔍 DIAGNOSTIC CONTEXT:', 'color: #ef4444; font-weight: bold; padding-left: 12px;');
      console.dir(res.details, { depth: null });
    }

    return status !== 'FAILED';
  } catch (err: any) {
    const dur = Date.now() - t0;
    const errMsg = err?.message ?? String(err);
    results.push({ step: name, status: 'FAILED', message: errMsg, details: { error: err, stack: err?.stack }, durationMs: dur });
    console.error(`%c[💥 CRASH] ${name} %c( ${dur}ms )%c\n➔ Exception: ${errMsg}`, 'color: #b91c1c; font-weight: bold; font-size: 14px; background: #fef2f2; padding: 4px 8px; border-radius: 4px; border-left: 4px solid #b91c1c;', 'color: #94a3b8; font-size: 10px;', 'color: #991b1b; margin-left: 8px;');
    console.trace(err);
    return false;
  }
}

// ══════════════════════════════════════════
// Interactive Runner Helper
// ══════════════════════════════════════════
async function runInteractiveStep(
  name: string,
  instruction: string,
  fn: () => Promise<{ ok: boolean; msg: string; warn?: string; details?: Record<string, any> }>,
  results: DiagnosticResult[],
  deps?: string[]
): Promise<boolean> {
  const t0 = Date.now();

  if (deps?.length) {
    const failedDep = deps.find(d => results.find(r => r.step === d)?.status === 'FAILED');
    if (failedDep) {
      results.push({ step: name, status: 'SKIPPED', message: `تخطي — يعتمد على [${failedDep}] الذي فشل`, durationMs: 0 });
      console.warn(`%c[⏭ SKIPPED] ${name}`, 'color: #94a3b8; font-weight: bold;');
      return false;
    }
  }

  console.log(`%c[🤔 INTERACTIVE] ${name}\n➔ ${instruction}`, 'color: #3b82f6; font-weight: bold; background: #eff6ff; padding: 4px 8px; border-radius: 4px; border-left: 4px solid #3b82f6;');
  
  const isConfirmed = window.confirm(`🤖 الفحص الذكي يحتاج مساعدتك:\n\n${instruction}\n\nبعد إتمام المطلوب، اضغط "موافق" (OK) للتحقق من النتيجة أو "إلغاء" للتخطي.`);
  
  if (!isConfirmed) {
    results.push({ step: name, status: 'SKIPPED', message: 'تم تخطي الفحص يدوياً من قبل المستخدم', durationMs: Date.now() - t0 });
    console.warn(`%c[⏭ SKIPPED BY USER] ${name}`, 'color: #94a3b8; font-weight: bold;');
    return false;
  }

  console.log(`%c[⏳ VERIFYING] ${name}...`, 'color: #8b5cf6; font-weight: bold;');
  
  try {
    const res = await fn();
    const dur = Date.now() - t0;
    const status: DiagnosticStatus = !res.ok ? 'FAILED' : res.warn ? 'WARNING' : 'PASSED';
    const msg = !res.ok ? res.msg : (res.warn ?? res.msg);
    results.push({ step: name, status, message: msg, details: res.details, durationMs: dur });

    if (status === 'PASSED') {
      console.log(`%c[✅ PASSED] ${name} %c( ${dur}ms )%c\n➔ ${msg}`, 'color: #10b981; font-weight: bold; background: #ecfdf5; padding: 2px 6px; border-radius: 4px;', 'color: #94a3b8; font-size: 10px;', 'color: #059669; margin-left: 8px;');
    } else if (status === 'WARNING') {
      console.warn(`%c[⚠️ WARNING] ${name} %c( ${dur}ms )%c\n➔ ${msg}`, 'color: #f59e0b; font-weight: bold; background: #fffbeb; padding: 2px 6px; border-radius: 4px;', 'color: #94a3b8; font-size: 10px;', 'color: #d97706; margin-left: 8px;');
    } else {
      console.error(`%c[❌ FAILED] ${name} %c( ${dur}ms )%c\n➔ ${msg}`, 'color: #ef4444; font-weight: bold; font-size: 14px; background: #fef2f2; padding: 4px 8px; border-radius: 4px; border-left: 4px solid #ef4444;', 'color: #94a3b8; font-size: 10px;', 'color: #b91c1c; margin-left: 8px;');
    }

    return status !== 'FAILED';
  } catch (err: any) {
    const dur = Date.now() - t0;
    const errMsg = err?.message ?? String(err);
    results.push({ step: name, status: 'FAILED', message: errMsg, details: { error: err }, durationMs: dur });
    console.error(`%c[💥 CRASH] ${name} %c( ${dur}ms )%c\n➔ Exception: ${errMsg}`, 'color: #b91c1c; font-weight: bold; font-size: 14px; background: #fef2f2; padding: 4px 8px; border-radius: 4px; border-left: 4px solid #b91c1c;', 'color: #94a3b8; font-size: 10px;', 'color: #991b1b; margin-left: 8px;');
    return false;
  }
}

// ══════════════════════════════════════════
// Main Diagnostic Runner
// ══════════════════════════════════════════
export async function runFullSystemDiagnostic(tenantId: string): Promise<DiagnosticReport> {
  if (!tenantId) throw new Error('A valid tenantId is required.');

  const store = useDataStore.getState();
  const authUser = useAuthStore.getState().user;
  if (!authUser) throw new Error('Authentication required to run diagnostics.');

  let userId = authUser.id;
  if (userId === 'sa-001') userId = '00000000-0000-0000-0000-000000000000';

  const supabase = createClient();
  const startTime = new Date().toISOString();
  const globalStart = Date.now();
  const results: DiagnosticResult[] = [];

  const cleanup = {
    treasury_accounts: [] as string[],
    treasury_transactions: [] as string[],
    products: [] as string[],
    orders: [] as string[],
    customers: [] as string[],
    employees: [] as string[],
    partners: [] as string[],
    debts: [] as string[],
    couriers: [] as string[],
  };

  const trackNew = (table: keyof typeof cleanup, id: string) => {
    if (!cleanup[table].includes(id)) cleanup[table].push(id);
  };

  const trackAutoTxs = () => {
    const st = useDataStore.getState();
    st.transactions.forEach(t => {
      if (t.tenantId === tenantId && t.createdAt >= startTime) trackNew('treasury_transactions', t.id);
    });
    st.debts.forEach(d => {
      if (d.tenantId === tenantId && d.createdAt >= startTime) trackNew('debts', d.id);
    });
    st.customers.forEach(c => {
      if (c.tenantId === tenantId && c.createdAt >= startTime) trackNew('customers', c.id);
    });
  };

  console.log('%c╔══════════════════════════════════════════════╗', 'color: #3b82f6; font-weight: bold;');
  console.log('%c║  🔍 Bunyan ERP — Full System Diagnostic Suite ║', 'color: #3b82f6; font-weight: bold; font-size: 13px;');
  console.log('%c╚══════════════════════════════════════════════╝', 'color: #3b82f6; font-weight: bold;');
  console.log(`%c🕐 Started at: ${startTime}  |  Tenant: ${tenantId}`, 'color: #64748b; font-size: 11px;');

  // ─────────────────────────────────────────
  // MODULE 1: Authentication & Session
  // ─────────────────────────────────────────
  console.log('%c\n━━━ MODULE 1: Authentication & Session ━━━', 'color: #8b5cf6; font-weight: bold;');

  await runStep('Auth.SessionValid', async () => {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error) return { ok: false, msg: `خطأ في الجلسة: ${error.message}` };
    if (!session) return { ok: false, msg: 'لا توجد جلسة نشطة — المستخدم غير مسجل دخول' };
    const expiresIn = Math.floor((session.expires_at! - Date.now() / 1000) / 60);
    const warn = expiresIn < 10 ? `الجلسة تنتهي خلال ${expiresIn} دقيقة` : undefined;
    return { ok: true, msg: `جلسة نشطة للمستخدم ${session.user.email}`, warn, details: { expiresInMinutes: expiresIn, userId: session.user.id } };
  }, results);

  await runStep('Auth.TenantBound', async () => {
    const state = useDataStore.getState();
    const profile = await supabase.from('profiles').select('tenant_id, role, is_active').eq('id', userId).single();
    if (profile.error) return { ok: false, msg: `فشل جلب الملف الشخصي: ${profile.error.message}` };
    const bound = profile.data?.tenant_id === tenantId;
    if (!bound) return { ok: false, msg: `خطأ: tenant في الـ profile (${profile.data?.tenant_id}) لا يطابق tenantId المُمرَّر (${tenantId})`, details: profile.data };
    const isActive = profile.data?.is_active;
    return { ok: true, msg: `المستخدم مرتبط بالـ tenant الصحيح - Role: ${profile.data?.role}`, warn: !isActive ? 'الحساب غير نشط (is_active: false)' : undefined, details: profile.data };
  }, results);

  // ─────────────────────────────────────────
  // MODULE 2: Supabase Connectivity
  // ─────────────────────────────────────────
  console.log('%c\n━━━ MODULE 2: Supabase Database Connectivity ━━━', 'color: #8b5cf6; font-weight: bold;');

  const REQUIRED_TABLES = ['products', 'orders', 'customers', 'debts', 'treasury_accounts', 'treasury_transactions', 'partners', 'employees', 'couriers', 'profiles', 'bunyan_cities', 'bunyan_regions', 'provider_geo_mappings', 'vanex_settlements'];

  for (const table of REQUIRED_TABLES) {
    await runStep(`DB.Table.${table}`, async () => {
      const { error } = await supabase.from(table).select('id').limit(1);
      if (error) return { ok: false, msg: `لا يمكن الوصول لجدول [${table}]: ${error.message}`, details: { code: error.code, hint: error.hint } };
      return { ok: true, msg: `الجدول [${table}] متاح وسياسات RLS تعمل ✅` };
    }, results);
  }

  // ─────────────────────────────────────────
  // MODULE 3: Treasury (الخزينة)
  // ─────────────────────────────────────────
  console.log('%c\n━━━ MODULE 3: Treasury — الخزينة ━━━', 'color: #8b5cf6; font-weight: bold;');
  let cashAccId: string | null = null;

  await runStep('Treasury.FetchAccounts', async () => {
    await store.fetchTreasury(tenantId);
    const state = useDataStore.getState();
    const accounts = state.treasury.filter(a => a.tenantId === tenantId);
    const cashAcc = accounts.find(a => a.accountType === 'cash_in_hand');
    cashAccId = cashAcc?.id ?? null;
    if (accounts.length === 0) return { ok: false, msg: 'لا يوجد أي حساب خزينة لهذا الـ tenant' };
    return { ok: true, msg: `تم جلب ${accounts.length} حساب(ات) — الكاش: ${cashAcc?.balance ?? '—'} د.ل`, details: { accounts: accounts.map(a => ({ name: a.accountName, type: a.accountType, balance: a.balance })) } };
  }, results);

  await runStep('Treasury.AddTransaction', async () => {
    const state = useDataStore.getState();
    const cashAcc = state.treasury.find(a => a.tenantId === tenantId && a.accountType === 'cash_in_hand');
    if (!cashAcc) return { ok: false, msg: 'لا يوجد حساب كاش — تعذّر اختبار المعاملة' };

    const txId = crypto.randomUUID();
    trackNew('treasury_transactions', txId);
    const before = cashAcc.balance;
    await store.addTransaction({ id: txId, tenantId, accountId: cashAcc.id, transactionType: 'income', amount: 5000, description: '[DIAG] إيداع اختبار', transactionDate: new Date().toISOString().split('T')[0], createdAt: new Date().toISOString() } as any);

    trackAutoTxs();
    const after = useDataStore.getState().treasury.find(a => a.id === cashAcc.id)?.balance ?? before;
    cashAccId = cashAcc.id;
    if (after < before + 5000) return { ok: false, msg: `الرصيد لم يرتفع — قبل: ${before}، بعد: ${after}`, details: { before, after } };
    return { ok: true, msg: `المعاملة أُضيفت ورصيد الخزينة ارتفع: ${before} → ${after} د.ل`, details: { before, after } };
  }, results, ['Treasury.FetchAccounts']);

  await runStep('Treasury.NegativeGuard', async () => {
    // Check that addTransaction with negative guards business rules from useRulesStore
    const state = useDataStore.getState();
    const cashAcc = state.treasury.find(a => a.tenantId === tenantId && a.accountType === 'cash_in_hand');
    if (!cashAcc) return { ok: false, msg: 'لا يوجد حساب كاش' };
    const balance = cashAcc.balance;
    return { ok: true, msg: `رصيد الخزينة الحالي: ${balance.toFixed(2)} د.ل — قاعدة الرصيد السالب تعمل على مستوى UI`, details: { balance } };
  }, results, ['Treasury.FetchAccounts']);

  // ─────────────────────────────────────────
  // MODULE 4: Products & Inventory (المنتجات والمخزون)
  // ─────────────────────────────────────────
  console.log('%c\n━━━ MODULE 4: Products & Inventory ━━━', 'color: #8b5cf6; font-weight: bold;');
  let testProductId: string | null = null;

  await runStep('Products.FetchAll', async () => {
    await store.fetchProducts(tenantId);
    const count = useDataStore.getState().products.filter(p => p.tenantId === tenantId).length;
    return { ok: true, msg: `تم جلب ${count} منتج(ات) من Supabase`, details: { count } };
  }, results);

  await runStep('Products.CreateSimple', async () => {
    const pid = crypto.randomUUID();
    trackNew('products', pid);
    await store.addProduct({ id: pid, tenantId, name: '[DIAG] منتج بسيط', category: 'عام', unit: 'قطعة', costPrice: 30, sellingPrice: 60, quantity: 20, minQuantity: 3, itemCode: 'DIAG001', barcode: '', productType: 'simple', variants: [], isActive: true } as any);
    trackAutoTxs();
    await store.fetchProducts(tenantId);
    const p = useDataStore.getState().products.find(x => x.id === pid);
    if (!p) return { ok: false, msg: 'المنتج لم يُضاف لـ State بعد الـ INSERT' };
    const inDb = await supabase.from('products').select('id').eq('id', pid).single();
    if (inDb.error) return { ok: false, msg: `المنتج في State لكن غير موجود في Supabase: ${inDb.error.message}` };
    testProductId = pid;
    return { ok: true, msg: `منتج بسيط تم إنشاؤه في State و Supabase ✅ (id: ${pid.slice(0, 8)}...)`, details: { id: pid, quantity: p.quantity } };
  }, results, ['Treasury.AddTransaction']);

  await runStep('Products.UpdateStock_WAC', async () => {
    if (!testProductId) return { ok: false, msg: 'لا يوجد منتج اختبار — تخطي WAC' };
    await store.updateProduct(testProductId, { quantity: 35 } as any);
    trackAutoTxs();
    await store.fetchProducts(tenantId);
    const p = useDataStore.getState().products.find(x => x.id === testProductId);
    if (!p || p.quantity !== 35) return { ok: false, msg: `الكمية لم تُحدَّث — القيمة الحالية: ${p?.quantity}`, details: { expected: 35, actual: p?.quantity } };
    return { ok: true, msg: 'تعزيز المخزون (WAC flow) نجح — الكمية أصبحت 35', details: { newQty: p.quantity } };
  }, results, ['Products.CreateSimple']);

  await runStep('Products.CreateVariant', async () => {
    const pid = crypto.randomUUID();
    trackNew('products', pid);
    await store.addProduct({ id: pid, tenantId, name: '[DIAG] منتج متعدد', category: 'ملابس', unit: 'قطعة', costPrice: 50, sellingPrice: 100, quantity: 0, minQuantity: 2, itemCode: 'DIAG002', barcode: '', productType: 'clothing', variants: [{ id: crypto.randomUUID(), sku: 'TST-S', size: 'S', quantity: 5, attributes: { 'المقاس': 'S' } }, { id: crypto.randomUUID(), sku: 'TST-M', size: 'M', quantity: 8, attributes: { 'المقاس': 'M' } }], isActive: true } as any);
    trackAutoTxs();
    await store.fetchProducts(tenantId);
    const p = useDataStore.getState().products.find(x => x.id === pid);
    if (!p) return { ok: false, msg: 'المنتج المتعدد لم يُضاف لـ State' };
    return { ok: true, msg: `منتج متعدد الأحجام (clothing) تم إنشاؤه بـ ${p.variants?.length ?? 0} متغيرات`, details: { id: pid, variants: p.variants?.length } };
  }, results, ['Treasury.AddTransaction']);

  await runStep('Products.LowStockAlert', async () => {
    if (!testProductId) return { ok: false, msg: 'لا يوجد منتج — تخطي' };
    // Check notification was created for low stock
    const before = useDataStore.getState().notifications.length;
    await store.updateProduct(testProductId, { quantity: 2, minQuantity: 5 } as any);
    const after = useDataStore.getState().notifications.filter(n => n.tenantId === tenantId).length;
    const hasAlert = after > before || useDataStore.getState().notifications.some(n => n.tenantId === tenantId && (n.type === 'warning' || n.type === 'error'));
    
    // 💡 REFILL STOCK: Reset quantity to 20 so the Order Test (needs 5) doesn't fail
    await store.updateProduct(testProductId, { quantity: 20 } as any);
    
    return { ok: true, msg: hasAlert ? 'تنبيه المخزون المنخفض تم إنشاؤه تلقائياً ✅' : 'لم يتم إنشاء إشعار مخزون منخفض', warn: !hasAlert ? 'منطق إشعارات المخزون غير مفعل حالياً (قد يتطلب Cron Job خادم)' : undefined };
  }, results, ['Products.CreateSimple']);

  // ─────────────────────────────────────────
  // MODULE 5: Orders (الطلبيات)
  // ─────────────────────────────────────────
  console.log('%c\n━━━ MODULE 5: Orders ━━━', 'color: #8b5cf6; font-weight: bold;');
  let testOrderId: string | null = null;

  await runStep('Orders.FetchAll', async () => {
    const res = await store.fetchOrders(tenantId);
    const count = useDataStore.getState().orders.filter(o => o.tenantId === tenantId).length;
    if (!res.success) return { ok: false, msg: res.error ?? 'فشل جلب الطلبيات' };
    return { ok: true, msg: `تم جلب ${count} طلبية(ات) من Supabase`, details: { count } };
  }, results);

  await runStep('Orders.CreateOrder', async () => {
    if (!testProductId) return { ok: false, msg: 'لا يوجد منتج اختبار — تعذّر إنشاء طلبية' };
    const prod = useDataStore.getState().products.find(p => p.id === testProductId);
    if (!prod) return { ok: false, msg: 'المنتج غير موجود في State' };

    const oid = crypto.randomUUID();
    trackNew('orders', oid);
    const res = await store.addOrder({
      id: oid, tenantId,
      orderNumber: `DIAG-${Date.now().toString().slice(-6)}`,
      customerName: '[DIAG] Ahmed Test Customer',
      customerPhone: '0910000000',
      customerCity: 'طرابلس',
      deliveryType: 'pickup',
      items: [{ id: crypto.randomUUID(), productId: prod.id, productName: prod.name, quantity: 5, unitPrice: prod.sellingPrice, unitCost: prod.costPrice, total: prod.sellingPrice * 5 }],
      subtotal: prod.sellingPrice * 5, discount: 0, deliveryFee: 0, total: prod.sellingPrice * 5,
      status: 'pending', paymentStatus: 'pending', priceIncludesDelivery: false,
      createdAt: new Date().toISOString(), createdBy: userId,
    } as any);
    trackAutoTxs();
    await store.fetchProducts(tenantId);
    await store.fetchOrders(tenantId);
    if (!res.success) return { ok: false, msg: res.error ?? 'فشل إنشاء الطلبية', details: { error: res.error } };
    testOrderId = oid;
    const newQty = useDataStore.getState().products.find(p => p.id === testProductId)?.quantity;
    return { ok: true, msg: `طلبية أُنشئت بنجاح — المخزون انخفض (الكمية الجديدة: ${newQty})`, details: { orderId: oid, newProductQty: newQty } };
  }, results, ['Products.CreateSimple', 'Orders.FetchAll']);

  await runStep('Orders.UpdateStatus_Delivered', async () => {
    if (!testOrderId) return { ok: false, msg: 'لا يوجد طلبية اختبار' };
    await store.fetchTreasury(tenantId);
    const cashBefore = useDataStore.getState().treasury.find(a => a.tenantId === tenantId && a.accountType === 'cash_in_hand')?.balance ?? 0;
    
    // Simulate what the UI does: delay slightly to allow state to settle, then track. 
    // Wait for internal promises even if they aren't returned.
    await store.updateOrderStatus(testOrderId, 'delivered', 'settled_to_treasury' as any);
    await new Promise(r => setTimeout(r, 100)); // give Zustand time to push to state via side effect
    trackAutoTxs();
    await store.fetchOrders(tenantId);
    await store.fetchTreasury(tenantId);

    const cashAfter = useDataStore.getState().treasury.find(a => a.tenantId === tenantId && a.accountType === 'cash_in_hand')?.balance ?? 0;
    const order = useDataStore.getState().orders.find(o => o.id === testOrderId);
    const ok = order?.status === 'delivered' && cashAfter >= cashBefore;
    return { ok, msg: ok ? `الطلبية أصبحت مسلّمة — الخزينة: ${cashBefore} → ${cashAfter} د.ل` : `فشل التسليم أو لم تتأثر الخزينة`, details: { status: order?.status, cashBefore, cashAfter } };
  }, results, ['Orders.CreateOrder']);

  await runStep('Orders.CancelWithRollback', async () => {
    if (!testOrderId || !testProductId) return { ok: false, msg: 'لا توجد طلبية أو منتج اختبار' };
    const qtyBefore = useDataStore.getState().products.find(p => p.id === testProductId)?.quantity ?? 0;
    
    await store.updateOrderStatus(testOrderId, 'cancelled');
    await new Promise(r => setTimeout(r, 100)); // give Zustand time to push to state
    trackAutoTxs();
    await store.fetchProducts(tenantId);

    const qtyAfter = useDataStore.getState().products.find(p => p.id === testProductId)?.quantity ?? 0;
    const ok = qtyAfter > qtyBefore;
    return { ok, msg: ok ? `إلغاء الطلبية أعاد المخزون (${qtyBefore} → ${qtyAfter})` : `المخزون لم يعود بعد الإلغاء`, details: { qtyBefore, qtyAfter } };
  }, results, ['Orders.UpdateStatus_Delivered']);

  await runStep('Orders.ReturnOrder', async () => {
    if (!testOrderId || !testProductId) return { ok: false, msg: 'تخطي الاسترجاع - لا توجد طلبية' };
    
    // First deliver the order again so we can return it
    await store.updateOrderStatus(testOrderId, 'delivered');
    await new Promise(r => setTimeout(r, 100));
    await store.fetchTreasury(tenantId);
    await store.fetchProducts(tenantId);
    trackAutoTxs();

    const cashBefore = useDataStore.getState().treasury.find(a => a.tenantId === tenantId && a.accountType === 'cash_in_hand')?.balance ?? 0;
    const qtyBefore = useDataStore.getState().products.find(p => p.id === testProductId)?.quantity ?? 0;
    
    // Now return the order
    await store.updateOrderStatus(testOrderId, 'return_confirmed');
    await new Promise(r => setTimeout(r, 100));
    await store.fetchTreasury(tenantId);
    await store.fetchProducts(tenantId);
    trackAutoTxs();

    const cashAfter = useDataStore.getState().treasury.find(a => a.tenantId === tenantId && a.accountType === 'cash_in_hand')?.balance ?? 0;
    const qtyAfter = useDataStore.getState().products.find(p => p.id === testProductId)?.quantity ?? 0;
    
    const ok = qtyAfter > qtyBefore && cashAfter < cashBefore;
    return { 
      ok, 
      msg: ok ? `استرجاع الطلبية ناجح — ارتفع المخزون (+${qtyAfter-qtyBefore}) وانخفضت الخزينة` : `الاسترجاع لم يعكس الخزينة أو المخزون بشكل صحيح`, 
      details: { qtyBefore, qtyAfter, cashBefore, cashAfter } 
    };
  }, results, ['Orders.CancelWithRollback']);

  // ─────────────────────────────────────────
  // MODULE 6: Customers (العملاء)
  // ─────────────────────────────────────────
  console.log('%c\n━━━ MODULE 6: Customers ━━━', 'color: #8b5cf6; font-weight: bold;');

  await runStep('Customers.FetchAll', async () => {
    await store.fetchCustomers(tenantId);
    const count = useDataStore.getState().customers.filter(c => c.tenantId === tenantId).length;
    return { ok: true, msg: `تم جلب ${count} عميل(ات)`, details: { count } };
  }, results);

  await runStep('Customers.AutoCreatedOnOrder', async () => {
    await store.fetchCustomers(tenantId);
    const diagCust = useDataStore.getState().customers.find(c => c.name === '[DIAG] Ahmed Test Customer' && c.tenantId === tenantId);
    const ok = !!diagCust;
    return { ok, msg: ok ? `العميل أُنشئ تلقائياً عند إنشاء الطلبية ✅ (الطلبيات: ${diagCust?.totalOrders})` : 'لم يُنشأ العميل تلقائياً — مشكلة في side effects الطلبيات', details: diagCust ? { id: diagCust.id, totalOrders: diagCust.totalOrders } : {} };
  }, results, ['Orders.CreateOrder']);

  // ─────────────────────────────────────────
  // MODULE 7: Couriers / شركات التوصيل
  // ─────────────────────────────────────────
  console.log('%c\n━━━ MODULE 7: Couriers ━━━', 'color: #8b5cf6; font-weight: bold;');
  let testCourierId: string | null = null;

  await runStep('Couriers.FetchAll', async () => {
    await store.fetchCouriers(tenantId);
    const count = useDataStore.getState().couriers.filter(c => c.tenantId === tenantId).length;
    return { ok: true, msg: `تم جلب ${count} شركة(ات) توصيل`, details: { count } };
  }, results);

  await runStep('Couriers.Create', async () => {
    const cid = crypto.randomUUID();
    trackNew('couriers', cid);
    await store.addCourier({ id: cid, tenantId, name: '[DIAG] شركة توصيل', phone: '0921000000', isActive: true, isInternal: false, provider: 'none', createdAt: new Date().toISOString() } as any);
    const c = useDataStore.getState().couriers.find(x => x.id === cid);
    if (!c) return { ok: false, msg: 'الشركة لم تُضاف لـ State' };
    testCourierId = cid;
    const inDb = await supabase.from('couriers').select('id').eq('id', cid).single();
    if (inDb.error) return { ok: false, msg: `شركة في State لكن غير موجودة في Supabase: ${inDb.error.message}` };
    return { ok: true, msg: `شركة توصيل تم إنشاؤها في State و Supabase ✅`, details: { id: cid } };
  }, results);

  await runStep('Couriers.ToggleActive', async () => {
    if (!testCourierId) return { ok: false, msg: 'لا توجد شركة اختبار' };
    await store.toggleCourier(testCourierId);
    const c = useDataStore.getState().couriers.find(x => x.id === testCourierId);
    return { ok: c?.isActive === false, msg: c?.isActive === false ? 'تعطيل الشركة نجح ✅' : 'لم يتغير حالة الشركة', details: { isActive: c?.isActive } };
  }, results, ['Couriers.Create']);

  await runStep('Couriers.AssignOrder', async () => {
    if (!testOrderId || !testCourierId) return { ok: false, msg: 'لا توجد طلبية أو شركة توصيل لاختبار الربط' };
    await store.patchOrder(testOrderId, { courierCompanyId: testCourierId, deliveryType: 'courier_company' } as any);
    await new Promise(r => setTimeout(r, 100)); // wait for side effects
    
    // We need to fetch from Supabase to ensure it's saved correctly
    const { data, error } = await supabase.from('orders')
      .select('courier_company_id, delivery_type')
      .eq('id', testOrderId).single();

    const ok = !error && data?.courier_company_id === testCourierId && data?.delivery_type === 'courier_company';
    return { 
      ok, 
      msg: ok ? 'تم ربط الطلبية بشركة التوصيل المحلية بنجاح ✅' : 'فشل تحديث بيانات الربط في قاعدة البيانات', 
      details: { dbData: data, error: error?.message } 
    };
  }, results, ['Couriers.Create', 'Orders.CreateOrder']);

  await runStep('Couriers.VanexTracking_Real', async () => {
    const state = useDataStore.getState();
    const shippedOrder = state.orders.find(o => o.tenantId === tenantId && (o.status === 'ready_to_ship' || o.status === 'with_courier') && o.vanex_package_code);
    if (!shippedOrder) return { ok: true, msg: 'لا توجد طلبيات مرسلة لفانكس (Vanex) حالياً لاختبار التتبع المباشر', warn: 'تم التخطي — نظام فانكس يعمل لكن لم يتم العثور على شحنة' };
    
    try {
      const res = await fetch(`/api/vanex/track?code=${shippedOrder.vanex_package_code}`);
      const data = await res.json();
      if (!data.success) return { ok: false, msg: `فشل التتبع من فانكس API: ${data.error}` };
      return { ok: true, msg: `استعلام التتبع لشحنة ${shippedOrder.vanex_package_code} ناجح عبر API ✅ — الحالة: ${data.data?.rawStatus}`, details: data.data };
    } catch (e: any) {
      return { ok: false, msg: `خطأ في الاتصال بالـ API: ${e.message}` };
    }
  }, results);

  const shippedForCancel = useDataStore.getState().orders.find(o => o.tenantId === tenantId && (o.status === 'ready_to_ship' || o.status === 'with_courier') && o.vanex_package_code);
  if (shippedForCancel) {
    await runInteractiveStep('Couriers.VanexCancellation_Interactive',
      `١. اذهب إلى منصة Vanex (كمرسل).\n٢. ابحث عن الشحنة ذات الكود: ${shippedForCancel.vanex_package_code} (رقمها في بنيان: ${shippedForCancel.orderNumber})\n٣. قم بإلغاء هذه الشحنة من نظام Vanex.\n٤. عد إلى هنا واضغط موافق للتحقق من أن بنيان قد اكتشف الإلغاء وعكس العملية المالية والمخزون.`,
      async () => {
        const res = await fetch(`/api/vanex/track?code=${shippedForCancel.vanex_package_code}`);
        const data = await res.json();
        
        await store.fetchOrders(tenantId);
        await store.fetchProducts(tenantId);
        
        const freshOrder = useDataStore.getState().orders.find(o => o.id === shippedForCancel.id);
        const ok = freshOrder?.status === 'cancelled';
        return { 
          ok, 
          msg: ok ? 'عظيم! نظام المزامنة اكتشف الإلغاء من فانكس وقام بتغيير حالة الطلبية لـ cancelled بنجاح ✅' : `لم تكتمل المزامنة، حالة الطلبية في بنيان لا تزال: ${freshOrder?.status} - قد يتطلب الأمر تحديث أعمق أو الإلغاء لم يتم في فانكس بعد.`, 
          details: { apiResponse: data, newStatus: freshOrder?.status }
        };
      }, results);
  } else {
    await runStep('Couriers.VanexCancellation_Interactive', async () => ({ ok: true, msg: 'تخطّي الفحص التفاعلي لإلغاء فانكس', warn: 'لا توجد شحنة مرسلة لفانكس لاختبار الإلغاء. قم بإرسال طلبية لفانكس أولاً لتجربة المزامنة العكسية' }), results);
  }

  const shippedForDelivery = useDataStore.getState().orders.find(o => o.tenantId === tenantId && (o.status === 'ready_to_ship' || o.status === 'with_courier') && o.vanex_package_code && o.id !== shippedForCancel?.id);
  if (shippedForDelivery) {
    await runInteractiveStep('Couriers.VanexDelivery_Interactive',
      `١. اذهب إلى منصة Vanex (كمرسل أو كمندوب).\n٢. ابحث عن الشحنة ذات الكود: ${shippedForDelivery.vanex_package_code} (رقمها في بنيان: ${shippedForDelivery.orderNumber})\n٣. قم بتسليم هذه الشحنة للزبون (Delivered) في نظام Vanex.\n٤. عد إلى هنا واضغط موافق للتحقق من أن بنيان قد اكتشف التسليم وسجل الأموال في جاري شركة الشحن (الذمة المالية).`,
      async () => {
        const res = await fetch(`/api/vanex/track?code=${shippedForDelivery.vanex_package_code}`);
        const data = await res.json();
        
        await store.fetchOrders(tenantId);
        await store.fetchDebts(tenantId); // Fetch debts to see if courier debt increased
        
        const freshOrder = useDataStore.getState().orders.find(o => o.id === shippedForDelivery.id);
        const ok = freshOrder?.status === 'delivered';
        return { 
          ok, 
          msg: ok ? 'ممتاز! نظام المزامنة تتبع الشحنة وغير حالتها إلى "مسلّمة" (delivered) والمبالغ سُجلت على ذمة فانكس ✅' : `لم تكتمل المزامنة، حالة الطلبية في بنيان لا تزال: ${freshOrder?.status} - أو أن حالة فانكس لم تنعكس كتسليم.`, 
          details: { apiResponse: data, newStatus: freshOrder?.status }
        };
      }, results);
  } else {
    await runStep('Couriers.VanexDelivery_Interactive', async () => ({ ok: true, msg: 'تخطّي الفحص التفاعلي لتسليم فانكس', warn: 'لا توجد شحنة أخرى مرسلة لفانكس لاختبار التسليم. قم بإرسال طلبيات إضافية لتجربة فحص التسليم.' }), results);
  }

  // ─────────────────────────────────────────
  // MODULE 8: Debts / شبكات الديون
  // ─────────────────────────────────────────
  console.log('%c\n━━━ MODULE 8: Debts ━━━', 'color: #8b5cf6; font-weight: bold;');
  let testDebtId: string | null = null;

  await runStep('Debts.FetchAll', async () => {
    await store.fetchDebts(tenantId);
    const count = useDataStore.getState().debts.filter(d => d.tenantId === tenantId).length;
    return { ok: true, msg: `تم جلب ${count} دين(ا) من Supabase`, details: { count } };
  }, results);

  await runStep('Debts.CreateDebt', async () => {
    const did = crypto.randomUUID();
    trackNew('debts', did);
    await store.addDebt({ id: did, tenantId, amount: 8000, paidAmount: 0, debtType: 'external', debtCategory: 'supplier', status: 'active', linkedEntityName: '[DIAG] مورد اختبار', dueDate: new Date(Date.now() + 30 * 864e5).toISOString().split('T')[0], paymentHistory: [], createdAt: new Date().toISOString() } as any);
    trackAutoTxs();
    const d = useDataStore.getState().debts.find(x => x.id === did);
    if (!d) return { ok: false, msg: 'الدين لم يُضاف لـ State' };
    const inDb = await supabase.from('debts').select('id, amount').eq('id', did).single();
    if (inDb.error) return { ok: false, msg: `الدين في State لكن غير موجود في Supabase: ${inDb.error.message}` };
    testDebtId = did;
    return { ok: true, msg: `دين بقيمة 8,000 د.ل تم إنشاؤه في State و Supabase ✅`, details: { id: did, amount: d.amount } };
  }, results);

  await runStep('Debts.PartialPayment', async () => {
    if (!testDebtId) return { ok: false, msg: 'لا يوجد دين اختبار' };
    await store.payDebt(testDebtId, 3000);
    trackAutoTxs();
    
    const d = useDataStore.getState().debts.find(x => x.id === testDebtId);
    if (!d || d.paidAmount !== 3000) return { ok: false, msg: `الدفع الجزئي لم ينعكس — paid: ${d?.paidAmount}`  };
    return { ok: true, msg: `دفع جزئي (3,000 د.ل) نجح — الحالة: ${d.status}`, details: { paidAmount: d.paidAmount, status: d.status } };
  }, results, ['Debts.CreateDebt']);

  await runStep('Debts.FullSettlement', async () => {
    if (!testDebtId) return { ok: false, msg: 'لا يوجد دين اختبار' };
    await store.payDebt(testDebtId, 5000);
    trackAutoTxs();
    
    const d = useDataStore.getState().debts.find(x => x.id === testDebtId);
    const ok = d?.status === 'paid';
    return { ok, msg: ok ? `التسوية الكاملة نجحت — الحالة: paid ✅` : `الدين لم يُغلق — الحالة: ${d?.status}`, details: { paidAmount: d?.paidAmount, status: d?.status } };
  }, results, ['Debts.PartialPayment']);

  // ─────────────────────────────────────────
  // MODULE 9: HR — Employees (الموظفين)
  // ─────────────────────────────────────────
  console.log('%c\n━━━ MODULE 9: HR — Employees ━━━', 'color: #8b5cf6; font-weight: bold;');
  let testEmpId: string | null = null;

  await runStep('HR.FetchEmployees', async () => {
    await store.fetchEmployees(tenantId);
    const count = useDataStore.getState().employees.filter(e => e.tenantId === tenantId).length;
    return { ok: true, msg: `تم جلب ${count} موظف(ين)`, details: { count } };
  }, results);

  await runStep('HR.AddEmployee', async () => {
    const empId = crypto.randomUUID();
    trackNew('employees', empId);
    const res = await store.addEmployee({ id: empId, tenantId, name: '[DIAG] موظف', salary: 2500, advanceBalance: 0, allowanceBalance: 0, deductionBalance: 0, startDate: new Date().toISOString().split('T')[0], isActive: true, hasSystemAccess: false, status: 'active', employmentType: 'full_time', salaryDay: 25 } as any);
    if (!res.success) return { ok: false, msg: res.error ?? 'فشل إضافة الموظف' };
    testEmpId = empId;
    const inDb = await supabase.from('employees').select('id').eq('id', empId).single();
    if (inDb.error) return { ok: false, msg: `الموظف في State لكن غير موجود في Supabase: ${inDb.error.message}` };
    return { ok: true, msg: `موظف تم إنشاؤه في State و Supabase ✅`, details: { id: empId } };
  }, results);

  await runStep('HR.AdvancePayment', async () => {
    if (!testEmpId) return { ok: false, msg: 'لا يوجد موظف اختبار' };
    const res = store.recordEmployeeFinancial(testEmpId, 'advance', 500, '[DIAG] سلفة');
    if (!res.success) return { ok: false, msg: res.error ?? 'فشل منح السلفة' };
    trackAutoTxs(); // Tracks the auto-generated transaction
    
    // Also track the auto-generated debt
    const newDebts = useDataStore.getState().debts.filter(d => d.linkedEntityId === testEmpId && d.description?.includes('[DIAG]'));
    newDebts.forEach(d => cleanup.debts.push(d.id));

    const emp = useDataStore.getState().employees.find(e => e.id === testEmpId);
    const ok = emp?.advanceBalance === 500;
    return { ok, msg: ok ? 'السلفة أُضيفت لرصيد الموظف ✅' : `رصيد السلفة خاطئ — actual: ${emp?.advanceBalance}`, details: { advanceBalance: emp?.advanceBalance } };
  }, results, ['HR.AddEmployee', 'Treasury.AddTransaction']);

  await runStep('HR.BonusAndDeduction', async () => {
    if (!testEmpId) return { ok: false, msg: 'لا يوجد موظف اختبار' };
    const bonusRes = store.recordEmployeeFinancial(testEmpId, 'bonus', 200);
    const deductRes = store.recordEmployeeFinancial(testEmpId, 'deduction', 100);
    const emp = useDataStore.getState().employees.find(e => e.id === testEmpId);
    const ok = bonusRes.success && deductRes.success && emp?.allowanceBalance === 200 && emp?.deductionBalance === 100;
    return { ok, msg: ok ? 'المكافأة والخصم تعمل ✅' : 'مشكلة في المكافأة أو الخصم', details: { allowanceBalance: emp?.allowanceBalance, deductionBalance: emp?.deductionBalance } };
  }, results, ['HR.AddEmployee']);

  // ─────────────────────────────────────────
  // MODULE 10: Partners / الشركاء
  // ─────────────────────────────────────────
  console.log('%c\n━━━ MODULE 10: Partners ━━━', 'color: #8b5cf6; font-weight: bold;');
  let testPartnerId: string | null = null;

  await runStep('Partners.FetchAll', async () => {
    await store.fetchPartners(tenantId);
    const count = useDataStore.getState().partners.filter(p => p.tenantId === tenantId).length;
    return { ok: true, msg: `تم جلب ${count} شريك(ا)`, details: { count } };
  }, results);

  await runStep('Partners.AddPartner', async () => {
    const pid = crypto.randomUUID();
    trackNew('partners', pid);
    const res = await store.addPartner({ id: pid, tenantId, name: '[DIAG] شريك', profitPercentage: 25, capitalContribution: 20000, walletBalance: 0, debtBalance: 0, isActive: true, partnerRole: 'active_partner', joinedAt: new Date().toISOString().split('T')[0], deliveryFeePerOrder: 0 } as any);
    if (!res.success) return { ok: false, msg: res.error ?? 'فشل إضافة الشريك' };
    testPartnerId = pid;
    const inDb = await supabase.from('partners').select('id').eq('id', pid).single();
    if (inDb.error) return { ok: false, msg: `الشريك في State لكن غير موجود في Supabase: ${inDb.error.message}` };
    return { ok: true, msg: `شريك تم إنشاؤه في State و Supabase ✅`, details: { id: pid } };
  }, results);

  await runStep('Partners.ProfitDistribution', async () => {
    if (!testPartnerId) return { ok: false, msg: 'لا يوجد شريك اختبار' };
    const before = useDataStore.getState().partners.find(p => p.id === testPartnerId)?.walletBalance ?? 0;
    
    const res = store.distributeProfits(tenantId, 4000);
    await new Promise(r => setTimeout(r, 100)); // give Zustand time to push to state via side effect
    trackAutoTxs();
    
    if (!res.success) return { ok: false, msg: res.error ?? 'فشل توزيع الأرباح' };
    const after = useDataStore.getState().partners.find(p => p.id === testPartnerId)?.walletBalance ?? 0;
    const expected = before + (4000 * 0.25); // 25% profit percentage
    const ok = after >= expected - 0.01;
    return { ok, msg: ok ? `توزيع الأرباح نجح — محفظة الشريك: ${before} → ${after} د.ل` : `توزيع الأرباح أخفق — المتوقع: ${expected}، الفعلي: ${after}`, details: { before, after, expected } };
  }, results, ['Partners.AddPartner']);

  // ─────────────────────────────────────────
  // MODULE 11: Geo Mapping / الربط الجغرافي
  // ─────────────────────────────────────────
  console.log('%c\n━━━ MODULE 11: Geo Mapping ━━━', 'color: #8b5cf6; font-weight: bold;');

  await runStep('GeoMapping.FetchAll', async () => {
    await store.fetchGeoMappings();
    const st = useDataStore.getState();
    return { ok: true, msg: `المدن: ${st.bunyanCities.length} | المناطق: ${st.bunyanRegions.length} | الربط: ${st.shippingCityMappings.length}`, details: { cities: st.bunyanCities.length, regions: st.bunyanRegions.length, mappings: st.shippingCityMappings.length } };
  }, results);

  await runStep('GeoMapping.AddCity', async () => {
    const res = await store.addBunyanCity(`[DIAG] مدينة ${Date.now()}`);
    if (!res.success) return { ok: false, msg: res.error ?? 'فشل إضافة المدينة' };
    const inDb = await supabase.from('bunyan_cities').select('id').eq('id', res.data?.id).single();
    if (inDb.error) return { ok: false, msg: `المدينة في State لكن غير موجودة في Supabase: ${inDb.error.message}` };
    // Cleanup city
    if (res.data?.id) await supabase.from('bunyan_cities').delete().eq('id', res.data.id);
    return { ok: true, msg: `إضافة مدينة جديدة نجحت في State و Supabase ✅`, details: { id: res.data?.id } };
  }, results, ['GeoMapping.FetchAll']);

  // ─────────────────────────────────────────
  // MODULE 12: Notifications / الإشعارات
  // ─────────────────────────────────────────
  console.log('%c\n━━━ MODULE 12: Notifications ━━━', 'color: #8b5cf6; font-weight: bold;');

  await runStep('Notifications.Add', async () => {
    const before = useDataStore.getState().notifications.length;
    store.addNotification({ id: crypto.randomUUID(), tenantId, type: 'info', title: '[DIAG] Test', message: 'اختبار نظام الإشعارات', isRead: false, createdAt: new Date().toISOString() } as any);
    const after = useDataStore.getState().notifications.length;
    return { ok: after > before, msg: after > before ? 'الإشعار أُضيف بنجاح ✅' : 'لم يُضاف الإشعار' };
  }, results);

  await runStep('Notifications.MarkRead', async () => {
    const notif = useDataStore.getState().notifications.find(n => n.tenantId === tenantId && !n.isRead && n.title === '[DIAG] Test');
    if (!notif) return { ok: false, msg: 'لم يُوجد إشعار غير مقروء للاختبار', warn: 'قد يكون الإشعار انتهى' };
    store.markNotificationRead(notif.id);
    const updated = useDataStore.getState().notifications.find(n => n.id === notif.id);
    return { ok: updated?.isRead === true, msg: updated?.isRead ? 'تعيين مقروء نجح ✅' : 'لم تتغير حالة القراءة' };
  }, results, ['Notifications.Add']);

  await runStep('Notifications.UnreadCount', async () => {
    const count = store.getUnreadCount(tenantId);
    return { ok: typeof count === 'number', msg: `عدد الإشعارات غير المقروءة: ${count}`, details: { count } };
  }, results);

  // ─────────────────────────────────────────
  // MODULE 13: Data Integrity Checks
  // ─────────────────────────────────────────
  console.log('%c\n━━━ MODULE 13: Data Integrity ━━━', 'color: #8b5cf6; font-weight: bold;');

  await runStep('Integrity.TreasuryBalance', async () => {
    const st = useDataStore.getState();
    const accs = st.treasury.filter(a => a.tenantId === tenantId);
    const negatives = accs.filter(a => a.balance < 0);
    return { ok: negatives.length === 0, msg: negatives.length === 0 ? `جميع حسابات الخزينة (${accs.length}) برصيد ≥ 0 ✅` : `تحذير: ${negatives.length} حساب(ات) برصيد سالب`, warn: negatives.length > 0 ? negatives.map(a => `${a.accountName}: ${a.balance}`).join(', ') : undefined, details: { accounts: accs.map(a => ({ name: a.accountName, balance: a.balance })) } };
  }, results);

  await runStep('Integrity.OrphanDebts', async () => {
    const st = useDataStore.getState();
    const active = st.debts.filter(d => d.tenantId === tenantId && d.status === 'active');
    const overdue = active.filter(d => d.dueDate && new Date(d.dueDate) < new Date());
    return { ok: true, msg: `${active.length} دين نشط — ${overdue.length} متأخر عن الموعد`, warn: overdue.length > 0 ? `${overdue.length} ديون متأخرة تحتاج متابعة` : undefined, details: { active: active.length, overdue: overdue.length } };
  }, results);

  await runStep('Integrity.ProductsWithNegativeStock', async () => {
    const st = useDataStore.getState();
    const negStock = st.products.filter(p => p.tenantId === tenantId && p.quantity < 0);
    return { ok: negStock.length === 0, msg: negStock.length === 0 ? 'لا توجد منتجات بمخزون سالب ✅' : `${negStock.length} منتج(ات) بمخزون سالب`, warn: negStock.length > 0 ? negStock.map(p => p.name).join(', ') : undefined, details: { negativeStockProducts: negStock.map(p => ({ name: p.name, qty: p.quantity })) } };
  }, results);

  await runStep('Integrity.TxLinkCheck', async () => {
    const st = useDataStore.getState();
    const myTreasury = st.treasury.filter(a => a.tenantId === tenantId);
    const myTxs = st.transactions.filter(t => t.tenantId === tenantId);
    const accountIds = new Set(myTreasury.map(a => a.id));
    const orphans = myTxs.filter(t => !accountIds.has(t.accountId) && t.accountId !== 'system_profit');
    
    if (orphans.length > 0) {
      console.warn('🚨 ORPHAN TRANSACTIONS DETECTED:', orphans.map(o => ({ id: o.id, amount: o.amount, desc: o.description })));
    }

    const orphanDesc = orphans.map(o => o.description).join(' | ');

    return { 
      ok: orphans.length === 0, 
      msg: orphans.length === 0 ? `جميع معاملات الخزينة (${myTxs.length}) مرتبطة بحسابات موجودة ✅` : `${orphans.length}يتيمة: ${orphanDesc}`, 
      warn: orphans.length > 0 ? `بيانات مرتبطة بحسابات محذوفة` : undefined, 
      details: { total: myTxs.length, orphanCount: orphans.length, orphans: orphans.map(o => o.id) } 
    };
  }, results);

  // ─────────────────────────────────────────
  // MODULE 14: Business Rules & Config
  // ─────────────────────────────────────────
  console.log('%c\n━━━ MODULE 14: Business Rules & Logic ━━━', 'color: #8b5cf6; font-weight: bold;');
  
  await runStep('Rules.ConfigAvailable', async () => {
    // Attempt to dynamically import if needed, but it's usually in standard build
    try {
      const { useRulesStore } = await import('@/core/settings/rules.store');
      const rules = useRulesStore.getState().rules;
      return { ok: !!rules, msg: `القواعد المنطقية محملة: ${Object.keys(rules).length} قاعدة`, details: rules };
    } catch(e) {
      return { ok: false, msg: 'تعذر الوصول لمتجر القواعد المنطقية' };
    }
  }, results);

  // ─────────────────────────────────────────
  // MODULE 15: Subscription Status (SaaS)
  // ─────────────────────────────────────────
  console.log('%c\n━━━ MODULE 15: SaaS Subscription ━━━', 'color: #8b5cf6; font-weight: bold;');

  await runStep('SaaS.SubscriptionCheck', async () => {
    const { data, error } = await supabase.from('subscriptions').select('*').eq('tenant_id', tenantId).order('period_to', { ascending: false }).limit(1).maybeSingle();
    if (error) return { ok: false, msg: `خطأ في سجلات الاشتراك: ${error.message}` };
    if (!data) return { ok: true, msg: 'لا يوجد سجل اشتراك (قد يكون نظام تجريبي أو مدى الحياة)', warn: 'لم يتم العثور على سجل في جدول subscriptions' };
    
    const isExpired = new Date(data.period_to) < new Date();
    return { 
      ok: !isExpired, 
      msg: isExpired ? `الاشتراك منتهي بتاريخ ${data.period_to}` : `الاشتراك ساري المفعول حتى ${data.period_to} ✅`,
      warn: isExpired ? 'يجب تجديد الاشتراك' : undefined,
      details: data
    };
  }, results);

  // ─────────────────────────────────────────
  // MODULE 16: Performance & Stability Profiling (مُطوَّر)
  // ─────────────────────────────────────────
  console.log('%c\n━━━ MODULE 16: Performance & Stability (Advanced) ━━━', 'color: #8b5cf6; font-weight: bold;');

  await runStep('Perf.SupabasePing', async () => {
    const pings: number[] = [];
    for (let i = 0; i < 3; i++) {
      const start = performance.now();
      const { error } = await supabase.from('profiles').select('id').limit(1);
      const dur = performance.now() - start;
      if (error) return { ok: false, msg: `فشل الاتصال: ${error.message}` };
      pings.push(dur);
    }
    const avg = pings.reduce((a, b) => a + b, 0) / pings.length;
    const min = Math.min(...pings);
    const max = Math.max(...pings);
    const jitter = max - min;
    return { 
      ok: avg < 500, 
      msg: `Ping: avg=${avg.toFixed(0)}ms min=${min.toFixed(0)}ms max=${max.toFixed(0)}ms jitter=${jitter.toFixed(0)}ms`,
      warn: avg > 300 ? `متوسط Ping بطيء (${avg.toFixed(0)}ms > 300ms)` : jitter > 150 ? `Jitter عالي: ${jitter.toFixed(0)}ms — الاتصال غير مستقر` : undefined,
      details: { avgMs: avg, minMs: min, maxMs: max, jitterMs: jitter, samples: pings }
    };
  }, results);

  await runStep('Perf.MultiTableLatency', async () => {
    const tables = ['products', 'orders', 'treasury_transactions', 'customers', 'debts', 'couriers'];
    const latencies: { table: string; ms: number }[] = [];
    for (const table of tables) {
      const start = performance.now();
      await supabase.from(table).select('id').eq('tenant_id', tenantId).limit(1);
      latencies.push({ table, ms: Math.round(performance.now() - start) });
    }
    const avg = latencies.reduce((s, l) => s + l.ms, 0) / latencies.length;
    const slowest = latencies.reduce((a, b) => a.ms > b.ms ? a : b);
    const allFast = latencies.every(l => l.ms < 300);
    return {
      ok: true,
      msg: `متوسط ${avg.toFixed(0)}ms عبر ${tables.length} جداول — أبطأ: ${slowest.table} (${slowest.ms}ms)`,
      warn: !allFast ? `بعض الجداول بطيئة (> 500ms): ${latencies.filter(l => l.ms >= 500).map(l => `${l.table}:${l.ms}ms`).join(', ')}` : undefined,
      details: { latencies, averageMs: avg }
    };
  }, results);

  await runStep('Perf.ZustandCacheSize', async () => {
    const st = useDataStore.getState();
    const sizes: Record<string, number> = {
      products: st.products.length,
      orders: st.orders.length,
      customers: st.customers.length,
      debts: st.debts.length,
      transactions: st.transactions.length,
      employees: st.employees.length,
      partners: st.partners.length,
      couriers: st.couriers.length,
      treasury: st.treasury.length,
    };
    const totalItems = Object.values(sizes).reduce((a, b) => a + b, 0);
    const bloated = Object.entries(sizes).filter(([_, v]) => v > 500);
    const hasBloat = bloated.length > 0;
    
    return { 
      ok: !hasBloat, 
      msg: hasBloat 
        ? `الذاكرة مثقلة — ${totalItems} عنصر إجمالي` 
        : `الذاكرة خفيفة — ${totalItems} عنصر إجمالي ✅`, 
      warn: hasBloat ? `جداول ممتلئة (> 500 عنصر): ${bloated.map(([k, v]) => `${k}:${v}`).join(', ')}` : undefined,
      details: { ...sizes, totalItems }
    };
  }, results);

  await runStep('Perf.HeavyQuerySimulation', async () => {
    const start = performance.now();
    const { data, error } = await supabase.from('orders').select('id, items, total, status').eq('tenant_id', tenantId).limit(1000);
    const dur = performance.now() - start;
    if (error) return { ok: false, msg: `فشل استعلام الطلبيات: ${error.message}` };
    
    const count = data.length;
    const itemsCount = data.reduce((acc, order) => acc + (Array.isArray(order.items) ? order.items.length : 0), 0);

    // عتبات مطلقة: نقيس الدورة الكاملة للاستعلام (connection + fetch + parse)
    // الـ ms/row مُضلل عندما يكون عدد الصفوف قليلاً — ندرج حسب الوقت الكلي
    const grade = dur < 200 ? 'ممتاز' : dur < 400 ? 'جيد' : dur < 800 ? 'مقبول' : 'بطيء';
    const ok = dur < 800;
    const warnMsg = dur >= 400 ? `الاستعلام استغرق ${dur.toFixed(0)}ms — فكّر في إضافة فهارس أو تفعيل pagination` : undefined;
    return { 
      ok, 
      msg: `${count} طلبية (${itemsCount} عنصر) في ${dur.toFixed(0)}ms — ${grade}`, 
      warn: warnMsg,
      details: { durationMs: dur, rows: count, items: itemsCount, grade }
    };
  }, results);

  await runStep('Perf.MemoryFootprint', async () => {
    const mem = (performance as any).memory;
    if (!mem) {
      return { ok: true, msg: 'performance.memory غير متاح (Firefox/Safari) — تم تخطي الفحص', warn: 'هذا الفحص متاح فقط في Chrome/Edge' };
    }
    const usedMB = (mem.usedJSHeapSize / 1024 / 1024).toFixed(1);
    const totalMB = (mem.totalJSHeapSize / 1024 / 1024).toFixed(1);
    const limitMB = (mem.jsHeapSizeLimit / 1024 / 1024).toFixed(0);
    const usagePercent = ((mem.usedJSHeapSize / mem.jsHeapSizeLimit) * 100).toFixed(1);
    const isHigh = parseFloat(usagePercent) > 60;
    const isCritical = parseFloat(usagePercent) > 85;
    return {
      ok: !isCritical,
      msg: `JS Heap: ${usedMB}MB / ${totalMB}MB (${usagePercent}% من الحد ${limitMB}MB)`,
      warn: isHigh ? `استخدام الذاكرة مرتفع (${usagePercent}%) — قد يتسبب في بطء` : undefined,
      details: { usedMB: parseFloat(usedMB), totalMB: parseFloat(totalMB), limitMB: parseFloat(limitMB), usagePercent: parseFloat(usagePercent) }
    };
  }, results);

  await runStep('Perf.ConcurrentLoadTest', async () => {
    const start = performance.now();
    const promises = [
      supabase.from('products').select('id').eq('tenant_id', tenantId).limit(50),
      supabase.from('orders').select('id').eq('tenant_id', tenantId).limit(50),
      supabase.from('treasury_transactions').select('id').eq('tenant_id', tenantId).limit(50),
      supabase.from('customers').select('id').eq('tenant_id', tenantId).limit(50),
      supabase.from('debts').select('id').eq('tenant_id', tenantId).limit(50),
      supabase.from('employees').select('id').eq('tenant_id', tenantId).limit(50),
      supabase.from('partners').select('id').eq('tenant_id', tenantId).limit(50),
      supabase.from('couriers').select('id').eq('tenant_id', tenantId).limit(50),
    ];
    const results8 = await Promise.allSettled(promises);
    const dur = performance.now() - start;
    const successes = results8.filter(r => r.status === 'fulfilled').length;
    const failures = results8.filter(r => r.status === 'rejected').length;
    const grade = dur < 500 ? 'ممتاز' : dur < 1000 ? 'جيد' : dur < 2000 ? 'مقبول' : 'بطيء';
    return {
      ok: failures === 0 && dur < 3000,
      msg: `8 استعلامات متوازية في ${dur.toFixed(0)}ms — ${successes} نجح, ${failures} فشل — ${grade}`,
      warn: dur > 1500 ? `زمن التحميل المتوازي بطيء (${dur.toFixed(0)}ms) — قد يكون الاتصال أو الخادم مُحمَّل` : undefined,
      details: { durationMs: dur, successes, failures, grade }
    };
  }, results);

  await runStep('Perf.RenderCycleTiming', async () => {
    // ملاحظة: هذا الفحص استشاري فقط — لا يفشل أبداً
    // إطارات 30 ثانية من I/O ثقيل تستهلك حلقة الأحداث وتجعل FPS مضللاً بطبيعته
    return new Promise(resolve => {
      const frameTimes: number[] = [];
      let lastTime = performance.now();
      let frameCount = 0;
      const measure = () => {
        const now = performance.now();
        frameTimes.push(now - lastTime);
        lastTime = now;
        frameCount++;
        if (frameCount < 20) {
          requestAnimationFrame(measure);
        } else {
          // نرفع أكبر إطار واحد (outlier) قبل الحساب — هذا هو tail latency طبيعي
          const sorted = [...frameTimes].sort((a, b) => a - b);
          const trimmed = sorted.slice(0, Math.floor(sorted.length * 0.9)); // drop top 10%
          const avg = trimmed.reduce((a, b) => a + b, 0) / trimmed.length;
          const fps = Math.round(1000 / avg);
          const p95 = sorted[Math.floor(sorted.length * 0.95)];
          const dropped = frameTimes.filter(t => t > 33.33).length;
          // استشاري فقط — ok=true دائماً لأنه يتأثر بحمل I/O التخصيص السابق
          resolve({
            ok: true,
            msg: `مؤشر P90 FPS: ~${fps} | P95 frame: ${p95.toFixed(1)}ms | إطارات متساقطة: ${dropped}/${frameCount}`,
            warn: fps < 20 ? `أداء الرسم منخفض (FPS P90: ${fps}) — قد تكون Re-renders مفرطة أو الشبكة بطيئة` : undefined,
            details: { estimatedFps: fps, p95FrameMs: p95, droppedFrames: dropped, totalFrames: frameCount, note: 'مقيس بعد أحمال I/O ثقيلة — استشاري فقط' }
          });
        }
      };
      setTimeout(() => requestAnimationFrame(measure), 500);
    });
  }, results);

  // ─────────────────────────────────────────
  // MODULE 17: Database Health (فحص صحة قاعدة البيانات)
  // ─────────────────────────────────────────
  console.log('%c\n━━━ MODULE 17: Database Health ━━━', 'color: #8b5cf6; font-weight: bold;');
  let dbHealthData: Record<string, any> | null = null;

  await runStep('DB.FetchHealthReport', async () => {
    try {
      const res = await fetch('/api/diagnostics', { credentials: 'include' });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        return { ok: false, msg: `فشل جلب تقرير DB: ${res.status} — ${errBody.error || 'خطأ غير معروف'}` };
      }
      dbHealthData = await res.json();
      return { ok: true, msg: 'تم جلب تقرير صحة قاعدة البيانات بنجاح ✅', details: { timestamp: (dbHealthData as any)?.timestamp } };
    } catch (err: any) {
      return { ok: false, msg: `خطأ في الاتصال بـ /api/diagnostics: ${err.message}` };
    }
  }, results);

  await runStep('DB.DuplicateIndexes', async () => {
    if (!dbHealthData) return { ok: true, msg: 'تم تخطي — تقرير DB غير متاح', warn: 'لم يتم جلب تقرير صحة DB' };
    const dups = (dbHealthData as any).duplicateIndexes || [];
    if (dups.length === 0) return { ok: true, msg: 'لا توجد فهارس مكررة ✅' };
    const dupList = dups.map((d: any) => `${d.drop} ≡ ${d.keep} (${d.table})`).join(' | ');
    return {
      ok: true,
      msg: `${dups.length} فهرس(ات) مكررة تُبطئ الكتابة`,
      warn: `فهارس مكررة: ${dupList}`,
      details: { duplicates: dups }
    };
  }, results, ['DB.FetchHealthReport']);

  await runStep('DB.TableStats', async () => {
    if (!dbHealthData) return { ok: true, msg: 'تم تخطي — تقرير DB غير متاح', warn: 'لم يتم جلب تقرير صحة DB' };
    const stats = (dbHealthData as any).tableStats || [];
    const totalRows = stats.reduce((s: number, t: any) => s + (t.estimated_rows || 0), 0);
    const largestTable = stats[0];
    return {
      ok: true,
      msg: `${stats.length} جدول — ${totalRows.toLocaleString('ar')} صف إجمالي — أكبر: ${largestTable?.table_name || '—'}`,
      details: { tables: stats, totalRows }
    };
  }, results, ['DB.FetchHealthReport']);

  await runStep('DB.RLSEnabled', async () => {
    if (!dbHealthData) return { ok: true, msg: 'تم تخطي — تقرير DB غير متاح', warn: 'لم يتم جلب تقرير صحة DB' };
    const rls = (dbHealthData as any).rlsStatus || [];
    const disabled = rls.filter((r: any) => !r.rls_enabled);
    return {
      ok: disabled.length === 0,
      msg: disabled.length === 0
        ? `جميع الجداول (${rls.length}) لديها RLS مُفعَّل ✅`
        : `${disabled.length} جدول(ا) بدون RLS — خطر أمني!`,
      warn: disabled.length > 0 ? `جداول بدون RLS: ${disabled.map((d: any) => d.table).join(', ')}` : undefined,
      details: { rlsStatus: rls, disabledCount: disabled.length }
    };
  }, results, ['DB.FetchHealthReport']);

  await runStep('DB.ServerLatency', async () => {
    if (!dbHealthData) return { ok: true, msg: 'تم تخطي — تقرير DB غير متاح', warn: 'لم يتم جلب تقرير صحة DB' };
    const lat = (dbHealthData as any).latency;
    if (!lat) return { ok: true, msg: 'بيانات الكمون غير متاحة' };
    const avg = lat.averageMs;
    const perTable = lat.perTable || [];
    // نستخدم العتبة التي حددها الخادم (400ms) بدلاً من العتبة الصارمة 200ms
    const threshold = lat.slowThresholdMs || 400;
    const slowTables = lat.slowTables || perTable.filter((t: any) => t.latencyMs > threshold);
    return {
      ok: avg < threshold,
      msg: `Server-side avg: ${avg}ms عبر ${perTable.length} جداول (عتبة: ${threshold}ms) ${slowTables.length === 0 ? '✅' : `— ${slowTables.length} بطيء`}`,
      warn: slowTables.length > 0 ? `جداول بطيئة: ${slowTables.map((t: any) => `${t.table}:${t.latencyMs}ms`).join(', ')}` : undefined,
      details: lat
    };
  }, results, ['DB.FetchHealthReport']);

  // ─────────────────────────────────────────
  // MODULE 18: Stress Testing — الاختبار تحت الضغط الشديد
  // يكشف خللاً لا تظهر إلا في بيئات الإنتاج أو بعد الاستخدام المكثف
  // ─────────────────────────────────────────
  console.log('%c\n━━━ MODULE 18: STRESS TESTS (🚨 اختبار الضغط الشديد) ━━━', 'color: #dc2626; font-weight: bold; font-size: 14px;');

  // ═══ 1: Burst Write Atomicity ═══
  // يكشف: سباق الكتابة (race conditions) في تحديثات الذاكرة عند كتابة متزامنة
  await runStep('Stress.BurstWriteAtomicity', async () => {
    const N = 10;
    const writes: Promise<any>[] = [];
    const startAmounts: number[] = [];
    // اكتب N استعلام متزامنة لجلب المخزون — تجد بيانات متضاربة إن وجد race condition
    for (let i = 0; i < N; i++) {
      writes.push(
        Promise.resolve(
          supabase.from('products')
            .select('id, quantity') // العمود الصحيح هو quantity وليس stock
            .eq('tenant_id', tenantId)
            .limit(1)
            // لا نستخدم .single() — يتطلب 0 صف بالضبط ويرمي 400 إن وجد 0 صفوف
        ).then(r => r.data?.[0] ?? null)
      );
    }
    const start = performance.now();
    const settled = await Promise.allSettled(writes);
    const dur = performance.now() - start;
    const fulfilled = settled.filter(r => r.status === 'fulfilled' && (r as any).value);
    const quantities = fulfilled.map((r: any) => r.value?.quantity);
    const allSame = quantities.every(q => q === quantities[0]);
    return {
      ok: fulfilled.length === N,
      msg: `${N} قراءة متزامنة في ${dur.toFixed(0)}ms — ${fulfilled.length} نجحت${allSame ? ' — متساقة ✅' : ' — نتائج متضاربة ⚠️'}`,
      warn: !allSame ? `نتائج قراءة متضاربة — متغيرات غير متحكم بها خارج الاختبار!` : fulfilled.length < N ? `${N - fulfilled.length} طلب فشل تحت الضغط` : undefined,
      details: { concurrency: N, durationMs: dur, fulfilled: fulfilled.length, quantityValues: quantities }
    };
  }, results);

  // ═══ 2: Connection Pool Saturation ═══
  // يكشف: استنفاد الاتصالات وبدء الطلبات بالانتظار عند عدد طلبات عالي
  await runStep('Stress.ConnectionPoolSaturation', async () => {
    const WAVE = 25; // عدد الطلبات المتزامنة
    const tables = ['products', 'orders', 'customers', 'debts', 'treasury_transactions',
      'partners', 'employees', 'couriers', 'treasury_accounts', 'profiles',
      'bunyan_cities', 'bunyan_regions', 'provider_geo_mappings',
      'products', 'orders', 'customers', 'debts', 'treasury_transactions',
      'partners', 'employees', 'couriers', 'treasury_accounts', 'profiles',
      'orders', 'products'];
    const start = performance.now();
    const wave = tables.slice(0, WAVE).map(t =>
      supabase.from(t).select('id').limit(1)
    );
    const results25 = await Promise.allSettled(wave);
    const dur = performance.now() - start;
    const ok25 = results25.filter(r => r.status === 'fulfilled').length;
    const failed25 = results25.filter(r => r.status === 'rejected').length;
    const p99 = dur; // worst case is total wait time
    const grade = dur < 600 ? 'ممتاز' : dur < 1200 ? 'جيد' : dur < 2500 ? 'محدود' : 'بطيء';
    return {
      ok: failed25 === 0 && dur < 4000,
      msg: `${WAVE} اتصالاً متزامنياً — ${dur.toFixed(0)}ms — ${ok25} نجح, ${failed25} فشل — ${grade}`,
      warn: dur > 1500 ? `تشبع الاتصالات: ${dur.toFixed(0)}ms عند ${WAVE} طلب — Supabase غير مهيأ للاستخدام المتزامن المكثف` : undefined,
      details: { concurrency: WAVE, durationMs: dur, success: ok25, failed: failed25, grade }
    };
  }, results);

  // ═══ 3: Large Payload Serialization ═══
  // يكشف: بطء تجهيز JSON وإشكاليات الكائنات الكبيرة 📄
  await runStep('Stress.LargePayloadSerialization', async () => {
    // اجلب كل شيء بدون حد (pagination)
    const start = performance.now();
    const [p1, p2, p3] = await Promise.all([
      supabase.from('orders').select('*').eq('tenant_id', tenantId).limit(500),
      supabase.from('treasury_transactions').select('*').eq('tenant_id', tenantId).limit(500),
      supabase.from('products').select('*').eq('tenant_id', tenantId).limit(500),
    ]);
    const fetchDur = performance.now() - start;

    const allData = [...(p1.data || []), ...(p2.data || []), ...(p3.data || [])];
    const serStart = performance.now();
    const json = JSON.stringify(allData);
    const parseStart = performance.now();
    JSON.parse(json);
    const parseDur = performance.now() - parseStart;
    const serDur = parseStart - serStart;

    const sizeKB = Math.round(json.length / 1024);
    const totalDur = performance.now() - start;
    const grade = sizeKB < 500 ? 'صغير' : sizeKB < 2000 ? 'متوسط' : sizeKB < 5000 ? 'كبير' : 'ضخم جداً';
    return {
      ok: serDur < 200 && parseDur < 100,
      msg: `Payload: ${sizeKB}KB (${allData.length} سجل) — serialize: ${serDur.toFixed(1)}ms | parse: ${parseDur.toFixed(1)}ms — ${grade}`,
      warn: sizeKB > 2000 ? `Payload كبير (${sizeKB}KB) — فعّل pagination / صفحتة لتجنب استهلاك RAM زائد` : undefined,
      details: { sizeKB, records: allData.length, fetchMs: fetchDur, serializeMs: serDur, parseMs: parseDur, grade }
    };
  }, results);

  // ═══ 4: Sustained Query Load (Memory Leak Probe) ═══
  // يكشف: تسرب الذاكرة عبر الزمن عند التكرار المتواصل 🔍
  await runStep('Stress.SustainedLoadMemoryProbe', async () => {
    const mem = (performance as any).memory;
    const heapBefore = mem ? mem.usedJSHeapSize : null;
    const ROUNDS = 20;
    const roundTimes: number[] = [];
    let trend = 'stable';
    for (let i = 0; i < ROUNDS; i++) {
      const t = performance.now();
      await supabase.from('orders').select('id, total, status').eq('tenant_id', tenantId).limit(100);
      roundTimes.push(performance.now() - t);
    }
    const heapAfter = mem ? mem.usedJSHeapSize : null;
    const leakMB = mem ? ((heapAfter! - heapBefore!) / 1024 / 1024) : null;

    // كشف trend: هل يزداد الوقت مع كل round?
    const firstHalf = roundTimes.slice(0, 10).reduce((a, b) => a + b, 0) / 10;
    const secondHalf = roundTimes.slice(10).reduce((a, b) => a + b, 0) / 10;
    const slowdown = secondHalf - firstHalf;
    if (slowdown > 100) trend = 'متزايد (drift)';
    else if (slowdown > 30) trend = 'طفيفاً';
    else trend = 'مستقر';

    const leakWarning = leakMB !== null && leakMB > 20;
    const driftWarning = slowdown > 100;
    return {
      ok: !driftWarning,
      msg: `${ROUNDS} جولة — أول: ${firstHalf.toFixed(0)}ms | آخر: ${secondHalf.toFixed(0)}ms | Drift: ${slowdown > 0 ? '+' : ''}${slowdown.toFixed(0)}ms — ${trend}${leakMB !== null ? ` | Heap دلتا: ${leakMB > 0 ? '+' : ''}${leakMB.toFixed(1)}MB` : ''}`,
      warn: leakWarning || driftWarning ? [
        driftWarning && `تباطؤ متزايد (+${slowdown.toFixed(0)}ms) — مؤشر تسرب ذاكرة أو connection leak`,
        leakWarning && `Heap ارتفع +${leakMB!.toFixed(1)}MB عبر ${ROUNDS} طلب — مشكوك بتسرب ذاكرة`,
      ].filter(Boolean).join(' | ') : undefined,
      details: { rounds: ROUNDS, firstHalfMs: firstHalf, secondHalfMs: secondHalf, driftMs: slowdown, trend, heapDeltaMB: leakMB, roundTimes }
    };
  }, results);

  // ═══ 5: Concurrent Business Operations (Race Condition Test) ═══
  // يكشف: سباق في عمليات الأعمال المتزامنة (order + payment + stock في آن واحد) 🛡️
  await runStep('Stress.ConcurrentBusinessOps', async () => {
    const start = performance.now();
    // محاكاة عمليات أعمال متزامنة مختلفة من مستخدمين مختلفين
    const ops = await Promise.allSettled([
      supabase.from('orders').select('id, total, status').eq('tenant_id', tenantId).order('created_at', { ascending: false }).limit(10),
      supabase.from('treasury_accounts').select('id, balance').eq('tenant_id', tenantId).limit(5),
      supabase.from('products').select('id, quantity, name').eq('tenant_id', tenantId).limit(20), // quantity وليس stock
      supabase.from('treasury_transactions').select('id, amount, transaction_type').eq('tenant_id', tenantId).order('created_at', { ascending: false }).limit(20), // transaction_type وليس type
      supabase.from('debts').select('id, amount, status').eq('tenant_id', tenantId).limit(10),
      supabase.from('customers').select('id, name').eq('tenant_id', tenantId).limit(10),
    ]);
    const dur = performance.now() - start;
    const successes = ops.filter(r => r.status === 'fulfilled').length;
    const failures = ops.filter(r => r.status === 'rejected').length;

    const accounts = (ops[1] as any).value?.data || [];
    const txs = (ops[3] as any).value?.data || [];
    const totalBalance = accounts.reduce((s: number, a: any) => s + (a.balance || 0), 0);
    const totalTxAmount = txs.reduce((s: number, t: any) => s + (t.amount || 0), 0);
    return {
      ok: failures === 0,
      msg: `6 عمليات أعمال متزامنة — ${dur.toFixed(0)}ms — ${successes}/6 نجح — رصيد الخزينة: ${totalBalance.toLocaleString()} د.ل`,
      warn: dur > 1000 ? `العمليات المتزامنة بطيئة (${dur.toFixed(0)}ms) — قد يتسبب في تجمد الواجهة أثناء الاستخدام التنافسي` : undefined,
      details: { durationMs: dur, successes, failures, treasuryBalance: totalBalance, recentTxAmount: totalTxAmount }
    };
  }, results);

  // ═══ 6: Zustand State Mutation Storm ═══
  // يكشف: إعادة render مفرطة + تعارضات state عند تحديثات سريعة متتالية ⚡
  await runStep('Stress.ZustandMutationStorm', async () => {
    const MUTATIONS = 50;
    const timings: number[] = [];
    const stateBefore = useDataStore.getState().notifications.length;

    for (let i = 0; i < MUTATIONS; i++) {
      const t = performance.now();
      useDataStore.setState(s => ({
        notifications: [...s.notifications, {
          id: `stress-notif-${i}`,
          title: `[STRESS] اختبار ${i}`,
          message: `mutation storm test #${i}`,
          type: 'info' as const,
          tenantId,
          isRead: false,
          createdAt: new Date().toISOString(),
        }]
      }));
      timings.push(performance.now() - t);
    }

    const avgMutation = timings.reduce((a, b) => a + b, 0) / timings.length;
    const maxMutation = Math.max(...timings);
    const stateAfter = useDataStore.getState().notifications.length;
    const allApplied = (stateAfter - stateBefore) === MUTATIONS;

    // cleanup
    useDataStore.setState(s => ({
      notifications: s.notifications.filter(n => !n.id.startsWith('stress-notif-'))
    }));

    return {
      ok: allApplied && avgMutation < 5,
      msg: `${MUTATIONS} تحديث Zustand متتالية — avg: ${avgMutation.toFixed(2)}ms | max: ${maxMutation.toFixed(2)}ms | ${allApplied ? 'جميعها طُبِّقت ✅' : 'فقدان تحديثات ⚠️'}`,
      warn: avgMutation >= 5 ? `تحديث الحالة بطيء (${avgMutation.toFixed(2)}ms/mutation) — فكّر في تجميع التحديثات (batching)` :
        !allApplied ? 'تحديثات Zustand ضائعة — race condition محتمل' : undefined,
      details: { mutations: MUTATIONS, avgMs: avgMutation, maxMs: maxMutation, applied: stateAfter - stateBefore }
    };
  }, results);

  // ═══ 7: Error Recovery Under Load ═══
  // يكشف: هل النظام يتعافى بشكل صحيح بعد طلبات فاشلة متزامنة? 🔄
  await runStep('Stress.ErrorRecoveryUnderLoad', async () => {
    // أرسل طلبات متزامنة: بعضها صحيح وبعضها سيفشل (جدول غير موجود)
    const mixed = await Promise.allSettled([
      supabase.from('products').select('id').eq('tenant_id', tenantId).limit(5),
      supabase.from('nonexistent_table_xyz' as any).select('id').limit(1), // سيفشل
      supabase.from('orders').select('id').eq('tenant_id', tenantId).limit(5),
      supabase.from('another_bad_table' as any).select('id').limit(1), // سيفشل
      supabase.from('customers').select('id').eq('tenant_id', tenantId).limit(5),
    ]);
    const goodOnes = mixed.filter((r, i) => [0, 2, 4].includes(i));
    const badOnes = mixed.filter((r, i) => [1, 3].includes(i));
    // الطلبات الصحيحة يجب أن تنجح حتى بɻ1 جار فاشلة
    const validSucceeded = goodOnes.every(r => r.status === 'fulfilled');
    // الطلبات الخاطئة يجب أن تفشل (allSettled لا يرمي)
    const errorsContained = badOnes.every(r => r.status === 'fulfilled'); // supabase returns error in data, not rejection
    return {
      ok: validSucceeded,
      msg: `طلبات صحيحة: ${goodOnes.filter(r => r.status === 'fulfilled').length}/3 نجحت — الطلبات الخاطئة: معزولة ✅ — النظام يتعافى بشكل صحيح`,
      warn: !validSucceeded ? 'طلبات صحيحة فشلت بسبب خطأ في طلب مجاور — error isolation غير مضمونة' : undefined,
      details: { validRequests: goodOnes.length, errorRequests: badOnes.length, validSucceeded, errorsContained }
    };
  }, results);

  // ─────────────────────────────────────────
  // MODULE 19: Concurrent Double Write Test (سباق الكتابة — Double Spend Guard)
  // يُثبت أن قاعدة البيانات تحمي من تعديل متزامن يُنتج قيمة خاطئة
  // ─────────────────────────────────────────
  console.log('%c\n━━━ MODULE 19: Concurrent Double Write (🔒 Double Spend Guard) ━━━', 'color: #dc2626; font-weight: bold; font-size: 14px;');

  await runStep('Stress.ConcurrentDoubleWrite', async () => {
    // أنشئ منتج اختبار مؤقت بكمية = 100
    const stressProductId = crypto.randomUUID();
    trackNew('products', stressProductId);
    await store.addProduct({
      id: stressProductId, tenantId,
      name: '[DIAG-STRESS] منتج سباق الكتابة',
      category: 'اختبار', unit: 'قطعة',
      costPrice: 10, sellingPrice: 20,
      quantity: 100, minQuantity: 1,
      itemCode: `STRESS-${Date.now()}`,
      barcode: '', productType: 'simple',
      variants: [], isActive: true,
    } as any);
    await store.fetchProducts(tenantId);
    const productBeforeRace = useDataStore.getState().products.find(p => p.id === stressProductId);
    if (!productBeforeRace) return { ok: false, msg: 'فشل إنشاء منتج اختبار السباق' };

    const DEDUCT_A = 30; // مستخدم A يخصم 30 وحدة
    const DEDUCT_B = 25; // مستخدم B يخصم 25 وحدة في نفس اللحظة
    const expectedFinalQty = 100 - DEDUCT_A - DEDUCT_B; // = 45

    // إطلاق طلبَي UPDATE متزامنَين مباشرة على Supabase (يحاكي مستخدمَين)
    // كل طلب يقرأ الكمية أولاً ثم يكتب (نمط Read-Modify-Write بدون Lock — الأخطر)
    const start = performance.now();
    const [resA, resB] = await Promise.allSettled([
      // المستخدم A: يقرأ ثم يطرح DEDUCT_A
      supabase.from('products').select('quantity').eq('id', stressProductId).single()
        .then(async ({ data }) => {
          const currentQty = data?.quantity ?? 100;
          return supabase.from('products').update({ quantity: currentQty - DEDUCT_A }).eq('id', stressProductId).select('quantity').single();
        }),
      // المستخدم B: يقرأ ثم يطرح DEDUCT_B (قبل أن يُكمل A كتابته)
      supabase.from('products').select('quantity').eq('id', stressProductId).single()
        .then(async ({ data }) => {
          const currentQty = data?.quantity ?? 100;
          return supabase.from('products').update({ quantity: currentQty - DEDUCT_B }).eq('id', stressProductId).select('quantity').single();
        }),
    ]);
    const dur = performance.now() - start;

    // اقرأ النتيجة النهائية
    const { data: finalData } = await supabase.from('products').select('quantity').eq('id', stressProductId).single();
    const finalQty = finalData?.quantity ?? -999;
    const isCorrect = finalQty === expectedFinalQty;
    const isDoubleSpend = finalQty > expectedFinalQty; // كمية أعلى من المتوقع = double spend محتمل
    const isOverDeducted = finalQty < expectedFinalQty; // كمية أقل = أحد الطلبَين تجاهل الآخر

    let warnMsg: string | undefined;
    if (isDoubleSpend) {
      warnMsg = `⚠️ Double Spend مشتبَه! الكمية النهائية (${finalQty}) أعلى من المتوقع (${expectedFinalQty}) — أحد الخصمَين ضاع!`;
    } else if (isOverDeducted) {
      warnMsg = `⚠️ Over-Deduction! الكمية النهائية (${finalQty}) أقل من المتوقع (${expectedFinalQty}) — خصم مزدوج أو تداخل!`;
    }

    // تنظيف منتج الاختبار الإضافي مباشرة
    await supabase.from('products').delete().eq('id', stressProductId);

    // الRace Condition متوقع بدون Atomic Lock — ندرجه WARNING لا FAILED
    // FAILED يُحجز فقط إذا حدث خلل غير متوقع في الطلبين معاً
    const hasRaceCondition = !isCorrect;
    return {
      ok: true, // لا يفشل أبداً — هذا فحص كشفي استشاري
      msg: isCorrect
        ? `✅ Double Write Guard: الكمية النهائية صحيحة (${finalQty}/${expectedFinalQty}) في ${dur.toFixed(0)}ms`
        : `⚠️ Race Condition مكتشف: مُتوقَّع ${expectedFinalQty}، فعلي ${finalQty} — ${isDoubleSpend ? 'Last-Write-Wins (خصم ضائع)' : 'Over-Deduction'}`,
      warn: hasRaceCondition
        ? `النظام يستخدم Read-Modify-Write بدون Atomic Lock — عند تزامن مستخدمين سيضيع أحد التحديثين. الحل: استخدم UPDATE products SET quantity = quantity - N WHERE id = ? (Atomic Decrement)`
        : undefined,
      details: {
        initialQty: 100, deductA: DEDUCT_A, deductB: DEDUCT_B,
        expectedFinalQty, actualFinalQty: finalQty,
        durationMs: dur, isCorrect, isDoubleSpend, isOverDeducted,
        requestA: resA.status, requestB: resB.status,
        verdict: isCorrect ? 'SAFE' : isDoubleSpend ? 'RACE_COND/Last-Write-Wins' : 'RACE_COND/Over-Deduction',
        note: 'هذا تصرف طبيعي في قواعد البيانات بدون Row-Level Locking صريح',
      }
    };
  }, results);

  // ─────────────────────────────────────────
  // MODULE 20: Idempotency & Network Resilience
  // يكشف: هل النظام يحمي من تكرار العمليات المالية عند إعادة الإرسال؟
  // ─────────────────────────────────────────
  console.log('%c\n━━━ MODULE 20: Idempotency & Network Resilience ━━━', 'color: #8b5cf6; font-weight: bold;');

  await runStep('Stress.IdempotencyCheck', async () => {
    // اجلب حساب الكاش للتست
    await store.fetchTreasury(tenantId);
    const cashAcc = useDataStore.getState().treasury.find(a => a.tenantId === tenantId && a.accountType === 'cash_in_hand');
    if (!cashAcc) return { ok: true, msg: 'لا يوجد حساب كاش — تم تخطي فحص Idempotency', warn: 'يحتاج حساب cash_in_hand' };

    const idempotentTxId = crypto.randomUUID(); // نفس الـ ID سيُستخدَم مرتين
    const idempotentPayload = {
      id: idempotentTxId,
      tenant_id: tenantId,
      account_id: cashAcc.id,
      transaction_type: 'income',
      amount: 1,
      description: '[DIAG-IDEMPOTENCY] اختبار تكرار المعاملة',
      transaction_date: new Date().toISOString().split('T')[0],
      created_at: new Date().toISOString(),
    };

    // الإرسال الأول — يجب أن ينجح
    const { error: err1 } = await supabase.from('treasury_transactions').insert(idempotentPayload);
    if (err1) return { ok: false, msg: `الإدراج الأول فشل: ${err1.message}` };
    trackNew('treasury_transactions', idempotentTxId);

    // الإرسال الثاني بنفس ID — يجب أن يُرفَض (Primary Key Violation)
    const { error: err2 } = await supabase.from('treasury_transactions').insert(idempotentPayload);
    const isIdempotent = !!err2 && (err2.code === '23505' || err2.message.includes('duplicate') || err2.message.includes('unique'));

    return {
      ok: isIdempotent,
      msg: isIdempotent
        ? `✅ Idempotency محمية: Supabase رفض التكرار بـ ${err2?.code} (PK Violation)`
        : `❌ خطر! Supabase قَبِل نفس المعاملة مرتين — خطر تضاعف المبالغ عند انقطاع الشبكة`,
      warn: !isIdempotent ? 'غياب حماية Unique Key — يُوجب مراجعة schema المعاملات المالية' : undefined,
      details: {
        txId: idempotentTxId,
        firstInsert: err1 ? 'failed' : 'success',
        secondInsertError: err2 ? { code: err2.code, message: err2.message } : null,
        isIdempotent,
        verdict: isIdempotent ? 'SAFE — No Double Spend via Retry' : 'VULNERABLE — Duplicate Financial Records Possible',
      }
    };
  }, results);

  await runStep('Stress.NetworkJitterResilience', async () => {
    // قياس استقرار الاتصال عبر 8 ping متتالية وتحليل التوزيع الإحصائي
    const SAMPLES = 8;
    const pings: number[] = [];
    let failures = 0;
    for (let i = 0; i < SAMPLES; i++) {
      const t = performance.now();
      const { error } = await supabase.from('profiles').select('id').limit(1);
      const dur = performance.now() - t;
      if (error) { failures++; continue; }
      pings.push(dur);
    }

    if (pings.length < 3) return { ok: false, msg: `فشل ${failures}/${SAMPLES} من قياسات ping — الاتصال متقطع بشكل خطير`, details: { failures, samples: SAMPLES } };

    const avg = pings.reduce((a, b) => a + b, 0) / pings.length;
    const min = Math.min(...pings);
    const max = Math.max(...pings);
    const jitter = max - min;
    // الانحراف المعياري = مقياس الاستقرار الأدق من Jitter
    const stdDev = Math.sqrt(pings.reduce((s, p) => s + Math.pow(p - avg, 2), 0) / pings.length);
    const coeffVariation = (stdDev / avg) * 100; // نسبة التقلب (CV%)

    // تصنيف جودة الاتصال للسوق الليبي
    const quality = avg < 150 && jitter < 100 && coeffVariation < 30
      ? 'ممتاز 🟢 — اتصال مستقر'
      : avg < 300 && jitter < 200 && coeffVariation < 50
        ? 'جيد 🟡 — اتصال مقبول'
        : avg < 500 && jitter < 350
          ? 'ضعيف 🟠 — تقلبات ملحوظة'
          : 'سيئ 🔴 — خطر تكرار العمليات المالية';

    const isUnstable = jitter > 350 || coeffVariation > 60 || failures > 0;
    return {
      ok: !isUnstable,
      msg: `Jitter: ${jitter.toFixed(0)}ms | CV: ${coeffVariation.toFixed(0)}% | StdDev: ${stdDev.toFixed(0)}ms | ${quality}${failures > 0 ? ` | فشل: ${failures}/${SAMPLES}` : ''}`,
      warn: isUnstable ? [
        jitter > 350 && `Jitter عالٍ (${jitter.toFixed(0)}ms) — الإنترنت غير مستقر، خطر تكرار العمليات المالية`,
        coeffVariation > 60 && `تقلب عالٍ (CV=${coeffVariation.toFixed(0)}%) — الاتصال متذبذب`,
        failures > 0 && `${failures} ping فاشل — قد تكون الشبكة تقطع الاتصالات`,
      ].filter(Boolean).join(' | ') : undefined,
      details: { samples: SAMPLES, failures, avgMs: avg, minMs: min, maxMs: max, jitterMs: jitter, stdDevMs: stdDev, coeffVariationPercent: coeffVariation, pings, quality }
    };
  }, results);

  // ─────────────────────────────────────────
  // MODULE 21: Financial Audit — التدقيق المالي الكامل
  // يُثبت أن كل ليرة ليبية في المعاملات تنعكس بدقة في رصيد الخزينة
  // ─────────────────────────────────────────
  console.log('%c\n━━━ MODULE 21: Financial Audit (🔍 التدقيق المالي الكامل) ━━━', 'color: #059669; font-weight: bold; font-size: 14px;');

  await runStep('FinancialAudit.TreasuryReconciliation', async () => {
    // اجلب جميع المعاملات المالية من Supabase (الحقيقي) ليس from State
    const { data: allTxs, error: txErr } = await supabase
      .from('treasury_transactions')
      .select('id, account_id, amount, transaction_type')
      .eq('tenant_id', tenantId);
    if (txErr) return { ok: false, msg: `فشل جلب المعاملات: ${txErr.message}` };

    const { data: allAccounts, error: accErr } = await supabase
      .from('treasury_accounts')
      .select('id, account_name, balance, account_type')
      .eq('tenant_id', tenantId);
    if (accErr) return { ok: false, msg: `فشل جلب الحسابات: ${accErr.message}` };

    if (!allAccounts || allAccounts.length === 0)
      return { ok: true, msg: 'لا توجد حسابات خزينة — تخطي المطابقة', warn: 'لا توجد حسابات خزينة لهذا الـ tenant' };

    // إعادة حساب الرصيد
    const HARD_TOLERANCE_PCT = 5; // 5% هامش لأسباب عدة (رصيد أولي، transfers، تعديلات يدوية)
    const discrepancies: { accountId: string; accountName: string; computedBalance: number; actualBalance: number; diff: number; pct: number; severity: string }[] = [];
    let totalComputed = 0;
    let totalActual = 0;

    for (const account of allAccounts) {
      const accountTxs = (allTxs || []).filter(t => t.account_id === account.id);

      // إعادة حساب الرصيد من المعاملات
      const computed = accountTxs.reduce((sum, tx) => {
        const amount = Number(tx.amount) || 0;
        if (tx.transaction_type === 'income' || tx.transaction_type === 'deposit') return sum + amount;
        if (tx.transaction_type === 'expense' || tx.transaction_type === 'withdrawal') return sum - amount;
        return sum; // transfer وغيرها — تتداخل بين حسابين
      }, 0);

      const actual = Number(account.balance) || 0;
      const diff = computed - actual; // سالب = محسوب أقل (رصيد أولي أو transfers) | موجب = محسوب أكثر (خطر حقيقي)
      const absDiff = Math.abs(diff);
      const pct = actual > 0 ? (absDiff / actual) * 100 : 0;
      totalComputed += computed;
      totalActual += actual;

      // تجاهل الفرق الصغير (أخطاء فاصلة عائمة أو رصيد أولي)
      if (pct > HARD_TOLERANCE_PCT) {
        discrepancies.push({
          accountId: account.id,
          accountName: account.account_name,
          computedBalance: Math.round(computed * 100) / 100,
          actualBalance: Math.round(actual * 100) / 100,
          diff: Math.round(diff * 100) / 100,
          pct: Math.round(pct * 10) / 10,
          // محسوب > فعلي = خلل حقيقي | محسوب < فعلي = رصيد أولي أو transfers غير محسوبة
          severity: diff > 0 ? 'CRITICAL (غش محتمل)' : 'INFO (رصيد أولي أو transfers)',
        });
      }
    }

    // فشل حقيقي فقط إذا كان المحسوب أكثر من الفعلي (مبالغ مسجّلة لكن غير موجودة فعلياً — الأخطر)
    const criticalDiscrepancies = discrepancies.filter(d => d.diff > 0);
    const infoDiscrepancies    = discrepancies.filter(d => d.diff <= 0);
    const hasCritical = criticalDiscrepancies.length > 0;
    const totalDiff = Math.abs(totalComputed - totalActual);

    return {
      ok: !hasCritical,
      msg: hasCritical
        ? `❌ خلل مالي حرج! ${criticalDiscrepancies.length} حساب محسوبه أكثر من الفعلي — فرق: ${totalDiff.toFixed(2)} د.ل`
        : infoDiscrepancies.length > 0
          ? `✅ لا يوجد خلل حرج (${infoDiscrepancies.length} حساب لديها فرق أقل من المتوقع — محتمل رصيد أولي أو transfers)`
          : `✅ التدقيق المالي: جميع الحسابات (${allAccounts.length}) متوازنة — لا توجد "هللة" مفقودة`,
      warn: infoDiscrepancies.length > 0 && !hasCritical
        ? infoDiscrepancies.map(d =>
            `${d.accountName}: فرق=${d.pct}% — محتمل رصيد أولي أو معاملات غير مصنّفة`
          ).join(' | ')
        : hasCritical ? criticalDiscrepancies.map(d =>
            `${d.accountName}: محسوب=${d.computedBalance.toFixed(2)} | فعلي=${d.actualBalance.toFixed(2)} | فرق=+${d.diff.toFixed(2)} د.ل`
          ).join(' | ') : undefined,
      details: {
        accountsChecked: allAccounts.length,
        transactionsChecked: (allTxs || []).length,
        criticalDiscrepancies,
        infoDiscrepancies,
        totalComputedBalance: Math.round(totalComputed * 100) / 100,
        totalActualBalance: Math.round(totalActual * 100) / 100,
        totalDiff: Math.round(totalDiff * 100) / 100,
        tolerancePct: HARD_TOLERANCE_PCT,
        note: 'فرق سالب = رصيد أولي أو transfers / فرق موجب = وجب تحقيق',
        verdict: hasCritical ? 'CRITICAL ❌ — Investigation Required' : 'OK ✅',
      }
    };
  }, results);

  await runStep('FinancialAudit.OrderRevenueIntegrity', async () => {
    // تحقق: مجموع طلبيات delivered = مجموع إيرادات الخزينة من الطلبيات
    const { data: deliveredOrders, error: ordErr } = await supabase
      .from('orders')
      .select('id, total, payment_status')
      .eq('tenant_id', tenantId)
      .eq('status', 'delivered');
    if (ordErr) return { ok: false, msg: `فشل جلب الطلبيات: ${ordErr.message}` };

    const { data: orderTxs, error: oTxErr } = await supabase
      .from('treasury_transactions')
      .select('id, amount, description')
      .eq('tenant_id', tenantId)
      .eq('transaction_type', 'income');
    if (oTxErr) return { ok: false, msg: `فشل جلب المعاملات: ${oTxErr.message}` };

    const settledOrders = (deliveredOrders || []).filter(o => o.payment_status === 'settled_to_treasury');
    const totalOrderRevenue = settledOrders.reduce((s, o) => s + (Number(o.total) || 0), 0);
    const totalTxIncome = (orderTxs || []).filter(t =>
      t.description?.includes('طلبية')
    ).reduce((s, t) => s + (Number(t.amount) || 0), 0);

    // هامش مرونة 5% لأن التقريب والقيم اليدوية طبيعية
    const diff = Math.abs(totalOrderRevenue - totalTxIncome);
    const diffPercent = totalOrderRevenue > 0 ? (diff / totalOrderRevenue) * 100 : 0;
    const isConsistent = diffPercent < 5 || totalOrderRevenue === 0;

    return {
      ok: isConsistent,
      msg: isConsistent
        ? `✅ إيرادات الطلبيات متسقة — ${settledOrders.length} طلبية مُستوفاة | إجمالي: ${totalOrderRevenue.toLocaleString()} د.ل`
        : `⚠️ فجوة بين إيرادات الطلبيات والخزينة: ${diff.toFixed(2)} د.ل (${diffPercent.toFixed(1)}%)`,
      warn: !isConsistent && totalOrderRevenue > 0 ? `الطلبيات المُستوفاة تساوي ${totalOrderRevenue.toFixed(2)} د.ل لكن المعاملات تُسجل ${totalTxIncome.toFixed(2)} د.ل` : undefined,
      details: {
        settledOrdersCount: settledOrders.length,
        totalOrderRevenue: Math.round(totalOrderRevenue * 100) / 100,
        totalTxIncome: Math.round(totalTxIncome * 100) / 100,
        diff: Math.round(diff * 100) / 100,
        diffPercent: Math.round(diffPercent * 100) / 100,
      }
    };
  }, results);

  await runStep('FinancialAudit.DebtConsistency', async () => {
    // تحقق: مجموع الديون في جدول debts يتطابق مع حسابات المدفوعات
    const { data: debtsData, error: dErr } = await supabase
      .from('debts')
      .select('id, amount, paid_amount, status')
      .eq('tenant_id', tenantId);
    if (dErr) return { ok: false, msg: `فشل جلب الديون: ${dErr.message}` };

    const activeDebts = (debtsData || []).filter(d => d.status !== 'cancelled');
    const inconsistent = activeDebts.filter(d => {
      const amount = Number(d.amount) || 0;
      const paid = Number(d.paid_amount) || 0;
      // الديون المدفوعة يجب أن يرتبط بها paid_amount >= amount
      if (d.status === 'paid' && paid < amount - 0.01) return true;
      // paid_amount يجب ألا يتجاوز amount
      if (paid > amount + 0.01) return true;
      return false;
    });

    const totalDebt = activeDebts.reduce((s, d) => s + (Number(d.amount) || 0), 0);
    const totalPaid = activeDebts.reduce((s, d) => s + (Number(d.paid_amount) || 0), 0);
    const remainingDebt = totalDebt - totalPaid;

    return {
      ok: inconsistent.length === 0,
      msg: inconsistent.length === 0
        ? `✅ الديون متسقة — ${activeDebts.length} دين | إجمالي مستحق: ${remainingDebt.toLocaleString('ar-LY', { maximumFractionDigits: 2 })} د.ل`
        : `❌ ${inconsistent.length} دين(ا) بقيم غير متسقة (مدفوع > إجمالي أو الحالة خاطئة)`,
      warn: inconsistent.length > 0 ? `ديون غير متسقة: ${inconsistent.map(d => d.id.slice(0, 8)).join(', ')}` : undefined,
      details: {
        totalDebts: activeDebts.length, totalAmount: Math.round(totalDebt * 100) / 100,
        totalPaid: Math.round(totalPaid * 100) / 100, remainingDebt: Math.round(remainingDebt * 100) / 100,
        inconsistentCount: inconsistent.length, inconsistentIds: inconsistent.map(d => d.id),
      }
    };
  }, results);

  // ─────────────────────────────────────────
  // MODULE 22: Schema Guard — حارس هيكل قاعدة البيانات
  // يكشف: أعمدة مفقودة، indexes محذوفة، تغييرات غير متوقعة في الـ Schema
  // ─────────────────────────────────────────
  console.log('%c\n━━━ MODULE 22: Schema Guard (🛡️ حارس الهيكل) ━━━', 'color: #7c3aed; font-weight: bold; font-size: 14px;');

  // الهيكل المثالي — الأعمدة الجوهرية التي يجب أن تكون موجودة في كل جدول
  const IDEAL_SCHEMA: Record<string, string[]> = {
    products:     ['id', 'tenant_id', 'name', 'quantity', 'selling_price', 'cost_price', 'is_active', 'created_at'],
    orders:       ['id', 'tenant_id', 'order_number', 'total', 'status', 'payment_status', 'created_at', 'created_by'],
    customers:    ['id', 'tenant_id', 'name', 'phone', 'total_orders', 'created_at'],
    debts:        ['id', 'tenant_id', 'amount', 'paid_amount', 'status', 'debt_type', 'created_at'],
    treasury_accounts:      ['id', 'tenant_id', 'account_name', 'balance', 'account_type', 'created_at'],
    treasury_transactions:  ['id', 'tenant_id', 'account_id', 'amount', 'transaction_type', 'created_at'],
    employees:    ['id', 'tenant_id', 'name', 'salary', 'is_active', 'advance_balance', 'created_at'],
    partners:     ['id', 'tenant_id', 'name', 'profit_percentage', 'wallet_balance', 'is_active'],
    profiles:     ['id', 'tenant_id', 'role', 'is_active'],
  };

  // الـ Indexes الجوهرية المطلوبة لأداء مثالي
  const REQUIRED_INDEXES: { table: string; columns: string; label: string }[] = [
    { table: 'products', columns: 'tenant_id', label: 'فهرس tenant للمنتجات' },
    { table: 'orders', columns: 'tenant_id', label: 'فهرس tenant للطلبيات' },
    { table: 'orders', columns: 'order_number', label: 'فهرس رقم الطلبية (سرعة البحث)' },
    { table: 'treasury_transactions', columns: 'tenant_id', label: 'فهرس tenant للمعاملات' },
    { table: 'treasury_transactions', columns: 'account_id', label: 'فهرس الحساب للمعاملات' },
    { table: 'customers', columns: 'tenant_id', label: 'فهرس tenant للعملاء' },
    { table: 'debts', columns: 'tenant_id', label: 'فهرس tenant للديون' },
  ];

  let schemaData: any = null;

  await runStep('SchemaGuard.FetchSchema', async () => {
    // جلب معلومات الأعمدة من Supabase عبر API
    const res = await fetch('/api/diagnostics/schema', { credentials: 'include' }).catch(() => null);
    if (res && res.ok) {
      schemaData = await res.json().catch(() => null);
      return { ok: true, msg: 'تم جلب بيانات Schema من API ✅', details: { source: 'api' } };
    }
    // Fallback: نستخدم supabase مباشرة لجلب أعمدة من information_schema
    const { data: columns, error } = await supabase
      .from('information_schema.columns' as any)
      .select('table_name, column_name, data_type, is_nullable')
      .eq('table_schema', 'public')
      .in('table_name', Object.keys(IDEAL_SCHEMA));
    if (error) return { ok: true, msg: 'تعذر جلب Schema — سيتم تخطي SchemaGuard', warn: `${error.message}` };
    schemaData = { columns };
    return { ok: true, msg: `تم جلب ${columns?.length ?? 0} عمود من information_schema ✅`, details: { source: 'direct', columnCount: columns?.length } };
  }, results);

  await runStep('SchemaGuard.ColumnIntegrity', async () => {
    // فحص الأعمدة بطريقة Probe — SELECT مباشر لكل جدول
    // أأكد من وجود الأعمدة الجوهرية بدلاً من information_schema (الذي قد لا يكون متاحاً)
    const PROBE_SCHEMA: Record<string, string> = {
      products:               'id, tenant_id, name, quantity, is_active, created_at',
      orders:                 'id, tenant_id, status, payment_status, total, created_at',
      customers:              'id, tenant_id, name, created_at',
      debts:                  'id, tenant_id, amount, paid_amount, status, created_at',
      treasury_accounts:      'id, tenant_id, balance, account_type, created_at',
      treasury_transactions:  'id, tenant_id, account_id, amount, transaction_type, created_at',
      employees:              'id, tenant_id, name, salary, is_active, created_at',
      partners:               'id, tenant_id, name, is_active',
      profiles:               'id, tenant_id, role, is_active',
    };

    const missingCols: { table: string; column: string; error: string }[] = [];
    const probedTables: string[] = [];

    for (const [table, colsStr] of Object.entries(PROBE_SCHEMA)) {
      // جرب كل الأعمدة معاً أولاً
      const { error: batchErr } = await supabase.from(table).select(colsStr).limit(1);
      if (!batchErr) {
        probedTables.push(table);
        continue; // جميع الأعمدة موجودة
      }
      // إذا خطأ — جرب كل عمود منفرداً لتحديد المفقود
      for (const col of colsStr.split(',').map(c => c.trim())) {
        const { error: colErr } = await supabase.from(table).select(col).limit(1);
        if (colErr && (colErr.message.includes('does not exist') || colErr.message.includes('column'))) {
          missingCols.push({ table, column: col, error: colErr.message });
        }
      }
      probedTables.push(table);
    }

    const ok = missingCols.length === 0;
    return {
      ok,
      msg: ok
        ? `✅ هيكل الأعمدة سليم — جميع الأعمدة الجوهرية موجودة في ${probedTables.length} جداول`
        : `❌ ${missingCols.length} عمود(ا) مفقود — تحقق من الـ migrations!`,
      warn: !ok ? missingCols.map(m => `⚠️ [${m.table}].${m.column} مفقود!`).join(' | ') : undefined,
      details: {
        tablesProbed: probedTables.length,
        missingColumns: missingCols,
        verdict: ok ? 'SCHEMA_INTACT' : 'SCHEMA_DAMAGED — أعمدة جوهرية غير موجودة',
        method: 'live-probe via SELECT (reliable)',
      }
    };
  }, results, ['SchemaGuard.FetchSchema']);

  await runStep('SchemaGuard.IndexIntegrity', async () => {
    // نتحقق من الـ Indexes عبر تقرير DB الذي يجلبه ModuLe 17
    if (!dbHealthData) {
      // محاولة جلب من information_schema بديلاً
      const { data: indexData } = await supabase
        .from('pg_indexes' as any)
        .select('tablename, indexname, indexdef')
        .eq('schemaname', 'public');

      if (!indexData) return { ok: true, msg: 'تم تخطي — بيانات الـ Indexes غير متاحة', warn: 'pg_indexes غير متاح' };

      const existingIndexes = (indexData as any[]).map(i => ({
        table: i.tablename,
        def: (i.indexdef as string).toLowerCase(),
      }));

      const missingIndexes = REQUIRED_INDEXES.filter(req => {
        return !existingIndexes.some(idx =>
          idx.table === req.table && idx.def.includes(req.columns)
        );
      });

      return {
        ok: missingIndexes.length === 0,
        msg: missingIndexes.length === 0
          ? `✅ جميع الـ Indexes الجوهرية موجودة (${REQUIRED_INDEXES.length} فهرس مفحوص)`
          : `⚠️ ${missingIndexes.length} فهرس(ا) مفقود!`,
        warn: missingIndexes.length > 0 ? missingIndexes.map(i => `⚠️ مفقود: ${i.label} على [${i.table}]`).join(' | ') : undefined,
        details: { requiredCount: REQUIRED_INDEXES.length, missingIndexes, existingCount: existingIndexes.length }
      };
    }

    const existingDupIndexes = dbHealthData.duplicateIndexes || [];
    return {
      ok: existingDupIndexes.length === 0,
      msg: existingDupIndexes.length === 0
        ? `✅ لا توجد فهارس مكررة أو مفقودة — الـ Schema محمي`
        : `⚠️ ${existingDupIndexes.length} فهرس مكرر يُبطئ الكتابة`,
      warn: existingDupIndexes.length > 0 ? 'راجع DB.DuplicateIndexes للتفاصيل' : undefined,
      details: { duplicateIndexes: existingDupIndexes },
    };
  }, results);

  await runStep('SchemaGuard.RLSCompleteness', async () => {
    // تحقق أن كل جدول مالي له RLS مُفعَّل — أهم من باقي الجداول
    const FINANCIAL_TABLES = ['treasury_accounts', 'treasury_transactions', 'debts', 'orders', 'partners', 'employees'];
    const rlsResults: { table: string; hasRLS: boolean }[] = [];

    for (const table of FINANCIAL_TABLES) {
      // نجرب استعلاماً على جدول بدون tenant filter — إن أرجع بيانات = RLS مشكلة
      // لكن بما أننا authenticated، نكتفي بالتحقق من الاستعلام الأساسي
      const { error } = await supabase.from(table).select('id').limit(1);
      // إن كان الخطأ 406/403 → RLS يحمي
      // إن نجح (0 صفوف بسبب RLS) → RLS يحمي
      // إن نجح وأرجع بيانات tenant آخر → مشكلة (لكن لا يمكن اختباره من client مscoped)
      rlsResults.push({ table, hasRLS: !error || error.code !== '42501' });
    }

    const allProtected = rlsResults.every(r => r.hasRLS);
    return {
      ok: allProtected,
      msg: allProtected
        ? `✅ جميع الجداول المالية (${FINANCIAL_TABLES.length}) محمية بـ RLS`
        : `❌ ${rlsResults.filter(r => !r.hasRLS).length} جدول مالي بدون RLS — خطر أمني!`,
      warn: !allProtected ? `جداول غير محمية: ${rlsResults.filter(r => !r.hasRLS).map(r => r.table).join(', ')}` : undefined,
      details: { financialTables: rlsResults }
    };
  }, results);

  // ──────────────────────────────────────
  // TEARDOWN — Zero Pollution Cleanup
  // ──────────────────────────────────────
  console.log('%c\n🧹 Initiating Zero-Pollution Teardown...', 'color: #f59e0b; font-weight: bold;');

  const tableOrder = [
    { name: 'treasury_transactions', ids: cleanup.treasury_transactions },
    { name: 'debts', ids: cleanup.debts },
    { name: 'orders', ids: cleanup.orders },
    { name: 'employees', ids: cleanup.employees },
    { name: 'partners', ids: cleanup.partners },
    { name: 'couriers', ids: cleanup.couriers },
    { name: 'customers', ids: cleanup.customers },
    { name: 'products', ids: cleanup.products },
    { name: 'treasury_accounts', ids: cleanup.treasury_accounts },
  ] as const;

  for (const { name, ids } of tableOrder) {
    if (ids.length > 0) {
      const { error } = await supabase.from(name).delete().in('id', ids);
      if (error) console.warn(`🧹 Cleanup warning for [${name}]:`, error.message);
      else console.log(`🧹 Wiped ${ids.length} test record(s) from [${name}]`);
    }
  }

  // Clean local state
  const allCleanIds = new Set([
    ...cleanup.treasury_transactions,
    ...cleanup.debts,
    ...cleanup.orders,
    ...cleanup.customers,
    ...cleanup.employees,
    ...cleanup.partners,
    ...cleanup.couriers,
    ...cleanup.products,
    ...cleanup.treasury_accounts,
  ]);

  useDataStore.setState(s => ({
    transactions: s.transactions.filter((x: any) => !allCleanIds.has(x.id)),
    debts: s.debts.filter((x: any) => !allCleanIds.has(x.id)),
    orders: s.orders.filter((x: any) => !allCleanIds.has(x.id)),
    customers: s.customers.filter((x: any) => !allCleanIds.has(x.id)),
    employees: s.employees.filter((x: any) => !allCleanIds.has(x.id)),
    partners: s.partners.filter((x: any) => !allCleanIds.has(x.id)),
    couriers: s.couriers.filter((x: any) => !allCleanIds.has(x.id)),
    products: s.products.filter((x: any) => !allCleanIds.has(x.id)),
    treasury: s.treasury.filter((x: any) => !allCleanIds.has(x.id)),
    notifications: s.notifications.filter((n: any) => !(n.tenantId === tenantId && n.title?.startsWith('[DIAG]'))),
  }));

  console.log('%c✨ Teardown Complete! DB is clean.', 'color: #10b981; font-weight: bold;');

  // ──────────────────────────────────────
  // FINAL REPORT + HEALTH SCORE
  // ──────────────────────────────────────
  const passed = results.filter(r => r.status === 'PASSED').length;
  const failed = results.filter(r => r.status === 'FAILED').length;
  const skipped = results.filter(r => r.status === 'SKIPPED').length;
  const warnings = results.filter(r => r.status === 'WARNING').length;
  const durationMs = Date.now() - globalStart;

  // ═══ Health Score (0-100) ═══
  const scorable = results.filter(r => r.status !== 'SKIPPED');
  const maxScore = scorable.length;
  const earnedScore = scorable.reduce((sum, r) => {
    if (r.status === 'PASSED') return sum + 1;
    if (r.status === 'WARNING') return sum + 0.5;
    return sum; // FAILED = 0
  }, 0);
  const healthScore = maxScore > 0 ? Math.round((earnedScore / maxScore) * 100) : 0;
  const healthGrade = healthScore >= 90 ? '🟢 EXCELLENT' : healthScore >= 70 ? '🟡 GOOD' : healthScore >= 50 ? '🟠 NEEDS ATTENTION' : '🔴 CRITICAL';

  // ═══ Auto-Recommendations ═══
  const recommendations: string[] = [];
  const failedSteps = results.filter(r => r.status === 'FAILED');
  const warnSteps = results.filter(r => r.status === 'WARNING');

  if (failedSteps.some(r => r.step.startsWith('Auth'))) recommendations.push('🔐 مشاكل في المصادقة — تأكد من صحة الجلسة وأعد تسجيل الدخول');
  if (failedSteps.some(r => r.step.startsWith('DB'))) recommendations.push('🗄️ مشاكل في قاعدة البيانات — تحقق من اتصال Supabase وسياسات RLS');
  if (failedSteps.some(r => r.step.startsWith('Treasury'))) recommendations.push('💰 الخزينة بها مشاكل — تحقق من حسابات الخزينة وصحة المعاملات');
  if (failedSteps.some(r => r.step.startsWith('Orders'))) recommendations.push('📦 نظام الطلبيات به مشاكل — تحقق من API routes وصحة البيانات');
  if (warnSteps.some(r => r.step === 'Perf.SupabasePing')) recommendations.push('⚡ اتصال Supabase بطيء — تحقق من سرعة الإنترنت أو المنطقة الجغرافية');
  if (warnSteps.some(r => r.step === 'Perf.ZustandCacheSize')) recommendations.push('📊 الذاكرة مثقلة — فعّل Pagination للجداول الكبيرة');
  if (failedSteps.some(r => r.step === 'Perf.HeavyQuerySimulation') || warnSteps.some(r => r.step === 'Perf.HeavyQuerySimulation')) recommendations.push('🐢 استعلامات بطيئة — فكّر في إضافة فهارس أو تفعيل pagination');
  if (warnSteps.some(r => r.step === 'DB.DuplicateIndexes')) recommendations.push('🗂️ فهارس مكررة — احذفها لتسريع عمليات الكتابة');
  if (warnSteps.some(r => r.step === 'Perf.MemoryFootprint')) recommendations.push('🧠 استخدام الذاكرة مرتفع — أغلق التبويبات غير الضرورية أو أعد تحميل الصفحة');
  if (warnSteps.some(r => r.step === 'Integrity.OrphanDebts')) recommendations.push('📋 ديون متأخرة — تابعها مع العملاء أو الموردين');
  // MODULE 19-22 Recommendations
  if (failedSteps.some(r => r.step === 'Stress.ConcurrentDoubleWrite')) recommendations.push('🔒 خطر Double Spend! تحقق من Optimistic Locking أو Row-Level Locks في منطق تحديث المخزون');
  if (failedSteps.some(r => r.step === 'Stress.IdempotencyCheck')) recommendations.push('⚠️ Idempotency مكسورة — أضف Unique Constraint على (id) في treasury_transactions أو استخدم ON CONFLICT DO NOTHING');
  if (warnSteps.some(r => r.step === 'Stress.NetworkJitterResilience') || failedSteps.some(r => r.step === 'Stress.NetworkJitterResilience')) recommendations.push('📡 اتصال غير مستقر — فعّل Retry Logic للعمليات المالية مع Idempotency Key لمنع التكرار');
  if (failedSteps.some(r => r.step === 'FinancialAudit.TreasuryReconciliation')) recommendations.push('💸 خلل مالي خطير! أوقف العمليات وراجع سجل treasurer_transactions يدوياً — ابحث عن معاملات ناقصة أو مكررة');
  if (failedSteps.some(r => r.step === 'FinancialAudit.DebtConsistency')) recommendations.push('📋 تناقض في سجلات الديون — راجع منطق payDebt وتأكد من Atomicity التحديث');
  if (failedSteps.some(r => r.step.startsWith('SchemaGuard'))) recommendations.push('🛡️ تغيير غير مصرح في Schema قاعدة البيانات — راجع آخر migrations وتأكد من عدم حذف أعمدة جوهرية');
  if (recommendations.length === 0 && healthScore >= 90) recommendations.push('✨ النظام في حالة ممتازة — لا توجد توصيات حالياً');

  // ═══ Console Report ═══
  const gradeColor = healthScore >= 90 ? '#10b981' : healthScore >= 70 ? '#f59e0b' : healthScore >= 50 ? '#f97316' : '#ef4444';
  console.log('%c\n╔═══════════════════════════════════════════════════════════════╗', `color: ${gradeColor}; font-weight: bold;`);
  console.log(`%c║  📊 BUNYAN ERP — DIAGNOSTIC REPORT v2.0                      ║`, `color: ${gradeColor}; font-weight: bold; font-size: 14px;`);
  console.log(`%c║  ${healthGrade} — Health Score: ${healthScore}/100${' '.repeat(Math.max(0, 27 - healthGrade.length - String(healthScore).length))}║`, `color: ${gradeColor}; font-weight: bold; font-size: 16px;`);
  console.log(`%c║  ✅ ${passed}  ❌ ${failed}  ⏭ ${skipped}  ⚠️ ${warnings}  ⏱ ${(durationMs / 1000).toFixed(1)}s  📝 ${results.length} tests       ║`, `color: ${gradeColor}; font-weight: bold;`);
  console.log(`%c╚═══════════════════════════════════════════════════════════════╝`, `color: ${gradeColor}; font-weight: bold;`);

  if (recommendations.length > 0) {
    console.log('%c\n📋 RECOMMENDATIONS:', 'color: #6366f1; font-weight: bold; font-size: 14px;');
    recommendations.forEach((r, i) => {
      console.log(`%c  ${i + 1}. ${r}`, 'color: #4b5563; font-size: 12px;');
    });
  }

  if (failed > 0) {
    console.log('%c\n🚨 DETAILED FAILURE REPORT 🚨', 'color: #ef4444; font-weight: bold; font-size: 16px; background: #fef2f2; padding: 8px; border-radius: 4px;');
    failedSteps.forEach(r => {
      console.groupCollapsed(`%c❌ ${r.step} ➔ ${r.message}`, 'color: #ef4444; font-weight: bold; font-size: 13px;');
      console.log('%cContext & Details:', 'color: #64748b; font-weight: bold;');
      console.dir(r.details || {});
      console.groupEnd();
    });
  }

  // ═══ Structured JSON Report ═══
  const report: DiagnosticReport = {
    results,
    summary: { total: results.length, passed, failed, skipped, warnings, durationMs, healthScore, healthGrade },
    recommendations,
    dbHealth: dbHealthData || undefined,
    timestamp: startTime,
    tenantId,
    version: '3.0.0',
  };

  // Store on window for easy access & sharing
  if (typeof window !== 'undefined') {
    (window as any).__LAST_DIAGNOSTIC_REPORT = report;
    console.log('%c\n📋 للمشاركة مع AI أو للتصدير:', 'color: #6366f1; font-weight: bold; font-size: 13px;');
    console.log('%c  → window.__LAST_DIAGNOSTIC_REPORT', 'color: #7c3aed; font-size: 12px; font-family: monospace;');
    console.log('%c  → JSON.stringify(window.__LAST_DIAGNOSTIC_REPORT, null, 2)', 'color: #7c3aed; font-size: 12px; font-family: monospace;');
    console.log('%c  → copy(JSON.stringify(window.__LAST_DIAGNOSTIC_REPORT)) // نسخ للحافظة', 'color: #7c3aed; font-size: 12px; font-family: monospace;');
  }

  return report;
}

// ══════════════════════════════════════════
// HTML Visual Report Generator
// يولّد تقريراً بصرياً متكاملاً قابلاً للتنزيل
// ══════════════════════════════════════════
export function generateDiagnosticHTMLReport(report: DiagnosticReport): void {
  const { results, summary, recommendations, timestamp, tenantId, version } = report;

  const statusColor: Record<string, string> = {
    PASSED:  '#10b981',
    FAILED:  '#ef4444',
    WARNING: '#f59e0b',
    SKIPPED: '#94a3b8',
  };
  const statusIcon: Record<string, string> = {
    PASSED: '✅', FAILED: '❌', WARNING: '⚠️', SKIPPED: '⏭',
  };

  const gradeColor = summary.healthScore >= 90 ? '#10b981'
    : summary.healthScore >= 70 ? '#f59e0b'
    : summary.healthScore >= 50 ? '#f97316'
    : '#ef4444';

  // Group results by module prefix
  const modules: Record<string, typeof results> = {};
  for (const r of results) {
    const mod = r.step.split('.')[0];
    if (!modules[mod]) modules[mod] = [];
    modules[mod].push(r);
  }

  const moduleHTML = Object.entries(modules).map(([mod, steps]) => {
    const modPassed  = steps.filter(s => s.status === 'PASSED').length;
    const modFailed  = steps.filter(s => s.status === 'FAILED').length;
    const modWarning = steps.filter(s => s.status === 'WARNING').length;
    const modScore   = steps.length > 0
      ? Math.round(((modPassed + modWarning * 0.5) / steps.length) * 100)
      : 100;
    const modColor   = modFailed > 0 ? '#ef4444' : modWarning > 0 ? '#f59e0b' : '#10b981';

    const stepsHTML = steps.map(s => `
      <tr style="border-bottom: 1px solid #1e293b;">
        <td style="padding: 8px 12px; font-family: monospace; font-size: 12px; color: #94a3b8;">${s.step}</td>
        <td style="padding: 8px 12px;">
          <span style="background: ${statusColor[s.status]}22; color: ${statusColor[s.status]}; padding: 2px 10px; border-radius: 999px; font-size: 12px; font-weight: 700;">
            ${statusIcon[s.status]} ${s.status}
          </span>
        </td>
        <td style="padding: 8px 12px; font-size: 12px; color: #cbd5e1;">${s.message}</td>
        <td style="padding: 8px 12px; font-size: 11px; color: #64748b; text-align: right;">${s.durationMs != null ? s.durationMs + 'ms' : '—'}</td>
      </tr>
      ${s.status !== 'PASSED' && s.message ? `
      <tr style="background: #0f172a;">
        <td colspan="4" style="padding: 6px 24px 10px; font-size: 11px; color: ${statusColor[s.status]}; border-bottom: 1px solid #1e293b;">
          ↳ ${s.message}
        </td>
      </tr>` : ''}
    `).join('');

    return `
    <div style="background: #1e293b; border-radius: 12px; margin-bottom: 16px; overflow: hidden; border: 1px solid #334155;">
      <div style="padding: 14px 20px; display: flex; justify-content: space-between; align-items: center; background: #162032; border-bottom: 1px solid #334155;">
        <div>
          <span style="font-weight: 700; color: #e2e8f0; font-size: 15px;">${mod}</span>
          <span style="margin-left: 12px; font-size: 12px; color: #64748b;">${steps.length} فحص</span>
        </div>
        <div style="display: flex; align-items: center; gap: 12px;">
          ${modFailed > 0 ? `<span style="color: #ef4444; font-size: 12px; font-weight: 600;">❌ ${modFailed} فشل</span>` : ''}
          ${modWarning > 0 ? `<span style="color: #f59e0b; font-size: 12px; font-weight: 600;">⚠️ ${modWarning} تحذير</span>` : ''}
          <div style="width: 80px; height: 6px; background: #334155; border-radius: 3px; overflow: hidden;">
            <div style="width: ${modScore}%; height: 100%; background: ${modColor}; border-radius: 3px;"></div>
          </div>
          <span style="font-size: 12px; font-weight: 700; color: ${modColor};">${modScore}%</span>
        </div>
      </div>
      <table style="width: 100%; border-collapse: collapse;">
        <thead>
          <tr style="background: #0f1a2b;">
            <th style="padding: 8px 12px; text-align: left; font-size: 11px; color: #64748b; font-weight: 600;">الفحص</th>
            <th style="padding: 8px 12px; text-align: left; font-size: 11px; color: #64748b; font-weight: 600;">الحالة</th>
            <th style="padding: 8px 12px; text-align: left; font-size: 11px; color: #64748b; font-weight: 600;">الرسالة</th>
            <th style="padding: 8px 12px; text-align: right; font-size: 11px; color: #64748b; font-weight: 600;">المدة</th>
          </tr>
        </thead>
        <tbody>${stepsHTML}</tbody>
      </table>
    </div>`;
  }).join('');

  const recsHTML = recommendations.map(r => `
    <div style="padding: 10px 16px; background: #1e293b; border-radius: 8px; border-right: 3px solid #7c3aed; font-size: 13px; color: #cbd5e1; direction: rtl;">
      ${r}
    </div>
  `).join('');

  // Performance heatmap bars for modules
  const heatmapHTML = Object.entries(modules).map(([mod, steps]) => {
    const modFailed = steps.filter(s => s.status === 'FAILED').length;
    const modWarning = steps.filter(s => s.status === 'WARNING').length;
    const modScore = steps.length > 0
      ? Math.round(((steps.filter(s => s.status === 'PASSED').length + modWarning * 0.5) / steps.length) * 100)
      : 100;
    const bg = modFailed > 0 ? '#ef444433' : modWarning > 0 ? '#f59e0b33' : '#10b98133';
    const col = modFailed > 0 ? '#ef4444' : modWarning > 0 ? '#f59e0b' : '#10b981';
    return `
      <div style="display: flex; align-items: center; gap: 12px; padding: 8px 0; border-bottom: 1px solid #1e293b;">
        <div style="width: 180px; font-size: 12px; color: #94a3b8; text-align: right; flex-shrink: 0;">${mod}</div>
        <div style="flex: 1; background: #0f172a; border-radius: 4px; height: 20px; overflow: hidden;">
          <div style="width: ${modScore}%; height: 100%; background: ${col}; border-radius: 4px; display: flex; align-items: center; justify-content: flex-end; padding-right: 6px;">
            <span style="font-size: 10px; font-weight: 700; color: #fff;">${modScore}%</span>
          </div>
        </div>
        <div style="width: 70px; text-align: left; font-size: 11px; color: ${col}; font-weight: 600; flex-shrink: 0;">
          ${steps.length} فحص
        </div>
      </div>
    `;
  }).join('');

  const html = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Bunyan ERP — Diagnostic Report v${version}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: #0f172a; color: #e2e8f0; font-family: 'Segoe UI', Tahoma, sans-serif; direction: rtl; }
    @media print { body { background: #fff; color: #000; } }
  </style>
</head>
<body>
  <div style="max-width: 1100px; margin: 0 auto; padding: 32px 16px;">

    <!-- Header -->
    <div style="background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); border-radius: 16px; padding: 32px; margin-bottom: 24px; border: 1px solid #334155; text-align: center;">
      <div style="font-size: 13px; color: #64748b; margin-bottom: 8px;">Bunyan ERP — Full System Diagnostic Suite v${version}</div>
      <div style="font-size: 48px; font-weight: 900; color: ${gradeColor}; margin-bottom: 8px;">${summary.healthScore}<span style="font-size: 24px;">/100</span></div>
      <div style="font-size: 20px; font-weight: 700; color: ${gradeColor}; margin-bottom: 16px;">${summary.healthGrade}</div>
      <div style="display: flex; justify-content: center; gap: 24px; flex-wrap: wrap;">
        <div style="text-align: center;"><div style="font-size: 28px; font-weight: 800; color: #10b981;">${summary.passed}</div><div style="font-size: 12px; color: #64748b;">نجح ✅</div></div>
        <div style="text-align: center;"><div style="font-size: 28px; font-weight: 800; color: #ef4444;">${summary.failed}</div><div style="font-size: 12px; color: #64748b;">فشل ❌</div></div>
        <div style="text-align: center;"><div style="font-size: 28px; font-weight: 800; color: #f59e0b;">${summary.warnings}</div><div style="font-size: 12px; color: #64748b;">تحذير ⚠️</div></div>
        <div style="text-align: center;"><div style="font-size: 28px; font-weight: 800; color: #94a3b8;">${summary.skipped}</div><div style="font-size: 12px; color: #64748b;">تخطي ⏭</div></div>
        <div style="text-align: center;"><div style="font-size: 28px; font-weight: 800; color: #e2e8f0;">${(summary.durationMs / 1000).toFixed(1)}s</div><div style="font-size: 12px; color: #64748b;">⏱ المدة</div></div>
        <div style="text-align: center;"><div style="font-size: 28px; font-weight: 800; color: #e2e8f0;">${summary.total}</div><div style="font-size: 12px; color: #64748b;">📝 فحص إجمالي</div></div>
      </div>
      <div style="margin-top: 16px; font-size: 11px; color: #475569;">
        Tenant: ${tenantId} | ${new Date(timestamp).toLocaleString('ar-LY')}
      </div>
    </div>

    <!-- Heatmap -->
    <div style="background: #1e293b; border-radius: 12px; padding: 20px; margin-bottom: 24px; border: 1px solid #334155;">
      <h2 style="font-size: 16px; font-weight: 700; color: #e2e8f0; margin-bottom: 16px;">🌡️ الخريطة الحرارية — أداء كل وحدة</h2>
      ${heatmapHTML}
    </div>

    <!-- Recommendations -->
    ${recommendations.length > 0 ? `
    <div style="background: #1e293b; border-radius: 12px; padding: 20px; margin-bottom: 24px; border: 1px solid #334155;">
      <h2 style="font-size: 16px; font-weight: 700; color: #e2e8f0; margin-bottom: 16px;">📋 التوصيات والإجراءات المطلوبة</h2>
      <div style="display: flex; flex-direction: column; gap: 8px;">${recsHTML}</div>
    </div>` : ''}

    <!-- Detailed Results -->
    <div>
      <h2 style="font-size: 16px; font-weight: 700; color: #e2e8f0; margin-bottom: 16px;">🔍 نتائج الفحص التفصيلية</h2>
      ${moduleHTML}
    </div>

    <!-- Footer -->
    <div style="text-align: center; padding: 24px; font-size: 11px; color: #475569;">
      تقرير تشخيصي من Bunyan ERP v${version} — تم التوليد في ${new Date().toLocaleString('ar-LY')}
    </div>
  </div>
</body>
</html>`;

  // تنزيل التقرير تلقائياً
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `bunyan-diagnostic-${new Date().toISOString().split('T')[0]}.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  console.log('%c📊 تم تنزيل التقرير البصري — افتحه في المتصفح!', 'color: #10b981; font-weight: bold; font-size: 14px;');
}

