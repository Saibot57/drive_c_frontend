# Närvarorutor: sparade gruppindelningar

Status: Pågår

## 1. Vad användaren vill

> "Jag vill kunna spara grupper och sedan kunna dela in klasser/lektioner i
> dem (så gott det går utifrån närvaro, alltså dela in dem som är närvarande
> i de grupperna)."

I dag hör grupperna till ett enda pass (`groupsKey` = pass + visade klasser).
Användaren vill ha **sparade, namngivna indelningar** ("Labbgrupper NA1" med
Grupp 1: Amira, Bilal …) som kan läggas på vilket pass som helst. Då hamnar
de närvarande i sina grupper och de frånvarande syns inte.

## 2. Beslut (intervju 2026-11-26)

| Fråga | Beslut |
|---|---|
| Hur skapas en indelning | **Båda sätten**: "Spara som indelning" från ett pass grupper, och från grunden i en egen vy med klasslistorna. |
| Vilka elever | **Fritt**: vem som helst ur vilken klass som helst. En indelning hör inte till en klass. |
| Namn | Indelningen har ett namn. Grupperna har **valfria namn**, "Grupp 1" om inget annat anges. |
| Antal | Cirka 5–20. De går att byta namn på och ta bort. |
| Närvarande som inte finns i indelningen | Hamnar i **Inte indelade**. |
| Tomma eller ojämna grupper | **Inget** görs. Grupperna blir som indelningen; en tom grupp visas tom. |
| Ändra i passet | Passet ändras för sig, indelningen är orörd. Knappen **Uppdatera indelningen** skriver passets grupper tillbaka. |
| Passet minns indelningen | **Ja**: "Från: Labbgrupper NA1" visas i passet och behövs för Uppdatera. |
| Passet har redan grupper | **Ersätt efter fråga**: "Passet har redan grupper. Ersätta dem?" |
| Förval för återkommande pass | **Inte nu**. Kan bli ett senare tillägg (se avsnitt 10). |
| Mobilen | **Lägga på** en indelning när passet saknar grupper. Skapa och redigera görs på datorn. |
| Elev som slutat eller bytt klass | **Matchas på namn**, oavsett klass. I redigeringen markeras namn som inte finns i något ark, med en knapp som tar bort dem. |

Efter granskningen 2026-11-26 (frågorna A–E och punkt 5):

| Fråga | Beslut |
|---|---|
| Indelningen har elever ur klasser som inte visas | **Sidan väljer indelningens klasser** innan den läggs på (som `setChosen` när mobilen byter till ett annat pass grupper), så att alla kommer med. |
| Spara som indelning från ett pass som delats in för hand eller slumpats | Rutan **säger det**: "5 frånvarande kommer inte med. Du kan lägga till dem under Hantera indelningar." |
| Utan inklistrade ark (exemplet visas) | De **riktiga** indelningarna visas och går att skapa och ändra. Eleverna hämtas från de senast inklistrade arken. |
| Gruppnamnet i Excel | En **ny kolumn Gruppnamn**. Kolumnen Grupp behåller numret. |
| Uppdatera indelningen när passet visar andra klasser | **Tillåts**. Bara eleverna i passets tabell flyttas; övriga ligger kvar i sina grupper. Rutan före sparningen säger vad som ändras. |
| Frånvarandes platser i passet | **Sparas** (de syns inte). En elev som kryssas i sent hamnar direkt i sin grupp. Spara som indelning från ett sådant pass tar med alla. |

Ordet i UI:t är **indelning** ("Sparade indelningar", "Lägg på indelning",
"Spara som indelning"). "Mall" används bara i koden (`GroupTemplate`).

## 3. Datamodell

### 3.1 Indelningarna

```ts
/** En elev i en sparad indelning. `name` är namnet i arket, utan klasstillägg. */
export type TemplateMember = { name: string; klass: string };

export type TemplateGroup = { name: string; members: TemplateMember[] };

export type GroupTemplate = {
  id: string;          // slumpat, ändras aldrig (se nedan)
  name: string;        // högst 40 tecken, cleanPassName-stil
  groups: TemplateGroup[];
  updatedAt: string;   // ISO, för sorteringen i listan
};
```

