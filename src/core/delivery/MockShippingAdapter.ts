// src/core/delivery/MockShippingAdapter.ts
// الوظيفة: محاكي وهمي لاختبار دورة التوصيل بدون API حقيقي

import type {
  IDeliveryProvider,
  ICreateShipmentPayload,
  ICreateShipmentResult,
  IShipmentStatusResult,
  VanexCity,
} from '../types';

const MOCK_CITIES: VanexCity[] = [
  { id: 1,  name: 'طرابلس',   nameEn: 'Tripoli',   code: 'TRP', regionId: 1, active: true },
  { id: 2,  name: 'بنغازي',   nameEn: 'Benghazi',  code: 'BNG', regionId: 2, active: true },
  { id: 3,  name: 'مصراتة',   nameEn: 'Misrata',   code: 'MSR', regionId: 1, active: true },
  { id: 4,  name: 'الزاوية',  nameEn: 'Zawiya',    code: 'ZWY', regionId: 1, active: true },
  { id: 5,  name: 'سرت',      nameEn: 'Sirte',     code: 'SRT', regionId: 3, active: true },
  { id: 6,  name: 'ترهونة',   nameEn: 'Tarhuna',   code: 'TRH', regionId: 1, active: true },
  { id: 7,  name: 'غريان',    nameEn: 'Gharyan',   code: 'GHR', regionId: 4, active: true },
  { id: 8,  name: 'الزنتان',  nameEn: 'Zintan',    code: 'ZNT', regionId: 4, active: true },
  { id: 9,  name: 'زليتن',    nameEn: 'Zliten',    code: 'ZLT', regionId: 1, active: true },
  { id: 10, name: 'الخمس',    nameEn: 'Al-Khums',  code: 'KHM', regionId: 1, active: true },
  { id: 11, name: 'صبراتة',   nameEn: 'Sabratha',  code: 'SBR', regionId: 1, active: true },
  { id: 12, name: 'البيضاء',  nameEn: 'Al-Bayda',  code: 'BYD', regionId: 2, active: true },
  { id: 13, name: 'درنة',     nameEn: 'Derna',     code: 'DRN', regionId: 2, active: true },
  { id: 14, name: 'طبرق',     nameEn: 'Tobruk',    code: 'TBR', regionId: 2, active: true },
  { id: 15, name: 'أجدابيا',  nameEn: 'Ajdabiya',  code: 'AJD', regionId: 2, active: true },
];

let mockCounter = 9000;
const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

export class MockShippingAdapter implements IDeliveryProvider {
  readonly providerName = 'mock';

  async authenticate(credentials: { email: string; password: string }) {
    await delay(500);
    if (credentials.email && credentials.password) {
      return { success: true, token: `mock-token-${Date.now()}` };
    }
    return { success: false, error: 'بيانات غير صحيحة (محاكي)' };
  }

  async validateToken(token: string): Promise<boolean> {
    await delay(200);
    return token.startsWith('mock-token-');
  }

  async getCities(): Promise<VanexCity[]> {
    await delay(300);
    return MOCK_CITIES;
  }

  async calculateDeliveryPrice(_fromRegion: number, toCityId: number) {
    await delay(200);
    const prices: Record<number, number> = {
      1: 15, 2: 25, 3: 18, 4: 12, 5: 22,
      6: 20, 7: 16, 8: 20, 9: 14, 10: 13,
      11: 12, 12: 28, 13: 30, 14: 35, 15: 25,
    };
    return { total: prices[toCityId] ?? 20, deliveryTime: '2-3 أيام عمل' };
  }

  async createShipment(_payload: ICreateShipmentPayload, _token: string): Promise<ICreateShipmentResult> {
    await delay(600);
    const code = `MCK-${++mockCounter}`;
    return { success: true, trackingCode: code, internalId: mockCounter, rawStatus: 'pending' };
  }

  async getShipmentStatus(_trackingCode: string): Promise<IShipmentStatusResult> {
    await delay(300);
    return { rawStatus: 'shipped', bunyanStatus: 'with_courier', lastUpdate: new Date().toISOString() };
  }

  async cancelShipment(_id: number, _token: string) {
    await delay(400);
    return { success: true };
  }

  async recallShipment(_id: number, _token: string) {
    await delay(400);
    return { success: true };
  }
}

export const mockAdapter = new MockShippingAdapter();
