// src/shared/utils/cn.ts
// الوظيفة: utility لدمج CSS classes بشكل آمن

export function cn(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(' ');
}
