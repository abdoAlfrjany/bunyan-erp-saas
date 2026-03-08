import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export type ThemeColor = 'purple' | 'blue' | 'emerald' | 'amber' | 'rose' | 'slate';

interface AppearanceState {
  themeColor: ThemeColor;
  setThemeColor: (color: ThemeColor) => void;
  fontSize: 'sm' | 'base' | 'lg';
  setFontSize: (size: 'sm' | 'base' | 'lg') => void;
  sidebarMode: 'expanded' | 'collapsed';
  setSidebarMode: (mode: 'expanded' | 'collapsed') => void;
}

export const useAppearanceStore = create<AppearanceState>()(
  persist(
    (set) => ({
      themeColor: 'purple',
      setThemeColor: (color) => set({ themeColor: color }),
      fontSize: 'base',
      setFontSize: (size) => set({ fontSize: size }),
      sidebarMode: 'expanded',
      setSidebarMode: (mode) => set({ sidebarMode: mode })
    }),
    {
      name: 'bunyan-appearance',
      storage: createJSONStorage(() => localStorage),
    }
  )
);
