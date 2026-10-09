# Plan: Basscheman och veckoscheman

Status: plan, inte påbörjad. Skriven 2026-10-09, efter att PR #211 (färre
knappar och Kronberg) slagits ihop med main. Bygger på den nya dialogen Nytt
schema därifrån. Kräver ändringar i både `drive_c_frontend` och
`drive_c_backend`.

Idag är alla sparade scheman samma sorts sak, plus huvudschemat som gäller när
inget schema är öppet. I praktiken används scheman redan på två sätt:

- Som **mall**. Arbetslag bygger sin veckomall på ett schema och läser dess
  övriga pass som lärarnas fasta timmar (`LabState.archiveId`).
- Som **vecka**. Terminsplaneraren kopplar varje vecka till ett schema och
  föreslår det utifrån namnet (`suggestArchiveForWeek`). Den publika länken
  pekas om när veckan byts. Workspace hämtar in schemadagar.

Planen gör uppdelningen synlig. Ett schema är antingen ett **basschema** eller
ett **veckoschema**. Ett nytt veckoschema utgår från ett basschema eller börjar
tomt. Huvudschemat tas bort ur gränssnittet.

Vinsterna:

- Veckorna glider inte isär. Idag är det lätt att göra v.45 som en kopia av
  v.44 och få med v.44:s engångsgrejer (prov, utflykt, vikarie). Utgår varje
  vecka från basen börjar den rent.
- Varje lista visar det som går att välja där: Arbetslag basscheman,
  terminsplaneraren veckoscheman.
- Basen ändras inte av misstag, eftersom den öppnas skrivskyddad.

Riktlinjer för hela planen:

- Inget som pekar på ett schema får gå sönder. Arbetslag, terminsplaneraren,
  den publika länken och workspace pekar med id eller namn. Ingen av dem byter
  id, och ett val som redan är gjort visas även om det inte längre är av rätt
  sort (avsnitt 11 och 12).
- Ingen data raderas. Huvudschemats rader ligger kvar i databasen (avsnitt 5).
- Backend driftsätts före frontend (avsnitt 3.5).

---

## 1. Beslut

| # | Fråga | Beslut |
|---|---|---|
| 1 | Huvudschemat | **Tas bort ur gränssnittet.** Det fyller ingen funktion. Är inget schema öppet går det inte att redigera. Raderna i databasen lämnas orörda. |
| 2 | Minns veckan sin bas? | **Nej, inte i den här planen.** Basen kopieras in när veckan skapas. En ändring i basen slår inte igenom i veckor som redan finns. Byts basen mitt i läsåret görs ett nytt basschema. Att jämföra en vecka med sin bas ligger utanför planen (avsnitt 18). |
| 3 | Antal baser | **Flera samtidigt.** Dialogen visar alltid en lista och förväljer den bas som användes senast. |
| 4 | Kopiera en annan vecka | **Behålls**, som Duplicera på kortet. Den finns inte som val i dialogen Nytt veckoschema. |
| 5 | Skydd för basen | **Basen öppnas skrivskyddad** tills man väljer Redigera bas. |
| 6 | Arbetslags egna veckor (`LabWeek`) | **Rörs inte.** Arbetslag har en egen mall och egna veckor, skilda från schemaplanerarens veckoscheman. Om de ska kopplas ihop tas upp när uppdelningen använts ett tag (avsnitt 18). |
| 7 | Befintliga scheman | **Alla blir veckoscheman.** Baserna görs om för hand med Gör till basschema på kortet. Att gissa på namnet slår fel på namn som "Höstlov" eller "Prao". |
| 8 | Vem byter sort | **Bara ägaren**, precis som radering. Det går inte när någon annan har schemat öppet. |

---

## 2. Begrepp

| Begrepp | Betydelse |
|---|---|
| Basschema | Hur en vanlig vecka brukar se ut. Ändras sällan. Öppnas skrivskyddat. |
| Veckoschema | En verklig vecka, t.ex. "v.45". Skapas från en bas eller tomt och ändras fritt. |
| Sort | `kind` i datamodellen: `base` eller `week`. |
| Inget schema öppet | Läget efter första inloggningen, efter att ha tagit bort det öppna schemat och efter att ha lämnat ett delat schema. Rutnätet är tomt och går inte att ändra. |

Delning, lås och radering fungerar likadant för båda sorterna. Namnen är
fortfarande unika per ägare över båda sorterna. Ett basschema och ett
veckoschema kan alltså inte heta samma sak.

---

## 3. Backend

### 3.1 Kolumnen

`models/planner_models.py`, `PlannerArchive`:

