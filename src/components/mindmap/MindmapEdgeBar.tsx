'use client';

import { RotateCcw, Waypoints, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MINDMAP_ANCHORS, MINDMAP_EDGE_SHAPE_VALUES, type MindmapAnchor, type MindmapEdgeShape } from '@/types/mindmap';

export const EDGE_SHAPE_LABELS: Record<MindmapEdgeShape, string> = { curve: 'Kurva', straight: 'Rak', elbow: 'Vinklad' };
/** Värdet i fästets lista när flera linjer har olika fästen. */
const MIXED = 'mixed';

export const ANCHOR_LABELS: Record<MindmapAnchor, string> = { top: 'Upp', right: 'Höger', bottom: 'Ned', left: 'Vänster' };

interface AnchorSelectProps {
  label: string;
  value: MindmapAnchor | undefined;
  /** Texten för inget val, t.ex. "Auto". */
  autoLabel: string;
  /** Flera markerade linjer med olika val. */
  mixed?: boolean;
  onChange: (side: MindmapAnchor | null) => void;
}

/** Ett fäste att välja: auto eller en av nodens fyra sidor. */
export function AnchorSelect({ label, value, autoLabel, mixed, onChange }: AnchorSelectProps) {
  return (
    <label className="mm__edgebar-field">
      <span>{label}</span>
      <select
        className="sp-input rounded-ui-sm bg-ui-paper px-1 py-0.5 text-sm text-ui-ink"
        value={mixed ? MIXED : value ?? ''}
        onChange={(e) => {
          if (e.target.value !== MIXED) onChange((e.target.value || null) as MindmapAnchor | null);
        }}
      >
        {mixed && <option value={MIXED} disabled>Blandat</option>}
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
  /** Flera markerade linjer med olika form: ingen knapp är nedtryckt. */
  mixed?: boolean;
  /** Knappen för inget val: "Kartans" för en gren, "Böjd" för en tvärlänk. */
  noneLabel: string;
  onChange: (shape: MindmapEdgeShape | null) => void;
}

export function ShapeButtons({ value, noneLabel, mixed, onChange }: ShapeButtonsProps) {
  return (
    <span className="mm__segmented" role="group" aria-label="Form">
      <button type="button" aria-pressed={!mixed && value === undefined} onClick={() => onChange(null)}>{noneLabel}</button>
      {MINDMAP_EDGE_SHAPE_VALUES.map((shape) => (
        <button key={shape} type="button" aria-pressed={!mixed && value === shape} onClick={() => onChange(shape)}>
          {EDGE_SHAPE_LABELS[shape]}
        </button>
      ))}
    </span>
  );
}

interface MindmapEdgeBarProps {
  style: { shape?: MindmapEdgeShape; from?: MindmapAnchor; to?: MindmapAnchor; points?: unknown[] };
  /** Nodernas texter, för rubriken "A → B". */
  fromLabel: string;
  toLabel: string;
  onShape: (shape: MindmapEdgeShape | null) => void;
  onAnchor: (end: 'from' | 'to', side: MindmapAnchor | null) => void;
  onReset: () => void;
  /** Del D: en brytpunkt mitt på linjens längsta sträcka. */
  onAddPoint?: () => void;
  onClose: () => void;
}

/** Lägger en brytpunkt mitt på den längsta sträckan (del D). */
export function AddPointButton({ onClick }: { onClick: () => void }) {
  return (
    <Button
      size="sm"
      variant="neutral"
      className="sp-btn h-7 w-7 p-0"
      title="Ny brytpunkt (eller dubbelklicka på linjen). Dubbelklicka på en punkt för att ta bort den."
      aria-label="Ny brytpunkt"
      onClick={onClick}
    >
      <Waypoints size={14} />
    </Button>
  );
}

/**
 * Raden över kartan när en linje i trädet är markerad
 * (docs/plans/mindmap-placering.md, del C och D): form, start, fäste,
 * brytpunkt och återställ. Det som inte väljs följer kartans val i menyn Linjer.
 */
export function MindmapEdgeBar({ style, fromLabel, toLabel, onShape, onAnchor, onReset, onAddPoint, onClose }: MindmapEdgeBarProps) {
  const tool = 'sp-btn h-7 w-7 p-0';
  return (
    <div className="mm__linkbar" role="toolbar" aria-label="Linje" onPointerDown={(e) => e.stopPropagation()}>
      <span className="mm__linkbar-title" title={`${fromLabel} → ${toLabel}`}>
        {fromLabel || 'Ny nod'} → {toLabel || 'Ny nod'}
      </span>
      <ShapeButtons value={style.shape} noneLabel="Kartans" onChange={onShape} />
      <AnchorSelect label="Start" value={style.from} autoLabel="Kartans" onChange={(side) => onAnchor('from', side)} />
      <AnchorSelect label="Fäste" value={style.to} autoLabel="Kartans" onChange={(side) => onAnchor('to', side)} />
      {onAddPoint && <AddPointButton onClick={onAddPoint} />}
      <Button
        size="sm"
        variant="neutral"
        className={tool}
        title="Återställ linjen till kartans val"
        aria-label="Återställ linje"
        disabled={!style.shape && !style.from && !style.to && !style.points}
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
