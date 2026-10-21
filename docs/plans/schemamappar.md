# Plan: Mappar för veckoscheman

Status: planerad 2026-10-21. Inget genomfört. Backend först (avsnitt 3.6).
Frågorna i avsnitt 13 är öppna.

Högerpanelen Scheman visar alla veckoscheman i en platt lista. Efter en halv
termin är den längre än skärmen: v.35–v.47, en introvecka och kopior, och
lika många till under vårterminen. Panelen får mappar som användaren skapar
själv, lägger scheman i och fäller in och ut.

---

## 1. Beslut

- **Mapparna är personliga.** De flesta veckor är delade med arbetslaget.
  Lägger Tobias v.35 i "HT26" ska v.35 inte flytta hos Anna. Mappen och
  placeringen hör därför till användaren och inte till schemat. Ägare och
  mottagare ordnar samma schema var för sig.
- **Bara veckoscheman.** Basscheman är få och står redan överst. Ett
  veckoschema i en mapp som görs om till basschema visas under Basscheman.
  Placeringen ligger kvar, så schemat hamnar i mappen igen om det görs om
  till veckoschema.
- **En nivå.** Inga mappar i mappar. Panelen är 320 px bred, och
  tangentnavigeringen blir enkel.
- **Ett schema ligger i högst en mapp.** Det är ingen etikett.
- **En mapp som tas bort raderar inga scheman.** Schemana blir lösa igen.
- **Att flytta ett schema är inte att ändra det.** Placeringen ligger i en
  egen tabell. Schemats `updated_at`, `version` och lås rörs inte. Det spelar
  roll eftersom terminsplanerarens förslag och den publika länkens
  "Uppdaterad" läser `updated_at`. Att flytta ett schema som någon annan har
  öppet går alltså bra.
- **Ett anrop per ändring**, som Workspace. Mapparna är ingen gemensam
  handling, så de behöver varken version eller kö (frontendens `CLAUDE.md`,
  Sparning).
- **Hopfällt läge sparas på servern**, så att panelen ser likadan ut på
  skolans dator och hemma (fråga 2 i avsnitt 13).

---

## 2. Begrepp

| Ord i UI | I koden | Betyder |
|---|---|---|
| Mapp | `PlannerFolder`, `planner_folder` | En namngiven grupp i panelen, per användare |
| Flytta till mapp | `moveArchives` | Lägga ett eller flera scheman i en mapp, eller ta ut dem |
| Utan mapp | `folderId: null` | Ett veckoschema som inte ligger i någon mapp |

---

## 3. Backend

### 3.1 Tabellerna

Nya modeller i `models/planner_models.py`, utan ForeignKey (backendens
`CLAUDE.md`, Fällor):

```python
class PlannerFolder(db.Model):
    """En mapp i schemapanelen. Hör till en användare, inte till schemana.

    Scheman delas, men hur man ordnar dem är var och ens sak: mottagaren av
    v.35 ska inte få den flyttad för att ägaren lagt den i en mapp.
    """

    __tablename__ = "planner_folder"
    __table_args__ = (
        db.UniqueConstraint("user_id", "name", name="uq_planner_folder_user_name"),
    )

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = db.Column(db.String(36), nullable=False, index=True)
    name = db.Column(db.String(100), nullable=False)
    position = db.Column(db.Integer, nullable=False, default=0, server_default="0")
    collapsed = db.Column(db.Boolean, nullable=False, default=False, server_default="0")
    created_at = ...
    updated_at = ...


class PlannerFolderItem(db.Model):
    """Att ett schema ligger i en av användarens mappar.

    `user_id` upprepar mappens ägare med flit: unika-villkoret håller ett
    schema i högst en mapp per användare, och en delning som avslutas städas
    bort utan att mappen behöver slås upp.
    """

    __tablename__ = "planner_folder_item"
    __table_args__ = (
        db.UniqueConstraint("user_id", "archive_id", name="uq_planner_folder_item_user_archive"),
    )

    id = ...
    user_id = db.Column(db.String(36), nullable=False, index=True)
    folder_id = db.Column(db.String(36), nullable=False, index=True)
    archive_id = db.Column(db.String(36), nullable=False, index=True)
    created_at = ...
```

