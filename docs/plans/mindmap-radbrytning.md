# Mindmap: text på flera rader i en nod

Status: Pågår

Planen är skriven 2026-11-12 efter en intervju med Tobias, mot koden på
`main` (6f24dc3). Den omprövar ett beslut i [`mindmap-sida.md`](mindmap-sida.md)
avsnitt 9, där flerradiga noder lades utanför ("en nod är en rad;
anteckningen tar resten"). Skyddsreglerna i den planen gäller oförändrade;
avsnitt 2 nedan säger hur de tillämpas här. Bygg inte förrän Tobias sagt
till.

Två delar, var och en en PR som lämnar sidan hel:

- **A. Radbrytning.** Lång text bryts av sig själv vid en standardbredd,
  och Ctrl+Enter ger en egen radbrytning.
- **B. Bredd per nod.** En nod kan få en egen bredd: dra i kanten eller
  Ctrl+Shift+←/→.

## 0. Hur det fungerar i dag

Allt förutsätter att en nod är en rad. Kontrollerat i koden 2026-11-12.

| Vad | Var | I dag |
|---|---|---|
| Redigering | `components/mindmap/MindmapNodeView.tsx` | `<input>`, som inte kan ha radbrytningar. Etiketten visas i en `span`. |
| Utseende | `components/mindmap/mindmap.css` (`.mm__node`), `workspace.css` (`.ws-mindmap__node`) | `white-space: nowrap`. |
| Layout (delad med kortet) | `utils/mindmap/mindmapLayout.ts` | `measure(label, isRoot)` ger en bredd; höjden är fast (`nodeHeight: 26`, `rootHeight: 34`). Noder med bild är redan högre (`subtreeHeight` tar nodens egen höjd med `extras`), och det är mönstret att följa. |
| Bild, minikarta, urklipp, PDF (delad) | `utils/mindmap/mindmapDraw.ts` | Ett `ctx.fillText` per etikett. |
| Tangenter (delad) | `utils/mindmap/mindmapKeys.ts` | I edit-läget: Enter syskon, Shift+Enter syskon ovanför, Tab barn, ↑ ↓ nästa nod. Allt med Ctrl eller Alt ger `null`. |
| Grenvyn | `utils/mindmapBranch.ts`, `MindmapCanvas.tsx` | **Alt+Enter växlar grenvyn också från nodens textfält** (`handleMapKeyDown`, kommentaren "också från nodens textfält"). Alt+Enter är alltså inte ledig medan man skriver. |
| Inklistring | `handleInputPaste` i `MindmapCanvas.tsx` | Flera rader blir barn till noden. |
| Tvätt (delad) | `sanitizeMindmap` i `utils/mindmap/mindmapTree.ts` | Behåller etiketten som den är, också `\n`. |
| `.mup`-import | `titleAndLink` i `utils/mindmapMup.ts` | `\s+` blir ett mellanslag ("Sidans noder är en rad"). |
| Disposition (delad) | `utils/mindmap/mindmapOutline.ts` | `- ${label.trim()}` per rad; ett `\n` i etiketten bryter indraget. |
| Markdown | `utils/mindmapMarkdown.ts` | Etiketten på en rad i punkt eller rubrik. |
| Presentation | `MindmapPresent.tsx` | Ritar med `MindmapNodeView` och sidans layout; följer med av sig själv. |

**Kortet och sidan delar inga dokument.** Kortet sparas som ett
workspace-element, sidan i `/api/mindmap`. Det enda som går mellan dem är
urklipp, och kortet läser inte `data-mindmap` (sökt i
`src/app/workspace`). En etikett med `\n` kan alltså bara nå kortet som
text genom dispositionen. Kortets `<input>` tar dessutom bort radbrytningar
ur värdet, så ett `\n` som ändå kom dit hade försvunnit vid nästa
redigering.

Backend lagrar dokumentet som det kommer och behöver ingen ändring.

## 1. Alternativen som vägdes

| | Rör | Kostar | Risk för kortet och det som finns |
|---|---|---|---|
| **1. Bara automatisk brytning** vid en fast maxbredd | Layout, ritning, nodvyn, CSS. Inget nytt i datan, ingen ny tangent. | Minst: en ren `wrapLabel` och radvis ritning. | Låg om brytningen är valfri i layouten. Befintliga kartor med långa etiketter blir högre. |
| **2. Egna radbrytningar** med en tangent | Som 1, plus `textarea`, tangent, pilar i fältet, export, import. | Mellan. Pilarna i ett flerradigt fält är det svåra. | Delade tangenter får inte ändras: radbrytningen måste ligga utanför `resolveMindmapKey`, annars får kortet den. |
| **3. Båda, och bredd per nod** | Som 2, plus ett fält på noden, handtag och tangenter. | Störst: ett nytt dragmoment och ett nytt fält i den delade typen och tvätten. | Fältet går genom den delade tvätten; kortet bevarar det men visar det inte. |

Tobias valde **3**. Det delas i A (alternativ 1 och 2) och B (bredd per
nod), så att A går att använda och prova innan B byggs.

## 2. Beslut

| # | Fråga | Beslut |
|---|---|---|
| 1 | Behovet | **Båda**: automatisk brytning vid en bredd, och egna radbrytningar. Gäller alla noder. |
| 2 | Standardbredd | **240 px** textbredd för en nod, **320 px** för roten, vid zoom 1. Gäller noder utan egen bredd. Befintliga kartor med etiketter längre än så blir smalare och högre; det är avsiktligt. |
| 3 | Egen bredd | **Per nod**, valfri (del B). Väljs genom att **dra i nodens högra kant** (vänstra för en nod till vänster om roten) eller med **Ctrl+Shift+← / →** i steg om 40 px. Gränser 80–600 px. Dubbelklick på handtaget tar bort den egna bredden. |
| 4 | Tangent för radbrytning | **Ctrl+Enter** (Cmd+Enter på Mac), bara medan man skriver i en nod. Ledig: `resolveMindmapKey` ger `null` för allt med Ctrl i edit-läget, `resolveBranchKey` ger `null` med Ctrl, och inget annat i kartan läser Ctrl+Enter (`submitOnCtrlEnter` i `utils/dom.ts` används bara i schemats dialog). Alt+Enter är upptagen av grenvyn, också i fältet. |
| 5 | Inklistring | **Som i dag.** Flera rader i ett fält som redigeras blir barn. En radbrytning skrivs bara med Ctrl+Enter. |
| 6 | Workspace-kortet | **Bara sidan.** Allt nytt i delad kod är valfritt; kortet anropar som förut och beter sig exakt som i dag. |
| 7 | Pil upp och ned i fältet | **Rad först.** I en nod med flera rader flyttar ↑ ↓ mellan raderna; på första raden går ↑ till noden ovanför, på sista går ↓ till noden nedanför, som i dag. En nod på en rad beter sig exakt som nu. |
| 8 | Disposition och Markdown | En radbrytning blir **ett mellanslag**. Punktlistans indrag håller. Bild, PNG, urklippsbild, PDF och minikarta visar raderna. JSON och kopiering av en gren mellan kartor (`data-mindmap`) behåller `\n` och bredden. |
| 9 | `.mup`-import | **Behåller radbrytningar.** Annan blanktext blir ett mellanslag som i dag. |
| 10 | Anteckningen (Alt+N) | **Oförändrad.** |
| 11 | Ctrl+Shift+← / → medan man skriver | Gör det webbläsaren gör (markerar ord). Bredden ändras bara på en markerad nod. |

## 3. Skyddsregler

Huvudplanens regler gäller. Här betyder de:

1. **Kortet ändrar inte beteende.** Inga filer under
   `src/app/workspace/_feature/` rörs. Det kortet anropar i den delade
   koden ger samma resultat som i dag:
   - `layoutMindmap` utan den nya optionen `wrap` ger samma noder, samma
     mått och inga `lines`. Test: en karta med en lång etikett och en med
     `\n` läggs ut utan `wrap` och jämförs med värden från i dag.
   - `renderMindmapCanvas` ritar med ett `fillText` per etikett när noden
     saknar `lines`.
   - `resolveMindmapKey` ändras inte alls. Ctrl+Enter, raderna och bredden
     läses i nya funktioner som bara sidan anropar.
   - `sanitizeMindmap` lär sig fältet `textWidth` (del B). En nod utan
     fältet tvättas som förut. Kortet bevarar det, som `note` och `image`.
2. **Delad kod ändras bara bakåtkompatibelt** (huvudplanens regel 6). Den
   enda delade utdata som ändras för befintliga anrop är dispositionen:
   ett `\n` i en etikett blir ett mellanslag (`mindmapOutline.ts`). Kortet
   kan inte ha `\n` i en etikett, så dess utdata är oförändrad; för sidan
   är det en rättelse (ett `\n` hade brutit indraget).
3. **Inga nya beroenden.**
4. **Ingen ny logik i `MindmapCanvas.tsx`** (1 156
   rader). Det nya i den läggs i egna filer: tangenterna i
   `utils/mindmapLabelKeys.ts`, dragningen av bredden i
   `hooks/useMindmapNodeWidth.ts`. I `MindmapCanvas.tsx` blir det bara
   anrop.
5. **Gröna kontroller** före push: `pnpm exec tsc --noEmit`, `pnpm lint`,
   `pnpm test`, `pnpm build`. Baslinje: 100 testfiler, 1 601 tester.

## 4. Utformning

### 4.1 Brytningen (A)

Ren funktion i `utils/mindmap/mindmapLayout.ts` (delad fil, ny export):

```ts
wrapLabel(label: string, maxWidth: number, measure: (text: string) => number): string[]
```

- Delar på `\n` först (egna brytningar), sedan girigt på mellanslag inom
  varje del. Ett ord bredare än `maxWidth` delas mellan tecken.
- Tom rad behålls (en tom rad är en rad). En tom etikett ger `['']`.
- Mellanslag där en rad bryts av sig själv följer inte med till någon rad.

`MindmapLayoutOptions` får en valfri `wrap`:

```ts
wrap?: { maxWidth: number; rootMaxWidth: number; lineHeight: number }
```

Med `wrap` blir `labelWidth` den bredaste raden (minst `minLabelWidth`),
nodens höjd `baseHeight + (rader − 1) × lineHeight`, och `LaidOutNode`
får `lines?: string[]`. Med bild blir `rowHeight` den höjden och bilden
hamnar under. `subtreeHeight` tar nodens egen höjd när `extras` eller
`wrap` är satt (i dag bara `extras`). Utan `wrap` är allt som förut.

`lineHeight` och de två bredderna läggs i `MINDMAP_EXTRA_METRICS`
(förslag: `lineHeight: 18`, `rootLineHeight: 22`, `wrapWidth: 240`,
`rootWrapWidth: 320`), mätta mot `--mm-font` och `--mm-font-root` i
webbläsaren innan de skrivs in.

Sidan (`MindmapCanvas`, `useMindmapExport`, minikartan) anropar layouten
med `wrap`. Platshållaren "Ny nod" mäts som i dag.

### 4.2 Visning och ritning (A)

- `MindmapNodeView` ritar `node.lines` som ett block per rad, var och en
  med `white-space: pre` (ny klass `.mm__line`). Webbläsaren bryter alltså
  inte själv: raderna är de layouten räknat ut, och skärmen blir samma
  som bilden. Utan `lines` som i dag.
- `.mm__node` behåller `white-space: nowrap`; `.mm__row` får
  `align-items: center` mot en högre rad, och ikon och symboler står mot
  första raden (`align-self: flex-start` med en övre luft lika med
  `(nodeHeight − lineHeight) / 2`).
- `mindmapDraw.ts`: finns `node.lines` ritas en `fillText` per rad,
  centrerad, med radhöjden från metrikerna. Annars som i dag.

### 4.3 Redigering (A)

- `<input>` byts mot `<textarea rows={lines.length}>` i
  `MindmapNodeView` (sidans fil). `wrap="soft"`, ingen storleksändring,
  ingen rullning, samma typsnitt och bredd som etiketten plus `slack`.
  `inputRef` och händelserna i `MindmapCanvas` byter typ till
  `HTMLTextAreaElement`; inget annat i dem ändras.
- Enter, Shift+Enter, Tab, Esc och Backspace går som i dag genom
  `resolveMindmapKey`, som redan gör `preventDefault` på dem, så
  `textarea` lägger aldrig själv in en radbrytning.
- Ny ren modul `utils/mindmapLabelKeys.ts` (sidan):
  - `resolveLabelKey(e, caret)` → `'newline' | 'lineUp' | 'lineDown' | null`.
    `newline` för Ctrl/Cmd+Enter utan Alt och Shift. `lineUp`/`lineDown`
    för ↑ ↓ utan modifierare när markören inte står på första
    respektive sista raden.
  - `caretLine(lines, label, caret)` → radens nummer, räknat på
    layoutens `lines` (inte på fältets egen brytning), så att det går att
    testa och följer det som syns.
  - `insertNewline(label, start, end)` → `{ label, caret }`.
- `handleInputKeyDown` frågar `resolveLabelKey` först: `newline` sätter
  etiketten och markören; `lineUp`/`lineDown` släpps till webbläsaren;
  annars `resolveMindmapKey` som i dag.
- Hjälprutan: en rad `Ctrl+Enter` "Ny rad i noden" under "Skriva", i
  sidans tillägg (inte i `MINDMAP_SHORTCUTS`, som kortet visar).

### 4.4 Text ut och in (A)

- `mindmapOutline.ts` (delad): etiketten skrivs med `\s*\n\s*` ersatt av
  ett mellanslag, i både text och HTML. Se regel 2 i avsnitt 3.
- `mindmapMarkdown.ts`: samma.
- `mindmapMup.ts` `titleAndLink`: `\r\n` och `\r` blir `\n`, blanktext
  utom `\n` blir ett mellanslag, varje rad trimmas, tomma rader i början
  och slutet tas bort, fler än en tom rad i rad blir en. Länken letas som
  i dag i hela texten. Kommentaren "Sidans noder är en rad" tas bort.
- Allt som visar etiketten på en rad (listen "Visar grenen X", panelens
  rubrik, tvärlänkarnas val av nod, filnamn vid export, kartans namn ur
  roten i `mindmapFile.ts`): gå igenom de cirka 20 ställena i sidans filer
  (`grep -rn "\.label\b"` i `components/mindmap`, `hooks/useMindmap*`,
  `utils/mindmap*`) och använd en `oneLine(label)` (ny, i
  `utils/mindmapLabelKeys.ts` eller en egen liten fil) där en radbrytning
  hade synts eller hamnat i ett filnamn. I HTML-text gör webbläsaren det
  redan; i `title`, filnamn och `value` behövs den.

### 4.5 Bredd per nod (B)

- `MindmapNode` (`types/mindmap.ts`, delad) får
  `textWidth?: number` — textens största bredd i px vid zoom 1. Saknas
  betyder standardbredden (beslut 2). Kommentaren hamnar under "Fälten
  nedan tillkom för Mindmap-sidan".
- `sanitizeNode`: ett tal avrundas och kläms till 80–600; annat tas bort.
- `mindmapTree.ts`: `setTextWidth(content, id, width | null)` i samma stil
  som `setField`.
- Layouten med `wrap`: `maxWidth` för noden är `node.textWidth ??
  standard`. **En egen bredd är också nodens bredd** när texten är
  kortare (annars hade handtaget hoppat tillbaka när man släpper); utan
  egen bredd krymper noden till texten som i dag.
- `hooks/useMindmapNodeWidth.ts`: handtaget på den markerade noden.
  Pekare ned → följ med, räkna om bredden i kartans koordinater (zoomen
  delas bort), rita med en tillfällig bredd utan att gå genom `commit`,
  och gör **ett** `commit` vid släpp, så att Ctrl+Z ångrar hela dragningen.
  Esc under dragningen avbryter. Dubbelklick på handtaget: `setTextWidth(
  null)`. Handtaget visas inte i presentationen, i läsläge eller medan man
  skriver.
- Ctrl/Cmd+Shift+← / →, bara i nav-läget: `resolveWidthKey(e)` i
  `utils/mindmapLabelKeys.ts` → `'narrower' | 'wider' | null`. Steg 40 px
  från nodens nuvarande bredd (egen eller den den har), inom 80–600.
  Ledig: `resolveMindmapKey` ger `null` (inte z/y, inte ett tecken),
  `resolveViewportKey` ger `null` (inte + eller −), `resolveBranchKey` ger
  `null` med Ctrl, `resolveNodeExtraKey` kräver Alt. Pilarna under en
  pågående tvärlänk (`useMindmapLinks`) går före som i dag.
  Hjälprutan: "Ctrl+Shift+← → Smalare eller bredare nod".
- Grenvyn och fri placering: bredden är nodens egen och följer med i
  `branchDoc` och vid kopiering av en gren. En flyttad nod (`offset`)
  behåller sin plats; dess barn flyttar med kanten.

## 5. Steg

### A. Radbrytning

Byggd 2026-11-12 på grenen `claude/mindmap-radbrytning`.

- [x] `wrapLabel` och `wrap` i layouten, med test (4.1).
- [x] Radvis ritning i `mindmapDraw.ts`.
- [x] `MindmapNodeView`: rader och `textarea`; CSS (4.2, 4.3).
- [x] `utils/mindmapLabelKeys.ts` med test; inkopplad i `MindmapCanvas`.
- [x] Disposition, Markdown och `.mup` (4.4), med test.
- [x] En funktion för etiketten på en rad, på ställena som behöver den.
- [x] Hjälprutan, och tangenten i huvudplanens avsnitt 6.
- [x] Huvudplanens avsnitt 9: flerradiga noder flyttas från "Utanför" med
  en hänvisning hit.

**Avvikelser från utformningen:**

- `wrapLabelLines` ger raderna med var de börjar i etiketten; `wrapLabel`
  ger bara texten. `caretLine` räknar på lägena.
- `MINDMAP_WRAP` (240/320 px, radhöjd 18/22 px) är en egen konstant i
  `mindmapLayout.ts`, inte fält i `MINDMAP_EXTRA_METRICS`. Radhöjderna är
  satta efter typsnittet och stämde i Chromium: textfältet blev exakt så
  högt som layouten räknat (`scrollHeight` lika med `clientHeight`).
- Ikonen, symbolerna och "+3" står **mitt för raderna**, inte mot den första.
  Det blev så på skärmen av sig självt (`align-items: center`), och
  ritningen gör likadant.
- Funktionen heter `labelOneLine` och ligger i den delade
  `mindmapTree.ts`, eftersom den delade dispositionen behöver den. Den
  används i dispositionen, Markdown, tvärlänkarnas rader, filnamn, PDF:ens
  titel, namnet i JSON-filen och kartans namn vid import (JSON och
  `.mup`). Listen "Visar grenen X" och panelens rubrik är HTML-text, där
  webbläsaren gör radbrytningen till ett mellanslag själv.
- Ritningen har inget test mot en falsk `ctx`; `mindmapDraw.ts` testas
  inte (kommentaren överst i filen). Bilden är i stället jämförd med skärmen
  i Chromium.
- `MindmapCanvas.tsx` fick `handleLabelKey` (cirka 25 rader, från 1 156
  till 1 189). Den läser bara upp raderna och anropar de rena funktionerna
  i `mindmapLabelKeys.ts`; att lägga den i en egen hook hade krävt att
  `commit`, `measure` och layouten skickades dit.
- Etiketten i textfältet skrivs vid Ctrl+Enter direkt i fältet innan
  kartan ritas om, så att markören står kvar efter radbrytningen.

### A. Kontroller

- [x] `layoutMindmap` utan `wrap` är oförändrad för en lång etikett och en
  med `\n` (`mindmapWrap.test.ts`). En etikett på en rad får samma mått
  med `wrap` som utan.
- [x] Kortets tester gröna utan ändrade påståenden. Inga filer under
  `src/app/workspace/_feature/` är ändrade.
- [x] `resolveMindmapKey` har inga ändrade tester.
- [x] I webbläsaren (Chromium utan fönster, mot ett mock-API): en lång
  etikett bryts i tre rader; Ctrl+Enter ger en ny rad och sparas som
  `\n`; ↑ stannar i noden på andra raden och går till noden ovanför från
  första; Enter i en flerradig nod ger ett syskon; PNG:en ser ut som
  skärmen, också minikartan.
- [ ] Inte prövat i webbläsaren: inklistring av en disposition i en nod
  (koden är oförändrad utom typen på händelsen), PDF, presentationen,
  workspace-kortet, Safari och Firefox.

Kontroller före push: `pnpm exec tsc --noEmit`, `pnpm lint` (inga fel),
`pnpm test` (103 testfiler, 1 638 tester; 100 och 1 608 före),
`pnpm build`.

### B. Bredd per nod

- [ ] `textWidth` i typen, tvätten och `setTextWidth`, med test.
- [ ] Layouten läser `textWidth` (4.5), med test.
- [ ] `useMindmapNodeWidth` och handtaget, med test av räkningen (zoom,
  sida, gränser) i en ren funktion.
- [ ] `resolveWidthKey` med test; inkopplad i nav-läget.
- [ ] Hjälprutan.

### B. Kontroller

- [ ] En nod utan `textWidth` tvättas och läggs ut som i A.
- [ ] Dragning ångras med ett Ctrl+Z.
- [ ] I webbläsaren: dra handtaget på en nod till höger och en till
  vänster om roten, med zoom 50 % och 200 %; Ctrl+Shift+← → i steg;
  dubbelklick nollställer; grenvy och presentation visar bredden.

## 6. Verifiering

Efter varje del, i webbläsaren:

1. **Workspace-kortet** (huvudplanens regel 1): skapa ett mindmap-kort,
   skriv med Tab och Enter, byt färg, exportera som punktlista, klistra in
   en disposition. Ska se ut och fungera som förut.
2. En befintlig karta från före ändringen öppnas, och noder med korta
   etiketter står där de stod.
3. Huvudplanens regressionslista i avsnitt 8.

## 7. Risker

- **Befintliga kartor ändras i utseende** (beslut 2): etiketter längre än
  240 px bryts. Grenarna blir högre och noder med `offset` kan hamna
  närmare varandra. Ingen data ändras; en nod kan få tillbaka sin bredd
  med B.
- **Fältets egen brytning mot layoutens.** `textarea` bryter själv medan
  man skriver, och kan skilja en pixel från `measureText`. Då står
  markören på en annan rad än den layouten räknar med, och ↑ ↓ (som
  räknar på layoutens rader) kan hoppa en rad fel i det läget. Utanför
  redigeringen syns bara layoutens rader. Mildras med samma typsnitt och
  `slack`; prövas i Chromium, inte i Safari eller Firefox.
- **IME.** `isComposing` släpps igenom som i dag; Enter som avslutar en
  komposition ska inte ge en radbrytning. Inte prövat.
- **Kortet och `\n`.** Kortet kan bara få `\n` genom urklipp i text, och
  dispositionen gör det till ett mellanslag. Inte kontrollerat: om någon
  annan väg (JSON-import i workspace) kan ge kortet en sådan etikett.

## 8. Inte kontrollerat i den här utredningen

- Baslinjen för testerna är inte körd i den här sessionen; siffran är
  huvudplanens.
- Radhöjder och typsnitt är inte mätta i en webbläsare.
- Safari, Firefox och Mac (Cmd+Enter, Cmd+Shift+pilar, där Cmd+Shift+←
  kan vara systemets).
- Hur MindMup själv sparar radbrytningar i `title` (antaget `\n`).
