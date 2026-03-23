// src/app/(tenant)/settings/page.tsx
// الوظيفة: إعدادات المتجر — 7 تبويبات + isDirty + controlled form + Toggle
// المرجع: _DOCS/3_UI_UX_GUIDELINES.md

'use client';

import { useState, useCallback, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useAuthStore } from '@/core/auth/store';
import { useDataStore } from '@/core/db/store';
import { useToast } from '@/shared/components/ui/Toast';
import { SlideOver } from '@/shared/components/ui/SlideOver';
import { Toggle } from '@/shared/components/ui/Toggle';
import {
  Settings, Store, CreditCard, ShoppingCart, Package, Bell,
  Users, Shield, ChevronLeft, Plus, X, Download, AlertTriangle,
  CheckCircle2, Save, Eye
} from 'lucide-react';
import { SALES_EMPLOYEE_PERMISSIONS } from '@/core/db/seed';
import type { TenantUser, UserPermissions } from '@/core/types';

// ═══ أنواع صريحة ═══
type SettingsForm = {
  storeName: string;
  ownerName: string;
  phone: string;
  email: string;
  city: string;
  address: string;
  website: string;
  taxNumber: string;
  commercialRegister: string;
  orderPrefix: string;
  orderStartNumber: number;
  invoiceFooter: string;
  autoPrintInvoice: boolean;
  requiredFields: string[];
  allowNegativeStock: boolean;
  minStockWarning: number;
  notifyOrders: boolean;
  notifyStock: boolean;
  notifyFinance: boolean;
  notifyHR: boolean;
};

type Tab = 'general' | 'billing' | 'orders' | 'inventory' | 'notifications' | 'users' | 'security';

const TABS: { key: Tab; label: string; icon: React.ElementType }[] = [
  { key: 'general',       label: 'عام',            icon: Store },
  { key: 'billing',       label: 'الفوترة',        icon: CreditCard },
  { key: 'orders',        label: 'الطلبيات',       icon: ShoppingCart },
  { key: 'inventory',     label: 'المخزون',        icon: Package },
  { key: 'notifications', label: 'الإشعارات',      icon: Bell },
  { key: 'users',         label: 'المستخدمون',     icon: Users },
  { key: 'security',      label: 'الأمان',         icon: Shield },
];

// ═══ STABLE_EMPTY — مرجع ثابت لقائمة فارغة لمنع infinite loop ═══
const STABLE_EMPTY: string[] = [];

