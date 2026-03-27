// ── Element types ──
export type ElementType = 'text' | 'table' | 'mindmap' | 'list';

// ── Backend mirrors ──
export interface Surface {
  id: string;
  user_id: string;
  name: string;
  sort_order: number;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
}

export interface WorkspaceElement {
  id: string;
  user_id: string;
  type: ElementType;
  title: string;
  content: unknown; // JSON shape varies by type
  created_at: string;
  updated_at: string;
}

export interface SurfaceElement {
  id: string;
  surface_id: string;
  element_id: string;
  position_x: number;
  position_y: number;
  width: number;
  height: number;
  is_locked: boolean;
  is_on_canvas: boolean;
  z_index: number;
  element?: WorkspaceElement;
}

// ── Canvas viewport ──
export interface ViewportState {
  panX: number;
  panY: number;
  zoom: number;
}

// ── Reducer ──
export interface WorkspaceState {
  surfaces: Surface[];
  activeSurfaceId: string | null;
  placements: SurfaceElement[];
  elements: Record<string, WorkspaceElement>;
  viewport: ViewportState;
  selectedElementId: string | null;
  isLeftSidebarOpen: boolean;
  isRightSidebarOpen: boolean;
}

export type WorkspaceAction =
  | { type: 'SET_SURFACES'; surfaces: Surface[] }
  | { type: 'SET_ACTIVE_SURFACE'; surfaceId: string }
  | { type: 'SET_PLACEMENTS'; placements: SurfaceElement[] }
  | { type: 'SET_ELEMENT'; element: WorkspaceElement }
  | { type: 'SET_ELEMENTS'; elements: WorkspaceElement[] }
  | { type: 'UPDATE_PLACEMENT'; placementId: string; changes: Partial<SurfaceElement> }
  | { type: 'REMOVE_PLACEMENT'; placementId: string }
  | { type: 'ADD_PLACEMENT'; placement: SurfaceElement }
  | { type: 'SET_VIEWPORT'; viewport: Partial<ViewportState> }
  | { type: 'SELECT_ELEMENT'; elementId: string | null }
  | { type: 'TOGGLE_LEFT_SIDEBAR' }
  | { type: 'TOGGLE_RIGHT_SIDEBAR' }
  | { type: 'REMOVE_ELEMENT'; elementId: string }
  | { type: 'ADD_SURFACE'; surface: Surface }
  | { type: 'UPDATE_SURFACE'; surfaceId: string; changes: Partial<Surface> }
  | { type: 'REMOVE_SURFACE'; surfaceId: string };
