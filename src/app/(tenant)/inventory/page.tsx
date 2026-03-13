// src/app/(tenant)/inventory/page.tsx
// الوظيفة: صفحة المخزون — إدارة المنتجات، التنبيه بالنواقص
// الجداول: products
// الصلاحية: OWNER (كامل), EMPLOYEE (بدون أسعار الشراء ولا الحذف)

'use client';

import React, { useState, useMemo } from 'react';
import { useAuthStore } from '@/core/auth/store';
import { useDataStore } from '@/core/db/store';
import { formatCurrency, formatNumber } from '@/shared/utils/format';
import { STOCK_STATUS, getStockStatus, getStatusBadgeClasses } from '@/shared/utils/statusColors';
import { SlideOver } from '@/shared/components/ui/SlideOver';
import { ConfirmDialog } from '@/shared/components/ui/ConfirmDialog';
import { useToast } from '@/shared/components/ui/Toast';
import { Package, Plus, Search, Pencil, Trash2, AlertTriangle, AlertCircle, X, CheckCircle2, BarChart2, TrendingUp, DollarSign, Eye, SlidersHorizontal, Calendar, ChevronDown, ChevronUp } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { AddProductSlideOver } from '@/shared/components/ui';
import { cn } from '@/shared/utils/cn';

type Filter = 'all' | 'available' | 'low' | 'out';
const SIZES_CLOTHING = ['S', 'M', 'L', 'XL', 'XXL'];
const SIZES_SHOES = ['38', '39', '40', '41', '42', '43', '44', '45'];

const getCategoryLabel = (cat: string) => {
  const map: Record<string, string> = {
    'simple': 'منتج عادي',
    'clothing': 'ملابس',
    'shoes': 'أحذية',
    'custom': 'مخصص',
    'عادي': 'منتج عادي',
    'ملابس': 'ملابس',
    'أحذية': 'أحذية',
  };
  return map[cat] || cat;
};

const SmartVariantBadges = ({ variants }: { variants: any[] | undefined }) => {
  const [activeTooltip, setActiveTooltip] = useState<string | null>(null);
  if (!variants || variants.length === 0) return null;
  
  // للمنتجات العادية (size, color كـ keys مباشرة)
  const directKey = Object.keys(variants[0]).find(k => 
    !['id','quantity','sku','attributes','customAttributes'].includes(k)
  );

  // للمنتجات المخصصة (attributes كـ object)
  const hasAttributes = variants[0].attributes && 
    Object.keys(variants[0].attributes).length > 0;

  if (!directKey && !hasAttributes) return null;

  // جمّع الكميات
  const grouped: Record<string, number> = {};

  if (directKey) {
    variants.forEach(v => {
      const val = String(v[directKey] || '');
      if (val) grouped[val] = (grouped[val] || 0) + v.quantity;
    });
  } else {
    const attrKey = Object.keys(variants[0].attributes)[0];
    variants.forEach(v => {
      const val = String(v.attributes?.[attrKey] || '');
      if (val) grouped[val] = (grouped[val] || 0) + v.quantity;
    });
  }
  
  return (
    <div className="flex flex-wrap gap-1 mt-1">
      {(Object.entries(grouped) as [string, number][]).map(([val, qty]) => (
        <React.Fragment key={val}>
          <span 
            title={`الكمية: ${qty}`} 
            onClick={() => setActiveTooltip(activeTooltip === val ? null : val)}
            className={`
              px-1.5 py-0.5 rounded text-xs font-bold border cursor-pointer
              ${qty === 0 
                ? 'bg-gray-100 text-gray-400 border-gray-200 line-through'
                : qty <= 3 
                ? 'bg-red-50 text-red-700 border-red-200'
                : 'bg-bunyan-50 text-bunyan-700 border-bunyan-200'
              }
            `}
          >
            {val}
          </span>
          {activeTooltip === val && (
            <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-lg animate-fade-in">
              الكمية: {qty}
            </span>
          )}
        </React.Fragment>
      ))}
    </div>
  );
};

// ══════════════════════════════════════════
// مكوّن عرض المتغيرات الذكي (Popover)
// ══════════════════════════════════════════
type AttrConfig = { name: string; values: string[] };
type VariantItem = { id: string; quantity: number; attributes?: Record<string, string>; size?: string; sku?: string };