Båda importeras i `app.py` och `tests/conftest.py`. `migrations/env.py`
importerar redan hela `models.planner_models`.

### 3.2 Migrationen

`022_add_planner_folders.py`, `down_revision = '021_planner_archive_version'`
(nuvarande enda head). Den skapar bara nya tabeller och byggs som `018`:
`has_table`-vakt, eftersom `db.create_all()` kan ha hunnit skapa dem, samt
`mysql_charset='utf8mb4'` och `mysql_collate='utf8mb4_unicode_ci'`. Den rör
inga befintliga tabeller.

### 3.3 API

En ny fil, `api/planner_folder_routes.py`, med blueprinten
`planner_folder_api` registrerad på `/api/planner/folders` i `app.py`.
`planner_routes.py` växer redan för mycket (arkitektur F16), så bara
städningen i 3.4 hamnar där. Den nya filen importerar `_load_archive` och
`_has_access` därifrån. Beroendet går bara åt det hållet, så det blir ingen
cirkulär import.

Nyckelstilen är camelCase, som resten av Schema.

| Metod och väg | Gör | Svar |
|---|---|---|
| `GET /folders` | Användarens mappar, i ordning `position`, sedan namn | `[{ id, name, position, collapsed, archiveIds }]` |
| `POST /folders` `{ name }` | Ny mapp. Hamnar överst (`position` = minsta − 1) | 201 med mappen |
| `PATCH /folders/<id>` `{ name?, collapsed?, position? }` | Byt namn, fäll ihop eller ut, flytta | Mappen |
| `DELETE /folders/<id>` | Tar bort mappen och dess placeringar. Schemana ligger kvar | `{ message }` |
| `PUT /folders/placements` `{ archiveIds, folderId }` | Lägger schemana i mappen, eller tar ut dem med `folderId: null` | `{ archiveIds, folderId }` |

- `archiveIds` i `GET` tar bara med scheman som användaren fortfarande når
  (egna plus delade, samma två frågor som `get_planner_archives`). Gamla rader
  syns alltså aldrig, även om städningen i 3.4 skulle missa någon.
- **Ägarkontroll:** varje fråga mot `planner_folder` och `planner_folder_item`
  filtrerar på `user_id = current_user.id`. Någon annans mapp ger 404, inte
  403, som `_load_archive`.
- **Placeringar:** varje schema i `archiveIds` prövas med `_has_access`.
  Saknas tillgång till något av dem nekas hela anropet med 404 "Schemat finns
  inte", och ingenting skrivs. Annars går det att lägga in främmande id:n.
  Raden ersätts om schemat redan låg i en annan mapp, vilket görs som en
  upsert på (`user_id`, `archive_id`).
- **Gränser:** högst 50 mappar per användare, namn på högst 100 tecken och
  högst 200 id per placering. Felmeddelandena är på svenska:
  - "Ange ett namn för mappen"
  - "Namnet är för långt"
  - "Du har redan en mapp med det namnet" (409)
  - "Du har för många mappar"
  - "Mappen finns inte" (404)
- Alla routes har `@token_required` och `@retry_on_connection_error`.
- `GET /archives` och arkivets payload ändras inte. Placeringen ligger i
  mapparna (`archiveIds`), inte som `folderId` på varje schema. Annars skulle
  `_archive_payload` i alla arkivsvar (lås, sort, delning) behöva slå upp
  placeringar, och frontendens `upsertArchive` skulle bli en andra plats där
  placeringen kan bli inaktuell. Samma uppgift ska inte finnas på två
  ställen.

### 3.4 Städning i planner_routes.py

| Route | Tillägg i samma transaktion |
|---|---|
| `delete_shared_archive` | Tar bort alla `PlannerFolderItem` med `archive_id`, för alla användare |
| `remove_archive_share` | Tar bort `PlannerFolderItem` för (`target.id`, `archive_id`), både när mottagaren lämnar och när ägaren tar bort hen |

Ett hjälpanrop i modellfilen, `PlannerFolderItem.forget(archive_id,
user_id=None)`, används av båda.

### 3.5 Tester

`tests/test_planner_folders.py`, med `BLUEPRINTS = [(planner_api,
'/api/planner'), (planner_folder_api, '/api/planner/folders')]`:

