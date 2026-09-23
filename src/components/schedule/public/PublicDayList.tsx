'use client';

import { useMemo, useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { PLANNER_DAYS } from '@/components/schedule/constants';
import { ScheduledEntry } from '@/types/schedule';
import { splitTeacherNames } from '@/utils/scheduleStats';
import { timeToMinutes } from '@/utils/scheduleTime';

type Props = {
  entries: ScheduledEntry[];
  resolveColor: (title: string, fallbackColor: string) => string;
  resolveRoom: (title: string, currentRoom?: string) => string;
};

const SHORT_DAY: Record<string, string> = {
  Måndag: 'Mån',
  Tisdag: 'Tis',
  Onsdag: 'Ons',
  Torsdag: 'Tor',
  Fredag: 'Fre',
};

const extractUrl = (value?: string) => {
  if (!value) return null;
  const match = value.match(/https?:\/\/[^\s]+/i);
  return match ? match[0] : null;
};

type TimeGroup = {
  startTime: string;
  /** Satt när alla pass i gruppen slutar samtidigt, annars bär korten sin egen tid. */
  sharedEndTime: string | null;
  entries: ScheduledEntry[];
};

/**
 * Pass som börjar samtidigt samlas under en gemensam tidsrubrik.
 *
 * I veckorutnätet står parallella pass bredvid varandra, och att de pågår
 * samtidigt syns på en gång. En ren lista på telefonen ser i stället ut som
 * tre pass i rad — en deltagare kan läsa "Ma 1, Ma Grund, Studieverkstad" som
 * ett schema att gå igenom i tur och ordning. Rubriken är alltså inte
 * dekoration utan det som bär den informationen över till listformen.
 *
 * Grupperingen går på starttiden, inte på överlapp: det är den deltagaren
 * läser av, och den ger samma indelning varje gång. Ett pass som går omlott
 * med ett annat men börjar senare får därför en egen rubrik.
 */
const groupByStart = (entries: ScheduledEntry[]): TimeGroup[] => {
  const groups: TimeGroup[] = [];

  for (const entry of entries) {
    const current = groups[groups.length - 1];
    if (current && current.startTime === entry.startTime) {
      current.entries.push(entry);
      if (current.sharedEndTime !== entry.endTime) current.sharedEndTime = null;
      continue;
    }
    groups.push({ startTime: entry.startTime, sharedEndTime: entry.endTime, entries: [entry] });
  }

  return groups;
};

/** Dagens veckodag, eller måndag på helgen — då är det nästa vecka man vill se. */
const todayInPlanner = (): string => {
  const index = new Date().getDay() - 1;
  return PLANNER_DAYS[index] ?? PLANNER_DAYS[0];
};

/**
 * Dagslistan: en dag i taget som lista, med dagens dag förvald.
 *
 * Var mobilvyn innan rutnätet av riktig text tog över. Ligger kvar bakom
 * `?vy=lista` så att kollegorna kan jämföra den med dagsschemat i rutnätet
 * på sina telefoner, innan det avgörs vilken mobilen ska ha.
 */
export default function PublicDayList({ entries, resolveColor, resolveRoom }: Props) {
  const [day, setDay] = useState<string>(todayInPlanner);

  const byDay = useMemo(() => {
    const grouped = new Map<string, ScheduledEntry[]>();
    for (const name of PLANNER_DAYS) grouped.set(name, []);
    for (const entry of entries) grouped.get(entry.day)?.push(entry);
    grouped.forEach(list =>
      list.sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime))
    );
    return grouped;
  }, [entries]);

  const groups = useMemo(() => groupByStart(byDay.get(day) ?? []), [byDay, day]);

  return (
    <div>
      <div role="tablist" aria-label="Veckodag" className="grid grid-cols-5 gap-1.5">
        {PLANNER_DAYS.map(name => {
          const isActive = name === day;
          const count = byDay.get(name)?.length ?? 0;
          return (
            <button
              key={name}
              role="tab"
              aria-selected={isActive}
              onClick={() => setDay(name)}
              className={`rounded border-2 border-black py-2 text-sm font-bold ${
                isActive ? 'bg-black text-white' : 'bg-white text-black'
              } ${count === 0 && !isActive ? 'opacity-50' : ''}`}
            >
              {SHORT_DAY[name] ?? name}
            </button>
          );
        })}
      </div>

      <h2 className="mt-4 mb-2 text-lg font-bold">{day}</h2>

      {groups.length === 0 ? (
        <p className="rounded border-2 border-dashed border-gray-300 p-4 text-center text-sm text-gray-500">
          Inga pass den här dagen.
        </p>
      ) : (
        <div className="space-y-4">
          {groups.map(group => (
            <section key={`${day}-${group.startTime}`}>
              <h3 className="mb-1.5 flex items-baseline gap-2">
                <span className="font-mono text-sm font-bold tabular-nums">
                  {group.startTime}
                  {group.sharedEndTime ? `–${group.sharedEndTime}` : ''}
                </span>
                {group.entries.length > 1 && (
                  <span className="text-xs font-bold uppercase tracking-wide text-gray-500">
                    {group.entries.length} parallella
                  </span>
                )}
              </h3>
              <ul className="space-y-2">
                {group.entries.map(entry => {
                  const url = extractUrl(entry.category);
                  const room = resolveRoom(entry.title, entry.room);
                  const teachers = splitTeacherNames(entry.teacher);
                  return (
                    <li
                      key={entry.instanceId}
                      className="flex overflow-hidden rounded border-2 border-black bg-white"
                    >
                      <div
                        className="w-2 shrink-0"
                        style={{ backgroundColor: resolveColor(entry.title, entry.color) }}
                        aria-hidden
                      />
                      <div className="min-w-0 flex-1 p-3">
                        <div className="flex items-baseline justify-between gap-3">
                          <span className="font-bold leading-tight">{entry.title}</span>
                          {/* Tiden står i rubriken, utom när passen i gruppen
                              slutar olika — då hör den hemma på kortet. */}
                          {!group.sharedEndTime && (
                            <span className="shrink-0 font-mono text-sm font-bold tabular-nums">
                              {entry.startTime}–{entry.endTime}
                            </span>
                          )}
                        </div>
                        {(teachers.length > 0 || room) && (
                          <div className="mt-0.5 text-sm text-gray-700">
                            {[teachers.join(', '), room].filter(Boolean).join(' · ')}
                          </div>
                        )}
                        {entry.notes && (
                          <p className="mt-1.5 whitespace-pre-line text-sm text-gray-800">{entry.notes}</p>
                        )}
                        {url && (
                          <a
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-1.5 inline-flex items-center gap-1 text-sm font-bold underline"
                          >
                            <ExternalLink size={14} /> Uppgift
                          </a>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
