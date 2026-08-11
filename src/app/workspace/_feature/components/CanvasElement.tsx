'use client';

import { useEffect, useRef } from 'react';
import { Lock, Unlock } from 'lucide-react';
import type { ElementType, SurfaceElement, WorkspaceElement } from '../types/workspace.types';
import {
  GRID_SIZE,
  CTRL_RESIZE_THRESHOLD_PX,
  CTRL_RESIZE_CENTER_FRACTION,
  TYPE_COLORS,
  MIN_WHEEL_REF_SIZE,
  MIN_HEADING_WIDTH,
} from '../types/constants';
import { useElementDrag, type Point } from '../hooks/useElementDrag';
import { useElementResize, type Box } from '../hooks/useElementResize';
import ElementRenderer from './ElementRenderer';
import type { ProvenanceStatus } from '../utils/provenance';

type ResizeDir = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

function detectResizeZone(
  localX: number,
  localY: number,
  width: number,
  height: number,
  threshold: number,
): ResizeDir | null {
  const deadHalf = (Math.min(width, height) * CTRL_RESIZE_CENTER_FRACTION) / 2;
  if (
    Math.abs(localX - width / 2) < deadHalf &&
    Math.abs(localY - height / 2) < deadHalf
  ) {
    return null;
  }

  const nearN = localY < threshold;
  const nearS = localY > height - threshold;
  const nearW = localX < threshold;
  const nearE = localX > width - threshold;

  if (nearN && nearE) return 'ne';
  if (nearN && nearW) return 'nw';
  if (nearS && nearE) return 'se';
  if (nearS && nearW) return 'sw';
  if (nearN) return 'n';
  if (nearS) return 's';
  if (nearE) return 'e';
  if (nearW) return 'w';
  return null;
}

/** Ritar sin egen ram ända ut i kanten och vill inte ha någon padding. */
const FLUSH_TYPES: ElementType[] = ['sticky', 'pdf', 'image', 'link', 'wheel_ref', 'wheel_part', 'schedule_day', 'heading'];
/** Har sin egen rullning inuti och ska inte kunna rullas av wrappern. */
const CLIPPED_TYPES: ElementType[] = ['pdf', 'image', 'link', 'wheel_ref', 'schedule_day'];
/** Ritas utan kort: formen är elementet, och rektangeln runt den var en lögn. */
const BARE_TYPES: ElementType[] = ['wheel_part', 'heading'];

/**
 * Rektangeln tar inte emot pekaren — det gör formen inuti. Gäller tårtbiten,
 * vars path träfftestas mot sin fyllning så att hålet i bågen blir tom yta.
 * En rubrik är tvärtom text i en rektangel och måste gå att klicka på, så den
 * är låddlös utan att vara genomsläpplig.
 */
const SHAPE_HIT_TYPES: ElementType[] = ['wheel_part'];

/**
 * Höjden följer innehållet och kan inte dras. Rubriker har fast teckenstorlek
 * per nivå; det enda som ändrar höjden är hur många rader texten bryts på.
 */
const AUTO_HEIGHT_TYPES: ElementType[] = ['heading'];

/** Bara bredden går att dra på en rubrik — höjden är inte användarens att sätta. */
const WIDTH_ONLY_DIRECTIONS = ['e', 'w'] as const;

/**
 * Har ett eget redigeringsläge och fokuserar sig själv när det öppnas: rubriken
 * blir contentEditable först vid dubbelklick, länken visar sitt formulär först
 * vid pennknappen. De får signalen vidare i stället för fokus härifrån, för
 * fältet finns inte att fokusera förrän de öppnat det.
 */
const SELF_EDITING_TYPES: ElementType[] = ['heading', 'link'];

/** Fält som tar text. En listas kryssruta är också ett <input>, men inte det. */
const TEXTUAL_INPUT_TYPES = ['text', 'search', 'url'];

/**
 * Det första fält på kortet som går att skriva i.
 *
 * Urvalet görs på DOM-egenskaperna och inte i selektorn, eftersom flera av
 * editorerna skriver sina fält utan type-attribut — `input[type="text"]` hade
 * missat dem, medan `node.type` ger "text" ändå.
 */
const editableField = (root: HTMLElement | null): HTMLElement | null => {
  const candidates = root?.querySelectorAll<HTMLElement>('textarea, input, [contenteditable]') ?? [];
  return Array.from(candidates).find(node => {
    if (node instanceof HTMLTextAreaElement) return !node.readOnly && !node.disabled;
    if (node instanceof HTMLInputElement) {
      return !node.readOnly && !node.disabled && TEXTUAL_INPUT_TYPES.includes(node.type);
    }
    return node.isContentEditable;
  }) ?? null;
};

