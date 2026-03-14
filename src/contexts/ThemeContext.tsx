'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { DEFAULT_TOKENS, STANDARD_PRESET, THEME_ZONES } from '@/config/themeDefaults';
import { themeService, ThemePresetDTO } from '@/services/themeService';
import { useAuth } from '@/contexts/AuthContext';
import type { ThemePreset } from '@/config/themeDefaults';

const LS_TOKENS_KEY = 'theme.active_tokens';
const LS_RECENT_COLORS_KEY = 'theme.recent_colors';

interface ThemeContextType {
  tokens: Record<string, string>;
  isInspectorOpen: boolean;
  toggleInspector: () => void;
  advancedMode: boolean;
  setAdvancedMode: (v: boolean) => void;
  setToken: (key: string, value: string) => void;
  resetToken: (key: string) => void;
  resetAll: () => void;
  activePresetId: string | null;
  presets: ThemePreset[];
  loadPreset: (id: string) => void;
  saveAsPreset: (name: string) => Promise<void>;
  deletePreset: (id: string) => Promise<void>;
  refreshPresets: () => Promise<void>;
  isSaving: boolean;
  isDirty: boolean;
  recentColors: string[];
  addRecentColor: (color: string) => void;
}

const ThemeContext = createContext<ThemeContextType | null>(null);

function applyTokensToDOM(tokens: Record<string, string>) {
  const root = document.documentElement;
  for (const [key, value] of Object.entries(tokens)) {
    root.style.setProperty(`--${key}`, value);
  }
}

function clearTokensFromDOM() {
  const root = document.documentElement;
  for (const key of Object.keys(DEFAULT_TOKENS)) {
    root.style.removeProperty(`--${key}`);
  }
}

