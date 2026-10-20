// @vitest-environment jsdom
/**
 * Workspace när inloggningen gått ut mitt i en sparning (dataintegritet F14).
 * Här går anropen genom den riktiga workspaceService och fetchWithAuth, med
 * fetch utbytt, så att hela vägen från kortet till servern prövas.
 */
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { isSessionExpired, reauthenticate, storeAuth } from '@/services/authService';
import { WorkspaceProvider } from './WorkspaceContext';
import { useWorkspaceData } from './useWorkspaceData';
import { DEBOUNCE_CONTENT_MS } from '../types/constants';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const element = {
  id: 'e1',
  user_id: 'u1',
  type: 'text',
  title: 'Anteckning',
  content: { text: 'Från början' },
  created_at: '2026-10-01T08:00:00Z',
  updated_at: '2026-10-01T08:00:00Z',
};

const placement = {
  id: 'p1',
  surface_id: 's1',
  element_id: 'e1',
  position_x: 0,
  position_y: 0,
  width: 320,
  height: 200,
  is_locked: false,
  is_on_canvas: true,
  z_index: 1,
  element,
};

const NEW_TOKEN = 'ny';

const reply = (status: number, body: object) => ({ ok: status < 400, status, json: async () => body });

/** Servern godtar bara den nya token för skrivningar; läsningar går alltid. */
const server = vi.fn(async (url: string, init: RequestInit = {}) => {
  if (url.endsWith('/auth/login')) {
    return reply(200, { success: true, data: { token: NEW_TOKEN, user: { id: 'u1', username: 'alice' } } });
  }
  if (url.endsWith('/workspace/surfaces')) {
    return reply(200, { success: true, data: [{ id: 's1', name: 'Yta 1', sort_order: 0, is_archived: false }] });
  }
  if (url.endsWith('/workspace/surfaces/s1/elements')) {
    return reply(200, { success: true, data: [placement] });
  }
  const auth = (init.headers as Record<string, string>).Authorization;
  if (auth !== `Bearer ${NEW_TOKEN}`) {
    return reply(401, { success: false, error: 'Invalid authentication token' });
  }
  return reply(200, { success: true, data: { ...element, ...JSON.parse(String(init.body)) } });
});

const sentTexts = () => server.mock.calls
  .filter(([url, init]) => String(url).endsWith('/elements/e1') && init?.method === 'PUT')
  .map(([, init]) => JSON.parse(String(init?.body)).content.text);

const renderHook = () => {
  const result: { current: ReturnType<typeof useWorkspaceData> } = { current: undefined as never };
  const Probe = () => {
    result.current = useWorkspaceData();
    return null;
  };
  const root = createRoot(document.createElement('div'));
  act(() => {
    root.render(React.createElement(WorkspaceProvider, null, React.createElement(Probe)));
  });
  return { result, unmount() { act(() => root.unmount()); } };
};

const settle = async () => {
  await act(async () => {
    for (let i = 0; i < 20; i += 1) await Promise.resolve();
  });
};

describe('useWorkspaceData när inloggningen gått ut (F14)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    server.mockClear();
    vi.stubGlobal('fetch', server);
    window.localStorage.clear();
    storeAuth({ token: 'gammal', user: { id: 'u1', username: 'alice' } });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('en ändring som får 401 sparas efter inloggningen', async () => {
    const h = renderHook();
    await act(async () => { await h.result.current.loadSurfaces(); });
    await settle();

    act(() => h.result.current.updateElementContent('e1', { text: 'Skrivet före utgången' }));
    await act(async () => { vi.advanceTimersByTime(DEBOUNCE_CONTENT_MS); });
    await settle();

    // Sidan ligger kvar och ändringen väntar på inloggningen.
    expect(window.location.pathname).not.toBe('/login');
    expect(isSessionExpired()).toBe(true);
    expect(h.result.current.state.elements.e1.content).toEqual({ text: 'Skrivet före utgången' });

    await act(async () => { await reauthenticate('alice', 'lösen', 'u1'); });
    await settle();

    expect(sentTexts()).toEqual(['Skrivet före utgången', 'Skrivet före utgången']);
    expect(h.result.current.saveStatus).toBe('saved');
    h.unmount();
  });
});
