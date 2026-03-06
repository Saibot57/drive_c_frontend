# Invisible Design Audit -- Drive C Frontend

**Datum:** 2026-03-06
**Scope:** Next.js 14.2 / Tailwind CSS / Radix UI -- alla sidor och komponenter
**Metod:** Statisk kodanalys av CSS, TSX-komponenter och service-filer

---

## 1. Spacing & Rytm (The 8pt Grid)

### 1.1 neobrutalism.css -- systematiskt kaos
**Severity: 5/5**

Familjeschema-stylesheetet (`src/components/familjeschema/styles/neobrutalism.css`) har 60+ spacing-varden som bryter mot 4/8pt-gridet. De vanligaste overtrampningarna:

| Varde | Forekomster | Problem |
|-------|-------------|---------|
| `15px` | 15+ (padding, gap) | Borde vara 16px (4*4) |
| `10px` | 10+ (gap) | Borde vara 8px eller 12px |
| `25px` | 3 (margin-bottom) | Borde vara 24px |
| `30px` | 2 (padding, margin) | Borde vara 32px |
| `5px` | 3 (margin-top, padding) | Borde vara 4px eller 8px |

Exempel (rad 55-56, 64):
```css
.schedule-container { padding: 30px; margin-bottom: 30px; }  /* -> 32px */
.schedule-header    { margin-bottom: 25px; }                  /* -> 24px */
```

### 1.2 Sub-4pt padding i produktions-komponenter
**Severity: 3/5**

`p-0.5` (2px), `gap-0.5` (2px), `py-0.5` (2px) och `space-y-0.5` (2px) anvands pa 10+ stallen i schedule- och command-center-komponenter. Dessa minskar klickbar yta och gor kortelement kladdiga.

Filer:
- `ScheduledEventCard.tsx` rad 77, 93, 101, 109-110
- `DraggableSourceCard.tsx`
- `TerminalPanel.tsx` rad 48

### 1.3 Halvsteg (1.5-varden) utan konsekvens
**Severity: 2/5**

`mt-1.5` (6px) och `mb-1.5` (6px) dyker upp 6+ ganger i NotesBasket och TodoList. Dessa ar inte nonstandardvarden i Tailwind men anvands blandat med `mt-2` (8px) for likvardiga element, vilket bryter visuell rytm.

Filer:
- `NotesBasket.tsx` rad 177, 190, 195
- `DailySchedulePanel.tsx` rad 48-73

### 1.4 Arbitrara bredder och hojder
**Severity: 2/5**

Hardkodade matlosa pixelvarden: `w-[122px]`, `w-[360px]`, `h-[1100px]`, `w-[50px]`, `max-h-[100px]`. Dessa binder layout till magiska tal istallet for ett flexibelt system.

Fil: `NewSchedulePlanner.tsx` rad 727, 823, 828, 914, 1001

---

## 2. Typografi & Line-height

### 2.1 Ingen konsekvent type scale
**Severity: 5/5**

neobrutalism.css definierar 35+ olika font-size-varden med tre blandade enheter:

```
rem (dominerande): .6rem, .75rem, .8rem, .85rem, .9rem, 1rem, 1.1rem, 1.2rem, 1.3rem, 1.5rem, 1.6rem, 1.8rem, 2rem, 2.5rem
px: 28px, 20px
Tailwind-klasser: text-xs, text-sm, text-base, text-lg
```

Manga hamnar pa udda pixelvarden: `.85rem` = 13.6px, `.9rem` = 14.4px, `1.3rem` = 20.8px, `1.6rem` = 25.6px. Dessa ligger mittemellan Tailwinds skala (12/14/16/20/24px) och skapar en "nastan ratt men inte riktigt"-kansla.

### 2.2 `text-[9px]` och `text-[10px]` overallt
**Severity: 4/5**

30+ instanser av arbitrara fontstorlekar under Tailwinds `text-xs` (12px):

| Varde | Forekomster | Filer |
|-------|-------------|-------|
| `text-[10px]` | 15+ | ScheduledEventCard, DayColumn, DraggableSourceCard, ViewNoteModal, NotesBasket, EventCard |
| `text-[9px]` | 10+ | TodoList, TemplatesModal, EventCard, NotesBasket, ScheduledEventCard |

