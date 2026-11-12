'use client';

import React from 'react';
import { Users } from 'lucide-react';

export type GroupsChoiceItem = { key: string; label: string; count: number };

type Props = {
  choices: readonly GroupsChoiceItem[];
  onPick: (key: string) => void;
};

/**
 * Visas i mobilläget när passet som är valt saknar grupper men andra pass
 * samma dag har sådana, till exempel grupper som gjorts på datorn med andra
 * klasser valda. Ett tryck byter till passet och klasserna.
 */
export function MobileGroupChoices({ choices, onPick }: Props) {
  if (!choices.length) return null;
  return (
    <section className="sp-card flex flex-col gap-2 p-3" aria-label="Grupper i andra pass">
      <h3 className="flex items-center gap-1.5 font-mono text-xs font-bold uppercase tracking-wider text-ui-muted">
        <Users size={14} aria-hidden /> Grupper finns för
      </h3>
      <div className="flex flex-col gap-2">
        {choices.map(c => (
          <button
            key={c.key}
            type="button"
            onClick={() => onPick(c.key)}
            className="sp-card-sm flex min-h-[44px] items-center justify-between gap-3 px-3 py-2 text-left text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ui-focus)] focus-visible:ring-offset-2"
          >
            <span className="min-w-0 break-words">{c.label}</span>
            <span className="shrink-0 font-mono text-xs text-ui-muted">{c.count} st</span>
          </button>
        ))}
      </div>
    </section>
  );
}