const SmartVariantPopover = ({
  product,
  onClose,
}: {
  product: { name: string; variants?: VariantItem[]; attributeConfig?: AttrConfig[] };
  onClose: () => void;
}) => {
  const [activeTab, setActiveTab] = useState<string | null>(null);
  const variants = product.variants || [];
  const cfg = product.attributeConfig || [];

  // ━━ حساب الـ max لنسبة الشريط ━━
  const maxQty = Math.max(...variants.map((v) => v.quantity), 1);

  // ━━ إذا لا يوجد متغيرات ━━
  if (variants.length === 0) return null;

  // ━━ منطق اختيار محاور التجميع ━━
  let groupAttr: AttrConfig | null = null;
  let rowAttrsForPopover: AttrConfig[] = [];

  if (cfg.length === 0) {
    // Fallback: لا يوجد attributeConfig — عرض مسطّح
  } else if (cfg.length === 1) {
    // خاصية واحدة فقط — بدون تجميع
    rowAttrsForPopover = cfg;
  } else {
    // اختر الخاصية بأقل عدد قيم كمجموعات
    const sorted = [...cfg].sort((a, b) => a.values.length - b.values.length);
    groupAttr = sorted[0];
    rowAttrsForPopover = sorted.slice(1);
  }

  // ━━ حساب تركيبات الصفوف ━━
  const rowCombosForPopover: string[][] =
    rowAttrsForPopover.length === 0
      ? [['__all__']]
      : rowAttrsForPopover.reduce<string[][]>(
          (acc, attr) =>
            acc.length === 0
              ? attr.values.map((v) => [v])
              : acc.flatMap((combo) => attr.values.map((v) => [...combo, v])),
          []
        );

  // ━━ دالة مطابقة الـ variant ━━
  const matchVariant = (groupVal: string | null, rowCombo: string[]) =>
    variants.find((v) => {
      const attrs = v.attributes || {};
      if (groupAttr && attrs[groupAttr.name] !== groupVal) return false;
      if (rowCombo[0] === '__all__') return groupAttr ? attrs[groupAttr.name] === groupVal : true;
      return rowAttrsForPopover.every((ra, i) => attrs[ra.name] === rowCombo[i]);
    });

  // ━━ الخيارات للتجميع ━━
  const groupValues = groupAttr ? groupAttr.values : ['__single__'];
  const useTabMode = groupValues.length > 4;
  const activeGroup = activeTab ?? groupValues[0];

  // ━━ عرض صف واحد ━━
  const renderRow = (label: string, qty: number) => {
    const pct = Math.round((qty / maxQty) * 100);
    const isOut = qty === 0;
    const isLow = qty > 0 && qty <= 3;
    const barColor = isOut ? 'bg-red-400' : isLow ? 'bg-amber-400' : 'bg-bunyan-600';
    const textColor = isOut ? 'text-red-600' : isLow ? 'text-amber-700' : 'text-gray-900';
    return (
      <div key={label} className="flex items-center gap-2 py-1">
        <span className="text-xs font-bold text-gray-700 w-16 shrink-0 text-right truncate" title={label}>
          {label}
        </span>
        <div className="flex-1 h-2.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-300 ${barColor}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className={`text-xs font-bold w-8 text-left shrink-0 ${textColor}`}>
          {isOut ? 'نفذ' : qty}
        </span>
      </div>
    );
  };

  // ━━ عرض مجموعة واحدة ━━
  const renderGroup = (groupVal: string) => {
    const isAll = groupVal === '__single__';
    return (
      <div key={groupVal} className="space-y-0.5">
        {rowCombosForPopover.map((rowCombo) => {
          const v = isAll
            ? variants.find((vv) => {
                if (rowCombo[0] === '__all__') return true;
                const attrs = vv.attributes || {};
                return rowAttrsForPopover.every((ra, i) => attrs[ra.name] === rowCombo[i]);
              })
            : matchVariant(groupVal, rowCombo);
          if (!v) return null;
          const label = rowCombo[0] === '__all__'
            ? (isAll ? '' : groupVal)
            : rowCombo.join(' / ');
          return renderRow(label || groupVal, v.quantity);
        })}
      </div>
    );
  };

  return (
    <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 w-72 overflow-hidden animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50">
        <span className="text-xs font-bold text-gray-900 truncate">{product.name}</span>
        <button
          onClick={onClose}
          className="w-6 h-6 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 transition-colors shrink-0"
        >
          <X size={12} />
        </button>
      </div>

      {/* Tabs — إذا كانت المجموعات أكثر من 4 */}
      {useTabMode && groupAttr && (
        <div className="flex gap-1 p-2 border-b border-gray-100 bg-white overflow-x-auto">
          {groupValues.map((g) => (
            <button
              key={g}
              onClick={() => setActiveTab(g)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold whitespace-nowrap transition-colors ${
                activeGroup === g
                  ? 'bg-bunyan-600 text-white shadow-sm'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {g}
            </button>
          ))}
        </div>
      )}

      {/* Body */}
      <div className="px-4 py-3 max-h-72 overflow-y-auto">
        {useTabMode ? (
          <div>
            {groupAttr && (
              <p className="text-[10px] font-bold text-gray-400 mb-2">
                {rowAttrsForPopover.map(r => r.name).join(' / ')}
              </p>
            )}
            {renderGroup(activeGroup)}
          </div>
        ) : groupAttr ? (
          <div className="flex gap-4">
            {groupValues.map((g) => (
              <div key={g} className="flex-1 min-w-0">
                <p className="text-[11px] font-bold text-bunyan-700 mb-1.5 text-center border-b border-bunyan-100 pb-1">
                  {g}
                </p>
                {renderGroup(g)}
              </div>
            ))}
          </div>
        ) : (
          renderGroup('__single__')
        )}
      </div>

      {/* Footer: الإجمالي */}
      <div className="px-4 py-2 border-t border-gray-100 bg-gray-50 flex items-center justify-between">
        <span className="text-[10px] text-gray-500 font-bold">إجمالي المخزون</span>
        <span className="text-xs font-bold text-gray-900">
          {variants.reduce((s, v) => s + v.quantity, 0)} قطعة
        </span>
      </div>
    </div>
  );
};

export default function InventoryPage() {
  const { user } = useAuthStore();
  const { showToast } = useToast();
  const { products, treasury, orders, getForTenant, addProduct, updateProduct, deleteProduct } = useDataStore();
  const tid = user?.tenantId || '';
  const isOwner = user?.role === 'owner';
  const canViewCost = isOwner || user?.permissions?.inventory?.viewCostPrice;
  const canAddEdit = isOwner || user?.permissions?.inventory?.add || user?.permissions?.inventory?.edit;
  const canDelete = isOwner || user?.permissions?.inventory?.delete;

  const myProducts = getForTenant(products, tid).filter(p => p.isActive);
  const customCategories = Array.from(new Set(myProducts.map(p => p.category)))
    .filter(c => !['منتج عادي','ملابس','أحذية','عادي','simple','clothing','shoes'].includes(c) && c);

  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  
  const [slideOpen, setSlideOpen] = useState(false);
  const [editProduct, setEditProduct] = useState<typeof myProducts[0] | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<typeof myProducts[0] | null>(null);
  const [insightTarget, setInsightTarget] = useState<typeof myProducts[0] | null>(null);
  const [viewProduct, setViewProduct] = useState<typeof myProducts[0] | null>(null);
  const [variantPopoverProductId, setVariantPopoverProductId] = useState<string | null>(null);

  // Advanced Filter States
  const [showAdvancedFilter, setShowAdvancedFilter] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [sortBy, setSortBy] = useState('newest');
  const [priceFrom, setPriceFrom] = useState('');
  const [priceTo, setPriceTo] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const [addQtyTarget, setAddQtyTarget] = useState<typeof myProducts[0] | null>(null);
  const [addQtyAmount, setAddQtyAmount] = useState('');
  const [variantQtyAmounts, setVariantQtyAmounts] = useState<Record<string, string>>({});
  // WAC: سعر شراء الدفعة الجديدة
  const [newPurchasePrice, setNewPurchasePrice] = useState('');
  const [showPriceField, setShowPriceField] = useState(false);

  // الفلترة والترتيب (useMemo)
  const filtered = useMemo(() => {
    let result = myProducts.filter((p) => {
      // 1. بحث نصي
      if (search && !p.name.includes(search) && !String(p.itemCode).includes(search)) return false;
      
      // 2. نوع المنتج / الفئة
      if (categoryFilter !== 'all') {
        if (categoryFilter === 'simple') {
          if (p.productType !== 'simple') return false;
        } else if (categoryFilter === 'clothing') {
          if (p.productType !== 'clothing') return false;
        } else if (categoryFilter === 'shoes') {
          if (p.productType !== 'shoes') return false;
        } else {
          if (p.category !== categoryFilter) return false;
        }
      }

      // 3. نطاق السعر
      const pMin = Number(priceFrom);
      const pMax = Number(priceTo);
      if (pMin > 0 && p.sellingPrice < pMin) return false;
      if (pMax > 0 && p.sellingPrice > pMax) return false;

      // 4. نطاق التاريخ (createdAt)
      if (dateFrom && p.createdAt && p.createdAt < dateFrom) return false;
      if (dateTo && p.createdAt && p.createdAt > dateTo + 'T23:59:59') return false;

      // 5. شريحة الحالة (متاح / ينفد / نفد)
      const isOut = p.quantity <= 0;
      const isLow = p.quantity > 0 && p.quantity <= p.minQuantity;
      const isAvailable = p.quantity > p.minQuantity;
      
      if (filter === 'available' && !isAvailable) return false;
      if (filter === 'low' && !isLow) return false;
      if (filter === 'out' && !isOut) return false;
      
      return true;
    });

    // 6. الترتيب
    result.sort((a, b) => {
      switch (sortBy) {
        case 'newest': return (b.createdAt || '').localeCompare(a.createdAt || '');
        case 'oldest': return (a.createdAt || '').localeCompare(b.createdAt || '');
        case 'price-high': return b.sellingPrice - a.sellingPrice;
        case 'price-low': return a.sellingPrice - b.sellingPrice;
        case 'qty-high': return b.quantity - a.quantity;
        case 'qty-low': return a.quantity - b.quantity;
        default: return 0;
      }
    });

    return result;
  }, [myProducts, search, categoryFilter, priceFrom, priceTo, dateFrom, dateTo, filter, sortBy]);

  const availableCount = myProducts.filter(p => p.quantity > p.minQuantity).length;
  const lowStockCount = myProducts.filter(p => p.quantity > 0 && p.quantity <= p.minQuantity).length;
  const outOfStockCount = myProducts.filter(p => p.quantity <= 0).length;

  // الحسابات المالية
  const cashAccount = treasury.find(a => a.tenantId === tid && a.accountType === 'cash_in_hand');
  const availableBalance = cashAccount?.balance || 0;

  // WAC: السعر الفعّال للدفعة الجديدة
  const effectiveSimplePrice = Number(newPurchasePrice) > 0
    ? Number(newPurchasePrice)
    : (addQtyTarget?.costPrice || 0);

  const effectiveVariantPrice = Number(newPurchasePrice) > 0
    ? Number(newPurchasePrice)
    : (addQtyTarget?.costPrice || 0);

  const totalVariantsCost = addQtyTarget && addQtyTarget.productType !== 'simple'
    ? (addQtyTarget.variants || []).reduce((sum, v) => sum + ((Number(variantQtyAmounts[v.id]) || 0) * effectiveVariantPrice), 0)
    : 0;
    
  const totalVariantsAdded = addQtyTarget && addQtyTarget.productType !== 'simple'
    ? (addQtyTarget.variants || []).reduce((sum, v) => sum + (Number(variantQtyAmounts[v.id]) || 0), 0)
    : 0;

  const totalSimpleCost = addQtyTarget && addQtyTarget.productType === 'simple'
    ? (Number(addQtyAmount) || 0) * effectiveSimplePrice
    : 0;

  const isCostExceeding = addQtyTarget?.productType === 'simple' ? totalSimpleCost > availableBalance : totalVariantsCost > availableBalance;

  // ════ التحليلات (Insights) ════
  const myOrders = getForTenant(orders, tid);
  let insightSalesQty = 0;
  let insightRevenue = 0;

  if (insightTarget) {
    myOrders.forEach(order => {
      // حساب المبيعات من الطلبات غير الملغاة أو المرجعة
      if (order.status !== 'cancelled' && order.status !== 'return_confirmed') {
        order.items.forEach(item => {
          if (item.productId === insightTarget.id) {
            insightSalesQty += item.quantity;
            insightRevenue += item.total; // item.total = quantity * unitPrice
          }
        });
      }
    });
  }

  const insightProfit = insightTarget ? insightRevenue - (insightSalesQty * (insightTarget.costPrice || 0)) : 0;

  // حساب مبيعات آخر 7 أيام للرسم البياني
  const insightChartData = (() => {
    const days: { date: string; label: string; qty: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      // تسمية مختصرة لليوم
      const labels = ['أحد', 'اثن', 'ثلاث', 'أربع', 'خميس', 'جمعة', 'سبت'];
      days.push({ date: dateStr, label: labels[d.getDay()], qty: 0 });
    }
    if (insightTarget) {
      myOrders.forEach(order => {
        if (order.status !== 'cancelled' && order.status !== 'return_confirmed') {
          const orderDate = (order.createdAt || '').split('T')[0];
          const day = days.find(d => d.date === orderDate);
          if (day) {
            order.items.forEach(item => {
              if (item.productId === insightTarget.id) day.qty += item.quantity;
            });
          }
        }
      });
    }
    return days;
  })();

  const openAdd = () => {
    setEditProduct(null);
    setSlideOpen(true);
  };

  const openEdit = (p: typeof myProducts[0]) => {
    setEditProduct(p);
    setSlideOpen(true);
  };

  const handleAddQty = () => {
    if (!addQtyTarget) return;

    if (addQtyTarget.productType === 'simple') {
      const amount = Number(addQtyAmount);
      if (amount <= 0) {
        showToast('يرجى إدخال كمية صحيحة أكبر من الصفر', 'error');
        return;
      }
      const oldQty = addQtyTarget.quantity;
      const oldCost = addQtyTarget.costPrice || 0;
      const purchasePrice = effectiveSimplePrice;
      // WAC: متوسط التكلفة المرجح
      const newCostPrice = oldQty + amount > 0
        ? ((oldQty * oldCost) + (amount * purchasePrice)) / (oldQty + amount)
        : purchasePrice;

      updateProduct(addQtyTarget.id, {
        quantity: oldQty + amount,
        costPrice: Math.round(newCostPrice),
        stockHistory: [
          ...(addQtyTarget.stockHistory || []),
          {
            id: `stock-${Date.now()}`,
            quantity: amount,
            date: new Date().toISOString()
          }
        ]
      });
      
      if (oldQty + amount <= addQtyTarget.minQuantity) {
        showToast(`تنبيه: الكمية تحت الحد الأدنى (${addQtyTarget.minQuantity} قطعة)`, 'warning');
      } else {
        const totalAddedCost = amount * purchasePrice;
        showToast(`تمت إضافة ${amount} قطعة لـ "${addQtyTarget.name}" ✅ — خُصم ${totalAddedCost} د.ل — WAC الجديد: ${Math.round(newCostPrice)} د.ل`, 'success');
      }
    } else {
      let totalAdded = 0;
      let newVariants = addQtyTarget.variants ? [...addQtyTarget.variants] : [];
      
      newVariants = newVariants.map((v) => {
        const added = Number(variantQtyAmounts[v.id]) || 0;
        const safeQty = Math.max(0, added);
        if (safeQty > 0) {
          totalAdded += safeQty;
          return { ...v, quantity: v.quantity + safeQty };
        }
        return v;
      });

      if (totalAdded === 0) {
        showToast('لم يتم إدخال أي كمية إضافية', 'error');
        return;
      }

      const oldQty = addQtyTarget.quantity;
      const oldCost = addQtyTarget.costPrice || 0;
      const purchasePrice = effectiveVariantPrice;
      // WAC: متوسط التكلفة المرجح للمتغيرات
      const newCostPrice = oldQty + totalAdded > 0
        ? ((oldQty * oldCost) + (totalAdded * purchasePrice)) / (oldQty + totalAdded)
        : purchasePrice;

      updateProduct(addQtyTarget.id, { 
        quantity: oldQty + totalAdded,
        costPrice: Math.round(newCostPrice),
        variants: newVariants,
        stockHistory: [
          ...(addQtyTarget.stockHistory || []),
          {
            id: `stock-${Date.now()}`,
            quantity: totalAdded,
            date: new Date().toISOString()
          }
        ]
      });
      const totalAddedCostVariant = totalAdded * purchasePrice;
      showToast(`تمت إضافة ${totalAdded} قطعة لـ "${addQtyTarget.name}" ✅ — خُصم ${totalAddedCostVariant} د.ل — WAC الجديد: ${Math.round(newCostPrice)} د.ل`, 'success');
    }

    setAddQtyTarget(null);
    setAddQtyAmount('');
    setVariantQtyAmounts({});
    setNewPurchasePrice('');
    setShowPriceField(false);
  };

  const handleDelete = () => {
    if (deleteTarget) {
      const res = deleteProduct(deleteTarget.id);
      setDeleteTarget(null);
      if (res.success) showToast('تم حذف المنتج بنجاح', 'success');
      else showToast(res.error || 'لا يمكن حذف المنتج', 'error');
    }
  };

  const filters: { key: Filter; label: string; count?: number; colorClass?: string; dotColor?: string }[] = [
    { key: 'all', label: 'الكل', count: myProducts.length },
    { key: 'available', label: 'متاح', count: availableCount, colorClass: 'text-emerald-700 bg-emerald-50 border-emerald-200', dotColor: 'bg-emerald-500' },
    { key: 'low', label: 'ينفد', count: lowStockCount, colorClass: 'text-amber-700 bg-amber-50 border-amber-200', dotColor: 'bg-amber-400' },
    { key: 'out', label: 'نفد', count: outOfStockCount, colorClass: 'text-red-700 bg-red-50 border-red-200', dotColor: 'bg-red-500' },
  ];

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Package size={24} className="text-bunyan-600" />
            المخزون والعهدة
          </h1>
          <p className="text-sm text-gray-500 mt-1">إدارة المنتجات، الكميات، والتسعير</p>
        </div>
        
        <div className="flex gap-2">
          {canAddEdit && (
             <button onClick={() => { setEditProduct(null); setSlideOpen(true); }} className="flex w-full sm:w-auto items-center justify-center gap-2 px-5 py-2.5 bg-bunyan-600 text-white rounded-xl text-sm font-bold shadow-sm hover:bg-bunyan-700 hover:-translate-y-0.5 transition-all">
               <Plus size={18} /> منتج جديد
             </button>
          )}
        </div>
      </div>

      {/* تحذيرات سريعة (Low / Out of Stock) */}
      {(lowStockCount > 0 || outOfStockCount > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {outOfStockCount > 0 && (
            <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-xl">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                <AlertCircle size={20} className="text-red-600" />
              </div>
              <div>
                <p className="text-sm font-bold text-red-900">أصناف نفدت من المخزون</p>
                <p className="text-xs text-red-700 mt-0.5">يوجد {outOfStockCount} صنف رصيده صفر، يرجى إعادة الطلب.</p>
              </div>
            </div>
          )}
          {lowStockCount > 0 && (
            <div className="flex items-center gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
              <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                <AlertTriangle size={20} className="text-amber-600" />
              </div>
              <div>
                <p className="text-sm font-bold text-amber-900">أصناف قاربت على النفاد</p>
                <p className="text-xs text-amber-700 mt-0.5">يوجد {lowStockCount} صنف وصل للحد الأدنى.</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* شريط البحث والفلترة */}
      <div className="flex flex-col gap-4 bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input 
              type="text" 
              value={search} 
              onChange={(e) => setSearch(e.target.value)} 
              placeholder="ابحث بالاسم أو كود المنتج"
              className="w-full pr-10 pl-4 py-2 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-bunyan-500/30 focus:border-bunyan-500 transition-all" 
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowAdvancedFilter(!showAdvancedFilter)}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold border transition-all",
                showAdvancedFilter || categoryFilter !== 'all' || sortBy !== 'newest' || priceFrom || priceTo || dateFrom || dateTo
                  ? "bg-bunyan-50 border-bunyan-200 text-bunyan-600 shadow-sm"
                  : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"
              )}
            >
              <SlidersHorizontal size={18} />
              فلتر متقدم
            </button>
          </div>
        </div>

        {/* شرائح الحالة */}
        <div className="flex flex-wrap gap-2 pt-1">
          {filters.map((f) => (
            <button 
              key={f.key} 
              onClick={() => setFilter(f.key)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all border ${
                filter === f.key 
                  ? 'bg-bunyan-600 text-white border-bunyan-600 shadow-sm' 
                  : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
              }`}
            >
              {f.dotColor && <span className={`w-2 h-2 rounded-full ${f.dotColor} inline-block ml-1`}/>}
              {f.label}
              {f.count !== undefined && (
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                  filter === f.key ? 'bg-white/20 text-white' : f.colorClass
                }`}>
                  ({f.count})
                </span>
              )}
            </button>
          ))}
        </div>

        {/* الفلتر المتقدم */}
        {showAdvancedFilter && (
          <div className="mt-2 pt-4 border-t border-gray-100 animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* التاريخ */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider pr-1">تاريخ الإضافة</label>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Calendar size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input 
                      type="date" 
                      value={dateFrom} 
                      onChange={(e) => setDateFrom(e.target.value)}
                      className="w-full pr-8 pl-2 py-1.5 border border-gray-200 rounded-lg text-xs outline-none focus:border-bunyan-500" 
                    />
                  </div>
                  <span className="text-gray-300">←</span>
                  <div className="relative flex-1">
                    <Calendar size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input 
                      type="date" 
                      value={dateTo} 
                      onChange={(e) => setDateTo(e.target.value)}
                      className="w-full pr-8 pl-2 py-1.5 border border-gray-200 rounded-lg text-xs outline-none focus:border-bunyan-500" 
                    />
                  </div>
                </div>
              </div>

              {/* النوع */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider pr-1">نوع المنتج / الفئة</label>
                <select 
                  value={categoryFilter} 
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-xs outline-none focus:border-bunyan-500 bg-white"
                >
                  <option value="all">كل الأنواع</option>
                  <option value="simple">منتج عادي</option>
                  <option value="clothing">ملابس</option>
                  <option value="shoes">أحذية</option>
                  {customCategories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              {/* الترتيب */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider pr-1">ترتيب حسب</label>
                <select 
                  value={sortBy} 
                  onChange={(e) => setSortBy(e.target.value)}
                  className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-xs outline-none focus:border-bunyan-500 bg-white"
                >
                  <option value="newest">الأحدث إضافة</option>
                  <option value="oldest">الأقدم</option>
                  <option value="price-high">الأعلى سعر</option>
                  <option value="price-low">الأقل سعر</option>
                  <option value="qty-high">الأعلى كمية</option>
                  <option value="qty-low">الأقل كمية</option>
                </select>
              </div>

              {/* نطاق السعر */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider pr-1">نطاق السعر (بيع)</label>
                <div className="flex items-center gap-2">
                  <input 
                    type="number" 
                    placeholder="من" 
                    value={priceFrom} 
                    onChange={(e) => setPriceFrom(e.target.value)}
                    className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-xs outline-none focus:border-bunyan-500" 
                  />
                  <input 
                    type="number" 
                    placeholder="إلى" 
                    value={priceTo} 
                    onChange={(e) => setPriceTo(e.target.value)}
                    className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-xs outline-none focus:border-bunyan-500" 
                  />
                </div>
              </div>

              {/* إجراءات الفلتر */}
              <div className="lg:col-span-2 flex items-end justify-end gap-2">
                <button 
                  onClick={() => {
                    setCategoryFilter('all');
                    setSortBy('newest');
                    setPriceFrom('');
                    setPriceTo('');
                    setDateFrom('');
                    setDateTo('');
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-red-500 hover:bg-red-50 rounded-lg transition-colors border border-transparent hover:border-red-100"
                >
                  <X size={14} />
                  مسح الفلاتر المتقدمة
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* جدول المنتجات */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-right">
            <thead className="bg-gray-50 text-gray-500 font-medium border-b border-gray-100">
              <tr>
                <th className="px-6 py-4">المنتج</th>
                <th className="px-6 py-4">الصنف</th>
                <th className="px-6 py-4">الكمية والمخزون</th>
                <th className="px-6 py-4">سعر المبيع</th>
                <th className="px-6 py-4">الحالة</th>
                <th className="px-6 py-4 text-center">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map((p) => {
                const status = getStockStatus(p.quantity, p.minQuantity);
                
                return (
                  <tr key={p.id} className="hover:bg-gray-50/70 transition-colors relative">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                          <Package size={20} className="text-gray-400" />
                        </div>
                        <div>
                          <p className="font-bold text-gray-900">{p.name}</p>
                          <p className="text-xs text-gray-500 mt-0.5 font-mono">كود: BN{p.itemCode}</p>
                          {p.variants && p.variants.length > 0 && (
                            <SmartVariantBadges variants={p.variants} />
                          )}
                          {/* Eye Popover — يُعرض خارج الجدول في مستوى الصفحة */}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-gray-700">{getCategoryLabel(p.category)}</td>
                    <td className="px-6 py-4 font-bold text-gray-900">
                      <div className="flex flex-col gap-1.5">
                        <div className="flex items-center gap-2">
                          <span>
                            {formatNumber(
                              p.productType !== "simple" && p.variants
                                ? p.variants.reduce((sum, v) => sum + v.quantity, 0)
                                : p.quantity
                            )}{" "}
                            <span className="text-xs font-normal text-gray-500">{p.unit}</span>
                          </span>
                          {canAddEdit && (
                            <button onClick={() => { 
                                setAddQtyTarget(p); 
                                setAddQtyAmount(''); 
                                setVariantQtyAmounts({}); 
                              }} className="p-1 rounded bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition-colors" title="إضافة كمية">
                              <Plus size={14} />
                            </button>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 font-bold text-gray-900 font-currency">{formatCurrency(p.sellingPrice)}</td>
                    <td className="px-6 py-4">
                      <span className={getStatusBadgeClasses(status)}>
                        {status.label}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-center gap-2">
                        {canAddEdit && (
                          <button onClick={() => openEdit(p)} className="p-2 rounded-lg bg-gray-50 hover:bg-bunyan-50 text-gray-600 hover:text-bunyan-600 transition-colors" title="تعديل">
                            <Pencil size={16} />
                          </button>
                        )}
                        <button
                          onClick={() => setViewProduct(p)}
                          className="p-2 rounded-lg bg-gray-50 hover:bg-bunyan-50 text-gray-600 hover:text-bunyan-600 transition-colors"
                          title="عرض التفاصيل"
                        >
                          <Eye size={16} />
                        </button>
                        <button onClick={() => setInsightTarget(p)} className="p-2 rounded-lg bg-gray-50 hover:bg-bunyan-50 text-gray-600 hover:text-bunyan-600 transition-colors" title="التحليلات">
                          <BarChart2 size={16} />
                        </button>
                        {canDelete && (
                          <button onClick={() => setDeleteTarget(p)} className="p-2 rounded-lg bg-gray-50 hover:bg-red-50 text-gray-600 hover:text-red-600 transition-colors" title="حذف">
                            <Trash2 size={16} />
                          </button>
                        )}
                        {p.variants && p.variants.length > 0 && (
                          <button
                            onClick={() => setVariantPopoverProductId(variantPopoverProductId === p.id ? null : p.id)}
                            className={`p-2 rounded-lg transition-colors ${
                              variantPopoverProductId === p.id
                                ? 'bg-bunyan-100 text-bunyan-700'
                                : 'bg-gray-50 hover:bg-bunyan-50 text-gray-600 hover:text-bunyan-600'
                            }`}
                            title="عرض المتغيرات"
                          >
                            {variantPopoverProductId === p.id ? (
                              <ChevronUp size={16} />
                            ) : (
                              <ChevronDown size={16} />
                            )}
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
              <Package size={28} className="text-gray-400" />
            </div>
            <p className="text-base font-bold text-gray-900 mb-1">لا توجد منتجات مطابقة</p>
            <p className="text-sm text-gray-500">جرب البحث بكلمات مختلفة أو إزالة الفلاتر النشطة.</p>
          </div>
        )}
      </div>

      {/* عرض Popover المتغيرات في مستوى الصفحة */}
      {variantPopoverProductId && (() => {
        const popProduct = myProducts.find(p => p.id === variantPopoverProductId);
        if (!popProduct || !popProduct.variants || popProduct.variants.length === 0) return null;
        return (
          <div className="fixed inset-0 z-[200]" onClick={() => setVariantPopoverProductId(null)}>
            <div
              className="absolute bottom-8 left-8"
              onClick={(e) => e.stopPropagation()}
            >
              <SmartVariantPopover
                product={{
                  name: popProduct?.name || '',
                  variants: (popProduct?.variants || []) as any,
                  attributeConfig: (popProduct?.attributeConfig || []) as any
                }}
                onClose={() => setVariantPopoverProductId(null)}
              />
            </div>
          </div>
        );
      })()}

      {/* إضافة / تعديل منتج (المكون الجديد) */}
      <AddProductSlideOver 
        isOpen={slideOpen} 
        onClose={() => { setSlideOpen(false); setEditProduct(null); }} 
        editProduct={editProduct}
      />

      {/* تأكيد الحذف */}
      <ConfirmDialog isOpen={!!deleteTarget} title="حذف منتج" message="هل أنت متأكد من حذف هذا المنتج؟ سيؤثر هذا على الطلبيات المرتبطة به إن وجدت."
        itemName={deleteTarget?.name} onConfirm={handleDelete} onCancel={() => setDeleteTarget(null)} />

      {/* إضافة كمية سريعة للمنتج البسيط */}
      {addQtyTarget && addQtyTarget.productType === 'simple' && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => { setAddQtyTarget(null); setAddQtyAmount(''); }} />
          <div className="relative bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl animate-fade-in">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-full bg-bunyan-100 flex items-center justify-center shrink-0">
                <Package size={22} className="text-bunyan-600" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-[#0a1628]">إضافة كمية للمخزون</h3>
              </div>
            </div>
            
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-amber-700 text-xs font-bold mb-1 mt-2">
              ⚠️ سيتم خصم التكلفة من الخزينة تلقائياً
            </div>
            
            <p className="text-sm font-bold text-[#0a1628] bg-[#f0f2f7] rounded-lg px-3 py-2 mb-4 mt-3">
              {addQtyTarget?.name}
            </p>

            <div className="border border-gray-200 rounded-xl overflow-hidden shadow-sm mb-4">
              <table className="w-full text-sm text-right">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-2 text-gray-700">الكمية الحالية</th>
                    <th className="px-4 py-2 text-gray-700 text-center">الإضافة (+)</th>
                  </tr>
                </thead>
                <tbody className="bg-white">
                  <tr>
                    <td className="px-4 py-3 font-bold text-gray-600 text-base">
                      {addQtyTarget?.quantity}
                    </td>
                    <td className="px-4 py-3 flex justify-center">
                      <input 
                        type="number" 
                        min="1"
                        placeholder="0"
                        value={addQtyAmount}
                        onChange={(e) => setAddQtyAmount(e.target.value)}
                        className="w-20 px-2 py-1.5 text-center border border-gray-300 rounded-lg focus:border-bunyan-500 outline-none font-bold text-bunyan-700 focus:bg-bunyan-50 transition-all text-base"
                        autoFocus
                      />
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* زر تعديل التكلفة - WAC */}
            <div className="mb-4">
              <button
                onClick={() => setShowPriceField(p => !p)}
                className="text-xs text-bunyan-600 font-bold underline flex items-center gap-1 hover:text-bunyan-800 transition-colors"
              >
                ✏️ {showPriceField ? 'إلغاء تعديل التكلفة' : 'تعديل التكلفة لهذه الدفعة'}
              </button>
              {showPriceField && (
                <div className="mt-2">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder={String(addQtyTarget?.costPrice || 0)}
                    value={newPurchasePrice}
                    onChange={(e) => setNewPurchasePrice(e.target.value)}
                    className="w-full pr-12 pl-3 py-2 border border-bunyan-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-bunyan-500/30 focus:border-bunyan-500 text-center font-bold text-gray-800 text-sm"
                    dir="ltr"
                    autoFocus
                  />
                  <p className="text-[10px] text-gray-400 mt-1 text-center">السعر الحالي: {formatCurrency(addQtyTarget?.costPrice || 0)} — سيُحسب WAC تلقائياً</p>
                </div>
              )}
            </div>

            {/* ملخص مالي للمنتج البسيط */}
            {Number(addQtyAmount) > 0 && (
              <div className={`p-3 rounded-xl border mb-3 ${isCostExceeding ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-200'}`}>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs font-bold text-gray-700">إجمالي التكلفة:</span>
                  <span className={`text-sm font-bold font-currency ${isCostExceeding ? 'text-red-700' : 'text-gray-900'}`}>
                    {formatCurrency(totalSimpleCost)}
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-gray-500">الرصيد المتاح:</span>
                  <span className={`font-bold font-currency ${isCostExceeding ? 'text-red-600' : 'text-emerald-600'}`}>
                    {formatCurrency(availableBalance)}
                  </span>
                </div>
                {isCostExceeding && (
                  <p className="text-red-600 text-[11px] mt-2 pt-2 border-t border-red-200 font-bold flex items-center gap-1">
                    <AlertCircle size={12} /> التكلفة {formatCurrency(totalSimpleCost)} تتجاوز الرصيد {formatCurrency(availableBalance)} — يلزم {formatCurrency(totalSimpleCost - availableBalance)} إضافية
                  </p>
                )}
              </div>
            )}

            <div className="flex gap-3 mt-4">
              <button 
                onClick={() => { setAddQtyTarget(null); setAddQtyAmount(''); }}
                className="flex-1 py-2.5 bg-[#f0f2f7] hover:bg-[#e2e6ed] text-[#2d3f6b] rounded-xl text-sm font-semibold transition-colors"
              >
                إلغاء
              </button>
              <button 
                onClick={handleAddQty}
                disabled={isCostExceeding || !Number(addQtyAmount)}
                className={`flex-1 py-2.5 flex items-center justify-center gap-2 rounded-xl text-sm font-semibold transition-colors cursor-pointer ${
                  isCostExceeding || !Number(addQtyAmount)
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed opacity-50' 
                  : 'bg-bunyan-600 hover:bg-bunyan-700 text-white'
                }`}
              >
                إضافة الكمية
              </button>
            </div>
          </div>
        </div>
      )}

      {/* إضافة كميات المتغيرات */}
      {addQtyTarget && addQtyTarget.productType !== 'simple' && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => { setAddQtyTarget(null); setVariantQtyAmounts({}); }} />
          <div className="relative bg-white rounded-2xl p-6 max-w-lg w-full shadow-2xl animate-fade-in max-h-[90vh] overflow-y-auto">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-full bg-bunyan-100 flex items-center justify-center shrink-0">
                <Package size={20} className="text-bunyan-600" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-[#0a1628]">إضافة كمية للمخزون</h3>
              </div>
            </div>
            
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-amber-700 text-xs font-bold mb-1 mt-2">
              ⚠️ سيتم خصم التكلفة من الخزينة تلقائياً
            </div>
            
            <p className="text-sm font-bold text-[#0a1628] bg-[#f0f2f7] rounded-lg px-3 py-2 mb-4 mt-3">
              {addQtyTarget.name}
            </p>

            {/* Pivot Table للمتغيرات */}
            {(() => {
              const cfg = addQtyTarget?.attributeConfig;
              const variants = addQtyTarget?.variants || [];

              // ━━ Pivot Mode: عند وجود attributeConfig ━━
              if (cfg && cfg.length > 0) {
                const colAttr = cfg[0];       // الخاصية الأولى → أعمدة
                const rowAttrs = cfg.slice(1); // الخصائص المتبقية → صفوف (يمكن أن تكون 1-3)

                const colVals = colAttr.values;

                // توليد تركيبات الصفوف من جميع الخصائص المتبقية (Cartesian product)
                const rowCombos: string[][] = rowAttrs.length === 0
                  ? [['__single__']]
                  : rowAttrs.reduce<string[][]>(
                      (acc, attr) =>
                        acc.length === 0
                          ? attr.values.map((v) => [v])
                          : acc.flatMap((combo) => attr.values.map((v) => [...combo, v])),
                      []
                    );

                // دالة إيجاد الـ variant المطابق بمقارنة كل الخصائص
                const findVariant = (colVal: string, rowCombo: string[]) =>
                  variants.find((v) => {
                    const attrs = v.attributes || {};
                    if (attrs[colAttr.name] !== colVal) return false;
                    return rowAttrs.every((ra, i) => attrs[ra.name] === rowCombo[i]);
                  });

                return (
                  <div className="border border-gray-200 rounded-xl overflow-x-auto shadow-sm mb-4">
                    <table className="w-full text-sm text-center">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          {/* خلية الزاوية — تظهر فقط إذا يوجد خصائص للصفوف */}
                          {rowAttrs.length > 0 && (
                            <th className="px-3 py-2 text-right text-gray-500 font-bold text-xs border-l border-gray-200">
                              {rowAttrs.map(a => a.name).join(' / ')} \ {colAttr.name}
                            </th>
                          )}
                          {colVals.map((col) => (
                            <th key={col} className="px-3 py-2 text-gray-700 font-bold text-xs">
                              {col}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 bg-white">
                        {rowCombos.map((rowCombo) => {
                          const rowLabel = rowCombo[0] === '__single__' ? '' : rowCombo.join(' / ');
                          return (
                            <tr key={rowCombo.join('-')} className="hover:bg-gray-50 transition-colors">
                              {/* عمود الصف — يُظهر label مركّب عند وجود خصائص */}
                              {rowAttrs.length > 0 && (
                                <td className="px-3 py-2 font-bold text-gray-700 text-right text-xs border-l border-gray-200 bg-gray-50 whitespace-nowrap">
                                  {rowLabel}
                                </td>
                              )}
                              {colVals.map((col) => {
                                const v = findVariant(col, rowCombo);
                                if (!v) return (
                                  <td key={col} className="px-2 py-2 text-gray-300 text-xs">—</td>
                                );
                                return (
                                  <td key={col} className="px-2 py-2">
                                    <div className="flex flex-col items-center gap-0.5">
                                      <span className="text-[10px] text-gray-400 font-mono">{v.quantity}</span>
                                      <input
                                        type="number"
                                        min="0"
                                        placeholder="0"
                                        value={variantQtyAmounts[v.id] || ''}
                                        onChange={(e) => setVariantQtyAmounts({
                                          ...variantQtyAmounts,
                                          [v.id]: e.target.value
                                        })}
                                        className="w-14 px-1 py-1 text-center border border-gray-300 rounded-lg focus:border-bunyan-500 outline-none font-bold text-bunyan-700 focus:bg-bunyan-50 transition-all text-sm"
                                      />
                                    </div>
                                  </td>
                                );
                              })}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                );
              }

              // ━━ Fallback: الطريقة التقليدية (size/color) ━━
              return (
                <div className="border border-gray-200 rounded-xl overflow-hidden shadow-sm mb-4">
                  <table className="w-full text-sm text-right">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-4 py-2 text-gray-700">المتغير</th>
                        <th className="px-4 py-2 text-gray-700 text-center">الكمية الحالية</th>
                        <th className="px-4 py-2 text-gray-700 text-center">الإضافة (+)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 bg-white">
                      {variants.map((v) => (
                        <tr key={v.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-2 font-bold text-gray-900">
                            {v.size} {v.color ? ` - ${v.color}` : ''}
                          </td>
                          <td className="px-4 py-2 text-center font-bold text-gray-600">
                            {v.quantity}
                          </td>
                          <td className="px-4 py-2 flex justify-center">
                            <input
                              type="number"
                              min="0"
                              placeholder="0"
                              value={variantQtyAmounts[v.id] || ''}
                              onChange={(e) => setVariantQtyAmounts({
                                ...variantQtyAmounts,
                                [v.id]: e.target.value
                              })}
                              className="w-16 px-1.5 py-1 text-center border border-gray-300 rounded-lg focus:border-bunyan-500 outline-none font-bold text-bunyan-700 focus:bg-bunyan-50 transition-all text-sm"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })()}

            {/* زر تغيير سعر الشراء للدفعة - WAC */}
            <div className="mb-4">
              <button
                onClick={() => setShowPriceField(p => !p)}
                className="text-xs text-bunyan-600 font-bold underline flex items-center gap-1 hover:text-bunyan-800 transition-colors"
              >
                ✏️ {showPriceField ? 'إلغاء تغيير سعر الشراء' : 'تغيير سعر شراء هذه الدفعة'}
              </button>
              {showPriceField && (
                <div className="mt-2">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder={String(addQtyTarget?.costPrice || 0)}
                    value={newPurchasePrice}
                    onChange={(e) => setNewPurchasePrice(e.target.value)}
                    className="w-full pr-12 pl-3 py-2 border border-bunyan-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-bunyan-500/30 focus:border-bunyan-500 text-center font-bold text-gray-800 text-sm"
                    dir="ltr"
                    autoFocus
                  />
                  <p className="text-[10px] text-gray-400 mt-1 text-center">السعر الحالي: {formatCurrency(addQtyTarget?.costPrice || 0)} — سيُحسب متوسط التكلفة المرجح (WAC) تلقائياً</p>
                </div>
              )}
            </div>

            {/* ملخص مالي */}
            {totalVariantsAdded > 0 && (
              <div className={`p-3 rounded-xl border mb-4 ${isCostExceeding ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-200'}`}>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs font-bold text-gray-700">إجمالي التكلفة:</span>
                  <span className={`text-sm font-bold font-currency ${isCostExceeding ? 'text-red-700' : 'text-gray-900'}`}>
                    {formatCurrency(totalVariantsCost)}
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-gray-500">الرصيد المتاح:</span>
                  <span className={`font-bold font-currency ${isCostExceeding ? 'text-red-600' : 'text-emerald-600'}`}>
                    {formatCurrency(availableBalance)}
                  </span>
                </div>
                {isCostExceeding && (
                  <p className="text-red-600 text-[11px] mt-2 pt-2 border-t border-red-200 font-bold flex items-center gap-1">
                    <AlertCircle size={12} /> التكلفة {formatCurrency(totalVariantsCost)} تتجاوز الرصيد {formatCurrency(availableBalance)} — يلزم {formatCurrency(totalVariantsCost - availableBalance)} إضافية
                  </p>
                )}
              </div>
            )}

            <div className="flex gap-3 mt-2">
              <button 
                onClick={() => { setAddQtyTarget(null); setVariantQtyAmounts({}); }}
                className="flex-1 py-2.5 bg-[#f0f2f7] hover:bg-[#e2e6ed] text-[#2d3f6b] rounded-xl text-sm font-semibold transition-colors"
              >
                إلغاء
              </button>
              <button 
                onClick={handleAddQty}
                disabled={isCostExceeding || totalVariantsAdded === 0}
                className={`flex-1 py-2.5 flex items-center justify-center gap-2 rounded-xl text-sm font-semibold transition-colors cursor-pointer ${
                  isCostExceeding || totalVariantsAdded === 0 
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed opacity-50' 
                  : 'bg-bunyan-600 hover:bg-bunyan-700 text-white'
                }`}
              >
                إضافة الكميات
              </button>
            </div>
          </div>
        </div>
      )}

      {/* تحليلات المنتج (Insights) */}
      <SlideOver
        isOpen={!!insightTarget}
        onClose={() => setInsightTarget(null)}
        title="أداء وتحليلات المنتج"
      >
        {insightTarget && (() => {
          const insightSalesQtyLocal = insightSalesQty;
          const isLowStock = insightTarget.quantity < insightTarget.minQuantity;
          const isTrending = insightSalesQtyLocal > 0 && insightSalesQtyLocal >= Math.max(10, insightTarget.quantity * 0.3);
          // أعلى متغير من حيث الكمية
          const topVariantId = (insightTarget.variants || []).length
            ? [...(insightTarget.variants || [])].sort((a, b) => b.quantity - a.quantity)[0]?.id
            : null;

          return (
            <div className="pb-16 space-y-0">

              {/* ━━━ GRADIENT HEADER ━━━ */}
              <div className="relative px-6 pt-6 pb-8 bg-gradient-to-br from-bunyan-900 to-bunyan-700 overflow-hidden">
                {/* decorative circles */}
                <div className="absolute -top-6 -left-6 w-28 h-28 rounded-full bg-white/5" />
                <div className="absolute top-2 left-16 w-14 h-14 rounded-full bg-white/5" />

                {/* Status Badge */}
                <div className="flex justify-between items-start mb-4">
                  <div />
                  {isLowStock ? (
                    <span className="flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full bg-red-500/20 text-red-300 border border-red-400/30 animate-pulse">
                      ⚠️ مخزون منخفض
                    </span>
                  ) : isTrending ? (
                    <span className="flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                      🔥 منتج رائج
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full bg-white/10 text-white/60 border border-white/15">
                      متوسط الحركة
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center shrink-0">
                    <Package size={24} className="text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-white leading-tight">{insightTarget.name}</h3>
                    <p className="text-sm text-white/60 font-mono mt-0.5">BN{insightTarget.itemCode}</p>
                  </div>
                </div>
              </div>

              {/* ━━━ KPI CARDS ━━━ */}
              <div className="px-4 -mt-4 relative z-10">
                <div className="grid grid-cols-2 gap-3">
                  {/* المخزون */}
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col gap-2 overflow-hidden relative">
                    <div className="w-9 h-9 rounded-xl bg-gray-50 flex items-center justify-center">
                      <Package size={18} className="text-gray-500" />
                    </div>
                    <p className="text-[10px] uppercase tracking-wider text-gray-400 font-bold">المخزون</p>
                    <p className="text-3xl font-black text-gray-900 leading-none">{formatNumber(insightTarget.quantity)}</p>
                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-200 rounded-b-2xl" />
                  </div>

                  {/* المبيعات */}
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col gap-2 overflow-hidden relative">
                    <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center">
                      <TrendingUp size={18} className="text-blue-500" />
                    </div>
                    <p className="text-[10px] uppercase tracking-wider text-gray-400 font-bold">المبيعات</p>
                    <p className="text-3xl font-black text-gray-900 leading-none">{formatNumber(insightSalesQty)}</p>
                    <p className="text-[10px] text-emerald-500 font-bold">↑ إجمالي الوحدات المباعة</p>
                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-blue-500 rounded-b-2xl" />
                  </div>

                  {/* الإيراد */}
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col gap-2 overflow-hidden relative">
                    <div className="w-9 h-9 rounded-xl bg-bunyan-50 flex items-center justify-center">
                      <DollarSign size={18} className="text-bunyan-600" />
                    </div>
                    <p className="text-[10px] uppercase tracking-wider text-gray-400 font-bold">الإيراد</p>
                    <p className="text-xl font-black text-gray-900 leading-none font-currency">{formatCurrency(insightRevenue)}</p>
                    <p className="text-[10px] text-emerald-500 font-bold">↑ إجمالي المبيعات</p>
                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-bunyan-600 rounded-b-2xl" />
                  </div>

                  {/* الربح */}
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col gap-2 overflow-hidden relative">
                    <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center">
                      <BarChart2 size={18} className="text-emerald-600" />
                    </div>
                    <p className="text-[10px] uppercase tracking-wider text-gray-400 font-bold">هامش الربح</p>
                    <p className="text-xl font-black text-gray-900 leading-none font-currency">{formatCurrency(insightProfit)}</p>
                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-emerald-500 rounded-b-2xl" />
                  </div>
                </div>
              </div>

              {/* ━━━ CHART ━━━ */}
              <div className="px-4 mt-4">
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <TrendingUp size={16} className="text-bunyan-600" />
                    <p className="text-sm font-bold text-gray-800">المبيعات — آخر ٧ أيام</p>
                  </div>
                  <ResponsiveContainer width="100%" height={130}>
                    <BarChart data={insightChartData} barSize={20}>
                      <XAxis
                        dataKey="label"
                        tick={{ fontSize: 10, fill: '#9ca3af', fontWeight: 600 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis hide />
                      <Tooltip
                        formatter={(val: number | undefined) => [`${val ?? 0} وحدة`, 'المبيعات']}
                        contentStyle={{
                          fontSize: 12,
                          borderRadius: 10,
                          border: 'none',
                          background: '#1e1b4b',
                          color: '#fff',
                          boxShadow: '0 4px 20px rgba(0,0,0,0.25)',
                        }}
                        labelStyle={{ color: '#c4b5fd', fontWeight: 700 }}
                        itemStyle={{ color: '#fff' }}
                        cursor={{ fill: '#7c3aed10' }}
                      />
                      <Bar dataKey="qty" fill="#7C3AED" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* ━━━ VARIANTS ━━━ */}
              {insightTarget.variants && insightTarget.variants.length > 0 && (
                <div className="px-4 mt-4">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="flex-1 h-px bg-gray-100" />
                    <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">التحليل التفصيلي للمقاسات</h4>
                    <div className="flex-1 h-px bg-gray-100" />
                  </div>
                  <div className="space-y-2.5">
                    {[...(insightTarget.variants || [])]
                      .sort((a, b) => b.quantity - a.quantity)
                      .map((v) => {
                        const totalQty = insightTarget.quantity;
                        const percentage = totalQty > 0 ? Math.round((v.quantity / totalQty) * 100) : 0;
                        const isTop = v.id === topVariantId;
                        return (
                          <div key={v.id} className="bg-white border border-gray-100 rounded-xl px-4 py-3 shadow-sm">
                            <div className="flex items-center justify-between mb-2">
                              <span className="font-bold text-gray-900 text-sm flex items-center gap-1">
                                {isTop && <span className="text-yellow-400 text-base">⭐</span>}
                                {(v as any).size}{(v as any).color ? ` — ${(v as any).color}` : ''}
                              </span>
                              <span className="text-xs font-bold text-gray-500">{v.quantity} وحدة · {percentage}%</span>
                            </div>
                            <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-bunyan-600 rounded-full transition-all"
                                style={{ width: `${percentage}%` }}
                              />
                            </div>
                          </div>
                        );
                    })}
                  </div>
                </div>
              )}

              {/* Close button */}
              <div className="px-4 mt-6">
                <button
                  onClick={() => setInsightTarget(null)}
                  className="w-full py-3 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition-colors text-sm"
                >
                  إغلاق التحليلات
                </button>
              </div>

              {insightSalesQty === 0 && (
                <div className="text-center py-6 text-gray-400 text-sm">
                  📦 لا توجد مبيعات لهذا المنتج بعد
                </div>
              )}

            </div>
          );
        })()}
      </SlideOver>

      {/* تفاصيل المنتج (Detail View) */}
      <SlideOver
        isOpen={!!viewProduct}
        onClose={() => setViewProduct(null)}
        title="تفاصيل المنتج"
      >
        {viewProduct && (
          <div className="p-6 space-y-6">
            <div className="flex items-center gap-4 bg-gray-50 p-4 rounded-2xl border border-gray-100">
              <div className="w-16 h-16 rounded-2xl bg-bunyan-100 flex items-center justify-center shrink-0">
                <Package size={32} className="text-bunyan-600" />
              </div>
              <div>
                <h3 className="text-xl font-black text-gray-900">{viewProduct.name}</h3>
                <p className="text-sm font-mono text-gray-500">كود المنتج: BN{viewProduct.itemCode}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
                <p className="text-xs text-gray-400 font-bold mb-1">الفئة</p>
                <p className="text-base font-bold text-gray-900">{getCategoryLabel(viewProduct.category)}</p>
              </div>
              <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
                <p className="text-xs text-gray-400 font-bold mb-1">وحدة القياس</p>
                <p className="text-base font-bold text-gray-900">{viewProduct.unit}</p>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm space-y-4">
              <div>
                <p className="text-xs text-gray-400 font-bold mb-3 flex items-center gap-1">
                  <DollarSign size={14} /> التسعير
                </p>
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <span className="text-xs text-gray-500 block mb-1">سعر التكلفة</span>
                    {canViewCost ? (
                      <span className="text-lg font-black text-gray-900 font-currency">{formatCurrency(viewProduct.costPrice)}</span>
                    ) : (
                      <span className="text-gray-300 font-black">---</span>
                    )}
                  </div>
                  <div>
                    <span className="text-xs text-gray-500 block mb-1">سعر البيع</span>
                    <span className="text-lg font-black text-bunyan-600 font-currency">{formatCurrency(viewProduct.sellingPrice)}</span>
                  </div>
                </div>
              </div>
              
              <hr className="border-gray-50" />

              <div>
                <p className="text-xs text-gray-400 font-bold mb-3 flex items-center gap-1">
                  <Package size={14} /> المخزون
                </p>
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <span className="text-xs text-gray-500 block mb-1">الكمية الحالية</span>
                    <span className="text-lg font-black text-gray-900">{formatNumber(viewProduct.quantity)} {viewProduct.unit}</span>
                  </div>
                  <div>
                    <span className="text-xs text-gray-500 block mb-1">حد الإنذار الأدنى</span>
                    <span className="text-lg font-black text-amber-600">{viewProduct.minQuantity} {viewProduct.unit}</span>
                  </div>
                </div>
              </div>
            </div>

            {viewProduct.barcode && (
              <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
                <p className="text-xs text-gray-400 font-bold mb-2">الباركود</p>
                <p className="text-base font-mono font-bold text-gray-900 tracking-wider">
                  {viewProduct.barcode}
                </p>
              </div>
            )}

            {/* سجل المخزون */}
            <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-xs text-gray-400 font-bold flex items-center gap-1">
                  <TrendingUp size={14} /> سجل المخزون
                </p>
                <span className="text-[10px] text-gray-400 font-medium">
                  تاريخ الإضافة: {viewProduct.createdAt ? new Date(viewProduct.createdAt).toLocaleDateString('en-GB') : '---'}
                </span>
              </div>

              {viewProduct.stockHistory && viewProduct.stockHistory.length > 0 ? (
                <div className="space-y-3">
                  <div className="p-3 bg-bunyan-50 rounded-xl border border-bunyan-100">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-bunyan-600 font-bold">آخر إضافة</span>
                      <span className="text-bunyan-700 font-black">
                        +{viewProduct.stockHistory[viewProduct.stockHistory.length - 1].quantity} {viewProduct.unit}
                      </span>
                    </div>
                  </div>

                  <div className="max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                    <table className="w-full text-xs text-right text-gray-500">
                      <thead className="bg-gray-50 sticky top-0 border-b border-gray-100">
                        <tr>
                          <th className="py-2 pr-2">التاريخ</th>
                          <th className="py-2 pl-2 text-left">الكمية</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {[...viewProduct.stockHistory].reverse().map((entry) => (
                          <tr key={entry.id} className="hover:bg-gray-50/50">
                            <td className="py-2 pr-2 font-mono">{new Date(entry.date).toLocaleDateString('en-GB')}</td>
                            <td className="py-2 pl-2 text-left font-bold text-gray-900">+{entry.quantity}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-center text-gray-400 py-2">لا يوجد سجل إضافات متاح</p>
              )}
            </div>

            <div className="pt-4 flex gap-3">
              <button 
                onClick={() => { setViewProduct(null); openEdit(viewProduct); }}
                className="flex-1 py-3 bg-bunyan-50 text-bunyan-600 font-bold rounded-xl hover:bg-bunyan-100 transition-colors flex items-center justify-center gap-2"
              >
                <Pencil size={18} /> تعديل البيانات
              </button>
              <button 
                onClick={() => setViewProduct(null)}
                className="flex-1 py-3 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition-colors"
              >
                إغلاق
              </button>
            </div>
          </div>
        )}
      </SlideOver>
    </div>
  );
}
