import { describe, expect, it } from 'vitest';
import type { FileData, FolderNode, SectionData } from '@/types/fileSections';
import {
  buildLibraryTree,
  filterLibraryTree,
  folderParts,
  isFolderOpen,
  sanitizeFolderOpenState,
  toggleFolder,
} from '@/utils/libraryTree';

let nextId = 0;
const file = (filePath: string, extra: Partial<FileData> = {}): FileData => ({
  id: `f${nextId++}`,
  name: filePath.split('/').pop() ?? filePath,
  url: 'https://drive.google.com/x',
  file_path: filePath,
  tags: [],
  ...extra,
});

/** Svaret från /files: backenden grupperar, men varje fil har hela sökvägen. */
const response = (...files: FileData[]): SectionData[] => [
  { name: 'Alla', files, subsections: {} },
];

const names = (folders: FolderNode[]) => folders.map(folder => folder.name);
const find = (folders: FolderNode[], path: string): FolderNode | undefined => {
  for (const folder of folders) {
    if (folder.path === path) return folder;
    const found = find(folder.folders, path);
    if (found) return found;
  }
  return undefined;
};

const temaplaneringar = () => buildLibraryTree(response(
  file('Temaplaneringar/HT 26/Tema 1_ Balans/Religion/Grund/Grund Buddhismen & hinduismen/Hinduismen - inledning.docx'),
  file('Temaplaneringar/HT 26/Tema 1_ Balans/Planering.docx'),
  file('Temaplaneringar/VT 26/Tema 3_ Jag, vi & världen/Material v 18/1800-1900/bild.jpg'),
  file('Temaplaneringar/VT 26/Tema 3_ Jag, vi & världen/Material v 9/text.pdf'),
  file('Engelska/Poems.docx', { tags: ['#poetry'] }),
));

describe('folderParts', () => {
  it('tar bort filnamnet och ett inledande snedstreck', () => {
    expect(folderParts('A/B/fil.pdf')).toEqual(['A', 'B']);
    expect(folderParts('/A/fil.pdf')).toEqual(['A']);
    expect(folderParts('fil.pdf')).toEqual([]);
  });
});

describe('buildLibraryTree', () => {
  it('bygger alla nivåer ur sökvägarna', () => {
    const tree = temaplaneringar();
    const deepest = find(tree, 'Temaplaneringar/HT 26/Tema 1_ Balans/Religion/Grund/Grund Buddhismen & hinduismen');

    expect(names(tree)).toEqual(['Engelska', 'Temaplaneringar']);
    expect(deepest?.level).toBe(6);
    expect(deepest?.files.map(f => f.name)).toEqual(['Hinduismen - inledning.docx']);
  });

  it('räknar filerna i hela mappen', () => {
    const tree = temaplaneringar();

    expect(find(tree, 'Temaplaneringar')?.fileCount).toBe(4);
    expect(find(tree, 'Temaplaneringar/HT 26/Tema 1_ Balans')?.fileCount).toBe(2);
  });

  it('sorterar siffror som tal', () => {
    const tema3 = find(temaplaneringar(), 'Temaplaneringar/VT 26/Tema 3_ Jag, vi & världen');

    expect(names(tema3?.folders ?? [])).toEqual(['Material v 9', 'Material v 18']);
  });

  it('tar med filer från både sektioner och undersektioner', () => {
    const tree = buildLibraryTree([{
      name: 'A',
      files: [file('A/a.pdf')],
      subsections: { B: { name: 'B', path: '/A/B', files: [file('A/B/C/c.pdf')] } },
    }]);

    expect(find(tree, 'A/B/C')?.files.map(f => f.name)).toEqual(['c.pdf']);
    expect(find(tree, 'A')?.fileCount).toBe(2);
  });

  it('lägger filer i rotmappen under Uncategorized och hoppar över anteckningar utan länk', () => {
    const tree = buildLibraryTree(response(
      file('rotfil.pdf'),
      file('/A/anteckning.md', { url: '' }),
    ));

    expect(names(tree)).toEqual(['Uncategorized']);
    expect(tree[0].files.map(f => f.name)).toEqual(['rotfil.pdf']);
  });
});

