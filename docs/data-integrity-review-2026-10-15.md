# Granskning av dataintegritet: drive_c_frontend och drive_c_backend

Datum: 2026-10-15. Granskade versioner: frontend `12f466f`, backend `072541e`.
Utgångsläge: båda testsviterna är gröna (`pnpm test` 514/514 och `pytest` 301/301). Inget var rött från början.

Bevis togs fram med tillfälliga tester som nu är borttagna. För klienthookarna användes vitest med jsdom ur scratchpad. För backend användes pytest mot SQLite och en lokal MariaDB 10.11, byggd med äldre tabeller plus `alembic upgrade head`. Inga filer i repona är ändrade utöver den här rapporten.

## Status 2026-10-16

Kontrollerat mot `main` i båda repona: frontend `1897fec`, backend `783f479`.

| Fynd | Åtgärdat i |
|---|---|
| F1 | Frontend #226 (`3897dda`): den köade sparningen använder det senaste schemat |
| F3 | Frontend #226 (`3897dda`) och backend #36 (`bfc6f4f`, migration 021): version på schemat, 409 vid inaktuell flik och en konfliktruta |
| F5 | Frontend #224 (`3424944`): raderingarna i `workspaceService` returnerar `true` |
| F22 | Frontend #224 (`4d9fecb`): notisens "Ångra" och Ctrl+Z kör samma ångring högst en gång |

Övriga fynd är oförändrade i koden. F4 väntar fortfarande på kontroll av `planner_archive`, `planner_archive_share`, `planner_course` och `sql_mode` i produktionen.

---

## 1. Sammanfattning

- Sparflödena i klienten har inget gemensamt skydd. Planeraren, temahjulet och kalendern kan var för sig tappa den senaste ändringen eller skriva tillbaka en äldre. Indikatorn visar då ofta "Sparat" (F1, F2, F8–F12).
- Delade scheman har lås per **användare** men ingen version. Samma lärare i två flikar eller på två datorer skriver därför över sig själv utan varning (F3). `client_id` används bara för att ge posterna stabila id, inte för att upptäcka konflikter.
- Fältlängder i schemaplaneraren valideras inte. En titel över 150 tecken gör att hela veckan avvisas i strikt läge och kapas tyst i icke-strikt läge, vilket är bevisat mot MariaDB (F13). `planner_activity` är `utf8mb4` i produktionen. En databas som byggs enbart av migrationerna blir däremot `utf8mb3`, så schemat har ändrats förbi Alembic (F4, F21).
- I workspace tolkas lyckade raderingar som misslyckade (F5). Ett sent svar vid ytbyte gör att en annan ytas kort redigeras och raderas (F6). Innehåll över 64 kB kapas till trasig JSON eller ger 500 (F7).
- Migrationerna har en enda head, men de kan inte bygga databasen från noll. Basen kommer från `db.create_all()` vid varje uppstart. Tre skript i backendens rot är farliga att köra av misstag (F20, F21).

---

## 2. Fyndtabell

| ID | Allv. | Status | Repo | Fil:rad | Rubrik |
|---|---|---|---|---|---|
| F1 | Kritisk | **Åtgärdat** (Bevisat) | FE | `src/hooks/usePlannerSync.ts:250` | En ändring som görs medan en sparning pågår sparas aldrig, och indikatorn visar "Sparat" |
| F2 | Kritisk | Bevisat | FE | `src/hooks/useCalendarAutosave.ts:69` | En äldre misslyckad sparning läggs tillbaka i kön och skriver över nyare text |
| F3 | Kritisk | **Åtgärdat** (Bevisat) | BE+FE | `api/planner_routes.py:320`, `:571` | Samma användare i två flikar eller på två enheter skriver tyst över ett delat schema |
| F4 | Medel | Delvis motbevisat¹ | BE | `migrations/versions/011_…py:82`, `models/planner_models.py` | Migrationerna ger `utf8mb3` för planner-tabellerna, men produktionen har `utf8mb4` för `planner_activity`. Övriga tabeller är overifierade |
| F5 | Hög | **Åtgärdat** (Bevisat) | FE | `src/app/workspace/_feature/hooks/useWorkspaceData.ts:974`, `:1008`, `:313` | Lyckade raderingar tolkas som fel eftersom `void`-svaret blir `undefined` |
| F6 | Hög | Bevisat | FE | `useWorkspaceData.ts:169` | Ett sent svar vid ytbyte lägger fel ytas kort på den aktiva ytan, och radering eller flytt träffar den andra ytan |
| F7 | Hög | Bevisat (MariaDB) | BE | `api/workspace_routes.py:312-327`, `:291-309`, `:435` | Ingen storlekskontroll på elementinnehåll eller titel: 500 vid varje sparning, eller trasig JSON för alltid |
| F8 | Hög | Bevisat | FE | `src/hooks/useThemeWheelSync.ts:224` | Hjulbyte eller att lämna sidan inom autosparets sekund kastar ändringen |
| F9 | Hög | Bevisat | FE | `usePlannerSync.ts:265`, `useArchiveManager.ts:220` | Planeraren tömmer inget vid stängning eller sidbyte, men släpper låset |
| F10 | Hög | Bevisat | FE | `usePlannerSync.ts:245`, `useArchiveManager.ts:148` | Ett misslyckat autospar försöker aldrig igen och visar ingen notis. Byter man schema försvinner ändringen |
| F11 | Medel | Bevisat | FE | `usePlannerSync.ts:217` | Ett tömt schema sparas aldrig: posterna kommer tillbaka och indikatorn säger "Sparat" |
| F12 | Hög | Bevisat² / Spårat | FE | `useThemeWheelSync.ts:199`, `useWorkspaceData.ts:85`, `useCalendarAutosave.ts:57` | Inget ordningsskydd: två sparningar av samma resurs kan vara i flykt samtidigt |
| F13 | Hög | Bevisat (MariaDB) | BE+FE | `api/planner_routes.py:184-208` | Längd och sluttid valideras inte: hela veckan avvisas, eller titeln kapas tyst och längden blir negativ |
| F14 | Medel | Spårat | FE | `src/services/authService.ts:74` | Vid 401 sker en omedelbar hård omdirigering, och allt osparat kastas |
| F15 | Medel | Spårat | FE | `src/hooks/useCalendarData.ts:48`, `:76` | Månadshämtningen kan skriva över lokalt inskriven text |
| F16 | Medel | Spårat | FE | `src/components/schedule/PublicLinkControl.tsx:92`, `:165` | Publika länkens färg- och salsregler skrivs över från en annan enhets localStorage |
| F17 | Medel | Spårat | BE | `services/db_retry.py:49` | Deterministiska `OperationalError` körs om tre gånger. Retry dubblerar ingenting (verifierat) |
| F18 | Låg | Spårat | BE | `api/month_calendar_routes.py:199-214` | Två första sparningar för samma dag ger `IntegrityError` och 500 |
| F19 | Låg | Bevisat (MariaDB) | BE | `models/month_calendar_models.py:36` | Taket 65 536 byte är en byte större än `TEXT`: anteckningen försvinner tyst |
| F20 | Medel | Spårat | BE | `timestamp_migration.py`, `migration.py`, `update_data.py` | Skript som inte är idempotenta, eller som ger "admin" andras rader |
| F21 | Medel | Spårat | BE | `app.py:185`, `init_db.py:12` | `create_all()` vid varje uppstart skapar tabeller förbi Alembic, med fel teckenuppsättning |
| F22 | Låg | **Åtgärdat** (Spårat) | FE | `useWorkspaceData.ts:979`, `:996` | "Ångra" i notisen följt av Ctrl+Z lägger tillbaka kortet två gånger (döljs i dag av F5) |
| F23 | Låg | Spårat | BE | `api/planner_routes.py:607` | Ett PUT i flykt kan ta tillbaka låset efter att fliken släppt det vid stängning |
| F24 | Låg | Spårat | FE | `useThemeWheelSync.ts:167` | Ett lokalt hjulutkast som inte är knutet till någon användare laddas upp i det konto som öppnar först |
| F25 | Låg | Spårat | FE | `src/app/workspace/_feature/hooks/useProvenance.ts:34` | Ett äldre kort vars källschema raderats töms av "Uppdatera från källan" |
| F26 | Låg | Spårat | BE | `api/workspace_routes.py:122` | `element_count` räknar mjukraderade element, så raderingsdialogen överdriver |
| F27 | Låg | Misstänkt | FE+BE | `src/services/arbetslagService.ts` (`toPlan`), `api/arbetslag_routes.py:84` | Servern godtar ett läge som klienten inte kan läsa. Klienten visar då demotavlan, som kan sparas över |

