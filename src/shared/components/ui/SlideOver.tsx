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
  darkMode?: boolean;
}

export function SlideOver({ isOpen, onClose, title, children, width = 'max-w-lg', hideHeader = false, darkMode = false }: SlideOverProps) {
  useEffect(() => {
    if (isOpen) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9997]">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className={`absolute top-0 right-0 h-full ${width} w-full ${darkMode ? 'bg-[#08091A]' : 'bg-white'} shadow-2xl animate-slide-in-right flex flex-col`}>
        {!hideHeader && (
          <div className={`flex items-center justify-between px-6 py-4 border-b ${darkMode ? 'border-white/10' : 'border-[#e2e6ed]'}`}>
            <h2 className={`text-lg font-bold ${darkMode ? 'text-white' : 'text-[#0a1628]'}`}>{title}</h2>
            <button onClick={onClose} className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${darkMode ? 'hover:bg-white/10 text-slate-400 hover:text-white' : 'hover:bg-[#f0f2f7] text-[#4a5a7a] hover:text-[#0a1628]'}`}>
              <X size={18} />
            </button>
          </div>
        )}
        <div className={`flex-1 overflow-y-auto px-6 py-5 ${darkMode ? 'custom-scrollbar' : ''}`}>
          {children}
        </div>
      </div>
    </div>
  );
}
