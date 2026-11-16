# Närvarorutor kopplade till schemat

Status: Pågår

Skriven 2026-11-16 efter en genomgång av veckoschemana v. 45–47 och
närvaroarket för en klass. Planen är skriven för att kunna lämnas till en ny
session: allt som behövs står här eller i filerna den pekar på.

## 1. Vad användaren vill

Tobias vill se vilket schemapass en närvarokolumn är, utan att själv hålla
reda på det, och kunna klicka på ett pass i en bild av veckans schema och se
sina noteringar för det.

Beslut från samtalet:

| Fråga | Beslut |
|---|---|
| Var kopplingen syns | I Närvarorutor. Schema-sidan ändras inte. |
| Hur passen paras ihop | Automatiskt, räknas fram varje gång. Inget om kopplingen sparas. |
| Vilka pass veckovyn visar | Alla, med användarens egna framhävda och övriga nedtonade. |
| Vem användaren är i schemat | Användarnamnet är `Admin`, i schemats lärarfält står `Tobias`. Sidan frågar en gång efter namnet och minns det. |
| Nivågrupper (Engelska, Ma, Studieverkstad) | Närvaron förs i klassarken även där. Det ändras inte nu. |
| Schemats anteckning | Visas som den är. Den kopieras inte in som passnamn (`passNames`). |
| Mobilläget | Raden "Enligt schemat" kommer med. Veckovyn byggs för datorn. |

## 2. Backend: ingen ändring

Kontrollerat i `drive_c_backend/api/planner_routes.py` 2026-11-16:

- `GET /api/planner/archives` (`get_planner_archives`) ger alla scheman
  användaren når, egna och delade, med `id`, `name`, `kind`, `isOwner` och
  `updatedAt`.
- `GET /api/planner/archives/<id>/activities` (`get_shared_archive_activities`)
  ger schemats pass med `title`, `teacher`, `room`, `notes`, `day`,
  `startTime`, `endTime`, `duration`, `color` och `laneOrder`. Åtkomsten
  kontrolleras med `_has_access` (ägare eller delning). Anropet tar inget lås
  och räknar inte upp versionen.

Frontend har redan båda: `plannerService.listArchives()` och
`plannerService.getArchiveActivities(id)`. Inget nytt fält sparas, så det
behövs ingen migration, ingen ny route och ingen deployordning. Närvarons
egna dokument ändras inte heller.

**Sekretess:** bara läsanrop mot schemat tillkommer. Inget namn, kryss eller
notering får skickas till planner-API:t eller loggas.

## 3. Så ser datan ut

### Närvaroarket

En kolumn (`AttendanceColumn` i `utils/narvaro.ts`) har `day`, `pass`
(texten i arkets passrad), `letter` och `time` (minuter, eller `null` när
passraden saknar klockslag). Arket för en klass, samma uppställning i alla
tre klasserna (Grund, Oliv, Rosa):

| Dag | Kolumner (`pass`) |
|---|---|
| Måndag | B `8.30-9.45`, C `10.00-11.30`, D `12.30-14.00` |
| Tisdag | E `Studieverkstad`, F `12.30-14.30`, G `Studieverkstad` |
| Onsdag | H `8.30-9.45`, I `10.00-11.30`, J `12.30-14.30` |
| Torsdag | K `8.30-10.00`, L `10.15-11.45`, M `12.30-14.30`, N `Studieverkstad` |
| Fredag | O `Studieverkstad`, P `9.45-11.30`, Q `12.30-14.30` |

### Schemat (v. 45–47)

| Dag | Tider och pass |
|---|---|
| Måndag | 08:30–10:00, 10:15–11:30, 12:30–14:00: Tema Grund / Tema Oliv / Tema Rosa parallellt. 14:15–15:45 APT. |
| Tisdag | 08:30–10:00 AK-möte. 10:15–11:45 Ma Grund / Ma 1 / Studieverkstad. 12:30–14:30 Engelska 1 / Engelska 2 / Engelska Grund. 14:45–15:45 Ma 1 / Ma Grund / Studieverkstad. |
| Onsdag | 08:30–09:45, 10:00–11:30 Tema ×3. 12:30–14:30 Onsdagsklubben. 14:45–15:45 Ma2 (tillval). |
| Torsdag | 08:30–09:45, 10:00–11:30, 12:30–14:30 Tema ×3. 14:45–15:45 Studieverkstad. I v. 47 i stället ett enda pass 08:30–15:30, "Studiebesök i Malmö". |
| Fredag | 08:30–09:30 Ma 1 / Ma Grund / Studieverkstad. 09:45–11:45 Engelska ×3. 12:30–14:00 Tema ×3. 14:15–15:15 Ma2 (tillval). |

