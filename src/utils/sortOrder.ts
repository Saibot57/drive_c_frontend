/**
 * Egen ordning på saker som användaren sorterar med dra och släpp, och som
 * sparas som en lista med id:n.
 */

/** Flyttar `dragId` till före eller efter `targetId`. */
export const moveId = (ids: string[], dragId: string, targetId: string, after: boolean): string[] => {
  if (dragId === targetId || !ids.includes(targetId)) return ids;
  const without = ids.filter(id => id !== dragId);
  const index = without.indexOf(targetId) + (after ? 1 : 0);
  without.splice(index, 0, dragId);
  return without;
};

/**
 * `ids` i sparad ordning. Det som aldrig sorterats hamnar sist, i sin
 * ursprungliga ordning — en ny lärare dyker alltså upp i slutet.
 */
export const applyStoredOrder = (ids: string[], stored: string[]): string[] => {
  const present = new Set(ids);
  const sorted = stored.filter(id => present.has(id));
  const seen = new Set(sorted);
  return [...sorted, ...ids.filter(id => !seen.has(id))];
};

/**
 * Vad som ska sparas efter en flytt: den synliga ordningen, följd av sparade
 * id:n som inte syns just nu. En lärare som saknas i en termin tappar alltså
 * inte sin plats till nästa.
 */
export const nextStoredOrder = (visible: string[], stored: string[]): string[] => {
  const shown = new Set(visible);
  return [...visible, ...stored.filter(id => !shown.has(id))];
};

const MAX_STORED_IDS = 500;

/** För `usePersistentState`: en lista unika strängar, annars tom. */
export const sanitizeIdList = (raw: unknown): string[] => {
  if (!Array.isArray(raw)) return [];
  const ids = raw.filter((item): item is string => typeof item === 'string' && item.length > 0);
  return Array.from(new Set(ids)).slice(0, MAX_STORED_IDS);
};
