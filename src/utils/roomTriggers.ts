import { RoomTriggerRule } from '@/types/schedule';
import { containsWords, tokenize } from '@/utils/wordTriggers';

/**
 * Salsregler fungerar tvärtemot färgreglerna. En färgregel slår igenom även
 * på poster du färgat för hand; en salsregel viker för varje sal som står
 * ifylld. Ett tomt salfält är alltså det som säger "styr den här åt mig",
 * och det är också vägen tillbaka: töm fältet så tar regeln över igen.
 *
 * Regeln skriver aldrig in något i posten. `room` i databasen står orörd, så
 * en borttagen regel återlämnar posten precis som den var.
 */

/** Plockar bort skräp ur data som lästs från localStorage eller en JSON-fil. */
export const sanitizeRoomTriggers = (input: unknown): RoomTriggerRule[] => {
  if (!Array.isArray(input)) return [];

  return input.reduce<RoomTriggerRule[]>((collected, raw, index) => {
    if (!raw || typeof raw !== 'object') return collected;
    const candidate = raw as Record<string, unknown>;
    const word = typeof candidate.word === 'string' ? candidate.word.trim() : '';
    const room = typeof candidate.room === 'string' ? candidate.room.trim() : '';
    // En regel utan sal skulle inte kunna göra något men ändå fånga ordet före
    // reglerna under den, så den räknas inte som en regel alls.
    if (!word || !room) return collected;

    collected.push({
      id: typeof candidate.id === 'string' && candidate.id ? candidate.id : `room-trigger-${index}`,
      word,
      room
    });
    return collected;
  }, []);
};

/** Första regeln som matchar vinner, så listans ordning är prioritetsordning. */
export const findRoomTrigger = (
  title: string,
  triggers: RoomTriggerRule[]
): RoomTriggerRule | null => {
  if (triggers.length === 0) return null;
  const titleWords = tokenize(title ?? '');
  if (titleWords.length === 0) return null;
  return triggers.find(trigger => containsWords(titleWords, tokenize(trigger.word))) ?? null;
};

/**
 * Bygger en salsuppslagning som används när korten ritas. Orden delas upp en
 * gång per regeländring i stället för en gång per post.
 */
export const createRoomResolver = (triggers: RoomTriggerRule[]) => {
  const prepared = triggers
    .map(trigger => ({ room: trigger.room, words: tokenize(trigger.word) }))
    .filter(trigger => trigger.words.length > 0);

  return (title: string, currentRoom?: string): string => {
    // Före allt annat, och med flit: en ifylld sal är ett beslut och ska
    // varken kosta en titeluppdelning eller kunna skrivas över.
    if (currentRoom && currentRoom.trim()) return currentRoom;
    if (prepared.length === 0) return '';
    const titleWords = tokenize(title ?? '');
    if (titleWords.length === 0) return '';
    const hit = prepared.find(trigger => containsWords(titleWords, trigger.words));
    return hit ? hit.room : '';
  };
};
