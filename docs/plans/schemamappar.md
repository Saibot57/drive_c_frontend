# Plan: Mappar för veckoscheman

Status: planerad 2026-10-21. Inget genomfört. Backend först (avsnitt 3.6).
Frågorna i avsnitt 13 är öppna.

Högerpanelen Scheman visar alla veckoscheman i en platt lista. Efter en halv
termin är den längre än skärmen: v.35–v.47, en introvecka och kopior, och
lika många till under vårterminen. Panelen får mappar som går att fälla in
och ut.

---

## 1. Beslut

- **Ägaren bestämmer mappen, och alla som har schemat ser den.** Mappen är en
  egenskap hos schemat, precis som sorten (bas eller vecka). Veckorna delas ut
  i en sittning till hela arbetslaget (kommentaren vid
  `ARCHIVE_SHARE_RATE_LIMIT` i `planner_routes.py`), och den som lägger upp
  dem ordnar dem då en gång för alla. Med personliga mappar hade varje kollega
  fått sortera samma lista själv.
- **Var och en lägger sina egna scheman i mappar.** Alla är ägare till de
  scheman de själva skapat. Ett delat schema kan mottagaren inte flytta.
- **En mapp är ett namn, inte en sak i sig.** Kolumnen `folder` på
  `planner_archive` är en textsträng. En mapp finns så länge något schema bär
  dess namn. Följderna:
  - Inga tomma mappar. Ny mapp skapas tillsammans med scheman att lägga i den
    (avsnitt 5.2).
  - Mappar med samma namn slås ihop i panelen. Har Anna en egen "HT26" och
    får Tobias "HT26" delad ligger allt i samma mapp hos henne.
- **Bara veckoscheman.** Basscheman är få och står redan överst. Ett
  veckoschema i en mapp som görs om till basschema visas under Basscheman.
  Mappnamnet ligger kvar, så schemat hamnar i mappen igen om det görs om till
  veckoschema.
- **En nivå.** Inga mappar i mappar. Panelen är 320 px bred, och
  tangentnavigeringen blir enkel.
- **Att flytta ett schema är inte att ändra det.** Flytten skrivs förbi
  `updated_at` (samma teknik som `update_archive_kind`). `version` och låset
  rörs inte. Terminsplanerarens förslag och den publika länkens "Uppdaterad"
  läser `updated_at`. En flytt väntar inte heller på låset: den gör ingen
  annan skrivskyddad, till skillnad från att byta sort.
- **Hopfällt läge är personligt** och sparas per dator i localStorage. Fäller
  Tobias ihop "HT26" ska den inte fällas ihop hos Anna. På servern hade det
  krävt en tabell per användare, vilket är precis det modellen undviker. Det
  går att lägga till senare (avsnitt 12).
- **Mapparna sorteras efter namn**, med siffror i nummerordning
  (`localeCompare(…, 'sv', { numeric: true })`). Egen ordning kräver
  uppgifter per användare och ligger utanför planen.

---

## 2. Begrepp

| Ord i UI | I koden | Betyder |
|---|---|---|
| Mapp | `folder` på `planner_archive` | Ett namn som scheman grupperas under i panelen |
| Flytta till mapp | `moveArchivesToFolder` | Ge ett eller flera egna scheman ett mappnamn, eller ta bort det |
| Utan mapp | `folder: null` | Ett veckoschema som inte ligger i någon mapp |

---

## 3. Backend

### 3.1 Kolumnen

I `PlannerArchive` (`models/planner_models.py`):

```python
# Mappen schemat visas i, eller NULL. Ägaren bestämmer, och alla som har
# schemat ser den, som `kind`. En mapp är bara ett namn: den finns så länge
# något schema bär det, och två ägares "HT26" blir en mapp hos mottagaren.
folder = db.Column(db.String(100), nullable=True)
```

### 3.2 Migrationen

`022_add_planner_archive_folder.py`, `down_revision =
'021_planner_archive_version'` (nuvarande enda head). Lägger till
`planner_archive.folder`, `VARCHAR(100) NULL`. Vakten `_has_column` byggs som
i `020`. Befintliga scheman får NULL och ligger utan mapp.