¹ `SHOW CREATE TABLE planner_activity` i produktionen visar `utf8mb4_unicode_ci`, så emoji i poster fungerar där. `planner_archive`, `planner_archive_share` och `planner_course` är inte kontrollerade.
² Samtidigheten är bevisad. Att servern verkligen kastar om ordningen är spårat, inte kört.

---

## 3. Fynd

### F1 – En ändring som görs medan en sparning pågår sparas aldrig (Kritisk, Bevisat)

**Åtgärdat 2026-10-16**, se Status överst.

**Scenario**
1. Läraren flyttar posten A. Efter 1 s skickar autosparet `PUT /archives/<id>/activities` med A.
2. Servern är långsam, över en sekund, vilket räcker med ett helt veckoschema på PythonAnywhere. Under tiden lägger läraren till B.
3. B:s timer går medan sparningen pågår. `performAutosave` sätter `pendingSaveRef = true` och returnerar.
4. Sparningen av A blir klar. `finally` anropar `performAutosave` igen, men det är den *gamla* closure som fångade schemat från steg 1 (`usePlannerSync.ts:250-254`). Signaturen är lika med den senast sparade, så funktionen returnerar utan att göra något.
5. Effekten körs inte om, eftersom inga av dess beroenden har ändrats. B ligger kvar i vyn med statusen "saved". Vid omladdning, stängning eller när en kollega öppnar schemat är B borta.

**Konsekvens:** tyst dataförlust i det mest använda verktyget.

**Belägg** (tillfälligt test, nu borttaget):
```ts
h.rerender(base([entry('a','A')]));             // autospar 1 hänger
await act(async () => { vi.advanceTimersByTime(1000); });
h.rerender(base([entry('a','A'), entry('b','B')]));
await act(async () => { vi.advanceTimersByTime(1000); });   // pending = true
await act(async () => { resolveFirst(); }); ... advanceTimersByTime(10_000)
// utskrift: skickade sparningar: [["A"]] status: saved
```

**Minimal fix:** låt det köade anropet läsa det senaste schemat. Lägg `schedule` i en ref (`scheduleRef.current = schedule`) som `pushSchedule` och signaturkontrollen läser, eller schemalägg om via en state-räknare som triggar effekten. Gör hellre om sparningen till en kö som labPlanStore, som redan löser detta korrekt.

---

### F2 – Kalendern skriver tillbaka en äldre text (Kritisk, Bevisat)

**Scenario**
1. Användaren skriver "abc" i en dag. Efter 600 ms skickas PATCH #1, som hänger, till exempel på grund av dåligt wifi.
2. Användaren skriver vidare till "abcd". PATCH #2 skickas medan #1 fortfarande är i flykt (`send` serialiserar inte per dag) och lyckas. Servern har nu "abcd".
3. #1 misslyckas. `catch` slår ihop `{...patch, ...(newer ?? {})}` (`useCalendarAutosave.ts:69`), men `newer` är tom eftersom #2 redan skickats. "abc" läggs tillbaka i kön.
4. När användaren trycker "Försök igen", byter månad eller lämnar sidan (unmount anropar `flushAll(true)`) skickas "abc". Servern slutar med "abc" medan editorn visar "abcd".

**Belägg:** testet loggade `anrop: [{"quick_text":"abc"},{"quick_text":"abcd"},{"quick_text":"abc"}] server: abc`.

**Minimal fix:** håll en sekvensräknare per dag. Lägg bara tillbaka en patch om ingen senare sändning för samma dag har lyckats. Ännu bättre är att serialisera per dag (ett anrop i flykt åt gången, resten väntar och slås ihop).

---

