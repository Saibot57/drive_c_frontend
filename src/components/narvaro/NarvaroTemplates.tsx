'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Pencil, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { NarvaroGroups } from '@/components/narvaro/NarvaroGroups';
import { chip } from '@/components/narvaro/chip';
import { cn } from '@/lib/utils';
import type { NarvaroSaveStatus } from '@/hooks/useNarvaroSync';
import { combineSheets, type AttendanceTable } from '@/utils/narvaro';
import {
  MAX_TEMPLATE_NAME_LENGTH,
  addTemplateGroup,
  cleanTemplateName,
  emptyTemplate,
  memberLabels,
  missingMembers,
  moveMember,
  newTemplateId,
  personMember,
  removeMissing,
  removeTemplateGroup,
  renameTemplateGroup,
  sameMember,
  sortTemplates,
  templateSize,
  type GroupTemplate,
} from '@/utils/narvaroTemplates';

type Props = {
  templates: readonly GroupTemplate[];
  /** Varje klass senaste ark (`knownClasses`), där eleverna hämtas. */
  sheets: Record<string, AttendanceTable>;
  /** Klasserna som visas på sidan, förval för en ny indelning. */
  defaultClasses: readonly string[];
  /** Status för dokumentet med indelningarna (`statusOf`). */
  status: NarvaroSaveStatus;
  onSave: (template: GroupTemplate) => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
};

const classLabel = (klass: string) => klass || 'Utan klass';
const dateLabel = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : `${d.getDate()}/${d.getMonth() + 1}`;
};

/** Var en sparning står: väntar på att börja, pågår, eller inget. */
type Wait = 'idle' | 'started' | 'inflight';

/**
 * Hantera indelningar: listan och redigeringen av en indelning. Tar
 * gruppdelens plats på sidan, eftersom `NarvaroGroups` lyssnar på hela
 * dokumentet och två samtidigt skulle reagera på samma drag.
 *
 * Redigeringen ändrar en kopia. Spara skriver indelningen, och redigeringen
 * är öppen tills just indelningarna har sparats, så att inget går förlorat
 * vid en konflikt.
 */
