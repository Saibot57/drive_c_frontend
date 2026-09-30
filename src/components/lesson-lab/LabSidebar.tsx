'use client';

import React, { useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Plus, Trash2, UserPlus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TEACHERS_KEY } from '@/config/plannerConstants';
import type { LabDay, LabState } from '@/types/lessonLab';
import { LAB_COLORS, LAB_DAYS, nextTeamNumber, setTeamNumber, sortTeams } from '@/utils/lessonLab';
import { ColorSwatch, CommitInput, LabCard, TeamNumberInput } from '@/components/lesson-lab/LabInputs';

export type Commit = (change: (state: LabState) => LabState) => void;

type Props = {
  state: LabState;
  commit: Commit;
  focusTeacherId: string | null;
  onFocusTeacher: (id: string | null) => void;
  onNotice: (message: string) => void;
};

const dayLetter = (day: LabDay) => day.slice(0, 2);

/** Lärarnamnen i schemaplanerarens inställningar, om det finns några. */
const readPlannerTeachers = (): string[] => {
  try {
    const raw = JSON.parse(window.localStorage.getItem(TEACHERS_KEY) ?? '[]');
    return Array.isArray(raw) ? raw.filter((n): n is string => typeof n === 'string' && n.trim() !== '') : [];
  } catch {
    return [];
  }
};