- Skapa, lista, byta namn, fälla ihop och ta bort. Samma namn två gånger ger 409.
- Den 51:a mappen nekas.
- **bob** ser inte alices mappar och kan inte ändra eller ta bort dem (404).
- **bob** kan inte lägga alices odelade schema i sin mapp (404), och ingenting
  skrivs när ett av flera id är främmande.
- alice kan inte lägga sitt schema i bobs mapp (404).
- Delat schema: bob lägger v.35 i sin mapp, och alices `archiveIds` påverkas
  inte. Detsamma åt andra hållet.
- En flytt ändrar inte schemats `updated_at` eller `version`, och går igenom
  fast någon annan har låset.
- En mapp som tas bort lämnar schemana kvar i `GET /archives`.
- Ett schema som raderas försvinner ur alla användares mappar. Om bob lämnar
  eller tas bort ur en delning försvinner schemat ur bobs mapp men inte ur
  alices.
- Ett schema som görs om till basschema behåller sin placering.

### 3.6 Driftsättning: backend först

Bara nya tabeller, så ordningen mellan `alembic upgrade` och reload spelar
ingen roll. Backend ska ändå ut före frontend:

- Mot gammal backend svarar `GET /folders` 404. Frontend tolkar det som att
  mappar inte finns och visar panelen som i dag, utan knappen Ny mapp
  (avsnitt 4.2). Det blir inget fel, men funktionen syns inte förrän
  backend är ute.

Raden i `DEPLOY.md`:

> `022_planner_folders`: nya tabeller `planner_folder` och
> `planner_folder_item` (personliga mappar i schemapanelen). **Före
> frontend:** mot gammal backend visas inga mappar.

---

## 4. Frontend: data

### 4.1 Typerna

I `src/types/schedule.ts`:

```ts
export interface PlannerFolder {
  id: string;
  name: string;
  position: number;
  collapsed: boolean;
  /** Schemana i mappen. Bara de du når; ordningen avgör panelen. */
  archiveIds: string[];
}
```

`PlannerArchiveSummary` ändras inte.

### 4.2 plannerService

`listFolders(): Promise<PlannerFolder[] | null>` returnerar `null` vid 404,
vilket betyder att backend saknar mappar. Övriga fel kastas. Dessutom:

- `createFolder(name)`
- `updateFolder(id, patch)`
- `deleteFolder(id)`
- `moveArchives(archiveIds, folderId | null)`

Svaren packas upp som `unwrap` gör. `error` kastas när `success` är false.
Tester i `plannerService.test.ts`.

### 4.3 utils/scheduleFolders.ts (ny, med tester)

Ren logik, utan React:

- `groupWeekArchives(weekArchives, folders)` ger
  `{ folders: { folder, archives }[], loose }`.
  - Ordningen inom en mapp är densamma som i `weekArchives` (egna före delade,
    veckonummer).
  - Ett id i en mapp som inte finns bland veckoschemana hoppas över. Det
    gäller ett basschema eller ett schema som just lämnats.
- `panelOrder(baseArchives, groups, looseFirst)` ger listan i den ordning
  panelen visar den, utan scheman i hopfällda mappar. Tangentnavigeringen och
  `ArchiveCard.index` räknar på den (avsnitt 6).
- `folderOfArchive(folders, archiveId)` ger mappen, eller null.
- `withArchivesMoved(folders, archiveIds, folderId)` används för den
  optimistiska uppdateringen och för att rulla tillbaka.

### 4.4 hooks/useScheduleFolders.ts (ny)

Den egna hooken behövs eftersom `useArchiveManager.ts` redan är 755 rader
(arkitektur F17). Hooken:

- Hämtar mapparna vid montering, parallellt med arkivlistan. `supported` är
  false när svaret är `null`.
- Har `createFolder`, `renameFolder`, `toggleFolder`, `deleteFolder` och
  `moveArchives`. Alla uppdateras optimistiskt, och rullas tillbaka med en
  notis om anropet misslyckas.
- `toggleFolder` skickar med `keepalive` (`withKeepalive`), så att en
  hopfällning precis före stängning inte går förlorad.
