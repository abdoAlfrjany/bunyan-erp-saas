// src/core/db/seed.ts
// الوظيفة: بيانات تجريبية شاملة لـ 5 متاجر — منظومة Bunyan
// الصلاحية: يُستخدم فقط في وضع Demo — يُستبدل بـ Supabase لاحقاً

// ═══════════════════════════════════════════
// INTERFACES — الأنواع الكاملة
// ═══════════════════════════════════════════

export * from '../types';
import {
  UserPermissions, TenantUser, Notification, Tenant, Product, Order, OrderItem,
  CourierCompany, Shipment, Partner, Employee, Debt, TreasuryAccount,
  TreasuryTransaction, Subscription
} from '../types';

export const FULL_OWNER_PERMISSIONS: UserPermissions = {
  inventory: { view: true, add: true, edit: true, delete: true, viewCostPrice: true },
  orders: { view: true, add: true, edit: true, delete: true, changeStatus: true, viewAll: true },
  delivery: { view: true, addShipment: true, manageCompanies: true, viewSettlements: true, addSettlement: true },
  treasury: { view: true, addTransaction: true },
  partners: { view: true, viewOwn: false },
  hr: { view: true, viewOwn: false },
  analytics: { view: true, viewFull: true },
  settings: { view: true, edit: true },
};

export const SALES_EMPLOYEE_PERMISSIONS: UserPermissions = {
  inventory: { view: true, add: false, edit: false, delete: false, viewCostPrice: false },
  orders: { view: true, add: true, edit: false, delete: false, changeStatus: true, viewAll: false },
  delivery: { view: true, addShipment: true, manageCompanies: false, viewSettlements: false, addSettlement: false },
  treasury: { view: false, addTransaction: false },
  partners: { view: false, viewOwn: false },
  hr: { view: false, viewOwn: true },
  analytics: { view: false, viewFull: false },
  settings: { view: false, edit: false },
};

export const PARTNER_PERMISSIONS: UserPermissions = {
  inventory: { view: true, add: false, edit: false, delete: false, viewCostPrice: false },
  orders: { view: true, add: true, edit: false, delete: false, changeStatus: true, viewAll: false },
  delivery: { view: true, addShipment: false, manageCompanies: false, viewSettlements: false, addSettlement: false },
  treasury: { view: false, addTransaction: false },
  partners: { view: false, viewOwn: true },
  hr: { view: false, viewOwn: false },
  analytics: { view: true, viewFull: false },
  settings: { view: false, edit: false },
};

// Types are now imported from ../types

// ═══════════════════════════════════════════
// SEED DATA
// ═══════════════════════════════════════════

const T1 = 'tenant-001', T2 = 'tenant-002', T3 = 'tenant-003', T4 = 'tenant-004', T5 = 'tenant-005';

// ═══ المتاجر ═══
export const SEED_TENANTS: Tenant[] = [
  { id: T1, name: 'متجر الأمين للإلكترونيات', ownerEmail: 'ahmed@alamin.ly', ownerName: 'أحمد الأمين', ownerPhone: '0911234567', plan: 'pro', planExpiresAt: '2026-12-31', isActive: true, city: 'طرابلس', createdAt: '2024-01-15', billingModel: 'pre_paid', website: 'alamin.ly', categories: ['هواتف', 'لابتوبات', 'إكسسوارات', 'إلكترونيات'] },
  { id: T2, name: 'سوبرماركت الفرجاني', ownerEmail: 'm.farjani@gmail.com', ownerName: 'محمد الفرجاني', ownerPhone: '0922345678', plan: 'basic', planExpiresAt: '2026-06-30', isActive: true, city: 'بنغازي', createdAt: '2024-03-08', billingModel: 'post_paid', website: 'farjani.ly', categories: ['أغذية', 'حليب', 'مشروبات', 'تنظيف'] },
  { id: T3, name: 'متجر البركة للملابس', ownerEmail: 's.baraka@baraka.ly', ownerName: 'سالم البركة', ownerPhone: '0913456789', plan: 'pro', planExpiresAt: '2026-09-15', isActive: true, city: 'مصراتة', createdAt: '2024-06-22', billingModel: 'pre_paid', website: 'baraka.ly', categories: ['رجالي', 'نسائي', 'أطفال', 'رياضي'] },
  { id: T4, name: 'محل العروبة للأجهزة', ownerEmail: 'k.arouba@gmail.com', ownerName: 'خالد العروبة', ownerPhone: '0924567890', plan: 'basic', planExpiresAt: '2025-12-01', isActive: false, city: 'الزاوية', createdAt: '2024-02-10', billingModel: 'post_paid', categories: ['غسالات', 'ثلاجات', 'مكيفات', 'أفران'] },
  { id: T5, name: 'متجر الوفاء للعطور', ownerEmail: 'f.wafaa@wafaa.ly', ownerName: 'فاطمة الوفاء', ownerPhone: '0915678901', plan: 'lifetime', planExpiresAt: '2099-12-31', isActive: true, city: 'سبها', createdAt: '2024-04-05', billingModel: 'pre_paid', website: 'wafaa.ly', categories: ['عود', 'بخور', 'مسك', 'دهن', 'هدايا'] },
];

