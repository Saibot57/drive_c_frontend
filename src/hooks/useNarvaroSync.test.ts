// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/** En server i minnet med samma regler som /api/narvaro: version 0 skapar, gammal version ger 409. */
const server = new Map<string, { version: number; payload: string }>();
vi.mock('@/services/narvaroService', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/services/narvaroService')>();
  const doc = (key: string) => ({ key, ...server.get(key)!, updatedAt: null });
  return {
    ...original,
    narvaroService: {
      list: async () => Array.from(server.keys()).sort().map(doc),
      put: async (key: string, payload: string, version: number) => {
        const cur = server.get(key);
        if ((version === 0 && cur) || (version !== 0 && cur?.version !== version)) {
          throw new original.NarvaroConflictError(key, cur?.version ?? null);
        }
        server.set(key, { version: (cur?.version ?? 0) + 1, payload });
        return doc(key);
      },
      deleteAll: async () => { server.clear(); },
    },
  };
});

// Få varv, så att testerna går fort.
vi.mock('@/utils/narvaroCrypto', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/utils/narvaroCrypto')>();
  return { ...original, createKeyInfo: (p: string) => original.createKeyInfo(p, 1000) };
});

import { useNarvaroSync } from '@/hooks/useNarvaroSync';
import { emptySession, setPersonNote } from '@/utils/narvaro';
import { exampleTable } from '@/utils/narvaroExample';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const NOW = new Date(2026, 10, 4, 10, 0);
const SESSION = '2026-11-02|Måndag|B';
const PASS = 'grön cykel under bron';

/** En minimal renderHook. Repot har inget testbibliotek för React. */
const renderHook = () => {
  const result: { current: ReturnType<typeof useNarvaroSync> } = { current: undefined as never };
  const Probe = () => {
    result.current = useNarvaroSync('u1', NOW);
    return null;
  };
  const root = createRoot(document.createElement('div'));
  act(() => { root.render(React.createElement(Probe)); });
  return { result, unmount: () => act(() => root.unmount()) };
};

const waitFor = async (check: () => boolean, ms = 4000) => {
  const start = Date.now();
  while (!check()) {
    if (Date.now() - start > ms) throw new Error('Väntade för länge');
    await act(async () => { await new Promise(r => setTimeout(r, 20)); });
  }
};

const withNote = (text: string) => setPersonNote(emptySession('Måndag 2/11'), 'Amira Haddad', { tags: [], note: text });

describe('useNarvaroSync', () => {
  beforeEach(() => {
    server.clear();
    window.localStorage.clear();
  });
  afterEach(() => { vi.restoreAllMocks(); });

  it('skapar lösenfrasen och sparar bara chiffertext', async () => {
    const { result, unmount } = renderHook();
    await waitFor(() => result.current.phase === 'setup');
    await act(async () => { await result.current.setup(PASS, false); });
    expect(result.current.phase).toBe('ready');
    expect(server.has('keyinfo')).toBe(true);

    act(() => result.current.update(d => ({ ...d, tables: { 'w2026-45': { Oliv: exampleTable() } }, notes: { [SESSION]: withNote('ledde diskussionen') } })));
    await waitFor(() => server.has('w2026-45') && result.current.saveStatus === 'saved');

    const stored = Array.from(server.values()).map(v => v.payload).join('');
    expect(stored).not.toContain('Amira');
    expect(stored).not.toContain('diskussionen');
    unmount();
  });

  it('låser upp på en annan enhet med rätt lösenfras', async () => {
    const a = renderHook();
    await waitFor(() => a.result.current.phase === 'setup');
    await act(async () => { await a.result.current.setup(PASS, false); });
    act(() => a.result.current.update(d => ({ ...d, notes: { [SESSION]: withNote('från datorn') } })));
    await waitFor(() => server.has('w2026-45') && a.result.current.saveStatus === 'saved');
    a.unmount();

    const b = renderHook();
    await waitFor(() => b.result.current.phase === 'locked');
    await act(async () => { await b.result.current.unlock('fel lösenfras', false); });
    expect(b.result.current.phase).toBe('locked');
    expect(b.result.current.error).toMatch(/Fel lösenfras/);

    await act(async () => { await b.result.current.unlock(PASS, false); });
    expect(b.result.current.phase).toBe('ready');
    expect(b.result.current.data.notes[SESSION].people['Amira Haddad'].note).toBe('från datorn');
    b.unmount();
  });

  it('för över det som låg i webbläsaren och tar bort det när det sparats', async () => {
    window.localStorage.setItem('narvaro.table.v1', JSON.stringify(exampleTable()));
    // Nyckeln i det gamla formatet, med passets namn sist.
    window.localStorage.setItem('narvaro.notes.v1', JSON.stringify({ [`${SESSION}|8.30-9.45`]: withNote('gammal anteckning') }));
    const { result, unmount } = renderHook();
    await waitFor(() => result.current.phase === 'setup');
    await act(async () => { await result.current.setup(PASS, false); });
    await waitFor(() => window.localStorage.getItem('narvaro.table.v1') === null);

    expect(result.current.data.tables).toEqual({ 'w2026-45': { '': exampleTable() } });
    expect(result.current.data.notes[SESSION].people['Amira Haddad'].note).toBe('gammal anteckning');
    expect(server.has('w2026-45')).toBe(true);
    expect(window.localStorage.getItem('narvaro.notes.v1')).toBeNull();
    unmount();
  });

  it('skriver inte över en annan enhets ändring, och hämtar den på begäran', async () => {
    const a = renderHook();
    await waitFor(() => a.result.current.phase === 'setup');
    await act(async () => { await a.result.current.setup(PASS, false); });
    act(() => a.result.current.update(d => ({ ...d, notes: { [SESSION]: withNote('första') } })));
    await waitFor(() => server.get('w2026-45')?.version === 1 && a.result.current.saveStatus === 'saved');

    const b = renderHook();
    await waitFor(() => b.result.current.phase === 'locked');
    await act(async () => { await b.result.current.unlock(PASS, false); });
    act(() => b.result.current.update(d => ({ ...d, notes: { [SESSION]: withNote('från telefonen') } })));
    await waitFor(() => server.get('w2026-45')?.version === 2);

    act(() => a.result.current.update(d => ({ ...d, notes: { [SESSION]: withNote('från datorn') } })));
    await waitFor(() => a.result.current.saveStatus === 'conflict');
    expect(server.get('w2026-45')?.version).toBe(2);

    await act(async () => { await a.result.current.refresh(true); });
    expect(a.result.current.saveStatus).toBe('saved');
    expect(a.result.current.data.notes[SESSION].people['Amira Haddad'].note).toBe('från telefonen');
    a.unmount();
    b.unmount();
  });

  it('börjar om när lösenfrasen glömts', async () => {
    const a = renderHook();
    await waitFor(() => a.result.current.phase === 'setup');
    await act(async () => { await a.result.current.setup(PASS, false); });
    a.unmount();

    const b = renderHook();
    await waitFor(() => b.result.current.phase === 'locked');
    await act(async () => { await b.result.current.reset(); });
    expect(b.result.current.phase).toBe('setup');
    expect(server.size).toBe(0);
    b.unmount();
  });
});
