'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { MindmapImageSource, MindmapNode } from '@/types/mindmap';
import { mindmapService } from '@/services/mindmapService';
import { collectImages, type MindmapImageRef } from '@/utils/mindmapImage';

/*
 * Bilderna i en karta. Varje källa hämtas en gång genom bildproxyn och blir
 * en blob-URL, som i Workspace: proxyn kräver inloggning, så en vanlig
 * <img src> mot den går inte. Bilden avkodas också till ett element, så att
 * exporten och minikartan kan rita den synkront, och dess mått läses av.
 *
 * Blob-URL:erna lever så länge källan finns kvar i kartan och släpps sedan.
 */

export interface MindmapImageState {
  status: 'loading' | 'ready' | 'error';
  /** Blob-URL till <img>. */
  url?: string;
  /** Den avkodade bilden, till Canvas. */
  element?: HTMLImageElement;
  /** Höjd/bredd. */
  aspect?: number;
  error?: string;
}

export interface MindmapImages {
  refs: MindmapImageRef[];
  /** Läget för en källa (nyckeln kommer från imageSourceKey). */
  get: (key: string) => MindmapImageState | undefined;
  retry: (key: string) => void;
  /** Färdiga bilder per nod-id, till mindmapDraw. */
  forDraw: () => Map<string, CanvasImageSource>;
}

export function useMindmapImages(root: MindmapNode): MindmapImages {
  const refs = useMemo(() => collectImages(root), [root]);
  const [states, setStates] = useState<Map<string, MindmapImageState>>(() => new Map());
  const statesRef = useRef(states);
  statesRef.current = states;
  /** Källorna som kartan har just nu; ett svar för en annan kastas. */
  const wanted = useRef(new Map<string, MindmapImageSource>());
  const mounted = useRef(true);

  const put = useCallback((key: string, state: MindmapImageState | null) => {
    setStates((current) => {
      const next = new Map(current);
      if (state) next.set(key, state);
      else next.delete(key);
      statesRef.current = next;
      return next;
    });
  }, []);

  const load = useCallback((key: string, source: MindmapImageSource) => {
    put(key, { status: 'loading' });
    let url: string | null = null;
    mindmapService.fetchImage(source)
      .then(async (blob) => {
        url = URL.createObjectURL(blob);
        const element = new Image();
        element.src = url;
        await element.decode();
        if (!element.naturalWidth || !element.naturalHeight) throw new Error('Kunde inte hämta bild.');
        if (!mounted.current || !wanted.current.has(key)) {
          URL.revokeObjectURL(url);
          return;
        }
        put(key, { status: 'ready', url, element, aspect: element.naturalHeight / element.naturalWidth });
      })
      .catch((error: unknown) => {
        if (url) URL.revokeObjectURL(url);
        if (!mounted.current || !wanted.current.has(key)) return;
        // decode() kastar ett tekniskt fel på engelska; det säger inget för användaren.
        const fromServer = error instanceof Error && !(error instanceof DOMException) ? error.message : '';
        put(key, { status: 'error', error: fromServer || 'Kunde inte hämta bild.' });
      });
  }, [put]);

  const signature = useMemo(() => Array.from(new Set(refs.map((ref) => ref.key))).sort().join('\n'), [refs]);
  const refsRef = useRef(refs);
  refsRef.current = refs;

  useEffect(() => {
    const next = new Map<string, MindmapImageSource>();
    refsRef.current.forEach((ref) => next.set(ref.key, ref.source));
    wanted.current = next;
    // Källor som försvunnit ur kartan: släpp bilden.
    statesRef.current.forEach((state, key) => {
      if (next.has(key)) return;
      if (state.url) URL.revokeObjectURL(state.url);
      put(key, null);
    });
    next.forEach((source, key) => {
      if (!statesRef.current.has(key)) load(key, source);
    });
  }, [signature, load, put]);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      statesRef.current.forEach((state) => {
        if (state.url) URL.revokeObjectURL(state.url);
      });
    };
  }, []);

  return useMemo<MindmapImages>(() => ({
    refs,
    get: (key) => states.get(key),
    retry: (key) => {
      const source = wanted.current.get(key);
      if (source) load(key, source);
    },
    forDraw: () => {
      const ready = new Map<string, CanvasImageSource>();
      refs.forEach((ref) => {
        const element = states.get(ref.key)?.element;
        if (element) ready.set(ref.nodeId, element);
      });
      return ready;
    },
  }), [refs, states, load]);
}
