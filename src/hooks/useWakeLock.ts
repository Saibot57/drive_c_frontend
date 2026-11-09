'use client';

import { useEffect } from 'react';

type Sentinel = { release: () => Promise<void> };
type WakeLockNavigator = Navigator & { wakeLock?: { request: (type: 'screen') => Promise<Sentinel> } };

/**
 * Håller skärmen vaken medan `enabled` är sant. Webbläsaren släpper låset när
 * fliken göms, så det tas igen när fliken blir synlig. Saknas API:t, eller
 * nekas låset, händer ingenting.
 */
export function useWakeLock(enabled: boolean) {
  useEffect(() => {
    if (!enabled || typeof document === 'undefined') return;
    const nav = navigator as WakeLockNavigator;
    if (!nav.wakeLock) return;
    let sentinel: Sentinel | null = null;
    let stopped = false;

    const acquire = async () => {
      if (document.visibilityState !== 'visible') return;
      try {
        const s = await nav.wakeLock!.request('screen');
        if (stopped) void s.release().catch(() => {});
        else sentinel = s;
      } catch {
        /* nekat, t.ex. i strömsparläge */
      }
    };
    const onVisible = () => { if (document.visibilityState === 'visible') void acquire(); };

    void acquire();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      stopped = true;
      document.removeEventListener('visibilitychange', onVisible);
      void sentinel?.release().catch(() => {});
    };
  }, [enabled]);
}
