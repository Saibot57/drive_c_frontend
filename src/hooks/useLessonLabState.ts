'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { LAB_SEED } from '@/config/lessonLabSeed';
import { arbetslagService, PlanConflictError } from '@/services/arbetslagService';
import type { LabPlan, LabPlanSummary, LabState } from '@/types/lessonLab';
import { isEditableElement } from '@/utils/dom';
import { parseLabState } from '@/utils/lessonLab';
import { createPlanStore, SaveStatus } from '@/utils/labPlanStore';
import {
  DEFAULT_PLAN_NAME,
  importLegacyState,
  MAX_PLANS,
  NEW_PLAN_NAME,
  sortPlans,
  toSummary,
  uniquePlanName,
  upsertPlan,
} from '@/utils/labPlans';
import { commitUndoState, initialUndoState, redoState, undoState, UndoState } from '@/utils/undoHistory';
import { withRetry } from '@/utils/withRetry';

/**
 * Arbetslags läge, delat av den enkla vyn och detaljplanen. Läget är ett av
 * användarens sparade upplägg på servern (`/api/arbetslag`) och sparas
 * automatiskt genom kön i `labPlanStore`. localStorage minns bara vilket
 * upplägg som var öppet senast.
 *
 * Ångra och gör om (Ctrl+Z, Ctrl+Shift+Z) gäller sidan man är på och det
 * öppna upplägget; historiken nollställs när man byter upplägg.
 */

const ACTIVE_PLAN_KEY = 'lessonLab.activePlan.v1';
/** Id:t för det första upplägget, så att en dubbel uppstart inte skapar två. */
const FIRST_PLAN_ID_KEY = 'lessonLab.firstPlanId.v1';

export const readStored = <T,>(key: string, parse: (raw: unknown) => T, fallback: T): T => {
  try {
    const raw = window.localStorage.getItem(key);
    return raw === null ? fallback : parse(JSON.parse(raw));
  } catch {
    return fallback;
  }
};

export const writeStored = (key: string, value: unknown) => {
  try { window.localStorage.setItem(key, JSON.stringify(value)); } catch { /* full eller blockerad lagring */ }
};

/** localStorage som tål att vara blockerad. */
const safeStorage = {
  getItem: (key: string) => {
    try { return window.localStorage.getItem(key); } catch { return null; }
  },
  setItem: (key: string, value: string) => {
    try { window.localStorage.setItem(key, value); } catch { /* full eller blockerad lagring */ }
  },
};

const storedId = (key: string): string => {
  const existing = safeStorage.getItem(key);
  if (existing) return existing;
  const id = uuidv4();
  safeStorage.setItem(key, id);
  return id;
};

const errorMessage = (error: unknown, fallback: string) =>
  error instanceof Error && error.message ? error.message : fallback;

const assertRoom = (plans: readonly LabPlanSummary[]) => {
  if (plans.length >= MAX_PLANS) throw new Error(`Du kan ha högst ${MAX_PLANS} upplägg.`);
};

/** Kön lever på modulnivå, så att den överlever sidbyten inom appen. */
export const labPlanStore = createPlanStore({ save: arbetslagService.savePlan });

type Startup = { plans: LabPlanSummary[]; imported: LabPlan | null; importError: string | null };

/**
 * Listan, importen av det gamla läget och det första upplägget. Ett löfte på
 * modulnivå, så att två uppstarter samtidigt (strict mode i dev) delar samma
 * anrop i stället för att importera två gånger.
 */
let startup: Promise<Startup> | null = null;

const loadStartup = (): Promise<Startup> => {
  startup ??= (async () => {
    let plans = await withRetry(() => arbetslagService.listPlans());

    let imported: LabPlan | null = null;
    let importError: string | null = null;
    try {
      imported = await importLegacyState(plans, { storage: safeStorage, create: arbetslagService.createPlan, newId: uuidv4 });
      if (imported) plans = upsertPlan(plans, imported);
    } catch (error) {
      importError = `Kunde inte flytta över det som låg i webbläsaren: ${errorMessage(error, 'okänt fel')}. Det görs nästa gång sidan öppnas.`;
    }

    if (plans.length === 0) {
      const first = await arbetslagService.createPlan({ id: storedId(FIRST_PLAN_ID_KEY), name: DEFAULT_PLAN_NAME, state: LAB_SEED });
      plans = [toSummary(first)];
    }
    return { plans: sortPlans(plans), imported, importError };
  })().finally(() => { startup = null; });
  return startup;
};

