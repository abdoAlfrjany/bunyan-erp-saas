import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export interface SystemRules {
  allowNegativeTreasury: boolean;
  allowDeleteActiveActors: boolean; // شركاء وموظفين
  requireCourierSettlement: boolean;
  maxPartnersProfitPercentage: number;
}

interface RulesState {
  rules: SystemRules;
  updateRules: (newRules: Partial<SystemRules>) => void;
  resetRules: () => void;
}

const defaultRules: SystemRules = {
  allowNegativeTreasury: false,
  allowDeleteActiveActors: false,
  requireCourierSettlement: true,
  maxPartnersProfitPercentage: 100,
};

export const useRulesStore = create<RulesState>()(
  persist(
    (set) => ({
      rules: defaultRules,
      updateRules: (newRules) => set((state) => ({ rules: { ...state.rules, ...newRules } })),
      resetRules: () => set({ rules: defaultRules }),
    }),
    {
      name: 'bunyan-logic-rules',
      storage: createJSONStorage(() => localStorage),
    }
  )
);
