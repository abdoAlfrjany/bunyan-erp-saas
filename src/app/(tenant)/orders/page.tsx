// src/app/(tenant)/orders/page.tsx
// الوظيفة: صفحة الطلبيات — جدول + فلاتر متقدمة + إنشاء طلبية + تغيير حالة
// الجداول: orders, products, couriers
// الصلاحية: OWNER (كامل), EMPLOYEE (إضافة + قراءة), PARTNER (عرض طلبياته فقط - لم ينفذ هنا بل في db/store)

'use client';

import { useState, useMemo, useEffect } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useAuthStore } from '@/core/auth/store';
import { useDataStore } from '@/core/db/store';
import { useOrdersQuery } from '@/core/db/hooks/useOrders';
import { useProductsQuery } from '@/core/db/hooks/useProducts';
import { useCouriersQuery } from '@/core/db/hooks/useCouriers';
import { VanexAdapter } from '@/core/delivery/VanexAdapter';
import { useQueryClient } from '@tanstack/react-query';
import { formatCurrency, formatDate } from '@/shared/utils/format';
import dynamic from 'next/dynamic';

const SlideOver = dynamic(() => import('@/shared/components/ui/SlideOver').then(mod => mod.SlideOver), { ssr: false });
const ConfirmDialog = dynamic(() => import('@/shared/components/ui/ConfirmDialog').then(mod => mod.ConfirmDialog), { ssr: false });
import { useToast } from '@/shared/components/ui/Toast';
import { ORDER_STATUS } from '@/shared/utils/statusColors';
import {
  ShoppingCart, Search, Plus, Trash2, Package,
  CheckCircle2, Truck, Ban, RotateCcw, ArrowDownCircle,
  Filter, Calendar, Percent, RefreshCw, Edit2,
  CreditCard, ArrowRight, Check, ShieldCheck, User, X, ChevronLeft
} from 'lucide-react';
import type { Order, Product } from '@/core/types';

// ═══ الانتقالات المسموحة لكل حالة ═══
const NEXT_STATUSES: Record<string, { status: Order['status']; label: string; icon: React.ReactNode; bg: string; text: string; hover: string }[]> = {
  pending: [
    { status: 'processing', label: 'تجهيز', icon: <Package size={14} />, bg: 'bg-indigo-50', text: 'text-indigo-700', hover: 'hover:bg-indigo-100' },
    { status: 'cancelled', label: 'إلغاء الطلبية', icon: <Ban size={14} />, bg: 'bg-red-50', text: 'text-red-700', hover: 'hover:bg-red-100' },
  ],
  processing: [
    { status: 'with_courier', label: 'للتوصيل', icon: <Truck size={14} />, bg: 'bg-cyan-50', text: 'text-cyan-700', hover: 'hover:bg-cyan-100' },
    { status: 'cancelled', label: 'إلغاء', icon: <Ban size={14} />, bg: 'bg-red-50', text: 'text-red-700', hover: 'hover:bg-red-100' },
  ],
  ready_to_ship: [
    { status: 'with_courier', label: 'تأكيد الاستلام', icon: <Truck size={14} />, bg: 'bg-emerald-50', text: 'text-emerald-700', hover: 'hover:bg-emerald-100' },
    { status: 'cancelled', label: 'إلغاء', icon: <Ban size={14} />, bg: 'bg-red-50', text: 'text-red-700', hover: 'hover:bg-red-100' },
  ],
  with_courier: [
    { status: 'delivered', label: 'تم ✓', icon: <CheckCircle2 size={14} />, bg: 'bg-emerald-50', text: 'text-emerald-700', hover: 'hover:bg-emerald-100' },
    { status: 'pending_return', label: 'إرجاع', icon: <RotateCcw size={14} />, bg: 'bg-yellow-50', text: 'text-yellow-700', hover: 'hover:bg-yellow-100' },
  ],
  with_partner: [
    { status: 'delivered', label: 'تم ✓', icon: <CheckCircle2 size={14} />, bg: 'bg-emerald-50', text: 'text-emerald-700', hover: 'hover:bg-emerald-100' },
    { status: 'pending_return', label: 'إرجاع', icon: <RotateCcw size={14} />, bg: 'bg-yellow-50', text: 'text-yellow-700', hover: 'hover:bg-yellow-100' },
  ],
  pending_return: [
    { status: 'return_confirmed', label: 'تأكيد الإرجاع', icon: <ArrowDownCircle size={14} />, bg: 'bg-gray-100', text: 'text-gray-700', hover: 'hover:bg-gray-200' },
  ],
};

type StatusFilter = 'all' | Order['status'];

