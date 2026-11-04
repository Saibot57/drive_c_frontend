'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { NarvaroConflictError, NarvaroDocument, narvaroService } from '@/services/narvaroService';
import { withKeepalive } from '@/utils/keepalive';
import {
  KeyInfo,
  WrongPassphraseError,
  createKeyInfo,
  decryptJson,
  encryptJson,
  keyMatches,
  parseKeyInfo,
  unlockKey,
} from '@/utils/narvaroCrypto';
import {
  KEYINFO_KEY,
  LegacyData,
  NarvaroData,
  SETTINGS_KEY,
  WeekDoc,
  documentsToSave,
  emptyData,
  hasLegacyContent,
  isWeekKey,
  mergeLegacy,
  mergeWeeks,
  sanitizeSettingsDoc,
  sanitizeWeekDoc,
} from '@/utils/narvaroDocs';
import { forgetKey, recallKey, rememberKey } from '@/utils/narvaroKeyStore';
import { DEFAULT_STAMPS, sanitizeGroups, sanitizeNotes, sanitizeStamps, sanitizeTable } from '@/utils/narvaro';
import { createSaveQueue, type SaveQueue, type SaveQueueEvent } from '@/utils/saveQueue';

/**
 * Närvarorutornas sparning. Allt krypteras i webbläsaren innan det skickas
 * (se narvaroCrypto); servern får bara chiffertext.
 *
 * - `loading`: dokumenten hämtas.
 * - `setup`: ingen lösenfras finns än. Den första skapas här.
 * - `locked`: lösenfrasen behövs (eller nyckeln som minns på enheten).
 * - `ready`: datan är dekrypterad och ändringar sparas.
 * - `error`: servern svarade inte.
 *
 * Varje vecka och stämplarna är egna dokument med egen version, som i
 * Arbetslag: en sparning som bygger på en gammal version avvisas (409) och
 * blir `conflict`, så att en annan enhet inte skrivs över. När sidan blir
 * synlig igen hämtas det senaste, om inget väntar på att sparas.
 *
 * Det som tidigare bara låg i localStorage (`narvaro.*.v1`) förs över första
 * gången datan låses upp, och tas bort ur webbläsaren när det har sparats.
 */

export type NarvaroPhase = 'loading' | 'setup' | 'locked' | 'ready' | 'error';
export type NarvaroSaveStatus = 'saved' | 'pending' | 'saving' | 'error' | 'conflict';

const SAVE_DELAY_MS = 800;
const RETRY_DELAY_MS = 8000;

const LEGACY_KEYS = {
  table: 'narvaro.table.v1',
  notes: 'narvaro.notes.v1',
  stamps: 'narvaro.stamps.v1',
  groups: 'narvaro.groups.v1',
} as const;

const readStored = (key: string): unknown => {
  try {
    const raw = window.localStorage.getItem(key);
    return raw === null ? undefined : JSON.parse(raw);
  } catch {
    return undefined;
  }
};

export function readLegacy(): LegacyData {
  const stamps = readStored(LEGACY_KEYS.stamps);
  return {
    table: sanitizeTable(readStored(LEGACY_KEYS.table)),
    notes: sanitizeNotes(readStored(LEGACY_KEYS.notes)),
    groups: sanitizeGroups(readStored(LEGACY_KEYS.groups)),
    stamps: stamps === undefined ? null : sanitizeStamps(stamps),
  };
}

const clearLegacy = () => {
  Object.values(LEGACY_KEYS).forEach(k => {
    try { window.localStorage.removeItem(k); } catch { /* lagringen kan vara blockerad */ }
  });
};

const STATUS_RANK: Record<NarvaroSaveStatus, number> = { saved: 0, pending: 1, saving: 2, error: 3, conflict: 4 };

