/**
 * Klipper texten i schemakorten inför en export.
 *
 * Under `.pdf-export` släpper både `truncate` och `line-clamp`, så ett kort kan
 * få mer text än det rymmer på höjden. Korten klipper (`overflow: hidden`), och
 * utan det här passet skulle snittet hamna mitt i en rad. Passet klämmer i
 * stället texten till det antal rader som faktiskt får plats, så att snittet
 * landar på en radbrytning och slutar med "…".
 *
 * Anteckningarna ger vika först — de ligger sist i flödet. Räcker inte det får
 * titeln lämna rader den också, ned till minst en.
 *
 * Måste köras efter att `.pdf-export` sitter på plats och typsnitten är
 * laddade — radhöjden går inte att mäta innan dess.
 */

/** Mätbrus. Under en pixel är inte ett överflöd. */
const OVERFLOW_TOLERANCE_PX = 1;

/** En rad är minimum. Ett kapat "…" utan text säger ingenting. */
const MIN_LINES = 1;

export type ExportFitResult = {
  /** `instanceId` för varje kort som fick text bortklippt. */
  truncatedInstanceIds: string[];
  /**
   * Tar bort de inline-stilar passet satte. Behövs bara på det levande DOM:et
   * (bildexporten) — vektorvägen kastar ändå sin klon.
   */
  restore: () => void;
};

const lineHeightOf = (element: HTMLElement) => {
  const style = getComputedStyle(element);
  const lineHeight = parseFloat(style.lineHeight);
  if (Number.isFinite(lineHeight) && lineHeight > 0) return lineHeight;
  // `line-height: normal` ger NaN. 1.4 är vad `.pdf-export` sätter på korten.
  const fontSize = parseFloat(style.fontSize);
  return Number.isFinite(fontSize) && fontSize > 0 ? fontSize * 1.4 : 0;
};

/**
 * Var texten faktiskt försvinner: `overflow: hidden` klipper vid padding-boxen,
 * alltså kortets ytterkant — inte vid innehållsboxen. Mäter man mot den senare
 * blir kortets nedre padding felaktigt förlorad höjd, och kort som ryms fint
 * rapporteras som avkortade.
 */
const clipBottomOf = (card: HTMLElement) => card.getBoundingClientRect().bottom;

/** Hur långt innehållet sticker ut nedanför klippkanten, i pixlar. */
const overflowBelow = (card: HTMLElement, body: HTMLElement) => {
  const limit = clipBottomOf(card);
  const contentBottom = Array.from(body.children).reduce(
    (lowest, child) => Math.max(lowest, child.getBoundingClientRect().bottom),
    limit
  );
  return contentBottom - limit;
};

const clampToLines = (element: HTMLElement, lines: number) => {
  element.style.display = '-webkit-box';
  element.style.setProperty('-webkit-box-orient', 'vertical');
  element.style.setProperty('-webkit-line-clamp', String(lines));
  element.style.overflow = 'hidden';
};

/** Tillbaka till stilmallens värden, så nästa mätning ser den naturliga höjden. */
const releaseClamp = (element: HTMLElement) => {
  element.style.display = '';
  element.style.removeProperty('-webkit-box-orient');
  element.style.removeProperty('-webkit-line-clamp');
  element.style.overflow = '';
};

/** Antal hela rader som ryms från elementets överkant ned till klippkanten. */
const linesThatFit = (element: HTMLElement, clipBottom: number) => {
  const lineHeight = lineHeightOf(element);
  if (lineHeight <= 0) return 0;
  const space = clipBottom - element.getBoundingClientRect().top;
  return Math.floor((space + 0.5) / lineHeight);
};

export const fitScheduleCardsForExport = (root: ParentNode): ExportFitResult => {
  const truncatedInstanceIds: string[] = [];
  const undo: Array<() => void> = [];

  const remember = (element: HTMLElement) => {
    const original = element.getAttribute('style');
    undo.push(() => {
      if (original === null) element.removeAttribute('style');
      else element.setAttribute('style', original);
    });
  };

  root.querySelectorAll<HTMLElement>('.scheduled-event-card').forEach(card => {
    const body = card.querySelector<HTMLElement>('.sp-event-card-body');
    // Dolda kort — mobilrutnätet och poster som uteslutits — mäter noll.
    if (!body || body.getBoundingClientRect().height <= 0) return;
    if (overflowBelow(card, body) <= OVERFLOW_TOLERANCE_PX) return;

    const instanceId = card.dataset.instanceId;
    if (instanceId) truncatedInstanceIds.push(instanceId);

    const clipBottom = clipBottomOf(card);
    const notes = body.querySelector<HTMLElement>('[data-card-notes]');
    const title = body.querySelector<HTMLElement>('[data-card-title]');

    /** Klämmer anteckningarna till det som ryms just nu. Går att köra om. */
    const fitNotes = () => {
      if (!notes) return;
      releaseClamp(notes);
      const lines = linesThatFit(notes, clipBottom);
      if (lines < MIN_LINES) {
        notes.style.display = 'none';
        return;
      }
      clampToLines(notes, lines);
    };

    if (notes) remember(notes);
    fitNotes();

    // Räcker inte anteckningarna får titeln lämna rader den också. Korta kort
    // (< 45 min) har ingen egen titelrad – där klipper kortet hårt i stället.
    if (!title || overflowBelow(card, body) <= OVERFLOW_TOLERANCE_PX) return;

    remember(title);
    const titleLineHeight = lineHeightOf(title);
    if (titleLineHeight <= 0) return;

    // En rad i taget, med omätning mellan varje: raderna är inte exakt lika
    // höga som `line-height` när typsnittet byts mitt i raden, och ett räknat
    // hopp lämnar då en sista sliver kvar under kanten.
    let lines = Math.max(
      MIN_LINES,
      Math.round(title.getBoundingClientRect().height / titleLineHeight)
    );
    while (lines > MIN_LINES && overflowBelow(card, body) > OVERFLOW_TOLERANCE_PX) {
      lines -= 1;
      clampToLines(title, lines);
    }

    // Titeln tog mindre plats — allt under flyttade upp, så anteckningarna kan
    // få tillbaka en rad.
    fitNotes();
  });

  return {
    truncatedInstanceIds,
    restore: () => undo.forEach(revert => revert())
  };
};
