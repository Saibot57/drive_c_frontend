import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { plannerService } from './plannerService';

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
