import type { PLANNER_DAYS } from '@/config/plannerConstants';

/**
 * Typer för veckolabbet: lärare, arbetsgrupper och de fasta lektionerna som
 * arbetsgrupperna tar ansvar för.
 *
 * Allt här är ett laboratorium. Inget skrivs till schemaplaneraren, och
 * lärarnas tillgänglighet är labbets egen — den följer tavlan, inte
 * planerarens spärrar.
 */

export type LabDay = (typeof PLANNER_DAYS)[number];

export interface LabTeacher {
  id: string;
  name: string;
  /** Dagarna läraren kan undervisa. */
  days: LabDay[];
  /**
   * Resurs, till exempel studiecoach. Planerar inga lektioner och kan därför
   * varken sitta i en arbetsgrupp eller ha en klass.
   */
  resource: boolean;
}

/** Lärare som tillsammans äger och planerar en eller flera lektioner. */
export interface LabTeam {
  id: string;
  /** Lagets siffra, unik bland lagen. Visas i en ruta i lagets färg. */
  number: number;
  name: string;
  color: string;
  memberIds: string[];
}

/** Vad en lektion handlar om, t.ex. Skrivande eller NO. */
export interface LabArea {
  id: string;
  name: string;
  color: string;
  /** Mål i minuter per klass och vecka. `null` = inget mål. */
  goalMinutes: number | null;
}

/**
 * En fast lektion: en ruta på tavlan. Den går samtidigt för alla klasser,
 * och varje klass kan ha sin egen lärare.
 */
export interface LabLesson {
  id: string;
  day: LabDay;
  start: string;
  end: string;
  title: string;
  areaId: string | null;
  /** Arbetsgruppen för hela lektionen. Gäller bara när lektionen inte är delad. */
  teamId: string | null;
  /**
   * Delad lektion: klasserna kan ha var sin arbetsgrupp, i `classTeams`.
   * En hel lektion har en arbetsgrupp för alla klasser, i `teamId`.
   */
  split: boolean;
  /** Klassnamn → arbetsgrupp. Används bara när `split` är sant. */
  classTeams: Record<string, string | null>;
  /** Klassnamn → lärar-id. En klass som saknas eller är `null` har ingen lärare. */
  classTeachers: Record<string, string | null>;
  /**
   * Klasser som inte har lektionen, t.ex. när bara Grund och Rosa har tema
   * vid en viss tid i arkivet. De kan inte få arbetsgrupp eller lärare.
   */
  absentClasses?: string[];
}

/** En enskild vecka. Skapas som en kopia av mallen och ändras sedan fritt. */
export interface LabWeek {
  id: string;
  label: string;
  lessons: LabLesson[];
}

export interface LabState {
  version: 1;
  classes: string[];
  teachers: LabTeacher[];
  teams: LabTeam[];
  areas: LabArea[];
  /** Veckomallen, som gäller alla veckor som inte har ändrats. */
  template: LabLesson[];
  /**
   * Schemaplanerarens arkiv som mallen byggdes från, eller `null` för tavlan.
   * Arkivets övriga pass (matte m.m.) läses om varje gång och räknas som
   * lärarnas fasta timmar.
   */
  archiveId?: string | null;
  weeks: LabWeek[];
}

/** Ett sparat upplägg i listan, utan själva läget. */
export interface LabPlanSummary {
  id: string;
  name: string;
  /** Räknas upp av servern vid varje sparning. */
  version: number;
  createdAt: string | null;
  updatedAt: string | null;
  /**
   * Delning. Saknas när backend är äldre än delningen; då är alla upplägg
   * ens egna (se `isOwnPlan`).
   */
  ownerUsername?: string | null;
  isOwner?: boolean;
  /** Användarnamnen som upplägget delats med. */
  sharedWith?: string[];
}

/** Ett sparat upplägg: hela labbets läge under ett namn. */
export interface LabPlan extends LabPlanSummary {
  state: LabState;
}
