'use client';

import { useState, useMemo } from 'react';
import { useUser } from '@/core/auth/hooks';
import { useDebtsQuery, useCustomersQuery, useEmployeesQuery, usePartnersQuery } from '@/core/db/hooks/useDebts';
import { useTreasuryQuery } from '@/core/db/hooks/useTreasury';
import { useQueryClient } from '@tanstack/react-query';
import { useGetForTenant, useAddDebt, useUpdateDebt } from '@/core/db/hooks';
import { formatCurrency, formatDate } from '@/shared/utils/format';
import { SlideOver } from '@/shared/components/ui/SlideOver';
import { ConfirmDialog } from '@/shared/components/ui/ConfirmDialog';
import { useToast } from '@/shared/components/ui/Toast';
import { FileText, Plus, CheckCircle2, Banknote, CalendarDays, Edit2, AlertTriangle, Eye, ArrowUpCircle, ArrowDownCircle } from 'lucide-react';
import type { Debt } from '@/core/types';

const CATEGORY_LABELS: Record<string, string> = {
  custody: 'عهدة', partner_advance: 'سحبة شريك', employee_advance: 'سلفة موظف',
  supplier: 'مورد', customer: 'زبون',
};

export default function DebtsPage() {
  const user = useUser();
  const tid = user?.tenantId || '';
  const queryClient = useQueryClient();

  const { data: debts = [], isLoading: isDebtsLoading } = useDebtsQuery(tid);
  const { data: treasuryData } = useTreasuryQuery(tid);
  const treasury = treasuryData?.accounts || [];
  const { data: customers = [] } = useCustomersQuery(tid);
  const { data: employees = [] } = useEmployeesQuery(tid);
  const { data: partners = [] } = usePartnersQuery(tid);

  const getForTenant = useGetForTenant();
  const addDebt = useAddDebt();
  const updateDebt = useUpdateDebt();
  const { showToast } = useToast();
  
  const myDebts = debts;
  const myTreasury = treasury;
  const myCustomers = customers;
  const myEmployees = employees.filter(e => e.isActive);
  const myPartners = partners.filter(p => p.isActive);

  const cashAccount = myTreasury.find(a => a.accountType === 'cash_in_hand');
  
  const [filter, setFilter] = useState<'all' | 'internal' | 'external'>('all');
  
  // Slide Over States
  const [paySlide, setPaySlide] = useState<string | null>(null);
  const [payAmount, setPayAmount] = useState<string | number>('');
  
  const [addSlide, setAddSlide] = useState(false);
  const [editingDebtId, setEditingDebtId] = useState<string | null>(null);
  
  const [historySlide, setHistorySlide] = useState<Debt | null>(null);

  const [form, setForm] = useState({
    debtType: 'external' as 'internal' | 'external',
    debtCategory: 'supplier' as Debt['debtCategory'],
    linkedEntityId: '', linkedEntityName: '', linkedEntityType: 'supplier' as Debt['linkedEntityType'], 
    amount: '' as number | string, dueDate: '', description: '',
    sourceReference: ''
  });

  const filtered = filter === 'all' ? myDebts : myDebts.filter((d) => d.debtType === filter);
  
  // calculations:
  // ديون علينا (للموردين) - الخصوم
  const totalLiabilities = myDebts.filter(d => d.debtCategory === 'supplier' && d.status !== 'paid').reduce((s, d) => s + (d.amount - d.paidAmount), 0);
  // ديون لنا (من الزبائن، الموظفين، الشركاء والعهد) - الأصول
  const totalAssets = myDebts.filter(d => d.debtCategory !== 'supplier' && d.status !== 'paid').reduce((s, d) => s + (d.amount - d.paidAmount), 0);

  const totalInternal = myDebts.filter((d) => d.debtType === 'internal' && d.status !== 'paid').reduce((s, d) => s + (d.amount - d.paidAmount), 0);
  const totalExternal = myDebts.filter((d) => d.debtType === 'external' && d.status !== 'paid').reduce((s, d) => s + (d.amount - d.paidAmount), 0);

  const supplierNames = Array.from(new Set(myDebts.filter(d => d.debtCategory === 'supplier').map((d: Debt) => d.linkedEntityName)));

  const resetForm = () => {
    setForm({ debtType: 'external', debtCategory: 'supplier', linkedEntityId: '', linkedEntityName: '', linkedEntityType: 'supplier', amount: '', dueDate: '', description: '', sourceReference: '' });
    setEditingDebtId(null);
  };

  const handlePay = () => {
    const amt = Number(payAmount);
    if (!paySlide || amt <= 0) return;
    
    const debt = myDebts.find((d) => d.id === paySlide);
    if (debt && amt > (debt.amount - debt.paidAmount)) {
      showToast('عذراً، المبلغ المدخل يتجاوز الرصيد المتبقي للدين', 'error');
      return;
    }

    const isIncome = debt ? ['customer', 'employee_advance', 'partner_advance', 'custody'].includes(debt.debtCategory) : false;

    // استخدام الـ API الجديد لعملية ذرية (Atomic)
    fetch('/api/debts/pay', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        debtId: paySlide,
        amount: amt,
        tenantId: tid,
        accountId: cashAccount?.id,
        description: `سداد دين: ${debt?.linkedEntityName} ${debt?.sourceReference ? `(${debt?.sourceReference})` : ''}`,
        createdBy: user?.fullName || user?.email
      })
    })
    .then(async (res) => {
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'فشل سداد الدين');
      
      showToast(`تم سداد ${formatCurrency(amt)} بنجاح`, 'success');
      queryClient.invalidateQueries({ queryKey: ['debts', tid] });
      queryClient.invalidateQueries({ queryKey: ['treasury', tid] });
      setPaySlide(null);
      setPayAmount('');
    })
    .catch((err) => {
      showToast(err.message || 'حدث خطأ أثناء السداد', 'error');
    });
  };

  const handleSaveDebt = () => {
    const amt = Number(form.amount);
    if (!form.linkedEntityName || amt <= 0) {
      showToast('يرجى ملء اسم الطرف والمبلغ بشكل صحيح', 'error');
      return;
    }

    if (editingDebtId) {
      const existing = myDebts.find(d => d.id === editingDebtId);
      if (existing && amt < existing.paidAmount) {
         showToast(`لا يمكن تقليل قيمة الدين لأن المبلغ المسدد (${formatCurrency(existing.paidAmount)}) يتجاوز القيمة الجديدة`, 'error');
         return;
      }
      updateDebt(editingDebtId, { ...form, amount: amt }).then(() => {
        queryClient.invalidateQueries({ queryKey: ['debts', tid] });
        showToast('تم تحديث بيانات الدين بنجاح', 'success');
      });
    } else {
      addDebt({
        id: `dbt-${Date.now()}`, tenantId: tid,
        debtType: form.debtType, debtCategory: form.debtCategory,
        linkedEntityId: form.linkedEntityId, linkedEntityName: form.linkedEntityName, linkedEntityType: form.linkedEntityType,
        amount: amt, dueDate: form.dueDate, description: form.description, sourceReference: form.sourceReference,
        paidAmount: 0, status: 'active', paymentHistory: [],
        createdAt: new Date().toISOString().split('T')[0],
      }).then(() => {
        queryClient.invalidateQueries({ queryKey: ['debts', tid] });
        showToast('تم إضافة قيد الدين بنجاح', 'success');
      });
    }
    
    setAddSlide(false);
    resetForm();
  };

  const openEdit = (d: Debt) => {
    setForm({
      debtType: d.debtType, debtCategory: d.debtCategory,
      linkedEntityId: d.linkedEntityId || '', linkedEntityName: d.linkedEntityName, linkedEntityType: d.linkedEntityType || 'supplier',
      amount: d.amount, dueDate: d.dueDate || '', description: d.description || '', sourceReference: d.sourceReference || ''
    });
    setEditingDebtId(d.id);
    setAddSlide(true);
  };

  const isOverdue = (dateStr: string) => {
    if (!dateStr) return false;
    return new Date(dateStr) < new Date() && new Date(dateStr).toDateString() !== new Date().toDateString();
  };

  const handleEntitySelection = (id: string, name: string) => {
    setForm(prev => ({ ...prev, linkedEntityId: id, linkedEntityName: name }));
  };

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900 flex items-center gap-2">
            <FileText size={24} className="text-bunyan-600" />
            سجل الديون والذمم
          </h1>
          <p className="text-sm text-gray-500 mt-1">تتبع الديون الخارجية والداخلية</p>
        </div>
        <button onClick={() => { resetForm(); setAddSlide(true); }} 
          className="flex items-center gap-2 px-4 py-2 bg-bunyan-600 text-white rounded-xl text-sm font-bold hover:bg-bunyan-700 transition-colors shadow-sm focus:ring-2 focus:ring-bunyan-500/50">
          <Plus size={18} /> دين / ذمة جديدة
        </button>
      </div>

      {/* Cards replacing the total active debt */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-red-50 border border-red-100 rounded-3xl p-5 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
          <div className="flex items-center gap-2 mb-2">
             <ArrowUpCircle className="text-red-600" size={20} />
             <p className="text-sm font-bold text-red-800">ديون علينا (للموردين)</p>
          </div>
          <p className="text-2xl font-black text-red-600 font-currency tracking-tight">{formatCurrency(totalLiabilities)}</p>
          <p className="text-xs text-red-700/70 mt-1">المستحقات المطلوبة من المتجر للخارج</p>
        </div>
        
        <div className="bg-emerald-50 border border-emerald-100 rounded-3xl p-5 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
           <div className="flex items-center gap-2 mb-2">
             <ArrowDownCircle className="text-emerald-600" size={20} />
             <p className="text-sm font-bold text-emerald-800">ديون لنا (من الزبائن والسلف)</p>
          </div>
          <p className="text-2xl font-black text-emerald-600 font-currency tracking-tight">{formatCurrency(totalAssets)}</p>
          <p className="text-xs text-emerald-700/70 mt-1">المستحقات المتوقع تحصيلها لصالح المتجر</p>
        </div>

        <div className="bg-white border border-gray-100 rounded-3xl p-5 shadow-sm">
          <div className="flex justify-between items-start mb-2">
             <p className="text-sm font-bold text-gray-500">حجم الإجمالي الخارجي</p>
             <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-[10px] font-bold rounded-md">موردون / زبائن</span>
          </div>
          <p className="text-2xl font-black text-gray-900 font-currency tracking-tight">{formatCurrency(totalExternal)}</p>
          <p className="text-xs text-gray-400 mt-2">{myDebts.filter((d) => d.debtType === 'external' && d.status !== 'paid').length} حسابات نشطة</p>
        </div>
        <div className="bg-white border border-gray-100 rounded-3xl p-5 shadow-sm">
          <div className="flex justify-between items-start mb-2">
             <p className="text-sm font-bold text-gray-500">حجم الإجمالي الداخلي</p>
             <span className="px-2 py-0.5 bg-bunyan-50 text-bunyan-700 text-[10px] font-bold rounded-md border border-bunyan-100">سلف / عهد</span>
          </div>
          <p className="text-2xl font-black text-gray-900 font-currency tracking-tight">{formatCurrency(totalInternal)}</p>
          <p className="text-xs text-gray-400 mt-2">{myDebts.filter((d) => d.debtType === 'internal' && d.status !== 'paid').length} حسابات نشطة</p>
        </div>
      </div>

      <div className="flex bg-gray-100 p-1 rounded-xl gap-1 w-fit">
        {(['all', 'internal', 'external'] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)} 
            className={`px-5 py-2.5 rounded-lg text-sm font-bold transition-all whitespace-nowrap ${
              filter === f ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}>
            {f === 'all' ? 'جميع الديون والذمم' : f === 'internal' ? 'داخلية (سلف/عهد)' : 'خارجية (موردين ومبيعات)'}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-right">
            <thead className="bg-gray-50 text-gray-500 font-medium border-b border-gray-100">
              <tr>
                <th className="px-6 py-4">النوع والتصنيف</th>
                <th className="px-6 py-4">المدين/الدائن</th>
                <th className="px-6 py-4">مرجع (طلبية/فاتورة)</th>
                <th className="px-6 py-4">المبلغ الأصلي</th>
                <th className="px-6 py-4">الرصيد المتبقي</th>
                <th className="px-6 py-4">تاريخ الاستحقاق</th>
                <th className="px-6 py-4">الحالة</th>
                <th className="px-6 py-4 text-center">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.length > 0 ? filtered.map((d: Debt) => {
                const remaining = d.amount - d.paidAmount;
                const overdue = d.status !== 'paid' && isOverdue(d.dueDate || '');
                return (
                  <tr key={d.id} className="hover:bg-gray-50/70 transition-colors">
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2 py-1 rounded text-[10px] font-bold border ${d.debtCategory === 'supplier' ? 'bg-red-50 text-red-700 border-red-100' : 'bg-emerald-50 text-emerald-700 border-emerald-100'}`}>
                        {CATEGORY_LABELS[d.debtCategory] || d.debtCategory}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-bold text-gray-900">{d.linkedEntityName}</td>
                    <td className="px-6 py-4 font-mono text-xs text-gray-500">{d.sourceReference || '—'}</td>
                    <td className="px-6 py-4 text-gray-500 font-currency line-through decoration-gray-300">{formatCurrency(d.amount)}</td>
                    <td className="px-6 py-4">
                      {d.status === 'paid' ? (
                        <span className="text-emerald-600 font-bold">—</span>
                      ) : (
                        <span className="text-red-600 font-black font-currency text-base bg-red-50 px-2 py-0.5 rounded-lg border border-red-100 block w-fit">{formatCurrency(remaining)}</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                       {d.dueDate ? (
                         <div className={`flex flex-col gap-1 ${overdue ? 'text-red-600 font-bold' : 'text-gray-500'}`}>
                            <span className="flex items-center gap-1.5 font-mono text-xs"><CalendarDays size={14}/> {formatDate(d.dueDate)}</span>
                            {overdue && <span className="text-[10px] bg-red-100 text-red-800 px-1.5 py-0.5 rounded w-fit flex items-center gap-1"><AlertTriangle size={10}/> متأخر</span>}
                         </div>
                       ) : <span className="text-gray-400 text-xs">—</span>}
                    </td>
                    <td className="px-6 py-4">
                      {d.status === 'paid' ? <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200"><CheckCircle2 size={14} /> مسدد كامل</span>
                      : d.status === 'partial' ? <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">سداد جزئي</span>
                      : <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-red-50 text-red-700 border border-red-200">غير مسدد</span>}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        {d.status !== 'paid' && (
                          <button onClick={() => { setPaySlide(d.id); setPayAmount(remaining); }}
                            className="flex items-center gap-1 px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-lg text-xs font-bold hover:bg-emerald-100 hover:shadow-sm transition-all border border-emerald-200" title="سداد الدين">
                            <Banknote size={14} /> سداد
                          </button>
                        )}
                        <button onClick={() => setHistorySlide(d)} className="p-1.5 bg-blue-50 hover:bg-blue-100 rounded-lg text-blue-600 transition-colors shadow-sm border border-blue-100 flex items-center gap-1 text-xs font-bold" title="سجل الدفعات الحرة"><Eye size={14}/> دفعات</button>
                        <button onClick={() => openEdit(d)} className="p-1.5 bg-gray-50 hover:bg-gray-100 rounded-lg text-gray-500 transition-colors border border-gray-200" title="تعديل الشروط أو التاريخ"><Edit2 size={14}/></button>
                      </div>
                    </td>
                  </tr>
                );
              }) : (
                <tr>
                  <td colSpan={8} className="text-center py-16">
                    <div className="w-16 h-16 bg-gray-50 rounded-[2rem] flex items-center justify-center mx-auto mb-4 border border-gray-100 shadow-sm">
                      <FileText size={28} className="text-gray-400" />
                    </div>
                    <p className="text-base font-bold text-gray-900 mb-1">لا توجد ديون مطابقة</p>
                    <p className="text-sm text-gray-500">جميع السجلات نظيفة أو جرب تغيير الفلتر.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* SlideOver: إضافة/تعديل دين */}
      <SlideOver isOpen={addSlide} onClose={() => { setAddSlide(false); resetForm(); }} title={editingDebtId ? 'تعديل بيانات الدين والذمة' : 'إضافة قيد دين جديد'} width="max-w-xl">
        <div className="space-y-6 pb-20 p-2 sm:p-4">
          
          <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 space-y-4">
            <h3 className="text-sm font-bold text-gray-900 pb-2 border-b border-gray-200">1. تصنيف الدين وأطرافه</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">نوع الدين</label>
                <select value={form.debtType} onChange={(e) => setForm({ ...form, debtType: e.target.value as 'internal' | 'external' })} disabled={!!editingDebtId}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:border-bunyan-500 disabled:opacity-50 transition-colors">
                  <option value="external">خارجي (سوق)</option>
                  <option value="internal">داخلي (المتجر)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">التصنيف أو الفئة</label>
                <select value={form.debtCategory} onChange={(e) => {
                     setForm({ ...form, debtCategory: e.target.value as Debt['debtCategory'], linkedEntityType: e.target.value === 'customer' ? 'customer' : e.target.value === 'supplier' ? 'supplier' : e.target.value === 'employee_advance' ? 'employee' : e.target.value === 'partner_advance' ? 'partner' : 'supplier', linkedEntityId: '', linkedEntityName: '' });
                  }} disabled={!!editingDebtId}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:border-bunyan-500 disabled:opacity-50 transition-colors">
                  {form.debtType === 'external' ? (
                    <><option value="supplier">مورد بضاعة (ديون علينا)</option><option value="customer">زبون آجل (ديون لنا)</option></>
                  ) : (
                    <><option value="employee_advance">سلفة لموظف (ديون لنا)</option><option value="partner_advance">سحبة شريك (ديون لنا)</option><option value="custody">عهدة مالية / مصاريف</option></>
                  )}
                </select>
              </div>
            </div>
            
            <div className="grid grid-cols-1 gap-4">
              <div className="bg-white p-3 rounded-xl border border-gray-100 shadow-sm relative">
                <label className="block text-xs font-bold text-gray-800 mb-1.5">الطرف المرتبط (المدين / الدائن) *</label>
                
                {form.debtCategory === 'supplier' && (
                  <>
                  <input type="text" list="suppliersList" value={form.linkedEntityName} onChange={(e) => setForm({ ...form, linkedEntityName: e.target.value })} disabled={!!editingDebtId}
                    className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-bunyan-500 disabled:opacity-50 transition-colors" placeholder="اكتب اسم المورد وحدد من القائمة إذا وجد" />
                  <datalist id="suppliersList">
                     {supplierNames.map(s => <option key={s} value={s} />)}
                  </datalist>
                  <p className="text-[10px] mt-1 text-gray-500">حقل كتابة حرة للمورد، تستطيع كتابة مورد جديد أو اختيار مورد مسجل مسبقاً.</p>
                  </>
                )}

                {form.debtCategory === 'customer' && (
                  <select value={form.linkedEntityId} onChange={e => {
                      const cust = myCustomers.find(c => c.id === e.target.value);
                      handleEntitySelection(e.target.value, cust ? cust.name : '');
                    }} disabled={!!editingDebtId} className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-bunyan-500 disabled:opacity-50 transition-colors">
                    <option value="">-- اختر الزبون --</option>
                    {myCustomers.map(c => <option key={c.id} value={c.id}>{c.name} ({c.phone})</option>)}
                  </select>
                )}

                {form.debtCategory === 'employee_advance' && (
                  <select value={form.linkedEntityId} onChange={e => {
                      const emp = myEmployees.find(c => c.id === e.target.value);
                      handleEntitySelection(e.target.value, emp ? emp.name : '');
                    }} disabled={!!editingDebtId} className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-bunyan-500 disabled:opacity-50 transition-colors">
                    <option value="">-- اختر الموظف --</option>
                    {myEmployees.map(e => <option key={e.id} value={e.id}>{e.name} - {e.jobTitle}</option>)}
                  </select>
                )}

                {form.debtCategory === 'partner_advance' && (
                   <select value={form.linkedEntityId} onChange={e => {
                      const part = myPartners.find(c => c.id === e.target.value);
                      handleEntitySelection(e.target.value, part ? part.name : '');
                    }} disabled={!!editingDebtId} className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-bunyan-500 disabled:opacity-50 transition-colors">
                    <option value="">-- اختر الشريك --</option>
                    {myPartners.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                )}

                {form.debtCategory === 'custody' && (
                   <input type="text" value={form.linkedEntityName} onChange={(e) => setForm({ ...form, linkedEntityName: e.target.value })} disabled={!!editingDebtId}
                    className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-bunyan-500 disabled:opacity-50 transition-colors" placeholder="اسم مستلم العهدة المالية" />
                )}

              </div>
            </div>
            {!!editingDebtId && <p className="text-[10px] text-gray-500 text-center">عذراً، لا يمكن تغيير أطراف الدين لدواعي محاسبية دقيقة. يمكنك تعديل المبلغ المتبقي، والتاريخ فقط.</p>}
          </div>

          <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 space-y-4">
            <h3 className="text-sm font-bold text-gray-900 pb-2 border-b border-gray-200">2. القيم المادية والمرجعية</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">قيمة الدين الأصلية بالدينار *</label>
                <div className="relative">
                  <input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} min={editingDebtId ? (myDebts.find(d => d.id === editingDebtId)?.paidAmount || 0) : 0}
                    className={`w-full pr-4 pl-12 py-3 bg-white border border-gray-200 rounded-xl text-lg font-mono font-black text-gray-900 focus:outline-none focus:ring-2 focus:ring-bunyan-500/30 transition-colors ${form.debtCategory === 'supplier' ? 'focus:border-red-500 focus:ring-red-500/30' : 'focus:border-emerald-500 focus:ring-emerald-500/30'}`} placeholder="0" />
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-bold text-gray-400">د.ل</span>
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-gray-700 mb-1.5 flex items-center gap-1"><CalendarDays size={14}/> تاريـخ الاسـتحـقـاق (مستحسن)</label>
                <input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} 
                  className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-bunyan-500/30 focus:border-bunyan-500 transition-colors cursor-pointer" />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                 <label className="block text-xs font-bold text-gray-700 mb-1.5">المصدر المرجعي (فاتورة/طلبية) اختياري</label>
                 <input type="text" value={form.sourceReference} onChange={e => setForm({...form, sourceReference: e.target.value})} 
                   className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm font-mono focus:outline-none focus:border-bunyan-500" placeholder="#INV-204" />
              </div>
              <div>
                 <label className="text-xs font-bold text-gray-700 mb-1.5 flex items-center gap-1"><FileText size={14}/> تفاصيل إضافية للبيان</label>
                 <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={1} 
                   className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-bunyan-500/30 focus:border-bunyan-500 transition-colors resize-none" placeholder="اكتب ماهية الدين..." />
              </div>
            </div>
          </div>

          <div className="fixed bottom-0 left-0 w-full sm:w-[500px] p-4 bg-white border-t border-gray-100 z-10 hidden sm:block">
            <button onClick={handleSaveDebt} className={`w-full py-3 text-white font-bold rounded-xl transition-all text-sm shadow-md ${form.debtCategory === 'supplier' ? 'bg-red-600 hover:bg-red-700' : 'bg-emerald-600 hover:bg-emerald-700'}`}>
              {editingDebtId ? 'حفظ تعديلات الدين' : 'إدراج قيد الدين واعتماده'}
            </button>
          </div>
          <button onClick={handleSaveDebt} className={`sm:hidden w-full py-3 text-white font-bold rounded-xl transition-all text-sm shadow-md mt-6 ${form.debtCategory === 'supplier' ? 'bg-red-600 hover:bg-red-700' : 'bg-emerald-600 hover:bg-emerald-700'}`}>
             {editingDebtId ? 'حفظ تعديلات الدين' : 'إدراج قيد الدين واعتماده'}
          </button>
        </div>
      </SlideOver>

      {/* SlideOver: سداد الدين */}
      <SlideOver isOpen={!!paySlide} onClose={() => setPaySlide(null)} title="سداد مستحقات الدين">
        <div className="space-y-6 pb-20">
          {paySlide && (() => { 
            const d = myDebts.find((x) => x.id === paySlide); 
            if (!d) return null; 
            const rem = d.amount - d.paidAmount; 
            return (
            <>
              <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-center shadow-inner relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-red-100 rounded-full blur-3xl -mr-10 -mt-10" />
                <p className="text-sm font-bold text-red-800 mb-2 relative z-10">الرصيد المتبقي المطلوب سداده</p>
                <p className="text-4xl font-black text-red-900 font-currency tracking-tight relative z-10">{formatCurrency(rem)}</p>
              </div>
              
              <div className="bg-white p-5 border border-gray-200 rounded-2xl shadow-sm">
                <label className="block text-sm font-bold text-gray-900 mb-3 text-center">أدخل القيمة المراد سدادها الآن</label>
                <div className="relative max-w-xs mx-auto">
                  <input type="number" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} max={rem}
                    className="w-full px-4 py-3 border-2 border-emerald-500 rounded-xl text-2xl font-mono font-black text-center focus:outline-none focus:ring-4 focus:ring-emerald-500/20 text-gray-900 transition-all shadow-[0_0_15px_rgba(16,185,129,0.1)] mb-2" placeholder="0" />
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-bold text-gray-400">د.ل</span>
                </div>
                {Number(payAmount) > rem && (
                  <p className="text-xs text-red-600 text-center font-bold flex items-center justify-center gap-1 mt-2">
                    <AlertTriangle size={14}/> المبلغ يتجاوز الدين المتبقي! أقصى حد: {rem}
                  </p>
                )}
                {Number(payAmount) === rem && (
                  <p className="text-xs text-emerald-600 text-center font-bold flex items-center justify-center gap-1 mt-2">
                     <CheckCircle2 size={14}/> سداد كلي للذمة
                  </p>
                )}
              </div>

              <div className="bg-gray-50 rounded-xl p-4 border border-gray-100 text-center">
                <p className="text-xs text-gray-500">سيتم تسجيل هذه الدفعة وتحديث الرصيد المتبقي مباشرة وتسجيلها كحركة من الخزينة.</p>
              </div>

              <div className="fixed bottom-0 left-0 w-full sm:w-[500px] p-4 bg-white border-t border-gray-100 z-10 hidden sm:block">
                <button onClick={handlePay} disabled={!payAmount || Number(payAmount) <= 0 || Number(payAmount) > rem}
                  className="w-full py-3 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 transition-all text-sm shadow-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                  <CheckCircle2 size={18} /> اعتماد وتأكيد السداد
                </button>
              </div>
              <button onClick={handlePay} disabled={!payAmount || Number(payAmount) <= 0 || Number(payAmount) > rem}
                className="sm:hidden w-full py-3 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 transition-all text-sm shadow-md mt-6 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                <CheckCircle2 size={18} /> اعتماد وتأكيد السداد
              </button>
            </>
          ); })()}
        </div>
      </SlideOver>

      {/* SlideOver: سجل الدفعات */}
      <SlideOver isOpen={!!historySlide} onClose={() => setHistorySlide(null)} title="سجل الدفعات الحرة" width="max-w-md">
         {historySlide && (
            <div className="p-4 space-y-4">
               <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex flex-col justify-center items-center gap-1">
                 <p className="text-[10px] font-bold text-blue-800 uppercase bg-blue-100 px-2 py-0.5 rounded-full">{CATEGORY_LABELS[historySlide.debtCategory] || historySlide.debtCategory}</p>
                 <p className="text-lg font-black text-gray-900 mt-1">{historySlide.linkedEntityName}</p>
                 <p className="text-xs text-gray-500 font-mono">القيمة الأصلية: {formatCurrency(historySlide.amount)}</p>
               </div>

               {historySlide.paymentHistory && historySlide.paymentHistory.length > 0 ? (
                  <div className="border border-gray-200 rounded-xl overflow-hidden bg-white shadow-sm">
                     <table className="w-full text-right text-sm">
                       <thead className="bg-gray-50 border-b border-gray-200">
                         <tr>
                           <th className="px-4 py-3 font-bold text-gray-600">التاريخ</th>
                           <th className="px-4 py-3 font-bold text-gray-600">المبلغ المسدد</th>
                         </tr>
                       </thead>
                        <tbody className="divide-y divide-gray-100">
                          {(historySlide.paymentHistory as any[]).map((ph, idx) => (
                           <tr key={idx} className="hover:bg-gray-50 transition-colors">
                             <td className="px-4 py-3 text-gray-500 font-mono text-xs">{formatDate(ph.date)}</td>
                             <td className="px-4 py-3 text-emerald-600 font-black font-currency">{formatCurrency(ph.amount)}</td>
                           </tr>
                         ))}
                       </tbody>
                     </table>
                  </div>
               ) : (
                  <div className="bg-gray-50 border border-gray-100 rounded-xl p-8 text-center">
                     <FileText className="mx-auto mb-2 text-gray-300" size={32} />
                     <p className="text-gray-500 text-sm font-bold">لا توجد أي دفعات أو تسديدات حتى الآن.</p>
                  </div>
               )}
            </div>
         )}
      </SlideOver>
    </div>
  );
}
