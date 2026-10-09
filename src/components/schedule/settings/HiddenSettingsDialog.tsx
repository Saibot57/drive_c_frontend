'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { DEFAULT_COURSE_COLOR } from '@/config/plannerConstants';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { HiddenSettingsDraft } from '@/hooks/useHiddenSettings';
import { ColorTriggerRule, RestrictionRule, RoomTriggerRule, TeacherAvailability } from '@/types/schedule';
import { parseExcludeList } from '@/utils/exportExclusions';
import { sanitizePlanningMinGap, sanitizePlanningTime } from '@/utils/planningTime';
import { minutesToTime } from '@/utils/scheduleTime';
import { TeacherAvailabilityRow, toggleBlock } from './TeacherAvailabilityRow';
import { TriggerRuleList } from './TriggerRuleList';

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

function ColorTriggerList({ triggers, onChange }: {
  triggers: ColorTriggerRule[];
  onChange: (next: ColorTriggerRule[]) => void;
}) {
  return (
    <TriggerRuleList
      rules={triggers}
      onChange={onChange}
      createRule={() => ({ word: '', color: DEFAULT_COURSE_COLOR })}
      emptyText="Inga färgregler ännu."
      addLabel="Lägg till färgregel"
      wordPlaceholder="Ord i titeln, t.ex. prov"
      wordAriaLabel={index => `Triggerord ${index + 1}`}
      removeAriaLabel={index => `Ta bort regel ${index + 1}`}
      listClassName="max-h-64"
      renderValue={(trigger, index, update) => (
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
            onChange={event => update({ color: event.target.value })}
          />
        </label>
      )}
    />
  );
}

const ROOM_TRIGGER_OPTIONS_ID = 'room-trigger-options';

function RoomTriggerList({ triggers, onChange, rooms }: {
  triggers: RoomTriggerRule[];
  onChange: (next: RoomTriggerRule[]) => void;
  /** Sallistan, som förslag i stället för ett fritextfält att stava fel i. */
  rooms: string[];
}) {
  return (
    <TriggerRuleList
      rules={triggers}
      onChange={onChange}
      createRule={() => ({ word: '', room: '' })}
      emptyText="Inga salsregler ännu."
      addLabel="Lägg till salsregel"
      wordPlaceholder="Ord i titeln, t.ex. idrott"
      wordAriaLabel={index => `Salsregel ${index + 1}, ord`}
      removeAriaLabel={index => `Ta bort salsregel ${index + 1}`}
      listClassName="max-h-48"
      renderValue={(trigger, index, update) => (
        <Input
          value={trigger.room}
          onChange={event => update({ room: event.target.value })}
          placeholder="Sal"
          list={ROOM_TRIGGER_OPTIONS_ID}
          aria-label={`Sal för ${trigger.word || `regel ${index + 1}`}`}
          className="w-28 shrink-0"
        />
      )}
    >
      <datalist id={ROOM_TRIGGER_OPTIONS_ID}>
        {rooms.map(room => <option key={room} value={room} />)}
      </datalist>
    </TriggerRuleList>
  );
}

type HiddenSettingsDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teachers: string[];
  rooms: string[];
  teacherAvailability: TeacherAvailability;
  colorTriggers: ColorTriggerRule[];
  roomTriggers: RoomTriggerRule[];
  planningMinGap: number;
  exportExcludes: string[];
  pasteProtect: string[];
  planningStartMinutes: number | null;
  planningEndMinutes: number | null;
  /**
   * Ämnen som inte får ligga samtidigt. Hålls utanför `HiddenSettingsDraft`
   * med flit: de sparas inte i localStorage, och utkastet ska inte kunna
   * följa med till något som speglar inställningarna vidare, som den publika
   * länken.
   */
  restrictions: RestrictionRule[];
  onSave: (next: HiddenSettingsDraft, restrictions: RestrictionRule[]) => void;
};

/**
 * Planerarens inställningar: lärare, salar, spärrar, planeringstid och
 * reglerna för färg, sal, export och inklistring. Öppnas med Ctrl+Shift+K.
 */
