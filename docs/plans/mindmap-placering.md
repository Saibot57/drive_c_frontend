# Mindmap: friare placering och linjer att forma

Status: Pågår. Del A, B och C byggda 2026-11-12

Planen skrevs 2026-11-12 efter en intervju med Tobias, mot koden på `main`
(f8541ce, där `MindmapCanvas.tsx` har 1 258 rader). Den bygger vidare på
steg 5 (fri placering) och steg 6 (tvärlänkar) i
[`mindmap-sida.md`](mindmap-sida.md). Skyddsreglerna där gäller
oförändrade, och avsnitt 3 nedan säger hur de tillämpas här. Planen
omprövar inget beslut i [`mindmap-farger.md`](mindmap-farger.md):
linjerna förblir neutrala (beslut 8 där).

Arbetet delas i fyra delar. Var och en blir en PR som lämnar sidan hel:

- **A. Linjernas geometri och kartans val.** Fäste efter närmaste kant,
  formerna kurva, rak och vinklad, valda per karta.
- **B. Placering.** Alt+dra flyttar bara noden. Roten går att flytta.
  Städa upp en gren. Rutnät.
- **C. Inställningar per linje.** Markera en linje, välj form och fästen,
  dra i ändarna. Tvärlänkarna får samma val.
- **D. Brytpunkter.** Linjen kan gå genom punkter på ytan som man lägger
  ut själv.

## 0. Hur det fungerar i dag

Kontrollerat i koden och i Chromium 2026-11-12.

| Vad | Var | I dag |
|---|---|---|
| Layout (delad) | `layoutMindmap` i `utils/mindmap/mindmapLayout.ts` | Grenarna växer från roten åt sidan (`right` eller `both`), med `hGap: 32` och `vGap: 6`. Varje gren får den höjd den behöver, och föräldern centreras mot barnen. |
| Förskjutning (delad) | samma fil, efter layouten | `offset` läggs på rekursivt, så att grenen följer med noden. Rotens `offset` läses inte. |
| Kantens ändar (delad) | `placeChildren` | Ändarna räknas **före** förskjutningen och efter grensidan: från förälderns högra kant till barnets vänstra (tvärtom på vänster sida). Sedan flyttas ändarna med noderna. |
| Kantens form (delad) | `edgePath`, `bezierCurveTo` i `mindmapDraw.ts` | En kubisk kurva där båda styrpunkterna ligger mitt emellan ändarna i x-led. |
| Kantens utseende | `.mm__edge` i `mindmap.css`, `lineWidth = 1.5` | Fast: `--mm-line`, 1,5 px. |
| Ritas av | `MindmapCanvas.tsx`, `MindmapPresent.tsx` (`edgePath`), `renderMindmapCanvas` (PNG, PDF, minikartan, urklippsbilden) | Samma layout överallt. |
| Drag | `handleNodePointerDown` i `MindmapCanvas.tsx` | Ett släpp på en nod byter förälder och tar bort förskjutningen. Ett släpp på tom yta anropar `placeNode` (`utils/mindmapPlacement.ts`). Roten går inte att dra. Shift+dra drar en tvärlänk. Alt och Ctrl läses inte när noden dras. |
| Sidbyte (`both`) | `placeNode` | En gren under roten som släpps på andra sidan av rotens mitt byter `side`. En djupare nod stannar vid rotens mitt. |
| Nollställ | Alt+Shift+0, knappen i verktygsraden | Tar bort nodens förskjutning, respektive alla förskjutningar i kartan (`clearOffsets`). |
| Pilarna (delad) | `navigate` i `mindmapTree.ts` | Följer trädet (förälder, barn och syskon i ordning), inte var noderna står på skärmen. |
| Tvärlänkar | `crossLinkGeometry` i `utils/mindmapCrossLinks.ts` | Ändarna sitter där en stråle från nodens mitt mot den andra noden lämnar rutan. Kurvan böjer åt en sida som räknas ur nodernas id. |
| Grenvyn | `branchDoc` i `utils/mindmapBranch.ts` | Ger grenens rot utan `offset`, `collapsed` och `side`, och tar med resten av dokumentets fält. |

**Felet som syns.** När ett barn dras förbi sin förälder går linjen ändå
från förälderns utåtvända kant till barnets inåtvända, och den blir en
bakåtvänd S-kurva (skärmbild av kartan "Förskjutna" i intervjun: Republik
och Religion). Detsamma händer när en förälder flyttas långt upp eller ned:
linjen går nästan lodrätt in i nodens sida.

**Kortet och sidan delar inga dokument** (kontrollerat i
radbrytningsplanen). Kortet anropar `layoutMindmap`, `edgePath` och
`renderMindmapCanvas` utan sidans val. Rör inte delad kod som de anropen
går igenom, så ändrar kortet inte beteende.

**`.mup`-importen** sätter ingen `offset` (`mindmapMup.ts`, rad 34). Ingen
befintlig karta har alltså en förskjutning på roten, eftersom `setOffset`
inte tillåter det.

## 1. Beslut

