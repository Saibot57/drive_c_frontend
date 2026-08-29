/**
 * Från scen-px till PDF-punkter.
 *
 * Rutnätets höjd beror bara på tiden, aldrig på bredden, så skalfaktorn är känd
 * innan något ritas. Det är den observationen hela sidanpassningen vilar på:
 * `k` faller ut ur höjden, och scenens *bredd* väljs sedan så att den fyller
 * sidan exakt.
 *
 * Digitalt läge har ingen sida att anpassa sig till — där *är* sidan scenen.
 */

import {
  DIGITAL_WIDTH_PX,
  K_LOW_WARNING,
  K_MAX,
  PAPER,
  PX_TO_PT,
  PageMode,
  SCENE_WIDTH_MAX_PX,
  SCENE_WIDTH_MIN_PX,
} from './theme';

export type SceneTransform = {
  mode: PageMode;
  pageWidthPt: number;
  pageHeightPt: number;
  /** Scenens bredd i px. Fri på papper, fast i digitalt läge. */
  sceneWidthPx: number;
  sceneHeightPx: number;
  /** Skalfaktor från px till px-på-papper. 1 i digitalt läge. */
  k: number;
  offsetXPt: number;
  offsetYPt: number;
  /** Texten blir så liten att den knappt går att läsa. Bubblar upp som notis. */
  isLowScale: boolean;
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

export const computeTransform = (mode: PageMode, sceneHeightPx: number): SceneTransform => {
  if (mode === 'digital') {
    // Sidan är scenen: ingen marginal, ingen nedskalning, per konstruktion en sida.
    const sceneWidthPx = DIGITAL_WIDTH_PX;
    return {
      mode,
      pageWidthPt: sceneWidthPx * PX_TO_PT,
      pageHeightPt: sceneHeightPx * PX_TO_PT,
      sceneWidthPx,
      sceneHeightPx,
      k: 1,
      offsetXPt: 0,
      offsetYPt: 0,
      isLowScale: false,
    };
  }

  const paper = PAPER[mode];
  const usableWidthPt = paper.widthPt - paper.marginPt * 2;
  const usableHeightPt = paper.heightPt - paper.marginPt * 2;

  const heightLimited = usableHeightPt / (sceneHeightPx * PX_TO_PT);
  const capped = Math.min(heightLimited, K_MAX);

  // Bredden väljs så att innehållet fyller sidan vid den skalan...
  const sceneWidthPx = clamp(
    usableWidthPt / (PX_TO_PT * capped),
    SCENE_WIDTH_MIN_PX,
    SCENE_WIDTH_MAX_PX
  );

  // ...men klampades den måste skalan dras ned igen så bredden ryms.
  const k = Math.min(capped, usableWidthPt / (sceneWidthPx * PX_TO_PT));

  return {
    mode,
    pageWidthPt: paper.widthPt,
    pageHeightPt: paper.heightPt,
    sceneWidthPx,
    sceneHeightPx,
    k,
    // Centrerad i sidled, toppjusterad i höjdled.
    offsetXPt: paper.marginPt + (usableWidthPt - sceneWidthPx * PX_TO_PT * k) / 2,
    offsetYPt: paper.marginPt,
    isLowScale: k < K_LOW_WARNING,
  };
};

export const toPtX = (xPx: number, t: SceneTransform) => t.offsetXPt + xPx * PX_TO_PT * t.k;
export const toPtY = (yPx: number, t: SceneTransform) => t.offsetYPt + yPx * PX_TO_PT * t.k;
/** Längder, fontstorlekar och linjebredder — allt utom koordinater. */
export const toPt = (lengthPx: number, t: SceneTransform) => lengthPx * PX_TO_PT * t.k;
