/**
 * Textfärg som håller sig läsbar mot en vald bakgrundsfärg.
 *
 * Temahjulets färger sätts fritt av användaren, så textfärgen kan inte vara
 * hårdkodad – den räknas ut från bakgrundens relativa luminans enligt WCAG 2.1.
 */

export const TEXT_ON_LIGHT = '#1a1a1a';
export const TEXT_ON_DARK = '#ffffff';

/** "#abc" och "#aabbcc" (med eller utan brädgård) ger samma resultat. */
const parseHex = (color: string): { r: number; g: number; b: number } | null => {
  const value = color.trim().replace(/^#/, '');
  const expanded = value.length === 3
    ? value.split('').map(char => char + char).join('')
    : value;
  if (!/^[0-9a-f]{6}$/i.test(expanded)) return null;
  return {
    r: parseInt(expanded.slice(0, 2), 16),
    g: parseInt(expanded.slice(2, 4), 16),
    b: parseInt(expanded.slice(4, 6), 16),
  };
};

const linearize = (channel: number): number => {
  const value = channel / 255;
  return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
};

export const relativeLuminance = (color: string): number => {
  const rgb = parseHex(color);
  if (!rgb) return 1;
  return 0.2126 * linearize(rgb.r) + 0.7152 * linearize(rgb.g) + 0.0722 * linearize(rgb.b);
};

export const contrastRatio = (a: string, b: string): number => {
  const first = relativeLuminance(a);
  const second = relativeLuminance(b);
  const lighter = Math.max(first, second);
  const darker = Math.min(first, second);
  return (lighter + 0.05) / (darker + 0.05);
};

/** Svart eller vit text – den av de två som ger bäst kontrast mot bakgrunden. */
export const getReadableTextColor = (background: string): string => (
  contrastRatio(TEXT_ON_LIGHT, background) >= contrastRatio(TEXT_ON_DARK, background)
    ? TEXT_ON_LIGHT
    : TEXT_ON_DARK
);

/**
 * Dämpad variant för kommentarer och sekundär text. Tonas mot bakgrunden i
 * stället för mot grått, så att kontrasten följer med när färgen byts.
 */
export const getMutedTextColor = (background: string): string => (
  getReadableTextColor(background) === TEXT_ON_LIGHT ? '#404040' : '#e8e8e8'
);
