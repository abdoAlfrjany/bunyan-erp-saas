# VanEx Logistics System — REST API Documentation
**Version:** 1.0.0 | **Spec:** OAS 3.0 | **Base URL:** `https://app.vanex.ly/api/v1`

---

## Table of Contents
1. [Overview](#overview)
2. [Authentication](#authentication)
3. [Standard Response Format](#standard-response-format)
4. [Error Handling](#error-handling)
5. [Endpoints](#endpoints)
   - [Auth](#1-auth)
   - [Packages](#2-packages)
   - [Settlements](#3-settlements)
   - [Transactions](#4-transactions)
   - [Geography](#5-geography)
   - [Safe Storage](#6-safe-storage)
   - [Support](#7-support)
   - [Cities & Regions](#8-cities--regions)
6. [Schemas](#schemas)
7. [Known Issues](#known-issues)

---

## Overview

VanEx is Libya's leading logistics platform. The API covers:
- Package management and tracking
- Financial transactions and settlements
- User authentication via Laravel Sanctum
- Comprehensive reporting
- Multi-language support (Arabic/English)

---

## Authentication

**Method:** Laravel Sanctum Bearer Token

**Header:**
```
Authorization: Bearer {token}
```

Token is obtained from `/authenticate` endpoint. Maximum 5 active tokens per user (oldest deleted when exceeded).

---

## Standard Response Format

All endpoints return this consistent structure:

```json
{
  "status_code": 200,
  "message": "نجحت العملية",
  "data": {},
  "errors": null
}
```

---

## Error Handling

| HTTP Code | Meaning |
|-----------|---------|
| 400 | Bad Request |
| 401 | Unauthorized |
| 403 | Forbidden |
| 404 | Not Found |
| 422 | Validation Error |
| 500 | Internal Server Error |

Error response format:
```json
{
  "status_code": 422,
  "message": "خطأ في البيانات المدخلة",
  "errors": {
    "field_name": ["error message"]
  }
}
```

---

## Endpoints

---

### 1. Auth

**Base path:** `/`
**Auth required:** No (except logout and validate-token)

---

#### POST `/authenticate` — User Login

Authenticates user and returns Sanctum token.

**Notes:**
- `email` field accepts email address OR phone number (auto-detected)
- After 5 failed attempts, account is locked
- Store must be approved for store users
- Max 5 active tokens per user

**Request Body:**
```json
{
  "email": "0912345678",
  "password": "SecurePassword123",
  "device_token": "device_12345"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| email | string | ✅ | Email or phone number |
| password | string | ✅ | User password |
| device_token | string | ❌ | Device push token |

**Response 200:**
```json
{
  "status_code": 200,
  "message": "تم تسجيل الدخول",
  "access_token": "993548|YSrfPjUHWoMTbDRJPRiOyBamtRBP67qC48QszeF7",
  "token_type": "Bearer",
  "user": {
    "id": 18943,
    "name": "APP TEST",
    "company": 13903,
    "email": "apptest@vanex.ly",
    "type": 1,
    "full_access": 0,
    "branch_region": null,
    "storage_subscription": 1,
    "office_cities": [42, 200, 500, 823, 1139, 1140, 69, 222, 501, 845],
    "avatar": null,
    "store_manager": 1,
    "show_packages": 1,
    "create_packages": 1,
    "edit_packages": 1,
    "create_collects": 1,
    "edit_collects": 1,
    "settelment_collects": 1,
    "show_transactions": 1,
    "show_reports": 1,
    "can_contact": 1,
    "handover": 1,
    "permissions": [
      { "action": "store_manager", "subject": "Auth" }
    ],
    "need_regenerate": false
  },
  "permissions": [
    { "action": "store_manager", "subject": "Auth" }
  ]
}
```

**Response 401:**
```json
{
  "status_code": 401,
  "errors": {
    "email": ["الرجاء التحقق من البريد الإلكتروني أو رقم الهاتف أو كلمة السر"]
  },
  "resend_otp_code": false
}
```

---

#### POST `/register` — User Registration

Registers a new individual customer account.

**Notes:**
- Either `email` OR `phone` is required (both can be provided)
- `branch` is required
- Password minimum: 6 characters
- After registration, email/phone verification is required via OTP

**Request Body:**
```json
{
  "name": "أحمد محمد",
  "email": "ahmad@example.com",
  "phone": "0925555555",
  "branch": 1,
  "password": "Pass123456",
  "password_confirmation": "Pass123456"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| name | string | ✅ | Full name |
| email | string | ❌* | Email (at least one of email/phone required) |
| phone | string | ❌* | Phone number (at least one of email/phone required) |
| branch | integer | ✅ | Branch/region ID |
| password | string | ✅ | Min 6 characters |
| password_confirmation | string | ✅ | Must match password |

**Response 201:**
```json
{
  "status_code": 201,
  "message": "تم التسجيل، يرجي التحقق من الرسالة في البريد الإلكتروني.",
  "data": [],
  "errors": false
}
```

---

#### GET `/validate-token` — Validate Token

Validates the current Bearer token and returns user data.

**Auth:** Required

**Response 200:**
```json
{
  "status_code": 200,
  "message": "الرمز المميز صالح",
  "data": {
    "id": 1,
    "name": "أحمد محمد",
    "email": "ahmed@store.ly",
    "permissions": ["create_packages", "view_settlements"]
  }
}
```

---

#### GET `/logout` — User Logout

Logs out user and invalidates current token.

**Auth:** Required

**Response 200:**
```json
{
  "status_code": 200,
  "message": "تم تسجيل الخروج بنجاح",
  "data": { "logged_out": true }
}
```

---

#### POST `/verification` — Account Verification

Verifies account using OTP code sent to email/phone.

**Request Body:**
```json
{
  "email": "user@example.com",
  "code": "123456"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| email | string | ✅ | Email or phone |
| code | string | ✅ | OTP verification code |

**Response 200:**
```json
{
  "status_code": 200,
  "message": "تمت العملية بنجاح",
  "data": {
    "verified": true,
    "access_token": "1|abcdef123456..."
  }
}
```

---

#### POST `/resend-otp` — Resend OTP

Resends verification OTP to user's phone/email.

**Request Body:**
```json
{
  "phone": "0912345678"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| phone | string | ✅ | Phone number or email |

**Response 200:**
```json
{
  "status_code": 200,
  "message": "تمت العملية بنجاح",
  "data": {}
}
```

---

#### POST `/password-reset` — Request Password Reset

Sends password reset link/code to user's email.

**Request Body:**
```json
{
  "email": "user@vanex.ly"
}
```

**Response 201:**
```json
{
  "status_code": 201,
  "message": "إذا كان الحساب موجوداً، تم إرسال رمز التحقق عبر البريد الإلكتروني والرسائل القصيرة",
  "data": [],
  "errors": false
}
```

---

### 2. Packages

**Base path:** `/customer/package`
**Auth required:** Yes (except `/tracking`)

---

#### GET `/store-coupons/all` — Get Store Coupons

Retrieves all store coupons with optional filtering.

**Query Parameters:**

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| unusedOnly | string | ❌ | Filter unused coupons only |
| page | integer | ❌ | Page number |
| per_page | integer | ❌ | Items per page |

**Response 200:**
```json
{
  "status_code": 200,
  "message": "تمت العملية بنجاح",
  "data": {},
  "errors": {}
}
```

---

#### POST `/store-coupons/apply-coupon` — Apply Coupon to Package

Applies a coupon code to a specific package.

**Request Body:**
```json
{
  "code": "SAVE10",
  "package_id": 12345
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| code | string | ✅ | Coupon code |
| package_id | integer | ✅ | Target package ID |

**Response 200:**
```json
{
  "status_code": 200,
  "message": "تمت العملية بنجاح",
  "data": {}
}
```

---

#### GET `/tracking` — Track Package (Public)

Tracks a package by tracking code. **No authentication required.**

**Query Parameters:**

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| code | string | ✅ | Package tracking code (e.g. VNX123456) |

**Response 200:**
```json
{
  "status_code": 200,
  "message": "تم العثور على الطرد",
  "data": {
    "code": "VNX123456",
    "status": "في الطريق",
    "receiver_name": "أحمد محمد",
    "current_location": "طرابلس - مركز التوزيع",
    "estimated_delivery": "2024-10-15"
  }
}
```

---

#### GET `/apply-coupon` — Apply Coupon Code (Public)

⚠️ **Note:** Documented params differ from actual API. Actual params are `promo-code` and `pkg`.

**Query Parameters (Actual):**

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| promo-code | string | ✅ | Coupon/promo code |
| pkg | number | ✅ | Package value for discount calculation |

**Response 200:**
```json
{
  "status_code": 200,
  "message": "تمت العملية بنجاح",
  "data": {
    "coupon_valid": true,
    "discount_amount": 20,
    "discount_percentage": 20,
    "final_amount": 80
  }
}
```

---

#### GET `/customer/package` — Get User Packages

Retrieves user packages with filtering. (v2 recommended endpoint)

**Query Parameters:**

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| status | string | ❌ | — | Filter by status |
| per_page | integer | ❌ | 10 | Items per page |
| page | integer | ❌ | 1 | Page number |

**Response 200:**
```json
{
  "status_code": 200,
  "data": {
    "data": [ /* array of PackageDetails */ ],
    "current_page": 1,
    "last_page": 10,
    "per_page": 15,
    "total": 150
  }
}
```

See [PackageDetails](#packagedetails) schema for full structure.

---

#### POST `/customer/package` — Create Package (V2 — Recommended)

Creates a new delivery package. Supports 4 types with conditional validation.

**Package Types:**

| Type | Name | Special Rules |
|------|------|---------------|
| 1 | Commercial | All fields required |
| 2 | Return/Exchange | price and paid_by optional |
| 3 | Document | Dimensions optional, sub_type required |
| 4 | Other | Standard validation |

**Important Notes:**
- Either `city` OR `unified_city` must be provided
- If `address_code` provided, recipient fields become optional
- Dimensions required for all types except type=3
- `commission_by` values: `market`, `customer` (NO 'pre')
- `extra_size_by` values: `market`, `customer` (NO 'pre')

**Request Body — Type 1 (Commercial):**
```json
{
  "type": 1,
  "reciever": "أحمد محمد",
  "phone": "0912345678",
  "city": 1,
  "address": "شارع الجمهورية، بناية رقم 123",
  "price": 200,
  "payment_methode": "cash",
  "paid_by": "customer",
  "description": "ملابس رجالية",
  "qty": 3,
  "height": 30,
  "leangh": 40,
  "width": 25,
  "extra_size_by": "customer",
  "commission_by": "customer"
}
```

**Request Body — Type 2 (Return Package):**
```json
{
  "type": 2,
  "reciever": "محمد علي",
  "phone": "0912345678",
  "city": 1,
  "address": "العنوان",
  "payment_methode": "cash",
  "description": "إرجاع بضاعة",
  "qty": 1,
  "height": 20,
  "leangh": 30,
  "width": 20,
  "extra_size_by": "customer",
  "commission_by": "customer"
}
```

**Request Body — Type 3 (Document):**
```json
{
  "type": 3,
  "sub_type": 1,
  "reciever": "فاطمة أحمد",
  "phone": "0912345678",
  "city": 1,
  "address": "العنوان",
  "price": 50,
  "payment_methode": "cash",
  "extra_size_by": "customer",
  "commission_by": "customer"
}
```

**Request Body — With Partial Delivery & Products:**
```json
{
  "type": 1,
  "reciever": "أحمد",
  "phone": "0912345678",
  "city": 1,
  "address": "العنوان",
  "price": 300,
  "payment_methode": "cash",
  "paid_by": "customer",
  "description": "منتجات متعددة",
  "qty": 3,
  "height": 30,
  "leangh": 40,
  "width": 25,
  "extra_size_by": "customer",
  "commission_by": "customer",
  "partial_delivery": 1,
  "store_package_products": [
    { "name": "منتج 1", "price": 100, "qty": 1, "code": "P001" },
    { "name": "منتج 2", "price": 200, "qty": 2, "code": "P002" }
  ]
}
```

**Request Body — Using Saved Address Code:**
```json
{
  "type": 1,
  "address_code": "ADDR_123",
  "price": 150,
  "payment_methode": "cash",
  "paid_by": "customer",
  "description": "منتج",
  "qty": 1,
  "height": 20,
  "leangh": 30,
  "width": 20,
  "extra_size_by": "customer",
  "commission_by": "customer"
}
```

**Full Request Fields Reference:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| type | integer | ✅ | Package type: 1, 2, 3, or 4 |
| sub_type | integer | ❌* | Required when type=3 |
| reciever | string | ❌* | Recipient name (optional if address_code provided) |
| phone | string | ❌* | Recipient phone 10-20 digits (optional if address_code) |
| phone_b | string | ❌ | Secondary phone |
| city | integer | ❌* | City ID (required if no unified_city) |
| unified_city | integer | ❌* | Unified city ID (required if no city) |
| address | string | ❌* | Delivery address (conditional) |
| address_child | integer/array | ❌ | Sub-city ID |
| address_code | string | ❌ | Saved address code |
| map | string | ❌ | GPS coordinates or map link |
| price | number | ❌* | Package value (required for type 1,3,4) |
| payment_methode | string | ✅ | `cash`, `cheque`, `epayment` |
| paid_by | string | ❌* | Required for type=1: `market`, `customer`, `half` |
| description | string | ❌* | Required for type 1 and 2 |
| qty | number | ✅ | Item quantity |
| qty_return | number | ❌ | Return quantity for exchange packages |
| price_delivered | number | ❌ | Price upon delivery |
| notes | string | ❌ | Internal handling notes |
| sticker_notes | string | ❌ | Notes printed on sticker |
| store_reference_id | string | ❌ | Store internal reference ID |
| store_pkg_details | string | ❌ | Additional package details |
| store_sub_sender | string | ❌ | Sub-sender identifier |
| height | number | ❌* | Height in cm (required for type 1,2,4) |
| leangh | number | ❌* | Length in cm (required for type 1,2,4) ⚠️ typo in field name |
| width | number | ❌* | Width in cm (required for type 1,2,4) |
| extra_size_by | string | ✅ | Extra size charges payer: `market`, `customer` |
| commission_by | string | ✅ | Regional commission payer: `market`, `customer` |
| partial_delivery | integer | ❌ | `0` = standard, `1` = partial delivery |
| store_package_products | array | ❌* | Required if partial_delivery=1 and no products |
| products | array | ❌ | Products array (with partial delivery) |
| are_products_modified | integer | ❌ | Products modified flag |
| selectedSupplies | array | ❌ | Supplies to include |
| currency_type_id | integer | ❌* | Required if total_amount > 0 |
| total_amount | number | ❌* | Required if currency_type_id provided |
| photo | binary | ❌ | Package photo (max 4MB, png/jpg/jpeg/gif) |
| can_validate | boolean | ❌ | Whether package can be validated |
| is_online_payable | integer | ❌ | Online payment support: `0` or `1` |

**Response 201:**
```json
{
  "status_code": 201,
  "message": "تم إضافة الشحنة بنجاح",
  "data": {
    "id": 2942850,
    "package-code": "H-13903-TIP-5885703",
    "type": 1,
    "reciever": "أحمد محمد",
    "phone": "0912345678",
    "price": 200,
    "total": 215,
    "status": "store_new"
  }
}
```

**Validation Errors (422):**

| Error Case | Field | Message |
|------------|-------|---------|
| Missing city | city | "Either city or unified_city must be provided" |
| Invalid type | type | "The selected type is invalid." |
| Missing sub_type | sub_type | "The sub type field is required when type is 3." |
| Partial delivery no products | store_package_products | "The store package products field is required when partial delivery is enabled" |

---

#### POST `/customer/package/search` — Search Packages

Searches packages by various criteria.

**Request Body:**
```json
{
  "search": "VNX123",
  "status": "shipped",
  "date_from": "2024-10-01",
  "date_to": "2024-10-31",
  "city_id": 1
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| search | string | ❌ | Search term (code, name, etc.) |
| status | string | ❌ | Package status filter |
| date_from | string (date) | ❌ | Start date filter |
| date_to | string (date) | ❌ | End date filter |
| city_id | integer | ❌ | City filter |

---

#### GET `/customer/package/count` — Get Package Counts

Returns count of packages by status.

**Response 200:**
```json
{
  "status_code": 200,
  "data": {
    "total": 150,
    "pending": 25,
    "shipped": 80,
    "delivered": 40,
    "returned": 5
  }
}
```

---

#### GET `/customer/package/dashboard` — Package Dashboard

Returns dashboard statistics.

**Response 200:**
```json
{
  "status_code": 200,
  "data": {
    "total_packages": 150,
    "pending_packages": 25,
    "delivered_packages": 100,
    "cancelled_packages": 25,
    "total_revenue": 15000.5
  }
}
```

---

#### GET `/customer/package/types` — Get Package Types

Returns available package types and subtypes.

**Response 200:**
```json
{
  "status_code": 200,
  "data": [
    { "id": 1, "name": "وثائق", "name_en": "Documents", "active": true }
  ]
}
```

---

#### GET `/customer/package/statuses` — Get Package Statuses

Returns all available package statuses.

**Response 200:**
```json
{
  "status_code": 200,
  "data": [
    { "id": 1, "name": "في الطريق", "description": "Package is on the way", "color": "#FF5722" }
  ]
}
```

---

#### GET `/customer/package/{id}` — Get Package Details

Returns detailed information about a specific package.

**Path Parameters:**

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| id | integer | ✅ | Package ID or tracking code |

**Response 200:** Returns full [PackageDetails](#packagedetails) object.

**Errors:** 401, 404

---

#### PUT `/customer/package/{id}` — Update Package

Updates package info. Only allowed before shipping.

**Path Parameters:**

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| id | integer | ✅ | Package ID |

**Request Body:**
```json
{
  "receiver_name": "أحمد محمد الجديد",
  "phone": "0912345678",
  "phone_b": "0922345678",
  "address": "العنوان المحدث",
  "city_id": 1,
  "sub_city_id": 5,
  "notes": "ملاحظات محدثة",
  "price": 175.5
}
```

**Errors:** 400 (already shipped), 401, 404, 422

---

#### DELETE `/customer/package/{id}` — Cancel Package

Cancels a package. Only allowed before shipping.

**Path Parameters:**

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| id | integer | ✅ | Package ID |

**Response 200:**
```json
{
  "status_code": 200,
  "message": "تم إلغاء الطرد بنجاح",
  "data": { "cancelled": true, "cancelled_at": "2024-10-02T14:30:00Z" }
}
```

**Errors:** 400, 401, 404

---

#### GET `/customer/package/{code}/logs` — Get Package Tracking Logs

Returns full tracking history for a package.

**Path Parameters:**

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| code | string | ✅ | Package tracking code |

**Response 200:**
```json
{
  "status_code": 200,
  "message": "تم استرداد سجل الطرد بنجاح",
  "data": [
    {
      "id": 1,
      "status": "created",
      "status_ar": "تم الإنشاء",
      "description": "تم إنشاء الطرد بنجاح",
      "location": "مركز طرابلس",
      "created_at": "2024-10-01T10:00:00Z"
    }
  ]
}
```

---

#### GET `/customer/package/{code}/check` — Check Package Status

Quick status check for a package.

**Path Parameters:**

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| code | string | ✅ | Package tracking code |

**Response 200:**
```json
{
  "status_code": 200,
  "data": {
    "code": "VNX123456",
    "status": "shipped",
    "status_ar": "تم الشحن",
    "can_be_delivered": true,
    "estimated_delivery": "2024-10-05"
  }
}
```

---

#### PUT `/customer/package/{id}/recall` — Recall Package

Requests recall/return of a package.

**Path Parameters:**

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| id | integer | ✅ | Package ID |

**Request Body:**
```json
{
  "reason": "عنوان خاطئ"
}
```

**Errors:** 400, 401, 404

---

#### PUT `/customer/package/{id}/resend` — Resend Package

Requests resend of a returned package.

**Path Parameters:**

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| id | integer | ✅ | Package ID |

**Request Body:**
```json
{
  "new_address": "العنوان الجديد المحدث",
  "new_phone": "0912345678"
}
```

**Errors:** 400, 401, 404

---

#### POST `/customer/package/import` — Import Bulk Packages

Imports multiple packages from Excel/CSV file.

**Content-Type:** `multipart/form-data`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| file | binary | ✅ | Excel or CSV file |
| template_type | string | ❌ | `excel` |

**Response 200:**
```json
{
  "status_code": 200,
  "data": {
    "imported_count": 25,
    "failed_count": 2,
    "errors": [{ "row": 3, "message": "invalid city" }]
  }
}
```

---

#### GET `/customer/package/export` — Export Packages

Exports user packages to file.

**Query Parameters:**

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| status | string | ❌ | Filter by status |
| date_from | date | ❌ | Start date |
| date_to | date | ❌ | End date |
| format | string | ❌ | `excel`, `csv`, `pdf` |

**Response 200 Content Types:**
- `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` (Excel)
- `text/csv`
- `application/pdf`

---

### 3. Settlements

**Base path:** `/store/settelmets`
**Auth required:** Yes

---

#### GET `/store/settelmets` — Get Store Settlements

Retrieves settlements for authenticated store.

**Query Parameters:**

| Param | Type | Required | Enum | Description |
|-------|------|----------|------|-------------|
| status | string | ❌ | `pending`, `approved`, `rejected`, `paid` | Filter by status |
| page | integer | ❌ | — | Page number |

**Response 200:**
```json
{
  "status_code": 200,
  "data": {
    "data": [
      { "id": 1, "amount": 1000, "status": "pending", "created_at": "..." }
    ],
    "current_page": 1,
    "last_page": 5,
    "per_page": 15,
    "total": 75
  }
}
```

---

#### GET `/store/settelmets/{id}/show` — Get Settlement Details

Returns detailed information about a specific settlement including all packages.

**Path Parameters:**

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| id | integer | ✅ | Settlement ID |

**Response 200:**
```json
{
  "status_code": 200,
  "data": {
    "id": 1,
    "store_id": 1,
    "settlement_number": "SET-2024-001",
    "total_amount": 2500.75,
    "status": "approved",
    "status_ar": "موافق عليها",
    "payment_method_id": 1,
    "notes": "تسوية شهر يناير",
    "created_at": "...",
    "approved_at": "...",
    "paid_at": null,
    "payment_method": { "id": 1, "name": "حوالة بنكية", "name_en": "Bank Transfer", "active": true },
    "packages": [ /* array of Package */ ],
    "store": { /* Store object */ }
  }
}
```

**Errors:** 401, 404

---

### 4. Transactions

**Base path:** `/store/transactions`
**Auth required:** Yes

---

#### GET `/store/transactions` — Get Store Transactions

Retrieves transaction history for store.

**Query Parameters:**

| Param | Type | Required | Enum | Description |
|-------|------|----------|------|-------------|
| type | string | ❌ | `credit`, `debit`, `settlement`, `money_transfer`, `package_fee` | Transaction type |
| from_date | date | ❌ | — | Start date |
| to_date | date | ❌ | — | End date |
| per_page | integer | ❌ | — | Default: 10 |

**Response 200:**
```json
{
  "status_code": 200,
  "data": {
    "data": [
      {
        "id": 1,
        "amount": 500,
        "type": "credit",
        "description": "Package payment",
        "created_at": "..."
      }
    ],
    "current_page": 1,
    "last_page": 8,
    "per_page": 15,
    "total": 120
  }
}
```

---

### 5. Geography

---

#### GET `/delivery-calculator` — Delivery Price Calculator

Calculates delivery price based on destination and dimensions.

⚠️ **Note:** Documented params differ from actual API. Actual required params are: `region`, `destination`, `height`, `leangh`, `width`.

**Query Parameters (Actual):**

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| region | integer | ✅ | Source region ID |
| destination | integer | ✅ | Destination city/sub-city ID |
| height | number | ✅ | Package height in cm |
| leangh | number | ✅ | Package length in cm |
| width | number | ✅ | Package width in cm |

**Response 200:**
```json
{
  "status_code": 200,
  "data": {
    "base_price": 15,
    "region_price": 5,
    "total_price": 20,
    "currency": "LYD",
    "delivery_time": "2-3 أيام عمل"
  }
}
```

---

### 6. Safe Storage

**Auth required:** Yes

---

#### GET `/safe-storage/products` — Get Safe Storage Products

Retrieves products stored in safe storage.

**Query Parameters:**

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| instock | integer | ❌ | `0` = out of stock, `1` = in stock |

**Response 200:**
```json
{
  "status_code": 200,
  "message": "تمت العملية بنجاح",
  "data": {}
}
```

---

#### GET `/safe-storage/inventory` — Get Safe Storage Inventory

Retrieves inventory information from safe storage.

**No parameters.**

**Response 200:**
```json
{
  "status_code": 200,
  "message": "تمت العملية بنجاح",
  "data": {}
}
```

---

### 7. Support

**Base path:** `/tickets`
**Auth required:** Yes

---

#### POST `/tickets` — Create Support Ticket

Creates a new support ticket.

⚠️ **Known Issue:** Returns `405 Method Not Allowed` in production — route may be misconfigured.

**Content-Type:** `multipart/form-data`

| Field | Type | Required | Enum | Description |
|-------|------|----------|------|-------------|
| title | string | ✅ | — | Ticket title |
| content | string | ✅ | — | Ticket description |
| priority | string | ✅ | `low`, `medium`, `high`, `urgent` | Ticket priority |
| category | string | ✅ | — | Ticket category (e.g. `delivery`) |
| attachment | binary | ❌ | — | Optional file attachment |

**Response 201:**
```json
{
  "status_code": 200,
  "message": "تمت العملية بنجاح",
  "data": {}
}
```

---

#### GET `/tickets` — Get Support Tickets

Retrieves user's support tickets.

⚠️ **Known Issue:** Returns `404` in production — route may be misconfigured.

**Query Parameters:**

| Param | Type | Required | Enum | Description |
|-------|------|----------|------|-------------|
| status | string | ❌ | `open`, `in_progress`, `closed` | Filter by ticket status |
| page | integer | ❌ | — | Page number |

**Response 200:**
```json
{
  "status_code": 200,
  "message": "تمت العملية بنجاح",
  "data": {}
}
```

---

#### POST `/customer/tickets/{ticket_id}/rate` — Rate Support Ticket

Rates a support ticket after resolution.

**Path Parameters:**

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| ticket_id | integer | ✅ | Ticket ID |

**Query Parameters:**

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| rating | number (float) | ✅ | Rating score 1-5 |
| notes | string | ❌ | Additional rating notes |

**Response 200:**
```json
{
  "status_code": 200,
  "message": "تمت العملية بنجاح",
  "data": {}
}
```

**Errors:** 401, 404

---

### 8. Cities & Regions

---

#### GET `/delivery/price` — Get Delivery Prices

Returns delivery prices for cities and regions.

**Auth required:** Yes

**Query Parameters:**

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| region_id | integer | ❌ | Region ID |
| city_id | integer | ❌ | City ID |

**Response 200:**
```json
{
  "status_code": 200,
  "data": [
    {
      "city_id": 1,
      "city_name": "طرابلس",
      "sub_city_id": 1,
      "sub_city_name": "باب بن غشير",
      "price": 15,
      "region": "المنطقة الغربية"
    }
  ]
}
```

---

#### GET `/city/all` — Get All Cities

Returns list of all available cities.

**Auth required:** Yes | **No parameters.**

**Response 200:**
```json
{
  "status_code": 200,
  "data": [
    {
      "id": 1,
      "name": "طرابلس",
      "name_en": "Tripoli",
      "code": "TPL",
      "region_id": 1,
      "active": true
    }
  ]
}
```

---

## Schemas

### ApiResponse
```json
{
  "status_code": 200,
  "message": "تمت العملية بنجاح",
  "data": {},
  "errors": null
}
```

### ApiErrorResponse
```json
{
  "status_code": 422,
  "message": "خطأ في البيانات المدخلة",
  "data": null,
  "errors": { "email": ["البريد الإلكتروني مطلوب"] }
}
```

### User
| Field | Type | Nullable | Description |
|-------|------|----------|-------------|
| id | integer | No | User ID |
| name | string | No | Full name |
| email | string (email) | No | Email |
| phone | string | No | Phone number |
| city_id | integer | No | City ID |
| created_at | datetime | No | — |
| updated_at | datetime | No | — |
| store | Store | No | Associated store object |

### UserProfile
Extends User with:
| Field | Type | Nullable |
|-------|------|----------|
| address | string | No |
| avatar | string (URL) | Yes |
| email_verified_at | datetime | Yes |

### Store
| Field | Type | Nullable |
|-------|------|----------|
| id | integer | No |
| name | string | No |
| email | string (email) | No |
| phone | string | No |
| address | string | No |
| category | string | No |
| balance | float | No |
| created_at | datetime | No |
| updated_at | datetime | No |

### Package
| Field | Type | Nullable | Enum / Notes |
|-------|------|----------|--------------|
| id | integer | No | — |
| code | string | No | e.g. VNX123456 |
| receiver_name | string | No | — |
| phone | string | No | — |
| phone_b | string | Yes | Secondary phone |
| address | string | No | — |
| city | City | No | — |
| sub_city | SubCity | No | — |
| package_type | PackageType | No | — |
| description | string | Yes | — |
| notes | string | Yes | — |
| price | float | No | — |
| shipping_cost | float | No | — |
| total_amount | float | No | — |
| payment_method | string | No | `cash`, `prepaid`, `cod` |
| status | string | No | — |
| status_ar | string | No | — |
| dimensions | object | No | `{length, width, height}` |
| weight | float | No | — |
| fragile | boolean | No | — |
| urgent | boolean | No | — |
| created_at | datetime | No | — |
| updated_at | datetime | No | — |

### PackageDetails
Full package object as returned from the actual API (uses different field names than Package schema):

| Field | Type | Nullable | Notes |
|-------|------|----------|-------|
| id | integer | No | — |
| package-code | string | No | Format: `H-{storeId}-{cityCode}-{number}` |
| package_type | object | No | `{id, name, name_en, active, parent}` |
| package_sub_type | object | Yes | — |
| reciever | string | No | ⚠️ Typo in field name (not receiver) |
| phone | string | No | — |
| phone_b | string | Yes | — |
| address | string | No | — |
| price | float | No | — |
| origin_price | float | No | — |
| shippment | float | No | ⚠️ Typo in field name |
| total | float | No | — |
| extra_size_price | float | No | — |
| region_commission | float | No | — |
| payment_methode | string | No | ⚠️ Typo: methode not method |
| paid_by | string | No | — |
| extra_size_by | string | No | — |
| commission_by | string | No | — |
| courier_communication | integer | No | — |
| paid_by_ar | string | No | — |
| extra_size_by_ar | string | No | — |
| commission_by_ar | string | No | — |
| status | string | No | Arabic status text |
| status_object | object | No | `{id, status_value, status_name_admin, status_name_cust, status_log, notes}` |
| create_date | date | No | — |
| address_code | object | Yes | — |
| instore_date | datetime | No | — |
| delivery_date | datetime | No | — |
| update_date | datetime | No | — |
| qty | integer | No | — |
| qty_return | integer | No | — |
| recieved_money | float | No | — |
| description | string | No | — |
| non_delivery_reason | integer | No | — |
| non_delivery_text | string | No | — |
| leangh | integer | No | ⚠️ Typo in field name |
| width | integer | No | — |
| height | integer | No | — |
| City | object | No | `{id, name, code, name_en, region, price, est_time}` |
| sub_city | object | No | `{id, name}` |
| sender | object | No | `{id, name}` |
| created_at | datetime | No | — |
| updated_at | datetime | No | — |

### PackageLog
| Field | Type | Nullable |
|-------|------|----------|
| id | integer | No |
| package_id | integer | No |
| status | string | No |
| status_ar | string | No |
| description | string | No |
| location | string | Yes |
| created_at | datetime | No |
| admin | object `{id, name}` | Yes |

### PackageTracking
| Field | Type | Nullable |
|-------|------|----------|
| code | string | No |
| status | string | No |
| status_ar | string | No |
| receiver_name | string | No |
| current_location | string | Yes |
| estimated_delivery | date | Yes |
| logs | PackageLog[] | No |

### PackageType
| Field | Type |
|-------|------|
| id | integer |
| name | string |
| name_en | string |
| active | boolean |

### PackageStatus
| Field | Type |
|-------|------|
| id | integer |
| name | string |
| description | string |
| color | string (hex) |

### MoneyTransfer
| Field | Type | Nullable | Enum |
|-------|------|----------|------|
| id | integer | No | — |
| store_id | integer | No | — |
| user_id | integer | No | — |
| amount | float | No | — |
| offer_amount | float | Yes | — |
| status | string | No | `new`, `pending`, `approved`, `rejected`, `cancelled` |
| status_ar | string | No | — |
| store_notes | string | Yes | — |
| offer_notes | string | Yes | — |
| days | integer | Yes | — |
| hours | integer | Yes | — |
| created_at | datetime | No | — |
| updated_at | datetime | No | — |
| approved_at | datetime | Yes | — |
| rejected_at | datetime | Yes | — |
| payment_method | PaymentMethod | No | — |
| officer | object `{id, name}` | Yes | — |

### MoneyTransferDetails
Extends MoneyTransfer with:
| Field | Type |
|-------|------|
| store | Store |
| user | User |
| logs | MoneyTransferLog[] |

### MoneyTransferLog
| Field | Type |
|-------|------|
| id | integer |
| money_transfer_id | integer |
| user_id | integer |
| description | string |
| created_at | datetime |
| user | object `{id, name}` |

### Settlement
| Field | Type | Nullable | Enum |
|-------|------|----------|------|
| id | integer | No | — |
| store_id | integer | No | — |
| settlement_number | string | No | Format: SET-YYYY-NNN |
| total_amount | float | No | — |
| status | string | No | `pending`, `approved`, `rejected`, `paid` |
| status_ar | string | No | — |
| payment_method_id | integer | No | — |
| notes | string | Yes | — |
| created_at | datetime | No | — |
| updated_at | datetime | No | — |
| approved_at | datetime | Yes | — |
| paid_at | datetime | Yes | — |
| payment_method | PaymentMethod | No | — |

### SettlementDetails
Extends Settlement with:
| Field | Type |
|-------|------|
| packages | Package[] |
| store | Store |

### PaymentMethod
| Field | Type |
|-------|------|
| id | integer |
| name | string |
| name_en | string |
| active | boolean |

### StoreTransaction
| Field | Type | Nullable | Enum |
|-------|------|----------|------|
| id | integer | No | — |
| store_id | integer | No | — |
| type | string | No | `credit`, `debit`, `settlement`, `money_transfer`, `package_fee` |
| type_ar | string | No | — |
| amount | float | No | — |
| balance | float | No | Running balance after transaction |
| description | string | No | — |
| method | string | No | — |
| method_ar | string | No | — |
| status | string | No | `pending`, `approved`, `rejected` |
| date | datetime | No | — |
| created_at | datetime | No | — |
| package | Package | No | Associated package |

### Wallet
| Field | Type | Nullable | Enum |
|-------|------|----------|------|
| id | integer | No | — |
| user_id | integer | No | — |
| store_id | integer | No | — |
| wallet_type | string | No | — |
| currency_type | string | No | `LYD`, `USD`, `EUR` |
| currency_amount | float | No | — |
| expiry_at | datetime | Yes | — |
| created_at | datetime | No | — |
| updated_at | datetime | No | — |

### Notification
| Field | Type | Nullable | Enum |
|-------|------|----------|------|
| id | integer | No | — |
| user_id | integer | No | — |
| title | string | No | — |
| message | string | No | — |
| type | string | No | `package`, `money_transfer`, `settlement`, `general` |
| read | boolean | No | — |
| data | object | Yes | `{package_id, package_code}` |
| created_at | datetime | No | — |

### UserStatistics
| Field | Type |
|-------|------|
| total_packages | integer |
| delivered_packages | integer |
| pending_packages | integer |
| cancelled_packages | integer |
| total_spent | float |
| current_balance | float |
| this_month_packages | integer |
| this_month_spent | float |

### City
| Field | Type |
|-------|------|
| id | integer |
| name | string |
| name_en | string |
| code | string |
| region_id | integer |
| active | boolean |

### SubCity
| Field | Type |
|-------|------|
| id | integer |
| name | string |
| name_en | string |
| parent_city_id | integer |
| delivery_price | float |

### DeliveryPrice
| Field | Type |
|-------|------|
| city_id | integer |
| city_name | string |
| sub_city_id | integer |
| sub_city_name | string |
| price | float |
| region | string |

### Journey
| Field | Type | Enum |
|-------|------|------|
| id | integer | — |
| journey_code | string | — |
| driver_name | string | — |
| vehicle_number | string | — |
| origin_city | string | — |
| destination_city | string | — |
| departure_date | datetime | — |
| estimated_arrival | datetime | — |
| status | string | `pending`, `in_progress`, `completed`, `delayed` |

### Nationality
| Field | Type |
|-------|------|
| id | integer |
| name | string |
| code | string |

### PaginatedPackages
```json
{
  "status_code": 200,
  "message": "تمت العملية بنجاح",
  "data": {
    "data": [ /* PackageDetails[] */ ],
    "current_page": 1,
    "last_page": 10,
    "per_page": 15,
    "total": 150
  },
  "errors": null
}
```

### PackageDashboard
```json
{
  "status_code": 200,
  "data": {
    "total_packages": 150,
    "pending_packages": 25,
    "delivered_packages": 100,
    "cancelled_packages": 25,
    "total_revenue": 15000.5
  }
}
```

### SettlementCreationData
```json
{
  "status_code": 200,
  "data": {
    "available_balance": 5000,
    "minimum_settlement": 100,
    "settlement_fee": 10
  }
}
```

### CreateSettlementRequest
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| amount | float | ✅ | Settlement amount |
| notes | string | ❌ | Optional notes |

### PaginatedSettlements
```json
{
  "status_code": 200,
  "data": {
    "data": [ /* Settlement[] */ ],
    "current_page": 1,
    "last_page": 5,
    "per_page": 15,
    "total": 75
  }
}
```

### CreateWalletRequest
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| type | string | ✅ | Wallet type (e.g. `personal`) |
| currency | string | ✅ | `LYD`, `USD`, `EUR` |
| initial_balance | float | ❌ | Initial balance (default: 0) |

### PaginatedTransactions
```json
{
  "status_code": 200,
  "data": {
    "data": [ /* StoreTransaction[] */ ],
    "current_page": 1,
    "last_page": 8,
    "per_page": 15,
    "total": 120
  }
}
```

---

## Known Issues

| # | Endpoint | Issue | Details |
|---|----------|-------|---------|
| 1 | POST `/tickets` | 405 Method Not Allowed | Route is GET-only in production. Needs fix on server. |
| 2 | GET `/tickets` | 404 Not Found | Route returns "عنوان الصفحة خاطئ" — needs server fix. |
| 3 | GET `/apply-coupon` | Wrong param names | Docs say `coupon_code` & `package_value` but API expects `promo-code` & `pkg` |
| 4 | GET `/delivery-calculator` | Wrong param names | Docs show `from_region`, `to_city` etc. but API expects `region`, `destination`, `height`, `leangh`, `width` |
| 5 | Field typos in API | `reciever`, `leangh`, `payment_methode`, `shippment` | These typos exist in the actual API fields — must be used as-is |
| 6 | POST `/password-reset` | Returns 201 not 200 | Documented as 200 but actual response is 201 |
| 7 | Safe Storage schemas | Incomplete | Response `data: {}` has no documented structure for products/inventory |
| 8 | Safe Storage endpoints | Not fully documented | Missing response schema details for products and inventory |
| 9 | Store coupons response | Incomplete | Response `data: {}` has no documented structure |
| 10 | Support ticket POST endpoint | Auth route confusion | `/tickets` vs `/customer/tickets/{id}/rate` uses different base paths |

---

## Field Name Typos Reference

The following field names contain typos in the actual API — they must be used exactly as listed:

| Correct Name | Actual Field Name | Used In |
|-------------|-------------------|---------|
| receiver | `reciever` | Package create/details |
| length | `leangh` | Package dimensions |
| payment_method | `payment_methode` | Package payment |
| shipment | `shippment` | Package shipping cost |

---

*Documentation compiled from VanEx Logistics Swagger v1.0.0 — Production: https://app.vanex.ly/api/v1*
