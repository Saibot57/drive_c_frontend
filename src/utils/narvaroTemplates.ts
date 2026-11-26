/**
 * Sparade gruppindelningar i Närvarorutor ("indelningar" i UI:t). En
 * indelning har ett namn och grupper med elever, och kan läggas på vilket
 * pass som helst: de närvarande hamnar då i sina grupper. Planen finns i
 * `docs/plans/narvaro-sparade-grupper.md`.
 *
 * En elev i en indelning är namnet i arket utan tillägget som
 * `combineSheets` sätter på dubbletter, plus klassen hen kom från och, när
 * namnet står flera gånger i samma ark, löpnumret ("Ali (Rosa 2)" blir
 * `{ name: 'Ali', klass: 'Rosa', n: 2 }`). Klassen och numret skiljer bara
 * elever med samma namn åt; en elev som bytt klass hittas ändå på namnet när
 * det är entydigt.
 */

import type { AttendancePerson, AttendanceTable, PassGroups } from '@/utils/narvaro';
import { classesOnDay, cleanGroupName } from '@/utils/narvaro';

export type TemplateMember = {
  name: string;
  klass: string;
  /** Löpnumret när namnet står flera gånger i samma ark, från 2. Saknas för den första. */
  n?: number;
};
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
const classLabel = (klass: string) => klass || 'utan klass';
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Namnet utan tillägget `combineSheets` satt efter det ("Ali (Rosa)" eller
 * "Ali (Rosa 2)"), och löpnumret när det finns ett.
 */
export function parseName(p: Person): { name: string; n?: number } {
  if (p.klass === undefined) return { name: p.name };
  const m = new RegExp(`^(.+) \\(${escapeRe(classLabel(p.klass))}(?: (\\d+))?\\)$`).exec(p.name);
  if (!m) return { name: p.name };
  const n = m[2] ? Number(m[2]) : 1;
  return n > 1 ? { name: m[1], n } : { name: m[1] };
}

/** Namnet utan tillägget från `combineSheets`. */
export const baseName = (p: Person) => parseName(p).name;

const ordinal = (m: { n?: number }) => m.n ?? 1;
const memberKey = (m: TemplateMember) => `${m.klass}\u0000${m.name}\u0000${ordinal(m)}`;
const toMember = (p: Person): TemplateMember => ({ ...parseName(p), klass: klassOf(p) });

/** Personen i en tabell (`combineSheets`) som medlem i en indelning. */
export const personMember = toMember;

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
    const p = people.find(x => !used.has(x.name) && memberKey(toMember(x)) === memberKey(m));
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
 * `moved`, `removed` och `added` räknar passets elever som byter grupp, tas
 * ur indelningen och kommer nya in i den.
 */
export function updateTemplateFromPass(
  template: GroupTemplate,
  pass: PassGroups,
  people: readonly Person[],
  now: Date,
): { template: GroupTemplate; dropped: TemplateMember[]; moved: number; removed: number; added: number } {
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
  let added = 0;
  pass.groups.slice(0, count).forEach((g, i) => g.forEach(n => {
    put(i, memberFor(n, people));
    if (!oldPlace.has(n)) added++;
    else if (oldPlace.get(n) !== i) moved++;
  }));
  const removed = Array.from(oldPlace.keys()).filter(n => !passNames.has(n)).length;

  const dropped: TemplateMember[] = [];
  template.groups.forEach((g, gi) => g.members.forEach((m, mi) => {
    if (inPass(gi, mi, m)) return;
    if (gi < count) put(gi, m);
    else dropped.push(m);
  }));

  return { template: { ...template, groups, updatedAt: now.toISOString() }, dropped, moved, removed, added };
}

/** Medlemmar vars namn inte finns i något ark (`knownClasses`). */
export function missingMembers(template: GroupTemplate, sheets: Record<string, AttendanceTable>): TemplateMember[] {
  const names = new Set(Object.values(sheets).flatMap(t => t.people.map(p => p.name)));
  return template.groups.flatMap(g => g.members.filter(m => !names.has(m.name)));
}

/**
 * Visningsnamn för redigeringen, där `NarvaroGroups` bara känner strängar.
 * " (Klass)" eller " (Klass 2)" sätts bara när samma namn finns med mer än
 * en klass eller ett löpnummer bland medlemmarna och arkens elever. Samma
 * namn, klass och nummer är samma elev.
 */
