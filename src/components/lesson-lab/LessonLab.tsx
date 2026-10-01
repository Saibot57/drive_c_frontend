'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
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
import {
  ChevronDown,
  Columns3,
  Download,
  HelpCircle,
  Loader2,
  Plus,
  Redo2,
  RefreshCw,
  Square,
  Trash2,
  Undo2,
  UserPlus,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FeatureNavigation } from '@/components/FeatureNavigation';
import { ColorSwatch, CommitInput, TeamBadge, TeamNumberInput } from '@/components/lesson-lab/LabInputs';
import { LabPlansPanel, PlanLoading, PlanNotices, PlanSaveStatus } from '@/components/lesson-lab/LabPlans';
import { HelpPanel, QuietMark, StatusBar } from '@/components/lesson-lab/LabStatus';
import { useLabArchive } from '@/hooks/useLabArchive';
import { readStored, useLessonLabState, writeStored } from '@/hooks/useLessonLabState';
import { cn } from '@/lib/utils';
import { downloadBlob } from '@/utils/download';
import { buildLabExport, labExportFileName } from '@/utils/labExport';
import { isOwnPlan } from '@/utils/labPlans';
import type { LabDay, LabLesson, LabState, LabTeacher, LabTeam } from '@/types/lessonLab';
import {
  assignTeam,
  BusyMap,
  formatHours,
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
import {
  canTeachLesson,
  classGroups,
  dayLunch,
  lessonReserve,
  lessonStaffing,
  placeLessons,
  planStatus,
  StaffingFix,
  staffingFixes,
  staffingLevel,
  TeamStaffing,
  Timeline,
  timelineFor,
} from '@/utils/lessonLabView';
import { getReadableTextColor } from '@/utils/readableTextColor';
import '@/styles/schedule-theme.css';

/**
 * Arbetslag, enkla vyn: veckans fasta lektioner överst, på en tidsaxel som
 * alla dagar delar, och arbetslagen nederst. Man drar en lektion till ett
 * arbetslag. En ruta kan delas, en per klass, så att klasserna kan få olika lag.
 *
 * Varje lektion visar sin bemanning: klasserna mot lagets lärare som kan.
 * Raden under verktygsraden sammanfattar upplägget (`LabStatus`). Klickar man
 * på en lärare i lärarraden lyses lärarens lag, dagar och lektioner upp.
 *
 * Här visas bara veckomallen. Lärare per klass, områden, tider, egna veckor
 * och varningar finns i detaljplanen. Den är inte klar för kollegorna än och
 * nås bara via direktlänken /features/arbetslag/detalj.
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

/** Höjd per minut på tidsaxeln. En lektion på 75 minuter rymmer tid, lag och bemanning. */
const PX_PER_MINUTE = 1.4;

/** Avvikelse från snittet som markeras i lärarraden. */
const DEVIATION_MINUTES = 120;

type DragData =
  | { kind: 'lesson'; lessonId: string }
  | { kind: 'part'; lessonId: string; className: string }
  | { kind: 'teacher'; teacherId: string }
  | { kind: 'brick'; lessonId: string; teamId: string };

const SCHEDULE_DROP = 'schedule';
const NEW_TEAM_DROP = 'new-team';
const teamDropId = (teamId: string) => `team:${teamId}`;
const DAY_DROP_PREFIX = 'day:';
const lessonElementId = (lessonId: string) => `lab-lesson-${lessonId}`;

/** Om pass utan marginal är nedtonade, per webbläsare. */
const QUIET_TIGHT_KEY = 'lessonLab.quietTight.v1';

/** Arbetslagen en lärare är med i, i sifferordning. */
const teamsOf = (state: LabState, teacherId: string) =>
  sortTeams(state.teams).filter(team => team.memberIds.includes(teacherId));

const lessonLabel = (lesson: LabLesson) => `${lesson.day.slice(0, 3)} ${lesson.start}`;

const minutesToTime = (minutes: number) =>
  `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;

/** Det som fokus, bemanning och timmar behöver, samlat för komponenterna. */
type ViewContext = {
  state: LabState;
  busy?: BusyMap;
  /** Läraren i fokus, eller `null`. */
  focusId: string | null;
  /** Lektionen som "Visa" i varningslistan pekar ut en stund. */
  flashId: string | null;
  /** Pass utan marginal visas dämpat: en liten gul ikon i stället för orange. */
  quietTight: boolean;
};

export default function LessonLab() {
  const lab = useLessonLabState();
  const { state, loaded, commit, undo, redo, canUndo, canRedo } = lab;
  const source = useLabArchive(state, loaded);
  // Ett delat upplägg kan bygga på ett arkiv som bara ägaren når. Då saknas
  // de fasta timmarna, och det ska sägas som det är i stället för "finns inte".
  const sharedPlan = lab.activePlan ? !isOwnPlan(lab.activePlan) : false;
  const archiveUnreachable = Boolean(
    sharedPlan && state.archiveId && source.archives && !source.archives.some(a => a.id === state.archiveId)
  );
  const [dragging, setDragging] = useState<DragData | null>(null);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [plansOpen, setPlansOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [issuesOpen, setIssuesOpen] = useState(false);
  const [flashId, setFlashId] = useState<string | null>(null);
  const [quietTight, setQuietTightState] = useState(false);
  useEffect(() => { setQuietTightState(readStored(QUIET_TIGHT_KEY, raw => raw === true, false)); }, []);
  const setQuietTight = (quiet: boolean) => {
    setQuietTightState(quiet);
    writeStored(QUIET_TIGHT_KEY, quiet);
  };
  const flashTimer = useRef<number | null>(null);
  useEffect(() => () => { if (flashTimer.current) window.clearTimeout(flashTimer.current); }, []);

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

  // Upplägget med allt en språkmodell behöver för att föreslå alternativ.
  const downloadForAi = () => {
    const data = buildLabExport({
      state,
      plan: lab.activePlan,
      archive: { id: state.archiveId ?? null, name: source.archiveName, activities: source.activities },
    });
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    downloadBlob(blob, labExportFileName(lab.activePlan?.name ?? ''));
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

  const setDay = (teacherId: string, day: LabDay, available: boolean) => commit(current => ({
    ...current,
    teachers: current.teachers.map(t => {
      if (t.id !== teacherId || t.days.includes(day) === available) return t;
      return { ...t, days: available ? LAB_DAYS.filter(d => d === day || t.days.includes(d)) : t.days.filter(d => d !== day) };
    }),
  }));

  // Lärarnas tid per vecka: temat räknat i klasspass plus de fasta passen i arkivet.
  const tema = useMemo(() => teacherTeachingMinutes(state, lessons, source.busy), [state, lessons, source.busy]);
  const totals = useMemo(() => new Map(state.teachers.filter(t => !t.resource).map(t => [
    t.id,
    (tema.get(t.id) ?? 0) + (source.fixed.get(t.id)?.total ?? 0),
  ])), [state.teachers, tema, source.fixed]);
  const spread = useMemo(() => {
    const values = Array.from(totals.values());
    if (values.length === 0) return null;
    return { min: Math.min(...values), max: Math.max(...values), avg: values.reduce((a, b) => a + b, 0) / values.length };
  }, [totals]);

  const status = useMemo(
    () => planStatus(state, lessons, labWarnings(state, lessons, source.busy), source.busy),
    [state, lessons, source.busy]
  );
  const fixes = useMemo(() => staffingFixes(state, lessons, totals, source.busy), [state, lessons, totals, source.busy]);
  const timeline = useMemo(() => timelineFor(lessons), [lessons]);

  // En lärare som tagits bort kan inte stå i fokus.
  const focus = focusId && state.teachers.some(t => t.id === focusId) ? focusId : null;
  const view: ViewContext = { state, busy: source.busy, focusId: focus, flashId, quietTight };

  const showLesson = (lessonId: string) => {
    document.getElementById(lessonElementId(lessonId))?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setFlashId(lessonId);
    if (flashTimer.current) window.clearTimeout(flashTimer.current);
    flashTimer.current = window.setTimeout(() => setFlashId(null), 1800);
  };

  const applyFix = (fix: StaffingFix) => commit(current => ({
    ...current,
    teams: current.teams.map(t => (t.id === fix.teamId && !t.memberIds.includes(fix.teacherId)
      ? { ...t, memberIds: [...t.memberIds, fix.teacherId] }
      : t)),
  }));

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
      setDay(data.teacherId, onDay, true);
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

  const groupLabel = 'text-[11px] font-black uppercase tracking-[0.12em] text-gray-600';

  return (
    <div className="sp-root">
      <div className="fixed inset-0 z-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/bakgrund59.png" alt="" className="h-full w-full object-cover" />
      </div>

      <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setDragging(null)}>
        {/* Panelen står bredvid allt annat, verktygsraden också, som i schemaplaneraren. */}
        <div className="relative z-10 flex flex-col gap-6 pb-24 lg:flex-row">
          <div className="min-w-0 flex-1">
            <div className="sp-toolbar mb-4 flex flex-col items-start gap-3 p-4 lg:flex-row lg:flex-wrap lg:items-center">
              <FeatureNavigation />

              {/* Upplägget är det som sparas. Namnet öppnar panelen med de andra. */}
              <div className="flex items-center gap-2 rounded-lg border-2 border-black bg-amber-50 py-1 pl-3 pr-3">
                <span className={groupLabel}>Upplägg</span>
                <button
                  type="button"
                  onClick={() => setPlansOpen(open => !open)}
                  aria-expanded={plansOpen}
                  title={plansOpen ? 'Dölj sparade upplägg' : 'Visa sparade upplägg'}
                  className="sp-input flex h-9 max-w-[14rem] items-center gap-2 rounded-md bg-white px-3 text-sm font-bold"
                >
                  <span className="truncate">{lab.activePlan?.name ?? 'Inget upplägg'}</span>
                  <ChevronDown size={14} className="shrink-0" />
                </button>
                <PlanSaveStatus lab={lab} />
              </div>

              {/* Arkivet är schemat upplägget bygger på: tiderna och de fasta passen. */}
              <div className="flex items-center gap-2">
                <span className={groupLabel}>Arkiv</span>
                <select
                  className="sp-input h-9 max-w-[14rem] rounded-md bg-white px-3 text-sm font-semibold"
                  value={state.archiveId ?? ''}
                  onChange={event => chooseArchive(event.target.value)}
                  disabled={source.status === 'loading'}
                  aria-label="Arkiv som grund"
                  title="Arkivets temapass blir rutorna, och övriga pass räknas som lärarnas fasta timmar"
                >
                  <option value="">Tavlan (inget arkiv)</option>
                  {state.archiveId && !source.archives?.some(a => a.id === state.archiveId) && (
                    <option value={state.archiveId}>
                      {!source.archives ? 'Laddar arkiv…' : archiveUnreachable ? 'Inte delat med dig' : 'Arkivet finns inte längre'}
                    </option>
                  )}
                  {(source.archives ?? []).map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
                {state.archiveId && (
                  <Button
                    variant="neutral"
                    className="sp-btn h-9 gap-1.5 px-3"
                    onClick={() => void buildFromArchive(state.archiveId as string)}
                    disabled={source.status === 'loading'}
                    title="Läs om arkivet. Lektioner vid samma tid behåller sina arbetslag."
                  >
                    {source.status === 'loading' ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
                    Läs om
                  </Button>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2 lg:ml-auto">
                <Button variant="neutral" size="icon" className="sp-btn" onClick={undo} disabled={!canUndo} title="Ångra (Ctrl+Z)" aria-label="Ångra">
                  <Undo2 size={16} />
                </Button>
                <Button variant="neutral" size="icon" className="sp-btn" onClick={redo} disabled={!canRedo} title="Gör om (Ctrl+Shift+Z)" aria-label="Gör om">
                  <Redo2 size={16} />
                </Button>
                <span className="mx-1 h-7 w-0.5 bg-gray-300" aria-hidden />
                <Button
                  variant="neutral"
                  className="sp-btn gap-1.5 px-3"
                  onClick={downloadForAi}
                  disabled={!loaded || source.status === 'loading'}
                  title="Ladda ner upplägget som JSON, med regler, timmar och varningar, för att låta en AI föreslå alternativ"
                >
                  <Download size={15} /> JSON
                </Button>
                <Button
                  variant="neutral"
                  className="sp-btn gap-1.5 bg-sky-100 px-3 hover:bg-sky-200"
                  onClick={() => setHelpOpen(open => !open)}
                  aria-expanded={helpOpen}
                >
                  <HelpCircle size={16} /> Så funkar det
                </Button>
              </div>
            </div>

            {helpOpen && <HelpPanel onClose={() => setHelpOpen(false)} />}

            <PlanNotices lab={lab} />

            {!loaded ? <PlanLoading lab={lab} /> : (
              <div>
                <StatusBar
                  state={state}
                  status={status}
                  spread={spread}
                  fixes={fixes}
                  totals={totals}
                  open={issuesOpen}
                  onOpenChange={setIssuesOpen}
                  quietTight={quietTight}
                  onQuietTightChange={setQuietTight}
                  onShowLesson={showLesson}
                  onApplyFix={applyFix}
                />
                {archiveUnreachable && (
                  <div className="sp-toast mb-4 bg-amber-50 px-4 py-2 text-sm" role="status">
                    Upplägget bygger på ett arkiv i schemaplaneraren som inte är delat med dig, så lärarnas fasta
                    timmar saknas. Be {lab.activePlan?.ownerUsername ?? 'den som äger upplägget'} dela arkivet med dig.
                  </div>
                )}
                {source.status === 'error' && !archiveUnreachable && (
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
                  view={view}
                  lessons={lessons}
                  timeline={timeline}
                  onSetDay={setDay}
                  onSplit={id => updateLesson(id, l => splitLesson(l, state.classes))}
                  onMerge={id => updateLesson(id, l => mergeLesson(l, state.classes))}
                />

                <Teams
                  view={view}
                  lessons={lessons}
                  fixed={source.fixed}
                  tema={tema}
                  avg={spread?.avg ?? 0}
                  commit={commit}
                  onFocus={id => setFocusId(current => (current === id ? null : id))}
                  onNewTeam={() => commit(current => newTeam(current).state)}
                />
              </div>
            )}
          </div>

          {loaded && (
            <LabPlansPanel
              lab={lab}
              open={plansOpen}
              onOpenChange={setPlansOpen}
              activeArchiveId={state.archiveId ?? null}
              archives={source.archives}
              onArchiveShared={source.upsertArchive}
            />
          )}
        </div>

        <DragOverlay dropAnimation={null}>
          {dragging && <DragPreview data={dragging} state={state} />}
        </DragOverlay>
      </DndContext>
    </div>
  );
}

// ── Schemat ──

function Schedule({
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
  const height = (timeline.end - timeline.start) * PX_PER_MINUTE;

  return (
    <div className="overflow-x-auto pb-2">
      {/* Två rader: dagarnas rubriker och dagarna. Axeln står i andra raden, så att den linjerar med dagarna. */}
      <div
        ref={setNodeRef}
        className={cn(
          'grid min-w-[960px] grid-cols-[36px_repeat(5,minmax(0,1fr))] grid-rows-[auto_auto] gap-x-3 rounded-xl',
          returning && isOver && 'outline-dashed outline-2 outline-offset-4 outline-rose-600'
        )}
      >
        <div className="relative col-start-1 row-start-2 pt-2" aria-hidden>
          <div className="relative" style={{ height }}>
            {timeline.hours.map(minutes => (
              <span
                key={minutes}
                className="absolute right-0 font-mono text-[11px] font-bold text-gray-700"
                style={{ top: (minutes - timeline.start) * PX_PER_MINUTE - 8 }}
              >
                {minutesToTime(minutes)}
              </span>
            ))}
          </div>
        </div>
        {LAB_DAYS.map((day, index) => (
          <DayColumn
            key={day}
            day={day}
            column={index + 2}
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

function DayColumn({
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
      <div className={cn('border-b-2 border-black px-3 py-2 transition-opacity', teacherOver && 'bg-amber-50', focusAway && 'opacity-40')}>
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="text-lg font-black uppercase tracking-wide">{day.slice(0, 3)}</h2>
          <span className="text-[11px] font-semibold text-gray-600">{available.length} av {plannable.length} kan</span>
        </div>
        {/* Alla lärare står här. De som inte kan är gråa och läggs till med ett klick. */}
        <div className="mt-1 flex flex-wrap gap-1">
          {plannable.length === 0 && <span className="text-xs text-gray-400">Inga lärare än.</span>}
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
              className="flex items-center gap-0.5 rounded-full border-2 border-dashed border-gray-400 px-2 py-0.5 text-xs font-bold text-gray-500 hover:border-black hover:text-black"
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
              className="absolute inset-x-0 border-t border-gray-200"
              style={{ top: (minutes - timeline.start) * PX_PER_MINUTE }}
              aria-hidden
            />
          ))}
          {lunch && (
            <div
              className="absolute -inset-x-2 flex items-center justify-center border-y-2 border-dotted border-gray-400 bg-[repeating-linear-gradient(135deg,#f3f4f6_0_6px,#fff_6px_12px)] text-[10px] font-black uppercase tracking-[0.2em] text-gray-500"
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
      className="flex shrink-0 items-center gap-1 rounded border border-black/50 bg-white/80 px-1.5 py-0.5 text-[10px] font-bold text-gray-900 hover:bg-white"
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
        className={cn('absolute flex flex-col gap-1 overflow-hidden rounded-md border-2 border-black bg-white p-1 shadow-[2px_2px_0_0_#000] transition-opacity', focusClasses(view, lesson))}
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
        'absolute flex cursor-grab touch-none flex-col justify-between gap-0.5 overflow-hidden rounded-md border-2 px-2 py-1 shadow-[2px_2px_0_0_#000] transition-opacity active:cursor-grabbing',
        team ? 'border-black' : 'border-rose-600 bg-white',
        isDragging && 'opacity-40',
        focusClasses(view, lesson)
      )}
      style={{ ...style, background: team?.color, color: team ? getReadableTextColor(team.color) : undefined }}
      aria-label={`${lessonLabel(lesson)}${team ? `, ${team.name}` : ', inget arbetslag'}`}
    >
      <div className="flex items-center justify-between gap-1">
        <span className={cn('font-mono text-xs font-bold', !team && 'text-rose-700')}>{lesson.start}–{lesson.end}</span>
        {toggle}
      </div>
      {team ? (
        <span className="flex min-w-0 items-center gap-1.5">
          <TeamBadge team={team} />
          <span className="truncate text-sm font-black">{team.name}</span>
        </span>
      ) : (
        <span className="text-xs font-bold text-rose-700">Inget lag. Dra till ett arbetslag.</span>
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
                id === view.focusId ? 'bg-black text-white' : 'bg-white text-black'
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
      className={cn('relative flex min-w-0 overflow-hidden rounded border-2', absent ? 'border-dashed border-black/30 opacity-60' : 'border-black')}
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
            <span className="text-[10px] font-bold text-rose-700">Inget lag</span>
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
      className="block truncate border-b-[1.5px] border-black px-0.5 text-center text-[10px] font-black text-black"
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

// ── Arbetslagen ──

function Teams({
  view,
  lessons,
  fixed,
  tema,
  avg,
  commit,
  onFocus,
  onNewTeam,
}: {
  view: ViewContext;
  lessons: LabLesson[];
  fixed: Map<string, FixedHours>;
  tema: Map<string, number>;
  /** Snittet av lärarnas tid per vecka, i minuter. */
  avg: number;
  commit: (change: (current: LabState) => LabState) => void;
  onFocus: (teacherId: string) => void;
  onNewTeam: () => void;
}) {
  const { state, focusId } = view;
  const focusName = state.teachers.find(t => t.id === focusId)?.name;
  // Mest tid först, så att det syns vem som har mycket och vem som har lite.
  const rows = state.teachers
    .filter(t => !t.resource)
    .map(teacher => {
      const fixedMinutes = fixed.get(teacher.id)?.total ?? 0;
      const temaMinutes = tema.get(teacher.id) ?? 0;
      return { teacher, fixedMinutes, temaMinutes, total: fixedMinutes + temaMinutes };
    })
    .sort((a, b) => b.total - a.total || a.teacher.name.localeCompare(b.teacher.name, 'sv'));
  const max = Math.max(1, ...rows.map(r => r.total));

  return (
    <section className="mt-6 grid gap-4">
      <div className="sp-card px-4 py-3">
        <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1">
          <h2 className="font-bold" title="Timmar per vecka: fasta pass i arkivet plus temat, räknat i klasspass (en lärare per klass och lektion)">Lärare</h2>
          <span className="flex items-center gap-1.5 text-xs text-gray-700">
            <span className="h-2.5 w-3.5 rounded-sm border border-black bg-gray-400" aria-hidden /> fasta pass i arkivet
            <span className="ml-2 h-2.5 w-3.5 rounded-sm border border-black bg-black" aria-hidden /> tema
          </span>
          {rows.length > 0 && <span className="text-xs font-bold">Snitt {formatHours(avg)}</span>}
          <span className="text-xs text-gray-600 sm:ml-auto">
            {focusName
              ? <>Visar <b>{focusName}</b>: lag, dagar och lektioner. Klicka igen för att släppa.</>
              : 'Klicka på en lärare för att se lärarens lag och lektioner.'}
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          {rows.map(row => (
            <TeacherChip
              key={row.teacher.id}
              teacher={row.teacher}
              teams={teamsOf(state, row.teacher.id)}
              active={focusId === row.teacher.id}
              onClick={() => onFocus(row.teacher.id)}
              hours={(
                <HourBar
                  fixedMinutes={row.fixedMinutes}
                  temaMinutes={row.temaMinutes}
                  max={max}
                  avg={avg}
                  fixed={fixed.get(row.teacher.id)}
                  inverted={focusId === row.teacher.id}
                />
              )}
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
 * Ikonerna efter namnet är lagen läraren är med i, med lagets siffra. De visas
 * bara i lärarraden med timmarna, inte i veckodagarna. Där går läraren
 * också att klicka på för fokus.
 */
function TeacherChip({
  teacher,
  dragId = `teacher:${teacher.id}`,
  size = 'md',
  teams = [],
  active = false,
  hours,
  onClick,
  onRemove,
  removeLabel,
}: {
  teacher: LabTeacher;
  dragId?: string;
  size?: 'sm' | 'md';
  /** Arbetslagen läraren är med i, i sifferordning. */
  teams?: LabTeam[];
  /** Läraren står i fokus. */
  active?: boolean;
  hours?: React.ReactNode;
  onClick?: () => void;
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
      onClick={onClick}
      aria-pressed={onClick ? active : undefined}
      title={`Tillgänglig: ${teacher.days.map(d => d.slice(0, 3).toLowerCase()).join(', ') || 'inga dagar'}${onClick ? '. Klicka för fokus, dra till en dag eller ett lag.' : ''}`}
      className={cn(
        'flex cursor-grab touch-none items-center gap-1 rounded-full border-2 border-black font-bold active:cursor-grabbing',
        size === 'sm' ? 'px-2 py-0.5 text-xs' : 'gap-2 px-3 py-1 text-sm shadow-[2px_2px_0_0_#000]',
        active ? 'bg-black text-white' : 'bg-white',
        active && size === 'md' && 'shadow-[2px_2px_0_0_#facc15]',
        isDragging && 'opacity-40'
      )}
    >
      {teacher.name}
      {teams.length > 0 && (
        <span className="flex gap-0.5">
          {teams.map(team => <TeamBadge key={team.id} team={team} size="sm" />)}
        </span>
      )}
      {hours}
      {onRemove && (
        <button
          type="button"
          onPointerDown={event => event.stopPropagation()}
          onKeyDown={event => event.stopPropagation()}
          onClick={onRemove}
          title={removeLabel}
          aria-label={removeLabel}
          className={cn('-mr-1 rounded-full p-0.5 hover:bg-rose-50 hover:text-rose-700', active ? 'text-gray-300' : 'text-gray-500')}
        >
          <X size={10} />
        </button>
      )}
    </span>
  );
}

/**
 * Lärarens timmar per vecka som en stapel: grått för fasta pass i arkivet och
 * svart för temat, skalad mot den som har mest. Avviker läraren mycket från
 * snittet står skillnaden efter. Uppdelningen står i verktygstipset.
 */
function HourBar({ fixedMinutes, temaMinutes, max, avg, fixed, inverted }: {
  fixedMinutes: number;
  temaMinutes: number;
  max: number;
  avg: number;
  fixed?: FixedHours;
  inverted: boolean;
}) {
  const total = fixedMinutes + temaMinutes;
  const diff = total - avg;
  const breakdown = [
    ...(fixed?.parts ?? []).map(part => `${part.label} ${formatHours(part.minutes)}`),
    `tema ${formatHours(temaMinutes)}`,
  ].join(' + ');
  return (
    <span
      className="flex items-center gap-1.5"
      title={`${breakdown} = ${formatHours(total)} per vecka. Temat räknas i klasspass: en satt lärare får hela lektionen, annars delas lagets klasser på dem som kan den dagen.`}
    >
      <span className={cn('flex h-2.5 w-24 overflow-hidden rounded-sm border-[1.5px]', inverted ? 'border-white' : 'border-black')} aria-hidden>
        <span className="h-full bg-gray-400" style={{ width: `${(fixedMinutes / max) * 100}%` }} />
        <span className={cn('h-full', inverted ? 'bg-white' : 'bg-black')} style={{ width: `${(temaMinutes / max) * 100}%` }} />
      </span>
      <span className="w-11 text-right font-mono text-xs tabular-nums">{formatHours(total)}</span>
      {Math.abs(diff) >= DEVIATION_MINUTES && (
        <span
          className={cn(
            'rounded border-[1.5px] px-1 text-[11px] font-bold',
            diff > 0 ? 'border-blue-900 bg-blue-100 text-blue-950' : 'border-orange-800 bg-orange-100 text-orange-900'
          )}
          title={`${formatHours(Math.abs(diff))} ${diff > 0 ? 'över' : 'under'} snittet`}
        >
          {diff > 0 ? '+' : '−'}{formatHours(Math.abs(diff))}
        </span>
      )}
    </span>
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
        className="flex items-center gap-2 border-b-2 border-black px-3 py-2"
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
        {members.length === 0 && <span className="text-xs text-gray-500">Dra lärare hit.</span>}
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
        <div
          className="border-t border-gray-200 px-3 py-1.5 text-xs text-gray-700"
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
