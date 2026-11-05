import { MINDMAP_COLORS, type MindmapColor } from '../types/mindmap.types';
import type { Direction } from './mindmapTree';

/*
 * Mindmapens kortkommandon, som en ren funktion från tangent till handling.
 * Editorn har två lägen:
 *
 *   nav   En nod är markerad och kartan har fokus. Pilarna går mellan noderna,
 *         och att börja skriva skriver över noden, som i MindMup.
 *   edit  Markören står i en nods textfält. Enter och Tab skapar nästa nod och
 *         fortsätter skriva i den, så att en hel karta kan skrivas utan mus.
 */

export type MindmapMode = 'nav' | 'edit';

export type MindmapAction =
  | { type: 'addChild' }
  | { type: 'addSibling'; where: 'before' | 'after' }
  | { type: 'indent' }
  | { type: 'outdent' }
  | { type: 'navigate'; direction: Direction }
  | { type: 'move'; direction: Direction }
  | { type: 'edit'; replaceWith?: string }
  | { type: 'finishEdit' }
  | { type: 'leave' }
  | { type: 'remove' }
  | { type: 'toggleCollapse' }
  | { type: 'color'; color: MindmapColor | null }
  | { type: 'undo' }
  | { type: 'redo' }
  | { type: 'copy' }
  | { type: 'cut' }
  /** Släpps igenom till webbläsaren, så att paste-händelsen kommer fram. */
  | { type: 'paste' };

export interface MindmapKeyInput {
  key: string;
  code: string;
  shiftKey: boolean;
  altKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  isComposing?: boolean;
}

export interface MindmapKeyContext {
  isRoot: boolean;
  parentIsRoot: boolean;
  /** Etiketten är tom. Gäller bara i edit-läget. */
  labelEmpty: boolean;
  hasChildren: boolean;
  /** Det finns ett syskon ovanför på samma sida, som noden kan dras in under. */
  hasPreviousSibling: boolean;
}

const ARROWS: Record<string, Direction> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
};

const COLOR_DIGITS: Record<string, MindmapColor | null> = {
  Digit0: null,
  ...Object.fromEntries(MINDMAP_COLORS.map((color, index) => [`Digit${index + 1}`, color])),
};

/** Ctrl+Z och Ctrl+Y gäller i båda lägena. Cmd räknas som Ctrl på Mac. */
function historyAction(e: MindmapKeyInput): MindmapAction | null {
  if (!(e.ctrlKey || e.metaKey) || e.altKey) return null;
  const key = e.key.toLowerCase();
  if (key === 'z') return { type: e.shiftKey ? 'redo' : 'undo' };
  if (key === 'y' && !e.shiftKey) return { type: 'redo' };
  return null;
}

