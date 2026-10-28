import { describe, expect, it } from 'vitest';
import {
  isPhoneScreen,
  readStoredViewMode,
  resolveViewMode,
  sanitizeViewMode,
  ScreenSignals,
  VIEW_MODE_STORAGE_KEY,
  writeStoredViewMode,
} from './publicViewMode';

const desktop: ScreenSignals = {
  viewportWidth: 1440,
  screenWidth: 1440,
  screenHeight: 900,
  coarsePointer: false,
  mobileHint: false,
  userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Safari/605.1.15',
};

const androidPhoneUa = 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 Chrome/129.0 Mobile Safari/537.36';

describe('isPhoneScreen', () => {
  it('känner igen en dator', () => {
    expect(isPhoneScreen(desktop)).toBe(false);
  });

  it('räknar ett smalt fönster som telefon, som förut', () => {
    expect(isPhoneScreen({ ...desktop, viewportWidth: 400 })).toBe(true);
  });

  it('känner igen en telefon vars appwebbläsare säger att fönstret är brett', () => {
    // Classroom på Android: fönstret rapporteras som 980 px, skärmen är 412.
    expect(isPhoneScreen({
      viewportWidth: 980,
      screenWidth: 412,
      screenHeight: 915,
      coarsePointer: true,
      mobileHint: null,
      userAgent: '',
    })).toBe(true);
  });

  it('känner igen en telefon på tvären', () => {
    expect(isPhoneScreen({
      viewportWidth: 915,
      screenWidth: 915,
      screenHeight: 412,
      coarsePointer: true,
      mobileHint: null,
      userAgent: '',
    })).toBe(true);
  });

  it('litar på webbläsarens besked och på Androids "Mobile"', () => {
    expect(isPhoneScreen({ ...desktop, mobileHint: true })).toBe(true);
    expect(isPhoneScreen({ ...desktop, mobileHint: null, userAgent: androidPhoneUa })).toBe(true);
  });

  it('räknar inte en surfplatta som telefon', () => {
    expect(isPhoneScreen({
      viewportWidth: 1024,
      screenWidth: 768,
      screenHeight: 1024,
      coarsePointer: true,
      mobileHint: false,
      userAgent: 'Mozilla/5.0 (Linux; Android 14; SM-X710) AppleWebKit/537.36 Chrome/129.0 Safari/537.36',
    })).toBe(false);
  });

  it('räknar bara skärmens storlek när den är en pekskärm', () => {
    expect(isPhoneScreen({ ...desktop, viewportWidth: 1000, screenWidth: 600, screenHeight: 1000 })).toBe(false);
  });
});

describe('resolveViewMode', () => {
  it('ger telefonen listan och större skärmar rutnätet', () => {
    expect(resolveViewMode(null, true, true)).toBe('lista');
    expect(resolveViewMode(null, false, true)).toBe('rutnat');
  });

  it('ger telefonen rutnätet med ?vy=dagsschema', () => {
    expect(resolveViewMode(null, true, false)).toBe('rutnat');
  });

  it('låter deltagarens val gå före gissningen', () => {
    expect(resolveViewMode('rutnat', true, true)).toBe('rutnat');
    expect(resolveViewMode('lista', false, true)).toBe('lista');
  });
});

const memoryStorage = (initial: Record<string, string> = {}) => {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => { data.set(key, value); },
    removeItem: (key: string) => { data.delete(key); },
  };
};

const brokenStorage = () => ({
  getItem: () => { throw new Error('SecurityError'); },
  setItem: () => { throw new Error('QuotaExceededError'); },
  removeItem: () => { throw new Error('SecurityError'); },
});

describe('sparat vyval', () => {
  it('sparar och läser tillbaka valet', () => {
    const storage = memoryStorage();
    writeStoredViewMode('lista', storage);
    expect(storage.data.get(VIEW_MODE_STORAGE_KEY)).toBe('lista');
    expect(readStoredViewMode(storage)).toBe('lista');
  });

  it('ger null för okända värden och tom lagring', () => {
    expect(readStoredViewMode(memoryStorage())).toBeNull();
    expect(readStoredViewMode(memoryStorage({ [VIEW_MODE_STORAGE_KEY]: 'vecka' }))).toBeNull();
    expect(sanitizeViewMode(42)).toBeNull();
  });

  it('sväljer fel från lagringen', () => {
    expect(readStoredViewMode(brokenStorage())).toBeNull();
    expect(() => writeStoredViewMode('rutnat', brokenStorage())).not.toThrow();
  });
});
