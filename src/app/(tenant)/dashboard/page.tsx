// src/app/(tenant)/dashboard/page.tsx
// الوظيفة: لوحة القيادة — 4 بطاقات نبض + مخطط مبيعات 7 أيام + جدول آخر 10 طلبيات (بدون بطاقات أقسام)
// المرجع: الحسابات المالية في calculations.ts
// الصلاحية: OWNER, PARTNER, EMPLOYEE

"use client";

import { useMemo } from "react";
import type { ValueType } from "recharts/types/component/DefaultTooltipContent";
import Link from "next/link";
import { useAuthStore } from "@/core/auth/store";
import { useDataStore } from "@/core/db/store";
import {
  formatCurrency,
  formatRelativeTime,
  formatDateShort,
} from "@/shared/utils/format";
import {
  calcTreasuryBalance,
  calcPendingBalance,
  calcWeeklySales,
  calcPartnerShares,
} from "@/shared/utils/calculations";
import { ORDER_STATUS } from "@/shared/utils/statusColors";
import {
  Package,
  TrendingUp,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  Users,
  Banknote,
  MapPin,
  Truck,
  CheckCircle2,
  ChevronRight,
  LayoutDashboard,
  ShoppingCart,
  Handshake,
  ChevronLeft,
  AlertCircle,
  FileText,
  Wallet,
  Landmark,
} from "lucide-react";
import dynamic from "next/dynamic";

const LineChart = dynamic(() => import("recharts").then((m) => m.LineChart), {
  ssr: false,
});
const Line = dynamic(() => import("recharts").then((m) => m.Line), {
  ssr: false,
});
const XAxis = dynamic(() => import("recharts").then((m) => m.XAxis), {
  ssr: false,
});
const YAxis = dynamic(() => import("recharts").then((m) => m.YAxis), {
  ssr: false,
});
const Tooltip = dynamic(() => import("recharts").then((m) => m.Tooltip), {
  ssr: false,
});
const ResponsiveContainer = dynamic(
  () => import("recharts").then((m) => m.ResponsiveContainer),
  { ssr: false },
);
const PieChart = dynamic(() => import("recharts").then((m) => m.PieChart), {
  ssr: false,
});
const Pie = dynamic(() => import("recharts").then((m) => m.Pie), {
  ssr: false,
});
const Cell = dynamic(() => import("recharts").then((m) => m.Cell), {
  ssr: false,
});
const Legend = dynamic(() => import("recharts").then((m) => m.Legend), {
  ssr: false,
});

const PIE_COLORS = [
  "#4a2570",
  "#8a67a8",
  "#3a1a5a",
  "#6b4090",
  "#2a1045",
  "#a98fc0",
];