function loadLSTokens(): Record<string, string> | null {
  try {
    const raw = localStorage.getItem(LS_TOKENS_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveLSTokens(tokens: Record<string, string>) {
  localStorage.setItem(LS_TOKENS_KEY, JSON.stringify(tokens));
}

function loadRecentColors(): string[] {
  try {
    const raw = localStorage.getItem(LS_RECENT_COLORS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  const [tokens, setTokens] = useState<Record<string, string>>({ ...DEFAULT_TOKENS });
  const [isInspectorOpen, setIsInspectorOpen] = useState(false);
  const [advancedMode, setAdvancedModeState] = useState(false);
  const [presets, setPresets] = useState<ThemePreset[]>([STANDARD_PRESET]);
  const [activePresetId, setActivePresetId] = useState<string | null>(STANDARD_PRESET.id);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSavedTokens, setLastSavedTokens] = useState<Record<string, string>>({ ...DEFAULT_TOKENS });
  const [recentColors, setRecentColors] = useState<string[]>([]);
  const backendSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isDirty = JSON.stringify(tokens) !== JSON.stringify(lastSavedTokens);

  // On mount: apply from localStorage first, then reconcile with backend
  useEffect(() => {
    const lsTokens = loadLSTokens();
    if (lsTokens) {
      const merged = { ...DEFAULT_TOKENS, ...lsTokens };
      setTokens(merged);
      applyTokensToDOM(merged);
      setLastSavedTokens(merged);
    }
    setRecentColors(loadRecentColors());
  }, []);

  // Check if any advanced token is non-default and auto-enable
  useEffect(() => {
    const advancedZones = THEME_ZONES.filter(z => z.isAdvanced);
    const hasCustomAdvanced = advancedZones.some(z => tokens[z.key] !== DEFAULT_TOKENS[z.key]);
    if (hasCustomAdvanced) {
      setAdvancedModeState(true);
    }
  }, [tokens]);

  // Fetch from backend when authenticated
  useEffect(() => {
    if (!isAuthenticated) return;
    (async () => {
      try {
        const backendTokens = await themeService.getTheme();
        if (backendTokens && Object.keys(backendTokens).length > 0) {
          const merged = { ...DEFAULT_TOKENS, ...backendTokens };
          setTokens(merged);
          applyTokensToDOM(merged);
          saveLSTokens(merged);
          setLastSavedTokens(merged);
          setActivePresetId(null);
        }
      } catch {
        // Silently use localStorage/defaults
      }
      try {
        const backendPresets = await themeService.getPresets();
        setPresets([STANDARD_PRESET, ...backendPresets.map(p => ({
          id: p.id,
          name: p.name,
          tokens: p.tokens,
        }))]);
      } catch {
        // Silently use default presets only
      }
    })();
  }, [isAuthenticated]);

  const debounceSaveToBackend = useCallback((newTokens: Record<string, string>) => {
    if (backendSaveTimer.current) clearTimeout(backendSaveTimer.current);
    backendSaveTimer.current = setTimeout(async () => {
      if (!isAuthenticated) return;
      setIsSaving(true);
      try {
        // Only save non-default tokens
        const diff: Record<string, string> = {};
        for (const [k, v] of Object.entries(newTokens)) {
          if (v !== DEFAULT_TOKENS[k]) diff[k] = v;
        }
        await themeService.saveTheme(diff);
        setLastSavedTokens(newTokens);
      } catch {
        // Silent
      } finally {
        setIsSaving(false);
      }
    }, 500);
  }, [isAuthenticated]);

  const setToken = useCallback((key: string, value: string) => {
    setTokens(prev => {
      const next = { ...prev, [key]: value };
      applyTokensToDOM({ [key]: value });
      saveLSTokens(next);
      debounceSaveToBackend(next);
      setActivePresetId(null);
      return next;
    });
  }, [debounceSaveToBackend]);

  const resetToken = useCallback((key: string) => {
    setToken(key, DEFAULT_TOKENS[key]);
  }, [setToken]);

  const resetAll = useCallback(async () => {
    const defaults = { ...DEFAULT_TOKENS };
    setTokens(defaults);
    clearTokensFromDOM();
    saveLSTokens(defaults);
    setActivePresetId(STANDARD_PRESET.id);
    setLastSavedTokens(defaults);
    if (isAuthenticated) {
      try {
        await themeService.resetTheme();
      } catch {
        // Silent
      }
    }
  }, [isAuthenticated]);

  const toggleInspector = useCallback(() => {
    setIsInspectorOpen(prev => !prev);
  }, []);

  const setAdvancedMode = useCallback((v: boolean) => {
    if (!v) {
      // Reset advanced tokens to defaults
      const advancedZones = THEME_ZONES.filter(z => z.isAdvanced);
      setTokens(prev => {
        const next = { ...prev };
        for (const zone of advancedZones) {
          next[zone.key] = DEFAULT_TOKENS[zone.key];
          applyTokensToDOM({ [zone.key]: DEFAULT_TOKENS[zone.key] });
        }
        saveLSTokens(next);
        debounceSaveToBackend(next);
        return next;
      });
    }
    setAdvancedModeState(v);
  }, [debounceSaveToBackend]);

  const loadPreset = useCallback((id: string) => {
    const preset = presets.find(p => p.id === id);
    if (!preset) return;
    const merged = { ...DEFAULT_TOKENS, ...preset.tokens };
    setTokens(merged);
    applyTokensToDOM(merged);
    saveLSTokens(merged);
    setActivePresetId(id);
    debounceSaveToBackend(merged);
  }, [presets, debounceSaveToBackend]);

  const saveAsPreset = useCallback(async (name: string) => {
    setIsSaving(true);
    try {
      // Only save non-default tokens
      const diff: Record<string, string> = {};
      for (const [k, v] of Object.entries(tokens)) {
        if (v !== DEFAULT_TOKENS[k]) diff[k] = v;
      }
      const created = await themeService.createPreset(name, diff);
      const newPreset: ThemePreset = { id: created.id, name: created.name, tokens: created.tokens };
      setPresets(prev => [prev[0], newPreset, ...prev.slice(1)]);
      setActivePresetId(created.id);
      setLastSavedTokens(tokens);
    } finally {
      setIsSaving(false);
    }
  }, [tokens]);

  const deletePreset = useCallback(async (id: string) => {
    await themeService.deletePreset(id);
    setPresets(prev => prev.filter(p => p.id !== id));
    if (activePresetId === id) setActivePresetId(null);
  }, [activePresetId]);

  const refreshPresets = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const backendPresets = await themeService.getPresets();
      setPresets([STANDARD_PRESET, ...backendPresets.map(p => ({
        id: p.id,
        name: p.name,
        tokens: p.tokens,
      }))]);
    } catch {
      // Silent
    }
  }, [isAuthenticated]);

  const addRecentColor = useCallback((color: string) => {
    const paletteSet = new Set([
      '#ffffff', '#000000', '#ff6b6b', '#ff5252', '#fcd7d7',
      '#aee8fe', '#59cffd', '#88cc19', '#a7f3d0', '#8ecc93',
      '#fef9c3', '#fde68a', '#fed7aa', '#fecdd3', '#c7d2fe',
      '#ddd6fe', '#d9f99d', '#bae6fd', '#f3f4f6', '#e5e7eb',
    ]);
    if (paletteSet.has(color)) return;
    setRecentColors(prev => {
      const filtered = prev.filter(c => c !== color);
      const updated = [color, ...filtered].slice(0, 8);
      localStorage.setItem(LS_RECENT_COLORS_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  return (
    <ThemeContext.Provider value={{
      tokens,
      isInspectorOpen,
      toggleInspector,
      advancedMode,
      setAdvancedMode,
      setToken,
      resetToken,
      resetAll,
      activePresetId,
      presets,
      loadPreset,
      saveAsPreset,
      deletePreset,
      refreshPresets,
      isSaving,
      isDirty,
      recentColors,
      addRecentColor,
    }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextType {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
