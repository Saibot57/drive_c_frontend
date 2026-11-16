# Närvarorutor: veckokartan överst

Status: Pågår

Skriven 2026-11-16 efter att schemakopplingen byggts
([narvaro-schemakoppling.md](narvaro-schemakoppling.md)). Tobias provade
sidan med sina riktiga ark och ville göra om layouten. Två riktningar
ritades: veckan i en sidopanel till höger (A) och veckan som en karta
överst (B). Tobias valde B. Mock-upen finns som en privat canvas på
claude.ai ("Närvarorutor – ny layout"), bilderna B1–B4 och Veckans ark.
Planen ska gå att lämna till en ny session: det som behövs står här.

## 1. Varför

- Dag- och Pass-chippen säger bara klockslag ("8.30-9.45 B"). Schemat kan
  nu säga vad passet är, och kartan visar det direkt.
- Klistra in-kortet tar toppen av sidan fast det används en gång i veckan
  per klass.
- Veckan ligger i en dialog (Veckan), och Tidigare pass längst ned. Båda
  blir en del av kartan.
- Kartan har arkets egen uppställning: fem dagar i kolumner och en ruta per
  kolumn i arket. Den känns igen utan förklaring.

## 2. Beslut

| Fråga | Beslut |
|---|---|
| Layout | B: ett kort överst med veckan, som ersätter Dag och Pass på datorn. |
| Hopfällning | Knappen "Bara dagen" krymper kartan till den valda dagen på en rad. Läget minns per enhet. |
| Utan schema | Kartan bygger på arkets kolumner och fungerar ändå. Rutorna heter då som passraden i arket. |
| Tidigare veckor | Väljs i kartans veckorad. Hela sidan visar då den veckan och går att redigera som vanligt. Tidigare pass längst ned tas bort. |
| Veckans ark | Klistra in flyttar till en dialog bakom knappen "Veckans ark" i sidhuvudet. Att klistra in var som helst på sidan fungerar som förut. |
| Veckan-dialogen | Tas bort. Kartan ersätter den. |
| Mobilläget | Ändras inte. Mobilens passval behåller Dag- och Pass-chippen. |
| Backend | Ingen ändring. Inget nytt sparas på servern. |

## 3. Kartan (B1)

Ett kort överst, under sidhuvudet.

**Huvudet**, på en rad:
- ‹ Vecka 47 › och en rad med veckorna (avsnitt 6).
- Klass-chippen (flyttade hit från urvalskortet).
- "Bara dagen" / "Visa veckan".

**Rutnätet:** fem kolumner, en per veckodag i arket (`allDays`). Över
varje kolumn står dagen och datumet ("Mån 16/11", "· idag" för i dag) och
länken "Hela dagen". Under står en ruta per kolumn i arket, i arkets
ordning.

**En ruta** visar:
- kolumnens bokstav och tid ("D · 12:30"); tiden är schemapassets start
  när det finns ett, annars arkets klockslag
- titeln: det egna passet bland de valda klassernas, annars det första
  (`sortForDisplay(entriesForClasses(…))`); fetstil när det är användarens
- lärare, och "+N pass" när fler pass hör till kolumnen
- antalet närvarande i arket för de valda klasserna ("5 närv.")
- en prick när passet har noteringar (som pricken i veckovyn i dag)

Utan schema, eller utan pass i schemat för kolumnen, är titeln arkets
passtext och lärarraden tom.

**Ihopslagna rutor:** kolumner i följd samma dag vars enda pass (efter
klassurvalet) är samma heldagspass ur `entriesForDay` blir en ruta
("K–N · 08:30–15:30 Studiebesök i Malmö"). Klick på den väljer Hela dagen,
som `targetForEntry` redan gör.

**Valt pass** är svart. En ruta där ingen är markerad i arket har streckad
kant och dämpad text, som Pass-chippen i dag. Klick väljer dag och pass;
"Hela dagen" väljer dagen.

**Under rutnätet:** en rad med förklaringen (fetstil, prick, +N, streckad)
och "Du i schemat: Kim (ändra)", som öppnar väljaren
(`ScheduleNamePicker`).

## 4. Passkortet

Urvalskortet blir passkortet. Överst ‹ och › för föregående och nästa pass
(i arkets ordning genom veckan, Hela dagen hoppas över), datum och tid i
stor stil, och raden "Enligt schemat" under (`NarvaroScheduleLine`, som i
dag). Till höger Skola-chippen och antalet närvarande. Under en linje
Anteckningar/Grupper och stämplarna som i dag. Namnge passet (pennan)
flyttar hit, bredvid rubriken.

Namnrutorna, Inte markerade, grupperna och Noteringar är oförändrade.

## 5. Hopfälld (B2)

Kartan krymper till en rad:
- v.47 och flikar Mån–Fre
- den valda dagens rutor bredvid varandra, med "Hela dagen" först
- klass-chippen i liten storlek och "Visa veckan"

Läget sparas i `narvaro.weekMap.v1` (`'week' | 'day'`, standard `'week'`),
läst med `usePersistentState` och en `sanitize`-funktion.

