// src/shared/components/layout/Header.tsx
// الوظيفة: شريط العنوان العلوي — بنفسجي + إشعارات dropdown + ملف شخصي + GlobalSearch
// المرجع: _DOCS/3_UI_UX_GUIDELINES.md — HEADER

'use client';

import { useState, useRef, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthStore } from '@/core/auth/store';
import { useDataStore } from '@/core/db/store';
import { GlobalSearch } from '@/shared/components/ui/GlobalSearch';
import {
  Bell, Menu, Settings, LogOut, User, ChevronDown,
  ShoppingCart, Package, AlertCircle, CheckCircle, Info,
  Eye, Shield, PanelRightClose, PanelRightOpen,
} from 'lucide-react';
import { formatRelativeTime } from '@/shared/utils/format';

const BREADCRUMB_MAP: Record<string, string> = {
  '/dashboard': 'لوحة القيادة',
  '/inventory': 'المخزون والعهدة',
  '/orders': 'الطلبيات والمبيعات',
  '/delivery': 'شركات التوصيل',
  '/delivery/companies': 'إدارة الشركات',
  '/delivery/shipments': 'تتبع الشحنات',
  '/delivery/settlements': 'التسويات المالية',
  '/delivery/analytics': 'تحليلات التوصيل',
  '/treasury': 'الخزينة والمالية',
  '/partners': 'الشركاء والمستثمرون',
  '/hr': 'الموارد البشرية',
  '/debts': 'سجل الديون',
  '/analytics': 'التحليلات المتقدمة',
  '/settings': 'الإعدادات',
};

const NOTIF_ICON = {
  warning: <AlertCircle size={16} className="text-amber-500" />,
  error:   <AlertCircle size={16} className="text-red-500" />,
  info:    <Info size={16} className="text-blue-500" />,
  success: <CheckCircle size={16} className="text-emerald-500" />,
};

interface HeaderProps { 
  sidebarOpen: boolean;
  onToggleSidebar: () => void; 
  onToggleMobileMenu: () => void;
}

