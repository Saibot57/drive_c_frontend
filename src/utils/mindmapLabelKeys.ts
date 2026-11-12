import type { WrappedLine } from '@/utils/mindmap/mindmapLayout';

/*
 * Tangenterna för en etikett på flera rader, medan man skriver i en nod på
 * Mindmap-sidan (docs/plans/mindmap-radbrytning.md). Läses före
 * resolveMindmapKey, som är delad med workspace-kortet och inte ändras:
 * kortet har inga radbrytningar.
 */

export type MindmapLabelKey = 'newline' | 'lineUp' | 'lineDown';

export interface LabelKeyInput {
  key: string;
  shiftKey: boolean;
  altKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  isComposing?: boolean;
}

/**
 * `newline`: Ctrl+Enter (Cmd+Enter på Mac) ger en ny rad i noden.
 * `lineUp` och `lineDown`: ↑ eller ↓ när det finns en rad i noden åt det
 * hållet. Då flyttar fältet markören själv; först på första och sista raden
 * går pilen vidare till nästa nod, som i en nod på en rad.
 */
export function resolveLabelKey(
  e: LabelKeyInput,
  caret: { line: number; lineCount: number },
): MindmapLabelKey | null {
  if (e.isComposing) return null;
  const mod = e.ctrlKey || e.metaKey;
  if (e.key === 'Enter') return mod && !e.altKey && !e.shiftKey ? 'newline' : null;
  if (mod || e.altKey || e.shiftKey) return null;
  if (e.key === 'ArrowUp') return caret.line > 0 ? 'lineUp' : null;
  if (e.key === 'ArrowDown') return caret.line < caret.lineCount - 1 ? 'lineDown' : null;
  return null;
}

/** Raden markören står på, räknat på layoutens rader. */
export function caretLine(lines: WrappedLine[], caret: number): number {
  let line = 0;
  lines.forEach((candidate, index) => {
    if (candidate.start <= caret) line = index;
  });
  return line;
}

/** Etiketten med en radbrytning i stället för det markerade, och markörens nya plats. */
export function insertNewline(label: string, start: number, end: number): { label: string; caret: number } {
  const from = Math.max(0, Math.min(start, end, label.length));
  const to = Math.max(from, Math.min(Math.max(start, end), label.length));
  return { label: `${label.slice(0, from)}\n${label.slice(to)}`, caret: from + 1 };
}
