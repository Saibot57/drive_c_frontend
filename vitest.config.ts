import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

/**
 * Vitest täcker i dagsläget bara datumlagret (`src/utils/calendarDates`).
 * Resten av frontenden verifieras manuellt — se KALENDER-planen.
 *
 * `TZ` sätts här och inte i skriptet: flera testfall handlar om att lokal
 * midnatt och UTC ligger på olika kalenderdagar, och de säger ingenting alls
 * om sviten råkar köras i UTC.
 */
process.env.TZ = 'Europe/Stockholm';

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
