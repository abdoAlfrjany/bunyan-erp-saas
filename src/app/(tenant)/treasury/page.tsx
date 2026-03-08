// src/app/(tenant)/treasury/page.tsx
// الوظيفة: الخزينة والمركز المالي — حسابات + حركات + إضافة حركة جديدة
// الجداول: treasury_accounts, treasury_transactions
// الصلاحية: OWNER فقط

'use client';

import { useState } from 'react';
import { useAuthStore } from '@/core/auth/store';
import { useDataStore } from '@/core/db/store';
import { formatCurrency, formatDate } from '@/shared/utils/format';
import { SlideOver } from '@/shared/components/ui/SlideOver';
import { useToast } from '@/shared/components/ui/Toast';
import { Wallet, ArrowUpCircle, ArrowDownCircle, Landmark, Truck, Plus, ArrowRightLeft, TrendingUp, Filter, Download } from 'lucide-react';
import type { TreasuryTransaction } from '@/core/db/seed';

const TX_LABELS: Record<string, { label: string; icon: typeof ArrowUpCircle; colorClasses: string }> = {
  income:              { label: 'إيراد / ضخ مال',icon: ArrowUpCircle,   colorClasses: 'bg-emerald-50 text-emerald-600' },
  sale:                { label: 'إيراد مبيعات',  icon: ArrowUpCircle,   colorClasses: 'bg-blue-50 text-blue-600' },
  courier_settlement:  { label: 'تسوية توصيل',   icon: ArrowUpCircle,   colorClasses: 'bg-bunyan-50 text-bunyan-600' },
  expense:             { label: 'مصروفات',       icon: ArrowDownCircle, colorClasses: 'bg-red-50 text-red-600' },
  partner_withdrawal:  { label: 'سحب شريك',      icon: ArrowDownCircle, colorClasses: 'bg-amber-50 text-amber-600' },
};

