'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { MindmapConflictError, mindmapService } from '@/services/mindmapService';
import type { MindmapDoc, MindmapMap, MindmapSummary } from '@/types/mindmapDoc';
import { MAX_MINDMAPS } from '@/types/mindmapDoc';
import { withKeepalive } from '@/utils/keepalive';
import { newNodeId } from '@/utils/mindmap/mindmapTree';
import {
  DEFAULT_MINDMAP_NAME,
  LAST_OPEN_KEY,
  cleanMindmapName,
  copyName,
  defaultMindmapDoc,
  sanitizeLastOpen,
  sortSummaries,
  upsertSummary,
} from '@/utils/mindmapDoc';
import { createSaveQueue, type SaveQueue, type SaveQueueEvent } from '@/utils/saveQueue';

/**
 * Mindmap-sidans lista och den öppna kartan, med sparning till `/api/mindmap`.
 *
 * Förebilden är useNarvaroSync utan kryptering: en nyckel i kön är ett
 * kart-id, hela dokumentet sparas efter 800 ms stillhet, och varje karta har
 * en version som skickas med. En sparning som bygger på en gammal version
 * avvisas (409) och blir `conflict`; då väljer användaren mellan att hämta
 * serverns version och att skriva över den med sin egen. Ingen tyst
 * överskrivning, och ingen sparning får lämna det som väntar när sidan
 * stängs.
 *
 * `mindmap.lastOpen.v1` i localStorage minns vilken karta som var öppen.
 * Den läses direkt i inläsningen, inte med usePersistentState, eftersom
 * listan hämtas innan den hookens effekt hunnit läsa värdet.
 */

export type MindmapPhase = 'loading' | 'ready' | 'error';
export type MindmapSaveStatus = 'saved' | 'pending' | 'saving' | 'error' | 'conflict';
export type MindmapConflict = { version: number | null; updatedAt: string | null };

type Pending = { doc: MindmapDoc; name: string };

const SAVE_DELAY_MS = 800;
const RETRY_DELAY_MS = 8000;

const readLastOpen = (): string | null => {
  try {
    const raw = window.localStorage.getItem(LAST_OPEN_KEY);
    return raw === null ? null : sanitizeLastOpen(JSON.parse(raw));
  } catch {
    return null;
  }
};

const writeLastOpen = (id: string | null) => {
  try {
    if (id) window.localStorage.setItem(LAST_OPEN_KEY, JSON.stringify(id));
    else window.localStorage.removeItem(LAST_OPEN_KEY);
  } catch {
    /* lagringen kan vara blockerad */
  }
};

const message = (e: unknown, fallback: string) => (e instanceof Error && e.message ? e.message : fallback);

