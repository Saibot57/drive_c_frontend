'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Cloud, CloudOff, Loader2, Plus, RefreshCw, Settings, Wand2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FeatureNavigation } from '@/components/FeatureNavigation';
import { NewTermDialog, TermMeta, TermSettingsDialog } from '@/components/term-planner/TermDialogs';
import { TermStatsTable } from '@/components/term-planner/TermStatsTable';
import { TermWeekGrid, WeekState } from '@/components/term-planner/TermWeekGrid';
import { plannerService } from '@/services/plannerService';
import { termService } from '@/services/termService';
import type { PlannerActivity, PlannerArchiveSummary } from '@/types/schedule';
import type { Term, TermSummary, TermWeek } from '@/types/term';
import { buildWheelWeeks } from '@/utils/themeWheelWeeks';
import {
  buildTermStats,
  CountedWeek,
  fillSuggestedArchives,
  resizeTermWeeks,
  termThemes,
} from '@/utils/termPlanner';
import '@/styles/schedule-theme.css';

/**
 * Terminsplaneraren: terminens veckor, vilket veckoschema som gäller varje
 * vecka, och lärarnas timmar per klass över terminen.
 *
 * Veckoschemana läses från planerarens arkiv varje gång sidan laddas (eller
 * vid "Uppdatera"), så statistiken följer med när ett schema ändras.
 *
 * Sidan är olistad: den nås bara med Ctrl+Alt+Shift+T (se FeatureNavigation).
 */

const LAST_TERM_KEY = 'termPlanner.lastTermId';
const SAVE_DELAY_MS = 800;

type SaveStatus = 'saved' | 'pending' | 'saving' | 'error';
type CacheEntry =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'loaded'; activities: PlannerActivity[] };

const readLastTermId = () => {
  try { return window.localStorage.getItem(LAST_TERM_KEY); } catch { return null; }
};
const writeLastTermId = (id: string) => {
  try { window.localStorage.setItem(LAST_TERM_KEY, id); } catch { /* bara en bekvämlighet */ }
};

