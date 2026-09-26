export type SwedishDay =
  | 'Måndag'
  | 'Tisdag'
  | 'Onsdag'
  | 'Torsdag'
  | 'Fredag'
  | 'Lördag'
  | 'Söndag';

export interface PlannerActivity {
  id: string;
  userId?: string;
  title: string;
  day: string;
  startTime: string;
  endTime: string;
  duration: number;
  archiveName?: string | null;
  teacher?: string;
  room?: string;
  notes?: string;
  color?: string;
  category?: string;
}

/** Vem som har ett delat schema öppet just nu. */
export interface ArchiveLock {
  userId: string;
  username: string;
  acquiredAt: string | null;
  /** Sant när det är den egna fliken som håller låset. */
  isMine: boolean;
}

/**
 * Ett namngivet schema så som listan visar det. Till skillnad från förr är
 * namnet inte nyckeln — två personer kan ha varsin "v.35", och en delad "v.35"
 * kan ligga bredvid din egen.
 */
export interface PlannerArchiveSummary {
  id: string;
  name: string;
  ownerId: string;
  ownerUsername: string | null;
  isOwner: boolean;
  /** Användarnamnen som schemat delats med. Tomt för ett schema bara du ser. */
  sharedWith: string[];
  lock: ArchiveLock | null;
  updatedAt: string | null;
}

// --- Nya typer för Schema-planeraren (Timeline Version) ---

export interface PlannerCourse {
  id: string;
  title: string;
  teacher: string;
  room: string;
  color: string;
  duration: number; // Standardlängd i minuter
  category?: string;
}

export interface ScheduledEntry extends PlannerCourse {
  instanceId: string;
  day: string;
  startTime: string; // "HH:MM", t.ex "08:15"
  endTime: string;   // "HH:MM", t.ex "09:15"
  notes?: string;
}

export interface RestrictionRule {
  id: string;
  subjectA: string;
  subjectB: string;
}

/** Del av dagen som en lärare är otillgänglig. 'all' = hela dagen. */
export type TeacherDayBlock = 'all' | 'fm' | 'em';

/**
 * Lärarnamn -> dag -> spärrade delar av dagen. En dag som saknas eller har en
 * tom lista är ledig.
 */
export type TeacherAvailability = Record<string, Record<string, TeacherDayBlock[]>>;

/** Ett ord i titeln som ger posten en bestämd färg. */
export interface ColorTriggerRule {
  id: string;
  word: string;
  color: string;
}

/**
 * Ett ord i titeln som fyller postens sal. Till skillnad från färgregeln
 * ovan gäller den bara när salfältet är tomt — en ifylld sal vinner alltid.
 */
export interface RoomTriggerRule {
  id: string;
  word: string;
  room: string;
}

/**
 * Det som följer med en publik länk utöver schemat. Färg- och salsreglerna är
 * en kopia av de som annars bara finns i localStorage — utan den visar den
 * publika sidan andra färger och salar än planeraren. De dolda titlarna är
 * länkens egna och har inget med exportundantagen att göra.
 */
export interface PublicLinkDisplayConfig {
  hiddenTitles: string[];
  colorTriggers: ColorTriggerRule[];
  roomTriggers: RoomTriggerRule[];
}

/** En hemlig länk som visar ett schema utan inloggning. Ägarens bild av den. */
export interface PlannerPublicLink {
  id: string;
  token: string;
  label: string | null;
  archiveId: string | null;
  archiveName: string | null;
  enabled: boolean;
  displayConfig: PublicLinkDisplayConfig;
  createdAt: string | null;
  updatedAt: string | null;
}

/** Vad den publika sidan får. Inga id på användare eller arkiv. */
export interface PublicSchedulePayload {
  label: string | null;
  /** `null` när länken inte pekar på något schema just nu. */
  archiveName: string | null;
  updatedAt: string | null;
  activities: PlannerActivity[];
  colorTriggers: unknown;
  roomTriggers: unknown;
}

export interface PersistedPlannerState {
  version: number;
  timestamp: string;
  courses: PlannerCourse[];
  schedule: ScheduledEntry[];
  restrictions: RestrictionRule[];
  /**
   * Lärar- och sallistorna. Saknades till och med version 9, vilket gjorde en
   * mailad fil ofullständig: mottagaren fick spärrarna men inte namnen de
   * hänger på, och nästa sparning i debugmenyn rensade då bort spärrarna.
   */
  teachers?: string[];
  rooms?: string[];
  teacherAvailability?: TeacherAvailability;
  colorTriggers?: ColorTriggerRule[];
  roomTriggers?: RoomTriggerRule[];
  /** Minsta lucka som räknas som planeringstid, i minuter. */
  planningMinGap?: number;
  /** Arbetsdagens gränser i planeringsvyn, minuter från midnatt. `null` = standard. */
  planningStartMinutes?: number | null;
  planningEndMinutes?: number | null;
}
