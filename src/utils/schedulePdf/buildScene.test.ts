import { describe, expect, it } from 'vitest';
import { PLANNER_DAYS } from '@/components/schedule/constants';
import { ScheduleExportInput } from '@/types/scheduleExport';
import { buildScene } from './buildScene';
import { entry, fakeMeasurer, input, normalWeek, overlapDay } from './__fixtures__/scenes';
import { HEADER_H_PX, TIME_AXIS_W_PX, TITLE_H_PX, TOP_OFFSET_PX } from './theme';
import { SceneNode } from './scene';

const build = (overrides: Partial<ScheduleExportInput> = {}) =>
  buildScene(input(overrides), fakeMeasurer);
const textsOf = (nodes: SceneNode[]) =>
  nodes.flatMap(n => (n.kind === 'text' ? [n.text] : []));

describe('buildScene — rutnätet', () => {
  it('ritar fem dagrubriker', () => {
    const texts = textsOf(build().nodes);
    for (const day of PLANNER_DAYS) expect(texts).toContain(day);
  });

  it('ritar en etikett fler än det finns timlinjer', () => {
    // Skärmens asymmetri: 10 etiketter (8..17) men 9 linjer (8..16).
    const scene = build({ schedule: [entry({ endTime: '17:00', duration: 540 })] });
    const labels = textsOf(scene.nodes).filter(t => /^\d+:00$/.test(t));
    const horizontal = scene.nodes.filter(
      n => n.kind === 'line' && n.y1 === n.y2 && n.x1 === TIME_AXIS_W_PX
    );
    expect(labels).toEqual(['8:00', '9:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00']);
    expect(horizontal).toHaveLength(9);
  });

  it('klipper rutnätet efter sista posten', () => {
    const scene = build({ schedule: [entry({ endTime: '10:00', duration: 120 })] });
    expect(textsOf(scene.nodes).filter(t => /^\d+:00$/.test(t))).toEqual(['8:00', '9:00', '10:00']);
    expect(scene.heightPx).toBe(TITLE_H_PX + HEADER_H_PX + TOP_OFFSET_PX + 240);
  });

  it('sätter rubrikraden till arkivnamn och datum', () => {
    const texts = textsOf(build().nodes);
    expect(texts).toContain('v.35');
    expect(texts).toContain('2026-08-29');
  });
});

