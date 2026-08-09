'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { themeWheelService } from '@/services/themeWheelService';
import { plannerService } from '@/services/plannerService';
import type { SurfaceElement, WorkspaceElement } from '../types/workspace.types';
import type { WheelPartContent } from '../types/wheelPart.types';
import type { ScheduleDayContent } from '../types/scheduleDay.types';
import {
  ProvenanceEntry,
  currentScheduleDay,
  currentWheelPart,
  mergeScheduleDay,
  mergeWheelPart,
  scheduleDaySignature,
  scheduleSourceKey,
  wheelPartSignature,
  wheelSourceKey,
} from '../utils/provenance';

/**
 * Kontrollerar om ytans sticklingar har hunnit bli inaktuella.
 *
 * En hämtning per källa, inte per kort: en sprängning på fjorton delar kommer
 * från ett hjul och kostar ett anrop. Resultatet är tyst — en prick på de kort
 * som avviker, ingen notis och ingen dialog. Det är skillnaden mellan att
 * berätta och att tjata, och förtroendelagret ska göra det förra.
 *
 * Kontrollen körs om när innehållet på ytan ändras. Nyckeln är en signatur av
 * elementen, inte deras identiteter, så en uppdatering som gör ett kort färskt
 * också släcker dess prick utan att någon behöver be om det.
 */
export function useProvenance(
  placements: SurfaceElement[],
  elements: Record<string, WorkspaceElement>,
) {
  const [byElement, setByElement] = useState<Map<string, ProvenanceEntry>>(new Map());
  const runId = useRef(0);

  /** Bara det som faktiskt har en källa. */
  const tracked = useMemo(() => {
    const list: { element: WorkspaceElement; content: WheelPartContent | ScheduleDayContent }[] = [];
    placements.forEach((placement) => {
      const element = elements[placement.element_id];
      if (!element || !element.content) return;
      if (element.type === 'wheel_part' || element.type === 'schedule_day') {
        list.push({ element, content: element.content as WheelPartContent | ScheduleDayContent });
      }
    });
    return list;
  }, [placements, elements]);

  // Kör om när innehållet ändras, inte bara när listan gör det. Utan
  // signaturen i beroendet skulle en uppdatering lämna pricken kvar.
  const fingerprint = useMemo(
    () => tracked
      .map(({ element, content }) => `${element.id}:${
        element.type === 'wheel_part'
          ? wheelPartSignature(content as WheelPartContent)
          : scheduleDaySignature((content as ScheduleDayContent).entries ?? [])
      }`)
      .join('|'),
    [tracked],
  );

  const check = useCallback(async () => {
    const items = tracked;
    if (items.length === 0) {
      setByElement(new Map());
      return;
    }

    // Ett gammalt svar får inte skriva över ett nyare. Ytbyten och snabba
    // uppdateringar hinner annars köra om varandra.
    const run = ++runId.current;
    const result = new Map<string, ProvenanceEntry>();

    const wheelIds = new Set<string>();
    const archives = new Set<string>();
    let needsWorkingSchedule = false;

    items.forEach(({ element, content }) => {
      if (element.type === 'wheel_part') {
        wheelIds.add((content as WheelPartContent).wheelId);
      } else {
        const name = (content as ScheduleDayContent).archiveName;
        if (name === null) needsWorkingSchedule = true;
        else archives.add(name);
      }
    });

    const wheels = new Map<string, Awaited<ReturnType<typeof themeWheelService.getWheel>> | null>();
    const schedules = new Map<string, Awaited<ReturnType<typeof plannerService.getPlannerActivities>> | null>();
    // Ett borttaget arkiv ger tom lista, inte 404 — namnlistan är enda sättet
    // att skilja "raderat" från "tomt".
    let archiveNames: string[] | null = null;

    await Promise.all([
      ...Array.from(wheelIds).map(async (id) => {
        try {
          wheels.set(id, await themeWheelService.getWheel(id));
        } catch {
          wheels.set(id, null);
        }
      }),
      ...(archives.size > 0
        ? [plannerService.getPlannerArchiveNames()
            .then((names) => { archiveNames = names; })
            .catch(() => { archiveNames = null; })]
        : []),
      ...Array.from(archives).map(async (name) => {
        try {
          schedules.set(name, await plannerService.getPlannerArchive(name));
        } catch {
          schedules.set(name, null);
        }
      }),
      ...(needsWorkingSchedule
        ? [plannerService.getPlannerActivities()
            .then((a) => { schedules.set('', a); })
            .catch(() => { schedules.set('', null); })]
        : []),
    ]);

    if (run !== runId.current) return;

    items.forEach(({ element, content }) => {
      if (element.type === 'wheel_part') {
        const frozen = content as WheelPartContent;
        const wheel = wheels.get(frozen.wheelId);
        const base = { sourceKey: wheelSourceKey(frozen.wheelId), sourceLabel: frozen.sourceName };

        if (wheel === null || wheel === undefined) {
          result.set(element.id, { ...base, status: 'unknown' });
          return;
        }
        const fresh = currentWheelPart(wheel, frozen);
        if (!fresh) {
          result.set(element.id, { ...base, status: 'missing' });
          return;
        }
        result.set(element.id, wheelPartSignature(fresh) === wheelPartSignature(frozen)
          ? { ...base, status: 'fresh' }
          : { ...base, status: 'drifted', fresh: mergeWheelPart(frozen, fresh) });
        return;
      }

      const frozen = content as ScheduleDayContent;
      const key = frozen.archiveName ?? '';
      const base = { sourceKey: scheduleSourceKey(frozen.archiveName), sourceLabel: frozen.sourceLabel };

      if (frozen.archiveName !== null && archiveNames && !archiveNames.includes(frozen.archiveName)) {
        result.set(element.id, { ...base, status: 'missing' });
        return;
      }
      const activities = schedules.get(key);
      if (activities === null || activities === undefined) {
        result.set(element.id, { ...base, status: 'unknown' });
        return;
      }
      const entries = currentScheduleDay(activities, frozen.day);
      result.set(element.id, scheduleDaySignature(entries) === scheduleDaySignature(frozen.entries ?? [])
        ? { ...base, status: 'fresh' }
        : { ...base, status: 'drifted', fresh: mergeScheduleDay(frozen, entries) });
    });

    setByElement(result);
  }, [tracked]);

  useEffect(() => {
    void check();
    // check hänger på `tracked`, som byts vid varje render. Signaturen är det
    // som verkligen avgör om kontrollen behöver köras om.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fingerprint]);

  /** Alla drivna element som delar källa med det angivna. */
  const driftedFromSameSource = useCallback((elementId: string) => {
    const entry = byElement.get(elementId);
    if (!entry) return [];
    return Array.from(byElement.entries())
      .filter(([, e]) => e.sourceKey === entry.sourceKey && e.status === 'drifted' && e.fresh)
      .map(([id, e]) => ({ elementId: id, content: e.fresh! }));
  }, [byElement]);

  return { provenance: byElement, recheck: check, driftedFromSameSource };
}
