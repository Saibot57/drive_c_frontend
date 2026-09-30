'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { v4 as uuidv4 } from 'uuid';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { Columns3, DoorOpen, Loader2, Plus, Redo2, RefreshCw, Square, Trash2, Undo2, UserPlus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FeatureNavigation } from '@/components/FeatureNavigation';
import { ColorSwatch, CommitInput, TeamBadge, TeamNumberInput } from '@/components/lesson-lab/LabInputs';
import { LabPlansPanel, PlanLoading, PlanNotices, PlanSaveStatus } from '@/components/lesson-lab/LabPlans';
import { useLabArchive } from '@/hooks/useLabArchive';
import { useLessonLabState } from '@/hooks/useLessonLabState';
import { cn } from '@/lib/utils';
import type { LabDay, LabLesson, LabState, LabTeam } from '@/types/lessonLab';
import {
  assignTeam,
  BusyMap,
  classTeamId,
  formatHours,
  formatMinutes,
  isBeforeLunch,
  LAB_COLORS,
  LAB_DAYS,
  labWarnings,
  lessonMinutes,
  mergeLesson,
  nextTeamNumber,
  reassignTeam,
  setTeamNumber,
  sortLessons,
  sortTeams,
  splitLesson,
  teacherTeachingMinutes,
  teamsInLesson,
} from '@/utils/lessonLab';
import { FixedHours, lessonsFromArchive } from '@/utils/lessonLabArchive';
import { getReadableTextColor } from '@/utils/readableTextColor';
import '@/styles/schedule-theme.css';

/**
 * Arbetslag, enkla vyn: veckans fasta lektioner som röda rutor överst och
 * arbetslagen nederst. Man drar en lektion till ett arbetslag. En ruta
 * kan delas i tre, en per klass, så att klasserna kan få olika grupper.
 *
 * Här visas bara veckomallen. Lärare per klass, områden, tider, egna veckor
 * och varningar finns i detaljplanen, bakom dörren längst ned till vänster.
 * Båda vyerna visar samma upplägg (`useLessonLabState`). Uppläggen sparas på
 * servern och väljs i panelen till höger (`LabPlans`).
 *
 * Mallen kan byggas från ett arkiv i schemaplaneraren. Då blir arkivets
 * temapass rutorna, och övriga pass (matte m.m.) lärarnas fasta timmar i
 * räknaren (`useLabArchive`, `lessonLabArchive`).
 */

/** Klassernas färger, som i schemat: Grund senap, Oliv oliv, Rosa rosa. */
const CLASS_COLORS: Record<string, string> = {
  Grund: '#f2c14e',
  Oliv: '#9bbf4f',
  Rosa: '#f4a6c6',
};
const classColor = (className: string) => CLASS_COLORS[className] ?? '#e5e7eb';

/** Höjd per minut, så att en 120-minuterslektion syns längre än en på 75. */
const PX_PER_MINUTE = 0.75;

type DragData =
  | { kind: 'lesson'; lessonId: string }
  | { kind: 'part'; lessonId: string; className: string }
  | { kind: 'teacher'; teacherId: string }
  | { kind: 'brick'; lessonId: string; teamId: string };

const SCHEDULE_DROP = 'schedule';
const NEW_TEAM_DROP = 'new-team';
const teamDropId = (teamId: string) => `team:${teamId}`;
const DAY_DROP_PREFIX = 'day:';

/** Arbetslagen en lärare är med i, i sifferordning. */
const teamsOf = (state: LabState, teacherId: string) =>
  sortTeams(state.teams).filter(team => team.memberIds.includes(teacherId));

const lessonLabel = (lesson: LabLesson) => `${lesson.day.slice(0, 3)} ${lesson.start}`;

