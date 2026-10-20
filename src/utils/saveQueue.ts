/**
 * Debouncad sparning av hela värden, per nyckel. Ren logik; hooken som
 * använder den speglar händelserna i React-state.
 *
 * Följer labPlanStore: bara det senaste värdet hålls, och varje nyckel har
 * högst ett anrop i flykt. Det som ändras under tiden skickas efteråt. Två
 * anrop för samma nyckel i flykt samtidigt låter servern avgöra ordningen,
 * och det äldre kan landa sist (dataintegritet F12).
 *
 * Värdena skickas hela, inte som patchar som i calendarSaveQueue, så ett
 * nyare värde ersätter ett äldre helt.
 */

export type SaveQueueStatus = 'saved' | 'pending' | 'saving' | 'error';

export type SaveQueueEvent<R> = {
  key: string;
  status: SaveQueueStatus;
  error: unknown;
  /** Serverns svar när en sparning just lyckats. */
  saved?: R;
};

export type SaveQueueOptions<T, R> = {
  /** Fördröjningen när `schedule` inte anger någon egen. */
  delayMs: number;
  save: (key: string, value: T, options: { keepalive: boolean }) => Promise<R>;
  onEvent: (event: SaveQueueEvent<R>) => void;
  /**
   * Om ett värde som inte kom fram ska ligga kvar och skickas igen. Svarar
   * den nej, till exempel för ett fel som inte går över, släpps bara det
   * värdet; ett nyare som väntar bakom det skickas som vanligt.
   */
  retainOnError?: (error: unknown) => boolean;
};

export type FlushResult = { ok: true } | { ok: false; error: unknown };

type Entry<T> = {
  /** Det som ska sparas. `undefined` när inget väntar. */
  pending: T | undefined;
  hasPending: boolean;
  inFlight: Promise<void> | null;
  timer: ReturnType<typeof setTimeout> | null;
  status: SaveQueueStatus;
  error: unknown;
};

export function createSaveQueue<T, R>({
  delayMs,
  save,
  onEvent,
  retainOnError = () => true,
}: SaveQueueOptions<T, R>) {
  const entries = new Map<string, Entry<T>>();

  const entry = (key: string): Entry<T> => {
    let e = entries.get(key);
    if (!e) {
      e = { pending: undefined, hasPending: false, inFlight: null, timer: null, status: 'saved', error: null };
      entries.set(key, e);
    }
    return e;
  };

  const emit = (key: string, e: Entry<T>, status: SaveQueueStatus, error: unknown = null, saved?: R) => {
    e.status = status;
    e.error = error;
    onEvent({ key, status, error, saved });
  };

  const clearTimer = (e: Entry<T>) => {
    if (e.timer) clearTimeout(e.timer);
    e.timer = null;
  };

  const take = (e: Entry<T>): T => {
    const value = e.pending as T;
    e.pending = undefined;
    e.hasPending = false;
    return value;
  };

  /** Skickar det som väntar, om inget annat anrop är i flykt. */
  const pump = (key: string, keepalive = false): Promise<void> => {
    const e = entries.get(key);
    if (!e) return Promise.resolve();
    if (e.inFlight) return e.inFlight;
    if (!e.hasPending) return Promise.resolve();

    const value = take(e);
    emit(key, e, 'saving');

    e.inFlight = save(key, value, { keepalive }).then(
      saved => {
        e.inFlight = null;
        if (entries.get(key) !== e) return;
        if (!e.hasPending) {
          emit(key, e, 'saved', null, saved);
          return;
        }
        emit(key, e, 'pending', null, saved);
        // Väntar en debounce-timer får den skicka; annars direkt.
        if (!e.timer) return pump(key, keepalive);
      },
      error => {
        e.inFlight = null;
        if (entries.get(key) !== e) return;
        // Det som inte kom fram läggs tillbaka, om inget nyare har kommit.
        if (!e.hasPending && retainOnError(error)) {
          e.pending = value;
          e.hasPending = true;
        }
        emit(key, e, 'error', error);
      },
    );
    return e.inFlight;
  };

  /**
   * Skickar det som väntar för nyckeln nu och väntar in kön. Klart när inget
   * väntar, eller när en sparning misslyckats.
   */
  const flush = async (key: string, { keepalive = false } = {}): Promise<FlushResult> => {
    const e = entries.get(key);
    if (!e) return { ok: true };
    clearTimer(e);
    // Första försöket görs även efter ett tidigare fel.
    await pump(key, keepalive);
    while (e.status !== 'error' && (e.inFlight || e.hasPending)) {
      clearTimer(e);
      await pump(key, keepalive);
    }
    return e.status === 'error' ? { ok: false, error: e.error } : { ok: true };
  };

  return {
    /** Nytt värde. Skickas när det varit stilla i `delay` (standard `delayMs`). */
    schedule(key: string, value: T, delay = delayMs) {
      const e = entry(key);
      e.pending = value;
      e.hasPending = true;
      clearTimer(e);
      e.timer = setTimeout(() => {
        e.timer = null;
        void pump(key);
      }, delay);
      if (!e.inFlight) emit(key, e, 'pending');
    },

    flush,

    /**
     * Spolar allt som väntar. `immediate` används bara när sidan stängs. Då
     * hinner ingen kö vänta in ett anrop i flykt, så det väntande skickas
     * direkt bredvid – hellre en liten risk att ordningen kastas om än att
     * ändringen säkert försvinner. Samma avvägning som i calendarSaveQueue.
     */
    async flushAll({ keepalive = false, immediate = false } = {}): Promise<void> {
      const keys = Array.from(entries.keys());
      if (!immediate) {
        await Promise.all(keys.map(key => flush(key, { keepalive })));
        return;
      }
      keys.forEach(key => {
        const e = entries.get(key);
        if (!e) return;
        clearTimer(e);
        if (!e.hasPending) return;
        if (!e.inFlight) {
          void pump(key, keepalive);
          return;
        }
        void save(key, take(e), { keepalive }).catch(() => undefined);
      });
    },

    /** Glömmer nyckeln, till exempel när hjulet tagits bort. Ett svar i flykt ignoreras. */
    forget(key: string) {
      const e = entries.get(key);
      if (!e) return;
      clearTimer(e);
      entries.delete(key);
    },

    /** Inget väntar och inget är i flykt för nyckeln. */
    isIdle(key: string): boolean {
      const e = entries.get(key);
      return !e || (!e.hasPending && !e.inFlight);
    },

    /** Något väntar, är i flykt eller misslyckades, för någon nyckel. */
    hasUnsaved(): boolean {
      return Array.from(entries.values()).some(e => e.hasPending || e.inFlight || e.status === 'error');
    },

    status(key: string): SaveQueueStatus {
      return entries.get(key)?.status ?? 'saved';
    },

    /** Stoppar timrarna. Det som väntar ligger kvar. */
    dispose() {
      entries.forEach(e => clearTimer(e));
    },
  };
}

export type SaveQueue<T, R> = ReturnType<typeof createSaveQueue<T, R>>;
