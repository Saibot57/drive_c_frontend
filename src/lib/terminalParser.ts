/**
 * terminalParser.ts — pure, side-effect-free command parser.
 *
 * Supported syntax:
 *   note "Titel" [--mall <mallnamn>]
 *   todo "Text" --week [N]
 *   todo "Text" --date YYYY-MM-DD
 *   rm <id>
 *   edit <id>
 *   help | clear
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

export type RmCommand = {
  kind: 'rm';
  id: string;
};

export type EditCommand  = { kind: 'edit'; id: string };
export type HelpCommand  = { kind: 'help' };
export type ClearCommand = { kind: 'clear' };

export type ParsedCommand = NoteCommand | TodoCommand | RmCommand | EditCommand | HelpCommand | ClearCommand;

export type ParseSuccess = { ok: true;  command: ParsedCommand };
export type ParseFailure = { ok: false; message: string };
export type ParseResult  = ParseSuccess | ParseFailure;

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
  if (!quoted) return fail('Syntax: todo "Text" --week [N]  |  todo "Text" --date YYYY-MM-DD');

  const [text, flags] = quoted;
  if (!text.trim()) return fail('Texten får inte vara tom.');
  if (!flags)       return fail('Ange --week [N] eller --date YYYY-MM-DD.');

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

  // --date YYYY-MM-DD
  const dateMatch = flags.match(/^--date\s+(\S+)$/);
  if (dateMatch) {
    const d = dateMatch[1];
    if (!isValidDate(d)) return fail(`Ogiltigt datum: "${d}". Använd formatet YYYY-MM-DD.`);
    return ok({ kind: 'todo', text: text.trim(), mode: 'date', date: d });
  }

  return fail(`Okänd flagga: "${flags}". Använd --week [N] eller --date YYYY-MM-DD.`);
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function parseCommand(raw: string): ParseResult {
  const input = raw.trim();
  if (!input) return fail('Tom rad.');

  // Builtins
  if (input === 'help')  return ok({ kind: 'help' });
  if (input === 'clear') return ok({ kind: 'clear' });

  // Tokenise first word
  const spaceIdx   = input.indexOf(' ');
  const verb       = spaceIdx === -1 ? input : input.slice(0, spaceIdx);
  const rest       = spaceIdx === -1 ? ''    : input.slice(spaceIdx + 1).trimStart();

  switch (verb) {
    case 'note': return parseNote(rest);
    case 'todo': return parseTodo(rest);
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
      return fail(`Okänt kommando: "${verb}". Skriv help för alla kommandon.`);
  }
}