describe('filterLibraryTree', () => {
  const visible = { term: '', showTags: false, showHidden: false };

  it('visar allt utan sökord och fäller inte ut något', () => {
    const { folders, searchOpen } = filterLibraryTree(temaplaneringar(), visible);

    expect(names(folders)).toEqual(['Engelska', 'Temaplaneringar']);
    expect(searchOpen.size).toBe(0);
  });

  it('behåller bara träffar och fäller ut vägen dit', () => {
    const { folders, searchOpen } = filterLibraryTree(temaplaneringar(), { ...visible, term: 'Hinduismen' });

    expect(names(folders)).toEqual(['Temaplaneringar']);
    expect(names(folders[0].folders)).toEqual(['HT 26']);
    expect(find(folders, 'Temaplaneringar/HT 26/Tema 1_ Balans')?.files).toEqual([]);
    expect(searchOpen.has('Temaplaneringar/HT 26/Tema 1_ Balans/Religion/Grund')).toBe(true);
    expect(folders[0].fileCount).toBe(1);
  });

  it('visar en mapp med hela innehållet när mappnamnet matchar', () => {
    const { folders, searchOpen } = filterLibraryTree(temaplaneringar(), { ...visible, term: 'religion' });
    const religion = find(folders, 'Temaplaneringar/HT 26/Tema 1_ Balans/Religion');

    expect(religion?.fileCount).toBe(1);
    expect(searchOpen.has(religion?.path ?? '')).toBe(true);
    expect(searchOpen.has('Temaplaneringar/HT 26/Tema 1_ Balans/Religion/Grund')).toBe(false);
  });

  it('söker bara i taggar när taggarna visas', () => {
    expect(filterLibraryTree(temaplaneringar(), { ...visible, term: 'poetry' }).folders).toEqual([]);
    expect(names(filterLibraryTree(temaplaneringar(), { ...visible, term: 'poetry', showTags: true }).folders))
      .toEqual(['Engelska']);
  });

  it('döljer _-mappar på alla nivåer tills de tas fram', () => {
    const tree = buildLibraryTree(response(
      file('A/B/_gammalt/gammal.pdf'),
      file('A/B/ny.pdf'),
      file('_dold/x.pdf'),
    ));

    const hidden = filterLibraryTree(tree, visible).folders;
    expect(names(hidden)).toEqual(['A']);
    expect(find(hidden, 'A/B/_gammalt')).toBeUndefined();

    const shown = filterLibraryTree(tree, { ...visible, showHidden: true }).folders;
    expect(find(shown, 'A/B/_gammalt')?.fileCount).toBe(1);
    expect(names(shown)).toEqual(['_dold', 'A']);
  });
});

describe('utfällda mappar', () => {
  const tema1 = { path: 'Temaplaneringar/HT 26/Tema 1_ Balans', level: 3 };
  const religion = { path: 'Temaplaneringar/HT 26/Tema 1_ Balans/Religion', level: 4 };

  it('är utfällda till och med nivå 3 från start', () => {
    expect(isFolderOpen({}, tema1)).toBe(true);
    expect(isFolderOpen({}, religion)).toBe(false);
  });

  it('sparar bara val som avviker från standard', () => {
    const opened = toggleFolder({}, religion);
    expect(opened).toEqual({ [religion.path]: true });
    expect(isFolderOpen(opened, religion)).toBe(true);

    expect(toggleFolder(opened, religion)).toEqual({});
    expect(toggleFolder({}, tema1)).toEqual({ [tema1.path]: false });
  });

  it('släpper igenom bara sökvägar med true eller false', () => {
    expect(sanitizeFolderOpenState({ a: true, b: 'ja', c: false })).toEqual({ a: true, c: false });
    expect(sanitizeFolderOpenState(['a'])).toEqual({});
    expect(sanitizeFolderOpenState(null)).toEqual({});
  });
});
