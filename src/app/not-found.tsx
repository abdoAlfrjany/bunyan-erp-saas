// src/app/not-found.tsx
// الوظيفة: صفحة 404 — عذراً، الصفحة غير موجودة
// التصميم: خلفية #1a2744 + رسالة عربية واضحة

import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #0a1628 0%, #1a2744 100%)' }}>
      <div className="text-center animate-fade-in">
        <div className="inline-flex items-center justify-center w-24 h-24 bg-white/10 rounded-3xl mb-6">
          <span className="text-5xl">🔍</span>
        </div>
        <h1 className="text-6xl font-black text-white mb-4">404</h1>
        <p className="text-xl font-bold text-white/80 mb-2">عذراً، الصفحة غير موجودة</p>
        <p className="text-sm text-white/40 mb-8">الصفحة التي تبحث عنها قد تكون حُذفت أو أن الرابط خاطئ</p>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 px-8 py-3.5 bg-gradient-to-l from-[#0e5c3a] to-[#0e4c6e] text-white font-bold rounded-xl hover:opacity-90 transition-all shadow-lg shadow-[#0e5c3a]/25"
        >
          العودة للرئيسية ←
        </Link>
      </div>
    </div>
  );
}
