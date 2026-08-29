import { describe, expect, it } from 'vitest';
import { ScheduledEntry } from '@/types/schedule';
import { CardTextLayout, layoutCardText } from './cardLayout';
import { TextMeasurer } from './measure';

const measure: TextMeasurer = {
  width: (text, _font, sizePx) => text.length * sizePx * 0.5,
  ascentRatio: () => 0.8,
};

const entry = (overrides: Partial<ScheduledEntry> = {}): ScheduledEntry => ({
  id: 'c1',
  instanceId: 'i1',
  title: 'Matematik',
  teacher: 'TL',
  room: 'A12',
  color: '#fde68a',
  duration: 60,
  day: 'Måndag',
  startTime: '08:00',
  endTime: '09:00',
  ...overrides,
});

const layout = (overrides: Partial<ScheduledEntry> = {}, extra: Partial<{
  adjustedHeightPx: number;
  innerWidthPx: number;
  isLastOfDay: boolean;
  shownRoom: string;
}> = {}): CardTextLayout =>
  layoutCardText({
    entry: entry(overrides),
    shownRoom: extra.shownRoom ?? entry(overrides).room,
    adjustedHeightPx: extra.adjustedHeightPx ?? 116,
    innerWidthPx: extra.innerWidthPx ?? 200,
    isLastOfDay: extra.isLastOfDay ?? false,
    measure,
  });

const texts = (result: CardTextLayout) =>
  result.lines.map(line => line.runs.map(r => r.text).join('|'));

describe('layoutCardText — blockordning', () => {
  it('följer JSX-ordningen tid, titel, lärare, sal, anteckningar', () => {
    const result = layout({ teacher: 'TL', room: 'A12', notes: 'Prov' });
    expect(texts(result)).toEqual(['08:00', 'Matematik', 'TL', 'A12', 'Prov']);
    expect(result.truncated).toBe(false);
  });

  it('ger varje lärare en egen rad', () => {
    const result = layout({ teacher: 'TL, HL, AB' });
    expect(texts(result).slice(2, 5)).toEqual(['TL', 'HL', 'AB']);
  });

  it('visar hela intervallet på dagens sista post', () => {
    expect(texts(layout({}, { isLastOfDay: true }))[0]).toBe('08:00–09:00');
  });

  it('staplar raderna utan luft mellan', () => {
    const result = layout({ notes: undefined });
    expect(result.lines[0].topPx).toBe(0);
    expect(result.lines[1].topPx).toBe(result.lines[0].lineHeightPx);
  });
});

describe('layoutCardText — trösklar', () => {
  it('sätter titeln inline på rubrikraden under 45 minuter', () => {
    const result = layout({ duration: 30 }, { adjustedHeightPx: 56 });
    expect(texts(result)[0]).toBe('08:00|Matematik');
    expect(texts(result)).not.toContain('Matematik');
  });

  it('ger titeln en egen rad från 45 minuter', () => {
    const result = layout({ duration: 45 }, { adjustedHeightPx: 86 });
    expect(texts(result)[0]).toBe('08:00');
    expect(texts(result)[1]).toBe('Matematik');
  });

  it('krymper sekundärtexten under 38 px höjd', () => {
    // Titelns egen rad kräver >= 45 min, alltså minst 86 px — den kan aldrig
    // vara kompakt. Det är lärare och sal som faktiskt byter storlek.
    const compact = layout({ duration: 20, title: '' }, { adjustedHeightPx: 36 });
    const roomy = layout({ duration: 60 }, { adjustedHeightPx: 116 });
    expect(compact.lines[1].runs[0].sizePx).toBe(10);
    expect(roomy.lines[2].runs[0].sizePx).toBe(12);
  });

  it('döljer lärare och sal vid exakt 30 px', () => {
    // Vid 30 px finns blocket inte alls, vid 31 finns det men ryms inte —
    // skillnaden syns i `truncated`, inte i raderna.
    const at30 = layout({ duration: 17, title: '', room: '' }, { adjustedHeightPx: 30 });
    const at31 = layout({ duration: 17, title: '', room: '' }, { adjustedHeightPx: 31 });
    expect(texts(at30)).toEqual(['08:00']);
    expect(at30.truncated).toBe(false);
    expect(at31.truncated).toBe(true);
  });

  it('döljer anteckningar vid exakt 46 px', () => {
    const bare = { title: '', teacher: '', room: '', notes: 'Prov' };
    expect(texts(layout(bare, { adjustedHeightPx: 46 }))).not.toContain('Prov');
    expect(texts(layout(bare, { adjustedHeightPx: 47 }))).toContain('Prov');
  });
});

