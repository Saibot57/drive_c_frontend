'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Download, Filter, RefreshCw } from 'lucide-react';
import { mapPlannerActivitiesToSchedule } from '@/hooks/usePlannerSync';
import { fetchPublicSchedule, parseServerTimestamp } from '@/services/publicScheduleService';
import { PublicSchedulePayload } from '@/types/schedule';
import { ScheduleExportInput } from '@/types/scheduleExport';
import { createColorResolver, sanitizeColorTriggers } from '@/utils/colorTriggers';
import { createRoomResolver, sanitizeRoomTriggers } from '@/utils/roomTriggers';
import {
  describeChoice,
  filterForParticipant,
  ParticipantChoice,
  sanitizeChoice,
} from '@/utils/publicScheduleFilter';
import { exportSchedule } from '@/utils/schedulePdf';
import MyLessonsDialog from './MyLessonsDialog';
import PublicDayList from './PublicDayList';
import PublicTimeGrid from './PublicTimeGrid';

/**
 * En gång i minuten räcker: ändringar i ett veckoschema är sällsynta och
 * aldrig brådskande på sekunden. Med ETag kostar en oförändrad fråga en 304.
 * Den som byter tillbaka till fliken får dessutom en fråga direkt.
 */
const POLL_INTERVAL_MS = 60_000;

type LoadState = 'loading' | 'ready' | 'not-found' | 'error';

