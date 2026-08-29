/**
 * Varenda måttsatt och färgsatt konstant som exporten ritar med.
 *
 * Kortet finns nu i två renderare — `ScheduledEventCard.tsx` för skärmen och
 * `buildScene.ts` för filen. Att de glider isär är den enda strukturella
 * risken i hela exporten, så alla tal som styr utseendet bor här och citerar
 * var på skärmen de kommer ifrån. Ändras något i kortet är det här man tittar.
 */

/** CSS-px är exakt 1/96 tum, PDF-punkter exakt 1/72. */
export const PX_TO_PT = 72 / 96;

// ── Rutnätets geometri (px, samma koordinatsystem som skärmen) ──

/** `w-[50px]` på tidsaxeln, `NewSchedulePlanner.tsx:1732`. */
export const TIME_AXIS_W_PX = 50;

/**
 * Dagrubrikens höjd: `py-2` (8+8) + `text-sm`-radboxen (20) + `border-bottom`
 * 2px från `.sp-day-header`. Det är de här 38 px som `computeClipHeightPx`
 * glömmer bort idag, vilket kapar sista lektionen när den slutar hel timme.
 */
export const HEADER_H_PX = 38;

/** `pt-4` på rutnätets wrapper, `NewSchedulePlanner.tsx:1731`. */
export const TOP_OFFSET_PX = 16;

/** Rubrikraden med arkivnamn och datum. Finns inte på skärmen — bara i filen. */
export const TITLE_H_PX = 40;

/**
 * Scenbredden i digitalt läge: tidsaxeln + 5 × 270. Ger en hel dag
 * proportionerna 1400 × 1174, vilket fyller en laptop- eller surfplatteskärm
 * utan svarta kanter.
 */
export const DIGITAL_WIDTH_PX = TIME_AXIS_W_PX + 5 * 270;

// ── Kortets innermått ──

/** `left: calc(...% + 4px)`, `width: calc(...% - 8px)` i `ScheduledEventCard`. */
export const CARD_INSET_X_PX = 4;

/** `p-1` (4px) runtom, men `.pdf-export` sätter `padding-top: 6px`. */
export const CARD_PAD_TOP_PX = 6;
export const CARD_PAD_X_PX = 4;
export const CARD_PAD_BOTTOM_PX = 4;

/** `rounded` = 0.25rem. Klampas mot halva höjden — `MIN_HEIGHT_PX` är 8. */
export const CARD_RADIUS_PX = 4;

/**
 * `leading-tight`, alltså vad skärmen faktiskt renderar med.
 *
 * `.pdf-export` sätter 1.4 i `globals.css:148-155`, men det talet är till för
 * att ge luft åt text som plötsligt får radbryta när `truncate` släpps i DOM:en.
 * Här styr vi radbrytningen själva, och 1.4 skulle kosta innehåll: ett 36 px
 * kort rymmer lärarnamnet vid 1.25 men inte vid 1.4. Skärmen är det Tobias
 * designar mot, så filen följer skärmen.
 */
export const LINE_HEIGHT_FACTOR = 1.25;

/** `text-2xs` / `text-xs` / `text-sm` ur `tailwind.config.ts`. */
export const FONT_SIZE_2XS_PX = 10;
export const FONT_SIZE_XS_PX = 12;
export const FONT_SIZE_SM_PX = 14;

/** Höjdtrösklarna i `ScheduledEventCard.tsx:80-81, 146, 155, 160`. */
export const SHORT_DURATION_MINUTES = 45;
export const COMPACT_HEIGHT_PX = 38;
export const TEACHER_ROOM_MIN_HEIGHT_PX = 30;
export const NOTES_MIN_HEIGHT_PX = 46;

/** `PlanningBlockCard.tsx:22` — egen tröskel, inte kortets. */
export const PLANNING_COMPACT_HEIGHT_PX = 46;

// ── Färger ──

