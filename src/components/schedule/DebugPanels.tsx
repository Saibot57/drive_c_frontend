'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, Plus, X } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { DEFAULT_COURSE_COLOR, PLANNER_DAYS } from '@/components/schedule/constants';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ColorTriggerRule, TeacherAvailability, TeacherDayBlock } from '@/types/schedule';
import { parseExcludeList } from '@/utils/exportExclusions';
import { sanitizePlanningMinGap } from '@/utils/planningTime';
import { blocksWholeDay } from '@/utils/scheduleRules';

const sanitizeHiddenList = (input: string) => {
  const lines = input
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean);
  const seen = new Set<string>();
  return lines.filter(line => {
    const key = line.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const DAY_ABBREVIATION: Record<string, string> = {
  'Måndag': 'Må',
  'Tisdag': 'Ti',
  'Onsdag': 'On',
  'Torsdag': 'To',
  'Fredag': 'Fr'
};

const toggleBlock = (
  availability: TeacherAvailability,
  teacher: string,
  day: string,
  next: TeacherDayBlock[]
): TeacherAvailability => {
  const days = { ...(availability[teacher] ?? {}) };
  if (next.length === 0) {
    delete days[day];
  } else {
    days[day] = next;
  }

  const updated = { ...availability };
  if (Object.keys(days).length === 0) {
    delete updated[teacher];
  } else {
    updated[teacher] = days;
  }
  return updated;
};

type TeacherAvailabilityRowProps = {
  teacher: string;
  days: Record<string, TeacherDayBlock[]>;
  onChange: (day: string, next: TeacherDayBlock[]) => void;
};

function TeacherAvailabilityRow({ teacher, days, onChange }: TeacherAvailabilityRowProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const summary = useMemo(() => {
    const parts = PLANNER_DAYS
      .filter(day => (days[day] ?? []).length > 0)
      .map(day => {
        const blocks = days[day];
        if (blocksWholeDay(blocks)) return DAY_ABBREVIATION[day];
        return `${DAY_ABBREVIATION[day]} ${blocks[0]}`;
      });
    return parts.length > 0 ? parts.join(', ') : 'Alltid tillgänglig';
  }, [days]);

  return (
    <div className="border-2 border-black rounded p-2 bg-white">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="font-bold text-sm break-words">{teacher}</p>
          <p className="text-[11px] text-gray-500 truncate">{summary}</p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="neutral"
          className="h-7 w-7 p-0 shrink-0"
          aria-expanded={isExpanded}
          aria-label={isExpanded ? `Dölj halvdagar för ${teacher}` : `Visa halvdagar för ${teacher}`}
          onClick={() => setIsExpanded(open => !open)}
        >
          {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </Button>
      </div>

      <div className="mt-2 flex gap-1">
        {PLANNER_DAYS.map(day => {
          const blocks = days[day] ?? [];
          const wholeDay = blocksWholeDay(blocks);

          return (
            <div key={day} className="flex-1 min-w-0 space-y-1">
              <button
                type="button"
                aria-pressed={wholeDay}
                title={`${teacher}, ${day.toLocaleLowerCase('sv')} – hela dagen`}
                onClick={() => onChange(day, wholeDay ? [] : ['all'])}
                className={`w-full rounded border-2 border-black px-1 py-1 text-xs font-bold transition-colors ${
                  wholeDay ? 'bg-rose-300' : 'bg-white hover:bg-gray-100'
                }`}
              >
                {DAY_ABBREVIATION[day]}
              </button>

              {isExpanded && (['fm', 'em'] as const).map(part => {
                const active = wholeDay || blocks.includes(part);
                return (
                  <button
                    key={part}
                    type="button"
                    aria-pressed={active}
                    title={`${teacher}, ${day.toLocaleLowerCase('sv')} ${part === 'fm' ? 'förmiddag (före 12)' : 'eftermiddag (efter 12)'}`}
                    onClick={() => {
                      const current = wholeDay ? (['fm', 'em'] as TeacherDayBlock[]) : blocks;
                      const next = current.includes(part)
                        ? current.filter(block => block !== part)
                        : [...current.filter(block => block !== 'all'), part];
                      onChange(day, next);
                    }}
                    className={`w-full rounded border border-black px-1 py-0.5 text-[10px] font-bold uppercase transition-colors ${
                      active ? 'bg-rose-200' : 'bg-white hover:bg-gray-100'
                    }`}
                  >
                    {part}
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

type ColorTriggerListProps = {
  triggers: ColorTriggerRule[];
  onChange: (next: ColorTriggerRule[]) => void;
};

function ColorTriggerList({ triggers, onChange }: ColorTriggerListProps) {
  const update = (id: string, patch: Partial<ColorTriggerRule>) => {
    onChange(triggers.map(trigger => (trigger.id === id ? { ...trigger, ...patch } : trigger)));
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      {triggers.length === 0 ? (
        <p className="text-sm text-gray-500 italic">Inga färgregler ännu.</p>
      ) : (
        <div className="min-h-0 space-y-2 overflow-y-auto pr-1">
          {triggers.map((trigger, index) => (
            <div key={trigger.id} className="flex items-center gap-2">
              <span className="w-5 shrink-0 text-xs font-bold text-gray-400">{index + 1}</span>
              <Input
                value={trigger.word}
                onChange={event => update(trigger.id, { word: event.target.value })}
                placeholder="Ord i titeln, t.ex. prov"
                aria-label={`Triggerord ${index + 1}`}
                className="flex-1"
              />
              <label
                className="flex shrink-0 cursor-pointer items-center gap-2 rounded border-2 border-black px-2 py-1 text-xs"
                title="Välj färg"
              >
                <span
                  className="h-4 w-4 rounded-full border border-black"
                  style={{ backgroundColor: trigger.color }}
                />
                Färg
                <input
                  type="color"
                  className="sr-only"
                  aria-label={`Färg för ${trigger.word || `regel ${index + 1}`}`}
                  value={trigger.color}
                  onChange={event => update(trigger.id, { color: event.target.value })}
                />
              </label>
              <Button
                type="button"
                size="sm"
                variant="neutral"
                className="h-8 w-8 shrink-0 p-0"
                aria-label={`Ta bort regel ${index + 1}`}
                onClick={() => onChange(triggers.filter(item => item.id !== trigger.id))}
              >
                <X size={14} />
              </Button>
            </div>
          ))}
        </div>
      )}

      <Button
        type="button"
        size="sm"
        variant="neutral"
        className="shrink-0 self-start"
        onClick={() => onChange([...triggers, { id: uuidv4(), word: '', color: DEFAULT_COURSE_COLOR }])}
      >
        <Plus size={14} className="mr-1" /> Lägg till färgregel
      </Button>
    </div>
  );
}

type HiddenSettingsPanelProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teachers: string[];
  rooms: string[];
  teacherAvailability: TeacherAvailability;
  colorTriggers: ColorTriggerRule[];
  planningMinGap: number;
  exportExcludes: string[];
  onSave: (
    nextTeachers: string[],
    nextRooms: string[],
    nextAvailability: TeacherAvailability,
    nextColorTriggers: ColorTriggerRule[],
    nextPlanningMinGap: number,
    nextExportExcludes: string[]
  ) => void;
};

export function HiddenSettingsPanel({
  open,
  onOpenChange,
  teachers,
  rooms,
  teacherAvailability,
  colorTriggers,
  planningMinGap,
  exportExcludes,
  onSave
}: HiddenSettingsPanelProps) {
  const [teacherText, setTeacherText] = useState('');
  const [roomText, setRoomText] = useState('');
  const [availability, setAvailability] = useState<TeacherAvailability>({});
  const [triggers, setTriggers] = useState<ColorTriggerRule[]>([]);
  const [minGapText, setMinGapText] = useState('');
  const [excludeText, setExcludeText] = useState('');

  useEffect(() => {
    if (!open) return;
    setTeacherText(teachers.join('\n'));
    setRoomText(rooms.join('\n'));
    setAvailability(teacherAvailability);
    setTriggers(colorTriggers);
    setMinGapText(String(planningMinGap));
    setExcludeText(exportExcludes.join('; '));
  }, [open, rooms, teachers, teacherAvailability, colorTriggers, planningMinGap, exportExcludes]);

  // Raderna följer textrutan direkt, så en nyss tillagd lärare går att
  // ställa in utan att man behöver spara och öppna panelen igen.
  const teacherRows = useMemo(() => sanitizeHiddenList(teacherText), [teacherText]);

  const handleSave = () => {
    onSave(
      teacherRows,
      sanitizeHiddenList(roomText),
      availability,
      triggers,
      sanitizePlanningMinGap(minGapText),
      parseExcludeList(excludeText)
    );
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* Nära fullskärm. Kolumnerna scrollar var för sig så fönstret självt
          aldrig behöver scrollas. pt-10 ger plats åt stängkrysset, som annars
          hamnar ovanpå innehållet nu när rubriken är dold. */}
      <DialogContent className="flex flex-col gap-4 w-[96vw] max-w-none h-[92vh] max-h-[92vh] p-6 pt-10">
        <DialogTitle className="sr-only">Dolda inställningar</DialogTitle>

        <div className="grid min-h-0 flex-1 gap-6 lg:grid-cols-[minmax(240px,1fr)_minmax(420px,2fr)_minmax(300px,1.4fr)]">
          <div className="flex min-h-0 flex-col gap-4">
            <div className="flex min-h-0 flex-1 flex-col space-y-1">
              <Label htmlFor="hidden-teachers">Lärare (en per rad)</Label>
              <Textarea
                id="hidden-teachers"
                value={teacherText}
                onChange={event => setTeacherText(event.target.value)}
                className="min-h-0 flex-1 resize-none"
              />
            </div>
            <div className="flex min-h-0 flex-1 flex-col space-y-1">
              <Label htmlFor="hidden-rooms">Salar (en per rad)</Label>
              <Textarea
                id="hidden-rooms"
                value={roomText}
                onChange={event => setRoomText(event.target.value)}
                className="min-h-0 flex-1 resize-none"
              />
            </div>
          </div>

          <div className="flex min-h-0 flex-col">
            <div className="shrink-0">
              <Label>När lärare inte kan schemaläggas</Label>
              <p className="text-xs text-gray-500">
                Klicka på en dag för att spärra hela dagen. Pilen fäller ut förmiddag
                (ryms helt före 12) och eftermiddag (börjar 12 eller senare). En post som
                krockar placeras ändå, men du får en varning.
              </p>
            </div>

            {teacherRows.length === 0 ? (
              <p className="mt-2 text-sm text-gray-500 italic">
                Lägg till lärare i listan till vänster för att kunna spärra dagar.
              </p>
            ) : (
              <div className="mt-2 min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
                {teacherRows.map(teacher => (
                  <TeacherAvailabilityRow
                    key={teacher}
                    teacher={teacher}
                    days={availability[teacher] ?? {}}
                    onChange={(day, next) => {
                      setAvailability(prev => toggleBlock(prev, teacher, day, next));
                    }}
                  />
                ))}
              </div>
            )}

            <div className="mt-3 shrink-0 border-t-2 border-black pt-3">
              <Label htmlFor="planning-min-gap">Kortaste planeringspass</Label>
              <div className="mt-1 flex items-center gap-2">
                <Input
                  id="planning-min-gap"
                  type="number"
                  min={0}
                  max={240}
                  step={5}
                  value={minGapText}
                  onChange={event => setMinGapText(event.target.value)}
                  className="h-9 w-24"
                />
                <span className="text-xs text-gray-500">minuter</span>
              </div>
              <p className="mt-1 text-xs text-gray-500">
                Söker du t.ex. &quot;Tobias planering&quot; visas bara luckor som är minst
                så här långa. Spärrade dagar ovan räknas som lediga och ger ingen
                planeringstid alls.
              </p>
            </div>
          </div>

          <div className="flex min-h-0 flex-col">
            <div className="shrink-0 mb-2">
              <Label>Färg efter ord i titeln</Label>
              <p className="text-xs text-gray-500">
                Innehåller titeln ordet får posten den valda färgen. Hela ord matchar,
                så &quot;prov&quot; träffar &quot;Prov kap 3&quot; men inte &quot;Provisorisk&quot;.
                Matchar flera regler vinner den översta, och färgen slår igenom även på
                poster du färgat för hand.
              </p>
            </div>
            <ColorTriggerList triggers={triggers} onChange={setTriggers} />

            <div className="mt-3 shrink-0 border-t-2 border-black pt-3">
              <Label htmlFor="export-excludes">Uteslut från nästa print/export</Label>
              <Textarea
                id="export-excludes"
                value={excludeText}
                onChange={event => setExcludeText(event.target.value)}
                placeholder="ATP; AK MÖTE"
                className="mt-1 h-20 resize-none"
              />
              <p className="mt-1 text-xs text-gray-500">
                Titlar separerade med semikolon eller radbrytning. De syns kvar i
                schemat men saknas i filen. Hela titeln måste stämma, med{' '}
                <code>*</code> som jokertecken: <code>AK*</code> tar både AK MÖTE
                och AK-planering. <strong>Listan töms när du exporterat.</strong>
              </p>
            </div>
          </div>
        </div>

        <DialogFooter className="shrink-0">
          <Button variant="neutral" onClick={handleSave} className="border-2 border-black">
            Spara
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type CategoryDebugPanelProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: string[];
  missingCount: number;
  totalCount: number;
};

export function CategoryDebugPanel({
  open,
  onOpenChange,
  categories,
  missingCount,
  totalCount
}: CategoryDebugPanelProps) {
  const hasCategories = categories.length > 0;
  const hasActivities = totalCount > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Kategorier (debug)</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <div>
            <p className="font-semibold">Unika kategorier ({categories.length})</p>
            {hasCategories ? (
              <ul className="list-disc pl-5">
                {categories.map(category => (
                  <li key={category}>{category}</li>
                ))}
              </ul>
            ) : (
              <p className="text-gray-500">Inga kategorier hittades.</p>
            )}
          </div>
          <div>
            <p className="font-semibold">Aktiviteter utan kategori</p>
            <p>{missingCount} av {totalCount}</p>
          </div>
          {!hasActivities && (
            <p className="text-gray-500">Inga aktiviteter laddade ännu.</p>
          )}
          <p className="text-xs text-gray-500">
            Öppna via Ctrl + Shift + C.
          </p>
        </div>
        <DialogFooter>
          <Button variant="neutral" onClick={() => onOpenChange(false)} className="border-2 border-black">
            Stäng
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