### F3 – Samma användare i två flikar skriver över ett delat schema (Kritisk, Bevisat)

**Åtgärdat 2026-10-16**, se Status överst.

**Scenario**
1. Läraren har v.35 öppet på skolans dator och lämnar fliken.
2. Hemma öppnar läraren v.35 igen. `acquireArchiveLock` lyckas eftersom låset redan är hens eget (`_lock_holder`, `planner_routes.py:320`). Läraren lägger in en ny lektion och den sparas.
3. Nästa morgon drar läraren i en post i den gamla fliken. Autosparet skickar *hela* den gamla veckan. `PUT` gör en fullständig ersättning utan version (`:563-614`), och kvällens lektion försvinner utan varning.

Samma sak gäller om två tabbar är öppna samtidigt. `client_id` (migration 012) används bara för att ge posterna stabila id (`_derive_activity_id`), aldrig för att upptäcka konflikter.

**Belägg:** pytest `r1 = PUT [A]`, sedan `r2 = PUT [B]` från ett inaktuellt läge. Båda gav 200, och kvar fanns `['B']`.

**Minimal fix:** gör som arbetslag. Lägg `version` på `planner_archive`, skicka den från klienten och gör `UPDATE … WHERE version = :v`. Vid 409 visar klienten en konflikt i stället för att skriva. Ett billigare alternativ är att knyta låset till en flik-id (`locked_by_session`) i stället för till användaren.

---

### F4 – Migrationerna och produktionen har olika teckenuppsättning (Medel, delvis motbevisat)

**Rättelse efter kontroll i produktionen:** `SHOW CREATE TABLE planner_activity` visar `DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci` på tabellen och alla textkolumner. Emoji i postens titel, lärare, sal och anteckningar fungerar alltså i produktionen. Den första versionen av fyndet, att hela veckan avvisas vid en emoji, gäller inte där.

**Vad som återstår:**
- **Migrationerna beskriver inte produktionen.** Byggd enbart ur Alembic (MariaDB med `utf8` som standard) blir `planner_activity`, `planner_course`, `planner_archive` och `planner_archive_share` `utf8mb3`. Ingen migration konverterar dem, och modellerna saknar `mysql_charset`. Produktionen har alltså konverterats för hand, utanför Alembic (se F21). En återställning från backup in i en ny databas, eller en testmiljö byggd med migrationerna, beter sig därför annorlunda än produktionen. Där gäller de uppmätta effekterna nedan.
- **Tre tabeller är inte kontrollerade:** `planner_archive`, `planner_archive_share` och `planner_course`. Är `planner_archive` fortfarande `utf8mb3` ger ett arkivnamn med emoji 500 i båda lägena. Dubblettkontrollen (`:533`) jämför då en `utf8mb3`-kolumn med en `utf8mb4`-sträng, vilket ger 1267 "Illegal mix of collations", och retry kör om felet tre gånger (F17).
- **Blandade kollationer:** produktionen använder `utf8mb4_unicode_ci` (som 016–018), medan 001, 004, 007, 014 och 015 skapar `utf8mb4_general_ci`. Ingen nuvarande fråga jämför kolumner mellan sådana tabeller, men en framtida JOIN mellan till exempel `planner_activity` och `planner_public_link` kan ge 1267.

**Uppmätt i en databas byggd enbart med migrationerna** (inte produktionen):

| Åtgärd | `STRICT_TRANS_TABLES` | `sql_mode=''` |
|---|---|---|
| PUT en post med titel `Matte 🎉` | 400, hela veckan avvisas | 200, sparas som `Matte ?` |
| Skapa arkivet `Utflykt 🚌` | 500 (1267, körs om tre gånger) | 500, samma |

**Bekräfta resten:**
```sql
SELECT table_name, table_collation FROM information_schema.tables
WHERE table_schema = DATABASE() ORDER BY table_name;
SELECT table_name, column_name, character_set_name FROM information_schema.columns
WHERE table_schema = DATABASE() AND character_set_name IS NOT NULL AND character_set_name <> 'utf8mb4';
SELECT @@sql_mode;
```

**Minimal fix:** skriv en migration som för varje tabell som inte redan är `utf8mb4` gör `CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`. Den bör hoppa över tabeller som redan konverterats, så att den är ofarlig i produktionen och rättar nya miljöer. Lägg till `mysql_charset` och `mysql_collate` i modellernas `__table_args__`.

---|---|---|
| PUT en post med titel `Matte 🎉` | **400, hela veckan avvisas** | 200, sparas som `Matte ?` |
| Anteckning `Ta med 📐` | 400, hela veckan | 200, `Ta med ?` |
| Skapa arkivet `Utflykt 🚌` | 500 (`1267 Illegal mix of collations` i dubblettkontrollen `:533`, körs först om 3 gånger, se F17) | 500, samma |

**Konsekvens i klienten:** i strikt läge fastnar autosparet på `error` för varje sparning så länge emojin finns kvar. Det visas ingen notis (F10), och allt som ändrats sedan dess försvinner vid omladdning. I icke-strikt läge manglas tecknen tyst.

**Bekräfta i produktionen:** kör `SHOW CREATE TABLE planner_activity; SELECT @@sql_mode;`.

**Minimal fix:** skriv en ny migration `ALTER TABLE planner_activity, planner_course, planner_archive, planner_archive_share CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`. Kontrollera först att indexlängderna ryms: `name` är VARCHAR(150) × 4 = 600 byte, vilket är under InnoDB:s 3072. Lägg till `mysql_charset` i `__table_args__` för samtliga modeller.

---

### F5 – Lyckade raderingar i workspace tolkas som fel (Hög, Bevisat)

**Åtgärdat 2026-10-16**, se Status överst.

`workspaceService.deletePlacement`, `deleteElement` och `deleteSurface` returnerar `Promise<void>`. `track()` returnerar därför `undefined` när anropet lyckas, och anropen kontrollerar `if (!ok)`.

