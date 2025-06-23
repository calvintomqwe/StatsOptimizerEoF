import { BestCombination, PinnedCombination, TIER_STAT_VALUES, ArmorPiece } from '../types/armor';
import { calculateTotalStats } from './armorCalculator';

const PINNED_COMBINATIONS_KEY = 'pinnedCombinations';

function countUniqueArchetypes(pieces: ArmorPiece[]): number {
  const uniqueArchetypes = new Set(pieces.map(piece => piece.pattern.name));
  return uniqueArchetypes.size;
}

export function getPinnedCombinations(): PinnedCombination[] {
  if (typeof window === 'undefined') return [];
  
  try {
    const stored = localStorage.getItem(PINNED_COMBINATIONS_KEY);
    if (!stored) return [];
    
    const combinations = JSON.parse(stored);
    
    // Vérifier si les combinaisons ont le nouveau format avec totalStats
    const needsMigration = combinations.some((combo: PinnedCombination) => !combo.totalStats);
    
    if (needsMigration) {
      console.log('Migrating pinned combinations to new format...');
      // Supprimer les anciennes combinaisons non compatibles
      localStorage.removeItem(PINNED_COMBINATIONS_KEY);
      return [];
    }
    
    // Migrer les combinaisons pour ajouter les valeurs manquantes
    const migratedCombinations = combinations.map((combo: PinnedCombination) => {
      const migratedCombination = combo.combination.map(piece => {
        // Si les valeurs ne sont pas stockées, les calculer
        if (!piece.mainStatValue || !piece.subStatValue || !piece.thirdStatValue) {
          const tierValues = TIER_STAT_VALUES[piece.tier] || TIER_STAT_VALUES[5];
          return {
            ...piece,
            mainStatValue: tierValues.main.toString(),
            subStatValue: tierValues.sub.toString(),
            thirdStatValue: tierValues.third.toString()
          };
        }
        return piece;
      });
      
      // Déterminer si c'est un tier custom
      const isCustom = combo.isCustomTier !== undefined ? combo.isCustomTier : 
        migratedCombination.some(piece => piece.letCalculatorChoose) ||
        migratedCombination.some(piece => !TIER_STAT_VALUES[piece.tier]);
      
      return {
        ...combo,
        combination: migratedCombination,
        isCustomTier: isCustom,
        customTierValues: isCustom ? {
          main: parseInt(migratedCombination[0]?.mainStatValue || '0'),
          sub: parseInt(migratedCombination[0]?.subStatValue || '0'),
          third: parseInt(migratedCombination[0]?.thirdStatValue || '0')
        } : undefined
      };
    });
    
    // Sauvegarder les combinaisons migrées
    if (JSON.stringify(combinations) !== JSON.stringify(migratedCombinations)) {
      savePinnedCombinations(migratedCombinations);
      return migratedCombinations;
    }
    
    return combinations;
  } catch {
    console.error('Error loading pinned combinations');
    // En cas d'erreur, supprimer le cache corrompu
    localStorage.removeItem(PINNED_COMBINATIONS_KEY);
    return [];
  }
}

export function savePinnedCombinations(combinations: PinnedCombination[]): void {
  if (typeof window === 'undefined') return;
  
  try {
    localStorage.setItem(PINNED_COMBINATIONS_KEY, JSON.stringify(combinations));
  } catch (error) {
    console.error('Error saving pinned combinations:', error);
  }
}

function generateDefaultName(): string {
  const pinnedCombinations = getPinnedCombinations();
  
  // Trouver le plus grand numéro existant
  let maxNumber = 0;
  pinnedCombinations.forEach(combo => {
    const match = combo.name.match(/^Combination (\d+)$/);
    if (match) {
      const number = parseInt(match[1]);
      if (number > maxNumber) {
        maxNumber = number;
      }
    }
  });
  
  return `Combination ${maxNumber + 1}`;
}

