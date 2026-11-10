'use client';

import React, { useState } from 'react';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import { Plus, Settings, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmploymentPanel } from '@/components/lesson-lab/LabEmployment';
import { ColorSwatch, CommitInput, TeamBadge, TeamNumberInput } from '@/components/lesson-lab/LabInputs';
import { cn } from '@/lib/utils';
import type { LabLesson, LabState, LabTeacher, LabTeam } from '@/types/lessonLab';
import {
  formatHours,
  lessonMinutes,
  LoadSpread,
  reassignTeam,
  setTeamNumber,
  sortLessons,
  sortTeams,
  TeacherLoad,
  teamsInLesson,
} from '@/utils/lessonLab';
import { FixedHours } from '@/utils/lessonLabArchive';
import { getReadableTextColor } from '@/utils/readableTextColor';
import {
  classColor,
  DragData,
  NEW_TEAM_DROP,
  teamDropId,
  TEACHER_SLOT_PREFIX,
  lessonLabel,
  ViewContext,
} from '@/components/lesson-lab/labShared';

/** Arbetslagen i Arbetslag: lärarraden, lagkorten, brickorna och kortet för ett nytt lag. */

/** Avvikelse från det förväntade enligt tjänstgöringsgraden som markeras i lärarraden. */
const DEVIATION_MINUTES = 120;

/** Arbetslagen en lärare är med i, i sifferordning. */
const teamsOf = (state: LabState, teacherId: string) =>
  sortTeams(state.teams).filter(team => team.memberIds.includes(teacherId));

export function LabTeams({
  view,
  lessons,
  fixed,
  tema,
  spread,
  rowIds,
  customOrder,
  onResetOrder,
  commit,
  onFocus,
  onNewTeam,
}: {
  view: ViewContext;
  lessons: LabLesson[];
  fixed: Map<string, FixedHours>;
  tema: Map<string, number>;
  /** Lärarnas tid i förhållande till tjänstgöringsgraden. */
  spread: LoadSpread | null;
  /** Lärarradens lärare i tur och ordning. */
  rowIds: string[];
  /** Ordningen är dragen för hand, inte sorterad. */
  customOrder: boolean;
  onResetOrder: () => void;
  commit: (change: (current: LabState) => LabState) => void;
  onFocus: (teacherId: string) => void;
  onNewTeam: () => void;
}) {
  const { state, focusId } = view;
  const focusName = state.teachers.find(t => t.id === focusId)?.name;
  const [settingsOpen, setSettingsOpen] = useState(false);
  const rows = rowIds.flatMap(id => {
    const teacher = state.teachers.find(t => t.id === id);
    return teacher ? [teacher] : [];
  });

  return (
    <section className="mt-6 grid gap-4">
      <div className="sp-card px-4 py-3">
        <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1">
          <h2 className="ui-panel-title font-bold" title="Timmar per vecka: fasta pass i schemat plus temat, räknat i klasspass (en lärare per klass och lektion)">Lärare</h2>
          <span className="flex items-center gap-1.5 text-xs text-gray-700 kron:text-ui-ink-2">
            <span className="h-2.5 w-3.5 rounded-sm border border-black bg-gray-400" aria-hidden /> fasta pass i schemat
            <span className="ml-2 h-2.5 w-3.5 rounded-sm border border-black bg-black" aria-hidden /> tema
            <span className="ml-2 h-3 w-[3px] bg-amber-400" aria-hidden /> förväntat enligt grad
          </span>
          {rows.length > 0 && spread && (
            <span className="text-xs font-bold" title="Allas tid delad på allas tjänstgöringsgrader">
              Snitt per heltid {formatHours(spread.perFullTime)}
            </span>
          )}
          <Button
            variant="neutral"
            size="icon"
            className="sp-btn h-7 w-7"
            onClick={() => setSettingsOpen(open => !open)}
            aria-expanded={settingsOpen}
            title="Inställningar: tjänstgöringsgrad"
            aria-label="Inställningar för lärarna"
          >
            <Settings size={14} />
          </Button>
          <span className="text-xs text-gray-600 kron:text-ui-muted sm:ml-auto">
            {focusName
              ? <>Visar <b>{focusName}</b>: lag, dagar och lektioner. Klicka igen för att släppa.</>
              : 'Klicka på en lärare för att se lärarens lag och lektioner. Dra för att flytta.'}
            {customOrder && (
              <button type="button" onClick={onResetOrder} className="ml-2 font-semibold underline" title="Glöm den egna ordningen och sortera på skillnad mot förväntat">
                Sortera på skillnad
              </button>
            )}
          </span>
        </div>
        {settingsOpen && (
          <EmploymentPanel state={state} spread={spread} commit={commit} onClose={() => setSettingsOpen(false)} />
        )}
        <div className="grid gap-2.5 [grid-template-columns:repeat(auto-fill,minmax(20rem,1fr))]">
          {rows.map(teacher => (
            <LoadChip
              key={teacher.id}
              teacher={teacher}
              teams={teamsOf(state, teacher.id)}
              fixed={fixed.get(teacher.id)}
              temaMinutes={tema.get(teacher.id) ?? 0}
              load={spread?.loads.get(teacher.id)}
              active={focusId === teacher.id}
              onClick={() => onFocus(teacher.id)}
            />
          ))}
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {sortTeams(state.teams).map(team => <TeamCard key={team.id} team={team} view={view} lessons={lessons} commit={commit} />)}
        <NewTeamCard onClick={onNewTeam} />
      </div>
    </section>
  );
}

