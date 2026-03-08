'use client';

import { useState } from 'react';
import { useDataStore } from '@/core/db/store';
import { useToast } from '@/shared/components/ui/Toast';
import { CreditCard, Search, Download, CheckCircle2, XCircle, Clock, FileText, AlertCircle, Edit2, X, Save } from 'lucide-react';
import { Subscription } from '@/core/types';

export default function SuperAdminBilling() {
  const { subscriptions, tenants, updateSubscriptionStatus } = useDataStore();
  const { showToast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedSub, setSelectedSub] = useState<Subscription | null>(null);
  const [newStatus, setNewStatus] = useState<Subscription['status']>('pending');
  const [statusNote, setStatusNote] = useState('');

  // نربط الاشتراكات مع بيانات المتاجر
  const enrichedSubscriptions = subscriptions.map(sub => {
    const tenant = tenants.find(t => t.id === sub.tenantId);
    return {
      ...sub,
      tenantName: tenant?.name || 'متجر محذوف',
      tenantOwner: tenant?.ownerName || 'غير معروف'
    };
  });

  const filteredSubs = enrichedSubscriptions.filter(s => 
    s.tenantName.includes(searchTerm) || 
    s.id.includes(searchTerm)
  );

  const totalRevenue = subscriptions.filter(s => s.status === 'paid').reduce((sum, s) => sum + s.amount, 0);
  const pendingSubs = subscriptions.filter(s => s.status === 'pending').length;

  const getStatusBadge = (status: string) => {
    switch(status) {
      case 'paid': return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-md text-xs font-bold"><CheckCircle2 size={12}/> مسددة</span>;
      case 'pending': return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 text-amber-700 rounded-md text-xs font-bold"><Clock size={12}/> معلقة</span>;
      case 'overdue': return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-red-50 text-red-700 rounded-md text-xs font-bold"><AlertCircle size={12}/> متأخرة</span>;
      case 'cancelled': return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-gray-100 text-gray-700 rounded-md text-xs font-bold"><XCircle size={12}/> ملغية</span>;
      default: return <span className="inline-flex px-2.5 py-1 bg-gray-100 text-gray-700 rounded-md text-xs font-bold">{status}</span>;
    }
  };

  const handleUpdateClick = (sub: Subscription) => {
    setSelectedSub(sub);
    setNewStatus(sub.status);
    setStatusNote('');
    setIsModalOpen(true);
  };

  const handleSaveStatus = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedSub) {
      updateSubscriptionStatus(selectedSub.id, newStatus);
      showToast('تم تحديث حالة الفاتورة بنجاح', 'success');
      setIsModalOpen(false);
      setSelectedSub(null);
    }
  };

  const PLAN_LABELS: Record<string, string> = {
    trial: 'تجريبية مجانية',
    basic: 'أساسي',
    pro: 'احترافي',
    lifetime: 'تجريبية مجانية', // as per requirements all plans show this right now
  };

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900">الفوترة والاشتراكات</h1>
          <p className="text-sm text-gray-500 mt-1">متابعة إيرادات المنصة وحالة اشتراكات المتاجر.</p>
        </div>
        <button className="px-4 py-2 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 shadow-sm">
          <Download size={18} />
          <span>تصدير كـ CSV</span>
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-500 flex items-center justify-center">
            <CreditCard size={24} />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-500 mb-1">إجمالي الإيرادات المجمعة</p>
            <p className="text-2xl font-black text-gray-900">{totalRevenue.toLocaleString()} د.ل</p>
          </div>
        </div>
        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-bunyan-50 text-bunyan-500 flex items-center justify-center">
            <FileText size={24} />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-500 mb-1">إجمالي الفواتير</p>
            <p className="text-2xl font-black text-gray-900">{subscriptions.length}</p>
          </div>
        </div>
        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-500 flex items-center justify-center">
            <Clock size={24} />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-500 mb-1">فواتير بانتظار السداد</p>
            <p className="text-2xl font-black text-gray-900">{pendingSubs}</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-6 py-5 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
            <div className="w-2 h-6 bg-bunyan-500 rounded-full" />
            سجل الفواتير
          </h2>
          <div className="relative w-full sm:w-64">
            <Search className="absolute right-3 top-2.5 text-gray-400" size={16} />
            <input 
              type="text" 
              placeholder="بحث بالمتجر أو رقم الفاتورة..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pr-9 pl-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-bunyan-500/20 focus:bg-white transition-colors"
            />
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-right">
            <thead>
              <tr className="bg-gray-50/50 border-b border-gray-100 text-xs text-gray-500">
                <th className="px-6 py-4 font-semibold">رقم الفاتورة</th>
                <th className="px-6 py-4 font-semibold">المتجر / المالك</th>
                <th className="px-6 py-4 font-semibold">الباقة</th>
                <th className="px-6 py-4 font-semibold">القيمة</th>
                <th className="px-6 py-4 font-semibold">تاريخ الاستحقاق</th>
                <th className="px-6 py-4 font-semibold">الحالة</th>
                <th className="px-6 py-4 font-semibold w-24">إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {filteredSubs.map((s) => (
                <tr key={s.id} className="border-b border-gray-50 hover:bg-gray-50/80 transition-colors">
                  <td className="px-6 py-4">
                    <span className="text-sm font-mono text-gray-600 bg-gray-100 px-2 py-1 rounded-md">
                      #{s.id.slice(0, 8)}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-sm font-bold text-gray-900 mb-0.5">{s.tenantName}</p>
                    <p className="text-xs text-gray-500">{s.tenantOwner}</p>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm font-bold text-gray-700 capitalize">
                      {PLAN_LABELS[s.plan] || 'تجريبية مجانية'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm font-black text-gray-900">{s.amount.toLocaleString()} د.ل</span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {s.periodFrom}
                  </td>
                  <td className="px-6 py-4">
                    {getStatusBadge(s.status)}
                  </td>
                  <td className="px-6 py-4">
                    <button 
                      onClick={() => handleUpdateClick(s)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-bunyan-50 text-bunyan-700 hover:bg-bunyan-100 rounded-lg text-xs font-bold transition-colors whitespace-nowrap"
                    >
                      <Edit2 size={12} /> تحديث يدوي
                    </button>
                  </td>
                </tr>
              ))}
              {filteredSubs.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                    لا توجد فواتير مطابقة للبحث.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Manual Status Update Modal */}
      {isModalOpen && selectedSub && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setIsModalOpen(false)} />
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden relative z-10 animate-scale-in">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h2 className="text-lg font-black text-gray-900">تحديث حالة الفاتورة يدوياً</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-900">
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleSaveStatus} className="p-6 space-y-5">
              <div className="p-3 bg-gray-50 rounded-xl border border-gray-100 flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">المبلغ</p>
                  <p className="text-sm font-black text-gray-900">{selectedSub.amount.toLocaleString()} د.ل</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">رقم الفاتورة</p>
                  <p className="text-sm font-mono text-gray-600">#{selectedSub.id.slice(0, 8)}</p>
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-bold text-gray-700">الحالة الجديدة</label>
                <select 
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value as Subscription['status'])}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl bg-gray-50 focus:bg-white outline-none focus:ring-2 focus:ring-bunyan-500/20 text-sm font-semibold"
                >
                  <option value="pending">معلقة</option>
                  <option value="paid">مسددة</option>
                  <option value="overdue">متأخرة</option>
                  <option value="cancelled">ملغية</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-bold text-gray-700">ملاحظة إدارية (اختياري)</label>
                <textarea 
                  value={statusNote}
                  onChange={(e) => setStatusNote(e.target.value)}
                  className="w-full h-24 px-4 py-3 border border-gray-200 rounded-xl bg-gray-50 focus:bg-white outline-none focus:ring-2 focus:ring-bunyan-500/20 resize-none text-sm"
                  placeholder="سبب التغيير اليدوي أو رقم إيصال الحوالة..."
                />
              </div>

              <div className="flex gap-3 pt-4 border-t border-gray-100">
                <button type="submit" className="flex-1 bg-bunyan-600 hover:bg-bunyan-700 text-white flex items-center justify-center gap-2 py-3 rounded-xl font-bold transition-all">
                  <Save size={18} />
                  حفظ التغييرات
                </button>
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-6 bg-gray-100 hover:bg-gray-200 text-gray-700 py-3 rounded-xl font-bold transition-colors">
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
