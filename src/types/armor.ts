export type StatType = 'weapon' | 'health' | 'class' | 'grenade' | 'melee' | 'super';

export interface ArmorPattern {
  id?: number;
  name: string;
  mainStat: StatType;
  subStat: StatType;
  possibleThirdStats: StatType[];
  mainStatValue?: string;
  subStatValue?: string;
  thirdStatValue?: string;
}

export interface ArmorPiece {
  pattern: ArmorPattern;
  tier: number;
  thirdStat: StatType;
  smallMods: StatType[];
  largeMods: StatType[];
  letCalculatorChoose?: boolean;
  mainStatValue?: string;
  subStatValue?: string;
  thirdStatValue?: string;
  isExotic?: boolean;
}

export interface ArmorStats {
  weapon: number;
  health: number;
  class: number;
  grenade: number;
  melee: number;
  super: number;
}

export interface TierValues {
  main: number;
  sub: number;
  third: number;
}

export const TIER_STAT_VALUES: Record<number, TierValues> = {
  1: { main: 25, sub: 15, third: 10 },
  2: { main: 30, sub: 15, third: 10 },
  3: { main: 30, sub: 20, third: 10 },
  4: { main: 30, sub: 25, third: 15 },
  5: { main: 30, sub: 25, third: 20 }
};

export const MOD_VALUES = {
  small: 5,
  large: 10
};

export interface BestCombination {
  combination: ArmorPiece[];
  remainingMods: {
    small: number;
    large: number;
  };
  score: number;
  isTargetAchieved: boolean;
}

export interface PinnedCombination {
  id: string;
  name: string;
  combination: ArmorPiece[];
  remainingMods: {
    small: number;
    large: number;
  };
  score: number;
  isTargetAchieved: boolean;
  archetypeCount: number;
  createdAt: string;
  totalStats: ArmorStats;
  isCustomTier: boolean;
  customTierValues?: { main: number; sub: number; third: number };
} 