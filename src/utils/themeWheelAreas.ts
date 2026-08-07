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

/** Ett område i biblioteket, med den nivå det ska visas på. */
export interface LibraryArea {
  area: ThemeArea;
  /** Nyckeln på arbetsområdet det ligger under, eller null på egen nivå. */
  parentKey: string | null;
}

/**
 * Ordnar biblioteket som hjulet: varje arbetsområde följt av de områden som
 * används som delområden till det.
 *
 * Ett område räknas som delområde först när alla dess bågar ligger inuti ett
 * och samma arbetsområde. Används det både på egen hand och som delområde,
 * eller under två olika arbetsområden, stannar det på egen nivå – annars hade
 * en del av användningen hamnat under fel rubrik.
 *
 * Ett arbetsområde som har delområden har alltid minst en egen båge, och
 * hamnar därför alltid på egen nivå. Ett delområde kan alltså inte bli
 * föräldralöst i listan.
 */
export const buildAreaLibrary = (areas: ThemeArea[], blocks: ThemeBlock[]): LibraryArea[] => {
  const titleByInstance = new Map(blocks.map(block => [block.instanceId, block.title]));

  /** områdesnyckel -> arbetsområdet det ligger under. null betyder egen nivå. */
  const parentByKey = new Map<string, string | null>();
  /** Områden som förekommer på mer än ett ställe och därför stannar på egen nivå. */
  const mixedKeys = new Set<string>();

  blocks.forEach(block => {
    const key = buildAreaKey(block.title);
    if (!key) return;
    const parentTitle = block.parentId ? titleByInstance.get(block.parentId) : undefined;
    const raw = parentTitle ? buildAreaKey(parentTitle) : null;
    // Ett område som ligger inuti sig självt hör hemma på egen nivå, annars
    // skulle det indenteras under sitt eget namn.
    const parentKey = raw === key ? null : raw;

    if (!parentByKey.has(key)) parentByKey.set(key, parentKey);
    else if (parentByKey.get(key) !== parentKey) mixedKeys.add(key);
  });

  const byKey = new Map(areas.map(area => [buildAreaKey(area.title), area]));

  const parentOf = (area: ThemeArea): string | null => {
    const key = buildAreaKey(area.title);
    if (mixedKeys.has(key)) return null;
    const parentKey = parentByKey.get(key) ?? null;
    return parentKey && byKey.has(parentKey) ? parentKey : null;
  };

  const childrenByKey = new Map<string, ThemeArea[]>();
  const roots: ThemeArea[] = [];
  areas.forEach(area => {
    const parentKey = parentOf(area);
    if (!parentKey) {
      roots.push(area);
      return;
    }
    childrenByKey.set(parentKey, [...(childrenByKey.get(parentKey) ?? []), area]);
  });

  return roots.flatMap(area => {
    const key = buildAreaKey(area.title);
    return [
      { area, parentKey: null },
      ...(childrenByKey.get(key) ?? []).map(child => ({ area: child, parentKey: key })),
    ];
  });
};

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
