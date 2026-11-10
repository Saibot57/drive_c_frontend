# Drive C – frontend

Planeringsverktyg för lärare: schema, temakalender, arbetslag (lesson lab), närvaro, månadskalender, statistik (terminsplanering, dold), bibliotek, trafik och en canvas-workspace. Next.js 14 (App Router) + React 18 + TypeScript + Tailwind/Radix. Allt renderas i klienten (`"use client"`); det finns inga Next API-routes. All serverlogik ligger i `Saibot57/drive_c_backend` (Flask), som nås via `NEXT_PUBLIC_API_URL` (`src/config/api.ts`). Vercel deployar vid push till `main`.

## Kommandon

```bash
pnpm install          # kör också scripts/copy-pdfjs-worker.cjs (pdf.js-workern)
pnpm exec tsc --noEmit
pnpm lint
pnpm test             # vitest, src/**/*.test.ts
pnpm build
```

CI (`.github/workflows/ci.yml`) kör alla fyra på varje PR. Kör dem lokalt före push.

## Struktur

- `src/app/` – sidor. Features under `(full-width)/features/<namn>/`; sidan är några rader och renderar en rotkomponent.
- **En ny feature följer den platta strukturen**, med featurens namn i filnamnen: `components/<feature>/`, `hooks/use<Feature>…`, `services/<feature>Service.ts`, `utils/<feature>….ts`, `types/<feature>.ts`. Närvaro är den senaste kompletta mallen.
- `src/app/workspace/_feature/` – bara workspace är organiserad per feature (egna `components/`, `hooks/`, `services/`, `types/`, `utils/`, `styles/`). Flytta inte andra features dit.
- Schema är den delade kärnan: `types/schedule.ts`, `config/plannerConstants.ts` och `utils/scheduleTime.ts` används av nästan alla features. Schema importerar inte från andra features.
- `docs/plans/` – planer för större ändringar; index i `docs/plans/README.md`. Läs bara den plan som rör det du ändrar. `arkitektur-2026-11.md` är den öppna listan över refaktoreringssteg.
- `docs/arkiv/` – äldre granskningar (mars och oktober 2026). Historik, inte aktuella fel. Den senaste arkitekturgranskningen är `docs/architecture-review-2026-11-09.md`.
- Status per fynd i granskningarna står i backendens `docs/granskning-status.md`. Den filen gäller före rapporterna.

## Konventioner

- **Svenska** i UI-texter, kodkommentarer, commit-meddelanden och planer; engelska identifierare. Commit-rubriker i formen `Område: vad som ändrats`.
- **API-anrop** går via `fetchWithAuth` (`src/services/authService.ts`), som också sköter 401 med en inloggningsruta. Backend svarar alltid `{ success, data, error }`; kasta `error` vid `success: false`. Varje service har i dag en egen uppackare (`readData` eller `unwrap`). Skriv inte en till: återanvänd en befintlig tills `services/http.ts` finns.
- **Tvätta det som läses in** när ett fel i formen skulle fälla sidan (se `isDocument` i `narvaroService.ts` och `parseLabState`). Lita inte på `as T` för data som användaren kan ha sparat i en äldre form.
- **Nyckelstil i API:t** följer featuren: Workspace och Kalender skickar snake_case (`position_x`, `quick_text`), Schema, Temakalender, Arbetslag och Närvaro camelCase (`startTime`, `updatedAt`). Typerna som speglar backend skrivs för hand (`types/schedule.ts`, `workspace.types.ts`) och ändras i samma veva som backendens serializer.
- **Sparning** har en modell per feature, och skillnaderna är avsiktliga. Ingen sparning får lämna det som väntar när sidan stängs.
  - Schema: hela veckan med version och 409 (`usePlannerSync`).
  - Arbetslag: kö med version (`utils/labPlanStore.ts`).
  - Närvaro: krypterade dokument med version, genom `utils/saveQueue.ts` (`useNarvaroSync`).
  - Temakalender och Workspace: `utils/saveQueue.ts`, högst en sparning i flykt per nyckel, utan version.
  - Kalender: kö per dag med patchar (`utils/calendarSaveQueue.ts`).
  - En ny feature använder `saveQueue`. Kan dokumentet öppnas på två ställen ska det ha version och 409 som Närvaro och Arbetslag. Återförsök och stängning: `utils/saveRetry.ts`, `leaveSave.ts`, `keepalive.ts`.
