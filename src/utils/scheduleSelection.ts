import { ScheduledEntry } from '@/types/schedule';
import { matchesExcludeList } from '@/utils/exportExclusions';
import { compareLaneEntries } from '@/utils/scheduleLayout';

/**
 * Ett sparat urval: vilka pass en viss deltagare ska se när schemat visas och
 * exporteras för just den. Inget schema skapas — urvalet är ett filter ovanpå
 * det schema som är öppet.
 *
 * Pass pekas ut med dag, starttid och titel i stället för med id. Veckorna
 * kopieras från basschemat med nya id, så ett id gäller bara i ett schema; en
 * naturlig nyckel gör att samma urval fungerar i basschemat och i varje vecka
 * som har samma pass. Flyttas ett pass i en vecka gäller titelvalet för det.
 */
export type ScheduleSelection = {
  id: string;
  name: string;
  /** Titlar som syns. */
  titles: string[];
  /**
   * Alla titlar som fanns när urvalet senast ändrades. En titel som inte står
   * här är ny sedan dess: den syns bara om den står på listan över förkryssade,
   * och märks ut i rutan så att den inte försvinner obemärkt.
   */
  knownTitles: string[];
  /** Enstaka pass som avviker från sin titel, nyckel från `passKey`. */
  passOverrides: Record<string, boolean>;
};

type PassLike = Pick<ScheduledEntry, 'day' | 'startTime' | 'title'>;

const cleanTitle = (title: unknown) => (typeof title === 'string' ? title.trim() : '');

export const passKey = (entry: PassLike) =>
  JSON.stringify([entry.day, entry.startTime, cleanTitle(entry.title)]);

const titleOfKey = (key: string): string | null => {
  try {
    const parsed = JSON.parse(key);
    return Array.isArray(parsed) && typeof parsed[2] === 'string' ? parsed[2] : null;
  } catch {
    return null;
  }
};

/** Syns passet i urvalet? `defaults` är listan över förkryssade titlar. */
export const isInSelection = (
  selection: ScheduleSelection,
  entry: PassLike,
  defaults: string[]
): boolean => {
  const override = selection.passOverrides[passKey(entry)];
  if (typeof override === 'boolean') return override;
  const title = cleanTitle(entry.title);
  if (selection.titles.includes(title)) return true;
  return !selection.knownTitles.includes(title) && matchesExcludeList(title, defaults);
};

export type SelectionTitleRow = {
  title: string;
  /** Titelns pass, i den ordning de ligger i schemat. */
  entries: ScheduledEntry[];
  /** Hur många av passen som syns. */
  visibleCount: number;
  isNew: boolean;
};

/** En rad per unik titel i schemat, i bokstavsordning. */
export const buildSelectionRows = (
  schedule: ScheduledEntry[],
  selection: ScheduleSelection,
  defaults: string[],
  dayOrder: readonly string[]
): SelectionTitleRow[] => {
  const byTitle = new Map<string, ScheduledEntry[]>();
  schedule.forEach(entry => {
    const title = cleanTitle(entry.title);
    if (!title) return;
    const list = byTitle.get(title) ?? [];
    list.push(entry);
    byTitle.set(title, list);
  });

  const dayIndex = (day: string) => dayOrder.indexOf(day);

  return Array.from(byTitle.entries())
    .sort(([a], [b]) => a.localeCompare(b, 'sv'))
    .map(([title, entries]) => {
      const sorted = [...entries].sort((a, b) => (
        dayIndex(a.day) - dayIndex(b.day) || compareLaneEntries(a, b)
      ));
      return {
        title,
        entries: sorted,
        visibleCount: sorted.filter(entry => isInSelection(selection, entry, defaults)).length,
        isNew: !selection.knownTitles.includes(title),
      };
    });
};

const allTitles = (schedule: ScheduledEntry[]) => (
  Array.from(new Set(schedule.map(entry => cleanTitle(entry.title)).filter(Boolean)))
);

/**
 * Varje ändring i rutan räknar schemats titlar som sedda. En ny titel som
 * syntes för att den är förkryssad blir då en vanlig ikryssad titel, så att
 * den inte försvinner av att något annat ändrades.
 */