export default function LessonLab() {
  const lab = useLessonLabState();
  const { state, loaded, commit, undo, redo, canUndo, canRedo } = lab;
  const source = useLabArchive(state, loaded);
  const [dragging, setDragging] = useState<DragData | null>(null);

  /** Bygger mallen från ett arkiv. Lektioner vid samma tid behåller sina grupper. */
  const buildFromArchive = async (archiveId: string) => {
    const activities = await source.fetchActivities(archiveId);
    if (!activities) return;
    commit(current => ({
      ...current,
      archiveId,
      template: lessonsFromArchive(activities, current.classes, current.template, uuidv4),
    }));
  };

  const chooseArchive = (archiveId: string) => {
    // Utan arkiv ligger rutorna kvar som de är, men de fasta timmarna försvinner.
    if (!archiveId) commit(current => ({ ...current, archiveId: null }));
    else void buildFromArchive(archiveId);
  };

  const addUnknownTeachers = () => commit(current => ({
    ...current,
    teachers: [
      ...current.teachers,
      ...source.unknownNames.map(name => ({ id: uuidv4(), name, days: [...LAB_DAYS], resource: false })),
    ],
  }));

  const sensors = useSensors(
    // En kort sträcka innan det blir ett drag, så att knapparna i rutorna går att klicka.
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    // På pekskärm: håll kvar en stund, annars går det inte att skrolla.
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
    useSensor(KeyboardSensor),
  );

  const lessons = state.template;
  const commitLessons = (change: (current: LabLesson[]) => LabLesson[]) =>
    commit(current => ({ ...current, template: change(current.template) }));
  const updateLesson = (lessonId: string, change: (lesson: LabLesson) => LabLesson) =>
    commitLessons(current => current.map(l => (l.id === lessonId ? change(l) : l)));

  // Bara det som gör en lektion omöjlig att bemanna: för få tillgängliga i laget.
  const shortByLesson = useMemo(() => {
    const map = new Map<string, string[]>();
    labWarnings(state, lessons, source.busy).filter(w => w.kind === 'shortTeam').forEach(w => {
      map.set(w.lessonId, [...(map.get(w.lessonId) ?? []), w.detail]);
    });
    return map;
  }, [state, lessons, source.busy]);

  const newTeam = (current: LabState, memberIds: string[] = []): { state: LabState; teamId: string } => {
    const teamId = uuidv4();
    return {
      teamId,
      state: {
        ...current,
        teams: [...current.teams, {
          id: teamId,
          number: nextTeamNumber(current.teams),
          name: `Arbetslag ${nextTeamNumber(current.teams)}`,
          color: LAB_COLORS[current.teams.length % LAB_COLORS.length],
          memberIds,
        }],
      },
    };
  };

  const onDragEnd = (event: DragEndEvent) => {
    setDragging(null);
    const data = event.active.data.current as DragData | undefined;
    const overId = event.over?.id ? String(event.over.id) : null;
    if (!data || !overId) return;

    const classes = state.classes;
    const onTeam = overId.startsWith('team:') ? overId.slice(5) : null;
    const onDay = overId.startsWith(DAY_DROP_PREFIX) ? overId.slice(DAY_DROP_PREFIX.length) as LabDay : null;

    // En lärare släppt på en dag blir tillgänglig den dagen.
    if (onDay && data.kind === 'teacher') {
      commit(current => ({
        ...current,
        teachers: current.teachers.map(t => (t.id === data.teacherId && !t.days.includes(onDay)
          ? { ...t, days: LAB_DAYS.filter(d => d === onDay || t.days.includes(d)) }
          : t)),
      }));
      return;
    }

    commit(current => {
      let next = current;
      let target = onTeam;
      if (overId === NEW_TEAM_DROP) {
        if (data.kind === 'brick') return current;
        const created = newTeam(current, data.kind === 'teacher' ? [data.teacherId] : []);
        next = created.state;
        target = created.teamId;
        if (data.kind === 'teacher') return next;
      }

      const mapLesson = (lessonId: string, change: (l: LabLesson) => LabLesson) => ({
        ...next,
        template: next.template.map(l => (l.id === lessonId ? change(l) : l)),
      });

      switch (data.kind) {
        case 'lesson':
          return target ? mapLesson(data.lessonId, l => assignTeam(l, classes, target)) : next;
        case 'part':
          return target ? mapLesson(data.lessonId, l => assignTeam(l, classes, target, data.className)) : next;
        case 'teacher':
          return target ? {
            ...next,
            teams: next.teams.map(t => (t.id === target && !t.memberIds.includes(data.teacherId)
              ? { ...t, memberIds: [...t.memberIds, data.teacherId] }
              : t)),
          } : next;
        case 'brick':
          // Dagarna ligger i schemat: släppt på en dag är också släppt i schemat.
          if (overId === SCHEDULE_DROP || onDay) return mapLesson(data.lessonId, l => reassignTeam(l, classes, data.teamId, null));
          if (target && target !== data.teamId) return mapLesson(data.lessonId, l => reassignTeam(l, classes, data.teamId, target));
          return next;
      }
    });
  };

  const onDragStart = (event: DragStartEvent) => setDragging((event.active.data.current as DragData) ?? null);

  return (
    <div className="sp-root">
      <div className="fixed inset-0 z-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/bakgrund59.png" alt="" className="h-full w-full object-cover" />
      </div>

      <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setDragging(null)}>
        <div className="relative z-10 pb-24">
          <div className="sp-toolbar mb-6 flex flex-col items-start gap-4 p-4 lg:flex-row lg:items-center">
            <FeatureNavigation />
            <p className="max-w-md text-xs text-gray-600">
              Dra en lektion till ett arbetslag. Dela en ruta för att ge klasserna olika lag.
              Dra lärare till en dag för att göra dem tillgängliga, eller in i ett lag.
            </p>
            <div className="flex flex-wrap items-center gap-2 lg:ml-auto">
              <PlanSaveStatus lab={lab} />
              <select
                className="sp-input h-10 max-w-[14rem] rounded-md bg-white px-3 text-sm font-semibold"
                value={state.archiveId ?? ''}
                onChange={event => chooseArchive(event.target.value)}
                disabled={source.status === 'loading'}
                aria-label="Arkiv som grund"
                title="Arkivets temapass blir rutorna, och övriga pass räknas som lärarnas fasta timmar"
              >
                <option value="">Tavlan (inget arkiv)</option>
                {state.archiveId && !source.archives?.some(a => a.id === state.archiveId) && (
                  <option value={state.archiveId}>{source.archives ? 'Arkivet finns inte längre' : 'Laddar arkiv…'}</option>
                )}
                {(source.archives ?? []).map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
              {state.archiveId && (
                <Button
                  variant="neutral"
                  size="icon"
                  className="sp-btn"
                  onClick={() => void buildFromArchive(state.archiveId as string)}
                  disabled={source.status === 'loading'}
                  title="Läs om arkivet. Lektioner vid samma tid behåller sina arbetslag."
                  aria-label="Läs om arkivet"
                >
                  {source.status === 'loading' ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                </Button>
              )}
              <Button variant="neutral" size="icon" className="sp-btn" onClick={undo} disabled={!canUndo} title="Ångra (Ctrl+Z)" aria-label="Ångra">
                <Undo2 size={16} />
              </Button>
              <Button variant="neutral" size="icon" className="sp-btn" onClick={redo} disabled={!canRedo} title="Gör om (Ctrl+Shift+Z)" aria-label="Gör om">
                <Redo2 size={16} />
              </Button>
              <Button asChild variant="neutral" className="sp-btn bg-amber-100 hover:bg-amber-200">
                <Link href="/features/termin" title="Tillbaka till terminsplaneraren">
                  <DoorOpen size={16} className="mr-2" /> Terminen
                </Link>
              </Button>
            </div>
          </div>

          <PlanNotices lab={lab} />

          {!loaded ? <PlanLoading lab={lab} /> : (
            <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
              <div className="min-w-0 flex-1">
                {source.status === 'error' && (
                  <div className="sp-toast mb-4 flex items-center justify-between gap-4 bg-rose-50 px-4 py-2 text-sm" role="status">
                    <span>Kunde inte läsa arkivet{source.archiveName ? ` ${source.archiveName}` : ''}. Rutorna är som förut, men de fasta timmarna saknas.</span>
                    {state.archiveId && (
                      <button type="button" className="text-xs font-semibold underline" onClick={() => void source.fetchActivities(state.archiveId as string)}>
                        Försök igen
                      </button>
                    )}
                  </div>
                )}
                {source.unknownNames.length > 0 && (
                  <div className="sp-toast mb-4 flex flex-wrap items-center justify-between gap-2 bg-amber-50 px-4 py-2 text-sm" role="status">
                    <span>I arkivet finns också {source.unknownNames.join(', ')}, som inte är med i labbet.</span>
                    <button type="button" className="flex items-center gap-1 text-xs font-semibold underline" onClick={addUnknownTeachers}>
                      <UserPlus size={14} /> Lägg till
                    </button>
                  </div>
                )}

                <Schedule
                  state={state}
                  lessons={lessons}
                  shortByLesson={shortByLesson}
                  onRemoveDay={(teacherId, day) => commit(current => ({
                    ...current,
                    teachers: current.teachers.map(t => (t.id === teacherId ? { ...t, days: t.days.filter(d => d !== day) } : t)),
                  }))}
                  onSplit={id => updateLesson(id, l => splitLesson(l, state.classes))}
                  onMerge={id => updateLesson(id, l => mergeLesson(l, state.classes))}
                />

                <Teams
                  state={state}
                  lessons={lessons}
                  fixed={source.fixed}
                  busy={source.busy}
                  commit={commit}
                  onNewTeam={() => commit(current => newTeam(current).state)}
                />
              </div>

              <LabPlansPanel lab={lab} />
            </div>
          )}
        </div>

        <DragOverlay dropAnimation={null}>
          {dragging && <DragPreview data={dragging} state={state} />}
        </DragOverlay>
      </DndContext>

      {/* Dörren till detaljplanen. Liten med flit, som dörren hit från terminen. */}
      <Link
        href="/features/arbetslag/detalj"
        title="Detaljplan"
        aria-label="Detaljplan"
        className="fixed bottom-4 left-4 z-20 rounded-md border-2 border-black bg-white p-1.5 opacity-60 shadow-[2px_2px_0_0_#000] transition-opacity hover:opacity-100 focus-visible:opacity-100"
      >
        <DoorOpen size={18} />
      </Link>
    </div>
  );
}

// ── Schemat ──

function Schedule({
  state,
  lessons,
  shortByLesson,
  onRemoveDay,
  onSplit,
  onMerge,
}: {
  state: LabState;
  lessons: LabLesson[];
  shortByLesson: Map<string, string[]>;
  onRemoveDay: (teacherId: string, day: LabDay) => void;
  onSplit: (lessonId: string) => void;
  onMerge: (lessonId: string) => void;
}) {
  // Hela schemat tar emot brickor från arbetslagen: släppt här = inget lag.
  const { setNodeRef, isOver, active } = useDroppable({ id: SCHEDULE_DROP });
  const returning = (active?.data.current as DragData | undefined)?.kind === 'brick';

  return (
    <div className="overflow-x-auto">
      <div
        ref={setNodeRef}
        className={cn('grid min-w-[900px] grid-cols-5 gap-3 rounded-xl', returning && isOver && 'outline-dashed outline-2 outline-offset-4 outline-rose-600')}
      >
        {LAB_DAYS.map(day => (
          <DayColumn
            key={day}
            day={day}
            state={state}
            lessons={sortLessons(lessons.filter(l => l.day === day))}
            shortByLesson={shortByLesson}
            onRemoveDay={onRemoveDay}
            onSplit={onSplit}
            onMerge={onMerge}
          />
        ))}
      </div>
    </div>
  );
}

function DayColumn({
  day,
  state,
  lessons,
  shortByLesson,
  onRemoveDay,
  onSplit,
  onMerge,
}: {
  day: LabDay;
  state: LabState;
  lessons: LabLesson[];
  shortByLesson: Map<string, string[]>;
  onRemoveDay: (teacherId: string, day: LabDay) => void;
  onSplit: (lessonId: string) => void;
  onMerge: (lessonId: string) => void;
}) {
  const box = (lesson: LabLesson) => (
    <LessonBox
      key={lesson.id}
      lesson={lesson}
      state={state}
      problems={shortByLesson.get(lesson.id) ?? []}
      onSplit={() => onSplit(lesson.id)}
      onMerge={() => onMerge(lesson.id)}
    />
  );
  // Hela dagen tar emot lärare, så att man inte behöver pricka rubriken.
  const { setNodeRef, isOver, active } = useDroppable({ id: `${DAY_DROP_PREFIX}${day}` });
  const teacherOver = isOver && (active?.data.current as DragData | undefined)?.kind === 'teacher';
  const available = state.teachers.filter(t => !t.resource && t.days.includes(day));

  return (
    <div ref={setNodeRef} className={cn('sp-card flex flex-col', teacherOver && 'outline outline-4 outline-offset-2 outline-black')}>
      <div className={cn('border-b-2 border-black px-3 py-2', teacherOver && 'bg-amber-50')}>
        <h2 className="text-lg font-black uppercase tracking-wide">{day.slice(0, 3)}</h2>
        <div className="mt-1 flex min-h-[26px] flex-wrap gap-1">
          {available.length === 0 && <span className="text-xs text-gray-400">Dra lärare hit.</span>}
          {available.map(teacher => (
            <TeacherChip
              key={teacher.id}
              teacherId={teacher.id}
              name={teacher.name}
              days={teacher.days}
              dragId={`teacher:${teacher.id}:${day}`}
              size="sm"
              teams={teamsOf(state, teacher.id)}
              onRemove={() => onRemoveDay(teacher.id, day)}
              removeLabel={`${teacher.name} är inte tillgänglig på ${day.toLowerCase()}`}
            />
          ))}
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-2 p-2">
        {lessons.filter(isBeforeLunch).map(box)}
        <div className="my-2 border-t-[3px] border-dotted border-gray-400" aria-label="Lunch" />
        {lessons.filter(l => !isBeforeLunch(l)).map(box)}
      </div>
    </div>
  );
}

function LessonBox({
  lesson,
  state,
  problems,
  onSplit,
  onMerge,
}: {
  lesson: LabLesson;
  state: LabState;
  problems: string[];
  onSplit: () => void;
  onMerge: () => void;
}) {
  const height = Math.max(48, lessonMinutes(lesson) * PX_PER_MINUTE);
  const team = state.teams.find(t => t.id === lesson.teamId);
  const { setNodeRef, attributes, listeners, isDragging } = useDraggable({
    id: `lesson:${lesson.id}`,
    data: { kind: 'lesson', lessonId: lesson.id } satisfies DragData,
    disabled: lesson.split,
  });

  const warning = problems.length > 0 && (
    <span
      className="absolute bottom-1 right-1 h-2.5 w-2.5 rounded-full border border-white bg-rose-600"
      title={problems.join('\n')}
      aria-label={problems.join(' ')}
    />
  );

  const partial = (lesson.absentClasses?.length ?? 0) > 0;
  const toggle = partial ? null : (
    <button
      type="button"
      onClick={lesson.split ? onMerge : onSplit}
      title={lesson.split ? 'Slå ihop till en ruta' : 'Dela i tre, en per klass'}
      aria-label={lesson.split ? 'Slå ihop till en ruta' : 'Dela i tre, en per klass'}
      className="rounded p-0.5 text-gray-600 hover:bg-black/10 hover:text-black"
    >
      {lesson.split ? <Square size={13} /> : <Columns3 size={13} />}
    </button>
  );

  // En lektion där någon klass saknas visas alltid per klass.
  if (lesson.split || partial) {
    return (
      <div className="relative" style={{ minHeight: height }}>
        <div className="mb-0.5 flex items-center justify-between px-0.5">
          <span className="font-mono text-[11px] font-bold">{lesson.start}–{lesson.end}</span>
          {toggle}
        </div>
        <div className="grid grid-cols-3 gap-1" style={{ minHeight: height - 20 }}>
          {state.classes.map(className => (
            <ClassPart key={className} lesson={lesson} className={className} state={state} />
          ))}
        </div>
        {warning}
      </div>
    );
  }

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={cn(
        'relative flex cursor-grab touch-none flex-col justify-between rounded-md border-2 px-2 py-1 active:cursor-grabbing',
        team ? 'border-black' : 'border-rose-600 bg-white',
        isDragging && 'opacity-40'
      )}
      style={{ minHeight: height, background: team?.color, color: team ? getReadableTextColor(team.color) : undefined }}
      aria-label={`${lessonLabel(lesson)}${team ? `, ${team.name}` : ', inget arbetslag'}`}
    >
      <div className="flex items-start justify-between gap-1">
        <span className={cn('font-mono text-xs font-bold', !team && 'text-rose-700')}>{lesson.start}–{lesson.end}</span>
        {toggle}
      </div>
      {team && (
        <span className="flex min-w-0 items-center gap-1.5">
          <TeamBadge team={team} />
          <span className="truncate text-sm font-black">{team.name}</span>
        </span>
      )}
      {warning}
    </div>
  );
}

