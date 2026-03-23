// src/app/api/products/route.ts
// الميزة: مسار آمن لإدارة المنتجات (إضافة، تعديل، حذف) عبر الخادم
// 🔒 محمي بـ requireAuth + assertTenantMatch

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAuth, assertTenantMatch } from '@/core/server/auth';

// ════════════════════════════════════════
// POST: إنشاء منتج جديد مع الشراء من الخزينة
// ════════════════════════════════════════
export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;

    const p = await req.json();

    const tenantError = assertTenantMatch(auth, p.tenantId);
    if (tenantError) return tenantError;

    if (!p.tenantId || !p.name) {
      return NextResponse.json({ error: 'بيانات المنتج غير مكتملة' }, { status: 400 });
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // 1. حساب إجمالي كمية وتكلفة الشراء
    const totalQty = p.productType !== 'simple' && p.variants
      ? p.variants.reduce((sum: number, v: any) => sum + v.quantity, 0)
      : (p.quantity || 0);
    const totalCost = totalQty * (p.costPrice || 0);

    // 2. التحقق من رصيد الخزينة إذا كانت هناك تكلفة
    let cashAcc: any = null;
    if (totalCost > 0) {
      const { data: treasuryAccounts, error: tErr } = await supabaseAdmin
        .from('treasury_accounts')
        .select('id, balance')
        .eq('tenant_id', p.tenantId)
        .eq('account_type', 'cash_in_hand')
        .single();

      if (tErr || !treasuryAccounts) {
        return NextResponse.json({ error: 'لا يوجد حساب نقدي نشط لشراء هذه البضاعة' }, { status: 400 });
      }

      if (totalCost > treasuryAccounts.balance) {
        return NextResponse.json({ error: `رصيد الخزينة غير كافٍ. المتوفر (${treasuryAccounts.balance}) د.ل بينما التكلفة (${totalCost}) د.ل` }, { status: 400 });
      }
      cashAcc = treasuryAccounts;
    }

    // 3. إدراج المنتج في قاعدة البيانات
    const rowToInsert: any = {
      ...(p.id ? { id: p.id } : {}),
      tenant_id: p.tenantId,
      name: p.name,
      category: p.category,
      unit: p.unit,
      cost_price: p.costPrice,
      selling_price: p.sellingPrice,
      quantity: p.quantity,
      min_quantity: p.minQuantity,
      item_code: p.itemCode,
      barcode: p.barcode,
      product_type: p.productType,
      variants: p.variants,
      is_active: p.isActive ?? true,
    };

    const { data: newProduct, error: insertError } = await supabaseAdmin
      .from('products')
      .insert(rowToInsert)
      .select()
      .single();

    if (insertError) {
      return NextResponse.json({ error: `فشل تسجيل المنتج: ${insertError.message}` }, { status: 500 });
    }

    // 4. تسجيل المعاملة المالية وسحب المبلغ من الخزينة (RPC ذري)
    if (cashAcc && totalCost > 0) {
      const { error: rpcError } = await supabaseAdmin.rpc('create_treasury_transaction_atomic', {
        p_tenant_id: p.tenantId,
        p_account_id: cashAcc.id,
        p_transaction_type: 'expense',
        p_amount: -totalCost,
        p_description: `توريد بضاعة: ${p.name} × ${totalQty} ${p.unit} بسعر ${p.costPrice}`,
        p_created_by: auth.userId, // ✅ UUID المستخدم المصادق
        p_transaction_date: new Date().toISOString().split('T')[0],
        p_is_transfer: false,
        p_to_account_id: null,
      });

      if (rpcError) {
        console.error('[POST /api/products] Treasury RPC error:', rpcError.message);
        // المنتج أُنشئ — نُسجّل الخطأ لكن لا نُعيد فشلاً للـ UI (الخزينة قد تُصحح لاحقاً)
      }
    }

    return NextResponse.json({ success: true, product: newProduct });
  } catch (error: any) {
    console.error('[POST /api/products] Error:', error);
    return NextResponse.json({ error: 'خطأ داخلي في السيرفر' }, { status: 500 });
  }
}

