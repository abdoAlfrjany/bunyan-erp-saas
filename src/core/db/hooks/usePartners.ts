import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/core/db/supabase';
import { mapRowToPartner } from '../slices/partnersEmployeesSlice';
import type { Partner } from '../../types';

// ═══ أعمدة محددة ═══
const PARTNER_COLUMNS = 'id, tenant_id, name, phone, email, profit_percentage, capital_contribution, wallet_balance, debt_balance, is_active, joined_at, user_id, partner_role, delivery_fee_per_order, created_at';

export function usePartnersQuery(tenantId: string | undefined) {
  return useQuery({
    queryKey: ['partners', tenantId],
    queryFn: async (): Promise<Partner[]> => {
      if (!tenantId) return [];

      const supabase = createClient();
      const { data, error } = await supabase
        .from('partners')
        .select(PARTNER_COLUMNS)
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });

      if (error) {
        throw new Error(error.message);
      }

      return (data || []).map(mapRowToPartner);
    },
    enabled: !!tenantId,
    staleTime: 5 * 60 * 1000, 
  });
}
