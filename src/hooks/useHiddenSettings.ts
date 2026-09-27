'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  COLOR_TRIGGERS_KEY,
  DEFAULT_PASTE_PROTECT,
  DEFAULT_PLANNING_MIN_GAP_MINUTES,
  EXPORT_EXCLUDE_KEY,
  PASTE_PROTECT_KEY,
  PLANNING_END_TIME_KEY,
  PLANNING_MIN_GAP_KEY,
  PLANNING_START_TIME_KEY,
  ROOMS_KEY,
  ROOM_TRIGGERS_KEY,
  TEACHERS_KEY,
  TEACHER_AVAILABILITY_KEY
} from '@/config/plannerConstants';
import { useHotkeys } from '@/hooks/useHotkeys';
import { usePersistentState } from '@/hooks/usePersistentState';
import { ColorTriggerRule, RoomTriggerRule, TeacherAvailability } from '@/types/schedule';
import { sanitizeColorTriggers } from '@/utils/colorTriggers';
import { sanitizeRoomTriggers } from '@/utils/roomTriggers';
import { sanitizeExcludeList } from '@/utils/exportExclusions';
import { sanitizePlanningMinGap, sanitizePlanningTime } from '@/utils/planningTime';
import { sanitizeTeacherAvailability } from '@/utils/scheduleRules';

/**
 * Allt debugmenyn sparar, som ett namngivet objekt. Tidigare var det nio
 * positionsargument i rad, varav flera var `string[]` — där räckte en
 * omkastning för att lärarnamnen skulle hamna i sallistan utan att vare sig
 * TypeScript eller körningen sa ifrån.
 */
export type HiddenSettingsDraft = {
  teachers: string[];
  rooms: string[];
  teacherAvailability: TeacherAvailability;
  colorTriggers: ColorTriggerRule[];
  roomTriggers: RoomTriggerRule[];
  planningMinGap: number;
  exportExcludes: string[];
  pasteProtect: string[];
  planningStartMinutes: number | null;
  planningEndMinutes: number | null;
};

/** Behåller bara lärare som fortfarande står i lärarlistan. */
const pruneAvailability = (
  availability: TeacherAvailability,
  teachers: string[]
): TeacherAvailability => {
  const known = new Set(teachers);
  return Object.fromEntries(
    Object.entries(availability).filter(([teacher]) => known.has(teacher))
  );
};

const toNameList = (value: unknown): string[] => (
  Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
);

const NO_NAMES: string[] = [];
const NO_AVAILABILITY: TeacherAvailability = {};
const NO_COLOR_TRIGGERS: ColorTriggerRule[] = [];
const NO_ROOM_TRIGGERS: RoomTriggerRule[] = [];