- `klass` är arket eleven kom från när hen lades in (`''` för tabell utan
  klass). Den används bara för att skilja två elever med samma namn åt; se
  matchningen i avsnitt 4.
- `name` sparas **utan** tillägget " (Rosa)" som `combineSheets` sätter på
  dubbletter. Tillägget beror på vilka ark som finns just den veckan och är
  inte en del av namnet.
- Ett tomt gruppnamn betyder "Grupp N" (N = plats). Så blir en omsorterad
  eller borttagen grupp inte fel numrerad.
- `id` skapas som i `src/utils/mindmap/mindmapTree.ts:38`:
  `crypto.randomUUID` när den finns, annars en reserv. `randomUUID` saknas i
  äldre Safari på iOS och kräver en säker kontext.
- `renameClass` (`narvaroDocs.ts`) byter också `klass` i indelningarnas
  medlemmar, även när en tabell utan klass (`''`) får ett namn. Annars
  faller matchningen tillbaka på bara namnet, och vid namnkrockar blir
  eleverna oplacerade utan att någon ser varför.
- Gränser: högst 50 indelningar, 30 grupper per indelning, gruppnamn högst
  30 tecken. Allt kontrolleras i `sanitizeTemplates`.

### 3.2 Var de sparas: ett eget dokument `grupper`

`NarvaroData` får `templates: GroupTemplate[]`. De sparas krypterade i ett
**eget dokument med nyckeln `grupper`**: `{ templates: GroupTemplate[] }`.

Varför inte i `settings` (stämplarna):

- En flik med äldre kod läser `settings` med `sanitizeSettingsDoc`, som bara
  behåller `stamps`. Ändrar den fliken en stämpel skrivs `settings` om utan
  indelningarna, och de försvinner tyst. Ett okänt dokument (`grupper`) rör
  den äldre koden däremot inte alls: `enterReady` hoppar över nycklar som
  varken är `settings` eller veckor, och `documentsToSave` lägger bara till
  veckor.
- Med ett eget dokument blir det inte 409 mellan en stämpel på en enhet och
  en indelning på en annan.
- Veckodokument gallras efter 365 dagar; `grupper` ska inte göra det, och
  backend gallrar bara dokument med `week_start`.

Det kräver en ändring i backend (avsnitt 7). Dokumentet räknas in i
`MAX_DOCUMENTS_PER_USER = 80` (52–53 veckor + `keyinfo` + `settings` +
`grupper`), vilket ryms. 20 indelningar med 30 elever är några kB, långt
under `MAX_PAYLOAD_BYTES` (256 kB).

`documentsToSave` lägger bara med `grupper` när det finns minst en
indelning eller dokumentet redan finns på servern (`knownKeys`). Då skickar
en frontend som gått ut före backend aldrig den okända nyckeln förrän någon
faktiskt sparar en indelning. Tas den sista indelningen bort sparas ett tomt
`{ templates: [] }`, så att den borttagna inte ligger kvar.

Sparar någon en indelning innan backend godkänner nyckeln blir det värre
än ett enstaka fel; se avsnitt 7.

En konflikt (409) på `grupper` hanteras som på de andra dokumenten. Väljer
användaren att läsa in på nytt (`refresh(true)`) går det som inte sparats
förlorat. Redigeringen (5.2) är därför öppen med sin kopia tills just
`grupper` är sparat. Hookens `saveStatus` gäller alla dokument tillsammans,
så ett veckodokument i `pending` eller `error` skulle hålla redigeringen
öppen i onödan. `useNarvaroSync` exponerar därför också status per nyckel
(`statusOf(key)`, ur `statuses.current`, som redan finns). Vid konflikt
står det i redigeringen att ändringen måste göras om efter inläsningen.

### 3.3 Passets grupper

`GroupsStore` utökas, bakåtkompatibelt:

