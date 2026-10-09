# Plan: Temat Kronberg

Status: steg 0–8 genomförda 2026-10-09 på grenen ccr-d2c1653a-tupg0s, inte
sammanslagna med main. Fråga 4 i avsnitt 9 är fortfarande öppen. Avvikelser
från planen står i avsnitt 11.

Kronberg är ett andra utseende för Drive C, inspirerat av Dieter Rams och
Braun: grå ramar i stället för svarta, inga hårda skuggor, en enda
signalfärg och siffror som på ett instrument. Det nuvarande utseendet kallas
här **Neo**. Kronberg byggs bredvid Neo och slås på per webbläsare. Neo ska
se likadant ut som idag genom hela arbetet.

Underlag:

- Prototypen visar schemaplaneraren i båda stilarna:
  https://claude.ai/artifact/1XnVrqbmJrQUG32NXpvXCg
- `docs/plans/schema-knappar-och-menyer.md` ordnar om knappar och menyer i
  schemaplaneraren. Den planen genomförs först (avsnitt 5, steg 0).

---

## 1. Beslut

| # | Fråga | Beslut |
|---|---|---|
| 1 | Hur temat väljs | `data-theme="kronberg"` på `<html>`. Utan attributet gäller Neo. Valet sparas i localStorage (`app.theme.v1`) och gäller bara i den webbläsaren. |
| 2 | Hur temat byggs | Med variabler. Ett lager med `--ui-*`-variabler får ett Neo-värde och ett Kronberg-värde (avsnitt 2). Alla andra variabler och komponenter läser från det lagret. Ingen komponent frågar i JavaScript vilket tema som gäller. |
| 3 | Ordning | En vy i taget, med Schema först. Varje steg är en egen PR och kan släppas för sig, eftersom Neo är standard. |
| 4 | Växlaren | Under arbetet slås temat på med `?tema=kronberg` och av med `?tema=neo` i adressen. Ett val i Schema-menyn kommer först när alla vyer är klara (steg 8). |
| 5 | Kursfärger | Sparas som idag. Kronberg dämpar dem när de visas, med `color-mix` i CSS. Inga data ändras. |
| 6 | Typsnitt | Red Hat Text för brödtext i båda temana. Kronberg lägger till IBM Plex Mono för tider, siffror, etiketter och kortkommandon. Sidnamnet (SCHEMA) sätts i Archivo i stället för Monument Extended. |
| 7 | Bakgrundsbilden | `bakgrund59.png` visas bara i Neo. Kronberg har en jämn grå botten. |
| 8 | Export | PDF, PNG och SVG ser ut som idag i båda temana. Schemats export har en egen färgfil (`src/utils/schedulePdf/theme.ts`). Temahjulets och workspace exporter bygger på sidan och kräver var sin åtgärd för att förbli oförändrade (10.1). |
| 9 | Mörkt läge | Ingår inte. Variablerna gör det möjligt senare. |

---

## 2. Variablerna

En ny fil, `src/styles/tokens.css`, importeras först i `src/app/globals.css`.
`:root` får Neo-värdena och `[data-theme="kronberg"]` skriver över dem.

