'use client';

import { useState, useMemo } from 'react';
import { useAuthStore } from '@/core/auth/store';
import { useDataStore } from '@/core/db/store';
import { formatCurrency } from '@/shared/utils/format';
import { SlideOver } from '@/shared/components/ui/SlideOver';
import { ConfirmDialog } from '@/shared/components/ui/ConfirmDialog';
import { useToast } from '@/shared/components/ui/Toast';
import { Plus, Trash2, Edit2, CalendarDays, AlertCircle, Coins, HeartHandshake, Users, Filter, Search, FileText, Key, CheckSquare, Square, Download, Activity, FileDown } from 'lucide-react';
import type { Employee, UserPermissions } from '@/core/db/seed';

export default function HRPage() {
  const { user } = useAuthStore();
  const { employees, getForTenant, addEmployee, updateEmployee, deleteEmployee, addUser, issuePayroll, recordEmployeeFinancial } = useDataStore();
  const { showToast } = useToast();
  const tid = user?.tenantId || '';
  const myEmps = getForTenant(employees, tid);
  
  const totalSalaries = myEmps.reduce((s, e) => s + e.salary, 0);
  const totalAdvances = myEmps.reduce((s, e) => s + e.advanceBalance, 0);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'on_leave' | 'terminated'>('all');
  const [jobTitleFilter, setJobTitleFilter] = useState<string>('all');

  // Add/Edit Employee Form
  const [slideOpen, setSlideOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: '', phone: '', email: '', password: '', 
    jobTitle: 'موظف مبيعات', employmentType: 'full_time' as Employee['employmentType'], 
    salary: 0, salaryDay: 1, startDate: new Date().toISOString().split('T')[0], status: 'active' as Employee['status'],
    nationalId: '', personalAddress: '', hasSystemAccess: false,
    role: 'sales', customPerms: { orders: false, inventory: false, delivery: false }
  });

  // Payroll Issue
  const [payrollSlideOpen, setPayrollSlideOpen] = useState(false);
  const [payrollMonth, setPayrollMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM
  const [payrollDetails, setPayrollDetails] = useState<{ employeeId: string; netAmount: number; absentDays: number; advanceDeduction: number; allowanceApplied: number; deductionApplied: number }[]>([]);

  // Finance Record
  const [financeSlideOpen, setFinanceSlideOpen] = useState(false);
  const [financeEmpId, setFinanceEmpId] = useState<string | null>(null);
  const [financeForm, setFinanceForm] = useState({ type: 'advance' as 'advance' | 'bonus' | 'deduction', amount: '', reason: '' });

  const [deleteId, setDeleteId] = useState<string | null>(null);

  // --- Filtering ---
  const filteredEmps = useMemo(() => {
    return myEmps.filter(e => {
      const matchName = e.name.includes(searchTerm) || (e.phone && e.phone.includes(searchTerm));
      const matchStatus = statusFilter === 'all' || e.status === statusFilter;
      const matchJob = jobTitleFilter === 'all' || e.jobTitle === jobTitleFilter;
      return matchName && matchStatus && matchJob;
    });
  }, [myEmps, searchTerm, statusFilter, jobTitleFilter]);

  const uniqueJobTitles = Array.from(new Set(myEmps.map(e => e.jobTitle).filter(Boolean)));

  // --- Helpers ---
  const resetForm = () => { 
    setForm({ 
      name: '', phone: '', email: '', password: '', 
      jobTitle: 'موظف مبيعات', employmentType: 'full_time', 
      salary: 0, salaryDay: 1, startDate: new Date().toISOString().split('T')[0], status: 'active',
      nationalId: '', personalAddress: '', hasSystemAccess: false,
      role: 'sales', customPerms: { orders: false, inventory: false, delivery: false }
    }); 
    setEditingId(null); 
  };

  const openEdit = (e: Employee) => {
    setForm({ 
      name: e.name, phone: e.phone, email: e.email || '', password: '', 
      jobTitle: e.jobTitle || 'موظف مبيعات', employmentType: e.employmentType || 'full_time', 
      salary: e.salary, salaryDay: e.salaryDay, startDate: e.startDate, status: e.status,
      nationalId: e.nationalId || '', personalAddress: e.personalAddress || '', hasSystemAccess: e.hasSystemAccess,
      role: 'sales', customPerms: { orders: false, inventory: false, delivery: false }
    });
    setEditingId(e.id);
    setSlideOpen(true);
  };

  const generatePassword = () => {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
    let p = '';
    for(let i=0; i<10; i++) p += chars.charAt(Math.floor(Math.random() * chars.length));
    setForm({...form, password: p});
  };

  const handleSaveEmployee = () => {
    if (!form.name || form.salary < 0) { showToast('يرجى ملء الاسم والراتب بشكل صحيح', 'error'); return; }
    
    if (editingId) {
      updateEmployee(editingId, {
        name: form.name, phone: form.phone, email: form.email,
        jobTitle: form.jobTitle, employmentType: form.employmentType,
        salary: form.salary, salaryDay: form.salaryDay, startDate: form.startDate, status: form.status,
        nationalId: form.nationalId, personalAddress: form.personalAddress, hasSystemAccess: form.hasSystemAccess
      });
      showToast('تم تحديث بيانات الموظف بنجاح', 'success');
    } else {
      const empId = `emp-${Date.now()}`;
      addEmployee({ 
        id: empId, tenantId: tid, 
        name: form.name, phone: form.phone, email: form.email,
        jobTitle: form.jobTitle, employmentType: form.employmentType,
        salary: form.salary, salaryDay: form.salaryDay, startDate: form.startDate, status: form.status,
        nationalId: form.nationalId, personalAddress: form.personalAddress, hasSystemAccess: form.hasSystemAccess,
        advanceBalance: 0, allowanceBalance: 0, deductionBalance: 0, isActive: true
      });
      
      if (form.hasSystemAccess) {
        const passToUse = form.password || '123456';
        const finalEmail = form.email || `${form.phone || Date.now()}@bunyan.ly`;
        
        let perms: UserPermissions = { 
          inventory: { view: false, add: false, edit: false, delete: false, viewCostPrice: false },
          orders: { view: false, add: false, edit: false, delete: false, changeStatus: false, viewAll: false },
          delivery: { view: false, addShipment: false, manageCompanies: false, viewSettlements: false, addSettlement: false },
          treasury: { view: false, addTransaction: false },
          partners: { view: false, viewOwn: false },
          hr: { view: false, viewOwn: true },
          analytics: { view: false, viewFull: false },
          settings: { view: false, edit: false }
        };

        if (form.role === 'sales') {
          perms.orders = { view: true, add: true, edit: true, delete: false, changeStatus: true, viewAll: true };
          perms.inventory.view = true;
        } else if (form.role === 'warehouse') {
          perms.inventory = { view: true, add: true, edit: true, delete: false, viewCostPrice: true };
          perms.orders.view = true;
          perms.orders.changeStatus = true;
        } else if (form.role === 'custom') {
          perms.orders = { view: form.customPerms.orders, add: form.customPerms.orders, edit: form.customPerms.orders, delete: false, changeStatus: form.customPerms.orders, viewAll: form.customPerms.orders };
          perms.inventory = { view: form.customPerms.inventory, add: form.customPerms.inventory, edit: false, delete: false, viewCostPrice: false };
          perms.delivery.view = form.customPerms.delivery;
        }

        addUser({ 
          id: `user-${Date.now()}`, tenantId: tid, fullName: form.name, 
          email: finalEmail, passwordHash: btoa(passToUse), role: 'employee', 
          permissions: perms, isActive: true, 
          createdAt: new Date().toISOString().split('T')[0], phone: form.phone 
        });
        showToast(`تم إضافة الموظف وإنشاء حساب. الباسورد: ${passToUse}`, 'success');
      } else {
        showToast('تم إضافة الموظف بنجاح (بدون حساب دخول)', 'success');
      }
    }
    setSlideOpen(false);
    resetForm();
  };

  // --- Finance Record ---
  const openFinance = (e: Employee) => {
    setFinanceEmpId(e.id);
    setFinanceForm({ type: 'advance', amount: '', reason: '' });
    setFinanceSlideOpen(true);
  };

  const handleSaveFinance = () => {
    if (!financeEmpId || !financeForm.amount || Number(financeForm.amount) <= 0) {
      showToast('يرجى إدخال مبلغ صحيح', 'error'); return;
    }
    const res = recordEmployeeFinancial(financeEmpId, financeForm.type, Number(financeForm.amount), financeForm.reason);
    if (res.success) {
      showToast('تم تسجيل الحركة المالية بنجاح', 'success');
      setFinanceSlideOpen(false);
    } else {
      showToast(res.error || 'حدث خطأ', 'error');
    }
  };

  // --- Payroll ---
  const handleOpenPayroll = () => {
    const activeEmps = myEmps.filter(e => e.status === 'active' || e.status === 'on_leave');
    const initialDetails = activeEmps.map(e => {
      // Calculate fraction if joined this month
      const joinDate = new Date(e.startDate);
      const [pYear, pMonth] = payrollMonth.split('-');
      let factor = 1;
      if (joinDate.getFullYear() === Number(pYear) && (joinDate.getMonth() + 1) === Number(pMonth)) {
         factor = Math.max(0, 30 - joinDate.getDate() + 1) / 30;
      }
      const baseSalary = Math.round(e.salary * factor);
      
      const availableForAdvance = Math.max(0, baseSalary + e.allowanceBalance - e.deductionBalance);
      const computedAdvanceDeduction = Math.min(e.advanceBalance, availableForAdvance);
      
      return {
        employeeId: e.id,
        absentDays: 0,
        advanceDeduction: computedAdvanceDeduction,
        allowanceApplied: e.allowanceBalance,
        deductionApplied: e.deductionBalance,
        netAmount: Math.max(0, baseSalary - computedAdvanceDeduction + e.allowanceBalance - e.deductionBalance)
      };
    });
    setPayrollDetails(initialDetails);
    setPayrollSlideOpen(true);
  };

  const updatePayrollDetail = (empId: string, field: string, value: number) => {
    setPayrollDetails(prev => prev.map(d => {
      if (d.employeeId !== empId) return d;
      const nd = { ...d, [field]: value };
      const e = myEmps.find(x => x.id === empId)!;
      
      const joinDate = new Date(e.startDate);
      const [pYear, pMonth] = payrollMonth.split('-');
      let factor = 1;
      if (joinDate.getFullYear() === Number(pYear) && (joinDate.getMonth() + 1) === Number(pMonth)) {
         factor = Math.max(0, 30 - joinDate.getDate() + 1) / 30;
      }
      
      const absDeduct = Math.round((e.salary / 30) * nd.absentDays);
      const base = Math.round(e.salary * factor) - absDeduct;

      const availableForAdvance = Math.max(0, base + nd.allowanceApplied - nd.deductionApplied);
      if (field !== 'advanceDeduction') {
         nd.advanceDeduction = Math.min(e.advanceBalance, availableForAdvance);
      } else {
         nd.advanceDeduction = Math.min(nd.advanceDeduction, availableForAdvance);
      }

      nd.netAmount = Math.max(0, base - nd.advanceDeduction + nd.allowanceApplied - nd.deductionApplied);
      return nd;
    }));
  };

  const handleSubmitPayroll = () => {
    if (payrollDetails.length === 0) return;
    const total = payrollDetails.reduce((s, d) => s + d.netAmount, 0);
    const confirm = window.confirm(`سيتم صرف مبلغ إجمالي مقداره ${formatCurrency(total)} من الخزينة. هل أنت متأكد؟`);
    if (!confirm) return;

    const res = issuePayroll(tid, payrollMonth, payrollDetails);
    if (res.success) {
      showToast('تم إصدار مسير الرواتب وتسجيل المصروفات في الخزينة بنجاح', 'success');
      setPayrollSlideOpen(false);
    } else {
       showToast(res.error || 'حدث خطأ غير متوقع', 'error');
    }
  };

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Users size={24} className="text-bunyan-600" />
            الموارد البشرية والرواتب
          </h1>
          <p className="text-sm text-gray-500 mt-1">إدارة بيانات الموظفين، إصدار مسيرات الرواتب، وتسجيل السلف</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={handleOpenPayroll} className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-bold hover:bg-emerald-700 transition-colors shadow-sm focus:ring-2 focus:ring-emerald-500/50">
            <Coins size={18} /> إصدار رواتب الشهر
          </button>
          <button onClick={() => { resetForm(); setSlideOpen(true); }} className="flex items-center gap-2 px-4 py-2 bg-bunyan-600 text-white rounded-xl text-sm font-bold hover:bg-bunyan-700 transition-colors shadow-sm focus:ring-2 focus:ring-bunyan-500/50">
            <Plus size={18} /> إضافة موظف جديد
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm flex items-center gap-4 hover:shadow-md transition-shadow">
          <div className="w-14 h-14 bg-bunyan-50 rounded-2xl flex items-center justify-center shrink-0">
            <Users size={28} className="text-bunyan-600" />
          </div>
          <div>
            <p className="text-sm font-bold text-gray-500 mb-1">إجمالي الموظفين</p>
            <p className="text-3xl font-black text-gray-900">{myEmps.length}</p>
          </div>
        </div>
        <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm flex items-center gap-4 hover:shadow-md transition-shadow">
          <div className="w-14 h-14 bg-emerald-50 rounded-2xl flex items-center justify-center shrink-0">
            <Coins size={28} className="text-emerald-600" />
          </div>
          <div>
            <p className="text-sm font-bold text-gray-500 mb-1">كتلة الرواتب الأساسية</p>
            <p className="text-2xl font-black text-emerald-600 font-currency tracking-tight">{formatCurrency(totalSalaries)}</p>
          </div>
        </div>
        <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm flex items-center gap-4 hover:shadow-md transition-shadow">
          <div className="w-14 h-14 bg-red-50 rounded-2xl flex items-center justify-center shrink-0">
            <HeartHandshake size={28} className="text-red-600" />
          </div>
          <div>
            <p className="text-sm font-bold text-gray-500 mb-1">إجمالي السلف العالقة</p>
            <p className="text-2xl font-black text-red-600 font-currency tracking-tight">{formatCurrency(totalAdvances)}</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex flex-col sm:flex-row gap-4 items-center">
         <div className="flex-1 w-full relative">
           <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
           <input type="text" placeholder="البحث بالاسم أو رقم الهاتف..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
              className="w-full pr-10 pl-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-bunyan-500/30 focus:border-bunyan-500 transition-colors" />
         </div>
         <div className="flex items-center gap-3 w-full sm:w-auto">
           <Filter className="text-gray-400" size={18} />
           <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as any)}
             className="px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-bunyan-500/30">
             <option value="all">كل الحالات</option>
             <option value="active">نشط</option>
             <option value="on_leave">في إجازة</option>
             <option value="terminated">منتهي خدمته</option>
           </select>
           <select value={jobTitleFilter} onChange={e => setJobTitleFilter(e.target.value)}
             className="px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-bunyan-500/30">
             <option value="all">كل الوظائف</option>
             {uniqueJobTitles.map(j => <option key={j} value={j}>{j}</option>)}
           </select>
         </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-right">
            <thead className="bg-gray-50 text-gray-500 font-medium border-b border-gray-100">
              <tr>
                <th className="px-6 py-4">الموظف</th>
                <th className="px-6 py-4">الوظيفة والدوام</th>
                <th className="px-6 py-4">الراتب الأساسي</th>
                <th className="px-6 py-4">السلف والمكافآت</th>
                <th className="px-6 py-4">آخر راتب</th>
                <th className="px-6 py-4 text-center">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredEmps.map((e) => (
                <tr key={e.id} className="hover:bg-gray-50/70 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div>
                        <p className="font-bold text-gray-900 flex items-center gap-2">
                           {e.name}
                           {e.status === 'on_leave' && <span className="bg-amber-100 text-amber-700 text-[10px] px-2 py-0.5 rounded-full border border-amber-200">في إجازة</span>}
                           {e.status === 'terminated' && <span className="bg-red-50 text-red-600 text-[10px] px-2 py-0.5 rounded-full border border-red-200">منتهي الخدمة</span>}
                        </p>
                        <p className="text-xs text-gray-500 font-mono mt-0.5">{e.phone || 'بدون رقم'}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <p className="font-semibold text-gray-700">{e.jobTitle || 'غير محدد'}</p>
                    <p className="text-xs text-gray-500">{e.employmentType === 'full_time' ? 'دوام كامل' : e.employmentType === 'part_time' ? 'نصف دوام' : 'عقد مؤقت'}</p>
                  </td>
                  <td className="px-6 py-4 font-black text-gray-900 font-currency">{formatCurrency(e.salary)}</td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col gap-1 text-xs">
                      {e.advanceBalance > 0 && <span className="text-red-600 font-bold bg-red-50 px-2 py-0.5 rounded inline-block w-fit">سلف: {formatCurrency(e.advanceBalance)}</span>}
                      {e.allowanceBalance > 0 && <span className="text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded inline-block w-fit">مكافآت: {formatCurrency(e.allowanceBalance)}</span>}
                      {e.deductionBalance > 0 && <span className="text-amber-600 font-bold bg-amber-50 px-2 py-0.5 rounded inline-block w-fit">خصم معلق: {formatCurrency(e.deductionBalance)}</span>}
                      {e.advanceBalance === 0 && e.allowanceBalance === 0 && e.deductionBalance === 0 && <span className="text-gray-400">—</span>}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-xs text-gray-500 font-semibold">
                    {e.lastPayrollDate ? `شهر ${e.lastPayrollDate}` : 'لم يصرف قط'}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <div className="flex gap-2 justify-center">
                      <button onClick={() => openFinance(e)} className="p-2 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors shadow-sm" title="سلفة / مكافأة / خصم"><HeartHandshake size={16} /></button>
                      <button onClick={() => openEdit(e)} className="p-2 bg-gray-50 hover:bg-bunyan-50 rounded-lg text-gray-600 hover:text-bunyan-600 transition-colors shadow-sm" title="تعديل وبيانات"><Edit2 size={16} /></button>
                      <button onClick={() => setDeleteId(e.id)} className="p-2 bg-gray-50 hover:bg-red-50 rounded-lg text-gray-600 hover:text-red-600 transition-colors shadow-sm" title="حذف"><Trash2 size={16} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filteredEmps.length === 0 && (
          <div className="text-center py-16">
            <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <Users size={28} className="text-gray-400" />
            </div>
            <p className="text-base font-bold text-gray-900 mb-1">لا يوجد موظفين مسجلين</p>
            <p className="text-sm text-gray-500">قم بتغيير فلاتر البحث أو أضف موظف جديد.</p>
          </div>
        )}
      </div>

      {/* Add / Edit Employee SlideOver */}
      <SlideOver isOpen={slideOpen} onClose={() => { setSlideOpen(false); resetForm(); }} title={editingId ? 'تعديل بيانات الموظف' : 'إضافة موظف جديد'} width="max-w-xl">
        <div className="space-y-6 pb-20">
          
          <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 space-y-4">
            <h3 className="text-sm font-bold text-gray-900 pb-2 border-b border-gray-200">1. البيانات الوظيفية الأساسية</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">الاسم الكامل *</label>
                <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-bunyan-500/30 transition-colors" placeholder="مثال: عمر سالم" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">رقم الهاتف</label>
                <input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} dir="ltr" className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-bunyan-500/30 transition-colors text-left" placeholder="09XXXXXXXX" />
              </div>
              <div className="sm:col-span-2 grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1.5">المسمى الوظيفي</label>
                  <select value={form.jobTitle} onChange={e => setForm({...form, jobTitle: e.target.value})} className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-bunyan-500/30">
                    <option value="موظف مبيعات">موظف مبيعات</option>
                    <option value="أمين مخزن">أمين مخزن</option>
                    <option value="محاسب">محاسب</option>
                    <option value="موظف توصيل">موظف توصيل</option>
                    <option value="أخرى">أخرى...</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1.5">نوع الدوام</label>
                  <select value={form.employmentType} onChange={e => setForm({...form, employmentType: e.target.value as any})} className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-bunyan-500/30">
                    <option value="full_time">دوام كامل</option>
                    <option value="part_time">نصف دوام</option>
                    <option value="contract">عقد مؤقت</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">الراتب الأساسي الشهري *</label>
                <div className="relative">
                  <input type="number" min={0} value={form.salary} onChange={(e) => setForm({ ...form, salary: Number(e.target.value) })} className="w-full pr-4 pl-12 py-2 bg-white border border-gray-200 rounded-xl text-sm font-mono font-bold focus:outline-none focus:ring-2 focus:ring-bunyan-500/30" />
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400">د.ل</span>
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">تاريخ الانضمام</label>
                <input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-bunyan-500/30" />
              </div>
            </div>
            
            <label className="flex items-center gap-3 pt-2">
               <span className="text-sm font-bold text-gray-700">حالة الموظف:</span>
               <select value={form.status} onChange={e => setForm({...form, status: e.target.value as any})} className="px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-sm font-bold focus:outline-none focus:ring-2 focus:ring-bunyan-500/30">
                 <option value="active">نشط على رأس العمل</option>
                 <option value="on_leave">في إجازة</option>
                 <option value="terminated">منتهي خدمته / مطرود</option>
               </select>
            </label>
          </div>

          <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 space-y-4">
            <h3 className="text-sm font-bold text-gray-900 pb-2 border-b border-gray-200 flex justify-between items-center">
               <span>2. حساب دخول النظام</span>
               <label className="flex items-center gap-2 cursor-pointer text-bunyan-700">
                  <input type="checkbox" checked={form.hasSystemAccess} onChange={e => setForm({...form, hasSystemAccess: e.target.checked})} className="rounded text-bunyan-600 focus:ring-bunyan-500" />
                  منح حساب دخول
               </label>
            </h3>
            
            {form.hasSystemAccess && (
              <div className="space-y-4 pt-2 animate-fade-in">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1.5">البريد الإلكتروني للدخول</label>
                    <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} dir="ltr" className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-bunyan-500/30 text-left" placeholder="name@bunyan.ly" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-700 mb-1.5 flex justify-between">كلمة المرور <button onClick={generatePassword} className="text-bunyan-600 hover:text-bunyan-800 text-[10px]"><Key size={12} className="inline mr-1"/>توليد عشوائي</button></label>
                    <input type="text" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} dir="ltr" className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-bunyan-500/30 text-left" placeholder="********" />
                  </div>
                </div>

                <div>
                   <label className="block text-xs font-bold text-gray-700 mb-2">الصلاحيات والقوالب</label>
                   <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                     <label className={`border rounded-xl p-3 cursor-pointer transition-all ${form.role === 'sales' ? 'bg-bunyan-50 border-bunyan-500' : 'bg-white border-gray-200'}`}>
                       <input type="radio" className="sr-only" checked={form.role === 'sales'} onChange={() => setForm({...form, role: 'sales'})} />
                       <p className="font-bold text-sm text-gray-900 mb-1">موظف مبيعات</p>
                       <p className="text-[10px] text-gray-500 leading-relaxed">إدارة الطلبيات، إنشاء، عرض، تعديل حالة. رؤية المخزون فقط.</p>
                     </label>
                     <label className={`border rounded-xl p-3 cursor-pointer transition-all ${form.role === 'warehouse' ? 'bg-bunyan-50 border-bunyan-500' : 'bg-white border-gray-200'}`}>
                       <input type="radio" className="sr-only" checked={form.role === 'warehouse'} onChange={() => setForm({...form, role: 'warehouse'})} />
                       <p className="font-bold text-sm text-gray-900 mb-1">أمين مخزن</p>
                       <p className="text-[10px] text-gray-500 leading-relaxed">إدارة تامة للمخزون (إضافة/تعديل)، تعديل حالة الطلبية إلى جاهزة.</p>
                     </label>
                     <label className={`border rounded-xl p-3 cursor-pointer transition-all ${form.role === 'custom' ? 'bg-bunyan-50 border-bunyan-500' : 'bg-white border-gray-200'}`}>
                       <input type="radio" className="sr-only" checked={form.role === 'custom'} onChange={() => setForm({...form, role: 'custom'})} />
                       <p className="font-bold text-sm text-gray-900 mb-1">مُخصص</p>
                       <p className="text-[10px] text-gray-500 leading-relaxed">تحديد الصلاحيات بشكل يدوي</p>
                     </label>
                   </div>
                </div>
                
                {form.role === 'custom' && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm pt-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      {form.customPerms.orders ? <CheckSquare className="text-bunyan-600" size={16}/> : <Square className="text-gray-400" size={16}/>}
                      <span className="text-gray-700">إدارة الطلبيات</span>
                      <input type="checkbox" className="sr-only" checked={form.customPerms.orders} onChange={e => setForm({...form, customPerms: {...form.customPerms, orders: e.target.checked}})} />
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      {form.customPerms.inventory ? <CheckSquare className="text-bunyan-600" size={16}/> : <Square className="text-gray-400" size={16}/>}
                      <span className="text-gray-700">إضافة/تعديل منتجات</span>
                      <input type="checkbox" className="sr-only" checked={form.customPerms.inventory} onChange={e => setForm({...form, customPerms: {...form.customPerms, inventory: e.target.checked}})} />
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      {form.customPerms.delivery ? <CheckSquare className="text-bunyan-600" size={16}/> : <Square className="text-gray-400" size={16}/>}
                      <span className="text-gray-700">شركات التوصيل</span>
                      <input type="checkbox" className="sr-only" checked={form.customPerms.delivery} onChange={e => setForm({...form, customPerms: {...form.customPerms, delivery: e.target.checked}})} />
                    </label>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 space-y-4">
            <h3 className="text-sm font-bold text-gray-900 pb-2 border-b border-gray-200">3. البيانات القانونية (اختياري)</h3>
            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">الرقم الوطني</label>
                <input type="text" value={form.nationalId} onChange={(e) => setForm({ ...form, nationalId: e.target.value })} dir="ltr" className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-bunyan-500/30 transition-colors text-right" placeholder="119..." />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">العنوان الشخصي</label>
                <input type="text" value={form.personalAddress} onChange={(e) => setForm({ ...form, personalAddress: e.target.value })} className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-bunyan-500/30 transition-colors" placeholder="المدينة، المنطقة، الشارع" />
              </div>
            </div>
          </div>

          <button onClick={handleSaveEmployee} className="w-full py-3 bg-bunyan-600 text-white font-bold rounded-xl hover:bg-bunyan-700 transition-all text-sm shadow-md mt-6">
            {editingId ? 'حفظ التعديلات' : 'اعتماد وتسجيل الموظف'}
          </button>
        </div>
      </SlideOver>

      {/* Finance Record SlideOver (Advance, Bonus, Deduction) */}
      <SlideOver isOpen={financeSlideOpen} onClose={() => setFinanceSlideOpen(false)} title="تسجيل حركة مالية للموظف">
        <div className="space-y-6 pb-20 p-4">
           {financeEmpId && (
              <div className="bg-blue-50/50 p-3 rounded-xl border border-blue-100 mb-6 flex items-center gap-3">
                 <div className="w-10 h-10 bg-white rounded-lg border border-blue-100 flex items-center justify-center font-bold text-blue-800 shrink-0">
                    {myEmps.find(e => e.id === financeEmpId)?.name.charAt(0)}
                 </div>
                 <div>
                    <p className="font-bold text-gray-900 text-sm">{myEmps.find(e => e.id === financeEmpId)?.name}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{myEmps.find(e => e.id === financeEmpId)?.jobTitle}</p>
                 </div>
              </div>
           )}

           <div>
             <label className="block text-sm font-bold text-gray-700 mb-3">نوع الحركة المراد تسجيلها</label>
             <div className="grid grid-cols-3 gap-3">
               <label className={`border rounded-xl p-3 cursor-pointer text-center transition-all ${financeForm.type === 'advance' ? 'bg-red-50 border-red-500 text-red-700 ring-1 ring-red-500' : 'bg-white border-gray-200'}`}>
                 <input type="radio" className="sr-only" checked={financeForm.type === 'advance'} onChange={() => setFinanceForm({...financeForm, type: 'advance'})} />
                 <HeartHandshake className="mx-auto mb-1 opacity-70" size={20} />
                 <span className="font-bold text-xs">سلفة نقدية</span>
               </label>
               <label className={`border rounded-xl p-3 cursor-pointer text-center transition-all ${financeForm.type === 'bonus' ? 'bg-emerald-50 border-emerald-500 text-emerald-700 ring-1 ring-emerald-500' : 'bg-white border-gray-200'}`}>
                 <input type="radio" className="sr-only" checked={financeForm.type === 'bonus'} onChange={() => setFinanceForm({...financeForm, type: 'bonus'})} />
                 <Activity className="mx-auto mb-1 opacity-70" size={20} />
                 <span className="font-bold text-xs">مكافأة</span>
               </label>
               <label className={`border rounded-xl p-3 cursor-pointer text-center transition-all ${financeForm.type === 'deduction' ? 'bg-amber-50 border-amber-500 text-amber-700 ring-1 ring-amber-500' : 'bg-white border-gray-200'}`}>
                 <input type="radio" className="sr-only" checked={financeForm.type === 'deduction'} onChange={() => setFinanceForm({...financeForm, type: 'deduction'})} />
                 <FileDown className="mx-auto mb-1 opacity-70" size={20} />
                 <span className="font-bold text-xs">خصم / عقوبة</span>
               </label>
             </div>
             
             <div className="mt-4 bg-gray-50 border border-gray-100 rounded-xl p-3 text-xs text-gray-600 leading-relaxed">
               {financeForm.type === 'advance' && 'السلفة النقدية تعني سحب مبلغ فوراً من الخزينة وإعطائه للموظف نقداً، وتسجيله كدين عليه ليُخصم من راتبه القادم.'}
               {financeForm.type === 'bonus' && 'المكافأة ستضاف بشكل معلق كرصيد مستحق، ليتم صرفها تلقائياً للموظف مع إصدار راتب الشهر القادم.'}
               {financeForm.type === 'deduction' && 'الخصم سيُسجل في ملف الموظف، وسيتم اقتطاعه تلقائياً من راتبه في مسير الرواتب القادم.'}
             </div>
           </div>

           <div>
              <label className="block text-xs font-bold text-gray-700 mb-1.5">المبلغ (د.ل) *</label>
              <div className="relative">
                <input type="number" min={1} value={financeForm.amount} onChange={(e) => setFinanceForm({ ...financeForm, amount: e.target.value })} 
                  className="w-full pr-4 pl-12 py-3 bg-white border border-gray-200 rounded-xl text-lg font-mono font-bold focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition-colors" placeholder="0" />
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-bold text-gray-400">د.ل</span>
              </div>
           </div>

           <div>
             <label className="block text-xs font-bold text-gray-700 mb-1.5">سبب الحركة (اختياري)</label>
             <textarea rows={3} value={financeForm.reason} onChange={(e) => setFinanceForm({ ...financeForm, reason: e.target.value })} 
               className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition-colors resize-none" placeholder="اكتب السبب هنا للرجوع إليه لاحقاً..." />
           </div>

           <button onClick={handleSaveFinance} className={`w-full py-3 text-white font-bold rounded-xl transition-all text-sm shadow-md mt-6 ${financeForm.type === 'advance' ? 'bg-red-600 hover:bg-red-700' : financeForm.type === 'bonus' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-amber-600 hover:bg-amber-700'}`}>
              حفظ وتسجيل الحركة
           </button>
        </div>
      </SlideOver>

      {/* Payroll SlideOver */}
      <SlideOver isOpen={payrollSlideOpen} onClose={() => setPayrollSlideOpen(false)} title="إصدار مسير الرواتب الشهري" width="max-w-4xl">
        <div className="space-y-6 pb-20 p-2 sm:p-4">
           
           <div className="flex flex-col sm:flex-row items-center gap-4 bg-emerald-50 border border-emerald-100 rounded-2xl p-4">
             <div className="w-12 h-12 bg-white rounded-xl shadow-sm text-emerald-600 flex items-center justify-center shrink-0">
               <CalendarDays size={24} />
             </div>
             <div className="flex-1 text-center sm:text-right">
                <p className="font-bold text-emerald-900 mb-1">مسير رواتب شهر:</p>
                <input type="month" value={payrollMonth} onChange={e => setPayrollMonth(e.target.value)} 
                   className="bg-white border border-emerald-200 text-emerald-900 font-bold px-4 py-2 rounded-xl text-sm outline-none focus:ring-2 focus:ring-emerald-500" />
             </div>
             <div className="text-center sm:text-left bg-white px-5 py-3 rounded-xl shadow-sm border border-emerald-100">
                <p className="text-xs text-gray-500 font-bold mb-1">المبلغ الإجمالي للصرف</p>
                <p className="text-2xl font-black text-emerald-600 font-currency">{formatCurrency(payrollDetails.reduce((s, d) => s + d.netAmount, 0))}</p>
             </div>
           </div>

           <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
             <div className="overflow-x-auto">
               <table className="w-full text-sm text-right">
                 <thead className="bg-gray-50 border-b border-gray-200">
                   <tr>
                     <th className="px-4 py-3 font-bold text-gray-700">الموظف</th>
                     <th className="px-4 py-3 font-bold text-gray-700">الراتب الأساسي</th>
                     <th className="px-4 py-3 font-bold text-gray-700">قيود الحركة (تلقائي)</th>
                     <th className="px-4 py-3 font-bold text-gray-700">أيام الغياب</th>
                     <th className="px-4 py-3 font-bold text-gray-700 bg-emerald-50 border-x border-emerald-100">الصافي للدفع</th>
                   </tr>
                 </thead>
                 <tbody className="divide-y divide-gray-100">
                   {payrollDetails.map((d) => {
                     const emp = myEmps.find(e => e.id === d.employeeId)!;
                     return (
                       <tr key={d.employeeId} className="hover:bg-gray-50/50">
                          <td className="px-4 py-4">
                             <p className="font-bold text-gray-900">{emp.name}</p>
                             <p className="text-xs text-gray-500">{emp.jobTitle}</p>
                          </td>
                          <td className="px-4 py-4 font-mono text-gray-700 font-bold">{formatCurrency(Math.round(emp.salary))}</td>
                          <td className="px-4 py-4">
                             <div className="flex flex-col gap-1 text-xs font-mono">
                               {d.advanceDeduction > 0 && <span className="text-red-600 bg-red-50 px-1.5 py-0.5 rounded">سلفة مقطوعة: {d.advanceDeduction}-</span>}
                               {d.allowanceApplied > 0 && <span className="text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">مكافأة مضافة: {d.allowanceApplied}+</span>}
                               {d.deductionApplied > 0 && <span className="text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">خصم مطبق: {d.deductionApplied}-</span>}
                               {d.advanceDeduction === 0 && d.allowanceApplied === 0 && d.deductionApplied === 0 && <span className="text-gray-400">—</span>}
                             </div>
                          </td>
                          <td className="px-4 py-4">
                             <div className="flex items-center gap-2">
                               <input type="number" min={0} max={30} value={d.absentDays} onChange={e => updatePayrollDetail(d.employeeId, 'absentDays', Number(e.target.value))} 
                                 className="w-16 px-2 py-1.5 border border-gray-300 rounded-lg text-center focus:outline-none focus:border-bunyan-500 focus:ring-1 focus:ring-bunyan-500" />
                               <span className="text-xs text-gray-500 font-bold">يوم</span>
                             </div>
                          </td>
                          <td className="px-4 py-4 bg-emerald-50/30 border-x border-emerald-50">
                             <input type="number" min={0} value={d.netAmount} onChange={e => updatePayrollDetail(d.employeeId, 'netAmount', Number(e.target.value))} 
                                 className="w-full px-3 py-2 bg-white border border-emerald-200 rounded-lg text-emerald-700 font-black font-mono text-lg focus:outline-none focus:border-emerald-500" />
                          </td>
                       </tr>
                     );
                   })}
                 </tbody>
               </table>
             </div>
             {payrollDetails.length === 0 && (
               <div className="p-8 text-center text-gray-500">لا يوجد موظفين نشطين حالياً لإصدار الرواتب لهم.</div>
             )}
           </div>

           <div className="bg-amber-50 rounded-xl p-4 border border-amber-100 flex items-start gap-3">
             <AlertCircle size={20} className="text-amber-600 mt-0.5 shrink-0" />
             <div>
               <p className="text-sm font-bold text-amber-900">تنبيه هام قبل الإصدار</p>
               <p className="text-xs text-amber-700 leading-relaxed mt-1">
                 عند الضغط على تأكيد، سيتم سحب إجمالي المبالغ الصافية من الخزينة النقدية بشكل فوري. كما سيتم إطفاء الديون والسلف المسجلة وتصفير أرصدة المكافآت والخصومات تلقائياً لتسوية مسير الرواتب. هذه العملية لا تراجع فيها.
               </p>
             </div>
           </div>

           <button onClick={handleSubmitPayroll} disabled={payrollDetails.length === 0} className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-all shadow-md flex items-center justify-center gap-2 text-sm">
             <Coins size={18} /> تأكيد وصرف الرواتب الكلية
           </button>
        </div>
      </SlideOver>

      <ConfirmDialog isOpen={!!deleteId} onCancel={() => setDeleteId(null)} onConfirm={() => { if (deleteId) { const res = deleteEmployee(deleteId); setDeleteId(null); if (res.success) showToast('تم الحذف بنجاح', 'success'); else showToast(res.error || 'لا يمكن الحذف', 'error'); } }} title="حذف الموظف نهائياً" message="هل أنت متأكد من حذف حساب الموظف؟ لن تتمكن من استرجاع بيانات الراتب والسلف. إذا كانت لديه سلف معلقة فيجب سدادها قبل الحذف." variant="danger" />
    </div>
  );
}
