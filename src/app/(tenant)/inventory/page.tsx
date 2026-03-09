// src/app/(tenant)/inventory/page.tsx
// الوظيفة: صفحة المخزون — إدارة المنتجات، التنبيه بالنواقص
// الجداول: products
// الصلاحية: OWNER (كامل), EMPLOYEE (بدون أسعار الشراء ولا الحذف)

'use client';

import React, { useState } from 'react';
import { useAuthStore } from '@/core/auth/store';
import { useDataStore } from '@/core/db/store';
import { formatCurrency, formatNumber } from '@/shared/utils/format';
import { STOCK_STATUS, getStockStatus, getStatusBadgeClasses } from '@/shared/utils/statusColors';
import { SlideOver } from '@/shared/components/ui/SlideOver';
import { ConfirmDialog } from '@/shared/components/ui/ConfirmDialog';
import { useToast } from '@/shared/components/ui/Toast';
import { Package, Plus, Search, Pencil, Trash2, AlertTriangle, AlertCircle, X, CheckCircle2, BarChart2, TrendingUp, DollarSign } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { AddProductSlideOver } from '@/shared/components/ui';

type Filter = 'all' | 'available' | 'low' | 'out';
const SIZES_CLOTHING = ['S', 'M', 'L', 'XL', 'XXL'];
const SIZES_SHOES = ['38', '39', '40', '41', '42', '43', '44', '45'];

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
  const [activeFilter, setActiveFilter] = useState('all');
  
  const [slideOpen, setSlideOpen] = useState(false);
  const [editProduct, setEditProduct] = useState<typeof myProducts[0] | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<typeof myProducts[0] | null>(null);
  const [insightTarget, setInsightTarget] = useState<typeof myProducts[0] | null>(null);

  const [addQtyTarget, setAddQtyTarget] = useState<typeof myProducts[0] | null>(null);
  const [addQtyAmount, setAddQtyAmount] = useState('');
  const [variantQtyAmounts, setVariantQtyAmounts] = useState<Record<string, string>>({});
  // WAC: سعر شراء الدفعة الجديدة
  const [newPurchasePrice, setNewPurchasePrice] = useState('');
  const [showPriceField, setShowPriceField] = useState(false);

  // الفلترة
  const filtered = myProducts.filter((p) => {
    if (search && !p.name.includes(search) && !String(p.itemCode).includes(search)) return false;
    
    if (activeFilter !== 'all') {
      if (activeFilter === 'simple') {
        if (p.productType !== 'simple') return false;
      } else if (activeFilter === 'clothing') {
        if (p.productType !== 'clothing') return false;
      } else if (activeFilter === 'shoes') {
        if (p.productType !== 'shoes') return false;
      } else {
        if (p.category !== activeFilter) return false;
      }
    }

    const isLow = p.quantity > 0 && p.quantity <= p.minQuantity;
    const isOut = p.quantity <= 0;
    
    if (filter === 'available' && (isLow || isOut)) return false;
    if (filter === 'low' && !isLow) return false;
    if (filter === 'out' && !isOut) return false;
    return true;
  });

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
        variants: newVariants
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
    { key: 'all', label: `الكل (${myProducts.length})` },
    { key: 'available', label: 'متاح', colorClass: 'text-emerald-700 bg-emerald-50 border-emerald-200', dotColor: 'bg-emerald-500' },
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
          <div className="flex flex-wrap gap-2">
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
                {f.count !== undefined && f.count > 0 && (
                  <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                    filter === f.key ? 'bg-white/20 text-white' : f.colorClass
                  }`}>
                    ({f.count})
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* فلاتر الفئات الديناميكية والثابتة */}
        <div className="flex flex-wrap gap-2 pt-3 border-t border-gray-100">
          <button 
            onClick={() => setActiveFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
              activeFilter === 'all' 
                ? 'bg-gray-800 text-white border-gray-800 shadow-sm' 
                : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
            }`}
          >
            كل أنواع المنتجات
          </button>
          <button 
            onClick={() => setActiveFilter('simple')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
              activeFilter === 'simple' 
                ? 'bg-gray-800 text-white border-gray-800 shadow-sm' 
                : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
            }`}
          >
            منتج عادي
          </button>
          <button 
            onClick={() => setActiveFilter('clothing')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
              activeFilter === 'clothing' 
                ? 'bg-gray-800 text-white border-gray-800 shadow-sm' 
                : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
            }`}
          >
            ملابس
          </button>
          <button 
            onClick={() => setActiveFilter('shoes')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
              activeFilter === 'shoes' 
                ? 'bg-gray-800 text-white border-gray-800 shadow-sm' 
                : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
            }`}
          >
            أحذية
          </button>
          
          {customCategories.map((cat) => (
            <button 
              key={cat}
              onClick={() => setActiveFilter(cat)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                activeFilter === cat 
                  ? 'bg-gray-800 text-white border-gray-800 shadow-sm' 
                  : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
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
                  <tr key={p.id} className="hover:bg-gray-50/70 transition-colors">
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
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-gray-700">{p.category}</td>
                    <td className="px-6 py-4 font-bold text-gray-900">
                      <div className="flex flex-col gap-1.5">
                        <div className="flex items-center gap-2">
                          <span>{formatNumber(p.quantity)} <span className="text-xs font-normal text-gray-500">{p.unit}</span></span>
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
                        <button onClick={() => setInsightTarget(p)} className="p-2 rounded-lg bg-gray-50 hover:bg-bunyan-50 text-gray-600 hover:text-bunyan-600 transition-colors" title="التحليلات">
                          <BarChart2 size={16} />
                        </button>
                        {canDelete && (
                          <button onClick={() => setDeleteTarget(p)} className="p-2 rounded-lg bg-gray-50 hover:bg-red-50 text-gray-600 hover:text-red-600 transition-colors" title="حذف">
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
              <Package size={28} className="text-gray-400" />
            </div>
            <p className="text-base font-bold text-gray-900 mb-1">لا توجد منتجات مطابقة</p>
            <p className="text-sm text-gray-500">جرب البحث بكلمات مختلفة أو إزالة الفلاتر النشطة.</p>
          </div>
        )}
      </div>

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
              {addQtyTarget.name}
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
                    placeholder={String(addQtyTarget.costPrice || 0)}
                    value={newPurchasePrice}
                    onChange={(e) => setNewPurchasePrice(e.target.value)}
                    className="w-full pr-12 pl-3 py-2 border border-bunyan-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-bunyan-500/30 focus:border-bunyan-500 text-center font-bold text-gray-800 text-sm"
                    dir="ltr"
                    autoFocus
                  />
                  <p className="text-[10px] text-gray-400 mt-1 text-center">السعر الحالي: {formatCurrency(addQtyTarget.costPrice || 0)} — سيُحسب WAC تلقائياً</p>
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
                  {addQtyTarget?.variants?.map((v) => (
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
                    placeholder={String(addQtyTarget.costPrice || 0)}
                    value={newPurchasePrice}
                    onChange={(e) => setNewPurchasePrice(e.target.value)}
                    className="w-full pr-12 pl-3 py-2 border border-bunyan-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-bunyan-500/30 focus:border-bunyan-500 text-center font-bold text-gray-800 text-sm"
                    dir="ltr"
                    autoFocus
                  />
                  <p className="text-[10px] text-gray-400 mt-1 text-center">السعر الحالي: {formatCurrency(addQtyTarget.costPrice || 0)} — سيُحسب متوسط التكلفة المرجح (WAC) تلقائياً</p>
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
          const isLowStock = insightTarget.quantity < insightTarget.minQuantity;
          const isTrending = insightSalesQty > 0 && insightSalesQty >= Math.max(10, insightTarget.quantity * 0.3);
          // أعلى متغير من حيث الكمية
          const topVariantId = insightTarget.variants?.length
            ? [...insightTarget.variants].sort((a, b) => b.quantity - a.quantity)[0]?.id
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
                    {[...insightTarget.variants]
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
                                {v.size}{v.color ? ` — ${v.color}` : ''}
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
    </div>
  );
}
