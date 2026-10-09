'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { v4 as uuidv4 } from 'uuid';
import { CopyPlus, DoorOpen, Download, Redo2, RotateCcw, Trash2, Undo2, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FeatureNavigation } from '@/components/FeatureNavigation';
import { LabBoard } from '@/components/lesson-lab/LabBoard';
import { CommitInput } from '@/components/lesson-lab/LabInputs';
import { PlanLoading, PlanNotices, PlanSaveStatus } from '@/components/lesson-lab/LabPlans';
import { LabOverview } from '@/components/lesson-lab/LabOverview';
import { LabSidebar } from '@/components/lesson-lab/LabSidebar';
import { LAB_SEED } from '@/config/lessonLabSeed';
import { cn } from '@/lib/utils';
import { useLabArchive } from '@/hooks/useLabArchive';
import { readStored, useLessonLabState, writeStored } from '@/hooks/useLessonLabState';
import type { LabLesson } from '@/types/lessonLab';
import { downloadBlob } from '@/utils/download';
import { labStateFromFile } from '@/utils/labExport';
import { planFileName } from '@/utils/labPlans';
import {
  labWarnings,
  lessonsForView,
  TEMPLATE_VIEW,
  weekFromTemplate,
  withLessons,
} from '@/utils/lessonLab';
import '@/styles/schedule-theme.css';

/**
 * Arbetslags detaljplan: allt som den enkla vyn lämnar därhän, som lärare
 * per klass, områden, tider, egna veckor, varningar och summeringar.
 *
 * Utgångsläget är arbetslagets tavla (se `lessonLabSeed`). Sidan visar det
 * upplägg som är öppet i den enkla vyn och sparar automatiskt. Ett upplägg kan
 * också sparas som JSON-fil, och en fil öppnas som ett nytt upplägg. Inget
 * skrivs till schemaplaneraren eller terminsplaneraren.
 *
 * Sidan är olistad och nås bara via direktlänken. Den är inte klar för
 * kollegorna än, så ingen knapp i den enkla vyn leder hit.
 */

const VIEW_KEY = 'lessonLab.view.v1';

