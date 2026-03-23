// src/core/auth/hooks.ts
// Stable primitive selectors — كل hook يُرجع قيمة واحدة مستقرة
// يمنع إعادة الـ render غير الضرورية التي تُسببها { user } = useAuthStore()
// ✅ القاعدة: selector يُرجع primitive أو reference ثابت = لا loop

import { useAuthStore } from './store';

/** المستخدم الحالي (object — يتغير فقط عند تسجيل الدخول/الخروج) */
export const useUser = () => useAuthStore(s => s.user);

/** هل المستخدم مسجل الدخول؟ (boolean primitive) */
export const useIsAuthenticated = () => useAuthStore(s => s.isAuthenticated);

/** tenantId للمستخدم الحالي (string primitive) */
export const useTenantId = () => useAuthStore(s => s.user?.tenantId ?? '');

/** الدور الذي يعرض المالك منه واجهته (viewingAs — stored on user object) */
export const useViewingAs = () => useAuthStore(s => s.user?.viewingAs ?? s.user?.role ?? 'owner');

/** هل هذا هو المالك الفعلي؟ */
export const useIsOwner = () => useAuthStore(s => s.user?.role === 'owner');

/** هل Super Admin يتصفح متجراً؟ */
export const useIsBrowsingAsTenant = () => useAuthStore(s => s.isBrowsingAsTenant);