## 6. Tidigare veckor (B3)

**Veckoraden** visar veckorna som har ett ark eller noteringar
(`sync.data.tables` och `groupByWeek(historyKeys(…))`), plus den här
veckan, äldst till vänster, och rullar i sidled. Prick = noteringar. En
vecka som snart gallras får påminnelsens färg (`purgeInfo`).

**En annan vecka vald:** hela sidan visar den veckan: kartan med den
veckans ark (`sheetsForWeek`) och schema (`ensureWeek`), och passkortet,
namnrutorna, grupperna och noteringarna för det valda passet där. Allt går
att redigera som vanligt; noteringarna sparas i den veckans dokument,
eftersom nyckeln börjar med passets datum. Datumen räknas från veckans
måndag i stället för från i dag. Överst står en gul rad: "Vecka 46. Det du
ändrar sparas i den veckan." med Kopiera veckan och Till vecka 47.

Noteringar-kortet får Ta bort (tryck två gånger), som Tidigare pass har i
dag. Namnge passet finns redan i passkortet.

Inklistring gäller alltid den här veckan, och efter en inklistring visar
sidan den här veckan igen. Mobilläget visar alltid den här veckan.

Tidigare pass längst ned tas bort. Påminnelsen om gallring ("Visa") byter
i stället till veckan i kartan.

## 7. Veckans ark

Knappen "Veckans ark" i sidhuvudet ersätter "Klistra in tabell" och visar
hur många klasser som har veckans ark ("3 av 3", grön; gul när någon
saknas). Den öppnar en dialog med:
- en rad per klass: status ("✓ Vecka 47 · 11 deltagare från 2 skolor"
  eller "Från vecka 46"), Ta bort och Fel klass?
- rutan att klistra in i, och frågan om klass när namnen inte känns igen
  (`ClassPicker`)
- Visa exemplet

Klistras något in på sidan öppnas dialogen och visar resultatet. Har
användaren inga ark alls visas i stället ett kort på sidan med
instruktionen och knappen, som i dag.

## 8. Logik och filer

Ren logik i `src/utils/narvaroWeekMap.ts` med test:

```ts
type WeekMapCell = {
  pass: PassChoice;          // kolumnens id, eller 'day' för en ihopslagen ruta
  columns: string[];         // kolumnerna rutan står för
  letters: string;           // "D" eller "K–M"
  time: string;              // "12:30" eller "08:30–15:30"
  title: string;
  teachers: string[];
  more: number;              // antal fler pass i kolumnen
  mine: boolean;
  present: number;
  empty: boolean;            // ingen markerad i arket eller tillagd
  hasNotes: boolean;
};
type WeekMapDay = { day: string; date: Date; isToday: boolean; cells: WeekMapCell[] };

weekMapDays(input: {
  sheets: Sheets; allClasses: string[]; chosen: string[]; classNames: string[];
  weekEntries: ScheduledEntry[] | null; myName: string;
  notes: NotesStore; weekKey: string; now: Date;
}): WeekMapDay[]

isCellSelected(cell: WeekMapCell, pass: PassChoice): boolean
adjacentPass(days: WeekMapDay[], day: string, pass: PassChoice, step: -1 | 1): { day: string; pass: PassChoice } | null
mapWeeks(tables, notes, currentWeek): { week: string; hasNotes: boolean }[]
sanitizeWeekMapMode(raw: unknown): 'week' | 'day'
```

Den återanvänder `narvaroSchedule.ts` (`entriesForColumn`,
`entriesForDay`, `entriesForClasses`, `sortForDisplay`, `sessionClasses`)
och `narvaro.ts` (`combineSheets`, `sessionKey`, `noteEntries`).
Pricken räknas som i `sessionForEntry`: noteringar under kolumnens
nyckel från någon av de valda klasserna.

Nya komponenter i `src/components/narvaro/`:
- `NarvaroWeekMap.tsx`: kartan, utfälld och hopfälld.
- `NarvaroSheetsDialog.tsx`: Veckans ark.
- `NarvaroClassPicker.tsx`: `ClassPicker` flyttad ut ur `Narvaro.tsx`.
- `NarvaroPassChips.tsx`: Dag- och Pass-chippen, som bara mobilen
  använder.

Det som tas bort: `NarvaroWeekDialog.tsx`, de två props som lades till i
`PublicTimeGrid.tsx` (filen återställs till hur den var före steg 5 i
schemakopplingen),
Tidigare pass-avsnittet och Klistra in-kortet i `Narvaro.tsx`.
`sessionForEntry` och `shiftWeek` behålls om kartan använder dem, annars
tas de bort med sina test.

`Narvaro.tsx` (~1 350 rader) ska bli mindre, inte större: det som flyttar
ut är fler rader än kopplingen som kommer in.

## 9. Steg

Varje steg avslutas med `pnpm exec tsc --noEmit`, `pnpm lint`, `pnpm test`
och `pnpm build`. Bocka av steget här och uppdatera raden i
`docs/plans/README.md` i samma PR.