| Variabel | Används till | Neo | Kronberg |
|---|---|---|---|
| `--ui-bg` | Sidans botten | `#ffffff` (bakom bilden) | `#E3E2DE` |
| `--ui-surface` | Paneler, verktygsfält, dialoger | `#ffffff` | `#F6F5F2` |
| `--ui-surface-2` | Rutnätets botten | `#f9fafb` | `#F6F5F2` |
| `--ui-surface-3` | Tidsaxel, hovring i menyer | `#f3f4f6` | `#EEEDE9` |
| `--ui-paper` | Fält, dagkolumner, menyer | `#ffffff` | `#FCFBF9` |
| `--ui-ink` | Text | `#000000` | `#1F2022` |
| `--ui-ink-2` | Lärare, sal, anteckningar | `#374151` | `#3A3B3E` |
| `--ui-muted` | Etiketter, metadata | `#6b7280` | `#626366` |
| `--ui-subtle` | Ikoner, platshållare | `#9ca3af` | `#727275` |
| `--ui-line` | Ramar runt ytor | `#000000` | `#CFCDC7` |
| `--ui-frame-w` | Ramens bredd | `2px` | `1px` |
| `--ui-hair` | Avdelare och rutnät | `#e5e7eb` | `#E4E2DD` |
| `--ui-hour` | Timlinjer | `#f3f4f6` | `#ECEAE5` |
| `--ui-control-line` | Kanten på textfält och listor | `#000000` | `#8A8882` |
| `--ui-frame-shadow` | Skugga på ytor | `4px 4px 0 #000` | `none` |
| `--ui-frame-shadow-sm` | Skugga på knappar och små kort | `2px 2px 0 #000` | `none` |
| `--ui-float-shadow` | Menyer och dialoger | `4px 4px 0 #000` | `0 10px 28px rgba(31,32,34,.12)` |
| `--ui-radius` | Ytor | `0.75rem` | `6px` |
| `--ui-radius-sm` | Knappar och fält | `5px` | `4px` |
| `--ui-btn-h` | Knapphöjd | `40px` | `34px` |
| `--ui-btn-hover` | Knappens botten vid hovring | samma som botten | `#EEEDE9` |
| `--ui-press-x`, `--ui-press-y` | Knappens rörelse vid hovring | `2px`, `2px` | `0`, `0` |
| `--ui-accent` | Primärknapp | `#ff6b6b` | `#B84A16` |
| `--ui-accent-fg` | Text på primärknapp | `#000000` | `#FFFFFF` |
| `--ui-lamp` | Lampan för det som är öppet | `#000000` | `#D9581C` |
| `--ui-danger` | Röd text | `#be123c` | `#A8321C` |
| `--ui-danger-bg`, `--ui-danger-fg` | Bekräfta-knappen när något tas bort | `#fecdd3`, `#000000` | `#A8321C`, `#FFFFFF` |
| `--ui-warning-bg` | Statusmärken (låst, utesluter) | `#fde68a` | `#EFE3C8` |
| `--ui-scrim` | Bakom dialoger | `rgba(0,0,0,.8)` | `rgba(31,32,34,.28)` |
| `--ui-focus` | Fokusram | `#000000` | `#1F2022` |
| `--ui-course-mix` | Kursfärgens styrka | `100%` | `72%` |
| `--ui-font-mono` | Siffror, tider, etiketter | `ui-monospace, SFMono-Regular, Menlo, monospace` | `var(--font-plex-mono), ui-monospace, monospace` |

Värdena för Kronberg kommer från prototypen, med tre ändringar för kontrast:

- `--ui-muted` är mörkare än i prototypen och når 4,6:1 mot `--ui-bg`.
- `--ui-subtle` når 4,4:1 och används bara till ikoner och platshållare,
  aldrig till text man behöver läsa. Kortkommandon i menyer använder
  `--ui-muted`.
- Textfält och listor får en egen, mörkare kant (`--ui-control-line`, 3,3:1),
  så att de går att se som fält. Ramar runt paneler får vara ljusa, eftersom de
  inte är något man klickar på.

Neo-värdena är de vanligaste värdena idag. Där komponenter idag skiljer sig åt
(skuggor på 2, 3 och 4 px, `rounded-xl` och `0.75rem`) samlas de på det
vanligaste värdet. Varje sådan ändring i Neo står i PR:en.

### 2.1 De gamla variablerna läser från de nya

Variablerna som redan finns behåller sina namn, så att CSS-filerna fungerar
som förut. Deras värden byts mot `--ui-*`:

- `src/styles/schedule-theme.css`: `--sp-border` blir
  `var(--ui-frame-w) solid var(--ui-line)`, `--sp-shadow` blir
  `var(--ui-frame-shadow)` och så vidare för alla `--sp-*`.
- `src/app/workspace/_feature/styles/workspace.css`: `--ws-*` läser redan från
  `--sp-*` med reservvärden. Reservvärdena byts mot `--ui-*`.
- `src/styles/month-calendar.css`: `--mc-*` som har egna färger får egna
  Kronberg-värden under `[data-theme="kronberg"] .mc-root`.
- `src/app/globals.css`: `--main` blir `var(--ui-accent)` och `--shadow` blir
  `var(--ui-frame-shadow-sm)`. `--radius` (grund för `rounded-lg/md/sm`) får
  ett eget Kronberg-värde, `4px`, men behåller `0.375rem` i Neo.
