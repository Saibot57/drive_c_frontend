// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MindmapDoc, MindmapMap } from '@/types/mindmapDoc';

/** En server i minnet med samma regler som /api/mindmap: gammal version ger 409. */
const server = new Map<string, MindmapMap>();
let clock = 0;
const stamp = () => `2026-11-10T10:00:${String(clock++).padStart(2, '0')}`;
const summaryOf = ({ doc: _doc, ...rest }: MindmapMap) => rest;

vi.mock('@/services/mindmapService', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/services/mindmapService')>();
  return {
    ...original,
    mindmapService: {
      list: async () => Array.from(server.values()).map(summaryOf),
      get: async (id: string) => {
        const map = server.get(id);
        if (!map) throw new Error('Kartan finns inte');
        return structuredClone(map);
      },
      create: async ({ id, name, doc }: { id: string; name: string; doc: MindmapDoc }) => {
        const map: MindmapMap = { id, name, doc, version: 1, createdAt: stamp(), updatedAt: stamp() };
        server.set(id, map);
        return structuredClone(map);
      },
      update: async (id: string, body: { version: number; name?: string; doc?: MindmapDoc }) => {
        const cur = server.get(id);
        if (!cur) throw new Error('Kartan finns inte');
        if (cur.version !== body.version) throw new original.MindmapConflictError(cur.version, cur.updatedAt);
        const next: MindmapMap = { ...cur, ...(body.name ? { name: body.name } : {}), ...(body.doc ? { doc: body.doc } : {}), version: cur.version + 1, updatedAt: stamp() };
        server.set(id, next);
        return structuredClone(next);
      },
      remove: async (id: string) => { server.delete(id); },
    },
  };
});

import { useMindmapSync } from '@/hooks/useMindmapSync';
import { addChild, setLabel } from '@/utils/mindmap/mindmapTree';
import { MAX_MINDMAPS } from '@/types/mindmapDoc';
import { toMindmapFile } from '@/utils/mindmapFile';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const DOC: MindmapDoc = { root: { id: 'r', label: 'Rot', children: [] }, layout: 'right' };
const seed = (id: string, name: string, doc: MindmapDoc = DOC) => {
  server.set(id, { id, name, doc, version: 1, createdAt: stamp(), updatedAt: stamp() });
};