export const COLOR_PAGE_BG = '#ffffff';
export const COLOR_DAY_HEADER_BG = '#ffffff';
/** `.sp-day-header` → `border-bottom: 2px solid #000`. */
export const COLOR_DAY_HEADER_RULE = '#000000';
export const DAY_HEADER_RULE_W_PX = 2;
/** `border-gray-200` mellan rubrikcellerna och `.sp-day-column`s högerkant. */
export const COLOR_COLUMN_BORDER = '#e5e7eb';
export const COLOR_DAY_COLUMN_BG = '#ffffff';
/** `.sp-time-axis` → `background: var(--sp-bg-time-axis)`. */
export const COLOR_TIME_AXIS_BG = '#f3f4f6';
/** `text-gray-500` på tidsetiketterna. */
export const COLOR_TIME_AXIS_TEXT = '#6b7280';

/**
 * Skärmens `.sp-grid-line` är `#f3f4f6` mot vit kolumn — knappt synlig där och
 * helt borta på en telefon. Filen ritar samma ton som kolumnkanten i stället,
 * så tidsindelningen går att läsa i små storlekar.
 */
export const COLOR_GRID_LINE = '#e5e7eb';

/** `.sp-event-card` → `border: 1px solid rgba(0,0,0,0.2)`, förblandas mot kortfärgen. */
export const CARD_BORDER_ALPHA = 0.2;
export const CARD_BORDER_W_PX = 1;
/** `opacity-70` på tidsetiketten i kortet, förblandas mot kortfärgen. */
export const CARD_TIME_ALPHA = 0.7;

export const COLOR_CARD_TEXT = '#000000';
/** `text-gray-700` på lärare och sal. */
export const COLOR_CARD_META = '#374151';
/** `text-gray-600` på anteckningar. */
export const COLOR_CARD_NOTES = '#4b5563';

/** `.sp-planning-card` → `2px dashed rgba(0,0,0,0.55)` på `#f8fafc`. */
export const COLOR_PLANNING_BG = '#f8fafc';
export const PLANNING_BORDER_ALPHA = 0.55;
export const PLANNING_BORDER_W_PX = 2;
export const PLANNING_DASH_PX = 3;

/** `.sp-planning-dayoff` → 2px svart ram på `#fecdd3`. */
export const COLOR_DAYOFF_BG = '#fecdd3';
export const COLOR_DAYOFF_BORDER = '#000000';

export const COLOR_TITLE_TEXT = '#000000';
export const COLOR_TITLE_DATE = '#6b7280';
export const TITLE_FONT_SIZE_PX = 18;
export const TITLE_DATE_FONT_SIZE_PX = 12;

/** `tracking-wide` på "LEDIG" = 0.025em. */
export const DAYOFF_LETTER_SPACING_EM = 0.025;

// ── Sidformat ──

export type PageMode = 'digital' | 'a4' | 'a3';

const MM_TO_PT = 72 / 25.4;

export const PAPER: Record<'a4' | 'a3', { widthPt: number; heightPt: number; marginPt: number }> = {
  // Liggande: A4 297×210 mm, A3 420×297 mm.
  a4: { widthPt: 841.89, heightPt: 595.28, marginPt: 10 * MM_TO_PT },
  a3: { widthPt: 1190.55, heightPt: 841.89, marginPt: 12 * MM_TO_PT },
};

/** Ett schema 08–09 ska inte bli en affisch. */
export const K_MAX = 1.8;

/** Under den här skalan varnar exporten i stället för att tyst leverera oläslig text. */
export const K_LOW_WARNING = 0.7;

/** Scenbredden på papper hålls inom rimliga radlängder. */
export const SCENE_WIDTH_MIN_PX = 1050;
export const SCENE_WIDTH_MAX_PX = 2200;

/** En hårfin linje får inte försvinna helt när `k` är 0.63. */
export const MIN_STROKE_PT = 0.25;
