'use client';

// src/app/super-admin/city-mappings/page.tsx
// محرك المطابقة الجغرافية — Enterprise Rebuild | لا credentials هنا

import { useState, useEffect, Fragment } from 'react';
import Link from 'next/link';
import { useDataStore } from '@/core/db/store';
import { useToast } from '@/shared/components/ui/Toast';
import { Menu, Transition, Dialog } from '@headlessui/react';
import {
  MapPin, Search, Plus, RefreshCw, Link2, CheckCircle2, AlertTriangle, Truck,
  X, ChevronDown, ChevronUp, Save, SaveAll, Loader2, BookOpen, Map, Wand2,
  PlugZap, ArrowLeft, Filter,
} from 'lucide-react';
import { Logo } from '@/shared/components/ui/Logo';
import { cn } from '@/shared/utils/cn';

// ═══ Constants ═══
const MOCK_BUNYAN_TREE = [
  { city: 'طرابلس', regions: ['السياحية', 'حي الأندلس', 'قصر بن غشير', 'عين زارة', 'تاجوراء', 'سوق الجمعة', 'النوفليين', 'أبو سليم'] },
  { city: 'بنغازي', regions: ['الكيش', 'الماجوري', 'الفويهات', 'بوعطني', 'سيدي حسين', 'البركة', 'طابلينو'] },
  { city: 'مصراتة', regions: ['وسط المدينة', 'المقاصبة', 'زاوية المحجوب', 'قصر أحمد', 'الرويسات', 'الدافنية'] },
  { city: 'الزاوية', regions: ['الزاوية المركز', 'الزاوية الغربية', 'الزاوية الجنوبية', 'جودائم', 'المطرد'] },
];

const AVAILABLE_PROVIDERS = [
  { id: 'vanex', name: 'VANEX', description: 'منصة التوصيل الرائدة في ليبيا' }
] as const;

// ═══ Custom Dropdown ═══
function HeadlessDropdown({
  options, value, onChange, placeholder, disabled, searchable = true, allowAdd = false, onAdd, addLabel
}: {
  options: { value: string | number; label: string; icon?: React.ReactNode }[];
  value: string | number | null;
  onChange: (v: string | number) => void;
  placeholder?: string;
  disabled?: boolean;
  searchable?: boolean;
  allowAdd?: boolean;
  onAdd?: (newVal: string) => void;
  addLabel?: string;
}) {
  const [search, setSearch] = useState('');
  const selected = options.find(o => o.value === value);
  const filtered = options.filter(o =>
    String(o.label).toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Menu as="div" className="relative w-full text-right inline-block">
      <div>
        <Menu.Button
          disabled={disabled}
          className={`w-full flex items-center justify-between px-3 py-2
            border rounded-xl text-sm transition-all bg-white
            focus:outline-none focus:ring-2 focus:ring-bunyan-500/20 shadow-sm ${
              disabled
                ? 'border-gray-100 bg-gray-50 text-gray-400 cursor-not-allowed'
                : 'border-gray-200 hover:border-bunyan-300 focus:border-bunyan-400 cursor-pointer'
            }`}
        >
          <span className={`flex items-center gap-2 truncate ${selected ? 'text-gray-900 font-bold' : 'text-gray-400'}`}>
            {selected?.icon && <span className="shrink-0">{selected.icon}</span>}
            {disabled && !selected ? 'جارٍ التحميل...' : selected?.label ?? placeholder ?? 'اختر...'}
          </span>
          <ChevronDown className="-mr-1 ml-2 h-4 w-4 text-gray-400" aria-hidden="true" />
        </Menu.Button>
      </div>

      <Transition
        as={Fragment}
        enter="transition ease-out duration-100"
        enterFrom="transform opacity-0 scale-95"
        enterTo="transform opacity-100 scale-100"
        leave="transition ease-in duration-75"
        leaveFrom="transform opacity-100 scale-100"
        leaveTo="transform opacity-0 scale-95"
      >
        <Menu.Items className="absolute right-0 z-50 mt-1 w-[120%] origin-top-right rounded-xl bg-white shadow-xl ring-1 ring-black ring-opacity-5 focus:outline-none max-h-60 flex flex-col">
          {searchable && (
            <div className="p-2 border-b border-gray-100 shrink-0">
              <div className="relative">
                <Search className="absolute right-2.5 top-2.5 h-4 w-4 text-gray-400" />
                <input
                  autoFocus
                  type="text"
                  className="w-full bg-gray-50 border border-gray-200 text-gray-900 text-sm rounded-lg focus:ring-bunyan-500 focus:border-bunyan-500 block pr-9 p-2 outline-none"
                  placeholder="بحث..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  onKeyDown={(e) => {
                    if (e.key === ' ' || e.code === 'Space') {
                      e.stopPropagation();
                    }
                  }}
                />
              </div>
            </div>
          )}
          <div className="overflow-y-auto overflow-x-hidden w-full flex-1 p-1">
            {filtered.length === 0 ? (
              <div className="px-4 py-3 text-sm text-gray-500 text-center">لا توجد نتائج</div>
            ) : (
              filtered.map((item) => (
                <Menu.Item key={item.value}>
                  {({ active }) => (
                    <button
                      type="button"
                      onClick={() => { onChange(item.value); setSearch(''); }}
                      className={`${
                        active ? 'bg-bunyan-50 text-bunyan-700' : 'text-gray-700'
                      } ${value === item.value ? 'bg-bunyan-50 font-bold text-bunyan-700' : ''} group flex w-full gap-2 items-center rounded-lg px-3 py-2 text-sm transition-colors`}
                    >
                      {item.icon && <span className="shrink-0">{item.icon}</span>}
                      {item.label}
                    </button>
                  )}
                </Menu.Item>
              ))
            )}
          </div>
          {allowAdd && search.trim() !== '' && filtered.length === 0 && onAdd && (
            <div className="p-2 border-t border-gray-100 shrink-0 bg-gray-50 rounded-b-xl">
              <button
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); onAdd(search); setSearch(''); }}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-bunyan-100 px-3 py-2 text-sm font-bold text-bunyan-700 hover:bg-bunyan-200 transition-colors"
              >
                <Plus size={16} />
                <span>{addLabel ? addLabel : `إضافة "${search}"`}</span>
              </button>
            </div>
          )}
        </Menu.Items>
      </Transition>
    </Menu>
  );
}

