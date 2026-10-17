import { describe, expect, it } from 'vitest';
import type { SurfaceElement, WorkspaceState } from '../types/workspace.types';
import { workspaceReducer } from './WorkspaceContext';

function placement(id: string, surface_id: string): SurfaceElement {
  return {
    id,
    surface_id,
    element_id: `el-${id}`,
    position_x: 0,
    position_y: 0,
    width: 100,
    height: 100,
    is_locked: false,
    is_on_canvas: true,
    z_index: 0,
  };
}

function state(activeSurfaceId: string, placements: SurfaceElement[] = []): WorkspaceState {
  return {
    surfaces: [],
    activeSurfaceId,
    placements,
    elements: {},
    library: [],
    viewport: { panX: 0, panY: 0, zoom: 1 },
    selectedElementId: null,
    isLeftSidebarOpen: true,
    isRightSidebarOpen: true,
  };
}

const ids = (s: WorkspaceState) => s.placements.map((p) => p.id);

// Användaren klickar på yta B och direkt på C. Svaren kommer i omvänd
// ordning (F6 i granskningen av dataintegritet 2026-10-15).
describe('workspaceReducer vid ytbyte', () => {
  it('ett sent svar för en yta man lämnat ersätter inte den aktiva ytans placeringar', () => {
    let s = state('C');
    s = workspaceReducer(s, { type: 'SET_PLACEMENTS', surfaceId: 'C', placements: [placement('c1', 'C')] });
    s = workspaceReducer(s, { type: 'SET_PLACEMENTS', surfaceId: 'B', placements: [placement('b1', 'B')] });
    expect(ids(s)).toEqual(['c1']);
  });

  it('ett sent tomt svar tömmer inte heller den aktiva ytan', () => {
    let s = state('C', [placement('c1', 'C')]);
    s = workspaceReducer(s, { type: 'SET_PLACEMENTS', surfaceId: 'B', placements: [] });
    expect(ids(s)).toEqual(['c1']);
  });

  it('svaret för den aktiva ytan läggs in', () => {
    const s = workspaceReducer(state('C'), {
      type: 'SET_PLACEMENTS',
      surfaceId: 'C',
      placements: [placement('c1', 'C')],
    });
    expect(ids(s)).toEqual(['c1']);
  });

  it('en tömning utan yta gäller alltid', () => {
    const s = workspaceReducer(state('', [placement('c1', 'C')]), { type: 'SET_PLACEMENTS', placements: [] });
    expect(ids(s)).toEqual([]);
  });

  it('en placering som skapats på en yta man lämnat läggs inte in i vyn', () => {
    let s = state('C', [placement('c1', 'C')]);
    s = workspaceReducer(s, { type: 'ADD_PLACEMENT', placement: placement('b2', 'B') });
    expect(ids(s)).toEqual(['c1']);
    s = workspaceReducer(s, { type: 'ADD_PLACEMENT', placement: placement('c2', 'C') });
    expect(ids(s)).toEqual(['c1', 'c2']);
  });

  it('en massplacering läggs bara in för den aktiva ytan', () => {
    const s = workspaceReducer(state('C'), {
      type: 'ADD_PLACEMENTS',
      placements: [placement('b3', 'B'), placement('c3', 'C')],
    });
    expect(ids(s)).toEqual(['c3']);
  });
});