function ClassPart({ lesson, className, state }: { lesson: LabLesson; className: string; state: LabState }) {
  const team = state.teams.find(t => t.id === classTeamId(lesson, className));
  const absent = lesson.absentClasses?.includes(className) ?? false;
  const { setNodeRef, attributes, listeners, isDragging } = useDraggable({
    id: `part:${lesson.id}:${className}`,
    data: { kind: 'part', lessonId: lesson.id, className } satisfies DragData,
    disabled: absent,
  });
  if (absent) {
    // Klassen har inte tema den här tiden i arkivet.
    return (
      <div
        title={`${className} har inte tema den här tiden`}
        aria-label={`${lessonLabel(lesson)} ${className}, ingen lektion`}
        className="rounded border-2 border-dashed border-black/20 opacity-50"
        style={{ background: `repeating-linear-gradient(135deg, ${classColor(className)} 0 4px, transparent 4px 9px)` }}
      />
    );
  }
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      title={`${className}${team ? `: ${team.name}` : ''}`}
      aria-label={`${lessonLabel(lesson)} ${className}${team ? `, ${team.name}` : ', inget arbetslag'}`}
      className={cn(
        'flex min-w-0 cursor-grab touch-none flex-col justify-end rounded border-2 p-1 active:cursor-grabbing',
        team ? 'border-black' : 'border-black/30',
        isDragging && 'opacity-40'
      )}
      style={{ background: classColor(className) }}
    >
      {/* De smala klassrutorna visar bara lagets siffra; namnet står i verktygstipset. */}
      {team && <TeamBadge team={team} className="self-start" />}
    </div>
  );
}