/**
 * En lärare att dra: till en dag (blir tillgänglig), till ett arbetslag
 * (blir medlem). Samma lärare kan stå på flera ställen, därför eget `dragId`.
 * Lärarraden med timmarna har en egen bricka, `LoadChip`.
 */
export function TeacherChip({
  teacher,
  dragId = `teacher:${teacher.id}`,
  size = 'md',
  active = false,
  onRemove,
  removeLabel,
}: {
  teacher: LabTeacher;
  dragId?: string;
  size?: 'sm' | 'md';
  /** Läraren står i fokus. */
  active?: boolean;
  onRemove?: () => void;
  removeLabel?: string;
}) {
  const { setNodeRef, attributes, listeners, isDragging } = useDraggable({
    id: dragId,
    data: { kind: 'teacher', teacherId: teacher.id } satisfies DragData,
  });
  return (
    <span
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      title={`Tillgänglig: ${teacher.days.map(d => d.slice(0, 3).toLowerCase()).join(', ') || 'inga dagar'}`}
      className={cn(
        'flex cursor-grab touch-none items-center gap-1 rounded-full border-frame border-ui-line font-bold active:cursor-grabbing',
        size === 'sm' ? 'px-2 py-0.5 text-xs' : 'gap-2 px-3 py-1 text-sm shadow-frame-sm',
        active ? 'bg-black text-white' : 'bg-ui-paper',
        active && size === 'md' && 'shadow-[2px_2px_0_0_#facc15]',
        isDragging && 'opacity-40'
      )}
    >
      {teacher.name}
      {onRemove && (
        <button
          type="button"
          onPointerDown={event => event.stopPropagation()}
          onKeyDown={event => event.stopPropagation()}
          onClick={onRemove}
          title={removeLabel}
          aria-label={removeLabel}
          className={cn('-mr-1 rounded-full p-0.5 hover:bg-rose-50 hover:text-rose-700', active ? 'text-gray-300' : 'text-ui-muted')}
        >
          <X size={10} />
        </button>
      )}
    </span>
  );
}

/**
 * En lärare i lärarraden: lagen, graden, timmarna per vecka och skillnaden mot
 * det förväntade enligt tjänstgöringsgraden. Stapeln mäts mot var och ens
 * förväntade, så strecket står på samma ställe för alla och en stapel förbi
 * strecket är över. Grått är fasta pass i arkivet, svart temat.
 *
 * Brickan dras som en lärare (till en dag eller ett lag) och är också ett
 * släppmål: en lärare släppt här byter plats i raden.
 */
