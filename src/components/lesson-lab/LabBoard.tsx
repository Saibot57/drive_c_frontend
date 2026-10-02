'use client';

import React, { useMemo, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { AlertTriangle, Pencil, Plus, Repeat, Trash2, Wand2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { LabDay, LabLesson, LabState } from '@/types/lessonLab';
import {
  assignTeam,
  BusyMap,
  availableOn,
  classTeamId,
  fillFromTeam,
  isBeforeLunch,
  LAB_DAYS,
  LabWarning,
  lessonMinutes,
  rotateClasses,
  sortLessons,
  sortTeams,
  teacherOptions,
  teamsInLesson,
} from '@/utils/lessonLab';
import { minutesToTime, timeToMinutes } from '@/utils/scheduleTime';

/** Arbetsgruppsvalets värde när klasserna har var sin grupp. */
const SPLIT_VALUE = '__delad__';

type CommitLessons = (change: (lessons: LabLesson[]) => LabLesson[]) => void;

type Props = {
  state: LabState;
  lessons: LabLesson[];
  warnings: LabWarning[];
  /** Fasta pass ur arkivet. "Fyll från arbetsgruppen" hoppar över upptagna lärare. */
  busy?: BusyMap;
  commitLessons: CommitLessons;
  focusTeacherId: string | null;
  onFocusTeacher: (id: string | null) => void;
};

/**
 * Veckan som på tavlan: en kolumn per dag med dagens tillgängliga lärare
 * överst, lektionerna före lunch, en prickad lunchlinje och lektionerna efter.
 */
export function LabBoard(props: Props) {
  const { state, lessons, commitLessons } = props;

  const addLesson = (day: LabDay, beforeLunch: boolean) => {
    const same = sortLessons(lessons.filter(l => l.day === day && isBeforeLunch(l) === beforeLunch));
    const last = same[same.length - 1];
    const start = last ? timeToMinutes(last.end) + 15 : (beforeLunch ? 8 * 60 + 30 : 12 * 60 + 30);
    const end = Math.min(start + (beforeLunch ? 75 : 90), 23 * 60 + 59);
    if (end <= start) return;
    commitLessons(current => [...current, {
      id: uuidv4(),
      day,
      start: minutesToTime(start),
      end: minutesToTime(end),
      title: '',
      areaId: null,
      teamId: null,
      split: false,
      classTeams: {},
      classTeachers: {},
    }]);
  };

  return (
    <div className="overflow-x-auto">
      <div className="grid min-w-[1100px] grid-cols-5 gap-3">
        {LAB_DAYS.map(day => {
          const dayLessons = sortLessons(lessons.filter(l => l.day === day));
          const before = dayLessons.filter(isBeforeLunch);
          const after = dayLessons.filter(l => !isBeforeLunch(l));
          return (
            <div key={day} className="sp-card flex flex-col">
              <DayHeader {...props} day={day} dayLessons={dayLessons} />
              <div className="flex flex-1 flex-col gap-2 p-2">
                {before.map(lesson => <LessonCard key={lesson.id} {...props} lesson={lesson} />)}
                <AddButton onClick={() => addLesson(day, true)} label="Lektion före lunch" />
                <div className="my-1 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500" aria-label="Lunch">
                  <span className="flex-1 border-t-2 border-dotted border-gray-400" />
                  Lunch
                  <span className="flex-1 border-t-2 border-dotted border-gray-400" />
                </div>
                {after.map(lesson => <LessonCard key={lesson.id} {...props} lesson={lesson} />)}
                <AddButton onClick={() => addLesson(day, false)} label="Lektion efter lunch" />
              </div>
            </div>
          );
        })}
      </div>
      {state.classes.length > 0 && lessons.length === 0 && (
        <p className="mt-3 text-sm text-gray-600">Veckan har inga lektioner. Lägg till med plusknapparna i dagarna.</p>
      )}
    </div>
  );
}

function AddButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center justify-center gap-1 rounded-md border-2 border-dashed border-gray-300 py-1 text-xs font-semibold text-gray-500 hover:border-black hover:text-black"
    >
      <Plus size={12} /> {label}
    </button>
  );
}

