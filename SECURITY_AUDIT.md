# Security Audit Report
**Datum:** 2026-03-06
**Projekt:** drive_c_frontend (Next.js 14.2)

## Projektöversikt

### Tech Stack
- **Framework:** Next.js 14.2.35 (App Router), React 18, TypeScript
- **Styling:** Tailwind CSS, Radix UI
- **Pakethanterare:** pnpm 9.12.3
- **Deploy:** Vercel (frontend), PythonAnywhere (backend)

### Arkitektur
Klient-renderad SPA ("use client" på alla sidor) som kommunicerar med ett Flask REST-API via `fetchWithAuth()`. Ingen Next.js middleware. Inga Next.js API-routes (all serverlogik finns i backend-repot).

### Entry Points (Frontend → Backend)
| Service-fil | API-prefix | Beskrivning |
|---|---|---|
| `authService.ts` | `/api/auth` | Login, register, profil |
| `calendarService.ts` | `/api/events`, `/api/notes` | CRUD kalender |
| `scheduleService.ts` | `/api/schedule` | Familjeschema, AI-parse |
| `plannerService.ts` | `/api/planner` | Kursplanerare, arkiv |
| `commandCenterService.ts` | `/api/command-center` | Notes, todos, templates |

### Dataflöden
1. **Autentisering:** Användare loggar in → JWT-token lagras i `localStorage` → token skickas som `Authorization: Bearer` header på alla API-anrop
2. **Skyddade routes:** Klient-side `<ProtectedRoute>` wrapper kontrollerar `isAuthenticated` (existens av token i state/localStorage), redirectar till `/login`
3. **Användardata:** Hämtas via REST API, renderas i React-komponenter. Viss data (settings, todos, templates) cacheas i localStorage

---

## Fynd

### 1. Injektion & Indatavalidering

#### [LOW] — Ingen dangerouslySetInnerHTML eller innerHTML-injektion
- **Beskrivning:** Kodbasen använder varken `dangerouslySetInnerHTML` eller `innerHTML`. All rendering sker via React JSX som automatiskt escapar output. Inget XSS-problem via DOM-injektion identifierat.
- **Status:** Confirmed (positivt fynd)

#### [MEDIUM] — PDF-export skriver osaniterad titel till iframe-dokument
- **Fil:** `src/utils/vectorPdfExport.ts:91-92`
- **Beskrivning:** Variabeln `title` interpoleras direkt i en HTML-sträng som skrivs via `doc.write()`: `` <title>${title}</title> ``. Om `title` innehåller HTML-tecken kan detta leda till injektion i iframe-dokumentet. Dock är iframe:n dold, same-origin, och `title` kommer från utvecklarkod (inte direkt från användarinput), vilket begränsar risken.
- **Attack-scenario:** Om en funktion i framtiden skickar user-controllerad data som `title`, kan HTML injiceras i iframe-dokumentet.
- **Status:** Needs Review

#### [LOW] — JSON.parse utan strikt typvalidering vid import
- **Fil:** `src/components/familjeschema/FamilySchedule.tsx:367`, `src/components/schedule/NewSchedulePlanner.tsx:525`
- **Beskrivning:** Användare kan importera JSON-filer. `JSON.parse()` anropas på user-supplied text. Grundläggande validering finns (kontroll av array/objektstruktur), men ingen djup schema-validering. Data skickas sedan vidare till backend-API.
- **Attack-scenario:** Malformad JSON-data som passerar grundkontroll men innehåller oväntade fält kan skickas till backend. Backend-validering är avgörande.
- **Status:** Needs Review

---

### 2. Autentisering & Sessionshantering

#### [HIGH] — JWT-token lagras i localStorage (sårbar för XSS)
- **Fil:** `src/contexts/AuthContext.tsx:80`, `src/services/authService.ts:9`
- **Beskrivning:** JWT-token lagras i `localStorage.setItem('authToken', ...)`. Om en XSS-sårbarhet skulle uppstå (via tredjepartsberoende, extension, eller framtida kodändring) kan en angripare extrahera token med `localStorage.getItem('authToken')` och använda det obegränsat.
- **Attack-scenario:** Angripare hittar XSS-vektor (t.ex. via sårbart npm-paket) → exfiltrerar JWT-token → full åtkomst till användarens konto.
- **Status:** Confirmed

