# Mindmap: flera rötter på samma canvas

Status: Utredning

Utredningen skrevs 2026-11-13 mot `main` (fba3f05). Den bygger inget och
är ingen plan för ett bygge. Den är underlaget för att eventuellt ompröva
beslut 3 och 15 i [`mindmap-placering.md`](mindmap-placering.md) ("Roten
flyttas ensam … Ingen dold rot och inga flera rötter").

## Svaret först

**Det största hindret är inte koden utan att "roten" är den fasta
mittpunkten för nästan allt:** den enda nod man inte kan ta bort, där
markeringen hamnar när något försvinner, kartans namn, var presentationen
börjar, vyns origo, och den punkt som avgör om en gren ligger till höger
eller vänster. Med flera rötter måste vart och ett av de valen göras om, och
flera av dem är frågor om beteende, inte teknik.

**Det tekniska hinder som väger tyngst är lagringsformen.** Byts `root` mot
`roots: []` (väg B) tappar en äldre flik eller en äldre version av sidan de
extra träden tyst när den sparar, eftersom tvätten (`sanitizeMindmap`) bara
läser `root`. Backend kräver dessutom `root`. Det går att undvika helt.

**Mest framkomligt: en dold rot (väg A), eventuellt utbyggd till väg D.**
Dokumentet behåller en rot, som inte ritas. Nivå 1-noderna blir de
synliga "toppnoderna", och de flyttas redan i dag fritt med sin gren
(förskjutning, steg 5). Lagringsformen, backend och workspace-kortet
ändras inte. Det mesta blir sidans egen kod, och ritningen kan göras med
den `transform` som `renderMindmapCanvas` redan har.

Skillnaden mellan A och D: i A är en toppnod en vanlig gren, så dess barn
växer bara åt ett håll (utåt). I D ritas varje toppnod som en egen rot,
med grenar åt båda håll, genom att layouten körs en gång per träd. D ger
utseendet av B utan B:s lagringsform, men kostar mer.

## 1. Hur kartan bygger på en rot i dag

Räknat 2026-11-13 med `grep -c "\.root\b"` utan testfiler: **141 ställen i
20 av sidans filer** och **16 i workspace-kortet** (2 filer), alltså samma
siffror som i uppdraget. Flest: `utils/mindmap/mindmapTree.ts` (49),
`components/mindmap/MindmapCanvas.tsx` (25), `utils/mindmapPlacement.ts`
(15), `utils/mindmapRouting.ts` (11), `components/mindmap/MindmapPresent.tsx`
(8), `utils/mindmapBranch.ts` (7). Siffran visar hur brett antagandet sitter.
De flesta ställena är `findNode(doc.root, id)`, som fungerar oförändrat
med en dold rot.

Roten har sex särskilda roller i koden:

| Roll | Var | Vad den gör |
|---|---|---|
| Behållare för trädet | `MindmapContent.root` (`types/mindmap.ts`), alla trädfunktioner tar `root: MindmapNode` | Allt letas upp genom att gå från roten. |
| Mittpunkt i layouten | `layoutMindmap` (`utils/mindmap/mindmapLayout.ts`, rad ~370) | Roten läggs i origo, grenarna åt höger eller båda håll. |
| Det som avgör sidan | `rootChildSides`, `sideOf`, `sameSideSiblings` (`mindmapTree.ts`) | `side` gäller bara rotens barn; tvätten tar bort den längre ned (`stripSidesBelow`). |
| Den odödliga noden | `removeNode`, `canMoveNode`, `addSibling` | Roten går inte att ta bort eller flytta in under något; Enter på roten skapar ett barn. |
| Reservmarkering | `clampToBranch` (`mindmapBranch.ts`), ångra i `MindmapCanvas.tsx` (~rad 597), kortet (`MindmapEditor.tsx` rad 187, 343) | Finns inte den markerade noden blir roten markerad. |
| Kartans namn och start | `mindmapExportName`, `useMindmapExport.ts`, `mindmapFile.ts`, `mindmapMup.ts`, `presentStart` | Saknas titel tas namnet från rotens text; presentationen börjar i roten. |

## 2. Område för område

Klass: **litet** = lokal ändring, **medel** = flera filer men tydligt,
**stort** = ändrar ett grundantagande eller kräver beslut. Kolumnen "Typ"
säger om hindret är tekniskt (T) eller en fråga om beteende som Tobias
måste svara på (B).

| # | Område | Vad förutsätter en rot | Med dold rot (A) | Med flera riktiga rötter (B) | Typ |
|---|---|---|---|---|---|
| 1 | Datamodell och tvätt | `MindmapContent = { root; layout? }`. `sanitizeMindmap` läser bara `root` och `layout`; okända fält kastas. Backend kräver `root` med `id` och `children`. | **Litet.** Ett valfritt fält i sidans `MindmapDoc`, t.ex. `hiddenRoot?: true`, tvättat i `sanitizeMindmapDoc`. En äldre flik kastar fältet och sparar en karta där roten syns igen: ingen data förloras. Backend och kortet orörda. | **Stort.** `roots` måste överleva tvätten, och den delade tvätten kastar okända fält, så en äldre version av sidan raderar de extra träden vid nästa sparning. Backend kräver `root`, så antingen behålls `root` vid sidan av (två former att hålla i takt) eller ändras backendens kontroll. | T |
| 2 | Layout och linjer | `layoutMindmap` lägger roten i origo och rotens barn i en kolumn till höger eller på båda sidor. `placeNode` byter sida när draget korsar rotens mitt (`centerFromRoot`). `routeEdges`, `placeRootInLayout`, `rootOrigin` läser roten. | **Medel.** Layouten körs som i dag; sidan tar bort roten och linjerna från den i en `transform` efter layouten (samma mönster som `placeRootInLayout`) och räknar om måtten. Toppnoderna står först i en kolumn och flyttas sedan med sin förskjutning. Sidbytet runt en osynlig mitt måste bestämmas (B): förslag att en karta med dold rot alltid har layouten `right`, eller att sidbytet stängs av. | **Stort.** Det finns ingen regel för hur träd står i förhållande till varandra. Varje träd behöver en egen plats (en förskjutning per rot) och en automatisk placering för nya träd. Layouten måste köras per träd och slås ihop. | T + B |
| 3 | Tangentbord och navigering | `navigate`: från roten går vänster/höger till första barnet på den sidan, upp/ned gör inget. Från en nivå 1-nod går pilen inåt till roten. `resolveMindmapKey` (delad) får `isRoot` och `parentIsRoot`: Enter på en tom nod under roten avslutar skrivandet i stället för att lyfta den. Shift+Tab på en nivå 1-nod byter sida i `both`. | **Medel.** Det som redan finns passar förvånansvärt väl: Enter på en toppnod skapar en ny toppnod, upp/ned går mellan toppnoderna (`visibleAtDepth`). Det som måste ändras ligger i sidan: pil inåt från en toppnod får inte landa på den dolda roten, och den dolda roten får aldrig bli markerad. Den delade `navigate` och `resolveMindmapKey` kan lämnas; sidan filtrerar resultatet. | **Stort.** `navigate` och hela `mindmapTree.ts` går från en rot. Antingen skrivs varje funktion för en skog, eller så läggs en tänkt rot ovanpå skogen, vilket är väg A i annan form. Hur man går från ett träd till ett annat måste bestämmas (B). | T + B |
| 4 | Markering, ångra, sparning | Markeringen faller tillbaka på roten (`clampToBranch`, ångra). Ångra sparar `{ content, selectedId }` för hela dokumentet. Dokumentet sparas som ett med version och 409 (`useMindmapSync`). | **Litet–medel.** Reserven blir "första toppnoden" i stället för roten. Ångra och sparning är oförändrade, eftersom det fortfarande är ett dokument. Fråga (B): vad händer när sista toppnoden tas bort? Förslag: den sista går inte att ta bort, som roten i dag. | **Medel.** Samma reservfråga, och dessutom en tom karta utan rötter som måste gå att visa. Ångra och sparning oförändrade om det är ett dokument. | B |
| 5 | Tvärlänkar | `crossLinkAllowed` (`utils/mindmapDoc.ts`) förbjuder länk mellan förälder och barn och mellan noder som inte finns i trädet. `crossLinkGeometry` (`utils/mindmapCrossLinks.ts`) går genom `doc.root`. | **Litet.** Länkar mellan toppnoder och mellan deras grenar fungerar redan (toppnodernas förälder är den dolda roten, så de är syskon). En länk till den dolda roten måste förbjudas och en befintlig sådan döljas eller tas bort när roten döljs (B). | **Medel.** Alla tre funktionerna måste leta i alla träd. Reglerna i sig gäller oförändrade. | T |
| 6 | Grenvyn och presentationen | `branchRootId` vägrar roten ("Roten visar redan hela kartan"). `presentStart` börjar i roten, `presentNext` går i förordning från den, `presentSibling` hoppar inte från roten. | **Litet–medel.** Grenvyn på en toppnod fungerar som i dag (`branchDoc` gör toppnoden till rot med layouten `both`). Presentationen måste börja i en översikt utan rot och gå vidare till första toppnoden; `presentStart`, `presentNext` och `presentProgress` behöver hoppa över den dolda roten. Fråga (B): ska presentationen börja med hela kartan eller med första toppnoden? | **Medel.** Samma frågor, och presentationen måste kunna gå från ett träd till nästa. | B |
| 7 | Export och import | PNG, PDF, minikartan och urklippsbilden ritas av `renderMindmapCanvas` (delad), som tar `transform`. Markdown (`mindmapMarkdown.ts`) gör roten till `#`-rubrik. Dispositionen (`copyOutline(d.root, …)`) börjar med roten. JSON (`mindmapFile.ts`) och `.mup` (`mindmapMup.ts`) tar namnet från roten. `.mup` med flera rotidéer gör en ny rot med filens namn (rad ~339). | **Litet–medel.** Bilderna får samma `transform` som skärmen. Markdown och dispositionen börjar på nivå 1 när roten är dold. JSON följer med oförändrad. `.mup` med flera rotidéer kan sätta `hiddenRoot` och blir då som i MindMup. Fråga (B): ska den dolda rotens text vara kartans namn? (Förslag: ja, då försvinner frågan "vilken rot får namnet".) | **Medel–stort.** Varje export måste gå över alla träd, och frågan vilken rot som ger namnet måste besvaras. `.mup` passar bättre (MindMup har just flera rotidéer). | T + B |
| 8 | Vyn | Origo är rotens automatiska mitt (`rootOrigin` i `mindmapRouting.ts`), och den sparade vyn per karta (`mindmap.view.v1`) är relativ till den. "Passa in" (Ctrl+0) använder kartans mått. | **Litet.** Origo kan vara den dolda rotens automatiska mitt som i dag; den flyttas aldrig, så sparade vyer gäller. "Passa in" ger rätt när måtten räknas utan roten. | **Medel.** Det finns ingen given punkt att räkna från. Ett fast origo (t.ex. 0,0 i kartans koordinater) måste införas, och gamla sparade vyer hamnar fel en gång. | T |
| 9 | Workspace-kortet | Kortet läser och skriver sina egna dokument med samma typ, `sanitizeMindmap`, `layoutMindmap`, `navigate` och `resolveMindmapKey`. Kortet och sidan delar inga dokument (kontrollerat i radbrytningsplanen). | **Inget.** Kortet ser aldrig fältet och anropar de delade funktionerna som förut. | **Stort om typen delas.** Byts `MindmapContent` måste kortet antingen följa med eller få en egen typ. Säkrast är att lämna `MindmapContent` och lägga skogen bara i `MindmapDoc`. | T |

## 3. Vägarna

### A. Dold rot

Dokumentet har sin rot som i dag. Ett fält i sidans dokument säger att
den inte ritas. Nivå 1-noderna blir toppnoder.

- **Löser:** flera fristående "öar" på samma yta, var och en med egen
  gren, fritt placerade med förskjutning (finns redan); tvärlänkar mellan
  öarna; ett dokument med en sparning, en ångra-historik och ett namn.
- **Löser inte:** att en toppnod ser ut och beter sig som en rot. Dess
  barn växer bara utåt åt ett håll, inte runt den. Toppnoden ritas som en
  vanlig nod (mindre text, tunnare kant) om inte layouten ändras.
- **Omfattning:** medel. En `transform` som tar bort roten (lik
  `placeRootInLayout`), en vakt för markeringen och pilarna i sidan,
  presentationens start, Markdown och dispositionen, en växel i
  verktygsraden eller menyn Linjer. Uppskattning: 6–10 filer i sidan, inga
  delade signaturer.
- **Risk för det som finns:** låg. Inget gammalt dokument ändras förrän
  Tobias slår på växeln; en äldre flik visar roten igen men tappar inget.
  Kortet och backend orörda.

### B. Flera riktiga rötter

`roots: MindmapNode[]` i stället för `root`, eller extra träd i
`MindmapDoc` vid sidan av `root`.

- **Löser:** varje träd är en riktig mindmap med rot i mitten och grenar
  åt båda håll.
- **Löser inte bättre än A eller D:** något som syns för användaren. I
  koden blir den enklaste vägen att lägga en tänkt rot över skogen, alltså
  väg A med en annan lagringsform.
- **Omfattning:** stor. Alla trädfunktioner i `mindmapTree.ts` går från en
  rot och delas med kortet; antingen skrivs de om för en skog eller får
  sidan en parallell uppsättning. Layout, vy, export, presentation och
  tvätt måste alla gå över flera träd.
- **Risk:** hög. Tyst dataförlust om en äldre version sparar (tvätten
  kastar okända fält). Backendens kontroll kräver `root`. Om
  `MindmapContent` ändras rör det kortet, vilket bryter skyddsregel 1 och 6
  i `mindmap-sida.md`.

### C. Flera kartor på samma yta

Varje träd är en egen sparad karta; sidan visar flera på en gemensam
canvas.

- **Löser:** varje karta är orörd och fungerar som i dag, var och en med
  egen rot, eget namn och egen export.
- **Löser inte:** tvärlänkar mellan träden (de ligger i ett dokument),
  gemensam ångra (en historik per karta), en export av helheten. Ytan
  blir en ny sak som måste sparas någonstans: vilka kartor, var de står.
  Två kartor sparas oberoende, så en ändring som rör båda (dra en gren
  från den ena till den andra) blir två sparningar som kan gå isär.
- **Omfattning:** stor. En ny entitet ("yta") i backend med egen tabell
  och migration, en ny vy som renderar flera `MindmapCanvas` eller en
  gemensam canvas med flera dokument, markering och tangenter över
  kartgränser.
- **Risk för det som finns:** låg för kartorna, eftersom de inte ändras,
  men stort nytt arbete. Det liknar mer workspace-ytan, där mindmap-kort
  redan kan stå bredvid varandra.

### D. Dold rot, med varje toppnod ritad som en rot (eget förslag)

Som A i data, men sidan lägger ut varje toppnod som ett eget träd: den
kör `layoutMindmap` en gång per toppnod, med toppnoden som rot och
layouten `both`, och flyttar varje träd dit toppnodens förskjutning säger.
`branchDoc` i `mindmapBranch.ts` gör redan exakt den omvandlingen för
grenvyn, så mönstret finns och är prövat.

- **Löser:** det A löser, och dessutom att varje träd ser ut som en riktig
  mindmap (rotens storlek och kant, grenar åt båda håll). Lagringen är
  densamma som A, så kortet, backend och äldre flikar är lika trygga.
- **Det som tillkommer jämfört med A:**
  - Tvätten tar i dag bort `side` under nivå 1 (`stripSidesBelow`). För
    att en nivå 2-nod ska kunna stå till vänster om sin toppnod måste
    `side` få finnas på nivå 2 i en karta med dold rot. Det är en ändring
    i den delade tvätten, men bakåtkompatibel (kortet läser bara `side`
    på rotens barn).
  - Pilarna, Shift+Tab-sidbytet, sidbytet vid drag och `sameSideSiblings`
    måste räknas per träd. Det går att göra i sidan genom att anropa den
    delade `navigate` på en tänkt karta per träd (som grenvyn gör), utan
    att röra den.
  - Linjernas fästen "efter grensidan" måste räkna sidan per träd i
    `routeEdges`.
  - Ett sätt att gå mellan träden med tangentbordet (B, se nedan).
- **Omfattning:** medel–stor; ungefär dubbelt mot A.
- **Risk:** låg–medel. Samma skydd som A för lagringen; risken sitter i
  att layouten slås ihop av flera körningar (mått, origo, tvärlänkar
  mellan träd).

### Jämförelse

| | A. Dold rot | D. Dold rot, träd som rötter | B. Flera rötter | C. Flera kartor |
|---|---|---|---|---|
| Lagringsform | Oförändrad + ett fält | Oförändrad + ett fält, `side` på nivå 2 | Ny | Oförändrad + ny "yta" |
| Backend | Orörd | Orörd | Kontrollen ändras eller `root` behålls bredvid | Ny tabell och routes |
| Workspace-kortet | Orört | Orört (tvätten behåller ett fält till) | Rörs, eller egen typ | Orört |
| Gamla kartor | Som förut tills växeln slås på | Som förut | Måste föras över eller läsas i två former | Som förut |
| Äldre flik sparar | Roten syns igen, inget förloras | Roten syns igen, nivå 2-sidor tvättas bort | **Extra träd förloras** | Opåverkat |
| Grenar åt båda håll per träd | Nej | Ja | Ja | Ja |
| Tvärlänkar mellan träd | Ja | Ja | Ja | Nej |
| Ett namn, en export, en ångra | Ja | Ja | Ja | Nej |
| Omfattning | Medel | Medel–stor | Stor | Stor |
| Risk för det som finns | Låg | Låg–medel | Hög | Låg, men mycket nytt |

**Rekommendation:** börja med A. Den är liten, går att slå av, och visar
snabbt om "flera öar" är det Tobias vill ha. Blir det tydligt att varje ö
ska se ut som en egen mindmap, bygg D ovanpå; A:s data räcker för D. B och
C ger inget för användaren som D inte ger, och kostar mer.

## 4. Frågor om beteende som Tobias behöver svara på

Inget av detta är tekniskt; koden kan göra vilket som helst.

1. **Vad är en toppnod?** En vanlig gren som står fritt (A), eller en rot
   med grenar åt båda håll (D)?
2. **Hur slås det på?** En växel per karta ("Dölj mittnoden"), eller en ny
   sorts karta? Och vad händer med rotens text när den döljs: blir den
   kartans namn?
3. **Nya toppnoder.** Enter på en toppnod skapar en ny toppnod under den
   (som i dag under roten). Var ska den hamna på ytan: under den förra, eller
   där man klickar (t.ex. dubbelklick på tom yta)?
4. **Pilarna mellan träd.** I dag går upp/ned mellan nivå 1-noderna i
   ordning. Räcker det, eller ska pilarna följa var träden står på skärmen?
   Vad gör pil "inåt" från en toppnod: ingenting, eller går den till
   närmaste toppnod?
5. **Den sista toppnoden.** Får den tas bort (tom yta), eller fungerar den
   som roten i dag och går inte att ta bort?
6. **Layouten `both`.** Ska en karta med dold rot alltid ha alla toppnoder
   åt samma håll (A), eller ska sidbytet finnas kvar runt en osynlig mitt?
7. **Presentationen.** Börja med hela kartan och gå träd för träd, eller
   börja direkt i första trädet?
8. **Exporten som text.** Markdown och dispositionen: ska varje toppnod bli
   en `#`-rubrik, och ska kartans namn stå överst?
9. **Rotens färg.** Med nyanser på ärver i dag allt rotens färg. Ska en
   dold rots färg ignoreras?

## 5. Vad som inte är kontrollerat

- **Backendens kontroll** är inte läst i kod. Backend-repot gick inte att
  nå från den här sessionen; det som står om `root` med `id` och `children`
  kommer från uppdraget och från avsnitt 3.4 i `mindmap-sida.md`.
- **Ingenting är prövat i webbläsaren.** Allt bygger på läsning av koden.
- **Omfattningarna** (antal filer, "medel", "ungefär dubbelt") är min
  bedömning, inte uppmätt. Inget är prototypat.
- **Att `transform` räcker för att dölja roten i PNG, PDF och minikartan**
  är läst i `mindmapDraw.ts` och `placeRootInLayout`, inte prövat.
- **Att `branchDoc`-mönstret räcker för D** är en bedömning: grenvyn
  bevisar att ett delträd går att lägga ut som en egen karta, men inte att
  flera sådana går att slå ihop utan problem med mått och tvärlänkar.
- **Att en äldre flik tappar extra träd i väg B** följer av att
  `sanitizeMindmap` bara läser `root` och `layout` (`mindmapTree.ts`, rad
  69–81); det är inte framkallat i praktiken.
- **Att kortet och sidan inte delar dokument** är taget från
  `mindmap-placering.md` avsnitt 0, inte kontrollerat på nytt.
