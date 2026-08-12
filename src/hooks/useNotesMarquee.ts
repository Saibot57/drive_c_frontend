'use client';

import { RefObject, useCallback, useEffect, useRef, useState } from 'react';
import { useHotkeys } from '@/hooks/useHotkeys';
import { END_HOUR, EVENT_GAP_PX, PIXELS_PER_MINUTE, SNAP_MINUTES, START_HOUR } from '@/utils/scheduleTime';

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

type ColumnBox = { day: string; left: number; right: number; top: number };

/**
 * Ramens fasta och rörliga kant. Sidled mäts i pixlar och inte i dagar, för
 * att parallella lektioner delar dagkolumnen mellan sig — och hur många
 * spalter en dag har varierar med tiden på dagen, eftersom `buildDayLayout`
 * räknar per överlappsgrupp och inte per dag.
 */
type KeyRange = {
  anchorX: number;
  cursorX: number;
  anchorMinutes: number;
  cursorMinutes: number;
};

/** Startpunkten som kontextmenyn ger: postens tid, och dess dag i sin helhet. */
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

const clampMinutes = (value: number) => Math.min(Math.max(value, START_HOUR * 60), END_HOUR * 60);

/** Två uppsättningar id:n som betyder samma markering. */
const sameSelection = (a: string[], b: Set<string>) => (
  a.length === b.size && a.every(id => b.has(id))
);

/**
 * Gummibandsmarkering över schemarutnätet, för att peka ut flera poster på en
 * gång. Läget slås på utifrån (kontextmenyn eller Shift+A) och tar slut vid
 * första bekräftelsen — ett mussläpp eller Enter.
 *
 * Ramen går att styra på två sätt, och de möts i samma pixelrektangel med
 * flit: musen ger den direkt, piltangenterna snäpper den till kortens kanter.
 * Att i stället låta tangentbordet välja poster på tid-och-dag-vis hade gett
 * två skilda svar på frågan "vad ligger i ramen" — och de hade börjat glida
 * isär vid första parallella lektionen.
 *
 * Piltangenterna stegar tills *markeringen* ändras, inte ett fast avstånd.
 * Kanterna ligger tätt — ett kort är indraget några pixlar i sin spalt, och
 * en lektions slut kan ligga mitt i nästa — så ett steg per kant hade gett
 * tryck som såg verkningslösa ut. Nu betyder ett tryck alltid en post till
 * eller en post färre, och när det inte finns fler går kanten till rutnätets
 * gräns.
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
 * Då sköter sig spaltuppdelningen vid överlapp av sig själv, och ett kort som
 * filtret gömt saknar DOM-nod — man kan alltså aldrig klistra in i något man
 * inte ser.
 */
