// src/shared/components/layout/SuperAdminBanner.tsx
// الوظيفة: شريط تنبيه يظهر عندما يتصفح السوبر أدمن متجراً معيناً
// يعرض: "أنت تتصفح متجر [اسم] كسوبر أدمن" + زر العودة

'use client';

import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/core/auth/store';
import { Shield, ArrowRight } from 'lucide-react';

export function SuperAdminBanner() {
  const { isBrowsingAsTenant, browsingTenantName, exitTenantBrowsing } = useAuthStore();
  const router = useRouter();

  if (!isBrowsingAsTenant) return null;

  const handleExit = () => {
    exitTenantBrowsing();
    router.push('/super-admin');
  };

  return (
    <div className="bg-gradient-to-l from-amber-500 to-amber-600 text-white px-4 py-2 flex items-center justify-between z-[9999] sticky top-0">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <Shield size={16} />
        <span>أنت تتصفح <strong>{browsingTenantName}</strong> كسوبر أدمن</span>
      </div>
      <button
        onClick={handleExit}
        className="flex items-center gap-1.5 px-3 py-1 bg-white/20 hover:bg-white/30 rounded-lg text-xs font-bold transition-colors"
      >
        <ArrowRight size={14} />
        العودة للوحة التحكم
      </button>
    </div>
  );
}
