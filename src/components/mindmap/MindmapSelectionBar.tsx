'use client';

import { FoldVertical, ListTree, RotateCcw, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MINDMAP_ICONS, type MindmapAnchor, type MindmapEdgeShape, type MindmapIcon, type MindmapNode } from '@/types/mindmap';
import { findNode } from '@/utils/mindmap/mindmapTree';
import { commonValue, type MindmapGroup, type SelectionRect } from '@/utils/mindmapSelection';
import type { MindmapGroupEdgeAction, MindmapGroupNodeAction } from '@/utils/mindmapGroup';
import { AnchorSelect, ShapeButtons } from './MindmapEdgeBar';
import { MINDMAP_ICON_LABELS } from './mindmapIcons';

/*
 * Flera markerade (docs/plans/mindmap-arrangera.md, del A): ramen som ritas
 * medan man drar, och raden över kartan med det som går att göra med alla.
 * Färgen väljs i verktygsraden, som för en nod.
 */

/** Ramen medan Cmd+dra pågår, i kartans koordinater. */
export function MindmapSelectionFrame({ rect }: { rect: SelectionRect | null }) {
  if (!rect) return null;
  return <div className="mm__frame" aria-hidden="true" style={{ left: rect.x, top: rect.y, width: rect.width, height: rect.height }} />;
}

interface MindmapSelectionBarProps {
  root: MindmapNode;
  /** De markerade; en linje heter efter noden den går till. */
  group: MindmapGroup;
  onNodes: (action: MindmapGroupNodeAction) => void;
  onEdges: (action: MindmapGroupEdgeAction) => void;
  onClose: () => void;
}

const ICON_NONE = '';
const ICON_MIXED = 'mixed';

const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

const nodesOf = (root: MindmapNode, ids: string[]) => ids.map((id) => findNode(root, id)).filter((n): n is MindmapNode => !!n);

export function MindmapSelectionBar({ root, group, onNodes, onEdges, onClose }: MindmapSelectionBarProps) {
  const tool = 'sp-btn h-7 w-7 p-0';
  const nodes = nodesOf(root, group.nodes);
  const edges = nodesOf(root, group.edges);
  const icon = commonValue(nodes.map((node) => node.icon));
  const shape = commonValue(edges.map((node) => node.edge?.shape));
  const from = commonValue(edges.map((node) => node.edge?.from));
  const to = commonValue(edges.map((node) => node.edge?.to));
  const anyStyle = edges.some((node) => node.edge);
  const title = [nodes.length > 0 && count(nodes.length, 'nod', 'noder'), edges.length > 0 && count(edges.length, 'linje', 'linjer')]
    .filter(Boolean)
    .join(' och ');
  const anchor = (value: MindmapAnchor | 'mixed' | undefined) => (value === 'mixed' ? undefined : value);

  return (
    <div className="mm__linkbar mm__selectionbar" role="toolbar" aria-label="Markerade" onPointerDown={(e) => e.stopPropagation()}>
      <span className="mm__linkbar-title">{title} markerade</span>
      {nodes.length > 0 && (
        <>
          <label className="mm__edgebar-field">
            <span>Ikon</span>
            <select
              className="sp-input rounded-ui-sm bg-ui-paper px-1 py-0.5 text-sm text-ui-ink"
              value={icon === 'mixed' ? ICON_MIXED : icon ?? ICON_NONE}
              onChange={(e) => {
                if (e.target.value !== ICON_MIXED) onNodes({ type: 'icon', icon: (e.target.value || null) as MindmapIcon | null });
              }}
            >
              {icon === 'mixed' && <option value={ICON_MIXED} disabled>Blandat</option>}
              <option value={ICON_NONE}>Ingen</option>
              {MINDMAP_ICONS.map((value) => (
                <option key={value} value={value}>{MINDMAP_ICON_LABELS[value]}</option>
              ))}
            </select>
          </label>
          <Button size="sm" variant="neutral" className={tool} title="Fäll ihop eller ut (mellanslag)" aria-label="Fäll ihop eller ut" onClick={() => onNodes({ type: 'toggleCollapse' })}>
            <FoldVertical size={14} />
          </Button>
          <Button size="sm" variant="neutral" className={tool} title="Städa upp grenarna" aria-label="Städa upp grenarna" onClick={() => onNodes({ type: 'tidy' })}>
            <ListTree size={14} />
          </Button>
          <Button size="sm" variant="neutral" className={tool} title="Ta bort noderna med grenarna (Delete)" aria-label="Ta bort noderna" onClick={() => onNodes({ type: 'remove' })}>
            <Trash2 size={14} />
          </Button>
        </>
      )}
      {edges.length > 0 && (
        <>
          <ShapeButtons
            value={shape === 'mixed' ? undefined : (shape as MindmapEdgeShape | undefined)}
            mixed={shape === 'mixed'}
            noneLabel="Kartans"
            onChange={(next) => onEdges({ type: 'shape', shape: next })}
          />
          <AnchorSelect label="Start" value={anchor(from)} mixed={from === 'mixed'} autoLabel="Kartans" onChange={(side) => onEdges({ type: 'anchor', end: 'from', side })} />
          <AnchorSelect label="Fäste" value={anchor(to)} mixed={to === 'mixed'} autoLabel="Kartans" onChange={(side) => onEdges({ type: 'anchor', end: 'to', side })} />
          <Button
            size="sm"
            variant="neutral"
            className={tool}
            title="Återställ linjerna till kartans val"
            aria-label="Återställ linjerna"
            disabled={!anyStyle}
            onClick={() => onEdges({ type: 'reset' })}
          >
            <RotateCcw size={14} />
          </Button>
        </>
      )}
      <Button size="sm" variant="neutral" className={tool} title="Släpp markeringen (Esc)" aria-label="Släpp markeringen" onClick={onClose}>
        <X size={14} />
      </Button>
    </div>
  );
}
