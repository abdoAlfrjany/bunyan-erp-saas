// src/core/db/slices/coreSlice.ts
// الوظيفة: كل العمليات الأساسية المتبقية
// شاملاً: Couriers, Debts, Tenants, Treasury, Users, Notifications, Super Admin

import type { StateCreator } from 'zustand';
import type {
  CourierCompany,
  Debt,
  Tenant,
  TreasuryAccount,
  TreasuryTransaction,
  TenantUser,
  Notification,
  SystemAnnouncement,
  AuditLog,
  Subscription,
  Customer,
  VanexSettlement,
} from '../../types';
import { createClient } from '../supabase';

// ══════════════════════════════════════════
// Helpers: Mappers between Supabase & App
// ══════════════════════════════════════════
export const mapSupabaseRowToCourier = (row: Record<string, unknown>): CourierCompany => ({
  id: row['id'] as string,
  tenantId: row['tenant_id'] as string,
  name: row['name'] as string,
  phone: typeof row['phone'] === 'string' ? row['phone'] : undefined,
  trackingUrl: typeof row['tracking_url'] === 'string' ? row['tracking_url'] : undefined,
  isActive: (row['is_active'] as boolean) ?? true,
  isInternal: (row['is_internal'] as boolean) ?? false,
  provider: (row['provider'] as 'vanex' | 'internal') || 'internal',
  createdAt: row['created_at'] as string,
  shortCode: typeof row['short_code'] === 'string' ? row['short_code'] : undefined,
  merchantCode: typeof row['merchant_code'] === 'string' ? row['merchant_code'] : undefined,
  contactPhone: typeof row['contact_phone'] === 'string' ? row['contact_phone'] : undefined,
  contactPerson: typeof row['contact_person'] === 'string' ? row['contact_person'] : undefined,
  defaultDeliveryFee: Number(row['default_delivery_fee'] || 0),
  apiProvider: (row['api_provider'] as 'vanex' | 'mock' | 'none') || undefined,
  isApiConnected: (row['is_api_connected'] as boolean) ?? false,
  apiCredentials: row['api_credentials'] as CourierCompany['apiCredentials'],
  pricingZones: row['pricing_zones'] as CourierCompany['pricingZones'],
  cities: Array.isArray(row['cities']) ? (row['cities'] as string[]) : undefined,
});

export const mapCourierToSupabaseRow = (c: Partial<CourierCompany> & { tenantId?: string }) => ({
  name: c.name,
  phone: c.phone,
  tracking_url: c.trackingUrl,
  is_active: c.isActive,
  is_internal: c.isInternal,
  provider: c.provider,
  short_code: c.shortCode,
  merchant_code: c.merchantCode,
  contact_phone: c.contactPhone,
  contact_person: c.contactPerson,
  default_delivery_fee: c.defaultDeliveryFee,
  api_provider: c.apiProvider,
  is_api_connected: c.isApiConnected,
  api_credentials: c.apiCredentials,
  pricing_zones: c.pricingZones,
  cities: c.cities,
  ...(c.id ? { id: c.id } : {}),
  ...(c.tenantId ? { tenant_id: c.tenantId } : {}),
});

export const mapSupabaseRowToSettlement = (row: Record<string, unknown>): VanexSettlement => ({
  id: row['id'] as string,
  tenantId: row['tenant_id'] as string,
  vanexSettlementId: row['vanex_settlement_id'] as number,
  settlementNumber: row['settlement_number'] as string,
  totalAmount: Number(row['total_amount'] || 0),
  deliveryFees: Number(row['delivery_fees'] || 0),
  bankCommission: Number(row['bank_commission'] || 0),
  netAmount: Number(row['net_amount'] || 0),
  paymentMethod: row['payment_method'] as 'cash' | 'bank_transfer' | 'online',
  targetAccountType: row['target_account_type'] as 'cash_in_hand' | 'bank',
  status: row['status'] as 'pending' | 'applied' | 'approved' | 'rejected',
  appliedAt: typeof row['applied_at'] === 'string' ? row['applied_at'] : undefined,
  createdAt: row['created_at'] as string,
  packageCount: row['package_count'] as number,
  courierCompanyId: row['courier_company_id'] as string,
  isApproximate: (row['is_approximate'] as boolean) ?? false,
});

