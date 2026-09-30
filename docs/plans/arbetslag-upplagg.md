# Plan: Sparade upplägg i Arbetslag

Status: beslutad, inte påbörjad. Skriven 2026-09-30 för nästa session och
uppdaterad samma dag efter granskning (sparning vid sidbyte, importen,
klientens id vid skapande).

Arbetslag (`/features/arbetslag`, detaljplan på `/features/arbetslag/detalj`)
sparar i dag allt i webbläsarens localStorage (`lessonLab.state.v1`). Sidan
har en egen post i menyn (Ctrl+Shift+4), och de gamla adresserna under
`/features/termin/labb` skickas vidare. Den här
planen flyttar lagringen till backend och lägger till en högerpanel, "Sparade
upplägg", i den enkla vyn. Panelen ser ut och beter sig som "Sparade veckor" i
schemaplaneraren.

Ordningen är:

1. backend (`Saibot57/drive_c_backend`),
2. deploy till PythonAnywhere (manuell, görs av Tobias),
3. frontend (`Saibot57/drive_c_frontend`).

Frontend kan byggas och testas mot mockade svar innan deployen är klar, men
ska inte mergas förrän backend är ute. Annars får Arbetslag-sidan 404 på
`/api/arbetslag` i produktion.

---

## 1. Beslut

| # | Fråga | Beslut |
|---|---|---|
| 1 | Namn | **Upplägg**. Panelen heter "Sparade upplägg", knappen "Nytt upplägg". |
| 2 | Vad ett upplägg innehåller | Hela `LabState`: lärare med dagar, arbetslag, mallens lektioner, `archiveId`, områden och veckor. Varje upplägg är fristående. Varianter prövas genom att duplicera. |
| 3 | Sparning | Det öppna upplägget autosparas till servern efter 800 ms utan ändringar, som i terminsplaneraren, och visar "Sparat"/"Sparar…". localStorage minns bara vilket upplägg som var öppet senast. |
| 4 | Delning | **Ingen delning nu.** Upplägg är privata per användare, som terminer. Delning och lås kan komma senare. |
| 5 | Samtidighet | Optimistisk: servern har ett versionsnummer. En sparning med gammal version får 409, och sidan visar "Upplägget har ändrats någon annanstans. Ladda om?". |
| 6 | Panelen | Hopfällbar högerpanel i den enkla vyn, som "Sparade veckor". Varje rad visar namn, "aktiv" och senast ändrad. Detaljplanen visar bara det aktiva uppläggets namn i verktygsraden. |
| 7 | Gränser | Högst 50 upplägg per användare. Högst 512 kB JSON per upplägg. |
| 8 | Fil | "Spara fil" och "Öppna fil" finns kvar i detaljplanen. "Öppna fil" skapar ett **nytt** upplägg i stället för att skriva över det öppna. |
| 9 | Gammal data | Ett befintligt `lessonLab.state.v1` i localStorage importeras automatiskt som ett upplägg, en gång per webbläsare, även om det redan finns upplägg på servern (se 4.3). |
| 10 | Detaljplanen | Behålls genom det här arbetet. Den är enda stället för lärarhantering, lektionstider, områden, veckor och fil. Se avsnitt 6. |

Utanför planen: delning, lås, versionshistorik på servern, att skriva något
till schemaplaneraren eller terminsplaneraren.

---

## 2. Backend (drive_c_backend)

Förebilden är terminsplaneraren: `models/term_models.py`,
`api/term_routes.py`, `migrations/versions/016_add_planner_term.py` och
`tests/test_planner_term.py`. Följ samma stil i docstrings, felhantering och
svenska felmeddelanden.

### 2.1 Modell: `models/arbetslag_models.py`

