/**
 * Geometrin för temahjulet.
 *
 * Motsvarar scheduleTime.ts i schemaplaneraren: ett rent lager som översätter
 * mellan datamodellen (vecka, ring) och det som ritas. Allt räknas i grader där
 * 0° är klockan tolv och vinkeln växer medurs, samt i radie från hjulets mitt.
 *
 * Ring 1 betyder samma sak i alla veckor, och ringhöjden beror på hur många
 * ringar hjulet använder. En ring som innehåller delområden delas på höjden
 * och får därför extra plats – ringar kan alltså vara olika tjocka. Måtten
 * räknas fram per hjul med buildWheelMetrics().
 */

/** Hålet i mitten där temats namn står. */
export const HUB_RADIUS = 96;
/** Ringhöjden när hjulet bara har en ring. */
export const BASE_RING_HEIGHT = 92;
/** Under detta går texten inte att läsa; då växer hjulet i stället. */
export const MIN_RING_HEIGHT = 24;
/**
 * En ring som innehåller delområden delas på höjden och behöver mer plats.
 * Efter avdrag för luften mellan ringar och mellan lanor ger 94 px ungefär
 * 54 åt arbetsområdet och 35 åt delområdet – båda över COMMENT_MIN_RING_HEIGHT,
 * så att bägge kan visa en kommentar.
 */
export const NESTED_MIN_RING_HEIGHT = 94;
/** Arbetsområdets andel av en delad ring. Delområdena delar på resten. */
export const PARENT_LANE_SHARE = 0.6;
/** Luft mellan arbetsområdets lana och delområdets. */
export const LANE_GAP_PX = 2;
/** Ringen utanför banden med veckonummer och datum. */
export const AXIS_RING_HEIGHT = 40;
/** Luft mellan ytterringen och SVG-kanten. */
export const WHEEL_PADDING = 18;

/** Luft mellan två tårtbitar, i grader. Motsvarar EVENT_GAP_PX i schemat. */
export const SECTOR_GAP_DEG = 0.45;
/** Luft mellan två ringar, i pixlar. */
export const RING_GAP_PX = 3;

const DEG_TO_RAD = Math.PI / 180;

export interface Point {
  x: number;
  y: number;
}

export interface Radii {
  inner: number;
  outer: number;
}

export interface AngleSpan {
  start: number;
  end: number;
}

/** Vilken del av ringens höjd ett block upptar. */
export type BlockLane =
  /** Hela ringen – ett arbetsområde utan delområden. */
  | 'full'
  /** Inre delen – ett arbetsområde som har delområden. */
  | 'parent'
  /** Yttre delen – ett delområde. */
  | 'child';

/** Alla mått ett hjul behöver, härledda ur antalet ringar det faktiskt använder. */
export interface WheelMetrics {
  ringCount: number;
  /** Höjd per ring. Ringar med delområden är högre än de övriga. */
  ringHeights: number[];
  /** Inre radie per ring, kumulativ eftersom höjderna kan skilja sig åt. */
  ringInner: number[];
  /** Höjden en ring utan delområden får. */
  baseRingHeight: number;
  hubRadius: number;
  /** Ytterkanten på arbetsområdenas band. */
  contentOuter: number;
  axisInner: number;
  axisOuter: number;
  /** Sidan i viewBox. Krymper med hjulet så att det alltid fyller sin yta. */
  size: number;
  center: number;
}

/**
 * Ringhöjden som andel av BASE_RING_HEIGHT: 3/(n+2) ger 100 %, 75 %, 60 %,
 * 50 % … Ringarna blir alltså tunnare ju fler de är, men inte så mycket att de
 * delar på en fast yta – bandet växer och planar ut mot tre gånger basen.
 */
export const ringHeightFor = (ringCount: number): number => {
  const rings = Math.max(ringCount, 1);
  return Math.max(MIN_RING_HEIGHT, (BASE_RING_HEIGHT * 3) / (rings + 2));
};

