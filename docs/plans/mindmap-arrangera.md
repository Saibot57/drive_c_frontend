# Mindmap: markera flera, riktning för nya barn och arrangera

Status: Pågår. Del A (markera flera) byggd 2026-11-13. Del B–D kvar.

Planen skrevs 2026-11-13 efter en intervju med Tobias, mot koden på `main`
(fba3f05, där `MindmapCanvas.tsx` har 1 330 rader). Den bygger vidare på
[`mindmap-placering.md`](mindmap-placering.md) och omprövar ett beslut där:
beslut 4, "nya noder placeras av layouten som i dag". Skyddsreglerna i
[`mindmap-sida.md`](mindmap-sida.md) gäller oförändrade, och avsnitt 3
nedan säger hur de tillämpas här.

Arbetet delas i fyra delar. Var och en blir en PR som lämnar sidan hel:

- **A. Markera flera och massredigera.** Ram, Cmd+klick, Cmd+A. Flytta,
  färga, ta bort, fälla ihop och städa upp flera noder; form och fästen på
  flera linjer.
- **B. Riktning för nya barn.** En inställning på föräldern och ett val
  för bara nästa barn, utpekat med muspekaren. Utan vald riktning hamnar
  ett nytt barn bort från roten.
- **C. Städa upp efter riktningen.** Städa upp ställer barnen åt sin
  riktning, och aldrig inåt mot roten.
- **D. Arrangera.** De markerade noderna ställs i ett mönster runt sin
  förälder, med förhandsvisning.

## 0. Hur det fungerar i dag

Kontrollerat i koden 2026-11-13.

| Vad | Var | I dag |
|---|---|---|
| Markering | `selectedId` i `MindmapCanvas.tsx`, `edges.selectedId`, `links.selected` | En nod, en linje eller en tvärlänk åt gången. |
| Dra på tom yta | `handleViewportPointerDown` | Panorerar. Mittknappen panorerar var som helst. Shift, Alt och Cmd läses inte. |
| Dra en nod | `useMindmapNodeDrag.ts` | Flyttar noden med grenen. Shift drar en tvärlänk, Alt flyttar bara noden, Ctrl/Cmd stänger av rutnätets snäpp under draget. |
| Klick på en nod | `handleNodeClick` | Markerar. Ett klick på den markerade börjar skriva. Cmd läses inte. |
| Bokstavstangenter | `mindmapKeys.ts` (delad) | En vanlig bokstav börjar skriva i noden. Alt+N, Alt+L och Alt+I öppnar panelen (i `MindmapCanvas.tsx`, med `e.code`). |
| Nytt barn | `addChild` i `mindmapTree.ts` (delad) | Barnet får ingen förskjutning och står där `layoutMindmap` sätter det: på grenens sida i layouten. |
| Grenens sida | `rootChildSides` | I `right` står alla grenar till höger i layouten. I `both` har rotens barn en `side`, som byts när noden dras över rotens mitt (`placeNode`). En djupare nod byter aldrig sida. |
| Sidans layout | `finishMindmapLayout` i `utils/mindmapRouting.ts` | Körs efter den delade layouten: rotens förskjutning och brytpunkterna. Skärmen, minikartan, presentationen, grenvyn och exporten går alla igenom den. |
| Städa upp | `clearBranchOffsets`, `clearOffsets` | Tar bort förskjutningar. |

**Det Tobias såg.** Kartan stod i `right`. Rut drogs till vänster om
roten, och s (barn till Rut) drogs ännu längre ut. Ett nytt barn till s
hamnade till höger om s, alltså inåt mot roten, eftersom grenen fortfarande
är en högergren i layouten.

## 1. Beslut

Alla bekräftade av Tobias 2026-11-13 om inget annat står.

### Markering

