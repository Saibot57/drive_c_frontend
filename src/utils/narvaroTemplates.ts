/**
 * Sparade gruppindelningar i Närvarorutor ("indelningar" i UI:t). En
 * indelning har ett namn och grupper med elever, och kan läggas på vilket
 * pass som helst: de närvarande hamnar då i sina grupper. Planen finns i
 * `docs/plans/narvaro-sparade-grupper.md`.
 *
 * En elev i en indelning är namnet i arket utan klasstillägget som
 * `combineSheets` sätter på dubbletter, plus klassen hen kom från. Klassen
 * skiljer bara två elever med samma namn åt; en elev som bytt klass hittas
 * ändå på namnet när det är entydigt.
 */

import type { AttendancePerson, AttendanceTable, PassGroups } from '@/utils/narvaro';
import { classesOnDay, cleanGroupName } from '@/utils/narvaro';

export type TemplateMember = { name: string; klass: string };
export type TemplateGroup = { name: string; members: TemplateMember[] };
export type GroupTemplate = {
  id: string;
  name: string;
  groups: TemplateGroup[];
  /** ISO-tid för den senaste ändringen, för sorteringen. */
  updatedAt: string;
};

export const MAX_TEMPLATES = 50;
export const MAX_TEMPLATE_GROUPS = 30;
export const MAX_TEMPLATE_NAME_LENGTH = 40;

export const cleanTemplateName = (name: string) =>
  name.replace(/\s+/g, ' ').trim().slice(0, MAX_TEMPLATE_NAME_LENGTH);

/** Som `newNodeId` i mindmapTree: `randomUUID` saknas i äldre Safari och utan säker kontext. */
export function newTemplateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

type Person = Pick<AttendancePerson, 'name' | 'klass'>;

const klassOf = (p: Person) => p.klass ?? '';
const suffix = (klass: string) => ` (${klass || 'utan klass'})`;

/** Namnet utan det klasstillägg `combineSheets` satt efter det. */
export function baseName(p: Person): string {
  if (p.klass === undefined) return p.name;
  const s = suffix(p.klass);
  return p.name.endsWith(s) && p.name.length > s.length ? p.name.slice(0, -s.length) : p.name;
}

const memberKey = (m: TemplateMember) => `${m.klass}\u0000${m.name}`;
const toMember = (p: Person): TemplateMember => ({ name: baseName(p), klass: klassOf(p) });

/**
 * Vilken person (passets namn) varje medlem motsvarar, med medlemmens plats
 * `[grupp, index]` som nyckel. Två varv, så att ordningen inte spelar roll:
 * först namn och klass för alla, sedan bara namnet när det är entydigt både
 * bland passets personer och bland medlemmarna som återstår.
 */
function matchMembers(template: GroupTemplate, people: readonly Person[]): Map<string, string> {
  const out = new Map<string, string>();
  const used = new Set<string>();
  const slots = template.groups.flatMap((g, gi) => g.members.map((m, mi) => ({ at: `${gi}:${mi}`, m })));

  slots.forEach(({ at, m }) => {
    const p = people.find(x => !used.has(x.name) && baseName(x) === m.name && klassOf(x) === m.klass);
    if (p) { used.add(p.name); out.set(at, p.name); }
  });

  const byName = new Map<string, Person[]>();
  people.forEach(p => byName.set(baseName(p), [...(byName.get(baseName(p)) ?? []), p]));
  const rest = slots.filter(s => !out.has(s.at));
  const restCount = new Map<string, number>();
  rest.forEach(({ m }) => restCount.set(m.name, (restCount.get(m.name) ?? 0) + 1));
  rest.forEach(({ at, m }) => {
    const candidates = byName.get(m.name) ?? [];
    if (candidates.length !== 1 || restCount.get(m.name) !== 1) return;
    const p = candidates[0];
    if (used.has(p.name)) return;
    used.add(p.name);
    out.set(at, p.name);
  });
  return out;
}

/**
 * Indelningen lagd på ett pass. `people` är alla i passets tabell, även de
 * frånvarande, så att en elev som kryssas i sent hamnar i sin grupp;
 * `groupView` visar bara de aktiva. Antalet grupper är alltid indelningens.
 */
