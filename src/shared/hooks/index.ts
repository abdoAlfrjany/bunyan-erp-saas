// src/shared/hooks/index.ts
// الوظيفة: نقطة تصدير الـ hooks المشتركة

export {
  useTenantId,
  useTenantProducts,
  useTenantAllProducts,
  useTenantOrders,
  useTenantTreasury,
  useCashBalance,
  useCashAccount,
  useCourierPendingBalance,
  useTenantTransactions,
  useTenantPartners,
  useTenantEmployees,
  useTenantDebts,
  useTenantCouriers,
  useTenantCustomers,
  useTenantNotifications,
  useTenantCategories,
  useTenantUnits,
  useTenantData,
} from './useTenantData';

export { usePermissions } from './usePermissions';
export type { PermissionFlags } from './usePermissions';
