/**
 * terminalParser.ts — pure, side-effect-free command parser.
 *
 * Supported syntax:
 *   note "Titel" [--mall <mallnamn>]          (alias: n)
 *   todo "Text" --week [N]                    (alias: t)
 *   todo "Text" --date <datum>                (alias: t)
 *   todo "Text" --denna [vecka]               (alias: t)
 *   done <id>                                 (alias: d)
 *   edit <id>                                 (alias: e)
 *   rm <id>                                   (alias: r)
 *   help | clear                              (alias: h | c)
 *
 * Smart dates for --date: idag, imorgon, igår, måndag–söndag, YYYY-MM-DD
 */

// ─── Result types ────────────────────────────────────────────────────────────

export type NoteCommand = {
  kind: 'note';
  title: string;
  template: string | null;
};

export type TodoCommand =
  | { kind: 'todo'; text: string; mode: 'week'; week: number }
  | { kind: 'todo'; text: string; mode: 'date'; date: string };

export type RmCommand   = { kind: 'rm';   id: string };
export type DoneCommand = { kind: 'done'; id: string };
export type EditCommand = { kind: 'edit'; id: string };
export type HelpCommand  = { kind: 'help' };
export type ClearCommand = { kind: 'clear' };

export type ParsedCommand =
  | NoteCommand | TodoCommand | RmCommand | DoneCommand
  | EditCommand | HelpCommand | ClearCommand;

export type ParseSuccess = { ok: true;  command: ParsedCommand };
export type ParseFailure = { ok: false; message: string };
export type ParseResult  = ParseSuccess | ParseFailure;

// ─── Aliases & exported constants (used by autocomplete) ─────────────────────

export const ALIASES: Record<string, string> = {
  n: 'note', t: 'todo', d: 'done', r: 'rm',
  e: 'edit', h: 'help', c: 'clear',
};

export const COMMAND_NAMES = ['note', 'todo', 'done', 'edit', 'rm', 'help', 'clear'];

export const TODO_FLAGS = ['--week', '--date', '--denna'];

export const SMART_DATES = [
  'idag', 'imorgon', 'igår',
  'måndag', 'tisdag', 'onsdag', 'torsdag', 'fredag', 'lördag', 'söndag',
];

// ─── Internal helpers ─────────────────────────────────────────────────────────

/**
 * Extract a double-quoted string (with \" escape support) from the start of
 * `s`. Returns [unescaped-value, remainder] or null if no quoted string found.
 */
function extractQuoted(s: string): [string, string] | null {
  // Match: opening quote, content (no unescaped quote), closing quote, optional trailing
  const m = s.match(/^"((?:[^"\\]|\\.)*)"(.*)/s);
  if (!m) return null;
  const value    = m[1].replace(/\\"/g, '"').replace(/\\\\/g, '\\');
  const trailing = m[2].trim();
  return [value, trailing];
}

/** ISO 8601 week number for today. */
function currentISOWeek(): number {
  const now     = new Date();
  const jan4    = new Date(now.getFullYear(), 0, 4);            // Jan 4 is always in week 1
  const dayOfW  = (jan4.getDay() + 6) % 7;                     // Mon=0 … Sun=6
  const weekStart = new Date(jan4.getTime() - dayOfW * 86_400_000);
  return Math.floor((now.getTime() - weekStart.getTime()) / (7 * 86_400_000)) + 1;
}

/** Verify YYYY-MM-DD format and that the date is calendar-valid. */
function isValidDate(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s));
}

/** Format a Date as YYYY-MM-DD. */
function toISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const SWEDISH_DAYS: Record<string, number> = {
  'måndag': 1, 'tisdag': 2, 'onsdag': 3, 'torsdag': 4,
  'fredag': 5, 'lördag': 6, 'söndag': 0,
};

/**
 * Resolve a Swedish date expression to YYYY-MM-DD.
 * Supports: idag, imorgon, igår, måndag–söndag (next occurrence).
 * Returns null if not recognized.
 */
export function resolveSwedishDate(s: string): string | null {
  const lower = s.toLowerCase();
  const now = new Date();

  if (lower === 'idag')    return toISO(now);
  if (lower === 'imorgon') { const d = new Date(now); d.setDate(d.getDate() + 1); return toISO(d); }
  if (lower === 'igår')    { const d = new Date(now); d.setDate(d.getDate() - 1); return toISO(d); }

  const targetDay = SWEDISH_DAYS[lower];
  if (targetDay !== undefined) {
    const today = now.getDay(); // 0=Sun
    let diff = targetDay - today;
    if (diff <= 0) diff += 7; // always next occurrence (not today)
    const d = new Date(now);
    d.setDate(d.getDate() + diff);
    return toISO(d);
  }

  return null;
}

