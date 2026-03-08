// src/core/auth/index.ts
// الوظيفة: أنواع المصادقة والصلاحيات الأساسية
// المرجع: _DOCS/1_SYSTEM_RULES.md — هرم الصلاحيات (RBAC — 4 مستويات)

/**
 * أدوار المستخدمين في المنظومة
 * SUPER_ADMIN: مالك SaaS — طبقة منفصلة تماماً
 * OWNER: المالك / أمين الخزينة — صلاحيات مطلقة داخل بيئة المتجر
 * PARTNER: الشريك / المستثمر — يرى بياناته فقط
 * EMPLOYEE: موظف خدمة عملاء — صلاحيات محدودة
 */
export type UserRole = 'super_admin' | 'owner' | 'partner' | 'employee';

/**
 * بيانات المستخدم المُصادَق
 * الجداول المتأثرة: users, auth.users (Supabase)
 */
export interface IAuthUser {
  id: string;
  tenantId: string;
  fullName: string;
  phone: string | null;
  role: UserRole;
  isActive: boolean;
  metadata: Record<string, unknown>;
}
