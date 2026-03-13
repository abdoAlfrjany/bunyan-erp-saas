'use client';

import { useState } from 'react';
import { useAuthStore } from '@/core/auth/store';
import { useDataStore } from '@/core/db/store';
import { formatCurrency } from '@/shared/utils/format';
import { SlideOver } from '@/shared/components/ui/SlideOver';
import { ConfirmDialog } from '@/shared/components/ui/ConfirmDialog';
import { useToast } from '@/shared/components/ui/Toast';
import { getDeliveryAdapter } from '@/core/delivery';
import {
  Plus, Trash2, Power, Edit2,
  Link2, Unlink, CheckCircle2, AlertCircle,
  Loader2, Building2, Phone, Hash,
  RefreshCw, Store
} from 'lucide-react';
import type { CourierCompany } from '@/core/types';

const SUPPORTED_PROVIDERS = [
  {
    id: 'vanex',
    nameAr: 'فانكس',
    description: 'منصة التوصيل الرائدة في ليبيا',
    logo: '🚀',
    color: 'from-orange-500 to-red-500',
    features: ['تتبع فوري', 'تسوية في يوم واحد', 'تغطية كاملة لليبيا'],
    apiAvailable: true,
  },
  {
    id: 'alsaree3',
    nameAr: 'السريع',
    description: 'شركة التوصيل السريع',
    logo: '⚡',
    color: 'from-blue-500 to-cyan-500',
    features: ['توصيل سريع', 'أسعار منافسة'],
    apiAvailable: false,
  },
  {
    id: 'almeyar',
    nameAr: 'المعيار',
    description: 'خدمات التوصيل المتميزة',
    logo: '🎯',
    color: 'from-emerald-500 to-teal-500',
    features: ['تغطية واسعة', 'خدمة عملاء متميزة'],
    apiAvailable: false,
  },
];