| # | Fråga | Beslut |
|---|---|---|
| 1 | Ram | **Cmd+dra på tom yta** (Ctrl på Windows) ritar en ram. Vanligt drag panorerar som i dag. |
| 2 | Vad ramen fångar | **Noder och linjer som ramen nuddar.** Barnen till en fångad nod markeras inte. |
| 3 | Enstaka | **Cmd+klick** (Ctrl på Windows) lägger till eller tar bort en nod eller linje. Shift+klick gör inget nytt. |
| 4 | Syskon | **Cmd+A** markerar den markerade noden och alla dess syskon. |
| 5 | Noder, flera | Flytta tillsammans (dra en, så följer de andra, var och en med sin gren), färg och ikon, ta bort, fälla ihop, städa upp, riktning för nya barn. |
| 6 | Linjer, flera | Form, fästen och "Återställ linje". |
| 7 | Blandat | Är både noder och linjer markerade visas båda sorternas val. |

### Riktning för nya barn

| # | Fråga | Beslut |
|---|---|---|
| 8 | Vad som ställs in | **Båda:** en sparad inställning på föräldern, och ett val som gäller bara nästa barn. |
| 9 | Precision | **Helt fri vinkel**, utan snäpp. |
| 10 | Läget | Startas med **en tangent och en knapp** i verktygsraden. En pil från noden följer pekaren. Ett klick sätter riktningen och skapar inget barn. Esc avbryter. |
| 11 | Bara nästa barn | **Samma tangent med Shift.** |
| 12 | Tangenten | **Alt+R** och **Alt+Shift+R** (förslag i sammanfattningen, inte invänt mot). En vanlig bokstav börjar skriva, och Cmd+R laddar om sidan. |
| 13 | Syskon | **Solfjäder:** syskonen ligger på en båge runt föräldern, symmetriskt kring riktningen. |
| 14 | Nytt syskon | Syskon som står på sin plats i solfjädern **fördelas om** så att den hålls centrerad. Ett syskon man själv dragit **står kvar**. |
| 15 | Arv | **Samma riktning** nedåt, tills man väljer en annan. |
| 16 | Barn som redan finns | **Bara nya barn** följer en riktning som sätts. De som finns står kvar. |
| 17 | Utan vald riktning | Ett nytt barn hamnar **bort från roten, åt vänster eller höger**, efter var föräldern står på skärmen. Syskonen staplas under varandra som i dag. |
| 18 | Synlighet | En **diskret pil när noden är markerad**. Inget annars, och inget i export eller presentation. |

### Städa upp och arrangera

| # | Fråga | Beslut |
|---|---|---|
| 19 | Städa upp, med riktning | Barnen går **tillbaka till riktningen** (solfjädern). |
| 20 | Städa upp, utan riktning | Barnen ställs **bort från roten**, aldrig inåt. |
| 21 | Runt vad | De markerade arrangeras **runt sin förälder**. Har de olika föräldrar arrangeras **varje syskongrupp för sig**. |
| 22 | Grenarna | **Följer med** sin nod. Arrangemanget sätter ingen riktning för nya barn. |
| 23 | Förhandsvisning | Mönstret **visas när pekaren är över valet** i menyn och görs med ett klick. |
| 24 | a) Hörn | Varje nod hamnar i det hörn den står närmast. Färre än fyra fyller hörnen medurs från uppe till vänster; fler staplas (sex blir 2+1+2+1). |
| 25 | b) Cirkel | Jämnt runt föräldern. Varje nod får den plats som ligger närmast där den står. |
| 26 | c) Två sidor | Hälften till vänster, hälften till höger, under varandra. Sida och ordning efter var de står nu. |
| 27 | d) En sida | Höger, vänster, ovanför eller under. Ordning efter var de står nu. |
| 28 | e) Område | Tobias drar upp ett område. Brett ger en rad, högt en kolumn, annars ett rutnät. Varje nod får platsen närmast där den stod. |

### Gränser

| # | Fråga | Beslut |
|---|---|---|
| 29 | Gamla kartor | **Inget flyttar** av sig självt. Bara nya barn, städa upp och arrangera ändrar något. |
| 30 | Workspace-kortet | **Bara sidan.** Tobias: "vilket som är lättast, workspace-delen är oviktig". Kortet ritar exakt som i dag. |
| 31 | Var riktningen byggs | **I sidans layout** (alternativ B i intervjun), inte som en förskjutning vid skapandet och inte i den delade `layoutMindmap`. |