```python
class ArbetslagPlan(db.Model):
    __tablename__ = 'arbetslag_plan'
    __table_args__ = (
        {'mysql_charset': 'utf8mb4', 'mysql_collate': 'utf8mb4_unicode_ci'},
    )

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = db.Column(db.String(36), nullable=False, index=True)   # ingen ForeignKey, se term_models
    name = db.Column(db.String(150), nullable=False)
    # Hela LabState som JSON. Servern kontrollerar bara form och storlek;
    # klienten tvättar innehållet med parseLabState.
    state = db.Column(db.Text().with_variant(mysql.MEDIUMTEXT(), 'mysql'), nullable=False)
    version = db.Column(db.Integer, nullable=False, default=1)
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)
```

- `Text` i MySQL rymmer bara 64 kB, vilket är för lite för 512 kB. Därför
  MEDIUMTEXT via `with_variant` (`from sqlalchemy.dialects import mysql`).
  Samma uttryck används i migrationen, så att modell och tabell alltid är
  lika. SQLite i testerna får vanlig `Text`.
- `to_summary()` returnerar `{id, name, version, createdAt, updatedAt}` utan
  state.
- `to_dict()` returnerar summary plus `state` (parsad JSON, `{}` om den är
  trasig).
- Lägg till importen i `tests/conftest.py` bredvid `PlannerTerm`.
- Kontrollera om `app.py` eller `models/__init__.py` importerar modellerna
  explicit för `db.create_all()`. Gör i så fall likadant för den nya modellen.

### 2.2 Migration: `migrations/versions/017_add_arbetslag_plan.py`

- `revision = '017_arbetslag_plan'`, `down_revision = '016_planner_term'`.
- Samma `inspector.has_table`-vakt som i 016, eftersom `app.py` kör
  `db.create_all()` vid boot.
- Kolumnerna som i modellen: `state` som
  `sa.Text().with_variant(mysql.MEDIUMTEXT(), 'mysql')`, så att migrationen
  inte faller om den någon gång körs mot SQLite, och `version` som
  `sa.Integer()` med `server_default='1'`. Tidsstämplar som i 016.
- Index `ix_arbetslag_plan_user_id` på `user_id`.
- `downgrade` tar bort index och tabell bakom samma vakt.
- Kontrollera att `alembic heads` bara ger ett huvud efter ändringen.

### 2.3 API: `api/arbetslag_routes.py`

Blueprint `arbetslag_api`, registrerad i `app.py` bredvid `term_api`:

```python
app.register_blueprint(arbetslag_api, url_prefix='/api/arbetslag')
```

Alla routes har `@token_required` och `@retry_on_connection_error`, filtrerar
på `current_user.id` och svarar med `success_response`/`error_response`.
Använd samma `PayloadError`-mönster som i `term_routes.py` (kopiera klassen
och `_text`, eller flytta dem till en gemensam modul om det blir rent, men
rör inte term_routes beteende).

| Metod | Sökväg | Body | Svar |
|---|---|---|---|
| GET | `/api/arbetslag` | – | 200, lista med summaries sorterade på `updated_at` fallande |
| POST | `/api/arbetslag` | `{id?, name, state}` | 201, hela upplägget (`version: 1`), eller 200 om id:t redan finns (se nedan) |
| GET | `/api/arbetslag/<id>` | – | 200, hela upplägget, eller 404 |
| PUT | `/api/arbetslag/<id>` | `{version, name?, state?}` | 200, hela upplägget med `version + 1`, 404, eller 409 |
| DELETE | `/api/arbetslag/<id>` | – | 200 `{id}`, eller 404 |

Duplicering görs i klienten: hämta, sedan POST med nytt namn. Det behövs
ingen egen route.

**Validering (`_parse_state`)**

- `state` måste vara ett objekt (`dict`) med `state['version'] == 1`, och
  `teachers`, `teams`, `template` och `weeks` måste vara listor. Annars 400
  "Upplägget har fel format".
