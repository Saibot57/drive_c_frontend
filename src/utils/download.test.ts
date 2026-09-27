import { describe, expect, it, vi } from 'vitest';
import type { jsPDF } from 'jspdf';
import { addCanvasCentered, toFileSlug } from './download';

describe('toFileSlug', () => {
  it('behåller svenska tecken och använder reservnamnet för tomma titlar', () => {
    expect(toFileSlug('Svenska 1 – Höst', 'temakalender')).toBe('Svenska-1-Höst');
    expect(toFileSlug('', 'workspace')).toBe('workspace');
    expect(toFileSlug(null)).toBe('schema');
  });
});

describe('addCanvasCentered', () => {
  const page = (width: number, height: number) => {
    const addImage = vi.fn();
    const pdf = {
      internal: { pageSize: { getWidth: () => width, getHeight: () => height } },
      addImage,
    } as unknown as jsPDF;
    return { pdf, addImage };
  };
  const canvas = (width: number, height: number) =>
    ({ width, height, toDataURL: () => 'data:image/png;base64,' }) as unknown as HTMLCanvasElement;

  it('fyller sidans bredd för en bred bild och centrerar den på höjden', () => {
    const { pdf, addImage } = page(300, 200);
    addCanvasCentered(pdf, canvas(1000, 500), 10);
    const [, , x, y, w, h] = addImage.mock.calls[0];
    expect([x, y, w, h]).toEqual([10, 30, 280, 140]);
  });

  it('ger en kvadrat som ryms på den kortaste sidan', () => {
    const { pdf, addImage } = page(200, 300);
    addCanvasCentered(pdf, canvas(800, 800), 20);
    const [, , x, y, w, h] = addImage.mock.calls[0];
    expect([x, y, w, h]).toEqual([20, 70, 160, 160]);
  });
});
