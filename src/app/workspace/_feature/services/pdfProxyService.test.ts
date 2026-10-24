import { afterEach, describe, expect, it, vi } from 'vitest';
import { isOneDriveLink, parseSource, unknownLinkMessage } from './pdfProxyService';
import { fetchImageBytes } from './imageProxyService';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('parseSource', () => {
  it('känner igen Google Drive-länkar', () => {
    expect(parseSource('https://drive.google.com/file/d/abc123/view?usp=sharing'))
      .toEqual({ kind: 'gdrive', fileId: 'abc123' });
    expect(parseSource('https://drive.google.com/open?id=abc123'))
      .toEqual({ kind: 'gdrive', fileId: 'abc123' });
  });

  it('tar en annan länk som direktlänk', () => {
    expect(parseSource('  https://example.com/bild.png '))
      .toEqual({ kind: 'url', url: 'https://example.com/bild.png' });
  });

  // OneDrive togs bort 2026-10-24. Som direktlänk hade länken gett en
  // HTML-sida i stället för filen.
  it.each([
    'https://1drv.ms/b/c/abc/def',
    'https://onedrive.live.com/?id=abc',
    'https://skolan-my.sharepoint.com/:b:/g/personal/fil',
  ])('känner inte igen OneDrive: %s', link => {
    expect(isOneDriveLink(link)).toBe(true);
    expect(parseSource(link)).toBeNull();
  });

  it('ger null för text som inte är en länk', () => {
    expect(parseSource('')).toBeNull();
    expect(parseSource('bild.png')).toBeNull();
  });
});

describe('unknownLinkMessage', () => {
  it('säger att OneDrive inte stöds', () => {
    expect(unknownLinkMessage('https://1drv.ms/b/abc', 'bildlänk')).toMatch(/OneDrive stöds inte/);
  });

  it('nämner inte OneDrive för en annan okänd länk', () => {
    const message = unknownLinkMessage('bild.png', 'PDF-länk');
    expect(message).toBe('Okänt länkformat. Klistra in en Google Drive-länk eller en direkt PDF-länk.');
  });
});

describe('fetchImageBytes', () => {
  it('skickar valet av storlek till backend', async () => {
    vi.stubGlobal('localStorage', { getItem: () => 't1', setItem: () => {}, removeItem: () => {} });
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, blob: async () => 'blob' });
    vi.stubGlobal('fetch', fetchMock);

    await fetchImageBytes({ kind: 'gdrive', fileId: 'abc' }, 'preview');

    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      source: { kind: 'gdrive', fileId: 'abc' },
      resolution: 'preview',
    });
  });
});
