# Export av scheman från Arbetslag

Status: Genomförd 2026-10-21.

## 1. Bakgrund

Lärarna ska få ett schema utifrån sina arbetslag. Schemaplanerarens urval
(ögat) kan visa en deltagares pass, men urvalen görs för hand, ett i taget,
och vet inget om arbetslagen. Upplägget i Arbetslag vet redan vilka
temalektioner varje lag äger och vilka lärare som är med i varje lag. Exporten
ska därför ske direkt från Arbetslag, räknad ur upplägget när man trycker.

Det här är inte urval. Inget sparas, och urvalen i schemaplaneraren ändras
inte. Behövs något annat än standardveckan används planerarens urval eller
export som i dag.

## 2. Avgränsning

- Utgår från **enkla vyn** `/features/arbetslag` (`LessonLab.tsx`) och det
  den sätter: lektion (eller klass i en delad lektion) → arbetslag, och
  arbetslag → medlemmar.
- Detaljvyn `/features/arbetslag/detalj` räknas inte in: lärare per klass
  (`classTeachers`), områden, egna veckor och resurser används inte.
- Bara **veckomallen** (`state.template`) och upplägget arkiv
  (`state.archiveId`, ett basschema) exporteras. Aldrig en enskild vecka.
- Bara lärare som är med i minst ett arbetslag går att exportera.
- Ingen backendändring. Den som når arkivet kan exportera; ägaren delar
  basschemat med dem som ska kunna exportera.

## 3. Vad som exporteras

| Val | Innehåll |
|---|---|
| **Ett arbetslag** | Temapassen laget äger. |
| **En lärare** | Temapassen från alla lag läraren är med i, sammanslagna, plus fasta pass där läraren står som lärare, plus pass med "Alla" som lärare. |
| **Alla arbetslag** | En PDF med en sida per lag, i lagens sifferordning (`sortTeams`). |
| **Alla lärare** | En PDF med en sida per lärare som är med i något lag, i bokstavsordning. |

### Vilka pass som hör till ett lag

Arkivets pass hämtas som i dag (`useLabArchive`). Ett pass är ett temapass
om `temaTarget(title, classes)` inte är `null`, samma igenkänning som när
mallen byggs (`lessonsFromArchive`). Passet hör till laget om det finns en
lektion i mallen med samma dag, start och slut där laget äger passets klass
(`classTeamId`). Ett pass som gäller alla klasser ("Tema" utan klass) hör
till varje lag som äger någon klass i lektionen.

### Vilka pass som hör till en lärare

Lärarens lags temapass enligt ovan, plus de pass som inte är tema
(`fixedActivities`) där

- lärarens namn står i lärarfältet, matchat som i timräknaren
  (`countedTeachers`, versaler och mellanslag spelar ingen roll), eller
- lärarfältet räknar upp "Alla" (`isAllTeachersField`).

Ett pass tas bara med en gång även om det träffas flera gånger. En lärare
i ett lag utan lektioner får alltså bara sina fasta pass och "Alla"-passen.

### Lunch och raster

Gäller både lag och lärare. Ett pass vars titel börjar på "Lunch", "Rast" eller
"Paus" bedöms bara efter reglerna här, aldrig efter lärarfältet.

- **Lunch** kommer med de dagar laget eller läraren har något annat pass.
- **Rast och paus** kommer med bara när de ligger *mellan* två av lagets
  eller lärarens pass samma dag: ett pass slutar senast när rasten börjar och
  ett annat börjar tidigast när den slutar. En rast före dagens första pass,
  efter det sista eller en dag utan pass kommer inte med.
- Lunch och raster räknas inte som pass när menyn avgör om ett lag eller en
  lärare har något att exportera.

## 4. Hur det ritas

- Samma renderare som planerarens export (`buildScene` i `utils/schedulePdf`).
  Bara de valda passen skickas in, så kolumnerna räknas om och det bortvalda
  tar ingen plats, som med ett urval i planeraren.
- **Skalan är basschemats.** Varje sida ritas till basschemats sista sluttid
  (`extraEndMinutes`), så att sidorna har samma tidsaxel och går att jämföra,
  på papper och digitalt.
