// src/core/delivery/index.ts
// الوظيفة: نقطة تصدير وحدة التوصيل الأساسية
// يُعيد تصدير IDeliveryProvider وجميع الأنواع المرتبطة

export type {
  IDeliveryProvider,
  CreateShipmentInput,
  ShipmentResult,
  ShipmentTrackingStatus,
  ShipmentStatusEvent,
} from './IDeliveryProvider';