```ts
export type PassGroups = {
  groups: string[][];
  /** Gruppernas namn, samma ordning som `groups`. Tomt = "Grupp N". */
  names?: string[];
  /** Indelningen grupperna lades på från (`GroupTemplate.id`). */
  from?: string;
};
export type GroupsStore = Record<string, PassGroups>;
```

- `sanitizeGroups` läser `names` (strängar, kortas, fylls ut eller kortas
  till samma längd som `groups`) och `from` (sträng eller utelämnas).
- `moveToGroup`, Ny grupp och Ta bort grupp håller `names` i takt med
  `groups` (ny hjälpfunktion `removeGroup(pg, i)` och `addGroup(pg)`).
- Slumpa grupper och Tomma grupper tar bort `names` och `from`: det är inte
  längre indelningens grupper.
- "Från: X" visas bara om indelningen `from` finns kvar. En borttagen
  indelning lämnar passets grupper och namn orörda men utan "Från".

Passets namn på grupperna är en kopia, så att en indelning som döps om eller
tas bort inte ändrar ett pass i efterhand.

Passets grupper innehåller efter Lägg på även de frånvarande (4.2).
`groupsForDate` (`narvaroMobile.ts:108–125`) räknar i dag `count` på alla
namn i grupperna, så mobilens "Grupper finns för … 28 st" skulle visa hela
indelningen. Den räknar i stället de närvarande i passet, med samma
`roster` som sidan.

## 4. Logik: `src/utils/narvaroTemplates.ts` (ren, med tester)

En ny fil, så att `narvaro.ts` (769 rader) inte växer.

### 4.1 `baseName(person)`

Namnet utan det klasstillägg `combineSheets` satt: om `person.klass` finns
och namnet slutar på ` (${klass || 'utan klass'})` tas det bort. Ett namn
som självt har parentes (utan att det är klassen) lämnas.

### 4.2 `applyTemplate(template, people)` → `PassGroups`

`people` är **alla** i passets tabell för de visade klasserna
(`table.people`), inte bara de närvarande. Passet sparar alltså även
frånvarandes platser; `groupView` visar som i dag bara de aktiva
(närvarande och inte uteslutna) och lägger övriga närvarande i Inte
indelade. Det gör att en elev som kommer sent och kryssas i eller läggs
till för hand hamnar i sin grupp direkt.

Matchningen görs i **två varv**, så att resultatet inte beror på i vilken
ordning grupperna står:

1. **Varv 1, namn och klass**, för alla medlemmar: den person vars
   `baseName` och `klass` är lika medlemmens.
2. **Varv 2, bara namn**, för medlemmarna som inte matchades i varv 1. En
   medlem matchas bara om basnamnet är **entydigt på båda sidor**: exakt en
   person i passets tabell har det (räknat innan något placerats), och exakt
   en av de återstående medlemmarna har det. Personen får inte redan vara
   placerad i varv 1. Annars matchas ingen (hellre Inte indelade än fel
   grupp).
3. En person placeras högst en gång. Står hen i två grupper i indelningen
   vinner den första.
4. Två personer med samma namn i **samma** ark får samma visningsnamn
   ("Ali (Rosa)") och kan inte skiljas åt. Namnet står bara en gång i
   grupperna. `groupView` identifierar eleverna med strängen, så den andra
   syns inte alls i gruppvyn, inte ens i Inte indelade. Det är en känd
   begränsning sedan tidigare och rättas inte här.

Klassvalet: innan indelningen läggs på väljer sidan de klasser som
indelningens medlemmar finns i (bland de klasser som har ark den dagen),
utöver de som redan visas, och grupperna sparas under den nya `gKey`. Det
görs i `Narvaro.tsx` på samma sätt som när mobilen byter till ett annat
pass grupper (`setChosen`). Den rena delen,
`templateClasses(template, sheets, day)`, ligger i `narvaroTemplates.ts`.

Resultat: `{ groups: personnamn per grupp (det namn sidan använder, med
eventuellt tillägg), names: gruppnamnen, from: template.id }`. Antalet
grupper är alltid indelningens, även när en grupp blir tom.

