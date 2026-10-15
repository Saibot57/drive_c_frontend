import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { workspaceService } from './workspaceService';

const respond = (status: number, body: unknown) =>
  vi.fn().mockResolvedValue({ ok: status < 400, status, json: async () => body });

beforeEach(() => {
  vi.stubGlobal('localStorage', { getItem: () => 't1', setItem: () => {}, removeItem: () => {} });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// track() i useWorkspaceSync ger null vid fel. Svarade raderingarna med
// undefined såg en lyckad radering ut som ett fel: kortet lades tillbaka och
// gick inte att ångra.
describe('raderingarna', () => {
  const deletions = [
    ['deleteSurface', () => workspaceService.deleteSurface('s1'), '/workspace/surfaces/s1'],
    ['deleteElement', () => workspaceService.deleteElement('e1'), '/workspace/elements/e1'],
    ['deletePlacement', () => workspaceService.deletePlacement('p1'), '/workspace/placements/p1'],
  ] as const;

  it.each(deletions)('%s svarar true när servern lyckas', async (_name, call, path) => {
    const fetch = respond(200, { success: true, data: null, error: null });
    vi.stubGlobal('fetch', fetch);

    await expect(call()).resolves.toBe(true);
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining(path), expect.objectContaining({ method: 'DELETE' }));
  });

  it.each(deletions)('%s kastar med serverns fel', async (_name, call) => {
    vi.stubGlobal('fetch', respond(404, { success: false, data: null, error: 'Finns inte' }));
    await expect(call()).rejects.toThrow('Finns inte');
  });
});
