'use client';

import { RotateCcw, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MINDMAP_ANCHORS, MINDMAP_EDGE_SHAPE_VALUES, type MindmapAnchor, type MindmapEdgeShape } from '@/types/mindmap';

export const EDGE_SHAPE_LABELS: Record<MindmapEdgeShape, string> = { curve: 'Kurva', straight: 'Rak', elbow: 'Vinklad' };
export const ANCHOR_LABELS: Record<MindmapAnchor, string> = { top: 'Upp', right: 'Höger', bottom: 'Ned', left: 'Vänster' };

interface AnchorSelectProps {
  label: string;
  value: MindmapAnchor | undefined;
  /** Texten för inget val, t.ex. "Auto". */
  autoLabel: string;
  onChange: (side: MindmapAnchor | null) => void;
}

/** Ett fäste att välja: auto eller en av nodens fyra sidor. */
export function AnchorSelect({ label, value, autoLabel, onChange }: AnchorSelectProps) {
  return (
    <label className="mm__edgebar-field">
      <span>{label}</span>
      <select
        className="sp-input rounded-ui-sm bg-ui-paper px-1 py-0.5 text-sm text-ui-ink"
        value={value ?? ''}
        onChange={(e) => onChange((e.target.value || null) as MindmapAnchor | null)}
      >
        <option value="">{autoLabel}</option>
        {MINDMAP_ANCHORS.map((side) => (
          <option key={side} value={side}>{ANCHOR_LABELS[side]}</option>
        ))}
      </select>
    </label>
  );
}

interface ShapeButtonsProps {
  value: MindmapEdgeShape | undefined;
  /** Knappen för inget val: "Kartans" för en gren, "Böjd" för en tvärlänk. */
  noneLabel: string;
  onChange: (shape: MindmapEdgeShape | null) => void;
}

export function ShapeButtons({ value, noneLabel, onChange }: ShapeButtonsProps) {
  return (
    <span className="mm__segmented" role="group" aria-label="Form">
      <button type="button" aria-pressed={value === undefined} onClick={() => onChange(null)}>{noneLabel}</button>
      {MINDMAP_EDGE_SHAPE_VALUES.map((shape) => (
        <button key={shape} type="button" aria-pressed={value === shape} onClick={() => onChange(shape)}>
          {EDGE_SHAPE_LABELS[shape]}
        </button>
      ))}
    </span>
  );
}

interface MindmapEdgeBarProps {
  style: { shape?: MindmapEdgeShape; from?: MindmapAnchor; to?: MindmapAnchor };
  /** Nodernas texter, för rubriken "A → B". */
  fromLabel: string;
  toLabel: string;
  onShape: (shape: MindmapEdgeShape | null) => void;
  onAnchor: (end: 'from' | 'to', side: MindmapAnchor | null) => void;
  onReset: () => void;
  onClose: () => void;
}

/**
 * Raden över kartan när en linje i trädet är markerad
 * (docs/plans/mindmap-placering.md, del C): form, start, fäste och
 * återställ. Det som inte väljs följer kartans val i menyn Linjer.
 */
export function MindmapEdgeBar({ style, fromLabel, toLabel, onShape, onAnchor, onReset, onClose }: MindmapEdgeBarProps) {
  const tool = 'sp-btn h-7 w-7 p-0';
  return (
    <div className="mm__linkbar" role="toolbar" aria-label="Linje" onPointerDown={(e) => e.stopPropagation()}>
      <span className="mm__linkbar-title" title={`${fromLabel} → ${toLabel}`}>
        {fromLabel || 'Ny nod'} → {toLabel || 'Ny nod'}
      </span>
      <ShapeButtons value={style.shape} noneLabel="Kartans" onChange={onShape} />
      <AnchorSelect label="Start" value={style.from} autoLabel="Kartans" onChange={(side) => onAnchor('from', side)} />
      <AnchorSelect label="Fäste" value={style.to} autoLabel="Kartans" onChange={(side) => onAnchor('to', side)} />
      <Button
        size="sm"
        variant="neutral"
        className={tool}
        title="Återställ linjen till kartans val"
        aria-label="Återställ linje"
        disabled={!style.shape && !style.from && !style.to}
        onClick={onReset}
      >
        <RotateCcw size={14} />
      </Button>
      <Button size="sm" variant="neutral" className={tool} title="Stäng (Esc)" aria-label="Stäng" onClick={onClose}>
        <X size={14} />
      </Button>
    </div>
  );
}