Mellan passen ligger "Paus" (15 min) och "Lunch" (45–60 min) som egna poster.

### Det som styr utformningen

- **Tiderna är inte lika.** Arket har måndagens tider från onsdagen
  (8.30-9.45 mot schemats 08:30–10:00) och torsdagens från måndagen. Exakt
  jämförelse fungerar inte; överlapp gör det.
- **Kolumner utan tid** heter som schemapasset ("Studieverkstad") och står i
  rätt ordning under dagen.
- **Klassen står i titeln** för temapassen ("Tema Oliv"). Nivågrupperna gör
  inte det, och "Engelska Grund" och "Ma Grund" innehåller ordet Grund utan
  att vara klassen Grunds pass.
- **Lärarfältet är fritext:** `"Tobias"`, `"Tobias  "`, `"Victor, Tobias"`,
  `"Alla"` eller tomt. `splitTeacherNames` och `isAllTeachersField` i
  `utils/scheduleStats.ts` hanterar det redan.
- **Anteckningen** är passets innehåll ("Historia: Historiebruk"). `"."` är
  en platshållare.
- **Schemats namn** är "v. 45", "v. 46", "v. 47", ett per vecka, delade med
  kollegorna. `weekNumberFromName` i `utils/termPlanner.ts` läser dem.
- Användaren har aldrig två egna pass samtidigt i de tre veckorna.

## 4. Vad som byggs

### 4.1 Raden "Enligt schemat"

Under raden Pass i `Narvaro.tsx`, för det valda passet:

> Enligt schemat: Tema Rosa · **Tobias** · Rådhuset · Historia: Historiebruk

- Ett pass per rad. I en tid med nivågrupper står alla parallella pass, med
  användarens eget först och i fetstil.
- Finns inget schema för veckan visas raden inte alls.
- Finns schemat men inget pass för de valda klasserna: "Inget pass för Oliv
  enligt schemat" i dämpad text.
- Har användaren inte sagt vem hen är står en liten väljare sist i raden:
  "Vem är du i schemat?" med lärarnamnen ur veckans schema
  (`collectTeacherNames`). Valet går att ändra med samma väljare i veckovyn.
- I mobilläget visas samma text på en rad under `NarvaroMobileHeader`,
  avkortad med `truncate`.

### 4.2 Knappen "Veckan"

En knapp i sidhuvudet, bredvid Mobilläge, öppnar en dialog med veckans
schema. Dold i mobilläget och när veckan saknar schema.

- Rutnätet är `PublicTimeGrid`, samma som den publika schemasidan.
- Egna pass (lärarfältet innehåller användarens namn, eller "Alla") ritas som
  vanligt. Övriga är nedtonade. Utan valt namn tonas inget ned.
- Ett pass med noteringar har en prick i övre högra hörnet.
- Pilar bläddrar en vecka bakåt och framåt. Rubriken är "Vecka 47".
- **Klick på ett pass i den aktuella veckan** väljer klass, dag och pass på
  sidan och stänger dialogen.
- **Klick på ett pass i en annan vecka** visar passets noteringar under
  rutnätet i dialogen, som texten i Tidigare pass (`sessionText`) med en
  Kopiera-knapp. Sidan själv visar bara den aktuella veckan, och det ändras
  inte här.
- Ett pass som inte motsvarar någon kolumn i arket (Lunch, Paus, APT) går
  inte att klicka på.

### 4.3 Rätt klass förvald

När sidan öppnas under ett pass där användaren själv står på ett pass som
namnger en klass väljs den klassen. Öppnas sidan måndag 10.20 i v. 47 väljs
Rosa. Gäller bara en gång per sidladdning och bara om användaren inte hunnit
välja klass, dag eller pass själv.

### 4.4 Schemats text i Tidigare pass

Under rubriken för ett tidigare pass står samma text som i 4.1, i dämpad
stil. Schemat för en äldre vecka hämtas först när veckans grupp fälls ut.

## 5. Matchningen: `src/utils/narvaroSchedule.ts`

