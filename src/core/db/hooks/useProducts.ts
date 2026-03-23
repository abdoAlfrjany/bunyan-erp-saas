import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/core/db/supabase';
import { mapSupabaseRowToProduct } from '../slices/productsSlice';
import type { Product } from '../../types';

export function useProductsQuery(tenantId: string | undefined) {
  return useQuery({
    queryKey: ['products', tenantId],
    queryFn: async (): Promise<Product[]> => {
      if (!tenantId) return [];

      const supabase = createClient();
      const { data, error } = await supabase
        .from('products')
        .select(`
          id, tenant_id, name, category, unit, cost_price, selling_price,
          quantity, min_quantity, item_code, barcode, product_type,
          variants, is_active
        `)
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .limit(500); // 500 products fast-fetched on first demand

      if (error) {
        console.error('useProductsQuery error:', error.message);
        throw new Error(error.message);
      }

      return (data || []).map(mapSupabaseRowToProduct);
    },
    enabled: !!tenantId,
    // Background polling/caching configuration
    staleTime: 5 * 60 * 1000, // Products rarely mutate fundamentally, cache for 5 minutes
  });
}