### 4.3 `templateFromPass(name, pass, people)` → `GroupTemplate`

"Spara som indelning": passets grupper (alla namn som sparats i passet,
även frånvarandes) blir medlemmar `{ baseName, klass }`. Gruppnamnen tas
från `pass.names`. Inte indelade tas inte med.

- Ett namn i passets grupper som **inte finns i `table.people`** (arket har
  klistrats in på nytt med ett rättat namn, eller gruppen är gammal) sparas
  med `klass: ''` och `baseName` räknat på strängen. Det markeras sedan som
  saknat i redigeringen om det inte finns i något ark.
- Funktionen returnerar också `absent: number`, antalet i passets tabell som
  varken står i en grupp eller i Inte indelade (frånvarande som aldrig
  placerats). Rutan säger då "5 frånvarande kommer inte med. Du kan lägga
  till dem under Hantera indelningar." Ett pass som fått grupperna genom
  Lägg på har frånvarandes platser, så där blir det 0.

### 4.4 `updateTemplateFromPass(template, pass, people)` → `GroupTemplate`

"Uppdatera indelningen":

- Medlemmar som **finns i passets tabell** får passets placering. Står de i
  Inte indelade i passet tas de bort ur indelningen.
- Medlemmar som **inte finns i passets tabell** (andra klasser, slutat)
  stannar i sin grupp, räknat på plats.
- Har passet färre grupper än indelningen och en borttagen grupp hade
  medlemmar utanför passet, tas de bort. Funktionen returnerar också
  `dropped: TemplateMember[]`, så att frågan före sparningen kan säga
  "2 elever som inte finns i passet tas bort ur indelningen".
- Gruppnamnen blir passets.
- Det fungerar även när passet visar andra klasser än indelningen har:
  bara eleverna i passets tabell flyttas. Rutan före sparningen säger hur
  många som flyttas, tas bort och ligger kvar orörda.
- Ett namn i passets grupper som inte finns i `table.people` behandlas som
  i 4.3.

### 4.5 Övrigt

- `missingMembers(template, sheets)`: medlemmar vars namn inte finns i
  något ark (`knownClasses`). Används för markeringen i redigeringen. Ett
  ark ligger kvar i `knownClasses` så länge dess vecka finns, upp till 365
  dagar. Elever i en klass som inte klistrats in på länge (till exempel
  förra läsårets) markeras därför inte som saknade förrän veckan gallrats.
  Det är godtagbart.
- `memberLabels(members, sheets)`: visningsnamn för redigeringen (5.2), se
  där.
- `templatePool(template, people)`: de i de valda klasserna som inte är med
  i indelningen (Inte indelade i redigeringen).
- `renameTemplate`, `removeTemplate`, `upsertTemplate`, `sortTemplates`
  (senast ändrad först).
- `groupTitle(names, i)`: `names?.[i] || \`Grupp ${i + 1}\``. Används överallt
  där "Grupp N" i dag skrivs ut.
- `sanitizeTemplates(raw)`: släpper allt som inte har rätt form, kortar namn,
  tar bort tomma medlemsnamn och dubbletter inom en indelning, högst 50.

### 4.6 Testfall (`narvaroTemplates.test.ts`)

- Närvarande i indelningen hamnar i sin grupp; frånvarande sparas i passet
  men syns inte i `groupView`.
- Närvarande som inte finns i indelningen hamnar i Inte indelade.
- En grupp där alla är frånvarande blir tom men finns kvar.
- Elev som bytt klass (samma namn, annan `klass`) matchas på namnet.
- Två elever med samma namn i olika klasser, båda i passet: matchas på
  klassen. Bara den ena i indelningen och klassen stämmer inte: ingen
  matchas.
- Dubbletter i passet med klasstillägget "Ali (Rosa)" matchas mot
  medlemmen `{ name: 'Ali', klass: 'Rosa' }`.
