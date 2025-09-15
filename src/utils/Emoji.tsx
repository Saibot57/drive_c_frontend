'use client';

import React, { useMemo, useState } from "react";
import twemoji from "twemoji";

type EmojiProps = {
  emoji: string;
  className?: string;
  title?: string;
  forceTwemoji?: boolean; // tvinga SVG även för enkla emoji
};

function shouldUseTwemoji(s: string): boolean {
  if (!s) return false;
  if (/[\u200D\uFE0F]/.test(s)) return true; // ZWJ/VS
  for (const ch of Array.from(s)) {
    const cp = ch.codePointAt(0)!;
    if (cp >= 0x1f3fb && cp <= 0x1f3ff) return true; // hudtoner
  }
  return Array.from(s).length > 1; // kombination?
}

export const Emoji: React.FC<EmojiProps> = ({ emoji, className, title, forceTwemoji }) => {
  const clean = (emoji || "").trim();
  const useTw = forceTwemoji || shouldUseTwemoji(clean);
  const code = useMemo(() => (useTw ? twemoji.convert.toCodePoint(clean) : ""), [useTw, clean]);
  const [failed, setFailed] = useState(false);

  if (!clean) return null;
  if (!useTw || failed) {
    return (
      <span className={className} title={title} aria-label={clean}>
        {clean}
      </span>
    );
  }

  // Självhostad källa under Next public/
  const src = `/twemoji/${code}.svg`;

  return (
    <img
      className={className ? `${className} emoji-img` : "emoji-img"}
      src={src}
      alt={clean}
      title={title || clean}
      loading="lazy"
      decoding="async"
      draggable={false}
      onError={() => setFailed(true)} // sista fallback → native glyph
    />
  );
};
