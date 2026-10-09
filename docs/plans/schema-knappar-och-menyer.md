# Plan: Färre knappar och tydligare menyer i schemaplaneraren

Status: genomförd 2026-10-09 på grenen ccr-d2c1653a-tupg0s, inte sammanslagen
med main. Granskad mot backend samma dag, se avsnitt 13. Prototyp med båda
stilarna: länken står i avsnitt 11.

Genomförandet följer planen. Det som tillkom:

- Den gemensamma skapa-funktionen ligger i `src/utils/createSchedule.ts` med
  tester. Källan läses före skapandet, så ett misslyckat hämtande lämnar inget
  tomt schema i listan.
- Exportera- och ⋯-menyerna stängs med Esc.

Schemaplaneraren (`/`, `src/components/schedule/NewSchedulePlanner.tsx`) har
vuxit en knapp i taget. Den här planen ordnar om knappar och menyer så att det
som används varje dag står framme, flyttar undan det som används sällan och tar
bort det som inte behövs. Utseendet (färger, ramar, skuggor, typsnitt) ändras
inte här, se avsnitt 10.

Riktlinjer för hela planen:

- Det som används varje dag syns direkt. Det som används någon gång i månaden
  ligger i en meny. Det som inte används tas bort eller göms.
- Samma sak heter samma sak överallt (avsnitt 7).
- Ingen ikon utan namn. Varje ikonknapp har `aria-label` och `title`.
- Ett menyval som har ett kortkommando visar det, så att menyn lär ut
  tangentbordet.

Inget nytt beteende tillkommer utöver "Utgå från" (4.2) och dubbelklick (6.2).

---

## 1. Beslut

| # | Fråga | Beslut |
|---|---|---|
| 1 | Rensa | **Tas bort**: knappen, bekräftelsedialogen och dess state. Ctrl+Z finns kvar, och ett tomt schema skapas med Nytt schema. |
| 2 | Regler (ämnen som inte får ligga samtidigt) | **Flyttas in i Inställningar** som en egen sektion. Knappen i vänsterpanelen tas bort. Reglerna gäller som förut. |
| 3 | Export | PDF-menyn och bildmenyn (⋮) blir **en** meny: Exportera. |
| 4 | ⋯-menyn | Ny meny längst till höger i verktygsfältet med **Inställningar** och **säkerhetskopia (JSON)**. Den ersätter JSON-menyns ⋮. Hitta och ersätt (Ctrl+F) och genvägshjälpen (?) står inte i menyn. |
| 5 | Nya scheman | Görs utifrån ett basschema där de fasta posterna är ifyllda. Nytt schema-dialogen får fältet **Utgå från**. Spara vecka-fältet tas bort. Duplicera öppnar samma dialog. |
| 6 | Ord | **Schema** och **byggsten**. "Vecka" (om ett sparat schema), "arkiv", "ämne" och "kurs" försvinner ur texten man ser. |
| 7 | "Dolda inställningar" | Heter **Inställningar** när den står i en meny. Ctrl+Shift+K fungerar som förut. |

---

## 2. Verktygsfältet

Idag, från vänster:

> Schema ▾ · Filter · aktivt schema / planeringstid · [låst] · [Utesluter N] ·
> Publik länk · PDF ▾ · ⋮ (bild) · Rensa · ⋮ (JSON)

Efter:

> Schema ▾ · Filter · aktivt schema / planeringstid · [låst] · [Utesluter N] ·
> Publik länk · Exportera ▾ · ⋯

### 2.1 Exportera

- En knapp, "Exportera", med `Download`-ikonen. Den ersätter PDF-knappen
  (rad 1530–1560) och bildmenyn (rad 1561–1592).
- Menyn har två grupper med en avdelare emellan:
  - PDF – digital · PDF – A4 · PDF – A3
  - PNG · JPG · SVG
- Tipsen i `title` och anropen till `runVectorExport` behålls som de är.
- `isImageExportMenuOpen` och `imageExportMenuRef` utgår. Hanteringen av klick
  utanför menyerna (runt rad 686) räknar då med två menyer i stället för tre.

### 2.2 ⋯ (Fler val)