// ═══ المستخدمون — مع صلاحيات حقيقية ═══
export const SEED_USERS: TenantUser[] = [
  // Tenant 1 — متجر الأمين
  { id: 'user-owner-1', tenantId: T1, fullName: 'أحمد الأمين', email: 'ahmed@alamin.ly', passwordHash: btoa('Admin@123'), permissions: FULL_OWNER_PERMISSIONS, isActive: true, createdAt: '2024-01-15', phone: '0911234567', role: 'owner' },
  { id: 'user-emp-1', tenantId: T1, fullName: 'محمد علي', email: 'mohammed@alamin.ly', passwordHash: btoa('Emp@123'), permissions: SALES_EMPLOYEE_PERMISSIONS, isActive: true, createdAt: '2024-02-01', phone: '0911000001', role: 'employee' },
  { id: 'user-partner-1', tenantId: T1, fullName: 'عبدالله سالم', email: 'partner1@alamin.ly', passwordHash: btoa('Part@123'), permissions: PARTNER_PERMISSIONS, isActive: true, createdAt: '2024-01-15', phone: '0911001001', role: 'partner' },
  // Tenant 2 — الفرجاني
  { id: 'user-owner-2', tenantId: T2, fullName: 'محمد الفرجاني', email: 'm.farjani@gmail.com', passwordHash: btoa('Admin@123'), permissions: FULL_OWNER_PERMISSIONS, isActive: true, createdAt: '2024-03-08', phone: '0922345678', role: 'owner' },
  { id: 'user-emp-2', tenantId: T2, fullName: 'سارة العبيدي', email: 'sara@farjani.ly', passwordHash: btoa('Emp@123'), permissions: SALES_EMPLOYEE_PERMISSIONS, isActive: true, createdAt: '2024-04-01', phone: '0922000001', role: 'employee' },
  // Tenant 3 — البركة
  { id: 'user-owner-3', tenantId: T3, fullName: 'سالم البركة', email: 's.baraka@baraka.ly', passwordHash: btoa('Admin@123'), permissions: FULL_OWNER_PERMISSIONS, isActive: true, createdAt: '2024-06-22', phone: '0913456789', role: 'owner' },
  // Tenant 4 — العروبة (موقوف)
  { id: 'user-owner-4', tenantId: T4, fullName: 'خالد العروبة', email: 'k.arouba@gmail.com', passwordHash: btoa('Admin@123'), permissions: FULL_OWNER_PERMISSIONS, isActive: false, createdAt: '2024-02-10', phone: '0924567890', role: 'owner' },
  // Tenant 5 — الوفاء
  { id: 'user-owner-5', tenantId: T5, fullName: 'فاطمة الوفاء', email: 'f.wafaa@wafaa.ly', passwordHash: btoa('Admin@123'), permissions: FULL_OWNER_PERMISSIONS, isActive: true, createdAt: '2024-04-05', phone: '0915678901', role: 'owner' },
];

// ═══ الإشعارات الأولية ═══
export const SEED_NOTIFICATIONS: Notification[] = [
  { id: 'notif-1', tenantId: T1, type: 'warning', title: 'مخزون منخفض', message: 'المنتج "لابتوب Lenovo ThinkPad" وصل للحد الأدنى (8 قطعة)', isRead: false, createdAt: new Date(Date.now() - 10 * 60000).toISOString(), link: '/inventory' },
  { id: 'notif-2', tenantId: T1, type: 'info', title: 'طلبية جديدة', message: 'طلبية جديدة ORD-2025-0016 من أحمد محمد', isRead: false, createdAt: new Date(Date.now() - 45 * 60000).toISOString(), link: '/orders' },
  { id: 'notif-3', tenantId: T1, type: 'warning', title: 'مرتجع معلق', message: 'طلبية ORD-2025-0009 في انتظار تأكيد الإرجاع', isRead: true, createdAt: new Date(Date.now() - 2 * 3600000).toISOString(), link: '/orders' },
];

