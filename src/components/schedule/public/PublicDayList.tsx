'use client';

import { useMemo, useState } from 'react';
import { PLANNER_DAYS } from '@/components/schedule/constants';
import { ScheduledEntry } from '@/types/schedule';
import { DayAgenda, groupByDay, Resolvers } from './DayAgenda';

type Props = Resolvers & {
  entries: ScheduledEntry[];
};

const SHORT_DAY: Record<string, string> = {
  Måndag: 'Mån',
  Tisdag: 'Tis',
  Onsdag: 'Ons',
  Torsdag: 'Tor',
  Fredag: 'Fre',
};

/** Dagens veckodag, eller måndag på helgen — då är det nästa vecka man vill se. */
const todayInPlanner = (): string => {
  const index = new Date().getDay() - 1;
  return PLANNER_DAYS[index] ?? PLANNER_DAYS[0];
};

/**
 * En dag i taget, med dagens dag förvald. Används på allt som är för smalt för
 * fem läsbara kolumner — telefonen, men också ett halvt laptopfönster.
 */
export default function PublicDayList({ entries, resolveColor, resolveRoom }: Props) {
  const [day, setDay] = useState<string>(todayInPlanner);
  const byDay = useMemo(() => groupByDay(entries), [entries]);

  return (
    // Smalare än fönstret på en surfplatta eller ett halvt laptopfönster, så
    // raderna inte blir för långa att läsa — men vänsterställd, så att kanten
    // linjerar med rubriken ovanför.
    <div className="max-w-2xl">
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

      <DayAgenda
        entries={byDay.get(day) ?? []}
        resolveColor={resolveColor}
        resolveRoom={resolveRoom}
      />
    </div>
  );
}
