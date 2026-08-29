/**
 * Schemadata in, scen ut. Ingen DOM, inget jsPDF, inga sidoeffekter.
 *
 * Det som gör den här filen möjlig är att planeraren redan är en vektorritning
 * uttryckt i DOM: 2 px per minut, absolutpositionerade kort och en
 * kolumnpackning (`buildDayLayout`) som redan är ren datalogik. Scenen ärver
 * allt det och lägger bara till text som är utlagd i förväg.
 *
 * Två paritetsfällor värda att känna till, båda speglade nedan: kolumnlayouten
 * och `isLastOfDay` räknas på **alla** dagens poster på skärmen, även dem som
 * filtrerats bort — inte på de synliga.
 */

import { PLANNER_DAYS } from '@/components/schedule/constants';
import { ScheduleExportInput } from '@/types/scheduleExport';
import { formatMinutes } from '@/utils/scheduleStats';
import { buildDayLayout } from '@/utils/scheduleLayout';
import { EVENT_GAP_PX, MIN_HEIGHT_PX, minutesToTime, timeToMinutes } from '@/utils/scheduleTime';
import { computeExportWindow, ExportWindow, gridYForMinutes } from './exportWindow';
import { layoutCardText, CardColorRole } from './cardLayout';
import { TextMeasurer } from './measure';
import { BLACK, flatten, parseColor, Rgb, SceneNode, ScheduleScene } from './scene';
import { computeTransform } from './transform';
import * as T from './theme';

const extractUrl = (value?: string) => {
  if (!value) return null;
  const match = value.match(/https?:\/\/[^\s]+/i);
  return match ? match[0] : null;
};

const formatExportDate = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

/** Baslinjen för en rad vars box börjar på `topPx`. */
const baseline = (topPx: number, sizePx: number, measure: TextMeasurer, font: Parameters<TextMeasurer['ascentRatio']>[0]) =>
  topPx + (sizePx * T.LINE_HEIGHT_FACTOR - sizePx) / 2 + sizePx * measure.ascentRatio(font);

export const buildScene = (
  input: ScheduleExportInput,
  measure: TextMeasurer
): ScheduleScene => {
  const window = computeExportWindow({
    entries: input.schedule,
    isVisible: input.isVisible,
    extraEndMinutes: input.extraEndMinutes,
  });
  const transform = computeTransform(input.pageMode, window.sceneHeightPx);
  const widthPx = transform.sceneWidthPx;
  const heightPx = window.sceneHeightPx;

  const nodes: SceneNode[] = [];
  const truncatedInstanceIds: string[] = [];

  const gridTopPx = T.TITLE_H_PX + T.HEADER_H_PX;
  const dayAreaXPx = T.TIME_AXIS_W_PX;
  const dayWidthPx = (widthPx - dayAreaXPx) / PLANNER_DAYS.length;

  nodes.push({ kind: 'rect', x: 0, y: 0, w: widthPx, h: heightPx, fill: parseColor(T.COLOR_PAGE_BG) });

  drawTitleBar(nodes, input, widthPx, measure);
  drawDayHeader(nodes, widthPx, dayAreaXPx, dayWidthPx, measure);
  drawTimeAxis(nodes, window, gridTopPx, heightPx, measure);
  drawColumns(nodes, window, widthPx, dayAreaXPx, dayWidthPx, gridTopPx, heightPx);

  PLANNER_DAYS.forEach((day, dayIndex) => {
    const columnXPx = dayAreaXPx + dayIndex * dayWidthPx;
    if (input.planningByDay) {
      drawPlanningDay(nodes, input.planningByDay[day], window, columnXPx, dayWidthPx, measure);
      return;
    }
    drawLessonDay(nodes, truncatedInstanceIds, input, day, window, columnXPx, dayWidthPx, measure);
  });

  return { widthPx, heightPx, transform, nodes, truncatedInstanceIds };
};

// ── Rubrikrad ──

