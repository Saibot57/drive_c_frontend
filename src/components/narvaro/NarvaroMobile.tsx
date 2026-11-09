'use client';

import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronUp, PenLine, Undo2, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { STAMP_BG, StampTag } from '@/components/narvaro/stampStyle';
import type { AttendancePerson, SessionNotes, Stamp } from '@/utils/narvaro';
import { mobileSections, pushUndo, type MobileView, type UndoEntry } from '@/utils/narvaroMobile';

/**
 * Mobilläget i Närvarorutor, för att gå runt bland deltagarna med telefonen:
 * en aktiv stämpel väljs i listan längst ned, och ett tryck på en namnruta
 * sätter eller tar bort den. Ett långt tryck öppnar noteringen.
 *
 * Huvudet och rutorna är två komponenter, så att Narvaro kan visa passvalet
 * mellan dem.
 */

const LONG_PRESS_MS = 500;
const MOVE_TOLERANCE = 10;

const vibrate = (ms: number) => {
  try { navigator.vibrate?.(ms); } catch { /* finns inte överallt, t.ex. iPhone */ }
};

const splitName = (name: string) => {
  const [first, ...rest] = name.split(/\s+/);
  return [first, rest.join(' ')] as const;
};

type HeaderProps = {
  label: string;
  count: number;
  status: React.ReactNode;
  view: MobileView;
  onView: (view: MobileView) => void;
  hasGroups: boolean;
  pickerOpen: boolean;
  onTogglePicker: () => void;
  onExit: () => void;
};

/** Den kompakta raden överst: passet, vyn och vägen ut. */
export function NarvaroMobileHeader({
  label, count, status, view, onView, hasGroups, pickerOpen, onTogglePicker, onExit,
}: HeaderProps) {
  const shown = hasGroups ? view : 'class';
  return (
    <header className="sp-toolbar sticky top-0 z-20 flex flex-col gap-2 p-3">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onTogglePicker}
          aria-expanded={pickerOpen}
          className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
          title="Byt klass, dag eller pass"
        >
          <span className="truncate text-lg font-bold leading-tight">{label}</span>
          {pickerOpen ? <ChevronUp size={18} className="shrink-0" /> : <ChevronDown size={18} className="shrink-0" />}
        </button>
        <button
          type="button"
          onClick={onExit}
          aria-label="Lämna mobilläget"
          title="Lämna mobilläget"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-ui-sm border-frame border-ui-line bg-ui-paper"
        >
          <X size={18} />
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
        <div role="group" aria-label="Visa" className="flex overflow-hidden rounded-ui-sm border-frame border-ui-line">
          {(['class', 'groups'] as const).map(v => (
            <button
              key={v}
              type="button"
              aria-pressed={shown === v}
              disabled={v === 'groups' && !hasGroups}
              onClick={() => onView(v)}
              className={cn(
                'px-2.5 py-1.5 text-sm font-semibold [&+&]:border-l-frame [&+&]:border-ui-line disabled:opacity-50',
                shown === v ? 'bg-ui-ink text-ui-paper' : 'bg-ui-paper',
              )}
            >
              {v === 'class' ? 'Klassen' : 'Grupper'}
            </button>
          ))}
        </div>
        <span className="text-sm"><b className="tabular-nums">{count}</b> närvarande</span>
      </div>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-ui-muted">{!hasGroups && 'Inga grupper för passet.'}</p>
        <span className="shrink-0">{status}</span>
      </div>
    </header>
  );
}

type Props = {
  /** Passets nyckel. Ångra gäller bara det aktuella passet. */
  sessKey: string;
  view: MobileView;
  present: AttendancePerson[];
  absent: AttendancePerson[];
  sess: SessionNotes;
  stamps: readonly Stamp[];
  activeStamp: string | null;
  onPickStamp: (id: string) => void;
  storedGroups: string[][] | undefined;
  /** Raden under förnamnet: efternamn, klass och skola. */
  detail: (person: AttendancePerson) => string;
  onSetStamp: (name: string, stampId: string, on: boolean) => void;
  onEdit: (name: string) => void;
  onAdd: (name: string) => void;
};

type Press = { name: string; x: number; y: number; timer: ReturnType<typeof setTimeout> | null; fired: boolean };

