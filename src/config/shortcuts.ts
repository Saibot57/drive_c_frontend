export type ShortcutDef = {
  keys: string[];
  description: string;
};

export type ShortcutGroup = {
  label: string;
  shortcuts: ShortcutDef[];
};

export const SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    label: 'Global',
    shortcuts: [
      // Ordningen härleds ur `features`-arrayen i FeatureNavigation.tsx.
      // Ändras den måste den här listan följa med.
      { keys: ['Ctrl', 'Shift', '1'], description: 'Bibliotek' },
      { keys: ['Ctrl', 'Shift', '2'], description: 'Schema' },
      { keys: ['Ctrl', 'Shift', '3'], description: 'Temakalender' },
      // 4 är Familjeschema, som är avaktiverat. Platsen står kvar i
      // `features`-arrayen så att 5 och 6 inte numreras om, men genvägen
      // registreras inte och listas därför inte här.
      { keys: ['Ctrl', 'Shift', '5'], description: 'Kalender' },
      { keys: ['Ctrl', 'Shift', '6'], description: 'Workspace' },
      { keys: ['?'], description: 'Visa genvägar' },
      { keys: ['Ctrl', 'Z'], description: 'Ångra' },
    ],
  },
  {
    label: 'Schema — Navigering',
    shortcuts: [
      { keys: ['Tab'], description: 'Växla zon (Kurser → Grid → Arkiv)' },
      { keys: ['↓', 'j'], description: 'Nästa objekt' },
      { keys: ['↑', 'k'], description: 'Föregående objekt' },
      { keys: ['→', 'l'], description: 'Nästa dag (i grid)' },
      { keys: ['←', 'h'], description: 'Föregående dag (i grid)' },
    ],
  },
  {
    label: 'Schema — Åtgärder',
    shortcuts: [
      { keys: ['Enter'], description: 'Redigera / Placera kurs' },
      { keys: ['e'], description: 'Redigera vald post' },
      { keys: ['n'], description: 'Ny byggsten' },
      { keys: ['Delete'], description: 'Ta bort' },
      { keys: ['d'], description: 'Duplicera parallellt' },
      { keys: ['Shift', 'D'], description: 'Duplicera och placera' },
      { keys: ['c'], description: 'Kopiera innehåll' },
      { keys: ['v'], description: 'Klistra in innehåll' },
      { keys: ['Shift', 'C'], description: 'Kopiera anteckningar' },
      { keys: ['Shift', 'V'], description: 'Klistra in anteckningar' },
      { keys: ['Shift', 'A'], description: 'Kopiera anteckningar och markera' },
      { keys: ['m'], description: 'Öppna kontextmeny' },
      { keys: ['Escape'], description: 'Avmarkera / Avbryt' },
    ],
  },
  {
    label: 'Schema — Markera anteckningar',
    shortcuts: [
      { keys: ['←', '→'], description: 'En spalt / dag i sidled' },
      { keys: ['↑', '↓'], description: 'En lektion i höjdled' },
      { keys: ['Shift', '←→'], description: 'Hela dagar, hoppa över spalter' },
      { keys: ['Shift', '↑↓'], description: 'Flytta kanten 15 min' },
      { keys: ['Enter'], description: 'Klistra in i ramen' },
      { keys: ['Escape'], description: 'Avbryt' },
    ],
  },
  {
    // Skrivbords panelgenvägar stod här tidigare. De togs bort när Skrivbord
    // lämnade huvudnavigationen — routen /features/command-center fungerar
    // fortfarande via direkt-URL, men genvägarna gick inte att nå från menyn
    // och blev därför vilseledande i hjälpen.
    label: 'Kalender',
    shortcuts: [
      { keys: ['←', '→'], description: 'En dag i sidled' },
      { keys: ['↑', '↓'], description: 'En vecka i höjdled' },
      { keys: ['Home', 'End'], description: 'Veckans första / sista dag' },
      { keys: ['Enter'], description: 'Välj dag / öppna anteckning' },
      { keys: ['Escape'], description: 'Lämna redigering / överstrykning' },
    ],
  },
];
