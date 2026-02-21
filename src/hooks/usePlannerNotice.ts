'use client';

import { useCallback, useEffect, useState } from 'react';
import { PLANNER_NOTICE_DISMISS_MS } from '@/components/schedule/constants';
import { PlannerNotice, PlannerNoticeTone } from '@/types/plannerUI';

export const usePlannerNotice = () => {
  const [plannerNotice, setPlannerNotice] = useState<PlannerNotice | null>(null);

  useEffect(() => {
    if (!plannerNotice) return;
    const timeout = window.setTimeout(() => {
      setPlannerNotice(null);
    }, PLANNER_NOTICE_DISMISS_MS);

    return () => window.clearTimeout(timeout);
  }, [plannerNotice]);

  const showNotice = useCallback((message: string, tone: PlannerNoticeTone) => {
    setPlannerNotice({ message, tone });
  }, []);

  return {
    plannerNotice,
    showNotice
  };
};