export function addPinnedCombination(combination: BestCombination, name?: string): PinnedCombination {
  const pinnedCombinations = getPinnedCombinations();
  
  // Générer un nom par défaut si aucun n'est fourni
  const combinationName = name || generateDefaultName();
  
  // S'assurer que toutes les pièces ont leurs valeurs stockées en dur
  const combinationWithValues = combination.combination.map(piece => {
    // Si c'est une armure "let calculator choose" ou avec des valeurs personnalisées, on garde ces valeurs
    if (piece.letCalculatorChoose || (piece.mainStatValue && piece.subStatValue && piece.thirdStatValue)) {
      return {
        ...piece,
        mainStatValue: piece.mainStatValue,
        subStatValue: piece.subStatValue,
        thirdStatValue: piece.thirdStatValue
      };
    } else {
      // Pour les armures normales, on calcule et stocke les valeurs du tier
      const tierValues = TIER_STAT_VALUES[piece.tier] || TIER_STAT_VALUES[5];
      return {
        ...piece,
        mainStatValue: tierValues.main.toString(),
        subStatValue: tierValues.sub.toString(),
        thirdStatValue: tierValues.third.toString()
      };
    }
  });
  
  const newPinned: PinnedCombination = {
    id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
    name: combinationName,
    combination: combinationWithValues,
    remainingMods: combination.remainingMods,
    score: combination.score,
    isTargetAchieved: combination.isTargetAchieved,
    archetypeCount: countUniqueArchetypes(combination.combination),
    createdAt: new Date().toISOString(),
    totalStats: calculateTotalStats(combination.combination),
    isCustomTier: combination.combination.some(piece => piece.letCalculatorChoose),
    customTierValues: combination.combination.some(piece => piece.letCalculatorChoose) ? {
      main: parseInt(combination.combination.find(p => p.letCalculatorChoose)?.mainStatValue || '0'),
      sub: parseInt(combination.combination.find(p => p.letCalculatorChoose)?.subStatValue || '0'),
      third: parseInt(combination.combination.find(p => p.letCalculatorChoose)?.thirdStatValue || '0')
    } : undefined
  };
  
  pinnedCombinations.push(newPinned);
  savePinnedCombinations(pinnedCombinations);
  
  return newPinned;
}

export function removePinnedCombination(id: string): void {
  const pinnedCombinations = getPinnedCombinations();
  const filtered = pinnedCombinations.filter(combo => combo.id !== id);
  savePinnedCombinations(filtered);
}

export function updatePinnedCombinationName(id: string, newName: string): void {
  const pinnedCombinations = getPinnedCombinations();
  const updated = pinnedCombinations.map(combo => 
    combo.id === id ? { ...combo, name: newName } : combo
  );
  savePinnedCombinations(updated);
}

export function exportPinnedCombinations(): string {
  const pinnedCombinations = getPinnedCombinations();
  return JSON.stringify(pinnedCombinations, null, 2);
}

export function importPinnedCombinations(jsonString: string): { success: boolean; message: string } {
  try {
    const imported = JSON.parse(jsonString);
    
    if (!Array.isArray(imported)) {
      return { success: false, message: 'JSON must contain an array of combinations' };
    }
    
    // Valider la structure des données importées
    for (const combo of imported) {
      if (!combo.id || !combo.name || !combo.combination || !Array.isArray(combo.combination)) {
        return { success: false, message: 'Invalid combination format in JSON' };
      }
    }
    
    const existingCombinations = getPinnedCombinations();
    const merged = [...existingCombinations, ...imported];
    
    // Supprimer les doublons basés sur l'ID
    const uniqueCombinations = merged.filter((combo, index, self) => 
      index === self.findIndex(c => c.id === combo.id)
    );
    
    savePinnedCombinations(uniqueCombinations);
    
    return { 
      success: true, 
      message: `${imported.length} combination(s) imported successfully` 
    };
  } catch {
    return { success: false, message: 'Error parsing JSON' };
  }
}

export function isCombinationPinned(combination: BestCombination): boolean {
  const pinnedCombinations = getPinnedCombinations();
  
  // Créer une clé unique pour la combinaison basée sur les propriétés essentielles
  const combinationKey = combination.combination
    .map(piece => {
      // Inclure les propriétés essentielles pour une comparaison exacte
      return `${piece.pattern.name}-${piece.thirdStat}-${piece.tier}-${piece.isExotic ? 'exotic' : 'normal'}-${piece.letCalculatorChoose ? 'letcalc' : 'fixed'}`;
    })
    .sort()
    .join('|');
  
  return pinnedCombinations.some(pinned => {
    const pinnedKey = pinned.combination
      .map(piece => {
        return `${piece.pattern.name}-${piece.thirdStat}-${piece.tier}-${piece.isExotic ? 'exotic' : 'normal'}-${piece.letCalculatorChoose ? 'letcalc' : 'fixed'}`;
      })
      .sort()
      .join('|');
    
    return pinnedKey === combinationKey;
  });
} 