// ═══ Sub-Regions Nested Table ═══
function NestedRegionsTable({
  providerCityId, providerCityName, provider, cityMappingId
}: {
  providerCityId: number; providerCityName: string; provider: string; cityMappingId: string;
}) {
  const { fetchProviderRegions, providerRegionsData, shippingRegionMappings, addRegionMapping, shippingCityMappings, bunyanRegions } = useDataStore();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [savingAll, setSavingAll] = useState(false);
  const [regionsList, setRegionsList] = useState<import('@/core/types').VanexSubCity[]>([]);
  const [localMap, setLocalMap] = useState<Record<number, number>>({});
  const [showPendingOnly, setShowPendingOnly] = useState(false);

  const parentMapping = shippingCityMappings.find(m => m.id === cityMappingId);
  const bunyanCityId = parentMapping?.bunyan_city_id;

  const handleAddCustomRegion = async (regionName: string, providerRegionId: number) => {
    if (!bunyanCityId) {
      showToast('يجب ربط المدينة الرئيسية أولاً لإضافة مناطق', 'error');
      return;
    }
    const res = await useDataStore.getState().addBunyanRegion(regionName, Number(bunyanCityId));
    if (res.success && res.data) {
      const newId = res.data.id;
      setLocalMap(prev => ({ ...prev, [providerRegionId]: newId }));
      showToast('تمت إضافة المنطقة بنجاح', 'success');
    } else {
      showToast(res.error || 'فشل إضافة المنطقة', 'error');
    }
  };

  useEffect(() => {
    let isMounted = true;
    const fetchRegions = async () => {
      if (!providerRegionsData[providerCityId]) {
        setLoading(true);
        const res = await fetchProviderRegions(providerCityId);
        if (isMounted) {
          setLoading(false);
          if (!res.success) showToast(res.error || 'خطأ في جلب المناطق', 'error');
          else setRegionsList(useDataStore.getState().providerRegionsData[providerCityId] || []);
        }
      } else {
        setRegionsList(providerRegionsData[providerCityId] || []);
      }
    };
    fetchRegions();
    return () => { isMounted = false; };
  }, [providerCityId, providerRegionsData, fetchProviderRegions, showToast]);

  useEffect(() => {
    const currentMappings = shippingRegionMappings.filter(r => String(r.city_mapping_id) === String(cityMappingId));
    const newMap: Record<number, number> = {};
    currentMappings.forEach(r => { 
      if (r.provider_region_id) {
        newMap[Number(r.provider_region_id)] = Number(r.bunyan_region_id); 
      }
    });
    setLocalMap(newMap);
  }, [cityMappingId, shippingRegionMappings]);

  const handleSaveRegion = async (regionId: number, regionName: string, batch = false) => {
    const bunyanRegionId = localMap[regionId];
    if (!bunyanRegionId) {
      if (!batch) showToast('الرجاء اختيار اسم المنطقة في بنيان أولاً', 'error');
      return false;
    }

    if (!batch) setSavingId(regionId);
    if (!batch) await new Promise(resolve => setTimeout(resolve, 600));

    try {
      const existing = shippingRegionMappings.find(r => r.city_mapping_id === cityMappingId && r.provider_region_id === regionId);
      const mappingData: {
        id?: string;
        city_mapping_id: string;
        provider: string;
        provider_city_id: number;
        bunyan_region_id: number;
        provider_region_id: number;
        is_active: boolean;
      } = {
        city_mapping_id: cityMappingId,
        provider: provider,
        provider_city_id: providerCityId,
        bunyan_region_id: Number(bunyanRegionId),
        provider_region_id: regionId,
        is_active: true,
      };
      if (existing) mappingData.id = existing.id;
      const res = await addRegionMapping(mappingData as unknown as Parameters<typeof addRegionMapping>[0]);

      if (res && res.success === false) throw new Error(res.error);
      if (!batch) showToast(`✅ تم ربط ${regionName} بنجاح`, 'success');
      return true;
    } catch {
      if (!batch) showToast('حدث خطأ أثناء حفظ المطابقة', 'error');
      return false;
    } finally {
      if (!batch) setSavingId(null);
    }
  };

  const handleBulkSave = async () => {
    setSavingAll(true);
    await new Promise(resolve => setTimeout(resolve, 800));
    let savedCount = 0;
    for (const region of regionsList) {
      if (localMap[region.id]) {
        const success = await handleSaveRegion(region.id, region.name, true);
        if (success) savedCount++;
      }
    }
    setSavingAll(false);
    if (savedCount > 0) showToast(`✅ تم حفظ مطابقة ${savedCount} منطقة بنجاح`, 'success');
    else showToast('لا توجد وحدات لحفظها أو كلها محفوظة بالفعل', 'info');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8 bg-white border border-gray-100 rounded-xl">
        <Loader2 className="animate-spin text-bunyan-500 ml-3" size={20} />
        <span className="text-gray-500 text-sm font-medium">جاري جلب المناطق من المزود...</span>
      </div>
    );
  }

  if (regionsList.length === 0) {
    return (
      <div className="text-center p-8 bg-gray-50 rounded-xl text-gray-500 border border-gray-100 border-dashed text-sm">
        لا توجد مناطق جغرافية مسجلة لهذه المدينة.
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="px-5 py-3 bg-gray-50/80 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-2 text-gray-800 font-bold text-sm">
          <MapPin size={14} className="text-bunyan-500" />
          مناطق {providerCityName}
          <span className="text-xs font-normal text-gray-400">({regionsList.length} منطقة)</span>
        </div>
        <button
          onClick={handleBulkSave}
          disabled={savingAll}
          className="flex items-center gap-1.5 bg-bunyan-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-bunyan-700 transition disabled:opacity-50"
        >
          {savingAll ? <Loader2 size={12} className="animate-spin" /> : <SaveAll size={12} />}
          حفظ الكل
        </button>
        <button
          onClick={() => setShowPendingOnly(!showPendingOnly)}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border",
            showPendingOnly 
              ? "bg-amber-50 text-amber-700 border-amber-200" 
              : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
          )}
        >
          <Filter size={12} />
          المعلق فقط
        </button>
      </div>
      <table className="w-full text-right text-sm">
        <thead className="bg-gray-50/50 text-gray-500 border-b border-gray-100 text-xs uppercase tracking-wider">
          <tr>
            <th className="px-5 py-3 font-bold">المنطقة (المزود)</th>
            <th className="px-5 py-3 font-bold w-1/2">المقابل في بنيان</th>
            <th className="px-5 py-3 font-bold text-center w-20">حفظ</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {regionsList.filter(region => {
            if (!showPendingOnly) return true;
            const isMapped = shippingRegionMappings.some(m => 
              String(m.city_mapping_id) === String(cityMappingId) && 
              String(m.provider_region_id) === String(region.id) &&
              String(m.bunyan_region_id) === String(localMap[region.id])
            );
            return !isMapped;
          }).map(region => {
            const isSaving = savingId === region.id;
            const isMapped = shippingRegionMappings.some(m => 
              String(m.city_mapping_id) === String(cityMappingId) && 
              String(m.provider_region_id) === String(region.id) &&
              String(m.bunyan_region_id) === String(localMap[region.id])
            );
            return (
              <tr key={region.id} className={`transition-colors ${isMapped ? 'bg-emerald-50/30' : 'hover:bg-gray-50/50'}`}>
                <td className="px-5 py-3">
                  <div className="flex items-center gap-2">
                    <span className={`font-semibold ${isMapped ? 'text-emerald-900' : 'text-gray-800'}`}>{region.name}</span>
                    {isMapped && <CheckCircle2 size={13} className="text-emerald-500" />}
                    <span className="ml-auto text-[10px] bg-gray-100 text-gray-400 px-1.5 py-0.5 rounded font-mono">#{region.id}</span>
                  </div>
                </td>
                <td className="px-5 py-3">
                  <HeadlessDropdown
                    options={bunyanRegions.filter(r => r.city_id === bunyanCityId).map(r => ({ value: r.id, label: r.name_ar }))}
                    value={localMap[region.id] || null}
                    onChange={(val) => setLocalMap(prev => ({ ...prev, [region.id]: Number(val) }))}
                    placeholder="اختر للمطابقة..."
                    disabled={isSaving || savingAll}
                    allowAdd
                    onAdd={(val) => handleAddCustomRegion(val, region.id)}
                  />
                </td>
                <td className="px-5 py-3 text-center">
                  <button
                    disabled={isSaving || savingAll}
                    onClick={() => handleSaveRegion(region.id, region.name)}
                    className={`w-8 h-8 rounded-lg inline-flex items-center justify-center transition-all active:scale-95 ${
                      isMapped
                        ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-600 hover:text-white border border-emerald-200'
                        : 'bg-gray-50 text-gray-600 hover:bg-bunyan-600 hover:text-white border border-gray-200'
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                    title="حفظ الربط"
                  >
                    {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ═══ Main Page ═══
export default function CityMappingsPage() {
  const {
    shippingCityMappings, addCityMapping,
    providerCitiesData, providerRegionsData,
    shippingRegionMappings, superAdminCouriers, addBunyanCity,
    bunyanCities, bunyanRegions
  } = useDataStore();
  const { showToast } = useToast();

  const [selectedProvider, setSelectedProvider] = useState<string>('vanex');
  const [isRefDrawerOpen, setIsRefDrawerOpen] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  const [gridMap, setGridMap] = useState<Record<number, string | number>>({});
  const [expandedRows, setExpandedRows] = useState<number[]>([]);
  const [savingCityId, setSavingCityId] = useState<number | null>(null);
  const [showPendingCitiesOnly, setShowPendingCitiesOnly] = useState(false);

  // ─── Check if the selected provider is connected (has a valid token) ───
  const isProviderConnected = superAdminCouriers.some(
    c => c.provider === selectedProvider && c.apiCredentials?.token
  );

  // Auto-fetch geo mappings from Supabase on mount
  useEffect(() => {
    useDataStore.getState().fetchGeoMappings();
  }, []);

  // Sync initial grid state
  useEffect(() => {
    const initialMap: Record<number, string | number> = {};
    providerCitiesData.forEach(pc => {
      const mapping = shippingCityMappings.find(m => String(m.provider_city_id) === String(pc.id) && m.is_active);
      if (mapping) {
        if (mapping.bunyan_city_id) initialMap[pc.id] = `city_${mapping.bunyan_city_id}`;
        else if (mapping.bunyan_region_id) initialMap[pc.id] = `region_${mapping.bunyan_region_id}`;
      }
    });
    setGridMap(initialMap);
  }, [providerCitiesData, shippingCityMappings]);

  // Auto-fetch regions on valid selection
  useEffect(() => {
    if (isProviderConnected && providerCitiesData.length === 0 && !isFetching) {
      handleFetchData();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProvider, isProviderConnected]);

  const handleFetchData = async () => {
    const connectedCourier = superAdminCouriers.find(
      c => c.provider === selectedProvider && c.apiCredentials?.token
    );
    if (!connectedCourier?.apiCredentials?.token) {
      showToast('يجب ربط حساب API أولاً من صفحة إعدادات التكامل', 'error');
      return;
    }

    setIsFetching(true);
    try {
      if (selectedProvider === 'vanex') {
        const { vanexAdapter } = await import('@/core/delivery/VanexAdapter');
        
        const email = connectedCourier.apiCredentials.email;
        const passHash = connectedCourier.apiCredentials.passwordHash;
        const token = connectedCourier.apiCredentials.token;

        // Auto-Retry requirements
        if (email && passHash) {
          vanexAdapter.setCredentials(email, passHash);
        }

        // Fetch using token directly!
        const cities = await vanexAdapter.getCities(token);
        
        if (!cities || cities.length === 0) {
          throw new Error('الاستجابة نجحت ولكن مصفوفة المدن فارغة');
        }

        const processedCities = (cities as unknown as { id: number; name: string; nameEn: string; active: boolean; code?: string; regionId?: number; }[]).map((c) => {
          const hasRegions = ['طرابلس', 'بنغازي', 'مصراتة', 'سرت', 'الزاوية', 'الخمس', 'Tripoli', 'Benghazi', 'Misrata'].some(name => 
             c.name?.includes(name) || c.nameEn?.includes(name)
          );
          return {
            ...c,
            code: c.code || String(c.id),
            regionId: c.regionId || 0,
            isActive: c.active, 
            hasSubRegions: hasRegions,
          };
        });

        useDataStore.setState({ providerCitiesData: processedCities, vanexCities: cities });
        
        // Ensure child functions can access token if they rely on it in state
        const { useProviderAuthStore } = await import('@/core/db/store');
        useProviderAuthStore.getState().setActiveProviderToken(token);

        showToast('✅ تم جلب البيانات بنجاح', 'success');
      } else {
        showToast('طريقة الجلب غير مدعومة لهذا المزود', 'error');
      }
    } catch (err: unknown) {
      showToast((err as Error).message || 'فشل الاتصال بالمزود', 'error');
    } finally {
      setIsFetching(false);
    }
  };

  const handleAddCustomCity = async (cityName: string, providerCityId: number) => {
    const res = await addBunyanCity(cityName);
    if (res.success && res.data) {
      const newId = res.data.id;
      setGridMap(prev => ({ ...prev, [providerCityId]: `city_${newId}` }));
      showToast('تمت إضافة المدينة بنجاح', 'success');
    } else {
      showToast(res.error || 'فشل إضافة المدينة', 'error');
    }
  };

  const handleSaveCityMapping = async (providerCity: import('@/core/types').VanexCity) => {
    const rawVal = gridMap[providerCity.id];
    if (!rawVal) { showToast('الرجاء اختيار مدينة أو منطقة من القائمة', 'error'); return; }
    
    const selectedBunyan = String(rawVal);

    setSavingCityId(providerCity.id);
    await new Promise(resolve => setTimeout(resolve, 300));

    try {
      const existingMapping = shippingCityMappings.find(m => String(m.provider_city_id) === String(providerCity.id));

      const isRegion = selectedBunyan.startsWith('region_');
      const realId = Number(selectedBunyan.replace('city_', '').replace('region_', ''));

      const mappingData: {
        id?: string;
        provider: string;
        bunyan_city_id: number | null;
        bunyan_region_id: number | null;
        parent_mapping_id: string | null;
        provider_city_id: number;
        provider_region_id: number | null;
        is_active: boolean;
      } = {
        provider: selectedProvider,
        bunyan_city_id: isRegion ? null : realId,
        bunyan_region_id: isRegion ? realId : null,
        parent_mapping_id: null,
        provider_city_id: providerCity.id,
        provider_region_id: null,
        is_active: true,
      };
      if (existingMapping) mappingData.id = existingMapping.id;

      const res = await addCityMapping(mappingData as unknown as import('@/core/types').ShippingCityMapping);
      if (!res.success) { showToast(res.error || 'خطأ في حفظ المدينة', 'error'); return; }
      showToast(`تم مطابقة ${providerCity.name} بنجاح`, 'success');
    } finally {
      setSavingCityId(null);
    }
  };

  const handleAutoMatch = async () => {
    if (providerCitiesData.length === 0) return;
    setIsFetching(true);
    let matchCount = 0;
    
    // Simulate smart thinking UX
    await new Promise(resolve => setTimeout(resolve, 600));

    for (const providerCity of providerCitiesData) {
      if (gridMap[providerCity.id]) continue; // Skip existing mappings
      
      const normalizedName = providerCity.name.trim();
      const existingMapping = shippingCityMappings.find(m => String(m.provider_city_id) === String(providerCity.id));
      
      // 1. Check Cities
      const cMatch = bunyanCities.find(c => c.name_ar === normalizedName);
      if (cMatch) {
         setGridMap(prev => ({...prev, [providerCity.id]: `city_${cMatch.id}`}));
         const mappingData: {
            id?: string;
            provider: string;
            bunyan_city_id: number;
            bunyan_region_id: number | null;
            parent_mapping_id: string | null;
            provider_city_id: number;
            provider_region_id: number | null;
            is_active: boolean;
         } = {
            provider: selectedProvider,
            bunyan_city_id: cMatch.id,
            bunyan_region_id: null,
            parent_mapping_id: null,
            provider_city_id: providerCity.id,
            provider_region_id: null,
            is_active: true
         };
          if (existingMapping) mappingData.id = existingMapping.id;
          await addCityMapping(mappingData as unknown as import('@/core/types').ShippingCityMapping);
         matchCount++;
         continue;
      }

      // 2. Check Regions
      const rMatch = bunyanRegions.find(r => r.name_ar === normalizedName);
      if (rMatch) {
         setGridMap(prev => ({...prev, [providerCity.id]: `region_${rMatch.id}`}));
         const mappingData: {
            id?: string;
            provider: string;
            bunyan_city_id: number | null;
            bunyan_region_id: number;
            parent_mapping_id: string | null;
            provider_city_id: number;
            provider_region_id: number | null;
            is_active: boolean;
         } = {
            provider: selectedProvider,
            bunyan_city_id: null,
            bunyan_region_id: rMatch.id,
            parent_mapping_id: null,
            provider_city_id: providerCity.id,
            provider_region_id: null,
            is_active: true
         };
         if (existingMapping) mappingData.id = existingMapping.id;
         await addCityMapping(mappingData as unknown as import('@/core/types').ShippingCityMapping);
         matchCount++;
      }
    }
    
    setIsFetching(false);
    if (matchCount > 0) {
      showToast(`🪄 تمت المطابقة الذكية وربط ${matchCount} سجل تلقائياً`, 'success');
    } else {
      showToast('لم يتم العثور على أي تطابقات تلقائية لأسماء غير مربوطة من قبل', 'info');
    }
  };

  const toggleRow = (cityId: number) => {
    setExpandedRows(prev =>
      prev.includes(cityId) ? prev.filter(id => id !== cityId) : [...prev, cityId]
    );
  };

  // Progress stats
  const totalCities = providerCitiesData.length;
  const mappedCities = shippingCityMappings.filter(m => m.provider === selectedProvider && m.is_active).length;
  const progressPercent = totalCities > 0 ? Math.round((mappedCities / totalCities) * 100) : 0;

  const combinedOptions = [
    ...bunyanCities.map(c => ({ value: `city_${c.id}`, label: `🏙️ مدينة: ${c.name_ar}` })),
    ...bunyanRegions.map(r => ({ value: `region_${r.id}`, label: `📍 منطقة: ${r.name_ar}` }))
  ];

  return (
    <div className="bg-gray-50/50 min-h-full">
      {/* ══ Header ══ */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-gradient-to-br from-bunyan-50 to-purple-50 border border-bunyan-100 rounded-xl flex items-center justify-center text-bunyan-600 shrink-0">
            <Link2 size={20} />
          </div>
          <div>
            <h1 className="text-xl font-black text-gray-900">محرك المطابقة الجغرافية</h1>
            <p className="text-sm text-gray-500 mt-0.5">Geo-Mapping Engine — ربط مدن المزود بمدن بنيان</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Reference Guide Button */}
          <button
            onClick={() => setIsRefDrawerOpen(true)}
            className="h-10 px-4 rounded-xl flex items-center gap-2 font-bold text-bunyan-700 bg-bunyan-50 border border-bunyan-100 hover:bg-bunyan-100 transition-colors text-sm"
          >
            <Map size={16} />
            دليل بنيان
          </button>

          {/* Provider Selector */}
          <div className="flex items-center gap-2 bg-gray-50 p-1 rounded-xl border border-gray-200">
            <div className="w-32">
              <HeadlessDropdown
                options={AVAILABLE_PROVIDERS.map(p => ({
                  value: p.id,
                  label: p.name,
                }))}
                value={selectedProvider}
                onChange={(v) => { setSelectedProvider(v as string); setExpandedRows([]); }}
                searchable={false}
              />
            </div>

            {/* Refresh — only if connected */}
            {isProviderConnected && (
              <button
                onClick={handleFetchData}
                disabled={isFetching}
                className="w-10 h-10 rounded-lg flex items-center justify-center text-white bg-bunyan-600 hover:bg-bunyan-700 transition-colors disabled:opacity-60"
                title="تحديث البيانات من API"
              >
                {isFetching ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ══ Guard: Provider Not Connected ══ */}
      {!isProviderConnected ? (
        <div className="bg-white rounded-2xl border-2 border-dashed border-gray-200 p-16 text-center">
          <div className="relative w-20 h-20 mx-auto mb-5">
            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center">
              <Truck size={36} className="text-gray-300" />
            </div>
            <div className="absolute top-0 right-0 w-7 h-7 bg-amber-400 rounded-full border-2 border-white flex items-center justify-center">
              <AlertTriangle size={14} className="text-white" />
            </div>
          </div>
          <h3 className="text-xl font-black text-gray-800 mb-2">
            {AVAILABLE_PROVIDERS.find(p => p.id === selectedProvider)?.name ?? selectedProvider} غير متصل بعد
          </h3>
          <p className="text-gray-500 max-w-sm mx-auto text-sm leading-relaxed mb-6">
            يجب ربط حساب API الخاص بهذا المزود أولاً قبل البدء في مطابقة المدن.
          </p>
          <Link
            href="/super-admin/couriers"
            className="inline-flex items-center gap-2 bg-bunyan-600 hover:bg-bunyan-700 text-white px-5 py-2.5 rounded-xl font-bold text-sm transition-all shadow-sm hover:shadow-md"
          >
            <PlugZap size={16} />
            الذهاب لإعدادات التكامل
            <ArrowLeft size={14} />
          </Link>
        </div>
      ) : (
        <>
          {/* ══ Progress Strip ══ */}
          {totalCities > 0 && (
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-bold text-gray-700">تقدم المطابقة</span>
                <span className="text-sm text-gray-500">
                  تم مطابقة <span className="font-black text-bunyan-600">{mappedCities}</span> من{' '}
                  <span className="font-bold text-gray-800">{totalCities}</span> مدينة
                  <span className="mr-2 text-xs text-gray-400">({progressPercent}%)</span>
                </span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-bunyan-500 to-purple-500 rounded-full transition-all duration-700"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
          )}

          {/* ══ Empty Data State ══ */}
          {providerCitiesData.length === 0 ? (
            <div className="bg-white rounded-2xl border-2 border-dashed border-gray-200 p-14 text-center">
              <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Truck size={28} className="text-gray-300" />
              </div>
              <h3 className="text-lg font-black text-gray-800 mb-2">لم يتم جلب البيانات بعد</h3>
              <p className="text-sm text-gray-500 mb-5 max-w-sm mx-auto">
                اضغط زر &quot;تحديث البيانات&quot; في أعلى الصفحة لجلب قائمة المدن من مزود التوصيل.
              </p>
              <button
                onClick={handleFetchData}
                disabled={isFetching}
                className="inline-flex items-center gap-2 bg-bunyan-600 hover:bg-bunyan-700 text-white px-4 py-2.5 rounded-xl font-bold text-sm transition-all disabled:opacity-60"
              >
                {isFetching ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
                جلب المدن الآن
              </button>
            </div>
          ) : (
            /* ══ Data Table ══ */
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              {/* Table Header */}
              <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-6">
                  <div className="w-24 h-12 flex items-center justify-center relative">
                    <Logo providerName={selectedProvider} size="md" variant="dark" />
                  </div>
                  <div>
                    <h2 className="font-bold text-gray-900 text-sm">
                      خريطة {AVAILABLE_PROVIDERS.find(p => p.id === selectedProvider)?.name}
                    </h2>
                    <p className="text-xs text-gray-400">المدن المستخرجة عبر API</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleAutoMatch}
                    disabled={isFetching}
                    className="flex items-center gap-2 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 px-3 py-1.5 rounded-lg text-xs font-bold transition disabled:opacity-50"
                  >
                    {isFetching ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />}
                    مطابقة ذكية للأسماء
                  </button>
                  <button
                    onClick={() => setShowPendingCitiesOnly(!showPendingCitiesOnly)}
                    className={cn(
                      "flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border",
                      showPendingCitiesOnly 
                        ? "bg-amber-50 text-amber-700 border-amber-200" 
                        : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                    )}
                  >
                    <Filter size={14} />
                    المعلق فقط
                  </button>
                  <span className="text-xs bg-gray-50 border border-gray-200 text-gray-600 px-3 py-1.5 rounded-lg font-bold">
                    {totalCities} مدينة
                  </span>
                  <span className="text-xs bg-emerald-50 border border-emerald-100 text-emerald-700 px-3 py-1.5 rounded-lg font-bold flex items-center gap-1">
                    <CheckCircle2 size={12} /> {mappedCities} مرتبطة
                  </span>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-right text-sm">
                  <thead className="bg-gray-50/50 border-b border-gray-100 text-gray-400 font-bold text-xs uppercase tracking-wider">
                    <tr>
                      <th className="px-6 py-4 w-20">ID</th>
                      <th className="px-6 py-4">مدينة المزود</th>
                      <th className="px-6 py-4 w-72">مقابلها في بنيان</th>
                      <th className="px-6 py-4 text-center w-28">الحالة</th>
                      <th className="px-6 py-4 text-center w-36">المناطق</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {providerCitiesData.filter(pc => {
                      if (!showPendingCitiesOnly) return true;
                      const mappedData = shippingCityMappings.find(m => String(m.provider_city_id) === String(pc.id) && m.is_active);
                      let mappedValue = '';
                      if (mappedData) {
                        if (mappedData.bunyan_city_id) mappedValue = `city_${mappedData.bunyan_city_id}`;
                        else if (mappedData.bunyan_region_id) mappedValue = `region_${mappedData.bunyan_region_id}`;
                      }
                      const isMapped = !!mappedData && String(gridMap[pc.id]) === mappedValue;
                      return !isMapped;
                    }).map(providerCity => {
                      const mappedData = shippingCityMappings.find(m => String(m.provider_city_id) === String(providerCity.id) && m.is_active);
                      let mappedValue = '';
                      if (mappedData) {
                        if (mappedData.bunyan_city_id) mappedValue = `city_${mappedData.bunyan_city_id}`;
                        else if (mappedData.bunyan_region_id) mappedValue = `region_${mappedData.bunyan_region_id}`;
                      }
                      const isMapped = !!mappedData && String(gridMap[providerCity.id]) === mappedValue;
                      const isExpanded = expandedRows.includes(providerCity.id);
                      const savedSubsCount = mappedData ? shippingRegionMappings.filter(r => r.city_mapping_id === mappedData.id).length : 0;
                      const fetchedSubs = providerRegionsData[providerCity.id];
                      const holdsPendingRegions = providerCity.hasSubRegions && isMapped && (!fetchedSubs || fetchedSubs.length > savedSubsCount);
                      const fullyCompleted = isMapped && !holdsPendingRegions;

                      return (
                        <Fragment key={providerCity.id}>
                          <tr className={`transition-colors ${isExpanded ? 'bg-bunyan-50/10' : ''} ${fullyCompleted ? 'bg-emerald-50/10' : 'hover:bg-gray-50/40'}`}>
                            {/* ID */}
                            <td className="px-6 py-4">
                              <span className="font-mono text-gray-400 bg-gray-50 px-2 py-1 rounded border border-gray-100 text-xs">
                                {providerCity.id}
                              </span>
                            </td>
                            {/* City Name */}
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-2">
                                <span className={`font-bold text-sm ${fullyCompleted ? 'text-emerald-900' : 'text-gray-900'}`}>
                                  {providerCity.name}
                                </span>
                                {fullyCompleted && <CheckCircle2 size={14} className="text-emerald-500" />}
                              </div>
                              {providerCity.nameEn && (
                                <div className="text-[11px] text-gray-400 font-mono mt-0.5">{providerCity.nameEn}</div>
                              )}
                            </td>
                            {/* Bunyan City Dropdown */}
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-2">
                                <div className="flex-1">
                                  <HeadlessDropdown
                                    options={combinedOptions}
                                    value={gridMap[providerCity.id] || null}
                                    onChange={(val) => setGridMap(prev => ({ ...prev, [providerCity.id]: val }))}
                                    placeholder="اختر للمطابقة..."
                                    allowAdd={true}
                                    onAdd={(val) => handleAddCustomCity(val, providerCity.id)}
                                    addLabel="+ أضف كمدينة جديدة"
                                  />
                                </div>
                                <button
                                  onClick={() => handleSaveCityMapping(providerCity)}
                                  disabled={savingCityId === providerCity.id}
                                  className={`w-9 h-9 shrink-0 rounded-xl flex items-center justify-center transition-all ${
                                    isMapped
                                      ? 'bg-emerald-50 text-emerald-600 border border-emerald-200 hover:bg-emerald-100'
                                      : 'bg-white text-gray-600 border border-gray-200 hover:border-bunyan-300 hover:bg-bunyan-50 hover:text-bunyan-700 active:scale-95'
                                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                                >
                                  {savingCityId === providerCity.id ? <Loader2 size={16} className="animate-spin" /> : (isMapped ? <CheckCircle2 size={16} /> : <Save size={16} />)}
                                </button>
                              </div>
                            </td>
                            {/* Status Badge */}
                            <td className="px-6 py-4 text-center">
                              {fullyCompleted ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-full text-[11px] font-bold">
                                  مكتمل
                                </span>
                              ) : isMapped ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-50 text-amber-700 border border-amber-200 rounded-full text-[11px] font-bold">
                                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                                  جزئي
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-50 text-gray-500 border border-gray-200 rounded-full text-[11px] font-bold">
                                  معلق
                                </span>
                              )}
                            </td>
                            {/* Sub-regions toggle */}
                            <td className="px-6 py-4 text-center">
                              {providerCity.hasSubRegions ? (
                                <button
                                  onClick={() => {
                                    if (!isMapped) {
                                      showToast('يجب مطابقة المدينة أولاً لفتح المناطق', 'error');
                                      return;
                                    }
                                    toggleRow(providerCity.id);
                                  }}
                                  className={`inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                                    isExpanded
                                      ? 'bg-bunyan-600 text-white border-bunyan-600'
                                      : holdsPendingRegions && isMapped
                                        ? 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
                                        : 'bg-white text-gray-600 border-gray-200 hover:border-bunyan-300 hover:bg-bunyan-50 hover:text-bunyan-700'
                                  }`}
                                >
                                  <MapPin size={12} />
                                  مناطق {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                                </button>
                              ) : (
                                <span className="text-gray-300 text-xs">—</span>
                              )}
                            </td>
                          </tr>

                          {/* ── Expanded Sub-Regions Row ── */}
                          {isExpanded && isMapped && mappedData && (
                            <tr className="bg-gray-50/60">
                              <td colSpan={5} className="p-0 border-b-2 border-bunyan-100">
                                <div className="p-5 md:pr-12 md:pl-6 border-r-4 border-bunyan-400">
                                  <NestedRegionsTable
                                    providerCityId={providerCity.id}
                                    providerCityName={providerCity.name ?? ''}
                                    provider={selectedProvider}
                                    cityMappingId={mappedData.id}
                                  />
                                </div>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* ══ Slide-Over: Bunyan Reference Guide ══ */}
      <Transition.Root show={isRefDrawerOpen} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={setIsRefDrawerOpen}>
          <Transition.Child
            as={Fragment}
            enter="ease-in-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in-out duration-300"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm transition-opacity" />
          </Transition.Child>

          <div className="fixed inset-0 overflow-hidden">
            <div className="absolute inset-0 overflow-hidden">
              <div className="pointer-events-none fixed inset-y-0 left-0 flex max-w-sm w-full">
                <Transition.Child
                  as={Fragment}
                  enter="transform transition ease-in-out duration-400"
                  enterFrom="-translate-x-full"
                  enterTo="translate-x-0"
                  leave="transform transition ease-in-out duration-400"
                  leaveFrom="translate-x-0"
                  leaveTo="-translate-x-full"
                >
                  <Dialog.Panel className="pointer-events-auto w-full bg-white shadow-2xl flex flex-col h-full border-r border-gray-100">
                    {/* Drawer Header */}
                    <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-gray-50/50">
                      <Dialog.Title className="text-base font-black text-gray-900 flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-bunyan-100 text-bunyan-600 flex items-center justify-center">
                          <BookOpen size={15} />
                        </div>
                        الدليل الجغرافي (بنيان)
                      </Dialog.Title>
                      <button
                        onClick={() => setIsRefDrawerOpen(false)}
                        className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>

                    {/* Drawer Content */}
                    <div className="flex-1 overflow-y-auto px-5 py-5 bg-gray-50/20">
                      <p className="text-xs text-gray-500 mb-4 leading-relaxed">
                        استخدم هذا الدليل كمرجع للتحقق من أسماء المدن والمناطق الموجودة في قاعدة بيانات بنيان.
                      </p>

                      <div className="space-y-3">
                        {MOCK_BUNYAN_TREE.map(item => (
                          <div key={item.city} className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                            {/* City Header */}
                            <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
                              <MapPin size={14} className="text-bunyan-500 shrink-0" />
                              <span className="font-bold text-gray-800 text-sm">{item.city}</span>
                              <span className="mr-auto text-[10px] bg-gray-100 text-gray-400 px-2 py-0.5 rounded-full font-bold">
                                {item.regions.length} منطقة
                              </span>
                            </div>
                            {/* Regions */}
                            <div className="p-3 flex flex-wrap gap-1.5">
                              {item.regions.map(r => (
                                <span
                                  key={r}
                                  className="text-xs text-gray-600 bg-gray-50 border border-gray-100 px-2.5 py-1 rounded-lg font-medium hover:bg-bunyan-50 hover:text-bunyan-700 hover:border-bunyan-100 transition-colors cursor-default"
                                >
                                  {r}
                                </span>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </Dialog.Panel>
                </Transition.Child>
              </div>
            </div>
          </div>
        </Dialog>
      </Transition.Root>
    </div>
  );
}
