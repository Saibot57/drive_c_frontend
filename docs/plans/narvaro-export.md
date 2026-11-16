# Närvarorutor: exportera noteringar som text

Status: Pågår

Läget 2026-11-16: logiken, dialogen och knappen är byggda. Kvar är proven i
avsnitt 6 mot riktig backend.

Bygger på schemakopplingen
([narvaro-schemakoppling.md](narvaro-schemakoppling.md)) och veckokartan
([narvaro-veckokarta.md](narvaro-veckokarta.md)).

## 1. Vad användaren vill

Tobias vill kunna kopiera eller ladda ner alla sina noteringar som en
textfil och lägga den som ett dokument i skolans gemensamma drive. Varje
pass ska ha datum, schemats titel och schemats anteckning, så att
noteringarna går att härleda till rätt pass.

"Kopiera veckan" fanns redan, men gav bara datum, tid och noteringar för en
vecka.

## 2. Beslut

| Fråga | Beslut |
|---|---|
| Omfång | Veckor väljs i en dialog. Veckan som visas är förvald, och "Alla" väljer alla veckor med noteringar. |
| Ordning | Per pass, i tidsordning. Äldsta veckan först. |
| Klasser | Väljs i dialogen. Klasserna som visas är förvalda. En fil per export, med klassen utskriven vid varje pass. |
| Format | Ren text. Kopiera och Ladda ner .txt ger samma text. |
| Backend | Ingen ändring. Texten byggs i webbläsaren och skickas ingenstans. |
| Mobilläget | Ingen export där. |

## 3. Texten

```
Noteringar från Närvarorutor
Klasser: Oliv, Rosa
Exporterad 2026-11-20


== Vecka 47 · 16/11–22/11 2026 ==

Måndag 16/11 · 10.00-11.30 · Oliv
Schema: Tema Oliv · Sam

  Oliv Ett: Tyst idag

Måndag 16/11 · 10.00-11.30 · Rosa
Schema: Tema Rosa · Kim · Rådhuset
Innehåll: Historia: Historiebruk

  Rosa Ett: Aktiv. Bra fråga
```

- **Ett stycke per pass och klass.** Noteringarna ligger per pass (datum och
  kolumn), inte per klass, men varje klass har sitt eget schemapass. Ett pass
  med noteringar från två klasser blir därför två stycken. Undantaget är
  klasser som delats in i grupper tillsammans: de blir ett stycke
  ("· Grund, Rosa"), så att grupperna hålls hela.
- **Rubriken** är sidans egen (`sessionLabel`), med passets eget namn om det
  har ett, och klassen sist.
- **Schema:** titel, lärare och sal. Finns användarens eget pass bland dem
  som hör till kolumnen och klassen skrivs bara det, annars alla. I en tid
  med nivågrupper ger det "Engelska 2 · Kim" i stället för alla tre.
- **Innehåll:** schemats anteckning. Platshållaren "." hoppas över.
- **Utan schema** för veckan, eller utan pass för kolumnen, skrivs inga
  schemarader. Dialogen säger vilka veckor som saknar schema.
- **Alla närvarande** står i en enda lista per stycke: namn, och efter
  kolon stämplar och fritext för den som har något. Den som var närvarande
  utan notering står med bara namnet. Närvarande är de som är kryssade i
  passet eller tillagda för hand, som på sidan. Ingen uppdelning på skola.
  (Ändrat 2026-11-16 på Tobias begäran.)
- **Bara pass med minst en notering** exporteras. Ett pass där ingen fått
  något kommer inte med, även om det har kryss.
- **Kryssen kommer ur klassens senaste ark.** Är det en äldre veckas (veckans
  ark är inte inklistrat) står raden "Närvaro enligt arket från v. 46" under
  rubriken, eftersom kryssen då inte gäller veckan.
- **Grupper:** har passet sparade grupper skrivs noteringarna grupp för
  grupp, med en tom rad mellan och utan rubrik. Den som inte är med i någon
  grupp står sist. Finns flera
  indelningar för passet (olika klasser visade tillsammans) gäller den som
  täcker flest av klasserna.
- **Namn som inte finns i något ark** (en elev som tagits bort ur arket)
  hamnar under "Okänd klass" och följer alltid med, så att inget försvinner
  ur exporten utan att det syns.
