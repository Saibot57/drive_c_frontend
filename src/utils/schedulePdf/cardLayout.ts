/**
 * Kortets textinnehåll, utlagt och klämt utan DOM.
 *
 * Ersätter `scheduleExportFit.ts` för den datadrivna vägen. Ordningen på
 * blocken speglar JSX:en i `ScheduledEventCard.tsx` exakt, och trösklarna
 * (`duration < 45`, höjd < 38, > 30, > 46) är samma tal — de bor i `theme.ts`
 * så att de går att jämföra sida vid sida.
 *
 * Prioriteringen är oförändrad från DOM-versionen: anteckningarna ger vika
 * först, sedan titeln, ned till minst en rad.
 *
 * **Medveten avvikelse.** DOM-versionen låter kortets `overflow: hidden` kapa
 * mitt i en glyfrad. Här släpps hela rader i stället — en halvsynlig textrad i
 * en fil som ska delas är värre än en saknad rad.
 *
 * Rubrikraden med tiden är kortets identitet och klipps aldrig bort. Dess
 * radbox kan överstiga ett mycket kort korts innerhöjd, men själva bläcket är
 * bara `sizePx` högt och ryms ändå.
 */

import { ScheduledEntry } from '@/types/schedule';
import { splitTeacherNames } from '@/utils/scheduleStats';
import { FontRole } from './scene';
import { clipWithEllipsis, ELLIPSIS, TextMeasurer, truncateToWidth, wrapText } from './measure';
import {
  CARD_PAD_BOTTOM_PX,
  CARD_PAD_TOP_PX,
  COMPACT_HEIGHT_PX,
  FONT_SIZE_2XS_PX,
  FONT_SIZE_SM_PX,
  FONT_SIZE_XS_PX,
  LINE_HEIGHT_FACTOR,
  NOTES_MIN_HEIGHT_PX,
  SHORT_DURATION_MINUTES,
  TEACHER_ROOM_MIN_HEIGHT_PX,
} from './theme';

/** Vilken färg runet ska ha. Löses upp mot kortfärgen i `buildScene`. */
export type CardColorRole = 'title' | 'time' | 'meta' | 'notes';

export type CardTextRun = {
  text: string;
  font: FontRole;
  sizePx: number;
  role: CardColorRole;
  /** Luft före runet, i px. `ml-1` mellan tid och inline-titel. */
  gapBeforePx: number;
};

export type CardTextLine = {
  runs: CardTextRun[];
  /** Radens överkant, relativt kortets innehållsyta (efter padding-top). */
  topPx: number;
  lineHeightPx: number;
};

export type CardTextLayout = {
  lines: CardTextLine[];
  /** Text togs bort eller kortades med "…". Rapporteras vidare som notis. */
  truncated: boolean;
};

export type CardTextInput = {
  entry: ScheduledEntry;
  /** Salen efter att salsreglerna körts. */
  shownRoom: string;
  adjustedHeightPx: number;
  innerWidthPx: number;
  isLastOfDay: boolean;
  measure: TextMeasurer;
};

const lineHeight = (sizePx: number) => sizePx * LINE_HEIGHT_FACTOR;

const run = (
  text: string,
  font: FontRole,
  sizePx: number,
  role: CardColorRole,
  gapBeforePx = 0
): CardTextRun => ({ text, font, sizePx, role, gapBeforePx });

const simpleLines = (
  texts: string[],
  font: FontRole,
  sizePx: number,
  role: CardColorRole
): CardTextRun[][] => texts.map(text => [run(text, font, sizePx, role)]);

/** Sätter "…" sist på en rad, och kortar av den om ellipsen inte ryms. */
const withEllipsis = (
  runs: CardTextRun[],
  maxWidthPx: number,
  measure: TextMeasurer
): CardTextRun[] => {
  const last = runs[runs.length - 1];
  if (!last) return runs;
  if (last.text.endsWith(ELLIPSIS)) return runs;

  const used = runs
    .slice(0, -1)
    .reduce((sum, r) => sum + r.gapBeforePx + measure.width(r.text, r.font, r.sizePx), 0);
  const room = maxWidthPx - used - last.gapBeforePx;

  const text = clipWithEllipsis(last.text, room, last.font, last.sizePx, measure);
  return [...runs.slice(0, -1), { ...last, text }];
};

