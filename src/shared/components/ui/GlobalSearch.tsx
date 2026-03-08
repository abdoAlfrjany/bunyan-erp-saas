// src/shared/components/ui/GlobalSearch.tsx
// الوظيفة: بحث عام Ctrl+K — يبحث في المنتجات والطلبيات والشركاء والموظفين
// النتائج مجمّعة بالنوع — الضغط ينقل للصفحة المناسبة

'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Search, X, Package, ShoppingCart, Users, UserCheck, Command } from 'lucide-react';
import { useDataStore } from '@/core/db/store';
import { useAuthStore } from '@/core/auth/store';

interface SearchResult {
  id: string;
  type: 'product' | 'order' | 'partner' | 'employee';
  title: string;
  subtitle: string;
  href: string;
}

const typeConfig = {
  product:  { icon: Package,     label: 'منتج',    color: 'text-blue-600',   bg: 'bg-blue-50' },
  order:    { icon: ShoppingCart, label: 'طلبية',   color: 'text-amber-600',  bg: 'bg-amber-50' },
  partner:  { icon: Users,        label: 'شريك',    color: 'text-purple-600', bg: 'bg-purple-50' },
  employee: { icon: UserCheck,    label: 'موظف',    color: 'text-green-600',  bg: 'bg-green-50' },
};