export default function DashboardPage() {
  const { user } = useAuthStore();
  const { treasury, orders, debts, partners, products, getForTenant } =
    useDataStore();
  const tid = user?.tenantId || "";

  const myTreasury = getForTenant(treasury, tid);
  const myOrders = getForTenant(orders, tid);
  const myDebts = getForTenant(debts, tid);
  const myPartners = getForTenant(partners, tid);
  const myProducts = getForTenant(products, tid);

  // الحسابات المالية
  const cashBalance = useMemo(
    () => calcTreasuryBalance(myTreasury),
    [myTreasury],
  );
  const courierPending = useMemo(
    () => calcPendingBalance(myTreasury),
    [myTreasury],
  );
  const totalDebts = useMemo(
    () =>
      myDebts
        .filter((d) => d.status !== "paid")
        .reduce((s, d) => s + (d.amount - d.paidAmount), 0),
    [myDebts],
  );
  const totalCapital = useMemo(
    () => myPartners.reduce((s, p) => s + p.capitalContribution, 0),
    [myPartners],
  );

  const weeklySales = useMemo(() => calcWeeklySales(myOrders), [myOrders]);
  const partnerShares = useMemo(
    () => calcPartnerShares(myPartners),
    [myPartners],
  );

  // آخر 10 طلبيات
  const recentOrders = useMemo(() => {
    return [...myOrders]
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      )
      .slice(0, 10);
  }, [myOrders]);

  // نواقص المخزون
  const lowStockCount = useMemo(() => {
    return myProducts.filter(
      (p) => p.quantity <= p.minQuantity && p.quantity > 0,
    ).length;
  }, [myProducts]);

  const stats = [
    {
      label: "النقد بالخزينة",
      value: cashBalance,
      icon: Wallet,
      color: "#4a2570",
      bg: "bg-bunyan-50",
    },
    {
      label: "قيد التحصيل",
      value: courierPending,
      icon: Truck,
      color: "#3a1a5a",
      bg: "bg-bunyan-100",
    },
    {
      label: "الديون النشطة",
      value: totalDebts,
      icon: FileText,
      color: "#6b4090",
      bg: "bg-purple-50",
    },
    {
      label: "رأس المال",
      value: totalCapital,
      icon: Landmark,
      color: "#2a1045",
      bg: "bg-gray-100",
    },
  ];

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      {/* رأس الصفحة + تنبيه نواقص المخزون */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">لوحة القيادة</h1>
          <p className="text-sm text-gray-500 mt-1">
            مرحباً بعودتك، إليك ملخص عملياتك اليوم
          </p>
        </div>
        {lowStockCount > 0 && (
          <Link
            href="/inventory"
            className="flex items-center gap-2 px-4 py-2 bg-amber-50 border border-amber-200 rounded-xl text-amber-700 text-sm hover:bg-amber-100 transition-colors"
          >
            <AlertCircle size={16} />
            <span className="font-semibold">
              {lowStockCount} أصناف تنفد من المخزون
            </span>
            <ChevronLeft size={16} className="text-amber-500" />
          </Link>
        )}
      </div>

      {/* 4 بطاقات إحصاءات */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s) => (
          <div
            key={s.label}
            className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm hover:shadow-card-hover transition-all"
          >
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-medium text-gray-500">
                {s.label}
              </span>
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center ${s.bg}`}
              >
                <s.icon size={20} style={{ color: s.color }} />
              </div>
            </div>
            <p className="text-2xl font-bold text-gray-900 font-currency">
              {formatCurrency(s.value)}
            </p>
          </div>
        ))}
      </div>

      {/* المخططات */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* مخطط مبيعات 7 أيام (يأخذ ثلثين المساحة) */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
          <h2 className="text-base font-bold text-gray-900 mb-6 flex items-center gap-2">
            <div className="w-2 h-6 bg-bunyan-500 rounded-full" />
            تطور المبيعات (آخر 7 أيام)
          </h2>
          <div style={{ width: "100%", height: 260 }}>
            <ResponsiveContainer>
              <LineChart
                data={weeklySales}
                margin={{ top: 5, right: 0, left: -20, bottom: 0 }}
              >
                <XAxis
                  dataKey="day"
                  tick={{ fontSize: 11, fill: "#6b7280" }}
                  axisLine={false}
                  tickLine={false}
                  dy={10}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "#6b7280" }}
                  axisLine={false}
                  tickLine={false}
                  dx={-10}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: 12,
                    border: "none",
                    boxShadow: "0 4px 20px rgba(0,0,0,0.08)",
                    fontSize: 12,
                    fontFamily: "Cairo",
                  }}
                  formatter={(value: ValueType | undefined) => value ? [
                    formatCurrency(value as number),
                    "المبيعات",
                  ] : ['0', '']}
                  labelFormatter={(label: any) => `تاريخ: ${label}`}
                />
                <Line
                  type="monotone"
                  dataKey="amount"
                  stroke="#4a2570"
                  strokeWidth={3}
                  dot={{
                    r: 4,
                    fill: "#4a2570",
                    strokeWidth: 2,
                    stroke: "#fff",
                  }}
                  activeDot={{ r: 6, strokeWidth: 0 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* مخطط حصص الشركاء */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
          <h2 className="text-base font-bold text-gray-900 mb-6 flex items-center gap-2">
            <div className="w-2 h-6 bg-bunyan-500 rounded-full" />
            حصص الشركاء
          </h2>
          {partnerShares.length > 0 ? (
            <div style={{ width: "100%", height: 260 }}>
              <ResponsiveContainer>
                <PieChart margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                  <Pie
                    data={partnerShares}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={85}
                    paddingAngle={2}
                  >
                    {partnerShares.map((_, i) => (
                      <Cell
                        key={i}
                        fill={PIE_COLORS[i % PIE_COLORS.length]}
                        stroke="rgba(255,255,255,0.5)"
                        strokeWidth={2}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      borderRadius: 12,
                      border: "none",
                      boxShadow: "0 4px 20px rgba(0,0,0,0.08)",
                      fontSize: 12,
                      fontFamily: "Cairo",
                    }}
                    formatter={(value: ValueType | undefined) => value ? [`${value}%`, "الحصة"] : ['0', '']}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: 12, paddingTop: "10px" }}
                    iconType="circle"
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-3">
                <Handshake size={24} className="text-gray-400" />
              </div>
              <p className="text-sm font-medium text-gray-500">
                لا يوجد شركاء مسجلين
              </p>
            </div>
          )}
        </div>
      </div>

      {/* آخر 10 طلبيات */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
            <div className="w-2 h-6 bg-bunyan-500 rounded-full" />
            آخر 10 طلبيات
          </h2>
          <Link
            href="/orders"
            className="text-sm font-semibold text-bunyan-600 hover:text-bunyan-700 flex items-center gap-1"
          >
            عرض كل الطلبيات
            <ChevronLeft size={16} />
          </Link>
        </div>

        {recentOrders.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-right">
              <thead className="bg-gray-50 text-gray-500 font-medium border-b border-gray-100">
                <tr>
                  <th className="px-6 py-3">رقم الطلبية</th>
                  <th className="px-6 py-3">الزبون</th>
                  <th className="px-6 py-3">المدينة</th>
                  <th className="px-6 py-3">الإجمالي</th>
                  <th className="px-6 py-3">الحالة</th>
                  <th className="px-6 py-3">الوقت</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {recentOrders.map((order) => {
                  const statusInfo = ORDER_STATUS[
                    order.status as keyof typeof ORDER_STATUS
                  ] || {
                    label: order.status,
                    bg: "bg-gray-50",
                    text: "text-gray-700",
                    border: "border-gray-200",
                    dot: "bg-gray-400",
                  };
                  return (
                    <tr
                      key={order.id}
                      className="hover:bg-gray-50/50 transition-colors"
                    >
                      <td className="px-6 py-4 font-mono font-medium text-gray-900">
                        {order.orderNumber}
                      </td>
                      <td className="px-6 py-4 text-gray-700">
                        {order.customerName}
                      </td>
                      <td className="px-6 py-4 text-gray-600">
                        {order.customerCity}
                      </td>
                      <td className="px-6 py-4 font-currency font-bold text-gray-900">
                        {formatCurrency(order.total)}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${statusInfo.bg} ${statusInfo.text} border ${statusInfo.border || "border-transparent"}`}
                        >
                          {statusInfo.dot && (
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${statusInfo.dot}`}
                            />
                          )}
                          {statusInfo.label}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-gray-500 text-xs">
                        {formatRelativeTime(order.createdAt)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-3">
              <ShoppingCart size={24} className="text-gray-400" />
            </div>
            <p className="text-base font-semibold text-gray-700 mb-1">
              لا توجد طلبيات بعد
            </p>
            <p className="text-sm text-gray-500">
              عندما يقوم الزبائن بالطلب، ستظهر هنا.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