function contentClassName(type: ElementType): string {
  return [
    'ws-element__content',
    FLUSH_TYPES.includes(type) && 'ws-element__content--flush',
    CLIPPED_TYPES.includes(type) && 'ws-element__content--clip',
  ]
    .filter(Boolean)
    .join(' ');
}

interface CanvasElementProps {
  placement: SurfaceElement;
  element: WorkspaceElement;
  isSelected: boolean;
  zoom: number;
  onSelect: () => void;
  onMove: (placementId: string, x: number, y: number) => void;
  onResize: (placementId: string, w: number, h: number) => void;
  /** Vid släpp: ger ångra en post per gest i stället för per musrörelse. */
  onMoveEnd?: (placementId: string, from: Point, to: Point) => void;
  onResizeEnd?: (placementId: string, from: Box, to: Box) => void;
  onToggleLock: (placementId: string) => void;
  onContentChange: (elementId: string, content: unknown) => void;
  onContextMenu?: (x: number, y: number) => void;
  /** Härkomstens tillstånd, för sticklingar som har en källa att jämföra mot. */
  provenance?: ProvenanceStatus;
  /** Räknare från högerklickets "Redigera". Ett nytt värde öppnar redigeringen. */
  editSignal?: number;
}

const RESIZE_DIRECTIONS = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'] as const;

