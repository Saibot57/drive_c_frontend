/**
 * Ringtilldelning för temahjulet.
 *
 * Samma problem som buildDayLayout() löser i dagsschemat: poster som krockar
 * måste läggas bredvid varandra. Här är krocken överlappande veckospann och
 * "bredvid" betyder en ring längre ut från mitten.
 *
 * Delområden räknas inte med i ringpackningen. De ärver sin förälders ring och
 * ritas inuti dess band i stället, så att hjulet inte får en ny ring bara för
 * att ett arbetsområde delas upp.
 */

import { ThemeBlock } from '@/types/themeWheel';
import { BlockLane } from '@/utils/themeWheelGeometry';

export type { BlockLane };

/**
 * Var ett block faktiskt hamnar. Spannet är beskuret till hjulets veckor, så
 * att ett block som sträcker sig utanför (t.ex. efter att antalet veckor
 * minskats) ritas inom hjulet i stället för att svepa förbi 360°.
 */
export interface BlockPlacement {
  ring: number;
  lane: BlockLane;
  startWeek: number;
  endWeek: number;
}

export interface RingLayout {
  /** instanceId -> placering. Block helt utanför hjulet saknas i mappen. */
  placementByBlock: Map<string, BlockPlacement>;
  /** Antal ringar hjulet behöver. Styr ringhöjden i buildWheelMetrics(). */
  ringCount: number;
  /** Ringar som innehåller delområden och därför behöver extra höjd. */
  ringsWithChildren: Set<number>;
}

type Span = { start: number; end: number };

/** Blocket beskuret till hjulets veckor, eller null om det hamnar helt utanför. */
const clampToWheel = (block: ThemeBlock, weekCount: number): Span | null => {
  const first = Math.min(block.startWeek, block.endWeek);
  const last = Math.max(block.startWeek, block.endWeek);
  const start = Math.max(first, 0);
  const end = Math.min(last, weekCount - 1);
  if (start > end) return null;
  return { start, end };
};

/** Beskär ett delområde till förälderns spann. Utanför helt ger null. */
const clampToParent = (span: Span, parent: Span): Span | null => {
  const start = Math.max(span.start, parent.start);
  const end = Math.min(span.end, parent.end);
  if (start > end) return null;
  return { start, end };
};

/**
 * Lägger varje arbetsområde i lägsta lediga ring, och varje delområde i sin
 * förälders ring. Block med ett eget ring-värde får behålla det när ringen är
 * fri, så att en manuell placering inte flyttas runt av grannar som kommer
 * till efteråt.
 */
