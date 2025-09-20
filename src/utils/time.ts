export function normalizeHHMM(raw: string): string {
  if (typeof raw !== 'string') throw new Error('time must be string');
  const m = raw.trim().match(/^(\d{1,2}):(\d{1,2})$/);
  if (!m) throw new Error('Time must be HH:MM');
  const h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  if (h < 0 || h > 23 || min < 0 || min > 59) throw new Error('Invalid time');
  return `${h.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`;
}

export function isStartBeforeEnd(startHHMM: string, endHHMM: string): boolean {
  const [sh, sm] = startHHMM.split(':').map(Number);
  const [eh, em] = endHHMM.split(':').map(Number);
  return sh * 60 + sm < eh * 60 + em;
}
