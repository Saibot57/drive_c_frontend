import type { ThemeMilestone } from '@/types/themeWheel';

/**
 * En utbruten hjuldel — en stickling, inte en pekare.
 *
 * Till skillnad från `wheel_ref` (som bara håller ett id och hämtar hjulet vid
 * varje rendering) äger den här allt den behöver för att rita sig själv.
 *
 * Skälet är att hjulets layout är global. `buildRingLayout()` lägger varje
 * arbetsområde i lägsta lediga ring, och ringantalet styr i sin tur höjden på
 * *alla* band via `ringHeightFor()`. Ett nytt block någon annanstans i hjulet
 * skulle alltså ändra storlek och läge på delar som ligger utspridda på en yta
 * med anteckningar runt omkring — mitt i ett arrangemang användaren byggt.
 * Uppdatering är därför något användaren utlöser, inte något som sker tyst.
 *
 * Härkomsten sparas så att en delen vet var den kommer ifrån när den frågan
 * ställs (etapp 9), och så att flera delar från samma hjul går att gruppera.
 */
export interface WheelPartContent {
  // ── Härkomst ──
  wheelId: string;
  instanceId: string;
  /** Hjulets namn vid hämtningen. Visas på kortet även om hjulet döps om. */
  sourceName: string;
  /** ISO-tidpunkt för sprängningen. */
  capturedAt: string;

  // ── Blocket, fryst ──
  title: string;
  color: string;
  comment?: string;
  /** instanceId på arbetsområdet den här delen är ett delområde av. */
  parentId?: string;
  areaId?: string;
  milestone?: ThemeMilestone;

  // ── Placeringen i hjulet, fryst ──
  /** Hjulindex, inklusive i båda ändar — samma innebörd som i ThemeBlock. */
  startWeek: number;
  endWeek: number;
  ring: number;
  /** 'full' | 'parent' | 'child'. Avgör om delen dras in i sin förälders band. */
  lane: string;
  weekCount: number;
  /**
   * Hjulets startvecka och startår, för att kunna skriva ut riktiga
   * kalenderveckor på en uträtad stapel. Valfria: delar som bröts ut innan
   * fälten fanns saknar dem och visar då inget veckospann.
   */
  wheelStartWeek?: number;
  wheelStartYear?: number;
  /**
   * Hjulets ringantal och vilka ringar som hade delområden. Behövs för att
   * `buildWheelMetrics()` ska ge tillbaka exakt de radier delen ritades med —
   * ringhöjden beror på hela hjulet, inte på den enskilda ringen.
   */
  ringCount: number;
  ringsWithChildren: number[];
  /** Hjulindex för lovveckor. Används först när delen rätas ut. */
  holidayWeeks: number[];

  /**
   * Rakt läge införs i etapp 7. Fältet skrivs redan här, så att delar som
   * hämtats in dessförinnan inte behöver läsas om eller migreras.
   */
  straight: boolean;
}
