// src/shared/utils/statusColors.ts
// الوظيفة: نظام ألوان الحالات الموحد — لا ألوان inline في أي صفحة
// كل حالة في النظام (طلبية/مخزون/دين/شحنة) لها لون واحد ثابت هنا

// ═══ حالات الطلبيات ═══
export const ORDER_STATUS = {
  pending:          { label: 'جديدة',              bg: 'bg-amber-50',   text: 'text-amber-800',   border: 'border-amber-200', dot: 'bg-amber-500' },
  processing:       { label: 'قيد التجهيز',        bg: 'bg-indigo-50',  text: 'text-indigo-800',  border: 'border-indigo-200', dot: 'bg-indigo-500' },
  with_partner:     { label: 'مع المندوب',         bg: 'bg-violet-50',  text: 'text-violet-800',  border: 'border-violet-200', dot: 'bg-violet-500' },
  with_courier:     { label: 'مع شركة التوصيل',   bg: 'bg-cyan-50',    text: 'text-cyan-800',    border: 'border-cyan-200',  dot: 'bg-cyan-500' },
  delivered:        { label: 'تم التوصيل ✓',      bg: 'bg-emerald-50', text: 'text-emerald-800', border: 'border-emerald-200', dot: 'bg-emerald-500' },
  cancelled:        { label: 'ملغاة',              bg: 'bg-red-50',     text: 'text-red-800',     border: 'border-red-200',   dot: 'bg-red-500' },
  pending_return:   { label: '⚠️ معلق للإرجاع',   bg: 'bg-yellow-50',  text: 'text-yellow-800',  border: 'border-yellow-300', dot: 'bg-yellow-500' },
  return_confirmed: { label: 'مُرجَع',            bg: 'bg-gray-50',    text: 'text-gray-700',    border: 'border-gray-200',  dot: 'bg-gray-500' },
  pickup:           { label: 'استلام من المحل',    bg: 'bg-purple-50',  text: 'text-purple-800',  border: 'border-purple-200', dot: 'bg-purple-500' },
} as const;

// ═══ حالات المخزون ═══
export const STOCK_STATUS = {
  available:  { label: 'متاح',   bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  low:        { label: 'ينفد ⚠️', bg: 'bg-amber-50',   text: 'text-amber-700',   border: 'border-amber-200' },
  out:        { label: 'نفد',    bg: 'bg-red-50',     text: 'text-red-700',     border: 'border-red-200' },
} as const;

export const getStockStatus = (quantity: number, minQuantity: number = 5) => {
  if (quantity === 0) return STOCK_STATUS.out;
  if (quantity <= minQuantity) return STOCK_STATUS.low;
  return STOCK_STATUS.available;
};

// ═══ حالات الديون ═══
export const DEBT_STATUS = {
  active:  { label: 'نشط',   bg: 'bg-red-50',     text: 'text-red-700',     border: 'border-red-200' },
  partial: { label: 'جزئي',  bg: 'bg-amber-50',   text: 'text-amber-700',   border: 'border-amber-200' },
  paid:    { label: 'مكتمل', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
} as const;

// ═══ حالات الشحنات ═══
export const SHIPMENT_STATUS = {
  created:             { label: 'جديدة',            bg: 'bg-gray-50',    text: 'text-gray-700',    border: 'border-gray-200' },
  handed_to_courier:   { label: 'مع الشركة',       bg: 'bg-blue-50',    text: 'text-blue-700',    border: 'border-blue-200' },
  in_transit:          { label: 'في الطريق',       bg: 'bg-indigo-50',  text: 'text-indigo-700',  border: 'border-indigo-200' },
  out_for_delivery:    { label: 'خرجت للتوصيل',   bg: 'bg-cyan-50',    text: 'text-cyan-700',    border: 'border-cyan-200' },
  delivered:           { label: 'تم التسليم ✓',   bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  attempted:           { label: 'محاولة فاشلة',    bg: 'bg-orange-50',  text: 'text-orange-700',  border: 'border-orange-200' },
  on_hold:             { label: 'موقوفة',          bg: 'bg-yellow-50',  text: 'text-yellow-700',  border: 'border-yellow-200' },
  cancelled:           { label: 'ملغاة',           bg: 'bg-red-50',     text: 'text-red-700',     border: 'border-red-200' },
  pending_return:      { label: '⚠️ معلق للإرجاع', bg: 'bg-yellow-50',  text: 'text-yellow-800',  border: 'border-yellow-300' },
  returned_to_sender:  { label: 'مرتجع',           bg: 'bg-gray-100',   text: 'text-gray-800',    border: 'border-gray-300' },
} as const;

// ═══ حالات الاشتراكات ═══
export const SUBSCRIPTION_STATUS = {
  pending:   { label: 'قيد الانتظار', bg: 'bg-amber-50',   text: 'text-amber-700' },
  paid:      { label: 'مدفوع',       bg: 'bg-emerald-50', text: 'text-emerald-700' },
  overdue:   { label: 'متأخر',       bg: 'bg-red-50',     text: 'text-red-700' },
  cancelled: { label: 'ملغى',        bg: 'bg-gray-50',    text: 'text-gray-700' },
} as const;

// ═══ أنواع حركات الخزينة ═══
export const TRANSACTION_TYPE = {
  income:             { label: 'إيراد / إيداع',  color: 'text-emerald-600', icon: '💰' },
  partner_withdrawal: { label: 'سحب شريك',  color: 'text-red-600',     icon: '📤' },
  sale:               { label: 'مبيعات',  color: 'text-emerald-600', icon: '🛒' },
  courier_settlement: { label: 'تسوية شركة',   color: 'text-emerald-600', icon: '🚚' },
  expense:            { label: 'مصروفات',       color: 'text-red-600',     icon: '📋' },
  profit_distribution_record: { label: 'توزيع أرباح', color: 'text-purple-600', icon: '📊' },
} as const;

// ═══ Badge Component Helper ═══
export const getStatusBadgeClasses = (status: { bg: string; text: string; border?: string }) => {
  return `${status.bg} ${status.text} ${status.border ? `border ${status.border}` : ''} px-2.5 py-0.5 rounded-full text-xs font-semibold inline-flex items-center gap-1`;
};
