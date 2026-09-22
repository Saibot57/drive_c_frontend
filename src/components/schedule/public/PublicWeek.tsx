import { PLANNER_DAYS } from '@/components/schedule/constants';
import { ScheduledEntry } from '@/types/schedule';
import { DayAgenda, groupByDay, Resolvers } from './DayAgenda';

type Props = Resolvers & {
  entries: ScheduledEntry[];
};

/**
 * Datorvyn: fem dagkolumner, var och en samma lista som mobilvyn.
 *
 * Den ersätter en förminskad bild av PDF:en. Den bilden krympte med fönstret —
 * vid 800 px var texten runt 6 px — och delade varje dag i tre smala kolumner
 * för de parallella passen, så orden bröts mitt i ("Studieverk-stad"). Här
 * behåller texten sin storlek och de parallella passen staplas.
 *
 * Priset är att höjden inte längre följer klockan: ett långt pass tar lika
 * mycket plats som ett kort. Klockskalan är just det som tvingar fram smala
 * kolumner, så den fick gå. Tiden står i stället utskriven vid varje grupp.
 */
export default function PublicWeek({ entries, resolveColor, resolveRoom }: Props) {
  const byDay = groupByDay(entries);

  return (
    <div className="grid grid-cols-5 gap-4">
      {PLANNER_DAYS.map(day => (
        <section key={day} className="min-w-0" aria-label={day}>
          <h2 className="mb-3 border-b-2 border-black pb-1 text-lg font-bold">{day}</h2>
          <DayAgenda
            entries={byDay.get(day) ?? []}
            resolveColor={resolveColor}
            resolveRoom={resolveRoom}
          />
        </section>
      ))}
    </div>
  );
}
