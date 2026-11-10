'use client';

import React from 'react';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import { Columns3, Plus, Square } from 'lucide-react';
import { TeamBadge } from '@/components/lesson-lab/LabInputs';
import { QuietMark } from '@/components/lesson-lab/LabStatus';
import { cn } from '@/lib/utils';
import type { LabDay, LabLesson, LabTeam } from '@/types/lessonLab';
import { LAB_DAYS } from '@/utils/lessonLab';
import {
  canTeachLesson,
  classGroups,
  dayLunch,
  lessonReserve,
  lessonStaffing,
  placeLessons,
  staffingLevel,
  TeamStaffing,
  Timeline,
} from '@/utils/lessonLabView';
import { getReadableTextColor } from '@/utils/readableTextColor';
import {
  classColor,
  DragData,
  SCHEDULE_DROP,
  DAY_DROP_PREFIX,
  lessonElementId,
  lessonLabel,
  ViewContext,
} from '@/components/lesson-lab/labShared';
import { TeacherChip } from '@/components/lesson-lab/LabTeams';

/** Schemat i Arbetslag: dagkolumnerna, lektionsrutorna, klassgrupperna och bemanningsraden. */

/** Höjd per minut på tidsaxeln. En lektion på 75 minuter rymmer tid, lag och bemanning. */
const PX_PER_MINUTE = 1.4;

export function LabSchedule({
  view,
  lessons,
  timeline,
  onSetDay,
  onSplit,
  onMerge,
}: {
  view: ViewContext;
  lessons: LabLesson[];
  timeline: Timeline;
  onSetDay: (teacherId: string, day: LabDay, available: boolean) => void;
  onSplit: (lessonId: string) => void;
  onMerge: (lessonId: string) => void;
}) {
  // Hela schemat tar emot brickor från arbetslagen: släppt här = inget lag.
  const { setNodeRef, isOver, active } = useDroppable({ id: SCHEDULE_DROP });
  const returning = (active?.data.current as DragData | undefined)?.kind === 'brick';

  return (
    // Luft runt om, utan att något flyttas: annars kapar skrollningen fredagens
    // skugga och släppramarna, som ligger utanför dagarna.
    <div className="-mx-2 -mt-2 overflow-x-auto p-2">
      {/* Två rader, dagarnas rubriker och dagarna, så att rubrikerna blir lika höga. Ingen tidsaxel:
          lektionerna visar sina tider, och dagarna linjerar med boxarna ovanför och nedanför. */}
      <div
        ref={setNodeRef}
        className={cn(
          'grid min-w-[960px] grid-cols-5 grid-rows-[auto_auto] gap-x-3 rounded-ui',
          returning && isOver && 'outline-dashed outline-2 outline-offset-4 outline-rose-600'
        )}
      >
        {LAB_DAYS.map((day, index) => (
          <LabDayColumn
            key={day}
            day={day}
            column={index + 1}
            view={view}
            lessons={lessons.filter(l => l.day === day)}
            timeline={timeline}
            onSetDay={onSetDay}
            onSplit={onSplit}
            onMerge={onMerge}
          />
        ))}
      </div>
    </div>
  );
}