- Serialisera med `json.dumps(state, ensure_ascii=False, separators=(',', ':'))`.
  Är resultatet över `MAX_STATE_BYTES = 512 * 1024` byte (UTF-8) blir det 400
  "Upplägget är för stort (högst 512 kB)".
- Ingen djupvalidering. Klientens `parseLabState` tvättar allt som läses in.
- `name` valideras med `_text(..., 'Namn', 150)`.
- POST ger 400 "Du kan ha högst 50 upplägg" när användaren redan har
  `MAX_PLANS_PER_USER = 50`.

**POST med klientens id (idempotent)**

Klienten får skicka med ett eget `id` (uuid, kontrolleras med samma
`ID_PATTERN` som i term_routes). Det gör att samma skapande kan skickas två
gånger utan att det blir två upplägg:

- Finns inget upplägg med id:t: skapa som vanligt, 201.
- Finns det redan för samma användare: svara 200 med det befintliga
  upplägget, utan att ändra något och utan att räkna mot gränsen.
- Finns id:t hos en annan användare: 409 "Id:t är upptaget". Det ska inte
  hända med uuid, men ingen annans upplägg får läcka eller skrivas över.
- Utan `id` skapar servern ett, som i dag.

Kontrollen av id:t görs före kontrollen av gränsen på 50. Det täcker dubbla
effekter i React strict mode, två flikar som öppnas samtidigt, och en POST
som lyckades men vars svar försvann på vägen.

**PUT och versionen**

- `version` måste vara ett heltal. Annars 400.
- Minst ett av `name` och `state` måste finnas. Annars 400.
- Om `version != plan.version`: svara
  `error_response("Upplägget har ändrats någon annanstans", 409, data={'version': plan.version, 'updatedAt': ...})`.
  Skriv ingenting.
- Annars: uppdatera fälten, `plan.version += 1`, sätt `updated_at` explicit
  (som i term_routes) och committa.
- En atomisk variant är
  `UPDATE ... WHERE id=? AND user_id=? AND version=?` och en kontroll av
  `rowcount`. Den stänger fönstret mellan läsning och skrivning. Använd den om
  det blir enkelt, annars räcker läs-jämför-skriv, eftersom upplägg inte delas.

**Storlek på själva anropet**

Kontrollera om `MAX_CONTENT_LENGTH` är satt i `app.py` eller `config/`. Den
fanns inte i förra sessionens sökning. Är den satt lägre än cirka 1 MB måste
den höjas, annars stoppar Flask stora upplägg med 413 innan valideringen körs.

### 2.4 Tester: `tests/test_arbetslag.py`

`BLUEPRINTS = [(arbetslag_api, '/api/arbetslag')]`, fixturerna `client`,
`alice` och `bob`, och `auth`/`data` från `tests/helpers.py`. Ett litet
`state_payload()` med `version: 1`, en lärare, ett lag, en lektion och tomma
`weeks`.

Testfall:

1. Skapa och läs: namnet och state kommer tillbaka lika, och `version == 1`.
2. Listan innehåller bara egna upplägg, har inget `state`-fält och ändrade
   upplägg ligger först.
3. Bob får 404 på GET, PUT och DELETE av Alices upplägg.
4. PUT med rätt version ger `version == 2` och nytt innehåll. PUT med bara
   `name` lämnar state orört.
5. PUT med gammal version ger 409 med `data.version` satt till den aktuella
   versionen, och innehållet är oförändrat.
6. Fel form ger 400: `state` som lista, `version: 2`, `teachers` som saknas,
   tomt namn, `version` som sträng eller bool i PUT.
7. State över 512 kB ger 400. Bygg t.ex. en lärare med ett långt namn eller
   många lektioner.
8. Upplägg nummer 51 ger 400.
9. DELETE tar bort upplägget, och GET ger 404 efteråt.
10. Anrop utan token ger 401.
11. POST med eget `id` två gånger ger 201 och sedan 200 med samma upplägg,
    och listan har ett upplägg. Den andra POST:en med annat namn ändrar
    ingenting.
