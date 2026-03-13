"use client";

import { useState, useMemo, useEffect } from "react";
import {
  X,
  Package,
  Plus,
  Trash2,
  Check,
  AlertTriangle,
  Footprints,
  Sparkles,
  ChevronLeft,
  ChevronDown,
  Search,
  AlertCircle,
  BadgeDollarSign,
  Boxes,
} from "lucide-react";
import { useDataStore } from "@/core/db/store";
import { useAuthStore } from "@/core/auth/store";
import { useToast } from "./Toast";
import { generateSKU, cartesian, generateItemCode } from "@/core/utils";
import { formatCurrency } from "@/shared/utils/format";
import type { Product, ProductVariant } from "@/core/types";

interface AddProductSlideOverProps {
  isOpen: boolean;
  onClose: () => void;
  editProduct?: Product | null;
}

// فئات النوع الجوهري productType
const DEFAULT_CATEGORY_OPTS: {
  label: string;
  type: "simple" | "clothing" | "shoes" | "custom";
}[] = [
  { label: "عادي", type: "simple" },
  { label: "ملابس", type: "clothing" },
  { label: "أحذية", type: "shoes" },
];

const SIZES_CLOTHING = ["S", "M", "L", "XL", "XXL"];
const SIZES_SHOES = ["38", "39", "40", "41", "42", "43", "44", "45"];

