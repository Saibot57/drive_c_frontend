export const PLANNER_DAYS = ['Måndag', 'Tisdag', 'Onsdag', 'Torsdag', 'Fredag'] as const;

export const COURSE_COLOR_PALETTE = [
  '#ffffff',
  '#fde68a',
  '#bae6fd',
  '#d9f99d',
  '#fecdd3',
  '#c7d2fe',
  '#a7f3d0',
  '#ddd6fe',
  '#fed7aa'
] as const;

export const DEFAULT_COURSE_COLOR = '#ffffff';

/**
 * Längsta text i postens fält, samma som kolumnerna i backendens
 * planner_activity. Längre text avvisas av servern för hela veckan.
 */
export const ENTRY_FIELD_MAX_LENGTH = {
  title: 150,
  teacher: 150,
  room: 150,
  category: 255,
} as const;

/** Längd för en post vars egen längd saknas eller är orimlig. */
export const FALLBACK_ENTRY_DURATION_MINUTES = 60;

export const RECENT_CUSTOM_COLORS_KEY = 'planner_recent_custom_colors';
export const MAX_RECENT_CUSTOM_COLORS = 3;
export const MANUAL_COURSES_KEY = 'planner_manual_courses_v1';
export const DERIVED_COURSE_PREFIX = 'gen_';
export const TEACHERS_KEY = 'app.teachers.v1';
export const ROOMS_KEY = 'app.rooms.v1';
export const TEACHER_AVAILABILITY_KEY = 'app.teacher_availability.v1';
export const COLOR_TRIGGERS_KEY = 'app.color_triggers.v1';
export const ROOM_TRIGGERS_KEY = 'app.room_triggers.v1';
export const PLANNING_MIN_GAP_KEY = 'app.planning_min_gap.v1';
export const EXPORT_EXCLUDE_KEY = 'app.export_exclude.v1';
export const PASTE_PROTECT_KEY = 'app.paste_protect.v1';
/**
 * Titlar som inte tar emot inklistrade anteckningar när man markerar flera
 * poster på en gång. Till skillnad från exportlistan står den kvar — en paus
 * är en paus även nästa vecka.
 */
export const DEFAULT_PASTE_PROTECT = ['Lunch', 'Paus', 'Rast'];
/** Sparade urval: vilka pass en viss deltagare ska se. */
export const SCHEDULE_SELECTIONS_KEY = 'app.schedule_selections.v1';
export const SELECTION_DEFAULTS_KEY = 'app.selection_defaults.v1';
/** Titlar som är ikryssade i ett nytt urval — pass som alla deltagare har. */
export const DEFAULT_SELECTION_DEFAULTS = ['Lunch', 'Paus', 'Rast'];
export const PLANNING_START_TIME_KEY = 'app.planning_start_time.v1';
export const PLANNING_END_TIME_KEY = 'app.planning_end_time.v1';
export const SIDEBAR_SECTIONS_KEY = 'app.planner_sections.v1';
/** Mapparna i högerpanelen som är utfällda. Det som inte står här är hopfällt. */
export const SCHEDULE_FOLDERS_EXPANDED_KEY = 'app.schedule_folders_expanded.v1';
/**
 * Kvar för att kunna flytta över den som redan har ett aktivt schema. Namnet
 * duger inte längre som nyckel när ett delat schema kan heta samma sak som ett
 * eget, så det läses en sista gång och byts mot id:t nedan.
 */
export const ACTIVE_ARCHIVE_NAME_KEY = 'active_archive_name';
export const ACTIVE_ARCHIVE_ID_KEY = 'active_archive_id';
/** Vad Nytt veckoschema utgick från senast, så att basschemat är förvalt nästa gång. */
export const NEW_SCHEDULE_SOURCE_KEY = 'app.new_schedule_source.v1';

/** Kortare luckor än så räknas inte som planeringstid. Ställs om i debug-menyn. */
export const DEFAULT_PLANNING_MIN_GAP_MINUTES = 45;

export const PLANNER_NOTICE_DISMISS_MS = 2600;
export const AUTOSAVE_DELAY_MS = 1000;
