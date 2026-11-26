import { describe, expect, it } from 'vitest';
import { combineSheets, groupView, type AttendanceTable } from '@/utils/narvaro';
import {
  applyTemplate,
  baseName,
  parseName,
  memberLabels,
  missingMembers,
  renameTemplate,
  renameTemplatesClass,
  removeTemplate,
  sanitizeTemplates,
  sortTemplates,
  templateClasses,
  templateFromPass,
  updateTemplateFromPass,
  upsertTemplate,
  type GroupTemplate,
  type TemplateMember,
} from '@/utils/narvaroTemplates';

const NOW = new Date('2026-11-26T10:00:00Z');

const m = (name: string, klass = 'Rosa'): TemplateMember => ({ name, klass });
const p = (name: string, klass = 'Rosa') => ({ name, klass });

const template = (groups: TemplateMember[][], names: string[] = []): GroupTemplate => ({
  id: 't1',
  name: 'Labbgrupper',
  groups: groups.map((members, i) => ({ name: names[i] ?? '', members })),
  updatedAt: '2026-11-01T00:00:00.000Z',
});

/** Ett ark med en dag (Måndag, kolumn B) och kryss för `present`. */
const sheet = (names: string[], present: string[] = names): AttendanceTable => ({
  people: names.map(name => ({ name, group: '', marks: [null, present.includes(name)] })),
  cols: [{ index: 1, id: 'c1', letter: 'B', day: 'Måndag', pass: '8.30-9.45', time: [510, 585] }],
  groups: [],
  days: ['Måndag'],
});

describe('baseName', () => {
  it('tar bort klasstillägget från combineSheets', () => {
    expect(baseName({ name: 'Ali (Rosa)', klass: 'Rosa' })).toBe('Ali');
    expect(baseName({ name: 'Ali (utan klass)', klass: '' })).toBe('Ali');
    expect(baseName({ name: 'Ali', klass: 'Rosa' })).toBe('Ali');
  });

  it('läser löpnumret för samma namn i samma ark', () => {
    expect(parseName({ name: 'Ali (Rosa 2)', klass: 'Rosa' })).toEqual({ name: 'Ali', n: 2 });
    expect(parseName({ name: 'Ali (Rosa)', klass: 'Rosa' })).toEqual({ name: 'Ali' });
    expect(parseName({ name: 'Ali (Rosa 2)', klass: 'Rosa 2' })).toEqual({ name: 'Ali' });
    expect(parseName({ name: 'Ali (a.b)', klass: 'a.b' })).toEqual({ name: 'Ali' });
    expect(parseName({ name: 'Ali (axb)', klass: 'a.b' })).toEqual({ name: 'Ali (axb)' });
  });

  it('lämnar en parentes som inte är klassen', () => {
    expect(baseName({ name: 'Anna (Lisa)', klass: 'Rosa' })).toBe('Anna (Lisa)');
    expect(baseName({ name: 'Anna (Lisa)' })).toBe('Anna (Lisa)');
  });
});

