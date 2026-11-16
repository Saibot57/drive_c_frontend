'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { chip } from '@/components/narvaro/chip';
import { cn } from '@/lib/utils';
import { MAX_CLASS_NAME_LENGTH, cleanClassName } from '@/utils/narvaro';

type Props = {
  title: string;
  hint?: string;
  classes: string[];
  suggested?: string;
  newName: string;
  onNewName: (name: string) => void;
  onPick: (klass: string) => void;
  onCancel?: () => void;
};

/** Välj en befintlig klass eller skriv en ny. */
export function ClassPicker({ title, hint, classes, suggested, newName, onNewName, onPick, onCancel }: Props) {
  const name = cleanClassName(newName);
  return (
    <div className="flex flex-col gap-2">
      <p className="font-semibold">{title}</p>
      {hint && <p className="text-sm">{hint}</p>}
      <div className="flex flex-wrap items-center gap-2">
        {[...classes].sort((a, b) => (a === suggested ? -1 : b === suggested ? 1 : 0)).map(k => (
          <button
            key={k}
            type="button"
            onClick={() => onPick(k)}
            className={cn(chip(k === suggested), 'text-sm')}
          >
            {k}
          </button>
        ))}
        <form
          className="flex gap-1.5"
          onSubmit={e => { e.preventDefault(); if (name) onPick(name); }}
        >
          <input
            value={newName}
            onChange={e => onNewName(e.target.value)}
            maxLength={MAX_CLASS_NAME_LENGTH}
            placeholder="Ny klass"
            aria-label="Ny klass"
            className="sp-input w-32 rounded-ui-sm bg-ui-paper px-2 py-1 text-sm text-ui-ink"
          />
          <Button type="submit" variant="neutral" size="sm" className="sp-btn" disabled={!name}>Spara</Button>
        </form>
        {onCancel && <button type="button" className="text-sm text-ui-muted underline" onClick={onCancel}>Avbryt</button>}
      </div>
    </div>
  );
}
