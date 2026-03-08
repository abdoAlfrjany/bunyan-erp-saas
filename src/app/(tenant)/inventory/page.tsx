// src/app/(tenant)/inventory/page.tsx
// الوظيفة: صفحة المخزون — إدارة المنتجات، التنبيه بالنواقص
// الجداول: products
// الصلاحية: OWNER (كامل), EMPLOYEE (بدون أسعار الشراء ولا الحذف)

'use client';

import { useState } from 'react';
import { useAuthStore } from '@/core/auth/store';
import { useDataStore } from '@/core/db/store';
import { formatCurrency, formatNumber } from '@/shared/utils/format';
import { STOCK_STATUS, getStockStatus, getStatusBadgeClasses } from '@/shared/utils/statusColors';
import { SlideOver } from '@/shared/components/ui/SlideOver';
import { ConfirmDialog } from '@/shared/components/ui/ConfirmDialog';
import { useToast } from '@/shared/components/ui/Toast';
import { Package, Plus, Search, Pencil, Trash2, AlertTriangle, AlertCircle, X, CheckCircle2 } from 'lucide-react';
import { AddProductSlideOver } from '@/shared/components/ui';

type Filter = 'all' | 'available' | 'low' | 'out';
const SIZES_CLOTHING = ['S', 'M', 'L', 'XL', 'XXL'];
const SIZES_SHOES = ['38', '39', '40', '41', '42', '43', '44', '45'];