12. POST med ett `id` som Alice redan har, skickad av Bob, ger 409 och
    avslöjar inget om Alices upplägg. Ogiltigt `id` ger 400.
13. POST med ett befintligt `id` när användaren har 50 upplägg ger 200,
    inte 400.

Kör `python -m pytest tests/test_arbetslag.py` och sedan hela sviten
`python -m pytest`.

### 2.5 Backend-PR

- Gren enligt sessionens instruktioner. Beskriv tabellen, migrationen och
  endpoints i PR:en.
- Lägg in deploy-stegen i PR-beskrivningen så att de är lätta att följa.

---

## 3. Deploy (manuell, Tobias)

Enligt `DEPLOY.md` i backend, efter att backend-PR:en är mergad:

```bash
cd ~/drive_catalog
git pull
python -m alembic upgrade head
```

Tryck sedan på **Reload** under fliken Web på PythonAnywhere.

Kontrollera efteråt:

- `python -m alembic current` ska visa `017_arbetslag_plan`.
- `GET https://tobiaslundh1.pythonanywhere.com/api/arbetslag` med inloggning
  ska svara `{"success": true, "data": []}`. Enklast är att öppna
  Arbetslag-sidan efter att frontend är ute och titta i nätverksfliken.

Frontend deployas av Vercel när dess PR mergas till main. Därför mergas
backend först.

---

## 4. Frontend (drive_c_frontend)

### 4.1 Typer: `src/types/lessonLab.ts`

```ts
export type LabPlanSummary = {
  id: string;
  name: string;
  version: number;
  createdAt: string | null;
  updatedAt: string | null;
};

export type LabPlan = LabPlanSummary & { state: LabState };
```

### 4.2 Tjänst: `src/services/arbetslagService.ts`

Samma mönster som `src/services/termService.ts`: `fetchWithAuth`, `API_URL`
och en `readData` som kastar `payload.error`.

- `listPlans(): Promise<LabPlanSummary[]>`
- `getPlan(id): Promise<LabPlan>`. Kör `state` genom `parseLabState`. Om den
  ger `null` används `LAB_SEED` och en varning loggas.
- `createPlan({ id?, name, state }): Promise<LabPlan>`. Klienten skickar
  alltid med ett eget uuid, så att ett omsänt skapande inte blir ett till
  upplägg (se 2.3).
- `savePlan(id, { version, name?, state? }): Promise<LabPlan>`
- `deletePlan(id): Promise<void>`

En 409 ska gå att känna igen. Exportera
`class PlanConflictError extends Error { constructor(public currentVersion: number) }`
och kasta den när `response.status === 409`, innan `readData`.

### 4.3 Lagring och sparning

Två delar:

- `src/utils/labPlanStore.ts`: en modul utan React som äger sparkön. Den
  lever på modulnivå, så att den överlever sidbyten inom appen.
- `src/hooks/useLessonLabState.ts`: hooken som vyerna redan använder, nu
  ovanpå kön.

Logiken som går att testa utan React (kön, unika namn, importvillkoret,
sortering) ligger i `src/utils/labPlans.ts` eller i storen.

#### Varför kön ligger på modulnivå

Den enkla vyn och detaljplanen länkar till varandra med `next/link`, och
menyn byter sida med `router.push`. Inget av det laddar om sidan, så
`beforeunload` körs aldrig. Den som ändrar något och klickar vidare inom
800 ms skulle förlora ändringen om sparningen bara låg i hooken.

Det räcker inte heller att spara när den gamla sidan avmonteras. Den nya
sidans GET kan komma fram före den gamla sidans PUT och få en gammal version,
och nästa sparning ger då 409 mot användaren själv.

Därför ligger kön, med senaste läget och versionen, i modulen. Samma kö
används av sidan som lämnas och sidan som öppnas.

#### Storen: `labPlanStore`

Per upplägg-id håller storen:

