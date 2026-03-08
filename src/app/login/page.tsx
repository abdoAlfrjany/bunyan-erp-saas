// src/app/login/page.tsx
// الوظيفة: صفحة تسجيل الدخول — منظومة Bunyan ERP
// الهوية: بنفسجية + خط Cairo + لوقو Bunyan
// المنطق: super@bunyan.ly → /super-admin | users من SEED_USERS

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/core/auth/store';
import { useDataStore } from '@/core/db/store';
import { Eye, EyeOff, LogIn, Loader2, UserPlus } from 'lucide-react';
import { BunyanLogo } from '@/shared/components/ui/BunyanLogo';

const SUPER_ADMIN_EMAIL = 'super@bunyan.ly';
const SUPER_ADMIN_PASSWORD = 'SuperAdmin@2025';

export default function LoginPage() {
  const router = useRouter();
  const { setUser } = useAuthStore();
  const dataStore = useDataStore();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string; general?: string }>({});

  const validate = (): boolean => {
    const e: typeof errors = {};
    if (!email) e.email = 'البريد الإلكتروني مطلوب';
    else if (!email.includes('@')) e.email = 'بريد إلكتروني غير صالح';
    if (!password) e.password = 'كلمة المرور مطلوبة';
    else if (password.length < 6) e.password = 'كلمة المرور يجب أن تكون 6 أحرف على الأقل';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setIsLoading(true);
    setErrors({});

    try {
      await new Promise((resolve) => setTimeout(resolve, 600));

      // ═══ سوبر أدمن ═══
      if (email.toLowerCase() === SUPER_ADMIN_EMAIL) {
        if (password !== SUPER_ADMIN_PASSWORD) {
          setErrors({ password: 'كلمة المرور غير صحيحة' });
          return;
        }
        const superUser = {
          id: 'sa-001', tenantId: '', fullName: 'مدير Bunyan',
          phone: null, role: 'super_admin' as const, isActive: true,
          email, tenantName: 'Bunyan Admin',
        };
        localStorage.setItem('erp_user', JSON.stringify(superUser));
        setUser(superUser);
        router.push('/super-admin');
        return;
      }

      // ═══ مستخدمو المتاجر (TenantUser) ═══
      const tenantUser = dataStore.getUserByEmail(email.toLowerCase());
      if (tenantUser) {
        // تحقق من كلمة المرور
        if (tenantUser.passwordHash !== btoa(password)) {
          setErrors({ general: 'البريد الإلكتروني أو كلمة المرور غير صحيحة' });
          return;
        }
        if (!tenantUser.isActive) {
          setErrors({ general: 'هذا الحساب غير نشط — تواصل مع صاحب المتجر' });
          return;
        }
        // تحقق من حالة المتجر
        const tenant = dataStore.tenants.find(t => t.id === tenantUser.tenantId);
        if (tenant && !tenant.isActive) {
          setErrors({ general: 'هذا المتجر موقوف مؤقتاً — تواصل مع فريق Bunyan' });
          return;
        }

        const authUser = {
          id: tenantUser.id,
          tenantId: tenantUser.tenantId,
          fullName: tenantUser.fullName,
          phone: tenantUser.phone ?? null,
          role: tenantUser.role as 'owner' | 'partner' | 'employee',
          isActive: tenantUser.isActive,
          email: tenantUser.email,
          tenantName: tenant?.name,
          permissions: tenantUser.permissions,
        };
        localStorage.setItem('erp_user', JSON.stringify(authUser));
        setUser(authUser);

        // توجيه حسب الدور
        if (tenantUser.role === 'owner') router.push('/dashboard');
        else router.push('/orders');
        return;
      }

      setErrors({ general: 'البريد الإلكتروني أو كلمة المرور غير صحيحة' });
    } catch {
      setErrors({ general: 'تأكد من اتصالك بالإنترنت وأعد المحاولة' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: 'linear-gradient(135deg, #1a0830 0%, #2a1045 50%, #3a1a5a 100%)' }}
    >
      {/* خلفية ديناميكية */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 -right-20 w-96 h-96 bg-bunyan-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 -left-20 w-80 h-80 bg-bunyan-700/20 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-bunyan-600/5 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-md animate-fade-in">
        {/* اللوقو */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <BunyanLogo size="lg" variant="light" />
          </div>
          <p className="text-sm text-white/40 mt-2">نظام إدارة الأعمال الليبي</p>
        </div>

        {/* البطاقة */}
        <div className="bg-white/8 backdrop-blur-xl rounded-2xl p-8 border border-white/15 shadow-2xl">
          <h2 className="text-xl font-bold text-white mb-6 text-center">تسجيل الدخول</h2>

          <form onSubmit={handleLogin} className="space-y-5">
            {errors.general && (
              <div className="bg-red-500/20 border border-red-400/30 text-red-200 px-4 py-3 rounded-xl text-sm text-center animate-fade-in">
                {errors.general}
              </div>
            )}

            {/* البريد الإلكتروني */}
            <div>
              <label className="block text-sm font-semibold text-white/70 mb-2">البريد الإلكتروني</label>
              <input
                type="email" value={email}
                onChange={(e) => { setEmail(e.target.value); setErrors({}); }}
                placeholder="example@email.com" dir="ltr"
                className={`w-full px-4 py-3.5 bg-white/10 border rounded-xl text-white placeholder-white/25 focus:outline-none focus:ring-2 focus:ring-bunyan-400 transition-all text-sm ${errors.email ? 'border-red-400' : 'border-white/15 focus:border-bunyan-400'}`}
              />
              {errors.email && <p className="text-xs text-red-300 mt-1">{errors.email}</p>}
            </div>

            {/* كلمة المرور */}
            <div>
              <label className="block text-sm font-semibold text-white/70 mb-2">كلمة المرور</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'} value={password}
                  onChange={(e) => { setPassword(e.target.value); setErrors({}); }}
                  placeholder="••••••••" dir="ltr"
                  className={`w-full px-4 py-3.5 bg-white/10 border rounded-xl text-white placeholder-white/25 focus:outline-none focus:ring-2 focus:ring-bunyan-400 transition-all text-sm pl-12 ${errors.password ? 'border-red-400' : 'border-white/15 focus:border-bunyan-400'}`}
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/70 transition-colors">
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {errors.password && <p className="text-xs text-red-300 mt-1">{errors.password}</p>}
            </div>

            {/* زر تسجيل الدخول */}
            <button type="submit" disabled={isLoading}
              className="w-full py-3.5 bg-gradient-to-r from-bunyan-500 to-bunyan-600 hover:from-bunyan-400 hover:to-bunyan-500 text-white font-bold rounded-xl transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed text-sm shadow-lg shadow-bunyan-900/40">
              {isLoading ? <Loader2 size={20} className="animate-spin" /> : <><LogIn size={18} /> تسجيل الدخول</>}
            </button>
          </form>

          {/* تسجيل متجر جديد */}
          <div className="mt-6 pt-5 border-t border-white/10 text-center">
            <p className="text-sm text-white/40 mb-3">ليس لديك حساب؟</p>
            <Link href="/register"
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-white/10 hover:bg-white/15 border border-white/15 rounded-xl text-white text-sm font-semibold transition-all">
              <UserPlus size={16} /> تسجيل متجر جديد
            </Link>
          </div>
        </div>

        {/* بيانات تسجيل الدخول التجريبية */}
        <div className="mt-5 bg-white/5 rounded-xl p-4 border border-white/10">
          <p className="text-xs text-white/40 text-center mb-2 font-semibold">بيانات تسجيل الدخول التجريبية</p>
          <div className="space-y-1 text-xs text-white/30 text-center">
            <p>سوبر أدمن: <span className="text-white/50 font-mono">super@bunyan.ly</span> | <span className="text-white/50 font-mono">SuperAdmin@2025</span></p>
            <p>مالك متجر: <span className="text-white/50 font-mono">ahmed@alamin.ly</span> | <span className="text-white/50 font-mono">Admin@123</span></p>
            <p>موظف: <span className="text-white/50 font-mono">mohammed@alamin.ly</span> | <span className="text-white/50 font-mono">Emp@123</span></p>
          </div>
        </div>
      </div>
    </div>
  );
}
