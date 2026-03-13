// src/core/delivery/VanexAdapter.ts
// الوظيفة: محوّل شركة VanEx — Adapter Pattern
// Production: https://app.vanex.ly/api/v1
// ⚠️ لا تكتب كود VanEx في أي ملف آخر

import type {
  IDeliveryProvider,
  ICreateShipmentPayload,
  ICreateShipmentResult,
  IShipmentStatusResult,
  VanexCity,
  Order,
} from '../types';

const BASE_URL = 'https://app.vanex.ly/api/v1';

const VANEX_TO_BUNYAN_STATUS: Record<string, Order['status']> = {
  pending:          'pending',
  shipped:          'with_courier',
  on_track:         'with_courier',
  enable_delivery:  'with_courier',
  delivered:        'delivered',
  returned:         'return_confirmed',
  cancelled:        'cancelled',
};

export class VanexAdapter implements IDeliveryProvider {
  readonly providerName = 'vanex';

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    token?: string
  ): Promise<{ success: boolean; data?: T; error?: string }> {
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`${BASE_URL}${endpoint}`, { ...options, headers });
      const json = await res.json();

      if (!res.ok || (json.status_code && json.status_code >= 400)) {
        return { success: false, error: json.message || `HTTP ${res.status}` };
      }
      return { success: true, data: json.data as T };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'خطأ في الاتصال بـ VanEx',
      };
    }
  }

  async authenticate(credentials: { email: string; password: string }) {
    const result = await this.request<{ access_token: string }>(
      '/authenticate',
      {
        method: 'POST',
        body: JSON.stringify({ email: credentials.email, password: credentials.password }),
      }
    );
    if (result.success && result.data) {
      return { success: true, token: result.data.access_token };
    }
    return { success: false, error: result.error };
  }

  async validateToken(token: string): Promise<boolean> {
    const result = await this.request('/validate-token', {}, token);
    return result.success;
  }

  async getCities(): Promise<VanexCity[]> {
    const result = await this.request<Array<{
      id: number; name: string; name_en: string;
      code: string; region_id: number; active: boolean;
    }>>('/city/all');
    if (result.success && result.data) {
      return result.data
        .filter(c => c.active)
        .map(c => ({
          id: c.id,
          name: c.name,
          nameEn: c.name_en,
          code: c.code,
          regionId: c.region_id,
          active: c.active,
        }));
    }
    return [];
  }

  async calculateDeliveryPrice(fromRegion: number, toCityId: number) {
    const result = await this.request<{ total_price: number; delivery_time: string }>(
      `/delivery-calculator?from_region=${fromRegion}&to_city=${toCityId}&package_type=1`
    );
    if (result.success && result.data) {
      return {
        total: Math.round(result.data.total_price),
        deliveryTime: result.data.delivery_time,
      };
    }
    return null;
  }

  async createShipment(payload: ICreateShipmentPayload, token: string): Promise<ICreateShipmentResult> {
    const body: Record<string, unknown> = {
      type:              payload.type ?? 1,
      reciever:          payload.receiverName,      // ⚠️ هجاء VanEx الأصلي المتعمد
      phone:             payload.receiverPhone,
      phone_b:           payload.receiverPhoneB,
      city:              payload.cityId,
      address:           payload.address,
      price:             payload.price,
      description:       payload.description,
      qty:               payload.qty,
      notes:             payload.notes,
      sticker_notes:     payload.stickerNotes,
      commission_by:     payload.commissionBy,
      paid_by:           payload.paidBy ?? 'customer',
      extra_size_by:     payload.extraSizeBy,
      payment_methode:   payload.paymentMethod,     // ⚠️ هجاء VanEx الأصلي المتعمد
      partial_delivery:  payload.partialDelivery ?? false,
      store_reference_id: payload.storeReferenceId,
    };

    if (payload.partialDelivery && payload.products?.length) {
      body.products = payload.products;
    }

    const result = await this.request<{
      id: number;
      'package-code': string;
      status: string;
      total: number;
    }>(
      '/customer/package',
      { method: 'POST', body: JSON.stringify(body) },
      token
    );

    if (result.success && result.data) {
      return {
        success: true,
        trackingCode: result.data['package-code'],
        internalId: result.data.id,
        rawStatus: result.data.status,
        estimatedTotal: Math.round(result.data.total ?? 0),
      };
    }
    return { success: false, error: result.error };
  }

  async getShipmentStatus(trackingCode: string): Promise<IShipmentStatusResult> {
    const result = await this.request<{ status: string; updated_at?: string }>(
      `/customer/package/${trackingCode}/check`
    );
    if (result.success && result.data) {
      const rawStatus = result.data.status;
      return {
        rawStatus,
        bunyanStatus: VANEX_TO_BUNYAN_STATUS[rawStatus] ?? 'with_courier',
        lastUpdate: result.data.updated_at,
      };
    }
    return { rawStatus: 'unknown', bunyanStatus: 'with_courier' };
  }

  async cancelShipment(id: number, token: string) {
    const result = await this.request(
      `/customer/package/${id}`,
      { method: 'DELETE' },
      token
    );
    return { success: result.success, error: result.error };
  }

  async recallShipment(id: number, token: string) {
    const result = await this.request(
      `/customer/package/${id}/recall`,
      { method: 'PUT' },
      token
    );
    return { success: result.success, error: result.error };
  }
}

export const vanexAdapter = new VanexAdapter();
