/**
 * Scenen: allt exporten ritar, uttryckt som en platt lista primitiver i
 * scen-px — samma koordinatsystem som skärmen, så `getPositionStyles` gäller
 * rakt av.
 *
 * Mängden nodtyper är avsiktligt stängd på fyra. Z-ordning är arrayordning,
 * det finns inga grupper och inga transformer utom den enda globala som
 * renderaren äger. Ett scenlager som växer med nästling, clip-paths och
 * transformer har blivit ett sämre SVG och borde då bytas mot riktig SVG —
 * behövs en femte nodtyp är det signalen att stanna upp, inte att lägga till.
 */

import { SceneTransform } from './transform';

export type Rgb = { r: number; g: number; b: number };

export type FontRole = 'title' | 'meta' | 'mono' | 'body';

export type SceneNode =
  | {
      kind: 'rect';
      x: number; y: number; w: number; h: number;
      radius?: number;
      fill?: Rgb;
      stroke?: Rgb;
      strokeWidth?: number;
      /** [streck, lucka] i px. Renderaren nollställer efteråt. */
      dash?: [number, number];
    }
  | {
      kind: 'line';
      x1: number; y1: number; x2: number; y2: number;
      stroke: Rgb;
      strokeWidth: number;
    }
  | {
      kind: 'text';
      /** Ankarpunkt i x-led, tolkad enligt `align`. */
      x: number;
      /**
       * Textens **baslinje**, inte överkant. Byggaren räknar ut den som
       * `radensTopp + sizePx * ascentRatio(font)`, så ingen renderare behöver
       * gissa hur den egna motorn placerar baslinjen.
       */
      y: number;
      text: string;
      font: FontRole;
      sizePx: number;
      color: Rgb;
      align?: 'left' | 'right' | 'center';
      /** `tracking-wide` och liknande, i px. */
      charSpacePx?: number;
    }
  | {
      kind: 'link';
      x: number; y: number; w: number; h: number;
      url: string;
    };

export type ScheduleScene = {
  widthPx: number;
  heightPx: number;
  /**
   * Sidan scenen är byggd för. Ligger här eftersom `widthPx` redan är ett
   * resultat av den — scenen kan inte tolkas utan att veta vilken sida den
   * skulle fylla.
   */
  transform: SceneTransform;
  nodes: SceneNode[];
  /** Poster där texten inte rymdes och klipptes med "…". */
  truncatedInstanceIds: string[];
};

// ── Färg ──

export const WHITE: Rgb = { r: 255, g: 255, b: 255 };
export const BLACK: Rgb = { r: 0, g: 0, b: 0 };

/**
 * Läser 3-, 4-, 6- och 8-siffrig hex och komponerar eventuell alfa mot
 * `backdrop`. `sanitizeColorTriggers` släpper igenom `#[0-9a-f]{3,8}`, alltså
 * även 5- och 7-siffrigt skräp — allt som inte går att tyda blir vitt.
 *
 * Detta är medvetet inte `parseHex` i `readableTextColor.ts`: den räknar i
 * hex-strängar och känner bara 3 och 6 siffror, medan scenen behöver numeriska
 * kanaler och alfakomposition.
 */
export const parseColor = (value: string | undefined, backdrop: Rgb = WHITE): Rgb => {
  if (!value) return WHITE;
  const raw = value.trim().replace(/^#/, '');
  const expand = (chars: string) => chars.split('').map(c => c + c).join('');

  let hex: string | null = null;
  if (raw.length === 3 || raw.length === 4) hex = expand(raw);
  else if (raw.length === 6 || raw.length === 8) hex = raw;
  if (!hex || !/^[0-9a-f]+$/i.test(hex)) return WHITE;

  const channel = (index: number) => parseInt(hex.slice(index * 2, index * 2 + 2), 16);
  const solid: Rgb = { r: channel(0), g: channel(1), b: channel(2) };
  if (hex.length === 6) return solid;

  return mix(backdrop, solid, channel(3) / 255);
};

/** t = 0 ger `from`, t = 1 ger `to`. */
export const mix = (from: Rgb, to: Rgb, t: number): Rgb => ({
  r: Math.round(from.r + (to.r - from.r) * t),
  g: Math.round(from.g + (to.g - from.g) * t),
  b: Math.round(from.b + (to.b - from.b) * t),
});

/**
 * En halvgenomskinlig färg förblandad mot sitt underlag.
 *
 * Korten är platta fyllningar, så resultatet är exakt detsamma som en riktig
 * alfakanal — men utan ett ExtGState som kan läcka vidare till nästa nod.
 */
export const flatten = (color: Rgb, alpha: number, backdrop: Rgb): Rgb =>
  mix(backdrop, color, alpha);

export const toHex = ({ r, g, b }: Rgb): string =>
  `#${[r, g, b].map(v => Math.round(v).toString(16).padStart(2, '0')).join('')}`;
