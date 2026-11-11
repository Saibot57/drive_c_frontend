import type { MindmapDoc } from '@/types/mindmapDoc';
import { toFileSlug } from '@/utils/download';
import { cleanMindmapName, sanitizeMindmapDoc } from '@/utils/mindmapDoc';
import { MindmapImportError, parseMindmup } from '@/utils/mindmapMup';

/*
 * Mindmap-sidans filer: det egna formatet (`.json`) ut och in, igenkänning
 * av en fil som ska importeras, filnamn och tangenten som kopierar bilden.
 * Allt som läses in går genom sanitizeMindmapDoc. Ett fel är alltid ett
 * MindmapImportError med en svensk text, som visas som notis.
 */

/** Omslagets namn, så att filen går att känna igen. */
export const MINDMAP_FILE_FORMAT = 'drive-c-mindmap';
export const MINDMAP_FILE_VERSION = 1;

/** Större filer läses inte. En karta med bilder som länkar är några hundra kB. */
export const MAX_IMPORT_BYTES = 5 * 1024 * 1024;

const FALLBACK_NAME = 'Importerad karta';

export type MindmapFileKind = 'json' | 'mup';

const isObject = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);

/** Kartan i sidans eget format, som en sträng att spara. */
export function toMindmapFile(name: string, doc: MindmapDoc): string {
  return `${JSON.stringify({ format: MINDMAP_FILE_FORMAT, version: MINDMAP_FILE_VERSION, name, doc }, null, 2)}\n`;
}

/** Filnamnet utan ändelse, som namn på en importerad karta. */
export function importNameFromFile(fileName: string): string {
  const base = fileName.replace(/^.*[\\/]/, '').replace(/\.[^.]*$/, '');
  return cleanMindmapName(base, FALLBACK_NAME);
}

function parseOwnFile(value: Record<string, unknown>, fallbackName: string): { name: string; doc: MindmapDoc } {
  const version = value.version;
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) {
    throw new MindmapImportError('Filen är trasig: versionen saknas.');
  }
  if (version > MINDMAP_FILE_VERSION) {
    throw new MindmapImportError('Filen kommer från en nyare version av sidan och kan inte läsas här än.');
  }
  const doc = value.doc;
  // sanitizeMindmapDoc ger en ny tom karta när roten saknas; här ska det vara ett fel.
  if (!isObject(doc) || !isObject(doc.root)) throw new MindmapImportError('Filen är trasig: kartan saknas i den.');
  const clean = sanitizeMindmapDoc(doc);
  const name = typeof value.name === 'string' ? value.name : '';
  return { name: cleanMindmapName(name, cleanMindmapName(clean.root.label, fallbackName)), doc: clean };
}

const looksLikeMindmup = (value: Record<string, unknown>): boolean =>
  'formatVersion' in value || 'ideas' in value || 'title' in value;

/**
 * Läser en fil som ska bli en ny karta: sidans eget format eller MindMup.
 * Formen avgör, inte ändelsen. Kastar MindmapImportError.
 */
export function parseMindmapFile(text: string, fileName: string): { name: string; doc: MindmapDoc; kind: MindmapFileKind } {
  if (!text.trim()) throw new MindmapImportError('Filen är tom.');
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new MindmapImportError('Filen går inte att läsa: den är inte JSON.');
  }
  const fallbackName = importNameFromFile(fileName);
  try {
    if (isObject(raw) && raw.format === MINDMAP_FILE_FORMAT) return { ...parseOwnFile(raw, fallbackName), kind: 'json' };
    if (isObject(raw) && looksLikeMindmup(raw)) return { ...parseMindmup(raw, fallbackName), kind: 'mup' };
  } catch (e) {
    if (e instanceof MindmapImportError) throw e;
    // Ett fel i läsaren ska inte visa en engelsk text.
    throw new MindmapImportError('Filen gick inte att läsa.');
  }
  throw new MindmapImportError('Filen är varken en MindMup-karta (.mup) eller en karta sparad från den här sidan (.json).');
}

/** Exportens filnamn: kartans namn, annars rotens text. */
export function mindmapExportName(title: string, rootLabel: string, extension: string): string {
  return `${toFileSlug(title || rootLabel, 'mindmap')}.${extension}`;
}

/**
 * Alt+Shift+C kopierar kartan som bild. Läses med `code`: Alt ger ett
 * specialtecken i `key` på Mac. Inte Ctrl+Shift+C, som öppnar inspektören.
 */
export function isCopyImageKey(e: { code: string; altKey: boolean; shiftKey: boolean; ctrlKey: boolean; metaKey: boolean }): boolean {
  return e.altKey && e.shiftKey && !e.ctrlKey && !e.metaKey && e.code === 'KeyC';
}