describe('applyTemplate', () => {
  const t = template([[m('Amira'), m('Bilal')], [m('Cleo'), m('Dana')]], ['Röda', '']);

  it('placerar eleverna och sparar även frånvarandes platser', () => {
    const people = [p('Amira'), p('Bilal'), p('Cleo'), p('Dana'), p('Erik')];
    const pg = applyTemplate(t, people);
    expect(pg).toEqual({ groups: [['Amira', 'Bilal'], ['Cleo', 'Dana']], names: ['Röda', ''], from: 't1' });
    // Bilal är frånvarande och Erik finns inte i indelningen.
    expect(groupView(pg.groups, ['Amira', 'Cleo', 'Dana', 'Erik']))
      .toEqual({ groups: [['Amira'], ['Cleo', 'Dana']], pool: ['Erik'] });
  });

  it('behåller en grupp vars elever alla saknas i passet, tom', () => {
    expect(applyTemplate(t, [p('Amira'), p('Bilal')]).groups).toEqual([['Amira', 'Bilal'], []]);
  });

  it('hittar en elev som bytt klass på namnet', () => {
    expect(applyTemplate(t, [p('Amira', 'Grön'), p('Cleo')]).groups).toEqual([['Amira'], ['Cleo']]);
  });

  it('beror inte på gruppernas ordning', () => {
    // G1 har Ali från Grön (bytt klass), G2 Ali i Rosa. Passet har bara Ali i Rosa.
    const ali = template([[m('Ali', 'Grön')], [m('Ali', 'Rosa')]]);
    expect(applyTemplate(ali, [p('Ali', 'Rosa')]).groups).toEqual([[], ['Ali']]);
  });

  it('matchar ingen när namnet inte är entydigt och klassen inte stämmer', () => {
    const two = template([[m('Ali', 'Grön')], [m('Ali', 'Blå')]]);
    expect(applyTemplate(two, [p('Ali', 'Rosa')]).groups).toEqual([[], []]);
    const one = template([[m('Ali', 'Grön')]]);
    expect(applyTemplate(one, [p('Ali', 'Rosa'), p('Ali', 'Blå')]).groups).toEqual([[]]);
  });

  it('skiljer två med samma namn i olika klasser åt med klassen', () => {
    const table = combineSheets({ Rosa: sheet(['Ali', 'Bo']), Grön: sheet(['Ali']) }, ['Rosa', 'Grön']);
    const two = template([[m('Ali', 'Grön')], [m('Ali', 'Rosa'), m('Bo')]]);
    expect(applyTemplate(two, table.people).groups).toEqual([['Ali (Grön)'], ['Ali (Rosa)', 'Bo']]);
  });

  it('placerar en elev som står i två grupper bara i den första', () => {
    const twice = template([[m('Amira')], [m('Amira'), m('Bilal')]]);
    expect(applyTemplate(twice, [p('Amira'), p('Bilal')]).groups).toEqual([['Amira'], ['Bilal']]);
  });

  it('skiljer två med samma namn i samma ark åt med löpnumret', () => {
    // combineSheets kallar dem "Ali (Rosa)" och "Ali (Rosa 2)".
    const table = combineSheets({ Rosa: sheet(['Ali', 'Ali', 'Bo']) }, ['Rosa']);
    const two = template([[{ name: 'Ali', klass: 'Rosa', n: 2 }], [m('Ali'), m('Bo')]]);
    const pg = applyTemplate(two, table.people);
    expect(pg.groups).toEqual([['Ali (Rosa 2)'], ['Ali (Rosa)', 'Bo']]);
    expect(groupView(pg.groups, table.people.map(x => x.name)).pool).toEqual([]);
    // Bara en av dem i indelningen: namnet är inte entydigt, så den andra placeras inte.
    expect(applyTemplate(template([[m('Ali', 'Grön')]]), table.people).groups).toEqual([[]]);
  });
});

describe('templateClasses', () => {
  it('ger indelningens klasser som har pass den dagen', () => {
    const sheets = { Rosa: sheet(['Amira']), Grön: sheet(['Bilal']), Blå: sheet(['Cleo']) };
    const t = template([[m('Amira'), m('Bilal', 'Gammal')], [m('Saknas')]]);
    expect(templateClasses(t, sheets, 'Måndag').sort()).toEqual(['Grön', 'Rosa']);
    expect(templateClasses(t, sheets, 'Tisdag')).toEqual([]);
  });
});

