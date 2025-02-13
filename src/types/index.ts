// src/types/index.ts
export interface FileData {
    id: string;
    name: string;
    url: string;
    file_path: string;
    tags: string[];
    notebooklm?: string;
    created_time?: string;
  }
  
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