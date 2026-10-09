import { clsx, type ClassValue } from "clsx"
import { extendTailwindMerge } from "tailwind-merge"

/**
 * Temats egna klassnamn (tailwind.config.ts). tailwind-merge känner inte till
 * dem och hade annars tagit `border-frame` för en färg, som `border-ui-line`
 * då skrev över, så att ramen tappade sin bredd.
 */
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "border-w": [{ border: ["frame"] }],
      // Bara de nya namnen. De gamla (shadow-shadow, rounded-base) slås ihop
      // som förut, så att Neo inte ändras av att en klass plötsligt vinner.
      shadow: [{ shadow: ["frame", "frame-sm", "float"] }],
      rounded: [{ rounded: ["ui", "ui-sm"] }],
    },
  },
})

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
