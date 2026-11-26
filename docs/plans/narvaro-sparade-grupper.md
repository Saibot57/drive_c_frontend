# Närvarorutor: sparade gruppindelningar

Status: Planerad

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

Ordet i UI:t är **indelning** ("Sparade indelningar", "Lägg på indelning",
"Spara som indelning"). "Mall" används bara i koden (`GroupTemplate`).

## 3. Datamodell

### 3.1 Indelningarna

```ts
/** En elev i en sparad indelning. `name` är namnet i arket, utan klasstillägg. */
export type TemplateMember = { name: string; klass: string };

export type TemplateGroup = { name: string; members: TemplateMember[] };

export type GroupTemplate = {
  id: string;          // slumpat (crypto.randomUUID), ändras aldrig
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
faktiskt sparar en indelning.

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

Matchning per medlem, grupp för grupp i ordning:

1. **Namn och klass**: den person vars `baseName` och `klass` är lika
   medlemmens.
2. **Bara namn**: annars den enda oanvända person vars `baseName` är lika.
   Finns flera med samma namn i andra klasser matchas ingen (hellre Inte
   indelade än fel grupp).
3. En person placeras högst en gång. Står hen i två grupper i indelningen
   vinner den första.

Resultat: `{ groups: personnamn per grupp (det namn sidan använder, med
eventuellt tillägg), names: gruppnamnen, from: template.id }`. Antalet
grupper är alltid indelningens, även när en grupp blir tom.

### 4.3 `templateFromPass(name, pass, people)` → `GroupTemplate`

"Spara som indelning": passets grupper (alla namn som sparats i passet,
även frånvarandes) blir medlemmar `{ baseName, klass }`. Gruppnamnen tas
från `pass.names`. Inte indelade tas inte med.

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

### 4.5 Övrigt

- `missingMembers(template, sheets)`: medlemmar vars namn inte finns i
  något ark (`knownClasses`). Används för markeringen i redigeringen.
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
- `templateFromPass` → `applyTemplate` på samma pass ger samma grupper och
  namn (rundtur).
- `updateTemplateFromPass` behåller medlemmar från en annan klass, tar bort
  den som flyttats till Inte indelade, rapporterar `dropped`.
- `missingMembers` hittar namn som inte finns i något ark.
- `sanitizeTemplates`: skräp, för långa namn, för många indelningar,
  saknade fält, `groups` som inte är en lista.
- `sanitizeGroups` (i `narvaro.test.ts`): gammalt pass utan `names`/`from`
  läses som förut; `names` med fel längd rättas.

## 5. UI på datorn

Allt nytt läggs i egna filer i `components/narvaro/`. I `Narvaro.tsx` blir
det bara kopplingar (state, anrop till utils), enligt CLAUDE.md.

### 5.1 I läget Grupper (för passet)

I verktygsraden bredvid **Slumpa grupper**:

- **Lägg på indelning ▾** (`NarvaroTemplateMenu.tsx`): en lista med
  indelningarna, senast ändrad först, med antal grupper och elever. Ett val
  lägger på indelningen. Har passet redan grupper frågar en dialog först:
  "Passet har redan grupper. Ersätta dem med Labbgrupper NA1?" Sist i
  listan: **Hantera indelningar…** (5.2).

Ovanför grupperna, när passet har grupper:

- **Från: Labbgrupper NA1** (om `from` finns kvar) och knappen **Uppdatera
  indelningen**. Den visar en bekräftelse med vad som ändras (`dropped`).
- **Spara som indelning…**: en liten ruta för namnet. Finns redan en
  indelning med samma namn frågar den om den ska skrivas över. Efter
  sparningen får passet `from` satt till den nya indelningen.

`NarvaroGroups` får gruppnamnen (`names`) och visar `groupTitle` i stället
för "Grupp {i + 1}". Gruppnamnet i ett pass ändras inte i passet i detta
steg; det görs i indelningen (se avsnitt 10).

### 5.2 Hantera indelningar

En egen vy i sidans gruppdel (`NarvaroTemplates.tsx`), som ersätter passets
grupper medan den är öppen. Den är **inte** en dialog ovanpå passets
grupper: `NarvaroGroups` lyssnar på `pointerdown` på hela dokumentet, och två
instanser samtidigt skulle båda reagera på ett drag.

- **Listan**: namn, antal grupper och elever, senast ändrad. Knappar: Öppna,
  Byt namn, Ta bort (med fråga). **Ny indelning** överst.
- **Redigeringen** av en indelning:
  - Namnfält för indelningen.
  - Klassval (samma knappar som `NarvaroClassPicker`) som bestämmer vilka
    elever som visas i **Inte indelade**. Förval: klasserna som har elever i
    indelningen, annars de klasser som visas på sidan.
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
    tydlig.
- Indelningen kan sparas utan att något pass är valt och fungerar även i
  exemplet, där den bara ligger i minnet som exemplets andra data.

`NarvaroGroups` behöver alltså nya valfria props: `names`,
`onRenameGroup?`, `missing?: ReadonlySet<string>`. Utan dem ser den ut som i
dag.

### 5.3 Det som följer med gruppnamnen

Där "Grupp N" skrivs i dag används `groupTitle`:

- `groupsText` (Kopiera grupperna)
- `sessionRows`/`sessionText` (Kopiera noteringar): `group` blir gruppens
  titel i stället för numret, eller numret och titeln intill varandra.
- `narvaroExport.ts`: text, Kopiera till Google Dokument och Excel-kolumnen
  **Grupp** visar gruppens namn.
- `mobileSections` i `narvaroMobile.ts`.

## 6. Mobilen

- När passet saknar grupper visar `MobileGroupChoices` (som i dag visar
  andra pass grupper samma dag) också **Lägg på sparad indelning**: en
  knapp per indelning, minst 44 px hög. Ett tryck lägger på den och byter
  till vyn Grupper. Ingen fråga behövs, eftersom passet saknar grupper.
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
- **Ordning**: backend först. Frontend fungerar utan den så länge ingen
  sparar en indelning (3.2), men då ger sparningen ett fel. Antecknas i
  backendens `DEPLOY.md`.

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

- [ ] **1. Backend**: `grupper` i `FIXED_KEYS`, test, `DEPLOY.md`. Egen PR i
  backend.
- [ ] **2. Logik**: `src/utils/narvaroTemplates.ts` med tester (avsnitt 4).
  `PassGroups` med `names`/`from` och `sanitizeGroups` i `narvaro.ts`, med
  tester. `addGroup`/`removeGroup`/`moveToGroup` håller `names` i takt.
- [ ] **3. Sparning**: `templates` i `NarvaroData`, `grupper` i
  `narvaroDocs.ts` (`documentsToSave`, `sanitizeGrupperDoc`, `mergeWeeks`)
  och i `useNarvaroSync` (`enterReady`). Tester i `narvaroDocs.test.ts`:
  inget `grupper` utan indelningar och utan känd nyckel; rundtur.
- [ ] **4. Gruppnamnen syns**: `groupTitle` i `NarvaroGroups`,
  `groupsText`, `sessionRows`, `narvaroExport`, `narvaroMobile`. Testerna
  för texterna uppdateras.
- [ ] **5. Datorn, passet**: Lägg på indelning (med fråga), Från, Spara som
  indelning, Uppdatera indelningen.
- [ ] **6. Datorn, hantera**: listan och redigeringen (5.2).
- [ ] **7. Mobilen**: Lägg på sparad indelning i `MobileGroupChoices`.
- [ ] **8. Prov** i webbläsaren (avsnitt 11).

Steg 2–4 kan bli en PR och 5–7 en till. Varje steg ska klara
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
   finns där. Ändra samtidigt: den andra får konflikt, inte tyst överskrivning.
10. Byt namn på och ta bort en indelning; ett pass som kom från den behåller
    sina grupper men visar inte längre "Från".

## 12. Avvikelser från planen

(Fylls i av den session som bygger.)
