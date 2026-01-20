export const START_HOUR = 8; // Schemat börjar 08:00
export const END_HOUR = 17;   // Schemat slutar 17:00
export const PIXELS_PER_MINUTE = 2; // Hur högt varje minut är (zoom)
export const SNAP_MINUTES = 15; // "Magnet" för tider (kvartar)

/** Konverterar "08:30" till minuter från midnatt (00:00) men justerat för logiken */
export const timeToMinutes = (time: string): number => {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
};

/** Konverterar minuter från start (00:00) till "08:30" */
export const minutesToTime = (totalMinutes: number): string => {
  const h = Math.floor(totalMinutes / 60);
  const m = Math.floor(totalMinutes % 60);
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
};

/** Räknar ut höjd och topp-position för ett block */
export const getPositionStyles = (start: string, duration: number) => {
  const startMin = timeToMinutes(start);
  const dayStartMin = START_HOUR * 60;
  
  const top = (startMin - dayStartMin) * PIXELS_PER_MINUTE;
  const height = duration * PIXELS_PER_MINUTE;
  
  return { top, height };
};

/** Snap-to-grid logik: Avrundar minuter till närmsta kvart */
export const snapTime = (minutes: number): number => {
  return Math.round(minutes / SNAP_MINUTES) * SNAP_MINUTES;
};

/** Kollar om två tidsintervall krockar */
export const checkOverlap = (
  startA: string, endA: string,
  startB: string, endB: string
): boolean => {
  const aStart = timeToMinutes(startA);
  const aEnd = timeToMinutes(endA);
  const bStart = timeToMinutes(startB);
  const bEnd = timeToMinutes(endB);

  // Krockar om A startar innan B slutar OCH A slutar efter B startar
  return aStart < bEnd && aEnd > bStart;
};