- `baseName` lämnar "Anna (Lisa)" när klassen inte är Lisa.
- En elev i två grupper i indelningen placeras bara i den första.
- Ordningen spelar ingen roll: indelningen har G1 {Ali, Grön} (bytt klass)
  och G2 {Ali, Rosa}; passet har bara Ali i Rosa. Ali hamnar i G2.
- Två medlemmar med samma basnamn, bara en person med det namnet i passet
  och klassen stämmer för ingen: ingen matchas.
- Två elever med samma namn i samma ark ("Ali (Rosa)" två gånger): namnet
  står en gång i grupperna, och `groupView` visar det en gång (den andra
  syns inte; känd begränsning).
- En grupp vars medlemmar alla saknas i passets tabell finns kvar, tom.
- `templateClasses` ger indelningens klasser som har ark den dagen.
- `templateFromPass` → `applyTemplate` på samma pass ger samma grupper och
  namn (rundtur).
- `updateTemplateFromPass` behåller medlemmar från en annan klass, tar bort
  den som flyttats till Inte indelade, rapporterar `dropped`. Även när
  passets klassval är ett annat än indelningens.
- `templateFromPass` och `updateTemplateFromPass` med ett namn som inte
  finns i `table.people`: sparas med `klass: ''`. `absent` räknas rätt.
- `memberLabels`: två "Ali" ur olika klasser får olika visningsnamn och
  översätts tillbaka till rätt medlem. En medlem som också finns i arket
  får inget tillägg.
- `missingMembers` hittar namn som inte finns i något ark.
- `sanitizeTemplates`: skräp, för långa namn, för många indelningar,
  saknade fält, `groups` som inte är en lista.
- `sanitizeGroups` (i `narvaro.test.ts`): gammalt pass utan `names`/`from`
  läses som förut; `names` med fel längd rättas.
- `renameClass` (i `narvaroDocs.test.ts`): `klass` i indelningarna följer
  med, även från `''`.
- `documentsToSave`: ett tomt `grupper` skickas när den sista indelningen
  tagits bort och dokumentet är känt; inget skickas när det aldrig funnits.
- `groupsForDate` räknar de närvarande, inte alla i grupperna.

## 5. UI på datorn

Allt nytt läggs i egna filer i `components/narvaro/`. I `Narvaro.tsx` blir
det bara kopplingar (state, anrop till utils), enligt CLAUDE.md.

### 5.1 I läget Grupper (för passet)

I verktygsraden bredvid **Slumpa grupper**:

- **Lägg på indelning ▾** (`NarvaroTemplateMenu.tsx`): en lista med
  indelningarna, senast ändrad först, med antal grupper och elever. Ett val
  lägger på indelningen. Har passet redan grupper frågar en dialog först:
  "Passet har redan grupper. Ersätta dem med Labbgrupper NA1?" Har
  indelningen elever i klasser som inte visas väljs de klasserna först
  (4.2). Frågan om att ersätta gäller grupperna under den nya `gKey`. Sist
  i listan: **Hantera indelningar…** (5.2).

Ovanför grupperna, när passet har grupper:

- **Från: Labbgrupper NA1** (om `from` finns kvar) och knappen **Uppdatera
  indelningen**. Den visar en bekräftelse med vad som ändras (`dropped`).
- **Spara som indelning…**: en liten ruta för namnet. Finns redan en
  indelning med samma namn frågar den om den ska skrivas över. Är `absent`
  större än 0 (4.3) står det i rutan att de frånvarande inte kommer med.
  Efter sparningen får passet `from` satt till den nya indelningen.

`NarvaroGroups` får gruppnamnen (`names`) och visar `groupTitle` i stället
för "Grupp {i + 1}". Gruppnamnet i ett pass ändras inte i passet i detta
steg; det görs i indelningen (se avsnitt 10).

### 5.2 Hantera indelningar

En egen vy i sidans gruppdel (`NarvaroTemplates.tsx`), som ersätter passets
grupper medan den är öppen. Den är **inte** en dialog ovanpå passets
grupper: `NarvaroGroups` lyssnar på `pointerdown` på hela dokumentet, och två
instanser samtidigt skulle båda reagera på ett drag.

