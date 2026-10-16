import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DayPatch } from '@/services/monthCalendarService';
import { createCalendarSaveQueue, type SaveStatus } from './calendarSaveQueue';

const DAY = '2026-10-15';
const DELAY = 600;

/** En fejkad server där varje anrop avgörs för hand, i valfri ordning. */
const fakeServer = () => {
  const calls: { patch: DayPatch; keepalive?: boolean; resolve: () => void; reject: (e: Error) => void }[] = [];
  let stored: string | undefined;
  const onSave = vi.fn((_key: string, patch: DayPatch, keepalive?: boolean) =>
    new Promise<void>((resolve, reject) => {
      calls.push({
        patch,
        keepalive,
        resolve: () => {
          if (patch.quick_text !== undefined) stored = patch.quick_text;
          resolve();
        },
        reject,
      });
    }),
  );
  return { calls, onSave, stored: () => stored };
};

const setup = () => {
  const server = fakeServer();
  const statuses: SaveStatus[] = [];
  const queue = createCalendarSaveQueue({
    delay: DELAY,
    onSave: server.onSave,
    onStatus: (status) => { statuses.push(status); },
  });
  return { server, queue, statuses };
};

/** Låter promise-kedjorna gå klart utan att flytta klockan. */
const settle = () => vi.advanceTimersByTimeAsync(0);

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); });

describe('createCalendarSaveQueue', () => {
  it('slår ihop ändringar under debouncen till en sparning', async () => {
    const { server, queue } = setup();
    queue.queue(DAY, { quick_text: 'a' });
    queue.queue(DAY, { quick_text: 'ab' });
    queue.queue(DAY, { highlights: [] });
    await vi.advanceTimersByTimeAsync(DELAY);

    expect(server.calls.map((c) => c.patch)).toEqual([{ quick_text: 'ab', highlights: [] }]);
  });

  // F2 i granskningen av dataintegritet 2026-10-15.
  it('skriver inte tillbaka en äldre text när den äldre sparningen misslyckas efter en nyare', async () => {
    const { server, queue } = setup();

    queue.queue(DAY, { quick_text: 'abc' });
    await vi.advanceTimersByTimeAsync(DELAY);
    expect(server.calls).toHaveLength(1);

    // Användaren skriver vidare medan "abc" hänger.
    queue.queue(DAY, { quick_text: 'abcd' });
    await vi.advanceTimersByTimeAsync(DELAY);
    // "abcd" väntar på "abc" i stället för att skickas parallellt.
    expect(server.calls).toHaveLength(1);

    server.calls[0].reject(new Error('nätfel'));
    await settle();
    // Det väntande skickas sammanslaget, och det nyare värdet vinner.
    expect(server.calls).toHaveLength(2);
    expect(server.calls[1].patch).toEqual({ quick_text: 'abcd' });
    server.calls[1].resolve();
    await settle();

    // Inget mer ligger kvar som kan skickas vid retry eller unmount.
    expect(queue.hasPending()).toBe(false);
    await queue.flushAll({ keepalive: true });
    expect(server.calls).toHaveLength(2);
    expect(server.stored()).toBe('abcd');
  });

  it('låter aldrig en äldre sparning landa efter en nyare för samma dag', async () => {
    const { server, queue } = setup();
    queue.queue(DAY, { quick_text: 'abc' });
    await vi.advanceTimersByTimeAsync(DELAY);
    queue.queue(DAY, { quick_text: 'abcd' });
    await vi.advanceTimersByTimeAsync(DELAY);

    // Vore båda i flykt kunde servern svara i omvänd ordning och sluta på "abc".
    expect(server.calls).toHaveLength(1);
    server.calls[0].resolve();
    await settle();
    server.calls[1].resolve();
    await settle();

    expect(server.calls.map((c) => c.patch.quick_text)).toEqual(['abc', 'abcd']);
    expect(server.stored()).toBe('abcd');
  });

  it('lägger tillbaka en misslyckad ändring så att retry skickar den', async () => {
    const { server, queue, statuses } = setup();
    queue.queue(DAY, { quick_text: 'abc' });
    await vi.advanceTimersByTimeAsync(DELAY);
    server.calls[0].reject(new Error('nätfel'));
    await settle();

    expect(statuses.at(-1)).toBe('error');
    expect(queue.hasPending()).toBe(true);

    const retried = queue.flushAll();
    await settle();
    expect(server.calls[1].patch).toEqual({ quick_text: 'abc' });
    server.calls[1].resolve();
    await retried;
    expect(statuses.at(-1)).toBe('saved');
    expect(queue.hasPending()).toBe(false);
  });

  it('håller olika dagar oberoende av varandra', async () => {
    const { server, queue } = setup();
    queue.saveNow('2026-10-15', { quick_text: 'mån' });
    queue.saveNow('2026-10-16', { quick_text: 'tis' });
    await settle();
    expect(server.calls.map((c) => c.patch.quick_text)).toEqual(['mån', 'tis']);
  });

  it('skickar direkt med keepalive när sidan stängs, även om en sparning är i flykt', async () => {
    const { server, queue } = setup();
    queue.queue(DAY, { quick_text: 'abc' });
    await vi.advanceTimersByTimeAsync(DELAY);
    queue.queue(DAY, { quick_text: 'abcd' });

    void queue.flushAll({ keepalive: true, immediate: true });
    await settle();
    expect(server.calls).toHaveLength(2);
    expect(server.calls[1]).toMatchObject({ patch: { quick_text: 'abcd' }, keepalive: true });
  });

  it('väntar in sparningen i flykt vid unmount i stället för att köra om den', async () => {
    const { server, queue } = setup();
    queue.queue(DAY, { quick_text: 'abc' });
    await vi.advanceTimersByTimeAsync(DELAY);
    queue.queue(DAY, { quick_text: 'abcd' });

    void queue.flushAll({ keepalive: true });
    queue.dispose();
    await settle();
    expect(server.calls).toHaveLength(1);

    server.calls[0].resolve();
    await settle();
    expect(server.calls[1]).toMatchObject({ patch: { quick_text: 'abcd' }, keepalive: true });
  });
});
