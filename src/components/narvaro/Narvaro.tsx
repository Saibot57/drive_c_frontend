'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Check, ClipboardPaste, Copy, Loader2, Lock, PenLine, Shuffle, Trash2, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FeatureNavigation } from '@/components/FeatureNavigation';
import { NarvaroGroups } from '@/components/narvaro/NarvaroGroups';
import { NarvaroNoteDialog } from '@/components/narvaro/NarvaroNoteDialog';
import { STAMP_BG, StampTag } from '@/components/narvaro/stampStyle';
import { NarvaroLock } from '@/components/narvaro/NarvaroLock';
import { useAuth } from '@/contexts/AuthContext';
import { NarvaroSaveStatus, useNarvaroSync } from '@/hooks/useNarvaroSync';
import { cn } from '@/lib/utils';
import { isEditableElement } from '@/utils/dom';
import {
  AttendanceTable,
  CUSTOM_STAMP_COLORS,
  GroupBy,
  GroupsStore,
  MAX_STORED_GROUP_SESSIONS,
  NotesStore,
  PassChoice,
  PersonNote,
  SessionNotes,
  Stamp,
  dayColumns,
  defaultDay,
  defaultPass,
  emptySession,
  groupCount,
  groupView,
  groupsText,
  historyKeys,
  isoWeek,
  moveToGroup,
  noteEntries,
  parsePasted,
  pastePreview,
  randomGroups,
  roster,
  sessionKey,
  sessionLabel,
  sessionText,
  setPersonNote,
  toggleStamp,
  trimSessions,
} from '@/utils/narvaro';
import { isoWeekKey, tableFor } from '@/utils/narvaroDocs';
import { exampleTable } from '@/utils/narvaroExample';
import '@/styles/schedule-theme.css';

/**
 * Närvarorutor: närvaron från Google-arket som namnrutor, för anteckningar
 * under passet och för att dela in de närvarande i grupper.
 *
 * Arket tillhör skolan och går inte att läsa härifrån, så tabellen klistras
 * in. Allt krypteras i webbläsaren med användarens lösenfras innan det
 * sparas på servern (useNarvaroSync), och inga elevnamn finns i koden.
 *
 * Sidan är olistad: den nås med n-n-n (se FeatureNavigation).
 */

const SAVE_LABEL: Record<NarvaroSaveStatus, string> = {
  saved: 'Sparat',
  pending: 'Sparar snart',
  saving: 'Sparar…',
  error: 'Kunde inte spara. Försöker igen.',
  conflict: 'Ändrat på en annan enhet',
};

type Mode = 'notes' | 'groups';
type PasteMessage = { kind: 'ok' | 'error'; text: string } | null;

const chip = (pressed: boolean) => cn(
  'inline-flex items-baseline gap-1.5 rounded-ui-sm border-frame border-ui-line px-3 py-1 text-sm font-semibold transition-colors',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ui-focus)] focus-visible:ring-offset-2',
  pressed ? 'bg-ui-ink text-ui-paper' : 'bg-ui-paper text-ui-ink hover:bg-ui-surface-3',
);

const splitName = (name: string) => {
  const [first, ...rest] = name.split(/\s+/);
  return [first, rest.join(' ')] as const;
};

