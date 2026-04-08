'use client';

import React, { useEffect, useMemo, useRef } from 'react';
import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScheduledEntry } from '@/types/schedule';
import {
  FindReplaceField,
  FindReplaceOptions,
  countMatches,
  findMatchingEntryIds,
} from '@/utils/findReplaceSchedule';

type FindReplacePanelProps = {
  open: boolean;
  onClose: () => void;
  schedule: ScheduledEntry[];
  field: FindReplaceField;
  onFieldChange: (field: FindReplaceField) => void;
  findText: string;
  onFindTextChange: (value: string) => void;
  replaceText: string;
  onReplaceTextChange: (value: string) => void;
  options: FindReplaceOptions;
  onOptionsChange: (options: FindReplaceOptions) => void;
  onReplaceAll: () => void;
};

const FIELD_OPTIONS: { value: FindReplaceField; label: string }[] = [
  { value: 'all', label: 'Alla fält' },
  { value: 'room', label: 'Sal' },
  { value: 'teacher', label: 'Lärare' },
  { value: 'title', label: 'Kurs/Titel' },
  { value: 'category', label: 'Kategori' },
  { value: 'notes', label: 'Anteckningar' },
];

export function FindReplacePanel({
  open,
  onClose,
  schedule,
  field,
  onFieldChange,
  findText,
  onFindTextChange,
  replaceText,
  onReplaceTextChange,
  options,
  onOptionsChange,
  onReplaceAll,
}: FindReplacePanelProps) {
  const findInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      // Delay so the input exists in the DOM before focusing.
      const id = window.setTimeout(() => {
        findInputRef.current?.focus();
        findInputRef.current?.select();
      }, 0);
      return () => window.clearTimeout(id);
    }
  }, [open]);

  const matchCount = useMemo(
    () => countMatches(schedule, field, findText, options),
    [schedule, field, findText, options]
  );

  const affectedEntries = useMemo(
    () => findMatchingEntryIds(schedule, field, findText, options).size,
    [schedule, field, findText, options]
  );

  if (!open) return null;

  const hasQuery = findText.trim().length > 0;
  const canReplace = hasQuery && matchCount > 0;

  return (
    <div
      className="fixed top-4 left-1/2 -translate-x-1/2 z-[120] w-[min(560px,calc(100vw-2rem))] border-2 border-black bg-yellow-50 shadow-[6px_6px_0px_black] rounded-lg"
      role="dialog"
      aria-label="Hitta och ersätt i schema"
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.stopPropagation();
          onClose();
        }
      }}
    >
      <div className="flex items-center justify-between px-3 py-2 border-b-2 border-black bg-yellow-200 rounded-t-md">
        <div className="flex items-center gap-2 font-bold text-sm">
          <Search size={14} />
          Hitta och ersätt
        </div>
        <button
          type="button"
          aria-label="Stäng"
          onClick={onClose}
          className="p-1 rounded hover:bg-yellow-300"
        >
          <X size={14} />
        </button>
      </div>

      <div className="p-3 space-y-2">
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold w-16 shrink-0">Fält</label>
          <select
            value={field}
            onChange={(e) => onFieldChange(e.target.value as FindReplaceField)}
            className="h-9 rounded-base border-2 border-border bg-bw px-2 text-sm font-base"
          >
            {FIELD_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <span className="ml-auto text-xs font-semibold text-gray-700">
            {hasQuery
              ? `${matchCount} träff${matchCount === 1 ? '' : 'ar'} i ${affectedEntries} post${affectedEntries === 1 ? '' : 'er'}`
              : 'Skriv något att söka efter'}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold w-16 shrink-0">Hitta</label>
          <Input
            ref={findInputRef}
            value={findText}
            onChange={(e) => onFindTextChange(e.target.value)}
            placeholder="t.ex. Citadellet"
            className="h-9"
          />
        </div>

        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold w-16 shrink-0">Ersätt</label>
          <Input
            value={replaceText}
            onChange={(e) => onReplaceTextChange(e.target.value)}
            placeholder="t.ex. Ven"
            className="h-9"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && canReplace) {
                e.preventDefault();
                onReplaceAll();
              }
            }}
          />
        </div>

        <div className="flex items-center gap-4 pl-16">
          <label className="flex items-center gap-1 text-xs font-semibold">
            <input
              type="checkbox"
              checked={!!options.caseSensitive}
              onChange={(e) =>
                onOptionsChange({ ...options, caseSensitive: e.target.checked })
              }
            />
            Skiftlägeskänsligt
          </label>
          <label className="flex items-center gap-1 text-xs font-semibold">
            <input
              type="checkbox"
              checked={!!options.wholeWord}
              onChange={(e) =>
                onOptionsChange({ ...options, wholeWord: e.target.checked })
              }
            />
            Endast hela ord
          </label>
        </div>

        <div className="flex items-center justify-end gap-2 pt-1">
          <Button
            type="button"
            variant="neutral"
            onClick={onClose}
            className="h-9 text-sm"
          >
            Stäng
          </Button>
          <Button
            type="button"
            disabled={!canReplace}
            onClick={onReplaceAll}
            className="h-9 text-sm"
          >
            Ersätt alla
          </Button>
        </div>
      </div>
    </div>
  );
}