- Tar emot `archives` från `useArchiveManager` men skriver aldrig i den.

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

- **Ny mapp:** knapp med `FolderPlus` vid rubriken Veckoscheman, som `+` vid
  Basscheman (`aria-label` och `title` "Ny mapp"). Knappen öppnar en liten
  namndialog. Den syns bara när `supported` är sant.
- **Mapprubriken** (`components/schedule/ArchiveFolder.tsx`, ny) är en knapp
  som fäller in och ut. Den har:
  - `ChevronRight` eller `ChevronDown`, och `aria-expanded`
  - mappikon, namn och antal scheman
  - `ActiveLamp` och, i Neo, "• öppet" när det öppna schemat ligger i en
    hopfälld mapp. Annars syns det inte vilket schema som är öppet
  - en ⋯-meny med Byt namn, Lägg till scheman… och Ta bort mapp
- En tom mapp visar "Tom mapp" när den är utfälld.
- En mapp som innehåller det öppna schemat fälls inte ut av sig själv. Det
  hade gjort det omöjligt att fälla ihop mappen man arbetar i.
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
Ägaren har då fortfarande fyra knappar och mottagaren tre:

- **Flytta till mapp ›** med varje mapp, en avdelare, Utan mapp och Ny mapp…
  Den nuvarande mappen är bockad.
- **Gör till basschema** eller **Gör till veckoschema**, flyttad från sin
  egen knapp.

Det ändrar ett beslut i `basscheman.md` (avsnitt 8.1). Se fråga 4 i avsnitt 13.

### 5.2 Flytta många på en gång

Att flytta v.35–v.42 en i taget är åtta menyer. Mappens ⋯-meny har därför
**Lägg till scheman…**: en dialog med kryssrutor för alla veckoscheman.
Lösa scheman står först, och de som redan ligger i en annan mapp står med
mappens namn i grått. Ett anrop, `moveArchives(ids, folderId)`. Dialogen
läggs i `dialogs/FolderDialogs.tsx` tillsammans med namndialogen och
bekräftelsen för Ta bort mapp:

> Ta bort mappen "HT26"? De 9 schemana i den tas inte bort. De hamnar under
> Veckoscheman.

### 5.3 Drag och släpp (steg 2)

Det går, men det är inte nödvändigt för att mapparna ska vara till nytta:

- Hela planeraren ligger i en `DndContext` (`useDragHandlers.ts`), och
  `handleDragEnd` stoppar alla drag i läsläge innan den tittar på vad som
  dras. Ett schemakort måste därför hanteras först, och `DayColumn` måste
  strunta i det.
- `KeyboardSensor` startar ett drag på Enter och mellanslag på elementet med
  lyssnarna. På kortet skulle det ta över Enter, som öppnar schemat. Draget
  behöver därför ett eget grepp (`GripVertical`) som syns vid hovring.
- `DragOverlay` behöver en tredje gren för ett schemakort.

Det tas därför som ett eget steg efter att menyerna fungerar.

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

- Dialogen får fältet **Mapp** (Utan mapp / mapparna), men bara när det finns
  mappar.
- Förvalet är:
  - **Duplicera:** originalets mapp
  - **Nytt veckoschema:** mappen där det öppna veckoschemat ligger, annars
    Utan mapp
  - **Nytt basschema:** fältet visas inte
- Schemat skapas först som i dag. Därefter lägger planeraren det i mappen med
  `moveArchives`. `handleCreateNewSchedule` returnerar därför det skapade
  schemat, eller null.
- Två anrop i stället för ett `folderId` på `POST /archives` innebär att
  `create_planner_archive` och `createScheduleFrom` lämnas orörda. Misslyckas
  flytten finns schemat ändå, löst, och användaren får en notis: "Schemat
  skapades men kunde inte läggas i mappen."

---

## 8. Ord

| Var | Text |
|---|---|
| Knapp vid Veckoscheman | Ny mapp |
| Namndialog | Ny mapp / Byt namn på mappen, fältet "Namn", knappen Skapa / Spara |
| Mappens meny | Byt namn · Lägg till scheman… · Ta bort mapp |
| Kortets meny | Flytta till mapp › · Gör till basschema / Gör till veckoschema |
| Undermenyn | (mapparna) · Utan mapp · Ny mapp… |
| Tom mapp | Tom mapp |
| Notis vid flytt | Flyttade "v.35" till HT26. / Flyttade 8 scheman till HT26. |
| Fel | Kunde inte flytta schemat. / Kunde inte spara mappen. |

