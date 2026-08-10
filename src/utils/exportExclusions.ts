import { wildcardMatch } from '@/utils/scheduleRules';

/**
 * Läser fältet "Uteslut från nästa print/export". Semikolon är den skrivna
 * separatorn, men en textruta inbjuder till radbrytningar så båda duger.
 * Dubbletter med olika versaler räknas som samma mönster.
 */
export const parseExcludeList = (input: string): string[] => {
  const seen = new Set<string>();

  return input
    .split(/[;\n]/)
    .map(part => part.trim())
    .filter(Boolean)
    .filter(part => {
      const key = part.toLocaleLowerCase('sv');
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
};

/** Listan kan komma från localStorage och vara vad som helst. */
export const sanitizeExcludeList = (input: unknown): string[] => {
  if (typeof input === 'string') return parseExcludeList(input);
  if (!Array.isArray(input)) return [];
  return parseExcludeList(input.filter(item => typeof item === 'string').join('\n'));
};

/**
 * Titeln matchas i sin helhet, skiftlägesokänsligt, med `*` som jokertecken –
 * samma syntax som ämnesreglerna. Så "ATP" träffar inte "ATP-möte", men "ATP*"
 * gör det.
 */
export const matchesExcludeList = (title: unknown, patterns: string[]): boolean => {
  if (patterns.length === 0) return false;
  if (typeof title !== 'string') return false;

  const text = title.trim();
  if (!text) return false;

  return patterns.some(pattern => wildcardMatch(pattern, text));
};
