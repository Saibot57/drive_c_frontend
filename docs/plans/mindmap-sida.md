# Mindmap-sida: en MindMup-kopia med sparade kartor

Status: Pågår

Planen är skriven 2026-11-10 efter en intervju med Tobias (besluten i
avsnitt 1). Den är tänkt att följas steg för steg av agenter: varje steg är
en PR per repo, lämnar appen hel och bockas av här av den session som gör
det. Läs `CLAUDE.md` i båda repona först, sedan bara det steg du ska göra.

## Mål

En egen sida, `/features/mindmap`, där man skriver tankekartor i MindMups
anda: tangentbordet först, automatisk layout, zoom och panorering på en
stor yta, anteckningar, länkar, bilder och ikoner på noderna, fri placering
av enskilda noder, tvärlänkar mellan grenar, import av `.mup`, export som
PNG, PDF, Markdown och disposition, och ett presentationsläge för
projektorn. Kartorna sparas per användare i backend med version och 409,
som Arbetslags upplägg. Sidan följer båda temana (Neo och Kronberg) genom
tokens.

**Målet är nått när** alla steg 0–8 nedan är avbockade, regressionslistan i
avsnitt 8 är gången igenom efter det sista steget, och Tobias har skrivit
en karta på 50+ noder utan att ta i musen annat än för att zooma.

Workspace-kortet för mindmap finns kvar som det är. Det är en snabb skiss
på en yta; sidan är verktyget för hela kartor.

## Skyddsregler

Det centrala kravet är att **inget i bygget får störa befintlig
funktionalitet**. Reglerna nedan gäller varje steg. Bryts en regel ska det
stå som "Avvikelse" under steget med skälet, och PR:en ska säga det.

1. **Workspace-kortet ändrar inte beteende.** Dess filer rörs bara i steg 0,
   och då bara som vidareexporter (avsnitt 5, steg 0). Kortets tester
   flyttar med oförändrade påståenden. Efter varje steg: öppna Workspace,
   skapa ett mindmap-kort, skriv med Tab och Enter, byt färg, exportera som
   punktlista. Det ska se ut och fungera som förut.
2. **Befintliga filer som får röras utanför den nya featuren**, och bara så
   här:
   - `src/components/FeatureNavigation.tsx`: en rad i `features`.
   - `src/config/shortcuts.ts`: en rad för genvägen och en grupp för
     kartans kortkommandon.
   - backend `app.py`: en import och en `register_blueprint`.
   - backend `tests/conftest.py` och `migrations/env.py`: en import var.
   - backend `DEPLOY.md`: en rad i historiken.
   - `docs/plans/README.md`, den här planen, backendens
     `docs/granskning-status.md` om ett fynd råkar åtgärdas.
   Allt annat befintligt lämnas. Ingen "passa på"-refaktorering i de här
   PR:arna, hur lockande den än är.
3. **Inga nya beroenden**, varken npm eller pip. Zoom och panorering byggs
   med CSS-`transform`; PDF med `jspdf` som redan finns; bilden med Canvas
   som i kortet.
4. **Bara nya tabeller i backend.** Ingen kolumn på en befintlig tabell.
   Migrationen har `has_table`-vakt som `023`.
5. **Nya adresser.** Sidan ligger på `/features/mindmap`, API:t på
   `/api/mindmap`, localStorage-nyckeln är `mindmap.lastOpen.v1`. Inget
   befintligt ligger där.
6. **Delad kod ändras bara bakåtkompatibelt.** De rena funktionerna
   (träd, layout, tangenter) får nya valfria fält och nya funktioner; inga
   befintliga signaturer ändras. Varje ny funktion har test.
7. **Defensiv inläsning.** Allt som kommer från servern eller en fil går
   genom `sanitizeMindmapDoc`. Servern kontrollerar bara form och storlek.
8. **Varje steg gröna kontroller** före push: frontend `pnpm exec tsc
   --noEmit`, `pnpm lint`, `pnpm test`, `pnpm build`; backend `python -m
   pytest -q` och `python -m alembic heads` med exakt en head. Baslinje
   2026-11-10: 82 testfiler, 1 287 tester i frontend.
9. **Ett steg per PR**, och PR:en bockar av steget här. Ett steg som visar
   sig för stort delas i två PR:ar, båda avbockade här.

## 1. Beslut

| # | Fråga | Beslut |
|---|---|---|
| 1 | Form | **Egen sida** med sparade kartor, i den platta strukturen (`components/mindmap/`, `hooks/useMindmap…`, `services/mindmapService.ts`, `utils/mindmap…`, `types/mindmap…`). Workspace-kortet lämnas orört; de rena funktionerna lyfts ut och återanvänds. |
| 2 | Funktioner i målet | Zoom, panorering och stor yta. Anteckningar, länkar, bilder och ikoner på noder. Fri placering (manuell avvikelse) och tvärlänkar. Import av `.mup`; export PNG, PDF, Markdown, disposition. Presentationsläge. |
| 3 | Lagring | **Egna kartor per användare**, hela dokumentet sparas, version och 409 som Arbetslag. Delning med kollega är ett eget steg sist (steg 9) och kan läggas till utan att ändra det som byggts före. Publik länk är utanför planen. |
| 4 | Leverans | **Litet MVP först**, sedan ett steg per funktion. Steg 0 är osynligt, steg 2 är det första som syns. |
| 5 | Placering | **Automatisk layout med manuell avvikelse**, som MindMup: trädet ritas av `layoutMindmap`, en nod man drar får en fast förskjutning (`offset`) som följer med föräldern, och "Nollställ layout" tar bort den. Nya noder hamnar alltid rätt. |
| 6 | Bilder | **URL till bild**, visad via backendens bildproxy (`/api/workspace/image-proxy`), som Workspace. Ingen uppladdning nu. Källan har samma form som i Workspace (`{kind:'url'}` eller `{kind:'gdrive'}`), så en uppladdning till Drive senare blir en ny backend-route som ger ett `fileId`, utan ändring av kartans modell (avsnitt 9). |
| 7 | Enheter | **Dator först**, mus och tangentbord. Presentationsläge för projektor. Pek är utanför planen, men pan/zoom byggs med pointer-händelser så att nyp kan läggas till. |
| 8 | Kopplingar | **Inga.** Sidan är fristående. Inget i Workspace, Temakalender eller Schema pekar på en karta. |
| 9 | Meny | Synlig i menyn som **Mindmap** med genvägen Ctrl+Shift+7, från steg 2. |
| 10 | Gränser | Högst 100 kartor per användare. Högst 1 MB JSON per karta. Namn högst 150 tecken. Anteckning högst 20 000 tecken. |
| 11 | Delad kärna | De rena funktionerna flyttar till `src/utils/mindmap/` och typerna till `src/types/mindmap.ts`. Workspace behåller sina filer som vidareexporter. Nya nodfält är valfria i den delade typen; kortet bevarar dem vid sparning men visar dem inte. |
| 12 | Editorn | Sidan får en **egen editor** (`MindmapCanvas.tsx`), skriven utifrån kortets `MindmapEditor.tsx` men inte delad med det. Det är avsiktlig dubblering: att generalisera kortets editor hade rört Workspace i varje steg. Att låta kortet använda sidans editor är ett "bara om det behövs" i avsnitt 9. |