Docstringen förklarar varför migrationen behövs: `db.create_all()` lägger
inte till kolumner, och ny kod mot gammalt schema ger 500 i hela
schemaplaneraren. **Migrationen måste därför köras före reload.**

### 3.3 API

Den nya kolumnen behöver mycket lite ny kod i `planner_routes.py`, som redan
växer för mycket (arkitektur F16):

| Var | Ändring |
|---|---|
| `_archive_payload` | `"folder": archive.folder` i varje arkivsvar (lista, lås, sort, delning) |
| `create_planner_archive` | Tar emot `folder` (valfritt). Den som skapar är ägaren, så ingen extra kontroll |
| En ny hjälpfunktion | `_folder_name(value)`: trimmar, gör tom sträng till `None`, och nekar mer än 100 tecken |

Flytt och namnbyte läggs i en ny fil, `api/planner_folder_routes.py`, med
blueprinten `planner_folder_api` registrerad på `/api/planner/folders` i
`app.py`. Filen importerar `_load_archive`, `_serialize_archives` och
`_folder_name` från `planner_routes.py`. Beroendet går bara åt det hållet,
så det blir ingen cirkulär import. Nyckelstilen är camelCase, som resten av
Schema.

| Metod och väg | Gör | Svar |
|---|---|---|
| `PUT /folders/placements` `{ archiveIds, folder }` | Ger egna scheman mappnamnet, eller tar bort det (`folder: null`) | De ändrade schemana, serialiserade som i `GET /archives` |
| `POST /folders/rename` `{ from, to }` | Byter namn på mappen för användarens egna scheman | Samma |

- **Ägarkontroll:**
  - Varje id i `archiveIds` slås upp med `_load_archive`. Når användaren inte
    schemat ger det 404 "Schemat finns inte", för att inte avslöja vilka id
    som finns.
  - Äger användaren inte schemat ger det 403 "Bara den som äger schemat kan
    flytta det."
  - Ett enda fel nekar hela anropet, och ingenting skrivs.
- **Namnbyte** filtrerar på `owner_id = current_user.id AND folder = from`.
  Andra ägares mappar med samma namn rörs inte. Finns `to` redan slås
  mapparna ihop. Det är avsiktligt, och dialogen säger det (avsnitt 5.3).
- **Skrivningen** görs med `PlannerArchive.query.filter(...).update({"folder":
  …, "updated_at": PlannerArchive.updated_at}, synchronize_session=False)`.
  `updated_at` sätts till sig själv så att `onupdate` inte slår till.
  Därefter `db.session.expire_all()` före serialiseringen, så att svaret
  visar det sparade.
- **Gränser:** högst 200 id per anrop och mappnamn på högst 100 tecken.
  Felmeddelandena är på svenska:
  - "Ange ett namn för mappen"
  - "Namnet är för långt"
  - "För många scheman på en gång"
- Båda routes har `@token_required` och `@retry_on_connection_error`.
- **Ingen städning behövs.** Mappen följer med raden när ett schema raderas,
  och en avslutad delning tar bara bort mottagarens tillgång.

### 3.4 Sort och mapp

`update_archive_kind` ändras inte. Mappnamnet ligger kvar när sorten byts, och
det är frontend som låter bli att visa mappar för basscheman.

### 3.5 Tester

`tests/test_planner_folders.py`, med `BLUEPRINTS = [(planner_api,
'/api/planner'), (planner_folder_api, '/api/planner/folders')]`:

- Ägaren lägger ett schema i en mapp, och `folder` syns i `GET /archives` för
  ägaren och för **bob**, som fått schemat delat.
- **bob** kan inte flytta det delade schemat (403) och inte alls ett odelat
  (404). När ett av flera id är fel skrivs ingenting.
- bob lägger sina egna scheman i en mapp med samma namn. Hans "HT26" och
  alices delade "HT26" har samma namn, och båda ägarnas scheman behåller sina
  värden.
- Namnbyte rör bara den egna ägarens scheman, inte en annan ägares mapp med
  samma namn. Namnbyte till ett befintligt namn slår ihop mapparna.
- `folder: null` och `"  "` tar bort mappen. 101 tecken ger 400.
- `POST /archives` med `folder` lägger det nya schemat i mappen.
- En flytt ändrar inte `updated_at` eller `version`, och går igenom fast någon
  annan har låset.
