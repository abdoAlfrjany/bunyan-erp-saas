// src/shared/hooks/useTenantData.ts
// الوظيفة: hook موحد لجلب بيانات المتجر الحالي بـ Zustand selectors محسّنة
// بدلاً من: const { products, orders } = useDataStore() ← يُعيد render عند أي تغيير
// استخدم: const { products, orders } = useTenantData() ← يُعيد render فقط عند تغيير بيانات المتجر

'use client';

import { useCallback } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useAuthStore } from '@/core/auth/store';
import { useDataStore } from '@/core/db/store';

// مرجع ثابت للمصفوفات الفارغة لمنع الـ re-render اللانهائي
const STABLE_EMPTY_ARRAY: any[] = [];

/**
 * جلب tenantId من Auth Store
 */
export const useTenantId = (): string => {
  return useAuthStore(useCallback(s => s.user?.tenantId ?? '', []));
};

/**
 * جلب المنتجات النشطة للمتجر الحالي
 */
export const useTenantProducts = () => {
  const tid = useTenantId();
  return useDataStore(
    useShallow(s => s.products.filter(p => p.tenantId === tid && p.isActive))
  );
};

/**
 * جلب كل المنتجات (بما في ذلك المحذوفة) للمتجر الحالي
 */
export const useTenantAllProducts = () => {
  const tid = useTenantId();
  return useDataStore(
    useShallow(s => s.products.filter(p => p.tenantId === tid))
  );
};

/**
 * جلب الطلبيات للمتجر الحالي
 */
export const useTenantOrders = () => {
  const tid = useTenantId();
  return useDataStore(
    useShallow(s => s.orders.filter(o => o.tenantId === tid))
  );
};

/**
 * جلب حسابات الخزينة للمتجر الحالي
 */
export const useTenantTreasury = () => {
  const tid = useTenantId();
  return useDataStore(
    useShallow(s => s.treasury.filter(a => a.tenantId === tid))
  );
};

/**
 * جلب رصيد الخزينة النقدية (cash_in_hand)
 */
export const useCashBalance = (): number => {
  const tid = useTenantId();
  return useDataStore(
    useCallback(
      s => s.treasury.find(a => a.tenantId === tid && a.accountType === 'cash_in_hand')?.balance ?? 0,
      [tid]
    )
  );
};

/**
 * جلب حساب الخزينة النقدية
 */
export const useCashAccount = () => {
  const tid = useTenantId();
  return useDataStore(
    useCallback(
      s => s.treasury.find(a => a.tenantId === tid && a.accountType === 'cash_in_hand'),
      [tid]
    )
  );
};

/**
 * جلب رصيد أموال قيد التحصيل (with_courier)
 */
export const useCourierPendingBalance = (): number => {
  const tid = useTenantId();
  return useDataStore(
    useCallback(
      s => s.treasury.reduce(
        (sum, a) => a.tenantId === tid && a.accountType === 'with_courier'
          ? sum + a.balance
          : sum,
        0
      ),
      [tid]
    )
  );
};

/**
 * جلب الحركات المالية للمتجر الحالي
 */
export const useTenantTransactions = () => {
  const tid = useTenantId();
  return useDataStore(
    useShallow(s => s.transactions.filter(t => t.tenantId === tid))
  );
};

/**
 * جلب الشركاء للمتجر الحالي
 */
export const useTenantPartners = () => {
  const tid = useTenantId();
  return useDataStore(
    useShallow(s => s.partners.filter(p => p.tenantId === tid))
  );
};

/**
 * جلب الموظفين للمتجر الحالي
 */
export const useTenantEmployees = () => {
  const tid = useTenantId();
  return useDataStore(
    useShallow(s => s.employees.filter(e => e.tenantId === tid))
  );
};

/**
 * جلب الديون النشطة للمتجر الحالي
 */
export const useTenantDebts = () => {
  const tid = useTenantId();
  return useDataStore(
    useShallow(s => s.debts.filter(d => d.tenantId === tid))
  );
};

/**
 * جلب شركات التوصيل للمتجر الحالي
 */
export const useTenantCouriers = () => {
  const tid = useTenantId();
  return useDataStore(
    useShallow(s => s.couriers.filter(c => c.tenantId === tid))
  );
};

/**
 * جلب الزبائن للمتجر الحالي
 */
export const useTenantCustomers = () => {
  const tid = useTenantId();
  return useDataStore(
    useShallow(s => s.customers.filter(c => c.tenantId === tid))
  );
};

/**
 * جلب الإشعارات للمتجر الحالي
 */
export const useTenantNotifications = () => {
  const tid = useTenantId();
  return useDataStore(
    useShallow(s => s.notifications.filter(n => n.tenantId === tid))
  );
};

/**
 * جلب الفئات المخصصة للمتجر الحالي
 */
export const useTenantCategories = () => {
  const tid = useTenantId();
  return useDataStore(
    useCallback(s => s.customCategories[tid] || STABLE_EMPTY_ARRAY, [tid])
  );
};

/**
 * جلب وحدات القياس المخصصة للمتجر الحالي
 */
export const useTenantUnits = () => {
  const tid = useTenantId();
  return useDataStore(
    useCallback(s => s.customUnits[tid] || STABLE_EMPTY_ARRAY, [tid])
  );
};

/**
 * Hook شامل — يُستخدم في الصفحات التي تحتاج بيانات متعددة
 * ⚠️ استخدمه فقط إذا تحتاج أغلب البيانات — وإلا استخدم الـ hooks المنفردة
 */
export const useTenantData = () => {
  const tid = useTenantId();
  const products = useTenantProducts();
  const orders = useTenantOrders();
  const treasury = useTenantTreasury();
  const partners = useTenantPartners();
  const employees = useTenantEmployees();
  const debts = useTenantDebts();
  const couriers = useTenantCouriers();
  const customers = useTenantCustomers();
  const cashBalance = useCashBalance();

  return {
    tenantId: tid,
    products,
    orders,
    treasury,
    partners,
    employees,
    debts,
    couriers,
    customers,
    cashBalance,
  };
};