export default function OrdersPage() {
  const queryClient = useQueryClient();

  // ✅ Primitive selector — مستقر
  const user = useAuthStore(s => s.user);

  // ✅ useShallow للبيانات — يقارن محتوى المصفوفات لا المرجع
  const { customers, shippingCityMappings, shippingRegionMappings, fetchGeoMappings } = useDataStore(
    useShallow(s => ({
      customers: s.customers,
      shippingCityMappings: s.shippingCityMappings,
      shippingRegionMappings: s.shippingRegionMappings,
      fetchGeoMappings: s.fetchGeoMappings,
    }))
  );

  // ✅ Actions — مستقرة دائماً (Zustand يضمن reference ثابت للـ actions)
  const getForTenant      = useDataStore(s => s.getForTenant);
  const addOrder          = useDataStore(s => s.addOrder);
  const updateOrderStatus = useDataStore(s => s.updateOrderStatus);
  const sendOrderToVanex  = useDataStore(s => s.sendOrderToVanex);
  const cancelOrderVanex  = useDataStore(s => s.cancelOrderVanex);
  const fetchVanexSubCities = useDataStore(s => s.fetchVanexSubCities);

  const { showToast } = useToast();
  const tid = user?.tenantId || '';

  // ── React Query لجلب الطلبيات ──
  const { data: myOrders = [], isLoading: isOrdersLoading } = useOrdersQuery(tid);

  // ── React Query لجلب المنتجات (لإنشاء الطلبيات السريعة) ──
  const { data: rawProducts = [] } = useProductsQuery(tid);
  const myProducts = useMemo(() => rawProducts.filter(p => p.isActive), [rawProducts]);

  // ── React Query لجلب التوصيل ──
  const { data: rawCouriers = [] } = useCouriersQuery(tid);
  const myCouriers = useMemo(() => rawCouriers.filter(c => c.isActive), [rawCouriers]);


  // الفلاتر
  const [search, setSearch] = useState('');
  
  useEffect(() => {
    fetchGeoMappings();
  }, [fetchGeoMappings]);

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [courierFilter, setCourierFilter] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [sendingToVanex, setSendingToVanex] = useState<string | null>(null);
  const [trackingOrderId, setTrackingOrderId] = useState<string | null>(null);
  const [isCreatingOrder, setIsCreatingOrder] = useState(false);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [cityFocused, setCityFocused] = useState(false);
  const [step, setStep] = useState(1);

  const handleManualSync = async () => {
    if (!tid) return;
    setIsSyncing(true);
    try {
      const res = await fetch('/api/vanex/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const result = await res.json();
      if (result.success) {
        showToast(`تم مزامنة ${result.synced} طلبية بنجاح`, 'success');
        queryClient.invalidateQueries({ queryKey: ['orders', tid] });
      } else {
        showToast(result.error || 'فشل المزامنة الجماعية', 'error');
      }
    } catch {
      showToast('خطأ في الاتصال أثناء المزامنة', 'error');
    } finally {
      setIsSyncing(false);
    }
  };

  // ═══ الاعتماد كلياً على الـ Webhooks الآن لضمان كفاءة أداء النظام ═══
  // تم إزالة `syncVanex` التلقائي لمنع الضغط على خوادم Vanex.

  // الواجهة
  const [slideOpen, setSlideOpen] = useState(false);
  const [isBulkSending, setIsBulkSending] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{ orderId: string; newStatus: Order['status'], label: string } | null>(null);

  // نموذج طلبية جديدة
  const [newOrder, setNewOrder] = useState({
    customerName: '', customerPhone: '', customerPhone2: '', customerAddress: '', customerCity: '',
    courierCityId: undefined as number | undefined, courierSubCityId: undefined as number | undefined,
    deliveryType: 'courier_company' as 'internal' | 'courier_company' | 'pickup',
    courierId: '', notes: '', discount: 0, priceIncludesDelivery: false,
    commissionBy: 'customer' as 'customer' | 'market',
    paymentMethod: 'cash' as 'cash' | 'online',
    isPrepaid: false,
    prepaidAmount: 0,
    showDimensions: false,
    dimLength: '',
    dimWidth: '',
    dimHeight: '',
    vanexInsure: false,
    vanexMatch: false,
    vanexInspection: false,
    vanexFragile: false,
    vanexTryOn: false,
    vanexPartialAllowed: false,
    vanexNoHeat: false,
    vxExtraShippingCostOn: 'market' as 'customer' | 'market',
    vxCollectionCommissionOn: 'market' as 'customer' | 'market',
  });
  const [orderItems, setOrderItems] = useState<{ productId: string; quantity: number; variantSize?: string }[]>([]);
  const [productSearch, setProductSearch] = useState('');
  const [showProductList, setShowProductList] = useState(false);
  const [showPhone2, setShowPhone2] = useState(false);

  useEffect(() => {
    const courier = myCouriers.find(c => c.id === newOrder.courierId);
    if (!courier || (courier.apiProvider?.includes('vanex') === false && courier.provider?.includes('vanex') === false && !courier.name.includes('فانكس'))) {
      return;
    }

    if (!newOrder.dimLength || !newOrder.dimWidth || !newOrder.dimHeight || !newOrder.courierCityId || !courier.apiCredentials?.vanexFromRegionId) {
      return;
    }

    const fetchPrice = async () => {
      try {
        const adapter = new VanexAdapter();
        const fromRegionId = Number(courier.apiCredentials!.vanexFromRegionId);
        const toCityId = Number(newOrder.courierCityId);
        if (isNaN(fromRegionId) || isNaN(toCityId)) return;
        
        const price = await adapter.calculateDeliveryPrice(fromRegionId, toCityId);
        if (price && price.total !== undefined) {
          // Future: use price.total in UI
        }
      } catch (err) {
        console.error('Failed to calculate vanex price', err);
      }
    };

    fetchPrice();
  }, [newOrder.dimLength, newOrder.dimWidth, newOrder.dimHeight, newOrder.courierId, newOrder.courierCityId, myCouriers]);

  const myCustomers = useMemo(() => getForTenant(customers, tid), [customers, tid, getForTenant]);

  // ═══ الفلترة ═══
  const filtered = useMemo(() => {
    let result = [...myOrders].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    
    if (statusFilter !== 'all') {
      result = result.filter(o => o.status === statusFilter);
    }
    
    if (search) {
      const s = search.toLowerCase();
      result = result.filter(o => 
        o.orderNumber.toLowerCase().includes(s) || 
        o.customerName.toLowerCase().includes(s) || 
        o.customerPhone.includes(s)
      );
    }

    if (dateFrom) {
      result = result.filter(o => o.createdAt >= dateFrom);
    }
    
    if (dateTo) {
      result = result.filter(o => o.createdAt <= dateTo);
    }

    if (courierFilter !== 'all') {
      if (courierFilter === 'internal') {
        result = result.filter(o => o.deliveryType !== 'courier_company');
      } else {
        result = result.filter(o => o.courierCompanyId === courierFilter);
      }
    }

    return result;
  }, [myOrders, statusFilter, search, dateFrom, dateTo, courierFilter]);

  // ═══ إدارة عناصر الطلبية ═══
  const removeItem = (idx: number) => setOrderItems(orderItems.filter((_, i) => i !== idx));
  const updateItem = (idx: number, field: 'productId' | 'quantity' | 'variantSize', value: string | number) => {
    setOrderItems(orderItems.map((item, i) => i === idx ? { ...item, [field]: value } : item));
  };

  // معالجة تغيير وتلخيص الهاتف للزبون - البحث التلقائي
  const handlePhoneChange = (val: string) => {
    setNewOrder(prev => ({ ...prev, customerPhone: val }));
    if (val.length === 10 && val.match(/^09[1-5]\d{7}$/)) {
      const found = myCustomers.find(c => c.phone === val);
      if (found) {
        setNewOrder(prev => ({ ...prev, customerName: found.name, customerCity: found.city || '', customerAddress: found.address || '' }));
        showToast('تم العثور على بيانات الزبون وجلبها تلقائياً', 'success');
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
    const deliveryFee = newOrder.deliveryType === 'courier_company' && courier ? (courier.defaultDeliveryFee || 0) : 0;
    const discount = Number(newOrder.discount) || 0;
    
    const total = Math.max(0, subtotal - discount + (newOrder.priceIncludesDelivery ? 0 : deliveryFee));
    
    return { subtotal, deliveryFee, discount, total };
  }, [orderItems, myProducts, myCouriers, newOrder.courierId, newOrder.discount, newOrder.priceIncludesDelivery, newOrder.deliveryType]);

  // ═══ حذف الطلبية نهائياً ═══
  const handleDeleteOrder = async (orderId: string) => {
    try {
      const res = await fetch(`/api/orders/${orderId}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok || data.error) {
        showToast(data.error || 'فشل حذف الطلبية', 'error');
      } else {
        showToast('✅ تم حذف الطلبية نهائياً وإعادة المخزون', 'success');
        queryClient.invalidateQueries({ queryKey: ['orders', tid] });
        queryClient.invalidateQueries({ queryKey: ['products', tid] });
      }
    } catch {
      showToast('خطأ في الاتصال أثناء الحذف', 'error');
    } finally {
      // Done
    }
  };

  // ═══ إرسال جماعي لشركات التوصيل ═══
  const handleBulkSend = async () => {
    const pendingOrders = filtered.filter(o => 
      o.status === 'pending' && 
      !o.courier_package_id && 
      o.deliveryType === 'courier_company' && 
      o.courierCompanyId
    );

    if (pendingOrders.length === 0) {
      showToast('لا توجد طلبيات جديدة (غير مرسلة) حالياً لشركات التوصيل', 'info');
      return;
    }

    if (!confirm(`هل أنت متأكد من إرسال ${pendingOrders.length} طلبية دفعة واحدة لشركات التوصيل؟`)) return;

    setIsBulkSending(true);
    let successCount = 0;
    let failCount = 0;

    for (const o of pendingOrders) {
      try {
        setSendingToVanex(o.id);
        const res = await fetch('/api/vanex/create-shipment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderId: o.id }),
        });
        const data = await res.json();
        if (data.success) successCount++;
        else failCount++;
      } catch {
        failCount++;
      } finally {
        setSendingToVanex(null);
      }
    }

    setIsBulkSending(false);
    showToast(`✅ تم إرسال ${successCount} طلبية بنجاح. ${failCount > 0 ? `❌ فشل إرسال ${failCount} طلبية.` : ''}`, successCount > 0 ? 'success' : 'error');
    queryClient.invalidateQueries({ queryKey: ['orders', tid] });
  };

  // ═══ تعديل الطلبية ═══
  const handleEditOrder = (o: Order) => {
    setEditingOrder(o);
    setNewOrder({
      customerName: o.customerName,
      customerPhone: o.customerPhone,
      customerPhone2: '', // Default as it's not in Order type yet
      customerAddress: o.customerAddress || '',
      customerCity: o.customerCity,
      courierCityId: o.courierCityId,
      courierSubCityId: o.courierSubCityId,
      deliveryType: o.deliveryType as 'internal' | 'courier_company' | 'pickup',
      courierId: o.courierCompanyId || '',
      notes: o.notes || '',
      discount: o.discount || 0,
      priceIncludesDelivery: o.priceIncludesDelivery,
      commissionBy: (o.commission_by as 'customer' | 'market') || 'customer',
      paymentMethod: o.is_online_payable ? 'online' : 'cash',
      isPrepaid: (o.prepaid_amount || 0) > 0,
      prepaidAmount: o.prepaid_amount || 0,
      showDimensions: false,
      dimLength: '', dimWidth: '', dimHeight: '',
      vanexInsure: false, vanexMatch: false, vanexInspection: false, vanexFragile: false, vanexTryOn: false, vanexPartialAllowed: false, vanexNoHeat: false,
      vxExtraShippingCostOn: 'market', vxCollectionCommissionOn: 'market'
    });
    // Fill items
    if (o.items) {
      setOrderItems(o.items.map((i: { productId: string; quantity: number; variantSize?: string }) => ({
        productId: i.productId,
        quantity: i.quantity,
        variantSize: i.variantSize || ''
      })));
    }
    setSlideOpen(true);
  };

  // ═══ إنشاء / تحديث الطلبية ═══
  const handleCreateOrder = async () => {
    // 🛡️ منع الضغط المزدوج (Double Submit Guard)
    if (isCreatingOrder) return;
    if (!newOrder.customerName || !newOrder.customerPhone || orderItems.length === 0) {
      showToast('يرجى ملء بيانات الزبون وإضافة منتج واحد على الأقل', 'error');
      return;
    }
    
    // التحقق من صحة الهاتف
    if (!/^09[1-5]\d{7}$/.test(newOrder.customerPhone)) {
      showToast('رقم الهاتف يجب أن يبدأ بـ 091/092/093/094/095 ويتكون من 10 أرقام', 'error');
      return;
    }

    // التحقق من صلاحية المدينة
    if (newOrder.deliveryType === 'courier_company' && newOrder.courierId) {
      const courier = myCouriers.find(c => c.id === newOrder.courierId);
      if (courier?.isApiConnected) {
        // Because bunyanCities are loaded dynamically:
        const cities = useDataStore.getState().bunyanCities;
        const isCityMapped = shippingCityMappings.some(m => {
           const bName = cities.find(c => c.id === m.bunyan_city_id)?.name_ar || m.bunyanCityName;
           return m.is_active && bName === newOrder.customerCity;
        });
        if (!isCityMapped) {
          showToast('يرجى اختيار مدينة صحيحة من القائمة المنسدلة للمدن المدعومة والتأكد من تطابقها', 'error');
          return;
        }
        
        // التحقق من المنطقة إذا كانت مطلوبة ولها خرائط في بنيان
        if (newOrder.courierCityId) {
           const cityMapping = shippingCityMappings.find(m => {
              const bName = cities.find(c => c.id === m.bunyan_city_id)?.name_ar || m.bunyanCityName;
              return m.is_active && m.provider_city_id === newOrder.courierCityId && bName === newOrder.customerCity;
           });
           const myRegions = cityMapping ? shippingRegionMappings.filter(r => r.city_mapping_id === cityMapping.id && r.is_active) : [];
           
           if (myRegions.length > 0 && !newOrder.courierSubCityId) {
             showToast('يرجى اختيار المنطقة قبل الإرسال لأن هذه المدينة تتطلب منطقة في نظام التوصيل المقترن', 'error');
             return;
           }
        }
      } else {
         const courierCities = courier?.cities || [];
         if (courierCities.length > 0 && !courierCities.includes(newOrder.customerCity)) {
           showToast(`شركة التوصيل المختارة لا تدعم التوصيل لمدينة ${newOrder.customerCity}`, 'error');
           return;
         }
      }
    }

    const validItems = orderItems.filter((i) => i.productId && i.quantity > 0);
    if (validItems.length === 0) {
      showToast('خطأ في المنتجات المدخلة', 'error');
      return;
    }

    // التحقق من توافر الكميات
    const outOfStockItems = validItems.filter(item => {
      const p = myProducts.find(pr => pr.id === item.productId);
      if (!p) return true;
      if (p.productType === 'clothing' && item.variantSize) {
        const variant = p.variants?.find(v => v.size === item.variantSize);
        return !variant || variant.quantity < item.quantity;
      }
      return p.quantity < item.quantity;
    });

    if (outOfStockItems.length > 0) {
      showToast('بعض المنتجات لا تتوفر منها الكمية المطلوبة في المخزون (أو المقاس المطلوب)', 'error');
      return;
    }

    const orderNum = `ORD-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`;
    const { subtotal, deliveryFee, discount, total } = orderCalculations;

    const order: Order = {
      id: crypto.randomUUID(), 
      tenantId: tid,
      orderNumber: orderNum, 
      customerName: newOrder.customerName,
      customerPhone: newOrder.customerPhone, 
      customerAddress: newOrder.customerAddress,
      customerCity: newOrder.customerCity, 
      deliveryType: newOrder.deliveryType,
      courierCompanyId: newOrder.courierId || undefined, 
      courierCityId: newOrder.courierCityId,
      courierSubCityId: newOrder.courierSubCityId,
      deliveryFee, 
      status: 'pending', 
      subtotal, 
      discount, 
      total,
      priceIncludesDelivery: newOrder.priceIncludesDelivery,
      paymentStatus: 'pending', 
      source: 'direct',
      notes: newOrder.notes || undefined, 
      createdAt: new Date().toISOString().split('T')[0],
      commission_by: newOrder.commissionBy,
      is_online_payable: newOrder.paymentMethod === 'online',
      prepaid_amount: newOrder.isPrepaid ? Math.round(newOrder.prepaidAmount) : 0,
      dimLength:        newOrder.dimLength ? Number(newOrder.dimLength) : undefined,
      dimWidth:         newOrder.dimWidth ? Number(newOrder.dimWidth) : undefined,
      dimHeight:        newOrder.dimHeight ? Number(newOrder.dimHeight) : undefined,
      insureShipment:   newOrder.vanexInsure ?? false,
      matchShipment:    newOrder.vanexMatch ?? false,
      allowInspection:  newOrder.vanexInspection ?? false,
      fragile:          newOrder.vanexFragile ?? false,
      allowTryOn:       newOrder.vanexTryOn ?? false,
      partialAllowed:   newOrder.vanexPartialAllowed ?? false,
      noHeat:           newOrder.vanexNoHeat ?? false,
      items: validItems.map((item, idx) => {
        const p = myProducts.find((pr) => pr.id === item.productId) as Product;
        return {
          id: `oi-new-${Date.now()}-${idx}`, 
          productId: p.id, 
          productName: item.variantSize ? `${p.name} - مقاس: ${item.variantSize}` : p.name,
          variantSize: item.variantSize,
          quantity: item.quantity, 
          unitPrice: p.sellingPrice, 
          unitCost: p.costPrice,
          total: p.sellingPrice * item.quantity,
        };
      }),
    };

    setIsCreatingOrder(true);
    try {
      if (editingOrder) {
        // تحديث طلبية موجودة
        const res = await fetch(`/api/orders/${editingOrder.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            customer_name: order.customerName,
            customer_phone: order.customerPhone,
            customer_city: order.customerCity,
            customer_address: order.customerAddress,
            notes: order.notes,
            items: order.items,
            total_amount: order.total,
            discount: order.discount,
          })
        });
        const data = await res.json();
        if (!res.ok || data.error) {
          showToast(data.error || 'فشل التحديث', 'error');
          return;
        }
        showToast(`✅ تم تحديث بيانات ${orderNum} بنجاح`);
      } else {
        // إنشاء طلبية جديدة
        const result = await addOrder(order);
        if (!result.success) {
          showToast(result.error || 'فشل في حفظ الطلبية — يرجى التحقق من الاتصال', 'error');
          return;
        }
        showToast(`✅ تم إنشاء الطلبية ${orderNum} بنجاح`);
      }
      
      setSlideOpen(false);
      setEditingOrder(null);
      setNewOrder({ customerName: '', customerPhone: '', customerPhone2: '', customerAddress: '', customerCity: '', courierCityId: undefined, courierSubCityId: undefined, deliveryType: 'courier_company', courierId: '', notes: '', discount: 0, priceIncludesDelivery: false, commissionBy: 'customer', paymentMethod: 'cash', isPrepaid: false, prepaidAmount: 0, showDimensions: false, dimLength: '', dimWidth: '', dimHeight: '', vanexInsure: false, vanexMatch: false, vanexInspection: false, vanexFragile: false, vanexTryOn: false, vanexPartialAllowed: false, vanexNoHeat: false, vxExtraShippingCostOn: 'market', vxCollectionCommissionOn: 'market' });
      setOrderItems([]);
      queryClient.invalidateQueries({ queryKey: ['orders', tid] });
      queryClient.invalidateQueries({ queryKey: ['products', tid] });
    } finally {
      setIsCreatingOrder(false);
    }
  };

  // ═══ تغيير حالة الطلبية ═══
  const handleStatusChange = (orderId: string, newStatus: Order['status']) => {
    const order = myOrders.find((o) => o.id === orderId);
    if (order && (order.status === 'delivered' || order.status === 'cancelled') && newStatus !== 'return_confirmed') {
      showToast('لا يمكن تعديل حالة طلبية مسلّمة أو ملغاة (إلا إذا تم تأكيد إرجاعها)', 'error');
      return;
    }

    const label = ORDER_STATUS[newStatus as keyof typeof ORDER_STATUS]?.label || newStatus;
    setConfirmAction({ orderId, newStatus, label });
  };

  const handleConfirmAction = async () => {
    if (confirmAction) {
      const { orderId, newStatus, label } = confirmAction;
      const order = myOrders.find(o => o.id === orderId);
      
      // ═══ الأتمتة العكسية — إلغاء الطلبية من نظام فانكس قبل التأكيد محلياً ═══
      if (newStatus === 'cancelled' && (order?.courier_package_id || order?.courier_tracking_code)) {
        showToast('جاري إلغاء الطلبية تلقائياً من نظام شركة التوصيل...', 'info');
        const cancelResult = await cancelOrderVanex(orderId);
        if (!cancelResult.success) {
          showToast(`❌ تعذر الإلغاء لأن النظام لم يستطع حذفها من فانكس: ${cancelResult.error}`, 'error');
          setConfirmAction(null);
          return; // منع الإلغاء محلياً لضمان التطابق
        }
        showToast('✅ تم إلغاء الشحنة على منصة فانكس بنجاح', 'success');
      }

      await updateOrderStatus(orderId, newStatus);
      showToast(`تم تغيير حالة الطلبية إلى: ${label}`, 'success');
      setConfirmAction(null);

      // Invalidate React Query cache for orders
      queryClient.invalidateQueries({ queryKey: ['orders', tid] });
      // If order was cancelled/returned, it affects inventory, so invalidate products too
      if (newStatus === 'cancelled' || newStatus === 'return_confirmed') {
         queryClient.invalidateQueries({ queryKey: ['products', tid] });
      }
    }
  };