// ── Arbetslagen ──

function Teams({
  state,
  lessons,
  fixed,
  busy,
  commit,
  onNewTeam,
}: {
  state: LabState;
  lessons: LabLesson[];
  fixed: Map<string, FixedHours>;
  busy?: BusyMap;
  commit: (change: (current: LabState) => LabState) => void;
  onNewTeam: () => void;
}) {
  const plannable = state.teachers.filter(t => !t.resource);
  const shares = useMemo(() => teacherTeachingMinutes(state, lessons, busy), [state, lessons, busy]);
  return (
    <section className="mt-8 grid gap-4">
      <div className="sp-card flex flex-wrap items-center gap-2 px-4 py-3">
        <h2 className="mr-2 font-bold" title="Timmar per vecka: fasta pass i arkivet plus temat, räknat i klasspass (en lärare per klass och lektion)">Lärare</h2>
        {plannable.map(teacher => (
          <TeacherChip
            key={teacher.id}
            teacherId={teacher.id}
            name={teacher.name}
            days={teacher.days}
            hours={shares.get(teacher.id) ?? 0}
            fixed={fixed.get(teacher.id)}
            teams={teamsOf(state, teacher.id)}
          />
        ))}
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {sortTeams(state.teams).map(team => <TeamCard key={team.id} team={team} state={state} lessons={lessons} commit={commit} />)}
        <NewTeamCard onClick={onNewTeam} />
      </div>
    </section>
  );
}

