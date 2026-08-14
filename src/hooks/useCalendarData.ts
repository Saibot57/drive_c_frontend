'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import monthCalendarService, {
  emptyDay,
  type CalendarDayData,
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
import { DEFAULT_BANDS } from '@/components/month-calendar/constants';
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
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const cells: DayCell[] = useMemo(() => getMonthMatrix(year, month), [year, month]);
  const range = useMemo(() => getMatrixRange(cells), [cells]);

  // Månader vars intervall redan hämtats. Räcker som cachenyckel eftersom
  // matrisen för en given månad alltid är samma 42 dagar.
  const fetched = useRef(new Set<string>());
  // Dagar med lokala ändringar som inte får skrivas över av ett svar som var
  // på väg när användaren skrev.
  const dirty = useRef(new Set<DateKey>());
  const requestId = useRef(0);

  const autosave = useCalendarAutosave({
    onSave: async (key, patch, keepalive) => {
      const result = await monthCalendarService.patchDay(key, patch, keepalive);
      dirty.current.delete(key);
      return result;
    },
  });

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

  // Inställningar hämtas en gång.
  useEffect(() => {
    const controller = new AbortController();
    monthCalendarService
      .getSettings(controller.signal)
      .then((s) => setBandCount(s.highlight_band_count))
      .catch(() => {
        // Bandantalet är kosmetiskt — faller tillbaka på default utan att
        // störa användaren med ett felmeddelande.
      });
    return () => controller.abort();
  }, []);

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

  const changeBandCount = useCallback(async (count: number) => {
    const previous = bandCount;
    setBandCount(count); // optimistiskt
    try {
      await monthCalendarService.patchSettings(count);
    } catch {
      setBandCount(previous);
    }
  }, [bandCount]);

  // Väntande text spolas vid månadsbyte, så att en halvskriven cell inte
  // ligger kvar osparad medan användaren bläddrar vidare.
  const flushAll = autosave.flushAll;
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
    changeBandCount,
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
