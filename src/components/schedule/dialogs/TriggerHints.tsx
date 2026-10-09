'use client';

import React from 'react';
import { ColorTriggerRule, RoomTriggerRule } from '@/types/schedule';
import { findColorTrigger } from '@/utils/colorTriggers';
import { findRoomTrigger } from '@/utils/roomTriggers';

/**
 * En färgregel slår igenom när kortet ritas, så färgväljaren har ingen synlig
 * effekt så länge titeln matchar. Säg det i stället för att låta användaren
 * undra.
 */
export function ColorTriggerHint({ title, colorTriggers }: {
  title: string;
  colorTriggers: ColorTriggerRule[];
}) {
  const trigger = findColorTrigger(title ?? '', colorTriggers);
  if (!trigger) return null;
  return (
    <p className="flex items-center gap-2 text-xs text-gray-600 kron:text-ui-muted">
      <span
        className="h-3 w-3 shrink-0 rounded-full border border-black"
        style={{ backgroundColor: trigger.color }}
      />
      Färgen styrs av färgregeln &quot;{trigger.word}&quot; och går inte att ändra här.
    </p>
  );
}

/**
 * Motsatsen till färghinten: salsregeln gäller bara medan fältet är tomt, så
 * hinten säger vad som händer och hur man tar över — inte att fältet är låst.
 */
export function RoomTriggerHint({ title, room, roomTriggers }: {
  title: string;
  room: string;
  roomTriggers: RoomTriggerRule[];
}) {
  if (room && room.trim()) return null;
  const trigger = findRoomTrigger(title ?? '', roomTriggers);
  if (!trigger) return null;
  return (
    <p className="text-xs text-gray-600 kron:text-ui-muted">
      Salen fylls av regeln &quot;{trigger.word}&quot; → <strong>{trigger.room}</strong>.
      Skriv en sal här för att styra över.
    </p>
  );
}