const drawTitleBar = (
  nodes: SceneNode[],
  input: ScheduleExportInput,
  widthPx: number,
  measure: TextMeasurer
) => {
  const padX = 6;
  const label = input.archiveName?.trim() || 'Schema';
  const date = formatExportDate(input.exportedAt ?? new Date());

  const titleTop = (T.TITLE_H_PX - T.TITLE_FONT_SIZE_PX * T.LINE_HEIGHT_FACTOR) / 2;
  nodes.push({
    kind: 'text',
    x: padX,
    y: baseline(titleTop, T.TITLE_FONT_SIZE_PX, measure, 'title'),
    text: label,
    font: 'title',
    sizePx: T.TITLE_FONT_SIZE_PX,
    color: parseColor(T.COLOR_TITLE_TEXT),
  });

  const dateTop = (T.TITLE_H_PX - T.TITLE_DATE_FONT_SIZE_PX * T.LINE_HEIGHT_FACTOR) / 2;
  nodes.push({
    kind: 'text',
    x: widthPx - padX,
    y: baseline(dateTop, T.TITLE_DATE_FONT_SIZE_PX, measure, 'body'),
    text: date,
    font: 'body',
    sizePx: T.TITLE_DATE_FONT_SIZE_PX,
    color: parseColor(T.COLOR_TITLE_DATE),
    align: 'right',
  });
};

// ── Dagrubrik ──

const drawDayHeader = (
  nodes: SceneNode[],
  widthPx: number,
  dayAreaXPx: number,
  dayWidthPx: number,
  measure: TextMeasurer
) => {
  const top = T.TITLE_H_PX;
  nodes.push({
    kind: 'rect',
    x: 0, y: top, w: widthPx, h: T.HEADER_H_PX,
    fill: parseColor(T.COLOR_DAY_HEADER_BG),
  });

  const textTop = top + (T.HEADER_H_PX - T.DAY_HEADER_RULE_W_PX - T.FONT_SIZE_SM_PX * T.LINE_HEIGHT_FACTOR) / 2;
  PLANNER_DAYS.forEach((day, index) => {
    const x = dayAreaXPx + index * dayWidthPx;
    nodes.push({
      kind: 'text',
      x: x + dayWidthPx / 2,
      y: baseline(textTop, T.FONT_SIZE_SM_PX, measure, 'title'),
      text: day,
      font: 'title',
      sizePx: T.FONT_SIZE_SM_PX,
      color: parseColor(T.COLOR_CARD_TEXT),
      align: 'center',
    });
    // `last:border-0` — ingen linje efter fredag.
    if (index < PLANNER_DAYS.length - 1) {
      nodes.push({
        kind: 'line',
        x1: x + dayWidthPx, y1: top, x2: x + dayWidthPx, y2: top + T.HEADER_H_PX,
        stroke: parseColor(T.COLOR_COLUMN_BORDER),
        strokeWidth: 1,
      });
    }
  });

  const ruleY = top + T.HEADER_H_PX - T.DAY_HEADER_RULE_W_PX / 2;
  nodes.push({
    kind: 'line',
    x1: 0, y1: ruleY, x2: widthPx, y2: ruleY,
    stroke: parseColor(T.COLOR_DAY_HEADER_RULE),
    strokeWidth: T.DAY_HEADER_RULE_W_PX,
  });
};

// ── Tidsaxel ──

const drawTimeAxis = (
  nodes: SceneNode[],
  window: ExportWindow,
  gridTopPx: number,
  heightPx: number,
  measure: TextMeasurer
) => {
  nodes.push({
    kind: 'rect',
    x: 0, y: gridTopPx, w: T.TIME_AXIS_W_PX, h: heightPx - gridTopPx,
    fill: parseColor(T.COLOR_TIME_AXIS_BG),
  });

  // Etiketterna går till och med sluttimmen — en fler än rutnätslinjerna.
  for (let minutes = window.startMinutes; minutes <= window.endMinutes; minutes += 60) {
    const y = gridYForMinutes(minutes, window);
    const top = y - (T.FONT_SIZE_XS_PX * T.LINE_HEIGHT_FACTOR) / 2;
    nodes.push({
      kind: 'text',
      x: T.TIME_AXIS_W_PX - 4,
      y: baseline(top, T.FONT_SIZE_XS_PX, measure, 'title'),
      text: `${Math.floor(minutes / 60)}:00`,
      font: 'title',
      sizePx: T.FONT_SIZE_XS_PX,
      color: parseColor(T.COLOR_TIME_AXIS_TEXT),
      align: 'right',
    });
  }
};

// ── Dagkolumner och rutnätslinjer ──