export function applyTemplate(template: GroupTemplate, people: readonly Person[]): PassGroups {
  const match = matchMembers(template, people);
  return {
    groups: template.groups.map((g, gi) =>
      g.members.flatMap((_, mi) => { const n = match.get(`${gi}:${mi}`); return n ? [n] : []; })),
    names: template.groups.map(g => g.name),
    from: template.id,
  };
}

/** Klasserna som indelningens elever finns i och som har pass den dagen. */
export function templateClasses(template: GroupTemplate, sheets: Record<string, AttendanceTable>, day: string): string[] {
  const found = new Set<string>();
  const classesOf = (name: string) => Object.keys(sheets).filter(k => sheets[k].people.some(p => p.name === name));
  template.groups.forEach(g => g.members.forEach(m => {
    const own = classesOf(m.name);
    if (own.includes(m.klass)) found.add(m.klass);
    else if (own.length === 1) found.add(own[0]);
  }));
  return classesOnDay(sheets, Object.keys(sheets).filter(k => found.has(k)), day);
}

/** Passets namn som medlem: personen i tabellen, annars namnet utan klass. */
function memberFor(name: string, people: readonly Person[]): TemplateMember {
  const p = people.find(x => x.name === name);
  return p ? toMember(p) : { name, klass: '' };
}

/**
 * "Spara som indelning". Inte indelade tas inte med. `absent` är antalet i
 * passets tabell som varken står i en grupp eller är aktiva, alltså
 * frånvarande som aldrig placerats.
 */
export function templateFromPass(
  name: string,
  pass: PassGroups,
  people: readonly Person[],
  active: readonly string[],
  opts: { id: string; now: Date },
): { template: GroupTemplate; absent: number } {
  const placed = new Set(pass.groups.flat());
  const on = new Set(active);
  const seen = new Set<string>();
  const groups = pass.groups.slice(0, MAX_TEMPLATE_GROUPS).map((g, i) => ({
    name: cleanGroupName(pass.names?.[i] ?? ''),
    members: g.map(n => memberFor(n, people)).filter(m => {
      if (seen.has(memberKey(m))) return false;
      seen.add(memberKey(m));
      return true;
    }),
  }));
  return {
    template: { id: opts.id, name: cleanTemplateName(name), groups, updatedAt: opts.now.toISOString() },
    absent: people.filter(p => !placed.has(p.name) && !on.has(p.name)).length,
  };
}

/**
 * "Uppdatera indelningen": eleverna i passets tabell får passets placering
 * (står de i Inte indelade tas de bort ur indelningen), övriga stannar i sin
 * grupp. Hade en grupp som passet tagit bort sådana övriga blir de `dropped`.
 */
export function updateTemplateFromPass(
  template: GroupTemplate,
  pass: PassGroups,
  people: readonly Person[],
  now: Date,
): { template: GroupTemplate; dropped: TemplateMember[]; moved: number; removed: number } {
  const match = matchMembers(template, people);
  const peopleKeys = new Set(people.map(p => memberKey(toMember(p))));
  const passNames = new Set(pass.groups.flat());
  // Medlemmar som hör till passet: matchade, eller med samma namn och klass som någon där.
  const inPass = (gi: number, mi: number, m: TemplateMember) =>
    match.has(`${gi}:${mi}`) || peopleKeys.has(memberKey(m)) || passNames.has(m.name);

  const oldPlace = new Map<string, number>();
  template.groups.forEach((g, gi) => g.members.forEach((_, mi) => {
    const n = match.get(`${gi}:${mi}`);
    if (n !== undefined && !oldPlace.has(n)) oldPlace.set(n, gi);
  }));

  const count = Math.min(MAX_TEMPLATE_GROUPS, Math.max(pass.groups.length, 1));
  const groups: TemplateGroup[] = Array.from({ length: count }, (_, i) => ({
    name: cleanGroupName(pass.names?.[i] ?? ''),
    members: [],
  }));
  const seen = new Set<string>();
  const put = (i: number, m: TemplateMember) => {
    if (seen.has(memberKey(m))) return;
    seen.add(memberKey(m));
    groups[i].members.push(m);
  };
  let moved = 0;
  pass.groups.slice(0, count).forEach((g, i) => g.forEach(n => {
    put(i, memberFor(n, people));
    if (oldPlace.has(n) && oldPlace.get(n) !== i) moved++;
  }));
  const removed = Array.from(oldPlace.keys()).filter(n => !passNames.has(n)).length;

  const dropped: TemplateMember[] = [];
  template.groups.forEach((g, gi) => g.members.forEach((m, mi) => {
    if (inPass(gi, mi, m)) return;
    if (gi < count) put(gi, m);
    else dropped.push(m);
  }));

  return { template: { ...template, groups, updatedAt: now.toISOString() }, dropped, moved, removed };
}