export function useNarvaroSync(userId: string | null, now: Date) {
  const [phase, setPhaseState] = useState<NarvaroPhase>('loading');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [data, setDataState] = useState<NarvaroData>(emptyData);
  const [saveStatus, setSaveStatus] = useState<NarvaroSaveStatus>('saved');
  /** Dokument som inte gick att dekryptera. De visas inte och skrivs aldrig över. */
  const [unreadable, setUnreadable] = useState(0);

  const phaseRef = useRef<NarvaroPhase>('loading');
  const dataRef = useRef<NarvaroData>(data);
  const keyRef = useRef<CryptoKey | null>(null);
  const keyInfoRef = useRef<KeyInfo | null>(null);
  const docsRef = useRef<NarvaroDocument[]>([]);
  const versions = useRef(new Map<string, number>());
  const lastJson = useRef(new Map<string, string>());
  const seq = useRef(new Map<string, number>());
  const skip = useRef(new Set<string>());
  const statuses = useRef(new Map<string, NarvaroSaveStatus>());
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const queueRef = useRef<SaveQueue<string, NarvaroDocument> | null>(null);

  const setPhase = (p: NarvaroPhase) => { phaseRef.current = p; setPhaseState(p); };
  const setData = (d: NarvaroData) => { dataRef.current = d; setDataState(d); };

  const onEvent = useCallback((e: SaveQueueEvent<NarvaroDocument>) => {
    if (e.saved) versions.current.set(e.key, e.saved.version);
    const status: NarvaroSaveStatus = e.status === 'error'
      ? (e.error instanceof NarvaroConflictError ? 'conflict' : 'error')
      : e.status;
    statuses.current.set(e.key, status);
    const overall = Array.from(statuses.current.values())
      .reduce<NarvaroSaveStatus>((a, s) => (STATUS_RANK[s] > STATUS_RANK[a] ? s : a), 'saved');
    setSaveStatus(overall);
    // Ett nätverksfel försöks igen om en stund. En konflikt väntar på användaren.
    if (status === 'error' && !retryTimer.current) {
      retryTimer.current = setTimeout(() => {
        retryTimer.current = null;
        void queueRef.current?.flushAll();
      }, RETRY_DELAY_MS);
    }
  }, []);

  queueRef.current ??= createSaveQueue<string, NarvaroDocument>({
    delayMs: SAVE_DELAY_MS,
    save: (key, payload, { keepalive }) => withKeepalive(payload, keepalive, ka =>
      narvaroService.put(key, payload, versions.current.get(key) ?? 0, { keepalive: ka })),
    onEvent,
    retainOnError: err => !(err instanceof NarvaroConflictError),
  });
  const queue = queueRef.current;

  /** Glömmer allt som hör till en upplåst nyckel. */
  const resetState = useCallback(() => {
    keyRef.current = null;
    versions.current.clear();
    lastJson.current.clear();
    seq.current.clear();
    skip.current.clear();
    statuses.current.forEach((_, k) => queueRef.current?.forget(k));
    statuses.current.clear();
    setSaveStatus('saved');
    setUnreadable(0);
    setData(emptyData());
  }, []);

  /** Krypterar och köar de dokument som ändrats sedan sist. Klart när allt är köat. */
  const persist = useCallback((next: NarvaroData): Promise<void> => {
    const key = keyRef.current;
    if (phaseRef.current !== 'ready' || !key) return Promise.resolve();
    const pending: Promise<void>[] = [];
    const known = new Set([...Array.from(versions.current.keys()), ...Array.from(lastJson.current.keys())]);
    Object.entries(documentsToSave(next, now, known)).forEach(([k, doc]) => {
      if (skip.current.has(k)) return;
      const json = JSON.stringify(doc);
      if (lastJson.current.get(k) === json) return;
      lastJson.current.set(k, json);
      const n = (seq.current.get(k) ?? 0) + 1;
      seq.current.set(k, n);
      // Krypteringen är asynkron. Bara den senaste ändringen köas.
      pending.push(encryptJson(key, doc).then(payload => {
        if (seq.current.get(k) === n && keyRef.current === key) queueRef.current?.schedule(k, payload);
      }));
    });
    return Promise.all(pending).then(() => undefined);
  }, [now]);

  const update = useCallback((fn: (d: NarvaroData) => NarvaroData) => {
    const next = fn(dataRef.current);
    setData(next);
    void persist(next);
  }, [persist]);

  /** Dekrypterar serverns dokument och visar dem. */
  const enterReady = useCallback(async (docs: NarvaroDocument[], key: CryptoKey) => {
    const weeks: Record<string, WeekDoc> = {};
    let stamps = [...DEFAULT_STAMPS];
    let bad = 0;
    versions.current.clear();
    skip.current.clear();
    for (const doc of docs) {
      versions.current.set(doc.key, doc.version);
      if (doc.key === KEYINFO_KEY) continue;
      try {
        const plain = await decryptJson(key, doc.payload);
        if (doc.key === SETTINGS_KEY) stamps = sanitizeSettingsDoc(plain).stamps;
        else if (isWeekKey(doc.key)) weeks[doc.key] = sanitizeWeekDoc(plain);
      } catch {
        bad++;
        skip.current.add(doc.key);
      }
    }
    const fromServer = mergeWeeks(weeks, stamps, now);
    // Det som sparas jämförs mot serverns innehåll i samma form, så att
    // inläsningen inte i sig ger några sparningar.
    lastJson.current.clear();
    Object.entries(documentsToSave(fromServer, now, versions.current.keys())).forEach(([k, doc]) => {
      if (versions.current.has(k)) lastJson.current.set(k, JSON.stringify(doc));
    });
    keyRef.current = key;
    setUnreadable(bad);
    setData(fromServer);
    setError(null);
    setPhase('ready');

    const legacy = readLegacy();
    if (!hasLegacyContent(legacy)) return;
    const merged = mergeLegacy(fromServer, legacy, now);
    setData(merged);
    // Webbläsarens kopia tas bort först när allt har sparats.
    await persist(merged);
    await queueRef.current?.flushAll();
    if (!queueRef.current?.hasUnsaved()) clearLegacy();
  }, [now, persist]);

  const load = useCallback(async () => {
    setPhase('loading');
    setError(null);
    let docs: NarvaroDocument[];
    try {
      docs = await narvaroService.list();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Kunde inte hämta närvaron.');
      setPhase('error');
      return;
    }
    docsRef.current = docs;
    const info = docs.find(d => d.key === KEYINFO_KEY);
    const keyInfo = info ? parseKeyInfo(info.payload) : null;
    keyInfoRef.current = keyInfo;
    if (!keyInfo) { setPhase('setup'); return; }
    const remembered = userId ? await recallKey(userId) : null;
    if (remembered && await keyMatches(remembered, keyInfo)) {
      await enterReady(docs, remembered);
      return;
    }
    setPhase('locked');
  }, [userId, enterReady]);

  useEffect(() => {
    if (!userId) return;
    void load();
  }, [userId, load]);

  const setup = useCallback(async (passphrase: string, remember: boolean) => {
    setBusy(true);
    setError(null);
    try {
      // Dokument utan lösenfras går inte att läsa. De tas bort, så att de
      // inte stoppar de nya.
      if (docsRef.current.length) await narvaroService.deleteAll();
      const { keyInfo, key } = await createKeyInfo(passphrase);
      const saved = await narvaroService.put(KEYINFO_KEY, JSON.stringify(keyInfo), 0);
      keyInfoRef.current = keyInfo;
      if (remember && userId) await rememberKey(userId, key);
      await enterReady([saved], key);
    } catch (e) {
      if (e instanceof NarvaroConflictError) { await load(); return; }
      setError(e instanceof Error ? e.message : 'Kunde inte spara lösenfrasen.');
    } finally {
      setBusy(false);
    }
  }, [userId, enterReady, load]);

  const unlock = useCallback(async (passphrase: string, remember: boolean) => {
    const keyInfo = keyInfoRef.current;
    if (!keyInfo) return;
    setBusy(true);
    setError(null);
    try {
      const key = await unlockKey(passphrase, keyInfo);
      if (remember && userId) await rememberKey(userId, key);
      await enterReady(docsRef.current, key);
    } catch (e) {
      setError(e instanceof WrongPassphraseError ? 'Fel lösenfras. Försök igen.' : 'Kunde inte låsa upp.');
    } finally {
      setBusy(false);
    }
  }, [userId, enterReady]);

  /** Sparar det som väntar, glömmer nyckeln på enheten och låser. */
  const lock = useCallback(async () => {
    await queueRef.current?.flushAll();
    if (userId) await forgetKey(userId);
    resetState();
    await load();
  }, [userId, resetState, load]);

  /** Tar bort allt på servern, för den som glömt lösenfrasen. */
  const reset = useCallback(async () => {
    setBusy(true);
    try {
      await narvaroService.deleteAll();
      if (userId) await forgetKey(userId);
      resetState();
      docsRef.current = [];
      keyInfoRef.current = null;
      setError(null);
      setPhase('setup');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Kunde inte ta bort.');
    } finally {
      setBusy(false);
    }
  }, [userId, resetState]);

  /**
   * Hämtar det senaste från servern. Utan `force` bara om inget väntar på att
   * sparas och något har ändrats. Med `force` släpps det som inte kunde
   * sparas, till exempel efter en konflikt.
   */
  const refresh = useCallback(async (force = false) => {
    const key = keyRef.current;
    const q = queueRef.current;
    if (phaseRef.current !== 'ready' || !key || !q) return;
    if (!force && q.hasUnsaved()) return;
    let docs: NarvaroDocument[];
    try {
      docs = await narvaroService.list();
    } catch {
      return;
    }
    const changed = docs.length !== versions.current.size
      || docs.some(d => versions.current.get(d.key) !== d.version);
    if (!changed && !force) return;
    if (force) {
      statuses.current.forEach((_, k) => q.forget(k));
      statuses.current.clear();
      setSaveStatus('saved');
    }
    if (!force && q.hasUnsaved()) return;
    docsRef.current = docs;
    await enterReady(docs, key);
  }, [enterReady]);

  // Ingen sparning får lämna det som väntar när sidan stängs (se useThemeWheelSync).
  useEffect(() => {
    const q = queueRef.current;
    if (!q) return;
    const onPageHide = () => { void q.flushAll({ keepalive: true, immediate: true }); };
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') void q.flushAll({ keepalive: true });
      else void refresh();
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
  }, [refresh]);

  return { phase, error, busy, data, saveStatus, unreadable, update, setup, unlock, lock, reset, refresh, retry: load };
}
