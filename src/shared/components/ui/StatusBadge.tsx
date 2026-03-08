// src/shared/components/ui/StatusBadge.tsx
// الوظيفة: شارة الحالة العامة — ألوان حسب الحالة
// المرجع: _DOCS/3_UI_UX_GUIDELINES.md — شارة الحالة العامة

'use client';

import { cn } from '@/shared/utils/cn';

type StatusType =
  | 'pending'
  | 'with_partner'
  | 'with_courier'
  | 'delivered'
  | 'cancelled'
  | 'pending_return'
  | 'return_confirmed'
  | 'active'
  | 'inactive'
  | 'paid'
  | 'overdue'
  | 'partial';

const STATUS_CONFIG: Record<StatusType, { bg: string; text: string; label: string }> = {
  pending:          { bg: 'bg-[#fff7ed]', text: 'text-[#7c2d12]', label: 'جديدة' },
  with_partner:     { bg: 'bg-[#ede9fe]', text: 'text-[#4c1d95]', label: 'مع المندوب' },
  with_courier:     { bg: 'bg-[#e0f2fe]', text: 'text-[#075985]', label: 'مع شركة التوصيل' },
  delivered:        { bg: 'bg-[#dcfce7]', text: 'text-[#14532d]', label: 'تم التوصيل ✓' },
  cancelled:        { bg: 'bg-[#fee2e2]', text: 'text-[#991b1b]', label: 'ملغاة' },
  pending_return:   { bg: 'bg-[#fef9c3]', text: 'text-[#854d0e]', label: '⚠️ معلق للإرجاع' },
  return_confirmed: { bg: 'bg-[#f3f4f6]', text: 'text-[#1f2937]', label: 'مُرجَع' },
  active:           { bg: 'bg-[#dcfce7]', text: 'text-[#14532d]', label: 'نشط' },
  inactive:         { bg: 'bg-[#f3f4f6]', text: 'text-[#1f2937]', label: 'متوقف' },
  paid:             { bg: 'bg-[#dcfce7]', text: 'text-[#14532d]', label: 'مدفوع' },
  overdue:          { bg: 'bg-[#fee2e2]', text: 'text-[#991b1b]', label: 'متأخر' },
  partial:          { bg: 'bg-[#fef3c7]', text: 'text-[#92400e]', label: 'جزئي' },
};

interface StatusBadgeProps {
  status: StatusType;
  label?: string;
  className?: string;
}

export function StatusBadge({ status, label, className }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status];
  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium',
        config.bg,
        config.text,
        className
      )}
    >
      {label || config.label}
    </span>
  );
}
