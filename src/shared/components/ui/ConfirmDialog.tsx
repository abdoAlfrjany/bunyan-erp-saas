// src/shared/components/ui/ConfirmDialog.tsx
// الوظيفة: نافذة تأكيد الحذف — تعرض اسم العنصر المحذوف
// المرجع: 3_UI_UX_GUIDELINES.md — قاعدة 1: كل حذف → نافذة تأكيد

'use client';

import { AlertTriangle, Loader2 } from 'lucide-react';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  itemName?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'primary';
  onConfirm: () => void;
  isLoading?: boolean;
  onCancel: () => void;
  children?: React.ReactNode;
  confirmText?: string;
}

export function ConfirmDialog({
  isOpen, title, message, itemName, confirmLabel, confirmText, isLoading = false,
  cancelLabel = 'إلغاء', variant = 'danger', onConfirm, onCancel, children
}: ConfirmDialogProps) {
  if (!isOpen) return null;

  const btnColor = variant === 'danger'
    ? 'bg-red-600 hover:bg-red-700'
    : variant === 'warning' ? 'bg-amber-600 hover:bg-amber-700'
    : 'bg-bunyan-600 hover:bg-bunyan-700';

  return (
    <div className="fixed inset-0 z-[9998] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onCancel} />
      <div className="relative bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl animate-fade-in">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
            <AlertTriangle size={20} className="text-red-600" />
          </div>
          <h3 className="text-lg font-bold text-[#0a1628]">{title}</h3>
        </div>
        <p className="text-sm text-[#2d3f6b] mb-2">{message}</p>
        {itemName && (
          <p className="text-sm font-bold text-[#0a1628] bg-[#f0f2f7] rounded-lg px-3 py-2 mb-4">
            {itemName}
          </p>
        )}
        {children}
        <div className="flex gap-3 mt-5">
          <button onClick={onCancel} disabled={isLoading} className="flex-1 py-2.5 bg-[#f0f2f7] hover:bg-[#e2e6ed] text-[#2d3f6b] rounded-xl text-sm font-semibold transition-colors disabled:opacity-50">
            {cancelLabel}
          </button>
          <button onClick={onConfirm} disabled={isLoading} className={`flex-1 py-2.5 flex items-center justify-center gap-2 ${btnColor} text-white rounded-xl text-sm font-semibold transition-colors disabled:opacity-50 cursor-pointer`}>
            {isLoading && <Loader2 size={16} className="animate-spin" />}
            {confirmText || confirmLabel || 'تأكيد'}
          </button>
        </div>
      </div>
    </div>
  );
}
