import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/core/db/supabase';
import { mapRowToPartner } from '../slices/partnersEmployeesSlice';
import type { Partner } from '../../types';

export function usePartnersQuery(tenantId: string | undefined) {
  return useQuery({
    queryKey: ['partners', tenantId],
    queryFn: async (): Promise<Partner[]> => {
      if (!tenantId) return [];

      const supabase = createClient();
      const { data, error } = await supabase
        .from('partners')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('usePartnersQuery error:', error.message);
        throw new Error(error.message);
      }

      return (data || []).map(mapRowToPartner);
    },
    enabled: !!tenantId,
    staleTime: 5 * 60 * 1000, 
  });
}
