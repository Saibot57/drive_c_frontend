'use client';

import { RefObject, useCallback, useEffect, useRef, useState } from 'react';
import { useHotkeys } from '@/hooks/useHotkeys';
import { PLANNER_DAYS } from '@/components/schedule/constants';
import { END_HOUR, PIXELS_PER_MINUTE, SNAP_MINUTES, START_HOUR } from '@/utils/scheduleTime';

/** Ramens läge i rullningsytans egna koordinater, inte skärmens. */
export type MarqueeRect = { left: number; top: number; width: number; height: number };

type Point = { x: number; y: number };

type MeasuredCard = {
  instanceId: string;
  left: number;
  top: number;
  right: number;
  bottom: number;
};

/** Var ramen började och var den står nu, i dagar och minuter. */
type KeyRange = {
  anchorDay: number;
  cursorDay: number;
  anchorMinutes: number;
  cursorMinutes: number;
};

/** Startpunkten som kontextmenyn ger: postens egen ruta. */
export type MarqueeSeed = {
  day: string;
  startMinutes: number;
  endMinutes: number;
};

type UseNotesMarqueeOptions = {
  /** Den rullande ytan runt rutnätet. Overlayen läggs som ett barn till den. */
  containerRef: RefObject<HTMLElement>;
  /** Kallas när ramen bekräftas, med instans-id:n som ramen nuddade. */
  onSelect: (instanceIds: string[]) => void;
};

const HOUR_STEP = 60;

const clampMinutes = (value: number) => Math.min(Math.max(value, START_HOUR * 60), END_HOUR * 60);
const clampDay = (value: number) => Math.min(Math.max(value, 0), PLANNER_DAYS.length - 1);

/**
 * Gummibandsmarkering över schemarutnätet, för att peka ut flera poster på en
 * gång. Läget slås på utifrån (kontextmenyn eller Shift+A) och tar slut vid
 * första bekräftelsen — ett mussläpp eller Enter.
 *
 * Ramen går att styra på två sätt, och de möts i samma pixelrektangel med
 * flit: musen ger den direkt, piltangenterna räknar fram den ur dagar och
 * minuter genom att mäta dagkolumnernas verkliga plats. Att i stället låta
 * tangentbordet välja poster på tid-och-dag-vis hade gett två skilda svar på
 * frågan "vad ligger i ramen" — och de hade börjat glida isär vid första
 * överlappande posten.
 *
 * Två saker till är avsiktliga och bör inte "förenklas" bort:
 *
 * Overlayen ligger *ovanpå* korten och sväljer alla pekarhändelser. Det är
 * därför korten inte börjar dras medan man markerar — dnd-kit ser aldrig något
 * pointerdown. Att i stället stänga av sensorerna är uttryckligen fel väg
 * (se kommentaren i useDragHandlers), och att lita på `dragDisabled` hade
 * fortfarande låtit klick nå kortens redigera- och raderaknappar.
 *
 * Träffbestämningen görs mot kortens verkliga DOM-rutor, inte mot tid och dag.
 * Då sköter sig kolumnuppdelningen vid överlapp av sig själv, och ett kort som
 * filtret gömt saknar DOM-nod — man kan alltså aldrig klistra in i något man
 * inte ser.
 */