| # | Fråga | Beslut |
|---|---|---|
| 1 | Linjens fäste | **Närmaste kant** som förval: linjen går ut från den sida av föräldern (upp, höger, ned eller vänster) som vetter mot barnet, och in i den sida av barnet som vetter mot föräldern. Dessutom kan varje ände **väljas** (beslut 7). |
| 2 | Dra en nod med barn | **Grenen följer med** som i dag. Med **Alt** under draget flyttas bara noden, och barnen står kvar där de stod. |
| 3 | Roten | **Roten flyttas ensam**: den går att dra, och grenarna står kvar. Ingen dold rot och inga flera rötter. |
| 4 | Automatik och städning | Nya noder placeras av layouten som i dag. **Städa upp** finns för den markerade grenen (noden och allt under) och för hela kartan. |
| 5 | Former | **Kurva** (som i dag), **rak** och **vinklad** (rätvinklig). Ingen fri form; den ersätts av brytpunkter (beslut 8). |
| 6 | Nivå | Kartan har **ett förval** för form och fäste. **En linje** kan få en egen form och egna fästen, som vinner över förvalet. Ingen nivå per gren. |
| 7 | Välja fäste | En markerad linje får **handtag på ändarna**, som dras till en annan sida av noden. Den får också **en rad över kartan**, som tvärlänkarna har, med form, start och fäste (auto, upp, höger, ned, vänster) och "Återställ linje". |
| 8 | Brytpunkter | Linjen kan gå genom **punkter på ytan** (a → b → c). Det blir **en egen del (D)** efter de andra, men fältet planeras från början. |
| 9 | Tjocklek, streck, pil, färg | **Inget nu.** Linjerna förblir neutrala och 1,5 px. |
| 10 | Tvärlänkarna | Får **samma geometri**: form, fästen och senare brytpunkter, genom samma rena funktion. En tvärlänk utan egna val ser ut exakt som i dag (böjd, streckad). |
| 11 | Workspace-kortet | **Bara sidan.** Allt nytt i delad kod är valfritt; kortet ritar exakt som i dag. |
| 12 | Gamla kartor | **Fästet väljs per karta.** En karta utan fältet (alla kartor före del A) har fästet *efter grensidan*, exakt som i dag. En ny karta får *närmaste kant*. En gammal karta byter när Tobias väljer det. Ingen nod flyttar på sig. |
| 13 | Hjälpmedel | **Rutnät**, av eller på per karta. När det är på syns ett diskret prickrutnät på 20 px, och nodens övre vänstra hörn snäpper till det när noden släpps. Med Ctrl under draget snäpper noden inte. Gamla kartor har rutnätet av. Ingen snäppning mot andra noder, inga avstånd per karta och inget läge nedåt. |
| 14 | Pilarna och Alt+pilar | **Följer trädet som i dag.** Den delade `navigate` rörs inte. |
| 15 | Dra roten | **Bara roten** flyttas. Hela kartan flyttas med panorering som i dag. |
| 16 | Förval för en ny karta | **Kurva** och närmaste kant. |
| 17 | Övriga vyer | Minikartan, presentationen, grenvyn, PNG, PDF och urklippsbilden visar **samma linjer och placering** som skärmen. Det är ett krav, inte ett val, och det uppfylls genom att alla läser en och samma ruttning (avsnitt 2.3). |

Följder av besluten som står här, så att de inte blir en överraskning:

- **"Efter grensidan" är dagens geometri exakt**, också formen. En gammal
  karta ritas alltså identiskt tills den byter, och testet i del A jämför
  dagens `edgePath` med den nya funktionen på samma layout.
- **Formerna gäller också med "efter grensidan".** En gammal karta kan få
  raka linjer utan att byta fäste.
- **Ett byte av förälder** (släpp på en annan nod, Tab, Shift+Tab, Alt+pil
  ut och in) tar bort linjens egna fästen och brytpunkter, precis som
  förskjutningen tas bort i dag: de gällde linjen till den gamla
  föräldern. Linjens egen form står kvar.
- **Städa upp** tar bort förskjutningar (också rotens) men inte linjernas
  val. "Återställ linje" i linjens rad tar bort linjens val.

## 2. Utformning

### 2.1 Datan

**På noden**, i den delade typen (`src/types/mindmap.ts`), ett valfritt
fält i blocket "Fälten nedan tillkom för Mindmap-sidan". Det gäller linjen
**från föräldern till noden**: varje nod utom roten har exakt en sådan
linje, så valet följer med noden när en gren kopieras, klistras in eller
tas bort.

```ts
export type MindmapEdgeShape = 'curve' | 'straight' | 'elbow';
export type MindmapAnchor = 'top' | 'right' | 'bottom' | 'left';

/** Linjen från föräldern hit. Bara sidan ritar efter den. */
edge?: {
  shape?: MindmapEdgeShape;
  /** Var linjen lämnar föräldern. Saknas: kartans fäste. */
  from?: MindmapAnchor;
  /** Var linjen går in i noden. Saknas: kartans fäste. */
  to?: MindmapAnchor;
  /** Del D. Brytpunkter, räknade från förälderns mitt. */
  points?: { x: number; y: number }[];
};
```

`sanitizeMindmap` behåller `edge` när det är ett objekt. Okända former och
sidor tas bort, punkter med andra värden än ändliga tal tas bort, och högst
20 punkter behålls (heltal). Ett tomt `edge` tas bort. Kortet bevarar
alltså fältet om det någonsin kommer dit, men det ritar inte efter det.

