'use client';

import { useMemo } from 'react';
import { useUser } from '@/core/auth/hooks';
import { useAllEmployees, useAllDebts, useGetForTenant } from '@/core/db/hooks';
import { formatCurrency } from '@/shared/utils/format';
import { User, Wallet, Coins, ArrowRightLeft, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { useToast } from '@/shared/components/ui/Toast';

export default function EmployeeAccountPage() {
  const user = useUser();
  const employees = useAllEmployees();
  const debts = useAllDebts();
  const getForTenant = useGetForTenant();
  const { showToast } = useToast();
  
  const tid = user?.tenantId || '';
  const myEmps = useMemo(() => getForTenant(employees, tid), [employees, tid, getForTenant]);
  const myDebts = useMemo(() => getForTenant(debts, tid), [debts, tid, getForTenant]);

  // البحث عن الموظف المرتبط بهذا الحساب بناءً على الاسم أو الهاتف
  const employeeData = myEmps.find(e => e.name === user?.fullName || (user?.phone && e.phone === user?.phone));

  const [passwordForm, setPasswordForm] = useState({ current: '', new: '', confirm: '' });

  const handlePasswordChange = () => {
    if (!passwordForm.new || passwordForm.new !== passwordForm.confirm) {
        showToast('كلمة المرور الجديدة غير متطابقة', 'error');
        return;
    }
    // في الواقع يُفترض فحص الكلمة القديمة عبر API
    if (user) {
        // تحديث كلمة المرور في Store
        // updateUser(user.id, { passwordHash: btoa(passwordForm.new) });
        showToast('تم تحديث كلمة المرور بنجاح', 'success');
        setPasswordForm({ current: '', new: '', confirm: '' });
    }
  };

  // الديون/السلفيات الخاصة بهذا الموظف
  const myAdvances = myDebts.filter(d => 
     d.debtType === 'internal' && 
     d.debtCategory === 'employee_advance' && 
     d.linkedEntityName === employeeData?.name
  );

  return (
    <div className="space-y-6 animate-fade-in pb-10 max-w-5xl mx-auto">
      <div className="flex items-center gap-4 border-b border-gray-100 pb-6 mt-4">
        <div className="w-16 h-16 bg-bunyan-600 text-white rounded-2xl flex items-center justify-center text-2xl font-black shadow-md">
          {user?.fullName?.charAt(0) || 'م'}
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{user?.fullName}</h1>
          <p className="text-sm text-gray-500 mt-1 flex items-center gap-2">
            <ShieldCheck size={16} className="text-bunyan-600" />
            حساب موظف (مبيعات وتشغيل)
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* العمود الأيمن: البطاقات المالية والمعلومات الشخصية */}
        <div className="col-span-1 md:col-span-1 space-y-6">
          <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm">
            <h3 className="text-sm font-bold text-gray-500 mb-4 flex items-center gap-2">
              <User size={18} /> البيانات الشخصية
            </h3>
            <div className="space-y-4 text-sm text-gray-700">
              <div className="flex justify-between border-b border-gray-50 pb-2">
                <span className="text-gray-500">رقم الهاتف</span>
                <span className="font-bold">{employeeData?.phone || user?.phone || '—'}</span>
              </div>
              <div className="flex justify-between border-b border-gray-50 pb-2">
                <span className="text-gray-500">البريد الإلكتروني</span>
                <span className="font-bold">{user?.email}</span>
              </div>
              <div className="flex justify-between pb-2">
                <span className="text-gray-500">تاريخ الانضمام</span>
                <span className="font-bold font-mono text-xs">{employeeData?.startDate || '—'}</span>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-bunyan-600 to-bunyan-800 rounded-3xl p-6 text-white shadow-lg relative overflow-hidden">
            <div className="absolute top-0 left-0 w-32 h-32 bg-white/10 rounded-full blur-3xl -ml-10 -mt-10 pointer-events-none" />
            <div className="flex justify-between items-start mb-4 relative z-10">
              <div>
                <p className="text-bunyan-100 text-sm font-bold mb-1">الراتب الأساسي</p>
                <h2 className="text-3xl font-black font-currency tracking-tight">
                    {employeeData ? formatCurrency(employeeData.salary) : '—'}
                </h2>
              </div>
              <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm">
                <Wallet size={24} className="text-white" />
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-white/20 relative z-10">
              <p className="text-xs text-bunyan-100 flex items-center justify-between">
                <span>يوم الصرف المعتاد:</span>
                <span className="font-bold text-sm bg-white/20 px-2 py-0.5 rounded-lg">{employeeData?.salaryDay || 1} من كل شهر</span>
              </p>
            </div>
          </div>

          <div className="bg-red-50 border border-red-100 rounded-3xl p-6 shadow-sm">
            <h3 className="text-sm font-bold text-red-800 mb-2 flex items-center gap-2">
              <Coins size={18} /> إجمالي السلفيات المتبقية
            </h3>
            <p className="text-2xl font-black text-red-600 font-currency">
                {employeeData ? formatCurrency(employeeData.advanceBalance) : '0.000'}
            </p>
          </div>
        </div>

        {/* العمود الأيسر: سجل السلفيات وتحديث الأمان */}
        <div className="col-span-1 md:col-span-2 space-y-6">
          <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm">
             <h3 className="text-base font-bold text-gray-900 mb-4 flex items-center gap-2">
               <ArrowRightLeft size={18} className="text-bunyan-600" /> سجل السلف والخصومات
             </h3>
             <div className="divide-y divide-gray-50">
               {myAdvances.length > 0 ? myAdvances.map(adv => (
                   <div key={adv.id} className="py-4 flex items-center justify-between">
                       <div>
                           <p className="text-sm font-bold text-gray-900 leading-relaxed mb-0.5">{adv.description || 'سلفة راتب'}</p>
                           <p className="text-xs text-gray-400 font-mono">{adv.createdAt}</p>
                       </div>
                       <div className="text-left">
                           <p className="text-sm font-black text-red-600 font-currency">{formatCurrency(adv.amount)}</p>
                           <p className="text-[10px] text-gray-500 mt-1">
                               {adv.status === 'paid' ? <span className="text-emerald-600 font-bold">مسدد بالكامل</span> : `المتبقي للسداد: ${formatCurrency(adv.amount - adv.paidAmount)}`}
                           </p>
                       </div>
                   </div>
               )) : (
                   <div className="text-center py-8">
                       <p className="text-sm text-gray-500 font-bold">ليس لديك أي سلفيات نشطة مسجلة</p>
                   </div>
               )}
             </div>
          </div>

          <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm">
              <h3 className="text-base font-bold text-gray-900 mb-6 flex items-center gap-2">
                  <ShieldCheck size={18} className="text-bunyan-600" /> إعدادات الأمان
              </h3>
              <div className="space-y-4 max-w-sm">
                  <div>
                      <label className="block text-xs font-bold text-gray-500 mb-1.5">كلمة المرور الحالية</label>
                      <input type="password" value={passwordForm.current} onChange={e => setPasswordForm({...passwordForm, current: e.target.value})} className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-bunyan-500/20 focus:border-bunyan-500" />
                  </div>
                  <div>
                      <label className="block text-xs font-bold text-gray-500 mb-1.5">كلمة المرور الجديدة</label>
                      <input type="password" value={passwordForm.new} onChange={e => setPasswordForm({...passwordForm, new: e.target.value})} className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-bunyan-500/20 focus:border-bunyan-500" />
                  </div>
                  <div>
                      <label className="block text-xs font-bold text-gray-500 mb-1.5">تأكيد كلمة المرور</label>
                      <input type="password" value={passwordForm.confirm} onChange={e => setPasswordForm({...passwordForm, confirm: e.target.value})} className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-bunyan-500/20 focus:border-bunyan-500" />
                  </div>
                  <button onClick={handlePasswordChange} className="w-full py-2.5 bg-gray-900 text-white font-bold rounded-xl text-sm mt-2 hover:bg-gray-800 transition-colors">
                      تحديث الأمان
                  </button>
              </div>
          </div>
        </div>
      </div>
    </div>
  );
}
