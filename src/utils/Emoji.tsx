import React from "react";

function toCodePointSequence(str: string): string {
  const cps: string[] = [];
  for (const ch of Array.from(str)) {
    const cp = ch.codePointAt(0);
    if (cp !== undefined) cps.push(cp.toString(16));
  }
  return cps.join("-");
}

/**
 * Heuristik: använd Twemoji för "komplexa" emoji (ZWJ/VS/skin tones),
 * annars lita på native rendering.
 */
function shouldUseTwemoji(emoji: string): boolean {
  if (!emoji) return false;
  // zero-width joiner eller variation selector
  if(/[\u200D\uFE0F]/.test(emoji)) return true;

  // hudtoner (U+1F3FB..U+1F3FF)
  for (const ch of Array.from(emoji)) {
    const cp = ch.codePointAt(0)!;
    if (cp >= 0x1f3fb && cp <= 0x1f3ff) return true;
  }

  // längre än ett code point => ofta kombinerad emoji
  const cps = Array.from(emoji);
  return cps.length > 1;
}

type EmojiProps = {
  emoji: string;
  className?: string;
  title?: string;
  // tvinga Twemoji även om enkel (t.ex. för konsekvens i UI)
  forceTwemoji?: boolean;
};

export const Emoji: React.FC<EmojiProps> = ({ emoji, className, title, forceTwemoji }) => {
  if (!emoji) return null;

  const useTw = forceTwemoji || shouldUseTwemoji(emoji);
  if (!useTw) {
    return (
      <span className={className} title={title} aria-label={emoji}>
        {emoji}
      </span>
    );
  }

  const seq = toCodePointSequence(emoji);
  // Stabil källa för SVG: jsDelivr mirror av Twemoji
  const src = `https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/${seq}.svg`;

  return (
    <img
      className={className ? `${className} emoji-img` : "emoji-img"}
      src={src}
      alt={emoji}
      title={title || emoji}
      loading="lazy"
      decoding="async"
      draggable={false}
    />
  );
};