## 2. Datamodell

### 2.1 Den delade kärnan (`src/types/mindmap.ts`, efter steg 0)

```ts
export type MindmapColor = 'green' | 'yellow' | 'blue' | 'pink' | 'lilac' | 'grey';
export type MindmapSide = 'left' | 'right';
export type MindmapLayout = 'right' | 'both';

/** Samma form som bildproxyn tar emot (jfr Workspace `PdfSource`). */
export type MindmapImageSource =
  | { kind: 'url'; url: string }
  | { kind: 'gdrive'; fileId: string };

/** Fast lista. Ritas med lucide-ikoner på sidan; kortet visar dem inte. */
export type MindmapIcon =
  | 'star' | 'flag' | 'check' | 'question' | 'warning' | 'idea' | 'clock' | 'pin';

export interface MindmapNode {
  id: string;
  label: string;
  children: MindmapNode[];
  collapsed?: boolean;
  color?: MindmapColor;
  side?: MindmapSide;
  // Nedan: nya i den här planen. Alla valfria; saknas i gamla kartor.
  /** Steg 4. Längre text bakom noden. */
  note?: string;
  /** Steg 4. http(s)-URL. */
  link?: string;
  /** Steg 4. Bilden visas under etiketten, `width` i px på skärmen (förval 160). */
  image?: { source: MindmapImageSource; width?: number };
  /** Steg 4. */
  icon?: MindmapIcon;
  /** Steg 5. Manuell förskjutning från den automatiska platsen, i px vid zoom 1. */
  offset?: { dx: number; dy: number };
}

export interface MindmapContent {
  root: MindmapNode;
  layout?: MindmapLayout;
}
```

`sanitizeMindmap` (delad) läser de nya fälten defensivt: `note` är sträng
och klipps vid 20 000 tecken, `link` måste börja med `http://` eller
`https://`, `image.source` måste ha en av de två formerna, `icon` måste
finnas i listan, `offset` måste vara två ändliga tal. Allt annat tas bort.
Trädoperationerna i `mindmapTree.ts` sprider noden (`{ ...node, … }`), så
fälten följer med vid flytt, indrag och kopiering utan att operationerna
ändras. Det kontrolleras med ett test i steg 0.

**Varför i den delade typen och inte bara på sidan:** operationerna och
tvätten är delade. Lägger sidan fälten i en egen typ måste den ha en egen
tvätt som gör om allt den delade gör, och de två glider isär. Priset är att
kortet bevarar fält det inte visar, vilket är ofarligt: ett kort som sparas
om skriver bara tillbaka det som redan fanns.

### 2.2 Sidans dokument (`src/types/mindmapDoc.ts`)

```ts
export interface MindmapCrossLink {
  id: string;
  from: string;   // nod-id
  to: string;     // nod-id
  label?: string;
  arrow?: 'none' | 'to' | 'both';   // förval 'to'
}

/** Det som sparas i backendens `doc`. */
export interface MindmapDoc extends MindmapContent {
  /** Steg 6. Länkar på tvären, utanför trädet. */
  crossLinks?: MindmapCrossLink[];
}

export interface MindmapSummary {
  id: string;
  name: string;
  version: number;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface MindmapMap extends MindmapSummary {
  doc: MindmapDoc;
}
```

`sanitizeMindmapDoc` (`utils/mindmapDoc.ts`) kör den delade tvätten på
trädet och tar sedan bort tvärlänkar vars `from` eller `to` inte finns,
som pekar på sig själva, eller som går mellan förälder och barn (MindMups
regler). `removeNode` på sidan går genom `removeNodeFromDoc`, som också
rensar tvärlänkarna.

Nyckelstilen i API:t är camelCase, som Arbetslag och Närvaro.

## 3. Backend (`Saibot57/drive_c_backend`, steg 1)

Förebild: `models/arbetslag_models.py`, `api/arbetslag_routes.py`,
`migrations/versions/023_add_narvaro_document.py`, `tests/test_arbetslag.py`.
Utan delningstabell.

### 3.1 Modell: `models/mindmap_models.py`

```python
class MindmapMap(db.Model):
    __tablename__ = 'mindmap_map'
    __table_args__ = ({'mysql_charset': 'utf8mb4', 'mysql_collate': 'utf8mb4_unicode_ci'},)

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = db.Column(db.String(36), nullable=False, index=True)   # ingen ForeignKey
    name = db.Column(db.String(150), nullable=False)
    doc = db.Column(db.Text().with_variant(mysql.MEDIUMTEXT(), 'mysql'), nullable=False)
    version = db.Column(db.Integer, nullable=False, default=1)
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)
```