```python
# "week" eller "base". Befintliga scheman blev veckoscheman när kolumnen
# kom till. Basscheman görs om för hand i gränssnittet.
kind = db.Column(db.String(10), nullable=False, default="week", server_default="week")
```

Ingen CHECK-constraint. Värdet kontrolleras i koden, som i resten av filen.

### 3.2 Migrationen

`migrations/versions/019_add_planner_archive_kind.py`, revision
`019_planner_archive_kind`, `down_revision = '018_arbetslag_plan_share'`.

- Byggs som 012: `_has_column`-vakten, `op.add_column('planner_archive',
  sa.Column('kind', sa.String(10), nullable=False, server_default='week'))`.
- `server_default` fyller i befintliga rader i samma ALTER. Den gör också att
  den gamla koden, som körs mellan migrationen och reload, kan fortsätta lägga
  till rader utan att nämna kolumnen.
- `downgrade` tar bort kolumnen om den finns.
- `db.create_all()` lägger inte till kolumner i befintliga tabeller
  (DEPLOY.md). Migrationen är alltså enda vägen.

### 3.3 API

`api/planner_routes.py`:

| Var | Ändring |
|---|---|
| `_archive_payload` | Lägger till `"kind": archive.kind or "week"`. Alla svar som innehåller ett schema får fältet: listan, skapa, läsa, spara, lås och delning. |
| `POST /archives` (`create_planner_archive`) | Tar emot `kind`. Saknas den blir det `week`. Andra värden än `week` och `base` ger 400 "Okänd sort". |
| **Ny:** `PATCH /archives/<id>` | Body `{"kind": "base" \| "week"}`. Svarar med det serialiserade schemat. Regler i ordning: 404 om användaren inte når schemat (`_load_archive`), 403 om användaren inte är ägare ("Bara den som äger schemat kan byta sort."), 400 vid okänd sort, 409 via `_archive_locked_response` om någon annan har låset. Samma sort som förut är 200 utan ändring. `updated_at` ska inte ändras: den publika länken visar "Uppdaterad …" ur den kolumnen, terminsplaneraren använder den för att välja mellan likadana namn, och sorten är inget innehåll. Kolumnen har `onupdate=datetime.utcnow`, så en vanlig tilldelning (`archive.kind = …`) flyttar den ändå. Skrivningen görs därför som `PlannerArchive.query.filter_by(id=archive.id).update({"kind": kind, "updated_at": archive.updated_at}, synchronize_session=False)` följt av `db.session.expire(archive)`, samma mönster som `_clear_lock`. |
| Namnbaserade vägar (`_ensure_archive`, `POST /activities/sync` med `archiveName`) | Oförändrade. Rader som skapas där får `week` från standardvärdet. |
| `GET /activities`, `POST /activities/sync` utan namn, `DELETE /activities` | **Oförändrade och kvar.** Workspace-provenance läser fortfarande huvudschemat (avsnitt 5.4). |
| Publika länken | Oförändrad. En länk får peka på båda sorterna. |

Att ett skrivskyddat basschema inte går att spara är en regel i frontend, inte
i backend. Alla med tillgång har redan skrivrätt, och Redigera bas är ett
skydd mot misstag, inte en behörighet.

### 3.4 Tester

I `tests/test_planner_sharing.py` eller en ny `tests/test_planner_archive_kind.py`:

- Ett schema som skapas utan `kind` är `week`, och listan visar `kind`.
- `POST /archives` med `kind: "base"` ger ett basschema. Ett okänt värde ger 400.
- PATCH: ägaren byter sort (200). Den som fått schemat delat får 403. Ett okänt
  värde ger 400. Har någon annan låset blir det 409, men inte när låset är ens
  eget eller ledigt.
- PATCH ändrar inte `updated_at` och rör inga poster.
- Den namnbaserade sparningen skapar fortfarande ett veckoschema
  (`test_legacy_name_based_save_creates_an_archive_row` kompletteras).

### 3.5 Driftsättning: backend först

Frontend går live på Vercel när main uppdateras. Backend kräver de manuella
stegen i DEPLOY.md. Ny frontend mot gammal backend går fel tyst: `kind: "base"`
i `POST /archives` ignoreras och basen blir ett veckoschema, och PATCH svarar
404.

Ordningen:

1. Backend-PR:en slås ihop.
2. På PythonAnywhere: `git pull`, `python -m alembic upgrade head`, Reload.
3. `python -m alembic current` ska visa `019_planner_archive_kind (head)` och
   `MySQLImpl`.
4. Först därefter slås frontend-PR:en ihop.

Raden läggs till i historiktabellen i DEPLOY.md. Där saknas också 017 och 018,
som läggs till samtidigt.