export default function SettingsPage() {
  // ✅ Primitive selector — مستقر (لا يُلغي re-render غير ضروري)
  const user = useAuthStore(s => s.user);
  const { showToast } = useToast();

  const tid = user?.tenantId || '';

  // ✅ useShallow — يقارن القيم بدل المرجع → يمنع re-render غير ضروري
  const { tenants, users, subscriptions } = useDataStore(
    useShallow(s => ({ tenants: s.tenants, users: s.users, subscriptions: s.subscriptions }))
  );

  // ✅ Actions فقط — مستقرة من الـ store مباشرة (لا تُسبب re-render)
  const addUser     = useDataStore(s => s.addUser);
  const updateUser  = useDataStore(s => s.updateUser);
  const updateTenant = useDataStore(s => s.updateTenant);
  const addCustomUnit = useDataStore(s => s.addCustomUnit);
  const getForTenant  = useDataStore(s => s.getForTenant);

  // ✅ customUnits — useCallback مستقر + مرجع ثابت عوضاً عن `|| []`
  const rawCustomUnits = useDataStore(
    useCallback((s: ReturnType<typeof useDataStore.getState>) => s.customUnits[tid], [tid])
  );
  const customUnits: string[] = rawCustomUnits ?? STABLE_EMPTY;

  const tenant   = useMemo(() => tenants.find(t => t.id === tid), [tenants, tid]);
  const myUsers  = useMemo(() => getForTenant(users, tid), [users, tid, getForTenant]);
  const sub      = useMemo(() => subscriptions.find(s => s.tenantId === tid), [subscriptions, tid]);

  // ═══ Form State ═══
  const [form, setForm] = useState<SettingsForm>(() => ({
    storeName: tenant?.name ?? '',
    ownerName: tenant?.ownerName ?? '',
    phone: tenant?.ownerPhone ?? '',
    email: tenant?.ownerEmail ?? '',
    city: tenant?.city ?? '',
    address: '',
    website: tenant?.website ?? '',
    taxNumber: '',
    commercialRegister: '',
    orderPrefix: 'BN-',
    orderStartNumber: 1000,
    invoiceFooter: 'شكراً لتعاملكم معنا، يسعدنا تواصلكم دائماً.',
    autoPrintInvoice: true,
    requiredFields: ['customerPhone', 'customerCity'],
    allowNegativeStock: false,
    minStockWarning: 5,
    notifyOrders: true,
    notifyStock: true,
    notifyFinance: true,
    notifyHR: false,
  }));

  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('general');
  const [unitInput, setUnitInput] = useState('');

  // ═══ User Management ═══
  const [slideOpen, setSlideOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<TenantUser | null>(null);
  const [userForm, setUserForm] = useState<Partial<TenantUser> & { newPassword?: string }>({
    fullName: '', email: '', role: 'employee', isActive: true, passwordHash: '',
    permissions: SALES_EMPLOYEE_PERMISSIONS,
  });

  // ═══ Security ═══
  const [currentPassword, setCurrentPassword] = useState('');
  const [newOwnerPassword, setNewOwnerPassword] = useState('');
  const [confirmText, setConfirmText] = useState('');

  // ═══ Helpers ═══
  const updateField = useCallback(<K extends keyof SettingsForm>(key: K, value: SettingsForm[K]) => {
    setForm(prev => ({ ...prev, [key]: value }));
    setIsDirty(true);
  }, []);

  if (!tenant) return (
    <div className="flex flex-col items-center justify-center py-20 animate-fade-in">
      <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
        <Store size={28} className="text-gray-400" />
      </div>
      <p className="text-gray-500 font-bold mb-2">تعذر تحميل بيانات المتجر</p>
    </div>
  );

  // ═══ Save Handler ═══
  const handleSave = () => {
    if (form.phone && !/^09[1-5]\d{7}$/.test(form.phone)) {
      showToast('رقم الهاتف يجب أن يبدأ بـ 091-095 ويتكون من 10 أرقام', 'error');
      return;
    }
    setIsSaving(true);
    updateTenant(tid, {
      name: form.storeName,
      ownerName: form.ownerName,
      ownerPhone: form.phone,
      ownerEmail: form.email,
      city: form.city,
      website: form.website,
    });
    setTimeout(() => {
      setIsSaving(false);
      setIsDirty(false);
      showToast('تم حفظ الإعدادات بنجاح', 'success');
    }, 500);
  };

  // ═══ User Save ═══
  const saveUser = () => {
    if (!userForm.fullName || !userForm.email) {
      showToast('يرجى ملء الاسم والبريد', 'error');
      return;
    }
    const dataToSave = { ...userForm };
    if (dataToSave.newPassword) {
      dataToSave.passwordHash = dataToSave.newPassword;
    }
    delete dataToSave.newPassword;

    if (editingUser) {
      updateUser(editingUser.id, dataToSave);
      showToast('تم تحديث المستخدم بنجاح', 'success');
    } else {
      addUser({
        id: `usr-${Date.now()}`, tenantId: tid,
        fullName: dataToSave.fullName!, email: dataToSave.email!,
        passwordHash: dataToSave.passwordHash ? dataToSave.passwordHash : '123456',
        role: (dataToSave.role as 'owner' | 'partner' | 'employee') ?? 'employee',
        isActive: dataToSave.isActive ?? true,
        createdAt: new Date().toISOString().split('T')[0],
        permissions: (dataToSave.permissions || SALES_EMPLOYEE_PERMISSIONS) as UserPermissions,
      });
      showToast('تمت إضافة المستخدم بنجاح', 'success');
    }
    setSlideOpen(false);
  };

  // ═══ Owner Password Change ═══
  const handleOwnerPasswordChange = () => {
    if (!user || user.role !== 'owner') {
      showToast('غير مصرح لك بتغيير كلمة المرور', 'error');
      return;
    }
    const dbUser = users.find(u => u.id === user.id);
    if (!dbUser) return;
    if (currentPassword !== dbUser.passwordHash) {
      showToast('كلمة المرور الحالية غير صحيحة', 'error');
      return;
    }
    if (newOwnerPassword.length < 6) {
      showToast('كلمة المرور الجديدة يجب أن تكون 6 أحرف على الأقل', 'error');
      return;
    }
    updateUser(user.id, { passwordHash: newOwnerPassword });
    showToast('تم تحديث كلمة المرور بنجاح', 'success');
    setCurrentPassword('');
    setNewOwnerPassword('');
  };

  // ═══ Data Export ═══
  const handleExport = () => {
    const data = JSON.stringify(useDataStore.getState(), null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bunyan-backup-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('تم تصدير البيانات بنجاح', 'success');
  };

  // ═══ Data Reset ═══
  const handleReset = () => {
    if (confirmText !== 'تأكيد') {
      showToast('اكتب كلمة "تأكيد" للمتابعة', 'error');
      return;
    }
    showToast('هذه الميزة مغلقة في بيئة العرض التجريبي', 'error');
    setConfirmText('');
  };

  // ═══ Custom Unit Add ═══
  const handleAddUnit = () => {
    const trimmed = unitInput.trim();
    if (!trimmed) return;
    if (customUnits.includes(trimmed)) {
      showToast('هذه الوحدة موجودة مسبقاً', 'error');
      return;
    }
    addCustomUnit(trimmed, tid);
    setUnitInput('');
    showToast(`تمت إضافة وحدة "${trimmed}"`, 'success');
  };

  // ═══ Required Fields Toggle ═══
  const toggleRequiredField = (key: string, checked: boolean) => {
    updateField(
      'requiredFields',
      checked
        ? [...form.requiredFields, key]
        : form.requiredFields.filter(f => f !== key)
    );
  };

  // ═══ Tab Button Component ═══
  const TabButton = ({ tab }: { tab: typeof TABS[number] }) => {
    const active = activeTab === tab.key;
    const Icon = tab.icon;
    return (
      <button
        onClick={() => setActiveTab(tab.key)}
        className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all ${
          active
            ? 'bg-bunyan-600 text-white font-bold shadow-md'
            : 'text-gray-600 hover:bg-gray-50 font-semibold'
        }`}
      >
        <div className="flex items-center gap-3">
          <Icon size={18} className={active ? 'text-white' : 'text-gray-400'} />
          <span className="text-sm">{tab.label}</span>
        </div>
        {!active && <ChevronLeft size={16} className="text-gray-300" />}
      </button>
    );
  };

  // ═══ Input helper ═══
  const inputClass = 'w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-bunyan-500/50 focus:border-bunyan-500 transition-colors';

  return (
    <div className="space-y-6 animate-fade-in pb-20">
      {/* ═══ Sticky Header ═══ */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-gray-100 shadow-sm sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <Settings size={28} className="text-bunyan-600" />
          <div>
            <h1 className="text-xl font-bold text-gray-900">الإعدادات</h1>
            <p className="text-xs text-gray-500">إدارة شاملة لإعدادات المتجر والعمليات</p>
          </div>
          {isDirty && (
            <span className="inline-flex items-center gap-1.5 text-xs bg-amber-50 text-amber-700 border border-amber-200 px-2.5 py-1 rounded-full font-medium animate-pulse">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
              تغييرات غير محفوظة
            </span>
          )}
        </div>
        <button
          onClick={handleSave}
          disabled={isSaving || !isDirty}
          className="flex items-center gap-2 px-5 py-2.5 bg-bunyan-600 text-white rounded-xl text-sm font-bold hover:bg-bunyan-700 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed min-w-[140px] justify-center"
        >
          {isSaving ? (
            <span className="animate-spin w-4 h-4 border-2 border-white/20 border-t-white rounded-full" />
          ) : (
            <Save size={18} />
          )}
          {isSaving ? 'يتم الحفظ...' : 'حفظ التغييرات'}
        </button>
      </div>

      <div className="flex flex-col md:flex-row gap-6 items-start">
        {/* ═══ Sidebar Tabs ═══ */}
        <div className="w-full md:w-64 bg-white rounded-3xl p-4 border border-gray-100 shadow-sm shrink-0 md:sticky md:top-24">
          <div className="flex md:flex-col gap-1 overflow-x-auto md:overflow-visible">
            {TABS.map(tab => (
              <TabButton key={tab.key} tab={tab} />
            ))}
          </div>
        </div>

        {/* ═══ Content Area ═══ */}
        <div className="flex-1 w-full bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden min-h-[600px] p-6 md:p-8">

          {/* تبويب 1 — عام */}
          {activeTab === 'general' && (
            <div className="animate-fade-in space-y-6 max-w-2xl">
              <h2 className="text-lg font-bold text-gray-900 border-b border-gray-100 pb-4">المعلومات الأساسية</h2>

              <div className="flex items-center gap-5 pb-4">
                <div className="w-20 h-20 bg-gray-50 border-2 border-dashed border-gray-200 rounded-2xl flex items-center justify-center text-gray-400 font-bold hover:bg-gray-100 cursor-pointer text-xs">
                  رفع الشعار
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-900">شعار المتجر</p>
                  <p className="text-xs text-gray-500">PNG أو JPG (الحد الأقصى 2MB)</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1.5">اسم المتجر *</label>
                  <input type="text" value={form.storeName} onChange={e => updateField('storeName', e.target.value)} className={inputClass} />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1.5">صاحب المتجر</label>
                  <input type="text" value={form.ownerName} onChange={e => updateField('ownerName', e.target.value)} className={inputClass} />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1.5">رقم الهاتف</label>
                  <input type="tel" dir="ltr" value={form.phone} onChange={e => updateField('phone', e.target.value)} placeholder="0910000000" className={`${inputClass} text-left`} />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1.5">البريد الإلكتروني</label>
                  <input type="email" dir="ltr" value={form.email} onChange={e => updateField('email', e.target.value)} className={`${inputClass} text-left`} />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1.5">المدينة</label>
                  <input type="text" value={form.city} onChange={e => updateField('city', e.target.value)} className={inputClass} />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1.5">الرقم الضريبي</label>
                  <input type="text" value={form.taxNumber} onChange={e => updateField('taxNumber', e.target.value)} className={inputClass} />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-gray-700 mb-1.5">العنوان التفصيلي</label>
                  <textarea value={form.address} onChange={e => updateField('address', e.target.value)} rows={2}
                    className={`${inputClass} resize-none`} placeholder="الحي، الشارع، أقرب معلم..." />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-gray-700 mb-1.5">الموقع الإلكتروني</label>
                  <input type="text" dir="ltr" value={form.website} onChange={e => updateField('website', e.target.value)} placeholder="domain.com" className={`${inputClass} text-left`} />
                </div>
              </div>
            </div>
          )}

          {/* تبويب 2 — الفوترة */}
          {activeTab === 'billing' && (
            <div className="animate-fade-in space-y-6 max-w-2xl">
              <h2 className="text-lg font-bold text-gray-900 border-b border-gray-100 pb-4">بيانات الاشتراك والفوترة</h2>

              <div className="bg-gradient-to-r from-bunyan-50 to-white border border-bunyan-100 rounded-2xl p-6">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="bg-bunyan-100 text-bunyan-800 text-[10px] font-black px-2 py-0.5 rounded-full inline-flex items-center gap-1 mb-2">
                      <Shield size={10} /> باقة {tenant.plan === 'pro' ? 'احترافية PRO' : tenant.plan === 'lifetime' ? 'مدى الحياة' : 'أساسية'}
                    </span>
                    <p className="text-sm text-gray-600">ينتهي الاشتراك في: <span className="font-bold text-gray-900 font-mono">{tenant.planExpiresAt}</span></p>
                    {sub && (
                      <p className="text-xs text-gray-500 mt-1">القيمة: <span className="font-bold">{sub.amount} د.ل</span> — الحالة: <span className={`font-bold ${sub.status === 'paid' ? 'text-emerald-600' : 'text-red-600'}`}>{sub.status === 'paid' ? 'مدفوعة' : 'متأخرة'}</span></p>
                    )}
                  </div>
                  <button className="text-xs font-bold text-bunyan-600 hover:underline">تجديد الاشتراك</button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">السجل التجاري (اختياري)</label>
                <input type="text" value={form.commercialRegister} onChange={e => updateField('commercialRegister', e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">الرقم الضريبي (اختياري)</label>
                <input type="text" value={form.taxNumber} onChange={e => updateField('taxNumber', e.target.value)} className={inputClass} />
              </div>
            </div>
          )}

          {/* تبويب 3 — الطلبيات */}
          {activeTab === 'orders' && (
            <div className="animate-fade-in space-y-6 max-w-2xl">
              <h2 className="text-lg font-bold text-gray-900 border-b border-gray-100 pb-4">تفضيلات الطلبيات</h2>

              {/* بادئة الأرقام مع Preview */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">بادئة رقم الطلبية</label>
                <div className="flex items-center gap-3">
                  <input value={form.orderPrefix} onChange={e => updateField('orderPrefix', e.target.value)}
                    dir="ltr" className={`w-28 ${inputClass} text-left font-mono font-bold text-bunyan-600`} placeholder="BN-" />
                  <span className="text-sm text-gray-500 bg-gray-100 px-3 py-2 rounded-lg font-mono">
                    مثال: {form.orderPrefix || 'BN-'}{form.orderStartNumber}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">رقم البداية</label>
                <input type="number" value={form.orderStartNumber} onChange={e => updateField('orderStartNumber', Number(e.target.value))}
                  dir="ltr" className={`w-32 ${inputClass} text-left font-mono font-bold`} />
              </div>

              {/* الحقول الإلزامية */}
              <div>
                <label className="block text-xs font-bold text-gray-900 mb-3">الحقول الإلزامية عند إنشاء طلبية</label>
                <div className="space-y-3 bg-gray-50 p-4 rounded-xl border border-gray-100">
                  {[
                    { key: 'customerPhone2',   label: 'رقم هاتف ثانٍ',        desc: 'هاتف احتياطي للزبون' },
                    { key: 'customerAddress',  label: 'العنوان التفصيلي',      desc: 'عنوان التوصيل' },
                    { key: 'courierRequired',  label: 'شركة التوصيل إلزامية', desc: 'لا يُنشأ الطلب بدون اختيار شركة' },
                  ].map(field => (
                    <Toggle
                      key={field.key}
                      checked={form.requiredFields.includes(field.key)}
                      onChange={checked => toggleRequiredField(field.key, checked)}
                      label={field.label}
                      description={field.desc}
                    />
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">نص أسفل الفاتورة</label>
                <input type="text" value={form.invoiceFooter} onChange={e => updateField('invoiceFooter', e.target.value)} className={inputClass} />
              </div>

              <Toggle
                checked={form.autoPrintInvoice}
                onChange={v => updateField('autoPrintInvoice', v)}
                label="طباعة الفاتورة آلياً"
                description="فتح نافذة الطباعة فور تأكيد إنشاء الطلبية"
              />
            </div>
          )}

          {/* تبويب 4 — المخزون */}
          {activeTab === 'inventory' && (
            <div className="animate-fade-in space-y-6 max-w-2xl">
              <h2 className="text-lg font-bold text-gray-900 border-b border-gray-100 pb-4">قواعد المخزون والأصناف</h2>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">الحد الافتراضي للتحذير بنفاد الكمية (قطع)</label>
                <input type="number" value={form.minStockWarning} onChange={e => updateField('minStockWarning', Number(e.target.value))}
                  className={`w-32 ${inputClass} text-center font-mono font-bold`} />
              </div>

              <Toggle
                checked={form.allowNegativeStock}
                onChange={v => updateField('allowNegativeStock', v)}
                label="السماح ببيع المخزون السالب"
                description="⚠️ استخدم بحذر — قد يؤثر على دقة الجرد"
              />

              {/* وحدات القياس */}
              <div>
                <label className="block text-xs font-bold text-gray-900 mb-3">وحدات القياس المتاحة</label>
                <div className="flex flex-wrap gap-2 mb-3">
                  {['قطعة', 'كيلو', 'لتر', 'متر', 'علبة', 'كيس', 'طقم'].map(u => (
                    <span key={u} className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-bold border border-gray-200">{u}</span>
                  ))}
                  {customUnits.map((unit: string) => (
                    <span key={unit} className="inline-flex items-center gap-1.5 px-3 py-1 bg-bunyan-50 text-bunyan-700 border border-bunyan-200 rounded-full text-sm">
                      {unit}
                      <button onClick={() => showToast('الحذف غير متاح في الإصدار الحالي', 'error')} className="hover:text-red-500 transition-colors">
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input value={unitInput} onChange={e => setUnitInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleAddUnit()}
                    placeholder="أضف وحدة قياس (مثل: كرتون، درزن...)"
                    className={`flex-1 ${inputClass}`} />
                  <button onClick={handleAddUnit}
                    className="px-4 bg-bunyan-600 hover:bg-bunyan-700 text-white rounded-xl flex items-center gap-1.5 text-sm font-medium transition-colors">
                    <Plus className="w-4 h-4" /> إضافة
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* تبويب 5 — الإشعارات */}
          {activeTab === 'notifications' && (
            <div className="animate-fade-in space-y-6 max-w-2xl">
              <h2 className="text-lg font-bold text-gray-900 border-b border-gray-100 pb-4">تخصيص الإشعارات</h2>
              <div className="space-y-4">
                <Toggle
                  checked={form.notifyOrders}
                  onChange={v => updateField('notifyOrders', v)}
                  label="تحديثات الطلبيات"
                  description="طلبية جديدة، إلغاء، استرجاع"
                />
                <Toggle
                  checked={form.notifyStock}
                  onChange={v => updateField('notifyStock', v)}
                  label="المخزون"
                  description="نفاد الكمية لمنتج معين"
                />
                <Toggle
                  checked={form.notifyFinance}
                  onChange={v => updateField('notifyFinance', v)}
                  label="المالية"
                  description="الديون المتأخرة وتوزيع الأرباح"
                />
                <Toggle
                  checked={form.notifyHR}
                  onChange={v => updateField('notifyHR', v)}
                  label="الموظفين"
                  description="طلبات السلفيات والإجازات"
                />
              </div>
            </div>
          )}

          {/* تبويب 6 — المستخدمون */}
          {activeTab === 'users' && (
            <div className="animate-fade-in">
              <div className="flex justify-between items-center mb-6 pb-4 border-b border-gray-100">
                <h2 className="text-lg font-bold text-gray-900">صلاحيات النظام</h2>
                <button onClick={() => { setEditingUser(null); setUserForm({ fullName: '', email: '', role: 'employee', isActive: true, permissions: SALES_EMPLOYEE_PERMISSIONS }); setSlideOpen(true); }}
                  className="flex items-center gap-2 px-3 py-1.5 bg-bunyan-50 text-bunyan-700 rounded-lg text-xs font-bold hover:bg-bunyan-100 transition-colors">
                  <Plus size={16} /> إضافة مستخدم جديد
                </button>
              </div>

              <div className="border border-gray-100 rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-right">
                    <thead className="bg-gray-50 text-gray-500 font-medium border-b border-gray-100">
                      <tr>
                        <th className="px-4 py-3">الاسم والبريد</th>
                        <th className="px-4 py-3">الدور</th>
                        <th className="px-4 py-3 text-center">الحالة</th>
                        <th className="px-4 py-3 text-center">إدارة</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {myUsers.map(u => (
                        <tr key={u.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3">
                            <p className="font-bold text-gray-900">{u.fullName}</p>
                            <p className="text-xs text-gray-500 font-mono mt-0.5">{u.email}</p>
                          </td>
                          <td className="px-4 py-3 font-bold text-xs">
                            {u.role === 'owner' ? 'المالك' : u.role === 'partner' ? 'شريك' : 'موظف'}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {u.isActive
                              ? <span className="bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded text-xs font-medium">نشط</span>
                              : <span className="bg-red-50 text-red-600 px-2 py-0.5 rounded text-xs font-medium">موقوف</span>
                            }
                          </td>
                          <td className="px-4 py-3 text-center">
                            <button onClick={() => { setEditingUser(u); setUserForm({ ...u }); setSlideOpen(true); }}
                              className="p-1.5 bg-white border border-gray-200 hover:border-bunyan-300 rounded shadow-sm text-gray-600 transition-colors">
                              <Settings size={14} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* تبويب 7 — الأمان */}
          {activeTab === 'security' && (
            <div className="animate-fade-in space-y-8 max-w-2xl">
              {/* كلمة المرور */}
              <div>
                <h2 className="text-lg font-bold text-gray-900 border-b border-gray-100 pb-4 mb-4">كلمة المرور والأمان</h2>
                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1.5">كلمة المرور الحالية</label>
                    <input type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} placeholder="••••••••"
                      className={`max-w-sm ${inputClass}`} />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1.5">كلمة المرور الجديدة</label>
                    <input type="password" value={newOwnerPassword} onChange={e => setNewOwnerPassword(e.target.value)} placeholder="••••••••"
                      className={`max-w-sm ${inputClass}`} />
                  </div>
                  <button onClick={handleOwnerPasswordChange}
                    className="w-fit px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-bold hover:bg-gray-800 transition-colors">
                    تحديث كلمة المرور
                  </button>
                </div>
              </div>

              {/* تصدير البيانات */}
              <div>
                <h2 className="text-lg font-bold text-gray-900 border-b border-gray-100 pb-4 mb-4">إدارة البيانات</h2>
                <button onClick={handleExport}
                  className="w-fit flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg text-sm font-bold hover:bg-gray-50 transition-colors">
                  <Download size={16} /> تصدير نسخة احتياطية (JSON)
                </button>
              </div>

              {/* تصفير البيانات */}
              <div>
                <h2 className="text-lg font-bold text-red-600 border-b border-red-100 pb-4 mb-4">منطقة الخطر</h2>
                <div className="p-4 rounded-xl border border-red-200 bg-red-50 space-y-4">
                  <div className="flex items-center gap-2">
                    <AlertTriangle size={16} className="text-red-600" />
                    <p className="font-bold text-red-900 text-sm">تصفير بيانات النظام</p>
                  </div>
                  <p className="text-xs text-red-700">سيؤدي لمسح كل الطلبيات، الخزينة، الديون، وأرصدة المخزون. هذا الإجراء لا يمكن التراجع عنه.</p>
                  <div>
                    <label className="block text-xs font-bold text-red-800 mb-1.5">اكتب &quot;تأكيد&quot; للمتابعة</label>
                    <input type="text" value={confirmText} onChange={e => setConfirmText(e.target.value)} placeholder='تأكيد'
                      className="w-full max-w-sm p-2.5 bg-white border border-red-200 rounded-xl text-sm focus:border-red-500 focus:outline-none" />
                  </div>
                  <button onClick={handleReset} disabled={confirmText !== 'تأكيد'}
                    className="px-5 py-2.5 bg-red-600 text-white font-bold text-sm rounded-lg hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all">
                    تأكيد ومسح البيانات
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ═══ SlideOver — إدارة المستخدمين ═══ */}
      <SlideOver isOpen={slideOpen} onClose={() => setSlideOpen(false)} title={editingUser ? 'تعديل المستخدم' : 'إضافة مستخدم جديد'}>
        <div className="space-y-4 pb-10 p-2 sm:p-4">
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1.5">الاسم</label>
            <input type="text" value={userForm.fullName || ''} onChange={e => setUserForm({ ...userForm, fullName: e.target.value })} className={inputClass} />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1.5">البريد الإلكتروني للدخول</label>
            <input type="email" dir="ltr" value={userForm.email || ''} onChange={e => setUserForm({ ...userForm, email: e.target.value })} className={`${inputClass} text-left`} />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1.5">الدور الرئيسي</label>
            <select value={userForm.role || 'employee'} onChange={e => setUserForm({ ...userForm, role: e.target.value as 'owner' | 'partner' | 'employee' })}
              className={`${inputClass} bg-white font-bold`}>
              <option value="employee">موظف قياسي</option>
              <option value="partner">شريك إداري</option>
            </select>
          </div>
          {!editingUser ? (
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1.5">كلمة مرور أولية</label>
              <input type="password" value={userForm.passwordHash || ''} onChange={e => setUserForm({ ...userForm, passwordHash: e.target.value })} className={inputClass} placeholder="123456" />
            </div>
          ) : (
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1.5">تغيير كلمة المرور (اتركه فارغاً للاحتفاظ بالحالية)</label>
              <input type="password" value={userForm.newPassword || ''} onChange={e => setUserForm({ ...userForm, newPassword: e.target.value })} className={inputClass} placeholder="••••••••" />
            </div>
          )}

          <div className="bg-bunyan-50/50 p-4 border border-bunyan-100 rounded-xl space-y-3 mt-4">
            <h4 className="text-xs font-bold text-bunyan-900 mb-2">صلاحيات إضافية</h4>
            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input type="checkbox" checked={userForm.permissions?.inventory?.viewCostPrice || false}
                onChange={e => setUserForm({
                  ...userForm, permissions: {
                    ...(userForm.permissions as UserPermissions),
                    inventory: { ...(userForm.permissions as UserPermissions)?.inventory, viewCostPrice: e.target.checked }
                  }
                })} className="rounded text-bunyan-600 w-4 h-4" />
              السماح برؤية أسعار الشراء (التكلفة)
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input type="checkbox" checked={userForm.permissions?.analytics?.viewFull || false}
                onChange={e => setUserForm({
                  ...userForm, permissions: {
                    ...(userForm.permissions as UserPermissions),
                    analytics: { ...(userForm.permissions as UserPermissions)?.analytics, viewFull: e.target.checked }
                  }
                })} className="rounded text-bunyan-600 w-4 h-4" />
              السماح برؤية الأرباح في التحليلات
            </label>
          </div>

          <div className="pt-2">
            <label className="flex items-center gap-2 text-sm font-bold text-gray-900 cursor-pointer">
              <input type="checkbox" checked={userForm.isActive ?? true} onChange={e => setUserForm({ ...userForm, isActive: e.target.checked })} className="w-5 h-5 rounded text-bunyan-600" />
              السماح للمستخدم بالدخول (مفعّل)
            </label>
          </div>

          <button onClick={saveUser} className="w-full py-3 bg-bunyan-600 text-white font-bold rounded-xl mt-6 hover:bg-bunyan-700 transition-colors">
            حفظ واعتماد
          </button>
          {editingUser && editingUser.role !== 'owner' && (
            <button onClick={() => { updateUser(editingUser.id, { isActive: false }); setSlideOpen(false); showToast('تم إيقاف المستخدم', 'success'); }}
              className="w-full py-2 bg-red-50 text-red-600 font-bold rounded-xl mt-2 hover:bg-red-100 transition-colors">
              إيقاف المستخدم
            </button>
          )}
        </div>
      </SlideOver>
    </div>
  );
}
