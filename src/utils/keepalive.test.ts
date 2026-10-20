import { describe, expect, it } from 'vitest';
import { byteLength, KEEPALIVE_BUDGET_BYTES, withKeepalive } from './keepalive';

describe('withKeepalive', () => {
  it('räknar byte, inte tecken', () => {
    expect(byteLength('abc')).toBe(3);
    expect(byteLength('åäö')).toBe(6);
  });

  it('använder keepalive när det önskas och ryms', async () => {
    expect(await withKeepalive('{}', true, async keepalive => keepalive)).toBe(true);
    expect(await withKeepalive('{}', false, async keepalive => keepalive)).toBe(false);
  });

  it('skickar utan keepalive när kroppen inte ryms', async () => {
    // Under gränsen räknat i tecken, över den räknat i byte.
    const body = 'å'.repeat(KEEPALIVE_BUDGET_BYTES / 2 + 1);
    expect(body.length).toBeLessThan(KEEPALIVE_BUDGET_BYTES);
    expect(await withKeepalive(body, true, async keepalive => keepalive)).toBe(false);
  });

  it('räknar alla anrop i flykt sammanlagt', async () => {
    const half = 'x'.repeat(KEEPALIVE_BUDGET_BYTES / 2 + 1);
    let finish!: () => void;
    const first = withKeepalive(half, true, keepalive => new Promise<boolean>(resolve => {
      finish = () => resolve(keepalive);
    }));
    // Det första är i flykt, så det andra får inte plats.
    expect(await withKeepalive(half, true, async keepalive => keepalive)).toBe(false);
    finish();
    expect(await first).toBe(true);
    // När det första är klart ryms det igen.
    expect(await withKeepalive(half, true, async keepalive => keepalive)).toBe(true);
  });

  it('lämnar tillbaka budgeten även när anropet misslyckas', async () => {
    const big = 'x'.repeat(KEEPALIVE_BUDGET_BYTES - 10);
    await expect(withKeepalive(big, true, async () => { throw new Error('nät'); })).rejects.toThrow('nät');
    expect(await withKeepalive(big, true, async keepalive => keepalive)).toBe(true);
  });
});
