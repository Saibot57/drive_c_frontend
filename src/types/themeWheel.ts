/**
 * Typer för temakalendern ("årshjulet").
 *
 * Ett hjul är en termin eller ett tema uppdelat i lika stora tårtbitar – en per
 * kalendervecka. Varje arbetsområde läggs som en båge över en eller flera
 * veckor, och överlappande bågar staplas utåt i ringar från mitten.
 */

/** En milstolpe i ett arbetsområde, t.ex. "Inlämning" eller "Prov". */
export interface ThemeMilestone {
  label: string;
  /** ISO-datum ("2026-10-12"). Valfritt – veckan räcker för att rita ut den. */
  date?: string;
  /** Hjulindex (0-baserat), inte kalendervecka. */
  week: number;
}

/**
 * En återanvändbar byggsten i biblioteket. Motsvarar PlannerCourse i
 * schemaplaneraren: mallen man drar ut i hjulet.
 */
export interface ThemeArea {
  id: string;
  title: string;
  color: string;
  comment?: string;
}

/**
 * Ett placerat arbetsområde i hjulet.
 *
 * startWeek/endWeek är **hjulindex** (0 .. weekCount-1), inklusive i båda
 * ändar, inte kalenderveckor. Det gör att ett helt hjul kan flyttas till en ny
 * termin genom att bara ändra ThemeWheel.startWeek.
 */
export interface ThemeBlock {
  instanceId: string;
  /** Kopplingen till biblioteket. Saknas när blocket skapats direkt i hjulet. */
  areaId?: string;
  title: string;
  color: string;
  comment?: string;
  startWeek: number;
  endWeek: number;
  /**
   * Manuellt vald ring. Utan värde tilldelas ringen automatiskt av
   * buildRingLayout(), på samma sätt som kolumnerna i dagsschemat.
   */
  ring?: number;
  milestone?: ThemeMilestone;
}

export interface ThemeWheel {
  id: string;
  name: string;
  /** Kalendervecka som hjulets första tårtbit motsvarar, t.ex. 34. */
  startWeek: number;
  /** ISO-veckoår för startveckan. Hjulet får korsa ett årsskifte. */
  startYear: number;
  /** Antal tårtbitar. */
  weekCount: number;
  /** Hjulindex för veckor som är lov och därför inte räknas som arbetstid. */
  holidayWeeks: number[];
  blocks: ThemeBlock[];
}

/** Listvyn i arkivpanelen behöver inte bågarna. */
export interface ThemeWheelSummary {
  id: string;
  name: string;
  startWeek: number;
  startYear: number;
  weekCount: number;
  holidayWeeks: number[];
  updatedAt?: string;
}

export interface PersistedThemeWheelState {
  version: number;
  timestamp: string;
  wheel: ThemeWheel;
}
