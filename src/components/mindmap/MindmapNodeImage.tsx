'use client';

import type { MindmapImageState } from '@/hooks/useMindmapImages';

interface MindmapNodeImageProps {
  width: number;
  height: number;
  state: MindmapImageState | undefined;
}

/**
 * Bilden under etiketten i en nod. Måtten kommer från layouten, så att noden
 * har rätt storlek också innan bilden hämtats. En bild som inte gick att
 * hämta visas som en text i rutan, inte som en trasig bild.
 */
export function MindmapNodeImage({ width, height, state }: MindmapNodeImageProps) {
  return (
    <div className="mm__image" style={{ width, height }}>
      {state?.status === 'ready' && state.url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={state.url} alt="" draggable={false} />
      ) : state?.status === 'error' ? (
        <span className="mm__image-status" title={state.error}>Kunde inte hämta bild</span>
      ) : (
        <span className="mm__image-status">Hämtar bild…</span>
      )}
    </div>
  );
}