#### [HIGH] — Ingen token-refresh eller expiry-hantering på klienten
- **Fil:** `src/contexts/AuthContext.tsx:45-55`, `src/services/authService.ts:42-51`
- **Beskrivning:** Vid mount kontrolleras bara om token *finns* i localStorage — inte om det har gått ut. Det finns ingen refresh-token-mekanism. Om token aldrig expirerar på backend-sidan, kan ett stulet token användas på obestämd tid. Den enda expiry-hanteringen är att 401-svar triggar redirect till login.
- **Attack-scenario:** Stulet token (via XSS, delad dator, nätverksintrång) förblir giltigt tills backend-expiry nås (om det finns) eller tills användaren manuellt "loggar ut" (vilket bara rensar localStorage, inte invaliderar token server-side).
- **Status:** Confirmed

#### [MEDIUM] — Logout invaliderar inte token server-side
- **Fil:** `src/contexts/AuthContext.tsx:126-134`, `src/services/authService.ts:96-99`
- **Beskrivning:** `logout()` rensar bara `localStorage`. Inget API-anrop görs till backend för att blacklista/invalidera JWT-token. Token förblir tekniskt giltigt tills det löper ut.
- **Attack-scenario:** Om token har kopierats/stulits före logout, kan angriparen fortsätta använda det efter att användaren "loggat ut".
- **Status:** Confirmed

#### [LOW] — Ingen lösenordsstyrka-validering vid registrering
- **Fil:** `src/app/login/page.tsx:27-35`, `src/contexts/AuthContext.tsx:92`
- **Beskrivning:** Registreringsformuläret kräver bara att lösenordsfältet inte är tomt (`required`). Ingen klient-side validering av lösenordslängd eller komplexitet. Backend-validering är okänd från denna audit.
- **Attack-scenario:** Användare kan skapa konton med extremt svaga lösenord ("1", "a").
- **Status:** Confirmed

---

### 3. Trasig Åtkomstkontroll (Broken Access Control)

#### [MEDIUM] — Klient-side route-skydd utan Next.js middleware
- **Fil:** `src/components/ProtectedRoute.tsx:12-35`
- **Beskrivning:** Skyddade routes wrappas med `<ProtectedRoute>`, en klient-side komponent som kontrollerar `isAuthenticated` (baserat på tokenexistens i state). Det finns ingen Next.js middleware (`middleware.ts` saknas helt). HTML/JS för skyddade sidor levereras till alla besökare — React-koden kontrollerar bara om innehållet renderas.
- **Attack-scenario:** En angripare kan se all applikationslogik, komponentstruktur, och API-endpoints i den nedladdade JS-bundlen, även utan att vara inloggad. Själva data skyddas av backend-auth, men applikationsstruktur och API-schema exponeras.
- **Status:** Confirmed

#### [MEDIUM] — Potentiella IDOR-risker i service-anrop
- **Fil:** `src/services/calendarService.ts:124`, `src/services/commandCenterService.ts:98`, `src/services/scheduleService.ts:76`
- **Beskrivning:** Alla CRUD-operationer skickar objekt-ID direkt i URL:en (t.ex. `/events/${id}`, `/notes/${id}`). Klienten gör ingen ägarskapsverifiering — detta måste ske på backend. Om backend inte verifierar att resursen tillhör den autentiserade användaren, kan en användare manipulera/ta bort andras data genom att byta ID.
- **Attack-scenario:** Autentiserad användare ändrar event-ID i request → hämtar/ändrar/tar bort annan användares data.
- **Status:** Needs Review (kräver backend-audit för att bekräfta)

---

### 4. Känslig Data & Hårdkodade Hemligheter

#### [MEDIUM] — Fallback API-URL hårdkodad i källkod
- **Fil:** `src/services/authService.ts:4`, `src/services/calendarService.ts:34`, `src/contexts/AuthContext.tsx:30`, `src/services/scheduleService.ts:8`, `src/services/plannerService.ts:4`, `src/services/commandCenterService.ts:10`, `src/app/(full-width)/page.tsx:22`
- **Beskrivning:** Produktions-API-URL (`https://tobiaslundh1.pythonanywhere.com/api`) är hårdkodad som fallback i 7+ filer. Exponerar backend-host direkt i klient-side JavaScript-bundle.
- **Attack-scenario:** Angripare ser produktions-API-URL i bundlen och kan direkt rikta attacker (brute force, enumeration) mot backend-API:t.
- **Status:** Confirmed

#### [MEDIUM] — Gemini-URL med specifik gem-ID hårdkodad
- **Fil:** `src/components/familjeschema/components/Sidebar.tsx:96`
- **Beskrivning:** URL `https://gemini.google.com/u/1/gem/52527d352450` är hårdkodad. Exponerar ett specifikt Gemini-gem som kan innehålla känslig konfiguration.
- **Attack-scenario:** Vem som helst kan komma åt detta Gemini gem via URL:en i den publika JS-bundlen.
- **Status:** Needs Review