- `ConfirmDialog` färgar idag bekräfta-knappen med `bg-rose-200` när något
  tas bort, och `bg-rose-300` vid hovring. Den använder `--ui-danger-bg`,
  `--ui-danger-fg` och en ny `--ui-danger-bg-hover` (`#fda4af` i Neo,
  `#922A17` i Kronberg) i stället.

### 2.2 Tailwind

`tailwind.config.ts` får namn som pekar på variablerna, så att komponenterna
kan använda dem i stället för hårdkodade klasser:

- `colors.ui`: `bg`, `surface`, `surface-2`, `surface-3`, `paper`, `ink`,
  `ink-2`, `muted`, `subtle`, `line`, `hair`, `control`, `accent`,
  `accent-fg`, `danger` → `bg-ui-surface`, `text-ui-muted`, `border-ui-line`
  och så vidare.
- `borderWidth.frame: 'var(--ui-frame-w)'` → `border-frame`.
- `boxShadow`: `frame`, `frame-sm` och `float`.
- `borderRadius`: `ui` och `ui-sm`.
- `fontFamily.mono: 'var(--ui-font-mono)'`. Alla `font-mono` som finns idag
  följer då med utan att röras.
- `colors.border` är idag `hsl(var(--border))`, men `--border` är `#000`.
  `hsl(#000)` är ogiltigt, och en ogiltig färg via variabel faller tillbaka
  på `currentColor`. Ramen får alltså textens färg, inte svart. Den ändras
  till `var(--ui-line)`. Det ändrar Neo på fyra ställen, som står i PR:en
  (10.3).
- `colors.bw`, `mtext` och `text` pekar på `--ui-paper` och `--ui-ink`.

---

## 3. Gemensamma regler för komponenter

### 3.1 Byten

Varje steg byter de hårdkodade klasserna i sina filer så här:

| Idag | Blir |
|---|---|
| `border-2 border-black` (ram runt yta eller knapp) | `border-frame border-ui-line` |
| `border-2 border-black` på textfält | `border-frame border-ui-control` |
| `shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]`, `shadow-[4px_4px_0_0_#000]`, `shadow-neo` | `shadow-frame` |
| `shadow-[2px_2px_0_0_#000]` och liknande | `shadow-frame-sm` |
| `rounded-xl` på ytor | `rounded-ui` |
| `bg-white` på ytor | `bg-ui-surface` (på fält och kolumner `bg-ui-paper`) |
| `text-gray-500`, `text-gray-600` | `text-ui-muted` |
| `text-gray-400` | `text-ui-subtle` |
| `border-gray-200`, `border-gray-100` | `border-ui-hair` |

Svart som betyder något annat än "ram" ändras inte. Det gäller
markeringsramar, ikoner och text i innehåll som användaren valt.

### 3.2 Knappar med färg

Neo ger många knappar en egen pastellfärg (Nytt schema grön, Spara gul, ta
bort rosa). I Kronberg är knappar neutrala, och färg betyder något. Färgerna
ersätts av fem klasser i `globals.css`:

| Klass | Neo | Kronberg |
|---|---|---|
| `ui-tint-create` | `bg-emerald-100`, hovring `-200` | neutral |
| `ui-tint-save` | `bg-amber-100`, hovring `-200` | neutral |
| `ui-tint-info` | `bg-sky-100`/`bg-indigo-100` | neutral |
| `ui-tint-danger` | `bg-rose-100 text-rose-800` | neutral botten, `--ui-danger` som text |
| `ui-tint-warning` | `bg-amber-200` (statusmärken) | `--ui-warning-bg` |

Primärknappen (`Button` utan variant) använder `--ui-accent`. Varje dialog
har högst en primärknapp.

### 3.3 Knappens rörelse

`Button` och `.planner-btn` skjuts idag 2 px vid hovring när skuggan
försvinner. Den rörelsen flyttas till en klass i `globals.css`, `ui-press`:

- Neo: flytta `--ui-press-x`/`--ui-press-y` och ta bort skuggan, som idag.
- Kronberg: ingen rörelse vid hovring men botten blir `--ui-btn-hover`. Vid
  klick trycks knappen ned 1 px.

