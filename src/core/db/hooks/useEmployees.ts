import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/core/db/supabase';
import { mapRowToEmployee } from '../slices/partnersEmployeesSlice';
import type { Employee } from '../../types';

// ═══ أعمدة محددة ═══
const EMPLOYEE_COLUMNS = 'id, tenant_id, name, phone, email, salary, start_date, salary_day, advance_balance, allowance_balance, deduction_balance, is_active, user_id, has_system_access, status, job_title, employment_type, national_id, personal_address, last_payment_date, last_payroll_date, created_at';

export function useEmployeesQuery(tenantId: string | undefined) {
  return useQuery({
    queryKey: ['employees', tenantId],
    queryFn: async (): Promise<Employee[]> => {
      if (!tenantId) return [];

      const supabase = createClient();
      const { data, error } = await supabase
        .from('employees')
        .select(EMPLOYEE_COLUMNS)
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });

      if (error) {
        throw new Error(error.message);
      }

      return (data || []).map(mapRowToEmployee);
    },
    enabled: !!tenantId,
    staleTime: 5 * 60 * 1000, 
  });
}
