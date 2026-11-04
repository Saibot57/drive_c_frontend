import React from 'react';
import { cn } from '@/lib/utils';
import type { Stamp, StampColor } from '@/utils/narvaro';

/** Hela klassnamn, så att Tailwind hittar dem. Färgerna står i tokens.css. */
export const STAMP_BG: Record<StampColor, string> = {
  green: 'bg-ui-mark-green',
  yellow: 'bg-ui-mark-yellow',
  blue: 'bg-ui-mark-blue',
  pink: 'bg-ui-mark-pink',
  lilac: 'bg-ui-mark-lilac',
  grey: 'bg-ui-mark-grey',
};

export function StampTag({ stamp, small }: { stamp: Stamp | undefined; small?: boolean }) {
  if (!stamp) return null;
  return (
    <span
      className={cn(
        'rounded-ui-sm border border-ui-line px-1.5 font-bold leading-snug text-ui-mark-fg',
        small ? 'text-2xs' : 'text-xs',
        STAMP_BG[stamp.color],
      )}
    >
      {stamp.label}
    </span>
  );
}
