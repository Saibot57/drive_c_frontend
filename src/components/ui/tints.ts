/**
 * Knappar som har en egen färg i Neo. I Kronberg är knappar neutrala, och
 * färg betyder något (docs/plans/kronberg-tema.md, avsnitt 3.2).
 *
 * Tailwind-klasser och inte CSS-klasser: Button lägger själv `bg-bw`, och bara
 * en `bg-*` i className tar bort den. En egen klass i components-lagret hade
 * förlorat mot den och gjort knappen vit i Neo.
 */
export const uiTint = {
  create: 'bg-emerald-100 hover:bg-emerald-200 kron:bg-ui-paper kron:hover:bg-ui-surface-3',
  createStrong: 'bg-emerald-200 hover:bg-emerald-300 kron:bg-ui-paper kron:hover:bg-ui-surface-3',
  save: 'bg-amber-100 hover:bg-amber-200 kron:bg-ui-paper kron:hover:bg-ui-surface-3',
  info: 'bg-indigo-100 hover:bg-indigo-200 kron:bg-ui-paper kron:hover:bg-ui-surface-3',
  sky: 'bg-[#aee8fe] kron:bg-ui-paper kron:hover:bg-ui-surface-3',
  danger: 'bg-rose-100 text-rose-800 hover:bg-rose-200 kron:bg-ui-paper kron:text-ui-danger kron:hover:bg-ui-surface-3',
  dangerStrong: 'bg-rose-200 hover:bg-rose-300 kron:bg-ui-paper kron:text-ui-danger kron:hover:bg-ui-surface-3',
  /** Statusmärken: låst, utesluter. */
  warning: 'bg-[var(--ui-warning-bg)]',
} as const;
