'use client';

import { useAppearanceStore } from '@/core/appearance/store';
import { useEffect } from 'react';

// لوحات الألوان للمنظومة
export const THEMES = {
  purple: {
    50: '232 224 240', 100: '201 184 217', 200: '169 143 192', 300: '138 103 168', 
    400: '107 64 144', 500: '74 37 112', 600: '58 26 90', 700: '42 16 69', 
    800: '26 8 48', 900: '13 4 24'
  },
  blue: {
    50: '239 246 255', 100: '219 234 254', 200: '191 219 254', 300: '147 197 253',
    400: '96 165 250', 500: '59 130 246', 600: '37 99 235', 700: '29 78 216',
    800: '30 64 175', 900: '30 58 138'
  },
  emerald: {
    50: '236 253 245', 100: '209 250 229', 200: '167 243 208', 300: '110 231 183',
    400: '52 211 153', 500: '16 185 129', 600: '5 150 105', 700: '4 120 87',
    800: '6 95 70', 900: '6 78 59'
  },
  amber: {
    50: '255 251 235', 100: '254 243 199', 200: '253 230 138', 300: '252 211 77',
    400: '251 191 36', 500: '245 158 11', 600: '217 119 6', 700: '180 83 9',
    800: '146 64 14', 900: '120 53 15'
  },
  rose: {
    50: '255 241 242', 100: '255 228 230', 200: '254 205 211', 300: '253 164 175',
    400: '251 113 133', 500: '244 63 94', 600: '225 29 72', 700: '190 18 60',
    800: '159 18 57', 900: '136 19 55'
  },
  slate: {
    50: '248 250 252', 100: '241 245 249', 200: '226 232 240', 300: '203 213 225',
    400: '148 163 184', 500: '100 116 139', 600: '71 85 105', 700: '51 65 85',
    800: '30 41 59', 900: '15 23 42'
  }
};

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { themeColor, fontSize } = useAppearanceStore();

  useEffect(() => {
    // 1. تطبيق لوحة الألوان
    const root = document.documentElement;
    const colors = THEMES[themeColor] || THEMES.purple;
    
    Object.entries(colors).forEach(([shade, value]) => {
      root.style.setProperty(`--color-bunyan-${shade}`, value as string);
    });

    // 2. تطبيق حجم الخط العام
    if (fontSize === 'sm') root.style.fontSize = '14px';
    if (fontSize === 'base') root.style.fontSize = '16px';
    if (fontSize === 'lg') root.style.fontSize = '18px';

  }, [themeColor, fontSize]);

  return <>{children}</>;
}