/**
 * En lärare att dra: till en dag (blir tillgänglig), till ett arbetslag
 * (blir medlem). Samma lärare kan stå på flera ställen, därför eget `dragId`.
 * Ikonerna efter namnet är lagen läraren är med i, med lagets siffra.
 */
function TeacherChip({
  teacherId,
  name,
  days,
  dragId = `teacher:${teacherId}`,
  size = 'md',
  hours,
  fixed,
  teams = [],
  onRemove,
  removeLabel,
}: {
  teacherId: string;
  name: string;
  days: LabDay[];
  dragId?: string;
  /** Arbetslagen läraren är med i, i sifferordning. */
  teams?: LabTeam[];
  /** Lärarens del av gruppernas lektioner, i minuter. Visas som en räknare. */
  hours?: number;
  /** Fasta pass i arkivet, t.ex. matte. Läggs till räknaren. */
  fixed?: FixedHours;
  size?: 'sm' | 'md';
  onRemove?: () => void;
  removeLabel?: string;
}) {
  const { setNodeRef, attributes, listeners, isDragging } = useDraggable({
    id: dragId,
    data: { kind: 'teacher', teacherId } satisfies DragData,
  });
  return (
    <span
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      title={`Tillgänglig: ${days.map(d => d.slice(0, 3).toLowerCase()).join(', ') || 'inga dagar'}`}
      className={cn(
        'flex cursor-grab touch-none items-center gap-1 rounded-full border-2 border-black bg-white font-bold active:cursor-grabbing',
        size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm',
        isDragging && 'opacity-40'
      )}
    >
      {name}
      {teams.length > 0 && (
        <span className="flex gap-0.5">
          {teams.map(team => <TeamBadge key={team.id} team={team} size="sm" />)}
        </span>
      )}
      {hours !== undefined && <HourCounter tema={hours} fixed={fixed} />}
      {onRemove && (
        <button
          type="button"
          onPointerDown={event => event.stopPropagation()}
          onKeyDown={event => event.stopPropagation()}
          onClick={onRemove}
          title={removeLabel}
          aria-label={removeLabel}
          className="-mr-1 rounded-full p-0.5 text-gray-500 hover:bg-rose-50 hover:text-rose-700"
        >
          <X size={10} />
        </button>
      )}
    </span>
  );
}

