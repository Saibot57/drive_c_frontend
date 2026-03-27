'use client';

import { createContext, useContext, useReducer, type Dispatch, type ReactNode } from 'react';
import type { WorkspaceState, WorkspaceAction, ViewportState } from '../types/workspace.types';
import { DEFAULT_ZOOM } from '../types/constants';

const initialState: WorkspaceState = {
  surfaces: [],
  activeSurfaceId: null,
  placements: [],
  elements: {},
  viewport: { panX: 0, panY: 0, zoom: DEFAULT_ZOOM },
  selectedElementId: null,
  isLeftSidebarOpen: true,
  isRightSidebarOpen: true,
};

export function workspaceReducer(
  state: WorkspaceState,
  action: WorkspaceAction,
): WorkspaceState {
  switch (action.type) {
    case 'SET_SURFACES':
      return { ...state, surfaces: action.surfaces };
    case 'SET_ACTIVE_SURFACE':
      return { ...state, activeSurfaceId: action.surfaceId, selectedElementId: null };
    case 'SET_PLACEMENTS':
      return { ...state, placements: action.placements };
    case 'SET_ELEMENT':
      return {
        ...state,
        elements: { ...state.elements, [action.element.id]: action.element },
      };
    case 'SET_ELEMENTS': {
      const map = { ...state.elements };
      action.elements.forEach((el) => { map[el.id] = el; });
      return { ...state, elements: map };
    }
    case 'UPDATE_PLACEMENT':
      return {
        ...state,
        placements: state.placements.map((p) =>
          p.id === action.placementId ? { ...p, ...action.changes } : p,
        ),
      };
    case 'REMOVE_PLACEMENT':
      return {
        ...state,
        placements: state.placements.filter((p) => p.id !== action.placementId),
      };
    case 'ADD_PLACEMENT':
      return { ...state, placements: [...state.placements, action.placement] };
    case 'SET_VIEWPORT':
      return { ...state, viewport: { ...state.viewport, ...action.viewport } };
    case 'SELECT_ELEMENT':
      return { ...state, selectedElementId: action.elementId };
    case 'TOGGLE_LEFT_SIDEBAR':
      return { ...state, isLeftSidebarOpen: !state.isLeftSidebarOpen };
    case 'TOGGLE_RIGHT_SIDEBAR':
      return { ...state, isRightSidebarOpen: !state.isRightSidebarOpen };
    case 'REMOVE_ELEMENT': {
      const { [action.elementId]: _, ...rest } = state.elements;
      return {
        ...state,
        elements: rest,
        placements: state.placements.filter((p) => p.element_id !== action.elementId),
      };
    }
    case 'ADD_SURFACE':
      return { ...state, surfaces: [...state.surfaces, action.surface] };
    case 'UPDATE_SURFACE':
      return {
        ...state,
        surfaces: state.surfaces.map((s) =>
          s.id === action.surfaceId ? { ...s, ...action.changes } : s,
        ),
      };
    case 'REMOVE_SURFACE':
      return {
        ...state,
        surfaces: state.surfaces.filter((s) => s.id !== action.surfaceId),
      };
    default:
      return state;
  }
}

interface WorkspaceContextValue {
  state: WorkspaceState;
  dispatch: Dispatch<WorkspaceAction>;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(workspaceReducer, initialState);
  return (
    <WorkspaceContext.Provider value={{ state, dispatch }}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error('useWorkspace must be used within WorkspaceProvider');
  return ctx;
}
