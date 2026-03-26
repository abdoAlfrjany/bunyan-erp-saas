// src/app/(tenant)/layout.tsx
// الوظيفة: Layout بيئة التاجر — Sidebar + Header + محتوى + SuperAdminBanner + Role Impersonation
// المرجع: 3_UI_UX_GUIDELINES.md — هيكل الواجهة
// الصلاحية: يتحقق من auth — يحوّل لـ /login إذا غير مسجل

'use client';

import { useEffect, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/core/auth/store';
import { useDataStore } from '@/core/db/store';
import { Sidebar } from '@/shared/components/layout/Sidebar';
import { Header } from '@/shared/components/layout/Header';
import { SuperAdminBanner } from '@/shared/components/layout/SuperAdminBanner';
import { useToast } from '@/shared/components/ui/Toast';
import { Loader2, Crown, Briefcase, PieChart, ChevronDown, Check, Eye } from 'lucide-react';

const ROLES = [
  { key: 'owner',    label: 'المالك',       icon: Crown,     color: 'text-amber-500' },
  { key: 'employee', label: 'موظف المبيعات', icon: Briefcase, color: 'text-blue-500' },
  { key: 'partner',  label: 'شريك',          icon: PieChart,  color: 'text-purple-500' },
] as const;

export default function TenantLayout({ children }: { children: React.ReactNode }) {
  // ✅ useShallow — يبقى مستقراً عند bundle من قيم primitive + action
  const { user, isAuthenticated, isLoading, logout, isBrowsingAsTenant, setViewingAs } = useAuthStore(
    useShallow(s => ({
      user:               s.user,
      isAuthenticated:    s.isAuthenticated,
      isLoading:          s.isLoading,
      logout:             s.logout,
      isBrowsingAsTenant: s.isBrowsingAsTenant,
      setViewingAs:       s.setViewingAs,
    }))
  );
  // ✅ tenants array — useShallow يقارن محتوى المصفوفة
  const { showToast } = useToast();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [roleDropdownOpen, setRoleDropdownOpen] = useState(false);

  // Hydrate: تحميل المستخدم والتأكد من توافق Zustand مع الكوكيز
  useEffect(() => {
    setHydrated(true);
  }, []);

  // Auth Guard: الاستماع الديناميكي لتغيرات حالة المصادقة لتجنب Race Conditions
  useEffect(() => {
    if (!hydrated) return;

    console.log('🛡️ Layout Auth Guard (Reactive):', { 
      isAuthenticated, 
      isLoading 
    });

    if (!isAuthenticated && !isLoading) {
      console.warn('🚫 Unauthenticated - Clearing cookies and redirecting...');
      document.cookie = 'erp_auth=;path=/;max-age=0';
      window.location.href = '/login';
    }
  }, [hydrated, isAuthenticated, isLoading]);

  // Kill-Switch check (تطرد المستخدم فوراً إذا تم إيقافه أو إيقاف المتجر)
  // ✅ الإصلاح: يستعلم من Supabase مباشرة بدلاً من الـ Zustand المحلي الفارغ
  useEffect(() => {
    if (!isAuthenticated || !user || isBrowsingAsTenant) return;

    const checkStatus = async () => {
      try {
        const { createClient } = await import('@/core/db/supabase');
        const supabase = createClient();

        const { data: profile, error } = await supabase
          .from('profiles')
          .select('is_active, tenant_id, tenants(is_active)')
          .eq('id', user.id)
          .single();

        if (error || !profile) return; // شبكة متقطعة — لا نطرد

        const tenant = Array.isArray(profile.tenants) ? profile.tenants[0] : profile.tenants;
        const isProfileActive = profile.is_active;
        const isTenantActive = tenant ? tenant.is_active : true;

        if (!isProfileActive || !isTenantActive) {
          console.warn('⚠️ Access Revoked (DB check) - Redirecting to Login');
          logout();
          router.push('/login');
        }
      } catch (err) {
        // شبكة متقطعة أو خطأ غير متوقع — لا نطرد المستخدم
        console.warn('[kill-switch] check failed (network?):', err);
      }
    };

    // تحقق فوري عند التحميل
    checkStatus();

    // تحقق دوري كل 30 ثانية (أقل تكراراً لتجنب الضغط على قاعدة البيانات)
    const interval = setInterval(checkStatus, 30_000);

    return () => clearInterval(interval);
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

  // Close role dropdown when clicking outside
  useEffect(() => {
    if (!roleDropdownOpen) return;
    const handleClick = () => setRoleDropdownOpen(false);
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, [roleDropdownOpen]);

  // إذا لم يتم الترطيب بعد أو لم نتحقق من الدخول، نعرض واجهة التحميل البسيطة
  if (!hydrated) {
    return (
      <div className="min-h-screen bg-[#f0f2f7] flex items-center justify-center">
        <div className="text-center">
          <Loader2 size={32} className="text-[#1a2744] mx-auto mb-3 animate-spin" />
          <p className="text-sm text-[#4a5a7a]">جاري تهيئة النظام...</p>
        </div>
      </div>
    );
  }

  // إذا تم الترطيب ولكن المستخدم غير مسجل، نظهر واجهة بسيطة بانتظار التحويل لصفحة الدخول
  if (!isAuthenticated || !user) {
    return (
      <div className="min-h-screen bg-[#f0f2f7] flex items-center justify-center">
        <div className="text-center">
          <p className="text-sm text-[#4a5a7a]">جاري التحقق من الهوية...</p>
        </div>
      </div>
    );
  }

  const currentViewRole = user?.viewingAs || user?.role || 'owner';
  const currentRoleInfo = ROLES.find(r => r.key === currentViewRole) || ROLES[0];
  const isOwner = user?.role === 'owner';

  return (
    <div className="min-h-screen bg-[#f0f2f7]">
      <SuperAdminBanner />
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="md:mr-[260px]">
        <Header onToggleSidebar={() => setSidebarOpen(true)} />

        {/* ═══ Role Impersonation Bar — Owner Only ═══ */}
        {isOwner && (
          <div className="px-6 pt-2">
            <div className="relative inline-block">
              <button
                onClick={e => { e.stopPropagation(); setRoleDropdownOpen(!roleDropdownOpen); }}
                className="inline-flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-medium text-gray-600 hover:border-bunyan-300 hover:shadow-sm transition-all"
              >
                <Eye size={13} className="text-gray-400" />
                <span>عرض كـ:</span>
                <currentRoleInfo.icon size={14} className={currentRoleInfo.color} />
                <span className="font-bold text-gray-800">{currentRoleInfo.label}</span>
                <ChevronDown size={13} className={`text-gray-400 transition-transform ${roleDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {roleDropdownOpen && (
                <div className="absolute top-full mt-1 right-0 bg-white border border-gray-200 rounded-xl shadow-lg py-1 z-50 min-w-[180px] animate-fade-in">
                  {ROLES.map(role => {
                    const isActive = currentViewRole === role.key;
                    const Icon = role.icon;
                    return (
                      <button
                        key={role.key}
                        onClick={() => {
                          setViewingAs(role.key === 'owner' ? undefined : role.key);
                          showToast(`تم التبديل: ${role.label}`, 'info');
                          setRoleDropdownOpen(false);
                        }}
                        className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-xs font-medium transition-colors ${
                          isActive ? 'bg-bunyan-50 text-bunyan-700' : 'text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <Icon size={14} className={role.color} />
                          <span>{role.label}</span>
                        </div>
                        {isActive && <Check size={14} className="text-bunyan-600" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        <main className="p-6 max-w-[1400px] mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}