Text under 12px ar svar att lasa, sarskilt pa mobilskarm. En enda `text-2xs`-klass i Tailwind-configen hade standardiserat detta.

### 2.3 `leading-none` (line-height: 1.0) pa lascontent
**Severity: 3/5**

`leading-none` anvands 8+ ganger pa taggar, tidvisning och kortetiketter -- content som borde ha hogre radavstand for lasbarhet.

- `ScheduledEventCard.tsx` rad 82 -- tidvisning
- `DayColumn.tsx` rad 61, 78 -- tidvisning
- `NotesBasket.tsx` rad 181 -- taggar
- `ViewNoteModal.tsx` rad 49 -- taggar

`leading-none` ar godkant for ensamma ikoner/siffror men inte for lasbar text.

### 2.4 Saknad `leading-normal` (1.5)
**Severity: 2/5**

Ingen komponent anvander `leading-normal`. Kodbasen hoppar fran `leading-tight` (1.25) till `leading-relaxed` (1.625), och missar "the goldilocks zone" 1.4-1.5 for brodtext.

---

## 3. Visuell Hierarki (Squint Test)

### 3.1 Containeritis -- alla paneler skriver lika hogt
**Severity: 5/5**

`StandardDashboardLayout.tsx` applicerar identisk neobrutalism-styling pa ALLA paneler:
```tsx
const NEO = 'rounded-xl border-2 border-black bg-white shadow-[4px_4px_0px_rgba(0,0,0,1)]';
```

Toolbar, vansterpanel, centerpanel och hogerpanel far exakt samma visuella tyngd. Resultatet ar ett rutnot av lika-starka lador utan tydlig fokuspunkt. I Command Center innebar det 5 stycken tjocka svarta ramar pa en enda skarm.

### 3.2 Konkurrerande primare actions i Library-toolbaren
**Severity: 4/5**

`src/app/(full-width)/page.tsx` rad 123-145: FeatureNavigation, Search, Refresh-knapp och "Visa Taggar"-checkbox har alla identisk visuell tyngd (`border-2 border-black shadow-[4px_4px_0px]`). Ingen hierarki mellan primar handling (sok/uppdatera) och sekunder toggle (taggar).

### 3.3 Dubbla borders i TodoList
**Severity: 3/5**

`TodoList.tsx` rad 189-211: Yttre container med `border-2 border-black` plus inre rubrik med `border-b-2 border-black` skapar dubbla linjer i direkt anslutning. Ger ett "instangt" intryck snarare an tydlig hierarki.

### 3.4 Fargstaplar (3px) ar for svaga for att bilda hierarki
**Severity: 3/5**

Command Center (`page.tsx` rad 68, 116, 128, 146) anvander `h-[3px]` fargade staplar (gron/rosa/bla/amber) for att identifiera paneler. 3px ar knappt synligt och bidrar inte till visuell struktur. Minst 6px eller en vanstersidokant hade gett tydligare avlasning.

### 3.5 Avsaknad av semantic heading-hierarki
**Severity: 2/5**

Rubriknivaaer ar inkonsekventa:
- Library anvander `<p>` for laddnings-/feltillstand (borde vara `<h2>` eller dedikerad komponent)
- Command Center: `<h2>` och `<h3>` har identisk styling (`text-xs uppercase tracking-widest`)
- FamilySchedule: `<div className="font-monument">` istallet for `<h1>`/`<h2>`

---

## 4. Optimistiskt UI (Perceived Speed)

### 4.1 Calendar -- ingen optimistisk update
**Severity: 5/5**

`Calendar.tsx` rad 85-150: Bade `handleEventAdd` och `handleEventUpdate` vantar pa att API-anropet lyckas innan UI uppdateras. En ny handelse ar helt osynlig i kalendern tills servern svarar. For en CRUD-operation som "lagg till handelse" forvanter sig anvandaren omedelbart svar.

### 4.2 FamilySchedule -- refetch efter varje mutation
**Severity: 5/5**

`FamilySchedule.tsx`: Fem stallen gor `await fetchActivities(year, week)` efter en lyckad mutation:

| Rad | Operation | Beteende |
|-----|-----------|----------|
| 269 | Uppdatera medlem | Sparar optimistiskt, sen hamtar alla aktiviteter |
| 296 | Radera medlem | Raderar optimistiskt, sen hamtar alla aktiviteter |
| 390 | Textimport | Importerar, sen hamtar alla aktiviteter |
| 414 | AI-import | Importerar, sen hamtar alla aktiviteter |