Följder av besluten som står här, så att de inte blir en överraskning:

- **Beslut 4 i placeringsplanen ändras.** Ett nytt barn till en nod som
  står på "fel" sida om roten hamnar nu utåt. Ett nytt barn till en nod
  som står på sin layoutsida hamnar exakt som i dag.
- **Ett byte av förälder** (släpp på en annan nod, Tab, Shift+Tab, Alt+pil
  ut och in) tar bort nodens `dir`, som det i dag tar bort förskjutningen
  och fästena. Nodens egen `childDir` står kvar.
- **Inklistrade och kopierade grenar** behåller riktningarna inne i
  grenen. Grenens översta nod får sin plats som ett nytt barn.
- **Pilarna** följer trädet som i dag (beslut 14 i placeringsplanen).
- **Rutnätet** snäpper inte nya barn, solfjädern eller ett arrangemang,
  bara drag som i dag. Ett gemensamt drag av flera noder snäpper efter den
  nod man håller i. *Inte frågat; säg till om arrangemang ska snäppa.*
- **Solfjädern tar inte hänsyn till barnens egna grenar.** Två syskon med
  stora grenar kan hamna över varandra, och då drar man isär dem. Den
  delade layouten gör plats i en kolumn, inte i en båge.

## 2. Utformning

### 2.1 Datan

Två valfria fält på noden, i blocket "Fälten nedan tillkom för
Mindmap-sidan" i `src/types/mindmap.ts`:

```ts
/** Var ett barn står i förhållande till sin förälder. Bara sidan läser den. */
export type MindmapDir =
  | { angle: number }            // grader, 0 = höger, 90 = nedåt, [0, 360)
  | { side: 'left' | 'right' };  // kolumn bredvid föräldern, som i dag

/** Riktningen för barn som noden får härefter (beslut 8). */
childDir?: { angle: number };
/** Riktningen noden själv ställdes med när den skapades eller städades. */
dir?: MindmapDir;
```

- `childDir` är inställningen Tobias sätter i läget. Den flyttar ingenting.
- `dir` sätts på barnet när det skapas, och av Städa upp. Layouten läser
  bara `dir`. Arvet (beslut 15) räknas alltså ut **en gång, när barnet
  skapas**, och sparas: sidan blir densamma varje gång den ritas, och en
  ändrad `childDir` flyttar inte barn som redan finns (beslut 16).
- En gammal karta har inget av fälten och går inte igenom något nytt steg.
- "Bara nästa barn" (beslut 11) sparas inte i dokumentet. Det är ett
  tillstånd på sidan som förbrukas av nästa nya barn och släpps när en
  annan nod markeras.

**Riktningen för ett nytt barn**, `dirForNewChild(doc, parentId, layout, once)`,
i den här ordningen:

1. `once`, om den finns (Alt+Shift+R).
2. Förälderns `childDir`.
3. Förälderns egen `dir` om den är en vinkel (arvet).
4. Förälderns `dir` om den är en sida: samma sida.
5. Annars skärmen: står förälderns mitt på andra sidan om rotens mitt än
   grenens sida i layouten, blir det `{ side }` åt det hållet.
6. Annars inget fält. Barnet står där layouten sätter det, exakt som i dag.

Rotens barn: 1 och 2 gäller (roten kan ha `childDir`), annars inget fält.

**Tvätten.** `sanitizeNode` i `mindmapTree.ts` tar emot `childDir` med ett
ändligt tal och `dir` i en av de två formerna; vinkeln normaliseras till
[0, 360). Allt annat kastas. Backend lagrar dokumentet som det kommer och
behöver ingen ändring (som för `edge`).

### 2.2 Sidans layout: `utils/mindmapDirections.ts`