// ═══ المنتجات ═══
export const SEED_PRODUCTS: Product[] = [
  // متجر الأمين — إلكترونيات
  { id: 'p-101', tenantId: T1, name: 'آيفون 15 برو', category: 'هواتف', unit: 'قطعة', costPrice: 3200, sellingPrice: 3800, quantity: 25, minQuantity: 5, isActive: true, itemCode: '1000', productType: 'simple' },
  { id: 'p-102', tenantId: T1, name: 'سامسونغ S24 ألترا', category: 'هواتف', unit: 'قطعة', costPrice: 2800, sellingPrice: 3400, quantity: 18, minQuantity: 5, isActive: true, itemCode: '1001', productType: 'simple' },
  { id: 'p-103', tenantId: T1, name: 'لابتوب HP Pavilion', category: 'لابتوبات', unit: 'قطعة', costPrice: 2200, sellingPrice: 2700, quantity: 12, minQuantity: 3, isActive: true, itemCode: '1002', productType: 'simple' },
  { id: 'p-104', tenantId: T1, name: 'سماعات AirPods Pro', category: 'إكسسوارات', unit: 'قطعة', costPrice: 450, sellingPrice: 580, quantity: 40, minQuantity: 10, isActive: true, itemCode: '1003', productType: 'simple' },
  { id: 'p-105', tenantId: T1, name: 'شاحن سريع 65W', category: 'إكسسوارات', unit: 'قطعة', costPrice: 35, sellingPrice: 55, quantity: 100, minQuantity: 20, isActive: true, itemCode: '1004', productType: 'simple' },
  { id: 'p-106', tenantId: T1, name: 'كيبل USB-C 2m', category: 'إكسسوارات', unit: 'قطعة', costPrice: 8, sellingPrice: 15, quantity: 200, minQuantity: 50, isActive: true, itemCode: '1005', productType: 'simple' },
  { id: 'p-107', tenantId: T1, name: 'حافظة آيفون 15', category: 'إكسسوارات', unit: 'قطعة', costPrice: 12, sellingPrice: 25, quantity: 80, minQuantity: 20, isActive: true, itemCode: '1006', productType: 'simple' },
  { id: 'p-108', tenantId: T1, name: 'لابتوب Lenovo ThinkPad', category: 'لابتوبات', unit: 'قطعة', costPrice: 1800, sellingPrice: 2200, quantity: 3, minQuantity: 3, isActive: true, itemCode: '1007', productType: 'simple' },
  // سوبرماركت الفرجاني
  { id: 'p-201', tenantId: T2, name: 'أرز بسمتي 5 كيلو', category: 'أغذية', unit: 'كيس', costPrice: 18, sellingPrice: 24, quantity: 150, minQuantity: 30, isActive: true, itemCode: '1008', productType: 'simple' },
  { id: 'p-202', tenantId: T2, name: 'زيت زيتون 1 لتر', category: 'أغذية', unit: 'زجاجة', costPrice: 22, sellingPrice: 30, quantity: 80, minQuantity: 20, isActive: true, itemCode: '1009', productType: 'simple' },
  { id: 'p-203', tenantId: T2, name: 'سكر 1 كيلو', category: 'أغذية', unit: 'كيس', costPrice: 4, sellingPrice: 5, quantity: 300, minQuantity: 50, isActive: true, itemCode: '1010', productType: 'simple' },
  { id: 'p-204', tenantId: T2, name: 'حليب أطفال NAN', category: 'حليب', unit: 'علبة', costPrice: 28, sellingPrice: 35, quantity: 60, minQuantity: 15, isActive: true, itemCode: '1011', productType: 'simple' },
  { id: 'p-205', tenantId: T2, name: 'معكرونة 500g', category: 'أغذية', unit: 'كيس', costPrice: 3, sellingPrice: 4, quantity: 200, minQuantity: 40, isActive: true, itemCode: '1012', productType: 'simple' },
  { id: 'p-206', tenantId: T2, name: 'شاي ليبتون 100 كيس', category: 'مشروبات', unit: 'علبة', costPrice: 12, sellingPrice: 16, quantity: 45, minQuantity: 10, isActive: true, itemCode: '1013', productType: 'simple' },
  { id: 'p-207', tenantId: T2, name: 'قهوة تركية 250g', category: 'مشروبات', unit: 'علبة', costPrice: 15, sellingPrice: 20, quantity: 35, minQuantity: 10, isActive: true, itemCode: '1014', productType: 'simple' },
  { id: 'p-208', tenantId: T2, name: 'صابون غسيل 3 لتر', category: 'تنظيف', unit: 'عبوة', costPrice: 8, sellingPrice: 12, quantity: 70, minQuantity: 15, isActive: true, itemCode: '1015', productType: 'simple' },
  // متجر البركة — ملابس (مع مقاسات)
  { id: 'p-301', tenantId: T3, name: 'ثوب رجالي كلاسيك', category: 'رجالي', unit: 'قطعة', costPrice: 65, sellingPrice: 95, quantity: 30, minQuantity: 10, isActive: true, itemCode: '1016', productType: 'clothing', variants: [{ id: 'var-1', size: 'M', quantity: 15 }, { id: 'var-2', size: 'L', quantity: 10 }, { id: 'var-3', size: 'XL', quantity: 5 }] },
  { id: 'p-302', tenantId: T3, name: 'قميص رسمي أبيض', category: 'رجالي', unit: 'قطعة', costPrice: 35, sellingPrice: 55, quantity: 45, minQuantity: 10, isActive: true, itemCode: '1017', productType: 'clothing', variants: [{ id: 'var-4', size: 'S', quantity: 10 }, { id: 'var-5', size: 'M', quantity: 20 }, { id: 'var-6', size: 'L', quantity: 15 }] },
  { id: 'p-303', tenantId: T3, name: 'جلابية نسائية مطرزة', category: 'نسائي', unit: 'قطعة', costPrice: 85, sellingPrice: 130, quantity: 20, minQuantity: 5, isActive: true, itemCode: '1018', productType: 'clothing', variants: [{ id: 'var-7', size: 'L', quantity: 10 }, { id: 'var-8', size: 'XL', quantity: 10 }] },
  { id: 'p-304', tenantId: T3, name: 'حجاب قطن تركي', category: 'نسائي', unit: 'قطعة', costPrice: 12, sellingPrice: 22, quantity: 100, minQuantity: 25, isActive: true, itemCode: '1019', productType: 'clothing', variants: [{ id: 'var-9', size: 'One Size', quantity: 100 }] },
  { id: 'p-305', tenantId: T3, name: 'بنطلون جينز', category: 'رجالي', unit: 'قطعة', costPrice: 40, sellingPrice: 65, quantity: 35, minQuantity: 10, isActive: true, itemCode: '1020', productType: 'clothing', variants: [{ id: 'var-10', size: '32', quantity: 15 }, { id: 'var-11', size: '34', quantity: 20 }] },
  { id: 'p-306', tenantId: T3, name: 'فستان أطفال', category: 'أطفال', unit: 'قطعة', costPrice: 25, sellingPrice: 42, quantity: 50, minQuantity: 15, isActive: true, itemCode: '1021', productType: 'clothing', variants: [{ id: 'var-12', size: '4-6', quantity: 25 }, { id: 'var-13', size: '6-8', quantity: 25 }] },
  { id: 'p-307', tenantId: T3, name: 'جاكيت شتوي', category: 'رجالي', unit: 'قطعة', costPrice: 75, sellingPrice: 120, quantity: 15, minQuantity: 5, isActive: true, itemCode: '1022', productType: 'clothing', variants: [{ id: 'var-14', size: 'L', quantity: 5 }, { id: 'var-15', size: 'XL', quantity: 5 }, { id: 'var-16', size: 'XXL', quantity: 5 }] },
  { id: 'p-308', tenantId: T3, name: 'طقم رياضي', category: 'رياضي', unit: 'طقم', costPrice: 45, sellingPrice: 70, quantity: 25, minQuantity: 8, isActive: true, itemCode: '1023', productType: 'clothing', variants: [{ id: 'var-17', size: 'M', quantity: 15 }, { id: 'var-18', size: 'L', quantity: 10 }] },
  // العروبة — أجهزة
  { id: 'p-401', tenantId: T4, name: 'غسالة LG 8 كيلو', category: 'غسالات', unit: 'قطعة', costPrice: 1200, sellingPrice: 1500, quantity: 6, minQuantity: 2, isActive: true, itemCode: '1024', productType: 'simple' },
  { id: 'p-402', tenantId: T4, name: 'ثلاجة Samsung 18 قدم', category: 'ثلاجات', unit: 'قطعة', costPrice: 2000, sellingPrice: 2500, quantity: 4, minQuantity: 2, isActive: true, itemCode: '1025', productType: 'simple' },
  { id: 'p-403', tenantId: T4, name: 'مكيف سبليت 1.5 طن', category: 'مكيفات', unit: 'قطعة', costPrice: 1500, sellingPrice: 1900, quantity: 8, minQuantity: 3, isActive: true, itemCode: '1026', productType: 'simple' },
  { id: 'p-404', tenantId: T4, name: 'فرن كهربائي 60 لتر', category: 'أفران', unit: 'قطعة', costPrice: 350, sellingPrice: 450, quantity: 10, minQuantity: 3, isActive: true, itemCode: '1027', productType: 'simple' },
  { id: 'p-405', tenantId: T4, name: 'مكنسة كهربائية', category: 'تنظيف', unit: 'قطعة', costPrice: 180, sellingPrice: 250, quantity: 12, minQuantity: 4, isActive: true, itemCode: '1028', productType: 'simple' },
  { id: 'p-406', tenantId: T4, name: 'خلاط كهربائي', category: 'مطبخ', unit: 'قطعة', costPrice: 80, sellingPrice: 120, quantity: 20, minQuantity: 5, isActive: true, itemCode: '1029', productType: 'simple' },
  { id: 'p-407', tenantId: T4, name: 'مروحة سقف', category: 'تبريد', unit: 'قطعة', costPrice: 60, sellingPrice: 90, quantity: 15, minQuantity: 5, isActive: true, itemCode: '1030', productType: 'simple' },
  { id: 'p-408', tenantId: T4, name: 'سخان مياه 50 لتر', category: 'سخانات', unit: 'قطعة', costPrice: 280, sellingPrice: 380, quantity: 7, minQuantity: 2, isActive: true, itemCode: '1031', productType: 'simple' },
  // الوفاء — عطور
  { id: 'p-501', tenantId: T5, name: 'عطر عود ملكي 100ml', category: 'عود', unit: 'قطعة', costPrice: 120, sellingPrice: 185, quantity: 35, minQuantity: 10, isActive: true, itemCode: '1032', productType: 'simple' },
  { id: 'p-502', tenantId: T5, name: 'بخور عود كمبودي', category: 'بخور', unit: 'علبة', costPrice: 45, sellingPrice: 75, quantity: 50, minQuantity: 15, isActive: true, itemCode: '1033', productType: 'simple' },
  { id: 'p-503', tenantId: T5, name: 'عطر مسك أبيض 50ml', category: 'مسك', unit: 'قطعة', costPrice: 30, sellingPrice: 55, quantity: 60, minQuantity: 20, isActive: true, itemCode: '1034', productType: 'simple' },
  { id: 'p-504', tenantId: T5, name: 'دهن عود هندي', category: 'دهن', unit: 'تولة', costPrice: 200, sellingPrice: 320, quantity: 15, minQuantity: 5, isActive: true, itemCode: '1035', productType: 'simple' },
  { id: 'p-505', tenantId: T5, name: 'معمول بخور فاخر', category: 'بخور', unit: 'علبة', costPrice: 55, sellingPrice: 90, quantity: 40, minQuantity: 10, isActive: true, itemCode: '1036', productType: 'simple' },
  { id: 'p-506', tenantId: T5, name: 'عطر فرنسي نسائي', category: 'فرنسي', unit: 'قطعة', costPrice: 85, sellingPrice: 140, quantity: 28, minQuantity: 8, isActive: true, itemCode: '1037', productType: 'simple' },
  { id: 'p-507', tenantId: T5, name: 'مبخرة خشبية كلاسيك', category: 'مباخر', unit: 'قطعة', costPrice: 35, sellingPrice: 60, quantity: 20, minQuantity: 5, isActive: true, itemCode: '1038', productType: 'simple' },
  { id: 'p-508', tenantId: T5, name: 'طقم عطور هدية', category: 'هدايا', unit: 'طقم', costPrice: 150, sellingPrice: 250, quantity: 12, minQuantity: 3, isActive: true, itemCode: '1039', productType: 'simple' },
];;

