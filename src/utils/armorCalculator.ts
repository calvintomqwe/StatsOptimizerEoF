import { ArmorPiece, ArmorStats, StatType, TIER_STAT_VALUES, MOD_VALUES } from '../types/armor';
import { ARMOR_PATTERNS } from '../data/patterns';

// Fonction inutilisée, commentée pour éviter l'erreur de linter
/*
export const calculatePieceStats = (piece: ArmorPiece): Stats => {
  const stats: Stats = {
    weapon: 5,
    health: 5,
    class: 5,
    grenade: 5,
    melee: 5,
    super: 5
  };

  // Appliquer les valeurs spécifiées
  if (piece.pattern.mainStatValue) {
    stats[piece.pattern.mainStat] = piece.pattern.mainStatValue;
  }
  if (piece.pattern.subStatValue) {
    stats[piece.pattern.subStat] = piece.pattern.subStatValue;
  }
  if (piece.pattern.thirdStatValue) {
    stats[piece.pattern.thirdStat] = piece.pattern.thirdStatValue;
  }

  // Appliquer les mods
  piece.smallMods.forEach(mod => {
    stats[mod] += MOD_VALUES.small;
  });
  piece.largeMods.forEach(mod => {
    stats[mod] += MOD_VALUES.large;
  });

  return stats;
};
*/

export function calculateSinglePieceStats(piece: ArmorPiece): ArmorStats {
  const stats: ArmorStats = {
    weapon: 5,
    health: 5,
    class: 5,
    grenade: 5,
    melee: 5,
    super: 5
  };

  // Si c'est une armure en mode "let calculator choose", on utilise directement les valeurs renseignées
  if (piece.letCalculatorChoose) {
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
    const currentMods = new Set<string>();

    // Appliquer les mods sur les armures fixes
    while (currentMods.size < modCounts.small + modCounts.large) {
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
          // Essayer d'abord un grand mod
          if (currentMods.size < modCounts.large) {
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
          // Si pas de grand mod ou si le petit mod est meilleur
          if (currentMods.size < modCounts.small) {
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
        }
      }

      if (bestModImprovement <= 0) break;

      if (bestModType === 'small') {
        pieces[bestModPiece] = {
          ...pieces[bestModPiece],
          smallMods: [furthestStat!],
          largeMods: []
        };
        currentMods.add(furthestStat!);
      } else if (bestModType === 'large') {
        pieces[bestModPiece] = {
          ...pieces[bestModPiece],
          smallMods: [],
          largeMods: [furthestStat!]
        };
        currentMods.add(furthestStat!);
      }

      currentStats = calculateTotalStats(pieces);
      currentScore = calculateScore(currentStats, targetStats);
    }

    const isTargetAchieved = isTargetStatsAchieved(currentStats, targetStats);
    const result: BestCombination = {
      combination: pieces,
      remainingMods: { small: modCounts.small - currentMods.size, large: modCounts.large - currentMods.size },
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

    // On ne garde que les armures fixes normales (pas en mode "let calc choose")
    const normalFixedArmors = fixedArmors.filter(armor => !armor.letCalculatorChoose);

    function generate(index: number) {
      if (index === numPieces) {
        const key = generateCombinationKey(current);
        if (!testedCombinations.has(key)) {
          testedCombinations.set(key, true);
          // Ajouter les armures fixes normales à la fin
          const fullCombination = [...current, ...normalFixedArmors];
          combinations.push(fullCombination);
        }
        return;
      }

      // Si c'est une armure en mode "let calculator choose", on utilise les valeurs renseignées
      if (fixedArmors[index]?.letCalculatorChoose) {
        const fixedArmor = fixedArmors[index];
        for (const pattern of patterns) {
          for (const thirdStat of pattern.possibleThirdStats) {
            if (thirdStat !== pattern.mainStat && thirdStat !== pattern.subStat) {
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
            if (thirdStat !== pattern.mainStat && thirdStat !== pattern.subStat) {
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
    const currentMods = new Set<string>();
    let smallModsUsed = 0;
    let largeModsUsed = 0;

    // Appliquer les mods sur toutes les armures
    while (smallModsUsed + largeModsUsed < modCounts.small + modCounts.large) {
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
          // Essayer d'abord un petit mod si on peut atteindre la cible avec
          if (smallModsUsed < modCounts.small && maxDiff <= MOD_VALUES.small) {
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
          // Si on ne peut pas atteindre la cible avec un petit mod ou si on n'a plus de petits mods
          else if (largeModsUsed < modCounts.large) {
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
        currentMods.add(furthestStat!);
        smallModsUsed++;
      } else if (bestModType === 'large') {
        pieces[bestModPiece] = {
          ...pieces[bestModPiece],
          smallMods: [],
          largeMods: [furthestStat!]
        };
        currentMods.add(furthestStat!);
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