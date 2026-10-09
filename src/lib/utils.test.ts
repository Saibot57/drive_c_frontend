import { describe, expect, it } from 'vitest';
import { cn } from './utils';

describe('cn med temats klasser', () => {
  it('behåller ramens bredd bredvid färgen', () => {
    expect(cn('border-frame border-ui-line')).toBe('border-frame border-ui-line');
  });

  it('låter en senare bredd eller skugga vinna', () => {
    expect(cn('border-frame', 'border-2')).toBe('border-2');
    expect(cn('shadow-frame', 'shadow-none')).toBe('shadow-none');
    expect(cn('rounded-ui', 'rounded-lg')).toBe('rounded-lg');
  });

  it('skiljer skugga från skuggans färg', () => {
    expect(cn('shadow-frame-sm shadow-black')).toBe('shadow-frame-sm shadow-black');
  });
});
