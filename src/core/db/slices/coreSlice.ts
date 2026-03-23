// src/core/db/slices/coreSlice.ts
// الوظيفة: كل العمليات الأساسية المتبقية
// شاملاً: Couriers, Debts, Tenants, Treasury, Users, Notifications, Super Admin

import type { StateCreator } from 'zustand';
import type {
  CourierCompany,
  Debt,
  DebtPayment,
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
export const mapSupabaseRowToCourier = (row: any): CourierCompany => ({
  id: row.id,
  tenantId: row.tenant_id,
  name: row.name,
  phone: row.phone,
  trackingUrl: row.tracking_url,
  isActive: row.is_active ?? true,
  isInternal: row.is_internal ?? false,
  provider: row.provider,
  createdAt: row.created_at,
  shortCode: row.short_code,
  merchantCode: row.merchant_code,
  contactPhone: row.contact_phone,
  contactPerson: row.contact_person,
  defaultDeliveryFee: Number(row.default_delivery_fee || 0),
  apiProvider: row.api_provider,
  isApiConnected: row.is_api_connected,
  apiCredentials: row.api_credentials,
  pricingZones: row.pricing_zones,
  cities: row.cities,
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

export const mapSupabaseRowToSettlement = (row: any): VanexSettlement => ({
  id: row.id,
  tenantId: row.tenant_id,
  vanexSettlementId: row.vanex_settlement_id,
  settlementNumber: row.settlement_number,
  totalAmount: Number(row.total_amount || 0),
  deliveryFees: Number(row.delivery_fees || 0),
  bankCommission: Number(row.bank_commission || 0),
  netAmount: Number(row.net_amount || 0),
  paymentMethod: row.payment_method as any,
  targetAccountType: row.target_account_type as any,
  status: row.status as any,
  appliedAt: row.applied_at,
  createdAt: row.created_at,
  packageCount: row.package_count,
  courierCompanyId: row.courier_company_id,
  isApproximate: row.is_approximate ?? false,
});

export const mapSupabaseRowToTreasuryAccount = (row: any): TreasuryAccount => ({
  id: row.id,
  tenantId: row.tenant_id,
  accountName: row.account_name,
  accountType: row.account_type as any,
  balance: Number(row.balance || 0),
  linkedCourierId: row.linked_courier_id,
});

export const mapTreasuryAccountToSupabaseRow = (a: Partial<TreasuryAccount> & { tenantId?: string }) => ({
  account_name: a.accountName,
  account_type: a.accountType,
  balance: a.balance,
  linked_courier_id: a.linkedCourierId,
  ...(a.id ? { id: a.id } : {}),
  ...(a.tenantId ? { tenant_id: a.tenantId } : {}),
});

export const mapSupabaseRowToTransaction = (row: any): TreasuryTransaction => ({
  id: row.id,
  tenantId: row.tenant_id,
  accountId: row.account_id,
  transactionType: row.transaction_type as any,
  amount: Number(row.amount || 0),
  description: row.description,
  transactionDate: row.transaction_date,
  createdAt: row.created_at,
  createdBy: row.created_by,
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

export const mapSupabaseRowToCustomer = (row: any): Customer => ({
  id: row.id,
  tenantId: row.tenant_id,
  name: row.name,
  phone: row.phone,
  phoneAlt: row.phone_alt,
  city: row.city,
  region: row.region,
  address: row.address,
  totalOrders: Number(row.total_orders || 0),
  successOrders: Number(row.success_orders || 0),
  totalSpent: Number(row.total_spent || 0),
  createdAt: row.created_at,
});

export const mapSupabaseRowToDebt = (row: any): Debt => ({
  id: row.id,
  tenantId: row.tenant_id,
  amount: Number(row.amount || 0),
  paidAmount: Number(row.paid_amount || 0),
  dueDate: row.due_date,
  status: row.status as any,
  debtType: row.debt_type as any,
  debtCategory: row.debt_category as any,
  linkedEntityId: row.linked_entity_id,
  linkedEntityName: row.linked_entity_name,
  notes: row.notes,
  paymentHistory: row.payment_history || [],
  createdAt: row.created_at,
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
  addDebt: (d: Debt) => Promise<void>;
  updateDebt: (id: string, data: Partial<Debt>) => Promise<void>;
  payDebt: (id: string, amount: number) => Promise<void>;

  // Tenants
  toggleTenant: (id: string) => void;
  addTenant: (t: Tenant) => void;
  updateTenant: (id: string, data: Partial<Tenant>) => void;

  // Treasury
  addTransaction: (t: TreasuryTransaction) => Promise<void>;
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

export const createCoreSlice: StateCreator<any, [], [], CoreSlice> = (set, get) => ({
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
        treasury: accounts.map(mapSupabaseRowToTreasuryAccount),
        transactions: (txRes.data || []).map(mapSupabaseRowToTransaction)
      });
    } catch (e) { console.error('Error fetching treasury:', e); }
  },

  fetchCouriers: async (tenantId: string) => {
    try {
      const supabase = createClient();
      const { data, error } = await supabase.from('couriers').select('*').eq('tenant_id', tenantId).limit(100);
      if (error) throw error;
      set({ couriers: (data || []).map(mapSupabaseRowToCourier) });
    } catch (e) { console.error('Error fetching couriers:', e); }
  },

  fetchCustomers: async (tenantId: string) => {
    try {
      const supabase = createClient();
      const { data, error } = await supabase.from('customers').select('*').eq('tenant_id', tenantId).limit(200);
      if (error) throw error;
      set({ customers: (data || []).map(mapSupabaseRowToCustomer) });
    } catch (e) { console.error('Error fetching customers:', e); }
  },

  fetchDebts: async (tenantId: string) => {
    try {
      const supabase = createClient();
      const { data, error } = await supabase.from('debts').select('*').eq('tenant_id', tenantId).limit(200);
      if (error) throw error;
      set({ debts: (data || []).map(mapSupabaseRowToDebt) });
    } catch (e) { console.error('Error fetching debts:', e); }
  },

  getForTenant: <T extends { tenantId: string }>(data: T[], tenantId: string) =>
    data.filter((item) => item.tenantId === tenantId),

  addCustomCategory: (category, tenantId) =>
    set((s: any) => {
      const existing = s.customCategories[tenantId] || [];
      if (existing.includes(category)) return s;
      return { customCategories: { ...s.customCategories, [tenantId]: [...existing, category] } };
    }),

  addCustomUnit: (unit, tenantId) =>
    set((s: any) => {
      const existing = s.customUnits[tenantId] || [];
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
      
      set((s: any) => ({ 
        couriers: [mapSupabaseRowToCourier(result.data), ...s.couriers] 
      }));
    } catch (e: any) { console.error('Error adding courier:', e.message); }
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

      set((s: any) => ({
        couriers: s.couriers.map((c: CourierCompany) => (c.id === id ? { ...c, ...data } : c)),
      }));
    } catch (e: any) { console.error('Error updating courier:', e.message); }
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

      set((s: any) => ({
        couriers: s.couriers.map((c: CourierCompany) => (c.id === id ? { ...c, isActive: !c.isActive } : c)),
      }));
    } catch (e: any) { console.error('Error toggling courier:', e.message); }
  },

  deleteCourier: async (id) => {
    const state = get();
    // Use state.orders since orders are not yet fully migrated to react-query in all places
    const hasActiveOrders = (state.orders || []).some(
      (o: any) => ['with_courier', 'pending_return'].includes(o.status) && o.courierCompanyId === id
    );
    if (hasActiveOrders) return { success: false, error: 'لا يمكن حذف هذه الشركة — لديها شحنات نشطة غير مكتملة' };
    
    try {
      const res = await fetch(`/api/couriers?id=${id}`, { method: 'DELETE' });
      const result = await res.json();
      if (!result.success) throw new Error(result.error);

      set((s: any) => ({
        couriers: s.couriers.filter((c: CourierCompany) => c.id !== id),
        treasury: s.treasury.filter((t: TreasuryAccount) => t.linkedCourierId !== id),
      }));
      return { success: true };
    } catch (e: any) {
      console.error('Error deleting courier:', e.message);
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
      set((s: any) => ({ debts: [{ ...mapSupabaseRowToDebt(data), paymentHistory: d.paymentHistory || [] }, ...s.debts] }));
    } catch (e: any) { console.error('Error adding debt:', e.message); }
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
      Object.keys(row).forEach(key => (row as any)[key] === undefined && delete (row as any)[key]);
      
      const { error } = await supabase.from('debts').update(row).eq('id', id);
      if (error) throw error;
      set((s: any) => ({
        debts: s.debts.map((d: Debt) => (d.id === id ? { ...d, ...data } : d)),
      }));
    } catch (e: any) { console.error('Error updating debt:', e.message); }
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

      set((s: any) => ({
        debts: s.debts.map((d: Debt) => (d.id === id ? { ...d, paidAmount: newPaid, status: newStatus, paymentHistory: newHistory } : d)),
      }));
    } catch (e: any) { console.error('Error paying debt:', e.message); }
  },

  // ══ Tenants ══
  toggleTenant: (id) =>
    set((s: any) => ({
      tenants: s.tenants.map((t: Tenant) => (t.id === id ? { ...t, isActive: !t.isActive } : t)),
      users: s.users.map((u: TenantUser) => {
        if (u.tenantId !== id) return u;
        const tenant = s.tenants.find((t: Tenant) => t.id === id);
        return { ...u, isActive: tenant ? !tenant.isActive : false };
      }),
    })),

  addTenant: (t) =>
    set((s: any) => ({
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
    set((s: any) => ({
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

      set((s: any) => ({
        transactions: [t, ...s.transactions],
        treasury: s.treasury.map((a: TreasuryAccount) =>
          a.id === t.accountId ? { ...a, balance: a.balance + t.amount } : a
        ),
      }));
    } catch (e: any) { console.error('Error adding transaction:', e.message); }
  },
  addTreasuryAccount: async (a) => {
    try {
      const supabase = createClient();
      const { data, error } = await supabase.from('treasury_accounts').insert([mapTreasuryAccountToSupabaseRow(a)]).select().single();
      if (error) throw error;
      set((s: any) => ({ treasury: [mapSupabaseRowToTreasuryAccount(data), ...s.treasury] }));
    } catch (e: any) { console.error('Error adding treasury account:', e.message); }
  },

  // ══ Users ══
  addUser: (u) => set((s: any) => ({ users: [u, ...s.users] })),
  updateUser: (id, data) =>
    set((s: any) => ({
      users: s.users.map((u: TenantUser) => (u.id === id ? { ...u, ...data } : u)),
    })),
  getUserByEmail: (email) => get().users.find((u: TenantUser) => u.email === email),

  // ══ Notifications ══
  addNotification: (n) => set((s: any) => ({ notifications: [n, ...s.notifications] })),
  markNotificationRead: (id) =>
    set((s: any) => ({
      notifications: s.notifications.map((n: Notification) =>
        n.id === id ? { ...n, isRead: true } : n
      ),
    })),
  markAllRead: (tenantId) =>
    set((s: any) => ({
      notifications: s.notifications.map((n: Notification) =>
        n.tenantId === tenantId ? { ...n, isRead: true } : n
      ),
    })),
  clearNotifications: (tenantId) =>
    set((s: any) => ({
      notifications: s.notifications.filter((n: Notification) => n.tenantId !== tenantId),
    })),
  getUnreadCount: (tenantId) =>
    get().notifications.filter((n: Notification) => n.tenantId === tenantId && !n.isRead).length,

  // ══ Super Admin ══
  addAnnouncement: (a) => set((s: any) => ({ announcements: [a, ...s.announcements] })),
  removeAnnouncement: (id) =>
    set((s: any) => ({ announcements: s.announcements.filter((x: SystemAnnouncement) => x.id !== id) })),
  addAuditLog: (log) => set((s: any) => ({ auditLogs: [log, ...s.auditLogs] })),
  updateSubscriptionStatus: (id, status) =>
    set((s: any) => ({
      subscriptions: s.subscriptions.map((sub: Subscription) =>
        sub.id === id ? { ...sub, status } : sub
      ),
    })),
});