- Ikonknapp med `MoreHorizontal`, `aria-label`/`title` "Fler val". Den ersätter
  JSON-menyn (rad 1595–1630).
- Innehåll:
  - Inställningar… — `Ctrl+Shift+K` (öppnar samma dialog som kortkommandot)
  - avdelare
  - Spara säkerhetskopia (JSON) — `handleExportJSON`
  - Ladda säkerhetskopia (JSON)… — `fileInputRef.current?.click()`.
    Bekräftelsen "Ersätta nuvarande schema?" finns kvar.

### 2.3 Rensa

- Ta bort knappen (rad 1594), `ConfirmDialog` "Rensa schemat?" (rad 2356–2368)
  och `isClearScheduleConfirmOpen`.
- `RefreshCcw` används fortfarande av "Uppdatera byggstenar från schema" och
  ska vara kvar i importen.

### 2.4 Oförändrat

Schema-menyn, filtret, raden med aktivt schema och planeringstid, låst-läget
med Ta över, Utesluter N och Publik länk.

---

## 3. Vänsterpanelen (Byggstenar)

- Ta bort Regler-knappen (rad 1661–1669). Kvar i rubrikraden:
  Byggstenar ▾ · + · ‹.
- +-knappen får `aria-label`/`title` "Ny byggsten (N)".
- Tid-sektionen ändras inte.

---

## 4. Högerpanelen (Scheman)

### 4.1 Rubrik

- "Sparade Veckor" → "Scheman".
- Tomt läge: "Inga sparade scheman ännu."
- Hopfällningsknappen: "Visa scheman" / "Dölj scheman".

### 4.2 Nytt schema med "Utgå från"

En ny vecka görs utifrån ett basschema där de fasta posterna redan är
ifyllda. Idag går det att göra på tre sätt: Nytt schema, Spara vecka och
Duplicera. Spara vecka sparar det som just nu ligger i rutnätet under ett nytt
namn. Det blir ett enda sätt:

- Knappen Nytt schema öppnar `NewScheduleDialog` med två fält:
  - **Namn**
  - **Utgå från**: en lista med "Tomt schema" överst och sedan alla scheman,
    egna först och därefter "Delade med mig". När inget schema är öppet
    (statusraden visar "Huvudschema") står även **Huvudschemat** i listan,
    direkt under Tomt schema. Se 13.2.
- Utgå från minns det senaste valet i localStorage
  (`app.new_schedule_source.v1`), så att basschemat är förvalt nästa gång.
  Finns schemat inte längre faller valet tillbaka till Tomt schema. Bara ett
  schema som skapas med knappen Nytt schema sparar valet. Ett schema som
  skapas med Duplicera (4.4) gör det inte, annars blir förra veckan förvald i
  stället för basschemat.
- Med ett schema valt gör dialogen det `handleDuplicateWeek` gör idag: hämtar
  posterna, skapar ett nytt schema, sparar posterna med nya id:n och öppnar
  det nya schemat.
- Med Huvudschemat hämtas posterna med `plannerService.getPlannerActivities()`
  i stället för `getArchiveActivities`. Resten är detsamma.
- Med Tomt schema gör den det `handleCreateNewSchedule` gör idag.
- Alla tre vägarna går genom en och samma funktion i `useArchiveManager`.
  Den släpper låset på schemat som var öppet innan, på samma sätt som
  `handleLoadWeek` gör. Se 13.1.
- Kopian görs av det som är sparat på servern, inte av det som syns i
  rutnätet. Står autosparningen på fel (`saveStatus === 'error'`) när källan är
  det öppna schemat, säger dialogen det och föreslår att vänta tills
  sparningen gått igenom. Se 13.3.
- Knapparna är Avbryt och Skapa, som idag. Skapa är avstängd när namnet är tomt
  eller redan finns bland de egna schemana.

### 4.3 Spara vecka tas bort

- Ta bort fältet och Spara-knappen (rad 2032–2050).
- Ta bort `handleSaveWeek`, `handleConfirmOverwriteWeek`, `overwriteArchive`
  och dialogen "Ersätta befintlig vecka?" i `dialogs/ArchiveDialogs.tsx`.
