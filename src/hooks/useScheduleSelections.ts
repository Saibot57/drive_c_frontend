'use client';

import { useCallback, useMemo, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { SCHEDULE_SELECTIONS_KEY } from '@/config/plannerConstants';
import { usePersistentState } from '@/hooks/usePersistentState';
import { ScheduledEntry } from '@/types/schedule';
import { createSelection, sanitizeSelections, ScheduleSelection } from '@/utils/scheduleSelection';

const NO_SELECTIONS: ScheduleSelection[] = [];

/**
 * De sparade urvalen och vilket av dem som visas just nu.
 *
 * Urvalen sparas i webbläsaren, som exportlistan och skyddslistan. Vilket som
 * är aktivt sparas inte: efter en omladdning syns hela schemat igen, så att
 * ingen sitter med ett låst och halvtomt schema utan att minnas varför.
 */
export const useScheduleSelections = () => {
  const [selections, persistSelections] = usePersistentState(
    SCHEDULE_SELECTIONS_KEY, sanitizeSelections, NO_SELECTIONS
  );
  const [activeSelectionId, setActiveSelectionId] = useState<string | null>(null);

  const activeSelection = useMemo(
    () => selections.find(selection => selection.id === activeSelectionId) ?? null,
    [selections, activeSelectionId]
  );

  const addSelection = useCallback((name: string, schedule: ScheduledEntry[], defaults: string[]) => {
    const created = createSelection(uuidv4(), name.trim(), schedule, defaults);
    persistSelections([...selections, created]);
    return created;
  }, [persistSelections, selections]);

  const updateSelection = useCallback((next: ScheduleSelection) => {
    persistSelections(selections.map(selection => (selection.id === next.id ? next : selection)));
  }, [persistSelections, selections]);

  const removeSelection = useCallback((id: string) => {
    persistSelections(selections.filter(selection => selection.id !== id));
    setActiveSelectionId(current => (current === id ? null : current));
  }, [persistSelections, selections]);

  return {
    selections,
    activeSelection,
    setActiveSelectionId,
    addSelection,
    updateSelection,
    removeSelection,
  };
};