export const useHiddenSettings = () => {
  const [teachers, persistTeachers] = usePersistentState(TEACHERS_KEY, toNameList, NO_NAMES);
  const [rooms, persistRooms] = usePersistentState(ROOMS_KEY, toNameList, NO_NAMES);
  const [teacherAvailability, persistAvailability] = usePersistentState(
    TEACHER_AVAILABILITY_KEY, sanitizeTeacherAvailability, NO_AVAILABILITY
  );
  const [colorTriggers, persistColorTriggers] = usePersistentState(
    COLOR_TRIGGERS_KEY, sanitizeColorTriggers, NO_COLOR_TRIGGERS
  );
  const [roomTriggers, persistRoomTriggers] = usePersistentState(
    ROOM_TRIGGERS_KEY, sanitizeRoomTriggers, NO_ROOM_TRIGGERS
  );
  const [planningMinGap, persistPlanningMinGap] = usePersistentState(
    PLANNING_MIN_GAP_KEY, sanitizePlanningMinGap, DEFAULT_PLANNING_MIN_GAP_MINUTES
  );
  /** Titlar som nästa export hoppar över. Töms när exporten är gjord. */
  const [exportExcludes, persistExportExcludes] = usePersistentState(
    EXPORT_EXCLUDE_KEY, sanitizeExcludeList, NO_NAMES
  );
  /**
   * Titlar som inte tar emot inklistrade anteckningar. Står kvar över tid.
   * Förvalet gäller bara när listan aldrig sparats — en sparad tom lista
   * betyder att man medvetet stängt av skyddet.
   */
  const [pasteProtect, persistPasteProtect] = usePersistentState(
    PASTE_PROTECT_KEY, sanitizeExcludeList, DEFAULT_PASTE_PROTECT
  );
  /** Ramens gränser i minuter. `null` = standard. */
  const [planningStartMinutes, persistPlanningStart] = usePersistentState(
    PLANNING_START_TIME_KEY, sanitizePlanningTime, null
  );
  const [planningEndMinutes, persistPlanningEnd] = usePersistentState(
    PLANNING_END_TIME_KEY, sanitizePlanningTime, null
  );
  const [isHiddenSettingsOpen, setIsHiddenSettingsOpen] = useState(false);
  /**
   * Blir sann när localStorage lästs. Före dess är alla listor tomma för att
   * inget lästs än, inte för att användaren tömt dem — och den som speglar
   * inställningarna någon annanstans måste kunna skilja på de två. Effekten
   * står efter inställningarna, så den körs när de redan lästs.
   */
  const [isLoaded, setIsLoaded] = useState(false);
  useEffect(() => {
    setIsLoaded(true);
  }, []);

  useHotkeys(
    [{ key: 'k', ctrl: true, shift: true, handler: () => setIsHiddenSettingsOpen(true) }],
    [],
  );

  const applyPlanningFrame = useCallback((nextStart: unknown, nextEnd: unknown) => {
    persistPlanningStart(nextStart);
    persistPlanningEnd(nextEnd);
  }, [persistPlanningStart, persistPlanningEnd]);

  /** Körs när en export är gjord: listan gäller bara nästa export. */
  const clearExportExcludes = useCallback(() => {
    persistExportExcludes([]);
  }, [persistExportExcludes]);

  /**
   * Sätter listorna vid import utan att röra spärrarna. Skiljer sig från
   * handleHiddenSettingsSave med flit: den beskär tillgängligheten mot
   * lärarlistan, vilket vid en import skulle slänga precis det som importeras.
   */
  const applyTeachersAndRooms = useCallback((nextTeachers: unknown, nextRooms: unknown) => {
    persistTeachers(nextTeachers);
    persistRooms(nextRooms);
  }, [persistTeachers, persistRooms]);

  const handleHiddenSettingsSave = useCallback((next: HiddenSettingsDraft) => {
    persistTeachers(next.teachers);
    persistRooms(next.rooms);
    persistAvailability(pruneAvailability(next.teacherAvailability, next.teachers));
    persistColorTriggers(next.colorTriggers);
    persistRoomTriggers(next.roomTriggers);
    persistPlanningMinGap(next.planningMinGap);
    persistExportExcludes(next.exportExcludes);
    persistPasteProtect(next.pasteProtect);
    applyPlanningFrame(next.planningStartMinutes, next.planningEndMinutes);
  }, [
    persistTeachers,
    persistRooms,
    persistAvailability,
    persistColorTriggers,
    persistRoomTriggers,
    persistPlanningMinGap,
    persistExportExcludes,
    persistPasteProtect,
    applyPlanningFrame
  ]);

  return {
    teachers,
    rooms,
    teacherAvailability,
    colorTriggers,
    roomTriggers,
    planningMinGap,
    exportExcludes,
    pasteProtect,
    planningStartMinutes,
    planningEndMinutes,
    isLoaded,
    /** Används när ett schema importeras från JSON. */
    applyTeacherAvailability: persistAvailability,
    applyTeachersAndRooms,
    applyColorTriggers: persistColorTriggers,
    applyRoomTriggers: persistRoomTriggers,
    applyPlanningMinGap: persistPlanningMinGap,
    applyPlanningFrame,
    clearExportExcludes,
    isHiddenSettingsOpen,
    setIsHiddenSettingsOpen,
    handleHiddenSettingsSave
  };
};