export function useMindmapSync(userId: string | null) {
  const [phase, setPhase] = useState<MindmapPhase>('loading');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [maps, setMapsState] = useState<MindmapSummary[]>([]);
  const [active, setActiveState] = useState<MindmapMap | null>(null);
  const [saveStatus, setSaveStatus] = useState<MindmapSaveStatus>('saved');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [conflict, setConflict] = useState<MindmapConflict | null>(null);
  /** Ett fel från listan (skapa, byta namn, ta bort), tills det stängs. */
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const mapsRef = useRef<MindmapSummary[]>([]);
  const activeRef = useRef<MindmapMap | null>(null);
  const versions = useRef(new Map<string, number>());
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const queueRef = useRef<SaveQueue<Pending, MindmapMap> | null>(null);

  const setMaps = (next: MindmapSummary[]) => { mapsRef.current = next; setMapsState(next); };
  const setActive = (next: MindmapMap | null) => { activeRef.current = next; setActiveState(next); };

  const onEvent = useCallback((e: SaveQueueEvent<MindmapMap>) => {
    if (e.saved) {
      versions.current.set(e.key, e.saved.version);
      const { doc: _doc, ...summary } = e.saved;
      setMaps(upsertSummary(mapsRef.current, summary));
      const current = activeRef.current;
      if (current?.id === e.key) {
        // Dokumentet är det senaste här; servern har bara ett äldre eller samma.
        setActive({ ...current, version: e.saved.version, updatedAt: e.saved.updatedAt });
      }
    }
    if (e.status === 'error') {
      if (e.error instanceof MindmapConflictError) {
        setConflict({ version: e.error.currentVersion, updatedAt: e.error.updatedAt });
        setSaveStatus('conflict');
        return;
      }
      setSaveError(message(e.error, 'Kunde inte spara.'));
      setSaveStatus('error');
      // Ett nätverksfel försöks igen om en stund.
      if (!retryTimer.current) {
        retryTimer.current = setTimeout(() => {
          retryTimer.current = null;
          void queueRef.current?.flushAll();
        }, RETRY_DELAY_MS);
      }
      return;
    }
    setSaveError(null);
    setSaveStatus(e.status);
  }, []);

  queueRef.current ??= createSaveQueue<Pending, MindmapMap>({
    delayMs: SAVE_DELAY_MS,
    save: (id, value, { keepalive }) => {
      const body = { version: versions.current.get(id) ?? 1, name: value.name, doc: value.doc };
      return withKeepalive(JSON.stringify(body), keepalive, ka => mindmapService.update(id, body, { keepalive: ka }));
    },
    onEvent,
    retainOnError: err => !(err instanceof MindmapConflictError),
  });
  const queue = queueRef.current;

  const show = useCallback((map: MindmapMap) => {
    versions.current.set(map.id, map.version);
    setConflict(null);
    setSaveError(null);
    setSaveStatus('saved');
    setActive(map);
    writeLastOpen(map.id);
  }, []);

  /** Sparar det som väntar i den öppna kartan och öppnar en annan. */
  const open = useCallback(async (id: string) => {
    if (activeRef.current?.id === id) return;
    setBusy(true);
    try {
      await queue.flushAll();
      show(await mindmapService.get(id));
    } catch (e) {
      setNotice(message(e, 'Kunde inte öppna kartan.'));
    } finally {
      setBusy(false);
    }
  }, [queue, show]);

  const load = useCallback(async () => {
    setPhase('loading');
    setLoadError(null);
    try {
      const list = sortSummaries(await mindmapService.list());
      setMaps(list);
      const wanted = readLastOpen();
      const first = list.find(m => m.id === wanted) ?? list[0];
      if (first) show(await mindmapService.get(first.id));
      else setActive(null);
      setPhase('ready');
    } catch (e) {
      setLoadError(message(e, 'Kunde inte hämta kartorna.'));
      setPhase('error');
    }
  }, [show]);

  useEffect(() => {
    if (!userId) return;
    void load();
  }, [userId, load]);

  /** En ändring i den öppna kartan. Sparas efter en stund. */
  const update = useCallback((doc: MindmapDoc) => {
    const current = activeRef.current;
    if (!current) return;
    setActive({ ...current, doc });
    queue.schedule(current.id, { doc, name: current.name });
  }, [queue]);

  const createWith = useCallback(async (name: string, doc: MindmapDoc) => {
    if (mapsRef.current.length >= MAX_MINDMAPS) {
      setNotice(`Du kan ha högst ${MAX_MINDMAPS} kartor. Ta bort en först.`);
      return;
    }
    setBusy(true);
    try {
      await queue.flushAll();
      const created = await mindmapService.create({ id: newNodeId(), name, doc });
      const { doc: _doc, ...summary } = created;
      setMaps(upsertSummary(mapsRef.current, summary));
      show(created);
    } catch (e) {
      setNotice(message(e, 'Kunde inte skapa kartan.'));
    } finally {
      setBusy(false);
    }
  }, [queue, show]);

  const create = useCallback(() => createWith(DEFAULT_MINDMAP_NAME, defaultMindmapDoc()), [createWith]);

  const duplicate = useCallback(async (id: string) => {
    const current = activeRef.current;
    try {
      const source = current?.id === id ? current : await mindmapService.get(id);
      await createWith(copyName(source.name, mapsRef.current.map(m => m.name)), source.doc);
    } catch (e) {
      setNotice(message(e, 'Kunde inte kopiera kartan.'));
    }
  }, [createWith]);

  const rename = useCallback(async (id: string, rawName: string) => {
    const name = cleanMindmapName(rawName);
    const current = activeRef.current;
    if (current?.id === id) {
      if (name === current.name) return;
      setActive({ ...current, name });
      const { doc: _doc, ...summary } = current;
      setMaps(upsertSummary(mapsRef.current, { ...summary, name }));
      // Genom kön, så att namnet och en sparning av dokumentet inte tävlar om versionen.
      queue.schedule(id, { doc: current.doc, name }, 0);
      return;
    }
    const summary = mapsRef.current.find(m => m.id === id);
    if (!summary || summary.name === name) return;
    setBusy(true);
    try {
      const saved = await mindmapService.update(id, { version: summary.version, name });
      const { doc: _doc, ...next } = saved;
      setMaps(upsertSummary(mapsRef.current, next));
    } catch (e) {
      setNotice(e instanceof MindmapConflictError
        ? 'Kartan har ändrats någon annanstans. Ladda om sidan och försök igen.'
        : message(e, 'Kunde inte byta namn.'));
    } finally {
      setBusy(false);
    }
  }, [queue]);

  const remove = useCallback(async (id: string) => {
    setBusy(true);
    try {
      queue.forget(id);
      versions.current.delete(id);
      await mindmapService.remove(id);
      const rest = mapsRef.current.filter(m => m.id !== id);
      setMaps(rest);
      if (activeRef.current?.id === id) {
        setConflict(null);
        setSaveError(null);
        setSaveStatus('saved');
        if (rest[0]) show(await mindmapService.get(rest[0].id));
        else {
          setActive(null);
          writeLastOpen(null);
        }
      }
    } catch (e) {
      setNotice(message(e, 'Kunde inte ta bort kartan.'));
    } finally {
      setBusy(false);
    }
  }, [queue, show]);

  /** Efter en konflikt: hämtar serverns version och släpper den egna. */
  const reloadActive = useCallback(async () => {
    const current = activeRef.current;
    if (!current) return;
    setBusy(true);
    try {
      queue.forget(current.id);
      show(await mindmapService.get(current.id));
    } catch (e) {
      setNotice(message(e, 'Kunde inte hämta kartan.'));
    } finally {
      setBusy(false);
    }
  }, [queue, show]);

  /** Efter en konflikt: skriver över serverns version med den egna. */
  const keepMine = useCallback(() => {
    const current = activeRef.current;
    if (!current || !conflict) return;
    if (conflict.version !== null) versions.current.set(current.id, conflict.version);
    setConflict(null);
    queue.schedule(current.id, { doc: current.doc, name: current.name }, 0);
  }, [conflict, queue]);

  const retrySave = useCallback(() => { void queue.flushAll(); }, [queue]);
  const dismissNotice = useCallback(() => setNotice(null), []);

  // Ingen sparning får lämna det som väntar när sidan stängs (se useNarvaroSync).
  useEffect(() => {
    const q = queue;
    const onPageHide = () => { void q.flushAll({ keepalive: true, immediate: true }); };
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') void q.flushAll({ keepalive: true });
    };
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (q.hasUnsaved()) event.preventDefault();
    };
    window.addEventListener('pagehide', onPageHide);
    window.addEventListener('beforeunload', onBeforeUnload);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('pagehide', onPageHide);
      window.removeEventListener('beforeunload', onBeforeUnload);
      document.removeEventListener('visibilitychange', onVisibility);
      void q.flushAll({ keepalive: true });
      if (retryTimer.current) clearTimeout(retryTimer.current);
    };
  }, [queue]);

  return {
    phase, loadError, maps, active, saveStatus, saveError, conflict, notice, busy,
    update, open, create, duplicate, rename, remove, reloadActive, keepMine, retrySave, dismissNotice,
    retryLoad: load,
  };
}

export type MindmapSync = ReturnType<typeof useMindmapSync>;
