# Mindmap steg 8: visa bara grenen och presentationsläge

Status: Genomförd 2026-11-11

Det här är detaljplanen för steg 8 i [`mindmap-sida.md`](mindmap-sida.md).
Skyddsreglerna där gäller oförändrade. Steget är det sista för målet och
det som rör mest av det som redan byggts, därför en egen plan och två
delar, var och en en commit som lämnar sidan hel:

- **8a. Visa bara grenen.** En nod visas som rot och resten göms.
- **8b. Presentationsläget.** Kartan stegas fram gren för gren, i helskärm.

Planen är skriven 2026-11-11 mot koden efter steg 7 (grenen
`claude/mindmap-steg-7`: 1 098 rader i `MindmapCanvas.tsx`).

## 1. Beslut

| # | Fråga | Beslut |
|---|---|---|
| 1 | Tangent för presentationsläget | **Alt+P**, och en knapp. Inte `F5`: den laddar om sidan när kartan saknar fokus (den öppna frågan i avsnitt 10 i huvudplanen). Läses med `e.code`. |
| 2 | Tangent för grenvyn | **Alt+Enter** växlar; **Esc** visar hela kartan igen. Gäller också medan man skriver i en nod (skrivandet avslutas först). |
| 3 | Hur grenen ritas | **Som i hela kartan, fast ensam.** Grenen ligger kvar på sin sida (en gren till vänster om roten växer åt vänster), så att förskjutningar, pilar och Alt+pilar betyder samma sak som i hela kartan. Grenens rot ritas som en rot. |
| 4 | Vad som går att göra med grenens rot | Den beter sig som roten: den går inte att ta bort, flytta, dra, dra in eller fälla ihop, och Enter på den ger ett barn. Allt det görs i hela kartan. Försvinner den ändå (ångra) visas hela kartan igen. |
| 5 | Vyn | Grenvyn har en egen, tillfällig vy. Vyn för hela kartan sparas när grenvyn öppnas och kommer tillbaka när den stängs. Bara hela kartans vy skrivs till `mindmap.view.v1`. |
| 6 | Export i grenvyn | **Det som visas exporteras**: bild, PNG, PDF, Markdown och disposition gäller grenen. JSON är alltid hela kartan, eftersom den är en säkerhetskopia. |
| 7 | Tvärlänkar i grenvyn | Bara länkar med båda ändar i grenen ritas. Länkar ut ur grenen finns kvar i dokumentet. |
| 8 | Presentationens steg | Ett steg fäller ut **nästa gren i läsordning** (djupet först). Noder utan barn stegas inte en och en; de kommer fram med sin förälder. Tillbaka fäller ihop det senaste. |
| 9 | Presentationens tangenter | Nästa: mellanslag, högerpil, Enter, PageDown. Tillbaka: vänsterpil, Backspace, PageUp. Nästa och föregående syskongren: ned och upp. Början: Home. Avsluta: Esc. PageDown och PageUp är vad en presentationsfjärr skickar. Klick på en nod fäller ut eller ihop den. |
| 10 | Vad presentationen ändrar | **Ingenting.** Hopfällningen är lokal, inget sparas, ingen ångra-historik. Kartan går inte att redigera i läget. |
| 11 | Helskärm | `requestFullscreen` på kartans ruta, anropat direkt i klicket eller tangenttrycket. Går det inte täcker presentationen kartans ruta på sidan. Lämnar webbläsaren helskärmen (Esc där når aldrig sidan) avslutas presentationen. |
| 12 | Var presentationen börjar | I det som visas: hela kartan, eller grenen om grenvyn är öppen. |

## 2. Utformning

### 2.1 Grenvyn (8a)

En ren funktion, `branchDoc(doc, rootId)` i `utils/mindmapBranch.ts`, ger
ett dokument med noden som rot: barnen får grenens sida, layouten blir
`both` (så att sidan gäller), rotens egen `offset`, `collapsed` och `side`
tas bort, och bara tvärlänkar med båda ändar i grenen följer med. Finns
noden inte, eller är den kartans rot, kommer dokumentet tillbaka orört.

Allt som **ritar** använder det dokumentet: layouten, tvärlänkarnas
geometri, minikartan, bildexporten. Allt som **ändrar** fortsätter arbeta
på hela dokumentet med nodens id, genom `commit` som förut. Det är därför
"redigering fungerar som vanligt": det finns bara ett dokument.

Det som behöver veta om grenen i `MindmapCanvas`:

- `currentId` håller markeringen inom grenen.
- `navigate` körs på grenens dokument, så att pil mot roten stannar.
- `run` behandlar grenens rot som roten (beslut 4), och `outdent` av ett
  barn till grenens rot gör ingenting (det hade lämnat grenen).
- `keyContext` ger `isRoot` och `parentIsRoot` räknat från grenens rot.
- Släpp på tom yta: `placeNode` på hela dokumentet som förut. Syns noden
  inte där (en förfader är hopfälld) läggs förskjutningen på direkt.