function DayHeader({ state, day, dayLessons, focusTeacherId, onFocusTeacher }: Props & { day: LabDay; dayLessons: LabLesson[] }) {
  const available = state.teachers.filter(t => !t.resource && availableOn(t, day));
  const resources = state.teachers.filter(t => t.resource && availableOn(t, day));
  const teaching = new Set(dayLessons.flatMap(l => state.classes.map(c => l.classTeachers[c]).filter(Boolean) as string[]));

  return (
    <div className="border-b-2 border-black px-3 py-2">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-lg font-black uppercase tracking-wide">{day.slice(0, 3)}</h3>
        <span className="text-xs text-gray-500">{available.length} lärare</span>
      </div>
      <div className="mt-1 flex flex-wrap gap-1">
        {available.map(teacher => (
          <button
            key={teacher.id}
            type="button"
            onClick={() => onFocusTeacher(focusTeacherId === teacher.id ? null : teacher.id)}
            aria-pressed={focusTeacherId === teacher.id}
            title={teaching.has(teacher.id) ? `${teacher.name} har lektion` : `${teacher.name} är tillgänglig men har ingen lektion`}
            className={cn(
              'rounded-full border-2 px-2 py-0.5 text-xs font-bold',
              teaching.has(teacher.id) ? 'border-black bg-black text-white' : 'border-black bg-white text-black',
              focusTeacherId === teacher.id && 'ring-2 ring-amber-400 ring-offset-1'
            )}
          >
            {teacher.name}
          </button>
        ))}
        {resources.map(teacher => (
          <span key={teacher.id} className="rounded-full border border-dashed border-gray-400 px-2 py-0.5 text-xs text-gray-500" title="Resurs">
            {teacher.name}
          </span>
        ))}
      </div>
    </div>
  );
}