/** En minimal renderHook. Repot har inget testbibliotek för React. */
const renderHook = () => {
  const result: { current: ReturnType<typeof useMindmapSync> } = { current: undefined as never };
  const Probe = () => {
    result.current = useMindmapSync('u1');
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

describe('useMindmapSync', () => {
  beforeEach(() => {
    server.clear();
    clock = 0;
    window.localStorage.clear();
  });
  afterEach(() => { vi.restoreAllMocks(); });

  it('hämtar listan, öppnar den senast öppnade kartan och minns valet', async () => {
    seed('a', 'Första');
    seed('b', 'Andra');
    window.localStorage.setItem('mindmap.lastOpen.v1', JSON.stringify('a'));
    const { result, unmount } = renderHook();
    await waitFor(() => result.current.phase === 'ready');
    expect(result.current.maps.map(m => m.id)).toEqual(['b', 'a']);
    expect(result.current.active?.id).toBe('a');

    await act(async () => { await result.current.open('b'); });
    expect(result.current.active?.name).toBe('Andra');
    expect(JSON.parse(window.localStorage.getItem('mindmap.lastOpen.v1')!)).toBe('b');
    unmount();
  });

  it('skapar en karta när listan är tom och öppnar den', async () => {
    const { result, unmount } = renderHook();
    await waitFor(() => result.current.phase === 'ready');
    expect(result.current.active).toBeNull();
    await act(async () => { await result.current.create(); });
    expect(result.current.active?.name).toBe('Ny karta');
    expect(server.size).toBe(1);
    expect(result.current.maps).toHaveLength(1);
    unmount();
  });

  it('sparar en ändring efter en stund och räknar upp versionen', async () => {
    seed('a', 'Karta');
    const { result, unmount } = renderHook();
    await waitFor(() => result.current.active?.id === 'a');

    act(() => result.current.update(setLabel(result.current.active!.doc, 'r', 'Ny rot')));
    expect(result.current.saveStatus).toBe('pending');
    await waitFor(() => result.current.saveStatus === 'saved' && server.get('a')!.version === 2);
    expect(server.get('a')!.doc.root.label).toBe('Ny rot');
    expect(result.current.active?.version).toBe(2);
    expect(result.current.maps[0].version).toBe(2);
    unmount();
  });

  it('skriver inte över en annan fliks ändring, och låter användaren välja', async () => {
    seed('a', 'Karta');
    const { result, unmount } = renderHook();
    await waitFor(() => result.current.active?.id === 'a');

    // En annan flik sparar först.
    server.set('a', { ...server.get('a')!, doc: setLabel(DOC, 'r', 'Från fliken'), version: 2 });

    act(() => result.current.update(setLabel(result.current.active!.doc, 'r', 'Härifrån')));
    await waitFor(() => result.current.saveStatus === 'conflict');
    expect(server.get('a')!.doc.root.label).toBe('Från fliken');
    expect(result.current.conflict?.version).toBe(2);

    // Hämta serverns version.
    await act(async () => { await result.current.reloadActive(); });
    expect(result.current.active?.doc.root.label).toBe('Från fliken');
    expect(result.current.saveStatus).toBe('saved');

    // Eller behåll den egna: skrivs med den nya versionen.
    server.set('a', { ...server.get('a')!, version: 3 });
    act(() => result.current.update(setLabel(result.current.active!.doc, 'r', 'Min igen')));
    await waitFor(() => result.current.saveStatus === 'conflict');
    act(() => result.current.keepMine());
    await waitFor(() => result.current.saveStatus === 'saved' && server.get('a')!.doc.root.label === 'Min igen');
    expect(server.get('a')!.version).toBe(4);
    unmount();
  });

  it('byter namn på en annan karta, kopierar och tar bort den öppna', async () => {
    seed('a', 'Karta', addChild(DOC, 'r', { id: 'x', label: 'Gren', children: [] })!.content);
    seed('b', 'Annan');
    window.localStorage.setItem('mindmap.lastOpen.v1', JSON.stringify('a'));
    const { result, unmount } = renderHook();
    await waitFor(() => result.current.active?.id === 'a');

    await act(async () => { await result.current.rename('b', '  Omdöpt  '); });
    expect(server.get('b')!.name).toBe('Omdöpt');
    expect(result.current.maps.find(m => m.id === 'b')?.name).toBe('Omdöpt');

    await act(async () => { await result.current.duplicate('a'); });
    expect(result.current.active?.name).toBe('Kopia av Karta');
    expect(result.current.active?.doc.root.children[0].label).toBe('Gren');
    const copyId = result.current.active!.id;

    await act(async () => { await result.current.remove(copyId); });
    expect(server.has(copyId)).toBe(false);
    expect(result.current.active?.id).not.toBe(copyId);
    expect(result.current.maps.map(m => m.id)).not.toContain(copyId);
    unmount();
  });

  it('importerar till en ny karta och sparar den öppna först, utan att skriva över den', async () => {
    seed('a', 'Öppen');
    const { result, unmount } = renderHook();
    await waitFor(() => result.current.active?.id === 'a');

    // En ändring som väntar på att sparas när importen börjar.
    act(() => result.current.update(setLabel(result.current.active!.doc, 'r', 'Ändrad')));
    const imported: MindmapDoc = { root: { id: '1', label: 'Från MindMup', children: [{ id: '2', label: 'Gren', children: [] }] }, layout: 'right' };
    await act(async () => { await result.current.importMap('  Importerad  ', imported); });

    expect(server.get('a')!.doc.root.label).toBe('Ändrad');
    expect(server.get('a')!.name).toBe('Öppen');
    expect(server.size).toBe(2);
    expect(result.current.active?.id).not.toBe('a');
    expect(result.current.active?.name).toBe('Importerad');
    expect(result.current.active?.doc.root.children[0].label).toBe('Gren');
    unmount();
  });

  it('läser en fil i sidans format och en MindMup-fil', async () => {
    const { result, unmount } = renderHook();
    await waitFor(() => result.current.phase === 'ready');
    const own = toMindmapFile('Egen', { root: { id: 'r', label: 'Rot', children: [] }, layout: 'both' });
    await act(async () => { await result.current.importFile({ name: 'egen.json', size: own.length, text: async () => own }); });
    expect(result.current.active?.name).toBe('Egen');
    expect(result.current.active?.doc.layout).toBe('both');

    const mup = JSON.stringify({ id: 'root', formatVersion: 3, ideas: { 1: { id: 1, title: 'Mup-rot', ideas: { '-1': { id: 2, title: 'Vänster' } } } } });
    await act(async () => { await result.current.importFile({ name: 'karta.mup', size: mup.length, text: async () => mup }); });
    expect(result.current.active?.name).toBe('Mup-rot');
    expect(result.current.active?.doc.root.children[0].side).toBe('left');
    expect(server.size).toBe(2);
    unmount();
  });

  it('ger en notis och ingen ny karta för en trasig fil eller en för stor fil', async () => {
    seed('a', 'Öppen');
    const { result, unmount } = renderHook();
    await waitFor(() => result.current.active?.id === 'a');

    await act(async () => { await result.current.importFile({ name: 'trasig.mup', size: 10, text: async () => '{"title": ' }); });
    expect(result.current.notice).toBe('Filen går inte att läsa: den är inte JSON.');
    await act(async () => { await result.current.importFile({ name: 'okänd.json', size: 10, text: async () => '{"hej": 1}' }); });
    expect(result.current.notice).toMatch(/varken en MindMup-karta/);
    const text = vi.fn(async () => '{}');
    await act(async () => { await result.current.importFile({ name: 'stor.mup', size: 6 * 1024 * 1024, text }); });
    expect(result.current.notice).toMatch(/för stor/);
    expect(text).not.toHaveBeenCalled();

    expect(server.size).toBe(1);
    expect(result.current.active?.id).toBe('a');
    unmount();
  });

  it('ger det vanliga meddelandet vid gränsen på antal kartor', async () => {
    for (let i = 0; i < MAX_MINDMAPS; i += 1) seed(`m${i}`, `Karta ${i}`);
    const { result, unmount } = renderHook();
    await waitFor(() => result.current.phase === 'ready');
    const own = toMindmapFile('Egen', DOC);
    await act(async () => { await result.current.importFile({ name: 'egen.json', size: own.length, text: async () => own }); });
    expect(result.current.notice).toBe(`Du kan ha högst ${MAX_MINDMAPS} kartor. Ta bort en först.`);
    expect(server.size).toBe(MAX_MINDMAPS);
    unmount();
  });

  it('visar ett fel när servern inte svarar och kan försöka igen', async () => {
    const { mindmapService } = await import('@/services/mindmapService');
    const list = vi.spyOn(mindmapService, 'list').mockRejectedValueOnce(new Error('Servern svarar inte'));
    const { result, unmount } = renderHook();
    await waitFor(() => result.current.phase === 'error');
    expect(result.current.loadError).toBe('Servern svarar inte');
    seed('a', 'Karta');
    await act(async () => { await result.current.retryLoad(); });
    expect(result.current.phase).toBe('ready');
    expect(result.current.active?.id).toBe('a');
    list.mockRestore();
    unmount();
  });
});