- `version`: senast kända version från servern,
- `pending`: senaste läget som inte är skickat, eller `null`,
- `pendingName`: nytt namn som inte är skickat, eller `null`,
- `inFlight`: löftet för anropet som pågår, eller `null`,
- `timer`: debounce-timern,
- `conflict`: satt efter en 409, stoppar kön.

Funktioner:

- `schedule(id, state)`: sätter `pending` och startar om timern (800 ms).
- `rename(id, name)`: sätter `pendingName` och skickar direkt (ingen
  debounce), genom samma kö.
- `flush(id): Promise<void>`: stoppar timern och skickar det som väntar.
  Löftet är klart först när kön är tom.
- `settled(id): Promise<void>`: väntar in `inFlight` och en eventuell flush.
  Används av den som ska läsa upplägget.
- `subscribe(id, listener)`: meddelar status (`'saved' | 'pending' |
  'saving' | 'error' | 'conflict'`) och nya `updatedAt`/`version` till
  hooken som visar dem.

Regler:

- **En sparning i taget.** Servern räknar upp versionen, så två anrop i
  flykt ger 409 mot oss själva. När ett anrop blir klart och något nytt
  väntar skickas det direkt med den nya versionen.
- Ett lyckat svar uppdaterar `version`.
- Vid `PlanConflictError`: `conflict` sätts, status blir `'conflict'` och
  inget mer skickas förrän upplägget läses om.
- Vid andra fel: status `'error'`. `pending` ligger kvar. Nästa ändring
  eller "Försök igen" skickar igen.

#### Hooken: `useLessonLabState`

Behåll signaturen som vyerna redan använder:
`{ state, loaded, commit, undo, redo, canUndo, canRedo }`. Lägg till:

```ts
plans: LabPlanSummary[];
activePlan: LabPlanSummary | null;
saveStatus: 'saved' | 'pending' | 'saving' | 'error' | 'conflict';
loadError: string | null;
openPlan(id: string): Promise<void>;
createPlan(name?: string, state?: LabState): Promise<void>;   // standard: LAB_SEED
duplicatePlan(id: string): Promise<void>;
renamePlan(id: string, name: string): Promise<void>;
deletePlan(id: string): Promise<void>;
reloadActive(): Promise<void>;                                // efter 409
retrySave(): void;                                            // efter fel
```

`readStored` och `writeStored` finns kvar och exporteras som i dag. De
används för vy-nycklar och annat.

**Uppstart**

1. `listPlans()`, med samma `withRetry` som `useLabArchive` (700 ms,
   2000 ms). Flytta `withRetry` till `src/utils/` så att båda hookarna delar
   den.
2. Importen av gammal data, se nedan.
3. Om listan fortfarande är tom: skapa "Mitt upplägg" från `LAB_SEED`.
4. Välj upplägget med id i `lessonLab.activePlan.v1` om det finns i listan,
   annars det senast ändrade.
5. **Vänta in `labPlanStore.settled(id)`** och hämta sedan upplägget med
   `getPlan`. Då kommer en sparning från sidan man just lämnade alltid före
   hämtningen.
6. `history = initialUndoState(plan.state)`. `loaded` blir `true` först nu.
7. Om hämtningen misslyckas: `loadError` sätts, och vyerna visar ett fel med
   "Försök igen". Visa inte `LAB_SEED` som om den vore sparad.

**Importen av gammal data**

Villkor: localStorage har ingen markering `lessonLab.state.v1.migrated`,
och `parseLabState` på `lessonLab.state.v1` ger något. Använd
`parseLabState`, inte `sanitizeLabState`: den senare faller tillbaka på
`LAB_SEED` och misslyckas därför aldrig.

Villkoret gäller oavsett om servern redan har upplägg. Har Tobias gammal
data i två webbläsare, till exempel på jobbet och hemma, importeras båda.

