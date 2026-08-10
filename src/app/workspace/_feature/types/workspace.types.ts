// ── Element types ──
export type ElementType =
  | 'text' | 'table' | 'mindmap' | 'list' | 'kanban' | 'sticky'
  | 'pdf' | 'image' | 'link'
  /** Skrivskyddad vy av ett hjul i temakalendern. Innehållet är bara ett id. */
  | 'wheel_ref'
  /** Utbruten tårtbit ur ett hjul. Stickling — äger sin egen kopia. */
  | 'wheel_part'
  /** En dag ur schemaplaneraren, skrivskyddad. Också en stickling. */
  | 'schedule_day'
  /** Fristående rubrik utan kort. Strukturerar ytan, bär inget innehåll. */
  | 'heading';

// ── Backend mirrors ──
export interface Surface {
  id: string;
  user_id: string;
  name: string;
  sort_order: number;
  is_archived: boolean;
  /** Vyn hör till ytan, så man kommer tillbaka dit man var. */
  viewport_x: number;
  viewport_y: number;
  viewport_zoom: number;
  created_at: string;
  updated_at: string;
  /** Antal placeringar på ytan. Används i bekräftelsen vid radering. */
  element_count?: number;
}

export interface WorkspaceElement {
  id: string;
  user_id: string;
  type: ElementType;
  title: string;
  content: unknown; // JSON shape varies by type
  created_at: string;
  updated_at: string;
  /** På hur många ytor elementet ligger. 2+ betyder att det är speglat. */
  surface_count?: number;
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
  /**
   * Alla användarens element, oavsett yta. Skilt från `elements`, som bara
   * innehåller det den aktiva ytan råkar visa.
   */
  library: WorkspaceElement[];
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
  | { type: 'SET_LIBRARY'; elements: WorkspaceElement[] }
  | { type: 'UPDATE_PLACEMENT'; placementId: string; changes: Partial<SurfaceElement> }
  | { type: 'REMOVE_PLACEMENT'; placementId: string }
  | { type: 'ADD_PLACEMENT'; placement: SurfaceElement }
  /** En hel sprängning på en gång — annars renderas ytan om per del. */
  | { type: 'ADD_PLACEMENTS'; placements: SurfaceElement[] }
  | { type: 'SET_VIEWPORT'; viewport: Partial<ViewportState> }
  | { type: 'SELECT_ELEMENT'; elementId: string | null }
  | { type: 'TOGGLE_LEFT_SIDEBAR' }
  | { type: 'TOGGLE_RIGHT_SIDEBAR' }
  | { type: 'REMOVE_ELEMENT'; elementId: string }
  | { type: 'ADD_SURFACE'; surface: Surface }
  | { type: 'UPDATE_SURFACE'; surfaceId: string; changes: Partial<Surface> }
  | { type: 'REMOVE_SURFACE'; surfaceId: string };
