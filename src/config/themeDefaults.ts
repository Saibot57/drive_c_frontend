/**
 * themeDefaults.ts — Default token values and zone metadata for the Theme Inspector.
 */

export const DEFAULT_TOKENS: Record<string, string> = {
  // Bakgrund
  'theme-page-bg':         '#ffffff',
  'theme-page-bg-alt':     '#f3f4f6',
  'theme-card-bg':         '#ffffff',
  'theme-panel-bg':        '#ffffff',
  'theme-input-bg':        '#ffffff',
  'theme-sidebar-bg':      '#fcd7d7',
  'theme-overlay-bg':      'rgba(0,0,0,0.8)',
  'theme-login-bg':        '#fcd7d7',
  'theme-hover-bg':        '#f9fafb',
  'theme-taskbar-bg':      '#fcd7d7',
  'theme-taskbar-item-bg': '#ffffff',

  // Accent
  'theme-accent-primary':       '#ff6b6b',
  'theme-accent-primary-hover': '#ff5252',
  'theme-accent-secondary':     '#88cc19',
  'theme-accent-soft':          '#fcd7d7',
  'theme-accent-button':        '#aee8fe',
  'theme-accent-button-hover':  '#59cffd',
  'theme-accent-checkbox':      '#8ecc93',

  // Text
  'theme-text-primary':    '#000000',
  'theme-text-secondary':  '#6b7280',
  'theme-text-muted':      '#9ca3af',
  'theme-text-on-accent':  '#ffffff',

  // Border & Shadow (Advanced)
  'theme-border-color':  '#000000',
  'theme-border-subtle': 'rgba(0,0,0,0.2)',
  'theme-shadow-color':  'rgba(0,0,0,1)',
  'theme-ring-color':    '#000000',

  // Command Center
  'theme-cc-notes-bg':       'rgba(240,253,244,0.4)',
  'theme-cc-notes-stripe':   '#22c55e',
  'theme-cc-calendar-bg':    'rgba(253,242,248,0.4)',
  'theme-cc-calendar-stripe':'#ec4899',
  'theme-cc-todo-bg':        'rgba(239,246,255,0.4)',
  'theme-cc-todo-stripe':    '#3b82f6',
  'theme-cc-schedule-bg':    'rgba(255,251,235,0.4)',
  'theme-cc-schedule-stripe':'#f59e0b',

  // Tags & Misc
  'theme-tag-bg':      '#fef9c3',
  'theme-tag-border':  '#000000',
  'theme-focus-ring':  '#000000',
  'theme-divider':     '#e5e7eb',

  // Planner
  'theme-planner-card-bg':    '#ffffff',
  'theme-planner-btn-bg':     '#a7f3d0',
  'theme-planner-chip-bg':    '#ffffff',
  'theme-planner-btn-shadow': 'rgba(0,0,0,1)',
};

export type ThemeZone = {
  key: string;
  label: string;
  group: string;
  description: string;
  isAdvanced: boolean;
};

export const THEME_GROUPS = [
  'Bakgrund',
  'Accent',
  'Text',
  'Border & Shadow',
  'Command Center',
  'Tags',
  'Planner',
] as const;

