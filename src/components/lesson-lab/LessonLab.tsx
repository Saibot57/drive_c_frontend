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
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { ChevronDown, Download, Loader2, Redo2, RefreshCw, Undo2, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FeatureNavigation } from '@/components/FeatureNavigation';
import { LabExportMenu } from '@/components/lesson-lab/LabExportMenu';
import { LabPlansPanel, PlanLoading, PlanNotices, PlanSaveStatus } from '@/components/lesson-lab/LabPlans';
import { StatusBar } from '@/components/lesson-lab/LabStatus';
import { useLabArchive } from '@/hooks/useLabArchive';
import { readStored, useLessonLabState, writeStored } from '@/hooks/useLessonLabState';
import { usePersistentState } from '@/hooks/usePersistentState';
import { COLOR_TRIGGERS_KEY, ROOM_TRIGGERS_KEY } from '@/config/plannerConstants';
import { cn } from '@/lib/utils';
import { downloadBlob } from '@/utils/download';
import { buildLabExport, labExportFileName } from '@/utils/labExport';
import {
  exportInputsFor,
  exportTargets,
  exportTitle,
  isAllSubject,
  LabExportSubject,
  lessonsWithoutPass,
  pagesFor,
} from '@/utils/labScheduleExport';
import { createColorResolver, sanitizeColorTriggers } from '@/utils/colorTriggers';
import { createRoomResolver, sanitizeRoomTriggers } from '@/utils/roomTriggers';
import type { ExportFormat } from '@/utils/schedulePdf';
import type { PageMode } from '@/utils/schedulePdf/theme';
import type { ColorTriggerRule, RoomTriggerRule } from '@/types/schedule';
import { isOwnPlan } from '@/utils/labPlans';
import { isBaseSchedule, optionsWithCurrent } from '@/utils/scheduleKind';
import type { LabDay, LabLesson, LabState } from '@/types/lessonLab';
import {
  assignTeam,
  LAB_COLORS,
  LAB_DAYS,
  labWarnings,
  mergeLesson,
  nextTeamNumber,
  reassignTeam,
  splitLesson,
  teacherLoads,
  teacherTeachingMinutes,
} from '@/utils/lessonLab';
import { lessonsFromArchive } from '@/utils/lessonLabArchive';
import {
  applyTeacherOrder,
  moveTeacher,
  parseTeacherOrder,
  planStatus,
  StaffingFix,
  staffingFixes,
  timelineFor,
} from '@/utils/lessonLabView';
import {
  DragData,
  SCHEDULE_DROP,
  NEW_TEAM_DROP,
  DAY_DROP_PREFIX,
  lessonElementId,
  TEACHER_ORDER_KEY,
  TEACHER_SLOT_PREFIX,
  ViewContext,
} from '@/components/lesson-lab/labShared';
import { LabDragPreview } from '@/components/lesson-lab/LabDragPreview';
import { LabSchedule } from '@/components/lesson-lab/LabSchedule';
import { LabTeams } from '@/components/lesson-lab/LabTeams';
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

/** Om pass utan marginal är nedtonade, per webbläsare. */
const QUIET_TIGHT_KEY = 'lessonLab.quietTight.v1';

const NO_COLOR_TRIGGERS: ColorTriggerRule[] = [];
const NO_ROOM_TRIGGERS: RoomTriggerRule[] = [];