/**
 * Lärarens timmar per vecka: summan, med en stapel där den grå delen är fasta
 * pass ur arkivet och den svarta temat. Uppdelningen står i verktygstipset.
 */
function HourCounter({ tema, fixed }: { tema: number; fixed?: FixedHours }) {
  const fixedMinutes = fixed?.total ?? 0;
  const total = tema + fixedMinutes;
  const breakdown = [
    ...(fixed?.parts ?? []).map(part => `${part.label} ${formatHours(part.minutes)}`),
    `tema ${formatHours(tema)}`,
  ].join(' + ');
  return (
    <span
      className={cn(
        'relative overflow-hidden rounded-full border px-1.5 pb-[3px] text-[11px] leading-tight tabular-nums',
        total > 0 ? 'border-black bg-white text-black' : 'border-gray-200 bg-gray-100 text-gray-500'
      )}
      title={`${breakdown} = ${formatHours(total)} per vecka. Temat räknas i klasspass: en satt lärare får hela lektionen, annars delas lagets klasser på dem som kan den dagen.`}
    >
      {formatHours(total)}
      {total > 0 && (
        <span className="absolute inset-x-0 bottom-0 flex h-[3px]" aria-hidden>
          <span className="bg-gray-400" style={{ width: `${(fixedMinutes / total) * 100}%` }} />
          <span className="flex-1 bg-black" />
        </span>
      )}
    </span>
  );
}

