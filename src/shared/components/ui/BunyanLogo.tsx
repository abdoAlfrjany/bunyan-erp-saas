// src/shared/components/ui/BunyanLogo.tsx
// الوظيفة: مكون لوقو Bunyan — يُستخدم في Sidebar + Login + Super Admin
'use client';

interface BunyanLogoProps {
  size?: 'sm' | 'md' | 'lg';
  variant?: 'light' | 'dark';
  showText?: boolean;
}

export function BunyanLogo({ size = 'md', variant = 'light', showText = true }: BunyanLogoProps) {
  const sizes = {
    sm: { logo: 28, text: 'text-lg' },
    md: { logo: 36, text: 'text-xl' },
    lg: { logo: 52, text: 'text-3xl' },
  };

  const textColor = variant === 'light' ? 'text-white' : 'text-[#4a2570]';
  const subColor = variant === 'light' ? 'text-[#c9b8d9]' : 'text-[#6b4090]';

  return (
    <div className="flex items-center gap-3">
      {/* Logo Icon */}
      <div
        className="flex items-center justify-center rounded-xl bg-gradient-to-br from-[#6b4090] to-[#4a2570] shadow-lg"
        style={{ width: sizes[size].logo + 8, height: sizes[size].logo + 8 }}
      >
        <span className="text-white font-bold" style={{ fontSize: sizes[size].logo * 0.5 }}>B</span>
      </div>
      {showText && (
        <div>
          <h1 className={`${sizes[size].text} font-bold ${textColor} leading-tight`}>
            Bunyan
          </h1>
          {size !== 'sm' && (
            <p className={`text-xs ${subColor} -mt-0.5`}>نظام إدارة الأعمال</p>
          )}
        </div>
      )}
    </div>
  );
}
