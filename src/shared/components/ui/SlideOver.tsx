// src/shared/components/ui/SlideOver.tsx
// الوظيفة: Slide-over panel من اليمين — للنماذج الكبيرة
// المرجع: 3_UI_UX_GUIDELINES.md — قاعدة 7: النماذج الكبيرة → Slide-over

'use client';

import { useEffect } from 'react';
import { X } from 'lucide-react';

interface SlideOverProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  width?: string;
  hideHeader?: boolean;
}

export function SlideOver({ isOpen, onClose, title, children, width = 'max-w-lg', hideHeader = false }: SlideOverProps) {
  useEffect(() => {
    if (isOpen) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9997]">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className={`absolute top-0 right-0 h-full ${width} w-full bg-white shadow-2xl animate-slide-in-right flex flex-col`}>
        {!hideHeader && (
          <div className="flex items-center justify-between px-6 py-4 border-b border-[#e2e6ed]">
            <h2 className="text-lg font-bold text-[#0a1628]">{title}</h2>
            <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-[#f0f2f7] flex items-center justify-center text-[#4a5a7a] hover:text-[#0a1628] transition-colors">
              <X size={18} />
            </button>
          </div>
        )}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {children}
        </div>
      </div>
    </div>
  );
}
