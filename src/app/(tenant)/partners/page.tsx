// src/app/(tenant)/partners/page.tsx
// الوظيفة: الشركاء — جدول + إضافة/تعديل + حذف
// الجداول: partners
// الصلاحية: OWNER فقط

'use client';

import { useState } from 'react';
import { useAuthStore } from '@/core/auth/store';
import { useDataStore } from '@/core/db/store';
import { formatCurrency } from '@/shared/utils/format';
import { SlideOver } from '@/shared/components/ui/SlideOver';
import { ConfirmDialog } from '@/shared/components/ui/ConfirmDialog';
import { useToast } from '@/shared/components/ui/Toast';
import { Handshake, Plus, Trash2, Edit2, TrendingUp, AlertCircle, PiggyBank, Briefcase, HandCoins, Key, CheckSquare, Square } from 'lucide-react';
import type { Partner, Order, TreasuryTransaction, TenantUser, UserPermissions } from '@/core/db/seed';
import { PARTNER_PERMISSIONS } from '@/core/db/seed';

export default function PartnersPage() {
  const { user } = useAuthStore();
  const { partners, orders, transactions, getForTenant, addPartner, updatePartner, deletePartner, addUser, withdrawPartnerFunds, distributeProfits } = useDataStore();
  const { showToast } = useToast();
  const tid = user?.tenantId || '';
  const myPartners = getForTenant(partners, tid);
  
  const totalCapital = myPartners.reduce((s, p) => s + p.capitalContribution, 0);
  const totalDues = myPartners.reduce((s, p) => s + p.walletBalance, 0);
  const totalDebts = myPartners.reduce((s, p) => s + p.debtBalance, 0);
  const totalPercentage = myPartners.reduce((s, p) => s + p.profitPercentage, 0);

  const myOrders: Order[] = getForTenant(orders, tid).filter(o => o.status === 'delivered');
  const totalRevenue = myOrders.reduce((s, o) => s + o.total, 0);
  const totalCost = myOrders.reduce((s, o) => s + o.items.reduce((is, it) => is + it.unitCost * it.quantity, 0), 0);
  const myExpenses: TreasuryTransaction[] = getForTenant(transactions, tid).filter(t => t.transactionType === 'expense');
  const totalExpenses = myExpenses.reduce((s, t) => s + Math.abs(t.amount), 0);
  
  const totalNetProfit = totalRevenue - totalCost - totalExpenses;
  const myDistributionsLogs: TreasuryTransaction[] = getForTenant(transactions, tid).filter(t => t.transactionType === 'profit_distribution_record');
  const totalProfitProcessed = myDistributionsLogs.reduce((s, t) => s + Math.abs(t.amount), 0);
  
  const unallocatedProfit = totalNetProfit - totalProfitProcessed;

  const [slideOpen, setSlideOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [withdrawId, setWithdrawId] = useState<string | null>(null);
  const [withdrawAmount, setWithdrawAmount] = useState<number | string>('');
  const [withdrawDeductDebt, setWithdrawDeductDebt] = useState(false);
  const [withdrawDate, setWithdrawDate] = useState(new Date().toISOString().split('T')[0]);
  const [withdrawNote, setWithdrawNote] = useState('');

  const [form, setForm] = useState({
    name: '', phone: '', email: '', password: '', isActive: true,
    partnerRole: 'active_partner' as Partner['partnerRole'],
    profitPercentage: 0, capitalContribution: 0,
    customPerms: { orders: false, inventory: false, delivery: false, dashboard: false, treasury: false }
  });

  const resetForm = () => { 
    setForm({ 
      name: '', phone: '', email: '', password: '', isActive: true, 
      partnerRole: 'active_partner', profitPercentage: 0, capitalContribution: 0,
      customPerms: { orders: false, inventory: false, delivery: false, dashboard: false, treasury: false }
    }); 
    setEditingId(null); 
  };

  const openEdit = (p: Partner) => {
    setForm({ 
      ...form, 
      name: p.name, phone: p.phone, email: p.email || '', password: '', 
      isActive: p.isActive, partnerRole: p.partnerRole || 'active_partner',
      profitPercentage: p.profitPercentage, capitalContribution: p.capitalContribution 
    });
    setEditingId(p.id);
    setSlideOpen(true);
  };

  const generatePassword = () => {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
    let p = '';
    for(let i=0; i<10; i++) p += chars.charAt(Math.floor(Math.random() * chars.length));
    setForm({...form, password: p});
  };

  const handleSave = () => {
    if (!form.name || !form.email) { showToast('يرجى ملء اسم الشريك والبريد الإلكتروني', 'error'); return; }

    const oldPercentage = editingId ? (myPartners.find(p => p.id === editingId)?.profitPercentage || 0) : 0;
    if (totalPercentage - oldPercentage + form.profitPercentage > 100) {
      showToast('خطأ: مجموع نسب الشركاء لا يمكن أن يتجاوز 100%، يرجى تعديل النسبة', 'error');
      return;
    }

    if (editingId) {
      updatePartner(editingId, {
        name: form.name, phone: form.phone, email: form.email,
        isActive: form.isActive, partnerRole: form.partnerRole,
        profitPercentage: form.profitPercentage, capitalContribution: form.capitalContribution
      });
      // يمكن إضافة تحديث TenantUser المرتبط لاحقاً
      showToast('تم تحديث بيانات الشريك بنجاح', 'success');
    } else {
      const ptrId = `ptr-${Date.now()}`;
      addPartner({
        id: ptrId, tenantId: tid, 
        name: form.name, phone: form.phone, email: form.email,
        profitPercentage: form.profitPercentage, capitalContribution: form.capitalContribution,
        partnerRole: form.partnerRole, isActive: form.isActive, 
        walletBalance: 0, debtBalance: 0, joinedAt: new Date().toISOString().split('T')[0],
      });
      
      const passToUse = form.password || '123456';
      
      // تحديد الصلاحيات حسب الدور
      let perms: UserPermissions = { ...PARTNER_PERMISSIONS };
      if (form.partnerRole === 'active_partner') {
        perms = {
          inventory: { view: true, add: true, edit: true, delete: true, viewCostPrice: true },
          orders: { view: true, add: true, edit: true, delete: true, changeStatus: true, viewAll: true },
          delivery: { view: true, addShipment: true, manageCompanies: true, viewSettlements: true, addSettlement: true },
          treasury: { view: true, addTransaction: true },
          partners: { view: true, viewOwn: false },
          hr: { view: true, viewOwn: false },
          analytics: { view: true, viewFull: true },
          settings: { view: false, edit: false }
        };
      } else if (form.partnerRole === 'silent_investor') {
        perms = { ...PARTNER_PERMISSIONS }; // أساسي
      } else if (form.partnerRole === 'custom') {
        perms = {
          inventory: { view: form.customPerms.inventory, add: form.customPerms.inventory, edit: form.customPerms.inventory, delete: false, viewCostPrice: form.customPerms.inventory },
          orders: { view: form.customPerms.orders, add: form.customPerms.orders, edit: form.customPerms.orders, delete: false, changeStatus: form.customPerms.orders, viewAll: form.customPerms.orders },
          delivery: { view: form.customPerms.delivery, addShipment: false, manageCompanies: false, viewSettlements: false, addSettlement: false },
          treasury: { view: form.customPerms.treasury, addTransaction: false },
          partners: { view: false, viewOwn: true },
          hr: { view: false, viewOwn: true },
          analytics: { view: form.customPerms.dashboard, viewFull: false },
          settings: { view: false, edit: false }
        };
      }
      
      addUser({ 
        id: `user-${Date.now()}`, tenantId: tid, fullName: form.name, 
        email: form.email, passwordHash: btoa(passToUse), role: 'partner', 
        permissions: perms, isActive: form.isActive, 
        createdAt: new Date().toISOString().split('T')[0], phone: form.phone 
      });
      showToast(`تمت إضافة الشريك وإنشاء حساب دخوله. الباسورد: ${passToUse}`, 'success');
    }
    setSlideOpen(false);
    resetForm();
  };

  const handleWithdraw = () => {
    const amt = Number(withdrawAmount);
    if (!withdrawId || amt <= 0) {
      showToast('يرجى إدخال مبلغ صحيح للسحب', 'error');
      return;
    }
    const partner = myPartners.find(p => p.id === withdrawId);
    if (!partner) return;
    
    // حساب مقدار الخصم في حال كان المربع مفعّلاً
    const debtToDeduct = (withdrawDeductDebt && partner.debtBalance > 0) ? Math.min(partner.debtBalance, amt) : 0;

    const res = withdrawPartnerFunds(withdrawId, amt, {
      description: withdrawNote || 'سحب أرباح',
      deductDebt: withdrawDeductDebt,
      transactionDate: withdrawDate
    });
    
    if (res.success) {
      showToast(`تم سحب الأرباح بنجاح وتسجيل الحركة. تم صرف ${formatCurrency(amt - debtToDeduct)} نقداً.`, 'success');
      setWithdrawId(null);
      setWithdrawAmount('');
      setWithdrawNote('');
      setWithdrawDeductDebt(false);
    } else {
      showToast(res.error || 'حدث خطأ غير متوقع', 'error');
    }
  };

  const handleDistributeProfits = () => {
    if (unallocatedProfit <= 0) {
      showToast('لا توجد أرباح غير موزعة لتخريجها', 'error');
      return;
    }
    const result = distributeProfits(tid, unallocatedProfit);
    if (result.success) {
      showToast(`تم تخريج دورة الأرباح بقيمة ${formatCurrency(unallocatedProfit)} بنجاح وتوزيعها على المحافظ`, 'success');
    } else {
      showToast(result.error || 'حدث خطأ غير متوقع', 'error');
    }
  };

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Handshake size={24} className="text-bunyan-600" />
            الشركاء والمستثمرون
          </h1>
          <p className="text-sm text-gray-500 mt-1">إدارة حصص الشركاء والمبالغ المالية المستحقة لهم</p>
        </div>
        <div className="flex items-center gap-2">
           {unallocatedProfit > 0 && user?.role === 'owner' && (
             <button onClick={handleDistributeProfits} className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-bold hover:bg-emerald-700 transition-colors shadow-sm focus:ring-2 focus:ring-emerald-500/50">
               <TrendingUp size={18} /> إغلاق وتوزيع الأرباح
             </button>
           )}
           <button onClick={() => { resetForm(); setSlideOpen(true); }} 
             className="flex items-center gap-2 px-4 py-2 bg-bunyan-600 text-white rounded-xl text-sm font-bold hover:bg-bunyan-700 transition-colors shadow-sm focus:ring-2 focus:ring-bunyan-500/50">
             <Plus size={18} /> إضافة شريك
           </button>
        </div>
      </div>

      {/* مؤشر الأرباح الإجمالي */}
      <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
        <div className="flex justify-between items-center mb-2">
          <p className="font-bold text-gray-900 text-sm">مؤشر توزيع الأرباح الإجمالي</p>
          <p className={`text-sm font-black font-mono ${totalPercentage > 100 ? 'text-red-600' : (totalPercentage === 100 ? 'text-emerald-600' : 'text-blue-600')}`}>
            {totalPercentage}% المُوَزّع | {Math.max(0, 100 - totalPercentage)}% المتبقي
          </p>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-3 flex overflow-hidden">
          {myPartners.map((p, i) => (
            <div key={p.id} className="h-full border-l border-white/20 relative group" 
                 style={{ width: `${p.profitPercentage}%`, backgroundColor: `hsl(${(i * 137.5) % 360}, 70%, 50%)` }}>
              <div className="absolute bottom-full mb-2 hidden group-hover:block bg-gray-900 text-white text-[10px] px-2 py-1 rounded whitespace-nowrap z-10 left-1/2 -translate-x-1/2">
                {p.name}: {p.profitPercentage}%
              </div>
            </div>
          ))}
          {totalPercentage < 100 && (
            <div className="h-full bg-gray-200 cursor-not-allowed" style={{ width: `${100 - totalPercentage}%` }} title="النسبة غير الموزعة"></div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm flex items-center gap-4 hover:shadow-md transition-shadow">
          <div className="w-14 h-14 bg-bunyan-50 rounded-2xl flex items-center justify-center shrink-0">
            <Briefcase size={28} className="text-bunyan-600" />
          </div>
          <div>
            <p className="text-sm font-bold text-gray-500 mb-1">عدد الشركاء المسجلين</p>
            <p className="text-3xl font-black text-gray-900">{myPartners.length}</p>
          </div>
        </div>
        <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm flex items-center gap-4 hover:shadow-md transition-shadow">
          <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center shrink-0">
            <PiggyBank size={28} className="text-blue-600" />
          </div>
          <div>
            <p className="text-sm font-bold text-gray-500 mb-1">إجمالي رأس المال المُتشارك</p>
            <p className="text-2xl font-black text-gray-900 font-currency">{formatCurrency(totalCapital)}</p>
          </div>
        </div>
        <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm flex items-center gap-4 hover:shadow-md transition-shadow">
          <div className="w-14 h-14 bg-emerald-50 rounded-2xl flex items-center justify-center shrink-0">
            <TrendingUp size={28} className="text-emerald-600" />
          </div>
          <div>
            <p className="text-sm font-bold text-gray-500 mb-1">إجمالي مستحقات الشركاء (أرباح)</p>
            <p className="text-2xl font-black text-emerald-600 font-currency">{formatCurrency(totalDues)}</p>
          </div>
        </div>
      </div>

      {unallocatedProfit > 0 && user?.role === 'owner' && (
        <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-5 flex items-start sm:items-center justify-between gap-4 flex-col sm:flex-row">
           <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center shrink-0 mt-0.5 sm:mt-0">
                 <TrendingUp size={20} className="text-emerald-700"/>
              </div>
              <div>
                <p className="font-bold text-emerald-900 text-base">دورة أرباح جديدة متاحة للتوزيع</p>
                <p className="text-sm text-emerald-700 mt-0.5">يوجد <span className="font-black font-currency mx-1">{formatCurrency(unallocatedProfit)}</span> أرباح صافية لم يتم توزيعها على محافظ الشركاء بعد.</p>
              </div>
           </div>
           <button onClick={handleDistributeProfits} className="w-full sm:w-auto px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg transition-colors shadow-sm">تخريج وتوزيع الأرباح</button>
        </div>
      )}

      {totalDebts > 0 && (
        <div className="bg-red-50 border border-red-100 rounded-xl p-4 flex items-start gap-3">
          <AlertCircle size={20} className="text-red-600 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-red-900">تنبيه بالديون المعلقة</p>
            <p className="text-sm text-red-700 mt-1">يوجد إجمالي ديون مسجلة على الشركاء بقيمة <span className="font-mono font-bold font-currency">{formatCurrency(totalDebts)}</span>. يرجى تسويتها لاحقاً أو خصمها من الأرباح.</p>
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-right">
            <thead className="bg-gray-50 text-gray-500 font-medium border-b border-gray-100">
              <tr>
                <th className="px-6 py-4">الشريك</th>
                <th className="px-6 py-4">حصة الربح</th>
                <th className="px-6 py-4">رأس المال المدفوع</th>
                <th className="px-6 py-4">المستحقات الحالية (أرباح)</th>
                <th className="px-6 py-4">الديون (ذمة)</th>
                <th className="px-6 py-4 text-center">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {myPartners.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50/70 transition-colors">
                  <td className="px-6 py-4">
                    <p className="font-bold text-gray-900">{p.name}</p>
                    <p className="text-xs text-gray-500 font-mono mt-0.5">{p.phone || 'بدون رقم'}</p>
                  </td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center justify-center bg-bunyan-50 text-bunyan-700 px-3 py-1 rounded-lg font-mono font-black border border-bunyan-100">
                      {p.profitPercentage}%
                    </span>
                  </td>
                  <td className="px-6 py-4 font-semibold text-gray-900 font-currency">{formatCurrency(p.capitalContribution)}</td>
                  <td className="px-6 py-4">
                    <span className="font-bold text-emerald-600 font-currency">{formatCurrency(p.walletBalance)}</span>
                  </td>
                  <td className="px-6 py-4">
                    {p.debtBalance > 0 ? (
                      <span className="text-sm font-bold text-red-600 font-currency bg-red-50 px-2 py-1 rounded-md">{formatCurrency(p.debtBalance)}</span>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex gap-2 justify-center">
                      <button onClick={() => setWithdrawId(p.id)} className="p-2 bg-gray-50 hover:bg-amber-50 rounded-lg text-gray-600 hover:text-amber-600 transition-colors shadow-sm" title="سحب أرباح"><HandCoins size={16} /></button>
                      <button onClick={() => openEdit(p)} className="p-2 bg-gray-50 hover:bg-bunyan-50 rounded-lg text-gray-600 hover:text-bunyan-600 transition-colors shadow-sm" title="تعديل"><Edit2 size={16} /></button>
                      <button onClick={() => setDeleteId(p.id)} className="p-2 bg-gray-50 hover:bg-red-50 rounded-lg text-gray-600 hover:text-red-600 transition-colors shadow-sm" title="حذف"><Trash2 size={16} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {myPartners.length === 0 && (
          <div className="text-center py-16">
            <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <Handshake size={28} className="text-gray-400" />
            </div>
            <p className="text-base font-bold text-gray-900 mb-1">لا يوجد شركاء مسجلين</p>
            <p className="text-sm text-gray-500">أضف شريكك الأول للبدء في توزيع الحصص والأرباح.</p>
          </div>
        )}
      </div>

      <SlideOver isOpen={slideOpen} onClose={() => { setSlideOpen(false); resetForm(); }} title={editingId ? 'تعديل بيانات الشريك' : 'إضافة شريك جديد'}>
        <div className="space-y-6 pb-20">
          
          <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 space-y-4">
            <h3 className="text-sm font-bold text-gray-900 pb-2 border-b border-gray-200 mb-2">المعلومات الأساسية</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">الاسم الكامل *</label>
                <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} 
                  className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-bunyan-500/30 focus:border-bunyan-500 transition-colors" placeholder="فادي أحمد" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">رقم الهاتف *</label>
                <input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} dir="ltr" 
                  className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-bunyan-500/30 focus:border-bunyan-500 transition-colors text-left" placeholder="09XXXXXXXX" />
              </div>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">البريد الإلكتروني *</label>
                <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} dir="ltr"
                  className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-bunyan-500/30 focus:border-bunyan-500 transition-colors text-left" placeholder="partner@domain.com" />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-700 mb-1.5 flex justify-between">كلمة المرور (للدخول) <button onClick={generatePassword} className="text-bunyan-600 hover:text-bunyan-800 text-[10px]"><Key size={12} className="inline mr-1"/>توليد عشوائي</button></label>
                <input type="text" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} dir="ltr"
                  className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-bunyan-500/30 focus:border-bunyan-500 transition-colors text-left" placeholder="********" />
              </div>
            </div>

            <label className="flex items-center gap-2 cursor-pointer mt-2 text-sm">
              <input type="checkbox" className="rounded text-bunyan-600 focus:ring-bunyan-500"
                checked={form.isActive} onChange={e => setForm({...form, isActive: e.target.checked})} />
              <span className={`font-bold ${form.isActive ? 'text-emerald-700' : 'text-gray-500'}`}>حالة الحساب: {form.isActive ? 'النشاط مفعّل' : 'مجمّد / متوقف'}</span>
            </label>
          </div>

          {/* دور الشريك والصلاحيات */}
          <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 space-y-4">
             <h3 className="text-sm font-bold text-gray-900 pb-2 border-b border-gray-200">دور الشريك في المنظومة (صلاحيات الدخول)</h3>
             <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
               <label className={`border rounded-xl p-3 cursor-pointer transition-all ${form.partnerRole === 'active_partner' ? 'bg-bunyan-50 border-bunyan-500 ring-1 ring-bunyan-500' : 'bg-white border-gray-200'}`}>
                 <input type="radio" className="sr-only" checked={form.partnerRole === 'active_partner'} onChange={() => setForm({...form, partnerRole: 'active_partner'})} />
                 <p className="font-bold text-sm text-gray-900 mb-1">شريك تشغيلي</p>
                 <p className="text-[10px] text-gray-500 leading-relaxed">صلاحيات كاملة للمنظومة (باستثناء الإعدادات والموارد البشرية)</p>
               </label>
               <label className={`border rounded-xl p-3 cursor-pointer transition-all ${form.partnerRole === 'silent_investor' ? 'bg-bunyan-50 border-bunyan-500 ring-1 ring-bunyan-500' : 'bg-white border-gray-200'}`}>
                 <input type="radio" className="sr-only" checked={form.partnerRole === 'silent_investor'} onChange={() => setForm({...form, partnerRole: 'silent_investor'})} />
                 <p className="font-bold text-sm text-gray-900 mb-1">مستثمر صامت</p>
                 <p className="text-[10px] text-gray-500 leading-relaxed">قراءة لوحة القيادة وتقارير الأرباح فقط (بدون أي عمليات)</p>
               </label>
               <label className={`border rounded-xl p-3 cursor-pointer transition-all ${form.partnerRole === 'custom' ? 'bg-bunyan-50 border-bunyan-500 ring-1 ring-bunyan-500' : 'bg-white border-gray-200'}`}>
                 <input type="radio" className="sr-only" checked={form.partnerRole === 'custom'} onChange={() => setForm({...form, partnerRole: 'custom'})} />
                 <p className="font-bold text-sm text-gray-900 mb-1">مُخصص</p>
                 <p className="text-[10px] text-gray-500 leading-relaxed">تحديد صلاحيات دقيقة جداً لكل وحدة على حدة</p>
               </label>
             </div>

             {form.partnerRole === 'custom' && (
               <div className="mt-4 pt-4 border-t border-gray-200 grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
                 <label className="flex items-center gap-2 cursor-pointer">
                   {form.customPerms.orders ? <CheckSquare className="text-bunyan-600" size={16}/> : <Square className="text-gray-400" size={16}/>}
                   <span className="text-gray-700">إدارة الطلبيات</span>
                   <input type="checkbox" className="sr-only" checked={form.customPerms.orders} onChange={e => setForm({...form, customPerms: {...form.customPerms, orders: e.target.checked}})} />
                 </label>
                 <label className="flex items-center gap-2 cursor-pointer">
                   {form.customPerms.inventory ? <CheckSquare className="text-bunyan-600" size={16}/> : <Square className="text-gray-400" size={16}/>}
                   <span className="text-gray-700">إدارة المخزون</span>
                   <input type="checkbox" className="sr-only" checked={form.customPerms.inventory} onChange={e => setForm({...form, customPerms: {...form.customPerms, inventory: e.target.checked}})} />
                 </label>
                 <label className="flex items-center gap-2 cursor-pointer">
                   {form.customPerms.delivery ? <CheckSquare className="text-bunyan-600" size={16}/> : <Square className="text-gray-400" size={16}/>}
                   <span className="text-gray-700">شركات التوصيل</span>
                   <input type="checkbox" className="sr-only" checked={form.customPerms.delivery} onChange={e => setForm({...form, customPerms: {...form.customPerms, delivery: e.target.checked}})} />
                 </label>
                 <label className="flex items-center gap-2 cursor-pointer">
                   {form.customPerms.treasury ? <CheckSquare className="text-bunyan-600" size={16}/> : <Square className="text-gray-400" size={16}/>}
                   <span className="text-gray-700">قراءة الخزينة</span>
                   <input type="checkbox" className="sr-only" checked={form.customPerms.treasury} onChange={e => setForm({...form, customPerms: {...form.customPerms, treasury: e.target.checked}})} />
                 </label>
                 <label className="flex items-center gap-2 cursor-pointer">
                   {form.customPerms.dashboard ? <CheckSquare className="text-bunyan-600" size={16}/> : <Square className="text-gray-400" size={16}/>}
                   <span className="text-gray-700">لوحة المتابعة</span>
                   <input type="checkbox" className="sr-only" checked={form.customPerms.dashboard} onChange={e => setForm({...form, customPerms: {...form.customPerms, dashboard: e.target.checked}})} />
                 </label>
               </div>
             )}
          </div>

          <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 space-y-4">
            <h3 className="text-sm font-bold text-gray-900 pb-2 border-b border-gray-200">البيانات المالية المشتركة</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-gray-700 mb-1.5 flex justify-between">
                  <span>حجم رأس المال المدفوع من قبله</span>
                </label>
                <div className="relative">
                  <input type="number" min={0} value={form.capitalContribution} onChange={(e) => setForm({ ...form, capitalContribution: Number(e.target.value) })} 
                    className="w-full pr-4 pl-12 py-2 bg-white border border-gray-200 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-bunyan-500/30 focus:border-bunyan-500 transition-colors" />
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400">د.ل</span>
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-gray-700 mb-1.5 flex justify-between">
                  <span>نسبة الربح المستحقة له (%) *</span>
                  <span className={`text-xs font-black ${totalPercentage - (editingId ? (myPartners.find(p => p.id === editingId)?.profitPercentage || 0) : 0) + form.profitPercentage > 100 ? 'text-red-500' : 'text-emerald-600'}`}>
                    المتبقي إجمالاً: {Math.max(0, 100 - (totalPercentage - (editingId ? (myPartners.find(p => p.id === editingId)?.profitPercentage || 0) : 0) + form.profitPercentage))}%
                  </span>
                </label>
                <div className="relative">
                  <input type="number" min={0} max={100} value={form.profitPercentage} onChange={(e) => setForm({ ...form, profitPercentage: Number(e.target.value) })} 
                    className="w-full pr-4 pl-10 py-2 bg-white border border-gray-200 rounded-xl text-sm font-mono font-bold focus:outline-none focus:ring-2 focus:ring-bunyan-500/30 focus:border-bunyan-500 transition-colors text-bunyan-700" />
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-bold text-gray-400">%</span>
                </div>
              </div>
            </div>
          </div>

          <div className="fixed bottom-0 left-0 w-full sm:w-[500px] p-4 bg-white border-t border-gray-100 z-10 hidden sm:block">
            <button onClick={handleSave} className="w-full py-3 bg-bunyan-600 text-white font-bold rounded-xl hover:bg-bunyan-700 transition-all text-sm shadow-md">
              {editingId ? 'حفظ التعديلات' : 'حفظ وإضافة الشريك'}
            </button>
          </div>
          <button onClick={handleSave} className="sm:hidden w-full py-3 bg-bunyan-600 text-white font-bold rounded-xl hover:bg-bunyan-700 transition-all text-sm shadow-md mt-6">
            {editingId ? 'حفظ التعديلات' : 'حفظ وإضافة الشريك'}
          </button>
        </div>
      </SlideOver>

      {/* نافذة سحب الأرباح */}
      <SlideOver isOpen={!!withdrawId} onClose={() => { setWithdrawId(null); setWithdrawAmount(''); }} title={`سحب أرباح: ${myPartners.find(p => p.id === withdrawId)?.name || ''}`}>
        <div className="space-y-6 pb-20 p-4">
          <div className="bg-amber-50 rounded-xl p-4 border border-amber-100 flex items-start gap-3">
             <AlertCircle size={20} className="text-amber-600 mt-0.5 shrink-0" />
             <div>
               <p className="text-sm font-bold text-amber-900">سحب من المحفظة</p>
               <p className="text-xs text-amber-700 leading-relaxed mt-1">
                 سيتم خصم هذا المبلغ من (الرصيد المتاح للسحب) للشريك المحدد، وسيُسجل في "الخزينة" كحركة مصروفات (توزيع أرباح). تأكد من وجود نقدية كافية في درج المتجر الفعلي.
               </p>
             </div>
          </div>
          
          <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 space-y-4">
            
            {myPartners.find(p => p.id === withdrawId)?.debtBalance ? (
              <div className="bg-red-50 border border-red-200 p-3 rounded-xl mb-4">
                <p className="text-sm font-bold text-red-900 mb-2">تنبيه: على هذا الشريك ديون متأخرة بقيمة {formatCurrency(myPartners.find(p => p.id === withdrawId)?.debtBalance || 0)}</p>
                <label className="flex items-center gap-2 cursor-pointer text-sm font-semibold text-red-800">
                  <input type="checkbox" className="rounded border-red-300 text-red-600 focus:ring-red-500"
                    checked={withdrawDeductDebt} onChange={e => setWithdrawDeductDebt(e.target.checked)} />
                  خصم الدين من المبلغ المسحوب وتصفريته
                </label>
              </div>
            ) : null}

            <div>
              <label className="flex text-xs font-bold text-gray-700 mb-1.5 justify-between">
                <span>المبلغ المراد سحبه *</span>
                <span className="text-amber-600">المتاح للسحب: {formatCurrency(myPartners.find(p => p.id === withdrawId)?.walletBalance || 0)}</span>
              </label>
              <div className="flex items-center gap-2 relative">
                <input type="number" min={1} max={myPartners.find(p => p.id === withdrawId)?.walletBalance} 
                  value={withdrawAmount} onChange={(e) => setWithdrawAmount(Number(e.target.value))} 
                  className="w-full pr-4 pl-12 py-3 bg-white border border-gray-200 rounded-xl text-base font-mono focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 transition-colors" placeholder="0.00" />
                <span className="absolute left-[80px] top-1/2 -translate-y-1/2 text-sm font-bold text-gray-400">د.ل</span>
                
                <button onClick={() => setWithdrawAmount(myPartners.find(p => p.id === withdrawId)?.walletBalance || 0)}
                  className="shrink-0 px-4 py-3 bg-bunyan-50 text-bunyan-700 font-bold rounded-xl whitespace-nowrap text-sm border border-bunyan-200 hover:bg-bunyan-100 transition-colors">
                  سحب الكل
                </button>
              </div>
            </div>
            
            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">تاريخ الحركة</label>
                <input type="date" value={withdrawDate} onChange={(e) => setWithdrawDate(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-bunyan-500/30 focus:border-bunyan-500 transition-colors" />
              </div>
              
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">بيان / ملاحظة على السحب</label>
                <textarea rows={2} value={withdrawNote} onChange={(e) => setWithdrawNote(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-bunyan-500/30 focus:border-bunyan-500 transition-colors resize-none" placeholder="اكتب ملاحظة كمرجع..." />
              </div>
            </div>

            <button onClick={handleWithdraw} className="w-full py-3 bg-amber-600 text-white font-bold rounded-xl hover:bg-amber-700 transition-all text-sm shadow-md mt-4 flex justify-center items-center gap-2">
              <HandCoins size={18} /> تأكيد السحب {withdrawDeductDebt ? 'وخصم الدين' : ''}
            </button>
          </div>
        </div>
      </SlideOver>

      <ConfirmDialog isOpen={!!deleteId} onCancel={() => setDeleteId(null)} onConfirm={() => { if (deleteId) { const res = deletePartner(deleteId); setDeleteId(null); if (res.success) showToast('تم حذف الشريك بنجاح', 'success'); else showToast(res.error || 'لا يمكن الحذف', 'error'); } }} title="حذف الشريك نهائياً" message="هل أنت متأكد من حذف هذا الشريك؟ سيتم حذف بياناته لكن الحركات المتعلقة قد تبقى في السجل للمحاسبة." variant="danger" />
    </div>
  );
}
