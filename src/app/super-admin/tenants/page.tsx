// src/app/super-admin/tenants/page.tsx
// إدارة المتاجر — High-Density Cards + Kebab Menu للإجراءات الخطيرة

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/core/auth/store';
import { useDataStore } from '@/core/db/store';
import { useToast } from '@/shared/components/ui/Toast';
import { EmptyState } from '@/shared/components/ui/EmptyState';
import {
  Store, Search, LogIn, PauseCircle,
  MoreVertical, Pencil, MapPin, Calendar
} from 'lucide-react';

const PLAN_LABELS: Record<string, { label: string; color: string; bg: string; border: string }> = {
  trial:    { label: 'تجريبي',   color: 'text-gray-700',   bg: 'bg-gray-50',   border: 'border-gray-200' },
  basic:    { label: 'أساسي',    color: 'text-blue-700',   bg: 'bg-blue-50',   border: 'border-blue-200' },
  pro:      { label: 'احترافي',  color: 'text-bunyan-700', bg: 'bg-bunyan-50', border: 'border-bunyan-200' },
  lifetime: { label: 'مدى الحياة', color: 'text-purple-700', bg: 'bg-purple-50', border: 'border-purple-200' },
};

export default function SuperAdminTenants() {
  const router = useRouter();
  const { enterTenantAsAdmin, user } = useAuthStore();
  const { tenants, toggleTenant, addAuditLog } = useDataStore();
  const { showToast } = useToast();

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'frozen'>('all');
  const [openMenu, setOpenMenu] = useState<string | null>(null);

  const filtered = tenants.filter(t => {
    const matchSearch = !searchTerm
      || t.name.includes(searchTerm)
      || t.ownerName.includes(searchTerm)
      || t.ownerEmail.toLowerCase().includes(searchTerm.toLowerCase());
    const matchStatus =
      statusFilter === 'all' ? true
      : statusFilter === 'active' ? t.isActive
      : !t.isActive;
    return matchSearch && matchStatus;
  });

  const handleEnterTenant = (t: typeof tenants[0]) => {
    addAuditLog({
      id: `audit-${Date.now()}`,
      adminId: user?.id ?? 'admin',
      tenantId: t.id, action: 'impersonate',
      timestamp: new Date().toISOString(),
    });
    showToast(`تم الدخول كمالك — ${t.name}`, 'success');
    enterTenantAsAdmin(t.id, t.name);
    router.push('/dashboard');
  };

  const handleFreeze = (t: typeof tenants[0]) => {
    toggleTenant(t.id);
    showToast(t.isActive ? `تم تجميد ${t.name}` : `تم تفعيل ${t.name}`, t.isActive ? 'warning' : 'success');
    setOpenMenu(null);
  };

  return (
    <div
      className="space-y-6 animate-fade-in pb-10"
      onClick={() => setOpenMenu(null)}
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900">إدارة المتاجر</h1>
          <p className="text-sm text-gray-500 mt-1">
            {tenants.length} متجر مسجل — {tenants.filter(t => t.isActive).length} نشط
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm
        flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-2.5 text-gray-400" size={16} />
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="البحث باسم المتجر أو المالك..."
            className="w-full pr-9 pl-4 py-2.5 bg-gray-50 border border-gray-200
              rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-bunyan-500/20
              focus:bg-white transition-colors"
          />
        </div>
        <div className="flex bg-gray-100 p-1 rounded-xl gap-1 self-start md:self-auto">
          {([['all','الكل'], ['active','نشط'], ['frozen','مجمد']] as const).map(([v, l]) => (
            <button
              key={v}
              onClick={() => setStatusFilter(v)}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                statusFilter === v
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {l} {v === 'all' ? `(${tenants.length})` : v === 'active' ? `(${tenants.filter(t=>t.isActive).length})` : `(${tenants.filter(t=>!t.isActive).length})`}
            </button>
          ))}
        </div>
      </div>

      {/* Cards Grid */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={<Store />}
          title={searchTerm ? 'لا توجد نتائج مطابقة' : 'لا توجد متاجر'}
          description={searchTerm ? 'جرب كلمات بحث مختلفة' : 'ستظهر المتاجر هنا بعد التسجيل'}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map(t => {
            const plan = PLAN_LABELS[t.plan ?? 'trial'] ?? PLAN_LABELS.trial;
            return (
              <div
                key={t.id}
                className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm
                  hover:shadow-md transition-all overflow-hidden relative"
              >
                {/* Top accent */}
                <div className={`absolute top-0 right-0 left-0 h-1 rounded-t-2xl ${
                  t.isActive ? 'bg-gradient-to-r from-emerald-400 to-teal-500' : 'bg-gradient-to-r from-amber-400 to-orange-400'
                }`} />

                {/* Header Row */}
                <div className="flex items-start justify-between mb-4 mt-1">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-bunyan-50 flex items-center
                      justify-center text-bunyan-700 font-black text-base">
                      {t.name.charAt(0)}
                    </div>
                    <div>
                      <p className="font-bold text-gray-900 text-sm leading-tight">{t.name}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{t.ownerName}</p>
                    </div>
                  </div>

                  {/* Kebab Menu ⋮ */}
                  <div className="relative" onClick={e => e.stopPropagation()}>
                    <button
                      onClick={() => setOpenMenu(openMenu === t.id ? null : t.id)}
                      className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center
                        justify-center text-gray-400 transition-colors"
                    >
                      <MoreVertical size={16} />
                    </button>
                    {openMenu === t.id && (
                      <div className="absolute left-0 top-full mt-1 w-44 bg-white border
                        border-gray-200 rounded-xl shadow-lg z-30 overflow-hidden">
                        <button
                          onClick={() => { setOpenMenu(null); }}
                          className="w-full flex items-center gap-2.5 px-3 py-2.5
                            text-sm text-gray-700 hover:bg-gray-50 text-right"
                        >
                          <Pencil size={14} /> تعديل البيانات
                        </button>
                        <button
                          onClick={() => handleFreeze(t)}
                          className="w-full flex items-center gap-2.5 px-3 py-2.5
                            text-sm hover:bg-amber-50 text-right text-amber-700"
                        >
                          <PauseCircle size={14} />
                          {t.isActive ? 'تجميد المتجر' : 'تفعيل المتجر'}
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Status + Plan */}
                <div className="flex items-center gap-2 mb-4">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full
                    text-[11px] font-bold border ${
                      t.isActive
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-amber-50 text-amber-700 border-amber-200'
                    }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${t.isActive ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                    {t.isActive ? 'نشط' : 'مجمد'}
                  </span>
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px]
                    font-bold border ${plan.bg} ${plan.color} ${plan.border}`}>
                    {plan.label}
                  </span>
                </div>

                {/* Details */}
                <div className="text-xs text-gray-500 space-y-1.5 mb-4">
                  <div className="flex items-center gap-1.5">
                    <MapPin size={11} className="text-gray-400" />
                    <span>{t.city ?? '—'}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Calendar size={11} className="text-gray-400" />
                    <span>{t.createdAt?.split('T')[0] ?? t.createdAt}</span>
                  </div>
                </div>

                {/* Primary Action — مرئي دائماً */}
                <button
                  onClick={() => handleEnterTenant(t)}
                  className="w-full py-2 bg-bunyan-600 hover:bg-bunyan-700 text-white
                    rounded-xl text-sm font-bold transition-all flex items-center
                    justify-center gap-2"
                >
                  <LogIn size={14} /> دخول كمالك
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
