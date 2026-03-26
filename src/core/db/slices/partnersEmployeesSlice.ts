// src/core/db/slices/partnersEmployeesSlice.ts
// الوظيفة: إدارة الشركاء والموظفين والرواتب والسلف
// الإصدار 2.0: هجرة كاملة لـ Supabase (Hybrid Sync)

import type { StateCreator } from 'zustand';
import type { Partner, Employee, Debt, TreasuryTransaction, TreasuryAccount } from '../../types';
import { createClient } from '../supabase';
import { useRulesStore } from '../../settings/rules.store';

// ══════════════════════════════════════════
// Mappers: Supabase (snake_case) ↔ App (camelCase)
// ══════════════════════════════════════════
export const mapRowToPartner = (row: Record<string, unknown>): Partner => {
  return {
    id: row['id'] as string,
    tenantId: row['tenant_id'] as string,
    name: row['name'] as string,
    phone: (row['phone'] as string) ?? '',
    email: row['email'] as string,
    profitPercentage: Number(row['profit_percentage'] || 0),
    capitalContribution: Number(row['capital_contribution'] || 0),
    walletBalance: Number(row['wallet_balance'] || 0),
    debtBalance: Number(row['debt_balance'] || 0),
    isActive: (row['is_active'] as boolean) ?? true,
    joinedAt: (row['joined_at'] as string) ?? new Date().toISOString(),
    userId: row['user_id'] as string,
    partnerRole: (row['partner_role'] as Partner['partnerRole']) || 'active_partner',
    deliveryFeePerOrder: Number(row['delivery_fee_per_order'] || 0),
  };
};

const mapPartnerToRow = (p: Partial<Partner> & { tenantId?: string }) => ({
  name: p.name,
  phone: p.phone,
  email: p.email,
  profit_percentage: p.profitPercentage,
  capital_contribution: p.capitalContribution,
  wallet_balance: p.walletBalance,
  debt_balance: p.debtBalance,
  is_active: p.isActive,
  joined_at: p.joinedAt,
  user_id: p.userId,
  partner_role: p.partnerRole,
  delivery_fee_per_order: p.deliveryFeePerOrder,
  ...(p.id ? { id: p.id } : {}),
  ...(p.tenantId ? { tenant_id: p.tenantId } : {}),
});

export const mapRowToEmployee = (row: Record<string, unknown>): Employee => {
  return {
    id: row['id'] as string,
    tenantId: row['tenant_id'] as string,
    name: row['name'] as string,
    phone: (row['phone'] as string) ?? '',
    email: row['email'] as string,
    salary: Number(row['salary'] || 0),
    startDate: (row['start_date'] as string) ?? new Date().toISOString(),
    salaryDay: Number(row['salary_day'] || 25),
    advanceBalance: Number(row['advance_balance'] || 0),
    allowanceBalance: Number(row['allowance_balance'] || 0),
    deductionBalance: Number(row['deduction_balance'] || 0),
    isActive: (row['is_active'] as boolean) ?? true,
    userId: row['user_id'] as string,
    hasSystemAccess: (row['has_system_access'] as boolean) ?? false,
    status: (row['status'] as Employee['status']) || 'active',
    jobTitle: row['job_title'] as string,
    employmentType: (row['employment_type'] as Employee['employmentType']) || 'full_time',
    nationalId: row['national_id'] as string,
    personalAddress: row['personal_address'] as string,
    lastPaymentDate: row['last_payment_date'] as string,
    lastPayrollDate: row['last_payroll_date'] as string,
  };
};

const mapEmployeeToRow = (e: Partial<Employee> & { tenantId?: string }) => ({
  name: e.name,
  phone: e.phone,
  email: e.email,
  salary: e.salary,
  start_date: e.startDate,
  salary_day: e.salaryDay,
  advance_balance: e.advanceBalance,
  allowance_balance: e.allowanceBalance,
  deduction_balance: e.deductionBalance,
  is_active: e.isActive,
  user_id: e.userId,
  has_system_access: e.hasSystemAccess,
  status: e.status,
  job_title: e.jobTitle,
  employment_type: e.employmentType,
  national_id: e.nationalId,
  personal_address: e.personalAddress,
  last_payment_date: e.lastPaymentDate,
  last_payroll_date: e.lastPayrollDate,
  ...(e.id ? { id: e.id } : {}),
  ...(e.tenantId ? { tenant_id: e.tenantId } : {}),
});

