import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/core/db/supabase';
import { mapSupabaseRowToOrder } from '../slices/ordersSlice';
import type { Order } from '../../types';

export function useOrdersQuery(tenantId: string | undefined) {
  return useQuery({
    queryKey: ['orders', tenantId],
    queryFn: async (): Promise<Order[]> => {
      if (!tenantId) return [];

      const supabase = createClient();
      const { data, error } = await supabase
        .from('orders')
        .select(`
          id, tenant_id, order_number, customer_name, customer_phone, 
          customer_city, delivery_type, status, total, payment_status, 
          created_at, delivery_fee, courier_company_id, courier_tracking_code, 
          courier_raw_status, discount, items
        `)
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .limit(300); // 300 orders fetched efficiently on the exact page load

      if (error) {
        console.error('useOrdersQuery error:', error.message);
        throw new Error(error.message);
      }

      return (data || []).map(mapSupabaseRowToOrder);
    },
    enabled: !!tenantId,
    // Stale time: 1 minute before refetching automatically in background
    staleTime: 60 * 1000, 
  });
}
