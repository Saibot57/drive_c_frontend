# Närvarorutor: exportera noteringar som Excel-fil

Status: Pågår

Läget 2026-11-19: byggd 2026-11-18 och sammanslagen i #292, men tagen bort
ur main igen 2026-11-19 med en revert. Tobias har provat filen och vill
arbeta vidare med hur kalkylarket ska formateras för att bli användbart
innan funktionen ligger ute. Planen nedan beskriver det som byggdes.

**Ta tillbaka koden:** den finns i commit `1362f82` ("Närvaro: exportera
noteringar som Excel-fil"). Börja nästa steg med `git cherry-pick 1362f82`
på en ny gren från main; konflikten i den här filen och i
`docs/plans/README.md` löses genom att behålla den nyare texten. Cherry-pick
fungerar eftersom reverten gäller commiten och inte sammanslagningen.

Nästa steg är formateringen (avsnitt 8). Kvar efter det är Tobias prov i
Excel och Google Kalkylark (avsnitt 7).

Bygger på textexporten ([narvaro-export.md](narvaro-export.md)).

## 1. Vad användaren vill

När noteringarna blir fler vill Tobias kunna sortera, filtrera och
sammanställa dem i ett kalkylark, till exempel per ämne, elev eller stämpel.

## 2. Beslut

| Fråga | Beslut |
|---|---|
| Format | En .xlsx-fil. Excel öppnar den; i Google Drive öppnas den i Kalkylark, och Arkiv → Spara som Google Kalkylark gör om den. |
| Rader | En rad per elev och pass, för samma pass och elever som textexporten: alla närvarande, även utan notering, på pass där minst någon har en notering. |
| Stämplar | En kolumn per stämpel med `1` där stämpeln finns. |
| Klass i schemat | Ordet efter "Tema" i titeln ("Tema Rosa" → Rosa). Andra titlar har ingen klass. |
| Ämne | Texten före kolonet i schemats innehåll ("Historia: Historiebruk" → Historia). Annars titeln utan klassen ("Tema Rosa" → Tema, "Ma Grund" → Ma Grund). |
| Backend | Ingen ändring. Filen byggs i webbläsaren och skickas ingenstans. |

## 3. Kolumnerna

Vecka, Datum, Dag, Start, Slut, Pass i arket, Klass, Ämne, Schemapass,
Lärare, Sal, Innehåll, Passnamn, Elev, Skola, Närvarande, Grupp, Arkets
vecka, en kolumn per stämpel, Notering.

- **Datum** är ett riktigt datum och **Start** och **Slut** riktiga
  klockslag, så att de sorterar rätt. Tiden är schemapassets, annars arkets
  kolumns. Arkets passtext står i **Pass i arket** ("Studieverkstad",
  "8.30-9.45", "Hela dagen").
- **Klass** är elevens klass ur arket, "Okänd klass" för ett namn som inte
  finns kvar i något ark.
- **Schemapass, Lärare, Sal, Innehåll och Ämne** tas från elevens egen klass
  pass: det egna passet om det finns, annars alla parallella, ihopsatta med
  " / ". Ett kolon i innehållet räknas bara när det följs av blanksteg eller
  slutet och texten före är högst 30 tecken, så att en länk inte ger ämnet
  "https".
- **Elev** står utan tillägget " (Rosa)" som sidan sätter på två elever med
  samma namn; Klass skiljer dem åt.
- **Närvarande** är "Kryssad", "Tillagd" (för hand) eller tom (bara en
  notering).
- **Grupp** är gruppens nummer i passets indelning, tom för den som inte är
  med i någon grupp.
- **Arkets vecka** är ifylld när kryssen kommer ur en äldre veckas ark.

Rubrikraden är fet och låst, och filtret är på. Cellerna skrivs som text,
aldrig som formler, så en notering som börjar med "=" räknas inte ut.

## 4. Filer

- `src/utils/xlsx.ts`: en liten generell .xlsx-skrivare (ett blad, fet och
  låst rubrikrad, filter, kolumnbredder, datum och klockslag). Zippar med
  `fflate`, som redan fanns via jspdf och nu är ett direkt beroende.
- `src/utils/narvaroExport.ts`: `exportRows`, `titleClass` och
  `subjectOf`. Raderna byggs av samma genomgång (`weekBlocks`) som texten.
- `src/utils/narvaro.ts`: `SessionRow` har också `tags`, `note` och `group`.
  Texten ändras inte.
- `src/components/narvaro/NarvaroExportDialog.tsx`: knappen Ladda ner Excel.
  Filen byggs först vid klick.

## 5. Avvikelser från planen

- **Hela dagen** får schemapassets tider när det finns ett (studiebesöket
  08:30–15:30), inte tomma tider. Utan schemapass är de tomma.
- **Schemapasset väljs per elevens klass**, inte per stycke. Provet med en
  riktig fil visade att Oliv-elever fick Tema Rosa när Oliv och Rosa delats
  in i grupper tillsammans, eftersom användarens eget pass valdes för hela
  stycket. Textexporten visar som förut stycket gemensamma Schema-rad.
- Zip-testet ligger i `xlsx.zip.test.ts` och körs i Node: under jsdom känner
  fflate inte igen sina egna byte-arrayer, vilket inte händer i webbläsaren.

## 6. Provat 2026-11-18

En fil byggd ur testdatan lästes med `openpyxl` (utan varningar: datum och
klockslag med rätt typ och format, fet och låst rubrikrad, filter) och
konverterades med LibreOffice (`soffice --headless --convert-to csv`) utan
fel. Å, ä, ö, emoji, radbrytningar och en notering med "=" kom fram som de
skrevs.

## 7. Prov för Tobias

1. Ladda ner Excel med två veckor och två klasser. Öppna i Excel: ingen fråga
   om att reparera filen.
2. Rubrikraden är låst och filtret på. Sortera på Datum och Start.
3. Ladda upp till Google Drive, öppna och välj Arkiv → Spara som Google
   Kalkylark. Gör en pivottabell med Ämne som rader och Aktiv som summa.
4. Ett pass med grupper över två klasser: varje elev har sin egen klass
   schemapass.
5. En elev som var närvarande utan notering har en rad med tom Notering.

## 8. Nästa steg: formateringen

Inte bestämt än. Tobias har provfilen (byggd ur testdatan) och vill arbeta
vidare med hur kalkylarket ska se ut för att vara användbart. Frågor att ta
med till det samtalet:

- Vilka kolumner som behövs, och i vilken ordning. Många är tomma för de
  flesta rader (Passnamn, Skola, Grupp, Arkets vecka).
- Om noteringarna ska radbrytas i cellen, och hur breda kolumnerna ska vara.
- Om det behövs fler blad, till exempel en sammanställning per elev eller per
  ämne med antal stämplar, utöver bladet med alla rader.
- Om stämpelkolumnerna ska ha färg som stämplarna på sidan.

