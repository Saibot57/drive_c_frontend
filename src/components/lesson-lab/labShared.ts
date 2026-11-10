import type { LabLesson, LabState } from '@/types/lessonLab';
import type { BusyMap } from '@/utils/lessonLab';

/**
 * Delat mellan Arbetslags komponenter (`LessonLab`, `LabSchedule`, `LabTeams`,
 * `LabDragPreview`): konstanter, dragdata och vyns sammanhang.
 */

/** Klassernas färger, som i schemat: Grund senap, Oliv oliv, Rosa rosa. */
export const CLASS_COLORS: Record<string, string> = {
  Grund: '#f2c14e',
  Oliv: '#9bbf4f',
  Rosa: '#f4a6c6',
};
export const classColor = (className: string) => CLASS_COLORS[className] ?? '#e5e7eb';

export type DragData =
  | { kind: 'lesson'; lessonId: string }
  | { kind: 'part'; lessonId: string; className: string }
  | { kind: 'teacher'; teacherId: string }
  | { kind: 'brick'; lessonId: string; teamId: string };

export const SCHEDULE_DROP = 'schedule';
export const NEW_TEAM_DROP = 'new-team';
export const teamDropId = (teamId: string) => `team:${teamId}`;
export const DAY_DROP_PREFIX = 'day:';
export const lessonElementId = (lessonId: string) => `lab-lesson-${lessonId}`;

/** Lärarradens ordning, per webbläsare. Saknas den sorteras raden på skillnad mot förväntat. */
export const TEACHER_ORDER_KEY = 'lessonLab.teacherOrder.v1';
/** Släppmål på varje bricka i lärarraden: släppt där byter lärarna plats. */
export const TEACHER_SLOT_PREFIX = 'teacher-slot:';

export const lessonLabel = (lesson: LabLesson) => `${lesson.day.slice(0, 3)} ${lesson.start}`;

/** Det som fokus, bemanning och timmar behöver, samlat för komponenterna. */
export type ViewContext = {
  state: LabState;
  busy?: BusyMap;
  /** Läraren i fokus, eller `null`. */
  focusId: string | null;
  /** Lektionen som "Visa" i varningslistan pekar ut en stund. */
  flashId: string | null;
  /** Pass utan marginal visas dämpat: en liten gul ikon i stället för orange. */
  quietTight: boolean;
};
