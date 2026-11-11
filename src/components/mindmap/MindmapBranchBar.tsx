'use client';

import { Maximize } from 'lucide-react';
import { MINDMAP_PLACEHOLDER } from './MindmapNodeView';

/** Listen över kartan när bara en gren visas. */
export function MindmapBranchBar({ label, onExit }: { label: string; onExit: () => void }) {
  return (
    <div className="mm__branchbar" role="status">
      <span className="mm__branchbar-text">
        Visar grenen <strong>{label.trim() || MINDMAP_PLACEHOLDER}</strong>. Esc visar hela kartan.
      </span>
      <button
        type="button"
        className="mm__branchbar-exit"
        // Kartan ska behålla fokus, så att Esc och pilarna fortsätter gälla.
        onPointerDown={(e) => e.preventDefault()}
        onClick={onExit}
      >
        <Maximize size={13} aria-hidden="true" /> Hela kartan
      </button>
    </div>
  );
}