Ny fil med ren logik och `narvaroSchedule.test.ts` bredvid. Den importerar
typer ur `types/schedule.ts` och `utils/narvaro.ts`, `timeToMinutes` ur
`utils/scheduleTime.ts` och lärarhjälparna ur `utils/scheduleStats.ts`.
Namnen nedan är förslag; reglerna är det som gäller.

### Schemat för en vecka

```ts
/** Veckoschemat för en närvarovecka (`w2026-47`), eller null. */
archiveForWeek(weekKey: string, archives: PlannerArchiveSummary[]): string | null
```

Veckonumret är de två sista siffrorna i nyckeln. Valet görs med
`suggestArchiveForWeek` ur `utils/termPlanner.ts` (egna före delade, sedan
senast ändrat, aldrig basscheman).

Namnet har inget år. Ett "v. 47" från ett annat läsår kan därför väljas när
två finns. Det är en känd begränsning; lös den inte här.

### Passen för en kolumn

```ts
entriesForColumn(col: AttendanceColumn, dayCols: AttendanceColumn[], dayEntries: ScheduledEntry[]): ScheduledEntry[]
entriesForDay(dayCols: AttendanceColumn[], dayEntries: ScheduledEntry[]): ScheduledEntry[]
```

`dayEntries` är schemats pass samma veckodag (`entry.day === col.day`).

1. **Kolumn med tid:** ett pass hör till kolumnen när överlappet i minuter är
   minst halva kolumnens längd. Halva *kolumnens* längd, inte passets: annars
   hamnar pausen 10:00–10:15 i kolumnen 10.00-11.30.
2. **Kolumn utan tid:** jämför `col.pass` med passens titlar (trimmat,
   blanksteg ihopslagna, `toLocaleLowerCase('sv')`). Ta de olika starttiderna
   bland träffarna i stigande ordning. Dagens n:te kolumn utan tid med det
   namnet får den n:te starttiden. Kolumnens tid blir då det passets start
   och slut, och regel 1 ger alla parallella pass (Ma 1 och Ma Grund hamnar
   bredvid Studieverkstad). Finns ingen n:te starttid: inga pass.
3. **Hela dagen** (`pass === 'day'`): spannet är från första till sista
   kolumnen med tid den dagen. Ett pass hör dit när det täcker minst halva
   spannet. Saknar dagen kolumner med tid: inga pass.

Kontroll mot tabellerna i avsnitt 3 (alla ska bli test):

| Kolumn | Schemapass | Överlapp | Träff |
|---|---|---|---|
| Mån B 8.30-9.45 | 08:30–10:00 | 75 av 75 | ja |
| Mån C 10.00-11.30 | Paus 10:00–10:15 | 15 av 90 | nej |
| Mån C 10.00-11.30 | 10:15–11:30 | 75 av 90 | ja |
| Tor K 8.30-10.00 | 08:30–09:45 | 75 av 90 | ja |
| Tor K 8.30-10.00 | 10:00–11:30 | 0 | nej |
| Tor L 10.15-11.45 | 10:00–11:30 | 75 av 90 | ja |
| Tor L 10.15-11.45 | Lunch 11:30–12:30 | 15 av 90 | nej |
| Fre Q 12.30-14.30 | 12:30–14:00 | 90 av 120 | ja |
| Fre Q 12.30-14.30 | Ma2 14:15–15:15 | 15 av 120 | nej |
| Tis E Studieverkstad (första) | 10:15–11:45 | namn + ordning | ja, med Ma 1 och Ma Grund |
| Tis G Studieverkstad (andra) | 14:45–15:45 | namn + ordning | ja |
| Tor (v. 47), varje kolumn med tid | Studiebesök 08:30–15:30 | hela kolumnen | ja |
| Tor (v. 47), Hela dagen | Studiebesök 08:30–15:30 | hela spannet | ja |

### Klass och ägare

```ts
entryClasses(title: string, classNames: string[]): string[]
isClassDivided(entries: ScheduledEntry[], classNames: string[]): boolean
entriesForClasses(entries: ScheduledEntry[], classNames: string[], selected: string[]): ScheduledEntry[]
isMine(entry: ScheduledEntry, myName: string): boolean
```

