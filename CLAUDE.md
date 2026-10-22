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
- Status för granskningarna 2026-10-15 (säkerhet, dataintegritet, arkitektur)
  finns i backend-repot: `docs/granskning-status.md`. Se Konventioner.

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
  `lessonLab.state.v1`). Läs gamla data defensivt (se `sanitize*`-
  funktionerna) och svälj fel från lagringen. Byts nyckeln måste den gamla
  läsas och föras över, annars försvinner användarens listor och regler tyst.
- **Veckodagar** är svenska strängar: `PLANNER_DAYS` i
  `src/config/plannerConstants.ts`.
- **Tester** skrivs för logik i `utils/` och `services/`. Ren logik bryts ut
  ur komponenter för att gå att testa. Fixturer för schemat ligger i
  `src/components/schedule/__fixtures__/` och körs av
  `scheduleFixtures.test.ts`. Bara `*.test.ts` körs, inte `*.test.tsx`. En
  hook testas med `// @vitest-environment jsdom` överst i filen och en egen
  `renderHook` (se `usePlannerSync.test.ts`); det finns inget testbibliotek
  för React.
- **Nyckelstil i API:t** följer featuren: Workspace och Kalender skickar
  snake_case (`position_x`, `quick_text`), Schema, Temakalender och Arbetslag
  camelCase (`startTime`, `startWeek`, `updatedAt`). Typerna som speglar
  backend skrivs för hand (`types/schedule.ts`, `workspace.types.ts`) och
  ändras i samma veva som backendens serializer.
- **Sparning** har en modell per feature, och skillnaderna är avsiktliga:
  Schema sparar hela veckan med version och 409 (`usePlannerSync`), Arbetslag
  har en kö med version (`utils/labPlanStore.ts`), Kalender en kö per dag
  (`utils/calendarSaveQueue.ts`) och Workspace ett anrop per ändring
  (`useWorkspaceData`). Ett dokument som flera kan redigera följer Schema
  eller Arbetslag. Ingen sparning får lämna det som väntar när sidan stängs.
- **Granskningsfynd:** åtgärdar du ett fynd från granskningarna 2026-10-15,
  uppdatera dess rad i backendens `docs/granskning-status.md` i en commit där,
  i samma veva som fixen. Rapporterna själva är ögonblicksbilder och ändras
  inte.
- **Dialoger** går att flytta (dra i rubriken, Ctrl+Cmd+pil) och minns sin
  plats under sin rubrik så länge sidan är öppen (`useMovableDialog`). En
  dialog vars rubrik ändras, t.ex. `Dela "X"`, behöver `positionKey`; en
  dialog som täcker skärmen får `movable={false}`. Workspace-dialoger byggs
  med `WorkspaceModal`.
- **Nedladdning** går via `downloadBlob` (`utils/download.ts`). Att anropa
  `URL.revokeObjectURL` direkt efter klicket avbryter nedladdningen i vissa
  webbläsare.

## Fällor

- `.prettierrc.js` säger `semi: false`, men koden använder semikolon och
  prettier körs inte. Formatera inte om hela filer.
- Vitest sätter `TZ=Europe/Stockholm` i `vitest.config.ts`. Datumtester
  bygger på att lokal midnatt och UTC är olika dagar.
- Det finns flera sync- och autosave-hooks (`useWorkspaceSync`,
  `usePlannerSync`, `useThemeWheelSync`, `useCalendarAutosave`) med olika
  beteende. Läs den som gäller innan du ändrar hur något sparas.
- Backend lägger inte till nya kolumner av sig själv. Ett nytt fält som ska
  sparas kräver en alembic-migration i backend. **Ordningen mellan backend
  och frontend beror på migrationen**: oftast backend först, men `021` krävde
  frontend först. Den står i historiken i backendens `DEPLOY.md`, och en ny
  migration ska skriva in sin ordning där.
- **Schemat:** allt användaren ändrar går via `commitSchedule` i
  `NewSchedulePlanner.tsx`, som stoppar ändringar i läsläge.
  `applyScheduleFromServer` är bara till för inläsningar från servern; en ny
  redigeringsväg som använder den går förbi läsläget.
- **En ny dold schemainställning** ska även in i JSON-backupen
  (`handleExportJSON`, `handleImportJSON` och `handleConfirmImport` i
  `NewSchedulePlanner.tsx`), annars försvinner den vid återställning.
  `selectionDefaults`, `pasteProtect` och `exportExcludes` saknas där i dag.
- **En ny workspace-elementtyp** måste även in i backendens `VALID_TYPES`
  (`models/workspace_models.py`), annars avvisas den.
- `NewSchedulePlanner.tsx` (~2 600 rader) och `useWorkspaceData.ts` är stora
  och ändras ofta. Bryt hellre ut logik till `utils/` med tester än att lägga
  till mer i dem.
