'use client';

import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, Download, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { IMAGE_FORMAT_OPTIONS, PDF_PAGE_OPTIONS } from '@/config/scheduleExportFormats';
import type { ExportFormat } from '@/utils/schedulePdf';
import type { PageMode } from '@/utils/schedulePdf/theme';
import { exportTargets, isAllSubject, LabExportSubject, LabExportTarget } from '@/utils/labScheduleExport';

/**
 * Exportmenyn på Arbetslag, utformad som planerarens: först vem schemat
 * gäller, sedan formatet. "Alla …" blir en PDF med en sida per lag eller
 * lärare, så bilderna går bara för ett lag eller en lärare.
 */

type Props = {
  targets: ReturnType<typeof exportTargets> | null;
  /** Varför knappen är avstängd, eller `null` när den går att använda. */
  disabledReason: string | null;
  busy: boolean;
  onExport: (subject: LabExportSubject, format: ExportFormat, pageMode: PageMode) => void;
};

const sectionLabel = 'px-3 pb-1 pt-2 text-2xs font-bold uppercase text-ui-muted kron:font-mono kron:font-medium kron:tracking-[0.08em]';
const ALL_ONLY_PDF = 'Bara PDF för alla';

export function LabExportMenu({ targets, disabledReason, busy, onExport }: Props) {
  const [open, setOpen] = useState(false);
  const [chosenKey, setChosenKey] = useState('all-teachers');
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleOutsideClick = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setOpen(false);
    };
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('mousedown', handleOutsideClick);
    window.addEventListener('keydown', handleEsc);
    return () => {
      window.removeEventListener('mousedown', handleOutsideClick);
      window.removeEventListener('keydown', handleEsc);
    };
  }, [open]);

  const groups: { label: string; items: LabExportTarget[] }[] = targets
    ? [
      { label: 'Alla', items: targets.all },
      { label: 'Arbetslag', items: targets.teams },
      { label: 'Lärare', items: targets.teachers },
    ].filter(group => group.items.length > 0)
    : [];
  const items = groups.flatMap(group => group.items);
  // Ett lag eller en lärare som tagits bort kan inte vara valt.
  const chosen = items.find(t => t.key === chosenKey && t.passCount > 0) ?? items.find(t => t.passCount > 0) ?? null;
  const pdfOnly = chosen ? isAllSubject(chosen.subject) : false;
  const disabled = Boolean(disabledReason) || busy;

  const run = (format: ExportFormat, pageMode: PageMode) => {
    if (!chosen) return;
    onExport(chosen.subject, format, pageMode);
    setOpen(false);
  };

  return (
    <div className="relative" ref={menuRef}>
      <Button
        variant="neutral"
        className="sp-btn gap-1.5 px-3"
        onClick={() => setOpen(current => !current)}
        disabled={disabled}
        title={disabledReason ?? 'Exportera scheman per arbetslag eller lärare ur upplägget'}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        {busy ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />} Exportera
        <ChevronDown size={14} className="-mr-1 opacity-60" />
      </Button>
      {open && !disabled && (
        <div role="menu" className="absolute right-0 z-[100] mt-2 w-64 bg-ui-paper sp-dropdown p-1">
          <p className={sectionLabel}>Vem</p>
          <div className="px-3 pb-2">
            <select
              className="sp-input h-8 w-full rounded-md bg-ui-paper px-2 text-sm font-semibold"
              value={chosen?.key ?? ''}
              onChange={event => setChosenKey(event.target.value)}
              aria-label="Vems schema"
            >
              {!chosen && <option value="">Inga pass att exportera</option>}
              {groups.map(group => (
                <optgroup key={group.label} label={group.label}>
                  {group.items.map(target => (
                    <option key={target.key} value={target.key} disabled={target.passCount === 0}>
                      {target.label}{target.passCount === 0 ? ' (inga pass)' : ''}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>
          <div className="my-1 h-px bg-gray-200 kron:bg-ui-hair" role="separator" />
          <p className={sectionLabel}>PDF</p>
          {PDF_PAGE_OPTIONS.map(({ mode, label, hint }) => (
            <button
              key={mode}
              type="button"
              role="menuitem"
              title={hint}
              disabled={!chosen}
              className="w-full rounded px-3 py-2 text-left text-sm sp-menu-item disabled:opacity-50"
              onClick={() => run('pdf', mode)}
            >
              {label}
            </button>
          ))}
          <div className="my-1 h-px bg-gray-200 kron:bg-ui-hair" role="separator" />
          <p className={sectionLabel}>Bild</p>
          {IMAGE_FORMAT_OPTIONS.map(({ format, label, hint }) => (
            <button
              key={format}
              type="button"
              role="menuitem"
              title={pdfOnly ? ALL_ONLY_PDF : hint}
              disabled={!chosen || pdfOnly}
              className="w-full rounded px-3 py-2 text-left text-sm sp-menu-item disabled:opacity-50"
              onClick={() => run(format, 'digital')}
            >
              {label}
            </button>
          ))}
          {pdfOnly && <p className="px-3 pb-2 text-xs text-ui-muted">{ALL_ONLY_PDF}.</p>}
        </div>
      )}
    </div>
  );
}
