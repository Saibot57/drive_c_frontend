'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import type { ScheduledEntry } from '@/types/schedule';
import { isMine, scheduleLineParts } from '@/utils/narvaroSchedule';

/**
 * Raden "Enligt schemat" i Närvarorutor: schemapassen som det valda passet
 * motsvarar, ett pass per rad med användarens egna först. Passen kommer
 * färdiga (filtrerade och sorterade) från Narvaro.
 *
 * `page` står under passvalet, `compact` på en rad i mobilhuvudet och
 * `muted` under ett tidigare pass.
 */

type Props = {
  entries: ScheduledEntry[];
  myName: string;
  resolveRoom: (title: string, room?: string) => string;
  /** Texten när inget pass hör till de valda klasserna. */
  emptyText: string;
  variant?: 'page' | 'compact' | 'muted';
  /** Lärarnamnen att välja bland när namnet inte är känt. */
  teacherNames?: string[];
  onChooseName?: (name: string) => void;
};

const SEP = ' · ';

function Line({ entry, myName, resolveRoom }: { entry: ScheduledEntry; myName: string; resolveRoom: Props['resolveRoom'] }) {
  const parts = scheduleLineParts(entry, resolveRoom);
  const me = myName.trim().toLocaleLowerCase('sv');
  const teachers = parts.teachers.map((t, i) => (
    <React.Fragment key={`${t}-${i}`}>
      {i > 0 && ', '}
      {me && t.toLocaleLowerCase('sv') === me ? <b className="font-bold">{t}</b> : t}
    </React.Fragment>
  ));
  const items: React.ReactNode[] = [
    <span key="t" className={cn(isMine(entry, myName) && 'font-bold')}>{parts.title}</span>,
    parts.teachers.length ? <span key="l">{teachers}</span> : null,
    parts.room ? <span key="r">{parts.room}</span> : null,
    parts.notes ? <span key="n">{parts.notes}</span> : null,
  ].filter(Boolean);
  return <>{items.map((item, i) => <React.Fragment key={i}>{i > 0 && SEP}{item}</React.Fragment>)}</>;
}

/** Texten som en sträng, för den kompakta raden och för titeln vid hovring. */
const plainText = (entries: ScheduledEntry[], resolveRoom: Props['resolveRoom']) => entries.map(e => {
  const p = scheduleLineParts(e, resolveRoom);
  return [p.title, p.teachers.join(', '), p.room, p.notes].filter(Boolean).join(SEP);
}).join(' / ');

export function NarvaroScheduleLine({
  entries, myName, resolveRoom, emptyText, variant = 'page', teacherNames = [], onChooseName,
}: Props) {
  if (variant === 'compact') {
    const text = entries.length ? plainText(entries, resolveRoom) : emptyText;
    return (
      <p className={cn('truncate text-xs', !entries.length && 'text-ui-muted')} title={text}>
        {entries.length ? <>Enligt schemat: {text}</> : text}
      </p>
    );
  }

  const ask = !myName && !!onChooseName && teacherNames.length > 0;
  const picker = ask && (
    <label className="inline-flex items-center gap-1.5 text-xs text-ui-muted">
      Vem är du i schemat?
      <select
        value=""
        onChange={e => { if (e.target.value) onChooseName?.(e.target.value); }}
        className="sp-input rounded-ui-sm bg-ui-paper px-1.5 py-0.5 text-xs text-ui-ink"
      >
        <option value="">Välj</option>
        {teacherNames.map(n => <option key={n} value={n}>{n}</option>)}
      </select>
    </label>
  );

  return (
    <div className={cn('flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5', variant === 'muted' ? 'text-xs text-ui-muted' : 'text-sm')}>
      {entries.length ? (<>
        <span className="shrink-0 text-ui-muted">Enligt schemat:</span>
        <ul className="flex min-w-0 flex-col gap-0.5">
          {entries.map(e => (
            <li key={e.instanceId} className="break-words">
              <Line entry={e} myName={myName} resolveRoom={resolveRoom} />
            </li>
          ))}
        </ul>
      </>) : (
        <span className="text-ui-muted">{emptyText}</span>
      )}
      {picker}
    </div>
  );
}