I dag ritas gruppdelen bara när `mode === 'groups' && view`
(`Narvaro.tsx:1050`). Hantera-vyn ritas **oberoende av passets `view`**, så
att den går att öppna för ett pass utan grupper, och utan ark alls. Den är
en egen fil som tar blockets plats; `Narvaro.tsx` får bara ett villkor och
props, inga fler grenar.

- **Listan**: namn, antal grupper och elever, senast ändrad. Knappar: Öppna,
  Byt namn, Ta bort (med fråga). **Ny indelning** överst.
- **Redigeringen** av en indelning:
  - Namnfält för indelningen.
  - Klassval (samma knappar som `NarvaroClassPicker`) som bestämmer vilka
    elever som visas i **Inte indelade**. Förval: klasserna som har elever i
    indelningen, annars de klasser som visas på sidan. Eleverna hämtas från
    **det senast inklistrade arket per klass** (`latestSheets` över alla
    veckor), inte bara den här veckans, så att det fungerar innan veckans
    ark är inklistrat.
  - **Namnen i redigeringen.** `NarvaroGroups` känner bara strängar
    (`data-gname`, `moveToGroup`, `uniquePrefixMatch` över `pool`), medan en
    medlem är `{ name, klass }`. `memberLabels(members, sheets)` ger varje
    medlem och varje elev i de valda arken ett visningsnamn: namnet, och
    " (Klass)" efter det bara när samma basnamn finns med **mer än en
    klass** bland indelningens medlemmar och de valda arkens elever. Det
    räknas på olika par (basnamn, klass), så en medlem som också finns i
    arket räknas en gång och får inget tillägg. Redigeringen arbetar med visningsnamnen och översätter
    tillbaka med en `Map` när den sparar. Får två medlemmar ändå samma
    visningsnamn (samma namn och klass, en dubblett) slås de ihop till en
    medlem; `sanitizeTemplates` tar redan bort sådana dubbletter.
  - Samma `NarvaroGroups` som för passet (dra, tryck, siffertangent, fyll i
    namn), med **gruppnamn som går att ändra** (ett fält i gruppens rubrik,
    tomt = "Grupp N"), Ny grupp och Ta bort grupp.
  - Elever ur andra klasser än de valda visas i sina grupper som vanligt.
  - **Saknas i arken**: namn som `missingMembers` hittar visas i sin grupp
    med en markering ("finns inte i något ark") och en knapp **Ta bort
    saknade** överst.
  - Redigeringen ändrar en kopia; **Spara** skriver indelningen,
    **Avbryt** lämnar den orörd. Att stänga sidan med osparad redigering
    varnar inte (det är inte data som väntar på servern), men Spara är
    tydlig. Efter Spara är redigeringen öppen tills sparningen bekräftats
    (3.2).
- Indelningen kan sparas utan att något pass är valt. **När exemplet visas**
  (inga ark finns) visar och sparar Hantera indelningar ändå de **riktiga**
  indelningarna, inte exemplets. Utan några ark alls finns inga elever att
  välja, och vyn säger att ett ark behöver klistras in först; befintliga
  indelningar går ändå att byta namn på och ta bort. I exemplets egna pass
  läggs riktiga indelningar inte på, eftersom exemplets elever inte finns i
  dem.

`NarvaroGroups` behöver alltså nya valfria props: `names`,
`onRenameGroup?`, `missing?: ReadonlySet<string>`. Utan dem ser den ut som i
dag.

### 5.3 Det som följer med gruppnamnen

Där "Grupp N" skrivs i dag används `groupTitle`:

- `groupsText` (Kopiera grupperna)
- `sessionRows`/`sessionText` (Kopiera noteringar): `SessionRow.group`
  behåller numret (`number | null`), och ett nytt fält `groupName` får
  `groupTitle`. Texterna skriver `groupName`.
- `narvaroExport.ts`: `Unit` i `unitsFor` (rad 103–114) bär i dag bara
  `groups: string[][]` och får också `names`. Text och Kopiera till Google
  Dokument visar gruppens namn.
