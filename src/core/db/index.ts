// src/core/db/index.ts
// الوظيفة: أنواع قاعدة البيانات الأساسية — الحقول المشتركة في كل جدول
// المرجع: _DOCS/2_DATABASE_SCHEMA.md — الحقول الأساسية في كل جدول

/**
 * الحقول الأساسية الموجودة في كل جدول
 * id: UUID PRIMARY KEY
 * tenant_id: UUID NOT NULL — قانون العزل
 * created_at / updated_at: timestamps
 * created_by: UUID — المستخدم المُنشئ
 */
export interface BaseRecord {
  id: string;
  tenantId: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string | null;
}

/**
 * الحقول المالية — DECIMAL(15,3) دائماً — لا FLOAT أبداً
 * القاعدة الذهبية: لا يمكن لأي رصيد أن يصبح سالباً
 */
export type CurrencyAmount = number;

/**
 * نتيجة استعلام مُترقمة
 */
export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

/**
 * نتيجة عملية مالية
 */
export interface FinancialOperationResult {
  success: boolean;
  newBalance: CurrencyAmount;
  transactionId: string;
}
