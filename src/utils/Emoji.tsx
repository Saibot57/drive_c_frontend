'use client';

import React, { useMemo, useState } from "react";

const NATIVE_ONLY = process.env.NEXT_PUBLIC_EMOJI_NATIVE_ONLY === "1";

type EmojiProps = {
  emoji: string;
  className?: string;
  title?: string;
  forceTwemoji?: boolean; // tvinga SVG även för enkla emoji
  nativeOnly?: boolean; // valfri prop för att styra per callsite
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

export const Emoji: React.FC<EmojiProps> = ({
  emoji,
  className,
  title,
  forceTwemoji,
  nativeOnly,
}) => {
  const clean = (emoji || "").trim();
  // Toggle vinner alltid: om NATIVE_ONLY eller prop nativeOnly är sanna → hoppa över Twemoji helt
  const disableTwemoji = NATIVE_ONLY || !!nativeOnly;
  const useTw = !disableTwemoji && (forceTwemoji || shouldUseTwemoji(clean));
  const code = useMemo(
    () => (useTw ? Array.from(clean).map((c) => c.codePointAt(0)!.toString(16)).join("-") : ""),
    [useTw, clean]
  );
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
