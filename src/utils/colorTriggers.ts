import { ColorTriggerRule } from '@/types/schedule';
import { containsWords, tokenize } from '@/utils/wordTriggers';

const isHexColor = (value: unknown): value is string => (
  typeof value === 'string' && /^#[0-9a-f]{3,8}$/i.test(value.trim())
);

/** Plockar bort skräp ur data som lästs från localStorage eller en JSON-fil. */
export const sanitizeColorTriggers = (input: unknown): ColorTriggerRule[] => {
  if (!Array.isArray(input)) return [];

  return input.reduce<ColorTriggerRule[]>((collected, raw, index) => {
    if (!raw || typeof raw !== 'object') return collected;
    const candidate = raw as Record<string, unknown>;
    const word = typeof candidate.word === 'string' ? candidate.word.trim() : '';
    if (!word || !isHexColor(candidate.color)) return collected;

    collected.push({
      id: typeof candidate.id === 'string' && candidate.id ? candidate.id : `trigger-${index}`,
      word,
      color: (candidate.color as string).trim()
    });
    return collected;
  }, []);
};

/** Första regeln som matchar vinner, så listans ordning är prioritetsordning. */
export const findColorTrigger = (
  title: string,
  triggers: ColorTriggerRule[]
): ColorTriggerRule | null => {
  if (triggers.length === 0) return null;
  const titleWords = tokenize(title ?? '');
  if (titleWords.length === 0) return null;
  return triggers.find(trigger => containsWords(titleWords, tokenize(trigger.word))) ?? null;
};

/**
 * Bygger en färguppslagning som används när korten ritas. Orden delas upp en
 * gång per regeländring i stället för en gång per post.
 */
export const createColorResolver = (triggers: ColorTriggerRule[]) => {
  const prepared = triggers
    .map(trigger => ({ color: trigger.color, words: tokenize(trigger.word) }))
    .filter(trigger => trigger.words.length > 0);

  return (title: string, fallbackColor: string): string => {
    if (prepared.length === 0) return fallbackColor;
    const titleWords = tokenize(title ?? '');
    if (titleWords.length === 0) return fallbackColor;
    const hit = prepared.find(trigger => containsWords(titleWords, trigger.words));
    return hit ? hit.color : fallbackColor;
  };
};