export const THEME_ZONES: ThemeZone[] = [
  // Bakgrund
  { key: 'theme-page-bg',         label: 'Sidbakgrund',       group: 'Bakgrund', description: 'Sidans bakgrundsfärg', isAdvanced: false },
  { key: 'theme-page-bg-alt',     label: 'Alternativ bakgrund', group: 'Bakgrund', description: 'Alternativ bakgrundsfärg (t.ex. gray-100)', isAdvanced: false },
  { key: 'theme-card-bg',         label: 'Kort',              group: 'Bakgrund', description: 'Bakgrund för kort och modaler', isAdvanced: false },
  { key: 'theme-panel-bg',        label: 'Panel',             group: 'Bakgrund', description: 'Panelbakgrund', isAdvanced: false },
  { key: 'theme-input-bg',        label: 'Input',             group: 'Bakgrund', description: 'Input-fältens bakgrund', isAdvanced: false },
  { key: 'theme-sidebar-bg',      label: 'Sidopanel',         group: 'Bakgrund', description: 'Navigeringens sidopanel', isAdvanced: false },
  { key: 'theme-overlay-bg',      label: 'Overlay',           group: 'Bakgrund', description: 'Modal-overlay', isAdvanced: false },
  { key: 'theme-login-bg',        label: 'Login',             group: 'Bakgrund', description: 'Inloggningssidans bakgrund', isAdvanced: false },
  { key: 'theme-hover-bg',        label: 'Hover',             group: 'Bakgrund', description: 'Hover-bakgrund', isAdvanced: false },
  { key: 'theme-taskbar-bg',      label: 'Aktivitetsfält',    group: 'Bakgrund', description: 'Aktivitetsfältets bakgrund', isAdvanced: false },
  { key: 'theme-taskbar-item-bg', label: 'Aktivitetsfält-objekt', group: 'Bakgrund', description: 'Bakgrund för objekt i aktivitetsfältet', isAdvanced: false },

  // Accent
  { key: 'theme-accent-primary',       label: 'Primär accent',      group: 'Accent', description: 'Huvudaccentfärg', isAdvanced: false },
  { key: 'theme-accent-primary-hover', label: 'Primär accent hover', group: 'Accent', description: 'Hover-variant av primär accent', isAdvanced: false },
  { key: 'theme-accent-secondary',     label: 'Sekundär accent',    group: 'Accent', description: 'Sekundär accentfärg', isAdvanced: false },
  { key: 'theme-accent-soft',          label: 'Mjuk accent',        group: 'Accent', description: 'Mjuk/lätt accent', isAdvanced: false },
  { key: 'theme-accent-button',        label: 'Knapp',              group: 'Accent', description: 'Knappfärg', isAdvanced: false },
  { key: 'theme-accent-button-hover',  label: 'Knapp hover',        group: 'Accent', description: 'Hover-variant av knappfärg', isAdvanced: false },
  { key: 'theme-accent-checkbox',      label: 'Checkbox',           group: 'Accent', description: 'Checkbox-accentfärg', isAdvanced: false },

  // Text
  { key: 'theme-text-primary',    label: 'Primär text',     group: 'Text', description: 'Huvudtextfärg', isAdvanced: false },
  { key: 'theme-text-secondary',  label: 'Sekundär text',   group: 'Text', description: 'Sekundär textfärg', isAdvanced: false },
  { key: 'theme-text-muted',      label: 'Dämpad text',     group: 'Text', description: 'Dämpad/ljus textfärg', isAdvanced: false },
  { key: 'theme-text-on-accent',  label: 'Text på accent',  group: 'Text', description: 'Textfärg ovanpå accent', isAdvanced: false },

  // Border & Shadow (Advanced)
  { key: 'theme-border-color',  label: 'Ram',           group: 'Border & Shadow', description: 'Huvudramfärg', isAdvanced: true },
  { key: 'theme-border-subtle', label: 'Subtil ram',    group: 'Border & Shadow', description: 'Subtil ramfärg', isAdvanced: true },
  { key: 'theme-shadow-color',  label: 'Skugga',        group: 'Border & Shadow', description: 'Skuggfärg', isAdvanced: true },
  { key: 'theme-ring-color',    label: 'Fokusring',     group: 'Border & Shadow', description: 'Fokusring-färg', isAdvanced: true },

  // Command Center
  { key: 'theme-cc-notes-bg',        label: 'Anteckningar BG',       group: 'Command Center', description: 'Notes-panelens bakgrund', isAdvanced: false },
  { key: 'theme-cc-notes-stripe',    label: 'Anteckningar rand',     group: 'Command Center', description: 'Notes-panelens randfärg', isAdvanced: false },
  { key: 'theme-cc-calendar-bg',     label: 'Kalender BG',           group: 'Command Center', description: 'Kalender-panelens bakgrund', isAdvanced: false },
  { key: 'theme-cc-calendar-stripe', label: 'Kalender rand',         group: 'Command Center', description: 'Kalender-panelens randfärg', isAdvanced: false },
  { key: 'theme-cc-todo-bg',         label: 'Todo BG',               group: 'Command Center', description: 'Todo-panelens bakgrund', isAdvanced: false },
  { key: 'theme-cc-todo-stripe',     label: 'Todo rand',             group: 'Command Center', description: 'Todo-panelens randfärg', isAdvanced: false },
  { key: 'theme-cc-schedule-bg',     label: 'Schema BG',             group: 'Command Center', description: 'Schema-panelens bakgrund', isAdvanced: false },
  { key: 'theme-cc-schedule-stripe', label: 'Schema rand',           group: 'Command Center', description: 'Schema-panelens randfärg', isAdvanced: false },

  // Tags & Misc
  { key: 'theme-tag-bg',      label: 'Tagg BG',      group: 'Tags', description: 'Taggens bakgrundsfärg', isAdvanced: false },
  { key: 'theme-tag-border',  label: 'Tagg ram',      group: 'Tags', description: 'Taggens ramfärg', isAdvanced: false },
  { key: 'theme-focus-ring',  label: 'Fokusring',     group: 'Tags', description: 'Fokusring-färg', isAdvanced: false },
  { key: 'theme-divider',     label: 'Avdelare',      group: 'Tags', description: 'Avdelarfärg', isAdvanced: false },

  // Planner
  { key: 'theme-planner-card-bg',    label: 'Planner kort',   group: 'Planner', description: 'Planner-kortets bakgrund', isAdvanced: false },
  { key: 'theme-planner-btn-bg',     label: 'Planner knapp',  group: 'Planner', description: 'Planner-knappens bakgrund', isAdvanced: false },
  { key: 'theme-planner-chip-bg',    label: 'Planner chip',   group: 'Planner', description: 'Planner-chipets bakgrund', isAdvanced: false },
  { key: 'theme-planner-btn-shadow', label: 'Planner skugga', group: 'Planner', description: 'Planner-knappens skuggfärg', isAdvanced: false },
];

export interface ThemePreset {
  id: string;
  name: string;
  tokens: Record<string, string>;
  isDefault?: boolean;
}

export const STANDARD_PRESET: ThemePreset = {
  id: '__standard__',
  name: 'Standard',
  tokens: { ...DEFAULT_TOKENS },
  isDefault: true,
};

/** Palette of common neobrutalist pastels for the color picker. */
export const THEME_COLOR_PALETTE = [
  '#ffffff', '#000000', '#ff6b6b', '#ff5252', '#fcd7d7',
  '#aee8fe', '#59cffd', '#88cc19', '#a7f3d0', '#8ecc93',
  '#fef9c3', '#fde68a', '#fed7aa', '#fecdd3', '#c7d2fe',
  '#ddd6fe', '#d9f99d', '#bae6fd', '#f3f4f6', '#e5e7eb',
] as const;
