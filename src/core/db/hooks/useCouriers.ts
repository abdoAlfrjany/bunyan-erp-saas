import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/core/db/supabase';
import { mapSupabaseRowToCourier, mapSupabaseRowToSettlement } from '../slices/coreSlice';
import type { CourierCompany, VanexSettlement } from '../../types';

export function useCouriersQuery(tenantId: string | undefined) {
  return useQuery({
    queryKey: ['couriers', tenantId],
    queryFn: async (): Promise<CourierCompany[]> => {
      if (!tenantId) return [];
      const supabase = createClient();
      const { data, error } = await supabase
        .from('couriers')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('name');

      if (error) throw error;
      return (data || []).map(mapSupabaseRowToCourier);
    },
    enabled: !!tenantId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useSettlementsQuery(tenantId: string | undefined) {
  return useQuery({
    queryKey: ['settlements', tenantId],
    queryFn: async (): Promise<VanexSettlement[]> => {
      if (!tenantId) return [];
      const supabase = createClient();
      const { data, error } = await supabase
        .from('courier_settlements')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []).map(mapSupabaseRowToSettlement);
    },
    enabled: !!tenantId,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}
