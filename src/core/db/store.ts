// src/core/db/store.ts
// الوظيفة: Zustand data store مركزي — Bunyan ERP
// يحمّل seed data ويوفر CRUD لكل الجداول
// يُستبدل بـ React Query + Supabase عند الربط

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import {
  SEED_TENANTS, SEED_PRODUCTS, SEED_ORDERS, SEED_COURIERS,
  SEED_PARTNERS, SEED_EMPLOYEES, SEED_DEBTS, SEED_TREASURY,
  SEED_TRANSACTIONS, SEED_SUBSCRIPTIONS, SEED_USERS, SEED_NOTIFICATIONS,
  SEED_CUSTOMERS
} from './seed';
import {
  type Tenant, type Product, type Order, type CourierCompany,
  type Partner, type Employee, type Debt, type TreasuryAccount,
  type TreasuryTransaction, type Subscription, type TenantUser, type Notification,
  type Customer, type SystemAnnouncement, type AuditLog
} from '../types';
import { generateItemCode } from '../utils';

interface DataState {
  tenants: Tenant[];
  products: Product[];
  orders: Order[];
  couriers: CourierCompany[];
  partners: Partner[];
  employees: Employee[];
  debts: Debt[];
  treasury: TreasuryAccount[];
  transactions: TreasuryTransaction[];
  subscriptions: Subscription[];
  users: TenantUser[];
  notifications: Notification[];
  customers: Customer[];
  announcements: SystemAnnouncement[];
  auditLogs: AuditLog[];

  // Tenant-filtered getter
  getForTenant: <T extends { tenantId: string }>(data: T[], tenantId: string) => T[];

  // ═══ Products ═══
  addProduct: (p: Product) => void;
  updateProduct: (id: string, data: Partial<Product>) => void;
  deleteProduct: (id: string) => { success: boolean; error?: string };

  // ═══ Orders ═══
  addOrder: (o: Order) => { success: boolean; error?: string };
  updateOrderStatus: (id: string, status: Order['status'], paymentStatus?: Order['paymentStatus']) => void;

  // ═══ Couriers ═══
  addCourier: (c: CourierCompany) => void;
  updateCourier: (id: string, data: Partial<CourierCompany>) => void;
  toggleCourier: (id: string) => void;
  deleteCourier: (id: string) => { success: boolean; error?: string };

  // ═══ Partners ═══
  addPartner: (p: Partner) => void;
  updatePartner: (id: string, data: Partial<Partner>) => void;
  deletePartner: (id: string) => { success: boolean; error?: string };
  withdrawPartnerFunds: (partnerId: string, amount: number, opts?: { description?: string, deductDebt?: boolean, transactionDate?: string }) => { success: boolean; error?: string };
  distributeProfits: (tenantId: string, amountToDistribute: number) => { success: boolean; error?: string };

  // ═══ Employees ═══
  addEmployee: (e: Employee) => void;
  updateEmployee: (id: string, data: Partial<Employee>) => void;
  deleteEmployee: (id: string) => { success: boolean; error?: string };
  issuePayroll: (tenantId: string, monthString: string, details: { employeeId: string; netAmount: number; advanceDeduction: number; allowanceApplied: number; deductionApplied: number }[]) => { success: boolean; error?: string };
  recordEmployeeFinancial: (employeeId: string, type: 'advance' | 'bonus' | 'deduction', amount: number, reason?: string) => { success: boolean; error?: string };

  // ═══ Debts ═══
  addDebt: (d: Debt) => void;
  updateDebt: (id: string, data: Partial<Debt>) => void;
  payDebt: (id: string, amount: number) => void;

  // ═══ Tenants ═══
  toggleTenant: (id: string) => void;
  addTenant: (t: Tenant) => void;
  updateTenant: (id: string, data: Partial<Tenant>) => void;

  // ═══ Treasury ═══
  addTransaction: (t: TreasuryTransaction) => void;
  addTreasuryAccount: (a: TreasuryAccount) => void;

  // ═══ Users ═══
  addUser: (u: TenantUser) => void;
  updateUser: (id: string, data: Partial<TenantUser>) => void;
  getUserByEmail: (email: string) => TenantUser | undefined;

  // ═══ Notifications ═══
  addNotification: (n: Notification) => void;
  markNotificationRead: (id: string) => void;
  markAllRead: (tenantId: string) => void;
  clearNotifications: (tenantId: string) => void;
  getUnreadCount: (tenantId: string) => number;

  // ═══ Super Admin ═══
  addAnnouncement: (a: SystemAnnouncement) => void;
  removeAnnouncement: (id: string) => void;
  addAuditLog: (log: AuditLog) => void;
  updateSubscriptionStatus: (id: string, status: Subscription['status']) => void;
}

