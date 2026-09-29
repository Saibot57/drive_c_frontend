'use client';

import React, { useMemo } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import type { PlannerArchiveSummary } from '@/types/schedule';
import type { TermWeek } from '@/types/term';
import type { WheelWeek } from '@/utils/themeWheelWeeks';
import { weekNumberFromName } from '@/utils/termPlanner';

/** Hur det står till med en veckas schema, för rutnätet och statistiken. */
export type WeekState =
  | { kind: 'holiday' }
  | { kind: 'empty' }
  | { kind: 'missing' }
  | { kind: 'loading' }
  | { kind: 'error' }
  | { kind: 'ready'; passCount: number };

type Props = {
  weeks: TermWeek[];
  calendarWeeks: WheelWeek[];
  states: WeekState[];
  /** null tills planerarens scheman har hämtats, eller om hämtningen misslyckades. */
  archives: PlannerArchiveSummary[] | null;
  onChangeWeek: (index: number, changes: Partial<TermWeek>) => void;
};

const inputClassName = 'sp-input h-8 w-full rounded-md bg-white px-2 text-sm';

/** Arkiven i veckoordning, så att "v.35" står före "v.36" och inte efter "v.3". */
const sortArchives = (archives: PlannerArchiveSummary[]) =>
  [...archives].sort((a, b) => {
    const weekA = weekNumberFromName(a.name) ?? 99;
    const weekB = weekNumberFromName(b.name) ?? 99;
    return weekA - weekB || a.name.localeCompare(b.name, 'sv');
  });

const archiveLabel = (archive: PlannerArchiveSummary) => (
  archive.isOwner ? archive.name : `${archive.name} (${archive.ownerUsername ?? 'delat'})`
);

function StateCell({ state }: { state: WeekState }) {
  switch (state.kind) {
    case 'holiday':
      return <span className="text-gray-400">Lov</span>;
    case 'empty':
      return (
        <span className="inline-flex items-center gap-1 text-amber-700">
          <AlertTriangle size={13} /> Inget schema
        </span>
      );
    case 'missing':
      return (
        <span className="inline-flex items-center gap-1 text-rose-700">
          <AlertTriangle size={13} /> Finns inte
        </span>
      );
    case 'loading':
      return <Loader2 size={14} className="animate-spin text-gray-400" />;
    case 'error':
      return <span className="text-rose-700">Kunde inte läsas</span>;
    case 'ready':
      return <span className="text-gray-600">{state.passCount} pass</span>;
  }
}

export function TermWeekGrid({ weeks, calendarWeeks, states, archives, onChangeWeek }: Props) {
  const sortedArchives = useMemo(() => sortArchives(archives ?? []), [archives]);

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b-2 border-black text-left text-xs uppercase tracking-wide text-gray-500">
            <th className="px-2 py-2 font-semibold">Vecka</th>
            <th className="px-2 py-2 text-center font-semibold">Lov</th>
            <th className="px-2 py-2 font-semibold">Schema</th>
            <th className="px-2 py-2 font-semibold" />
          </tr>
        </thead>
        <tbody>
          {weeks.map((week, index) => {
            const calendarWeek = calendarWeeks[index];
            const state = states[index];
            // Ett arkiv som raderats eller slutat delas finns inte i listan,
            // men valet ska ändå synas i stället för att tyst bli "inget".
            // Innan listan har kommit vet vi inte vilket det är.
            const unlistedArchive = week.archiveId && !archives?.some(a => a.id === week.archiveId);
            const unlistedLabel = archives ? '(borttaget schema)' : '(schema valt)';

            return (
              <tr
                key={index}
                className={week.holiday ? 'border-b border-gray-100 bg-gray-50' : 'border-b border-gray-100'}
              >
                <td className="whitespace-nowrap px-2 py-1.5">
                  <div className="font-semibold">{calendarWeek?.label}</div>
                  <div className="text-2xs text-gray-500">{calendarWeek?.dateLabel}</div>
                </td>
                <td className="px-2 py-1.5 text-center">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-black"
                    checked={week.holiday}
                    aria-label={`Lov ${calendarWeek?.label}`}
                    onChange={event => onChangeWeek(index, { holiday: event.target.checked })}
                  />
                </td>
                <td className="min-w-[150px] px-2 py-1.5">
                  <select
                    className={inputClassName}
                    value={week.archiveId ?? ''}
                    // Låst tills listan finns, så att ett val inte skrivs över
                    // med "inget schema" bara för att alternativen saknas.
                    disabled={week.holiday || !archives}
                    aria-label={`Schema ${calendarWeek?.label}`}
                    onChange={event => onChangeWeek(index, { archiveId: event.target.value || null })}
                  >
                    <option value="">— inget schema —</option>
                    {unlistedArchive && <option value={week.archiveId!}>{unlistedLabel}</option>}
                    {sortedArchives.map(archive => (
                      <option key={archive.id} value={archive.id}>{archiveLabel(archive)}</option>
                    ))}
                  </select>
                </td>
                <td className="whitespace-nowrap px-2 py-1.5 text-xs">
                  {state && <StateCell state={state} />}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