`to_summary()` ger `{id, name, version, createdAt, updatedAt}`, `to_dict()`
lägger till `doc` (parsad JSON, `{}` om trasig). Importeras i `app.py`,
`tests/conftest.py` och `migrations/env.py`.

### 3.2 Migration: `migrations/versions/024_add_mindmap_map.py`

`revision = '024_mindmap_map'`, `down_revision = '023_narvaro_document'`.
Samma vakt, kolumntyper, tidsstämplar och index (`ix_mindmap_map_user_id`)
som `023`. Docstringen förklarar att tabellen är ny och inget befintligt
rörs. `python -m alembic heads` ska ge en head.

### 3.3 Validering: `api/validation.py` (ny)

`CLAUDE.md` säger att en femte kopia av `PayloadError` inte får skrivas.
Det här steget skapar filen som arkitekturplanens steg 3 vill ha, men
flyttar **ingen** befintlig route dit: bara de nya mindmap-routes importerar
från den. Innehåll: `PayloadError`, `is_int(value)`, `text(value, label,
max_length)`, `json_document(value, max_bytes, label)` som ger kompakt JSON
efter form- och storlekskontroll. Den session som gör arkitekturplanens
steg 3 flyttar `narvaro_routes` och `term_routes` hit; skriv det i den
planen under steg 3 när den här filen finns.

### 3.4 API: `api/mindmap_routes.py`

Blueprint `mindmap_api`, registrerad i `app.py` som
`app.register_blueprint(mindmap_api, url_prefix='/api/mindmap')`. Alla
routes har `@token_required` och `@retry_on_connection_error`, filtrerar
på `current_user.id`, och en handler med `except Exception` släpper igenom
`OperationalError` först.

| Metod | Sökväg | Body | Svar |
|---|---|---|---|
| GET | `/api/mindmap` | – | 200, lista med summaries, `updatedAt` fallande |
| POST | `/api/mindmap` | `{id?, name, doc}` | 201 hela kartan (`version: 1`); 200 med den befintliga om `id` redan finns hos användaren; 409 om `id` finns hos någon annan (som Arbetslag) |
| GET | `/api/mindmap/<id>` | – | 200 hela kartan, eller 404 |
| PUT | `/api/mindmap/<id>` | `{version, name?, doc?}` | 200 hela kartan med `version + 1`; 404; 409 `{version, updatedAt}` i `data` med texten "Kartan har ändrats någon annanstans" |
| DELETE | `/api/mindmap/<id>` | – | 200 `{id}`, eller 404 |

Kontroller: `name` med `text(…, 150)`; `doc` måste vara ett objekt med
`root` som objekt med `id` (sträng) och `children` (lista), högst 1 MB
kompakt JSON; `version` heltal ≥ 1 i PUT. Högst 100 kartor per användare
(400 "Du har redan 100 kartor"). Uppdateringen görs med villkorlig
`update().where(version == …)` som i `narvaro_routes.py`, så att två
flikar aldrig skriver samtidigt. Felmeddelanden på svenska utan interna
detaljer.

### 3.5 Tester: `tests/test_mindmap.py`

`BLUEPRINTS = [(mindmap_api, '/api/mindmap')]`. Pröva: skapa, lista,
läsa, uppdatera (version räknas upp), 409 på gammal version och att inget
skrevs, radera, 404 för `bob` på alla fem, POST med samma id två gånger ger
samma karta, 100-taket, för stor `doc`, `doc` utan `root`, tomt namn och
för långt namn, `version` som saknas eller är text. Kontrollera också att
`doc` kommer tillbaka exakt som den skickades (inklusive okända fält:
servern tvättar inte).

### 3.6 Deploy

Backend före frontend. `DEPLOY.md`, historiken:

> `024_mindmap_map` – ny tabell `mindmap_map` (Mindmap-sidans kartor,
> `/api/mindmap`). **Före frontend:** mot gammal backend svarar
> `/api/mindmap` 404 och sidan visar att servern inte svarar. Inget annat
> berörs.

## 4. Frontend: struktur

Efter steg 0 (delad kärna) och steg 2 (sidan):

```
src/types/mindmap.ts                          delad: nod, innehåll, färger, ikoner, bildkälla
src/utils/mindmap/mindmapTree.ts   (+test)    delad, flyttad från workspace
src/utils/mindmap/mindmapLayout.ts (+test)    delad, flyttad
src/utils/mindmap/mindmapKeys.ts   (+test)    delad, flyttad
src/utils/mindmap/mindmapHistory.ts (+test)   delad, flyttad
src/utils/mindmap/mindmapOutline.ts (+test)   delad, flyttad
src/utils/mindmap/mindmapDraw.ts              delad: ritar en layout på en Canvas med en palett (lyft ur mindmapExport.ts)

src/app/workspace/_feature/types/mindmap.types.ts     vidareexport av src/types/mindmap.ts
src/app/workspace/_feature/utils/mindmapTree.ts        vidareexport, och så vidare för de fem
src/app/workspace/_feature/utils/mindmapExport.ts      kvar: läser kortets palett ur .ws-mindmap, anropar mindmapDraw

src/app/(full-width)/features/mindmap/page.tsx         ProtectedRoute + <Mindmap />
src/components/mindmap/Mindmap.tsx                     rot: FeatureNavigation, lista, editor, sparstatus
src/components/mindmap/MindmapList.tsx                 "Sparade kartor": rader, ny, byt namn, duplicera, ta bort
src/components/mindmap/MindmapCanvas.tsx               kartan: noder, kanter, pekare, tangenter, drag
src/components/mindmap/MindmapToolbar.tsx              verktygsraden
src/components/mindmap/MindmapHelp.tsx                 hjälprutan med kortkommandon
src/components/mindmap/MindmapNodePanel.tsx            steg 4: anteckning, länk, bild, ikon för markerad nod
src/components/mindmap/MindmapPresent.tsx              steg 8: presentationsläge
src/components/mindmap/mindmap.css                     --mm-* från --ui-*, importeras av Mindmap.tsx
src/hooks/useMindmapSync.ts        (+test, jsdom)      lista + öppen karta, saveQueue med version/409
src/hooks/useMindmapViewport.ts                        zoom/pan-state; räknandet ligger i utils
src/services/mindmapService.ts     (+test)             list/get/create/update/remove, MindmapConflictError
src/types/mindmapDoc.ts                                dokument, summary, tvärlänk
src/utils/mindmapDoc.ts            (+test)             sanitizeMindmapDoc, removeNodeFromDoc, tvärlänksregler
src/utils/mindmapViewport.ts       (+test)             zoom kring en punkt, passa in, centrera på nod
src/utils/mindmapMup.ts            (+test)             steg 7: läser .mup
src/utils/mindmapMarkdown.ts       (+test)             steg 7: Markdown ut
src/utils/mindmapPdf.ts                                steg 7: PDF via jspdf
src/utils/mindmapImage.ts          (+test)             steg 4: parseImageSource (samma regexar som Workspace, 10 rader)
```

