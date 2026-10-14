# Plan: Schemadagar i workspace pekar på schemats id

Status: genomförd 2026-10-13 på grenen claude/nifty-meitner-ojgea2, inte
sammanslagen med main. Bara frontend, backend hade redan allt som behövs.

Genomförandet följer planen. Avvikelser och det som tillkom:

- **Etiketten bär alltid ägaren för ett delat schema** ("v.35 · anna"), inte
  bara när namnet krockar med ett eget. Härkomstkontrollen ser inte hela
  listan och hade annars gett kortet en annan etikett än dialogen.
  `scheduleSourceLabel` används på båda ställena.
- Namnnyckeln fick prefixet `schedule:name:` (avsnitt 4 lät det vara valfritt).
- `getArchiveActivities` kastar `ArchiveNotFoundError` vid 404. Övriga
  anropare (planeraren, terminsplaneraren, Arbetslag) fångar den som vilket
  `Error` som helst och påverkas inte.
- Sorteringen i dialogen är utbruten till `orderScheduleSources`.
- Provat mot en lokal backend (SQLite) med två användare, i Neo: punkt 1–5 i
  avsnitt 7 går igenom. Punkt 6 (låst schema) är inte provad för hand, men
  `GET /archives/<id>/activities` läser inte låset. Kronberg är inte provat;
  de nya klasserna läser bara befintliga tokens.
- Lint, typkontroll, enhetstester och bygget går igenom.

Schemaplaneraren gick över till id när scheman blev delbara
(`PlannerArchiveSummary`, `/archives/<id>/activities`). Workspace gjorde det
inte. Schemadagarna på ytan, hämtningsdialogen och härkomstkontrollen går
fortfarande på schemats namn:

- `ScheduleImportModal` listar källor med `getPlannerArchiveNames()` och
  hämtar med `getPlannerArchive(name)`.
- `ScheduleDayContent` sparar `archiveName` och inget id.
- `useProvenance` nycklar källan på namnet (`scheduleSourceKey`) och avgör
  "raderat" genom att leta upp namnet i namnlistan.

Det ger två fel idag och ett som väntar:

1. **Delade scheman går inte att hämta in.** `getPlannerArchiveNames` filtrerar
   på `isOwner`, eftersom namnvägen i backend bara läser den egna
   uppsättningen (`archive_name` + `user_id`). Ett schema en kollega delat med
   dig syns i planeraren men inte i workspace.
2. **Kommentarerna stämmer inte längre.** `scheduleDay.types.ts` och
   `importScheduleDays` säger att "ett schema har inget id". Det har det haft
   sedan delningen. Den som läser koden drar fel slutsats om varför kortet är
   en fryst kopia.
3. **Namnbyte.** Det finns ingen endpoint för att byta namn idag
   (`PATCH /archives/<id>` ändrar bara `kind`). Kommer en sådan blir varje
   hämtad dag `missing` direkt. Det är skälet Gemini gav, men det är inte akut.

Planen gör id till nyckeln och låter namnet vara det kommentarerna redan säger
att det är: en etikett.

Riktlinjer:

- **Inget befintligt kort går sönder.** Kort utan id fortsätter på namnvägen,
  precis som idag. Ingen tyst omskrivning av sparat innehåll.
- **Kortet förblir en stickling.** Id:t ändrar bara var kontrollen letar, inte
  att innehållet är fryst. "Uppdatera från källan" är fortfarande ett aktivt
  val.
- **Ingen backendändring.** `GET /archives/<id>/activities` finns, svarar 404
  för både raderat och "du når det inte längre", och tar inget lås.

## 1. Datamodell

`src/app/workspace/_feature/types/scheduleDay.types.ts`:

```ts
export interface ScheduleDayContent {
  /**
   * Schemats id. Nyckeln för härkomst. Saknas på kort hämtade före
   * 2026-10 — de går på archiveName.
   */
  archiveId?: string | null;
  /** Namnet vid hämtningen. Nyckel bara för kort utan archiveId. */
  archiveName: string | null;
  sourceLabel: string;
  ...
}
```

Valfritt fält, så att gammalt innehåll läses utan migrering. `archiveName`
behålls: gamla kort behöver det, och det arbetande schemat (`null`) finns kvar
som legacy-fall.

Skriv om filhuvudet. Kärnan står kvar — dagen är en fryst kopia för att inte
spränga användarens möblering — men skälet "ett schema har inget id" tas bort.

## 2. Hämtningsdialogen

`components/ScheduleImportModal.tsx`:

- Källor från `plannerService.listArchives()` i stället för
  `getPlannerArchiveNames()`. Alla scheman användaren når, egna och delade.
- `ScheduleSource` blir `{ archiveId: string; archiveName: string; label: string }`.
  `archiveName: null` (huvudschemat) försvinner ur dialogens typ — det går
  redan inte att välja.