export const mapSupabaseRowToTreasuryAccount = (row: Record<string, unknown>): TreasuryAccount => ({
  id: row['id'] as string,
  tenantId: row['tenant_id'] as string,
  accountName: row['account_name'] as string,
  accountType: row['account_type'] as 'cash_in_hand' | 'bank' | 'with_courier',
  balance: Number((row['balance'] as number) || 0),
  linkedCourierId: row['linked_courier_id'] as string,
});

export const mapTreasuryAccountToSupabaseRow = (a: Partial<TreasuryAccount> & { tenantId?: string }) => ({
  account_name: a.accountName,
  account_type: a.accountType,
  balance: a.balance,
  linked_courier_id: a.linkedCourierId,
  ...(a.id ? { id: a.id } : {}),
  ...(a.tenantId ? { tenant_id: a.tenantId } : {}),
});

export const mapSupabaseRowToTransaction = (row: Record<string, unknown>): TreasuryTransaction => ({
  id: row['id'] as string,
  tenantId: row['tenant_id'] as string,
  accountId: row['account_id'] as string,
  transactionType: row['transaction_type'] as 'income' | 'expense' | 'sale' | 'courier_settlement' | 'partner_withdrawal' | 'profit_distribution_record',
  amount: Number((row['amount'] as number) || 0),
  description: typeof row['description'] === 'string' ? row['description'] : '',
  transactionDate: row['transaction_date'] as string,
  createdAt: row['created_at'] as string,
  createdBy: typeof row['created_by'] === 'string' ? row['created_by'] : undefined,
});

export const mapTransactionToSupabaseRow = (t: Partial<TreasuryTransaction> & { tenantId?: string }) => ({
  account_id: t.accountId,
  transaction_type: t.transactionType,
  amount: t.amount,
  description: t.description,
  transaction_date: t.transactionDate,
  created_by: t.createdBy,
  ...(t.id ? { id: t.id } : {}),
  ...(t.tenantId ? { tenant_id: t.tenantId } : {}),
});

export const mapSupabaseRowToCustomer = (row: Record<string, unknown>): Customer => ({
  id: row['id'] as string,
  tenantId: row['tenant_id'] as string,
  name: row['name'] as string,
  phone: row['phone'] as string,
  phoneAlt: typeof row['phone_alt'] === 'string' ? row['phone_alt'] : undefined,
  city: row['city'] as string,
  region: typeof row['region'] === 'string' ? row['region'] : undefined,
  address: typeof row['address'] === 'string' ? row['address'] : undefined,
  totalOrders: Number(row['total_orders'] || 0),
  successOrders: Number(row['success_orders'] || 0),
  totalSpent: Number(row['total_spent'] || 0),
  createdAt: row['created_at'] as string,
});

export const mapSupabaseRowToDebt = (row: Record<string, unknown>): Debt => ({
  id: row['id'] as string,
  tenantId: row['tenant_id'] as string,
  amount: Number((row['amount'] as number) || 0),
  paidAmount: Number((row['paid_amount'] as number) || 0),
  dueDate: row['due_date'] as string,
  status: row['status'] as 'active' | 'partial' | 'paid' | 'pending',
  debtType: row['debt_type'] as 'internal' | 'external',
  debtCategory: row['debt_category'] as 'custody' | 'partner_advance' | 'employee_advance' | 'supplier' | 'customer',
  linkedEntityId: typeof row['linked_entity_id'] === 'string' ? row['linked_entity_id'] : undefined,
  linkedEntityName: typeof row['linked_entity_name'] === 'string' ? row['linked_entity_name'] : '',
  notes: typeof row['notes'] === 'string' ? row['notes'] : '',
  paymentHistory: (row['payment_history'] as { id: string; amount: number; date: string; createdAt: string }[]) || [],
  createdAt: row['created_at'] as string,
});

export interface CoreSlice {
  couriers: CourierCompany[];
  debts: Debt[];
  treasury: TreasuryAccount[];
  transactions: TreasuryTransaction[];
  users: TenantUser[];
  notifications: Notification[];
  customers: Customer[];
  tenants: Tenant[];
  subscriptions: Subscription[];
  announcements: SystemAnnouncement[];
  auditLogs: AuditLog[];
  customCategories: Record<string, string[]>;
  customUnits: Record<string, string[]>;

