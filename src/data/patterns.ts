import { ArmorPattern } from '../types/armor';

export const ARMOR_PATTERNS: ArmorPattern[] = [
  {
    id: 1,
    name: 'Grenadier',
    mainStat: 'grenade',
    subStat: 'super',
    possibleThirdStats: ['weapon', 'health', 'class', 'melee']
  },
  {
    id: 2,
    name: 'Brawler',
    mainStat: 'melee',
    subStat: 'health',
    possibleThirdStats: ['weapon', 'class', 'grenade', 'super']
  },
  {
    id: 3,
    name: 'Gunner',
    mainStat: 'weapon',
    subStat: 'grenade',
    possibleThirdStats: ['health', 'class', 'melee', 'super']
  },
  {
    id: 4,
    name: 'Specialist',
    mainStat: 'class',
    subStat: 'weapon',
    possibleThirdStats: ['health', 'grenade', 'melee', 'super']
  },
  {
    id: 5,
    name: 'Paragon',
    mainStat: 'super',
    subStat: 'melee',
    possibleThirdStats: ['weapon', 'health', 'class', 'grenade']
  },
  {
    id: 6,
    name: 'Bulwark',
    mainStat: 'health',
    subStat: 'class',
    possibleThirdStats: ['weapon', 'grenade', 'melee', 'super']
  }
]; 