// ═══ شركات التوصيل ═══
function courierForTenant(tenantId: string, idx: number): CourierCompany[] {
  const prefix = tenantId.split('-')[1];
  return [
    {
      id: `cc-${prefix}-1`, tenantId, name: 'شركة سريع للتوصيل', shortCode: 'SRQ',
      merchantCode: `SRQ-${prefix}`, contactPhone: '0911111111', contactPerson: 'علي أحمد',
      defaultDeliveryFee: 15, isActive: true,
      cities: ['طرابلس', 'بنغازي', 'مصراتة', 'الزاوية', 'الخمس'],
      pricingZones: [{ zone: 'طرابلس', fee: 15 }, { zone: 'بنغازي', fee: 20 }, { zone: 'مصراتة', fee: 18 }],
      requiredFields: [
        { key: 'awb', label: 'رقم التتبع AWB', type: 'text', required: true },
        { key: 'cod_amount', label: 'مبلغ الدفع عند الاستلام', type: 'number', required: true },
      ],
      totalShipments: 45 + idx * 10, totalDelivered: 38 + idx * 8, totalReturned: 4 + idx, pendingAmount: 5200 + idx * 1000,
    },
    {
      id: `cc-${prefix}-2`, tenantId, name: 'شركة رامي للشحن', shortCode: 'RMC',
      merchantCode: `RMC-${prefix}`, contactPhone: '0922222222', contactPerson: 'محمد رامي',
      defaultDeliveryFee: 12, isActive: true,
      cities: ['طرابلس', 'جنزور', 'تاجوراء', 'بنغازي', 'سرت', 'مصراتة'],
      pricingZones: [{ zone: 'طرابلس', fee: 12 }, { zone: 'بنغازي', fee: 18 }, { zone: 'مصراتة', fee: 15 }],
      requiredFields: [
        { key: 'shipment_no', label: 'رقم الشحنة', type: 'text', required: true },
        { key: 'recipient', label: 'اسم المستلم', type: 'text', required: true },
      ],
      totalShipments: 30 + idx * 5, totalDelivered: 25 + idx * 4, totalReturned: 3 + idx, pendingAmount: 3800 + idx * 500,
    },
    {
      id: `cc-${prefix}-3`, tenantId, name: 'شركة الإيفاء', shortCode: 'EFA',
      merchantCode: `EFA-${prefix}`, contactPhone: '0913333333', contactPerson: 'سالم الإيفاء',
      defaultDeliveryFee: 10, isActive: true,
      cities: ['طرابلس', 'بنغازي', 'سبها', 'غريان'],
      pricingZones: [{ zone: 'طرابلس', fee: 10 }, { zone: 'بنغازي', fee: 15 }, { zone: 'سبها', fee: 25 }],
      requiredFields: [{ key: 'tracking_code', label: 'كود التتبع', type: 'text', required: true }],
      totalShipments: 20 + idx * 3, totalDelivered: 16 + idx * 2, totalReturned: 2, pendingAmount: 3300 + idx * 400,
    },
  ];
}

