// src/shared/utils/calculations.ts
// الوظيفة: كل الحسابات المالية — لا تُجرى في Components أبداً
// القاعدة: "لا حسابات مالية في components" — _DOCS/1_SYSTEM_RULES.md
// المرجع: Dashboard, Partners, Treasury

import type { Order, Partner, TreasuryAccount, Employee } from '@/core/db/seed';

/** إجمالي الإيرادات: مجموع total لكل الطلبيات المسلّمة */
export function calcTotalRevenue(orders: Order[]): number {
  return orders.filter((o) => o.status === 'delivered').reduce((s, o) => s + o.total, 0);
}

/** إجمالي التكلفة: مجموع cost items لكل طلبية مسلّمة */
export function calcTotalCost(orders: Order[]): number {
  return orders.filter((o) => o.status === 'delivered').reduce((s, o) =>
    s + o.items.reduce((is, item) => is + item.unitCost * item.quantity, 0), 0
  );
}

/** صافي الربح: الإيرادات - التكلفة */
export function calcNetProfit(orders: Order[]): number {
  return calcTotalRevenue(orders) - calcTotalCost(orders);
}

/** حصة الشريك من الأرباح */
export function calcPartnerShare(partner: Partner, totalProfit: number): number {
  return Math.round((partner.profitPercentage / 100) * totalProfit);
}

/** رصيد الخزينة النقدي */
export function calcTreasuryBalance(accounts: TreasuryAccount[]): number {
  return accounts.filter((a) => a.accountType === 'cash_in_hand').reduce((s, a) => s + a.balance, 0);
}

/** رصيد قيد التحصيل */
export function calcPendingBalance(accounts: TreasuryAccount[]): number {
  return accounts.filter((a) => a.accountType === 'with_courier').reduce((s, a) => s + a.balance, 0);
}

/** إحصائيات الطلبيات: عدد كل حالة */
export function calcOrderStats(orders: Order[]) {
  return {
    total: orders.length,
    pending: orders.filter((o) => o.status === 'pending').length,
    processing: orders.filter((o) => o.status === 'processing').length,
    delivered: orders.filter((o) => o.status === 'delivered').length,
    cancelled: orders.filter((o) => o.status === 'cancelled').length,
    withCourier: orders.filter((o) => o.status === 'with_courier' || o.status === 'with_partner').length,
    pendingReturn: orders.filter((o) => o.status === 'pending_return').length,
    returnConfirmed: orders.filter((o) => o.status === 'return_confirmed').length,
  };
}

/** بيانات مبيعات 7 أيام — بتوزيع حقيقي بناءً على تواريخ الطلبيات المسلّمة */
export function calcWeeklySales(orders: Order[]): { day: string; amount: number }[] {
  const dayNames = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
  const delivered = orders.filter((o) => o.status === 'delivered');
  const now = new Date();
  const result: { day: string; amount: number }[] = [];

  for (let i = 6; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];
    const dayTotal = delivered
      .filter((o) => o.createdAt.startsWith(dateStr))
      .reduce((s, o) => s + o.total, 0);
    result.push({ day: dayNames[date.getDay()], amount: Math.round(dayTotal) });
  }

  return result;
}

/** بيانات مبيعات 30 يوم — بتوزيع حقيقي بناءً على تواريخ الطلبيات المسلّمة */
export function calcMonthlySales(orders: Order[]): { label: string; sales: number; date: string }[] {
  const delivered = orders.filter((o) => o.status === 'delivered');
  const now = new Date();
  const result: { label: string; sales: number; date: string }[] = [];

  for (let i = 29; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];
    const dayTotal = delivered
      .filter((o) => o.createdAt.startsWith(dateStr))
      .reduce((s, o) => s + o.total, 0);
    result.push({
      label: `${date.getDate()}/${date.getMonth() + 1}`,
      sales: Math.round(dayTotal),
      date: dateStr,
    });
  }

  return result;
}

/** إجمالي مبيعات اليوم */
export function calcTodaySales(orders: Order[]): number {
  const today = new Date().toISOString().split('T')[0];
  return orders
    .filter((o) => o.status === 'delivered' && o.createdAt.startsWith(today))
    .reduce((s, o) => s + o.total, 0);
}

/** أعلى 5 منتجات مبيعاً (من order items) */
export function calcTopProducts(orders: Order[]): { id: string; name: string; qty: number; revenue: number }[] {
  const delivered = orders.filter((o) => o.status === 'delivered');
  const productMap: Record<string, { id: string; name: string; qty: number; revenue: number }> = {};

  delivered.forEach((o) => {
    o.items.forEach((item) => {
      if (!productMap[item.productId]) {
        productMap[item.productId] = { id: item.productId, name: item.productName, qty: 0, revenue: 0 };
      }
      productMap[item.productId].qty += item.quantity;
      productMap[item.productId].revenue += item.total;
    });
  });

  return Object.values(productMap)
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 5);
}

/** حصص الشركاء (لـ Pie Chart) */
export function calcPartnerShares(partners: Partner[]): { name: string; value: number; percentage: number }[] {
  const totalPercentage = partners.reduce((s, p) => s + p.profitPercentage, 0);
  return partners.map((p) => ({
    name: p.name,
    value: p.profitPercentage,
    percentage: totalPercentage > 0 ? (p.profitPercentage / totalPercentage) * 100 : 0,
  }));
}

/** الراتب المستحق لموظف */
export function calcDueSalary(employee: Employee): number {
  const now = new Date();
  const lastPayDay = new Date(now.getFullYear(), now.getMonth(), employee.salaryDay);
  if (lastPayDay > now) lastPayDay.setMonth(lastPayDay.getMonth() - 1);
  const daysSince = Math.max(0, Math.floor((now.getTime() - lastPayDay.getTime()) / (1000 * 60 * 60 * 24)));
  return Math.round((employee.salary / 30) * daysSince);
}
