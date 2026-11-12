# Mindmap: egna färger och nyanser nedåt i grenen

Status: Planerad

Planen är skriven 2026-11-12 efter en intervju med Tobias, mot koden på
`main` (0e7fa26: 1 236 rader i `MindmapCanvas.tsx`). Den omprövar ett
beslut i [`mindmap-sida.md`](mindmap-sida.md) (avsnitt 9 och 12, steg 4):
att färgen alltid sparas på noden och att inget arv räknas ut vid ritning.
Skyddsreglerna i den planen gäller oförändrade; avsnitt 3 nedan säger hur
de tillämpas här. Bygg inte förrän Tobias sagt till.

Underlaget för besluten om nyanserna är en ritning med appens verkliga
värden i båda temana: <https://claude.ai/artifact/6n15NW3cmCq51eX21ybRtG>.

Tre delar, var och en en PR som lämnar sidan hel:

- **A. Modell och ritning.** Egna färger och nyanser finns i datan och
  ritas på skärmen, i minikartan, i presentationen och i PNG/PDF.
- **B. Färgmenyn.** Paletten som fälls ut, egen färg, de senaste, valet
  av nyanser per karta, "Ingen färg" och "Hela grenen".
- **C. `.mup`-importen** behåller en färg som egen färg.

## 0. Hur det fungerar i dag

Kontrollerat i koden 2026-11-12.

| Vad | Var | I dag |
|---|---|---|
| Typen (delad) | `src/types/mindmap.ts` | `color?: MindmapColor`, sex namn. |
| Tvätt (delad) | `sanitizeMindmap` i `utils/mindmap/mindmapTree.ts` | Släpper allt utom de sex namnen. |
| Sätta färg (delad) | `setColor`, `setColorDeep` i `mindmapTree.ts` | Sätter eller tar bort namnet; "Hela grenen" skriver samma namn på alla under. |
| Ny nod | `run` i `MindmapCanvas.tsx`, `addChild` och `addSibling` | Får förälderns färg sparad på sig. |
| Skärmen | `MindmapNodeView.tsx`, `mindmap.css` | Klassen `mm__node--<namn>`, bakgrund `var(--mm-c-<namn>)` ur `--ui-mark-*`. |
| Linjer | `.mm__edge` | Alltid `--mm-line`. |
| Bild, PDF, minikarta (delad) | `utils/mindmap/mindmapDraw.ts` | `palette.colors[node.color]`; paletten läses ur CSS av `readPalette` (`mindmapCanvasIo.ts`), i Neo för export och i aktuellt tema för minikartan. |
| Tangenter (delad) | `COLOR_DIGITS` i `mindmapKeys.ts` | Alt+1–6 sätter ett av de sex, Alt+0 tar bort. |
| Tvärlänkar | `types/mindmapDoc.ts`, `MindmapLinkBar.tsx` | `color?: MindmapColor`. |
| `.mup` | `nearestMindmapColor` i `utils/mindmapMup.ts` | Närmaste av de sex i kulörton. |
| Färgväljare | `components/ui/ColorPicker.tsx` | Palett, `<input type="color">`, senaste (`useRecentColors`). Tailwind-grått och runda knappar med inline-färg. |
| Förebild för egen färg | `.ui-course-fill` i `globals.css` | Kronberg: `color-mix(in oklab, färg var(--ui-course-mix), var(--ui-course-base))`, 54 % mot `#D8D6D0`. Neo: 100 %. |

**Kortet och sidan delar inga dokument.** Kortet sparas som ett
workspace-element och läser inte `data-mindmap` ur urklipp (kontrollerat i
radbrytningsplanen 2026-11-12). Ett nytt fält kan alltså inte nå kortet.

Backend lagrar dokumentet som det kommer och behöver ingen ändring. En
egen färg är 7 tecken per nod; 1 MB-gränsen påverkas inte märkbart.

## 1. Beslut

