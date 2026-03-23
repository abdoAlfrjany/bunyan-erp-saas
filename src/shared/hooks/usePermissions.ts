// src/shared/hooks/usePermissions.ts
// الوظيفة: hook صلاحيات موحد — يحسب الدور الفعّال بناءً على viewingAs
// يُستخدم في كل الصفحات بدلاً من if (user?.role === 'owner') مباشرة

'use client';

import { useCallback } from 'react';
import { useAuthStore } from '@/core/auth/store';

export interface PermissionFlags {
  /** الدور الفعّال (يأخذ viewingAs في الاعتبار) */
  effectiveRole: 'owner' | 'partner' | 'employee';
  /** هل المستخدم مالك (أو يشاهد كمالك) */
  isOwner: boolean;
  /** هل المستخدم شريك (أو يشاهد كشريك) */
  isPartner: boolean;
  /** هل المستخدم موظف (أو يشاهد كموظف) */
  isEmployee: boolean;
  /** هل يتصفح كـ Super Admin */
  isSuperAdminBrowsing: boolean;

  // ═══ صلاحيات المخزون ═══
  canViewInventory: boolean;
  canAddProduct: boolean;
  canEditProduct: boolean;
  canDeleteProduct: boolean;
  canViewCostPrice: boolean;

  // ═══ صلاحيات الطلبيات ═══
  canViewOrders: boolean;
  canAddOrder: boolean;
  canEditOrder: boolean;
  canChangeOrderStatus: boolean;
  canViewAllOrders: boolean;

  // ═══ صلاحيات التوصيل ═══
  canViewDelivery: boolean;
  canAddShipment: boolean;
  canManageCompanies: boolean;
  canViewSettlements: boolean;

  // ═══ صلاحيات الخزينة ═══
  canViewTreasury: boolean;
  canAddTransaction: boolean;

  // ═══ صلاحيات الشركاء ═══
  canViewPartners: boolean;
  canViewOwnPartnerData: boolean;

  // ═══ صلاحيات الموظفين ═══
  canViewHR: boolean;
  canViewOwnHRData: boolean;

  // ═══ صلاحيات التحليلات ═══
  canViewAnalytics: boolean;
  canViewFullAnalytics: boolean;

  // ═══ صلاحيات الإعدادات ═══
  canViewSettings: boolean;
  canEditSettings: boolean;
}

export const usePermissions = (): PermissionFlags => {
  const user = useAuthStore(useCallback(s => s.user, []));
  const isBrowsingAsTenant = useAuthStore(useCallback(s => s.isBrowsingAsTenant, []));

  // الدور الفعّال: viewingAs أو الدور الأصلي
  const effectiveRole = (user?.viewingAs || user?.role || 'employee') as 'owner' | 'partner' | 'employee';
  const isOwner = effectiveRole === 'owner';
  const isPartner = effectiveRole === 'partner';
  const isEmployee = effectiveRole === 'employee';
  const perms = user?.permissions;

  return {
    effectiveRole,
    isOwner,
    isPartner,
    isEmployee,
    isSuperAdminBrowsing: isBrowsingAsTenant,

    // المخزون
    canViewInventory: isOwner || perms?.inventory?.view || false,
    canAddProduct: isOwner || perms?.inventory?.add || false,
    canEditProduct: isOwner || perms?.inventory?.edit || false,
    canDeleteProduct: isOwner || perms?.inventory?.delete || false,
    canViewCostPrice: isOwner || perms?.inventory?.viewCostPrice || false,

    // الطلبيات
    canViewOrders: isOwner || perms?.orders?.view || false,
    canAddOrder: isOwner || perms?.orders?.add || false,
    canEditOrder: isOwner || perms?.orders?.edit || false,
    canChangeOrderStatus: isOwner || perms?.orders?.changeStatus || false,
    canViewAllOrders: isOwner || perms?.orders?.viewAll || false,

    // التوصيل
    canViewDelivery: isOwner || perms?.delivery?.view || false,
    canAddShipment: isOwner || perms?.delivery?.addShipment || false,
    canManageCompanies: isOwner || perms?.delivery?.manageCompanies || false,
    canViewSettlements: isOwner || perms?.delivery?.viewSettlements || false,

    // الخزينة
    canViewTreasury: isOwner,
    canAddTransaction: isOwner || perms?.treasury?.addTransaction || false,

    // الشركاء
    canViewPartners: isOwner,
    canViewOwnPartnerData: isPartner || perms?.partners?.viewOwn || false,

    // الموظفين
    canViewHR: isOwner,
    canViewOwnHRData: isEmployee || perms?.hr?.viewOwn || false,

    // التحليلات
    canViewAnalytics: isOwner || perms?.analytics?.view || false,
    canViewFullAnalytics: isOwner || perms?.analytics?.viewFull || false,

    // الإعدادات
    canViewSettings: isOwner || perms?.settings?.view || false,
    canEditSettings: isOwner || perms?.settings?.edit || false,
  };
};
