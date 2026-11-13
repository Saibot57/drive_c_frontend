'use client';

import type { MindmapLayoutResult } from '@/utils/mindmap/mindmapLayout';
import type { MindmapDirectionArrow } from '@/hooks/useMindmapDirectionPick';

/*
 * Pilarna för riktningen för nya barn (docs/plans/mindmap-arrangera.md,
 * del B): en tydlig pil från varje nod medan man väljer, och en diskret
 * pil vid den markerade noden när den har en riktning. Bara på skärmen;
 * exporten och presentationen ritar inte lagret.
 */

/** Pilens längd utanför noden, i px vid zoom 1. */
const LENGTH = { pick: 48, set: 18, once: 18 } as const;

/** Punkten på rutans kant åt vinkeln, från mitten. */
function edgePoint(box: { x: number; y: number; width: number; height: number }, angle: number) {
  const t = (angle * Math.PI) / 180;
  const cos = Math.cos(t);
  const sin = Math.sin(t);
  const r = Math.min(
    Math.abs(cos) > 1e-9 ? box.width / 2 / Math.abs(cos) : Infinity,
    Math.abs(sin) > 1e-9 ? box.height / 2 / Math.abs(sin) : Infinity,
  );
  return { x: box.x + box.width / 2 + r * cos, y: box.y + box.height / 2 + r * sin, cos, sin };
}

export function MindmapDirectionLayer({ layout, arrows }: { layout: MindmapLayoutResult; arrows: MindmapDirectionArrow[] }) {
  if (arrows.length === 0) return null;
  return (
    <svg className="mm__dirs" width={layout.width} height={layout.height} aria-hidden="true">
      {arrows.map((arrow) => {
        const box = layout.byId.get(arrow.id);
        if (!box) return null;
        const p = edgePoint(box, arrow.angle);
        const gap = 4;
        const len = LENGTH[arrow.kind];
        const x1 = p.x + gap * p.cos;
        const y1 = p.y + gap * p.sin;
        const x2 = p.x + (gap + len) * p.cos;
        const y2 = p.y + (gap + len) * p.sin;
        // Pilspetsen: två korta streck bakåt från spetsen, 28° åt var sida.
        const head = arrow.kind === 'pick' ? 8 : 5;
        const back = ((arrow.angle + 180) * Math.PI) / 180;
        const wing = (d: number) => `${x2 + head * Math.cos(back + d)} ${y2 + head * Math.sin(back + d)}`;
        return (
          <g key={`${arrow.kind}-${arrow.id}`} className={`mm__dir mm__dir--${arrow.kind}`}>
            <path d={`M ${x1} ${y1} L ${x2} ${y2} M ${wing(0.5)} L ${x2} ${y2} L ${wing(-0.5)}`} />
          </g>
        );
      })}
    </svg>
  );
}
