/**
 * Nya försök när en autosparning misslyckats (dataintegritet F10). Skolans
 * wifi kan vara borta en minut eller mer, så försöken tystnar inte efter ett
 * par gånger: väntan dubblas från 2 s och stannar vid 30 s.
 */
export const RETRY_FIRST_DELAY_MS = 2000;
export const RETRY_MAX_DELAY_MS = 30000;

/** Väntan före försök nummer `attempt + 1` efter ett fel (0 = första nya försöket). */
export const retryDelay = (attempt: number): number => (
  Math.min(RETRY_FIRST_DELAY_MS * 2 ** Math.max(0, attempt), RETRY_MAX_DELAY_MS)
);

/**
 * Om ett fel kan gå över av sig självt. Ett fel med en HTTP-status under 500
 * (400 för en ogiltig post, 404, 409) gör inte det, och ett nytt försök skulle
 * bara ge samma svar. Nätfel och 5xx kan gå över.
 */
export const isTransientSaveError = (error: unknown): boolean => {
  const status = (error as { status?: unknown } | null)?.status;
  return !(typeof status === 'number' && status < 500);
};

/** Ett fel med serverns HTTP-status, så att isTransientSaveError kan skilja på dem. */
export class HttpStatusError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'HttpStatusError';
    this.status = status;
  }
}
