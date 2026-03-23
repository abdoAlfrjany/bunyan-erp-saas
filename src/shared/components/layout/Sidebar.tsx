// src/shared/components/layout/Sidebar.tsx
// الوظيفة: القائمة الجانبية — بنفسجية + لوقو (Logo Component) + badges ذكية + صلاحيات
// المرجع: _DOCS/3_UI_UX_GUIDELINES.md — هيكل الواجهة

'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/shared/utils/cn';
import { useAuthStore } from '@/core/auth/store';
import { useDataStore } from '@/core/db/store';
import { Logo } from '@/shared/components/ui/Logo';
import {
  LayoutDashboard, Package, ShoppingCart, Truck, Wallet,
  Handshake, Users, FileText, BarChart3, Settings,
  ChevronDown, LogOut, X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { UserRole } from '@/core/auth';

interface NavItem {
  label: string;
  icon: LucideIcon;
  href: string;
  roles: UserRole[];
  badgeKey?: 'pendingOrders' | 'lowStock' | 'overdueDebts';
  children?: { label: string; href: string }[];
}

const NAV_ITEMS: NavItem[] = [
  { label: 'لوحة القيادة',          icon: LayoutDashboard, href: '/dashboard',  roles: ['owner', 'partner', 'employee'] },
  { label: 'المخزون والعهدة',        icon: Package,         href: '/inventory',  roles: ['owner', 'employee'], badgeKey: 'lowStock' },
  { label: 'الطلبيات والمبيعات',    icon: ShoppingCart,    href: '/orders',     roles: ['owner', 'partner', 'employee'], badgeKey: 'pendingOrders' },
  {
    label: 'شركات التوصيل',          icon: Truck,           href: '/delivery',   roles: ['owner', 'employee'],
    children: [
      { label: 'الشركات',    href: '/delivery/companies' },
      { label: 'الشحنات',    href: '/delivery/shipments' },
      { label: 'التسويات',   href: '/delivery/settlements' },
      { label: 'التحليلات',  href: '/delivery/analytics' },
    ],
  },
  { label: 'الخزينة والمالية',       icon: Wallet,          href: '/treasury',   roles: ['owner'] },
  { label: 'الشركاء والمستثمرون',   icon: Handshake,       href: '/partners',   roles: ['owner', 'partner'] },
  { label: 'الموارد البشرية',        icon: Users,           href: '/hr',         roles: ['owner'] },
  { label: 'سجل الديون',             icon: FileText,        href: '/debts',      roles: ['owner', 'partner'], badgeKey: 'overdueDebts' },
  { label: 'التحليلات',              icon: BarChart3,       href: '/analytics',  roles: ['owner'] },
];

interface SidebarProps { isOpen: boolean; onClose: () => void; }

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();
  const { user, logout } = useAuthStore();
  const { orders, products, debts } = useDataStore();
  const [expandedItem, setExpandedItem] = useState<string | null>(null);

  const tenantId = user?.tenantId ?? '';
  const userRole = (user?.role || 'owner') as UserRole;

  // حساب الـ badges
  const badges = useMemo(() => {
    const pendingOrders = orders.filter(o => o.tenantId === tenantId && o.status === 'pending').length;
    const lowStock = products.filter(p => p.tenantId === tenantId && p.quantity <= p.minQuantity && p.quantity > 0).length;
    const overdueDebts = debts.filter(d => d.tenantId === tenantId && d.status !== 'paid' && d.dueDate < new Date().toISOString().split('T')[0]).length;
    return { pendingOrders, lowStock, overdueDebts };
  }, [orders, products, debts, tenantId]);

  const filteredItems = NAV_ITEMS.filter(item => item.roles.includes(userRole));
  const showSettings = ['owner'].includes(userRole);

  const isActive = (href: string) => {
    if (href === '/dashboard') return pathname === '/dashboard';
    return pathname.startsWith(href);
  };

  const roleLabel = { owner: 'المالك', partner: 'شريك', employee: 'موظف', super_admin: 'سوبر أدمن' };

  return (
    <>
      {isOpen && <div className="fixed inset-0 bg-black/60 z-40 md:hidden" onClick={onClose} />}

      <aside className={cn(
        'fixed top-0 right-0 h-full w-[260px] z-50 flex flex-col transition-transform duration-300 ease-in-out',
        'md:translate-x-0',
        isOpen ? 'translate-x-0' : 'translate-x-full md:translate-x-0',
      )} style={{ background: 'linear-gradient(180deg, #2a1045 0%, #3a1a5a 100%)' }}>

        {/* رأس — لوقو Bunyan */}
        <div className="relative flex items-center justify-center py-5 px-4 border-b border-white/10 h-20">
          <div className="w-20 h-10 p-1 rounded-lg bg-white/10 shadow-sm flex items-center justify-center overflow-hidden scale-90">
            <Logo providerName="bunyan" size="sm" onDarkBg={true} />
          </div>
          <button onClick={onClose} className="md:hidden absolute right-4 top-1/2 -translate-y-1/2 text-white/40 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* اسم المتجر */}
        {user?.tenantName && (
          <div className="px-4 py-3 border-b border-white/8">
            <p className="text-xs text-white/40 mb-0.5">المتجر النشط</p>
            <p className="text-sm font-bold text-white truncate">{user.tenantName}</p>
          </div>
        )}

        {/* قائمة التنقل */}
        <nav className="flex-1 overflow-y-auto py-3 px-3 space-y-0.5">
          {filteredItems.map((item) => {
            const active = isActive(item.href);
            const expanded = expandedItem === item.href;
            const Icon = item.icon;
            const badgeCount = item.badgeKey ? badges[item.badgeKey] : 0;

            const itemClass = cn(
              'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-200 group',
              active
                ? 'bg-bunyan-500 text-white shadow-lg shadow-bunyan-900/30'
                : 'text-white/70 hover:bg-white/10 hover:text-white',
            );

            const content = (
              <>
                <Icon size={18} className={active ? 'text-white' : 'text-white/50 group-hover:text-white transition-colors'} />
                <span className="flex-1 text-right font-medium">{item.label}</span>
                {/* Badge */}
                {badgeCount > 0 && !active && (
                  <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center leading-none">
                    {badgeCount}
                  </span>
                )}
                {item.children && (
                  <ChevronDown size={14} className={cn('text-white/40 transition-transform duration-200', expanded && 'rotate-180')} />
                )}
              </>
            );

            return (
              <div key={item.href}>
                {item.children ? (
                  <button className={itemClass} onClick={() => setExpandedItem(expanded ? null : item.href)}>
                    {content}
                  </button>
                ) : (
                  <Link href={item.href} className={itemClass}
                    onClick={() => { if (window.innerWidth < 768) onClose(); }}>
                    {content}
                  </Link>
                )}

                {/* قائمة فرعية */}
                {item.children && expanded && (
                  <div className="mr-9 mt-1 space-y-0.5 border-r border-white/10 pr-3">
                    {item.children.map((child) => (
                      <Link key={child.href} href={child.href}
                        onClick={() => { if (window.innerWidth < 768) onClose(); }}
                        className={cn(
                          'block px-3 py-2 rounded-lg text-xs transition-all',
                          pathname === child.href
                            ? 'bg-white/20 text-white font-semibold'
                            : 'text-white/50 hover:bg-white/10 hover:text-white/80',
                        )}>
                        {child.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* الإعدادات + تسجيل خروج */}
        <div className="border-t border-white/10 px-3 py-3 space-y-1">
          {showSettings && (
            <Link href="/settings"
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all',
                isActive('/settings') ? 'bg-bunyan-500 text-white' : 'text-white/60 hover:bg-white/10 hover:text-white',
              )}>
              <Settings size={18} />
              <span>الإعدادات</span>
            </Link>
          )}

          {/* معلومات المستخدم */}
          <div className="flex items-center gap-3 px-3 py-2.5 mt-1">
            <div className="w-8 h-8 rounded-full bg-bunyan-500 flex items-center justify-center text-xs text-white font-bold shrink-0">
              {user?.fullName?.charAt(0) || '؟'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-white truncate">{user?.fullName || 'مستخدم'}</p>
              <p className="text-[10px] text-white/40">{roleLabel[userRole] || 'موظف'}</p>
            </div>
            <button onClick={logout} className="text-white/30 hover:text-red-400 transition-colors" title="تسجيل خروج">
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
