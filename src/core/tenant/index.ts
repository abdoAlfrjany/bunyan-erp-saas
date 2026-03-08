// src/core/tenant/index.ts
// الوظيفة: أنواع المستأجر (Tenant) — بيانات التاجر وباقته
// المرجع: _DOCS/2_DATABASE_SCHEMA.md — جدول tenants
// القاعدة: كل جدول يحتوي على tenant_id — قانون لا يُكسر

/**
 * خطط الاشتراك المتاحة
 */
export type TenantPlan = 'trial' | 'basic' | 'pro' | 'lifetime';

/**
 * نموذج الفوترة
 */
export type BillingModel = 'post_paid' | 'pre_paid';

/**
 * بيانات المستأجر (التاجر)
 * الجداول المتأثرة: tenants
 */
export interface ITenant {
  id: string;
  name: string;
  ownerEmail: string;
  plan: TenantPlan;
  planExpiresAt: string | null;
  isActive: boolean;
  billingModel: BillingModel;
  settings: Record<string, unknown>;
  createdAt: string;
}
