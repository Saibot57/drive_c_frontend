'use client';

import { useCallback, useState } from 'react';
import { ChevronDown, ChevronRight, Loader2, PieChart, Sparkles, StretchHorizontal } from 'lucide-react';
import { themeWheelService } from '@/services/themeWheelService';
import type { ThemeWheelSummary } from '@/types/themeWheel';
import type { WheelPartMode } from '../utils/wheelExplode';

interface ImportSectionProps {
  onImportWheel: (wheelId: string, mode: WheelPartMode) => void;
}

type State =
  | { status: 'closed' }
  | { status: 'loading' }
  | { status: 'ready'; wheels: ThemeWheelSummary[] }
  | { status: 'error'; message: string };

/**
 * "Hämta in" — element som kommer någon annanstans ifrån.
 *
 * Listan hämtas först när sektionen öppnas. Att slå mot temakalendern varje
 * gång sidopanelen ritas vore slöseri för något de flesta aldrig klickar på.
 */
export default function ImportSection({ onImportWheel }: ImportSectionProps) {
  const [state, setState] = useState<State>({ status: 'closed' });

  const toggle = useCallback(async () => {
    if (state.status !== 'closed') {
      setState({ status: 'closed' });
      return;
    }

    setState({ status: 'loading' });
    try {
      setState({ status: 'ready', wheels: await themeWheelService.listWheels() });
    } catch {
      setState({ status: 'error', message: 'Kunde inte hämta dina temakalendrar.' });
    }
  }, [state.status]);

  return (
    <div className="ws-sidebar-section">
      <button className="ws-create-btn" onClick={() => void toggle()}>
        <span className="ws-menu-item__icon">
          {state.status === 'closed' ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
        </span>
        Hämta in temahjul
      </button>

      {state.status === 'loading' && (
        <p className="ws-sidebar-empty">
          <Loader2 size={13} className="ws-spin" /> Hämtar…
        </p>
      )}

      {state.status === 'error' && <p className="ws-sidebar-empty">{state.message}</p>}

      {state.status === 'ready' && (
        state.wheels.length === 0 ? (
          <p className="ws-sidebar-empty">Du har ingen temakalender ännu.</p>
        ) : (
          <div className="ws-import-list">
            {state.wheels.map((wheel) => (
              <div key={wheel.id} className="ws-import-row">
                <span className="ws-import-row__name" title={wheel.name}>
                  <PieChart size={13} />
                  {wheel.name}
                </span>
                {/*
                  Två lägen, inte ett med en efterföljande växel. Ett "räta ut
                  alla" på en yta man redan möblerat hade flyttat kort man själv
                  placerat.
                */}
                <button
                  className="ws-icon-btn"
                  title="Spräng — delarna behåller sin form och kastas ut från mitten"
                  onClick={() => {
                    onImportWheel(wheel.id, 'explode');
                    setState({ status: 'closed' });
                  }}
                >
                  <Sparkles size={13} />
                </button>
                <button
                  className="ws-icon-btn"
                  title="Rulla ut — terminen som en rak tidslinje"
                  onClick={() => {
                    onImportWheel(wheel.id, 'unroll');
                    setState({ status: 'closed' });
                  }}
                >
                  <StretchHorizontal size={13} />
                </button>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}
