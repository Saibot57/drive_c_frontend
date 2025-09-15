import React, { useMemo, useState } from "react";
import twemoji from "twemoji";

type EmojiProps = {
  emoji: string;
  className?: string;
  title?: string;
  // Använd Twemoji även för enkla emoji (för konsekvens)
  forceTwemoji?: boolean;
};

const TW_VERSION = "14.0.2";
const HOSTS = [
  `https://cdn.jsdelivr.net/gh/twitter/twemoji@${TW_VERSION}/assets/svg/`,
  `https://cdnjs.cloudflare.com/ajax/libs/twemoji/${TW_VERSION}/svg/`,
  `https://unpkg.com/twemoji@${TW_VERSION}/assets/svg/`,
];

function shouldUseTwemoji(emoji: string): boolean {
  if (!emoji) return false;
  // ZWJ/variation selector → kombinationsemoji
  if (/[\u200D\uFE0F]/.test(emoji)) return true;
  // Hudtoner U+1F3FB..U+1F3FF
  for (const ch of Array.from(emoji)) {
    const cp = ch.codePointAt(0)!;
    if (cp >= 0x1f3fb && cp <= 0x1f3ff) return true;
  }
  // Fler än ett code point → sannolikt kombination
  return Array.from(emoji).length > 1;
}

export const Emoji: React.FC<EmojiProps> = ({ emoji, className, title, forceTwemoji }) => {
  const clean = (emoji || "").trim();
  const useTw = forceTwemoji || shouldUseTwemoji(clean);
  const seq = useMemo(() => (useTw ? twemoji.convert.toCodePoint(clean) : ""), [useTw, clean]);

  const [hostIdx, setHostIdx] = useState(0);
  const [failed, setFailed] = useState(false);

  if (!clean) return null;

  // Fallback till native om vi inte ska/kan använda Twemoji
  if (!useTw || failed) {
    return (
      <span className={className} title={title} aria-label={clean}>
        {clean}
      </span>
    );
  }

  const src = `${HOSTS[Math.min(hostIdx, HOSTS.length - 1)]}${seq}.svg`;

  return (
    <img
      className={className ? `${className} emoji-img` : "emoji-img"}
      src={src}
      alt={clean}
      title={title || clean}
      loading="lazy"
      decoding="async"
      draggable={false}
      referrerPolicy="no-referrer"
      onError={() => {
        if (hostIdx < HOSTS.length - 1) setHostIdx(i => i + 1);
        else setFailed(true); // sista fallback: native
      }}
    />
  );
};