/** Medlemmar vars namn inte finns i något ark (`knownClasses`). */
export function missingMembers(template: GroupTemplate, sheets: Record<string, AttendanceTable>): TemplateMember[] {
  const names = new Set(Object.values(sheets).flatMap(t => t.people.map(p => p.name)));
  return template.groups.flatMap(g => g.members.filter(m => !names.has(m.name)));
}

/**
 * Visningsnamn för redigeringen, där `NarvaroGroups` bara känner strängar.
 * " (Klass)" sätts bara när samma namn finns med mer än en klass bland
 * medlemmarna och arkens elever. Samma namn och klass är samma elev.
 */
export function memberLabels(
  members: readonly TemplateMember[],
  people: readonly Person[],
): { label: (m: TemplateMember) => string; member: Map<string, TemplateMember> } {
  const all = [...members, ...people.map(toMember)];
  const classes = new Map<string, Set<string>>();
  all.forEach(m => classes.set(m.name, (classes.get(m.name) ?? new Set()).add(m.klass)));
  const label = (m: TemplateMember) => ((classes.get(m.name)?.size ?? 0) > 1 ? m.name + suffix(m.klass) : m.name);
  const member = new Map<string, TemplateMember>();
  all.forEach(m => { if (!member.has(label(m))) member.set(label(m), m); });
  return { label, member };
}

/* ---------- listan ---------- */

/** Senast ändrad först. */
export const sortTemplates = (list: readonly GroupTemplate[]) =>
  [...list].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

/** Lägger till eller ersätter (samma id). */
export function upsertTemplate(list: readonly GroupTemplate[], t: GroupTemplate): GroupTemplate[] {
  return list.some(x => x.id === t.id) ? list.map(x => (x.id === t.id ? t : x)) : [...list, t];
}

export const removeTemplate = (list: readonly GroupTemplate[], id: string) => list.filter(t => t.id !== id);

export function renameTemplate(list: readonly GroupTemplate[], id: string, name: string, now: Date): GroupTemplate[] {
  const clean = cleanTemplateName(name);
  if (!clean) return [...list];
  return list.map(t => (t.id === id ? { ...t, name: clean, updatedAt: now.toISOString() } : t));
}

/** Byter klass på medlemmarna när en klass byter namn (`renameClass`). */
export function renameTemplatesClass(list: readonly GroupTemplate[], from: string, to: string): GroupTemplate[] {
  return list.map(t => ({
    ...t,
    groups: t.groups.map(g => ({ ...g, members: g.members.map(m => (m.klass === from ? { ...m, klass: to } : m)) })),
  }));
}

/* ---------- lagring ---------- */

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown) => (typeof v === 'string' ? v : '');

/** Läser indelningarna defensivt: fel form släpps, namn kortas, dubbletter tas bort. */
export function sanitizeTemplates(raw: unknown): GroupTemplate[] {
  if (!Array.isArray(raw)) return [];
  const ids = new Set<string>();
  const out: GroupTemplate[] = [];
  raw.filter(isRecord).forEach(t => {
    const id = str(t.id);
    const name = cleanTemplateName(str(t.name));
    if (!id || !name || ids.has(id) || !Array.isArray(t.groups) || out.length >= MAX_TEMPLATES) return;
    ids.add(id);
    const seen = new Set<string>();
    const groups = t.groups.filter(isRecord).slice(0, MAX_TEMPLATE_GROUPS).map(g => ({
      name: cleanGroupName(str(g.name)),
      members: (Array.isArray(g.members) ? g.members : []).filter(isRecord).flatMap(m => {
        const member = { name: str(m.name).trim(), klass: str(m.klass) };
        if (!member.name || seen.has(memberKey(member))) return [];
        seen.add(memberKey(member));
        return [member];
      }),
    }));
    out.push({ id, name, groups, updatedAt: str(t.updatedAt) });
  });
  return out;
}
