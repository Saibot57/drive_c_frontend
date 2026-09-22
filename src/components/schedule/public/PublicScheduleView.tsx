'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Download, RefreshCw } from 'lucide-react';
import { mapPlannerActivitiesToSchedule } from '@/hooks/usePlannerSync';
import { fetchPublicSchedule, parseServerTimestamp } from '@/services/publicScheduleService';
import { PublicSchedulePayload } from '@/types/schedule';
import { ScheduleExportInput } from '@/types/scheduleExport';
import { createColorResolver, sanitizeColorTriggers } from '@/utils/colorTriggers';
import { createRoomResolver, sanitizeRoomTriggers } from '@/utils/roomTriggers';
import { exportSchedule } from '@/utils/schedulePdf';
import { buildScene } from '@/utils/schedulePdf/buildScene';
import { createJsPdfMeasurer } from '@/utils/schedulePdf/jspdfMeasurer';
import { sceneToSvg } from '@/utils/schedulePdf/sceneToSvg';
import PublicDayList from './PublicDayList';

/**
 * En gång i minuten räcker: ändringar i ett veckoschema är sällsynta och
 * aldrig brådskande på sekunden. Med ETag kostar en oförändrad fråga en 304.
 * Den som byter tillbaka till fliken får dessutom en fråga direkt.
 */
const POLL_INTERVAL_MS = 60_000;
const WIDE_QUERY = '(min-width: 768px)';

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

const useIsWide = () => {
  const [isWide, setIsWide] = useState<boolean | null>(null);
  useEffect(() => {
    const query = window.matchMedia(WIDE_QUERY);
    const update = () => setIsWide(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  return isWide;
};

export default function PublicScheduleView({ token }: { token: string }) {
  const [payload, setPayload] = useState<PublicSchedulePayload | null>(null);
  const [state, setState] = useState<LoadState>('loading');
  /** Senaste pollningen misslyckades, men vi har en äldre version att visa. */
  const [isStale, setIsStale] = useState(false);
  const etagRef = useRef<string | null>(null);
  const inFlightRef = useRef(false);
  const isWide = useIsWide();

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
    return {
      schedule,
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
  }, [payload, schedule, resolveColor, resolveRoom]);

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
      </header>

      {!payload.archiveName ? (
        <Notice title="Inget schema publicerat just nu">
          Titta in igen senare. Sidan uppdateras av sig själv.
        </Notice>
      ) : isWide === null ? null : isWide && exportInput ? (
        <WeekGrid input={exportInput} />
      ) : (
        <PublicDayList entries={schedule} resolveColor={resolveColor} resolveRoom={resolveRoom} />
      )}

      {/* Nedladdningen står sist och diskret. Den är det deltagarna behöver
          minst, och högst upp tog den plats från schemat på en telefon. */}
      {exportInput && schedule.length > 0 && (
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

/**
 * Samma rendering som vektorexporten, så datorvyn är pixelidentisk med
 * PDF:en deltagarna redan känner igen. SVG:n byggs av oss själva och all text
 * går genom `escapeXml` i sceneToSvg, därför är den säker att lägga in som HTML.
 *
 * Uppgiftslänkarna är PDF-annotationer och saknar motsvarighet i SVG:n. De
 * läggs ovanpå som genomskinliga länkytor på kortens platser.
 */
function WeekGrid({ input }: { input: ScheduleExportInput }) {
  const scene = useMemo(() => buildScene(input, createJsPdfMeasurer()), [input]);
  const svg = useMemo(() => sceneToSvg(scene).replace(/^<\?xml[^>]*>\s*/, ''), [scene]);
  const links = scene.nodes.filter(
    (node): node is Extract<typeof node, { kind: 'link' }> => node.kind === 'link'
  );

  return (
    <div className="relative overflow-hidden rounded border-2 border-black">
      <div
        className="[&>svg]:block [&>svg]:h-auto [&>svg]:w-full"
        dangerouslySetInnerHTML={{ __html: svg }}
      />
      {links.map((link, index) => (
        <a
          key={index}
          href={link.url}
          target="_blank"
          rel="noopener noreferrer"
          title="Öppna uppgiften"
          aria-label="Öppna uppgiften"
          className="absolute rounded hover:bg-black/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-black"
          style={{
            left: `${(link.x / scene.widthPx) * 100}%`,
            top: `${(link.y / scene.heightPx) * 100}%`,
            width: `${(link.w / scene.widthPx) * 100}%`,
            height: `${(link.h / scene.heightPx) * 100}%`,
          }}
        />
      ))}
    </div>
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
