import {
  AlertTriangle,
  Check,
  CircleHelp,
  Clock,
  ExternalLink,
  Flag,
  Lightbulb,
  Pin,
  Star,
  StickyNote,
  type LucideIcon,
} from 'lucide-react';
import type { MindmapIcon } from '@/types/mindmap';
import type { MindmapDrawSymbols } from '@/utils/mindmap/mindmapDraw';

/** Nodernas ikoner (Alt+Shift+1–8, i den här ordningen) och symbolerna för anteckning och länk. */
export const MINDMAP_ICON_COMPONENTS: Record<MindmapIcon, LucideIcon> = {
  star: Star,
  flag: Flag,
  check: Check,
  question: CircleHelp,
  warning: AlertTriangle,
  idea: Lightbulb,
  clock: Clock,
  pin: Pin,
};

export const MINDMAP_ICON_LABELS: Record<MindmapIcon, string> = {
  star: 'Stjärna',
  flag: 'Flagga',
  check: 'Klart',
  question: 'Fråga',
  warning: 'Varning',
  idea: 'Idé',
  clock: 'Tid',
  pin: 'Nål',
};

export const NoteSymbol = StickyNote;
export const LinkSymbol = ExternalLink;

/**
 * Symbolerna som bilder, till exporten. Ikonerna är SVG i sidan; här läses
 * de ur ett gömt förråd (`[data-mm-symbol]`), får bildens textfärg i stället
 * för `currentColor` och laddas som bilder som Canvas kan rita.
 */
export async function loadDrawSymbols(store: HTMLElement, color: string): Promise<MindmapDrawSymbols> {
  const symbols: MindmapDrawSymbols = { icons: {} };
  await Promise.all(Array.from(store.querySelectorAll<SVGElement>('svg[data-mm-symbol]')).map(async (svg) => {
    const name = svg.dataset.mmSymbol ?? '';
    const copy = svg.cloneNode(true) as SVGElement;
    copy.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    // Större än på skärmen, så att symbolen är skarp i exportens dubbla skala.
    copy.setAttribute('width', '64');
    copy.setAttribute('height', '64');
    const markup = new XMLSerializer().serializeToString(copy).replace(/currentColor/g, color);
    const image = new Image();
    image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`;
    try {
      await image.decode();
    } catch {
      return; // En symbol som inte gick att ladda ritas inte; bilden blir ändå till.
    }
    if (name === 'note') symbols.note = image;
    else if (name === 'link') symbols.link = image;
    else if (symbols.icons) symbols.icons[name as MindmapIcon] = image;
  }));
  return symbols;
}
