import type { Surface } from '../types/workspace.types';

/**
 * Den yta användaren senast hade öppen, per enhet. Id:n är UUID:n, så en
 * annan användare på samma dator träffar aldrig fel yta — bara ingen alls,
 * och då blir det första fliken som förut.
 */
export const LAST_SURFACE_KEY = 'workspace_last_surface_id';

export function readLastSurfaceId(): string | null {
  try {
    return window.localStorage.getItem(LAST_SURFACE_KEY);
  } catch {
    return null;
  }
}

export function writeLastSurfaceId(surfaceId: string): void {
  try {
    window.localStorage.setItem(LAST_SURFACE_KEY, surfaceId);
  } catch {
    // Privat läge eller full lagring. Då blir det första fliken nästa gång.
  }
}

/** Ytan att öppna vid start: den senaste om den finns kvar, annars den första. */
export function pickStartSurface(surfaces: Surface[], lastId: string | null): Surface | undefined {
  const open = surfaces.filter((s) => !s.is_archived);
  return open.find((s) => s.id === lastId) ?? open[0];
}

/** Flyttar ett id till en ny plats i listan. Okänt id ger listan orörd. */
export function moveId(ids: string[], id: string, toIndex: number): string[] {
  const from = ids.indexOf(id);
  if (from === -1) return ids;
  const target = Math.max(0, Math.min(toIndex, ids.length - 1));
  if (target === from) return ids;
  const next = ids.filter((x) => x !== id);
  next.splice(target, 0, id);
  return next;
}

/**
 * Lägger de öppna ytorna i den givna ordningen med nya sort_order, 1 och
 * uppåt, som servern gör. Arkiverade ytor behåller sina och ligger sist.
 */
export function applySurfaceOrder(surfaces: Surface[], orderedIds: string[]): Surface[] {
  const byId = new Map(surfaces.map((s) => [s.id, s]));
  const ordered = orderedIds
    .map((id) => byId.get(id))
    .filter((s): s is Surface => !!s)
    .map((s, i) => ({ ...s, sort_order: i + 1 }));
  const listed = new Set(orderedIds);
  return [...ordered, ...surfaces.filter((s) => !listed.has(s.id))];
}
