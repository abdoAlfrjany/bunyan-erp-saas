// src/shared/components/ui/StatCard.tsx
// الوظيفة: بطاقة إحصاء فاخرة موحدة — تُستخدم في Dashboard, Treasury, Partners, HR
// المرجع: _DOCS/3_UI_UX_GUIDELINES.md

'use client';

import { formatCurrency } from '@/shared/utils/format';
import { TrendingUp, TrendingDown, type LucideIcon } from 'lucide-react';

interface StatCardProps {
  label: string;
  value: number;
  icon: LucideIcon;
  color: string;
  isCurrency?: boolean;
  trend?: 'up' | 'down';
  trendValue?: string;
  trendLabel?: string;
  onClick?: () => void;
}

export function StatCard({
  label,
  value,
  icon: Icon,
  color,
  isCurrency = true,
  trend,
  trendValue,
  trendLabel = 'عن الشهر الماضي',
  onClick,
}: StatCardProps) {
  return (
    <div
      className={`bg-white rounded-2xl border border-gray-100 shadow-sm p-6
        hover:shadow-md transition-all duration-200 ${onClick ? 'cursor-pointer' : ''}`}
      onClick={onClick}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-500">{label}</p>
          <p className="text-3xl font-black text-gray-900 mt-1 tracking-tight">
            {isCurrency ? formatCurrency(value) : value.toLocaleString('ar-LY')}
          </p>
          {trend && trendValue && (
            <div className="flex items-center gap-1 mt-2">
              {trend === 'up'
                ? <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
                : <TrendingDown className="w-3.5 h-3.5 text-red-500" />
              }
              <span className={`text-xs font-medium ${
                trend === 'up' ? 'text-emerald-600' : 'text-red-600'
              }`}>
                {trendValue}
              </span>
              <span className="text-xs text-gray-400">{trendLabel}</span>
            </div>
          )}
        </div>
        <div className={`w-12 h-12 rounded-xl bg-${color}-50 flex items-center justify-center flex-shrink-0`}>
          <Icon className={`w-6 h-6 text-${color}-600`} />
        </div>
      </div>
    </div>
  );
}
