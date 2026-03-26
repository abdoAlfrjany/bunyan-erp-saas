'use client';

import { useState, useMemo, useCallback } from 'react';
import { useUser } from '@/core/auth/hooks';
import { useFetchVanexSettlements, useApplyVanexSettlement } from '@/core/db/hooks';
import { useCouriersQuery, useSettlementsQuery } from '@/core/db/hooks/useCouriers';
import { useTreasuryQuery } from '@/core/db/hooks/useTreasury';
import { useQueryClient } from '@tanstack/react-query';
import { formatCurrency, formatDate } from '@/shared/utils/format';
import { useToast } from '@/shared/components/ui/Toast';
import {
  Landmark, RefreshCw, CheckCircle2, Clock,
  AlertCircle, Loader2, Banknote,
  Building2, ChevronDown, ChevronUp, ArrowDownCircle,
  Wallet, CreditCard, Send, Info
} from 'lucide-react';
import type { VanexSettlement, TreasuryAccount } from '@/core/types';

export default function SettlementsPage() {
  const user = useUser();
  const tid = user?.tenantId || '';
  const queryClient = useQueryClient();

  const { data: couriers = [] } = useCouriersQuery(tid);
  const { data: treasuryData } = useTreasuryQuery(tid);
  const { data: vanexSettlements = [] } = useSettlementsQuery(tid);

  const treasury = treasuryData?.accounts || [];

  const fetchVanexSettlements = useFetchVanexSettlements();
  const applyVanexSettlement = useApplyVanexSettlement();
  const { showToast } = useToast();

  const myCompanies = useMemo(() => couriers.filter(
    c => c.isActive && c.isApiConnected && c.apiProvider !== 'none'
  ), [couriers]);
  const myAccounts = treasury;
  const mySettlements = vanexSettlements;

  const cashAccount = myAccounts.find(a => a.accountType === 'cash_in_hand');
  const bankAccount = myAccounts.find(a => a.accountType === 'bank');
  const courierAccounts = myAccounts.filter(a => a.accountType === 'with_courier');

  const totalPending = myAccounts
    .filter((a: TreasuryAccount) => a.accountType === 'with_courier')
    .reduce((sum: number, a: TreasuryAccount) => sum + (a.balance || 0), 0);

  const [fetchingId, setFetchingId] = useState<string | null>(null);
  const [applyingId, setApplyingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'applied'>('all');
  const [filterCourier, setFilterCourier] = useState<string>('all');
  // Cache للمبالغ الدقيقة بعد جلب التفاصيل
  const [detailsCache, setDetailsCache] = useState<Record<string, VanexSettlement>>({});
  const [loadingDetails, setLoadingDetails] = useState<string | null>(null);

  const filtered = useMemo(() => {
    return mySettlements
      .filter((s: VanexSettlement) => filterStatus === 'all' || s.status === filterStatus)
      .filter((s: VanexSettlement) => filterCourier === 'all' || s.courierCompanyId === filterCourier)
      .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  }, [mySettlements, filterStatus, filterCourier]);

  const pendingCount = mySettlements.filter(s => s.status === 'pending').length;
  const appliedCount = mySettlements.filter(s => s.status === 'applied').length;
  const totalApplied = mySettlements
    .filter(s => s.status === 'applied')
    .reduce((sum, s) => sum + s.netAmount, 0);

  // جلب التفاصيل الدقيقة عند فتح تسوية تقريبية
  const handleExpand = useCallback(async (settlement: VanexSettlement) => {
    const isNowExpanded = expandedId === settlement.id;
    if (isNowExpanded) {
      setExpandedId(null);
      return;
    }
    setExpandedId(settlement.id);
    // إذا كانت مبالغها تقريبية ولم تُحمَّل بعد، نجلب التفاصيل
    if (settlement.isApproximate && !detailsCache[settlement.id]) {
      setLoadingDetails(settlement.id);
      try {
        const res = await fetch(
          `/api/vanex/settlements/details?vanexId=${settlement.vanexSettlementId}&courierId=${settlement.courierCompanyId}`
        );
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.settlement) {
            setDetailsCache(prev => ({ ...prev, [settlement.id]: data.settlement }));
            queryClient.invalidateQueries({ queryKey: ['settlements', tid] });
          }
        }
      } finally {
        setLoadingDetails(null);
      }
    }
  }, [expandedId, detailsCache, queryClient, tid]);

  const handleFetch = async (courierId: string) => {
    const courier = myCompanies.find(c => c.id === courierId);
    if (!courier) return;
    setFetchingId(courierId);
    try {
      const result = await fetchVanexSettlements(courierId);
      // إعادة جلب التسويات من قاعدة البيانات
      queryClient.invalidateQueries({ queryKey: ['settlements', tid] });
      if (result.success) {
        showToast('✅ تم إرسال طلب التسوية إلى فانكس بنجاح. ستظهر التسويات هنا فور معالجتها.', 'success');
      } else {
        showToast(result.error || 'فشل إرسال طلب التسوية', 'error');
      }
    } finally {
      setFetchingId(null);
    }
  };

  const handleApply = async (settlement: VanexSettlement) => {
    const targetType = settlement.targetAccountType === 'bank' ? 'الخزينة المصرفية' : 'الخزينة النقدية';

    const confirmed = window.confirm(
      `تطبيق تسوية ${settlement.settlementNumber}\n\n` +
      `الإجمالي: ${settlement.totalAmount} د.ل\n` +
      `عمولات التوصيل: ${settlement.deliveryFees} د.ل\n` +
      `عمولة البنك: ${settlement.bankCommission} د.ل\n` +
      `الصافي: ${settlement.netAmount} د.ل\n\n` +
      `سيُودع في: ${targetType}\n\n` +
      `هل تؤكد؟`
    );
    if (!confirmed) return;

    setApplyingId(settlement.id);
    try {
      const result = await applyVanexSettlement(
        settlement.id,
        tid
      );
      if (result.success) {
        queryClient.invalidateQueries({ queryKey: ['settlements', tid] });
        queryClient.invalidateQueries({ queryKey: ['treasury', tid] });
        showToast(
          `✅ تم تطبيق التسوية — ${formatCurrency(settlement.netAmount)} أُضيفت للخزينة`,
          'success'
        );
      } else {
        showToast(result.error || 'فشل تطبيق التسوية', 'error');
      }
    } finally {
      setApplyingId(null);
    }
  };

  const PaymentBadge = ({ method }: { method: VanexSettlement['paymentMethod'] }) => {
    const config = {
      cash: { label: 'كاش', bg: 'bg-emerald-50', text: 'text-emerald-700', icon: <Banknote size={11} /> },
      bank_transfer: { label: 'حوالة', bg: 'bg-blue-50', text: 'text-blue-700', icon: <Landmark size={11} /> },
      online: { label: 'إلكتروني', bg: 'bg-violet-50', text: 'text-violet-700', icon: <CreditCard size={11} /> },
    };
    const c = config[method];
    return (
      <span className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full border font-medium ${c.bg} ${c.text}`}>
        {c.icon} {c.label}
      </span>
    );
  };

  return (
    <div className="space-y-6 animate-fade-in pb-10">

      {/* الهيدر */}
      <div>
        <h1 className="text-2xl font-black text-gray-900 flex items-center gap-2">
          <Landmark size={24} className="text-purple-600" />
          التسويات المالية مع الشركات
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          استلام وتطبيق أموال التسويات من شركات التوصيل على الخزينة
        </p>
      </div>

      {/* بطاقات الأرصدة */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <Wallet size={16} className="text-emerald-600" />
            <span className="text-xs text-gray-500">الخزينة النقدية</span>
          </div>
          <div className="text-xl font-black text-gray-900">
            {formatCurrency(cashAccount?.balance ?? 0)}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <Landmark size={16} className="text-blue-600" />
            <span className="text-xs text-gray-500">الخزينة المصرفية</span>
          </div>
          <div className="text-xl font-black text-gray-900">
            {formatCurrency(bankAccount?.balance ?? 0)}
          </div>
          {!bankAccount && (
            <p className="text-[10px] text-amber-600 mt-1">
              ⚠️ لا توجد خزينة مصرفية
            </p>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <Clock size={16} className="text-amber-600" />
            <span className="text-xs text-gray-500">قيد التحصيل (كل الشركات)</span>
          </div>
          <div className="text-xl font-black text-amber-600">
            {formatCurrency(totalPending)}
          </div>
        </div>
      </div>

      {/* تنبيه الأتمتة */}
      <div className="bg-purple-50 border border-purple-100 rounded-2xl p-4 flex items-start gap-3 shadow-sm">
        <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0">
          <Info size={16} className="text-purple-600" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-purple-900">نظام التسوية الآلي مفعّل</h3>
          <p className="text-[11px] text-purple-700 leading-relaxed mt-0.5">
            عند إرسال طلب تسوية، يتم جلبها من فانكس بحالة &quot;قيد الانتظار&quot;. وبمجرد أن يوافق عليها محاسب فانكس (حالة مدفوعة)، سيقوم النظام آلياً وبدون تدخل منك بإيداع الأموال في خزينتك كل 15 دقيقة.
          </p>
        </div>
      </div>

      {/* قسم جلب التسويات */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
          <RefreshCw size={15} className="text-bunyan-600" />
          جلب التسويات من الشركات المربوطة
        </h2>

        {myCompanies.length === 0 ? (
          <div className="text-center py-6">
            <Building2 size={32} className="mx-auto text-gray-300 mb-2" />
            <p className="text-sm text-gray-400">
              لا توجد شركات مربوطة بـ API
            </p>
            <p className="text-xs text-gray-400 mt-1">
              اذهب لإدارة الشركات وافعّل ربط الحساب أولاً
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {myCompanies.map(company => {
              const courierAcc = courierAccounts.find(
                a => a.linkedCourierId === company.id
              );
              return (
                <div
                  key={company.id}
                  className="flex items-center justify-between p-3 rounded-xl border border-gray-100 hover:border-gray-200 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-800">{company.name}</p>
                      <p className="text-[11px] text-gray-400">
                        قيد التحصيل: {formatCurrency((courierAcc as unknown as TreasuryAccount)?.balance ?? 0)}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleFetch(company.id)}
                    disabled={fetchingId === company.id}
                    className="inline-flex items-center gap-1.5 text-xs bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-xl transition-all shadow-sm hover:shadow-md disabled:opacity-50"
                  >
                    {fetchingId === company.id ? (
                      <><Loader2 size={13} className="animate-spin" /> جاري الإرسال...</>
                    ) : (
                      <><Send size={13} /> إرسال طلب تسوية</>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* قائمة التسويات */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-gray-700">
            التسويات ({mySettlements.length})
            {pendingCount > 0 && (
              <span className="mr-2 text-[11px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                {pendingCount} معلّقة
              </span>
            )}
          </h2>

          {/* فلاتر */}
          <div className="flex gap-2">
            <select
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value as 'all' | 'pending' | 'applied')}
              className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white text-gray-600"
            >
              <option value="all">كل الحالات</option>
              <option value="pending">معلّقة</option>
              <option value="applied">مطبّقة</option>
            </select>

            <select
              value={filterCourier}
              onChange={e => setFilterCourier(e.target.value)}
              className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white text-gray-600"
            >
              <option value="all">كل الشركات</option>
              {myCompanies.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        </div>

        {filtered.length === 0 && (
          <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-10 text-center">
            <Landmark size={36} className="mx-auto text-gray-300 mb-3" />
            <p className="text-sm text-gray-400">
              {mySettlements.length === 0
                ? 'لا توجد تسويات — اضغط "إرسال طلب تسوية" أولاً'
                : 'لا توجد تسويات تطابق الفلتر'}
            </p>
          </div>
        )}

        {filtered.map(settlement => {
          const courier = couriers.find(c => c.id === settlement.courierCompanyId);
          const isExpanded = expandedId === settlement.id;
          const isApplying = applyingId === settlement.id;

          return (
            <div
              key={settlement.id}
              className={`bg-white rounded-2xl border shadow-sm transition-all ${
                settlement.status === 'applied'
                  ? 'border-gray-100 opacity-75'
                  : 'border-gray-200 hover:shadow-md'
              }`}
            >
              <div className="p-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">

                  {/* معلومات التسوية */}
                  <div className="flex-1 space-y-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-gray-900 text-sm font-mono">
                        {settlement.settlementNumber}
                      </span>
                      <PaymentBadge method={settlement.paymentMethod} />
                      {settlement.status === 'applied' ? (
                        <span className="inline-flex items-center gap-1 text-[11px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full">
                          <CheckCircle2 size={10} /> مطبّقة
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full">
                          <Clock size={10} /> معلّقة
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-gray-500">
                      <span>{courier?.name ?? '—'}</span>
                      <span>{settlement.packageCount} شحنة</span>
                      <span>{formatDate(settlement.createdAt)}</span>
                      {settlement.appliedAt && (
                        <span className="text-emerald-600">
                          طُبّقت: {formatDate(settlement.appliedAt)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* المبالغ والأزرار */}
                  <div className="flex items-center gap-3">
                    <div className="text-left">
                      <div className="text-lg font-black text-gray-900 flex items-baseline gap-1">
                        {settlement.isApproximate && !detailsCache[settlement.id] ? (
                          <span className="text-xs font-medium text-amber-500" title="المبلغ تقريبي — افتح للتفاصيل الدقيقة">~</span>
                        ) : null}
                        {formatCurrency((detailsCache[settlement.id] ?? settlement).netAmount)}
                      </div>
                      <div className="text-[10px] text-gray-400 flex items-center gap-1">
                        {settlement.isApproximate && !detailsCache[settlement.id] && (
                          <span className="text-amber-400" title="المبلغ الصافي تقريبي">تقريبي</span>
                        )}
                        صافي → {settlement.targetAccountType === 'bank' ? 'مصرفية' : 'نقدية'}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {settlement.status === 'pending' && (
                        <button
                          onClick={() => handleApply(settlement)}
                          disabled={isApplying}
                          className="inline-flex items-center gap-1.5 text-xs bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white px-3 py-1.5 rounded-lg transition-colors font-medium"
                        >
                          {isApplying ? (
                            <><Loader2 size={12} className="animate-spin" /> جاري...</>
                          ) : (
                            <><ArrowDownCircle size={12} /> تطبيق</>
                          )}
                        </button>
                      )}

                      <button
                        onClick={() => handleExpand(settlement)}
                        className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
                      >
                        {loadingDetails === settlement.id
                          ? <Loader2 size={15} className="animate-spin text-amber-500" />
                          : isExpanded
                            ? <ChevronUp size={15} />
                            : <ChevronDown size={15} />
                        }
                      </button>
                    </div>
                  </div>
                </div>

                {/* تفاصيل موسّعة */}
                {isExpanded && (() => {
                  const exact = detailsCache[settlement.id] ?? settlement;
                  const isLoadingExact = loadingDetails === settlement.id;
                  return (
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    {settlement.isApproximate && !detailsCache[settlement.id] && !isLoadingExact && (
                      <div className="mb-3 flex items-center gap-2 text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                        <AlertCircle size={13} />
                        المبالغ التفصيلية تُحسب من رد فانكس عند المزامنة. قد يختلف الصافي النهائي قليلاً بعد احتساب رسوم التوصيل الدقيقة.
                      </div>
                    )}
                    {isLoadingExact && (
                      <div className="mb-3 flex items-center gap-2 text-xs text-bunyan-600 bg-bunyan-50 border border-bunyan-100 rounded-xl px-3 py-2">
                        <Loader2 size={13} className="animate-spin" />
                        جاري جلب المبالغ الدقيقة من فانكس...
                      </div>
                    )}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {[
                        {
                          label: 'الإجمالي من الشركة',
                          value: formatCurrency(exact.totalAmount),
                          color: 'text-gray-900',
                        },
                        {
                          label: 'عمولات التوصيل',
                          value: exact.deliveryFees > 0
                            ? `-${formatCurrency(exact.deliveryFees)}`
                            : 'مجاني',
                          color: exact.deliveryFees > 0 ? 'text-red-600' : 'text-emerald-600',
                          note: settlement.isApproximate && exact.deliveryFees === 0 ? 'تقريبي' : undefined,
                        },
                        {
                          label: 'عمولة البنك 2%',
                          value: exact.bankCommission > 0
                            ? `-${formatCurrency(exact.bankCommission)}`
                            : 'لا يوجد',
                          color: exact.bankCommission > 0 ? 'text-red-600' : 'text-gray-400',
                        },
                        {
                          label: 'الصافي المُودَع',
                          value: (detailsCache[settlement.id] ? '' : settlement.isApproximate ? '~ ' : '') +
                            formatCurrency(exact.netAmount),
                          color: 'text-emerald-700 font-bold',
                        },
                      ].map(item => (
                        <div key={item.label} className="bg-gray-50 rounded-xl p-3">
                          <div className="text-[10px] text-gray-400 mb-1">{item.label}</div>
                          <div className={`text-sm font-semibold ${item.color}`}>
                            {item.value}
                          </div>
                          {item.note && <div className="text-[9px] text-amber-500 mt-0.5">{item.note}</div>}
                        </div>
                      ))}
                    </div>

                    <div className="mt-3 flex items-center gap-2 text-xs text-gray-500 bg-gray-50 rounded-xl p-3">
                      {settlement.targetAccountType === 'bank'
                        ? <><Landmark size={13} className="text-blue-500" /> سيُودَع في الخزينة المصرفية</>
                        : <><Banknote size={13} className="text-emerald-500" /> سيُودَع في الخزينة النقدية</>
                      }
                    </div>
                  </div>
                );})()}
              </div>
            </div>
          );
        })}
      </div>

      {/* ملخص إجمالي */}
      {appliedCount > 0 && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-emerald-700">
            <CheckCircle2 size={16} />
            <span>{appliedCount} تسوية مطبّقة</span>
          </div>
          <div className="font-black text-emerald-700">
            {formatCurrency(totalApplied)}
          </div>
        </div>
      )}
    </div>
  );
}