- Att byta sort behåller `folder`.
- Svaren från lås och delning innehåller `folder`.

### 3.6 Driftsättning: backend först, migrationen före reload

- **Migrationen före reload:** ny kod läser kolumnen, och utan den ger varje
  fråga mot `planner_archive` 500.
- **Backend före frontend:** mot gammal backend saknas nyckeln `folder` helt i
  arkivsvaren (`undefined`, inte `null`). Frontend tolkar det som att mappar
  inte finns och visar panelen som i dag, utan knappen Ny mapp (avsnitt
  4.2). Det blir inget fel, men funktionen syns inte förrän backend är ute.
- **Gammal frontend mot ny backend** struntar i det nya fältet.

Raden i historiken i `DEPLOY.md`:

> `022_planner_archive_folder`: `folder` på `planner_archive` (mappen
> schemat visas i, bestäms av ägaren). **Före frontend:** mot gammal backend
> visas inga mappar. **Migrationen före reload:** ny kod mot gammalt schema
> ger 500 i hela schemaplaneraren.

---

## 4. Frontend: data

### 4.1 Typen

I `PlannerArchiveSummary` (`src/types/schedule.ts`):

```ts
/**
 * Mappen ägaren lagt schemat i, eller null. Saknas helt från en backend
 * äldre än migration 022, och då visas inga mappar.
 */
folder?: string | null;
```

### 4.2 plannerService

- `createArchive(name, kind, folder?)` skickar med `folder` när det är satt.
  `createScheduleFrom` (`utils/createSchedule.ts`) får parametern `folder`
  och skickar den vidare. Testerna i `createSchedule.test.ts` uppdateras.
- `moveArchivesToFolder(archiveIds, folder | null)` och
  `renameFolder(from, to)` returnerar `PlannerArchiveSummary[]`.
- Svaren packas upp som `unwrap` gör, och `error` kastas vid `success:
  false`. Tester i `plannerService.test.ts`.
- `foldersSupported(archives)` är sant när minst ett schema har nyckeln
  `folder`. Med en tom lista är det falskt, men då finns heller inget att
  lägga i mappar.

### 4.3 utils/scheduleFolders.ts (ny, med tester)

Ren logik, utan React:

- `groupWeekArchives(weekArchives)` ger `{ folders: { name, archives }[],
  loose }`.
  - Mapparna sorteras efter namn (svenska, numeriskt).
  - Inom en mapp gäller samma ordning som i `weekArchives` (egna före delade,
    veckonummer).
  - Mappnamn jämförs efter trimning, exakt. "HT26" och "ht26" blir två
    mappar, eftersom backend lagrar det som skrivits.
- `panelOrder(baseArchives, groups, collapsed)` ger listan i den ordning
  panelen visar den, utan scheman i hopfällda mappar. Tangentnavigeringen och
  `ArchiveCard.index` räknar på den (avsnitt 6).
- `folderNames(weekArchives)` ger alla mappnamn som syns, till menyer och
  dialoger.
- `sanitizeCollapsedFolders(raw)` läser localStorage defensivt.

### 4.4 hooks/useScheduleFolders.ts (ny)

Den egna hooken behövs eftersom `useArchiveManager.ts` redan är 755 rader
(arkitektur F17). Hooken:

- Håller hopfällda mappnamn i `schedulePanel.collapsedFolders.v1`
  (localStorage, en lista med namn). Fel från lagringen sväljs.
- Har `moveArchives(ids, folder)` och `renameFolder(from, to)`. Båda väntar på
  svaret och för in de returnerade schemana med `upsertArchives`.
  `useArchiveManager` får den funktionen: dagens `upsertArchive`, för en
  lista. Placeringen finns då bara på ett ställe, på schemat i arkivlistan.
- Ett eget namnbyte flyttar också det hopfällda läget till det nya namnet.
  Byter en kollega namn på sin mapp syns den som utfälld hos mottagarna, och
  det får räcka.
- Visar en notis vid fel och skriver inget lokalt förrän servern svarat.

---

## 5. Högerpanelen