export function NarvaroTemplates({ templates, sheets, defaultClasses, status, onSave, onRename, onDelete, onClose }: Props) {
  const [draft, setDraft] = useState<GroupTemplate | null>(null);
  const [classes, setClasses] = useState<string[]>([]);
  const [renaming, setRenaming] = useState<{ id: string; text: string } | null>(null);
  const [armed, setArmed] = useState<string | null>(null);
  const [wait, setWait] = useState<Wait>('idle');
  const statusRef = useRef(status);
  statusRef.current = status;

  const allClasses = useMemo(() => Object.keys(sheets).sort((a, b) => a.localeCompare(b, 'sv')), [sheets]);

  const open = (t: GroupTemplate) => {
    const own = allClasses.filter(k => t.groups.some(g => g.members.some(m => m.klass === k)));
    setClasses(own.length ? own : allClasses.filter(k => defaultClasses.includes(k)));
    setDraft(t);
    setWait('idle');
  };

  // Stäng när indelningarna sparats. Ändrades inget skickas inget, och då
  // stängs redigeringen efter en stund ändå.
  useEffect(() => {
    if (wait === 'started' && status !== 'saved') setWait('inflight');
    else if (wait === 'inflight' && status === 'saved') { setWait('idle'); setDraft(null); }
  }, [status, wait]);
  useEffect(() => {
    if (wait !== 'started') return;
    const t = setTimeout(() => {
      if (statusRef.current === 'saved') { setWait('idle'); setDraft(null); }
    }, 1500);
    return () => clearTimeout(t);
  }, [wait]);

  const people = useMemo(() => combineSheets(sheets, classes).people, [sheets, classes]);
  const editor = useMemo(() => {
    if (!draft) return null;
    const members = draft.groups.flatMap(g => g.members);
    const { label, member } = memberLabels(members, people);
    const pool = people.map(personMember).filter(p => !members.some(m => sameMember(m, p))).map(label);
    return {
      label,
      member,
      view: { groups: draft.groups.map(g => g.members.map(label)), pool: Array.from(new Set(pool)) },
      missing: new Set(missingMembers(draft, sheets).map(label)),
    };
  }, [draft, people, sheets]);

  if (draft && editor) {
    const save = () => {
      onSave({ ...draft, name: cleanTemplateName(draft.name) || 'Indelning', updatedAt: new Date().toISOString() });
      setWait('started');
    };
    const busy = wait !== 'idle';
    return (
      <div className="flex flex-col gap-3">
        <section className="sp-card flex flex-col gap-3 p-4" aria-label="Redigera indelning">
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex min-w-0 flex-1 flex-col gap-1 text-sm font-semibold">
              Indelningens namn
              <input
                value={draft.name}
                onChange={e => setDraft({ ...draft, name: e.target.value.slice(0, MAX_TEMPLATE_NAME_LENGTH) })}
                maxLength={MAX_TEMPLATE_NAME_LENGTH}
                className="sp-input rounded-ui-sm bg-ui-paper px-2 py-1.5 text-base font-bold"
              />
            </label>
            <div className="flex gap-2">
              <Button variant="neutral" className="sp-btn" disabled={busy} onClick={() => setDraft(null)}>Avbryt</Button>
              <Button className="sp-btn" disabled={busy} onClick={save}>{busy ? 'Sparar…' : 'Spara'}</Button>
            </div>
          </div>
          {status === 'conflict' && wait === 'inflight' && (
            <p role="alert" className="rounded-ui-sm bg-ui-mark-pink px-3 py-2 text-sm font-semibold text-ui-mark-fg">
              Indelningarna har ändrats på en annan enhet. Läs in på nytt och gör om ändringen.
            </p>
          )}
          {status === 'error' && wait === 'inflight' && (
            <p role="status" className="text-sm text-ui-muted">Kunde inte spara än. Försöker igen.</p>
          )}
          <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Klasser i Inte indelade">
            <span className="text-sm font-semibold">Elever från</span>
            {allClasses.length ? allClasses.map(k => (
              <button
                key={k}
                type="button"
                aria-pressed={classes.includes(k)}
                onClick={() => setClasses(c => (c.includes(k) ? c.filter(x => x !== k) : allClasses.filter(x => x === k || c.includes(x))))}
                className={cn(chip(classes.includes(k)), 'text-sm')}
              >
                {classLabel(k)}
              </button>
            )) : <span className="text-sm text-ui-muted">Klistra in ett ark för att kunna välja elever.</span>}
          </div>
          {editor.missing.size > 0 && (
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span>{editor.missing.size} namn finns inte i något ark.</span>
              <Button variant="neutral" size="sm" className="sp-btn" onClick={() => setDraft(removeMissing(draft, sheets))}>
                Ta bort saknade
              </Button>
            </div>
          )}
        </section>
        <NarvaroGroups
          title={draft.name || 'Indelning'}
          view={editor.view}
          people={{}}
          stamps={[]}
          names={draft.groups.map(g => g.name)}
          missing={editor.missing}
          onMove={(name, target) => {
            const m = editor.member.get(name);
            if (m) setDraft(moveMember(draft, m, target));
          }}
          onAddGroup={() => setDraft(addTemplateGroup(draft))}
          onDeleteGroup={i => setDraft(removeTemplateGroup(draft, i))}
          onRenameGroup={(i, name) => setDraft(renameTemplateGroup(draft, i, name))}
        />
      </div>
    );
  }

  const list = sortTemplates(templates);
  return (
    <section className="sp-card flex flex-col gap-3 p-4" aria-label="Sparade indelningar">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-lg font-bold">Sparade indelningar</h3>
        <div className="flex flex-wrap gap-2">
          <Button
            className="sp-btn"
            onClick={() => open(emptyTemplate(newTemplateId(), 'Ny indelning', new Date()))}
          >
            <Plus /> Ny indelning
          </Button>
          <Button variant="neutral" className="sp-btn" onClick={onClose}><ArrowLeft /> Tillbaka till passet</Button>
        </div>
      </div>
      <p className="max-w-prose text-sm text-ui-muted">
        En indelning kan läggas på vilket pass som helst under Grupper. De närvarande hamnar i sina grupper,
        frånvarande syns inte, och närvarande som inte finns i indelningen står i Inte indelade.
      </p>
      {list.length ? (
        <ul className="flex flex-col divide-y divide-ui-hair">
          {list.map(t => (
            <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              {renaming?.id === t.id ? (
                <form
                  className="flex min-w-0 flex-1 gap-1.5"
                  onSubmit={e => { e.preventDefault(); onRename(t.id, renaming.text); setRenaming(null); }}
                >
                  <input
                    value={renaming.text}
                    onChange={e => setRenaming({ id: t.id, text: e.target.value })}
                    onKeyDown={e => { if (e.key === 'Escape') setRenaming(null); }}
                    maxLength={MAX_TEMPLATE_NAME_LENGTH}
                    aria-label="Nytt namn"
                    autoFocus
                    className="sp-input min-w-0 flex-1 rounded-ui-sm bg-ui-paper px-2 py-1 text-sm"
                  />
                  <Button type="submit" size="sm" className="sp-btn" disabled={!cleanTemplateName(renaming.text)}>Spara</Button>
                  <Button type="button" variant="neutral" size="sm" className="sp-btn" onClick={() => setRenaming(null)}>Avbryt</Button>
                </form>
              ) : (
                <button type="button" onClick={() => open(t)} className="min-w-0 text-left">
                  <span className="block break-words font-semibold underline-offset-2 hover:underline">{t.name}</span>
                  <span className="font-mono text-xs text-ui-muted">
                    {t.groups.length} grupper · {templateSize(t)} elever{dateLabel(t.updatedAt) && ` · ändrad ${dateLabel(t.updatedAt)}`}
                  </span>
                </button>
              )}
              {renaming?.id !== t.id && (
                <span className="flex gap-2">
                  <Button variant="neutral" size="sm" className="sp-btn" onClick={() => open(t)}>Öppna</Button>
                  <Button variant="neutral" size="sm" className="sp-btn" onClick={() => setRenaming({ id: t.id, text: t.name })}>
                    <Pencil /> Byt namn
                  </Button>
                  <Button
                    variant="neutral"
                    size="sm"
                    className="sp-btn"
                    onClick={() => { if (armed === t.id) { onDelete(t.id); setArmed(null); } else setArmed(t.id); }}
                    onBlur={() => setArmed(a => (a === t.id ? null : a))}
                  >
                    <Trash2 /> {armed === t.id ? 'Säker? Tryck igen' : 'Ta bort'}
                  </Button>
                </span>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-ui-muted">
          Inga sparade indelningar än. Gör en ny här, eller dela in ett pass och välj Spara som indelning.
        </p>
      )}
    </section>
  );
}
