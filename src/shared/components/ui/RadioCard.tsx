// src/shared/components/ui/RadioCard.tsx
// الوظيفة: بطاقة اختيار (بديل select/checkbox) — نوع الدين، طريقة الدفع، دور الموظف
// المرجع: _DOCS/3_UI_UX_GUIDELINES.md

'use client';

import { type LucideIcon } from 'lucide-react';

interface RadioCardProps {
  value: string;
  selected: string;
  onSelect: (value: string) => void;
  icon: LucideIcon;
  label: string;
  description?: string;
  color?: string;
}

export function RadioCard({
  value,
  selected,
  onSelect,
  icon: Icon,
  label,
  description,
  color = 'bunyan',
}: RadioCardProps) {
  const isSelected = selected === value;

  return (
    <button
      type="button"
      onClick={() => onSelect(value)}
      className={`w-full p-4 rounded-xl border-2 text-right transition-all duration-150
        ${isSelected
          ? `border-${color}-500 bg-${color}-50/50 shadow-sm`
          : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50/50'
        }`}
    >
      <div className="flex items-center gap-3">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0
          ${isSelected ? `bg-${color}-100` : 'bg-gray-100'}`}>
          <Icon className={`w-5 h-5 ${isSelected ? `text-${color}-600` : 'text-gray-500'}`} />
        </div>
        <div className="flex-1 text-right">
          <p className={`font-semibold text-sm ${isSelected ? 'text-gray-900' : 'text-gray-700'}`}>
            {label}
          </p>
          {description && (
            <p className="text-xs text-gray-500 mt-0.5">{description}</p>
          )}
        </div>
        <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0
          ${isSelected ? `border-${color}-500` : 'border-gray-300'}`}>
          {isSelected && <div className={`w-2 h-2 rounded-full bg-${color}-500`} />}
        </div>
      </div>
    </button>
  );
}
