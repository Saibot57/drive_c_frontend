'use client';

import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { themeWheelService } from '@/services/themeWheelService';
import type { TermWeek } from '@/types/term';
import type { ThemeWheelSummary } from '@/types/themeWheel';
import { isoWeekYear } from '@/utils/dateSv';
import { termWeeksFromWheel } from '@/utils/termPlanner';

export const MIN_TERM_WEEKS = 1;
export const MAX_TERM_WEEKS = 30;

export type TermMeta = {
  name: string;
  startWeek: number;
  startYear: number;
  weekCount: number;
};

// Dialogen portas ut ur .sp-root och når inte dess CSS-variabler, så
// sp-input skulle nolla ramen. Fälten får sin ram direkt i stället.
const selectClassName = 'h-10 w-full rounded-base border-2 border-border bg-white px-3 text-sm';

const isValidMeta = (meta: TermMeta) => (
  meta.name.trim().length > 0
  && meta.startWeek >= 1 && meta.startWeek <= 53
  && meta.startYear >= 1970 && meta.startYear <= 2200
  && meta.weekCount >= MIN_TERM_WEEKS && meta.weekCount <= MAX_TERM_WEEKS
);

const defaultMeta = (): TermMeta => {
  const { week, year } = isoWeekYear(new Date());
  // Höstterminen börjar v.34, vårterminen v.2. Förslaget utgår från den
  // termin som ligger närmast framåt.
  const autumn = week >= 26;
  return {
    name: autumn ? `HT ${year}` : `VT ${year}`,
    startWeek: autumn ? 34 : 2,
    startYear: year,
    weekCount: 20,
  };
};

function MetaFields({ meta, onChange }: { meta: TermMeta; onChange: (meta: TermMeta) => void }) {
  const numberField = (key: 'startWeek' | 'startYear' | 'weekCount', label: string) => (
    <div className="space-y-1">
      <Label htmlFor={`term-${key}`}>{label}</Label>
      <Input
        id={`term-${key}`}
        type="number"
        value={Number.isFinite(meta[key]) ? meta[key] : ''}
        onChange={event => onChange({ ...meta, [key]: Number.parseInt(event.target.value, 10) })}
      />
    </div>
  );

  return (
    <>
      <div className="space-y-1">
        <Label htmlFor="term-name">Namn</Label>
        <Input
          id="term-name"
          value={meta.name}
          onChange={event => onChange({ ...meta, name: event.target.value })}
            autoFocus
        />
      </div>
      <div className="grid grid-cols-3 gap-2">
        {numberField('startWeek', 'Startvecka')}
        {numberField('startYear', 'År')}
        {numberField('weekCount', 'Antal veckor')}
      </div>
    </>
  );
}

type NewTermDialogProps = {
  open: boolean;
  onClose: () => void;
  onCreate: (meta: TermMeta, weeks: TermWeek[] | null) => Promise<void>;
};

/** Ny termin, tom eller med veckor, lov och teman från ett temahjul. */
export function NewTermDialog({ open, onClose, onCreate }: NewTermDialogProps) {
  const [meta, setMeta] = useState<TermMeta>(defaultMeta);
  const [wheels, setWheels] = useState<ThemeWheelSummary[]>([]);
  const [wheelId, setWheelId] = useState('');
  const [wheelWeeks, setWheelWeeks] = useState<TermWeek[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setMeta(defaultMeta());
    setWheelId('');
    setWheelWeeks(null);
    setError(null);
    themeWheelService.listWheels().then(setWheels).catch(() => setWheels([]));
  }, [open]);

  const chooseWheel = async (id: string) => {
    setWheelId(id);
    setWheelWeeks(null);
    if (!id) return;
    try {
      const wheel = await themeWheelService.getWheel(id);
      setMeta({
        name: wheel.name,
        startWeek: wheel.startWeek,
        startYear: wheel.startYear,
        weekCount: Math.min(wheel.weekCount, MAX_TERM_WEEKS),
      });
      setWheelWeeks(termWeeksFromWheel(wheel));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Kunde inte hämta hjulet.');
    }
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!isValidMeta(meta)) return;
    setBusy(true);
    setError(null);
    try {
      await onCreate(meta, wheelWeeks);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Kunde inte skapa terminen.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={next => { if (!next) onClose(); }}>
      <DialogContent>
        <DialogHeader><DialogTitle>Ny termin</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="term-wheel">Utgå från temakalendern (valfritt)</Label>
            <select
              id="term-wheel"
              className={selectClassName}
              value={wheelId}
              onChange={event => { void chooseWheel(event.target.value); }}
            >
              <option value="">— tom termin —</option>
              {wheels.map(wheel => (
                <option key={wheel.id} value={wheel.id}>
                  {wheel.name} (v.{wheel.startWeek}, {wheel.weekCount} v)
                </option>
              ))}
            </select>
            {wheelWeeks && (
              <p className="text-xs text-gray-500">
                Veckor, lov och arbetsområden hämtas från hjulet. Allt går att ändra efteråt.
              </p>
            )}
          </div>
          <MetaFields meta={meta} onChange={setMeta} />
          <p className="text-xs text-gray-500">
            Scheman som heter t.ex. &quot;v.35&quot; läggs in automatiskt på rätt vecka.
          </p>
          {error && <p className="text-sm text-rose-700">{error}</p>}
          <DialogFooter>
            <Button type="submit" disabled={busy || !isValidMeta(meta)}>Skapa</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

type SettingsDialogProps = {
  initial: TermMeta | null;
  onClose: () => void;
  onSave: (meta: TermMeta) => void;
  onDelete: () => Promise<void>;
};

export function TermSettingsDialog({ initial, onClose, onSave, onDelete }: SettingsDialogProps) {
  const [meta, setMeta] = useState<TermMeta | null>(initial);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    setMeta(initial);
    setConfirmDelete(false);
  }, [initial]);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!meta || !isValidMeta(meta)) return;
    onSave(meta);
    onClose();
  };

  return (
    <Dialog open={Boolean(initial)} onOpenChange={next => { if (!next) onClose(); }}>
      <DialogContent>
        <DialogHeader><DialogTitle>Terminens inställningar</DialogTitle></DialogHeader>
        {meta && (
          <form onSubmit={submit} className="space-y-3">
            <MetaFields meta={meta} onChange={setMeta} />
            <p className="text-xs text-gray-500">
              Färre veckor kapar slutet av terminen. Ändrad startvecka flyttar alla rader.
            </p>
            <DialogFooter className="gap-2 sm:justify-between">
              <Button
                type="button"
                variant="neutral"
                className={confirmDelete ? 'bg-rose-200' : ''}
                onClick={() => {
                  if (!confirmDelete) { setConfirmDelete(true); return; }
                  void onDelete().then(onClose);
                }}
              >
                {confirmDelete ? 'Klicka igen för att radera' : 'Radera terminen'}
              </Button>
              <Button type="submit" disabled={!isValidMeta(meta)}>Spara</Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
