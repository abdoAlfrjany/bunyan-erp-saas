// src/app/api/orders/route.ts
// الميزة: مسار آمن لإنشاء الطلبيات ومراجعة المخزون بشكل ذري
// 🔒 محمي بـ requireAuth + assertTenantMatch

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAuth, assertTenantMatch } from '@/core/server/auth';

interface OrderItem {
  id: string;
  productId: string;
  productName: string;
  variantSize?: string;
  quantity: number;
  unitPrice: number;
  unitCost: number;
  total: number;
}

interface OrderPayload {
  id?: string;
  tenantId: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  customerCity: string;
  customerAddress?: string;
  deliveryType: 'internal' | 'courier_company' | 'pickup';
  deliveryFee?: number;
  courierCompanyId?: string;
  vanexPackageCode?: string;
  courierRawStatus?: string;
  status?: string;
  total: number;
  subtotal?: number;
  discount?: number;
  paymentStatus?: string;
  items: OrderItem[];
}

export async function POST(req: NextRequest) {
  try {
    // 🔒 1. تحقق من المصادقة
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;

    const o = (await req.json()) as OrderPayload;

    // 🔒 2. تحقق من ملكية التنانت
    const tenantError = assertTenantMatch(auth, o.tenantId);
    if (tenantError) return tenantError;

    if (!o.tenantId || !o.items || o.items.length === 0) {
      return NextResponse.json({ error: 'بيانات الطلبية غير مكتملة' }, { status: 400 });
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // 3. فحص المخزون الصارم من قاعدة البيانات
    const productIds = o.items.map((i) => i.productId);
    const { data: dbProducts, error: dbProductsError } = await supabaseAdmin
      .from('products')
      .select('id, name, product_type, quantity, unit, variants')
      .in('id', productIds)
      .eq('tenant_id', o.tenantId);

    if (dbProductsError || !dbProducts) {
       return NextResponse.json({ error: 'خطأ في التحقق من المخزون' }, { status: 500 });
    }

    for (const item of o.items) {
      const product = dbProducts.find(p => p.id === item.productId);
      if (!product) {
        return NextResponse.json({ error: `المنتج "${item.productName}" غير موجود في قاعدة البيانات` }, { status: 400 });
      }

      if (product.product_type !== 'simple' && item.variantSize && product.variants) {
        const variants = product.variants as unknown as { size: string; quantity: number }[];
        const variant = variants.find((v) => v.size === item.variantSize);
        if (variant && variant.quantity < item.quantity) {
          return NextResponse.json({
            error: `المقاس "${item.variantSize}" للمنتج "${item.productName}" غير متوفر بالكمية المطلوبة (متبقي ${variant.quantity})`
          }, { status: 400 });
        }
      } else if (product.product_type === 'simple' && product.quantity < item.quantity) {
        return NextResponse.json({
          error: `المخزون غير كافٍ للمنتج "${item.productName}" — متوفر ${product.quantity} ${product.unit} فقط`
        }, { status: 400 });
      }
    }

    // 3.5 🛡️ Idempotency — إذا كانت الطلبية موجودة بالفعل بنفس الـ ID فنعيد 200 دون إدراج مكرر
    if (o.id) {
      const { data: existing } = await supabaseAdmin
        .from('orders')
        .select('id, order_number')
        .eq('id', o.id)
        .maybeSingle();
      if (existing) {
        return NextResponse.json({ success: true, order: existing, idempotent: true });
      }
    }

    // 4. إرسال الطلبية لـ Supabase
    const mappedRow: Record<string, unknown> = {
      ...(o.id ? { id: o.id } : {}),
      tenant_id: o.tenantId,
      order_number: o.orderNumber,
      customer_name: o.customerName,
      customer_phone: o.customerPhone,
      customer_city: o.customerCity,
      customer_address: o.customerAddress ?? null,
      delivery_type: o.deliveryType,
      status: o.status || 'pending', // ✅ تم تصحيح القيمة الافتراضية من 'new' إلى 'pending'
      total: o.total,
      payment_status: o.paymentStatus || 'pending',
      delivery_fee: o.deliveryFee || 0,
      courier_company_id: o.courierCompanyId ?? null,
      courier_tracking_code: o.vanexPackageCode ?? null,
      courier_raw_status: o.courierRawStatus ?? null,
      discount: o.discount || 0,
      subtotal: o.subtotal || o.total,
      items: o.items,
      created_by: auth.userId, // ✅ UUID المستخدم المصادق
    };

    const { data: insertData, error: insertError } = await supabaseAdmin
      .from('orders')
      .insert(mappedRow)
      .select()
      .single();

    if (insertError) {
       console.error('/api/orders insert err:', insertError);
       // 409 = Unique constraint violation (e.g., duplicate order_number)
       if (insertError.code === '23505') {
         return NextResponse.json({ error: `رقم الطلبية مستخدم بالفعل — يرجى المحاولة مرة أخرى` }, { status: 409 });
       }
       return NextResponse.json({ error: `خطأ في حفظ الطلبية: ${insertError.message}` }, { status: 500 });
    }

    // 5. خصم المخزون باستخدام الدالة الآمنة (RPC)
    const inventoryPayload = o.items.map((i) => ({
      product_id: i.productId,
      qty: i.quantity,
      variant_size: i.variantSize || null
    }));
    
    const { error: rpcError } = await supabaseAdmin.rpc('deduct_inventory', {
      items_payload: inventoryPayload
    });

    if (rpcError) {
      console.error('/api/orders deduct_inventory err:', rpcError);
    }

    // 6. مزامنة ملف العميل
    const { data: existingCustomers } = await supabaseAdmin
      .from('customers')
      .select('id, address, total_orders')
      .eq('phone', o.customerPhone)
      .eq('tenant_id', o.tenantId);

    if (existingCustomers && existingCustomers.length > 0) {
      const existingCustomer = existingCustomers[0];
      await supabaseAdmin.from('customers').update({
        name: o.customerName,
        city: o.customerCity,
        address: o.customerAddress || existingCustomer.address,
        total_orders: (existingCustomer.total_orders || 0) + 1,
      }).eq('id', existingCustomer.id);
    } else {
      await supabaseAdmin.from('customers').insert({
        tenant_id: o.tenantId,
        name: o.customerName,
        phone: o.customerPhone,
        city: o.customerCity,
        address: o.customerAddress ?? null,
        total_orders: 1,
      });
    }

    return NextResponse.json({ success: true, order: insertData });

  } catch (err: unknown) {
    console.error('[POST /api/orders] exception:', err);
    return NextResponse.json({ error: (err as Error).message || 'خطأ داخلي في الخادم' }, { status: 500 });
  }
}
