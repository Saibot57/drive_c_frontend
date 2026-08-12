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
      { keys: ['Ctrl', 'Shift', '1'], description: 'Bibliotek' },
      { keys: ['Ctrl', 'Shift', '2'], description: 'Schema' },
      { keys: ['Ctrl', 'Shift', '3'], description: 'Familjeschema' },
      { keys: ['Ctrl', 'Shift', '4'], description: 'Skrivbord' },
      { keys: ['Ctrl', 'Shift', '5'], description: 'Workspace' },
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
    label: 'Skrivbord — Paneler',
    shortcuts: [
      { keys: ['Ctrl', 'Shift', 'N'], description: 'Fokusera Anteckningar' },
      { keys: ['Ctrl', 'Shift', 'T'], description: 'Fokusera Terminal' },
      { keys: ['Ctrl', 'Shift', 'C'], description: 'Fokusera Kalender' },
      { keys: ['Ctrl', 'Shift', 'D'], description: 'Fokusera Att-göra-lista' },
      { keys: ['Ctrl', 'Shift', 'S'], description: 'Fokusera Dagsschema' },
    ],
  },
  {
    label: 'Skrivbord — Navigering',
    shortcuts: [
      { keys: ['↓', 'j'], description: 'Nästa objekt' },
      { keys: ['↑', 'k'], description: 'Föregående objekt' },
      { keys: ['Enter'], description: 'Visa / Toggla' },
      { keys: ['e'], description: 'Redigera' },
      { keys: ['/'], description: 'Fokusera sök (Anteckningar)' },
      { keys: ['Escape'], description: 'Rensa / Avmarkera' },
    ],
  },
];