export function useNotesMarquee({ containerRef, onSelect }: UseNotesMarqueeOptions) {
  const [isActive, setIsActive] = useState(false);
  const [contentSize, setContentSize] = useState<{ width: number; height: number } | null>(null);

  // Musens väg: två punkter i innehållets koordinater.
  const [origin, setOrigin] = useState<Point | null>(null);
  const [current, setCurrent] = useState<Point | null>(null);

  // Tangentbordets väg: ett dag- och minutintervall, plus rektangeln det gav.
  const [keyRange, setKeyRange] = useState<KeyRange | null>(null);
  const [keyRect, setKeyRect] = useState<MarqueeRect | null>(null);
  // Spegel av intervallet, för att kunna räkna fram nästa steg utan att göra
  // det inuti en tillståndsuppdaterare — de måste vara fria från sidoeffekter.
  const keyRangeRef = useRef<KeyRange | null>(null);

  const [markedIds, setMarkedIds] = useState<Set<string>>(() => new Set());

  // Kortens rutor mäts en gång när draget börjar. Att mäta om vid varje
  // pekarrörelse hade tvingat fram en layoutberäkning per bildruta.
  const measuredRef = useRef<MeasuredCard[]>([]);

  const reset = useCallback(() => {
    setIsActive(false);
    setOrigin(null);
    setCurrent(null);
    setKeyRange(null);
    setKeyRect(null);
    keyRangeRef.current = null;
    setContentSize(null);
    setMarkedIds(new Set());
    measuredRef.current = [];
  }, []);

  /** Skärmkoordinat -> koordinat i den rullande ytans innehåll. */
  const toContentPoint = useCallback((clientX: number, clientY: number): Point | null => {
    const el = containerRef.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    return {
      x: clientX - rect.left + el.scrollLeft,
      y: clientY - rect.top + el.scrollTop,
    };
  }, [containerRef]);

  const measureCards = useCallback((): MeasuredCard[] => {
    const el = containerRef.current;
    if (!el) return [];
    const containerRect = el.getBoundingClientRect();
    return Array.from(el.querySelectorAll<HTMLElement>('[data-instance-id]')).map(node => {
      const r = node.getBoundingClientRect();
      return {
        instanceId: node.dataset.instanceId as string,
        left: r.left - containerRect.left + el.scrollLeft,
        top: r.top - containerRect.top + el.scrollTop,
        right: r.right - containerRect.left + el.scrollLeft,
        bottom: r.bottom - containerRect.top + el.scrollTop,
      };
    });
  }, [containerRef]);

  /**
   * Räknar om dag- och minutintervallet till en rektangel. Kolumnernas plats
   * mäts i stället för att räknas fram, eftersom bredden beror på hur många
   * dagar som ritas och på om sidopanelerna är utfällda.
   */
  const rectFromRange = useCallback((range: KeyRange): MarqueeRect | null => {
    const el = containerRef.current;
    if (!el) return null;
    const containerRect = el.getBoundingClientRect();

    const dayFrom = Math.min(range.anchorDay, range.cursorDay);
    const dayTo = Math.max(range.anchorDay, range.cursorDay);
    // I mobilvyn ritas bara en dag. Kolumner som saknas hoppas över i stället
    // för att ge en rektangel med påhittad bredd.
    const columns = PLANNER_DAYS.slice(dayFrom, dayTo + 1)
      .map(day => el.querySelector<HTMLElement>(`[data-day="${day}"]`))
      .filter((node): node is HTMLElement => node !== null)
      .map(node => {
        const r = node.getBoundingClientRect();
        return {
          left: r.left - containerRect.left + el.scrollLeft,
          right: r.right - containerRect.left + el.scrollLeft,
          top: r.top - containerRect.top + el.scrollTop,
        };
      });

    if (columns.length === 0) return null;

    const left = Math.min(...columns.map(c => c.left));
    const right = Math.max(...columns.map(c => c.right));
    const columnTop = Math.min(...columns.map(c => c.top));
    const minutesFrom = Math.min(range.anchorMinutes, range.cursorMinutes);
    const minutesTo = Math.max(range.anchorMinutes, range.cursorMinutes);

    return {
      left,
      top: columnTop + (minutesFrom - START_HOUR * 60) * PIXELS_PER_MINUTE,
      width: right - left,
      height: (minutesTo - minutesFrom) * PIXELS_PER_MINUTE,
    };
  }, [containerRef]);

  const idsWithin = useCallback((selection: MarqueeRect) => {
    const right = selection.left + selection.width;
    const bottom = selection.top + selection.height;
    // Nuddar räcker — ett kort behöver inte rymmas helt i ramen. En ram utan
    // yta är fortfarande en punkt, så ett rent klick träffar kortet under.
    return measuredRef.current
      .filter(card => (
        card.left <= right && card.right >= selection.left &&
        card.top <= bottom && card.bottom >= selection.top
      ))
      .map(card => card.instanceId);
  }, []);

  /** Sätter tangentbordsramen och allt som följer av den i ett svep. */
  const applyRange = useCallback((range: KeyRange | null) => {
    keyRangeRef.current = range;
    setKeyRange(range);
    const next = range ? rectFromRange(range) : null;
    setKeyRect(next);
    setMarkedIds(new Set(next ? idsWithin(next) : []));
  }, [idsWithin, rectFromRange]);

  const start = useCallback((seed?: MarqueeSeed) => {
    const el = containerRef.current;
    if (!el) return;

    measuredRef.current = measureCards();
    setContentSize({ width: el.scrollWidth, height: el.scrollHeight });
    setOrigin(null);
    setCurrent(null);

    // Ramen börjar som postens egen ruta. Då syns det direkt var ankaret
    // sitter, och piltangenterna har något att växa ifrån.
    const dayIndex = seed ? PLANNER_DAYS.indexOf(seed.day as typeof PLANNER_DAYS[number]) : -1;
    applyRange(seed
      ? {
          anchorDay: clampDay(dayIndex >= 0 ? dayIndex : 0),
          cursorDay: clampDay(dayIndex >= 0 ? dayIndex : 0),
          anchorMinutes: clampMinutes(seed.startMinutes),
          cursorMinutes: clampMinutes(seed.endMinutes),
        }
      : null);
    setIsActive(true);
  }, [applyRange, containerRef, measureCards]);

  const cancel = useCallback(() => {
    reset();
  }, [reset]);

  /** Flyttar ramens rörliga hörn och räknar om markeringen. */
  const moveCursor = useCallback((patch: { days?: number; minutes?: number }) => {
    const prev = keyRangeRef.current;
    if (!prev) return;
    applyRange({
      ...prev,
      cursorDay: clampDay(prev.cursorDay + (patch.days ?? 0)),
      cursorMinutes: clampMinutes(prev.cursorMinutes + (patch.minutes ?? 0)),
    });
    // Musens punkter nollas: ramen har bara en förare i taget.
    setOrigin(null);
    setCurrent(null);
  }, [applyRange]);

  const pointerRect: MarqueeRect | null = origin && current
    ? {
        left: Math.min(origin.x, current.x),
        top: Math.min(origin.y, current.y),
        width: Math.abs(current.x - origin.x),
        height: Math.abs(current.y - origin.y),
      }
    : null;

  const rect = pointerRect ?? keyRect;

  const handlePointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 && event.pointerType === 'mouse') return;
    const point = toContentPoint(event.clientX, event.clientY);
    if (!point) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    measuredRef.current = measureCards();
    setKeyRange(null);
    setKeyRect(null);
    setOrigin(point);
    setCurrent(point);
    setMarkedIds(new Set(idsWithin({ left: point.x, top: point.y, width: 0, height: 0 })));
  }, [idsWithin, measureCards, toContentPoint]);

  const handlePointerMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (!origin) return;
    const point = toContentPoint(event.clientX, event.clientY);
    if (!point) return;
    setCurrent(point);
    setMarkedIds(new Set(idsWithin({
      left: Math.min(origin.x, point.x),
      top: Math.min(origin.y, point.y),
      width: Math.abs(point.x - origin.x),
      height: Math.abs(point.y - origin.y),
    })));
  }, [idsWithin, origin, toContentPoint]);

  const handlePointerUp = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (!origin) {
      // Ett släpp utan föregående tryck (t.ex. efter en avbruten gest) ska inte
      // klistra in i noll poster och låtsas att något hände. Ramen som
      // piltangenterna byggt lämnas kvar — den bekräftas med Enter.
      return;
    }
    const point = toContentPoint(event.clientX, event.clientY) ?? origin;
    const selected = idsWithin({
      left: Math.min(origin.x, point.x),
      top: Math.min(origin.y, point.y),
      width: Math.abs(point.x - origin.x),
      height: Math.abs(point.y - origin.y),
    });
    reset();
    onSelect(selected);
  }, [idsWithin, onSelect, origin, reset, toContentPoint]);

  /**
   * En avbruten gest (t.ex. ett fingerdrag som systemet tar över) får aldrig
   * bli en inklistring. Läget stängs i stället helt, som vid Esc.
   */
  const handlePointerCancel = useCallback(() => {
    reset();
  }, [reset]);

  const commitKeyboard = useCallback(() => {
    const selected = keyRect ? idsWithin(keyRect) : [];
    reset();
    onSelect(selected);
  }, [idsWithin, keyRect, onSelect, reset]);

  useHotkeys(
    isActive
      ? [
          { key: 'ArrowLeft', handler: () => moveCursor({ days: -1 }) },
          { key: 'ArrowRight', handler: () => moveCursor({ days: 1 }) },
          { key: 'h', handler: () => moveCursor({ days: -1 }) },
          { key: 'l', handler: () => moveCursor({ days: 1 }) },
          { key: 'ArrowUp', handler: () => moveCursor({ minutes: -SNAP_MINUTES }) },
          { key: 'ArrowDown', handler: () => moveCursor({ minutes: SNAP_MINUTES }) },
          { key: 'k', handler: () => moveCursor({ minutes: -SNAP_MINUTES }) },
          { key: 'j', handler: () => moveCursor({ minutes: SNAP_MINUTES }) },
          // Skoldagen är nio timmar. Med bara 15-minuterssteg blir en ram som
          // täcker hela dagen trettiosex tryck.
          { key: 'ArrowUp', shift: true, handler: () => moveCursor({ minutes: -HOUR_STEP }) },
          { key: 'ArrowDown', shift: true, handler: () => moveCursor({ minutes: HOUR_STEP }) },
          { key: 'Enter', handler: commitKeyboard },
          { key: 'Escape', handler: reset },
        ]
      : [],
    [isActive, commitKeyboard, moveCursor, reset],
  );

  // Rullar man med hjulet mitt i en tangentbordsram hamnar rektangeln fel,
  // eftersom den är räknad i innehållets koordinater vid tryckögonblicket.
  useEffect(() => {
    if (!isActive || !keyRange) return;
    const el = containerRef.current;
    if (!el) return;
    const handleScroll = () => setKeyRect(rectFromRange(keyRange));
    el.addEventListener('scroll', handleScroll);
    return () => el.removeEventListener('scroll', handleScroll);
  }, [containerRef, isActive, keyRange, rectFromRange]);

  return {
    isMarqueeActive: isActive,
    marqueeRect: rect,
    marqueeContentSize: contentSize,
    markedIds,
    startMarquee: start,
    cancelMarquee: cancel,
    marqueeHandlers: {
      onPointerDown: handlePointerDown,
      onPointerMove: handlePointerMove,
      onPointerUp: handlePointerUp,
      onPointerCancel: handlePointerCancel,
      onContextMenu: (event: React.MouseEvent) => event.preventDefault(),
    },
  };
}