export const SEED_COURIERS: CourierCompany[] = [
  ...courierForTenant(T1, 0), ...courierForTenant(T2, 1), ...courierForTenant(T3, 2),
  ...courierForTenant(T4, 3), ...courierForTenant(T5, 4),
];

// ═══ الشركاء ═══
function partnersForTenant(tid: string, idx: number): Partner[] {
  const names = [
    ['عبدالله سالم', '0911001001', 'partner1@alamin.ly', 40, 50000],
    ['يوسف إبراهيم', '0922002002', 'partner2@alamin.ly', 35, 30000],
    ['مصطفى عمر', '0913003003', 'partner3@alamin.ly', 25, 20000],
  ] as const;
  return names.map((n, i) => ({
    id: `ptr-${tid.split('-')[1]}-${i + 1}`, tenantId: tid,
    name: n[0] as string, phone: n[1] as string, email: n[2] as string,
    profitPercentage: n[3] as number, capitalContribution: n[4] as number,
    walletBalance: 1200 + i * 500 + idx * 300,
    debtBalance: i === 2 ? 500 + idx * 100 : 0, isActive: true, partnerRole: 'active_partner', joinedAt: '2024-01-15',
    userId: i === 0 ? `user-partner-${tid.split('-')[1]}` : undefined,
  }));
}

