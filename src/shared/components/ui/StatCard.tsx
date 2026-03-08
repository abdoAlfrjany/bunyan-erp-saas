// src/shared/components/ui/StatCard.tsx
// الوظيفة: بطاقة الإحصاء (Stat Card) — النبض المالي
// المرجع: _DOCS/3_UI_UX_GUIDELINES.md — بطاقة الإحصاء
// CSS: bg-white rounded-2xl p-6 border border-[#e2e6ed] shadow-sm

'use client';

import { cn } from '@/shared/utils/cn';
import { formatCurrency, formatPercentage } from '@/shared/utils/format';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: number;
  isCurrency?: boolean;
  icon: LucideIcon;
  iconColor?: string;
  change?: number;
  changeLabel?: string;
  progress?: number;
}

export function StatCard({
  title,
  value,
  isCurrency = true,
  icon: Icon,
  iconColor = '#0e4c6e',
  change,
  changeLabel = 'عن الأسبوع الماضي',
  progress,
}: StatCardProps) {
  const isPositive = change !== undefined && change >= 0;

  return (
    <div className="bg-white rounded-2xl p-6 border border-page-border shadow-card transition-all hover:shadow-md">
      <div className="flex items-center justify-between mb-4">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ backgroundColor: `${iconColor}15` }}
        >
          <Icon size={20} style={{ color: iconColor }} />
        </div>
        <span className="text-xs font-medium text-text-muted">{title}</span>
      </div>

      <div className="mb-2">
        <span className="text-2xl font-bold text-text-primary font-currency">
          {isCurrency ? formatCurrency(value) : value.toLocaleString()}
        </span>
      </div>

      {change !== undefined && (
        <div className="flex items-center gap-1 mb-3">
          <span
            className={cn(
              'text-xs font-medium',
              isPositive ? 'text-status-success-text' : 'text-status-danger-text'
            )}
          >
            {isPositive ? '↑' : '↓'} {formatPercentage(Math.abs(change))}
          </span>
          <span className="text-xs text-text-muted">{changeLabel}</span>
        </div>
      )}

      {progress !== undefined && (
        <div className="w-full h-1.5 bg-page-bg rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${Math.min(progress, 100)}%`,
              backgroundColor: iconColor,
            }}
          />
        </div>
      )}
    </div>
  );
}
