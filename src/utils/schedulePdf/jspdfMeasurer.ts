/**
 * `TextMeasurer` ovanpå jsPDF:s fontmetrics.
 *
 * `getStringUnitWidth` svarar i em-enheter och är alltså skaloberoende — ett
 * skrap-dokument räcker, och samma mätare duger för alla sidlägen. Det gör
 * också att mätningen fungerar i Node, vilket är hela poängen med att inte
 * mäta i DOM:en.
 */

import jsPDF from 'jspdf';
import { TextMeasurer } from './measure';
import { ASCENT_RATIO, FONTS } from './fonts';

export const createJsPdfMeasurer = (): TextMeasurer => {
  const scratch = new jsPDF({ unit: 'pt', format: [100, 100] });

  return {
    width: (text, font, sizePx) => {
      if (!text) return 0;
      const { name, style } = FONTS[font];
      scratch.setFont(name, style);
      return scratch.getStringUnitWidth(text) * sizePx;
    },
    ascentRatio: font => ASCENT_RATIO[font],
  };
};
