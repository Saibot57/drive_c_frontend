'use client';

import type { MindmapImageState } from '@/hooks/useMindmapImages';
import { MINDMAP_EXTRA_METRICS, MINDMAP_METRICS, type LaidOutNode } from '@/utils/mindmap/mindmapLayout';
import { LinkSymbol, MINDMAP_ICON_COMPONENTS, NoteSymbol } from './mindmapIcons';
import { MindmapNodeImage } from './MindmapNodeImage';

/** Visas i en tom nod som inte redigeras. */
export const MINDMAP_PLACEHOLDER = 'Ny nod';

export interface MindmapNodeViewProps {
  node: LaidOutNode;
  selected: boolean;
  editing: boolean;
  /** Noden dras just nu. Den släpper då igenom pekaren, så att noden under går att träffa. */
  dragged: boolean;
  /** Noden är släppmålet för den som dras. */
  dropTarget: boolean;
  /** En tvärlänk håller på att göras från noden. */
  linking?: boolean;
  /** Läget för nodens bild, om den har en. */
  imageState: MindmapImageState | undefined;
  /** Textfältet i noden som redigeras; kartan sätter fokus i det. */
  inputRef: React.RefObject<HTMLTextAreaElement>;
  /** Visa handtaget för nodens bredd (den markerade noden, utom medan man skriver). */
  resizable?: boolean;
  /** Bredden dras just nu. */
  resizing?: boolean;
  onResizeStart?: (e: React.PointerEvent<HTMLElement>, node: LaidOutNode) => void;
  /** Dubbelklick på handtaget: tillbaka till standardbredden. */
  onResizeReset?: (id: string) => void;
  onPointerDown: (e: React.PointerEvent<HTMLDivElement>, id: string) => void;
  onClick: (id: string) => void;
  onEdit: (id: string) => void;
  onLabel: (id: string, label: string) => void;
  onInputKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onInputPaste: (e: React.ClipboardEvent<HTMLTextAreaElement>) => void;
  onInputBlur: (id: string) => void;
  onOpenNote: (id: string) => void;
  onExpand: (id: string) => void;
}

const stop = (e: React.SyntheticEvent) => e.stopPropagation();

/**
 * En nod i kartan: ikon, etikett eller textfält, symboler för anteckning och
 * länk, "+3" på en hopfälld gren och bilden under. Platsen och måtten kommer
 * från layouten; allt som ändrar kartan görs av MindmapCanvas genom
 * händelserna här.
 */
export function MindmapNodeView({
  node,
  selected,
  editing,
  dragged,
  dropTarget,
  linking,
  imageState,
  inputRef,
  resizable,
  resizing,
  onResizeStart,
  onResizeReset,
  onPointerDown,
  onClick,
  onEdit,
  onLabel,
  onInputKeyDown,
  onInputPaste,
  onInputBlur,
  onOpenNote,
  onExpand,
}: MindmapNodeViewProps) {
  const m = MINDMAP_METRICS;
  const x = MINDMAP_EXTRA_METRICS;
  const NodeIcon = node.icon ? MINDMAP_ICON_COMPONENTS[node.icon] : null;
  const lineCount = node.lines?.length ?? 1;
  // Radhöjden sätts bara med radbrytning; utan den är noden som förut.
  const lineStyle = node.lineHeight ? { lineHeight: `${node.lineHeight}px` } : undefined;
  const classes = [
    'mm__node',
    node.isRoot && 'mm__node--root',
    node.image && 'mm__node--image',
    node.color && `mm__node--${node.color}`,
    selected && 'mm__node--selected',
    editing && 'mm__node--editing',
    dragged && 'mm__node--dragged',
    dropTarget && 'mm__node--drop',
    linking && 'mm__node--linking',
  ].filter(Boolean).join(' ');

  return (
    <div
      data-mm-id={node.id}
      className={classes}
      style={{ left: node.x, top: node.y, width: node.width, height: node.height }}
      onPointerDown={(e) => onPointerDown(e, node.id)}
      onClick={() => onClick(node.id)}
      onDoubleClick={() => onEdit(node.id)}
    >
      <div
        className="mm__row"
        style={{
          height: node.rowHeight ? node.rowHeight - 2 * (node.isRoot ? m.rootBorder : m.border) : undefined,
          paddingInline: node.isRoot ? m.rootPadX : m.padX,
        }}
      >
        {NodeIcon && <span className="mm__icon" aria-hidden="true"><NodeIcon size={x.iconSize} /></span>}
        {editing ? (
          <textarea
            ref={inputRef}
            value={node.label}
            rows={lineCount}
            wrap="soft"
            spellCheck={false}
            placeholder={MINDMAP_PLACEHOLDER}
            onChange={(e) => onLabel(node.id, e.target.value)}
            onKeyDown={onInputKeyDown}
            onPaste={onInputPaste}
            onBlur={() => onInputBlur(node.id)}
            onPointerDown={stop}
            className="mm__input"
            style={{ width: node.labelWidth, ...lineStyle }}
            aria-label="Nodens text"
          />
        ) : (
          <span className={`mm__label${node.label ? '' : ' mm__label--empty'}`} style={{ width: node.labelWidth, ...lineStyle }}>
            {node.lines && node.lines.length > 1
              // Raderna som layouten räknat ut, så att skärmen blir som bilden.
              ? node.lines.map((line, index) => <span key={index} className="mm__line">{line}</span>)
              : node.label || MINDMAP_PLACEHOLDER}
          </span>
        )}
        {node.hasNote && (
          <button
            type="button"
            className="mm__marker"
            tabIndex={-1}
            title="Anteckning (Alt+N)"
            aria-label="Visa anteckningen"
            onPointerDown={stop}
            onClick={(e) => {
              e.stopPropagation();
              onOpenNote(node.id);
            }}
          >
            <NoteSymbol size={x.markerSize} />
          </button>
        )}
        {node.link && (
          <a
            className="mm__marker"
            href={node.link}
            target="_blank"
            rel="noopener noreferrer"
            tabIndex={-1}
            title={node.link}
            aria-label="Öppna länken i en ny flik"
            draggable={false}
            onPointerDown={stop}
            onClick={stop}
          >
            <LinkSymbol size={x.markerSize} />
          </a>
        )}
        {node.hiddenCount > 0 && (
          <button
            type="button"
            className="mm__badge"
            style={{ width: m.badgeWidth }}
            tabIndex={-1}
            title="Fäll ut (mellanslag)"
            onPointerDown={stop}
            onClick={(e) => {
              e.stopPropagation();
              onExpand(node.id);
            }}
          >
            +{node.hiddenCount}
          </button>
        )}
      </div>
      {node.image && <MindmapNodeImage width={node.image.width} height={node.image.height} state={imageState} />}
      {(resizable || resizing) && onResizeStart && (
        // På kanten bort från roten: där noden växer.
        <span
          className={`mm__resize mm__resize--${node.side === 'left' ? 'left' : 'right'}${resizing ? ' mm__resize--active' : ''}`}
          title="Dra för att ändra bredden (Ctrl+Shift+← →). Dubbelklick: standardbredd."
          aria-hidden="true"
          onPointerDown={(e) => onResizeStart(e, node)}
          onClick={stop}
          onDoubleClick={(e) => {
            e.stopPropagation();
            onResizeReset?.(node.id);
          }}
        />
      )}
    </div>
  );
}
