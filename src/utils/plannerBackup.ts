import type { HiddenSettingsDraft } from '@/hooks/useHiddenSettings';

/**
 * De dolda schemainställningarna ur en importerad backup, så som de stod i
 * filen. useHiddenSettings sanerar varje värde när det sätts.
 */
export type ImportedHiddenSettings = Partial<Record<keyof HiddenSettingsDraft, unknown>>;

/**
 * Varje dold inställning som följer med JSON-backupen (arkitektur F10). Förut
 * räknades fälten upp för hand på tre ställen, och selectionDefaults,
 * pasteProtect och exportExcludes föll bort vid en återställning. `satisfies`
 * gör att en ny inställning i HiddenSettingsDraft ger ett typfel här tills den
 * står med.
 *
 * Lärare och salar står först: spärrarna hänger på lärarnamnen.
 */
const SETTING_KEYS = {
  teachers: true,
  rooms: true,
  teacherAvailability: true,
  colorTriggers: true,
  roomTriggers: true,
  planningMinGap: true,
  exportExcludes: true,
  pasteProtect: true,
  selectionDefaults: true,
  planningStartMinutes: true,
  planningEndMinutes: true,
} satisfies Record<keyof HiddenSettingsDraft, true>;

export const HIDDEN_SETTING_KEYS = Object.keys(SETTING_KEYS) as (keyof HiddenSettingsDraft)[];

/**
 * Plockar inställningarna ur en inläst backup. En inställning som saknas i
 * filen, t.ex. i en backup från före den fanns, tas inte med och lämnas
 * därför orörd vid importen.
 */
export const pickHiddenSettings = (parsed: unknown): ImportedHiddenSettings => {
  if (!parsed || typeof parsed !== 'object') return {};
  const source = parsed as Record<string, unknown>;
  const picked: ImportedHiddenSettings = {};
  for (const key of HIDDEN_SETTING_KEYS) {
    if (source[key] !== undefined) picked[key] = source[key];
  }
  return picked;
};
