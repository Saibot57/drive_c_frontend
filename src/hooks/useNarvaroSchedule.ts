'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { COLOR_TRIGGERS_KEY, ROOM_TRIGGERS_KEY } from '@/config/plannerConstants';
import { usePersistentState } from '@/hooks/usePersistentState';
import { mapPlannerActivitiesToSchedule } from '@/hooks/usePlannerSync';
import { plannerService } from '@/services/plannerService';
import type { ColorTriggerRule, PlannerArchiveSummary, RoomTriggerRule, ScheduledEntry } from '@/types/schedule';
import { createColorResolver, sanitizeColorTriggers } from '@/utils/colorTriggers';
import { archiveForWeek, effectiveScheduleName, sanitizeScheduleName } from '@/utils/narvaroSchedule';
import { createRoomResolver, sanitizeRoomTriggers } from '@/utils/roomTriggers';

/**
 * Veckans schema för Närvarorutor, läst ur schemaplaneraren. Bara läsanrop
 * (GET): inget om närvaron skickas hit. Ett fel sväljs och veckan blir
 * `null`, så att sidan fungerar som utan schema. `fetchWithAuth` sköter 401.
 * Se docs/plans/narvaro-schemakoppling.md, avsnitt 6.
 */

export type WeekSchedule = { archiveId: string; name: string; entries: ScheduledEntry[] };
/** `undefined` = inte hämtad än, `null` = veckan har inget schema eller gick inte att läsa. */
export type ScheduleWeeks = Record<string, WeekSchedule | null | undefined>;

/** Högst så ofta hämtas schemat om när fönstret får fokus igen. */
export const SCHEDULE_REFRESH_MS = 60_000;

const NO_WEEKS: ScheduleWeeks = {};
const NO_COLOR_TRIGGERS: ColorTriggerRule[] = [];
const NO_ROOM_TRIGGERS: RoomTriggerRule[] = [];

/**
 * `enabled` är falskt för exemplet och innan närvaron är upplåst. Den
 * aktuella veckan hämtas direkt, andra veckor med `ensureWeek`.
 */
export function useNarvaroSchedule(enabled: boolean, currentWeek: string) {
  const [weeks, setWeeks] = useState<ScheduleWeeks>(NO_WEEKS);
  const list = useRef<Promise<PlannerArchiveSummary[]> | null>(null);
  const requested = useRef(new Set<string>());
  const lastFetch = useRef(0);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; };
  }, []);

  const archives = useCallback((force: boolean) => {
    if (!list.current || force) {
      const p = plannerService.listArchives().catch(() => {
        // Nästa vecka som efterfrågas försöker igen.
        if (list.current === p) list.current = null;
        return [] as PlannerArchiveSummary[];
      });
      list.current = p;
    }
    return list.current;
  }, []);

  const loadWeek = useCallback(async (week: string, force = false) => {
    if (!force && requested.current.has(week)) return;
    requested.current.add(week);
    const set = (value: WeekSchedule | null) => {
      if (alive.current) setWeeks(prev => ({ ...prev, [week]: value }));
    };
    const id = archiveForWeek(week, await archives(force));
    if (!id) { set(null); return; }
    try {
      const result = await plannerService.getArchiveActivities(id);
      set({ archiveId: id, name: result.archive?.name ?? '', entries: mapPlannerActivitiesToSchedule(result.activities) });
    } catch {
      set(null);
    }
  }, [archives]);

  useEffect(() => {
    if (!enabled) return;
    lastFetch.current = Date.now();
    void loadWeek(currentWeek);
  }, [enabled, currentWeek, loadWeek]);

  // En ändring i Schema i en annan flik syns när man kommer tillbaka hit.
  useEffect(() => {
    if (!enabled) return;
    const refresh = () => {
      if (document.visibilityState === 'hidden') return;
      if (Date.now() - lastFetch.current < SCHEDULE_REFRESH_MS) return;
      lastFetch.current = Date.now();
      void loadWeek(currentWeek, true);
    };
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [enabled, currentWeek, loadWeek]);

  const ensureWeek = useCallback((week: string) => {
    if (enabled) void loadWeek(week);
  }, [enabled, loadWeek]);

  // Schemats färg- och salsregler ligger per enhet, som i planeraren.
  const [colorTriggers] = usePersistentState(COLOR_TRIGGERS_KEY, sanitizeColorTriggers, NO_COLOR_TRIGGERS);
  const [roomTriggers] = usePersistentState(ROOM_TRIGGERS_KEY, sanitizeRoomTriggers, NO_ROOM_TRIGGERS);
  const resolveColor = useMemo(() => createColorResolver(colorTriggers), [colorTriggers]);
  const resolveRoom = useMemo(() => createRoomResolver(roomTriggers), [roomTriggers]);

  return { weeks: enabled ? weeks : NO_WEEKS, ensureWeek, resolveColor, resolveRoom };
}

/** Vem användaren är i schemats lärarfält, per enhet. Inget elevnamn. */
export const SCHEDULE_NAME_KEY = 'narvaro.scheduleName.v1';

/**
 * Namnet: det sparade, annars användarnamnet om det står bland veckans
 * lärare. Tomt när inget av dem finns, och då frågar sidan.
 */
export function useNarvaroScheduleName(username: string | null | undefined, teacherNames: string[]) {
  const [saved, setSaved] = usePersistentState(SCHEDULE_NAME_KEY, sanitizeScheduleName, '');
  const name = effectiveScheduleName(saved, username, teacherNames);
  return { name, setName: setSaved as (next: string) => void };
}
