# Namn på lektionspass i Närvarorutor

Status: Genomförd 2026-11-09 (#259)

## Vad användaren vill

Ett enskilt pass ska kunna få ett eget namn, till exempel "Svenska" eller
"Prov kap 4". Svaren från intervjun:

- Namnet hör till **ett enskilt tillfälle**: datum + kolumn (måndag 3/11,
  kolumn C). Det följer inte med till kommande veckor.
- Namnet gäller **per klass**. Namnger man när flera klasser visas
  tillsammans får **varje vald klass samma namn**. Har de visade klasserna
  olika namn visas **alla olika namn**: "Svenska / Matte". En klass utan namn
  hoppas över.
- Namnet visas **bredvid tiden**: "Måndag 3/11 · Svenska · 8.30-9.45".
- **Hela dagen** kan också namnges: "Måndag 3/11 · Studiedag · hela dagen".
- Namnet syns i **rubriken Noteringar**, i **Tidigare pass** och i **kopierad
  text** (noteringar och grupper). Passknapparna visar som förut bara passraden
  från arket.
- Namnet sätts med en **pennknapp** sist i raden Pass. Den öppnar en liten
  ruta för det valda passet. Enter eller Spara sparar, Esc avbryter, en tom
  ruta tar bort namnet.
- **Fri kort text**, en rad, högst 40 tecken.
- Byts namnet efter att noteringar skrivits visar **Tidigare pass det nya
  namnet**.

## Datamodell

Nytt fält `passNames` i `NarvaroData` och i veckodokumentet:

```ts
/** Passets nyckel (`sessionKey`) till klassens namn på passet. */
export type PassNames = Record<string, Record<string, string>>;
```

- Nyckeln är `sessionKey` (`datum|dag|kolumn` eller `datum|dag|dag`), samma
  som anteckningarna. Den börjar med datumet, så `weekOfSession` lägger
  namnen i rätt veckodokument (`w2026-45: { sheets, notes, groups, passNames }`)
  och de gallras med veckan.
- Inre nyckel är klassen (`''` för en tabell utan klass). Exemplet har sina
  namn i minnet under `exempel`, som anteckningarna.
- `sanitizePassNames` läser defensivt: ett veckodokument utan fältet ger `{}`,
  icke-strängar och tomma namn släpps, för långa kortas.
- `renameClass` flyttar även klassens namn, så att de inte försvinner när en
  tabell utan klass får sin klass.
- Backend ser bara chiffertext. Ingen ändring där.

En äldre flik som fortfarande har den gamla koden öppen sparar veckodokumentet
utan `passNames` och tar då bort veckans namn. Det är samma risk som när
grupper tillkom och går över när fliken laddas om.

## Logik i `src/utils/narvaro.ts` (med tester)

- `MAX_PASS_NAME_LENGTH = 40`, `cleanPassName(s)`: trimmar, slår ihop blanksteg,
  kortar.
- `setPassName(store, key, classes, name)`: sätter namnet för varje klass, tom
  sträng tar bort det; ett pass utan namn tas bort ur store.
- `passNameFor(store, key, classes)`: de visade klassernas olika namn i
  klassordning, ihopsatta med " / ", eller tom.
- `sessionLabel(table, day, pass, now, name?)`: lägger in namnet mellan datum
  och tid.
- `namePass(notes, passNames, key, classes, name, labelFor)`: ger nya
  `passNames` och, om passet har anteckningar, anteckningarna med ny `label`.
  Det är så Tidigare pass följer med.

## Sidan (`Narvaro.tsx`, avgränsat)

- `passNames` från `sync.data` (eller exemplets state), `name = passNameFor(…)`
  och `label = sessionLabel(…, name)`.
- Pennknapp + inline-ruta i raden Pass. Inget annat i filen formateras om.
- Kopiera i Noteringar använder aktuell `label` (`{ ...sess, label }`), inte
  den som sparades senast.

## Steg

1. Typer, `sanitizePassNames` och veckodokumentet i `narvaroDocs.ts` +
   tester (rundtur, äldre dokument utan fältet, `renameClass`).
2. Funktionerna i `narvaro.ts` + tester.
3. Sidan.
4. `tsc`, `lint`, `test`, `build`, commit och push.
