'use client';

import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  isMathOptionSelected,
  MATH_OPTIONS,
  MathCourse,
  ParticipantChoice,
  TEMA_OPTIONS,
  TemaClass,
  toggleMathOption,
} from '@/utils/publicScheduleFilter';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Förifylls när man öppnar dialogen för att ändra ett tidigare val. */
  current: ParticipantChoice | null;
  onChoose: (choice: ParticipantChoice) => void;
};

/**
 * De två frågorna bakom "Vill du bara se de lektioner du ska gå på?".
 * Reglerna för vad svaren betyder bor i `publicScheduleFilter.ts`.
 */
export default function MyLessonsDialog({ open, onOpenChange, current, onChoose }: Props) {
  const [tema, setTema] = useState<TemaClass | null>(current?.tema ?? null);
  /** `null` = obesvarad, tom lista = läser ingen matte. */
  const [math, setMath] = useState<MathCourse[] | null>(current?.math ?? null);

  // Varje gång dialogen öppnas utgår den från det sparade valet, inte från
  // något man klickade i och sedan avbröt förra gången.
  useEffect(() => {
    if (!open) return;
    setTema(current?.tema ?? null);
    setMath(current?.math ?? null);
  }, [open, current]);

  const canSubmit = tema !== null && math !== null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-md overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Dina lektioner</DialogTitle>
        </DialogHeader>

        <form
          className="space-y-5"
          onSubmit={event => {
            event.preventDefault();
            if (tema && math) onChoose({ tema, math });
          }}
        >
          <fieldset>
            <legend className="mb-2 font-bold">Vilken temaklass läser du i?</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {TEMA_OPTIONS.map(option => (
                <OptionTile
                  key={option.value}
                  type="radio"
                  name="tema"
                  label={option.label}
                  checked={tema === option.value}
                  onToggle={() => setTema(option.value)}
                />
              ))}
            </div>
          </fieldset>

          {/* Kryssrutor, inte radioknappar: någon enstaka läser två kurser.
              Vilka som får kombineras avgör `toggleMathOption`. Ingen
              hjälptext om det — det är så ovanligt att arbetslaget inte vill
              att deltagarna ska tro att man kan välja två kurser hur som helst. */}
          <fieldset>
            <legend className="mb-2 font-bold">Vilken mattekurs läser du?</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {MATH_OPTIONS.map(option => (
                <OptionTile
                  key={option.value}
                  type="checkbox"
                  name="math"
                  label={option.label}
                  checked={isMathOptionSelected(math, option.value)}
                  onToggle={() => setMath(previous => toggleMathOption(previous, option.value))}
                />
              ))}
            </div>
          </fieldset>

          <div className="flex flex-wrap justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="rounded border-2 border-black bg-white px-4 py-2 text-sm font-bold"
            >
              Avbryt
            </button>
            <button
              type="submit"
              disabled={!canSubmit}
              className="rounded border-2 border-black bg-black px-4 py-2 text-sm font-bold text-white shadow-[3px_3px_0px_rgba(0,0,0,0.25)] disabled:cursor-not-allowed disabled:opacity-40"
            >
              Visa mina lektioner
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

type OptionTileProps = {
  type: 'radio' | 'checkbox';
  name: string;
  label: string;
  checked: boolean;
  onToggle: () => void;
};

/**
 * Riktiga radioknappar och kryssrutor under ytan, så att tangentbord och
 * skärmläsare fungerar som vanligt — men med stora ytor att trycka på,
 * eftersom de flesta svarar från telefonen.
 */
function OptionTile({ type, name, label, checked, onToggle }: OptionTileProps) {
  return (
    <label
      className={`flex cursor-pointer items-center gap-2 rounded border-2 border-black px-3 py-2.5 text-sm font-bold has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-black has-[:focus-visible]:ring-offset-2 ${
        checked ? 'bg-black text-white' : 'bg-white text-black'
      }`}
    >
      <input
        type={type}
        name={name}
        checked={checked}
        onChange={onToggle}
        className="sr-only"
      />
      {label}
    </label>
  );
}
