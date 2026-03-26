// src/shared/hooks/useTenantData.ts
/**
 * 🤖 [Auto-Hybrid] Dynamic Data Hooks Factory
 * This file translates between Zustand (Global State) and React Query (Cloud Data).
 * Transition Phase: Moving core entities (Products, Orders, Treasury) to React Query.
 */

import { useMemo } from 'react';
import { useDataStore } from '@/core/db/store';
import { useAuthStore } from '@/core/auth/store';

// 📡 React Query Standard Hooks
import { useProductsQuery } from '@/core/db/hooks/useProducts';
import { useOrdersQuery } from '@/core/db/hooks/useOrders';
import { useTreasuryQuery } from '@/core/db/hooks/useTreasury';
import { useCouriersQuery } from '@/core/db/hooks/useCouriers';
import { useDebtsQuery } from '@/core/db/hooks/useDebts';
import { usePartnersQuery } from '@/core/db/hooks/usePartners';
import { useEmployeesQuery } from '@/core/db/hooks/useEmployees';
import { useCustomersQuery } from '@/core/db/hooks/useCustomers';

// 🛡️ Helper: Stable Empty Array for dependencies
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const STABLE_EMPTY_ARRAY: any[] = [];

// 📍 Tenant Context Selector
export const useTenantId = () => {
  const user = useAuthStore((s) => s.user);
  return user?.tenantId || '';
};

// 📦 --- PRODUCTS ---
export const useTenantProducts = () => {
  const tid = useTenantId();
  const { data = STABLE_EMPTY_ARRAY } = useProductsQuery(tid);
  return useMemo(() => data.filter(p => p.isActive), [data]);
};

export const useTenantAllProducts = () => {
  const tid = useTenantId();
  const { data = STABLE_EMPTY_ARRAY } = useProductsQuery(tid);
  return data;
};

// 🧾 --- ORDERS ---
export const useTenantOrders = () => {
  const tid = useTenantId();
  const { data = STABLE_EMPTY_ARRAY } = useOrdersQuery(tid);
  return data;
};

// 💰 --- TREASURY & ACCOUNTS ---
export const useTenantTreasury = () => {
  const tid = useTenantId();
  const { data } = useTreasuryQuery(tid);
  return data?.accounts || STABLE_EMPTY_ARRAY;
};

export const useCashBalance = (): number => {
  const accounts = useTenantTreasury();
  return useMemo(() => 
    accounts.filter(a => a.accountType === 'cash_in_hand').reduce((s, a) => s + a.balance, 0),
    [accounts]
  );
};

export const useCashAccount = () => {
  const accounts = useTenantTreasury();
  return useMemo(() => accounts.find(a => a.accountType === 'cash_in_hand'), [accounts]);
};

export const useCourierPendingBalance = (): number => {
  const accounts = useTenantTreasury();
  return useMemo(() => 
    accounts.filter(a => a.accountType === 'with_courier').reduce((s, a) => s + a.balance, 0),
    [accounts]
  );
};

// 📊 --- TRANSACTIONS ---
export const useTenantTransactions = () => {
  const tid = useTenantId();
  const { data } = useTreasuryQuery(tid);
  return data?.transactions || STABLE_EMPTY_ARRAY;
};

// 🤝 --- PARTNERS ---
export const useTenantPartners = () => {
  const tid = useTenantId();
  const { data = STABLE_EMPTY_ARRAY } = usePartnersQuery(tid);
  return useMemo(() => data.filter(p => p.isActive), [data]);
};

// 👥 --- EMPLOYEES ---
export const useTenantEmployees = () => {
  const tid = useTenantId();
  const { data = STABLE_EMPTY_ARRAY } = useEmployeesQuery(tid);
  return useMemo(() => data.filter(e => e.isActive), [data]);
};

// 💸 --- DEBTS ---
export const useTenantDebts = () => {
  const tid = useTenantId();
  const { data = STABLE_EMPTY_ARRAY } = useDebtsQuery(tid);
  return data;
};

// 🚚 --- COURIERS ---
export const useTenantCouriers = () => {
  const tid = useTenantId();
  const { data = STABLE_EMPTY_ARRAY } = useCouriersQuery(tid);
  return useMemo(() => data.filter(c => c.isActive), [data]);
};

// 👤 --- CUSTOMERS ---
export const useTenantCustomers = () => {
  const tid = useTenantId();
  const { data = STABLE_EMPTY_ARRAY } = useCustomersQuery(tid);
  return data;
};

// 🔔 --- NOTIFICATIONS --- (Still in Zustand as they are local-first)
export const useTenantNotifications = () => {
  const tid = useTenantId();
  const notifications = useDataStore((s) => s.notifications);
  return useMemo(() => notifications.filter(n => n.tenantId === tid), [notifications, tid]);
};

// 🏷️ --- CATEGORIES & UNITS --- (Custom types)
export const useTenantCategories = () => {
  const tid = useTenantId();
  const customCategories = useDataStore((s) => s.customCategories);
  return customCategories[tid] || STABLE_EMPTY_ARRAY;
};

export const useTenantUnits = () => {
  const tid = useTenantId();
  const customUnits = useDataStore((s) => s.customUnits);
  return customUnits[tid] || STABLE_EMPTY_ARRAY;
};

// 🔗 --- MASTER AGGREGATOR ---
/** Returns all tenant data in a single stable object */
export const useTenantData = () => {
  const products = useTenantProducts();
  const orders = useTenantOrders();
  const treasury = useTenantTreasury();
  const transactions = useTenantTransactions();
  const partners = useTenantPartners();
  const employees = useTenantEmployees();
  const debts = useTenantDebts();
  const couriers = useTenantCouriers();
  const customers = useTenantCustomers();
  const notifications = useTenantNotifications();

  return useMemo(() => ({
    products,
    orders,
    treasury,
    transactions,
    partners,
    employees,
    debts,
    couriers,
    customers,
    notifications
  }), [
    products,
    orders,
    treasury,
    transactions,
    partners,
    employees,
    debts,
    couriers,
    customers,
    notifications
  ]);
};