function TeachersCard({ state, commit, focusTeacherId, onFocusTeacher, onNotice }: Props) {
  const [newName, setNewName] = useState('');

  const addTeacher = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    commit(s => ({ ...s, teachers: [...s.teachers, { id: uuidv4(), name: trimmed, days: [...LAB_DAYS], resource: false }] }));
  };

  const importFromPlanner = () => {
    const known = new Set(state.teachers.map(t => t.name.toLowerCase()));
    const missing = readPlannerTeachers().filter(name => !known.has(name.trim().toLowerCase()));
    if (missing.length === 0) {
      onNotice('Alla lärare i schemaplaneraren finns redan här.');
      return;
    }
    commit(s => ({
      ...s,
      teachers: [...s.teachers, ...missing.map(name => ({ id: uuidv4(), name: name.trim(), days: [...LAB_DAYS], resource: false }))],
    }));
    onNotice(`La till ${missing.join(', ')}. Kontrollera deras dagar.`);
  };

  const toggleDay = (teacherId: string, day: LabDay) => commit(s => ({
    ...s,
    teachers: s.teachers.map(t => (t.id !== teacherId ? t : {
      ...t,
      days: t.days.includes(day) ? t.days.filter(d => d !== day) : LAB_DAYS.filter(d => d === day || t.days.includes(d)),
    })),
  }));

  return (
    <LabCard
      title="Lärare"
      actions={(
        <button type="button" onClick={importFromPlanner} className="flex items-center gap-1 text-xs font-semibold underline" title="Lägg till lärare som finns i schemaplanerarens inställningar">
          <UserPlus size={14} /> Från schemat
        </button>
      )}
    >
      <div className="px-3 pb-3 pt-2">
        <p className="mb-2 text-xs text-gray-500">
          Dagarna läraren kan undervisa, som på tavlan. En resurs planerar inga lektioner. Klicka på ett namn för att markera läraren i veckan.
        </p>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[11px] uppercase tracking-wide text-gray-500">
              <th className="pb-1 text-left font-semibold">Namn</th>
              {LAB_DAYS.map(day => <th key={day} className="pb-1 font-semibold">{dayLetter(day)}</th>)}
              <th className="pb-1 font-semibold" title="Resurs, planerar inga lektioner">Res.</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {state.teachers.map(teacher => (
              <tr key={teacher.id} className={cn('border-t border-gray-100', teacher.resource && 'text-gray-500')}>
                <td className="py-1 pr-1">
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => onFocusTeacher(focusTeacherId === teacher.id ? null : teacher.id)}
                      aria-pressed={focusTeacherId === teacher.id}
                      title="Markera i veckan"
                      className={cn(
                        'h-3 w-3 shrink-0 rounded-full border-2 border-black',
                        focusTeacherId === teacher.id ? 'bg-black' : 'bg-white'
                      )}
                    />
                    <CommitInput
                      value={teacher.name}
                      ariaLabel="Lärarens namn"
                      className="w-full font-semibold"
                      onCommit={name => commit(s => ({ ...s, teachers: s.teachers.map(t => (t.id === teacher.id ? { ...t, name } : t)) }))}
                    />
                  </div>
                </td>
                {LAB_DAYS.map(day => {
                  const on = teacher.days.includes(day);
                  return (
                    <td key={day} className="px-0.5 py-1 text-center">
                      <button
                        type="button"
                        onClick={() => toggleDay(teacher.id, day)}
                        aria-pressed={on}
                        aria-label={`${teacher.name} ${day}`}
                        title={`${teacher.name}: ${on ? 'tillgänglig' : 'inte tillgänglig'} på ${day.toLowerCase()}`}
                        className={cn('h-6 w-6 rounded border-2 border-black text-[11px] font-bold', on ? 'bg-black text-white' : 'bg-white text-gray-400')}
                      >
                        {dayLetter(day)}
                      </button>
                    </td>
                  );
                })}
                <td className="px-1 py-1 text-center">
                  <input
                    type="checkbox"
                    checked={teacher.resource}
                    aria-label={`${teacher.name} är resurs`}
                    onChange={() => commit(s => ({ ...s, teachers: s.teachers.map(t => (t.id === teacher.id ? { ...t, resource: !t.resource } : t)) }))}
                  />
                </td>
                <td className="py-1 text-right">
                  <button
                    type="button"
                    aria-label={`Ta bort ${teacher.name}`}
                    title="Ta bort (går att ångra)"
                    className="rounded p-1 text-gray-400 hover:bg-rose-50 hover:text-rose-700"
                    onClick={() => commit(s => ({ ...s, teachers: s.teachers.filter(t => t.id !== teacher.id) }))}
                  >
                    <Trash2 size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <form
          className="mt-2 flex gap-2"
          onSubmit={event => { event.preventDefault(); addTeacher(newName); setNewName(''); }}
        >
          <input
            value={newName}
            onChange={event => setNewName(event.target.value)}
            placeholder="Ny lärare"
            aria-label="Ny lärare"
            className="sp-input min-w-0 flex-1 rounded-md px-2 py-1 text-sm"
          />
          <button type="submit" className="sp-btn flex items-center gap-1 rounded-md bg-white px-2 text-sm font-semibold" disabled={!newName.trim()}>
            <Plus size={14} /> Lägg till
          </button>
        </form>
      </div>
    </LabCard>
  );
}

function TeamsCard({ state, commit, focusTeacherId }: Props) {
  const plannable = state.teachers.filter(t => !t.resource);

  const addTeam = () => commit(s => ({
    ...s,
    teams: [...s.teams, (() => {
      const number = nextTeamNumber(s.teams);
      return { id: uuidv4(), number, name: `Arbetslag ${number}`, color: LAB_COLORS[s.teams.length % LAB_COLORS.length], memberIds: [] };
    })()],
  }));

  const toggleMember = (teamId: string, teacherId: string) => commit(s => ({
    ...s,
    teams: s.teams.map(team => (team.id !== teamId ? team : {
      ...team,
      memberIds: team.memberIds.includes(teacherId)
        ? team.memberIds.filter(id => id !== teacherId)
        : [...team.memberIds, teacherId],
    })),
  }));

  return (
    <LabCard
      title="Arbetslag"
      actions={(
        <button type="button" onClick={addTeam} className="flex items-center gap-1 text-xs font-semibold underline">
          <Plus size={14} /> Nytt
        </button>
      )}
    >
      <div className="grid gap-3 px-3 pb-3 pt-2">
        {state.teams.length === 0 && (
          <p className="text-sm text-gray-500">
            Inget arbetslag än. Ett arbetslag är lärarna som äger och planerar en eller flera lektioner. Skapa ett med &quot;Nytt&quot;.
          </p>
        )}
        {sortTeams(state.teams).map(team => (
          <div key={team.id} className="rounded-md border-2 border-black p-2" style={{ background: `${team.color}55` }}>
            <div className="mb-2 flex items-center gap-2">
              <TeamNumberInput
                team={team}
                onCommit={number => commit(s => ({ ...s, teams: setTeamNumber(s.teams, team.id, number) }))}
              />
              <ColorSwatch
                color={team.color}
                label={team.name}
                onChange={color => commit(s => ({ ...s, teams: s.teams.map(t => (t.id === team.id ? { ...t, color } : t)) }))}
              />
              <CommitInput
                value={team.name}
                ariaLabel="Arbetslagets namn"
                className="flex-1 font-bold"
                onCommit={name => commit(s => ({ ...s, teams: s.teams.map(t => (t.id === team.id ? { ...t, name } : t)) }))}
              />
              <button
                type="button"
                aria-label={`Ta bort ${team.name}`}
                title="Ta bort (går att ångra)"
                className="rounded p-1 text-gray-500 hover:bg-rose-50 hover:text-rose-700"
                onClick={() => commit(s => ({ ...s, teams: s.teams.filter(t => t.id !== team.id) }))}
              >
                <Trash2 size={14} />
              </button>
            </div>
            <div className="flex flex-wrap gap-1">
              {plannable.map(teacher => {
                const member = team.memberIds.includes(teacher.id);
                return (
                  <button
                    key={teacher.id}
                    type="button"
                    aria-pressed={member}
                    onClick={() => toggleMember(team.id, teacher.id)}
                    className={cn(
                      'rounded-full border-2 border-black px-2 py-0.5 text-xs font-semibold',
                      member ? 'bg-black text-white' : 'bg-white text-gray-500',
                      focusTeacherId === teacher.id && 'ring-2 ring-amber-400 ring-offset-1'
                    )}
                  >
                    {teacher.name}
                  </button>
                );
              })}
            </div>
            <div className="mt-2 flex gap-1 text-[11px] text-gray-700">
              {LAB_DAYS.map(day => {
                const available = team.memberIds.filter(id => state.teachers.find(t => t.id === id)?.days.includes(day)).length;
                const short = team.memberIds.length > 0 && available < state.classes.length;
                return (
                  <span
                    key={day}
                    title={`${available} tillgängliga på ${day.toLowerCase()}`}
                    className={cn('rounded border px-1 tabular-nums', short ? 'border-amber-600 text-amber-800' : 'border-gray-400')}
                  >
                    {day.slice(0, 3)} {available}
                  </span>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </LabCard>
  );
}

function AreasCard({ state, commit }: Props) {
  const addArea = () => commit(s => ({
    ...s,
    areas: [...s.areas, { id: uuidv4(), name: `Område ${s.areas.length + 1}`, color: LAB_COLORS[s.areas.length % LAB_COLORS.length], goalMinutes: null }],
  }));

  return (
    <LabCard
      title="Områden"
      actions={(
        <button type="button" onClick={addArea} className="flex items-center gap-1 text-xs font-semibold underline">
          <Plus size={14} /> Nytt
        </button>
      )}
    >
      <div className="px-3 pb-3 pt-2">
        <p className="mb-2 text-xs text-gray-500">Målet är minuter per klass och vecka. Lämna tomt för inget mål.</p>
        <div className="grid gap-1">
          {state.areas.map(area => (
            <div key={area.id} className="flex items-center gap-2">
              <ColorSwatch
                color={area.color}
                label={area.name}
                onChange={color => commit(s => ({ ...s, areas: s.areas.map(a => (a.id === area.id ? { ...a, color } : a)) }))}
              />
              <CommitInput
                value={area.name}
                ariaLabel="Områdets namn"
                className="flex-1 font-semibold"
                onCommit={name => commit(s => ({ ...s, areas: s.areas.map(a => (a.id === area.id ? { ...a, name } : a)) }))}
              />
              <label className="flex items-center gap-1 text-xs text-gray-500">
                mål
                <input
                  type="number"
                  min={0}
                  step={15}
                  value={area.goalMinutes ?? ''}
                  aria-label={`Mål för ${area.name} i minuter per klass och vecka`}
                  onChange={event => {
                    const value = event.target.value === '' ? null : Number(event.target.value);
                    commit(s => ({ ...s, areas: s.areas.map(a => (a.id === area.id ? { ...a, goalMinutes: value } : a)) }));
                  }}
                  className="sp-input w-16 rounded px-1 py-0.5 text-right text-sm tabular-nums"
                />
              </label>
              <button
                type="button"
                aria-label={`Ta bort ${area.name}`}
                title="Ta bort (går att ångra)"
                className="rounded p-1 text-gray-400 hover:bg-rose-50 hover:text-rose-700"
                onClick={() => commit(s => ({ ...s, areas: s.areas.filter(a => a.id !== area.id) }))}
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      </div>
    </LabCard>
  );
}

export function LabSidebar(props: Props) {
  return (
    <div className="grid gap-6">
      <TeachersCard {...props} />
      <TeamsCard {...props} />
      <AreasCard {...props} />
    </div>
  );
}
