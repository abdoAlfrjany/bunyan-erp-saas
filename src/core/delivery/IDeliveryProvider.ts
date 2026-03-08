// src/core/delivery/IDeliveryProvider.ts
// الوظيفة: Interface للربط المستقبلي مع API شركات التوصيل
// المرجع: _DOCS/1_SYSTEM_RULES.md — المرحلة الثانية: تفعيل IDeliveryProvider
// الصلاحية: يُستدعى من الخادم فقط (Server-side)
// ⚠️ لا يُنفَّذ حالياً — هيكل جاهز للمرحلة الثانية

/**
 * بيانات إنشاء شحنة جديدة عبر API الشركة
 */
export interface CreateShipmentInput {
  orderId: string;
  recipientName: string;
  recipientPhone: string;
  recipientAddress: string;
  recipientCity: string;
  deliveryRegion: string;
  declaredAmount: number;
  codAmount: number;
  weight?: number;
  notes?: string;
  dynamicFields?: Record<string, unknown>;
}

/**
 * نتيجة إنشاء شحنة من شركة التوصيل
 */
export interface ShipmentResult {
  success: boolean;
  trackingNumber: string;
  shipmentReference: string;
  estimatedDeliveryAt: string | null;
  rawResponse?: Record<string, unknown>;
}

/**
 * حالة الشحنة من شركة التوصيل
 */
export interface ShipmentTrackingStatus {
  trackingNumber: string;
  status: string;
  statusArabic: string;
  lastUpdate: string;
  location?: string;
  history: ShipmentStatusEvent[];
}

/**
 * حدث في تاريخ حالة الشحنة
 */
export interface ShipmentStatusEvent {
  status: string;
  statusArabic: string;
  timestamp: string;
  location?: string;
  notes?: string;
}

/**
 * Interface الأساسي لربط API أي شركة توصيل
 * كل شركة توصيل يتم دعمها تُنفِّذ هذا الـ interface
 * المرحلة الثانية: sprint, ramco, etc.
 */
export interface IDeliveryProvider {
  /** اسم الشركة المُزوِّدة */
  readonly providerName: string;

  /** إنشاء شحنة جديدة في نظام الشركة */
  createShipment(data: CreateShipmentInput): Promise<ShipmentResult>;

  /** تتبع حالة شحنة بناءً على رقم التتبع */
  trackShipment(trackingNumber: string): Promise<ShipmentTrackingStatus>;

  /** إلغاء شحنة */
  cancelShipment(trackingNumber: string): Promise<{ success: boolean; message: string }>;

  /** التحقق من صلاحية اتصال الـ API */
  validateConnection(): Promise<{ connected: boolean; message: string }>;
}
