import { describe, expect, it } from 'vitest';
import { endTimeAfter, timeToMinutes } from './scheduleTime';

describe('endTimeAfter', () => {
  const nine = timeToMinutes('09:00');

  it('lägger längden på starten', () => {
    expect(endTimeAfter(nine, 45)).toBe('09:45');
  });

  it('använder reservlängden när längden saknas, är noll eller negativ', () => {
    expect(endTimeAfter(nine, 0)).toBe('10:00');
    expect(endTimeAfter(nine, -30, 15)).toBe('09:15');
    expect(endTimeAfter(nine, Number.NaN)).toBe('10:00');
  });

  it('stannar på 23:59, eftersom 24:00 inte är ett klockslag', () => {
    expect(endTimeAfter(timeToMinutes('23:30'), 60)).toBe('23:59');
  });
});
