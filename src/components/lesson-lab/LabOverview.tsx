'use client';

import React, { useMemo } from 'react';
import { AlertTriangle, CheckCircle2, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { LabLesson, LabState } from '@/types/lessonLab';
import {
  classAreaMinutes,
  formatMinutes,
  LAB_DAYS,
  LabWarning,
  teacherSummaries,
  teamSummaries,
} from '@/utils/lessonLab';
import { LabCard } from '@/components/lesson-lab/LabInputs';

type Props = {
  state: LabState;
  lessons: LabLesson[];
  warnings: LabWarning[];
  focusTeacherId: string | null;
  onFocusTeacher: (id: string | null) => void;
};

const NO_AREA = '';

export function LabOverview({ state, lessons, warnings, focusTeacherId, onFocusTeacher }: Props) {
  const teachers = useMemo(() => teacherSummaries(state, lessons), [state, lessons]);
  const classes = useMemo(() => classAreaMinutes(state, lessons), [state, lessons]);
  const teams = useMemo(() => teamSummaries(state, lessons), [state, lessons]);

  // Bara områden som används eller har ett mål, plus "utan område" om det finns.
  const areaColumns = useMemo(() => {
    const used = new Set(lessons.map(l => l.areaId ?? NO_AREA));
    const columns = state.areas.filter(a => used.has(a.id) || a.goalMinutes !== null)
      .map(a => ({ id: a.id, name: a.name, color: a.color, goal: a.goalMinutes }));
    if (used.has(NO_AREA)) columns.push({ id: NO_AREA, name: 'Utan område', color: '#f3f4f6', goal: null });
    return columns;
  }, [state.areas, lessons]);

  const errors = warnings.filter(w => w.severity === 'error');
  const warns = warnings.filter(w => w.severity === 'warn');
  const infos = warnings.filter(w => w.severity === 'info');

  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <LabCard title="Att se över" className="xl:col-span-2">
        <div className="grid gap-3 px-4 py-3 text-sm">
          {errors.length === 0 && warns.length === 0 ? (
            <p className="flex items-center gap-2 text-emerald-700">
              <CheckCircle2 size={16} /> Inga krockar och inga lärare på fel dag.
            </p>
          ) : (
            <ul className="grid gap-1">
              {[...errors, ...warns].map((w, i) => (
                <li key={i} className={cn('flex gap-2', w.severity === 'error' ? 'text-rose-700' : 'text-amber-800')}>
                  <AlertTriangle size={14} className="mt-0.5 shrink-0" /> {w.message}
                </li>
              ))}
            </ul>
          )}
          {infos.length > 0 && (
            <details className="text-gray-600">
              <summary className="flex cursor-pointer items-center gap-2">
                <Info size={14} /> {infos.length} ofullständiga lektioner (utan arbetsgrupp eller med tomma klasser)
              </summary>
              <ul className="mt-1 grid gap-0.5 pl-6">
                {infos.map((w, i) => <li key={i}>{w.message}</li>)}
              </ul>
            </details>
          )}
        </div>
      </LabCard>

      <LabCard title="Lärarna den här veckan">
        <div className="overflow-x-auto p-2">
          <table className="w-full text-sm tabular-nums">
            <thead>
              <tr className="border-b-2 border-black text-left text-[11px] uppercase tracking-wide text-gray-500">
                <th className="px-2 py-1">Lärare</th>
                <th className="px-2 py-1 text-right">Undervisar</th>
                <th className="px-2 py-1 text-right" title="Lektioner som ägs av lärarens arbetsgrupper">Planerar</th>
                <th className="px-2 py-1">Områden</th>
              </tr>
            </thead>
            <tbody>
              {teachers.map(row => (
                <tr
                  key={row.teacher.id}
                  className={cn('cursor-pointer border-b border-gray-100 hover:bg-gray-50', focusTeacherId === row.teacher.id && 'bg-amber-50')}
                  onClick={() => onFocusTeacher(focusTeacherId === row.teacher.id ? null : row.teacher.id)}
                >
                  <td className="px-2 py-1 font-semibold">{row.teacher.name}</td>
                  <td className="px-2 py-1 text-right">
                    {row.minutes > 0 ? formatMinutes(row.minutes) : '–'}
                    <span className="ml-1 text-xs text-gray-500">{row.lessonCount > 0 && `(${row.lessonCount})`}</span>
                  </td>
                  <td className="px-2 py-1 text-right">{row.ownedLessons > 0 ? `${row.ownedLessons} lekt.` : '–'}</td>
                  <td className="px-2 py-1">
                    <div className="flex flex-wrap gap-1">
                      {Object.entries(row.byArea).map(([areaId, minutes]) => {
                        const area = state.areas.find(a => a.id === areaId);
                        return (
                          <span key={areaId} className="rounded border border-black/20 px-1 text-xs" style={{ background: area?.color ?? '#f3f4f6' }}>
                            {area?.name ?? 'Utan område'} {minutes}
                          </span>
                        );
                      })}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="px-2 pt-2 text-xs text-gray-500">
            Undervisar räknar en lektion en gång även om läraren står på två klasser. Planerar är lektionerna som lärarens arbetsgrupper äger.
          </p>
        </div>
      </LabCard>

      <LabCard title="Klasserna: minuter per område">
        <div className="overflow-x-auto p-2">
          {areaColumns.length === 0 ? (
            <p className="px-2 py-1 text-sm text-gray-500">Inga lektioner än.</p>
          ) : (
            <table className="w-full text-sm tabular-nums">
              <thead>
                <tr className="border-b-2 border-black text-[11px] uppercase tracking-wide text-gray-500">
                  <th className="px-2 py-1 text-left">Klass</th>
                  {areaColumns.map(a => (
                    <th key={a.id} className="px-2 py-1 text-right">
                      <span className="mr-1 inline-block h-2.5 w-2.5 rounded-sm border border-black/30 align-middle" style={{ background: a.color }} />
                      {a.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {state.classes.map(className => (
                  <tr key={className} className="border-b border-gray-100">
                    <td className="px-2 py-1 font-semibold">{className}</td>
                    {areaColumns.map(a => {
                      const minutes = classes[className]?.[a.id] ?? 0;
                      const off = a.goal !== null && minutes !== a.goal;
                      return (
                        <td key={a.id} className={cn('px-2 py-1 text-right', off && (minutes < (a.goal ?? 0) ? 'text-amber-800' : 'text-sky-800'))}>
                          {minutes || '–'}
                          {a.goal !== null && <span className="ml-1 text-xs text-gray-500">/ {a.goal}</span>}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <p className="px-2 pt-2 text-xs text-gray-500">
            Alla lektioner går för alla klasser samtidigt, så klasserna får samma minuter. Siffran efter snedstrecket är målet.
          </p>
        </div>
      </LabCard>

      {teams.length > 0 && (
        <LabCard title="Arbetsgrupperna" className="xl:col-span-2">
          <div className="overflow-x-auto p-2">
            <table className="w-full text-sm tabular-nums">
              <thead>
                <tr className="border-b-2 border-black text-left text-[11px] uppercase tracking-wide text-gray-500">
                  <th className="px-2 py-1">Arbetsgrupp</th>
                  <th className="px-2 py-1">Lärare</th>
                  <th className="px-2 py-1 text-right">Lektioner</th>
                  <th className="px-2 py-1 text-right">Tid per klass</th>
                  {LAB_DAYS.map(day => <th key={day} className="px-2 py-1 text-right" title="Tillgängliga medlemmar">{day.slice(0, 3)}</th>)}
                </tr>
              </thead>
              <tbody>
                {teams.map(row => (
                  <tr key={row.team.id} className="border-b border-gray-100">
                    <td className="px-2 py-1 font-semibold">
                      <span className="mr-2 inline-block h-3 w-3 rounded-sm border border-black align-middle" style={{ background: row.team.color }} />
                      {row.team.name}
                    </td>
                    <td className="px-2 py-1">
                      {row.team.memberIds.map(id => state.teachers.find(t => t.id === id)?.name).filter(Boolean).join(', ') || '–'}
                    </td>
                    <td className="px-2 py-1 text-right">{row.lessonCount}</td>
                    <td className="px-2 py-1 text-right">{row.minutes > 0 ? formatMinutes(row.minutes) : '–'}</td>
                    {LAB_DAYS.map(day => (
                      <td
                        key={day}
                        className={cn('px-2 py-1 text-right', row.team.memberIds.length > 0 && row.availableByDay[day] < state.classes.length && 'text-amber-800')}
                      >
                        {row.availableByDay[day]}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </LabCard>
      )}
    </div>
  );
}
