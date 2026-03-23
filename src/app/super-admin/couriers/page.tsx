'use client';

import { useState } from 'react';
import { useDataStore } from '@/core/db/store';
import { useToast } from '@/shared/components/ui/Toast';
import { SlideOver } from '@/shared/components/ui/SlideOver';
import { Logo } from '@/shared/components/ui/Logo';
import {
  ShieldCheck, Edit2, Loader2, Wifi, WifiOff, Key, Mail,
  PlugZap, AlertCircle, CheckCircle2, Eye, EyeOff
} from 'lucide-react';

const AVAILABLE_PROVIDERS = [
  { id: 'vanex', name: 'VANEX', description: 'منصة التوصيل الرائدة في ليبيا' }
] as const;

type ProviderId = typeof AVAILABLE_PROVIDERS[number]['id'];

export default function SuperAdminCouriersPage() {
  const { superAdminCouriers, addSuperAdminCourier, updateSuperAdminCourier } = useDataStore();
  const { showToast } = useToast();

  const [slideOpen, setSlideOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<ProviderId>('vanex');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const openSlide = (pId: ProviderId, courier?: typeof superAdminCouriers[0]) => {
    setSelectedProvider(pId);
    setEmail(courier?.apiCredentials?.email ?? '');
    setPassword('');
    setEditingId(courier?.id ?? null);
    setConnectionStatus('idle');
    setSlideOpen(true);
  };

  const resetForm = () => {
    setEmail('');
    setPassword('');
    setEditingId(null);
    setConnectionStatus('idle');
  };

  const handleTestAndSave = async () => {
    if (!email.trim() || (!password && !editingId)) {
      return showToast('يجب إدخال البريد الإلكتروني وكلمة المرور', 'error');
    }

    setTestingConnection(true);
    setConnectionStatus('idle');

    try {
      if (selectedProvider === 'vanex') {
        const { vanexAdapter } = await import('@/core/delivery/VanexAdapter');

        let token = '';
        let passHash = '';

        if (password) {
          const authRes = await vanexAdapter.authenticate({ email, password });
          if (!authRes.success || !authRes.token) {
            setConnectionStatus('error');
            setTestingConnection(false);
            return showToast('البيانات غير صحيحة أو فشل الاتصال', 'error');
          }
          token = authRes.token;
          passHash = btoa(password);
        } else if (editingId) {
          const existing = superAdminCouriers.find(c => c.id === editingId);
          token = existing?.apiCredentials?.token || '';
          passHash = existing?.apiCredentials?.passwordHash || '';
        }

        const providerInfo = AVAILABLE_PROVIDERS.find(p => p.id === selectedProvider);
        const autoName = providerInfo ? `حساب المنظومة — ${providerInfo.name}` : 'حساب توصيل';

        const payload = {
          provider: selectedProvider,
          name: autoName,
          isActive: true,
          apiCredentials: { email, passwordHash: passHash, token },
        };

        if (editingId) {
          updateSuperAdminCourier(editingId, payload);
          showToast('تم تحديث بيانات الربط بنجاح', 'success');
        } else {
          addSuperAdminCourier({ id: `sac-${Date.now()}`, ...payload });
          showToast('تم إضافة الشركة وتم التحقق من الاتصال ✅', 'success');
        }

        setConnectionStatus('success');
        setTimeout(() => {
          setSlideOpen(false);
          resetForm();
        }, 1000);
      } else {
        showToast('هذا المزود غير مدعوم حالياً', 'warning');
      }
    } catch {
      setConnectionStatus('error');
      showToast('خطأ أثناء فحص البيانات', 'error');
    } finally {
      setTestingConnection(false);
    }
  };

  const currentProviderInfo = AVAILABLE_PROVIDERS.find(p => p.id === selectedProvider);
  const connectedCount = superAdminCouriers.filter(c => c.apiCredentials?.token).length;

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      
      {/* ── Header ── */}
      <div>
        <h1 className="text-2xl font-black text-gray-900 flex items-center gap-2.5">
          <div className="w-9 h-9 bg-gradient-to-br from-bunyan-500 to-purple-600 rounded-xl flex items-center justify-center shrink-0">
            <ShieldCheck size={18} className="text-white" />
          </div>
          تكامل شركات التوصيل
        </h1>
        <div className="flex items-center gap-3 mt-1.5">
          <p className="text-sm text-gray-500">
            إدارة بيانات الدخول للـ API على مستوى النظام
          </p>
          {connectedCount > 0 && (
            <span className="inline-flex items-center gap-1.5 text-xs bg-emerald-50 text-emerald-700 border border-emerald-100 px-2.5 py-1 rounded-full font-bold">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              {connectedCount} {connectedCount === 1 ? 'شركة متصلة' : 'شركات متصلة'}
            </span>
          )}
        </div>
      </div>

      {/* ── Cards Grid ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {AVAILABLE_PROVIDERS.map(provider => {
          const courier = superAdminCouriers.find(c => c.provider === provider.id);
          const isConnected = !!courier?.apiCredentials?.token;
          const maskedEmail = courier?.apiCredentials?.email
            ? courier.apiCredentials.email.replace(/(.{2})(.*)(@.*)/, '$1***$3')
            : null;

          return (
            <div key={provider.id} className="group relative bg-white rounded-2xl border border-gray-200 shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden flex flex-col">
              <div className="h-1 w-full bg-gradient-to-r from-orange-400 to-red-500" />
              
              <div className="p-5 flex-1 flex flex-col">
                {/* ── Flexbox justify-between items-start ── */}
                <div className="flex justify-between items-start gap-4 mb-4">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-black text-gray-900 tracking-wide leading-snug">{provider.name}</h3>
                    {isConnected && maskedEmail ? (
                      <p className="text-xs text-gray-400 mt-1 font-mono truncate" dir="ltr">
                        {maskedEmail}
                      </p>
                    ) : (
                      <p className="text-xs text-gray-400 mt-1 leading-relaxed">{provider.description}</p>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="flex items-center justify-center">
                      <Logo providerName={provider.id} size="md" variant="dark" />
                    </div>
                    {isConnected && (
                      <button
                        onClick={() => openSlide(provider.id, courier)}
                        className="p-1.5 text-gray-300 hover:text-bunyan-600 hover:bg-bunyan-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100 shrink-0"
                        title="تعديل بيانات الربط"
                      >
                        <Edit2 size={16} />
                      </button>
                    )}
                  </div>
                </div>

                {/* ── Status Row ── */}
                <div className="mt-auto pt-4 border-t border-gray-100 flex items-center justify-between">
                  {isConnected ? (
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                      <span className="text-xs font-semibold text-emerald-700">متصل بـ API</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <WifiOff size={13} className="text-gray-400" />
                      <span className="text-xs font-semibold text-gray-500">غير متصل</span>
                    </div>
                  )}

                  {!isConnected ? (
                    <button
                      onClick={() => openSlide(provider.id)}
                      className="inline-flex items-center gap-1.5 text-[11px] font-bold px-3 py-1.5 rounded-lg bg-bunyan-50 text-bunyan-700 hover:bg-bunyan-600 hover:text-white transition-colors border border-bunyan-100 hover:border-bunyan-600"
                    >
                      <PlugZap size={12} /> ربط الحساب
                    </button>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[10px] bg-emerald-50 text-emerald-600 border border-emerald-100 px-2 py-0.5 rounded-full font-bold">
                      <Wifi size={9} /> نشط
                    </span>
                  )}
                </div>

              </div>
            </div>
          );
        })}
      </div>

      {/* ── SlideOver ── */}
      <SlideOver
        isOpen={slideOpen}
        onClose={() => { setSlideOpen(false); resetForm(); }}
        title={editingId ? 'تعديل بيانات الربط' : 'ربط الحساب'}
      >
        <div className="p-1 space-y-6">
          <div className="flex flex-col items-center justify-center py-6 bg-gray-50 rounded-2xl border border-gray-100">
            <Logo providerName={selectedProvider} size="lg" variant="dark" />
            {currentProviderInfo && (
              <p className="mt-3 text-xs font-bold text-gray-500">
                إعدادات الربط مع {currentProviderInfo.name}
              </p>
            )}
          </div>

          <div className="space-y-4 pt-2 border-t border-gray-100">
            <h4 className="text-sm font-bold text-gray-800 flex items-center gap-2">
              <Key size={14} className="text-gray-400" />
              بيانات الدخول للـ API
            </h4>

            <div>
              <label className="flex items-center gap-1.5 text-xs font-bold text-gray-600 mb-1.5">
                <Mail size={12} className="text-gray-400" />
                البريد الإلكتروني <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                dir="ltr"
                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-bunyan-500/20 focus:border-bunyan-400 transition-all"
                placeholder="admin@example.com"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-600 mb-1.5">
                كلمة المرور{' '}
                {editingId && (
                  <span className="text-gray-400 font-normal">(اتركها فارغة للاحتفاظ بالقديمة)</span>
                )}
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  dir="ltr"
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-bunyan-500/20 focus:border-bunyan-400 transition-all pr-10"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors flex items-center justify-center"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
          </div>

          {connectionStatus === 'success' && (
            <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-sm text-emerald-700">
              <CheckCircle2 size={16} className="shrink-0" />
              <span className="font-bold">تم الاتصال بنجاح</span>
            </div>
          )}
          {connectionStatus === 'error' && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">
              <AlertCircle size={16} className="shrink-0" />
              <span className="font-bold">فشل الاتصال — تحقق من بياناتك</span>
            </div>
          )}

          <button
            disabled={testingConnection || !email || (!password && !editingId)}
            onClick={handleTestAndSave}
            className="w-full py-3 bg-bunyan-600 hover:bg-bunyan-700 disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed text-white rounded-xl font-bold text-sm transition-all flex justify-center items-center gap-2"
          >
            {testingConnection ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                جارٍ فحص الاتصال...
              </>
            ) : (
              <>
                <PlugZap size={16} />
                {editingId ? 'حفظ التغييرات' : 'فحص الاتصال وحفظ'}
              </>
            )}
          </button>
        </div>
      </SlideOver>
    </div>
  );
}