| # | Fråga | Beslut |
|---|---|---|
| 1 | Egna färger | **Båda**: en större fast palett och en fri färg med färgväljaren, plus de senast valda egna färgerna. |
| 2 | Kronberg | En egen färg **dämpas som schemats kurser**: `--ui-course-mix` av färgen mot `--ui-course-base`. Neo visar den som den valdes. De sex namngivna färgerna följer sina tokens som i dag. |
| 3 | Var paletten öppnas | **I färgmenyn** i verktygsraden: de sex som i dag, och "Fler färger" som fäller ut paletten, "Egen färg" och de senaste. |
| 4 | Alt+1–6, Alt+0 | **Oförändrade.** Sätter ett av de sex och tar bort färgen. `COLOR_DIGITS` rörs inte. |
| 5 | Nyanser nedåt | **Räknas vid ritning.** Bara noden man färgade sparar färgen. Noderna under får nyanser efter avståndet till den, och följer med när färgen byts eller noden flyttas. |
| 6 | Steg | **B som förval**: nivå 1 är 55 % färgen, nivå 2 är 25 %, nivå 3 och djupare har bara kant. A (70/45/25 %, kant från nivå 4) och C (80/60/40 %, kant från nivå 4) går att välja **per karta**, och "Av" ger dagens beteende. |
| 7 | Kanten längst ned | **Mörkare än färgen**: 70 % färgen och 30 % textfärgen, så att också gult och Kronbergs pasteller syns. Bakgrunden är nodens vanliga. |
| 8 | Linjerna | **Som i dag**, neutrala. |
| 9 | En nod under en färgad gren | Kan få **en egen färg** (den börjar en ny gren av nyanser) eller **"Ingen färg"**, som sparas som ett undantag och gäller också noderna under den. |
| 10 | Gamla kartor | **Ser ut som i dag.** Deras noder har färgen sparad, och ett sparat värde vinner över arvet. |
| 11 | "Hela grenen" | Sätter färgen på noden och **tar bort sparade färger under**, så att grenen får nyanser. Med nyanserna "Av" gör den som i dag. |
| 12 | Ny nod | **Sparar ingen färg** utan ärver. Med nyanserna "Av" får den förälderns färg sparad, som i dag. |
| 13 | Workspace-kortet | **Bara sidan.** Allt nytt i delad kod är valfritt; kortet anropar som förut och beter sig exakt som i dag. |
| 14 | `.mup` | En bakgrundsfärg blir **en egen färg med sitt exakta värde**. Vitt och genomskinligt blir ingen färg som i dag. Tvärlänkarnas färg väljs som i dag bland de sex. |
| 15 | Tvärlänkar | **Oförändrade**: de sex färgerna. |

Två följder av beslut 6, 10 och 12 som står här så att de inte blir en
överraskning:

- **Valet av nyanser sparas i kartan**, `shading` i `MindmapDoc`. En karta
  som saknar fältet (alla kartor före del A) läses som "Av", så att den
  beter sig exakt som i dag också när nya noder skapas. En ny karta får
  "B"; en kopia får originalets val. En `.mup`-import får "Av" (del C,
  öppen fråga 1). En gammal karta får
  nyanser genom att välja dem i färgmenyn; dess sparade färger står kvar
  tills "Hela grenen" används på en gren.
- **Nyansen räknas från närmaste nod med sparad färg**, inte från roten. En
  färgad rot färgar alltså hela kartan i nyanser.

## 2. Utformning

### 2.1 Datan

I den delade typen (`src/types/mindmap.ts`), två valfria fält på
`MindmapNode`, i blocket "Fälten nedan tillkom för Mindmap-sidan":