- `entryClasses`: klasserna vars namn står som ett helt ord i titeln, utan
  hänsyn till versaler. Dela titeln på allt som inte är bokstav eller siffra
  (`\p{L}`, `\p{N}`); använd inte `\b`, som inte kan å, ä och ö.
- `isClassDivided`: sant när det finns minst ett pass och **varje** pass
  namnger en klass. "Tema Grund / Tema Oliv / Tema Rosa" är uppdelat på
  klass. "Engelska 1 / Engelska 2 / Engelska Grund" är det inte, eftersom
  Engelska 1 inte namnger någon klass. Regeln finns för att "Engelska Grund"
  inte ska tas för klassen Grunds eget pass.
- `entriesForClasses`: är passen uppdelade på klass ges bara de valda
  klassernas, annars alla.
- `isMine`: `splitTeacherNames(entry.teacher)` innehåller namnet (trimmat,
  `toLocaleLowerCase('sv')`), eller `isAllTeachersField(entry.teacher)`. Ett
  tomt `myName` ger alltid falskt.
- Sortera det som visas med egna pass först, sedan `compareLaneEntries`.

### Från pass till kolumn (klick i veckovyn)

```ts
type ScheduleTarget = { day: string; pass: PassChoice; classes: string[] };
targetForEntry(entry, table: AttendanceTable, weekEntries, classNames): ScheduleTarget | null
```

`table` är alla klassers ark ihop (`combineSheets(sheets, allClasses)`).

- Kolumnen är den vars `entriesForColumn` innehåller passet. Vid flera: den
  med störst överlapp. Ingen kolumn men passet finns i `entriesForDay`:
  `'day'`. Annars `null` (inte klickbart).
- `classes`: är kolumnens pass uppdelade på klass, passets klasser. Annars
  alla klasser som har dagen (`classesOnDay`).

### Texten och platshållaren

```ts
isPlaceholderNote(notes: string | undefined): boolean   // tom, eller bara skiljetecken och blanksteg
scheduleLineParts(entry, resolveRoom): { title: string; teachers: string[]; room: string; notes: string }
```

Komponenten sätter ihop delarna med " · " och hoppar över tomma. Salen går
genom `createRoomResolver` (se avsnitt 6), som fyller en tom sal från
salsreglerna.

### Noteringar för ett pass (pricken och Tidigare pass)

```ts
sessionClasses(sess: SessionNotes, sheets: Record<string, AttendanceTable>): string[]
```

Noteringarna ligger per pass (`datum|dag|kolumn`), inte per klass: Olivs och
Rosas noteringar för samma kolumn ligger i samma `SessionNotes`. Klasserna i
ett pass är de vars ark innehåller något av namnen i `sess.people` eller
`sess.added`. `combineSheets` lägger till " (klass)" efter ett namn som finns
i flera ark; räkna därför namnen ur `combineSheets(sheets, [klass]).people`
för varje klass i stället för ur de råa arken, eller jämför mot båda formerna.
Skriv ett test med två likadana namn i olika klasser.

- **Pricken:** passet har en kolumn (`targetForEntry`), det finns noteringar
  under kolumnens `sessionKey`, och `sessionClasses` överlappar passets
  `classes`.
- **Tidigare pass:** kolumnen fås ur nyckelns tredje del (`letter`, eller
  `dag`), passen ur `entriesForColumn` och urvalet ur
  `entriesForClasses(…, sessionClasses(…))`.

`sessionKey(table, day, pass, now)` räknar datumet från `now`. För en annan
vecka skickas den veckans måndag (`weekMonday(weekKey)`).

### Förvald klass

```ts
myClassesNow(table: AttendanceTable, weekEntries, classNames, myName, now): string[]
```

`table` är alla klassers ark ihop. Ta dagens veckodag (`weekdayName(now)`),
kolumnen som pågår enligt `defaultPass`, passen för den kolumnen, och av dem
de som är `isMine` och namnger en klass. "Alla" räknas inte här. Ger
`defaultPass` `'day'` eller finns inget sådant pass: tom lista, och inget
ändras.

## 6. Hämtning: `src/hooks/useNarvaroSchedule.ts`

```ts
type WeekSchedule = { archiveId: string; name: string; entries: ScheduledEntry[] };
useNarvaroSchedule(enabled: boolean): {
  /** undefined = inte hämtad än, null = veckan har inget schema eller gick inte att läsa. */
  weeks: Record<string, WeekSchedule | null | undefined>;
  ensureWeek: (weekKey: string) => void;
}
```