export default function LessonLabDetail() {
  const lab = useLessonLabState();
  const { state, loaded, commit, undo, redo, canUndo, canRedo } = lab;
  // Arkivet som mallen byggdes från: fasta pass gör lärare upptagna.
  const source = useLabArchive(state, loaded);
  const [viewId, setViewId] = useState<string>(TEMPLATE_VIEW);
  const [focusTeacherId, setFocusTeacherId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setViewId(readStored(VIEW_KEY, raw => (typeof raw === 'string' ? raw : TEMPLATE_VIEW), TEMPLATE_VIEW));
  }, []);
  useEffect(() => { if (loaded) writeStored(VIEW_KEY, viewId); }, [loaded, viewId]);

  // En vecka som tagits bort (eller ett gammalt id i lagringen) visar mallen.
  const activeView = viewId === TEMPLATE_VIEW || state.weeks.some(w => w.id === viewId) ? viewId : TEMPLATE_VIEW;
  const activeWeek = state.weeks.find(w => w.id === activeView) ?? null;
  const lessons = lessonsForView(state, activeView);
  const warnings = useMemo(() => labWarnings(state, lessons, source.busy), [state, lessons, source.busy]);

  const commitLessons = useCallback((change: (current: LabLesson[]) => LabLesson[]) => {
    commit(current => withLessons(current, activeView, change(lessonsForView(current, activeView))));
  }, [commit, activeView]);

  // Ett markerat namn som inte längre finns ska inte dimma hela veckan.
  const focus = focusTeacherId && state.teachers.some(t => t.id === focusTeacherId && !t.resource) ? focusTeacherId : null;

  // --- Veckor ---

  const addWeek = () => {
    const id = uuidv4();
    commit(current => ({
      ...current,
      weeks: [...current.weeks, weekFromTemplate(current, id, `Vecka ${current.weeks.length + 1}`)],
    }));
    setViewId(id);
  };

  const resetWeekFromTemplate = () => {
    if (!activeWeek) return;
    commit(current => ({
      ...current,
      weeks: current.weeks.map(w => (w.id === activeWeek.id ? weekFromTemplate(current, w.id, w.label) : w)),
    }));
    setNotice(`${activeWeek.label} är nu en kopia av mallen igen. Ångra med Ctrl+Z.`);
  };

  const deleteWeek = () => {
    if (!activeWeek) return;
    commit(current => ({ ...current, weeks: current.weeks.filter(w => w.id !== activeWeek.id) }));
    setViewId(TEMPLATE_VIEW);
    setNotice(`${activeWeek.label} är borttagen. Ångra med Ctrl+Z.`);
  };

  // --- Fil ---

  const exportFile = () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    downloadBlob(blob, planFileName(lab.activePlan?.name ?? ''));
  };

  const importFile = async (file: File) => {
    try {
      // Ett rent läge eller en AI-export, t.ex. ett alternativ från en språkmodell.
      const parsed = labStateFromFile(JSON.parse(await file.text()));
      if (!parsed) {
        setNotice(`${file.name} är ingen fil från Arbetslag.`);
        return;
      }
      // Filen blir ett nytt upplägg; det öppna skrivs inte över.
      await lab.createPlan(file.name.replace(/\.json$/i, ''), parsed);
      setViewId(TEMPLATE_VIEW);
      setNotice(`Läste in ${file.name} som ett nytt upplägg.`);
    } catch {
      setNotice(`Kunde inte läsa ${file.name}. Är det en JSON-fil?`);
    }
  };

  const resetToBoard = () => {
    commit(() => LAB_SEED);
    setViewId(TEMPLATE_VIEW);
    setNotice('Labbet är återställt till tavlan. Ångra med Ctrl+Z.');
  };

  return (
    <div className="sp-root">
      <div className="ui-backdrop fixed inset-0 z-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/bakgrund59.png" alt="" className="h-full w-full object-cover" />
      </div>

      <div className="relative z-10 pb-20">
        <div className="sp-toolbar mb-6 flex flex-col items-start gap-4 p-4 lg:flex-row lg:items-center">
          <FeatureNavigation />
          <p className="max-w-xs text-xs text-gray-600 kron:text-ui-muted">
            {lab.activePlan
              ? <>Upplägg: <strong className="text-black">{lab.activePlan.name}</strong>. Byt upplägg i Arbetslag.</>
              : 'Lärare, arbetslag och fasta lektioner.'}
          </p>

          <div className="flex flex-wrap items-center gap-2 lg:ml-auto">
            <PlanSaveStatus lab={lab} />
            <Button variant="neutral" size="icon" className="sp-btn" onClick={undo} disabled={!canUndo} title="Ångra (Ctrl+Z)" aria-label="Ångra">
              <Undo2 size={16} />
            </Button>
            <Button variant="neutral" size="icon" className="sp-btn" onClick={redo} disabled={!canRedo} title="Gör om (Ctrl+Shift+Z)" aria-label="Gör om">
              <Redo2 size={16} />
            </Button>
            <Button variant="neutral" className="sp-btn" onClick={exportFile} title="Spara upplägget som en fil, t.ex. för att dela">
              <Download size={16} className="mr-2" /> Spara fil
            </Button>
            <Button variant="neutral" className="sp-btn" onClick={() => fileInput.current?.click()} disabled={lab.busy} title="Läs in en fil från Arbetslag som ett nytt upplägg">
              <Upload size={16} className="mr-2" /> Öppna fil
            </Button>
            <input
              ref={fileInput}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={event => {
                const file = event.target.files?.[0];
                event.target.value = '';
                if (file) void importFile(file);
              }}
            />
            <Button variant="neutral" className="sp-btn" onClick={resetToBoard} title="Börja om från tavlan (går att ångra)">
              <RotateCcw size={16} className="mr-2" /> Tavlan
            </Button>
            <Button asChild variant="neutral" className="sp-btn bg-amber-100 hover:bg-amber-200 kron:bg-ui-paper kron:hover:bg-ui-surface-3">
              <Link href="/features/arbetslag" title="Tillbaka till den enkla vyn">
                <DoorOpen size={16} className="mr-2" /> Arbetslag
              </Link>
            </Button>
          </div>
        </div>

        <PlanNotices lab={lab} />

        {notice && (
          <div className="sp-toast mb-4 flex items-center justify-between gap-4 bg-amber-50 px-4 py-2 text-sm" role="status">
            <span>{notice}</span>
            <button type="button" className="text-xs font-semibold underline" onClick={() => setNotice(null)}>Stäng</button>
          </div>
        )}

        {!loaded ? <PlanLoading lab={lab} /> : (
          <div className="flex flex-col gap-6 2xl:flex-row 2xl:items-start">
            <div className="shrink-0 2xl:w-[380px]">
              <LabSidebar
                state={state}
                commit={commit}
                focusTeacherId={focus}
                onFocusTeacher={setFocusTeacherId}
                onNotice={setNotice}
              />
            </div>

            <div className="grid min-w-0 flex-1 gap-6">
              <div className="sp-card">
                <div className="flex flex-wrap items-center gap-2 border-b-frame border-ui-line px-4 py-3">
                  <div role="tablist" aria-label="Vecka" className="flex flex-wrap gap-1.5">
                    <WeekTab active={activeView === TEMPLATE_VIEW} onClick={() => setViewId(TEMPLATE_VIEW)}>Veckomall</WeekTab>
                    {state.weeks.map(week => (
                      <WeekTab key={week.id} active={activeView === week.id} onClick={() => setViewId(week.id)}>{week.label}</WeekTab>
                    ))}
                  </div>
                  <button type="button" onClick={addWeek} className="flex items-center gap-1 text-xs font-semibold underline" title="Ny vecka som kopia av mallen">
                    <CopyPlus size={14} /> Ny vecka
                  </button>
                  {focus && (
                    <button type="button" onClick={() => setFocusTeacherId(null)} className="ml-auto rounded-full border-frame border-ui-line bg-amber-100 px-2 py-0.5 text-xs font-bold">
                      Markerad: {state.teachers.find(t => t.id === focus)?.name} ✕
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-3 px-4 py-2 text-xs text-gray-600 kron:text-ui-muted">
                  {activeWeek ? (
                    <>
                      <CommitInput
                        value={activeWeek.label}
                        ariaLabel="Veckans namn"
                        className="w-40 text-sm font-bold text-black"
                        onCommit={label => commit(current => ({ ...current, weeks: current.weeks.map(w => (w.id === activeWeek.id ? { ...w, label } : w)) }))}
                      />
                      <span>Egen vecka. Ändringar här påverkar inte mallen.</span>
                      <button type="button" onClick={resetWeekFromTemplate} className="flex items-center gap-1 font-semibold underline">
                        <RotateCcw size={12} /> Kopiera mallen igen
                      </button>
                      <button type="button" onClick={deleteWeek} className="flex items-center gap-1 font-semibold text-rose-700 kron:text-ui-danger underline">
                        <Trash2 size={12} /> Ta bort veckan
                      </button>
                    </>
                  ) : (
                    <span>
                      Mallen gäller varje vecka. Gör en egen vecka med &quot;Ny vecka&quot; för att pröva något annat, till exempel en rotation.
                    </span>
                  )}
                </div>
              </div>

              <LabBoard
                state={state}
                lessons={lessons}
                warnings={warnings}
                busy={source.busy}
                commitLessons={commitLessons}
                focusTeacherId={focus}
                onFocusTeacher={setFocusTeacherId}
              />

              <LabOverview
                state={state}
                lessons={lessons}
                warnings={warnings}
                fixed={source.fixed}
                focusTeacherId={focus}
                onFocusTeacher={setFocusTeacherId}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function WeekTab({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn('rounded border-frame border-ui-line px-3 py-1 text-sm font-bold', active ? 'bg-black text-white' : 'bg-ui-paper text-black')}
    >
      {children}
    </button>
  );
}
