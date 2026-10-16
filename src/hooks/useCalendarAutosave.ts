'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import type { DayPatch } from '@/services/monthCalendarService';
import type { DateKey } from '@/utils/calendarDates';
import { TEXT_AUTOSAVE_DELAY_MS } from '@/config/monthCalendarConstants';
import { createCalendarSaveQueue, type SaveStatus } from '@/utils/calendarSaveQueue';

export type { SaveStatus };

interface Options {
  delay?: number;
  onSave: (key: DateKey, patch: DayPatch, keepalive?: boolean) => Promise<unknown>;
}

/**
 * Debouncad sparning per dag. Logiken bor i `createCalendarSaveQueue`.
 *
 * Svaret från en sparning kastas medvetet. Den lokala optimistiska texten är
 * sanningen tills nästa hämtning; skulle svaret skrivas tillbaka i state hade
 * ett långsamt svar för gårdagen kunnat landa i editorn för den dag användaren
 * hunnit byta till.
 */
export function useCalendarAutosave({ delay = TEXT_AUTOSAVE_DELAY_MS, onSave }: Options) {
  const [status, setStatus] = useState<SaveStatus>('idle');
  const [error, setError] = useState<string | null>(null);

  // onSave kan bytas ut mellan renderingar; kön ska alltid nå den senaste.
  const saveRef = useRef(onSave);
  saveRef.current = onSave;

  const queueRef = useRef<ReturnType<typeof createCalendarSaveQueue>>();
  queueRef.current ??= createCalendarSaveQueue({
    delay,
    onSave: (key, patch, keepalive) => saveRef.current(key, patch, keepalive),
    onStatus: (next, message) => {
      setStatus(next);
      setError(message);
    },
  });
  const q = queueRef.current;

  /** Lägg till en ändring som ska sparas efter debouncen. */
  const queue = useCallback((key: DateKey, patch: DayPatch) => q.queue(key, patch), [q]);

  /** Spara nu, utan att vänta på debouncen. Används för highlight-klick. */
  const saveNow = useCallback((key: DateKey, patch: DayPatch) => q.saveNow(key, patch), [q]);

  /** Spola allt väntande. Anropas vid dagbyte och månadsbyte. */
  const flushAll = useCallback(() => q.flushAll(), [q]);

  const retry = useCallback(() => q.flushAll(), [q]);

  const hasPending = useCallback(() => q.hasPending(), [q]);

  useEffect(() => {
    const onBeforeUnload = () => {
      if (!q.hasPending()) return;
      // keepalive låter webbläsaren slutföra anropet efter att sidan stängts.
      // Best effort — men utan det är en halvskriven anteckning garanterat
      // förlorad om användaren stänger fliken under debouncen.
      void q.flushAll({ keepalive: true, immediate: true });
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload);
      // Vid unmount finns ingen komponent kvar som kan visa ett fel, men
      // anropet ska ändå gå iväg. Sidan lever vidare, så kön får vänta in en
      // sparning i flykt i stället för att köra om den.
      void q.flushAll({ keepalive: true });
      q.dispose();
    };
  }, [q]);

  return { status, error, queue, saveNow, flushAll, retry, hasPending };
}

export default useCalendarAutosave;
