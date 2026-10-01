import { describe, expect, it } from 'vitest';
import { LAB_SEED } from '@/config/lessonLabSeed';
import type { PlannerActivity } from '@/types/schedule';
import type { LabLesson, LabState } from '@/types/lessonLab';
import { buildLabExport, LAB_EXPORT_FORMAT, labExportFileName, labStateFromFile } from '@/utils/labExport';

const lesson = (id: string, overrides: Partial<LabLesson> = {}): LabLesson => ({
  id,
  day: 'Måndag',
  start: '08:30',
  end: '09:45',
  title: '',
  areaId: null,
  teamId: null,
  split: false,
  classTeams: {},
  classTeachers: {},
  ...overrides,
});

/** Tavlan med ett lag som äger en måndagslektion, 75 minuter. */
const state: LabState = {
  ...LAB_SEED,
  teams: [{ id: 'g-skriv', number: 1, name: 'Skrivlaget', color: '#fde68a', memberIds: ['t-tobias', 't-victor', 't-camilla'] }],
  template: [lesson('l1', { teamId: 'g-skriv' })],
  archiveId: 'a1',
};

const activity = (overrides: Partial<PlannerActivity>): PlannerActivity => ({
  id: 'x',
  title: 'Matte',
  day: 'Måndag',
  startTime: '08:30',
  endTime: '09:30',
  duration: 60,
  teacher: 'Tobias',
  ...overrides,
});

const plan = { id: 'p1', name: 'Mitt upplägg', version: 3, updatedAt: '2026-10-01T08:00:00Z' };

describe('buildLabExport', () => {
  it('har med läget, planen och en förklaring', () => {
    const data = buildLabExport({ state, plan, archive: { id: null, name: null, activities: null }, exportedAt: new Date('2026-10-01T10:00:00Z') });
    expect(data.format).toBe(LAB_EXPORT_FORMAT);
    expect(data.exportedAt).toBe('2026-10-01T10:00:00.000Z');
    expect(data.plan).toEqual(plan);
    expect(data.state).toBe(state);
    expect(data.readme).toContain('classTeams');
  });

  it('räknar lärarnas tema och fasta pass ur arkivet', () => {
    const data = buildLabExport({
      state,
      plan,
      archive: { id: 'a1', name: 'HT26', activities: [activity({ day: 'Tisdag' })] },
    });
    const tobias = data.summary.teachers.find(t => t.id === 't-tobias')!;
    // Tre lärare till tre klasser: hela lektionen var.
    expect(tobias.temaMinutes).toBe(75);
    expect(tobias.fixedMinutes.total).toBe(60);
    expect(tobias.totalMinutes).toBe(135);
    expect(tobias.fixedLessons).toEqual([{ day: 'Tisdag', start: '08:30', end: '09:30', title: 'Matte' }]);
    expect(tobias.teams).toEqual([{ number: 1, name: 'Skrivlaget' }]);
    expect(data.archive.loaded).toBe(true);
  });

  it('visar när laget har för få lärare för att ett fast pass krockar', () => {
    const data = buildLabExport({ state, plan, archive: { id: 'a1', name: 'HT26', activities: [activity({})] } });
    const [l1] = data.summary.lessons;
    expect(l1.staffing).toEqual([{
      team: { id: 'g-skriv', number: 1, name: 'Skrivlaget' },
      classes: state.classes,
      availableMembers: ['Victor', 'Camilla'],
      enough: false,
    }]);
    expect(data.summary.warnings.some(w => w.kind === 'shortTeam' && w.lessonId === 'l1')).toBe(true);
  });

  it('säger till när arkivets pass saknas', () => {
    const data = buildLabExport({ state, plan, archive: { id: 'a1', name: 'HT26', activities: null } });
    expect(data.archive.loaded).toBe(false);
    expect(data.archive.note).toContain('kunde inte hämtas');
  });

  it('går att göra till JSON och tillbaka till ett läge', () => {
    const data = buildLabExport({ state, plan: null, archive: { id: null, name: null, activities: null } });
    expect(labStateFromFile(JSON.parse(JSON.stringify(data)))?.teams).toEqual(state.teams);
  });
});

describe('labStateFromFile', () => {
  it('läser ett rent läge, och bara läget ur en export', () => {
    expect(labStateFromFile(state)?.template).toHaveLength(1);
    expect(labStateFromFile({ readme: 'x', state })?.template).toHaveLength(1);
  });

  it('avvisar annat', () => {
    expect(labStateFromFile(null)).toBeNull();
    expect(labStateFromFile({ state: 'nej' })).toBeNull();
    expect(labStateFromFile([1, 2])).toBeNull();
  });
});

describe('labExportFileName', () => {
  it('skiljer sig från den vanliga filen', () => {
    expect(labExportFileName('Höst A', new Date('2026-10-01T10:00:00Z'))).toBe('arbetslag-Höst-A-2026-10-01-ai.json');
  });
});