- **Excel**: kolumnen **Grupp** behåller numret, så att sortering och
  filter fungerar som förut. En **ny kolumn Gruppnamn** står direkt efter.
  `narvaro-excel.md` får en rad om det.
- `mobileSections` i `narvaroMobile.ts`.

## 6. Mobilen

- När passet saknar grupper visar `MobileGroupChoices` (som i dag visar
  andra pass grupper samma dag) också **Lägg på sparad indelning**: en
  knapp per indelning, minst 44 px hög. Ett tryck väljer indelningens
  klasser (4.2), lägger på den och byter till vyn Grupper. Ingen fråga
  behövs, eftersom passet saknar grupper. (Har den nya `gKey` redan grupper
  visas de i stället, utan att något ersätts.)
- `MobileGroupChoices` returnerar i dag `null` när `choices` är tom
  (`NarvaroMobileGroups.tsx:18`). Spärren ändras så att indelningarna
  visas även när inget annat pass har grupper. De två listorna har var sin
  rubrik: "Grupper finns för" och "Sparade indelningar".
- Indelningarna står senast ändrad först. Fem visas, och **Visa alla (15)**
  fäller ut resten.
- Gruppvyn visar gruppernas namn.
- Att skapa, redigera, spara som och uppdatera görs bara på datorn.

## 7. Backend (`Saibot57/drive_c_backend`)

- `api/narvaro_routes.py`: `FIXED_KEYS = ('keyinfo', 'settings', 'grupper')`.
  `_week_start` ger då `None` och dokumentet gallras aldrig.
- Kommentaren vid `MAX_DOCUMENTS_PER_USER` nämner `grupper`. Gränsen 80
  behöver inte ändras. Felet vid gränsen säger "sparade veckor"; det kan stå
  kvar.
- Test i `tests/test_narvaro.py`: PUT/GET av `grupper` med version 0 och 1,
  att det inte gallras av `_purge_expired`, och att en annan okänd nyckel
  fortfarande ger 400.
- Ingen migration: tabellen har redan `week_start` som kan vara `NULL`.
- **Ordning: backend först, och det är inte valfritt.** Frontend fungerar
  utan den så länge ingen sparar en indelning (3.2). Sparar någon en
  indelning mot gammal backend svarar den 400 ("Ogiltig dokumentnyckel").
  Det blir status `error`, inte `conflict`, och `saveQueue` behåller
  sparningen och försöker igen var 8:e sekund utan slut. `hasUnsaved()` är
  då sant hela tiden, så att
  - `refresh` aldrig mer hämtar ändringar från andra enheter
    (`if (!force && q.hasUnsaved()) return` i `useNarvaroSync.ts`), och
  - `beforeunload` varnar varje gång sidan stängs.

  Det skrivs i backendens `DEPLOY.md`, med följden ovan.

## 8. Migrering

- **Passens grupper**: ingen migrering. Gamla `{ groups }` läses som förut;
  `names` och `from` saknas och ger "Grupp N" och ingen "Från".
- **Inga befintliga indelningar** finns att föra över. Spara som indelning
  på ett pass är vägen för grupper man redan gjort.
- **Inget i localStorage.**
- **Äldre flikar**: en flik med gammal kod som sparar en vecka släpper
  `names` och `from` ur passets grupper (`sanitizeGroups` känner inte till
  dem). Det är samma risk som när `passNames` kom och går över när fliken
  laddas om. Indelningarna själva rörs inte (3.2).

## 9. Steg

