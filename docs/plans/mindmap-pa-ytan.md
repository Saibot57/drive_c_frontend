# Mindmap direkt på ytan, med fritt dragbara noder

Status: Planerad

## Bakgrund

Mindmappen i workspace är ett kort (`type: 'mindmap'`). Hela trädet ligger i
elementets `content`, och `layoutMindmap` (`utils/mindmapLayout.ts`) räknar
ut varje nods läge på nytt vid varje ritning. Ingen nod har ett eget läge.
Att dra en nod byter bara förälder. Kartan ritas inuti kortet, med ram och
egen rullning.

Önskemålet är kartor som ligger direkt på ytan, där noderna går att flytta
fritt. Det här bestämdes i intervjun 2026-11-10:

- Det blir en **ny sorts karta bredvid** kortet. Dagens mindmap-kort är kvar
  och fungerar som förut, och sparade kartor ändras inte.
- Noderna ska **se ut och bete sig som egna objekt på ytan**: ingen ram och
  inget kort runt dem. Det räcker att de beter sig så. Hela kartan sparas
  fortfarande som ett dokument, och en nod blir inte ett eget element i
  biblioteket.
- **Fri placering**: en nod stannar där den släpps.
- **Layouten placerar noderna tills man drar dem.** Nya noder placeras
  automatiskt, och barn till en flyttad nod hamnar intill den. "Städa upp"
  lägger tillbaka allt i layouten.
- Tangentbordsflödet (Tab, Enter, pilar, Alt+pilar, mellanslag, färger)
  finns kvar.
- Linjer till andra element på ytan (anteckningar, bilder) kommer **senare**.
  Datamodellen ska inte stänga den dörren.

## Angreppssätt som jämförts

| | A. Läge på dagens kort | B. Ny elementtyp, en karta = ett dokument (rekommenderas) | C. Varje nod är ett eget element |
|---|---|---|---|
| Datamodell | `mindmap` får `content.display: 'canvas'` och nodlägen | `mindmap_canvas` med samma innehåll som `mindmap`, plus `pos` på flyttade noder | Ny typ `mindmap_node`, och kopplingar i en ny tabell |
| Backend | Ingenting | En ny typ i `VALID_TYPES`. `type` är `String(20)`, så ingen migration | Ny typ, ny tabell, migration, nya routes |
| Sparning | Som i dag | Som i dag: ett debouncat PUT av innehållet (`content-<id>` i saveQueue) | Ett anrop per nod och per koppling. När man skriver snabbt blir det många samtidiga POST |
| Tangentbord, ångra, export | Delas | Delas via en gemensam hook | Måste byggas om över flera element. Workspace-ångran har ingen redo |
| Nackdel | `CanvasElement` måste läsa innehållet för att veta om kortet är ramlöst, och samma typ får två sätt att ritas | En typ till att föra in i ett tiotal filer | Stort, riskabelt, och användaren behöver det inte |

**B** ger det användaren bad om till lägst kostnad, och behåller
tangentbordsflödet, kartans egen ångra och exporten. Kopplingar till andra
element kan läggas till senare som en egen tabell som pekar på `(element_id,
node_id)`. Nod-id:n är redan stabila (`newNodeId`).

## Utformning

### Innehållet

```ts
// types/mindmap.types.ts
export interface MindmapNode {
  // … som i dag
  /** Bara i kartor på ytan. Satt när noden dragits; läget räknas från rotens mitt. */
  pos?: { x: number; y: number };
}
```

- `pos` räknas från **rotens mitt**, i ytans enheter. Flyttas föräldern ligger
  ett barn som själv har flyttats kvar, medan ett barn som inte har flyttats
  följer med föräldern (det placeras av layouten intill den).
- `sanitizeMindmap` tvättar `pos` (ändliga tal, annars bort). Ett vanligt
  kort bryr sig inte om fältet.
- Dagens `layoutMindmap` får ett tillägg, eller en funktion som går efter den
  (`applyPinnedPositions` i `utils/mindmapLayout.ts`). Den lägger ut trädet som
  i dag, och flyttar sedan varje nod med `pos` och dess ej flyttade ättlingar
  så att noden hamnar på sitt läge. Kanterna räknas om från de nya lägena, så
  att en kurva går från förälderns närmaste kant till barnets.

### Elementet på ytan

- Ny typ `mindmap_canvas` ("Mindmap på ytan" i menyn). Den ritas utan kort
  (`BARE_TYPES`) och tar inte emot pekaren mellan noderna
  (`SHAPE_HIT_TYPES`), så att tom yta mellan noderna fungerar som ytan:
  panorering, markeringsram och klick på kort bakom.
