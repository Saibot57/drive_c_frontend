import { ScheduledEntry } from '@/types/schedule';

export type PlannerNoticeTone = 'success' | 'error' | 'warning';

export interface PlannerNotice {
  message: string;
  tone: PlannerNoticeTone;
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
