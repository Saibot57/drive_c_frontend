'use client';

import { useCallback, useEffect, useState } from 'react';
import { CalendarDays, ChevronLeft, Loader2, X } from 'lucide-react';
import { plannerService } from '@/services/plannerService';
import type { PlannerActivity } from '@/types/schedule';
import { groupActivitiesByDay, sortDays } from '../utils/scheduleDayImport';

export interface ScheduleSource {
  /** null = det arbetande schemat. */
  archiveName: string | null;
  label: string;
}

interface ScheduleImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (activities: PlannerActivity[], days: string[], source: ScheduleSource) => void;
}

type Step =
  | { status: 'sources'; archives: string[] }
  | { status: 'loading-sources' }
  | { status: 'loading-days'; source: ScheduleSource }
  | { status: 'days'; source: ScheduleSource; activities: PlannerActivity[]; counts: Map<string, number> }
  | { status: 'error'; message: string };

const WORKING_SCHEDULE: ScheduleSource = {
  archiveName: null,
  label: 'Nuvarande arbetsschema',
};

/**
 * Hämta in dagar ur schemaplaneraren.
 *
 * Två steg: källa först, sedan dagar. Arkiven ligger överst med flit — ett
 * arkiv är en version man bestämt sig för, medan arbetsschemat är en enda
 * föränderlig plats som kan se annorlunda ut i morgon. Antecknar man kring en
 * dag resonerar man om en bestämd version, så arbetsschemat är ett medvetet
 * val och inte förvalet.
 */
export default function ScheduleImportModal({ isOpen, onClose, onConfirm }: ScheduleImportModalProps) {
  const [step, setStep] = useState<Step>({ status: 'loading-sources' });
  const [selectedDays, setSelectedDays] = useState<Set<string>>(new Set());

  const loadSources = useCallback(async () => {
    setStep({ status: 'loading-sources' });
    try {
      setStep({ status: 'sources', archives: await plannerService.getPlannerArchiveNames() });
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
      const activities = source.archiveName === null
        ? await plannerService.getPlannerActivities()
        : await plannerService.getPlannerArchive(source.archiveName);

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
    <div className="ws-overlay-backdrop" onClick={onClose}>
      <div className="ws-dialog ws-dialog--sm" onClick={(e) => e.stopPropagation()}>
        <div className="ws-dialog__header">
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
            <>
              <div className="ws-sidebar-header">Arkiv</div>
              {step.archives.length === 0 ? (
                <p className="ws-dialog__empty">Du har inga arkiverade scheman.</p>
              ) : (
                step.archives.map((name) => (
                  <button
                    key={name}
                    className="ws-surface-option"
                    onClick={() => void pickSource({ archiveName: name, label: name })}
                  >
                    {name}
                  </button>
                ))
              )}
              <div className="ws-divider" />
              <button
                className="ws-surface-option"
                onClick={() => void pickSource(WORKING_SCHEDULE)}
              >
                {WORKING_SCHEDULE.label}
              </button>
            </>
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
      </div>
    </div>
  );
}
