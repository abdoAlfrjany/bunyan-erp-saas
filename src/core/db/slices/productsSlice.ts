// src/core/db/slices/productsSlice.ts
// الوظيفة: CRUD المنتجات الثنائي (Supabase + Zustand)
// مع منطق الخزينة وإشعارات المخزون

import type { StateCreator } from 'zustand';
import type { Product, Notification, TreasuryAccount, TreasuryTransaction } from '../../types';
import { createClient } from '../supabase';

// ══════════════════════════════════════════
// Helpers: Mappers between Supabase & App
// ══════════════════════════════════════════
export const mapSupabaseRowToProduct = (row: any): Product => ({
  id: row.id,
  tenantId: row.tenant_id,
  name: row.name,
  category: row.category || '',
  unit: row.unit || 'قطعة',
  costPrice: Number(row.cost_price || 0),
  sellingPrice: Number(row.selling_price || 0),
  quantity: Number(row.quantity || 0),
  minQuantity: Number(row.min_quantity || 0),
  itemCode: row.item_code || '',
  barcode: row.barcode || '',
  productType: row.product_type || 'simple',
  variants: row.variants || [],
  isActive: row.is_active ?? true,
});

const mapProductToSupabaseRow = (p: Partial<Product> & { tenantId?: string }) => ({
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
  ...(p.id ? { id: p.id } : {}),
  ...(p.tenantId ? { tenant_id: p.tenantId } : {}),
});

export interface ProductsSlice {
  products: Product[];
  fetchProducts: (tenantId: string) => Promise<void>;
  addProduct: (p: Product) => Promise<void>;
  updateProduct: (id: string, data: Partial<Product>) => Promise<void>;
  deleteProduct: (id: string) => Promise<{ success: boolean; error?: string }>;
}

export const createProductsSlice: StateCreator<any, [], [], ProductsSlice> = (set, get) => ({
  products: [],

  fetchProducts: async (tenantId: string) => {
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('products')
        .select('id, tenant_id, name, category, unit, cost_price, selling_price, quantity, min_quantity, item_code, barcode, product_type, variants, is_active')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .limit(200);

      if (error) throw error;
      if (data) {
        set({ products: data.map(mapSupabaseRowToProduct) });
      }
    } catch (error) {
      console.error('❌ Error fetching products:', error);
    }
  },

  addProduct: async (p) => {
    try {
      const res = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(p),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || 'فشل إضافة المنتج');
      }

      // We no longer update the local 'products' array manually.
      // The UI component (SlideOver/Page) will trigger a React Query refetch.
    } catch (err: any) {
      console.error('❌ Error adding product:', err.message);
      throw err;
    }
  },

  updateProduct: async (id, data) => {
    try {
      const existing = get().products?.find((p: Product) => p.id === id);
      const tenantId = data.tenantId || existing?.tenantId;

      const res = await fetch('/api/products', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, tenantId, ...data }),
      });

      const result = await res.json();
      if (!res.ok || result.error) {
        throw new Error(result.error || 'فشل تحديث المنتج');
      }

      // No manual local state update here.
      // Component will invalidate React Query products.
    } catch (err: any) {
      console.error('❌ Error updating product:', err.message);
      throw err;
    }
  },

  deleteProduct: async (id) => {
    try {
      const res = await fetch(`/api/products?id=${id}`, {
        method: 'DELETE',
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        return { success: false, error: data.error || 'فشل حذف المنتج' };
      }

      return { success: true };
    } catch (err: any) {
      console.error('❌ Error deleting product:', err.message);
      return { success: false, error: err.message };
    }
  },
});
