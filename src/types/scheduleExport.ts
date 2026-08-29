import { PageMode } from '@/utils/schedulePdf/theme';
import { PlanningDayResult } from '@/utils/planningTime';
import { ScheduledEntry } from './schedule';

/**
 * Allt exporten behöver för att rita schemat utan att röra DOM:en.
 *
 * Byggs av `NewSchedulePlanner` ur saker den redan har. Att det är ett
 * explicit objekt och inte en bred hook-signatur gör att ett testfixtur är
 * ett vanligt objekt.
 */
export type ScheduleExportInput = {
  schedule: ScheduledEntry[];
  /**
   * Filtret och uteslutningslistan sammanslagna. Ett kort som inte matchar
   * filtret renderas som `null` på skärmen och ska inte heller finnas i filen.
   */
  isVisible: (entry: ScheduledEntry) => boolean;
  /** `createColorResolver(colorTriggers)` — färgreglerna gäller när kortet ritas. */
  resolveColor: (title: string, fallbackColor: string) => string;
  /** `createRoomResolver(roomTriggers)` — fyller bara i tomma salfält. */
  resolveRoom: (title: string, currentRoom?: string) => string;
  /**
   * Satt bara i planeringsläge. Då ritar exporten luckor i stället för
   * lektioner, precis som skärmen gör.
   */
  planningByDay: Record<string, PlanningDayResult> | null;
  /** Sluttid för planeringsblock som sträcker sig förbi sista lektionen. */
  extraEndMinutes?: number;
  /** Visas i rubrikraden. `null` ger "Schema". */
  archiveName?: string | null;
  /** Injicerbar för testbarhet. Default är nu. */
  exportedAt?: Date;
  pageMode: PageMode;
};