function TeamCard({
  team,
  state,
  lessons,
  commit,
}: {
  team: LabTeam;
  state: LabState;
  lessons: LabLesson[];
  commit: (change: (current: LabState) => LabState) => void;
}) {
  const { setNodeRef, isOver, active } = useDroppable({ id: teamDropId(team.id) });
  const accepts = active && (active.data.current as DragData | undefined)?.kind !== undefined;

  const owned = sortLessons(lessons).flatMap(lesson => {
    const classes = teamsInLesson(lesson, state.classes).get(team.id);
    return classes ? [{ lesson, classes }] : [];
  });
  const minutes = owned.reduce((sum, { lesson }) => sum + lessonMinutes(lesson), 0);
  const members = team.memberIds.map(id => state.teachers.find(t => t.id === id)).filter(Boolean) as LabState['teachers'];

  const updateTeam = (change: (t: LabTeam) => LabTeam) =>
    commit(current => ({ ...current, teams: current.teams.map(t => (t.id === team.id ? change(t) : t)) }));

  return (
    <div
      ref={setNodeRef}
      className={cn('sp-card flex flex-col', accepts && isOver && 'outline outline-4 outline-offset-2 outline-black')}
    >
      <div
        className="flex items-center gap-2 border-b-2 border-black px-3 py-2"
        style={{ background: team.color, color: getReadableTextColor(team.color) }}
      >
        <TeamNumberInput
          team={team}
          onCommit={number => commit(current => ({ ...current, teams: setTeamNumber(current.teams, team.id, number) }))}
        />
        <ColorSwatch color={team.color} label={team.name} onChange={color => updateTeam(t => ({ ...t, color }))} />
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
        {members.length === 0 && <span className="text-xs text-gray-500">Dra lärare hit.</span>}
        {members.map(teacher => (
          <button
            key={teacher.id}
            type="button"
            onClick={() => updateTeam(t => ({ ...t, memberIds: t.memberIds.filter(id => id !== teacher.id) }))}
            title={`Ta bort ${teacher.name} ur laget`}
            className="flex items-center gap-1 rounded-full border-2 border-black bg-black px-2 py-0.5 text-xs font-bold text-white hover:bg-gray-700"
          >
            {teacher.name} <X size={11} />
          </button>
        ))}
      </div>

      <div className="flex flex-1 flex-col gap-1 p-3">
        {owned.length === 0 && (
          <div className="flex flex-1 items-center justify-center rounded-md border-2 border-dashed border-gray-300 p-3 text-center text-xs text-gray-500">
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
        <div className="border-t border-gray-200 px-3 py-1.5 text-xs text-gray-600">
          {owned.length} {owned.length === 1 ? 'lektion' : 'lektioner'} · {formatMinutes(minutes)}
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
      className={cn('flex cursor-grab touch-none items-center gap-2 rounded border-2 border-black bg-white px-2 py-1 text-xs active:cursor-grabbing', isDragging && 'opacity-40')}
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
        className="ml-auto rounded p-0.5 text-gray-500 hover:bg-rose-50 hover:text-rose-700"
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
        'flex min-h-[140px] flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-black/40 bg-white/70 p-4 text-sm font-semibold text-gray-600 hover:border-black hover:text-black',
        active && isOver && 'border-black bg-white text-black'
      )}
    >
      <Plus size={18} />
      Nytt arbetslag
      <span className="text-xs font-normal text-gray-500">Klicka, eller släpp en lektion eller lärare här</span>
    </button>
  );
}

// ── Det som följer muspekaren ──

function DragPreview({ data, state }: { data: DragData; state: LabState }) {
  const lesson = 'lessonId' in data ? state.template.find(l => l.id === data.lessonId) : undefined;
  if (data.kind === 'teacher') {
    const teacher = state.teachers.find(t => t.id === data.teacherId);
    return <span className="rounded-full border-2 border-black bg-white px-3 py-1 text-sm font-bold shadow-[2px_2px_0_0_#000]">{teacher?.name}</span>;
  }
  if (!lesson) return null;
  const background = data.kind === 'part' ? classColor(data.className) : '#fff';
  return (
    <span
      className="inline-block rounded-md border-2 border-black px-2 py-1 font-mono text-xs font-bold shadow-[2px_2px_0_0_#000]"
      style={{ background }}
    >
      {lessonLabel(lesson)}{data.kind === 'part' && ` · ${data.className}`}
    </span>
  );
}