// ══════════════════════════════════════════
// Helper: إنشاء حساب Auth عبر API Route
// ══════════════════════════════════════════
async function createAuthUser(params: {
  email: string;
  password: string;
  tenantId: string;
  fullName: string;
  role: 'partner' | 'employee';
  permissions: Record<string, unknown>;
  phone?: string;
}): Promise<{ success: boolean; userId?: string; error?: string }> {
  try {
    const res = await fetch('/api/create-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    const data = await res.json();
    if (!res.ok) return { success: false, error: data.error };
    return { success: true, userId: data.userId };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return { success: false, error: msg };
  }
}

// ══════════════════════════════════════════
// Interface
// ══════════════════════════════════════════
export interface PartnersEmployeesSlice {
  partners: Partner[];
  employees: Employee[];

  // Partners
  fetchPartners: (tenantId: string) => Promise<void>;
  addPartner: (p: Partner & { password?: string }) => Promise<{ success: boolean; error?: string }>;
  updatePartner: (id: string, data: Partial<Partner>) => Promise<void>;
  deletePartner: (id: string) => Promise<{ success: boolean; error?: string }>;
  withdrawPartnerFunds: (
    partnerId: string,
    amount: number,
    opts?: { description?: string; deductDebt?: boolean; transactionDate?: string }
  ) => { success: boolean; error?: string };
  distributeProfits: (tenantId: string, amountToDistribute: number) => { success: boolean; error?: string };

  // Employees
  fetchEmployees: (tenantId: string) => Promise<void>;
  addEmployee: (e: Employee & { password?: string }) => Promise<{ success: boolean; error?: string }>;
  updateEmployee: (id: string, data: Partial<Employee>) => Promise<void>;
  deleteEmployee: (id: string) => Promise<{ success: boolean; error?: string }>;
  issuePayroll: (
    tenantId: string,
    monthString: string,
    details: {
      employeeId: string;
      netAmount: number;
      advanceDeduction: number;
      allowanceApplied: number;
      deductionApplied: number;
    }[]
  ) => { success: boolean; error?: string };
  recordEmployeeFinancial: (
    employeeId: string,
    type: 'advance' | 'bonus' | 'deduction',
    amount: number,
    reason?: string
  ) => { success: boolean; error?: string };
}

// ══════════════════════════════════════════
// Local State Subset to avoid circular dependency
// ══════════════════════════════════════════
type StateSubset = PartnersEmployeesSlice & {
  treasury: TreasuryAccount[];
  transactions: TreasuryTransaction[];
  debts: Debt[];
  addTransaction: (tx: TreasuryTransaction) => Promise<{ success: boolean; error?: string }>;
  addDebt: (debt: Debt) => Promise<{ success: boolean; error?: string }>;
};

// ══════════════════════════════════════════
// Slice Implementation
// ══════════════════════════════════════════
export const createPartnersEmployeesSlice: StateCreator<StateSubset, [], [], PartnersEmployeesSlice> = (set, get) => ({
  partners: [],
  employees: [],

  // ══ FETCH PARTNERS ══
  fetchPartners: async (tenantId) => {
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('partners')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      set({ partners: (data || []).map(mapRowToPartner) });
    } catch (e) {
      if (e instanceof Error) console.error('fetchPartners error:', e.message);
    }
  },

  // ══ ADD PARTNER ══
  addPartner: async (p) => {
    try {
      const supabase = createClient();
      let userId: string | undefined;

      // إذا كان للشريك بريد إلكتروني وكلمة مرور → إنشاء حساب Auth
      const partnerWithPass = p as Partner & { password?: string };
      if (p.email && partnerWithPass.password) {
        const partnerPermissions = {
          inventory: { view: false, add: false, edit: false, delete: false, viewCostPrice: false },
          orders: { view: false, add: false, edit: false, delete: false, changeStatus: false, viewAll: false },
          delivery: { view: false, addShipment: false, manageCompanies: false, viewSettlements: false, addSettlement: false },
          treasury: { view: false, addTransaction: false },
          partners: { view: false, viewOwn: true },
          hr: { view: false, viewOwn: false },
          analytics: { view: true, viewFull: false },
          settings: { view: false, edit: false },
        };

        const result = await createAuthUser({
          email: p.email,
          password: partnerWithPass.password,
          tenantId: p.tenantId,
          fullName: p.name,
          role: 'partner',
          permissions: partnerPermissions,
          phone: p.phone,
        });

        if (!result.success) {
          console.warn('[addPartner] Auth creation failed:', result.error);
          // لا نوقف إضافة الشريك — فقط بدون حساب دخول
        } else {
          userId = result.userId;
        }
      }

      const rowToInsert = mapPartnerToRow({ ...p, userId: userId || p.userId });
      const { data: insertData, error } = await supabase
        .from('partners')
        .insert([rowToInsert])
        .select()
        .single();

      if (error) throw error;
      set((s) => ({ partners: [mapRowToPartner(insertData), ...s.partners] }));
      return { success: true };
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unknown error';
      console.error('addPartner error:', msg);
      return { success: false, error: msg };
    }
  },

  // ══ UPDATE PARTNER ══
  updatePartner: async (id, data) => {
    try {
      const supabase = createClient();
      const row = mapPartnerToRow(data) as Record<string, unknown>;
      // إزالة الحقول undefined
      Object.keys(row).forEach(k => row[k] === undefined && delete row[k]);
      const { error } = await supabase.from('partners').update(row).eq('id', id);
      if (error) throw error;
      set((s) => ({
        partners: s.partners.map((p: Partner) => (p.id === id ? { ...p, ...data } : p)),
      }));
    } catch (e) {
      if (e instanceof Error) console.error('updatePartner error:', e.message);
    }
  },

  // ══ DELETE PARTNER ══
  deletePartner: async (id) => {
    const state = get();
    const partner = state.partners.find((p: Partner) => p.id === id);
    if (!partner) return { success: false, error: 'الشريك غير موجود' };
    if (partner.capitalContribution > 0)
      return { success: false, error: 'لا يمكن حذف هذا الشريك — لديه رأس مال مسجل. قم بتصفية حصته أولاً' };
    if (partner.debtBalance > 0)
      return { success: false, error: 'لا يمكن حذف هذا الشريك — لديه ديون غير مسددة' };
    if (partner.walletBalance > 0)
      return { success: false, error: 'لا يمكن حذف هذا الشريك — لديه مستحقات غير مسحوبة في محفظته' };

    try {
      const supabase = createClient();
      // تعطيل حساب الدخول إذا وجد
      if (partner.userId) {
        await supabase.from('profiles').update({ is_active: false }).eq('id', partner.userId);
      }
      const { error } = await supabase.from('partners').delete().eq('id', id);
      if (error) throw error;
      set((s) => ({ partners: s.partners.filter((p: Partner) => p.id !== id) }));
      return { success: true };
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unknown error';
      return { success: false, error: msg };
    }
  },

  // ══ WITHDRAW PARTNER FUNDS ══
  withdrawPartnerFunds: (partnerId, amount, opts) => {
    const state = get();
    const partner = state.partners.find((p: Partner) => p.id === partnerId);
    if (!partner) return { success: false, error: 'الشريك غير موجود' };
    if (amount <= 0) return { success: false, error: 'مبلغ السحب يجب أن يكون أكبر من صفر' };
    if (amount > partner.walletBalance)
      return { success: false, error: 'الرصيد المطلوب يتجاوز المتاح في محفظة الشريك' };

    const cashAccount = state.treasury.find(
      (a) => a.tenantId === partner.tenantId && a.accountType === 'cash_in_hand'
    );
    if (!cashAccount) return { success: false, error: 'حساب الخزينة (الكاش) غير موجود' };

    const debtToDeduct =
      opts?.deductDebt && partner.debtBalance > 0 ? Math.min(partner.debtBalance, amount) : 0;
    const actualPaid = amount - debtToDeduct;

    const allowNegativeTreasury = useRulesStore.getState().rules.allowNegativeTreasury;
    if (!allowNegativeTreasury && actualPaid > cashAccount.balance) {
      return {
        success: false,
        error: `رصيد الخزينة الحالي لا يغطي هذه السحبة. المتاح للنقد: ${cashAccount.balance} د.ل`,
      };
    }

    const newPartners = state.partners.map((p: Partner) =>
      p.id === partnerId
        ? { ...p, walletBalance: p.walletBalance - amount, debtBalance: p.debtBalance - debtToDeduct }
        : p
    );

    const txDate = opts?.transactionDate || new Date().toISOString().split('T')[0];
    const description = opts?.description || 'سحب أرباح';

    const transactionsToAdd: TreasuryTransaction[] = [];
    if (actualPaid > 0) {
      transactionsToAdd.push({
        id: crypto.randomUUID(),
        tenantId: partner.tenantId,
        accountId: cashAccount.id,
        transactionType: 'partner_withdrawal',
        amount: -Math.abs(actualPaid),
        description: `${description} — ${partner.name}${debtToDeduct > 0 ? ` (تم خصم دين بقيمة ${debtToDeduct})` : ''}`,
        createdAt: new Date().toISOString(),
        transactionDate: txDate,
      });
    }

    const newTreasury = state.treasury.map((a) =>
      a.id === cashAccount.id ? { ...a, balance: a.balance - actualPaid } : a
    );

    let newDebts = [...state.debts];
    if (debtToDeduct > 0) {
      let remainingToDeduct = debtToDeduct;
      newDebts = newDebts.map((debt: Debt) => {
        if (remainingToDeduct <= 0) return debt;
        if (debt.linkedEntityId === partnerId && debt.status !== 'paid') {
          const canPay = Math.min(debt.amount - debt.paidAmount, remainingToDeduct);
          if (canPay > 0) {
            remainingToDeduct -= canPay;
            const newPaid = debt.paidAmount + canPay;
            return {
              ...debt,
              paidAmount: newPaid,
              status: newPaid >= debt.amount ? 'paid' : 'partial',
              paymentHistory: [
                ...debt.paymentHistory,
                { id: crypto.randomUUID(), amount: canPay, date: txDate, createdAt: new Date().toISOString() },
              ],
            };
          }
        }
        return debt;
      });
    }

    // تحديث Supabase للشريك
    const supabase = createClient();
    const updatedPartner = newPartners.find((p: Partner) => p.id === partnerId);
    if (updatedPartner) {
      supabase.from('partners').update({
        wallet_balance: updatedPartner.walletBalance,
        debt_balance: updatedPartner.debtBalance,
      }).eq('id', partnerId).then(({ error }) => {
        if (error) console.error('withdrawPartnerFunds - Supabase update error:', error.message);
      });
    }

    set({
      partners: newPartners,
      transactions: [...transactionsToAdd, ...state.transactions],
      treasury: newTreasury,
      debts: newDebts,
    });

    // إرسال حركة السحب لـ Supabase عبر addTransaction
    if (transactionsToAdd.length > 0) {
      setTimeout(() => {
        get().addTransaction(transactionsToAdd[0]);
      }, 0);
    }

    return { success: true };
  },

  // ══ DISTRIBUTE PROFITS ══
  distributeProfits: (tenantId, amountToDistribute) => {
    const state = get();
    if (amountToDistribute <= 0)
      return { success: false, error: 'مبلغ الأرباح الموزعة يجب أن يكون أكبر من الصفر' };

    const activePartners = state.partners.filter((p: Partner) => p.tenantId === tenantId && p.isActive);
    if (activePartners.length === 0)
      return { success: false, error: 'لا يوجد شركاء فعالون لتوزيع الأرباح عليهم' };

    const updatedPartners = state.partners.map((p: Partner) => {
      if (p.tenantId === tenantId && p.isActive) {
        const share = amountToDistribute * (p.profitPercentage / 100);
        return { ...p, walletBalance: p.walletBalance + share };
      }
      return p;
    });

    const newTx: TreasuryTransaction = {
      id: crypto.randomUUID(),
      tenantId,
      accountId: 'system_profit',
      transactionType: 'profit_distribution_record',
      amount: amountToDistribute,
      description: 'دورة استخراج وتوزيع أرباح النظام',
      createdAt: new Date().toISOString(),
      transactionDate: new Date().toISOString().split('T')[0],
    };

    set({ partners: updatedPartners, transactions: [newTx, ...state.transactions] });

    // تحديث wallet_balance في Supabase لكل شريك
    const supabase = createClient();
    updatedPartners.filter((p: Partner) => p.tenantId === tenantId && p.isActive).forEach((p: Partner) => {
      supabase.from('partners').update({ wallet_balance: p.walletBalance }).eq('id', p.id)
        .then(({ error }) => { if (error) console.error('distributeProfits - Supabase error:', error.message); });
    });

    return { success: true };
  },

  // ══ FETCH EMPLOYEES ══
  fetchEmployees: async (tenantId) => {
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('employees')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      set({ employees: (data || []).map(mapRowToEmployee) });
    } catch (e) {
      if (e instanceof Error) console.error('fetchEmployees error:', e.message);
    }
  },

  // ══ ADD EMPLOYEE ══
  addEmployee: async (e) => {
    try {
      const supabase = createClient();
      let userId: string | undefined;

      // إذا كان للموظف hasSystemAccess + بيانات دخول → إنشاء حساب Auth
      const empWithPass = e as Employee & { password?: string };
      if (e.hasSystemAccess && e.email && empWithPass.password) {
        const employeePermissions = {
          inventory: { view: true, add: false, edit: false, delete: false, viewCostPrice: false },
          orders: { view: true, add: true, edit: false, delete: false, changeStatus: true, viewAll: false },
          delivery: { view: true, addShipment: true, manageCompanies: false, viewSettlements: false, addSettlement: false },
          treasury: { view: false, addTransaction: false },
          partners: { view: false, viewOwn: false },
          hr: { view: false, viewOwn: true },
          analytics: { view: false, viewFull: false },
          settings: { view: false, edit: false },
        };

        const result = await createAuthUser({
          email: e.email,
          password: empWithPass.password,
          tenantId: e.tenantId,
          fullName: e.name,
          role: 'employee',
          permissions: employeePermissions,
          phone: e.phone,
        });

        if (!result.success) {
          console.warn('[addEmployee] Auth creation failed:', result.error);
        } else {
          userId = result.userId;
        }
      }

      const rowToInsert = mapEmployeeToRow({ ...e, userId: userId || e.userId });
      const { data: insertData, error } = await supabase
        .from('employees')
        .insert([rowToInsert])
        .select()
        .single();

      if (error) throw error;
      set((s) => ({ employees: [mapRowToEmployee(insertData), ...s.employees] }));
      return { success: true };
    } catch (e_) {
      const msg = e_ instanceof Error ? e_.message : 'Unknown error';
      console.error('addEmployee error:', msg);
      return { success: false, error: msg };
    }
  },

  // ══ UPDATE EMPLOYEE ══
  updateEmployee: async (id, data) => {
    try {
      const supabase = createClient();
      const row = mapEmployeeToRow(data) as Record<string, unknown>;
      Object.keys(row).forEach(k => row[k] === undefined && delete row[k]);
      const { error } = await supabase.from('employees').update(row).eq('id', id);
      if (error) throw error;
      set((s) => ({
        employees: s.employees.map((e: Employee) => (e.id === id ? { ...e, ...data } : e)),
      }));
    } catch (e) {
      if (e instanceof Error) console.error('updateEmployee error:', e.message);
    }
  },

  // ══ DELETE EMPLOYEE ══
  deleteEmployee: async (id) => {
    const state = get();
    const emp = state.employees.find((e: Employee) => e.id === id);
    if (!emp) return { success: false, error: 'الموظف غير موجود' };
    if (emp.advanceBalance > 0)
      return {
        success: false,
        error: `لا يمكن حذف هذا الموظف — لديه سلفة غير مسددة (${emp.advanceBalance} د.ل)`,
      };

    try {
      const supabase = createClient();
      // تعطيل حساب الدخول إذا وجد
      if (emp.userId) {
        await supabase.from('profiles').update({ is_active: false }).eq('id', emp.userId);
      }
      const { error } = await supabase.from('employees').delete().eq('id', id);
      if (error) throw error;
      set((s) => ({ employees: s.employees.filter((e: Employee) => e.id !== id) }));
      return { success: true };
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unknown error';
      return { success: false, error: msg };
    }
  },

  // ══ ISSUE PAYROLL ══
  issuePayroll: (tenantId, monthString, details) => {
    const state = get();
    const cashAccount = state.treasury.find(
      (a) => a.tenantId === tenantId && a.accountType === 'cash_in_hand'
    );
    if (!cashAccount) return { success: false, error: 'لا يوجد حساب خزينة (كاش) متاح' };

    const totalPayout = details.reduce((sum, d) => sum + d.netAmount, 0);
    const allowNegativeTreasury = useRulesStore.getState().rules.allowNegativeTreasury;

    if (!allowNegativeTreasury && totalPayout > cashAccount.balance) {
      return {
        success: false,
        error: `الرصيد النقدي لا يكفي لصرف الرواتب. المتاح: ${cashAccount.balance} د.ل، المطلوب: ${totalPayout} د.ل`,
      };
    }

    const newTxList: TreasuryTransaction[] = [];
    let newDebts = [...state.debts];

    const newEmps = state.employees.map((e: Employee) => {
      const d = details.find((x) => x.employeeId === e.id);
      if (!d) return e;

      if (d.advanceDeduction > 0) {
        let remainingToDeduct = d.advanceDeduction;
        newDebts = newDebts.map((debt: Debt) => {
          if (remainingToDeduct <= 0) return debt;
          if (
            debt.linkedEntityId === e.id &&
            debt.status !== 'paid' &&
            debt.debtCategory === 'employee_advance'
          ) {
            const canPay = Math.min(debt.amount - debt.paidAmount, remainingToDeduct);
            if (canPay > 0) {
              remainingToDeduct -= canPay;
              const newPaid = debt.paidAmount + canPay;
              return {
                ...debt,
                paidAmount: newPaid,
                status: newPaid >= debt.amount ? 'paid' : 'partial',
                paymentHistory: [
                  ...debt.paymentHistory,
                  {
                    id: crypto.randomUUID(),
                    amount: canPay,
                    date: new Date().toISOString(),
                    createdAt: new Date().toISOString(),
                  },
                ],
              };
            }
          }
          return debt;
        });
      }

      if (d.netAmount > 0) {
        newTxList.push({
          id: crypto.randomUUID(),
          tenantId: e.tenantId,
          accountId: cashAccount.id,
          transactionType: 'expense',
          amount: -Math.abs(d.netAmount),
          description: `راتب شهر ${monthString} - ${e.name}`,
          createdAt: new Date().toISOString(),
          transactionDate: new Date().toISOString().split('T')[0],
        });
      }

      return {
        ...e,
        lastPayrollDate: monthString,
        lastPaymentDate: new Date().toISOString(),
        advanceBalance: Math.max(0, e.advanceBalance - d.advanceDeduction),
        allowanceBalance: Math.max(0, e.allowanceBalance - d.allowanceApplied),
        deductionBalance: Math.max(0, e.deductionBalance - d.deductionApplied),
      };
    });

    const newTreasury = state.treasury.map((a) =>
      a.id === cashAccount.id ? { ...a, balance: a.balance - totalPayout } : a
    );

    set({
      employees: newEmps,
      treasury: newTreasury,
      transactions: [...newTxList, ...state.transactions],
      debts: newDebts,
    });

    // إرسال معاملات الرواتب لـ Supabase
    newTxList.forEach(tx => {
      get().addTransaction(tx).catch((err) => console.error('issuePayroll transaction failed:', err));
    });

    // تحديث أرصدة الموظفين في Supabase
    const supabase = createClient();
    newEmps.forEach((e: Employee) => {
      if (details.find(d => d.employeeId === e.id)) {
        supabase.from('employees').update({
          advance_balance: e.advanceBalance,
          allowance_balance: e.allowanceBalance,
          deduction_balance: e.deductionBalance,
          last_payroll_date: e.lastPayrollDate,
          last_payment_date: e.lastPaymentDate,
        }).eq('id', e.id).then(({ error }) => {
          if (error) console.error('issuePayroll - employee update error:', error.message);
        });
      }
    });

    return { success: true };
  },

  // ══ RECORD EMPLOYEE FINANCIAL ══
  recordEmployeeFinancial: (employeeId, type, amount, reason) => {
    const state = get();
    const emp = state.employees.find((e: Employee) => e.id === employeeId);
    if (!emp) return { success: false, error: 'الموظف غير موجود' };
    if (amount <= 0) return { success: false, error: 'المبلغ يجب أن يكون أكبر من 0' };

    let newEmps = [...state.employees];
    let newTxList = [...state.transactions];
    let newTreasury = [...state.treasury];

    if (type === 'advance') {
      const cashAccount = state.treasury.find(
        (a) => a.tenantId === emp.tenantId && a.accountType === 'cash_in_hand'
      );
      if (!cashAccount) return { success: false, error: 'لا توجد خزينة كاش متاحة' };

      const allowNegativeTreasury = useRulesStore.getState().rules.allowNegativeTreasury;
      if (!allowNegativeTreasury && amount > cashAccount.balance) {
        return {
          success: false,
          error: `الرصيد النقدي لا يكفي لإعطاء هذه السلفة. المتاح: ${cashAccount.balance} د.ل`,
        };
      }

      newEmps = newEmps.map((e: Employee) =>
        e.id === employeeId ? { ...e, advanceBalance: e.advanceBalance + amount } : e
      );
      newTreasury = newTreasury.map((a) =>
        a.id === cashAccount.id ? { ...a, balance: a.balance - amount } : a
      );

      const newTx: TreasuryTransaction = {
        id: crypto.randomUUID(),
        tenantId: emp.tenantId,
        accountId: cashAccount.id,
        transactionType: 'expense',
        amount: -amount,
        description: `سلفة نقدية: ${emp.name} ${reason ? `(${reason})` : ''}`,
        createdAt: new Date().toISOString(),
        transactionDate: new Date().toISOString().split('T')[0],
      };
      newTxList = [newTx, ...newTxList];

      const newAdvanceDebt: Debt = {
        id: crypto.randomUUID(),
        tenantId: emp.tenantId,
        amount,
        paidAmount: 0,
        debtType: 'internal',
        debtCategory: 'employee_advance',
        linkedEntityId: emp.id,
        linkedEntityType: 'employee',
        linkedEntityName: emp.name,
        paymentHistory: [],
        dueDate: new Date(new Date().setMonth(new Date().getMonth() + 1)).toISOString().split('T')[0],
        status: 'active',
        description: `سلفة نقدية - ${reason || ''}`,
        createdAt: new Date().toISOString(),
      };

      set((s) => ({
        employees: newEmps,
        treasury: newTreasury,
        transactions: newTxList,
        debts: [newAdvanceDebt, ...s.debts],
      }));

      // مزامنة مع Supabase
      const supabase = createClient();
      supabase.from('employees').update({ advance_balance: emp.advanceBalance + amount }).eq('id', employeeId)
        .then(({ error }) => { if (error) console.error('advance - employee update error:', error.message); });
      get().addTransaction(newTx).catch((err) => console.error('recordEmployeeFinancial transaction failed:', err));
      get().addDebt(newAdvanceDebt).catch((err) => console.error('recordEmployeeFinancial debt failed:', err));

      return { success: true };
    } else if (type === 'bonus') {
      newEmps = newEmps.map((e: Employee) =>
        e.id === employeeId ? { ...e, allowanceBalance: e.allowanceBalance + amount } : e
      );
      const supabase = createClient();
      supabase.from('employees').update({ allowance_balance: emp.allowanceBalance + amount }).eq('id', employeeId)
        .then(({ error }) => { if (error) console.error('bonus - employee update error:', error.message); });
    } else if (type === 'deduction') {
      newEmps = newEmps.map((e: Employee) =>
        e.id === employeeId ? { ...e, deductionBalance: e.deductionBalance + amount } : e
      );
      const supabase = createClient();
      supabase.from('employees').update({ deduction_balance: emp.deductionBalance + amount }).eq('id', employeeId)
        .then(({ error }) => { if (error) console.error('deduction - employee update error:', error.message); });
    }

    set({ employees: newEmps, treasury: newTreasury, transactions: newTxList });
    return { success: true };
  },
});
