import type { DayPatch } from '@/services/monthCalendarService';
import type { DateKey } from '@/utils/calendarDates';

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export type SaveQueueOptions = {
  delay: number;
  onSave: (key: DateKey, patch: DayPatch, keepalive?: boolean) => Promise<unknown>;
  onStatus: (status: SaveStatus, error: string | null) => void;
};

/**
 * Debouncad sparning per dag, som ren logik. useCalendarAutosave håller en
 * instans och speglar statusen i React-state.
 *
 * Väntande ändringar hålls som en patch per datum, inte som en kö. Skriver
 * användaren tre bokstäver och byter färg på ett band blir det en enda PATCH
 * med bägge fälten, och eftersom servern bara rör medskickade fält kan de två
 * aldrig skriva över varandra.
 *
 * Varje dag har högst en sparning i flykt. Det som skrivs under tiden väntar
 * och skickas sammanslaget när den förra är klar. Annars kunde en äldre
 * sparning landa efter en nyare, eller misslyckas efter att en nyare lyckats
 * och då läggas tillbaka i kön och skickas sist – servern fick "abc" fast
 * användaren skrivit "abcd".
 */
export function createCalendarSaveQueue({ delay, onSave, onStatus }: SaveQueueOptions) {
  const pending = new Map<DateKey, DayPatch>();
  const timers = new Map<DateKey, ReturnType<typeof setTimeout>>();
  // Sparningarna för en dag, kedjade efter varandra.
  const chains = new Map<DateKey, Promise<void>>();
  let inFlight = 0;

  const clearTimer = (key: DateKey) => {
    const t = timers.get(key);
    if (t) {
      clearTimeout(t);
      timers.delete(key);
    }
  };

  /** Skickar det som väntar för dagen just nu. Kastar aldrig. */
  const sendOnce = async (key: DateKey, keepalive: boolean) => {
    const patch = pending.get(key);
    if (!patch) return;

    // Tas bort optimistiskt. Vid fel läggs den tillbaka nedan, sammanslagen
    // med det som skrivits under tiden.
    pending.delete(key);
    clearTimer(key);

    inFlight += 1;
    onStatus('saving', null);
    try {
      await onSave(key, patch, keepalive);
      if (inFlight === 1 && pending.size === 0) onStatus('saved', null);
    } catch (e) {
      // Ändringen får inte gå förlorad – den läggs tillbaka så att retry eller
      // nästa tangenttryck skickar den igen. Nyare värden vinner. Inget nyare
      // kan ha skickats för dagen under tiden, eftersom dagen väntade på den
      // här sparningen.
      pending.set(key, { ...patch, ...(pending.get(key) ?? {}) });
      onStatus('error', e instanceof Error ? e.message : 'Kunde inte spara.');
    } finally {
      inFlight -= 1;
    }
  };

  /**
   * Skickar dagens väntande ändring när en eventuell tidigare sparning för
   * samma dag är klar. `immediate` går förbi kön; se `flushAll`.
   */
  const send = (key: DateKey, { keepalive = false, immediate = false } = {}): Promise<void> => {
    clearTimer(key);
    if (immediate) return sendOnce(key, keepalive);

    const next = (chains.get(key) ?? Promise.resolve()).then(() => sendOnce(key, keepalive));
    chains.set(key, next);
    void next.then(() => {
      if (chains.get(key) === next) chains.delete(key);
    });
    return next;
  };

  /** Lägg till en ändring som ska sparas efter debouncen. */
  const queue = (key: DateKey, patch: DayPatch) => {
    pending.set(key, { ...pending.get(key), ...patch });
    onStatus('saving', null);
    clearTimer(key);
    timers.set(key, setTimeout(() => void send(key), delay));
  };

  /** Spara nu, utan att vänta på debouncen. Används för highlight-klick. */
  const saveNow = (key: DateKey, patch: DayPatch) => {
    pending.set(key, { ...pending.get(key), ...patch });
    return send(key);
  };

  /**
   * Spolar allt väntande. Anropas vid dagbyte, månadsbyte och unmount.
   *
   * `immediate` används bara när sidan stängs. Då hinner ingen kö vänta in en
   * sparning i flykt, så det väntande skickas direkt med keepalive – hellre
   * en liten risk att ordningen kastas om än att texten säkert försvinner.
   */
  const flushAll = ({ keepalive = false, immediate = false } = {}) => {
    const keys = Array.from(pending.keys());
    return Promise.all(keys.map((k) => send(k, { keepalive, immediate }))).then(() => undefined);
  };

  const dispose = () => {
    timers.forEach((t) => clearTimeout(t));
    timers.clear();
  };

  return {
    queue,
    saveNow,
    flushAll,
    dispose,
    hasPending: () => pending.size > 0,
  };
}