export function HiddenSettingsDialog({
  open,
  onOpenChange,
  teachers,
  rooms,
  teacherAvailability,
  colorTriggers,
  roomTriggers,
  planningMinGap,
  exportExcludes,
  pasteProtect,
  planningStartMinutes,
  planningEndMinutes,
  restrictions,
  onSave
}: HiddenSettingsDialogProps) {
  const [teacherText, setTeacherText] = useState('');
  const [roomText, setRoomText] = useState('');
  const [availability, setAvailability] = useState<TeacherAvailability>({});
  const [triggers, setTriggers] = useState<ColorTriggerRule[]>([]);
  const [roomRules, setRoomRules] = useState<RoomTriggerRule[]>([]);
  const [minGapText, setMinGapText] = useState('');
  const [excludeText, setExcludeText] = useState('');
  const [protectText, setProtectText] = useState('');
  const [startText, setStartText] = useState('');
  const [endText, setEndText] = useState('');
  const [rules, setRules] = useState<RestrictionRule[]>([]);
  const [ruleA, setRuleA] = useState('');
  const [ruleB, setRuleB] = useState('');

  useEffect(() => {
    if (!open) return;
    setTeacherText(teachers.join('\n'));
    setRoomText(rooms.join('\n'));
    setAvailability(teacherAvailability);
    setTriggers(colorTriggers);
    setRoomRules(roomTriggers);
    setMinGapText(String(planningMinGap));
    setExcludeText(exportExcludes.join('; '));
    setProtectText(pasteProtect.join('; '));
    setStartText(planningStartMinutes === null ? '' : minutesToTime(planningStartMinutes));
    setEndText(planningEndMinutes === null ? '' : minutesToTime(planningEndMinutes));
    setRules(restrictions);
    setRuleA('');
    setRuleB('');
  }, [
    open,
    rooms,
    teachers,
    teacherAvailability,
    colorTriggers,
    roomTriggers,
    planningMinGap,
    exportExcludes,
    pasteProtect,
    planningStartMinutes,
    planningEndMinutes,
    restrictions
  ]);

  // Raderna följer textrutan direkt, så en nyss tillagd lärare går att
  // ställa in utan att man behöver spara och öppna panelen igen.
  const teacherRows = useMemo(() => sanitizeHiddenList(teacherText), [teacherText]);

  const handleSave = () => {
    onSave({
      teachers: teacherRows,
      rooms: sanitizeHiddenList(roomText),
      teacherAvailability: availability,
      colorTriggers: triggers,
      roomTriggers: roomRules,
      planningMinGap: sanitizePlanningMinGap(minGapText),
      exportExcludes: parseExcludeList(excludeText),
      pasteProtect: parseExcludeList(protectText),
      planningStartMinutes: sanitizePlanningTime(startText),
      planningEndMinutes: sanitizePlanningTime(endText)
    }, rules);
    onOpenChange(false);
  };

  const handleAddRule = () => {
    const subjectA = ruleA.trim();
    const subjectB = ruleB.trim();
    if (!subjectA || !subjectB) return;
    setRules(prev => [...prev, { id: uuidv4(), subjectA, subjectB }]);
    setRuleA('');
    setRuleB('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* Nära fullskärm. Kolumnerna scrollar var för sig så fönstret självt
          aldrig behöver scrollas. pt-10 ger plats åt stängkrysset, som annars
          hamnar ovanpå innehållet nu när rubriken är dold. */}
      <DialogContent className="flex flex-col gap-4 w-[96vw] max-w-none h-[92vh] max-h-[92vh] p-6 pt-10">
        <DialogTitle className="sr-only">Inställningar</DialogTitle>

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
              <div className="flex flex-wrap items-end gap-3">
                <div>
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
                      className="h-9 w-20"
                    />
                    <span className="text-xs text-gray-500">min</span>
                  </div>
                </div>
                <div>
                  <Label htmlFor="planning-start">Planeringstid från</Label>
                  <Input
                    id="planning-start"
                    value={startText}
                    onChange={event => setStartText(event.target.value)}
                    placeholder="08:00"
                    className="mt-1 h-9 w-24"
                  />
                </div>
                <div>
                  <Label htmlFor="planning-end">Planeringstid till</Label>
                  <Input
                    id="planning-end"
                    value={endText}
                    onChange={event => setEndText(event.target.value)}
                    placeholder="sista lektionen"
                    className="mt-1 h-9 w-24"
                  />
                </div>
              </div>
              <p className="mt-2 text-xs text-gray-500">
                Söker du t.ex. &quot;Tobias planering&quot; visas bara luckor som är minst
                så här långa. Spärrade dagar ovan räknas som lediga och ger ingen
                planeringstid alls.
              </p>
              <p className="mt-1 text-xs text-gray-500">
                Arbetsdagen räknas från 08:00 till dagens sista lektion. Fyller du i
                en tid gäller den i stället, varje dag och åt båda hållen: den både
                förlänger och kapar. Tomma fält betyder standard.
              </p>
            </div>
          </div>

          {/* Kolumnen scrollar i sin helhet: sektionerna är fler än höjden
              rymmer, och var och en har redan en egen tak-höjd. */}
          <div className="flex min-h-0 flex-col overflow-y-auto pr-1">
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
              <div className="mb-2">
                <Label>Sal efter ord i titeln</Label>
                <p className="text-xs text-gray-500">
                  Samma ordmatchning som färgreglerna, men tvärtom vad gäller vem som
                  vinner: salen fylls bara på poster där <strong>salfältet är tomt</strong>.
                  Har du skrivit in en sal står den kvar. Töm fältet så tar regeln över
                  igen. Posten ändras aldrig i databasen — tar du bort regeln är salen
                  borta, inte inskriven.
                </p>
              </div>
              <RoomTriggerList triggers={roomRules} onChange={setRoomRules} rooms={rooms} />
            </div>

            <div className="mt-3 shrink-0 border-t-2 border-black pt-3">
              <Label htmlFor="restriction-a">Får inte ligga samtidigt</Label>
              <p className="text-xs text-gray-500">
                Två ämnen som inte får ligga på samma tid. <code>*</code> matchar
                början av titeln. En post som skulle krocka går inte att placera.
                Reglerna sparas i säkerhetskopian (JSON) men inte mellan
                sidladdningar.
              </p>
              <div className="mt-2 flex gap-2">
                <Input
                  id="restriction-a"
                  aria-label="Första ämnet"
                  placeholder="Matte*"
                  value={ruleA}
                  onChange={event => setRuleA(event.target.value)}
                  onKeyDown={event => {
                    if (event.key === 'Enter') { event.preventDefault(); handleAddRule(); }
                  }}
                  className="h-9"
                />
                <Input
                  aria-label="Andra ämnet"
                  placeholder="Svenska*"
                  value={ruleB}
                  onChange={event => setRuleB(event.target.value)}
                  onKeyDown={event => {
                    if (event.key === 'Enter') { event.preventDefault(); handleAddRule(); }
                  }}
                  className="h-9"
                />
                <Button
                  type="button"
                  variant="neutral"
                  onClick={handleAddRule}
                  disabled={!ruleA.trim() || !ruleB.trim()}
                  className="h-9 shrink-0"
                >
                  Lägg till
                </Button>
              </div>
              {rules.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {rules.map(rule => (
                    <li key={rule.id} className="flex items-center justify-between gap-2 rounded bg-gray-50 px-2 py-1 text-sm">
                      <span>{rule.subjectA} <span className="text-gray-500">och</span> {rule.subjectB}</span>
                      <button
                        type="button"
                        onClick={() => setRules(prev => prev.filter(item => item.id !== rule.id))}
                        className="rounded p-1 hover:bg-gray-200"
                        aria-label={`Ta bort regeln ${rule.subjectA} och ${rule.subjectB}`}
                        title="Ta bort regeln"
                      >
                        <X size={14} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

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

            <div className="mt-3 shrink-0 border-t-2 border-black pt-3">
              <Label htmlFor="paste-protect">Skydda från inklistring</Label>
              <Textarea
                id="paste-protect"
                value={protectText}
                onChange={event => setProtectText(event.target.value)}
                placeholder="Lunch; Paus; Rast"
                className="mt-1 h-20 resize-none"
              />
              <p className="mt-1 text-xs text-gray-500">
                Poster med de här titlarna får inga inklistrade anteckningar när du
                markerar flera på en gång — de ritas gråstreckade i ramen och räknas
                bort. Samma syntax som ovan. Väljer du <em>Klistra in anteckningar</em>{' '}
                på just en sådan post sker det ändå: skyddet finns för svepen.{' '}
                <strong>Den här listan står kvar.</strong>
              </p>
            </div>
          </div>
        </div>

        <DialogFooter className="shrink-0">
          <Button variant="neutral" type="button" onClick={() => onOpenChange(false)}>
            Avbryt
          </Button>
          <Button onClick={handleSave}>
            Spara
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
