'use client';

import React, { useEffect, useRef } from 'react';
import { X, Loader2 } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import { useHotkeys } from '@/hooks/useHotkeys';
import { THEME_GROUPS, THEME_ZONES, DEFAULT_TOKENS } from '@/config/themeDefaults';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import ThemeColorPicker from './ThemeColorPicker';
import ThemePresetManager from './ThemePresetManager';

export default function ThemeInspectorPanel() {
  const {
    tokens, isInspectorOpen, toggleInspector,
    advancedMode, setAdvancedMode,
    setToken, resetToken, isSaving,
  } = useTheme();
  const panelRef = useRef<HTMLDivElement>(null);

  // Global hotkey: Ctrl+Shift+Alt+T
  useHotkeys([
    {
      key: 't',
      ctrl: true,
      shift: true,
      alt: true,
      handler: () => toggleInspector(),
      allowInInput: true,
    },
  ], [toggleInspector]);

  // Close on click outside
  useEffect(() => {
    if (!isInspectorOpen) return;
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        toggleInspector();
      }
    }
    // Delay to prevent the hotkey click from immediately closing
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClick);
    }, 100);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClick);
    };
  }, [isInspectorOpen, toggleInspector]);

  // Close on Escape
  useHotkeys([
    {
      key: 'Escape',
      handler: () => { if (isInspectorOpen) toggleInspector(); },
      allowInInput: true,
    },
  ], [isInspectorOpen, toggleInspector]);

  if (!isInspectorOpen) return null;

  const groupedZones = THEME_GROUPS.map(group => ({
    group,
    zones: THEME_ZONES.filter(z => z.group === group),
  }));

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-[1999]" style={{ backgroundColor: 'rgba(0,0,0,0.2)' }} />

      {/* Panel */}
      <div
        ref={panelRef}
        className="fixed right-0 top-0 h-screen w-[360px] z-[2000] flex flex-col"
        style={{
          borderLeft: '2px solid var(--theme-border-color)',
          backgroundColor: 'var(--theme-card-bg)',
          boxShadow: '-4px 4px 0px var(--theme-shadow-color)',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-4 py-3 shrink-0"
          style={{ borderBottom: '2px solid var(--theme-border-color)' }}
        >
          <div className="flex items-center gap-2">
            <h2 className="font-monument text-sm font-bold">Theme Inspector</h2>
            {isSaving && <Loader2 size={14} className="animate-spin" style={{ color: 'var(--theme-text-muted)' }} />}
          </div>
          <button
            onClick={toggleInspector}
            className="p-1 rounded hover:bg-gray-100 cursor-pointer"
            title="Stäng (Escape)"
          >
            <X size={18} />
          </button>
        </div>

        {/* Preset manager */}
        <div className="px-4 py-3 shrink-0" style={{ borderBottom: '1px solid var(--theme-divider)' }}>
          <ThemePresetManager />
        </div>

        {/* Advanced toggle */}
        <div
          className="flex items-center justify-between px-4 py-2.5 shrink-0"
          style={{ borderBottom: '1px solid var(--theme-divider)' }}
        >
          <span className="text-xs font-semibold" style={{ color: 'var(--theme-text-secondary)' }}>
            Borders & Shadows
          </span>
          <Switch
            checked={advancedMode}
            onCheckedChange={setAdvancedMode}
          />
        </div>

        {/* Zone list */}
        <ScrollArea className="flex-1">
          <div className="px-4 py-2 space-y-1">
            {groupedZones.map(({ group, zones }) => {
              const isAdvancedGroup = group === 'Border & Shadow';
              const isLocked = isAdvancedGroup && !advancedMode;

              return (
                <details key={group} open={!isAdvancedGroup} className="group/details">
                  <summary
                    className="flex items-center gap-2 py-2 cursor-pointer select-none text-xs font-bold uppercase tracking-wide"
                    style={{ color: 'var(--theme-text-secondary)' }}
                  >
                    <span className="transition-transform group-open/details:rotate-90">&#9654;</span>
                    {group}
                    {isLocked && <span className="text-2xs font-normal">(låst)</span>}
                  </summary>
                  <div className={`space-y-2 pb-3 pl-2 ${isLocked ? 'opacity-40 pointer-events-none' : ''}`}>
                    {zones.map(zone => (
                      <div key={zone.key}>
                        <div className="text-2xs mb-0.5 font-medium" style={{ color: 'var(--theme-text-primary)' }}>
                          {zone.label}
                        </div>
                        <ThemeColorPicker
                          tokenKey={zone.key}
                          value={tokens[zone.key] ?? DEFAULT_TOKENS[zone.key]}
                          defaultValue={DEFAULT_TOKENS[zone.key]}
                          onChange={(v) => setToken(zone.key, v)}
                          onReset={() => resetToken(zone.key)}
                        />
                      </div>
                    ))}
                  </div>
                </details>
              );
            })}
          </div>
        </ScrollArea>

        {/* Footer */}
        <div
          className="px-4 py-2 text-2xs shrink-0"
          style={{
            borderTop: '1px solid var(--theme-divider)',
            color: 'var(--theme-text-muted)',
          }}
        >
          Ctrl+Shift+Alt+T för att öppna/stänga
        </div>
      </div>
    </>
  );
}
