// src/shared/components/ui/Toast.tsx
// الوظيفة: نظام Toast مركزي — نجاح (يختفي بعد 3 ثوانٍ) + خطأ (يبقى)
// الموقع: أعلى اليسار (RTL)
// المرجع: _DOCS/3_UI_UX_GUIDELINES.md — Toast

'use client';

import { useState, useCallback, createContext, useContext } from 'react';
import { X, CheckCircle2, AlertCircle } from 'lucide-react';

interface ToastItem {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
}

interface ToastContextType {
  showToast: (message: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
}

const ToastContext = createContext<ToastContextType>({ showToast: () => {} });

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' | 'warning' = 'success') => {
    const id = `toast-${Date.now()}`;
    setToasts((prev) => [...prev, { id, message, type }]);
    if (type !== 'error') {
      setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3000);
    }
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed top-4 left-4 z-[9999] space-y-2 max-w-[360px]">
        {toasts.map((t) => (
          <div key={t.id} className={`flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-sm font-semibold animate-fade-in backdrop-blur-sm ${
            t.type === 'success' ? 'bg-[#dcfce7] text-[#14532d] border border-[#86efac]' :
            t.type === 'error' ? 'bg-[#fee2e2] text-[#991b1b] border border-[#fca5a5]' :
            t.type === 'warning' ? 'bg-[#fef3c7] text-[#92400e] border border-[#fde68a]' :
            'bg-[#dbeafe] text-[#1e3a8a] border border-[#93c5fd]'
          }`}>
            {t.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
            <span className="flex-1">{t.message}</span>
            <button onClick={() => removeToast(t.id)} className="hover:opacity-60 transition-opacity"><X size={14} /></button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
