'use client';

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { PLANNER_DAYS } from '@/components/schedule/constants';
import { ScheduledEntry } from '@/types/schedule';
import { computeExportWindow } from '@/utils/schedulePdf/exportWindow';
import * as T from '@/utils/schedulePdf/theme';
import { buildDayLayout, DayLayoutEntry } from '@/utils/scheduleLayout';
import { splitTeacherNames } from '@/utils/scheduleStats';
import { EVENT_GAP_PX, MIN_HEIGHT_PX, PIXELS_PER_MINUTE, timeToMinutes } from '@/utils/scheduleTime';

/**
 * Veckorutnätet som riktig text: samma schema som PDF:en, men läsbart i alla
 * fönsterbredder.
 *
 * Det tidigare rutnätet var en bild av PDF:en som skalades om till fönstret, så
 * texten krympte med det — vid 800 px var den runt 6 px. Här står allt som
 * bestämmer *utseendet* kvar: höjd efter klockan (på datorn anpassad så att
 * dagen ryms på skärmen, se `useFittedMinuteHeight`),
 * parallella pass bredvid varandra (`buildDayLayout`, samma packning som
 * PDF:en), samma färger, mått och trösklar ur `theme.ts`. Det som ändras är att
 * texten har fast storlek, och att dagarna delar på bredden efter behov.
 *
 * Ett första försök gav upp klockskalan och staplade parallella pass för att
 * vinna bredd. Det blev läsbart men slutade se ut som ett schema, och
 * deltagarna är vana vid schemat. Därför är formen här orörd.
 */

type Resolvers = {
  resolveColor: (title: string, fallbackColor: string) => string;
  resolveRoom: (title: string, currentRoom?: string) => string;
};

type Props = Resolvers & {
  entries: ScheduledEntry[];
};

const FONT_SANS = 'Helvetica, Arial, sans-serif';
const FONT_MONO = "'Courier New', Courier, monospace";

// ── Avsteg från PDF:ens mått, bara på skärmen ──
//
// Allt annat hämtas ur `theme.ts`. De här värdena skiljer sig med flit och bor
// därför här i stället för där: PDF:en ritas ur samma konstanter och ska inte
// ändras av en justering som gäller läsning i webbläsaren.

/** Tiden är det man letar efter först, så den får växa och full svärta. PDF: 10 px, 70 %. */
const CARD_TIME_SIZE_PX = 11;
/**
 * Mörkare sekundärtext än PDF:ens `#374151`/`#4b5563`. Mot de mättade
 * kortfärgerna — Tema Olivs gröna, Studiedagens blå — blev den grå texten tunn.
 */
const CARD_META_COLOR = '#1f2937';
const CARD_NOTES_COLOR = '#374151';
const TIME_AXIS_TEXT_COLOR = '#4b5563';
/** PDF: 4 px. Med 4 px nuddade avstavade ord kortets kant. */
const CARD_PAD_X_PX = 6;

/**
 * Minuthöjden i femdagarsläget anpassas så att hela dagen ryms på skärmen.
 * PDF:ens 2 px per minut gör 08–16 runt 1000 px högt — mer än en laptop — fast
 * de flesta kort har gott om tomrum. Taket är PDF:ens mått, golvet är där en
 * kvart fortfarande går att läsa.
 */
const MIN_PX_PER_MINUTE = 1.4;
const MAX_PX_PER_MINUTE = PIXELS_PER_MINUTE;
/** Luft under rutnätet så att sista raden inte ligger kant i kant med fönstret. */
const FIT_MARGIN_PX = 12;

const HALF_HOUR_LINE = `1px dashed ${T.COLOR_GRID_LINE}`;

/**
 * Hur många dagar som får plats med läsbar text. Hela veckan kräver att tre
 * parallella pass ryms bredvid varandra i en dag; under det visas tre dagar åt
 * gången, och på en telefon en.
 */
const DAY_COUNT_QUERIES: [string, number][] = [
  ['(min-width: 1180px)', 5],
  ['(min-width: 640px)', 3],
];

const readDayCount = () => {
  if (typeof window === 'undefined') return 5;
  for (const [query, count] of DAY_COUNT_QUERIES) {
    if (window.matchMedia(query).matches) return count;
  }
  return 1;
};

