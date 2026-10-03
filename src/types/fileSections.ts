export interface FileData {
  id: string;
  name: string;
  url: string;
  file_path: string;
  tags: string[];
  notebooklm?: string;
  created_time?: string;
}

/** Svaret från GET /files: filerna grupperade på de två första mappnivåerna. */
export interface SubSection {
  name: string;
  path: string;
  files: FileData[];
}

export interface SectionData {
  name: string;
  files: FileData[];
  subsections: Record<string, SubSection>;
}

/**
 * En mapp i Biblioteket, byggd ur filernas fulla sökvägar. Till skillnad från
 * `SectionData` har den alla nivåer, inte bara två.
 */
export interface FolderNode {
  name: string;
  /** Sökvägen utan inledande '/', t.ex. "Temaplaneringar/HT 26". Unik bland mapparna. */
  path: string;
  /** 1 = toppmapp, alltså rubriken ovanför rutan. */
  level: number;
  folders: FolderNode[];
  files: FileData[];
  /** Filer i mappen och i alla mappar under den. */
  fileCount: number;
}
