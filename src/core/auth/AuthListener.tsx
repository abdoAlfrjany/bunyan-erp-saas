'use client';

import { useEffect, useRef } from 'react';
import { useAuthStore } from './store';
import { initializeCloudData } from '../db/initStore';

export function AuthListener() {
  const user = useAuthStore(s => s.user);
  const isAuthenticated = useAuthStore(s => s.isAuthenticated);
  const isLoading = useAuthStore(s => s.isLoading);
  const hasInitialized = useRef(false);
  const lastUserId = useRef<string | null>(null);

  useEffect(() => {
    const initAuthListener = useAuthStore.getState().initAuthListener;
    initAuthListener();
  }, []);

  useEffect(() => {
    // إعادة ضبط hasInitialized عند تغيير المستخدم (تسجيل خروج ودخول بحساب آخر)
    if (user?.id !== lastUserId.current) {
      hasInitialized.current = false;
      lastUserId.current = user?.id ?? null;
    }

    // جلب البيانات السحابية مرة واحدة فقط عند نجاح المصادقة
    if (isAuthenticated && !isLoading && user?.tenantId && !hasInitialized.current) {
      hasInitialized.current = true;
      initializeCloudData(user.tenantId);
    }
  }, [isAuthenticated, isLoading, user?.id, user?.tenantId]);

  return null;
}
