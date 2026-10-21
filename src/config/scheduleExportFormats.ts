import type { ExportFormat } from '@/utils/schedulePdf';
import type { PageMode } from '@/utils/schedulePdf/theme';

/**
 * Exportmenyns alternativ. Delas av schemaplaneraren och Arbetslag så att
 * etiketterna och förklaringarna inte glider isär.
 */

export const PDF_PAGE_OPTIONS: readonly { mode: PageMode; label: string; hint: string }[] = [
  { mode: 'digital', label: 'PDF – digital', hint: 'Sidan får schemats egna mått – skarp på vilken skärm som helst.' },
  { mode: 'a4', label: 'PDF – A4', hint: 'Skalas till exakt en liggande A4.' },
  { mode: 'a3', label: 'PDF – A3', hint: 'Skalas till exakt en liggande A3.' },
];

export const IMAGE_FORMAT_OPTIONS: readonly { format: Exclude<ExportFormat, 'pdf'>; label: string; hint: string }[] = [
  { format: 'png', label: 'PNG', hint: 'Ritas ur schemadatan i 3x – förhandsvisas inline i chattar.' },
  { format: 'jpeg', label: 'JPG', hint: 'Som PNG men mindre fil.' },
  { format: 'svg', label: 'SVG', hint: 'Äkta vektor som går att öppna i Illustrator, Figma eller Inkscape.' },
];