function LoadChip({ teacher, teams, fixed, temaMinutes, load, active, onClick }: {
  teacher: LabTeacher;
  /** Arbetslagen läraren är med i, i sifferordning. */
  teams: LabTeam[];
  fixed?: FixedHours;
  temaMinutes: number;
  load?: TeacherLoad;
  /** Läraren står i fokus. */
  active: boolean;
  onClick: () => void;
}) {
  const drag = useDraggable({
    id: `teacher:${teacher.id}`,
    data: { kind: 'teacher', teacherId: teacher.id } satisfies DragData,
  });
  const drop = useDroppable({ id: `${TEACHER_SLOT_PREFIX}${teacher.id}` });
  const setRef = (node: HTMLElement | null) => { drag.setNodeRef(node); drop.setNodeRef(node); };
  const dragged = drop.active?.data.current as DragData | undefined;
  const dropHere = drop.isOver && dragged?.kind === 'teacher' && dragged.teacherId !== teacher.id;

  const fixedMinutes = fixed?.total ?? 0;
  const total = fixedMinutes + temaMinutes;
  const employment = load?.employment ?? 100;
  const diff = load?.diff ?? 0;
  const over = diff > 0;
  // Det förväntade är tre fjärdedelar av stapeln; resten rymmer det som är över.
  const scale = load && load.expected > 0 ? 75 / load.expected : 0;
  const fixedWidth = Math.min(100, fixedMinutes * scale);
  const temaWidth = Math.min(100, total * scale) - fixedWidth;
  const breakdown = [
    ...(fixed?.parts ?? []).map(part => `${part.label} ${formatHours(part.minutes)}`),
    `tema ${formatHours(temaMinutes)}`,
  ].join(' + ');
  const expected = load ? ` Förväntat ${formatHours(load.expected)} (${employment} %).` : '';
  const diffText = `${over ? '+' : '−'}${formatHours(Math.abs(diff))}`;

  return (
    <div
      ref={setRef}
      {...drag.attributes}
      {...drag.listeners}
      onClick={onClick}
      aria-pressed={active}
      title={`${breakdown} = ${formatHours(total)} per vecka.${expected} Tillgänglig: ${teacher.days.map(d => d.slice(0, 3).toLowerCase()).join(', ') || 'inga dagar'}. Klicka för fokus. Dra till en dag eller ett lag, eller till en annan lärare för att byta plats.`}
      className={cn(
        'grid cursor-grab touch-none grid-cols-[minmax(0,1fr)_100px_64px] items-center gap-x-2.5 rounded-full border-frame border-ui-line px-4 py-1.5 shadow-frame-sm active:cursor-grabbing',
        active ? 'bg-black text-white shadow-[2px_2px_0_0_#facc15]' : 'bg-ui-paper',
        drag.isDragging && 'opacity-40',
        dropHere && 'outline outline-[3px] outline-offset-2 outline-amber-400'
      )}
    >
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="truncate text-[15px] font-bold">{teacher.name}</span>
        <span className="flex items-center gap-0.5">
          {teams.map(team => <TeamBadge key={team.id} team={team} size="sm" />)}
          {employment < 100 && <span className="ml-1 text-[11px] tabular-nums">{employment} %</span>}
        </span>
      </span>
      <span className={cn('relative flex h-3 overflow-hidden rounded-sm border-[1.5px]', active ? 'border-white' : 'border-black')} aria-hidden>
        <span className="h-full bg-gray-400" style={{ width: `${fixedWidth}%` }} />
        <span className={cn('h-full', active ? 'bg-ui-paper' : 'bg-black')} style={{ width: `${temaWidth}%` }} />
        {load && <span className="absolute inset-y-0 left-[75%] w-[3px] -translate-x-1/2 bg-amber-400" />}
      </span>
      <span className="flex flex-col items-end gap-0.5">
        <span className="font-mono text-xs font-semibold tabular-nums">{formatHours(total)}</span>
        {load && (Math.abs(diff) >= DEVIATION_MINUTES ? (
          <span
            className={cn(
              'rounded border-[1.5px] px-1 text-[11px] font-bold',
              over ? 'border-blue-900 bg-blue-100 text-blue-950' : 'border-orange-800 bg-orange-100 text-orange-900'
            )}
            title={`${formatHours(Math.abs(diff))} ${over ? 'över' : 'under'} det förväntade för ${employment} %`}
          >
            {diffText}
          </span>
        ) : (
          <span
            className={cn(
              'font-mono text-[11px] tabular-nums',
              active ? (over ? 'text-blue-200' : 'text-orange-200') : (over ? 'text-blue-900' : 'text-orange-800')
            )}
            title={`${formatHours(Math.abs(diff))} ${over ? 'över' : 'under'} det förväntade för ${employment} %`}
          >
            {diffText}
          </span>
        ))}
      </span>
    </div>
  );
}

