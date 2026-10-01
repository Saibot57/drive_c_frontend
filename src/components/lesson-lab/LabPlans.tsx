'use client';

import React, { useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Cloud, CloudOff, Copy, Layers, Loader2, Pencil, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { LessonLabState } from '@/hooks/useLessonLabState';
import { cn } from '@/lib/utils';
import type { LabPlanSummary } from '@/types/lessonLab';
import { changedLabel, MAX_PLANS } from '@/utils/labPlans';

/**
 * Arbetslags sparade upplägg: panelen till höger i den enkla vyn, sparstatusen
 * i verktygsraden och meddelandena om fel och konflikter. Förebilden är
 * "Sparade veckor" i schemaplaneraren.
 */

type Lab = Pick<LessonLabState,
  | 'plans' | 'activePlan' | 'busy' | 'openPlan' | 'createPlan' | 'duplicatePlan' | 'renamePlan' | 'deletePlan'
  | 'saveStatus' | 'saveError' | 'retrySave' | 'reloadActive' | 'planError' | 'dismissPlanError' | 'loadError' | 'retryLoad'>;

/** "Sparat", "Ändrat", "Sparar…" eller "Ej sparat", som i terminsplaneraren. */
export function PlanSaveStatus({ lab }: { lab: Pick<Lab, 'saveStatus' | 'saveError' | 'activePlan'> }) {
  const { saveStatus, saveError } = lab;
  if (!lab.activePlan) return null;
  return (
    <span className="flex items-center gap-1.5 text-xs font-semibold text-gray-500" title={saveError ?? undefined} role="status">
      {saveStatus === 'saving' && <Loader2 size={14} className="animate-spin" />}
      {(saveStatus === 'error' || saveStatus === 'conflict') && <CloudOff size={14} className="text-rose-600" />}
      {(saveStatus === 'saved' || saveStatus === 'pending') && <Cloud size={14} />}
      {saveStatus === 'saving' ? 'Sparar…'
        : saveStatus === 'error' || saveStatus === 'conflict' ? 'Ej sparat'
          : saveStatus === 'pending' ? 'Ändrat' : 'Sparat'}
    </span>
  );
}

/** Konflikt, sparfel och fel från panelen. Står under verktygsraden. */
export function PlanNotices({ lab }: { lab: Lab }) {
  return (
    <>
      {lab.saveStatus === 'conflict' && (
        <div className="sp-toast mb-4 flex flex-wrap items-center justify-between gap-2 bg-rose-50 px-4 py-2 text-sm" role="alert">
          <span>Upplägget har ändrats någon annanstans. Ladda om? Det som ändrats här sedan dess sparas inte.</span>
          <button type="button" className="flex items-center gap-1 text-xs font-semibold underline" onClick={() => void lab.reloadActive()} disabled={lab.busy}>
            <RefreshCw size={12} /> Ladda om
          </button>
        </div>
      )}
      {lab.saveStatus === 'error' && (
        <div className="sp-toast mb-4 flex flex-wrap items-center justify-between gap-2 bg-rose-50 px-4 py-2 text-sm" role="alert">
          <span>Kunde inte spara{lab.saveError ? `: ${lab.saveError}` : ''}. Ändringarna finns kvar här.</span>
          <button type="button" className="text-xs font-semibold underline" onClick={lab.retrySave}>Försök igen</button>
        </div>
      )}
      {lab.planError && (
        <div className="sp-toast mb-4 flex flex-wrap items-center justify-between gap-2 bg-amber-50 px-4 py-2 text-sm" role="status">
          <span>{lab.planError}</span>
          <button type="button" className="text-xs font-semibold underline" onClick={lab.dismissPlanError}>Stäng</button>
        </div>
      )}
    </>
  );
}

/** Innan upplägget har hämtats: laddar, eller ett fel med "Försök igen". */
export function PlanLoading({ lab }: { lab: Pick<Lab, 'loadError' | 'retryLoad'> }) {
  return (
    <div className="sp-card mx-auto mt-10 flex max-w-md flex-col items-center gap-3 p-6 text-center text-sm">
      {lab.loadError ? (
        <>
          <CloudOff size={20} className="text-rose-600" />
          <p>{lab.loadError}</p>
          <Button variant="neutral" className="sp-btn" onClick={lab.retryLoad}>Försök igen</Button>
        </>
      ) : (
        <>
          <Loader2 size={20} className="animate-spin" />
          <p>Hämtar uppläggen…</p>
        </>
      )}
    </div>
  );
}

export function LabPlansPanel({ lab }: { lab: Lab }) {
  // Som "Sparade veckor": alltid hopfälld när sidan öppnas.
  const [collapsed, setCollapsed] = useState(true);
  const toggle = () => setCollapsed(current => !current);

  const full = lab.plans.length >= MAX_PLANS;
  const fullTitle = `Du kan ha högst ${MAX_PLANS} upplägg. Ta bort ett först.`;

  return (
    <aside
      className={cn('flex shrink-0 flex-col transition-all duration-300', collapsed ? 'lg:w-[72px]' : 'lg:w-[320px]')}
      aria-label="Sparade upplägg"
    >
      {/* Lika hög som sidan bredvid, från verktygsraden och nedåt. */}
      <div className={cn('sp-card flex flex-1 flex-col', collapsed ? 'p-2' : 'p-4')}>
        <div className={cn('flex', collapsed ? 'flex-col items-center gap-3' : 'mb-4 items-center justify-between')}>
          <h2 className={cn('flex items-center gap-2 font-bold', collapsed && 'sr-only')}>
            <Layers size={18} /> Sparade upplägg
          </h2>
          <Button
            size="sm"
            variant="neutral"
            onClick={toggle}
            className="sp-btn h-8 w-8 p-0"
            aria-label={collapsed ? 'Visa upplägg' : 'Dölj upplägg'}
            aria-expanded={!collapsed}
          >
            {collapsed ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
          </Button>
          {collapsed && (
            <div className="flex flex-col items-center gap-1 text-xs font-bold text-gray-600" title={`${lab.plans.length} upplägg`}>
              <Layers size={18} />
              {lab.plans.length}
            </div>
          )}
        </div>

        {!collapsed && (
          <div className="flex min-h-0 flex-1 flex-col gap-3">
            <Button
              variant="neutral"
              onClick={() => void lab.createPlan()}
              disabled={lab.busy || full}
              title={full ? fullTitle : 'Nytt upplägg från tavlan'}
              className="sp-btn w-full bg-emerald-100 hover:bg-emerald-200"
            >
              <Plus size={14} className="mr-2" /> Nytt upplägg
            </Button>

            {/* Listan scrollar inuti panelen och gör aldrig sidan högre. */}
            <div className="lg:relative lg:flex-1">
              <ul className="flex max-h-[70vh] flex-col gap-2 overflow-y-auto pr-1 lg:absolute lg:inset-0 lg:max-h-none">
                {lab.plans.map(plan => (
                  <PlanRow
                    key={plan.id}
                    plan={plan}
                    active={plan.id === lab.activePlan?.id}
                    busy={lab.busy}
                    full={full}
                    fullTitle={fullTitle}
                    lab={lab}
                  />
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}

function PlanRow({ plan, active, busy, full, fullTitle, lab }: {
  plan: LabPlanSummary;
  active: boolean;
  busy: boolean;
  full: boolean;
  fullTitle: string;
  lab: Lab;
}) {
  const [mode, setMode] = useState<'view' | 'rename' | 'confirmDelete'>('view');
  const [draft, setDraft] = useState(plan.name);

  // Sant när namnrutan redan är stängd, så att en blur efteråt inte sparar igen.
  const renameDone = useRef(false);

  const startRename = () => { renameDone.current = false; setDraft(plan.name); setMode('rename'); };
  const finishRename = (save: boolean) => {
    if (renameDone.current) return;
    renameDone.current = true;
    setMode('view');
    if (save && draft.trim() && draft.trim() !== plan.name) void lab.renamePlan(plan.id, draft);
  };

  return (
    <li className={cn('sp-archive-card flex flex-col gap-2 p-3', active && '!bg-amber-100')}>
      <div className="flex items-start gap-2">
        {mode === 'rename' ? (
          <input
            type="text"
            value={draft}
            autoFocus
            maxLength={150}
            aria-label="Uppläggets namn"
            onChange={event => setDraft(event.target.value)}
            onBlur={() => finishRename(true)}
            onKeyDown={event => {
              if (event.key === 'Enter') finishRename(true);
              if (event.key === 'Escape') finishRename(false);
            }}
            className="sp-input min-w-0 flex-1 rounded border px-2 py-1 text-sm font-bold"
          />
        ) : (
          <button
            type="button"
            onClick={() => void lab.openPlan(plan.id)}
            disabled={busy}
            aria-current={active ? 'true' : undefined}
            className="flex min-w-0 flex-1 flex-col items-start text-left disabled:cursor-wait"
          >
            <span className="break-words text-sm font-bold leading-tight">
              {plan.name}{active ? ' • aktiv' : ''}
            </span>
            <span className="text-[11px] text-gray-500">{changedLabel(plan.updatedAt)}</span>
          </button>
        )}

        {mode === 'view' && (
          <div className="flex shrink-0 gap-1.5">
            <Button
              size="sm"
              variant="neutral"
              onClick={startRename}
              disabled={busy}
              className="sp-btn h-8 w-8 p-0"
              aria-label={`Byt namn på ${plan.name}`}
              title="Byt namn"
            >
              <Pencil size={14} />
            </Button>
            <Button
              size="sm"
              variant="neutral"
              onClick={() => void lab.duplicatePlan(plan.id)}
              disabled={busy || full}
              className="sp-btn h-8 w-8 bg-indigo-100 p-0 hover:bg-indigo-200"
              aria-label={`Duplicera ${plan.name}`}
              title={full ? fullTitle : 'Duplicera'}
            >
              <Copy size={14} />
            </Button>
            <Button
              size="sm"
              variant="neutral"
              onClick={() => setMode('confirmDelete')}
              disabled={busy}
              className="sp-btn h-8 w-8 bg-rose-100 p-0 text-rose-800 hover:bg-rose-200"
              aria-label={`Ta bort ${plan.name}`}
              title="Ta bort"
            >
              <Trash2 size={14} />
            </Button>
          </div>
        )}
      </div>

      {mode === 'confirmDelete' && (
        <div className="flex items-center justify-between gap-2 rounded border-2 border-rose-300 bg-rose-50 px-2 py-1 text-xs">
          <span className="font-semibold text-rose-800">Ta bort {plan.name}?</span>
          <span className="flex gap-2">
            <button
              type="button"
              className="font-bold text-rose-800 underline"
              onClick={() => { setMode('view'); void lab.deletePlan(plan.id); }}
            >
              Ja, ta bort
            </button>
            <button type="button" className="font-semibold underline" onClick={() => setMode('view')} autoFocus>Nej</button>
          </span>
        </div>
      )}
    </li>
  );
}