describe('buildScene — korten', () => {
  const cardRects = (nodes: SceneNode[]) =>
    nodes.filter(n => n.kind === 'rect' && n.radius !== undefined);

  it('placerar kortet enligt getPositionStyles minus mellanrummet', () => {
    const scene = build({ schedule: [entry({ startTime: '09:00', endTime: '10:00', duration: 60 })] });
    const card = cardRects(scene.nodes)[0];
    expect(card).toMatchObject({
      // 8→9 är 60 min à 2 px, plus EVENT_GAP_PX / 2.
      y: TITLE_H_PX + HEADER_H_PX + TOP_OFFSET_PX + 120 + 2,
      h: 60 * 2 - 4,
    });
  });

  it('delar bredden mellan poster som krockar', () => {
    const scene = build({ schedule: overlapDay() });
    const cards = cardRects(scene.nodes);
    expect(cards).toHaveLength(3);
    const widths = new Set(cards.map(c => (c.kind === 'rect' ? c.w : 0)));
    expect(widths.size).toBe(1);
    const lefts = cards.map(c => (c.kind === 'rect' ? c.x : 0)).sort((a, b) => a - b);
    expect(lefts[1] - lefts[0]).toBeCloseTo(lefts[2] - lefts[1]);
  });

  it('utelämnar poster som inte är synliga', () => {
    const schedule = normalWeek();
    const scene = build({ schedule, isVisible: e => e.day === 'Måndag' });
    expect(cardRects(scene.nodes)).toHaveLength(2);
  });

  it('räknar kolumnlayouten på alla dagens poster, inte bara de synliga', () => {
    // Paritetsfällan: skärmen bygger `layoutByDay` ur hela schemat, så ett
    // dolt kort håller kvar sin kolumn och de synliga blir inte bredare.
    const schedule = overlapDay();
    const visible = buildScene(
      input({ schedule, isVisible: e => e.title === 'Ett' }),
      fakeMeasurer
    );
    const all = build({ schedule });
    const narrow = cardRects(visible.nodes)[0];
    const reference = cardRects(all.nodes)[0];
    expect(narrow).toMatchObject({ w: reference.kind === 'rect' ? reference.w : 0 });
  });

  it('räknar isLastOfDay på alla dagens poster', () => {
    // Sista passet är dolt, så det synliga kortet är *inte* dagens sista och
    // ska visa bara starttiden.
    const early = entry({ day: 'Måndag', startTime: '08:00', endTime: '09:00', duration: 60, title: 'Synlig' });
    const late = entry({ day: 'Måndag', startTime: '10:00', endTime: '11:00', duration: 60, title: 'Dold' });
    const scene = buildScene(
      input({ schedule: [early, late], isVisible: e => e.title === 'Synlig' }),
      fakeMeasurer
    );
    expect(textsOf(scene.nodes)).toContain('08:00');
    expect(textsOf(scene.nodes)).not.toContain('08:00–09:00');
  });

  it('rapporterar poster där texten inte rymdes', () => {
    const scene = build({
      schedule: [entry({ duration: 60, endTime: '09:00', notes: 'rad\n'.repeat(40) })],
    });
    expect(scene.truncatedInstanceIds).toHaveLength(1);
  });

  it('lägger en länkannotation när posten bär en URL', () => {
    const scene = build({
      schedule: [entry({ category: 'Uppgift https://classroom.google.com/x' })],
    });
    const links = scene.nodes.filter(n => n.kind === 'link');
    expect(links).toHaveLength(1);
    expect(links[0]).toMatchObject({ url: 'https://classroom.google.com/x' });
  });

  it('låter färgreglerna slå igenom', () => {
    const scene = build({
      schedule: [entry({ title: 'Matematik', color: '#ffffff' })],
      resolveColor: (title, fallback) =>
        title.includes('Matematik') ? '#bae6fd' : fallback,
    });
    const card = cardRects(scene.nodes)[0];
    expect(card).toMatchObject({ fill: { r: 0xba, g: 0xe6, b: 0xfd } });
  });

  it('låter salsreglerna fylla ett tomt salfält', () => {
    const scene = build({
      schedule: [entry({ room: '', duration: 90, endTime: '09:30' })],
      resolveRoom: (_title, current) => current || 'Salen',
    });
    expect(textsOf(scene.nodes)).toContain('Salen');
  });
});

describe('buildScene — planeringsläge', () => {
  const planning = {
    Måndag: { blocks: [{ start: 9 * 60, end: 10 * 60 }], isDayOff: false, totalMinutes: 60 },
    Tisdag: { blocks: [], isDayOff: true, totalMinutes: 0 },
    Onsdag: { blocks: [], isDayOff: false, totalMinutes: 0 },
    Torsdag: { blocks: [], isDayOff: false, totalMinutes: 0 },
    Fredag: { blocks: [], isDayOff: false, totalMinutes: 0 },
  };

  it('ritar luckor i stället för lektioner', () => {
    const scene = build({ schedule: normalWeek(), planningByDay: planning });
    const texts = textsOf(scene.nodes);
    expect(texts).toContain('Planering');
    expect(texts).toContain('09:00–10:00');
    expect(texts).not.toContain('Matematik 1');
  });

  it('märker en spärrad dag som ledig', () => {
    const scene = build({ schedule: [], planningByDay: planning });
    expect(textsOf(scene.nodes)).toContain('LEDIG');
  });

  it('streckar planeringsblockets ram', () => {
    const scene = build({ schedule: [], planningByDay: planning });
    const dashed = scene.nodes.filter(n => n.kind === 'rect' && n.dash);
    expect(dashed).toHaveLength(1);
  });
});
