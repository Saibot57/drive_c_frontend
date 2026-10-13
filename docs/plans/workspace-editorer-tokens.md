# Plan: Workspace-editorerna utan hårdkodade färger

Status: plan, skriven 2026-10-13. Inte påbörjad. Bara frontend.

Filhuvudet i `workspace.css` säger: "allt utseende bor här, inga inline-styles i
tsx". De nyare korten följer det (`ScheduleDayView`, `WheelRefViewer`,
`HeadingEditor`, `StickyEditor`). Sju äldre editorer gör det inte. De ritar med
`style={{ … }}` och Tailwinds grå hex-värden, och därför följer de inte med
när temat byts. I Kronberg får man kallgrå `#f9fafb` och `#e5e7eb` mot det
varma pappret (`--ui-surface-2`, `--ui-hair`).

Inventering (räknat 2026-10-13, `components/editors/`):

| Fil | Rader | `style={` | Hex |
|---|---|---|---|
| LinkEditor | 351 | 23 | 19 |
| PdfViewer | 473 | 16 | 17 |
| ImageViewer | 292 | 12 | 14 |
| KanbanEditor | 277 | 11 | 9 |
| TableEditor | 248 | 12 | 6 |
| ListEditor | 173 | 9 | 6 |
| MindmapEditor | 232 | 9 | 5 |
| TextEditor | 170 | 4 | 4 |

Riktlinjer:

- **Neo ska se likadant ut efteråt.** Varje hex-värde har redan en token med
  samma värde i Neo (tabellen i avsnitt 1). Det är en flytt, inte en
  omdesign.
- **Kronberg ska bli rätt utan egna regler per editor.** Om en editor behöver
  en Kronberg-regel är det ett tecken på att en token saknas.
- **Inline bara för det som räknas fram eller är användarens data.** Lägen,
  storlekar, zoom, användarvalda färger. Allt annat flyttas till klasser.

## 1. Färg till token

Alla värden finns redan i `.ws-root`, och Kronberg skriver om dem (rad ~1975
i `workspace.css`):

| Hex (Neo) | Används som | Token |
|---|---|---|
| `#111827` | rubrik, aktiv text | `--ws-text` |
| `#374151`, `#4b5563` | brödtext | `--ws-text-muted` |
| `#6b7280` | sekundär text, ikoner | `--ws-text-subtle` |
| `#9ca3af` | platshållare, avbockat | `--ws-text-faint` |
| `#d1d5db` (text/ikon) | avstängt, tyst ikon | `--ws-text-disabled` |
| `#e5e7eb` (ram) | kort, kolumn, avdelare | `--ws-border-color` |
| `#f3f4f6` | hover, aktiv knapp | `--ws-bg-hover` |
| `#f9fafb` | kolumn, tabellhuvud, fält | `--ws-bg-muted` |
| `#ffffff` | kortyta | `--ws-bg` |
| `#b91c1c` | felmeddelande | `--ws-danger` |

`#4b5563` och `#374151` slås ihop till `--ws-text-muted`. Skillnaden syns inte
i Neo, och Kronberg har bara en nivå där.

Tre luckor behöver en ny token eller ett beslut:

- **`#d1d5db` som ram på fält** (Link, Pdf, Image, Mindmap). Det är en något
  mörkare ram än `--ws-border-color`, för inmatningsfält. Ny token
  `--ws-input-border: #d1d5db`, i Kronberg `var(--ui-line)` eller
  `var(--ui-hair)` — välj vid provet. Använd den inte för text.
- **`--ws-text-disabled` saknas i Kronberg-blocket.** Den faller tillbaka på
  Neos `#d1d5db`. Lägg till den (förslag: `var(--ui-subtle)` med lägre
  opacitet, eller en hårlinjeton) innan editorerna börjar läsa den.
- **Mindmapens rotnod `#f0f9ff`** (ljusblå) och **listans kryssruta
  `accentColor: '#3b82f6'`** är de enda färgade accenterna. Systemet har
  avsiktligt en accent (kommentaren vid rad ~415). Förslag: rotnoden får
  `--ws-accent-bg`, kryssrutan `accent-color: var(--ws-accent)`. Det ändrar
  Neo en aning (rotnoden går från `#f0f9ff` till `#dbeafe`, kryssrutan blir
  svart). Det ska stämmas av, inte bara göras.