```ts
/** Egen färg, `#rrggbb`. Vinner över `color`. Bara sidan ritar den. */
customColor?: string;
/** "Ingen färg" under en färgad gren: noden och noderna under ärver inte. */
colorNone?: true;
```

`color` behåller sin typ, så att kortet, tangenterna och tvärlänkarna är
orörda. En nod har högst ett av `color`, `customColor` och `colorNone`;
tvätten håller det (ordningen `customColor`, `color`, `colorNone`).

`sanitizeMindmap` behåller `customColor` om det matchar
`/^#[0-9a-f]{6}$/i` (sparas med gemener) och `colorNone` om det är `true`.
Kortet bevarar alltså fälten om de någonsin kom dit, men visar dem inte.

I sidans dokument (`types/mindmapDoc.ts`):

```ts
export type MindmapShading = 'off' | 'short' | 'medium' | 'soft';
/** Nyanser nedåt. Saknas betyder 'off' (kartor från före nyanserna). */
shading?: MindmapShading;
```

`short` är B, `medium` A och `soft` C. `sanitizeMindmapDoc` släpper
okända värden; `defaultMindmapDoc` sätter `'short'`.

### 2.2 Färgmatematiken (`utils/mindmapPaint.ts`, ny, med test)

Rena funktioner utan DOM:

- `parseHexColor`, `mixOklab(a, b, p)`: blandning i oklab, som
  `color-mix(in oklab, a p, b)`. Den finns inte i dag (`readableTextColor.ts`
  har bara luminans). Ger `#rrggbb`.
- `SHADING_STEPS: Record<MindmapShading, number[]>`, t.ex. `short: [0.55, 0.25]`.
- `resolveMindmapPaint(root, shading, theme) → Map<id, NodePaint>`, där
  `theme` är `{ colors: Record<MindmapColor, string>; nodeBg; text;
  customMix; customBase }` (värden lästa ur CSS) och
  `NodePaint = { fill: string; border?: string; outline: boolean; text: string }`.
  Ett varv djupet först med "närmaste färgade förfader och avståndet":
  - `customColor` → bas `mixOklab(hex, customBase, customMix)`, nivå 0.
  - `color` → bas `colors[color]`, nivå 0.
  - `colorNone` → ingen bas för noden och grenen under.
  - annars, med `shading` annat än `off`: förälderns bas, nivå + 1.
  - Nivå 0 ger basen. Nivå 1…n ger `mixOklab(bas, nodeBg, steg)`. Djupare
    ger `fill: nodeBg`, `border: mixOklab(bas, text, 0.7)`, `outline: true`.
  - `text` väljs med `getReadableTextColor` mot `fill` (befintlig, i
    `utils/readableTextColor.ts`), men bara när kontrasten mot temats
    textfärg är för låg; annars temats textfärg. Så ändras inget för de
    sex färgerna.
  - Noder utan färg finns inte i kartan; de ritas som i dag.
- `colorForNewNode(doc, parentId)`: färgen en ny nod ska spara (beslut 12).
- `setNodePaint(content, id, paint)` och `setBranchPaint(content, id, paint, shading)`,
  där `paint` är `{ color } | { customColor } | { none: true } | null`.
  Nya funktioner; `setColor` och `setColorDeep` lämnas orörda för kortet
  (skyddsregel 6).

Kronbergs `--ui-course-base` finns bara i Kronberg; i Neo är
`--ui-course-mix` 100 %, så basen används inte där. `readPalette` faller
tillbaka på nodens bakgrund när den saknas.

### 2.3 Skärmen

`MindmapCanvas` räknar `resolveMindmapPaint` en gång per dokument och
tema (`useUiTheme` ger temat; värdena läses ur CSS med `readPalette(…,
keepTheme = true)`, som minikartan redan gör) och ger varje
`MindmapNodeView` sin `NodePaint`. Noden får klassen `mm__node--paint` och
CSS-variabler i `style`:

```css
.mm__node--paint {
  background: var(--mm-paint-fill);
  color: var(--mm-paint-text);
}
.mm__node--paint-outline {
  border-color: var(--mm-paint-border);
  box-shadow: inset 0 0 0 1px var(--mm-paint-border);
}
```