Varje refetch innebar en nverksbegaran + rendering av hela veckans data. Lokala state-uppdateringar hade eliminerat vantan.

### 4.3 Artificell 1-sekunds fordrojning vid refresh
**Severity: 4/5**

`src/app/(full-width)/page.tsx` rad 61:
```tsx
await new Promise(resolve => setTimeout(resolve, 1000));
```

Overflodig `setTimeout(1000)` inlagd efter lyckad API-uppdatering. Gor "Uppdatera"-knappen 1 sekund langsammare an nodvandigt utan anledning.

### 4.4 EditNoteModal -- spinner for trivialt sparande
**Severity: 3/5**

`EditNoteModal.tsx` rad 43-64: Visar "Sparar..." och inaktiverar knappen medan API-anropet pagar. For en textanteckning forvanter sig anvandaren att "Spara" stanger modalen direkt.

### 4.5 Pessimistisk member-reorder
**Severity: 3/5**

`FamilySchedule.tsx` rad 332-365: `isSavingMemberOrder` lasstatus visas medan ordningen sparas. Anvandaren har redan dragit korten i ratt ordning -- UI:t borde bekrafta direkt och spara i bakgrunden.

### 4.6 Positiva monster (bra!)

- **TodoList toggle** (`TodoList.tsx` rad 80-87): Optimistisk med rollback -- basta monstret i kodbasen
- **TemplatesModal delete** (`TemplatesModal.tsx` rad 51-61): Optimistisk radering
- **FamilySchedule member save** (rad 262-288): Optimistisk uppdatering (men foljs av onodigt refetch)

---

## 5. Microcopy & Ton

### 5.1 Engelska/svenska blandat i felmeddelanden
**Severity: 5/5**

Service-lagret (`scheduleService.ts`) kastar engelska felmeddelanden ("Failed to fetch activities", "Failed to create activity") medan komponentlagret (NotesBasket, TodoList, Calendar) visar svenska. Anvandaren ser engelska felmeddelanden for schema-relaterade fel och svenska for anteckningar/todos.

| Kalla | Sprak | Exempel |
|-------|-------|---------|
| `scheduleService.ts` rad 56, 70, 80, 90 | Engelska | "Failed to fetch/create/update activity" |
| `page.tsx` (Library) rad 37, 58 | Engelska | "Failed to load data", "Failed to update data" |
| `NotesBasket.tsx` rad 31 | Svenska | "Kunde inte hamta anteckningar." |
| `Calendar.tsx` rad 75 | Svenska | "Kunde inte ladda handelser" |

### 5.2 Login-sidan ar helt pa engelska
**Severity: 4/5**

`src/app/login/page.tsx`:
- "Username", "Password", "Email (Optional)" -- borde vara "Anvndarnamn", "Losenord", "E-post"
- "Create an Account" / "Login to Bibliotek" -- blandar engelska och svenska i samma rubrik

### 5.3 Felmeddelanden saknar handling
**Severity: 4/5**

Alla felmeddelanden beskriver VAD som gick fel men inte VAD ANVANDAREN KAN GORA:

| Nu | Battre |
|----|--------|
| "Failed to fetch activities" | "Kunde inte hamta aktiviteter. Kontrollera din internetanslutning." |
| "Kunde inte spara." | "Kunde inte spara. Forsok igen om en stund." |
| "Kunde inte ta bort medlem." | "Kunde inte ta bort medlemmen. Forsok igen." |

### 5.4 Empty states -- bra i Command Center, saknas annars
**Severity: 3/5**

Command Center har genomtankta tomma lagen ("Inga anteckningar. Prova: note \"Min titel\""). Men:
- Library: `"No data to display."` -- engelskt och generiskt
- Calendar: Inget explicit tomtillstand
- NotesBasket vid sok: `"Inga traffar."` -- ingen hjalp att breddas soket

### 5.5 Laddningsmeddelanden ar inkonsekventa
**Severity: 2/5**

| Komponent | Meddelande | Problem |
|-----------|------------|---------|
| Library | "Loading..." | Engelska |
| Login | "Loading..." | Engelska |
| NotesBasket | "Laddar..." | Svenska, men utan kontext |
| DailySchedulePanel | "Laddar schema..." | Bra -- har kontext |
| TerminalPanel | "..." (bara ellipsis) | Inget laddningsord |

