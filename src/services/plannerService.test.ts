import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ArchiveLockedError, plannerService } from './plannerService';

const respond = (status: number, body: unknown) =>
  vi.fn().mockResolvedValue({ ok: status < 400, status, json: async () => body });

beforeEach(() => {
  vi.stubGlobal('localStorage', { getItem: () => 't1', setItem: () => {}, removeItem: () => {} });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('saveArchiveActivities', () => {
  it('tar med serverns förklaring när posten avvisas', async () => {
    vi.stubGlobal('fetch', respond(400, {
      success: false, data: null, error: 'Post 2 ("Svenska"): title har 151 tecken, högst 150 får plats',
    }));
    await expect(plannerService.saveArchiveActivities('v35', [], 3)).rejects.toThrow(
      'Kunde inte spara schemat. Post 2 ("Svenska"): title har 151 tecken, högst 150 får plats',
    );
  });

  it('visar inte serverns text för andra fel', async () => {
    vi.stubGlobal('fetch', respond(500, { success: false, data: null, error: 'Traceback …' }));
    await expect(plannerService.saveArchiveActivities('v35', [], 3)).rejects.toThrow(/^Kunde inte spara schemat\.$/);
  });
});

describe('mappar', () => {
  const lastBody = (fetchMock: ReturnType<typeof vi.fn>) => JSON.parse(fetchMock.mock.calls[0][1].body);

  it('skickar ingen mapp när ett schema skapas utan', async () => {
    const fetchMock = respond(201, { success: true, data: { id: 'a1' }, error: null });
    vi.stubGlobal('fetch', fetchMock);
    await plannerService.createArchive('v.44', 'week');
    expect(lastBody(fetchMock)).toEqual({ name: 'v.44', kind: 'week' });
  });

  it('skickar mappen när ett schema skapas i en', async () => {
    const fetchMock = respond(201, { success: true, data: { id: 'a1' }, error: null });
    vi.stubGlobal('fetch', fetchMock);
    await plannerService.createArchive('v.44', 'week', 'HT26');
    expect(lastBody(fetchMock)).toEqual({ name: 'v.44', kind: 'week', folder: 'HT26' });
  });

  it('flyttar och svarar med de ändrade schemana', async () => {
    const fetchMock = respond(200, { success: true, data: [{ id: 'a1', folder: 'HT26' }], error: null });
    vi.stubGlobal('fetch', fetchMock);
    await expect(plannerService.moveArchivesToFolder(['a1'], 'HT26')).resolves.toEqual([{ id: 'a1', folder: 'HT26' }]);
    expect(fetchMock.mock.calls[0][0]).toMatch(/\/planner\/folders\/placements$/);
    expect(fetchMock.mock.calls[0][1].method).toBe('PUT');
    expect(lastBody(fetchMock)).toEqual({ archiveIds: ['a1'], folder: 'HT26' });
  });

  it('visar serverns förklaring när flytten nekas', async () => {
    vi.stubGlobal('fetch', respond(403, {
      success: false, data: null, error: 'Bara den som äger schemat kan flytta det.',
    }));
    await expect(plannerService.moveArchivesToFolder(['a1'], 'HT26'))
      .rejects.toThrow('Bara den som äger schemat kan flytta det.');
  });

  it('byter namn på mappen', async () => {
    const fetchMock = respond(200, { success: true, data: [], error: null });
    vi.stubGlobal('fetch', fetchMock);
    await plannerService.renameFolder('HT26', 'Hösten');
    expect(fetchMock.mock.calls[0][0]).toMatch(/\/planner\/folders\/rename$/);
    expect(lastBody(fetchMock)).toEqual({ from: 'HT26', to: 'Hösten' });
  });

  it('har ett eget meddelande när namnbytet misslyckas utan förklaring', async () => {
    vi.stubGlobal('fetch', respond(500, null));
    await expect(plannerService.renameFolder('HT26', 'Hösten')).rejects.toThrow('Kunde inte byta namn på mappen.');
  });
});

describe('renameArchive', () => {
  const lastBody = (fetchMock: ReturnType<typeof vi.fn>) => JSON.parse(fetchMock.mock.calls[0][1].body);

  it('skickar bara namnet, med PATCH till schemat', async () => {
    const fetchMock = respond(200, { success: true, data: { id: 'a1', name: 'v.35 (justerad)' }, error: null });
    vi.stubGlobal('fetch', fetchMock);
    await expect(plannerService.renameArchive('a1', 'v.35 (justerad)'))
      .resolves.toEqual({ id: 'a1', name: 'v.35 (justerad)' });
    expect(fetchMock.mock.calls[0][0]).toMatch(/\/planner\/archives\/a1$/);
    expect(fetchMock.mock.calls[0][1].method).toBe('PATCH');
    expect(lastBody(fetchMock)).toEqual({ name: 'v.35 (justerad)' });
  });

  it('ett upptaget namn är ett vanligt fel, inte ett lås', async () => {
    vi.stubGlobal('fetch', respond(409, {
      success: false, data: null, error: 'Du har redan ett schema med det namnet',
    }));
    const error = await plannerService.renameArchive('a1', 'v.36').catch(e => e);
    expect(error).toBeInstanceOf(Error);
    expect(error).not.toBeInstanceOf(ArchiveLockedError);
    expect(error.message).toBe('Du har redan ett schema med det namnet');
  });

  it('har ett eget meddelande när namnbytet misslyckas utan förklaring', async () => {
    vi.stubGlobal('fetch', respond(500, null));
    await expect(plannerService.renameArchive('a1', 'v.36')).rejects.toThrow('Kunde inte byta namn på schemat.');
  });
});
