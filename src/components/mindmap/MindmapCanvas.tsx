'use client';

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { MindmapColor, MindmapContent, MindmapLayout } from '@/types/mindmap';
import { MINDMAP_COLORS } from '@/types/mindmap';
import type { MindmapDoc } from '@/types/mindmapDoc';
import {
  addChild,
  addChildren,
  addSibling,
  canMoveNode,
  findNode,
  findParent,
  indent,
  moveAmongSiblings,
  moveNode,
  navigate,
  outdent,
  setColor,
  setLabel,
  setLayout,
  sideOf,
  toggleCollapsed,
} from '@/utils/mindmap/mindmapTree';
import { breakCoalescing, emptyHistory, recordChange, redo, undo } from '@/utils/mindmap/mindmapHistory';
import { resolveMindmapKey, type MindmapAction, type MindmapMode } from '@/utils/mindmap/mindmapKeys';
import { edgePath, layoutMindmap, MINDMAP_METRICS, type MeasureText } from '@/utils/mindmap/mindmapLayout';
import { parseOutlineHtml, parseOutlineText } from '@/utils/mindmap/mindmapOutline';
import { toOutlineHtml, toOutlineText, type OutlineStyle } from '@/utils/mindmap/mindmapOutline';
import { canvasToPng, renderMindmapCanvas, type MindmapPalette } from '@/utils/mindmap/mindmapDraw';
import { removeNodeFromDoc } from '@/utils/mindmapDoc';
import { panBy, resolveViewportKey, type MindmapRect } from '@/utils/mindmapViewport';
import { useMindmapViewport } from '@/hooks/useMindmapViewport';
import { downloadBlob, toFileSlug } from '@/utils/download';
import { isEditableElement } from '@/utils/dom';
import { MindmapMinimap } from './MindmapMinimap';
import MindmapToolbar, { type MindmapExportKind, type MindmapMenu } from './MindmapToolbar';
import { MindmapZoom } from './MindmapZoom';

interface MindmapCanvasProps {
  /** Kartans id. Byts det nollställs markering och ångra-historik. */
  mapId: string;
  doc: MindmapDoc;
  /** Kartans namn, till filnamnet vid nedladdning. */
  title: string;
  onChange: (doc: MindmapDoc) => void;
  /** Visas i verktygsraden, till höger: sparstatus och kartans namn. */
  status?: React.ReactNode;
}

/** Visas i en tom nod som inte redigeras. */
const PLACEHOLDER = 'Ny nod';

/** Så långt måste pekaren röra sig innan ett klick blir ett drag. */
const DRAG_THRESHOLD_PX = 5;

const NOTICE_MS = 3200;

const useIsomorphicLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

type Notice = { text: string; tone: 'success' | 'error' };

/** Trädoperationerna sprider dokumentet, så tvärlänkarna följer med; typen vet det inte. */
const asDoc = (content: MindmapContent): MindmapDoc => content as MindmapDoc;

