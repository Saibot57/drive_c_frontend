export const GRID_SIZE = 16;
export const MIN_ZOOM = 0.5;
export const MAX_ZOOM = 1.5;
export const DEFAULT_ZOOM = 1;
export const CANVAS_EXTEND = 1.5;

export const DEFAULT_ELEMENT_WIDTH = 320;
export const DEFAULT_ELEMENT_HEIGHT = 200;
export const MIN_ELEMENT_WIDTH = 160;
export const MIN_ELEMENT_HEIGHT = 80;

export const DEBOUNCE_POSITION_MS = 300;
export const DEBOUNCE_CONTENT_MS = 500;

// Ctrl-assisted resize: screen-pixel distance from an edge that counts as "near".
export const CTRL_RESIZE_THRESHOLD_PX = 24;
// Fraction of the element's smaller dimension kept as a center "drag" zone,
// so very small elements can still be dragged with Ctrl held.
export const CTRL_RESIZE_CENTER_FRACTION = 0.3;
