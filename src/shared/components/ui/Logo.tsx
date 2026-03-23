// src/shared/components/ui/Logo.tsx
// الوظيفة: مكون شعار ديناميكي للـ (Bunyan) أو (VanEx) أو أي أدابتر لشركة التوصيل مستقبلاً
// المسار: يقرأ ديناميكياً من المجلد العام `/logos/companyName.png`
// الميزة الأساسية: ذكي للـ Next.js Image Optimization + Fallback text (أمان ضد خطأ التحميل).

'use client';

import { useState } from 'react';
import Image from 'next/image';
import { cn } from '@/shared/utils/cn';

interface LogoProps {
  providerName: string; // مثال: 'bunyan' أو 'vanex' أو غيره...
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  variant?: 'light' | 'dark'; // خفيف: نص أبيض | داكن: نص موف (يظهر فقط في حالة الـ Fallback إذا أردنا عرض نص)
  onDarkBg?: boolean; // يعكس ألوان الشعار ليصبح أبيض ناصع (اختياري)
}

export function Logo({ providerName, size = 'md', className, variant = 'light', onDarkBg = false }: LogoProps) {
  // حالة مراقبة خطأ الصورة — إذا سقطت تتحول لـ Fallback
  const [errorStatus, setErrorStatus] = useState(false);

  // إدارة أبعاد الصور (تكبير الأحجام بوضوح مع إطار وهمي ثابت)
  const SIZES = {
    sm: { width: 96, height: 48, wrapperClass: 'w-24 h-12', textClass: 'text-xl font-bold' },
    md: { width: 128, height: 64, wrapperClass: 'w-32 h-16', textClass: 'text-2xl font-black' },
    lg: { width: 160, height: 80, wrapperClass: 'w-40 h-20', textClass: 'text-3xl font-black' },
    xl: { width: 192, height: 96, wrapperClass: 'w-48 h-24', textClass: 'text-4xl font-black' },
  };

  const currentSize = SIZES[size];

  // ألوان الـ Fallback State
  const fallbackTextClass = variant === 'light' 
    ? 'text-white' 
    : 'text-bunyan-700';

  const formatName = typeof providerName === 'string' ? providerName.toLowerCase().trim() : 'logo';

  return (
    <div
      className={cn(
        'relative flex items-center justify-center shrink-0 bg-transparent',
        currentSize.wrapperClass,
        className
      )}
    >
      {/* إذا واجهنا Error: نعرض Fallback Text بديل الصورة الحقيقية */}
      {errorStatus ? (
        <span className={cn('uppercase leading-none', fallbackTextClass, currentSize.textClass)}>
          {/* حرف أول من المزود */}
          {formatName.charAt(0) || '?'}
        </span>
      ) : (
        /* Image: يحمل الداتا المحدثة من مجلد public/logos/ */
        <Image
          src={`/logos/${formatName}.png`}
          alt={`${formatName} Logo`}
          width={currentSize.width}
          height={currentSize.height}
          quality={100}
          priority={true} // شعار التنقل دائماً فوق الطية — أولوية عالية لـ LCP
          className={cn(
            'object-contain w-full h-full',
            onDarkBg && 'brightness-0 invert'
          )}
          onError={() => setErrorStatus(true)} // تقع في خطأ (fallback) عندما لم تجد ملف
        />
      )}
    </div>
  );
}
