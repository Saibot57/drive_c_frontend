import { describe, expect, it } from 'vitest';
import { edgePath } from '@/utils/mindmap/mindmapLayout';
import { anchorPoint, nearestSides, routeEdge, routeToSvg, traceRoute } from './mindmapEdges';

const box = (x: number, y: number, width = 40, height = 20) => ({ x, y, width, height });

describe('anchorPoint', () => {
  it('ger mitten av varje sida', () => {
    const b = box(10, 20);
    expect(anchorPoint(b, 'top')).toEqual({ x: 30, y: 20 });
    expect(anchorPoint(b, 'bottom')).toEqual({ x: 30, y: 40 });
    expect(anchorPoint(b, 'left')).toEqual({ x: 10, y: 30 });
    expect(anchorPoint(b, 'right')).toEqual({ x: 50, y: 30 });
  });
});

describe('nearestSides', () => {
  it('höger och vänster när rutorna står isär i x-led, också långt ned', () => {
    expect(nearestSides(box(0, 0), box(80, 300))).toEqual({ from: 'right', to: 'left' });
    expect(nearestSides(box(200, 0), box(80, -300))).toEqual({ from: 'left', to: 'right' });
  });

  it('upp och ned när rutorna överlappar i x-led', () => {
    expect(nearestSides(box(0, 0), box(20, 100))).toEqual({ from: 'bottom', to: 'top' });
    expect(nearestSides(box(0, 100), box(20, 0))).toEqual({ from: 'top', to: 'bottom' });
  });

  it('kanter som möts räknas som isär', () => {
    expect(nearestSides(box(0, 0), box(40, 0))).toEqual({ from: 'right', to: 'left' });
  });
});

describe('routeEdge', () => {
  const edge = { x1: 10.5, y1: 3.25, x2: 77.125, y2: 91 };
  const start = { x: edge.x1, y: edge.y1 };
  const end = { x: edge.x2, y: edge.y2 };

  it('kurvan från höger till vänster är exakt edgePath', () => {
    const route = routeEdge({ start, startSide: 'right', end, endSide: 'left', shape: 'curve' });
    expect(routeToSvg(route)).toBe(edgePath({ fromId: 'a', toId: 'b', ...edge }));
  });

  it('kurvan från vänster till höger (vänster sida om roten) är exakt edgePath', () => {
    const e = { x1: 100, y1: 0, x2: 30, y2: -40 };
    const route = routeEdge({ start: { x: 100, y: 0 }, startSide: 'left', end: { x: 30, y: -40 }, endSide: 'right', shape: 'curve' });
    expect(routeToSvg(route)).toBe(edgePath({ fromId: 'a', toId: 'b', ...e }));
  });

  it('kurvan uppifrån och ned har styrpunkterna mitt emellan i y-led', () => {
    const route = routeEdge({ start: { x: 0, y: 0 }, startSide: 'bottom', end: { x: 40, y: 100 }, endSide: 'top', shape: 'curve' });
    expect(route[1]).toEqual({ type: 'C', c1x: 0, c1y: 50, c2x: 40, c2y: 50, x: 40, y: 100 });
  });

  it('rak linje', () => {
    expect(routeToSvg(routeEdge({ start, startSide: 'right', end, endSide: 'left', shape: 'straight' })))
      .toBe('M 10.5 3.25 L 77.125 91');
  });

  it('vinklad mellan två sidor åt sidan bryts mitt emellan i x-led', () => {
    const route = routeEdge({ start: { x: 0, y: 0 }, startSide: 'right', end: { x: 40, y: 100 }, endSide: 'left', shape: 'elbow' });
    expect(routeToSvg(route)).toBe('M 0 0 L 20 0 L 20 100 L 40 100');
  });

  it('vinklad uppifrån och ned bryts mitt emellan i y-led', () => {
    const route = routeEdge({ start: { x: 0, y: 0 }, startSide: 'bottom', end: { x: 40, y: 100 }, endSide: 'top', shape: 'elbow' });
    expect(routeToSvg(route)).toBe('M 0 0 L 0 50 L 40 50 L 40 100');
  });

  it('vinklad mellan en sida åt sidan och en uppåt har ett hörn', () => {
    expect(routeToSvg(routeEdge({ start: { x: 0, y: 0 }, startSide: 'right', end: { x: 40, y: 100 }, endSide: 'top', shape: 'elbow' })))
      .toBe('M 0 0 L 40 0 L 40 100');
    expect(routeToSvg(routeEdge({ start: { x: 0, y: 0 }, startSide: 'bottom', end: { x: 40, y: 100 }, endSide: 'left', shape: 'elbow' })))
      .toBe('M 0 0 L 0 100 L 40 100');
  });
});

describe('traceRoute', () => {
  it('ger samma kommandon på Canvas som i SVG', () => {
    const calls: string[] = [];
    const ctx = {
      moveTo: (x: number, y: number) => calls.push(`M ${x} ${y}`),
      lineTo: (x: number, y: number) => calls.push(`L ${x} ${y}`),
      bezierCurveTo: (a: number, b: number, c: number, d: number, x: number, y: number) => calls.push(`C ${a} ${b}, ${c} ${d}, ${x} ${y}`),
    };
    const curve = routeEdge({ start: { x: 1, y: 2 }, startSide: 'right', end: { x: 9, y: 7 }, endSide: 'left', shape: 'curve' });
    const elbow = routeEdge({ start: { x: 1, y: 2 }, startSide: 'right', end: { x: 9, y: 7 }, endSide: 'left', shape: 'elbow' });
    traceRoute(ctx, curve);
    traceRoute(ctx, elbow);
    expect(calls.join(' ')).toBe(`${routeToSvg(curve)} ${routeToSvg(elbow)}`);
  });
});
