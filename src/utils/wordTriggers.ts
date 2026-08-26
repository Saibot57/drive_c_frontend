/**
 * Ordmatchningen som både färg- och salsreglerna bygger på. Låg den kvar i
 * `colorTriggers` skulle salsreglerna antingen fått en egen kopia, som glider
 * isär vid första justeringen, eller behövt importera från färgmodulen — ett
 * beroende som inte betyder något.
 */

/**
 * Delar upp text i ord. Bokstäver och siffror hör till ordet, allt annat
 * skiljer dem åt, så "Prov: kap 3" blir ["prov", "kap", "3"].
 */
export const tokenize = (value: string): string[] => (
  value
    .toLocaleLowerCase('sv')
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean)
);

/**
 * Hela ord måste matcha, så "prov" träffar "Prov kap 3" men inte
 * "Provisorisk". Ett triggerord får bestå av flera ord; då måste de stå
 * i följd i titeln.
 */
export const containsWords = (titleWords: string[], triggerWords: string[]): boolean => {
  if (triggerWords.length === 0 || triggerWords.length > titleWords.length) return false;
  const lastStart = titleWords.length - triggerWords.length;
  for (let start = 0; start <= lastStart; start++) {
    if (triggerWords.every((word, offset) => titleWords[start + offset] === word)) {
      return true;
    }
  }
  return false;
};
