import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/core/db/supabase';
import { mapSupabaseRowToCourier, mapSupabaseRowToSettlement } from '../slices/coreSlice';
import type { CourierCompany, VanexSettlement } from '../../types';

// ═══ أعمدة محددة — لا نسحب api_credentials أبداً (تسريب أمني) ═══
const COURIER_COLUMNS = 'id, tenant_id, name, phone, tracking_url, is_active, is_internal, provider, created_at, short_code, merchant_code, contact_phone, contact_person, default_delivery_fee, api_provider, is_api_connected, pricing_zones, cities, webhook_secret';

const SETTLEMENT_COLUMNS = 'id, tenant_id, vanex_settlement_id, settlement_number, total_amount, delivery_fees, bank_commission, net_amount, payment_method, target_account_type, status, applied_at, created_at, package_count, courier_company_id, applied_by, treasury_tx_id, is_approximate';

export function useCouriersQuery(tenantId: string | undefined) {
  return useQuery({
    queryKey: ['couriers', tenantId],
    queryFn: async (): Promise<CourierCompany[]> => {
      if (!tenantId) return [];
      const supabase = createClient();
      const { data, error } = await supabase
        .from('couriers')
        .select(COURIER_COLUMNS)
        .eq('tenant_id', tenantId)
        .order('name');

      if (error) throw error;
      return (data || []).map(mapSupabaseRowToCourier);
    },
    enabled: !!tenantId,
    staleTime: 5 * 60 * 1000,
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
        .select(SETTLEMENT_COLUMNS)
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []).map(mapSupabaseRowToSettlement);
    },
    enabled: !!tenantId,
    staleTime: 2 * 60 * 1000,
  });
}
