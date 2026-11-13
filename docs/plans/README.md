# Planer

En plan skrivs före en större ändring. **Den session som gör arbetet
uppdaterar planen i samma PR som koden**: bockar av steget, skriver in
avvikelser från planen i planen (inte bara i PR:en) och uppdaterar raden
här.

Raden `Status:` överst i en plan har en av formerna

- `Status: Planerad`
- `Status: Pågår` (i en plan med flera steg; stegen bockas av i planen)
- `Status: Genomförd 2026-11-09 (#261)`

Skriv aldrig om PR:en är sammanslagen eller inte. Det blir fel i samma stund
som den slås ihop, och ingen session finns kvar som rättar det. PR-numret
räcker: den som undrar ser läget på GitHub.

| Plan | Status |
|---|---|
| [Arkitektur: refaktoreringssteg efter granskningen 2026-11-09](arkitektur-2026-11.md) | Pågår. Steg 1 (#264, backend #58) och steg 2 (#266, backend #59) genomförda 2026-11-10 |
| [Sparade upplägg i Arbetslag](arbetslag-upplagg.md) | Genomförd 2026-09-30 (backend #27) |
| [Basscheman och veckoscheman](basscheman.md) | Genomförd 2026-10-09 (#212, backend #31) |
| [Färre knappar och tydligare menyer i schemaplaneraren](schema-knappar-och-menyer.md) | Genomförd 2026-10-09 (#211) |
| [Temat Kronberg](kronberg-tema.md) | Steg 0–8 genomförda 2026-10-09 (#211, #214). Fråga 4 i avsnitt 9 är öppen |
| [Schemadagar i workspace pekar på schemats id](schemadagar-pa-id.md) | Genomförd 2026-10-13 (#221) |
| [Workspace-editorerna utan hårdkodade färger](workspace-editorer-tokens.md) | Genomförd 2026-10-14 (#222) |
| [Export av scheman från Arbetslag](arbetslag-export.md) | Genomförd 2026-10-21 |
| [Mappar för veckoscheman](schemamappar.md) | Genomförd 2026-10-21 (#240, backend #48) |
| [Mindmap med kortkommandon och export till Google Docs](mindmap-tangentbord.md) | Genomförd 2026-11-05 (#258) |
| [Namn på lektionspass i Närvarorutor](narvaro-passnamn.md) | Genomförd 2026-11-09 (#259). Tillägg 2026-11-10 (#263) |
| [Mobilläge i Närvarorutor](narvaro-mobillage.md) | Genomförd 2026-11-09 (#261) |
| [Mindmap-sida: en MindMup-kopia med sparade kartor](mindmap-sida.md) | Pågår. Alla steg 0–8 byggda 2026-11-11 (#267–#273, backend #60). Kvar för målet är prov, inte kod: deploy bekräftad, regressionslistan och Tobias egna prov. Se "Läget" överst i planen |
| [Mindmap steg 8: visa bara grenen och presentationsläge](mindmap-presentation.md) | Genomförd 2026-11-11 (#273) |
| [Mindmap: text på flera rader i en nod](mindmap-radbrytning.md) | Pågår. Del A (radbrytning) och del B (bredd per nod) byggda 2026-11-12. Kvar: proven i avsnitt 6 |
| [Mindmap: egna färger och nyanser nedåt i grenen](mindmap-farger.md) | Pågår. Del A (modell och ritning) och B (färgmenyn) byggda 2026-11-12 (#278). Kvar: C `.mup`-importen |
| [Mindmap: friare placering och linjer att forma](mindmap-placering.md) | Pågår. Del A (linjernas form och fäste per karta) och B (Alt+dra, flytta roten, städa upp, rutnät) byggda 2026-11-12 (#280). Del C (form och fästen per linje och för tvärlänkarna) och D (brytpunkter) byggda 2026-11-12 (#281). Kvar: prov i riktig miljö och workspace-kortet i webbläsaren |
| [Mindmap: markera flera, riktning för nya barn och arrangera](mindmap-arrangera.md) | Pågår. Del A (markera flera, #283) och B (riktning för nya barn) byggda 2026-11-13. Kvar: C städa upp, D arrangera |

Lägg till en rad här när en ny plan skrivs.

## Granskningar

| Vad | Var |
|---|---|
| Arkitektur 2026-11-09 (senaste) | [`docs/architecture-review-2026-11-09.md`](../architecture-review-2026-11-09.md) |
| Arkitektur 2026-10-15 | [`docs/arkiv/architecture-review-2026-10-15.md`](../arkiv/architecture-review-2026-10-15.md) |
| Dataintegritet 2026-10-15 | [`docs/arkiv/data-integrity-review-2026-10-15.md`](../arkiv/data-integrity-review-2026-10-15.md) |
| Säkerhet 2026-10-15 | bara på grenen `ccr-209c4b90-pqnlee` i backend-repot (privat) |
| Design och säkerhet, mars 2026 | [`docs/arkiv/`](../arkiv/). Mycket av koden de beskriver finns inte längre |

Rapporterna är ögonblicksbilder och ändras inte. **Aktuell status per fynd**
står i backend-repots `docs/granskning-status.md`.