  // Getter
  getForTenant: <T extends { tenantId: string }>(data: T[], tenantId: string) => T[];

  // Categories & Units
  addCustomCategory: (category: string, tenantId: string) => void;
  addCustomUnit: (unit: string, tenantId: string) => void;

  // Core Fetches
  fetchTreasury: (tenantId: string) => Promise<void>;
  fetchCouriers: (tenantId: string) => Promise<void>;
  fetchCustomers: (tenantId: string) => Promise<void>;
  fetchDebts: (tenantId: string) => Promise<void>;

  // Couriers
  addCourier: (c: CourierCompany) => Promise<void>;
  updateCourier: (id: string, data: Partial<CourierCompany>) => Promise<void>;
  toggleCourier: (id: string) => Promise<void>;
  deleteCourier: (id: string) => Promise<{ success: boolean; error?: string }>;

  // Debts
  addDebt: (d: Debt) => Promise<{ success: boolean; error?: string }>;
  updateDebt: (id: string, data: Partial<Debt>) => Promise<void>;
  payDebt: (id: string, amount: number) => Promise<void>;

  // Tenants
  toggleTenant: (id: string) => void;
  addTenant: (t: Tenant) => void;
  updateTenant: (id: string, data: Partial<Tenant>) => void;

  // Treasury
  addTransaction: (t: TreasuryTransaction) => Promise<{ success: boolean; error?: string }>;
  addTreasuryAccount: (a: TreasuryAccount) => Promise<void>;

  // Users
  addUser: (u: TenantUser) => void;
  updateUser: (id: string, data: Partial<TenantUser>) => void;
  getUserByEmail: (email: string) => TenantUser | undefined;

  // Notifications
  addNotification: (n: Notification) => void;
  markNotificationRead: (id: string) => void;
  markAllRead: (tenantId: string) => void;
  clearNotifications: (tenantId: string) => void;
  getUnreadCount: (tenantId: string) => number;

  // Super Admin
  addAnnouncement: (a: SystemAnnouncement) => void;
  removeAnnouncement: (id: string) => void;
  addAuditLog: (log: AuditLog) => void;
  updateSubscriptionStatus: (id: string, status: Subscription['status']) => void;
}

