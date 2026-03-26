// src/app/api/products/route.ts
// الميزة: مسار آمن لإدارة المنتجات (إضافة، تعديل، حذف) عبر الخادم
// 🔒 محمي بـ requireAuth + assertTenantMatch

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAuth, assertTenantMatch } from '@/core/server/auth';

interface ProductVariant {
  size: string;
  quantity: number;
}

interface ProductPayload {
  id?: string;
  tenantId: string;
  name: string;
  category?: string;
  unit?: string;
  costPrice?: number;
  sellingPrice?: number;
  quantity?: number;
  minQuantity?: number;
  itemCode?: string;
  barcode?: string;
  productType: 'simple' | 'variant';
  variants?: ProductVariant[];
  isActive?: boolean;
}

// ════════════════════════════════════════
// POST: إنشاء منتج جديد مع الشراء من الخزينة
// ════════════════════════════════════════
export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;

    const p = (await req.json()) as ProductPayload;

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
      ? p.variants.reduce((sum: number, v) => sum + v.quantity, 0)
      : (p.quantity || 0);
    const totalCost = totalQty * (p.costPrice || 0);

    // 2. التحقق من رصيد الخزينة إذا كانت هناك تكلفة
    let cashAcc: { id: string; balance: number } | null = null;
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
    const rowToInsert: Record<string, unknown> = {
      ...(p.id ? { id: p.id } : {}),
      tenant_id: p.tenantId,
      name: p.name,
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
  } catch (error: unknown) {
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

    // 1. استرجاع المنتج القديم لمعرفة الفارق في الكمية WAC والاسم
    const { data: oldProduct, error: oldErr } = await supabaseAdmin
      .from('products')
      .select('cost_price, quantity, name')
      .eq('id', p.id)
      .eq('tenant_id', p.tenantId) // ✅ ضمان أن المنتج يخص هذا التنانت
      .single();

    if (oldErr || !oldProduct) {
      return NextResponse.json({ error: 'المنتج الأصلي غير موجود' }, { status: 404 });
    }

    const newQuantity = Number(p.quantity ?? oldProduct.quantity);
    const costPrice = Number(p.costPrice ?? oldProduct.cost_price);
    let addedCost = 0;
    let cashAcc: { id: string; balance: number } | null = null;

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
    const rowToUpdate: Record<string, unknown> = {};
    
    // Mapping keys to DB snake_case
    if (p.name !== undefined) rowToUpdate.name = p.name;
    if (p.category !== undefined) rowToUpdate.category = p.category;
    if (p.unit !== undefined) rowToUpdate.unit = p.unit;
    if (p.costPrice !== undefined) rowToUpdate.cost_price = p.costPrice;
    if (p.sellingPrice !== undefined) rowToUpdate.selling_price = p.sellingPrice;
    // NOTE: quantity is handled atomically via RPC below, not here to prevent Double Write Race Conditions.
    if (p.itemCode !== undefined) rowToUpdate.item_code = p.itemCode;
    if (p.barcode !== undefined) rowToUpdate.barcode = p.barcode;
    if (p.productType !== undefined) rowToUpdate.product_type = p.productType;
    if (p.variants !== undefined) rowToUpdate.variants = p.variants;
    if (p.isActive !== undefined) rowToUpdate.is_active = p.isActive;

    let updatedProduct = oldProduct; // fallback

    if (Object.keys(rowToUpdate).length > 0) {
      const { data, error: updateError } = await supabaseAdmin
        .from('products')
        .update(rowToUpdate)
        .eq('id', p.id)
        .eq('tenant_id', p.tenantId) // ✅ ضمان الملكية
        .select()
        .single();

      if (updateError) {
        return NextResponse.json({ error: `فشل تعديل المنتج: ${updateError.message}` }, { status: 500 });
      }
      updatedProduct = data;
    } else {
      const { data } = await supabaseAdmin.from('products').select().eq('id', p.id).single();
      if (data) updatedProduct = data;
    }

    // 2.5 تحديث الكمية بشكل ذري (Atomic) لتجنب Race Conditions (Double Spend)
    let finalProduct = updatedProduct;
    if (p.quantity !== undefined && newQuantity !== oldProduct.quantity) {
       const qtyDelta = newQuantity - oldProduct.quantity;
       const { data: atomicData, error: atomicErr } = await supabaseAdmin.rpc('adjust_product_stock_atomic', {
         p_product_id: p.id,
         p_qty_delta: qtyDelta
       });
       
       if (atomicErr) {
         console.error('[PATCH /api/products] Atomic stock update failed:', atomicErr.message);
         // لا نكسر العملية لأن التحديثات الأخرى تمت بنجاح
       } else if (atomicData) {
         finalProduct = atomicData; // Return the fully updated product including the exact new quantity
       }
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

    return NextResponse.json({ success: true, product: finalProduct });
  } catch (error: unknown) {
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
  } catch (error: unknown) {
    console.error('[DELETE /api/products] Error:', error);
    return NextResponse.json({ error: 'خطأ داخلي' }, { status: 500 });
  }
}