### 3.4 Kursfärger

Komponenter som målar en kursfärg sätter variabeln `--course` i stället för
`backgroundColor` och får klassen `ui-course-fill`:

```css
.ui-course-fill {
  background-color: color-mix(in oklab, var(--course) var(--ui-course-mix), var(--ui-paper));
}
```

I Neo blandas ingenting (100 %), så färgen är exakt som idag. I Kronberg
dämpas alla färger lika mycket, också egna färger och färger från
färgreglerna. 72 % ska jämföras med prototypen och justeras där.
`ui-course-fill` används bara där texten på färgen alltid är mörk, det vill
säga i Schema. Där blir kontrasten bättre av dämpningen. I temahjulet,
Arbetslag och workspace väljs textfärgen med `getReadableTextColor` utifrån
den odämpade färgen, och där skulle vit text tappa kontrast (10.2). Där
dämpas inte färgerna.

### 3.5 Bakgrundsbilden

De sex ställen som visar `bakgrund59.png` får klassen `ui-backdrop` på sitt
omslag. `[data-theme="kronberg"] .ui-backdrop { display: none }`, och
`body` får `bg-ui-bg` i stället för `bg-white`.

### 3.6 Typsnitt

- `RootLayoutBase.tsx` laddar `IBM_Plex_Mono` (400, 500) och `Archivo` med
  breddaxeln från `next/font/google`, som variabler (`--font-plex-mono`,
  `--font-archivo-var`). De laddas i båda temana, eftersom next/font inte kan
  laddas villkorligt. Kostnaden är två små filer.
- `.font-monument` på sidnamnet byts mot `.ui-wordmark`: Monument Extended med
  spärrning `.2em` i Neo, Archivo 700 i 88 % bredd med spärrning `.14em` i
  Kronberg.
- Små versala etiketter (panelrubriker, gruppnamn i menyer) får klassen
  `ui-label`: som idag i Neo, IBM Plex Mono 11–12 px med spärrning `.08em` i
  Kronberg.
- Bangers och Archivo Black i workspace är rubriker som användaren väljer
  själv. De är innehåll och ändras inte.

### 3.7 Rader i stället för lådor

Där Neo ritar en låda per rad i en lista (sparade scheman, arkivkort) visar
Kronberg rader med en hårlinje emellan. Det görs i CSS under
`[data-theme="kronberg"]`, inte med annan markup.

---

## 4. Växlaren

- `RootLayoutBase.tsx` får ett litet inline-skript i `<head>` som körs före
  första ritningen. Det läser `?tema=` i adressen (och sparar det) eller
  `app.theme.v1` i localStorage, och sätter `data-theme` på `<html>`. Utan
  skriptet blinkar sidan i Neo innan Kronberg slår till.
- `<html>` får `suppressHydrationWarning`, eftersom attributet sätts före React.
- `src/hooks/useUiTheme.ts` läser och byter tema. Den sätter attributet och
  localStorage.
- I steg 8 får Schema-menyn (`FeatureNavigation.tsx`) en grupp "Utseende" med
  `DropdownMenuRadioGroup`: Neo och Kronberg. Valet flyttades sedan ut ur
  menyn, se avsnitt 11.

---

## 5. Steg

Varje steg är en egen PR mot `main`. Neo ska se likadant ut efter varje steg.
Jämför skärmbilder av de berörda vyerna i Neo före och efter.

### Steg 0: Knappar och menyer i schemaplaneraren

Genomför `docs/plans/schema-knappar-och-menyer.md`. Då slipper Kronberg ge
stil åt knappar som ändå ska bort.

### Steg 1: Grunden

- `src/styles/tokens.css` med båda värdeuppsättningarna (avsnitt 2).
- `globals.css` och `tailwind.config.ts` enligt 2.1 och 2.2.
- Växlaren utan menyval (avsnitt 4).
- Typsnitten (3.6) och klasserna `ui-press`, `ui-tint-*`, `ui-course-fill`,
  `ui-backdrop`, `ui-wordmark` och `ui-label`.
