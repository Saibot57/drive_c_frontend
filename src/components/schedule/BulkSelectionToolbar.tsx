'use client';

import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Pencil, X } from 'lucide-react';
import { Box, placeBulkToolbar } from '@/utils/bulkToolbarPlacement';

type BulkSelectionToolbarProps = {
  /** Schemats rullande yta, där korten och dagrubrikerna står. */
  canvasRef: React.RefObject<HTMLElement>;
  selectedIds: Set<string>;
  /** Falskt medan något annat äger schemat: ett drag, ramen, placering med tangentbordet. */
  enabled: boolean;
  onEdit: () => void;
  onCancel: () => void;
};

/**
 * Samma tangent som markerar posterna, se `isBulkToggleClick` i
 * `ScheduledEventCard`: Cmd på Mac, Ctrl på övriga.
 */
const usesMeta = () => /Mac|iPhone|iPad/.test(navigator.platform);

/**
 * Hålls markeringstangenten nere? Raden visas först när den släppts, så att
 * den inte hoppar runt medan man fortfarande klickar i poster.
 *
 * Pekarens rörelser bär också tangentens läge. De rättar till det när
 * uppsläppet aldrig nådde sidan, som efter Cmd+Tab till ett annat fönster.
 */
function useBulkModifierHeld() {
  const [held, setHeld] = useState(false);

  useEffect(() => {
    const meta = usesMeta();
    const key = meta ? 'Meta' : 'Control';
    const fromEvent = (event: KeyboardEvent | PointerEvent) => (meta ? event.metaKey : event.ctrlKey);
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === key) setHeld(true);
    };
    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.key === key) setHeld(false);
    };
    const handlePointer = (event: PointerEvent) => setHeld(fromEvent(event));
    const handleBlur = () => setHeld(false);

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('pointermove', handlePointer, { passive: true });
    window.addEventListener('pointerdown', handlePointer, { passive: true });
    window.addEventListener('blur', handleBlur);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('pointermove', handlePointer);
      window.removeEventListener('pointerdown', handlePointer);
      window.removeEventListener('blur', handleBlur);
    };
  }, []);

  return held;
}

const toBox = (rect: DOMRect): Box => ({
  left: rect.left,
  top: rect.top,
  right: rect.right,
  bottom: rect.bottom,
});

/**
 * Penna och kryss för massmarkeringen. Pennan öppnar massredigeringen, krysset
 * tar bort markeringen. Var raden står avgörs av `placeBulkToolbar`.
 *
 * Positionen mäts från korten själva och skrivs direkt i stilen, utan att
 * React renderar om: den räknas om vid varje rullning, och korten flyttar sig
 * när schemat ändras, filtret byts eller sidopanelerna fälls ihop.
 */
export function BulkSelectionToolbar({ canvasRef, selectedIds, enabled, onEdit, onCancel }: BulkSelectionToolbarProps) {
  const modifierHeld = useBulkModifierHeld();
  const barRef = useRef<HTMLDivElement>(null);
  const count = selectedIds.size;
  const visible = enabled && count > 0 && !modifierHeld;

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    const bar = barRef.current;
    if (!visible || !canvas || !bar) return;

    const measure = () => {
      const canvasRect = canvas.getBoundingClientRect();
      // Dagrubriken står klistrad överst; raden ska inte hamna under den.
      // Desktop och mobil har var sin, och den dolda har ingen höjd.
      const header = Array.from(canvas.querySelectorAll<HTMLElement>('.sp-day-header'))
        .find(el => el.offsetHeight > 0);
      // Schemat kan också sticka ut ur fönstret när hela sidan är rullad.
      const viewport: Box = {
        left: Math.max(0, canvasRect.left),
        top: Math.max(0, canvasRect.top, header ? header.getBoundingClientRect().bottom : 0),
        right: Math.min(window.innerWidth, canvasRect.left + canvas.clientWidth),
        bottom: Math.min(window.innerHeight, canvasRect.top + canvas.clientHeight),
      };

      const selected: Box[] = [];
      const others: Box[] = [];
      canvas.querySelectorAll<HTMLElement>('.scheduled-event-card[data-instance-id]').forEach(card => {
        const target = selectedIds.has(card.dataset.instanceId ?? '') ? selected : others;
        target.push(toBox(card.getBoundingClientRect()));
      });

      const { left, top } = placeBulkToolbar(selected, others, viewport, {
        width: bar.offsetWidth,
        height: bar.offsetHeight,
      });
      bar.style.left = `${left}px`;
      bar.style.top = `${top}px`;
    };

    measure();

    let frame = 0;
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    };
    // Fångstfasen hör både schemats egen rullning och sidans.
    window.addEventListener('scroll', schedule, { capture: true, passive: true });
    window.addEventListener('resize', schedule);
    const resizeObserver = new ResizeObserver(schedule);
    resizeObserver.observe(canvas);
    // Kort som läggs till, tas bort eller flyttas ändrar sin stil eller DOM:en.
    const mutationObserver = new MutationObserver(schedule);
    mutationObserver.observe(canvas, { subtree: true, childList: true, attributes: true, attributeFilter: ['style', 'class'] });

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', schedule, { capture: true });
      window.removeEventListener('resize', schedule);
      resizeObserver.disconnect();
      mutationObserver.disconnect();
    };
  }, [visible, canvasRef, selectedIds]);

  if (!visible) return null;

  const editLabel = count === 1 ? 'Redigera posten' : `Redigera ${count} poster`;

  // I body, eftersom en förälder med transform hade gjort `fixed` relativ till
  // sig själv i stället för fönstret, och mätningen räknar i fönstrets mått.
  return createPortal(
    <div
      ref={barRef}
      // Under dialogerna och högerklicksmenyn, över korten. Positionen sätts
      // av mätningen ovan innan något hunnit målas.
      className="fixed z-[55] flex gap-1 bg-ui-paper p-1 sp-context-menu animate-in fade-in-0 zoom-in-95 duration-150"
      role="toolbar"
      aria-label="Markerade poster"
    >
      <button
        type="button"
        className="grid h-9 w-9 place-items-center rounded sp-menu-item"
        onClick={onEdit}
        aria-label={editLabel}
        title={editLabel}
      >
        <Pencil size={18} />
      </button>
      <button
        type="button"
        className="grid h-9 w-9 place-items-center rounded sp-menu-item"
        onClick={onCancel}
        aria-label="Avmarkera"
        title="Avmarkera (Esc)"
      >
        <X size={18} />
      </button>
    </div>,
    document.body
  );
}