import type { DataState } from '../store';
export const createCoreSlice: StateCreator<DataState, [], [], CoreSlice> = (set, get) => ({
  couriers: [],
  debts: [],
  treasury: [],
  transactions: [],
  users: [],
  notifications: [],
  customers: [],
  tenants: [],
  subscriptions: [],
  announcements: [],
  auditLogs: [],
  customCategories: {},
  customUnits: {},

  fetchTreasury: async (tenantId: string) => {
    try {
      const supabase = createClient();
      const [accRes, txRes] = await Promise.all([
        supabase.from('treasury_accounts').select('*').eq('tenant_id', tenantId).limit(50),
        supabase.from('treasury_transactions').select('*').eq('tenant_id', tenantId).order('created_at', { ascending: false }).limit(200)
      ]);
      if (accRes.error) throw accRes.error;
      if (txRes.error) throw txRes.error;

      let accounts = accRes.data || [];
      if (accounts.length === 0) {
        // Auto-create default 'cash_in_hand' account
        const defaultAccount = {
          tenant_id: tenantId,
          account_name: 'الخزينة الرئيسية',
          account_type: 'cash_in_hand',
          balance: 0,
        };
        const insertRes = await supabase.from('treasury_accounts').insert(defaultAccount).select('*').single();
        if (!insertRes.error && insertRes.data) {
          accounts = [insertRes.data];
        }
      }

      set({ 
        treasury: (accounts as Record<string, unknown>[]).map(mapSupabaseRowToTreasuryAccount),
        transactions: ((txRes.data as unknown as Record<string, unknown>[]) || []).map(mapSupabaseRowToTransaction)
      });
    } catch (e) { console.error('Error fetching treasury:', e); }
  },

  fetchCouriers: async (tenantId: string) => {
    try {
      const supabase = createClient();
      const { data, error } = await supabase.from('couriers').select('*').eq('tenant_id', tenantId).limit(100);
      if (error) throw error;
      set({ couriers: (data as unknown as Record<string, unknown>[] || []).map(mapSupabaseRowToCourier) });
    } catch (e) { console.error('Error fetching couriers:', e); }
  },

  fetchCustomers: async (tenantId: string) => {
    try {
      const supabase = createClient();
      const { data, error } = await supabase.from('customers').select('*').eq('tenant_id', tenantId).limit(200);
      if (error) throw error;
      set({ customers: (data as unknown as Record<string, unknown>[] || []).map(mapSupabaseRowToCustomer) });
    } catch (e) { console.error('Error fetching customers:', e); }
  },

  fetchDebts: async (tenantId: string) => {
    try {
      const supabase = createClient();
      const { data, error } = await supabase.from('debts').select('*').eq('tenant_id', tenantId).limit(200);
      if (error) throw error;
      set({ debts: (data as unknown as Record<string, unknown>[] || []).map(mapSupabaseRowToDebt) });
    } catch (e) { console.error('Error fetching debts:', e); }
  },

  getForTenant: <T extends { tenantId: string }>(data: T[], tenantId: string) =>
    data.filter((item) => item.tenantId === tenantId),

  addCustomCategory: (category, tenantId) =>
    set((s) => {
      const existing = (s.customCategories[tenantId] || []);
      if (existing.includes(category)) return s;
      return { customCategories: { ...s.customCategories, [tenantId]: [...existing, category] } };
    }),

  addCustomUnit: (unit, tenantId) =>
    set((s) => {
      const existing = (s.customUnits[tenantId] || []);
      if (existing.includes(unit)) return s;
      return { customUnits: { ...s.customUnits, [tenantId]: [...existing, unit] } };
    }),

  // ══ Couriers ══
  addCourier: async (c) => {
    try {
      const res = await fetch('/api/couriers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(c)
      });
      const result = await res.json();
      if (!result.success) throw new Error(result.error);
      
      set((s) => ({ 
        couriers: [mapSupabaseRowToCourier(result.data as Record<string, unknown>), ...s.couriers] 
      }));
    } catch (e: unknown) { console.error('Error adding courier:', (e as Error).message); }
  },
  
  updateCourier: async (id, data) => {
    try {
      const res = await fetch('/api/couriers', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...data })
      });
      const result = await res.json();
      if (!result.success) throw new Error(result.error);

      set((s) => ({
        couriers: s.couriers.map((c: CourierCompany) => (c.id === id ? { ...c, ...data } : c)),
      }));
    } catch (e: unknown) { console.error('Error updating courier:', (e as Error).message); }
  },

  toggleCourier: async (id) => {
    const c = get().couriers.find((x: CourierCompany) => x.id === id);
    if (!c) return;
    try {
      const res = await fetch('/api/couriers', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, isActive: !c.isActive })
      });
      const result = await res.json();
      if (!result.success) throw new Error(result.error);

      set((s) => ({
        couriers: s.couriers.map((c: CourierCompany) => (c.id === id ? { ...c, isActive: !c.isActive } : c)),
      }));
    } catch (e: unknown) { console.error('Error toggling courier:', (e as Error).message); }
  },

  deleteCourier: async (id) => {
    const state = get();
    // Use state.orders since orders are not yet fully migrated to react-query in all places
    const hasActiveOrders = (state.orders || []).some(
      (o: { status: string; courierCompanyId?: string }) => ['with_courier', 'pending_return'].includes(o.status) && o.courierCompanyId === id
    );
    if (hasActiveOrders) return { success: false, error: 'لا يمكن حذف هذه الشركة — لديها شحنات نشطة غير مكتملة' };
    
    try {
      const res = await fetch(`/api/couriers?id=${id}`, { method: 'DELETE' });
      const result = await res.json();
      if (!result.success) throw new Error(result.error);

      set((s) => ({
        couriers: s.couriers.filter((c: CourierCompany) => c.id !== id),
        treasury: s.treasury.filter((t: TreasuryAccount) => t.linkedCourierId !== id),
      }));
      return { success: true };
    } catch (e: unknown) {
      console.error('Error deleting courier:', (e as Error).message);
      return { success: false };
    }
  },

  // ══ Debts ══
  addDebt: async (d) => {
    try {
      const supabase = createClient();
      const row = {
        ...(d.id ? { id: d.id } : {}),
        tenant_id: d.tenantId,
        amount: d.amount,
        paid_amount: d.paidAmount || 0,
        due_date: d.dueDate,
        status: d.status,
        debt_type: d.debtType,
        debt_category: d.debtCategory,
        linked_entity_id: d.linkedEntityId,
        linked_entity_name: d.linkedEntityName,
        notes: d.notes,
        payment_history: d.paymentHistory || [],
      };
      const { data, error } = await supabase.from('debts').insert([row]).select().single();
      if (error) throw error;
      const mapped = mapSupabaseRowToDebt(data as unknown as Record<string, unknown>);
      set((s) => ({ debts: [{ ...mapped, paymentHistory: d.paymentHistory || [] }, ...s.debts.filter(x => x.id !== (data as { id: string }).id)] }));
      return { success: true };
    } catch (e: unknown) {
      const msg = (e as Error).message || 'Unknown error';
      console.error('Error adding debt:', msg);
      return { success: false, error: msg };
    }
  },

  updateDebt: async (id, data) => {
    try {
      const supabase = createClient();
      const row = {
        amount: data.amount,
        paid_amount: data.paidAmount,
        due_date: data.dueDate,
        status: data.status,
        notes: data.notes,
        payment_history: data.paymentHistory,
      };
      // remove undefined
      Object.keys(row).forEach(key => (row as Record<string, unknown>)[key] === undefined && delete (row as Record<string, unknown>)[key]);
      
      const { error } = await supabase.from('debts').update(row).eq('id', id);
      if (error) throw error;
      set((s) => ({
        debts: s.debts.map((d: Debt) => (d.id === id ? { ...d, ...data } : d)),
      }));
    } catch (e: unknown) { console.error('Error updating debt:', (e as Error).message); }
  },
  payDebt: async (id, amount) => {
    const state = get();
    const debt = state.debts.find((d: Debt) => d.id === id);
    if (!debt) return;

    // Delegate to API route for atomic session
    try {
      const { useAuthStore } = await import('../../auth/store');
      const user = useAuthStore.getState().user;
      
      const cashAccount = state.treasury.find(
        (a: TreasuryAccount) => a.tenantId === debt.tenantId && a.accountType === 'cash_in_hand'
      );
      
      const res = await fetch('/api/debts/pay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          debtId: id,
          amount,
          tenantId: debt.tenantId,
          accountId: cashAccount?.id,
          description: `سداد دين — ${debt.linkedEntityName || 'بدون اسم'}`,
          createdBy: user?.id || null,
        })
      });
      const result = await res.json();
      if (!result.success) throw new Error(result.error);

      // Optimistic local update (though page should invalidate React Query)
      const newPaid = Math.min(debt.paidAmount + amount, debt.amount);
      const newStatus = newPaid >= debt.amount ? 'paid' : 'partial';
      const newHistory = [...debt.paymentHistory, { id: crypto.randomUUID(), amount, date: new Date().toISOString().split('T')[0], createdAt: new Date().toISOString() }];

      set((s) => ({
        debts: s.debts.map((d: Debt) => (d.id === id ? { ...d, paidAmount: newPaid, status: newStatus, paymentHistory: newHistory } : d)),
      }));
    } catch (e: unknown) { console.error('Error paying debt:', (e as Error).message); }
  },

  // ══ Tenants ══
  toggleTenant: (id) =>
    set((s) => ({
      tenants: s.tenants.map((t: Tenant) => (t.id === id ? { ...t, isActive: !t.isActive } : t)),
      users: s.users.map((u: TenantUser) => {
        if (u.tenantId !== id) return u;
        const tenant = s.tenants.find((t: Tenant) => t.id === id);
        return { ...u, isActive: tenant ? !tenant.isActive : false };
      }),
    })),

  addTenant: (t) =>
    set((s) => ({
      tenants: [t, ...s.tenants],
      subscriptions: [
        {
          id: crypto.randomUUID(),
          tenantId: t.id,
          plan: t.plan,
          amount: 0,
          periodFrom: t.createdAt,
          periodTo: t.planExpiresAt,
          status: 'pending' as const,
          paidAt: undefined,
        },
        ...s.subscriptions,
      ],
      treasury: [
        {
          id: crypto.randomUUID(),
          tenantId: t.id,
          accountType: 'cash_in_hand' as const,
          accountName: 'النقد الفعلي',
          balance: 0,
          linkedCourierId: undefined,
        },
        {
          id: crypto.randomUUID(),
          tenantId: t.id,
          accountType: 'bank' as const,
          accountName: 'الخزينة المصرفية',
          balance: 0,
          linkedCourierId: undefined,
        },
        ...s.treasury,
      ],
    })),

  updateTenant: (id, data) =>
    set((s) => ({
      tenants: s.tenants.map((t: Tenant) => (t.id === id ? { ...t, ...data } : t)),
    })),

  // ══ Treasury ══
  addTransaction: async (t) => {
    try {
      const { useAuthStore } = await import('../../auth/store');
      const user = useAuthStore.getState().user;

      const res = await fetch('/api/treasury/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId: t.tenantId,
          accountId: t.accountId,
          transactionType: t.transactionType,
          amount: t.amount,
          description: t.description,
          createdBy: user?.id || null,
          transactionDate: t.transactionDate,
        })
      });
      const result = await res.json();
      if (!result.success) throw new Error(result.error);

      set((s) => ({
        transactions: [t, ...s.transactions],
        treasury: s.treasury.map((a: TreasuryAccount) =>
          a.id === t.accountId ? { ...a, balance: a.balance + t.amount } : a
        ),
      }));
      return { success: true };
    } catch (e: unknown) {
      const msg = (e as Error).message;
      console.error('Error adding transaction:', msg);
      return { success: false, error: msg };
    }
  },
  addTreasuryAccount: async (a) => {
    try {
      const supabase = createClient();
      const { data, error } = await supabase.from('treasury_accounts').insert([mapTreasuryAccountToSupabaseRow(a)]).select().single();
      if (error) throw error;
      set((s) => ({ treasury: [mapSupabaseRowToTreasuryAccount(data as unknown as Record<string, unknown>), ...s.treasury] }));
    } catch (e: unknown) { console.error('Error adding treasury account:', (e as Error).message); }
  },

  // ══ Users ══
  addUser: (u) => set((s) => ({ users: [u, ...s.users] })),
  updateUser: (id, data) =>
    set((s) => ({
      users: s.users.map((u: TenantUser) => (u.id === id ? { ...u, ...data } : u)),
    })),
  getUserByEmail: (email) => get().users.find((u: TenantUser) => u.email === email),

  // ══ Notifications ══
  addNotification: (n) => set((s) => ({ notifications: [n, ...s.notifications] })),
  markNotificationRead: (id) =>
    set((s) => ({
      notifications: s.notifications.map((n: Notification) =>
        n.id === id ? { ...n, isRead: true } : n
      ),
    })),
  markAllRead: (tenantId) =>
    set((s) => ({
      notifications: s.notifications.map((n: Notification) =>
        n.tenantId === tenantId ? { ...n, isRead: true } : n
      ),
    })),
  clearNotifications: (tenantId) =>
    set((s) => ({
      notifications: s.notifications.filter((n: Notification) => n.tenantId !== tenantId),
    })),
  getUnreadCount: (tenantId) =>
    get().notifications.filter((n: Notification) => n.tenantId === tenantId && !n.isRead).length,

  // ══ Super Admin ══
  addAnnouncement: (a) => set((s) => ({ announcements: [a, ...s.announcements] })),
  removeAnnouncement: (id) =>
    set((s) => ({ announcements: s.announcements.filter((x: SystemAnnouncement) => x.id !== id) })),
  addAuditLog: (log) => set((s) => ({ auditLogs: [log, ...s.auditLogs] })),
  updateSubscriptionStatus: (id, status) =>
    set((s) => ({
      subscriptions: s.subscriptions.map((sub: Subscription) =>
        sub.id === id ? { ...sub, status } : sub
      ),
    })),
});
