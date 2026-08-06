'use client';

import { useCallback, useEffect, useState } from 'react';
import { SIDEBAR_SECTIONS_KEY } from '@/components/schedule/constants';

export type PlannerSection = 'courses' | 'stats' | 'subjects' | 'teachers';

export type PlannerSectionState = Record<PlannerSection, boolean>;

const DEFAULT_SECTIONS: PlannerSectionState = {
  courses: true,
  stats: true,
  subjects: true,
  teachers: true
};

/**
 * Håller reda på vilka sektioner i sidopanelen som är utfällda. Lägena sparas
 * i localStorage så panelen ser likadan ut efter en omladdning.
 */
export const usePlannerSections = () => {
  const [sections, setSections] = useState<PlannerSectionState>(DEFAULT_SECTIONS);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const stored = window.localStorage.getItem(SIDEBAR_SECTIONS_KEY);
      if (!stored) return;
      const parsed = JSON.parse(stored);
      // Sektioner som saknas i sparad data får sitt standardläge, så äldre
      // lagrade värden fungerar när en ny sektion tillkommer.
      setSections(
        Object.fromEntries(
          Object.entries(DEFAULT_SECTIONS).map(([section, fallback]) => [
            section,
            typeof parsed?.[section] === 'boolean' ? parsed[section] : fallback
          ])
        ) as PlannerSectionState
      );
    } catch (error) {
      console.warn('Kunde inte läsa sidopanelens sektioner.', error);
    }
  }, []);

  const toggleSection = useCallback((section: PlannerSection) => {
    const next = { ...sections, [section]: !sections[section] };
    setSections(next);
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(SIDEBAR_SECTIONS_KEY, JSON.stringify(next));
    } catch (error) {
      console.warn('Kunde inte spara sidopanelens sektioner.', error);
    }
  }, [sections]);

  return { sections, toggleSection };
};
