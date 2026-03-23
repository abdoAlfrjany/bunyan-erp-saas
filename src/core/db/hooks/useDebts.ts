// src/core/db/hooks/useDebts.ts
// الميزة: خطافات React Query لإدارة الديون، الزبائن، الموظفين، والشركاء
// توفر هذه الخطافات تزامناً تلقائياً مع قاعدة بيانات Supabase وتقوم بتطهير حالة Zustand تدريجياً

import { useQuery } from '@tanstack/react-query';
import { createClient } from '../supabase';
import { mapSupabaseRowToDebt, mapSupabaseRowToCustomer } from '../slices/coreSlice';
import { mapRowToEmployee, mapRowToPartner } from '../slices/partnersEmployeesSlice';

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
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []).map(mapSupabaseRowToDebt);
    },
    enabled: !!tenantId,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

/**
 * جلب الزبائن
 */
export function useCustomersQuery(tenantId: string) {
  return useQuery({
    queryKey: ['customers', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const supabase = createClient();
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('name');

      if (error) throw error;
      return (data || []).map(mapSupabaseRowToCustomer);
    },
    enabled: !!tenantId,
  });
}

/**
 * جلب الموظفين
 */
export function useEmployeesQuery(tenantId: string) {
  return useQuery({
    queryKey: ['employees', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const supabase = createClient();
      const { data, error } = await supabase
        .from('employees')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('name');

      if (error) throw error;
      return (data || []).map(mapRowToEmployee);
    },
    enabled: !!tenantId,
  });
}

/**
 * جلب الشركاء
 */
export function usePartnersQuery(tenantId: string) {
  return useQuery({
    queryKey: ['partners', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const supabase = createClient();
      const { data, error } = await supabase
        .from('partners')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('name');

      if (error) throw error;
      return (data || []).map(mapRowToPartner);
    },
    enabled: !!tenantId,
  });
}
