'use client';

import React, { useState, useEffect } from 'react';
import { PinnedCombination, MOD_VALUES, TIER_STAT_VALUES } from '../types/armor';
import { 
  getPinnedCombinations, 
  removePinnedCombination, 
  updatePinnedCombinationName,
  exportPinnedCombinations,
  importPinnedCombinations
} from '../utils/pinnedCombinations';

export default function PinnedCombinations() {
  const [pinnedCombinations, setPinnedCombinations] = useState<PinnedCombination[]>([]);
  const [expandedCombinations, setExpandedCombinations] = useState<Set<string>>(new Set());
  const [editingName, setEditingName] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [showImportModal, setShowImportModal] = useState(false);
  const [importJson, setImportJson] = useState('');
  const [importMessage, setImportMessage] = useState('');

  const PATTERN_COLORS: Record<string, string> = {
    Grenadier: '#fbbf24',   // jaune doré
    Brawler: '#f87171',     // rouge doux
    Gunner: '#60a5fa',      // bleu doux
    Specialist: '#a78bfa',  // violet doux
    Paragon: '#34d399',     // vert menthe
    Bulwark: '#f472b6',     // rose doux
  };

  useEffect(() => {
    setPinnedCombinations(getPinnedCombinations());
  }, []);

  const toggleExpanded = (id: string) => {
    const newExpanded = new Set(expandedCombinations);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedCombinations(newExpanded);
  };

  const handleRemove = (id: string) => {
    removePinnedCombination(id);
    setPinnedCombinations(getPinnedCombinations());
  };

  const startEditingName = (id: string, currentName: string) => {
    setEditingName(id);
    setNewName(currentName);
  };

  const saveName = () => {
    if (editingName && newName.trim()) {
      updatePinnedCombinationName(editingName, newName.trim());
      setPinnedCombinations(getPinnedCombinations());
      setEditingName(null);
      setNewName('');
    }
  };

  const cancelEditing = () => {
    setEditingName(null);
    setNewName('');
  };

  const handleExport = () => {
    const json = exportPinnedCombinations();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'pinned-combinations.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImport = () => {
    const result = importPinnedCombinations(importJson);
    setImportMessage(result.message);
    
    if (result.success) {
      setPinnedCombinations(getPinnedCombinations());
      setImportJson('');
      setTimeout(() => setShowImportModal(false), 2000);
    }
  };

  if (pinnedCombinations.length === 0) {
    return (
      <div className="space-y-6">
        <div className="text-center py-12">
          <div className="text-gray-400 text-lg mb-4">
            No pinned combinations
          </div>
          <div className="text-gray-500 text-sm mb-6">
            Pin combinations from results to see them here
          </div>
          <div className="flex justify-center gap-2">
            <button
              onClick={() => setShowImportModal(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded transition-colors"
            >
              Import JSON
            </button>
          </div>
        </div>

        {/* Modal d'import */}
        {showImportModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-gray-800 p-6 rounded-lg max-w-2xl w-full mx-4">
              <h3 className="text-xl font-bold text-white mb-4">Import Combinations</h3>
              <textarea
                value={importJson}
                onChange={(e) => setImportJson(e.target.value)}
                placeholder="Paste your JSON here..."
                className="w-full h-64 bg-gray-700 text-white p-4 rounded resize-none"
              />
              {importMessage && (
                <div className={`mt-2 p-2 rounded ${
                  importMessage.includes('successfully') 
                    ? 'bg-green-900 text-green-200' 
                    : 'bg-red-900 text-red-200'
                }`}>
                  {importMessage}
                </div>
              )}
              <div className="flex justify-end gap-2 mt-4">
                <button
                  onClick={() => {
                    setShowImportModal(false);
                    setImportJson('');
                    setImportMessage('');
                  }}
                  className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded"
                >
                  Cancel
                </button>
                <button
                  onClick={handleImport}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded"
                >
                  Import
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header avec actions */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-white">
          Pinned Combinations ({pinnedCombinations.length})
        </h2>
        <div className="flex gap-2">
          <button
            onClick={handleExport}
            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded transition-colors"
          >
            Export JSON
          </button>
          <button
            onClick={() => setShowImportModal(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded transition-colors"
          >
            Import JSON
          </button>
        </div>
      </div>

      {/* Liste des combinaisons */}
      <div className="space-y-4">
        {pinnedCombinations.map((combo) => {
          return (
            <div key={combo.id} className="bg-gray-800 rounded-lg p-4">
              {/* Header de la combinaison */}
              <div className="flex justify-between items-center mb-4">
                <div className="flex items-center gap-4">
                  {editingName === combo.id ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        className="bg-gray-700 text-white px-2 py-1 rounded"
                        onKeyPress={(e) => e.key === 'Enter' && saveName()}
                        autoFocus
                      />
                      <button
                        onClick={saveName}
                        className="text-green-400 hover:text-green-300"
                      >
                        ✓
                      </button>
                      <button
                        onClick={cancelEditing}
                        className="text-red-400 hover:text-red-300"
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-semibold text-white">
                        {combo.name}
                      </h3>
                      <button
                        onClick={() => startEditingName(combo.id, combo.name)}
                        className="text-gray-400 hover:text-white"
                      >
                        ✏️
                      </button>
                    </div>
                  )}
                  <span className="text-sm text-gray-400">
                    {combo.isCustomTier || (combo.combination[0]?.tier && !TIER_STAT_VALUES[combo.combination[0].tier]) ? (
                      <span className="text-lg font-semibold text-blue-400">
                        Custom ({combo.customTierValues?.main || combo.combination[0].mainStatValue}-{combo.customTierValues?.sub || combo.combination[0].subStatValue}-{combo.customTierValues?.third || combo.combination[0].thirdStatValue})
                      </span>
                    ) : (
                      <span className="text-lg font-semibold text-white">
                        Tier {combo.combination[0]?.tier || 5} ({TIER_STAT_VALUES[combo.combination[0]?.tier || 5]?.main || TIER_STAT_VALUES[5].main}-{TIER_STAT_VALUES[combo.combination[0]?.tier || 5]?.sub || TIER_STAT_VALUES[5].sub}-{TIER_STAT_VALUES[combo.combination[0]?.tier || 5]?.third || TIER_STAT_VALUES[5].third})
                      </span>
                    )} - {combo.archetypeCount} archetype(s)
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => toggleExpanded(combo.id)}
                    className="bg-gray-600 hover:bg-gray-700 text-white px-3 py-1 rounded text-sm transition-colors"
                  >
                    {expandedCombinations.has(combo.id) ? 'Hide Details' : 'Show Details'}
                  </button>
                  <button
                    onClick={() => handleRemove(combo.id)}
                    className="text-red-400 hover:text-red-300"
                  >
                    🗑️
                  </button>
                </div>
              </div>

              {/* Stats de base */}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-4">
                {Object.entries(combo.totalStats).map(([stat, value]) => (
                  <div key={stat} className="text-center">
                    <div className="text-sm text-gray-400 capitalize">{stat}</div>
                    <div className="text-lg font-semibold text-white">{value}</div>
                  </div>
                ))}
              </div>

              {/* Détails de la combinaison (si étendue) */}
              {expandedCombinations.has(combo.id) && (
                <div className="border-t border-gray-700 pt-4">
                  <h4 className="text-lg font-semibold text-white mb-4">Combination Details</h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-700">
                          <th className="text-left py-2 text-gray-300">Piece</th>
                          <th className="text-left py-2 text-gray-300">Pattern</th>
                          <th className="text-left py-2 text-gray-300">3rd Stat</th>
                          <th className="text-left py-2 text-gray-300">Mods</th>
                        </tr>
                      </thead>
                      <tbody>
                        {combo.combination.map((piece, index) => (
                          <tr key={index} className="border-b border-gray-800">
                            <td className="py-2 text-gray-300">
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
                            </td>
                            <td className="py-2 text-gray-300">
                              <div>
                                <div>
                                  <span style={{ color: PATTERN_COLORS[piece.pattern.name] || undefined }}>
                                    {piece.pattern.name}
                                  </span>
                                </div>
                                <div className="text-xs text-gray-500">
                                  {piece.pattern.mainStat.slice(0, 3)}({piece.mainStatValue}) {piece.pattern.subStat.slice(0, 3)}({piece.subStatValue})
                                </div>
                              </div>
                            </td>
                            <td className="py-2 text-gray-300">
                              {piece.thirdStat} ({piece.thirdStatValue})
                            </td>
                            <td className="py-2 text-gray-300">
                              {piece.smallMods.length > 0 && (
                                <span className="text-purple-400 mr-2">
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
    </div>
  );
} 