Läget och vyns byte ligger i `hooks/useMindmapBranchView.ts`, listen över
kartan i `components/mindmap/MindmapBranchBar.tsx`. `useMindmapViewport`
får en valfri `persist` (förval sant): med falskt skrivs vyn inte till
localStorage, och det som väntade skrivs innan läget byts.

### 2.2 Presentationsläget (8b)

Ren logik i `utils/mindmapPresent.ts`:

- `PresentState = { expanded: string[]; current: string }`.
- `presentStart`, `presentNext`, `presentPrev`, `presentSibling`,
  `presentToggle`, `presentProgress`.
- `presentDoc(doc, state)`: dokumentet som ska ritas, med `collapsed` satt
  efter `expanded`. Rotens barn syns alltid.
- `presentFocus(layout, doc, state)` och `presentView(bounds, focus,
  size)`: var vyn ska stå. Ryms allt som syns i minst 120 % visas allt
  (högst 240 %). Annars visas den aktuella noden med förälder och barn i
  150 %, eller mindre om de inte ryms.

`components/mindmap/MindmapPresent.tsx` ritar med samma delar som kartan
(`MindmapNodeView`, kanterna, `MindmapLinkLayer`) men utan händelser som
ändrar något, i ett lager med `transform` och en mjuk övergång. Helskärmen
och "lämnade helskärmen" ligger i `hooks/useMindmapPresenting.ts`.

### 2.3 Filer

Nya:

```
src/utils/mindmapBranch.ts            (+test)  branchDoc, branchRootId, inBranch
src/utils/mindmapPresent.ts           (+test)  steglogik, presentDoc, presentView
src/hooks/useMindmapBranchView.ts              grenvyns läge och vyns byte
src/hooks/useMindmapPresenting.ts              helskärm och avslut
src/components/mindmap/MindmapBranchBar.tsx    "Visar grenen X"
src/components/mindmap/MindmapPresent.tsx      presentationen
```

Ändrade, alla sidans egna:

- `MindmapCanvas.tsx`: det i 2.1, två tangenter, två knappar, de två nya
  delarna i JSX. Ingen ny logik utöver anropen; räkna med 80–100 rader.
- `useMindmapViewport.ts` (+test): `persist`.
- `useMindmapExport.ts`: `getFileDoc` för JSON.
- `MindmapToolbar.tsx`, `MindmapHelp.tsx`, `mindmap.css`.

Inget utanför `src/components/mindmap/`, sidans hookar och sidans utils
rörs. Den delade kärnan (`src/utils/mindmap/`, `src/types/mindmap.ts`) och
workspace-kortet rörs inte alls.

## 3. Steg

### 8a. Visa bara grenen

- [x] Genomfört: 2026-11-11

**Så blev det.** Nya filer: `utils/mindmapBranch.ts` (+test, 22 st),
`hooks/useMindmapBranchView.ts`, `components/mindmap/MindmapBranchBar.tsx`.
Efter delen: 99 testfiler, 1 574 tester.