function TeamCard({
  team,
  view,
  lessons,
  commit,
}: {
  team: LabTeam;
  view: ViewContext;
  lessons: LabLesson[];
  commit: (change: (current: LabState) => LabState) => void;
}) {
  const { state, focusId } = view;
  const { setNodeRef, isOver, active } = useDroppable({ id: teamDropId(team.id) });
  const accepts = active && (active.data.current as DragData | undefined)?.kind !== undefined;

  const owned = sortLessons(lessons).flatMap(lesson => {
    const classes = teamsInLesson(lesson, state.classes).get(team.id);
    return classes ? [{ lesson, classes }] : [];
  });
  const passes = owned.reduce((sum, { classes }) => sum + classes.length, 0);
  // Lagets klasspass i minuter, delat på medlemmarna: ungefär det var och en undervisar.
  const passMinutes = owned.reduce((sum, { lesson, classes }) => sum + lessonMinutes(lesson) * classes.length, 0);
  const members = team.memberIds.map(id => state.teachers.find(t => t.id === id)).filter(Boolean) as LabState['teachers'];
  const focusHit = focusId === null || team.memberIds.includes(focusId);

  const updateTeam = (change: (t: LabTeam) => LabTeam) =>
    commit(current => ({ ...current, teams: current.teams.map(t => (t.id === team.id ? change(t) : t)) }));

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'sp-card flex flex-col transition-opacity',
        accepts && isOver && 'outline outline-4 outline-offset-2 outline-black',
        !focusHit && 'opacity-30',
        focusId !== null && focusHit && 'outline outline-[3px] outline-offset-2 outline-amber-400'
      )}
    >
      <div
        className="flex items-center gap-2 border-b-frame border-ui-line px-3 py-2"
        style={{ background: team.color, color: getReadableTextColor(team.color) }}
      >
        <TeamNumberInput
          team={team}
          onCommit={number => commit(current => ({ ...current, teams: setTeamNumber(current.teams, team.id, number) }))}
        />
        <ColorSwatch icon color={team.color} label={team.name} onChange={color => updateTeam(t => ({ ...t, color }))} />
        <CommitInput
          value={team.name}
          ariaLabel="Arbetslagets namn"
          className="flex-1 font-black"
          onCommit={name => updateTeam(t => ({ ...t, name }))}
        />
        <button
          type="button"
          aria-label={`Ta bort ${team.name}`}
          title="Ta bort (går att ångra)"
          className="rounded p-1 opacity-70 hover:bg-black/10 hover:opacity-100"
          onClick={() => commit(current => ({ ...current, teams: current.teams.filter(t => t.id !== team.id) }))}
        >
          <Trash2 size={14} />
        </button>
      </div>

      <div className="flex flex-wrap gap-1 px-3 pt-2">
        {members.length === 0 && <span className="text-xs text-ui-muted">Dra lärare hit.</span>}
        {members.map(teacher => (
          <button
            key={teacher.id}
            type="button"
            onClick={() => updateTeam(t => ({ ...t, memberIds: t.memberIds.filter(id => id !== teacher.id) }))}
            title={`Ta bort ${teacher.name} ur laget`}
            className={cn(
              'flex items-center gap-1 rounded-full border-2 px-2 py-0.5 text-xs font-bold hover:bg-gray-700',
              teacher.id === focusId ? 'border-amber-400 bg-black text-amber-300' : 'border-black bg-black text-white'
            )}
          >
            {teacher.name} <X size={11} />
          </button>
        ))}
      </div>

      <div className="flex flex-1 flex-col gap-1 p-3">
        {owned.length === 0 && (
          <div className="flex flex-1 items-center justify-center rounded-md border-2 border-dashed border-gray-300 kron:border-ui-line p-3 text-center text-xs text-ui-muted">
            Dra lektioner hit.
          </div>
        )}
        {owned.map(({ lesson, classes }) => (
          <Brick
            key={lesson.id}
            lesson={lesson}
            teamId={team.id}
            classes={classes}
            onRemove={() => commit(current => ({
              ...current,
              template: current.template.map(l => (l.id === lesson.id ? reassignTeam(l, current.classes, team.id, null) : l)),
            }))}
          />
        ))}
      </div>

      {owned.length > 0 && (
        <div
          className="border-t border-ui-hair px-3 py-1.5 text-xs text-gray-700 kron:text-ui-ink-2"
          title="Klasspass: en klass i en lektion. Tiden per lärare är lagets klasspass delade på medlemmarna, ungefär."
        >
          {owned.length} {owned.length === 1 ? 'lektion' : 'lektioner'} · {passes} klasspass
          {members.length > 0 ? ` · ≈ ${formatHours(passMinutes / members.length)} per lärare` : ' · inga lärare än'}
        </div>
      )}
    </div>
  );
}