`offset` på roten används från del B. Typen har det redan, och tvätten
behåller det redan på alla noder. Den delade layouten läser det fortsatt
inte; sidan lägger på det i ruttningen (2.3).

**I sidans dokument** (`types/mindmapDoc.ts`):

```ts
export interface MindmapLines {
  /** Saknas: 'curve'. */
  shape?: MindmapEdgeShape;
  /** Saknas: 'side', dagens geometri (kartor från före del A). */
  anchor?: 'side' | 'nearest';
}
lines?: MindmapLines;
/** Del B. Saknas: av. */
grid?: boolean;
```

`sanitizeMindmapDoc` tar bort okända värden. `defaultMindmapDoc` sätter
`lines: { shape: 'curve', anchor: 'nearest' }`. En kopia av en karta får
originalets val, och en `.mup`-import får det nya förvalet (den har inga
förskjutningar, så den ser ut som förut). `branchDoc` sprider dokumentet
och tar alltså med `lines` och `grid` utan att något ändras där. Det
kontrolleras med ett test.

**På tvärlänken** (`MindmapCrossLink`), del C:

```ts
shape?: MindmapEdgeShape;
fromAnchor?: MindmapAnchor;
toAnchor?: MindmapAnchor;
points?: { x: number; y: number }; // del D, räknade från från-nodens mitt
```

Saknas `shape` ritas den böjda kurvan från i dag. `from` och `to` är redan
tagna av nodernas id, därför andra namn här.

Backend lagrar dokumentet som det kommer och behöver ingen ändring.

### 2.2 Geometrin (`utils/mindmapEdges.ts`, ny, med test)

Rena funktioner utan DOM:

- `anchorPoint(box, side)`: mitten av rutans sida.
- `nearestSides(fromBox, toBox)`: de sidor som vetter mot varandra. Står
  rutorna isär i x-led (ingen överlappning vågrätt) blir det höger och
  vänster, annars upp och ned. Layouten lägger alltid barnet `hGap` från
  föräldern i x-led, så en orörd karta får samma ändar med båda fästena
  (test).
- `routeEdge({ start, startSide, end, endSide, shape, points })` ger en
  `EdgeRoute`: en lista med ritkommandon (`M`, `L`, `C`), mittpunkten
  (för etiketten) och riktningen in i änden (för en pil).
  - **Kurva**: styrpunkterna ligger utåt från varje ände, längs sidans
    normal. Avståndet är halva avståndet mellan ändarna i den ledden. För
    höger mot vänster blir det exakt dagens `edgePath` (test, på tal).
  - **Rak**: en rak linje, eller en bruten linje genom punkterna.
  - **Vinklad**: rätvinkliga sträckor. Ut från startsidan, en tvärsträcka
    mitt emellan, och in i ändsidan. Med punkter går den rätvinkligt genom
    var och en.
- `routeToSvg(route)` och `drawRoute(ctx, route)`: samma kommandon som en
  SVG-sträng och som canvas-anrop. Så blir bilden det man ser.

### 2.3 Ruttningen (`utils/mindmapRouting.ts`, ny, med test)

`routeMindmap(layout, doc): RoutedMindmap` tar den färdiga layouten från
`layoutMindmap` och sidans dokument och gör tre saker:

1. Lägger på **rotens förskjutning** (del B): roten flyttas, och inget
   annat flyttas.
2. Räknar **varje kants rutt** ur nodernas slutliga rutor, kartans
   `lines` och nodens `edge`. Med fästet "efter grensidan" och kurvan ger
   den exakt dagens kant.
3. Räknar om **kartans mått** (`width`, `height` och marginalen), så att
   roten, linjerna och punkterna ryms. Alla lägen flyttas med samma
   förskjutning som `layoutMindmap` gör.

Resultatet är `MindmapLayoutResult & { routes: Map<string, EdgeRoute> }`
(nyckel: barnets id), så allt som läser layouten fungerar som förut.

Det är det enda stället där sidans layout blir klar. `layoutOf` i
`MindmapCanvas` anropar det. `MindmapPresent`, `useMindmapExport` och
minikartan får det genom `renderMindmapCanvas` (nedan). Tvärlänkarnas
`crossLinkGeometry` läser samma rutor och använder `routeEdge` när länken
har en form (del C).

**Delad kod, två valfria tillägg i `MindmapDrawOptions`**
(`utils/mindmap/mindmapDraw.ts`):

```ts
/** Ändrar layouten innan något ritas: sidans ruttning. */
transform?: (layout: MindmapLayoutResult) => MindmapLayoutResult;
/** Ritar kanterna i stället för de inbyggda kurvorna. */
edges?: (ctx: CanvasRenderingContext2D, layout: MindmapLayoutResult) => void;
```

Utan dem ritar `renderMindmapCanvas` exakt som i dag. Det är samma mönster
som `overlay` och `paint`. `layoutMindmap` och `edgePath` rörs inte.

### 2.4 Placeringen (del B)

Ren logik i `utils/mindmapPlacement.ts` (finns, med test):

- **Alt+dra, `placeNodeAlone(content, id, delta, layout)`**: noden får
  `delta` lagt på sin förskjutning, och varje barn får `-delta`, så att
  barnen står kvar. Sidbytet i `both` görs inte med Alt: noden behåller
  sin sida och kan hamna på andra sidan om roten. Linjen följer då
  närmaste kant.