function LessonCard({ state, lessons, warnings, busy, commitLessons, focusTeacherId, lesson }: Props & { lesson: LabLesson }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ start: lesson.start, end: lesson.end });

  const area = state.areas.find(a => a.id === lesson.areaId);
  const team = state.teams.find(t => t.id === lesson.teamId);
  const lessonTeams = useMemo(() => teamsInLesson(lesson, state.classes), [lesson, state.classes]);
  const teamName = (id: string | null) => state.teams.find(t => t.id === id)?.name;
  const own = warnings.filter(w => w.lessonId === lesson.id);
  const problems = own.filter(w => w.severity !== 'info');
  const badTeachers = new Set(own.filter(w => w.severity === 'error' && w.teacherId).map(w => w.teacherId));

  const involved = focusTeacherId !== null && (
    state.classes.some(c => lesson.classTeachers[c] === focusTeacherId)
    || state.teams.some(t => lessonTeams.has(t.id) && t.memberIds.includes(focusTeacherId))
  );

  const update = (change: Partial<LabLesson>) =>
    commitLessons(current => current.map(l => (l.id === lesson.id ? { ...l, ...change } : l)));

  const draftValid = /^\d\d:\d\d$/.test(draft.start) && /^\d\d:\d\d$/.test(draft.end)
    && timeToMinutes(draft.end) > timeToMinutes(draft.start);

  return (
    <article
      className={cn(
        'rounded-md border-2 border-black bg-white transition-opacity',
        focusTeacherId && !involved && 'opacity-30',
        focusTeacherId && involved && 'ring-2 ring-amber-400 ring-offset-1'
      )}
      style={{ borderLeftWidth: 6, borderLeftColor: team?.color ?? '#000' }}
    >
      <div className="flex items-center justify-between gap-1 rounded-t px-2 py-1" style={{ background: area?.color ?? '#f3f4f6' }}>
        <span className="font-mono text-xs font-bold">
          {lesson.start}–{lesson.end}
          <span className="ml-1 font-sans font-normal text-gray-700">{lessonMinutes(lesson)} min</span>
        </span>
        <span className="flex items-center">
          <IconButton label="Fyll tomma klasser från arbetslaget" disabled={lessonTeams.size === 0} onClick={() => commitLessons(current => fillFromTeam(state, current, lesson.id, busy))}>
            <Wand2 size={13} />
          </IconButton>
          <IconButton label="Rotera lärarna ett steg mellan klasserna" onClick={() => update(rotateClasses(lesson, state.classes))}>
            <Repeat size={13} />
          </IconButton>
          <IconButton label="Ändra tid eller ta bort" pressed={editing} onClick={() => { setDraft({ start: lesson.start, end: lesson.end }); setEditing(v => !v); }}>
            <Pencil size={13} />
          </IconButton>
        </span>
      </div>

      {editing && (
        <div className="flex flex-wrap items-center gap-1 border-b border-gray-200 bg-gray-50 px-2 py-1.5 text-xs">
          <input type="time" value={draft.start} aria-label="Starttid" onChange={e => setDraft(d => ({ ...d, start: e.target.value }))} className="rounded border border-gray-400 px-1" />
          –
          <input type="time" value={draft.end} aria-label="Sluttid" onChange={e => setDraft(d => ({ ...d, end: e.target.value }))} className="rounded border border-gray-400 px-1" />
          <button
            type="button"
            disabled={!draftValid}
            onClick={() => { update(draft); setEditing(false); }}
            className="rounded border-2 border-black bg-white px-1.5 font-semibold disabled:opacity-40"
          >
            Spara
          </button>
          <button
            type="button"
            onClick={() => commitLessons(current => current.filter(l => l.id !== lesson.id))}
            className="ml-auto flex items-center gap-1 rounded px-1 text-rose-700 hover:bg-rose-50"
          >
            <Trash2 size={12} /> Ta bort
          </button>
          {!draftValid && <span className="w-full text-rose-700">Sluttiden måste vara efter starttiden.</span>}
        </div>
      )}

      <div className="grid gap-1 px-2 py-1.5">
        <input
          type="text"
          value={lesson.title}
          placeholder="Namnlös lektion"
          aria-label="Lektionens namn"
          onChange={e => update({ title: e.target.value })}
          className="w-full rounded border border-transparent px-1 text-sm font-bold hover:border-gray-300 focus:border-black focus:outline-none"
        />
        <div className="grid grid-cols-2 gap-1">
          <select
            value={lesson.areaId ?? ''}
            aria-label="Område"
            onChange={e => update({ areaId: e.target.value || null })}
            className="min-w-0 rounded border border-gray-300 bg-white px-1 py-0.5 text-xs"
          >
            <option value="">Område…</option>
            {state.areas.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
          <select
            value={lesson.split ? SPLIT_VALUE : lesson.teamId ?? ''}
            aria-label="Arbetslag"
            title={lesson.split ? 'Klasserna har var sitt arbetslag. Välj ett lag för att ge alla klasser samma.' : undefined}
            onChange={e => update(assignTeam(lesson, state.classes, e.target.value || null))}
            className="min-w-0 rounded border border-gray-300 bg-white px-1 py-0.5 text-xs"
          >
            <option value="">Arbetslag…</option>
            {lesson.split && <option value={SPLIT_VALUE} disabled>Delad per klass</option>}
            {sortTeams(state.teams).map(t => <option key={t.id} value={t.id}>{t.number}. {t.name}</option>)}
          </select>
        </div>

        <div className="mt-0.5 grid gap-0.5">
          {state.classes.map(className => {
            if (lesson.absentClasses?.includes(className)) {
              return (
                <div key={className} className="flex items-center gap-1 text-xs text-gray-400">
                  <span className="w-11 shrink-0 font-semibold line-through">{className}</span>
                  <span>har inte tema den här tiden</span>
                </div>
              );
            }
            const teacherId = lesson.classTeachers[className] ?? '';
            const options = teacherOptions(state, lesson, className);
            const classTeam = lesson.split ? teamName(classTeamId(lesson, className)) : undefined;
            return (
              <label key={className} className="flex items-center gap-1 text-xs">
                <span className="w-11 shrink-0 font-semibold text-gray-600" title={classTeam ? `Arbetslag: ${classTeam}` : undefined}>
                  {className}{lesson.split && <span className="block text-[9px] font-normal leading-none text-gray-500">{classTeam ?? 'inget lag'}</span>}
                </span>
                <select
                  value={teacherId}
                  aria-label={`Lärare för ${className}`}
                  onChange={e => update({ classTeachers: { ...lesson.classTeachers, [className]: e.target.value || null } })}
                  className={cn(
                    'min-w-0 flex-1 rounded border bg-white px-1 py-0.5',
                    teacherId && badTeachers.has(teacherId) ? 'border-rose-600 bg-rose-50 text-rose-800' : 'border-gray-300',
                    teacherId && focusTeacherId === teacherId && 'font-bold'
                  )}
                >
                  <option value="">–</option>
                  {options.team.length > 0 && (
                    <optgroup label={teamName(classTeamId(lesson, className)) ?? 'Arbetslaget'}>
                      {options.team.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </optgroup>
                  )}
                  {options.others.length > 0 && (
                    <optgroup label={options.team.length > 0 ? 'Andra tillgängliga' : 'Tillgängliga'}>
                      {options.others.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </optgroup>
                  )}
                  {options.unavailable.length > 0 && (
                    <optgroup label="Inte tillgängliga">
                      {options.unavailable.map(t => <option key={t.id} value={t.id}>{t.name} (ej {lesson.day.slice(0, 3).toLowerCase()})</option>)}
                    </optgroup>
                  )}
                </select>
              </label>
            );
          })}
        </div>

        {problems.length > 0 && (
          <ul className="mt-1 grid gap-0.5">
            {problems.map((w, i) => (
              <li key={i} className={cn('flex gap-1 text-[11px] leading-snug', w.severity === 'error' ? 'text-rose-700' : 'text-amber-800')}>
                <AlertTriangle size={11} className="mt-0.5 shrink-0" />
                {w.detail}
              </li>
            ))}
          </ul>
        )}
      </div>
    </article>
  );
}

function IconButton({
  label,
  onClick,
  disabled,
  pressed,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  pressed?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={pressed}
      disabled={disabled}
      onClick={onClick}
      className={cn('rounded p-1 hover:bg-black/10 disabled:opacity-30', pressed && 'bg-black/15')}
    >
      {children}
    </button>
  );
}