- **`removePlacement` (`:974`):** servern raderar placeringen, men klienten lägger tillbaka kortet (`ADD_PLACEMENT p`) och returnerar. Ingen ångra-post, ingen notis, och statusen visar "Sparat". Kortet syns kvar men finns inte i databasen. Nästa flytt eller borttagning ger 404 "Placement not found".
- **`deleteElement` (`:1008`):** elementet mjukraderas och ytan läses om, så kortet försvinner. Men ingen ångra-post och ingen "Ångra"-notis registreras, och det finns ingen annan väg till `restore` i UI:t. Raderingen blir i praktiken oåterkallelig för användaren, även om raden finns kvar i databasen.
- **`deleteSurface` (`:313`):** ytan raderas och `loadSurfaces()` körs, men `activeSurfaceId` pekar fortfarande på den raderade ytan och de gamla korten ligger kvar. Nya kort ger 404 "Surface not found".

**Belägg:** testet loggade `kvar i UI: ['p1'] | canUndo: false | notis: null | status: saved`, och för `deleteElement`: `canUndo: false | notis: null`.

**Minimal fix:** låt de tre metoderna returnera `true`, eller jämför `ok === null` i stället för `!ok`. Åtgärda F22 samtidigt.

---

### F6 – Ett sent svar vid ytbyte blandar ihop ytor (Hög, Bevisat)

**Scenario:** användaren klickar på flik B och direkt på flik C. C:s `getSurfaceElements` svarar först. B:s svar kommer sist och gör `SET_PLACEMENTS` med B:s kort, eftersom `loadSurfaceElements` (`:164-174`) inte kontrollerar att ytan fortfarande är aktiv och reducern inte heller filtrerar. Vyn visar nu B:s kort med C som aktiv yta. Om användaren "tar bort från ytan" raderas B:s placering, och en flytt ändrar B:s layout.

Samma glapp finns i `createAndPlaceElement` och `placeFromLibrary`. Byter man yta mellan de två anropen hamnar `ADD_PLACEMENT` i fel vy fram till omladdning.

**Belägg:** testet loggade `aktiv yta: C visade placeringar: ['b1@B']`, och `deletePlacement` anropades med `b1`.

**Minimal fix:** i `loadSurfaceElements`, avbryt om `stateRef.current.activeSurfaceId !== surfaceId` efter `await`. Ett alternativ är en `requestId` som i `useCalendarData`. Töm placeringarna i `SET_ACTIVE_SURFACE`.

---

### F7 – Ingen storlekskontroll på workspace-innehåll (Hög, Bevisat mot MariaDB)

`create_element` och `update_element` saknar den kontroll som `bulk_place` har (`:435`). Kontrollen i `bulk_place` mäter dessutom *tecken* och inte byte, så 59 000 `å` (cirka 118 kB) släpps igenom (bevisat, 201). Titeln (`String(255)`) har ingen längdkontroll alls.

| Åtgärd (MariaDB) | Strikt | Icke-strikt |
|---|---|---|
| PUT `content` 80 kB | **500** (`DataError`), och varje följande autospar fallerar | 200. Läses tillbaka som `str` med 32 779 tecken, alltså kapad och ogiltig JSON, eftersom `get_content` faller tillbaka på råsträngen. Kortet är trasigt för alltid |
| PUT `title` 300 tecken + `content` | 500, och *innehållet* sparas inte heller | 200, titeln kapas till 255 |

Rubriker speglar texten i `title` (`useWorkspaceData.ts` `updateElementContent`), så en lång rubrik fäller även innehållssparningen i strikt läge.

**Minimal fix:** mät `len(json.dumps(content, ensure_ascii=False).encode('utf-8'))` mot ett tak på 60 000 byte i alla tre routes och svara 413. Korta eller avvisa titlar över 255 tecken. Byt på sikt kolumnen till `MEDIUMTEXT`, som `arbetslag_plan.state`.

---

### F8 – Temahjulet kastar väntande ändringar (Hög, Bevisat)

Autosparet är en `setTimeout` i en effekt med `wheel` som beroende (`useThemeWheelSync.ts:193-225`). Effektens cleanup rensar timern.

- **Byta hjul:** `selectWheel` anropar `adopt` och `commit(nytt hjul)`. Cleanup rensar timern för det gamla hjulet, och den nya körningen ser ingen skillnad. Ändringen är borta.
- **Lämna sidan eller stänga fliken:** cleanup rensar timern. Det finns ingen flush, ingen `pagehide` och ingen `beforeunload`.

Biblioteket (`manualAreas`, `:229-249`) har samma mönster.

**Belägg:** testet loggade `updateWheel-anrop: 0 aktivt: B` efter en namnändring, 400 ms och sedan byte till B. Även vid unmount blev det 0 anrop.

**Minimal fix:** spara i förtid (`await updateWheel(...)` om snapshoten skiljer sig) i `selectWheel`, `createWheel`, `deleteWheel` och vid unmount. Lägg till `pagehide`/`visibilitychange` med `keepalive`, som i workspace.

### F9 – Planeraren tömmer inget när sidan lämnas (Hög, Bevisat)

`usePlannerSync` rensar timern vid unmount (`:265`). `useArchiveManager` skickar då `releaseArchiveLockOnUnload` (`:216-226`) men inte det osparade schemat. En ändring gjord mindre än 1 s före stängning eller SPA-navigering försvinner, och låset släpps ändå. Testet bevisade att 0 anrop görs efter unmount. `saveNow` finns redan (`:181`).

**Minimal fix:** anropa `saveNow()` med `keepalive` i samma `pagehide`-handler, före låssläppet. Body-gränsen för `keepalive` är 64 kB; en vecka på ett par hundra poster ryms.

### F10 – Ett misslyckat autospar ger ingen notis och inget nytt försök (Hög, Bevisat)

Vid nätfel eller 500 sätts bara `setSaveStatus('error')` och `console.error` (`:245`). Inget nytt försök görs förrän nästa ändring. Testet bevisade 1 försök på 60 s med statusen `error`. Ändringen finns kvar i minnet, men det finns ingen `beforeunload`-varning, så den försvinner vid stängning.

Vid schemabyte visar `saveBeforeSwitching` bara "Den senaste ändringen sparades inte." (`useArchiveManager.ts:148`) och byter ändå. Det osparade schemat ersätts av det nya.

**Minimal fix:** försök igen med backoff (till exempel 2, 4 och 8 s). Lägg till en `beforeunload`-varning när statusen är `error` eller en sparning väntar. Avbryt bytet, eller fråga användaren, om `saveNow` returnerar false.