export function AddProductSlideOver({
  isOpen,
  onClose,
  editProduct,
}: AddProductSlideOverProps) {
  const { user } = useAuthStore();
  const isOwner = user?.role === "owner";
  const { products, treasury, getForTenant, addProduct, updateProduct, customCategories: storeCustomCategories, addCustomCategory, customUnits: storeCustomUnits, addCustomUnit } =
    useDataStore();
  const { showToast } = useToast();
  const tid = user?.tenantId || "";

  const [category, setCategory] = useState<string>("simple");
  const [productName, setProductName] = useState("");
  const [costPrice, setCostPrice] = useState("");
  const [sellPrice, setSellPrice] = useState("");
  const [minAlert, setMinAlert] = useState("5");
  const [simpleQty, setSimpleQty] = useState("1");
  const [barcode, setBarcode] = useState("");
  const [unit, setUnit] = useState("قطعة");
  const [attributes, setAttributes] = useState<
    { name: string; values: string[] }[]
  >([]);
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [isSuccess, setIsSuccess] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // ━━━ حاسبة تكلفة الاستيراد ━━━
  const [showCalc, setShowCalc] = useState(false);
  const [calcInvoice, setCalcInvoice] = useState("");
  const [calcQty, setCalcQty] = useState("");
  const [calcExchange, setCalcExchange] = useState("");
  const [calcShipping, setCalcShipping] = useState("");
  const [calcCommType, setCalcCommType] = useState<"fixed" | "percent">("fixed");
  const [calcCommVal, setCalcCommVal] = useState("");

  const calculateImportCost = () => {
    const inv = Number(calcInvoice);
    const qty = Number(calcQty);
    const exch = Number(calcExchange);
    const ship = Number(calcShipping);
    const commVal = Number(calcCommVal);

    if (!inv || !qty || !exch || !ship) return null;

    const totalUSD = inv + ship;
    const totalLYD = totalUSD * exch;
    const commission = calcCommType === "fixed" ? commVal : totalLYD * (commVal / 100);
    
    return Math.round((totalLYD + commission) / qty);
  };
  const currentCalcResult = calculateImportCost();
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  // Combobox state
  const [catSearch, setCatSearch] = useState("");
  const [catOpen, setCatOpen] = useState(false);
  const [isAddingNewCat, setIsAddingNewCat] = useState(false);
  const [newCatName, setNewCatName] = useState("");

  // Unit Combobox state
  const [unitSearch, setUnitSearch] = useState("");
  const [unitOpen, setUnitOpen] = useState(false);
  const [isAddingNewUnit, setIsAddingNewUnit] = useState(false);
  const [newUnitName, setNewUnitName] = useState("");

  // Initialize form when editing or opening
  useEffect(() => {
    if (editProduct) {
      setCategory(editProduct.productType || "simple");
      setProductName(editProduct.name);
      setCostPrice(String(editProduct.costPrice));
      setSellPrice(String(editProduct.sellingPrice));
      setMinAlert(String(editProduct.minQuantity));
      setUnit(editProduct.unit);
      setBarcode(editProduct.barcode || "");

      if (editProduct.productType !== "simple") {
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
    setCategory("simple");
    setProductName("");
    setCostPrice("");
    setSellPrice("");
    setMinAlert("5");
    setSimpleQty("1");
    setBarcode("");
    setUnit("قطعة");
    setAttributes([]);
    setQuantities({});
    setIsSuccess(false);
  };

  const handleCategoryChange = (
    type: "simple" | "clothing" | "shoes" | "custom",
  ) => {
    setCategory(type);
    if (type === "clothing") {
      setAttributes([{ name: "المقاس", values: SIZES_CLOTHING }]);
    } else if (type === "shoes") {
      setAttributes([{ name: "المقاس", values: SIZES_SHOES }]);
    } else {
      setAttributes([]);
    }
    setQuantities({});
  };

  const addAttribute = () => {
    if (attributes.some(attr => attr.name === "")) {
      showToast("يوجد خاصية بهذا الاسم مسبقاً، غيّر الاسم أولاً", "error");
      return;
    }
    setAttributes([...attributes, { name: "", values: [] }]);
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
  const validAttributes = useMemo(() => attributes.filter((a) => a.values.length > 0), [attributes]);

  const matrixCombinations = useMemo(() => {
    if (validAttributes.length === 0) return [];
    const arrays = validAttributes.map((a) => a.values);
    return cartesian(arrays);
  }, [validAttributes]);

  const totalMatrixQty = useMemo(() => {
    if (category === "simple") return 0;
    return matrixCombinations.reduce((acc, combo) => {
      const sku = generateSKU(productName.slice(0, 5), combo);
      return acc + (Number(quantities[sku]) || 0);
    }, 0);
  }, [matrixCombinations, quantities, productName, category]);

  const profitMargin = useMemo(() => {
    const cp = Number(costPrice);
    const sp = Number(sellPrice);
    if (!cp || !sp) return null;
    const margin = ((sp - cp) / sp) * 100;
    return margin.toFixed(1);
  }, [costPrice, sellPrice]);

  // المراقب المالي للمنتج البسيط
  const availableTreasury = useMemo(() => {
    const myTreasury = getForTenant(treasury, tid);
    return myTreasury
      .filter((a) => a.accountType === "cash_in_hand")
      .reduce((s, a) => s + a.balance, 0);
  }, [treasury, tid, getForTenant]);
  const simpleInitCost = Number(simpleQty) * Number(costPrice);
  const variantInitCost = totalMatrixQty * Number(costPrice);
  const isTreasuryInsufficient =
    category === "simple"
      ? simpleInitCost > 0 && simpleInitCost > availableTreasury
      : variantInitCost > 0 && variantInitCost > availableTreasury;

  // فئات الكومبوبوكس المدمجة
  const allCatOpts = useMemo(() => {
    const defaults = DEFAULT_CATEGORY_OPTS.map((d) => d.label);
    const storeCats = storeCustomCategories[tid] || [];
    return Array.from(new Set([...defaults, ...storeCats]));
  }, [storeCustomCategories, tid]);

  const filteredCatOpts = useMemo(
    () => allCatOpts.filter((c) => c.includes(catSearch)),
    [allCatOpts, catSearch],
  );

  const catLabel = useMemo(() => {
    const found = DEFAULT_CATEGORY_OPTS.find((d) => d.type === category);
    if (found) return found.label;
    const storeCats = storeCustomCategories[tid] || [];
    return storeCats.find((c) => c === category) || category;
  }, [category, storeCustomCategories, tid]);

  const pickCategory = (label: string) => {
    const found = DEFAULT_CATEGORY_OPTS.find((d) => d.label === label);
    if (found) {
      handleCategoryChange(found.type);
    } else {
      handleCategoryChange("custom");
      setCategory(label);
    }
    setCatSearch("");
    setCatOpen(false);
    setIsAddingNewCat(false);
    setNewCatName("");
  };

  const DEFAULT_UNIT_OPTS = ["قطعة", "كيلو", "لتر", "متر", "علبة"];
  
  const allUnitOpts = useMemo(() => {
    return [...DEFAULT_UNIT_OPTS, ...storeCustomUnits];
  }, [storeCustomUnits]);

  const filteredUnitOpts = useMemo(
    () => allUnitOpts.filter((c) => c.includes(unitSearch)),
    [allUnitOpts, unitSearch]
  );

  const pickUnit = (label: string) => {
    if (!DEFAULT_UNIT_OPTS.includes(label) && !storeCustomUnits.includes(label)) {
      addCustomUnit(label);
    }
    setUnit(label);
    setUnitSearch("");
    setUnitOpen(false);
    setIsAddingNewUnit(false);
    setNewUnitName("");
  };

  const handleSave = () => {
    if (!productName.trim()) {
      showToast("يرجى إدخال اسم المنتج", "error");
      return;
    }
    if (!costPrice || !sellPrice) {
      showToast("يرجى إدخال السعر", "error");
      return;
    }

    if (category !== "simple") {
      const names = attributes.map((a) => a.name.trim()).filter((n) => n !== "");
      const hasDuplicates = names.some((name, index) => names.indexOf(name) !== index);
      if (hasDuplicates) {
        showToast("يوجد خاصيتان بنفس الاسم، يرجى تعديلهما", "error");
        return;
      }
    }

    const finalQty = category === "simple" ? Number(simpleQty) : totalMatrixQty;

    const variants =
      category !== "simple"
        ? matrixCombinations.map((combo) => {
            const sku = generateSKU(productName.slice(0, 5), combo);
            const attrsSnap: Record<string, string> = {};
            validAttributes.forEach((a, i) => {
              attrsSnap[a.name] = combo[i];
            });
            return {
              id: `v-${Date.now()}-${sku}`,
              sku,
              attributes: attrsSnap,
              quantity: Number(quantities[sku]) || 0,
              size: combo[0],
            };
          })
        : undefined;

    const isBuiltIn = ["simple", "clothing", "shoes"].includes(category);
    
    if (!isBuiltIn && category !== "custom") {
      addCustomCategory(category, tid);
    }

    const productData = {
      tenantId: tid,
      name: productName,
      category: isBuiltIn ? "عام" : category,
      productType: (isBuiltIn ? category : "custom") as Product["productType"],
      unit,
      costPrice: Number(costPrice),
      sellingPrice: Number(sellPrice),
      quantity: finalQty,
      minQuantity: Number(minAlert),
      barcode,
      isActive: true,
      variants,
      attributeConfig: category !== "simple" ? attributes : undefined,
    };

    if (editProduct) {
      updateProduct(editProduct.id, productData);
      showToast("تم تحديث المنتج بنجاح", "success");
    } else {
      const itemCode = generateItemCode(products);
      const totalCost = category === "simple" ? simpleInitCost : variantInitCost;
      addProduct({
        ...productData,
        id: `p-${Date.now()}`,
        itemCode,
      });
      showToast(`تم إضافة "${productName}" بنجاح ✅ — خُصم ${totalCost} د.ل من الخزينة`, "success");
    }

    setIsSuccess(true);
    setShowConfirm(false);
    setTimeout(() => {
      onClose();
      setIsSuccess(false);
    }, 1500);
  };

  const preSaveCheck = () => {
    if (!productName.trim()) {
      showToast("يرجى إدخال اسم المنتج", "error");
      return;
    }
    if (!costPrice || !sellPrice) {
      showToast("يرجى إدخال السعر", "error");
      return;
    }
    if (editProduct) {
      handleSave();
    } else {
      setShowConfirm(true);
    }
  };


  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div className="fixed inset-0 z-[100] bg-black/50" onClick={onClose} />
      )}

      {/* Side Panel Wrapper */}
      <div className={`fixed top-0 right-0 h-full z-[101] w-full max-w-xl bg-white shadow-2xl flex flex-col overflow-y-auto transition-transform duration-300 ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="relative h-full flex flex-col pointer-events-auto">
          {/* Header */}
          <div className="flex items-center px-6 py-4 border-b border-gray-100">
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg bg-gray-50 hover:bg-gray-100 flex items-center justify-center text-gray-500 transition-colors"
            >
              <X size={18} />
            </button>
            <h2 className="text-lg font-bold text-gray-900 ml-auto">
              {editProduct ? "تعديل المنتج" : "إضافة منتج جديد"}
            </h2>
          </div>

          {/* Scrollable body */}
          <div className="overflow-y-auto px-6 py-5 space-y-6 max-h-[75vh]">


          {/* Section 1: Product Information */}
          <div className="border border-gray-200 rounded-xl p-4 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
              <Package size={16} className="text-bunyan-600" />
              معلومات المنتج
            </h3>
            
            {/* Category Combobox */}
            <div className="space-y-2">
              <div className="flex items-center justify-between pointer-events-auto">
                <label className="text-xs font-bold text-gray-700 block">
                  فئة المنتج
                </label>
                {!isAddingNewCat && (
                  <button
                    type="button"
                    onClick={() => setIsAddingNewCat(true)}
                    className="text-[11px] font-bold text-bunyan-600 hover:text-bunyan-700 flex items-center gap-1 transition-colors"
                  >
                    <Plus size={12} /> إضافة فئة جديدة
                  </button>
                )}
              </div>

              {isAddingNewCat && (
                <div className="flex gap-2 mb-2 p-2 bg-gray-50 rounded-xl border border-gray-100">
                  <input
                    autoFocus
                    type="text"
                    value={newCatName}
                    onChange={(e) => setNewCatName(e.target.value)}
                    placeholder="اسم الفئة الجديدة"
                    className="flex-1 px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-bunyan-500 focus:ring-2 focus:ring-bunyan-500/30 bg-white text-right font-bold text-gray-800"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && newCatName.trim()) {
                        e.preventDefault();
                        pickCategory(newCatName.trim());
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (newCatName.trim()) {
                        pickCategory(newCatName.trim());
                      }
                    }}
                    className="bg-bunyan-600 text-white px-3 py-1.5 rounded-lg text-sm font-bold hover:bg-bunyan-700 transition-colors"
                  >
                    إضافة
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsAddingNewCat(false);
                      setNewCatName("");
                    }}
                    className="bg-gray-200 text-gray-700 px-3 py-1.5 rounded-lg text-sm font-bold hover:bg-gray-300 transition-colors"
                  >
                    إلغاء
                  </button>
                </div>
              )}

              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setCatOpen((o) => {
                      if (!o) {
                        setCatSearch("");
                      }
                      return !o;
                    });
                  }}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-xl border border-gray-200 bg-white text-right text-sm text-gray-800 hover:border-gray-300 transition-all focus:outline-none focus:ring-2 focus:ring-bunyan-500/30 focus:border-bunyan-500 font-bold"
                >
                  <span>{catLabel}</span>
                  <Check size={14} className={`text-gray-400 transition-transform ${catOpen ? "rotate-180" : ""}`} />
                </button>
                {catOpen && (
                  <div className="absolute z-50 top-full mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
                    <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-100">
                      <Search size={14} className="text-gray-400 shrink-0" />
                      <input
                        autoFocus
                        type="text"
                        value={catSearch}
                        onChange={(e) => setCatSearch(e.target.value)}
                        placeholder="ابحث عن فئة..."
                        className="flex-1 text-sm outline-none bg-transparent"
                      />
                    </div>
                    <ul className="max-h-48 overflow-y-auto">
                      {filteredCatOpts.map((opt) => (
                        <li key={opt}>
                          <button
                            type="button"
                            onClick={() => pickCategory(opt)}
                            className={`w-full text-right px-4 py-2 text-sm hover:bg-gray-50 transition-colors flex items-center justify-between ${
                              catLabel === opt
                                ? "bg-bunyan-50 text-bunyan-700 font-bold"
                                : "text-gray-700 font-medium"
                            }`}
                          >
                            {opt}
                            {catLabel === opt && (
                              <Check size={14} className="text-bunyan-600" />
                            )}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-700 mb-1.5 block">
                اسم المنتج <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                placeholder="مثال: قميص قطني فاخر"
                className="w-full px-3 py-2 rounded-xl border border-gray-200 focus:border-bunyan-500 focus:ring-2 focus:ring-bunyan-500/30 outline-none transition-all text-right text-sm text-gray-900"
              />
            </div>
          </div>

          <div className="bg-bunyan-50 border border-bunyan-200 rounded-xl p-4 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
              <BadgeDollarSign size={16} className="text-bunyan-600" />
              التسعير
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-gray-700 mb-1.5 block">
                  سعر التكلفة <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    value={costPrice}
                    onChange={(e) => setCostPrice(e.target.value)}
                    className="w-full pl-3 pr-10 py-2 rounded-xl border border-gray-200 focus:border-bunyan-500 focus:ring-2 focus:ring-bunyan-500/30 outline-none transition-all text-center text-sm font-bold"
                    dir="ltr"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400">
                    د.ل
                  </span>
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-gray-700 mb-1.5 block">
                  سعر البيع <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    value={sellPrice}
                    onChange={(e) => setSellPrice(e.target.value)}
                    className="w-full pl-3 pr-10 py-2 rounded-xl border border-gray-200 focus:border-bunyan-500 focus:ring-2 focus:ring-bunyan-500/30 outline-none transition-all text-center text-sm font-bold"
                    dir="ltr"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400">
                    د.ل
                  </span>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowCalc(!showCalc)}
              className="text-sm text-bunyan-600 hover:underline flex items-center gap-1 mr-auto mt-1"
            >
              <Sparkles size={14} />
              {showCalc ? "إغلاق الحاسبة" : "احسب من فاتورة الاستيراد"}
            </button>

            {showCalc && (
              <div className="mt-4 p-4 bg-white/60 rounded-xl border border-bunyan-100 space-y-4 animate-slide-down overflow-hidden">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-bold text-gray-500 mb-1 block">الفاتورة (USD)</label>
                    <input type="number" value={calcInvoice} onChange={e => setCalcInvoice(e.target.value)} className="w-full px-2 py-1.5 text-xs rounded-lg border border-gray-200 outline-none font-bold" placeholder="1000" />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-gray-500 mb-1 block">الكمية</label>
                    <input type="number" value={calcQty} onChange={e => setCalcQty(e.target.value)} className="w-full px-2 py-1.5 text-xs rounded-lg border border-gray-200 outline-none font-bold" placeholder="50" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-bold text-gray-500 mb-1 block">سعر الصرف</label>
                    <input type="number" value={calcExchange} onChange={e => setCalcExchange(e.target.value)} className="w-full px-2 py-1.5 text-xs rounded-lg border border-gray-200 outline-none font-bold" placeholder="7.13" />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-gray-500 mb-1 block">الشحن (USD)</label>
                    <input type="number" value={calcShipping} onChange={e => setCalcShipping(e.target.value)} className="w-full px-2 py-1.5 text-xs rounded-lg border border-gray-200 outline-none font-bold" placeholder="150" />
                  </div>
                </div>

                <div className="p-2.5 bg-gray-50/50 rounded-lg border border-gray-100">
                  <div className="flex items-center gap-3 mb-2">
                    <label className="flex items-center gap-1 text-[10px] text-gray-600 cursor-pointer">
                      <input type="radio" checked={calcCommType === 'fixed'} onChange={() => setCalcCommType('fixed')} className="accent-bunyan-600" /> قيمة
                    </label>
                    <label className="flex items-center gap-1 text-[10px] text-gray-600 cursor-pointer">
                      <input type="radio" checked={calcCommType === 'percent'} onChange={() => setCalcCommType('percent')} className="accent-bunyan-600" /> نسبة %
                    </label>
                  </div>
                  <input type="number" value={calcCommVal} onChange={e => setCalcCommVal(e.target.value)} className="w-full px-2 py-1.5 text-xs rounded-lg border border-gray-200 outline-none bg-white font-bold" placeholder="العمولة" />
                </div>

                {currentCalcResult !== null && (
                  <div className="p-2 bg-bunyan-100/50 rounded-lg text-center">
                    <p className="text-[10px] font-bold text-bunyan-700">التكلفة مكدّسة: <span className="text-sm">{formatCurrency(currentCalcResult)}</span></p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2 pt-1 border-t border-bunyan-100/50">
                  <button
                    onClick={() => setShowCalc(false)}
                    className="py-1.5 rounded-lg text-[11px] font-bold text-gray-500 hover:bg-gray-100"
                  >إلغاء</button>
                  <button
                    disabled={currentCalcResult === null}
                    onClick={() => {
                      if (currentCalcResult !== null) {
                        setCostPrice(String(currentCalcResult));
                        setShowCalc(false);
                      }
                    }}
                    className="py-1.5 rounded-lg text-[11px] font-bold bg-bunyan-600 text-white hover:bg-bunyan-700 disabled:opacity-50"
                  >تطبيق السعر</button>
                </div>
              </div>
            )}

            {isOwner && profitMargin && (
              <div className="bg-white/60 p-2.5 rounded-xl border border-bunyan-100 flex items-center justify-between">
                <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                  هامش الربح المتوقع
                </span>
                <span
                  className={`text-sm font-bold flex items-center gap-1 ${Number(profitMargin) > 0 ? "text-emerald-600" : "text-red-500"}`}
                >
                  {Number(profitMargin) > 0 ? "+" : ""}
                  {profitMargin}%
                </span>
              </div>
            )}
          </div>

          {/* Section 3: Inventory Management */}
          <div className="border border-gray-200 rounded-xl p-4 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
              <Boxes size={16} className="text-bunyan-600" />
              إدارة المخزون
            </h3>

            {category === "simple" && (
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-bold text-gray-700 mb-1.5 block">
                    الكمية الافتتاحية <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    value={simpleQty}
                    onChange={(e) => setSimpleQty(e.target.value)}
                    placeholder="0"
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 focus:border-bunyan-500 focus:ring-2 focus:ring-bunyan-500/30 outline-none transition-all text-center font-bold text-sm text-gray-900"
                  />
                </div>
                {simpleInitCost > 0 && (
                  <div className={`p-3 rounded-xl border ${isTreasuryInsufficient ? "bg-red-50 border-red-200" : "bg-gray-50 border-gray-200"}`}>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-xs font-bold text-gray-700">إجمالي التكلفة:</span>
                      <span className={`text-sm font-bold font-currency ${isTreasuryInsufficient ? "text-red-700" : "text-gray-900"}`}>
                        {formatCurrency(simpleInitCost)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-gray-500">الرصيد المتاح:</span>
                      <span className={`font-bold font-currency ${isTreasuryInsufficient ? "text-red-600" : "text-emerald-600"}`}>
                        {formatCurrency(availableTreasury)}
                      </span>
                    </div>
                    {isTreasuryInsufficient && (
                      <p className="text-red-600 text-[11px] mt-2 pt-2 border-t border-red-200 font-bold flex items-center gap-1">
                        <AlertCircle size={12} /> التكلفة {formatCurrency(simpleInitCost)} تتجاوز الرصيد {formatCurrency(availableTreasury)} — يلزم {formatCurrency(simpleInitCost - availableTreasury)} إضافية
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              {/* Unit Combobox */}
              <div>
                <label className="text-xs font-bold text-gray-700 mb-1.5 block">
                  وحدة القياس
                </label>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => {
                      setUnitOpen((o) => {
                        if (!o) {
                          setIsAddingNewUnit(false);
                          setNewUnitName("");
                          setUnitSearch("");
                        }
                        return !o;
                      });
                    }}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-xl border border-gray-200 bg-white text-right text-sm text-gray-800 hover:border-gray-300 transition-all focus:outline-none focus:ring-2 focus:ring-bunyan-500/30 focus:border-bunyan-500 font-bold"
                  >
                    <span>{unit}</span>
                    <ChevronDown size={14} className={`text-gray-400 transition-transform ${unitOpen ? "rotate-180" : ""}`} />
                  </button>
                  {unitOpen && (
                    <div className="absolute z-50 top-full mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
                      <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-100">
                        <Search size={14} className="text-gray-400 shrink-0" />
                        <input
                          autoFocus
                          type="text"
                          value={unitSearch}
                          onChange={(e) => setUnitSearch(e.target.value)}
                          placeholder="ابحث عن وحدة..."
                          className="flex-1 text-sm outline-none bg-transparent"
                        />
                      </div>
                      <ul className="max-h-48 overflow-y-auto">
                        {filteredUnitOpts.map((opt) => (
                          <li key={opt}>
                            <button
                              type="button"
                              onClick={() => pickUnit(opt)}
                              className={`w-full text-right px-4 py-2 text-sm hover:bg-gray-50 transition-colors flex items-center justify-between ${
                                unit === opt
                                  ? "bg-bunyan-50 text-bunyan-700 font-bold"
                                  : "text-gray-700 font-medium"
                              }`}
                            >
                              {opt}
                              {unit === opt && <Check size={14} className="text-bunyan-600" />}
                            </button>
                          </li>
                        ))}
                        {filteredUnitOpts.length === 0 && !unitSearch.trim() && (
                          <li className="px-4 py-3 text-xs text-center text-gray-400">لا توجد وحدات</li>
                        )}
                        {isAddingNewUnit ? (
                          <li className="p-2 border-t border-gray-100 bg-gray-50">
                            <div className="flex gap-2">
                              <input
                                autoFocus
                                type="text"
                                value={newUnitName}
                                onChange={(e) => setNewUnitName(e.target.value)}
                                placeholder="اسم الوحدة..."
                                className="flex-1 px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-bunyan-500 bg-white text-right"
                                onKeyDown={(e) => {
                                  if (e.key === "Enter" && newUnitName.trim()) {
                                    e.preventDefault();
                                    pickUnit(newUnitName.trim());
                                  }
                                }}
                              />
                              <button type="button" onClick={() => newUnitName.trim() && pickUnit(newUnitName.trim())} className="bg-bunyan-600 text-white px-3 py-1.5 rounded-lg text-sm font-bold hover:bg-bunyan-700">
                                إضافة
                              </button>
                            </div>
                          </li>
                        ) : (
                          <li className="border-t border-gray-100 p-1">
                            <button type="button" onClick={() => setIsAddingNewUnit(true)} className="w-full text-right px-3 py-2 text-sm font-bold text-bunyan-600 hover:bg-bunyan-50 rounded-lg transition-colors flex items-center gap-2">
                              <Plus size={14} /> إضافة وحدة جديدة
                            </button>
                          </li>
                        )}
                      </ul>
                    </div>
                  )}
                </div>
              </div>

              {/* Barcode */}
              <div>
                <label className="text-xs font-bold text-gray-700 mb-1.5 block">
                  الباركود (اختياري)
                </label>
                <input
                  type="text"
                  value={barcode}
                  onChange={(e) => setBarcode(e.target.value)}
                  placeholder="امسح الباركود"
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 focus:border-bunyan-500 focus:ring-2 focus:ring-bunyan-500/30 outline-none transition-all text-left font-mono text-sm"
                  dir="ltr"
                />
              </div>
            </div>

            {/* Alert Threshold */}
            <div>
              <label className="text-xs font-bold text-gray-700 mb-1.5 flex justify-between">
                <span>الحد الأدنى للتنبيه</span>
                <span className="text-[10px] text-gray-400 font-normal">تلقائي: 5</span>
              </label>
              <input
                type="number"
                value={minAlert}
                onChange={(e) => setMinAlert(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-gray-200 focus:border-bunyan-500 focus:ring-2 focus:ring-bunyan-500/30 outline-none transition-all text-center font-bold text-sm"
              />
            </div>
          </div>

          {/* Section 4: Variants */}
          {category !== "simple" && (
            <div className="border border-gray-200 rounded-xl p-4 shadow-sm space-y-4">
              <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                <span className="w-1.5 h-4 bg-bunyan-500 rounded-full" />
                المتغيرات والكميات الافتتاحية
              </h3>
              
              <div className="space-y-4">
                {attributes.map((attr, idx) => {
                  const isDuplicate = attr.name.trim() !== "" && attributes.some((a, i) => i !== idx && a.name.trim() === attr.name.trim());
                  return (
                    <div key={idx} className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-4">
                      <div className={`flex items-center justify-between border-b border-dashed ${isDuplicate ? 'border-red-400' : 'border-gray-300'} pb-2`}>
                        <input
                          type="text"
                          value={attr.name}
                          onChange={(e) => updateAttributeName(idx, e.target.value)}
                          placeholder="اسم الخاصية (مثال: اللون)"
                          className="bg-transparent font-bold text-gray-800 text-right outline-none focus:border-bunyan-500 w-full"
                        />
                        <button type="button" onClick={() => removeAttribute(idx)} className="text-gray-400 hover:text-red-500 transition-colors p-1 shrink-0">
                          <Trash2 size={14} />
                        </button>
                      </div>
                      {isDuplicate && <p className="text-[10px] text-red-500 font-bold mt-1">هذا الاسم مستخدم مسبقاً</p>}
                    <div className="flex flex-wrap gap-2">
                      {attr.values.map((val, vIdx) => (
                        <span key={vIdx} className="bg-white border border-gray-200 text-gray-700 px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm">
                          {val}
                          <button type="button" onClick={() => removeAttributeValue(idx, vIdx)} className="text-gray-400 hover:text-red-500">
                            <X size={12} />
                          </button>
                        </span>
                      ))}
                    </div>
                    <div className="flex gap-2 pt-1 border-t border-gray-200/60 mt-2">
                      <input
                        type="text"
                        placeholder="أضف قيمة... (مثال: أحمر)"
                        className="flex-1 bg-white border border-gray-200 focus:border-bunyan-500 outline-none px-3 py-1.5 text-xs transition-all rounded-lg"
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            addAttributeValue(idx, (e.target as HTMLInputElement).value);
                            (e.target as HTMLInputElement).value = "";
                          }
                        }}
                      />
                      <button
                        type="button"
                        onClick={(e) => {
                          const input = e.currentTarget.previousSibling as HTMLInputElement;
                          addAttributeValue(idx, input.value);
                          input.value = "";
                        }}
                        className="bg-gray-800 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-gray-900 transition-colors"
                      >
                        إضافة
                      </button>
                    </div>
                  </div>
                );
              })}

                <button
                  type="button"
                  onClick={addAttribute}
                  className="w-full py-2.5 border border-dashed border-gray-300 text-gray-500 rounded-xl flex items-center justify-center gap-2 hover:bg-gray-50 hover:text-gray-700 transition-all font-bold text-xs"
                >
                  <Plus size={14} />
                  إضافة خاصية (لون، مقاس..)
                </button>

                {matrixCombinations.length > 0 && matrixCombinations[0].length > 0 && (
                  <div className="space-y-4 pt-2">
                    <h4 className="text-xs font-bold text-gray-700 mb-2">الكميات لكل متغير</h4>
                    
                    {(() => {
                      const grouped: Record<string, any[]> = {};
                      matrixCombinations.forEach(combo => {
                        const root = combo[0];
                        if (!grouped[root]) grouped[root] = [];
                        grouped[root].push(combo);
                      });

                      return Object.entries(grouped).map(([rootValue, combos]) => (
                        <div key={rootValue} className="bg-gray-50 rounded-xl p-3 mb-3 border border-gray-100">
                          <label className="text-[10px] font-bold text-gray-400 mb-2 block uppercase tracking-wider">{validAttributes[0].name}: {rootValue}</label>
                          <div className="grid grid-cols-2 gap-3">
                            {combos.map((combo, i) => {
                              const sku = generateSKU(productName.slice(0, 5), combo);
                              const label = combo.slice(1).length > 0 ? combo.slice(1).join(" / ") : combo[0];
                              return (
                                <div key={i} className="flex items-center justify-between bg-white p-2 rounded-lg border border-gray-100 shadow-sm">
                                  <span className="text-[11px] font-bold text-gray-700 truncate ml-2">{label}</span>
                                  <input
                                    type="number"
                                    min="0"
                                    placeholder="0"
                                    value={quantities[sku] || ""}
                                    onChange={(e) => setQuantities({ ...quantities, [sku]: e.target.value })}
                                    className="w-12 px-1 py-1 h-7 text-xs text-center border border-gray-200 rounded-md focus:border-bunyan-500 outline-none font-bold"
                                  />
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ));
                    })()}

                    <div className={`p-3 rounded-xl border ${isTreasuryInsufficient ? "bg-red-50 border-red-200" : "bg-gray-50 border-gray-200"}`}>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-xs font-bold text-gray-700">إجمالي الكمية:</span>
                        <span className="text-sm font-bold text-gray-900">{totalMatrixQty}</span>
                      </div>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-xs font-bold text-gray-700">إجمالي التكلفة:</span>
                        <span className={`text-sm font-bold font-currency ${isTreasuryInsufficient ? "text-red-700" : "text-gray-900"}`}>
                          {formatCurrency(variantInitCost)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-gray-500">الرصيد المتاح:</span>
                        <span className={`font-bold font-currency ${isTreasuryInsufficient ? "text-red-600" : "text-emerald-600"}`}>
                          {formatCurrency(availableTreasury)}
                        </span>
                      </div>
                      {isTreasuryInsufficient && (
                        <p className="text-red-600 text-[11px] mt-2 pt-2 border-t border-red-200 font-bold flex items-center gap-1">
                          <AlertCircle size={12} /> التكلفة تتجاوز الرصيد المتاح
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100 rounded-b-2xl">
            <button
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl bg-gray-100 text-gray-700 font-bold hover:bg-gray-200 transition-colors text-sm"
            >
              إلغاء
            </button>
            <button
              onClick={preSaveCheck}
              disabled={isSuccess || isTreasuryInsufficient}
              className={`px-6 py-2.5 rounded-xl font-bold text-white text-sm shadow transition-all active:scale-[0.98] ${
                isSuccess
                  ? "bg-emerald-500"
                  : isTreasuryInsufficient
                    ? "bg-gray-300 text-gray-500 cursor-not-allowed opacity-60"
                    : "bg-bunyan-600 hover:bg-bunyan-700"
              }`}
            >
              {isSuccess ? (
                <span className="flex items-center gap-2">
                  <Check size={16} /> تمت بنجاح!
                </span>
              ) : editProduct ? (
                "حفظ التعديلات"
              ) : (
                "إضافة المنتج"
              )}
            </button>
          </div>
        </div>
      </div>

      {showConfirm && !editProduct && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/50 pointer-events-auto">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden animate-fade-in text-right">
            <div className="p-5">
              <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center justify-center gap-2">
                <Package size={20} className="text-bunyan-600" />
                تأكيد إضافة المنتج
              </h3>
              
              <div className="space-y-3 bg-gray-50 p-4 rounded-xl border border-gray-100 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500 font-bold">الاسم:</span>
                  <span className="font-bold text-gray-900">{productName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500 font-bold">الكمية الإجمالية:</span>
                  <span className="font-bold text-gray-900">{category === "simple" ? simpleQty || 0 : totalMatrixQty} {unit}</span>
                </div>
                <div className="flex justify-between pt-2 border-t border-gray-200">
                  <span className="text-gray-500 font-bold">التكلفة الإجمالية:</span>
                  <span className="font-bold text-bunyan-600 font-currency">{formatCurrency(category === "simple" ? simpleInitCost : variantInitCost)}</span>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 bg-gray-50 border-t border-gray-100 p-3 gap-3">
               <button
                 onClick={() => setShowConfirm(false)}
                 className="py-2.5 rounded-xl text-gray-700 font-bold bg-gray-200 hover:bg-gray-300 transition-colors text-sm"
               >
                 إلغاء
               </button>
               <button
                 onClick={handleSave}
                 disabled={isSuccess}
                 className="py-2.5 rounded-xl text-white font-bold bg-bunyan-600 hover:bg-bunyan-700 transition-colors text-sm shadow-sm"
               >
                 تأكيد وإضافة
               </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
