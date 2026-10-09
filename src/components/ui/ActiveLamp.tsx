/**
 * Lampan i Kronberg: det som är öppet just nu, eller en notis ton. Syns inte
 * i Neo, som markerar samma sak med text ("• aktiv") eller färg.
 */
export function ActiveLamp({
  on = true,
  tone = 'lamp',
  className = '',
}: {
  /** Släckt lampa: en ring, för rader som inte är öppna. */
  on?: boolean;
  tone?: 'lamp' | 'warning' | 'error';
  className?: string;
}) {
  const fill = tone === 'warning' ? 'border-amber-400 bg-amber-400'
    : tone === 'error' ? 'border-rose-500 bg-rose-500'
      : 'border-ui-lamp bg-ui-lamp shadow-[0_0_0_3px_rgba(217,88,28,0.16)]';
  return (
    <span
      aria-hidden
      className={`hidden h-2 w-2 shrink-0 rounded-full border kron:inline-block ${on ? fill : 'border-[#B5B3AD]'} ${className}`}
    />
  );
}