Ett nytt rent steg, `applyDirections(layout, doc)`, som körs **först** i
`finishMindmapLayout` (före rotens förskjutning och brytpunkterna). Finns
inget `dir` i dokumentet kommer samma layout tillbaka, samma objekt.

För varje synlig förälder, uppifrån och ned:

- **Barn utan `dir`** står kvar där den delade layouten satte dem,
  flyttade lika mycket som föräldern flyttats av steget.
- **Barn med `{ angle }`** grupperas per vinkel och läggs på en båge:
  mitt på riktningen från förälderns mitt, med radien
  `förälderns halva utsträckning åt det hållet + hGap + barnets halva`,
  och ett vinkelsteg som ger minst `vGap` mellan rutorna. Ordningen är
  trädets, medurs.
- **Barn med `{ side }`** läggs i en kolumn på den sidan, centrerad mot
  föräldern, med `hGap` och `vGap` som i dag. Kolumnen räknar varje barns
  höjd med dess synliga gren, så att grenar inte krockar.
- Barnets `offset` läggs på efter platsen, som i dag.
- **Grenen under barnet följer med** samma förflyttning. Under ett barn
  med `{ side: 'left' }` i en högergren speglas dessutom de barnbarn som
  saknar `dir`, så att de inte växer tillbaka mot föräldern. I praktiken
  har de `dir`, eftersom arvet sätter den.
- Linjerna flyttas med sina noder. Med fästet "närmaste kant" räknas de
  ändå ur rutorna; med "efter grensidan" (gamla kartor) vänds ändarna för
  ett barn som står på andra sidan, så att linjen inte går genom noden.
- Kartans mått räknas om så att allt ryms, som `placeRootInLayout` gör.

**Omfördelning (beslut 14).** Layouten fördelar alltid alla syskon med
samma vinkel. För att ett draget syskon ska stå kvar räknar
`addChildWithDir` om förskjutningen på de syskon som har en `offset`, så
att de står på samma plats efter att barnet lagts till (samma grepp som
`placeNode` har vid sidbyte). Syskon utan förskjutning flyttar med
solfjädern.

### 2.3 Markering: `hooks/useMindmapMultiSelect.ts`

Den markerade noden (`selectedId`) finns kvar och är den som tangenterna
och panelen gäller. Bredvid den håller hooken två mängder: noder och
linjer (linjens id är barnets nod-id, som i `edges.selectedId`).

- **Ram:** `handleViewportPointerDown` lämnar över till hooken när Cmd
  eller Ctrl hålls. Ramen ritas i ett eget lager. Träffarna räknas rent i
  `utils/mindmapSelection.ts`: `nodesInRect(layout, rect)` och
  `edgesInRect(routes, rect)` (linjen provas som punkter längs sin väg).
- **Cmd+klick** på en nod eller linje växlar den. Draget skiljs från
  klicket med dagens tröskel, så att Cmd under ett drag fortfarande
  stänger av snäppet.
- **Cmd+A** tolkas i sidan före den delade `resolveMindmapKey`, bara i
  nav-läget. När man skriver markerar Cmd+A texten som i dag.
- **Markeringen släpps** av ett vanligt klick, Esc, ångra och gör om, när
  man börjar skriva, och när en markerad nod försvinner.
- **Flera noder:**
  - Drag: `useMindmapNodeDrag` flyttar alla markerade när man drar en av
    dem (`placeNodes` i `mindmapPlacement.ts`). En markerad nod under en
    annan markerad flyttas inte två gånger. Alt, släpp på en nod och
    sidbyte gäller bara när en enda nod dras.
  - Färg, ikon, fälla ihop, ta bort och städa upp går genom
    `applyToNodes(doc, ids, fn)` och blir ett ångra-steg.
  - Tab, Enter och att skriva gäller den markerade noden och släpper
    resten.
- **Flera linjer:** raden över kartan (`MindmapEdgeBar`) visar valen för
  alla markerade linjer. Ett val som skiljer sig mellan dem visas som
  blandat. Handtagen för fästen och brytpunkter visas bara när en enda
  linje är markerad.