- [x] **1. Logiken.** Byggd 2026-11-16, se avsnitt 12. `utils/narvaroWeekMap.ts` med test: rutor per dag,
  ihopslagning av heldagspass, antal, pricken (Olivs notering ger ingen
  prick när bara Rosa visas), utan schema, `adjacentPass` över dagsgränser,
  `mapWeeks`, `sanitizeWeekMapMode`. Testdata ur
  `utils/__fixtures__/narvaroSchedule.ts`.
- [x] **2. Kartan och passkortet** (2026-11-16) på datorn. Klass-chippen till kartan,
  Skola och antalet till passkortet, ‹ › för föregående och nästa pass.
  Mobilen får `NarvaroPassChips`. Veckan-dialogen och props i
  `PublicTimeGrid` tas bort.
- [x] **3. Hopfälld** (2026-11-16) med `narvaro.weekMap.v1`.
- [ ] **4. Veckans ark** som dialog, `ClassPicker` i egen fil.
- [ ] **5. Tidigare veckor.** Hela sidan byter vecka och går att redigera.
  Tidigare pass tas bort, Noteringar får Ta bort, och gallringens "Visa"
  byter vecka i kartan.

## 10. Prov i webbläsaren

Mot riktig backend, i Neo och Kronberg, på en bred och en smal skärm
(1440 och 1024 px).

1. Kartan visar veckans fem dagar med rätt titel, lärare och antal per ruta.
2. Grund vald: Tema Grund i rutorna. Oliv och Rosa valda: det egna passet
   och "+1 pass".
3. Torsdagen med studiebesöket är en ruta; klick väljer Hela dagen.
4. Klick på en ruta byter pass; ‹ och › går genom veckan och över dagar.
5. Skriv en notering: rutan får en prick.
6. Bara dagen: kartan blir en rad, och läget finns kvar efter omladdning.
7. Döp om veckans schema: kartan visar arkets passtexter.
8. Välj en tidigare vecka: sidan visar den veckans ark och noteringar. Ändra
   en notering, ladda om och kontrollera att den finns kvar i rätt vecka.
   Namnge, Ta bort och Kopiera veckan fungerar. Till vecka 47 går tillbaka.
9. Gallringens Visa öppnar rätt vecka.
10. Veckans ark: klistra in en klass, flytta den till en annan klass, ta
    bort veckans ark.
11. Klistra in på sidan utan att öppna dialogen.
12. Mobilläget fungerar som förut.

## 11. Besvarade frågor (2026-11-16)

1. Kartan börjar inte hopfälld under lektionstid. Det sparade läget gäller
   alltid.
2. Ett tidigare pass går att redigera. Hela sidan visar då den veckan
   (avsnitt 6), i stället för det läsläge som först ritades (B3).
3. Veckoraden visar bara veckor som har ett ark eller noteringar, plus den
   här veckan. En vecka med bara ett schema visas inte.

## 12. Avvikelser från planen

Skrivna av sessionen som bygger stegen.

### Steg 1 (2026-11-16)

- `weekMapDays` tar det sparade klassvalet (`chosen`) och alla klasser, och
  räknar varje dags urval med `selectionForDay`, som sidan gör. En klass
  utan pass den dagen faller då bort för dagen också i kartan.
- `adjacentPass` går på kartans rutor i stället för på arkets kolumner, så
  att en ihopslagen ruta är ett steg. `isCellSelected` är ny: en
  ihopslagen ruta är vald när sidans pass är någon av dess kolumner.
- En kolumn utan tid som inte har något pass i schemat slås inte ihop med
  heldagspasset. I v. 47 blir torsdagen därför "K–M" och "N", inte "K–N"
  som i mock-upen.
- Antalet i en ruta räknar också de som lagts till för hand i passet, som
  antalet närvarande på sidan gör.

### Steg 2 och 3 (2026-11-16)

- Byggda i samma commit, eftersom det hopfällda läget är en gren i
  `NarvaroWeekMap.tsx`.
- Kartan visas också för exemplet, med exemplets ark och utan schema.
- Väljaren "Du i schemat" står bara under kartan. Raden "Enligt schemat" i
  passkortet har ingen egen väljare längre.
- Klass-chippen och Skola-chippen ritas av `Narvaro.tsx` och skickas in;
  i mobilens passval står de i `ChipRow` som förut. `ChipRow` flyttade till
  `NarvaroPassChips.tsx` och `chip` till `chip.ts`.
- Hopfälld visar inte rutan Hela dagen när dagen redan har en ihopslagen
  heldagsruta, så att inte två rutor är valda samtidigt.
- `targetForEntry` och `sessionForEntry` togs bort med sina test; bara
  veckodialogen använde dem. `shiftWeek` och `entriesForSession` ligger kvar
  till steg 5.
- Provat i webbläsaren mot ett påhittat API: kartan, ‹ › över dagar,
  studiebesöket som Hela dagen, hopfällt läge kvar efter omladdning, 1024
  px bredd och mobilens passval.
