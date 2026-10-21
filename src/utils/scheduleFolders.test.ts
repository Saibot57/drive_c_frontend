import { describe, expect, it } from 'vitest';
import type { PlannerArchiveSummary } from '@/types/schedule';
import {
  defaultFolderForNewSchedule,
  folderNameOf,
  folderNames,
  foldersSupported,
  groupWeekArchives,
  moveNotice,
  ownArchivesIn,
  panelOrder,
  renameExpandedFolder,
  sanitizeExpandedFolders,
} from './scheduleFolders';

const archive = (
  id: string,
  folder?: string | null,
  extra: Partial<PlannerArchiveSummary> = {}
): PlannerArchiveSummary => ({
  id,
  name: id,
  ownerId: 'tobias',
  ownerUsername: 'tobias',
  isOwner: true,
  sharedWith: [],
  lock: null,
  updatedAt: null,
  kind: 'week',
  ...(folder === undefined ? {} : { folder }),
  ...extra,
});

const ids = (archives: PlannerArchiveSummary[]) => archives.map(a => a.id);

describe('folderNameOf', () => {
  it('ger null för saknad, tom och blank mapp', () => {
    expect(folderNameOf(archive('a'))).toBeNull();
    expect(folderNameOf(archive('a', null))).toBeNull();
    expect(folderNameOf(archive('a', '   '))).toBeNull();
  });

  it('trimmar namnet', () => {
    expect(folderNameOf(archive('a', ' HT26 '))).toBe('HT26');
  });
});

describe('foldersSupported', () => {
  it('är falskt när backend inte skickar nyckeln', () => {
    expect(foldersSupported([archive('a'), archive('b')])).toBe(false);
    expect(foldersSupported([])).toBe(false);
  });

  it('är sant när nyckeln finns, även som null', () => {
    expect(foldersSupported([archive('a', null)])).toBe(true);
  });
});

describe('groupWeekArchives', () => {
  it('delar i mappar och lösa scheman och behåller ordningen inom mappen', () => {
    const groups = groupWeekArchives([
      archive('v.35', 'HT26'),
      archive('v.36', null),
      archive('v.37', 'HT26'),
      archive('intro', 'Introveckor'),
      archive('v.38'),
    ]);
    expect(groups.folders.map(g => [g.name, ids(g.archives)])).toEqual([
      ['HT26', ['v.35', 'v.37']],
      ['Introveckor', ['intro']],
    ]);
    expect(ids(groups.loose)).toEqual(['v.36', 'v.38']);
  });

  it('sorterar mappar på svenska med siffror i nummerordning', () => {
    const groups = groupWeekArchives([
      archive('a', 'Vecka 10'),
      archive('b', 'Vecka 9'),
      archive('c', 'Ämnen'),
      archive('d', 'Åk 1'),
      archive('e', 'Arbete'),
    ]);
    expect(folderNames(groups)).toEqual(['Arbete', 'Vecka 9', 'Vecka 10', 'Åk 1', 'Ämnen']);
  });

  it('slår ihop två ägares mappar med samma namn', () => {
    const groups = groupWeekArchives([
      archive('mitt', 'HT26'),
      archive('tobias', 'HT26', { isOwner: false, ownerUsername: 'tobias' }),
    ]);
    expect(groups.folders).toHaveLength(1);
    expect(ids(groups.folders[0].archives)).toEqual(['mitt', 'tobias']);
  });

  it('håller isär namn som bara skiljer i stora och små bokstäver', () => {
    const groups = groupWeekArchives([archive('a', 'HT26'), archive('b', 'ht26')]);
    expect(groups.folders).toHaveLength(2);
  });
});

describe('panelOrder', () => {
  const bases = [archive('bas', null, { kind: 'base' })];
  const groups = groupWeekArchives([
    archive('v.35', 'HT26'),
    archive('v.36', 'HT26'),
    archive('intro', 'Intro'),
    archive('v.43', null),
  ]);

  it('har basscheman, sedan mapparna, sedan lösa scheman', () => {
    expect(ids(panelOrder(bases, groups, new Set(['HT26', 'Intro']))))
      .toEqual(['bas', 'v.35', 'v.36', 'intro', 'v.43']);
  });

  it('hoppar över scheman i hopfällda mappar', () => {
    expect(ids(panelOrder(bases, groups, new Set(['Intro'])))).toEqual(['bas', 'intro', 'v.43']);
    expect(ids(panelOrder(bases, groups, new Set()))).toEqual(['bas', 'v.43']);
  });
});

describe('ownArchivesIn', () => {
  it('ger bara de egna schemana', () => {
    const [group] = groupWeekArchives([
      archive('mitt', 'HT26'),
      archive('tobias', 'HT26', { isOwner: false }),
    ]).folders;
    expect(ids(ownArchivesIn(group))).toEqual(['mitt']);
  });
});

describe('defaultFolderForNewSchedule', () => {
  it('tar originalets mapp vid Duplicera, även en kollegas', () => {
    expect(defaultFolderForNewSchedule({
      duplicateOf: archive('v.35', 'HT26', { isOwner: false }),
      activeWeekArchive: archive('v.43', 'Annat'),
    })).toBe('HT26');
  });

  it('tar Utan mapp vid Duplicera av ett schema utan mapp', () => {
    expect(defaultFolderForNewSchedule({
      duplicateOf: archive('v.35', null),
      activeWeekArchive: archive('v.43', 'Annat'),
    })).toBeNull();
  });

  it('tar det öppna veckoschemats mapp vid Nytt veckoschema', () => {
    expect(defaultFolderForNewSchedule({ duplicateOf: null, activeWeekArchive: archive('v.43', 'HT26') }))
      .toBe('HT26');
    expect(defaultFolderForNewSchedule({ duplicateOf: null, activeWeekArchive: null })).toBeNull();
  });
});

describe('sanitizeExpandedFolders', () => {
  it('tål skräp från lagringen', () => {
    expect(sanitizeExpandedFolders(null)).toEqual([]);
    expect(sanitizeExpandedFolders('HT26')).toEqual([]);
    expect(sanitizeExpandedFolders({ HT26: true })).toEqual([]);
  });

  it('behåller strängar, trimmade och utan dubbletter', () => {
    expect(sanitizeExpandedFolders(['HT26', 7, ' HT26 ', '', 'VT27', null])).toEqual(['HT26', 'VT27']);
  });
});

describe('renameExpandedFolder', () => {
  it('flyttar det utfällda läget till det nya namnet', () => {
    expect(renameExpandedFolder(['HT26', 'VT27'], 'HT26', 'Hösten')).toEqual(['Hösten', 'VT27']);
  });

  it('lämnar en hopfälld mapp hopfälld', () => {
    expect(renameExpandedFolder(['VT27'], 'HT26', 'Hösten')).toEqual(['VT27']);
  });

  it('slår ihop när det nya namnet redan är utfällt', () => {
    expect(renameExpandedFolder(['HT26', 'VT27'], 'HT26', 'VT27')).toEqual(['VT27']);
  });
});

describe('moveNotice', () => {
  it('nämner schemat vid ett och antalet vid flera', () => {
    expect(moveNotice([{ name: 'v.35' }], 'HT26')).toBe('Flyttade "v.35" till HT26.');
    expect(moveNotice([{ name: 'v.35' }, { name: 'v.36' }], 'HT26')).toBe('Flyttade 2 scheman till HT26.');
    expect(moveNotice([{ name: 'v.35' }], null)).toBe('Flyttade "v.35" ut ur mappen.');
  });
});