---

## 9. Risker

- **Fel kort markerat med tangentbordet** om `panelOrder` och det som visas
  inte stämmer. Ordningen räknas därför fram på ett ställe (avsnitt 4.3) och
  testas, och både kortens `index` och navigeringen läser den.
- **Två flikar:** den senaste ändringen gäller. Mappar och hopfällning är
  ofarliga att skriva över, och nästa inläsning visar serverns läge. Ingen
  version behövs.
- **Ett schema som lämnas eller raderas i en annan flik** ligger kvar i
  mappens `archiveIds` tills sidan laddas om. `groupWeekArchives` hoppar över
  id:n som inte finns i arkivlistan.
- **Panelens bredd:** ⋯-menyn på kortet och mapprubrikens tre delar måste
  rymmas i Kronberg, som har bredare typsnitt. Provas med "Introvecka HT26".

---

## 10. Genomförande

1. **Backend-PR:** modellerna, migration `022`, `planner_folder_routes.py`,
   städningen i `planner_routes.py`, testerna och raden i `DEPLOY.md`.
   Ut i produktion: `git pull`, `python -m alembic upgrade head`, Reload.
2. **Frontend-PR:** typerna, `plannerService`, `utils/scheduleFolders.ts` med
   tester, `useScheduleFolders`, `ScheduleArchiveList`, `ArchiveFolder`,
   `FolderDialogs`, ⋯-menyn på kortet, `panelOrder` till tangentnavigeringen
   och fältet Mapp i Nytt schema-dialogen. Raden i `docs/plans/README.md`
   uppdateras.
3. **Senare, om det behövs:** drag och släpp (avsnitt 5.3) och ordning på
   mapparna med Flytta upp och Flytta ned i mappens meny. `position` finns
   redan från steg 1, så det kräver ingen ny migration.

---

## 11. Klart när

- En mapp går att skapa, byta namn på, fälla in och ut och ta bort, och
  hopfällt läge är detsamma efter omladdning och på en annan dator.
- Ett schema flyttas med kortets meny, och flera med Lägg till scheman….
- Hos en kollega som har samma schema delat ändras ingenting.
- Duplicera lägger kopian i originalets mapp.
- Pilarna i panelen hoppar över hopfällda mappar, och Enter öppnar det kort
  som syns markerat.
- Det syns på mapprubriken att det öppna schemat ligger i en hopfälld mapp.
- Mot en backend utan mappar ser panelen ut som i dag.
- `pnpm exec tsc --noEmit`, `pnpm lint`, `pnpm test` och `pnpm build` går
  igenom, och `python -m pytest -q` och `python -m alembic heads` (en head) i
  backend.
- Provat i Neo och Kronberg.

---

## 12. Utanför planen

- Mappar för basscheman.
- Mappar i mappar.
- Gemensamma mappar för arbetslaget.
- Att terminsplaneraren, den publika länken och Utgå från grupperar sina
  listor per mapp.
- Automatiska mappar, som "Passerade veckor" eller en mapp per termin.
- Sorteringen av "v.40 (kopia)". `sortArchives` känner bara igen exakt
  "v.40", vilket hör till arkitektur F18 (två regex för veckonummer).

---

## 13. Öppna frågor

1. **Lösa scheman över eller under mapparna?** Förslag: över. Nya scheman är
   lösa tills de flyttas, och det är de man arbetar med. Mappar först, som i
   en filhanterare, går lika lätt att bygga.
2. **Hopfällt läge på servern eller per dator?** Förslag: servern (kolumnen
   `collapsed`). Per dator (localStorage) sparar en kolumn men gör att
   panelen ser olika ut i skolan och hemma.
3. **Drag och släpp redan i första omgången?** Förslag: nej, se avsnitt 5.3.
4. **Byt sort in i ⋯-menyn på kortet?** Förslag: ja, annars blir kortet för
   trångt (avsnitt 5.1). Alternativet är en femte ikonknapp.