export function useNotesMarquee({ containerRef, onSelect }: UseNotesMarqueeOptions) {
  const [isActive, setIsActive] = useState(false);
  const [contentSize, setContentSize] = useState<{ width: number; height: number } | null>(null);

  // Musens väg: två punkter i innehållets koordinater.
  const [origin, setOrigin] = useState<Point | null>(null);
  const [current, setCurrent] = useState<Point | null>(null);
  // Startpunkten speglas, av samma skäl som intervallet: rörelsen direkt efter
  // trycket får inte läsa en startpunkt som React ännu inte hunnit skriva.
  const originRef = useRef<Point | null>(null);

  // Tangentbordets väg: ett kant- och minutintervall, plus rektangeln det gav.
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
    originRef.current = null;
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

  const measureColumns = useCallback((): ColumnBox[] => {
    const el = containerRef.current;
    if (!el) return [];
    const containerRect = el.getBoundingClientRect();
    return Array.from(el.querySelectorAll<HTMLElement>('[data-day]')).map(node => {
      const r = node.getBoundingClientRect();
      return {
        day: node.dataset.day as string,
        left: r.left - containerRect.left + el.scrollLeft,
        right: r.right - containerRect.left + el.scrollLeft,
        top: r.top - containerRect.top + el.scrollTop,
      };
    });
  }, [containerRef]);

  /**
   * Räknar om intervallet till en rektangel. Kolumnernas plats mäts i stället
   * för att räknas fram, eftersom höjden beror på var rutnätet börjar.
   */
  const rectFromRange = useCallback((range: KeyRange): MarqueeRect | null => {
    const columns = measureColumns();
    if (columns.length === 0) return null;

    const columnTop = Math.min(...columns.map(column => column.top));
    const minutesFrom = Math.min(range.anchorMinutes, range.cursorMinutes);
    const minutesTo = Math.max(range.anchorMinutes, range.cursorMinutes);
    const left = Math.min(range.anchorX, range.cursorX);
    const right = Math.max(range.anchorX, range.cursorX);

    return {
      left,
      top: columnTop + (minutesFrom - START_HOUR * 60) * PIXELS_PER_MINUTE,
      width: right - left,
      height: (minutesTo - minutesFrom) * PIXELS_PER_MINUTE,
    };
  }, [measureColumns]);

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
    // Musens punkter nollas: ramen har bara en förare i taget.
    setOrigin(null);
    setCurrent(null);
    originRef.current = null;
  }, [idsWithin, rectFromRange]);

  const start = useCallback((seed?: MarqueeSeed) => {
    const el = containerRef.current;
    if (!el) return;

    measuredRef.current = measureCards();
    setContentSize({ width: el.scrollWidth, height: el.scrollHeight });

    // Ramen börjar som postens tid över dagens hela bredd, så att parallella
    // lektioner är med från start — det är den vanligaste avsikten. Vill man
    // bara åt en av spalterna smalnar man av den med vänsterpilen.
    const column = seed ? measureColumns().find(box => box.day === seed.day) : undefined;
    applyRange(seed && column
      ? {
          anchorX: column.left,
          cursorX: column.right,
          anchorMinutes: clampMinutes(seed.startMinutes),
          cursorMinutes: clampMinutes(seed.endMinutes),
        }
      : null);
    setIsActive(true);
  }, [applyRange, containerRef, measureCards, measureColumns]);

  const cancel = useCallback(() => {
    reset();
  }, [reset]);

  /**
   * Går igenom kandidatlägena i tur och ordning och stannar på det första som
   * faktiskt ändrar markeringen. Tar inget av dem det, hamnar kanten längst ut
   * — då finns det inget mer åt det hållet.
   */
  const stepUntilChanged = useCallback((
    candidates: number[],
    limit: number,
    build: (value: number) => KeyRange
  ) => {
    const currentRect = keyRangeRef.current ? rectFromRange(keyRangeRef.current) : null;
    const currentIds = new Set(currentRect ? idsWithin(currentRect) : []);

    for (const candidate of candidates) {
      const range = build(candidate);
      const rect = rectFromRange(range);
      if (!rect) continue;
      if (!sameSelection(idsWithin(rect), currentIds)) {
        applyRange(range);
        return;
      }
    }
    applyRange(build(limit));
  }, [applyRange, idsWithin, rectFromRange]);

  /**
   * Flyttar underkanten till nästa lektionskant. Kandidaterna är kortens egna
   * över- och underkanter, men bara för de kort ramen täcker i sidled — en
   * spalt man just smalnat bort ska inte styra hur långt pilen hoppar.
   */
  const stepVertical = useCallback((direction: 1 | -1) => {
    const prev = keyRangeRef.current;
    if (!prev) return;

    const columns = measureColumns();
    if (columns.length === 0) return;
    const columnTop = Math.min(...columns.map(column => column.top));
    const left = Math.min(prev.anchorX, prev.cursorX);
    const right = Math.max(prev.anchorX, prev.cursorX);

    // Kortet ritas indraget med halva mellanrummet upptill och nedtill, så
    // rutan måste kompenseras tillbaka för att ge lektionens verkliga tid.
    const toMinutes = (y: number, edge: 'top' | 'bottom') => Math.round(
      START_HOUR * 60
      + (y - columnTop + (edge === 'top' ? -EVENT_GAP_PX / 2 : EVENT_GAP_PX / 2)) / PIXELS_PER_MINUTE
    );

    const candidates = measuredRef.current
      .filter(card => card.left <= right && card.right >= left)
      .flatMap(card => [toMinutes(card.top, 'top'), toMinutes(card.bottom, 'bottom')])
      .filter(minutes => (direction === 1 ? minutes > prev.cursorMinutes : minutes < prev.cursorMinutes))
      .sort((a, b) => (direction === 1 ? a - b : b - a));

    stepUntilChanged(
      candidates,
      direction === 1 ? END_HOUR * 60 : START_HOUR * 60,
      value => ({ ...prev, cursorMinutes: clampMinutes(value) })
    );
  }, [measureColumns, stepUntilChanged]);

  /**
   * Flyttar sidokanten till nästa kortkant i stället för en hel dag, så att en
   * dag med parallella lektioner går att smalna av spalt för spalt. Saknas
   * parallella kort i tidsspannet är dagkolumnernas kanter de enda
   * kandidaterna, och ett tryck blir en hel dag precis som förut.
   */
  const stepHorizontal = useCallback((direction: 1 | -1) => {
    const prev = keyRangeRef.current;
    if (!prev) return;

    const columns = measureColumns();
    if (columns.length === 0) return;
    const columnTop = Math.min(...columns.map(column => column.top));
    const dayEdges = columns.flatMap(column => [column.left, column.right]);
    const outerLeft = Math.min(...dayEdges);
    const outerRight = Math.max(...dayEdges);

    const top = columnTop
      + (Math.min(prev.anchorMinutes, prev.cursorMinutes) - START_HOUR * 60) * PIXELS_PER_MINUTE;
    const bottom = columnTop
      + (Math.max(prev.anchorMinutes, prev.cursorMinutes) - START_HOUR * 60) * PIXELS_PER_MINUTE;

    const cardEdges = measuredRef.current
      .filter(card => card.top <= bottom && card.bottom >= top)
      .flatMap(card => [card.left, card.right]);

    const candidates = [...dayEdges, ...cardEdges]
      .filter(x => (direction === 1 ? x > prev.cursorX : x < prev.cursorX))
      .sort((a, b) => (direction === 1 ? a - b : b - a));

    stepUntilChanged(
      candidates,
      direction === 1 ? outerRight : outerLeft,
      value => ({ ...prev, cursorX: Math.min(Math.max(value, outerLeft), outerRight) })
    );
  }, [measureColumns, stepUntilChanged]);

  /** Rått steg utan snäppning: kvartar i höjd, hela dagar i sidled. */
  const nudge = useCallback((patch: { minutes?: number; days?: 1 | -1 }) => {
    const prev = keyRangeRef.current;
    if (!prev) return;

    if (patch.minutes) {
      applyRange({ ...prev, cursorMinutes: clampMinutes(prev.cursorMinutes + patch.minutes) });
      return;
    }
    if (!patch.days) return;

    const columns = measureColumns();
    if (columns.length === 0) return;
    const dayEdges = columns.flatMap(column => [column.left, column.right]);
    const outerLeft = Math.min(...dayEdges);
    const outerRight = Math.max(...dayEdges);
    const ahead = dayEdges
      .filter(x => (patch.days === 1 ? x > prev.cursorX : x < prev.cursorX))
      .sort((a, b) => (patch.days === 1 ? a - b : b - a));

    const next = ahead.length > 0 ? ahead[0] : (patch.days === 1 ? outerRight : outerLeft);
    applyRange({ ...prev, cursorX: Math.min(Math.max(next, outerLeft), outerRight) });
  }, [applyRange, measureColumns]);

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
    keyRangeRef.current = null;
    originRef.current = point;
    setOrigin(point);
    setCurrent(point);
    setMarkedIds(new Set(idsWithin({ left: point.x, top: point.y, width: 0, height: 0 })));
  }, [idsWithin, measureCards, toContentPoint]);

  const handlePointerMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const start = originRef.current;
    if (!start) return;
    const point = toContentPoint(event.clientX, event.clientY);
    if (!point) return;
    setCurrent(point);
    setMarkedIds(new Set(idsWithin({
      left: Math.min(start.x, point.x),
      top: Math.min(start.y, point.y),
      width: Math.abs(point.x - start.x),
      height: Math.abs(point.y - start.y),
    })));
  }, [idsWithin, toContentPoint]);

  const handlePointerUp = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const start = originRef.current;
    if (!start) {
      // Ett släpp utan föregående tryck (t.ex. efter en avbruten gest) ska inte
      // klistra in i noll poster och låtsas att något hände. Ramen som
      // piltangenterna byggt lämnas kvar — den bekräftas med Enter.
      return;
    }
    const point = toContentPoint(event.clientX, event.clientY) ?? start;
    const selected = idsWithin({
      left: Math.min(start.x, point.x),
      top: Math.min(start.y, point.y),
      width: Math.abs(point.x - start.x),
      height: Math.abs(point.y - start.y),
    });
    reset();
    onSelect(selected);
  }, [idsWithin, onSelect, reset, toContentPoint]);

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
          { key: 'ArrowLeft', handler: () => stepHorizontal(-1) },
          { key: 'ArrowRight', handler: () => stepHorizontal(1) },
          { key: 'h', handler: () => stepHorizontal(-1) },
          { key: 'l', handler: () => stepHorizontal(1) },
          { key: 'ArrowUp', handler: () => stepVertical(-1) },
          { key: 'ArrowDown', handler: () => stepVertical(1) },
          { key: 'k', handler: () => stepVertical(-1) },
          { key: 'j', handler: () => stepVertical(1) },
          // Shift ger det råa steget, för kanter som ska hamna mellan poster.
          { key: 'ArrowUp', shift: true, handler: () => nudge({ minutes: -SNAP_MINUTES }) },
          { key: 'ArrowDown', shift: true, handler: () => nudge({ minutes: SNAP_MINUTES }) },
          { key: 'ArrowLeft', shift: true, handler: () => nudge({ days: -1 }) },
          { key: 'ArrowRight', shift: true, handler: () => nudge({ days: 1 }) },
          { key: 'Enter', handler: commitKeyboard },
          { key: 'Escape', handler: reset },
        ]
      : [],
    [isActive, commitKeyboard, nudge, reset, stepHorizontal, stepVertical],
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
