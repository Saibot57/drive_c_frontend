'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Check, ClipboardPaste, Copy, Loader2, Lock, PenLine, Shuffle, Smartphone, Trash2, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FeatureNavigation } from '@/components/FeatureNavigation';
import { NarvaroGroups } from '@/components/narvaro/NarvaroGroups';
import { NarvaroNoteDialog } from '@/components/narvaro/NarvaroNoteDialog';
import { STAMP_BG, StampTag } from '@/components/narvaro/stampStyle';
import { NarvaroLock } from '@/components/narvaro/NarvaroLock';
import { NarvaroMobile, NarvaroMobileHeader } from '@/components/narvaro/NarvaroMobile';
import { useAuth } from '@/contexts/AuthContext';
import { NarvaroSaveStatus, useNarvaroSync } from '@/hooks/useNarvaroSync';
import { cn } from '@/lib/utils';
import { isEditableElement } from '@/utils/dom';
import {
  AttendanceTable,
  CUSTOM_STAMP_COLORS,
  ClassSuggestion,
  MAX_CLASS_NAME_LENGTH,
  MAX_PASS_NAME_LENGTH,
  cleanClassName,
  combineSheets,
  groupsKey,
  isConfident,
  suggestClass,
  GroupBy,
  GroupsStore,
  MAX_STORED_GROUP_SESSIONS,
  NotesStore,
  PassChoice,
  PassNames,
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
  namePass,
  noteEntries,
  parsePasted,
  passNameFor,
  relabelSession,
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
import { groupByWeek, isoWeekKey, knownClasses, latestSheets, removeSheet, renameClass, setSheet, weekHeading } from '@/utils/narvaroDocs';
import { usePersistentState } from '@/hooks/usePersistentState';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { useWakeLock } from '@/hooks/useWakeLock';
import {
  MobilePref,
  MobileView,
  isMobileMode,
  pickActiveStamp,
  sanitizeMobilePref,
  sanitizeStampId,
  setStamp as setStampOn,
} from '@/utils/narvaroMobile';
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
 * Varje klass har ett eget ark, som klistras in för sig och känns igen på
 * namnen nästa gång. Klasserna kan visas var för sig eller tillsammans.
 * Noteringar hör till eleven och passet; grupper till passet och till vilka
 * klasser som visas.
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
type PendingPaste = { table: AttendanceTable; suggestion: ClassSuggestion | null };

/** Vilka klasser som visas, per enhet. Klassernas namn är inga personuppgifter. */
const VIEW_KEY = 'narvaro.view.v1';
const NO_CLASSES: string[] = [];
const sanitizeView = (raw: unknown): string[] =>
  Array.isArray(raw) ? raw.filter((x): x is string => typeof x === 'string') : [];
const classLabel = (klass: string) => klass || 'Utan klass';
const weekNumber = (weekKey: string) => weekKey.slice(-2).replace(/^0/, '');
type PasteMessage = { kind: 'ok' | 'error'; text: string } | null;

/** Mobilläget per enhet: eget val, annars skärmens bredd. */
const MOBILE_KEY = 'narvaro.mobile.v1';
const MOBILE_AUTO: MobilePref = 'auto';
/** Senast valda stämpeln i mobilläget (ett id, ingen personuppgift). */
const MOBILE_STAMP_KEY = 'narvaro.stamp.v1';

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

  // Varje klass senaste tabell, och de valda klasserna som en tabell.
  const latest = useMemo(() => latestSheets(sync.data.tables, weekKey), [sync.data.tables, weekKey]);
  const classNames = Object.keys(latest).filter(Boolean).sort((a, b) => a.localeCompare(b, 'sv'));
  const unnamed = latest[''] ?? null;
  const allClasses = unnamed ? [...classNames, ''] : classNames;
  const [chosen, setChosen] = usePersistentState(VIEW_KEY, sanitizeView, NO_CLASSES);
  // Alltid i klassernas ordning, oavsett i vilken ordning de valdes.
  const picked = allClasses.filter(c => chosen.includes(c));
  const selected = picked.length ? picked : allClasses.slice(0, 1);
  const selectedKey = selected.join('+');
  const savedTable = useMemo(() => {
    if (!selected.length) return null;
    const sheets = Object.fromEntries(Object.entries(latest).map(([k, ref]) => [k, ref.table]));
    return combineSheets(sheets, selected);
    // selectedKey står för `selected`, som är en ny lista varje rendering.
  }, [latest, selectedKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const stamps = sync.data.stamps;
  const savedNotes = sync.data.notes;
  const savedGroups = sync.data.groups;
  const savedPassNames = sync.data.passNames;
  const setStamps = (next: Stamp[]) => update(d => ({ ...d, stamps: next }));
  const setSavedNotes = (next: NotesStore) => update(d => ({ ...d, notes: next }));
  const setSavedGroups = (next: GroupsStore) => update(d => ({ ...d, groups: next }));
  const toggleClass = (klass: string) => {
    const next = selected.includes(klass) ? selected.filter(c => c !== klass) : [...selected, klass];
    if (next.length) setChosen(next);
  };

  // Exemplet har egna anteckningar och grupper i minnet, så att det inte
  // blandas med de riktiga.
  const [showExample, setShowExample] = useState(false);
  const [exNotes, setExNotes] = useState<NotesStore>({});
  const [exGroups, setExGroups] = useState<GroupsStore>({});
  const [exPassNames, setExPassNames] = useState<PassNames>({});
  const isExample = !savedTable || showExample;
  const table = isExample ? example : savedTable;
  const notes = isExample ? exNotes : savedNotes;
  const groups = isExample ? exGroups : savedGroups;
  const passNames = isExample ? exPassNames : savedPassNames;
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
  const [pending, setPending] = useState<PendingPaste | null>(null);
  const [newClass, setNewClass] = useState('');
  const [justSaved, setJustSaved] = useState<string | null>(null);
  const [nameUnnamed, setNameUnnamed] = useState('');
  const [armedSheet, setArmedSheet] = useState<string | null>(null);
  const [pasteText, setPasteText] = useState('');
  const [pasteMsg, setPasteMsg] = useState<PasteMessage>(null);
  const [pasteRaw, setPasteRaw] = useState('');
  const [toast, setToast] = useState<string | null>(null);
  const [copyFallback, setCopyFallback] = useState<string | null>(null);
  const [armedDelete, setArmedDelete] = useState<string | null>(null);
  // Rutan för passets namn: utkastet, eller null när den är stängd.
  const [naming, setNaming] = useState<string | null>(null);
  // Ett tidigare pass som får nytt namn (högerklick i Tidigare pass).
  const [renaming, setRenaming] = useState<{ key: string; draft: string } | null>(null);

  const [mobilePref, setMobilePref] = usePersistentState(MOBILE_KEY, sanitizeMobilePref, MOBILE_AUTO);
  const smallScreen = useMediaQuery('(max-width: 639px)');
  const mobile = isMobileMode(mobilePref, smallScreen) && sync.phase === 'ready';
  const [mobileStamp, setMobileStamp] = usePersistentState(MOBILE_STAMP_KEY, sanitizeStampId, '');
  const [mobileView, setMobileView] = useState<MobileView>('class');
  const [pickerOpen, setPickerOpen] = useState(false);
  useWakeLock(mobile);

  // Första riktiga tabellen: välj dagens veckodag och passet som pågår.
  // Byts sedan klasser behålls dag och pass, så länge de finns kvar.
  const shownKind = isExample ? 'example' : 'real';
  const initialized = useRef<string | null>(null);
  useEffect(() => {
    setKlass(k => (k === 'all' || table.groups.includes(k) ? k : 'all'));
    if (initialized.current !== shownKind) {
      initialized.current = shownKind;
      const d = defaultDay(table, now);
      setDay(d);
      setPass(defaultPass(table, d, now));
      return;
    }
    const d = table.days.includes(day) ? day : defaultDay(table, now);
    if (d !== day) setDay(d);
    setPass(p => (p === 'day' || dayColumns(table, d).some(c => c.id === p) ? p : defaultPass(table, d, now)));
  }, [table, now, shownKind]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 1600);
    return () => clearTimeout(t);
  }, [toast]);

  const key = sessionKey(table, day, pass, now);
  // Passets namn hör till passet och klassen; visas flera klasser får alla samma.
  const nameClasses = isExample ? ['exempel'] : selected;
  const label = sessionLabel(table, day, pass, now, passNameFor(passNames, key, nameClasses));
  const sess: SessionNotes = notes[key] ?? emptySession(label);
  const { present, absent } = roster(table, { klass, day, pass, added: sess.added });
  // Grupperna hör till passet och till de klasser som visas tillsammans.
  const gKey = groupsKey(key, nameClasses);
  const excludedHere = useMemo(() => new Set(excluded[gKey] ?? []), [excluded, gKey]);
  const active = present.filter(p => !excludedHere.has(p.name)).map(p => p.name);
  const stored = groups[gKey]?.groups;
  const view = stored ? groupView(stored, active) : null;
  const showSchool = klass === 'all' && table.groups.length > 1;
  const showClassName = !isExample && selected.length > 1;

  const updateSession = (fn: (s: SessionNotes) => SessionNotes) =>
    setNotes({ ...notes, [key]: { ...fn(sess), label } });
  // Ett tidigare pass får sin rubrik från den sparade, eftersom dess tabell kan vara en annan veckas.
  const savePassName = (name: string, k = key) => {
    const labelFor = k === key
      ? (n: string) => sessionLabel(table, day, pass, now, n)
      : (n: string) => relabelSession(notes[k]?.label ?? '', n);
    const sel = { key: k, classes: nameClasses, name, labelFor };
    if (isExample) {
      const r = namePass(exNotes, exPassNames, sel);
      setExNotes(r.notes);
      setExPassNames(r.passNames);
    } else update(d => ({ ...d, ...namePass(d.notes, d.passNames, sel) }));
    setNaming(null);
    setRenaming(null);
  };
  useEffect(() => setNaming(null), [key]);
  const saveGroups = (next: string[][]) =>
    setGroups(trimSessions({ ...groups, [gKey]: { groups: next } }, MAX_STORED_GROUP_SESSIONS));

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

  /** Sparar tabellen som klassens för veckan och visar klassen. */
  const saveAs = useCallback((klass: string, table: AttendanceTable, suggestion: ClassSuggestion | null) => {
    update(d => setSheet(d, weekKey, klass, table));
    setChosen([klass]);
    setPending(null);
    setNewClass('');
    setJustSaved(klass);
    setShowExample(false);
    const schools = table.groups.length ? ` från ${table.groups.length} skolor` : '';
    const known = suggestion && suggestion.klass === klass ? ` ${suggestion.matched} av ${suggestion.total} namn kändes igen.` : '';
    setPasteMsg({
      kind: 'ok',
      text: `${klass}: ${table.people.length} deltagare${schools} och ${table.cols.length} pass för vecka ${weekNumber(weekKey)}.${known}`,
    });
  }, [update, weekKey, setChosen]);

  const handlePaste = useCallback((text: string, html: string) => {
    const parsed = parsePasted(text, html);
    setJustSaved(null);
    if (!parsed) {
      setPending(null);
      setPasteMsg({ kind: 'error', text: 'Hittade inga kryssrutor. Kopiera cellerna i arket, inte en bild.' });
      setPasteRaw(pastePreview(text, html));
      return;
    }
    setPasteOpen(true);
    setPasteRaw('');
    setPasteText('');
    // Känns namnen igen sparas tabellen direkt som den klassen; annars frågar sidan.
    const suggestion = suggestClass(parsed, knownClasses(sync.data.tables));
    if (suggestion && isConfident(suggestion)) {
      saveAs(suggestion.klass, parsed, suggestion);
      return;
    }
    setPending({ table: parsed, suggestion });
    setPasteMsg(null);
  }, [sync.data.tables, saveAs]);

  /** Flyttar den nyss sparade tabellen till en annan klass. */
  const moveJustSaved = (to: string) => {
    if (!justSaved || !to || to === justSaved) return;
    const table = sync.data.tables[weekKey]?.[justSaved];
    if (!table) return;
    update(d => setSheet(removeSheet(d, weekKey, justSaved), weekKey, to, table));
    setChosen([to]);
    setJustSaved(to);
    setNewClass('');
    setPasteMsg({ kind: 'ok', text: `Flyttad till ${to}.` });
  };

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
      const cur = excluded[gKey] ?? [];
      setExcluded({ ...excluded, [gKey]: cur.includes(name) ? cur.filter(n => n !== name) : [...cur, name] });
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
        {!mobile && (
        <div className="sp-toolbar flex flex-col items-start gap-4 p-4 lg:flex-row lg:items-center">
          <FeatureNavigation />
          <p className="font-mono text-xs uppercase tracking-wider text-ui-muted">Vecka {isoWeek(now)} · {weekday}</p>
          {sync.phase === 'ready' && (
            <div className="flex flex-wrap items-center gap-2 lg:ml-auto">
              <SaveIndicator status={sync.saveStatus} />
              <Button variant="neutral" className="sp-btn" onClick={() => setMobilePref('on')} title="Stora rutor och stämplar i tummens räckvidd">
                <Smartphone /> Mobilläge
              </Button>
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
        )}

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
        {mobile && (
          <NarvaroMobileHeader
            label={label}
            count={present.length}
            status={<SaveIndicator status={sync.saveStatus} />}
            view={mobileView}
            onView={setMobileView}
            hasGroups={!!stored}
            pickerOpen={pickerOpen}
            onTogglePicker={() => setPickerOpen(o => !o)}
            onExit={() => { setMobilePref('off'); setPickerOpen(false); }}
          />
        )}
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

        {showPaste && !mobile && (
          <section className="sp-card flex flex-col gap-3 p-4" aria-label="Klistra in">
            <h2 className="text-lg font-bold">Klistra in en klass från Google Kalkylark</h2>
            <ol className="ml-5 list-decimal text-sm">
              <li>Markera hela tabellen i klassens ark, med dag- och tidsraderna överst (till exempel A1:Q34).</li>
              <li>Kopiera med Ctrl+C, eller Cmd+C på Mac.</li>
              <li>Klicka i rutan nedan och klistra in. Gör likadant för varje klass.</li>
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
            {pending && (
              <ClassPicker
                title={`Vilken klass är det här? ${pending.table.people.length} deltagare och ${pending.table.cols.length} pass.`}
                hint={pending.suggestion
                  ? `${pending.suggestion.matched} av ${pending.suggestion.total} namn finns i ${pending.suggestion.klass}.`
                  : classNames.length ? 'Inga av namnen känns igen.' : 'Ge klassen ett namn, till exempel Rosa.'}
                classes={classNames}
                suggested={pending.suggestion?.klass}
                newName={newClass}
                onNewName={setNewClass}
                onPick={k => saveAs(k, pending.table, pending.suggestion)}
                onCancel={() => { setPending(null); setNewClass(''); }}
              />
            )}
            {justSaved && !pending && (
              <details className="text-sm">
                <summary className="cursor-pointer text-ui-muted underline">Fel klass?</summary>
                <ClassPicker
                  title={`Flytta tabellen från ${justSaved} till:`}
                  classes={classNames.filter(c => c !== justSaved)}
                  newName={newClass}
                  onNewName={setNewClass}
                  onPick={moveJustSaved}
                />
              </details>
            )}
            {allClasses.length > 0 && (
              <div className="flex flex-col gap-1.5 text-sm">
                <span className="font-mono text-2xs font-bold uppercase tracking-widest text-ui-muted">Klasser</span>
                <ul className="flex flex-wrap gap-2">
                  {allClasses.map(k => {
                    const ref = latest[k];
                    const thisWeek = ref.week === weekKey;
                    const id = `${ref.week}|${k}`;
                    return (
                      <li key={k} className="flex items-center gap-1.5 rounded-ui-sm border border-ui-line bg-ui-paper px-2 py-0.5">
                        <span className="font-semibold">{classLabel(k)}</span>
                        <span className="text-xs text-ui-muted">
                          {thisWeek ? `vecka ${weekNumber(weekKey)}` : `från vecka ${weekNumber(ref.week)}`} · {ref.table.people.length} deltagare
                        </span>
                        {thisWeek && (
                          <button
                            type="button"
                            className="text-xs text-ui-muted underline"
                            onClick={() => {
                              if (armedSheet !== id) { setArmedSheet(id); return; }
                              update(d => removeSheet(d, weekKey, k));
                              setArmedSheet(null);
                            }}
                          >
                            {armedSheet === id ? 'Säker? Tryck igen' : 'Ta bort'}
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ul>
                <p className="text-xs text-ui-muted">Ta bort gäller bara veckans tabell. Noteringarna finns kvar.</p>
              </div>
            )}
            {pasteRaw && (
              <details className="flex flex-col gap-1.5">
                <summary className="cursor-pointer text-sm font-semibold">Så här såg det inklistrade ut (de första raderna)</summary>
                <textarea readOnly rows={8} value={pasteRaw} className="sp-input my-1.5 w-full whitespace-pre rounded-ui-sm bg-ui-surface-2 p-2 font-mono text-2xs" />
                <Button variant="neutral" size="sm" className="sp-btn self-start" onClick={() => copyText(pasteRaw)}>Kopiera</Button>
              </details>
            )}
            <p className="text-xs text-ui-muted">
              Allt krypteras här innan det sparas, och servern kan inte läsa något. Tabellen sparas för vecka{' '}
              {weekNumber(weekKey)}. Klistra in på nytt när arket har uppdaterats.
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
        {!isExample && unnamed && !mobile && (
          <section className="sp-toast flex flex-col gap-2 bg-ui-mark-yellow px-4 py-3 text-sm text-ui-mark-fg" aria-label="Tabell utan klass">
            <ClassPicker
              title={`En tabell från vecka ${weekNumber(unnamed.week)} har ingen klass än (${unnamed.table.people.length} deltagare). Vilken klass är den?`}
              classes={classNames}
              newName={nameUnnamed}
              onNewName={setNameUnnamed}
              onPick={k => {
                update(d => renameClass(d, '', k));
                setChosen(Array.from(new Set([...selected.filter(c => c !== ''), k])));
                setNameUnnamed('');
              }}
            />
          </section>
        )}
        {!isExample && selected.some(k => latest[k] && latest[k].week !== weekKey) && (
          <div className="sp-toast bg-ui-mark-yellow px-4 py-2 text-sm font-semibold text-ui-mark-fg">
            {selected.filter(k => latest[k] && latest[k].week !== weekKey)
              .map(k => `${classLabel(k)}: tabellen är från vecka ${weekNumber(latest[k].week)}.`).join(' ')}{' '}
            Klistra in veckans ark när du har det.
          </div>
        )}

        {(!mobile || pickerOpen) && (
        <section className="sp-card flex flex-col gap-3 p-4" aria-label="Urval">
          {!isExample && allClasses.length > 1 && (
            <ChipRow label="Klass">
              {allClasses.map(k => (
                <button
                  key={k}
                  type="button"
                  className={chip(selected.includes(k))}
                  aria-pressed={selected.includes(k)}
                  onClick={() => toggleClass(k)}
                  title="Välj flera för att visa klasserna tillsammans"
                >
                  {classLabel(k)}
                  {latest[k].week !== weekKey && <small className="font-mono text-2xs opacity-70">v. {weekNumber(latest[k].week)}</small>}
                </button>
              ))}
            </ChipRow>
          )}
          {table.groups.length > 1 && (
            <ChipRow label="Skola">
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
            {naming === null ? (
              <button
                type="button"
                className={chip(false)}
                aria-label="Namnge passet"
                title="Namnge passet"
                onClick={() => setNaming(passNameFor(passNames, key, nameClasses))}
              >
                <PenLine size={14} />
              </button>
            ) : (
              <form
                className="flex gap-1.5"
                onSubmit={e => { e.preventDefault(); savePassName(naming); }}
                onKeyDown={e => { if (e.key === 'Escape') { e.stopPropagation(); setNaming(null); } }}
              >
                <input
                  autoFocus
                  value={naming}
                  onChange={e => setNaming(e.target.value)}
                  maxLength={MAX_PASS_NAME_LENGTH}
                  placeholder="Passets namn, t.ex. Svenska"
                  aria-label="Passets namn"
                  title="Tomt namn tar bort det"
                  className="sp-input w-48 rounded-ui-sm bg-ui-paper px-2 py-1 text-sm"
                />
                <Button type="submit" variant="neutral" size="sm" className="sp-btn">Spara</Button>
              </form>
            )}
          </ChipRow>

          {!mobile && (<>
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
          </>)}
        </section>
        )}

        {mobile && (
          <NarvaroMobile
            sessKey={key}
            view={stored ? mobileView : 'class'}
            present={present}
            absent={absent}
            sess={sess}
            stamps={stamps}
            activeStamp={pickActiveStamp(stamps, mobileStamp)}
            onPickStamp={setMobileStamp}
            storedGroups={stored}
            detail={p => [splitName(p.name)[1], showClassName && p.klass, showSchool && p.group].filter(Boolean).join(' · ')}
            onSetStamp={(name, id, on) => updateSession(s => setStampOn(s, name, id, on))}
            onEdit={setEditing}
            onAdd={addPerson}
          />
        )}

        {!mobile && (<>

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
                  {[last, showClassName && p.klass, showSchool && p.group].filter(Boolean).join(' · ')}
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
              <Button variant="neutral" size="sm" className="sp-btn" disabled={!entries.length} onClick={() => copyText(sessionText({ ...sess, label }, table, stamps))}>
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
            {groupByWeek(history).map((group, i) => (
              <details key={group.week ?? ''} open={i === 0} className="border-t border-ui-line py-2">
                <summary className="cursor-pointer font-mono text-xs font-semibold tracking-wider text-ui-muted">
                  {weekHeading(group.week, weekKey)} · {group.keys.length} pass
                </summary>
                {group.keys.map(k => renaming?.key === k ? (
                  <form
                    key={k}
                    className="ml-4 flex flex-wrap items-center gap-1.5 border-t border-ui-hair py-2"
                    onSubmit={e => { e.preventDefault(); savePassName(renaming.draft, k); }}
                    onKeyDown={e => { if (e.key === 'Escape') { e.stopPropagation(); setRenaming(null); } }}
                  >
                    <input
                      autoFocus
                      value={renaming.draft}
                      onChange={e => setRenaming({ key: k, draft: e.target.value })}
                      maxLength={MAX_PASS_NAME_LENGTH}
                      placeholder="Passets namn, t.ex. Svenska"
                      aria-label={`Namn på passet ${notes[k].label}`}
                      title="Tomt namn tar bort det"
                      className="sp-input w-48 rounded-ui-sm bg-ui-paper px-2 py-1 text-sm"
                    />
                    <Button type="submit" variant="neutral" size="sm" className="sp-btn">Spara</Button>
                    <Button type="button" variant="neutral" size="sm" className="sp-btn" onClick={() => setRenaming(null)}>Avbryt</Button>
                  </form>
                ) : (
                  <details key={k} className="ml-4 border-t border-ui-hair py-2">
                    <summary
                      className="cursor-pointer font-semibold"
                      title="Högerklicka för att namnge passet"
                      onContextMenu={e => { e.preventDefault(); setRenaming({ key: k, draft: passNameFor(passNames, k, nameClasses) }); }}
                    >
                      {notes[k].label}
                    </summary>
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
              </details>
            ))}
          </section>
        )}
        </>)}
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
        <div
          role="status"
          className={cn(
            'sp-toast fixed left-1/2 z-[1500] -translate-x-1/2 bg-ui-ink px-4 py-2 text-sm font-semibold text-ui-paper',
            mobile ? 'bottom-36' : 'bottom-5',
          )}
        >
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

type ClassPickerProps = {
  title: string;
  hint?: string;
  classes: string[];
  suggested?: string;
  newName: string;
  onNewName: (name: string) => void;
  onPick: (klass: string) => void;
  onCancel?: () => void;
};

/** Välj en befintlig klass eller skriv en ny. */
function ClassPicker({ title, hint, classes, suggested, newName, onNewName, onPick, onCancel }: ClassPickerProps) {
  const name = cleanClassName(newName);
  return (
    <div className="flex flex-col gap-2">
      <p className="font-semibold">{title}</p>
      {hint && <p className="text-sm">{hint}</p>}
      <div className="flex flex-wrap items-center gap-2">
        {[...classes].sort((a, b) => (a === suggested ? -1 : b === suggested ? 1 : 0)).map(k => (
          <button
            key={k}
            type="button"
            onClick={() => onPick(k)}
            className={cn(chip(k === suggested), 'text-sm')}
          >
            {k}
          </button>
        ))}
        <form
          className="flex gap-1.5"
          onSubmit={e => { e.preventDefault(); if (name) onPick(name); }}
        >
          <input
            value={newName}
            onChange={e => onNewName(e.target.value)}
            maxLength={MAX_CLASS_NAME_LENGTH}
            placeholder="Ny klass"
            aria-label="Ny klass"
            className="sp-input w-32 rounded-ui-sm bg-ui-paper px-2 py-1 text-sm text-ui-ink"
          />
          <Button type="submit" variant="neutral" size="sm" className="sp-btn" disabled={!name}>Spara</Button>
        </form>
        {onCancel && <button type="button" className="text-sm text-ui-muted underline" onClick={onCancel}>Avbryt</button>}
      </div>
    </div>
  );
}