export default function TreasuryPage() {
  const { user } = useAuthStore();
  const { treasury, transactions, getForTenant, addTransaction } = useDataStore();
  const { showToast } = useToast();
  const tid = user?.tenantId || '';
  
  const myAccounts = getForTenant(treasury, tid);
  const myTx = getForTenant(transactions, tid).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  
  const cashAccount = myAccounts.find((a) => a.accountType === 'cash_in_hand');
  const courierAccounts = myAccounts.filter((a) => a.accountType === 'with_courier');
  
  const totalBalance = myAccounts.reduce((s, a) => s + a.balance, 0);
  const cashBalance = cashAccount?.balance || 0;
  const courierBalance = courierAccounts.reduce((s, a) => s + a.balance, 0);

  const [slideOpen, setSlideOpen] = useState(false);
  const [newTx, setNewTx] = useState({
    transactionType: 'income' as TreasuryTransaction['transactionType'],
    accountId: cashAccount?.id || '',
    amount: '' as string, 
    transactionDate: new Date().toISOString().split('T')[0],
    description: '',
  });

  // فلاتر
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | TreasuryTransaction['transactionType']>('all');

  // معالجة الفلترة
  const filteredTx = myTx.filter(tx => {
    if (typeFilter !== 'all' && tx.transactionType !== typeFilter) return false;
    if (dateFrom && tx.transactionDate < dateFrom) return false;
    if (dateTo && tx.transactionDate > dateTo) return false;
    return true;
  });

  const handleExportCSV = () => {
    if (filteredTx.length === 0) {
      showToast('لا توجد بيانات لتصديرها', 'error');
      return;
    }
    const headers = ['التاريخ', 'النوع', 'الحساب', 'البيان', 'المبلغ'];
    const rows = filteredTx.map(tx => {
      const typeLabel = TX_LABELS[tx.transactionType]?.label || tx.transactionType;
      const accountName = myAccounts.find(a => a.id === tx.accountId)?.accountName || 'غير معروف';
      const isIncome = tx.amount > 0;
      return [
        tx.transactionDate,
        typeLabel,
        accountName,
        tx.description.replace(/,/g, ' '), // منع تعارض الفواصل
        isIncome ? Math.abs(tx.amount) : -Math.abs(tx.amount)
      ].join(',');
    });
    
    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + [headers.join(','), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `treasury_export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleAmountChange = (val: string) => {
    // إزالة الفواصل المخصصة للآلاف
    const rawVal = val.replace(/,/g, '');
    // Regex للسماح بالأرقام وفاصلة عشرية واحدة اختيارياً
    if (/^\d*\.?\d*$/.test(rawVal)) {
      setNewTx({ ...newTx, amount: rawVal });
    }
  };

  const getFormattedAmount = (val: string) => {
    if (!val) return '';
    // فصل الرقم الصحيح عن العشري
    const parts = val.split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return parts.join('.');
  };

  const handleAddTx = () => {
    if (!newTx.description || !newTx.amount || Number(newTx.amount) <= 0 || !newTx.accountId) { 
      showToast('يرجى إدخال الحساب، مبلغ صحيح ووصف للحركة', 'error'); 
      return; 
    }
    
    const selectedAccount = myAccounts.find(a => a.id === newTx.accountId);
    if (!selectedAccount) return;

    const amt = Number(newTx.amount);
    const isExpense = newTx.transactionType === 'expense' || newTx.transactionType === 'partner_withdrawal';
    
    if (isExpense && amt > selectedAccount.balance) {
      showToast(`عذراً، الرصيد المتوفر في هذا الحساب لا يغطي هذه العملية. المتاح: ${formatCurrency(selectedAccount.balance)}`, 'error');
      return;
    }

    // تسجيل الحركة
    addTransaction({
      id: `tt-${Date.now()}`, tenantId: tid, accountId: newTx.accountId,
      transactionType: newTx.transactionType,
      amount: isExpense ? -Math.abs(amt) : Math.abs(amt),
      description: newTx.description, createdAt: new Date().toISOString(),
      transactionDate: newTx.transactionDate,
    });

    showToast('تمت إضافة الحركة المالية بنجاح', 'success');
    setSlideOpen(false);
    setNewTx({ transactionType: 'income', accountId: cashAccount?.id || '', amount: '', transactionDate: new Date().toISOString().split('T')[0], description: '' });
  };

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Wallet size={24} className="text-bunyan-600" />
            الخزينة والمالية
          </h1>
          <p className="text-sm text-gray-500 mt-1">متابعة الأرصدة وإدارة التدفقات النقدية (الإيرادات والمصروفات)</p>
        </div>
        <button onClick={() => setSlideOpen(true)} 
          className="flex items-center gap-2 px-4 py-2 bg-bunyan-600 text-white rounded-xl text-sm font-bold hover:bg-bunyan-700 transition-colors shadow-sm focus:ring-2 focus:ring-bunyan-500/50">
          <Plus size={18} /> حركة يدوية جديدة
        </button>
      </div>

      {/* بطاقات الأرصدة */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* الخزينة الرئيسية */}
        <div className="bg-gradient-to-br from-bunyan-600 to-bunyan-800 rounded-3xl p-6 text-white shadow-lg relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none" />
          <div className="flex justify-between items-start mb-4 relative z-10">
            <div>
              <p className="text-bunyan-100 text-sm font-bold mb-1">الخزينة الرئيسية (نقد)</p>
              <h2 className="text-3xl font-black font-currency tracking-tight">{formatCurrency(cashBalance)}</h2>
            </div>
            <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm">
              <Landmark size={24} className="text-white" />
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-white/20 relative z-10">
            <p className="text-xs text-bunyan-100 flex items-center gap-1.5"><TrendingUp size={14}/> رصيد متاح للسحب والتصرف</p>
          </div>
        </div>

        {/* قيد التحصيل */}
        <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-start mb-4">
            <div>
              <p className="text-gray-500 text-sm font-bold mb-1">أموال قيد التحصيل (شركات التوصيل)</p>
              <h2 className="text-2xl font-black text-gray-900 font-currency">{formatCurrency(courierBalance)}</h2>
            </div>
            <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center">
              <Truck size={24} className="text-blue-600" />
            </div>
          </div>
          <div className="mt-auto pt-4 border-t border-gray-50 h-full flex flex-col justify-end">
             {courierAccounts.slice(0, 2).map(a => (
                <div key={a.id} className="flex justify-between items-center text-xs py-1">
                  <span className="text-gray-500">{a.accountName.replace('حساب ', '')}</span>
                  <span className="font-bold text-gray-900 font-mono">{formatCurrency(a.balance)}</span>
                </div>
             ))}
             {courierAccounts.length > 2 && <p className="text-[10px] text-gray-400 mt-1">و {courierAccounts.length - 2} شركات أخرى...</p>}
          </div>
        </div>

        {/* إجمالي الأصول المالية */}
        <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-start mb-4">
            <div>
              <p className="text-gray-500 text-sm font-bold mb-1">إجمالي الأصول المالية</p>
              <h2 className="text-2xl font-black text-emerald-600 font-currency">{formatCurrency(totalBalance)}</h2>
            </div>
            <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center">
              <Wallet size={24} className="text-emerald-600" />
            </div>
          </div>
          <div className="mt-auto pt-4 border-t border-gray-50">
             <p className="text-xs text-gray-500 leading-relaxed">يمثل مجموع ما تملكه نقدياً بالإضافة إلى ديونك المستحقة لدى المؤديين (المندوبين).</p>
          </div>
        </div>
      </div>

      {/* سجل الحركات والفلاتر */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm mt-6">
        <div className="px-6 py-5 border-b border-gray-100 flex flex-col lg:flex-row items-start lg:items-center justify-between bg-gray-50/50 gap-4">
          <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
            <ArrowRightLeft size={18} className="text-bunyan-600" />
            سجل الحركات المالية
          </h2>
          <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
            <div className="flex items-center gap-2 flex-grow lg:flex-grow-0">
              <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm bg-white focus:border-bunyan-500 w-full lg:w-36" />
              <span className="text-gray-400">-</span>
              <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm bg-white focus:border-bunyan-500 w-full lg:w-36" />
            </div>
            <select value={typeFilter} onChange={e => setTypeFilter(e.target.value as any)}
              className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:border-bunyan-500 w-full lg:w-auto">
              <option value="all">كل الحركات</option>
              {Object.entries(TX_LABELS).map(([key, info]) => (
                <option key={key} value={key}>{info.label}</option>
              ))}
            </select>
            <button onClick={handleExportCSV}
              className="px-3 py-1.5 bg-gray-100 text-gray-700 font-bold rounded-lg hover:bg-gray-200 transition-colors text-sm flex items-center gap-2 w-full lg:w-auto justify-center">
              <Download size={14} /> تصدير CSV
            </button>
          </div>
        </div>
        
        <div className="divide-y divide-gray-50">
          {filteredTx.map((tx) => {
            const info = TX_LABELS[tx.transactionType] || TX_LABELS.expense;
            const isIncome = tx.amount > 0;
            const txAccount = myAccounts.find(a => a.id === tx.accountId);
            return (
              <div key={tx.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-5 hover:bg-gray-50/70 transition-colors gap-4">
                <div className="flex items-start gap-4">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${info.colorClasses}`}>
                    <info.icon size={20} />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-gray-900 mb-0.5">{info.label} <span className="text-gray-400 font-normal text-xs mr-2">({txAccount?.accountName || 'حساب غير معروف'})</span></h4>
                    <p className="text-xs text-gray-500 pr-1">{tx.description}</p>
                    <p className="text-[10px] text-gray-400 mt-1 font-mono">{tx.transactionDate || formatDate(tx.createdAt)}</p>
                  </div>
                </div>
                <div className={`text-left sm:text-right shrink-0 px-2 py-1 rounded-lg ${isIncome ? 'bg-emerald-50' : 'bg-red-50'}`}>
                  <p className={`text-base font-black font-currency ${isIncome ? 'text-emerald-700' : 'text-red-700'}`}>
                    {isIncome ? '+' : '-'}{formatCurrency(Math.abs(tx.amount))}
                  </p>
                </div>
              </div>
            );
          })}
          {filteredTx.length === 0 && (
            <div className="text-center py-16">
              <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <ArrowRightLeft size={28} className="text-gray-400" />
              </div>
              <p className="text-base font-bold text-gray-900 mb-1">لا توجد حركات مالية</p>
              <p className="text-sm text-gray-500">لم يتم تسجيل أي عمليات إيداع أو سحب حتى الآن.</p>
            </div>
          )}
        </div>
      </div>

      {/* SlideOver: حركة يدوية جديدة */}
      <SlideOver isOpen={slideOpen} onClose={() => setSlideOpen(false)} title="إضافة حركة مالية">
        <div className="space-y-5 pb-20">
          <div className="bg-bunyan-50 border border-bunyan-100 rounded-xl p-4 mb-2">
            <p className="text-xs text-bunyan-800 font-bold leading-relaxed">
              تُستخدم الحركات اليدوية لتسجيل المصروفات أو سحب الأرباح أو ضخ مبالغ خارجية للخزينة.
            </p>
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-900 mb-1.5">نوع الحركة المالية <span className="text-red-500">*</span></label>
            <div className="grid grid-cols-2 gap-3">
              <label className={`border rounded-xl p-3 cursor-pointer transition-all ${newTx.transactionType === 'income' ? 'bg-emerald-50 border-emerald-500 ring-1 ring-emerald-500' : 'bg-white border-gray-200 hover:border-emerald-300'}`}>
                <input type="radio" className="peer sr-only" name="txType" value="income" checked={newTx.transactionType === 'income'} onChange={() => setNewTx({ ...newTx, transactionType: 'income' })} />
                <div className="flex items-center gap-2 mb-1 text-emerald-700 font-bold text-sm"><ArrowUpCircle size={16}/> إيراد</div>
                <p className="text-[10px] text-gray-500">ضخ مال وإيرادات</p>
              </label>
              <label className={`border rounded-xl p-3 cursor-pointer transition-all ${newTx.transactionType === 'expense' ? 'bg-red-50 border-red-500 ring-1 ring-red-500' : 'bg-white border-gray-200 hover:border-red-300'}`}>
                <input type="radio" className="peer sr-only" name="txType" value="expense" checked={newTx.transactionType === 'expense'} onChange={() => setNewTx({ ...newTx, transactionType: 'expense' })} />
                <div className="flex items-center gap-2 mb-1 text-red-700 font-bold text-sm"><ArrowDownCircle size={16}/> مصروف</div>
                <p className="text-[10px] text-gray-500">مصروفات تشغيلية</p>
              </label>
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-900 mb-1.5">حساب الخزينة <span className="text-red-500">*</span></label>
            <select value={newTx.accountId} onChange={e => setNewTx({ ...newTx, accountId: e.target.value })}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-bunyan-500/30 focus:border-bunyan-500">
              <option value="">اختر الحساب...</option>
              {myAccounts.map(a => (
                <option key={a.id} value={a.id}>{a.accountName} (الأرصدة: {formatCurrency(a.balance)})</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-gray-900 mb-1.5">تاريخ الحركة <span className="text-red-500">*</span></label>
              <input type="date" value={newTx.transactionDate} onChange={(e) => setNewTx({ ...newTx, transactionDate: e.target.value })}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-bunyan-500/30 focus:border-bunyan-500 transition-colors" />
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-900 mb-1.5">المبلغ بالدينار <span className="text-red-500">*</span></label>
              <div className="relative">
                <input type="text" value={getFormattedAmount(newTx.amount)} onChange={(e) => handleAmountChange(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-xl text-lg font-mono font-black text-left focus:outline-none focus:ring-2 focus:ring-bunyan-500/30 focus:border-bunyan-500 transition-colors" placeholder="0" dir="ltr" />
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-bold text-gray-400">د.ل</div>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-900 mb-1.5">البيان / الوصف <span className="text-red-500">*</span></label>
            <textarea rows={2} value={newTx.description} onChange={(e) => setNewTx({ ...newTx, description: e.target.value })}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-bunyan-500/30 focus:border-bunyan-500 resize-none transition-colors" placeholder="توضيح تفاصيل الحركة..." />
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-900 mb-1.5">صورة المرفق / الإيصال <span className="text-gray-400 font-normal text-xs">(اختياري)</span></label>
            <input type="file" accept="image/*"
              className="w-full file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-bunyan-50 file:text-bunyan-700 hover:file:bg-bunyan-100 text-sm text-gray-500" />
          </div>

          <div className="fixed bottom-0 left-0 w-full sm:w-[500px] p-4 bg-white border-t border-gray-100 z-10 hidden sm:block">
            <button onClick={handleAddTx} className="w-full py-3 bg-bunyan-600 text-white font-bold rounded-xl hover:bg-bunyan-700 transition-all text-sm shadow-md">
              حفظ وتسجيل الحركة
            </button>
          </div>
          <button onClick={handleAddTx} className="sm:hidden w-full py-3 bg-bunyan-600 text-white font-bold rounded-xl hover:bg-bunyan-700 transition-all text-sm shadow-md mt-6">
            حفظ وتسجيل الحركة
          </button>
        </div>
      </SlideOver>
    </div>
  );
}