- Ett läge som är lika med `LAB_SEED` (jämför med `JSON.stringify` efter
  `parseLabState` på båda) importeras inte. Markeringen sätts ändå.
- Namn: "Mitt upplägg" om namnet är ledigt, annars "Mitt upplägg (importerat
  30 sep)" via samma hjälpare för unika namn som panelen använder.
- Id: skapa ett uuid och skriv det i
  `lessonLab.state.v1.importId` **före** POST. Skicka det som `id`. Ett
  omförsök, en andra flik eller en dubbel effekt skickar då samma id, och
  servern svarar med det befintliga upplägget (se 2.3).
- När POST är klar: skriv `lessonLab.state.v1.migrated = <id>` och öppna det
  importerade upplägget.
- Importen körs genom ett löfte på modulnivå, så att två samtidiga
  uppstarter i samma flik (strict mode i dev) delar samma anrop.
- Den gamla nyckeln `lessonLab.state.v1` tas **inte** bort i den här PR:en.
  Den är reservkopian.
- Är användaren redan uppe i 50 upplägg misslyckas importen med serverns
  meddelande. Markeringen sätts inte, så importen görs nästa gång.

**Sparning från hooken**

- En effekt på `history.present` anropar `labPlanStore.schedule(activeId,
  present)`. Den hoppar över renderingen direkt efter att ett upplägg
  laddats.
- `renamePlan` går genom `labPlanStore.rename`, så att versionen hålls i
  takt med autosparningen.
- **Vid unmount är `flush` obligatorisk.** Hooken anropar
  `labPlanStore.flush(activeId)` i effektens städfunktion. Läget finns
  redan i storen, så inget React-state behövs efter unmount.
- `pagehide` och `visibilitychange` (hidden) anropar också `flush`. En
  vanlig `fetch` kan avbrytas när sidan stängs, och `keepalive` hjälper inte
  eftersom den bara tar 64 kB medan ett upplägg får vara 512 kB. Därför
  finns `beforeunload`-varningen kvar när status inte är `'saved'`, som i
  terminsplaneraren. Den täcker omladdning och stängning.
- När sparningen lyckas: uppdatera `updatedAt` och `version` för raden i
  `plans` och sortera om listan.

**Byte av upplägg**

`openPlan`, `createPlan`, `duplicatePlan`, eller `deletePlan` av det aktiva:

1. `await labPlanStore.flush(activeId)`.
2. Hämta eller skapa det nya upplägget. Nya upplägg skapas med ett eget
   uuid.
3. `history = initialUndoState(plan.state)`, så att historiken nollställs.
4. Skriv `lessonLab.activePlan.v1`.

`deletePlan` av det aktiva öppnar det senast ändrade av de andra, eller
skapar ett nytt från `LAB_SEED` om inget finns kvar. Storen glömmer id:t.

**409**

`reloadActive` rensar `conflict` och `pending` för id:t, hämtar om
upplägget och nollställer historiken. Samma upplägg i två webbläsarflikar
ger 409 i den som sparar sist. Det är avsett.

### 4.4 Panel: `src/components/lesson-lab/LabPlansPanel.tsx`

Förebild: sidopanelen "Sparade Veckor" i
`src/components/schedule/NewSchedulePlanner.tsx` (kring rad 1990–2010) och
`src/components/schedule/ArchiveCard.tsx`.

- Placering: till höger i `LessonLab.tsx`. Schemat och arbetslagen ligger
  till vänster (`flex-1 min-w-0`), panelen `w-[320px]` när den är öppen och
  `w-[72px]` när den är hopfälld. Klassen är `sp-card`. Under `lg` hamnar
  panelen under innehållet i full bredd.
- Huvud: ikon (t.ex. `FolderOpen` eller `Layers` från lucide), "Sparade
  upplägg" och chevron-knapp för att fälla ihop. Läget minns i
  `lessonLab.plansPanel.v1` via `writeStored`.
