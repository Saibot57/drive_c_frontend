# Drive C – frontend

Planeringsverktyg för lärare: schemaplanerare, terminsplanering, temahjul,
månadskalender, arbetslag (lesson lab), bibliotek och en canvas-workspace.
Next.js 14 (App Router) + React 18 + TypeScript + Tailwind/Radix. Allt
renderas i klienten (`"use client"`); det finns inga Next API-routes. All
serverlogik ligger i backend-repot `Saibot57/drive_c_backend` (Flask), som
nås via `NEXT_PUBLIC_API_URL` (`src/config/api.ts`).

Vercel bygger och deployar automatiskt vid push till `main`.

## Kommandon

```bash
pnpm install          # kör också scripts/copy-pdfjs-worker.cjs (pdf.js-workern)
pnpm exec tsc --noEmit
pnpm lint
pnpm test             # vitest, src/**/*.test.ts
pnpm build
```

CI (`.github/workflows/ci.yml`) kör alla fyra på varje PR. Kör dem lokalt
före push.

## Struktur

- `src/app/` – sidor. Features under `(full-width)/features/<namn>/`.
- `src/app/workspace/_feature/` – workspace är organiserad per feature:
  egna `components/`, `hooks/`, `services/`, `types/`, `utils/`, `styles/`.
- Resten är organiserat per filtyp: `src/components/<feature>/`,
  `src/hooks/`, `src/services/`, `src/utils/`, `src/types/`, `src/config/`.
  Följ mönstret som redan gäller för den feature du ändrar i.
- `docs/plans/` – planer för större ändringar. Se `docs/plans/README.md`.
- `docs/arkiv/` – gamla granskningar. Historik, inte aktuella fel.

## Konventioner

- **Svenska** i UI-texter, kodkommentarer, commit-meddelanden och planer.
  Commit-rubriker i formen `Område: vad som ändrats`.
- **API-anrop** går via `fetchWithAuth` (`src/services/authService.ts`).
  Backend svarar alltid `{ success, data, error }`; packa upp som
  `unwrap` i `workspaceService.ts` gör och kasta `error` vid `success: false`.
- **Färger och utseende** kommer från tokens i `src/styles/tokens.css`
  (`--ui-*`), som har ett värde för Neo (standard) och ett för Kronberg
  (`data-theme="kronberg"`). Skriv inga hårdkodade hex-värden. Ändras ett
  Neo-värde ändras appens standardutseende, och det ska stå i PR:en.
- **Workspace-korten** får sitt utseende från `workspace.css` (`--ws-*`),
  inte från inline-`style` eller Tailwind-grått.
- **localStorage-nycklar** är versionerade (`app.theme.v1`,
  `lessonLab.state.v1`). Byt version när formatet ändras, läs gamla data
  defensivt (se `sanitize*`-funktionerna) och svälj fel från lagringen.
- **Veckodagar** är svenska strängar: `PLANNER_DAYS` i
  `src/config/plannerConstants.ts`.
- **Tester** skrivs för logik i `utils/` och `services/`. Ren logik bryts ut
  ur komponenter för att gå att testa. Fixturer för schemat ligger i
  `src/components/schedule/__fixtures__/` och körs av
  `scheduleFixtures.test.ts`.

## Fällor

- `.prettierrc.js` säger `semi: false`, men koden använder semikolon och
  prettier körs inte. Formatera inte om hela filer.
- Vitest sätter `TZ=Europe/Stockholm` i `vitest.config.ts`. Datumtester
  bygger på att lokal midnatt och UTC är olika dagar.
- Det finns flera sync- och autosave-hooks (`useWorkspaceSync`,
  `usePlannerSync`, `useThemeWheelSync`, `useCalendarAutosave`) med olika
  beteende. Läs den som gäller innan du ändrar hur något sparas.
- Backend lägger inte till nya kolumner av sig själv. Ett nytt fält som ska
  sparas kräver en alembic-migration i backend, och den ska vara deployad
  innan frontend som skickar fältet når `main`.
- `NewSchedulePlanner.tsx` (~2 600 rader) och `useWorkspaceData.ts` är stora
  och ändras ofta. Bryt hellre ut logik till `utils/` med tester än att lägga
  till mer i dem.