- **Roten, `placeRoot(content, delta)`**: sätter rotens `offset`. Den
  delade `setOffset` vägrar fortfarande roten (kortets beteende), så
  sidan får en egen `setRootOffset` i `utils/mindmapPlacement.ts`.
- **Sidbytet med en flyttad rot**: i dag byter en gren sida när den
  släpps på andra sidan om rotens mitt. Med en flyttad rot kan en gren
  redan stå på "fel" sida. Regeln blir att **grenen byter sida bara när
  draget korsar rotens mitt** (före: rätt sida, efter: fel sida). För en
  rot som inte flyttats är det samma sak som i dag (test).
- **Rutnät, `snapToGrid(content, id, offset, layout, size = 20)`**: räknar
  vilken förskjutning som lägger nodens övre vänstra hörn på rutnätet.
  Rutnätet räknas från rotens automatiska mitt, som inte flyttas när
  kartans mått ändras. Snäppningen görs också medan noden dras, så att
  den syns där den hamnar.
- **Städa upp grenen, `clearBranchOffsets(content, id)`**: tar bort
  förskjutningen på noden och alla under den. Hela kartan: den delade
  `clearOffsets` tar redan bort alla, också rotens (test).

Draget lyfts ur `MindmapCanvas.tsx` till en ny hook,
`hooks/useMindmapNodeDrag.ts`, **innan** något läggs till (`CLAUDE.md` och
"Känt" i huvudplanen). Utbrytningen är en egen commit utan ändrat beteende.
Hooken läser `altKey` och `ctrlKey` vid varje rörelse, så att man kan
trycka ned eller släppa Alt mitt i draget.

### 2.5 Linjen som markeras (del C)

- Varje kant får en osynlig, 10 px bred `path` för träffen, under
  noderna. Ett klick markerar linjen (`selectedEdge`: barnets id). Det
  avmarkerar noden, som tvärlänkarna gör i dag, och Esc avmarkerar.
- `components/mindmap/MindmapEdgeBar.tsx`: raden över kartan, med form
  (Kartans, Kurva, Rak, Vinklad), start, fäste och "Återställ linje".
  Den liknar `MindmapLinkBar`, som får formen och fästena i samma veva.
- Handtagen: en ring på varje ände. När man drar i en ring väljs den sida
  av samma nod som ligger närmast pekaren (`nearestSideTo(box, point)`).
  Ett dubbelklick på ringen sätter fästet tillbaka till kartans.
- Läget hålls i `hooks/useMindmapEdgeSelection.ts`.
- `commit` i `MindmapCanvas` tar bort `edge.from`, `edge.to` och
  `edge.points` på en nod vars förälder bytts (`pruneEdgeAnchors(prev,
  next)` i `utils/mindmapRouting.ts`, med test), som `pruneCrossLinks` gör
  för länkarna.
- Tangenter: inga nya i del C. En markerad linje tas inte bort med Delete
  (den finns så länge noden finns).

### 2.6 Brytpunkter (del D)

- Ett dubbelklick på en markerad linje lägger en punkt där man klickade,
  i rätt ordning längs linjen (`insertPoint(route, points, at)`, med
  test). Punkten dras dit man vill, och ett dubbelklick på den tar bort
  den.
- Punkterna räknas från **förälderns mitt** (för en tvärlänk: från
  från-nodens mitt). Flyttas föräldern eller hela grenen följer de med,
  och flyttas bara barnet står de kvar.
- Ruttningen tar med punkterna i kartans mått.
- Rutnätet gäller också punkterna.

### 2.7 Filer

Nya:

```
src/utils/mindmapEdges.ts               (+test)  A: sidor, rutter, SVG och canvas
src/utils/mindmapRouting.ts             (+test)  A: routeMindmap; C: pruneEdgeAnchors
src/hooks/useMindmapNodeDrag.ts                  B: draget, utbrutet ur canvasen
src/hooks/useMindmapEdgeSelection.ts             C: markerad linje, handtag
src/components/mindmap/MindmapEdgeBar.tsx        C: linjens rad
src/components/mindmap/MindmapLinesMenu.tsx      A: kartans form och fäste; B: rutnät
```

Ändrade, sidans egna: `MindmapCanvas.tsx` (anrop, inte logik),
`MindmapPresent.tsx`, `MindmapMinimap.tsx`, `useMindmapExport.ts`,
`MindmapLinkLayer.tsx`, `MindmapLinkBar.tsx`, `mindmapCrossLinks.ts`
(+test), `mindmapCrossLinkDraw.ts`, `mindmapPlacement.ts` (+test),
`mindmapDoc.ts` (+test), `types/mindmapDoc.ts`, `MindmapToolbar.tsx`,
`MindmapHelp.tsx`, `mindmap.css`, `config/shortcuts.ts` (raderna för Alt+dra
och Ctrl).

Delade, bara med valfria tillägg: `types/mindmap.ts` (`edge`),
`utils/mindmap/mindmapTree.ts` (tvätten av `edge`, med test),
`utils/mindmap/mindmapDraw.ts` (`transform`, `edges`).

**Rörs inte:** `mindmapLayout.ts`, `mindmapKeys.ts`, `navigate`,
`setOffset`, allt under `src/app/workspace/_feature/`.

