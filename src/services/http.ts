/**
 * Uppackning av backendens svar. Alla svar har formen `{ success, data, error }`,
 * och felen är skrivna för användaren.
 *
 * Varje service har i dag en egen kopia av den här funktionen (`readData` i
 * arbetslag, narvaro, term och themeWheel; `unwrap` i planner). Den här filen
 * är den gemensamma platsen för nya services, och den som arkitekturplanens
 * steg 4 (docs/plans/arkitektur-2026-11.md) flyttar de befintliga till. Tills
 * dess importerar bara `mindmapService` härifrån; ingen befintlig service är
 * ändrad. Funktionen är ordagrant `arbetslagService`:s.
 */
export const readData = async <T>(response: Response, fallbackMessage: string): Promise<T> => {
  const payload = await response.json().catch(() => null);
  if (!response.ok || payload?.success === false) {
    throw new Error(payload?.error || fallbackMessage);
  }
  return payload?.data as T;
};