export const buildRingLayout = (blocks: ThemeBlock[], weekCount: number): RingLayout => {
  const placementByBlock = new Map<string, BlockPlacement>();
  const ringsWithChildren = new Set<number>();
  if (weekCount <= 0) {
    return { placementByBlock, ringCount: 1, ringsWithChildren };
  }

  const byId = new Map(blocks.map(block => [block.instanceId, block]));

  /**
   * Ett delområde måste peka på ett arbetsområde som finns och som inte självt
   * är ett delområde – bara en nivå tillåts. Pekar det fel behandlas blocket
   * som ett vanligt arbetsområde, så att inget tyst försvinner ur hjulet.
   */
  const parentOf = (block: ThemeBlock): ThemeBlock | null => {
    if (!block.parentId || block.parentId === block.instanceId) return null;
    const parent = byId.get(block.parentId);
    if (!parent || parent.parentId) return null;
    return parent;
  };

  const parents: { block: ThemeBlock; span: Span }[] = [];
  const children: { block: ThemeBlock; span: Span; parent: ThemeBlock }[] = [];

  blocks.forEach(block => {
    const span = clampToWheel(block, weekCount);
    if (!span) return;
    const parent = parentOf(block);
    if (parent) children.push({ block, span, parent });
    else parents.push({ block, span });
  });

  const hasChildren = new Set(children.map(item => item.parent.instanceId));

  // --- Arbetsområdena packas i ringar, precis som tidigare ---

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

  const place = (block: ThemeBlock, span: Span, from: number) => {
    let ring = from;
    while (!isFree(ring, span.start, span.end)) ring++;
    occupy(ring, span.start, span.end);
    placementByBlock.set(block.instanceId, {
      ring,
      lane: hasChildren.has(block.instanceId) ? 'parent' : 'full',
      startWeek: span.start,
      endWeek: span.end,
    });
    if (hasChildren.has(block.instanceId)) ringsWithChildren.add(ring);
  };

  // Manuellt placerade block först, annars kan ett automatiskt block hinna ta
  // ringen och tvinga bort det som användaren själv lagt där.
  parents
    .filter(item => typeof item.block.ring === 'number')
    .sort((a, b) => (a.block.ring ?? 0) - (b.block.ring ?? 0) || a.span.start - b.span.start)
    .forEach(({ block, span }) => place(block, span, Math.max(block.ring ?? 0, 0)));

  // Långa spann först: de har minst frihet och skulle annars trycka ut korta
  // block i onödigt höga ringar.
  parents
    .filter(item => typeof item.block.ring !== 'number')
    .sort((a, b) => (
      a.span.start - b.span.start
      || (b.span.end - b.span.start) - (a.span.end - a.span.start)
      || a.block.title.localeCompare(b.block.title, 'sv')
    ))
    .forEach(({ block, span }) => place(block, span, 0));

  // --- Delområdena ärver förälderns ring ---

  children
    .sort((a, b) => a.span.start - b.span.start)
    .forEach(({ block, span, parent }) => {
      const parentPlacement = placementByBlock.get(parent.instanceId);
      if (!parentPlacement) return;
      const bounded = clampToParent(span, {
        start: parentPlacement.startWeek,
        end: parentPlacement.endWeek,
      });
      if (!bounded) return;
      placementByBlock.set(block.instanceId, {
        ring: parentPlacement.ring,
        lane: 'child',
        startWeek: bounded.start,
        endWeek: bounded.end,
      });
    });

  return {
    placementByBlock,
    ringCount: Math.max(occupancy.length, 1),
    ringsWithChildren,
  };
};

/**
 * Arbetsområdet som ligger i en viss ring och vecka, om något gör det.
 *
 * Det är det block ett släpp där skulle hamna inuti: både planeraren, som
 * skapar delområdet, och hjulet, som ritar spöket under draget, måste komma
 * fram till samma svar.
 */
export const hostBlockAt = (
  blocks: ThemeBlock[],
  placementByBlock: Map<string, BlockPlacement>,
  ring: number,
  week: number,
  ignoreInstanceId?: string
): ThemeBlock | null => (
  blocks.find(block => {
    if (block.instanceId === ignoreInstanceId) return false;
    const placement = placementByBlock.get(block.instanceId);
    return Boolean(placement
      && placement.lane !== 'child'
      && placement.ring === ring
      && week >= placement.startWeek
      && week <= placement.endWeek);
  }) ?? null
);

/** Delområdena som hör till ett visst arbetsområde. */
export const childrenOf = (blocks: ThemeBlock[], parentId: string): ThemeBlock[] => (
  blocks.filter(block => block.parentId === parentId)
);

/**
 * Veckorna inom föräldern som inte redan täcks av ett delområde. Används när
 * ett nytt delområde ska placeras, eftersom delområden inte får överlappa.
 */
export const freeWeeksInParent = (
  blocks: ThemeBlock[],
  parent: ThemeBlock,
  ignoreInstanceId?: string
): number[] => {
  const taken = new Set<number>();
  childrenOf(blocks, parent.instanceId).forEach(child => {
    if (child.instanceId === ignoreInstanceId) return;
    for (let week = child.startWeek; week <= child.endWeek; week++) taken.add(week);
  });

  const free: number[] = [];
  for (let week = parent.startWeek; week <= parent.endWeek; week++) {
    if (!taken.has(week)) free.push(week);
  }
  return free;
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