export const SEED_PARTNERS: Partner[] = [
  ...partnersForTenant(T1, 0), ...partnersForTenant(T2, 1), ...partnersForTenant(T3, 2),
  ...partnersForTenant(T4, 3), ...partnersForTenant(T5, 4),
];

// ═══ الموظفون ═══
function employeesForTenant(tid: string, idx: number): Employee[] {
  return [
    { id: `emp-${tid.split('-')[1]}-1`, tenantId: tid, name: `موظف خدمة عملاء ${idx + 1}`, phone: `091400${idx}001`, email: `cs${idx + 1}@store.ly`, salary: 800 + idx * 50, startDate: '2024-03-01', salaryDay: 1, advanceBalance: idx * 100, allowanceBalance: 0, deductionBalance: 0, isActive: true, status: 'active', hasSystemAccess: true, employmentType: 'full_time', jobTitle: 'خدمة عملاء', userId: `user-emp-${tid.split('-')[1]}`, lastPayrollDate: '2025-01' },
    { id: `emp-${tid.split('-')[1]}-2`, tenantId: tid, name: `موظف مبيعات ${idx + 1}`, phone: `091400${idx}002`, email: `sales${idx + 1}@store.ly`, salary: 750 + idx * 50, startDate: '2024-05-15', salaryDay: 1, advanceBalance: 0, allowanceBalance: 0, deductionBalance: 0, isActive: true, status: 'active', hasSystemAccess: true, employmentType: 'full_time', jobTitle: 'مبيعات', lastPayrollDate: '2025-01' },
  ];
}