export const buildWheelMetrics = (
  ringCount: number,
  ringsWithChildren: ReadonlySet<number> = new Set()
): WheelMetrics => {
  const rings = Math.max(ringCount, 1);
  const baseRingHeight = ringHeightFor(rings);

  // Bara de ringar som faktiskt delas får extra höjd. Hjulet växer alltså
  // lokalt där det behövs i stället för överallt.
  const ringHeights: number[] = [];
  const ringInner: number[] = [];
  let radius = HUB_RADIUS;
  for (let ring = 0; ring < rings; ring++) {
    const height = ringsWithChildren.has(ring)
      ? Math.max(baseRingHeight, NESTED_MIN_RING_HEIGHT)
      : baseRingHeight;
    ringInner.push(radius);
    ringHeights.push(height);
    radius += height;
  }

  const contentOuter = radius;
  const axisInner = contentOuter + 2;
  const axisOuter = axisInner + AXIS_RING_HEIGHT;
  const size = (axisOuter + WHEEL_PADDING) * 2;

  return {
    ringCount: rings,
    ringHeights,
    ringInner,
    baseRingHeight,
    hubRadius: HUB_RADIUS,
    contentOuter,
    axisInner,
    axisOuter,
    size,
    center: size / 2,
  };
};

/** Avrundar så att SVG-strängarna inte fylls med sexton decimaler. */
const f = (value: number): string => value.toFixed(2);

/** Punkt på hjulet. 0° är klockan tolv, vinkeln växer medurs. */
export const polar = (metrics: WheelMetrics, radius: number, degrees: number): Point => {
  const radians = (degrees - 90) * DEG_TO_RAD;
  return {
    x: metrics.center + radius * Math.cos(radians),
    y: metrics.center + radius * Math.sin(radians),
  };
};

export const normalizeDegrees = (degrees: number): number => ((degrees % 360) + 360) % 360;

export const degreesPerWeek = (weekCount: number): number => 360 / Math.max(weekCount, 1);

/** Båglängd i pixlar. Används för att avgöra om text får plats längs bågen. */
export const arcLength = (radius: number, spanDegrees: number): number => (
  radius * spanDegrees * DEG_TO_RAD
);

/**
 * Vinkelspannet för ett block. startWeek och endWeek är hjulindex och räknas
 * inklusive i båda ändar, så ett block på enbart vecka 3 är [3, 3].
 */
export const weekSpanAngles = (
  startWeek: number,
  endWeek: number,
  weekCount: number
): AngleSpan => {
  const step = degreesPerWeek(weekCount);
  const first = Math.min(startWeek, endWeek);
  const last = Math.max(startWeek, endWeek);
  return {
    start: first * step + SECTOR_GAP_DEG,
    end: (last + 1) * step - SECTOR_GAP_DEG,
  };
};

/** Radierna för en ring, räknat från mitten och utåt. */
export const ringRadii = (metrics: WheelMetrics, ring: number): Radii => {
  const index = Math.min(Math.max(ring, 0), metrics.ringCount - 1);
  const inner = metrics.ringInner[index];
  return {
    inner: inner + RING_GAP_PX / 2,
    outer: inner + metrics.ringHeights[index] - RING_GAP_PX / 2,
  };
};

/**
 * Radierna för en lana inom en ring. Ett arbetsområde utan delområden fyller
 * hela ringen; har det delområden lägger det sig innerst och delområdena ytterst.
 */
export const laneRadii = (metrics: WheelMetrics, ring: number, lane: BlockLane): Radii => {
  const { inner, outer } = ringRadii(metrics, ring);
  if (lane === 'full') return { inner, outer };

  const split = inner + (outer - inner) * PARENT_LANE_SHARE;
  return lane === 'parent'
    ? { inner, outer: split - LANE_GAP_PX / 2 }
    : { inner: split + LANE_GAP_PX / 2, outer };
};

/** Beskriver en tårtbit (ringsegment) som en sluten SVG-path. */
export const describeSector = (
  metrics: WheelMetrics,
  innerRadius: number,
  outerRadius: number,
  startDegrees: number,
  endDegrees: number
): string => {
  const span = endDegrees - startDegrees;
  const largeArc = span > 180 ? 1 : 0;
  const outerStart = polar(metrics, outerRadius, startDegrees);
  const outerEnd = polar(metrics, outerRadius, endDegrees);
  const innerEnd = polar(metrics, innerRadius, endDegrees);
  const innerStart = polar(metrics, innerRadius, startDegrees);

  return [
    `M${f(outerStart.x)},${f(outerStart.y)}`,
    `A${f(outerRadius)},${f(outerRadius)} 0 ${largeArc} 1 ${f(outerEnd.x)},${f(outerEnd.y)}`,
    `L${f(innerEnd.x)},${f(innerEnd.y)}`,
    `A${f(innerRadius)},${f(innerRadius)} 0 ${largeArc} 0 ${f(innerStart.x)},${f(innerStart.y)}`,
    'Z',
  ].join(' ');
};

