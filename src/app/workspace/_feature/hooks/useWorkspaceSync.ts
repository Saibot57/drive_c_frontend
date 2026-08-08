'use client';

import { useCallback, useRef, useState } from 'react';
import type { PlannerNoticeTone } from '@/types/plannerUI';

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

type ShowNotice = (message: string, tone: PlannerNoticeTone) => void;

/**
 * Håller reda på om det finns skrivningar på väg till servern, så att
 * toolbaren kan visa samma moln som temakalendern. Tidigare gick varje fel
 * rakt ner i console.error och användaren fick ingen signal alls.
 *
 * Statusen räknas på antalet pågående anrop i stället för på det senaste, så
 * att en snabb serie sparningar inte blinkar mellan "Sparar" och "Sparat".
 */
export function useWorkspaceSync(showNotice: ShowNotice) {
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const pending = useRef(0);
  // Gäller den pågående omgången skrivningar och nollställs när den är slut.
  // Vore flaggan beständig skulle ett enda tillfälligt fel låsa indikatorn på
  // "Ej sparat" resten av sessionen, även när allt därefter gick igenom.
  const failedInBatch = useRef(false);

  /**
   * Kör en skrivning och håller statusen uppdaterad. Returnerar resultatet,
   * eller null om anropet gick fel — anroparen avgör själv om den vill rulla
   * tillbaka sin optimistiska uppdatering.
   */
  const track = useCallback(async <T,>(
    /** Visas i felnotisen: "Kunde inte {label}." */
    label: string,
    action: () => Promise<T>,
  ): Promise<T | null> => {
    pending.current += 1;
    setSaveStatus('saving');

    const settle = () => {
      pending.current -= 1;
      if (pending.current > 0) return;
      setSaveStatus(failedInBatch.current ? 'error' : 'saved');
      failedInBatch.current = false;
    };

    try {
      const result = await action();
      settle();
      return result;
    } catch (error) {
      failedInBatch.current = true;
      settle();
      console.error(`Workspace: kunde inte ${label}`, error);
      showNotice(
        error instanceof Error && error.message
          ? `Kunde inte ${label}: ${error.message}`
          : `Kunde inte ${label}.`,
        'error',
      );
      return null;
    }
  }, [showNotice]);

  return { saveStatus, track };
}