### F11 – Ett tömt schema sparas aldrig (Medel, Bevisat)

`if (schedule.length === 0) return;` (`usePlannerSync.ts:217`). Raderar läraren veckans sista post visar rutnätet ett tomt schema med statusen "Sparat", men servern behåller posterna. De kommer tillbaka vid omladdning och syns för kollegor och på den publika länken. Testet bevisade att det blev 1 sparning (före tömningen) och 0 efter.

`saveNow` saknar spärren, så vid schemabyte sparas tömningen. Beteendet är alltså dessutom inkonsekvent.

**Minimal fix:** ta bort spärren. Skyddet mot att skriva tomt efter en misslyckad inläsning finns redan i `loadStatus !== 'loaded'`.

### F12 – Inget ordningsskydd i temahjulet, workspace och kalendern (Hög, Bevisat för samtidighet, Spårat för omkastning)

- **Temahjulet:** testet visade två `PUT /wheels/<id>` i flykt samtidigt (`['v1','v2']`). Den som committas sist på servern vinner. `syncedWheelRef` sätts av det svar som *anländer* sist (`:203`). Om v1 committas efter v2, vilket är möjligt med flera webbworkers, har servern v1 medan klienten visar v2 med statusen "saved". Effekten körs inte om.
- **Workspace:** `debounced` (`useWorkspaceData.ts:79-93`) låter en ny skrivning med samma nyckel starta medan den förra är i flykt. Det finns ingen sekvens och ingen kö.
- **Kalendern:** se F2. Två PATCH för samma dag är samtidigt i flykt (bevisat).
- Planeraren (`isSavingRef`) och arbetslag (`labPlanStore`, version) är serialiserade och påverkas inte.

**Minimal fix:** återanvänd labPlanStore-mönstret, alltså ett anrop i flykt per resurs, där det senaste värdet skickas efteråt. Mönstret behöver inga ändringar i backend.

### F13 – Planner validerar inte längd och tider (Hög, Bevisat mot MariaDB)

`_build_activities` (`planner_routes.py:184-208`) kontrollerar bara att fälten finns och att tiderna har formatet `HH:MM`. Klienten har ingen `maxLength` på titel, lärare eller sal.

- En titel på 400 tecken ger **400 för hela veckan** i strikt läge (uppmätt) och kapas tyst till 150 i icke-strikt läge (uppmätt).
- Sluttid före starttid godtas, och `duration = -60` lagras (bevisat i SQLite). Klienten varnar i formuläret, men import och tangentbordsflyttar går förbi kontrollen.

**Minimal fix:** validera längder (150, 150, 150, `day` ≤ 20, `color` ≤ 7, `category` ≤ 255) och kräv `end > start`. Svara 400 med *vilken* post som är fel, och sätt `maxLength` i formulären.

### F14 – Vid 401 kastas allt osparat (Medel, Spårat)

`fetchWithAuth` (`authService.ts:69-76`) gör `window.location.href = '/login'` direkt. JWT:n gäller 7 dagar. Om en sparning får 401 när token gått ut laddas sidan om: väntande debounce, workspace-skrivningar och osparade planner-ändringar försvinner. Kön i arbetslag överlever inte heller en full sidladdning.

**Fix:** spara vid 401 det osparade i `sessionStorage` (eller visa ett inloggningsfönster) och kör om efter inloggning, i stället för en hård omdirigering mitt i en sparning.

### F15 – Månadshämtningen skriver över lokal text (Medel, Spårat)

`dirty.current.delete(key)` körs när *en* sparning lyckats (`useCalendarData.ts:48`), även om nya tangenttryck väntar i kön. Om månadens första `getDays`, som är långsam, landar efter det är dagen inte längre markerad som dirty. `next.set(day.local_date, day)` (`:76`) ersätter då editorns text med serverns äldre text. Nästa tangenttryck bygger vidare på den gamla texten, och den mellanliggande inskriften går förlorad.

**Fix:** ta bara bort markeringen när `pending` saknar nyckeln, alltså fråga autosparet med `hasPending(key)`.

### F16 – Publika länkens regler skrivs över från en annan enhet (Medel, Spårat)

`displayConfigWith` (`PublicLinkControl.tsx:92`) tar färg- och salsreglerna från `useHiddenSettings`, som bara finns i localStorage (`app.color_triggers.v1`, …). Nycklarna är inte knutna till användaren och synkas inte.

- Riktar läraren om länken till veckans schema från en annan dator (`handlePoint`, `:165`) skrivs `displayConfig` över med den datorns, ofta tomma, regler. Alla elever ser då andra färger och salar.
- På en delad dator hamnar en annan lärares regler i den här lärarens länk.

**Fix:** skicka bara `colorTriggers`/`roomTriggers` när de faktiskt ändrats på den här enheten (spegelns signatur). Låt annars serverns värde stå kvar.

### F17 – Retry körs om vid deterministiska fel (Medel, Spårat)

`retry_on_connection_error` fångar *alla* `OperationalError`. Där ingår 1267 ("Illegal mix of collations", F4), som PyMySQL rapporterar som `OperationalError` (uppmätt). Felet körs då om tre gånger med 0,5 s paus och blir sedan 500. `rate_limit.check` räknas en gång per försök.

**Ingen dubblering:** alla routes committar högst en gång, utom kalenderns `_get_or_create_settings`, som committar två gånger. Den skyddas av flaggan `before_commit`. Ett nytt försök görs bara före commit, så retry ger inga dubbletter.

**Fix:** gör bara om för anslutningsfel (2006, 2013, 2055, 1213 deadlock, 1205 lock wait).

### F18 – Två första sparningar för samma kalenderdag krockar (Låg, Spårat)

`update_day` gör `SELECT`, sedan `INSERT` om raden saknas (`:195-214`). En markering (`saveNow`) och en debouncad text för en tom dag kan gå samtidigt. Den ena får `IntegrityError` på `uq_calendar_day_user_date` och blir 500. Klienten lägger tillbaka patchen (bra), men statusen blir "fel" och patchen skickas först vid nästa flush eller retry.