### 5.6 Saknad formvalidering
**Severity: 2/5**

Login-formularet har `required` pa HTML-niva men visar inga inline-felmeddelanden. Inga obligatoriska faltmarkeringar (*). Ingen feedback foreran formularet skickas.

---

## Atgardsplan

### Fas 1 -- Quick Wins (1-2 dagar)

| # | Atgard | Paverkar | Kategorier |
|---|--------|----------|------------|
| 1 | **Ta bort `setTimeout(1000)`** i `page.tsx` rad 61 | Library | 4 |
| 2 | **Byt alla engelska felmeddelanden** i `scheduleService.ts` och `page.tsx` till svenska | Hela appen | 5 |
| 3 | **Oversatt login-sidan** till svenska | Login | 5 |
| 4 | **Oka fargstaplarna** fran `h-[3px]` till `h-[6px]` | Command Center | 3 |
| 5 | **Byt `leading-none` till `leading-tight`** pa taggar och tidvisningar | Schedule, Notes | 2 |

### Fas 2 -- Spacing & Typografi (3-5 dagar)

| # | Atgard | Paverkar | Kategorier |
|---|--------|----------|------------|
| 6 | **Avrunda alla CSS-spacing** i neobrutalism.css till 4pt-gridet (15->16, 25->24, 10->8/12, 5->4) | Familjeschema | 1 |
| 7 | **Definiera en type scale** (t.ex. 12/14/16/20/24/32px) och ersatt alla `.85rem`/`.9rem`/`1.3rem`-varden | Familjeschema | 2 |
| 8 | **Lagg till `text-2xs` (10px)** i Tailwind-configen som ersatter for `text-[9px]`/`text-[10px]` | Schedule, CC | 2 |
| 9 | **Byt ut sub-4pt spacing** (`p-0.5`, `gap-0.5`) till minst `p-1`/`gap-1` | Schedule, CC | 1 |

### Fas 3 -- Visuell Hierarki (3-5 dagar)

| # | Atgard | Paverkar | Kategorier |
|---|--------|----------|------------|
| 10 | **Infora border-tyngd-hierarki** i StandardDashboardLayout: primart `border-2`, sekundart `border` (1px) | Alla sidor | 3 |
| 11 | **Skapa en "secondary" button-style** (tunnare border, ingen shadow) for lagprioriterade actions | Library, CC | 3 |
| 12 | **Ta bort dubbla borders** i TodoList (inre `border-b-2` -> `border-b border-gray-200`) | Command Center | 3 |
| 13 | **Anvand subtila bakgrundfarger** (green-50, pink-50, blue-50) for sektionsidentitet istallet for bara 3px-bars | Command Center | 3 |

### Fas 4 -- Optimistiskt UI (3-5 dagar)

| # | Atgard | Paverkar | Kategorier |
|---|--------|----------|------------|
| 14 | **Gor Calendar-handelser optimistiska:** visa handelsen direkt, rollback vid fel | Calendar | 4 |
| 15 | **Eliminera `fetchActivities` efter member-operationer** i FamilySchedule -- uppdatera lokalt state | Familjeschema | 4 |
| 16 | **Gor EditNoteModal optimistisk:** stang modalen direkt, uppdatera lokalt, spara i bakgrunden | Command Center | 4 |
| 17 | **Gor member-reorder optimistisk:** bekrafta direkt, spara i bakgrunden | Familjeschema | 4 |

### Fas 5 -- Microcopy & Ton (1-2 dagar)

| # | Atgard | Paverkar | Kategorier |
|---|--------|----------|------------|
| 18 | **Skapa `src/constants/messages.ts`** med alla anvandardiktade meddelanden pa svenska | Hela appen | 5 |
| 19 | **Lagg till handlingsforslag** i varje felmeddelande ("Forsok igen" / "Kontrollera din anslutning") | Hela appen | 5 |
| 20 | **Lagg till tomma lagen** for Calendar och Library med kontextuella forklaringar | Calendar, Library | 5 |
| 21 | **Standardisera laddningsmeddelanden** med kontext ("Laddar anteckningar...", "Laddar kalender...") | Hela appen | 5 |