const formatUpdated = (value: string | null) => {
  const date = parseServerTimestamp(value);
  if (!date) return null;
  return date.toLocaleString('sv-SE', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
};

/**
 * Rubriken är det läraren skrivit, och arkivnamnet står under — utom när det
 * bara vore en upprepning.
 *
 * Rubriken "Allmän kurs: schema v. 39" tillsammans med arkivnamnet "v. 39" tog
 * en fjärdedel av telefonskärmen innan schemat ens började, och sa samma sak
 * två gånger. Jämförelsen struntar i skiljetecken och mellanrum, så "v.39"
 * räknas som samma sak som "v. 39".
 */
const buildHeadings = (label: string | null, archiveName: string | null) => {
  const fallback = archiveName ?? 'Schema';
  if (!label) return { heading: fallback, subheading: null };

  const squash = (value: string) => value.toLocaleLowerCase('sv').replace(/[^a-z0-9åäö]/g, '');
  const alreadySaid = archiveName ? squash(label).includes(squash(archiveName)) : true;
  return { heading: label, subheading: alreadySaid ? null : archiveName };
};

/**
 * Deltagarens val sparas i den egna webbläsaren. Det är en bekvämlighet, inte
 * något som måste överleva — rensad lagring eller ett privat fönster ger bara
 * hela schemat igen. Nyckeln är gemensam för alla länkar, så valet följer med
 * om läraren byter ut länken.
 */
const CHOICE_STORAGE_KEY = 'fhsk-schema.mina-lektioner.v1';

const readStoredChoice = (): ParticipantChoice | null => {
  try {
    const raw = window.localStorage.getItem(CHOICE_STORAGE_KEY);
    return raw ? sanitizeChoice(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
};

const writeStoredChoice = (choice: ParticipantChoice | null) => {
  try {
    if (choice) window.localStorage.setItem(CHOICE_STORAGE_KEY, JSON.stringify(choice));
    else window.localStorage.removeItem(CHOICE_STORAGE_KEY);
  } catch {
    // Lagringen kan vara avstängd. Valet gäller då bara tills sidan laddas om.
  }
};

type Props = {
  token: string;
  /**
   * Dagslistan i stället för rutnätets dagsschema på mobilen. Standard; av
   * bara med `?vy=dagsschema`. Bredare skärmar får rutnätet oavsett.
   */
  listOnMobile?: boolean;
};

export default function PublicScheduleView({ token, listOnMobile = true }: Props) {
  const [payload, setPayload] = useState<PublicSchedulePayload | null>(null);
  const [state, setState] = useState<LoadState>('loading');
  /** Senaste pollningen misslyckades, men vi har en äldre version att visa. */
  const [isStale, setIsStale] = useState(false);
  const etagRef = useRef<string | null>(null);
  const inFlightRef = useRef(false);
  const [choice, setChoice] = useState<ParticipantChoice | null>(null);
  const [isChoiceOpen, setIsChoiceOpen] = useState(false);

  // Läses efter första renderingen, inte i en `useState`-initierare: servern
  // har ingen lagring, och den första klientrenderingen måste matcha dess.
  useEffect(() => {
    setChoice(readStoredChoice());
  }, []);

  const applyChoice = useCallback((next: ParticipantChoice | null) => {
    setChoice(next);
    writeStoredChoice(next);
    setIsChoiceOpen(false);
  }, []);

  const refresh = useCallback(async () => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    try {
      const result = await fetchPublicSchedule(token, etagRef.current);
      if (result.status === 'ok') {
        etagRef.current = result.etag;
        setPayload(result.payload);
        setState('ready');
        setIsStale(false);
      } else if (result.status === 'unchanged') {
        setIsStale(false);
      } else if (result.status === 'not-found') {
        // Länken är avstängd eller bytt. Släng det vi visade — ett schema som
        // står kvar efter att läraren dragit tillbaka länken vore missvisande.
        etagRef.current = null;
        setPayload(null);
        setState('not-found');
      } else {
        setIsStale(true);
        setState(current => (current === 'loading' ? 'error' : current));
      }
    } finally {
      inFlightRef.current = false;
    }
  }, [token]);

  useEffect(() => {
    void refresh();
    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible') void refresh();
    }, POLL_INTERVAL_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [refresh]);

  const schedule = useMemo(
    () => (payload ? mapPlannerActivitiesToSchedule(payload.activities) : []),
    [payload]
  );
  /** Det som faktiskt visas — hela schemat, eller bara deltagarens lektioner. */
  const visible = useMemo(
    () => (choice ? filterForParticipant(schedule, choice) : schedule),
    [schedule, choice]
  );
  const resolveColor = useMemo(
    () => createColorResolver(sanitizeColorTriggers(payload?.colorTriggers)),
    [payload]
  );
  const resolveRoom = useMemo(
    () => createRoomResolver(sanitizeRoomTriggers(payload?.roomTriggers)),
    [payload]
  );

  const exportInput = useMemo<ScheduleExportInput | null>(() => {
    if (!payload?.archiveName) return null;
    // Bilden visar det man ser på sidan: har man valt sina lektioner är det
    // dem man vill spara undan, inte hela gruppens schema.
    return {
      schedule: visible,
      isVisible: () => true,
      resolveColor,
      resolveRoom,
      planningByDay: null,
      archiveName: payload.archiveName,
      // Datumet i rubrikraden ska säga när schemat senast ändrades, inte när
      // sidan råkade laddas.
      exportedAt: parseServerTimestamp(payload.updatedAt) ?? undefined,
      pageMode: 'digital',
    };
  }, [payload, visible, resolveColor, resolveRoom]);

  const [isDownloading, setIsDownloading] = useState(false);
  const handleDownload = useCallback(async () => {
    if (!exportInput) return;
    setIsDownloading(true);
    try {
      await exportSchedule(exportInput, 'png');
    } finally {
      setIsDownloading(false);
    }
  }, [exportInput]);

  if (state === 'loading') {
    return <Shell><p className="text-gray-500">Hämtar schemat…</p></Shell>;
  }
  if (state === 'not-found') {
    return (
      <Shell>
        <Notice title="Länken fungerar inte längre">
          Den kan ha bytts ut eller stängts av. Fråga din lärare efter den nya länken.
        </Notice>
      </Shell>
    );
  }
  if (state === 'error' || !payload) {
    return (
      <Shell>
        <Notice title="Schemat gick inte att hämta">
          Kontrollera internetanslutningen. Sidan försöker igen av sig själv.
        </Notice>
      </Shell>
    );
  }

  const updated = formatUpdated(payload.updatedAt);
  const { heading, subheading } = buildHeadings(payload.label, payload.archiveName);

  return (
    <Shell>
      <header className="mb-4">
        <h1 className="text-2xl font-bold leading-tight">{heading}</h1>
        {subheading && (
          <p className="text-sm font-bold uppercase tracking-wide text-gray-500">{subheading}</p>
        )}
        {updated && (
          <p className="mt-0.5 text-sm text-gray-600" role="status">
            Uppdaterad {updated}
            {isStale && (
              <span className="ml-2 inline-flex items-center gap-1 text-amber-700">
                <RefreshCw size={12} /> kunde inte kontrollera just nu
              </span>
            )}
          </p>
        )}

        {payload.archiveName && (
          choice ? (
            <div
              role="status"
              className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded border-2 border-black bg-amber-50 px-3 py-2 text-sm"
            >
              <span className="inline-flex items-center gap-1.5 font-bold">
                <Filter size={14} aria-hidden /> Visar dina lektioner: {describeChoice(choice)}
              </span>
              <span className="flex gap-3">
                <button type="button" onClick={() => setIsChoiceOpen(true)} className="font-bold underline underline-offset-2">
                  Ändra
                </button>
                <button type="button" onClick={() => applyChoice(null)} className="font-bold underline underline-offset-2">
                  Visa hela schemat
                </button>
              </span>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setIsChoiceOpen(true)}
              className="mt-3 inline-flex items-center gap-2 rounded border-2 border-black bg-amber-100 px-3 py-2 text-left text-sm font-bold shadow-[3px_3px_0px_black] active:translate-x-[1px] active:translate-y-[1px] active:shadow-[2px_2px_0px_black]"
            >
              <Filter size={16} className="shrink-0" aria-hidden />
              Vill du bara se de lektioner du ska gå på?
            </button>
          )
        )}
      </header>

      <MyLessonsDialog
        open={isChoiceOpen}
        onOpenChange={setIsChoiceOpen}
        current={choice}
        onChoose={applyChoice}
      />

      {!payload.archiveName ? (
        <Notice title="Inget schema publicerat just nu">
          Titta in igen senare. Sidan uppdateras av sig själv.
        </Notice>
      ) : listOnMobile ? (
        // `sm` är 640 px, samma gräns där rutnätet går från tre dagar till en.
        // Båda ritas och CSS väljer, så ingen vy hoppar vid laddning.
        <>
          <div className="sm:hidden">
            <PublicDayList entries={visible} resolveColor={resolveColor} resolveRoom={resolveRoom} />
          </div>
          <div className="hidden sm:block">
            <PublicTimeGrid entries={visible} resolveColor={resolveColor} resolveRoom={resolveRoom} />
          </div>
        </>
      ) : (
        <PublicTimeGrid entries={visible} resolveColor={resolveColor} resolveRoom={resolveRoom} />
      )}

      {/* Nedladdningen står sist och diskret. Den är det deltagarna behöver
          minst, och högst upp tog den plats från schemat på en telefon. */}
      {exportInput && visible.length > 0 && (
        <button
          type="button"
          onClick={handleDownload}
          disabled={isDownloading}
          className="mt-6 inline-flex items-center gap-1.5 text-sm font-bold text-gray-600 underline underline-offset-2 disabled:opacity-60"
        >
          <Download size={14} /> {isDownloading ? 'Skapar bild…' : 'Ladda ner som bild'}
        </button>
      )}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto w-full max-w-[1400px] pb-10">{children}</div>;
}

function Notice({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded border-2 border-black bg-amber-50 p-5 shadow-[4px_4px_0px_black]">
      <h2 className="text-lg font-bold">{title}</h2>
      <p className="mt-1 text-gray-700">{children}</p>
    </div>
  );
}
