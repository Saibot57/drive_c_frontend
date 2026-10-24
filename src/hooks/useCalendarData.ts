'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import monthCalendarService, {
  emptyDay,
  type CalendarDayData,
  type CalendarSettingsData,
  type DayPatch,
  type Highlight,
  type NoteDocument,
} from '@/services/monthCalendarService';
import {
  getMatrixRange,
  getMonthMatrix,
  type DateKey,
  type DayCell,
} from '@/utils/calendarDates';
import { DEFAULT_BANDS, MIN_BANDS } from '@/config/monthCalendarConstants';
import { countTextRows, minRowsFor } from '@/utils/calendarRows';
import useCalendarAutosave from '@/hooks/useCalendarAutosave';

/**
 * Kalenderns data: månadsmatris, dagcache och sparning.
 *
 * Cachen lever över månadsbyten, så att bläddra bakåt och framåt inte kostar
 * ett nytt anrop. Den är per lokal datumnyckel, inte per månad, eftersom
 * matrisen alltid innehåller dagar från grannmånaderna.
 */
export function useCalendarData(year: number, month: number) {
  const [days, setDays] = useState<Map<DateKey, CalendarDayData>>(new Map());
  const [bandCount, setBandCount] = useState(DEFAULT_BANDS);
  // Serverns lägsta antal räknas över alla dagar, även i månader som inte
  // hämtats. Den kan vara inaktuell tills den hämtas om, se refreshBandLimits.
  const [serverMinBands, setServerMinBands] = useState(MIN_BANDS);
  const [bandError, setBandError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const cells: DayCell[] = useMemo(() => getMonthMatrix(year, month), [year, month]);
  const range = useMemo(() => getMatrixRange(cells), [cells]);

  // Månader vars intervall redan hämtats. Räcker som cachenyckel eftersom
  // matrisen för en given månad alltid är samma 42 dagar.
  const fetched = useRef(new Set<string>());
  // Dagar som ändrats i den här fliken. En hämtning får inte skriva över dem.
  //
  // Markeringen tas aldrig bort (dataintegritet F15). Förr togs den bort när en
  // sparning lyckats. En hämtning som startat före sparningen och läst servern
  // innan den gick igenom kunde då landa efter och lägga tillbaka den gamla
  // texten, även när inget mer väntade. Fliken skriver själv, så dess värde är
  // minst lika nytt som serverns. En annan enhets ändring av samma dag syns
  // därför först efter omladdning, som för månader som redan hämtats.
  const dirty = useRef(new Set<DateKey>());
  const requestId = useRef(0);

  const autosave = useCalendarAutosave({
    onSave: (key, patch, keepalive) => monthCalendarService.patchDay(key, patch, keepalive),
  });
  const flushAll = autosave.flushAll;

  // ─── Hämtning ──────────────────────────────────────────────────────────────

  useEffect(() => {
    const monthKey = `${year}-${month}`;
    if (fetched.current.has(monthKey)) {
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    const id = ++requestId.current;
    setLoading(true);
    setLoadError(null);

    monthCalendarService
      .getDays(range.start, range.end, controller.signal)
      .then((fetchedDays) => {
        // Ett svar för en månad användaren redan lämnat får inte skriva state.
        if (id !== requestId.current) return;
        setDays((prev) => {
          const next = new Map(prev);
          for (const day of fetchedDays) {
            // Skriver användaren just nu vinner det lokala värdet.
            if (dirty.current.has(day.local_date)) continue;
            next.set(day.local_date, day);
          }
          return next;
        });
        fetched.current.add(monthKey);
        setLoading(false);
      })
      .catch((e: unknown) => {
        if (controller.signal.aborted || id !== requestId.current) return;
        setLoadError(e instanceof Error ? e.message : 'Kunde inte hämta kalendern.');
        setLoading(false);
      });

    return () => controller.abort();
  }, [year, month, range.start, range.end]);

  const applySettings = useCallback((s: CalendarSettingsData) => {
    setBandCount(s.highlight_band_count);
    setServerMinBands(s.min_highlight_band_count ?? MIN_BANDS);
  }, []);

  // Inställningar hämtas en gång.
  useEffect(() => {
    const controller = new AbortController();
    monthCalendarService
      .getSettings(controller.signal)
      .then(applySettings)
      .catch(() => {
        // Faller tillbaka på default utan att störa användaren med ett
        // felmeddelande. Servern stoppar ändå ett för lågt antal.
      });
    return () => controller.abort();
  }, [applySettings]);

  // ─── Läsning ───────────────────────────────────────────────────────────────

  const getDay = useCallback(
    (key: DateKey): CalendarDayData => days.get(key) ?? emptyDay(key),
    [days],
  );

  // ─── Skrivning ─────────────────────────────────────────────────────────────

  /** Optimistisk lokal uppdatering. Servern följer efter via autosave. */
  const applyLocal = useCallback((key: DateKey, patch: DayPatch) => {
    dirty.current.add(key);
    setDays((prev) => {
      const next = new Map(prev);
      next.set(key, { ...(prev.get(key) ?? emptyDay(key)), ...patch });
      return next;
    });
  }, []);

  const setQuickText = useCallback((key: DateKey, text: string) => {
    applyLocal(key, { quick_text: text });
    autosave.queue(key, { quick_text: text });
  }, [applyLocal, autosave]);

  const setNoteDocument = useCallback((key: DateKey, doc: NoteDocument | null) => {
    applyLocal(key, { note_document: doc });
    autosave.queue(key, { note_document: doc });
  }, [applyLocal, autosave]);

  /** Highlights går förbi debouncen — ett klick ska sitta direkt. */
  const setHighlights = useCallback((key: DateKey, highlights: Highlight[]) => {
    applyLocal(key, { highlights });
    return autosave.saveNow(key, { highlights });
  }, [applyLocal, autosave]);

  // Dagar som ändrats här kan ha fler rader än servern hunnit se.
  const minBandCount = useMemo(() => {
    let used = 0;
    for (const key of Array.from(dirty.current)) {
      const day = days.get(key);
      if (day) used = Math.max(used, countTextRows(day.quick_text));
    }
    return Math.max(serverMinBands, minRowsFor(used));
  }, [days, serverMinBands]);

  /**
   * Hämtar om det lägsta antalet. Har en dag fått färre rader här, eller på en
   * annan enhet, vet bara servern om ett lägre antal går att välja nu. Väntande
   * text spolas först så att servern räknar på den.
   */
  const refreshBandLimits = useCallback(async () => {
    try {
      await flushAll();
      applySettings(await monthCalendarService.getSettings());
    } catch {
      // Gränsen i listan står kvar; servern avgör ändå vid bytet.
    }
  }, [flushAll, applySettings]);

  const changeBandCount = useCallback(async (count: number) => {
    const previous = bandCount;
    setBandCount(count); // optimistiskt
    setBandError(null);
    try {
      applySettings(await monthCalendarService.patchSettings(count));
    } catch (e) {
      setBandCount(previous);
      // Serverns 400 säger vilken dag som stoppar. Ett nätverksfel (TypeError)
      // har bara webbläsarens engelska text.
      setBandError(
        e instanceof Error && !(e instanceof TypeError)
          ? e.message
          : 'Kunde inte ändra antalet rader.',
      );
      void refreshBandLimits();
    }
  }, [bandCount, applySettings, refreshBandLimits]);

  // Väntande text spolas vid månadsbyte, så att en halvskriven cell inte
  // ligger kvar osparad medan användaren bläddrar vidare.
  useEffect(() => {
    return () => {
      void flushAll();
    };
  }, [year, month, flushAll]);

  return {
    cells,
    range,
    getDay,
    loading,
    loadError,
    bandCount,
    minBandCount,
    bandError,
    changeBandCount,
    refreshBandLimits,
    setQuickText,
    setNoteDocument,
    setHighlights,
    flushAll,
    saveStatus: autosave.status,
    saveError: autosave.error,
    retrySave: autosave.retry,
  };
}

export default useCalendarData;