const drawColumns = (
  nodes: SceneNode[],
  window: ExportWindow,
  widthPx: number,
  dayAreaXPx: number,
  dayWidthPx: number,
  gridTopPx: number,
  heightPx: number
) => {
  nodes.push({
    kind: 'rect',
    x: dayAreaXPx, y: gridTopPx, w: widthPx - dayAreaXPx, h: heightPx - gridTopPx,
    fill: parseColor(T.COLOR_DAY_COLUMN_BG),
  });

  // `DayColumn` ritar en linje färre än axeln har etiketter: den understa
  // skulle sammanfalla med kolumnens underkant.
  const gridLine = parseColor(T.COLOR_GRID_LINE);
  for (let minutes = window.startMinutes; minutes < window.endMinutes; minutes += 60) {
    const y = gridYForMinutes(minutes, window);
    nodes.push({
      kind: 'line',
      x1: dayAreaXPx, y1: y, x2: widthPx, y2: y,
      stroke: gridLine,
      strokeWidth: 1,
    });
  }

  const border = parseColor(T.COLOR_COLUMN_BORDER);
  PLANNER_DAYS.forEach((_, index) => {
    const x = dayAreaXPx + (index + 1) * dayWidthPx;
    nodes.push({
      kind: 'line',
      x1: x, y1: gridTopPx, x2: x, y2: heightPx,
      stroke: border,
      strokeWidth: 1,
    });
  });
};

// ── Lektioner ──

const drawLessonDay = (
  nodes: SceneNode[],
  truncatedInstanceIds: string[],
  input: ScheduleExportInput,
  day: string,
  window: ExportWindow,
  columnXPx: number,
  dayWidthPx: number,
  measure: TextMeasurer
) => {
  // Skärmen räknar både kolumnlayout och `isLastOfDay` på dagens *alla*
  // poster. Speglas det inte byter tidsetiketten form på till synes
  // slumpmässiga kort när ett filter är aktivt.
  const dayEntries = input.schedule.filter(entry => entry.day === day);
  const layout = buildDayLayout(dayEntries);
  const lastEndMinutes = dayEntries.reduce(
    (latest, entry) => Math.max(latest, timeToMinutes(entry.endTime)),
    Number.NEGATIVE_INFINITY
  );

  dayEntries
    .filter(entry => input.isVisible(entry))
    .forEach(entry => {
      const placement = layout.get(entry.instanceId);
      const columnIndex = placement?.column ?? 0;
      const columnCount = Math.max(placement?.columns ?? 1, 1);
      const slotWidth = dayWidthPx / columnCount;

      const x = columnXPx + slotWidth * columnIndex + T.CARD_INSET_X_PX;
      const w = slotWidth - T.CARD_INSET_X_PX * 2;
      const y = gridYForMinutes(timeToMinutes(entry.startTime), window) + EVENT_GAP_PX / 2;
      const h = Math.max(entry.duration * 2 - EVENT_GAP_PX, MIN_HEIGHT_PX);

      const fill = parseColor(input.resolveColor(entry.title, entry.color));
      nodes.push({
        kind: 'rect',
        x, y, w, h,
        radius: Math.min(T.CARD_RADIUS_PX, h / 2, w / 2),
        fill,
        stroke: flatten(BLACK, T.CARD_BORDER_ALPHA, fill),
        strokeWidth: T.CARD_BORDER_W_PX,
      });

      const layoutResult = layoutCardText({
        entry,
        shownRoom: input.resolveRoom(entry.title, entry.room),
        adjustedHeightPx: h,
        innerWidthPx: w - T.CARD_PAD_X_PX * 2,
        isLastOfDay: timeToMinutes(entry.endTime) === lastEndMinutes,
        measure,
      });
      if (layoutResult.truncated) truncatedInstanceIds.push(entry.instanceId);

      pushCardText(nodes, layoutResult.lines, x, y, w, fill, measure);

      const url = extractUrl(entry.category);
      if (url) nodes.push({ kind: 'link', x, y, w, h, url });
    });
};

const cardTextColor = (role: CardColorRole, fill: Rgb): Rgb => {
  switch (role) {
    case 'time':
      // `opacity-70` förblandad mot kortfärgen — inget ExtGState att läcka.
      return flatten(BLACK, T.CARD_TIME_ALPHA, fill);
    case 'meta':
      return parseColor(T.COLOR_CARD_META);
    case 'notes':
      return parseColor(T.COLOR_CARD_NOTES);
    default:
      return parseColor(T.COLOR_CARD_TEXT);
  }
};

