/**
 * Ringtilldelning för temahjulet.
 *
 * Samma problem som buildDayLayout() löser i dagsschemat: poster som krockar
 * måste läggas bredvid varandra. Här är krocken överlappande veckospann och
 * "bredvid" betyder en ring längre ut från mitten.
 */

import { ThemeBlock } from '@/types/themeWheel';

/**
 * Var ett block faktiskt hamnar. Spannet är beskuret till hjulets veckor, så
 * att ett block som sträcker sig utanför (t.ex. efter att antalet veckor
 * minskats) ritas inom hjulet i stället för att svepa förbi 360°.
 */
export interface BlockPlacement {
  ring: number;
  startWeek: number;
  endWeek: number;
}

export interface RingLayout {
  /** instanceId -> placering. Block helt utanför hjulet saknas i mappen. */
  placementByBlock: Map<string, BlockPlacement>;
  /** Antal ringar hjulet behöver. Styr ringhöjden i buildWheelMetrics(). */
  ringCount: number;
}

/** Blocket beskuret till hjulets veckor, eller null om det hamnar helt utanför. */
const clampToWheel = (block: ThemeBlock, weekCount: number) => {
  const first = Math.min(block.startWeek, block.endWeek);
  const last = Math.max(block.startWeek, block.endWeek);
  const start = Math.max(first, 0);
  const end = Math.min(last, weekCount - 1);
  if (start > end) return null;
  return { start, end };
};

/**
 * Lägger varje block i lägsta lediga ring. Block med ett eget ring-värde får
 * behålla det när ringen är fri, så att en manuell placering inte flyttas runt
 * av grannar som kommer till efteråt.
 */
export const buildRingLayout = (blocks: ThemeBlock[], weekCount: number): RingLayout => {
  const placementByBlock = new Map<string, BlockPlacement>();
  if (weekCount <= 0) return { placementByBlock, ringCount: 1 };

  /** ringindex -> upptagna veckor. */
  const occupancy: boolean[][] = [];

  const isFree = (ring: number, start: number, end: number): boolean => {
    const weeks = occupancy[ring];
    if (!weeks) return true;
    for (let week = start; week <= end; week++) {
      if (weeks[week]) return false;
    }
    return true;
  };

  const occupy = (ring: number, start: number, end: number) => {
    if (!occupancy[ring]) {
      occupancy[ring] = new Array<boolean>(weekCount).fill(false);
    }
    for (let week = start; week <= end; week++) {
      occupancy[ring][week] = true;
    }
  };

  const placeable = blocks
    .map(block => ({ block, span: clampToWheel(block, weekCount) }))
    .filter((item): item is { block: ThemeBlock; span: { start: number; end: number } } => (
      item.span !== null
    ));

  // Manuellt placerade block först, annars kan ett automatiskt block hinna ta
  // ringen och tvinga bort det som användaren själv lagt där.
  const manual = placeable.filter(item => typeof item.block.ring === 'number');
  const automatic = placeable.filter(item => typeof item.block.ring !== 'number');

  manual
    .sort((a, b) => (a.block.ring ?? 0) - (b.block.ring ?? 0) || a.span.start - b.span.start)
    .forEach(({ block, span }) => {
      const wanted = Math.max(block.ring ?? 0, 0);
      let ring = wanted;
      while (!isFree(ring, span.start, span.end)) ring++;
      occupy(ring, span.start, span.end);
      placementByBlock.set(block.instanceId, { ring, startWeek: span.start, endWeek: span.end });
    });

  // Långa spann först: de har minst frihet och skulle annars trycka ut korta
  // block i onödigt höga ringar.
  automatic
    .sort((a, b) => (
      a.span.start - b.span.start
      || (b.span.end - b.span.start) - (a.span.end - a.span.start)
      || a.block.title.localeCompare(b.block.title, 'sv')
    ))
    .forEach(({ block, span }) => {
      let ring = 0;
      while (!isFree(ring, span.start, span.end)) ring++;
      occupy(ring, span.start, span.end);
      placementByBlock.set(block.instanceId, { ring, startWeek: span.start, endWeek: span.end });
    });

  return {
    placementByBlock,
    ringCount: Math.max(occupancy.length, 1),
  };
};

/** Antal arbetsveckor per arbetsområde, lov borträknat. Underlag för statistik. */
export const weeksPerArea = (
  blocks: ThemeBlock[],
  weekCount: number,
  holidayWeeks: number[]
): [string, number][] => {
  const holidays = new Set(holidayWeeks);
  const totals = new Map<string, number>();

  blocks.forEach(block => {
    const span = clampToWheel(block, weekCount);
    if (!span) return;
    let weeks = 0;
    for (let week = span.start; week <= span.end; week++) {
      if (!holidays.has(week)) weeks++;
    }
    totals.set(block.title, (totals.get(block.title) ?? 0) + weeks);
  });

  return Array.from(totals.entries()).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'sv'));
};
