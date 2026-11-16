'use client';

import React from 'react';
import { chip } from '@/components/narvaro/chip';
import { cn } from '@/lib/utils';
import type { AttendanceColumn, PassChoice } from '@/utils/narvaro';

/**
 * Dag- och Pass-chippen. På datorn väljs passet i veckokartan; mobilläget
 * behåller chippen i sitt passval.
 */

export function ChipRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid items-start gap-1 sm:grid-cols-[56px_1fr] sm:gap-3">
      <span className="pt-0 font-mono text-2xs font-bold uppercase tracking-widest text-ui-muted sm:pt-2">{label}</span>
      <div className="flex min-w-0 flex-wrap gap-2">{children}</div>
    </div>
  );
}

type Props = {
  days: string[];
  day: string;
  onDay: (day: string) => void;
  cols: AttendanceColumn[];
  pass: PassChoice;
  onPass: (pass: PassChoice) => void;
  /** Är någon markerad i kolumnen? Annars streckad. */
  hasMarks: (col: AttendanceColumn) => boolean;
  /** Pennan för passets namn, sist i Pass-raden. */
  naming?: React.ReactNode;
};

export function NarvaroPassChips({ days, day, onDay, cols, pass, onPass, hasMarks, naming }: Props) {
  return (
    <>
      <ChipRow label="Dag">
        {days.map(d => (
          <button key={d} type="button" className={chip(day === d)} aria-pressed={day === d} onClick={() => onDay(d)}>
            {d}
          </button>
        ))}
      </ChipRow>
      <ChipRow label="Pass">
        <button type="button" className={chip(pass === 'day')} aria-pressed={pass === 'day'} onClick={() => onPass('day')}>
          Hela dagen
        </button>
        {cols.map(c => {
          const any = hasMarks(c);
          return (
            <button
              key={c.id}
              type="button"
              className={cn(chip(pass === c.id), !any && pass !== c.id && 'border-dashed text-ui-muted')}
              aria-pressed={pass === c.id}
              title={any ? undefined : 'Ingen markerad än'}
              onClick={() => onPass(c.id)}
            >
              {c.pass}
              {c.letter && <small className="font-mono text-2xs opacity-70">{c.letter}</small>}
            </button>
          );
        })}
        {naming}
      </ChipRow>
    </>
  );
}