#### [HIGH] — Omfattande console.log i produktionskod
- **Fil:** `src/services/calendarService.ts:54,64,83,96,123,136,146,157,167,177,188,201` (12 st), `src/components/calendar/DayModal.tsx:39,41,70,72,95,108` (6 st), `src/components/calendar/Calendar.tsx:279,281` m.fl.
- **Beskrivning:** Över 80 `console.log`/`console.error`-anrop i produktionskoden. Många loggar fullständiga API-responses inklusive eventdata, notes-innehåll och objekt-IDs. Exempel: `console.log('Retrieved ${data.data?.length || 0} events:', data.data)` — loggar alla användarens kalenderevent till browserkonsolen.
- **Attack-scenario:** En angripare (eller malware/extension) med tillgång till browserkonsolen ser detaljerad info om API-anrop, datastrukturer, och användardata. Underlättar reverse engineering och informationsläckage.
- **Status:** Confirmed

#### [LOW] — User-objekt lagras i localStorage
- **Fil:** `src/contexts/AuthContext.tsx:81`
- **Beskrivning:** Fullständigt user-objekt (`id`, `username`, `email`, `createdAt`, `lastLogin`) serialiseras och lagras i localStorage som `user`. Persistent och synlig för alla scripts på samma origin.
- **Attack-scenario:** XSS-vektor → exfiltrering av persondata (PII).
- **Status:** Confirmed

---

### 5. Säkerhetskonfiguration & Headers

#### [HIGH] — Inga säkerhetsheaders konfigurerade
- **Fil:** `next.config.mjs:1-15`
- **Beskrivning:** `next.config.mjs` konfigurerar bara cache-headers för twemoji. Följande säkerhetsheaders saknas helt:
  - **Content-Security-Policy** — ingen CSP, ger fritt spelrum för injicerade scripts
  - **X-Frame-Options** — sidan kan inkluderas i iframes (clickjacking)
  - **Strict-Transport-Security** — ingen HSTS-header
  - **X-Content-Type-Options** — saknas
  - **Referrer-Policy** — saknas
  - **Permissions-Policy** — saknas
- **Attack-scenario:** Utan CSP kan en XSS-sårbarhet ladda och köra godtyckliga externa scripts. Utan X-Frame-Options kan sidan inbäddas i en angriparsida för clickjacking.
- **Status:** Confirmed

#### [LOW] — Ingen explicit felhantering för stacktraces mot klienten
- **Beskrivning:** Next.js hanterar detta automatiskt i produktionsbyggen (stacktraces exponeras inte). I dev-mode visas de dock, vilket är standard och acceptabelt.
- **Status:** Confirmed (ej ett problem i produktion)

---

### 6. Beroenden & Supply Chain

#### [CRITICAL] — jspdf 2.5.2 har 7 kända sårbarheter (1 critical, 6 high)
- **Fil:** `package.json:34`
- **Beskrivning:** `jspdf@2.5.2` har följande kända sårbarheter:
  - **CRITICAL:** Local File Inclusion/Path Traversal (GHSA-f8cm-6447-x5h2, fix: >=4.0.0)
  - **HIGH:** PDF Injection → Arbitrary JS Execution (GHSA-pqxr-3g65-p328, fix: >=4.1.0)
  - **HIGH:** PDF Injection via RadioButton (GHSA-p5xg-68wr-hm3m, fix: >=4.2.0)
  - **HIGH:** PDF Object Injection via addJS (GHSA-9vjf-qc39-jprp, fix: >=4.2.0)
  - **HIGH:** ReDoS (GHSA-w532-jxjh-hjhj, fix: >=3.0.1)
  - **HIGH:** DoS (GHSA-8mvj-3j78-4qmw, fix: >=3.0.2)
  - **HIGH:** DoS via Malicious BMP/GIF Dimensions (GHSA-95fx-jjr5-f39c, fix: >=4.1.0)
  - Beroende `canvg@3.0.10` har också **HIGH** Prototype Pollution (GHSA-v2mw-5mch-w8c5, fix: >=3.0.11)
- **Attack-scenario:** Om jspdf bearbetar user-controllerad data kan angripare uppnå path traversal, JavaScript-exekvering i genererade PDF:er, eller DoS.
- **Status:** Confirmed

#### [HIGH] — Next.js 14.2.35 har känd sårbarhet
- **Fil:** `package.json:36`
- **Beskrivning:** `next@14.2.35` har: HTTP request deserialization DoS via insecure React Server Components (GHSA-h25m-26qc-wcjf, fix: >=15.0.8).
- **Attack-scenario:** Specialkonstruerade HTTP-requests till Next.js-servern kan orsaka DoS.
- **Status:** Confirmed

