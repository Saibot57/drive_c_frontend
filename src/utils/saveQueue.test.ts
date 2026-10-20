import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createSaveQueue, type SaveQueueEvent } from './saveQueue';

const DELAY = 1000;

/** En fejkad server där varje anrop avgörs för hand, i valfri ordning. */
const setup = () => {
  const calls: { key: string; value: string; keepalive: boolean; resolve: () => void; reject: (e: Error) => void }[] = [];
  const events: SaveQueueEvent<string>[] = [];
  const queue = createSaveQueue<string, string>({
    delayMs: DELAY,
    save: (key, value, { keepalive }) => new Promise<string>((resolve, reject) => {
      calls.push({ key, value, keepalive, resolve: () => resolve(value), reject });
    }),
    onEvent: event => { events.push(event); },
  });
  return { queue, calls, events, sent: () => calls.map(c => c.value) };
};

/** Låter promise-kedjorna gå klart utan att flytta klockan. */
const settle = () => vi.advanceTimersByTimeAsync(0);

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); });

describe('createSaveQueue', () => {
  it('skickar bara det senaste värdet när det varit stilla', async () => {
    const { queue, sent } = setup();
    queue.schedule('A', 'v1');
    await vi.advanceTimersByTimeAsync(500);
    queue.schedule('A', 'v2');
    await vi.advanceTimersByTimeAsync(DELAY - 1);
    expect(sent()).toEqual([]);
    await vi.advanceTimersByTimeAsync(1);
    expect(sent()).toEqual(['v2']);
  });

  it('har högst ett anrop i flykt per nyckel och skickar det senaste efteråt', async () => {
    const { queue, calls, sent, events } = setup();
    queue.schedule('A', 'v1');
    await vi.advanceTimersByTimeAsync(DELAY);
    queue.schedule('A', 'v2');
    queue.schedule('A', 'v3');
    await vi.advanceTimersByTimeAsync(DELAY);
    expect(sent()).toEqual(['v1']);

    calls[0].resolve();
    await settle();
    expect(sent()).toEqual(['v1', 'v3']);
    calls[1].resolve();
    await settle();

    expect(queue.isIdle('A')).toBe(true);
    expect(events.at(-1)).toMatchObject({ key: 'A', status: 'saved', saved: 'v3' });
  });

  it('väntar in debouncen när en ny ändring kommit under ett anrop i flykt', async () => {
    const { queue, calls, sent } = setup();
    queue.schedule('A', 'v1');
    await vi.advanceTimersByTimeAsync(DELAY);
    await vi.advanceTimersByTimeAsync(DELAY - 100);
    queue.schedule('A', 'v2');
    calls[0].resolve();
    await settle();
    // Användaren skriver fortfarande; v2 väntar ut sin sekund.
    expect(sent()).toEqual(['v1']);
    await vi.advanceTimersByTimeAsync(DELAY);
    expect(sent()).toEqual(['v1', 'v2']);
  });

  it('olika nycklar väntar inte på varandra', async () => {
    const { queue, sent } = setup();
    queue.schedule('A', 'a1');
    queue.schedule('B', 'b1');
    await vi.advanceTimersByTimeAsync(DELAY);
    expect(sent()).toEqual(['a1', 'b1']);
  });

  it('lägger tillbaka ett värde som inte kom fram, men inte över ett nyare', async () => {
    const { queue, calls, sent } = setup();
    queue.schedule('A', 'v1');
    await vi.advanceTimersByTimeAsync(DELAY);
    calls[0].reject(new Error('nät'));
    await settle();
    expect(queue.status('A')).toBe('error');
    expect(queue.hasUnsaved()).toBe(true);

    const flushed = queue.flush('A');
    await settle();
    expect(sent()).toEqual(['v1', 'v1']);
    calls[1].resolve();
    expect(await flushed).toEqual({ ok: true });

    // Ett nyare värde som kommit under tiden vinner.
    queue.schedule('A', 'v2');
    await vi.advanceTimersByTimeAsync(DELAY);
    queue.schedule('A', 'v3');
    calls[2].reject(new Error('nät'));
    await settle();
    void queue.flush('A');
    await settle();
    expect(sent()).toEqual(['v1', 'v1', 'v2', 'v3']);
  });

  it('flush skickar direkt och väntar in allt för nyckeln', async () => {
    const { queue, calls, sent } = setup();
    queue.schedule('A', 'v1');
    let done = false;
    void queue.flush('A', { keepalive: true }).then(() => { done = true; });
    await settle();
    expect(calls.map(c => [c.value, c.keepalive])).toEqual([['v1', true]]);
    queue.schedule('A', 'v2');
    calls[0].resolve();
    await settle();
    expect(sent()).toEqual(['v1', 'v2']);
    expect(done).toBe(false);
    calls[1].resolve();
    await settle();
    expect(done).toBe(true);
  });

  it('flush svarar med felet när sparningen misslyckas', async () => {
    const { queue, calls } = setup();
    queue.schedule('A', 'v1');
    const flushed = queue.flush('A');
    await settle();
    const error = new Error('nät');
    calls[0].reject(error);
    expect(await flushed).toEqual({ ok: false, error });
    // Värdet ligger kvar till nästa försök.
    expect(queue.isIdle('A')).toBe(false);
  });

  it('flushAll med immediate skickar bredvid ett anrop i flykt', async () => {
    const { queue, calls } = setup();
    queue.schedule('A', 'v1');
    await vi.advanceTimersByTimeAsync(DELAY);
    queue.schedule('A', 'v2');
    queue.schedule('B', 'b1');
    void queue.flushAll({ keepalive: true, immediate: true });
    await settle();
    expect(calls.map(c => [c.value, c.keepalive])).toEqual([['v1', false], ['v2', true], ['b1', true]]);
  });

  it('forget glömmer det som väntar och ignorerar ett svar i flykt', async () => {
    const { queue, calls, sent, events } = setup();
    queue.schedule('A', 'v1');
    await vi.advanceTimersByTimeAsync(DELAY);
    queue.schedule('A', 'v2');
    const before = events.length;
    queue.forget('A');
    calls[0].resolve();
    await vi.advanceTimersByTimeAsync(DELAY * 5);
    expect(sent()).toEqual(['v1']);
    expect(events.length).toBe(before);
    expect(queue.isIdle('A')).toBe(true);
  });

  it('dispose stoppar timrarna men behåller det som väntar', async () => {
    const { queue, sent } = setup();
    queue.schedule('A', 'v1');
    queue.dispose();
    await vi.advanceTimersByTimeAsync(DELAY * 5);
    expect(sent()).toEqual([]);
    void queue.flushAll();
    await settle();
    expect(sent()).toEqual(['v1']);
  });
});
