import { describe, expect, it } from 'vitest';
import { computeTransform, toPt, toPtX, toPtY } from './transform';
import { DIGITAL_WIDTH_PX, K_MAX, PAPER, PX_TO_PT, SCENE_WIDTH_MIN_PX } from './theme';

/** Hel dag: rubrik 40 + dagrubrik 38 + pt-4 16 + 9 h × 120. */
const FULL_DAY_PX = 1174;
const EPS = 1e-6;

describe('computeTransform — digitalt', () => {
  it('sätter sidan till scenens egna mått', () => {
    const t = computeTransform('digital', FULL_DAY_PX);
    expect(t.k).toBe(1);
    expect(t.sceneWidthPx).toBe(DIGITAL_WIDTH_PX);
    expect(t.pageWidthPt).toBeCloseTo(DIGITAL_WIDTH_PX * PX_TO_PT);
    expect(t.pageHeightPt).toBeCloseTo(FULL_DAY_PX * PX_TO_PT);
    expect(t.offsetXPt).toBe(0);
    expect(t.offsetYPt).toBe(0);
    expect(t.isLowScale).toBe(false);
  });

  it('skalar aldrig ned, oavsett hur långt schemat är', () => {
    for (const height of [214, 574, 1174]) {
      expect(computeTransform('digital', height).k).toBe(1);
    }
  });
});

describe('computeTransform — papper', () => {
  const heights = [214, 454, 694, 934, 1174];

  for (const mode of ['a4', 'a3'] as const) {
    it(`ryms alltid på en ${mode.toUpperCase()}-sida`, () => {
      const paper = PAPER[mode];
      const usableW = paper.widthPt - paper.marginPt * 2;
      const usableH = paper.heightPt - paper.marginPt * 2;

      for (const height of heights) {
        const t = computeTransform(mode, height);
        expect(t.sceneWidthPx * PX_TO_PT * t.k).toBeLessThanOrEqual(usableW + EPS);
        expect(t.sceneHeightPx * PX_TO_PT * t.k).toBeLessThanOrEqual(usableH + EPS);
      }
    });
  }

  it('ger k ≈ 0.63 för en hel dag på A4 och ≈ 0.91 på A3', () => {
    expect(computeTransform('a4', FULL_DAY_PX).k).toBeCloseTo(0.6117, 3);
    expect(computeTransform('a3', FULL_DAY_PX).k).toBeCloseTo(0.8789, 3);
  });

  it('varnar när texten blir för liten', () => {
    expect(computeTransform('a4', FULL_DAY_PX).isLowScale).toBe(true);
    expect(computeTransform('a3', FULL_DAY_PX).isLowScale).toBe(false);
  });

  it('taket hindrar ett kort schema från att bli en affisch', () => {
    const t = computeTransform('a4', 214);
    expect(t.k).toBeLessThanOrEqual(K_MAX + EPS);
  });

  it('drar ned skalan igen när scenbredden klampas', () => {
    // Ett kort schema vill ha K_MAX, vilket ger en scenbredd under golvet.
    // Då måste k följa med ned så bredden fortfarande ryms.
    const t = computeTransform('a4', 214);
    const usableW = PAPER.a4.widthPt - PAPER.a4.marginPt * 2;
    expect(t.sceneWidthPx).toBe(SCENE_WIDTH_MIN_PX);
    expect(t.sceneWidthPx * PX_TO_PT * t.k).toBeLessThanOrEqual(usableW + EPS);
  });

  it('centrerar i sidled och toppjusterar i höjdled', () => {
    const t = computeTransform('a3', FULL_DAY_PX);
    const usableW = PAPER.a3.widthPt - PAPER.a3.marginPt * 2;
    const slack = usableW - t.sceneWidthPx * PX_TO_PT * t.k;
    expect(t.offsetXPt).toBeCloseTo(PAPER.a3.marginPt + slack / 2);
    expect(t.offsetYPt).toBeCloseTo(PAPER.a3.marginPt);
  });
});

describe('koordinatomvandling', () => {
  it('är affin och konsekvent mellan koordinater och längder', () => {
    const t = computeTransform('a4', FULL_DAY_PX);
    expect(toPtX(100, t) - toPtX(0, t)).toBeCloseTo(toPt(100, t));
    expect(toPtY(100, t) - toPtY(0, t)).toBeCloseTo(toPt(100, t));
    expect(toPtX(0, t)).toBeCloseTo(t.offsetXPt);
  });

  it('är identitet så när som på px→pt i digitalt läge', () => {
    const t = computeTransform('digital', FULL_DAY_PX);
    expect(toPtX(200, t)).toBeCloseTo(200 * PX_TO_PT);
    expect(toPt(14, t)).toBeCloseTo(10.5);
  });
});