Frontend tål en gammal backend vid läsning: ett schema utan `kind` räknas som
veckoschema (avsnitt 4.1).

---

## 4. Frontend: data

### 4.1 Typen

`src/types/schedule.ts`:

```ts
export type ScheduleKind = 'week' | 'base';

export interface PlannerArchiveSummary {
  // …
  /** Saknas från en backend som är äldre än basschemana. Räknas då som 'week'. */
  kind?: ScheduleKind;
}
```

Ny fil `src/utils/scheduleKind.ts` med rena funktioner och tester
(`scheduleKind.test.ts`):

- `isBaseSchedule(archive)`: `archive.kind === 'base'`. Ingen annan kod jämför
  `kind` direkt.
- `partitionSchedules(archives)` ger `{ bases, weeks }`. Båda sorteras med
  dagens `sortArchives`, egna före delade.
- `optionsWithCurrent(archives, filter, currentId)` ger det som ska stå i en
  lista: de som klarar filtret, plus det redan valda om det finns men inte
  klarar filtret. Det används av Arbetslag och terminsplaneraren (avsnitt 11
  och 12).

### 4.2 plannerService

- `createArchive(name, kind: ScheduleKind = 'week')` skickar `{ name, kind }`.
- Ny `setArchiveKind(id, kind)`: `PATCH /archives/<id>`. Kastar
  `ArchiveLockedError` vid 409 (`assertNotLocked`), annars ett fel med serverns
  meddelande.
- `getPlannerActivities`, `syncActivities` och `getPlannerArchive` finns kvar.
  Den första används av räddningen (5.2) och provenance (5.4). De andra två
  används av workspace.

### 4.3 createSchedule.ts

- `createScheduleFrom` får `kind: ScheduleKind` och skickar den till
  `createArchive`. Allt annat är som förut: källan läses först, posterna får
  nya id, och låset på det förra schemat släpps.
- `NewScheduleSource` behåller `main`, men bara för räddningen i 5.2.
  `resolveScheduleSource` förväljer aldrig `main`: ett sparat `main` blir
  `empty`.
- Nytt i `resolveScheduleSource`: för ett veckoschema gäller det sparade valet
  bara om källan fortfarande är ett basschema. Annars väljs den första basen i
  listan, och finns ingen bas blir det `empty`.
- Testerna i `createSchedule.test.ts` utökas med `kind`, de nya reglerna för
  förval och att `main` aldrig förväljs.

---

## 5. Huvudschemat tas bort

### 5.1 Inget schema öppet

`src/hooks/usePlannerSync.ts`:

- Uppstart med `initialArchiveId === null`: ingen hämtning. Schemat är tomt
  och `loadStatus` blir `loaded`.
- Om schemat inte går att läsa vid uppstart visas inte huvudschemat i stället.
  Idag står det "Kunde inte ladda schemat. Visar huvudschemat istället." (rad
  ~150). Nu blir rutnätet tomt, `loadStatus` blir `error` och meddelandet är
  "Kunde inte läsa schemat. Ladda om sidan." `activeArchiveId` lämnas som det
  är, så det sparade id:t i localStorage finns kvar och nästa laddning
  försöker igen. Autosparet kör bara när `loadStatus` är `loaded` och tiger
  alltså. Redigeringen spärras med skälet `load-error` (avsnitt 6).

  Det här rättar ett befintligt fel. Idag står `activeArchiveId` kvar på
  schemat som inte gick att läsa, medan rutnätet visar huvudschemat. Nästa
  ändring sparas då in i det schemat och skriver över det med huvudschemats
  poster.
- `pushSchedule` utan `activeArchiveId` gör ingenting. Grenen som anropar
  `syncActivities` tas bort. Autosparningen kan alltså aldrig skriva till
  huvudschemat.
- Kommentaren "null för huvudschemat" på `activeArchiveId` skrivs om.

`NewSchedulePlanner.tsx`:

- Statusraden i verktygsfältet (rad ~1455) visar "Inget schema öppet" i stället
  för "Huvudschema". Titeln blir "Öppna ett schema i listan Scheman, eller
  skapa ett nytt."
- Rutnätet visar ett tomt läge i mitten: "Inget schema är öppet." och knapparna
  **Nytt veckoschema** och **Visa scheman**. Den andra fäller ut högerpanelen,
  som är hopfälld från början (`isRightSidebarCollapsed`). På mobil, där
  högerpanelen saknas, visas bara texten och veckobläddraren.
- Redigeringen spärras med samma spärr som läsläget (avsnitt 6).

### 5.2 Det som redan ligger i huvudschemat

