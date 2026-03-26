'use client';

// src/app/(tenant)/delivery/companies/page.tsx
// إدارة شركات التوصيل — بناء شامل بمستوى SaaS عالمي
// مع دعم كامل لـ VanEx API ومتجر تطبيقات فاخر

import { useState, useMemo, useEffect } from 'react';
import { useUser } from '@/core/auth/hooks';
import { 
  useAddCourier, useUpdateCourier, useToggleCourier, 
  useDeleteCourier, useAddTreasuryAccount 
} from '@/core/db/hooks';
import { useCouriersQuery } from '@/core/db/hooks/useCouriers';
import { useTreasuryQuery } from '@/core/db/hooks/useTreasury';
import { useQueryClient } from '@tanstack/react-query';
import { useDataStore } from '@/core/db/store';
import { formatCurrency } from '@/shared/utils/format';
import { SlideOver } from '@/shared/components/ui/SlideOver';
import { ConfirmDialog } from '@/shared/components/ui/ConfirmDialog';
import { useToast } from '@/shared/components/ui/Toast';
import { getDeliveryAdapter } from '@/core/delivery';
import { Logo } from '@/shared/components/ui/Logo';
import {
  Plus, Trash2, Power, Edit2,
  Link2, Unlink, CheckCircle2, AlertCircle,
  Loader2, Phone, Hash,
  RefreshCw, Globe, Package,
  AlertTriangle, Truck, BarChart3, Eye,
  EyeOff, Zap, Wifi, WifiOff, ChevronDown,
  ChevronUp, DollarSign, ArrowUpRight, Info,
  Shield
} from 'lucide-react';
import type { CourierCompany } from '@/core/types';

// ═══ Providers Catalog ═══
const SUPPORTED_PROVIDERS = [
  {
    id: 'vanex',
    nameAr: 'فانكس',
    nameEn: 'VanEx',
    description: 'منصة التوصيل الرائدة في ليبيا',
    color: 'from-orange-500 via-red-500 to-pink-600',
    bgColor: 'from-orange-50 to-red-50',
    borderColor: 'border-orange-200',
    textColor: 'text-orange-700',
    badgeColor: 'bg-orange-100 text-orange-700',
    features: ['تتبع فوري لحظي', 'تسوية في يوم واحد', 'تغطية شاملة لليبيا', 'ربط API متقدم'],
    apiAvailable: true,
    hasLogo: true,
  },
  {
    id: 'alsaree3',
    nameAr: 'السريع',
    nameEn: 'Al-Saree3',
    description: 'شركة التوصيل السريع',
    logo: '⚡',
    color: 'from-blue-500 via-cyan-500 to-sky-600',
    bgColor: 'from-blue-50 to-cyan-50',
    borderColor: 'border-blue-200',
    textColor: 'text-blue-700',
    badgeColor: 'bg-blue-100 text-blue-700',
    features: ['توصيل سريع الفائق', 'أسعار تنافسية', 'شبكة واسعة'],
    apiAvailable: false,
  },
  {
    id: 'almeyar',
    nameAr: 'المعيار',
    nameEn: 'Al-Meyar',
    description: 'خدمات التوصيل المتميزة',
    logo: '🎯',
    color: 'from-emerald-500 via-teal-500 to-green-600',
    bgColor: 'from-emerald-50 to-teal-50',
    borderColor: 'border-emerald-200',
    textColor: 'text-emerald-700',
    badgeColor: 'bg-emerald-100 text-emerald-700',
    features: ['تغطية واسعة', 'خدمة عملاء 24/7', 'تأمين الشحنات'],
    apiAvailable: false,
  },
];