**Fix:** fånga `IntegrityError`, läs om raden och applicera patchen igen.

### F19 – Kalenderns tak är en byte för stort (Låg, Bevisat mot MariaDB)

`MAX_NOTE_DOCUMENT_BYTES = 64*1024 = 65536`, men `TEXT` rymmer 65 535 byte. Ett dokument på exakt 65 536 byte ger 500 i strikt läge. I icke-strikt läge blir det **200 men `note_document` läses tillbaka som `None`**, eftersom den kapade JSON:en inte går att tolka (uppmätt).

**Fix:** sätt taket till `65535` eller lägre.

### F20 – Rotskript som är farliga att köra av misstag (Medel, Spårat)

- `timestamp_migration.py` konverterar *alla* `calendar_events` från Stockholmstid till UTC utan att markera vad som redan är konverterat. Varje körning flyttar händelserna ytterligare 1–2 timmar.
- `migration.py` och `update_data.py` sätter `user_id = admin` på alla rader i `calendar_events`, `day_notes` och `drive_files` där `user_id` är NULL (eller `''`). Rader som saknar ägare skulle hamna hos admin.
- Alla rotskript importerar `app`, som kör `db.create_all()` vid import (se F21). Själva rå-SQL:en i `add_column.py` och `migration.py` fallerar på SQLAlchemy 2, eftersom `execute("…")` saknar `text()` respektive `engine.execute` inte finns. Den gör alltså ingenting, men det framgår inte av utskriften.

**Fix:** flytta skripten till `scripts/legacy/` med en tydlig spärr (`if os.getenv('I_KNOW') != '1': sys.exit`) eller ta bort dem. Datan de rör hör till borttagna funktioner.

### F21 – `create_all()` förbi Alembic (Medel, Spårat)

`app.py:185` kör `db.create_all()` vid varje import av appen, och `init_db.py` gör samma sak. Tabeller skapas då från modellerna. De flesta modeller saknar `mysql_charset`, så resultatet blir `utf8mb3` med databasens standard. Server-defaults, bland annat `ON UPDATE CURRENT_TIMESTAMP`, saknas.

Migrationerna 007, 011 och 014–019 hoppar över tabeller som redan finns (`_has_table`) och stämplar versionen ändå. Startas appen före `alembic upgrade` får produktionen alltså ett annat schema än en migrerad databas, utan att något syns. Theme-tabellerna är ett exempel som 007 självt nämner. F4 visar att driften är verklig: produktionens `planner_activity` är `utf8mb4_unicode_ci`, vilket ingen migration ger, så tabellen har konverterats för hand.

**Fix:** ta bort `create_all` ur `app.py` (behåll det i testerna). Lägg till en kontroll vid uppstart att `alembic current` är lika med `head`.

### F22 – "Ångra" två gånger dubblerar en placering (Låg, Spårat)

**Åtgärdat 2026-10-16**, se Status överst.

`removePlacement` registrerar samma `restore` både i notisknappen (`:996`) och i ångra-stacken (`:993`). Klick på "Ångra" följt av Ctrl+Z skapar två nya placeringar av samma element på samma yta. `restore` skapar dessutom en placering med *nytt* id, så äldre ångra-poster som pekar på det gamla id:t ger 404.

I dag döljs felet av F5, men det dyker upp så fort F5 är fixat. (`deleteElement` har samma mönster men är idempotent, eftersom `restore` bara nollar `deleted_at`.)

**Fix:** låt notisknappen anropa `undo()` och plocka posten från stacken, eller markera posten som förbrukad.

### F23 – Ett PUT i flykt tar tillbaka låset (Låg, Spårat)

Vid stängning skickas `DELETE /lock` med `keepalive` samtidigt som ett autospar kan vara i flykt. Committas PUT efter låssläppet anropar den `_claim_lock` (`:607`), och schemat står som låst av någon som gått. Låset förfaller inte av sig självt, så kollegorna måste "ta över".

**Fix:** låt PUT bara behålla låset om användaren redan har det (`locked_by_id == current_user.id`) och inte ta det om det är ledigt. Ett alternativ är en tidsgräns på låset.

### F24 – Lokalt hjulutkast hamnar i fel konto (Låg, Spårat)

`readLocalDraft()` (`:167`) läser `theme_wheel_draft_v1`, som inte är knutet till någon användare, och laddar upp det i det konto som först öppnar temakalendern utan egna hjul. Utloggning rensar bara auth-nycklarna (`authService.ts:42-45`).

Konsekvensen är "data hos fel användare", men felet kräver ett utkast från före molnsynken och en delad webbläsare. Inget skriver längre nyckeln. **Fix:** ta bort uppladdningen av utkastet, eller rensa nyckeln vid utloggning.

### F25 – "Uppdatera från källan" tömmer äldre kort (Låg, Spårat)

För kort utan `archiveId` hämtar `fetchSchedule` på namn (`useProvenance.ts:34-37`). Är schemat raderat svarar servern `[]` och inte 404, så `found: true, activities: []`. Kortet markeras som inaktuellt, och om användaren uppdaterar töms dagen. Ångra finns.

**Fix:** behandla en tom träff på namn som `missing`.

### F26 – `element_count` räknar mjukraderade element (Låg, Spårat)

`get_surfaces` (`workspace_routes.py:122-127`) räknar placeringar oavsett om elementet är mjukraderat. Bekräftelsen vid radering av en yta överdriver därför vad som försvinner.

### F27 – Servern godtar ett läge som klienten inte kan läsa (Låg, Misstänkt)

`_state_json` kräver listor för `teachers`, `teams`, `template` och `weeks`, men inte för `classes`. `parseLabState` returnerar `null` när `classes` är tom, och `toPlan` visar då `LAB_SEED`. Börjar någon redigera sparas demotavlan över upplägget med rätt version.

UI:t kan i dag inte tömma `classes`, så felet kräver ett läge skrivet av en annan klient eller ett API-anrop. **Fix:** spärra sparning (läsläge) när `toPlan` har fallit tillbaka på seed. Validera `classes` även på servern.

---

### Kontrakt i dataflödet (fokusområde 4)

