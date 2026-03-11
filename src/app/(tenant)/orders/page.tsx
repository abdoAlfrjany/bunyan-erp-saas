// src/app/(tenant)/orders/page.tsx
// الوظيفة: صفحة الطلبيات — جدول + فلاتر متقدمة + إنشاء طلبية + تغيير حالة
// الجداول: orders, products, couriers
// الصلاحية: OWNER (كامل), EMPLOYEE (إضافة + قراءة), PARTNER (عرض طلبياته فقط - لم ينفذ هنا بل في db/store)

"use client";

import { useState, useMemo, useEffect } from "react";
import { useAuthStore } from "@/core/auth/store";
import { useDataStore } from "@/core/db/store";
import { formatCurrency, formatDate, formatDateTiny } from "@/shared/utils/format";
import { SlideOver } from "@/shared/components/ui/SlideOver";
import { ConfirmDialog } from "@/shared/components/ui/ConfirmDialog";
import { useToast } from "@/shared/components/ui/Toast";
import { ORDER_STATUS } from "@/shared/utils/statusColors";
import {
  ShoppingCart,
  Search,
  Plus,
  Trash2,
  Package,
  CheckCircle2,
  Truck,
  Ban,
  RotateCcw,
  ArrowDownCircle,
  Filter,
  Calendar,
  Percent,
  X,
  ChevronDown,
} from "lucide-react";
import type { Order, Product } from "@/core/db/seed";

// ═══ الانتقالات المسموحة لكل حالة ═══
const NEXT_STATUSES: Record<
  string,
  {
    status: Order["status"];
    label: string;
    icon: React.ReactNode;
    bg: string;
    text: string;
    hover: string;
  }[]
> = {
  pending: [
    {
      status: "processing",
      label: "تجهيز",
      icon: <Package size={14} />,
      bg: "bg-indigo-50",
      text: "text-indigo-700",
      hover: "hover:bg-indigo-100",
    },
    {
      status: "cancelled",
      label: "إلغاء",
      icon: <Ban size={14} />,
      bg: "bg-red-50",
      text: "text-red-700",
      hover: "hover:bg-red-100",
    },
  ],
  processing: [
    {
      status: "with_courier",
      label: "للتوصيل",
      icon: <Truck size={14} />,
      bg: "bg-cyan-50",
      text: "text-cyan-700",
      hover: "hover:bg-cyan-100",
    },
    {
      status: "cancelled",
      label: "إلغاء",
      icon: <Ban size={14} />,
      bg: "bg-red-50",
      text: "text-red-700",
      hover: "hover:bg-red-100",
    },
  ],
  with_courier: [
    {
      status: "delivered",
      label: "تم ✓",
      icon: <CheckCircle2 size={14} />,
      bg: "bg-emerald-50",
      text: "text-emerald-700",
      hover: "hover:bg-emerald-100",
    },
    {
      status: "pending_return",
      label: "إرجاع",
      icon: <RotateCcw size={14} />,
      bg: "bg-yellow-50",
      text: "text-yellow-700",
      hover: "hover:bg-yellow-100",
    },
  ],
  with_partner: [
    {
      status: "delivered",
      label: "تم ✓",
      icon: <CheckCircle2 size={14} />,
      bg: "bg-emerald-50",
      text: "text-emerald-700",
      hover: "hover:bg-emerald-100",
    },
    {
      status: "pending_return",
      label: "إرجاع",
      icon: <RotateCcw size={14} />,
      bg: "bg-yellow-50",
      text: "text-yellow-700",
      hover: "hover:bg-yellow-100",
    },
  ],
  pending_return: [
    {
      status: "return_confirmed",
      label: "تأكيد الإرجاع",
      icon: <ArrowDownCircle size={14} />,
      bg: "bg-gray-100",
      text: "text-gray-700",
      hover: "hover:bg-gray-200",
    },
  ],
};

type StatusFilter = "all" | Order["status"];

