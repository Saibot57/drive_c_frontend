/**
 * Svaret från POST /update. Fälten är valfria eftersom en äldre backend
 * saknar dem; då visas ingen sammanfattning alls.
 */
export type SyncResult = {
  files?: number;
  new_files?: number;
  skipped?: { path: string; reason: string }[];
};

// Hårt mellanslag, så att talet och ordet inte hamnar på olika rader.
const count = (n: number, one: string, many: string) =>
  `${n.toLocaleString('sv-SE')}\u00a0${n === 1 ? one : many}`;

/** "632 filer · 5 nya", och "· 2 hoppades över" när synken fick lämna något. */
export const describeSync = (result: SyncResult | null | undefined): string | null => {
  if (!result || typeof result.files !== 'number') return null;
  const parts = [count(result.files, 'fil', 'filer')];
  if (typeof result.new_files === 'number') parts.push(count(result.new_files, 'ny', 'nya'));
  const skipped = result.skipped?.length ?? 0;
  if (skipped > 0) parts.push(count(skipped, 'hoppades över', 'hoppades över'));
  return parts.join(' · ');
};
