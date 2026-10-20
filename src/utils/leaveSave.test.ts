import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LEAVE_SAVE_WAIT_MS, trackLeaveSave, waitForLeaveSave } from './leaveSave';

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); });

const deferred = () => {
  let resolve!: () => void;
  let reject!: (e: Error) => void;
  const promise = new Promise<void>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
};

describe('waitForLeaveSave', () => {
  it('svarar direkt när inget sparas', async () => {
    let done = false;
    void waitForLeaveSave().then(() => { done = true; });
    await vi.advanceTimersByTimeAsync(0);
    expect(done).toBe(true);
  });

  it('väntar in alla sparningar, även en som misslyckas', async () => {
    const first = deferred();
    const second = deferred();
    trackLeaveSave(first.promise);
    trackLeaveSave(second.promise);
    let done = false;
    void waitForLeaveSave().then(() => { done = true; });

    first.reject(new Error('nät'));
    await vi.advanceTimersByTimeAsync(0);
    expect(done).toBe(false);
    second.resolve();
    await vi.advanceTimersByTimeAsync(0);
    expect(done).toBe(true);
  });

  it('väntar högst taket på ett anrop som aldrig svarar', async () => {
    trackLeaveSave(new Promise(() => undefined));
    let done = false;
    void waitForLeaveSave().then(() => { done = true; });
    await vi.advanceTimersByTimeAsync(LEAVE_SAVE_WAIT_MS - 1);
    expect(done).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(done).toBe(true);
  });
});