export default function OrdersPage() {
  const { user } = useAuthStore();
  const {
    orders,
    products,
    couriers,
    getForTenant,
    addOrder,
    updateOrderStatus,
    deleteOrder,
  } = useDataStore();
  const { showToast } = useToast();
  const tid = user?.tenantId || "";

  const myOrders = getForTenant(orders, tid);
  const myProducts = getForTenant(products, tid);
  const myCouriers = getForTenant(couriers, tid).filter((c) => c.isActive);

  // الفلاتر
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // الواجهة
  const [slideOpen, setSlideOpen] = useState(false);
  const [editOrder, setEditOrder] = useState<Order | null>(null);
  const [viewOrder, setViewOrder] = useState<Order | null>(null);
  const [deleteOrderId, setDeleteOrderId] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<{
    id: string;
    status: Order["status"];
    label: string;
  } | null>(null);
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);

  // إغلاق الـ Dropdown عند الضغط خارجه
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('[data-dropdown="true"]')) {
        setOpenDropdownId(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // نموذج طلبية جديدة
  const [newOrder, setNewOrder] = useState({
    customerName: "",
    customerPhone: "",
    customerAddress: "",
    customerCity: "",
    deliveryType: "courier_company" as
      | "internal"
      | "courier_company"
      | "pickup",
    courierId: "",
    notes: "",
    discount: 0,
    priceIncludesDelivery: false,
  });
  const [orderItems, setOrderItems] = useState<
    { productId: string; quantity: number; variantSize?: string }[]
  >([]);
  const [productSearch, setProductSearch] = useState("");

  const customers = useDataStore((s) => s.customers || []);
  const myCustomers = useMemo(
    () => getForTenant(customers, tid),
    [customers, tid, getForTenant],
  );

  // ═══ الفلترة ═══
  // الخطوة الأولى: بحث نصي + نطاق التاريخ فقط (بدون فلتر الحالة)
  const dateFiltered = useMemo(() => {
    let result = [...myOrders].sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );

    if (search) {
      const s = search.toLowerCase();
      result = result.filter(
        (o) =>
          o.orderNumber.toLowerCase().includes(s) ||
          o.customerName.toLowerCase().includes(s) ||
          o.customerPhone.includes(s),
      );
    }

    if (dateFrom) {
      result = result.filter((o) => o.createdAt >= dateFrom);
    }

    if (dateTo) {
      result = result.filter((o) => o.createdAt <= dateTo);
    }

    return result;
  }, [myOrders, search, dateFrom, dateTo]);

  // الخطوة الثانية: تطبيق فلتر الحالة فوق dateFiltered
  const filtered = useMemo(() => {
    if (statusFilter === "all") return dateFiltered;
    
    return dateFiltered.filter((o) => {
      if (statusFilter === "pending") {
        return o.status === "pending" || o.status === "processing";
      }
      if (statusFilter === "with_courier") {
        return o.status === "with_courier" || o.status === "with_partner";
      }
      if (statusFilter === "cancelled") {
        return o.status === "cancelled" || o.status === "return_confirmed";
      }
      return o.status === statusFilter;
    });
  }, [dateFiltered, statusFilter]);

  // ═══ إدارة عناصر الطلبية ═══
  const addItem = () =>
    setOrderItems([
      ...orderItems,
      { productId: "", quantity: 1, variantSize: "" },
    ]);
  const removeItem = (idx: number) =>
    setOrderItems(orderItems.filter((_, i) => i !== idx));
  const updateItem = (
    idx: number,
    field: "productId" | "quantity" | "variantSize",
    value: string | number,
  ) => {
    setOrderItems(
      orderItems.map((item, i) =>
        i === idx ? { ...item, [field]: value } : item,
      ),
    );
  };

  // معالجة تغيير وتلخيص الهاتف للزبون - البحث التلقائي
  const handlePhoneChange = (val: string) => {
    setNewOrder((prev) => ({ ...prev, customerPhone: val }));
    if (val.length === 10 && val.match(/^09[1-5]\d{7}$/)) {
      const found = myCustomers.find((c) => c.phone === val);
      if (found) {
        setNewOrder((prev) => ({
          ...prev,
          customerName: found.name,
          customerCity: found.city || "",
          customerAddress: found.address || "",
        }));
        showToast("تم العثور على بيانات الزبون وجلبها تلقائياً", "success");
      }
    }
  };

  // الحسابات للنموذج
  const orderCalculations = useMemo(() => {
    const subtotal = orderItems.reduce((sum, item) => {
      const p = myProducts.find((pr) => pr.id === item.productId);
      return sum + (p ? p.sellingPrice * item.quantity : 0);
    }, 0);

    const courier = myCouriers.find((c) => c.id === newOrder.courierId);
    const deliveryFee =
      newOrder.deliveryType === "courier_company" && courier
        ? courier.defaultDeliveryFee
        : 0;
    const discount = Number(newOrder.discount) || 0;

    const total = Math.max(
      0,
      subtotal - discount + (newOrder.priceIncludesDelivery ? 0 : deliveryFee),
    );

    return { subtotal, deliveryFee, discount, total };
  }, [
    orderItems,
    myProducts,
    myCouriers,
    newOrder.courierId,
    newOrder.discount,
    newOrder.priceIncludesDelivery,
    newOrder.deliveryType,
  ]);

  // ═══ إنشاء أو تعديل الطلبية ═══
  const handleCreateOrder = () => {
    if (
      !newOrder.customerName ||
      !newOrder.customerPhone ||
      orderItems.length === 0
    ) {
      showToast("يرجى ملء بيانات الزبون وإضافة منتج واحد على الأقل", "error");
      return;
    }

    // التحقق من صحة الهاتف
    if (!/^09[1-5]\d{7}$/.test(newOrder.customerPhone)) {
      showToast(
        "رقم الهاتف يجب أن يبدأ بـ 091/092/093/094/095 ويتكون من 10 أرقام",
        "error",
      );
      return;
    }

    if (newOrder.deliveryType === "courier_company" && !newOrder.courierId) {
      showToast("يرجى اختيار شركة التوصيل", "error");
      return;
    }

    const validItems = orderItems.filter((i) => i.productId && i.quantity > 0);
    if (validItems.length === 0) {
      showToast("خطأ في المنتجات المدخلة", "error");
      return;
    }

    // التحقق من توافر الكميات
    const outOfStockItems = validItems.filter((item) => {
      const p = myProducts.find((pr) => pr.id === item.productId);
      if (!p) return true;
      if (p.productType === "clothing" && item.variantSize) {
        const variant = p.variants?.find((v) => v.size === item.variantSize);
        return !variant || variant.quantity < item.quantity;
      }
      return p.quantity < item.quantity;
    });

    if (outOfStockItems.length > 0) {
      showToast(
        "بعض المنتجات لا تتوفر منها الكمية المطلوبة في المخزون (أو المقاس المطلوب)",
        "error",
      );
      return;
    }

    const { subtotal, deliveryFee, discount, total } = orderCalculations;

    if (editOrder) {
      deleteOrder(editOrder.id);
      
      const order: Order = {
        ...editOrder, // للحفاظ على id, createdAt, orderNumber, status
        customerName: newOrder.customerName,
        customerPhone: newOrder.customerPhone,
        customerAddress: newOrder.customerAddress,
        customerCity: newOrder.customerCity,
        deliveryType: newOrder.deliveryType,
        courierCompanyId: newOrder.courierId || undefined,
        deliveryFee,
        subtotal,
        discount,
        total,
        priceIncludesDelivery: newOrder.priceIncludesDelivery,
        notes: newOrder.notes || undefined,
        items: validItems.map((item, idx) => {
          const p = myProducts.find((pr) => pr.id === item.productId) as Product;
          return {
            id: `oi-edit-${Date.now()}-${idx}`,
            productId: p.id,
            productName: item.variantSize
              ? `${p.name} - مقاس: ${item.variantSize}`
              : p.name,
            variantSize: item.variantSize,
            quantity: item.quantity,
            unitPrice: p.sellingPrice,
            unitCost: p.costPrice,
            total: p.sellingPrice * item.quantity,
          };
        }),
      };
      
      addOrder(order);
      setEditOrder(null);
      showToast('تم تعديل الطلبية بنجاح');
    } else {
      const orderNum = `ORD-${new Date().getFullYear()}-${String(myOrders.length + 1).padStart(4, "0")}`;
      const order: Order = {
        id: `ord-${Date.now()}`,
        tenantId: tid,
        orderNumber: orderNum,
        customerName: newOrder.customerName,
        customerPhone: newOrder.customerPhone,
        customerAddress: newOrder.customerAddress,
        customerCity: newOrder.customerCity,
        deliveryType: newOrder.deliveryType,
        courierCompanyId: newOrder.courierId || undefined,
        deliveryFee,
        status: "pending",
        subtotal,
        discount,
        total,
        priceIncludesDelivery: newOrder.priceIncludesDelivery,
        paymentStatus: "pending",
        source: "direct",
        notes: newOrder.notes || undefined,
        createdAt: new Date().toISOString().split("T")[0],
        items: validItems.map((item, idx) => {
          const p = myProducts.find((pr) => pr.id === item.productId) as Product;
          return {
            id: `oi-new-${Date.now()}-${idx}`,
            productId: p.id,
            productName: item.variantSize
              ? `${p.name} - مقاس: ${item.variantSize}`
              : p.name,
            variantSize: item.variantSize,
            quantity: item.quantity,
            unitPrice: p.sellingPrice,
            unitCost: p.costPrice,
            total: p.sellingPrice * item.quantity,
          };
        }),
      };

      addOrder(order);
      showToast(`تم إنشاء الطلبية ${orderNum} بنجاح`);
    }

    setSlideOpen(false);
    setNewOrder({
      customerName: "",
      customerPhone: "",
      customerAddress: "",
      customerCity: "",
      deliveryType: "courier_company",
      courierId: "",
      notes: "",
      discount: 0,
      priceIncludesDelivery: false,
    });
    setOrderItems([]);
  };

  // ═══ تغيير حالة الطلبية ═══
  const handleStatusChange = (orderId: string, newStatus: Order["status"]) => {
    const order = myOrders.find((o) => o.id === orderId);
    if (
      order &&
      (order.status === "delivered" || order.status === "cancelled") &&
      newStatus !== "return_confirmed"
    ) {
      showToast(
        "لا يمكن تعديل حالة طلبية مسلّمة أو ملغاة (إلا إذا تم تأكيد إرجاعها)",
        "error",
      );
      return;
    }

    const label =
      ORDER_STATUS[newStatus as keyof typeof ORDER_STATUS]?.label || newStatus;
    setConfirmAction({ id: orderId, status: newStatus, label });
  };

  const handleConfirmAction = () => {
    if (confirmAction) {
      updateOrderStatus(confirmAction.id, confirmAction.status);
      showToast(`تم تغيير حالة الطلبية إلى: ${confirmAction.label}`, "success");
      setConfirmAction(null);
    }
  };

  const statusFiltersList: { key: StatusFilter; label: string; dot?: string }[] = [
    { key: "all", label: "الكل" },
    { key: "pending", label: "جديدة", dot: "bg-amber-400" },
    { key: "with_courier", label: "قيد التوصيل", dot: "bg-orange-400" },
    { key: "delivered", label: "مسلّمة", dot: "bg-emerald-400" },
    { key: "pending_return", label: "معلقة للإرجاع", dot: "bg-gray-400" },
    { key: "cancelled", label: "ملغاة", dot: "bg-red-400" },
  ];

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      {/* رأس الصفحة */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <ShoppingCart size={24} className="text-bunyan-600" />
            الطلبيات والمبيعات
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            تتبع رحلة الطلبيات من الإنشاء وحتى التوصيل
          </p>
        </div>
        <button
          onClick={() => setSlideOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-bunyan-600 text-white rounded-xl text-sm font-bold hover:bg-bunyan-700 transition-colors shadow-sm focus:ring-2 focus:ring-bunyan-500/50"
        >
          <Plus size={18} /> طلبية جديدة
        </button>
      </div>

      {/* شريط البحث والفلترة */}
      <div className="flex flex-col gap-4 bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search
              size={18}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
            />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="بحث برقم الطلبية أو اسم الزبون..."
              className="w-full pr-10 pl-4 py-2 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-bunyan-500/30 focus:border-bunyan-500 transition-all"
            />
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold text-gray-400 pr-1">من تاريخ</label>
              <div className="min-w-[140px]">
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-bunyan-500/30 focus:border-bunyan-500 transition-all font-mono"
                />
              </div>
            </div>
            
            <div className="pb-2.5 text-gray-300 font-bold">←</div>

            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold text-gray-400 pr-1">إلى تاريخ</label>
              <div className="min-w-[140px]">
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-bunyan-500/30 focus:border-bunyan-500 transition-all font-mono"
                />
              </div>
            </div>
          </div>
        </div>

        {/* فلاتر الحالات (Status Filters) */}
        <div className="flex flex-wrap gap-2 pt-3 border-t border-gray-100 items-center justify-between">
          <div className="flex flex-wrap gap-2">
            {statusFiltersList.map((f) => {
              const count =
                f.key === "all"
                  ? dateFiltered.length
                  : f.key === "pending"
                  ? dateFiltered.filter((o) => o.status === "pending" || o.status === "processing").length
                  : f.key === "with_courier"
                  ? dateFiltered.filter((o) => o.status === "with_courier" || o.status === "with_partner").length
                  : f.key === "cancelled"
                  ? dateFiltered.filter((o) => o.status === "cancelled" || o.status === "return_confirmed").length
                  : dateFiltered.filter((o) => o.status === f.key).length;
              return (
                <button
                  key={f.key}
                  onClick={() => setStatusFilter(f.key)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all border ${
                    statusFilter === f.key
                      ? "bg-bunyan-600 text-white border-bunyan-600 shadow-sm"
                      : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                  }`}
                >
                  {f.dot && (
                    <span className={`w-2 h-2 rounded-full ${f.dot} inline-block ml-1`} />
                  )}
                  {f.label}
                  {count > 0 && (
                    <span
                      className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                        statusFilter === f.key
                          ? "bg-white/20 text-white"
                          : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* زر التصفير */}
          {(search || dateFrom || dateTo || statusFilter !== "all") && (
            <button
              onClick={() => {
                setDateFrom("");
                setDateTo("");
                setStatusFilter("all");
                setSearch("");
              }}
              className="px-3 py-2 flex items-center gap-1.5 text-xs font-bold text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
            >
              <X size={14} /> مسح
            </button>
          )}
        </div>
      </div>

      {/* جدول الطلبيات */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-right">
            <thead className="bg-gray-50 text-gray-500 font-medium border-b border-gray-100">
              <tr>
                <th className="px-6 py-4">الطلبية</th>
                <th className="px-6 py-4">الزبون و المدينة</th>
                <th className="px-6 py-4">الحالة</th>
                <th className="px-6 py-4">الإجمالي</th>
                <th className="px-6 py-4 font-center">التاريخ</th>
                <th className="px-6 py-4 text-center">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map((o) => {
                const statusInfo =
                  ORDER_STATUS[o.status as keyof typeof ORDER_STATUS];
                const actions = NEXT_STATUSES[o.status] || [];
                return (
                  <tr
                    key={o.id}
                    className="hover:bg-gray-50/70 transition-colors"
                  >
                    <td className="px-6 py-4 font-bold text-gray-900 font-mono">
                      {o.orderNumber}
                      {o.notes && (
                        <p className="text-[10px] text-gray-400 font-sans font-normal mt-0.5 max-w-[120px] truncate">
                          {o.notes}
                        </p>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <p className="font-semibold text-gray-900">
                        {o.customerName}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {o.customerCity} —{" "}
                        <span dir="ltr">{o.customerPhone}</span>
                      </p>
                    </td>
                    <td className="px-6 py-4 relative">
                      {statusInfo ? (
                        <div className="relative inline-block" data-dropdown="true">
                          {actions.length > 0 ? (
                            <button
                              onClick={() => setOpenDropdownId(openDropdownId === o.id ? null : o.id)}
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${statusInfo.bg} ${statusInfo.text} border ${statusInfo.border || "border-transparent"} hover:bg-opacity-80 transition-all`}
                            >
                              {statusInfo.dot && (
                                <span className={`w-1.5 h-1.5 rounded-full ${statusInfo.dot}`} />
                              )}
                              {statusInfo.label}
                              <ChevronDown size={12} className={`transition-transform duration-200 ${openDropdownId === o.id ? "rotate-180" : ""}`} />
                            </button>
                          ) : (
                            <span
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${statusInfo.bg} ${statusInfo.text} border ${statusInfo.border || "border-transparent"}`}
                            >
                              {statusInfo.dot && (
                                <span className={`w-1.5 h-1.5 rounded-full ${statusInfo.dot}`} />
                              )}
                              {statusInfo.label}
                            </span>
                          )}

                          {/* القائمة المنسدلة (Dropdown) */}
                          {openDropdownId === o.id && actions.length > 0 && (
                            <div className="absolute top-full right-0 mt-1 w-44 bg-white rounded-xl shadow-xl border border-gray-100 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                              <div className="p-1 px-1.5 py-1.5 bg-gray-50/50 border-b border-gray-100 text-[10px] font-bold text-gray-400">تغيير الحالة إلى:</div>
                              <div className="p-1">
                                {actions.map((a) => (
                                  <button
                                    key={a.status}
                                    onClick={() => {
                                      handleStatusChange(o.id, a.status);
                                      setOpenDropdownId(null);
                                    }}
                                    className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold ${a.bg} ${a.text} ${a.hover} transition-colors text-right mb-0.5 last:mb-0`}
                                  >
                                    {a.icon}
                                    {a.label}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-gray-500">{o.status}</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <p className="font-bold text-gray-900 font-currency">
                        {formatCurrency(o.total)}
                      </p>
                      {o.discount && o.discount > 0 ? (
                        <p className="text-[10px] text-green-600 font-semibold mt-0.5">
                          خصم: {formatCurrency(o.discount)}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-6 py-4 text-gray-700 text-sm font-medium text-right">
                      <span dir="ltr">
                        {new Date(o.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex gap-2 justify-center">
                        <button 
                          onClick={() => setViewOrder(o)}
                          className="p-1.5 rounded-lg transition-colors text-gray-400 hover:text-blue-600 hover:bg-blue-50"
                          title="تفاصيل الطلبية"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"/><circle cx="12" cy="12" r="3"/></svg>
                        </button>

                        <button
                          onClick={() => {
                            setEditOrder(o);
                            setNewOrder({
                              customerName: o.customerName,
                              customerPhone: o.customerPhone,
                              customerAddress: o.customerAddress || '',
                              customerCity: o.customerCity || '',
                              deliveryType: o.deliveryType,
                              courierId: o.courierCompanyId || '',
                              notes: o.notes || '',
                              discount: o.discount || 0,
                              priceIncludesDelivery: o.priceIncludesDelivery,
                            });
                            setOrderItems(o.items.map(i => ({
                              productId: i.productId,
                              quantity: i.quantity,
                              variantSize: i.variantSize || ''
                            })));
                          }}
                          disabled={["delivered", "cancelled", "return_confirmed"].includes(o.status)}
                          className={`p-1.5 rounded-lg transition-colors ${
                            ["delivered", "cancelled", "return_confirmed"].includes(o.status)
                              ? 'opacity-30 cursor-not-allowed text-gray-400'
                              : 'text-gray-400 hover:text-bunyan-600 hover:bg-bunyan-50'
                          }`}
                          title="تعديل الطلبية"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>
                        </button>
                        
                        {/* زر الحذف للحالات الجديدة فقط */}
                        {["pending", "processing"].includes(o.status) && (
                          <button
                            onClick={() => setDeleteOrderId(o.id)}
                            className="p-1.5 rounded-lg transition-colors text-gray-400 hover:text-red-600 hover:bg-red-50"
                            title="حذف الطلبية"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {filtered.length === 0 && (
          <div className="text-center py-16">
            <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <ShoppingCart size={28} className="text-gray-400" />
            </div>
            <p className="text-base font-bold text-gray-900 mb-1">
              لا توجد طلبيات مطابقة
            </p>
            <p className="text-sm text-gray-500">
              جرب تعديل الفلاتر أو إضافتها.
            </p>
          </div>
        )}
      </div>

      {/* ═══ SlideOver: إنشاء / تعديل طلبية ═══ */}
      <SlideOver
        isOpen={slideOpen || !!editOrder}
        onClose={() => { setSlideOpen(false); setEditOrder(null); }}
        title={editOrder ? "تعديل الطلبية" : "إنشاء طلبية جديدة"}
        width="w-full sm:max-w-6xl"
      >
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full pb-20">
          {/* 1. القسم الأيمن: المنتجات المتوفرة (5 أعمدة) */}
          <div className="lg:col-span-5 flex flex-col gap-4 border border-gray-200 rounded-xl p-4 bg-gray-50 h-[calc(100vh-140px)] overflow-y-auto">
            <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
              <div className="w-1.5 h-4 bg-bunyan-500 rounded-full" />
              جدول المنتجات المتاحة
            </h3>
            <div className="relative">
              <Search
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                size={16}
              />
              <input
                type="text"
                placeholder="بحث سريع في المنتجات..."
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                className="w-full pl-3 pr-9 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-bunyan-500 shadow-sm"
              />
            </div>

            <div className="space-y-2 mt-2">
              {myProducts
                .filter(
                  (p) =>
                    p.quantity > 0 &&
                    p.isActive &&
                    (p.name.includes(productSearch) ||
                      String(p.itemCode).includes(productSearch)),
                )
                .map((p) => (
                  <div
                    key={p.id}
                    className="bg-white p-3 border border-gray-100 rounded-xl flex items-center justify-between shadow-sm hover:border-bunyan-300 transition-colors"
                  >
                    <div>
                      <p className="text-sm font-bold text-gray-900">
                        {p.name}
                      </p>
                      <p className="text-xs text-gray-500 font-mono mt-0.5">
                        BN{p.itemCode} • متاح {p.quantity}
                      </p>
                    </div>
                    <div className="flex flex-col items-end">
                      <p className="text-sm font-bold font-currency text-bunyan-600 mb-2">
                        {formatCurrency(p.sellingPrice)}
                      </p>
                      <button
                        onClick={() =>
                          setOrderItems([
                            { productId: p.id, quantity: 1, variantSize: "" },
                            ...orderItems,
                          ])
                        }
                        className="px-2 py-1 bg-bunyan-50 text-bunyan-700 rounded text-xs font-bold hover:bg-bunyan-100 transition-colors"
                      >
                        إضافة للسلة +
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          </div>

          {/* 2. القسم الأيسر: بيانات الزبون + السلة + التوصيل + الملخص (7 أعمدة) */}
          <div className="lg:col-span-7 flex flex-col gap-6 h-[calc(100vh-140px)] overflow-y-auto pr-2 pb-10">
            {/* أ. السلة */}
            <div className="border border-gray-200 rounded-xl p-4 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                  <div className="w-1.5 h-4 bg-bunyan-500 rounded-full" />
                  سلة المشتريات
                </h3>
                <span className="bg-bunyan-100 text-bunyan-800 text-xs font-bold px-2 py-1 rounded-full">
                  {orderItems.length} عناصر
                </span>
              </div>
              <div className="space-y-3">
                {orderItems.map((item, idx) => {
                  const selectedProduct = myProducts.find(
                    (p) => p.id === item.productId,
                  );
                  return (
                    <div
                      key={idx}
                      className="flex flex-col sm:flex-row gap-2 bg-gray-50 p-2 rounded-xl border border-gray-100 items-start sm:items-center"
                    >
                      <div className="flex-1 w-full flex items-center gap-2 truncate">
                        {/* Optional small thumb can go here */}
                        <p className="text-sm font-bold text-gray-800 truncate">
                          {selectedProduct?.name || "لم يحدد"}
                        </p>
                      </div>
                      {selectedProduct?.productType === "clothing" && (
                        <div className="w-full sm:w-28">
                          <select
                            value={item.variantSize || ""}
                            onChange={(e) =>
                              updateItem(idx, "variantSize", e.target.value)
                            }
                            className="w-full px-2 py-1 border border-gray-200 rounded-lg text-xs bg-white focus:outline-none focus:border-bunyan-500"
                          >
                            <option value="">المقاس...</option>
                            {selectedProduct.variants
                              ?.filter((v) => v.quantity > 0)
                              .map((v) => (
                                <option key={v.size} value={v.size}>
                                  {v.size} ({v.quantity})
                                </option>
                              ))}
                          </select>
                        </div>
                      )}
                      <div className="flex items-center gap-2 w-full sm:w-auto mt-2 sm:mt-0">
                        <div className="w-20">
                          <input
                            type="number"
                            min={1}
                            max={
                              selectedProduct?.productType === "clothing" &&
                              item.variantSize
                                ? selectedProduct.variants?.find(
                                    (v) => v.size === item.variantSize,
                                  )?.quantity || 9999
                                : selectedProduct?.quantity || 9999
                            }
                            value={item.quantity}
                            onChange={(e) =>
                              updateItem(
                                idx,
                                "quantity",
                                parseInt(e.target.value) || 1,
                              )
                            }
                            className="w-full px-2 py-1 border border-gray-200 rounded-lg text-sm text-center focus:outline-none focus:border-bunyan-500"
                            placeholder="الكمية"
                          />
                        </div>
                        <div className="w-24 text-center font-bold font-currency text-sm text-gray-900">
                          {formatCurrency(
                            (selectedProduct?.sellingPrice || 0) *
                              item.quantity,
                          )}
                        </div>
                        <button
                          onClick={() => removeItem(idx)}
                          className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors ms-auto sm:ms-0"
                          title="إزالة"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  );
                })}
                {orderItems.length === 0 && (
                  <div className="text-center py-6 border-2 border-dashed border-gray-200 rounded-xl">
                    <Package size={24} className="text-gray-300 mx-auto mb-2" />
                    <p className="text-xs font-semibold text-gray-500">
                      سلة المشتريات فارغة. اختر من المنتجات جانبًا.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* ب. بيانات الزبون */}
            <div className="bg-bunyan-50 border border-bunyan-200 rounded-xl p-4 shadow-sm">
              <h3 className="text-sm font-bold text-bunyan-900 mb-4 flex items-center gap-2">
                <div className="w-1.5 h-4 bg-bunyan-500 rounded-full" />
                بيانات الزبون
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* 1. الهاتف */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1.5">
                    رقم الهاتف (للبحث أو الإضافة) *
                  </label>
                  <input
                    type="tel"
                    value={newOrder.customerPhone}
                    onChange={(e) => handlePhoneChange(e.target.value)}
                    maxLength={10}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-bunyan-500/30 focus:border-bunyan-500"
                    placeholder="09XXXXXXXX"
                    dir="ltr"
                  />
                </div>
                {/* 2. الاسم */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1.5">
                    اسم الزبون *
                  </label>
                  <input
                    type="text"
                    value={newOrder.customerName}
                    onChange={(e) =>
                      setNewOrder({ ...newOrder, customerName: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-bunyan-500/30 focus:border-bunyan-500"
                    placeholder="مثال: أحمد محمد"
                  />
                </div>
                {/* 3. المدينة */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1.5">
                    المدينة
                  </label>
                  <input
                    type="text"
                    value={newOrder.customerCity}
                    onChange={(e) =>
                      setNewOrder({ ...newOrder, customerCity: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-bunyan-500/30 focus:border-bunyan-500"
                    placeholder="مثال: طرابلس"
                  />
                </div>
                {/* 4. العنوان */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1.5">
                    العنوان بالتفصيل
                  </label>
                  <input
                    type="text"
                    value={newOrder.customerAddress}
                    onChange={(e) =>
                      setNewOrder({
                        ...newOrder,
                        customerAddress: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-bunyan-500/30 focus:border-bunyan-500"
                    placeholder="الحي الشارع، أقرب نقطة..."
                  />
                </div>
              </div>
            </div>

            {/* ج. التوصيل والملاحظات */}
            <div className="border border-gray-200 rounded-xl p-4 shadow-sm">
              <h3 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2">
                <div className="w-1.5 h-4 bg-bunyan-500 rounded-full" />
                خيارات التوصيل والملاحظات
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* نوع التوصيل */}
                <div>
                  <label className="text-xs font-bold text-gray-700 mb-1.5 flex items-center gap-1.5">
                    نوع التوصيل
                  </label>
                  <select
                    value={newOrder.deliveryType}
                    onChange={(e) =>
                      setNewOrder({
                        ...newOrder,
                        deliveryType: e.target.value as any,
                        courierId: "",
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:border-bunyan-500"
                  >
                    <option value="courier_company">شحن عبر شركة توصيل</option>
                    <option value="internal">توصيل داخلي / مندوب خاص</option>
                    <option value="pickup">استلام من المحل</option>
                  </select>
                </div>
                {/* شركة التوصيل (ان وجد) */}
                {newOrder.deliveryType === "courier_company" && (
                  <div>
                    <label className="text-xs font-bold text-gray-700 mb-1.5 flex items-center gap-1.5">
                      شركة التوصيل المعتمدة
                    </label>
                    <select
                      value={newOrder.courierId}
                      onChange={(e) =>
                        setNewOrder({
                          ...newOrder,
                          courierId: e.target.value,
                          customerCity: "",
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:border-bunyan-500"
                    >
                      <option value="">اختر الشركة...</option>
                      {myCouriers.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} — أساسي:{" "}
                          {formatCurrency(c.defaultDeliveryFee)}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* مدينة التوصيل المتاحة للشركة المحددة */}
                {newOrder.deliveryType === "courier_company" &&
                  newOrder.courierId && (
                    <div className="sm:col-span-2">
                      <label className="text-xs font-bold text-gray-700 mb-1.5 flex items-center gap-1.5">
                        المدينة المعتمدة للشركة المختارة
                      </label>
                      <select
                        value={newOrder.customerCity}
                        onChange={(e) =>
                          setNewOrder({
                            ...newOrder,
                            customerCity: e.target.value,
                          })
                        }
                        className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:border-bunyan-500"
                      >
                        <option value="">اختر مدينة الشحن المعتمدة...</option>
                        {(
                          myCouriers.find((c) => c.id === newOrder.courierId)
                            ?.cities || []
                        ).map((city) => (
                          <option key={city} value={city}>
                            {city}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                {/* هل السعر شامل التوصيل؟ */}
                <div className="sm:col-span-2 flex items-center mt-2 bg-gray-50 border border-gray-100 p-3 rounded-lg">
                  <label className="flex items-center gap-2 cursor-pointer text-sm font-bold text-gray-800">
                    <input
                      type="checkbox"
                      className="w-4 h-4 text-bunyan-600 border-gray-300 rounded focus:ring-bunyan-500"
                      checked={newOrder.priceIncludesDelivery}
                      onChange={(e) =>
                        setNewOrder({
                          ...newOrder,
                          priceIncludesDelivery: e.target.checked,
                        })
                      }
                    />
                    هل إجمالي المنتجات والخصم يشمل مصاريف التوصيل؟ (في حالة نعم
                    سيتم تصفير الرسالة من الإجمالي)
                  </label>
                </div>

                <div className="sm:col-span-2 mt-2">
                  <label className="block text-xs font-bold text-gray-700 mb-1.5">
                    ملاحظات الطلبية
                  </label>
                  <textarea
                    value={newOrder.notes}
                    onChange={(e) =>
                      setNewOrder({ ...newOrder, notes: e.target.value })
                    }
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm resize-none focus:outline-none focus:border-bunyan-500"
                    placeholder="ملاحظات للتحضير أو للكابتن..."
                  />
                </div>
              </div>
            </div>

            {/* د. الملخص المالي */}
            <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-5 border border-gray-200 shadow-sm">
              <h3 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2">
                <div className="w-1.5 h-4 bg-gray-500 rounded-full" />
                الملخص المالي النهائي
              </h3>
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 font-medium">
                    مجموع المنتجات فرعي
                  </span>
                  <span className="font-bold font-mono text-gray-900">
                    {formatCurrency(orderCalculations.subtotal)}
                  </span>
                </div>
                <div className="flex justify-between text-sm items-center">
                  <span className="text-gray-600 font-medium flex items-center gap-1.5">
                    الخصم (بالدينار)
                  </span>
                  <div className="w-24 relative">
                    <input
                      type="number"
                      min={0}
                      value={newOrder.discount || ""}
                      onChange={(e) =>
                        setNewOrder({
                          ...newOrder,
                          discount: Number(e.target.value),
                        })
                      }
                      className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm text-left focus:outline-none focus:border-bunyan-500 focus:ring-2 focus:ring-bunyan-500/20 font-mono text-red-600 font-bold bg-white"
                      placeholder="0 د.ل"
                    />
                  </div>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 font-medium pb-1 w-full flex justify-between border-b border-dashed border-gray-300">
                    <span>
                      رسوم التوصيل{" "}
                      {newOrder.priceIncludesDelivery && (
                        <span className="text-green-600 text-xs mr-2">
                          (مشمولة مسبقاً)
                        </span>
                      )}
                    </span>
                    <span className="font-mono text-gray-900">
                      {newOrder.priceIncludesDelivery
                        ? "0 د.ل"
                        : formatCurrency(orderCalculations.deliveryFee)}
                    </span>
                  </span>
                </div>
              </div>
              <div className="flex justify-between text-xl font-black pt-4 border-t border-gray-300/50 mt-4">
                <span className="text-gray-900">الإجمالي النهائي للزبون</span>
                <span className="text-bunyan-700 font-mono">
                  {formatCurrency(orderCalculations.total)}
                </span>
              </div>
            </div>
          </div>

          <div className="absolute bottom-0 left-0 w-full p-4 bg-white border-t border-gray-200 z-10 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
            <div className="max-w-6xl mx-auto flex justify-end">
              <button
                onClick={handleCreateOrder}
                className="w-full sm:w-[300px] py-3 bg-bunyan-600 text-white font-bold rounded-xl hover:bg-bunyan-700 transition-all text-sm shadow-md"
              >
                {editOrder ? "حفظ التعديلات" : "اعتماد وإنشاء الفاتورة"}
              </button>
            </div>
          </div>
        </div>
      </SlideOver>

      {/* ═══ SlideOver: تفاصيل الطلبية ═══ */}
      <SlideOver
        isOpen={!!viewOrder}
        onClose={() => setViewOrder(null)}
        title="تفاصيل الطلبية"
        width="w-full sm:max-w-lg"
      >
        {viewOrder && (
          <div className="space-y-6 pb-6">
            <div className="flex items-center justify-between border-b pb-4">
              <div>
                <h3 className="text-lg font-black text-gray-900 font-mono">{viewOrder.orderNumber}</h3>
                <p className="text-sm text-gray-500">{formatDate(viewOrder.createdAt)}</p>
              </div>
              <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold ${ORDER_STATUS[viewOrder.status as keyof typeof ORDER_STATUS]?.bg} ${ORDER_STATUS[viewOrder.status as keyof typeof ORDER_STATUS]?.text}`}>
                {ORDER_STATUS[viewOrder.status as keyof typeof ORDER_STATUS]?.label}
              </span>
            </div>

            <div>
              <h4 className="text-xs font-bold text-gray-400 mb-2 uppercase tracking-wider">بيانات الزبون</h4>
              <div className="bg-gray-50 rounded-xl p-4 space-y-2 text-sm border border-gray-100">
                <p><span className="text-gray-500 w-16 inline-block">الاسم:</span> <span className="font-bold text-gray-900">{viewOrder.customerName}</span></p>
                <p><span className="text-gray-500 w-16 inline-block">الهاتف:</span> <span className="font-mono font-bold text-gray-900" dir="ltr">{viewOrder.customerPhone}</span></p>
                <p><span className="text-gray-500 w-16 inline-block">المدينة:</span> <span className="text-gray-900">{viewOrder.customerCity}</span></p>
                {viewOrder.customerAddress && (
                  <p><span className="text-gray-500 w-16 inline-block">العنوان:</span> <span className="text-gray-900">{viewOrder.customerAddress}</span></p>
                )}
              </div>
            </div>

            <div>
              <h4 className="text-xs font-bold text-gray-400 mb-2 uppercase tracking-wider">المنتجات</h4>
              <div className="border border-gray-100 rounded-xl divide-y divide-gray-100 overflow-hidden">
                {viewOrder.items.map((item, idx) => (
                  <div key={idx} className="flex justify-between items-center p-3 text-sm bg-white">
                    <div className="flex flex-col">
                      <span className="font-bold text-gray-900">{item.productName}</span>
                      <span className="text-xs text-gray-500 mt-0.5">
                        {item.quantity} × {formatCurrency(item.unitPrice)}
                      </span>
                    </div>
                    <span className="font-bold font-mono text-gray-900">{formatCurrency(item.total)}</span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h4 className="text-xs font-bold text-gray-400 mb-2 uppercase tracking-wider">الملخص المالي</h4>
              <div className="bg-gradient-to-br from-gray-50 to-gray-100 border border-gray-200 rounded-xl p-4 text-sm space-y-2">
                <div className="flex justify-between text-gray-600">
                  <span>المجموع الفرعي:</span>
                  <span className="font-mono">{formatCurrency(viewOrder.subtotal)}</span>
                </div>
                {viewOrder.discount > 0 && (
                  <div className="flex justify-between text-red-600 font-medium">
                    <span>الخصم:</span>
                    <span className="font-mono">-{formatCurrency(viewOrder.discount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-gray-600 pb-2 border-b border-gray-200">
                  <span>التوصيل {viewOrder.priceIncludesDelivery && '(مشمول)'}:</span>
                  <span className="font-mono">{viewOrder.priceIncludesDelivery ? '0 د.ل' : formatCurrency(viewOrder.deliveryFee)}</span>
                </div>
                <div className="flex justify-between text-gray-900 font-black text-lg pt-2 mt-2">
                  <span>الإجمالي:</span>
                  <span className="font-mono text-bunyan-700">{formatCurrency(viewOrder.total)}</span>
                </div>
              </div>
            </div>

            {viewOrder.notes && (
              <div>
                <h4 className="text-xs font-bold text-gray-400 mb-2 uppercase tracking-wider">ملاحظات</h4>
                <div className="bg-yellow-50 text-yellow-800 p-3 rounded-xl text-sm border border-yellow-100">
                  {viewOrder.notes}
                </div>
              </div>
            )}
          </div>
        )}
      </SlideOver>

      {/* ═══ نافذة تأكيد الإجراء ═══ */}
      <ConfirmDialog
        isOpen={!!confirmAction}
        onCancel={() => setConfirmAction(null)}
        onConfirm={handleConfirmAction}
        title={`تأكيد تحويل الحالة إلى "${confirmAction?.label}"`}
        message={`هل أنت متأكد من تغيير حالة الطلبية "${filtered.find((o) => o.id === confirmAction?.id)?.orderNumber || ""}"؟${
          confirmAction?.status === "cancelled"
            ? " (سيتم إرجاع المخزون وتسوية الحسابات الخاصة بالفاتورة)"
            : confirmAction?.status === "return_confirmed"
              ? " (سيتم إرجاع المخزون وتسوية مستحقات التوصيل إن وجدت)"
              : confirmAction?.status === "delivered"
                ? " (سيتم إغلاق الفاتورة وتسجيل المبيعات)"
                : ""
        }`}
        variant={
          confirmAction?.status === "cancelled" ||
          confirmAction?.status === "return_confirmed"
            ? "danger"
            : "primary"
        }
      />

      <ConfirmDialog
        isOpen={deleteOrderId !== null}
        onCancel={() => setDeleteOrderId(null)}
        onConfirm={() => {
          if (deleteOrderId) {
            deleteOrder(deleteOrderId);
            showToast("تم حذف الطلبية وإعادة المخزون");
            setDeleteOrderId(null);
          }
        }}
        title="حذف الطلبية"
        message="هل أنت متأكد من حذف هذه الطلبية؟ سيتم إعادة المخزون تلقائياً"
        variant="danger"
      />
    </div>
  );
}
