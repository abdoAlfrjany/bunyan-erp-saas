import { Product } from '../types';

export function validateLibyanPhone(phone: string): boolean {
  const cleaned = phone.replace(/\s/g, '');
  return /^(091|092|093|094|095)\d{7}$/.test(cleaned);
}

export function generateItemCode(existingProducts: Product[]): string {
  if (existingProducts.length === 0) return '1000';
  const maxCode = Math.max(...existingProducts.map(p => parseInt(p.itemCode) || 999));
  return String(maxCode + 1);
}

/**
 * Generates Cartesian product of multiple arrays
 * Example: cartesian([["S","M"],["Black","White"]]) => [["S","Black"],["S","White"],["M","Black"],["M","White"]]
 */
export function cartesian<T>(arrays: T[][]): T[][] {
  return arrays.reduce<T[][]>(
    (a, b) => a.flatMap((x) => b.map((y) => [...x, y])),
    [[]] as T[][]
  );
}

/**
 * Generates a SKU code based on product base and attribute values
 */
export function generateSKU(base: string, combo: string[]): string {
  const parts = combo.map((v) => v.slice(0, 3).toUpperCase());
  return `${base || 'PRD'}-${parts.join('-')}`;
}
