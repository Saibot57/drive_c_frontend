'use client';

import React, { useState } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { ChevronDown, Save, Trash2 } from 'lucide-react';

export default function ThemePresetManager() {
  const {
    presets, activePresetId, loadPreset, saveAsPreset, deletePreset,
    resetAll, isDirty, isSaving,
  } = useTheme();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [newPresetName, setNewPresetName] = useState('');

  const activePreset = presets.find(p => p.id === activePresetId);

  const handleSave = async () => {
    const name = newPresetName.trim();
    if (!name) return;
    await saveAsPreset(name);
    setNewPresetName('');
    setSaveDialogOpen(false);
  };

  return (
    <div className="space-y-2">
      {/* Preset dropdown */}
      <div className="relative">
        <button
          onClick={() => setDropdownOpen(!dropdownOpen)}
          className="w-full flex items-center justify-between px-3 py-2 text-sm border-2 rounded-lg cursor-pointer"
          style={{
            borderColor: 'var(--theme-border-color)',
            backgroundColor: 'var(--theme-input-bg)',
          }}
        >
          <span className="flex items-center gap-2">
            {activePreset?.name ?? 'Anpassat'}
            {isDirty && activePresetId && (
              <span className="w-2 h-2 rounded-full bg-orange-400" title="Osparade ändringar" />
            )}
          </span>
          <ChevronDown size={14} />
        </button>

        {dropdownOpen && (
          <div
            className="absolute left-0 right-0 top-full mt-1 z-50 border-2 rounded-lg overflow-hidden"
            style={{
              borderColor: 'var(--theme-border-color)',
              backgroundColor: 'var(--theme-card-bg)',
              boxShadow: '3px 3px 0px var(--theme-shadow-color)',
            }}
          >
            {presets.map(p => (
              <button
                key={p.id}
                onClick={() => { loadPreset(p.id); setDropdownOpen(false); }}
                className="w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-gray-50 cursor-pointer"
                style={{ color: 'var(--theme-text-primary)' }}
              >
                <span>{p.name}</span>
                <div className="flex items-center gap-1">
                  {p.id === activePresetId && (
                    <span className="text-2xs px-1.5 py-0.5 rounded" style={{ backgroundColor: 'var(--theme-accent-soft)' }}>aktiv</span>
                  )}
                  {!p.isDefault && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deletePreset(p.id);
                      }}
                      className="p-1 rounded hover:bg-red-50 cursor-pointer"
                      title="Radera preset"
                    >
                      <Trash2 size={12} className="text-red-500" />
                    </button>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex gap-2">
        <button
          onClick={() => setSaveDialogOpen(true)}
          disabled={isSaving}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs border-2 rounded-lg cursor-pointer hover:-translate-y-0.5 transition-transform disabled:opacity-50"
          style={{
            borderColor: 'var(--theme-border-color)',
            backgroundColor: 'var(--theme-accent-button)',
          }}
        >
          <Save size={12} />
          Spara som...
        </button>
        <button
          onClick={resetAll}
          className="flex-1 px-3 py-1.5 text-xs border-2 rounded-lg cursor-pointer hover:-translate-y-0.5 transition-transform"
          style={{
            borderColor: 'var(--theme-border-color)',
            backgroundColor: 'var(--theme-card-bg)',
          }}
        >
          Återställ allt
        </button>
      </div>

      {/* Save dialog */}
      {saveDialogOpen && (
        <div className="fixed inset-0 z-[2100] flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}>
          <div
            className="w-80 p-4 rounded-xl border-2"
            style={{
              borderColor: 'var(--theme-border-color)',
              backgroundColor: 'var(--theme-card-bg)',
              boxShadow: '4px 4px 0px var(--theme-shadow-color)',
            }}
          >
            <h3 className="font-bold text-sm mb-3">Spara som preset</h3>
            <input
              type="text"
              value={newPresetName}
              onChange={e => setNewPresetName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleSave(); }}
              placeholder="Namn på preset..."
              className="w-full px-3 py-2 text-sm border-2 rounded-lg mb-3"
              style={{
                borderColor: 'var(--theme-border-color)',
                backgroundColor: 'var(--theme-input-bg)',
              }}
              autoFocus
            />
            <div className="flex gap-2">
              <button
                onClick={handleSave}
                disabled={!newPresetName.trim() || isSaving}
                className="flex-1 px-3 py-1.5 text-sm font-semibold border-2 rounded-lg cursor-pointer disabled:opacity-50"
                style={{
                  borderColor: 'var(--theme-border-color)',
                  backgroundColor: 'var(--theme-accent-primary)',
                  color: 'var(--theme-text-on-accent)',
                }}
              >
                {isSaving ? 'Sparar...' : 'Spara'}
              </button>
              <button
                onClick={() => { setSaveDialogOpen(false); setNewPresetName(''); }}
                className="flex-1 px-3 py-1.5 text-sm border-2 rounded-lg cursor-pointer"
                style={{
                  borderColor: 'var(--theme-border-color)',
                  backgroundColor: 'var(--theme-card-bg)',
                }}
              >
                Avbryt
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
