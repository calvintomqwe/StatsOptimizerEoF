import { ArmorPiece, ArmorStats, StatType, TIER_STAT_VALUES, MOD_VALUES } from '../types/armor';
import { ARMOR_PATTERNS } from '../data/patterns';

export function calculateSinglePieceStats(piece: ArmorPiece): ArmorStats {
  const stats: ArmorStats = {
    weapon: 5,
    health: 5,
    class: 5,
    grenade: 5,
    melee: 5,
    super: 5
  };

  // Si c'est une armure en mode "let calculator choose" ou si elle a des valeurs personnalisées, on utilise directement les valeurs renseignées
  if (piece.letCalculatorChoose || (piece.mainStatValue && piece.subStatValue && piece.thirdStatValue)) {
    stats[piece.pattern.mainStat] = parseInt(piece.mainStatValue || '0');
    stats[piece.pattern.subStat] = parseInt(piece.subStatValue || '0');
    stats[piece.thirdStat] = parseInt(piece.thirdStatValue || '0');
  } else {
    // Pour les armures normales, utiliser les valeurs du tier avec les stats du pattern
    const tierValues = TIER_STAT_VALUES[piece.tier];
    stats[piece.pattern.mainStat] = tierValues.main;
    stats[piece.pattern.subStat] = tierValues.sub;
    stats[piece.thirdStat] = tierValues.third;
  }

  // Appliquer les mods
  piece.smallMods.forEach(mod => {
    stats[mod] += MOD_VALUES.small;
  });
  piece.largeMods.forEach(mod => {
    stats[mod] += MOD_VALUES.large;
  });

  return stats;
}

export function calculateTotalStats(pieces: ArmorPiece[]): ArmorStats {
  return pieces.reduce((total, piece) => {
    const pieceStats = calculateSinglePieceStats(piece);
    return {
      weapon: total.weapon + pieceStats.weapon,
      health: total.health + pieceStats.health,
      class: total.class + pieceStats.class,
      grenade: total.grenade + pieceStats.grenade,
      melee: total.melee + pieceStats.melee,
      super: total.super + pieceStats.super
    };
  }, {
    weapon: 0,
    health: 0,
    class: 0,
    grenade: 0,
    melee: 0,
    super: 0
  });
}

interface BestCombination {
  combination: ArmorPiece[];
  remainingMods: { small: number; large: number };
  score: number;
  isTargetAchieved: boolean;
}

function countUniqueArchetypes(pieces: ArmorPiece[]): number {
  const uniqueArchetypes = new Set(pieces.map(piece => piece.pattern.name));
  return uniqueArchetypes.size;
}

