import { describe, expect, it } from 'vitest';
import type { SyncResult } from '@/utils/librarySync';
import { describeSync as describeWithNbsp } from '@/utils/librarySync';

// Talen binds till sitt ord med hårt mellanslag; jämför med vanliga mellanslag.
const describeSync = (result: SyncResult | null) => describeWithNbsp(result)?.replace(/\u00a0/g, ' ') ?? null;

describe('describeSync', () => {
  it('håller ihop talet och ordet', () => {
    expect(describeWithNbsp({ files: 632, new_files: 5 })).toBe('632\u00a0filer · 5\u00a0nya');
  });

  it('visar antal filer och nya', () => {
    expect(describeSync({ files: 632, new_files: 532, skipped: [] })).toBe('632 filer · 532 nya');
  });

  it('böjer i singular', () => {
    expect(describeSync({ files: 1, new_files: 1 })).toBe('1 fil · 1 ny');
  });

  it('säger till när något hoppades över', () => {
    const skipped = [{ path: 'A/B', reason: 'x' }, { path: 'A/C', reason: 'y' }];
    expect(describeSync({ files: 12, new_files: 0, skipped })).toBe('12 filer · 0 nya · 2 hoppades över');
  });

  it('klarar en backend som inte räknar nya', () => {
    expect(describeSync({ files: 12 })).toBe('12 filer');
  });

  it('visar inget när svaret saknar antal', () => {
    expect(describeSync({})).toBeNull();
    expect(describeSync(null)).toBeNull();
  });
});
