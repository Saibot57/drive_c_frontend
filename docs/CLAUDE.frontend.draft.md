# CLAUDE.md – drive_c_frontend

Planeringsverktyg för lärare. Next.js 14 (App Router, helt klientrenderat, `'use client'` överallt),
TypeScript strict, Tailwind + Radix, vitest. Backend är `drive_c_backend` (Flask), oftast klonad bredvid.

## Kommandon
- `pnpm install` (postinstall kopierar pdf.js-workern till `public/`)
- `pnpm dev` · `pnpm lint` · `pnpm exec tsc --noEmit` · `pnpm test` (vitest, `TZ=Europe/Stockholm`)
- Kör lint, tsc och test före varje commit. Det finns ingen CI som gör det åt dig.
- vitest kör bara `src/**/*.test.ts` i `node`-miljö. Hooks och komponenter går inte att testa än;
  lyft ut logiken till en ren funktion i `src/utils/` och testa den.

## Features → var koden ligger
| Feature | Route | Kod |
|---|---|---|
| Schema (planner) | `/` (+ `/features/schedule`), publik vy `/s/[token]` | `components/schedule/NewSchedulePlanner.tsx`, `hooks/use{ArchiveManager,PlannerSync,HiddenSettings,…}`, `services/plannerService.ts`, `utils/schedule*`, `utils/schedulePdf/` |
| Temakalender | `/features/temakalender` | `components/theme-wheel/`, `hooks/useThemeWheel*`, `services/themeWheelService.ts` |
| Statistik (dold, t-t-t) | `/features/statistik` | `components/term-planner/`, `services/termService.ts`, `utils/termPlanner.ts` |
| Arbetslag | `/features/arbetslag` (+`/detalj`) | `components/lesson-lab/`, `hooks/useLessonLabState.ts`, `utils/labPlanStore.ts`, `utils/lessonLab*.ts` |
| Kalender (månad) | `/features/calendar` | `components/month-calendar/`, `hooks/useCalendar*`, `services/monthCalendarService.ts` |
| Workspace (canvas) | `/workspace` | allt under `src/app/workspace/_feature/` (egen struktur per feature) |
| Bibliotek | `/features/bibliotek` | `app/(full-width)/features/bibliotek/page.tsx`, `components/FileList/` |

- `types/schedule.ts`, `config/plannerConstants.ts` och `utils/scheduleTime.ts` används av nästan alla features.
  Ändra dem med det i åtanke.
- **Ny feature:** komponenter i `components/<feature>/`, hooks, utils och services platt med featureprefix i namnet.
  Månadskalendern är den minsta kompletta förlagan. Workspace är undantaget och ska förbli självständigt.
- **Ny sida i menyn:** `FeatureNavigation.tsx` **och** `config/shortcuts.ts` (siffrorna står på båda ställena).

## API-anrop
- Alltid via `fetchWithAuth` (`services/authService.ts`), som lägger på token och skickar till `/login` vid 401.
  Bas-URL:en kommer från `config/api.ts`.
- Svaren har formen `{ success, data, error }`. Varje service har en egen liten `handle`/`unwrap`; kopiera den från
  `termService.ts` (`handle<T>(response, fallback)`).
- Visa `error` från servern för användaren. Nya meddelanden skrivs på svenska.
- Ändrar du en typ som speglar backend, ändra serializern i backend samtidigt:
  `PlannerActivity`/`PlannerArchiveSummary` ↔ `planner_routes._serialize_*` (camelCase),
  `ThemeWheel` ↔ `theme_models.to_dict` (camelCase), `Surface`/`WorkspaceElement` ↔ `workspace_models.to_dict`
  (**snake_case**), kalender ↔ `month_calendar_models.to_dict` (**snake_case**). Nya endpoints använder camelCase.
- `ElementType` (`_feature/types/workspace.types.ts`) måste stämma med backendens `WorkspaceElement.VALID_TYPES`.

## Sparning – välj efter datamodell
- Hela dokumentet sparas i ett anrop med versionskontroll: följ `utils/labPlanStore.ts` (Arbetslag, testad).
- Fält som ändras ofta och var för sig: följ `hooks/useCalendarAutosave.ts` (patch per nyckel, keepalive-flush).
- Schema (`usePlannerSync`, lås och 409), Temakalender och Workspace (ett anrop per ändring, se `useWorkspaceHistory`
  för varför) har egna modeller med skäl. Gör inga nya hybrider av dem.
- Sparstatus är `'idle' | 'saving' | 'saved' | 'error'`.

## Schemat: läsläge
- Allt användaren gör med schemat går genom `commitSchedule` i `NewSchedulePlanner.tsx`.
  `applyScheduleFromServer` är bara till för det som läses från servern. Den går förbi läsläget.
- En ny dold inställning ska in i `plannerConstants` (nyckel), `useHiddenSettings`, `HiddenSettingsDialog`,
  `PersistedPlannerState` och export, import och bekräftelse i NSP. Annars saknas den i JSON-backupen.

## Workspace
- En ny elementtyp rör `workspace.types.ts`, `types/constants.ts`, `SIZE_BY_TYPE` och `getDefaultContent` i
  `useWorkspaceData.ts`, `ElementRenderer.tsx`, `CanvasElement.tsx`, `Left/RightSidebar.tsx`, `SearchOverlay.tsx`,
  `workspace.css` och backendens `VALID_TYPES`.
- Varje skrivning går via `track` eller `debounced` i `useWorkspaceData`, och varje användaråtgärd lägger sin
  ångring med `pushUndo`.

## Styling och teman (Neo och Kronberg)
- Färger kommer från tokens: `--ui-*` i `styles/tokens.css`. `--sp-*`, `--ws-*` och `--mc-*` bygger på dem.
  Skriv inga hex-värden i komponenter.
- Workspace använder bara `ws-`-klasser i `_feature/styles/workspace.css`, inte Tailwind.
- Övriga features använder Tailwind med `ui-`-färger (`bg-ui-surface`, `text-ui-muted`). `kron:` används för
  Kronberg-skillnader som inte är färger.
- En ny token får ett Neo-värde som är exakt det gamla. Neo ska se likadant ut.
- Bakgrund: `docs/plans/kronberg-tema.md` avsnitt 2 och `docs/plans/workspace-editorer-tokens.md`.

## localStorage
- Läs och skriv via `usePersistentState(key, sanitize, fallback)` med `sanitize` på modulnivå.
- Nycklarna har versionssuffix (`app.teachers.v1`). Döp aldrig om en nyckel; lärarlistor och regler finns bara där.

## Språk och stil
- UI, kodkommentarer, commitmeddelanden och planer skrivs på svenska. Identifierare skrivs på engelska.
- Kommentarerna förklarar *varför*. Behåll den nivån.
- Använd `utils/download.ts` (`downloadBlob`) för nedladdningar.

## Planer
- Större ändringar planeras i `docs/plans/<namn>.md`, med en statusrad överst och en avvikelselista när planen är genomförd.
- Statusraderna "inte sammanslagen med main" är inaktuella. Alla planer i mappen är genomförda och sammanslagna.
- `DESIGN_AUDIT.md` och `SECURITY_AUDIT.md` (mars 2026) beskriver delvis kod som är borttagen.

## Fällor
- `components/schedule/__fixtures__/` kontrolleras bara i dev-konsolen när schemasidan laddas, inte i `pnpm test`.
- Backend måste deployas manuellt (PythonAnywhere), medan Vercel bygger frontend vid push. En ny frontend mot gammal
  backend tappar nya fält tyst. Se backendens `DEPLOY.md`.
