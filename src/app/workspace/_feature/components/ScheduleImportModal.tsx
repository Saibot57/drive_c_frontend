'use client';

import { useCallback, useEffect, useState } from 'react';
import { CalendarDays, ChevronLeft, Loader2, X } from 'lucide-react';
import { plannerService } from '@/services/plannerService';
import type { PlannerActivity, PlannerArchiveSummary } from '@/types/schedule';
import { isBaseSchedule } from '@/utils/scheduleKind';
import WorkspaceModal from './WorkspaceModal';
import {
  groupActivitiesByDay,
  orderScheduleSources,
  scheduleSourceLabel,
  sortDays,
} from '../utils/scheduleDayImport';

export interface ScheduleSource {
  /** Nyckeln. Kortet pekar på schemat med den. */
  archiveId: string;
  /** Namnet vid hämtningen, sparat bredvid id:t. */
  archiveName: string;
  /** Det korten visar, med ägaren för ett delat schema. */
  label: string;
}

interface ScheduleImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (activities: PlannerActivity[], days: string[], source: ScheduleSource) => void;
}

type Step =
  | { status: 'sources'; own: PlannerArchiveSummary[]; shared: PlannerArchiveSummary[] }
  | { status: 'loading-sources' }
  | { status: 'loading-days'; source: ScheduleSource }
  | { status: 'days'; source: ScheduleSource; activities: PlannerActivity[]; counts: Map<string, number> }
  | { status: 'error'; message: string };

/**
 * Hämta in dagar ur schemaplaneraren.
 *
 * Två steg: källa först, sedan dagar. Källan är ett schema du når, eget
 * eller delat med dig, och kortet pekar på det med id
 * (docs/plans/schemadagar-pa-id.md). Arbetsschemat (huvudschemat) fanns här
 * förr som ett eget val, men det används inte längre i planeraren
 * (docs/plans/basscheman.md, 5.4).
 */
export default function ScheduleImportModal({ isOpen, onClose, onConfirm }: ScheduleImportModalProps) {
  const [step, setStep] = useState<Step>({ status: 'loading-sources' });
  const [selectedDays, setSelectedDays] = useState<Set<string>>(new Set());

  const loadSources = useCallback(async () => {
    setStep({ status: 'loading-sources' });
    try {
      const { own, shared } = orderScheduleSources(await plannerService.listArchives());
      setStep({ status: 'sources', own, shared });
    } catch {
      setStep({ status: 'error', message: 'Kunde inte hämta dina scheman.' });
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      setSelectedDays(new Set());
      void loadSources();
    }
  }, [isOpen, loadSources]);

  const pickSource = useCallback(async (source: ScheduleSource) => {
    setStep({ status: 'loading-days', source });
    try {
      const { activities } = await plannerService.getArchiveActivities(source.archiveId);

      const byDay = groupActivitiesByDay(activities);
      const counts = new Map(sortDays(Array.from(byDay.keys())).map((day) => [day, byDay.get(day)!.length]));
      // Dagar med innehåll är förvalda. Att hämta in en tom dag är sällan det
      // man vill, men det går — kryssrutan är kvar.
      setSelectedDays(new Set(Array.from(counts.keys())));
      setStep({ status: 'days', source, activities, counts });
    } catch {
      setStep({ status: 'error', message: 'Kunde inte hämta schemat.' });
    }
  }, []);

  if (!isOpen) return null;

  const toggleDay = (day: string) => {
    setSelectedDays((current) => {
      const next = new Set(current);
      if (next.has(day)) next.delete(day);
      else next.add(day);
      return next;
    });
  };

  return (
    <WorkspaceModal positionKey="ws-schedule-import" onClose={onClose} className="ws-dialog--sm">
      <div className="ws-dialog__header" data-dialog-handle="">
        <div className="ws-dialog__title">
          {step.status === 'days' && (
            <button className="ws-icon-btn" onClick={() => void loadSources()} aria-label="Tillbaka">
              <ChevronLeft size={14} />
            </button>
          )}
          <CalendarDays size={14} />
          {step.status === 'days' ? step.source.label : 'Hämta in schemadagar'}
        </div>
        <button className="ws-icon-btn" onClick={onClose} aria-label="Stäng">
          <X size={16} />
        </button>
      </div>

      <div className="ws-dialog__body">
        {(step.status === 'loading-sources' || step.status === 'loading-days') && (
          <p className="ws-dialog__empty">
            <Loader2 size={14} className="ws-spin" /> Hämtar…
          </p>
        )}

        {step.status === 'error' && <p className="ws-dialog__empty">{step.message}</p>}

        {step.status === 'sources' && (
          step.own.length + step.shared.length === 0 ? (
            <p className="ws-dialog__empty">Du har inga scheman.</p>
          ) : (
            <>
              {step.own.length > 0 && <div className="ws-sidebar-header">Dina scheman</div>}
              {step.own.map((archive) => (
                <SourceOption key={archive.id} archive={archive} onPick={(source) => void pickSource(source)} />
              ))}
              {step.shared.length > 0 && <div className="ws-sidebar-header">Delade med dig</div>}
              {step.shared.map((archive) => (
                <SourceOption key={archive.id} archive={archive} onPick={(source) => void pickSource(source)} />
              ))}
            </>
          )
        )}

        {step.status === 'days' && (
          step.counts.size === 0 ? (
            <p className="ws-dialog__empty">Det här schemat har inga lektioner.</p>
          ) : (
            Array.from(step.counts.entries()).map(([day, count]) => (
              <label key={day} className="ws-day-option">
                <input
                  type="checkbox"
                  checked={selectedDays.has(day)}
                  onChange={() => toggleDay(day)}
                />
                <span className="ws-day-option__name">{day}</span>
                <span className="ws-day-option__count">
                  {count} {count === 1 ? 'lektion' : 'lektioner'}
                </span>
              </label>
            ))
          )
        )}
      </div>

      <div className="ws-dialog__footer">
        <button className="ws-btn" onClick={onClose}>Avbryt</button>
        <button
          className="ws-btn ws-btn--primary"
          disabled={step.status !== 'days' || selectedDays.size === 0}
          onClick={() => {
            if (step.status !== 'days' || selectedDays.size === 0) return;
            onConfirm(step.activities, Array.from(selectedDays), step.source);
            onClose();
          }}
        >
          {selectedDays.size === 1 ? 'Hämta in dagen' : `Hämta in ${selectedDays.size} dagar`}
        </button>
      </div>
    </WorkspaceModal>
  );
}

/** Ett schema i källistan. Sorten och ägaren står till höger, i grått. */
function SourceOption({
  archive,
  onPick,
}: {
  archive: PlannerArchiveSummary;
  onPick: (source: ScheduleSource) => void;
}) {
  const meta = [
    isBaseSchedule(archive) ? 'bas' : null,
    !archive.isOwner && archive.ownerUsername ? `delat av ${archive.ownerUsername}` : null,
  ].filter(Boolean).join(' · ');

  return (
    <button
      className="ws-surface-option"
      onClick={() => onPick({
        archiveId: archive.id,
        archiveName: archive.name,
        label: scheduleSourceLabel(archive),
      })}
    >
      <span className="ws-surface-option__name">{archive.name}</span>
      {meta && <span className="ws-surface-option__meta">{meta}</span>}
    </button>
  );
}
