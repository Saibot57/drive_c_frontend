'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { MindmapAnchor, MindmapColor, MindmapEdgeShape } from '@/types/mindmap';
import type { MindmapCrossLink, MindmapDoc } from '@/types/mindmapDoc';
import type { MindmapLayoutResult } from '@/utils/mindmap/mindmapLayout';
import { findNode } from '@/utils/mindmap/mindmapTree';
import {
  crossLinkGeometry,
  isCrossLinkKey,
  type CrossLinkPoint,
  type CrossLinkShape,
} from '@/utils/mindmapCrossLinks';
import {
  addCrossLink,
  removeCrossLink,
  reverseCrossLink,
  setCrossLinkAnchor,
  setCrossLinkArrow,
  setCrossLinkColor,
  setCrossLinkShape,
  setCrossLinkLabel,
} from '@/utils/mindmapDoc';
import { isEditableElement } from '@/utils/dom';

/*
 * Tvärlänkarna på Mindmap-sidan: vilken länk som är markerad, läget "välj
 * noden länken ska gå till" (Ctrl+L) och linjen som dras med Shift+dra.
 * Reglerna och formerna är rena funktioner (mindmapDoc, mindmapCrossLinks);
 * allt som ändrar kartan går genom kartans `commit`, så att det hamnar i
 * ångra-historiken.
 */

const ARROW_KEYS = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);

const NOT_ALLOWED = 'Den länken går inte att göra: inte till samma nod, inte mellan förälder och barn, och bara en per par.';

interface Options {
  mapId: string;
  doc: MindmapDoc;
  /** Det senaste dokumentet, också mellan två ritningar. */
  docRef: React.MutableRefObject<MindmapDoc>;
  layout: MindmapLayoutResult;
  commit: (next: MindmapDoc, historyKey?: string | null) => void;
  flash: (text: string, tone?: 'success' | 'error') => void;
  focusMap: () => void;
  /** Den markerade noden, eller roten. */
  currentId: () => string;
  /** En punkt på skärmen till layoutens koordinater (samma som SVG-lagret). */
  toLayoutPoint: (clientX: number, clientY: number) => CrossLinkPoint;
  /** Noden under en punkt på skärmen, om det finns någon. */
  nodeAt: (clientX: number, clientY: number) => string | null;
}

export interface MindmapLinks {
  shapes: CrossLinkShape[];
  selected: MindmapCrossLink | null;
  /** Noden en länk håller på att göras från (Ctrl+L eller Shift+dra). */
  linkFrom: string | null;
  draft: { from: CrossLinkPoint; to: CrossLinkPoint } | null;
  /** Byts när etikettfältet ska få fokus. */
  labelFocusTick: number;
  select: (id: string | null) => void;
  editLabel: (id: string) => void;
  /** Börjar en länk från noden; nästa klick eller Enter avslutar den. */
  start: (fromId: string) => void;
  /** Avslutar länken som börjats på noden. Sant om en länk blev till. */
  finish: (toId: string) => boolean;
  /** Shift+dra från en nod. */
  beginDrag: (e: React.PointerEvent, fromId: string) => void;
  /** Tangenter som rör länkar. Sant om tangenten är förbrukad. */
  handleKey: (e: React.KeyboardEvent) => boolean;
  setLabel: (label: string) => void;
  setArrow: (arrow: NonNullable<MindmapCrossLink['arrow']>) => void;
  setColor: (color: MindmapColor | null) => void;
  setShape: (shape: MindmapEdgeShape | null) => void;
  setAnchor: (end: 'from' | 'to', side: MindmapAnchor | null) => void;
  reverse: () => void;
  remove: () => void;
}

