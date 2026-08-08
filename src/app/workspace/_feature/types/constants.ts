import type { ElementType } from './workspace.types';

/**
 * En färg per elementtyp, ur samma pastellfamilj som schemaplanerarens
 * byggstenar och temakalenderns arbetsområden. Ritas som en tunn list överst
 * på kortet, så att man ser på avstånd vad som är en tabell och vad som är en
 * mindmap utan att behöva läsa innehållet.
 */
export const TYPE_COLORS: Record<ElementType, string> = {
  text: '#bae6fd',
  table: '#fde68a',
  mindmap: '#ddd6fe',
  list: '#d9f99d',
  kanban: '#fecdd3',
  sticky: '#fed7aa',
  pdf: '#c7d2fe',
  image: '#a7f3d0',
  link: '#e5e7eb',
  wheel_ref: '#f5d0fe',
};

export const GRID_SIZE = 16;
export const MIN_ZOOM = 0.5;
export const MAX_ZOOM = 1.5;
export const DEFAULT_ZOOM = 1;
export const CANVAS_EXTEND = 1.5;

export const DEFAULT_ELEMENT_WIDTH = 320;
export const DEFAULT_ELEMENT_HEIGHT = 200;
export const MIN_ELEMENT_WIDTH = 160;
export const MIN_ELEMENT_HEIGHT = 80;

/**
 * Hjulet är runt och tappar sina etiketter långt före de andra typerna. Under
 * det här måttet är det inte längre läsbart, så det får ett eget golv.
 */
export const MIN_WHEEL_REF_SIZE = 280;

/**
 * Under den här canvas-zoomen ritas hjulet utan text. Motsvarar TEXT_MIN_EXTENT
 * i temakalendern, som löser samma sak inuti hjulet: hellre ren färg än
 * bokstäver som ändå inte går att läsa.
 */
export const WHEEL_REF_TEXT_MIN_ZOOM = 0.7;

export const DEBOUNCE_POSITION_MS = 300;
export const DEBOUNCE_CONTENT_MS = 500;

/**
 * Notiser med en Ångra-knapp ligger kvar längre än vanliga bekräftelser —
 * standardtiden på 2,6 s räcker inte för att hinna läsa och klicka.
 */
export const UNDO_NOTICE_MS = 8000;

// Ctrl-assisted resize: screen-pixel distance from an edge that counts as "near".
export const CTRL_RESIZE_THRESHOLD_PX = 24;
// Fraction of the element's smaller dimension kept as a center "drag" zone,
// so very small elements can still be dragged with Ctrl held.
export const CTRL_RESIZE_CENTER_FRACTION = 0.3;
