'use client';

import { useState, useMemo } from 'react';
import { useUser } from '@/core/auth/hooks';
import {
  useAllPartners, useAllOrders, useAllTransactions, useGetForTenant,
  useAddPartner, useUpdatePartner, useDeletePartner, useAddUser,
  useWithdrawPartnerFunds, useDistributeProfits
} from '@/core/db/hooks';
import { formatCurrency } from '@/shared/utils/format';
import { SlideOver } from '@/shared/components/ui/SlideOver';
import { ConfirmDialog } from '@/shared/components/ui/ConfirmDialog';
import { EmptyState } from '@/shared/components/ui/EmptyState';
import { useToast } from '@/shared/components/ui/Toast';
import {
  Handshake, Plus, Trash2, Edit2, TrendingUp, AlertCircle,
  PiggyBank, Briefcase, HandCoins, Key, MoreVertical
} from 'lucide-react';
import type { Partner, Order, TreasuryTransaction, UserPermissions } from '@/core/db/seed';
import { PARTNER_PERMISSIONS } from '@/core/db/seed';

// Toggle Switch — بديل Checkbox في الصلاحيات
function ToggleSwitch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-sm text-gray-700">{label}</span>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
          checked ? 'bg-bunyan-600' : 'bg-gray-300'
        }`}
      >
        <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
          checked ? 'translate-x-4' : 'translate-x-1'
        }`} />
      </button>
    </div>
  );
}

