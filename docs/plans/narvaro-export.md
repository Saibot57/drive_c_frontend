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
  med noteringar från två klasser blir därför två stycken.
- **Rubriken** är sidans egen (`sessionLabel`), med passets eget namn om det
  har ett, och klassen sist.
- **Schema:** titel, lärare och sal. Finns användarens eget pass bland dem
  som hör till kolumnen och klassen skrivs bara det, annars alla. I en tid
  med nivågrupper ger det "Engelska 2 · Kim" i stället för alla tre.
- **Innehåll:** schemats anteckning. Platshållaren "." hoppas över.
- **Utan schema** för veckan, eller utan pass för kolumnen, skrivs inga
  schemarader. Dialogen säger vilka veckor som saknar schema.
- **Noteringarna** skrivs som i Kopiera (`sessionText`): stämplar, sedan
  fritext. Har klassen flera skolor står de som underrubriker.
- **Namn som inte finns i något ark** (en elev som tagits bort ur arket)
  hamnar under "Okänd klass" och följer alltid med, så att inget försvinner
  ur exporten utan att det syns.
- **Ett pass vars kolumn inte finns kvar i arket** behåller rubriken det
  sparades med och får inga schemarader.
- Veckans ark är klassens senaste till och med veckan (`latestSheets`), som
  på sidan.

Filen heter `noteringar-v47.txt`, eller `noteringar-v45-v47.txt` för flera
veckor.

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

"Kopiera veckan" i den gula raden för en tidigare vecka är kvar som den var.

## 6. Prov i webbläsaren

Mot riktig backend, med noteringar i minst två veckor och två klasser.

1. Exportera öppnar dialogen med veckan som visas och klasserna som visas
   förvalda.
2. Förhandsvisningen har rätt titel, lärare, sal och innehåll för ett
   temapass, och det egna passet för en engelsktimme.
3. Välj en vecka till: den hämtar schemat och hamnar före i texten om den är
   äldre.
4. Avmarkera en klass: dess stycken försvinner.
5. Kopiera ger samma text som förhandsvisningen. Ladda ner ger en .txt som
   öppnas med å, ä och ö i Google Drive.
6. En vecka utan schema: raden om att schema saknas visas, och passen
   exporteras utan schemarader.
7. Inga anrop med annan metod än GET mot `/api/planner`.