const markKnown = (
  selection: ScheduleSelection,
  schedule: ScheduledEntry[],
  defaults: string[]
): ScheduleSelection => {
  const unseen = allTitles(schedule).filter(title => !selection.knownTitles.includes(title));
  return {
    ...selection,
    titles: [...selection.titles, ...unseen.filter(title => matchesExcludeList(title, defaults))],
    knownTitles: [...selection.knownTitles, ...unseen],
  };
};

/** Ett nytt urval där bara de förkryssade titlarna syns. */
export const createSelection = (
  id: string,
  name: string,
  schedule: ScheduledEntry[],
  defaults: string[]
): ScheduleSelection => markKnown(
  { id, name, titles: [], knownTitles: [], passOverrides: {} },
  schedule,
  defaults
);

/**
 * Kryssar i eller ur en titel. Undantag för enskilda pass med samma titel
 * töms, så att kryssrutan betyder det den visar: alla eller inga.
 */
export const setTitleVisible = (
  selection: ScheduleSelection,
  schedule: ScheduledEntry[],
  defaults: string[],
  title: string,
  visible: boolean
): ScheduleSelection => {
  const known = markKnown(selection, schedule, defaults);
  const titles = known.titles.filter(existing => existing !== title);
  return {
    ...known,
    titles: visible ? [...titles, title] : titles,
    passOverrides: Object.fromEntries(
      Object.entries(known.passOverrides).filter(([key]) => titleOfKey(key) !== title)
    ),
  };
};

/** Kryssar i eller ur ett enskilt pass. Ett pass som följer sin titel sparas inte. */
export const setPassVisible = (
  selection: ScheduleSelection,
  schedule: ScheduledEntry[],
  defaults: string[],
  entry: PassLike,
  visible: boolean
): ScheduleSelection => {
  const known = markKnown(selection, schedule, defaults);
  const key = passKey(entry);
  const { [key]: _previous, ...rest } = known.passOverrides;
  const followsTitle = known.titles.includes(cleanTitle(entry.title)) === visible;
  return { ...known, passOverrides: followsTitle ? rest : { ...rest, [key]: visible } };
};

/**
 * Alla titlar i det öppna schemat i eller ur på en gång. Titlar som bara finns
 * i andra veckor lämnas som de är.
 */
export const setAllVisible = (
  selection: ScheduleSelection,
  schedule: ScheduledEntry[],
  defaults: string[],
  visible: boolean
): ScheduleSelection => {
  const known = markKnown(selection, schedule, defaults);
  const here = new Set(allTitles(schedule));
  const elsewhere = known.titles.filter(title => !here.has(title));
  return {
    ...known,
    titles: visible ? [...elsewhere, ...Array.from(here)] : elsewhere,
    passOverrides: Object.fromEntries(
      Object.entries(known.passOverrides).filter(([key]) => !here.has(titleOfKey(key) ?? ''))
    ),
  };
};

const isStringList = (value: unknown): value is string[] => (
  Array.isArray(value) && value.every(item => typeof item === 'string')
);

/** Webbläsarens lagring kan innehålla vad som helst. Trasiga urval hoppas över. */
export const sanitizeSelections = (input: unknown): ScheduleSelection[] => {
  if (!Array.isArray(input)) return [];
  const seen = new Set<string>();
  return input.flatMap(item => {
    if (!item || typeof item !== 'object') return [];
    const { id, name, titles, knownTitles, passOverrides } = item as Record<string, unknown>;
    if (typeof id !== 'string' || !id || seen.has(id)) return [];
    if (typeof name !== 'string' || !name.trim()) return [];
    if (!isStringList(titles) || !isStringList(knownTitles)) return [];
    seen.add(id);
    const overrides = passOverrides && typeof passOverrides === 'object' && !Array.isArray(passOverrides)
      ? Object.fromEntries(
        Object.entries(passOverrides as Record<string, unknown>)
          .filter((pair): pair is [string, boolean] => typeof pair[1] === 'boolean')
      )
      : {};
    return [{ id, name: name.trim(), titles, knownTitles, passOverrides: overrides }];
  });
};