export function resolveMindmapKey(
  e: MindmapKeyInput,
  mode: MindmapMode,
  ctx: MindmapKeyContext,
): MindmapAction | null {
  if (e.isComposing) return null;

  const history = historyAction(e);
  if (history) return history;

  const mod = e.ctrlKey || e.metaKey;
  const plain = !mod && !e.altKey;
  const leaf = !ctx.hasChildren;

  if (mode === 'edit') {
    if (!plain) return null;
    switch (e.key) {
      case 'Enter':
        if (e.shiftKey) return { type: 'addSibling', where: 'before' };
        // Enter på en tom nod lyfter den, som i en punktlista. Under roten
        // finns ingen nivå att lyfta till, och då avslutas skrivandet.
        if (ctx.labelEmpty && leaf && !ctx.isRoot) {
          return ctx.parentIsRoot ? { type: 'finishEdit' } : { type: 'outdent' };
        }
        return { type: 'addSibling', where: 'after' };
      case 'Tab':
        if (e.shiftKey) return { type: 'outdent' };
        // Tab på en nod man just skapat med Enter drar in den under noden
        // ovanför. Samma resultat som Tab direkt, men flödet tål båda.
        if (ctx.labelEmpty && leaf && ctx.hasPreviousSibling) return { type: 'indent' };
        return { type: 'addChild' };
      case 'Escape':
        return { type: 'finishEdit' };
      case 'ArrowUp':
      case 'ArrowDown':
        return e.shiftKey ? null : { type: 'navigate', direction: ARROWS[e.key] };
      case 'Backspace':
        return ctx.labelEmpty && leaf && !ctx.isRoot && !e.shiftKey ? { type: 'remove' } : null;
      default:
        return null;
    }
  }

  // Nav-läget.
  if (mod && !e.altKey && !e.shiftKey) {
    const key = e.key.toLowerCase();
    if (key === 'c') return { type: 'copy' };
    if (key === 'x') return { type: 'cut' };
    if (key === 'v') return { type: 'paste' };
  }

  if (e.altKey && !mod) {
    if (ARROWS[e.key]) return { type: 'move', direction: ARROWS[e.key] };
    // e.code och inte e.key: Alt+siffra ger ett specialtecken på Mac.
    if (e.code in COLOR_DIGITS) return { type: 'color', color: COLOR_DIGITS[e.code] };
  }

  if (!mod && !e.altKey) {
    if (ARROWS[e.key] && !e.shiftKey) return { type: 'navigate', direction: ARROWS[e.key] };
    switch (e.key) {
      case 'Enter':
        return { type: 'addSibling', where: e.shiftKey ? 'before' : 'after' };
      case 'Tab':
        return e.shiftKey ? { type: 'outdent' } : { type: 'addChild' };
      case 'F2':
        return { type: 'edit' };
      case 'Delete':
      case 'Backspace':
        return { type: 'remove' };
      case ' ':
        return { type: 'toggleCollapse' };
      case 'Escape':
        return { type: 'leave' };
      default:
        break;
    }
  }

  // Ett tecken börjar skriva över noden. AltGr ger Ctrl+Alt i Windows och
  // behövs för @, £ och { på ett svenskt tangentbord.
  const altGr = e.ctrlKey && e.altKey && !e.metaKey;
  if (e.key.length === 1 && e.key !== ' ' && (!mod && !e.altKey || altGr)) {
    return { type: 'edit', replaceWith: e.key };
  }
  return null;
}

/** Listan i hjälprutan. Håll den i takt med resolveMindmapKey. */
export const MINDMAP_SHORTCUTS: { group: string; items: { keys: string; what: string }[] }[] = [
  {
    group: 'Skriva',
    items: [
      { keys: 'Tab', what: 'Ny nod under (barn)' },
      { keys: 'Enter', what: 'Ny nod bredvid (syskon)' },
      { keys: 'Shift+Enter', what: 'Ny nod bredvid, ovanför' },
      { keys: 'Shift+Tab', what: 'Flytta upp en nivå' },
      { keys: 'Esc', what: 'Sluta skriva' },
      { keys: '↑ ↓', what: 'Skriv i noden ovanför eller nedanför' },
      { keys: 'Backspace', what: 'Ta bort en tom nod' },
    ],
  },
  {
    group: 'Markerad nod',
    items: [
      { keys: 'Pilar', what: 'Gå mellan noderna' },
      { keys: 'Skriv', what: 'Skriv över noden' },
      { keys: 'F2 / dubbelklick', what: 'Redigera noden' },
      { keys: 'Mellanslag', what: 'Fäll ihop eller ut grenen' },
      { keys: 'Delete', what: 'Ta bort noden med gren' },
      { keys: 'Alt+↑ ↓', what: 'Flytta bland syskonen' },
      { keys: 'Alt+← →', what: 'Flytta in eller ut en nivå' },
      { keys: 'Alt+1–6', what: 'Färg (Alt+0 tar bort)' },
      { keys: 'Ctrl+C / X / V', what: 'Kopiera, klipp ut, klistra in disposition' },
      { keys: 'Esc', what: 'Lämna kartan' },
    ],
  },
  {
    group: 'Överallt',
    items: [
      { keys: 'Ctrl+Z', what: 'Ångra' },
      { keys: 'Ctrl+Shift+Z / Ctrl+Y', what: 'Gör om' },
    ],
  },
];