/** En lektion i ett arbetslag. Dra tillbaka till schemat eller till ett annat lag. */
function Brick({
  lesson,
  teamId,
  classes,
  onRemove,
}: {
  lesson: LabLesson;
  teamId: string;
  /** Klasserna laget äger i lektionen. Visas alltid, även när det är alla. */
  classes: string[];
  onRemove: () => void;
}) {
  const { setNodeRef, attributes, listeners, isDragging } = useDraggable({
    id: `brick:${teamId}:${lesson.id}`,
    data: { kind: 'brick', lessonId: lesson.id, teamId } satisfies DragData,
  });
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={cn('flex cursor-grab touch-none items-center gap-2 rounded border-frame border-ui-line bg-ui-paper px-2 py-1 text-xs active:cursor-grabbing', isDragging && 'opacity-40')}
    >
      <span className="font-mono font-bold">{lessonLabel(lesson)}</span>
      <span className="flex gap-0.5">
        {classes.map(c => (
          <span key={c} className="rounded-sm border border-black/40 px-1 text-[10px] font-semibold" style={{ background: classColor(c) }}>{c}</span>
        ))}
      </span>
      <button
        type="button"
        onPointerDown={event => event.stopPropagation()}
        onClick={onRemove}
        title="Ta bort ur laget"
        aria-label={`Ta bort ${lessonLabel(lesson)} ur laget`}
        className="ml-auto rounded p-0.5 text-ui-muted hover:bg-rose-50 hover:text-rose-700"
      >
        <X size={12} />
      </button>
    </div>
  );
}

function NewTeamCard({ onClick }: { onClick: () => void }) {
  const { setNodeRef, isOver, active } = useDroppable({ id: NEW_TEAM_DROP });
  return (
    <button
      ref={setNodeRef}
      type="button"
      onClick={onClick}
      className={cn(
        'flex min-h-[140px] flex-col items-center justify-center gap-1 rounded-ui border-2 border-dashed border-black/40 bg-white/70 p-4 text-sm font-semibold text-gray-600 kron:text-ui-muted hover:border-black hover:text-black',
        active && isOver && 'border-black bg-ui-paper text-black'
      )}
    >
      <Plus size={18} />
      Nytt arbetslag
      <span className="text-xs font-normal text-ui-muted">Klicka, eller släpp en lektion eller lärare här</span>
    </button>
  );
}
