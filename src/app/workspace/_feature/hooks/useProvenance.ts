'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { themeWheelService } from '@/services/themeWheelService';
import { ArchiveNotFoundError, plannerService } from '@/services/plannerService';
import type { SurfaceElement, WorkspaceElement } from '../types/workspace.types';
import type { WheelPartContent } from '../types/wheelPart.types';
import type { ScheduleDayContent } from '../types/scheduleDay.types';
import {
  ProvenanceEntry,
  ScheduleLookup,
  currentWheelPart,
  currentWheelParts,
  mergeWheelPart,
  scheduleDayProvenance,
  scheduleDaySignature,
  scheduleSourceKey,
  wheelPartSignature,
  wheelSourceKey,
} from '../utils/provenance';
import { scheduleSourceLabel } from '../utils/scheduleDayImport';

/**
 * Hämtar schemat ett kort kom från. Med id går det till schemat direkt, och
 * delade scheman nås. Kort från före id:t går på namnet, vilket bara når de
 * egna, eller på det gamla huvudschemat (archiveName null).
 */
const fetchSchedule = async (source: ScheduleDayContent): Promise<ScheduleLookup> => {
  try {
    if (source.archiveId) {
      const { archive, activities } = await plannerService.getArchiveActivities(source.archiveId);
      return { found: true, activities, label: archive ? scheduleSourceLabel(archive) : undefined };
    }
    const activities = source.archiveName === null
      ? await plannerService.getPlannerActivities()
      : await plannerService.getPlannerArchive(source.archiveName);
    return { found: true, activities };
  } catch (error) {
    return { found: false, reason: error instanceof ArchiveNotFoundError ? 'missing' : 'unknown' };
  }
};

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
    /** En hämtning per källa. Värdet är ett av korten därifrån. */
    const scheduleSources = new Map<string, ScheduleDayContent>();
    let needsOwnNames = false;

    items.forEach(({ element, content }) => {
      if (element.type === 'wheel_part') {
        wheelIds.add((content as WheelPartContent).wheelId);
      } else {
        const day = content as ScheduleDayContent;
        scheduleSources.set(scheduleSourceKey(day), day);
        if (!day.archiveId && day.archiveName !== null) needsOwnNames = true;
      }
    });

    const wheels = new Map<string, Awaited<ReturnType<typeof themeWheelService.getWheel>> | null>();
    const schedules = new Map<string, ScheduleLookup>();
    // Namnvägen svarar tom lista för ett raderat schema, inte 404 — namnlistan
    // är enda sättet att skilja "raderat" från "tomt" för kort utan id.
    const [ownNames] = await Promise.all([
      needsOwnNames
        ? plannerService.getPlannerArchiveNames().catch(() => null)
        : Promise.resolve(null),
      ...Array.from(wheelIds).map(async (id) => {
        try {
          wheels.set(id, await themeWheelService.getWheel(id));
        } catch {
          wheels.set(id, null);
        }
      }),
      ...Array.from(scheduleSources).map(async ([key, source]) => {
        schedules.set(key, await fetchSchedule(source));
      }),
    ]);

    if (run !== runId.current) return;

    const partsByWheel = new Map<string, Map<string, WheelPartContent>>();

    items.forEach(({ element, content }) => {
      if (element.type === 'wheel_part') {
        const frozen = content as WheelPartContent;
        const wheel = wheels.get(frozen.wheelId);
        const base = { sourceKey: wheelSourceKey(frozen.wheelId), sourceLabel: frozen.sourceName };

        if (wheel === null || wheel === undefined) {
          result.set(element.id, { ...base, status: 'unknown' });
          return;
        }
        const mode = frozen.straight ? 'unroll' : 'explode';
        const partsKey = `${frozen.wheelId}:${mode}`;
        let parts = partsByWheel.get(partsKey);
        if (!parts) {
          parts = currentWheelParts(wheel, mode);
          partsByWheel.set(partsKey, parts);
        }
        const fresh = currentWheelPart(parts, frozen);
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
      const goneByName = !frozen.archiveId
        && frozen.archiveName !== null
        && ownNames !== null
        && !ownNames.includes(frozen.archiveName);
      const lookup: ScheduleLookup = goneByName
        ? { found: false, reason: 'missing' }
        : schedules.get(scheduleSourceKey(frozen)) ?? { found: false, reason: 'unknown' };
      result.set(element.id, scheduleDayProvenance(frozen, lookup));
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
