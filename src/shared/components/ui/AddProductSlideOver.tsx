'use client';

import { useState, useMemo, useEffect } from 'react';
import { 
  X, Package, Plus, Trash2, Check, AlertTriangle, 
  Wand2, Ruler, Shirt, Footprints, Sparkles, ChevronLeft
} from 'lucide-react';
import { SlideOver } from './SlideOver';
import { useDataStore } from '@/core/db/store';
import { useAuthStore } from '@/core/auth/store';
import { useToast } from './Toast';
import { generateSKU, cartesian, generateItemCode } from '@/core/utils';
import { formatCurrency } from '@/shared/utils/format';
import type { Product, ProductVariant } from '@/core/types';

interface AddProductSlideOverProps {
  isOpen: boolean;
  onClose: () => void;
  editProduct?: Product | null;
}

const CATEGORIES = [
  { id: 'simple', label: 'منتج عادي / أجهزة', icon: Package },
  { id: 'clothing', label: 'ملابس', icon: Shirt },
  { id: 'shoes', label: 'أحذية', icon: Footprints },
  { id: 'custom', label: 'منتج مخصص', icon: Sparkles },
];

const SIZES_CLOTHING = ['S', 'M', 'L', 'XL', 'XXL'];
const SIZES_SHOES = ['38', '39', '40', '41', '42', '43', '44', '45'];

