'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ExternalLink, Loader2, PieChart, RefreshCw } from 'lucide-react';
import { ThemeWheel } from '@/components/theme-wheel/ThemeWheel';
import { ACTIVE_THEME_WHEEL_KEY } from '@/components/theme-wheel/constants';
import { themeWheelService } from '@/services/themeWheelService';
import type { ThemeWheel as ThemeWheelData, ThemeWheelSummary } from '@/types/themeWheel';
import type { WheelRefContent } from '../../types/wheelRef.types';

interface WheelRefViewerProps {
  content: WheelRefContent | null;
  isLocked: boolean;
  onChange: (content: WheelRefContent) => void;
}

type State =
  | { status: 'picking'; wheels: ThemeWheelSummary[] }
  | { status: 'loading' }
  | { status: 'ready'; wheel: ThemeWheelData }
  | { status: 'missing' }
  | { status: 'error'; message: string };

/**
 * Ett hjul från temakalendern, skrivskyddat på canvasen.
 *
 * ThemeWheel är ren SVG och tar bara `wheel` som obligatorisk prop — alla
 * pekarhanterare är valfria. Utelämnas de går det varken att dra i bågarna
 * eller öppna redigeraren, vilket är precis vad vi vill här. Hjulet hämtas
 * varje gång kortet renderas, så det visar alltid det som gäller nu.
 */
export default function WheelRefViewer({ content, isLocked, onChange }: WheelRefViewerProps) {
  const [state, setState] = useState<State>({ status: 'loading' });
  const router = useRouter();
  const wheelId = content?.wheelId ?? null;

  const load = useCallback(async () => {
    if (!wheelId) {
      try {
        setState({ status: 'picking', wheels: await themeWheelService.listWheels() });
      } catch {
        setState({ status: 'error', message: 'Kunde inte hämta dina temakalendrar.' });
      }
      return;
    }

    setState({ status: 'loading' });
    try {
      setState({ status: 'ready', wheel: await themeWheelService.getWheel(wheelId) });
    } catch (error) {
      // Ett raderat hjul ska säga det, inte lämna en tom ruta. Hjulen
      // mjukraderas i temakalendern, så servern svarar 404.
      const message = error instanceof Error ? error.message : '';
      setState(
        /not found|404/i.test(message)
          ? { status: 'missing' }
          : { status: 'error', message: message || 'Kunde inte hämta hjulet.' },
      );
    }
  }, [wheelId]);

  useEffect(() => { void load(); }, [load]);

  const openInPlanner = useCallback(() => {
    // Temakalendern väljer hjul via den här nyckeln vid uppstart. Att sätta den
    // innan navigeringen är enda sättet att peka ut ett hjul utan att bygga om
    // planerarens inläsning till att läsa från URL:en.
    try {
      if (wheelId) window.localStorage.setItem(ACTIVE_THEME_WHEEL_KEY, wheelId);
    } catch {
      // Utan lagring landar man på det senast öppnade hjulet. Inte kritiskt.
    }
    router.push('/features/temakalender');
  }, [wheelId, router]);

  if (state.status === 'loading') {
    return (
      <div className="ws-wheel-ref__state">
        <Loader2 size={16} className="ws-spin" />
        Hämtar hjulet…
      </div>
    );
  }

  if (state.status === 'picking') {
    if (state.wheels.length === 0) {
      return (
        <div className="ws-wheel-ref__state">
          <PieChart size={16} />
          Du har ingen temakalender ännu.
        </div>
      );
    }
    return (
      <div className="ws-wheel-ref__picker">
        <div className="ws-sidebar-header">Välj temakalender</div>
        {state.wheels.map((w) => (
          <button
            key={w.id}
            className="ws-menu-item"
            disabled={isLocked}
            onClick={() => onChange({ wheelId: w.id })}
          >
            <span className="ws-menu-item__icon"><PieChart size={13} /></span>
            {w.name}
          </button>
        ))}
      </div>
    );
  }

  if (state.status === 'missing') {
    return (
      <div className="ws-wheel-ref__state">
        <PieChart size={16} />
        Hjulet finns inte längre.
        <button className="ws-btn" onClick={() => onChange({ wheelId: null })}>
          Välj ett annat
        </button>
      </div>
    );
  }

  if (state.status === 'error') {
    return (
      <div className="ws-wheel-ref__state">
        {state.message}
        <button className="ws-btn" onClick={() => void load()}>
          <RefreshCw size={13} /> Försök igen
        </button>
      </div>
    );
  }

  return (
    <div className="ws-wheel-ref">
      <div className="ws-wheel-ref__head">
        <span className="ws-wheel-ref__name" title={state.wheel.name}>
          {state.wheel.name}
        </span>
        <button
          className="ws-icon-btn"
          onClick={openInPlanner}
          title="Öppna i Temakalendern"
        >
          <ExternalLink size={13} />
        </button>
      </div>
      {/* pointer-events av: kortet ska gå att dra i, inte hjulet inuti det. */}
      <div className="ws-wheel-ref__canvas">
        <ThemeWheel wheel={state.wheel} />
      </div>
    </div>
  );
}
