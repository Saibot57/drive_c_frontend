/**
 * Väntetider mellan försöken. Första hämtningen har misslyckats tillfälligt i
 * produktion medan nästa gick bra, se terminsplaneraren.
 */
export const RETRY_DELAYS_MS = [700, 2000];

/** Kör `load` igen efter en stund om det misslyckas. Det sista felet kastas vidare. */
export const withRetry = async <T,>(load: () => Promise<T>, delays: readonly number[] = RETRY_DELAYS_MS): Promise<T> => {
  for (let attempt = 0; ; attempt++) {
    try {
      return await load();
    } catch (error) {
      if (attempt >= delays.length) throw error;
      await new Promise(resolve => setTimeout(resolve, delays[attempt]));
    }
  }
};
