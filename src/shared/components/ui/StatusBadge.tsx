// src/shared/components/ui/StatusBadge.tsx
// الوظيفة: شارة حالة موحدة مع نقطة ملونة — تدعم الأنواع العامة + الحالات المحددة
// المرجع: _DOCS/3_UI_UX_GUIDELINES.md

'use client';

import { cn } from '@/shared/utils/cn';

// ═══ Variant-based Badge (للاستخدام العام) ═══
export type BadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'purple';

const BADGE_CLASSES: Record<BadgeVariant, string> = {
  success: 'text-emerald-700 bg-emerald-50 border-emerald-200',
  warning: 'text-amber-700 bg-amber-50 border-amber-200',
  danger: 'text-red-700 bg-red-50 border-red-200',
  info: 'text-blue-700 bg-blue-50 border-blue-200',
  neutral: 'text-gray-700 bg-gray-50 border-gray-200',
  purple: 'text-purple-700 bg-purple-50 border-purple-200',
};

const DOT_CLASSES: Record<BadgeVariant, string> = {
  success: 'bg-emerald-500',
  warning: 'bg-amber-500',
  danger: 'bg-red-500',
  info: 'bg-blue-500',
  neutral: 'bg-gray-400',
  purple: 'bg-purple-500',
};

// ═══ Status-based Badge (بحالات محددة من النظام) ═══
type StatusType =
  | 'pending'
  | 'processing'
  | 'ready_to_ship'
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

const STATUS_VARIANT_MAP: Record<StatusType, BadgeVariant> = {
  pending: 'warning',
  processing: 'info',
  ready_to_ship: 'purple',
  with_partner: 'purple',
  with_courier: 'info',
  delivered: 'success',
  cancelled: 'danger',
  pending_return: 'warning',
  return_confirmed: 'neutral',
  active: 'success',
  inactive: 'neutral',
  paid: 'success',
  overdue: 'danger',
  partial: 'warning',
};

const STATUS_LABELS: Record<StatusType, string> = {
  pending: 'جديدة',
  processing: 'قيد التجهيز',
  ready_to_ship: 'جاهز للشحن',
  with_partner: 'مع المندوب',
  with_courier: 'مع شركة التوصيل',
  delivered: 'تم التوصيل',
  cancelled: 'ملغاة',
  pending_return: 'معلق للإرجاع',
  return_confirmed: 'مُرجَع',
  active: 'نشط',
  inactive: 'متوقف',
  paid: 'مدفوع',
  overdue: 'متأخر',
  partial: 'جزئي',
};

// ═══ واجهة مرنة — تدعم variant أو status ═══
type StatusBadgeProps =
  | {
      /** استخدم variant للتلوين العام */
      variant: BadgeVariant;
      label: string;
      dot?: boolean;
      status?: never;
      className?: string;
    }
  | {
      /** استخدم status للحالة من النظام (يُحدد اللون والعنوان تلقائياً) */
      status: StatusType;
      label?: string;
      dot?: boolean;
      variant?: never;
      className?: string;
    };

export function StatusBadge(props: StatusBadgeProps) {
  const { label, dot = true, className } = props;

  const resolvedVariant: BadgeVariant = props.variant
    ? props.variant
    : STATUS_VARIANT_MAP[props.status] || 'neutral';

  const resolvedLabel = label
    ? label
    : props.status
      ? STATUS_LABELS[props.status] || props.status
      : '';

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border',
        BADGE_CLASSES[resolvedVariant],
        className
      )}
    >
      {dot && (
        <span className={cn('w-1.5 h-1.5 rounded-full', DOT_CLASSES[resolvedVariant])} />
      )}
      {resolvedLabel}
    </span>
  );
}
