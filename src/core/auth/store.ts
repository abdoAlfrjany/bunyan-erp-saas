// src/core/auth/store.ts
// الوظيفة: حالة المصادقة المركزية — Bunyan ERP
// المرجع: 1_SYSTEM_RULES.md — RBAC 4 مستويات + Super Admin tenant browsing

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { UserRole } from '@/core/auth';
import type { UserPermissions } from '@/core/db/seed';

function setAuthCookie(user: { role: string; tenantId: string } | null) {
  if (typeof document === 'undefined') return;
  if (user) {
    const val = encodeURIComponent(JSON.stringify({ role: user.role, tenantId: user.tenantId }));
    document.cookie = `erp_auth=${val};path=/;max-age=${60 * 60 * 24 * 30};SameSite=Lax`;
  } else {
    document.cookie = 'erp_auth=;path=/;max-age=0';
  }
}

export interface AuthUser {
  id: string;
  tenantId: string;
  fullName: string;
  phone: string | null;
  role: UserRole;
  isActive: boolean;
  email: string;
  tenantName?: string;
  permissions?: UserPermissions;
  // Role switching — المالك يرى من منظور دور آخر
  viewingAs?: 'owner' | 'employee' | 'partner';
}

interface AuthState {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;

  // Super Admin browsing a tenant
  isBrowsingAsTenant: boolean;
  originalUser: AuthUser | null;
  browsingTenantName: string;

  setUser: (user: AuthUser | null) => void;
  setLoading: (loading: boolean) => void;
  logout: () => void;

  enterTenantAsAdmin: (tenantId: string, tenantName: string) => void;
  exitTenantBrowsing: () => void;

  // Role switching داخل نفس المتجر
  setViewingAs: (role: 'owner' | 'employee' | 'partner' | undefined) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
  user: null,
  isLoading: true,
  isAuthenticated: false,
  isBrowsingAsTenant: false,
  originalUser: null,
  browsingTenantName: '',

  setUser: (user) => {
    setAuthCookie(user);
    set({ user, isAuthenticated: user !== null, isLoading: false });
  },

  setLoading: (isLoading) => set({ isLoading }),

  logout: () => {
    if (typeof window !== 'undefined') {
      // مسح كل localStorage
      localStorage.removeItem('erp_user');
      localStorage.removeItem('erp_browsing');
    }
    setAuthCookie(null);
    set({
      user: null, isAuthenticated: false, isLoading: false,
      isBrowsingAsTenant: false, originalUser: null, browsingTenantName: '',
    });
    if (typeof window !== 'undefined') {
      window.location.href = '/login';
    }
  },

  enterTenantAsAdmin: (tenantId, tenantName) => {
    const state = get();
    if (!state.user || state.user.role !== 'super_admin') return;

    const browsing = { originalUser: state.user, tenantId, tenantName };
    if (typeof window !== 'undefined') {
      localStorage.setItem('erp_browsing', JSON.stringify(browsing));
    }

    const tenantUser: AuthUser = {
      ...state.user,
      tenantId,
      tenantName,
      role: 'owner',
      fullName: `سوبر أدمن ← ${tenantName}`,
    };

    if (typeof window !== 'undefined') {
      localStorage.setItem('erp_user', JSON.stringify(tenantUser));
    }

    set({
      user: tenantUser, originalUser: state.user,
      isBrowsingAsTenant: true, browsingTenantName: tenantName,
    });
  },

  exitTenantBrowsing: () => {
    const state = get();
    if (!state.originalUser) return;

    if (typeof window !== 'undefined') {
      localStorage.setItem('erp_user', JSON.stringify(state.originalUser));
      localStorage.removeItem('erp_browsing');
    }

    set({
      user: state.originalUser, originalUser: null,
      isBrowsingAsTenant: false, browsingTenantName: '',
    });

    if (typeof window !== 'undefined') {
      window.location.href = '/super-admin';
    }
  },

  setViewingAs: (role) => {
    const state = get();
    if (!state.user) return;
    set({ user: { ...state.user, viewingAs: role } });
  },
    }),
    {
      name: 'bunyan-auth-v1',
      storage: createJSONStorage(() => localStorage),
    }
  )
);
