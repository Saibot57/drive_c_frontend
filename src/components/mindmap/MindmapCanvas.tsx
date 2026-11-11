'use client';

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { MindmapColor, MindmapContent, MindmapIcon, MindmapLayout, MindmapNode } from '@/types/mindmap';
import { MINDMAP_COLORS, MINDMAP_ICONS } from '@/types/mindmap';
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
  clearOffsets,
  hasOffsets,
  setColorDeep,
  setIcon,
  setImage,
  setLabel,
  setLayout,
  setLink,
  setNote,
  setOffset,
  sideOf,
  toggleCollapsed,
} from '@/utils/mindmap/mindmapTree';
import { breakCoalescing, emptyHistory, recordChange, redo, undo } from '@/utils/mindmap/mindmapHistory';
import { resolveMindmapKey, type MindmapAction, type MindmapMode } from '@/utils/mindmap/mindmapKeys';
import {
  edgePath,
  layoutMindmap,
  MINDMAP_METRICS,
  type MeasureText,
} from '@/utils/mindmap/mindmapLayout';
import { parseOutlineHtml, parseOutlineText } from '@/utils/mindmap/mindmapOutline';
import { toOutlineHtml, toOutlineText, type OutlineStyle } from '@/utils/mindmap/mindmapOutline';
import type { MindmapDrawOptions, MindmapPalette } from '@/utils/mindmap/mindmapDraw';
import { readBranchData, withBranchData } from '@/utils/mindmapClipboard';
import { crossLinkOutline } from '@/utils/mindmapCrossLinks';
import { drawCrossLinks } from '@/utils/mindmapCrossLinkDraw';
import { pruneCrossLinks, removeNodeFromDoc } from '@/utils/mindmapDoc';
import { imageSourceKey, resolveNodeExtraKey } from '@/utils/mindmapImage';
import { placeNode } from '@/utils/mindmapPlacement';
import { useMindmapImages } from '@/hooks/useMindmapImages';
import { panBy, resolveViewportKey, toWorld, type MindmapRect } from '@/utils/mindmapViewport';
import { useMindmapLinks } from '@/hooks/useMindmapLinks';
import { useMindmapExport } from '@/hooks/useMindmapExport';
import { isCopyImageKey } from '@/utils/mindmapFile';
import { useMindmapViewport } from '@/hooks/useMindmapViewport';
import { isEditableElement } from '@/utils/dom';
import { loadDrawSymbols, LinkSymbol, MINDMAP_ICON_COMPONENTS, NoteSymbol } from './mindmapIcons';
import { MindmapLinkBar } from './MindmapLinkBar';
import { MindmapLinkLayer } from './MindmapLinkLayer';
import { MindmapMinimap } from './MindmapMinimap';
import { MINDMAP_PLACEHOLDER, MindmapNodeView } from './MindmapNodeView';
import { MindmapNodePanel, type MindmapPanelField } from './MindmapNodePanel';
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
  /** En fil att importera som ny karta (useMindmapSync.importFile). */
  onImport?: (file: File) => void;
}

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

/**
 * Lägger en disposition på urklipp som både HTML och text; Google Docs tar
 * HTML-versionen. Anteckningarna följer med som indrag. Med `withBranch`
 * ligger också grenen själv i HTML:en (mindmapClipboard), så att den kan
 * klistras in i en karta med anteckning, länk, bild, ikon och färg kvar.
 */
