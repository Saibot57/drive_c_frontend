'use client';

import { Trash2 } from 'lucide-react';
import type { WorkspaceElement } from '../types/workspace.types';
import { TYPE_COLORS } from '../types/constants';

interface LibraryCardProps {
  element: WorkspaceElement;
  icon: React.ReactNode;
  onPointerDown: (element: WorkspaceElement, event: React.PointerEvent) => void;
  onDelete: (elementId: string) => void;
}

/**
 * Ett element i biblioteket. Motsvarar AreaLibraryCard i temakalendern:
 * dras ut på ytan för att placeras, och berättar var det redan finns.
 */
export default function LibraryCard({
  element,
  icon,
  onPointerDown,
  onDelete,
}: LibraryCardProps) {
  const count = element.surface_count ?? 0;

  return (
    <div
      className="ws-library-card"
      onPointerDown={(event) => onPointerDown(element, event)}
      title="Dra ut på ytan för att placera"
    >
      <span
        className="ws-type-chip"
        style={{ '--ws-type-color': TYPE_COLORS[element.type] } as React.CSSProperties}
      >
        {icon}
      </span>
      <span className="ws-library-card__body">
        <span className="ws-library-card__title">{element.title}</span>
        <span className="ws-library-card__meta">
          {count === 0 ? 'Inte placerad' : count === 1 ? 'På 1 yta' : `På ${count} ytor`}
        </span>
      </span>
      <button
        className="ws-library-card__delete"
        onPointerDown={(event) => event.stopPropagation()}
        onClick={() => onDelete(element.id)}
        aria-label={`Ta bort ${element.title}`}
        title="Ta bort ur biblioteket"
      >
        <Trash2 size={12} />
      </button>
    </div>
  );
}
