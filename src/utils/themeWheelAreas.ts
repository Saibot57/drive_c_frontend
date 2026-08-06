/**
 * Biblioteket med arbetsområden.
 *
 * Samma modell som schemaplanerarens byggstenar: listan är dels manuellt
 * skapade områden, dels sådana som härleds ur hjulet självt. Ett härlett
 * område går inte att radera – det försvinner när sista blocket gör det.
 */

import { ThemeArea, ThemeBlock } from '@/types/themeWheel';
import { DEFAULT_AREA_COLOR } from '@/components/theme-wheel/constants';

export const DERIVED_AREA_PREFIX = 'gen_';

/** Områden slås ihop på titel, oberoende av versaler och extra mellanslag. */
export const buildAreaKey = (title: string): string => (
  title.trim().replace(/\s+/g, ' ').toLocaleLowerCase('sv')
);

export const deriveAreasFromBlocks = (blocks: ThemeBlock[]): ThemeArea[] => {
  const unique = new Map<string, ThemeArea>();

  blocks.forEach(block => {
    const key = buildAreaKey(block.title);
    if (!key || unique.has(key)) return;
    unique.set(key, {
      id: `${DERIVED_AREA_PREFIX}${key}`,
      title: block.title.trim(),
      color: block.color,
      comment: block.comment,
    });
  });

  return Array.from(unique.values());
};

/** Manuella områden vinner över härledda med samma titel. */
export const mergeAreas = (manual: ThemeArea[], derived: ThemeArea[]): ThemeArea[] => {
  const merged = new Map<string, ThemeArea>();
  manual.forEach(area => merged.set(buildAreaKey(area.title), area));
  derived.forEach(area => {
    const key = buildAreaKey(area.title);
    if (!merged.has(key)) merged.set(key, area);
  });
  return Array.from(merged.values()).sort((a, b) => a.title.localeCompare(b.title, 'sv'));
};

export const isDerivedArea = (area: ThemeArea): boolean => (
  area.id.startsWith(DERIVED_AREA_PREFIX)
);

/** Plockar bort skräp ur data som lästs från localStorage eller en JSON-fil. */
export const sanitizeAreas = (input: unknown): ThemeArea[] => {
  if (!Array.isArray(input)) return [];
  return input.flatMap(item => {
    if (!item || typeof item !== 'object') return [];
    const raw = item as Partial<ThemeArea>;
    if (typeof raw.id !== 'string' || typeof raw.title !== 'string') return [];
    return [{
      id: raw.id,
      title: raw.title,
      color: typeof raw.color === 'string' ? raw.color : DEFAULT_AREA_COLOR,
      comment: typeof raw.comment === 'string' ? raw.comment : undefined,
    }];
  });
};