export function memberLabels(
  members: readonly TemplateMember[],
  people: readonly Person[],
): { label: (m: TemplateMember) => string; member: Map<string, TemplateMember> } {
  const all = [...members, ...people.map(toMember)];
  const variants = new Map<string, Set<string>>();
  all.forEach(m => variants.set(m.name, (variants.get(m.name) ?? new Set()).add(memberKey(m))));
  const label = (m: TemplateMember) => ((variants.get(m.name)?.size ?? 0) > 1
    ? `${m.name} (${classLabel(m.klass)}${ordinal(m) > 1 ? ` ${ordinal(m)}` : ''})`
    : m.name);
  const member = new Map<string, TemplateMember>();
  all.forEach(m => { if (!member.has(label(m))) member.set(label(m), m); });
  return { label, member };
}

/**
 * Klasserna som ska visas när indelningen läggs på: de som redan visas och
 * indelningens klasser som har pass den dagen, i arkens ordning (`allClasses`).
 */
export function templateTargetClasses(
  template: GroupTemplate,
  sheets: Record<string, AttendanceTable>,
  allClasses: readonly string[],
  selected: readonly string[],
  day: string,
): string[] {
  const want = new Set([...selected, ...templateClasses(template, sheets, day)]);
  return allClasses.filter(k => want.has(k));
}

/** Antalet elever i indelningen. */
export const templateSize = (t: GroupTemplate) => t.groups.reduce((n, g) => n + g.members.length, 0);

/* ---------- redigeringen ---------- */

export const emptyTemplate = (id: string, name: string, now: Date, groups = 4): GroupTemplate => ({
  id,
  name: cleanTemplateName(name),
  groups: Array.from({ length: Math.max(1, Math.min(MAX_TEMPLATE_GROUPS, groups)) }, () => ({ name: '', members: [] })),
  updatedAt: now.toISOString(),
});

/** Flyttar en elev till gruppen `target`, eller ut ur indelningen med `'pool'`. */
export function moveMember(t: GroupTemplate, member: TemplateMember, target: number | 'pool'): GroupTemplate {
  const key = memberKey(member);
  const groups = t.groups.map(g => ({ ...g, members: g.members.filter(m => memberKey(m) !== key) }));
  if (target !== 'pool' && groups[target]) groups[target].members.push(member);
  return { ...t, groups };
}

export function addTemplateGroup(t: GroupTemplate): GroupTemplate {
  if (t.groups.length >= MAX_TEMPLATE_GROUPS) return t;
  return { ...t, groups: [...t.groups, { name: '', members: [] }] };
}

export const removeTemplateGroup = (t: GroupTemplate, index: number): GroupTemplate =>
  ({ ...t, groups: t.groups.filter((_, i) => i !== index) });

export const renameTemplateGroup = (t: GroupTemplate, index: number, name: string): GroupTemplate =>
  ({ ...t, groups: t.groups.map((g, i) => (i === index ? { ...g, name: cleanGroupName(name) } : g)) });

/** Tar bort elever vars namn inte finns i något ark (`missingMembers`). */
export function removeMissing(t: GroupTemplate, sheets: Record<string, AttendanceTable>): GroupTemplate {
  const gone = new Set(missingMembers(t, sheets).map(memberKey));
  return { ...t, groups: t.groups.map(g => ({ ...g, members: g.members.filter(m => !gone.has(memberKey(m))) })) };
}

/** Samma elev (namn, klass och löpnummer). */
export const sameMember = (a: TemplateMember, b: TemplateMember) => memberKey(a) === memberKey(b);

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

/** Byter klass på medlemmarna när en klass byter namn (`renameClass`). Numret följer med. */
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
        const n = typeof m.n === 'number' && Number.isInteger(m.n) && m.n > 1 ? m.n : undefined;
        const member: TemplateMember = { name: str(m.name).trim(), klass: str(m.klass), ...(n && { n }) };
        if (!member.name || seen.has(memberKey(member))) return [];
        seen.add(memberKey(member));
        return [member];
      }),
    }));
    out.push({ id, name, groups, updatedAt: str(t.updatedAt) });
  });
  return out;
}