/**
 * Osynlig bana för text längs en båge. I hjulets nedre halva ritas bågen
 * baklänges, annars hamnar texten upp-och-ner.
 */
export const describeTextArc = (
  metrics: WheelMetrics,
  radius: number,
  startDegrees: number,
  endDegrees: number,
  flipped: boolean
): string => {
  const from = flipped ? endDegrees : startDegrees;
  const to = flipped ? startDegrees : endDegrees;
  const sweep = flipped ? 0 : 1;
  const largeArc = Math.abs(endDegrees - startDegrees) > 180 ? 1 : 0;
  const start = polar(metrics, radius, from);
  const end = polar(metrics, radius, to);

  return [
    `M${f(start.x)},${f(start.y)}`,
    `A${f(radius)},${f(radius)} 0 ${largeArc} ${sweep} ${f(end.x)},${f(end.y)}`,
  ].join(' ');
};

/** Text i hjulets nedre halva står upp-och-ner om bågen inte vänds. */
export const isFlippedAngle = (midDegrees: number): boolean => {
  const angle = normalizeDegrees(midDegrees);
  return angle > 90 && angle < 270;
};

/**
 * Rotationen för text som läses radiellt (utåt som en eker). Vinkeln väljs så
 * att texten aldrig står upp-och-ner, oavsett var på hjulet den hamnar.
 */
export const radialTextRotation = (midDegrees: number): number => {
  const angle = normalizeDegrees(midDegrees);
  return angle > 180 ? angle + 90 : angle - 90;
};

/** Vilken vecka en vinkel pekar på. Används när något släpps på hjulet. */
export const weekFromAngle = (degrees: number, weekCount: number): number => {
  const step = degreesPerWeek(weekCount);
  const index = Math.floor(normalizeDegrees(degrees) / step);
  return Math.min(Math.max(index, 0), weekCount - 1);
};

/** Vilken ring en radie ligger i. Utanför banden ger närmaste giltiga ring. */
export const ringFromRadius = (metrics: WheelMetrics, radius: number): number => {
  for (let ring = metrics.ringCount - 1; ring >= 0; ring--) {
    if (radius >= metrics.ringInner[ring]) return ring;
  }
  return 0;
};

/**
 * Ringen under pekaren vid ett släpp. Får bli en högre än de befintliga, så
 * att ett arbetsområde kan läggas parallellt i en vecka som redan är full.
 */
export const targetRingFromRadius = (metrics: WheelMetrics, radius: number): number => {
  if (radius >= metrics.contentOuter) return metrics.ringCount;
  return ringFromRadius(metrics, radius);
};

/** Vinkel och radie för en punkt relativt hjulets mitt. */
export const pointToPolar = (
  metrics: WheelMetrics,
  x: number,
  y: number
): { degrees: number; radius: number } => {
  const dx = x - metrics.center;
  const dy = y - metrics.center;
  return {
    degrees: normalizeDegrees(Math.atan2(dy, dx) / DEG_TO_RAD + 90),
    radius: Math.sqrt(dx * dx + dy * dy),
  };
};

/**
 * Grov bredduppskattning. Exakt mätning kräver getComputedTextLength() på ett
 * redan renderat element, vilket inte går under första ritningen.
 */
export const estimateTextWidth = (text: string, fontSize: number): number => (
  text.length * fontSize * 0.55
);

/**
 * Krymper texten så att den får plats i stället för att kapa den. Under
 * minSize lönar det sig inte längre – då är avkortning mer läsbar.
 */
export const fitFontSize = (
  text: string,
  maxWidth: number,
  preferredSize: number,
  minSize: number
): number => {
  if (!text) return preferredSize;
  const needed = maxWidth / (text.length * 0.55);
  return Math.max(minSize, Math.min(preferredSize, needed));
};

/** Kortar av med ellips när texten inte får plats. */
export const truncateToWidth = (text: string, fontSize: number, maxWidth: number): string => {
  if (estimateTextWidth(text, fontSize) <= maxWidth) return text;
  const maxChars = Math.floor(maxWidth / (fontSize * 0.55)) - 1;
  if (maxChars <= 1) return '';
  return `${text.slice(0, maxChars).trimEnd()}…`;
};
