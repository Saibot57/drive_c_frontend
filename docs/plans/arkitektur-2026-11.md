# Arkitektur: refaktoreringssteg efter granskningen 2026-11-09

Status: Pågår

Stegen kommer ur [`docs/architecture-review-2026-11-09.md`](../architecture-review-2026-11-09.md),
avsnitt 8. Rapporten förklarar varför; den här filen säger vad som är gjort.
Varje steg är ungefär en PR och lämnar appen fungerande. Fynd-id:n (F9, N2 …)
är rapportens.

**Den session som gör ett steg** bockar av det här med datum och PR-nummer,
skriver avvikelser under steget och uppdaterar fyndets rad i backend-repots
`docs/granskning-status.md`. "FE" och "BE" säger vilket repo steget rör.

## Snabba vinster

- [x] **1. Dokumenten säger sanningen** (N2, N3; FE och BE). Genomfört
  2026-11-10 (#264, backend #58).
  - Nya `CLAUDE.md` i båda repona, statusregeln i `docs/plans/README.md`, fyra
    planers status rättade, `granskning-status.md` uppdaterad och `DEPLOY.md`
    säger vilken Python som kör vad.
  - Avvikelse: oktoberrapporterna om arkitektur och dataintegritet är dessutom
    kopierade till `docs/arkiv/`, och den här planfilen är tillagd.
- [x] **2. Dela `LessonLab.tsx` mekaniskt** (F9; FE) i `LabSchedule.tsx`,
  `LabTeams.tsx` och `LabDragPreview.tsx`. Genomfört 2026-11-10 (#264).
  `LessonLab.tsx` gick från 1 550 till 597 rader. Ingen kodrad är ändrad
  utöver `export` och namnen nedan; kontrollerat rad för rad mot originalet.
  - Avvikelse: en fjärde fil, `labShared.ts` (46 rader), för det som flera av
    filerna behöver: `DragData`, `ViewContext`, släppmålens id:n, `classColor`
    och `lessonLabel`.
  - Avvikelse: `LabSchedule.tsx` importerar `TeacherChip` från `LabTeams.tsx`,
    eftersom bemanningsraden i en lektion visar lärarbrickor.
  - Namnbyten: `Schedule` → `LabSchedule`, `Teams` → `LabTeams`,
    `DragPreview` → `LabDragPreview`, `DayColumn` → `LabDayColumn`.
  - Inte kontrollerat: att sidan ser likadan ut i webbläsaren. Öppna Arbetslag
    i förhandsvisningen och dra en lektion och en lärare.
- [ ] **3. `api/validation.py` med en gemensam `PayloadError`, felhanterare i
  `create_app` och `tests/test_app_factory.py`** (F7, F4; BE). Flytta
  `narvaro_routes` och `term_routes` först.
- [ ] **4. `services/http.ts` med `http.test.ts`** (F14; FE). Flytta
  `termService` och `narvaroService`.
- [ ] **5. Backendhygien** (F5; BE): ta bort rotskripten och
  `drive_contents.json` enligt rapportens avsnitt 6, spärra
  `requirements.txt`, ta bort `bcrypt`, rätta `ping_connection`.
  Kräver `pip freeze` ur `myenv310` på PythonAnywhere av Tobias.
- [ ] **6. En veckofunktion** (F18; FE): `weekNumberFromName` till Schema,
  `sortArchives` använder den, Närvaro räknar ISO-vecka med
  `dateSv.isoWeekYear`. Tar bort cykeln Schema ↔ Statistik.

## Nästa kvartal

- [ ] **7. `Narvaro.tsx`** (N1; FE): inklistringen till en ren funktion med
  test, därefter JSX-delarna. Efter steg 6.
- [ ] **8. `services/planner_archives.py` med `delete_archive`**, därefter
  `api/planner_public_routes.py` (F16; BE). Efter steg 3.
- [ ] **9. Formtester av svaren**, `tests/test_response_shapes.py` (F12; BE).
  Helst före steg 8.
- [ ] **10. NSP del 1: JSX-regioner** (F13; FE). `PlannerToolbar` först, sedan
  `ArchiveSidebar`, `PlannerContextMenu`, `PlannerModals`. Bara props.
- [ ] **11. NSP del 2: logikhookar** (F13; FE). Efter steg 10.
- [ ] **12. NSP del 3: `useScheduleDocument` med test av läslägesspärren, och
  `useNewScheduleDialog`** (F13, F17; FE). Efter steg 11.
- [ ] **13. Workspace: sektionen Element till egen hook och
  `buildElementMenu` med test** (F15; FE).
- [ ] **14. Resterande services till `http.ts`** (F14; FE), en i taget när
  filen ändras ändå. Efter steg 4.

## Bara om det behövs

Görs inte i förväg. Villkoret står i rapportens avsnitt 8: `elementTypes.ts`
(nästa elementtyp), inställningsregister, `TermPlanner` till `saveQueue`,
`config/features.ts`, delad `workspace.css`, golden files för kontraktet.
Featuremappar, en gemensam sparmotor och OpenAPI rekommenderas inte.
