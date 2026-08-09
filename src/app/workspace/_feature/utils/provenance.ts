/**
 * Härkomst: har källan ändrats sedan stickligen togs?
 *
 * Sticklingarna hämtar aldrig om sig själva — det är hela poängen, eftersom en
 * levande koppling hade rivit arrangemanget användaren byggt. Men då blir det
 * här lagrets ansvar att säga sanningen om att ytan åldrats. Utan det är
 * "frysta kopior är tryggt" bara halva löftet.
 *
 * Jämförelsen görs på en signatur av de fält som faktiskt påverkar det som
 * ritas. `capturedAt` är alltid olika och `straight` respektive `showRuler` hör
 * till arrangemanget, inte till källan.
 */

import type { ThemeWheel } from '@/types/themeWheel';
import type { PlannerActivity } from '@/types/schedule';
import type { WheelPartContent } from '../types/wheelPart.types';
import type { ScheduleDayContent, ScheduleDayEntry } from '../types/scheduleDay.types';
import { buildWheelParts } from './wheelExplode';
import { groupActivitiesByDay } from './scheduleDayImport';

export type ProvenanceStatus =
  /** Källan säger samma sak som stickligen. */
  | 'fresh'
  /** Källan har ändrats. Kortet visar en prick och kan uppdateras. */
  | 'drifted'
  /** Blocket eller arkivet finns inte längre. Ingen uppdatering att erbjuda. */
  | 'missing'
  /** Gick inte att kontrollera — nätet, inloggningen, något annat. */
  | 'unknown';

export interface ProvenanceEntry {
  status: ProvenanceStatus;
  /** Grupperar element som kommer från samma ställe. */
  sourceKey: string;
  sourceLabel: string;
  /** Vad källan skulle ge nu. Satt bara när status är 'drifted'. */
  fresh?: WheelPartContent | ScheduleDayContent;
}

/** Två element med samma nyckel hämtas i ett anrop, inte ett per kort. */
export const wheelSourceKey = (wheelId: string) => `wheel:${wheelId}`;
export const scheduleSourceKey = (archiveName: string | null) =>
  `schedule:${archiveName ?? ''}`;

const canonical = (value: unknown): string => JSON.stringify(value ?? null);

/**
 * Signaturen för en hjuldel.
 *
 * Ringen och veckospannet kommer ur `buildRingLayout`, som räknar på *hela*
 * hjulet — så ett nytt block någon annanstans slår igenom här. Det är avsiktligt:
 * det är precis den sortens ändring som hade flyttat kortet om kopplingen varit
 * levande, och därför den användaren behöver få veta om.
 */
export const wheelPartSignature = (content: WheelPartContent): string => canonical([
  content.title,
  content.color,
  content.comment ?? null,
  content.parentId ?? null,
  content.areaId ?? null,
  content.milestone ?? null,
  content.startWeek,
  content.endWeek,
  content.ring,
  content.lane,
  content.weekCount,
  content.ringCount,
  content.ringsWithChildren,
  content.holidayWeeks,
  content.wheelStartWeek ?? null,
  content.wheelStartYear ?? null,
]);

export const scheduleDaySignature = (entries: ScheduleDayEntry[]): string => canonical(
  entries.map((e) => [
    e.instanceId, e.title, e.startTime, e.endTime, e.duration,
    e.color, e.teacher ?? null, e.room ?? null, e.notes ?? null,
  ]),
);

/**
 * Innehållet en del skulle ha om den hämtades nu, med arrangemanget bevarat.
 * Krökt eller rakt är användarens val och får inte skrivas över av källan.
 */
export const mergeWheelPart = (
  frozen: WheelPartContent,
  fresh: WheelPartContent,
): WheelPartContent => ({
  ...fresh,
  straight: frozen.straight,
  capturedAt: new Date().toISOString(),
});

/**
 * Fönstret och linjalen hör till arrangemanget och behålls.
 *
 * Det gäller även när en lektion numera ligger utanför fönstret: kortet får
 * rulla i stället. Fönstret finns till för att dagarna ska linjera med
 * varandra, och en uppdatering av en dag ska inte kunna bryta upp veckan.
 */
export const mergeScheduleDay = (
  frozen: ScheduleDayContent,
  entries: ScheduleDayEntry[],
): ScheduleDayContent => ({
  ...frozen,
  entries,
  capturedAt: new Date().toISOString(),
});

/** Delen som hjulet skulle ge för samma block nu, eller null om blocket är borta. */
export const currentWheelPart = (
  wheel: ThemeWheel,
  frozen: WheelPartContent,
): WheelPartContent | null => {
  const drafts = buildWheelParts(wheel, frozen.straight ? 'unroll' : 'explode', frozen.capturedAt);
  return drafts.find((d) => d.content.instanceId === frozen.instanceId)?.content ?? null;
};

/** Lektionerna källan har för dagen nu. Tom lista om dagen tömts. */
export const currentScheduleDay = (
  activities: PlannerActivity[],
  day: string,
): ScheduleDayEntry[] => groupActivitiesByDay(activities).get(day) ?? [];