- **Färg- och salsreglerna** i planerarens Inställningar ("Färg efter ord i
  titeln", "Sal efter ord i titeln") används, lästa med `usePersistentState`
  och nycklarna `COLOR_TRIGGERS_KEY` och `ROOM_TRIGGERS_KEY`. Hela
  `useHiddenSettings` används inte, eftersom den också registrerar
  kortkommandot till planerarens inställningsdialog. Den som exporterar på en
  annan dator får sina egna regler, eller inga.
- "Uteslut från nästa print/export" används inte.
- Passen ritas som de står i arkivet, lärarfältet också. Temapassen i
  basschemat har ingen lärare, så där står ingen. Får ett temapass en lärare i
  arkivet syns den, även om labbet säger något annat. Det byggs inget för det.
- Rubriken blir arkivets namn och vem schemat gäller, som planerarens urval:
  "Ht26 – Lag 3 Skrivande", "Ht26 – Arbetslag 2" (standardnamnet) eller
  "Ht26 – Anna". Filnamnet följer `buildExportFilename` och `toFileSlug`, som
  behåller versaler och å, ä, ö: `schema-Ht26-Anna-a4.pdf`. PDF:en med alla
  får namnet efter valet, `schema-Ht26-Alla-lärare-a4.pdf`.

## 5. Menyn

En knapp **Exportera** i verktygsraden på Arbetslag, utformad som
planerarens exportmeny (`NewSchedulePlanner.tsx`, "Exportera"):

1. Välj vem: en lista med *Alla arbetslag*, *Alla lärare*, varje lag och
   varje lärare. Ett lag eller en lärare utan pass är avstängt i listan,
   märkt "(inga pass)".
2. Välj format, samma alternativ och förklaringar som i planeraren:
   PDF digital, A4, A3 och bild PNG, JPG, SVG.
   **Bild går bara för ett lag eller en lärare.** Är *Alla …* valt är
   bildalternativen avstängda med förklaringen "Bara PDF för alla".

Knappen är avstängd, med förklaring i `title`, när upplägget saknar arkiv,
när arkivet inte nås (delat upplägg vars arkiv inte delats) eller medan
passen hämtas.

## 6. Kantfall

Arbetslag har ingen notis som planerarens `showNotice`. Exporten får en egen
ruta under verktygsraden, i samma stil som `PlanNotices` (`sp-toast`), som
står kvar tills man stänger den.

- **Lag utan lektioner** eller lärare utan pass hoppas över i *Alla …*.
  Notisen efteråt säger vilka.
- **Arkivet har ändrats sedan mallen byggdes:** en lektion i mallen utan
  motsvarande pass i arkivet ger inget i exporten. Notisen säger hur många
  lektioner som saknar pass och att "Läs om schemat" (knappen bredvid
  Basschema) rättar det.
- **Text som inte ryms** och för liten skala rapporteras i en notis, som i
  planeraren.

## 7. Genomförande

Bara frontend, en PR. Ingen migration och ingen deployordning.

1. **`src/utils/labScheduleExport.ts`** (ren logik, med tester):
   `activitiesForTeam(state, activities, teamId)`,
   `activitiesForTeacher(state, activities, teacherId)`,
   `exportTargets(state, activities)` (listan i menyn), `pagesFor` (sidorna
   för ett val), `lessonsWithoutPass` och `exportInputsFor` (exportens indata
   med basschemats skala). Bygger på `classTeamId`, `temaTarget`,
   `fixedActivities`, `countedTeachers`, `isAllTeachersField` och
   `mapPlannerActivitiesToSchedule`.
2. **Flersidig PDF** i `utils/schedulePdf`: `scenesToPdf(scenes)` lägger
   varje scen på en egen sida (`addPage` med scenens eget format och
   orientering, så att digitalt läge får rätt mått per sida), och
   `exportScheduleBook(inputs, naming)` laddar ner hela dokumentet.
   `sceneToPdf` är en sida som förut. Tester för att sidantalet och sidornas
   mått blir rätt.
3. **`src/components/lesson-lab/LabExportMenu.tsx`**: menyn i avsnitt 5.
   Formatlistan (etiketter och förklaringar) bryts ut till
   `src/config/scheduleExportFormats.ts`, som både planeraren och Arbetslag
   använder, så att de inte glider isär.
4. **Koppling i `LessonLab.tsx`**: knappen i verktygsraden, med
   `source.activities`, `source.archiveName` och reglerna.

Ordningen ovan är också ordningen för commits. Steg 1 och 2 går att granska
utan att något syns i appen.

## 8. Bedömning

Det går att göra utan större risk. Allt som behövs finns redan: upplägget
vet vem som äger vad, arkivets pass hämtas redan på sidan, igenkänningen av
temapass och lärarnamn finns och används i timräknaren, och exporten ritar
ur data utan att röra planerarens DOM (`PublicScheduleView` gör redan samma
sak utanför planeraren). Det nya är filtreringen (steg 1), flera sidor i en
PDF (steg 2) och menyn (steg 3). Inget i schemaplaneraren ändrar beteende.