function LabDayColumn({
  day,
  column,
  view,
  lessons,
  timeline,
  onSetDay,
  onSplit,
  onMerge,
}: {
  day: LabDay;
  column: number;
  view: ViewContext;
  lessons: LabLesson[];
  timeline: Timeline;
  onSetDay: (teacherId: string, day: LabDay, available: boolean) => void;
  onSplit: (lessonId: string) => void;
  onMerge: (lessonId: string) => void;
}) {
  const { state, focusId } = view;
  // Hela dagen tar emot lärare, så att man inte behöver pricka rubriken.
  const { setNodeRef, isOver, active } = useDroppable({ id: `${DAY_DROP_PREFIX}${day}` });
  const teacherOver = isOver && (active?.data.current as DragData | undefined)?.kind === 'teacher';
  const plannable = state.teachers.filter(t => !t.resource);
  const available = plannable.filter(t => t.days.includes(day));
  const focusAway = focusId !== null && !available.some(t => t.id === focusId);
  const height = (timeline.end - timeline.start) * PX_PER_MINUTE;
  // Dagens egen lunch, med luft både ovanför och nedanför.
  const lunch = dayLunch(lessons, timeline);

  return (
    <div
      ref={setNodeRef}
      className={cn('sp-card row-span-2 row-start-1 grid grid-rows-subgrid', teacherOver && 'outline outline-4 outline-offset-2 outline-black')}
      style={{ gridColumn: column }}
    >
      <div className={cn('border-b-frame border-ui-line px-3 py-2 transition-opacity', teacherOver && 'bg-amber-50', focusAway && 'opacity-40')}>
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="text-lg font-black uppercase tracking-wide kron:font-mono kron:text-sm kron:font-medium kron:tracking-[0.08em]">{day.slice(0, 3)}</h2>
          <span className="text-[11px] font-semibold text-gray-600 kron:text-ui-muted">{available.length} av {plannable.length} kan</span>
        </div>
        {/* Alla lärare står här. De som inte kan är gråa och läggs till med ett klick. */}
        <div className="mt-1 flex flex-wrap gap-1">
          {plannable.length === 0 && <span className="text-xs text-ui-subtle">Inga lärare än.</span>}
          {plannable.map(teacher => (teacher.days.includes(day) ? (
            <TeacherChip
              key={teacher.id}
              teacher={teacher}
              dragId={`teacher:${teacher.id}:${day}`}
              size="sm"
              active={focusId === teacher.id}
              onRemove={() => onSetDay(teacher.id, day, false)}
              removeLabel={`${teacher.name} är inte tillgänglig på ${day.toLowerCase()}`}
            />
          ) : (
            <button
              key={teacher.id}
              type="button"
              onClick={() => onSetDay(teacher.id, day, true)}
              title={`${teacher.name} kan inte på ${day.toLowerCase()}. Klicka för att lägga till.`}
              aria-label={`Gör ${teacher.name} tillgänglig på ${day.toLowerCase()}`}
              className="flex items-center gap-0.5 rounded-full border-2 border-dashed border-gray-400 px-2 py-0.5 text-xs font-bold text-ui-muted hover:border-black hover:text-black"
            >
              {teacher.name} <Plus size={10} strokeWidth={3} />
            </button>
          )))}
        </div>
      </div>
      <div className="p-2">
        <div className="relative" style={{ height }}>
          {timeline.hours.map(minutes => (
            <div
              key={minutes}
              className="absolute inset-x-0 border-t border-ui-hair"
              style={{ top: (minutes - timeline.start) * PX_PER_MINUTE }}
              aria-hidden
            />
          ))}
          {lunch && (
            <div
              className="absolute -inset-x-2 flex items-center justify-center border-y-2 border-dotted border-gray-400 bg-[repeating-linear-gradient(135deg,#f3f4f6_0_6px,#fff_6px_12px)] text-[10px] font-black uppercase tracking-[0.2em] text-ui-muted"
              style={{ top: (lunch.start - timeline.start) * PX_PER_MINUTE, height: (lunch.end - lunch.start) * PX_PER_MINUTE }}
              aria-label="Lunch"
            >
              Lunch
            </div>
          )}
          {placeLessons(lessons, timeline).map(placed => (
            <LessonBox
              key={placed.lesson.id}
              lesson={placed.lesson}
              view={view}
              style={{
                top: placed.offset * PX_PER_MINUTE,
                height: Math.max(28, placed.minutes * PX_PER_MINUTE - 4),
                left: `calc(${(placed.column / placed.columns) * 100}% + ${placed.column > 0 ? 2 : 0}px)`,
                width: `calc(${100 / placed.columns}% - ${placed.columns > 1 ? 2 : 0}px)`,
              }}
              onSplit={() => onSplit(placed.lesson.id)}
              onMerge={() => onMerge(placed.lesson.id)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

/** Fokus tonar ned lektioner läraren inte kan ta och lyser upp dem läraren kan ta. */
const focusClasses = (view: ViewContext, lesson: LabLesson) => {
  const flash = view.flashId === lesson.id && 'outline outline-4 outline-offset-2 outline-orange-500';
  if (!view.focusId) return flash;
  return canTeachLesson(view.state, lesson, view.focusId, view.busy)
    ? cn('outline outline-[3px] outline-offset-2 outline-amber-400', flash)
    : cn('opacity-25', flash);
};

function LessonBox({
  lesson,
  view,
  style,
  onSplit,
  onMerge,
}: {
  lesson: LabLesson;
  view: ViewContext;
  style: React.CSSProperties;
  onSplit: () => void;
  onMerge: () => void;
}) {
  const { state } = view;
  const team = state.teams.find(t => t.id === lesson.teamId);
  const staffing = lessonStaffing(state, lesson, view.busy);
  // Ingen lärare i hela skolan är ledig att hoppa in. Visas inte när ett lag redan saknar lärare.
  const noReserve = lessonReserve(state, lesson, state.template, view.busy) <= 0
    && !staffing.some(s => staffingLevel(s) === 'short');
  const { setNodeRef, attributes, listeners, isDragging } = useDraggable({
    id: `lesson:${lesson.id}`,
    data: { kind: 'lesson', lessonId: lesson.id } satisfies DragData,
    disabled: lesson.split,
  });

  const partial = (lesson.absentClasses?.length ?? 0) > 0;
  const toggle = partial ? null : (
    <button
      type="button"
      onClick={lesson.split ? onMerge : onSplit}
      title={lesson.split ? 'Gör lektionen hel igen, med ett lag för alla klasser' : 'Dela per klass, så att klasserna kan få olika lag'}
      className="flex shrink-0 items-center gap-1 rounded border border-black/50 bg-white/80 px-1.5 py-0.5 text-[10px] font-bold text-gray-900 kron:text-ui-ink hover:bg-white"
    >
      {lesson.split ? <Square size={11} /> : <Columns3 size={11} />}
      {lesson.split ? 'Slå ihop' : 'Dela'}
    </button>
  );

  // En lektion där någon klass saknas visas alltid per klass.
  if (lesson.split || partial) {
    return (
      <div
        id={lessonElementId(lesson.id)}
        className={cn('absolute flex flex-col gap-1 overflow-hidden rounded-md border-frame border-ui-line bg-ui-paper p-1 shadow-frame-sm transition-opacity', focusClasses(view, lesson))}
        style={style}
      >
        <div className="flex items-center justify-between gap-1 px-0.5">
          <span className="flex items-center gap-1">
            <span className="font-mono text-[11px] font-bold">{lesson.start}–{lesson.end}</span>
            {noReserve && <ReserveMark quiet={view.quietTight} />}
          </span>
          {toggle}
        </div>
        <div className="flex min-h-0 flex-1 gap-1">
          {classGroups(lesson, state.classes).map(group => (
            <ClassGroupBox
              key={group.classes.join('|')}
              lesson={lesson}
              classes={group.classes}
              absent={group.absent}
              team={state.teams.find(t => t.id === group.teamId)}
              staffing={staffing.find(s => s.teamId === group.teamId)}
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div
      ref={setNodeRef}
      id={lessonElementId(lesson.id)}
      {...attributes}
      {...listeners}
      className={cn(
        'absolute flex cursor-grab touch-none flex-col justify-between gap-0.5 overflow-hidden rounded-md border-2 kron:border px-2 py-1 shadow-frame-sm transition-opacity active:cursor-grabbing',
        team ? 'border-black kron:border-ui-line' : 'border-rose-600 bg-ui-paper',
        isDragging && 'opacity-40',
        focusClasses(view, lesson)
      )}
      style={{ ...style, background: team?.color, color: team ? getReadableTextColor(team.color) : undefined }}
      aria-label={`${lessonLabel(lesson)}${team ? `, ${team.name}` : ', inget arbetslag'}`}
    >
      <div className="flex items-center justify-between gap-1">
        <span className={cn('font-mono text-xs font-bold', !team && 'text-rose-700 kron:text-ui-danger')}>{lesson.start}–{lesson.end}</span>
        {toggle}
      </div>
      {team ? (
        <span className="flex min-w-0 items-center gap-1.5">
          <TeamBadge team={team} />
          <span className="truncate text-sm font-black">{team.name}</span>
        </span>
      ) : (
        <span className="text-xs font-bold text-rose-700 kron:text-ui-danger">Inget lag. Dra till ett arbetslag.</span>
      )}
      {staffing[0] && <StaffingLine staffing={staffing[0]} view={view} noReserve={noReserve} />}
    </div>
  );
}

const NO_RESERVE_TEXT = 'Ingen lärare i skolan är ledig att hoppa in under passet.';

/** "0 reserv" i orange, eller en liten gul ikon när pass utan marginal är nedtonade. */
function ReserveMark({ quiet }: { quiet: boolean }) {
  if (quiet) return <QuietMark title={NO_RESERVE_TEXT} />;
  return (
    <span className="shrink-0 whitespace-nowrap rounded border border-orange-800 bg-orange-100 px-1 text-[10px] font-bold text-orange-900" title={NO_RESERVE_TEXT}>
      0 reserv
    </span>
  );
}

/**
 * "3 klasser · 4 kan" med initialerna på lagets lärare som kan. Röd när laget
 * har för få. Saknas reserv i hela skolan står det efter (`ReserveMark`).
 */
function StaffingLine({ staffing, view, noReserve }: { staffing: TeamStaffing; view: ViewContext; noReserve: boolean }) {
  const level = staffingLevel(staffing);
  const names = staffing.availableIds.map(id => view.state.teachers.find(t => t.id === id)?.name ?? '?');
  const count = staffing.classes.length;
  const text = level === 'short'
    ? `${names.length} kan till ${count} ${count === 1 ? 'klass' : 'klasser'}`
    : `${count} ${count === 1 ? 'klass' : 'klasser'} · ${names.length} kan`;
  return (
    <span className="flex min-w-0 items-center gap-1" title={names.length ? `Kan: ${names.join(', ')}` : 'Ingen i laget kan den här tiden'}>
      <span
        className={cn(
          'truncate whitespace-nowrap text-[10.5px] font-bold',
          level === 'short' && 'rounded bg-rose-700 px-1 text-white'
        )}
      >
        {text}
      </span>
      {noReserve && <ReserveMark quiet={view.quietTight} />}
      {staffing.availableIds.length > 0 && (
        <span className="ml-auto flex shrink-0">
          {staffing.availableIds.map((id, index) => (
            <span
              key={id}
              className={cn(
                'flex h-5 w-5 items-center justify-center rounded-full border-[1.5px] border-black text-[8.5px] font-black',
                index > 0 && '-ml-1.5',
                id === view.focusId ? 'bg-black text-white' : 'bg-ui-paper text-black'
              )}
            >
              {names[index].slice(0, 2)}
            </span>
          ))}
        </span>
      )}
    </span>
  );
}

/**
 * Klasser med samma lag i en delad lektion: en ruta i lagets färg med
 * klassernas namn överst. Varje klass går att dra för sig.
 */
function ClassGroupBox({
  lesson,
  classes,
  absent,
  team,
  staffing,
}: {
  lesson: LabLesson;
  classes: string[];
  absent: boolean;
  team?: LabTeam;
  staffing?: TeamStaffing;
}) {
  const textColor = team ? getReadableTextColor(team.color) : undefined;
  return (
    <div
      className={cn('relative flex min-w-0 overflow-hidden rounded border-2 kron:border', absent ? 'border-dashed border-black/30 opacity-60' : 'border-black kron:border-ui-line')}
      style={{ flex: `${classes.length} 1 0`, background: team?.color ?? '#fff' }}
    >
      {classes.map((className, index) => (
        <ClassPart key={className} lesson={lesson} className={className} absent={absent} team={team} first={index === 0} />
      ))}
      {!absent && (
        // Lagets namn och bemanning ligger över klasserna utan att ta emot klick: dragen går till klassen under.
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex min-w-0 flex-col gap-0.5 px-1 pb-0.5" style={{ color: textColor }}>
          {team ? (
            <>
              <span className="flex min-w-0 items-center gap-1">
                <TeamBadge team={team} size="sm" />
                <span className="truncate text-[10px] font-black uppercase">{team.name}</span>
              </span>
              {staffing && (
                <span className={cn('self-start truncate text-[9.5px] font-bold', staffingLevel(staffing) === 'short' && 'rounded bg-rose-700 px-1 text-white')}>
                  {classes.length} {classes.length === 1 ? 'klass' : 'klasser'} · {staffing.availableIds.length} kan
                </span>
              )}
            </>
          ) : (
            <span className="text-[10px] font-bold text-rose-700 kron:text-ui-danger">Inget lag</span>
          )}
        </div>
      )}
    </div>
  );
}

function ClassPart({ lesson, className, absent, team, first }: {
  lesson: LabLesson;
  className: string;
  absent: boolean;
  team?: LabTeam;
  first: boolean;
}) {
  const { setNodeRef, attributes, listeners, isDragging } = useDraggable({
    id: `part:${lesson.id}:${className}`,
    data: { kind: 'part', lessonId: lesson.id, className } satisfies DragData,
    disabled: absent,
  });
  const strip = (
    <span
      className="block truncate border-b-[1.5px] border-black kron:border-b kron:border-ui-line px-0.5 text-center text-[10px] font-black text-black kron:text-ui-ink"
      style={{ background: absent ? `repeating-linear-gradient(135deg, ${classColor(className)} 0 4px, #fff 4px 9px)` : classColor(className) }}
    >
      {className}
    </span>
  );
  if (absent) {
    // Klassen har inte tema den här tiden i arkivet.
    return (
      <div
        title={`${className} har inte tema den här tiden`}
        aria-label={`${lessonLabel(lesson)} ${className}, ingen lektion`}
        className={cn('flex min-w-0 flex-1 flex-col', !first && 'border-l border-black/20')}
      >
        {strip}
      </div>
    );
  }
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      title={`${className}${team ? `: ${team.name}` : ''}. Dra till ett lag.`}
      aria-label={`${lessonLabel(lesson)} ${className}${team ? `, ${team.name}` : ', inget arbetslag'}`}
      className={cn(
        'flex min-w-0 flex-1 cursor-grab touch-none flex-col active:cursor-grabbing',
        !first && 'border-l border-dashed border-black/40',
        isDragging && 'opacity-40'
      )}
    >
      {strip}
    </div>
  );
}