## 2. Det som stannar inline

- **Användarens färger.** `StickyEditor`s färgpalett och tabellens
  `cellColors` är data som sparas i elementet. De rörs inte.
- **Tabellens `borderColor`.** Standardvärdet `'#e5e7eb'` skrivs in i varje ny
  tabell (`DEFAULT_CONTENT` i TableEditor, `getDefaultContent` i
  `useWorkspaceData.ts`), och inget gränssnitt ändrar det idag. Sparat värde
  går inte att ändra i efterhand. Lösning: tolka `'#e5e7eb'` eller saknat
  värde som "följ temat" och rita `var(--ws-border-color)`. Alla andra värden
  ritas som de är. Nya tabeller skrivs utan `borderColor`.
- **Uträknade mått.** Pdf-sidans storlek, bildens bildförhållande, mindmapens
  indrag per djup. Det kan bli en CSS-variabel inline
  (`style={{ '--depth': n }}`) om det gör klassen enklare, men det behövs inte.

## 3. Klasser

BEM som resten av filen, ett block per editor:
`.ws-kanban`, `.ws-kanban__column`, `.ws-kanban__card`,
`.ws-kanban__card--dragging` osv. Tillstånd som idag är ternärer i `style`
blir modifierare:

- `ListEditor` avbockad → `.ws-list__text--done`
- `TextEditor` verktygsknapp aktiv → `.ws-text-toolbar__btn--active`
- `MindmapEditor` rotnod → `.ws-mindmap__node--root`
- `PdfViewer`/`LinkEditor` avstängd knapp → `:disabled`, ingen klass

`TextEditor` sätter stil på Tiptap-ytan som en sträng i `editorProps.attributes`.
Byt till `class: 'ws-text-editor__content'`.

`ImageViewer`, `PdfViewer` och `LinkEditor` har nästan identiska "ange
källa"-formulär (ram, fält, knapp, fel). Gör dem till en gemensam uppsättning,
`.ws-source-form`, `__input`, `__button`, `__error`, i stället för tre
kopior. Det är den största vinsten utöver temat.

Lägg de nya blocken i en egen sektion i `workspace.css`, "Editorer", i samma
ordning som filerna ovan.

## 4. Ordning

En editor per commit, minst först. Varje commit ska gå att granska som "samma
utseende i Neo":

1. `--ws-input-border` och `--ws-text-disabled` i Kronberg (bara CSS).
2. TextEditor
3. MindmapEditor (+ beslutet om rotnoden)
4. ListEditor (+ beslutet om kryssrutan)
5. TableEditor (+ `borderColor` som följer temat)
6. KanbanEditor
7. `.ws-source-form`, sedan ImageViewer, PdfViewer, LinkEditor

Går att dela i två PR:er efter steg 6 om det blir stort.

## 5. Prov

- Före varje commit: skärmdump av editorn i Neo, före och efter. Ska vara
  identiska utom för de avstämda ändringarna i avsnitt 1.
- Efter alla: varje editor i Kronberg, ljust, bredvid ett `ScheduleDayView`
  och en lapp. Ingen kall grå ska synas.
- `grep -nE "#[0-9a-fA-F]{6}" components/editors/*.tsx` ska bara ge
  `StickyEditor`s palett, tabellens standardvärde (för att känna igen gamla
  tabeller) och `WheelPartViewer`s statusfärger.
- Exporten (`useWorkspaceExport`) tvingar Neo i klonen. Exportera en yta med
  alla editorer och kontrollera att resultatet inte ändrats.
- Lint, typkontroll, enhetstester och bygget ska gå igenom.

## 6. Utanför planen

- `WheelPartViewer`s statusfärger (`drifted`/`missing`) och skuggstreck. De är
  få och sitter i SVG-attribut. Kan bli `--ws-warning` och `--ws-danger` i en
  senare runda.
- Mått och typografi (padding, font-size) som också ligger inline. De flyttar
  med till klasserna eftersom de sitter i samma `style`-objekt, men planen
  ändrar inga värden.