Regler ur `CLAUDE.md` som gäller här: Tailwind med `--ui-*`-tokens i
komponenterna, inga hex-värden, inget `gray-*`; kartans egna klasser i
`mindmap.css` med `--mm-*` som definieras ur `--ui-*` (som `--ws-mm-*` i
`workspace.css`); dialoger med `useMovableDialog`; nedladdning med
`downloadBlob`; localStorage via `usePersistentState` med en
`sanitize`-funktion; tester bara på `utils/`, `services/` och hookar.

### 4.1 Sparning (`useMindmapSync`)

Förebild `useNarvaroSync.ts` utan kryptering, en nyckel = kart-id.

- `createSaveQueue` med `delayMs: 800`, `save` anropar
  `mindmapService.update(id, { doc, name }, version, { keepalive })`,
  `retainOnError: err => !(err instanceof MindmapConflictError)`.
- Versionen per karta hålls i en `Map`, uppdateras ur varje lyckat svar.
- Status `saved | pending | saving | error | conflict` visas i verktygsraden
  som i Arbetslag ("Sparat", "Sparar…", "Kunde inte spara, försöker igen",
  "Kartan har ändrats någon annanstans").
- Vid `conflict`: en ruta med "Ladda den sparade versionen" (hämtar om,
  ersätter det öppna) och "Behåll min" (sparar om med den nya versionen
  från 409-svaret). Ingen tyst överskrivning.
- Sidbyte och stängning: `flush` med `keepalive` som i Närvaro
  (`utils/leaveSave.ts`, `keepalive.ts`).
- Byte av karta i listan: `flush` först, sedan öppna.
- `mindmap.lastOpen.v1` minns vilken karta som var öppen senast (bara id,
  tvättat med en `sanitizeLastOpen` som kräver ett UUID-liknande värde).

### 4.2 Editorns lägen och pekare (`MindmapCanvas`)

Samma två lägen som kortet (`nav` och `edit`) och samma
`resolveMindmapKey`. Skillnader mot kortet:

- Kartan ligger i ett `transform: translate(…) scale(…)`-lager inuti en yta
  som fyller sidan under verktygsraden. Hjul = panorera, Ctrl+hjul = zooma
  kring pekaren, dra på tom yta = panorera, dra en nod = flytta den (steg 2:
  ny förälder; steg 5: även fri placering). Allt med pointer-händelser.
- Textmätningen med mätnoder behålls (den ger samma bredd i bild och på
  skärm), men mäts vid zoom 1 och skalas av lagret.
- Hjälprutan listar `MINDMAP_SHORTCUTS` plus sidans egna (avsnitt 6).
- Egen ångra-historik som kortet (`mindmapHistory`), 100 steg.

## 5. Steg

Varje steg: **Mål**, **Gör**, **Testa**, **Klart när**, **Risk och skydd**.
Bocka av med datum och PR-nummer; skriv avvikelser under steget.

### Steg 0: Lyft ut kärnan (FE, ingen synlig ändring)