### 2.4 Läget för riktning: `hooks/useMindmapDirectionPick.ts`

- Startas med Alt+R, Alt+Shift+R (`e.code === 'KeyR'`, som Alt+N) eller
  knappen i verktygsraden. Gäller den markerade noden, eller alla
  markerade noder.
- En pil ritas från varje vald nods mitt mot pekaren; vinkeln räknas från
  den markerade nodens mitt. Ett klick sätter `childDir` (eller
  engångsvalet), Esc eller högerklick avbryter. Kartan går att panorera
  och zooma under tiden.
- I verktygsraden finns också "Ta bort riktning", som tar bort `childDir`.
- Den diskreta pilen (beslut 18) ritas vid den markerade noden när den har
  `childDir`, i samma lager, och inte i export eller presentation.

### 2.5 Städa upp (del C)

`tidyBranch(doc, id, layout)` och `tidyAll` ersätter anropen till
`clearBranchOffsets` och `clearOffsets` på sidan. De tar bort
förskjutningarna som i dag och sätter dessutom `dir` på varje nod i
grenen efter samma regel som för ett nytt barn (punkt 2–6 i 2.1, räknat
uppifrån och ned efter att förskjutningarna tagits bort). En karta utan
`dir`, `childDir` och förskjutna föräldrar blir exakt som av dagens
Städa upp. De delade funktionerna rörs inte.

### 2.6 Arrangera (del D): `utils/mindmapArrange.ts`

`arrange(doc, ids, pattern, layout, area?)` ger ett nytt dokument där de
markerade noderna har fått förskjutningar. Ren funktion; mönstren a–e
enligt beslut 24–28. Noderna grupperas per förälder, och en nod vars
förfader också är markerad hoppas över.

- Avstånden: cirkelns radie och hörnens läge räknas ur gruppens storlek,
  så att rutorna inte överlappar, med `hGap` som minsta luft mot
  föräldern.
- "Närmast där den står" löses girigt på avstånd (grupperna är små).
- **Menyn "Arrangera"** i verktygsraden, öppen när minst två noder är
  markerade. Pekaren över ett val visar resultatet genom samma väg som
  dragets `previewMove`; ett klick sparar det som ett ångra-steg.
- **e)** valet stänger menyn och låter Tobias dra upp ett område på
  ytan (samma ramlager som markeringen); förhandsvisningen följer draget.

### 2.7 Filer

**Nya:** `utils/mindmapSelection.ts`, `utils/mindmapDirections.ts`,
`utils/mindmapArrange.ts` (alla med test),
`hooks/useMindmapMultiSelect.ts`, `hooks/useMindmapDirectionPick.ts`,
`components/mindmap/MindmapSelectionLayer.tsx` (ram, riktningspil),
`components/mindmap/MindmapArrangeMenu.tsx`.

**Ändras (sidans egna):** `MindmapCanvas.tsx` (bara koppling),
`useMindmapNodeDrag.ts`, `mindmapPlacement.ts` (+test),
`mindmapRouting.ts` (`finishMindmapLayout`, +test), `mindmapBranch.ts`
(grenens rot utan `dir`, +test), `MindmapEdgeBar.tsx`,
`MindmapEdgeLayer.tsx`, `MindmapNodeView.tsx` (klass för markerad i
grupp), `MindmapToolbar.tsx`, `MindmapHelp.tsx`, `mindmap.css`,
`config/shortcuts.ts`.

**Delade, bara med valfria tillägg:** `types/mindmap.ts` (`childDir`,
`dir`), `utils/mindmap/mindmapTree.ts` (tvätten, med test).

**Rörs inte:** `mindmapLayout.ts`, `mindmapKeys.ts`, `navigate`,
`addChild`, `setOffset`, `clearOffsets`, allt under
`src/app/workspace/_feature/`.

## 3. Skyddsreglerna här

1. **Workspace-kortet.** Ingen delad funktion ändrar beteende. De två nya
   fälten tvättas och bevaras men läses inte av kortet. Kortets tester ska
   vara gröna och orörda.
