'use client';

import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import type { LabState } from '@/types/lessonLab';
import { employmentOf, formatHours, LoadSpread, withEmployment } from '@/utils/lessonLab';

/**
 * Inställningar för lärarraden: varje lärares tjänstgöringsgrad. Lärartiden
 * jämförs sedan med snittet per heltid gånger graden, så att +/− visar om
 * läraren har mycket eller lite för sin tjänst. Graden följer upplägget.
 */
export function EmploymentPanel({
  state,
  spread,
  commit,
  onClose,
}: {
  state: LabState;
  spread: LoadSpread | null;
  commit: (change: (current: LabState) => LabState) => void;
  onClose: () => void;
}) {
  const teachers = state.teachers
    .filter(t => !t.resource)
    .sort((a, b) => a.name.localeCompare(b.name, 'sv'));
  const setEmployment = (teacherId: string, value: number) => commit(current => ({
    ...current,
    teachers: current.teachers.map(t => (t.id === teacherId ? withEmployment(t, value) : t)),
  }));

  return (
    <div className="mb-3 rounded-md border-frame border-ui-line bg-ui-paper p-3 text-sm">
      <div className="mb-2 flex items-start justify-between gap-2">
        <div>
          <h3 className="font-bold">Tjänstgöringsgrad</h3>
          <p className="text-xs text-gray-600 kron:text-ui-muted">
            +/− jämför läraren med snittet per heltid gånger graden
            {spread ? <> ({formatHours(spread.perFullTime)} per heltid)</> : null}. Har någon nedsättning för andra
            uppdrag, sätt andelen av undervisningen. Graden sparas i upplägget.
          </p>
        </div>
        <button type="button" onClick={onClose} className="rounded p-1 hover:bg-black/10" aria-label="Stäng inställningarna">
          <X size={14} />
        </button>
      </div>
      {teachers.length === 0 ? (
        <p className="text-xs text-gray-600 kron:text-ui-muted">Inga lärare ännu.</p>
      ) : (
        <ul className="grid gap-x-6 gap-y-1 sm:grid-cols-2 lg:grid-cols-3">
          {teachers.map(teacher => {
            const load = spread?.loads.get(teacher.id);
            return (
              <li key={teacher.id} className="flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate font-semibold">{teacher.name}</span>
                <PercentInput
                  value={employmentOf(teacher)}
                  onCommit={value => setEmployment(teacher.id, value)}
                  ariaLabel={`Tjänstgöringsgrad för ${teacher.name}`}
                />
                <span
                  className="w-24 text-right text-xs tabular-nums text-gray-600 kron:text-ui-muted"
                  title="Vad läraren borde ha i veckan enligt graden"
                >
                  {load ? `förväntat ${formatHours(load.expected)}` : ''}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/**
 * Procent som sparas när man lämnar fältet eller trycker Enter. Escape och
 * ett tomt eller ogiltigt värde återställer; 100 och mer blir heltid.
 */
function PercentInput({ value, onCommit, ariaLabel }: { value: number; onCommit: (value: number) => void; ariaLabel: string }) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => { setDraft(String(value)); }, [value]);

  const commit = () => {
    const next = Math.round(Number(draft.replace(',', '.')));
    if (!draft.trim() || !Number.isFinite(next) || next < 1) { setDraft(String(value)); return; }
    const clamped = Math.min(100, next);
    setDraft(String(clamped));
    if (clamped !== value) onCommit(clamped);
  };

  return (
    <span className="flex items-center gap-1">
      <input
        type="text"
        inputMode="numeric"
        value={draft}
        aria-label={ariaLabel}
        onChange={event => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={event => {
          if (event.key === 'Enter') (event.target as HTMLInputElement).blur();
          if (event.key === 'Escape') { setDraft(String(value)); (event.target as HTMLInputElement).blur(); }
        }}
        className="w-12 rounded border border-gray-300 bg-white px-1 py-0.5 text-right tabular-nums focus:border-black focus:outline-none kron:border-ui-hair kron:bg-ui-paper"
      />
      <span className="text-xs">%</span>
    </span>
  );
}