async function copyOutline(
  node: MindmapDoc['root'],
  style: OutlineStyle,
  withBranch = false,
  /** Läggs sist: hela kartans tvärlänkar (crossLinkOutline). */
  tail: { text: string; html: string } = { text: '', html: '' },
): Promise<void> {
  const outline = toOutlineHtml(node, style, { notes: true }) + tail.html;
  const html = `<meta charset="utf-8">${withBranch ? withBranchData(outline, node) : outline}`;
  const text = toOutlineText(node, { notes: true }) + tail.text;
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
export default function MindmapCanvas({ mapId, doc, title, onChange, status, onImport }: MindmapCanvasProps) {
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
  /** Hur långt noden som dras har flyttats, i kartans px (vid zoom 1). */
  const [dragMove, setDragMove] = useState<{ id: string; dx: number; dy: number } | null>(null);
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

  /** Sidans layout: sidans textmätning, och plats för ikon, symboler och bild. */
  const layoutOf = useCallback(
    (content: MindmapContent) =>
      layoutMindmap(content, (text, isRoot) => measure(text || MINDMAP_PLACEHOLDER, isRoot), MINDMAP_METRICS, { extras: true }),
    [measure],
  );

  // Medan en nod dras ritas kartan som om den redan släppts där, så att
  // grenen och kanterna följer pekaren. Dokumentet ändras först vid släppet.
  const layout = useMemo(() => {
    if (!dragMove) return layoutOf(doc);
    const base = findNode(doc.root, dragMove.id)?.offset ?? { dx: 0, dy: 0 };
    return layoutOf(setOffset(doc, dragMove.id, { dx: base.dx + dragMove.dx, dy: base.dy + dragMove.dy }));
  }, [doc, dragMove, layoutOf]);

  /* ── Bilder och panel ── */

  const images = useMindmapImages(doc.root);
  const [panelOpen, setPanelOpen] = useState(false);
  const [panelFocus, setPanelFocus] = useState<{ field: MindmapPanelField; tick: number } | null>(null);
  const symbolsRef = useRef<HTMLDivElement>(null);

  const openPanel = useCallback((field: MindmapPanelField) => {
    setPanelOpen(true);
    setPanelFocus((current) => ({ field, tick: (current?.tick ?? 0) + 1 }));
  }, []);

  // En bild som hämtats men saknar mått får dem sparade, så att layouten och
  // exporten vet höjden nästa gång utan att vänta på bilden. Inte ett steg i
  // ångra-historiken: det är inget användaren gjort.
  useEffect(() => {
    let next: MindmapContent = docRef.current;
    images.refs.forEach((ref) => {
      const aspect = images.get(ref.key)?.aspect;
      const node = findNode(next.root, ref.nodeId);
      if (!aspect || !node?.image || node.image.aspect !== undefined) return;
      if (imageSourceKey(node.image.source) !== ref.key) return;
      next = setImage(next, ref.nodeId, { ...node.image, aspect: Math.round(aspect * 1000) / 1000 });
    });
    if (next === docRef.current) return;
    docRef.current = asDoc(next);
    onChangeRef.current(asDoc(next));
  }, [images]);

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
    // En flytt kan göra två länkade noder till förälder och barn; den
    // länken är då inte längre tillåten.
    const pruned = pruneCrossLinks(next);
    docRef.current = pruned;
    onChangeRef.current(pruned);
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

  /* ── Tvärlänkar ── */

  const toLayoutPoint = useCallback((clientX: number, clientY: number) => {
    const box = scrollRef.current?.getBoundingClientRect();
    const world = toWorld(viewport.getView(), { x: clientX - (box?.left ?? 0), y: clientY - (box?.top ?? 0) });
    return { x: world.x + origin.x, y: world.y + origin.y };
  }, [origin, scrollRef, viewport]);

  const nodeAt = useCallback((clientX: number, clientY: number): string | null => {
    const hit = document.elementFromPoint(clientX, clientY)?.closest<HTMLElement>('[data-mm-id]');
    return hit && scrollRef.current?.contains(hit) ? hit.dataset.mmId ?? null : null;
  }, [scrollRef]);

  const links = useMindmapLinks({ mapId, doc, docRef, layout, commit, flash, focusMap, currentId, toLayoutPoint, nodeAt });

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
      // En ny nod får förälderns färg, så att en färgad gren fortsätter i
      // sin färg. Färgen sparas på noden; inget arv räknas ut vid ritning.
      case 'addChild': {
        const result = addChild(d, id);
        if (!result) return;
        const color = findNode(d.root, id)?.color;
        commit(asDoc(color ? setColor(result.content, result.id, color) : result.content));
        startEdit(result.id);
        return;
      }
      case 'addSibling': {
        const result = addSibling(d, id, action.where);
        if (!result) return;
        const parent = id === d.root.id ? d.root : findParent(d.root, id)?.parent;
        commit(asDoc(parent?.color ? setColor(result.content, result.id, parent.color) : result.content));
        startEdit(result.id);
        return;
      }
      // En nod som byter förälder börjar om på sin automatiska plats där;
      // förskjutningen gällde den gamla platsen.
      case 'indent': {
        const next = indent(d, id);
        if (next) commit(asDoc(setOffset(next, id, null)));
        return;
      }
      case 'outdent': {
        if (findParent(d.root, id)?.parent.id === d.root.id) return;
        const next = outdent(d, id);
        if (next) commit(asDoc(setOffset(next, id, null)));
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
          if (next) next = setOffset(next, id, null);
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
        copyOutline(node, 'list', true)
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

  /**
   * Alt+N, Alt+L, Alt+I och Alt+Shift+siffra: nodens panel och ikon. Som
   * vyns tangenter gäller de också medan man skriver i en nod, och de tas
   * före resolveMindmapKey, som annars läser Alt+Shift+siffra som en färg.
   */
  const handleExtraKey = (e: React.KeyboardEvent<HTMLDivElement>): boolean => {
    const action = resolveNodeExtraKey(e.nativeEvent);
    if (!action) return false;
    e.preventDefault();
    e.stopPropagation();
    setMenu(null);
    const id = editingRef.current ?? currentId();
    if (action.type === 'icon') {
      commit(asDoc(setIcon(docRef.current, id, action.icon)));
    } else if (action.type === 'resetOffset') {
      const next = setOffset(docRef.current, id, null);
      if (next !== docRef.current) commit(asDoc(next));
    } else {
      select(id);
      openPanel(action.field);
    }
    return true;
  };

  const handleMapKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    // Alt+Shift+C kopierar kartan som bild, också medan man skriver. Före
    // resolveMindmapKey, och direkt i händelsen: Safari kräver det för urklipp.
    if (isCopyImageKey(e.nativeEvent)) {
      e.preventDefault();
      e.stopPropagation();
      setMenu(null);
      if (canCopyImage()) exporter.exportAs('image');
      else flash('Webbläsaren kan inte kopiera bilder. Ladda ner kartan som PNG i stället.', 'error');
      return;
    }
    if (handleViewKey(e) || handleExtraKey(e)) return;
    // Ctrl+L från ett textfält: skrivandet avslutas, länken börjar från noden.
    if (links.handleKey(e)) {
      if (editingRef.current) {
        finishEdit();
        focusMap();
      }
      setMenu(null);
      return;
    }
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
    const parsed = html ? new DOMParser().parseFromString(html, 'text/html') : null;
    // En gren kopierad från en karta kommer med allt; annars gäller dispositionen.
    const branch = parsed ? readBranchData(parsed) : null;
    const nodes = branch ? [branch] : (parsed ? parseOutlineHtml(parsed) : null) ?? parseOutlineText(text);
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
    // Shift+dra drar en tvärlänk i stället för att flytta noden.
    if (e.shiftKey && editingRef.current !== id) {
      suppressClick.current = true;
      links.beginDrag(e, id);
      return;
    }
    if (editingRef.current === id || id === docRef.current.root.id) return;

    const start = { x: e.clientX, y: e.clientY };
    let active = false;
    let moved = { dx: 0, dy: 0 };

    const handleMove = (ev: PointerEvent) => {
      if (!active) {
        if (Math.hypot(ev.clientX - start.x, ev.clientY - start.y) < DRAG_THRESHOLD_PX) return;
        active = true;
        setDragId(id);
      }
      // Den dragna noden släpper igenom pekaren (CSS), så träffen är noden under.
      const hit = document.elementFromPoint(ev.clientX, ev.clientY)?.closest<HTMLElement>('[data-mm-id]');
      const target = hit && scrollRef.current?.contains(hit) ? hit.dataset.mmId ?? null : null;
      const valid = target && canMoveNode(docRef.current, id, target) ? target : null;
      dropRef.current = valid;
      setDropId(valid);
      // Skärmens pixlar till kartans: zoomen kan ha ändrats under draget.
      const zoom = viewport.getView().zoom;
      moved = { dx: (ev.clientX - start.x) / zoom, dy: (ev.clientY - start.y) / zoom };
      setDragMove({ id, ...moved });
    };

    const handleUp = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
      window.removeEventListener('pointercancel', handleUp);
      if (!active) return;
      suppressClick.current = true;
      const target = dropRef.current;
      dropRef.current = null;
      setDragId(null);
      setDropId(null);
      setDragMove(null);
      // Ett avbrutet drag (pekaren togs över av webbläsaren) ändrar ingenting.
      if (ev.type === 'pointercancel') return;
      // På en annan nod: grenen blir dess barn och står på sin automatiska
      // plats där. På tom yta: noden stannar där den släpptes.
      const next = target
        ? moveNode(setOffset(docRef.current, id, null), id, target)
        : placeNode(docRef.current, id, moved, layoutOf);
      if (next) {
        commit(asDoc(next));
        select(id);
        focusMap();
      }
    };

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
    window.addEventListener('pointercancel', handleUp);
  };

  /**
   * Panorerar: vänsterknappen på tom yta (noderna stoppar sin egen
   * nedtryckning) eller mittknappen var som helst, också på en nod.
   */
  const handleViewportPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    setMenu(null);
    if (e.button !== 0 && e.button !== 1) return;
    // Ett klick på tom yta avmarkerar en tvärlänk.
    if (e.button === 0) links.select(null);
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
    // En påbörjad tvärlänk (Ctrl+L) avslutas på noden man klickar på.
    if (links.linkFrom) {
      selectedOnDown.current = false;
      if (links.finish(id)) select(id);
      return;
    }
    links.select(null);
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
    // Inte under ett drag: då ändras layouten för varje pekarrörelse.
    if (!rect || skip || dragMove) return;
    viewport.reveal(rect);
  }, [selectedId, editingId, nodeRect, viewport, dragMove]);

  /* ── Export ── */

  const exporter = useMindmapExport({
    getDoc: () => docRef.current,
    title,
    readPalette: () => {
      const container = rootRef.current;
      const node = probeRef.current;
      const root = probeRootRef.current;
      return container && node && root ? readPalette(container, { node, root }) : null;
    },
    loadSymbols: (color) => (symbolsRef.current ? loadDrawSymbols(symbolsRef.current, color) : Promise.resolve(undefined)),
    images: () => images.forDraw(),
    flash,
  });

  const handleExport = (kind: MindmapExportKind) => {
    const d = docRef.current;
    if (kind === 'list' || kind === 'headings') {
      copyOutline(d.root, kind, false, crossLinkOutline(d))
        .then(() => flash(kind === 'list'
          ? 'Kopierad som punktlista. Klistra in i dokumentet.'
          : 'Kopierad som rubriker och punkter. Klistra in i dokumentet.'))
        .catch(() => flash('Kunde inte kopiera. Webbläsaren kanske inte tillåter urklipp här.', 'error'));
      return;
    }

    exporter.exportAs(kind);
  };

  /* ── Ritning ── */

  const readMinimapPalette = useCallback((): MindmapPalette | null => {
    const container = rootRef.current;
    const node = probeRef.current;
    const root = probeRootRef.current;
    return container && node && root ? readPalette(container, { node, root }, true) : null;
  }, []);

  /** Minikartan ritar samma former som skärmen, med bilderna men utan symboler. */
  const minimapDrawOptions = useCallback(
    (): MindmapDrawOptions => ({
      extras: true,
      images: images.forDraw(),
      overlay: (ctx, drawn) => {
        const palette = readMinimapPalette();
        if (palette) drawCrossLinks(ctx, drawn, docRef.current, palette);
      },
    }),
    [images, readMinimapPalette],
  );

  /** En ändring från panelen på den markerade noden. `historyKey` slår ihop tangenttryck till ett ångra-steg. */
  const panelNode: MindmapNode | null = selectedId ? findNode(doc.root, selectedId) : null;
  const changePanelNode = (update: (d: MindmapDoc, id: string) => MindmapContent, historyKey: string | null = null) => {
    const id = selectedRef.current;
    if (!id || !findNode(docRef.current.root, id)) return;
    commit(asDoc(update(docRef.current, id)), historyKey ? `${historyKey}:${id}` : null);
  };

  const toolbarAction = (action: MindmapAction) => {
    setMenu(null);
    run(action, 'nav');
    if (action.type !== 'addChild') focusMap();
  };

  /** Bildkällans nyckel per nod, för att slå upp bildens läge. */
  const imageKeys = new Map(images.refs.map((ref) => [ref.nodeId, ref.key]));

  return (
    <div ref={rootRef} className={`mm flex h-full flex-col${dragId ? ' mm--dragging' : ''}${panning ? ' mm--panning' : ''}`}>
      <MindmapToolbar
        layout={doc.layout ?? 'right'}
        menu={menu}
        canCopyImage={canCopyImage()}
        onMenu={setMenu}
        onAddChild={() => toolbarAction({ type: 'addChild' })}
        onToggleCollapse={() => toolbarAction({ type: 'toggleCollapse' })}
        onColor={(color: MindmapColor | null, wholeBranch: boolean) => {
          if (!wholeBranch) {
            toolbarAction({ type: 'color', color });
            return;
          }
          setMenu(null);
          commit(asDoc(setColorDeep(docRef.current, currentId(), color)));
          focusMap();
        }}
        panelOpen={panelOpen}
        onTogglePanel={() => setPanelOpen((open) => !open)}
        canResetLayout={hasOffsets(doc)}
        onResetLayout={() => {
          setMenu(null);
          const next = clearOffsets(docRef.current);
          if (next !== docRef.current) commit(asDoc(next));
          focusMap();
        }}
        onLayout={(next: MindmapLayout) => {
          setMenu(null);
          commit(asDoc(setLayout(docRef.current, next)));
        }}
        onUndo={() => toolbarAction({ type: 'undo' })}
        onRedo={() => toolbarAction({ type: 'redo' })}
        onExport={handleExport}
        transparent={exporter.transparent}
        onTransparent={exporter.setTransparent}
        onImport={onImport}
        zoom={<MindmapZoom viewport={viewport} />}
        status={status}
      />

      <div className="flex min-h-0 flex-1">
      <div className="relative min-h-0 min-w-0 flex-1">
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

              {layout.nodes.map((node) => (
                <MindmapNodeView
                  key={node.id}
                  node={node}
                  linking={links.linkFrom === node.id}
                  selected={selectedId === node.id}
                  editing={editingId === node.id}
                  dragged={dragId === node.id}
                  dropTarget={dropId === node.id}
                  imageState={imageKeys.get(node.id) ? images.get(imageKeys.get(node.id)!) : undefined}
                  inputRef={inputRef}
                  onPointerDown={handleNodePointerDown}
                  onClick={handleNodeClick}
                  onEdit={startEdit}
                  onLabel={(id, label) => commit(asDoc(setLabel(docRef.current, id, label)), `label:${id}`)}
                  onInputKeyDown={handleInputKeyDown}
                  onInputPaste={handleInputPaste}
                  onInputBlur={(id) => {
                    // Blur kommer också när en annan nod tar över skrivandet;
                    // då har editingRef redan bytts och det finns inget att avsluta.
                    if (editingRef.current === id) finishEdit();
                  }}
                  onOpenNote={(id) => {
                    select(id);
                    openPanel('note');
                  }}
                  onExpand={(id) => {
                    const next = toggleCollapsed(docRef.current, id);
                    if (next) commit(asDoc(next));
                    select(id);
                    focusMap();
                  }}
                />
              ))}

              <MindmapLinkLayer
                width={layout.width}
                height={layout.height}
                shapes={links.shapes}
                selectedId={links.selected?.id ?? null}
                draft={links.draft}
                onSelect={(id) => {
                  links.select(id);
                  focusMap();
                }}
                onEditLabel={links.editLabel}
              />
            </div>
          </div>
        </div>

        <MindmapMinimap
          viewport={viewport}
          doc={doc}
          bounds={bounds}
          readPalette={readMinimapPalette}
          drawOptions={minimapDrawOptions}
        />

        {links.selected && (
          <MindmapLinkBar
            link={links.selected}
            fromLabel={findNode(doc.root, links.selected.from)?.label ?? ''}
            toLabel={findNode(doc.root, links.selected.to)?.label ?? ''}
            focusTick={links.labelFocusTick}
            onLabel={links.setLabel}
            onArrow={links.setArrow}
            onReverse={links.reverse}
            onColor={links.setColor}
            onRemove={links.remove}
            onReturn={focusMap}
          />
        )}

        {notice ? (
          <div className={`mm__notice mm__notice--${notice.tone}`} role="status">
            {notice.text}
          </div>
        ) : links.linkFrom && !links.draft && (
          <div className="mm__notice" role="status">
            Välj noden som länken ska gå till: klicka på den, eller gå dit med pilarna och tryck Enter. Esc avbryter.
          </div>
        )}
      </div>

      {panelOpen && (
        <MindmapNodePanel
          node={panelNode}
          focus={panelFocus}
          imageState={panelNode?.image ? images.get(imageSourceKey(panelNode.image.source)) : undefined}
          onNote={(note) => changePanelNode((d, id) => setNote(d, id, note), 'note')}
          onLink={(link) => changePanelNode((d, id) => setLink(d, id, link))}
          onImage={(image) => changePanelNode((d, id) => setImage(d, id, image))}
          onIcon={(icon) => changePanelNode((d, id) => setIcon(d, id, icon))}
          onRetryImage={() => {
            if (panelNode?.image) images.retry(imageSourceKey(panelNode.image.source));
          }}
          onClose={() => {
            setPanelOpen(false);
            focusMap();
          }}
          onReturn={focusMap}
        />
      )}
      </div>

      {/* Symbolerna som SVG, till bildexporten (loadDrawSymbols). */}
      <div ref={symbolsRef} hidden aria-hidden="true">
        {MINDMAP_ICONS.map((icon: MindmapIcon) => {
          const Icon = MINDMAP_ICON_COMPONENTS[icon];
          return <Icon key={icon} data-mm-symbol={icon} />;
        })}
        <NoteSymbol data-mm-symbol="note" />
        <LinkSymbol data-mm-symbol="link" />
      </div>

      {/* Mätnoder: typsnittet för textmätningen läses härifrån. */}
      <span ref={probeRef} className="mm__node mm__probe" aria-hidden="true">M</span>
      <span ref={probeRootRef} className="mm__node mm__node--root mm__probe" aria-hidden="true">M</span>
    </div>
  );
}
