# Instruktion för att fixa dubbla containers i Familjeschemat

## Bakgrund
Användaren har identifierat ett problem i familjeschemat där det finns **två synliga containers med borders** som renderas ovanpå varandra. En av dessa containers är tänkt för print-funktionen och ska inte synas i normal vy.

## Vad som har gjorts hittills
En tidigare Claude Code-instans fixade så att båda containers nu har fyrkantiga hörn (square corners) istället för rundade hörn genom att lägga till `border-radius: 0 !important;` på flera CSS-klasser:
- `.schedule-container`
- `.schedule-view-container`
- `.layer-view-container`
- `.schedule-grid`

## Problemet
Det finns fortfarande två synliga containers med borders:

### Container 1: Yttre containern (för print)
**Fil:** `src/components/familjeschema/FamilySchedule.tsx` rad 646-649
```tsx
<div
  className={`schedule-view-container printable-schedule-scope ${printSheetClass}`}
  ref={scheduleRef}
>
```
Denna container har klasserna:
- `schedule-view-container` - CSS i `neobrutalism.css` rad 2095-2102
- `printable-schedule-scope` - CSS i `print.css`
- `print-sheet-a4` eller `print-sheet-a3` (dynamisk)

### Container 2: Inre containern (för faktisk visning)
**För Grid View:** `src/components/familjeschema/components/ScheduleGrid.tsx` rad 73
```tsx
<main className="schedule-container" role="main" aria-label="Veckans schema">
```

**För Layer View:** `src/components/familjeschema/components/LayerView.tsx` rad 72
```tsx
<main className="layer-view-container" role="main" aria-label="Schema per familjemedlem">
```

## Vad användaren önskar
1. **Den yttre containern** (`schedule-view-container` med `printable-schedule-scope`) ska **INTE synas** i normal vy (endast användas för print-funktionen)
2. **Den inre containern** (`schedule-container` eller `layer-view-container`) ska synas med:
   - Fyrkantiga hörn (square corners) ✅ (redan fixat)
   - Tjocka borders (3px solid black)
   - Skuggor (box-shadow)
   - Övrig neobrutalism-styling

## Förslag på lösning
Det finns två huvudsakliga alternativ:

### Alternativ 1: Ta bort styling från yttre containern i normal vy
Uppdatera CSS för `.schedule-view-container` i `neobrutalism.css` rad 2095-2102 så att den INTE har någon synlig styling (ingen border, ingen box-shadow) i normal vy. Den ska bara vara en wrapper för print-funktionen.

```css
.schedule-view-container {
  flex: 1;
  overflow: auto;
  background: transparent; /* eller ta bort helt */
  border: none; /* ta bort border */
  box-shadow: none; /* ta bort skugga */
  border-radius: 0;
}
```

### Alternativ 2: Använd print media query
Lägg till styling för `.schedule-view-container` endast i print-läge via `print.css` och ta bort all styling från `neobrutalism.css`.

## Viktigt att behålla
- `scheduleRef` på den yttre containern behövs för print-funktionalitet (se `handleSystemPrint` i FamilySchedule.tsx rad 468-600)
- Tjocka borders (3px solid)
- Fyrkantiga hörn (border-radius: 0)
- Box-shadows för neobrutalism-effekt
- All print-funktionalitet måste fortsätta fungera

## Testning
Efter ändringen ska:
1. Endast EN container med tjock border synas i normal vy
2. Print-funktionen ska fortfarande fungera korrekt
3. Både grid view och layer view ska se rätt ut
4. Neobrutalism-styling ska vara intakt

## Relaterade filer
- `src/components/familjeschema/FamilySchedule.tsx`
- `src/components/familjeschema/components/ScheduleGrid.tsx`
- `src/components/familjeschema/components/LayerView.tsx`
- `src/components/familjeschema/styles/neobrutalism.css`
- `src/components/familjeschema/styles/print.css`

## Commit-meddelande suggestion
```
Remove visible styling from print container in family schedule

The schedule-view-container wrapper is now invisible in normal view
and only provides structure for the print functionality. All visible
styling (border, box-shadow, background) has been removed to prevent
double containers from appearing.

The inner containers (schedule-container and layer-view-container)
now provide all the visible neobrutalism styling with thick borders
and square corners.
```