describe('templateFromPass', () => {
  it('sparar grupperna med namn och räknar frånvarande som inte kommer med', () => {
    const people = [p('Amira'), p('Bilal'), p('Cleo'), p('Dana')];
    const pass = { groups: [['Amira'], ['Cleo']], names: ['Röda', ''] };
    const { template: t, absent } = templateFromPass(' Labb  1 ', pass, people, ['Amira', 'Cleo', 'Dana'], { id: 'x', now: NOW });
    expect(t).toEqual({
      id: 'x',
      name: 'Labb 1',
      groups: [{ name: 'Röda', members: [m('Amira')] }, { name: '', members: [m('Cleo')] }],
      updatedAt: NOW.toISOString(),
    });
    // Dana är närvarande men inte indelad; Bilal är frånvarande.
    expect(absent).toBe(1);
  });

  it('sparar ett namn som inte finns i tabellen utan klass', () => {
    const { template: t } = templateFromPass('X', { groups: [['Gammal']] }, [p('Amira')], [], { id: 'x', now: NOW });
    expect(t.groups[0].members).toEqual([{ name: 'Gammal', klass: '' }]);
  });

  it('ger samma grupper tillbaka när den läggs på samma pass', () => {
    const table = combineSheets({ Rosa: sheet(['Ali', 'Bo']), Grön: sheet(['Ali', 'Cleo']) }, ['Rosa', 'Grön']);
    const pass = { groups: [['Ali (Grön)', 'Bo'], ['Ali (Rosa)', 'Cleo']], names: ['A', 'B'] };
    const { template: t } = templateFromPass('X', pass, table.people, [], { id: 'x', now: NOW });
    expect(applyTemplate(t, table.people)).toEqual({ ...pass, from: 'x' });
  });
});

describe('updateTemplateFromPass', () => {
  it('flyttar passets elever, behåller andra klasser och tar bort de som tagits ur', () => {
    const t = template([[m('Amira'), m('Ola', 'Grön')], [m('Bilal'), m('Cleo')]]);
    const people = [p('Amira'), p('Bilal'), p('Cleo')];
    const pass = { groups: [['Amira', 'Bilal'], []], names: ['Röda', 'Blå'] };
    const r = updateTemplateFromPass(t, pass, people, NOW);
    expect(r.template.groups).toEqual([
      { name: 'Röda', members: [m('Amira'), m('Bilal'), m('Ola', 'Grön')] },
      { name: 'Blå', members: [] },
    ]);
    expect(r).toMatchObject({ dropped: [], moved: 1, removed: 1 });
    expect(r.template.updatedAt).toBe(NOW.toISOString());
  });

  it('rapporterar elever utanför passet i en grupp som tagits bort', () => {
    const t = template([[m('Amira')], [m('Ola', 'Grön'), m('Bilal')]]);
    const r = updateTemplateFromPass(t, { groups: [['Amira', 'Bilal']] }, [p('Amira'), p('Bilal')], NOW);
    expect(r.template.groups).toEqual([{ name: '', members: [m('Amira'), m('Bilal')] }]);
    expect(r.dropped).toEqual([m('Ola', 'Grön')]);
  });

  it('dubblerar inte en elev som bytt klass', () => {
    const t = template([[m('Amira', 'Grön')], []]);
    const r = updateTemplateFromPass(t, { groups: [[], ['Amira']] }, [p('Amira', 'Rosa')], NOW);
    expect(r.template.groups.map(g => g.members)).toEqual([[], [m('Amira', 'Rosa')]]);
  });

  it('sparar ett namn som inte finns i tabellen utan klass', () => {
    const r = updateTemplateFromPass(template([[m('Amira')]]), { groups: [['Amira', 'Gammal']] }, [p('Amira')], NOW);
    expect(r.template.groups[0].members).toEqual([m('Amira'), { name: 'Gammal', klass: '' }]);
  });
});

