import { describe, expect, it } from 'vitest';
import type { MindmapNode } from '@/types/mindmap';
import {
  collectImages,
  imageLinkError,
  imageSourceKey,
  normalizeLink,
  parseImageSource,
  resolveNodeExtraKey,
} from './mindmapImage';

const key = (code: string, mods: Partial<{ altKey: boolean; shiftKey: boolean; ctrlKey: boolean; metaKey: boolean }> = {}) => ({
  code,
  altKey: false,
  shiftKey: false,
  ctrlKey: false,
  metaKey: false,
  ...mods,
});

describe('parseImageSource', () => {
  it('känner igen Google Drive-länkar i de tre formerna', () => {
    expect(parseImageSource('https://drive.google.com/file/d/abc123_-X/view?usp=sharing')).toEqual({ kind: 'gdrive', fileId: 'abc123_-X' });
    expect(parseImageSource('https://drive.google.com/open?id=abc123')).toEqual({ kind: 'gdrive', fileId: 'abc123' });
    expect(parseImageSource('https://drive.google.com/uc?export=view&id=abc123&x=1')).toEqual({ kind: 'gdrive', fileId: 'abc123' });
  });

  it('tar en vanlig http(s)-adress som den är, utan blanksteg runt', () => {
    expect(parseImageSource('  https://example.org/bild.png  ')).toEqual({ kind: 'url', url: 'https://example.org/bild.png' });
    expect(parseImageSource('http://example.org/a.jpg')).toEqual({ kind: 'url', url: 'http://example.org/a.jpg' });
  });

  it('avvisar tomt, annat än webbadresser och OneDrive', () => {
    expect(parseImageSource('')).toBeNull();
    expect(parseImageSource('   ')).toBeNull();
    expect(parseImageSource('bild.png')).toBeNull();
    expect(parseImageSource('javascript:alert(1)')).toBeNull();
    expect(parseImageSource('data:image/png;base64,AAAA')).toBeNull();
    expect(parseImageSource('https://1drv.ms/i/s!abc')).toBeNull();
    expect(parseImageSource('https://skolan.sharepoint.com/sites/x/bild.png')).toBeNull();
  });

  it('förklarar varför länken inte duger', () => {
    expect(imageLinkError('https://1drv.ms/i/s!abc')).toContain('OneDrive');
    expect(imageLinkError('bild.png')).toContain('Okänt länkformat');
  });
});

describe('imageSourceKey och collectImages', () => {
  const url = { kind: 'url' as const, url: 'https://example.org/a.png' };
  const drive = { kind: 'gdrive' as const, fileId: 'f1' };

  it('ger samma nyckel för samma källa och olika för olika', () => {
    expect(imageSourceKey(url)).toBe(imageSourceKey({ ...url }));
    expect(imageSourceKey(url)).not.toBe(imageSourceKey(drive));
    expect(imageSourceKey(drive)).toBe('gdrive:f1');
  });

  it('hittar alla bilder, också i hopfällda grenar', () => {
    const root: MindmapNode = {
      id: 'r', label: 'Rot', image: { source: url },
      children: [
        { id: 'a', label: 'A', children: [] },
        { id: 'b', label: 'B', collapsed: true, children: [{ id: 'c', label: 'C', children: [], image: { source: drive, width: 96 } }] },
        { id: 'd', label: 'D', children: [], image: { source: url } },
      ],
    };
    expect(collectImages(root)).toEqual([
      { nodeId: 'r', key: 'url:https://example.org/a.png', source: url },
      { nodeId: 'c', key: 'gdrive:f1', source: drive },
      { nodeId: 'd', key: 'url:https://example.org/a.png', source: url },
    ]);
    expect(collectImages({ id: 'r', label: '', children: [] })).toEqual([]);
  });
});

describe('normalizeLink', () => {
  it('behåller en http(s)-adress', () => {
    expect(normalizeLink(' https://example.org/sida?a=1#b ')).toBe('https://example.org/sida?a=1#b');
    expect(normalizeLink('http://example.org')).toBe('http://example.org');
  });

  it('lägger https:// framför en adress utan schema', () => {
    expect(normalizeLink('www.skolverket.se')).toBe('https://www.skolverket.se');
    expect(normalizeLink('example.org/sida')).toBe('https://example.org/sida');
  });

  it('en tom text tar bort länken', () => {
    expect(normalizeLink('')).toBe('');
    expect(normalizeLink('   ')).toBe('');
  });

  it('avvisar det som inte är en webbadress', () => {
    expect(normalizeLink('javascript:alert(1)')).toBeNull();
    expect(normalizeLink('mailto:a@b.se')).toBeNull();
    expect(normalizeLink('file:///etc/passwd')).toBeNull();
    expect(normalizeLink('se sidan 12')).toBeNull();
    expect(normalizeLink('sidan12')).toBeNull();
    expect(normalizeLink('https://')).toBeNull();
  });
});

describe('resolveNodeExtraKey', () => {
  it('Alt+N, Alt+L och Alt+I öppnar panelen på rätt fält', () => {
    expect(resolveNodeExtraKey(key('KeyN', { altKey: true }))).toEqual({ type: 'panel', field: 'note' });
    expect(resolveNodeExtraKey(key('KeyL', { altKey: true }))).toEqual({ type: 'panel', field: 'link' });
    expect(resolveNodeExtraKey(key('KeyI', { altKey: true }))).toEqual({ type: 'panel', field: 'image' });
  });

  it('Alt+Shift+1–8 sätter ikon och Alt+Shift+9 tar bort den', () => {
    expect(resolveNodeExtraKey(key('Digit1', { altKey: true, shiftKey: true }))).toEqual({ type: 'icon', icon: 'star' });
    expect(resolveNodeExtraKey(key('Digit8', { altKey: true, shiftKey: true }))).toEqual({ type: 'icon', icon: 'pin' });
    expect(resolveNodeExtraKey(key('Digit9', { altKey: true, shiftKey: true }))).toEqual({ type: 'icon', icon: null });
  });

  it('Alt+Shift+0 nollställer nodens placering, Alt+0 är fortfarande färg', () => {
    expect(resolveNodeExtraKey(key('Digit0', { altKey: true, shiftKey: true }))).toEqual({ type: 'resetOffset' });
    expect(resolveNodeExtraKey(key('Digit0', { altKey: true }))).toBeNull();
  });

  it('släpper tangenter utan Alt, så att n, l och i skriver i noden', () => {
    ['KeyN', 'KeyL', 'KeyI', 'Digit1'].forEach((code) => {
      expect(resolveNodeExtraKey(key(code))).toBeNull();
      expect(resolveNodeExtraKey(key(code, { shiftKey: true }))).toBeNull();
    });
  });

  it('släpper Alt+siffra (färg), AltGr (Ctrl+Alt) och Alt+Shift+bokstav', () => {
    expect(resolveNodeExtraKey(key('Digit1', { altKey: true }))).toBeNull();
    expect(resolveNodeExtraKey(key('KeyN', { altKey: true, ctrlKey: true }))).toBeNull();
    expect(resolveNodeExtraKey(key('KeyN', { altKey: true, metaKey: true }))).toBeNull();
    expect(resolveNodeExtraKey(key('KeyN', { altKey: true, shiftKey: true }))).toBeNull();
    expect(resolveNodeExtraKey(key('KeyC', { altKey: true, shiftKey: true }))).toBeNull();
  });
});
