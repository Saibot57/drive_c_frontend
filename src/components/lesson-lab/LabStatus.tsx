'use client';

import React from 'react';
import { AlertTriangle, Check, ChevronDown, ChevronUp, Minus, UserPlus, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { LabState } from '@/types/lessonLab';
import { formatHours, LabWarning } from '@/utils/lessonLab';
import type { PlanStatus, StaffingFix } from '@/utils/lessonLabView';

/**
 * Upplägget i en rad under verktygsraden: lektioner med lag, fel, varningar,
 * pass utan marginal och spannet i lärartid. Fel och varningar fälls ut till
 * en lista med en knapp som visar lektionen, och förslag på vem som kan
 * hoppa in när ett lag har för få lärare.
 */

const pill = 'inline-flex h-8 items-center gap-1.5 rounded-full border-2 border-black px-3 text-xs font-bold';

export function StatusBar({
  state,
  status,
  spread,
  fixes,
  totals,
  open,
  onOpenChange,
  quietTight,
  onQuietTightChange,
  onShowLesson,
  onApplyFix,
}: {
  state: LabState;
  status: PlanStatus;
  /** Lärartid per vecka i minuter: lägst, högst och snitt. `null` utan lärare. */
  spread: { min: number; max: number; avg: number } | null;
  fixes: StaffingFix[];
  totals: Map<string, number>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Pass utan marginal är minimerade till en liten gul ikon. */
  quietTight: boolean;
  onQuietTightChange: (quiet: boolean) => void;
  onShowLesson: (lessonId: string) => void;
  onApplyFix: (fix: StaffingFix) => void;
}) {
  const issues: LabWarning[] = [...status.errors, ...status.warnings];
  const allHaveTeam = status.withTeam === status.lessonCount;
  const tightDays = Array.from(new Set(status.tight.map(l => l.day.slice(0, 3).toLowerCase())));
  const tightText = `${status.tight.length} pass utan marginal (${tightDays.join(', ')})`;
  const toggle = issues.length > 0 ? () => onOpenChange(!open) : undefined;
  const name = (id: string) => state.teachers.find(t => t.id === id)?.name ?? 'Okänd lärare';
  const team = (id: string) => state.teams.find(t => t.id === id);

  return (
    <div className="mb-4">
      <div className="sp-card flex flex-wrap items-center gap-2 px-3 py-2" role="status">
        <span className={cn(pill, allHaveTeam ? 'bg-emerald-50' : 'border-rose-700 bg-rose-50 text-rose-800')}>
          {allHaveTeam ? <Check size={14} strokeWidth={3} /> : <AlertTriangle size={14} />}
          {status.withTeam} av {status.lessonCount} lektioner har lag
        </span>
        <IssueButton count={status.errors.length} singular="fel" plural="fel" tone="error" open={open} onClick={toggle} />
        <IssueButton count={status.warnings.length} singular="varning" plural="varningar" tone="warn" open={open} onClick={toggle} />
        {status.tight.length > 0 && (quietTight ? (
          <button
            type="button"
            onClick={() => onQuietTightChange(false)}
            title={`${tightText}. Klicka för att visa.`}
            aria-label={`${tightText}. Visa.`}
            className="rounded-full p-0.5 hover:bg-yellow-50"
          >
            <QuietMark size="md" />
          </button>
        ) : (
          <span
            className={cn(pill, 'border-orange-800 bg-orange-50 pr-1 text-orange-900')}
            title="Ingen lärare i skolan är ledig att hoppa in under de passen. Blir någon sjuk saknas en lärare."
          >
            <AlertTriangle size={14} />
            {tightText}
            <button
              type="button"
              onClick={() => onQuietTightChange(true)}
              title="Minimera till en liten ikon. Tonar också ned etiketterna på lektionerna."
              aria-label="Minimera pass utan marginal"
              className="ml-0.5 rounded-full p-0.5 hover:bg-orange-200"
            >
              <Minus size={14} />
            </button>
          </span>
        ))}
        {spread && (
          <span className={cn(pill, 'bg-white sm:ml-auto')} title="Lärarnas tid per vecka: fasta pass i schemat plus temat">
            Lärartid {formatHours(spread.min)} – {formatHours(spread.max)} · snitt {formatHours(spread.avg)}
          </span>
        )}
      </div>

      {open && issues.length > 0 && (
        <div className="sp-card mt-2 overflow-hidden">
          <div className="flex items-center justify-between gap-2 border-b-2 border-black bg-orange-50 px-4 py-2">
            <span className="text-sm font-bold">
              {[
                status.errors.length > 0 && `${status.errors.length} fel`,
                status.warnings.length > 0 && `${status.warnings.length} ${status.warnings.length === 1 ? 'varning' : 'varningar'}`,
              ].filter(Boolean).join(' · ')}
            </span>
            <button type="button" onClick={() => onOpenChange(false)} className="rounded p-1 hover:bg-black/10" aria-label="Stäng listan">
              <X size={14} />
            </button>
          </div>
          <ul>
            {issues.map((issue, index) => (
              <li key={`${issue.lessonId}-${issue.kind}-${index}`} className="flex items-center gap-3 border-b border-gray-200 px-4 py-2 text-sm last:border-b-0">
                <span className={cn('h-2.5 w-2.5 shrink-0 rounded-full', issue.severity === 'error' ? 'bg-rose-600' : 'bg-orange-500')} aria-hidden />
                <span className="flex-1">{issue.message}</span>
                <button type="button" onClick={() => onShowLesson(issue.lessonId)} className="sp-btn rounded-md bg-white px-3 py-1 text-xs font-bold">
                  Visa
                </button>
              </li>
            ))}
          </ul>
          {fixes.map(fix => (
            <div key={`${fix.teamId}-${fix.day}`} className="flex flex-wrap items-center gap-3 border-t-2 border-black bg-sky-50 px-4 py-3 text-sm text-sky-950">
              <span className="flex-1">
                <b>{team(fix.teamId)?.name ?? 'Laget'}</b> har för få lärare på {fix.day.toLowerCase()} ({fix.lessonIds.length} {fix.lessonIds.length === 1 ? 'pass' : 'pass'}).{' '}
                {name(fix.teacherId)} kan då och har {formatHours(totals.get(fix.teacherId) ?? 0)} i veckan.
              </span>
              <button
                type="button"
                onClick={() => onApplyFix(fix)}
                className="sp-btn flex items-center gap-1.5 rounded-md bg-sky-100 px-3 py-1.5 text-xs font-bold hover:bg-sky-200"
              >
                <UserPlus size={14} /> Lägg till {name(fix.teacherId)} i laget
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Ett dämpat gult utropstecken för det som bör ses över men inte är fel. */
export function QuietMark({ title, size = 'sm' }: { title?: string; size?: 'sm' | 'md' }) {
  return (
    <span
      title={title}
      aria-label={title}
      role={title ? 'img' : undefined}
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full border border-yellow-600 bg-yellow-100 font-black leading-none text-yellow-800',
        size === 'md' ? 'h-6 w-6 text-xs' : 'h-4 w-4 text-[10px]'
      )}
    >
      !
    </span>
  );
}

function IssueButton({ count, singular, plural, tone, open, onClick }: {
  count: number;
  singular: string;
  plural: string;
  tone: 'error' | 'warn';
  open: boolean;
  onClick?: () => void;
}) {
  const label = `${count} ${count === 1 ? singular : plural}`;
  if (count === 0) return <span className={cn(pill, 'bg-emerald-50')}>{label}</span>;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={open}
      className={cn(
        pill,
        'shadow-[2px_2px_0_0_currentColor]',
        tone === 'error' ? 'border-rose-700 bg-rose-50 text-rose-800 hover:bg-rose-100' : 'border-orange-800 bg-orange-100 text-orange-900 hover:bg-orange-200'
      )}
    >
      <AlertTriangle size={14} />
      {label}
      {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
    </button>
  );
}

/** Kort hjälp i stället för instruktionstexten som stod i verktygsraden. */
export function HelpPanel({ onClose }: { onClose: () => void }) {
  return (
    <div className="sp-card mb-4 p-4 text-sm">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="font-bold">Så funkar Arbetslag</h2>
        <button type="button" onClick={onClose} className="rounded p-1 hover:bg-black/10" aria-label="Stäng hjälpen">
          <X size={14} />
        </button>
      </div>
      <ul className="grid gap-x-8 gap-y-1.5 md:grid-cols-2">
        <li><b>Lektioner:</b> dra en lektion till ett arbetslag. Laget behöver en lärare per klass.</li>
        <li><b>Dela:</b> ger klasserna var sitt lag. Dra sedan en klass till ett lag. <b>Slå ihop</b> gör lektionen hel igen.</li>
        <li><b>Bemanning:</b> &rdquo;3 klasser · 4 kan&rdquo; står på varje lektion. Röd: laget har för få lärare. Orange &rdquo;0 reserv&rdquo;: ingen lärare i hela skolan är ledig att hoppa in.</li>
        <li><b>Dagarna:</b> grå lärare kan inte den dagen. Klicka på + för att lägga till, × för att ta bort.</li>
        <li><b>Lagen:</b> dra en lärare in i ett lag. Klicka på en medlem för att ta bort den.</li>
        <li><b>Fokus:</b> klicka på en lärare i lärarraden för att se lärarens lag, dagar och lektioner.</li>
        <li><b>Timmar:</b> grått är fasta pass i schemat (matte m.m.), svart är temat.</li>
        <li><b>Upplägg</b> sparas av sig själva. <b>Schemat</b> ger lektionernas tider och lärarnas fasta pass.</li>
        <li><b>Ångra</b> med Ctrl+Z, gör om med Ctrl+Shift+Z.</li>
        <li><b>JSON</b> laddar ner upplägget med regler och timmar, för att låta en AI föreslå alternativ.</li>
      </ul>
    </div>
  );
}