export default function CanvasElement({
  placement,
  element,
  isSelected,
  zoom,
  onSelect,
  onMove,
  onResize,
  onMoveEnd,
  onResizeEnd,
  onToggleLock,
  onContentChange,
  onContextMenu,
  provenance,
  editSignal,
}: CanvasElementProps) {
  const isAutoHeight = AUTO_HEIGHT_TYPES.includes(element.type);

  const { handleMouseDown: handleDragDown } = useElementDrag({
    placementId: placement.id,
    zoom,
    gridSize: GRID_SIZE,
    startX: placement.position_x,
    startY: placement.position_y,
    onMove,
    onMoveEnd,
  });

  const { handleResizeStart } = useElementResize({
    placementId: placement.id,
    zoom,
    gridSize: GRID_SIZE,
    currentX: placement.position_x,
    currentY: placement.position_y,
    currentWidth: placement.width,
    currentHeight: placement.height,
    onResize,
    onMove,
    onResizeEnd,
    // Hjulet tappar sina etiketter långt före de andra typerna. Rubriken har
    // inget innehåll att klämma sönder och får krympa till ett enda ord.
    minWidth: element.type === 'wheel_ref'
      ? MIN_WHEEL_REF_SIZE
      : element.type === 'heading'
        ? MIN_HEADING_WIDTH
        : undefined,
    minHeight: element.type === 'wheel_ref' ? MIN_WHEEL_REF_SIZE : undefined,
  });

  /*
   * Höjden mäts ur DOM:en och skrivs tillbaka. Den styr ingenting visuellt —
   * rutan är `height: auto` — men exportens bildruta räknas ut ur
   * position_y + height, så en inaktuell höjd hade klippt rubriken i PDF:en.
   * Eftersom det sparade värdet aldrig matas tillbaka till DOM-höjden kan det
   * här inte bli en loop; tröskeln finns bara för att avrundning inte ska
   * utlösa sparningar i onödan.
   */
  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!isAutoHeight) return;
    const node = rootRef.current;
    if (!node) return;

    const observer = new ResizeObserver(() => {
      // getBoundingClientRect är i skärmpixlar; canvasen är skalad.
      const measured = Math.ceil(node.getBoundingClientRect().height / zoom);
      if (measured > 0 && Math.abs(measured - placement.height) > 1) {
        onResize(placement.id, placement.width, measured);
      }
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [isAutoHeight, zoom, placement.id, placement.width, placement.height, onResize]);

  /*
   * "Redigera" i högerklick-menyn. De flesta typerna har sina fält framme så
   * fort kortet är olåst — det som saknas är markören, och att hitta rätt ruta
   * med musen i ett kort med tolv tabellceller är just det menyvalet ska slippa.
   */
  const contentRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (editSignal === undefined || SELF_EDITING_TYPES.includes(element.type)) return;
    const field = editableField(contentRef.current);
    if (!field) return;
    field.focus();
    // Markören sist i det som redan står: menyvalet ska öppna för att skriva
    // vidare, inte markera texten och riskera att nästa tangent ersätter den.
    if (field instanceof HTMLTextAreaElement || field instanceof HTMLInputElement) {
      const end = field.value.length;
      field.setSelectionRange(end, end);
    }
  }, [editSignal, element.type]);

  /*
   * Vilande hörn på ett omarkerat kort. Rubriken har ingen lodrät storlek att ta
   * i, och de kortlösa typerna har ingen rektangel vars hörn betyder något — där
   * står handtagen kvar bakom markeringen som förut.
   */
  const standbyDirections: readonly ResizeDir[] =
    isAutoHeight || BARE_TYPES.includes(element.type) ? [] : ['se'];

  const resizeDirections: readonly ResizeDir[] = placement.is_locked
    ? []
    : isSelected
      ? (isAutoHeight ? WIDTH_ONLY_DIRECTIONS : RESIZE_DIRECTIONS)
      : standbyDirections;

  const classNames = [
    'ws-element',
    BARE_TYPES.includes(element.type) && 'ws-element--bare',
    SHAPE_HIT_TYPES.includes(element.type) && 'ws-element--shape-hit',
    isAutoHeight && 'ws-element--auto-height',
    isSelected && 'ws-element--selected',
    !placement.is_locked && 'ws-element--unlocked',
  ]
    .filter(Boolean)
    .join(' ');

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button === 0 && e.ctrlKey && !placement.is_locked) {
      const rect = e.currentTarget.getBoundingClientRect();
      const localX = e.clientX - rect.left;
      const localY = e.clientY - rect.top;
      const detected = detectResizeZone(
        localX,
        localY,
        rect.width,
        rect.height,
        CTRL_RESIZE_THRESHOLD_PX,
      );
      // Auto-höjd har ingen lodrät storlek att ta i: 'ne' blir 'e', 'n' blir
      // ingenting alls och faller tillbaka på ett vanligt drag.
      const dir = isAutoHeight && detected
        ? ((detected.replace(/[ns]/g, '') || null) as ResizeDir | null)
        : detected;
      if (dir) {
        onSelect();
        handleResizeStart(dir)(e);
        return;
      }
    }
    handleDragDown(e);
  };

  return (
    <div
      ref={rootRef}
      className={classNames}
      style={{
        left: placement.position_x,
        top: placement.position_y,
        width: placement.width,
        // Auto-höjd låter texten bestämma; det sparade måttet är bara ett eko.
        height: isAutoHeight ? undefined : placement.height,
        zIndex: placement.z_index,
        // Listen överst på kortet. Färgen är data om elementtypen, som
        // notislappens färg — därför inline och inte i CSS-filen.
        '--ws-type-color': TYPE_COLORS[element.type],
      } as React.CSSProperties}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
      onPointerDown={handlePointerDown}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onContextMenu?.(e.clientX, e.clientY);
      }}
    >
      {/*
        Härkomstmarkören. Tyst med flit: en prick, ingen notis och ingen dialog.
        Sticklingen hämtar aldrig om sig själv, så det här är det enda som
        berättar att källan gått vidare — men att berätta är inte att tjata.
      */}
      {(provenance === 'drifted' || provenance === 'missing') && !BARE_TYPES.includes(element.type) && (
        <span
          className={`ws-provenance-dot ws-provenance-dot--${provenance}`}
          data-export="omit"
          title={provenance === 'drifted'
            ? 'Källan har ändrats sedan det här hämtades. Högerklicka för att uppdatera.'
            : 'Källan finns inte längre.'}
        />
      )}

      {/* Lock button */}
      <button
        className="ws-lock-btn"
        onClick={(e) => {
          e.stopPropagation();
          onToggleLock(placement.id);
        }}
        title={placement.is_locked ? 'Lås upp' : 'Lås'}
      >
        {placement.is_locked ? <Lock size={12} /> : <Unlock size={12} />}
      </button>

      {/* Content */}
      <div ref={contentRef} className={contentClassName(element.type)}>
        <ElementRenderer
          element={element}
          isLocked={placement.is_locked}
          isSelected={isSelected}
          onChange={(content) => onContentChange(element.id, content)}
          provenance={provenance}
          editSignal={editSignal}
        />
      </div>

      {/*
        Handtag. Hela uppsättningen på det markerade kortet; på ett omarkerat men
        olåst kort står hörnet nere till höger kvar, så att en storleksändring är
        ett grepp och inte klick-sikta-dra.
      */}
      {resizeDirections.map((dir) => (
        <div
          key={dir}
          className={`ws-resize-handle ws-resize-handle--${dir}${isSelected ? '' : ' ws-resize-handle--standby'}`}
          onPointerDown={(e) => {
            // Att ta i hörnet på ett omarkerat kort markerar det också, som
            // vilket annat grepp som helst. Resize-starten stoppar händelsen, så
            // kortets eget onClick hinner aldrig göra det.
            if (!isSelected) onSelect();
            handleResizeStart(dir)(e);
          }}
        />
      ))}
    </div>
  );
}