- Placeringens ruta är kartans omslutande rektangel. Den hålls i takt av en ren
  funktion `fitPlacement` (`utils/mindmapCanvas.ts`): när en nod hamnar
  ovanför eller till vänster om rutan flyttas `position_x/y` så att roten står
  kvar på skärmen. Det behövs för att markeringsramen, sökningens
  "visa på ytan" och PDF-exporten av ytan ska träffa kartan. Precis som
  rubrikens automatiska höjd ger anpassningen inget eget ångra-steg.
- **Dra roten** flyttar hela kartan (vanlig `useElementDrag`, med snäpp och ett
  ångra-steg i workspace).
- **Dra en annan nod** flyttar noden fritt. Pekarens rörelse delas med zoomen,
  och noden snäpper inte till rutnätet. Släpps noden **på en annan nod** blir
  den nodens barn, som i dag. Då försvinner nodens `pos` och layouten
  placerar den. Släpps den på tom yta får den `pos`.
- Flytten blir ett steg i **kartans egen ångra** (`mindmapHistory`), eftersom
  läget ligger i innehållet. Ctrl+Z med kartan i fokus ångrar flytten.
- **Städa upp** i verktygsraden tar bort alla `pos`, och blir ett steg i kartans
  ångra. **Alt+klick**, eller menyvalet "Lägg tillbaka i layouten", gör samma
  sak för en enda nod.
- Verktygsraden (`MindmapToolbar`) visas ovanför roten när kartan är markerad.
- Färger och kanter från `--ws-mm-*` och `--ui-*`, alltså samma tokens som
  kortet. Kronberg ska därför fungera utan något eget.

### Delad logik

`MindmapEditor.tsx` (743 rader) håller lägen, tangenter, ångra, klistra in och
export. Den nya kartan ska inte få en kopia av allt det. Steg 1 bryter därför
ut det icke-visuella till en hook, `hooks/useMindmapEditing.ts`, utan att
kortets beteende ändras. Därefter ritar `MindmapEditor.tsx` (kortet) och
`MindmapCanvasEditor.tsx` (ytan) var sitt, med samma hook.

## Steg

1. [ ] Bryt ut `useMindmapEditing` ur `MindmapEditor.tsx`. Inget beteende
   ändras; hook-test med `renderHook` för commit, ångra och finishEdit.
2. [ ] `pos` i typen och i `sanitizeMindmap`. `applyPinnedPositions`,
   `fitPlacement` och `clearPositions` i `utils/`, med test.
3. [ ] Backend: `mindmap_canvas` i `VALID_TYPES`, och test att typen går att
   skapa och läsa (och att `bob` inte kommer åt `alice`s karta). Ingen
   migration. Raden i `DEPLOY.md`: backend först, annars avvisas nya kartor
   med 400.
4. [ ] Frontend-typen: `ElementType`, `TYPE_COLORS`, standardstorlek och
   standardinnehåll, `ElementRenderer`, `CanvasElement` (`BARE_TYPES`,
   `SHAPE_HIT_TYPES`, `SELF_EDITING_TYPES`), menyn i `LeftSidebar`, och övriga
   ställen där `'mindmap'` står.
5. [ ] `MindmapCanvasEditor.tsx`: ritning utan kort, nod-drag med zoom, släpp
   på nod eller på yta, och anpassning av rutan.
6. [ ] Städa upp och "Lägg tillbaka i layouten". Exporten ritar med
   lägena (`renderMindmapCanvas` får den färdiga layouten).
7. [ ] Kontroll i webbläsaren: Neo och Kronberg, zoom 50 % och 200 %, en karta
   med cirka 150 noder, ångra både i kartan och i workspace.

## Risker och öppna frågor

- **Två ångra.** Med kartan i fokus ångrar Ctrl+Z i kartan, annars i workspace.
  Det är samma regel som kortet har i dag, men på en ramlös karta syns det
  mindre tydligt var fokus ligger. Markeringen av noden visar det.
- **Prestanda.** Layouten körs om vid varje ändring, och ett drag ändrar
  innehållet vid varje rörelse. Under draget hålls läget lokalt, och
  innehållet skrivs först vid släpp (en sparning och ett ångra-steg per drag).
- **Spegling.** Ett element kan ligga på flera ytor. Nodlägena ligger i
  innehållet och är därför desamma på alla ytor där kartan speglas. Det är
  avsiktligt: det är samma karta.
- **Ett kort görs om till en karta på ytan** ("Bred ut på ytan", som
  sprängningen av temahjulet) ingår inte. Den kan läggas till efteråt som en
  ren omvandling av innehållet.
- **Kopplingar till andra element** ingår inte, se Bakgrund.
