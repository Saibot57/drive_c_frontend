'use client';

import { crossLinkHeadPoints, crossLinkPath, type CrossLinkPoint, type CrossLinkShape } from '@/utils/mindmapCrossLinks';

interface MindmapLinkLayerProps {
  width: number;
  height: number;
  shapes: CrossLinkShape[];
  selectedId: string | null;
  /** En länk som håller på att dras med Shift+dra: från nodens mitt till pekaren. */
  draft: { from: CrossLinkPoint; to: CrossLinkPoint } | null;
  onSelect: (id: string) => void;
  /** Dubbelklick: skriv länkens etikett. */
  onEditLabel: (id: string) => void;
}

/**
 * Tvärlänkarna, i ett eget SVG-lager ovanpå noderna. Bara kurvorna tar emot
 * pekaren; resten av lagret släpper igenom den till noderna under. Varje
 * kurva har en bred osynlig linje att träffa, eftersom den synliga är tunn.
 */
export function MindmapLinkLayer({ width, height, shapes, selectedId, draft, onSelect, onEditLabel }: MindmapLinkLayerProps) {
  if (shapes.length === 0 && !draft) return null;
  return (
    <svg className="mm__links" width={width} height={height}>
      {shapes.map((shape) => {
        const path = crossLinkPath(shape);
        const label = shape.link.label?.trim();
        return (
          <g
            key={shape.id}
            className={`mm__link${selectedId === shape.id ? ' mm__link--selected' : ''}`}
            data-mm-link={shape.id}
          >
            {shape.link.color && <path d={path} className={`mm__link-color mm__link-color--${shape.link.color}`} />}
            <path d={path} className="mm__link-line" />
            {shape.heads.map((head, index) => (
              <polygon key={index} points={crossLinkHeadPoints(head)} className="mm__link-head" />
            ))}
            {label && (
              <text x={shape.middle.x} y={shape.middle.y} className="mm__link-label" textAnchor="middle" dominantBaseline="central">
                {label}
              </text>
            )}
            <path
              d={path}
              className="mm__link-hit"
              onPointerDown={(e) => {
                // Annars börjar ytan panorera.
                e.stopPropagation();
                onSelect(shape.id);
              }}
              onDoubleClick={(e) => {
                e.stopPropagation();
                onEditLabel(shape.id);
              }}
            >
              <title>Tvärlänk. Dubbelklicka för att skriva en etikett.</title>
            </path>
          </g>
        );
      })}
      {draft && (
        <line x1={draft.from.x} y1={draft.from.y} x2={draft.to.x} y2={draft.to.y} className="mm__link-line mm__link-draft" />
      )}
    </svg>
  );
}