export default function InventoryPage() {
  const { user } = useAuthStore();
  const { showToast } = useToast();
  const { products, getForTenant, addProduct, updateProduct, deleteProduct } = useDataStore();
  const tid = user?.tenantId || '';
  const isOwner = user?.role === 'owner';
  const canViewCost = isOwner || user?.permissions?.inventory?.viewCostPrice;
  const canAddEdit = isOwner || user?.permissions?.inventory?.add || user?.permissions?.inventory?.edit;
  const canDelete = isOwner || user?.permissions?.inventory?.delete;

  const myProducts = getForTenant(products, tid).filter(p => p.isActive);
  const productTypes = Array.from(new Set(myProducts.map(p => p.productType))).filter(Boolean);
  const typeLabels: Record<string, string> = {
    simple: 'منتج عادي',
    clothing: 'ملابس',
    shoes: 'أحذية',
    custom: 'مخصص'
  };

  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [typeFilter, setTypeFilter] = useState('all');
  
  const [slideOpen, setSlideOpen] = useState(false);
  const [editProduct, setEditProduct] = useState<typeof myProducts[0] | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<typeof myProducts[0] | null>(null);

  const [addQtyTarget, setAddQtyTarget] = useState<typeof myProducts[0] | null>(null);
  const [addQtyAmount, setAddQtyAmount] = useState('');

  // الفلترة
  const filtered = myProducts.filter((p) => {
    if (search && !p.name.includes(search) && !String(p.itemCode).includes(search)) return false;
    if (typeFilter !== 'all' && p.productType !== typeFilter) return false;
    const isLow = p.quantity > 0 && p.quantity <= p.minQuantity;
    const isOut = p.quantity <= 0;
    
    if (filter === 'available' && (isLow || isOut)) return false;
    if (filter === 'low' && !isLow) return false;
    if (filter === 'out' && !isOut) return false;
    return true;
  });

  const lowStockCount = myProducts.filter(p => p.quantity > 0 && p.quantity <= p.minQuantity).length;
  const outOfStockCount = myProducts.filter(p => p.quantity <= 0).length;

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
    const amount = Number(addQtyAmount);
    if (amount <= 0) {
      showToast('يرجى إدخال كمية صحيحة أكبر من الصفر', 'error');
      return;
    }
    
    updateProduct(addQtyTarget.id, { quantity: addQtyTarget.quantity + amount });
    
    if (addQtyTarget.quantity + amount <= addQtyTarget.minQuantity) {
      showToast(`تنبيه: الكمية تحت الحد الأدنى (${addQtyTarget.minQuantity} قطعة)`, 'warning');
    } else {
      showToast('تمت إضافة الكمية بنجاح', 'success');
    }
    setAddQtyTarget(null);
    setAddQtyAmount('');
  };

  const handleDelete = () => {
    if (deleteTarget) {
      const res = deleteProduct(deleteTarget.id);
      setDeleteTarget(null);
      if (res.success) showToast('تم حذف المنتج بنجاح', 'success');
      else showToast(res.error || 'لا يمكن حذف المنتج', 'error');
    }
  };

  const filters: { key: Filter; label: string; count?: number; colorClass?: string }[] = [
    { key: 'all', label: `الكل (${myProducts.length})` },
    { key: 'available', label: 'متاح', colorClass: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
    { key: 'low', label: 'ينفد', count: lowStockCount, colorClass: 'text-amber-700 bg-amber-50 border-amber-200' },
    { key: 'out', label: 'نفد', count: outOfStockCount, colorClass: 'text-red-700 bg-red-50 border-red-200' },
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
              placeholder="بحث باسم المنتج أو الرمز (SKU)..."
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
                {f.label}
                {f.count !== undefined && f.count > 0 && (
                  <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                    filter === f.key ? 'bg-white/20 text-white' : f.colorClass
                  }`}>
                    {f.count}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* فلاتر أنواع المنتجات */}
        {productTypes.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-3 border-t border-gray-100">
            <button 
              onClick={() => setTypeFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                typeFilter === 'all' 
                  ? 'bg-gray-800 text-white border-gray-800 shadow-sm' 
                  : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
              }`}
            >
              كل أنواع المنتجات
            </button>
            {productTypes.map((t) => (
              <button 
                key={t}
                onClick={() => setTypeFilter(t)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                  typeFilter === t 
                    ? 'bg-gray-800 text-white border-gray-800 shadow-sm' 
                    : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                }`}
              >
                {typeLabels[t] || t}
              </button>
            ))}
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
                  <tr key={p.id} className="hover:bg-gray-50/70 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                          <Package size={20} className="text-gray-400" />
                        </div>
                        <div>
                          <p className="font-bold text-gray-900">{p.name} {p.productType !== 'simple' && <span className="text-[10px] bg-bunyan-100 text-bunyan-700 px-1.5 py-0.5 rounded-md mr-1">{p.productType === 'clothing' ? 'ملابس' : 'مخصص'}</span>}</p>
                          <p className="text-xs text-gray-500 mt-0.5 font-mono">كود: BN{p.itemCode}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-gray-700">{p.category}</td>
                    <td className="px-6 py-4 font-bold text-gray-900">
                      <div className="flex flex-col gap-1.5">
                        <div className="flex items-center gap-2">
                          <span>{formatNumber(p.quantity)} <span className="text-xs font-normal text-gray-500">{p.unit}</span></span>
                          {canAddEdit && (
                            <button onClick={() => { setAddQtyTarget(p); setAddQtyAmount(''); }} className="p-1 rounded bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition-colors" title="إضافة كمية">
                              <Plus size={14} />
                            </button>
                          )}
                        </div>
                        {p.productType === 'clothing' && p.variants && p.variants.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {p.variants.map(v => (
                              <div key={v.id} className="group relative">
                                <span className={`text-[10px] px-1.5 py-0.5 rounded cursor-help ${
                                  v.quantity === 0 ? 'bg-gray-100 text-gray-400 line-through' :
                                  v.quantity <= 3 ? 'bg-red-50 text-red-600 font-bold border border-red-100' :
                                  'bg-bunyan-50 text-bunyan-700 border border-bunyan-100'
                                }`}>
                                  {v.size}
                                </span>
                                <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 hidden group-hover:block w-max bg-gray-900 text-white text-[10px] py-1 px-2 rounded font-bold z-10 shadow-lg">
                                  الكمية: {v.quantity}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
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

      {/* إضافة كمية سريعة */}
      {addQtyTarget && (
        <ConfirmDialog 
          isOpen={true} 
          title="إضافة كمية للمخزون" 
          message="أدخل الكمية التي تود إضافتها للرصيد الحالي. سيتم خصم تكلفتها من الخزينة تلقائياً." 
          itemName={addQtyTarget.name}
          onConfirm={handleAddQty} 
          onCancel={() => { setAddQtyTarget(null); setAddQtyAmount(''); }}
          confirmText="إضافة الكمية"
        >
          {addQtyTarget.productType !== 'simple' ? (
            <div className="mt-4 p-3 bg-red-50 text-red-700 border border-red-200 rounded-xl text-xs font-bold flex items-start gap-2">
              <AlertTriangle size={16} className="shrink-0 mt-0.5" />
              <span>للحفاظ على دقة المتغيرات، يرجى الاستعانة بنافذة "تعديل المنتج" لزيادة مقاسات هذا المنتج.</span>
            </div>
          ) : (
            <div className="mt-4">
              <label className="block text-xs font-bold text-gray-700 mb-1">الكمية الإضافية (+)</label>
              <input 
                type="number" 
                value={addQtyAmount} 
                onChange={e => setAddQtyAmount(e.target.value)}
                placeholder="مثال: 50"
                min="1"
                className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-bunyan-500/30 focus:border-bunyan-500 font-mono text-center text-lg font-bold"
                dir="ltr"
                autoFocus
              />
              <div className="mt-3 text-sm text-gray-500 flex justify-between bg-gray-50 p-3 rounded-lg border border-gray-200">
                <span>الرصيد الحالي: <strong className="text-gray-900">{addQtyTarget.quantity}</strong></span>
                <span>الرصيد الجديد: <strong className="text-bunyan-600">{addQtyTarget.quantity + (Number(addQtyAmount) || 0)}</strong></span>
              </div>
            </div>
          )}
        </ConfirmDialog>
      )}
    </div>
  );
}