/*
  const isVanexCitySuspended = ... (unused but logic kept for reference)
*/

  const statusFiltersList: { key: StatusFilter; label: string }[] = [
    { key: 'all', label: 'الكل' },
    { key: 'pending', label: 'جديدة' }, 
    { key: 'processing', label: 'تجهيز' },
    { key: 'ready_to_ship', label: 'جاهزة للشحن' },
    { key: 'with_courier', label: 'توصيل' }, 
    { key: 'with_partner', label: 'مع شريك' },
    { key: 'delivered', label: 'مسلّمة' },
    { key: 'pending_return', label: 'معلقة للإرجاع' },
    { key: 'return_confirmed', label: 'مرتجع مؤكد' },
    { key: 'cancelled', label: 'ملغاة' },
  ];

  // ═══ عرض حالة فانكس بالعربية ═══
  const getVanexStatusBadge = (order: Order) => {
    if (order.deliveryType !== 'courier_company') return null;
    const courier = myCouriers.find(c => c.id === order.courierCompanyId);
    if (!courier?.isApiConnected) return null;

    if (!order.courier_tracking_code) {
      if (order.status === 'pending') return { label: '📦 لم تُرسل', bg: 'bg-gray-100', text: 'text-gray-500' };
      return null;
    }

    const raw = order.courier_raw_status;
    if (raw === 'store_new' || raw === 'pending') return { label: '🚛 أُرسلت', bg: 'bg-violet-50', text: 'text-violet-600' };
    if (raw === 'ship_received') return { label: '📦 قيد التجهيز', bg: 'bg-indigo-50', text: 'text-indigo-600' };
    if (raw === 'ship_preperation' || raw === 'ship_ongoing' || raw === 'ship_pending' || raw === 'shipped' || raw === 'on_track' || raw === 'enable_delivery') return { label: '🏃 في الطريق', bg: 'bg-blue-50', text: 'text-blue-600' };
    if (raw === 'completed' || raw === 'pending_office_sett' || raw === 'pending_store_sett' || raw === 'delivered' || raw === 'complete') return { label: '✅ وصلت', bg: 'bg-emerald-50', text: 'text-emerald-600' };
    if (raw === 'ship_del_return' || raw === 'returned') return { label: '🔄 راجعة', bg: 'bg-yellow-50', text: 'text-yellow-700' };
    if (raw === 'store_return') return { label: '🔄 مستردة للمخزن', bg: 'bg-yellow-100', text: 'text-yellow-800' };
    if (raw === 'store_canceled' || raw === 'cancelled') return { label: '❌ ملغاة', bg: 'bg-red-50', text: 'text-red-600' };
    
    return { label: '🚛 مع فانكس', bg: 'bg-violet-50', text: 'text-violet-600' };
  };

  // ═══ تتبع طلبية من فانكس ═══
  const handleTrackOrder = async (orderId: string) => {
    setTrackingOrderId(orderId);
    try {
      const res = await fetch('/api/vanex/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId }),
      });
      const result = await res.json();
      if (result.success) {
        queryClient.invalidateQueries({ queryKey: ['orders', tid] });
        showToast(`حالة فانكس: ${result.rawStatus}`, 'success');
      } else {
        showToast(result.error || 'فشل التتبع', 'error');
      }
    } catch {
      showToast('خطأ في الاتصال', 'error');
    } finally {
      setTrackingOrderId(null);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      {/* 🚀 رأس الصفحة - v5.0 */}
      <div className="flex flex-col gap-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
              <div className="p-2 bg-indigo-600 rounded-xl shadow-lg shadow-indigo-500/20">
                <ShoppingCart size={24} className="text-white" />
              </div>
              إدارة الطلبيات
              {isOrdersLoading && (
                <div className="flex gap-1 items-center px-3 py-1 bg-slate-100 rounded-full">
                  <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                  <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                  <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce"></span>
                </div>
              )}
            </h1>
            <p className="text-slate-500 font-medium">نظام متطور لمتابعة حالة المبيعات وعمليات الشحن</p>
          </div>

          <div className="flex items-center gap-3">
            <button 
              onClick={handleBulkSend}
              disabled={isBulkSending}
              className="group flex items-center gap-2 px-5 py-3 rounded-2xl text-sm font-bold bg-white text-slate-700 border border-slate-200 hover:border-indigo-200 hover:bg-slate-50 hover:text-indigo-600 transition-all shadow-sm active:scale-95 disabled:opacity-50"
            >
              <Truck size={18} className="group-hover:translate-x-1 transition-transform" />
              إرسال جماعي
            </button>
            <button 
              onClick={() => { setEditingOrder(null); setStep(1); setSlideOpen(true); }}
              className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-2xl text-sm font-bold hover:bg-indigo-700 hover:shadow-xl hover:shadow-indigo-500/30 transition-all active:scale-95 group shadow-lg shadow-indigo-500/20"
            >
              <Plus size={20} className="group-hover:rotate-90 transition-transform" />
              طلبية جديدة
            </button>
          </div>
        </div>

        {/* 📊 ملخص الأداء السريع - KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-1.5 bg-white/40 backdrop-blur-sm border border-slate-200/60 rounded-[2.5rem] shadow-sm">
          {[
            { label: 'إجمالي الطلبات', value: filtered.length, color: 'from-blue-600 to-indigo-600', icon: Package },
            { label: 'جديدة / معلقة', value: filtered.filter(o => o.status === 'pending').length, color: 'from-emerald-500 to-teal-600', icon: Calendar },
            { label: 'تحت التنفيذ', value: filtered.filter(o => ['processing', 'ready_to_ship'].includes(o.status)).length, color: 'from-amber-500 to-orange-600', icon: RefreshCw },
            { label: 'إيرادات محققة', value: formatCurrency(filtered.filter(o => o.status === 'delivered').reduce((acc, o) => acc + o.total, 0)), color: 'from-indigo-600 to-violet-700', icon: Percent },
          ].map((stat, i) => (
            <div key={i} className="flex items-center justify-between p-5 bg-white rounded-[2rem] border border-slate-100 shadow-sm relative overflow-hidden group hover:border-indigo-200 transition-colors">
              <div className="space-y-1 relative z-10">
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{stat.label}</p>
                <p className={`text-xl font-black bg-gradient-to-r ${stat.color} bg-clip-text text-transparent group-hover:scale-105 transition-transform origin-right`}>
                  {stat.value}
                </p>
              </div>
              <div className={`p-3 rounded-2xl bg-gradient-to-br ${stat.color} bg-opacity-10 group-hover:rotate-12 transition-transform`}>
                <stat.icon size={20} className="text-white" />
              </div>
              <div className={`absolute top-0 right-0 w-24 h-24 bg-gradient-to-br ${stat.color} opacity-[0.03] rounded-full -mr-8 -mt-8`} />
            </div>
          ))}
        </div>
      </div>

      {/* 🔍 شريط البحث والفلاتر - v5.0 */}
      <div className="bg-white/80 backdrop-blur-md p-4 rounded-[2rem] border border-white/50 shadow-xl shadow-slate-200/50 space-y-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1 group">
            <Search size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-600 transition-colors" />
            <input 
              type="text" 
              value={search} 
              onChange={(e) => setSearch(e.target.value)} 
              placeholder="البحث برقم الطلبية، اسم الزبون، أو رقم الهاتف..."
              className="w-full pr-12 pl-4 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl text-sm focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:bg-white focus:border-indigo-500 transition-all font-medium" 
            />
          </div>
          
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-2 px-6 py-3.5 rounded-2xl text-sm font-bold transition-all ${
                showFilters || dateFrom || statusFilter !== 'all'
                  ? 'bg-slate-900 text-white shadow-lg shadow-slate-900/20'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              <Filter size={18} />
              الفلاتر المتقدمة
              {(statusFilter !== 'all' || dateFrom) && (
                <span className="w-2 h-2 bg-indigo-400 rounded-full animate-pulse" />
              )}
            </button>

            <button
              onClick={handleManualSync}
              disabled={isSyncing}
              className="p-3.5 bg-white text-slate-400 border border-slate-200 rounded-2xl hover:text-indigo-600 hover:border-indigo-200 transition-all active:scale-90"
              title="مزامنة قسرية مع شركات التوصيل"
            >
              <RefreshCw size={20} className={isSyncing ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {showFilters && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 bg-slate-50/50 rounded-[1.5rem] border border-slate-100 animate-slide-down">
            <div className="md:col-span-4 flex flex-wrap gap-2 pb-2">
              {statusFiltersList.map((f) => (
                <button 
                  key={f.key} 
                  onClick={() => setStatusFilter(f.key)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border ${
                    statusFilter === f.key 
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-500/20' 
                      : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300'
                  }`}
                >
                  {f.label}
                  {f.key !== 'all' && (
                    <span className={`mr-2 px-1.5 py-0.5 rounded-md text-[10px] ${
                      statusFilter === f.key ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-400'
                    }`}>
                      {myOrders.filter(o => o.status === f.key).length}
                    </span>
                  )}
                </button>
              ))}
            </div>
            
            <div className="space-y-1.5">
              <label className="text-[11px] font-black text-slate-400 uppercase tracking-wider block pr-1">من تاريخ</label>
              <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
                className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-indigo-500 transition-all" />
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] font-black text-slate-400 uppercase tracking-wider block pr-1">إلى تاريخ</label>
              <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
                className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-indigo-500 transition-all" />
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] font-black text-slate-400 uppercase tracking-wider block pr-1">شركة التوصيل</label>
              <select
                value={courierFilter}
                onChange={e => setCourierFilter(e.target.value)}
                className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-indigo-500 transition-all appearance-none"
              >
                <option value="all">كل الشركات</option>
                <option value="internal">توصيل داخلي / استلام</option>
                {myCouriers.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div className="flex items-end gap-2">
              <button 
                onClick={() => { setDateFrom(''); setDateTo(''); setStatusFilter('all'); setCourierFilter('all'); setSearch(''); }}
                className="w-full py-2.5 bg-white text-rose-600 border border-rose-100 rounded-xl text-sm font-bold hover:bg-rose-50 transition-all shadow-sm active:scale-95"
              >
                مسح الفلاتر
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 📦 جدول الطلبيات الاحترافي - High Density v5.0 */}
      <div className="bg-white rounded-[2.5rem] border border-slate-200/60 shadow-2xl shadow-slate-200/40 overflow-hidden relative">
        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100">
                <th className="px-6 py-5 text-[11px] font-black text-slate-400 uppercase tracking-widest">المعرف</th>
                <th className="px-6 py-5 text-[11px] font-black text-slate-400 uppercase tracking-widest">الزبون والوجهة</th>
                <th className="px-6 py-5 text-[11px] font-black text-slate-400 uppercase tracking-widest text-center">حالة النظام</th>
                <th className="px-6 py-5 text-[11px] font-black text-slate-400 uppercase tracking-widest">التتبع والشركة</th>
                <th className="px-6 py-5 text-[11px] font-black text-slate-400 uppercase tracking-widest">المالية</th>
                <th className="px-6 py-5 text-[11px] font-black text-slate-400 uppercase tracking-widest">التاريخ</th>
                <th className="px-6 py-5 text-[11px] font-black text-slate-400 uppercase tracking-widest text-center">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.map((o) => {
                const statusInfo = ORDER_STATUS[o.status as keyof typeof ORDER_STATUS];
                const courier = myCouriers.find(c => c.id === o.courierCompanyId);
                const isSentToVanex = !!(o.courier_package_id || o.courier_tracking_code);
                const vanexBadge = getVanexStatusBadge(o);
                
                return (
                  <tr key={o.id} className="group hover:bg-slate-50/80 transition-all duration-200 h-[56px]">
                    {/* 1. المعرف */}
                    <td className="px-6 py-3">
                      <div className="flex flex-col">
                        <span className="text-sm font-black text-slate-900 group-hover:text-indigo-600 transition-colors">
                          {o.orderNumber.replace('ORD-', '')}
                        </span>
                        <div className="flex items-center gap-1.5 mt-0.5">
                           <span className="text-[10px] text-slate-400 font-mono">ORD</span>
                           {o.notes && <div className="w-1 h-1 bg-amber-400 rounded-full animate-pulse" title={o.notes} />}
                        </div>
                      </div>
                    </td>

                    {/* 2. الزبون والوجهة */}
                    <td className="px-6 py-3">
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-slate-800 leading-tight">{o.customerName}</span>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-md">{o.customerCity}</span>
                          <span className="text-[10px] text-slate-400 font-medium" dir="ltr">{o.customerPhone}</span>
                        </div>
                      </div>
                    </td>

                    {/* 3. الحالة */}
                    <td className="px-6 py-3 text-center">
                      <div className="inline-flex items-center justify-center">
                        <span className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-black shadow-sm ring-1 ring-inset transition-all group-hover:scale-105 active:scale-95 ${
                          o.status === 'pending'
                            ? isSentToVanex 
                              ? 'bg-blue-50 text-blue-700 ring-blue-500/10' 
                              : 'bg-emerald-50 text-emerald-700 ring-emerald-500/10'
                            : `${statusInfo?.bg || 'bg-slate-50'} ${statusInfo?.text || 'text-slate-600'} ring-slate-500/10`
                        }`}>
                          <div className={`w-1.5 h-1.5 rounded-full ${
                             o.status === 'pending' ? (isSentToVanex ? 'bg-blue-400' : 'bg-emerald-400') : (statusInfo?.dot?.replace('bg-', '') ? statusInfo.dot : 'bg-slate-400')
                          }`} />
                          {o.status === 'pending' ? (isSentToVanex ? 'مرسلة' : 'جديدة') : statusInfo?.label}
                        </span>
                      </div>
                    </td>

                    {/* 4. التتبع والشركة */}
                    <td className="px-6 py-3">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                           <span className="text-xs font-bold text-slate-600">{courier?.name || (o.deliveryType === 'pickup' ? 'استلام' : 'دخلي')}</span>
                           {o.courier_tracking_code && (
                             <button 
                               onClick={() => { navigator.clipboard.writeText(o.courier_tracking_code!); showToast('تم النسخ', 'success'); }}
                               className="text-[10px] font-mono bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded border border-indigo-100 opacity-0 group-hover:opacity-100 transition-opacity"
                             >
                               {o.courier_tracking_code}
                             </button>
                           )}
                        </div>
                        {vanexBadge && vanexBadge.label !== '🚛 أُرسلت' && (
                          <div className={`flex items-center gap-1.5 ${vanexBadge.bg} ${vanexBadge.text} text-[10px] px-2 py-0.5 rounded-md w-fit font-bold`}>
                            <RefreshCw size={10} className={trackingOrderId === o.id ? 'animate-spin' : ''} onClick={() => handleTrackOrder(o.id)} />
                            {vanexBadge.label}
                          </div>
                        )}
                      </div>
                    </td>

                    {/* 5. المالية */}
                    <td className="px-6 py-3">
                      <div className="flex flex-col">
                        <span className="text-sm font-black text-slate-900">{formatCurrency(o.total)}</span>
                        {o.discount > 0 && <span className="text-[10px] font-bold text-rose-500">خصم {formatCurrency(o.discount)}</span>}
                      </div>
                    </td>

                    {/* 6. التاريخ */}
                    <td className="px-6 py-3">
                      <span className="text-[11px] font-bold text-slate-400 whitespace-nowrap">{formatDate(o.createdAt)}</span>
                    </td>

                    {/* 7. الإجراءات */}
                    <td className="px-6 py-3">
                      <div className="flex items-center justify-center gap-1">
                        {/* تعديل */}
                        {o.status === 'pending' && !isSentToVanex && (
                          <button 
                            onClick={() => handleEditOrder(o)}
                            className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
                            title="تعديل الشحنة"
                          >
                            <Edit2 size={16} />
                          </button>
                        )}
                        
                        {/* إرسال لفانكس */}
                        {(o.status === 'pending' && !!courier?.isApiConnected && !isSentToVanex) && (
                          <button 
                             disabled={sendingToVanex === o.id}
                             onClick={async () => {
                               setSendingToVanex(o.id);
                               const res = await sendOrderToVanex(o.id);
                               if (res.success) {
                                 showToast('تم الإرسال بنجاح', 'success');
                                 queryClient.invalidateQueries({ queryKey: ['orders', tid] });
                               } else {
                                 showToast(res.error || 'فشل الإرسال', 'error');
                               }
                               setSendingToVanex(null);
                             }}
                             className={`p-2 rounded-xl transition-all shadow-sm ${
                               sendingToVanex === o.id ? 'bg-slate-100 text-slate-400' : 'bg-indigo-600 text-white hover:bg-indigo-700 active:scale-90 scale-110'
                             }`}
                             title="إرسال لشركة التوصيل"
                          >
                             {sendingToVanex === o.id ? <RefreshCw size={16} className="animate-spin" /> : <Truck size={16} />}
                          </button>
                        )}

                        {/* العمليات المتاحة (Change Status) */}
                        {!isSentToVanex && NEXT_STATUSES[o.status]?.length > 0 && (
                          <div className="flex items-center gap-1 ml-2 border-r pr-2 border-slate-100">
                             {NEXT_STATUSES[o.status].slice(0, 1).map(action => (
                               <button 
                                 key={action.status}
                                 onClick={() => handleStatusChange(o.id, action.status)}
                                 className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black tracking-wide transition-all ${action.bg} ${action.text} hover:opacity-80 active:scale-95`}
                               >
                                 {action.icon}
                                 {action.label}
                               </button>
                             ))}
                          </div>
                        )}

                        {/* حذف */}
                        {o.status === 'pending' && !isSentToVanex && (
                          <button 
                            onClick={() => { if(confirm('متأكد؟')) handleDeleteOrder(o.id); }}
                            className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
                            title="حذف نهائي"
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

          {filtered.length === 0 && !isOrdersLoading && (
            <div className="flex flex-col items-center justify-center py-20 bg-slate-50/30">
               <div className="p-6 bg-white rounded-full shadow-inner mb-4">
                  <ShoppingCart size={48} className="text-slate-200" />
               </div>
               <h3 className="text-lg font-black text-slate-900">لا توجد نتائج</h3>
               <p className="text-slate-500 font-medium mt-1">جرب استخدام كلمات بحث أخرى أو تعديل الفلاتر</p>
            </div>
          )}
        </div>
      </div>

      {/* ═══ SlideOver: إنشاء / تعديل طلبية ═══ */}
      <SlideOver 
        isOpen={slideOpen} 
        onClose={() => { setSlideOpen(false); setEditingOrder(null); setShowProductList(false); setShowPhone2(false); }} 
        title={editingOrder ? `تعديل الطلبية ${editingOrder.orderNumber}` : "إنشاء طلبية جديدة (نظام نقطة البيع)"} 
        width="w-full sm:max-w-5xl"
        darkMode={true}
      >
        <div className="flex flex-col h-full">
          {/* ⚡ مؤشر الخطوات - Steps Indicator v5.0 */}
          <div className="flex items-center gap-4 px-8 py-6 border-b border-white/5 bg-white/5 backdrop-blur-xl sticky top-0 z-20">
            {[
              { id: 1, label: 'المنتجات والزبون', icon: <ShoppingCart size={18} /> },
              { id: 2, label: 'التوصيل والمالية', icon: <Truck size={18} /> }
            ].map((s) => (
              <div key={s.id} className="flex items-center gap-3">
                <div className={`flex items-center justify-center w-10 h-10 rounded-2xl transition-all duration-500 ${
                  step === s.id 
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30 scale-110' 
                    : step > s.id ? 'bg-emerald-500 text-white' : 'bg-white/10 text-slate-400'
                }`}>
                  {step > s.id ? <CheckCircle2 size={20} /> : s.icon}
                </div>
                <div className="hidden md:flex flex-col items-start pr-1">
                  <span className={`text-[10px] font-black uppercase tracking-widest ${step === s.id ? 'text-indigo-400' : 'text-slate-500'}`}>الخطوة 0{s.id}</span>
                  <span className={`text-sm font-bold ${step === s.id ? 'text-white' : 'text-slate-500'}`}>{s.label}</span>
                </div>
                {s.id === 1 && <div className="w-12 h-[2px] mx-4 bg-white/5 rounded-full" />}
              </div>
            ))}
            
            <button 
              onClick={() => { setSlideOpen(false); setStep(1); }}
              className="mr-auto p-2 hover:bg-white/10 rounded-xl text-slate-400 transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
            {step === 1 ? (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-in fade-in slide-in-from-left-4 duration-500">
                {/* 🛒 اختيار المنتجات (Toggleable) */}
                {showProductList && (
                  <div className="lg:col-span-4 space-y-4">
                    <div className="bg-white/5 border border-white/10 rounded-3xl p-5 backdrop-blur-md">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-black text-white/90 flex items-center gap-2">
                          <Package size={16} className="text-indigo-400" />
                          الكتالوج
                        </h3>
                        <button onClick={() => setShowProductList(false)} className="text-slate-400 hover:text-white transition-colors">
                          <X size={16} />
                        </button>
                      </div>
                      
                      <div className="relative group mb-3">
                        <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-indigo-400 transition-colors" />
                        <input 
                          type="text" 
                          placeholder="بحث..." 
                          value={productSearch} 
                          onChange={e => setProductSearch(e.target.value)}
                          className="w-full pr-10 pl-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500 focus:bg-white/10 transition-all"
                        />
                      </div>

                      <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1 custom-scrollbar">
                        {myProducts
                          .filter(p => p.quantity > 0 && p.isActive && (p.name.includes(productSearch) || String(p.itemCode).includes(productSearch)))
                          .map(p => (
                            <div key={p.id} className="p-3 bg-white/5 border border-white/5 rounded-2xl flex items-center justify-between hover:bg-white/10 hover:border-indigo-500/30 transition-all cursor-pointer group"
                                onClick={() => setOrderItems([{ productId: p.id, quantity: 1, variantSize: '' }, ...orderItems])}
                                title={p.name}>
                              <div className="flex-1 min-w-0 pr-2">
                                 <p className="text-xs font-bold text-white group-hover:text-indigo-400 truncate">{p.name}</p>
                                 <span className="text-[9px] text-slate-500 font-mono">BN{p.itemCode} • متاح {p.quantity}</span>
                              </div>
                              <div className="flex flex-col items-end gap-1 flex-shrink-0 pl-2 border-l border-white/5">
                                 <span className="text-[11px] font-black text-white">{formatCurrency(p.sellingPrice)}</span>
                                 <div className="w-5 h-5 rounded-md bg-indigo-600/20 text-indigo-400 flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition-all">
                                    <Plus size={12} />
                                 </div>
                              </div>
                            </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* 🛍️ سلة الطلبية وبيانات الزبون */}
                <div className={`${showProductList ? 'lg:col-span-8' : 'lg:col-span-12 max-w-4xl mx-auto w-full'} flex flex-col gap-6`}>
                  {/* السلة */}
                  <div className="bg-white/5 border border-white/10 rounded-3xl p-6 backdrop-blur-md">
                     <div className="flex items-center justify-between mb-5 pb-5 border-b border-white/5">
                        <div className="flex items-center gap-4">
                           <h3 className="text-base font-black text-white flex items-center gap-2">
                              <ShoppingCart size={18} className="text-indigo-400" />
                              سلة المشتريات
                           </h3>
                           <span className="px-3 py-0.5 bg-indigo-600/20 text-indigo-400 text-[10px] font-black rounded-full border border-indigo-500/20">
                              {orderItems.length}
                           </span>
                        </div>
                        
                        {!showProductList && (
                          <button 
                            onClick={() => setShowProductList(true)}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition-all shadow-sm"
                          >
                            <Plus size={14} /> إدراج منتجات
                          </button>
                        )}
                     </div>
                    <div className="space-y-4">
                      {orderItems.map((item, idx) => {
                        const product = myProducts.find(p => p.id === item.productId);
                        return (
                          <div key={idx} className="group relative flex items-center gap-4 bg-white/5 border border-white/5 p-4 rounded-3xl hover:bg-white/10 transition-all">
                            <div className="flex-1 min-w-0">
                               <p className="text-sm font-bold text-white truncate">{product?.name || 'منتج غير معروف'}</p>
                               <div className="flex items-center gap-2 mt-1">
                                  <span className="text-[10px] font-bold text-slate-500 bg-white/5 px-1.5 py-0.5 rounded-md">
                                    {formatCurrency(product?.sellingPrice || 0)}
                                  </span>
                                  {product?.productType === 'clothing' && (
                                     <select 
                                       value={item.variantSize || ''} 
                                       onChange={(e) => updateItem(idx, 'variantSize', e.target.value)}
                                       className="bg-transparent text-[10px] font-bold text-indigo-400 border-none focus:ring-0 p-0"
                                     >
                                        <option value="" className="bg-slate-900">المقاس...</option>
                                        {product.variants?.map(v => (
                                          <option key={v.size} value={v.size} className="bg-slate-900">{v.size}</option>
                                        ))}
                                     </select>
                                  )}
                               </div>
                            </div>
                            
                            <div className="flex items-center gap-4">
                               <div className="flex items-center bg-black/40 rounded-xl border border-white/5">
                                  <button onClick={() => updateItem(idx, 'quantity', Math.max(1, item.quantity - 1))} className="p-2 text-slate-400 hover:text-white transition-colors">-</button>
                                  <span className="w-8 text-center text-xs font-black text-white">{item.quantity}</span>
                                  <button onClick={() => updateItem(idx, 'quantity', item.quantity + 1)} className="p-2 text-slate-400 hover:text-white transition-colors">+</button>
                               </div>
                               <span className="text-sm font-black text-white min-w-[60px] text-left">{formatCurrency((product?.sellingPrice || 0) * item.quantity)}</span>
                               <button onClick={() => removeItem(idx)} className="p-2 text-rose-500/50 hover:text-rose-500 hover:bg-rose-500/10 rounded-xl transition-all">
                                  <Trash2 size={16} />
                                </button>
                            </div>
                          </div>
                        );
                      })}
                      {orderItems.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-12 bg-white/5 border-2 border-dashed border-white/5 rounded-[2rem]">
                          <ShoppingCart size={40} className="text-white/10 mb-4" />
                          <p className="text-sm font-bold text-slate-500">السلة فارغة، أضف بعض المنتجات!</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* بيانات الزبون */}
                  <div className="bg-white/5 border border-white/10 rounded-3xl p-6 backdrop-blur-md">
                    <h3 className="text-base font-black text-white flex items-center gap-2 mb-5">
                       <User size={18} className="text-indigo-400" />
                       بيانات الزبون
                    </h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                       <div className="space-y-1.5">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block pr-1 flex items-center justify-between shadow-sm">
                            <span>رقم الهاتف *</span>
                            {!showPhone2 && (
                              <button onClick={() => setShowPhone2(true)} className="text-indigo-400 hover:text-indigo-300 transition-colors flex items-center gap-1">
                                <Plus size={10} /> إضافي
                              </button>
                            )}
                          </label>
                          <div className="flex gap-2">
                            <input 
                              type="tel" 
                              value={newOrder.customerPhone} 
                              onChange={(e) => handlePhoneChange(e.target.value)}
                              maxLength={10}
                              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500 transition-all font-mono" 
                              placeholder="09XXXXXXXX" 
                              dir="ltr"
                            />
                            {showPhone2 && (
                              <div className="relative w-full animate-in fade-in slide-in-from-right-2">
                                <input 
                                  type="tel" 
                                  value={newOrder.customerPhone2 || ''} 
                                  onChange={(e) => setNewOrder({ ...newOrder, customerPhone2: e.target.value })}
                                  maxLength={10}
                                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500 transition-all font-mono pr-8" 
                                  placeholder="احتياطي" 
                                  dir="ltr"
                                />
                                <button onClick={() => { setShowPhone2(false); setNewOrder({ ...newOrder, customerPhone2: '' }); }} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-rose-400 transition-colors">
                                  <X size={14} />
                                </button>
                              </div>
                            )}
                          </div>
                       </div>
                       <div className="space-y-1.5">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block pr-1">اسم الزبون *</label>
                          <input 
                            type="text" 
                            value={newOrder.customerName} 
                            onChange={(e) => setNewOrder({ ...newOrder, customerName: e.target.value })}
                            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500 transition-all font-bold" 
                            placeholder="أدخل اسم الزبون..."
                          />
                       </div>
                    </div>

                    <div className="mt-5 pt-5 border-t border-white/5">
                       <button 
                         onClick={() => setNewOrder(p => ({ ...p, showDimensions: !p.showDimensions }))}
                         className="flex items-center gap-2 text-xs font-bold text-indigo-400 hover:text-indigo-300 transition-colors"
                       >
                         {newOrder.showDimensions ? '- إخفاء تفاصيل الشحنة الكبيرة' : '+ هل الشحنة كبيرة؟ أضف الأبعاد'}
                       </button>

                       {newOrder.showDimensions && (
                         <div className="grid grid-cols-3 gap-4 mt-4 animate-in fade-in zoom-in-95 duration-300">
                            {['Length', 'Width', 'Height'].map((dim) => (
                              <div key={dim} className="space-y-1.5">
                                <label className="text-[10px] font-black text-slate-500 uppercase">{dim} (cm)</label>
                                <input 
                                  type="number" 
                                  value={newOrder[`dim${dim}` as keyof typeof newOrder] as string} 
                                  onChange={e => setNewOrder({ ...newOrder, [`dim${dim}`]: e.target.value })}
                                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500" 
                                  placeholder="0"
                                />
                              </div>
                            ))}
                         </div>
                       )}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-8 animate-in fade-in slide-in-from-right-4 duration-500 pb-24">
                {/* 🚚 خيارات التوصيل */}
                <div className="bg-white/5 border border-white/10 rounded-[2rem] p-8 backdrop-blur-md">
                   <h3 className="text-lg font-black text-white flex items-center gap-3 mb-6">
                      <Truck size={22} className="text-indigo-400" />
                      خيارات التوصيل والوجهة
                   </h3>
                   
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      {/* نوع التوصيل */}
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest block pr-1">نوع التوصيل</label>
                        <select 
                          value={newOrder.deliveryType} 
                          onChange={(e) => setNewOrder({ ...newOrder, deliveryType: e.target.value as Order['deliveryType'], courierId: '' })}
                          className="w-full px-6 py-4 bg-white/5 border border-white/10 rounded-2xl text-sm text-white focus:outline-none focus:border-indigo-500 transition-all appearance-none"
                        >
                          <option value="courier_company" className="bg-slate-900">شحن عبر شركة توصيل</option>
                          <option value="internal" className="bg-slate-900">توصيل داخلي / مندوب</option>
                          <option value="pickup" className="bg-slate-900">استلام من المحل</option>
                        </select>
                      </div>

                      {/* الشركة */}
                      {newOrder.deliveryType === 'courier_company' && (
                        <div className="space-y-1.5">
                          <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest block pr-1">شركة التوصيل</label>
                          <select 
                            value={newOrder.courierId} 
                            onChange={(e) => setNewOrder({ ...newOrder, courierId: e.target.value, customerCity: '' })}
                            className="w-full px-6 py-4 bg-white/5 border border-white/10 rounded-2xl text-sm text-white focus:outline-none focus:border-indigo-500 transition-all appearance-none"
                          >
                             <option value="" className="bg-slate-900">اختر الشركة...</option>
                             {myCouriers.filter(c => c.isActive).map(c => (
                               <option key={c.id} value={c.id} className="bg-slate-900">{c.name}</option>
                             ))}
                          </select>
                        </div>
                      )}
                      
                      {/* وجهة التوصيل المدعومة ومناطق بنيان */}
                      {newOrder.deliveryType === 'courier_company' && newOrder.courierId && (
                        <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-5">
                           <div className="space-y-1.5">
                             <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block pr-1">المدينة (من نظام الشركة)</label>
                             <div className="relative group">
                                <input 
                                  type="text"
                                  value={newOrder.customerCity}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    let courierCityId: number | undefined = undefined;
                                    const courier = myCouriers.find(c => c.id === newOrder.courierId);
                                    if (courier?.isApiConnected) {
                                      const cities = useDataStore.getState().bunyanCities;
                                      const exactMapping = shippingCityMappings.find(m => (cities.find(c => c.id === m.bunyan_city_id)?.name_ar || m.bunyanCityName) === val);
                                      if (exactMapping) { courierCityId = exactMapping.provider_city_id; fetchVanexSubCities(courierCityId, newOrder.courierId); }
                                    }
                                    setNewOrder({ ...newOrder, customerCity: val, courierCityId, courierSubCityId: undefined, customerAddress: '' });
                                  }}
                                  onFocus={() => setCityFocused(true)}
                                  onBlur={() => setTimeout(() => setCityFocused(false), 200)}
                                  placeholder="ابحث عن المدينة..."
                                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500 transition-all font-bold"
                                />
                                {/* City Dropdown framework */}
                                {cityFocused && newOrder.customerCity && (
                                   <div className="absolute top-full left-0 right-0 mt-2 bg-[#1A1B2E] border border-white/10 rounded-2xl shadow-2xl z-50 max-h-60 overflow-y-auto custom-scrollbar p-2 space-y-1">
                                      {shippingCityMappings.filter(m => (m.bunyanCityName || '').toLowerCase().includes(newOrder.customerCity.toLowerCase())).map(m => (
                                        <button 
                                          key={m.id}
                                          type="button"
                                          onClick={() => {
                                            const cityName = m.bunyanCityName || '';
                                            setNewOrder({ ...newOrder, customerCity: cityName, courierCityId: m.provider_city_id, customerAddress: '' });
                                            fetchVanexSubCities(m.provider_city_id, newOrder.courierId);
                                            setCityFocused(false);
                                          }}
                                          className="w-full text-right px-4 py-3 text-sm text-white hover:bg-white/10 rounded-xl transition-all font-bold flex items-center justify-between group"
                                        >
                                          <span>{m.bunyanCityName}</span>
                                          <ChevronLeft size={14} className="text-slate-600 group-hover:text-indigo-400 transform group-hover:translate-x-1 transition-all" />
                                        </button>
                                      ))}
                                      {shippingCityMappings.filter(m => (m.bunyanCityName || '').toLowerCase().includes(newOrder.customerCity.toLowerCase())).length === 0 && (
                                        <p className="p-4 text-xs text-slate-500 text-center">لم يتم العثور على مدن مطابقة</p>
                                      )}
                                   </div>
                                 )}
                             </div>
                           </div>

                           <div className="space-y-1.5">
                             <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block pr-1">المنطقة (بنيان)</label>
                             <select
                               value={newOrder.customerAddress || ''}
                               onChange={(e) => setNewOrder({ ...newOrder, customerAddress: e.target.value })}
                               disabled={!newOrder.customerCity}
                               className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500 transition-all font-bold appearance-none disabled:opacity-50"
                             >
                                <option value="" className="bg-slate-900">اختر المنطقة بناءً على المدينة...</option>
                                {(() => {
                                  const bunyanCities = useDataStore.getState().bunyanCities;
                                  const matchedCityId = bunyanCities.find(c => c.name_ar === newOrder.customerCity)?.id;
                                  if (!matchedCityId) return null;
                                  
                                  const bunyanRegions = useDataStore.getState().bunyanRegions;
                                  return bunyanRegions.filter(r => r.city_id === matchedCityId).map(r => (
                                    <option key={r.id} value={r.name_ar} className="bg-slate-900">{r.name_ar}</option>
                                  ));
                                })()}
                             </select>
                           </div>
                        </div>
                      )}
                   </div>
                </div>

                {/* 💳 المالية والملاحظات */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                   {/* الملخص المالي */}
                   <div className="bg-white/5 border border-white/10 rounded-3xl p-6 backdrop-blur-md space-y-5">
                      <h3 className="text-base font-black text-white flex items-center gap-2">
                         <CreditCard size={18} className="text-indigo-400" />
                         تفاصيل التحصيل
                      </h3>
                      
                      <div className="space-y-3">
                         <div className="flex justify-between items-center bg-black/20 p-3.5 rounded-2xl border border-white/5">
                            <span className="text-xs font-bold text-slate-400">مجموع المنتجات</span>
                            <span className="text-base font-black text-white">{formatCurrency(orderCalculations.subtotal)}</span>
                         </div>
                         
                         <div className="flex justify-between items-center bg-black/20 p-3.5 rounded-2xl border border-white/5">
                            <span className="text-xs font-bold text-slate-400">الخصم المباشر (د.ل)</span>
                            <input 
                              type="number" 
                              value={newOrder.discount || ''} 
                              onChange={(e) => setNewOrder({ ...newOrder, discount: Number(e.target.value) })}
                              className="w-20 bg-white/5 border border-white/10 rounded-xl px-2 py-1 text-center text-xs text-white font-black"
                              placeholder="0"
                            />
                         </div>

                         <div className="flex justify-between items-center bg-black/20 p-3.5 rounded-2xl border border-white/5">
                             <div className="flex flex-col">
                                <span className="text-xs font-bold text-slate-400">التوصيل</span>
                                {newOrder.priceIncludesDelivery && <span className="text-[9px] text-emerald-400 font-bold mt-0.5">مشمول في الفاتورة</span>}
                             </div>
                             <span className="text-xs font-black text-white">
                                {newOrder.priceIncludesDelivery ? '0 د.ل' : formatCurrency(orderCalculations.deliveryFee)}
                             </span>
                         </div>

                         <div className="pt-3 border-t border-white/10">
                            <div className="flex justify-between items-center">
                               <span className="text-sm font-black text-white">الإجمالي للتحصيل</span>
                               <span className="text-2xl font-black text-indigo-400 tracking-tighter">{formatCurrency(orderCalculations.total)}</span>
                            </div>
                         </div>
                      </div>
                   </div>

                   {/* الملاحظات وإعدادات الدفع */}
                   <div className="flex flex-col gap-5">
                      <div className="bg-white/5 border border-white/10 rounded-3xl p-6 backdrop-blur-md flex-1 flex flex-col">
                         <h3 className="text-xs font-black text-white/90 mb-3 uppercase tracking-widest">توجيهات إضافية</h3>
                          <textarea 
                           value={newOrder.notes} 
                           onChange={(e) => setNewOrder({ ...newOrder, notes: e.target.value })}
                           className="w-full h-full min-h-[100px] bg-white/5 border border-white/10 rounded-2xl p-4 text-xs text-white focus:outline-none focus:border-indigo-500 resize-none"
                           placeholder="أضف أي ملاحظات هامة للمندوب أو التحضير..."
                         />
                      </div>
                      
                      {/* هل السعر شامل؟ */}
                      <label className="flex items-center gap-3 p-4 bg-indigo-600/10 border border-indigo-500/20 rounded-2xl cursor-pointer hover:bg-indigo-600/20 transition-all group">
                         <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${newOrder.priceIncludesDelivery ? 'bg-indigo-600 border-indigo-600' : 'border-white/10 group-hover:border-indigo-500'}`}>
                            {newOrder.priceIncludesDelivery && <Check size={12} className="text-white" />}
                         </div>
                         <input 
                           type="checkbox" 
                           className="hidden"
                           checked={newOrder.priceIncludesDelivery} 
                           onChange={e => setNewOrder({ ...newOrder, priceIncludesDelivery: e.target.checked })} 
                         />
                         <span className="text-xs font-bold text-white/80 leading-snug">السعر يشمل التوصيل مسبقاً (تصفير الرسوم)</span>
                      </label>
                   </div>
                </div>
              </div>
            )}
          </div>

          {/* 🔘 الأزرار السفلية الثابتة - Control Center v5.0 */}
          <div className="absolute bottom-0 left-0 right-0 p-6 bg-[#08091A]/80 backdrop-blur-md border-t border-white/5 z-30">
             <div className="flex items-center justify-between gap-4 max-w-full">
                {step === 2 && (
                  <button 
                    onClick={() => setStep(1)}
                    className="flex items-center gap-2 px-6 py-3 bg-white/5 text-white text-xs font-bold rounded-xl hover:bg-white/10 transition-all border border-white/5"
                  >
                    <ArrowRight size={16} />
                    السابق
                  </button>
                )}
                
                <div className="flex-1" />

                <button 
                  onClick={step === 1 ? () => setStep(2) : handleCreateOrder}
                  disabled={isCreatingOrder}
                  className={`flex items-center justify-center gap-2 px-8 py-3 rounded-xl text-white font-black text-xs shadow-xl transition-all active:scale-95 ${
                    step === 1 
                      ? 'bg-indigo-600 hover:bg-indigo-500' 
                      : 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-500/20'
                  } disabled:opacity-50 min-w-[160px]`}
                >
                  {isCreatingOrder ? (
                    <><RefreshCw size={16} className="animate-spin" /> جاري الحفظ...</>
                  ) : (
                    <>
                      {step === 1 ? 'متابعة العمل →' : (editingOrder ? 'تحديث البيانات' : 'اعتماد الطلبية النهائية')}
                      {step === 2 && <ShieldCheck size={18} />}
                    </>
                  )}
                </button>
             </div>
          </div>
        </div>
      </SlideOver>

      {/* ═══ نافذة تأكيد الإجراء ═══ */}
      <ConfirmDialog
        isOpen={!!confirmAction}
        onCancel={() => setConfirmAction(null)}
        onConfirm={handleConfirmAction}
        title={`تأكيد تحويل الحالة إلى "${confirmAction?.label}"`}
        message={`هل أنت متأكد من تغيير حالة الطلبية "${filtered.find((o) => o.id === confirmAction?.orderId)?.orderNumber || ''}"?${
          confirmAction?.newStatus === 'cancelled'
            ? (filtered.find(o => o.id === confirmAction?.orderId)?.courier_tracking_code
                ? ' (سيتم إلغاء الشحنة من فانكس + إرجاع المخزون وتسوية الحسابات)'
                : ' (سيتم إرجاع المخزون وتسوية الحسابات الخاصة بالفاتورة)')
            : confirmAction?.newStatus === 'return_confirmed' ? ' (سيتم إرجاع المخزون وتسوية مستحقات التوصيل إن وجدت)' :
          confirmAction?.newStatus === 'delivered' ? ' (سيتم إغلاق الفاتورة وتسجيل المبيعات)' : ''
        }`}
        variant={confirmAction?.newStatus === 'cancelled' || confirmAction?.newStatus === 'return_confirmed' ? 'danger' : 'primary'}
      />
    </div>
  );
}
