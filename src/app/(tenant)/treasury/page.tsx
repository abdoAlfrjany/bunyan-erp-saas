'use client';

import { useState, useMemo } from 'react';
import { useUser } from '@/core/auth/hooks';
import { useTreasuryQuery } from '@/core/db/hooks/useTreasury';
import { useQueryClient } from '@tanstack/react-query';
import { useGetForTenant, useAddTransaction } from '@/core/db/hooks';
import { formatCurrency, formatDate } from '@/shared/utils/format';
import { SlideOver } from '@/shared/components/ui/SlideOver';
import { EmptyState } from '@/shared/components/ui/EmptyState';
import { useToast } from '@/shared/components/ui/Toast';
import {
  Wallet, ArrowUpCircle, ArrowDownCircle, Landmark, Truck,
  Plus, ArrowRightLeft, Download, BanknoteIcon, ArrowLeftRight
} from 'lucide-react';
import type { TreasuryTransaction, TreasuryAccount } from '@/core/types';

const TX_LABELS: Record<string, { label: string; icon: any; colorClasses: string }> = {
  income:             { label: 'إيراد / ضخ مال',  icon: ArrowUpCircle,   colorClasses: 'bg-emerald-50 text-emerald-600' },
  sale:               { label: 'إيراد مبيعات',    icon: ArrowUpCircle,   colorClasses: 'bg-blue-50 text-blue-600' },
  courier_settlement: { label: 'تسوية توصيل',     icon: ArrowUpCircle,   colorClasses: 'bg-bunyan-50 text-bunyan-600' },
  expense:            { label: 'مصروفات',          icon: ArrowDownCircle, colorClasses: 'bg-red-50 text-red-600' },
  partner_withdrawal: { label: 'سحب شريك',         icon: ArrowDownCircle, colorClasses: 'bg-amber-50 text-amber-600' },
  salary:             { label: 'رواتب الموظفين',   icon: ArrowDownCircle, colorClasses: 'bg-rose-50 text-rose-600' },
};