**Workspace-element:** editor → `updateElementContent` → `workspaceService.updateElement({content, title?})` → `PUT /elements/<id>` → `set_content(json.dumps(ensure_ascii=False))` → `TEXT` (utf8mb4) → `to_dict().content` via `get_content` → klient.
- Tom titel ignoreras tyst, och den gamla titeln behålls (`strip() or element.title`). Titlar över 255 tecken och innehåll över 64 kB hanteras enligt F7. Är JSON:en ogiltig ändras typen från objekt till sträng (F7). Svaret på PUT används inte av klienten, vilket är bra med tanke på F12.

**Planner-aktivitet:** rutnät (`ScheduledEntry`) → `mapScheduleToPlannerActivities` (`id = instanceId`, `notes ?? ''`) → `PUT /archives/<id>/activities` → `_build_activities` → `planner_activity` (utf8mb3) → `_serialize_activity` → `mapPlannerActivitiesToSchedule` → `sanitizeScheduleImport`.
- **id byter värde:** `id` blir `uuid5(arkiv, client_id)`. Klienten behåller sitt `instanceId` tills nästa inläsning, då `id` blir det härledda. Därefter är id:t stabilt. Det har ingen dataeffekt, eftersom klienten inte stämmer av id efter sparning.
- **duration:** klientens `duration` ignoreras och räknas om ur tiderna, och kan bli negativ (F13).
- **Strängfält och laneOrder:** `title` och `day` trimmas. `teacher`, `room` och `notes` blir `None → ""`. `laneOrder` som inte är ett heltal blir `None`, och värden över 1000 kapas till 1000.
- **Vid inläsning:** `color = null` får en genererad färg som sparas vid nästa skrivning. En okänd `day` blir **måndag**: `sanitizeScheduleImport` flyttar posten tyst, och nästa sparning permanentar flytten. `PLANNER_DAYS` innehåller bara måndag till fredag, och backend godtar vilken sträng som helst.
- Teckengränser: se F13. Teckenuppsättning: `utf8mb4` i produktionen (F4).

**Arbetslag:** formulär och tavla → `commit` (tvättas genom `parseLabState`) → `labPlanStore.schedule` → `PUT /arbetslag/<id>` `{version, state}` → `_state_json` (form och storlek) → `MEDIUMTEXT` utf8mb4 → `state_dict()` (`{}` vid trasig JSON) → `toPlan`/`parseLabState`.
- Klientens tvätt tar bort referenser (till exempel medlemmar som inte är lärare) och sparar resultatet, så det som tvättas bort permanentas. Det är avsiktligt.
- Ett tomt eller oläsbart läge ersätts av `LAB_SEED` (F27).
- Versionskontrollen är atomär (`UPDATE … WHERE version`). Det här är det enda flödet med korrekt konflikthantering.

---

## 4. Sparflödesmatris

| Hook / flöde | Debounce | Ordningsskydd | Felhantering | När användaren lämnar sidan | Konflikthantering |
|---|---|---|---|---|---|
| `usePlannerSync` (+ `useArchiveManager`) | 1000 ms, timern startas om vid varje ändring | Ett anrop i flykt (`isSavingRef`), men köat anrop har fel closure (**F1**) | Status `error`, ingen notis, inget nytt försök (**F10**). 409 vid lås ger notis och läsläge. 401 ger omdirigering (**F14**) | Timern rensas, ingen flush, låset släpps (**F9**). `saveNow` före schemabyte | Mjukt lås per *användare*, ingen version, så fullständig ersättning vinner (**F3**). `client_id` används inte för konflikter |
| `useThemeWheelSync` (hjul) | 1000 ms | Inget, flera PUT samtidigt (**F12**) | Status `error` och notis, inget nytt försök. 409 (id-krock) ger "Ladda om" och förlust | Timern rensas, ingen flush (**F8**), även vid hjulbyte | Inget. Hjulen är personliga, men två flikar ger last-write-wins |
| `useThemeWheelSync` (bibliotek) | 1000 ms | Inget | Notis, inget nytt försök | Timern rensas, ingen flush | Ersätter hela biblioteket, last-write-wins mellan flikar |
| `useCalendarAutosave` / `useCalendarData` | 600 ms per dag, markering direkt | Inget, flera PATCH per dag (**F2**) | Patchen läggs tillbaka, `retry`-knapp, men en äldre patch kan återuppstå (**F2**) | `beforeunload` och unmount kör `flushAll(keepalive)` (gräns 64 kB) | Fält-PATCH, last-write-wins per fält. Månadscachen förnyas inte under sessionen, så två flikar visar inaktuell text (**F15**) |
| `useWorkspaceSync` + `useWorkspaceData` | Position 300 ms, innehåll 500 ms, vy 700 ms (per nyckel) | Inget per nyckel (**F12**). Ytbyte utan skydd (**F6**) | `track` ger notis och `error`. Raderingar feltolkas (**F5**). Indikatorn räknar inte skrivningar som väntar i debounce och visar "Sparat" | `visibilitychange`/`pagehide`/unmount kör flush. Bara vyn skickas med `keepalive`, så innehåll som flushas vid stängning kan avbrytas | Inget. Workspace är per användare, två flikar ger last-write-wins per fält |
| `useWorkspaceHistory` | – | Inverser körs i ordning | Fel i en invers ger notis, och posten är förbrukad | Stacken försvinner | Inverser kan peka på placeringar som inte finns längre och ger då 404. Dubbel restore (**F22**) |
| `useUndoableState` (planner, hjul) | – | – | – | – | Undo spelar upp en hel snapshot som sparas som fullständig ersättning, så en undo i en inaktuell flik skriver över (**F3**). `canEdit` stoppar undo i läsläge |
| `usePersistentState` | Ingen (skriver direkt) | – | Fel loggas | Synkront, inget förloras | Ingen `storage`-lyssnare: två flikar ger last-write-wins. Läses efter montering (fallback först). Byte av nyckel nollställer inte värdet (`:26`), men alla anropare använder fasta nycklar. Inte knuten till användare (**F16**) |
| *Jämförelse:* `labPlanStore` (arbetslag) | 800 ms | Ett anrop i flykt per upplägg, sedan det senaste | Lägger tillbaka vid fel, `retry`, `conflict` | Flush vid sidbyte inom appen, `pagehide` och `beforeunload`-varning | Version och 409. **Mönstret de andra borde följa** |

