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
      "border-w-x": [{ "border-x": ["frame"] }],
      "border-w-y": [{ "border-y": ["frame"] }],
      "border-w-t": [{ "border-t": ["frame"] }],
      "border-w-r": [{ "border-r": ["frame"] }],
      "border-w-b": [{ "border-b": ["frame"] }],
      "border-w-l": [{ "border-l": ["frame"] }],
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