```
Scheman                               [>]
[ + Nytt veckoschema ]

BASSCHEMAN                            [+]
  Bas ht26

VECKOSCHEMAN                     [mapp+]
  v.43
  v.45
  v.46
  ▸ 📁 HT26 – augusti–oktober    9    ⋯
  ▾ 📁 Introveckor               1    ⋯
      Introvecka HT26
```

Exemplet visar lösa scheman överst och mappar under, men ordningen är fråga
1 i avsnitt 13.

- **Mapprubriken** (`components/schedule/ArchiveFolder.tsx`, ny) är en knapp
  som fäller in och ut. Den har:
  - `ChevronRight` eller `ChevronDown`, och `aria-expanded`
  - mappikon, namn och antal scheman
  - `ActiveLamp` och, i Neo, "• öppet" när det öppna schemat ligger i en
    hopfälld mapp. Annars syns det inte vilket schema som är öppet
  - en ⋯-meny (avsnitt 5.3), som bara visas när användaren äger minst ett
    schema i mappen eller har egna lösa veckoscheman att lägga i den
- En mapp som innehåller det öppna schemat fälls inte ut av sig själv. Det
  hade gjort det omöjligt att fälla ihop mappen man arbetar i.
- Kort för delade scheman visar "Från X" som i dag, även inne i en mapp.
- **Listan bryts ut** till `components/schedule/ScheduleArchiveList.tsx` i
  stället för att växa i `NewSchedulePlanner.tsx` (arkitektur F13). Planeraren
  skickar in listorna och handlers.
- Utseendet kommer från befintliga klasser och tokens (`sp-archive-card`,
  `scheduleSectionLabel`, `--ui-*`). Inga hex-värden. Provas i Neo och
  Kronberg.

### 5.1 Flytta ett schema

Kortet har i dag Duplicera, Dela, Byt sort (ägaren) och Ta bort (ägaren),
var och en 28 px. En femte knapp lämnar knappt 90 px åt namnet medan kortet
hovras, och alltid på pekskärm.

Förslag: Byt sort och den nya Flytta till mapp hamnar i en ⋯-meny på kortet
(`DropdownMenu` med `DropdownMenuSub` från `components/ui/dropdown-menu.tsx`).
Menyn finns bara för ägaren, som Byt sort i dag. Ägaren har då fortfarande
fyra knappar, och mottagaren har kvar Duplicera och Dela.

- **Flytta till mapp ›** med alla mappnamn som syns i panelen, även de som
  bara har kollegors scheman (så hamnar ens egen v.35 i samma "HT26"), en
  avdelare, Utan mapp och Ny mapp…. Den nuvarande mappen är bockad.
- **Gör till basschema** eller **Gör till veckoschema**, flyttad från sin
  egen knapp.

Det ändrar ett beslut i `basscheman.md` (avsnitt 8.1). Se fråga 3 i avsnitt 13.

### 5.2 Ny mapp

Det finns inga tomma mappar, så Ny mapp är en dialog med två delar
(`dialogs/FolderDialogs.tsx`):

- **Namn**
- **Scheman att lägga i mappen:** kryssrutor för användarens egna
  veckoscheman. Lösa scheman står först, och de som redan ligger i en annan
  mapp står med mappens namn i grått.

Skapa är avstängd tills både namnet och minst ett schema är valda. Ett anrop,
`moveArchivesToFolder(ids, name)`. Knappen är `FolderPlus` vid rubriken
Veckoscheman, som `+` vid Basscheman (`aria-label` och `title` "Ny mapp").
Den syns bara när mappar stöds och användaren har egna veckoscheman.

"Ny mapp…" i kortets meny öppnar samma dialog, med kortet förkryssat.

### 5.3 Mappens meny

| Val | Gör | Visas |
|---|---|---|
| Lägg till scheman… | Samma dialog som Ny mapp, med namnet låst | När användaren har egna veckoscheman utanför mappen |
| Byt namn | Namndialog. `renameFolder(from, to)` | När användaren äger något schema i mappen |
| Ta bort mapp | Tar bort mappen från de egna schemana (`folder: null`) | När användaren äger något schema i mappen |

Ligger kollegors scheman i samma mapp säger dialogen vad som händer med dem:

