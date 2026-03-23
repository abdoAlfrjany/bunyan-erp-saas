// src/shared/components/ui/Toggle.tsx
// الوظيفة: مفتاح تبديل (Toggle Switch) — بديل Checkbox مع دعم RTL
// المرجع: _DOCS/3_UI_UX_GUIDELINES.md

'use client';

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
}

export function Toggle({ checked, onChange, label, description, disabled = false }: ToggleProps) {
  return (
    <label className={`flex items-start justify-between gap-4 cursor-pointer group
      ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}>
      <div className="flex-1">
        <p className="text-sm font-medium text-gray-900 group-hover:text-gray-700">{label}</p>
        {description && <p className="text-xs text-gray-500 mt-0.5">{description}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => !disabled && onChange(!checked)}
        className={`relative flex-shrink-0 w-11 h-6 rounded-full transition-colors duration-200
          focus:outline-none focus:ring-2 focus:ring-bunyan-500 focus:ring-offset-2
          ${checked ? 'bg-bunyan-600' : 'bg-gray-200'}
          ${disabled ? 'cursor-not-allowed' : ''}`}
      >
        <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-sm
          transition-transform duration-200
          ${checked ? 'translate-x-0.5 rtl:-translate-x-5' : 'translate-x-5 rtl:-translate-x-0.5'}`}
        />
      </button>
    </label>
  );
}