export default function TreasuryPage() {
  const user = useUser();
  const tid = user?.tenantId || '';
  const queryClient = useQueryClient();

  const { data: treasuryData, isLoading } = useTreasuryQuery(tid);
  const treasury = treasuryData?.accounts || [];
  const transactions = treasuryData?.transactions || [];

  const getForTenant = useGetForTenant();
  const addTransaction = useAddTransaction();
  const { showToast } = useToast();

  const myAccounts = useMemo(() => getForTenant(treasury, tid), [treasury, tid, getForTenant]);
  const myTx = useMemo(
    () => getForTenant(transactions, tid).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [transactions, tid, getForTenant]
  );

  const cashAccount     = myAccounts.find(a => a.accountType === 'cash_in_hand');
  const bankAccounts    = myAccounts.filter(a => a.accountType === 'bank');
  const courierAccounts = myAccounts.filter(a => a.accountType === 'with_courier');

  const cashBalance    = Math.round(cashAccount?.balance ?? 0);
  const bankBalance    = Math.round(bankAccounts.reduce((s, a) => s + a.balance, 0));
  const courierBalance = Math.round(courierAccounts.reduce((s, a) => s + a.balance, 0));
  const totalBalance   = Math.round(myAccounts.reduce((s, a) => s + a.balance, 0));
  const totalIncome    = Math.round(myTx.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0));
  const totalExpense   = Math.round(myTx.filter(t => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0));

  const [slideOpen, setSlideOpen] = useState(false);
  const [isTransfer, setIsTransfer] = useState(false);
  const [txType, setTxType]       = useState<TreasuryTransaction['transactionType']>('income');
  const [accountId, setAccountId] = useState('');
  const [toAccountId, setToAccountId] = useState('');
  const [amount, setAmount]       = useState('');
  const [txDate, setTxDate]       = useState(new Date().toISOString().split('T')[0]);
  const [description, setDescription] = useState('');
  const [typeFilter, setTypeFilter]   = useState<'all' | TreasuryTransaction['transactionType']>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo]     = useState('');

  // Auto-select cash account if available and no account selected
  useMemo(() => {
     if (!accountId && cashAccount) setAccountId(cashAccount.id);
  }, [cashAccount, accountId]);

  const filteredTx = myTx.filter(tx => {
    if (typeFilter !== 'all' && tx.transactionType !== typeFilter) return false;
    if (dateFrom && tx.transactionDate < dateFrom) return false;
    if (dateTo   && tx.transactionDate > dateTo)   return false;
    return true;
  });

  const handleQuickAmount = (pct: number) => {
    const acct = myAccounts.find(a => a.id === accountId);
    if (acct) setAmount(String(Math.round(acct.balance * pct)));
  };

  const handleAddTx = async () => {
    const amt = Number(amount);
    if (!description || amt <= 0 || !accountId) {
      showToast('يرجى إدخال الحساب والمبلغ والبيان', 'error'); return;
    }
    
    const selected = myAccounts.find(a => a.id === accountId);
    if (!selected) return;

    if (isTransfer) {
      if (!toAccountId || toAccountId === accountId) {
        showToast('يرجى اختيار حساب مختلف للتحويل إليه', 'error'); return;
      }
      if (amt > selected.balance) {
        showToast(`الرصيد غير كافٍ — المتاح: ${formatCurrency(selected.balance)}`, 'error'); return;
      }

      try {
        await Promise.all([
          addTransaction({
            id: crypto.randomUUID(), tenantId: tid, accountId,
            transactionType: 'expense',
            amount: -Math.abs(amt),
            description: `تحويل إلى ${myAccounts.find(a => a.id === toAccountId)?.accountName}: ${description}`,
            createdAt: new Date().toISOString(), transactionDate: txDate,
          }),
          addTransaction({
            id: crypto.randomUUID(), tenantId: tid, accountId: toAccountId,
            transactionType: 'income',
            amount: Math.abs(amt),
            description: `تحويل من ${selected.accountName}: ${description}`,
            createdAt: new Date().toISOString(), transactionDate: txDate,
          })
        ]);
        
        queryClient.invalidateQueries({ queryKey: ['treasury', tid] });
        showToast('تم التحويل بين الحسابات بنجاح ✅', 'success');
        setSlideOpen(false); setAmount(''); setDescription(''); setIsTransfer(false);
      } catch (err: any) {
        showToast(err.message || 'حدث خطأ أثناء التحويل', 'error');
      }
      return;
    }

    const isExpense = txType === 'expense' || txType === 'partner_withdrawal';
    if (isExpense && amt > selected.balance) {
      showToast(`الرصيد غير كافٍ — المتاح: ${formatCurrency(selected.balance)}`, 'error'); return;
    }

    try {
      await addTransaction({
        id: crypto.randomUUID(), tenantId: tid, accountId,
        transactionType: txType,
        amount: isExpense ? -Math.abs(amt) : Math.abs(amt),
        description, createdAt: new Date().toISOString(), transactionDate: txDate,
      });
      
      queryClient.invalidateQueries({ queryKey: ['treasury', tid] });
      showToast('تمت إضافة الحركة المالية بنجاح ✅', 'success');
      setSlideOpen(false); setAmount(''); setDescription(''); setTxType('income');
    } catch (err: any) {
      showToast(err.message || 'حدث خطأ أثناء إضافة الحركة', 'error');
    }
  };

  const handleExportCSV = () => {
    if (!filteredTx.length) { showToast('لا توجد بيانات للتصدير', 'error'); return; }
    const rows = filteredTx.map(tx => {
      const lbl  = TX_LABELS[tx.transactionType]?.label ?? tx.transactionType;
      const acct = myAccounts.find(a => a.id === tx.accountId)?.accountName ?? '—';
      return [tx.transactionDate, lbl, acct, tx.description.replace(/,/g, ' '), tx.amount].join(',');
    });
    const csv = 'data:text/csv;charset=utf-8,\uFEFF' + ['التاريخ,النوع,الحساب,البيان,المبلغ', ...rows].join('\n');
    const a = document.createElement('a');
    a.href = encodeURI(csv);
    a.download = `treasury_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  };

  if (isLoading) return <div className="p-10 text-center text-gray-400">جاري تحميل بيانات الخزينة...</div>;

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900">الخزينة والمركز المالي</h1>
          <p className="text-sm text-gray-500 mt-1">متابعة الأرصدة وإدارة التدفقات النقدية</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleExportCSV}
            className="inline-flex items-center gap-2 px-3 py-2 bg-gray-100 hover:bg-gray-200
              text-gray-700 rounded-xl text-sm font-bold transition-all">
            <Download size={14} /> تصدير CSV
          </button>
          <button onClick={() => setSlideOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-bunyan-600 hover:bg-bunyan-700
              text-white rounded-xl text-sm font-bold transition-all shadow-sm">
            <Plus size={16} /> حركة يدوية
          </button>
        </div>
      </div>

      {/* 4 Financial Widgets */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="col-span-2 lg:col-span-1 bg-gradient-to-br from-bunyan-700 to-purple-700
          rounded-2xl p-5 text-white shadow-md relative overflow-hidden">
          <div className="absolute -bottom-5 -left-5 w-20 h-20 bg-white/10 rounded-full blur-xl" />
          <div className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center mb-3 relative z-10">
            <Wallet className="w-5 h-5 text-white" />
          </div>
          <p className="text-3xl font-black text-white relative z-10">{formatCurrency(cashBalance)}</p>
          <p className="text-xs text-white/70 mt-1 relative z-10">النقدية في الصندوق</p>
        </div>
        {[
          { label: 'الحسابات البنكية', value: bankBalance, icon: Landmark, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-100' },
          { label: 'لدى شركات التوصيل', value: courierBalance, icon: Truck, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-100' },
          { label: 'إجمالي الأصول', value: totalBalance, icon: BanknoteIcon, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100' },
        ].map(w => (
          <div key={w.label} className={`bg-white border ${w.border} rounded-2xl p-5 shadow-sm hover:shadow-md transition-all`}>
            <div className={`w-9 h-9 ${w.bg} rounded-xl flex items-center justify-center mb-3`}>
              <w.icon className={`w-5 h-5 ${w.color}`} />
            </div>
            <p className={`text-2xl font-black ${w.color}`}>{formatCurrency(w.value)}</p>
            <p className="text-xs text-gray-500 mt-1">{w.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-emerald-600 mb-0.5">إجمالي الإيرادات</p>
            <p className="text-lg font-black text-emerald-700">+{formatCurrency(totalIncome)}</p>
          </div>
          <ArrowUpCircle className="text-emerald-400 w-8 h-8" />
        </div>
        <div className="bg-red-50 border border-red-100 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-red-600 mb-0.5">إجمالي المصروفات</p>
            <p className="text-lg font-black text-red-700">-{formatCurrency(totalExpense)}</p>
          </div>
          <ArrowDownCircle className="text-red-400 w-8 h-8" />
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex flex-col lg:flex-row items-start
          lg:items-center justify-between gap-3">
          <h2 className="font-bold text-gray-900 flex items-center gap-2 text-sm">
            <ArrowRightLeft size={16} className="text-bunyan-600" />
            سجل الحركات المالية
            <span className="bg-gray-100 text-gray-500 text-xs px-2 py-0.5 rounded-full">
              {filteredTx.length}
            </span>
          </h2>
          <div className="flex items-center gap-2 flex-wrap">
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
              className="px-2 py-1.5 border border-gray-200 rounded-lg text-xs bg-white focus:outline-none w-36" />
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
              className="px-2 py-1.5 border border-gray-200 rounded-lg text-xs bg-white focus:outline-none w-36" />
            <div className="flex bg-gray-100 p-0.5 rounded-lg gap-0.5">
              {[['all', 'الكل'], ['income', 'إيرادات'], ['expense', 'مصروفات']].map(([v, l]) => (
                <button key={v} onClick={() => setTypeFilter(v as any)}
                  className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all ${
                    typeFilter === v ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
                  }`}>
                  {l}
                </button>
              ))}
            </div>
          </div>
        </div>

        {filteredTx.length === 0 ? (
          <div className="py-16">
            <EmptyState icon={<ArrowRightLeft className="w-8 h-8 text-gray-400" />}
              title="لا توجد حركات مالية"
              description="ابدأ بإضافة أول حركة يدوية" />
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {filteredTx.map(tx => {
              const info = TX_LABELS[tx.transactionType] ?? TX_LABELS.expense;
              const isInc = tx.amount > 0;
              const txAcct = myAccounts.find(a => a.id === tx.accountId);
              return (
                <div key={tx.id} className="flex items-center justify-between px-5 py-4
                  hover:bg-gray-50/60 transition-colors">
                  <div className="flex items-center gap-3.5">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${info.colorClasses}`}>
                      <info.icon size={17} />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-gray-900">
                        {info.label}
                        <span className="font-normal text-xs text-gray-400 mr-1.5">
                          ({txAcct?.accountName ?? '—'})
                        </span>
                      </p>
                      <p className="text-xs text-gray-500">{tx.description}</p>
                      <p className="text-[10px] text-gray-400 font-mono mt-0.5">
                        {tx.transactionDate || formatDate(tx.createdAt)}
                      </p>
                    </div>
                  </div>
                  <div className={`px-3 py-1.5 rounded-xl text-sm font-black font-mono ${
                    isInc ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
                  }`}>
                    {isInc ? '+' : '-'}{formatCurrency(Math.abs(tx.amount))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <SlideOver isOpen={slideOpen} onClose={() => { setSlideOpen(false); setIsTransfer(false); }} title={isTransfer ? "تحويل بين الحسابات" : "إضافة حركة مالية"}>
        <div className="space-y-5 p-1">
          <div className="flex bg-gray-100 p-1 rounded-xl">
            <button onClick={() => setIsTransfer(false)}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${!isTransfer ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}>
              حركة عادية
            </button>
            <button onClick={() => setIsTransfer(true)}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${isTransfer ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}>
              تحويل داخلي
            </button>
          </div>

          {!isTransfer ? (
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1.5">نوع الحركة</label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'income', label: 'إيراد / ضخ', icon: ArrowUpCircle, color: 'text-emerald-600' },
                  { id: 'expense', label: 'مصروفات', icon: ArrowDownCircle, color: 'text-red-600' },
                  { id: 'partner_withdrawal', label: 'سحب شريك', icon: Wallet, color: 'text-amber-600' },
                ].map(t => (
                  <button key={t.id} onClick={() => setTxType(t.id as any)}
                    className={`flex items-center gap-2 p-3 rounded-xl border-2 transition-all ${
                      txType === t.id ? 'border-bunyan-500 bg-bunyan-50/50' : 'border-gray-100 hover:border-gray-200'
                    }`}>
                    <t.icon size={16} className={t.color} />
                    <span className="text-[11px] font-bold">{t.label}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-3 flex items-center gap-3">
              <ArrowLeftRight className="text-blue-600 shrink-0" size={20} />
              <p className="text-[11px] text-blue-700 leading-relaxed font-medium">
                سيتم خصم المبلغ من الحساب "المصدر" وإضافته للحساب "المستلم" بشكل آلي.
              </p>
            </div>
          )}

          <div className="space-y-4 pt-2">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1.5">
                {isTransfer ? 'من حساب (المصدر)' : 'الحساب المالي'}
              </label>
              <select value={accountId} onChange={e => setAccountId(e.target.value)}
                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-bunyan-500 outline-none">
                <option value="">اختر الحساب...</option>
                {myAccounts.map(a => (
                  <option key={a.id} value={a.id}>{a.accountName} ({formatCurrency(a.balance)})</option>
                ))}
              </select>
            </div>

            {isTransfer && (
              <div className="relative pt-1 pb-1">
                <div className="absolute left-1/2 -top-3 -translate-x-1/2 bg-white p-1 rounded-full border border-gray-200 shadow-sm z-10 text-gray-400">
                  <ArrowDownCircle size={14} />
                </div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">إلى حساب (المستلم)</label>
                <select value={toAccountId} onChange={e => setToAccountId(e.target.value)}
                  className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-bunyan-500 outline-none">
                  <option value="">اختر الحساب المستلم...</option>
                  {myAccounts.filter(a => a.id !== accountId).map(a => (
                    <option key={a.id} value={a.id}>{a.accountName} ({formatCurrency(a.balance)})</option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1.5">المبلغ</label>
              <div className="relative">
                <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00"
                  className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-bunyan-500 outline-none pr-10 font-bold" />
                <span className="absolute right-3 top-3.5 text-gray-400 text-xs font-bold">ل.د</span>
              </div>
              <div className="flex gap-2 mt-2">
                {[0.25, 0.5, 1].map(p => (
                  <button key={p} onClick={() => handleQuickAmount(p)}
                    className="flex-1 py-1.5 bg-gray-50 hover:bg-gray-100 text-gray-500 rounded-lg text-[10px] font-bold border border-gray-100 transition-all">
                    {p === 1 ? 'كامل الرصيد' : `${p * 100}%`}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-xs font-bold text-gray-700 mb-1.5">التاريخ</label>
                <input type="date" value={txDate} onChange={e => setTxDate(e.target.value)}
                  className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-bunyan-500 outline-none" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1.5">البيان / الملاحظات</label>
              <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} placeholder="اكتب تفاصيل الحركة هنا..."
                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-bunyan-500 outline-none resize-none" />
            </div>

            <button onClick={handleAddTx}
              className="w-full py-4 bg-bunyan-600 hover:bg-bunyan-700 text-white rounded-xl font-black text-sm transition-all shadow-lg shadow-bunyan-200 flex items-center justify-center gap-2 mt-4">
              {isTransfer ? 'إتمام التحويل' : 'حفظ الحركة'}
            </button>
          </div>
        </div>
      </SlideOver>
    </div>
  );
}
