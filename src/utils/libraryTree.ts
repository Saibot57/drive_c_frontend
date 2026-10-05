import type { FileData, FolderNode, SectionData } from '@/types/fileSections';

/**
 * Bibliotekets mappträd.
 *
 * GET /files grupperar filerna på de två första mappnivåerna, men varje fil
 * har sin fulla sökväg med sig. Trädet byggs därför här, med alla nivåer, och
 * backenden behöver inte ändras.
 */

/** Filer direkt i rotmappen hamnar under samma rubrik som backenden använder. */
export const ROOT_FILES_FOLDER = 'Uncategorized';

/** Mappar till och med den här nivån är utfällda tills användaren väljer annat. 1 = toppmapp. */
export const DEFAULT_OPEN_LEVEL = 3;

/** Var användarens utfällda och hopfällda mappar sparas i localStorage. */
export const LIBRARY_FOLDERS_KEY = 'bibliotek.folders.v1';

/** Var användarens ordning på toppmapparna sparas i localStorage. */
export const LIBRARY_ORDER_KEY = 'bibliotek.order.v1';

const MAX_STORED_FOLDERS = 2000;

// Siffror jämförs som tal, så att "Material v 9" kommer före "Material v 18".
const collator = new Intl.Collator('sv', { numeric: true, sensitivity: 'base' });
const byName = (a: { name: string }, b: { name: string }) =>
  collator.compare(a.name.trim(), b.name.trim());

const hasUrl = (file: FileData) => Boolean(file.url && file.url.trim() !== '');

/** Mapparna i en sökväg, utan filnamnet: "/A/B/fil.pdf" → ["A", "B"]. */
export const folderParts = (filePath: string): string[] =>
  (filePath || '').split('/').filter(Boolean).slice(0, -1);

const countFiles = (folder: FolderNode): number =>
  folder.files.length + folder.folders.reduce((sum, child) => sum + child.fileCount, 0);

const finish = (folder: FolderNode): FolderNode => {
  folder.folders.sort(byName).forEach(finish);
  folder.files.sort(byName);
  folder.fileCount = countFiles(folder);
  return folder;
};

/**
 * Trädet ur svaret från /files. Filer utan länk är gamla anteckningar och
 * visas inte, precis som tidigare.
 */
export const buildLibraryTree = (sections: SectionData[]): FolderNode[] => {
  const top: FolderNode[] = [];
  const byPath = new Map<string, FolderNode>();

  const child = (siblings: FolderNode[], name: string, path: string, level: number): FolderNode => {
    const existing = byPath.get(path);
    if (existing) return existing;
    const folder: FolderNode = { name, path, level, folders: [], files: [], fileCount: 0 };
    byPath.set(path, folder);
    siblings.push(folder);
    return folder;
  };

  const folderFor = (parts: string[]): FolderNode =>
    parts.slice(1).reduce(
      (parent, name) => child(parent.folders, name, `${parent.path}/${name}`, parent.level + 1),
      child(top, parts[0], parts[0], 1),
    );

  const files = sections.flatMap(section => [
    ...section.files,
    ...Object.values(section.subsections || {}).flatMap(subsection => subsection.files),
  ]);

  for (const file of files) {
    if (!hasUrl(file)) continue;
    const parts = folderParts(file.file_path);
    folderFor(parts.length > 0 ? parts : [ROOT_FILES_FOLDER]).files.push(file);
  }

  return top.sort(byName).map(finish);
};

export type LibraryFilter = {
  term: string;
  showTags: boolean;
  showHidden: boolean;
};

const fileMatches = (file: FileData, needle: string, showTags: boolean) =>
  file.name.toLowerCase().includes(needle) ||
  (showTags && (file.tags ?? []).some(tag => tag.toLowerCase().includes(needle)));

/**
 * Det som ska synas, och vilka mappar sökningen fäller ut.
 *
 * - Mappar vars namn börjar med `_` döljs på alla nivåer, om de inte tagits fram.
 * - En mapp vars namn matchar sökordet visas med hela sitt innehåll.
 * - Utfällda av sökningen blir mappar med träffar och alla mappar ovanför dem.
 * - Mappar utan filer kvar visas inte.
 */
export const filterLibraryTree = (
  folders: FolderNode[],
  { term, showTags, showHidden }: LibraryFilter,
): { folders: FolderNode[]; searchOpen: Set<string> } => {
  const needle = term.toLowerCase().trim();
  const searchOpen = new Set<string>();

  const visit = (folder: FolderNode, keepAll: boolean): FolderNode | null => {
    if (!showHidden && folder.name.startsWith('_')) return null;

    const nameHit = needle !== '' && folder.name.toLowerCase().includes(needle);
    const all = needle === '' || keepAll || nameHit;
    const hits = needle === '' ? [] : folder.files.filter(file => fileMatches(file, needle, showTags));
    const files = all ? folder.files : hits;
    const children = folder.folders
      .map(child => visit(child, all))
      .filter((child): child is FolderNode => child !== null);

    if (files.length === 0 && children.length === 0) return null;
    if (nameHit || hits.length > 0 || children.some(child => searchOpen.has(child.path))) {
      searchOpen.add(folder.path);
    }

    const kept = { ...folder, files, folders: children };
    return { ...kept, fileCount: countFiles(kept) };
  };

  const visible = folders
    .map(folder => visit(folder, false))
    .filter((folder): folder is FolderNode => folder !== null);
  return { folders: visible, searchOpen };
};

/**
 * Användarens egna val, mappens sökväg → utfälld. Bara val som avviker från
 * standard sparas, så att listan inte växer med varje klick.
 */
export type FolderOpenState = Record<string, boolean>;

type FolderRef = Pick<FolderNode, 'path' | 'level'>;

const openByDefault = (folder: FolderRef) => folder.level <= DEFAULT_OPEN_LEVEL;

export const isFolderOpen = (state: FolderOpenState, folder: FolderRef): boolean =>
  state[folder.path] ?? openByDefault(folder);

export const toggleFolder = (state: FolderOpenState, folder: FolderRef): FolderOpenState => {
  const open = !isFolderOpen(state, folder);
  const next = { ...state };
  if (open === openByDefault(folder)) {
    delete next[folder.path];
  } else {
    next[folder.path] = open;
  }
  return next;
};

/** För `usePersistentState`: bara sökvägar med true eller false, och högst ett par tusen. */
export const sanitizeFolderOpenState = (raw: unknown): FolderOpenState => {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const entries = Object.entries(raw).filter(
    (entry): entry is [string, boolean] => typeof entry[1] === 'boolean',
  );
  return Object.fromEntries(entries.slice(-MAX_STORED_FOLDERS));
};