Appen har flera användare, och en kollegas huvudschema kan innehålla riktigt
arbete. Därför raderas inget, och det finns en väg ut:

- Dialogerna Nytt veckoschema och Nytt basschema hämtar huvudschemat en gång
  när de öppnas (`getPlannerActivities`). Har det poster visas valet **Gamla
  huvudschemat (N poster)** under Utgå från. Det skapar ett schema av det,
  precis som `main` gör idag.
- Valet visas oavsett om ett schema är öppet. Begränsningen idag ("bara när
  inget schema är öppet") fanns för att huvudschemat kunde ha osparade
  ändringar i rutnätet. Det kan det inte längre.
- Valet minns aldrig och förväljs aldrig.
- Är huvudschemat tomt, eller går det inte att hämta, syns valet inte.
- Valet och `main` kan tas bort i en senare PR, när ingen längre har något där.

### 5.3 Ta bort eller lämna det öppna schemat

Idag: `handleConfirmDeleteWeek` och `handleLeaveShare` sätter
`activeArchiveId` till `null`, men rutnätet visar kvar det borttagna schemats
poster. Nästa ändring sparas då i huvudschemat. Det är ett befintligt fel som
planen tar bort:

- Båda tömmer rutnätet med `applyScheduleFromServer(() => [], { clearHistory:
  true })` och stegar `serverSyncToken`.
- Läget blir Inget schema öppet (5.1).

### 5.4 Workspace

- `ScheduleImportModal.tsx`: valet "Nuvarande arbetsschema"
  (`WORKING_SCHEDULE`, rad 28) tas bort. Kvar blir de egna schemana.
- `useProvenance.ts` lämnas orört. Workspace-element som en gång hämtats från
  huvudschemat jämförs fortfarande mot det. Ingen skriver dit längre, så de
  står som oförändrade. Att ta bort läsningen skulle göra dem till "källan
  saknas".

### 5.5 Det som inte ändras

- Backendens endpoints för huvudschemat (3.3).
- `dev-planning-check`: stubben svarar fortfarande på `/planner/activities`,
  nu bara för räddningen. Arkiven i stubben får `kind`. Ett basschema läggs
  till så att läsläget går att prova. PATCH stubbas.

---

## 6. Läsläget får ett skäl

Idag finns ett enda `isReadOnly`, och det betyder att någon annan har låset.
Det ersätts med ett skäl, som räknas fram i `useArchiveManager`:

```ts
type ReadOnlyReason = 'no-schedule' | 'load-error' | 'base' | 'locked' | null;
```

Ordningen avgör när flera gäller:

1. `no-schedule`: inget schema är öppet.
2. `load-error`: schemat gick inte att läsa vid uppstart (5.1).
3. `base`: ett basschema som inte redigeras (avsnitt 7).
4. `locked`: någon annan har låset. Det gäller båda sorterna.
5. `null`: det går att ändra.

`useArchiveManager` räknar fram `no-schedule`, `base` och `locked`.
`load-error` kommer från `usePlannerSync` (`loadStatus`) och läggs ovanpå i
`NewSchedulePlanner.tsx`. `usePlannerSync` tar redan emot `isReadOnly` från
arkivhanteraren, så åt andra hållet skulle det bli ett beroende i cirkel.

`isReadOnly` finns kvar som `readOnlyReason !== null`, så att
`useUndoableState` (`canEdit`), `useDragHandlers`, `dragDisabled`, autosparet
och `isReadOnlyRef` fungerar som idag. `commitSchedule` i
`NewSchedulePlanner.tsx` är fortfarande den enda spärren. Bara meddelandet
beror på skälet:

| Skäl | Meddelande |
|---|---|
| `no-schedule` | Öppna eller skapa ett schema först. |
| `load-error` | Schemat gick inte att läsa. Ladda om sidan. |
| `base` | Basschemat är skrivskyddat. Tryck Redigera bas för att ändra. |
| `locked` | Som idag: "X har schemat öppet. Tryck "Ta över" för att kunna ändra." |

Ladda säkerhetskopia (JSON) är avstängd när det inte går att ändra, med skälet
som `title`. Idag sätter `handleConfirmImport` byggstenar och inställningar
även när schemat är spärrat, så att importen blir till hälften gjord. Med
knappen avstängd kan det inte hända. Spara säkerhetskopia och Exportera
fungerar i alla lägen.

---

## 7. Basschemat är skrivskyddat

### 7.1 Öppna

- `handleLoadWeek` på ett basschema läser posterna som idag
  (`loadArchiveEntries`) men **tar inte låset**. Låset på det schema som var
  öppet släpps som idag.
- Läsningen (`GET /archives/<id>/activities`) svarar med schemat och dess lås.
  Redigerar någon annan basen just då syns det utan att man behöver ta låset.
- Ny state `isEditingBase` i `useArchiveManager`. Den sätts till `false` varje
  gång ett annat schema öppnas.
- Uppstart (`start()` i `useArchiveManager`) med ett sparat id som pekar på en
  bas: samma sak, inget lås. Efter en omladdning är basen alltså skrivskyddad
  igen.
- `pagehide` och bytet till ett annat schema släpper låset på en bas man inte
  har låst. Backend släpper bara ett lås man själv har
  (`release_archive_lock`), så det är ofarligt.

### 7.2 Redigera bas

Raden i verktygsfältet där läsläget visas idag (rad ~1489) visar för en bas som
inte redigeras:

> 🔒 Basschema · skrivskyddat **[Redigera bas]**

Har någon annan låset står också "X redigerar just nu" i raden.

Redigera bas:

1. `acquireArchiveLock(id)`.
2. Fick vi låset: posterna läses om (`loadArchiveEntries`), eftersom någon kan
   ha sparat sedan basen öppnades. Sedan sätts `isEditingBase = true`.
3. Fick vi det inte: `isEditingBase = true` ändå. Skälet blir då `locked`, och
   raden visar den vanliga låsraden med Ta över. `handleTakeOverLock` fungerar
   som idag.

### 7.3 Klar

Medan basen redigeras visar raden:

> Redigerar basschema **[Klar]**

Klar:

1. Sparar det som inte sparats ännu (7.4).
2. Misslyckas sparningen stannar man i redigeringsläget med meddelandet "Kunde
   inte spara. Försök igen." Basen låses inte så att ändringar går förlorade.
3. Annars släpps låset (`releaseArchiveLock`) och `isEditingBase` blir `false`.

### 7.4 Spara nu

Autosparet väntar en sekund (`AUTOSAVE_DELAY_MS`) och tiger i läsläge. Den som
trycker Klar inom en sekund efter en ändring skulle annars tappa den. Därför
får `usePlannerSync` en `saveNow(): Promise<boolean>`:

- Gör ingenting och svarar `true` när schemat inte ändrats sedan senaste
  sparningen (`lastSavedSignatureRef`).
- Väntar in en sparning som redan pågår.
- Annars `pushSchedule()`. Svarar `false` vid fel.

`saveNow` anropas före allt som byter läge eller schema:

- Klar (7.3).
- Byte av sort på det öppna schemat (avsnitt 10).
- `handleLoadWeek`, Nytt veckoschema, Nytt basschema och Duplicera, innan
  något annat schema öppnas.

Den sista punkten rättar också ett befintligt glapp: idag kan en ändring som
görs mindre än en sekund före ett schemabyte gå förlorad. Misslyckas `saveNow`
vid ett byte görs bytet ändå, men med varningen "Den senaste ändringen
sparades inte." Att stoppa ett byte för att servern inte svarar vore värre.

---

## 8. Högerpanelen (Scheman)

```
Scheman                               [>]
[ + Nytt veckoschema ]

BASSCHEMAN                            [+]
  Bas HT26
  Bas lågstadiet          Från hanna

VECKOSCHEMAN
  ● v.44  Öppet
  v.45
  v.46                    Från hanna
```

- Basscheman står överst. De är få och ändras sällan, och under en termins
  veckor skulle de försvinna.
- Inom varje sektion står egna scheman före delade. Rubriken "Delade med mig"
  tas bort. Kortet visar redan "Från X".
- **Nytt veckoschema** är den stora knappen, som Nytt schema idag.
  **Nytt basschema** är `+` vid rubriken Basscheman (`aria-label` och `title`
  "Nytt basschema").
- Saknas basscheman står under rubriken: "Inga basscheman ännu. Gör om ett
  schema med Gör till basschema, eller skapa ett med +."
- `sortedArchives` blir `[...bases, ...weeks]`, i samma ordning som panelen.
  Tangentnavigeringen (`useScheduleKeyboardNav`) och `ArchiveCard.index`
  räknar på den, så ordningen måste stämma.
- Mobilens veckobläddrare (`useMobileNavigation`) får bara veckoscheman. När
  inget schema är öppet är indexet −1 och etiketten "Inget schema öppet". Idag
  blir det 0, och första schemats namn visas fast det inte är öppet. Nästa
  öppnar då det första veckoschemat.

### 8.1 Korten

`ArchiveCard.tsx` får `onChangeKind`. Knappen visas bara för ägaren, bredvid
Duplicera, Dela och Ta bort, och syns på samma sätt som de (hovring, fokus,
markering, pekskärm):

| Kortet är | Ikon (lucide) | `aria-label` och `title` |
|---|---|---|
| Veckoschema | `Layers` | Gör till basschema |
| Basschema | `CalendarDays` | Gör till veckoschema |

Duplicera på ett basschema ger ett nytt basschema, och på ett veckoschema ett
nytt veckoschema. Sorten följer med.

---

## 9. Dialogerna

`NewScheduleDialog.tsx` får `kind` och visas i tre varianter.

### 9.1 Nytt veckoschema

- Titel: **Nytt veckoschema**. Namn som idag (platshållare "t.ex. v.45").
- **Utgå från** som en lista:
  - Basscheman: egna, sedan delade (optgroup "Basscheman").
  - Tomt schema.
  - Gamla huvudschemat (N poster), bara enligt 5.2.
- Förval: senast använda bas (`NEW_SCHEDULE_SOURCE_KEY`), annars den första
  basen, annars Tomt schema (4.3).
- Hjälptext som idag: "Posterna kopieras till det nya schemat, som öppnas
  direkt. Källan ändras inte."
- Det nya veckoschemat öppnas med låset taget (`POST /archives` tar det) och
  går att ändra direkt.

### 9.2 Nytt basschema

- Titel: **Nytt basschema**. Platshållare "t.ex. Bas HT26".
- Utgå från: Tomt schema, egna och delade basscheman, egna och delade
  veckoscheman (en bra vecka kan bli en ny bas) och räddningen enligt 5.2.
- Förval: Tomt schema. Valet sparas inte.
- Det nya basschemat öppnas i redigeringsläge (`isEditingBase = true`).
  Låset har man redan, och man skapar en bas för att fylla den.

### 9.3 Duplicera

- Samma dialog som idag. Titeln är **Duplicera v.44** och namnet "v.44
  (kopia)". Utgå från är låst till kortet och visas som text, inte som lista.
- Sorten är kortets sort. Valet sparas inte, som idag
  (`rememberSourceRef`).

### 9.4 Gemensamt

- Varningen när det öppna schemats senaste sparning misslyckades
  (`sourceHasUnsavedChanges`) finns kvar.
- Namnkontrollen gäller de egna schemana av båda sorterna, eftersom namnen är
  unika över sorterna (avsnitt 2).
- `canUseMainSchedule` försvinner ur dialogens props och ur
  `ArchiveDialogs.tsx` (rad 65).

---

## 10. Byta sort

`handleChangeKind(archive)` i `useArchiveManager`:

1. Är schemat öppet: `saveNow()` först (7.4).
2. `setArchiveKind(id, nästa sort)`. Svaret ersätter kortet (`upsertArchive`).
3. Var schemat öppet öppnas det igen med de nya reglerna:
   - **Vecka → bas:** låset släpps och basen visas skrivskyddad. Den som
     gjorde om den vill nästan aldrig fortsätta ändra i den, och Redigera bas
     finns ett klick bort.
   - **Bas → vecka:** låset tas. Ett veckoschema är redigerbart.
4. Meddelande: "v.44 är nu ett basschema." eller "Bas HT26 är nu ett
   veckoschema."
5. Fel: 409 ger "X har schemat öppet. Sorten kan bytas när hen gått ur." 403
   kan inte uppstå, eftersom knappen bara visas för ägaren. Det hanteras ändå
   med serverns meddelande.

Ingen bekräftelsedialog. Bytet går att ångra med samma knapp, och inga poster
ändras.

Kollegor som har schemat delat ser den nya sorten nästa gång listan hämtas.
Har en kollega ett veckoschema öppet när det blir en bas stoppar backend bytet
(409), så ingen mister redigeringen mitt i arbetet.

---

## 11. Arbetslag

`src/components/lesson-lab/LessonLab.tsx`, väljaren (rad ~375) och
`useLabArchive.ts`:

- Etiketten "Schema" blir **Basschema**. Titeln: "Basschemats temapass blir
  rutorna, och övriga pass räknas som lärarnas fasta timmar".
- Listan visar basscheman, plus det schema som redan är valt om det är ett
  veckoschema, märkt "v.44 (veckoschema)" (`optionsWithCurrent`, 4.1). Det
  är fallet efter driftsättningen, när alla scheman först är veckoscheman.
- **`source.archives` filtreras inte.** `archiveUnreachable` (rad 156), "Inte
  delat med dig" och "Schemat finns inte längre" (rad 387) räknas på hela
  listan, precis som idag. Filtreras listan visas "Schemat finns inte längre"
  för ett schema som finns, och de fasta timmarna ser ut att ha försvunnit.
  Det är det enda sättet ändringen kan få Arbetslag att se trasigt ut, och det
  här förhindrar det.
- Finns inga basscheman visas under väljaren: "Inga basscheman ännu. Gör om
  ett schema till basschema i Schema."
- Inget ändras i upplägget (`LabState`), i delningen (`LabShareDialog`) eller
  i exporten (`labExport.ts`).

---

## 12. Terminsplaneraren

`src/components/term-planner/TermWeekGrid.tsx` (rad ~88–123),
`TermPlanner.tsx` och `src/utils/termPlanner.ts`:

- Veckornas listor visar veckoscheman, plus det redan valda om det är ett
  basschema, märkt "Bas HT26 (basschema)".
- `archiveIds` i `TermPlanner.tsx` (rad 215) räknas på hela listan och avgör
  om ett schema finns. Filtreras den visas basen som "(borttaget schema)" och
  veckan räknas som saknad i diagrammen. Samma princip som i Arbetslag.
- `suggestArchiveForWeek` och `fillSuggestedArchives` föreslår bara
  veckoscheman. En bas som heter "Bas v.35" ska inte föreslås för vecka 35.
  Test i `termPlanner.test.ts`.

---

## 13. Övriga ställen som listar scheman

| Var | Ändring |
|---|---|
| `PublicLinkControl.tsx` (rad ~260) | Listan grupperas med `optgroup`: Veckoscheman först, sedan Basscheman. Allt går att välja som förut. |
| `ScheduleImportModal.tsx` | Utöver 5.4: oförändrad. Den listar egna scheman med namn (`getPlannerArchiveNames`), och en dag ur ett basschema kan vara rimlig att hämta in. |
| `LabShareDialog.tsx` | Oförändrad. |

---

## 14. Ord

| Var | Text |
|---|---|
| Knapp i panelen | Nytt veckoschema |
| `+` vid Basscheman | Nytt basschema |
| Sektionsrubriker | Basscheman, Veckoscheman |
| Kortets knapp | Gör till basschema / Gör till veckoschema |
| Läsraden för basen | Basschema · skrivskyddat, Redigera bas |
| Redigeringsraden | Redigerar basschema, Klar |
| Statusraden utan schema | Inget schema öppet |
| Tomt läge | Inget schema är öppet. · Nytt veckoschema · Visa scheman |
| Utgå från, räddning | Gamla huvudschemat (N poster) |
| Arbetslag | Basschema |

"Huvudschema" och "Nuvarande arbetsschema" försvinner ur gränssnittet.
`docs/plans/schema-knappar-och-menyer.md` avsnitt 7 (Ord) och 13.2 får en rad
om att huvudschemat tagits bort, med hänvisning hit.

---

## 15. Risker

| Risk | Följd | Skydd |
|---|---|---|
| Frontend går live före backend | Baser blir veckoscheman, och Gör till basschema svarar 404 | Ordningen i 3.5 |
| Backend laddas om före migrationen | Alla schemaanrop svarar 500 (kolumnen saknas) | DEPLOY.md:s ordning: migrera, sedan Reload. Kontroll med `alembic current`. |
| Arbetslag och terminsplaneraren pekar på ett schema av "fel" sort | "Schemat finns inte längre" fast det finns | Hela listan avgör om ett schema finns, filtret gäller bara valen (11, 12) |
| En kollegas huvudschema har innehåll | Det syns inte längre | Inget raderas. Räddningen i 5.2. |
| Ändring precis före Klar eller ett schemabyte | Den förloras | `saveNow` (7.4) |
| Det borttagna schemats poster blir kvar i rutnätet | Nästa ändring sparas i huvudschemat | 5.3, och autosparet skriver aldrig dit (5.1) |
| Schemat går inte att läsa vid uppstart | Idag skrivs det över med huvudschemats poster vid nästa ändring | Tomt rutnät och `load-error` (5.1) |
| PATCH flyttar `updated_at` via `onupdate` | Publika länken visar fel "Uppdaterad", och terminsplanerarens förslag ändras | Explicit `update` som behåller värdet (3.3) |
| Ladda säkerhetskopia i läsläge | Inställningar byts men schemat inte | Knappen avstängd (avsnitt 6) |
| Sorten byts medan en kollega redigerar | Hen hamnar i läsläge mitt i arbetet | 409 från backend (10) |
| Ordningen i panelen och `sortedArchives` skiljer sig | Tangentnavigeringen markerar fel kort | `sortedArchives = [...bases, ...weeks]` (8) |

---

## 16. Genomförande

Två PR:er, en per repo. Backend först.

**Backend (`drive_c_backend`)**

1. Kolumn, migration 019, `_archive_payload`, `POST /archives` och
   `PATCH /archives/<id>` (3.1–3.3).
2. Tester (3.4). `pytest` grönt.
3. DEPLOY.md: historikraderna (3.5).

**Frontend (`drive_c_frontend`)**

1. Data: typen, `scheduleKind.ts` med tester, plannerService och
   `createSchedule.ts` med tester (avsnitt 4).
2. Läsläget med skäl (6), utan beteendeändring: `locked` som idag.
3. Huvudschemat bort: 5.1, 5.3 och 5.4. Räddningen (5.2).
4. `saveNow` (7.4) och basens skrivskydd (7.1–7.3).
5. Panelen och korten (8), dialogerna (9), byte av sort (10).
6. Arbetslag (11), terminsplaneraren (12) och övriga listor (13).
7. Stubben i `dev-planning-check` (5.5). Orden (14) och hänvisningen i den
   förra planen.

Varje steg ska klara `pnpm lint`, `pnpm test` och `pnpm build`.

---

## 17. Klart när

Backend:

- [ ] `alembic upgrade head` på en kopia av databasen ger `kind = 'week'` på
      alla befintliga scheman. `downgrade` tar bort kolumnen.
- [ ] Testerna i 3.4 går igenom, och alla befintliga planner-tester är gröna.

Frontend, provat mot en lokal backend med migrationen körd, i Neo och Kronberg:

- [ ] Första inloggningen utan sparat schema: tomt läge, ingen redigering och
      inget anrop till `POST /activities/sync`.
- [ ] Nytt basschema (tomt) öppnas i redigeringsläge, och posterna sparas.
- [ ] Klar sparar och släpper låset. Basen blir skrivskyddad. Dra, klistra in,
      Ctrl+Z, sök och ersätt, piltangenter och postdialogen ändrar ingenting
      och visar basens meddelande.
- [ ] Redigera bas tar låset och läser om posterna. En annan användare som
      redigerar basen ger låsraden med Ta över.
- [ ] Nytt veckoschema förväljer senaste basen, kopierar dess poster och öppnas
      redigerbart. Basen är oförändrad.
- [ ] Duplicera på en vecka ger en vecka, och på en bas en bas.
- [ ] Gör till basschema och Gör till veckoschema, både på ett öppet och ett
      stängt schema. 409 när en kollega har det öppet.
- [ ] Ta bort det öppna schemat ger tomt läge, och nästa ändring sparas
      ingenstans.
- [ ] Ett schema som inte går att läsa vid uppstart (backend nere eller 404)
      ger tomt rutnät med "Kunde inte läsa schemat". Inget sparas, och nästa
      laddning försöker med samma schema.
- [ ] Ett gammalt huvudschema med poster syns som "Gamla huvudschemat (N
      poster)" och går att göra till ett schema. Ett tomt syns inte.
