/**
 * useTerminalEngine.ts
 *
 * Orchestrates:
 *   terminalParser        →  parseCommand()
 *   commandCenterService  →  API calls
 *
 * Exposes a clean surface for the TerminalPanel UI component plus
 * refresh keys that sibling panels (NotesBasket, TodoList) can watch.
 */

import { useCallback, useRef, useState } from 'react';
import { parseCommand }              from '@/lib/terminalParser';
import { commandCenterService }      from '@/services/commandCenterService';
import type { CCNote, CCTodo }       from '@/services/commandCenterService';

// ─── Public types ─────────────────────────────────────────────────────────────

export type LineKind = 'input' | 'success' | 'error' | 'info' | 'system';

export interface TerminalLine {
  id:        string;
  kind:      LineKind;
  text:      string;
  timestamp: Date;
  meta?:     Record<string, unknown>;
}

export interface UseTerminalEngine {
  // Terminal UI
  lines:          TerminalLine[];
  input:          string;
  setInput:       (v: string) => void;
  isLoading:      boolean;
  submit:         () => Promise<void>;
  clear:          () => void;
  historyBack:    () => void;
  historyForward: () => void;
  // Cross-panel refresh signals (increment on data change)
  noteRefreshKey: number;
  todoRefreshKey: number;
  refreshNotes:   () => void;
  // Edit modal coordination
  editTarget:      string | null;
  setEditTarget:   (id: string) => void;
  clearEditTarget: () => void;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const MAX_HISTORY = 50;

const HELP_TEXT = `Kommandon:
  note "Titel" [--mall <mallnamn>]   Skapa anteckning (valfri mall)
  todo "Text" --week                  Skapa todo (aktuell vecka)
  todo "Text" --week <N>              Skapa todo (vecka N)
  todo "Text" --date YYYY-MM-DD       Skapa todo (specifikt datum)
  edit <id>                           Öppna redigerare för anteckning
  rm <id>                             Ta bort anteckning eller todo
  clear                               Rensa terminalen
  help                                Visa den här hjälptexten`.trim();

// ─── Helpers ──────────────────────────────────────────────────────────────────

let _counter = 0;
function makeLine(
  kind: LineKind,
  text: string,
  meta?: Record<string, unknown>,
): TerminalLine {
  return { id: String(++_counter), kind, text, timestamp: new Date(), meta };
}

function noteCreatedLine(note: CCNote): TerminalLine {
  return makeLine(
    'success',
    `✓ Anteckning skapad — "${note.title}" [id: ${note.id}]`,
    { resourceType: 'note', id: note.id },
  );
}

function todoCreatedLine(todo: CCTodo): TerminalLine {
  const where =
    todo.type === 'week'
      ? `vecka ${todo.week_number}`
      : todo.target_date ?? '?';
  return makeLine(
    'success',
    `✓ Todo skapad — "${todo.content}" → ${where} [id: ${todo.id}]`,
    { resourceType: 'todo', id: todo.id },
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useTerminalEngine(): UseTerminalEngine {
  const [lines, setLines]           = useState<TerminalLine[]>(() => [
    makeLine('system', 'Command Center v1.0 — skriv help för kommandon.'),
  ]);
  const [input, setInput]           = useState('');
  const [isLoading, setLoading]     = useState(false);
  const [noteRefreshKey, setNoteRefreshKey] = useState(0);
  const [todoRefreshKey, setTodoRefreshKey] = useState(0);
  const [editTarget, setEditTargetState]    = useState<string | null>(null);

  const cmdHistory = useRef<string[]>([]);
  const historyIdx = useRef<number>(-1);

  // ── Helpers ────────────────────────────────────────────────────────────────

  const pushLines = useCallback((...newLines: TerminalLine[]) => {
    setLines(prev => [...prev, ...newLines]);
  }, []);

  const clear = useCallback(() => {
    setLines([makeLine('system', 'Terminal rensad.')]);
  }, []);

  const refreshNotes = useCallback(() => setNoteRefreshKey(k => k + 1), []);

  const setEditTarget   = useCallback((id: string)  => setEditTargetState(id),   []);
  const clearEditTarget = useCallback(()             => setEditTargetState(null), []);

  // ── History navigation ─────────────────────────────────────────────────────

  const historyBack = useCallback(() => {
    const hist = cmdHistory.current;
    if (!hist.length) return;
    const next = Math.min(historyIdx.current + 1, hist.length - 1);
    historyIdx.current = next;
    setInput(hist[next]);
  }, []);

  const historyForward = useCallback(() => {
    const next = historyIdx.current - 1;
    if (next < 0) { historyIdx.current = -1; setInput(''); return; }
    historyIdx.current = next;
    setInput(cmdHistory.current[next]);
  }, []);

  // ── Command dispatch ───────────────────────────────────────────────────────

  const submit = useCallback(async () => {
    const raw = input.trim();
    if (!raw || isLoading) return;

    pushLines(makeLine('input', `$ ${raw}`));
    setInput('');

    if (cmdHistory.current[0] !== raw) {
      cmdHistory.current = [raw, ...cmdHistory.current].slice(0, MAX_HISTORY);
    }
    historyIdx.current = -1;

    const result = parseCommand(raw);
    if (!result.ok) {
      pushLines(makeLine('error', result.message));
      return;
    }

    const cmd = result.command;

    // ── Builtins ────────────────────────────────────────────────────────────
    if (cmd.kind === 'help')  { pushLines(makeLine('info', HELP_TEXT)); return; }
    if (cmd.kind === 'clear') { clear(); return; }

    if (cmd.kind === 'edit') {
      pushLines(makeLine('info', `📝 Öppnar redigerare för: ${cmd.id}`));
      setEditTargetState(cmd.id);
      return;
    }

    // ── API commands ────────────────────────────────────────────────────────
    setLoading(true);
    try {
      switch (cmd.kind) {

        case 'note': {
          let templateId: string | undefined;
          let content:    string | undefined;

          if (cmd.template) {
            // Resolve template name → id + skeleton (fresh fetch, no staleness)
            let templates;
            try {
              templates = await commandCenterService.getTemplates();
            } catch (e) {
              const msg = e instanceof Error ? e.message : 'Okänt fel';
              pushLines(makeLine('error', `✗ Kunde inte hämta mallar: ${msg}`));
              break;
            }
            const found = templates.find(
              t => t.name.toLowerCase() === cmd.template!.toLowerCase(),
            );
            if (!found) {
              pushLines(makeLine('error',
                `✗ Mall "${cmd.template}" hittades inte. Skapa den via Mallar-knappen.`,
              ));
              break;
            }
            templateId = found.id;
            content    = found.skeleton ?? undefined;
          }

          const note = await commandCenterService.createNote(cmd.title, { templateId, content });
          pushLines(noteCreatedLine(note));
          setNoteRefreshKey(k => k + 1);
          break;
        }

        case 'todo': {
          const todo: CCTodo =
            cmd.mode === 'week'
              ? await commandCenterService.createTodo(cmd.text, {
                  type:        'week',
                  week_number: cmd.week,
                })
              : await commandCenterService.createTodo(cmd.text, {
                  type:        'date',
                  target_date: cmd.date,
                });
          pushLines(todoCreatedLine(todo));
          setTodoRefreshKey(k => k + 1);
          break;
        }

        case 'rm': {
          const resourceType = await commandCenterService.deleteAny(cmd.id);
          const label = resourceType === 'note' ? 'Anteckning' : 'Todo';
          pushLines(makeLine(
            'success',
            `✓ ${label} borttagen [id: ${cmd.id}]`,
            { resourceType, id: cmd.id },
          ));
          // Refresh both panels — we don't know which was deleted
          setNoteRefreshKey(k => k + 1);
          setTodoRefreshKey(k => k + 1);
          break;
        }
      }
    } catch (err) {
      pushLines(makeLine('error', `✗ ${err instanceof Error ? err.message : 'Okänt fel.'}`));
    } finally {
      setLoading(false);
    }
  }, [input, isLoading, pushLines, clear]);

  return {
    lines, input, setInput, isLoading,
    submit, clear, historyBack, historyForward,
    noteRefreshKey, todoRefreshKey, refreshNotes,
    editTarget, setEditTarget, clearEditTarget,
  };
}