export const SEED_EMPLOYEES: Employee[] = [
  ...employeesForTenant(T1, 0), ...employeesForTenant(T2, 1), ...employeesForTenant(T3, 2),
  ...employeesForTenant(T4, 3), ...employeesForTenant(T5, 4),
];

// ═══ الطلبيات ═══
const statuses: Order['status'][] = ['pending', 'processing', 'processing', 'with_courier', 'delivered', 'delivered', 'delivered', 'cancelled', 'pending_return', 'delivered', 'with_courier', 'processing', 'delivered', 'pending', 'delivered'];
const cities = ['طرابلس', 'بنغازي', 'مصراتة', 'الزاوية', 'سبها', 'زليتن', 'الخمس', 'سرت'];
const customerNames = ['أحمد محمد', 'سالم علي', 'فاطمة كامل', 'مريم خالد', 'عمر يوسف', 'هدى سعيد', 'محمد عبدالله', 'نورة إبراهيم', 'خالد أحمد', 'ليلى عمر', 'يوسف سالم', 'آمنة محمد', 'إبراهيم علي', 'سعاد كمال', 'حسن مصطفى'];

function ordersForTenant(tid: string): Order[] {
  const products = SEED_PRODUCTS.filter(p => p.tenantId === tid);
  return Array.from({ length: 15 }, (_, i) => {
    const p1 = products[i % products.length];
    const p2 = products[(i + 3) % products.length];
    const qty1 = 1 + (i % 3);
    const qty2 = i % 4 === 0 ? 1 : 0;
    const sub = p1.sellingPrice * qty1 + (qty2 > 0 ? p2.sellingPrice * qty2 : 0);
    const disc = i % 5 === 0 ? Math.round(sub * 0.05) : 0;
    const fee = 15;
    const items: OrderItem[] = [
      { id: `oi-${tid}-${i}-1`, productId: p1.id, productName: p1.name, quantity: qty1, unitPrice: p1.sellingPrice, unitCost: p1.costPrice, total: p1.sellingPrice * qty1 },
    ];
    if (qty2 > 0) items.push({ id: `oi-${tid}-${i}-2`, productId: p2.id, productName: p2.name, quantity: qty2, unitPrice: p2.sellingPrice, unitCost: p2.costPrice, total: p2.sellingPrice * qty2 });
    const s = statuses[i];
    const ps = s === 'delivered' ? 'settled_to_treasury' as const : s === 'with_courier' ? 'with_courier_company' as const : 'pending' as const;
    return {
      id: `ord-${tid}-${String(i + 1).padStart(3, '0')}`, tenantId: tid,
      orderNumber: `ORD-2025-${String(i + 1).padStart(4, '0')}`,
      customerName: customerNames[i], customerPhone: `091${String(1000000 + i * 111111)}`,
      customerCity: cities[i % cities.length], deliveryType: 'courier_company' as const,
      courierCompanyId: SEED_COURIERS.find(c => c.tenantId === tid)?.id,
      deliveryFee: fee, status: s, subtotal: sub, discount: disc, total: sub - disc + fee,
      paymentStatus: ps, items, priceIncludesDelivery: false, source: 'direct',
      createdAt: `2025-0${1 + (i % 2)}-${String(5 + i).padStart(2, '0')}`,
    };
  });
}

export const SEED_ORDERS: Order[] = [
  ...ordersForTenant(T1), ...ordersForTenant(T2), ...ordersForTenant(T3),
  ...ordersForTenant(T4), ...ordersForTenant(T5),
];

// ═══ الزبائن ═══
function customersForTenant(tid: string): import('../types').Customer[] {
  return customerNames.slice(0, 5).map((name, i) => ({
    id: `cust-${tid}-${i}`,
    tenantId: tid,
    name: name,
    phone: `091${String(1000000 + i * 111111)}`,
    city: cities[i % cities.length],
    address: 'وسط المدينة',
    totalOrders: 3,
    createdAt: '2024-10-01'
  }));
}

export const SEED_CUSTOMERS: import('../types').Customer[] = [
  ...customersForTenant(T1), ...customersForTenant(T2), ...customersForTenant(T3),
  ...customersForTenant(T4), ...customersForTenant(T5),
];