> **Byt namn:** Bara dina 3 scheman byter mapp. De 9 från Tobias ligger kvar
> i "HT26".
>
> **Ta bort mapp:** Dina 3 scheman i "HT26" hamnar under Veckoscheman. De tas
> inte bort. De 9 från Tobias ligger kvar i mappen.

Utan kollegors scheman:

> Ta bort mappen "HT26"? De 9 schemana i den tas inte bort. De hamnar under
> Veckoscheman.

Finns det nya namnet redan: "Det finns redan en mapp som heter "VT27".
Schemana läggs ihop med den."

### 5.4 Drag och släpp (senare)

Det går, men det är inte nödvändigt för att mapparna ska vara till nytta:

- Hela planeraren ligger i en `DndContext` (`useDragHandlers.ts`), och
  `handleDragEnd` stoppar alla drag i läsläge innan den tittar på vad som
  dras. Ett schemakort måste därför hanteras först, och `DayColumn` måste
  strunta i det.
- `KeyboardSensor` startar ett drag på Enter och mellanslag på elementet med
  lyssnarna. På kortet skulle det ta över Enter, som öppnar schemat. Draget
  behöver därför ett eget grepp (`GripVertical`) som syns vid hovring, och
  bara på kort man äger.
- `DragOverlay` behöver en tredje gren för ett schemakort.

---

## 6. Tangentnavigering och mobil

- `useScheduleKeyboardNav` får `panelOrder` (avsnitt 4.3) i stället för
  `sortedArchives`. Pilarna hoppar då över scheman i hopfällda mappar, och
  Enter, `d` och Delete träffar det kort som syns markerat. Kommentaren vid
  Basscheman i panelen, om att ordningen måste stämma, gäller nu `panelOrder`.
- Mapprubrikerna är vanliga knappar i tabbordningen. De ingår inte i
  pilnavigeringen.
- Arkivzonens `useHotkeys` reagerar på pilarna även medan en ⋯-meny är öppen.
  Zonen behöver därför pausas (`isSuspended`) när en meny eller mappdialog är
  öppen, annars flyttar markeringen bakom menyn.
- Mobilens veckobläddrare (`useMobileNavigation`) behåller den platta listan
  `weekArchives`. Föregående och nästa går i veckoordning, oavsett mapp.
  Mobilen har ingen högerpanel.
- `PublicLinkControl`, terminsplanerarens väljare och Nytt schema-dialogens
  Utgå från ändras inte. Se avsnitt 12.

---

## 7. Nytt schema och Duplicera

- Dialogen får fältet **Mapp**: Utan mapp och alla mappnamn som syns. Fältet
  visas bara när det finns mappar.
- Förvalet är:
  - **Duplicera:** originalets mapp, även när originalet är en kollegas.
    Annas kopia av Tobias v.35 i "HT26" hamnar i Annas "HT26", som i hennes
    panel är samma mapp.
  - **Nytt veckoschema:** mappen där det öppna veckoschemat ligger, annars
    Utan mapp
  - **Nytt basschema:** fältet visas inte
- Mappen skickas med i `POST /archives`, så schemat skapas i mappen i samma
  anrop.

---

## 8. Ord

| Var | Text |
|---|---|
| Knapp vid Veckoscheman | Ny mapp |
| Dialogen Ny mapp | Rubrik "Ny mapp", fälten "Namn" och "Scheman", knappen Skapa |
| Mappens meny | Lägg till scheman… · Byt namn · Ta bort mapp |
| Kortets meny (ägaren) | Flytta till mapp › · Gör till basschema / Gör till veckoschema |
| Undermenyn | (mapparna) · Utan mapp · Ny mapp… |
| Notis vid flytt | Flyttade "v.35" till HT26. / Flyttade 8 scheman till HT26. |
| Fel | Kunde inte flytta schemat. / Kunde inte byta namn på mappen. |

---

## 9. Risker

- **Fel kort markerat med tangentbordet** om `panelOrder` och det som visas
  inte stämmer. Ordningen räknas därför fram på ett ställe (avsnitt 4.3) och
  testas, och både kortens `index` och navigeringen läser den.
