// src/app/super-admin/tenants/page.tsx
// الوظيفة: إدارة المتاجر للسوبر أدمن (عرض Grid، إضافة، إيقاف)
// الصلاحية: SUPER_ADMIN فقط

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/core/auth/store';
import { useDataStore } from '@/core/db/store';
import { useToast } from '@/shared/components/ui/Toast';
import { Store, CheckCircle2, XCircle, Search, Filter, Plus, Eye, Power, PowerOff, Building2, MapPin, Calendar, Clock } from 'lucide-react';

const PLAN_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  trial: { label: 'تجريبية مجانية', color: 'text-gray-700', bg: 'bg-gray-100' },
  basic: { label: 'أساسي', color: 'text-blue-700', bg: 'bg-blue-50' },
  pro: { label: 'احترافي', color: 'text-bunyan-700', bg: 'bg-bunyan-50' },
  lifetime: { label: 'تجريبية مجانية', color: 'text-emerald-700', bg: 'bg-emerald-50' },
};

export default function SuperAdminTenants() {
  const router = useRouter();
  const { enterTenantAsAdmin, user } = useAuthStore();
  const { tenants, toggleTenant, addAuditLog } = useDataStore();
  const { showToast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  const filteredTenants = tenants.filter(t => {
    const matchesSearch = t.name.includes(searchTerm) || t.ownerName.includes(searchTerm) || t.ownerEmail.includes(searchTerm);
    const matchesStatus = statusFilter === 'all' ? true : statusFilter === 'active' ? t.isActive : !t.isActive;
    return matchesSearch && matchesStatus;
  });

  const handleEnterTenant = (t: typeof tenants[0]) => {
    addAuditLog({
      id: `audit-${Date.now()}`,
      adminId: user?.id || 'admin',
      tenantId: t.id,
      action: 'impersonate',
      timestamp: new Date().toISOString()
    });
    
    showToast(`تم تسجيل الدخول بصلاحية المالك للمتجر: ${t.name}`, 'success');
    enterTenantAsAdmin(t.id, t.name);
    router.push('/dashboard');
  };

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900">إدارة المتاجر</h1>
          <p className="text-sm text-gray-500 mt-1">عرض وإدارة جميع المتاجر المسجلة في النظام.</p>
        </div>
        <button className="px-4 py-2 bg-bunyan-600 hover:bg-bunyan-700 text-white rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 shadow-sm">
          <Plus size={18} />
          <span>متجر جديد</span>
        </button>
      </div>

      <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:w-96">
          <Search className="absolute right-3 top-2.5 text-gray-400" size={18} />
          <input 
            type="text" 
            placeholder="البحث باسم المتجر أو المالك أو البريد..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pr-10 pl-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-bunyan-500/20 focus:bg-white transition-colors"
          />
        </div>
        <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
          <Filter size={16} className="text-gray-400 shrink-0" />
          <div className="flex bg-gray-100 p-1 rounded-lg shrink-0">
            <button 
              onClick={() => setStatusFilter('all')} 
              className={`px-3 py-1.5 rounded-md text-xs font-bold transition-colors ${statusFilter === 'all' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              الكل ({tenants.length})
            </button>
            <button 
              onClick={() => setStatusFilter('active')} 
              className={`px-3 py-1.5 rounded-md text-xs font-bold transition-colors flex items-center gap-1 ${statusFilter === 'active' ? 'bg-emerald-50 text-emerald-700 shadow-sm' : 'text-gray-500 hover:text-emerald-600'}`}
            >
              <CheckCircle2 size={12} /> نشط
            </button>
            <button 
              onClick={() => setStatusFilter('inactive')} 
              className={`px-3 py-1.5 rounded-md text-xs font-bold transition-colors flex items-center gap-1 ${statusFilter === 'inactive' ? 'bg-red-50 text-red-700 shadow-sm' : 'text-gray-500 hover:text-red-600'}`}
            >
              <XCircle size={12} /> متوقف
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredTenants.map((t) => {
          const plan = PLAN_LABELS[t.plan] || PLAN_LABELS.trial;
          
          return (
            <div key={t.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow overflow-hidden flex flex-col relative group">
              {/* Header */}
              <div className="p-5 border-b border-gray-50 flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center font-black text-xl text-bunyan-600 shadow-inner border border-gray-200/50">
                    {t.name.charAt(0)}
                  </div>
                  <div>
                    <h3 className="text-base font-black text-gray-900">{t.name}</h3>
                    <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                      <Building2 size={12} /> {t.city}
                    </p>
                  </div>
                </div>
                {t.isActive ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-lg text-[11px] font-bold border border-emerald-100">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> مسدد
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-red-50 text-red-700 rounded-lg text-[11px] font-bold border border-red-100">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500" /> موقوف
                  </span>
                )}
              </div>
              
              {/* Body */}
              <div className="p-5 flex-1 space-y-4">
                <div>
                  <p className="text-[10px] font-bold text-gray-400 mb-1 uppercase tracking-wider">المالك</p>
                  <p className="text-sm font-semibold text-gray-900">{t.ownerName}</p>
                  <p className="text-xs text-gray-500 mt-0.5" dir="ltr">{t.ownerEmail}</p>
                </div>
                
                <div className="grid grid-cols-2 gap-4 pt-2 border-t border-gray-50">
                  <div>
                    <p className="text-[10px] font-bold text-gray-400 mb-1 uppercase tracking-wider">الباقة الحالية</p>
                    <span className={`inline-flex px-2 py-0.5 rounded-md text-xs font-bold ${plan.bg} ${plan.color}`}>
                      {plan.label}
                    </span>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-gray-400 mb-1 uppercase tracking-wider">تاريخ الانضمام</p>
                    <p className="text-xs font-semibold text-gray-700 flex items-center gap-1">
                      <Calendar size={12} className="text-gray-400" /> {t.createdAt.split('T')[0] || t.createdAt}
                    </p>
                  </div>
                </div>
              </div>
              
              {/* Footer */}
              <div className="p-4 bg-gray-50/50 border-t border-gray-100 mt-auto flex items-center justify-between gap-2">
                <button 
                  onClick={() => handleEnterTenant(t)}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-white hover:bg-gray-50 border border-gray-200 text-gray-700 rounded-xl text-xs font-bold transition-colors"
                >
                  <Eye size={14} /> دخول كمالك المتجر
                </button>
                <button 
                  onClick={() => toggleTenant(t.id)}
                  className={`flex-2 flex items-center justify-center gap-1.5 px-3 py-2 border rounded-xl text-xs font-bold transition-colors ${
                    t.isActive 
                      ? 'bg-white hover:bg-red-50 border-red-100 text-red-600 hover:text-red-700 hover:border-red-200' 
                      : 'bg-white hover:bg-emerald-50 border-emerald-100 text-emerald-600 hover:text-emerald-700 hover:border-emerald-200'
                  }`}
                >
                  {t.isActive ? (
                    <><PowerOff size={14} /> تجميد المتجر</>
                  ) : (
                    <><Power size={14} /> تفعيل المتجر</>
                  )}
                </button>
              </div>
            </div>
          );
        })}

        {filteredTenants.length === 0 && (
          <div className="col-span-full py-16 text-center bg-white rounded-2xl border border-gray-100 border-dashed">
            <Store size={48} className="mx-auto text-gray-300 mb-4" />
            <h3 className="text-lg font-bold text-gray-900 mb-1">لا توجد متاجر مطابقة</h3>
            <p className="text-sm text-gray-500">جرب البحث بكلمات أخرى أو تغيير إعدادات التصفية.</p>
          </div>
        )}
      </div>
    </div>
  );
}