- `weekName` och `setWeekName` utgår.
- Autosparningen ändras inte. Den skriver fortfarande till det aktiva schemat.
- Spara vecka var det enda sättet att göra ett namngivet schema av
  huvudschemat. Det ersätts av valet Huvudschemat i Utgå från (4.2).

### 4.4 Korten

- Duplicera, Dela och Ta bort syns bara när kortet hovras, har fokus eller är
  markerat med tangentbordet (`isSelected`). Det är samma mönster som posterna
  i rutnätet. På pekskärm (`pointer: coarse`) syns de alltid.
- Ikoner som inte syns ska inte heller ta plats. Annars kortas namnet av även
  när ikonerna är dolda.
- Ordningen är oförändrad, med Ta bort sist.
- Duplicera öppnar Nytt schema-dialogen med kortet förvalt i Utgå från och
  namnet "<namn> (kopia)" ifyllt. `window.prompt` i `handleDuplicateWeek`
  försvinner.

---

## 5. Högerklicksmenyn

### 5.1 En post

Samma val som idag, i fyra grupper med avdelare och kortkommandot
högerställt i grått:

| Grupp | Val | Kortkommando |
|---|---|---|
| Redigera | Redigera… | E |
| Duplicera | Duplicera bredvid | D |
| | Duplicera och placera | Shift+D |
| Kopiera | Kopiera innehåll | C |
| | Klistra in innehåll *(bara när något är kopierat)* | V |
| | Kopiera anteckningar | Shift+C |
| | Kopiera anteckningar till flera… | Shift+A |
| | Klistra in anteckningar *(bara när något är kopierat)* | Shift+V |
| Ta bort | Ta bort *(röd, som idag)* | Delete |

- "Duplicera och lägg parallellt" → "Duplicera bredvid".
- "Kopiera anteckningar och dra" → "Kopiera anteckningar till flera…".
  Genvägshjälpen i `src/config/shortcuts.ts` byter till samma namn (idag
  "Kopiera anteckningar och markera").
- "Radera" → "Ta bort", som på alla andra ställen.
- Kopiera innehåll får `title` "Lärare, sal, anteckningar, uppgift och färg.
  Inte titel eller tid." Det är vad som kopieras (rad 2188).

### 5.2 Flera markerade poster

Ändras inte: "Redigera N poster" och "Redigera bara den här".

---

## 6. Poster och byggstenar

### 6.1 Ikonerna som syns vid hovring

- Penna och papperskorg på posterna (`ScheduledEventCard.tsx` rad 155–156) är
  8 px och saknar namn. De blir 12 px i en klickyta på 20 px, med
  `aria-label`/`title` "Redigera" och "Ta bort".
- Samma sak på byggstenskorten (`DraggableSourceCard.tsx`), som idag är 10 px.
  Där saknar pennan `title`.

### 6.2 Dubbelklick

- Dubbelklick på en post öppnar Redigera post. Dubbelklick på en byggsten
  öppnar Redigera byggsten. Det är det man oftast gör med en post, och idag
  krävs en ikon på 8 px, högerklick eller E.
- Drag påverkas inte, eftersom `PointerSensor` startar först efter 8 px
  (`useDragHandlers.ts` rad 53). Klick med Shift, Ctrl eller Cmd markerar som
  förut.
- Dubbelklick på uppgiftslänken eller ikonerna inne i kortet räknas inte.
  Hanteraren hoppar över `closest('a, button')`, som `onClick` på posten redan
  gör (`ScheduledEventCard.tsx` rad 105–108).
- I läsläget öppnas dialogen som idag via pennan. Ändringen stoppas av
  `commitSchedule`, så inget nytt skydd behövs.

---

## 7. Ord

