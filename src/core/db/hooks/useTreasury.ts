import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/core/db/supabase';
import { mapSupabaseRowToTreasuryAccount, mapSupabaseRowToTransaction } from '../slices/coreSlice';
import type { TreasuryAccount, TreasuryTransaction } from '../../types';

export function useTreasuryQuery(tenantId: string | undefined) {
  return useQuery({
    queryKey: ['treasury', tenantId],
    queryFn: async (): Promise<{ accounts: TreasuryAccount[]; transactions: TreasuryTransaction[] }> => {
      if (!tenantId) return { accounts: [], transactions: [] };

      const supabase = createClient();
      const [accRes, txRes] = await Promise.all([
        supabase.from('treasury_accounts').select('*').eq('tenant_id', tenantId).limit(50),
        supabase.from('treasury_transactions').select('*').eq('tenant_id', tenantId).order('created_at', { ascending: false }).limit(200)
      ]);

      if (accRes.error) throw accRes.error;
      if (txRes.error) throw txRes.error;

      let accounts = (accRes.data || []).map(mapSupabaseRowToTreasuryAccount);
      
      // Auto-create default 'cash_in_hand' account if none exists (mirroring coreSlice logic)
      if (accounts.length === 0) {
        const defaultAccount = {
          tenant_id: tenantId,
          account_name: 'الخزينة الرئيسية',
          account_type: 'cash_in_hand',
          balance: 0,
        };
        const insertRes = await supabase.from('treasury_accounts').insert(defaultAccount).select('*').single();
        if (!insertRes.error && insertRes.data) {
          accounts = [mapSupabaseRowToTreasuryAccount(insertRes.data)];
        }
      }

      const transactions = (txRes.data || []).map(mapSupabaseRowToTransaction);

      return { accounts, transactions };
    },
    enabled: !!tenantId,
    staleTime: 30 * 1000, // Treasury is more sensitive than products, keep fresh
  });
}