## 3. Skyddsreglerna här

1. **Workspace-kortet.** Kortet anropar `layoutMindmap`, `edgePath` och
   `renderMindmapCanvas` utan de nya valen. De två första ändras inte
   alls, och den tredje bara med valfria val. Test: `renderMindmapCanvas`
   utan val gör samma anrop som före ändringen (en uppspelande
   canvas-mock, som i `mindmapExtras.test.ts`). Kortets egna tester ska
   vara gröna och orörda.
2. **Gamla kartor ser ut som i dag.** Utan `lines` blir fästet "efter
   grensidan" och formen kurva, och `routeMindmap` ger då samma tal som
   dagens kanter. Det prövas på kartan "Förskjutna" och på fixturerna i
   `mindmapLayout.test.ts`.
3. **Ingen nod flyttar** av ändringen. `routeMindmap` flyttar bara roten,
   och bara när roten har en förskjutning. Det kan ingen gammal karta ha.
4. **Inga nya beroenden.**
5. **`MindmapCanvas.tsx` växer inte med logik.** Draget bryts ut först
   (del B). Varje del får lägga till högst 60 rader där; blir det mer
   bryts något ut först.

## 4. Steg

### Del A. Linjernas geometri och kartans val

- [x] Genomfört: 2026-11-12, #280

**Så blev det.** Nya filer: `utils/mindmapEdges.ts` (+test, 12 st),
`utils/mindmapRouting.ts` (+test, 7 st), `utils/mindmap/mindmapDraw.test.ts`
(2 st, skyddsregel 1) och `components/mindmap/MindmapLinesMenu.tsx`. Två
tester till i `mindmapDoc.test.ts`. Efter delen: 109 testfiler, 1 716
tester (106 och 1 693 före). `MindmapCanvas.tsx` växte med 7 rader till
1 265.

- Knappen "Linjer" (kurvikonen) står efter färgen i verktygsraden, med
  Form (Kurva, Rak, Vinklad) och Fäste (Närmaste kant, Efter grensidan).
  Ett val är ett ångra-steg.
- Avvikelse: `routeEdges(layout, doc)` ger en lista med linjer bredvid
  layouten, inte en ny layout med `routes`. Måtten behöver inte räknas om i
  del A: alla tre formerna håller sig inom rutan som ändarna spänner upp.
  Rotens förskjutning, och därmed `transform` i `mindmapDraw.ts` och den
  nya beräkningen av måtten, kommer i del B.
- Avvikelse: bara `edges` lades till i `MindmapDrawOptions`; `transform`
  väntar till del B, där den behövs.
- Avvikelse: `routeEdge` räknar inte ut mittpunkt eller riktning. Det
  behövs först för tvärlänkarnas etikett och pil (del C).
- Avvikelse: `MindmapEdgeShape` och `MindmapAnchor` ligger redan i den
  delade `types/mindmap.ts` (bara typer, inget beteende), så att del C
  inte behöver flytta dem.
- Avvikelse: en `.mup`-import får inget `lines`, och följer alltså
  grensidan, som nyanserna (`shading`) gör. Den har inga förskjutningar,
  så den ritas likadant med båda fästena.
- Med närmaste kant går en nod som överlappar sin förälder i x-led (som
  Republik i kartan "Förskjutna", som ligger delvis över roten) ut uppåt
  eller nedåt. Det följer regeln, men det ser tvärt ut när noderna ligger
  över varandra.

**Kontrollerat 2026-11-12.** `tsc`, `lint` (bara den gamla varningen i
`WorkspaceShell.tsx`), `test`, `build`. I Chromium mot mock-API:t med
kartan "Förskjutna": kartans yta är **pixelidentisk** med `main` innan
något valts (jämfört bild mot bild). Närmaste kant med kurva, rak och
vinklad på skärmen, i minikartan, i presentationen och i den exporterade
PNG:n, som alla visar samma linjer. Kronberg. Valet finns kvar efter
omladdning och sparas som `lines` i dokumentet.

**Inte kontrollerat.** Workspace-kortet i webbläsaren; dess filer är
orörda, och den delade ritningen utan `edges` är prövad i
`mindmapDraw.test.ts`. PDF och urklippsbild går genom samma `draw` som
PNG:n men är inte öppnade. Riktig backend.

1. `utils/mindmapEdges.ts` med test, skrivet först: `nearestSides` i de
   fyra riktningarna och för överlappande rutor, de tre formerna med och
   utan punkter, kurvan höger mot vänster är exakt `edgePath`, SVG och
   canvas ger samma kommandon.
2. `utils/mindmapRouting.ts` med test: en karta utan `lines` ger dagens
   kanter, närmaste kant rättar den bakåtvända S-kurvan, en orörd karta
   ger samma ändar med båda fästena, och måtten ryms.
3. `lines` i `types/mindmapDoc.ts`, tvätten och förvalet i `mindmapDoc.ts`
   med test.
4. `transform` och `edges` i `mindmapDraw.ts`, med testet för kortet
   (skyddsregel 1).
5. Skärmen, presentationen, minikartan och exporten läser ruttningen.
6. `MindmapLinesMenu`: form och fäste för kartan, i verktygsraden.

**Klart när** kartan "Förskjutna" ser ut som i dag före bytet, och utan
bakåtvända S-kurvor efter bytet till närmaste kant, på skärmen och i PNG:n.