| Idag | Blir |
|---|---|
| Sparade Veckor | Scheman |
| Spara vecka · "Vecka 42 eller Höstlov" | *(utgår)* |
| Ersätta befintlig vecka? | *(utgår)* |
| Radera vecka? · Radera | Ta bort schema? · Ta bort |
| Inga sparade veckor ännu. | Inga sparade scheman ännu. |
| Visa arkiv / Dölj arkiv | Visa scheman / Dölj scheman |
| Hantera ämne (`CourseEditorDialog`) | Ny byggsten / Redigera byggsten |
| Redigera + knappen Uppdatera (`EntryEditorDialog`) | Redigera post + knappen Spara |
| Anteckningar: · Uppgift: | Anteckningar · Uppgift (utan kolon, som de andra etiketterna) |
| Notiserna om "veckan" i `useArchiveManager.ts` | "schemat" |
| Genvägshjälpen: Växla zon (Kurser → Grid → Arkiv) | Växla zon (Byggstenar → Schema → Scheman) |
| Genvägshjälpen: Redigera / Placera kurs | Redigera / placera byggsten |
| Dolda inställningar (tipset vid Utesluter N) | Inställningar |
| Regler | Får inte ligga samtidigt |

- "Post" behålls för något som ligger i rutnätet ("Redigera 3 poster").
- "Veckan" i planeringssummeringen (rad 1343) betyder veckans total och står
  kvar.
- Interna namn (`handleLoadWeek`, `ArchiveCard`, `archive`) byts inte.
- Sök efter `veck`, `Radera`, `kurs` och `ämne` i `src/components/schedule`,
  `src/hooks/useArchiveManager.ts` och `src/config/shortcuts.ts` för att hitta
  resten.

---

## 8. Dialogerna

- Redigera post och Ny/Redigera byggsten får knappen Avbryt till vänster om
  Spara, som Nytt schema redan har.
- Ny byggsten och Redigera byggsten är samma dialog. Rubriken beror på om
  byggstenen redan finns.

---

## 9. Regler i Inställningar

- En ny sektion i högra kolumnen i `HiddenSettingsDialog`, efter "Sal efter
  ord i titeln": **Får inte ligga samtidigt**. Två fält (platshållare `Matte*`
  och `Svenska*`), knappen Lägg till och en lista där varje regel kan tas bort
  med ✕.
- Sektionen följer dialogens mönster med utkast och Spara. Reglerna går med i
  utkastet och i `onSave`. `NewSchedulePlanner` sätter `restrictions` när
  dialogen sparas.
- `dialogs/RestrictionsDialog.tsx`, `isRestrictionsModalOpen` och `newRule`
  tas bort.
- **Obs:** reglerna sparas idag inte mellan sidladdningar. De finns bara i
  minnet och i JSON-kopian. Planen ändrar inte det. Ska de sparas som de andra
  inställningarna behövs `usePersistentState` med en ny nyckel. Det beslutas
  när sektionen byggs.
- Reglerna ska inte följa med till `PublicLinkControl`. Den skickar färg- och
  salsreglerna till backend som visningsinställningar för den publika länken,
  och reglerna har ingenting där att göra. Se 13.4.

---

## 10. Utanför planen

- **Utseendet**: färger, ramar, skuggor och typsnitt. Prototypen visar samma
  struktur i nuvarande stil och i en stil inspirerad av Dieter Rams
  ("Kronberg"). Den är underlag för en egen plan.
- Mobilvyn.
- Att slå ihop Publik länk och Dela (med kollega) till en Dela-knapp. Det är en
  idé för senare.
- Skrivskydd för basschemat. Ändringar skrivs till det schema som är öppet, och
  det gäller även basschemat. Det är en idé för senare.
- Hitta och ersätt (Ctrl+F), kategorifelsökningen (Ctrl+Shift+C) och
  genvägshjälpen (?). De ändras inte, förutom namnen i 7.

---

## 11. Prototyp

Prototypen är en fristående HTML-sida och rör inte appens kod. Den visar
verktygsfältet, båda panelerna, rutnätet, menyerna Exportera och ⋯,
högerklicksmenyn och Nytt schema-dialogen. Det går att växla mellan
nuvarande stil och Kronberg.

Länk: https://claude.ai/artifact/1XnVrqbmJrQUG32NXpvXCg (privat, delas från
sidans Dela-meny)

---

## 12. Klart när

- Verktygsfältet har tre knappar till höger om statusraden: Publik länk,
  Exportera och ⋯.