export function Header({ sidebarOpen, onToggleSidebar, onToggleMobileMenu }: HeaderProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout, setViewingAs } = useAuthStore();
  const { notifications, markNotificationRead, markAllRead, getUnreadCount } = useDataStore();

  const [showNotifDropdown, setShowNotifDropdown] = useState(false);
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const [showRoleDropdown, setShowRoleDropdown] = useState(false);

  const notifRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  const tenantId = user?.tenantId ?? '';
  const unreadCount = getUnreadCount(tenantId);
  const myNotifications = notifications.filter(n => n.tenantId === tenantId).slice(0, 8);

  // المسار
  const segments = pathname.split('/').filter(Boolean);
  const breadcrumbs = segments.map((_, idx) => {
    const path = '/' + segments.slice(0, idx + 1).join('/');
    return { label: BREADCRUMB_MAP[path] || segments[idx], path, isLast: idx === segments.length - 1 };
  });

  // إغلاق dropdowns عند الضغط خارجها
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setShowNotifDropdown(false);
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setShowProfileDropdown(false);
        setShowRoleDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const roleLabel = { owner: 'المالك', partner: 'شريك', employee: 'موظف' };
  const roleBadgeColor = {
    owner: 'bg-bunyan-100 text-bunyan-700',
    partner: 'bg-purple-100 text-purple-700',
    employee: 'bg-blue-100 text-blue-700',
    super_admin: 'bg-amber-100 text-amber-700',
  };

  return (
    <header className="h-16 bg-[#3a1a5a] border-b border-white/10 flex items-center justify-between px-6 sticky top-0 z-30 shadow-lg">
      {/* الجانب الأيمن — زر القائمة + مسار التنقل */}
      <div className="flex items-center gap-4">
        {/* Toggle Mobile Drawer */}
        <button onClick={onToggleMobileMenu} className="lg:hidden text-white/60 hover:text-white transition-colors">
          <Menu size={22} />
        </button>

        {/* Toggle Desktop Sidebar */}
        <button 
          onClick={onToggleSidebar} 
          className="hidden lg:flex text-white/60 hover:text-white transition-colors w-9 h-9 items-center justify-center bg-white/5 rounded-xl hover:bg-white/10"
          title={sidebarOpen ? "إخفاء القائمة" : "إظهار القائمة"}
        >
          {sidebarOpen ? <PanelRightClose size={20} /> : <PanelRightOpen size={20} />}
        </button>

        <nav className="flex items-center gap-1.5 text-sm">
          {breadcrumbs.length === 0 && (
            <span className="font-semibold text-white">الرئيسية</span>
          )}
          {breadcrumbs.map((crumb, i) => (
            <span key={crumb.path} className="flex items-center gap-1.5">
              {i > 0 && <span className="text-white/30">/</span>}
              <span className={crumb.isLast ? 'font-semibold text-white' : 'text-white/50'}>
                {crumb.label}
              </span>
            </span>
          ))}
        </nav>
      </div>

      {/* الجانب الأيسر */}
      <div className="flex items-center gap-2">
        {/* بحث عام */}
        <GlobalSearch />

        {/* Role Switching — للمالك فقط */}
        {user?.role === 'owner' && (
          <div className="relative" ref={profileRef}>
            <button
              onClick={() => { setShowRoleDropdown(!showRoleDropdown); setShowProfileDropdown(false); }}
              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white/10 hover:bg-white/15 border border-white/15 rounded-xl text-white/70 hover:text-white text-xs transition-all"
              title="عرض المنظومة من منظور دور آخر"
            >
              <Eye size={14} />
              <span className="hidden sm:inline">عرض كـ</span>
            </button>

            {showRoleDropdown && (
              <div className="absolute left-0 mt-2 w-40 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden z-50 animate-scale-up">
                <div className="p-2 border-b border-gray-100">
                  <p className="text-xs text-gray-400 text-center">عرض كـ:</p>
                </div>
                {(['owner', 'employee', 'partner'] as const).map(role => (
                  <button key={role}
                    onClick={() => { setViewingAs(role === user.viewingAs ? undefined : role); setShowRoleDropdown(false); }}
                    className={`w-full text-right px-3 py-2 text-sm hover:bg-gray-50 transition-colors flex items-center gap-2 ${user.viewingAs === role ? 'text-bunyan-600 font-semibold' : 'text-gray-700'}`}>
                    {user.viewingAs === role && <Shield size={14} className="text-bunyan-500" />}
                    {roleLabel[role]}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* الإشعارات */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => { setShowNotifDropdown(!showNotifDropdown); setShowProfileDropdown(false); if (showNotifDropdown) markAllRead(tenantId); }}
            className="relative w-9 h-9 rounded-xl bg-white/10 hover:bg-white/15 flex items-center justify-center text-white/70 hover:text-white transition-all"
          >
            <Bell size={18} />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-[9px] text-white font-bold flex items-center justify-center">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {showNotifDropdown && (
            <div className="absolute left-0 mt-2 w-80 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden z-50 animate-scale-up">
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                <h3 className="font-bold text-gray-800 text-sm">الإشعارات</h3>
                {unreadCount > 0 && (
                  <button onClick={() => markAllRead(tenantId)} className="text-xs text-bunyan-600 hover:text-bunyan-700">
                    قراءة الكل
                  </button>
                )}
              </div>
              <div className="max-h-72 overflow-y-auto">
                {myNotifications.length === 0 ? (
                  <div className="text-center py-8 text-gray-400">
                    <Bell size={24} className="mx-auto mb-2 opacity-30" />
                    <p className="text-xs">لا توجد إشعارات</p>
                  </div>
                ) : (
                  myNotifications.map(n => (
                    <button key={n.id}
                      onClick={() => {
                        markNotificationRead(n.id);
                        if (n.link) router.push(n.link);
                        setShowNotifDropdown(false);
                      }}
                      className={`w-full text-right px-4 py-3 border-b border-gray-50 hover:bg-gray-50 transition-colors flex gap-3 items-start ${!n.isRead ? 'bg-bunyan-50/50' : ''}`}>
                      <span className="mt-0.5 shrink-0">{NOTIF_ICON[n.type]}</span>
                      <div className="flex-1 min-w-0">
                        <p className={`text-xs font-semibold ${!n.isRead ? 'text-gray-800' : 'text-gray-600'}`}>{n.title}</p>
                        <p className="text-xs text-gray-400 mt-0.5 truncate">{n.message}</p>
                        <p className="text-[10px] text-gray-300 mt-1">{formatRelativeTime(n.createdAt)}</p>
                      </div>
                      {!n.isRead && <div className="w-1.5 h-1.5 bg-bunyan-500 rounded-full mt-2 shrink-0" />}
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* الملف الشخصي */}
        <div className="relative" ref={profileRef}>
          <button
            onClick={() => { setShowProfileDropdown(!showProfileDropdown); setShowNotifDropdown(false); }}
            className="flex items-center gap-2 pl-2 pr-3 py-1.5 bg-white/10 hover:bg-white/15 rounded-xl border border-white/15 transition-all"
          >
            <div className="w-7 h-7 rounded-full bg-bunyan-500 flex items-center justify-center text-xs text-white font-bold shrink-0">
              {user?.fullName?.charAt(0) || '؟'}
            </div>
            <div className="hidden sm:block text-right">
              <p className="text-xs font-semibold text-white leading-tight truncate max-w-[90px]">{user?.fullName}</p>
              <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold ${roleBadgeColor[user?.role as keyof typeof roleBadgeColor] || 'bg-gray-100 text-gray-600'}`}>
                {roleLabel[user?.role as keyof typeof roleLabel] || user?.role}
              </span>
            </div>
            <ChevronDown size={12} className={`text-white/40 transition-transform ${showProfileDropdown ? 'rotate-180' : ''}`} />
          </button>

          {showProfileDropdown && (
            <div className="absolute left-0 mt-2 w-64 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden z-50 animate-scale-up">
              {/* بيانات المستخدم */}
              <div className="p-4 border-b border-gray-100 bg-bunyan-50/50">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-bunyan-500 flex items-center justify-center text-lg text-white font-bold">
                    {user?.fullName?.charAt(0) || '؟'}
                  </div>
                  <div>
                    <p className="font-bold text-gray-800">{user?.fullName}</p>
                    <p className="text-xs text-gray-500">{user?.email}</p>
                    {user?.tenantName && <p className="text-xs text-bunyan-600 font-semibold mt-0.5">{user.tenantName}</p>}
                  </div>
                </div>
              </div>

              {/* الخيارات */}
              <div className="p-2">
                <button onClick={() => { router.push('/settings'); setShowProfileDropdown(false); }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-50 text-gray-700 text-sm transition-colors text-right">
                  <Settings size={16} className="text-gray-400" />
                  إعدادات الحساب
                </button>
                <button onClick={() => { router.push('/settings?tab=security'); setShowProfileDropdown(false); }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-50 text-gray-700 text-sm transition-colors text-right">
                  <User size={16} className="text-gray-400" />
                  تغيير كلمة المرور
                </button>
                <hr className="my-1 border-gray-100" />
                <button onClick={() => { logout(); setShowProfileDropdown(false); }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-red-50 text-red-600 text-sm transition-colors text-right">
                  <LogOut size={16} />
                  تسجيل الخروج
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
