import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MindmapConflictError, mindmapService } from './mindmapService';

const respond = (status: number, body: unknown) =>
  vi.fn().mockResolvedValue({ ok: status < 400, status, json: async () => body });

const DOC = { root: { id: 'r', label: 'Rot', children: [] }, layout: 'right' as const };
const raw = (doc: unknown) => ({ id: 'm1', name: 'Karta', version: 3, createdAt: null, updatedAt: null, doc });

beforeEach(() => {
  vi.stubGlobal('localStorage', { getItem: () => 'token', setItem: () => {}, removeItem: () => {} });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('mindmapService', () => {
  it('känner igen en konflikt och läser serverns version', async () => {
    vi.stubGlobal('fetch', respond(409, { success: false, error: 'Kartan har ändrats någon annanstans', data: { version: 5, updatedAt: '2026-11-10T10:00:00' } }));
    const error = await mindmapService.update('m1', { version: 3, name: 'x' }).catch(e => e);
    expect(error).toBeInstanceOf(MindmapConflictError);
    expect(error.currentVersion).toBe(5);
    expect(error.updatedAt).toBe('2026-11-10T10:00:00');
  });

  it('kastar serverns felmeddelande för andra fel', async () => {
    vi.stubGlobal('fetch', respond(400, { success: false, error: 'Kartan är för stor (högst 1024 kB)' }));
    await expect(mindmapService.update('m1', { version: 3, doc: DOC })).rejects.toThrow('för stor');
  });

  it('tvättar dokumentet när det inte går att läsa', async () => {
    vi.stubGlobal('fetch', respond(200, { success: true, data: raw('skräp') }));
    const map = await mindmapService.get('m1');
    expect(map.doc.root.label).toBe('Central nod');
    expect(map.version).toBe(3);
  });

  it('skickar klientens id när en karta skapas och keepalive när det önskas', async () => {
    const fetch = respond(201, { success: true, data: raw(DOC) });
    vi.stubGlobal('fetch', fetch);
    await mindmapService.create({ id: 'm1', name: 'Karta', doc: DOC });
    const [url, init] = fetch.mock.calls[0];
    expect(url).toMatch(/\/mindmap$/);
    expect(JSON.parse(init.body)).toMatchObject({ id: 'm1', name: 'Karta', doc: DOC });

    await mindmapService.update('m1', { version: 1, doc: DOC }, { keepalive: true });
    expect(fetch.mock.calls[1][1].keepalive).toBe(true);
    expect(fetch.mock.calls[1][0]).toMatch(/\/mindmap\/m1$/);
  });

  it('hoppar över rader i listan som inte går att läsa', async () => {
    vi.stubGlobal('fetch', respond(200, { success: true, data: [raw(DOC), { id: 'x' }, 'nej'] }));
    const list = await mindmapService.list();
    expect(list.map(x => x.id)).toEqual(['m1']);
    expect('doc' in list[0]).toBe(false);
  });

  it('tar bort med kodat id', async () => {
    const fetch = respond(200, { success: true, data: { id: 'a b' } });
    vi.stubGlobal('fetch', fetch);
    await mindmapService.remove('a b');
    expect(fetch.mock.calls[0][0]).toMatch(/\/mindmap\/a%20b$/);
    expect(fetch.mock.calls[0][1].method).toBe('DELETE');
  });

  it('hämtar en bild genom bildproxyn och ger serverns fel när det inte går', async () => {
    const blob = new Blob(['x'], { type: 'image/png' });
    const ok = vi.fn().mockResolvedValue({ ok: true, status: 200, blob: async () => blob });
    vi.stubGlobal('fetch', ok);
    await expect(mindmapService.fetchImage({ kind: 'gdrive', fileId: 'f1' })).resolves.toBe(blob);
    const [url, init] = ok.mock.calls[0];
    expect(String(url)).toMatch(/\/workspace\/image-proxy$/);
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({ source: { kind: 'gdrive', fileId: 'f1' }, resolution: 'preview' });

    vi.stubGlobal('fetch', respond(404, { success: false, error: 'Bilden finns inte.' }));
    await expect(mindmapService.fetchImage({ kind: 'url', url: 'https://example.org/a.png' })).rejects.toThrow('Bilden finns inte.');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 502, json: async () => { throw new Error('html'); } }));
    await expect(mindmapService.fetchImage({ kind: 'url', url: 'https://example.org/a.png' })).rejects.toThrow('Kunde inte hämta bild.');
  });
});
