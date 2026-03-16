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
import { parseCommand, COMMAND_NAMES, ALIASES, TODO_FLAGS, SMART_DATES }
  from '@/lib/terminalParser';
import { commandCenterService }      from '@/services/commandCenterService';
import type { CCNote, CCTodo, CCTemplate } from '@/services/commandCenterService';

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
  // Tab-completion
  tabComplete:    () => void;
  suggestions:    string[];
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

const HELP_TEXT = `
  SKAPANDE
  note "Titel" [--mall <namn>]     Skapa anteckning
  todo "Text" --week [N]           Todo (vecka N, standard: denna)
  todo "Text" --date <datum>       Todo (datum: YYYY-MM-DD, idag, imorgon, fredag…)
  todo "Text" --denna              Todo (denna vecka, snabbkommando)

  HANTERING
  done <id>                        Markera todo som klar
  edit <id>                        Redigera anteckning
  rm <id>                          Ta bort anteckning eller todo

  SYSTEM
  help                             Visa denna hjälptext
  clear                            Rensa terminalen

  ALIAS: n=note  t=todo  d=done  e=edit  r=rm  h=help  c=clear
  DATUM: idag, imorgon, igår, måndag–söndag
  TAB:   Tryck Tab för autocompletions`.trim();

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

// ─── Tab-completion helpers ─────────────────────────────────────────────────

/** All command names + their aliases for first-word completion */
const ALL_FIRST_WORDS = [
  ...COMMAND_NAMES,
  ...Object.keys(ALIASES),
];

interface TabState {
  /** The input text when Tab was first pressed */
  prefix: string;
  /** Matching options */
  options: string[];
  /** Current cycle index */
  index: number;
}

function getCommandCompletions(partial: string): string[] {
  const lower = partial.toLowerCase();
  if (!lower) return COMMAND_NAMES; // show all commands when empty
  return ALL_FIRST_WORDS.filter(c => c.startsWith(lower) && c !== lower);
}

function getFlagCompletions(command: string, partial: string): string[] {
  if (command === 'todo') {
    const flags = TODO_FLAGS;
    if (!partial) return flags;
    return flags.filter(f => f.startsWith(partial));
  }
  if (command === 'note') {
    if (!partial || '--mall'.startsWith(partial)) return ['--mall'];
    return [];
  }
  return [];
}