- `enabled` är `sync.phase === 'ready' && !isExample`. Exemplet får ingen
  schemakoppling.
- Listan över scheman hämtas en gång (`plannerService.listArchives()`). Varje
  veckas pass hämtas en gång med `getArchiveActivities` och görs om med
  `mapPlannerActivitiesToSchedule` (`hooks/usePlannerSync.ts`), som också
  tvättar formen.
- Den aktuella veckan hämtas direkt. Andra veckor när `ensureWeek` anropas.
- Hämta om listan och den aktuella veckan när fönstret får fokus igen, högst
  en gång i minuten, så att en ändring i Schema i en annan flik syns.
- Ett fel sväljs och ger `null`. Sidan fungerar då som i dag. Visa inget
  felmeddelande; `fetchWithAuth` sköter 401 själv.
- Skriv ingen ny uppackare. `plannerService` har redan sina anrop.
- Testas med `// @vitest-environment jsdom` och en egen `renderHook`, som
  `usePlannerSync.test.ts`: veckan hämtas en gång, ett fel ger `null`,
  `ensureWeek` hämtar en annan vecka.

### Färg- och salsregler

Schemats färger och salar bestäms delvis av regler i localStorage
(`COLOR_TRIGGERS_KEY` och `ROOM_TRIGGERS_KEY` i `config/plannerConstants.ts`,
lästa av `hooks/useHiddenSettings.ts`). Läs dem med `usePersistentState` och
samma nycklar och `sanitize*`-funktioner, och bygg `createColorResolver` och
`createRoomResolver` som `PublicScheduleView.tsx` gör. Kopiera inte
strängarna. På en enhet utan regler visas passets egen färg och sal.

### Namnet i schemat

Ny nyckel `narvaro.scheduleName.v1`, läst med `usePersistentState` och en
`sanitize`-funktion (sträng, trimmad, högst 60 tecken). Valet är per enhet.
Finns inget sparat och veckans lärarnamn innehåller användarnamnet
(`user.username`, utan hänsyn till versaler) används det utan att fråga.

## 7. Komponenter

`Narvaro.tsx` är ~1 100 rader och får bara kopplingen: anropet till hooken,
de härledda värdena och de nya komponenterna på plats. Ingen ny
subkomponent och ingen logik i filen. Formatera inte om något annat.

- **`src/components/narvaro/NarvaroScheduleLine.tsx`**: raden i 4.1. Tar
  emot de färdiga passen, namnet, lärarnamnen att välja bland och
  `onChooseName`. Används också i mobilhuvudet (kompakt) och i Tidigare pass
  (dämpad).
- **`src/components/narvaro/NarvaroWeekDialog.tsx`**: dialogen i 4.2. Äger
  vilken vecka som visas och vilket pass som är valt i en äldre vecka.
  Bred dialog som täcker det mesta av skärmen: `movable={false}`.
- **`PublicTimeGrid.tsx`** får två valfria props, och ändras inte för den
  publika sidan när de saknas:

  ```ts
  onEntryClick?: (entry: ScheduledEntry) => void;
  entryState?: (entry: ScheduledEntry) => { dimmed?: boolean; marked?: boolean; clickable?: boolean };
  ```

  Ett klickbart kort får `role="button"`, `tabIndex={0}`, Enter och
  mellanslag, och en pekare. `dimmed` sänker kortets opacitet. `marked` ritar
  pricken med en `--ui-*`-token. Filen har redan hårdkodade färger ur
  PDF-temat; lägg inte till fler.

  Visar det sig att rutnätet inte går att återanvända utan att ändra den
  publika sidans utseende: bygg ett eget, enklare rutnät i
  `components/narvaro/` på `buildDayLayout` (`utils/scheduleLayout.ts`) och
  skriv avvikelsen här.

- **Förvald klass** i `Narvaro.tsx`: en `useRef` som sätts när användaren
  själv väljer klass, dag eller pass, och en effekt som körs första gången den
  aktuella veckans schema finns. Ger `myClassesNow` klasser och refen är orörd:
  `setChosen(klasser)`. Det skriver över det sparade klassvalet
  (`narvaro.view.v1`), vilket är avsett.