Kanten görs 2 px tjock med `box-shadow` och inte med `border-width`, så att
måtten i `MINDMAP_METRICS` (som layouten och texten bygger på) inte ändras.
De gamla klasserna `mm__node--<namn>` står kvar för det som inte går genom
färgen, t.ex. rutorna i menyn.

Värdena i `style` kommer ur tokens och ur användarens färg; inget hex
skrivs i koden. Det är samma ställning som schemats kurser: en färg som
användaren valt är innehåll. Paletten i 2.5 är en lista med värden att
välja bland, som `COURSE_COLOR_PALETTE` i `config/plannerConstants.ts`.

Grenvyn och presentationen ritar med `MindmapNodeView` och får färgerna av
samma `Map`, räknad på **hela** kartan, så att en gren har samma nyanser
ensam som i kartan.

### 2.4 Bild, PDF, urklippsbild, minikarta

`mindmapDraw.ts` (delad) får ett valfritt `paints?: Map<string, NodePaint>`
i `MindmapDrawOptions`. Med det ritas `fill`, `border` (2 px med
`outline`) och `text` därifrån; utan det som i dag. Kortet anger det inte.
Canvas får färdiga `#rrggbb`, så frågan om `fillStyle` tål `color-mix()`
uppstår inte.

Exporten räknar färgerna med paletten i Neo (som i dag), minikartan med
paletten i aktuellt tema.

### 2.5 Färgmenyn (del B)

En ny fil, `components/mindmap/MindmapColorMenu.tsx`; `MindmapToolbar.tsx`
får bara anropet. `ColorPicker` återanvänds **inte** som den är: den har
Tailwind-grått och inline-stilade knappar, och den vill ha en enda färg som
`value`. Menyn använder i stället `useRecentColors` (nyckeln
`mindmap.recentColors.v1`, högst 8) och `<input type="color">` som
`ColorPicker`.

```
 ● ● ● ● ● ●  ⊘           de sex (Alt+1–6) och Ingen färg (Alt+0)
 ☐ Hela grenen
 ▸ Fler färger
   ○○○○○○○○○○○○           24 färger, två rader om tolv kulörer
   ○○○○○○○○○○○○           (en mörkare, en ljusare)
   Senaste: ○ ○ ○
   [Egen färg …]
 Nyanser nedåt:  Av · Korta · Mellan · Mjuka
```

- "Fler färger" minns om den är utfälld (`mindmap.colorMenu.v1`,
  `usePersistentState`).
- Paletten (`MINDMAP_PALETTE` i `config/mindmapPalette.ts`) är 24 färger
  i två rader. Ett utkast visas för Tobias i del B innan den spikas.
- En palettfärg och en egen färg sparas båda som `customColor`.
- "Nyanser nedåt" ändrar `shading` för kartan; det är en vanlig ändring
  med ångra.
- Menyns rutor för egna färger visar färgen dämpad i Kronberg, så att
  rutan ser ut som noden blir.

### 2.6 Filer

Nya: `utils/mindmapPaint.ts` (+ test), `components/mindmap/MindmapColorMenu.tsx`,
`config/mindmapPalette.ts`.

Ändrade, delade (bara valfria tillägg): `types/mindmap.ts`,
`utils/mindmap/mindmapTree.ts` (tvätten), `utils/mindmap/mindmapDraw.ts`
(`paints`).

Ändrade, sidans: `types/mindmapDoc.ts`, `utils/mindmapDoc.ts`,
`components/mindmap/MindmapCanvas.tsx` (anrop), `MindmapNodeView.tsx`,
`MindmapPresent.tsx`, `MindmapMinimap.tsx`, `mindmapCanvasIo.ts`
(`readPalette`), `MindmapToolbar.tsx`, `mindmap.css`, `MindmapHelp.tsx`,
`utils/mindmapMup.ts` (del C).

