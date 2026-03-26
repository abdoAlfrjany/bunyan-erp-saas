import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/core/db/supabase';
import { mapRowToEmployee } from '../slices/partnersEmployeesSlice';
import type { Employee } from '../../types';

export function useEmployeesQuery(tenantId: string | undefined) {
  return useQuery({
    queryKey: ['employees', tenantId],
    queryFn: async (): Promise<Employee[]> => {
      if (!tenantId) return [];

      const supabase = createClient();
      const { data, error } = await supabase
        .from('employees')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('useEmployeesQuery error:', error.message);
        throw new Error(error.message);
      }

      return (data || []).map(mapRowToEmployee);
    },
    enabled: !!tenantId,
    staleTime: 5 * 60 * 1000, 
  });
}
