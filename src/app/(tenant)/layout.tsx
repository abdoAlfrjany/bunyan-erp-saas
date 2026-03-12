// src/app/(tenant)/layout.tsx
// الوظيفة: Layout بيئة التاجر — Sidebar + Header + محتوى + SuperAdminBanner
// المرجع: 3_UI_UX_GUIDELINES.md — هيكل الواجهة
// الصلاحية: يتحقق من auth — يحوّل لـ /login إذا غير مسجل

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/core/auth/store';
import { useDataStore } from '@/core/db/store';
import { Sidebar } from '@/shared/components/layout/Sidebar';
import { Header } from '@/shared/components/layout/Header';
import { SuperAdminBanner } from '@/shared/components/layout/SuperAdminBanner';
import { Loader2 } from 'lucide-react';

export default function TenantLayout({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated, setUser, logout, isBrowsingAsTenant } = useAuthStore();
  const { tenants } = useDataStore();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  // Hydrate: تحميل المستخدم والتأكد من توافق Zustand مع الكوكيز
  useEffect(() => {
    setHydrated(true);
    
    // تحميل حالة الشريط الجانبي من localStorage
    const savedSidebarOpen = localStorage.getItem('sidebar-open');
    if (savedSidebarOpen !== null) {
      setSidebarOpen(savedSidebarOpen === 'true');
    }

    const checkAuth = setTimeout(() => {
      if (!useAuthStore.getState().isAuthenticated) {
        // مسح الكوكي لمنع Infinite Redirect Loop مع الـ Middleware
        document.cookie = 'erp_auth=;path=/;max-age=0';
        router.push('/login');
      }
    }, 100);
    return () => clearTimeout(checkAuth);
  }, [router]);

  // حفظ حالة الشريط الجانبي عند التغيير
  useEffect(() => {
    if (hydrated) {
      localStorage.setItem('sidebar-open', String(sidebarOpen));
    }
  }, [sidebarOpen, hydrated]);

  // Kill-Switch check (تطرد المستخدم فوراً إذا تم إيقافه أو إيقاف المتجر)
  useEffect(() => {
    const checkStatus = () => {
      if (!isAuthenticated || !user || isBrowsingAsTenant) return;
      
      const currentTenant = useDataStore.getState().tenants.find(t => t.id === user.tenantId);
      const currentUserRecord = useDataStore.getState().users.find(u => u.id === user.id);
      
      if ((currentTenant && !currentTenant.isActive) || (currentUserRecord && !currentUserRecord.isActive)) {
        logout();
        router.push('/login');
      }
    };

    // تحقق فوري عند التحميل وتغيير الحالة
    checkStatus();

    // تحقق دوري كل 3 ثواني (Live Monitor)
    const interval = setInterval(checkStatus, 3000);
    
    // مراقبة تغييرات حالة الـ localStorage عبر التبويبات الأخرى (Cross-Tab Sync)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'bunyan-erp-v1') checkStatus();
    };
    window.addEventListener('storage', handleStorageChange);

    return () => {
      clearInterval(interval);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [isAuthenticated, user, isBrowsingAsTenant, logout, router]);

  // توليد إشعارات الديون المتأخرة عند تحميل التطبيق إذا لم تكن موجودة
  useEffect(() => {
    if (!hydrated || !isAuthenticated || !user?.tenantId) return;
    
    const { debts, notifications, addNotification } = useDataStore.getState();
    const today = new Date().toISOString().split('T')[0];
    const myOverdueDebts = debts.filter(d => 
      d.tenantId === user.tenantId && 
      d.status !== 'paid' && 
      d.dueDate && d.dueDate < today
    );

    myOverdueDebts.forEach(debt => {
      const notifId = `notif-overdue-${debt.id}-${today}`;
      const exists = notifications.some(n => n.id === notifId);
      if (!exists) {
        addNotification({
          id: notifId,
          tenantId: user.tenantId,
          type: 'error',
          title: 'دين متأخر',
          message: `حان موعد استحقاق دين/التزام بقيمة ${debt.amount - debt.paidAmount} د.ل مرتبط بـ (${debt.linkedEntityName || 'بدون اسم'})`,
          isRead: false,
          createdAt: new Date().toISOString(),
          link: '/debts'
        });
      }
    });

  }, [hydrated, isAuthenticated, user]);

  if (!hydrated || !isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#f0f2f7] flex items-center justify-center">
        <div className="text-center">
          <Loader2 size={32} className="text-[#1a2744] mx-auto mb-3 animate-spin" />
          <p className="text-sm text-[#4a5a7a]">جاري التحميل...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f0f2f7] flex flex-col">
      <SuperAdminBanner />
      <div className="flex flex-1 relative overflow-hidden">
        <Sidebar 
          isOpen={sidebarOpen} 
          isMobileOpen={mobileMenuOpen}
          onCloseMobile={() => setMobileMenuOpen(false)} 
        />
        <div className="flex-1 flex flex-col min-w-0 transition-all duration-300">
          <Header 
            sidebarOpen={sidebarOpen}
            onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
            onToggleMobileMenu={() => setMobileMenuOpen(true)}
          />
          <main className="p-6 max-w-[1400px] mx-auto w-full">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