// ═══ الديون ═══
function debtsForTenant(tid: string, idx: number): Debt[] {
  return [
    { id: `dbt-${tid}-1`, tenantId: tid, debtType: 'external', debtCategory: 'supplier', linkedEntityName: SEED_TENANTS[idx]?.name || 'مورد البضاعة الرئيسي', linkedEntityType: 'supplier', linkedEntityId: `dmy-${Date.now()}`, paymentHistory: [], amount: 15000 + idx * 2000, paidAmount: 5000 + idx * 1000, dueDate: '2025-04-15', status: 'partial', description: 'فاتورة توريد بضاعة', createdAt: '2025-01-10' },
    { id: `dbt-${tid}-2`, tenantId: tid, debtType: 'external', debtCategory: 'customer', linkedEntityName: 'زبون أحمد', linkedEntityType: 'supplier', linkedEntityId: `dmy-${Date.now()}`, paymentHistory: [], amount: 2500 + idx * 300, paidAmount: 0, dueDate: '2025-03-30', status: 'active', description: 'بيع آجل', createdAt: '2025-02-01' },
    { id: `dbt-${tid}-3`, tenantId: tid, debtType: 'internal', debtCategory: 'employee_advance', linkedEntityName: `موظف خدمة عملاء ${idx + 1}`, linkedEntityType: 'supplier', linkedEntityId: `dmy-${Date.now()}`, paymentHistory: [], amount: 500 + idx * 100, paidAmount: 200, dueDate: '2025-03-01', status: 'partial', description: 'سلفة راتب', createdAt: '2025-02-15' },
  ];
}

export const SEED_DEBTS: Debt[] = [
  ...debtsForTenant(T1, 0), ...debtsForTenant(T2, 1), ...debtsForTenant(T3, 2),
  ...debtsForTenant(T4, 3), ...debtsForTenant(T5, 4),
];

// ═══ الخزينة ═══
function treasuryForTenant(tid: string, idx: number): TreasuryAccount[] {
  const couriers = SEED_COURIERS.filter(c => c.tenantId === tid);
  return [
    { id: `ta-${tid}-cash`, tenantId: tid, accountType: 'cash_in_hand', accountName: 'النقد الفعلي بالخزينة', balance: 45000 + idx * 8000 },
    ...couriers.map((c, i) => ({
      id: `ta-${tid}-c${i + 1}`, tenantId: tid, accountType: 'with_courier' as const,
      accountName: `قيد التحصيل — ${c.name}`, balance: c.pendingAmount, linkedCourierId: c.id,
    })),
  ];
}

export const SEED_TREASURY: TreasuryAccount[] = [
  ...treasuryForTenant(T1, 0), ...treasuryForTenant(T2, 1), ...treasuryForTenant(T3, 2),
  ...treasuryForTenant(T4, 3), ...treasuryForTenant(T5, 4),
];

// ═══ حركات الخزينة ═══
function txForTenant(tid: string, idx: number): TreasuryTransaction[] {
  const cashId = `ta-${tid}-cash`;
  return [
    { id: `tt-${tid}-1`, tenantId: tid, accountId: cashId, transactionType: 'income', amount: 100000 + idx * 20000, description: 'ضخ رأس مال مؤسس', createdAt: '2024-01-15', transactionDate: '2024-01-15' },
    { id: `tt-${tid}-2`, tenantId: tid, accountId: cashId, transactionType: 'income', amount: 25000 + idx * 3000, description: 'تحصيل طلبيات الشهر', createdAt: '2025-02-01', transactionDate: '2025-02-01' },
    { id: `tt-${tid}-3`, tenantId: tid, accountId: cashId, transactionType: 'courier_settlement', amount: 18000 + idx * 2000, description: 'تسوية شركة سريع — فبراير', createdAt: '2025-02-15', transactionDate: '2025-02-15' },
    { id: `tt-${tid}-4`, tenantId: tid, accountId: cashId, transactionType: 'expense', amount: -(3500 + idx * 500), description: 'إيجار المحل + مصاريف', createdAt: '2025-02-28', transactionDate: '2025-02-28' },
  ];
}

export const SEED_TRANSACTIONS: TreasuryTransaction[] = [
  ...txForTenant(T1, 0), ...txForTenant(T2, 1), ...txForTenant(T3, 2),
  ...txForTenant(T4, 3), ...txForTenant(T5, 4),
];

// ═══ الاشتراكات ═══
export const SEED_SUBSCRIPTIONS: Subscription[] = SEED_TENANTS.map((t) => ({
  id: `sub-${t.id}`, tenantId: t.id, plan: t.plan,
  amount: t.plan === 'pro' ? 150 : t.plan === 'basic' ? 75 : t.plan === 'lifetime' ? 500 : 0,
  periodFrom: '2025-01-01', periodTo: '2025-12-31',
  status: t.isActive ? 'paid' as const : 'overdue' as const,
  paidAt: t.isActive ? '2025-01-05' : undefined,
}));
