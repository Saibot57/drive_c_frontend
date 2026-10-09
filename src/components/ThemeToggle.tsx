'use client';

import { Contrast } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useUiTheme } from '@/hooks/useUiTheme';

const NAMES = { neo: 'Neo', kronberg: 'Kronberg' } as const;

/**
 * Byter mellan Neo och Kronberg med ett klick. Står direkt efter sidnamnet i
 * FeatureNavigation och följer därför med till alla vyer.
 *
 * Halvcirkeln vrids ett halvt varv i Kronberg. Vridningen sätts i CSS
 * (`kron:`), så den stämmer redan vid första ritningen, innan hooken vet
 * vilket tema som gäller.
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
        'inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md',
        'bg-transparent border-none cursor-pointer text-ui-muted',
        'hover:bg-black/5 hover:text-ui-ink transition-colors outline-none',
        'focus-visible:ring-2 focus-visible:ring-[var(--ui-focus)] focus-visible:ring-offset-2',
      )}
      aria-label={label}
      title={`Utseende: ${NAMES[theme]}. ${label}.`}
    >
      <Contrast
        size={16}
        aria-hidden
        className="transition-transform duration-300 motion-reduce:transition-none kron:rotate-180"
      />
    </button>
  );
}
