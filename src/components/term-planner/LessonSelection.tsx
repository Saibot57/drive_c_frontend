'use client';

import React, { useCallback } from 'react';
import * as DropdownMenuPrimitive from '@radix-ui/react-dropdown-menu';
import { Check, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePersistentState } from '@/hooks/usePersistentState';
import { formatHours, isClassLesson, LessonTeachers, sanitizeSelection } from '@/utils/termPlanner';

/**
 * Vilka pass som visas i rutan "Pass per lärare", och kugghjulsmenyn där de
 * väljs. Från början är allt ikryssat utom Tema Oliv, Rosa och Grund, som
 * redan har en egen ruta.
 *
 * Bara det användaren själv ändrat sparas (titel → ikryssad). Ett pass som
 * dyker upp senare följer alltså standardregeln tills man tar ställning.
 */

const SELECTION_KEY = 'termPlanner.lessonTypes.selection.v1';
const NO_OVERRIDES: Record<string, boolean> = {};

export type LessonSelection = {
  isSelected: (lesson: LessonTeachers) => boolean;
  toggle: (lesson: LessonTeachers) => void;
  setAll: (lessons: LessonTeachers[], selected: boolean) => void;
  reset: () => void;
};

export const useLessonSelection = (): LessonSelection => {
  const [overrides, persist] = usePersistentState(SELECTION_KEY, sanitizeSelection, NO_OVERRIDES);

  const isSelected = useCallback(
    (lesson: LessonTeachers) => overrides[lesson.key] ?? !isClassLesson(lesson.label),
    [overrides]
  );

  return {
    isSelected,
    toggle: lesson => persist({ ...overrides, [lesson.key]: !isSelected(lesson) }),
    setAll: (lessons, selected) => persist({
      ...overrides,
      ...Object.fromEntries(lessons.map(lesson => [lesson.key, selected])),
    }),
    reset: () => persist({}),
  };
};

const actionClass = 'cursor-default rounded px-2 py-1 text-xs font-semibold outline-none data-[highlighted]:bg-gray-100';

/** Kugghjulet i rutans rubrik. Menyn står öppen medan man kryssar. */
export function LessonSelectionMenu({ lessons, selection }: {
  lessons: LessonTeachers[];
  selection: LessonSelection;
}) {
  const sorted = [...lessons].sort((a, b) => a.label.localeCompare(b.label, 'sv'));
  const selectedCount = lessons.filter(selection.isSelected).length;
  const keepOpen = (event: Event) => event.preventDefault();

  return (
    <DropdownMenuPrimitive.Root modal={false}>
      <DropdownMenuPrimitive.Trigger
        className="rounded p-1 hover:bg-gray-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-black data-[state=open]:bg-gray-100"
        aria-label="Välj vilka pass som visas"
        title="Välj vilka pass som visas"
      >
        <Settings size={16} />
      </DropdownMenuPrimitive.Trigger>
      <DropdownMenuPrimitive.Portal>
        <DropdownMenuPrimitive.Content
          align="end"
          sideOffset={6}
          collisionPadding={12}
          className="z-50 flex max-h-[min(70vh,var(--radix-dropdown-menu-content-available-height))] w-72 flex-col rounded-md border-2 border-black bg-white shadow-[4px_4px_0_0_#000]"
        >
          <div className="flex items-center justify-between gap-2 border-b-2 border-black px-3 py-2">
            <span className="text-sm font-bold">
              Visa pass <span className="font-normal text-gray-500">{selectedCount} av {lessons.length}</span>
            </span>
          </div>
          <div className="flex gap-1 border-b border-gray-100 px-2 py-1.5">
            <DropdownMenuPrimitive.Item className={actionClass} onSelect={event => { keepOpen(event); selection.setAll(lessons, true); }}>
              Alla
            </DropdownMenuPrimitive.Item>
            <DropdownMenuPrimitive.Item className={actionClass} onSelect={event => { keepOpen(event); selection.setAll(lessons, false); }}>
              Inga
            </DropdownMenuPrimitive.Item>
            <DropdownMenuPrimitive.Item
              className={actionClass}
              title="Alla utom Tema Oliv, Rosa och Grund"
              onSelect={event => { keepOpen(event); selection.reset(); }}
            >
              Standard
            </DropdownMenuPrimitive.Item>
          </div>

          <div className="min-h-0 overflow-y-auto p-1">
            {sorted.length === 0 && <p className="px-2 py-1.5 text-sm italic text-gray-500">Inga pass ännu.</p>}
            {sorted.map(lesson => {
              const checked = selection.isSelected(lesson);
              return (
                <DropdownMenuPrimitive.CheckboxItem
                  key={lesson.key}
                  checked={checked}
                  onCheckedChange={() => selection.toggle(lesson)}
                  onSelect={keepOpen}
                  className="flex cursor-default items-center gap-2 rounded px-2 py-1.5 text-sm outline-none data-[highlighted]:bg-gray-100"
                >
                  <span
                    aria-hidden
                    className={cn(
                      'flex h-4 w-4 shrink-0 items-center justify-center rounded-[3px] border-2 border-black',
                      checked ? 'bg-black text-white' : 'bg-white',
                    )}
                  >
                    {checked && <Check size={12} strokeWidth={3} />}
                  </span>
                  <span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: lesson.color }} />
                  <span className="min-w-0 flex-1 truncate" title={lesson.label}>{lesson.label}</span>
                  <span className="shrink-0 text-xs tabular-nums text-gray-500">{formatHours(lesson.total)} h</span>
                </DropdownMenuPrimitive.CheckboxItem>
              );
            })}
          </div>
        </DropdownMenuPrimitive.Content>
      </DropdownMenuPrimitive.Portal>
    </DropdownMenuPrimitive.Root>
  );
}