- Den gemensamma fokusramen i `globals.css` använder `--ui-focus`.
- Komponenterna i `src/components/ui`: `button`, `card`, `dialog` (botten,
  ram, skugga, scrim och radie), `input`, `textarea`, `dropdown-menu` och
  `checkbox`. De har 9 svarta ramar och 7 skuggor.
- Klart när: `?tema=kronberg` ger Kronberg-dialoger, -menyer och -knappar
  överallt, även om vyerna runt dem fortfarande är Neo.

### Steg 2: Schema

Filer: `src/styles/schedule-theme.css`, `NewSchedulePlanner.tsx`,
`ScheduledEventCard.tsx`, `DraggableSourceCard.tsx`, `ArchiveCard.tsx`,
`DayColumn.tsx`, `PlanningBlockCard.tsx`, `PublicLinkControl.tsx`,
`FindReplacePanel.tsx`, `BulkEditModal.tsx`, `CategoryDebugPanel.tsx`,
`dialogs/*` och `settings/*` i `src/components/schedule`. Där finns 31
svarta ramar, 6 skuggor och 66 färgklasser.

- Allt i avsnitt 3.
- Kursfärgerna på poster, byggstenar och dragbilden (`DragOverlay`) går via
  `ui-course-fill`.
- Tidsaxeln visar `08:00` i Kronberg (`8:00` i Neo) och använder
  `font-mono`.
- Det aktiva schemat i verktygsfältet och i listan får en lampa i
  `--ui-lamp`. I Neo syns ingen lampa, utan arkivikonen och "• aktiv" som
  idag.
- Markeringar behåller sina roller: tangentbordets ram i `--ui-focus`,
  sökträffar i `--ui-lamp`, anteckningsramen blå och massmarkeringen violett
  streckad.
- Statusmärkena (låst, utesluter) använder `ui-tint-warning`.
- Den publika sidan (`/s/[token]`) ingår inte här, se steg 7. Skriptet i
  `<head>` gäller alla sidor från steg 1, så den som slagit på Kronberg ser
  den publika sidan delvis i Kronberg fram till steg 7.
- Klart när: Schema med `?tema=kronberg` motsvarar prototypen.

### Steg 3: Kalender

`src/styles/month-calendar.css` och `src/components/month-calendar`. Ytan
inuti är redan lugn ("papperskänsla"), så det mesta är att ge `--mc-*` och
den yttre ramen Kronberg-värden. Där finns 3 svarta ramar och 18 hex-värden i
CSS-filen. Dagens datum markeras med `--ui-lamp`.

### Steg 4: Temakalender

Områdenas färger är innehåll och dämpas inte (3.4, 10.2). Färger på SVG sätts
som `fill`-attribut som idag, så att exporten är oförändrad (10.1).

`src/components/theme-wheel` och `src/styles/theme-wheel.css`. Där finns 2
svarta ramar, 1 skugga, 31 färgklasser och 12 hex-värden. Områdenas färger i
hjulet är innehåll och ändras inte.

### Steg 5: Workspace

`src/app/workspace/_feature/styles/workspace.css` har redan uppdelningen RAM
och DETALJ. Dess reservvärden byts mot `--ui-*` (2.1), och de 17 svarta
värdena i filen går igenom en i taget. De 125 hex-värdena i
workspace-komponenterna är till största delen färger som användaren väljer
för sitt innehåll. De ändras inte.

### Steg 6: Arbetslag

`src/components/lesson-lab` är störst: 54 svarta ramar, 9 skuggor och 114
färgklasser i nio filer. Gör `LessonLab.tsx` och `LabBoard.tsx` först, sedan
dialogerna.

### Steg 7: Resten

- Bibliotek (`src/app/(full-width)/features/bibliotek`, `src/components/FileList`)
- Termin (`src/components/term-planner`)
- Inloggningen (`src/app/login`)
- `ShortcutHelpOverlay.tsx` och `search.tsx`
- Den publika schemasidan (`src/app/s/[token]`,
  `src/components/schedule/public`), se fråga 3 i avsnitt 9.

### Steg 8: Växlaren i menyn och standardtemat

- Valet "Utseende" i Schema-menyn (avsnitt 4).
- Beslut om vilket tema som är standard och om Neo ska finnas kvar (fråga 4 i
  avsnitt 9).

---

## 6. Kontroll i varje steg