export default function CompaniesPage() {
  const { user } = useAuthStore();
  const {
    couriers, getForTenant, addCourier, updateCourier,
    toggleCourier, deleteCourier, addTreasuryAccount, treasury
  } = useDataStore();
  const { showToast } = useToast();
  const tid = user?.tenantId || '';
  const myCompanies = getForTenant(couriers, tid);

  const [slideOpen, setSlideOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: '', shortCode: '', merchantCode: '',
    contactPhone: '', contactPerson: '',
    defaultDeliveryFee: 15,
    apiProvider: 'none' as 'vanex' | 'mock' | 'none',
  });

  const [apiSlideOpen, setApiSlideOpen] = useState(false);
  const [apiTargetId, setApiTargetId] = useState<string | null>(null);
  const [apiCredentials, setApiCredentials] = useState({ email: '', password: '' });
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionTestResult, setConnectionTestResult] = useState<
    'idle' | 'testing' | 'success' | 'error'
  >('idle');

  const handleSave = () => {
    if (!form.name || !form.shortCode) {
      showToast('يرجى إدخال اسم الشركة والرمز المختصر', 'error');
      return;
    }

    if (editingId) {
      updateCourier(editingId, {
        name: form.name,
        shortCode: form.shortCode.toUpperCase(),
        merchantCode: form.merchantCode,
        contactPhone: form.contactPhone,
        contactPerson: form.contactPerson,
        defaultDeliveryFee: form.defaultDeliveryFee,
      });
      showToast('تم تحديث بيانات الشركة', 'success');
    } else {
      const newCompany: CourierCompany = {
        id: `cour-${Date.now()}`,
        tenantId: tid,
        name: form.name,
        shortCode: form.shortCode.toUpperCase(),
        merchantCode: form.merchantCode,
        contactPhone: form.contactPhone,
        contactPerson: form.contactPerson,
        defaultDeliveryFee: form.defaultDeliveryFee,
        isActive: true,
        cities: [],
        pricingZones: [],
        requiredFields: [],
        totalShipments: 0,
        totalDelivered: 0,
        totalReturned: 0,
        pendingAmount: 0,
        apiProvider: form.apiProvider,
        isApiConnected: false,
        connectionStatus: 'disconnected',
      };
      addCourier(newCompany);

      const existingAccount = treasury.find(
        a => a.tenantId === tid && a.linkedCourierId === newCompany.id
      );
      if (!existingAccount) {
        addTreasuryAccount({
          id: `acc-${newCompany.id}`,
          tenantId: tid,
          accountType: 'with_courier',
          accountName: `قيد التحصيل — ${form.name}`,
          balance: 0,
          linkedCourierId: newCompany.id,
        });
      }
      showToast(`تمت إضافة شركة ${form.name} بنجاح`, 'success');
    }

    setSlideOpen(false);
    resetForm();
  };

  const handleTestConnection = async () => {
    if (!apiCredentials.email || !apiCredentials.password) {
      showToast('أدخل البريد الإلكتروني وكلمة المرور أولاً', 'error');
      return;
    }
    const targetCompany = myCompanies.find(c => c.id === apiTargetId);
    if (!targetCompany?.apiProvider || targetCompany.apiProvider === 'none') return;

    setConnectionTestResult('testing');
    setIsConnecting(true);

    try {
      const adapter = getDeliveryAdapter(targetCompany.apiProvider);
      const result = await adapter.authenticate(apiCredentials);

      if (result.success && result.token) {
        setConnectionTestResult('success');
        updateCourier(apiTargetId!, {
          isApiConnected: true,
          connectionStatus: 'connected',
          apiCredentials: {
            email: apiCredentials.email,
            passwordHash: btoa(apiCredentials.password),
            token: result.token,
            tokenExpiresAt: new Date(
              Date.now() + 7 * 24 * 60 * 60 * 1000
            ).toISOString(),
          },
        });
        showToast(`✅ تم الربط بـ ${targetCompany.name} بنجاح`, 'success');
        setTimeout(() => {
          setApiSlideOpen(false);
          setConnectionTestResult('idle');
          setApiCredentials({ email: '', password: '' });
        }, 1500);
      } else {
        setConnectionTestResult('error');
        showToast(result.error || 'فشل الاتصال — تحقق من البيانات', 'error');
      }
    } catch {
      setConnectionTestResult('error');
      showToast('خطأ في الاتصال — حاول مرة أخرى', 'error');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = (id: string) => {
    updateCourier(id, {
      isApiConnected: false,
      connectionStatus: 'disconnected',
      apiCredentials: {},
    });
    showToast('تم قطع الاتصال بالشركة', 'warning');
  };

  const resetForm = () => {
    setForm({
      name: '', shortCode: '', merchantCode: '',
      contactPhone: '', contactPerson: '',
      defaultDeliveryFee: 15, apiProvider: 'none',
    });
    setEditingId(null);
  };

  const openEdit = (c: CourierCompany) => {
    setForm({
      name: c.name,
      shortCode: c.shortCode,
      merchantCode: c.merchantCode,
      contactPhone: c.contactPhone,
      contactPerson: c.contactPerson,
      defaultDeliveryFee: c.defaultDeliveryFee,
      apiProvider: (c.apiProvider as 'vanex' | 'mock' | 'none') ?? 'none',
    });
    setEditingId(c.id);
    setSlideOpen(true);
  };

  const handleDelete = () => {
    if (!deleteId) return;
    const result = deleteCourier(deleteId);
    if (result.success) {
      showToast('تم حذف الشركة', 'success');
    } else {
      showToast(result.error || 'لا يمكن الحذف', 'error');
    }
    setDeleteId(null);
  };

  const ConnectionBadge = ({ company }: { company: CourierCompany }) => {
    if (!company.apiProvider || company.apiProvider === 'none') return null;
    if (company.isApiConnected) {
      return (
        <span className="inline-flex items-center gap-1 text-[11px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full font-medium">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          متصل بـ API
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 text-[11px] bg-red-50 text-red-600 border border-red-200 px-2 py-0.5 rounded-full font-medium">
        <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
        غير متصل
      </span>
    );
  };

  return (
    <div className="space-y-6 animate-fade-in pb-10">

      {/* الهيدر */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Building2 size={24} className="text-emerald-600" />
            إدارة الشركات
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            تكوين شركات التوصيل وربط حساباتك بـ API للتشغيل التلقائي
          </p>
        </div>
        <button
          onClick={() => { resetForm(); setSlideOpen(true); }}
          className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-colors shadow-sm"
        >
          <Plus size={16} />
          إضافة شركة
        </button>
      </div>

      {/* App Store */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
          <Store size={16} className="text-bunyan-600" />
          شركات التوصيل المدعومة
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {SUPPORTED_PROVIDERS.map(provider => {
            const linked = myCompanies.find(
              c => c.apiProvider === provider.id && c.isApiConnected
            );
            return (
              <div
                key={provider.id}
                className="relative rounded-xl border border-gray-100 p-4 hover:border-bunyan-200 transition-colors"
              >
                {linked && (
                  <span className="absolute top-3 left-3 text-[10px] bg-emerald-500 text-white px-2 py-0.5 rounded-full">
                    ✓ مفعّل
                  </span>
                )}
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${provider.color} flex items-center justify-center text-xl mb-3`}>
                  {provider.logo}
                </div>
                <h3 className="font-bold text-gray-900 text-sm">{provider.nameAr}</h3>
                <p className="text-xs text-gray-500 mt-0.5 mb-3">{provider.description}</p>
                <div className="space-y-1 mb-3">
                  {provider.features.map(f => (
                    <div key={f} className="flex items-center gap-1 text-[11px] text-gray-500">
                      <CheckCircle2 size={10} className="text-emerald-500" />
                      {f}
                    </div>
                  ))}
                </div>
                {provider.apiAvailable ? (
                  <span className="inline-block text-[11px] bg-bunyan-50 text-bunyan-700 px-2 py-0.5 rounded-full border border-bunyan-200">
                    ربط API متاح
                  </span>
                ) : (
                  <span className="inline-block text-[11px] bg-gray-50 text-gray-400 px-2 py-0.5 rounded-full border border-gray-200">
                    قريباً
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* قائمة الشركات */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-gray-700">
          شركاتك المضافة ({myCompanies.length})
        </h2>

        {myCompanies.length === 0 && (
          <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-10 text-center">
            <Building2 size={40} className="mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500 text-sm">لا توجد شركات مضافة بعد</p>
            <button
              onClick={() => { resetForm(); setSlideOpen(true); }}
              className="mt-3 text-sm text-bunyan-600 hover:underline"
            >
              + أضف أول شركة
            </button>
          </div>
        )}

        {myCompanies.map(company => (
          <div
            key={company.id}
            className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm hover:shadow-md transition-shadow"
          >
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">

              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-3 flex-wrap">
                  <h3 className="font-bold text-gray-900 text-base">{company.name}</h3>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    company.isActive
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : 'bg-gray-100 text-gray-500'
                  }`}>
                    {company.isActive ? 'نشطة' : 'موقوفة'}
                  </span>
                  <ConnectionBadge company={company} />
                </div>

                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                  {company.merchantCode && (
                    <span className="flex items-center gap-1">
                      <Hash size={10} /> كود التاجر: {company.merchantCode}
                    </span>
                  )}
                  {company.contactPhone && (
                    <span className="flex items-center gap-1">
                      <Phone size={10} /> {company.contactPhone}
                    </span>
                  )}
                  {company.contactPerson && (
                    <span className="flex items-center gap-1">
                      مسؤول التواصل: {company.contactPerson}
                    </span>
                  )}
                </div>

                <div className="flex gap-4 pt-1">
                  {[
                    { label: 'الشحنات',      value: company.totalShipments,               color: 'text-gray-700' },
                    { label: 'تم التوصيل',   value: company.totalDelivered,               color: 'text-emerald-600' },
                    { label: 'مرتجعة',       value: company.totalReturned,                color: 'text-red-500' },
                    { label: 'قيد التحصيل', value: formatCurrency(company.pendingAmount), color: 'text-amber-600' },
                  ].map(stat => (
                    <div key={stat.label} className="text-center">
                      <div className={`font-bold text-sm ${stat.color}`}>{stat.value}</div>
                      <div className="text-[10px] text-gray-400">{stat.label}</div>
                    </div>
                  ))}
                </div>

                <div className="text-[11px] text-gray-400 pt-1">
                  الرسوم الافتراضية:{' '}
                  <span className="text-gray-600 font-medium">
                    {formatCurrency(company.defaultDeliveryFee)}
                  </span>
                  {company.pricingZones.length > 0 && (
                    <span> • {company.pricingZones.length} منطقة تسعير</span>
                  )}
                </div>
              </div>

              {/* الأزرار */}
              <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">

                {company.apiProvider && company.apiProvider !== 'none' && (
                  company.isApiConnected ? (
                    <button
                      onClick={() => {
                        const confirmed = window.confirm(
                          '⚠️ تحذير شديد\n\n' +
                          'قطع الاتصال سيوقف كل العمليات التلقائية مع الشركة فوراً:\n\n' +
                          '• لن تتمكن من إنشاء شحنات جديدة تلقائياً\n' +
                          '• لن تتحدث حالات الشحنات تلقائياً\n' +
                          '• يجب إعادة ربط حسابك يدوياً\n\n' +
                          'هل أنت متأكد 100% من قطع الاتصال؟'
                        );
                        if (confirmed) handleDisconnect(company.id);
                      }}
                      className="inline-flex items-center gap-1.5 text-xs bg-gray-50 hover:bg-red-50 text-gray-400 hover:text-red-500 border border-gray-200 hover:border-red-200 px-3 py-2 rounded-lg transition-colors opacity-60 hover:opacity-100"
                    >
                      <Unlink size={13} />
                      قطع الاتصال
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        setApiTargetId(company.id);
                        setApiCredentials({ email: '', password: '' });
                        setConnectionTestResult('idle');
                        setApiSlideOpen(true);
                      }}
                      className="inline-flex items-center gap-1.5 text-xs bg-bunyan-50 hover:bg-bunyan-100 text-bunyan-700 border border-bunyan-200 px-3 py-2 rounded-lg transition-colors"
                    >
                      <Link2 size={13} />
                      ربط الحساب
                    </button>
                  )
                )}

                <button
                  onClick={() => openEdit(company)}
                  className="p-2 text-gray-400 hover:text-bunyan-600 hover:bg-bunyan-50 rounded-lg transition-colors"
                >
                  <Edit2 size={15} />
                </button>
                <button
                  onClick={() => toggleCourier(company.id)}
                  className={`p-2 rounded-lg transition-colors ${
                    company.isActive
                      ? 'text-gray-400 hover:text-amber-500 hover:bg-amber-50'
                      : 'text-emerald-500 hover:bg-emerald-50'
                  }`}
                >
                  <Power size={15} />
                </button>
                <button
                  onClick={() => setDeleteId(company.id)}
                  className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* SlideOver — إضافة/تعديل شركة */}
      <SlideOver
        isOpen={slideOpen}
        onClose={() => { setSlideOpen(false); resetForm(); }}
        title={editingId ? 'تعديل بيانات الشركة' : 'إضافة شركة توصيل جديدة'}
      >
        <div className="space-y-4 p-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">اسم الشركة *</label>
              <input
                value={form.name}
                onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                placeholder="مثال: شركة السرعة"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-bunyan-400"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">الرمز المختصر *</label>
              <input
                value={form.shortCode}
                onChange={e => setForm(p => ({ ...p, shortCode: e.target.value.toUpperCase() }))}
                placeholder="مثال: SPD"
                maxLength={5}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono uppercase focus:outline-none focus:border-bunyan-400"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">كود التاجر (في نظامهم)</label>
              <input
                value={form.merchantCode}
                onChange={e => setForm(p => ({ ...p, merchantCode: e.target.value }))}
                placeholder="M-12345"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-bunyan-400"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">الرسوم الافتراضية (د.ل)</label>
              <input
                type="number"
                value={form.defaultDeliveryFee}
                onChange={e => setForm(p => ({ ...p, defaultDeliveryFee: Number(e.target.value) }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-bunyan-400"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">هاتف الشركة</label>
              <input
                value={form.contactPhone}
                onChange={e => setForm(p => ({ ...p, contactPhone: e.target.value }))}
                placeholder="09XXXXXXXX"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-bunyan-400"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">مسؤول التواصل</label>
              <input
                value={form.contactPerson}
                onChange={e => setForm(p => ({ ...p, contactPerson: e.target.value }))}
                placeholder="اسم المندوب"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-bunyan-400"
              />
            </div>
          </div>

          {!editingId && (
            <div>
              <label className="text-xs text-gray-500 mb-1 block">ربط API (اختياري)</label>
              <select
                value={form.apiProvider}
                onChange={e => setForm(p => ({ ...p, apiProvider: e.target.value as 'vanex' | 'mock' | 'none' }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:border-bunyan-400"
              >
                <option value="none">بدون ربط API</option>
                <option value="vanex">🚀 VanEx — فانكس</option>
                <option value="mock">🧪 محاكي للاختبار</option>
              </select>
              {form.apiProvider !== 'none' && (
                <p className="text-[11px] text-bunyan-600 mt-1 bg-bunyan-50 px-2 py-1 rounded">
                  بعد الإضافة ستظهر زر &quot;ربط الحساب&quot; لإدخال بيانات الاعتماد
                </p>
              )}
            </div>
          )}

          <button
            onClick={handleSave}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 rounded-xl text-sm font-medium transition-colors mt-2"
          >
            {editingId ? 'حفظ التعديلات' : 'إضافة الشركة'}
          </button>
        </div>
      </SlideOver>

      {/* SlideOver — ربط API */}
      <SlideOver
        isOpen={apiSlideOpen}
        onClose={() => { setApiSlideOpen(false); setConnectionTestResult('idle'); }}
        title={`ربط حساب ${myCompanies.find(c => c.id === apiTargetId)?.name ?? ''}`}
      >
        <div className="space-y-5 p-4">

          <div className="bg-bunyan-50 border border-bunyan-100 rounded-xl p-4 text-sm text-bunyan-700 leading-relaxed">
            أدخل بيانات حسابك في شركة التوصيل. سيقوم النظام بالتحقق من صحتها
            وحفظ رمز الدخول تلقائياً بشكل مشفر.
          </div>

          <div>
            <label className="text-xs text-gray-500 mb-1 block">البريد الإلكتروني / الهاتف *</label>
            <input
              type="text"
              value={apiCredentials.email}
              onChange={e => setApiCredentials(p => ({ ...p, email: e.target.value }))}
              placeholder="البريد الإلكتروني أو رقم الهاتف (09XXXXXXXX)"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-bunyan-400"
            />
          </div>

          <div>
            <label className="text-xs text-gray-500 mb-1 block">كلمة المرور *</label>
            <input
              type="password"
              value={apiCredentials.password}
              onChange={e => setApiCredentials(p => ({ ...p, password: e.target.value }))}
              placeholder="••••••••"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-bunyan-400"
            />
          </div>

          {connectionTestResult === 'success' && (
            <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-sm text-emerald-700">
              <CheckCircle2 size={16} />
              تم الاتصال بنجاح — بياناتك صحيحة ✅
            </div>
          )}

          {connectionTestResult === 'error' && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-600">
              <AlertCircle size={16} />
              فشل الاتصال — تحقق من البيانات وحاول مجدداً
            </div>
          )}

          <button
            onClick={handleTestConnection}
            disabled={isConnecting || connectionTestResult === 'success'}
            className="w-full bg-bunyan-600 hover:bg-bunyan-700 disabled:opacity-50 text-white py-2.5 rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-2"
          >
            {isConnecting ? (
              <><Loader2 size={15} className="animate-spin" /> جاري الاتصال...</>
            ) : connectionTestResult === 'success' ? (
              <><CheckCircle2 size={15} /> تم الربط بنجاح</>
            ) : (
              <><RefreshCw size={15} /> اختبار الاتصال والربط</>
            )}
          </button>
        </div>
      </SlideOver>

      {/* ConfirmDialog — حذف */}
      <ConfirmDialog
        isOpen={!!deleteId}
        title="حذف شركة التوصيل"
        message="هل أنت متأكد من حذف هذه الشركة؟ سيتم حذف كل بيانات الربط معها ولا يمكن التراجع."
        confirmLabel="حذف"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  );
}