### Del B. Placering

- [x] Genomfört: 2026-11-12, #280

**Så blev det.** Draget lyftes först ut till `hooks/useMindmapNodeDrag.ts`
i en egen commit (c9169c1) utan ändrat beteende, prövat i Chromium med
stegets 5 prov: grenen följer, roten och syskonen står still, ångra, klick
efter drag, släpp på en annan nod. Ny testfil:
`utils/mindmapPlacementFree.test.ts` (13 st), och ett test var för
rutnätet i `mindmapDoc.test.ts` och `mindmapRouting.test.ts`. Efter delen:
110 testfiler, 1 731 tester. `MindmapCanvas.tsx` är 1 234 rader (1 265
efter del A).

- Alt under draget flyttar bara noden (`placeNodeAlone`). Alt läses vid
  varje rörelse, så det går att trycka ned eller släppa Alt mitt i draget.
  Ett släpp på en annan nod byter förälder som förut, också med Alt.
- Roten dras i hela kartan och flyttas ensam (`placeRoot`). I grenvyn står
  grenens rot still som förut. Alt+Shift+0 på roten tar bort rotens
  förskjutning.
- Kartans lager har kvar rotens **automatiska** mitt som origo
  (`rootOrigin`), så att resten av kartan står still på skärmen medan roten
  dras, och en sparad vy gäller som förut.
- `placeRootInLayout` i `utils/mindmapRouting.ts` flyttar roten och
  linjerna från den, och räknar om kartans mått. Sidans `layoutOf`, PNG,
  PDF, minikartan och presentationen går genom den (`transform` i
  `mindmapDraw.ts` för bilderna).
- Sidbytet i `both` sker bara när draget korsar rotens mitt (test, också
  med en flyttad rot).
- Rutnätet slås på i menyn Linjer ("Rutnät"). Prickarna (`.mm__grid`) når
  minst 4 000 px från roten åt alla håll. Nodens övre vänstra hörn snäpper
  under draget, och med Ctrl (Cmd) snäpper det inte. Rutnätet ritas inte
  i exporten.
- Knappen för att nollställa blev menyn **Städa upp**, med *grenen* (den
  markerade noden och allt under, `clearBranchOffsets`) och *hela kartan*.
  Med roten markerad städar *grenen* hela kartan.
- Avvikelse: den delade `hasOffsets` räknar inte roten (kortet flyttar den
  aldrig). Sidan använder `hasPlacement` i `mindmapPlacement.ts`, så att
  "Städa upp" går att välja när bara roten är flyttad.
- Avvikelse: `--mm-grid` blandas ur `--ui-control-line` och följer med
  temat utan ett eget värde för Kronberg.
- Avvikelse: raderna om Alt+dra, att dra roten och Ctrl står i
  `MindmapHelp.tsx`, där sidans kortkommandon finns. `config/shortcuts.ts`
  hänvisar dit och är orörd.
- I grenvyn utgår rutnätet från grenens rot, inte från kartans. En nod
  som snäpps där hamnar alltså på grenens rutnät.
- En gammal karta med fästet "efter grensidan" och en flyttad rot får
  linjer som går från rotens sida rakt ned till en gren under den. Med
  "Närmaste kant" blir de raka. Det är ett skäl att byta i gamla kartor.

**Kontrollerat 2026-11-12.** `tsc`, `lint` (bara den gamla varningen),
`test`, `build`. I Chromium mot mock-API:t: Alt+dra en förälder (den
flyttas 80,40, barnen står still på pixeln), dra roten (grenarna står
still), ångra rotens flytt, Alt+Shift+0 på roten, rutnätet syns och
sparas som `grid`, en nod dragen med rutnätet hamnar på det, med Ctrl
fritt (33,17 px), städa en gren (bara den grenen tillbaka), grenens rot
står still i grenvyn, PNG-exporten med flyttad rot (samma som skärmen,
utan rutnät), Kronberg. Inga fel i konsolen.

**Inte kontrollerat.** Alt+dra i Firefox (Alt kan visa menyraden när den
släpps), på Mac (Option) och i Linux med en fönsterhanterare som tar
Alt+dra. Workspace-kortet i webbläsaren; dess filer är orörda. Riktig
backend.

1. Draget bryts ut till `useMindmapNodeDrag`, utan ändrat beteende (en egen
   commit, kontrollerad med samma Playwright-prov som steg 5).
2. `placeNodeAlone`, `setRootOffset`, `placeRoot`, sidbytet som kräver att
   draget korsar mitten, `snapToGrid` och `clearBranchOffsets`, med test.
3. Rotens förskjutning i `routeMindmap`, med test (roten flyttas, inget
   annat; måtten ryms).
4. Alt under draget, roten går att dra (inte i grenvyn, där grenens rot
   står still som i dag), Ctrl stänger av snäppningen.
5. "Städa upp": knappen i verktygsraden blir en meny med *Grenen* och
   *Hela kartan*. Alt+Shift+0 gör som i dag (bara noden).
6. Rutnätet i `MindmapLinesMenu` och som bakgrund i kartans lager
   (`--mm-grid`, en ny token i `mindmap.css` med ett värde per tema).
   Det ritas inte i exporten.

