'use client';

import React, { useState } from 'react';
import { FolderOpen, Users } from 'lucide-react';
import { sortTemplates, templateSize, type GroupTemplate } from '@/utils/narvaroTemplates';

export type GroupsChoiceItem = { key: string; label: string; count: number };

type Props = {
  choices: readonly GroupsChoiceItem[];
  onPick: (key: string) => void;
  /** Sparade indelningar som kan läggas på passet. */
  templates?: readonly GroupTemplate[];
  onApplyTemplate?: (id: string) => void;
};

/** Så många indelningar visas innan resten fälls ut. */
const SHOWN_TEMPLATES = 5;

const itemClass =
  'sp-card-sm flex min-h-[44px] items-center justify-between gap-3 px-3 py-2 text-left text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ui-focus)] focus-visible:ring-offset-2';
const headingClass = 'flex items-center gap-1.5 font-mono text-xs font-bold uppercase tracking-wider text-ui-muted';

/**
 * Visas i mobilläget när passet som är valt saknar grupper. Andra pass samma
 * dag som har grupper, till exempel gjorda på datorn med andra klasser valda:
 * ett tryck byter till passet och klasserna. Och de sparade indelningarna:
 * ett tryck lägger på indelningen, med dess klasser.
 */
export function MobileGroupChoices({ choices, onPick, templates = [], onApplyTemplate }: Props) {
  const [all, setAll] = useState(false);
  const sorted = sortTemplates(templates);
  const shown = all ? sorted : sorted.slice(0, SHOWN_TEMPLATES);
  if (!choices.length && !(onApplyTemplate && sorted.length)) return null;
  return (
    <section className="sp-card flex flex-col gap-3 p-3" aria-label="Grupper att välja">
      {choices.length > 0 && (
        <div className="flex flex-col gap-2">
          <h3 className={headingClass}><Users size={14} aria-hidden /> Grupper finns för</h3>
          {choices.map(c => (
            <button key={c.key} type="button" onClick={() => onPick(c.key)} className={itemClass}>
              <span className="min-w-0 break-words">{c.label}</span>
              <span className="shrink-0 font-mono text-xs text-ui-muted">{c.count} st</span>
            </button>
          ))}
        </div>
      )}
      {onApplyTemplate && sorted.length > 0 && (
        <div className="flex flex-col gap-2">
          <h3 className={headingClass}><FolderOpen size={14} aria-hidden /> Sparade indelningar</h3>
          {shown.map(t => (
            <button key={t.id} type="button" onClick={() => onApplyTemplate(t.id)} className={itemClass}>
              <span className="min-w-0 break-words">{t.name}</span>
              <span className="shrink-0 font-mono text-xs text-ui-muted">{t.groups.length} gr · {templateSize(t)} st</span>
            </button>
          ))}
          {sorted.length > SHOWN_TEMPLATES && (
            <button type="button" onClick={() => setAll(a => !a)} className="min-h-[44px] text-sm font-semibold underline">
              {all ? 'Visa färre' : `Visa alla (${sorted.length})`}
            </button>
          )}
        </div>
      )}
    </section>
  );
}
