'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { X } from 'lucide-react';
import type { MindmapContent } from '@/types/mindmap';
import type { MindmapDoc } from '@/types/mindmapDoc';
import type { MindmapImages } from '@/hooks/useMindmapImages';
import { edgePath, type MindmapLayoutResult } from '@/utils/mindmap/mindmapLayout';
import { crossLinkGeometry } from '@/utils/mindmapCrossLinks';
import {
  presentDoc,
  presentFocus,
  presentNext,
  presentPrev,
  presentProgress,
  presentSibling,
  presentStart,
  presentToggle,
  presentView,
  resolvePresentKey,
  type PresentState,
} from '@/utils/mindmapPresent';
import { MindmapLinkLayer } from './MindmapLinkLayer';
import { MindmapNodeView } from './MindmapNodeView';

interface MindmapPresentProps {
  /** Det som presenteras: hela kartan, eller grenen om bara den visas. */
  doc: MindmapDoc;
  /** Sidans layout, med dess textmätning. */
  layoutOf: (content: MindmapContent) => MindmapLayoutResult;
  images: MindmapImages;
  onClose: () => void;
}

const noop = () => undefined;

/*
 * Presentationsläget: kartan stegas fram gren för gren, med tangentbordet
 * eller en presentationsfjärr. Samma noder, kanter och tvärlänkar som i
 * kartan, men ingenting går att ändra: hopfällningen är lägets egen
 * (utils/mindmapPresent.ts) och dokumentet rörs inte.
 *
 * Ritas inuti kartans ruta och täcker den. Rutan är i helskärm när
 * webbläsaren tillåter det (useMindmapPresenting).
 */
export function MindmapPresent({ doc, layoutOf, images, onClose }: MindmapPresentProps) {
  const [state, setState] = useState<PresentState>(() => presentStart(doc.root));
  const [size, setSize] = useState({ width: 0, height: 0 });
  const frameRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const shown = useMemo(() => presentDoc(doc, state), [doc, state]);
  const layout = useMemo(() => layoutOf(shown), [layoutOf, shown]);
  const shapes = useMemo(() => crossLinkGeometry(layout, shown), [layout, shown]);
  const view = useMemo(
    () => presentView(layout, presentFocus(layout, shown.root, state), size),
    [layout, shown, state, size],
  );
  const progress = presentProgress(doc.root, state);
  const imageKeys = useMemo(() => new Map(images.refs.map((ref) => [ref.nodeId, ref.key])), [images.refs]);

  // Tangenterna går hit så länge läget är öppet.
  useEffect(() => {
    frameRef.current?.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return undefined;
    const measure = () => setSize({ width: frame.clientWidth, height: frame.clientHeight });
    measure();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(measure);
    observer.observe(frame);
    return () => observer.disconnect();
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const action = resolvePresentKey(e.nativeEvent);
    if (!action) return;
    e.preventDefault();
    e.stopPropagation();
    if (action === 'exit') onClose();
    else if (action === 'home') setState(presentStart(doc.root));
    else if (action === 'next') setState((current) => presentNext(doc.root, current));
    else if (action === 'prev') setState((current) => presentPrev(doc.root, current));
    else setState((current) => presentSibling(doc.root, current, action === 'down' ? 1 : -1));
  };

  const toggle = (id: string) => setState((current) => presentToggle(doc.root, current, id));

  return (
    <div
      ref={frameRef}
      className="mm-present"
      role="dialog"
      aria-modal="true"
      aria-label="Presentation av kartan"
      tabIndex={-1}
      onKeyDown={handleKeyDown}
    >
      <div
        className="mm-present__layer"
        // Dold tills ytan är mätt, så att kartan inte hoppar på plats.
        style={{
          width: layout.width,
          height: layout.height,
          transform: `translate(${view.x}px, ${view.y}px) scale(${view.zoom})`,
          visibility: size.width > 0 ? 'visible' : 'hidden',
        }}
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
            selected={node.id === state.current}
            editing={false}
            dragged={false}
            dropTarget={false}
            imageState={imageKeys.get(node.id) ? images.get(imageKeys.get(node.id)!) : undefined}
            inputRef={inputRef}
            onPointerDown={noop}
            onClick={toggle}
            onEdit={noop}
            onLabel={noop}
            onInputKeyDown={noop}
            onInputPaste={noop}
            onInputBlur={noop}
            onOpenNote={noop}
            onExpand={toggle}
          />
        ))}

        <MindmapLinkLayer
          width={layout.width}
          height={layout.height}
          shapes={shapes}
          selectedId={null}
          draft={null}
          onSelect={noop}
          onEditLabel={noop}
        />
      </div>

      <div className="mm-present__bar">
        <span className="mm-present__progress" role="status">
          {progress.total > 0 ? `${progress.done} av ${progress.total}` : 'Hela kartan visas'}
        </span>
        <span className="mm-present__hint">Mellanslag: nästa · ←: tillbaka · ↑↓: byt gren · Esc: avsluta</span>
        <button type="button" className="mm-present__close" onClick={onClose} aria-label="Avsluta presentationen" title="Avsluta (Esc)">
          <X size={14} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
