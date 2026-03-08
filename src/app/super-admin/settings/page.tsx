'use client';

import { useState } from 'react';
import { Palette, Image as ImageIcon, Mail, Code, UploadCloud, Save, Check } from 'lucide-react';
import { useToast } from '@/shared/components/ui/Toast';

export default function SuperAdminSettings() {
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState('appearance');
  const [isSaving, setIsSaving] = useState(false);

  // Appearance State
  const [primaryColor, setPrimaryColor] = useState('#4a2570');
  const [secondaryColor, setSecondaryColor] = useState('#8b5cf6');
  const [fontFamily, setFontFamily] = useState('Cairo');
  const [baseFontSize, setBaseFontSize] = useState('14');

  // Logos State
  const [platformName, setPlatformName] = useState('Bunyan ERP');

  // SMTP State
  const [smtp, setSmtp] = useState({ host: 'smtp.example.com', port: '587', user: 'admin@bunyan.ly', pass: '********', fromName: 'Bunyan System' });

  // Custom Codes State
  const [customCodes, setCustomCodes] = useState({ header: '', footer: '' });

  const handleSave = () => {
    setIsSaving(true);
    setTimeout(() => {
      setIsSaving(false);
      showToast('تم حفظ الإعدادات بنجاح', 'success');
    }, 800);
  };

  const handleTestSmtp = () => {
    showToast('جاري اختبار الاتصال...', 'warning');
    setTimeout(() => {
      showToast('تم الاتصال بخادم البريد بنجاح', 'success');
    }, 1500);
  };

  const TABS = [
    { id: 'appearance', label: 'الألوان والخطوط', icon: Palette },
    { id: 'logos', label: 'الشعارات والهوية', icon: ImageIcon },
    { id: 'smtp', label: 'إعدادات البريد (SMTP)', icon: Mail },
    { id: 'codes', label: 'أكواد مخصصة', icon: Code },
  ];

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900">إعدادات المظهر والنظام</h1>
          <p className="text-sm text-gray-500 mt-1">تخصيص الهوية البصرية، وإعدادات المراسلة والأكواد للمنصة ككل.</p>
        </div>
        <button 
          onClick={handleSave} 
          disabled={isSaving}
          className="px-6 py-2 bg-bunyan-600 hover:bg-bunyan-700 text-white rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 shadow-sm disabled:opacity-70"
        >
          {isSaving ? <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save size={18} />}
          <span>حفظ التغييرات</span>
        </button>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Tabs Sidebar */}
        <div className="w-full lg:w-64 shrink-0">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-2 flex flex-row lg:flex-col gap-1 overflow-x-auto">
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-colors whitespace-nowrap ${
                  activeTab === tab.id 
                    ? 'bg-bunyan-50 text-bunyan-700' 
                    : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                <tab.icon size={18} className={activeTab === tab.id ? 'text-bunyan-600' : 'text-gray-400'} />
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content */}
        <div className="flex-1 bg-white rounded-2xl border border-gray-100 shadow-sm p-6 lg:p-8">
          
          {/* Appearance Tab */}
          {activeTab === 'appearance' && (
            <div className="space-y-8 animate-fade-in">
              <h2 className="text-lg font-bold text-gray-900 border-b border-gray-100 pb-4">إعدادات الألوان والخطوط</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-4">
                  <label className="block text-sm font-bold text-gray-700">اللون الأساسي (Primary Color)</label>
                  <div className="flex items-center gap-4">
                    <input 
                      type="color" 
                      value={primaryColor} 
                      onChange={(e) => setPrimaryColor(e.target.value)}
                      className="w-14 h-14 rounded-lg cursor-pointer border-0 p-0"
                    />
                    <input 
                      type="text" 
                      value={primaryColor}
                      onChange={(e) => setPrimaryColor(e.target.value)}
                      className="flex-1 px-4 py-2 border border-gray-200 rounded-xl font-mono text-left focus:ring-2 focus:ring-bunyan-500/20 outline-none" 
                      dir="ltr"
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <label className="block text-sm font-bold text-gray-700">اللون الثانوي (Secondary Color)</label>
                  <div className="flex items-center gap-4">
                    <input 
                      type="color" 
                      value={secondaryColor} 
                      onChange={(e) => setSecondaryColor(e.target.value)}
                      className="w-14 h-14 rounded-lg cursor-pointer border-0 p-0"
                    />
                    <input 
                      type="text" 
                      value={secondaryColor}
                      onChange={(e) => setSecondaryColor(e.target.value)}
                      className="flex-1 px-4 py-2 border border-gray-200 rounded-xl font-mono text-left focus:ring-2 focus:ring-bunyan-500/20 outline-none" 
                      dir="ltr"
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <label className="block text-sm font-bold text-gray-700">خط النظام الأساسي</label>
                  <select 
                    value={fontFamily}
                    onChange={(e) => setFontFamily(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:ring-2 focus:ring-bunyan-500/20 outline-none"
                  >
                    <option value="Cairo">Cairo (مقترح)</option>
                    <option value="Tajawal">Tajawal</option>
                    <option value="Almarai">Almarai</option>
                    <option value="IBM Plex Arabic">IBM Plex Arabic</option>
                  </select>
                </div>

                <div className="space-y-4">
                  <label className="block text-sm font-bold text-gray-700">حجم الخط الأساسي (px)</label>
                  <input 
                    type="number" 
                    value={baseFontSize}
                    onChange={(e) => setBaseFontSize(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl text-left bg-gray-50 focus:bg-white focus:ring-2 focus:ring-bunyan-500/20 outline-none" 
                    dir="ltr"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Logos Tab */}
          {activeTab === 'logos' && (
            <div className="space-y-8 animate-fade-in">
              <h2 className="text-lg font-bold text-gray-900 border-b border-gray-100 pb-4">الشعارات والهوية</h2>
              
              <div className="space-y-4">
                <label className="block text-sm font-bold text-gray-700">اسم المنصة (يظهر في Title الصفحة)</label>
                <input 
                  type="text" 
                  value={platformName}
                  onChange={(e) => setPlatformName(e.target.value)}
                  className="w-full max-w-md px-4 py-3 border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:ring-2 focus:ring-bunyan-500/20 outline-none" 
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pt-4">
                {/* Main Logo */}
                <div className="space-y-3">
                  <label className="block text-sm font-bold text-gray-700">الشعار الرئيسي</label>
                  <div className="h-40 border-2 border-dashed border-gray-200 rounded-2xl flex flex-col items-center justify-center gap-2 hover:border-bunyan-400 hover:bg-bunyan-50/50 transition-colors cursor-pointer group">
                    <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center group-hover:bg- bunyan-100 transition-colors">
                      <UploadCloud size={20} className="text-gray-400 group-hover:text-bunyan-600" />
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-bold text-gray-700">انقر للرفع</p>
                      <p className="text-xs text-gray-400 mt-1">PNG أو SVG (حتى 2MB)</p>
                    </div>
                  </div>
                </div>

                {/* Square Logo */}
                <div className="space-y-3">
                  <label className="block text-sm font-bold text-gray-700">شعار مصغر (للقائمة المطوية)</label>
                  <div className="h-40 border-2 border-dashed border-gray-200 rounded-2xl flex flex-col items-center justify-center gap-2 hover:border-bunyan-400 hover:bg-bunyan-50/50 transition-colors cursor-pointer group">
                    <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center group-hover:bg-bunyan-100 transition-colors">
                      <UploadCloud size={20} className="text-gray-400 group-hover:text-bunyan-600" />
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-bold text-gray-700">انقر للرفع</p>
                      <p className="text-xs text-gray-400 mt-1">مربع 1:1</p>
                    </div>
                  </div>
                </div>

                {/* Favicon */}
                <div className="space-y-3">
                  <label className="block text-sm font-bold text-gray-700">أيقونة المتصفح (Favicon)</label>
                  <div className="h-40 border-2 border-dashed border-gray-200 rounded-2xl flex flex-col items-center justify-center gap-2 hover:border-bunyan-400 hover:bg-bunyan-50/50 transition-colors cursor-pointer group">
                    <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center group-hover:bg-bunyan-100 transition-colors">
                      <UploadCloud size={20} className="text-gray-400 group-hover:text-bunyan-600" />
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-bold text-gray-700">انقر للرفع</p>
                      <p className="text-xs text-gray-400 mt-1">32x32 ICO أو PNG</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* SMTP Tab */}
          {activeTab === 'smtp' && (
            <div className="space-y-8 animate-fade-in">
              <div className="flex items-center justify-between border-b border-gray-100 pb-4">
                <h2 className="text-lg font-bold text-gray-900">إعدادات البريد الصادر (SMTP)</h2>
                <button onClick={handleTestSmtp} className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-lg text-sm font-bold transition-colors">
                  اختبار الاتصال
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl">
                <div className="space-y-2">
                  <label className="block text-sm font-bold text-gray-700">الخادم (Host)</label>
                  <input type="text" value={smtp.host} onChange={e => setSmtp({...smtp, host: e.target.value})} className="w-full px-4 py-3 border border-gray-200 rounded-xl text-left bg-gray-50 focus:bg-white focus:ring-2 outline-none" dir="ltr" />
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-bold text-gray-700">المنفذ (Port)</label>
                  <input type="text" value={smtp.port} onChange={e => setSmtp({...smtp, port: e.target.value})} className="w-full px-4 py-3 border border-gray-200 rounded-xl text-left bg-gray-50 focus:bg-white focus:ring-2 outline-none" dir="ltr" />
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-bold text-gray-700">اسم المستخدم (Username)</label>
                  <input type="text" value={smtp.user} onChange={e => setSmtp({...smtp, user: e.target.value})} className="w-full px-4 py-3 border border-gray-200 rounded-xl text-left bg-gray-50 focus:bg-white focus:ring-2 outline-none" dir="ltr" />
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-bold text-gray-700">كلمة المرور (Password)</label>
                  <input type="password" value={smtp.pass} onChange={e => setSmtp({...smtp, pass: e.target.value})} className="w-full px-4 py-3 border border-gray-200 rounded-xl text-left bg-gray-50 focus:bg-white focus:ring-2 outline-none" dir="ltr" />
                </div>
                <div className="col-span-1 md:col-span-2 space-y-2">
                  <label className="block text-sm font-bold text-gray-700">اسم المرسل (From Name)</label>
                  <input type="text" value={smtp.fromName} onChange={e => setSmtp({...smtp, fromName: e.target.value})} className="w-full px-4 py-3 border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:ring-2 outline-none" />
                </div>
              </div>
            </div>
          )}

          {/* Codes Tab */}
          {activeTab === 'codes' && (
            <div className="space-y-8 animate-fade-in">
              <h2 className="text-lg font-bold text-gray-900 border-b border-gray-100 pb-4">أكواد التتبع المخصصة</h2>
              
              <div className="space-y-6">
                <div className="space-y-3">
                  <label className="block text-sm font-bold text-gray-700">أكواد الهيدر (Header Scripts)</label>
                  <p className="text-xs text-gray-500">تستخدم لأكواد Google Analytics و Meta Pixel وغيرها، سيتم حقنها داخل الـ &lt;head&gt; لجميع المتاجر.</p>
                  <textarea 
                    value={customCodes.header}
                    onChange={e => setCustomCodes({...customCodes, header: e.target.value})}
                    placeholder="<!-- أدخل الأكواد هنا -->"
                    className="w-full h-40 px-4 py-3 border border-gray-200 rounded-xl font-mono text-sm text-left bg-gray-900 text-gray-100 focus:ring-2 focus:ring-bunyan-500/20 outline-none resize-none"
                    dir="ltr"
                  />
                </div>

                <div className="space-y-3">
                  <label className="block text-sm font-bold text-gray-700">أكواد الفوتر (Footer Scripts)</label>
                  <p className="text-xs text-gray-500">تستخدم لأكواد الشات المباشر (Live Chat) وغيرها، يتم حقنها قبل نهاية &lt;/body&gt;.</p>
                  <textarea 
                    value={customCodes.footer}
                    onChange={e => setCustomCodes({...customCodes, footer: e.target.value})}
                    placeholder="<!-- أدخل الأكواد هنا -->"
                    className="w-full h-40 px-4 py-3 border border-gray-200 rounded-xl font-mono text-sm text-left bg-gray-900 text-gray-100 focus:ring-2 focus:ring-bunyan-500/20 outline-none resize-none"
                    dir="ltr"
                  />
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
