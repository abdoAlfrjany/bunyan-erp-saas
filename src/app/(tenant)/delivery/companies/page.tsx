// src/app/(tenant)/delivery/companies/page.tsx
// الوظيفة: إدارة شركات التوصيل — بطاقات + إضافة/تعديل (SlideOver) + حقول ديناميكية + مناطق تسعير
// الجداول: courier_companies
// الصلاحية: OWNER فقط

'use client';

import { useState } from 'react';
import { useAuthStore } from '@/core/auth/store';
import { useDataStore } from '@/core/db/store';
import { formatCurrency } from '@/shared/utils/format';
import { SlideOver } from '@/shared/components/ui/SlideOver';
import { ConfirmDialog } from '@/shared/components/ui/ConfirmDialog';
import { useToast } from '@/shared/components/ui/Toast';
import { Building2, Plus, Trash2, Edit2, Power, X, MapPin } from 'lucide-react';
import type { CourierCompany } from '@/core/db/seed';

export default function CompaniesPage() {
  const { user } = useAuthStore();
  const { couriers, getForTenant, addCourier, updateCourier, toggleCourier, deleteCourier } = useDataStore();
  const { showToast } = useToast();
  const tid = user?.tenantId || '';
  const myCouriers = getForTenant(couriers, tid);

  const [slideOpen, setSlideOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: '', shortCode: '', merchantCode: '',
    contactPhone: '', contactPerson: '', defaultDeliveryFee: 15,
  });
  const [dynamicFields, setDynamicFields] = useState<{ key: string; label: string; type: string; required: boolean }[]>([]);
  const [pricingZones, setPricingZones] = useState<{ zone: string; fee: number }[]>([]);

  const resetForm = () => {
    setForm({ name: '', shortCode: '', merchantCode: '', contactPhone: '', contactPerson: '', defaultDeliveryFee: 15 });
    setDynamicFields([]);
    setPricingZones([]);
    setEditingId(null);
  };

  const openEdit = (c: CourierCompany) => {
    setForm({ name: c.name, shortCode: c.shortCode, merchantCode: c.merchantCode, contactPhone: c.contactPhone, contactPerson: c.contactPerson, defaultDeliveryFee: c.defaultDeliveryFee });
    setDynamicFields([...c.requiredFields]);
    setPricingZones([...c.pricingZones]);
    setEditingId(c.id);
    setSlideOpen(true);
  };

  const handleSave = () => {
    if (!form.name || !form.shortCode) { 
      showToast('يرجى ملء الحقول المطلوبة (اسم الشركة والرمز المختصر)', 'error'); 
      return; 
    }
    
    if (editingId) {
      updateCourier(editingId, { ...form, requiredFields: dynamicFields, pricingZones });
      showToast('تم تحديث بيانات الشركة بنجاح', 'success');
    } else {
      const newCourier: CourierCompany = {
        id: `cc-${Date.now()}`, tenantId: tid, ...form, isActive: true,
        requiredFields: dynamicFields, pricingZones,
        totalShipments: 0, totalDelivered: 0, totalReturned: 0, pendingAmount: 0,
      };
      addCourier(newCourier);
      showToast('تمت إضافة الشركة بنجاح', 'success');
    }
    setSlideOpen(false);
    resetForm();
  };

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Building2 size={24} className="text-bunyan-600" />
            إدارة الشركات
          </h1>
          <p className="text-sm text-gray-500 mt-1">تكوين الشركات، مسارات التسعير، والحقول المطلوبة</p>
        </div>
        <button onClick={() => { resetForm(); setSlideOpen(true); }}
          className="flex items-center gap-2 px-4 py-2 bg-bunyan-600 text-white rounded-xl text-sm font-bold hover:bg-bunyan-700 transition-colors shadow-sm focus:ring-2 focus:ring-bunyan-500/50">
          <Plus size={18} /> إضافة شركة
        </button>
      </div>

      {/* بطاقات الشركات */}
      <div className="grid gap-4">
        {myCouriers.map((c) => (
          <div key={c.id} className={`bg-white rounded-2xl border ${c.isActive ? 'border-gray-100 border-r-4 border-r-bunyan-600' : 'border-gray-200 border-r-4 border-r-gray-300 opacity-75'} p-5 shadow-sm transition-all hover:shadow-md`}>
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-4">
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <h3 className="text-lg font-bold text-gray-900">{c.name}</h3>
                  <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${c.isActive ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                    {c.isActive ? 'نشطة' : 'متوقفة'}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2">
                  <p className="text-xs text-gray-500">كود التاجر: <span className="font-mono font-bold text-gray-700">{c.merchantCode || '—'}</span></p>
                  <p className="text-xs text-gray-500">الرمز: <span className="font-mono font-bold text-gray-700">{c.shortCode}</span></p>
                  <p className="text-xs text-gray-500">مسؤول التواصل: <span className="font-bold text-gray-700">{c.contactPerson || '—'}</span></p>
                  {c.contactPhone && <p className="text-xs text-gray-500 font-mono" dir="ltr">{c.contactPhone}</p>}
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => openEdit(c)} className="p-2 bg-gray-50 hover:bg-bunyan-50 rounded-lg text-gray-600 hover:text-bunyan-600 transition-colors shadow-sm border border-transparent hover:border-bunyan-200" title="تعديل"><Edit2 size={16} /></button>
                <button onClick={() => toggleCourier(c.id)} className={`p-2 rounded-lg transition-colors shadow-sm border border-transparent ${c.isActive ? 'bg-gray-50 hover:bg-orange-50 text-gray-600 hover:text-orange-600 hover:border-orange-200' : 'bg-emerald-50 text-emerald-600 border-emerald-200 hover:bg-emerald-100'}`} title={c.isActive ? 'إيقاف' : 'تفعيل'}>
                  <Power size={16} />
                </button>
                <button onClick={() => setDeleteId(c.id)} className="p-2 bg-gray-50 hover:bg-red-50 rounded-lg text-gray-600 hover:text-red-600 transition-colors shadow-sm border border-transparent hover:border-red-200" title="حذف دائـم"><Trash2 size={16} /></button>
              </div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 bg-gray-50 rounded-xl p-4 border border-gray-100 mt-4">
              <div className="text-center sm:text-right">
                <p className="text-[10px] font-bold text-gray-400 mb-0.5">الشحنات النشطة</p>
                <p className="text-sm font-black text-gray-900">{c.totalShipments}</p>
              </div>
              <div className="text-center sm:text-right border-r border-gray-200 md:border-none pr-3">
                <p className="text-[10px] font-bold text-gray-400 mb-0.5">تم التوصيل</p>
                <p className="text-sm font-black text-emerald-600">{c.totalDelivered}</p>
              </div>
              <div className="text-center sm:text-right border-t pt-3 sm:border-none sm:pt-0">
                <p className="text-[10px] font-bold text-gray-400 mb-0.5">مُرتجَعة</p>
                <p className="text-sm font-black text-red-600">{c.totalReturned}</p>
              </div>
              <div className="text-center sm:text-right border-l pl-3 sm:border-none sm:pl-0 border-t pt-3">
                <p className="text-[10px] font-bold text-gray-400 mb-0.5">قيد التحصيل</p>
                <p className="text-sm font-black text-gray-900 font-mono">{formatCurrency(c.pendingAmount)}</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-4 text-[11px] font-bold text-gray-500">
              <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 bg-gray-400 rounded-full"/> الرسوم الافتراضية: {formatCurrency(c.defaultDeliveryFee)}</span>
              <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 bg-gray-400 rounded-full"/> {c.pricingZones.length} منطقة تسعير</span>
              <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 bg-gray-400 rounded-full"/> {c.requiredFields.length} حقل إلزامي إضافي</span>
            </div>
          </div>
        ))}
        {myCouriers.length === 0 && (
          <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-gray-200 mt-4">
            <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-3">
              <Building2 size={24} className="text-gray-400" />
            </div>
            <p className="text-base font-bold text-gray-900 mb-1">لا توجد شركات توصيل مسجلة</p>
            <p className="text-sm text-gray-500">أضف أول شركة بالضغط على &quot;إضافة شركة&quot;.</p>
          </div>
        )}
      </div>

      {/* SlideOver للتعديل / الإضافة */}
      <SlideOver isOpen={slideOpen} onClose={() => { setSlideOpen(false); resetForm(); }} title={editingId ? 'تعديل بيانات الشركة' : 'إضافة شركة جديدة'}>
        <div className="space-y-6 pb-20">
          <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
            <h3 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2">
              <div className="w-1.5 h-4 bg-bunyan-500 rounded-full" />
              المعلومات الأساسية
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">اسم الشركة *</label>
                <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} 
                  className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-bunyan-500/30 focus:border-bunyan-500" placeholder="مثال: شركة السرعة" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">الرمز المختصر للصقات (SKU/Tracking) *</label>
                <input type="text" value={form.shortCode} onChange={(e) => setForm({ ...form, shortCode: e.target.value })} 
                  className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-bunyan-500/30 focus:border-bunyan-500 font-mono" placeholder="SPD" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">كود التاجر (في نظامهم)</label>
                <input type="text" value={form.merchantCode} onChange={(e) => setForm({ ...form, merchantCode: e.target.value })} 
                  className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-bunyan-500/30 focus:border-bunyan-500 font-mono" placeholder="M-12345" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">رسوم التوصيل الافتراضية</label>
                <div className="relative">
                  <input type="number" value={form.defaultDeliveryFee} onChange={(e) => setForm({ ...form, defaultDeliveryFee: Number(e.target.value) })} 
                    className="w-full pl-3 pr-10 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-bunyan-500/30 focus:border-bunyan-500 font-mono" />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400">د.ل</span>
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">هاتف الشركة / المندوب</label>
                <input type="tel" value={form.contactPhone} onChange={(e) => setForm({ ...form, contactPhone: e.target.value })} dir="ltr" 
                  className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-bunyan-500/30 focus:border-bunyan-500 font-mono text-left" placeholder="09XXXXXXXX" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">اسم مسؤول التواصل</label>
                <input type="text" value={form.contactPerson} onChange={(e) => setForm({ ...form, contactPerson: e.target.value })} 
                  className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-bunyan-500/30 focus:border-bunyan-500" placeholder="مثال: أحمد" />
              </div>
            </div>
          </div>

          {/* حقول ديناميكية */}
          <div className="border border-gray-200 rounded-xl p-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
              <div>
                <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                  <div className="w-1.5 h-4 bg-bunyan-500 rounded-full" />
                  الحقول المطلوبة للإرسال (تكامل المستقبَل)
                </h3>
                <p className="text-[10px] text-gray-500 mt-0.5 pr-3.5">أضف الحقول التي تطلبها هذه الشركة في نظام الشيت أو المنظومة الخاصة بها.</p>
              </div>
              <button onClick={() => setDynamicFields([...dynamicFields, { key: '', label: '', type: 'text', required: false }])}
                className="flex items-center gap-1 px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-xs font-bold hover:bg-gray-200 transition-colors w-fit">
                <Plus size={14} /> إضافة حقل
              </button>
            </div>
            
            <div className="space-y-3 pt-2">
              {dynamicFields.map((f, i) => (
                <div key={i} className="flex flex-col sm:flex-row gap-2 items-start sm:items-center bg-gray-50 p-2 rounded-lg border border-gray-100">
                  <input placeholder="المفتاح (ex: ID_Card)" value={f.key} onChange={(e) => { const nf = [...dynamicFields]; nf[i].key = e.target.value; setDynamicFields(nf); }}
                    className="w-full sm:flex-1 px-3 py-2 border border-gray-200 rounded-md text-xs font-mono focus:border-bunyan-500 focus:outline-none" />
                  <input placeholder="اسم الحقل الظاهر" value={f.label} onChange={(e) => { const nf = [...dynamicFields]; nf[i].label = e.target.value; setDynamicFields(nf); }}
                    className="w-full sm:flex-1 px-3 py-2 border border-gray-200 rounded-md text-xs focus:border-bunyan-500 focus:outline-none" />
                  <select value={f.type} onChange={(e) => { const nf = [...dynamicFields]; nf[i].type = e.target.value; setDynamicFields(nf); }}
                    className="w-full sm:w-24 px-2 py-2 border border-gray-200 rounded-md text-xs bg-white focus:border-bunyan-500 focus:outline-none">
                    <option value="text">نص</option>
                    <option value="number">رقم</option>
                  </select>
                  <label className="flex items-center gap-2 text-xs font-bold text-gray-600 bg-white border border-gray-200 px-3 py-2 rounded-md cursor-pointer w-full sm:w-auto">
                    <input type="checkbox" checked={f.required} onChange={(e) => { const nf = [...dynamicFields]; nf[i].required = e.target.checked; setDynamicFields(nf); }} 
                      className="rounded border-gray-300 text-bunyan-600 focus:ring-bunyan-500" /> 
                    إلزامي
                  </label>
                  <button onClick={() => setDynamicFields(dynamicFields.filter((_, j) => j !== i))} className="p-2 text-red-500 hover:bg-red-50 rounded-md ms-auto sm:ms-0 self-end sm:self-auto"><X size={16} /></button>
                </div>
              ))}
              {dynamicFields.length === 0 && (
                <p className="text-xs text-center text-gray-400 py-2 border border-dashed border-gray-200 rounded-lg">لا توجد حقول إضافية مطلوبة.</p>
              )}
            </div>
          </div>

          {/* مناطق التسعير */}
          <div className="border border-gray-200 rounded-xl p-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
              <div>
                <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                  <div className="w-1.5 h-4 bg-bunyan-500 rounded-full" />
                  تسعير استثنائي للمناطق المدعومة
                </h3>
              </div>
              <button onClick={() => setPricingZones([...pricingZones, { zone: '', fee: 0 }])}
                className="flex items-center gap-1 px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-xs font-bold hover:bg-gray-200 transition-colors w-fit">
                <Plus size={14} /> إضافة منطقة
              </button>
            </div>
            
            <div className="space-y-3 pt-2">
              {pricingZones.map((z, i) => (
                <div key={i} className="flex gap-2 items-center bg-gray-50 p-2 rounded-lg border border-gray-100">
                  <div className="relative flex-1">
                    <MapPin size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input placeholder="اسم المنطقة (مثال: بنغازي)" value={z.zone} onChange={(e) => { const nz = [...pricingZones]; nz[i].zone = e.target.value; setPricingZones(nz); }}
                      className="w-full pr-9 pl-3 py-2 border border-gray-200 rounded-md text-sm focus:border-bunyan-500 focus:outline-none" />
                  </div>
                  <div className="relative w-32 shrink-0">
                    <input type="number" placeholder="0" value={z.fee} onChange={(e) => { const nz = [...pricingZones]; nz[i].fee = Number(e.target.value); setPricingZones(nz); }}
                      className="w-full pr-10 pl-3 py-2 border border-gray-200 rounded-md text-sm font-mono focus:border-bunyan-500 focus:outline-none" />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400">د.ل</span>
                  </div>
                  <button onClick={() => setPricingZones(pricingZones.filter((_, j) => j !== i))} className="p-2 text-red-500 hover:bg-red-50 rounded-md"><X size={16} /></button>
                </div>
              ))}
              {pricingZones.length === 0 && (
                <p className="text-xs text-center text-gray-400 py-2 border border-dashed border-gray-200 rounded-lg">التسعير الافتراضي مطبق على كافة المناطق.</p>
              )}
            </div>
          </div>

          <div className="fixed bottom-0 left-0 w-full sm:w-[500px] p-4 bg-white border-t border-gray-100 z-10 hidden sm:block">
            <button onClick={handleSave} className="w-full py-3 bg-bunyan-600 text-white font-bold rounded-xl hover:bg-bunyan-700 transition-all text-sm shadow-md">
              {editingId ? 'حفظ التعديلات' : 'إضافة الشركة لحسابك'}
            </button>
          </div>
          <button onClick={handleSave} className="sm:hidden w-full py-3 bg-bunyan-600 text-white font-bold rounded-xl hover:bg-bunyan-700 transition-all text-sm shadow-md mt-6">
            {editingId ? 'حفظ التعديلات' : 'إضافة الشركة لحسابك'}
          </button>
        </div>
      </SlideOver>

      <ConfirmDialog isOpen={!!deleteId} onCancel={() => setDeleteId(null)} onConfirm={() => { if (deleteId) { const res = deleteCourier(deleteId); setDeleteId(null); if (res.success) showToast('تم حذف الشركة بنجاح', 'success'); else showToast(res.error || 'لا يمكن الحذف', 'error'); } }} title="حذف الشركة" message="هل أنت متأكد من حذف هذه الشركة بشكل دائم؟ سيؤدي هذا لتوقف الشحنات التي لم يتم إنشاؤها بعد." variant="danger" />
    </div>
  );
}
