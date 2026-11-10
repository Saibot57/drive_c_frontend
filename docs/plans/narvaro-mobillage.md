# Mobilläge i Närvarorutor

Status: Genomförd 2026-11-09 (#261)

## Bakgrund

Önskemål: ett läge som fungerar medan man går omkring bland deltagarna.
Man väljer en etikett och trycker på namnrutor, och rutorna visas antingen
grupp för grupp eller för hela klassen.

Anteckningar har redan en aktiv stämpel (välj stämpel, tryck på namn, ett
nytt tryck tar bort stämpeln). Mobilläget behåller den modellen men bygger
en egen layout för tummen. Datan ändras inte: stämplarna sparas som i dag
med `toggleStamp` via `useNarvaroSync`, och backend berörs inte.

## Beslut från intervjun

| Fråga | Beslut |
|---|---|
| Hur läget slås på | Automatiskt under 640 px bredd, och med en knapp. Knappens val (på/av) sparas per enhet och går före bredden. |
| Stämpelval | Fast list längst ned i tummens räckvidd. Den rullar i sidled om stämplarna inte får plats. Ett tryck väljer den aktiva stämpeln. |
| Tryck på namnruta | Sätter den aktiva stämpeln, och ett nytt tryck tar bort den. |
| Fritext | Ett långt tryck (0,5 s) på rutan öppnar den dialog som finns i dag (`NarvaroNoteDialog`). |
| Klassen / Grupper | Ett reglage. Grupper visar rutorna under rubriker från passets sparade grupper, och närvarande utan grupp hamnar sist under "Utan grupp". Har passet inga grupper är Grupper-valet avstängt med texten "Inga grupper för passet". |
| Sortering | Alltid förnamn, både i klassvyn och inom varje grupp. |
| Rutor | Två kolumner på stående telefon. Fler när det får plats (liggande, surfplatta). Förnamnet stort, efternamnet och stämplarna under. |
| Kvittens | Rutan blinkar, och telefonen vibrerar kort där det stöds (inte iPhone). |
| Ångra | En Ångra-knapp i listan, upp till 10 steg bakåt för stämplar i passet. Ett kort meddelande visar vad som ångrades. Historiken töms när passet byts. |
| Skärmen | Hålls vaken automatiskt (Wake Lock) medan läget visas. |
| Överst | En kompakt rad med passets namn, sparstatus, Klassen/Grupper, en knapp som fäller ut val av klass, skola, dag och pass, och en knapp som lämnar mobilläget. |
| Döljs | Verktygsraden, inklistring, stämpelredigering, Noteringar-listan, tidigare pass, gruppverktygen och frågan om tabell utan klass. |
| Frånvarande | En hopfälld lista "Inte markerade (n)" längst ned. Ett tryck lägger till personen, som i dag. |
| Startstämpel | Den senast använda på enheten, annars den första. |

## Utformning

### Ny logik: `src/utils/narvaroMobile.ts` (+ `narvaroMobile.test.ts`)

- `MobilePref = 'auto' | 'on' | 'off'`, `sanitizeMobilePref`, och
  `isMobileMode(pref, smallScreen)`.
- `pickActiveStamp(stamps, savedId)`: det sparade id:t om stämpeln finns
  kvar, annars den första stämpeln, eller `null` om det inte finns några.
- `byFirstName(names)`: sorterar på förnamn med `localeCompare(..., 'sv')`
  och sedan på hela namnet.
- `mobileSections(view, present, storedGroups)`: ger `{ title, names }[]`.
  Klassvyn är en sektion, och gruppvyn bygger på `groupView` med alla
  närvarande, så att även de som uteslutits ur grupperna syns under "Utan
  grupp". Tomma grupper hoppas över.
- `setStamp(sess, name, stampId, on)`: sätter eller tar bort stämpeln
  uttryckligen, utan att växla. Med den tar Ångra bort precis det trycket
  gjorde, även om personen ändrats i dialogen emellan.
- `pushUndo(stack, entry, max = 10)` och `UndoEntry = { key, name, stampId,
  on }`. Bara poster för det aktuella passet (`key`) visas och ångras.

### Nya komponenter och hookar

- `src/components/narvaro/NarvaroMobile.tsx`: rutorna, sektionerna, listan
  längst ned, Ångra, blinkningen, vibrationen, det långa trycket och de
  frånvarande. Komponenten tar emot passets data och callbacks från
  `Narvaro.tsx` och äger själv vyval, ångrahistorik och kvittens.
- `src/hooks/useWakeLock.ts`: `useWakeLock(enabled)`. Låset tas när läget
  visas, tas igen när fliken blir synlig (webbläsaren släpper det när fliken
  göms), och släpps när läget stängs. Fel sväljs, eftersom alla webbläsare
  inte har API:t.
- Det långa trycket görs med pekhändelser: en timer på 500 ms som avbryts om
  fingret rör sig mer än 10 px eller släpps. Klicket som följer ett långt
  tryck ignoreras. Rutorna får `select-none` och
  `[-webkit-touch-callout:none]`, och `contextmenu` stoppas, så att iOS inte
  markerar text eller visar en meny.

### Ändringar i `Narvaro.tsx` (hålls små, eftersom andra sessioner ändrar filen)

- Två localStorage-nycklar via `usePersistentState`:
  `narvaro.mobile.v1` (`'auto' | 'on' | 'off'`) och `narvaro.stamp.v1` (id
  för senaste stämpeln i mobilläget, som inte är en personuppgift).
- `useMediaQuery('(max-width: 639px)')` ger `smallScreen`.
- En knapp "Mobilläge" i verktygsraden.
- I mobilläget döljs verktygsraden, och urvalssektionen visas bara när den
  fällts ut från den kompakta raden. Dess nedre del (lägesflikarna och
  verktygen för Anteckningar och Grupper) döljs helt. Rutnätet, de
  frånvarande, `NarvaroGroups`, Noteringar och Tidigare pass döljs genom att
  slås in i `{!mobile && ...}` utan att indenteringen ändras.
- Urvalssektionen återanvänds som den är, så att ändringar av passen från
  andra sessioner följer med till mobilläget utan extra arbete.
- Dialogen för noteringar och `editing`-tillståndet delas med vanliga läget.
- Sidans meddelanden (toast) flyttas upp ovanför listan när mobilläget visas.

### Färger

Bara befintliga tokens (`bg-ui-*`, `STAMP_BG`). Inga nya hex-värden.

## Steg

1. `narvaroMobile.ts` med tester.
2. `useWakeLock.ts`.
3. `NarvaroMobile.tsx`.
4. Inkoppling i `Narvaro.tsx`.
5. `tsc`, `lint`, `test` och `build`. Kontroll i Playwright: iPhone stående
   och liggande, med exempeltabellen, i klassvyn och gruppvyn, med ett långt
   tryck och Ångra.

## Inte med

- Inga ändringar i backend eller i datamodellen.
- Ingen slumpning eller redigering av grupper i mobilläget. Grupper skapas
  i vanliga läget.
- Ingen Ångra för fritext eller för att lägga till personer.

## Avvikelser vid genomförandet

- Ett högerklick öppnar också noteringen, liksom Androids eget långa tryck
  (`contextmenu`). Det öppnar dialogen en gång, inte två.
- Har passet inga grupper står "Inga grupper för passet." i huvudet, utan
  hänvisningen till vanliga läget, så att sparstatusen får plats på samma
  rad på en smal telefon.
- Den aktiva stämpeln rullas fram i listan när den väljs.
- Kontrollerat i Playwright (iPhone 13, stående 390 px och liggande 844 px)
  med exempeltabellen och en simulerad backend. Inget rullar i sidled.