export const useDataStore = create<DataState>()(
  persist(
    (set, get) => ({
  tenants: SEED_TENANTS,
  products: SEED_PRODUCTS,
  orders: SEED_ORDERS,
  couriers: SEED_COURIERS,
  partners: SEED_PARTNERS,
  employees: SEED_EMPLOYEES,
  debts: SEED_DEBTS,
  treasury: SEED_TREASURY,
  transactions: SEED_TRANSACTIONS,
  subscriptions: SEED_SUBSCRIPTIONS,
  users: SEED_USERS,
  notifications: SEED_NOTIFICATIONS,
  customers: SEED_CUSTOMERS,
  announcements: [],
  auditLogs: [],

  getForTenant: <T extends { tenantId: string }>(data: T[], tenantId: string) =>
    data.filter((item) => item.tenantId === tenantId),

  // ═══ Products ═══
  addProduct: (p) => set((s) => {
    // 1. حساب التكلفة الإجمالية للمنتج الجديد
    const totalQty = p.productType !== 'simple' && p.variants 
      ? p.variants.reduce((sum, v) => sum + v.quantity, 0)
      : p.quantity;
    const totalCost = totalQty * p.costPrice;

    // 2. تحديث الخزينة بتسجيل السحب
    const newTreasury = [...s.treasury];
    const newTransactions = [...s.transactions];
    
    // نخصم من أول حساب خزينة "كاش" للمتجر
    const mainAccountIndex = newTreasury.findIndex(
      (acc) => acc.tenantId === p.tenantId && acc.accountType === 'cash_in_hand'
    );
    
    if (mainAccountIndex !== -1 && totalCost > 0) {
      newTreasury[mainAccountIndex] = {
        ...newTreasury[mainAccountIndex],
        balance: newTreasury[mainAccountIndex].balance - totalCost
      };
      
      newTransactions.push({
        id: `tx-newstock-${Date.now()}`,
        tenantId: p.tenantId,
        accountId: newTreasury[mainAccountIndex].id,
        transactionType: 'expense',
        amount: totalCost,
        description: `توريد بضاعة: ${p.name}`,
        createdAt: new Date().toISOString(),
        transactionDate: new Date().toISOString(),
      });
    }

    return { 
      products: [p, ...s.products],
      treasury: newTreasury,
      transactions: newTransactions
    };
  }),
  updateProduct: (id, data) => set((s) => {
    const p = s.products.find(x => x.id === id);
    if (!p) return s;
    const updatedP = { ...p, ...data };
    const newProducts = s.products.map(x => x.id === id ? updatedP : x);
    
    let newNotifs = [...s.notifications];
    let newTreasury = [...s.treasury];
    let newTransactions = [...s.transactions];

    // 1. معالجة التأثير المالي إذا تم زيادة الكمية بشكل إضافي
    if (data.quantity !== undefined && data.quantity > p.quantity) {
      const addedQty = data.quantity - p.quantity;
      const addedCost = addedQty * p.costPrice;
      
      const mainAccountIndex = newTreasury.findIndex(
        (acc) => acc.tenantId === p.tenantId && acc.accountType === 'cash_in_hand'
      );
      
      if (mainAccountIndex !== -1 && addedCost > 0) {
        newTreasury[mainAccountIndex] = {
          ...newTreasury[mainAccountIndex],
          balance: newTreasury[mainAccountIndex].balance - addedCost
        };
        
        newTransactions.push({
          id: `tx-addstock-${Date.now()}`,
          tenantId: p.tenantId,
          accountId: newTreasury[mainAccountIndex].id,
          transactionType: 'expense',
          amount: addedCost,
          description: `تعزيز كمية: ${p.name} (+${addedQty} ${p.unit})`,
          createdAt: new Date().toISOString(),
          transactionDate: new Date().toISOString(),
        });
      }
    }

    // 2. معالجة التنبيهات الذكية (للمقاسات وللمنتج ككل)
    if (data.quantity !== undefined && data.quantity < p.quantity) {
      if (data.quantity <= 0 && p.quantity > 0) {
        newNotifs.unshift({
          id: `notif-stock-out-${id}-${Date.now()}`,
          tenantId: updatedP.tenantId,
          type: 'error',
          title: 'نفد المخزون بالكامل',
          message: `نفد المنتج "${updatedP.name}" من المخزون`,
          isRead: false,
          createdAt: new Date().toISOString(),
          link: '/inventory',
        });
      } else if (data.quantity <= updatedP.minQuantity && data.quantity > 0 && p.quantity > updatedP.minQuantity) {
        newNotifs.unshift({
          id: `notif-stock-low-${id}-${Date.now()}`,
          tenantId: updatedP.tenantId,
          type: 'warning',
          title: 'مخزون منخفض',
          message: `المنتج "${updatedP.name}" قارب على النفاد (متبقي ${data.quantity} ${p.unit})`,
          isRead: false,
          createdAt: new Date().toISOString(),
          link: '/inventory',
        });
      }
    }

    // تنبيهات للمقاسات الفردية
    if (updatedP.productType !== 'simple' && updatedP.variants) {
      updatedP.variants.forEach(variant => {
        const oldVariant = p.variants?.find(v => v.id === variant.id);
        if (oldVariant && variant.quantity < oldVariant.quantity) {
          if (variant.quantity <= 0 && oldVariant.quantity > 0) {
            newNotifs.unshift({
              id: `notif-var-out-${variant.id}-${Date.now()}`,
              tenantId: updatedP.tenantId,
              type: 'error',
              title: 'نفد مقاس',
              message: `نفد المقاس "${variant.size || variant.color}" من الصنف "${updatedP.name}"`,
              isRead: false,
              createdAt: new Date().toISOString(),
              link: '/inventory',
            });
          } else if (variant.quantity <= 3 && oldVariant.quantity > 3) {
            newNotifs.unshift({
              id: `notif-var-low-${variant.id}-${Date.now()}`,
              tenantId: updatedP.tenantId,
              type: 'warning',
              title: 'مخزون مقاس منخفض',
              message: `المقاس "${variant.size || variant.color}" للمنتج "${updatedP.name}" قارب على النفاد (متبقي ${variant.quantity})`,
              isRead: false,
              createdAt: new Date().toISOString(),
              link: '/inventory',
            });
          }
        }
      });
    }

    return { 
      products: newProducts, 
      notifications: newNotifs,
      treasury: newTreasury,
      transactions: newTransactions
    };
  }),
  deleteProduct: (id) => {
    const state = get();
    // لمنع حذف منتج به طلب نشط (رغم أنه الحذف آمن، سيبقى مرتبطاً بالطلب، لكن لتجنب إرباك الموظفين)
    const hasActiveOrders = state.orders.some(o =>
      ['pending', 'processing', 'with_courier', 'with_partner'].includes(o.status) &&
      o.items.some(item => item.productId === id)
    );
    if (hasActiveOrders) {
      return { success: false, error: 'لا يمكن حذف هذا المنتج لوجود طلبيات نشطة عليه' };
    }
    // الحذف الآمن (Soft Delete)
    set((s) => ({ products: s.products.map((p) => p.id === id ? { ...p, isActive: false } : p) }));
    return { success: true };
  },

  // ═══ Orders — مع خصم المخزون التلقائي ═══
  addOrder: (o) => {
    const state = get();
    // تحقق من توفر المخزون لكل منتج ومتغيراته
    for (const item of o.items) {
      const product = state.products.find(p => p.id === item.productId);
      if (!product) {
        return { success: false, error: `المنتج "${item.productName}" غير موجود في المخزون` };
      }
      
      // التثبت الخاص بمتغيرات المنتج (ملابس، أحذية، مخصص)
      if (product.productType !== 'simple' && item.variantSize && product.variants) {
        const variant = product.variants.find(v => v.size === item.variantSize);
        if (variant && variant.quantity < item.quantity) {
          return { success: false, error: `المقاس "${item.variantSize}" للمنتج "${item.productName}" غير متوفر بالكمية المطلوبة (متبقي ${variant.quantity})` };
        }
      } else if (product.productType === 'simple' && product.quantity < item.quantity) {
        return { success: false, error: `المخزون غير كافٍ للمنتج "${item.productName}" — متوفر ${product.quantity} ${product.unit} فقط` };
      }
    }
    // خصم المخزون + إضافة الطلبية أعلى القائمة
    set((s) => {
      const newProducts = s.products.map(p => {
        const orderItemsForProduct = o.items.filter(i => i.productId === p.id);
        if (orderItemsForProduct.length === 0) return p;
        
        const newP = { ...p, variants: p.variants ? p.variants.map(v => ({ ...v })) : undefined };
        let totalQtyDeducted = 0;
        
        for (const item of orderItemsForProduct) {
          totalQtyDeducted += item.quantity;
          if (newP.productType !== 'simple' && item.variantSize && newP.variants) {
            const vIndex = newP.variants.findIndex(v => v.size === item.variantSize);
            if (vIndex !== -1) {
              newP.variants[vIndex].quantity -= item.quantity;
            }
          }
        }
        
        newP.quantity -= totalQtyDeducted;
        return newP;
      });
      // تحقق من انخفاض المخزون بعد الخصم → إنشاء إشعار
      const newNotifs: Notification[] = [];
      newProducts.forEach(p => {
        if (p.tenantId !== o.tenantId) return;
        if (p.quantity === 0) {
          newNotifs.push({
            id: `notif-stock-out-${p.id}-${Date.now()}`,
            tenantId: p.tenantId,
            type: 'error',
            title: 'نفد المخزون',
            message: `نفد المنتج "${p.name}" من المخزون`,
            isRead: false,
            createdAt: new Date().toISOString(),
            link: '/inventory',
          });
        } else if (p.quantity <= p.minQuantity) {
          newNotifs.push({
            id: `notif-stock-low-${p.id}-${Date.now()}`,
            tenantId: p.tenantId,
            type: 'warning',
            title: 'مخزون منخفض',
            message: `المنتج "${p.name}" وصل للحد الأدنى (${p.quantity} ${p.unit})`,
            isRead: false,
            createdAt: new Date().toISOString(),
            link: '/inventory',
          });
        }
      });
      // إشعار الطلبية الجديدة
      newNotifs.push({
        id: `notif-order-${o.id}-${Date.now()}`,
        tenantId: o.tenantId,
        type: 'info',
        title: 'طلبية جديدة',
        message: `تم إنشاء طلبية ${o.orderNumber} للزبون ${o.customerName}`,
        isRead: false,
        createdAt: new Date().toISOString(),
        link: '/orders',
      });

      // معالجة بيانات الزبون تلقائياً
      let newCustomers = [...s.customers];
      const existingCustomerIndex = newCustomers.findIndex(c => c.phone === o.customerPhone && c.tenantId === o.tenantId);
      if (existingCustomerIndex !== -1) {
        newCustomers[existingCustomerIndex] = {
          ...newCustomers[existingCustomerIndex],
          name: o.customerName,
          city: o.customerCity,
          address: o.customerAddress || newCustomers[existingCustomerIndex].address,
          totalOrders: newCustomers[existingCustomerIndex].totalOrders + 1,
        };
      } else {
        newCustomers.push({
          id: `cust-${o.tenantId}-${Date.now()}`,
          tenantId: o.tenantId,
          name: o.customerName,
          phone: o.customerPhone,
          city: o.customerCity,
          address: o.customerAddress,
          totalOrders: 1,
          createdAt: new Date().toISOString()
        });
      }

      return {
        orders: [o, ...s.orders], // unshift — الجديدة أعلاه
        products: newProducts,
        notifications: [...newNotifs, ...s.notifications],
        customers: newCustomers,
      };
    });
    return { success: true };
  },

  updateOrderStatus: (id, status, paymentStatus) => {
    const state = get();
    const order = state.orders.find(o => o.id === id);
    if (!order) return;

    // عند إلغاء طلبية مؤكدة → إعادة المخزون واسترجاع الأموال للخزينة إن كانت مسلمة
    if (status === 'cancelled' && ['pending', 'processing', 'with_courier', 'with_partner', 'delivered'].includes(order.status)) {
      set((s) => {
        const wasDelivered = order.status === 'delivered';
        const isInternal = ['internal', 'pickup'].includes(order.deliveryType);
        
        let newTransactions = s.transactions;
        let newTreasury = s.treasury;

        if (wasDelivered && isInternal) {
          const cashAccount = s.treasury.find((a) => a.tenantId === order.tenantId && a.accountType === 'cash_in_hand');
          if (cashAccount) {
            const newTx: TreasuryTransaction = {
              id: `tt-cancel-${Date.now()}`,
              tenantId: order.tenantId,
              accountId: cashAccount.id,
              transactionType: 'expense',
              amount: -Math.abs(order.total),
              description: `إلغاء طلبية مسلّمة ${order.orderNumber}`,
              createdAt: new Date().toISOString(),
              transactionDate: new Date().toISOString(),
            };
            newTransactions = [newTx, ...s.transactions];
            newTreasury = s.treasury.map((a) =>
              a.id === cashAccount.id ? { ...a, balance: a.balance + newTx.amount } : a
            );
          }
        }

        return {
          orders: s.orders.map((o) =>
            o.id === id ? { ...o, status, ...(paymentStatus ? { paymentStatus } : {}) } : o
          ),
          products: s.products.map(p => {
            const orderItemsForProduct = order.items.filter(i => i.productId === p.id);
            if (orderItemsForProduct.length === 0) return p;
            
            const newP = { ...p, variants: p.variants ? p.variants.map(v => ({...v})) : undefined };
            let totalRestored = 0;
            
            for (const item of orderItemsForProduct) {
              totalRestored += item.quantity;
              if (newP.productType !== 'simple' && item.variantSize && newP.variants) {
                const vIndex = newP.variants.findIndex(v => v.size === item.variantSize);
                if (vIndex !== -1) {
                  newP.variants[vIndex].quantity += item.quantity;
                }
              }
            }
            
            newP.quantity += totalRestored;
            return newP;
          }),
          ...(wasDelivered && isInternal ? { transactions: newTransactions, treasury: newTreasury } : {})
        };
      });
      return;
    }

    // عند تأكيد إرجاع → إعادة المخزون واسترجاع الأموال للخزينة 
    if (status === 'return_confirmed') {
      set((s) => {
        const isInternal = ['internal', 'pickup'].includes(order.deliveryType);
        
        let newTransactions = s.transactions;
        let newTreasury = s.treasury;

        if (isInternal) {
          const cashAccount = s.treasury.find((a) => a.tenantId === order.tenantId && a.accountType === 'cash_in_hand');
          if (cashAccount) {
            const newTx: TreasuryTransaction = {
              id: `tt-return-${Date.now()}`,
              tenantId: order.tenantId,
              accountId: cashAccount.id,
              transactionType: 'expense',
              amount: -Math.abs(order.total),
              description: `مرتجع طلبية ${order.orderNumber}`,
              createdAt: new Date().toISOString(),
              transactionDate: new Date().toISOString(),
            };
            newTransactions = [newTx, ...s.transactions];
            newTreasury = s.treasury.map((a) =>
              a.id === cashAccount.id ? { ...a, balance: a.balance + newTx.amount } : a
            );
          }
        }

        return {
          orders: s.orders.map((o) =>
            o.id === id ? { ...o, status, ...(paymentStatus ? { paymentStatus } : {}) } : o
          ),
          products: s.products.map(p => {
            const orderItemsForProduct = order.items.filter(i => i.productId === p.id);
            if (orderItemsForProduct.length === 0) return p;
            
            const newP = { ...p, variants: p.variants ? p.variants.map(v => ({...v})) : undefined };
            let totalRestored = 0;
            
            for (const item of orderItemsForProduct) {
              totalRestored += item.quantity;
              if (newP.productType !== 'simple' && item.variantSize && newP.variants) {
                const vIndex = newP.variants.findIndex(v => v.size === item.variantSize);
                if (vIndex !== -1) {
                  newP.variants[vIndex].quantity += item.quantity;
                }
              }
            }
            
            newP.quantity += totalRestored;
            return newP;
          }),
          ...(isInternal ? { transactions: newTransactions, treasury: newTreasury } : {})
        };
      });
      return;
    }

    set((s) => {
      // 1. إضافة حركة خزينة عند تسليم المبيعات الداخلية (حسب طلب المستخدم)
      if (status === 'delivered' && order.status !== 'delivered' && ['internal', 'pickup'].includes(order.deliveryType)) {
        const cashAccount = s.treasury.find((a) => a.tenantId === order.tenantId && a.accountType === 'cash_in_hand');
        if (cashAccount) {
          const newTx: TreasuryTransaction = {
            id: `tt-sale-${Date.now()}`,
            tenantId: order.tenantId,
            accountId: cashAccount.id,
            transactionType: 'sale',
            amount: Math.abs(order.total),
            description: `إيراد طلبية ${order.orderNumber}`,
            createdAt: new Date().toISOString(),
            transactionDate: new Date().toISOString(),
          };
          return {
            orders: s.orders.map((o) =>
              o.id === id ? { ...o, status, ...(paymentStatus ? { paymentStatus } : {}) } : o
            ),
            transactions: [newTx, ...s.transactions],
            treasury: s.treasury.map((a) =>
              a.id === cashAccount.id ? { ...a, balance: a.balance + newTx.amount } : a
            ),
          };
        }
      }

      return {
        orders: s.orders.map((o) =>
          o.id === id ? { ...o, status, ...(paymentStatus ? { paymentStatus } : {}) } : o
        ),
      };
    });
  },

  // ═══ Couriers ═══
  addCourier: (c) => set((s) => ({ couriers: [c, ...s.couriers] })),
  updateCourier: (id, data) => set((s) => ({
    couriers: s.couriers.map((c) => (c.id === id ? { ...c, ...data } : c)),
  })),
  toggleCourier: (id) => set((s) => ({
    couriers: s.couriers.map((c) => (c.id === id ? { ...c, isActive: !c.isActive } : c)),
  })),
  deleteCourier: (id) => {
    // منع الحذف إذا لديها شحنات نشطة
    // في الـ mock نتحقق من الطلبيات
    const state = get();
    const hasActiveOrders = state.orders.some(o =>
      ['with_courier', 'pending_return'].includes(o.status) &&
      o.courierCompanyId === id
    );
    if (hasActiveOrders) {
      return { success: false, error: 'لا يمكن حذف هذه الشركة — لديها شحنات نشطة غير مكتملة' };
    }
    set((s) => ({
      couriers: s.couriers.filter((c) => c.id !== id),
      treasury: s.treasury.filter(t => t.linkedCourierId !== id),
    }));
    return { success: true };
  },

  // ═══ Partners ═══
  addPartner: (p) => set((s) => ({ partners: [p, ...s.partners] })),
  updatePartner: (id, data) => set((s) => ({
    partners: s.partners.map((p) => (p.id === id ? { ...p, ...data } : p)),
  })),
  deletePartner: (id) => {
    const state = get();
    const partner = state.partners.find(p => p.id === id);
    if (!partner) return { success: false, error: 'الشريك غير موجود' };
    if (partner.capitalContribution > 0) {
      return { success: false, error: 'لا يمكن حذف هذا الشريك — لديه رأس مال مسجل. قم بتصفية حصته أولاً' };
    }
    if (partner.debtBalance > 0) {
      return { success: false, error: 'لا يمكن حذف هذا الشريك — لديه ديون غير مسددة' };
    }
    if (partner.walletBalance > 0) {
      return { success: false, error: 'لا يمكن حذف هذا الشريك — لديه مستحقات غير مسحوبة في محفظته' };
    }
    set((s) => ({
      partners: s.partners.filter((p) => p.id !== id),
      // تعطيل حساب المستخدم المرتبط بالشريك
      users: s.users.map(u => u.id === partner.userId ? { ...u, isActive: false } : u),
    }));
    return { success: true };
  },
  withdrawPartnerFunds: (partnerId, amount, opts) => {
    const state = get();
    const partner = state.partners.find(p => p.id === partnerId);
    if (!partner) return { success: false, error: 'الشريك غير موجود' };

    if (amount <= 0) return { success: false, error: 'مبلغ السحب يجب أن يكون أكبر من صفر' };

    if (amount > partner.walletBalance) {
      return { success: false, error: 'الرصيد المطلوب يتجاوز المتاح في محفظة الشريك' };
    }

    const cashAccount = state.treasury.find(a => a.tenantId === partner.tenantId && a.accountType === 'cash_in_hand');
    if (!cashAccount) {
      return { success: false, error: 'حساب الخزينة (الكاش) غير موجود' };
    }
    
    const debtToDeduct = (opts?.deductDebt && partner.debtBalance > 0) ? Math.min(partner.debtBalance, amount) : 0;
    const actualPaid = amount - debtToDeduct;

    // قراءة قاعدة السماح بالسالب
    const logicRulesStr = localStorage.getItem('bunyan-logic-rules');
    const allowNegativeTreasury = logicRulesStr ? JSON.parse(logicRulesStr)?.state?.rules?.allowNegativeTreasury : false;

    if (!allowNegativeTreasury && actualPaid > cashAccount.balance) {
      return { success: false, error: `رصيد الخزينة الحالي لا يغطي هذه السحبة. المتاح للنقد: ${cashAccount.balance} د.ل` };
    }

    const newPartners = state.partners.map(p => 
      p.id === partnerId ? { 
        ...p, 
        walletBalance: p.walletBalance - amount,
        debtBalance: p.debtBalance - debtToDeduct
      } : p
    );

    const txDate = opts?.transactionDate || new Date().toISOString();
    const description = opts?.description || 'سحب أرباح';
    
    // تسجيل حركة السحب (بالمبلغ المخصوم منه الدين)
    let transactionsToAdd = [];
    if (actualPaid > 0) {
      transactionsToAdd.push({
        id: `tt-withdraw-${Date.now()}`,
        tenantId: partner.tenantId,
        accountId: cashAccount.id,
        transactionType: 'partner_withdrawal',
        amount: -Math.abs(actualPaid),
        description: `${description} — ${partner.name}${debtToDeduct > 0 ? ` (تم خصم دين بقيمة ${debtToDeduct})` : ''}`,
        createdAt: new Date().toISOString(),
        transactionDate: txDate,
      } as TreasuryTransaction);
    }

    const newTreasury = state.treasury.map(a => 
      a.id === cashAccount.id ? { ...a, balance: a.balance - actualPaid } : a
    );

    let newDebts = [...state.debts];
    if (debtToDeduct > 0) {
      let remainingToDeduct = debtToDeduct;
      newDebts = newDebts.map(debt => {
        if (remainingToDeduct <= 0) return debt;
        if (debt.linkedEntityId === partnerId && debt.status !== 'paid') {
          const canPay = Math.min(debt.amount - debt.paidAmount, remainingToDeduct);
          if (canPay > 0) {
            remainingToDeduct -= canPay;
            const newPaid = debt.paidAmount + canPay;
            return {
              ...debt,
              paidAmount: newPaid,
              status: newPaid >= debt.amount ? 'paid' : 'partial',
              paymentHistory: [...debt.paymentHistory, {
                id: `dp-${Date.now()}-${Math.random()}`,
                amount: canPay,
                date: txDate,
                createdAt: new Date().toISOString()
              }]
            };
          }
        }
        return debt;
      });
    }

    set({
      partners: newPartners,
      transactions: [...transactionsToAdd, ...state.transactions],
      treasury: newTreasury,
      debts: newDebts,
    });

    return { success: true };
  },
  distributeProfits: (tenantId, amountToDistribute) => {
     const state = get();
     if (amountToDistribute <= 0) return { success: false, error: 'مبلغ الأرباح الموزعة يجب أن يكون أكبر من الصفر' };
     
     const activePartners = state.partners.filter(p => p.tenantId === tenantId && p.isActive);
     if (activePartners.length === 0) return { success: false, error: 'لا يوجد شركاء فعالون لتوزيع الأرباح عليهم' };

     const updatedPartners = state.partners.map(p => {
        if (p.tenantId === tenantId && p.isActive) {
           const share = amountToDistribute * (p.profitPercentage / 100);
           return { ...p, walletBalance: p.walletBalance + share };
        }
        return p;
     });

     // إضافة حركة وهمية كمرجع للمنظومة بأن هذه القيمة من الأرباح تمت معالجتها
     const newTx: TreasuryTransaction = {
       id: `pd-${Date.now()}`,
       tenantId: tenantId,
       accountId: 'system_profit', // حساب وهمي لا يؤثر على الخزينة
       transactionType: 'profit_distribution_record',
       amount: amountToDistribute, // كامل المبلغ المعالج
       description: 'دورة استخراج وتوزيع أرباح النظام',
       createdAt: new Date().toISOString(),
       transactionDate: new Date().toISOString()
     };

     set({ partners: updatedPartners, transactions: [newTx, ...state.transactions] });
     return { success: true };
  },

  // ═══ Employees ═══
  addEmployee: (e) => set((s) => ({ employees: [e, ...s.employees] })),
  updateEmployee: (id, data) => set((s) => ({
    employees: s.employees.map((e) => (e.id === id ? { ...e, ...data } : e)),
  })),
  deleteEmployee: (id) => {
    const state = get();
    const emp = state.employees.find(e => e.id === id);
    if (!emp) return { success: false, error: 'الموظف غير موجود' };
    if (emp.advanceBalance > 0) {
      return { success: false, error: `لا يمكن حذف هذا الموظف — لديه سلفة غير مسددة (${emp.advanceBalance} د.ل)` };
    }
    set((s) => ({
      employees: s.employees.filter((e) => e.id !== id),
      // تعطيل حساب المستخدم المرتبط بالموظف
      users: s.users.map(u => u.id === emp.userId ? { ...u, isActive: false } : u),
    }));
    return { success: true };
  },
  issuePayroll: (tenantId, monthString, details) => {
    const state = get();
    const cashAccount = state.treasury.find(a => a.tenantId === tenantId && a.accountType === 'cash_in_hand');
    if (!cashAccount) return { success: false, error: 'لا يوجد حساب خزينة (كاش) متاح' };

    const totalPayout = details.reduce((sum, d) => sum + d.netAmount, 0);

    const logicRulesStr = localStorage.getItem('bunyan-logic-rules');
    const allowNegativeTreasury = logicRulesStr ? JSON.parse(logicRulesStr)?.state?.rules?.allowNegativeTreasury : false;

    if (!allowNegativeTreasury && totalPayout > cashAccount.balance) {
      return { success: false, error: `الرصيد النقدي لا يكفي لصرف الرواتب. المتاح: ${cashAccount.balance} د.ل، المطلوب: ${totalPayout} د.ل` };
    }

    const newTxList: TreasuryTransaction[] = [];
    let newDebts = [...state.debts];

    const newEmps = state.employees.map(e => {
      const d = details.find(x => x.employeeId === e.id);
      if (!d) return e;

      // سداد الدين آلياً من جدول الديون
      if (d.advanceDeduction > 0) {
         let remainingToDeduct = d.advanceDeduction;
         newDebts = newDebts.map(debt => {
           if (remainingToDeduct <= 0) return debt;
           if (debt.linkedEntityId === e.id && debt.status !== 'paid' && debt.debtCategory === 'employee_advance') {
             const canPay = Math.min(debt.amount - debt.paidAmount, remainingToDeduct);
             if (canPay > 0) {
               remainingToDeduct -= canPay;
               const newPaid = debt.paidAmount + canPay;
               return {
                 ...debt,
                 paidAmount: newPaid,
                 status: newPaid >= debt.amount ? 'paid' : 'partial',
                 paymentHistory: [...debt.paymentHistory, {
                   id: `dp-payroll-${Date.now()}-${Math.random()}`,
                   amount: canPay,
                   date: new Date().toISOString(),
                   createdAt: new Date().toISOString()
                 }]
               };
             }
           }
           return debt;
         });
      }

      if (d.netAmount > 0) {
        newTxList.push({
          id: `tt-${Date.now()}-${e.id}`,
          tenantId: e.tenantId,
          accountId: cashAccount.id,
          transactionType: 'expense',
          amount: -Math.abs(d.netAmount),
          description: `راتب شهر ${monthString} - ${e.name}`,
          createdAt: new Date().toISOString(),
          transactionDate: new Date().toISOString(),
        });
      }

      return {
        ...e,
        lastPayrollDate: monthString,
        lastPaymentDate: new Date().toISOString(),
        advanceBalance: Math.max(0, e.advanceBalance - d.advanceDeduction),
        allowanceBalance: Math.max(0, e.allowanceBalance - d.allowanceApplied),
        deductionBalance: Math.max(0, e.deductionBalance - d.deductionApplied),
      };
    });

    const newTreasury = state.treasury.map(a => 
      a.id === cashAccount.id ? { ...a, balance: a.balance - totalPayout } : a
    );

    set({
      employees: newEmps,
      treasury: newTreasury,
      transactions: [...newTxList, ...state.transactions],
      debts: newDebts,
    });
    
    return { success: true };
  },

  recordEmployeeFinancial: (employeeId, type, amount, reason) => {
    const state = get();
    const emp = state.employees.find(e => e.id === employeeId);
    if (!emp) return { success: false, error: 'الموظف غير موجود' };
    if (amount <= 0) return { success: false, error: 'المبلغ يجب أن يكون أكبر من 0' };

    let newEmps = [...state.employees];
    let newTxList = [...state.transactions];
    let newTreasury = [...state.treasury];

    if (type === 'advance') {
      const cashAccount = state.treasury.find(a => a.tenantId === emp.tenantId && a.accountType === 'cash_in_hand');
      if (!cashAccount) return { success: false, error: 'لا توجد خزينة كاش متاحة' };
      
      const logicRulesStr = localStorage.getItem('bunyan-logic-rules');
      const allowNegativeTreasury = logicRulesStr ? JSON.parse(logicRulesStr)?.state?.rules?.allowNegativeTreasury : false;
      if (!allowNegativeTreasury && amount > cashAccount.balance) {
         return { success: false, error: `الرصيد النقدي لا يكفي لإعطاء هذه السلفة. المتاح: ${cashAccount.balance} د.ل` };
      }

      newEmps = newEmps.map(e => e.id === employeeId ? { ...e, advanceBalance: e.advanceBalance + amount } : e);
      newTreasury = newTreasury.map(a => a.id === cashAccount.id ? { ...a, balance: a.balance - amount } : a);
      newTxList.unshift({
        id: `tt-adv-${Date.now()}`,
        tenantId: emp.tenantId,
        accountId: cashAccount.id,
        transactionType: 'expense',
        amount: -amount,
        description: `سلفة نقدية: ${emp.name} ${reason ? `(${reason})` : ''}`,
        createdAt: new Date().toISOString(),
        transactionDate: new Date().toISOString(),
      });

      // إضافة السلفة مباشرة إلى جدول الديون لتفادي التشوه المحاسبي
      const newAdvanceDebt: Debt = {
        id: `dbt-adv-${Date.now()}`,
        tenantId: emp.tenantId,
        amount: amount,
        paidAmount: 0,
        debtType: 'internal',
        debtCategory: 'employee_advance',
        linkedEntityId: emp.id,
        linkedEntityType: 'employee',
        linkedEntityName: emp.name,
        paymentHistory: [],
        dueDate: new Date(new Date().setMonth(new Date().getMonth() + 1)).toISOString().split('T')[0],
        status: 'active',
        description: `سلفة نقدية - ${reason || ''}`,
        createdAt: new Date().toISOString(),
      };

      // دمج الدين مع باقي التحديثات في set واحد لتجنب race condition
      set((s) => ({
        employees: newEmps,
        treasury: newTreasury,
        transactions: newTxList,
        debts: [newAdvanceDebt, ...s.debts],
      }));
      return { success: true };

    } else if (type === 'bonus') {
      newEmps = newEmps.map(e => e.id === employeeId ? { ...e, allowanceBalance: e.allowanceBalance + amount } : e);
    } else if (type === 'deduction') {
      newEmps = newEmps.map(e => e.id === employeeId ? { ...e, deductionBalance: e.deductionBalance + amount } : e);
    }

    set({ employees: newEmps, treasury: newTreasury, transactions: newTxList });
    return { success: true };
  },

  // ═══ Debts ═══
  addDebt: (d) => set((s) => ({ debts: [{ ...d, paymentHistory: d.paymentHistory || [] }, ...s.debts] })),
  updateDebt: (id, data) => set((s) => ({
    debts: s.debts.map((d) => (d.id === id ? { ...d, ...data } : d)),
  })),
  payDebt: (id, amount) => {
    const state = get();
    const debt = state.debts.find(d => d.id === id);
    if (!debt) return;
    
    // تحديث الخزينة
    const cashAccount = state.treasury.find(a => a.tenantId === debt.tenantId && a.accountType === 'cash_in_hand');
    const isIncome = ['customer', 'employee_advance', 'partner_advance', 'custody'].includes(debt.debtCategory);
    
    let newTransactions = state.transactions;
    let newTreasury = state.treasury;
    let newPartners = state.partners;
    let newEmployees = state.employees;

    if (cashAccount) {
      const newTx: TreasuryTransaction = {
        id: `tt-debt-${Date.now()}`,
        tenantId: debt.tenantId,
        accountId: cashAccount.id,
        transactionType: isIncome ? 'income' : 'expense',
        amount: isIncome ? Math.abs(amount) : -Math.abs(amount),
        description: `سداد دين — ${debt.linkedEntityName || 'بدون اسم'}`,
        createdAt: new Date().toISOString(),
        transactionDate: new Date().toISOString(),
      };
      
      newTransactions = [newTx, ...state.transactions];
      newTreasury = state.treasury.map(a => 
         a.id === cashAccount.id ? { ...a, balance: a.balance + newTx.amount } : a
      );
    }
    
    // تحديث أرصدة الأطراف المرتبطة (الشركاء والموظفين) لئلا تنفصل
    if (debt.debtCategory === 'partner_advance' && debt.linkedEntityId) {
      newPartners = state.partners.map(p => 
        p.id === debt.linkedEntityId ? { ...p, debtBalance: Math.max(0, p.debtBalance - amount) } : p
      );
    } else if (debt.debtCategory === 'employee_advance' && debt.linkedEntityId) {
      newEmployees = state.employees.map(e =>
        e.id === debt.linkedEntityId ? { ...e, advanceBalance: Math.max(0, e.advanceBalance - amount) } : e
      );
    }

    set((s) => ({
      debts: s.debts.map((d) => {
        if (d.id !== id) return d;
        const newPaid = Math.min(d.paidAmount + amount, d.amount);
        return { 
          ...d, 
          paidAmount: newPaid, 
          status: newPaid >= d.amount ? 'paid' : 'partial',
          paymentHistory: [ ...d.paymentHistory, { id: `dp-${Date.now()}`, amount, date: new Date().toISOString(), createdAt: new Date().toISOString() } ]
        };
      }),
      transactions: newTransactions,
      treasury: newTreasury,
      partners: newPartners,
      employees: newEmployees
    }));
  },

  // ═══ Tenants ═══
  toggleTenant: (id) => set((s) => ({
    tenants: s.tenants.map((t) => (t.id === id ? { ...t, isActive: !t.isActive } : t)),
    // Kill-Switch: إيقاف جميع مستخدمي المتجر
    users: s.users.map(u => {
      if (u.tenantId !== id) return u;
      const tenant = s.tenants.find(t => t.id === id);
      return { ...u, isActive: tenant ? !tenant.isActive : false };
    }),
  })),

  addTenant: (t) => set((s) => ({
    tenants: [t, ...s.tenants],
    subscriptions: [
      {
        id: `sub-${t.id}`, tenantId: t.id, plan: t.plan, amount: 0,
        periodFrom: t.createdAt, periodTo: t.planExpiresAt,
        status: 'pending' as const, paidAt: undefined,
      },
      ...s.subscriptions,
    ],
    treasury: [
      {
        id: `acc-${t.id}-cash`, tenantId: t.id, accountType: 'cash_in_hand' as const,
        accountName: 'النقد الفعلي', balance: 0, linkedCourierId: undefined,
      },
      ...s.treasury,
    ],
  })),

  updateTenant: (id, data) => set((s) => ({
    tenants: s.tenants.map((t) => (t.id === id ? { ...t, ...data } : t)),
  })),

  // ═══ Treasury ═══
  addTransaction: (t) => set((s) => ({
    transactions: [t, ...s.transactions],
    treasury: s.treasury.map((a) =>
      a.id === t.accountId ? { ...a, balance: a.balance + t.amount } : a
    ),
  })),
  addTreasuryAccount: (a) => set((s) => ({ treasury: [a, ...s.treasury] })),

  // ═══ Users ═══
  addUser: (u) => set((s) => ({ users: [u, ...s.users] })),
  updateUser: (id, data) => set((s) => ({
    users: s.users.map(u => u.id === id ? { ...u, ...data } : u),
  })),
  getUserByEmail: (email) => get().users.find(u => u.email === email),

  // ═══ Notifications ═══
  addNotification: (n) => set((s) => ({ notifications: [n, ...s.notifications] })),
  markNotificationRead: (id) => set((s) => ({
    notifications: s.notifications.map(n => n.id === id ? { ...n, isRead: true } : n),
  })),
  markAllRead: (tenantId) => set((s) => ({
    notifications: s.notifications.map(n =>
      n.tenantId === tenantId ? { ...n, isRead: true } : n
    ),
  })),
  clearNotifications: (tenantId) => set((s) => ({
    notifications: s.notifications.filter(n => n.tenantId !== tenantId),
  })),
  getUnreadCount: (tenantId) =>
    get().notifications.filter(n => n.tenantId === tenantId && !n.isRead).length,

  // ═══ Super Admin ═══
  addAnnouncement: (a) => set((s) => ({ announcements: [a, ...s.announcements] })),
  removeAnnouncement: (id) => set((s) => ({ announcements: s.announcements.filter(x => x.id !== id) })),
  addAuditLog: (log) => set((s) => ({ auditLogs: [log, ...s.auditLogs] })),
  updateSubscriptionStatus: (id, status) => set((s) => ({
    subscriptions: s.subscriptions.map(sub => sub.id === id ? { ...sub, status } : sub)
  })),
    }),
    {
      name: 'bunyan-erp-v1',
      storage: createJSONStorage(() => localStorage),
    }
  )
);
