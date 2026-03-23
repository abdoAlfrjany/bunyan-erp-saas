// src/core/db/slices/geoMappingSlice.ts
// الوظيفة: كل ما يتعلق بالربط الجغرافي (Supabase geo_mappings)
// شاملاً: bunyan_cities, bunyan_regions, provider_geo_mappings

import type { StateCreator } from 'zustand';
import type {
  ShippingCityMapping,
  ShippingRegionMapping,
  BunyanCity,
  BunyanRegion,
} from '../../types';
import { createClient } from '../supabase';

export interface GeoMappingSlice {
  // ══ State ══
  shippingCityMappings: ShippingCityMapping[];
  shippingRegionMappings: ShippingRegionMapping[];
  bunyanCities: BunyanCity[];
  bunyanRegions: BunyanRegion[];

  // ══ City Mappings ══
  addCityMapping: (m: ShippingCityMapping) => Promise<{ success: boolean; error?: string }>;
  updateCityMapping: (id: string, data: Partial<ShippingCityMapping>) => void;
  addBunyanCity: (cityName: string) => Promise<{ success: boolean; data?: any; error?: string }>;

  // ══ Region Mappings ══
  addRegionMapping: (m: ShippingRegionMapping) => Promise<{ success: boolean; error?: string }>;
  updateRegionMapping: (id: string, data: Partial<ShippingRegionMapping>) => void;
  removeRegionMapping: (id: string) => void;
  addBunyanRegion: (regionName: string, cityId: number) => Promise<{ success: boolean; data?: any; error?: string }>;

  // ══ Supabase Fetcher ══
  fetchGeoMappings: () => Promise<void>;
}

export const createGeoMappingSlice: StateCreator<GeoMappingSlice, [], [], GeoMappingSlice> = (set) => ({
  shippingCityMappings: [],
  shippingRegionMappings: [],
  bunyanCities: [],
  bunyanRegions: [],

  fetchGeoMappings: async () => {
    const supabase = createClient();
    try {
      const [citiesRes, regionsRes, mappingsRes] = await Promise.all([
        supabase.from('bunyan_cities').select('*'),
        supabase.from('bunyan_regions').select('*'),
        supabase.from('provider_geo_mappings').select('*'),
      ]);

      if (citiesRes.data) set({ bunyanCities: citiesRes.data });
      if (regionsRes.data) set({ bunyanRegions: regionsRes.data });

      if (mappingsRes.data) {
        const dbMappings = mappingsRes.data;
        const cityMaps: ShippingCityMapping[] = [];
        const regionMaps: ShippingRegionMapping[] = [];

        dbMappings.forEach((m: any) => {
          if (m.provider_region_id === null || m.provider_region_id === undefined) {
            cityMaps.push({
              id: m.id,
              provider: m.provider,
              parent_mapping_id: null,
              bunyan_city_id: m.bunyan_city_id,
              bunyan_region_id: m.bunyan_region_id,
              provider_city_id: m.provider_city_id,
              is_active: m.is_active,
              bunyanCityName: citiesRes.data?.find((c) => c.id === m.bunyan_city_id)?.name_ar,
            });
          } else {
            regionMaps.push({
              id: m.id,
              city_mapping_id: m.parent_mapping_id || '',
              provider: m.provider,
              bunyan_region_id: m.bunyan_region_id,
              provider_city_id: m.provider_city_id,
              provider_region_id: m.provider_region_id,
              is_active: m.is_active,
              bunyanRegionName: regionsRes.data?.find((r) => r.id === m.bunyan_region_id)?.name_ar,
            });
          }
        });

        set({ shippingCityMappings: cityMaps, shippingRegionMappings: regionMaps });
      }
    } catch (err) {
      console.error('Geo Mappings fetch error:', err);
    }
  },

  addCityMapping: async (m) => {
    const supabase = createClient();
    try {
      const payload: any = {
        provider: m.provider,
        parent_mapping_id: null,
        bunyan_city_id: m.bunyan_city_id ? Number(m.bunyan_city_id) : null,
        bunyan_region_id: m.bunyan_region_id ? Number(m.bunyan_region_id) : null,
        provider_city_id: String(m.provider_city_id),
        provider_region_id: null,
        is_active: m.is_active,
      };
      
      // If we have a persistent ID (integer), include it to guide the upsert
      if (m.id && !isNaN(Number(m.id))) {
        payload.id = Number(m.id);
      }

      const { data, error } = await supabase
        .from('provider_geo_mappings')
        .upsert(payload, { onConflict: 'provider,provider_city_id,provider_region_id' })
        .select()
        .single();

      if (error) return { success: false, error: error.message };

      set((s) => {
        const exists = s.shippingCityMappings.some((x) => x.id === data.id);
        const mappedRecord = { ...m, id: data.id };
        return {
          shippingCityMappings: exists
            ? s.shippingCityMappings.map((x) => (x.id === data.id ? mappedRecord : x))
            : [mappedRecord, ...s.shippingCityMappings],
        };
      });
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  updateCityMapping: (id, data) =>
    set((s) => ({
      shippingCityMappings: s.shippingCityMappings.map((m) => (m.id === id ? { ...m, ...data } : m)),
    })),

  addBunyanCity: async (cityName) => {
    const supabase = createClient();
    try {
      const { data, error } = await supabase
        .from('bunyan_cities')
        .insert({ 
          name_ar: cityName, 
          is_active: true 
        })
        .select()
        .single();

      if (error) return { success: false, error: error.message };

      set((s) => ({ bunyanCities: [...s.bunyanCities, data] }));
      return { success: true, data };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  addRegionMapping: async (m) => {
    const supabase = createClient();
    try {
      const payload: any = {
        provider: m.provider,
        bunyan_city_id: null,
        bunyan_region_id: Number(m.bunyan_region_id),
        provider_region_id: String(m.provider_region_id),
        provider_city_id: String(m.provider_city_id),
        parent_mapping_id: isNaN(Number(m.city_mapping_id)) ? m.city_mapping_id : Number(m.city_mapping_id),
        is_active: m.is_active,
      };

      // If we have a persistent ID (integer), include it
      if (m.id && !isNaN(Number(m.id))) {
        payload.id = Number(m.id);
      }

      const { data, error } = await supabase
        .from('provider_geo_mappings')
        .upsert(payload, { onConflict: 'provider,provider_city_id,provider_region_id' })
        .select()
        .single();

      if (error) return { success: false, error: error.message };

      set((s) => {
        const exists = s.shippingRegionMappings.some((x) => x.id === data.id);
        const mappedRecord = { ...m, id: data.id };
        return {
          shippingRegionMappings: exists
            ? s.shippingRegionMappings.map((x) => (x.id === data.id ? mappedRecord : x))
            : [mappedRecord, ...s.shippingRegionMappings],
        };
      });
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  updateRegionMapping: (id, data) =>
    set((s) => ({
      shippingRegionMappings: s.shippingRegionMappings.map((m) => (m.id === id ? { ...m, ...data } : m)),
    })),

  removeRegionMapping: (id) =>
    set((s) => ({
      shippingRegionMappings: s.shippingRegionMappings.filter((m) => m.id !== id),
    })),

  addBunyanRegion: async (regionName, cityId) => {
    const supabase = createClient();
    try {
      const { data, error } = await supabase
        .from('bunyan_regions')
        .insert({ name_ar: regionName, city_id: cityId, is_active: true })
        .select()
        .single();

      if (error) return { success: false, error: error.message };

      set((s) => ({ bunyanRegions: [...s.bunyanRegions, data] }));
      return { success: true, data };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },
});
