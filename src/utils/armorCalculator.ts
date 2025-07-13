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
    const tierValues = TIER_STAT_VALUES[piece.tier] || TIER_STAT_VALUES[5];
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
  fixedArmors: ArmorPiece[] = [],
  factorizeSolutions: boolean = true
): BestCombination[] {
  // Séparer les armures fixes par type
  const letCalcChooseArmors = fixedArmors.filter(armor => armor.letCalculatorChoose);
  const exoticArmors = letCalcChooseArmors.filter(armor => armor.isExotic);

  // Si on a des exotiques en mode "let calculator choose", faire un calcul pour chaque pattern
  if (exoticArmors.length > 0) {
    const allResults: BestCombination[] = [];
    
    for (const exoticArmor of exoticArmors) {
      for (const pattern of ARMOR_PATTERNS) {
        // Fonction pour filtrer les 3ème stats en fonction des stats cibles
        function getValidThirdStats(pattern: typeof ARMOR_PATTERNS[0]): StatType[] {
          const validStats = pattern.possibleThirdStats.filter(stat => 
            stat !== pattern.mainStat && 
            stat !== pattern.subStat && 
            targetStats[stat] > 0
          );
          
          // Si aucune stat valide n'est trouvée, retourner toutes les stats possibles
          if (validStats.length === 0) {
            return pattern.possibleThirdStats.filter(stat => 
              stat !== pattern.mainStat && 
              stat !== pattern.subStat
            );
          }
          
          return validStats;
        }

        const validThirdStats = getValidThirdStats(pattern);
        
        for (const thirdStat of validThirdStats) {
          // Créer une copie des armures fixes avec l'exotique fixé sur ce pattern et cette troisième stat
          const modifiedFixedArmors = fixedArmors.map(armor => {
            if (armor === exoticArmor) {
              return {
                ...armor,
                pattern: {
                  name: pattern.name,
                  mainStat: pattern.mainStat,
                  subStat: pattern.subStat,
                  possibleThirdStats: pattern.possibleThirdStats,
                  mainStatValue: armor.mainStatValue,
                  subStatValue: armor.subStatValue,
                  thirdStatValue: armor.thirdStatValue
                },
                thirdStat: thirdStat,
                letCalculatorChoose: false // On fixe le pattern et la troisième stat
              };
            }
            return armor;
          });

          // Faire le calcul avec cette configuration
          const patternResults = findBestCombinationInternal(
            targetStats,
            tier,
            modCounts,
            modifiedFixedArmors,
            factorizeSolutions
          );

          // Ajouter les résultats
          allResults.push(...patternResults);
        }
      }
    }

    // Trier et dédupliquer les résultats
    const uniqueResults = allResults.filter((result, index, self) => 
      index === self.findIndex(r => 
        JSON.stringify(r.combination.map(p => ({ name: p.pattern.name, thirdStat: p.thirdStat }))) === 
        JSON.stringify(result.combination.map(p => ({ name: p.pattern.name, thirdStat: p.thirdStat })))
      )
    );

    const sortedResults = uniqueResults.sort((a, b) => {
      const aArchetypes = countUniqueArchetypes(a.combination);
      const bArchetypes = countUniqueArchetypes(b.combination);
      if (aArchetypes !== bArchetypes) {
        return aArchetypes - bArchetypes;
      }
      return a.score - b.score;
    });
    
    // Limiter à 50 résultats maximum
    return sortedResults.slice(0, 50);
  }

  // Sinon, utiliser la logique normale
  return findBestCombinationInternal(targetStats, tier, modCounts, fixedArmors, factorizeSolutions);
}

