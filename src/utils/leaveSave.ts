/**
 * Planerarens sparning när sidan lämnas inom appen, på modulnivå så att den
 * överlever att planeraren avmonteras. Samma tanke som labPlanStore.
 *
 * Sparningen vid unmount väntar in en sparning som redan är i flykt och
 * kommer därför efter släppet av låset. Går läraren snabbt tillbaka till
 * planeraren kunde inläsningen och låset annars hinna före: vyn byggde på den
 * gamla versionen, och nästa sparning gav en falsk konfliktruta. Den som
 * öppnar planeraren väntar därför in sparningen först (useArchiveManager).
 */

/** Så länge en ny planerare väntar. Ett anrop som aldrig svarar får inte låsa sidan. */
export const LEAVE_SAVE_WAIT_MS = 5000;

let pending: Promise<void> | null = null;

/** Följer en sparning tills den är klar. Den får misslyckas; ingen väntar på felet. */
export const trackLeaveSave = (save: Promise<unknown>): void => {
  const settled = save.then(() => undefined, () => undefined);
  const next: Promise<void> = pending ? Promise.all([pending, settled]).then(() => undefined) : settled;
  pending = next;
  void next.then(() => {
    if (pending === next) pending = null;
  });
};

/** Väntar in sparningarna, men högst `timeoutMs`. */
export const waitForLeaveSave = async (timeoutMs = LEAVE_SAVE_WAIT_MS): Promise<void> => {
  if (!pending) return;
  let timer: ReturnType<typeof setTimeout> | undefined;
  await Promise.race([
    pending,
    new Promise<void>(resolve => { timer = setTimeout(resolve, timeoutMs); }),
  ]);
  clearTimeout(timer);
};
