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
import { SlideOver } from '@/shared/components/ui/SlideOver';
import { ConfirmDialog } from '@/shared/components/ui/ConfirmDialog';
import { useToast } from '@/shared/components/ui/Toast';
import { ORDER_STATUS } from '@/shared/utils/statusColors';
import {
  ShoppingCart, Search, Plus, Trash2, Package,
  CheckCircle2, Truck, Ban, RotateCcw, ArrowDownCircle,
  Filter, Calendar, Percent, RefreshCw, Copy
} from 'lucide-react';
import type { Order, Product } from '@/core/types';

// ═══ الانتقالات المسموحة لكل حالة ═══
const NEXT_STATUSES: Record<string, { status: Order['status']; label: string; icon: React.ReactNode; bg: string; text: string; hover: string }[]> = {
  pending: [
    { status: 'processing', label: 'تجهيز', icon: <Package size={14} />, bg: 'bg-indigo-50', text: 'text-indigo-700', hover: 'hover:bg-indigo-100' },
    { status: 'cancelled', label: 'إلغاء', icon: <Ban size={14} />, bg: 'bg-red-50', text: 'text-red-700', hover: 'hover:bg-red-100' },
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
  const { customers, shippingCityMappings, shippingRegionMappings, vanexSubCities, fetchGeoMappings } = useDataStore(
    useShallow(s => ({
      customers: s.customers,
      shippingCityMappings: s.shippingCityMappings,
      shippingRegionMappings: s.shippingRegionMappings,
      vanexSubCities: s.vanexSubCities,
      fetchGeoMappings: s.fetchGeoMappings,
    }))
  );

  // ✅ Actions — مستقرة دائماً (Zustand يضمن reference ثابت للـ actions)
  const getForTenant      = useDataStore(s => s.getForTenant);
  const addOrder          = useDataStore(s => s.addOrder);
  const updateOrderStatus = useDataStore(s => s.updateOrderStatus);
  const patchOrder        = useDataStore(s => s.patchOrder);
  const sendOrderToVanex  = useDataStore(s => s.sendOrderToVanex);
  const cancelOrderVanex  = useDataStore(s => s.cancelOrderVanex);
  const fetchVanexSubCities = useDataStore(s => s.fetchVanexSubCities);

  const { showToast } = useToast();
  const tid = user?.tenantId || '';

  // ── React Query لجلب الطلبيات ──
  const { data: myOrders = [], isLoading: isOrdersLoading, refetch } = useOrdersQuery(tid);

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
  const [cityFocused, setCityFocused] = useState(false);

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
  const [confirmAction, setConfirmAction] = useState<{ orderId: string; newStatus: Order['status'], label: string } | null>(null);

  // نموذج طلبية جديدة
  const [newOrder, setNewOrder] = useState({
    customerName: '', customerPhone: '', customerPhone2: '', customerAddress: '', customerCity: '',
    vanexCityId: undefined as number | undefined, vanexSubCityId: undefined as number | undefined,
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
  
  const [vanexDeliveryPrice, setVanexDeliveryPrice] = useState<number | null>(null);

  useEffect(() => {
    const courier = myCouriers.find(c => c.id === newOrder.courierId);
    if (!courier || (courier.apiProvider?.includes('vanex') === false && courier.provider?.includes('vanex') === false && !courier.name.includes('فانكس'))) {
      setVanexDeliveryPrice(null);
      return;
    }

    if (!newOrder.dimLength || !newOrder.dimWidth || !newOrder.dimHeight || !newOrder.vanexCityId || !courier.apiCredentials?.vanexFromRegionId) {
      setVanexDeliveryPrice(null);
      return;
    }

    const fetchPrice = async () => {
      try {
        const adapter = new VanexAdapter();
        const fromRegionId = Number(courier.apiCredentials!.vanexFromRegionId);
        const toCityId = Number(newOrder.vanexCityId);
        if (isNaN(fromRegionId) || isNaN(toCityId)) return;
        
        const price = await adapter.calculateDeliveryPrice(fromRegionId, toCityId);
        if (price && price.total !== undefined) {
          setVanexDeliveryPrice(price.total);
        } else {
          setVanexDeliveryPrice(null);
        }
      } catch (err) {
        console.error('Failed to calculate vanex price', err);
        setVanexDeliveryPrice(null);
      }
    };

    fetchPrice();
  }, [newOrder.dimLength, newOrder.dimWidth, newOrder.dimHeight, newOrder.courierId, newOrder.vanexCityId, myCouriers]);

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
  const addItem = () => setOrderItems([...orderItems, { productId: '', quantity: 1, variantSize: '' }]);
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

  // ═══ إنشاء الطلبية ═══
  const handleCreateOrder = async () => {
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
        if (newOrder.vanexCityId) {
           const cityMapping = shippingCityMappings.find(m => {
              const bName = cities.find(c => c.id === m.bunyan_city_id)?.name_ar || m.bunyanCityName;
              return m.is_active && m.provider_city_id === newOrder.vanexCityId && bName === newOrder.customerCity;
           });
           const myRegions = cityMapping ? shippingRegionMappings.filter(r => r.city_mapping_id === cityMapping.id && r.is_active) : [];
           
           if (myRegions.length > 0 && !newOrder.vanexSubCityId) {
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
      vanexCityId: newOrder.vanexCityId,
      vanexSubCityId: newOrder.vanexSubCityId,
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

    const result = await addOrder(order);
    if (!result.success) {
      showToast(result.error || 'فشل في حفظ الطلبية — يرجى التحقق من الاتصال', 'error');
      return;
    }
    setSlideOpen(false);
    setNewOrder({ customerName: '', customerPhone: '', customerPhone2: '', customerAddress: '', customerCity: '', vanexCityId: undefined, vanexSubCityId: undefined, deliveryType: 'courier_company', courierId: '', notes: '', discount: 0, priceIncludesDelivery: false, commissionBy: 'customer', paymentMethod: 'cash', isPrepaid: false, prepaidAmount: 0, showDimensions: false, dimLength: '', dimWidth: '', dimHeight: '', vanexInsure: false, vanexMatch: false, vanexInspection: false, vanexFragile: false, vanexTryOn: false, vanexPartialAllowed: false, vanexNoHeat: false, vxExtraShippingCostOn: 'market', vxCollectionCommissionOn: 'market' });
    setOrderItems([]);
    showToast(`تم إنشاء الطلبية ${orderNum} بنجاح`);
    
    // Invalidate and refetch React Query cache for both orders and products
    queryClient.invalidateQueries({ queryKey: ['orders', tid] });
    queryClient.invalidateQueries({ queryKey: ['products', tid] });
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
      if (newStatus === 'cancelled' && order?.vanex_package_id) {
        showToast('جاري إلغاء الطلبية تلقائياً من نظام شركة التوصيل...', 'info');
        const cancelResult = await cancelOrderVanex(orderId);
        if (!cancelResult.success) {
          showToast(`❌ تعذر الإلغاء لأن النظام لم يستطع حذفها من فانكس: ${cancelResult.error}`, 'error');
          setConfirmAction(null);
          return; // منع الإلغاء محلياً لضمان التطابق
        }
        showToast('✅ تم إلغاء الشحنة على منصة فانكس', 'success');
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

  const isVanexCitySuspended = useMemo(() => {
    if (newOrder.deliveryType !== 'courier_company' || !newOrder.courierId || !newOrder.customerCity) return false;
    const courier = myCouriers.find(c => c.id === newOrder.courierId);
    if (!courier || (courier.apiProvider?.includes('vanex') === false && courier.provider?.includes('vanex') === false && !courier.name.includes('فانكس'))) return false;
    
    const cities = useDataStore.getState().bunyanCities;
    const mapping = shippingCityMappings.find(m => {
       const bName = cities.find(c => c.id === m.bunyan_city_id)?.name_ar || m.bunyanCityName;
       return bName === newOrder.customerCity && (!m.provider || m.provider?.includes('vanex'));
    });
    
    return mapping ? mapping.is_active === false : false;
  }, [newOrder.deliveryType, newOrder.courierId, newOrder.customerCity, myCouriers, shippingCityMappings]);

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

    if (!order.vanex_package_code) {
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
      {/* رأس الصفحة */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900 flex items-center gap-2">
            <ShoppingCart size={24} className="text-bunyan-600" />
            الطلبيات والمبيعات
            {isOrdersLoading && <span className="w-4 h-4 rounded-full border-2 border-bunyan-500 border-t-transparent animate-spin ml-2"></span>}
          </h1>
          <p className="text-sm text-gray-500 mt-1">تتبع رحلة الطلبيات من الإنشاء وحتى التوصيل</p>
        </div>
        <div className="flex items-center gap-2">
          {/* الزر الخاص بـ مزامنة الحالات تم نقله إلى قسم الفلاتر المتقدمة كخيار طوارئ */}
          <button onClick={() => setSlideOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-bunyan-600 text-white rounded-xl text-sm font-bold hover:bg-bunyan-700 transition-colors shadow-sm focus:ring-2 focus:ring-bunyan-500/50">
            <Plus size={18} /> طلبية جديدة
          </button>
        </div>
      </div>

      {/* شريط البحث والفلاتر */}
      <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm space-y-4">
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} 
              placeholder="بحث برقم الطلبية أو اسم الزبون..."
              className="w-full pr-10 pl-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-bunyan-500/30 focus:border-bunyan-500 transition-all" 
            />
          </div>
          <button onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-4 py-2 border rounded-xl text-sm font-bold transition-all ${
              showFilters || dateFrom || dateTo || statusFilter !== 'all' || courierFilter !== 'all'
                ? 'border-bunyan-500 text-bunyan-600 bg-bunyan-50' 
                : 'border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}>
            <Filter size={16} /> تصفية متقدمة
          </button>
        </div>

        {/* فلاتر متقدمة */}
        {showFilters && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-gray-100 animate-slide-down">
            <div className="md:col-span-3 pb-2 flex flex-wrap gap-2">
              {statusFiltersList.map((f) => (
                <button key={f.key} onClick={() => setStatusFilter(f.key)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                    statusFilter === f.key 
                      ? 'bg-bunyan-600 text-white border-bunyan-600 shadow-sm' 
                      : 'bg-white text-gray-700 border-gray-200 hover:border-bunyan-300'
                  }`}>
                  {f.label}
                  {f.key !== 'all' && (
                    <span className={`mr-1.5 inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1 rounded-full text-[10px] ${
                      statusFilter === f.key ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'
                    }`}>
                      {myOrders.filter(o => o.status === f.key).length}
                    </span>
                  )}
                </button>
              ))}
            </div>
            
            <div>
              <label className="text-xs font-bold text-gray-500 mb-1.5 flex items-center gap-1"><Calendar size={12}/> من تاريخ</label>
              <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-bunyan-500/30" />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-500 mb-1.5 flex items-center gap-1"><Calendar size={12}/> إلى تاريخ</label>
              <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-bunyan-500/30" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">شركة التوصيل</label>
              <select
                value={courierFilter}
                onChange={e => setCourierFilter(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-bunyan-500/30"
              >
                <option value="all">كل الشركات</option>
                <option value="internal">توصيل داخلي / استلام</option>
                {myCouriers.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div className="flex items-end gap-3 justify-end md:col-span-1 border-t md:border-t-0 md:border-r border-gray-100 pt-3 md:pt-0 md:pr-4">
              <button
                onClick={handleManualSync}
                disabled={isSyncing}
                title="يُستخدم في حالات الطوارئ فقط إذا تأخر الـ Webhook"
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-gray-400 hover:text-violet-600 hover:bg-violet-50 rounded-lg transition-colors ml-auto md:ml-0"
              >
                <RefreshCw size={12} className={isSyncing ? 'animate-spin' : ''} />
                مزامنة قسرية
              </button>
              
              <button onClick={() => { setDateFrom(''); setDateTo(''); setStatusFilter('all'); setSearch(''); setCourierFilter('all'); }}
                className="px-3 py-2 border rounded-lg text-sm font-bold border-gray-200 text-gray-500 hover:text-red-600 hover:bg-red-50 hover:border-red-200 transition-colors">
                مسح الفلاتر
              </button>
            </div>
          </div>
        )}
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
                <th className="px-4 py-4">التوصيل</th>
                <th className="px-6 py-4">الإجمالي</th>
                <th className="px-6 py-4">التاريخ</th>
                <th className="px-6 py-4 text-center">تحديث الحالة</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map((o) => {
                const statusInfo = ORDER_STATUS[o.status as keyof typeof ORDER_STATUS];
                const actions = NEXT_STATUSES[o.status] || [];
                return (
                  <tr key={o.id} className="hover:bg-gray-50/70 transition-colors">
                    <td className="px-6 py-4 font-bold text-gray-900 font-mono">
                      {o.orderNumber}
                      {o.notes && <p className="text-[10px] text-gray-400 font-sans font-normal mt-0.5 max-w-[120px] truncate">{o.notes}</p>}
                    </td>
                    <td className="px-6 py-4">
                      <p className="font-semibold text-gray-900">{o.customerName}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{o.customerCity} — <span dir="ltr">{o.customerPhone}</span></p>
                    </td>
                    <td className="px-6 py-4">
                      {statusInfo ? (
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${statusInfo.bg} ${statusInfo.text} border ${statusInfo.border || 'border-transparent'}`}>
                          {statusInfo.dot && <span className={`w-1.5 h-1.5 rounded-full ${statusInfo.dot}`} />}
                          {statusInfo.label}
                        </span>
                      ) : (
                        <span className="text-gray-500">{o.status}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {o.deliveryType === 'courier_company' ? (
                        <div className="flex flex-col gap-1.5">
                          <span className="text-gray-700 font-medium text-xs">
                            {myCouriers.find(c => c.id === o.courierCompanyId)?.name ?? '—'}
                          </span>
                          {/* ═══ كود فانكس — قابل للنسخ ═══ */}
                          {o.vanex_package_code && (
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(o.vanex_package_code!);
                                showToast('تم نسخ كود الشحنة', 'success');
                              }}
                              className="inline-flex items-center gap-1 bg-violet-50 text-violet-700 text-[10px] px-2 py-0.5 rounded-md font-mono border border-violet-200 hover:bg-violet-100 transition-colors cursor-pointer w-fit"
                              title="انقر للنسخ"
                            >
                              <Copy size={9} className="shrink-0" />
                              {o.vanex_package_code}
                            </button>
                          )}
                          {/* ═══ مؤشر حالة الشحنة ═══ */}
                          {(() => {
                            const badge = getVanexStatusBadge(o);
                            if (!badge) return null;
                            return (
                              <div className="flex items-center gap-1">
                                <span className={`inline-block ${badge.bg} ${badge.text} text-[10px] px-2 py-0.5 rounded-md font-semibold`}>
                                  {badge.label}
                                </span>
                                {/* ═══ زر التتبع ═══ */}
                                {o.vanex_package_code && (
                                  <button
                                    onClick={() => handleTrackOrder(o.id)}
                                    disabled={trackingOrderId === o.id}
                                    className="p-0.5 rounded hover:bg-gray-100 transition-colors text-gray-400 hover:text-violet-600 disabled:opacity-50"
                                    title="تحديث الحالة من فانكس"
                                  >
                                    <RefreshCw size={11} className={trackingOrderId === o.id ? 'animate-spin' : ''} />
                                  </button>
                                )}
                              </div>
                            );
                          })()}
                        </div>
                      ) : (
                        <span className="text-gray-400 text-xs">
                          {o.deliveryType === 'pickup' ? 'استلام من المحل' : 'توصيل داخلي'}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <p className="font-bold text-gray-900 font-currency">{formatCurrency(o.total)}</p>
                      {o.discount && o.discount > 0 ? <p className="text-[10px] text-green-600 font-semibold mt-0.5">خصم: {formatCurrency(o.discount)}</p> : null}
                    </td>
                    <td className="px-6 py-4 text-gray-500 text-xs">
                      {formatDate(o.createdAt)}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-2 items-center justify-center">
                        {(() => {
                          const courier = myCouriers.find(c => c.id === o.courierCompanyId);
                          // ═══ Dedup Guard في الواجهة: لا يظهر الزر إذا أُرسلت مسبقاً ═══
                          const isApiOrder = 
                            o.status === 'pending' && 
                            o.deliveryType === 'courier_company' && 
                            !!courier?.isApiConnected &&
                            !o.vanex_package_id;
                          if (isApiOrder) {
                            return (
                              <button
                                disabled={sendingToVanex === o.id}
                                onClick={async () => {
                                  setSendingToVanex(o.id);
                                  try {
                                    const courierName = courier?.name ?? 'شركة التوصيل';
                                    const result = await sendOrderToVanex(o.id);
                                    if (result.success) {
                                      showToast(
                                        `✅ تم إرسال ${o.orderNumber} لـ ${courierName} بنجاح`,
                                        'success'
                                      );
                                      queryClient.invalidateQueries({ queryKey: ['orders', tid] });
                                    } else {
                                      showToast(result.error || 'فشل إرسال الطلبية', 'error');
                                    }
                                  } finally {
                                    setSendingToVanex(null);
                                  }
                                }}
                                className={`inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors ${
                                  sendingToVanex === o.id
                                    ? 'bg-gray-50 text-gray-400 border-gray-200 cursor-not-allowed'
                                    : 'bg-violet-50 hover:bg-violet-100 text-violet-700 border-violet-200'
                                }`}
                              >
                                {sendingToVanex === o.id ? (
                                  <>
                                    <span className="w-3 h-3 border-2 border-violet-400 border-t-transparent rounded-full animate-spin" />
                                    جاري الإرسال...
                                  </>
                                ) : (
                                  <>
                                    <Truck size={12} />
                                    جاهز للشحن
                                  </>
                                )}
                              </button>
                            );
                          }

                          // ═══ التحكم بأزرار الحالة للطلبيات المرسلة لفانكس ═══
                          const isSentToVanex = !!(o.vanex_package_id || o.vanex_package_code);
                          let displayedActions = actions;
                          if (isSentToVanex) {
                            if (o.status === 'pending') {
                              // إظهار زر الإلغاء فقط لسحبها من الـ API
                              displayedActions = [
                                { status: 'cancelled', label: 'إلغاء', icon: <Ban size={14} />, bg: 'bg-red-50', text: 'text-red-700', hover: 'hover:bg-red-100' }
                              ];
                            } else {
                              // إخفاء الزر إذا تحركت الشحنة
                              displayedActions = [];
                            }
                          }

                          return (
                            <>
                              {isSentToVanex && o.status !== 'delivered' && o.status !== 'cancelled' && o.status !== 'return_confirmed' && (
                                <span className="text-[10px] text-violet-600 bg-violet-50 px-2 py-1.5 rounded-md text-center max-w-[140px] leading-tight font-medium border border-violet-100">
                                  {o.status === 'pending' ? 'أُرسلت لفانكس (بانتظار المندوب)' : 'الحالة تُحدَّث من فانكس تلقائياً'}
                                </span>
                              )}
                              <div className="flex gap-1.5 flex-wrap justify-center">
                                {displayedActions.map((a) => (
                                  <button key={a.status} onClick={() => handleStatusChange(o.id, a.status)}
                                    className={`flex items-center gap-1 px-2.5 py-1.5 ${a.bg} ${a.text} ${a.hover} border border-transparent rounded-lg text-xs font-bold transition-colors`}
                                    title={`تغيير الحالة إلى ${a.label}`}>
                                    {a.icon}
                                    <span className="hidden xl:inline">{a.label}</span>
                                  </button>
                                ))}
                                {displayedActions.length === 0 && o.status !== 'processing' && !isSentToVanex && <span className="text-xs text-gray-400">لا يوجد إجراء</span>}
                              </div>
                            </>
                          );
                        })()}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        
        {filtered.length === 0 && !isOrdersLoading && (
          <div className="text-center py-16">
            <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <ShoppingCart size={28} className="text-gray-400" />
            </div>
            <p className="text-base font-bold text-gray-900 mb-1">لا توجد طلبيات مطابقة</p>
            <p className="text-sm text-gray-500">جرب تعديل الفلاتر أو إضافتها.</p>
          </div>
        )}
        
        {isOrdersLoading && (
          <div className="text-center py-16">
            <div className="w-12 h-12 border-4 border-bunyan-100 border-t-bunyan-600 rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-sm text-gray-500 font-bold">جاري تحميل الطلبيات...</p>
          </div>
        )}
      </div>

      {/* ═══ SlideOver: إنشاء طلبية جديدة ═══ */}
      <SlideOver isOpen={slideOpen} onClose={() => setSlideOpen(false)} title="إنشاء طلبية جديدة (نظام نقطة البيع)" width="w-full sm:max-w-6xl">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full pb-20">
          
          {/* 1. القسم الأيمن: المنتجات المتوفرة (5 أعمدة) */}
          <div className="lg:col-span-4 xl:col-span-5 flex flex-col gap-4 border-l border-gray-100 p-4 bg-gray-50/50 h-[calc(100vh-140px)] overflow-y-auto">
            <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
              <Package size={16} className="text-bunyan-600" />
              قائمة المنتجات المتاحة
            </h3>
            <div className="relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <input type="text" placeholder="بحث بالاسم أو الكود..." 
                value={productSearch} onChange={e => setProductSearch(e.target.value)}
                className="w-full pl-3 pr-9 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-bunyan-500 shadow-sm transition-all" />
            </div>
            
            <div className="grid grid-cols-1 gap-3 mt-2">
              {myProducts
                .filter(p => p.quantity > 0 && p.isActive && (p.name.includes(productSearch) || String(p.itemCode).includes(productSearch)))
                .map(p => (
                  <div key={p.id} className="bg-white p-3 border border-gray-100 rounded-2xl flex items-center justify-between shadow-sm hover:border-bunyan-300 hover:shadow-md transition-all group">
                    <div>
                      <p className="text-sm font-bold text-gray-900 group-hover:text-bunyan-700 transition-colors">{p.name}</p>
                      <p className="text-xs text-gray-500 font-mono mt-0.5">BN{p.itemCode} • متاح {p.quantity}</p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <p className="text-sm font-black font-currency text-bunyan-600">{formatCurrency(p.sellingPrice)}</p>
                      <button onClick={() => setOrderItems([{ productId: p.id, quantity: 1, variantSize: '' }, ...orderItems])}
                        className="p-1.5 bg-bunyan-50 text-bunyan-700 rounded-lg text-xs font-bold hover:bg-bunyan-600 hover:text-white transition-colors border border-bunyan-100" title="إضافة للسلة">
                        <Plus size={14} />
                      </button>
                    </div>
                  </div>
              ))}
              {myProducts.filter(p => p.quantity > 0 && p.isActive && (p.name.includes(productSearch) || String(p.itemCode).includes(productSearch))).length === 0 && (
                <div className="text-center py-10">
                   <Package size={32} className="mx-auto text-gray-300 mb-2"/>
                   <p className="text-sm text-gray-500 font-bold">لا توجد منتجات مطابقة للبحث</p>
                </div>
              )}
            </div>
          </div>

          {/* 2. القسم الأيسر: بيانات الزبون + السلة + التوصيل + الملخص (7 أعمدة) */}
          <div className="lg:col-span-8 xl:col-span-7 flex flex-col gap-6 h-[calc(100vh-140px)] overflow-y-auto pr-2 pb-10 mt-4 lg:mt-0">
            
            {/* أ. السلة */}
            <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
              <div className="flex items-center justify-between mb-4 pb-4 border-b border-gray-100">
                <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                  <ShoppingCart size={18} className="text-bunyan-600" />
                  سلة المشتريات
                </h3>
                <span className="bg-bunyan-100 text-bunyan-800 text-xs font-bold px-2.5 py-1 rounded-full">{orderItems.length} عناصر</span>
              </div>
              <div className="space-y-3">
                {orderItems.map((item, idx) => {
                  const selectedProduct = myProducts.find((p) => p.id === item.productId);
                  return (
                    <div key={idx} className="flex flex-col sm:flex-row gap-2 bg-gray-50 p-2 rounded-xl border border-gray-100 items-start sm:items-center">
                      <div className="flex-1 w-full flex items-center gap-2 truncate">
                         {/* Optional small thumb can go here */}
                         <p className="text-sm font-bold text-gray-800 truncate">{selectedProduct?.name || 'لم يحدد'}</p>
                      </div>
                      {selectedProduct?.productType === 'clothing' && (
                        <div className="w-full sm:w-28">
                          <select value={item.variantSize || ''} onChange={(e) => updateItem(idx, 'variantSize', e.target.value)}
                            className="w-full px-2 py-1 border border-gray-200 rounded-lg text-xs bg-white focus:outline-none focus:border-bunyan-500">
                            <option value="">المقاس...</option>
                            {selectedProduct.variants?.filter(v => v.quantity > 0).map(v => (
                              <option key={v.size} value={v.size}>{v.size} ({v.quantity})</option>
                            ))}
                          </select>
                        </div>
                      )}
                      <div className="flex items-center gap-2 w-full sm:w-auto mt-2 sm:mt-0">
                        <div className="w-20">
                          <input type="number" min={1} 
                            max={selectedProduct?.productType === 'clothing' && item.variantSize 
                              ? (selectedProduct.variants?.find(v => v.size === item.variantSize)?.quantity || 9999) 
                              : (selectedProduct?.quantity || 9999)} 
                            value={item.quantity}
                            onChange={(e) => updateItem(idx, 'quantity', parseInt(e.target.value) || 1)}
                            className="w-full px-2 py-1 border border-gray-200 rounded-lg text-sm text-center focus:outline-none focus:border-bunyan-500" placeholder="الكمية" />
                        </div>
                        <div className="w-24 text-center font-bold font-currency text-sm text-gray-900">
                          {formatCurrency((selectedProduct?.sellingPrice || 0) * item.quantity)}
                        </div>
                        <button onClick={() => removeItem(idx)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors ms-auto sm:ms-0" title="إزالة">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  );
                })}
                {orderItems.length === 0 && (
                  <div className="text-center py-6 border-2 border-dashed border-gray-200 rounded-xl">
                    <Package size={24} className="text-gray-300 mx-auto mb-2" />
                    <p className="text-xs font-semibold text-gray-500">سلة المشتريات فارغة. اختر من المنتجات جانبًا.</p>
                  </div>
                )}
              </div>
            </div>

            {/* ب. بيانات الزبون */}
            <div className="bg-gray-50 border border-gray-200 rounded-2xl p-5 shadow-sm">
              <h3 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2 pb-3 border-b border-gray-200">
                👤 بيانات الزبون
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* 1. الهاتف */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1.5">رقم الهاتف (للبحث أو الإضافة) *</label>
                  <input type="tel" value={newOrder.customerPhone} onChange={(e) => handlePhoneChange(e.target.value)} maxLength={10}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-bunyan-500/30 focus:border-bunyan-500" placeholder="09XXXXXXXX" dir="ltr" />
                </div>
                {/* 2. الاسم */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1.5">اسم الزبون *</label>
                  <input type="text" value={newOrder.customerName} onChange={(e) => setNewOrder({ ...newOrder, customerName: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-bunyan-500/30 focus:border-bunyan-500" placeholder="مثال: أحمد محمد" />
                </div>
                {/* 3. المدينة */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1.5">المدينة</label>
                  <input type="text" value={newOrder.customerCity} onChange={(e) => setNewOrder({ ...newOrder, customerCity: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-bunyan-500/30 focus:border-bunyan-500" placeholder="مثال: طرابلس" />
                </div>
                {/* 4. العنوان */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1.5">العنوان بالتفصيل</label>
                  <input type="text" value={newOrder.customerAddress} onChange={(e) => setNewOrder({ ...newOrder, customerAddress: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-bunyan-500/30 focus:border-bunyan-500" placeholder="الحي الشارع، أقرب نقطة..." />
                </div>
                {/* 5. الهاتف الاحتياطي */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1.5">رقم هاتف احتياطي (اختياري)</label>
                  <input type="tel" value={newOrder.customerPhone2} onChange={(e) => setNewOrder({ ...newOrder, customerPhone2: e.target.value })} maxLength={10}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-bunyan-500/30 focus:border-bunyan-500" placeholder="09XXXXXXXX" dir="ltr" />
                </div>
              </div>

              {/* الأبعاد (شحنة كبيرة) */}
              <div className="mt-4 pt-4 border-t border-gray-100">
                <button 
                  type="button" 
                  onClick={() => setNewOrder(p => ({ ...p, showDimensions: !p.showDimensions }))}
                  className="text-xs font-bold text-bunyan-600 hover:text-bunyan-700 transition-colors flex items-center gap-1"
                >
                  {newOrder.showDimensions ? '- إخفاء الأبعاد' : '+ شحنة كبيرة؟ أضف الأبعاد'}
                </button>
                
                {newOrder.showDimensions && (
                  <div className="mt-3 animate-fade-in">
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[10px] font-bold text-gray-600 mb-1">الطول (cm)</label>
                        <input type="number" value={newOrder.dimLength} onChange={e => setNewOrder({ ...newOrder, dimLength: e.target.value })} className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-bunyan-500" placeholder="مثال: 40" />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-gray-600 mb-1">العرض (cm)</label>
                        <input type="number" value={newOrder.dimWidth} onChange={e => setNewOrder({ ...newOrder, dimWidth: e.target.value })} className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-bunyan-500" placeholder="مثال: 30" />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-gray-600 mb-1">الارتفاع (cm)</label>
                        <input type="number" value={newOrder.dimHeight} onChange={e => setNewOrder({ ...newOrder, dimHeight: e.target.value })} className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-bunyan-500" placeholder="مثال: 20" />
                      </div>
                    </div>
                    {/* تحذير الأبعاد */}
                    {(Number(newOrder.dimLength) > 35 || Number(newOrder.dimWidth) > 35 || Number(newOrder.dimHeight) > 35) && (
                      <p className="text-[10px] text-orange-700 bg-orange-50 border border-orange-200 px-2 py-1.5 rounded-lg mt-3 inline-block font-bold shadow-sm animate-fade-in">
                        ⚠️ شحنة كبيرة — قد تُضاف رسوم إضافية
                      </p>
                    )}
                    {/* النتيجة */}
                    {vanexDeliveryPrice !== null && (
                      <div className="mt-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold px-3 py-2 rounded-xl flex items-center gap-2 animate-fade-in shadow-sm">
                        <span className="shrink-0 bg-emerald-100 p-1 rounded-full text-emerald-600">
                          <CheckCircle2 size={14} />
                        </span>
                        <span>تكلفة الشحن التقديرية: {vanexDeliveryPrice} د.ل</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* ج. التوصيل والملاحظات */}
            <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
              <h3 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2 pb-3 border-b border-gray-100">
                🚚 خيارات التوصيل والملاحظات
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* نوع التوصيل */}
                <div>
                  <label className="text-xs font-bold text-gray-700 mb-1.5 flex items-center gap-1.5">نوع التوصيل</label>
                  <select value={newOrder.deliveryType} onChange={(e) => setNewOrder({ ...newOrder, deliveryType: e.target.value as Order['deliveryType'], courierId: '' })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:border-bunyan-500">
                    <option value="courier_company">شحن عبر شركة توصيل</option>
                    <option value="internal">توصيل داخلي / مندوب خاص</option>
                    <option value="pickup">استلام من المحل</option>
                  </select>
                </div>
                {/* شركة التوصيل (ان وجد) */}
                {newOrder.deliveryType === 'courier_company' && (
                  <div>
                    <label className="text-xs font-bold text-gray-700 mb-1.5 flex items-center gap-1.5">شركة التوصيل المعتمدة</label>
                    <select value={newOrder.courierId} onChange={(e) => setNewOrder({ ...newOrder, courierId: e.target.value, customerCity: '' })}
                      className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:border-bunyan-500">
                      <option value="">اختر الشركة...</option>
                      {myCouriers
                        .filter(c => c.isActive)
                        .map(c => (
                          <option key={c.id} value={c.id}>
                            {c.name} — أساسي: {formatCurrency(c.defaultDeliveryFee || 0)}{c.isApiConnected ? ' 🟢' : ''}
                          </option>
                        ))
                      }
                    </select>
                  </div>
                )}
                
                {/* مدينة التوصيل — Smart City Autocomplete */}
                {newOrder.deliveryType === 'courier_company' && newOrder.courierId && (
                  <div className="sm:col-span-2 relative">
                    <label className="text-xs font-bold text-gray-700 mb-1.5 flex items-center gap-1.5">المدينة المعتمدة للشركة المختارة</label>
                    <input
                      type="text"
                      value={newOrder.customerCity}
                      onChange={(e) => {
                        const val = e.target.value;
                        let vanexCityId: number | undefined = undefined;
                        let vanexSubCityId = newOrder.vanexSubCityId;

                        const courier = myCouriers.find(c => c.id === newOrder.courierId);
                        if (courier?.isApiConnected) {
                          const cities = useDataStore.getState().bunyanCities;
                          const exactMapping = shippingCityMappings.find(m => {
                             const bName = cities.find(c => c.id === m.bunyan_city_id)?.name_ar || m.bunyanCityName;
                             return m.is_active && bName === val;
                          });
                          if (exactMapping) {
                            vanexCityId = exactMapping.provider_city_id;
                            if (newOrder.vanexCityId !== vanexCityId) {
                               // Reset subcity if city changed
                               vanexSubCityId = undefined;
                            }
                            fetchVanexSubCities(exactMapping.provider_city_id, newOrder.courierId);
                          } else {
                             // Not an exact match anymore
                             vanexSubCityId = undefined;
                          }
                        } else {
                          vanexSubCityId = undefined;
                        }

                        setNewOrder({ ...newOrder, customerCity: val, vanexCityId, vanexSubCityId });
                      }}
                      onFocus={() => setCityFocused(true)}
                      onBlur={() => setTimeout(() => setCityFocused(false), 200)}
                      placeholder="ابدأ بكتابة اسم المدينة (عربي أو إنجليزي)..."
                      autoComplete="off"
                      className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:border-bunyan-500 focus:ring-2 focus:ring-bunyan-500/20"
                    />
                    {/* Autocomplete dropdown */}
                    {cityFocused && (() => {
                      const courier = myCouriers.find(c => c.id === newOrder.courierId);
                      const courierCities = courier?.cities || [];
                      const q = newOrder.customerCity.toLowerCase();
                      
                      const isApiConnected = courier?.isApiConnected;
                      const cities = useDataStore.getState().bunyanCities;
                      
                      let mappings = shippingCityMappings.filter(m => m.is_active).map(m => ({
                         ...m,
                         _resolvedBunyanName: cities.find(c => c.id === m.bunyan_city_id)?.name_ar || m.bunyanCityName || '',
                         _resolvedProviderName: m.providerCityName || ''
                      }));

                      if (isApiConnected) {
                        if (q) {
                          mappings = mappings.filter(m => m._resolvedBunyanName.includes(newOrder.customerCity) || m._resolvedProviderName.toLowerCase().includes(q));
                        }
                      } else {
                        mappings = mappings.filter(m =>
                          courierCities.some(cc => cc === m._resolvedBunyanName) &&
                          (!q || m._resolvedBunyanName.includes(newOrder.customerCity) || m._resolvedProviderName.toLowerCase().includes(q))
                        );
                      }
                      
                      // Also include courier cities that don't have mappings ONLY IF not API connected
                      const unmappedCities = isApiConnected ? [] : courierCities.filter(
                        cc => (!q || cc.includes(newOrder.customerCity)) && !mappings.some(m => m._resolvedBunyanName === cc)
                      );
                      
                      const exactMatchApi = isApiConnected && mappings.some(m => m._resolvedBunyanName === newOrder.customerCity);
                      const exactMatchNonApi = !isApiConnected && (courierCities.includes(newOrder.customerCity) || mappings.some(m => m._resolvedBunyanName === newOrder.customerCity));
                      const exactMatch = isApiConnected ? exactMatchApi : exactMatchNonApi;
                      
                      if ((exactMatch && q === newOrder.customerCity) || (mappings.length === 0 && unmappedCities.length === 0)) return null;
                      return (
                        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-50 max-h-48 overflow-y-auto">
                          {mappings.map(m => (
                            <button key={m.id} type="button"
                              onClick={() => {
                                setNewOrder({ ...newOrder, customerCity: m._resolvedBunyanName, vanexCityId: m.provider_city_id, vanexSubCityId: undefined });
                                if (isApiConnected) {
                                  fetchVanexSubCities(m.provider_city_id, newOrder.courierId);
                                }
                              }}
                              className="w-full text-right px-3 py-2 hover:bg-bunyan-50 text-sm flex justify-between items-center transition-colors border-b border-gray-50 last:border-0">
                              <span className="font-bold text-gray-800">{m._resolvedBunyanName}</span>
                              <span className="text-[10px] text-gray-400 font-mono">{m._resolvedProviderName}</span>
                            </button>
                          ))}
                          {unmappedCities.map(city => (
                            <button key={city} type="button"
                              onClick={() => setNewOrder({ ...newOrder, customerCity: city, vanexCityId: undefined, vanexSubCityId: undefined })}
                              className="w-full text-right px-3 py-2 hover:bg-gray-50 text-sm font-bold text-gray-700 transition-colors border-b border-gray-50 last:border-0">
                              {city}
                            </button>
                          ))}
                        </div>
                      );
                    })()}
                    
                    {isVanexCitySuspended && (
                      <p className="text-xs text-red-600 bg-red-50 border border-red-200 px-3 py-2 rounded-xl mt-2 animate-fade-in font-bold flex gap-1.5 items-center shadow-sm">
                        <span>⚠️</span>
                        هذه المدينة موقوفة حالياً من فانكس — تواصل مع فانكس أو اختر مدينة أخرى
                      </p>
                    )}
                  </div>
                )}

                {/* Sub-City dropdown */}
                {(() => {
                   if (!newOrder.deliveryType || newOrder.deliveryType !== 'courier_company' || !newOrder.vanexCityId) return null;
                   
                   const cities = useDataStore.getState().bunyanCities;
                   const cityMapping = shippingCityMappings.find(m => {
                      const bName = cities.find(c => c.id === m.bunyan_city_id)?.name_ar || m.bunyanCityName;
                      return m.is_active && m.provider_city_id === newOrder.vanexCityId && bName === newOrder.customerCity;
                   });
                   const myRegions = cityMapping ? shippingRegionMappings.filter(r => r.city_mapping_id === cityMapping.id && r.is_active) : [];
                   
                   if (myRegions.length === 0) return null;
                   
                   const regionsDb = useDataStore.getState().bunyanRegions;

                   return (
                      <div className="sm:col-span-2 mt-4 animate-fade-in">
                        <label className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2 border-r-4 border-bunyan-500 pr-3 bg-bunyan-50/50 py-1.5 rounded-l-lg">
                          المنطقة أو الحي <span className="text-xs font-normal text-gray-500">(مطلوبة لمدينة {newOrder.customerCity})</span>
                        </label>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 p-3 bg-gray-50 rounded-2xl border border-gray-100">
                          {myRegions.map(region => {
                            const rName = regionsDb.find(r => r.id === region.bunyan_region_id)?.name_ar || region.bunyanRegionName;
                            return (
                                <button
                                  key={region.id}
                                  type="button"
                                  onClick={() => setNewOrder({ ...newOrder, vanexSubCityId: region.provider_region_id })}
                                  className={`relative flex items-center justify-center px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 border shadow-sm overflow-hidden ${
                                    newOrder.vanexSubCityId === region.provider_region_id
                                      ? 'bg-bunyan-600 text-white border-bunyan-600 ring-2 ring-bunyan-600/30 shadow-bunyan-600/20'
                                      : 'bg-white text-gray-700 border-gray-200 hover:border-bunyan-400 hover:bg-bunyan-50 hover:shadow-md'
                                  }`}
                                >
                                  {newOrder.vanexSubCityId === region.provider_region_id && (
                                    <div className="absolute inset-0 bg-white/10 w-full h-full" />
                                  )}
                                  <span className="relative z-10 text-center leading-snug">{rName}</span>
                                </button>
                            );
                          })}
                        </div>
                      </div>
                   );
                })()}

                {/* هل السعر شامل التوصيل؟ */}
                <div className="sm:col-span-2 flex items-center mt-2 bg-gray-50 border border-gray-100 p-3 rounded-lg">
                   <label className="flex items-center gap-2 cursor-pointer text-sm font-bold text-gray-800">
                     <input type="checkbox" className="w-4 h-4 text-bunyan-600 border-gray-300 rounded focus:ring-bunyan-500"
                        checked={newOrder.priceIncludesDelivery} onChange={e => setNewOrder({ ...newOrder, priceIncludesDelivery: e.target.checked })} />
                     هل إجمالي المنتجات والخصم يشمل مصاريف التوصيل؟ (في حالة نعم سيتم تصفير الرسالة من الإجمالي)
                   </label>
                </div>

                <div className="sm:col-span-2 mt-2">
                  <label className="block text-xs font-bold text-gray-700 mb-1.5">ملاحظات الطلبية</label>
                  <textarea value={newOrder.notes} onChange={(e) => setNewOrder({ ...newOrder, notes: e.target.value })} rows={2}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm resize-none focus:outline-none focus:border-bunyan-500"
                    placeholder="ملاحظات للتحضير أو للكابتن..." />
                </div>
              </div>
            </div>

            {/* خيارات فانكس الخاصة */}
            {newOrder.deliveryType === 'courier_company' && (myCouriers.find(c => c.id === newOrder.courierId)?.apiProvider?.includes('vanex') || myCouriers.find(c => c.id === newOrder.courierId)?.provider?.includes('vanex') || myCouriers.find(c => c.id === newOrder.courierId)?.name.includes('فانكس')) && (
              <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
                <h3 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2 pb-3 border-b border-gray-100">
                  📦 خيارات فانكس الخاصة
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
                  <label className="flex items-center gap-2 cursor-pointer text-xs text-gray-700">
                    <input type="checkbox" className="w-4 h-4 text-bunyan-600 border-gray-300 rounded focus:ring-bunyan-500"
                      checked={newOrder.vanexMatch} onChange={e => setNewOrder({ ...newOrder, vanexMatch: e.target.checked })} />
                    مطابقة الشحنة
                  </label>
                  <div className="flex flex-col gap-1.5">
                    <label className="flex items-center gap-2 cursor-pointer text-xs text-gray-700">
                      <input type="checkbox" className="w-4 h-4 text-bunyan-600 border-gray-300 rounded focus:ring-bunyan-500"
                        checked={newOrder.vanexInsure} onChange={e => setNewOrder({ ...newOrder, vanexInsure: e.target.checked })} />
                      تأمين الشحنة
                    </label>
                    {newOrder.vanexInsure && (
                      <div className="text-[10px] text-yellow-800 bg-yellow-100/70 border border-yellow-200 px-2 py-1.5 rounded-lg animate-fade-in flex gap-1.5 items-start">
                        <span className="shrink-0">⚠️</span>
                        <span>سيتم احتساب قسط التأمين وتفاصيله تلقائياً من فانكس بعد إنشاء الشحنة وستجدها في تفاصيل الطلبية</span>
                      </div>
                    )}
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer text-xs text-gray-700">
                    <input type="checkbox" className="w-4 h-4 text-bunyan-600 border-gray-300 rounded focus:ring-bunyan-500"
                      checked={newOrder.vanexInspection} onChange={e => setNewOrder({ ...newOrder, vanexInspection: e.target.checked })} />
                    مسموح بالفحص والمعاينة
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-xs text-gray-700">
                    <input type="checkbox" className="w-4 h-4 text-bunyan-600 border-gray-300 rounded focus:ring-bunyan-500"
                      checked={newOrder.vanexNoHeat} onChange={e => setNewOrder({ ...newOrder, vanexNoHeat: e.target.checked })} />
                    لا تتحمل الحرارة
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-xs text-gray-700">
                    <input type="checkbox" className="w-4 h-4 text-bunyan-600 border-gray-300 rounded focus:ring-bunyan-500"
                      checked={newOrder.vanexFragile} onChange={e => setNewOrder({ ...newOrder, vanexFragile: e.target.checked })} />
                    الشحنة قابلة للكسر
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-xs text-gray-700">
                    <input type="checkbox" className="w-4 h-4 text-bunyan-600 border-gray-300 rounded focus:ring-bunyan-500"
                      checked={newOrder.vanexTryOn} onChange={e => setNewOrder({ ...newOrder, vanexTryOn: e.target.checked })} />
                    مسموح بالقياس والتجربة
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-xs text-gray-700">
                    <input type="checkbox" className="w-4 h-4 text-bunyan-600 border-gray-300 rounded focus:ring-bunyan-500"
                      checked={newOrder.vanexPartialAllowed} onChange={e => setNewOrder({ ...newOrder, vanexPartialAllowed: e.target.checked })} />
                    يسمح بالتسليم الجزئي
                  </label>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-gray-100">
                  <div>
                    <label className="text-xs font-bold text-gray-700 mb-1.5 flex items-center gap-1.5">
                      قيمة الشحن الإضافي على حساب:
                    </label>
                    <select value={newOrder.vxExtraShippingCostOn} onChange={(e) => setNewOrder({ ...newOrder, vxExtraShippingCostOn: e.target.value as 'customer' | 'market' })}
                      className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:border-bunyan-500">
                      <option value="market">المتجر</option>
                      <option value="customer">الزبون</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-700 mb-1.5 flex items-center gap-1.5">
                      عمولة التحصيل على حساب:
                    </label>
                    <select value={newOrder.vxCollectionCommissionOn} onChange={(e) => setNewOrder({ ...newOrder, vxCollectionCommissionOn: e.target.value as 'customer' | 'market' })}
                      className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:border-bunyan-500">
                      <option value="market">المتجر</option>
                      <option value="customer">الزبون</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* ج٢. خيارات الدفع المتقدمة — تظهر فقط عند courier_company */}
            {newOrder.deliveryType === 'courier_company' && (
              <div className="rounded-xl border border-bunyan-100 bg-bunyan-50/30 p-4 space-y-4">
                <h4 className="text-sm font-semibold text-bunyan-700 flex items-center gap-2">
                  💳 خيارات الدفع والتحصيل
                </h4>

                {/* سيناريو 1: من يدفع رسوم التوصيل */}
                <div>
                  <label className="text-xs text-gray-600 font-medium mb-1 block">
                    رسوم التوصيل على حساب:
                  </label>
                  <div className="flex gap-2">
                    {[
                      { value: 'customer', label: 'الزبون' },
                      { value: 'market',   label: 'المتجر (توصيل مجاني)' },
                    ].map(opt => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setNewOrder(p => ({ ...p, commissionBy: opt.value as 'customer' | 'market' }))}
                        className={`flex-1 py-2 px-3 rounded-lg text-xs font-medium border transition-colors ${
                          newOrder.commissionBy === opt.value
                            ? 'bg-bunyan-600 text-white border-bunyan-600'
                            : 'bg-white text-gray-600 border-gray-200 hover:border-bunyan-300'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* سيناريو 2: طريقة الدفع */}
                <div>
                  <label className="text-xs text-gray-600 font-medium mb-1 block">
                    طريقة التحصيل من الزبون:
                  </label>
                  <div className="flex gap-2">
                    {[
                      { value: 'cash',   label: '💵 كاش عند الاستلام' },
                      { value: 'online', label: '💳 إلكتروني عبر المندوب' },
                    ].map(opt => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setNewOrder(p => ({ ...p, paymentMethod: opt.value as 'cash' | 'online' }))}
                        className={`flex-1 py-2 px-3 rounded-lg text-xs font-medium border transition-colors ${
                          newOrder.paymentMethod === opt.value
                            ? 'bg-bunyan-600 text-white border-bunyan-600'
                            : 'bg-white text-gray-600 border-gray-200 hover:border-bunyan-300'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                  {newOrder.paymentMethod === 'online' && (
                    <p className="text-[11px] text-amber-600 mt-1 bg-amber-50 px-2 py-1 rounded">
                      ⚠️ تُطبق عمولة 2% على المبلغ المحصّل إلكترونياً وتُخصم في التسويات
                    </p>
                  )}
                </div>

                {/* سيناريو 3: دفع مسبق من الزبون */}
                <div>
                  <label className="text-xs text-gray-600 font-medium mb-2 block">
                    هل دفع الزبون مبلغاً مسبقاً؟
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      id="prepaidCheck"
                      checked={newOrder.isPrepaid}
                      onChange={e => setNewOrder(p => ({ ...p, isPrepaid: e.target.checked, prepaidAmount: e.target.checked ? p.prepaidAmount : 0 }))}
                      className="rounded border-gray-300"
                    />
                    <label htmlFor="prepaidCheck" className="text-xs text-gray-600">
                      نعم — دفع مسبقاً (الحوالة)
                    </label>
                  </div>
                  {newOrder.isPrepaid && (
                    <div className="mt-2">
                      <input
                        type="number"
                        placeholder="المبلغ المدفوع مسبقاً بالدينار"
                        value={newOrder.prepaidAmount || ''}
                        onChange={e => setNewOrder(p => ({ ...p, prepaidAmount: Number(e.target.value) }))}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-bunyan-500"
                      />
                      <p className="text-[11px] text-emerald-600 mt-1 bg-emerald-50 px-2 py-1 rounded">
                        ✅ سيُرسل للمندوب بقيمة {formatCurrency(Math.max(0, orderCalculations.total - (newOrder.prepaidAmount || 0)))} فقط للتحصيل
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* د. الملخص المالي */}
            <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl p-6 border border-gray-700 shadow-xl overflow-hidden relative">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none" />
              <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2 pb-3 border-b border-gray-700/50 relative z-10">
                🧾 الملخص المالي النهائي
              </h3>
              <div className="space-y-3 relative z-10">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-300 font-medium">مجموع المنتجات فرعي</span>
                  <span className="font-bold font-mono text-white">{formatCurrency(orderCalculations.subtotal)}</span>
                </div>
                <div className="flex justify-between text-sm items-center">
                  <span className="text-gray-300 font-medium flex items-center gap-1.5">
                    الخصم (بالدينار)
                  </span>
                  <div className="w-24 relative">
                    <input type="number" min={0} value={newOrder.discount || ''} onChange={(e) => setNewOrder({ ...newOrder, discount: Number(e.target.value) })}
                      className="w-full px-2 py-1.5 border border-gray-600 rounded-lg text-sm text-center focus:outline-none focus:border-bunyan-400 focus:ring-2 focus:ring-bunyan-400/20 font-mono text-white font-bold bg-gray-800/50 placeholder-gray-500 transition-colors" placeholder="0 د.ل" />
                  </div>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-300 font-medium pb-1 w-full flex justify-between border-b border-dashed border-gray-600">
                    <span>رسوم التوصيل {newOrder.priceIncludesDelivery && <span className="text-emerald-400 text-[10px] mr-2">(مشمولة مسبقاً)</span>}</span>
                    <span className="font-mono text-white">{newOrder.priceIncludesDelivery ? '0 د.ل' : formatCurrency(orderCalculations.deliveryFee)}</span>
                  </span>
                </div>
              </div>
              <div className="flex justify-between text-2xl font-black pt-5 mt-5 relative z-10">
                <span className="text-white">الإجمالي للزبون</span>
                <span className="text-emerald-400 font-mono tracking-tight">{formatCurrency(orderCalculations.total)}</span>
              </div>
            </div>
          </div>
          
          <div className="absolute bottom-0 left-0 w-full p-4 bg-white border-t border-gray-200 z-10 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
            <div className="max-w-6xl mx-auto flex justify-end">
              <button onClick={handleCreateOrder}
                disabled={isVanexCitySuspended}
                className={`w-full sm:w-[300px] py-3 text-white font-bold rounded-xl transition-all text-sm shadow-md ${
                  isVanexCitySuspended ? 'bg-gray-400 cursor-not-allowed opacity-70' : 'bg-bunyan-600 hover:bg-bunyan-700'
                }`}>
                اعتماد وإنشاء الفاتورة
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
            ? (filtered.find(o => o.id === confirmAction?.orderId)?.vanex_package_code
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
