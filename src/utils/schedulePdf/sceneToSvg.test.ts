import { describe, expect, it } from 'vitest';
import { ScheduleExportInput } from '@/types/scheduleExport';
import { buildScene } from './buildScene';
import { sceneToSvg } from './sceneToSvg';
import { entry, fakeMeasurer, input, normalWeek, overlapDay } from './__fixtures__/scenes';

const svgFor = (overrides: Partial<ScheduleExportInput> = {}) =>
  sceneToSvg(buildScene(input(overrides), fakeMeasurer));

describe('sceneToSvg', () => {
  it('ger ett välformat dokument med scenens mått', () => {
    const svg = svgFor({ schedule: normalWeek() });
    expect(svg.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(svg).toMatch(/<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" width="1400" height="\d+"/);
    expect(svg.trimEnd().endsWith('</svg>')).toBe(true);
  });

  it('escapar tecken som annars bryter dokumentet', () => {
    const svg = svgFor({ schedule: [entry({ title: 'Fysik & "kemi" <hos> Ann' })] });
    expect(svg).toContain('Fysik &amp; &quot;kemi&quot; &lt;hos&gt; Ann');
  });

  it('ritar ingenting för länkannotationer', () => {
    const svg = svgFor({ schedule: [entry({ category: 'https://exempel.se/x' })] });
    expect(svg).not.toContain('exempel.se');
  });

  it('matchar snapshot — normal vecka, digitalt', async () => {
    await expect(svgFor({ schedule: normalWeek() }))
      .toMatchFileSnapshot('./__snapshots__/normal-vecka-digital.svg');
  });

  it('matchar snapshot — normal vecka, A3', async () => {
    await expect(svgFor({ schedule: normalWeek(), pageMode: 'a3' }))
      .toMatchFileSnapshot('./__snapshots__/normal-vecka-a3.svg');
  });

  it('matchar snapshot — överlappsdag', async () => {
    await expect(svgFor({ schedule: overlapDay() }))
      .toMatchFileSnapshot('./__snapshots__/overlapp-digital.svg');
  });

  it('matchar snapshot — planeringsläge', async () => {
    const planningByDay = {
      Måndag: { blocks: [{ start: 9 * 60, end: 10 * 60 }, { start: 13 * 60, end: 14 * 60 + 30 }], isDayOff: false, totalMinutes: 150 },
      Tisdag: { blocks: [], isDayOff: true, totalMinutes: 0 },
      Onsdag: { blocks: [{ start: 8 * 60, end: 8 * 60 + 30 }], isDayOff: false, totalMinutes: 30 },
      Torsdag: { blocks: [], isDayOff: false, totalMinutes: 0 },
      Fredag: { blocks: [{ start: 11 * 60, end: 13 * 60 }], isDayOff: false, totalMinutes: 120 },
    };
    await expect(svgFor({ schedule: normalWeek(), planningByDay }))
      .toMatchFileSnapshot('./__snapshots__/planering-digital.svg');
  });
});
