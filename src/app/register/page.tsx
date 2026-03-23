// src/app/register/page.tsx
// الوظيفة: صفحة تسجيل متجر جديد — يُنشئ tenant فعلي + حساب Supabase Auth حقيقي
// المرجع: 1_SYSTEM_RULES.md — Full Supabase Auth Integration

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/core/auth/store';
import { Eye, EyeOff, UserPlus, Loader2, ArrowRight, Store } from 'lucide-react';
import { Logo } from '@/shared/components/ui/Logo';

export default function RegisterPage() {
  const router = useRouter();
  const { setUser } = useAuthStore();

  const [formData, setFormData] = useState({
    storeName: '', ownerName: '', email: '', phone: '', city: '',
    password: '', confirmPassword: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const updateField = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!formData.storeName || !formData.ownerName || !formData.email || !formData.password) {
      setError('يرجى ملء جميع الحقول المطلوبة');
      return;
    }
    if (formData.password.length < 6) {
      setError('كلمة المرور يجب أن تكون 6 أحرف على الأقل');
      return;
    }
    if (formData.password !== formData.confirmPassword) {
      setError('كلمة المرور وتأكيدها غير متطابقتين');
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: formData.email.toLowerCase().trim(),
          password: formData.password,
          storeName: formData.storeName,
          ownerName: formData.ownerName,
          phone: formData.phone || null,
          city: formData.city || 'طرابلس',
        }),
      });

      const result = await res.json();

      if (!res.ok || !result.success) {
        setError(result.error || 'فشل إنشاء الحساب — حاول مرة أخرى');
        setIsLoading(false);
        return;
      }

      const { createClient } = await import('@/core/db/supabase');
      const supabase = createClient();

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: formData.email.toLowerCase().trim(),
        password: formData.password,
      });

      if (signInError) {
        setError('تم إنشاء الحساب! يرجى تسجيل الدخول.');
        router.push('/login');
        return;
      }

      setUser({
        id: result.userId,
        tenantId: result.tenantId,
        fullName: formData.ownerName,
        phone: formData.phone || null,
        role: 'owner',
        isActive: true,
        email: formData.email,
        tenantName: formData.storeName,
        permissions: result.ownerPermissions,
      });

      router.push('/dashboard');
    } catch (err: any) {
      setError(err?.message || 'حدث خطأ أثناء التسجيل — حاول مرة أخرى');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'linear-gradient(135deg, #1a0830 0%, #2d184a 100%)' }}>
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 -right-20 w-72 h-72 bg-bunyan-600/15 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 -left-20 w-96 h-96 bg-bunyan-500/15 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-lg animate-fade-in">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-20 h-20 mb-3">
            <Logo providerName="bunyan" size="lg" variant="light" className="drop-shadow-lg" />
          </div>
          <h1 className="text-2xl font-black text-white">إنشاء متجر جديد</h1>
          <p className="text-sm text-white/50 mt-1">سجّل متجرك وابدأ إدارة أعمالك</p>
        </div>

        <div className="bg-white/10 backdrop-blur-xl rounded-2xl p-8 border border-white/20 shadow-2xl">
          <form onSubmit={handleRegister} className="space-y-4">
            {error && (
              <div className="bg-red-500/20 border border-red-400/30 text-red-200 px-4 py-3 rounded-xl text-sm text-center animate-fade-in">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-semibold text-white/80 mb-1.5">
                <Store size={14} className="inline ml-1" />اسم المتجر *
              </label>
              <input type="text" value={formData.storeName} onChange={(e) => updateField('storeName', e.target.value)}
                placeholder="مثال: متجر النجاح"
                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-bunyan-500 transition-all text-sm"
                required />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-white/80 mb-1.5">اسم المالك *</label>
                <input type="text" value={formData.ownerName} onChange={(e) => updateField('ownerName', e.target.value)}
                  placeholder="الاسم الكامل"
                  className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-bunyan-500 transition-all text-sm"
                  required />
              </div>
              <div>
                <label className="block text-sm font-semibold text-white/80 mb-1.5">المدينة</label>
                <input type="text" value={formData.city} onChange={(e) => updateField('city', e.target.value)}
                  placeholder="طرابلس"
                  className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-bunyan-500 transition-all text-sm" />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-white/80 mb-1.5">البريد الإلكتروني *</label>
                <input type="email" value={formData.email} onChange={(e) => updateField('email', e.target.value)}
                  placeholder="example@email.com" dir="ltr"
                  className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-bunyan-500 transition-all text-sm"
                  required />
              </div>
              <div>
                <label className="block text-sm font-semibold text-white/80 mb-1.5">رقم الهاتف</label>
                <input type="tel" value={formData.phone} onChange={(e) => updateField('phone', e.target.value)}
                  placeholder="09XXXXXXXX" dir="ltr"
                  className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-bunyan-500 transition-all text-sm" />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-white/80 mb-1.5">كلمة المرور *</label>
                <div className="relative">
                  <input type={showPassword ? 'text' : 'password'} value={formData.password}
                    onChange={(e) => updateField('password', e.target.value)}
                    placeholder="6 أحرف على الأقل" dir="ltr" minLength={6}
                    className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-bunyan-500 transition-all text-sm pl-10"
                    required />
                  <button type="button" onClick={() => setShowPassword(!showPassword)}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/80">
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-white/80 mb-1.5">تأكيد كلمة المرور *</label>
                <input type="password" value={formData.confirmPassword}
                  onChange={(e) => updateField('confirmPassword', e.target.value)}
                  placeholder="أعد كتابة كلمة المرور" dir="ltr" minLength={6}
                  className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-bunyan-500 transition-all text-sm"
                  required />
              </div>
            </div>

            <button type="submit" disabled={isLoading}
              className="w-full py-3.5 bg-gradient-to-l from-bunyan-600 to-bunyan-800 text-white font-bold rounded-xl hover:opacity-90 transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-bunyan-600/25 text-sm mt-2">
              {isLoading ? <Loader2 size={20} className="animate-spin" /> : <><UserPlus size={18} /> إنشاء المتجر</>}
            </button>
          </form>

          <div className="mt-5 pt-4 border-t border-white/10 text-center">
            <Link href="/login" className="inline-flex items-center gap-2 text-sm text-white/60 hover:text-white transition-colors">
              <ArrowRight size={14} /> لديك حساب؟ سجّل دخولك
            </Link>
          </div>
        </div>

        <p className="text-center text-[10px] text-white/25 mt-5">Bunyan ERP — الإصدار 1.0</p>
      </div>
    </div>
  );
}