2. **Gamla kartor ser ut som i dag.** Test: `finishMindmapLayout` på
   fixturerna i `mindmapLayout.test.ts` och på en karta med förskjutningar
   ger samma tal som före ändringen.
3. **Ingen nod flyttar** utan att Tobias gjort något (beslut 29).
4. **Inga nya beroenden.**
5. **`MindmapCanvas.tsx` växer inte med logik.** Varje del får lägga till
   högst 60 rader där; blir det mer bryts något ut först.
6. **Färger** från `--ui-*` och `--mm-*`; ramen och pilen får egna
   `--mm-`-värden för Neo och Kronberg.

## 4. Steg

Varje del: `pnpm install --frozen-lockfile`, `pnpm exec tsc --noEmit`,
`pnpm lint`, `pnpm test`, `pnpm build`, och en visuell kontroll i
Chromium mot ett mock-API, i Neo och Kronberg, med en exporterad PNG.

### Del A. Markera flera och massredigera — byggd 2026-11-13

1. [x] `mindmapSelection.ts` med test: träffar för ram, växla, syskon, vilka
   noder som är "översta" i en markering.
2. [x] `useMindmapMultiSelect` och ramlagret. Cmd+dra, Cmd+klick, Cmd+A, Esc.
3. [x] Gemensamt drag (`placeNodes`, med test).
4. [x] Färg, ikon, fälla ihop, ta bort och städa upp på flera.
5. [x] Flera linjer: i en egen rad, `MindmapSelectionBar` (se avvikelserna).
6. [x] Hjälpen och `config/shortcuts.ts`.

**Klart när** fyra noder går att rama in, flytta, färga och ta bort som
ett ångra-steg var, och en ensam markering beter sig som i dag.

**Avvikelser och val som gjordes under bygget:**

- **En egen rad för flera markerade**, `MindmapSelectionBar.tsx`, i stället
  för att bygga ut `MindmapEdgeBar`. Raden har nodernas val (ikon, fäll
  ihop eller ut, städa upp, ta bort) och linjernas (form, start, fäste,
  återställ). Ett val som skiljer sig mellan de markerade visas som
  "Blandat". Färgen väljs i verktygsraden, som för en nod.
- **Handlingarna på flera** ligger i `utils/mindmapGroup.ts` (med test),
  och `groupActionFor` säger vilka av kartans tangenter som gäller alla:
  Alt+siffra (färg), Delete och mellanslag. Alt+Shift+siffra (ikon) och
  Alt+Shift+0 (nollställ) gäller också alla. Allt annat släpper de
  markerade och gäller den markerade noden.
- **Ramen lägger till** i en grupp som redan finns. Inte frågat; det gör att
  man kan rama in två områden efter varandra. Ett vanligt klick släpper.
- **Delete med bara linjer markerade** gör ingenting, som för en ensam linje.
- **Roten i en grupp** flyttas ensam när gruppen dras, som när roten dras.
- **Markeringen syns också utan fokus**, till skillnad från den markerade
  noden, eftersom raden över kartan står kvar.
- `MindmapCanvas.tsx` fick 67 rader och tappade 10 (netto 57).
- `routePoints` i `mindmapEdges.ts` exporteras nu, för ramens träff på
  linjerna.

**Kontrollerat i Chromium** mot mocken, i Neo och Kronberg: Cmd+klick på
fyra noder, av och på igen, gemensamt drag (tre grenar flyttade 40 px,
den fjärde orörd), Alt+1 på tre, Esc, Cmd+A, klick på tom yta, ram över en
nod och en linje, form på linjen från raden, Ctrl+klick, Delete på två och
ångra i ett steg, två linjer med Cmd+klick och Delete utan verkan, roten i
en grupp, ensam markering och ensam linje som förut, och PNG-exporten utan
markeringar.

### Del B. Riktning för nya barn

1. Typerna och tvätten, med test.
2. `mindmapDirections.ts` med test: solfjäder, kolumn på andra sidan,
   grenen följer med, oförändrad layout utan fält.