describe('missingMembers och memberLabels', () => {
  it('hittar namn som inte finns i något ark', () => {
    const t = template([[m('Amira'), m('Slutat')]]);
    expect(missingMembers(t, { Rosa: sheet(['Amira']) })).toEqual([m('Slutat')]);
  });

  it('sätter klass bara när samma namn finns i flera klasser', () => {
    const members = [m('Ali', 'Rosa'), m('Amira')];
    const { label, member } = memberLabels(members, [p('Ali', 'Rosa'), p('Ali', 'Grön'), p('Amira')]);
    expect(label(m('Ali', 'Rosa'))).toBe('Ali (Rosa)');
    expect(label(m('Ali', 'Grön'))).toBe('Ali (Grön)');
    // En medlem som också finns i arket får inget tillägg.
    expect(label(m('Amira'))).toBe('Amira');
    expect(member.get('Ali (Grön)')).toEqual(m('Ali', 'Grön'));
    expect(member.get('Amira')).toEqual(m('Amira'));
  });

  it('ger löpnumret i visningsnamnet', () => {
    const { label, member } = memberLabels([], [p('Ali (Rosa)'), p('Ali (Rosa 2)')]);
    expect(label({ name: 'Ali', klass: 'Rosa', n: 2 })).toBe('Ali (Rosa 2)');
    expect(label(m('Ali'))).toBe('Ali (Rosa)');
    expect(member.get('Ali (Rosa 2)')).toEqual({ name: 'Ali', klass: 'Rosa', n: 2 });
  });
});

describe('listan', () => {
  const a = { ...template([]), id: 'a', updatedAt: '2026-11-01' };
  const b = { ...template([]), id: 'b', updatedAt: '2026-11-03' };

  it('sorterar, lägger till, ersätter, byter namn och tar bort', () => {
    expect(sortTemplates([a, b]).map(t => t.id)).toEqual(['b', 'a']);
    expect(upsertTemplate([a], b)).toHaveLength(2);
    expect(upsertTemplate([a, b], { ...a, name: 'Ny' })[0].name).toBe('Ny');
    expect(renameTemplate([a], 'a', '  Nytt namn ', NOW)[0]).toMatchObject({ name: 'Nytt namn', updatedAt: NOW.toISOString() });
    expect(renameTemplate([a], 'a', '   ', NOW)[0].name).toBe('Labbgrupper');
    expect(removeTemplate([a, b], 'a')).toEqual([b]);
  });

  it('byter klass på medlemmarna när klassen byter namn', () => {
    const t = template([[m('Amira', ''), m('Bilal', 'Grön')]]);
    expect(renameTemplatesClass([t], '', 'Rosa')[0].groups[0].members).toEqual([m('Amira', 'Rosa'), m('Bilal', 'Grön')]);
  });
});

describe('sanitizeTemplates', () => {
  it('läser skräp utan att krascha', () => {
    expect(sanitizeTemplates(null)).toEqual([]);
    expect(sanitizeTemplates({ id: 'a' })).toEqual([]);
    expect(sanitizeTemplates([4, { id: 'a' }, { id: 'b', name: 'B', groups: 'x' }])).toEqual([]);
  });

  it('kortar namn, tar bort dubbletter och tomma namn', () => {
    const out = sanitizeTemplates([
      {
        id: 'a',
        name: 'x'.repeat(60),
        updatedAt: 5,
        groups: [
          {
            name: 'y'.repeat(40),
            members: [
              { name: ' Amira ', klass: 'Rosa' }, { name: 'Amira', klass: 'Rosa' }, { name: '' }, 3,
              { name: 'Amira', klass: 'Rosa', n: 2 }, { name: 'Bo', klass: 'Rosa', n: 1 }, { name: 'Ce', klass: 'Rosa', n: 'x' },
            ],
          },
          { members: 'x' },
        ],
      },
      { id: 'a', name: 'Dubblett', groups: [] },
    ]);
    expect(out).toEqual([{
      id: 'a',
      name: 'x'.repeat(40),
      updatedAt: '',
      groups: [
        { name: 'y'.repeat(30), members: [m('Amira'), { name: 'Amira', klass: 'Rosa', n: 2 }, m('Bo'), m('Ce')] },
        { name: '', members: [] },
      ],
    }]);
  });

  it('har högst 50 indelningar och 30 grupper', () => {
    const many = Array.from({ length: 60 }, (_, i) => ({
      id: `t${i}`, name: `T${i}`, groups: Array.from({ length: 40 }, () => ({ name: '', members: [] })),
    }));
    const out = sanitizeTemplates(many);
    expect(out).toHaveLength(50);
    expect(out[0].groups).toHaveLength(30);
  });
});
