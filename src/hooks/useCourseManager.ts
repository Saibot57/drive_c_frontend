'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { MANUAL_COURSES_KEY } from '@/components/schedule/constants';
import { buildCourseDedupeKey, deriveCoursesFromSchedule, mergeCourses, sanitizeManualCourses } from '@/components/schedule/courseUtils';
import { importColors } from '@/config/colorManagement';
import { PlannerCourse, ScheduledEntry } from '@/types/schedule';
import { v4 as uuidv4 } from 'uuid';

type UseCourseManagerParams = {
  schedule: ScheduledEntry[];
  showNotice: (message: string, tone: 'success' | 'error' | 'warning') => void;
};

export const useCourseManager = ({ schedule, showNotice }: UseCourseManagerParams) => {
  const [manualCourses, setManualCourses] = useState<PlannerCourse[]>([]);
  const [courses, setCourses] = useState<PlannerCourse[]>([]);
  const [deleteCourseId, setDeleteCourseId] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const stored = window.localStorage.getItem(MANUAL_COURSES_KEY);
      if (!stored) return;
      const parsed = JSON.parse(stored);
      const sanitized = sanitizeManualCourses(parsed);
      if (sanitized.length > 0) {
        setManualCourses(sanitized);
      }
    } catch (error) {
      console.warn('Kunde inte läsa manuella byggstenar.', error);
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(MANUAL_COURSES_KEY, JSON.stringify(manualCourses));
    } catch (error) {
      console.warn('Kunde inte spara manuella byggstenar.', error);
    }
  }, [manualCourses]);

  const recomputeCourses = useCallback((nextSchedule: ScheduledEntry[], nextManual: PlannerCourse[]) => {
    const derived = deriveCoursesFromSchedule(nextSchedule);
    const merged = mergeCourses(nextManual, derived);
    setCourses(merged);
  }, []);

  const manualCourseKeys = useMemo(() => (
    new Set(manualCourses.map(course => buildCourseDedupeKey(course)))
  ), [manualCourses]);

  const derivedCourseKeys = useMemo(() => (
    new Set(deriveCoursesFromSchedule(schedule).map(course => buildCourseDedupeKey(course)))
  ), [schedule]);

  useEffect(() => {
    recomputeCourses(schedule, manualCourses);
  }, [manualCourses, recomputeCourses, schedule]);

  useEffect(() => {
    const colorMap = courses.map(course => ({ className: course.title, color: course.color }));
    importColors(colorMap);
  }, [courses]);

  const handleDeleteCourse = useCallback((course: PlannerCourse, isDerived: boolean) => {
    if (isDerived) {
      showNotice('Automatiska byggstenar kan inte raderas. Redigera för att skapa en manuell kopia.', 'warning');
      return;
    }
    setDeleteCourseId(course.id);
  }, [showNotice]);

  const handleConfirmDeleteCourse = useCallback(() => {
    if (!deleteCourseId) return;
    setManualCourses(prev => prev.filter(existing => existing.id !== deleteCourseId));
    setDeleteCourseId(null);
  }, [deleteCourseId]);

  const deleteCourseName = useMemo(() => (
    manualCourses.find(course => course.id === deleteCourseId)?.title ?? null
  ), [deleteCourseId, manualCourses]);

  const handleSaveCourse = useCallback((
    event: FormEvent,
    editingCourse: PlannerCourse | null,
    onSaved?: () => void
  ) => {
    event.preventDefault();
    if (!editingCourse) return;

    setManualCourses(prev => {
      const courseKey = buildCourseDedupeKey(editingCourse);
      const isDerived = derivedCourseKeys.has(courseKey) && !manualCourseKeys.has(courseKey);
      const manualId = isDerived ? uuidv4() : editingCourse.id;
      const nextCourse = { ...editingCourse, id: manualId };
      const exists = prev.find(course => course.id === manualId);
      return exists
        ? prev.map(course => (course.id === manualId ? nextCourse : course))
        : [...prev, nextCourse];
    });

    onSaved?.();
  }, [derivedCourseKeys, manualCourseKeys]);

  return {
    manualCourses,
    setManualCourses,
    courses,
    recomputeCourses,
    manualCourseKeys,
    derivedCourseKeys,
    deleteCourseName,
    setDeleteCourseId,
    handleDeleteCourse,
    handleConfirmDeleteCourse,
    handleSaveCourse
  };
};