export function useMindmapLinks({
  mapId,
  doc,
  docRef,
  layout,
  commit,
  flash,
  focusMap,
  currentId,
  toLayoutPoint,
  nodeAt,
}: Options): MindmapLinks {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [linkFrom, setLinkFrom] = useState<string | null>(null);
  const [draft, setDraft] = useState<MindmapLinks['draft']>(null);
  const [labelFocusTick, setLabelFocusTick] = useState(0);
  const selectedRef = useRef<string | null>(null);
  const linkFromRef = useRef<string | null>(null);

  const select = useCallback((id: string | null) => {
    selectedRef.current = id;
    setSelectedId(id);
  }, []);

  const setFrom = useCallback((id: string | null) => {
    linkFromRef.current = id;
    setLinkFrom(id);
  }, []);

  // En annan karta: markering och påbörjad länk hör till den förra.
  useEffect(() => {
    select(null);
    setFrom(null);
    setDraft(null);
  }, [mapId, select, setFrom]);

  const shapes = useMemo(() => crossLinkGeometry(layout, doc), [layout, doc]);
  // Länken kan ha försvunnit (ångra, borttagen nod); då är ingen markerad.
  const selected = useMemo(
    () => (selectedId ? (doc.crossLinks ?? []).find((link) => link.id === selectedId) ?? null : null),
    [doc.crossLinks, selectedId],
  );

  const connect = useCallback((fromId: string, toId: string): boolean => {
    const result = addCrossLink(docRef.current, fromId, toId);
    if (!result) {
      flash(NOT_ALLOWED, 'error');
      return false;
    }
    commit(result.doc);
    // Den nya länken är markerad, så att etikett och färg går att sätta direkt.
    select(result.id);
    return true;
  }, [commit, docRef, flash, select]);

  const start = useCallback((fromId: string) => {
    if (!findNode(docRef.current.root, fromId)) return;
    select(null);
    setFrom(fromId);
  }, [docRef, select, setFrom]);

  const finish = useCallback((toId: string): boolean => {
    const fromId = linkFromRef.current;
    if (!fromId) return false;
    setFrom(null);
    const made = connect(fromId, toId);
    focusMap();
    return made;
  }, [connect, focusMap, setFrom]);

  const beginDrag = useCallback((e: React.PointerEvent, fromId: string) => {
    const box = layout.byId.get(fromId);
    if (!box) return;
    const from = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    const pointerId = e.pointerId;
    select(null);
    setFrom(fromId);
    setDraft({ from, to: toLayoutPoint(e.clientX, e.clientY) });

    const handleMove = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId) return;
      setDraft({ from, to: toLayoutPoint(ev.clientX, ev.clientY) });
    };
    const handleUp = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId) return;
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
      window.removeEventListener('pointercancel', handleUp);
      setDraft(null);
      setFrom(null);
      if (ev.type === 'pointercancel') return;
      const target = nodeAt(ev.clientX, ev.clientY);
      // Släpp på tom yta eller på noden själv: ingen länk, inget fel.
      if (target && target !== fromId) connect(fromId, target);
      focusMap();
    };
    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
    window.addEventListener('pointercancel', handleUp);
  }, [connect, focusMap, layout, nodeAt, select, setFrom, toLayoutPoint]);

  const change = useCallback((update: (d: MindmapDoc, id: string) => MindmapDoc, historyKey: string | null = null) => {
    const id = selectedRef.current;
    if (!id) return;
    const next = update(docRef.current, id);
    if (next !== docRef.current) commit(next, historyKey ? `${historyKey}:${id}` : null);
  }, [commit, docRef]);

  const remove = useCallback(() => {
    change((d, id) => removeCrossLink(d, id));
    select(null);
    focusMap();
  }, [change, focusMap, select]);

  const editLabel = useCallback((id: string) => {
    select(id);
    setLabelFocusTick((tick) => tick + 1);
  }, [select]);

  const handleKey = useCallback((e: React.KeyboardEvent): boolean => {
    if (isCrossLinkKey(e.nativeEvent)) {
      // Ctrl+L är annars webbläsarens adressfält.
      e.preventDefault();
      e.stopPropagation();
      start(currentId());
      return true;
    }
    if (isEditableElement(e.target)) return false;

    if (linkFromRef.current) {
      const plain = !e.ctrlKey && !e.metaKey && !e.altKey;
      // Pilarna går mellan noderna som vanligt; kartan tar dem.
      if (plain && !e.shiftKey && ARROW_KEYS.has(e.key)) return false;
      e.preventDefault();
      e.stopPropagation();
      if (e.key === 'Escape') setFrom(null);
      else if (e.key === 'Enter' && plain) finish(currentId());
      // Allt annat sväljs: ett tecken hade annars skrivit över den markerade noden.
      return true;
    }

    if (selectedRef.current) {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        e.stopPropagation();
        remove();
        return true;
      }
      if (e.key === 'Enter' || e.key === 'F2') {
        e.preventDefault();
        e.stopPropagation();
        setLabelFocusTick((tick) => tick + 1);
        return true;
      }
      // Modifierare ensamma (Ctrl inför Ctrl+Z) ska inte avmarkera länken.
      if (!['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) select(null);
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        return true;
      }
    }
    return false;
  }, [currentId, finish, remove, select, setFrom, start]);

  return {
    shapes,
    selected,
    linkFrom,
    draft,
    labelFocusTick,
    select,
    editLabel,
    start,
    finish,
    beginDrag,
    handleKey,
    setLabel: (label) => change((d, id) => setCrossLinkLabel(d, id, label), 'link-label'),
    setArrow: (arrow) => change((d, id) => setCrossLinkArrow(d, id, arrow)),
    setColor: (color) => change((d, id) => setCrossLinkColor(d, id, color)),
    setShape: (shape) => change((d, id) => setCrossLinkShape(d, id, shape)),
    setAnchor: (end, side) => change((d, id) => setCrossLinkAnchor(d, id, end, side)),
    reverse: () => change((d, id) => reverseCrossLink(d, id)),
    remove,
  };
}
