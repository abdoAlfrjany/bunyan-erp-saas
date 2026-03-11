// src/shared/utils/format.ts
// الوظيفة: دوال التنسيق المركزية — العملة والتاريخ
// القاعدة: الأرقام المالية بدون كسور عشرية — XXX,XXX د.ل

/**
 * تنسيق المبالغ المالية — بدون كسور عشرية
 * 1500 → "1,500 د.ل"
 */
export const formatCurrency = (amount: number): string => {
  return `${Math.round(amount).toLocaleString('ar-LY')} د.ل`;
};

/**
 * تنسيق رقم عادي
 * 1500 → "1,500"
 */
export const formatNumber = (num: number): string => {
  return Math.round(num).toLocaleString('ar-LY');
};

/**
 * تنسيق نسبة مئوية
 * 8.2 → "8.2%"
 */
export const formatPercentage = (value: number): string => {
  return `${value.toFixed(1)}%`;
};

/**
 * تنسيق التاريخ بالعربية
 * "2025-01-05" → "5 يناير 2025"
 */
export const formatDate = (dateStr: string): string => {
  const date = new Date(dateStr);
  return date.toLocaleDateString('ar-LY', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
};

/**
 * تنسيق التاريخ المختصر
 * "2025-01-05" → "5 يناير"
 */
export const formatDateShort = (dateStr: string): string => {
  const date = new Date(dateStr);
  return date.toLocaleDateString('ar-LY', {
    month: 'short',
    day: 'numeric',
  });
};

/**
 * تنسيق التاريخ المجهري (يوم/شعر/سنة)
 * "2025-01-05" → "05/01/25"
 */
export const formatDateTiny = (dateStr: string): string => {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  });
};

/**
 * تنسيق الوقت النسبي
 * "قبل 5 دقائق" / "منذ ساعة"
 */
export const formatRelativeTime = (dateStr: string): string => {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'الآن';
  if (diffMins < 60) return `منذ ${diffMins} د`;
  if (diffHours < 24) return `منذ ${diffHours} س`;
  if (diffDays < 7) return `منذ ${diffDays} يوم`;
  return formatDateShort(dateStr);
};

/**
 * إنشاء تاريخ اليوم كـ ISO string
 */
export const todayISO = (): string => {
  return new Date().toISOString().split('T')[0];
};
