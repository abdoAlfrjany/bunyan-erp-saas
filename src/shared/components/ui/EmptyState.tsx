// src/shared/components/ui/EmptyState.tsx
// الوظيفة: Empty State — أيقونة + نص عربي + زر إضافة (اختياري)
// المرجع: _DOCS/3_UI_UX_GUIDELINES.md

import { Plus } from 'lucide-react';

interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  moduleColor?: string;
}

export function EmptyState({ icon, title, description, actionLabel, onAction, moduleColor = '#4a5a7a' }: EmptyStateProps) {
  return (
    <div className="text-center py-16">
      <div className="inline-flex items-center justify-center w-16 h-16 bg-[#f0f2f7] rounded-2xl mb-4">
        {icon}
      </div>
      <p className="text-sm font-semibold text-[#4a5a7a]">{title}</p>
      {description && <p className="text-xs text-[#8a9ab8] mt-1">{description}</p>}
      {actionLabel && onAction && (
        <button onClick={onAction}
          className="mt-4 inline-flex items-center gap-2 px-4 py-2.5 text-white rounded-xl text-sm font-bold hover:opacity-90 transition-all"
          style={{ backgroundColor: moduleColor }}>
          <Plus size={14} /> {actionLabel}
        </button>
      )}
    </div>
  );
}
