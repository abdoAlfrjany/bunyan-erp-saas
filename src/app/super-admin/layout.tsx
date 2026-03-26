// src/app/super-admin/layout.tsx
// الوظيفة: Layout السوبر أدمن — sidebar داكن (#1a0830) + حماية role
// الصلاحية: SUPER_ADMIN فقط

'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/core/auth/store';
import { Shield, LogOut, LayoutDashboard, Store, CreditCard, Bell, Search, Menu, X, Settings2, Megaphone, MapPin } from 'lucide-react';
import { cn } from '@/shared/utils/cn';
import { Logo } from '@/shared/components/ui/Logo';

const NAV = [
  { label: 'نظرة عامة', href: '/super-admin', icon: LayoutDashboard },
  { label: 'إدارة المتاجر', href: '/super-admin/tenants', icon: Store },
  { label: 'الفوترة والاشتراكات', href: '/super-admin/billing', icon: CreditCard },
  { label: 'الإعلانات', href: '/super-admin/announcements', icon: Megaphone },
  { label: 'تكامل الشركات', href: '/super-admin/couriers', icon: Shield },
  { label: 'ربط المدن', href: '/super-admin/city-mappings', icon: MapPin },
  { label: 'إعدادات المظهر', href: '/super-admin/settings', icon: Settings2 },
];

export default function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated, isLoading, logout } = useAuthStore();
  const pathname = usePathname();
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  // Auth Guard: الاستماع الديناميكي لتجنب Race Conditions
  useEffect(() => {
    if (!isHydrated) return;

    if (!isLoading && !isAuthenticated) {
      document.cookie = 'erp_auth=;path=/;max-age=0';
      window.location.href = '/login';
    } else if (!isLoading && isAuthenticated && user?.role !== 'super_admin') {
      window.location.href = '/dashboard';
    }
  }, [isHydrated, isLoading, isAuthenticated, user?.role]);

  if (!isHydrated || !isAuthenticated || user?.role !== 'super_admin') {
    return (
      <div className="min-h-screen bg-[#1a0830] flex items-center justify-center">
        <Shield size={40} className="text-bunyan-400 animate-pulse" />
      </div>
    );
  }

  const SidebarContent = () => (
    <div className="flex flex-col h-full bg-[#1a0830] text-white overflow-y-auto w-full">
      <div className="h-20 flex items-center justify-center border-b border-white/5 relative z-10 px-4">
        <Logo providerName="bunyan" size="lg" onDarkBg={true} />
      </div>

      <div className="px-4 py-8 flex-1">
        <p className="text-[10px] font-bold text-white/30 mb-3 px-3">اللوحة الرئيسية</p>
        <nav className="space-y-1">
          {NAV.map((n) => {
            const active = pathname === n.href || (n.href !== '/super-admin' && pathname.startsWith(n.href));
            return (
              <Link key={n.href} href={n.href} onClick={() => setIsMobileOpen(false)}
                className={cn('flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-semibold transition-all group',
                  active ? 'bg-bunyan-500/20 text-white' : 'text-white/60 hover:text-white hover:bg-white/5')}>
                <n.icon size={18} className={active ? 'text-bunyan-400' : 'text-white/40 group-hover:text-white/70'} />
                {n.label}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="p-4 border-t border-white/5">
        <button onClick={logout} className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-white/5 hover:bg-red-500/20 rounded-xl text-sm font-bold text-white/70 hover:text-red-400 transition-all">
          <LogOut size={16} /> تسجيل الخروج
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 flex" dir="rtl">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:block w-64 fixed inset-y-0 right-0 z-50">
        <SidebarContent />
      </aside>

      {/* Mobile Drawer */}
      {isMobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setIsMobileOpen(false)} />
          <nav className="relative flex-1 w-64 max-w-xs bg-[#1a0830]">
            <button onClick={() => setIsMobileOpen(false)} className="absolute top-5 left-4 p-2 text-white/50 hover:text-white">
              <X size={20} />
            </button>
            <SidebarContent />
          </nav>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 lg:pr-64 flex flex-col min-h-screen">
        <header className="h-20 bg-white border-b border-gray-100 flex items-center justify-between px-6 sticky top-0 z-40 shadow-sm">
          <div className="flex items-center gap-4">
            <button onClick={() => setIsMobileOpen(true)} className="lg:hidden p-2 -mr-2 text-gray-500 hover:text-gray-900 rounded-lg">
              <Menu size={20} />
            </button>
            <div className="hidden sm:flex items-center relative">
              <Search className="absolute right-3 text-gray-400" size={18} />
              <input type="text" placeholder="بحث عام (Ctrl+K)..." className="w-64 pr-10 pl-4 py-2 bg-gray-50 border border-gray-100 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-bunyan-500/20 focus:bg-white transition-colors" />
            </div>
          </div>
          
          <div className="flex items-center gap-4">
             <button className="relative p-2 text-gray-400 hover:text-bunyan-600 transition-colors">
               <Bell size={20} />
               <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-red-500 ring-2 ring-white" />
             </button>
             <div className="h-8 w-px bg-gray-200 hidden sm:block" />
             <div className="flex items-center gap-3">
               <div className="w-9 h-9 rounded-full bg-bunyan-100 flex items-center justify-center text-sm font-black text-bunyan-700">
                 S
               </div>
               <div className="hidden md:block text-right">
                 <p className="text-sm font-bold text-gray-900 leading-tight">المدير العام</p>
                 <p className="text-[10px] text-gray-500">Super Admin</p>
               </div>
             </div>
          </div>
        </header>

        <main className="flex-1 p-6 md:p-8">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
