/**
 * Vilken vy den publika schemasidan visar: dagslistan eller rutnätet.
 *
 * Förut valde CSS enbart på fönsterbredden (under 640 px gav listan). Men
 * webbläsaren inne i en app kan säga att fönstret är bredare än telefonen —
 * en deltagare som öppnade länken från Classroom på en Android, upprätt, fick
 * rutnätet med tre dagar (okt 2026). Telefonen känns därför också igen på
 * skärmen och webbläsarens eget besked, och deltagaren kan alltid byta vy
 * själv. Valet sparas i webbläsaren och går före gissningen.
 */
export type PublicViewMode = 'lista' | 'rutnat';

/** Under det här visar rutnätet en dag i taget; samma gräns som Tailwinds `sm`. */
export const PHONE_MAX_WIDTH = 640;

export type ScreenSignals = {
  /** `window.innerWidth`. */
  viewportWidth: number;
  /** `screen.width` och `screen.height`, i CSS-pixlar. */
  screenWidth: number;
  screenHeight: number;
  /** `(pointer: coarse)`: pekskärm som enda eller främsta pekdon. */
  coarsePointer: boolean;
  /** `navigator.userAgentData.mobile`, där webbläsaren har det (Chromium). */
  mobileHint: boolean | null;
  userAgent: string;
};

/**
 * En telefon, oavsett hur den hålls och vad appens webbläsare säger om
 * fönstret. Surfplattor räknas inte: deras kortaste sida är minst 744 px
 * (iPad mini), och där ryms tre dagar i rutnätet.
 */
export const isPhoneScreen = (signals: ScreenSignals): boolean => {
  if (signals.viewportWidth > 0 && signals.viewportWidth < PHONE_MAX_WIDTH) return true;
  if (signals.mobileHint === true) return true;
  // Android skriver "Mobile" bara på telefoner, inte på plattor.
  if (/iPhone|iPod|Android.+Mobile/.test(signals.userAgent)) return true;
  const shortSide = Math.min(signals.screenWidth, signals.screenHeight);
  return signals.coarsePointer && shortSide > 0 && shortSide < PHONE_MAX_WIDTH;
};

export const readScreenSignals = (): ScreenSignals => {
  const nav = window.navigator as Navigator & { userAgentData?: { mobile?: unknown } };
  const mobile = nav.userAgentData?.mobile;
  return {
    viewportWidth: window.innerWidth,
    screenWidth: window.screen?.width ?? 0,
    screenHeight: window.screen?.height ?? 0,
    coarsePointer: typeof window.matchMedia === 'function'
      && window.matchMedia('(pointer: coarse)').matches,
    mobileHint: typeof mobile === 'boolean' ? mobile : null,
    userAgent: nav.userAgent ?? '',
  };
};

/**
 * Deltagarens eget val går före allt. Annars får en telefon listan — eller
 * rutnätets dagsschema med `?vy=dagsschema` — och större skärmar rutnätet.
 */
export const resolveViewMode = (
  stored: PublicViewMode | null,
  isPhone: boolean,
  listOnMobile: boolean
): PublicViewMode => {
  if (stored) return stored;
  return isPhone && listOnMobile ? 'lista' : 'rutnat';
};

export const sanitizeViewMode = (value: unknown): PublicViewMode | null => (
  value === 'lista' || value === 'rutnat' ? value : null
);

/**
 * Nyckeln är gemensam för alla länkar, som valet av lektioner: det är hur
 * deltagaren vill läsa ett schema, inte en egenskap hos just det schemat.
 */
export const VIEW_MODE_STORAGE_KEY = 'fhsk-schema.vy.v1';

type ModeStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

const defaultStorage = (): ModeStorage => window.localStorage;

export const readStoredViewMode = (storage?: ModeStorage): PublicViewMode | null => {
  try {
    return sanitizeViewMode((storage ?? defaultStorage()).getItem(VIEW_MODE_STORAGE_KEY));
  } catch {
    return null;
  }
};

export const writeStoredViewMode = (mode: PublicViewMode, storage?: ModeStorage) => {
  try {
    (storage ?? defaultStorage()).setItem(VIEW_MODE_STORAGE_KEY, mode);
  } catch {
    // Avstängd lagring: valet gäller tills sidan laddas om.
  }
};
