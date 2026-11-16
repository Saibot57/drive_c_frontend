'use client';

import React from 'react';
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { chip } from '@/components/narvaro/chip';
import { ScheduleNamePicker } from '@/components/narvaro/NarvaroScheduleLine';
import { cn } from '@/lib/utils';
import type { PassChoice } from '@/utils/narvaro';
import { MapWeek, WeekMapCell, WeekMapDay, WeekMapMode, isCellSelected } from '@/utils/narvaroWeekMap';

/**
 * Veckokartan överst i Närvarorutor: en ruta per kolumn i arket och
 * veckodag, med schemats namn på passet. Klick väljer dag och pass.
 * Hopfälld visar den bara den valda dagen. Logiken finns i
 * `utils/narvaroWeekMap.ts`; se docs/plans/narvaro-veckokarta.md.
 */

type Props = {
  days: WeekMapDay[];
  day: string;
  pass: PassChoice;
  onPick: (day: string, pass: PassChoice) => void;
  /** Byt dag i hopfällt läge; sidan väljer passet som i dag. */
  onDay: (day: string) => void;
  mode: WeekMapMode;
  onMode: (mode: WeekMapMode) => void;
  /** "Vecka 47". */
  title: string;
  /** Veckoraden och pilarna. Saknas de visas bara rubriken. */
  weeks?: (MapWeek & { tone?: string; hint?: string })[];
  shownWeek?: string;
  onWeek?: (week: string) => void;
  onStepWeek?: (step: -1 | 1) => void;
  /** Etikett i huvudet, t.ex. när en tidigare vecka visas. */
  notice?: React.ReactNode;
  /** Klass-chippen, som sidan ritar. */
  classChips?: React.ReactNode;
  myName: string;
  teacherNames: string[];
  onChooseName: (name: string) => void;
  /** Veckans schema finns (annars förklaras det under kartan). */
  hasSchedule: boolean;
};

const shortDay = (day: string) => day.slice(0, 3);
const dateLabel = (d: WeekMapDay) => `${shortDay(d.day)} ${d.date.getDate()}/${d.date.getMonth() + 1}`;
const weekNumber = (weekKey: string) => weekKey.slice(-2).replace(/^0/, '');
const CELL_MIN_H = 64;
const CELL_GAP = 8;

function Cell({ cell, selected, onClick, tall }: { cell: WeekMapCell; selected: boolean; onClick: () => void; tall: boolean }) {
  const span = cell.columns.length;
  const who = [cell.teachers.join(', '), cell.more ? `+${cell.more} pass` : ''].filter(Boolean).join(', ');
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      title={cell.empty ? 'Ingen markerad än' : undefined}
      style={tall && span > 1 ? { minHeight: span * CELL_MIN_H + (span - 1) * CELL_GAP } : undefined}
      className={cn(
        'relative flex min-h-[64px] w-full min-w-0 flex-col gap-0.5 rounded-ui-sm border-frame border-ui-line px-2.5 py-2 text-left',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ui-focus)] focus-visible:ring-offset-2',
        selected ? 'bg-ui-ink text-ui-paper' : 'bg-ui-paper text-ui-ink hover:bg-ui-surface-3',
        cell.empty && !selected && 'border-dashed text-ui-muted',
      )}
    >
      <span className="font-mono text-2xs opacity-75">{cell.letters} · {cell.time || '–'}</span>
      <span className={cn('break-words text-sm leading-tight', cell.mine ? 'font-bold' : 'font-semibold')}>{cell.title}</span>
      <span className={cn('text-xs', selected ? 'text-ui-paper opacity-80' : 'text-ui-muted')}>
        {[who, `${cell.present} närv.`].filter(Boolean).join(' · ')}
      </span>
      {cell.hasNotes && (
        <span
          className={cn('absolute right-2 top-2 h-2 w-2 rounded-full', selected ? 'bg-ui-paper' : 'bg-ui-ink')}
          title="Har noteringar"
          aria-label="Har noteringar"
        />
      )}
    </button>
  );
}

