import type { MindmapNode } from '@/types/mindmap';
import type { MindmapCrossLink, MindmapDoc } from '@/types/mindmapDoc';
import type { MindmapLayoutResult } from '@/utils/mindmap/mindmapLayout';
import { findNode, labelOneLine } from '@/utils/mindmap/mindmapTree';
import {
  anchorPointOut,
  nearestSides,
  routeEdge,
  routeEnds,
  routeMidpoint,
  routeToSvg,
  type EdgeRoute,
} from '@/utils/mindmapEdges';

/*
 * Tvärlänkarnas form: var kurvan börjar och slutar, hur den böjer och var
 * pilen och etiketten sitter. En enda ren funktion, som både SVG-lagret på
 * skärmen och bildexporten använder, så att bilden blir det man ser.
 * Reglerna för vilka länkar som får finnas ligger i mindmapDoc.ts.
 *
 * Planen: docs/plans/mindmap-sida.md, steg 6.
 */

export interface CrossLinkPoint {
  x: number;
  y: number;
}

export interface CrossLinkShape {
  id: string;
  link: MindmapCrossLink;
  /** Noderna kurvan ritas mellan: länkens egna, eller närmaste synliga förfader till en gömd. */
  fromId: string;
  toId: string;
  start: CrossLinkPoint;
  control: CrossLinkPoint;
  end: CrossLinkPoint;
  /** Kurvans mitt, där etiketten står. */
  middle: CrossLinkPoint;
  /** En triangel per pil. */
  heads: CrossLinkPoint[][];
  /**
   * Länkens väg när den har en form (del C i mindmap-placering.md). Saknas
   * den är länken den böjda kurvan genom `control`.
   */
  route?: EdgeRoute;
}

/** Luft mellan nodens kant och kurvans ände. */
const GAP = 4;
const HEAD_LENGTH = 9;
const HEAD_WIDTH = 7;

/**
 * Var en stråle från rutans mitt mot `toward` lämnar rutan, plus lite luft.
 * Noderna är pillerformade men räknas som rektanglar; skillnaden syns inte.
 */
function edgePoint(
  box: { x: number; y: number; width: number; height: number },
  toward: CrossLinkPoint,
): CrossLinkPoint {
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  const dx = toward.x - cx;
  const dy = toward.y - cy;
  const length = Math.hypot(dx, dy);
  if (length === 0) return { x: cx, y: cy };
  const reach = Math.min(
    dx === 0 ? Infinity : box.width / 2 / Math.abs(dx),
    dy === 0 ? Infinity : box.height / 2 / Math.abs(dy),
  );
  const scale = reach + GAP / length;
  return { x: cx + dx * scale, y: cy + dy * scale };
}

/** En pil med spetsen i `tip`, riktad bort från `from`. */
function arrowHead(tip: CrossLinkPoint, from: CrossLinkPoint): CrossLinkPoint[] {
  const dx = tip.x - from.x;
  const dy = tip.y - from.y;
  const length = Math.hypot(dx, dy) || 1;
  const ux = dx / length;
  const uy = dy / length;
  const baseX = tip.x - ux * HEAD_LENGTH;
  const baseY = tip.y - uy * HEAD_LENGTH;
  return [
    tip,
    { x: baseX - uy * (HEAD_WIDTH / 2), y: baseY + ux * (HEAD_WIDTH / 2) },
    { x: baseX + uy * (HEAD_WIDTH / 2), y: baseY - ux * (HEAD_WIDTH / 2) },
  ];
}

/**
 * Formen för varje tvärlänk som ska ritas, i layoutens koordinater.
 *
 * Nodernas rutor läses ur layouten, alltså efter manuella förskjutningar. En
 * ände i en hopfälld gren flyttas till närmaste synliga förfader. En länk
 * vars båda ändar då hamnar på samma nod, eller på förälder och barn, ritas
 * inte: den hade legat på noden eller på kanten mellan dem.
 */