const pushCardText = (
  nodes: SceneNode[],
  lines: ReturnType<typeof layoutCardText>['lines'],
  cardX: number,
  cardY: number,
  cardW: number,
  fill: Rgb,
  measure: TextMeasurer
) => {
  for (const line of lines) {
    let cursorX = cardX + T.CARD_PAD_X_PX;
    const top = cardY + T.CARD_PAD_TOP_PX + line.topPx;
    for (const run of line.runs) {
      cursorX += run.gapBeforePx;
      nodes.push({
        kind: 'text',
        x: cursorX,
        y: baseline(top, run.sizePx, measure, run.font),
        text: run.text,
        font: run.font,
        sizePx: run.sizePx,
        color: cardTextColor(run.role, fill),
      });
      cursorX += measure.width(run.text, run.font, run.sizePx);
    }
  }
};

// ── Planeringsläge ──

const drawPlanningDay = (
  nodes: SceneNode[],
  result: { blocks: { start: number; end: number }[]; isDayOff: boolean } | undefined,
  window: ExportWindow,
  columnXPx: number,
  dayWidthPx: number,
  measure: TextMeasurer
) => {
  if (!result) return;

  if (result.isDayOff) {
    const x = columnXPx + 4;
    const w = dayWidthPx - 8;
    const h = T.FONT_SIZE_XS_PX * T.LINE_HEIGHT_FACTOR + 8;
    const y = gridYForMinutes(window.startMinutes, window) + 8;
    nodes.push({
      kind: 'rect',
      x, y, w, h,
      radius: T.CARD_RADIUS_PX,
      fill: parseColor(T.COLOR_DAYOFF_BG),
      stroke: parseColor(T.COLOR_DAYOFF_BORDER),
      strokeWidth: 2,
    });
    nodes.push({
      kind: 'text',
      x: x + w / 2,
      y: baseline(y + 4, T.FONT_SIZE_XS_PX, measure, 'title'),
      text: 'LEDIG',
      font: 'title',
      sizePx: T.FONT_SIZE_XS_PX,
      color: parseColor(T.COLOR_CARD_TEXT),
      align: 'center',
      charSpacePx: T.FONT_SIZE_XS_PX * T.DAYOFF_LETTER_SPACING_EM,
    });
    return;
  }

  const fill = parseColor(T.COLOR_PLANNING_BG);
  for (const block of result.blocks) {
    const x = columnXPx + T.CARD_INSET_X_PX;
    const w = dayWidthPx - T.CARD_INSET_X_PX * 2;
    const y = gridYForMinutes(block.start, window) + EVENT_GAP_PX / 2;
    const h = Math.max((block.end - block.start) * 2 - EVENT_GAP_PX, MIN_HEIGHT_PX);

    nodes.push({
      kind: 'rect',
      x, y, w, h,
      radius: Math.min(T.CARD_RADIUS_PX, h / 2, w / 2),
      fill,
      stroke: flatten(BLACK, T.PLANNING_BORDER_ALPHA, fill),
      strokeWidth: T.PLANNING_BORDER_W_PX,
      dash: [T.PLANNING_DASH_PX, T.PLANNING_DASH_PX],
    });

    let top = y + T.CARD_PAD_TOP_PX;
    const push = (text: string, font: 'mono' | 'title' | 'meta', sizePx: number, color: Rgb) => {
      nodes.push({
        kind: 'text',
        x: x + T.CARD_PAD_X_PX,
        y: baseline(top, sizePx, measure, font),
        text, font, sizePx, color,
      });
      top += sizePx * T.LINE_HEIGHT_FACTOR;
    };

    push(
      `${minutesToTime(block.start)}–${minutesToTime(block.end)}`,
      'mono',
      T.FONT_SIZE_2XS_PX,
      flatten(BLACK, T.CARD_TIME_ALPHA, fill)
    );

    if (h >= T.PLANNING_COMPACT_HEIGHT_PX) {
      push('Planering', 'title', T.FONT_SIZE_SM_PX, parseColor(T.COLOR_CARD_TEXT));
      push(formatMinutes(block.end - block.start), 'meta', T.FONT_SIZE_XS_PX, parseColor(T.COLOR_CARD_META));
    }
  }
};
