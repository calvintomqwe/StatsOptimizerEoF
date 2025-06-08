import { ArmorPiece, ArmorStats, StatType, TIER_STAT_VALUES, MOD_VALUES } from '../types/armor';
import { ARMOR_PATTERNS } from '../data/patterns';

export function calculatePieceStats(piece: ArmorPiece): ArmorStats {
  const stats: ArmorStats = {
    weapon: 5,
    health: 5,
    class: 5,
    grenade: 5,
    melee: 5,
    super: 5
  };

  // Si c'est une armure avec des valeurs personnalisées
  if (piece.pattern.mainStatValue && piece.pattern.subStatValue && piece.pattern.thirdStatValue) {
    // Appliquer les valeurs spécifiées
    stats[piece.pattern.mainStat] = parseInt(piece.pattern.mainStatValue);
    stats[piece.pattern.subStat] = parseInt(piece.pattern.subStatValue);
    stats[piece.thirdStat] = parseInt(piece.pattern.thirdStatValue);
  } else {
    // Sinon, utiliser les valeurs du tier
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
    const pieceStats = calculatePieceStats(piece);
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

export function findBestCombination(
  targetStats: Record<StatType, number>,
  tier: number,
  modCounts: { small: number; large: number },
  fixedArmors: ArmorPiece[] = []
): BestCombination[] {
  const allStats: StatType[] = ['weapon', 'health', 'class', 'grenade', 'melee', 'super'];
  const results: BestCombination[] = [];
  let bestScore = Infinity;

  // Fonction pour obtenir les valeurs de stats en fonction du tier
  const getTierValues = (tier: number) => {
    if (tier === 6) {
      // Tier personnalisé
      return {
        main: 30,
        sub: 25,
        third: 20
      };
    }
    return TIER_STAT_VALUES[tier];
  };

  // Fonction pour calculer les stats d'une pièce
  const calculatePieceStats = (piece: ArmorPiece): Record<StatType, number> => {
    const stats: Record<StatType, number> = {
      weapon: 5,
      health: 5,
      class: 5,
      grenade: 5,
      melee: 5,
      super: 5
    };

    // Si c'est une armure fixe avec des valeurs personnalisées
    if (piece.pattern.mainStatValue && piece.pattern.subStatValue && piece.pattern.thirdStatValue) {
      stats[piece.pattern.mainStat] = parseInt(piece.pattern.mainStatValue);
      stats[piece.pattern.subStat] = parseInt(piece.pattern.subStatValue);
      stats[piece.thirdStat] = parseInt(piece.pattern.thirdStatValue);
    } else {
      // Sinon utiliser les valeurs du tier
      const tierValues = getTierValues(piece.tier);
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
  };

  // Si on a déjà 5 armures fixes, on ne génère pas de nouvelles armures
  if (fixedArmors.length === 5) {
    const pieces = [...fixedArmors];
    let currentStats = calculateTotalStats(pieces);
    let currentScore = calculateScore(currentStats, targetStats);
    const currentMods = new Set<string>();

    // Appliquer les mods sur les armures fixes
    while (currentMods.size < modCounts.small + modCounts.large) {
      let bestModImprovement = -Infinity;
      let bestModPiece = -1;
      let bestModType: 'small' | 'large' | null = null;
      let bestModStat: StatType | null = null;

      for (let i = 0; i < pieces.length; i++) {
        const piece = pieces[i];
        if (piece.smallMods.length === 0 && piece.largeMods.length === 0) {
          if (currentMods.size < modCounts.small) {
            for (const stat of allStats) {
              const tempPiece: ArmorPiece = {
                ...piece,
                smallMods: [stat],
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
                bestModStat = stat;
              }
            }
          }
          if (currentMods.size < modCounts.large) {
            for (const stat of allStats) {
              const tempPiece: ArmorPiece = {
                ...piece,
                smallMods: [],
                largeMods: [stat]
              };
              const tempPieces = [...pieces];
              tempPieces[i] = tempPiece;
              const tempStats = calculateTotalStats(tempPieces);
              const improvement = calculateScore(currentStats, targetStats) - calculateScore(tempStats, targetStats);
              if (improvement > bestModImprovement) {
                bestModImprovement = improvement;
                bestModPiece = i;
                bestModType = 'large';
                bestModStat = stat;
              }
            }
          }
        }
      }

      if (bestModImprovement <= 0) break;

      if (bestModType === 'small' && bestModStat) {
        pieces[bestModPiece] = {
          ...pieces[bestModPiece],
          smallMods: [bestModStat],
          largeMods: []
        };
        currentMods.add(bestModStat);
      } else if (bestModType === 'large' && bestModStat) {
        pieces[bestModPiece] = {
          ...pieces[bestModPiece],
          smallMods: [],
          largeMods: [bestModStat]
        };
        currentMods.add(bestModStat);
      }

      currentStats = calculateTotalStats(pieces);
      currentScore = calculateScore(currentStats, targetStats);
    }

    const isTargetAchieved = isTargetStatsAchieved(currentStats, targetStats);
    return [{
      combination: pieces,
      remainingMods: { small: modCounts.small - currentMods.size, large: modCounts.large - currentMods.size },
      score: currentScore,
      isTargetAchieved
    }];
  }

  // Pour chaque armure fixe avec des valeurs mais sans types, on va essayer différentes combinaisons de types
  const fixedArmorsWithTypes: ArmorPiece[] = [];
  for (const fixedArmor of fixedArmors) {
    if (fixedArmor.pattern.mainStat === 'weapon' && fixedArmor.pattern.subStat === 'health') {
      // C'est une armure avec des valeurs mais sans types spécifiés
      const mainValue = parseInt(fixedArmor.pattern.mainStatValue || '0');
      const subValue = parseInt(fixedArmor.pattern.subStatValue || '0');
      const thirdValue = parseInt(fixedArmor.pattern.thirdStatValue || '0');

      // Essayer toutes les combinaisons possibles de types pour ces valeurs
      let bestPiece: ArmorPiece | null = null;
      let bestPieceScore = Infinity;

      // Utiliser uniquement les patterns existants
      for (const pattern of ARMOR_PATTERNS) {
        const tempPiece: ArmorPiece = {
          pattern: {
            name: pattern.name,
            mainStat: pattern.mainStat,
            subStat: pattern.subStat,
            possibleThirdStats: pattern.possibleThirdStats,
            mainStatValue: mainValue.toString(),
            subStatValue: subValue.toString(),
            thirdStatValue: thirdValue.toString()
          },
          tier: fixedArmor.tier,
          thirdStat: pattern.possibleThirdStats[0],
          smallMods: [],
          largeMods: []
        };

        const tempStats = calculateTotalStats([tempPiece]);
        const score = calculateScore(tempStats, targetStats);
        if (score < bestPieceScore) {
          bestPieceScore = score;
          bestPiece = tempPiece;
        }
      }

      if (bestPiece) {
        fixedArmorsWithTypes.push(bestPiece);
      }
    } else {
      // C'est une armure avec des types spécifiés, on la garde telle quelle
      fixedArmorsWithTypes.push(fixedArmor);
    }
  }

  // Sort patterns by how well they match the target stats
  const sortedPatterns = [...ARMOR_PATTERNS].sort((a, b) => {
    const aScore = calculatePatternScore(a, targetStats);
    const bScore = calculatePatternScore(b, targetStats);
    return aScore - bScore;
  });

  // Set pour suivre les groupes de patterns déjà trouvés
  const foundPatternGroups = new Set<string>();

  // Try with increasing number of unique patterns
  const numPiecesNeeded = 5 - fixedArmorsWithTypes.length;
  for (let numPatterns = 1; numPatterns <= numPiecesNeeded; numPatterns++) {
    const patterns = sortedPatterns.slice(0, numPatterns);
    const combinations = generateCombinationsWithDuplicates(patterns, numPiecesNeeded);

    const startTime = Date.now();
    const TIME_LIMIT = 5000;

    for (const combination of combinations) {
      if (Date.now() - startTime > TIME_LIMIT) {
        console.log('Time limit reached for current pattern count');
        break;
      }

      // Générer la clé du groupe de patterns (ordre ignoré)
      const patternGroupKey = combination.map(p => p.name).sort().join(',');
      if (foundPatternGroups.has(patternGroupKey)) {
        continue; // On a déjà trouvé une solution pour ce groupe
      }

      const thirdStatsCombinations = generateThirdStatsCombinations(allStats, combination, targetStats);
      let foundForThisGroup = false;
      for (const thirdStats of thirdStatsCombinations) {
        if (foundForThisGroup) break;
        const pieces: ArmorPiece[] = combination.map((pattern, index) => ({
          pattern,
          tier,
          thirdStat: thirdStats[index],
          smallMods: [] as StatType[],
          largeMods: [] as StatType[]
        }));

        // Ajouter les armures fixes avec leurs types optimisés
        pieces.push(...fixedArmorsWithTypes);

        let currentStats = calculateTotalStats(pieces);
        let currentScore = calculateScore(currentStats, targetStats);
        const currentMods = new Set<string>();

        // Si on a des armures fixes, on essaie d'abord d'appliquer un mod sur chacune
        if (fixedArmorsWithTypes.length > 0 && (currentMods.size < modCounts.small + modCounts.large)) {
          for (let i = pieces.length - fixedArmorsWithTypes.length; i < pieces.length; i++) {
            let bestFixedModImprovement = -Infinity;
            let bestFixedModType: 'small' | 'large' | null = null;
            let bestFixedModStat: StatType | null = null;

            // Essayer d'abord un grand mod
            if (currentMods.size < modCounts.large) {
              for (const stat of allStats) {
                const tempPiece: ArmorPiece = {
                  ...pieces[i],
                  smallMods: [],
                  largeMods: [stat]
                };
                const tempPieces = [...pieces];
                tempPieces[i] = tempPiece;
                const tempStats = calculateTotalStats(tempPieces);
                const improvement = calculateScore(currentStats, targetStats) - calculateScore(tempStats, targetStats);
                if (improvement > bestFixedModImprovement) {
                  bestFixedModImprovement = improvement;
                  bestFixedModType = 'large';
                  bestFixedModStat = stat;
                }
              }
            }

            // Si pas de grand mod ou si le petit mod est meilleur
            if (currentMods.size < modCounts.small) {
              for (const stat of allStats) {
                const tempPiece: ArmorPiece = {
                  ...pieces[i],
                  smallMods: [stat],
                  largeMods: []
                };
                const tempPieces = [...pieces];
                tempPieces[i] = tempPiece;
                const tempStats = calculateTotalStats(tempPieces);
                const improvement = calculateScore(currentStats, targetStats) - calculateScore(tempStats, targetStats);
                if (improvement > bestFixedModImprovement) {
                  bestFixedModImprovement = improvement;
                  bestFixedModType = 'small';
                  bestFixedModStat = stat;
                }
              }
            }

            // Appliquer le meilleur mod à l'armure fixe
            if (bestFixedModType && bestFixedModStat) {
              pieces[i] = {
                ...pieces[i],
                smallMods: bestFixedModType === 'small' ? [bestFixedModStat] : [],
                largeMods: bestFixedModType === 'large' ? [bestFixedModStat] : []
              };
              if (bestFixedModType === 'small') {
                currentMods.add(bestFixedModStat);
              } else {
                currentMods.add(bestFixedModStat);
              }
              currentStats = calculateTotalStats(pieces);
              currentScore = calculateScore(currentStats, targetStats);
            }
          }
        }

        // Try to improve stats by adding mods one by one to the other pieces
        while (currentMods.size < modCounts.small + modCounts.large) {
          let bestModImprovement = -Infinity;
          let bestModPiece = -1;
          let bestModType: 'small' | 'large' | null = null;
          let bestModStat: StatType | null = null;

          for (let i = 0; i < pieces.length - fixedArmorsWithTypes.length; i++) {
            const piece = pieces[i];
            if (piece.smallMods.length === 0 && piece.largeMods.length === 0) {
              if (currentMods.size < modCounts.small) {
                for (const stat of allStats) {
                  const tempPiece: ArmorPiece = {
                    ...piece,
                    smallMods: [stat],
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
                    bestModStat = stat;
                  }
                }
              }
              if (currentMods.size < modCounts.large) {
                for (const stat of allStats) {
                  const tempPiece: ArmorPiece = {
                    ...piece,
                    smallMods: [],
                    largeMods: [stat]
                  };
                  const tempPieces = [...pieces];
                  tempPieces[i] = tempPiece;
                  const tempStats = calculateTotalStats(tempPieces);
                  const improvement = calculateScore(currentStats, targetStats) - calculateScore(tempStats, targetStats);
                  if (improvement > bestModImprovement) {
                    bestModImprovement = improvement;
                    bestModPiece = i;
                    bestModType = 'large';
                    bestModStat = stat;
                  }
                }
              }
            }
          }

          if (bestModImprovement <= 0) break;

          if (bestModType === 'small' && bestModStat) {
            pieces[bestModPiece] = {
              ...pieces[bestModPiece],
              smallMods: [bestModStat],
              largeMods: []
            };
            if (bestModType === 'small') {
              currentMods.add(bestModStat);
            } else {
              currentMods.add(bestModStat);
            }
          } else if (bestModType === 'large' && bestModStat) {
            pieces[bestModPiece] = {
              ...pieces[bestModPiece],
              smallMods: [],
              largeMods: [bestModStat]
            };
            if (bestModType === 'large') {
              currentMods.add(bestModStat);
            } else {
              currentMods.add(bestModStat);
            }
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
          foundPatternGroups.add(patternGroupKey);
          foundForThisGroup = true;
          break; // On arrête pour ce groupe dès qu'on trouve une solution
        } else if (currentScore < bestScore) {
          bestScore = currentScore;
          results[0] = result;
        }
      }
    }

    // Si on a trouvé des résultats qui atteignent les stats cibles, on arrête la recherche
    if (results.some(r => r.isTargetAchieved)) {
      break;
    }
  }

  // Retourner uniquement les résultats uniques par combinaison de patterns (ordre ignoré)
  const uniqueResultsMap = new Map<string, BestCombination>();
  for (const result of results) {
    const patternNames = result.combination.map(piece => piece.pattern.name).sort();
    const key = patternNames.join(',');
    if (!uniqueResultsMap.has(key)) {
      uniqueResultsMap.set(key, result);
    }
  }
  const uniqueResults = Array.from(uniqueResultsMap.values());

  // Trier par nombre de patterns différents utilisés (ordre ascendant), puis par score
  return uniqueResults.sort((a, b) => {
    const aUnique = new Set(a.combination.map(p => p.pattern.name)).size;
    const bUnique = new Set(b.combination.map(p => p.pattern.name)).size;
    if (aUnique !== bUnique) return aUnique - bUnique;
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

function generateCombinationsWithDuplicates<T>(items: T[], length: number): T[][] {
  if (length === 0) return [[]];
  if (items.length === 0) return [];

  const combinations: T[][] = [];
  const current: T[] = [];

  function generate(index: number) {
    if (index === length) {
      combinations.push([...current]);
      return;
    }

    for (const item of items) {
      current.push(item);
      generate(index + 1);
      current.pop();
    }
  }

  generate(0);
  return combinations;
}

function generateThirdStatsCombinations(allStats: StatType[], patterns: typeof ARMOR_PATTERNS, targetStats: ArmorStats): StatType[][] {
  const combinations: StatType[][] = [];
  const current: StatType[] = [];

  // Trier les stats par ordre décroissant de leur valeur cible
  const sortedStats = [...allStats].sort((a, b) => targetStats[b] - targetStats[a]);

  function generate(index: number) {
    if (index === patterns.length) {
      combinations.push([...current]);
      return;
    }

    const pattern = patterns[index];
    // Filtrer les stats disponibles en excluant mainStat et subStat
    const availableStats = sortedStats.filter(stat => 
      stat !== pattern.mainStat && stat !== pattern.subStat
    );

    // Si la stat cible est à 0, on essaie d'abord les stats non nulles
    const nonZeroStats = availableStats.filter(stat => targetStats[stat] > 0);
    const zeroStats = availableStats.filter(stat => targetStats[stat] === 0);

    // Essayer d'abord les stats non nulles
    for (const stat of nonZeroStats) {
      current.push(stat);
      generate(index + 1);
      current.pop();
    }

    // Si on n'a pas assez de stats non nulles, utiliser les stats nulles
    if (nonZeroStats.length < patterns.length - index) {
      for (const stat of zeroStats) {
        current.push(stat);
        generate(index + 1);
        current.pop();
      }
    }
  }

  generate(0);
  return combinations;
} 