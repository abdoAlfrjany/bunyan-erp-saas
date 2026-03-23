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
    // إضافة Secure في الإنتاج لضمان إرسال الكوكي عبر HTTPS فقط
    const secureFlag = window.location.protocol === 'https:' ? ';Secure' : '';
    document.cookie = `erp_auth=${val};path=/;max-age=${60 * 60 * 24 * 30};SameSite=Strict${secureFlag}`;
  } else {
    document.cookie = 'erp_auth=;path=/;max-age=0;SameSite=Strict';
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
  logout: () => void | Promise<void>;
  initAuthListener: () => void;

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

  logout: async () => {
    // ══ مُستدعاة من الـ UI فقط (زر تسجيل الخروج) ══
    // لا تُستدعى من داخل onAuthStateChange لتجنب الحلقة المفرغة
    try {
      if (typeof window !== 'undefined') {
        const { createClient } = await import('@/core/db/supabase');
        const supabase = createClient();
        await supabase.auth.signOut(); // هذا سيُطلق SIGNED_OUT → onAuthStateChange → clearLocalState فقط
      }
    } catch (err) {
      console.error('Logout error:', err);
    }
    // تنظيف الحالة المحلية
    if (typeof window !== 'undefined') {
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

  initAuthListener: async () => {
    if (typeof window === 'undefined') return;
    try {
      const { createClient } = await import('@/core/db/supabase');
      const supabase = createClient();

      // ══ Helper: جلب profile من Supabase وبناء AuthUser ══
      const buildAuthUser = async (userId: string) => {
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('*, tenants(*)')
          .eq('id', userId)
          .single();

        if (error || !profile || !profile.is_active) {
          setAuthCookie(null);
          set({ user: null, isAuthenticated: false, isLoading: false });
          return;
        }

        const tenant = Array.isArray(profile.tenants) ? profile.tenants[0] : profile.tenants;
        if (tenant && !tenant.is_active) {
          setAuthCookie(null);
          set({ user: null, isAuthenticated: false, isLoading: false });
          return;
        }

        const authUser = {
          id: profile.id,
          tenantId: profile.tenant_id,
          fullName: profile.full_name,
          phone: profile.phone ?? null,
          role: profile.role as any,
          isActive: profile.is_active,
          email: profile.email,
          tenantName: tenant?.name,
          permissions: profile.permissions,
        };
        get().setUser(authUser);

        // مزامنة الدور في Supabase user_metadata لضمان قراءته من الـ JWT في middleware
        // (يسمح للمستخدمين الموجودين قبل هذا التحديث بالحصول على الدور في user_metadata)
        supabase.auth.updateUser({ data: { role: profile.role, tenant_id: profile.tenant_id } })
          .catch(() => { /* non-critical sync, ignore errors */ });
      };

      // 1. استرجع الجلسة الحالية لتجنب التعليق في التحميل
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      
      if (currentSession) {
        const currentUser = get().user;
        if (!currentUser || currentUser.id !== currentSession.user.id) {
           await buildAuthUser(currentSession.user.id);
        } else {
           set({ isLoading: false });
        }
      } else {
        set({ isLoading: false });
      }

      // 2. مراقبة التغييرات اللاحقة
      supabase.auth.onAuthStateChange(async (event, session) => {
        // ══ SIGNED_OUT: تنظيف الحالة المحلية فقط (دون استدعاء signOut مجدداً) ══
        if (event === 'SIGNED_OUT') {
          if (typeof window !== 'undefined') {
            localStorage.removeItem('erp_user');
            localStorage.removeItem('erp_browsing');
          }
          setAuthCookie(null);
          set({
            user: null, isAuthenticated: false, isLoading: false,
            isBrowsingAsTenant: false, originalUser: null, browsingTenantName: '',
          });
          if (typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
            window.location.href = '/login';
          }
          return;
        }

        // ══ SIGNED_IN / TOKEN_REFRESHED: بعد login ناجح أو تجديد التوكن ══
        if ((event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') && session) {
          const currentUser = get().user;
          if (!currentUser || currentUser.id !== session.user.id) {
            await buildAuthUser(session.user.id);
          }
          return;
        }
      });
    } catch(err) {
      console.error('Failed to init auth listener:', err);
      set({ isLoading: false });
    }
  },

  enterTenantAsAdmin: (tenantId, tenantName) => {
    const state = get();
    if (!state.user || state.user.role !== 'super_admin') return;

    const browsing = { originalUser: state.user, tenantId, tenantName };
    if (typeof window !== 'undefined') {
      localStorage.setItem('erp_browsing', JSON.stringify(browsing));
    }

    // ✅ تسجيل في سجل التدقيق
    try {
      const { useDataStore } = require('../db/store');
      useDataStore.getState().addAuditLog({
        id: `audit-${Date.now()}`,
        adminId: state.user.id,
        tenantId,
        action: 'impersonate',
        timestamp: new Date().toISOString(),
      });
    } catch { /* store might not be initialized yet */ }

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
      // نستثني isLoading من الحفظ لمنع مشكلة استبداله بقيمة قديمة أثناء الـ Hydration
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
        isBrowsingAsTenant: state.isBrowsingAsTenant,
        originalUser: state.originalUser,
        browsingTenantName: state.browsingTenantName,
      }),
      onRehydrateStorage: () => (state) => {
        // بمجرد انتهاء استعادة البيانات القديمة من localStorage، نضمن أن isLoading هو false 
        // أو نقوم بتشغيل التأكد من الجلسة مرة أخرى لضمان أحدث نسخة من البيانات
        if (state) {
           setTimeout(() => {
             // force run init again if it was overwritten
             state.initAuthListener();
           }, 10);
        }
      }
    }
  )
);