**localStorage som cache:** ingen hook cachar serverdata i localStorage, med två undantag. Hjulutkastet (F24) och de publika länkreglerna (F16) kan skriva äldre eller andras data till servern. Övrigt i localStorage är val (aktivt id, ordning, panelläge).

---

## 5. Migrationsstatus

**Heads:** `alembic heads` ger en enda head, `020_planner_activity_lane_order`. Kedjan är linjär: `<base> → 297e74ec55ea → 001 → … → 020`.

`297e74ec55ea` är en autogenererad revision (`down_revision = None`) som ändrar `family_member` och därför förutsätter att tabellen redan finns. `001` hänger på den. Det är den egentliga basen, inte en sidogren.

**Bygga från noll:** det går inte. `alembic upgrade head` mot en tom databas fallerar direkt (`no such table: family_member`). Elva tabeller skapas aldrig av någon migration: `users`, `drive_files`, `note_contents`, `calendar_events`, `day_notes`, `family_member`, `activity`, `activity_participants`, `schedule_settings`, `planner_activity` och `planner_course`. De kommer från `create_all()`.

**Så byggdes jämförelsen:** jag skapade de elva tabellerna utan de kolumner som senare migrationer lägger till och körde sedan migrationerna.
- **SQLite:** de MySQL-specifika stegen (`alter_column` i 297e, `MODIFY` i 005 och `ON UPDATE`) stubbades.
- **MariaDB 10.11:** kördes rakt av, utan stubbar.

`compare_metadata` mot modellerna:
- **Kolumner, typer, nullbarhet, index:** inga skillnader i de tabeller migrationerna äger.
- **Server-defaults** finns i migrationerna men inte i modellerna (modellerna har Python-defaults): `created_at`/`updated_at` i nästan alla nya tabeller, samt `surfaces.*`, `surface_elements.*`, `theme_wheels.start_week`/`week_count`, `calendar_settings.highlight_band_count`, `planner_public_link.enabled`, `cc_*`, `workspace_elements.title` och `arbetslag_plan.version`. Avvikelse i sak: `surface_elements.is_locked` har server-default **`1`** men modell-default `False`, så en rå SQL-insert ger låsta kort.
- **`ON UPDATE CURRENT_TIMESTAMP`** finns på de tabeller migrationerna skapat men aldrig på dem `create_all` skapat (F21). Det sätts i MySQL-sessionens tidszon. ORM:en skriver alltid `updated_at` själv, så det spelar roll bara vid rå SQL.
- **Unik constraint:** `uq_family_member_user_name` finns bara via 297e.

**Teckenuppsättning** efter äldre tabeller och `upgrade head` (MariaDB, databasstandard `utf8`):

| utf8mb3 | utf8mb4 |
|---|---|
| `planner_activity`, `planner_course`, `planner_archive`, `planner_archive_share`, `users`, `drive_files`, `note_contents`, `calendar_events`, `day_notes`, `family_member`¹, `activity`¹, `activity_participants`, `schedule_settings`, `alembic_version` | `surfaces`, `workspace_elements`, `surface_elements`, `theme_*`², `calendar_days`, `calendar_settings`, `planner_public_link`², `planner_term`, `arbetslag_plan(_share)`, `cc_*`, `note_templates` |

¹ 005 konverterar bara kolumnerna `icon` och `name`.
² Bara om migrationen skapade tabellen. Om `create_all` hann först, se F21, blir de `utf8mb3`.

Migration 005 (utf8mb4) gäller alltså bara Familjeschemat, som är borttaget. Tabellen ovan visar vad *migrationerna* ger. Produktionen avviker åtminstone för `planner_activity`, som är `utf8mb4_unicode_ci` (F4).

**`downgrade()`**
- **Förstör användardata utan varning:** 004 (hela workspace), 011 (alla delningar, sorter och lås, samt kopplingen mellan poster och arkiv), 014 (kalendern), 016 (terminer) och 017–018 (arbetslag).
- **Tappar fält:** 006 (`drive_folder_id`), 012 (`client_id`, vilket ger byte av id en gång) och 020 (`lane_order`).
- 297e kortar `icon` till `String(10)`, vilket ger trunkering eller fel för emoji-ikoner.
- 005 och 013 är `pass`. Det är rimligt för 005. 013 går inte att backa, eftersom raderade spökarkiv inte kommer tillbaka.

**Riskabla skript**

| Skript | Risk |
|---|---|
| `timestamp_migration.py` | Inte idempotent: varje körning flyttar `calendar_events` 1–2 h |
| `migration.py`, `update_data.py` | Ger admin alla rader där `user_id` är NULL |
| `init_db.py`, `app.py` (vid import) | `create_all` förbi Alembic, med `utf8mb3` och utan server-defaults |
| `add_column.py` | Gör ingenting på SQLAlchemy 2 (rå sträng utan `text()`), men rapporterar inte det tydligt |
| `update_password.py` | Ingen schemarisk, men importerar appen och kör därmed `create_all` |

---

## 6. Utanför scope

- `next_z_index` och `create_surface` (`max + 1`) är inte atomära, så två samtidiga anrop kan få samma z-index eller `sort_order`. Det är kosmetiskt.
- `createAndPlaceElement` gör två anrop: om placeringen misslyckas blir det ett element i biblioteket utan placering.
- `delete_surface` raderar hårt placeringar av mjukraderade element, och en senare återställning saknar då den ytan.
- `/api/planner/activities/sync` (namnbaserad) och `DELETE /activities?archive_name=` går förbi låset. Klienten använder dem inte längre.
- Planner-kursers och temabibliotekets id är globala primärnycklar som klienten skickar. En kollision mellan konton ger 400 eller 409 i stället för att lösas.
- `term_routes` godtar `startWeek = 53` för år med 52 veckor. Klienten visar det då som vecka 1 nästa år.
- `keepalive` har en body-gräns på 64 kB. En kalenderanteckning nära taket kommer inte iväg vid stängning.
- `lib/jwt/__pycache__/*.pyc` är incheckade i backendrepot.
