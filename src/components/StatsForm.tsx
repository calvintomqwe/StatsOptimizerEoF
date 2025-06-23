'use client';

import React, { useState } from 'react';
import { ArmorPiece, ArmorStats, StatType, TIER_STAT_VALUES, MOD_VALUES, BestCombination } from '../types/armor';
import { findBestCombination, calculateTotalStats } from '../utils/armorCalculator';
import { addPinnedCombination, isCombinationPinned, getPinnedCombinations, savePinnedCombinations } from '../utils/pinnedCombinations';
import PinnedCombinations from './PinnedCombinations';
import toast, { Toaster } from 'react-hot-toast';

interface ModCounts {
  small: number;
  large: number;
}

// Palette de couleurs pour les patterns
const PATTERN_COLORS: Record<string, string> = {
  Grenadier: '#fbbf24',   // jaune doré
  Brawler: '#f87171',     // rouge doux
  Gunner: '#60a5fa',      // bleu doux
  Specialist: '#a78bfa',  // violet doux
  Paragon: '#34d399',     // vert menthe
  Bulwark: '#f472b6',     // rose doux
};

export default function StatsForm() {
  const [targetStats, setTargetStats] = useState<Record<StatType, string>>({
    weapon: '0',
    health: '0',
    class: '0',
    grenade: '0',
    melee: '0',
    super: '0'
  });
  const [tier, setTier] = useState<number>(5);
  const [modCounts, setModCounts] = useState<ModCounts>({ small: 0, large: 5 });
  const [results, setResults] = useState<BestCombination[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [expandedResults, setExpandedResults] = useState<number[]>([]);
  const [showGuide, setShowGuide] = useState(true);
  const [activeTab, setActiveTab] = useState<'results' | 'pinned'>('results');
  const [exoticArmor, setExoticArmor] = useState<{
    mainStat: StatType | null;
    subStat: StatType | null;
    thirdStat: StatType | null;
    mainStatValue: string;
    subStatValue: string;
    thirdStatValue: string;
    letCalculatorChoose: boolean;
    isExotic: boolean;
  } | null>(null);
  const [fixedArmors, setFixedArmors] = useState<Array<{
    mainStat: StatType;
    subStat: StatType;
    thirdStat: StatType;
    mainStatValue: string;
    subStatValue: string;
    thirdStatValue: string;
  }>>([]);
  const [customTier, setCustomTier] = useState<{
    main: string;
    sub: string;
    third: string;
  }>({
    main: '30',
    sub: '25',
    third: '20'
  });
  const [useCustomTier, setUseCustomTier] = useState(false);
  const [factorizeSolutions, setFactorizeSolutions] = useState(true);
  const [pinUpdateTrigger, setPinUpdateTrigger] = useState(0);

  const allStats: StatType[] = ['weapon', 'health', 'class', 'grenade', 'melee', 'super'];

  const handleStatChange = (stat: StatType, value: string) => {
    const numericValue = value.replace(/[^0-9]/g, '');
    const limitedValue = Math.min(Math.max(parseInt(numericValue) || 0, 0), 200).toString();
    setTargetStats(prev => ({ ...prev, [stat]: limitedValue }));
  };

  const handleModCountChange = (type: keyof ModCounts, delta: number) => {
    setModCounts(prev => {
      const newCount = prev[type] + delta;
      const otherType = type === 'small' ? 'large' : 'small';
      const totalMods = newCount + prev[otherType];
      
      if (newCount < 0 || totalMods > 5) return prev;
      
      return {
        ...prev,
        [type]: newCount
      };
    });
  };

  const getNumericTargetStats = (): ArmorStats => ({
    weapon: Math.min(parseInt(targetStats.weapon) || 0, 200),
    health: Math.min(parseInt(targetStats.health) || 0, 200),
    class: Math.min(parseInt(targetStats.class) || 0, 200),
    grenade: Math.min(parseInt(targetStats.grenade) || 0, 200),
    melee: Math.min(parseInt(targetStats.melee) || 0, 200),
    super: Math.min(parseInt(targetStats.super) || 0, 200),
  });

  const addFixedArmor = () => {
    const maxFixedArmors = exoticArmor ? 4 : 5;
    if (fixedArmors.length < maxFixedArmors) {
      const tierValues = TIER_STAT_VALUES[tier] || TIER_STAT_VALUES[5];
      setFixedArmors([
        ...fixedArmors,
        {
          mainStat: 'weapon',
          subStat: 'grenade',
          thirdStat: 'super',
          mainStatValue: tierValues.main.toString(),
          subStatValue: tierValues.sub.toString(),
          thirdStatValue: tierValues.third.toString()
        }
      ]);
    }
  };

  const removeFixedArmor = (index: number) => {
    setFixedArmors(fixedArmors.filter((_, i) => i !== index));
  };

  const updateFixedArmor = (index: number, field: string, value: string) => {
    const newArmors = [...fixedArmors];
    newArmors[index] = { ...newArmors[index], [field]: value };
    setFixedArmors(newArmors);
  };

  const addExotic = () => {
    if (!exoticArmor) {
      const tierValues = TIER_STAT_VALUES[tier] || TIER_STAT_VALUES[5];
      setExoticArmor({
        mainStat: 'weapon',
        subStat: 'grenade',
        thirdStat: 'super',
        mainStatValue: tierValues.main.toString(),
        subStatValue: tierValues.sub.toString(),
        thirdStatValue: tierValues.third.toString(),
        letCalculatorChoose: false,
        isExotic: true
      });
    }
  };

  const removeExotic = () => {
    setExoticArmor(null);
  };

  const updateExotic = (field: string, value: string | number | boolean | null) => {
    if (!exoticArmor) return;
    
    if (field === 'letCalculatorChoose') {
      // Si on active "Let calculator choose", on met les stats à null mais on garde les valeurs
      if (value === true) {
        setExoticArmor({
          ...exoticArmor,
          letCalculatorChoose: true,
          mainStat: null,
          subStat: null,
          thirdStat: null,
          isExotic: true
        });
      } else {
        // Si on désactive, on remet les stats par défaut
        setExoticArmor({
          ...exoticArmor,
          letCalculatorChoose: false,
          mainStat: 'weapon',
          subStat: 'grenade',
          thirdStat: 'super',
          isExotic: true
        });
      }
    } else {
      setExoticArmor({ ...exoticArmor, [field]: value });
    }
  };

  const handleCustomTierChange = (field: 'main' | 'sub' | 'third', value: string) => {
    // Ne garder que les chiffres
    const numericValue = value.replace(/[^0-9]/g, '');
    // Limiter entre 0 et 30
    const limitedValue = Math.min(Math.max(parseInt(numericValue) || 0, 0), 30).toString();
    setCustomTier(prev => ({ ...prev, [field]: limitedValue }));
  };

  const handlePinCombination = (combination: BestCombination) => {
    if (isCombinationPinned(combination)) {
      // Si déjà épinglé, on le désépingle
      const pinnedCombinations = getPinnedCombinations();
      
      // Créer la même clé que dans isCombinationPinned
      const combinationKey = combination.combination
        .map(piece => {
          return `${piece.pattern.name}-${piece.thirdStat}-${piece.tier}-${piece.isExotic ? 'exotic' : 'normal'}-${piece.letCalculatorChoose ? 'letcalc' : 'fixed'}`;
        })
        .sort()
        .join('|');
      
      const filtered = pinnedCombinations.filter(pinned => {
        const pinnedKey = pinned.combination
          .map(piece => {
            return `${piece.pattern.name}-${piece.thirdStat}-${piece.tier}-${piece.isExotic ? 'exotic' : 'normal'}-${piece.letCalculatorChoose ? 'letcalc' : 'fixed'}`;
          })
          .sort()
          .join('|');
        
        return pinnedKey !== combinationKey;
      });
      
      savePinnedCombinations(filtered);
      toast.success('Combination unpinned!');
    } else {
      // Sinon, on l'épingle avec un nom automatique
      addPinnedCombination(combination);
      toast.success('Combination pinned!');
    }
    
    // Forcer le re-render pour mettre à jour l'interface
    setPinUpdateTrigger(prev => prev + 1);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    setIsLoading(true);
    
    setTimeout(() => {
      // Ajouter l'exotic s'il existe
      const exoticArmorPieces: ArmorPiece[] = [];
      
      if (exoticArmor && exoticArmor.mainStatValue && exoticArmor.subStatValue && exoticArmor.thirdStatValue) {
        const exoticPattern = {
          name: 'Exotic',
          mainStat: exoticArmor.mainStat || 'weapon',
          subStat: exoticArmor.subStat || 'health',
          possibleThirdStats: exoticArmor.thirdStat ? [exoticArmor.thirdStat] : (['weapon', 'health', 'class', 'grenade', 'melee', 'super'] as StatType[]),
          mainStatValue: exoticArmor.mainStatValue,
          subStatValue: exoticArmor.subStatValue,
          thirdStatValue: exoticArmor.thirdStatValue
        };
        
        exoticArmorPieces.push({
          pattern: exoticPattern,
          tier: useCustomTier ? 6 : tier,
          thirdStat: exoticArmor.thirdStat || 'weapon',
          smallMods: [],
          largeMods: [],
          letCalculatorChoose: exoticArmor.letCalculatorChoose,
          mainStatValue: exoticArmor.mainStatValue,
          subStatValue: exoticArmor.subStatValue,
          thirdStatValue: exoticArmor.thirdStatValue,
          isExotic: true
        });
      }

      // Ajouter les armures fixes normales
      const normalFixedArmorPieces: ArmorPiece[] = fixedArmors
        .filter(armor => armor.mainStatValue && armor.subStatValue && armor.thirdStatValue)
        .map(armor => {
          const customPattern = {
            name: 'Custom',
            mainStat: armor.mainStat,
            subStat: armor.subStat,
            possibleThirdStats: [armor.thirdStat],
            mainStatValue: armor.mainStatValue,
            subStatValue: armor.subStatValue,
            thirdStatValue: armor.thirdStatValue
          };
          
          return {
            pattern: customPattern,
            tier: useCustomTier ? 6 : tier,
            thirdStat: armor.thirdStat,
            smallMods: [],
            largeMods: [],
            letCalculatorChoose: false,
            mainStatValue: armor.mainStatValue,
            subStatValue: armor.subStatValue,
            thirdStatValue: armor.thirdStatValue
          };
        });

      const allFixedArmorPieces = [...exoticArmorPieces, ...normalFixedArmorPieces];

      if (useCustomTier) {
        TIER_STAT_VALUES[6] = {
          main: parseInt(customTier.main),
          sub: parseInt(customTier.sub),
          third: parseInt(customTier.third)
        };
      }

      const bestCombinations = findBestCombination(
        getNumericTargetStats(), 
        useCustomTier ? 6 : tier, 
        modCounts, 
        allFixedArmorPieces,
        factorizeSolutions
      );
      setResults(bestCombinations);
      setExpandedResults([]);
      setIsLoading(false);
    }, 0);
  };

  const toggleResult = (index: number) => {
    setExpandedResults(prev => 
      prev.includes(index) 
        ? prev.filter(i => i !== index)
        : [...prev, index]
    );
  };

  return (
    <>
      {showGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70">
          <div className="bg-gray-900 text-gray-200 rounded-lg shadow-lg max-w-lg w-full p-8 relative">
            <button
              className="absolute top-3 right-3 text-gray-400 hover:text-white text-2xl font-bold"
              onClick={() => setShowGuide(false)}
              aria-label="Fermer le guide"
            >
              ×
            </button>
            <h2 className="text-2xl font-bold mb-4">Please read this before using the tool</h2>
            <div className="space-y-3 text-sm">
              <ul className="list-disc pl-5 space-y-1">
                <li>This tool is not perfect, it&apos;s just there to help you have an idea of which archetype of armor to chase for your build on the first few days of the dlc to prepare for the contest raid. Therefore I won&apos;t implement stat tuning since we probably won&apos;t have access to tier 5 before saturday.</li>
                <li>The tool aim to give you a rough idea of how to reach your target stats in the fastest way possible, and can sometime miss the target, so try to play with the stats to get a desired result.</li>
                <li>The stats used are from the version of EoF that content creators played, it might be different from the actual stats on launch. Don&apos;t hesitate to use custom tiers to suit your needs.</li>
                <li>This is a very small tool, i just made it for myself and a few friends, so I don&apos;t know if it will be of any help to you.</li>
                <li>I don&apos;t claim to be a great developer, so the app might be a bit shitty. sorry.</li>
              </ul>
              <p className="mt-2 text-xs text-gray-400">The tool isnt really optimized for mobile, so it might be a bit laggy, and it might not offer the best experience.</p>
            </div>
          </div>
        </div>
      )}
      <div className="max-w-7xl mx-auto p-6 bg-gray-900 text-gray-300">
        {/* Onglets principaux */}
        <div className="flex border-b border-gray-700 mb-6">
          <button
            onClick={() => setActiveTab('results')}
            className={`px-6 py-3 font-medium transition-colors ${
              activeTab === 'results'
                ? 'text-blue-400 border-b-2 border-blue-400'
                : 'text-gray-400 hover:text-gray-300'
            }`}
          >
            Calculator
          </button>
          <button
            onClick={() => setActiveTab('pinned')}
            className={`px-6 py-3 font-medium transition-colors ${
              activeTab === 'pinned'
                ? 'text-blue-400 border-b-2 border-blue-400'
                : 'text-gray-400 hover:text-gray-300'
            }`}
          >
            Pinned Combinations
          </button>
        </div>

        {/* Contenu des onglets */}
        {activeTab === 'results' && (
        <div className="lg:grid lg:grid-cols-2 lg:gap-8">
          <div className="mb-8 lg:mb-0">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="flex justify-center mb-6">
                <button
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-8 rounded-lg transition-colors duration-200 text-lg"
                >
                  Calculate
                </button>
              </div>

                <div className="bg-gray-800 rounded-lg p-4 mb-6">
                  <div className="flex items-center justify-center">
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={factorizeSolutions}
                        onChange={(e) => setFactorizeSolutions(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                      <span className="ml-3 text-sm font-medium text-gray-300">Factorise solutions</span>
                    </label>
                    <div className="relative group ml-2">
                      <button
                        type="button"
                        className="text-gray-400 hover:text-white transition-colors duration-200"
                        aria-label="Information about Factorise solutions"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                        </svg>
                      </button>
                      <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-64 p-2 bg-gray-900 text-white text-sm rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-10">
                        <p>
                          When enabled, the calculator will avoid showing multiple solutions that have the same stats and use the same archetypes, preventing redundant permutations.
                        </p>
                        <div className="absolute left-1/2 -translate-x-1/2 top-full w-2 h-2 bg-gray-900 transform rotate-45"></div>
                      </div>
                    </div>
                  </div>
              </div>

              <div className="bg-gray-800 rounded-lg p-4">
                <h2 className="text-xl font-bold text-white mb-4">Target Stats</h2>
                {Object.values(targetStats).some(value => parseInt(value) > 200) && (
                  <div className="mb-4 p-3 bg-red-900/50 border border-red-500 rounded-lg">
                    <p className="text-red-200 text-sm">
                      <span className="font-semibold">Warning:</span> Stats cannot exceed 200 points.
                    </p>
                  </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl mx-auto">
                  {allStats.map((stat) => (
                    <div key={stat} className="flex flex-col items-center">
                      <label className="block text-sm font-medium text-gray-300 mb-1">
                        {stat.charAt(0).toUpperCase() + stat.slice(1)}
                      </label>
                      <div className="flex items-center space-x-2">
                        <button
                          type="button"
                          onClick={() => handleStatChange(stat, (parseInt(targetStats[stat]) - 10).toString())}
                          className="px-2 py-1 bg-gray-700 text-gray-300 rounded hover:bg-gray-600"
                        >
                          -10
                        </button>
                        <input
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          value={targetStats[stat]}
                          onChange={(e) => handleStatChange(stat, e.target.value)}
                          className={`w-20 bg-gray-700 text-white rounded p-2 text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${
                            parseInt(targetStats[stat]) > 200 ? 'border-2 border-red-500' : ''
                          }`}
                        />
                        <button
                          type="button"
                          onClick={() => handleStatChange(stat, (parseInt(targetStats[stat]) + 10).toString())}
                          className="px-2 py-1 bg-gray-700 text-gray-300 rounded hover:bg-gray-600"
                        >
                          +10
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-gray-800 rounded-lg p-4">
                <h2 className="text-xl font-bold text-white mb-4">Tier Selection</h2>
                <div className="flex flex-wrap justify-center gap-3">
                  {[1, 2, 3, 4, 5].map((t) => (
                    <label
                      key={t}
                      className={`relative flex flex-col items-center cursor-pointer ${
                        tier === t && !useCustomTier ? 'text-blue-400' : 'text-gray-400'
                      }`}
                    >
                      <input
                        type="radio"
                        name="tier"
                        value={t}
                        checked={tier === t && !useCustomTier}
                        onChange={() => {
                          setTier(t);
                          setUseCustomTier(false);
                        }}
                        className="sr-only"
                      />
                      <div className={`w-12 h-12 flex items-center justify-center border-2 rounded-lg ${
                        tier === t && !useCustomTier ? 'border-blue-400 bg-blue-900/30' : 'border-gray-600 hover:border-gray-500'
                      }`}>
                        <span className="text-xl font-bold">T{t}</span>
                      </div>
                      <span className="mt-1 text-xs">
                        {TIER_STAT_VALUES[t].main}/{TIER_STAT_VALUES[t].sub}/{TIER_STAT_VALUES[t].third}
                      </span>
                    </label>
                  ))}
                  <label
                    className={`relative flex flex-col items-center cursor-pointer ${
                      useCustomTier ? 'text-blue-400' : 'text-gray-400'
                    }`}
                  >
                    <input
                      type="radio"
                      name="tier"
                      checked={useCustomTier}
                      onChange={() => {
                        setUseCustomTier(true);
                        setTier(0);
                      }}
                      className="sr-only"
                    />
                    <div className={`w-16 h-12 flex items-center justify-center border-2 rounded-lg ${
                      useCustomTier ? 'border-blue-400 bg-blue-900/30' : 'border-gray-600 hover:border-gray-500'
                    }`}>
                      <span className="text-sm font-bold">Custom</span>
                    </div>
                    <span className="mt-1 text-xs">
                      {customTier.main}/{customTier.sub}/{customTier.third}
                    </span>
                  </label>
                </div>

                {useCustomTier && (
                  <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4 max-w-2xl mx-auto">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1">
                        Main Stat Value
                      </label>
                      <input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={customTier.main}
                        onChange={(e) => handleCustomTierChange('main', e.target.value)}
                        className="w-full bg-gray-700 text-white rounded p-2"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1">
                        Sub Stat Value
                      </label>
                      <input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={customTier.sub}
                        onChange={(e) => handleCustomTierChange('sub', e.target.value)}
                        className="w-full bg-gray-700 text-white rounded p-2"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1">
                        Third Stat Value
                      </label>
                      <input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={customTier.third}
                        onChange={(e) => handleCustomTierChange('third', e.target.value)}
                        className="w-full bg-gray-700 text-white rounded p-2"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="bg-gray-800 rounded-lg p-4">
                <h2 className="text-xl font-bold text-white mb-4">Mod Counts</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex flex-col items-center">
                    <label className="block text-sm font-medium text-gray-300 mb-1">
                      Small Mods
                    </label>
                    <div className="flex items-center space-x-4">
                      <button
                        type="button"
                        onClick={() => handleModCountChange('small', -1)}
                        className="px-3 py-1 bg-gray-700 text-gray-300 rounded hover:bg-gray-600"
                      >
                        -
                      </button>
                      <span className="text-gray-300">{modCounts.small}</span>
                      <button
                        type="button"
                        onClick={() => handleModCountChange('small', 1)}
                        className="px-3 py-1 bg-gray-700 text-gray-300 rounded hover:bg-gray-600"
                      >
                        +
                      </button>
                    </div>
                  </div>
                  <div className="flex flex-col items-center">
                    <label className="block text-sm font-medium text-gray-300 mb-1">
                      Large Mods
                    </label>
                    <div className="flex items-center space-x-4">
                      <button
                        type="button"
                        onClick={() => handleModCountChange('large', -1)}
                        className="px-3 py-1 bg-gray-700 text-gray-300 rounded hover:bg-gray-600"
                      >
                        -
                      </button>
                      <span className="text-gray-300">{modCounts.large}</span>
                      <button
                        type="button"
                        onClick={() => handleModCountChange('large', 1)}
                        className="px-3 py-1 bg-gray-700 text-gray-300 rounded hover:bg-gray-600"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>
                <div className="mt-4 text-sm text-gray-400 text-center">
                  Total mod slots used: {modCounts.small + modCounts.large}/5
                </div>
              </div>

                {/* Section Add Exotic */}
              <div className="bg-gray-800 p-4 rounded-lg">
                <div className="flex justify-between items-center mb-4">
                  <div className="flex items-center gap-2">
                      <h2 className="text-xl font-bold text-white">Add Exotic</h2>
                    <div className="relative group">
                      <button
                        type="button"
                        className="text-gray-400 hover:text-white transition-colors duration-200"
                          aria-label="Information about Exotic"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                        </svg>
                      </button>
                      <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-64 p-2 bg-gray-900 text-white text-sm rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-10">
                        <p>
                            Add an exotic armor piece. You can set specific stats or let the calculator choose the best stat types for your target.
                          </p>
                          <div className="absolute left-1/2 -translate-x-1/2 top-full w-2 h-2 bg-gray-900 transform rotate-45"></div>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {!exoticArmor ? (
                        <button
                          type="button"
                          onClick={addExotic}
                          className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded transition-colors duration-200"
                        >
                          Add Exotic
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={removeExotic}
                          className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded transition-colors duration-200"
                        >
                          Remove Exotic
                        </button>
                      )}
                    </div>
                  </div>

                  {exoticArmor && (
                    <div className="bg-gray-800 rounded-lg p-4 mb-4">
                      <div className="space-y-4">
                        <div className="flex items-center space-x-2 mb-4">
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input
                              type="checkbox"
                              checked={exoticArmor.letCalculatorChoose}
                              onChange={(e) => updateExotic('letCalculatorChoose', e.target.checked)}
                              className="sr-only peer"
                            />
                            <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                            <span className="ml-3 text-sm font-medium text-gray-300">Let calculator choose</span>
                          </label>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-300 mb-1">
                              Main Stat
                            </label>
                            <select
                              value={exoticArmor.letCalculatorChoose ? 'weapon' : (exoticArmor.mainStat || '')}
                              onChange={(e) => updateExotic('mainStat', e.target.value || null)}
                              className={`w-full bg-gray-700 text-white rounded p-2 ${exoticArmor.letCalculatorChoose ? 'opacity-50 cursor-not-allowed' : ''}`}
                              disabled={exoticArmor.letCalculatorChoose}
                            >
                              {allStats.map((stat) => (
                                <option key={stat} value={stat}>
                                  {stat.charAt(0).toUpperCase() + stat.slice(1)}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-300 mb-1">
                              Sub Stat
                            </label>
                            <select
                              value={exoticArmor.letCalculatorChoose ? 'grenade' : (exoticArmor.subStat || '')}
                              onChange={(e) => updateExotic('subStat', e.target.value || null)}
                              className={`w-full bg-gray-700 text-white rounded p-2 ${exoticArmor.letCalculatorChoose ? 'opacity-50 cursor-not-allowed' : ''}`}
                              disabled={exoticArmor.letCalculatorChoose}
                            >
                              {allStats.map((stat) => (
                                <option key={stat} value={stat}>
                                  {stat.charAt(0).toUpperCase() + stat.slice(1)}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-300 mb-1">
                              Third Stat
                            </label>
                            <select
                              value={exoticArmor.letCalculatorChoose ? 'super' : (exoticArmor.thirdStat || '')}
                              onChange={(e) => updateExotic('thirdStat', e.target.value || null)}
                              className={`w-full bg-gray-700 text-white rounded p-2 ${exoticArmor.letCalculatorChoose ? 'opacity-50 cursor-not-allowed' : ''}`}
                              disabled={exoticArmor.letCalculatorChoose}
                            >
                              {allStats.map((stat) => (
                                <option key={stat} value={stat}>
                                  {stat.charAt(0).toUpperCase() + stat.slice(1)}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-300 mb-1">
                              Main Stat Value
                            </label>
                            <input
                              type="text"
                              inputMode="numeric"
                              pattern="[0-9]*"
                              value={exoticArmor.mainStatValue}
                              onChange={(e) => updateExotic('mainStatValue', e.target.value)}
                              className="w-full bg-gray-700 text-white rounded p-2"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-300 mb-1">
                              Sub Stat Value
                            </label>
                            <input
                              type="text"
                              inputMode="numeric"
                              pattern="[0-9]*"
                              value={exoticArmor.subStatValue}
                              onChange={(e) => updateExotic('subStatValue', e.target.value)}
                              className="w-full bg-gray-700 text-white rounded p-2"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-300 mb-1">
                              Third Stat Value
                            </label>
                            <input
                              type="text"
                              inputMode="numeric"
                              pattern="[0-9]*"
                              value={exoticArmor.thirdStatValue}
                              onChange={(e) => updateExotic('thirdStatValue', e.target.value)}
                              className="w-full bg-gray-700 text-white rounded p-2"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Section Add Fixed Armor */}
                <div className="bg-gray-800 p-4 rounded-lg">
                  <div className="flex justify-between items-center mb-4">
                    <div className="flex items-center gap-2">
                      <h2 className="text-xl font-bold text-white">Add Fixed Armor</h2>
                      <div className="relative group">
                        <button
                          type="button"
                          className="text-gray-400 hover:text-white transition-colors duration-200"
                          aria-label="Information about Fixed Armor"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                          </svg>
                        </button>
                        <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-64 p-2 bg-gray-900 text-white text-sm rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-10">
                          <p>
                            Add fixed legendary armor pieces with specific stats. You can add up to 4 if you have an exotic, or 5 if you don&apos;t.
                        </p>
                        <div className="absolute left-1/2 -translate-x-1/2 top-full w-2 h-2 bg-gray-900 transform rotate-45"></div>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={addFixedArmor}
                        disabled={fixedArmors.length >= (exoticArmor ? 4 : 5)}
                      className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Add ({fixedArmors.length}/{exoticArmor ? 4 : 5})
                    </button>
                    <button
                      type="button"
                      onClick={() => setFixedArmors([])}
                      className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded transition-colors duration-200"
                    >
                      Reset All
                    </button>
                  </div>
                </div>

                <div className="space-y-4">
                  {fixedArmors.map((armor, index) => (
                    <div key={index} className="bg-gray-800 rounded-lg p-4 mb-4">
                      <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-semibold text-white">Fixed Armor {index + 1}</h3>
                        <button
                          type="button"
                          onClick={() => removeFixedArmor(index)}
                          className="text-red-400 hover:text-red-300"
                        >
                          Remove
                        </button>
                      </div>
                      <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-300 mb-1">
                              Main Stat
                            </label>
                            <select
                                value={armor.mainStat}
                                onChange={(e) => updateFixedArmor(index, 'mainStat', e.target.value)}
                                className="w-full bg-gray-700 text-white rounded p-2"
                            >
                              {allStats.map((stat) => (
                                <option key={stat} value={stat}>
                                  {stat.charAt(0).toUpperCase() + stat.slice(1)}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-300 mb-1">
                              Sub Stat
                            </label>
                            <select
                                value={armor.subStat}
                                onChange={(e) => updateFixedArmor(index, 'subStat', e.target.value)}
                                className="w-full bg-gray-700 text-white rounded p-2"
                            >
                              {allStats.map((stat) => (
                                <option key={stat} value={stat}>
                                  {stat.charAt(0).toUpperCase() + stat.slice(1)}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-300 mb-1">
                              Third Stat
                            </label>
                            <select
                                value={armor.thirdStat}
                                onChange={(e) => updateFixedArmor(index, 'thirdStat', e.target.value)}
                                className="w-full bg-gray-700 text-white rounded p-2"
                            >
                              {allStats.map((stat) => (
                                <option key={stat} value={stat}>
                                  {stat.charAt(0).toUpperCase() + stat.slice(1)}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-300 mb-1">
                              Main Stat Value
                            </label>
                            <input
                              type="text"
                              inputMode="numeric"
                              pattern="[0-9]*"
                              value={armor.mainStatValue}
                              onChange={(e) => updateFixedArmor(index, 'mainStatValue', e.target.value)}
                              className="w-full bg-gray-700 text-white rounded p-2"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-300 mb-1">
                              Sub Stat Value
                            </label>
                            <input
                              type="text"
                              inputMode="numeric"
                              pattern="[0-9]*"
                              value={armor.subStatValue}
                              onChange={(e) => updateFixedArmor(index, 'subStatValue', e.target.value)}
                              className="w-full bg-gray-700 text-white rounded p-2"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-300 mb-1">
                              Third Stat Value
                            </label>
                            <input
                              type="text"
                              inputMode="numeric"
                              pattern="[0-9]*"
                              value={armor.thirdStatValue}
                              onChange={(e) => updateFixedArmor(index, 'thirdStatValue', e.target.value)}
                              className="w-full bg-gray-700 text-white rounded p-2"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </form>
          </div>

          {isLoading && (
            <div className="flex justify-center items-center my-8">
              <svg className="animate-spin h-8 w-8 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
              </svg>
            </div>
          )}

            {!isLoading && results.length > 0 && (
            <div className="lg:mt-0 space-y-4">
                  <h2 className="text-xl font-semibold text-gray-300">
                    {results.some(r => r.isTargetAchieved)
                      ? (results.length >= 50 
                        ? 'Found 50 combinations that achieve target stats (limited to 50, try to increase your expectations to get more accurate results):'
                        : 'Found combinations that achieve target stats:')
                      : 'target stats not fully achievable try lowering targeted stats(the result might not be optimal):'}
                  </h2>
                  
                  {(results.some(r => r.isTargetAchieved)
                    ? results.filter(r => r.isTargetAchieved)
                    : results.slice(0, 1)
                  ).map((result: BestCombination, index: number) => {
                    const totalStats = calculateTotalStats(result.combination);
                    const uniquePatternCount = new Set(result.combination.map((p: ArmorPiece) => p.pattern.name)).size;

                    const statOrder: StatType[] = ['health', 'melee', 'grenade', 'super', 'class', 'weapon'];
                    const orderedStats = statOrder.map(stat => [stat, totalStats[stat]] as [string, number]);

                    return (
                      <div key={index} className="border border-gray-700 rounded-lg overflow-hidden">
                        <div className="px-4 py-3 bg-gray-800 flex justify-between items-center">
                          <button
                            onClick={() => toggleResult(index)}
                            className="flex-1 flex justify-between items-center hover:bg-gray-700 px-2 py-1 rounded"
                          >
                            <div className="flex items-center space-x-4">
                              <span className="text-xs text-gray-400 mr-2">Used {uniquePatternCount} archetype{uniquePatternCount !== 1 ? '(s)' : ''}</span>
                              <div className="flex items-center space-x-4">
                                <div className="flex flex-wrap gap-3">
                                  {orderedStats.map(([stat, value]) => (
                                    <span
                                      key={stat}
                                      className={
                                        value === getNumericTargetStats()[stat as StatType]
                                          ? 'text-white'
                                          : value > getNumericTargetStats()[stat as StatType]
                                            ? 'text-green-400'
                                            : 'text-red-400'
                                      }
                                    >
                                      {value} {stat.slice(0, 3)}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            </div>
                            <span className="text-gray-500">
                              {expandedResults.includes(index) ? '▼' : '▶'}
                            </span>
                          </button>
                          <button
                            key={`pin-${index}-${pinUpdateTrigger}`}
                            onClick={() => handlePinCombination(result)}
                            className={`ml-2 px-2 py-1 rounded text-sm transition-colors ${
                              isCombinationPinned(result)
                                ? 'bg-red-600 hover:bg-red-700 text-white'
                                : 'bg-gray-600 hover:bg-gray-700 text-white'
                            }`}
                            title={isCombinationPinned(result) ? 'unpin this combination' : 'pin this combination'}
                          >
                            📌
                          </button>
                        </div>
                        
                        {expandedResults.includes(index) && (
                          <div className="p-4 space-y-4 bg-gray-800">
                            <div className="overflow-x-auto">
                              <table className="w-full">
                                <thead>
                                  <tr className="text-left text-gray-400 text-sm">
                                    <th className="pb-2">Archetype</th>
                                    <th className="pb-2">Third Stat</th>
                                    <th className="pb-2">Mod</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {result.combination.map((piece: ArmorPiece, pieceIndex: number) => (
                                    <tr key={pieceIndex} className="border-t border-gray-700">
                                      <td className="py-2 overflow-visible">
                                        <div className="flex items-center gap-2">
                                          {/* SVG engram avec couleur selon le type d'armure */}
                                          <svg
                                            className={`w-5 h-5 ${piece.isExotic === true ? 'text-yellow-400' : 'text-purple-400'}`}
                                            viewBox="0 -12.63 369.54991 369.54991"
                                            xmlns="http://www.w3.org/2000/svg"
                                            fill="currentColor"
                                          >
                                            <g id="Layer_2" data-name="Layer 2">
                                              <g id="Layer_1-2" data-name="Layer 1">
                                                <path d="M189.71791,36.81064h-9.3831L79.286,22.37509,116.81842,0H253.95608l37.53241,22.37509ZM0,158.15841l65.68172,85.1697,40.41952,98.88348L67.84705,319.11472,0,199.29971ZM191.271,49.89183l5.05244-5.77421L300.2593,29.68207l67.84706,117.64968-68.56883,87.335L191.271,172.594ZM303.86819,244.77167l65.68172-85.89148v41.86307L301.70286,319.83649l-38.976,23.81865Zm-123.4239-71.45594L72.17772,235.38857l-68.56883-87.335L72.17772,30.40385,175.39185,44.83939l5.05244,5.77422Zm3.49941,9.29389,107.54479,60.62929-39.69774,101.0488H115.37486l-38.976-101.0488Z"/>
                                              </g>
                                            </g>
                                          </svg>
                                          <span className="text-gray-300" style={{ color: PATTERN_COLORS[piece.pattern.name] || undefined }}>
                                            {piece.isExotic ? piece.pattern.name : piece.pattern.name}
                                          </span>
                                          <div className="relative group">
                                            <button
                                              type="button"
                                              className="text-gray-400 hover:text-white transition-colors duration-200"
                                              aria-label="Information about pattern"
                                            >
                                              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                                              </svg>
                                            </button>
                                            <div className={`absolute left-0 ${pieceIndex >= result.combination.length - 2 ? 'bottom-full mb-1' : 'top-full mt-1'} hidden group-hover:block bg-gray-900 p-2 rounded shadow-lg z-50 min-w-[200px]`}>
                                              <p className="text-sm text-gray-300">
                                                {piece.letCalculatorChoose ? (
                                                  <>
                                                    Main: {piece.pattern.mainStat} ({piece.mainStatValue})<br />
                                                    Sub: {piece.pattern.subStat} ({piece.subStatValue})
                                                  </>
                                                ) : piece.pattern.mainStatValue ? (
                                                  <>
                                                    Main: {piece.pattern.mainStat} ({piece.pattern.mainStatValue})<br />
                                                    Sub: {piece.pattern.subStat} ({piece.pattern.subStatValue})
                                                  </>
                                                ) : (
                                                  <>
                                                    Main: {piece.pattern.mainStat} ({TIER_STAT_VALUES[piece.tier].main})<br />
                                                    Sub: {piece.pattern.subStat} ({TIER_STAT_VALUES[piece.tier].sub})
                                                  </>
                                                )}
                                              </p>
                                            </div>
                                          </div>
                                        </div>
                                      </td>
                                      <td className="py-2 text-gray-300">
                                        {piece.thirdStat} ({piece.letCalculatorChoose ? piece.thirdStatValue : (piece.pattern.thirdStatValue || TIER_STAT_VALUES[piece.tier].third)})
                                      </td>
                                      <td className="py-2 text-gray-300">
                                        {piece.smallMods.length > 0 && (
                                          <span className="text-purple-400">
                                            Small: {piece.smallMods[0]} (+{MOD_VALUES.small})
                                          </span>
                                        )}
                                        {piece.largeMods.length > 0 && (
                                          <span className="text-orange-400">
                                            Large: {piece.largeMods[0]} (+{MOD_VALUES.large})
                                          </span>
                                        )}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
            )}
                </div>
              )}

              {activeTab === 'pinned' && (
                <PinnedCombinations />
              )}
            </div>
      <Toaster 
        position="top-right" 
        toastOptions={{
          style: {
            background: '#1f2937',
            color: '#f9fafb',
            border: '1px solid #374151'
          },
        }}
      />
    </>
  );
} 