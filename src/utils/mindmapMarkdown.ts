import type { MindmapNode } from '@/types/mindmap';
import type { MindmapDoc } from '@/types/mindmapDoc';
import { crossLinkLines } from '@/utils/mindmapCrossLinks';

/*
 * Kartan som Markdown, till en `.md`-fil. Roten blir rubrik 1, dess barn
 * rubrik 2 och barnbarnen rubrik 3; det som ligger djupare blir punkter med
 * två blanksteg indrag per nivå. En anteckning blir ett stycke under sin
 * rubrik eller punkt, en länk `[etikett](url)`. Hopfällda grenar tas med,
 * som i dispositionen. Tvärlänkarna står i en lista sist.
 */

/** Skyddar tecken som annars blir formatering i Markdown. */
export function escapeMarkdown(text: string): string {
  return text
    .replace(/([\\`*_[\]<>#])/g, '\\$1')
    // En rad som börjar som en lista blir annars en lista.
    .replace(/^([-+])(\s)/, '\\$1$2')
    .replace(/^(\d+)([.)])(\s|$)/, '$1\\$2$3');
}

/** Tecken som bryter `(url)` kodas. */
const markdownUrl = (url: string): string =>
  url.replace(/[()<> ]/g, (ch) => `%${ch.charCodeAt(0).toString(16).toUpperCase().padStart(2, '0')}`);

const include = (node: MindmapNode): boolean =>
  node.label.trim() !== '' || !!node.link || !!node.note?.trim() || node.children.some(include);

const textOf = (node: MindmapNode): string => {
  const label = node.label.trim();
  if (!node.link) return escapeMarkdown(label);
  return `[${escapeMarkdown(label || node.link)}](${markdownUrl(node.link)})`;
};

/** Anteckningens rader, med en hård radbrytning (`\` sist) mellan dem. */
const noteLines = (node: MindmapNode, indent: string): string[] => {
  const lines = (node.note ?? '').split(/\r?\n/).map((line) => line.trim()).filter(Boolean).map(escapeMarkdown);
  return lines.map((line, index) => `${indent}${line}${index < lines.length - 1 ? '\\' : ''}`);
};

export function toMindmapMarkdown(doc: MindmapDoc): string {
  const lines: string[] = [];
  const blank = () => {
    if (lines.length > 0 && lines[lines.length - 1] !== '') lines.push('');
  };

  const walk = (node: MindmapNode, depth: number) => {
    if (depth > 0 && !include(node)) return;
    const note = noteLines(node, depth <= 2 ? '' : `${'  '.repeat(depth - 3)}  `);
    if (depth <= 2) {
      blank();
      lines.push(`${'#'.repeat(depth + 1)} ${textOf(node)}`, '');
      if (note.length) lines.push(...note, '');
    } else {
      lines.push(`${'  '.repeat(depth - 3)}- ${textOf(node)}`);
      if (note.length) lines.push('', ...note, '');
    }
    node.children.forEach((child) => walk(child, depth + 1));
  };
  walk(doc.root, 0);

  const links = crossLinkLines(doc);
  if (links.length) {
    blank();
    lines.push('**Länkar**', '', ...links.map((line) => `- ${escapeMarkdown(line)}`));
  }

  while (lines.length && lines[lines.length - 1] === '') lines.pop();
  return `${lines.join('\n')}\n`;
}
