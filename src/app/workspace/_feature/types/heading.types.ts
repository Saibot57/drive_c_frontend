/**
 * Fristående rubrik. Till skillnad från de andra elementtyperna bär den ingen
 * data — den strukturerar ytan. Därför är hela innehållet presentation.
 */

export type HeadingLevel = 1 | 2 | 3;

export type HeadingFont = 'bangers' | 'monument' | 'archivo' | 'redhat';

export interface HeadingContent {
  text: string;
  level: HeadingLevel;
  /**
   * Utelämnad betyder "följ nivåns förval" — inte "ingen åsikt om typsnitt".
   * Skillnaden är hela poängen: en rubrik du aldrig satt typsnitt på byter
   * typsnitt när du byter nivå, en du valt aktivt behåller sitt.
   */
  font?: HeadingFont;
  /** Utelämnad = HEADING_DEFAULT_COLOR. */
  color?: string;
}