- Avvikelse: Delete och Ctrl+X på grenens rot ger ett meddelande i stället
  för att göra ingenting tyst ("Det är grenens rot. Visa hela kartan (Esc)
  …"). Alt+Enter på kartans rot säger också varför inget händer.
- Avvikelse: reglerna för grenens rot (`branchRootAction`), tangenterna
  (`resolveBranchKey`) och förskjutningen utan sidregler (`offsetBy`)
  ligger också i `utils/mindmapBranch.ts`, med test, så att `MindmapCanvas`
  bara anropar dem.
- Avvikelse: `fontOf`, `readPalette`, `canCopyImage` och `copyOutline`
  flyttade oförändrade från `MindmapCanvas.tsx` till
  `components/mindmap/mindmapCanvasIo.ts` (kontrollerat med `diff` mot
  originalet), eftersom tillägget annars hade gått över planens gräns.
- Alt+Enter på en nod inne i en gren visar den noden i stället (en gren i
  grenen); hela kartans vy är ändå den som kommer tillbaka.
- Släpp på tom yta följer hela kartans regler. I layouten `both` kan en nod
  därför stanna vid kartans rot fast den i grenvyn släpptes längre bort.
- Knappen i verktygsraden (`Focus`-ikonen) växlar som Alt+Enter.

### 8a. Kontroller

28 kontroller i Playwright mot mock-API:t, alla gröna: gren till höger och
till vänster, grenens rot (Delete, Alt+pil, Shift+Tab, mellanslag, Enter),
nya noder hamnar rätt i hela dokumentet, länken ut ur grenen finns kvar,
drag till tom yta och ångra, disposition i grenen, Esc och vyn tillbaka,
vyn i grenen skrivs inte till lagringen och överlever omladdning, gren i
gren, ångra som tar bort grenens rot, knappen, Kronberg.

1. `utils/mindmapBranch.ts` med test, skrivet först: grenen till höger och
   till vänster, rotens fält rensade, tvärlänkar in och ut, okänd nod och
   kartans rot ger samma objekt tillbaka, navigering stannar vid grenens
   rot.
2. `persist` i `useMindmapViewport` med test: inget skrivs medan den är
   falsk, och det som väntade skrivs när den blir falsk.
3. `useMindmapBranchView`, `MindmapBranchBar`, ändringarna i
   `MindmapCanvas`, knappen i verktygsraden, raderna i hjälprutan.
4. `getFileDoc` i `useMindmapExport`.

**Klart när** en gren går att öppna med Alt+Enter, skriva vidare i med Tab
och Enter, och stänga med Esc, och hela kartan då står där den stod.

### 8b. Presentationsläget

- [x] Genomfört: 2026-11-11

**Så blev det.** Nya filer: `utils/mindmapPresent.ts` (+test, 27 st),
`hooks/useMindmapPresenting.ts`, `components/mindmap/MindmapPresent.tsx`.
Efter delen: 100 testfiler, 1 601 tester. `MindmapCanvas.tsx` är 1 156
rader (1 098 före steget).

- Avvikelse: Shift+mellanslag backar, som i ett bildspel.
- Avvikelse: en räknare nere till vänster ("3 av 12") och en rad med
  tangenterna. Ett kryss nere till höger avslutar.
- Nya noder tonas in; lagret flyttas mjukt. Båda stängs av med
  `prefers-reduced-motion`.
- Nästa efter att allt är utfällt gör ingenting. Har man hoppat med
  pilarna och bara tidigare grenar är kvar tas den första av dem.
- Anteckningar visas inte i presentationen (de kan vara lärarens egna);
  länksymbolen går att klicka.
- Alt+P och Alt+Enter gäller när kartan eller en nods textfält har fokus,
  inte från panelens fält.

### 8b. Kontroller

34 kontroller i Playwright, alla gröna: helskärm på kartans ruta (fungerar
i Chromium utan fönster), start, räknaren, stegen fram i läsordning och
tillbaka, PageDown/PageUp/Backspace, Home, syskonhopp, klick, att
dubbelklick och bokstäver inte redigerar, Esc, fokus tillbaka i kartan,
**ingen sparning skickas och dokumentet på servern är oförändrat**,
knappen och krysset, presentation från en gren, Alt+P från nodens
textfält, Kronberg. Därtill 13 regressionskontroller av sidan: skriva,
färg, hopfällning, zoom, tvärlänk, anteckning, Esc utan gren, ta bort och
ångra, PNG och JSON, sparning.

**Inte kontrollerat:** helskärm på en riktig projektor eller andra skärm,
en presentationsfjärr, Safari och Firefox, och riktig backend. Workspace
och övriga sidor är inte öppnade i webbläsaren; inga av deras filer är
ändrade (se `git diff --stat` mot steg 7: bara `docs/plans/` och sidans
egna filer).

1. `utils/mindmapPresent.ts` med test, skrivet först: nästa och tillbaka
   är varandras motsats, läsordningen är djupet först, syskonhopp, klick,
   en karta utan grenar, `presentDoc` rör inte roten, `presentView` i de
   tre fallen (allt ryms, fokus ryms, fokus ryms inte).
2. `useMindmapPresenting` och `MindmapPresent`.
3. Alt+P, knappen, hjälprutan, CSS.

**Klart när** en lektion går att hålla från kartan utan att röra musen:
Alt+P, mellanslag genom kartan, Esc.

## 4. Verifiering

Automatiskt: `pnpm exec tsc --noEmit`, `pnpm lint`, `pnpm test`, `pnpm
build`. Baslinjen före steget står under steg 7 i huvudplanen.

I Playwright mot mock-API:t (port 5001, se huvudplanens steg 2), i båda
temana:

1. Grenvyn: öppna en gren till höger och en till vänster i en karta med
   layouten `both`; skriv nya noder; dra en nod till tom yta; ångra; Esc;
   kontrollera att hela kartans vy är tillbaka och att vyn överlever en
   omladdning.
2. Grenens rot: Delete, Alt+pil och Shift+Tab gör ingenting; Enter ger ett
   barn.
3. En tvärlänk ut ur grenen ritas inte i grenvyn och finns kvar efteråt.
4. Export i grenvyn: PNG visar grenen, JSON hela kartan.
5. Presentationen: Alt+P, stega fram och tillbaka genom hela kartan,
   syskonhopp, klick, Esc; kontrollera att kartan är oförändrad efteråt
   (ingen sparning skickas).
6. Presentationen från en gren.
7. Regression på sidan: skriva, zooma, tvärlänk, panel, export som förut.

**Går inte att kontrollera här:** riktig helskärm på en projektor, och en
presentationsfjärr. Det gör Tobias.

## 5. Risker

- **Markeringen utanför grenen.** Ångra kan vilja markera en nod som inte
  syns. `currentId` och markeringen efter ångra hålls inom grenen.
- **Två vyer.** Grenvyns vy får aldrig sparas som kartans. `persist` och
  testet för den är skyddet.
- **`MindmapCanvas.tsx` växer.** Logiken läggs i de nya filerna; filen ska
  bara få anropen. Blir tillägget större än 100 rader delas något ut först.
- **Presentationen ritar kartan en gång till.** Den finns bara medan läget
  är öppet, och kartan under ritas inte om av den.