- `pnpm lint`, `pnpm test` och `pnpm build` går igenom.
- Neo: skärmbilder av berörda vyer före och efter visar ingen skillnad,
  förutom de samlade värdena som står i PR:en.
- Kronberg: vyn jämförs med prototypen. Text man behöver läsa når 4,5:1, och
  fält och kryssrutor når 3:1 mot sin botten.
- Sök efter `border-black`, `shadow-[` och `bg-white` i stegets filer.
  Varje kvarvarande träff ska vara ett medvetet undantag (3.1).

---

## 7. Risker

- **Oavsiktliga ändringar i Neo.** Det är den största risken, eftersom
  nästan varje byte i 3.1 rör Neo-koden. Skärmbilderna i avsnitt 6 är skyddet.
  Byt fil för fil, inte med sök och ersätt över hela projektet.
- **`color-mix`** kräver Chrome 111, Safari 16.2 eller Firefox 113. Äldre
  webbläsare ignorerar regeln och visar kursens färg utan dämpning, vilket
  fungerar.
- **Två teman att underhålla.** Ny kod ska använda `--ui-*` och klasserna i
  avsnitt 3 från första dagen. Den regeln bör stå i en CLAUDE.md när steg 1
  är klart.

---

## 8. Utanför planen

- Mörkt läge.
- Exportens utseende (beslut 8).
- Nya ikoner eller ny layout utöver knapp-planen.
- Färger som användaren själv väljer: kursfärger (de dämpas bara när de
  visas), färgregler, markeringspennor i kalendern och rubriktypsnitt i
  workspace.

---

## 9. Öppna frågor

| # | Fråga | Förslag |
|---|---|---|
| 1 | Ska växlaren synas i menyn redan från början? | Nej. `?tema=kronberg` under arbetet, menyvalet i steg 8. Kollegor som delar scheman ser då inte ett halvfärdigt tema. |
| 2 | Ska exporten följa temat? | Nej (beslut 8). Kan bli en egen plan. |
| 3 | Den publika schemasidan | Följer temat från steg 7. Deltagare ser standardtemat, eftersom valet sparas per webbläsare. |
| 4 | Ska Kronberg ersätta Neo när alla vyer är klara? | Bestäms i steg 8. Tas Neo bort kan `--ui-*` behållas och Neo-värdena strykas. |

---

## 10. Granskning

Planen rör inte backend. Temat är CSS och ett val i webbläsarens
localStorage. Inget sparas eller skickas till servern, och de publika
länkarnas `displayConfig` påverkas inte. CSP:n tillåter inline-skript
(`next.config.mjs`), så skriptet i avsnitt 4 fungerar.

### 10.1 Exporterna

Bara schemats export har en egen färgfil. Två exporter bygger på sidan:

- **Temahjulet** (`useThemeWheelExport.ts`) serialiserar SVG:n utan sidans
  CSS. Färger som flyttas från `fill`-attribut till CSS försvinner ur
  exporten, och `background-color` gäller inte SVG alls. Färger i hjulet står
  kvar som attribut. Ska något dämpas på skärmen görs det med en CSS-regel
  för `fill`, som exporten inte ser.
- **Workspace** (`useWorkspaceExport.ts`) fotograferar sidan med
  `html2canvas` och följer därför temat. Exporten sätts därför till Neo medan
  den ritas, genom att `html2canvas` får en `onclone` som tar bort
  `data-theme` från kopian. `html2canvas` 1.4.1 kan inte heller läsa färger
  som `color-mix` ger, så `color-mix` används inte i workspace.

### 10.2 Dämpade färger och textfärg

`getReadableTextColor` väljer mellan mörk och vit text utifrån den sparade
färgen. Dämpad med 72 % mot `--ui-paper` blir vit text på exempelvis
`#e11d48`, `#2563eb` och `#7c3aed` ungefär 3:1 i stället för 5:1. Därför
dämpas bara Schema, där texten alltid är mörk (3.4).

### 10.3 Ändringar i Neo

- `border-border` får svart i stället för textens färg. Det syns på
  Ta bort-knapparna i `ShareArchiveDialog.tsx` och `LabShareDialog.tsx`
  (rosa text) och på den enda `secondary`-knappen, vars kant går från helsvart
  till 60 % svart som klassen säger.
