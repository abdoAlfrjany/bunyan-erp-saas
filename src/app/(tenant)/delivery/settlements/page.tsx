// src/app/(tenant)/delivery/settlements/page.tsx
// الوظيفة: التسويات المالية — جدول قيد التحصيل لكل شركة + تسوية جديدة
// الجداول: courier_companies, treasury_accounts, treasury_transactions
// الصلاحية: OWNER فقط

'use client';

import { useState, useMemo } from 'react';
import { useAuthStore } from '@/core/auth/store';
import { useDataStore } from '@/core/db/store';
import { formatCurrency } from '@/shared/utils/format';
import { SlideOver } from '@/shared/components/ui/SlideOver';
import { useToast } from '@/shared/components/ui/Toast';
import { Banknote, ArrowDownToLine, CheckCircle2, AlertTriangle, FileText, Printer } from 'lucide-react';
import type { Order } from '@/core/db/seed';

export default function SettlementsPage() {
  const { user } = useAuthStore();
  const { couriers, treasury, orders, getForTenant, updateCourier, addTransaction, updateOrderStatus } = useDataStore();
  const { showToast } = useToast();
  const tid = user?.tenantId || '';
  
  const myCouriers = getForTenant(couriers, tid).filter((c) => c.isActive);
  const myTreasury = getForTenant(treasury, tid);
  const myOrders: Order[] = getForTenant(orders, tid);
  const cashAccount = myTreasury.find((a) => a.accountType === 'cash_in_hand');

  const [slideOpen, setSlideOpen] = useState(false);
  const [statementOpen, setStatementOpen] = useState(false);
  const [selectedCourier, setSelectedCourier] = useState<string | null>(null);
  const [receivedAmount, setReceivedAmount] = useState<string | number>('');

  const totalPending = useMemo(() => myCouriers.reduce((sum, c) => sum + c.pendingAmount, 0), [myCouriers]);
  const courier = myCouriers.find((c) => c.id === selectedCourier);

  const openSettlement = (courierId: string) => {
    const c = myCouriers.find((x) => x.id === courierId);
    setSelectedCourier(courierId);
    setReceivedAmount(c?.pendingAmount || 0);
    setSlideOpen(true);
  };

  const openStatement = (courierId: string) => {
    setSelectedCourier(courierId);
    setStatementOpen(true);
  };

  const handleSettle = () => {
    const amt = Number(receivedAmount);
    if (!courier || !cashAccount) return;
    if (amt <= 0) {
      showToast('المبلغ المستلم غير صالح', 'error');
      return;
    }
    
    const diff = courier.pendingAmount - amt;

    // تحديث pending amount الشركة (الديون الخاصة بها)
    updateCourier(courier.id, { pendingAmount: diff > 0 ? diff : 0 });

    // 2. تحديث حالات الطلبيات بعد التسوية مع الشركة (حسب طلب المستخدم)
    myOrders.forEach(o => {
      if (o.courierCompanyId === courier.id && o.status === 'delivered' && o.paymentStatus === 'with_courier_company') {
        updateOrderStatus(o.id, 'delivered', 'settled_to_treasury');
      }
    });

    // إضافة حركة خزينة
    addTransaction({
      id: `tt-settle-${Date.now()}`, tenantId: tid, accountId: cashAccount.id,
      transactionType: 'courier_settlement', amount: amt,
      description: `تسوية أرباح ${courier.name} — المتوقع: ${formatCurrency(courier.pendingAmount)} | المستلم: ${formatCurrency(amt)}${diff > 0 ? ` | العجز/باقي: ${formatCurrency(diff)}` : ''}`,
      createdAt: new Date().toISOString().split('T')[0],
      transactionDate: new Date().toISOString(),
    });

    setSlideOpen(false);
    setSelectedCourier(null);
    showToast(`تمت التسوية بنجاح وتم إيداع ${formatCurrency(amt)} بالخزينة`, 'success');
  };

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Banknote size={24} className="text-bunyan-600" />
            التسويات المالية مع الشركات
          </h1>
          <p className="text-sm text-gray-500 mt-1">إدخال الأموال المحصلة من شركات التوصيل إلى خزينة المتجر</p>
        </div>
      </div>

      {/* stat */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm flex items-center gap-4">
        <div className="w-14 h-14 bg-bunyan-50 rounded-2xl flex items-center justify-center shrink-0">
          <Banknote size={28} className="text-bunyan-600" />
        </div>
        <div>
          <p className="text-sm font-bold text-gray-500 mb-1">إجمالي الأموال العالقة لدى كل الشركات</p>
          <p className="text-3xl font-black text-gray-900 font-currency tracking-tight">{formatCurrency(totalPending)}</p>
        </div>
      </div>

      {/* جدول الشركات */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-right">
            <thead className="bg-gray-50 text-gray-500 font-medium border-b border-gray-100">
              <tr>
                <th className="px-6 py-4">اسم الشركة الناقلة</th>
                <th className="px-6 py-4">إجمالي الشحنات الفعالة</th>
                <th className="px-6 py-4">المبلغ المستحق لك (أرباحك)</th>
                <th className="px-6 py-4">أخذ الإجراء</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {myCouriers.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50/70 transition-colors">
                  <td className="px-6 py-4 font-bold text-gray-900">{c.name}</td>
                  <td className="px-6 py-4 text-gray-600 font-semibold">{c.totalShipments - c.totalReturned} شحنة</td>
                  <td className="px-6 py-4 font-black text-gray-900 font-currency text-base">
                    {c.pendingAmount > 0 ? formatCurrency(c.pendingAmount) : '-'}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                        <button onClick={() => openSettlement(c.id)} disabled={c.pendingAmount <= 0}
                          className="flex items-center gap-2 px-3 py-1.5 bg-bunyan-600 text-white rounded-lg text-xs font-bold hover:bg-bunyan-700 transition-colors disabled:opacity-50 disabled:bg-gray-300 disabled:text-gray-500 w-fit">
                          <CheckCircle2 size={16} /> تصفية وتحديث
                        </button>
                        <button onClick={() => openStatement(c.id)}
                          className="flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-200 text-gray-700 rounded-lg text-xs font-bold hover:bg-gray-50 transition-colors w-fit">
                          <FileText size={16} /> كشف حساب
                        </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-gray-50 border-t-2 border-gray-200">
              <tr>
                <td className="px-6 py-4 font-bold text-gray-900 whitespace-nowrap">الإجمالي الكلي للشركات النشطة</td>
                <td className="px-6 py-4 font-bold text-gray-900">{myCouriers.reduce((s, c) => s + c.totalShipments - c.totalReturned, 0)}</td>
                <td className="px-6 py-4 font-black text-bunyan-600 font-currency text-lg">{formatCurrency(totalPending)}</td>
                <td className="px-6 py-4"></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* SlideOver: تسوية جديدة */}
      <SlideOver isOpen={slideOpen} onClose={() => setSlideOpen(false)} title={`تسوية مالية — ${courier?.name || ''}`}>
        <div className="space-y-6">
          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5 text-center shadow-inner">
            <p className="text-sm font-bold text-blue-700 mb-1">المبلغ الإجمالي المتوقع تحصيله</p>
            <p className="text-3xl font-black text-blue-900 font-currency">{formatCurrency(courier?.pendingAmount || 0)}</p>
          </div>

          <div className="bg-white p-5 border border-gray-200 rounded-2xl shadow-sm">
            <label className="block text-sm font-bold text-gray-900 mb-3 text-center">كم استلمت منهم نقداً / تحويلاً؟</label>
            <div className="relative max-w-xs mx-auto">
              <input type="number" value={receivedAmount} onChange={(e) => setReceivedAmount(e.target.value)}
                className="w-full px-4 py-3 border-2 border-dashed border-gray-300 rounded-xl text-2xl font-mono font-black text-center focus:outline-none focus:border-bunyan-500 text-gray-900 transition-colors" placeholder="0" />
            </div>
            
            {courier && Number(receivedAmount) !== courier.pendingAmount && Number(receivedAmount) > 0 && (
              <div className={`mt-4 mx-auto max-w-xs rounded-xl p-3 text-xs font-bold text-center border shadow-sm ${Number(receivedAmount) < courier.pendingAmount ? 'bg-amber-50 text-amber-800 border-amber-200' : 'bg-emerald-50 text-emerald-800 border-emerald-200'}`}>
                {Number(receivedAmount) < courier.pendingAmount ? (
                  <span className="flex items-center justify-center gap-1.5"><AlertTriangle size={14}/> يوجد نقص قدره: {formatCurrency(Math.abs(courier.pendingAmount - Number(receivedAmount)))} (سيبقى في ذمتهم)</span>
                ) : (
                  <span>✅ يوجد فائض: {formatCurrency(Math.abs(courier.pendingAmount - Number(receivedAmount)))}</span>
                )}
              </div>
            )}
          </div>

          <div className="bg-gray-50 rounded-xl p-4 border border-gray-100 flex items-center justify-between">
            <p className="text-sm font-bold text-gray-600 tracking-tight">ستدخل هذه الأموال فوراً إلى الحساب المالي:</p>
            <p className="text-sm font-black text-gray-900 flex items-center gap-1.5"><ArrowDownToLine size={16} className="text-emerald-600" /> {cashAccount?.accountName || 'خزينة النقد'}</p>
          </div>

          <button onClick={handleSettle} disabled={!receivedAmount || Number(receivedAmount) <= 0}
            className="w-full py-4 bg-bunyan-600 text-white font-black rounded-xl hover:bg-bunyan-700 transition-all text-base shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed mt-4 flex items-center justify-center gap-2">
            تم الاستلام واعتماد التسوية <CheckCircle2 size={18} />
          </button>
        </div>
      </SlideOver>

      {/* SlideOver: كشف حساب */}
      <SlideOver isOpen={statementOpen} onClose={() => setStatementOpen(false)} title={`كشف حساب مندوب — ${courier?.name || ''}`}>
         <div className="space-y-6">
            <div className="flex justify-between items-center bg-gray-50 p-4 rounded-xl border border-gray-100 mb-4">
               <div>
                  <p className="text-xs font-bold text-gray-500 mb-1">صافي الحساب مستحق الدفع (لنا)</p>
                  <p className="text-2xl font-black text-gray-900 font-currency">{formatCurrency(courier?.pendingAmount || 0)}</p>
               </div>
               <button onClick={() => { showToast('جاري استدعاء الطابعة...', 'info'); setTimeout(() => window.print(), 500); }} 
                 className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-bold hover:bg-gray-800">
                 <Printer size={16} /> طباعة الكشف
               </button>
            </div>

            <div className="border border-gray-100 rounded-xl overflow-hidden border-b-0 print:border-none print:shadow-none bg-white">
               <table className="w-full text-xs text-right print:text-black">
                  <thead className="bg-gray-50 text-gray-600 font-bold border-b border-gray-100 print:bg-transparent print:border-b-2 print:border-black">
                     <tr>
                        <th className="px-4 py-3">رقم التتبع</th>
                        <th className="px-4 py-3">الزبون والمدينة</th>
                        <th className="px-4 py-3">قيمة الطلبية</th>
                        <th className="px-4 py-3">أجرة التوصيل</th>
                        <th className="px-4 py-3">الصافي للمتجر</th>
                     </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 print:divide-gray-300">
                     {myOrders.filter(o => o.courierCompanyId === courier?.id && o.status === 'delivered').map(o => {
                        const netToUs = o.total - (o.deliveryFee || 0);
                        return (
                           <tr key={o.id} className="hover:bg-gray-50 print:hover:bg-transparent py-1">
                              <td className="px-4 py-3 font-mono font-bold">{o.orderNumber}</td>
                              <td className="px-4 py-3">{o.customerName} ({o.customerCity})</td>
                              <td className="px-4 py-3 font-currency">{formatCurrency(o.total)}</td>
                              <td className="px-4 py-3 font-currency text-red-600 print:text-black">{formatCurrency(o.deliveryFee || 0)}</td>
                              <td className="px-4 py-3 font-currency font-black text-emerald-600 print:text-black">{formatCurrency(netToUs)}</td>
                           </tr>
                        );
                     })}
                     {myOrders.filter(o => o.courierCompanyId === courier?.id && o.status === 'delivered').length === 0 && (
                        <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400 font-bold">لا توجد طلبيات مسلّمة مسجلة في عهدة هذا المندوب حتى الآن.</td></tr>
                     )}
                  </tbody>
               </table>
            </div>
         </div>
         <style dangerouslySetInnerHTML={{__html: `
           @media print {
             body * { visibility: hidden; }
             .slide-over-content * { visibility: visible; }
             .slide-over-content { position: absolute; left: 0; top: 0; width: 100%; height: auto; outline: none; box-shadow: none; border: none; overflow: visible; padding: 20px;}
             @page { size: auto; margin: 20mm; }
           }
         `}} />
      </SlideOver>
    </div>
  );
}
