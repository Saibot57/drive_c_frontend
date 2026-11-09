/**
 * Ifyllnad av namn när det som skrivits bara kan vara ett av alternativen.
 * Används av schemaplanerarens SmartTextInput och av Närvarorutornas grupper.
 */

/** Gemener, utan blanksteg runt om och utan accenter (å och ä blir a). */
export const normalizeAutofill = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');

/**
 * Det enda alternativ vars början matchar texten, eller null om texten är
 * kortare än `minChars` eller om noll eller flera alternativ matchar.
 */
export function uniquePrefixMatch(text: string, options: readonly string[], minChars = 3): string | null {
  const trimmed = text.trim();
  if (trimmed.length < minChars) return null;
  const query = normalizeAutofill(trimmed);
  let found: string | null = null;
  for (const option of options) {
    if (!normalizeAutofill(option).startsWith(query)) continue;
    if (found !== null) return null;
    found = option;
  }
  return found;
}

/** Alternativet som texten är, oavsett versaler, accenter och blanksteg runt om. */
export function findExact(text: string, options: readonly string[]): string | null {
  const query = normalizeAutofill(text);
  if (!query) return null;
  return options.find(option => normalizeAutofill(option) === query) ?? null;
}