- **Närvaro** krypterar allt i webbläsaren (`utils/narvaroCrypto.ts`); servern får bara chiffertext. Skicka aldrig namn eller närvaro okrypterat, och logga dem inte.
- **Färger och utseende** kommer från tokens i `src/styles/tokens.css` (`--ui-*`), med ett värde för Neo (standard) och ett för Kronberg (`data-theme="kronberg"`). Inga hårdkodade hex-värden och inget Tailwind-grått (`gray-*`, `slate-*`) i ny kod. `kron:` används bara för skillnader i form och layout, aldrig för färg. Ändras ett Neo-värde ändras appens standardutseende, och det ska stå i PR:en.
- **Workspace-korten** får sitt utseende från `workspace.css` (`--ws-*`), inte från inline-`style` eller Tailwind.
- **localStorage-nycklar** är versionerade (`app.theme.v1`) och läses med `usePersistentState` och en `sanitize*`-funktion. Svälj fel från lagringen. Byts en nyckel måste den gamla läsas och föras över, annars försvinner användarens listor tyst (se `LEGACY_KEYS` i `useNarvaroSync.ts`).
- **Datum:** veckodagar är svenska strängar (`PLANNER_DAYS` i `config/plannerConstants.ts`). ISO-vecka räknas med `isoWeekYear` i `utils/dateSv.ts`; skriv ingen egen.
- **Tester** skrivs för logik i `utils/`, `services/` och hookar. Ren logik bryts ut ur komponenter för att gå att testa; komponenter testas inte. Bara `*.test.ts` körs, inte `*.test.tsx`. En hook testas med `// @vitest-environment jsdom` överst och en egen `renderHook` (se `usePlannerSync.test.ts`); det finns inget testbibliotek för React. Schemats fixturer ligger i `components/schedule/__fixtures__/`.
- **Dialoger** går att flytta och minns sin plats under sin rubrik (`useMovableDialog`). En dialog vars rubrik ändras behöver `positionKey`; en som täcker skärmen får `movable={false}`. Workspace-dialoger byggs med `WorkspaceModal`.
- **Nedladdning** går via `downloadBlob` (`utils/download.ts`). `URL.revokeObjectURL` direkt efter klicket avbryter nedladdningen i vissa webbläsare.
- **Planer och status uppdateras av den session som gör arbetet, i samma PR som koden.** Gör du ett steg i en plan: bocka av det i planen, skriv in avvikelser där och uppdatera raden i `docs/plans/README.md`. Åtgärdar du ett granskningsfynd: uppdatera dess rad i backendens `docs/granskning-status.md` i en commit där. Skriv bara det som är sant när du skriver det: datum och PR-nummer, aldrig "öppen" eller "inte sammanslagen", som blir fel när PR:en slås ihop.

## Fällor

- **Stora filer som ändras ofta:** `NewSchedulePlanner.tsx` (~2 600 rader), `LessonLab.tsx` (~1 550), `useWorkspaceData.ts` (~1 300), `Narvaro.tsx` (~1 100), `useArchiveManager.ts` (~800). Lägg inte en ny subkomponent eller mer logik i dem: en ny del blir en egen fil i samma mapp, och logik går till `utils/` med test.
- **Schemat:** allt användaren ändrar går via `commitSchedule` i `NewSchedulePlanner.tsx`, som stoppar ändringar i läsläge. `applyScheduleFromServer` är bara för inläsningar från servern; en redigeringsväg som använder den går förbi läsläget.
- **En ny dold schemainställning** läggs i `HiddenSettingsDraft` (`useHiddenSettings.ts`). Typfelen visar sedan var den ska in (`utils/plannerBackup.ts`, `applyImportedSettings`, `handleExportJSON`), så att den följer med JSON-backupen.
- **En ny workspace-elementtyp** måste in i backendens `VALID_TYPES` (`models/workspace_models.py`), annars avvisas den. I frontend rör den ett femtontal filer; sök på en befintlig typ, t.ex. `'heading'`.
- **En ny sida** läggs i `features` i `FeatureNavigation.tsx`. Har den siffergenväg ska den också in i `config/shortcuts.ts`.
- **Backend lägger inte till kolumner av sig själv.** Ett nytt fält som ska sparas kräver en alembic-migration där. Om backend eller frontend ska ut först beror på migrationen (oftast backend, men `021` krävde frontend först) och står i historiken i backendens `DEPLOY.md`.
- Det finns flera sync- och autosave-hooks med olika beteende (`usePlannerSync`, `useThemeWheelSync`, `useCalendarAutosave`, `useNarvaroSync`, `useWorkspaceSync`). Läs den som gäller innan du ändrar hur något sparas.
- `.prettierrc.js` säger `semi: false`, men koden använder semikolon och prettier körs inte. Formatera inte om hela filer.
- Vitest sätter `TZ=Europe/Stockholm` i `vitest.config.ts`. Datumtester bygger på att lokal midnatt och UTC är olika dagar.
