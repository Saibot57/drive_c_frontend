/**
 * Elementet äger ingen data om hjulet — bara en pekare. Hjulet hämtas från
 * temakalendern vid rendering, så kortet visar alltid det som gäller nu.
 */
export interface WheelRefContent {
  wheelId: string | null;
}