function fail(message: string): ParseFailure { return { ok: false, message }; }
function ok(command: ParsedCommand): ParseSuccess { return { ok: true, command }; }

// ─── Sub-parsers ──────────────────────────────────────────────────────────────

function parseNote(rest: string): ParseResult {
  const quoted = extractQuoted(rest);
  if (!quoted) return fail('Syntax: note "Titel" [--mall <mallnamn>]');

  const [title, flags] = quoted;
  if (!title.trim()) return fail('Titeln får inte vara tom.');

  if (!flags) return ok({ kind: 'note', title: title.trim(), template: null });

  const mallMatch = flags.match(/^--mall\s+(\S+)$/);
  if (!mallMatch) return fail(`Okänd flagga: "${flags}". Syntax: note "Titel" [--mall <mallnamn>]`);

  return ok({ kind: 'note', title: title.trim(), template: mallMatch[1] });
}

function parseTodo(rest: string): ParseResult {
  const quoted = extractQuoted(rest);
  if (!quoted) return fail('Syntax: todo "Text" --week [N]  |  todo "Text" --date <datum>');

  const [text, flags] = quoted;
  if (!text.trim()) return fail('Texten får inte vara tom.');
  if (!flags)       return fail('Ange --week [N], --date <datum>, eller --denna.');

  // --denna / --denna vecka  →  current ISO week
  if (flags === '--denna' || flags === '--denna vecka') {
    return ok({ kind: 'todo', text: text.trim(), mode: 'week', week: currentISOWeek() });
  }

  // --week (current week)
  if (flags === '--week') {
    return ok({ kind: 'todo', text: text.trim(), mode: 'week', week: currentISOWeek() });
  }

  // --week N (explicit week number)
  const weekNMatch = flags.match(/^--week\s+(\d+)$/);
  if (weekNMatch) {
    const w = parseInt(weekNMatch[1], 10);
    if (w < 1 || w > 53) return fail('Veckonumret måste vara 1–53.');
    return ok({ kind: 'todo', text: text.trim(), mode: 'week', week: w });
  }

  // --date <value>  (YYYY-MM-DD or Swedish expression)
  const dateMatch = flags.match(/^--date\s+(\S+)$/);
  if (dateMatch) {
    const raw = dateMatch[1];

    // Try Swedish date first
    const resolved = resolveSwedishDate(raw);
    if (resolved) {
      return ok({ kind: 'todo', text: text.trim(), mode: 'date', date: resolved });
    }

    // Fall back to YYYY-MM-DD
    if (!isValidDate(raw)) {
      return fail(`Ogiltigt datum: "${raw}". Använd YYYY-MM-DD eller: idag, imorgon, måndag–söndag.`);
    }
    return ok({ kind: 'todo', text: text.trim(), mode: 'date', date: raw });
  }

  return fail(`Okänd flagga: "${flags}". Använd --week [N], --date <datum>, eller --denna.`);
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function parseCommand(raw: string): ParseResult {
  const input = raw.trim();
  if (!input) return fail('Tom rad.');

  // Tokenise first word + resolve alias
  const spaceIdx = input.indexOf(' ');
  const rawVerb  = spaceIdx === -1 ? input : input.slice(0, spaceIdx);
  const verb     = ALIASES[rawVerb.toLowerCase()] ?? rawVerb.toLowerCase();
  const rest     = spaceIdx === -1 ? ''    : input.slice(spaceIdx + 1).trimStart();

  // Builtins (support both bare word and alias)
  if (verb === 'help'  && !rest) return ok({ kind: 'help' });
  if (verb === 'clear' && !rest) return ok({ kind: 'clear' });

  switch (verb) {
    case 'note': return parseNote(rest);
    case 'todo': return parseTodo(rest);
    case 'done': {
      if (!rest) return fail('Syntax: done <id>');
      if (/\s/.test(rest)) return fail('done tar exakt ett id. Syntax: done <id>');
      return ok({ kind: 'done', id: rest });
    }
    case 'rm': {
      if (!rest) return fail('Syntax: rm <id>');
      if (/\s/.test(rest)) return fail('rm tar exakt ett id. Syntax: rm <id>');
      return ok({ kind: 'rm', id: rest });
    }
    case 'edit': {
      if (!rest) return fail('Syntax: edit <id>');
      if (/\s/.test(rest)) return fail('edit tar exakt ett id. Syntax: edit <id>');
      return ok({ kind: 'edit', id: rest });
    }
    default:
      return fail(`Okänt kommando: "${rawVerb}". Skriv help för alla kommandon.`);
  }
}