/** Rutorna, de frånvarande och stämpellisten längst ned. */
export function NarvaroMobile({
  sessKey, view, present, absent, sess, stamps, activeStamp, onPickStamp, storedGroups, detail,
  onSetStamp, onEdit, onAdd,
}: Props) {
  const [flash, setFlash] = useState<string | null>(null);
  const [undo, setUndo] = useState<UndoEntry[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const press = useRef<Press | null>(null);
  const bar = useRef<HTMLDivElement>(null);

  const undoHere = undo.filter(e => e.key === sessKey);
  const byName = new Map(present.map(p => [p.name, p]));
  const sections = mobileSections(view, present.map(p => p.name), storedGroups);
  const stampLabel = (id: string) => stamps.find(s => s.id === id)?.label ?? '';

  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => setMessage(null), 1800);
    return () => clearTimeout(t);
  }, [message]);
  useEffect(() => () => { if (press.current?.timer) clearTimeout(press.current.timer); }, []);
  // Den aktiva stämpeln rullas fram i listan, även när den valts på en annan enhet.
  useEffect(() => {
    bar.current?.querySelector<HTMLElement>('[aria-pressed="true"]')
      ?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [activeStamp]);

  const blink = (name: string) => {
    setFlash(name);
    setTimeout(() => setFlash(f => (f === name ? null : f)), 350);
  };

  const openNote = (name: string) => {
    vibrate(30);
    onEdit(name);
  };

  const tap = (name: string) => {
    if (!activeStamp) { onEdit(name); return; }
    const on = !(sess.people[name]?.tags.includes(activeStamp) ?? false);
    onSetStamp(name, activeStamp, on);
    setUndo(u => pushUndo(u, { key: sessKey, name, stampId: activeStamp, on }));
    blink(name);
    vibrate(15);
  };

  const undoLast = () => {
    const last = undoHere[undoHere.length - 1];
    if (!last) return;
    onSetStamp(last.name, last.stampId, !last.on);
    setUndo(undoHere.slice(0, -1));
    blink(last.name);
    const first = splitName(last.name)[0];
    setMessage(last.on
      ? `Ångrat: ”${stampLabel(last.stampId)}” bort från ${first}`
      : `Ångrat: ”${stampLabel(last.stampId)}” tillbaka på ${first}`);
  };

  /* ---------- långt tryck ---------- */

  const stopTimer = () => {
    const p = press.current;
    if (p?.timer) { clearTimeout(p.timer); p.timer = null; }
  };
  const onPointerDown = (e: React.PointerEvent, name: string) => {
    if (e.button > 0) return;
    stopTimer();
    const p: Press = { name, x: e.clientX, y: e.clientY, timer: null, fired: false };
    p.timer = setTimeout(() => {
      p.timer = null;
      p.fired = true;
      openNote(name);
    }, LONG_PRESS_MS);
    press.current = p;
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const p = press.current;
    if (p?.timer && Math.hypot(e.clientX - p.x, e.clientY - p.y) > MOVE_TOLERANCE) stopTimer();
  };
  const onClick = (name: string) => {
    const p = press.current;
    press.current = null;
    if (p?.fired && p.name === name) return; // klicket efter ett långt tryck
    tap(name);
  };
  // Högerklick, och Androids eget långa tryck, öppnar noteringen en gång.
  const onContextMenu = (e: React.MouseEvent, name: string) => {
    e.preventDefault();
    const p = press.current;
    if (p?.fired && p.name === name) return;
    stopTimer();
    press.current = { name, x: 0, y: 0, timer: null, fired: true };
    openNote(name);
  };

  return (
    <>
      <div className="flex flex-col gap-4 pb-36">
        {present.length === 0 && (
          <div className="sp-card p-6 text-center text-sm text-ui-muted">
            Ingen är markerad för det här passet än. Byt pass, eller lägg till personer nedan.
          </div>
        )}
        {sections.map((section, i) => (
          <section key={section.title ?? i} className="flex flex-col gap-2" aria-label={section.title ?? 'Klassen'}>
            {section.title && (
              <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-ui-muted">
                {section.title} · {section.names.length}
              </h3>
            )}
            <div className="grid gap-2 [grid-template-columns:repeat(auto-fill,minmax(140px,1fr))]">
              {section.names.map(name => {
                const person = byName.get(name);
                const n = sess.people[name];
                const has = !!activeStamp && !!n?.tags.includes(activeStamp);
                const [first] = splitName(name);
                return (
                  <button
                    key={name}
                    type="button"
                    aria-pressed={has}
                    onPointerDown={e => onPointerDown(e, name)}
                    onPointerMove={onPointerMove}
                    onPointerUp={stopTimer}
                    onPointerCancel={stopTimer}
                    onPointerLeave={stopTimer}
                    onClick={() => onClick(name)}
                    onContextMenu={e => onContextMenu(e, name)}
                    className={cn(
                      'sp-card-sm relative flex min-h-[72px] min-w-0 select-none flex-col gap-0.5 p-2.5 text-left [-webkit-touch-callout:none] [touch-action:manipulation]',
                      'transition-transform active:translate-x-boxShadowX active:translate-y-boxShadowY',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ui-focus)] focus-visible:ring-offset-2',
                      has && 'ring-2 ring-[var(--ui-focus)]',
                      flash === name && 'bg-ui-mark-yellow',
                    )}
                  >
                    {n?.note && <PenLine size={13} className="absolute right-2 top-2" aria-label="Har notering" />}
                    <span className="break-words pr-4 text-lg font-bold leading-tight">{first}</span>
                    {person && <span className="truncate text-xs text-ui-muted">{detail(person)}</span>}
                    {!!n?.tags.length && (
                      <span className="mt-0.5 flex flex-wrap gap-1">
                        {n.tags.map(id => <StampTag key={id} stamp={stamps.find(s => s.id === id)} small />)}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </section>
        ))}

        {absent.length > 0 && (
          <details className="sp-card p-3">
            <summary className="cursor-pointer text-sm font-semibold">Inte markerade ({absent.length})</summary>
            <div className="mt-2 flex flex-wrap gap-2">
              {absent.map(p => (
                <button
                  key={p.name}
                  type="button"
                  onClick={() => onAdd(p.name)}
                  className="rounded-ui-sm border-2 border-dashed border-ui-line bg-ui-paper px-3 py-2 text-sm text-ui-muted"
                >
                  + {p.name}
                </button>
              ))}
            </div>
          </details>
        )}
      </div>

      {message && (
        <div role="status" className="sp-toast fixed bottom-24 left-1/2 z-[1500] -translate-x-1/2 whitespace-nowrap bg-ui-ink px-4 py-2 text-sm font-semibold text-ui-paper">
          {message}
        </div>
      )}

      <nav
        aria-label="Stämplar"
        className="fixed inset-x-0 bottom-0 z-30 border-t-frame border-ui-line bg-ui-paper pb-[env(safe-area-inset-bottom)]"
      >
        <div className="flex items-center gap-2 px-3 py-2.5">
          <div ref={bar} className="flex min-w-0 flex-1 gap-2 overflow-x-auto p-1">
            {stamps.length ? stamps.map(s => (
              <button
                key={s.id}
                type="button"
                aria-pressed={activeStamp === s.id}
                onClick={() => onPickStamp(s.id)}
                className={cn(
                  'min-h-[44px] shrink-0 whitespace-nowrap rounded-ui-sm border-frame border-ui-line px-3 text-sm font-semibold text-ui-mark-fg',
                  STAMP_BG[s.color],
                  activeStamp === s.id ? 'ring-2 ring-[var(--ui-focus)] ring-offset-2' : 'opacity-70',
                )}
              >
                {s.label}
              </button>
            )) : <span className="self-center text-sm text-ui-muted">Inga stämplar. Tryck på ett namn för att skriva.</span>}
          </div>
          <button
            type="button"
            onClick={undoLast}
            disabled={!undoHere.length}
            aria-label={`Ångra${undoHere.length ? ` (${undoHere.length})` : ''}`}
            title="Ångra senaste trycket"
            className="flex min-h-[44px] shrink-0 items-center gap-1 rounded-ui-sm border-frame border-ui-line bg-ui-paper px-3 text-sm font-semibold disabled:opacity-40"
          >
            <Undo2 size={16} /> Ångra
          </button>
        </div>
      </nav>
    </>
  );
}