- Det finns inga ⋮-ikoner kvar i planeraren.
- Gränssnittstexten i planeraren innehåller inte "Rensa", "Spara vecka",
  "Sparade veckor" eller "Regler".
- Kortkommandona i menyerna stämmer med `src/config/shortcuts.ts`.
- Efter Nytt schema eller Duplicera är det förra schemat inte längre låst på
  en själv (13.1).
- Huvudschemat går att välja i Utgå från när inget schema är öppet (13.2).
- Den nya skapa-funktionen har ett eget test. Det täcker de tre källorna och
  att det förra låset släpps. Inga befintliga tester rör de flöden planen
  ändrar, så `pnpm test` ensamt säger lite.
- `pnpm lint`, `pnpm test` och `pnpm build` går igenom.

---

## 13. Backend

Planen kräver inga ändringar i backend (`drive_c_backend`). Den använder bara
anrop som redan finns: `POST /archives`, `GET` och `PUT
/archives/<id>/activities`, `GET /activities` (huvudschemat) och låsen. Två
saker i frontendens nuvarande flöden behöver ändå rättas när planen byggs,
eftersom planen leder fler skapade scheman genom dem.

Kontrollerat och oförändrat:

- Namn är unika per ägare (`uq_planner_archive_owner_name`). `POST /archives`
  svarar 409 på ett namn som redan finns. Planens regel att Skapa är avstängd
  när namnet finns bland de egna stämmer med det.
- `POST /archives` tar låset åt den som skapar. Det nya schemat är alltså
  redan låst på en själv.
- Rensa nådde aldrig backend. Autosparningen hoppar över ett tomt schema
  (`usePlannerSync`, `schedule.length === 0`), så ett rensat schema kom
  tillbaka vid omladdning. Att ta bort knappen ändrar inget på servern.
- Terminsplaneraren pekar på scheman med id. Workspace-importen, provenance
  och Command Center hittar dem med namn, via `GET /activities?archive_name=`.
  Planen döper inte om något schema och byter inga id.

### 13.1 Låset på det förra schemat släpps inte

`handleCreateNewSchedule`, `handleDuplicateWeek` och `saveIntoArchive` (Spara
vecka) byter aktivt schema utan att släppa låset på det som var öppet. Bara
`handleLoadWeek` gör det. Lås går inte ut av sig själva i backend
(`_lock_holder` läser bara `locked_by_id`). `pagehide` släpper bara det schema
som är öppet just då.

Följden är att ett delat schema man stod i när man skapade nästa vecka
fortsätter vara låst på en. Kollegor hamnar i läsläge och måste trycka Ta
över. Felet finns redan idag. Planen gör det vanligare, eftersom hela
veckoflödet går den här vägen.

Åtgärd: den gemensamma skapa-funktionen (4.2) anropar
`plannerService.releaseArchiveLock(previousId)` när det nya schemat är skapat
och öppnat, och nollar låset i listan, precis som `handleLoadWeek`. Ett fel
där stoppar inte skapandet.

### 13.2 Huvudschemat

När inget schema är öppet är rutnätet huvudschemat. Det sparas med `POST
/activities/sync` (`archive_name` tomt) och läses av workspace-importen,
provenance och Command Center. Man hamnar där första gången, efter att ha
tagit bort det öppna schemat och efter att ha lämnat ett delat schema.

Spara vecka var det enda sättet att göra ett namngivet schema av
huvudschemat. Därför får Utgå från valet Huvudschemat (4.2).

### 13.3 Kopian görs av serverns version

Spara vecka sparade det som syntes i rutnätet. Utgå från hämtar posterna från
servern. Med autosparning efter en sekund (`AUTOSAVE_DELAY_MS`) är det i
praktiken samma sak. Om den senaste sparningen misslyckades saknas de
osparade ändringarna i kopian, därav varningen i 4.2.

### 13.4 Reglerna

Reglerna (Får inte ligga samtidigt) finns bara i frontendens minne och i
JSON-kopian. Backend känner inte till dem. Det enda i Inställningar som når
backend är färg- och salsreglerna, som `PublicLinkControl` skickar med
`PATCH /public-links/<id>` som `displayConfig`. Så länge reglerna inte kopplas
in där påverkar flytten inte backend.