- [x] Genomfört 2026-11-10 (#267).
  - Avvikelse: de nya testerna ligger i en egen fil,
    `src/utils/mindmap/mindmapFields.test.ts` (10 tester), i stället för i
    `mindmapTree.test.ts`, så att de flyttade testfilernas diff mot
    originalen bara är importraden. Kontrollerat med `git diff --no-index`
    mot `HEAD` för alla fem par.
  - Avvikelse: `src/types/mindmap.ts` fick också `MINDMAP_ICONS` och
    `MINDMAP_NOTE_MAX_LENGTH`, som tvätten behöver.
  - `mindmapExport.ts` i workspace vidareexporterar `canvasToPng`,
    `renderMindmapCanvas` och `MindmapPalette` från `mindmapDraw.ts`, så
    att `MindmapEditor.tsx` importerar dem som förut utan ändring.
  - Kontroller: `tsc`, `lint` (bara den gamla varningen i
    `WorkspaceShell.tsx`), `test` (83 filer, 1 297 tester, från 82 och
    1 287) och `build` gröna.
  - Inte kontrollerat: kortet i webbläsaren (skyddsregel 1). Sessionen
    hade ingen backend att logga in mot. Gör det i förhandsvisningen av
    PR:en: nytt mindmap-kort, Tab/Enter, färg, export som bild och
    punktlista.

**Mål.** De rena mindmap-funktionerna blir delade, så att sidan kan
importera dem utan att nå in i Workspace. Inget ändras för användaren.

**Gör.**
1. Flytta `types/mindmap.types.ts` → `src/types/mindmap.ts` och
   `utils/mindmapTree|Layout|Keys|History|Outline.ts` med sina `.test.ts` →
   `src/utils/mindmap/`. Rätta importerna inuti dem (`../types/mindmap.types`
   → `@/types/mindmap`).
2. Lämna kvar filer med samma namn på de gamla platserna som bara
   vidareexporterar: `export * from '@/utils/mindmap/mindmapTree';` (och
   `export type` där det behövs). Kortets filer (`MindmapEditor.tsx`,
   `MindmapToolbar.tsx`, `mindmapExport.ts`, övriga i workspace) ändras
   inte alls.
3. Lyft ritandet (`renderMindmapCanvas`, `pill`, `canvasToPng`) ur
   `mindmapExport.ts` till `src/utils/mindmap/mindmapDraw.ts`. Kvar i
   `mindmapExport.ts`: `readMindmapPalette` (läser `.ws-mindmap`), urklipp
   och en import av det flyttade. Det är en mekanisk flytt; `MindmapPalette`
   flyttar med.
4. Lägg de nya valfria fälten från avsnitt 2.1 i typen och i
   `sanitizeMindmap`, med tester: fält av rätt form bevaras, fel form tas
   bort, en nod utan fälten ger exakt samma resultat som förut.
5. Test som visar att `moveNode`, `indent`, `outdent`, `addChild` och
   `addSibling` bevarar `note`, `link`, `image`, `icon` och `offset` på
   noderna de flyttar.

**Testa.** `pnpm test`: samma 82 filer plus eventuella nya; alla tidigare
påståenden oförändrade (diffen på testfilerna ska bara vara importrader).
Manuellt: skyddsregel 1.

**Klart när** `pnpm exec tsc --noEmit`, `pnpm lint`, `pnpm test`, `pnpm
build` är gröna, och `git diff --stat` på workspace-mappen bara visar
vidareexportfiler och `mindmapExport.ts`.

**Risk och skydd.** Störst risk i hela planen för kortet, därför ett eget
steg utan annat innehåll. Vidareexporterna gör att inga importrader i
kortet ändras. `sanitizeMindmap` prövas mot kortets befintliga fixturer.

### Steg 1: Backend `/api/mindmap` (BE)

- [x] Koden genomförd 2026-11-10 på backend-grenen
  `claude/stoic-franklin-774m9t` (PR-numret skrivs in när PR:en finns).
  Deployen återstår och görs av Tobias; först då är steget klart enligt
  "Klart när".
  - `api/validation.py` har `PayloadError`, `is_int`, `text`, `integer`
    och `json_document`. Bara `mindmap_routes` importerar därifrån.
    Noterat under steg 3 i `arkitektur-2026-11.md`.
  - Kontroller: `pytest` (547 tester, varav 12 nya), `alembic heads` ger
    en head. Migrationen är `023` rad för rad utöver kolumnerna (jämfört
    med `diff`).
  - Inte kontrollerat: att `create_app()` registrerar routen. Appfabriken
    går inte att starta utan MySQL (poolparametrarna avvisas av SQLite).
    Raden i `app.py` står bredvid `narvaro_api`. Kontrollera efter
    deployen med `GET /api/mindmap` som i "Klart när".

**Mål.** Kartor kan sparas, listas, läsas, uppdateras med version och
raderas. Avsnitt 3 i sin helhet.

**Gör.** Modell, migration `024`, `api/validation.py`, routes, tester,
tre importer, `app.py`, `DEPLOY.md`.

**Testa.** `python -m pytest -q` grönt, `python -m alembic heads` ger en
head. Om en lokal databas finns: `python -c "from app import create_app;
a=create_app(); print(sorted(r.rule for r in a.url_map.iter_rules() if
r.rule.startswith('/api/mindmap')))"` ska lista fem regler (testerna kör
inte `app.py`, se `CLAUDE.md`).

**Klart när** testerna är gröna och Tobias har deployat (`git pull`,
`alembic upgrade head`, Reload) och `GET /api/mindmap` ger `{success:
true, data: []}` i produktion.

**Risk och skydd.** Ny tabell, ny blueprint, ny valideringsfil som ingen
annan route importerar. Enda ändringen i befintlig kod är registreringen.

### Steg 2: Sidan med lista och editor (FE, första synliga steget)

- [ ] Genomfört: –

**Mål.** `/features/mindmap` i menyn (Ctrl+Shift+7). En lista med sparade
kartor till vänster (hopfällbar), kartan till höger med allt kortet kan i
dag: skriva med Tab och Enter, pilar, färg, fäll ihop, flytta bland
syskon, dra till ny förälder, båda sidor, ångra, kopiera och klistra in
disposition, export som PNG och disposition. Sparning enligt 4.1. Inga
nya kartfunktioner ännu; zoom och panorering kommer i steg 3, men ytan
scrollar.

**Gör.**
1. `types/mindmapDoc.ts`, `utils/mindmapDoc.ts` med `sanitizeMindmapDoc`
   (tvärlänkar tomma tills steg 6, men tvätten tar redan bort dem om de
   inte stämmer) och test.
2. `services/mindmapService.ts` med `MindmapConflictError` och test (mocka
   `fetchWithAuth` som i `arbetslagService.test.ts`).
3. `hooks/useMindmapSync.ts` med jsdom-test som prövar: hämta lista, öppna,
   skriva ger `pending` → `saving` → `saved` och ny version, 409 ger
   `conflict` utan ny sparning, "Ladda den sparade" hämtar om.
4. `components/mindmap/`: `Mindmap.tsx`, `MindmapList.tsx`,
   `MindmapCanvas.tsx`, `MindmapToolbar.tsx`, `MindmapHelp.tsx`,
   `mindmap.css`. Canvasen skrivs utifrån `MindmapEditor.tsx` (kopiera det
   som behövs, ta bort kortets `isSelected`/`isLocked`/`editSignal`).
   Export som bild: egen `readPalette` som läser `--mm-*` ur `.mm-root`,
   sedan `mindmapDraw`. Bilden ritas i standardutseendet som kortet gör
   (temat tas bort medan värdena läses).
5. Listan: "Ny karta" (POST med klientens id, namn "Ny karta"), byt namn
   (dialog med `useMovableDialog`), duplicera, ta bort (bekräfta).
   Tom lista visar en text och en knapp.
6. `page.tsx`, en rad i `FeatureNavigation.tsx` (`{ label: 'Mindmap', href:
   '/features/mindmap', icon: Network, shortcut: '7' }`), en rad i
   `shortcuts.ts` och en grupp "Mindmap" med kortets lista.
7. Tom sida utan backend (404 på listan): "Servern svarar inte" som
   Närvaro, ingen krasch.

**Testa.** Automatiskt enligt ovan. Manuellt: skriv en karta på 30 noder
utan mus, ladda om sidan (kartan är kvar), öppna samma karta i två flikar
och skriv i båda (den andra får konfliktrutan), stäng fliken mitt i
skrivandet (sparat vid nästa öppning). Skyddsregel 1 på kortet. Menyns
siffror 1–6 fungerar som förut.

**Klart när** Tobias kan skriva, spara och öppna kartor i produktion i
båda temana.

**Risk och skydd.** Mycket ny kod men nästan bara nya filer. De två
befintliga filerna får en rad var. Ikonen `Network` finns i lucide-react
som redan används.

### Steg 3: Zoom, panorering och stor yta (FE)

- [ ] Genomfört: –

**Mål.** Kartan har ingen praktisk gräns. Ctrl+hjul zoomar kring pekaren
(25–300 %), hjul panorerar, dra på tom yta panorerar, Ctrl+0 passar in
hela kartan, Ctrl+. centrerar på markerad nod, Ctrl++ och Ctrl+- zoomar i
steg (webbläsarens egen zoom stoppas med `preventDefault` medan kartan har
fokus; utanför kartan gäller webbläsarens). Den
markerade noden hålls synlig när man går med pilarna (ytan följer med
mjukt). En minikarta nere till höger visar hela kartan och var man är;
klick i den flyttar vyn. Zoomnivån visas i verktygsraden.

**Gör.** `utils/mindmapViewport.ts` (rena funktioner: `zoomAt(view, point,
factor)`, `fitToBounds(view, bounds, size)`, `centerOn(view, rect, size)`,
`clampZoom`) med test; `hooks/useMindmapViewport.ts`; minikartan ritas
med `mindmapDraw` i liten skala, uppdaterad med `requestAnimationFrame`
högst 10 gånger i sekunden. Vyn per karta sparas i `mindmap.view.v1`
(localStorage, högst 50 kartor, äldst kastas), inte i backend.

**Testa.** Viewport-testerna: zoom kring en punkt håller punkten stilla,
passa in ger hela kartan med marginal, centrera lägger noden i mitten.
Manuellt: en karta på 300 noder (klistra in en lång disposition) är
smidig att panorera i.

**Klart när** kartan på 300 noder går att skriva i utan att tappa fokus.

**Risk och skydd.** Bara nya filer och ändringar i sidans egna komponenter.

### Steg 4: Anteckningar, länkar, bilder och ikoner (FE)

- [ ] Genomfört: –

**Mål.** En markerad nod kan få en anteckning (visas som en liten symbol
på noden, texten i en panel till höger som öppnas med Alt+N), en länk
(Alt+L, klickbar symbol på noden, öppnas i ny flik), en bild (Alt+I, URL eller
Drive-länk via `parseImageSource`, visas under etiketten i vald bredd, via
bildproxyn med blob-URL som Workspace) och en ikon (`Alt+Shift+1–8`).
Allt syns i PNG-exporten utom anteckningen, som följer med i dispositionen
som ett indrag under noden.

**Gör.** `MindmapNodePanel.tsx` (panel, inte dialog: den ska kunna stå
öppen medan man skriver i kartan), `utils/mindmapImage.ts` med test,
`setNote/setLink/setImage/setIcon` i `mindmapTree.ts` (nya funktioner,
test), layouten tar höjd för bilden (`mindmapLayout.ts`: en nod med bild
får `height += imageHeight + gap`; test), `mindmapDraw` ritar symboler
och bild, `mindmapOutline` tar med anteckningen.

**Testa.** Trädfunktionerna, layouthöjden, `parseImageSource`, dispositionen
med anteckning. Manuellt: en bild från Drive och en från webben; en trasig
länk visar "Kunde inte hämta bild" i noden, inte en krasch. Skyddsregel 1:
kortet visar en karta med anteckningar utan symboler och utan fel.

**Klart när** alla fyra syns på skärmen i båda temana och i PNG:n.

**Risk och skydd.** Delad kod får nya funktioner och ett tillägg i layouten
som bara träder in när `image` finns; befintliga layouttester oförändrade.

### Steg 5: Fri placering (FE)

- [ ] Genomfört: –

**Mål.** Dra en nod så förskjuts den (och dess gren) från den automatiska
platsen och stannar där; förskjutningen sparas som `offset` och följer med
när föräldern flyttar. Dra en nod över en annan nod gör den till barn som
förut (släppmålet markeras); dra till tom yta sätter `offset`. "Nollställ
layout" på noden (`Alt+Shift+0`) och på hela kartan (verktygsraden) tar
bort förskjutningarna. Kanterna ritas till den förskjutna platsen.

**Gör.** `layoutMindmap` får ett steg efter den vanliga layouten som lägger
på `offset` rekursivt (test: en nod med offset flyttar hela grenen, syskon
rörs inte). `setOffset`/`clearOffsets` i `mindmapTree.ts`. Dragläget i
`MindmapCanvas` skiljer på "över nod" och "över tom yta" (tröskel 5 px som
i dag). Vid `both`-layout får en förskjutning inte flytta en gren över
roten till andra sidan; då byts `side` i stället (test).

**Testa.** Layouttesterna. Manuellt: dra, nollställ, ångra.

**Klart när** en karta med manuella placeringar exporteras likadant som
den ser ut.

**Risk och skydd.** `offset` saknas i alla gamla kartor, så layouten är
identisk för dem (test som jämför med och utan steget på en karta utan
offset).

### Steg 6: Tvärlänkar (FE)

- [ ] Genomfört: –

**Mål.** `Ctrl+L` på en markerad nod startar en länk; klick (eller pilar +
Enter) på en annan nod avslutar. Länken ritas som en streckad kurva med
pil, kan få en etikett (dubbelklick på kurvan), bytas riktning och tas bort
(markera kurvan, Delete). Länkar till en hopfälld gren ritas till den
synliga förfadern. Tas en nod bort försvinner dess länkar.

**Gör.** `addCrossLink/removeCrossLink/setCrossLinkLabel` i
`utils/mindmapDoc.ts` med MindMups regler (inte till sig själv, inte
förälder–barn, högst en per par) och test. Kurvan ritas i samma SVG som
kanterna, i ett eget lager ovanpå. `mindmapDraw` ritar dem. Dispositionen
nämner dem i en lista sist ("Länkar: A → B").

**Testa.** Reglerna, borttagning vid `removeNodeFromDoc`, hopfälld gren.

**Klart när** tvärlänkar syns, går att redigera och följer med i PNG:n.

**Risk och skydd.** Bara sidans dokumenttyp; kortets `MindmapContent` vet
inget om `crossLinks`, och den delade tvätten rör dem inte.

### Steg 7: Import och export (FE)

- [ ] Genomfört: –

**Mål.** Importera en `.mup`-fil (MindMup) som en ny karta; exportera som
PNG (finns), PDF, Markdown och disposition (finns), och som `.json` med
sidans eget format (och läsa in det igen).

**Gör.**
- `utils/mindmapMup.ts`: läser MindMups JSON. Två former: v2 (rotidén
  överst, med `title`, `id`, `ideas`, `attr`, `links`) och v3 (ett
  omslag med `formatVersion: 3` och rotidén under `ideas["1"]`). `ideas`
  är ett objekt med rangtal som nycklar; positiva rangtal ligger till
  höger och negativa till vänster, i ordning efter absolutvärde. Ur `attr`
  läses `collapsed`, `note.text` → `note`, `style.background` → närmaste
  `MindmapColor` (annars ingen), `position` ignoreras (vår layout är en
  annan; sätt inte `offset`), `icon.url` → bild om http(s), `attachment`
  med `contentType` `text/html` → anteckning som text utan taggar. `links`
  → `crossLinks` (`ideaIdFrom`, `ideaIdTo`). Allt annat tas bort. Skriv
  testerna först, mot fixturer i `src/utils/mindmap/__fixtures__/` (en v2
  och en v3 som skrivs för hand efter formatet ovan; kontrollera mot en
  riktig fil från mindmup.com om sessionen har en). Okända former ger ett
  fel som visas som notis, aldrig en halv karta.
- `utils/mindmapMarkdown.ts`: rubriker för nivå 1–3, därefter punkter;
  anteckning som stycke under; länk som `[etikett](url)`; test.
- `utils/mindmapPdf.ts`: PNG:n från `mindmapDraw` i en `jspdf`-sida med
  liggande A4 eller A3 efter kartans proportioner, skalad att passa med
  marginal; filnamn med `toFileSlug`. Inget test (DOM).
- Menyn "Exportera" och "Importera" i verktygsraden. Import skapar alltid
  en ny karta; den öppna skrivs aldrig över.

**Testa.** `.mup`-fixturerna, Markdown, JSON ut och in ger samma dokument.

**Klart när** en karta från mindmup.com går att öppna och exportera som
PDF.

**Risk och skydd.** Nya filer. `jspdf` används redan i appen.

### Steg 8: Presentationsläge (FE)

- [ ] Genomfört: –

**Mål.** `F5` (och en knapp) visar kartan i helskärm utan verktygsrad
och lista, med större text (nodhöjd × 1,5), allt hopfällt utom roten.
Mellanslag eller högerpil fäller ut nästa gren i läsordning, vänsterpil
fäller ihop, pilarna upp/ned går mellan grenar, `Esc` avslutar. Vyn
zoomar och centrerar mjukt på det som fälls ut. Ändringar i
presentationsläget sparas inte (hopfällningen är lokal).

**Gör.** `MindmapPresent.tsx` med egen lokal `collapsed`-uppsättning
(inte dokumentets), `utils/mindmapPresent.ts` med `nextStep/prevStep`
(ren logik över trädet, test). Helskärm via `requestFullscreen` om det
finns, annars bara sidans yta.

**Testa.** Steglogiken. Manuellt på en projektor eller andra skärmen.

**Klart när** en lektion går att hålla från kartan utan att röra musen.

**Risk och skydd.** Nya filer; dokumentet ändras inte i läget.

### Steg 9 (efter målet): Delning med kollega (BE och FE)

- [ ] Genomfört: –

Som Arbetslags delning: tabell `mindmap_map_share` (migration `025`),
routes `POST/DELETE /api/mindmap/<id>/shares`, `_has_access` i stället
för ägarfilter, listan visar "delad av". Versionen skyddar redan mot två
som skriver samtidigt. Görs bara om Tobias ber om det när steg 0–8 är
klara. Publik skrivskyddad länk är utanför planen.

## 6. Kortkommandon

Kortets lista (`MINDMAP_SHORTCUTS`) gäller rakt av. Sidan lägger till:

| Tangent | Vad | Steg |
|---|---|---|
| Ctrl+hjul, Ctrl++, Ctrl+- | Zooma | 3 |
| Hjul, dra på tom yta | Panorera | 3 |
| Ctrl+0 | Passa in hela kartan | 3 |
| Ctrl+. | Centrera på markerad nod | 3 |
| Alt+N | Anteckning | 4 |
| Alt+L | Länk | 4 |
| Alt+I | Bild | 4 |
| Alt+Shift+1–8 | Ikon (Alt+Shift+9 tar bort) | 4 |
| Alt+Shift+0 | Nollställ placering på en flyttad nod | 5 |
| Ctrl+L | Börja tvärlänk | 6 |
| F5 | Presentationsläge | 8 |
| Ctrl+Shift+7 | Gå till Mindmap | 2 |

**Inga genvägar utan modifierare utöver kortets.** Två skäl, båda
kontrollerade i koden 2026-11-10:

- I nav-läget skriver ett tecken över noden (`resolveMindmapKey`: en
  tangent med `key.length === 1` utan Ctrl och Alt ger `edit` med
  `replaceWith`). `n`, `0` eller `.` hade alltså bytt ut nodens text.
- De gömda dörrarna i `FeatureNavigation` (`t-t-t`, `n-n-n`) räknar varje
  tryck utan Ctrl, Alt eller Meta utanför textfält, och bryr sig inte om
  `preventDefault`. Kartans yta är inte ett textfält, så `n` tre gånger
  på en markerad nod hade öppnat Närvaro. Med Alt nollställs räknaren.

Alt+siffra läses med `e.code` (`Digit1`), inte `e.key`, som kortet gör;
Alt+siffra ger specialtecken på Mac. Ctrl+0, Ctrl++ och Ctrl+- är
webbläsarens zoom; kartan stoppar dem med `preventDefault` bara när den
har fokus. Kontrollera i steg 3 att sidans zoom inte påverkas av
webbläsarens när man zoomar utanför kartan.

## 7. Utseende och tema

- `mindmap.css` definierar `--mm-line`, `--mm-text`, `--mm-node-bg`,
  `--mm-node-border`, `--mm-root-bg`, `--mm-root-border`, `--mm-select`,
  `--mm-badge-bg`, `--mm-badge-text`, `--mm-link` (tvärlänkar), `--mm-c-*`
  (sex färger) ur `--ui-*`, på samma sätt som `--ws-mm-*`. Ett byte av
  tema byter dem automatiskt. Inga nya tokens i `tokens.css` behövs; skulle
  det behövas ska det stå i PR:en och gälla båda temana.
- Formen följer `kron:`-regeln: hörnradie och kantbredd skiljer mellan
  temana, färger bara via tokens.
- Exporten (PNG, PDF) ritas i standardutseendet, som kortet och ytan gör.

## 8. Verifiering

Automatiskt i varje steg: de fyra frontendkommandona och backendens två.

**Regressionslista**, gås igenom manuellt efter steg 2 och efter steg 8,
och efter varje steg som rört en delad fil:

1. Workspace: nytt mindmap-kort, Tab/Enter/pilar, färg, fäll ihop, dra till
   ny förälder, ångra, export som bild och punktlista, klistra in från
   Google Docs. Ett gammalt kort öppnas och ser ut som förut.
2. Menyn: Ctrl+Shift+1–6 går dit de gick; `?` visar genvägarna med den nya
   gruppen; `t-t-t` och `n-n-n` fungerar.
3. Schema: öppna, redigera en post, spara. (Rörs inte av planen, men är
   appens kärna.)
4. Temat: växla Neo/Kronberg på Mindmap-sidan och på Workspace.
5. Backend: `GET /api/arbetslag`, `/api/narvaro` och `/api/workspace`
   svarar som förut efter deployen.

## 9. Utanför planen, och hur det skulle läggas till

- **Uppladdning av bilder till Drive.** Ny backend-route
  `POST /api/mindmap/images` (multipart) som lägger filen i användarens
  Drive-mapp via `services/drive_connect.py`, registrerar en `DriveFile` och
  svarar `{fileId}`. Kartan sparar `{kind:'gdrive', fileId}`, som
  bildproxyn redan hanterar. Ingen ändring i kartans modell eller i
  steg 4; bara en knapp till i bildpanelen.
- **Pek och nyp.** Pan/zoom är byggt på pointer-händelser; nyp blir två
  pekare i `useMindmapViewport`.
- **Publik skrivskyddad länk**, som schemats.
- **Kortet använder sidans editor.** Bara om kortet behöver något sidan har.
  Då ersätts `MindmapEditor.tsx` med `MindmapCanvas` i ett eget steg med
  egen regressionsrunda.
- **Google-konto i appen**, samarbete i realtid, MindMups mått
  ("measurements") och storyboards, flerradiga noder (en nod är en rad;
  anteckningen tar resten).

## 10. Öppna frågor

Inga som stoppar steg 0–2. Två att svara på innan steg 4 respektive 7:

1. Ikonlistan i 2.1 (åtta stycken) är ett förslag. Vilka vill du ha?
2. Ska PDF:en vara en sida (hela kartan nedskalad) eller delas på flera
   sidor vid stora kartor? Planen säger en sida, A4 eller A3.

## 11. Arbetsgång för en agent

1. Läs `CLAUDE.md` i det repo du ska ändra, sedan skyddsreglerna och det
   steg du ska göra. Inte resten av planen.
2. Arbeta på den gren du fått. Ett steg, en PR per repo.
3. Kör kontrollerna i skyddsregel 8 före push. Skriv i PR:en vad som
   kontrollerats manuellt och vad som inte kunde kontrolleras.
4. Bocka av steget här med datum och PR-nummer, skriv avvikelser under
   steget, och uppdatera raden i `docs/plans/README.md`.
5. Rör du något utanför listan i skyddsregel 2: skriv "Avvikelse" med
   skälet under steget. Rör du inget sådant: skriv inget.