- **Ett pass vars kolumn inte finns kvar i arket** behåller rubriken det
  sparades med och får inga schemarader.
- Veckans ark är klassens senaste till och med veckan (`latestSheets`), som
  på sidan.

Filen heter `noteringar-v47.txt`, eller `noteringar-v45-v47.txt` för flera
veckor.

## 3b. Formatering i Google Dokument (2026-11-16)

Kopiera i dialogen lägger två versioner i urklippet: den rena texten och
samma innehåll som HTML (`exportHtml`). Google Dokument tar HTML-versionen,
ett textfält tar den rena. Ladda ner .txt är oförändrad.

| I texten | I dokumentet |
|---|---|
| Veckan | Rubrik 1 |
| Passet med datum, tid och klass | Rubrik 2 |
| Schema, Innehåll och raden om ett äldre ark | Ett kursivt stycke |
| Namnet | Fetstil, med stämplar och notering efter kolon |
| En grupp | Ett eget stycke |

Rubrikerna ger dokumentet en disposition i Docs vänsterkant. Noteringarna är
stycken, inte tabell (Tobias val). Bara taggar som Docs behåller används
(`h1`, `h2`, `p`, `b`, `i`, `br`), utan färger och typsnitt: utseendet i
övrigt bestämmer Docs. Tecken som `<` och `&` i noteringar skyddas.

Stöder webbläsaren inte formaterad kopiering (`ClipboardItem`) kopieras den
rena texten som förut. Kopiera och Kopiera veckan på sidan ger ren text.

Övervägt och inte byggt: nedladdning som .docx (kräver ett nytt bibliotek),
.html (ett extra steg i Drive) och att skapa dokumentet direkt i Drive
(kräver inloggning mot Google, och då passerar elevnamnen en ny koppling).

## 4. Sekretess

Texten har elevernas namn och noteringar i klartext och lämnar därmed
krypteringen. Dialogen säger det. Inget skickas till servern: schemat läses
som förut med GET, och texten byggs i webbläsaren. Logga den inte.

## 5. Filer

- `src/utils/narvaroExport.ts` med `narvaroExport.test.ts`: `exportText`,
  `exportWeeks`, `exportClasses`, `exportFileName`, `weekTitle`. Testdatan är
  `utils/__fixtures__/narvaroSchedule.ts`.
- `src/components/narvaro/NarvaroExportDialog.tsx`: valen, förhandsvisningen
  och knapparna. Hämtar schemat för de valda veckorna med `ensureWeek` och
  väntar tills alla är lästa innan texten byggs.
- `Narvaro.tsx`: knappen Exportera i sidhuvudet och dialogen. Inget annat.

Raderna byggs av `sessionLines` i `utils/narvaro.ts`, som också Kopiera och
Kopiera veckan på sidan använder (`sessionText`). De ger därför samma lista:
alla närvarande, utan skolor, grupp för grupp när passet har grupper. Kopiera
har inga schemarader.

## 6. Prov i webbläsaren

Mot riktig backend, med noteringar i minst två veckor och två klasser.

1. Exportera öppnar dialogen med veckan som visas och klasserna som visas
   förvalda.
2. Förhandsvisningen har rätt titel, lärare, sal och innehåll för ett
   temapass, och det egna passet för en engelsktimme.
3. Välj en vecka till: den hämtar schemat och hamnar före i texten om den är
   äldre.
4. Avmarkera en klass: dess stycken försvinner.
4b. En närvarande utan notering står med bara namnet. En okryssad står inte
   med. Ett pass med grupper är uppdelat med en tom rad mellan grupperna.
4c. Kopiera i Noteringar ger samma lista som exportens stycke för passet.
5. Kopiera ger samma text som förhandsvisningen. Ladda ner ger en .txt som
   öppnas med å, ä och ö i Google Drive.
5b. Klistra in i ett Google-dokument: veckan är rubrik 1, passen rubrik 2
   och syns i dispositionen, schemat är kursivt, namnen i fetstil och
   grupperna egna stycken. Klistra in i ett textfält: ren text.
6. En vecka utan schema: raden om att schema saknas visas, och passen
   exporteras utan schemarader.
7. Inga anrop med annan metod än GET mot `/api/planner`.