function findBestCombinationInternal(
  targetStats: Record<StatType, number>,
  tier: number,
  modCounts: { small: number; large: number },
  fixedArmors: ArmorPiece[] = [],
  factorizeSolutions: boolean = true
): BestCombination[] {
  const allStats: StatType[] = ['weapon', 'health', 'class', 'grenade', 'melee', 'super'];
  const results: BestCombination[] = [];
  let bestInvalidCombination: BestCombination | null = null;

  // Set pour stocker les solutions déjà trouvées (pour la factorisation)
  const existingSolutions = new Set<string>();

  // Fonction pour générer une clé unique pour une solution
  function generateSolutionKey(combination: ArmorPiece[], totalStats: ArmorStats): string {
    if (!factorizeSolutions) return '';
    
    // Créer une clé basée sur les stats totales et les archetypes utilisés
    // Pour les armures en mode "let calculator choose", on utilise les valeurs réelles
    const archetypes = combination.map(p => {
      if (p.letCalculatorChoose && !p.isExotic) {
        // Pour les armures "let calculator choose" non-exotiques, on inclut les valeurs dans l'archetype
        return `${p.pattern.name}_${p.mainStatValue}_${p.subStatValue}_${p.thirdStatValue}`;
      }
      return p.pattern.name;
    }).sort();
    
    const statsKey = Object.entries(totalStats)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([stat, value]) => `${stat}:${value}`)
      .join('|');
    
    return `${statsKey}|${archetypes.join('|')}`;
  }

  // Fonction pour vérifier si une solution est déjà présente
  function isSolutionDuplicate(combination: ArmorPiece[], totalStats: ArmorStats): boolean {
    if (!factorizeSolutions) return false;
    
    const key = generateSolutionKey(combination, totalStats);
    return existingSolutions.has(key);
  }

  // Fonction pour ajouter une solution à la liste des solutions existantes
  function addSolutionToExisting(combination: ArmorPiece[], totalStats: ArmorStats): void {
    if (!factorizeSolutions) return;
    
    const key = generateSolutionKey(combination, totalStats);
    existingSolutions.add(key);
  }

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
      // Vérifier si cette solution n'est pas un doublon
      if (!isSolutionDuplicate(pieces, currentStats)) {
        results.push(result);
        addSolutionToExisting(pieces, currentStats);
      }
    } else if (!bestInvalidCombination || currentScore < (bestInvalidCombination as BestCombination).score) {
      bestInvalidCombination = result;
    }
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

    // Fonction pour filtrer les 3ème stats en fonction des stats cibles
    function getValidThirdStats(pattern: typeof ARMOR_PATTERNS[0]): StatType[] {
      const validStats = pattern.possibleThirdStats.filter(stat => 
        stat !== pattern.mainStat && 
        stat !== pattern.subStat && 
        targetStats[stat] > 0
      );
      
      // Si aucune stat valide n'est trouvée, retourner toutes les stats possibles
      if (validStats.length === 0) {
        return pattern.possibleThirdStats.filter(stat => 
          stat !== pattern.mainStat && 
          stat !== pattern.subStat
        );
      }
      
      return validStats;
    }

    function generate(index: number) {
      if (index === numPieces) {
        const key = generateCombinationKey(current);
        if (!testedCombinations.has(key)) {
          testedCombinations.set(key, true);
          // Ajouter les armures fixes normales à la fin en conservant leurs valeurs personnalisées
          const fullCombination = [...current, ...fixedArmors.map(armor => ({
            ...armor,
            // S'assurer que les valeurs personnalisées sont conservées
            mainStatValue: armor.mainStatValue,
            subStatValue: armor.subStatValue,
            thirdStatValue: armor.thirdStatValue,
            isExotic: armor.isExotic
          }))];
          combinations.push(fullCombination);
        }
        return;
      }

      // Pour les armures normales, on utilise le pattern tel quel
      for (const pattern of patterns) {
        const validThirdStats = getValidThirdStats(pattern);
        for (const thirdStat of validThirdStats) {
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
      remainingMods: { small: modCounts.small - smallModsUsed, large: modCounts.large - largeModsUsed },
      score: currentScore,
      isTargetAchieved
    };

    if (isTargetAchieved) {
      // Vérifier si cette solution n'est pas un doublon
      if (!isSolutionDuplicate(pieces, currentStats)) {
        results.push(result);
        addSolutionToExisting(pieces, currentStats);
      }
    } else if (!bestInvalidCombination || currentScore < (bestInvalidCombination as BestCombination).score) {
      bestInvalidCombination = result;
    }
  }

  // Si on a des résultats valides, les retourner triés et limités à 50
  if (results.length > 0) {
    const sortedResults = results.sort((a, b) => {
      const aArchetypes = countUniqueArchetypes(a.combination);
      const bArchetypes = countUniqueArchetypes(b.combination);
      if (aArchetypes !== bArchetypes) {
        return aArchetypes - bArchetypes;
      }
      return a.score - b.score;
    });
    
    // Limiter à 50 résultats maximum
    return sortedResults.slice(0, 50);
  }

  // Sinon, retourner la meilleure combinaison invalide
  return bestInvalidCombination ? [bestInvalidCombination] : [];
}

function isTargetStatsAchieved(actual: ArmorStats, target: ArmorStats): boolean {
  return Object.keys(target).every(stat => actual[stat as StatType] >= target[stat as StatType]);
}

function calculateScore(actual: ArmorStats, target: ArmorStats): number {
  return Object.keys(target).reduce((total, stat) => {
    const diff = target[stat as StatType] - actual[stat as StatType];
    return total + Math.max(0, diff);
  }, 0);
}

function calculatePatternScore(pattern: typeof ARMOR_PATTERNS[0], targetStats: ArmorStats): number {
  const mainStatValue = targetStats[pattern.mainStat];
  const subStatValue = targetStats[pattern.subStat];
  return -(mainStatValue + subStatValue); // Plus négatif = meilleur pattern
} 