export default function PartnersPage() {
  const user = useUser();
  const partners = useAllPartners();
  const orders = useAllOrders();
  const transactions = useAllTransactions();
  const getForTenant = useGetForTenant();
  const addPartner = useAddPartner();
  const updatePartner = useUpdatePartner();
  const deletePartner = useDeletePartner();
  const addUser = useAddUser();
  const withdrawPartnerFunds = useWithdrawPartnerFunds();
  const distributeProfits = useDistributeProfits();
  const { showToast } = useToast();

  const tid = user?.tenantId || '';
  const myPartners = useMemo(() => getForTenant(partners, tid), [partners, tid, getForTenant]);

  const totalCapital    = myPartners.reduce((s, p) => s + p.capitalContribution, 0);
  const totalDues       = myPartners.reduce((s, p) => s + p.walletBalance, 0);
  const totalDebts      = myPartners.reduce((s, p) => s + p.debtBalance, 0);
  const totalPercentage = myPartners.reduce((s, p) => s + p.profitPercentage, 0);

  const myOrders: Order[] = useMemo(
    () => getForTenant(orders, tid).filter(o => o.status === 'delivered'),
    [orders, tid, getForTenant]
  );
  const totalRevenue = myOrders.reduce((s, o) => s + o.total, 0);
  const totalCost = myOrders.reduce((s, o) => s + o.items.reduce((is, it) => is + it.unitCost * it.quantity, 0), 0);
  const myExpenses: TreasuryTransaction[] = getForTenant(transactions, tid).filter(t => t.transactionType === 'expense');
  const totalExpenses = myExpenses.reduce((s, t) => s + Math.abs(t.amount), 0);
  const totalNetProfit = totalRevenue - totalCost - totalExpenses;
  const myDistLogs: TreasuryTransaction[] = getForTenant(transactions, tid).filter(t => t.transactionType === 'profit_distribution_record');
  const totalProfitProcessed = myDistLogs.reduce((s, t) => s + Math.abs(t.amount), 0);
  const unallocatedProfit = totalNetProfit - totalProfitProcessed;

  const [slideOpen, setSlideOpen]   = useState(false);
  const [editingId, setEditingId]   = useState<string | null>(null);
  const [deleteId, setDeleteId]     = useState<string | null>(null);
  const [withdrawId, setWithdrawId] = useState<string | null>(null);
  const [withdrawAmount, setWithdrawAmount] = useState<number | string>('');
  const [withdrawDeductDebt, setWithdrawDeductDebt] = useState(false);
  const [withdrawDate, setWithdrawDate] = useState(new Date().toISOString().split('T')[0]);
  const [withdrawNote, setWithdrawNote] = useState('');
  const [openMenu, setOpenMenu] = useState<string | null>(null);

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
      ...form, name: p.name, phone: p.phone, email: p.email || '', password: '',
      isActive: p.isActive, partnerRole: p.partnerRole || 'active_partner',
      profitPercentage: p.profitPercentage, capitalContribution: p.capitalContribution
    });
    setEditingId(p.id); setSlideOpen(true);
  };

  const generatePassword = () => {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
    let p = '';
    for (let i = 0; i < 10; i++) p += chars.charAt(Math.floor(Math.random() * chars.length));
    setForm({ ...form, password: p });
  };

  const handleSave = () => {
    if (!form.name || !form.email) { showToast('يرجى ملء الاسم والبريد الإلكتروني', 'error'); return; }
    const oldPct = editingId ? (myPartners.find(p => p.id === editingId)?.profitPercentage || 0) : 0;
    if (totalPercentage - oldPct + form.profitPercentage > 100) {
      showToast('مجموع نسب الشركاء لا يمكن تجاوز 100%', 'error'); return;
    }
    if (editingId) {
      updatePartner(editingId, {
        name: form.name, phone: form.phone, email: form.email,
        isActive: form.isActive, partnerRole: form.partnerRole,
        profitPercentage: form.profitPercentage, capitalContribution: form.capitalContribution
      });
      showToast('تم تحديث بيانات الشريك', 'success');
    } else {
      const ptrId = `ptr-${Date.now()}`;
      addPartner({
        id: ptrId, tenantId: tid, name: form.name, phone: form.phone, email: form.email,
        profitPercentage: form.profitPercentage, capitalContribution: form.capitalContribution,
        partnerRole: form.partnerRole, isActive: form.isActive,
        walletBalance: 0, debtBalance: 0, joinedAt: new Date().toISOString().split('T')[0],
      });
      const passToUse = form.password || '123456';
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
        email: form.email, passwordHash: passToUse, role: 'partner',
        permissions: perms, isActive: form.isActive,
        createdAt: new Date().toISOString().split('T')[0], phone: form.phone
      });
      showToast(`تمت إضافة الشريك — كلمة المرور: ${passToUse}`, 'success');
    }
    setSlideOpen(false); resetForm();
  };

  const handleWithdraw = () => {
    const amt = Number(withdrawAmount);
    if (!withdrawId || amt <= 0) { showToast('يرجى إدخال مبلغ صحيح', 'error'); return; }
    const partner = myPartners.find(p => p.id === withdrawId);
    if (!partner) return;
    const debtToDeduct = (withdrawDeductDebt && partner.debtBalance > 0) ? Math.min(partner.debtBalance, amt) : 0;
    const res = withdrawPartnerFunds(withdrawId, amt, {
      description: withdrawNote || 'سحب أرباح',
      deductDebt: withdrawDeductDebt, transactionDate: withdrawDate
    });
    if (res.success) {
      showToast(`تم سحب ${formatCurrency(amt - debtToDeduct)} بنجاح`, 'success');
      setWithdrawId(null); setWithdrawAmount(''); setWithdrawNote(''); setWithdrawDeductDebt(false);
    } else {
      showToast(res.error || 'حدث خطأ غير متوقع', 'error');
    }
  };

  const handleDistributeProfits = () => {
    if (unallocatedProfit <= 0) { showToast('لا توجد أرباح غير موزعة', 'error'); return; }
    const result = distributeProfits(tid, unallocatedProfit);
    if (result.success) showToast(`تم توزيع ${formatCurrency(unallocatedProfit)} على المحافظ ✅`, 'success');
    else showToast(result.error || 'حدث خطأ', 'error');
  };

  return (
    <div className="space-y-6 animate-fade-in pb-10" onClick={() => setOpenMenu(null)}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900">الشركاء والمستثمرون</h1>
          <p className="text-sm text-gray-500 mt-1">إدارة حصص الشركاء والمبالغ المستحقة</p>
        </div>
        <div className="flex items-center gap-2">
          {unallocatedProfit > 0 && user?.role === 'owner' && (
            <button onClick={handleDistributeProfits}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700
                text-white rounded-xl text-sm font-bold transition-all shadow-sm">
              <TrendingUp size={16} /> توزيع الأرباح
            </button>
          )}
          <button onClick={() => { resetForm(); setSlideOpen(true); }}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-bunyan-600 hover:bg-bunyan-700
              text-white rounded-xl text-sm font-bold transition-all shadow-sm">
            <Plus size={16} /> إضافة شريك
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: 'عدد الشركاء', value: myPartners.length, icon: Briefcase, color: 'text-bunyan-600', bg: 'bg-bunyan-50', numeric: false },
          { label: 'إجمالي رأس المال', value: formatCurrency(Math.round(totalCapital)), icon: PiggyBank, color: 'text-blue-600', bg: 'bg-blue-50', numeric: false },
          { label: 'إجمالي المستحقات', value: formatCurrency(Math.round(totalDues)), icon: TrendingUp, color: 'text-emerald-600', bg: 'bg-emerald-50', numeric: false },
        ].map(kpi => (
          <div key={kpi.label} className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm
            hover:shadow-md transition-all flex items-center gap-4">
            <div className={`w-12 h-12 ${kpi.bg} rounded-xl flex items-center justify-center shrink-0`}>
              <kpi.icon className={`w-6 h-6 ${kpi.color}`} />
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-0.5">{kpi.label}</p>
              <p className={`text-xl font-black ${kpi.color}`}>{kpi.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Profit Distribution Banner */}
      {unallocatedProfit > 0 && user?.role === 'owner' && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-center
          justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-emerald-100 rounded-xl flex items-center justify-center">
              <TrendingUp size={18} className="text-emerald-700" />
            </div>
            <div>
              <p className="font-bold text-emerald-900 text-sm">دورة أرباح جديدة متاحة</p>
              <p className="text-xs text-emerald-700">
                <span className="font-black">{formatCurrency(Math.round(unallocatedProfit))}</span> أرباح صافية لم تُوزّع بعد
              </p>
            </div>
          </div>
          <button onClick={handleDistributeProfits}
            className="shrink-0 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white
              font-bold rounded-xl text-sm transition-all">
            تخريج وتوزيع
          </button>
        </div>
      )}

      {/* Debts Alert */}
      {totalDebts > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
          <AlertCircle size={18} className="text-red-600 shrink-0" />
          <p className="text-sm text-red-800">
            <span className="font-bold">تنبيه:</span> إجمالي ديون الشركاء{' '}
            <span className="font-black font-mono">{formatCurrency(Math.round(totalDebts))}</span>
          </p>
        </div>
      )}

      {/* Profit Bar */}
      {myPartners.length > 0 && (
        <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
          <div className="flex justify-between items-center mb-2">
            <p className="text-sm font-bold text-gray-700">توزيع نسب الأرباح</p>
            <p className={`text-sm font-black ${
              totalPercentage > 100 ? 'text-red-600' : totalPercentage === 100 ? 'text-emerald-600' : 'text-blue-600'
            }`}>
              {totalPercentage}% / المتبقي {Math.max(0, 100 - totalPercentage)}%
            </p>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-3 flex overflow-hidden">
            {myPartners.map((p, i) => (
              <div key={p.id} className="h-full relative group border-l border-white/20"
                style={{ width: `${p.profitPercentage}%`, backgroundColor: `hsl(${(i * 137.5) % 360}, 65%, 50%)` }}>
                <div className="absolute bottom-full mb-1.5 hidden group-hover:block bg-gray-900
                  text-white text-[10px] px-2 py-1 rounded-lg whitespace-nowrap z-10
                  left-1/2 -translate-x-1/2">
                  {p.name}: {p.profitPercentage}%
                </div>
              </div>
            ))}
            {totalPercentage < 100 && (
              <div className="h-full bg-gray-200" style={{ width: `${100 - totalPercentage}%` }} />
            )}
          </div>
        </div>
      )}

      {/* Partners Table */}
      {myPartners.length === 0 ? (
        <EmptyState
          icon={<Handshake className="w-8 h-8 text-gray-400" />}
          title="لا يوجد شركاء مسجلون"
          description="أضف شريكك الأول لبدء توزيع الحصص والأرباح"
        />
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead className="bg-gray-50/70 border-b border-gray-100">
                <tr className="text-xs text-gray-400">
                  <th className="px-6 py-3.5 font-semibold">الشريك</th>
                  <th className="px-6 py-3.5 font-semibold">الحصة</th>
                  <th className="px-6 py-3.5 font-semibold">رأس المال</th>
                  <th className="px-6 py-3.5 font-semibold text-emerald-600">المستحقات</th>
                  <th className="px-6 py-3.5 font-semibold text-red-600">الديون</th>
                  <th className="px-6 py-3.5 font-semibold text-center">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {myPartners.map(p => (
                  <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50/60 transition-colors">
                    <td className="px-6 py-4">
                      <p className="font-bold text-gray-900">{p.name}</p>
                      <p className="text-xs text-gray-400 font-mono">{p.phone || '—'}</p>
                    </td>
                    <td className="px-6 py-4">
                      <span className="bg-bunyan-50 text-bunyan-700 border border-bunyan-100
                        px-2.5 py-1 rounded-lg font-mono font-black text-xs">
                        {p.profitPercentage}%
                      </span>
                    </td>
                    <td className="px-6 py-4 font-semibold text-gray-900 font-mono text-xs">
                      {formatCurrency(p.capitalContribution)}
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-emerald-700 font-black font-mono text-sm">
                        {formatCurrency(p.walletBalance)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {p.debtBalance > 0 ? (
                        <span className="text-red-700 font-bold bg-red-50 px-2 py-0.5 rounded text-xs font-mono">
                          {formatCurrency(p.debtBalance)}
                        </span>
                      ) : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-center gap-2">
                        {/* Primary Action — سحب الأرباح */}
                        <button onClick={() => setWithdrawId(p.id)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-50
                            text-amber-700 hover:bg-amber-100 border border-amber-200 rounded-lg
                            text-xs font-bold transition-colors">
                          <HandCoins size={13} /> سحب
                        </button>
                        {/* Kebab Menu */}
                        <div className="relative" onClick={e => e.stopPropagation()}>
                          <button
                            onClick={() => setOpenMenu(openMenu === p.id ? null : p.id)}
                            className="w-7 h-7 flex items-center justify-center rounded-lg
                              hover:bg-gray-100 text-gray-400 transition-colors">
                            <MoreVertical size={14} />
                          </button>
                          {openMenu === p.id && (
                            <div className="absolute left-0 top-full mt-1 w-36 bg-white border
                              border-gray-200 rounded-xl shadow-lg z-20 overflow-hidden">
                              <button onClick={() => { openEdit(p); setOpenMenu(null); }}
                                className="w-full flex items-center gap-2 px-3 py-2.5 text-sm
                                  text-gray-700 hover:bg-gray-50 text-right">
                                <Edit2 size={13} /> تعديل
                              </button>
                              <button onClick={() => { setDeleteId(p.id); setOpenMenu(null); }}
                                className="w-full flex items-center gap-2 px-3 py-2.5 text-sm
                                  text-red-600 hover:bg-red-50 text-right">
                                <Trash2 size={13} /> حذف
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add / Edit SlideOver */}
      <SlideOver isOpen={slideOpen} onClose={() => { setSlideOpen(false); resetForm(); }}
        title={editingId ? 'تعديل بيانات الشريك' : 'إضافة شريك جديد'}>
        <div className="space-y-5 p-1">
          {/* Info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1.5">الاسم الكامل *</label>
              <input type="text" value={form.name} onChange={e => setForm({...form, name: e.target.value})}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm
                  focus:outline-none focus:ring-2 focus:ring-bunyan-500/30"
                placeholder="اسم الشريك" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1.5">رقم الهاتف</label>
              <input type="tel" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})}
                dir="ltr" className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm
                  font-mono text-left focus:outline-none focus:ring-2 focus:ring-bunyan-500/30"
                placeholder="09XXXXXXXX" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1.5">البريد الإلكتروني *</label>
              <input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})}
                dir="ltr" className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm
                  text-left focus:outline-none focus:ring-2 focus:ring-bunyan-500/30"
                placeholder="partner@domain.com" />
            </div>
            <div>
              <label className="flex justify-between text-xs font-bold text-gray-700 mb-1.5">
                <span>كلمة المرور</span>
                <button onClick={generatePassword} className="text-bunyan-600 text-[10px] flex items-center gap-1">
                  <Key size={10} /> توليد
                </button>
              </label>
              <input type="text" value={form.password} onChange={e => setForm({...form, password: e.target.value})}
                dir="ltr" className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm
                  font-mono text-left focus:outline-none focus:ring-2 focus:ring-bunyan-500/30"
                placeholder="*******" />
            </div>
          </div>

          {/* حالة الحساب — Toggle Switch */}
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-200">
            <span className="text-sm font-bold text-gray-700">حالة الحساب</span>
            <button type="button" onClick={() => setForm({...form, isActive: !form.isActive})}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                form.isActive ? 'bg-emerald-500' : 'bg-gray-300'
              }`}>
              <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
                form.isActive ? 'translate-x-4' : 'translate-x-1'
              }`} />
            </button>
          </div>

          {/* دور الشريك */}
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-2">دور الشريك</label>
            <div className="grid grid-cols-3 gap-2">
              {([
                ['active_partner', 'تشغيلي', 'صلاحيات كاملة'],
                ['silent_investor', 'صامت', 'تقارير فقط'],
                ['custom', 'مُخصص', 'تحديد يدوي'],
              ] as const).map(([v, l, desc]) => (
                <button key={v} type="button" onClick={() => setForm({...form, partnerRole: v})}
                  className={`text-right p-2.5 rounded-xl border-2 transition-all ${
                    form.partnerRole === v
                      ? 'border-bunyan-500 bg-bunyan-50'
                      : 'border-gray-200 bg-white hover:border-gray-300'
                  }`}>
                  <p className="font-bold text-xs text-gray-900 mb-0.5">{l}</p>
                  <p className="text-[9px] text-gray-500">{desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Custom Permissions — Toggle Switches */}
          {form.partnerRole === 'custom' && (
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 space-y-1">
              <p className="text-xs font-bold text-gray-700 mb-2">الصلاحيات</p>
              {[
                ['orders', 'إدارة الطلبيات'],
                ['inventory', 'إدارة المخزون'],
                ['delivery', 'شركات التوصيل'],
                ['treasury', 'قراءة الخزينة'],
                ['dashboard', 'لوحة المتابعة'],
              ].map(([k, lbl]) => (
                <ToggleSwitch
                  key={k} label={lbl}
                  checked={form.customPerms[k as keyof typeof form.customPerms]}
                  onChange={v => setForm({...form, customPerms: {...form.customPerms, [k]: v}})}
                />
              ))}
            </div>
          )}

          {/* Financial */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1.5">رأس المال المدفوع</label>
              <div className="relative">
                <input type="number" min={0} value={form.capitalContribution}
                  onChange={e => setForm({...form, capitalContribution: Number(e.target.value)})}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm font-mono
                    focus:outline-none focus:ring-2 focus:ring-bunyan-500/30 pl-12" />
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 font-bold">د.ل</span>
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1.5">نسبة الربح % *</label>
              <div className="relative">
                <input type="number" min={0} max={100} value={form.profitPercentage}
                  onChange={e => setForm({...form, profitPercentage: Number(e.target.value)})}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm font-mono
                    font-black text-bunyan-700 focus:outline-none focus:ring-2
                    focus:ring-bunyan-500/30 pl-10" />
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 font-bold">%</span>
              </div>
            </div>
          </div>

          <button onClick={handleSave}
            className="w-full py-3 bg-bunyan-600 hover:bg-bunyan-700 text-white rounded-xl
              font-bold text-sm transition-all shadow-sm">
            {editingId ? '💾 حفظ التعديلات' : '+ حفظ وإضافة الشريك'}
          </button>
        </div>
      </SlideOver>

      {/* Withdraw SlideOver */}
      <SlideOver
        isOpen={!!withdrawId}
        onClose={() => { setWithdrawId(null); setWithdrawAmount(''); }}
        title={`سحب أرباح — ${myPartners.find(p => p.id === withdrawId)?.name ?? ''}`}
      >
        <div className="space-y-5 p-1">
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
            <AlertCircle size={18} className="text-amber-600 mt-0.5 shrink-0" />
            <p className="text-xs text-amber-700 leading-relaxed">
              سيتم خصم المبلغ من محفظة الشريك وتسجيله في الخزينة كمصروف توزيع أرباح.
            </p>
          </div>

          {myPartners.find(p => p.id === withdrawId)?.debtBalance ? (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3">
              <p className="text-sm font-bold text-red-900 mb-2">
                دين معلق: {formatCurrency(myPartners.find(p => p.id === withdrawId)?.debtBalance || 0)}
              </p>
              <div className="flex items-center justify-between">
                <span className="text-sm text-red-800">خصم الدين من المبلغ المسحوب</span>
                <button type="button" onClick={() => setWithdrawDeductDebt(!withdrawDeductDebt)}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                    withdrawDeductDebt ? 'bg-red-500' : 'bg-gray-300'
                  }`}>
                  <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
                    withdrawDeductDebt ? 'translate-x-4' : 'translate-x-1'
                  }`} />
                </button>
              </div>
            </div>
          ) : null}

          <div>
            <label className="flex text-xs font-bold text-gray-700 mb-1.5 justify-between">
              <span>المبلغ المراد سحبه *</span>
              <span className="text-amber-600 font-mono">
                المتاح: {formatCurrency(myPartners.find(p => p.id === withdrawId)?.walletBalance || 0)}
              </span>
            </label>
            <div className="relative">
              <input type="number" min={1}
                value={withdrawAmount}
                onChange={e => setWithdrawAmount(Number(e.target.value))}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl text-lg font-mono
                  font-black text-left focus:outline-none focus:ring-2 focus:ring-amber-500/30
                  focus:border-amber-400 pl-14"
                placeholder="0" dir="ltr" />
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-bold text-gray-400">
                د.ل
              </span>
            </div>
            <button
              onClick={() => setWithdrawAmount(myPartners.find(p => p.id === withdrawId)?.walletBalance || 0)}
              className="mt-2 w-full py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 border
                border-amber-200 rounded-xl text-xs font-bold transition-colors">
              سحب الكل
            </button>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1.5">تاريخ الحركة</label>
            <input type="date" value={withdrawDate} onChange={e => setWithdrawDate(e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm
                focus:outline-none focus:ring-2 focus:ring-bunyan-500/30" />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1.5">ملاحظة (اختياري)</label>
            <textarea rows={2} value={withdrawNote} onChange={e => setWithdrawNote(e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm resize-none
                focus:outline-none focus:ring-2 focus:ring-bunyan-500/30"
              placeholder="اكتب ملاحظة كمرجع..." />
          </div>

          <button onClick={handleWithdraw}
            className="w-full py-3 bg-amber-600 hover:bg-amber-700 text-white rounded-xl
              font-bold text-sm transition-all flex items-center justify-center gap-2">
            <HandCoins size={16} /> تأكيد السحب {withdrawDeductDebt ? 'وخصم الدين' : ''}
          </button>
        </div>
      </SlideOver>

      <ConfirmDialog
        isOpen={!!deleteId}
        onCancel={() => setDeleteId(null)}
        onConfirm={async () => {
          if (deleteId) {
            const res = await deletePartner(deleteId);
            setDeleteId(null);
            if (res.success) showToast('تم حذف الشريك', 'success');
            else showToast(res.error || 'لا يمكن الحذف', 'error');
          }
        }}
        title="حذف الشريك نهائياً"
        message="هل أنت متأكد؟ سيتم حذف بيانات الشريك."
        variant="danger"
      />
    </div>
  );
}
