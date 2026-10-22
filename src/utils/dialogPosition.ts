/**
 * Flyttbara dialoger: hur långt en dialog får flyttas, hur långt ett
 * tangenttryck flyttar den och var den låg senast.
 *
 * Förskjutningen räknas från dialogens vanliga plats (mitt på skärmen), så
 * att { x: 0, y: 0 } alltid betyder "där den brukar ligga".
 */

export type DialogOffset = { x: number; y: number };

/** Dialogens ruta när den inte är flyttad, i fönstrets koordinater. */
export type DialogBox = { left: number; top: number; width: number; height: number };

export type Viewport = { width: number; height: number };

export const CENTERED: DialogOffset = { x: 0, y: 0 };

/** Så mycket av dialogen som alltid syns i sidled, så att den går att dra tillbaka. */
export const MIN_VISIBLE_PX = 120;
/** Så mycket av överkanten som alltid syns nertill: titelraden ska gå att nå. */
export const TITLE_VISIBLE_PX = 56;

export const KEY_STEP_PX = 24;
export const KEY_STEP_LARGE_PX = 96;

export const isMoved = (offset: DialogOffset) => offset.x !== 0 || offset.y !== 0;

/**
 * Håller dialogen inom fönstret. Överkanten får inte hamna ovanför fönstret
 * (där titelraden sitter) och minst en bit av dialogen syns i sidled och
 * nertill. Dialogens vanliga plats är alltid tillåten, även när dialogen är
 * större än fönstret.
 */
export function clampDialogOffset(offset: DialogOffset, box: DialogBox, viewport: Viewport): DialogOffset {
  const minX = Math.min(0, MIN_VISIBLE_PX - box.width - box.left);
  const maxX = Math.max(0, viewport.width - MIN_VISIBLE_PX - box.left);
  const minY = Math.min(0, -box.top);
  const maxY = Math.max(0, viewport.height - TITLE_VISIBLE_PX - box.top);
  return {
    x: Math.round(Math.min(maxX, Math.max(minX, offset.x))),
    y: Math.round(Math.min(maxY, Math.max(minY, offset.y))),
  };
}

export type MoveKeyEvent = {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
};

const ARROWS: Record<string, DialogOffset> = {
  ArrowLeft: { x: -1, y: 0 },
  ArrowRight: { x: 1, y: 0 },
  ArrowUp: { x: 0, y: -1 },
  ArrowDown: { x: 0, y: 1 },
};

/**
 * Ctrl+Cmd+pil flyttar dialogen, med Shift ett längre steg. Cmd+pil ensam
 * flyttar markören i textfälten på Mac och får vara kvar. Utanför Mac blir
 * Win-tangenten Cmd och tas av systemet, så där gäller Ctrl+Alt+pil.
 * Returnerar null när tangenten inte flyttar dialogen.
 */
export function dialogMoveStep(event: MoveKeyEvent): DialogOffset | null {
  const direction = ARROWS[event.key];
  if (!direction || !event.ctrlKey) return null;
  const mac = event.metaKey && !event.altKey;
  const other = event.altKey && !event.metaKey;
  if (!mac && !other) return null;
  const step = event.shiftKey ? KEY_STEP_LARGE_PX : KEY_STEP_PX;
  return { x: direction.x * step, y: direction.y * step };
}

/**
 * Var varje dialog låg senast, så länge sidan är öppen. Sparas medvetet inte
 * i localStorage: en dialog ska inte kunna ligga kvar i ett hörn till nästa
 * besök, eller utanför en mindre skärm.
 */
const remembered = new Map<string, DialogOffset>();

export function rememberDialogOffset(key: string, offset: DialogOffset): void {
  if (isMoved(offset)) remembered.set(key, offset);
  else remembered.delete(key);
}

export function recallDialogOffset(key: string): DialogOffset {
  return remembered.get(key) ?? CENTERED;
}

/** Bara för tester. */
export function forgetDialogOffsets(): void {
  remembered.clear();
}

/** Det man klickar på utan att det blir en dragning. */
const INTERACTIVE = [
  'input',
  'textarea',
  'select',
  'button',
  'a[href]',
  'label',
  '[contenteditable]:not([contenteditable="false"])',
  '[role="button"]',
  '[role="checkbox"]',
  '[role="combobox"]',
  '[role="listbox"]',
  '[role="menuitem"]',
  '[role="option"]',
  '[role="slider"]',
  '[role="switch"]',
  '[role="tab"]',
  '[data-dialog-no-drag]',
].join(',');

/** Markerar titelraden, som dialogen dras i. */
export const DRAG_HANDLE_ATTR = 'data-dialog-handle';

/**
 * Startar en tryckning på `target` en dragning av `dialog`? Dialogen dras i
 * titelraden eller i sin tomma kant, inte i fält, knappar eller text i
 * innehållet (där ska man kunna markera). En tryckning på dialogens egen
 * rullningslist drar inte heller.
 */
export function isDialogDragStart(
  target: EventTarget | null,
  dialog: HTMLElement,
  pointer: { clientX: number; clientY: number },
): boolean {
  if (!(target instanceof Element) || !dialog.contains(target)) return false;
  const interactive = target.closest(INTERACTIVE);
  if (interactive && dialog.contains(interactive)) return false;
  if (target === dialog) return !isOnScrollbar(dialog, pointer);
  const handle = target.closest(`[${DRAG_HANDLE_ATTR}]`);
  return Boolean(handle && dialog.contains(handle));
}

function isOnScrollbar(el: HTMLElement, pointer: { clientX: number; clientY: number }): boolean {
  const rect = el.getBoundingClientRect();
  const x = pointer.clientX - rect.left - el.clientLeft;
  const y = pointer.clientY - rect.top - el.clientTop;
  return x >= el.clientWidth || y >= el.clientHeight;
}
