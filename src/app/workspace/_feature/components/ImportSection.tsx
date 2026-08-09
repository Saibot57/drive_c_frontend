'use client';

import { useCallback, useState } from 'react';
import { ChevronDown, ChevronRight, Loader2, PieChart, Sparkles } from 'lucide-react';
import { themeWheelService } from '@/services/themeWheelService';
import type { ThemeWheelSummary } from '@/types/themeWheel';

interface ImportSectionProps {
  onExplodeWheel: (wheelId: string) => void;
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
export default function ImportSection({ onExplodeWheel }: ImportSectionProps) {
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
        Spräng temahjul
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
              <button
                key={wheel.id}
                className="ws-menu-item"
                title={`Bryt ut arbetsområdena i ${wheel.name} som enskilda kort`}
                onClick={() => {
                  onExplodeWheel(wheel.id);
                  setState({ status: 'closed' });
                }}
              >
                <span className="ws-menu-item__icon"><PieChart size={13} /></span>
                {wheel.name}
                <span className="ws-import-list__hint"><Sparkles size={12} /></span>
              </button>
            ))}
          </div>
        )
      )}
    </div>
  );
}
