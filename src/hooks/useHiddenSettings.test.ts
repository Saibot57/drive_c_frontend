// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import {
  EXPORT_EXCLUDE_KEY,
  PASTE_PROTECT_KEY,
  SELECTION_DEFAULTS_KEY,
  TEACHERS_KEY,
} from '@/config/plannerConstants';
import { useHiddenSettings } from '@/hooks/useHiddenSettings';
import { pickHiddenSettings } from '@/utils/plannerBackup';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/** En minimal renderHook. Repot har inget testbibliotek för React. */
const renderHook = () => {
  const result: { current: ReturnType<typeof useHiddenSettings> | null } = { current: null };
  const Probe = () => {
    result.current = useHiddenSettings();
    return null;
  };
  const root = createRoot(document.createElement('div'));
  act(() => { root.render(React.createElement(Probe)); });
  return { result, unmount: () => act(() => root.unmount()) };
};

const stored = (key: string) => JSON.parse(window.localStorage.getItem(key) ?? 'null');

afterEach(() => {
  window.localStorage.clear();
});

describe('applyImportedSettings', () => {
  // Arkitektur F10: de här tre försvann förut vid en återställning från JSON.
  it('sparar urvalets förval, inklistringsskyddet och exportens undantag', () => {
    const { result, unmount } = renderHook();
    const backup = {
      courses: [],
      schedule: [],
      selectionDefaults: ['Mentorstid'],
      pasteProtect: ['Lunch'],
      exportExcludes: ['ATP*'],
    };

    act(() => result.current!.applyImportedSettings(pickHiddenSettings(backup)));

    expect(result.current!.selectionDefaults).toEqual(['Mentorstid']);
    expect(result.current!.pasteProtect).toEqual(['Lunch']);
    expect(result.current!.exportExcludes).toEqual(['ATP*']);
    expect(stored(SELECTION_DEFAULTS_KEY)).toEqual(['Mentorstid']);
    expect(stored(PASTE_PROTECT_KEY)).toEqual(['Lunch']);
    expect(stored(EXPORT_EXCLUDE_KEY)).toEqual(['ATP*']);
    unmount();
  });

  it('lämnar det som saknas i en äldre backup orört', () => {
    window.localStorage.setItem(PASTE_PROTECT_KEY, JSON.stringify(['Rast']));
    const { result, unmount } = renderHook();

    act(() => result.current!.applyImportedSettings(pickHiddenSettings({ teachers: ['Anna'] })));

    expect(stored(TEACHERS_KEY)).toEqual(['Anna']);
    expect(stored(PASTE_PROTECT_KEY)).toEqual(['Rast']);
    expect(result.current!.pasteProtect).toEqual(['Rast']);
    unmount();
  });
});
