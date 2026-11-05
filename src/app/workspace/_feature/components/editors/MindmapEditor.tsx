'use client';

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { MindmapColor, MindmapContent, MindmapLayout } from '../../types/mindmap.types';
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
  removeNode,
  sanitizeMindmap,
  setColor,
  setLabel,
  setLayout,
  sideOf,
  toggleCollapsed,
} from '../../utils/mindmapTree';
import { breakCoalescing, emptyHistory, recordChange, redo, undo } from '../../utils/mindmapHistory';
import { resolveMindmapKey, type MindmapAction, type MindmapMode } from '../../utils/mindmapKeys';
import { edgePath, layoutMindmap, MINDMAP_METRICS, type MeasureText } from '../../utils/mindmapLayout';
import { parseOutlineHtml, parseOutlineText } from '../../utils/mindmapOutline';
import {
  canCopyImage,
  canvasToPng,
  copyImageToClipboard,
  copyOutlineToClipboard,
  readMindmapPalette,
  renderMindmapCanvas,
} from '../../utils/mindmapExport';
import { downloadBlob, toFileSlug } from '@/utils/download';
import { isEditableElement } from '@/utils/dom';
import MindmapToolbar, { type MindmapExportKind, type MindmapMenu } from './MindmapToolbar';

export type { MindmapContent, MindmapNode } from '../../types/mindmap.types';

interface MindmapEditorProps {
  content: unknown;
  isLocked: boolean;
  isSelected: boolean;
  onChange: (content: MindmapContent) => void;
  /** Räknare från högerklickets "Redigera". Ett nytt värde börjar skriva i noden. */
  editSignal?: number;
  /** Kortets namn, till filnamnet vid nedladdning. */
  title?: string;
}

/** Visas i en tom nod som inte redigeras. */
const PLACEHOLDER = 'Ny nod';

/** Så långt måste pekaren röra sig innan ett klick blir ett drag. */
const DRAG_THRESHOLD_PX = 5;

const NOTICE_MS = 3200;

/** Höjden på remsan överst som verktygsraden står i. Speglar .ws-mindmap__stage. */
const TOOLBAR_GUTTER_PX = 32;

const useIsomorphicLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

type Notice = { text: string; tone: 'success' | 'error' };

/*
 * Mindmap med tangentbordet först, i MindMups anda. Kartan har två lägen —
 * en markerad nod (nav) och en nod man skriver i (edit) — och tangenterna
 * tolkas av resolveMindmapKey. Allt som ändrar kartan går genom `commit`,
 * som lägger det gamla läget i ångra-historiken.
 *
 * Noderna placeras av layoutMindmap och ritas absolut, med grenarna som
 * SVG-kurvor. Samma layout ritar bilden vid export.
 */
