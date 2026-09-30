'use client';

import React, { useEffect, useRef, useState } from 'react';
import { ColorPicker } from '@/components/ui/ColorPicker';
import { COURSE_COLOR_PALETTE } from '@/config/plannerConstants';
import { cn } from '@/lib/utils';
import type { LabTeam } from '@/types/lessonLab';
import { getReadableTextColor } from '@/utils/readableTextColor';

/**
 * Ett textfält som sparar först när man lämnar det eller trycker Enter.
 * Escape ångrar. Tomt värde sparas aldrig: ett namn som suddas ut medan man
 * skriver ska inte ta bort läraren eller området.
 */
export function CommitInput({
  value,
  onCommit,
  className,
  placeholder,
  ariaLabel,
  allowEmpty = false,
}: {
  value: string;
  onCommit: (value: string) => void;
  className?: string;
  placeholder?: string;
  ariaLabel: string;
  allowEmpty?: boolean;
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => { setDraft(value); }, [value]);

  const commit = () => {
    const next = draft.trim();
    if (next === value) return;
    if (!next && !allowEmpty) { setDraft(value); return; }
    onCommit(next);
  };

  return (
    <input
      type="text"
      value={draft}
      aria-label={ariaLabel}
      placeholder={placeholder}
      onChange={event => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={event => {
        if (event.key === 'Enter') (event.target as HTMLInputElement).blur();
        if (event.key === 'Escape') { setDraft(value); (event.target as HTMLInputElement).blur(); }
      }}
      className={cn('min-w-0 rounded border border-transparent bg-transparent px-1 py-0.5 hover:border-gray-300 focus:border-black focus:bg-white focus:outline-none', className)}
    />
  );
}

/** Var arbetslagets senast valda egna färger sparas. */
const RECENT_COLORS_KEY = 'lessonLab.recentColors.v1';
const MAX_RECENT_COLORS = 6;

/**
 * En färgruta som öppnar samma färgväljare som schemats lådor: paletten, en
 * egen färg och de senast valda egna färgerna. Stängs med klick utanför eller
 * Escape.
 */
export function ColorSwatch({ color, onChange, label }: { color: string; onChange: (color: string) => void; label: string }) {
  // Rutan ligger med fast position: korten klipper det som sticker ut.
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const open = position !== null;
  const setOpen = (next: boolean) => {
    if (!next || !root.current) { setPosition(null); return; }
    const rect = root.current.getBoundingClientRect();
    setPosition({ top: rect.bottom + 6, left: Math.max(8, Math.min(rect.left, window.innerWidth - 272)) });
  };
  const root = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent | TouchEvent) => {
      if (root.current && !root.current.contains(event.target as Node)) setPosition(null);
    };
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') setPosition(null); };
    // Rutan följer inte med när sidan skrollas, så den stängs i stället.
    const scroll = () => setPosition(null);
    document.addEventListener('mousedown', close);
    document.addEventListener('touchstart', close);
    document.addEventListener('keydown', escape);
    window.addEventListener('scroll', scroll, true);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('touchstart', close);
      document.removeEventListener('keydown', escape);
      window.removeEventListener('scroll', scroll, true);
    };
  }, [open]);

  return (
    <span ref={root} className="relative inline-flex shrink-0">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        // Inte ett drag i dra-och-släpp-ytor: färgrutan ska gå att klicka.
        onPointerDown={event => event.stopPropagation()}
        title={`${label}: välj färg`}
        aria-label={`${label}: välj färg`}
        aria-expanded={open}
        className="h-5 w-5 rounded border-2 border-black focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black"
        style={{ background: color }}
      />
      {position && (
        <div
          className="fixed z-50 w-64 rounded-md border-2 border-black bg-white p-3 shadow-[4px_4px_0_0_#000]"
          style={{ top: position.top, left: position.left }}
          onPointerDown={event => event.stopPropagation()}
        >
          <ColorPicker
            value={color}
            onChange={onChange}
            palette={COURSE_COLOR_PALETTE}
            recentStorageKey={RECENT_COLORS_KEY}
            maxRecent={MAX_RECENT_COLORS}
          />
        </div>
      )}
    </span>
  );
}

/** Arbetslagets siffra i en ruta i lagets färg. */
export function TeamBadge({ team, size = 'md', className }: { team: Pick<LabTeam, 'number' | 'name' | 'color'>; size?: 'sm' | 'md'; className?: string }) {
  return (
    <span
      title={team.name}
      aria-label={`Arbetslag ${team.number}: ${team.name}`}
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded border border-black font-black tabular-nums leading-none',
        size === 'sm' ? 'h-4 min-w-[1rem] px-0.5 text-[10px]' : 'h-5 min-w-[1.25rem] px-1 text-xs',
        className
      )}
      style={{ background: team.color, color: getReadableTextColor(team.color) }}
    >
      {team.number}
    </span>
  );
}

/**
 * Arbetslagets siffra som går att ändra. Sparar när man lämnar fältet eller
 * trycker Enter. En siffra ett annat lag har byter de två lagen.
 */
export function TeamNumberInput({ team, onCommit }: { team: LabTeam; onCommit: (number: number) => void }) {
  const [draft, setDraft] = useState(String(team.number));
  useEffect(() => { setDraft(String(team.number)); }, [team.number]);

  const commit = () => {
    const value = Number(draft);
    if (Number.isInteger(value) && value >= 1 && value <= 99) onCommit(value);
    else setDraft(String(team.number));
  };

  return (
    <input
      type="text"
      inputMode="numeric"
      value={draft}
      aria-label={`Siffra för ${team.name}`}
      title="Lagets siffra. En siffra ett annat lag har byter de två lagen."
      onChange={event => setDraft(event.target.value.replace(/[^0-9]/g, '').slice(0, 2))}
      onBlur={commit}
      onPointerDown={event => event.stopPropagation()}
      onKeyDown={event => {
        if (event.key === 'Enter') (event.target as HTMLInputElement).blur();
        if (event.key === 'Escape') { setDraft(String(team.number)); (event.target as HTMLInputElement).blur(); }
      }}
      className="h-7 w-8 shrink-0 rounded border-2 border-black text-center text-sm font-black tabular-nums focus:outline-none focus:ring-2 focus:ring-black"
      style={{ background: team.color, color: getReadableTextColor(team.color) }}
    />
  );
}

/** Rubrik och innehåll i sidopanelens kort. */
export function LabCard({
  title,
  actions,
  children,
  className,
}: {
  title: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('sp-card', className)}>
      <div className="flex items-center justify-between gap-2 border-b-2 border-black px-4 py-3">
        <h2 className="font-bold">{title}</h2>
        {actions}
      </div>
      {children}
    </section>
  );
}