export function GlobalSearch() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { products, orders, partners, employees } = useDataStore();

  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const tenantId = user?.tenantId ?? '';

  // Ctrl+K فتح
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen(true);
      }
      if (e.key === 'Escape') setIsOpen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Focus على الإدخال عند الفتح
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setQuery('');
      setResults([]);
    }
  }, [isOpen]);

  // البحث
  const search = useCallback((q: string) => {
    if (!q.trim() || q.length < 2) { setResults([]); return; }
    const lq = q.toLowerCase();
    const found: SearchResult[] = [];

    // منتجات
    products
      .filter(p => p.tenantId === tenantId && (p.name.includes(lq) || String(p.itemCode).toLowerCase().includes(lq) || p.category.includes(lq)))
      .slice(0, 3)
      .forEach(p => found.push({ id: p.id, type: 'product', title: p.name, subtitle: `${p.itemCode} | ${p.quantity} ${p.unit} | ${p.sellingPrice} د.ل`, href: '/inventory' }));

    // طلبيات
    orders
      .filter(o => o.tenantId === tenantId && (o.orderNumber.toLowerCase().includes(lq) || o.customerName.includes(lq) || o.customerPhone.includes(lq)))
      .slice(0, 3)
      .forEach(o => found.push({ id: o.id, type: 'order', title: `${o.orderNumber} — ${o.customerName}`, subtitle: `${o.customerPhone} | ${o.total} د.ل`, href: '/orders' }));

    // شركاء
    partners
      .filter(p => p.tenantId === tenantId && (p.name.includes(lq) || p.phone.includes(lq)))
      .slice(0, 2)
      .forEach(p => found.push({ id: p.id, type: 'partner', title: p.name, subtitle: `شريك | ${p.profitPercentage}% | ${p.phone}`, href: '/partners' }));

    // موظفون
    employees
      .filter(e => e.tenantId === tenantId && (e.name.includes(lq) || (e.phone && e.phone.includes(lq))))
      .slice(0, 2)
      .forEach(e => found.push({ id: e.id, type: 'employee', title: e.name, subtitle: `موظف | ${e.salary} د.ل/شهر | ${e.phone}`, href: '/hr' }));

    setResults(found);
    setSelectedIdx(0);
  }, [products, orders, partners, employees, tenantId]);

  useEffect(() => { search(query); }, [query, search]);

  // التنقل بالكيبورد
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIdx(i => Math.min(i + 1, results.length - 1)); }
      if (e.key === 'ArrowUp')   { e.preventDefault(); setSelectedIdx(i => Math.max(i - 1, 0)); }
      if (e.key === 'Enter' && results[selectedIdx]) {
        router.push(results[selectedIdx].href);
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, results, selectedIdx, router]);

  // جملة ملخص اليوم
  const todayOrders = orders.filter(o => {
    if (o.tenantId !== tenantId) return false;
    const today = new Date().toISOString().split('T')[0];
    return o.createdAt.startsWith(today) && o.status === 'pending';
  }).length;

  const lowStockCount = products.filter(p => p.tenantId === tenantId && p.quantity <= p.minQuantity && p.quantity > 0).length;

  const summaryText = todayOrders > 0
    ? `لديك ${todayOrders} طلبية جديدة اليوم${lowStockCount > 0 ? ` و${lowStockCount} منتج ينفد` : ''}`
    : lowStockCount > 0 ? `تنبيه: ${lowStockCount} منتج وصل للحد الأدنى` : 'كل شيء يسير بشكل ممتاز اليوم';

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 px-3 py-2 bg-white/10 hover:bg-white/15 border border-white/20 rounded-xl text-white/60 hover:text-white text-sm transition-all"
        title="بحث (Ctrl+K)"
      >
        <Search size={16} />
        <span className="hidden sm:inline text-xs">بحث...</span>
        <kbd className="hidden sm:inline text-xs bg-white/10 px-1.5 py-0.5 rounded border border-white/15">
          <Command size={10} className="inline" />K
        </kbd>
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-start justify-center pt-16 px-4" onClick={() => setIsOpen(false)}>
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      <div className="relative w-full max-w-lg animate-scale-up" onClick={e => e.stopPropagation()}>
        {/* جملة الملخص */}
        <div className="text-center mb-3">
          <p className="text-white/60 text-sm">{summaryText}</p>
        </div>

        {/* صندوق البحث */}
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden border border-gray-200">
          <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
            <Search size={20} className="text-bunyan-500 shrink-0" />
            <input
              ref={inputRef}
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="ابحث في المنتجات، الطلبيات، الشركاء..."
              className="flex-1 text-base outline-none text-gray-800 placeholder-gray-400"
            />
            <button onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
              <X size={20} />
            </button>
          </div>

          {/* النتائج */}
          {query.length >= 2 && (
            <div className="max-h-80 overflow-y-auto">
              {results.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  <Search size={32} className="mx-auto mb-2 opacity-30" />
                  <p className="text-sm">لا توجد نتائج لـ &quot;{query}&quot;</p>
                </div>
              ) : (
                <div className="p-2">
                  {results.map((r, idx) => {
                    const cfg = typeConfig[r.type];
                    const Icon = cfg.icon;
                    return (
                      <button
                        key={r.id}
                        onClick={() => { router.push(r.href); setIsOpen(false); }}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-right ${idx === selectedIdx ? 'bg-bunyan-50' : 'hover:bg-gray-50'}`}
                      >
                        <div className={`${cfg.bg} p-2 rounded-lg shrink-0`}>
                          <Icon size={16} className={cfg.color} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-800 truncate">{r.title}</p>
                          <p className="text-xs text-gray-400 truncate">{r.subtitle}</p>
                        </div>
                        <span className={`text-xs ${cfg.color} ${cfg.bg} px-2 py-0.5 rounded-full shrink-0`}>
                          {cfg.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* تلميح */}
          {query.length < 2 && (
            <div className="px-4 py-3 text-xs text-gray-400 flex items-center gap-2 border-t border-gray-100">
              <span>اكتب حرفين على الأقل للبدء بالبحث</span>
              <span className="mr-auto flex items-center gap-1">
                <kbd className="bg-gray-100 px-1.5 py-0.5 rounded text-gray-500">↑↓</kbd> تنقل
                <kbd className="bg-gray-100 px-1.5 py-0.5 rounded text-gray-500">Enter</kbd> فتح
                <kbd className="bg-gray-100 px-1.5 py-0.5 rounded text-gray-500">Esc</kbd> إغلاق
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