- Knappen **"Nytt upplägg"** skapar ett från `LAB_SEED` med namnet "Nytt
  upplägg" (eller "Nytt upplägg 2" osv. om namnet är upptaget) och öppnar
  det.
- En rad per upplägg, sorterade på senast ändrad:
  - Namnet. Aktiv rad har svart bakgrund eller amber-markering och etiketten
    "aktiv".
  - "Ändrad 14:32" om det är i dag, annars "Ändrad 28 sep" (`sv-SE`).
  - Åtgärder via ikonknappar eller en liten meny: **Byt namn** (inline
    `CommitInput` från `LabInputs.tsx`), **Duplicera** (namn: "<namn>
    (kopia)"), **Ta bort** med inline-bekräftelse på raden ("Ta bort? Ja /
    Nej"), inget `window.confirm`.
  - Klick på raden öppnar upplägget.
- Vid 50 upplägg är "Nytt upplägg" och "Duplicera" avstängda, med förklaring
  i `title`.
- Hopfälld: bara ikonen och antalet.
- Sparstatus visas i vyns verktygsrad, inte i panelen, med samma ikoner och
  texter som terminsplaneraren ("Sparat", "Ändrat", "Sparar…", "Ej sparat").
  Vid `'conflict'` visas en `sp-toast`: "Upplägget har ändrats någon
  annanstans. Ladda om?" med knappen **Ladda om**.

### 4.5 Detaljplanen: `src/components/lesson-lab/LessonLabDetail.tsx`

- Verktygsraden visar det aktiva upplägget: "Upplägg: <namn>" och
  sparstatus.
- Byt texten "Sparas bara i den här webbläsaren." mot "Sparas automatiskt."
- **"Öppna fil"**: `parseLabState` på filen, sedan
  `createPlan(<filnamn utan .json>, parsed)`. Den enkla vyn och detaljplanen
  byter då till det nya upplägget. Notisen blir "Läste in <fil> som ett nytt
  upplägg." Ångra-texten försvinner, eftersom historiken nollställs vid byte.
- **"Spara fil"**: som i dag, men filnamnet blir
  `arbetslag-${toFileSlug(namn, 'arbetslag')}-${datum}.json`. `toFileSlug` i
  `src/utils/download.ts` behåller åäö med avsikt, så "Höstens upplägg" blir
  `Höstens-upplägg`.
- **"Tavlan"** (återställ till `LAB_SEED`) skriver fortfarande över det
  öppna upplägget och går att ångra. Det är oförändrat.
- Uppdatera docstringen överst (den säger att allt sparas i webbläsaren) och
  sidans beskrivning.

### 4.6 Den enkla vyn: `src/components/lesson-lab/LessonLab.tsx`

- Lägg in panelen till höger enligt 4.4.
- Visa sparstatus i verktygsraden.
- Uppdatera docstringen.
- Visa laddning och fel från hooken (`loaded`, `loadError`), så att schemat
  inte blinkar med `LAB_SEED` innan upplägget har hämtats.

### 4.7 Tester (vitest)

- `src/utils/labPlans.test.ts`:
  - Kön: två snabba ändringar ger ett anrop, en ändring under ett pågående
    anrop ger exakt ett anrop till efteråt med den nya versionen, och en
    konflikt stoppar kön.
  - Unika namn: "Nytt upplägg", "Nytt upplägg 2" osv., och "Mitt upplägg
    (importerat 30 sep)" när "Mitt upplägg" är upptaget.
  - Filnamnet vid export, med åäö kvar.
  - Sorteringen.
- `src/utils/labPlanStore.test.ts` med falska timers och en mockad tjänst:
  - `flush` skickar direkt det som väntar, och `settled` blir klart först
    när PUT är klar. Det är fallet där man byter sida inom 800 ms.
  - En ändring under ett pågående anrop skickas efteråt med versionen från
    svaret, aldrig parallellt.
  - `rename` under en väntande autosparning ger två anrop i följd med rätt
    versioner.
  - Efter 409 skickas inget mer förrän upplägget läses om.
- `src/services/arbetslagService.test.ts` (om det finns ett mönster för att
  mocka `fetchWithAuth`, se befintliga service-tester): 409 ger
  `PlanConflictError`, och trasigt `state` ger `LAB_SEED`.
- Importen från localStorage:
  - Gammalt läge och ingen markering ger ett `createPlan` med rätt state,
    även när servern redan har upplägg (den andra webbläsaren).
  - Finns markeringen `migrated` blir det ingen import.
  - Ett läge som inte går igenom `parseLabState`, eller som är lika med
    `LAB_SEED`, ger ingen import.
  - `importId` skrivs före anropet, och två samtidiga uppstarter ger ett
    anrop med samma id.

### 4.8 Verifiering före push

```bash
npx tsc --noEmit
npm run lint
npx vitest run
npm run build
```

Kör sedan en Playwright-kontroll mot `next start`. Chromium finns på
`/opt/pw-browsers`. Kör inte `playwright install`. Mocka `/api/arbetslag*`
och `/api/planner/*` med `page.route` och kontrollera:

1. Första besöket med gammalt `lessonLab.state.v1` skapar "Mitt upplägg" med
   samma lärare, och bara ett. Kör kontrollen även mot `next dev`, där
   effekterna körs två gånger.
2. En ändring ger en PUT efter drygt 800 ms, och statusen går från "Sparar…"
   till "Sparat".
3. "Nytt upplägg", "Duplicera", "Byt namn" och "Ta bort" (med bekräftelse)
   fungerar, och rätt rad är aktiv.
4. En PUT som får 409 visar "Ladda om?", och "Ladda om" hämtar det nya
   läget.
5. "Öppna fil" i detaljplanen skapar ett nytt upplägg.
6. Panelen går att fälla ihop och ligger under innehållet i mobilbredd.
7. En ändring i den enkla vyn följd av klick på dörren till detaljplanen inom
   800 ms: PUT går iväg före GET, detaljplanen visar ändringen och nästa
   sparning ger ingen 409. Samma sak via menyn.

Ta skärmdumpar av den enkla vyn med panelen öppen och hopfälld och visa dem
för Tobias.

Döda servern med `kill $(lsof -t -i:PORT)`, inte `pkill -f "next start"`,
som dödar skalet i den här miljön.

---

## 5. Leverans

1. Backend-PR: modell, migration 017, routes, registrering i `app.py` och
   tester.
2. Tobias mergar och deployar enligt avsnitt 3.
3. Frontend-PR: tjänst, hook, panel, detaljplan och tester. Beskrivningen ska
   nämna att den kräver backend-PR:en och migration 017.
4. Tobias mergar frontend. Vercel deployar.

Tobias mergar själv. Merge via verktyget nekas ("Merge Without Review").

## 6. Senare (inte nu)

- Ta bort detaljplanen. Först måste det som bara finns där flyttas in i den
  enkla vyn, i den mån det används:
  - lärare: lägga till, byta namn, ta bort, markera som resurs, hämta namn
    från schemaplaneraren (i dag `LabSidebar`),
  - lektioner: lägga till, ta bort, ändra tid och titel (i dag `LabBoard`),
  - fil ut och in, lämpligen i upplägg-panelens meny.

  Veckor, områden och mål, lärare per klass, varningslistan och
  översiktstabellerna försvinner då. Deras fält i `LabState` kan ligga kvar i
  sparad data utan att störa.

- Delning av upplägg med kollegor (läsrätt eller skrivrätt), och lås som för
  arkiven (`PlannerArchive` har lås-kolumner att titta på).
- Ta bort den gamla nyckeln `lessonLab.state.v1` när importen har fungerat
  ett tag.
- Koppla ett upplägg till en termin i terminsplaneraren.