- Hämtning med `getArchiveActivities(id)`.
- Listan: egna först, sedan delade med ägaren som undertext ("delat av
  anna"). Basscheman märks "(bas)" som i planerarens statusrad. Sortering
  inom grupperna: senast ändrad först (`updatedAt`), samma som i planeraren.
- `key` på knapparna blir id:t. Två scheman kan heta likadant nu.
- Etiketten: schemats namn. För ett delat schema med samma namn som ett eget,
  lägg till ägaren ("v.35 · anna") så att korten går att skilja åt på ytan.

## 3. Import

`hooks/useWorkspaceData.ts`, `importScheduleDays`: ta emot den nya
`ScheduleSource` och skicka `archiveId` vidare till `buildScheduleDays`
(`utils/scheduleDayImport.ts`), som skriver in det i varje dags innehåll.
Uppdatera kommentaren ovanför funktionen på samma sätt som typfilen.

## 4. Härkomstkontrollen

`utils/provenance.ts`:

```ts
export const scheduleSourceKey = (content: Pick<ScheduleDayContent, 'archiveId' | 'archiveName'>) =>
  content.archiveId ? `schedule:id:${content.archiveId}` : `schedule:${content.archiveName ?? ''}`;
```

Ny och gammal nyckel kan inte krocka: ett namn kan inte börja med `id:` och
samtidigt vara ett id-kort. Om det känns för tunt, prefixa den gamla med
`schedule:name:` — `sourceKey` sparas inte, så formatet är fritt att ändra.

`hooks/useProvenance.ts`, i `check`:

- Dela upp schemakorten i tre högar: med id, med namn, arbetsschemat.
- **Id-korten:** en `getArchiveActivities(id)` per unikt id, parallellt med
  hjulen. Svar → jämför som idag. 404 → `missing`. Annat fel → `unknown`.
  Ingen namnlista behövs för dem.
- **Namnkorten och arbetsschemat:** exakt som idag. Namnlistan hämtas bara om
  det finns minst ett namnkort.
- `sourceLabel` i resultatet: för id-kort, schemats *nuvarande* namn från
  svaret (`archive.name`), inte det frysta. Då säger "Uppdatera alla 5 från
  v.35 (justerad)" sanningen även efter ett framtida namnbyte.

`getArchiveActivities` kastar idag samma `Error` för 404 som för 500. Lägg till
statuskoden på felet (en liten `ArchiveNotFoundError`, eller `status` på
felobjektet) så att kontrollen kan skilja `missing` från `unknown`. Låt bli att
tolka meddelandetexten.

`mergeScheduleDay` sprider `frozen`, så `archiveId` följer med vid
uppdatering. Inget att göra där.

## 5. Gamla kort

Kort utan `archiveId` uppgraderas **inte** automatiskt. Härkomstkontrollen är
tyst och läser bara; att den skulle skriva till kort vore en ny sorts
bieffekt.

Möjlig senare förbättring, inte en del av den här planen: när användaren väljer
"Uppdatera från källan" på ett namnkort och namnet träffar exakt ett eget
schema, skriv in dess id i samma sparning. Det är en ändring användaren redan
bett om, så id:t får åka med.

## 6. Vad som blir kvar av namnvägen

Efter ändringen används `getPlannerArchiveNames` och `getPlannerArchive(name)`
bara av härkomstkontrollen för gamla kort. Uppdatera kommentaren på
`getPlannerArchiveNames` (den nämner Command Center, som inte längre anropar
den). Ta inte bort funktionerna — gamla kort lever kvar på ytor i månader.

## 7. Prov

Enhetstester (vitest), nya i `utils/provenance.test.ts`:

- `scheduleSourceKey` ger olika nycklar för id-kort och namnkort med samma
  namn, och samma nyckel för två kort från samma id.
- `buildScheduleDays` skriver `archiveId` i varje dag.

Bryt gärna ut statusbeslutet i `check` (svar/404/annat fel → `fresh`,
`drifted`, `missing`, `unknown`) till en ren funktion så att den går att testa
utan nätverk.

För hand, mot lokal backend, i Neo och Kronberg:

1. Hämta in två dagar ur ett eget schema. Ändra en lektion i planeraren. Gul
   prick på båda; "Uppdatera alla 2" uppdaterar och släcker.
2. Dela ett schema från en annan användare. Det syns i dialogen med ägaren som
   undertext och går att hämta in. Prickar fungerar likadant.
3. Ta bort delningen. Kortet blir `missing` (röd prick), innehållet ligger kvar.
4. Radera ett eget schema. Samma sak.
5. En yta med kort hämtade *före* ändringen: oförändrat beteende, inga
   konsolfel, inga skrivningar till korten.
6. Ett schema som är låst av en kollega går att hämta in och kontrollera
   (läsning tar inget lås).

Lint, typkontroll, enhetstester och bygget ska gå igenom.

## 8. Ordning

Allt i en PR, men i tre commits så att varje steg går att läsa:

1. Typ + `buildScheduleDays` + test (inget beteende ändras).
2. Härkomstkontrollen läser id-kort (fortfarande inga id-kort skapas).
3. Dialogen och importen skapar id-kort, kommentarerna skrivs om.