export const layoutCardText = ({
  entry,
  shownRoom,
  adjustedHeightPx,
  innerWidthPx,
  isLastOfDay,
  measure,
}: CardTextInput): CardTextLayout => {
  const innerHeightPx = adjustedHeightPx - CARD_PAD_TOP_PX - CARD_PAD_BOTTOM_PX;
  const isShortDuration = entry.duration < SHORT_DURATION_MINUTES;
  const isCompactHeight = adjustedHeightPx < COMPACT_HEIGHT_PX;

  const titleSize = isCompactHeight ? FONT_SIZE_XS_PX : FONT_SIZE_SM_PX;
  const metaSize = isCompactHeight ? FONT_SIZE_2XS_PX : FONT_SIZE_XS_PX;

  // ── Rubrikraden: tid, och på korta kort även titeln inline ──
  //
  // Skärmen klipper hela intervallet med `overflow: hidden` när kortet är för
  // smalt. Här finns ingen klippning, så etiketten faller tillbaka på enbart
  // starttiden i stället för att spilla ut över grannkolumnen. "09:4…" hade
  // inte sagt någon någonting.
  const fullTimeLabel = isLastOfDay ? `${entry.startTime}–${entry.endTime}` : entry.startTime;
  const timeLabel =
    measure.width(fullTimeLabel, 'mono', FONT_SIZE_2XS_PX) <= innerWidthPx
      ? fullTimeLabel
      : truncateToWidth(entry.startTime, innerWidthPx, 'mono', FONT_SIZE_2XS_PX, measure);
  const headerRuns: CardTextRun[] = [run(timeLabel, 'mono', FONT_SIZE_2XS_PX, 'time')];

  if (isShortDuration && entry.title) {
    // `ml-1` = 4px. Kortet har ingen egen titelrad här, så titeln kortas av
    // för att hålla rubriken på en rad i stället för att flöda vidare.
    const gap = 4;
    const room = innerWidthPx - measure.width(timeLabel, 'mono', FONT_SIZE_2XS_PX) - gap;
    const text = truncateToWidth(entry.title, room, 'title', FONT_SIZE_2XS_PX, measure);
    if (text) headerRuns.push(run(text, 'title', FONT_SIZE_2XS_PX, 'title', gap));
  }

  const header: CardTextRun[][] = [headerRuns];

  // ── Titel — bara när kortet har plats för en egen rad ──
  let title: CardTextRun[][] = isShortDuration || !entry.title
    ? []
    : simpleLines(
        wrapText(entry.title, innerWidthPx, 'title', titleSize, measure),
        'title',
        titleSize,
        'title'
      );

  // ── Lärare: en rad per namn, får brytas men kortas aldrig med "…" ──
  const teacherNames = splitTeacherNames(entry.teacher);
  const teachers: CardTextRun[][] =
    adjustedHeightPx > TEACHER_ROOM_MIN_HEIGHT_PX && teacherNames.length > 0
      ? simpleLines(
          teacherNames.flatMap(name =>
            wrapText(name, innerWidthPx, 'meta', metaSize, measure)
          ),
          'meta',
          metaSize,
          'meta'
        )
      : [];

  // ── Sal: en rad, `truncate` på skärmen ──
  const room: CardTextRun[][] =
    adjustedHeightPx > TEACHER_ROOM_MIN_HEIGHT_PX && shownRoom
      ? simpleLines(
          [truncateToWidth(shownRoom, innerWidthPx, 'body', metaSize, measure)],
          'body',
          metaSize,
          'meta'
        )
      : [];

  // ── Anteckningar. `.pdf-export` släpper `line-clamp-4`, så inget tak här ──
  let notes: CardTextRun[][] =
    entry.notes && adjustedHeightPx > NOTES_MIN_HEIGHT_PX
      ? simpleLines(
          wrapText(entry.notes, innerWidthPx, 'body', metaSize, measure),
          'body',
          metaSize,
          'notes'
        )
      : [];
  const notesWanted = notes.length;

  const heightOf = (blocks: CardTextRun[][][]) =>
    blocks.reduce(
      (sum, block) =>
        sum + block.reduce((inner, l) => inner + lineHeight(l[0]?.sizePx ?? 0), 0),
      0
    );
  const fits = () => heightOf([header, title, teachers, room, notes]) <= innerHeightPx;

  let truncated = false;

  // 1. Anteckningarna ger vika först — de ligger sist i flödet.
  while (notes.length > 0 && !fits()) notes = notes.slice(0, -1);
  if (notes.length < notesWanted) {
    truncated = true;
    if (notes.length > 0) {
      notes = [...notes.slice(0, -1), withEllipsis(notes[notes.length - 1], innerWidthPx, measure)];
    }
  }

  // 2. Räcker inte det får titeln lämna rader, ned till en.
  const titleWanted = title.length;
  while (title.length > 1 && !fits()) title = title.slice(0, -1);
  if (title.length < titleWanted) {
    truncated = true;
    title = [...title.slice(0, -1), withEllipsis(title[title.length - 1], innerWidthPx, measure)];
  }

  // 3. Sista utvägen: släpp hela rader nedifrån. Sal och lärare klipps på
  //    skärmen av `overflow: hidden` — här försvinner de i stället helt.
  const tail = [...title, ...teachers, ...room, ...notes];
  let kept = tail.length;
  while (kept > 0 && heightOf([header, tail.slice(0, kept)]) > innerHeightPx) {
    kept -= 1;
    truncated = true;
  }

  const ordered = [...header, ...tail.slice(0, kept)];

  let topPx = 0;
  const lines: CardTextLine[] = ordered.map(runs => {
    const lineHeightPx = lineHeight(runs[0]?.sizePx ?? 0);
    const line: CardTextLine = { runs, topPx, lineHeightPx };
    topPx += lineHeightPx;
    return line;
  });

  return { lines, truncated };
};
