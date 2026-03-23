// src/app/login/page.tsx
// Split-Screen — النصف الأيسر Gradient بنيان / النصف الأيمن نموذج الدخول
// المنطق: super@bunyan.ly → /super-admin | SEED_USERS → /dashboard أو /orders

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/core/auth/store';
import { useDataStore } from '@/core/db/store';
import { Eye, EyeOff, LogIn, Loader2, UserPlus, ShieldCheck } from 'lucide-react';
import { Logo } from '@/shared/components/ui/Logo';
import { useToast } from '@/shared/components/ui/Toast';

const SUPER_ADMIN_EMAIL = 'super@bunyan.ly';
// ⚠️ SuperAdmin check now goes through Supabase Auth like all other users

import { createClient } from '@/core/db/supabase';

export default function LoginPage() {
  const router = useRouter();
  const { setUser } = useAuthStore();
  const dataStore = useDataStore();
  const { showToast } = useToast();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier || !password) {
      setError('يرجى إدخال البريد الإلكتروني وكلمة المرور');
      return;
    }
    setIsLoading(true);
    setError('');

    try {
      const email = identifier.toLowerCase().trim();
      console.log('🚀 [Login] Attempting login for:', email);

      // ══ مستخدمو المتاجر والسوبر أدمن (Supabase) ══
      const supabase = createClient();

      // إضافة مهلة زمنية (Timeout) للطلب لضمان عدم التعليق على الجوال
      const loginPromise = supabase.auth.signInWithPassword({ email, password });
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('تأخر الرد من الخادم (Timeout) - تأكد من جودة الإنترنت')), 15000)
      );

      console.log('📡 [Login] Connecting to Supabase...');
      const { data: authData, error: authError } = await Promise.race([loginPromise, timeoutPromise]) as any;

      if (authError || !authData.user) {
        console.error('❌ [Login] Auth Error:', authError);
        setError('البريد الإلكتروني أو كلمة المرور غير صحيحة');
        setIsLoading(false);
        return;
      }

      console.log('✅ [Login] Auth Success, fetching profile...');
      
      // جلب البروفايل مع مهلة زمنية أيضاً
      const { data: profile, error: profileError } = await (Promise.race([
        supabase.from('profiles').select('*, tenants(*)').eq('id', authData.user.id).single(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('تأخر جلب بيانات البروفايل')), 10000))
      ]) as any);

      if (profileError || !profile) {
        console.error('❌ [Login] Profile Error:', profileError);
        await supabase.auth.signOut();
        setError('حدث خطأ أثناء جلب بيانات حسابك');
        setIsLoading(false);
        return;
      }

      const tenant = (profile as any).tenants;

      if (!profile.is_active) {
        await supabase.auth.signOut();
        setError('هذا الحساب غير نشط — تواصل مع صاحب المتجر');
        setIsLoading(false);
        return;
      }

      if (tenant && !tenant.is_active) {
        await supabase.auth.signOut();
        setError('هذا المتجر موقوف مؤقتاً — تواصل مع فريق Bunyan');
        setIsLoading(false);
        return;
      }

      // تحويل الاستجابة للتوافق مع AuthUser
      const authUser = {
        id: profile.id,
        tenantId: profile.tenant_id,
        fullName: profile.full_name,
        phone: profile.phone ?? null,
        role: profile.role as 'owner' | 'partner' | 'employee',
        isActive: profile.is_active,
        email: profile.email,
        tenantName: tenant?.name,
        permissions: profile.permissions,
      };

      localStorage.setItem('erp_user', JSON.stringify(authUser));
      setUser(authUser);
      
      // التوجيه الفوري حسب الدور
      if (profile.role === 'super_admin') {
        router.push('/super-admin');
      } else {
        router.push(profile.role === 'owner' ? '/dashboard' : '/orders');
      }
    } catch (err: any) {
      setError(err?.message || 'حدث خطأ غير متوقع — تأكد من اتصالك وأعد المحاولة');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex" dir="rtl">
      {/* ══ النصف الأيسر — Gradient بنيان ══ */}
      <div className="hidden lg:flex flex-col items-center justify-center flex-1
        bg-gradient-to-br from-bunyan-800 via-bunyan-700 to-purple-900
        text-white p-12 relative overflow-hidden">

        {/* Decorative circles */}
        <div className="absolute -bottom-24 -left-24 w-72 h-72 bg-white/5 rounded-full" />
        <div className="absolute -top-16 -right-16 w-56 h-56 bg-white/5 rounded-full" />
        <div className="absolute bottom-1/3 right-0 w-32 h-32 bg-bunyan-500/20 rounded-full blur-2xl" />

        <div className="relative z-10 flex flex-col items-center text-center max-w-sm">
          <div className="mb-8 drop-shadow-2xl">
            {/* الشعار الجديد (حجم xl - إضاءة فاتحة) للاستخدام المستقل */}
            <Logo providerName="bunyan" size="xl" variant="light" className="drop-shadow-lg brightness-0 invert" />
          </div>
          <h1 className="text-4xl font-black leading-tight mb-4">
            سيطر على متجرك<br />بذكاء وثقة
          </h1>
          <p className="text-white/70 text-lg leading-relaxed max-w-xs">
            نظام إدارة الأعمال الليبي — مبيعات، مخزون، توصيل، وشركاء في مكان واحد
          </p>

          {/* Feature badges */}
          <div className="flex flex-wrap justify-center gap-2 mt-8">
            {['مبيعات', 'مخزون', 'توصيل', 'تحليلات', 'شركاء'].map(f => (
              <span key={f} className="px-3 py-1 bg-white/10 border border-white/20
                rounded-full text-sm font-medium text-white/80">
                {f}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* ══ النصف الأيمن — نموذج الدخول ══ */}
      <div className="flex flex-col items-center justify-center flex-1
        p-8 lg:p-12 bg-white min-h-screen">
        <div className="w-full max-w-sm">

          {/* Mobile logo */}
          <div className="flex justify-center mb-8 lg:hidden">
            <Logo providerName="bunyan" size="xl" variant="dark" />
          </div>

          <div className="mb-8">
            <h2 className="text-2xl font-black text-gray-900 mb-1">أهلاً بعودتك</h2>
            <p className="text-gray-500 text-sm">أدخل بياناتك للدخول لحسابك</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            {/* البريد / الهاتف */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                البريد الإلكتروني أو رقم الهاتف
              </label>
              <input
                type="text"
                value={identifier}
                onChange={e => { setIdentifier(e.target.value); setError(''); }}
                placeholder="example@email.com"
                autoComplete="email"
                className="w-full px-4 py-3 border border-gray-200 rounded-xl text-right
                  focus:outline-none focus:ring-2 focus:ring-bunyan-500/30
                  focus:border-bunyan-400 bg-white text-sm transition-all"
              />
            </div>

            {/* كلمة المرور */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                كلمة المرور
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => { setPassword(e.target.value); setError(''); }}
                  onKeyDown={e => e.key === 'Enter' && handleLogin(e as any)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-right
                    focus:outline-none focus:ring-2 focus:ring-bunyan-500/30
                    focus:border-bunyan-400 bg-white text-sm pl-10 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400
                    hover:text-gray-600 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl
                text-sm text-red-700 text-right">
                {error}
              </div>
            )}

            {/* زر الدخول */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3.5 bg-bunyan-600 hover:bg-bunyan-700 text-white
                rounded-xl font-bold text-base transition-all flex items-center
                justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed
                shadow-sm hover:shadow-bunyan-500/20 hover:shadow-md"
            >
              {isLoading
                ? <Loader2 className="w-5 h-5 animate-spin" />
                : <LogIn className="w-5 h-5" />}
              {isLoading ? 'جار التحقق...' : 'دخول'}
            </button>
          </form>

          {/* تسجيل متجر جديد */}
          <div className="mt-6 pt-5 border-t border-gray-100 text-center">
            <p className="text-sm text-gray-500 mb-3">ليس لديك حساب؟</p>
            <Link
              href="/register"
              className="inline-flex items-center gap-2 px-5 py-2.5
                bg-gray-50 hover:bg-gray-100 border border-gray-200
                rounded-xl text-sm font-semibold text-gray-700 transition-all"
            >
              <UserPlus className="w-4 h-4" />
              تسجيل متجر جديد
            </Link>
          </div>

          {/* بيانات تجريبية */}
          <div className="mt-6 bg-bunyan-50 border border-bunyan-100 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <ShieldCheck className="w-4 h-4 text-bunyan-600 shrink-0" />
              <p className="text-xs font-bold text-bunyan-700">بيانات الدخول التجريبية</p>
            </div>
            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between items-center bg-white px-2.5 py-1.5 rounded-lg border border-bunyan-100">
                <span className="text-gray-500">سوبر أدمن</span>
                <code className="text-bunyan-700 font-mono text-[10px]">super@bunyan.ly / [كلمة المرور الحقيقية]</code>
              </div>
              <div className="flex justify-between items-center bg-white px-2.5 py-1.5 rounded-lg border border-bunyan-100">
                <span className="text-gray-500">مالك متجر</span>
                <code className="text-bunyan-700 font-mono text-[10px]">ahmed@alamin.ly / Admin@123</code>
              </div>
              <div className="flex justify-between items-center bg-white px-2.5 py-1.5 rounded-lg border border-bunyan-100">
                <span className="text-gray-500">موظف</span>
                <code className="text-bunyan-700 font-mono text-[10px]">mohammed@alamin.ly / Emp@123</code>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