const useDayCount = () => {
  const [count, setCount] = useState(readDayCount);
  useEffect(() => {
    const queries = DAY_COUNT_QUERIES.map(([query]) => window.matchMedia(query));
    const update = () => setCount(readDayCount());
    queries.forEach(query => query.addEventListener('change', update));
    return () => queries.forEach(query => query.removeEventListener('change', update));
  }, []);
  return count;
};

/**
 * Minuthöjden som får hela dagen att rymmas från rutnätets överkant till
 * fönstrets nederkant, med rubriken ovanför i sin naturliga position.
 * Avstängd ger PDF:ens mått; på mobilen och i tredagarsläget är skrollning
 * naturligt, och korten behöver höjden mer än överblicken.
 */
const useFittedMinuteHeight = (
  rootRef: React.RefObject<HTMLElement>,
  enabled: boolean,
  windowMinutes: number
) => {
  const [pxPerMinute, setPxPerMinute] = useState(MAX_PX_PER_MINUTE);

  useLayoutEffect(() => {
    if (!enabled) {
      setPxPerMinute(MAX_PX_PER_MINUTE);
      return;
    }
    const fit = () => {
      const root = rootRef.current;
      if (!root || windowMinutes <= 0) return;
      // Avståndet från sidans topp, inte från fönstrets: resultatet ska inte
      // bero på hur långt man råkar ha skrollat.
      const topPx = root.getBoundingClientRect().top + window.scrollY;
      const chromePx = T.HEADER_H_PX + T.TOP_OFFSET_PX * 2 + 4 /* ramen */ + FIT_MARGIN_PX;
      const available = window.innerHeight - topPx - chromePx;
      const fitted = available / windowMinutes;
      setPxPerMinute(Math.min(MAX_PX_PER_MINUTE, Math.max(MIN_PX_PER_MINUTE, fitted)));
    };
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, [rootRef, enabled, windowMinutes]);

  return pxPerMinute;
};

/** Dagens index i veckan, eller måndag på helgen. */
const todayIndex = () => {
  const index = new Date().getDay() - 1;
  return index >= 0 && index < PLANNER_DAYS.length ? index : 0;
};

const clampStart = (start: number, count: number) =>
  Math.min(Math.max(start, 0), PLANNER_DAYS.length - count);

const extractUrl = (value?: string) => {
  if (!value) return null;
  const match = value.match(/https?:\/\/[^\s]+/i);
  return match ? match[0] : null;
};

type DayData = {
  day: string;
  entries: ScheduledEntry[];
  layout: Map<string, DayLayoutEntry>;
  lastEndMinutes: number;
  /**
   * Hur stor del av bredden dagen får. En dag med tre parallella pass behöver
   * tre gånger så mycket som en med ett — annars trängs de tre medan
   * torsdagens studiedag har en hel femtedel för sig själv. Golvet ger en dag
   * med ett enda pass plats nog för titel och anteckning.
   */
  weight: number;
};

const MIN_DAY_WEIGHT = 1.5;

export default function PublicTimeGrid({ entries, resolveColor, resolveRoom }: Props) {
  const dayCount = useDayCount();
  // Dagen man valt. Tre dagar åt gången lägger den i mitten, en åt gången visar
  // bara den — så ett byte mellan lägena behåller var man var.
  const [focus, setFocus] = useState(todayIndex);

  const timeWindow = useMemo(
    () => computeExportWindow({ entries, isVisible: () => true }),
    [entries]
  );
  const windowMinutes = timeWindow.endMinutes - timeWindow.startMinutes;
  const rootRef = useRef<HTMLDivElement>(null);
  const pxPerMinute = useFittedMinuteHeight(rootRef, dayCount === 5, windowMinutes);

  const days = useMemo<DayData[]>(() => PLANNER_DAYS.map(day => {
    const dayEntries = entries.filter(entry => entry.day === day);
    const layout = buildDayLayout(dayEntries);
    let maxColumns = 1;
    layout.forEach(placement => { maxColumns = Math.max(maxColumns, placement.columns); });
    return {
      day,
      entries: dayEntries,
      layout,
      lastEndMinutes: dayEntries.reduce(
        (latest, entry) => Math.max(latest, timeToMinutes(entry.endTime)),
        Number.NEGATIVE_INFINITY
      ),
      weight: Math.max(maxColumns, MIN_DAY_WEIGHT),
    };
  }), [entries]);

  const firstShown = dayCount === 5 ? 0 : clampStart(focus - Math.floor(dayCount / 2), dayCount);
  const shown = days.slice(firstShown, firstShown + dayCount);

  const columns = `${T.TIME_AXIS_W_PX}px ${shown.map(d => `minmax(0, ${d.weight}fr)`).join(' ')}`;
  // Lika mycket luft nedtill som överst. Sista timetiketten centreras på
  // rutnätets nederkant och hamnade annars halvt under ramen.
  const gridHeightPx = T.TOP_OFFSET_PX * 2 + windowMinutes * pxPerMinute;
  const yFor = (minutes: number) => T.TOP_OFFSET_PX + (minutes - timeWindow.startMinutes) * pxPerMinute;

  const hours: number[] = [];
  for (let minutes = timeWindow.startMinutes; minutes <= timeWindow.endMinutes; minutes += 60) hours.push(minutes);
  // Nästan alla pass börjar :15, :30 eller :45. Med bara heltimmeslinjer går det
  // inte att se var 12:30 ligger.
  const halfHours = hours.slice(0, -1).map(minutes => minutes + 30);

  return (
    // `lang` styr avstavningen: "Studie-verkstad" i stället för att ordet bryts
    // där bredden råkar ta slut. Rotlayouten säger "en".
    <div ref={rootRef} lang="sv" style={{ fontFamily: FONT_SANS }}>
      {dayCount < 5 && (
        <div role="tablist" aria-label="Veckodag" className="mb-3 grid grid-cols-5 gap-1.5">
          {PLANNER_DAYS.map((day, index) => {
            const isShown = index >= firstShown && index < firstShown + dayCount;
            return (
              <button
                key={day}
                role="tab"
                aria-selected={isShown}
                onClick={() => setFocus(index)}
                className={`rounded border-2 border-black py-2 text-sm font-bold ${
                  isShown ? 'bg-black text-white' : 'bg-white text-black'
                }`}
              >
                {day.slice(0, 3)}
              </button>
            );
          })}
        </div>
      )}

      <div className="rounded border-2 border-black bg-white">
        {/* Dagraden följer med när man skrollar: rutnätet är högre än skärmen,
            och på eftermiddagen syns annars inte vilken kolumn som är vilken. */}
        <div
          className="sticky top-0 z-10 grid rounded-t bg-white"
          style={{
            gridTemplateColumns: columns,
            height: T.HEADER_H_PX,
            borderBottom: `${T.DAY_HEADER_RULE_W_PX}px solid ${T.COLOR_DAY_HEADER_RULE}`,
          }}
        >
          <div />
          {shown.map((data, index) => (
            <div
              key={data.day}
              className="flex items-center justify-center font-bold"
              style={{
                fontSize: T.FONT_SIZE_SM_PX,
                borderRight: index < shown.length - 1 ? `1px solid ${T.COLOR_COLUMN_BORDER}` : undefined,
              }}
            >
              {data.day}
            </div>
          ))}
        </div>

        <div className="grid" style={{ gridTemplateColumns: columns, height: gridHeightPx }}>
          <div className="relative rounded-bl" style={{ background: T.COLOR_TIME_AXIS_BG }}>
            {hours.map(minutes => (
              <span
                key={minutes}
                className="absolute right-1 -translate-y-1/2 font-bold"
                style={{ top: yFor(minutes), fontSize: T.FONT_SIZE_XS_PX, color: TIME_AXIS_TEXT_COLOR }}
              >
                {Math.floor(minutes / 60)}:00
              </span>
            ))}
            {halfHours.map(minutes => (
              <div
                key={minutes}
                className="absolute right-0 w-2"
                style={{ top: yFor(minutes), borderTop: `1px solid ${TIME_AXIS_TEXT_COLOR}`, opacity: 0.4 }}
                aria-hidden
              />
            ))}
          </div>

          {shown.map((data, index) => (
            <div
              key={data.day}
              className="relative"
              style={{
                borderRight: index < shown.length - 1 ? `1px solid ${T.COLOR_COLUMN_BORDER}` : undefined,
              }}
            >
              {hours.slice(0, -1).map(minutes => (
                <div
                  key={minutes}
                  className="absolute inset-x-0"
                  style={{ top: yFor(minutes), borderTop: `1px solid ${T.COLOR_GRID_LINE}` }}
                  aria-hidden
                />
              ))}
              {halfHours.map(minutes => (
                <div
                  key={minutes}
                  className="absolute inset-x-0"
                  style={{ top: yFor(minutes), borderTop: HALF_HOUR_LINE }}
                  aria-hidden
                />
              ))}
              {data.entries.map(entry => (
                <TimeCard
                  key={entry.instanceId}
                  entry={entry}
                  placement={data.layout.get(entry.instanceId)}
                  topPx={yFor(timeToMinutes(entry.startTime)) + EVENT_GAP_PX / 2}
                  isLastOfDay={timeToMinutes(entry.endTime) === data.lastEndMinutes}
                  pxPerMinute={pxPerMinute}
                  resolveColor={resolveColor}
                  resolveRoom={resolveRoom}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Släpper hela rader nedifrån i stället för att klippa mitt i en rad.
 *
 * Kortet har `overflow: hidden`, så det som inte ryms skars annars av mitt i
 * bokstäverna — "Lagunen" till hälften, en anteckning med halva raden kvar.
 * Det blev vanligare när rutnätet gjordes lägre för att rymmas på skärmen.
 * PDF:en löser samma sak i `cardLayout.ts` genom att släppa hela rader och
 * sätta "…" sist; det här gör detsamma på det renderade kortet.
 *
 * Raderna mäts i stället för att räknas ut: hur många rader titeln tar beror
 * på kolumnbredden och avstavningen. Blocken efter titeln märks `data-fit`.
 * Det första som inte ryms helt, och allt efter det, tas bort — utom en
 * anteckning (`data-fit="clamp"`), som i stället kortas till de rader som
 * ryms och får "…" sist. Stilarna sätts direkt på elementen och nollställs
 * före varje mätning; React äger inte just de egenskaperna.
 */
const useFitCardContent = (cardHeightPx: number) => {
  const cardRef = useRef<HTMLElement>(null);

  useLayoutEffect(() => {
    const card = cardRef.current;
    if (!card) return;

    const fit = () => {
      const blocks = Array.from(card.querySelectorAll<HTMLElement>('[data-fit]'));
      for (const block of blocks) {
        block.style.display = '';
        block.style.webkitLineClamp = '';
        block.style.removeProperty('-webkit-box-orient');
        block.style.overflow = '';
      }

      // `offsetTop` räknas från kortet, som är positionerat — padding ingår.
      const limit = card.clientHeight - T.CARD_PAD_BOTTOM_PX + 0.5;
      let dropRest = false;
      for (const block of blocks) {
        if (!dropRest && block.offsetTop + block.offsetHeight <= limit) continue;

        if (!dropRest && block.dataset.fit === 'clamp') {
          const lineHeightPx = parseFloat(getComputedStyle(block).lineHeight) || 15;
          const lines = Math.floor((limit - block.offsetTop) / lineHeightPx);
          if (lines > 0) {
            block.style.display = '-webkit-box';
            block.style.setProperty('-webkit-box-orient', 'vertical');
            block.style.webkitLineClamp = String(lines);
            block.style.overflow = 'hidden';
            dropRest = true;
            continue;
          }
        }
        block.style.display = 'none';
        dropRest = true;
      }
    };

    fit();
    // Bredden ändras med fönstret, och med den hur många rader titeln tar.
    const observer = new ResizeObserver(fit);
    observer.observe(card);
    return () => observer.disconnect();
  }, [cardHeightPx]);

  return cardRef;
};

type TimeCardProps = Resolvers & {
  entry: ScheduledEntry;
  placement: DayLayoutEntry | undefined;
  topPx: number;
  isLastOfDay: boolean;
  pxPerMinute: number;
};

/**
 * Ett pass, med samma innehåll och samma trösklar som kortet i PDF:en
 * (`cardLayout.ts`): tiden överst, titeln, lärarna, salen och sist
 * anteckningen, där det som inte ryms på höjden faller bort nedifrån.
 */
function TimeCard({ entry, placement, topPx, isLastOfDay, pxPerMinute, resolveColor, resolveRoom }: TimeCardProps) {
  const column = placement?.column ?? 0;
  const columnCount = Math.max(placement?.columns ?? 1, 1);
  // Trösklarna nedan räknas på höjden, så ett lägre rutnät visar automatiskt
  // mindre på korta kort — samma prioritering som i PDF:en.
  const heightPx = Math.max(entry.duration * pxPerMinute - EVENT_GAP_PX, MIN_HEIGHT_PX);

  const isShortDuration = entry.duration < T.SHORT_DURATION_MINUTES;
  const isCompact = heightPx < T.COMPACT_HEIGHT_PX;
  const titleSize = isCompact ? T.FONT_SIZE_XS_PX : T.FONT_SIZE_SM_PX;
  const metaSize = isCompact ? T.FONT_SIZE_2XS_PX : T.FONT_SIZE_XS_PX;
  const showMeta = heightPx > T.TEACHER_ROOM_MIN_HEIGHT_PX;
  const showNotes = Boolean(entry.notes) && heightPx > T.NOTES_MIN_HEIGHT_PX;
  const cardRef = useFitCardContent(heightPx);

  const room = resolveRoom(entry.title, entry.room);
  const teachers = splitTeacherNames(entry.teacher);
  const url = extractUrl(entry.category);
  const timeLabel = isLastOfDay ? `${entry.startTime}–${entry.endTime}` : entry.startTime;

  // Ett kvartspass blir bara ~17 px högt när rutnätet krympts för att rymmas på
  // skärmen, och då trängde PDF:ens 6 px överkantsluft ut tidsraden nedtill.
  // Så låga kort får raden centrerad i stället.
  const headerLinePx = CARD_TIME_SIZE_PX * T.LINE_HEIGHT_FACTOR;
  const fullPadNeeded = T.CARD_PAD_TOP_PX + headerLinePx + T.CARD_PAD_BOTTOM_PX + T.CARD_BORDER_W_PX * 2;
  const padTopPx = heightPx >= fullPadNeeded
    ? T.CARD_PAD_TOP_PX
    : Math.max(0, (heightPx - T.CARD_BORDER_W_PX * 2 - headerLinePx) / 2);

  const style: React.CSSProperties = {
    top: topPx,
    height: heightPx,
    left: `calc(${(100 / columnCount) * column}% + ${T.CARD_INSET_X_PX}px)`,
    width: `calc(${100 / columnCount}% - ${T.CARD_INSET_X_PX * 2}px)`,
    background: resolveColor(entry.title, entry.color),
    border: `${T.CARD_BORDER_W_PX}px solid rgba(0, 0, 0, ${T.CARD_BORDER_ALPHA})`,
    borderRadius: T.CARD_RADIUS_PX,
    padding: `${padTopPx}px ${CARD_PAD_X_PX}px ${T.CARD_PAD_BOTTOM_PX}px`,
    lineHeight: T.LINE_HEIGHT_FACTOR,
    color: T.COLOR_CARD_TEXT,
    hyphens: 'auto',
    WebkitHyphens: 'auto',
    overflowWrap: 'break-word',
  };

  const content = (
    <>
      <div className="truncate" style={{ fontSize: CARD_TIME_SIZE_PX }}>
        <span style={{ fontFamily: FONT_MONO, fontWeight: 700 }}>
          {timeLabel}
        </span>
        {isShortDuration && entry.title && (
          <span className="ml-1 font-bold">{entry.title}</span>
        )}
      </div>
      {!isShortDuration && entry.title && (
        <div className="font-bold" style={{ fontSize: titleSize }}>{entry.title}</div>
      )}
      {showMeta && teachers.map(name => (
        <div key={name} data-fit="line" className="font-bold" style={{ fontSize: metaSize, color: CARD_META_COLOR }}>
          {name}
        </div>
      ))}
      {showMeta && room && (
        <div data-fit="line" className="truncate" style={{ fontSize: metaSize, color: CARD_META_COLOR }}>{room}</div>
      )}
      {showNotes && (
        <div data-fit="clamp" style={{ fontSize: metaSize, color: CARD_NOTES_COLOR }}>
          {entry.notes}
        </div>
      )}
    </>
  );

  const className = 'absolute block overflow-hidden';
  if (url) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        title="Öppna uppgiften"
        ref={cardRef as React.RefObject<HTMLAnchorElement>}
        className={`${className} hover:ring-2 hover:ring-black focus-visible:ring-2 focus-visible:ring-black`}
        style={style}
      >
        {content}
      </a>
    );
  }
  return (
    <div ref={cardRef as React.RefObject<HTMLDivElement>} className={className} style={style}>
      {content}
    </div>
  );
}