- **Klick i veckovyn (aktuell vecka):** `setChosen(target.classes)`,
  `setDay(target.day)`, `setPass(target.pass)`, sätt refen ovan och stäng.
  Effekten som återställer dag och pass när tabellen byts (rad ~242) behåller
  ett pass som finns kvar, men kontrollera att valet inte skrivs över.

Texter på svenska. Färger från `--ui-*`. Inget `gray-*` eller `slate-*`.

## 8. Det som inte ingår

- Schema-sidan visar inget om närvaron.
- Ingen koppling sparas, och ingen manuell rättning av en felaktig matchning.
  Behövs det senare läggs valet i veckodokumentet (krypterat), inte i schemat.
- Schemats anteckning blir inte passnamn. `passNames` fungerar som i dag och
  visas i rubriken som i dag.
- Närvaro för nivågrupper i egna ark.
- Veckovyn i mobilläget.
- Att bläddra hela sidan till en annan vecka.

## 9. Steg

Varje steg avslutas med `pnpm exec tsc --noEmit`, `pnpm lint`, `pnpm test`
och `pnpm build`. Bocka av steget här och uppdatera raden i
`docs/plans/README.md` i samma PR. Steg 1–3 kan gå i en PR, 4–5 i en till.

- [x] **1. Matchningen.** Byggd 2026-11-16. Se avvikelserna i avsnitt 11. `utils/narvaroSchedule.ts` med tester för hela
  tabellen i avsnitt 5, klassreglerna (Tema ×3 uppdelat, Engelska ×3 inte,
  ett ensamt pass utan klass), `isMine` (`"Tobias  "`, `"Victor, Tobias"`,
  `"Alla"`, tomt), `targetForEntry` åt båda hållen, `isPlaceholderNote`,
  `sessionClasses` och `myClassesNow`. Bygg testdatan för hand efter avsnitt
  3 med påhittade lärarnamn. Lägg inga riktiga elevnamn i repot.
  Testdatan ligger i `utils/__fixtures__/narvaroSchedule.ts`.
- [x] **2. Hämtningen.** `hooks/useNarvaroSchedule.ts` med test, reglerna för
  färg och sal, och nyckeln för namnet. Byggd 2026-11-16.
- [x] **3. Raden "Enligt schemat"** på sidan och i mobilhuvudet, med
  väljaren för namnet. Byggd 2026-11-16.
- [x] **4. Förvald klass.** Byggd 2026-11-16.
- [x] **5. Veckovyn:** props i `PublicTimeGrid`, `NarvaroWeekDialog`, klick i
  aktuell och äldre vecka, pricken. Byggd 2026-11-16.
- [ ] **6. Tidigare pass** med schemats text, hämtad när veckan fälls ut.

## 10. Prov i webbläsaren

Mot en backend med minst ett veckoschema "v. NN" för innevarande vecka och
ett klistrat närvaroark per klass. Prova i Neo och Kronberg.

1. Välj Rosa, måndag, andra passet: raden visar Tema Rosa med lärare, sal och
   anteckning.
2. Välj Oliv och Rosa tillsammans: två rader.
3. Välj tisdag 12.30-14.30: tre Engelska-pass, det egna först och i fetstil.
4. Välj tisdagens första Studieverkstad: Ma 1, Ma Grund och Studieverkstad
   10:15. Den andra: passen 14:45.
5. Välj Hela dagen en dag med ett heldagspass: det visas. En vanlig dag:
   "Inget pass …".
6. Byt namn i väljaren: fetstilen och nedtoningen i veckovyn följer med, och
   valet finns kvar efter omladdning.
7. Veckovyn: klick på ett temapass väljer klassen, dagen och passet. Klick på
   ett Engelska-pass väljer alla klasser. Lunch går inte att klicka på.
8. Skriv en notering, öppna veckovyn: passet har en prick. Olivs notering
   ger ingen prick på Tema Rosa samma tid.
9. Bläddra en vecka bakåt och klicka på ett pass med prick: noteringarna
   visas i dialogen.
10. Döp om veckans schema så att det inte har något veckonummer: raden och
    knappen Veckan försvinner, och sidan fungerar som förut.
11. Ändra en anteckning i Schema i en annan flik och gå tillbaka: raden
    uppdateras.
12. Den publika schemasidan ser ut och fungerar som förut.
13. Mobilläget: raden syns under huvudet, och stämplingen fungerar som förut.
14. Nätverksfliken: inga anrop mot `/api/planner` med annan metod än GET från
    Närvarorutor.