const fontOf = (style: CSSStyleDeclaration) => `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;

/**
 * Läser färgerna ur CSS-variablerna på `.mm` och typsnitten ur två mätnoder.
 * Bilden är något som delas med andra och ritas därför i standardutseendet,
 * som kortets export: temat tas bort medan värdena läses och sätts tillbaka
 * direkt, i samma uppgift, så sidan hinner aldrig ritas om utan tema.
 * Minikartan visas på sidan och läser i stället med temat kvar (`keepTheme`).
 */
function readPalette(
  container: HTMLElement,
  probes: { node: HTMLElement; root: HTMLElement },
  keepTheme = false,
): MindmapPalette {
  const html = document.documentElement;
  const theme = keepTheme ? null : html.getAttribute('data-theme');
  if (theme !== null) html.removeAttribute('data-theme');
  try {
    const style = getComputedStyle(container);
    const read = (name: string) => style.getPropertyValue(name).trim();
    return {
      background: read('--mm-image-bg'),
      line: read('--mm-line'),
      text: read('--mm-text'),
      nodeBg: read('--mm-node-bg'),
      nodeBorder: read('--mm-node-border'),
      rootBg: read('--mm-root-bg'),
      rootBorder: read('--mm-root-border'),
      badgeBg: read('--mm-badge-bg'),
      badgeText: read('--mm-badge-text'),
      colors: Object.fromEntries(MINDMAP_COLORS.map((color) => [color, read(`--mm-c-${color}`)])) as Record<MindmapColor, string>,
      font: fontOf(getComputedStyle(probes.node)),
      rootFont: fontOf(getComputedStyle(probes.root)),
    };
  } finally {
    if (theme !== null) html.setAttribute('data-theme', theme);
  }
}

const canCopyImage = () =>
  typeof window !== 'undefined' && typeof ClipboardItem !== 'undefined' && !!navigator.clipboard?.write;

/** Lägger en disposition på urklipp som både HTML och text; Google Docs tar HTML-versionen. */
async function copyOutline(node: MindmapDoc['root'], style: OutlineStyle): Promise<void> {
  const html = `<meta charset="utf-8">${toOutlineHtml(node, style)}`;
  const text = toOutlineText(node);
  if (typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
    await navigator.clipboard.write([
      new ClipboardItem({
        'text/html': new Blob([html], { type: 'text/html' }),
        'text/plain': new Blob([text], { type: 'text/plain' }),
      }),
    ]);
    return;
  }
  await navigator.clipboard.writeText(text);
}

/*
 * Kartan på Mindmap-sidan, i MindMups anda: två lägen, en markerad nod (nav)
 * och en nod man skriver i (edit), och tangenterna tolkas av
 * resolveMindmapKey. Allt som ändrar kartan går genom `commit`, som lägger
 * det gamla läget i ångra-historiken.
 *
 * Skriven utifrån workspace-kortets MindmapEditor men inte delad med det
 * (docs/plans/mindmap-sida.md, beslut 12). Noderna placeras av
 * layoutMindmap och ritas absolut, med grenarna som SVG-kurvor. Samma layout
 * ritar bilden vid export (mindmapDraw).
 *
 * Kartan ligger i ett lager som flyttas och skalas (useMindmapViewport), med
 * rotnodens mitt i lagrets origo. Layouten och textmätningen görs vid zoom 1;
 * lagret skalar resultatet.
 */
export default function MindmapCanvas({ mapId, doc, title, onChange, status }: MindmapCanvasProps) {
  /*
   * Det senaste dokumentet. Sätts direkt vid varje ändring och inte först när
   * sidan ritats om, så att två snabba tangenttryck inte räknar på samma
   * gamla version och det andra skriver över det första.
   */
  const docRef = useRef(doc);
  const lastDoc = useRef(doc);
  if (lastDoc.current !== doc) {
    lastDoc.current = doc;
    docRef.current = doc;
  }

  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const selectedRef = useRef<string | null>(null);
  const editingRef = useRef<string | null>(null);
  const historyRef = useRef(emptyHistory());

  const [dragId, setDragId] = useState<string | null>(null);
  const [dropId, setDropId] = useState<string | null>(null);
  const dropRef = useRef<string | null>(null);
  const suppressClick = useRef(false);
  const [panning, setPanning] = useState(false);
  /** Sätts när markeringen kommer av att kartan fick fokus; då ska vyn inte flytta sig. */
  const skipReveal = useRef(false);
  const selectedOnDown = useRef(false);

  const [menu, setMenu] = useState<MindmapMenu>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const probeRef = useRef<HTMLSpanElement>(null);
  const probeRootRef = useRef<HTMLSpanElement>(null);

  /* ── Textmätning ── */

  const [fonts, setFonts] = useState<{ node: string; root: string } | null>(null);
  useIsomorphicLayoutEffect(() => {
    const read = () => {
      const node = probeRef.current;
      const root = probeRootRef.current;
      if (!node || !root) return;
      setFonts({ node: fontOf(getComputedStyle(node)), root: fontOf(getComputedStyle(root)) });
    };
    read();
    let cancelled = false;
    document.fonts?.ready.then(() => {
      if (!cancelled) read();
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const measure = useMemo<MeasureText>(() => {
    const ctx = fonts && typeof document !== 'undefined'
      ? document.createElement('canvas').getContext('2d')
      : null;
    if (!fonts || !ctx) return (text, isRoot) => text.length * (isRoot ? 9 : 7.5);
    const cache = new Map<string, number>();
    return (text, isRoot) => {
      const key = `${isRoot ? 'r' : 'n'}${text}`;
      let width = cache.get(key);
      if (width === undefined) {
        ctx.font = isRoot ? fonts.root : fonts.node;
        width = ctx.measureText(text).width;
        cache.set(key, width);
      }
      return width;
    };
  }, [fonts]);

  const layout = useMemo(
    () => layoutMindmap(doc, (text, isRoot) => measure(text || PLACEHOLDER, isRoot)),
    [doc, measure],
  );

  /* ── Vyn ── */

  // Rotnodens mitt är lagrets origo, så att roten ligger still när kartan
  // växer och en sparad vy gäller också efter att noder lagts till.
  const origin = useMemo(() => {
    const root = layout.nodes.find((node) => node.isRoot);
    return root
      ? { x: Math.round(root.x + root.width / 2), y: Math.round(root.y + root.height / 2) }
      : { x: 0, y: 0 };
  }, [layout]);
  const bounds = useMemo<MindmapRect>(
    () => ({ x: -origin.x, y: -origin.y, width: layout.width, height: layout.height }),
    [origin, layout.width, layout.height],
  );
  const viewport = useMindmapViewport({ mapId, bounds, ready: fonts !== null });
  const scrollRef = viewport.viewportRef;

  /** Nodens ruta i kartans koordinater, eller `null` om den inte syns (hopfälld gren). */
  const nodeRect = useCallback((id: string): MindmapRect | null => {
    const box = layout.byId.get(id);
    return box ? { x: box.x - origin.x, y: box.y - origin.y, width: box.width, height: box.height } : null;
  }, [layout, origin]);

  /* ── Grundsteg ── */

  const currentId = useCallback((): string => {
    const id = selectedRef.current;
    const d = docRef.current;
    return id && findNode(d.root, id) ? id : d.root.id;
  }, []);

  const select = useCallback((id: string | null) => {
    selectedRef.current = id;
    setSelectedId(id);
  }, []);

  const focusMap = useCallback(() => {
    scrollRef.current?.focus({ preventScroll: true });
  }, [scrollRef]);

  const commit = useCallback((next: MindmapDoc, historyKey: string | null = null) => {
    historyRef.current = recordChange(
      historyRef.current,
      { content: docRef.current, selectedId: currentId() },
      historyKey,
    );
    docRef.current = next;
    onChangeRef.current(next);
  }, [currentId]);

  const flash = useCallback((text: string, tone: Notice['tone'] = 'success') => {
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    setNotice({ text, tone });
    noticeTimer.current = setTimeout(() => setNotice(null), NOTICE_MS);
  }, []);
  useEffect(() => () => {
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
  }, []);

  // En annan karta: markering, skrivande och historik hör till den förra.
  useEffect(() => {
    historyRef.current = emptyHistory();
    editingRef.current = null;
    setEditingId(null);
    select(null);
    setMenu(null);
  }, [mapId, select]);

  /**
   * Slutar skriva. En tom nod utan barn tas bort: den blev över när man
   * tryckte Enter en gång för mycket. Borttagningen läggs inte i historiken —
   * ångra går då direkt till läget innan noden skapades.
   */
  const finishEdit = useCallback(() => {
    const id = editingRef.current;
    if (!id) return;
    editingRef.current = null;
    setEditingId(null);
    historyRef.current = breakCoalescing(historyRef.current);

    const d = docRef.current;
    const node = findNode(d.root, id);
    if (node && id !== d.root.id && node.label.trim() === '' && node.children.length === 0) {
      const removed = removeNodeFromDoc(d, id);
      if (removed) {
        docRef.current = removed.doc;
        onChangeRef.current(removed.doc);
        select(removed.focusId);
      }
    }
  }, [select]);

  const startEdit = useCallback((id: string) => {
    if (editingRef.current && editingRef.current !== id) finishEdit();
    select(id);
    editingRef.current = id;
    setEditingId(id);
  }, [finishEdit, select]);

  /* ── Handlingar ── */

  const run = useCallback((action: MindmapAction, mode: MindmapMode) => {
    const d = docRef.current;
    const id = currentId();

    switch (action.type) {
      case 'addChild': {
        const result = addChild(d, id);
        if (!result) return;
        commit(asDoc(result.content));
        startEdit(result.id);
        return;
      }
      case 'addSibling': {
        const result = addSibling(d, id, action.where);
        if (!result) return;
        commit(asDoc(result.content));
        startEdit(result.id);
        return;
      }
      case 'indent': {
        const next = indent(d, id);
        if (next) commit(asDoc(next));
        return;
      }
      case 'outdent': {
        if (findParent(d.root, id)?.parent.id === d.root.id) return;
        const next = outdent(d, id);
        if (next) commit(asDoc(next));
        return;
      }
      case 'navigate': {
        const target = navigate(d, id, action.direction);
        if (!target) return;
        if (mode === 'edit') startEdit(target);
        else select(target);
        return;
      }
      case 'move': {
        let next: MindmapContent | null = null;
        if (action.direction === 'up' || action.direction === 'down') {
          next = moveAmongSiblings(d, id, action.direction === 'up' ? -1 : 1);
        } else {
          const side = sideOf(d, id);
          if (!side) return;
          const outward = side === 'right' ? 'right' : 'left';
          next = action.direction === outward ? indent(d, id) : outdent(d, id);
        }
        if (next) commit(asDoc(next));
        return;
      }
      case 'edit': {
        if (action.replaceWith !== undefined) commit(asDoc(setLabel(d, id, action.replaceWith)), `label:${id}`);
        startEdit(id);
        return;
      }
      case 'finishEdit':
        finishEdit();
        focusMap();
        return;
      case 'leave':
        scrollRef.current?.blur();
        return;
      case 'remove': {
        const result = removeNodeFromDoc(d, id);
        if (!result) return;
        commit(result.doc);
        if (mode === 'edit') {
          editingRef.current = null;
          startEdit(result.focusId);
        } else {
          select(result.focusId);
        }
        return;
      }
      case 'toggleCollapse': {
        const next = toggleCollapsed(d, id);
        if (next) commit(asDoc(next));
        return;
      }
      case 'color':
        commit(asDoc(setColor(d, id, action.color)));
        return;
      case 'undo':
      case 'redo': {
        const step = (action.type === 'undo' ? undo : redo)(historyRef.current, { content: d, selectedId: id });
        if (!step) return;
        historyRef.current = step.history;
        const restored = asDoc(step.snapshot.content);
        docRef.current = restored;
        onChangeRef.current(restored);
        const target = findNode(restored.root, step.snapshot.selectedId)
          ? step.snapshot.selectedId
          : restored.root.id;
        if (mode === 'edit') {
          editingRef.current = target;
          setEditingId(target);
        }
        select(target);
        return;
      }
      case 'copy':
      case 'cut': {
        const node = findNode(d.root, id);
        if (!node) return;
        copyOutline(node, 'list')
          .then(() => flash(action.type === 'cut' ? 'Grenen är urklippt.' : 'Grenen är kopierad som punktlista.'))
          .catch(() => flash('Kunde inte kopiera.', 'error'));
        if (action.type === 'cut') {
          const result = removeNodeFromDoc(d, id);
          if (result) {
            commit(result.doc);
            select(result.focusId);
          }
        }
        return;
      }
      case 'paste':
        // Webbläsaren skickar en paste-händelse, som handlePaste tar hand om.
        return;
    }
  }, [commit, currentId, finishEdit, flash, focusMap, scrollRef, select, startEdit]);

  const keyContext = useCallback((id: string) => {
    const d = docRef.current;
    const node = findNode(d.root, id);
    return {
      isRoot: id === d.root.id,
      parentIsRoot: findParent(d.root, id)?.parent.id === d.root.id,
      labelEmpty: (node?.label ?? '') === '',
      hasChildren: (node?.children.length ?? 0) > 0,
      hasPreviousSibling: indent(d, id) !== null,
    };
  }, []);

  /* ── Tangentbordet ── */

  /**
   * Vyns kortkommandon (Ctrl+0, Ctrl+., Ctrl++ och Ctrl+-). Tas före kartans
   * egna, och gäller också medan man skriver i en nod: händelsen bubblar hit
   * från textfältet. Ctrl+0, + och - är webbläsarens zoom och stoppas därför,
   * men bara här, när kartan har fokus.
   */
  const handleViewKey = (e: React.KeyboardEvent<HTMLDivElement>): boolean => {
    const action = resolveViewportKey(e.nativeEvent);
    if (!action) return false;
    e.preventDefault();
    e.stopPropagation();
    if (action === 'fit') viewport.fit();
    else if (action === 'zoomIn') viewport.zoomStep(1);
    else if (action === 'zoomOut') viewport.zoomStep(-1);
    else {
      const rect = nodeRect(editingRef.current ?? currentId());
      if (rect) viewport.center(rect);
    }
    return true;
  };

  const handleMapKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (handleViewKey(e)) return;
    if (editingRef.current || isEditableElement(e.target)) return;
    const action = resolveMindmapKey(e.nativeEvent, 'nav', keyContext(currentId()));
    if (!action) return;
    e.stopPropagation();
    if (action.type !== 'paste') e.preventDefault();
    setMenu(null);
    run(action, 'nav');
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const id = editingRef.current;
    if (!id) return;
    const action = resolveMindmapKey(e.nativeEvent, 'edit', keyContext(id));
    if (!action) return;
    e.preventDefault();
    e.stopPropagation();
    run(action, 'edit');
  };

  /** Klistrar in en disposition som barn till noden. Sant om något lades till. */
  const pasteOutline = (e: React.ClipboardEvent, parentId: string): boolean => {
    const html = e.clipboardData.getData('text/html');
    const text = e.clipboardData.getData('text/plain');
    const fromHtml = html ? parseOutlineHtml(new DOMParser().parseFromString(html, 'text/html')) : null;
    const nodes = fromHtml ?? parseOutlineText(text);
    const next = addChildren(docRef.current, parentId, nodes);
    if (!next) return false;
    e.preventDefault();
    commit(asDoc(next));
    select(nodes[0].id);
    return true;
  };

  const handleMapPaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    if (editingRef.current || isEditableElement(e.target)) return;
    e.stopPropagation();
    pasteOutline(e, currentId());
  };

  /** Flera rader i en nod man skriver i blir barn till noden, inte en lång etikett. */
  const handleInputPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const id = editingRef.current;
    if (!id || !/[\r\n]/.test(e.clipboardData.getData('text/plain').trim())) return;
    e.stopPropagation();
    if (pasteOutline(e, id)) {
      finishEdit();
      focusMap();
    }
  };

  /* ── Pekaren ── */

  const handleNodePointerDown = (e: React.PointerEvent<HTMLDivElement>, id: string) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    // Efter ett drag som släpptes på en annan nod kommer inget klick på den
    // dragna; utan det här hade nästa klick på en nod svalts.
    suppressClick.current = false;
    // Läses före klicket: när knappen trycks ned får kartan fokus och
    // markerar roten, och då hade första klicket på roten börjat redigera.
    selectedOnDown.current = selectedRef.current === id && document.activeElement === scrollRef.current;
    setMenu(null);
    if (editingRef.current === id || id === docRef.current.root.id) return;

    const start = { x: e.clientX, y: e.clientY };
    let active = false;

    const handleMove = (ev: PointerEvent) => {
      if (!active) {
        if (Math.hypot(ev.clientX - start.x, ev.clientY - start.y) < DRAG_THRESHOLD_PX) return;
        active = true;
        setDragId(id);
      }
      const hit = document.elementFromPoint(ev.clientX, ev.clientY)?.closest<HTMLElement>('[data-mm-id]');
      const target = hit && scrollRef.current?.contains(hit) ? hit.dataset.mmId ?? null : null;
      const valid = target && canMoveNode(docRef.current, id, target) ? target : null;
      dropRef.current = valid;
      setDropId(valid);
    };

    const handleUp = () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
      if (!active) return;
      suppressClick.current = true;
      const target = dropRef.current;
      dropRef.current = null;
      setDragId(null);
      setDropId(null);
      if (!target) return;
      const next = moveNode(docRef.current, id, target);
      if (next) {
        commit(asDoc(next));
        select(id);
        focusMap();
      }
    };

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
  };

  /**
   * Panorerar: vänsterknappen på tom yta (noderna stoppar sin egen
   * nedtryckning) eller mittknappen var som helst, också på en nod.
   */
  const handleViewportPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    setMenu(null);
    if (e.button !== 0 && e.button !== 1) return;
    let last = { x: e.clientX, y: e.clientY };
    const pointerId = e.pointerId;

    const handleMove = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId) return;
      const dx = ev.clientX - last.x;
      const dy = ev.clientY - last.y;
      last = { x: ev.clientX, y: ev.clientY };
      viewport.change((view) => panBy(view, dx, dy));
    };
    const handleUp = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId) return;
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
      window.removeEventListener('pointercancel', handleUp);
      setPanning(false);
    };
    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
    window.addEventListener('pointercancel', handleUp);
    setPanning(true);
  };

  const handleNodeClick = (id: string) => {
    if (suppressClick.current) {
      suppressClick.current = false;
      return;
    }
    if (editingRef.current === id) return;
    // Ett klick på den markerade noden börjar skriva i den, som i MindMup.
    const alreadySelected = selectedOnDown.current;
    selectedOnDown.current = false;
    if (editingRef.current) finishEdit();
    if (alreadySelected) {
      startEdit(id);
    } else {
      select(id);
      focusMap();
    }
  };

  /* ── Effekter ── */

  // Markören till slutet av texten när en nod börjar redigeras.
  useEffect(() => {
    if (!editingId) return;
    const input = inputRef.current;
    if (!input) return;
    input.focus({ preventScroll: true });
    const end = input.value.length;
    input.setSelectionRange(end, end);
  }, [editingId]);

  // Ytan följer med så att den markerade noden syns, också när den flyttar
  // sig för att kartan ändrats.
  useEffect(() => {
    const skip = skipReveal.current;
    skipReveal.current = false;
    const id = editingId ?? selectedId;
    const rect = id ? nodeRect(id) : null;
    if (!rect || skip) return;
    viewport.reveal(rect);
  }, [selectedId, editingId, nodeRect, viewport]);

  /* ── Export ── */

  const handleExport = (kind: MindmapExportKind) => {
    const d = docRef.current;
    if (kind === 'list' || kind === 'headings') {
      copyOutline(d.root, kind)
        .then(() => flash(kind === 'list'
          ? 'Kopierad som punktlista. Klistra in i dokumentet.'
          : 'Kopierad som rubriker och punkter. Klistra in i dokumentet.'))
        .catch(() => flash('Kunde inte kopiera. Webbläsaren kanske inte tillåter urklipp här.', 'error'));
      return;
    }

    const container = rootRef.current;
    const node = probeRef.current;
    const root = probeRootRef.current;
    if (!container || !node || !root) return;
    // Bilden ritas först när typsnitten finns, annars blir texten fel.
    const png = (document.fonts?.ready ?? Promise.resolve())
      .then(() => canvasToPng(renderMindmapCanvas(d, readPalette(container, { node, root }))));

    if (kind === 'image') {
      navigator.clipboard.write([new ClipboardItem({ 'image/png': png })])
        .then(() => flash('Bilden är kopierad. Klistra in i dokumentet.'))
        .catch(() => flash('Kunde inte kopiera bilden. Ladda ner den som PNG i stället.', 'error'));
      return;
    }
    png
      .then((blob) => downloadBlob(blob, `${toFileSlug(title || d.root.label, 'mindmap')}.png`))
      .catch(() => flash('Kunde inte skapa bilden.', 'error'));
  };

  /* ── Ritning ── */

  const readMinimapPalette = useCallback((): MindmapPalette | null => {
    const container = rootRef.current;
    const node = probeRef.current;
    const root = probeRootRef.current;
    return container && node && root ? readPalette(container, { node, root }, true) : null;
  }, []);

  const toolbarAction = (action: MindmapAction) => {
    setMenu(null);
    run(action, 'nav');
    if (action.type !== 'addChild') focusMap();
  };

  const m = MINDMAP_METRICS;

  return (
    <div ref={rootRef} className={`mm flex h-full flex-col${dragId ? ' mm--dragging' : ''}${panning ? ' mm--panning' : ''}`}>
      <MindmapToolbar
        layout={doc.layout ?? 'right'}
        menu={menu}
        canCopyImage={canCopyImage()}
        onMenu={setMenu}
        onAddChild={() => toolbarAction({ type: 'addChild' })}
        onToggleCollapse={() => toolbarAction({ type: 'toggleCollapse' })}
        onColor={(color: MindmapColor | null) => toolbarAction({ type: 'color', color })}
        onLayout={(next: MindmapLayout) => {
          setMenu(null);
          commit(asDoc(setLayout(docRef.current, next)));
        }}
        onUndo={() => toolbarAction({ type: 'undo' })}
        onRedo={() => toolbarAction({ type: 'redo' })}
        onExport={handleExport}
        zoom={<MindmapZoom viewport={viewport} />}
        status={status}
      />

      <div className="relative min-h-0 flex-1">
        <div
          ref={scrollRef}
          className="mm__viewport"
          tabIndex={0}
          aria-label="Mindmap. Tab ger en ny nod under, Enter en ny nod bredvid."
          onKeyDown={handleMapKeyDown}
          onPaste={handleMapPaste}
          onFocus={(e) => {
            if (e.target === e.currentTarget && !selectedRef.current) {
              // Roten markeras, men vyn står kvar: den som klickar på tom yta
              // för att panorera ska inte kastas tillbaka till roten.
              skipReveal.current = true;
              select(docRef.current.root.id);
            }
          }}
          onPointerDown={handleViewportPointerDown}
          onMouseDown={(e) => {
            // Mittknappen startar annars webbläsarens autorullning.
            if (e.button === 1) e.preventDefault();
          }}
        >
          <div ref={viewport.layerRef} className="mm__layer">
            <div
              className="mm__canvas"
              style={{ left: -origin.x, top: -origin.y, width: layout.width, height: layout.height }}
            >
              <svg className="mm__edges" width={layout.width} height={layout.height} aria-hidden="true">
                {layout.edges.map((edge) => (
                  <path key={`${edge.fromId}-${edge.toId}`} d={edgePath(edge)} className="mm__edge" />
                ))}
              </svg>

              {layout.nodes.map((node) => {
                const isEditing = editingId === node.id;
                const classes = [
                  'mm__node',
                  node.isRoot && 'mm__node--root',
                  node.color && `mm__node--${node.color}`,
                  selectedId === node.id && 'mm__node--selected',
                  isEditing && 'mm__node--editing',
                  dragId === node.id && 'mm__node--dragged',
                  dropId === node.id && 'mm__node--drop',
                ].filter(Boolean).join(' ');

                return (
                  <div
                    key={node.id}
                    data-mm-id={node.id}
                    className={classes}
                    style={{
                      left: node.x,
                      top: node.y,
                      width: node.width,
                      height: node.height,
                      paddingInline: node.isRoot ? m.rootPadX : m.padX,
                    }}
                    onPointerDown={(e) => handleNodePointerDown(e, node.id)}
                    onClick={() => handleNodeClick(node.id)}
                    onDoubleClick={() => startEdit(node.id)}
                  >
                    {isEditing ? (
                      <input
                        ref={inputRef}
                        value={node.label}
                        placeholder={PLACEHOLDER}
                        onChange={(e) => commit(asDoc(setLabel(docRef.current, node.id, e.target.value)), `label:${node.id}`)}
                        onKeyDown={handleInputKeyDown}
                        onPaste={handleInputPaste}
                        onBlur={() => {
                          // Blur kommer också när en annan nod tar över skrivandet;
                          // då har editingRef redan bytts och det finns inget att avsluta.
                          if (editingRef.current === node.id) finishEdit();
                        }}
                        onPointerDown={(e) => e.stopPropagation()}
                        className="mm__input"
                        style={{ width: node.labelWidth }}
                        aria-label="Nodens text"
                      />
                    ) : (
                      <span
                        className={`mm__label${node.label ? '' : ' mm__label--empty'}`}
                        style={{ width: node.labelWidth }}
                      >
                        {node.label || PLACEHOLDER}
                      </span>
                    )}
                    {node.hiddenCount > 0 && (
                      <button
                        type="button"
                        className="mm__badge"
                        style={{ width: m.badgeWidth }}
                        tabIndex={-1}
                        title="Fäll ut (mellanslag)"
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={(e) => {
                          e.stopPropagation();
                          const next = toggleCollapsed(docRef.current, node.id);
                          if (next) commit(asDoc(next));
                          select(node.id);
                          focusMap();
                        }}
                      >
                        +{node.hiddenCount}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <MindmapMinimap viewport={viewport} doc={doc} bounds={bounds} readPalette={readMinimapPalette} />

        {notice && (
          <div className={`mm__notice mm__notice--${notice.tone}`} role="status">
            {notice.text}
          </div>
        )}
      </div>

      {/* Mätnoder: typsnittet för textmätningen läses härifrån. */}
      <span ref={probeRef} className="mm__node mm__probe" aria-hidden="true">M</span>
      <span ref={probeRootRef} className="mm__node mm__node--root mm__probe" aria-hidden="true">M</span>
    </div>
  );
}