export default function Narvaro() {
  const [now] = useState(() => new Date());
  const example = useMemo(exampleTable, []);

  const { user } = useAuth();
  const sync = useNarvaroSync(user?.id ?? null, now);
  const { update } = sync;
  const weekKey = isoWeekKey(now);
  // Veckans tabell, annars den senast inklistrade.
  const current = tableFor(sync.data.tables, weekKey);
  const savedTable = current?.table ?? null;
  const stamps = sync.data.stamps;
  const savedNotes = sync.data.notes;
  const savedGroups = sync.data.groups;
  const setStamps = (next: Stamp[]) => update(d => ({ ...d, stamps: next }));
  const setSavedNotes = (next: NotesStore) => update(d => ({ ...d, notes: next }));
  const setSavedGroups = (next: GroupsStore) => update(d => ({ ...d, groups: next }));
  const setSavedTable = useCallback(
    (t: AttendanceTable) => update(d => ({ ...d, tables: { ...d.tables, [weekKey]: t } })),
    [update, weekKey],
  );

  // Exemplet har egna anteckningar och grupper i minnet, så att det inte
  // blandas med de riktiga.
  const [showExample, setShowExample] = useState(false);
  const [exNotes, setExNotes] = useState<NotesStore>({});
  const [exGroups, setExGroups] = useState<GroupsStore>({});
  const isExample = !savedTable || showExample;
  const table = isExample ? example : savedTable;
  const notes = isExample ? exNotes : savedNotes;
  const groups = isExample ? exGroups : savedGroups;
  const setNotes = isExample ? setExNotes : setSavedNotes;
  const setGroups = isExample ? setExGroups : setSavedGroups;

  const [klass, setKlass] = useState('all');
  const [day, setDay] = useState(() => defaultDay(example, now));
  const [pass, setPass] = useState<PassChoice>(() => defaultPass(example, defaultDay(example, now), now));
  const [mode, setMode] = useState<Mode>('notes');
  const [stamp, setStamp] = useState<'note' | string>('note');
  const [newStamp, setNewStamp] = useState('');
  const [excluded, setExcluded] = useState<Record<string, string[]>>({});
  const [groupBy, setGroupBy] = useState<GroupBy>('count');
  const [groupN, setGroupN] = useState(4);
  const [spread, setSpread] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  const [pasteOpen, setPasteOpen] = useState<boolean | null>(null);
  const showPaste = pasteOpen ?? !savedTable;
  const [pasteText, setPasteText] = useState('');
  const [pasteMsg, setPasteMsg] = useState<PasteMessage>(null);
  const [pasteRaw, setPasteRaw] = useState('');
  const [toast, setToast] = useState<string | null>(null);
  const [copyFallback, setCopyFallback] = useState<string | null>(null);
  const [armedDelete, setArmedDelete] = useState<string | null>(null);

  // Ny tabell: välj dagens veckodag och passet som pågår.
  useEffect(() => {
    const d = defaultDay(table, now);
    setDay(d);
    setPass(defaultPass(table, d, now));
    setKlass(k => (k === 'all' || table.groups.includes(k) ? k : 'all'));
  }, [table, now]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 1600);
    return () => clearTimeout(t);
  }, [toast]);

  const key = sessionKey(table, day, pass, now);
  const label = sessionLabel(table, day, pass, now);
  const sess: SessionNotes = notes[key] ?? emptySession(label);
  const { present, absent } = roster(table, { klass, day, pass, added: sess.added });
  const excludedHere = useMemo(() => new Set(excluded[key] ?? []), [excluded, key]);
  const active = present.filter(p => !excludedHere.has(p.name)).map(p => p.name);
  const stored = groups[key]?.groups;
  const view = stored ? groupView(stored, active) : null;
  const showClass = klass === 'all' && table.groups.length > 1;

  const updateSession = (fn: (s: SessionNotes) => SessionNotes) =>
    setNotes({ ...notes, [key]: { ...fn(sess), label } });
  const saveGroups = (next: string[][]) =>
    setGroups(trimSessions({ ...groups, [key]: { groups: next } }, MAX_STORED_GROUP_SESSIONS));

  const copyText = useCallback((text: string) => {
    const fallback = () => setCopyFallback(text);
    try {
      if (navigator.clipboard?.writeText) navigator.clipboard.writeText(text).then(() => setToast('Kopierat'), fallback);
      else fallback();
    } catch {
      fallback();
    }
  }, []);

  /* ---------- inklistring ---------- */

  const handlePaste = useCallback((text: string, html: string) => {
    const parsed = parsePasted(text, html);
    if (!parsed) {
      setPasteMsg({ kind: 'error', text: 'Hittade inga kryssrutor. Kopiera cellerna i arket, inte en bild.' });
      setPasteRaw(pastePreview(text, html));
      return;
    }
    // Rutan är öppen för att ingen tabell fanns. Håll den öppen en stund till,
    // så att bekräftelsen syns.
    setPasteOpen(true);
    setSavedTable(parsed);
    setShowExample(false);
    setPasteRaw('');
    setPasteText('');
    const classes = parsed.groups.length ? ` i ${parsed.groups.length} klasser` : '';
    setPasteMsg({ kind: 'ok', text: `Läste in ${parsed.people.length} deltagare${classes} och ${parsed.cols.length} pass.` });
    setTimeout(() => setPasteOpen(false), 1400);
  }, [setSavedTable]);

  // Klistrar man in var som helst på sidan (utanför textfält) läses tabellen in.
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      if (isEditableElement(e.target)) return;
      const text = e.clipboardData?.getData('text/plain') ?? '';
      if (!text.includes('\t')) return;
      e.preventDefault();
      setPasteOpen(true);
      handlePaste(text, e.clipboardData?.getData('text/html') ?? '');
    };
    document.addEventListener('paste', onPaste);
    return () => document.removeEventListener('paste', onPaste);
  }, [handlePaste]);

  /* ---------- anteckningar ---------- */

  const onTile = (name: string) => {
    if (mode === 'groups') {
      const cur = excluded[key] ?? [];
      setExcluded({ ...excluded, [key]: cur.includes(name) ? cur.filter(n => n !== name) : [...cur, name] });
      return;
    }
    if (stamp === 'note') { setEditing(name); return; }
    updateSession(s => toggleStamp(s, name, stamp));
    setFlash(name);
    setTimeout(() => setFlash(f => (f === name ? null : f)), 350);
  };

  const addPerson = (name: string) => {
    updateSession(s => ({ ...s, added: s.added.includes(name) ? s.added : [...s.added, name] }));
    setToast(`${name} tillagd`);
  };

  const editingNote: PersonNote = (editing && sess.people[editing]) || { tags: [], note: '' };

  const addStamp = (e: React.FormEvent) => {
    e.preventDefault();
    const text = newStamp.trim();
    if (!text) return;
    const id = `s${Date.now().toString(36)}`;
    const color = CUSTOM_STAMP_COLORS[stamps.filter(s => s.custom).length % CUSTOM_STAMP_COLORS.length];
    setStamps([...stamps, { id, label: text, color, custom: true }]);
    setStamp(id);
    setNewStamp('');
  };

  /* ---------- grupper ---------- */

  const makeRandom = () => {
    if (!active.length) { setToast('Ingen att dela in'); return; }
    const spreadSet = new Set(spread ? active.filter(n => sess.people[n]?.tags.includes(spread)) : []);
    saveGroups(randomGroups(active, groupCount(groupBy, groupN, active.length), spreadSet));
  };
  const makeManual = () =>
    saveGroups(Array.from({ length: groupCount(groupBy, groupN, active.length) }, () => []));

  const entries = noteEntries(sess);
  const history = mode === 'notes' ? historyKeys(notes, key) : [];
  const cols = dayColumns(table, day);
  const weekday = now.toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div className="sp-root">
      <div className="ui-backdrop fixed inset-0 z-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/bakgrund59.png" alt="" className="h-full w-full object-cover" />
      </div>

      <div className="relative z-10 flex flex-col gap-5 pb-20">
        <div className="sp-toolbar flex flex-col items-start gap-4 p-4 lg:flex-row lg:items-center">
          <FeatureNavigation />
          <p className="font-mono text-xs uppercase tracking-wider text-ui-muted">Vecka {isoWeek(now)} · {weekday}</p>
          {sync.phase === 'ready' && (
            <div className="flex flex-wrap items-center gap-2 lg:ml-auto">
              <SaveIndicator status={sync.saveStatus} />
              <Button
                variant="neutral"
                className="sp-btn"
                aria-expanded={showPaste}
                onClick={() => setPasteOpen(!showPaste)}
              >
                <ClipboardPaste /> Klistra in tabell
              </Button>
              <Button
                variant="neutral"
                size="icon"
                className="sp-btn"
                onClick={() => void sync.lock()}
                title="Lås och glöm nyckeln på den här enheten"
                aria-label="Lås"
              >
                <Lock />
              </Button>
            </div>
          )}
        </div>

        {sync.phase !== 'ready' ? (
          <NarvaroLock
            phase={sync.phase}
            error={sync.error}
            busy={sync.busy}
            onSetup={(p, r) => void sync.setup(p, r)}
            onUnlock={(p, r) => void sync.unlock(p, r)}
            onReset={() => void sync.reset()}
            onRetry={() => void sync.retry()}
          />
        ) : (<>
        {sync.saveStatus === 'conflict' && (
          <div role="alert" className="sp-toast flex flex-wrap items-center justify-between gap-3 bg-ui-mark-pink px-4 py-2 text-sm font-semibold text-ui-mark-fg">
            <span>Närvaron har ändrats på en annan enhet. Den senaste ändringen här sparades inte.</span>
            <Button variant="neutral" size="sm" className="sp-btn" onClick={() => void sync.refresh(true)}>Hämta det senaste</Button>
          </div>
        )}
        {sync.unreadable > 0 && (
          <div role="alert" className="sp-toast bg-ui-mark-pink px-4 py-2 text-sm font-semibold text-ui-mark-fg">
            {sync.unreadable === 1 ? 'En sparad vecka' : `${sync.unreadable} sparade veckor`} gick inte att läsa och visas inte. De ligger kvar orörda.
          </div>
        )}

        {showPaste && (
          <section className="sp-card flex flex-col gap-3 p-4" aria-label="Klistra in">
            <h2 className="text-lg font-bold">Klistra in från Google Kalkylark</h2>
            <ol className="ml-5 list-decimal text-sm">
              <li>Markera namnkolumnen och kryssrutorna, med dag- och tidsraderna överst (till exempel A1:Q32).</li>
              <li>Kopiera med Ctrl+C, eller Cmd+C på Mac.</li>
              <li>Klicka i rutan nedan och klistra in.</li>
            </ol>
            <textarea
              id="narvaro-paste"
              className="sp-input min-h-[80px] w-full rounded-ui-sm bg-ui-surface-2 p-2.5 font-mono text-xs"
              placeholder="Klistra in här"
              value={pasteText}
              onChange={e => setPasteText(e.target.value)}
              onPaste={e => {
                const html = e.clipboardData.getData('text/html');
                const text = e.clipboardData.getData('text/plain');
                if (html || text) { e.preventDefault(); handlePaste(text, html); }
              }}
            />
            <div className="flex flex-wrap items-center gap-2">
              <Button className="sp-btn" onClick={() => handlePaste(pasteText, '')}>Läs in</Button>
              <Button
                variant="neutral"
                className="sp-btn"
                onClick={() => { setShowExample(true); setPasteMsg({ kind: 'ok', text: 'Exemplet visas.' }); }}
              >
                Visa exemplet
              </Button>
              {pasteMsg && (
                <span
                  role="status"
                  className={cn(
                    'rounded-ui-sm border border-ui-line px-2 py-0.5 text-sm font-semibold text-ui-mark-fg',
                    pasteMsg.kind === 'ok' ? 'bg-ui-mark-green' : 'bg-ui-mark-pink',
                  )}
                >
                  {pasteMsg.text}
                </span>
              )}
            </div>
            {pasteRaw && (
              <details className="flex flex-col gap-1.5">
                <summary className="cursor-pointer text-sm font-semibold">Så här såg det inklistrade ut (de första raderna)</summary>
                <textarea readOnly rows={8} value={pasteRaw} className="sp-input my-1.5 w-full whitespace-pre rounded-ui-sm bg-ui-surface-2 p-2 font-mono text-2xs" />
                <Button variant="neutral" size="sm" className="sp-btn self-start" onClick={() => copyText(pasteRaw)}>Kopiera</Button>
              </details>
            )}
            <p className="text-xs text-ui-muted">
              Allt krypteras här innan det sparas, och servern kan inte läsa något. Tabellen sparas för vecka{' '}
              {weekKey.slice(-2).replace(/^0/, '')}. Klistra in på nytt när arket har uppdaterats.
            </p>
          </section>
        )}

        {isExample && (
          <div className="sp-toast bg-ui-mark-yellow px-4 py-2 text-sm font-semibold text-ui-mark-fg">
            Exempeldata med påhittade namn.{' '}
            {savedTable
              ? <button type="button" className="underline" onClick={() => setShowExample(false)}>Tillbaka till ditt ark</button>
              : 'Klistra in ditt eget ark för att börja.'}
          </div>
        )}
        {!isExample && current && current.key !== weekKey && (
          <div className="sp-toast bg-ui-mark-yellow px-4 py-2 text-sm font-semibold text-ui-mark-fg">
            Tabellen är från vecka {current.key.slice(-2).replace(/^0/, '')}. Klistra in veckans ark när du har det.
          </div>
        )}

        <section className="sp-card flex flex-col gap-3 p-4" aria-label="Urval">
          {table.groups.length > 1 && (
            <ChipRow label="Klass">
              {['all', ...table.groups].map(k => (
                <button key={k} type="button" className={chip(klass === k)} aria-pressed={klass === k} onClick={() => setKlass(k)}>
                  {k === 'all' ? 'Alla' : k}
                </button>
              ))}
            </ChipRow>
          )}
          <ChipRow label="Dag">
            {table.days.map(d => (
              <button
                key={d}
                type="button"
                className={chip(day === d)}
                aria-pressed={day === d}
                onClick={() => { setDay(d); setPass(defaultPass(table, d, now)); }}
              >
                {d}
              </button>
            ))}
          </ChipRow>
          <ChipRow label="Pass">
            <button type="button" className={chip(pass === 'day')} aria-pressed={pass === 'day'} onClick={() => setPass('day')}>
              Hela dagen
            </button>
            {cols.map(c => {
              const any = table.people.some(p => p.marks[c.index] === true);
              return (
                <button
                  key={c.id}
                  type="button"
                  className={cn(chip(pass === c.id), !any && pass !== c.id && 'border-dashed text-ui-muted')}
                  aria-pressed={pass === c.id}
                  title={any ? undefined : 'Ingen markerad än'}
                  onClick={() => setPass(c.id)}
                >
                  {c.pass}
                  {c.letter && <small className="font-mono text-2xs opacity-70">{c.letter}</small>}
                </button>
              );
            })}
          </ChipRow>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-ui-hair pt-3">
            <div role="tablist" className="flex overflow-hidden rounded-ui-sm border-frame border-ui-line">
              {(['notes', 'groups'] as const).map(m => (
                <button
                  key={m}
                  role="tab"
                  type="button"
                  aria-selected={mode === m}
                  onClick={() => setMode(m)}
                  className={cn(
                    'flex items-center gap-2 px-4 py-1.5 text-sm font-semibold [&+&]:border-l-frame [&+&]:border-ui-line',
                    mode === m ? 'bg-ui-mark-green text-ui-mark-fg' : 'bg-ui-paper hover:bg-ui-surface-3',
                  )}
                >
                  {m === 'notes' ? <><PenLine size={15} /> Anteckningar</> : <><Users size={15} /> Grupper</>}
                </button>
              ))}
            </div>
            <p className="flex items-baseline gap-2">
              <b className="text-3xl font-bold tabular-nums">{present.length}</b>
              <span className="text-sm text-ui-muted">närvarande{absent.length ? ` · ${absent.length} inte markerade` : ''}</span>
            </p>
          </div>

          {mode === 'notes' ? (
            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  aria-pressed={stamp === 'note'}
                  onClick={() => setStamp('note')}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-ui-sm border-frame border-ui-line bg-ui-paper px-3 py-1.5 text-sm font-semibold',
                    stamp === 'note' && 'ring-2 ring-[var(--ui-focus)] ring-offset-2',
                  )}
                >
                  <PenLine size={14} /> Skriv notering
                </button>
                {stamps.map(s => (
                  <span key={s.id} className="inline-flex">
                    <button
                      type="button"
                      aria-pressed={stamp === s.id}
                      onClick={() => setStamp(s.id)}
                      className={cn(
                        'rounded-ui-sm border-frame border-ui-line px-3 py-1.5 text-sm font-semibold text-ui-mark-fg',
                        STAMP_BG[s.color],
                        s.custom && 'rounded-r-none',
                        stamp === s.id && 'ring-2 ring-[var(--ui-focus)] ring-offset-2',
                      )}
                    >
                      {s.label}
                    </button>
                    {s.custom && (
                      <button
                        type="button"
                        aria-label={`Ta bort stämpeln ${s.label}`}
                        title="Ta bort stämpeln"
                        onClick={() => { setStamps(stamps.filter(x => x.id !== s.id)); if (stamp === s.id) setStamp('note'); }}
                        className={cn('rounded-r-ui-sm border-y-frame border-r-frame border-ui-line px-1.5 text-ui-mark-fg', STAMP_BG[s.color])}
                      >
                        ×
                      </button>
                    )}
                  </span>
                ))}
                <form className="flex gap-1.5" onSubmit={addStamp}>
                  <input
                    id="narvaro-new-stamp"
                    value={newStamp}
                    onChange={e => setNewStamp(e.target.value)}
                    maxLength={24}
                    placeholder="Ny stämpel"
                    aria-label="Ny stämpel"
                    className="sp-input w-36 rounded-ui-sm bg-ui-paper px-2 py-1 text-sm"
                  />
                  <Button type="submit" variant="neutral" size="sm" className="sp-btn">Lägg till</Button>
                </form>
              </div>
              <p className="text-sm text-ui-muted">
                {stamp === 'note'
                  ? 'Tryck på ett namn för att skriva en notering. Välj en stämpel för att markera flera snabbt.'
                  : `Tryck på namn för att sätta eller ta bort ”${stamps.find(s => s.id === stamp)?.label ?? ''}”.`}
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center gap-3">
                <div role="group" aria-label="Dela efter" className="flex overflow-hidden rounded-ui-sm border-frame border-ui-line">
                  {(['count', 'size'] as const).map(b => (
                    <button
                      key={b}
                      type="button"
                      aria-pressed={groupBy === b}
                      onClick={() => setGroupBy(b)}
                      className={cn(
                        'px-3 py-1.5 text-sm font-semibold [&+&]:border-l-frame [&+&]:border-ui-line',
                        groupBy === b ? 'bg-ui-ink text-ui-paper' : 'bg-ui-paper hover:bg-ui-surface-3',
                      )}
                    >
                      {b === 'count' ? 'Antal grupper' : 'Personer per grupp'}
                    </button>
                  ))}
                </div>
                <div className="flex items-center rounded-ui-sm border-frame border-ui-line bg-ui-paper">
                  <button type="button" className="h-9 w-9 text-lg font-bold" aria-label="Minska" onClick={() => setGroupN(n => Math.max(1, n - 1))}>−</button>
                  <output className="min-w-[2.2ch] text-center text-lg font-bold tabular-nums" aria-live="polite">{groupN}</output>
                  <button type="button" className="h-9 w-9 text-lg font-bold" aria-label="Öka" onClick={() => setGroupN(n => Math.min(30, n + 1))}>+</button>
                </div>
                <label className="flex items-center gap-1.5 text-sm font-semibold">
                  Sprid ut
                  <select
                    id="narvaro-spread"
                    value={spread}
                    onChange={e => setSpread(e.target.value)}
                    className="sp-input rounded-ui-sm bg-ui-paper px-2 py-1 text-sm"
                  >
                    <option value="">ingen</option>
                    {stamps.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                  </select>
                </label>
                <Button className="sp-btn" onClick={makeRandom}><Shuffle /> Slumpa grupper</Button>
                <Button variant="neutral" className="sp-btn" onClick={makeManual}>Dela in själv</Button>
              </div>
              <p className="text-sm text-ui-muted">Tryck på en namnruta för att lämna personen utanför grupperna.</p>
            </div>
          )}
        </section>

        <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(150px,1fr))]">
          {present.length ? present.map(p => {
            const n = sess.people[p.name];
            const [first, last] = splitName(p.name);
            const out = mode === 'groups' && excludedHere.has(p.name);
            return (
              <button
                key={p.name}
                type="button"
                onClick={() => onTile(p.name)}
                className={cn(
                  'sp-card-sm relative flex min-h-[86px] min-w-0 flex-col gap-1 p-3 text-left transition-transform active:translate-x-boxShadowX active:translate-y-boxShadowY',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ui-focus)] focus-visible:ring-offset-2',
                  out && 'border-dashed opacity-50 shadow-none',
                  flash === p.name && 'bg-ui-mark-yellow',
                )}
              >
                {n?.note && <PenLine size={13} className="absolute right-2 top-2" aria-label="Har notering" />}
                <span className={cn('break-words text-lg font-bold leading-tight', out && 'line-through')}>{first}</span>
                <span className="break-words text-xs text-ui-muted">
                  {last}{showClass && p.group ? ` · ${p.group}` : ''}
                </span>
                {sess.added.includes(p.name) && <span className="font-mono text-2xs uppercase tracking-wider text-ui-muted">Tillagd</span>}
                {!!n?.tags.length && (
                  <span className="mt-0.5 flex flex-wrap gap-1">
                    {n.tags.map(id => <StampTag key={id} stamp={stamps.find(s => s.id === id)} small />)}
                  </span>
                )}
              </button>
            );
          }) : (
            <div className="sp-card col-span-full p-6 text-center text-sm text-ui-muted">
              Ingen är markerad för det här passet än. Välj ett annat pass, eller lägg till personer nedan.
            </div>
          )}
        </div>

        {absent.length > 0 && (
          <section className="flex flex-col gap-2" aria-label="Inte markerade">
            <span className="font-mono text-xs font-bold uppercase tracking-wider text-ui-muted">Inte markerade, tryck för att lägga till</span>
            <div className="flex flex-wrap gap-2">
              {absent.map(p => (
                <button
                  key={p.name}
                  type="button"
                  onClick={() => addPerson(p.name)}
                  className="rounded-ui-sm border-2 border-dashed border-ui-line bg-ui-paper px-3 py-1 text-sm text-ui-muted hover:text-ui-ink"
                >
                  + {p.name}
                </button>
              ))}
            </div>
          </section>
        )}

        {mode === 'groups' && view && (
          <NarvaroGroups
            view={view}
            people={sess.people}
            stamps={stamps}
            onMove={(name, target) => saveGroups(moveToGroup(stored ?? [], name, target))}
            onAddGroup={() => saveGroups([...(stored ?? []), []])}
            onDeleteGroup={i => saveGroups((stored ?? []).filter((_, j) => j !== i))}
            onCopy={() => copyText(groupsText(label, view))}
          />
        )}

        {mode === 'notes' && (
          <section className="sp-card flex flex-col gap-2 p-4" aria-label="Noteringar">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-lg font-bold">Noteringar · {label}</h3>
              <Button variant="neutral" size="sm" className="sp-btn" disabled={!entries.length} onClick={() => copyText(sessionText(sess, table, stamps))}>
                <Copy /> Kopiera
              </Button>
            </div>
            {entries.length ? (
              <ul className="flex flex-col divide-y divide-ui-hair">
                {entries.map(([name, n]) => (
                  <li key={name} className="grid gap-1 py-2 sm:grid-cols-[minmax(0,11rem)_minmax(0,1fr)] sm:gap-3">
                    <span className="break-words font-semibold">{name}</span>
                    <span className="flex min-w-0 flex-wrap items-center gap-1.5 break-words">
                      {n.tags.map(id => <StampTag key={id} stamp={stamps.find(s => s.id === id)} />)}
                      {n.note && <span>{n.note}</span>}
                    </span>
                  </li>
                ))}
              </ul>
            ) : <p className="text-sm text-ui-muted">Inga noteringar för det här passet än.</p>}
          </section>
        )}

        {history.length > 0 && (
          <section className="sp-card flex flex-col p-4" aria-label="Tidigare pass">
            <h3 className="mb-1 text-lg font-bold">Tidigare pass</h3>
            {history.map(k => (
              <details key={k} className="border-t border-ui-hair py-2">
                <summary className="cursor-pointer font-semibold">{notes[k].label}</summary>
                <pre className="my-2 overflow-x-auto whitespace-pre-wrap rounded-ui-sm border border-ui-line bg-ui-surface-2 p-2.5 font-mono text-xs">
                  {sessionText(notes[k], table, stamps)}
                </pre>
                <div className="flex gap-2">
                  <Button variant="neutral" size="sm" className="sp-btn" onClick={() => copyText(sessionText(notes[k], table, stamps))}>
                    <Copy /> Kopiera
                  </Button>
                  <Button
                    variant="neutral"
                    size="sm"
                    className="sp-btn"
                    onClick={() => {
                      if (armedDelete !== k) { setArmedDelete(k); return; }
                      const next = { ...notes };
                      delete next[k];
                      setNotes(next);
                      setArmedDelete(null);
                    }}
                  >
                    <Trash2 /> {armedDelete === k ? 'Säker? Tryck igen' : 'Ta bort'}
                  </Button>
                </div>
              </details>
            ))}
          </section>
        )}
        </>)}
      </div>

      <NarvaroNoteDialog
        name={editing}
        note={editingNote}
        stamps={stamps}
        added={!!editing && sess.added.includes(editing)}
        onToggleStamp={id => { if (editing) updateSession(s => toggleStamp(s, editing, id)); }}
        onClose={text => {
          if (editing) updateSession(s => setPersonNote(s, editing, { tags: s.people[editing]?.tags ?? [], note: text }));
          setEditing(null);
        }}
        onRemove={() => {
          if (editing) {
            const name = editing;
            updateSession(s => {
              const people = { ...s.people };
              delete people[name];
              return { ...s, people, added: s.added.filter(n => n !== name) };
            });
          }
          setEditing(null);
        }}
      />

      <Dialog open={copyFallback !== null} onOpenChange={open => { if (!open) setCopyFallback(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Kopiera texten</DialogTitle>
            <DialogDescription>Webbläsaren tillät inte automatisk kopiering. Markera texten och tryck Ctrl+C eller Cmd+C.</DialogDescription>
          </DialogHeader>
          <textarea
            readOnly
            rows={8}
            value={copyFallback ?? ''}
            onFocus={e => e.currentTarget.select()}
            autoFocus
            className="sp-input w-full rounded-ui-sm bg-ui-surface-2 p-2.5 text-sm"
          />
        </DialogContent>
      </Dialog>

      {toast && (
        <div role="status" className="sp-toast fixed bottom-5 left-1/2 z-[1500] -translate-x-1/2 bg-ui-ink px-4 py-2 text-sm font-semibold text-ui-paper">
          {toast}
        </div>
      )}
    </div>
  );
}

function ChipRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid items-start gap-1 sm:grid-cols-[56px_1fr] sm:gap-3">
      <span className="pt-0 font-mono text-2xs font-bold uppercase tracking-widest text-ui-muted sm:pt-2">{label}</span>
      <div className="flex min-w-0 flex-wrap gap-2">{children}</div>
    </div>
  );
}

function SaveIndicator({ status }: { status: NarvaroSaveStatus }) {
  const Icon = status === 'saved' ? Check : status === 'error' || status === 'conflict' ? AlertTriangle : Loader2;
  return (
    <span role="status" className="flex items-center gap-1.5 text-xs text-ui-muted" title="Krypterat innan det sparas">
      <Icon size={14} className={cn((status === 'saving' || status === 'pending') && 'animate-spin')} />
      {SAVE_LABEL[status]}
    </span>
  );
}