- [x] **1. Backend**: `grupper` i `FIXED_KEYS`, test, `DEPLOY.md`. Egen PR i
  backend. Byggd 2026-11-26 (backend #61).
- [ ] **2. Logik**: `src/utils/narvaroTemplates.ts` med tester (avsnitt 4).
  `PassGroups` med `names`/`from` och `sanitizeGroups` i `narvaro.ts`, med
  tester. `addGroup`/`removeGroup`/`moveToGroup` håller `names` i takt.
- [ ] **3. Sparning**: `templates` i `NarvaroData`, `grupper` i
  `narvaroDocs.ts` (`documentsToSave`, `sanitizeGrupperDoc`, `mergeWeeks`,
  `renameClass`) och i `useNarvaroSync` (`enterReady`, `statusOf(key)`). Tester i
  `narvaroDocs.test.ts`: inget `grupper` utan indelningar och utan känd
  nyckel; tomt `grupper` när den sista tagits bort; rundtur; `renameClass`.
- [ ] **4. Gruppnamnen syns**: `groupTitle` i `NarvaroGroups`,
  `groupsText`, `sessionRows` (`groupName`), `narvaroExport` (`Unit.names`,
  Excel-kolumnen Gruppnamn), `narvaroMobile` (även `groupsForDate` räknar
  närvarande). Testerna för texterna uppdateras.
- [ ] **5. Datorn, passet**: Lägg på indelning (med fråga), Från, Spara som
  indelning, Uppdatera indelningen.
- [ ] **6. Datorn, hantera**: listan och redigeringen (5.2).
- [ ] **7. Mobilen**: Lägg på sparad indelning i `MobileGroupChoices`.
- [ ] **8. Prov** i webbläsaren (avsnitt 11).

PR:er: steg 2–3 i en, **steg 4 i en egen liten PR** (den ändrar
textformaten och Excel, som Tobias redan provar i `narvaro-excel.md`, och
ska kunna provas för sig), och 5–7 i en tredje. Varje steg ska klara
`tsc`, `lint`, `test` och `build`.

## 10. Det som inte ingår (kan bli senare tillägg)

- Förval: en indelning som föreslås eller läggs på automatiskt för ett
  återkommande pass (passnamn eller schemapass).
- Jämna ut grupper som blivit ojämna av frånvaron.
- Fördela närvarande som saknas i indelningen till grupperna.
- Byta namn på en grupp direkt i ett pass utan att gå via en indelning.
- Skapa och redigera indelningar på mobilen.

## 11. Prov i webbläsaren

1. Gör grupper i ett pass, Spara som indelning. Öppna ett annat pass med
   samma klass och några frånvarande, Lägg på indelning: de närvarande står
   i sina grupper, frånvarande syns inte, "Från: …" visas.
2. Kryssa i en frånvarande: hen dyker upp i sin grupp.
3. Lägg till en elev för hand som inte finns i indelningen: hen står i Inte
   indelade.
4. Flytta en elev i passet: indelningen är orörd (öppna den). Uppdatera
   indelningen: nu är den ändrad.
5. Lägg på en indelning på ett pass som har grupper: frågan kommer.
6. Ny indelning från grunden med två klasser, egna gruppnamn. Namnen syns i
   passet, i Kopiera grupperna, i noteringsexporten och i Excel.
7. Ta bort en elev ur ett ark (eller använd ett namn som inte finns): hen
   markeras som saknad i redigeringen, Ta bort saknade fungerar.
8. Mobilen: pass utan grupper, Lägg på sparad indelning, gruppvyn visar
   gruppnamnen.
9. Två enheter: spara en indelning på den ena, ladda om den andra: den
   finns där. Ändra samtidigt: den andra får konflikt, inte tyst
   överskrivning, och redigeringen säger att ändringen måste göras om.
10. Byt namn på och ta bort en indelning; ett pass som kom från den behåller
    sina grupper men visar inte längre "Från".
11. Indelning med NA1 + NA2, passet visar bara NA1: Lägg på väljer NA2 också
    och alla placeras. Uppdatera indelningen från ett pass med bara NA1
    lämnar NA2:s elever orörda.
12. Spara som indelning från ett slumpat pass med frånvarande: rutan säger
    hur många som inte kommer med.
13. Utan ark (exemplet visas): Hantera indelningar visar de riktiga
    indelningarna.
14. Byt namn på en klass: dess elever placeras fortfarande rätt.

## 12. Avvikelser från planen

(Fylls i av den session som bygger.)