- **Mappar från flera kollegor.** Den som får scheman från tre personer ser
  allas mappar. Med samma namn slås de ihop, och med olika namn blir de fler.
  Hopfällning per mapp gör att det ändå går att hålla panelen kort.
- **Namn som råkar vara lika** men betyder olika saker slås ihop hos
  mottagaren. Det är ovanligt i ett arbetslag, och korten visar fortfarande
  "Från X".
- **Två flikar:** den senaste ändringen gäller, och nästa inläsning visar
  serverns läge. En flytt är inget innehåll, så ingen version behövs.
- **Panelens bredd:** ⋯-menyn på kortet och mapprubrikens tre delar måste
  rymmas i Kronberg, som har bredare typsnitt. Provas med "Introvecka HT26".

---

## 10. Genomförande

1. **Backend-PR:** kolumnen, migration `022`, `folder` i `_archive_payload`
   och i `create_planner_archive`, `planner_folder_routes.py`, testerna och
   raden i `DEPLOY.md`. Ut i produktion: `git pull`, `python -m alembic
   upgrade head`, Reload.
2. **Frontend-PR:** typen, `plannerService`, `createScheduleFrom`,
   `utils/scheduleFolders.ts` med tester, `useScheduleFolders`,
   `upsertArchives`, `ScheduleArchiveList`, `ArchiveFolder`, `FolderDialogs`,
   ⋯-menyn på kortet, `panelOrder` till tangentnavigeringen och fältet Mapp i
   Nytt schema-dialogen. Raden i `docs/plans/README.md` uppdateras.

---

## 11. Klart när

- Ägaren kan lägga egna scheman i en ny eller befintlig mapp, ett i taget
  från kortet eller flera via dialogen. Hen kan byta namn på mappen och ta
  bort den, och då ligger schemana kvar.
- En kollega som har schemat delat ser det i samma mapp, men kan inte flytta
  det. Kollegan kan lägga sina egna scheman i mappar, även i en mapp med
  samma namn.
- Hopfällt läge är personligt och finns kvar efter omladdning på samma dator.
- Duplicera lägger kopian i originalets mapp.
- Flytten ändrar inte schemats "Uppdaterad" på den publika länken.
- Pilarna i panelen hoppar över hopfällda mappar, och Enter öppnar det kort
  som syns markerat.
- Det syns på mapprubriken att det öppna schemat ligger i en hopfälld mapp.
- Mot en backend utan kolumnen ser panelen ut som i dag.
- `pnpm exec tsc --noEmit`, `pnpm lint`, `pnpm test` och `pnpm build` går
  igenom, och `python -m pytest -q` och `python -m alembic heads` (en head) i
  backend.
- Provat i Neo och Kronberg, och med två användare där den ena delar scheman
  i en mapp med den andra.

---

## 12. Utanför planen

- **Mottagaren flyttar ett delat schema för egen del.** Det skulle kräva en
  tabell med personliga undantag, (`user_id`, `archive_id`, `folder`), som
  läses ovanpå ägarens mapp. Det går att lägga till utan att ändra något i
  den här planen.
- **Hopfällt läge som följer med mellan datorer.** Det kräver en tabell per
  användare med hopfällda mappnamn.
- Egen ordning på mapparna.
- Mappar för basscheman.
- Mappar i mappar.
- Att terminsplaneraren, den publika länken och Utgå från grupperar sina
  listor per mapp.
- Drag och släpp (avsnitt 5.4).
- Sorteringen av "v.40 (kopia)". `sortArchives` känner bara igen exakt
  "v.40", vilket hör till arkitektur F18 (två regex för veckonummer).

---

## 13. Öppna frågor

1. **Lösa scheman över eller under mapparna?** Förslag: över. Nya scheman är
   lösa tills de flyttas, och det är de man arbetar med. Mappar först, som i
   en filhanterare, går lika lätt att bygga.
2. **Ska en mapp man inte sett förut vara utfälld eller hopfälld?** Det gäller
   till exempel en kollegas nya mapp. Förslag: utfälld, så att det syns vad
   som kom. Den fälls ihop med ett klick och förblir då hopfälld.
3. **Byt sort in i ⋯-menyn på kortet?** Förslag: ja, annars blir kortet för
   trångt (avsnitt 5.1). Alternativet är en femte ikonknapp.
