/**
 * Scen → SVG-sträng.
 *
 * Enkelriktad och DOM-fri, så den kör i vitest. Det gör SVG:n till exportens
 * snapshotformat: en diffbar textfil som samtidigt går att öppna i webbläsaren
 * och titta på. Den matar dessutom PNG-vägen och är en användbar fil i sig —
 * äkta vektor i det format som faktiskt går att redigera.
 */

import { FontRole, Rgb, ScheduleScene, SceneNode, toHex } from './scene';

/** SVG anger fontfamilj, inte metrik. Måste spegla `fonts.ts`. */
const FONT_FAMILY: Record<FontRole, string> = {
  title: 'Helvetica, Arial, sans-serif',
  meta: 'Helvetica, Arial, sans-serif',
  body: 'Helvetica, Arial, sans-serif',
  // Enkla citattecken inuti: attributet är dubbelciterat och dubbla här
  // bryter dokumentet.
  mono: "'Courier New', Courier, monospace",
};

const FONT_WEIGHT: Record<FontRole, string> = {
  title: 'bold',
  meta: 'bold',
  body: 'normal',
  mono: 'bold',
};

const ANCHOR = { left: 'start', center: 'middle', right: 'end' } as const;

const escapeXml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/** Två decimaler räcker för px och håller snapshotarna läsbara. */
const n = (value: number) => {
  const rounded = Math.round(value * 100) / 100;
  return Object.is(rounded, -0) ? '0' : String(rounded);
};

const fill = (color: Rgb | undefined) => (color ? toHex(color) : 'none');

const renderNode = (node: SceneNode): string => {
  switch (node.kind) {
    case 'rect': {
      const attrs = [
        `x="${n(node.x)}"`,
        `y="${n(node.y)}"`,
        `width="${n(node.w)}"`,
        `height="${n(node.h)}"`,
        node.radius ? `rx="${n(node.radius)}"` : '',
        `fill="${fill(node.fill)}"`,
        node.stroke ? `stroke="${toHex(node.stroke)}"` : '',
        node.stroke ? `stroke-width="${n(node.strokeWidth ?? 1)}"` : '',
        node.dash ? `stroke-dasharray="${n(node.dash[0])} ${n(node.dash[1])}"` : '',
      ].filter(Boolean);
      return `<rect ${attrs.join(' ')} />`;
    }
    case 'line':
      return `<line x1="${n(node.x1)}" y1="${n(node.y1)}" x2="${n(node.x2)}" y2="${n(node.y2)}" stroke="${toHex(node.stroke)}" stroke-width="${n(node.strokeWidth)}" />`;
    case 'text': {
      const attrs = [
        `x="${n(node.x)}"`,
        `y="${n(node.y)}"`,
        `font-family="${FONT_FAMILY[node.font]}"`,
        `font-size="${n(node.sizePx)}"`,
        `font-weight="${FONT_WEIGHT[node.font]}"`,
        `fill="${toHex(node.color)}"`,
        node.align && node.align !== 'left' ? `text-anchor="${ANCHOR[node.align]}"` : '',
        node.charSpacePx ? `letter-spacing="${n(node.charSpacePx)}"` : '',
      ].filter(Boolean);
      return `<text ${attrs.join(' ')}>${escapeXml(node.text)}</text>`;
    }
    case 'link':
      // Ingen visuell motsvarighet i SVG — länken är en PDF-annotation.
      return '';
  }
};

export const sceneToSvg = (scene: ScheduleScene): string => {
  const body = scene.nodes.map(renderNode).filter(Boolean).map(line => `  ${line}`).join('\n');
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<svg xmlns="http://www.w3.org/2000/svg" width="${n(scene.widthPx)}" height="${n(scene.heightPx)}" viewBox="0 0 ${n(scene.widthPx)} ${n(scene.heightPx)}">`,
    body,
    '</svg>',
    '',
  ].join('\n');
};