#### [MEDIUM] — 37 totala sårbarheter i beroendeträdet
- **Beskrivning:** `pnpm audit` rapporterar: 1 critical, 22 high, 12 moderate, 2 low. Utöver ovanstående inkluderar detta: `braces` (ReDoS), `cross-spawn` (ReDoS), `glob` (command injection via CLI), `brace-expansion` (ReDoS). Dessa är främst transitive beroenden via `tailwindcss-animate`, `eslint`, och `eslint-config-next`.
- **Status:** Confirmed

---

## Sammanfattning

| Severity | Antal |
|----------|-------|
| Critical | 1     |
| High     | 4     |
| Medium   | 6     |
| Low      | 5     |

---

## Atgardsplan (Remediation)

### Prioritet 1 — Critical & High (atgarda omedelbart)

1. **Uppgradera jspdf till >=4.2.0** — Eliminerar 7 CVE:er. Kontrollera breaking changes i major version (2.x → 4.x). Om inte möjligt, överväg alternativ som `pdf-lib`.
   - Fil: `package.json:34`
   - Insats: Medium

2. **Lagg till sakerhetsheaders i next.config.mjs** — Lagg till Content-Security-Policy, X-Frame-Options, Strict-Transport-Security, X-Content-Type-Options, Referrer-Policy och Permissions-Policy.
   ```js
   // Exempel for next.config.mjs headers()
   {
     source: '/(.*)',
     headers: [
       { key: 'X-Frame-Options', value: 'DENY' },
       { key: 'X-Content-Type-Options', value: 'nosniff' },
       { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
       { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
       { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
       { key: 'Content-Security-Policy', value: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https://tobiaslundh1.pythonanywhere.com" },
     ]
   }
   ```
   - Fil: `next.config.mjs`
   - Insats: Lag

3. **Migrera JWT-lagring fran localStorage till httpOnly cookies** — Eliminerar risken att XSS kan stjala token. Kraver andringar i bade frontend och backend. Frontend slutar lasa/skriva token i localStorage; backend satter httpOnly-cookie vid login.
   - Filer: `src/contexts/AuthContext.tsx`, `src/services/authService.ts`, backend auth routes
   - Insats: Hog (kraver backend-andringar)

4. **Implementera token-refresh och server-side invalidering** — Lagg till refresh-token-rotation och logout-endpoint som invaliderar token pa backend.
   - Filer: `src/contexts/AuthContext.tsx`, `src/services/authService.ts`
   - Insats: Hog

5. **Ta bort console.log fran produktionskod** — Anvand en logger med nivakontroll, eller konfigurera en Babel/SWC-plugin som strippar console.log i production builds. Prioritera `calendarService.ts` och `DayModal.tsx` som loggar user data.
   - Filer: 15+ filer
   - Insats: Lag-Medium

### Prioritet 2 — Medium (atgarda inom kort)

6. **Uppgradera Next.js till 15.x** — Fixar DoS-sarbarheten och losser flera transitive beroendevarningar.
   - Insats: Hog (breaking changes i major version)

7. **Lagg till Next.js middleware for route-skydd** — Skapa `middleware.ts` som kontrollerar auth-cookie/token server-side och blockerar obehörig atkomst innan sidan renderas.
   - Insats: Medium

8. **Centralisera API-URL** — Flytta fallback-URL till en enda konfig-fil istallet for att ha den hardkodad i 7+ filer.
   - Insats: Lag

9. **Verifiera IDOR-skydd i backend** — Granska att alla API-endpoints verifierar att resursen tillhör den autentiserade användaren (kräver backend-audit).
   - Insats: Medium

10. **Granska Gemini gem-URL** — Avgör om gem-ID:t ger publik åtkomst till känslig data och flytta eventuellt till env-variabel.
    - Insats: Lag

### Prioritet 3 — Low (backlog)

11. **Lagg till losenordskrav i registreringsformularet** — Minst 8 tecken, verifiering pa bade klient och server.
12. **Uppdatera transitive beroenden** — `braces`, `cross-spawn`, `glob`, `brace-expansion` via overrides/patchedDependencies i pnpm.
13. **Sanitera title i vectorPdfExport.ts** — Escapa HTML-tecken i `title` innan den interpoleras i `doc.write()`.
14. **Rensa user-objekt i localStorage** — Lagra bara nödvändiga fält (username), inte fullständigt objekt med email/timestamps.
