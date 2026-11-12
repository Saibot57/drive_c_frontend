'use client';

import { useEffect, useRef } from 'react';
import { ArrowLeftRight, MoveHorizontal, MoveRight, Minus, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MINDMAP_COLORS, MINDMAP_COLOR_LABELS, type MindmapAnchor, type MindmapColor, type MindmapEdgeShape } from '@/types/mindmap';
import { AddPointButton, AnchorSelect, ShapeButtons } from './MindmapEdgeBar';
import { MAX_CROSS_LINK_LABEL_LENGTH, type MindmapCrossLink } from '@/types/mindmapDoc';

interface MindmapLinkBarProps {
  link: MindmapCrossLink;
  /** Nodernas texter, för rubriken "A → B". */
  fromLabel: string;
  toLabel: string;
  /** Byts när etikettfältet ska få fokus (dubbelklick på kurvan). */
  focusTick: number;
  onLabel: (label: string) => void;
  onArrow: (arrow: NonNullable<MindmapCrossLink['arrow']>) => void;
  onReverse: () => void;
  onColor: (color: MindmapColor | null) => void;
  /** Form och fästen (del C i docs/plans/mindmap-placering.md). */
  onShape: (shape: MindmapEdgeShape | null) => void;
  onAnchor: (end: 'from' | 'to', side: MindmapAnchor | null) => void;
  /** Brytpunkter (del D). */
  pointCount?: number;
  onAddPoint?: () => void;
  onClearPoints?: () => void;
  onRemove: () => void;
  /** Esc eller Enter i etikettfältet: tillbaka till kartan. */
  onReturn: () => void;
}

const ARROWS: { arrow: NonNullable<MindmapCrossLink['arrow']>; label: string; Icon: typeof MoveRight }[] = [
  { arrow: 'to', label: 'Pil åt ett håll', Icon: MoveRight },
  { arrow: 'both', label: 'Pil åt båda hållen', Icon: MoveHorizontal },
  { arrow: 'none', label: 'Ingen pil', Icon: Minus },
];

/**
 * Raden som visas över kartan när en tvärlänk är markerad: etikett, pil,
 * riktning, form och fästen, färg och ta bort. Delete på tangentbordet tar också bort länken.
 */
export function MindmapLinkBar({
  link,
  fromLabel,
  toLabel,
  focusTick,
  onLabel,
  onArrow,
  onReverse,
  onColor,
  onShape,
  onAnchor,
  pointCount = 0,
  onAddPoint,
  onClearPoints,
  onRemove,
  onReturn,
}: MindmapLinkBarProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (focusTick > 0) inputRef.current?.focus({ preventScroll: true });
  }, [focusTick, link.id]);

  const tool = 'sp-btn h-7 w-7 p-0';
  const arrow = link.arrow ?? 'to';

  return (
    <div className="mm__linkbar" role="toolbar" aria-label="Tvärlänk" onPointerDown={(e) => e.stopPropagation()}>
      <span className="mm__linkbar-title" title={`${fromLabel} → ${toLabel}`}>
        {fromLabel || 'Ny nod'} → {toLabel || 'Ny nod'}
      </span>
      <input
        ref={inputRef}
        className="sp-input w-40 rounded-ui-sm bg-ui-paper px-2 py-0.5 text-sm text-ui-ink"
        value={link.label ?? ''}
        maxLength={MAX_CROSS_LINK_LABEL_LENGTH}
        placeholder="Etikett"
        aria-label="Länkens etikett"
        onChange={(e) => onLabel(e.target.value)}
        onKeyDown={(e) => {
          if (e.key !== 'Escape' && e.key !== 'Enter') return;
          e.preventDefault();
          e.stopPropagation();
          onReturn();
        }}
      />
      {ARROWS.map(({ arrow: value, label, Icon }) => (
        <Button key={value} size="sm" variant="neutral" className={tool} aria-pressed={arrow === value} title={label} aria-label={label} onClick={() => onArrow(value)}>
          <Icon size={14} />
        </Button>
      ))}
      <Button size="sm" variant="neutral" className={tool} title="Byt riktning" aria-label="Byt riktning" onClick={onReverse}>
        <ArrowLeftRight size={14} />
      </Button>
      <span className="mm__swatches mm__swatches--tight">
        {MINDMAP_COLORS.map((color) => (
          <button
            key={color}
            type="button"
            className={`mm__swatch mm__swatch--${color}`}
            aria-pressed={link.color === color}
            title={MINDMAP_COLOR_LABELS[color]}
            aria-label={MINDMAP_COLOR_LABELS[color]}
            onClick={() => onColor(color)}
          />
        ))}
        <button type="button" className="mm__swatch mm__swatch--none" title="Ingen färg" aria-label="Ingen färg" onClick={() => onColor(null)}>
          <X size={11} />
        </button>
      </span>
      <ShapeButtons value={link.shape} noneLabel="Böjd" onChange={onShape} />
      <AnchorSelect label="Start" value={link.fromAnchor} autoLabel="Auto" onChange={(side) => onAnchor('from', side)} />
      <AnchorSelect label="Fäste" value={link.toAnchor} autoLabel="Auto" onChange={(side) => onAnchor('to', side)} />
      {onAddPoint && <AddPointButton onClick={onAddPoint} />}
      {onClearPoints && pointCount > 0 && (
        <Button size="sm" variant="neutral" className="sp-btn h-7 px-2 text-xs" title="Ta bort länkens brytpunkter" onClick={onClearPoints}>
          Rensa punkter
        </Button>
      )}
      <Button size="sm" variant="neutral" className={tool} title="Ta bort länken (Delete)" aria-label="Ta bort länken" onClick={onRemove}>
        <Trash2 size={14} />
      </Button>
    </div>
  );
}