export function AddProductSlideOver({ isOpen, onClose, editProduct }: AddProductSlideOverProps) {
  const { user } = useAuthStore();
  const { products, addProduct, updateProduct } = useDataStore();
  const { showToast } = useToast();
  const tid = user?.tenantId || '';

  const [category, setCategory] = useState<string>('simple');
  const [productName, setProductName] = useState('');
  const [costPrice, setCostPrice] = useState('');
  const [sellPrice, setSellPrice] = useState('');
  const [minAlert, setMinAlert] = useState('5');
  const [simpleQty, setSimpleQty] = useState('');
  const [barcode, setBarcode] = useState('');
  const [unit, setUnit] = useState('قطعة');
  const [attributes, setAttributes] = useState<{ name: string; values: string[] }[]>([]);
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [isSuccess, setIsSuccess] = useState(false);

  // Initialize form when editing or opening
  useEffect(() => {
    if (editProduct) {
      setCategory(editProduct.productType || 'simple');
      setProductName(editProduct.name);
      setCostPrice(String(editProduct.costPrice));
      setSellPrice(String(editProduct.sellingPrice));
      setMinAlert(String(editProduct.minQuantity));
      setUnit(editProduct.unit);
      setBarcode(editProduct.barcode || '');
      
      if (editProduct.productType !== 'simple') {
        const config = editProduct.attributeConfig || [];
        setAttributes(config);
        const qtys: Record<string, string> = {};
        editProduct.variants?.forEach((v: ProductVariant) => {
          if (v.sku) qtys[v.sku] = String(v.quantity);
        });
        setQuantities(qtys);
      } else {
        setSimpleQty(String(editProduct.quantity));
      }
    } else {
      resetForm();
    }
  }, [editProduct, isOpen]);

  const resetForm = () => {
    setCategory('simple');
    setProductName('');
    setCostPrice('');
    setSellPrice('');
    setMinAlert('5');
    setSimpleQty('');
    setBarcode('');
    setUnit('قطعة');
    setAttributes([]);
    setQuantities({});
    setIsSuccess(false);
  };

  const handleCategoryChange = (id: string) => {
    setCategory(id);
    if (id === 'clothing') {
      setAttributes([{ name: 'المقاس', values: SIZES_CLOTHING }]);
    } else if (id === 'shoes') {
      setAttributes([{ name: 'المقاس', values: SIZES_SHOES }]);
    } else if (id === 'custom') {
      setAttributes([]);
    } else {
      setAttributes([]);
    }
    setQuantities({});
  };

  const addAttribute = () => {
    setAttributes([...attributes, { name: 'خاصية جديدة', values: [] }]);
  };

  const removeAttribute = (index: number) => {
    setAttributes(attributes.filter((_, i) => i !== index));
  };

  const updateAttributeName = (index: number, name: string) => {
    const newAttrs = [...attributes];
    newAttrs[index].name = name;
    setAttributes(newAttrs);
  };

  const addAttributeValue = (index: number, value: string) => {
    if (!value.trim()) return;
    const newAttrs = [...attributes];
    if (!newAttrs[index].values.includes(value.trim())) {
      newAttrs[index].values.push(value.trim());
      setAttributes(newAttrs);
    }
  };

  const removeAttributeValue = (attrIndex: number, valIndex: number) => {
    const newAttrs = [...attributes];
    newAttrs[attrIndex].values.splice(valIndex, 1);
    setAttributes(newAttrs);
  };

  // Matrix Generation logic
  const matrixCombinations = useMemo(() => {
    if (attributes.length === 0 || attributes.every(a => a.values.length === 0)) return [];
    const arrays = attributes.map(a => a.values);
    return cartesian(arrays);
  }, [attributes]);

  const totalMatrixQty = useMemo(() => {
    return Object.values(quantities).reduce((acc, q) => acc + (Number(q) || 0), 0);
  }, [quantities]);

  const profitMargin = useMemo(() => {
    const cp = Number(costPrice);
    const sp = Number(sellPrice);
    if (!cp || !sp) return null;
    const margin = ((sp - cp) / sp) * 100;
    return margin.toFixed(1);
  }, [costPrice, sellPrice]);

  const handleSave = () => {
    if (!productName.trim()) {
      showToast('يرجى إدخال اسم المنتج', 'error');
      return;
    }
    if (!costPrice || !sellPrice) {
      showToast('يرجى إدخال السعر', 'error');
      return;
    }

    const finalQty = category === 'simple' ? Number(simpleQty) : totalMatrixQty;
    
    // Generate variants
    const variants = category !== 'simple' ? matrixCombinations.map((combo) => {
      const sku = generateSKU(productName.slice(0, 5), combo);
      const attrsSnap: Record<string, string> = {};
      attributes.forEach((a, i) => {
        attrsSnap[a.name] = combo[i];
      });
      return {
        id: `v-${Date.now()}-${sku}`,
        sku,
        attributes: attrsSnap,
        quantity: Number(quantities[sku]) || 0,
        size: combo[0], // backward compatibility
      };
    }) : undefined;

    const productData = {
      tenantId: tid,
      name: productName,
      category: 'عام', // Standard category placeholder
      productType: category as Product['productType'],
      unit,
      costPrice: Number(costPrice),
      sellingPrice: Number(sellPrice),
      quantity: finalQty,
      minQuantity: Number(minAlert),
      barcode,
      isActive: true,
      variants,
      attributeConfig: category !== 'simple' ? attributes : undefined
    };

    if (editProduct) {
      updateProduct(editProduct.id, productData);
      showToast('تم تحديث المنتج بنجاح', 'success');
    } else {
      const itemCode = generateItemCode(products);
      addProduct({
        ...productData,
        id: `p-${Date.now()}`,
        itemCode
      });
      showToast('تم إضافة المنتج بنجاح', 'success');
    }

    setIsSuccess(true);
    setTimeout(() => {
      onClose();
      setIsSuccess(false);
    }, 1500);
  };

  const handleRandomFill = () => {
    const randomID = Math.floor(Math.random() * 9000) + 1000;
    setProductName(`منتج تجريبي ${randomID}`);
    setCostPrice('100');
    setSellPrice('150');
    if (category === 'simple') setSimpleQty('50');
    setBarcode(`BCL-${randomID}`);
    showToast('تمت التعبئة العشوائية 🧪', 'success');
  };

  return (
    <SlideOver isOpen={isOpen} onClose={onClose} title="" width="max-w-2xl" hideHeader>
      {/* Custom Header */}
      <div className="bg-gradient-to-r from-[#6C3FC5] to-[#9B6FE0] px-6 py-5 flex items-center justify-between sticky top-0 z-10 -mx-6 -mt-5 mb-5 shadow-lg">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          {editProduct ? 'تعديل المنتج' : 'إضافة منتج جديد'}
        </h2>
        <button 
          onClick={onClose}
          className="w-10 h-10 rounded-xl bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition-all backdrop-blur-sm"
        >
          <X size={20} />
        </button>
      </div>

      <div className="space-y-6 pb-20">
        {/* Dev Mode Banner */}
        {!editProduct && (
          <div className="bg-[#FFF8ED] border border-[#F5A623] p-4 rounded-xl flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center text-[#F5A623]">
                <Wand2 size={18} />
              </div>
              <span className="text-sm font-bold text-amber-900">وضع التجريب والتطوير</span>
            </div>
            <button 
              onClick={handleRandomFill}
              className="bg-[#6C3FC5] text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-[#562fa3] transition-colors shadow-sm active:scale-95"
            >
              ✏️ تعبئة عشوائية
            </button>
          </div>
        )}

        {/* Category Selection */}
        <div className="space-y-3">
          <label className="text-sm font-bold text-gray-700 flex items-center gap-1.5">
            <Package size={16} className="text-[#6C3FC5]" />
            اختيار فئة المنتج
          </label>
          <div className="grid grid-cols-2 gap-3">
            {CATEGORIES.map((cat) => {
              const Icon = cat.icon;
              const isSelected = category === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => handleCategoryChange(cat.id)}
                  className={`flex items-center justify-between p-4 rounded-2xl border-2 transition-all group ${
                    isSelected 
                    ? 'border-[#6C3FC5] bg-[#EDE8FA] text-[#6C3FC5] shadow-md' 
                    : 'border-gray-100 bg-white text-gray-500 hover:border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-xl transition-colors ${isSelected ? 'bg-white shadow-sm' : 'bg-gray-50'}`}>
                      <Icon size={20} />
                    </div>
                    <span className="font-bold text-sm tracking-tight">{cat.label}</span>
                  </div>
                  {isSelected && <Check size={18} className="text-[#6C3FC5]" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Basic Fields */}
        <div className="space-y-4">
          <div>
            <label className="text-[13px] font-bold text-gray-700 mb-1.5 block">
              اسم المنتج <span className="text-[#6C3FC5]">*</span>
            </label>
            <input 
              type="text"
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
              placeholder="مثال: قميص قطني فاخر"
              className="w-full px-4 py-3 rounded-xl border-[1.5px] border-[#E2DCF0] focus:border-[#6C3FC5] focus:ring-4 focus:ring-[#EDE8FA] outline-none transition-all text-right dir-rtl font-medium text-gray-900"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="relative">
              <label className="text-[13px] font-bold text-gray-700 mb-1.5 block">
                سعر التكلفة <span className="text-[#6C3FC5]">*</span>
              </label>
              <div className="relative">
                <input 
                  type="number"
                  value={costPrice}
                  onChange={(e) => setCostPrice(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border-[1.5px] border-[#E2DCF0] focus:border-[#6C3FC5] focus:ring-4 focus:ring-[#EDE8FA] outline-none transition-all text-left font-mono"
                  dir="ltr"
                />
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400">د.ل</span>
              </div>
            </div>
            <div className="relative">
              <label className="text-[13px] font-bold text-gray-700 mb-1.5 block">
                سعر البيع <span className="text-[#6C3FC5]">*</span>
              </label>
              <div className="relative">
                <input 
                  type="number"
                  value={sellPrice}
                  onChange={(e) => setSellPrice(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border-[1.5px] border-[#E2DCF0] focus:border-[#6C3FC5] focus:ring-4 focus:ring-[#EDE8FA] outline-none transition-all text-left font-mono"
                  dir="ltr"
                />
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400">د.ل</span>
              </div>
            </div>
          </div>

          {profitMargin && (
            <div className="bg-[#F7F6FB] p-3 rounded-xl flex items-center justify-between border border-[#E2DCF0]/50 animate-in fade-in slide-in-from-top-2">
              <span className="text-xs font-bold text-gray-500 tracking-wide">مؤشر هامش الربح التقريبي:</span>
              <span className={`text-sm font-black flex items-center gap-1.5 ${Number(profitMargin) > 0 ? 'text-[#22C55E]' : 'text-[#EF4444]'}`}>
                {Number(profitMargin) > 0 ? '+' : ''}{profitMargin}%
                <span className="text-[10px] bg-white px-2 py-0.5 rounded-full border border-current opacity-70">Margin</span>
              </span>
            </div>
          )}
        </div>

        {/* Dynamic Features Engine */}
        <div className="space-y-4 pt-4 border-t border-gray-100">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
              <Sparkles size={16} className="text-[#6C3FC5]" />
              {category === 'simple' ? 'إدارة المخزون البسيط' : 'محرك الخصائص الديناميكي'}
            </h3>
            {category !== 'simple' && (
              <div className="flex items-center gap-2 bg-[#F0FDF4] px-3 py-1.5 rounded-full border border-emerald-100 shadow-sm">
                <span className="text-xs font-bold text-emerald-700">الإجمالي:</span>
                <span className="text-xs font-black text-emerald-800 bg-white min-w-[24px] h-6 flex items-center justify-center rounded-full shadow-sm">
                  {totalMatrixQty}
                </span>
                <span className="text-[10px] text-emerald-600">قطعة</span>
              </div>
            )}
          </div>

          {category === 'simple' ? (
            <div>
              <label className="text-[13px] font-bold text-gray-700 mb-1.5 block">الكمية الحالية <span className="text-[#6C3FC5]">*</span></label>
              <input 
                type="number"
                value={simpleQty}
                onChange={(e) => setSimpleQty(e.target.value)}
                placeholder="أدخل الرصيد الافتتاحي"
                className="w-full px-4 py-3 rounded-xl border-[1.5px] border-[#E2DCF0] focus:border-[#6C3FC5] focus:ring-4 focus:ring-[#EDE8FA] outline-none transition-all text-right dir-rtl font-mono"
              />
            </div>
          ) : (
            <div className="space-y-4">
              {attributes.map((attr, idx) => (
                <div key={idx} className="bg-white border border-[#E2DCF0] rounded-2xl p-5 space-y-4 shadow-sm relative group overflow-hidden">
                  <div className="flex items-center justify-between">
                    <input 
                      type="text" 
                      value={attr.name} 
                      onChange={(e) => updateAttributeName(idx, e.target.value)}
                      className="text-sm font-bold text-[#6C3FC5] outline-none border-b-2 border-transparent focus:border-[#6C3FC5] bg-transparent min-w-[120px]"
                    />
                    <button 
                      onClick={() => removeAttribute(idx)}
                      className="text-gray-400 hover:text-red-500 transition-colors p-1"
                    >
                      <Trash2 size={16} />
                    </button>
                    <div className="absolute top-0 right-0 w-1 h-full bg-[#6C3FC5] opacity-20" />
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {attr.values.map((val, vIdx) => (
                      <span 
                        key={vIdx} 
                        className="bg-[#EDE8FA] text-[#6C3FC5] px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 border border-[#6C3FC5]/10 animate-in zoom-in-95 duration-200"
                      >
                        {val}
                        <button onClick={() => removeAttributeValue(idx, vIdx)} className="hover:text-red-500">
                          <X size={12} />
                        </button>
                      </span>
                    ))}
                  </div>

                  <div className="flex gap-2 pt-2">
                    <input 
                      type="text" 
                      placeholder="أضف قيمة... (مثال: أحمر)" 
                      className="flex-1 bg-gray-50 border-b-2 border-[#E2DCF0] focus:border-[#6C3FC5] outline-none px-3 py-2 text-sm transition-all rounded-t-lg"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          addAttributeValue(idx, (e.target as HTMLInputElement).value);
                          (e.target as HTMLInputElement).value = '';
                        }
                      }}
                    />
                    <button 
                      onClick={(e) => {
                        const input = (e.currentTarget.previousSibling as HTMLInputElement);
                        addAttributeValue(idx, input.value);
                        input.value = '';
                      }}
                      className="bg-[#6C3FC5] text-white p-2 rounded-xl"
                    >
                      <Plus size={18} />
                    </button>
                  </div>
                </div>
              ))}

              <button 
                onClick={addAttribute}
                className="w-full py-4 border-2 border-dashed border-[#9B6FE0] text-[#9B6FE0] rounded-2xl flex items-center justify-center gap-2 hover:bg-[#EDE8FA]/30 transition-all font-bold text-sm"
              >
                <Plus size={18} />
                إضافة خاصية جديدة
              </button>

              {/* Matrix Table */}
              {matrixCombinations.length > 0 && matrixCombinations[0].length > 0 && (
                <div className="space-y-4 pt-6 animate-in fade-in slide-in-from-bottom-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-1.5 h-4 bg-[#6C3FC5] rounded-full" />
                    <h4 className="text-sm font-bold text-gray-800 tracking-tight">جدول الكميات الديناميكي</h4>
                  </div>
                  
                  <div className="overflow-x-auto rounded-2xl border border-[#E2DCF0] shadow-sm">
                    <table className="w-full text-sm text-right">
                      <thead className="bg-[#F7F6FB] text-gray-500 font-bold border-b border-[#E2DCF0]">
                        <tr>
                          {attributes.map((a, i) => <th key={i} className="px-4 py-3">{a.name}</th>)}
                          <th className="px-4 py-3 text-center w-32 font-black text-[#6C3FC5]">الكمية</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {matrixCombinations.map((combo, cIdx) => {
                          const sku = generateSKU(productName.slice(0, 5), combo);
                          return (
                            <tr key={cIdx} className={`${cIdx % 2 === 0 ? 'bg-white' : 'bg-[#F9FAFB]'} hover:bg-[#EDE8FA]/20 transition-colors`}>
                              {combo.map((val, vIdx) => <td key={vIdx} className="px-4 py-3 font-medium text-gray-700">{val}</td>)}
                              <td className="px-4 py-3 flex justify-center">
                                <input 
                                  type="number"
                                  min="0"
                                  value={quantities[sku] || ''}
                                  onChange={(e) => setQuantities({...quantities, [sku]: e.target.value})}
                                  className="w-20 px-2 py-1.5 text-center border-2 border-[#E2DCF0] rounded-xl focus:border-[#6C3FC5] focus:ring-4 focus:ring-[#EDE8FA] outline-none transition-all font-mono font-bold"
                                />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  <div className="bg-[#EDE8FA] p-4 rounded-2xl flex items-center justify-between border border-[#6C3FC5]/10 shadow-inner">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[10px] uppercase tracking-widest font-black text-[#6C3FC5]/60">Summary</span>
                      <span className="text-sm font-bold text-[#6C3FC5]">إجمالي الكمية الكلية</span>
                    </div>
                    <div className="bg-white px-5 py-2 rounded-xl shadow-sm border border-[#6C3FC5]/20 flex items-center gap-2">
                      <span className="text-xl font-black text-[#6C3FC5]">{totalMatrixQty}</span>
                      <span className="text-xs font-bold text-[#6C3FC5]/60">{unit}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Barcode and Unit */}
        <div className="grid grid-cols-2 gap-4 pt-6 border-t border-gray-100">
          <div>
            <label className="text-[13px] font-bold text-gray-700 mb-1.5 block">وحدة القياس</label>
            <select 
              value={unit} 
              onChange={(e) => setUnit(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border-[1.5px] border-[#E2DCF0] focus:border-[#6C3FC5] focus:ring-4 focus:ring-[#EDE8FA] outline-none transition-all appearance-none bg-white font-medium text-gray-800"
            >
              <option>قطعة</option>
              <option>كيلو</option>
              <option>لتر</option>
              <option>متر</option>
              <option>علبة</option>
            </select>
          </div>
          <div>
            <label className="text-[13px] font-bold text-gray-700 mb-1.5 block">الباركود (اختياري)</label>
            <input 
              type="text"
              value={barcode}
              onChange={(e) => setBarcode(e.target.value)}
              placeholder="امسح الباركود"
              className="w-full px-4 py-3 rounded-xl border-[1.5px] border-[#E2DCF0] focus:border-[#6C3FC5] focus:ring-4 focus:ring-[#EDE8FA] outline-none transition-all text-left font-mono"
              dir="ltr"
            />
          </div>
        </div>

        {/* Alert Threshold */}
        <div>
          <label className="text-[13px] font-bold text-gray-700 mb-1.5 flex justify-between">
            الحد الأدنى للتنبيه
            <span className="text-[10px] text-gray-400 font-normal self-center">تلقائي: 5</span>
          </label>
          <input 
            type="number"
            value={minAlert}
            onChange={(e) => setMinAlert(e.target.value)}
            className="w-full px-4 py-3 rounded-xl border-[1.5px] border-[#E2DCF0] focus:border-[#6C3FC5] focus:ring-4 focus:ring-[#EDE8FA] outline-none transition-all text-right dir-rtl font-mono"
          />
        </div>
      </div>

      {/* Action Buttons */}
      <div className="fixed bottom-0 left-0 right-0 p-6 bg-white border-t border-gray-100 grid grid-cols-[1fr_2fr] gap-4 z-20 shadow-[0_-10px_20px_-5px_rgba(0,0,0,0.05)]">
        <button 
          onClick={onClose}
          className="py-4 rounded-xl bg-[#F7F6FB] border border-[#E2DCF0] text-[#8B7BAD] font-bold hover:bg-gray-100 transition-all active:scale-95"
        >
          إلغاء
        </button>
        <button 
          onClick={handleSave}
          disabled={isSuccess}
          className={`py-4 rounded-xl font-black text-white shadow-lg transition-all active:scale-[0.98] ${
            isSuccess 
            ? 'bg-[#22C55E] scale-[0.98]' 
            : 'bg-gradient-to-r from-[#6C3FC5] to-[#9B6FE0] hover:shadow-[#6C3FC5]/30'
          }`}
        >
          {isSuccess ? (
            <span className="flex items-center justify-center gap-2 animate-in zoom-in-90">
              <Check size={20} />
              تمت الإضافة بنجاح!
            </span>
          ) : (
            editProduct ? 'حفظ التعديلات' : 'إضافة المنتج للمخزون'
          )}
        </button>
      </div>
    </SlideOver>
  );
}
