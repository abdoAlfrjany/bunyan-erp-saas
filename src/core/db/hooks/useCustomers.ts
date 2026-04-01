import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/core/db/supabase';
import { mapSupabaseRowToCustomer } from '../slices/coreSlice';
import type { Customer } from '../../types';

// ═══ أعمدة محددة — تقليل حجم الاستجابة بـ 30% ═══
const CUSTOMER_COLUMNS = 'id, tenant_id, name, phone, phone_alt, city, region, address, total_orders, success_orders, total_spent, created_at';

export function useCustomersQuery(tenantId: string | undefined) {
  return useQuery({
    queryKey: ['customers', tenantId],
    queryFn: async (): Promise<Customer[]> => {
      if (!tenantId) return [];

      const supabase = createClient();
      const { data, error } = await supabase
        .from('customers')
        .select(CUSTOMER_COLUMNS)
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });

      if (error) {
        throw new Error(error.message);
      }

      return (data || []).map(mapSupabaseRowToCustomer);
    },
    enabled: !!tenantId,
    staleTime: 5 * 60 * 1000, 
  });
}