export function findBestCombination(
  targetStats: Record<StatType, number>,
  tier: number,
  modCounts: { small: number; large: number },
  fixedArmors: ArmorPiece[] = []
): BestCombination[] {
  const allStats: StatType[] = ['weapon', 'health', 'class', 'grenade', 'melee', 'super'];
  const results: BestCombination[] = [];
  let bestScore = Infinity;

  // Si on a déjà 5 armures fixes, on ne génère pas de nouvelles armures
  if (fixedArmors.length === 5) {
    const pieces = [...fixedArmors];
    let currentStats = calculateTotalStats(pieces);
    let currentScore = calculateScore(currentStats, targetStats);
    let smallModsUsed = 0;
    let largeModsUsed = 0;

    // Appliquer les mods sur les armures fixes
    while (smallModsUsed + largeModsUsed < modCounts.small + modCounts.large) {
      // Vérifier si les stats cibles sont déjà atteintes
      if (isTargetStatsAchieved(currentStats, targetStats)) {
        break;
      }

      // Trouver la stat la plus éloignée de sa cible
      let furthestStat: StatType | null = null;
      let maxDiff = -Infinity;
      for (const stat of allStats) {
        const diff = targetStats[stat] - currentStats[stat];
        if (diff > maxDiff) {
          maxDiff = diff;
          furthestStat = stat;
        }
      }

      // Si toutes les stats sont au-dessus de leur cible, on arrête
      if (maxDiff <= 0) break;

      let bestModImprovement = -Infinity;
      let bestModPiece = -1;
      let bestModType: 'small' | 'large' | null = null;

      // Essayer d'appliquer un mod sur la stat la plus éloignée
      for (let i = 0; i < pieces.length; i++) {
        const piece = pieces[i];
        if (piece.smallMods.length === 0 && piece.largeMods.length === 0) {
          // Essayer d'abord un petit mod si on en a encore
          if (smallModsUsed < modCounts.small) {
            const tempPiece: ArmorPiece = {
              ...piece,
              smallMods: [furthestStat!],
              largeMods: []
            };
            const tempPieces = [...pieces];
            tempPieces[i] = tempPiece;
            const tempStats = calculateTotalStats(tempPieces);
            const improvement = calculateScore(currentStats, targetStats) - calculateScore(tempStats, targetStats);
            if (improvement > bestModImprovement) {
              bestModImprovement = improvement;
              bestModPiece = i;
              bestModType = 'small';
            }
          }
          // Si on n'a plus de petits mods ou si le grand mod est meilleur
          if (largeModsUsed < modCounts.large) {
            const tempPiece: ArmorPiece = {
              ...piece,
              smallMods: [],
              largeMods: [furthestStat!]
            };
            const tempPieces = [...pieces];
            tempPieces[i] = tempPiece;
            const tempStats = calculateTotalStats(tempPieces);
            const improvement = calculateScore(currentStats, targetStats) - calculateScore(tempStats, targetStats);
            if (improvement > bestModImprovement) {
              bestModImprovement = improvement;
              bestModPiece = i;
              bestModType = 'large';
            }
          }
        }
      }

      if (bestModImprovement <= 0) break;

      if (bestModType === 'small') {
        pieces[bestModPiece] = {
          ...pieces[bestModPiece],
          smallMods: [furthestStat!],
          largeMods: []
        };
        smallModsUsed++;
      } else if (bestModType === 'large') {
        pieces[bestModPiece] = {
          ...pieces[bestModPiece],
          smallMods: [],
          largeMods: [furthestStat!]
        };
        largeModsUsed++;
      }

      currentStats = calculateTotalStats(pieces);
      currentScore = calculateScore(currentStats, targetStats);
    }

    const isTargetAchieved = isTargetStatsAchieved(currentStats, targetStats);
    const result: BestCombination = {
      combination: pieces,
      remainingMods: { small: modCounts.small - smallModsUsed, large: modCounts.large - largeModsUsed },
      score: currentScore,
      isTargetAchieved
    };

    if (isTargetAchieved) {
      results.push(result);
    } else if (currentScore < bestScore) {
      bestScore = currentScore;
      results[0] = result;
    }

    return results;
  }

  // Sort patterns by how well they match the target stats
  const sortedPatterns = [...ARMOR_PATTERNS].sort((a, b) => {
    const aScore = calculatePatternScore(a, targetStats);
    const bScore = calculatePatternScore(b, targetStats);
    return aScore - bScore;
  });

  // Map pour stocker les combinaisons déjà testées
  const testedCombinations = new Map<string, boolean>();

  // Fonction pour générer une clé unique pour une combinaison d'armures
  function generateCombinationKey(pieces: ArmorPiece[]): string {
    return pieces.map(p => `${p.pattern.name}-${p.thirdStat}`).sort().join('|');
  }

  // Fonction pour générer toutes les combinaisons possibles
  function generateAllCombinations(patterns: typeof ARMOR_PATTERNS, numPieces: number): ArmorPiece[][] {
    const combinations: ArmorPiece[][] = [];
    const current: ArmorPiece[] = [];

    // Séparer les armures fixes par type
    const letCalcChooseArmors = fixedArmors.filter(armor => armor.letCalculatorChoose);
    const normalFixedArmors = fixedArmors.filter(armor => !armor.letCalculatorChoose);

    // Filtrer les stats ciblées à 0 pour les exclure des troisième stats
    const excludedThirdStats = allStats.filter(stat => targetStats[stat] === 0);

    function generate(index: number) {
      if (index === numPieces) {
        const key = generateCombinationKey(current);
        if (!testedCombinations.has(key)) {
          testedCombinations.set(key, true);
          // Ajouter les armures fixes normales à la fin en conservant leurs valeurs personnalisées
          const fullCombination = [...current, ...normalFixedArmors.map(armor => ({
            ...armor,
            // S'assurer que les valeurs personnalisées sont conservées
            mainStatValue: armor.mainStatValue,
            subStatValue: armor.subStatValue,
            thirdStatValue: armor.thirdStatValue
          }))];
          combinations.push(fullCombination);
        }
        return;
      }

      // Si c'est une armure en mode "let calculator choose", on utilise les valeurs renseignées
      if (index < letCalcChooseArmors.length) {
        const fixedArmor = letCalcChooseArmors[index];
        for (const pattern of patterns) {
          for (const thirdStat of pattern.possibleThirdStats) {
            if (thirdStat !== pattern.mainStat && 
                thirdStat !== pattern.subStat && 
                !excludedThirdStats.includes(thirdStat)) {
              current.push({
                pattern,
                tier,
                thirdStat,
                smallMods: [],
                largeMods: [],
                letCalculatorChoose: true,
                mainStatValue: fixedArmor.mainStatValue,
                subStatValue: fixedArmor.subStatValue,
                thirdStatValue: fixedArmor.thirdStatValue
              });
              generate(index + 1);
              current.pop();
            }
          }
        }
      } else {
        // Pour les armures normales, on utilise le pattern tel quel
        for (const pattern of patterns) {
          for (const thirdStat of pattern.possibleThirdStats) {
            if (thirdStat !== pattern.mainStat && 
                thirdStat !== pattern.subStat && 
                !excludedThirdStats.includes(thirdStat)) {
              current.push({
                pattern,
                tier,
                thirdStat,
                smallMods: [],
                largeMods: []
              });
              generate(index + 1);
              current.pop();
            }
          }
        }
      }
    }

    generate(0);
    return combinations;
  }

  // Générer toutes les combinaisons possibles
  // On compte les armures fixes normales et on ajoute le nombre d'armures en mode "let calculator choose"
  const numPiecesNeeded = 5 - fixedArmors.filter(armor => !armor.letCalculatorChoose).length;
  const allCombinations = generateAllCombinations(sortedPatterns, numPiecesNeeded);

  // Tester chaque combinaison
  for (const combination of allCombinations) {
    const pieces = [...combination];
    let currentStats = calculateTotalStats(pieces);
    let currentScore = calculateScore(currentStats, targetStats);
    let smallModsUsed = 0;
    let largeModsUsed = 0;

    // Appliquer les mods sur toutes les armures
    while (smallModsUsed + largeModsUsed < modCounts.small + modCounts.large) {
      // Vérifier si les stats cibles sont déjà atteintes
      if (isTargetStatsAchieved(currentStats, targetStats)) {
        break;
      }

      // Trouver la stat la plus éloignée de sa cible
      let furthestStat: StatType | null = null;
      let maxDiff = -Infinity;
      for (const stat of allStats) {
        const diff = targetStats[stat] - currentStats[stat];
        if (diff > maxDiff) {
          maxDiff = diff;
          furthestStat = stat;
        }
      }

      // Si toutes les stats sont au-dessus de leur cible, on arrête
      if (maxDiff <= 0) break;

      let bestModImprovement = -Infinity;
      let bestModPiece = -1;
      let bestModType: 'small' | 'large' | null = null;

      // Essayer d'appliquer un mod sur la stat la plus éloignée
      for (let i = 0; i < pieces.length; i++) {
        const piece = pieces[i];
        if (piece.smallMods.length === 0 && piece.largeMods.length === 0) {
          // Essayer d'abord un petit mod si on en a encore
          if (smallModsUsed < modCounts.small) {
            const tempPiece: ArmorPiece = {
              ...piece,
              smallMods: [furthestStat!],
              largeMods: []
            };
            const tempPieces = [...pieces];
            tempPieces[i] = tempPiece;
            const tempStats = calculateTotalStats(tempPieces);
            const improvement = calculateScore(currentStats, targetStats) - calculateScore(tempStats, targetStats);
            if (improvement > bestModImprovement) {
              bestModImprovement = improvement;
              bestModPiece = i;
              bestModType = 'small';
            }
          }
          // Si on n'a plus de petits mods ou si le grand mod est meilleur
          if (largeModsUsed < modCounts.large) {
            const tempPiece: ArmorPiece = {
              ...piece,
              smallMods: [],
              largeMods: [furthestStat!]
            };
            const tempPieces = [...pieces];
            tempPieces[i] = tempPiece;
            const tempStats = calculateTotalStats(tempPieces);
            const improvement = calculateScore(currentStats, targetStats) - calculateScore(tempStats, targetStats);
            if (improvement > bestModImprovement) {
              bestModImprovement = improvement;
              bestModPiece = i;
              bestModType = 'large';
            }
          }
        }
      }

      if (bestModImprovement <= 0) break;

      if (bestModType === 'small') {
        pieces[bestModPiece] = {
          ...pieces[bestModPiece],
          smallMods: [furthestStat!],
          largeMods: []
        };
        smallModsUsed++;
      } else if (bestModType === 'large') {
        pieces[bestModPiece] = {
          ...pieces[bestModPiece],
          smallMods: [],
          largeMods: [furthestStat!]
        };
        largeModsUsed++;
      }

      currentStats = calculateTotalStats(pieces);
      currentScore = calculateScore(currentStats, targetStats);
    }

    const isTargetAchieved = isTargetStatsAchieved(currentStats, targetStats);
    const result: BestCombination = {
      combination: pieces,
      remainingMods: { 
        small: modCounts.small - smallModsUsed, 
        large: modCounts.large - largeModsUsed 
      },
      score: currentScore,
      isTargetAchieved
    };

    if (isTargetAchieved) {
      results.push(result);
      // Si on a trouvé 50 combinaisons qui atteignent les stats cibles, on arrête
      if (results.length >= 50) {
        break;
      }
    } else if (currentScore < bestScore) {
      bestScore = currentScore;
      results[0] = result;
    }
  }

  // Trier les résultats par nombre d'archetypes puis par score
  return results.sort((a, b) => {
    const aArchetypes = countUniqueArchetypes(a.combination);
    const bArchetypes = countUniqueArchetypes(b.combination);
    if (aArchetypes !== bArchetypes) {
      return aArchetypes - bArchetypes;
    }
    return a.score - b.score;
  });
}

function isTargetStatsAchieved(actual: ArmorStats, target: ArmorStats): boolean {
  return Object.keys(target).every(stat => {
    const key = stat as keyof ArmorStats;
    return actual[key] >= target[key];
  });
}

function calculateScore(actual: ArmorStats, target: ArmorStats): number {
  return Object.keys(actual).reduce((score, stat) => {
    const key = stat as keyof ArmorStats;
    const diff = target[key] - actual[key];
    // Si on est au-dessus de la cible, on ne pénalise pas
    if (diff <= 0) return score;
    // Sinon, on utilise le carré de la différence
    return score + diff * diff;
  }, 0);
}

function calculatePatternScore(pattern: typeof ARMOR_PATTERNS[0], targetStats: ArmorStats): number {
  const mainStatValue = targetStats[pattern.mainStat];
  const subStatValue = targetStats[pattern.subStat];
  return -(mainStatValue + subStatValue); // Negative because we want higher values first
} 