export default function TermPlanner() {
  const [terms, setTerms] = useState<TermSummary[]>([]);
  const [term, setTerm] = useState<Term | null>(null);
  const [loadStatus, setLoadStatus] = useState<'loading' | 'loaded' | 'error'>('loading');
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved');
  const [archives, setArchives] = useState<PlannerArchiveSummary[] | null>(null);
  const [cache, setCache] = useState<Record<string, CacheEntry>>({});
  const [notice, setNotice] = useState<string | null>(null);
  const [newTermOpen, setNewTermOpen] = useState(false);
  const [settingsFor, setSettingsFor] = useState<TermMeta | null>(null);
  const [themeFilter, setThemeFilter] = useState('');

  // --- Laddning ---

  const loadArchives = useCallback(async () => {
    try {
      setArchives(await plannerService.listArchives());
    } catch {
      setArchives([]);
      setNotice('Kunde inte hämta scheman från planeraren.');
    }
  }, []);

  const openTerm = useCallback(async (id: string) => {
    try {
      const loaded = await termService.getTerm(id);
      setTerm(loaded);
      setSaveStatus('saved');
      setThemeFilter('');
      writeLastTermId(id);
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'Kunde inte hämta terminen.');
    }
  }, []);

  useEffect(() => {
    void loadArchives();
    termService.listTerms()
      .then(async list => {
        setTerms(list);
        const lastId = readLastTermId();
        const initial = list.find(t => t.id === lastId) ?? list[0];
        if (initial) await openTerm(initial.id);
        setLoadStatus('loaded');
      })
      .catch(() => setLoadStatus('error'));
  }, [loadArchives, openTerm]);

  // --- Sparning ---
  //
  // Varje ändring skjuter upp sparningen en stund, så att en rad tangenttryck
  // i temafältet blir ett anrop. Versionsräknaren avgör om det som sparades
  // fortfarande är det senaste, eller om en ny ändring hunnit komma.

  const version = useRef(0);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scheduleSave = useCallback((next: Term) => {
    version.current += 1;
    const savingVersion = version.current;
    setSaveStatus('pending');
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      setSaveStatus('saving');
      try {
        const saved = await termService.updateTerm(next);
        setTerms(list => list.map(t => (t.id === saved.id
          ? { ...t, name: saved.name, startWeek: saved.startWeek, startYear: saved.startYear, weekCount: saved.weeks.length }
          : t)));
        if (version.current === savingVersion) setSaveStatus('saved');
      } catch (e) {
        if (version.current === savingVersion) setSaveStatus('error');
        setNotice(e instanceof Error ? e.message : 'Kunde inte spara terminen.');
      }
    }, SAVE_DELAY_MS);
  }, []);

  useEffect(() => () => { if (saveTimer.current) clearTimeout(saveTimer.current); }, []);

  useEffect(() => {
    if (saveStatus === 'saved') return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [saveStatus]);

  // Senaste terminen utanför React-state, så att en ändring kan räknas fram
  // och schemaläggas för sparning utan sidoeffekter i en state-uppdaterare.
  const termRef = useRef<Term | null>(null);
  termRef.current = term;

  const updateTerm = useCallback((change: (current: Term) => Term) => {
    const current = termRef.current;
    if (!current) return;
    const next = change(current);
    termRef.current = next;
    setTerm(next);
    scheduleSave(next);
  }, [scheduleSave]);

  // --- Veckor ---

  const calendarWeeks = useMemo(
    () => (term ? buildWheelWeeks(term.startWeek, term.startYear, term.weeks.length) : []),
    [term]
  );

  const changeWeek = useCallback((index: number, changes: Partial<TermWeek>) => {
    updateTerm(current => ({
      ...current,
      weeks: current.weeks.map((week, i) => (i === index ? { ...week, ...changes } : week)),
    }));
  }, [updateTerm]);

  const suggestArchives = () => {
    if (!archives) return;
    updateTerm(current => ({
      ...current,
      weeks: fillSuggestedArchives(current.weeks, calendarWeeks.map(w => w.week), archives),
    }));
  };

  // --- Veckoscheman ---

  const archiveIds = useMemo(() => new Set((archives ?? []).map(a => a.id)), [archives]);

  const neededIds = useMemo(() => {
    if (!term || !archives) return [];
    const ids = term.weeks
      .filter(week => !week.holiday && week.archiveId && archiveIds.has(week.archiveId))
      .map(week => week.archiveId as string);
    return Array.from(new Set(ids));
  }, [term, archives, archiveIds]);

  useEffect(() => {
    const missing = neededIds.filter(id => !cache[id]);
    if (missing.length === 0) return;
    setCache(current => {
      const next = { ...current };
      missing.forEach(id => { next[id] = { status: 'loading' }; });
      return next;
    });
    missing.forEach(id => {
      plannerService.getArchiveActivities(id)
        .then(result => setCache(current => ({ ...current, [id]: { status: 'loaded', activities: result.activities } })))
        .catch(() => setCache(current => ({ ...current, [id]: { status: 'error' } })));
    });
  }, [neededIds, cache]);

  const refresh = () => {
    setCache({});
    void loadArchives();
  };

  const weekStates: WeekState[] = useMemo(() => (term?.weeks ?? []).map(week => {
    if (week.holiday) return { kind: 'holiday' };
    if (!week.archiveId) return { kind: 'empty' };
    if (!archives) return { kind: 'loading' };
    if (!archiveIds.has(week.archiveId)) return { kind: 'missing' };
    const entry = cache[week.archiveId];
    if (!entry || entry.status === 'loading') return { kind: 'loading' };
    if (entry.status === 'error') return { kind: 'error' };
    return { kind: 'ready', passCount: entry.activities.length };
  }), [term, archives, archiveIds, cache]);

  // --- Statistik ---

  const themesByWeek = useMemo(() => (term?.weeks ?? []).map(week => week.theme.trim()), [term]);
  const themes = useMemo(() => termThemes(term?.weeks ?? []), [term]);

  const inScope = useCallback(
    (index: number) => !themeFilter || themesByWeek[index] === themeFilter,
    [themeFilter, themesByWeek]
  );

  const countedWeeks: CountedWeek[] = useMemo(() => {
    if (!term) return [];
    return term.weeks.flatMap((week, index) => {
      const state = weekStates[index];
      const entry = week.archiveId ? cache[week.archiveId] : undefined;
      if (state?.kind !== 'ready' || entry?.status !== 'loaded' || !inScope(index)) return [];
      return [{ index, activities: entry.activities }];
    });
  }, [term, weekStates, cache, inScope]);

  const stats = useMemo(() => buildTermStats(countedWeeks), [countedWeeks]);

  const scopeSummary = useMemo(() => {
    const scoped = weekStates.map((state, index) => ({ state, index })).filter(({ index }) => inScope(index));
    const count = (kind: WeekState['kind']) => scoped.filter(({ state }) => state.kind === kind).length;
    return {
      counted: count('ready'),
      holidays: count('holiday'),
      loading: count('loading'),
      uncounted: scoped
        .filter(({ state }) => state.kind === 'empty' || state.kind === 'missing' || state.kind === 'error')
        .map(({ index }) => calendarWeeks[index]?.label)
        .filter(Boolean) as string[],
    };
  }, [weekStates, inScope, calendarWeeks]);

  // --- Termin: skapa, ändra, radera ---

  const createTerm = async (meta: TermMeta, wheelWeeks: TermWeek[] | null) => {
    const weeks = resizeTermWeeks(wheelWeeks ?? [], meta.weekCount);
    const calendar = buildWheelWeeks(meta.startWeek, meta.startYear, meta.weekCount).map(w => w.week);
    const created = await termService.createTerm({
      name: meta.name.trim(),
      startWeek: meta.startWeek,
      startYear: meta.startYear,
      weeks: archives ? fillSuggestedArchives(weeks, calendar, archives) : weeks,
    });
    setTerms(list => [
      { id: created.id, name: created.name, startWeek: created.startWeek, startYear: created.startYear, weekCount: created.weeks.length, updatedAt: null },
      ...list,
    ]);
    setTerm(created);
    setSaveStatus('saved');
    setThemeFilter('');
    writeLastTermId(created.id);
  };

  const saveSettings = (meta: TermMeta) => {
    updateTerm(current => ({
      ...current,
      name: meta.name.trim(),
      startWeek: meta.startWeek,
      startYear: meta.startYear,
      weeks: resizeTermWeeks(current.weeks, meta.weekCount),
    }));
  };

  const deleteTerm = async () => {
    if (!term) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    try {
      await termService.deleteTerm(term.id);
      const remaining = terms.filter(t => t.id !== term.id);
      setTerms(remaining);
      setTerm(null);
      setSaveStatus('saved');
      if (remaining[0]) await openTerm(remaining[0].id);
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'Kunde inte ta bort terminen.');
    }
  };

  // --- Render ---

  return (
    <div className="sp-root">
      <div className="fixed inset-0 z-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/bakgrund59.png" alt="" className="h-full w-full object-cover" />
      </div>

      <div className="relative z-10 pb-20">
        <div className="sp-toolbar mb-6 flex flex-col items-start gap-4 p-4 lg:flex-row lg:items-center">
          <FeatureNavigation />

          <div className="flex flex-wrap items-center gap-2 lg:ml-auto">
            {term && (
              <span className="flex items-center gap-1.5 text-xs font-semibold text-gray-500">
                {saveStatus === 'saving' && <Loader2 size={14} className="animate-spin" />}
                {saveStatus === 'error' && <CloudOff size={14} className="text-rose-600" />}
                {(saveStatus === 'saved' || saveStatus === 'pending') && <Cloud size={14} />}
                {saveStatus === 'saving' ? 'Sparar…' : saveStatus === 'error' ? 'Ej sparat' : saveStatus === 'pending' ? 'Ändrat' : 'Sparat'}
              </span>
            )}
            {terms.length > 0 && (
              <select
                className="sp-input h-10 rounded-md bg-white px-3 text-sm font-semibold"
                value={term?.id ?? ''}
                onChange={event => { void openTerm(event.target.value); }}
                disabled={saveStatus !== 'saved' && saveStatus !== 'error'}
                aria-label="Välj termin"
              >
                {!term && <option value="">Välj termin</option>}
                {terms.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            )}
            {term && (
              <Button
                variant="neutral"
                className="sp-btn"
                onClick={() => setSettingsFor({
                  name: term.name,
                  startWeek: term.startWeek,
                  startYear: term.startYear,
                  weekCount: term.weeks.length,
                })}
              >
                <Settings size={16} className="mr-2" /> v.{term.startWeek} · {term.weeks.length} v
              </Button>
            )}
            <Button variant="neutral" className="sp-btn" onClick={refresh} title="Läs om scheman från planeraren">
              <RefreshCw size={16} className="mr-2" /> Uppdatera
            </Button>
            <Button variant="neutral" className="sp-btn bg-amber-100 hover:bg-amber-200" onClick={() => setNewTermOpen(true)}>
              <Plus size={16} className="mr-2" /> Ny termin
            </Button>
          </div>
        </div>

        {notice && (
          <div className="sp-toast mb-4 flex items-center justify-between gap-4 bg-rose-50 px-4 py-2 text-sm">
            <span>{notice}</span>
            <button type="button" className="text-xs font-semibold underline" onClick={() => setNotice(null)}>Stäng</button>
          </div>
        )}

        {loadStatus === 'loading' && (
          <div className="sp-card p-6 text-sm text-gray-500">Laddar…</div>
        )}
        {loadStatus === 'error' && (
          <div className="sp-card p-6 text-sm text-rose-700">Kunde inte hämta terminerna.</div>
        )}
        {loadStatus === 'loaded' && !term && (
          <div className="sp-card p-6">
            <h2 className="mb-2 font-bold">Terminsplaneraren</h2>
            <p className="mb-4 text-sm text-gray-600">
              Lägg upp terminens veckor, markera lov och teman, och välj vilket veckoschema som gäller.
              Då räknas lärarnas timmar per klass ihop för hela terminen.
            </p>
            <Button onClick={() => setNewTermOpen(true)}><Plus size={16} className="mr-2" /> Ny termin</Button>
          </div>
        )}

        {term && (
          <div className="flex flex-col gap-6 2xl:flex-row 2xl:items-start">
            <div className="sp-card shrink-0 2xl:w-[640px]">
              <div className="flex items-center justify-between gap-2 border-b-2 border-black px-4 py-3">
                <h2 className="font-bold">{term.name} · veckor</h2>
                <Button
                  variant="neutral"
                  size="sm"
                  className="sp-btn"
                  onClick={suggestArchives}
                  disabled={!archives}
                  title='Lägg in scheman som heter t.ex. "v.35" på veckor som saknar schema'
                >
                  <Wand2 size={14} className="mr-1.5" /> Föreslå scheman
                </Button>
              </div>
              <div className="p-2">
                <TermWeekGrid
                  weeks={term.weeks}
                  calendarWeeks={calendarWeeks}
                  states={weekStates}
                  archives={archives ?? []}
                  onChangeWeek={changeWeek}
                />
              </div>
            </div>

            <div className="sp-card min-w-0 flex-1">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b-2 border-black px-4 py-3">
                <h2 className="font-bold">Lärartimmar</h2>
                <select
                  className="sp-input h-9 rounded-md bg-white px-3 text-sm"
                  value={themeFilter}
                  onChange={event => setThemeFilter(event.target.value)}
                  aria-label="Visa tema"
                >
                  <option value="">Hela terminen</option>
                  {themes.map(theme => <option key={theme} value={theme}>{theme}</option>)}
                </select>
              </div>
              <div className="border-b border-gray-100 px-4 py-2 text-xs text-gray-600">
                Timmar, räknat ur {scopeSummary.counted} {scopeSummary.counted === 1 ? 'vecka' : 'veckor'}
                {scopeSummary.holidays > 0 && ` · ${scopeSummary.holidays} lov`}
                {scopeSummary.loading > 0 && ` · ${scopeSummary.loading} laddas`}
                {scopeSummary.uncounted.length > 0 && (
                  <span className="text-amber-700"> · utan schema: {scopeSummary.uncounted.join(', ')}</span>
                )}
                <div className="mt-1 text-gray-400">
                  Pass med &quot;alla&quot; som lärare räknas inte. Samtidiga pass räknas en gång i Totalt.
                  Klicka på en lärare för vecka för vecka.
                </div>
              </div>
              <div className="p-2">
                <TermStatsTable stats={stats} calendarWeeks={calendarWeeks} themes={themesByWeek} />
              </div>
            </div>
          </div>
        )}
      </div>

      <NewTermDialog open={newTermOpen} onClose={() => setNewTermOpen(false)} onCreate={createTerm} />
      <TermSettingsDialog
        initial={settingsFor}
        onClose={() => setSettingsFor(null)}
        onSave={saveSettings}
        onDelete={deleteTerm}
      />
    </div>
  );
}