Orörda: allt under `src/app/workspace/_feature/`, `mindmapKeys.ts`,
`mindmapLayout.ts`, `tokens.css`, `ColorPicker.tsx`, backend.

## 3. Skyddsregler

Huvudplanens regler gäller. Här betyder de:

1. **Kortet ändrar inte beteende.** Inga filer under
   `src/app/workspace/_feature/` rörs. Det kortet anropar i den delade
   koden (`sanitizeMindmap`, `setColor`, `setColorDeep`, `drawMindmap`
   utan `paints`, `resolveMindmapKey`) ger samma resultat för allt kortet
   kan spara. Ett test i del A tvättar en karta med de nya fälten och
   kontrollerar att de sex färgerna och allt annat är som förut.
2. **Gamla kartor ser ut som i dag** (beslut 10). Ett test: en karta utan
   `shading` och med sparade färger ger samma färger per nod som i dag,
   och `colorForNewNode` ger förälderns färg.
3. **Inga nya tokens** och inga ändrade Neo-värden. Behövs en token ändå
   ska den stå i PR:en och gälla båda temana.
4. **Inga nya beroenden.** Oklab räknas i `mindmapPaint.ts`.
5. **`MindmapCanvas.tsx` får bara anrop.** Logiken ligger i
   `mindmapPaint.ts`; tillägget i filen ska vara under 40 rader.

## 4. Steg

### A. Modell och ritning

1. Typerna och tvätten (2.1), med test i `mindmapTree.test.ts` och
   `mindmapDoc.test.ts`.
2. `mindmapPaint.ts` med test (avsnitt 5).
3. Skärmen: `MindmapNodeView`, CSS, `MindmapCanvas` (färgerna, ny nod,
   Alt+1–6 och Alt+0 via `setNodePaint`).
4. Presentationen och grenvyn.
5. `drawMindmap` med `paints`; export, urklippsbild och minikarta.
6. Kontroller och visuell kontroll (avsnitt 6).

Efter A kan man inte välja egen färg ännu, men en ny karta får nyanser
när en nod färgas med Alt+1–6.

### B. Färgmenyn

1. Utkast till paletten, visat för Tobias.
2. `MindmapColorMenu.tsx`, palett, egen färg, senaste, "Hela grenen" med
   `setBranchPaint`, "Nyanser nedåt".
3. Hjälprutan (`MindmapHelp.tsx`) och kortkommandolistan om något ändrats
   (det gör det inte enligt beslut 4).
4. Kontroller och visuell kontroll.

### C. `.mup`-importen

1. `nodeFromMup` ger `customColor` med det exakta värdet; vitt, nästan
   vitt och genomskinligt ger ingen färg som i dag. En importerad karta
   får `shading: 'off'`, eftersom MindMup sparar en färg per nod och
   kartan ska se ut som i MindMup. `nearestMindmapColor` lämnas för
   tvärlänkarna.
2. Testen i `mindmapMup.test.ts` uppdateras för noderna; tvärlänkarnas
   står kvar.

### Öppna frågor

1. **Nyanser i en importerad `.mup`-karta.** Förslaget är "Av", eftersom
   MindMup sparar färgen per nod och kartan ska se ut som där. Tobias
   avgör före del C.
2. **Paletten.** Utkastet visas i B1.

## 5. Tester

`mindmapPaint.test.ts`:

- `mixOklab`: 100 % och 0 % ger ändarna; vitt mot svart vid 50 % ger
  mellangrått; `#rgb` och versaler läses.
- `resolveMindmapPaint` med `short`: nivå 0, 1, 2 och 3 under en grön nod;
  nivå 3 har `outline` och kanten mörkare än basen.
- `medium` och `soft`: nivån där kanten börjar.
- `off`: bara noder med sparad färg får färg, som i dag.
- En nod med `color` under en annan färg börjar om på nivå 0.
- `colorNone` stoppar arvet för grenen under.
- `customColor` dämpas med `customMix` 0,54 mot basen, och inte alls med 1.
- Textfärgen: en mörk egen färg ger ljus text på nivå 0 och temats text på
  nyanserna; de sex färgerna ger alltid temats text.