3. `dirForNewChild` och `addChildWithDir`, med test: ordningen i 2.1,
   omräknad förskjutning på dragna syskon.
4. `useMindmapDirectionPick`, knappen, Alt+R och Alt+Shift+R, pilen.
5. Grenvyn, bytet av förälder och inklistring.

**Klart när** fallet på Tobias bild ger ett barn till vänster om s, en
nod med riktning får sina barn i solfjäder åt det hållet, och minikartan,
presentationen, grenvyn och PNG:n visar samma sak som skärmen.

### Del C. Städa upp efter riktningen

1. `tidyBranch` och `tidyAll`, med test.
2. Menyn Städa upp anropar dem.

**Klart när** Städa upp på s:s gren ställer barnen till vänster om s, och
en karta utan flyttade noder städas som i dag.

### Del D. Arrangera

1. `mindmapArrange.ts` med test för a–e, flera föräldrar och "närmast".
2. Menyn med förhandsvisning.
3. Området för e).

**Klart när** bilden går att göra om: fyra noder på nivå 1, Cmd+A,
Arrangera → Hörn.

## 5. Tester

- `mindmapSelection.test.ts`, `mindmapDirections.test.ts`,
  `mindmapArrange.test.ts`: ren geometri med en enkel textmätning.
- `mindmapTree.test.ts`: tvätten av `childDir` och `dir`.
- `mindmapPlacement.test.ts`: `placeNodes`, `dirForNewChild`,
  `addChildWithDir`, `tidyBranch`.
- `mindmapRouting.test.ts`: gamla kartor oförändrade genom
  `finishMindmapLayout`; linjens ändar för ett barn på andra sidan.
- `mindmapBranch.test.ts`: grenens rot utan `dir`.
- Hookarna prövas i Chromium, inte i vitest, som draget i dag.

## 6. Verifiering i webbläsaren

Mot mocken på `http://localhost:5001`, i Neo och Kronberg:

1. Kartan på Tobias bild (Test med Rut, Siv, Pim, Kaj och s): nytt barn
   till s, före och efter.
2. Ram över två noder och en linje; Cmd+klick av och på; Cmd+A.
3. Gemensamt drag, med rutnätet av och på.
4. Riktning 45° med ett, tre och fem barn; ett draget syskon står kvar
   när ett fjärde läggs till.
5. Bara nästa barn (Alt+Shift+R).
6. Städa upp en gren med och utan riktning.
7. Arrangera a–e med fyra och sex noder, och med två föräldrar.
8. En gammal karta (utan fälten) före och efter: samma bild.
9. Minikartan, presentationen, grenvyn och en exporterad PNG.

## 7. Risker

- **Solfjädern och stora grenar** kan överlappa (följd i avsnitt 1). Vi
  ser hur det blir i del B och tar upp det med Tobias om det stör.
- **Fästet "efter grensidan"** i gamla kartor är inte gjort för barn på
  andra sidan. Ändarna vänds för sådana barn; blir det fult är rådet att
  byta kartan till "närmaste kant".
- **Cmd under drag** betyder redan "snäpp inte". Cmd+klick och Cmd+dra på
  tom yta krockar inte, men det prövas i Chromium på både noder och yta.
- **Alt+R på Mac** ger `®`; tangenten läses med `e.code`. När man skriver
  i en nod gör den ingenting.
- **Markeringen och ångra.** Historiken sparar en markerad nod. Flera
  markerade släpps vid ångra, hellre än att ändra historikens form.
- **`MindmapCanvas.tsx`** är redan stor. Skyddsregel 5.
- **Kortet.** Skyddet är att ingen delad funktion ändrar beteende och att
  kortets tester är orörda. Kortet i webbläsaren kan inte prövas i
  sessionen.

## 8. Öppet

- Om ett arrangemang ska snäppa mot rutnätet (inte frågat).
- Om solfjäderns överlapp behöver lösas (avgörs efter del B).
