import type { MindmapNode } from '../types/mindmap.types';
import { createNode } from './mindmapTree';

/*
 * Mindmap som disposition, åt båda hållen. Ut går den som HTML och ren text
 * till urklipp: Google Docs klistrar in HTML-listan som riktiga punkter i
 * flera nivåer, eller som rubriker. In tas en indenterad text eller en
 * HTML-lista — det man får när man kopierar en punktlista ur ett dokument.
 */

export type OutlineStyle = 'list' | 'headings';

const escapeHtml = (text: string) =>
  text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/** Tomma noder utan barn är bara skräp i ett dokument och hoppas över. */
const meaningful = (node: MindmapNode): boolean =>
  node.label.trim() !== '' || node.children.some(meaningful);

/** Indenterad text: noden först, sedan barnen som "- " med två blanksteg per nivå. */
export function toOutlineText(node: MindmapNode): string {
  const lines = [node.label.trim()];
  const walk = (children: MindmapNode[], depth: number) => {
    children.filter(meaningful).forEach((child) => {
      lines.push(`${'  '.repeat(depth)}- ${child.label.trim()}`);
      walk(child.children, depth + 1);
    });
  };
  walk(node.children, 0);
  return lines.join('\n');
}

function listHtml(children: MindmapNode[]): string {
  const items = children.filter(meaningful);
  if (items.length === 0) return '';
  return `<ul>${items
    .map((child) => `<li>${escapeHtml(child.label.trim())}${listHtml(child.children)}</li>`)
    .join('')}</ul>`;
}

/**
 * `list`: noden i fetstil och allt under den som punkter i nivåer.
 * `headings`: noden blir rubrik 1, barnen rubrik 2, barnbarnen rubrik 3 och
 * det som ligger djupare punkter — en planering att skriva vidare i.
 */
export function toOutlineHtml(node: MindmapNode, style: OutlineStyle): string {
  const title = escapeHtml(node.label.trim());
  if (style === 'list') {
    return `<p><strong>${title}</strong></p>${listHtml(node.children)}`;
  }
  const parts = [`<h1>${title}</h1>`];
  node.children.filter(meaningful).forEach((child) => {
    parts.push(`<h2>${escapeHtml(child.label.trim())}</h2>`);
    child.children.filter(meaningful).forEach((grandchild) => {
      parts.push(`<h3>${escapeHtml(grandchild.label.trim())}</h3>`);
      parts.push(listHtml(grandchild.children));
    });
  });
  return parts.join('');
}

/* ── In ──────────────────────────────────────────────────────────────────── */

const BULLET = /^(?:[-*•◦▪‣·–]|\d+[.)]|[a-zA-Z][.)])\s+/;

/** Bygger ett träd av rader med en nivå var. Ett hopp över en nivå blir en nivå. */
function buildForest(rows: { level: number; label: string }[]): MindmapNode[] {
  const forest: MindmapNode[] = [];
  const stack: { level: number; node: MindmapNode }[] = [];
  rows.forEach(({ level, label }) => {
    const node = createNode(label);
    while (stack.length > 0 && stack[stack.length - 1].level >= level) stack.pop();
    const parent = stack[stack.length - 1];
    if (parent) parent.node.children.push(node);
    else forest.push(node);
    stack.push({ level, node });
  });
  return forest;
}

/**
 * Indenterad text till noder. Tab räknas som fyra blanksteg. Punkter, siffror
 * och bokstäver i början av raden tas bort.
 */
export function parseOutlineText(text: string): MindmapNode[] {
  const rows = text
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => {
      const indent = line.match(/^[ \t]*/)?.[0] ?? '';
      const trimmed = line.trim();
      const bullet = BULLET.test(trimmed);
      // En punkt räknas som ett steg in. Då blir "Rubrik" följd av "- Punkt"
      // rubrik och punkt under den, vilket är vad den som skrev menade.
      const level = indent.replace(/\t/g, '    ').length + (bullet ? 1 : 0);
      const label = trimmed.replace(BULLET, '').trim();
      return { level, label };
    })
    .filter((row) => row.label !== '');
  return buildForest(rows);
}

/**
 * En HTML-lista till noder. Google Docs lägger alla punkter i platta listor
 * och anger nivån i `aria-level`; andra program nästlar listorna. Båda läses.
 * Ger `null` om det inte finns någon lista, så att anroparen kan ta texten.
 */
export function parseOutlineHtml(doc: Document): MindmapNode[] | null {
  const items = Array.from(doc.querySelectorAll('li'));
  if (items.length === 0) return null;
  const rows = items
    .map((item) => {
      const aria = Number(item.getAttribute('aria-level'));
      let level = 0;
      if (Number.isFinite(aria) && aria > 0) {
        level = aria;
      } else {
        for (let el = item.parentElement; el; el = el.parentElement) {
          if (el.tagName === 'UL' || el.tagName === 'OL') level += 1;
        }
      }
      const own = item.cloneNode(true) as HTMLElement;
      own.querySelectorAll('ul, ol').forEach((list) => list.remove());
      return { level, label: (own.textContent ?? '').replace(/\s+/g, ' ').trim() };
    })
    .filter((row) => row.label !== '');
  return rows.length > 0 ? buildForest(rows) : null;
}
