'use client';

import { useState } from 'react';
import { useAuthStore } from '@/core/auth/store';
import { useDataStore } from '@/core/db/store';
import { useToast } from '@/shared/components/ui/Toast';
import { SlideOver } from '@/shared/components/ui/SlideOver';
import { ConfirmDialog } from '@/shared/components/ui/ConfirmDialog';
import { Settings, Store, Shield, Bell, Package, CheckCircle2, ChevronLeft, Users, Lock, Edit2, Trash2, Plus, Download, AlertTriangle, Truck, LayoutTemplate } from 'lucide-react';
import { SALES_EMPLOYEE_PERMISSIONS } from '@/core/db/seed';
import type { TenantUser } from '@/core/db/seed';

type Tab = 'general' | 'orders' | 'inventory' | 'delivery' | 'notifications' | 'users' | 'security' | 'templates';

export default function SettingsPage() {
  const { user } = useAuthStore();
  const { tenants, users, getForTenant, addUser, updateUser, subscriptions } = useDataStore();
  const { showToast } = useToast();
  
  const tid = user?.tenantId || '';
  const tenant = tenants.find((t) => t.id === tid);
  const myUsers = getForTenant(users, tid);
  const sub = subscriptions.find((s) => s.tenantId === tid);

  const [activeTab, setActiveTab] = useState<Tab>('general');
  const [isSaving, setIsSaving] = useState(false);

  // User Management
  const [slideOpen, setSlideOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<TenantUser | null>(null);
  const [userForm, setUserForm] = useState<Partial<TenantUser> & { newPassword?: string }>({ fullName: '', email: '', role: 'employee', isActive: true, passwordHash: '', permissions: SALES_EMPLOYEE_PERMISSIONS });
  
  // Security Panel
  const [currentPassword, setCurrentPassword] = useState('');
  const [newOwnerPassword, setNewOwnerPassword] = useState('');
  const [wipeConfirm, setWipeConfirm] = useState('');
  const [wipePassword, setWipePassword] = useState('');

  // Inventory logic
  const [negStockRule, setNegStockRule] = useState<'prevent' | 'warn' | 'allow'>('warn');

  // General Store logic
  const [storePhone, setStorePhone] = useState(tenant?.ownerPhone || '');

  if (!tenant) return (
    <div className="flex flex-col items-center justify-center py-20 animate-fade-in">
      <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
        <Store size={28} className="text-gray-400" />
      </div>
      <p className="text-gray-500 font-bold mb-2">تعذر تحميل بيانات المتجر</p>
    </div>
  );

  const handleSave = () => {
    setIsSaving(true);
    
    // validate phone
    if (storePhone && !storePhone.match(/^(091|092|093|094|095)[0-9]{7}$/)) {
      showToast('رقم هاتف المتجر يجب أن يكون 10 أرقام ويبدأ بمفتاح بليبي صالح', 'error');
      setIsSaving(false);
      return;
    }

    setTimeout(() => {
      setIsSaving(false);
      showToast('تم حفظ التغييرات بنجاح', 'success');
    }, 600);
  };

  const saveUser = () => {
    if (!userForm.fullName || !userForm.email) { showToast('يرجى ملء الاسم والبريد', 'error'); return; }
    
    const dataToSave = { ...userForm };
    if (dataToSave.newPassword) {
      dataToSave.passwordHash = btoa(dataToSave.newPassword);
    }
    delete dataToSave.newPassword;

    if (editingUser) {
      updateUser(editingUser.id, dataToSave);
      showToast('تم تحديث المستخدم بنجاح', 'success');
    } else {
      addUser({
        id: `usr-${Date.now()}`, tenantId: tid,
        fullName: dataToSave.fullName!, email: dataToSave.email!,
        passwordHash: dataToSave.passwordHash ? (dataToSave.newPassword ? dataToSave.passwordHash : btoa(dataToSave.passwordHash)) : btoa('123456'),
        role: dataToSave.role as any, isActive: dataToSave.isActive ?? true,
        createdAt: new Date().toISOString().split('T')[0],
        permissions: dataToSave.permissions || SALES_EMPLOYEE_PERMISSIONS
      });
      showToast('تمت إضافة المستخدم بنجاح', 'success');
    }
    setSlideOpen(false);
  };

  const handleOwnerPasswordChange = () => {
    if (!user) return;
    
    // تأمين الواجهة برمجيا لمنع تجاوز المستخدمين غير المخولين
    if (user.role !== 'owner') {
      showToast('خطأ أمني: غير مصرح لك بتغيير الكلمة الرئيسية للمالك', 'error');
      return;
    }

    const dbUser = users.find(u => u.id === user.id);
    if (!dbUser) return;

    if (btoa(currentPassword) !== dbUser.passwordHash) {
      showToast('كلمة المرور الحالية غير صحيحة', 'error');
      return;
    }
    if (newOwnerPassword.length < 6) {
      showToast('كلمة المرور الجديدة يجب أن تكون 6 أحرف على الأقل', 'error');
      return;
    }
    updateUser(user.id, { passwordHash: btoa(newOwnerPassword) });
    showToast('تم تحديث كلمة المرور بنجاح', 'success');
    setCurrentPassword('');
    setNewOwnerPassword('');
  };

  const TabButton = ({ tab, label, icon: Icon }: { tab: Tab, label: string, icon: any }) => {
    const active = activeTab === tab;
    return (
      <button onClick={() => setActiveTab(tab)}
        className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all ${
          active ? 'bg-bunyan-600 text-white font-bold shadow-md' : 'text-gray-600 hover:bg-gray-50 font-semibold'
        }`}>
        <div className="flex items-center gap-3">
          <Icon size={18} className={active ? 'text-white' : 'text-gray-400'} />
          <span className="text-sm">{label}</span>
        </div>
        {!active && <ChevronLeft size={16} className="text-gray-300" />}
      </button>
    );
  };

  return (
    <div className="space-y-6 animate-fade-in pb-20">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Settings size={28} className="text-bunyan-600" />
            إعدادات المتجر
          </h1>
          <p className="text-sm text-gray-500 mt-1">إعدادات شاملة للمتجر والعمليات والمستخدمين</p>
        </div>
        <button onClick={handleSave} disabled={isSaving}
          className="flex items-center gap-2 px-5 py-2.5 bg-bunyan-600 text-white rounded-xl text-sm font-bold hover:bg-bunyan-700 transition-colors shadow-sm focus:ring-2 focus:ring-bunyan-500/50 disabled:opacity-50 min-w-[140px] justify-center">
          {isSaving ? <span className="animate-spin w-4 h-4 border-2 border-white/20 border-t-white rounded-full" /> : <CheckCircle2 size={18} />}
          {isSaving ? 'يتم الحفظ...' : 'حفظ التغييرات'}
        </button>
      </div>

      <div className="flex flex-col md:flex-row gap-6 items-start">
        <div className="w-full md:w-64 bg-white rounded-3xl p-4 border border-gray-100 shadow-sm shrink-0 sticky top-24">
          <div className="space-y-1">
            <TabButton tab="general" label="بيانات المتجر" icon={Store} />
            <TabButton tab="orders" label="إعدادات الطلبيات" icon={Package} />
            <TabButton tab="inventory" label="المخزون والأصناف" icon={Package} />
            <TabButton tab="delivery" label="شركات التوصيل" icon={Truck} />
            <TabButton tab="templates" label="قوالب الأصناف" icon={LayoutTemplate} />
            <TabButton tab="notifications" label="الإشعارات" icon={Bell} />
            <TabButton tab="users" label="المستخدمون والصلاحيات" icon={Users} />
            <TabButton tab="security" label="الأمان والحساب" icon={Lock} />
          </div>
        </div>

        <div className="flex-1 w-full bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden min-h-[600px] p-6 md:p-8">
          
          {/* تبويب 1: بيانات المتجر */}
          {activeTab === 'general' && (
            <div className="animate-fade-in space-y-6 max-w-2xl">
              <h2 className="text-lg font-bold text-gray-900 border-b border-gray-100 pb-4">المعلومات الأساسية</h2>
              
              <div className="flex items-center gap-5 pb-4">
                <div className="w-20 h-20 bg-gray-50 border-2 border-dashed border-gray-200 rounded-2xl flex items-center justify-center text-gray-400 font-bold hover:bg-gray-100 cursor-pointer text-xs">رفع الشعار</div>
                <div><p className="text-sm font-bold text-gray-900">شعار المتجر</p><p className="text-xs text-gray-500">PNG أو JPG (الحد الأقصى 2MB)</p></div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div><label className="block text-xs font-bold text-gray-700 mb-1.5">اسم المتجر</label><input type="text" defaultValue={tenant.name} className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm" /></div>
                <div><label className="block text-xs font-bold text-gray-700 mb-1.5">صاحب المتجر</label><input type="text" defaultValue={tenant.ownerName} className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm" /></div>
                <div><label className="block text-xs font-bold text-gray-700 mb-1.5">الهاتف (10 أرقام)</label><input type="tel" dir="ltr" value={storePhone} onChange={e => setStorePhone(e.target.value)} placeholder="0910000000" pattern="^(091|092|093|094|095)[0-9]{7}$" className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-left" title="يجب أن يبدأ بـ 091, 092, 093, 094, أو 095" /></div>
                <div><label className="block text-xs font-bold text-gray-700 mb-1.5">البريد الإلكتروني</label><input type="email" dir="ltr" defaultValue={tenant.ownerEmail} className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-left" /></div>
                <div><label className="block text-xs font-bold text-gray-700 mb-1.5">المدينة</label><input type="text" defaultValue={tenant.city} className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm" /></div>
                <div><label className="block text-xs font-bold text-gray-700 mb-1.5">العنوان التفصيلي</label><input type="text" className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm" /></div>
                <div className="md:col-span-2"><label className="block text-xs font-bold text-gray-700 mb-1.5">الموقع الإلكتروني</label><input type="text" dir="ltr" defaultValue={tenant.website || ''} placeholder="domain.com" pattern="^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$" className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-left" /></div>
                <div><label className="block text-xs font-bold text-gray-700 mb-1.5">السجل التجاري (اختياري)</label><input type="text" className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm" /></div>
                <div><label className="block text-xs font-bold text-gray-700 mb-1.5">الرقم الضريبي (اختياري)</label><input type="text" className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm" /></div>
              </div>
            </div>
          )}

          {/* تبويب 2: إعدادات الطلبيات */}
          {activeTab === 'orders' && (
            <div className="animate-fade-in space-y-6 max-w-2xl">
              <h2 className="text-lg font-bold text-gray-900 border-b border-gray-100 pb-4">تفضيلات الطلبيات والشحن</h2>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-xs font-bold text-gray-700 mb-1.5">بادئة رقم الطلبية</label><input type="text" defaultValue="ORD-" dir="ltr" className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-left font-mono font-bold text-bunyan-600" /></div>
                <div><label className="block text-xs font-bold text-gray-700 mb-1.5">رقم البداية</label><input type="number" defaultValue={1000} dir="ltr" className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-left font-mono font-bold" /></div>
              </div>
              
              <div>
                <label className="block text-xs font-bold text-gray-900 mb-3">الحقول الإلزامية عند إنشاء طلبية</label>
                <div className="grid grid-cols-2 gap-3 bg-gray-50 p-4 rounded-xl border border-gray-100">
                  {['اسم الزبون', 'رقم الهاتف', 'المدينة', 'العنوان التفصيلي', 'ملاحظات'].map(f => (
                    <label key={f} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer"><input type="checkbox" defaultChecked={f !== 'ملاحظات'} className="rounded text-bunyan-600 w-4 h-4"/> {f}</label>
                  ))}
                </div>
              </div>

              <div><label className="block text-xs font-bold text-gray-700 mb-1.5">نص الفاتورة السفلي</label><input type="text" defaultValue="شكراً لتعاملكم معنا، يسعدنا تواصلكم دائماً." className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm" /></div>
              
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-100">
                <div><h4 className="text-sm font-bold text-gray-900">طباعة الفاتورة آلياً</h4><p className="text-xs text-gray-500 mt-0.5">فتح نافذة الطباعة فور تأكيد إنشاء الطلبية</p></div>
                <input type="checkbox" defaultChecked className="w-5 h-5 rounded text-bunyan-600" />
              </div>
            </div>
          )}

          {/* تبويب 3: المخزون */}
          {activeTab === 'inventory' && (
            <div className="animate-fade-in space-y-6 max-w-2xl">
              <h2 className="text-lg font-bold text-gray-900 border-b border-gray-100 pb-4">قواعد المخزون والأصناف</h2>
              
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">الحد الافتراضي للتحذير بنفاد الكمية (قطع)</label>
                <input type="number" defaultValue={5} className="w-32 px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm font-mono text-center font-bold" />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-900 mb-3">السماح ببيع المنتجات بمخزون سالب (نفدت الكمية)</label>
                <div className="space-y-3 bg-gray-50 p-4 rounded-xl border border-gray-100">
                  <label className="flex items-center gap-2 text-sm text-gray-700">
                     <input type="radio" name="neg" checked={negStockRule === 'prevent'} onChange={() => setNegStockRule('prevent')} className="text-bunyan-600 w-4 h-4" /> 
                     منع كلياً (افتراضي)
                  </label>
                  <label className="flex items-center gap-2 text-sm text-gray-700">
                     <input type="radio" name="neg" checked={negStockRule === 'warn'} onChange={() => setNegStockRule('warn')} className="text-bunyan-600 w-4 h-4" /> 
                     إظهار تحذير وإشعار مع السماح بالبيع
                  </label>
                  <label className="flex items-center gap-2 text-sm text-gray-700">
                     <input type="radio" name="neg" checked={negStockRule === 'allow'} onChange={() => setNegStockRule('allow')} className="text-bunyan-600 w-4 h-4" /> 
                     السماح المطلق
                  </label>
                </div>
                {negStockRule === 'allow' && (
                   <p className="text-xs text-red-600 bg-red-50 border border-red-100 p-2.5 rounded-lg mt-3 font-bold flex items-center gap-1.5">
                     <AlertTriangle size={14} /> 
                     تحذير: السماح ببيع منتجات بمخزون سالب سيؤثر على دقة حسابات الأرباح وتقارير المخزون
                   </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-900 mb-3">وحدات القياس المتاحة</label>
                <div className="flex flex-wrap gap-2 mb-3">
                  {['قطعة', 'كيلو', 'لتر', 'متر', 'علبة', 'كيس', 'طقم'].map(u => (
                    <span key={u} className="px-3 py-1 bg-gray-100 text-gray-700 rounded-lg text-xs font-bold border border-gray-200">{u}</span>
                  ))}
                </div>
                <div className="flex gap-2"><input type="text" placeholder="إضافة وحدة جديدة..." className="flex-1 p-2 bg-gray-50 border border-gray-200 rounded-lg text-sm" /><button className="px-4 py-2 bg-gray-200 text-gray-700 font-bold text-sm rounded-lg">إضافة</button></div>
              </div>
            </div>
          )}

          {/* تبويب: شركات التوصيل */}
          {activeTab === 'delivery' && (
            <div className="animate-fade-in space-y-6 max-w-2xl">
              <h2 className="text-lg font-bold text-gray-900 border-b border-gray-100 pb-4">شركات التوصيل وشرائها</h2>
              <p className="text-sm text-gray-500 mb-4">فعّل الشركات التي تتعامل معها لعرضها في خيارات شحن الطلبيات والمزودة بأسعار ومناطق معدة مسبقاً.</p>
              
              <div className="space-y-3">
                {[
                  { id: 'c1', name: 'شركة بريد ليبيا (Libya Post)', desc: 'توصيل محلي على مستوى البلاد' },
                  { id: 'c2', name: 'شركة أربوקס للتوصيل (Aramex)', desc: 'توصيل طرود سريع وإقليمي' },
                  { id: 'c3', name: 'خدمات راحتي (Rahety Delivery)', desc: 'توصيل للبيوت وموثوق داخلي' },
                  { id: 'c4', name: 'شركة لمسة السريعة', desc: 'توصيل داخل مدينة طرابلس وضواحيها فقط' },
                ].map((co) => (
                  <div key={co.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-white rounded-xl border border-gray-200 shadow-sm hover:border-bunyan-200 transition-colors gap-3">
                    <div className="flex items-center gap-3">
                       <div className="w-10 h-10 rounded-full bg-gray-50 border border-gray-200 flex items-center justify-center text-gray-400">
                         <Truck size={18} />
                       </div>
                       <div>
                         <h4 className="text-sm font-bold text-gray-900">{co.name}</h4>
                         <p className="text-xs text-gray-500 mt-0.5">{co.desc}</p>
                       </div>
                    </div>
                    {/* Toggle */}
                    <label className="relative inline-flex items-center cursor-pointer ml-auto sm:ml-0">
                      <input type="checkbox" defaultChecked={co.id === 'c1' || co.id === 'c3'} className="sr-only peer" />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-bunyan-600"></div>
                      <span className="ml-3 text-xs font-bold text-gray-700 w-12 text-center peer-checked:text-bunyan-600 hidden sm:inline-block">تفعيل</span>
                    </label>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* تبويب: قوالب الأصناف */}
          {activeTab === 'templates' && (
            <div className="animate-fade-in space-y-6 max-w-2xl">
              <h2 className="text-lg font-bold text-gray-900 border-b border-gray-100 pb-4">قوالب المنتجات المدعومة</h2>
              <p className="text-sm text-gray-500 mb-4">أثناء إضافة المنتجات أو تعديلها، يتم عرض حقول مخصصة بناءً على القالب المختار.</p>
              
              <div className="grid grid-cols-1 gap-5">
                 <div className="p-5 border border-gray-200 rounded-2xl bg-white shadow-sm pointer-events-none">
                    <div className="flex items-center gap-3 mb-3">
                       <span className="w-8 h-8 rounded-lg bg-gray-100 text-gray-600 flex items-center justify-center"><Package size={16}/></span>
                       <div><h3 className="font-bold text-gray-900">القالب العادي (Simple)</h3><p className="text-xs text-gray-500">منتج مفرد لا يتطلب متغيرات</p></div>
                       <span className="mr-auto text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded font-bold">افتراضي</span>
                    </div>
                    <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-50">
                       <span className="text-[10px] bg-gray-50 border border-gray-200 px-2 py-1 rounded text-gray-600">التكلفة والبيع</span>
                       <span className="text-[10px] bg-gray-50 border border-gray-200 px-2 py-1 rounded text-gray-600">الكمية المطلقة</span>
                       <span className="text-[10px] bg-gray-50 border border-gray-200 px-2 py-1 rounded text-gray-600">الباركود</span>
                    </div>
                 </div>

                 <div className="p-5 border border-blue-200 rounded-2xl bg-blue-50/30 shadow-sm pointer-events-none">
                    <div className="flex items-center gap-3 mb-3">
                       <span className="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center"><LayoutTemplate size={16}/></span>
                       <div><h3 className="font-bold text-gray-900">قالب الملابس (Clothing)</h3><p className="text-xs text-gray-500">للملابس، الأحذية والأصناف متعددة المقاسات والألوان</p></div>
                    </div>
                    <div className="flex flex-wrap gap-2 pt-2 border-t border-blue-100">
                       <span className="text-[10px] bg-white border border-blue-200 px-2 py-1 rounded text-blue-700 font-bold">المقاسات (S,M,L.. / أرقام)</span>
                       <span className="text-[10px] bg-white border border-blue-200 px-2 py-1 rounded text-blue-700 font-bold">اللون الاختياري</span>
                       <span className="text-[10px] bg-white border border-blue-200 px-2 py-1 rounded text-blue-700 font-bold">الكمية لكل متغير</span>
                       <span className="text-[10px] bg-white border border-blue-200 px-2 py-1 rounded text-blue-700 font-bold">إلغاء حساب الكمية الموحدة</span>
                    </div>
                 </div>

                 <div className="p-5 border border-purple-200 rounded-2xl bg-purple-50/30 shadow-sm pointer-events-none">
                    <div className="flex items-center gap-3 mb-3">
                       <span className="w-8 h-8 rounded-lg bg-purple-100 text-purple-600 flex items-center justify-center"><Edit2 size={16}/></span>
                       <div><h3 className="font-bold text-gray-900">القالب المخصص (Custom)</h3><p className="text-xs text-gray-500">للأصناف التي تتطلب إدخالات حرة إضافية (مثل: ضمان، معالج، تاريخ منتهي..)</p></div>
                    </div>
                    <div className="flex flex-wrap gap-2 pt-2 border-t border-purple-100">
                       <span className="text-[10px] bg-white border border-purple-200 px-2 py-1 rounded text-purple-700 font-bold">مفتاح إضافي</span>
                       <span className="text-[10px] bg-white border border-purple-200 px-2 py-1 rounded text-purple-700 font-bold">قيمة حرة للمفتاح</span>
                       <span className="text-[10px] bg-white border border-purple-200 px-2 py-1 rounded text-gray-600">نفس حقول القالب العادي متوفرة</span>
                    </div>
                 </div>
              </div>
            </div>
          )}

          {/* تبويب: الإشعارات */}
          {activeTab === 'notifications' && (
            <div className="animate-fade-in space-y-6 max-w-2xl">
              <h2 className="text-lg font-bold text-gray-900 border-b border-gray-100 pb-4">تخصيص الإشعارات</h2>
              <div className="space-y-3">
                {[
                  { t: 'تحديثات الطلبيات', d: 'طلبية جديدة، إلغاء، استرجاع' },
                  { t: 'المخزون', d: 'نفاد الكمية لمنتج معين' },
                  { t: 'المالية', d: 'الديون المتأخرة وتوزيع الأرباح' },
                  { t: 'الموظفين', d: 'طلبات السلفيات والإجازات' },
                ].map((item, i) => (
                  <div key={i} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-100">
                    <div><h4 className="text-sm font-bold text-gray-900">{item.t}</h4><p className="text-xs text-gray-500 mt-0.5">{item.d}</p></div>
                    <input type="checkbox" defaultChecked className="w-5 h-5 rounded text-bunyan-600" />
                  </div>
                ))}
              </div>
              <div className="pt-4">
                <label className="block text-xs font-bold text-gray-900 mb-3">صوت التنبيه للإشعارات الجديدة</label>
                <select className="w-full sm:w-64 p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold">
                  <option>بدون صوت</option>
                  <option>صوت خفيف (بلب)</option>
                  <option>تنبيه جرس عالٍ</option>
                </select>
              </div>
            </div>
          )}

          {/* تبويب: المستخدمون */}
          {activeTab === 'users' && (
            <div className="animate-fade-in">
              <div className="flex justify-between items-center mb-6 pb-4 border-b border-gray-100">
                <h2 className="text-lg font-bold text-gray-900">صلاحيات النظام</h2>
                <button onClick={() => { setEditingUser(null); setUserForm({ role: 'employee', isActive: true }); setSlideOpen(true); }} className="flex items-center gap-2 px-3 py-1.5 bg-bunyan-50 text-bunyan-700 rounded-lg text-xs font-bold hover:bg-bunyan-100">
                  <Plus size={16} /> إضافة مستخدم جديد
                </button>
              </div>
              
              <div className="border border-gray-100 rounded-xl overflow-hidden">
                <table className="w-full text-sm text-right">
                  <thead className="bg-gray-50 text-gray-500 font-medium border-b border-gray-100">
                    <tr><th className="px-4 py-3">الاسم والبريد</th><th className="px-4 py-3">الدور</th><th className="px-4 py-3 text-center">الحالة</th><th className="px-4 py-3 text-center">إدارة</th></tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {myUsers.map(u => (
                      <tr key={u.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                           <p className="font-bold text-gray-900">{u.fullName}</p>
                           <p className="text-xs text-gray-500 font-mono mt-0.5">{u.email}</p>
                        </td>
                        <td className="px-4 py-3 font-bold text-xs">{u.role === 'owner' ? 'المالك' : u.role === 'partner' ? 'شريك' : 'موظف'}</td>
                        <td className="px-4 py-3 text-center">
                          {u.isActive ? <span className="bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded text-xs">نشط</span> : <span className="bg-red-50 text-red-600 px-2 py-0.5 rounded text-xs">موقوف</span>}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button onClick={() => { setEditingUser(u); setUserForm(u); setSlideOpen(true); }} className="p-1.5 bg-white border border-gray-200 hover:border-bunyan-300 rounded shadow-sm text-gray-600"><Settings size={14} /></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* تبويب: الأمان والحساب */}
          {activeTab === 'security' && (
            <div className="animate-fade-in space-y-8 max-w-2xl">
              <div>
                <h2 className="text-lg font-bold text-gray-900 border-b border-gray-100 pb-4 mb-4">كلمة المرور والأمان</h2>
                <div className="grid grid-cols-1 gap-4">
                  <div><label className="block text-xs font-bold text-gray-700 mb-1.5">كلمة المرور الحالية</label><input type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} placeholder="••••••••" className="w-full max-w-sm p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm" /></div>
                  <div><label className="block text-xs font-bold text-gray-700 mb-1.5">كلمة المرور الجديدة</label><input type="password" value={newOwnerPassword} onChange={e => setNewOwnerPassword(e.target.value)} placeholder="••••••••" className="w-full max-w-sm p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm" /></div>
                  <button onClick={handleOwnerPasswordChange} className="w-fit px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-bold">تحديث كلمة المرور</button>
                </div>
              </div>

              <div>
                <h2 className="text-lg font-bold text-gray-900 border-b border-gray-100 pb-4 mb-4">بيانات الاشتراك</h2>
                <div className="bg-gradient-to-r from-bunyan-50 to-white border border-bunyan-100 rounded-2xl p-6">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="bg-bunyan-100 text-bunyan-800 text-[10px] font-black px-2 py-0.5 rounded-full inline-flex items-center gap-1 mb-2">
                        <Shield size={10} /> باقة {tenant.plan === 'pro' ? 'احترافية PRO' : 'أساسية'}
                      </span>
                      <p className="text-sm text-gray-600">ينتهي الاشتراك في: <span className="font-bold text-gray-900 font-mono">{tenant.planExpiresAt}</span></p>
                    </div>
                    <button className="text-xs font-bold text-bunyan-600 hover:underline">تجديد الاشتراك</button>
                  </div>
                </div>
              </div>

              <div>
                <h2 className="text-lg font-bold text-red-600 border-b border-red-100 pb-4 mb-4">منطقة الخطر (إدارة البيانات)</h2>
                <div className="flex flex-col gap-3">
                  <button onClick={() => showToast('جاري تصدير البيانات الشاملة كـ JSON', 'success')} className="w-fit flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg text-sm font-bold hover:bg-gray-50">
                    <Download size={16} /> تصدير نسخة احتياطية للبيانات
                  </button>
                  
                  <div className="p-4 rounded-xl border border-red-200 bg-red-50 mt-2 space-y-4">
                     <div className="flex items-center justify-between border-b border-red-200 pb-4">
                       <div><p className="font-bold text-red-900 text-sm flex items-center gap-1.5"><AlertTriangle size={16}/> مسح جميع بيانات النظام المعاملاتية</p><p className="text-xs text-red-700 mt-1">يؤدي لمسح كل الطلبيات، الخزينة، الديون، وأرصدة المخزون وإعادة المصنع لتلك الجداول.</p></div>
                     </div>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                           <label className="block text-xs font-bold text-red-800 mb-1.5">أدخل كلمة مرور المالك</label>
                           <input type="password" value={wipePassword} onChange={e => setWipePassword(e.target.value)} 
                             className="w-full p-2.5 bg-white border border-red-200 rounded-xl text-sm focus:border-red-500 focus:outline-none" />
                        </div>
                        <div>
                           <label className="block text-xs font-bold text-red-800 mb-1.5">أكتب للتوكيد: "أوافق على مسح المتجر نهائياً"</label>
                           <input type="text" value={wipeConfirm} onChange={e => setWipeConfirm(e.target.value)} placeholder="أوافق على مسح المتجر نهائياً"
                             className="w-full p-2.5 bg-white border border-red-200 rounded-xl text-sm focus:border-red-500 focus:outline-none" />
                        </div>
                     </div>
                     <button 
                        onClick={() => showToast('هذه الميزة مغلقة في بيئة الحماية', 'error')} 
                        disabled={wipePassword.length === 0 || wipeConfirm !== 'أوافق على مسح المتجر نهائياً'}
                        className="px-5 py-2.5 mt-2 bg-red-600 text-white font-bold text-sm rounded-lg hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all w-full md:w-auto">
                        تأكيد ومسح
                      </button>
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>

      <SlideOver isOpen={slideOpen} onClose={() => setSlideOpen(false)} title={editingUser ? 'تعديل المستخدم' : 'إضافة مستخدم جديد'}>
         <div className="space-y-4 pb-10 p-2 sm:p-4">
            <div><label className="block text-xs font-bold text-gray-700 mb-1.5">الاسم</label><input type="text" value={userForm.fullName || ''} onChange={(e) => setUserForm({...userForm, fullName: e.target.value})} className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm" /></div>
            <div><label className="block text-xs font-bold text-gray-700 mb-1.5">البريد الإلكتروني للولوج</label><input type="email" dir="ltr" value={userForm.email || ''} onChange={(e) => setUserForm({...userForm, email: e.target.value})} className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-left" /></div>
            <div><label className="block text-xs font-bold text-gray-700 mb-1.5">الدور الرئيسي</label>
              <select value={userForm.role || 'employee'} onChange={(e) => setUserForm({...userForm, role: e.target.value as any})} className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold">
                <option value="employee">موظف قياسي</option>
                <option value="partner">شريك إداري</option>
              </select>
            </div>
            {!editingUser ? (
              <div><label className="block text-xs font-bold text-gray-700 mb-1.5">تعيين كلمة مرور أولية</label><input type="password" value={userForm.passwordHash || ''} onChange={(e) => setUserForm({...userForm, passwordHash: e.target.value})} className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm" placeholder="123456" /></div>
            ) : (
              <div><label className="block text-xs font-bold text-gray-700 mb-1.5">تغيير كلمة المرور (اتركه فارغاً للاحتفاظ بالحالية)</label><input type="password" value={userForm.newPassword || ''} onChange={(e) => setUserForm({...userForm, newPassword: e.target.value})} className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm" placeholder="••••••••" /></div>
            )}
            
            <div className="bg-bunyan-50/50 p-4 border border-bunyan-100 rounded-xl space-y-3 mt-4">
              <h4 className="text-xs font-bold text-bunyan-900 mb-2">صلاحيات إضافية متقدمة</h4>
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input type="checkbox" checked={userForm.permissions?.inventory?.viewCostPrice || false} 
                  onChange={(e) => setUserForm({...userForm, permissions: {...(userForm.permissions as any), inventory: {...(userForm.permissions?.inventory as any), viewCostPrice: e.target.checked}}})} 
                  className="rounded text-bunyan-600 w-4 h-4"/> 
                السماح برؤية أسعار الشراء (التكلفة) للمنتجات
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input type="checkbox" checked={userForm.permissions?.analytics?.viewFull || false} 
                  onChange={(e) => setUserForm({...userForm, permissions: {...(userForm.permissions as any), analytics: {...(userForm.permissions?.analytics as any), viewFull: e.target.checked}}})} 
                  className="rounded text-bunyan-600 w-4 h-4"/> 
                السماح برؤية الأرباح وهوامش الربح في التحليلات
              </label>
            </div>

            <div className="pt-2"><label className="flex items-center gap-2 text-sm font-bold text-gray-900 cursor-pointer"><input type="checkbox" checked={userForm.isActive} onChange={(e) => setUserForm({...userForm, isActive: e.target.checked})} className="w-5 h-5 rounded text-bunyan-600" /> السماح للمستخدم بالولوج حالياً (مفعّل)</label></div>
            
            <button onClick={saveUser} className="w-full py-3 bg-bunyan-600 text-white font-bold rounded-xl mt-6">حفظ واعتماد</button>
            {editingUser && editingUser.role !== 'owner' && (
              <button onClick={() => showToast('تم الحذف', 'success')} className="w-full py-2 bg-red-50 text-red-600 font-bold rounded-xl mt-2">حذف المستخدم تماماً</button>
            )}
         </div>
      </SlideOver>

    </div>
  );
}