export default function MindmapEditor({
  content: rawContent,
  isLocked,
  isSelected,
  onChange,
  editSignal,
  title,
}: MindmapEditorProps) {
  const content = useMemo(() => sanitizeMindmap(rawContent), [rawContent]);

  /*
   * Det senaste innehållet. Sätts direkt vid varje ändring och inte först när
   * kortet ritats om, så att två snabba tangenttryck inte räknar på samma
   * gamla version och det andra skriver över det första.
   */
  const contentRef = useRef(content);
  const lastRaw = useRef(rawContent);
  if (lastRaw.current !== rawContent) {
    lastRaw.current = rawContent;
    contentRef.current = content;
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
  const selectedOnDown = useRef(false);

  const [menu, setMenu] = useState<MindmapMenu>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const rootRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const probeRef = useRef<HTMLSpanElement>(null);
  const probeRootRef = useRef<HTMLSpanElement>(null);

  /* ── Textmätning ── */

  /*
   * Bredden på varje nod mäts med samma typsnitt som noden ritas i. Det läses
   * ur två osynliga mätnoder, och mäts om när webbläsarens typsnitt laddats —
   * innan dess hade bredden räknats på reservtypsnittet.
   */
  const [fonts, setFonts] = useState<{ node: string; root: string } | null>(null);
  useIsomorphicLayoutEffect(() => {
    const read = () => {
      const node = probeRef.current;
      const root = probeRootRef.current;
      if (!node || !root) return;
      const font = (el: HTMLElement) => {
        const style = getComputedStyle(el);
        return `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
      };
      // Ett nytt objekt varje gång, så att mätningen görs om även om
      // typsnittsnamnet är detsamma men filen först nu laddats.
      setFonts({ node: font(node), root: font(root) });
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
    if (!fonts || !ctx) return (text, isRoot) => text.length * (isRoot ? 8.5 : 7);
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

  // En tom nod mäts med platshållaren, så att den får plats även medan man
  // skriver i den.
  const layout = useMemo(
    () => layoutMindmap(content, (text, isRoot) => measure(text || PLACEHOLDER, isRoot)),
    [content, measure],
  );

  /* ── Grundsteg ── */

  const currentId = useCallback((): string => {
    const id = selectedRef.current;
    const c = contentRef.current;
    return id && findNode(c.root, id) ? id : c.root.id;
  }, []);

  const select = useCallback((id: string | null) => {
    selectedRef.current = id;
    setSelectedId(id);
  }, []);

  const focusMap = useCallback(() => {
    scrollRef.current?.focus({ preventScroll: true });
  }, []);

  const commit = useCallback((next: MindmapContent, historyKey: string | null = null) => {
    historyRef.current = recordChange(
      historyRef.current,
      { content: contentRef.current, selectedId: currentId() },
      historyKey,
    );
    contentRef.current = next;
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

    const c = contentRef.current;
    const node = findNode(c.root, id);
    if (node && id !== c.root.id && node.label.trim() === '' && node.children.length === 0) {
      const removed = removeNode(c, id);
      if (removed) {
        contentRef.current = removed.content;
        onChangeRef.current(removed.content);
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
    const c = contentRef.current;
    const id = currentId();

    switch (action.type) {
      case 'addChild': {
        const result = addChild(c, id);
        if (!result) return;
        commit(result.content);
        startEdit(result.id);
        return;
      }
      case 'addSibling': {
        const result = addSibling(c, id, action.where);
        if (!result) return;
        commit(result.content);
        startEdit(result.id);
        return;
      }
      case 'indent': {
        const next = indent(c, id);
        if (next) commit(next);
        return;
      }
      case 'outdent': {
        // Shift+Tab lyfter en nivå. Under roten finns ingen nivå att lyfta
        // till; att byta sida görs med Alt+pil mot roten.
        if (findParent(c.root, id)?.parent.id === c.root.id) return;
        const next = outdent(c, id);
        if (next) commit(next);
        return;
      }
      case 'navigate': {
        const target = navigate(c, id, action.direction);
        if (!target) return;
        if (mode === 'edit') startEdit(target);
        else select(target);
        return;
      }
      case 'move': {
        let next: MindmapContent | null = null;
        if (action.direction === 'up' || action.direction === 'down') {
          next = moveAmongSiblings(c, id, action.direction === 'up' ? -1 : 1);
        } else {
          const side = sideOf(c, id);
          if (!side) return;
          const outward = side === 'right' ? 'right' : 'left';
          next = action.direction === outward ? indent(c, id) : outdent(c, id);
        }
        if (next) commit(next);
        return;
      }
      case 'edit': {
        if (action.replaceWith !== undefined) commit(setLabel(c, id, action.replaceWith), `label:${id}`);
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
        const result = removeNode(c, id);
        if (!result) return;
        commit(result.content);
        if (mode === 'edit') {
          // Noden finns inte längre; finishEdit har inget att städa.
          editingRef.current = null;
          startEdit(result.focusId);
        } else {
          select(result.focusId);
        }
        return;
      }
      case 'toggleCollapse': {
        const next = toggleCollapsed(c, id);
        if (next) commit(next);
        return;
      }
      case 'color':
        commit(setColor(c, id, action.color));
        return;
      case 'undo':
      case 'redo': {
        const step = (action.type === 'undo' ? undo : redo)(historyRef.current, { content: c, selectedId: id });
        if (!step) return;
        historyRef.current = step.history;
        contentRef.current = step.snapshot.content;
        onChangeRef.current(step.snapshot.content);
        const target = findNode(step.snapshot.content.root, step.snapshot.selectedId)
          ? step.snapshot.selectedId
          : step.snapshot.content.root.id;
        if (mode === 'edit') {
          editingRef.current = target;
          setEditingId(target);
        }
        select(target);
        return;
      }
      case 'copy':
      case 'cut': {
        const node = findNode(c.root, id);
        if (!node) return;
        copyOutlineToClipboard(node, 'list')
          .then(() => flash(action.type === 'cut' ? 'Grenen är urklippt.' : 'Grenen är kopierad som punktlista.'))
          .catch(() => flash('Kunde inte kopiera.', 'error'));
        if (action.type === 'cut') {
          const result = removeNode(c, id);
          if (result) {
            commit(result.content);
            select(result.focusId);
          }
        }
        return;
      }
      case 'paste':
        // Webbläsaren skickar en paste-händelse, som handlePaste tar hand om.
        return;
    }
  }, [commit, currentId, finishEdit, flash, focusMap, select, startEdit]);

  const keyContext = useCallback((id: string) => {
    const c = contentRef.current;
    const node = findNode(c.root, id);
    return {
      isRoot: id === c.root.id,
      parentIsRoot: findParent(c.root, id)?.parent.id === c.root.id,
      labelEmpty: (node?.label ?? '') === '',
      hasChildren: (node?.children.length ?? 0) > 0,
      hasPreviousSibling: indent(c, id) !== null,
    };
  }, []);

  /* ── Tangentbordet ── */

  const handleMapKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (isLocked || editingRef.current || isEditableElement(e.target)) return;
    const action = resolveMindmapKey(e.nativeEvent, 'nav', keyContext(currentId()));
    if (!action) return;
    // Tangenten är kartans. Utan stopPropagation hade workspace också flyttat
    // kortet med pilarna eller tagit bort det med Delete.
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
    const next = addChildren(contentRef.current, parentId, nodes);
    if (!next) return false;
    e.preventDefault();
    commit(next);
    select(nodes[0].id);
    return true;
  };

  const handleMapPaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    if (isLocked || editingRef.current || isEditableElement(e.target)) return;
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
    // Ett grepp om en nod flyttar noden, inte kortet.
    e.stopPropagation();
    // Läses före klicket: när knappen trycks ned får kartan fokus och
    // markerar roten, och då hade första klicket på roten börjat redigera.
    selectedOnDown.current = selectedRef.current === id && document.activeElement === scrollRef.current;
    setMenu(null);
    if (isLocked || editingRef.current === id || id === contentRef.current.root.id) return;

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
      const valid = target && canMoveNode(contentRef.current, id, target) ? target : null;
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
      const next = moveNode(contentRef.current, id, target);
      if (next) {
        commit(next);
        select(id);
        focusMap();
      }
    };

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
  };

  const handleNodeClick = (id: string) => {
    if (suppressClick.current) {
      suppressClick.current = false;
      return;
    }
    if (isLocked || editingRef.current === id) return;
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

  /*
   * Rullar så att den markerade noden syns. Rullningen görs för hand i kortets
   * egen ruta: scrollIntoView rullar även workspace-skalet, som har
   * overflow: hidden och då hamnar snett.
   */
  useEffect(() => {
    const el = scrollRef.current;
    const canvas = canvasRef.current;
    const id = editingId ?? selectedId;
    const box = id ? layout.byId.get(id) : null;
    if (!el || !canvas || !box) return;
    // Kartan är centrerad i kortet; offset är dess läge i rullningsytan.
    const left = canvas.offsetLeft + box.x;
    const top = canvas.offsetTop + box.y;
    const pad = 8;
    if (left - pad < el.scrollLeft) el.scrollLeft = left - pad;
    else if (left + box.width + pad > el.scrollLeft + el.clientWidth) {
      el.scrollLeft = left + box.width + pad - el.clientWidth;
    }
    // Överst ligger verktygsraden; noden ska inte gömma sig under den.
    if (top - pad - TOOLBAR_GUTTER_PX < el.scrollTop) el.scrollTop = Math.max(0, top - pad - TOOLBAR_GUTTER_PX);
    else if (top + box.height + pad > el.scrollTop + el.clientHeight) {
      el.scrollTop = top + box.height + pad - el.clientHeight;
    }
  }, [selectedId, editingId, layout]);

  // Högerklickets "Redigera" börjar skriva i den markerade noden, eller i roten.
  const lastSignal = useRef(editSignal);
  useEffect(() => {
    if (editSignal === lastSignal.current) return;
    lastSignal.current = editSignal;
    if (!isLocked) startEdit(currentId());
  }, [editSignal, isLocked, startEdit, currentId]);

  // Ett låst kort går inte att skriva i.
  useEffect(() => {
    if (isLocked && editingRef.current) finishEdit();
  }, [isLocked, finishEdit]);

  /* ── Export ── */

  const handleExport = (kind: MindmapExportKind) => {
    const c = contentRef.current;
    if (kind === 'list' || kind === 'headings') {
      copyOutlineToClipboard(c.root, kind)
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
      .then(() => canvasToPng(renderMindmapCanvas(c, readMindmapPalette(container, { node, root }))));

    if (kind === 'image') {
      copyImageToClipboard(png)
        .then(() => flash('Bilden är kopierad. Klistra in i dokumentet.'))
        .catch(() => flash('Kunde inte kopiera bilden. Ladda ner den som PNG i stället.', 'error'));
      return;
    }
    png
      .then((blob) => downloadBlob(blob, `${toFileSlug(title || c.root.label, 'mindmap')}.png`))
      .catch(() => flash('Kunde inte skapa bilden.', 'error'));
  };

  /* ── Ritning ── */

  const toolbarAction = (action: MindmapAction) => {
    setMenu(null);
    run(action, 'nav');
    if (action.type !== 'addChild') focusMap();
  };

  const showSelection = !isLocked;
  const m = MINDMAP_METRICS;

  return (
    <div
      ref={rootRef}
      className={`ws-mindmap${isLocked ? ' ws-mindmap--locked' : ''}${dragId ? ' ws-mindmap--dragging' : ''}`}
    >
      {(isSelected || menu) && (
        <MindmapToolbar
          isLocked={isLocked}
          layout={content.layout ?? 'right'}
          menu={menu}
          canCopyImage={canCopyImage()}
          onMenu={setMenu}
          onAddChild={() => toolbarAction({ type: 'addChild' })}
          onToggleCollapse={() => toolbarAction({ type: 'toggleCollapse' })}
          onColor={(color: MindmapColor | null) => toolbarAction({ type: 'color', color })}
          onLayout={(next: MindmapLayout) => {
            setMenu(null);
            commit(setLayout(contentRef.current, next));
          }}
          onUndo={() => toolbarAction({ type: 'undo' })}
          onRedo={() => toolbarAction({ type: 'redo' })}
          onExport={handleExport}
        />
      )}

      <div
        ref={scrollRef}
        className="ws-mindmap__scroll"
        tabIndex={isLocked ? -1 : 0}
        aria-label="Mindmap. Tab ger en ny nod under, Enter en ny nod bredvid."
        onKeyDown={handleMapKeyDown}
        onPaste={handleMapPaste}
        onFocus={(e) => {
          if (e.target === e.currentTarget && !selectedRef.current) select(contentRef.current.root.id);
        }}
        onPointerDown={() => setMenu(null)}
      >
        <div className="ws-mindmap__stage">
        <div ref={canvasRef} className="ws-mindmap__canvas" style={{ width: layout.width, height: layout.height }}>
          <svg className="ws-mindmap__edges" width={layout.width} height={layout.height} aria-hidden="true">
            {layout.edges.map((edge) => (
              <path key={`${edge.fromId}-${edge.toId}`} d={edgePath(edge)} className="ws-mindmap__edge" />
            ))}
          </svg>

          {layout.nodes.map((node) => {
            const isEditing = editingId === node.id;
            const classes = [
              'ws-mindmap__node',
              node.isRoot && 'ws-mindmap__node--root',
              node.color && `ws-mindmap__node--${node.color}`,
              showSelection && selectedId === node.id && 'ws-mindmap__node--selected',
              isEditing && 'ws-mindmap__node--editing',
              dragId === node.id && 'ws-mindmap__node--dragged',
              dropId === node.id && 'ws-mindmap__node--drop',
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
                onDoubleClick={() => {
                  if (!isLocked) startEdit(node.id);
                }}
              >
                {isEditing ? (
                  <input
                    ref={inputRef}
                    value={node.label}
                    placeholder={PLACEHOLDER}
                    onChange={(e) => commit(setLabel(contentRef.current, node.id, e.target.value), `label:${node.id}`)}
                    onKeyDown={handleInputKeyDown}
                    onPaste={handleInputPaste}
                    onBlur={() => {
                      // Blur kommer också när en annan nod tar över skrivandet;
                      // då har editingRef redan bytts och det finns inget att avsluta.
                      if (editingRef.current === node.id) finishEdit();
                    }}
                    onPointerDown={(e) => e.stopPropagation()}
                    className="ws-editor-bare-input ws-mindmap__input"
                    style={{ width: node.labelWidth }}
                    aria-label="Nodens text"
                  />
                ) : (
                  <span
                    className={`ws-mindmap__label${node.label ? '' : ' ws-mindmap__label--empty'}`}
                    style={{ width: node.labelWidth }}
                  >
                    {node.label || PLACEHOLDER}
                  </span>
                )}
                {node.hiddenCount > 0 && (
                  <button
                    type="button"
                    className="ws-mindmap__badge"
                    style={{ width: m.badgeWidth }}
                    tabIndex={-1}
                    title="Fäll ut (mellanslag)"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (isLocked) return;
                      const next = toggleCollapsed(contentRef.current, node.id);
                      if (next) commit(next);
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

      {notice && (
        <div className={`ws-mindmap__notice ws-mindmap__notice--${notice.tone}`} role="status" data-export="omit">
          {notice.text}
        </div>
      )}

      {/* Mätnoder: typsnittet för textmätningen läses härifrån. */}
      <span ref={probeRef} className="ws-mindmap__node ws-mindmap__probe" aria-hidden="true">M</span>
      <span ref={probeRootRef} className="ws-mindmap__node ws-mindmap__node--root ws-mindmap__probe" aria-hidden="true">M</span>
    </div>
  );
}