describe('layoutCardText — klämning', () => {
  it('offrar anteckningarna före titeln', () => {
    const result = layout(
      { title: 'Naturkunskap special', notes: 'rad ett\nrad två\nrad tre\nrad fyra' },
      { adjustedHeightPx: 80, innerWidthPx: 200 }
    );
    expect(result.truncated).toBe(true);
    // Titeln står kvar hel, anteckningarna är kortade.
    expect(texts(result)).toContain('Naturkunskap special');
    expect(texts(result).filter(t => t.startsWith('rad')).length).toBeLessThan(4);
  });

  it('markerar kapade anteckningar med ellips', () => {
    const result = layout(
      { notes: 'rad ett\nrad två\nrad tre\nrad fyra\nrad fem' },
      { adjustedHeightPx: 90 }
    );
    const notesLines = texts(result).filter(t => t.startsWith('rad'));
    expect(notesLines[notesLines.length - 1]).toMatch(/…$/);
  });

  it('kortar aldrig av ett lärarnamn med ellips', () => {
    const result = layout(
      { teacher: 'Ett mycket långt lärarnamn, Ann', notes: 'x'.repeat(400) },
      { adjustedHeightPx: 120, innerWidthPx: 120 }
    );
    for (const line of result.lines) {
      for (const r of line.runs) {
        if (r.role === 'meta' && r.font === 'meta') expect(r.text).not.toMatch(/…$/);
      }
    }
  });

  it('behåller rubrikraden även när inget annat ryms', () => {
    const result = layout({ duration: 10 }, { adjustedHeightPx: 16 });
    expect(texts(result)).toEqual(['08:00|Matematik']);
  });

  it('lämnar truncated falskt när allt får plats', () => {
    expect(layout({ notes: 'kort' }, { adjustedHeightPx: 200 }).truncated).toBe(false);
  });

  it('släpper hela rader, aldrig halva', () => {
    const result = layout(
      { title: 'Ett', teacher: 'TL', room: 'A12', notes: 'a\nb\nc\nd\ne' },
      { adjustedHeightPx: 70 }
    );
    const used = result.lines.reduce((sum, l) => sum + l.lineHeightPx, 0);
    // Rubrikraden är undantagen; resten ska rymmas i innerhöjden.
    expect(used - result.lines[0].lineHeightPx).toBeLessThanOrEqual(70 - 6 - 4);
  });
});

describe('layoutCardText — tidsetiketten', () => {
  it('faller tillbaka på starttiden när intervallet inte ryms', () => {
    // Skärmen klipper med overflow: hidden; här finns ingen klippning, så
    // etiketten måste välja en form som ryms.
    const wide = layout({ duration: 60 }, { isLastOfDay: true, innerWidthPx: 200 });
    const narrow = layout({ duration: 60 }, { isLastOfDay: true, innerWidthPx: 40 });
    expect(texts(wide)[0]).toBe('08:00–09:00');
    expect(texts(narrow)[0]).toBe('08:00');
  });

  it('kortar av starttiden när inte ens den ryms', () => {
    const result = layout({ duration: 60 }, { isLastOfDay: true, innerWidthPx: 18 });
    expect(texts(result)[0]).toMatch(/…$/);
  });
});