## 11. Avvikelser från planen

Skrivna av sessionen som byggde stegen.

### Steg 1 (2026-11-16)

- `targetForEntry` tar veckans ark per klass (`sheets`) och alla klassnamn i
  stället för de hopslagna arken. `classesOnDay` behöver veta vilka klasser
  som har dagen, och det går inte att läsa ur `combineSheets`. Funktionen
  slår ihop arken själv.
- Ett pass som hör till flera kolumner och också täcker hela dagen
  (studiebesöket 08:30–15:30) ger `'day'`, inte kolumnen med störst
  överlapp. Annars valde ett klick på studiebesöket torsdagens sista pass.
- `myClassesNow` räknar bara ett pass som verkligen pågår (från tio minuter
  före start till slut). `defaultPass` faller annars tillbaka på dagens
  sista kryssade pass, och då valdes en klass även efter skoldagen. Den
  kräver också att kolumnens pass är uppdelade på klass (`isClassDivided`),
  så att "Engelska Grund" inte väljer klassen Grund.
- Tre hjälpare utöver förslagen: `columnSpan` (kolumnens tid, också för en
  kolumn utan tid), `entriesForChoice` (passen för sidans val, kolumn eller
  hela dagen) och `sortForDisplay` (egna först, sedan `compareLaneEntries`).

### Steg 2 (2026-11-16)

- `useNarvaroSchedule(enabled, currentWeek)` tar veckans nyckel som andra
  argument i stället för att räkna fram den själv, så att den följer sidans
  `now`. Den ger också `resolveColor` och `resolveRoom`.
- Namnet har en egen hook i samma fil, `useNarvaroScheduleName(username,
  teacherNames)`, som ger `{ name, setName }`. Reglerna för namnet
  (`sanitizeScheduleName`, `effectiveScheduleName`) ligger i
  `utils/narvaroSchedule.ts` med test.
- Går listan över scheman inte att hämta blir veckan `null`, och nästa vecka
  som efterfrågas försöker hämta listan igen.

### Steg 3 (2026-11-16)

- I det egna passets rad står titeln och användarens namn i fetstil, inte
  hela raden, så att namnet syns som i exemplet i 4.1.
- I mobilhuvudet står passen på en avkortad rad, skilda med " / ", inuti
  huvudet (en ny prop `schedule` på `NarvaroMobileHeader`) så att raden
  följer med när man scrollar. Väljaren för namnet finns inte i mobilläget;
  namnet väljs på datorn och gäller per enhet. Utan namn visas raden ändå,
  bara utan fetstil.

### Steg 4 (2026-11-16)

- Refen som stoppar förvalet sätts också när en tabell klistras in och sparas
  som en klass, när en tabell utan klass får en klass och när en grupp väljs
  i mobilläget, eftersom alla tre väljer klass.

### Steg 5 (2026-11-16)

- `PublicTimeGrid` gick att återanvända. De två nya propsen ändrar inget när
  de saknas; pricken ritas med `bg-ui-ink` och `border-ui-paper`.
- Logiken för pricken och för passen i en annan vecka ligger i
  `utils/narvaroSchedule.ts`: `sessionForEntry` (kolumn, nyckel och
  noteringar för ett schemapass), `sheetsForWeek` (varje klass senaste ark
  fram till veckan, som `latestSheets`) och `shiftWeek` (bläddra en vecka).
- Väljaren för namnet står i dialogens huvud ("Du i schemat:") och visar
  alltid det valda namnet. Den är samma komponent som på sidan
  (`ScheduleNamePicker` i `NarvaroScheduleLine.tsx`).
- En vecka före det första inklistrade arket har inga kolumner, och då går
  inga pass att klicka på. Noteringar finns ändå bara för veckor med ark.
- Noteringarna under rutnätet visar hela passets text (`sessionText`), också
  andra klassers noteringar samma pass, som i Tidigare pass.
- Provat i webbläsaren mot ett påhittat API (Playwright, v. 46 och 47): raden,
  förvald Rosa måndag 10.20, pricken (Olivs notering ger ingen prick på Tema
  Rosa), klick på Engelska väljer alla klasser, Lunch går inte att klicka på,
  en äldre veckas noteringar visas i dialogen, mobilhuvudet, och bara
  GET-anrop mot `/api/planner`.