- [ ] Arbetslag med ett upplägg som pekar på ett veckoschema visar det som
      "(veckoschema)" med de fasta timmarna kvar. Listan visar annars bara
      baser.
- [ ] Terminsplaneraren föreslår bara veckoscheman. En vald bas visas som
      "(basschema)", inte som borttagen.
- [ ] Workspace: Hämta in schemadagar saknar "Nuvarande arbetsschema".
      Element som hämtats från huvudschemat står som oförändrade.
- [ ] Mobil: bläddraren går bara mellan veckoscheman. Utan öppet schema visas
      "Inget schema öppet".
- [ ] Neo ser ut som förut, utom panelens nya sektioner och läsraden.

---

## 18. Utanför planen

- **Jämföra en vecka med sin bas** ("visa skillnader", "återställ dag från
  basen"). Kräver att veckan minns sin bas: ett `base_id` på
  `planner_archive`. Det kan läggas till senare utan att något i den här
  planen ändras.
- **Ändringar i basen som slår igenom i befintliga veckor.** Medvetet bortvalt
  (beslut 2).
- **Arbetslags veckor och veckoschemana** (beslut 6). En senare fråga är om
  Arbetslags vecka v.45 ska läsa de fasta timmarna ur veckoschemat v.45 i
  stället för ur basen. Det tas upp när uppdelningen använts ett tag.
- **Namnförslag** i Nytt veckoschema ("v.46" efter den senaste veckan).
- **Sorteringen över årsskiftet.** `sortArchives` sorterar på veckonummer, så
  v.1 hamnar före v.52. Mönstret (`^v\.?\s*(\d+)$`) skiljer sig också från
  terminsplanerarens `WEEK_IN_NAME`. Det är ett befintligt problem.
- **Att ta bort huvudschemats endpoints** i backend, och räddningen i 5.2.
  Görs när ingen användare har något kvar där.
