import type { LabPlan, LabState } from '@/types/lessonLab';
import type { SavePlanBody } from '@/services/arbetslagService';
import { PlanConflictError } from '@/services/arbetslagService';

/**
 * Sparkön för Arbetslags upplägg. Den ligger på modulnivå och inte i en hook,
 * eftersom den ska överleva sidbyten inom appen.
 *
 * Den enkla vyn och detaljplanen länkar till varandra med `next/link`, och
 * menyn byter sida med `router.push`. Inget av det laddar om sidan, så
 * `beforeunload` körs aldrig. Sidan som lämnas tömmer kön när den avmonteras,
 * och sidan som öppnas väntar in kön (`flush`) innan den hämtar upplägget.
 * Annars kunde hämtningen komma före sparningen och ge en gammal version,
 * och nästa sparning skulle få 409 mot användaren själv.
 *
 * Servern räknar upp versionen vid varje sparning, så bara ett anrop per
 * upplägg är i flykt åt gången. Det som ändras under tiden skickas efteråt
 * med versionen från svaret.
 */

export type SaveStatus = 'saved' | 'pending' | 'saving' | 'error' | 'conflict';

export type SaveEvent = {
  status: SaveStatus;
  error: string | null;
  /** Serverns svar när en sparning just lyckats. */
  saved?: LabPlan;
};

type Listener = (event: SaveEvent) => void;

type Entry = {
  version: number;
  pendingState: LabState | null;
  pendingName: string | null;
  inFlight: Promise<void> | null;
  timer: ReturnType<typeof setTimeout> | null;
  status: SaveStatus;
  error: string | null;
  listeners: Set<Listener>;
};

export const SAVE_DELAY_MS = 800;

export type PlanStoreOptions = {
  save: (id: string, body: SavePlanBody) => Promise<LabPlan>;
  delayMs?: number;
};

export function createPlanStore({ save, delayMs = SAVE_DELAY_MS }: PlanStoreOptions) {
  const entries = new Map<string, Entry>();

  const entry = (id: string): Entry => {
    let e = entries.get(id);
    if (!e) {
      e = {
        version: 0,
        pendingState: null,
        pendingName: null,
        inFlight: null,
        timer: null,
        status: 'saved',
        error: null,
        listeners: new Set(),
      };
      entries.set(id, e);
    }
    return e;
  };

  const hasPending = (e: Entry) => e.pendingState !== null || e.pendingName !== null;

  const emit = (e: Entry, status: SaveStatus, error: string | null = null, saved?: LabPlan) => {
    e.status = status;
    e.error = error;
    e.listeners.forEach(listener => listener({ status, error, saved }));
  };

  const clearTimer = (e: Entry) => {
    if (e.timer) clearTimeout(e.timer);
    e.timer = null;
  };

  /** Skickar det som väntar, om inget annat anrop är i flykt. */
  const pump = (id: string): Promise<void> => {
    const e = entry(id);
    if (e.inFlight) return e.inFlight;
    if (e.status === 'conflict' || !hasPending(e)) return Promise.resolve();

    const body: SavePlanBody = { version: e.version };
    if (e.pendingState !== null) body.state = e.pendingState;
    if (e.pendingName !== null) body.name = e.pendingName;
    e.pendingState = null;
    e.pendingName = null;
    emit(e, 'saving');

    e.inFlight = save(id, body).then(
      saved => {
        e.inFlight = null;
        e.version = saved.version;
        if (!hasPending(e)) {
          emit(e, 'saved', null, saved);
          return;
        }
        emit(e, 'pending', null, saved);
        // Väntar en debounce-timer får den skicka; annars direkt.
        if (!e.timer) return pump(id);
      },
      error => {
        e.inFlight = null;
        if (error instanceof PlanConflictError) {
          emit(e, 'conflict', error.message);
          return;
        }
        // Det som inte kom fram läggs tillbaka, om inget nyare har kommit.
        if (e.pendingState === null && body.state) e.pendingState = body.state;
        if (e.pendingName === null && body.name !== undefined) e.pendingName = body.name;
        emit(e, 'error', error instanceof Error ? error.message : 'Kunde inte spara upplägget.');
      },
    );
    return e.inFlight;
  };

  /** Skickar det som väntar nu. Klart när kön är tom, eller när sparningen misslyckats. */
  const flush = async (id: string | null): Promise<void> => {
    if (!id) return;
    const e = entry(id);
    clearTimer(e);
    // Första försöket görs även efter ett tidigare fel.
    await pump(id);
    // Det som ändrats medan ett anrop var i flykt skickas efteråt.
    while (e.inFlight || (hasPending(e) && e.status === 'pending')) await pump(id);
  };

  return {
    /**
     * Börjar följa ett upplägg som just hämtats. Har kön osparade ändringar
     * kvar (sparningen misslyckades) eller en konflikt, behålls de, och det
     * läget returneras i stället för serverns.
     */
    adopt(plan: LabPlan): LabState {
      const e = entry(plan.id);
      if (e.status === 'conflict') return e.pendingState ?? plan.state;
      if (e.pendingState !== null) return e.pendingState;
      if (!e.inFlight && e.pendingName === null) e.version = plan.version;
      return plan.state;
    },

    /** Ny ändring. Skickas när det varit stilla en stund. */
    schedule(id: string, state: LabState) {
      const e = entry(id);
      e.pendingState = state;
      if (e.status === 'conflict') return;
      clearTimer(e);
      e.timer = setTimeout(() => {
        e.timer = null;
        void pump(id);
      }, delayMs);
      if (!e.inFlight) emit(e, 'pending');
    },

    /** Nytt namn. Går genom samma kö, så att versionen hålls i takt. */
    rename(id: string, name: string): Promise<void> {
      entry(id).pendingName = name;
      return flush(id);
    },

    flush,

    /** Försöker igen efter ett fel. */
    retry(id: string) {
      const e = entry(id);
      clearTimer(e);
      void pump(id);
    },

    /** Glömmer osparade ändringar och en konflikt, t.ex. innan upplägget läses om. */
    reset(id: string) {
      const e = entry(id);
      clearTimer(e);
      e.pendingState = null;
      e.pendingName = null;
      if (!e.inFlight) emit(e, 'saved');
    },

    /** Väntar in ett anrop i flykt utan att skicka något mer. */
    async settle(id: string) {
      const e = entries.get(id);
      while (e?.inFlight) await e.inFlight;
    },

    /** Upplägget är borttaget. */
    forget(id: string) {
      const e = entries.get(id);
      if (!e) return;
      clearTimer(e);
      entries.delete(id);
    },

    status(id: string | null): SaveStatus {
      return id ? entries.get(id)?.status ?? 'saved' : 'saved';
    },

    error(id: string | null): string | null {
      return id ? entries.get(id)?.error ?? null : null;
    },

    subscribe(id: string, listener: Listener): () => void {
      const e = entry(id);
      e.listeners.add(listener);
      return () => { e.listeners.delete(listener); };
    },
  };
}

export type PlanStore = ReturnType<typeof createPlanStore>;