**Klart när** en nod går att flytta ensam med Alt, roten går att dra med
grenarna kvar, en gren går att städa och rutnätet snäpper, och alla
ändringar går att ångra i ett steg.

### Del C. Inställningar per linje

- [x] Genomfört: 2026-11-12, grenen `claude/mindmap-placering` efter #280

**Så blev det.** Nya filer: `hooks/useMindmapEdgeSelection.ts`,
`components/mindmap/MindmapEdgeLayer.tsx` (linjerna med träffytor, och
handtagen), `components/mindmap/MindmapEdgeBar.tsx` (raden, med formknappar
och fästval som tvärlänkarnas rad också använder) och
`utils/mindmapLineStyle.test.ts` (13 st). Efter delen: 111 testfiler,
1 744 tester. `MindmapCanvas.tsx` är 1 290 rader (+56).

- Ett klick på en linje markerar den. Raden över kartan har form
  (Kartans, Kurva, Rak, Vinklad), Start och Fäste (Kartans, Upp, Höger,
  Ned, Vänster), Återställ och Stäng. Ett val som inte görs följer menyn
  Linjer.
- Den markerade linjen får en ring på varje ände. När en ring dras väljs
  den sida av noden som pekaren är närmast, räknat mot nodens mått
  (`nearestSideTo`). Ett dubbelklick på en ring tar bort fästet.
- Esc avmarkerar. Delete och Backspace gör ingenting när en linje är
  markerad, så att noden inte tas bort. Andra tangenter avmarkerar linjen
  och går till kartan. Att markera en linje avmarkerar en tvärlänk, och
  tvärtom.
- `commit` kör `pruneEdgeAnchors`: en nod som fått en annan förälder
  tappar sina fästen men behåller formen, i samma ångra-steg.
- Tvärlänkarna: raden har Böjd (dagens kurva), Kurva, Rak och Vinklad, och
  Start och Fäste (Auto eller en sida). Med en form går länken samma
  linjer som grenarna, från de sidor som vetter mot varandra när fästet är
  Auto. Pilen riktas efter linjens sista bit. Ett fäste på den böjda kurvan
  flyttar bara änden. "Byt riktning" tar med fästena.
- Avvikelse: `edge` på noden har bara `shape`, `from` och `to`; `points`
  läggs till i del D, där det används.
- Avvikelse: `sanitizeEdgeStyle` ligger i den delade `mindmapTree.ts` och
  används också för tvärlänkarnas fält. Konstanterna
  `MINDMAP_EDGE_SHAPE_VALUES` och `MINDMAP_ANCHORS` ligger i den delade
  `types/mindmap.ts`.
- En gren som klistras in behåller sina linjeval. Rotens fästen i den
  inklistrade grenen gällde den gamla föräldern; de tas inte bort, för
  `pruneEdgeAnchors` känner bara igen noder som fanns före ändringen.
- Ett fäste kan leda linjen genom en annan nod (som en vinklad tvärlänk
  uppåt genom ett syskon). Inget hindrar det.

**Kontrollerat 2026-11-12.** `tsc`, `lint` (bara den gamla varningen),
`test`, `build`. I Chromium mot mock-API:t: klick på en linje ger raden
"Politik → Kejsardöme", Rak, Fäste Ned (sparat som `edge`), dra
starthandtaget till förälderns överkant (`from: top`), dubbelklick på
handtaget, Delete med markerad linje (noden kvar), ångra, Esc, flytt till
en annan förälder (fästena borta, formen kvar), tvärlänk Vinklad med Start
Upp (sparat och ritat), Kronberg, PNG-exporten med samma linjer. Inga fel i
konsolen.

**Inte kontrollerat.** Workspace-kortet i webbläsaren; dess filer är
orörda, och tvätten av `edge` är prövad i test. Riktig backend. Pekskärm.

1. `edge` i den delade typen och tvätten, med test (också att ett tomt
   `edge` tas bort och att kortets tester är gröna).
2. `pruneEdgeAnchors` med test, och anropet i `commit`.
3. `useMindmapEdgeSelection`, träffytan, `MindmapEdgeBar`, handtagen.
4. Tvärlänkarna: `shape`, `fromAnchor` och `toAnchor` i typen och tvätten,
   `crossLinkGeometry` använder `routeEdge` när länken har en form (test:
   en länk utan val ger samma tal som i dag), och valen i
   `MindmapLinkBar`.

**Klart när** en linje går att göra rak, fästa i en annan sida med ett drag
och återställa, och en tvärlänk går att göra vinklad, med samma utseende i
PNG:n.

### Del D. Brytpunkter

- [ ] Genomfört

1. `insertPoint`, punkterna i `routeEdge` och i måtten, med test.
2. Dubbelklick för att lägga till och ta bort, dra punkten, rutnätet.
3. Tvärlänkarnas punkter.

**Klart när** en linje går att leda runt en annan gren genom två punkter,
punkterna följer med när föräldern flyttas, och PNG:n visar samma linje.

## 5. Tester

Ren logik med test, skrivet före koden som använder den:

- `mindmapEdges.test.ts`: sidorna, formerna och likheten med `edgePath`.
- `mindmapRouting.test.ts`: gamla kartor identiska, närmaste kant, roten,
  måtten och `pruneEdgeAnchors`.
