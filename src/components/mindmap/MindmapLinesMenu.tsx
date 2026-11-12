'use client';

import type { MindmapEdgeShape } from '@/types/mindmap';
import { MINDMAP_EDGE_SHAPES, MINDMAP_LINE_ANCHORS, type MindmapLineAnchor, type MindmapLines } from '@/types/mindmapDoc';
import { resolveLines } from '@/utils/mindmapRouting';

const SHAPE_LABELS: Record<MindmapEdgeShape, string> = { curve: 'Kurva', straight: 'Rak', elbow: 'Vinklad' };
const ANCHOR_LABELS: Record<MindmapLineAnchor, string> = { nearest: 'Närmaste kant', side: 'Efter grensidan' };

interface MindmapLinesMenuProps {
  lines: MindmapLines | undefined;
  onLines: (patch: MindmapLines) => void;
  /** Kartans rutnät (del B). Utan `onGrid` visas inget val. */
  grid?: boolean;
  onGrid?: (on: boolean) => void;
}

/**
 * Kartans linjer i verktygsraden (docs/plans/mindmap-placering.md, del A):
 * form och var linjerna fäster. Gäller alla grenars linjer i kartan. Här
 * finns också rutnätet (del B), som rör placeringen.
 */
export function MindmapLinesMenu({ lines, onLines, grid, onGrid }: MindmapLinesMenuProps) {
  const current = resolveLines(lines);
  return (
    <div className="mm__popover mm__color-menu">
      <div className="mm__lines-group" role="group" aria-label="Linjernas form">
        <span className="mm__color-caption">Form</span>
        <div className="mm__segmented">
          {MINDMAP_EDGE_SHAPES.map((shape) => (
            <button key={shape} type="button" aria-pressed={current.shape === shape} onClick={() => onLines({ shape })}>
              {SHAPE_LABELS[shape]}
            </button>
          ))}
        </div>
      </div>
      <div className="mm__lines-group" role="group" aria-label="Var linjerna fäster">
        <span className="mm__color-caption">Fäste</span>
        <div className="mm__segmented">
          {[...MINDMAP_LINE_ANCHORS].reverse().map((anchor) => (
            <button key={anchor} type="button" aria-pressed={current.anchor === anchor} onClick={() => onLines({ anchor })}>
              {ANCHOR_LABELS[anchor]}
            </button>
          ))}
        </div>
        <p className="mm__menu-hint">
          Närmaste kant: linjen går ut från den sida som vetter mot noden, också när en nod flyttats förbi sin förälder.
        </p>
      </div>
      {onGrid && (
        <div className="mm__lines-group">
          <label className="mm__swatch-option">
            <input type="checkbox" checked={!!grid} onChange={(e) => onGrid(e.target.checked)} />
            Rutnät
          </label>
          <p className="mm__menu-hint">Noderna snäpper till rutnätet när de släpps. Håll Ctrl för att släppa fritt.</p>
        </div>
      )}
    </div>
  );
}