function getDateCompletions(partial: string): string[] {
  if (!partial) return SMART_DATES;
  const lower = partial.toLowerCase();
  return SMART_DATES.filter(d => d.startsWith(lower));
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useTerminalEngine(): UseTerminalEngine {
  const [lines, setLines]           = useState<TerminalLine[]>(() => [
    makeLine('system', 'Command Center v2.0 — skriv help för kommandon. Tab för autocomplete.'),
  ]);
  const [input, setInput]           = useState('');
  const [isLoading, setLoading]     = useState(false);
  const [noteRefreshKey, setNoteRefreshKey] = useState(0);
  const [todoRefreshKey, setTodoRefreshKey] = useState(0);
  const [editTarget, setEditTargetState]    = useState<string | null>(null);
  const [suggestions, setSuggestions]       = useState<string[]>([]);

  const cmdHistory  = useRef<string[]>([]);
  const historyIdx  = useRef<number>(-1);
  const tabRef      = useRef<TabState | null>(null);
  const templateCacheRef = useRef<CCTemplate[] | null>(null);

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

  // Reset tab state on any input change
  const setInputAndResetTab = useCallback((v: string) => {
    setInput(v);
    tabRef.current = null;
    setSuggestions([]);
  }, []);

  // ── History navigation ─────────────────────────────────────────────────────

  const historyBack = useCallback(() => {
    const hist = cmdHistory.current;
    if (!hist.length) return;
    const next = Math.min(historyIdx.current + 1, hist.length - 1);
    historyIdx.current = next;
    setInputAndResetTab(hist[next]);
  }, [setInputAndResetTab]);

  const historyForward = useCallback(() => {
    const next = historyIdx.current - 1;
    if (next < 0) { historyIdx.current = -1; setInputAndResetTab(''); return; }
    historyIdx.current = next;
    setInputAndResetTab(cmdHistory.current[next]);
  }, [setInputAndResetTab]);

  // ── Tab-completion ────────────────────────────────────────────────────────

  const tabComplete = useCallback(() => {
    const raw = input;

    // If we're already cycling, advance to next option
    if (tabRef.current && tabRef.current.prefix === raw) {
      const st = tabRef.current;
      if (st.options.length === 0) return;
      st.index = (st.index + 1) % st.options.length;
      const completed = st.options[st.index];
      setInput(completed);
      tabRef.current = { ...st, prefix: completed };
      return;
    }

    // Determine context
    const trimmed = raw.trimStart();
    const firstSpace = trimmed.indexOf(' ');

    // Case 1: completing the command name
    if (firstSpace === -1) {
      const matches = getCommandCompletions(trimmed);
      if (matches.length === 0) { setSuggestions([]); return; }
      setSuggestions(matches);
      const completed = matches[0] + ' ';
      tabRef.current = {
        prefix: completed,
        options: matches.map(m => m + ' '),
        index: 0,
      };
      setInput(completed);
      return;
    }

    const command = (ALIASES[trimmed.slice(0, firstSpace).toLowerCase()] ?? trimmed.slice(0, firstSpace)).toLowerCase();
    const afterCmd = trimmed.slice(firstSpace + 1);

    // Case 2: after todo/note "text" — complete flags
    if ((command === 'todo' || command === 'note') && afterCmd.includes('"')) {
      // Find end of quoted string
      const quoteStart = afterCmd.indexOf('"');
      const afterQuoteStart = afterCmd.slice(quoteStart + 1);
      const quoteEnd = afterQuoteStart.indexOf('"');

      if (quoteEnd !== -1) {
        // We're past the quoted string — complete flags
        const flagPart = afterQuoteStart.slice(quoteEnd + 1).trim();
        const prefix = trimmed.slice(0, trimmed.length - flagPart.length);

        // Case 2a: after --date — complete smart dates
        const dateMatch = flagPart.match(/^--date\s+(.*)/);
        if (dateMatch && command === 'todo') {
          const datePart = dateMatch[1];
          const matches = getDateCompletions(datePart);
          if (matches.length === 0) { setSuggestions([]); return; }
          setSuggestions(matches);
          const base = prefix.replace(/--date\s+.*$/, '--date ');
          const completed = base + matches[0];
          tabRef.current = {
            prefix: completed,
            options: matches.map(m => base + m),
            index: 0,
          };
          setInput(completed);
          return;
        }

        // Case 2b: after --mall — complete template names
        const mallMatch = flagPart.match(/^--mall\s+(.*)/);
        if (mallMatch && command === 'note') {
          const partial = mallMatch[1];
          const templates = templateCacheRef.current;
          if (!templates) {
            // Fetch templates async, then retry
            commandCenterService.getTemplates().then(t => {
              templateCacheRef.current = t;
              // Show hint that templates are loaded
              const names = t.map(tp => tp.name);
              setSuggestions(names.length > 0 ? names : ['(inga mallar)']);
            }).catch(() => { /* ignore */ });
            setSuggestions(['Laddar mallar...']);
            return;
          }
          const names = templates.map(t => t.name);
          const matches = partial
            ? names.filter(n => n.toLowerCase().startsWith(partial.toLowerCase()))
            : names;
          if (matches.length === 0) { setSuggestions([]); return; }
          setSuggestions(matches);
          const base = prefix.replace(/--mall\s+.*$/, '--mall ');
          const completed = base + matches[0];
          tabRef.current = {
            prefix: completed,
            options: matches.map(m => base + m),
            index: 0,
          };
          setInput(completed);
          return;
        }

        // Case 2c: completing the flag itself (--week, --date, --denna, --mall)
        const matches = getFlagCompletions(command, flagPart);
        if (matches.length === 0) { setSuggestions([]); return; }
        setSuggestions(matches);
        const completed = prefix + matches[0] + (matches[0] === '--denna' ? '' : ' ');
        tabRef.current = {
          prefix: completed,
          options: matches.map(m => prefix + m + (m === '--denna' ? '' : ' ')),
          index: 0,
        };
        setInput(completed);
        return;
      }
    }

    setSuggestions([]);
  }, [input]);

  // ── Command dispatch ───────────────────────────────────────────────────────

  const submit = useCallback(async () => {
    const raw = input.trim();
    if (!raw || isLoading) return;

    pushLines(makeLine('input', `$ ${raw}`));
    setInput('');
    setSuggestions([]);
    tabRef.current = null;

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
            // Update cache for tab-completion
            templateCacheRef.current = templates;
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

        case 'done': {
          await commandCenterService.updateTodo(cmd.id, { status: 'done' });
          pushLines(makeLine(
            'success',
            `✓ Todo markerad som klar [id: ${cmd.id}]`,
            { resourceType: 'todo', id: cmd.id },
          ));
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
    lines, input, setInput: setInputAndResetTab, isLoading,
    submit, clear, historyBack, historyForward,
    tabComplete, suggestions,
    noteRefreshKey, todoRefreshKey, refreshNotes,
    editTarget, setEditTarget, clearEditTarget,
  };
}
