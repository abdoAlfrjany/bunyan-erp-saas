'use client';

import { useState, useMemo } from 'react';
import { useUser } from '@/core/auth/hooks';
import {
  useAllEmployees, useGetForTenant, useAddEmployee, useUpdateEmployee,
  useDeleteEmployee, useAddUser, useIssuePayroll, useRecordEmployeeFinancial
} from '@/core/db/hooks';
import { formatCurrency } from '@/shared/utils/format';
import { SlideOver } from '@/shared/components/ui/SlideOver';
import { ConfirmDialog } from '@/shared/components/ui/ConfirmDialog';
import { EmptyState } from '@/shared/components/ui/EmptyState';
import { useToast } from '@/shared/components/ui/Toast';
import {
  Plus, Trash2, Edit2, CalendarDays, AlertCircle, Coins,
  HeartHandshake, Users, Search, Key, Activity, FileDown, MoreVertical
} from 'lucide-react';
import type { Employee, UserPermissions } from '@/core/types';

// Toggle Switch — بديل Checkbox في الصلاحيات
function ToggleSwitch({ checked, onChange, label }: {
  checked: boolean; onChange: (v: boolean) => void; label: string;
}) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-sm text-gray-700">{label}</span>
      <button type="button" onClick={() => onChange(!checked)}
        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
          checked ? 'bg-bunyan-600' : 'bg-gray-300'
        }`}>
        <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
          checked ? 'translate-x-4' : 'translate-x-1'
        }`} />
      </button>
    </div>
  );
}