// ════════════════════════════════════════
// PATCH: تحديث منتج (إضافة مخزون أو تعديل بيانات)
// ════════════════════════════════════════
export async function PATCH(req: NextRequest) {
  try {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;

    const p = await req.json();
    if (!p.id || !p.tenantId) {
      return NextResponse.json({ error: 'معرف المنتج مفقود' }, { status: 400 });
    }

    const tenantError = assertTenantMatch(auth, p.tenantId);
    if (tenantError) return tenantError;

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // 1. استرجاع المنتج القديم لمعرفة الفارق في الكمية WAC
    const { data: oldProduct, error: oldErr } = await supabaseAdmin
      .from('products')
      .select('cost_price, quantity')
      .eq('id', p.id)
      .eq('tenant_id', p.tenantId) // ✅ ضمان أن المنتج يخص هذا التنانت
      .single();

    if (oldErr || !oldProduct) {
      return NextResponse.json({ error: 'المنتج الأصلي غير موجود' }, { status: 404 });
    }

    const newQuantity = Number(p.quantity ?? oldProduct.quantity);
    const costPrice = Number(p.costPrice ?? oldProduct.cost_price);
    let addedCost = 0;
    let cashAcc: any = null;

    if (newQuantity > oldProduct.quantity) {
      const addedQty = newQuantity - oldProduct.quantity;
      addedCost = addedQty * costPrice;

      if (addedCost > 0) {
        const { data: treasuryAccounts, error: tErr } = await supabaseAdmin
          .from('treasury_accounts')
          .select('id, balance')
          .eq('tenant_id', p.tenantId)
          .eq('account_type', 'cash_in_hand')
          .single();

        if (tErr || !treasuryAccounts || treasuryAccounts.balance < addedCost) {
           return NextResponse.json({ error: 'رصيد الخزينة غير كافٍ لتعزيز المخزون' }, { status: 400 });
        }
        cashAcc = treasuryAccounts;
      }
    }

    // 2. تحديث المنتج
    const rowToUpdate: Record<string, any> = {
      name: p.name,
      category: p.category,
      unit: p.unit,
      cost_price: p.costPrice,
      selling_price: p.sellingPrice,
      quantity: p.quantity,
      min_quantity: p.minQuantity,
      item_code: p.itemCode,
      barcode: p.barcode,
      product_type: p.productType,
      variants: p.variants,
      is_active: p.isActive,
    };

    Object.keys(rowToUpdate).forEach(key => rowToUpdate[key] === undefined && delete rowToUpdate[key]);

    const { data: updatedProduct, error: updateError } = await supabaseAdmin
      .from('products')
      .update(rowToUpdate)
      .eq('id', p.id)
      .eq('tenant_id', p.tenantId) // ✅ ضمان الملكية
      .select()
      .single();

    if (updateError) {
      return NextResponse.json({ error: `فشل تعديل المنتج: ${updateError.message}` }, { status: 500 });
    }

    // 3. خصم التكلفة للمخزون الجديد WAC المضاف (RPC ذري)
    if (cashAcc && addedCost > 0) {
      const { error: rpcError } = await supabaseAdmin.rpc('create_treasury_transaction_atomic', {
        p_tenant_id: p.tenantId,
        p_account_id: cashAcc.id,
        p_transaction_type: 'expense',
        p_amount: -addedCost,
        p_description: `تعزيز مخزون: ${updatedProduct.name} × ${newQuantity - oldProduct.quantity} بسعر ${costPrice}`,
        p_created_by: auth.userId, // ✅ UUID المستخدم المصادق
        p_transaction_date: new Date().toISOString().split('T')[0],
        p_is_transfer: false,
        p_to_account_id: null,
      });

      if (rpcError) {
        console.error('[PATCH /api/products] Treasury RPC error:', rpcError.message);
      }
    }

    return NextResponse.json({ success: true, product: updatedProduct });
  } catch (error: any) {
    console.error('[PATCH /api/products] Error:', error);
    return NextResponse.json({ error: 'خطأ داخلي' }, { status: 500 });
  }
}

// ════════════════════════════════════════
// DELETE: حذف منتج
// ════════════════════════════════════════
export async function DELETE(req: NextRequest) {
  try {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const tenantId = searchParams.get('tenantId');

    if (!id) return NextResponse.json({ error: 'معرف مفقود' }, { status: 400 });

    const tenantError = assertTenantMatch(auth, tenantId || undefined);
    if (tenantError) return tenantError;

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { error: deleteError } = await supabaseAdmin
      .from('products')
      .delete()
      .eq('id', id)
      .eq('tenant_id', auth.tenantId); // ✅ ضمان الملكية

    if (deleteError) {
      if (deleteError.message.includes('foreign key constraint')) {
        await supabaseAdmin.from('products').update({ is_active: false }).eq('id', id);
        return NextResponse.json({ success: true, softDeleted: true });
      }
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[DELETE /api/products] Error:', error);
    return NextResponse.json({ error: 'خطأ داخلي' }, { status: 500 });
  }
}
