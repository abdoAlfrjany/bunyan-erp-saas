// src/shared/components/ui/ModuleCard.tsx
// الوظيفة: بطاقة القسم (Module Card) — بطاقة ملونة لكل وحدة
// المرجع: _DOCS/3_UI_UX_GUIDELINES.md — بطاقة القسم

'use client';

import Link from 'next/link';
import { LucideIcon } from 'lucide-react';

interface ModuleCardProps {
  title: string;
  description: string;
  secondaryInfo?: string;
  icon: LucideIcon;
  color: string;
  href: string;
}

export function ModuleCard({
  title,
  description,
  secondaryInfo,
  icon: Icon,
  color,
  href,
}: ModuleCardProps) {
  return (
    <Link href={href}>
      <div
        className="rounded-2xl p-6 text-white cursor-pointer hover:opacity-90 transition-all duration-200 min-h-[140px] flex flex-col justify-between hover:scale-[1.02]"
        style={{ backgroundColor: color }}
      >
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-lg font-bold mb-1">{title}</h3>
            <p className="text-sm text-white/80">{description}</p>
          </div>
          <Icon size={32} className="text-white/60" />
        </div>
        {secondaryInfo && (
          <p className="text-xs text-white/60 mt-4 font-currency">{secondaryInfo}</p>
        )}
      </div>
    </Link>
  );
}
