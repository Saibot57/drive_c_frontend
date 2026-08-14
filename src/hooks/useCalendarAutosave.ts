'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import type { DayPatch } from '@/services/monthCalendarService';
import type { DateKey } from '@/utils/calendarDates';
import { TEXT_AUTOSAVE_DELAY_MS } from '@/components/month-calendar/constants';

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

interface Options {
  delay?: number;
  onSave: (key: DateKey, patch: DayPatch, keepalive?: boolean) => Promise<unknown>;
}

/**
 * Debouncad sparning per dag.
 *
 * Väntande ändringar hålls som en patch per datum, inte som en kö. Skriver
 * användaren tre bokstäver och byter färg på ett band blir det en enda PATCH
 * med bägge fälten — och eftersom servern bara rör medskickade fält kan de två
 * aldrig skriva över varandra.
 *
 * Svaret från en sparning kastas medvetet. Den lokala optimistiska texten är
 * sanningen tills nästa hämtning; skulle svaret skrivas tillbaka i state hade
 * ett långsamt svar för gårdagen kunnat landa i editorn för den dag användaren
 * hunnit byta till.
 */
export function useCalendarAutosave({ delay = TEXT_AUTOSAVE_DELAY_MS, onSave }: Options) {
  const [status, setStatus] = useState<SaveStatus>('idle');
  const [error, setError] = useState<string | null>(null);

  const pending = useRef(new Map<DateKey, DayPatch>());
  const timers = useRef(new Map<DateKey, ReturnType<typeof setTimeout>>());
  const inFlight = useRef(0);
  // onSave kan bytas ut mellan renderingar; timers ska alltid nå den senaste.
  const saveRef = useRef(onSave);
  saveRef.current = onSave;

  const clearTimer = useCallback((key: DateKey) => {
    const t = timers.current.get(key);
    if (t) {
      clearTimeout(t);
      timers.current.delete(key);
    }
  }, []);

  const send = useCallback(async (key: DateKey, keepalive = false) => {
    const patch = pending.current.get(key);
    if (!patch) return;

    // Tas bort optimistiskt. Vid fel läggs den tillbaka nedan, sammanslagen
    // med det som eventuellt skrivits under tiden.
    pending.current.delete(key);
    clearTimer(key);

    inFlight.current += 1;
    setStatus('saving');
    try {
      await saveRef.current(key, patch, keepalive);
      if (inFlight.current === 1 && pending.current.size === 0) {
        setStatus('saved');
        setError(null);
      }
    } catch (e) {
      // Ändringen får inte gå förlorad — den läggs tillbaka så att retry (eller
      // nästa tangenttryck) skickar den igen. Nyare värden vinner.
      const newer = pending.current.get(key);
      pending.current.set(key, { ...patch, ...(newer ?? {}) });
      setStatus('error');
      setError(e instanceof Error ? e.message : 'Kunde inte spara.');
    } finally {
      inFlight.current -= 1;
    }
  }, [clearTimer]);

  /** Lägg till en ändring som ska sparas efter debouncen. */
  const queue = useCallback((key: DateKey, patch: DayPatch) => {
    pending.current.set(key, { ...pending.current.get(key), ...patch });
    setStatus('saving');
    setError(null);
    clearTimer(key);
    timers.current.set(key, setTimeout(() => void send(key), delay));
  }, [clearTimer, delay, send]);

  /** Spara nu, utan att vänta på debouncen. Används för highlight-klick. */
  const saveNow = useCallback((key: DateKey, patch: DayPatch) => {
    pending.current.set(key, { ...pending.current.get(key), ...patch });
    return send(key);
  }, [send]);

  /** Spola allt väntande. Anropas vid dagbyte, månadsbyte och unmount. */
  const flushAll = useCallback((keepalive = false) => {
    const keys = Array.from(pending.current.keys());
    return Promise.all(keys.map((k) => send(k, keepalive)));
  }, [send]);

  const retry = useCallback(() => flushAll(), [flushAll]);

  const hasPending = useCallback(() => pending.current.size > 0, []);

  useEffect(() => {
    // Refarna skapas en gång och byts aldrig ut, men de fångas i lokala
    // variabler så att cleanup läser samma Map som effekten satte upp.
    const timerMap = timers.current;
    const pendingMap = pending.current;

    const onBeforeUnload = () => {
      if (pendingMap.size === 0) return;
      // keepalive låter webbläsaren slutföra anropet efter att sidan stängts.
      // Best effort — men utan det är en halvskriven anteckning garanterat
      // förlorad om användaren stänger fliken under debouncen.
      void flushAll(true);
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload);
      // Vid unmount finns ingen komponent kvar som kan visa ett fel, men
      // anropet ska ändå gå iväg.
      void flushAll(true);
      timerMap.forEach((t) => clearTimeout(t));
      timerMap.clear();
    };
    // Avsiktligt bara flushAll: effekten ska leva hela hookens liv.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { status, error, queue, saveNow, flushAll, retry, hasPending };
}

export default useCalendarAutosave;
