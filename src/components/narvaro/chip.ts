import { cn } from '@/lib/utils';

/** Chippen i Närvarorutor: klass, skola, dag och pass. Svart när den är vald. */
export const chip = (pressed: boolean) => cn(
  'inline-flex items-baseline gap-1.5 rounded-ui-sm border-frame border-ui-line px-3 py-1 text-sm font-semibold transition-colors',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ui-focus)] focus-visible:ring-offset-2',
  pressed ? 'bg-ui-ink text-ui-paper' : 'bg-ui-paper text-ui-ink hover:bg-ui-surface-3',
);