export function NarvaroWeekMap({
  days, day, pass, onPick, onDay, mode, onMode, title, weeks, shownWeek, onWeek, onStepWeek, notice,
  classChips, myName, teacherNames, onChooseName, hasSchedule,
}: Props) {
  const dayHeader = (d: WeekMapDay) => (
    <div className="flex items-baseline justify-between gap-2">
      <span className={cn('font-mono text-2xs font-bold uppercase tracking-widest', d.isToday ? 'text-ui-ink' : 'text-ui-muted')}>
        {dateLabel(d)}{d.isToday && ' · idag'}
      </span>
      <button
        type="button"
        aria-pressed={day === d.day && pass === 'day'}
        onClick={() => onPick(d.day, 'day')}
        className={cn(
          'rounded-ui-sm px-1 text-xs underline-offset-2 hover:underline',
          day === d.day && pass === 'day' ? 'bg-ui-ink font-semibold text-ui-paper' : 'text-ui-muted',
        )}
      >
        Hela dagen
      </button>
    </div>
  );

  const weekNav = (
    <div className="flex items-center gap-2">
      {onStepWeek && (
        <Button variant="neutral" size="icon" className="sp-btn h-8 w-8" aria-label="Veckan före" onClick={() => onStepWeek(-1)}>
          <ChevronLeft />
        </Button>
      )}
      <h2 className="text-lg font-bold">{title}</h2>
      {onStepWeek && (
        <Button variant="neutral" size="icon" className="sp-btn h-8 w-8" aria-label="Veckan efter" onClick={() => onStepWeek(1)}>
          <ChevronRight />
        </Button>
      )}
    </div>
  );

  const weekRow = weeks && weeks.length > 1 && onWeek && (
    <div className="flex max-w-full gap-1.5 overflow-x-auto" aria-label="Veckor">
      {weeks.map(w => (
        <button
          key={w.week}
          type="button"
          aria-pressed={w.week === shownWeek}
          onClick={() => onWeek(w.week)}
          title={w.hint}
          className={cn(
            'flex shrink-0 items-center gap-1 rounded-ui-sm border-frame border-ui-line px-2 py-0.5 font-mono text-xs font-semibold',
            w.week === shownWeek ? 'bg-ui-ink text-ui-paper' : cn(w.tone ?? 'bg-ui-paper hover:bg-ui-surface-3', 'text-ui-ink'),
          )}
        >
          v.{weekNumber(w.week)}
          <span className={cn('h-1.5 w-1.5 rounded-full', w.hasNotes ? (w.week === shownWeek ? 'bg-ui-paper' : 'bg-ui-ink') : 'bg-transparent')} aria-hidden />
          {w.hasNotes && <span className="sr-only">har noteringar</span>}
        </button>
      ))}
    </div>
  );

  const modeButton = mode === 'week' ? (
    <Button variant="neutral" size="sm" className="sp-btn" onClick={() => onMode('day')} title="Visa bara den valda dagen">
      <ChevronUp /> Bara dagen
    </Button>
  ) : (
    <Button variant="neutral" size="sm" className="sp-btn" onClick={() => onMode('week')} title="Visa hela veckan">
      <ChevronDown /> Visa veckan
    </Button>
  );

  if (mode === 'day') {
    const current = days.find(d => d.day === day) ?? days[0];
    return (
      <section className="sp-card flex flex-wrap items-stretch gap-3 p-3" aria-label="Veckan, bara dagen">
        <div className="flex flex-col justify-center gap-1.5">
          <span className="font-mono text-xs font-semibold">{title}</span>
          <div className="flex flex-wrap gap-1" role="group" aria-label="Dag">
            {days.map(d => (
              <button
                key={d.day}
                type="button"
                className={cn(chip(d.day === day), 'px-2 py-0.5')}
                aria-pressed={d.day === day}
                onClick={() => onDay(d.day)}
              >
                {shortDay(d.day)}
              </button>
            ))}
          </div>
        </div>
        {current && (
          <div className="grid min-w-0 flex-1 gap-2 [grid-template-columns:repeat(auto-fill,minmax(140px,1fr))]">
            {!current.cells.some(c => c.pass === 'day') && <button
              type="button"
              aria-pressed={pass === 'day'}
              onClick={() => onPick(current.day, 'day')}
              className={cn(
                'flex min-h-[64px] flex-col justify-center rounded-ui-sm border-frame border-ui-line px-2.5 py-2 text-left text-sm font-semibold',
                pass === 'day' ? 'bg-ui-ink text-ui-paper' : 'bg-ui-paper hover:bg-ui-surface-3',
              )}
            >
              <span className="font-mono text-2xs opacity-75">Hela dagen</span>
              {dateLabel(current)}
            </button>}
            {current.cells.map(c => (
              <Cell key={c.columns.join('+')} cell={c} selected={isCellSelected(c, pass)} onClick={() => onPick(current.day, c.pass)} tall={false} />
            ))}
          </div>
        )}
        <div className="flex flex-col items-end justify-center gap-2">
          {classChips && <div className="flex flex-wrap justify-end gap-1.5">{classChips}</div>}
          {modeButton}
        </div>
      </section>
    );
  }

  return (
    <section className="sp-card flex flex-col gap-3 p-4" aria-label="Veckan">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        {weekNav}
        {weekRow}
        {notice}
        <div className="flex flex-wrap items-center gap-2 lg:ml-auto">
          {classChips}
          {modeButton}
        </div>
      </div>
      <div className="overflow-x-auto">
        <div className="grid min-w-[720px] gap-3" style={{ gridTemplateColumns: `repeat(${Math.max(days.length, 1)}, minmax(0, 1fr))` }}>
          {days.map(d => (
            <div key={d.day} className="flex min-w-0 flex-col gap-2">
              {dayHeader(d)}
              {d.cells.map(c => (
                <Cell
                  key={c.columns.join('+')}
                  cell={c}
                  selected={day === d.day && isCellSelected(c, pass)}
                  onClick={() => onPick(d.day, c.pass)}
                  tall
                />
              ))}
            </div>
          ))}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ui-muted">
        <span>Fetstil = dina pass. Prick = noteringar. +N = fler pass samtidigt. Streckad = ingen markerad.</span>
        {hasSchedule
          ? <span className="ml-auto"><ScheduleNamePicker label="Du i schemat:" names={teacherNames} value={myName} onChange={onChooseName} /></span>
          : <span className="ml-auto">Veckan har inget schema. Döp veckans schema till &quot;v. NN&quot; i Schema så kopplas det hit.</span>}
      </div>
    </section>
  );
}