- En karta med alla färger sparade (gammal karta) ger samma `fill` per nod
  med och utan `shading`.
- `colorForNewNode`: ärver inget med nyanser, förälderns färg med `off`.
- `setNodePaint` och `setBranchPaint`: högst ett av fälten på noden;
  `setBranchPaint` tar bort sparade färger under med nyanser och skriver
  dem som `setColorDeep` med `off`.

`mindmapTree.test.ts`: tvätten behåller giltig `customColor` (gemener) och
`colorNone`, släpper ogiltiga, och låter de befintliga påståendena stå.

`mindmapDoc.test.ts`: `shading` tvättas; saknas blir det `undefined`
(läses som `off`); `defaultMindmapDoc` ger `short`.

`mindmapMup.test.ts` (C): exakt färg på noder, tvärlänkarna som förut.

## 6. Verifiering

Automatiskt: `pnpm install --frozen-lockfile`, `pnpm exec tsc --noEmit`,
`pnpm lint`, `pnpm test`, `pnpm build`. Baslinje på main 2026-11-12: drygt
100 testfiler.

I Playwright mot ett mock-API på `http://localhost:5001` (GET/POST
`/api/mindmap`, GET/PUT/DELETE `/api/mindmap/<id>`, version och 409),
skrivet i en temporär mapp, med `NEXT_PUBLIC_API_URL=http://localhost:5001/api
pnpm dev -p 3077` och inloggning genom `localStorage.authToken` och
`localStorage.user`. Skärmbilder i båda temana:

1. En ny karta: färga en nod med Alt+3, skriv fyra nivåer under; nyanser
   och kant enligt B. Byt till A och C och "Av" i menyn (del B).
2. Byt färg på grenens nod: allt under följer med. Ångra.
3. "Ingen färg" och en egen färg mitt i en färgad gren.
4. En gammal karta (dokument utan `shading`, alla noder färgade) ser ut
   som på main.
5. Egen mörk färg: vit text på noden, mörk text på nyanserna; dämpad i
   Kronberg.
6. PNG-export och minikartan visar samma färger som skärmen (PNG i Neo).
7. Grenvyn och presentationen visar samma nyanser.
8. Regression: workspace-kortet för mindmap (skriv med Tab och Enter, byt
   färg, exportera som punktlista) ser ut och fungerar som på main.

**Går inte att kontrollera här:** färgerna på en projektor och i Safari
(`<input type="color">` ser olika ut i webbläsarna). Det gör Tobias.

## 7. Risker

- **Beslutet från 2026-11-10 omprövas.** Dess två skäl hanteras så här:
  pastellfärgerna som tunna linjer i Kronberg — linjerna förblir neutrala
  och kanten längst ned är mörkare än färgen och 2 px; en ofärgad nod
  under en färgad gren — `colorNone`.
- **Gamla kartor.** De får "Av" när `shading` saknas, så inget ändras för
  dem. Risken är det motsatta: att Tobias förväntar sig nyanser i en gammal
  karta. Menyn visar valet.
- **En kopierad gren** (`data-mindmap`) som ärvde sin färg tappar den i en
  annan karta, eftersom färgen inte var sparad på den. Den får i stället
  nyanser från sin nya förälder. Godtagbart; skrivs i hjälpen.
- **Kontrast.** Nyanser av gult och grått mot nodens bakgrund är svaga i
  Kronberg (se ritningen). Kanten längst ned är skyddet; nyanserna
  däremellan bär nodens vanliga kant.
- **Temabyte.** Färgerna räknas i JS ur CSS och måste räknas om när temat
  byts. `useUiTheme` i beroendena är skyddet; den visuella kontrollen byter
  tema med sidan öppen.
- **`MindmapCanvas.tsx` växer** (1 236 rader). Skyddsregel 5.
