// src/core/db/hooks/useDebts.ts
// الميزة: خطافات React Query لإدارة الديون
// ✅ Performance: أعمدة محددة + staleTime مضبوط

import { useQuery } from '@tanstack/react-query';
import { createClient } from '../supabase';
import { mapSupabaseRowToDebt } from '../slices/coreSlice';

// ═══ أعمدة محددة — تجنب سحب payment_history الكبير بلا داعي ═══
const DEBT_COLUMNS = 'id, tenant_id, amount, paid_amount, due_date, status, debt_type, debt_category, linked_entity_id, linked_entity_name, notes, payment_history, created_at, created_by';

/**
 * جلب جميع الديون الخاصة بالمستأجر
 */
export function useDebtsQuery(tenantId: string) {
  return useQuery({
    queryKey: ['debts', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const supabase = createClient();
      const { data, error } = await supabase
        .from('debts')
        .select(DEBT_COLUMNS)
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []).map(mapSupabaseRowToDebt);
    },
    enabled: !!tenantId,
    staleTime: 1000 * 60 * 5,
  });
}