- Hovringen på bekräfta-knappen behålls genom `--ui-danger-bg-hover` (2.1).

---

## 11. Genomförande

Varje steg är en egen commit. Neo har jämförts pixel för pixel mot
skärmbilder från före steg 1, för varje vy och för planerarens menyer och
dialoger. Skillnaderna som återstår är data (en tidsstämpel, ett element som
skapades under provet), inte utseende. En workspace-export gjord i Kronberg
är pixel för pixel lika den i Neo.

Där genomförandet avviker från planen:

- **`kron:`-varianten.** Planen bytte Neo-klasser mot temats klasser. Det
  görs där Neo-värdet är exakt detsamma som en variabel (`border-2
  border-black` → `border-frame border-ui-line`, `text-gray-500` →
  `text-ui-muted`). Där inget delar Neo-värdet (`text-gray-600`) står Neo-klassen
  kvar och en `kron:`-klass bredvid. `kron:` gäller bara under
  `:root[data-theme="kronberg"]`, så Neo kan inte ändras av den.
- **Färgade knappar** är Tailwind-klasser i `src/components/ui/tints.ts`, inte
  CSS-klasser (`ui-tint-*`). Button lägger själv `bg-bw`, och bara en `bg-*`
  i className tar bort den. En klass i components-lagret hade förlorat och
  gjort knappen vit i Neo.
- **Kursfärgerna** blandas 54 % mot en varm grå (`--ui-course-base`,
  `#D8D6D0`), inte 72 % mot papperet. Mot papperet blev pastellerna bara
  ljusare. Blandningen är anpassad efter prototypens sju färger. Dämpningen
  gäller bara i Kronberg; Neo målar `var(--course)` rakt av.
- **Monospace i Neo** är Tailwinds stack. Planens kortare lista saknade
  Consolas och Liberation Mono och hade bytt typsnitt i Neo på Windows och
  Linux.
- **Primärknappar med egen botten.** En knapp i standardvarianten med en
  `bg-*` i className får sidans textfärg i stället för primärknappens. Annars
  blev texten vit på ljus botten i Kronberg.
- **`ui-panel-title`, `ui-toast` och `ActiveLamp`** samlar panelrubriker,
  notiser och lampan för det som är öppet, så att vyerna inte bär långa
  listor med `kron:`-klasser.
- **`tailwind-merge`** känner till de nya namnen (`src/lib/utils.ts`). Utan
  det togs `border-frame` för en färg och tappades bredvid `border-ui-line`.
  Byts `font-monument` mot `ui-heading` i en `cn()` måste `font-monument` stå
  kvar bredvid, eftersom den tar bort en `font-heading` som annars gör
  rubriken fet (inloggningen).
- **Den publika sidan** ritar rutnätet med exportens färgfil och ser därför ut
  som den exporterade bilden i båda temana. Bara sidans ram följer temat.
- **`secondary`-varianten** av Button används inte någonstans, så 10.3:s
  ändring av den syns inte.
- **Växlaren står utanför menyn.** Gruppen "Utseende" i menyn bakom sidnamnet
  är borttagen. I stället står en liten ratt med lampa (`ThemeToggle.tsx`)
  efter sidnamnet och byter till det andra temat med ett klick. Strecket
  pekar åt vänster i Neo och åt höger i Kronberg, och lampan tänds i
  Kronberg. Båda läggs med `kron:` i CSS. Ratten renderas av
  `FeatureNavigation` och syns därför på alla vyer utan att någon vy ändrats.
  Namnrutan före ratten är lika bred i båda temana (en osynlig kopia av namnet
  i Neos typsnitt), så ratten står still när temat byts. Placeringen valdes i
  https://claude.ai/artifact/L9X5AkdYyDohFDbi8UFUzA (variant 3) och ratten i
  https://claude.ai/artifact/GgssRgP6tSTHncrz2aLSxG (variant 6).

Regel för ny kod: använd `--ui-*`, klasserna i avsnitt 3 och `kron:` från
början. Regeln bör flyttas till CLAUDE.md. Den filen finns inte i repot, men
`next.config.mjs` hänvisar till den, så den ligger troligen lokalt. En
incheckad fil hade krockat med den.
