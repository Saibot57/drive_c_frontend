'use client';

import { useCallback, useEffect, useState } from 'react';
import { PLANNER_NOTICE_DISMISS_MS } from '@/components/schedule/constants';
import { PlannerNotice, PlannerNoticeAction, PlannerNoticeTone } from '@/types/plannerUI';

type ShowNoticeOptions = {
  /** Knapp i notisen, t.ex. "Ångra" efter en radering. */
  action?: PlannerNoticeAction;
  /**
   * Avvikande livslängd. En notis med knapp behöver längre tid än en ren
   * bekräftelse, annars hinner man inte klicka.
   */
  durationMs?: number;
};

export const usePlannerNotice = () => {
  const [plannerNotice, setPlannerNotice] = useState<PlannerNotice | null>(null);

  useEffect(() => {
    if (!plannerNotice) return;
    const timeout = window.setTimeout(() => {
      setPlannerNotice(null);
    }, plannerNotice.durationMs ?? PLANNER_NOTICE_DISMISS_MS);

    return () => window.clearTimeout(timeout);
  }, [plannerNotice]);

  const showNotice = useCallback((
    message: string,
    tone: PlannerNoticeTone,
    options?: ShowNoticeOptions,
  ) => {
    setPlannerNotice({ message, tone, ...options });
  }, []);

  const dismissNotice = useCallback(() => setPlannerNotice(null), []);

  return {
    plannerNotice,
    showNotice,
    dismissNotice
  };
};
