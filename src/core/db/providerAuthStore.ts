// src/core/db/providerAuthStore.ts
// متجر مستقل لجلسة ربط City Mappings (مفصول لتجنب circular import)

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface ProviderAuthState {
  activeProviderToken: string | null;
  setActiveProviderToken: (token: string | null) => void;
}

export const useProviderAuthStore = create<ProviderAuthState>()(
  persist(
    (set) => ({
      activeProviderToken: null,
      setActiveProviderToken: (t) => set({ activeProviderToken: t }),
    }),
    {
      name: 'bunyan-provider-auth',
      partialize: (state) => ({ activeProviderToken: state.activeProviderToken }),
    }
  )
);
