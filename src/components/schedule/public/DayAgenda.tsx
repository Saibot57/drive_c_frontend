import { ExternalLink, MapPin } from 'lucide-react';
import { PLANNER_DAYS } from '@/components/schedule/constants';
import { ScheduledEntry } from '@/types/schedule';
import { splitTeacherNames } from '@/utils/scheduleStats';
import { timeToMinutes } from '@/utils/scheduleTime';

/**
 * En dags pass som läsbar lista. Delas av mobilvyn (en dag i taget) och
 * datorvyn (fem dagar bredvid varandra), så att en deltagare som byter skärm
 * läser samma sak på samma sätt.
 */

export type Resolvers = {
  resolveColor: (title: string, fallbackColor: string) => string;
  resolveRoom: (title: string, currentRoom?: string) => string;
};

type TimeGroup = {
  startTime: string;
  /** Satt när alla pass i gruppen slutar samtidigt, annars bär korten sin egen tid. */
  sharedEndTime: string | null;
  /**
   * Satt när alla pass i en grupp om flera har samma anteckning. Den står då en
   * gång under tidsrubriken i stället för på varje kort — "Boksamtal" tre
   * gånger i rad är tre gånger att läsa för en enda upplysning.
   */
  sharedNote: string | null;
  entries: ScheduledEntry[];
};

const extractUrl = (value?: string) => {
  if (!value) return null;
  const match = value.match(/https?:\/\/[^\s]+/i);
  return match ? match[0] : null;
};

/** Veckans pass per dag, i tidsordning. Dagar utan pass finns med som tomma listor. */
export const groupByDay = (entries: ScheduledEntry[]) => {
  const grouped = new Map<string, ScheduledEntry[]>();
  for (const name of PLANNER_DAYS) grouped.set(name, []);
  for (const entry of entries) grouped.get(entry.day)?.push(entry);
  grouped.forEach(list =>
    list.sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime))
  );
  return grouped;
};

/**
 * Pass som börjar samtidigt samlas under en gemensam tidsrubrik.
 *
 * I ett tidsrutnät står parallella pass bredvid varandra och att de pågår
 * samtidigt syns direkt. I en lista ser de annars ut som pass i tur och ordning
 * — rubriken är det som bär den informationen över till listformen.
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
    groups.push({
      startTime: entry.startTime,
      sharedEndTime: entry.endTime,
      sharedNote: null,
      entries: [entry],
    });
  }

  for (const group of groups) {
    if (group.entries.length < 2) continue;
    // Samma ordning i varje grupp, oavsett i vilken ordning passen lades in i
    // planeraren. Den som går Tema Oliv ska hitta den på samma plats varje
    // gång — i datan kom den ibland först, ibland sist.
    group.entries.sort((a, b) => a.title.localeCompare(b.title, 'sv', { numeric: true }));
    const first = group.entries[0].notes?.trim();
    if (first && group.entries.every(entry => entry.notes?.trim() === first)) {
      group.sharedNote = first;
    }
  }

  return groups;
};

type DayAgendaProps = Resolvers & {
  /** En dags pass, sorterade på starttid (som `groupByDay` ger dem). */
  entries: ScheduledEntry[];
};

export function DayAgenda({ entries, resolveColor, resolveRoom }: DayAgendaProps) {
  const groups = groupByStart(entries);

  if (groups.length === 0) {
    return (
      <p className="rounded border-2 border-dashed border-gray-300 p-4 text-center text-sm text-gray-500">
        Inga pass den här dagen.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {groups.map(group => (
        <section key={group.startTime}>
          <h3 className="mb-1.5 flex flex-wrap items-baseline gap-x-2">
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
          {group.sharedNote && (
            <p className="mb-1.5 whitespace-pre-line text-sm text-gray-800">{group.sharedNote}</p>
          )}
          <ul className="space-y-2">
            {group.entries.map(entry => (
              <EntryCard
                key={entry.instanceId}
                entry={entry}
                showTime={!group.sharedEndTime}
                showNotes={!group.sharedNote}
                resolveColor={resolveColor}
                resolveRoom={resolveRoom}
              />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

type EntryCardProps = Resolvers & {
  entry: ScheduledEntry;
  /** Tiden står i gruppens rubrik, utom när passen i gruppen slutar olika. */
  showTime: boolean;
  showNotes: boolean;
};

/**
 * Ett pass. Ordningen på raderna följer vad deltagaren letar efter: vad det
 * är, vart man ska gå, och sist vem som håller i det. Salen står därför före
 * läraren och i mörkare text — det är den man behöver på väg dit.
 */
function EntryCard({ entry, showTime, showNotes, resolveColor, resolveRoom }: EntryCardProps) {
  const url = extractUrl(entry.category);
  const room = resolveRoom(entry.title, entry.room);
  const teachers = splitTeacherNames(entry.teacher).join(', ');

  return (
    <li className="flex overflow-hidden rounded border-2 border-black bg-white">
      <div
        className="w-2 shrink-0"
        style={{ backgroundColor: resolveColor(entry.title, entry.color) }}
        aria-hidden
      />
      <div className="min-w-0 flex-1 px-3 py-2.5">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3">
          <span className="font-bold leading-snug [overflow-wrap:anywhere]">{entry.title}</span>
          {showTime && (
            <span className="font-mono text-sm font-bold tabular-nums">
              {entry.startTime}–{entry.endTime}
            </span>
          )}
        </div>
        {(room || teachers) && (
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-sm">
            {room && (
              <span className="inline-flex items-center gap-1 font-semibold text-gray-900">
                <MapPin size={13} className="shrink-0" aria-hidden />
                <span className="sr-only">Sal: </span>
                {room}
              </span>
            )}
            {teachers && <span className="text-gray-600">{teachers}</span>}
          </div>
        )}
        {showNotes && entry.notes && (
          <p className="mt-1.5 whitespace-pre-line text-sm text-gray-800">{entry.notes}</p>
        )}
        {url && (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1.5 inline-flex items-center gap-1 text-sm font-bold underline"
          >
            <ExternalLink size={14} aria-hidden /> Uppgift
          </a>
        )}
      </div>
    </li>
  );
}