- `mindmapPlacement.test.ts` (finns): Alt-flytten (barnen står kvar på
  pixeln), roten, sidbytet med flyttad rot, rutnätet, städningen.
- `mindmapDoc.test.ts`, `mindmapTree.test.ts`, `mindmapCrossLinks.test.ts`
  (finns): tvätten av de nya fälten, förvalen och tvärlänkarnas likhet med
  i dag.
- `mindmapExtras.test.ts` (finns): `renderMindmapCanvas` utan nya val
  ritar som förut.

## 6. Verifiering

Automatiskt för varje del: `pnpm exec tsc --noEmit`, `pnpm lint`, `pnpm
test`, `pnpm build`. Baslinjen 2026-11-12 räknas och skrivs in i del A.

I Playwright mot mock-API:t (port 5001, appen med
`NEXT_PUBLIC_API_URL=http://localhost:5001/api pnpm dev -p 3077`), i Neo
och Kronberg:

1. Kartan "Förskjutna" (förskjutna barn på båda sidor, en tvärlänk):
   skärmbilder före och efter del A, tagna med fästet "efter grensidan".
   De ska vara identiska. Ta sedan bilder efter bytet till närmaste kant.
2. De tre formerna på skärmen, i presentationen, i minikartan, i grenvyn
   och i PNG:n.
3. Del B: Alt+dra en förälder (barnen står kvar), dra roten, sidbyte i
   `both` med flyttad rot, rutnätet med och utan Ctrl, städa en gren,
   ångra. Allt finns kvar efter omladdning.
4. Del C: markera en linje, byt form, dra ett handtag, återställ, flytta
   noden till en annan förälder (fästena borta, formen kvar), en vinklad
   tvärlänk.
5. Del D: två punkter, flytta föräldern, ta bort en punkt.
6. Regression: skriva med Tab och Enter, färg, hopfällning, zoom,
   tvärlänk, anteckning, sparning och 409, PNG och JSON.
7. Workspace: öppna ett mindmap-kort, skriv, byt färg, exportera. Kortet
   ska se ut som förut. (Ingen session har gjort det i webbläsaren sedan
   steg 0. Gör det här om mock-API:t räcker för workspace, och skriv
   annars att det inte är gjort.)

## 7. Risker

- **Kortet.** Skyddet är att `layoutMindmap` och `edgePath` inte rörs och
  att `renderMindmapCanvas` utan val är oförändrad (test).
- **Gamla kartor byter utseende.** Skyddet är att fästet saknas i dem, och
  testet att "efter grensidan" ger dagens tal.
- **Alt+dra i Linux.** Vissa fönsterhanterare (KDE, Xfce) flyttar fönstret
  med Alt+dra, och då når draget aldrig sidan. I Windows och på Mac
  (Option) fungerar det. Blir det ett problem kan modifieraren bytas
  utan att något annat ändras.
- **Roten flyttad långt bort** gör att grenar till höger kan stå till
  vänster om roten. Närmaste kant gör linjerna rätt, och sidbytet kräver
  att draget korsar mitten. Det är ändå en ovan bild, och den prövas i
  verifieringen.
- **Rutt under drag.** Ruttningen räknas för varje pekarrörelse, som
  layouten redan gör. Den är linjär i antal kanter och billig jämfört med
  textmätningen.
- **Vinklad form med noder ovanför varandra** kan ge en linje som löper
  längs en nods kant. Den går då ut från upp- eller nedsidan (närmaste
  kant), vilket prövas i testerna.
- **`MindmapCanvas.tsx` är stor.** Draget bryts ut i del B och linjens
  markering läggs i en egen hook i del C.

## 8. Alternativ som vägdes

| | Rör | Kostar | Risk för kortet och det som finns |
|---|---|---|---|
| **1. Ruttning efter layouten, i sidans egen kod** (vald) | En ny ren funktion efter `layoutMindmap`; två valfria val i `mindmapDraw.ts`; ett valfritt fält i den delade typen och tvätten. | Medel. Allt nytt testas utan DOM. | Lägst: layouten och `edgePath` rörs inte, och ritningen ändras bara med valen. |
| **2. Allt i den delade layouten** (`routing` som val i `layoutMindmap`, rutten på `LaidOutEdge`) | Den delade layouten, dess typer, `edgePath`, ritningen. | Ungefär samma. | Högre: varje ändring går genom koden kortet kör. Ett fel i ett valfritt läge kan ändå röra en gemensam väg. |
| **3. Fria lägen (`pos`) i stället för förskjutningar**, som i den osammanslagna `mindmap-pa-ytan.md` | Modellen, layouten, placeringen, importen och exporten. | Störst, och gamla kartor måste föras över. | Hög: steg 5 är byggt på förskjutningar, och en överföring kan flytta noder. |

Rekommendationen är 1. Den ger allt i besluten. Alt-flytten och den
flyttade roten blir uttryckta som förskjutningar, så steg 5 står kvar som
det är.

## 9. Öppna frågor

Inga. Detaljer som bestämts i planen utan intervju, och som kan ändras vid
genomgången:

- Rutnätet är 20 px, och det räknas från rotens automatiska mitt.
- Städa upp lämnar linjernas val kvar.
- Ett byte av förälder tar bort fästen och punkter men behåller formen.
- Delete på en markerad linje gör ingenting.
