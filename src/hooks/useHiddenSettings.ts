'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  COLOR_TRIGGERS_KEY,
  ROOMS_KEY,
  TEACHERS_KEY,
  TEACHER_AVAILABILITY_KEY
} from '@/components/schedule/constants';
import { useHotkeys } from '@/hooks/useHotkeys';
import { ColorTriggerRule, TeacherAvailability } from '@/types/schedule';
import { sanitizeColorTriggers } from '@/utils/colorTriggers';
import { sanitizeTeacherAvailability } from '@/utils/scheduleRules';

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

export const useHiddenSettings = () => {
  const [teachers, setTeachers] = useState<string[]>([]);
  const [rooms, setRooms] = useState<string[]>([]);
  const [teacherAvailability, setTeacherAvailability] = useState<TeacherAvailability>({});
  const [colorTriggers, setColorTriggers] = useState<ColorTriggerRule[]>([]);
  const [isHiddenSettingsOpen, setIsHiddenSettingsOpen] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const storedTeachers = window.localStorage.getItem(TEACHERS_KEY);
      const storedRooms = window.localStorage.getItem(ROOMS_KEY);
      const storedAvailability = window.localStorage.getItem(TEACHER_AVAILABILITY_KEY);
      const storedTriggers = window.localStorage.getItem(COLOR_TRIGGERS_KEY);
      const parsedTeachers = storedTeachers ? JSON.parse(storedTeachers) : [];
      const parsedRooms = storedRooms ? JSON.parse(storedRooms) : [];
      setTeachers(Array.isArray(parsedTeachers) ? parsedTeachers.filter(item => typeof item === 'string') : []);
      setRooms(Array.isArray(parsedRooms) ? parsedRooms.filter(item => typeof item === 'string') : []);
      setTeacherAvailability(
        sanitizeTeacherAvailability(storedAvailability ? JSON.parse(storedAvailability) : {})
      );
      setColorTriggers(sanitizeColorTriggers(storedTriggers ? JSON.parse(storedTriggers) : []));
    } catch (error) {
      console.warn('Kunde inte läsa lärare/salar.', error);
    }
  }, []);

  useHotkeys(
    [{ key: 'k', ctrl: true, shift: true, handler: () => setIsHiddenSettingsOpen(true) }],
    [],
  );

  const persistAvailability = useCallback((next: TeacherAvailability) => {
    setTeacherAvailability(next);
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(TEACHER_AVAILABILITY_KEY, JSON.stringify(next));
    } catch (error) {
      console.warn('Kunde inte spara lärartillgänglighet.', error);
    }
  }, []);

  const persistColorTriggers = useCallback((next: ColorTriggerRule[]) => {
    setColorTriggers(next);
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(COLOR_TRIGGERS_KEY, JSON.stringify(next));
    } catch (error) {
      console.warn('Kunde inte spara färgregler.', error);
    }
  }, []);

  /** Används när ett schema importeras från JSON. */
  const applyTeacherAvailability = useCallback((next: unknown) => {
    persistAvailability(sanitizeTeacherAvailability(next));
  }, [persistAvailability]);

  const applyColorTriggers = useCallback((next: unknown) => {
    persistColorTriggers(sanitizeColorTriggers(next));
  }, [persistColorTriggers]);

  const handleHiddenSettingsSave = useCallback((
    nextTeachers: string[],
    nextRooms: string[],
    nextAvailability: TeacherAvailability,
    nextColorTriggers: ColorTriggerRule[]
  ) => {
    setTeachers(nextTeachers);
    setRooms(nextRooms);
    persistAvailability(pruneAvailability(nextAvailability, nextTeachers));
    persistColorTriggers(sanitizeColorTriggers(nextColorTriggers));
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(TEACHERS_KEY, JSON.stringify(nextTeachers));
      window.localStorage.setItem(ROOMS_KEY, JSON.stringify(nextRooms));
    } catch (error) {
      console.warn('Kunde inte spara lärare/salar.', error);
    }
  }, [persistAvailability, persistColorTriggers]);

  return {
    teachers,
    rooms,
    teacherAvailability,
    colorTriggers,
    applyTeacherAvailability,
    applyColorTriggers,
    isHiddenSettingsOpen,
    setIsHiddenSettingsOpen,
    handleHiddenSettingsSave
  };
};