const STATUS_BADGE: Record<string, { label: string; class: string }> = {
  active:     { label: 'نشط',            class: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  on_leave:   { label: 'في إجازة',       class: 'bg-amber-50 text-amber-700 border-amber-200' },
  terminated: { label: 'منتهي الخدمة',  class: 'bg-red-50 text-red-600 border-red-200' },
};

export default function HRPage() {
  const user = useUser();
  const employees = useAllEmployees();
  const getForTenant = useGetForTenant();
  const addEmployee = useAddEmployee();
  const updateEmployee = useUpdateEmployee();
  const deleteEmployee = useDeleteEmployee();
  const addUser = useAddUser();
  const issuePayroll = useIssuePayroll();
  const recordEmployeeFinancial = useRecordEmployeeFinancial();
  const { showToast } = useToast();

  const tid = user?.tenantId || '';
  const myEmps = useMemo(() => getForTenant(employees, tid), [employees, tid, getForTenant]);

  const totalSalaries = myEmps.reduce((s, e) => s + e.salary, 0);
  const totalAdvances = myEmps.reduce((s, e) => s + e.advanceBalance, 0);
  const activeCount   = myEmps.filter(e => e.status === 'active').length;

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'on_leave' | 'terminated'>('all');
  const [openMenu, setOpenMenu] = useState<string | null>(null);

  const filteredEmps = useMemo(() => myEmps.filter(e => {
    const matchName   = e.name.includes(searchTerm) || (e.phone?.includes(searchTerm) ?? false);
    const matchStatus = statusFilter === 'all' || e.status === statusFilter;
    return matchName && matchStatus;
  }), [myEmps, searchTerm, statusFilter]);

  // Add/Edit Form
  const [slideOpen, setSlideOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: '', phone: '', email: '', password: '',
    jobTitle: 'موظف مبيعات', employmentType: 'full_time' as Employee['employmentType'],
    salary: 0, salaryDay: 1, startDate: new Date().toISOString().split('T')[0],
    status: 'active' as Employee['status'],
    nationalId: '', personalAddress: '', hasSystemAccess: false,
    role: 'sales', customPerms: { orders: false, inventory: false, delivery: false }
  });

  // Finance
  const [financeSlideOpen, setFinanceSlideOpen] = useState(false);
  const [financeEmpId, setFinanceEmpId]           = useState<string | null>(null);
  const [financeForm, setFinanceForm] = useState({
    type: 'advance' as 'advance' | 'bonus' | 'deduction', amount: '', reason: ''
  });

  // Payroll
  const [payrollSlideOpen, setPayrollSlideOpen] = useState(false);
  const [payrollMonth, setPayrollMonth] = useState(new Date().toISOString().slice(0, 7));
  const [payrollDetails, setPayrollDetails] = useState<{
    employeeId: string; netAmount: number; absentDays: number;
    advanceDeduction: number; allowanceApplied: number; deductionApplied: number;
  }[]>([]);

  const [deleteId, setDeleteId] = useState<string | null>(null);

  const resetForm = () => {
    setForm({
      name: '', phone: '', email: '', password: '',
      jobTitle: 'موظف مبيعات', employmentType: 'full_time',
      salary: 0, salaryDay: 1, startDate: new Date().toISOString().split('T')[0],
      status: 'active', nationalId: '', personalAddress: '', hasSystemAccess: false,
      role: 'sales', customPerms: { orders: false, inventory: false, delivery: false }
    });
    setEditingId(null);
  };

  const openEdit = (e: Employee) => {
    setForm({
      name: e.name, phone: e.phone, email: e.email || '', password: '',
      jobTitle: e.jobTitle || 'موظف مبيعات', employmentType: e.employmentType || 'full_time',
      salary: e.salary, salaryDay: e.salaryDay, startDate: e.startDate, status: e.status,
      nationalId: e.nationalId || '', personalAddress: e.personalAddress || '',
      hasSystemAccess: e.hasSystemAccess,
      role: 'sales', customPerms: { orders: false, inventory: false, delivery: false }
    });
    setEditingId(e.id); setSlideOpen(true);
  };

  const generatePassword = () => {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
    let p = '';
    for (let i = 0; i < 10; i++) p += chars.charAt(Math.floor(Math.random() * chars.length));
    setForm({ ...form, password: p });
  };

  const handleSaveEmployee = () => {
    if (!form.name || form.salary < 0) { showToast('يرجى ملء الاسم والراتب', 'error'); return; }
    if (editingId) {
      updateEmployee(editingId, {
        name: form.name, phone: form.phone, email: form.email,
        jobTitle: form.jobTitle, employmentType: form.employmentType,
        salary: form.salary, salaryDay: form.salaryDay, startDate: form.startDate,
        status: form.status, nationalId: form.nationalId, personalAddress: form.personalAddress,
        hasSystemAccess: form.hasSystemAccess
      });
      showToast('تم تحديث بيانات الموظف', 'success');
    } else {
      const empId = `emp-${Date.now()}`;
      addEmployee({
        id: empId, tenantId: tid, name: form.name, phone: form.phone, email: form.email,
        jobTitle: form.jobTitle, employmentType: form.employmentType,
        salary: form.salary, salaryDay: form.salaryDay, startDate: form.startDate, status: form.status,
        nationalId: form.nationalId, personalAddress: form.personalAddress,
        hasSystemAccess: form.hasSystemAccess, advanceBalance: 0, allowanceBalance: 0,
        deductionBalance: 0, isActive: true
      });
      if (form.hasSystemAccess) {
        const passToUse = form.password || '123456';
        const finalEmail = form.email || `${form.phone || Date.now()}@bunyan.ly`;
        const perms: UserPermissions = {
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
          perms.orders.view = true; perms.orders.changeStatus = true;
        } else if (form.role === 'custom') {
          perms.orders = { view: form.customPerms.orders, add: form.customPerms.orders, edit: form.customPerms.orders, delete: false, changeStatus: form.customPerms.orders, viewAll: form.customPerms.orders };
          perms.inventory = { view: form.customPerms.inventory, add: form.customPerms.inventory, edit: false, delete: false, viewCostPrice: false };
          perms.delivery.view = form.customPerms.delivery;
        }
        addUser({
          id: `user-${Date.now()}`, tenantId: tid, fullName: form.name,
          email: finalEmail, passwordHash: passToUse, role: 'employee',
          permissions: perms, isActive: true,
          createdAt: new Date().toISOString().split('T')[0], phone: form.phone
        });
        showToast(`تم إضافة الموظف — كلمة المرور: ${passToUse}`, 'success');
      } else {
        showToast('تم إضافة الموظف (بدون حساب دخول)', 'success');
      }
    }
    setSlideOpen(false); resetForm();
  };

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
    if (res.success) { showToast('تم تسجيل الحركة المالية', 'success'); setFinanceSlideOpen(false); }
    else showToast(res.error || 'حدث خطأ', 'error');
  };

  const handleOpenPayroll = () => {
    const activeEmps = myEmps.filter(e => e.status === 'active' || e.status === 'on_leave');
    const initialDetails = activeEmps.map(e => {
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
        employeeId: e.id, absentDays: 0,
        advanceDeduction: computedAdvanceDeduction,
        allowanceApplied: e.allowanceBalance,
        deductionApplied: e.deductionBalance,
        netAmount: Math.max(0, baseSalary - computedAdvanceDeduction + e.allowanceBalance - e.deductionBalance)
      };
    });
    setPayrollDetails(initialDetails); setPayrollSlideOpen(true);
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
      if (field !== 'advanceDeduction') nd.advanceDeduction = Math.min(e.advanceBalance, availableForAdvance);
      else nd.advanceDeduction = Math.min(nd.advanceDeduction, availableForAdvance);
      // Net Pay — محسوب تلقائياً — Read-Only
      nd.netAmount = Math.max(0, base - nd.advanceDeduction + nd.allowanceApplied - nd.deductionApplied);
      return nd;
    }));
  };

  const handleSubmitPayroll = () => {
    if (!payrollDetails.length) return;
    const total = payrollDetails.reduce((s, d) => s + d.netAmount, 0);
    if (!window.confirm(`سيتم صرف ${formatCurrency(total)} من الخزينة. هل أنت متأكد؟`)) return;
    const res = issuePayroll(tid, payrollMonth, payrollDetails);
    if (res.success) { showToast('تم إصدار مسير الرواتب ✅', 'success'); setPayrollSlideOpen(false); }
    else showToast(res.error || 'حدث خطأ', 'error');
  };

  return (
    <div className="space-y-6 animate-fade-in pb-10" onClick={() => setOpenMenu(null)}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900">الموارد البشرية والرواتب</h1>
          <p className="text-sm text-gray-500 mt-1">إدارة الموظفين، الرواتب، والسلف</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleOpenPayroll}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700
              text-white rounded-xl text-sm font-bold transition-all shadow-sm">
            <Coins size={16} /> إصدار رواتب الشهر
          </button>
          <button onClick={() => { resetForm(); setSlideOpen(true); }}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-bunyan-600 hover:bg-bunyan-700
              text-white rounded-xl text-sm font-bold transition-all shadow-sm">
            <Plus size={16} /> إضافة موظف
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: 'إجمالي الموظفين',    value: myEmps.length,  sub: `${activeCount} نشط`, icon: Users,         color: 'text-bunyan-600', bg: 'bg-bunyan-50' },
          { label: 'كتلة الرواتب الأساسية', value: formatCurrency(totalSalaries), sub: null, icon: Coins, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: 'إجمالي السلف العالقة',  value: formatCurrency(totalAdvances), sub: null, icon: HeartHandshake, color: 'text-red-600', bg: 'bg-red-50' },
        ].map(kpi => (
          <div key={kpi.label} className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all flex items-center gap-4">
            <div className={`w-12 h-12 ${kpi.bg} rounded-xl flex items-center justify-center shrink-0`}>
              <kpi.icon className={`w-6 h-6 ${kpi.color}`} />
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-0.5">{kpi.label}</p>
              <p className={`text-xl font-black ${kpi.color}`}>{kpi.value}</p>
              {kpi.sub && <p className="text-xs text-gray-400">{kpi.sub}</p>}
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-2.5 text-gray-400" size={15} />
          <input type="text" placeholder="البحث بالاسم أو الهاتف..." value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pr-9 pl-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm
              focus:outline-none focus:ring-2 focus:ring-bunyan-500/30 focus:bg-white transition-colors" />
        </div>
        <div className="flex bg-gray-100 p-0.5 rounded-xl gap-0.5 self-start sm:self-auto">
          {([['all', 'الكل'], ['active', 'نشط'], ['on_leave', 'إجازة'], ['terminated', 'منتهي']] as const).map(([v, l]) => (
            <button key={v} onClick={() => setStatusFilter(v)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                statusFilter === v ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
              }`}>
              {l}
            </button>
          ))}
        </div>
      </div>

      {/* Employees Table */}
      {filteredEmps.length === 0 ? (
        <EmptyState
          icon={<Users className="w-8 h-8 text-gray-400" />}
          title="لا يوجد موظفون"
          description={searchTerm ? 'لا توجد نتائج مطابقة' : 'أضف موظفك الأول للبدء'}
        />
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead className="bg-gray-50/70 border-b border-gray-100">
                <tr className="text-xs text-gray-400">
                  <th className="px-6 py-3.5 font-semibold">الموظف</th>
                  <th className="px-6 py-3.5 font-semibold">الوظيفة</th>
                  <th className="px-6 py-3.5 font-semibold">الراتب</th>
                  <th className="px-6 py-3.5 font-semibold">السلف والمكافآت</th>
                  <th className="px-6 py-3.5 font-semibold">آخر راتب</th>
                  <th className="px-6 py-3.5 font-semibold text-center">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {filteredEmps.map(e => {
                  const badge = STATUS_BADGE[e.status];
                  return (
                    <tr key={e.id} className="border-b border-gray-50 hover:bg-gray-50/60 transition-colors">
                      <td className="px-6 py-4">
                        <p className="font-bold text-gray-900">{e.name}</p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className={`text-[10px] px-2 py-0.5 rounded-full border font-bold ${badge?.class}`}>
                            {badge?.label}
                          </span>
                          <span className="text-xs text-gray-400 font-mono">{e.phone || ''}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <p className="font-semibold text-gray-700 text-xs">{e.jobTitle || '—'}</p>
                        <p className="text-[10px] text-gray-400">
                          {e.employmentType === 'full_time' ? 'كامل' : e.employmentType === 'part_time' ? 'نصف' : 'عقد'}
                        </p>
                      </td>
                      <td className="px-6 py-4 font-black text-gray-900 font-mono text-sm">
                        {formatCurrency(e.salary)}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-1 text-[10px]">
                          {e.advanceBalance > 0 && (
                            <span className="text-red-600 font-bold bg-red-50 px-1.5 py-0.5 rounded w-fit">
                              سلفة: {formatCurrency(e.advanceBalance)}
                            </span>
                          )}
                          {e.allowanceBalance > 0 && (
                            <span className="text-emerald-600 font-bold bg-emerald-50 px-1.5 py-0.5 rounded w-fit">
                              مكافأة: {formatCurrency(e.allowanceBalance)}
                            </span>
                          )}
                          {e.advanceBalance === 0 && e.allowanceBalance === 0 && (
                            <span className="text-gray-300">—</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-xs text-gray-500 font-mono">
                        {e.lastPayrollDate || 'لم يصرف'}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-center gap-2">
                          {/* Finance Action — مرئي */}
                          <button onClick={() => openFinance(e)}
                            className="p-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg
                              transition-colors" title="سلفة / مكافأة / خصم">
                            <HeartHandshake size={14} />
                          </button>
                          {/* Kebab Menu */}
                          <div className="relative" onClick={e2 => e2.stopPropagation()}>
                            <button onClick={() => setOpenMenu(openMenu === e.id ? null : e.id)}
                              className="w-7 h-7 flex items-center justify-center rounded-lg
                                hover:bg-gray-100 text-gray-400 transition-colors">
                              <MoreVertical size={14} />
                            </button>
                            {openMenu === e.id && (
                              <div className="absolute left-0 top-full mt-1 w-32 bg-white border
                                border-gray-200 rounded-xl shadow-lg z-20 overflow-hidden">
                                <button onClick={() => { openEdit(e); setOpenMenu(null); }}
                                  className="w-full flex items-center gap-2 px-3 py-2 text-xs
                                    text-gray-700 hover:bg-gray-50 text-right">
                                  <Edit2 size={12} /> تعديل
                                </button>
                                <button onClick={() => { setDeleteId(e.id); setOpenMenu(null); }}
                                  className="w-full flex items-center gap-2 px-3 py-2 text-xs
                                    text-red-600 hover:bg-red-50 text-right">
                                  <Trash2 size={12} /> حذف
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add/Edit Slide */}
      <SlideOver isOpen={slideOpen} onClose={() => { setSlideOpen(false); resetForm(); }}
        title={editingId ? 'تعديل بيانات الموظف' : 'إضافة موظف جديد'}>
        <div className="space-y-5 p-1">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1.5">الاسم الكامل *</label>
              <input type="text" value={form.name} onChange={e => setForm({...form, name: e.target.value})}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm
                  focus:outline-none focus:ring-2 focus:ring-bunyan-500/30" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1.5">رقم الهاتف</label>
              <input type="tel" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})}
                dir="ltr" className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm
                  font-mono text-left focus:outline-none focus:ring-2 focus:ring-bunyan-500/30" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1.5">المسمى الوظيفي</label>
              <select value={form.jobTitle} onChange={e => setForm({...form, jobTitle: e.target.value})}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm
                  focus:outline-none focus:ring-2 focus:ring-bunyan-500/30 bg-white">
                {['موظف مبيعات','أمين مخزن','محاسب','موظف توصيل','أخرى'].map(j => <option key={j}>{j}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1.5">نوع الدوام</label>
              <select value={form.employmentType} onChange={e => setForm({...form, employmentType: e.target.value as Employee['employmentType']})}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm
                  focus:outline-none focus:ring-2 focus:ring-bunyan-500/30 bg-white">
                <option value="full_time">دوام كامل</option>
                <option value="part_time">نصف دوام</option>
                <option value="contract">عقد مؤقت</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1.5">الراتب الأساسي *</label>
              <div className="relative">
                <input type="number" min={0} value={form.salary}
                  onChange={e => setForm({...form, salary: Number(e.target.value)})}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm font-mono
                    focus:outline-none focus:ring-2 focus:ring-bunyan-500/30 pl-12" />
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">د.ل</span>
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1.5">تاريخ الانضمام</label>
              <input type="date" value={form.startDate}
                onChange={e => setForm({...form, startDate: e.target.value})}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm
                  focus:outline-none focus:ring-2 focus:ring-bunyan-500/30" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1.5">حالة الموظف</label>
            <select value={form.status} onChange={e => setForm({...form, status: e.target.value as Employee['status']})}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm
                focus:outline-none focus:ring-2 focus:ring-bunyan-500/30 bg-white">
              <option value="active">نشط</option>
              <option value="on_leave">في إجازة</option>
              <option value="terminated">منتهي الخدمة</option>
            </select>
          </div>

          {/* حساب الدخول — Toggle Switch */}
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold text-gray-700">منح حساب دخول النظام</p>
              <button type="button" onClick={() => setForm({...form, hasSystemAccess: !form.hasSystemAccess})}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                  form.hasSystemAccess ? 'bg-bunyan-600' : 'bg-gray-300'
                }`}>
                <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
                  form.hasSystemAccess ? 'translate-x-4' : 'translate-x-1'
                }`} />
              </button>
            </div>

            {form.hasSystemAccess && (
              <div className="space-y-3 pt-2 border-t border-gray-200">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1.5">البريد الإلكتروني</label>
                    <input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})}
                      dir="ltr" className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm
                        text-left focus:outline-none focus:ring-2 focus:ring-bunyan-500/30" />
                  </div>
                  <div>
                    <label className="flex justify-between text-xs font-bold text-gray-700 mb-1.5">
                      <span>كلمة المرور</span>
                      <button onClick={generatePassword} className="text-bunyan-600 text-[10px] flex items-center gap-1">
                        <Key size={9} /> توليد
                      </button>
                    </label>
                    <input type="text" value={form.password} onChange={e => setForm({...form, password: e.target.value})}
                      dir="ltr" className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm
                        font-mono text-left focus:outline-none focus:ring-2 focus:ring-bunyan-500/30" />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-2">قالب الصلاحيات</label>
                  <div className="grid grid-cols-3 gap-2">
                    {([['sales', 'موظف مبيعات', 'طلبيات + مخزون'], ['warehouse', 'أمين مخزن', 'مخزون + حالة'], ['custom', 'مُخصص', 'يدوي']] as const).map(([v, l, desc]) => (
                      <button key={v} type="button" onClick={() => setForm({...form, role: v})}
                        className={`text-right p-2 rounded-xl border-2 transition-all ${
                          form.role === v ? 'border-bunyan-500 bg-bunyan-50' : 'border-gray-200 bg-white'
                        }`}>
                        <p className="font-bold text-xs text-gray-900 mb-0.5">{l}</p>
                        <p className="text-[9px] text-gray-500">{desc}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {form.role === 'custom' && (
                  <div className="bg-white border border-gray-200 rounded-xl p-3 space-y-1">
                    {[['orders', 'إدارة الطلبيات'], ['inventory', 'إضافة/تعديل منتجات'], ['delivery', 'شركات التوصيل']].map(([k, lbl]) => (
                      <ToggleSwitch
                        key={k} label={lbl}
                        checked={form.customPerms[k as keyof typeof form.customPerms]}
                        onChange={v => setForm({...form, customPerms: {...form.customPerms, [k]: v}})}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <button onClick={handleSaveEmployee}
            className="w-full py-3 bg-bunyan-600 hover:bg-bunyan-700 text-white rounded-xl
              font-bold text-sm transition-all shadow-sm">
            {editingId ? '💾 حفظ التعديلات' : 'اعتماد وتسجيل الموظف'}
          </button>
        </div>
      </SlideOver>

      {/* Finance SlideOver */}
      <SlideOver isOpen={financeSlideOpen} onClose={() => setFinanceSlideOpen(false)}
        title="تسجيل حركة مالية للموظف">
        <div className="space-y-5 p-1">
          {financeEmpId && (
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 flex items-center gap-3">
              <div className="w-9 h-9 bg-white rounded-lg border border-blue-100 flex items-center
                justify-center font-bold text-blue-800 text-sm">
                {myEmps.find(e => e.id === financeEmpId)?.name.charAt(0)}
              </div>
              <div>
                <p className="font-bold text-gray-900 text-sm">{myEmps.find(e => e.id === financeEmpId)?.name}</p>
                <p className="text-xs text-gray-500">{myEmps.find(e => e.id === financeEmpId)?.jobTitle}</p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-3 gap-2">
            {([
              ['advance', 'سلفة نقدية', HeartHandshake, 'bg-red-50 border-red-500 text-red-700'],
              ['bonus', 'مكافأة', Activity, 'bg-emerald-50 border-emerald-500 text-emerald-700'],
              ['deduction', 'خصم', FileDown, 'bg-amber-50 border-amber-500 text-amber-700'],
            ] as const).map(([type, lbl, Icon, activeClass]) => (
              <button key={type} type="button" onClick={() => setFinanceForm({...financeForm, type})}
                className={`p-3 rounded-xl border-2 text-center transition-all ${
                  financeForm.type === type ? activeClass : 'border-gray-200 bg-white'
                }`}>
                <Icon className="mx-auto mb-1 opacity-70" size={18} />
                <span className="font-bold text-xs">{lbl}</span>
              </button>
            ))}
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1.5">المبلغ (د.ل) *</label>
            <div className="relative">
              <input type="number" min={1} value={financeForm.amount}
                onChange={e => setFinanceForm({...financeForm, amount: e.target.value})}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl text-lg font-mono
                  font-black text-left focus:outline-none focus:ring-2 focus:ring-blue-500/30 pl-14"
                placeholder="0" dir="ltr" />
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-bold text-gray-400">
                د.ل
              </span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1.5">سبب الحركة (اختياري)</label>
            <textarea rows={2} value={financeForm.reason}
              onChange={e => setFinanceForm({...financeForm, reason: e.target.value})}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm resize-none
                focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              placeholder="اكتب السبب هنا..." />
          </div>

          <button onClick={handleSaveFinance}
            className={`w-full py-3 text-white font-bold rounded-xl transition-all text-sm shadow-sm ${
              financeForm.type === 'advance' ? 'bg-red-600 hover:bg-red-700'
              : financeForm.type === 'bonus' ? 'bg-emerald-600 hover:bg-emerald-700'
              : 'bg-amber-600 hover:bg-amber-700'
            }`}>
            حفظ وتسجيل الحركة
          </button>
        </div>
      </SlideOver>

      {/* Payroll SlideOver */}
      <SlideOver isOpen={payrollSlideOpen} onClose={() => setPayrollSlideOpen(false)}
        title="إصدار مسير الرواتب الشهري">
        <div className="space-y-5 p-1">
          <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 flex items-center
            justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white rounded-xl shadow-sm flex items-center justify-center">
                <CalendarDays size={20} className="text-emerald-600" />
              </div>
              <div>
                <p className="font-bold text-emerald-900 text-sm mb-1">شهر الرواتب</p>
                <input type="month" value={payrollMonth} onChange={e => setPayrollMonth(e.target.value)}
                  className="bg-white border border-emerald-200 text-emerald-900 font-bold px-3 py-1.5
                    rounded-lg text-sm outline-none focus:ring-2 focus:ring-emerald-400" />
              </div>
            </div>
            <div className="text-center">
              <p className="text-xs text-gray-500 mb-0.5">الإجمالي للصرف</p>
              <p className="text-xl font-black text-emerald-600">
                {formatCurrency(payrollDetails.reduce((s, d) => s + d.netAmount, 0))}
              </p>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-right">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 font-bold text-gray-600 text-xs">الموظف</th>
                    <th className="px-4 py-3 font-bold text-gray-600 text-xs">الراتب</th>
                    <th className="px-4 py-3 font-bold text-gray-600 text-xs">الحركات</th>
                    <th className="px-4 py-3 font-bold text-gray-600 text-xs">غياب</th>
                    <th className="px-4 py-3 font-bold text-emerald-700 text-xs bg-emerald-50">الصافي 🔒</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {payrollDetails.map(d => {
                    const emp = myEmps.find(e => e.id === d.employeeId)!;
                    return (
                      <tr key={d.employeeId} className="hover:bg-gray-50/50">
                        <td className="px-4 py-3">
                          <p className="font-bold text-gray-900 text-xs">{emp.name}</p>
                          <p className="text-[10px] text-gray-400">{emp.jobTitle}</p>
                        </td>
                        <td className="px-4 py-3 font-mono text-xs font-bold text-gray-700">
                          {formatCurrency(Math.round(emp.salary))}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col gap-0.5 text-[10px] font-mono">
                            {d.advanceDeduction > 0 && <span className="text-red-600 bg-red-50 px-1 py-0.5 rounded">سلفة: -{d.advanceDeduction}</span>}
                            {d.allowanceApplied > 0 && <span className="text-emerald-600 bg-emerald-50 px-1 py-0.5 rounded">مكافأة: +{d.allowanceApplied}</span>}
                            {!d.advanceDeduction && !d.allowanceApplied && <span className="text-gray-300">—</span>}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <input type="number" min={0} max={30} value={d.absentDays}
                            onChange={e => updatePayrollDetail(d.employeeId, 'absentDays', Number(e.target.value))}
                            className="w-12 px-1.5 py-1 border border-gray-300 rounded-lg text-center text-xs
                              focus:outline-none focus:border-bunyan-400" />
                        </td>
                        {/* صافي الراتب — Read-Only محسوب آلياً */}
                        <td className="px-4 py-3 bg-emerald-50/30 border-x border-emerald-100">
                          <p className="font-black text-emerald-700 font-mono text-base">
                            {formatCurrency(Math.round(d.netAmount))}
                          </p>
                          <p className="text-[9px] text-emerald-500 mt-0.5">محسوب تلقائياً</p>
                        </td>
                      </tr>
                    );
                  })}
                  {payrollDetails.length === 0 && (
                    <tr>
                      <td colSpan={5} className="text-center py-8 text-gray-400 text-sm">
                        لا يوجد موظفون نشطون
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 flex items-start gap-2">
            <AlertCircle size={16} className="text-amber-600 mt-0.5 shrink-0" />
            <p className="text-xs text-amber-700 leading-relaxed">
              بعد التأكيد سيتم سحب الإجمالي من الخزينة وإطفاء السلف والمكافآت تلقائياً. هذه العملية لا تُعاد.
            </p>
          </div>

          <button onClick={handleSubmitPayroll} disabled={!payrollDetails.length}
            className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300
              disabled:cursor-not-allowed text-white font-bold rounded-xl transition-all
              text-sm shadow-sm flex items-center justify-center gap-2">
            <Coins size={16} /> تأكيد وصرف الرواتب
          </button>
        </div>
      </SlideOver>

      <ConfirmDialog
        isOpen={!!deleteId}
        onCancel={() => setDeleteId(null)}
        onConfirm={async () => {
          if (deleteId) {
            const res = await deleteEmployee(deleteId);
            setDeleteId(null);
            if (res.success) showToast('تم الحذف بنجاح', 'success');
            else showToast(res.error || 'لا يمكن الحذف', 'error');
          }
        }}
        title="حذف الموظف نهائياً"
        message="هل أنت متأكد؟ سيتم حذف بيانات الموظف بشكل دائم."
        variant="danger"
      />
    </div>
  );
}