// ═══ Company Dashboard Card ═══
function CompanyCard({
  company,
  onEdit,
  onToggle,
  onDelete,
  onConnect,
  onDisconnect,
  onSyncCities,
  isSyncingCities,
}: {
  company: CourierCompany;
  onEdit: () => void;
  onToggle: () => void;
  onDelete: () => void;
  onConnect: () => void;
  onDisconnect: () => void;
  onSyncCities?: () => void;
  isSyncingCities?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);

  const stats = [
    {
      label: 'إجمالي الشحنات',
      value: company.totalShipments,
      icon: <Package size={16} />,
      color: 'text-gray-700',
      bg: 'bg-gray-50',
    },
    {
      label: 'تم التوصيل',
      value: company.totalDelivered,
      icon: <CheckCircle2 size={16} />,
      color: 'text-emerald-700',
      bg: 'bg-emerald-50',
      badge: '🟢',
    },
    {
      label: 'مرتجعة',
      value: company.totalReturned,
      icon: <RefreshCw size={16} />,
      color: 'text-red-600',
      bg: 'bg-red-50',
      badge: '🔴',
    },
    {
      label: 'قيد التحصيل',
      value: formatCurrency(company.pendingAmount || 0),
      icon: <DollarSign size={16} />,
      color: 'text-amber-700',
      bg: 'bg-amber-50',
      badge: '💰',
    },
  ];

  const providerInfo = SUPPORTED_PROVIDERS.find(p => p.id === company.apiProvider);

  return (
    <div className={`bg-white rounded-2xl border shadow-sm hover:shadow-lg transition-all duration-300 overflow-hidden ${
      company.isActive ? 'border-gray-200' : 'border-gray-100 opacity-70'
    }`}>
      {/* Accent Top Bar */}
      <div className={`h-1 w-full bg-gradient-to-r ${
        company.isApiConnected
          ? 'from-emerald-400 to-teal-500'
          : company.isActive
          ? 'from-bunyan-400 to-purple-500'
          : 'from-gray-300 to-gray-400'
      }`} />

      <div className="p-5">
        {/* Header Row */}
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            {/* Company Icon */}
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center overflow-hidden bg-gradient-to-br ${
              providerInfo ? providerInfo.color : 'from-gray-400 to-gray-500'
            } shadow-sm`}>
              {providerInfo?.hasLogo ? (
                <Logo providerName={providerInfo.id} size="sm" variant="light" onDarkBg />
              ) : (
                <span className="text-xl">{providerInfo?.logo || '🚚'}</span>
              )}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-bold text-gray-900 text-base">{company.name}</h3>
                <span className={`text-[11px] px-2 py-0.5 rounded-full font-semibold border ${
                  company.isActive
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : 'bg-gray-100 text-gray-500 border-gray-200'
                }`}>
                  {company.isActive ? '● نشطة' : '○ موقوفة'}
                </span>
                {company.isApiConnected && (
                  <span className="inline-flex items-center gap-1 text-[11px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    متصل بـ API
                  </span>
                )}
                {company.apiProvider && company.apiProvider !== 'none' && !company.isApiConnected && (
                  <span className="inline-flex items-center gap-1 text-[11px] bg-amber-50 text-amber-600 border border-amber-200 px-2.5 py-0.5 rounded-full font-medium">
                    <WifiOff size={9} />
                    غير مربوط
                  </span>
                )}
              </div>
              <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-gray-400 mt-1">
                <span className="font-mono uppercase text-bunyan-500 font-bold">{company.shortCode}</span>
                {company.merchantCode && (
                  <span className="flex items-center gap-0.5">
                    <Hash size={9} />{company.merchantCode}
                  </span>
                )}
                {company.contactPhone && (
                  <span className="flex items-center gap-0.5">
                    <Phone size={9} />{company.contactPhone}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-1.5 shrink-0">
            {company.apiProvider && company.apiProvider !== 'none' ? (
              company.isApiConnected ? (
                <>
                  {company.apiProvider?.includes('vanex') && onSyncCities && (
                    <button
                      onClick={onSyncCities}
                      disabled={isSyncingCities}
                      className="inline-flex items-center gap-1 text-xs bg-bunyan-50 text-bunyan-700 hover:bg-bunyan-100 px-3 py-1.5 rounded-lg transition-colors font-medium shadow-sm"
                    >
                      <RefreshCw size={12} className={isSyncingCities ? 'animate-spin' : 'hidden'} />
                      {isSyncingCities ? 'جاري التحديث...' : '🔄 تحديث قائمة المدن من فانكس'}
                    </button>
                  )}
                  <button
                    onClick={onDisconnect}
                    title="قطع الاتصال"
                    className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Unlink size={14} />
                  </button>
                </>
              ) : (
                <button
                  onClick={onConnect}
                  className="inline-flex items-center gap-1 text-xs bg-bunyan-600 hover:bg-bunyan-700 text-white px-3 py-1.5 rounded-lg transition-colors font-medium shadow-sm"
                >
                  <Link2 size={12} />
                  ربط API
                </button>
              )
            ) : null}
            <button
              onClick={onEdit}
              title="تعديل"
              className="p-2 text-gray-400 hover:text-bunyan-600 hover:bg-bunyan-50 rounded-lg transition-colors"
            >
              <Edit2 size={14} />
            </button>
            <button
              onClick={onToggle}
              title={company.isActive ? 'إيقاف' : 'تفعيل'}
              className={`p-2 rounded-lg transition-colors ${
                company.isActive
                  ? 'text-gray-400 hover:text-amber-500 hover:bg-amber-50'
                  : 'text-emerald-500 hover:bg-emerald-50'
              }`}
            >
              <Power size={14} />
            </button>
            <button
              onClick={onDelete}
              title="حذف"
              className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>

        {/* Stats Grid — Mini Dashboard */}
        <div className="grid grid-cols-4 gap-3 mb-4">
          {stats.map(stat => (
            <div
              key={stat.label}
              className={`${stat.bg} rounded-xl p-3 flex flex-col items-center justify-center text-center`}
            >
              <div className={`${stat.color} mb-1`}>{stat.icon}</div>
              <div className={`font-black text-base ${stat.color}`}>{stat.value}</div>
              <div className="text-[10px] text-gray-500 mt-0.5 leading-tight">{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Delivery Rate Bar */}
        {(company.totalShipments || 0) > 0 && (
          <div className="mb-3">
            <div className="flex justify-between text-[11px] text-gray-500 mb-1">
              <span>نسبة التوصيل</span>
              <span className="font-bold text-emerald-600">
                {Math.round(((company.totalDelivered || 0) / (company.totalShipments || 1)) * 100)}%
              </span>
            </div>
            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-emerald-400 to-teal-500 rounded-full transition-all"
                style={{ width: `${Math.round(((company.totalDelivered || 0) / (company.totalShipments || 1)) * 100)}%` }}
              />
            </div>
          </div>
        )}

        <div className="flex items-center justify-between pt-1">
          <span className="text-xs text-gray-400">
            رسوم التوصيل الافتراضية:{' '}
            <span className="text-gray-700 font-semibold">{formatCurrency(company.defaultDeliveryFee || 0)}</span>
            {(company.pricingZones || []).length > 0 && (
              <span className="mr-2 text-bunyan-500"> • {(company.pricingZones || []).length} مناطق تسعير</span>
            )}
          </span>
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 text-[11px] text-gray-400 hover:text-gray-600 transition-colors"
          >
            {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            {expanded ? 'أقل' : 'تفاصيل'}
          </button>
        </div>

        {/* Expanded Details */}
        {expanded && (
          <div className="mt-3 pt-3 border-t border-gray-100 space-y-2 animate-fade-in">
            {company.contactPerson && (
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <span className="text-gray-400">مسؤول التواصل:</span>
                <span className="font-medium text-gray-700">{company.contactPerson}</span>
              </div>
            )}
            {company.cities && company.cities.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {company.cities.map(city => (
                  <span key={city} className="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                    {city}
                  </span>
                ))}
              </div>
            )}
            {company.isApiConnected && company.apiCredentials?.tokenExpiresAt && (
              <div className="flex items-center gap-2 text-[11px] text-gray-400">
                <Shield size={11} />
                انتهاء صلاحية الرمز:{' '}
                {new Date(company.apiCredentials.tokenExpiresAt).toLocaleDateString('ar-LY')}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}


// ═══ Main Page ═══
export default function CompaniesPage() {
  const user = useUser();
  const tid = user?.tenantId || '';
  const queryClient = useQueryClient();

  const { data: couriers = [] } = useCouriersQuery(tid);
  const { data: treasuryData } = useTreasuryQuery(tid);
  const treasury = treasuryData?.accounts || [];

  const addCourier = useAddCourier();
  const updateCourier = useUpdateCourier();
  const toggleCourier = useToggleCourier();
  const deleteCourier = useDeleteCourier();
  const addTreasuryAccount = useAddTreasuryAccount();
  const { showToast } = useToast();

  // VanEx cities from global store
  const vanexCities = useDataStore(s => s.vanexCities);
  const fetchVanexCities = useDataStore(s => s.fetchVanexCities);

  const myCompanies = couriers;

  // Auto-fetch VanEx cities if any company is API connected
  useEffect(() => {
    const hasConnected = myCompanies.some(c => c.isApiConnected && c.apiProvider?.includes('vanex'));
    if (hasConnected && vanexCities.length === 0) {
      fetchVanexCities().catch(console.error);
    }
  }, [myCompanies, vanexCities.length, fetchVanexCities]);

  // State
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
  const [apiCredentials, setApiCredentials] = useState({ email: '', password: '', vanexFromRegionId: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionTestResult, setConnectionTestResult] = useState<
    'idle' | 'testing' | 'success' | 'error'
  >('idle');
  const [syncingCompanyId, setSyncingCompanyId] = useState<string | null>(null);

  const handleSyncVanexCities = async (company: CourierCompany) => {
    if (!company.apiCredentials?.token) return;
    setSyncingCompanyId(company.id);
    try {
      const adapter = getDeliveryAdapter('vanex');
      const apiCities = await adapter.getCities(company.apiCredentials.token);
      const apiCityIds = apiCities.map((c: { id: string | number }) => c.id.toString());

      const { createClient } = await import('@/core/db/supabase');
      const supabase = createClient();
      const { data: mappings, error: fetchErr } = await supabase
        .from('provider_geo_mappings')
        .select('*')
        .eq('provider', 'vanex');

      if (fetchErr) throw fetchErr;

      const idsToDisable = (mappings || [])
        .filter((m: { provider_city_id: string; is_active: boolean }) => m.provider_city_id && !apiCityIds.includes(m.provider_city_id) && m.is_active !== false)
        .map((m: { id: string }) => m.id);

      if (idsToDisable.length > 0) {
        await supabase
          .from('provider_geo_mappings')
          .update({ is_active: false })
          .in('id', idsToDisable);
      }

      showToast(`تم التحديث — ${apiCities.length} مدينة نشطة، ${idsToDisable.length} مدينة تم إيقافها`, 'success');
    } catch (err: unknown) {
      console.error(err);
      showToast(err instanceof Error ? err.message : 'خطأ أثناء التحديث', 'error');
    } finally {
      setSyncingCompanyId(null);
    }
  };

  // Handlers
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
      }).then(() => {
        queryClient.invalidateQueries({ queryKey: ['couriers', tid] });
      });
      showToast('تم تحديث بيانات الشركة بنجاح', 'success');
    } else {
      const newCompany: CourierCompany = {
        id: crypto.randomUUID(),
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
          id: crypto.randomUUID(),
          tenantId: tid,
          accountType: 'with_courier',
          accountName: `قيد التحصيل — ${form.name}`,
          balance: 0,
          linkedCourierId: newCompany.id,
        }).then(() => {
          queryClient.invalidateQueries({ queryKey: ['treasury', tid] });
        });
      }
      queryClient.invalidateQueries({ queryKey: ['couriers', tid] });
      showToast(`تمت إضافة ${form.name} بنجاح`, 'success');
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
            tokenExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
            vanexFromRegionId: apiCredentials.vanexFromRegionId ? Number(apiCredentials.vanexFromRegionId) : undefined,
          },
        }).then(() => {
          queryClient.invalidateQueries({ queryKey: ['couriers', tid] });
        });
        showToast(`✅ تم الربط بـ ${targetCompany.name} بنجاح`, 'success');

        // Auto-fetch Vanex cities immediately after successful connection
        if (targetCompany.apiProvider?.includes('vanex')) {
          fetchVanexCities().catch(console.error);
        }

        setTimeout(() => {
          setApiSlideOpen(false);
          setConnectionTestResult('idle');
          setApiCredentials({ email: '', password: '', vanexFromRegionId: '' });
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
    }).then(() => {
      queryClient.invalidateQueries({ queryKey: ['couriers', tid] });
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
      shortCode: c.shortCode || '',
      merchantCode: c.merchantCode || '',
      contactPhone: c.contactPhone || '',
      contactPerson: c.contactPerson || '',
      defaultDeliveryFee: c.defaultDeliveryFee || 0,
      apiProvider: (c.apiProvider as 'vanex' | 'mock' | 'none') ?? 'none',
    });
    setEditingId(c.id);
    setSlideOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const result = await deleteCourier(deleteId);
    if (result.success) {
      queryClient.invalidateQueries({ queryKey: ['couriers', tid] });
      queryClient.invalidateQueries({ queryKey: ['treasury', tid] });
      showToast('تم حذف الشركة', 'success');
    } else {
      showToast(result.error || 'لا يمكن الحذف', 'error');
    }
    setDeleteId(null);
  };

  // Totals
  const totalStats = useMemo(() => ({
    shipments: myCompanies.reduce((s: number, c: CourierCompany) => s + (c.totalShipments || 0), 0),
    delivered: myCompanies.reduce((s: number, c: CourierCompany) => s + (c.totalDelivered || 0), 0),
    returned: myCompanies.reduce((s: number, c: CourierCompany) => s + (c.totalReturned || 0), 0),
    pending: myCompanies.reduce((s: number, c: CourierCompany) => s + (c.pendingAmount || 0), 0),
    apiConnected: myCompanies.filter((c: CourierCompany) => c.isApiConnected).length,
  }), [myCompanies]);

  const apiTargetCompany = myCompanies.find((c: CourierCompany) => c.id === apiTargetId);

  const handleToggle = (id: string, current: boolean) => {
    toggleCourier(id).then(() => {
      queryClient.invalidateQueries({ queryKey: ['couriers', tid] });
    });
    showToast(current ? 'تم إيقاف الشركة' : 'تم تفعيل الشركة', current ? 'warning' : 'success');
  };

  return (
    <div className="space-y-6 animate-fade-in pb-10">

      {/* ══ Global Warning Banner ══ */}
      <div className="flex items-center gap-3 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-2xl p-4 shadow-sm">
        <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
          <AlertTriangle size={18} className="text-amber-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-amber-800">
            ⚠️ تنبيه: هذه الإعدادات تؤثر على عمليات التوصيل بالكامل
          </p>
          <p className="text-xs text-amber-600 mt-0.5">
            أي تعديل على الشركات أو الربط بـ API سيؤثر مباشرة على الطلبيات الجديدة. تأكد من دقة البيانات.
          </p>
        </div>
        {totalStats.apiConnected > 0 && (
          <span className="shrink-0 inline-flex items-center gap-1.5 bg-emerald-100 text-emerald-700 text-xs font-bold px-3 py-1.5 rounded-xl border border-emerald-200">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            {totalStats.apiConnected} {totalStats.apiConnected === 1 ? 'شركة متصلة' : 'شركات متصلة'}
          </span>
        )}
      </div>

      {/* ══ Header ══ */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-bunyan-500 to-purple-600 rounded-xl flex items-center justify-center">
              <Truck size={18} className="text-white" />
            </div>
            إدارة شركات التوصيل
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            تكوين شركات التوصيل وربط حساباتك بـ API للتشغيل التلقائي الكامل
          </p>
        </div>
        <button
          onClick={() => { resetForm(); setSlideOpen(true); }}
          className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl text-sm font-bold transition-all shadow-sm hover:shadow-emerald-500/20 hover:shadow-md"
        >
          <Plus size={16} />
          إضافة شركة يدوية
        </button>
      </div>

      {/* ══ Summary KPIs ══ */}
      {myCompanies.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'إجمالي الشحنات', value: totalStats.shipments, icon: <Package size={18} />, color: 'text-gray-600', bg: 'bg-white', border: 'border-gray-200' },
            { label: 'تم التوصيل', value: totalStats.delivered, icon: <CheckCircle2 size={18} />, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200' },
            { label: 'مرتجعة', value: totalStats.returned, icon: <RefreshCw size={18} />, color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200' },
            { label: 'قيد التحصيل', value: formatCurrency(totalStats.pending), icon: <DollarSign size={18} />, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200' },
          ].map(kpi => (
            <div key={kpi.label} className={`${kpi.bg} border ${kpi.border} rounded-2xl p-4 shadow-sm`}>
              <div className={`${kpi.color} mb-2`}>{kpi.icon}</div>
              <div className={`text-xl font-black ${kpi.color}`}>{kpi.value}</div>
              <div className="text-xs text-gray-500 mt-0.5">{kpi.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* ══ App Store — Supported Providers ══ */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
              <Globe size={16} className="text-bunyan-600" />
              شركات التوصيل المدعومة
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">اختر شركة وقم بتفعيل الربط التلقائي</p>
          </div>
          <span className="text-xs bg-bunyan-50 text-bunyan-600 font-medium px-2.5 py-1 rounded-full border border-bunyan-100">
            {SUPPORTED_PROVIDERS.filter(p => p.apiAvailable).length} بربط API
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {SUPPORTED_PROVIDERS.map(provider => {
            const linkedCompany = myCompanies.find(
              c => c.apiProvider === provider.id && c.isApiConnected
            );
            return (
              <div
                key={provider.id}
                className={`relative rounded-2xl border-2 p-5 transition-all duration-300 cursor-default
                  ${linkedCompany
                    ? `${provider.borderColor} bg-gradient-to-br ${provider.bgColor} shadow-sm`
                    : 'border-gray-100 bg-gray-50/50 hover:border-gray-200 hover:bg-white hover:shadow-sm'
                  }`}
              >
                {linkedCompany && (
                  <div className="absolute top-3 left-3">
                    <span className="inline-flex items-center gap-1 text-[10px] bg-emerald-500 text-white px-2 py-0.5 rounded-full font-bold">
                      <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                      مفعّل
                    </span>
                  </div>
                )}

                {/* Provider Logo/Icon */}
                <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${provider.color} flex items-center justify-center mb-4 shadow-md overflow-hidden`}>
                  {provider.hasLogo ? (
                    <Logo providerName={provider.id} size="sm" variant="light" onDarkBg />
                  ) : (
                    <span className="text-2xl">{provider.logo}</span>
                  )}
                </div>

                <h3 className="font-black text-gray-900 text-base mb-0.5">{provider.nameAr}</h3>
                <p className="text-xs text-gray-500 mb-3">{provider.description}</p>

                <div className="space-y-1.5 mb-4">
                  {provider.features.map(f => (
                    <div key={f} className="flex items-center gap-2 text-xs text-gray-600">
                      <CheckCircle2 size={12} className="text-emerald-500 shrink-0" />
                      {f}
                    </div>
                  ))}
                </div>

                {provider.apiAvailable ? (
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-bold border ${provider.badgeColor} border-current/20`}>
                      <Zap size={10} />
                      ربط API متاح
                    </span>
                    {linkedCompany && (
                      <span className="text-xs text-emerald-600 font-medium">
                        ← {linkedCompany.name}
                      </span>
                    )}
                  </div>
                ) : (
                  <span className="inline-flex items-center gap-1 text-xs bg-gray-100 text-gray-400 px-2.5 py-1 rounded-full border border-gray-200">
                    قريباً...
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ══ Company Cards ══ */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
            <BarChart3 size={16} className="text-bunyan-600" />
            شركاتك النشطة
            <span className="text-sm font-medium text-gray-400">({myCompanies.length})</span>
          </h2>
        </div>

        {myCompanies.length === 0 ? (
          <div className="bg-white rounded-2xl border-2 border-dashed border-gray-200 p-14 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Truck size={28} className="text-gray-400" />
            </div>
            <p className="text-gray-700 font-bold mb-1">لا توجد شركات توصيل مضافة بعد</p>
            <p className="text-sm text-gray-500 mb-4">أضف شركتك الأولى أو فعّل إحدى الشركات المدعومة</p>
            <button
              onClick={() => { resetForm(); setSlideOpen(true); }}
              className="inline-flex items-center gap-2 bg-bunyan-600 hover:bg-bunyan-700 text-white px-4 py-2 rounded-xl text-sm font-bold transition-colors"
            >
              <Plus size={15} />
              إضافة أول شركة
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {myCompanies.map(company => (
              <CompanyCard
                key={company.id}
                company={company}
                onEdit={() => openEdit(company)}
                onToggle={() => {
                  handleToggle(company.id, company.isActive);
                }}
                onDelete={() => setDeleteId(company.id)}
                onConnect={() => {
                  setApiTargetId(company.id);
                  setApiCredentials({ email: '', password: '', vanexFromRegionId: '' });
                  setConnectionTestResult('idle');
                  setApiSlideOpen(true);
                }}
                onDisconnect={() => {
                  const confirmed = window.confirm(
                    'قطع الاتصال سيوقف كل العمليات التلقائية مع الشركة.\nهل أنت متأكد؟'
                  );
                  if (confirmed) handleDisconnect(company.id);
                }}
                onSyncCities={() => handleSyncVanexCities(company)}
                isSyncingCities={syncingCompanyId === company.id}
              />
            ))}
          </div>
        )}
      </div>

      {/* ══ SlideOver — Add/Edit Company ══ */}
      <SlideOver
        isOpen={slideOpen}
        onClose={() => { setSlideOpen(false); resetForm(); }}
        title={editingId ? 'تعديل بيانات الشركة' : 'إضافة شركة توصيل يدوية'}
      >
        <div className="space-y-5 p-1">

          {!editingId && (
            <div className="bg-bunyan-50 border border-bunyan-100 rounded-xl p-4 text-sm text-bunyan-700 flex items-start gap-2">
              <Info size={15} className="mt-0.5 shrink-0" />
              <p>يمكنك إضافة شركة يدوياً دون ربط API، أو اختيار ربط API لتشغيل تلقائي كامل.</p>
            </div>
          )}

          {/* Fields Grid */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-gray-600 mb-1.5 block">اسم الشركة *</label>
              <input
                value={form.name}
                onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                placeholder="مثال: شركة السرعة"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-bunyan-400 focus:ring-2 focus:ring-bunyan-400/20 bg-white"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-600 mb-1.5 block">الرمز المختصر *</label>
              <input
                value={form.shortCode}
                onChange={e => setForm(p => ({ ...p, shortCode: e.target.value.toUpperCase() }))}
                placeholder="مثال: SPD"
                maxLength={5}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-mono uppercase focus:outline-none focus:border-bunyan-400 focus:ring-2 focus:ring-bunyan-400/20"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-gray-600 mb-1.5 block">كود التاجر</label>
              <input
                value={form.merchantCode}
                onChange={e => setForm(p => ({ ...p, merchantCode: e.target.value }))}
                placeholder="M-12345"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-bunyan-400 focus:ring-2 focus:ring-bunyan-400/20"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-600 mb-1.5 block">رسوم التوصيل (د.ل)</label>
              <input
                type="number"
                value={form.defaultDeliveryFee}
                onChange={e => setForm(p => ({ ...p, defaultDeliveryFee: Number(e.target.value) }))}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-bunyan-400 focus:ring-2 focus:ring-bunyan-400/20"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-gray-600 mb-1.5 block">هاتف الشركة</label>
              <input
                value={form.contactPhone}
                onChange={e => setForm(p => ({ ...p, contactPhone: e.target.value }))}
                placeholder="09XXXXXXXX"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-bunyan-400 focus:ring-2 focus:ring-bunyan-400/20"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-600 mb-1.5 block">مسؤول التواصل</label>
              <input
                value={form.contactPerson}
                onChange={e => setForm(p => ({ ...p, contactPerson: e.target.value }))}
                placeholder="اسم المندوب"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-bunyan-400 focus:ring-2 focus:ring-bunyan-400/20"
              />
            </div>
          </div>

          {!editingId && (
            <div>
              <label className="text-xs font-bold text-gray-600 mb-1.5 block">نوع الربط (API)</label>
              <select
                value={form.apiProvider}
                onChange={e => setForm(p => ({ ...p, apiProvider: e.target.value as 'vanex' | 'mock' | 'none' }))}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:border-bunyan-400 focus:ring-2 focus:ring-bunyan-400/20"
              >
                <option value="none">🚫 بدون ربط API (يدوي فقط)</option>
                <option value="vanex">🚀 VanEx — فانكس (ربط API كامل)</option>
                <option value="mock">🧪 محاكي (للاختبار فقط)</option>
              </select>
              {form.apiProvider !== 'none' && (
                <p className="text-[11px] text-bunyan-600 mt-1.5 bg-bunyan-50 px-3 py-2 rounded-lg border border-bunyan-100">
                  ✅ بعد الإضافة، ستظهر زر &quot;ربط API&quot; على البطاقة لإدخال بيانات اعتمادك
                </p>
              )}
            </div>
          )}

          <button
            onClick={handleSave}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-xl text-sm font-bold transition-all shadow-sm hover:shadow-emerald-500/20 hover:shadow-md"
          >
            {editingId ? '💾 حفظ التعديلات' : '+ إضافة الشركة'}
          </button>
        </div>
      </SlideOver>

      {/* ══ SlideOver — API Connection ══ */}
      <SlideOver
        isOpen={apiSlideOpen}
        onClose={() => { setApiSlideOpen(false); setConnectionTestResult('idle'); }}
        title={`ربط حساب ${apiTargetCompany?.name ?? ''} بـ API`}
      >
        <div className="space-y-5 p-1">

          {/* Provider Info */}
          {apiTargetCompany?.apiProvider === 'vanex' && (
            <div className="flex items-center gap-4 bg-gradient-to-r from-orange-50 to-red-50 border border-orange-200 rounded-2xl p-4">
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center shadow-md overflow-hidden">
                <Logo providerName="vanex" size="sm" variant="light" onDarkBg />
              </div>
              <div>
                <h3 className="font-bold text-gray-900">VanEx API</h3>
                <p className="text-xs text-gray-500">منصة التوصيل الرائدة في ليبيا</p>
                <a
                  href="https://app.vanex.ly"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-orange-600 hover:underline flex items-center gap-0.5 mt-1"
                >
                  app.vanex.ly <ArrowUpRight size={10} />
                </a>
              </div>
            </div>
          )}

          <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-sm text-blue-700 leading-relaxed flex items-start gap-2">
            <Shield size={15} className="mt-0.5 shrink-0 text-blue-500" />
            <p>أدخل بيانات حسابك في شركة التوصيل. سيحفظ النظام رمز الدخول بشكل مشفر ولن يُعرض مجدداً.</p>
          </div>

          <div>
            <label className="text-xs font-bold text-gray-600 mb-1.5 block">
              البريد الإلكتروني أو رقم الهاتف *
            </label>
            <input
              type="text"
              value={apiCredentials.email}
              onChange={e => setApiCredentials(p => ({ ...p, email: e.target.value }))}
              placeholder="البريد الإلكتروني أو رقم الهاتف"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-bunyan-400 focus:ring-2 focus:ring-bunyan-400/20"
              dir="ltr"
            />
          </div>

          {apiTargetCompany?.apiProvider === 'vanex' && (
            <div>
              <label className="text-xs font-bold text-gray-600 mb-1.5 block">
                رقم منطقة الإرسال (من فانكس)
              </label>
              <input
                type="number"
                value={apiCredentials.vanexFromRegionId}
                onChange={e => setApiCredentials(p => ({ ...p, vanexFromRegionId: e.target.value }))}
                placeholder="مثال: 54"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-bunyan-400 focus:ring-2 focus:ring-bunyan-400/20"
                dir="ltr"
              />
              <p className="text-[10px] text-gray-500 mt-1.5 flex items-start gap-1">
                <span className="shrink-0">💬</span> 
                ستجد هذا الرقم في لوحة فانكس — يُستخدم لحساب سعر الشحن تلقائياً
              </p>
            </div>
          )}

          <div>
            <label className="text-xs font-bold text-gray-600 mb-1.5 block">كلمة المرور *</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={apiCredentials.password}
                onChange={e => setApiCredentials(p => ({ ...p, password: e.target.value }))}
                placeholder="••••••••"
                onKeyDown={e => e.key === 'Enter' && handleTestConnection()}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-bunyan-400 focus:ring-2 focus:ring-bunyan-400/20 pr-10"
                dir="ltr"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>

          {/* Connection Result */}
          {connectionTestResult === 'success' && (
            <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-sm text-emerald-700">
              <CheckCircle2 size={18} className="text-emerald-500 shrink-0" />
              <div>
                <p className="font-bold">تم الربط بنجاح ✅</p>
                <p className="text-xs text-emerald-600 mt-0.5">سيتم جلب المدن والبيانات تلقائياً الآن</p>
              </div>
            </div>
          )}

          {connectionTestResult === 'error' && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-600">
              <AlertCircle size={18} className="text-red-500 shrink-0" />
              <div>
                <p className="font-bold">فشل الاتصال</p>
                <p className="text-xs mt-0.5">تحقق من صحة البريد الإلكتروني وكلمة المرور وحاول مجدداً</p>
              </div>
            </div>
          )}

          <button
            onClick={handleTestConnection}
            disabled={isConnecting || connectionTestResult === 'success'}
            className={`w-full py-3 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 ${
              connectionTestResult === 'success'
                ? 'bg-emerald-100 text-emerald-700 cursor-default'
                : 'bg-bunyan-600 hover:bg-bunyan-700 disabled:opacity-60 text-white shadow-sm hover:shadow-bunyan-500/20 hover:shadow-md'
            }`}
          >
            {isConnecting ? (
              <><Loader2 size={16} className="animate-spin" /> جاري الاتصال والتحقق...</>
            ) : connectionTestResult === 'success' ? (
              <><CheckCircle2 size={16} /> تم ربط الحساب بنجاح</>
            ) : (
              <><Wifi size={16} /> اختبار الاتصال والربط</>
            )}
          </button>
        </div>
      </SlideOver>

      {/* ══ ConfirmDialog — Delete ══ */}
      <ConfirmDialog
        isOpen={!!deleteId}
        title="حذف شركة التوصيل"
        message="هل أنت متأكد من حذف هذه الشركة؟ سيتم حذف كل بيانات الربط ولا يمكن التراجع."
        confirmLabel="حذف"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  );
}
