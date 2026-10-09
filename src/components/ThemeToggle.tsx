'use client';

import { cn } from '@/lib/utils';
import { useUiTheme } from '@/hooks/useUiTheme';

const NAMES = { neo: 'Neo', kronberg: 'Kronberg' } as const;

/**
 * Byter mellan Neo och Kronberg med ett klick. Står direkt efter sidnamnet i
 * FeatureNavigation och följer därför med till alla vyer.
 *
 * En liten ratt med ett streck som pekar åt vänster i Neo och åt höger i
 * Kronberg, och en lampa som tänds i Kronberg. Strecket och lampan har
 * --ui-lamp: svart i Neo, orange i Kronberg. Läget sätts i CSS (`kron:`), så
 * det stämmer redan vid första ritningen, innan hooken vet vilket tema som
 * gäller. Prototypen: https://claude.ai/artifact/GgssRgP6tSTHncrz2aLSxG (6).
 */
export function ThemeToggle() {
  const { theme, setTheme } = useUiTheme();
  const next = theme === 'kronberg' ? 'neo' : 'kronberg';
  const label = `Byt till ${NAMES[next]}`;

  return (
    <button
      type="button"
      onClick={() => setTheme(next)}
      className={cn(
        'inline-flex h-7 shrink-0 items-center gap-1 rounded-md px-1',
        'bg-transparent border-none cursor-pointer',
        'hover:bg-black/5 transition-colors outline-none',
        'focus-visible:ring-2 focus-visible:ring-[var(--ui-focus)] focus-visible:ring-offset-2',
      )}
      aria-label={label}
      title={`Utseende: ${NAMES[theme]}. ${label}.`}
    >
      {/* Skuggan ligger på hela ratten, så att den inte vrids med strecket. */}
      <svg
        viewBox="0 0 40 40"
        aria-hidden
        className="h-[22px] w-[22px] overflow-visible [filter:drop-shadow(1.5px_1.5px_0_#000)] kron:[filter:drop-shadow(0_1px_1px_rgba(31,32,34,0.22))]"
      >
        <circle
          cx="20"
          cy="20"
          r="15"
          className="fill-[var(--ui-paper)] stroke-[color:var(--ui-line)] stroke-[3] kron:stroke-[#B9B6AF] kron:stroke-[1.6]"
        />
        <g
          className={cn(
            '[transform-box:view-box] [transform-origin:20px_20px] -rotate-[50deg] kron:rotate-[50deg]',
            'transition-transform duration-500 ease-[cubic-bezier(0.3,1.45,0.5,1)] motion-reduce:transition-none',
          )}
        >
          <line x1="20" y1="14" x2="20" y2="7.5" strokeWidth="3" strokeLinecap="round" className="stroke-[color:var(--ui-lamp)]" />
        </g>
      </svg>
      {/* Lampan: en tom ring i Neo, tänd i Kronberg. */}
      <span
        aria-hidden
        className={cn(
          'h-1.5 w-1.5 rounded-full border border-[color:var(--ui-lamp)] transition-colors',
          'kron:border-0 kron:bg-[var(--ui-lamp)] kron:shadow-[0_0_4px_rgba(217,88,28,0.6)]',
        )}
      />
    </button>
  );
}