export function useLessonLabState() {
  const [history, setHistory] = useState<UndoState<LabState>>(() => initialUndoState(LAB_SEED));
  const [plans, setPlans] = useState<LabPlanSummary[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [planError, setPlanError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved');
  const [saveError, setSaveError] = useState<string | null>(null);

  const activeIdRef = useRef<string | null>(null);
  // Läget som just lästs in. Det ska inte sparas tillbaka bara för att det visas.
  const baselineRef = useRef<LabState | null>(null);
  const plansRef = useRef(plans);
  const presentRef = useRef(history.present);
  useEffect(() => {
    plansRef.current = plans;
    presentRef.current = history.present;
  });

  /** Visar ett upplägg: nollställer historiken och kopplar sparstatusen. */
  const show = useCallback((plan: LabPlan) => {
    const state = labPlanStore.adopt(plan);
    baselineRef.current = state;
    activeIdRef.current = plan.id;
    setHistory(initialUndoState(state));
    setActiveId(plan.id);
    setPlans(current => upsertPlan(current, plan));
    setSaveStatus(labPlanStore.status(plan.id));
    setSaveError(labPlanStore.error(plan.id));
    writeStored(ACTIVE_PLAN_KEY, plan.id);
    setLoaded(true);
  }, []);

  /** Väntar in kön för upplägget, så att hämtningen aldrig kommer före en sparning. */
  const fetchAndShow = useCallback(async (id: string) => {
    await labPlanStore.flush(id);
    show(await arbetslagService.getPlan(id));
  }, [show]);

  const boot = useCallback(async (isCancelled: () => boolean) => {
    setLoadError(null);
    try {
      const { plans: list, imported, importError } = await loadStartup();
      if (isCancelled()) return;
      setPlans(list);
      if (importError) setPlanError(importError);
      const remembered = readStored(ACTIVE_PLAN_KEY, raw => (typeof raw === 'string' ? raw : null), null);
      const id = imported?.id ?? (list.some(p => p.id === remembered) ? remembered as string : list[0].id);
      await labPlanStore.flush(id);
      const plan = await arbetslagService.getPlan(id);
      if (!isCancelled()) show(plan);
    } catch (error) {
      if (!isCancelled()) setLoadError(errorMessage(error, 'Kunde inte hämta uppläggen.'));
    }
  }, [show]);

  useEffect(() => {
    let cancelled = false;
    void boot(() => cancelled);
    return () => { cancelled = true; };
  }, [boot]);

  const retryLoad = useCallback(() => { void boot(() => false); }, [boot]);

  // --- Sparning ---

  useEffect(() => {
    if (!activeId) return;
    return labPlanStore.subscribe(activeId, event => {
      setSaveStatus(event.status);
      setSaveError(event.error);
      if (event.saved) setPlans(current => upsertPlan(current, event.saved as LabPlan));
    });
  }, [activeId]);

  useEffect(() => {
    const id = activeIdRef.current;
    if (!id || history.present === baselineRef.current) return;
    // Från och med nu sparas varje läge, även ett som ångrats tillbaka till det inlästa.
    baselineRef.current = null;
    labPlanStore.schedule(id, history.present);
  }, [history.present]);

  // Byte av sida inom appen laddar inte om, så kön töms när sidan lämnas.
  // `pagehide` och en dold flik täcker det mesta av resten; beforeunload
  // nedan varnar för det som ändå kan gå förlorat.
  useEffect(() => {
    const flush = () => { void labPlanStore.flush(activeIdRef.current); };
    const onVisibility = () => { if (document.visibilityState === 'hidden') flush(); };
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('pagehide', flush);
      document.removeEventListener('visibilitychange', onVisibility);
      flush();
    };
  }, []);

  useEffect(() => {
    if (saveStatus === 'saved') return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [saveStatus]);

  // --- Uppläggen ---

  const run = useCallback(async (action: () => Promise<void>, fallback: string) => {
    setBusy(true);
    setPlanError(null);
    try {
      await action();
    } catch (error) {
      setPlanError(errorMessage(error, fallback));
    } finally {
      setBusy(false);
    }
  }, []);

  const openPlan = useCallback((id: string) => run(async () => {
    if (id === activeIdRef.current) return;
    await labPlanStore.flush(activeIdRef.current);
    await fetchAndShow(id);
  }, 'Kunde inte öppna upplägget.'), [run, fetchAndShow]);

  /** Nytt upplägg, från tavlan om inget läge ges (t.ex. från en fil). Öppnas direkt. */
  const createPlan = useCallback((name: string = NEW_PLAN_NAME, state: LabState = LAB_SEED) => run(async () => {
    assertRoom(plansRef.current);
    await labPlanStore.flush(activeIdRef.current);
    const plan = await arbetslagService.createPlan({
      id: uuidv4(),
      name: uniquePlanName(name, plansRef.current.map(p => p.name)),
      state,
    });
    show(plan);
  }, 'Kunde inte skapa upplägget.'), [run, show]);

  /** Kopia som öppnas direkt, för att pröva en variant. */
  const duplicatePlan = useCallback((id: string) => run(async () => {
    assertRoom(plansRef.current);
    await labPlanStore.flush(activeIdRef.current);
    const summary = plansRef.current.find(p => p.id === id);
    const source = id === activeIdRef.current && summary
      ? { name: summary.name, state: presentRef.current }
      : await arbetslagService.getPlan(id);
    const plan = await arbetslagService.createPlan({
      id: uuidv4(),
      name: uniquePlanName(`${source.name} (kopia)`, plansRef.current.map(p => p.name)),
      state: source.state,
    });
    show(plan);
  }, 'Kunde inte duplicera upplägget.'), [run, show]);

  const renamePlan = useCallback((id: string, name: string) => run(async () => {
    const trimmed = name.trim();
    const before = plansRef.current.find(p => p.id === id);
    if (!trimmed || !before || before.name === trimmed) return;
    setPlans(current => current.map(p => (p.id === id ? { ...p, name: trimmed } : p)));

    // Det öppna upplägget byter namn genom kön, så att versionen hålls i takt.
    if (id === activeIdRef.current) {
      await labPlanStore.rename(id, trimmed);
      return;
    }
    try {
      let saved: LabPlan;
      try {
        saved = await arbetslagService.savePlan(id, { version: before.version, name: trimmed });
      } catch (error) {
        // Bara namnet ändras, så en nyare version går bra att skriva över.
        if (!(error instanceof PlanConflictError)) throw error;
        const fresh = await arbetslagService.getPlan(id);
        saved = await arbetslagService.savePlan(id, { version: fresh.version, name: trimmed });
      }
      setPlans(current => upsertPlan(current, saved));
    } catch (error) {
      setPlans(current => current.map(p => (p.id === id ? { ...p, name: before.name } : p)));
      throw error;
    }
  }, 'Kunde inte byta namn.'), [run]);

  const deletePlan = useCallback((id: string) => run(async () => {
    // Osparat i ett upplägg som tas bort ska inte skickas.
    labPlanStore.reset(id);
    await labPlanStore.settle(id);
    await arbetslagService.deletePlan(id);
    labPlanStore.forget(id);

    const rest = plansRef.current.filter(p => p.id !== id);
    setPlans(rest);
    if (id !== activeIdRef.current) return;
    if (rest.length > 0) {
      await fetchAndShow(rest[0].id);
    } else {
      show(await arbetslagService.createPlan({ id: uuidv4(), name: DEFAULT_PLAN_NAME, state: LAB_SEED }));
    }
  }, 'Kunde inte ta bort upplägget.'), [run, show, fetchAndShow]);

  /** Efter en konflikt: glömmer det osparade och läser upplägget som det är på servern. */
  const reloadActive = useCallback(() => run(async () => {
    const id = activeIdRef.current;
    if (!id) return;
    labPlanStore.reset(id);
    await labPlanStore.settle(id);
    await fetchAndShow(id);
  }, 'Kunde inte läsa om upplägget.'), [run, fetchAndShow]);

  const retrySave = useCallback(() => {
    if (activeIdRef.current) labPlanStore.retry(activeIdRef.current);
  }, []);

  const dismissPlanError = useCallback(() => setPlanError(null), []);

  // --- Ändringar och historik ---

  /**
   * Varje ändring går genom tvätten, så att en borttagen lärare också
   * försvinner ur arbetsgrupper och klasser. Ett läge som inte går igenom
   * tvätten (borde inte hända) släpps i stället för att skriva över.
   */
  const commit = useCallback((change: (current: LabState) => LabState) => {
    setHistory(h => {
      const next = parseLabState(change(h.present));
      return next ? commitUndoState(h, next) : h;
    });
  }, []);

  const undo = useCallback(() => setHistory(undoState), []);
  const redo = useCallback(() => setHistory(redoState), []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || isEditableElement(event.target)) return;
      const key = event.key.toLowerCase();
      if (key === 'z' && !event.shiftKey) { event.preventDefault(); undo(); }
      else if ((key === 'z' && event.shiftKey) || key === 'y') { event.preventDefault(); redo(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo, redo]);

  return {
    state: history.present,
    loaded,
    commit,
    undo,
    redo,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,

    plans,
    activePlan: plans.find(p => p.id === activeId) ?? null,
    busy,
    loadError,
    retryLoad,
    planError,
    dismissPlanError,
    saveStatus,
    saveError,
    retrySave,
    reloadActive,
    openPlan,
    createPlan,
    duplicatePlan,
    renamePlan,
    deletePlan,
  };
}

export type LessonLabState = ReturnType<typeof useLessonLabState>;