export function crossLinkGeometry(layout: MindmapLayoutResult, doc: MindmapDoc): CrossLinkShape[] {
  const links = doc.crossLinks ?? [];
  if (links.length === 0) return [];

  /** Nod-id till den nod som syns i dess ställe, och till förälderns id. */
  const anchors = new Map<string, string>();
  const parents = new Map<string, string>();
  const walk = (node: MindmapNode, anchor: string) => {
    const own = layout.byId.has(node.id) ? node.id : anchor;
    anchors.set(node.id, own);
    node.children.forEach((child) => {
      parents.set(child.id, node.id);
      walk(child, own);
    });
  };
  walk(doc.root, doc.root.id);

  const shapes: CrossLinkShape[] = [];
  links.forEach((link) => {
    const fromId = anchors.get(link.from);
    const toId = anchors.get(link.to);
    if (!fromId || !toId || fromId === toId) return;
    if (parents.get(fromId) === toId || parents.get(toId) === fromId) return;
    const from = layout.byId.get(fromId);
    const to = layout.byId.get(toId);
    if (!from || !to) return;

    const arrow = link.arrow ?? 'to';
    if (link.shape) {
      // En form: samma linjer som grenarna, från de fästen som valts eller
      // de sidor som vetter mot varandra.
      const auto = nearestSides(from, to);
      const fromSide = link.fromAnchor ?? auto.from;
      const toSide = link.toAnchor ?? auto.to;
      const route = routeEdge({
        start: anchorPointOut(from, fromSide, GAP),
        startSide: fromSide,
        end: anchorPointOut(to, toSide, GAP),
        endSide: toSide,
        shape: link.shape,
      });
      const ends = routeEnds(route);
      const routeHeads: CrossLinkPoint[][] = [];
      if (arrow !== 'none') routeHeads.push(arrowHead(ends.end, ends.endFrom));
      if (arrow === 'both') routeHeads.push(arrowHead(ends.start, ends.startFrom));
      shapes.push({
        id: link.id,
        link,
        fromId,
        toId,
        start: ends.start,
        control: routeMidpoint(route),
        end: ends.end,
        middle: routeMidpoint(route),
        heads: routeHeads,
        route,
      });
      return;
    }

    const a = { x: from.x + from.width / 2, y: from.y + from.height / 2 };
    const b = { x: to.x + to.width / 2, y: to.y + to.height / 2 };
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const distance = Math.hypot(dx, dy);
    if (distance === 0) return;
    // Kurvan böjer åt sidan, så att den inte ligger på trädets kanter. Sidan
    // beror på nodernas id och inte på riktningen: en vänd länk ligger kvar.
    const bend = Math.min(70, Math.max(18, distance * 0.18)) * (fromId < toId ? 1 : -1);
    const control = { x: (a.x + b.x) / 2 - (dy / distance) * bend, y: (a.y + b.y) / 2 + (dx / distance) * bend };
    // Ett valt fäste vid en ände flyttar dit; kurvan böjer som förut.
    const start = link.fromAnchor ? anchorPointOut(from, link.fromAnchor, GAP) : edgePoint(from, control);
    const end = link.toAnchor ? anchorPointOut(to, link.toAnchor, GAP) : edgePoint(to, control);
    const heads: CrossLinkPoint[][] = [];
    if (arrow !== 'none') heads.push(arrowHead(end, control));
    if (arrow === 'both') heads.push(arrowHead(start, control));

    shapes.push({
      id: link.id,
      link,
      fromId,
      toId,
      start,
      control,
      end,
      middle: {
        x: 0.25 * start.x + 0.5 * control.x + 0.25 * end.x,
        y: 0.25 * start.y + 0.5 * control.y + 0.25 * end.y,
      },
      heads,
    });
  });
  return shapes;
}

/** Kurvan som SVG-väg. */
export const crossLinkPath = (shape: CrossLinkShape): string =>
  shape.route
    ? routeToSvg(shape.route)
    : `M ${shape.start.x} ${shape.start.y} Q ${shape.control.x} ${shape.control.y} ${shape.end.x} ${shape.end.y}`;

export const crossLinkHeadPoints = (head: CrossLinkPoint[]): string =>
  head.map((point) => `${point.x},${point.y}`).join(' ');

/* ── Dispositionen ── */

const ARROW_TEXT: Record<NonNullable<MindmapCrossLink['arrow']>, string> = { to: '→', both: '↔', none: '–' };

const escapeHtml = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** En rad per tvärlänk, "A → B: etikett". Länkar till en nod utan text hoppas över. */
export function crossLinkLines(doc: MindmapDoc): string[] {
  const lines: string[] = [];
  (doc.crossLinks ?? []).forEach((link) => {
    const from = findNode(doc.root, link.from)?.label;
    const to = findNode(doc.root, link.to)?.label;
    if (from === undefined || to === undefined) return;
    const fromText = labelOneLine(from);
    const toText = labelOneLine(to);
    if (!fromText || !toText) return;
    const label = link.label?.trim();
    lines.push(`${fromText} ${ARROW_TEXT[link.arrow ?? 'to']} ${toText}${label ? `: ${label}` : ''}`);
  });
  return lines;
}

/** Tvärlänkarna sist i dispositionen, som text och som HTML. Tomma strängar när kartan inte har några. */
export function crossLinkOutline(doc: MindmapDoc): { text: string; html: string } {
  const lines = crossLinkLines(doc);
  if (lines.length === 0) return { text: '', html: '' };
  return {
    text: `\n\nLänkar:\n${lines.map((line) => `- ${line}`).join('\n')}`,
    html: `<p><strong>Länkar</strong></p><ul>${lines.map((line) => `<li>${escapeHtml(line)}</li>`).join('')}</ul>`,
  };
}

/* ── Tangenten ── */

/** Ctrl+L (Cmd+L på Mac) börjar en tvärlänk från den markerade noden. */
export function isCrossLinkKey(e: { key: string; ctrlKey: boolean; metaKey: boolean; altKey: boolean; shiftKey: boolean }): boolean {
  return (e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === 'l';
}