type ExportNotice = { text: string; tone: 'warning' | 'error' };

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
  const archiveChoices = optionsWithCurrent(source.archives ?? [], isBaseSchedule, state.archiveId);
  const [dragging, setDragging] = useState<DragData | null>(null);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [plansOpen, setPlansOpen] = useState(false);
  const [issuesOpen, setIssuesOpen] = useState(false);
  const [flashId, setFlashId] = useState<string | null>(null);
  const [quietTight, setQuietTightState] = useState(false);
  useEffect(() => { setQuietTightState(readStored(QUIET_TIGHT_KEY, raw => raw === true, false)); }, []);
  const setQuietTight = (quiet: boolean) => {
    setQuietTightState(quiet);
    writeStored(QUIET_TIGHT_KEY, quiet);
  };
  const [teacherOrder, setTeacherOrderState] = useState<string[]>([]);
  useEffect(() => { setTeacherOrderState(readStored(TEACHER_ORDER_KEY, parseTeacherOrder, [])); }, []);
  const setTeacherOrder = (order: string[]) => {
    setTeacherOrderState(order);
    writeStored(TEACHER_ORDER_KEY, order);
  };
  const flashTimer = useRef<number | null>(null);
  useEffect(() => () => { if (flashTimer.current) window.clearTimeout(flashTimer.current); }, []);

  // Planerarens färg- och salsregler, ur webbläsarens lagring, så att exporten
  // ser ut som planerarens. En annan dator har sina egna regler, eller inga.
  const [colorTriggers] = usePersistentState(COLOR_TRIGGERS_KEY, sanitizeColorTriggers, NO_COLOR_TRIGGERS);
  const [roomTriggers] = usePersistentState(ROOM_TRIGGERS_KEY, sanitizeRoomTriggers, NO_ROOM_TRIGGERS);
  const [exporting, setExporting] = useState(false);
  const [exportNotice, setExportNotice] = useState<ExportNotice | null>(null);

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

  const exportTargetList = useMemo(
    () => (source.activities ? exportTargets(state, source.activities) : null),
    [state, source.activities]
  );
  const exportDisabledReason = !loaded ? 'Upplägget läses in'
    : !state.archiveId ? 'Välj ett basschema först. Exporten ritar basschemats pass.'
    : archiveUnreachable ? 'Basschemat är inte delat med dig, så passen går inte att läsa.'
    : source.status === 'loading' ? 'Schemat läses in'
    : !source.activities ? 'Kunde inte läsa schemat.'
    : null;

  /** Exporten från upplägget: ett lag eller en lärare, eller alla som en PDF. */
  const runScheduleExport = async (subject: LabExportSubject, format: ExportFormat, pageMode: PageMode) => {
    const activities = source.activities;
    if (!activities) return;
    const { label, pages, skipped } = pagesFor(state, activities, subject);
    if (pages.length === 0) {
      setExportNotice({ text: 'Det finns inga pass att exportera.', tone: 'warning' });
      return;
    }
    const inputs = exportInputsFor(pages, {
      archiveName: source.archiveName,
      activities,
      resolveColor: createColorResolver(colorTriggers),
      resolveRoom: createRoomResolver(roomTriggers),
      pageMode,
    });
    setExporting(true);
    setExportNotice(null);
    try {
      // jsPDF och typsnitten laddas först när någon exporterar, inte med sidan.
      const { exportSchedule, exportScheduleBook } = await import('@/utils/schedulePdf');
      const outcome = isAllSubject(subject)
        ? exportScheduleBook(inputs, { archiveName: exportTitle(source.archiveName, label), pageMode })
        : await exportSchedule(inputs[0], format);

      const parts: string[] = [];
      if (skipped.length > 0) parts.push(`Hoppade över ${skipped.join(', ')}, som saknar pass.`);
      const missing = lessonsWithoutPass(state, activities);
      if (missing > 0) {
        parts.push(`${missing} ${missing === 1 ? 'lektion' : 'lektioner'} i upplägget saknar pass i schemat och kom inte med. "Läs om schemat" bredvid Basschema rättar det.`);
      }
      if (outcome.truncatedInstanceIds.length > 0) {
        const byId = new Map(activities.map(a => [a.id, a]));
        // Två namn räcker för att hitta rätt pass, som i planerarens notis.
        const named = outcome.truncatedInstanceIds.slice(0, 2)
          .flatMap(id => {
            const a = byId.get(id);
            return a ? [`${a.title} (${a.day} ${a.startTime})`] : [];
          })
          .join(', ');
        const count = outcome.truncatedInstanceIds.length;
        const rest = count - Math.min(count, 2);
        parts.push(`Texten rymdes inte i ${count} pass och slutar med "…" i filen: ${named}${rest > 0 ? ` +${rest} till` : ''}.`);
      }
      if (outcome.isLowScale) parts.push('Schemat fick krympas för att rymmas på en sida. Prova A3 eller digitalt läge.');
      if (parts.length > 0) setExportNotice({ text: parts.join(' '), tone: 'warning' });
    } catch (error) {
      console.error('Arbetslag: exporten misslyckades', error);
      setExportNotice({ text: 'Exporten misslyckades. Inget ändrades.', tone: 'error' });
    } finally {
      setExporting(false);
    }
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
  // Tiden i förhållande till tjänstgöringsgraden: snitt per heltid och vad var och en borde ha.
  const spread = useMemo(() => teacherLoads(state.teachers, totals), [state.teachers, totals]);
  const balance = useMemo(
    () => new Map(Array.from(spread?.loads ?? [], ([id, load]) => [id, load.diff])),
    [spread]
  );

  const status = useMemo(
    () => planStatus(state, lessons, labWarnings(state, lessons, source.busy), source.busy),
    [state, lessons, source.busy]
  );
  const fixes = useMemo(() => staffingFixes(state, lessons, balance, source.busy), [state, lessons, balance, source.busy]);
  // Lärarraden: den egna ordningen, annars mest över sitt förväntade först.
  const rowIds = useMemo(() => {
    const byBalance = state.teachers
      .filter(t => !t.resource)
      .sort((a, b) => (balance.get(b.id) ?? 0) - (balance.get(a.id) ?? 0) || a.name.localeCompare(b.name, 'sv'));
    return applyTeacherOrder(byBalance, teacherOrder).map(t => t.id);
  }, [state.teachers, balance, teacherOrder]);
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

    // En lärare släppt på en annan i lärarraden byter plats med den.
    if (overId.startsWith(TEACHER_SLOT_PREFIX)) {
      if (data.kind !== 'teacher') return;
      const moved = moveTeacher(rowIds, data.teacherId, overId.slice(TEACHER_SLOT_PREFIX.length));
      if (moved !== rowIds) setTeacherOrder(moved);
      return;
    }

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

  const groupLabel = 'text-[11px] font-black uppercase tracking-[0.12em] text-gray-600 kron:text-ui-muted';

  return (
    <div className="sp-root">
      <div className="ui-backdrop fixed inset-0 z-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/bakgrund59.png" alt="" className="h-full w-full object-cover" />
      </div>

      <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setDragging(null)}>
        {/* Panelen står bredvid allt annat, verktygsraden också, som i schemaplaneraren. */}
        <div className="relative z-10 flex flex-col gap-6 pb-24 lg:flex-row">
          <div className="min-w-0 flex-1">
            <div className="sp-toolbar mb-6 flex flex-col items-start gap-3 p-4 lg:flex-row lg:flex-wrap lg:items-center">
              <FeatureNavigation />

              {/* Upplägget är det som sparas. Namnet öppnar panelen med de andra. */}
              <div className="flex items-center gap-2 rounded-lg border-frame border-ui-line bg-amber-50 py-0.5 pl-3 pr-3">
                <span className={groupLabel}>Upplägg</span>
                <button
                  type="button"
                  onClick={() => setPlansOpen(open => !open)}
                  aria-expanded={plansOpen}
                  title={plansOpen ? 'Dölj sparade upplägg' : 'Visa sparade upplägg'}
                  className="sp-input flex h-8 max-w-[14rem] items-center gap-2 rounded-md bg-ui-paper px-3 text-sm font-bold"
                >
                  <span className="truncate">{lab.activePlan?.name ?? 'Inget upplägg'}</span>
                  <ChevronDown size={14} className="shrink-0" />
                </button>
                <PlanSaveStatus lab={lab} />
              </div>

              {/* Basschemat är det upplägget bygger på: tiderna och de fasta
                  passen. Listan visar bara basscheman, men om ett schema finns
                  avgörs av hela listan (source.archives). Annars hade ett
                  upplägg byggt på ett veckoschema sett ut att peka på ett
                  borttaget schema. */}
              <div className="flex items-center gap-2">
                <span className={groupLabel}>Basschema</span>
                <select
                  className="sp-input h-8 max-w-[10rem] rounded-md bg-ui-paper px-3 text-sm font-semibold"
                  value={state.archiveId ?? ''}
                  onChange={event => chooseArchive(event.target.value)}
                  disabled={source.status === 'loading'}
                  aria-label="Basschema som grund"
                  title="Basschemats temapass blir rutorna, och övriga pass räknas som lärarnas fasta timmar"
                >
                  <option value="">Tavlan (inget schema)</option>
                  {state.archiveId && !source.archives?.some(a => a.id === state.archiveId) && (
                    <option value={state.archiveId}>
                      {!source.archives ? 'Laddar scheman…' : archiveUnreachable ? 'Inte delat med dig' : 'Schemat finns inte längre'}
                    </option>
                  )}
                  {archiveChoices.outside && (
                    <option value={archiveChoices.outside.id}>{archiveChoices.outside.name} (veckoschema)</option>
                  )}
                  {archiveChoices.options.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                  {source.archives && archiveChoices.options.length === 0 && (
                    <option disabled value="__none">Inga basscheman ännu. Gör om ett schema i Schema.</option>
                  )}
                </select>
                {state.archiveId && (
                  <Button
                    variant="neutral"
                    size="icon"
                    className="sp-btn h-8 w-8"
                    onClick={() => void buildFromArchive(state.archiveId as string)}
                    disabled={source.status === 'loading'}
                    title="Läs om schemat. Lektioner vid samma tid behåller sina arbetslag."
                    aria-label="Läs om schemat. Lektioner vid samma tid behåller sina arbetslag."
                  >
                    {source.status === 'loading' ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
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
                <LabExportMenu
                  targets={exportTargetList}
                  disabledReason={exportDisabledReason}
                  busy={exporting}
                  onExport={(subject, format, pageMode) => void runScheduleExport(subject, format, pageMode)}
                />
                <Button
                  variant="neutral"
                  className="sp-btn gap-1.5 px-3"
                  onClick={downloadForAi}
                  disabled={!loaded || source.status === 'loading'}
                  title="Ladda ner upplägget som JSON, med regler, timmar och varningar."
                >
                  <Download size={15} /> JSON
                </Button>
              </div>
            </div>

            <PlanNotices lab={lab} />

            {exportNotice && (
              <div
                className={cn(
                  'sp-toast mb-4 flex flex-wrap items-center justify-between gap-2 px-4 py-2 text-sm',
                  exportNotice.tone === 'error' ? 'bg-rose-50' : 'bg-amber-50'
                )}
                role={exportNotice.tone === 'error' ? 'alert' : 'status'}
              >
                <span>{exportNotice.text}</span>
                <button type="button" className="text-xs font-semibold underline" onClick={() => setExportNotice(null)}>Stäng</button>
              </div>
            )}

            {!loaded ? <PlanLoading lab={lab} /> : (
              <div>
                <StatusBar
                  state={state}
                  status={status}
                  spread={spread}
                  fixes={fixes}
                  open={issuesOpen}
                  onOpenChange={setIssuesOpen}
                  quietTight={quietTight}
                  onQuietTightChange={setQuietTight}
                  onShowLesson={showLesson}
                  onApplyFix={applyFix}
                />
                {archiveUnreachable && (
                  <div className="sp-toast mb-4 bg-amber-50 px-4 py-2 text-sm" role="status">
                    Upplägget bygger på ett schema i schemaplaneraren som inte är delat med dig, så lärarnas fasta
                    timmar saknas. Be {lab.activePlan?.ownerUsername ?? 'den som äger upplägget'} dela schemat med dig.
                  </div>
                )}
                {source.status === 'error' && !archiveUnreachable && (
                  <div className="sp-toast mb-4 flex items-center justify-between gap-4 bg-rose-50 px-4 py-2 text-sm" role="status">
                    <span>Kunde inte läsa schemat{source.archiveName ? ` ${source.archiveName}` : ''}. Rutorna är som förut, men de fasta timmarna saknas.</span>
                    {state.archiveId && (
                      <button type="button" className="text-xs font-semibold underline" onClick={() => void source.fetchActivities(state.archiveId as string)}>
                        Försök igen
                      </button>
                    )}
                  </div>
                )}
                {source.unknownNames.length > 0 && (
                  <div className="sp-toast mb-4 flex flex-wrap items-center justify-between gap-2 bg-amber-50 px-4 py-2 text-sm" role="status">
                    <span>I schemat finns också {source.unknownNames.join(', ')}, som inte är med i labbet.</span>
                    <button type="button" className="flex items-center gap-1 text-xs font-semibold underline" onClick={addUnknownTeachers}>
                      <UserPlus size={14} /> Lägg till
                    </button>
                  </div>
                )}

                <LabSchedule
                  view={view}
                  lessons={lessons}
                  timeline={timeline}
                  onSetDay={setDay}
                  onSplit={id => updateLesson(id, l => splitLesson(l, state.classes))}
                  onMerge={id => updateLesson(id, l => mergeLesson(l, state.classes))}
                />

                <LabTeams
                  view={view}
                  lessons={lessons}
                  fixed={source.fixed}
                  tema={tema}
                  spread={spread}
                  rowIds={rowIds}
                  customOrder={teacherOrder.length > 0}
                  onResetOrder={() => setTeacherOrder([])}
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
          {dragging && <LabDragPreview data={dragging} state={state} />}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
