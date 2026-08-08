import { ScheduledEntry } from '@/types/schedule';

export type PlannerNoticeTone = 'success' | 'error' | 'warning';

/**
 * En knapp i notisen, för åtgärder som bara är meningsfulla direkt efter
 * händelsen — framför allt "Ångra" efter en radering. Notiser utan knapp
 * beter sig precis som förut.
 */
export interface PlannerNoticeAction {
  label: string;
  onClick: () => void;
}

export interface PlannerNotice {
  message: string;
  tone: PlannerNoticeTone;
  action?: PlannerNoticeAction;
  /** Avvikande livslängd i ms. Utelämnad betyder PLANNER_NOTICE_DISMISS_MS. */
  durationMs?: number;
}

export interface GhostPlacement {
  day: string;
  startTime: string;
  endTime: string;
  duration: number;
  color: string;
  title: string;
}

export interface ContextMenuState {
  x: number;
  y: number;
  entry: ScheduledEntry;
}
