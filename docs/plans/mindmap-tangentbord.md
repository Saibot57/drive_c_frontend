# Mindmap med kortkommandon och export till Google Docs

Status: Genomförd 2026-11-05 (#258)

## Bakgrund

Mindmap-kortet i workspace var ett träd av textfält: noder lades till med
plusknappen och togs bort med krysset. Det gick inte att skriva en karta med
tangentbordet, inte flytta noder, och det fanns ingen export utöver ytans
bild. Önskemålet var ett flöde som i MindMup, och export till ett Google-
dokument som bild och som disposition (alternativ A med export 1 och 2 i
diskussionen; varken fria diagram eller ett Google-konto i appen).

## Vad som byggts

- **Tangentbordet först.** Två lägen: en markerad nod (pilar går mellan
  noderna, att skriva skriver över noden) och en nod man skriver i (Tab ger
  ett barn, Enter ett syskon, och man fortsätter skriva i den nya noden).
  Tom nod: Tab drar in den, Enter lyfter den, Backspace tar bort den, och den
  tas bort när man slutar skriva. Hela listan står i `MINDMAP_SHORTCUTS`
  (`utils/mindmapKeys.ts`) och i hjälprutan på kortet.
- **Struktur.** Fälla ihop grenar (mellanslag), färg (Alt+1–6), flytta bland
  syskonen och in eller ut en nivå (Alt+pilar), dra en nod till en ny
  förälder, och grenar åt båda hållen från roten.
- **Egen ångra.** Workspace lägger inte innehåll i sin ångra-stack, men en
  borttagen gren når inte webbläsarens fältångring. Kortet har därför en egen
  historik (`utils/mindmapHistory.ts`), där skrivandet i en nod blir ett steg.
- **Export.** Kopiera som bild (PNG till urklipp), som punktlista eller som
  rubriker och punkter (HTML till urklipp, som Google Docs klistrar in som
  riktiga listor och rubriker), och ladda ner som PNG. Ctrl+C på en nod
  kopierar grenen som punktlista.
- **Import.** Ctrl+V klistrar in en punktlista som barn till den markerade
  noden, från Google Docs (platta listor med `aria-level`), andra program
  (nästlade listor) eller indenterad text.

## Utformning

- Noderna placeras av `layoutMindmap` (`utils/mindmapLayout.ts`) och ritas
  absolut med grenarna som SVG-kurvor. Samma layout ritar bilden med Canvas,
  så att exporten blir det man ser. Bilden ritas i standardutseendet, som
  ytans export.
- Allt som ändrar kartan är rena funktioner i `utils/mindmapTree.ts` och
  testas där. Editorn (`MindmapEditor.tsx`) håller bara lägen, fokus och
  pekaren.
- Innehållet är samma JSON som förut med tre valfria fält till
  (`collapsed`, `color`, `side` på noderna, `layout` på kartan). Gamla kartor
  läses av `sanitizeMindmap` och behöver ingen migration, och backend
  behöver inte ändras.
- Nya mindmap-kort blir 560 × 360 i stället för 320 × 200.

## Inte gjort

- Ett Google-konto i appen som skapar dokumentet direkt. Det kräver OAuth
  mot användarens konto; backendens Drive-koppling är ett tjänstekonto.
- Import av MindMup-filer (`.mup`). Formatet är JSON och går att läsa in om
  det behövs.
- Länkar på tvären mellan grenar och flera rader text i en nod.
