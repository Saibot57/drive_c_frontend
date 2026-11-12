'use client';

import { useLayoutEffect, useMemo, useState } from 'react';
import { useUiTheme } from '@/hooks/useUiTheme';
import type { MindmapDoc } from '@/types/mindmapDoc';
import type { MindmapNodePaint, MindmapPalette } from '@/utils/mindmap/mindmapDraw';
import { paintThemeOf, resolveMindmapPaint } from '@/utils/mindmapPaint';

const NONE = new Map<string, MindmapNodePaint>();

/**
 * Nodernas färger på skärmen, i aktuellt tema (docs/plans/mindmap-farger.md).
 * Paletten läses om när temat byts, före ritningen, så att färgerna aldrig
 * hör till det gamla temat. Räknas på hela kartan, också i grenvyn.
 */
export function useMindmapPaint(doc: MindmapDoc, readPalette: () => MindmapPalette | null): Map<string, MindmapNodePaint> {
  const { theme } = useUiTheme();
  const [palette, setPalette] = useState<MindmapPalette | null>(null);
  useLayoutEffect(() => {
    setPalette(readPalette());
  }, [theme, readPalette]);
  return useMemo(
    () => (palette ? resolveMindmapPaint(doc.root, doc.shading, paintThemeOf(palette)) : NONE),
    [doc.root, doc.shading, palette],
  );
}
