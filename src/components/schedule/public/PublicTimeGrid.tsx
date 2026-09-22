'use client';

import { useEffect, useMemo, useState } from 'react';
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
 * bestämmer *utseendet* kvar: höjd efter klockan (`PIXELS_PER_MINUTE`),
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
  const gridHeightPx = T.TOP_OFFSET_PX + (timeWindow.endMinutes - timeWindow.startMinutes) * PIXELS_PER_MINUTE;
  const yFor = (minutes: number) => T.TOP_OFFSET_PX + (minutes - timeWindow.startMinutes) * PIXELS_PER_MINUTE;

  const hours: number[] = [];
  for (let minutes = timeWindow.startMinutes; minutes <= timeWindow.endMinutes; minutes += 60) hours.push(minutes);

  return (
    // `lang` styr avstavningen: "Studie-verkstad" i stället för att ordet bryts
    // där bredden råkar ta slut. Rotlayouten säger "en".
    <div lang="sv" style={{ fontFamily: FONT_SANS }}>
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
                style={{ top: yFor(minutes), fontSize: T.FONT_SIZE_XS_PX, color: T.COLOR_TIME_AXIS_TEXT }}
              >
                {Math.floor(minutes / 60)}:00
              </span>
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
              {data.entries.map(entry => (
                <TimeCard
                  key={entry.instanceId}
                  entry={entry}
                  placement={data.layout.get(entry.instanceId)}
                  topPx={yFor(timeToMinutes(entry.startTime)) + EVENT_GAP_PX / 2}
                  isLastOfDay={timeToMinutes(entry.endTime) === data.lastEndMinutes}
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

type TimeCardProps = Resolvers & {
  entry: ScheduledEntry;
  placement: DayLayoutEntry | undefined;
  topPx: number;
  isLastOfDay: boolean;
};

/**
 * Ett pass, med samma innehåll och samma trösklar som kortet i PDF:en
 * (`cardLayout.ts`): tiden överst, titeln, lärarna, salen och sist
 * anteckningen, där det som inte ryms på höjden faller bort nedifrån.
 */
function TimeCard({ entry, placement, topPx, isLastOfDay, resolveColor, resolveRoom }: TimeCardProps) {
  const column = placement?.column ?? 0;
  const columnCount = Math.max(placement?.columns ?? 1, 1);
  const heightPx = Math.max(entry.duration * PIXELS_PER_MINUTE - EVENT_GAP_PX, MIN_HEIGHT_PX);

  const isShortDuration = entry.duration < T.SHORT_DURATION_MINUTES;
  const isCompact = heightPx < T.COMPACT_HEIGHT_PX;
  const titleSize = isCompact ? T.FONT_SIZE_XS_PX : T.FONT_SIZE_SM_PX;
  const metaSize = isCompact ? T.FONT_SIZE_2XS_PX : T.FONT_SIZE_XS_PX;
  const showMeta = heightPx > T.TEACHER_ROOM_MIN_HEIGHT_PX;
  const showNotes = Boolean(entry.notes) && heightPx > T.NOTES_MIN_HEIGHT_PX;

  const room = resolveRoom(entry.title, entry.room);
  const teachers = splitTeacherNames(entry.teacher);
  const url = extractUrl(entry.category);
  const timeLabel = isLastOfDay ? `${entry.startTime}–${entry.endTime}` : entry.startTime;

  const style: React.CSSProperties = {
    top: topPx,
    height: heightPx,
    left: `calc(${(100 / columnCount) * column}% + ${T.CARD_INSET_X_PX}px)`,
    width: `calc(${100 / columnCount}% - ${T.CARD_INSET_X_PX * 2}px)`,
    background: resolveColor(entry.title, entry.color),
    border: `${T.CARD_BORDER_W_PX}px solid rgba(0, 0, 0, ${T.CARD_BORDER_ALPHA})`,
    borderRadius: T.CARD_RADIUS_PX,
    padding: `${T.CARD_PAD_TOP_PX}px ${T.CARD_PAD_X_PX}px ${T.CARD_PAD_BOTTOM_PX}px`,
    lineHeight: T.LINE_HEIGHT_FACTOR,
    color: T.COLOR_CARD_TEXT,
    hyphens: 'auto',
    WebkitHyphens: 'auto',
    overflowWrap: 'break-word',
  };

  const content = (
    <>
      <div className="truncate" style={{ fontSize: T.FONT_SIZE_2XS_PX }}>
        <span style={{ fontFamily: FONT_MONO, fontWeight: 700, opacity: T.CARD_TIME_ALPHA }}>
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
        <div key={name} className="font-bold" style={{ fontSize: metaSize, color: T.COLOR_CARD_META }}>
          {name}
        </div>
      ))}
      {showMeta && room && (
        <div className="truncate" style={{ fontSize: metaSize, color: T.COLOR_CARD_META }}>{room}</div>
      )}
      {showNotes && (
        <div style={{ fontSize: metaSize, color: T.COLOR_CARD_NOTES }}>{entry.notes}</div>
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
        className={`${className} hover:ring-2 hover:ring-black focus-visible:ring-2 focus-visible:ring-black`}
        style={style}
      >
        {content}
      </a>
    );
  }
  return <div className={className} style={style}>{content}</div>;
}
