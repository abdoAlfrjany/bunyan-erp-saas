// src/core/delivery/index.ts
// نقطة التصدير الموحدة — Factory Pattern

export { VanexAdapter, vanexAdapter } from './VanexAdapter';
export { MockShippingAdapter, mockAdapter } from './MockShippingAdapter';
export type { IDeliveryProvider, ICreateShipmentPayload, ICreateShipmentResult, IShipmentStatusResult, VanexCity } from '../types';

import { VanexAdapter } from './VanexAdapter';
import { MockShippingAdapter } from './MockShippingAdapter';
import type { IDeliveryProvider } from '../types';

export function getDeliveryAdapter(provider: 'vanex' | 'mock' | 'none'): IDeliveryProvider {
  switch (provider) {
    case 'vanex': return new VanexAdapter();
    case 'mock':  return new MockShippingAdapter();
    default:      return new MockShippingAdapter();
  }
}
