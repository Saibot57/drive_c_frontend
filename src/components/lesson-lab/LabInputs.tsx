'use client';

import React, { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

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

/** En färgruta som byter till nästa färg i paletten när man klickar. */
export function ColorSwatch({ color, onNext, label }: { color: string; onNext: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onNext}
      title={`${label}: byt färg`}
      aria-label={`${label}: byt färg`}
      className="h-5 w-5 shrink-0 rounded border-2 border-black focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black"
      style={{ background: color }}
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
