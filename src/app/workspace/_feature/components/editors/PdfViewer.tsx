'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, FileText, Loader2, AlertCircle } from 'lucide-react';
import type { PdfContent, PdfSource } from '../../types/pdf.types';
import { parseSource, fetchPdfBytes } from '../../services/pdfProxyService';

// pdfjs-dist types are imported lazily inside the effect to keep the main
// workspace bundle free of pdf.js for users who don't open PDFs.
type PdfDocumentProxy = {
  numPages: number;
  getPage: (n: number) => Promise<PdfPageProxy>;
  destroy: () => Promise<void> | void;
};
type PdfPageProxy = {
  getViewport: (opts: { scale: number }) => { width: number; height: number };
  render: (opts: { canvasContext: CanvasRenderingContext2D; viewport: { width: number; height: number } }) => {
    promise: Promise<void>;
    cancel: () => void;
  };
};

interface PdfViewerProps {
  content: PdfContent;
  isLocked: boolean;
  /**
   * True when the containing CanvasElement is the currently selected element.
   * We only enable pointer-events on the PDF when the card is focused, so the
   * canvas drag-and-drop system always wins on an unselected card.
   */
  isSelected: boolean;
  onChange: (content: PdfContent) => void;
}

export default function PdfViewer({ content, isLocked, isSelected, onChange }: PdfViewerProps) {
  const source = content?.source ?? null;
  const savedPage = content?.page ?? 1;

  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const docRef = useRef<PdfDocumentProxy | null>(null);
  const renderTaskRef = useRef<{ cancel: () => void } | null>(null);

  const [pdf, setPdf] = useState<PdfDocumentProxy | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [pageNumber, setPageNumber] = useState(savedPage);
  const [containerSize, setContainerSize] = useState<{ w: number; h: number }>({ w: 320, h: 200 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Empty-state input (URL-paste) — only meaningful when source === null.
  const [urlInput, setUrlInput] = useState('');

  // ── Observe container size for fit-to-width rendering ──
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        setContainerSize({ w: width, h: height });
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // ── Load the document when source changes ──
  useEffect(() => {
    if (!source) {
      setPdf(null);
      setNumPages(0);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const bytes = await fetchPdfBytes(source);
        if (cancelled) return;

        // Dynamic import keeps pdfjs out of the workspace bundle.
        const pdfjsLib = await import('pdfjs-dist');
        // Worker is copied to /public/pdfjs by scripts/copy-pdfjs-worker.cjs
        // (postinstall). We always point at the .mjs build first; the script
        // falls back to the legacy .js if needed.
        const workerSrc =
          typeof window !== 'undefined' && window.location
            ? '/pdfjs/pdf.worker.min.mjs'
            : '/pdfjs/pdf.worker.min.mjs';
        pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;

        const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(bytes) });
        const loadedDoc = (await loadingTask.promise) as unknown as PdfDocumentProxy;

        if (cancelled) {
          await loadedDoc.destroy();
          return;
        }

        // Dispose previous doc before swapping
        if (docRef.current) {
          try {
            await docRef.current.destroy();
          } catch {
            /* ignore */
          }
        }
        docRef.current = loadedDoc;
        setPdf(loadedDoc);
        setNumPages(loadedDoc.numPages);
        setPageNumber((prev) => Math.min(Math.max(prev, 1), loadedDoc.numPages));
      } catch (e) {
        if (!cancelled) {
          const msg = e instanceof Error ? e.message : String(e);
          setError(msg || 'Kunde inte ladda PDF.');
          setPdf(null);
          setNumPages(0);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [source]);

  // ── Cleanup on unmount ──
  useEffect(() => {
    return () => {
      if (renderTaskRef.current) {
        try {
          renderTaskRef.current.cancel();
        } catch {
          /* ignore */
        }
      }
      if (docRef.current) {
        try {
          docRef.current.destroy();
        } catch {
          /* ignore */
        }
        docRef.current = null;
      }
    };
  }, []);

  // ── Render the current page whenever inputs change (debounced on size) ──
  useEffect(() => {
    if (!pdf || !canvasRef.current || containerSize.w <= 0) return;

    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const page = await pdf.getPage(pageNumber);
        if (cancelled) return;

        const baseViewport = page.getViewport({ scale: 1 });
        const toolbarHeight = containerSize.h < 120 ? 0 : 24;
        const availableW = Math.max(1, containerSize.w - 8);
        const availableH = Math.max(1, containerSize.h - toolbarHeight - 8);
        const scale = Math.min(availableW / baseViewport.width, availableH / baseViewport.height);
        const viewport = page.getViewport({ scale: Math.max(0.1, scale) });

        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Hi-dpi sharpness
        const dpr = window.devicePixelRatio || 1;
        canvas.width = Math.floor(viewport.width * dpr);
        canvas.height = Math.floor(viewport.height * dpr);
        canvas.style.width = `${viewport.width}px`;
        canvas.style.height = `${viewport.height}px`;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        if (renderTaskRef.current) {
          try {
            renderTaskRef.current.cancel();
          } catch {
            /* ignore */
          }
        }
        const task = page.render({ canvasContext: ctx, viewport });
        renderTaskRef.current = task;
        await task.promise;
      } catch (e) {
        // Render cancellations are fine; only surface real errors.
        const msg = e instanceof Error ? e.message : String(e);
        if (!/cancel/i.test(msg)) {
          if (!cancelled) setError(msg);
        }
      }
    }, 150);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [pdf, pageNumber, containerSize.w, containerSize.h]);

  // ── Persist page number changes (parent will debounce via updateElementContent) ──
  useEffect(() => {
    if (!source) return;
    if (pageNumber === savedPage) return;
    onChange({ ...content, page: pageNumber });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageNumber]);

  const handleLoadUrl = useCallback(() => {
    const parsed = parseSource(urlInput);
    if (!parsed) {
      setError('Okänt länkformat. Klistra in en Google Drive-, OneDrive- eller direkt PDF-länk.');
      return;
    }
    setError(null);
    setPageNumber(1);
    onChange({ source: parsed, fileName: undefined, page: 1 });
  }, [urlInput, onChange]);

  const handleClearSource = useCallback(() => {
    setUrlInput('');
    setError(null);
    setPageNumber(1);
    onChange({ source: null });
  }, [onChange]);

  const prevPage = useCallback(() => setPageNumber((p) => Math.max(1, p - 1)), []);
  const nextPage = useCallback(() => setPageNumber((p) => Math.min(numPages || 1, p + 1)), [numPages]);

  // ── Pointer-events strategy: when the card is NOT selected, let clicks
  //    pass through to the canvas drag/selection system. When selected, the
  //    user can interact with toolbar and PDF normally. Matches the
  //    "click-to-focus, then interact" pattern described in the plan.
  const interactive = isSelected;
  const pointerStyle: React.CSSProperties = interactive
    ? { pointerEvents: 'auto' }
    : { pointerEvents: 'none' };

  const showToolbar = containerSize.h >= 120 && pdf !== null;

  // ── Empty state ──
  if (!source) {
    return (
      <div
        ref={containerRef}
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.5rem',
          padding: '0.75rem',
          color: '#6b7280',
          fontSize: '0.8125rem',
          ...pointerStyle,
        }}
      >
        <FileText size={28} strokeWidth={1.5} />
        <div style={{ textAlign: 'center', maxWidth: '16rem' }}>
          Klistra in en delningslänk till en PDF (Google Drive, OneDrive eller direkt URL).
        </div>
        <input
          type="text"
          value={urlInput}
          onChange={(e) => setUrlInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleLoadUrl();
            }
          }}
          placeholder="https://…"
          disabled={isLocked}
          style={{
            width: '100%',
            maxWidth: '18rem',
            fontSize: '0.75rem',
            padding: '0.375rem 0.5rem',
            border: '1px solid #e5e7eb',
            borderRadius: '0.375rem',
            outline: 'none',
          }}
        />
        <button
          type="button"
          onClick={handleLoadUrl}
          disabled={isLocked || !urlInput.trim()}
          style={{
            fontSize: '0.75rem',
            padding: '0.375rem 0.75rem',
            border: '1px solid #d1d5db',
            borderRadius: '0.375rem',
            background: '#f9fafb',
            cursor: isLocked || !urlInput.trim() ? 'not-allowed' : 'pointer',
            color: '#111827',
          }}
        >
          Öppna
        </button>
        {error && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.25rem',
              color: '#b91c1c',
              fontSize: '0.6875rem',
              maxWidth: '18rem',
              textAlign: 'center',
            }}
          >
            <AlertCircle size={12} />
            {error}
          </div>
        )}
      </div>
    );
  }

  // ── Loaded state ──
  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: '#f3f4f6',
        position: 'relative',
        ...pointerStyle,
      }}
    >
      {/* Canvas area */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          minHeight: 0,
        }}
      >
        {loading && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: '#6b7280', fontSize: '0.75rem' }}>
            <Loader2 size={14} className="ws-spin" />
            Laddar PDF…
          </div>
        )}
        {!loading && error && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '0.375rem',
              color: '#b91c1c',
              fontSize: '0.75rem',
              padding: '0.5rem',
              textAlign: 'center',
            }}
          >
            <AlertCircle size={16} />
            <div>{error}</div>
            <button
              type="button"
              onClick={handleClearSource}
              disabled={isLocked}
              style={{
                fontSize: '0.6875rem',
                padding: '0.25rem 0.5rem',
                border: '1px solid #d1d5db',
                borderRadius: '0.25rem',
                background: '#ffffff',
                cursor: isLocked ? 'not-allowed' : 'pointer',
                color: '#111827',
              }}
            >
              Byt länk
            </button>
          </div>
        )}
        {!loading && !error && <canvas ref={canvasRef} style={{ display: 'block' }} />}
      </div>

      {/* Toolbar */}
      {showToolbar && (
        <div
          style={{
            height: 24,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 0.5rem',
            background: '#ffffff',
            borderTop: '1px solid #e5e7eb',
            fontSize: '0.6875rem',
            color: '#374151',
            flexShrink: 0,
          }}
        >
          <button
            type="button"
            onClick={prevPage}
            disabled={pageNumber <= 1}
            style={toolbarBtnStyle(pageNumber <= 1)}
            title="Föregående sida"
          >
            <ChevronLeft size={14} />
          </button>
          <span style={{ fontVariantNumeric: 'tabular-nums' }}>
            {pageNumber} / {numPages || '–'}
          </span>
          <button
            type="button"
            onClick={nextPage}
            disabled={pageNumber >= numPages}
            style={toolbarBtnStyle(pageNumber >= numPages)}
            title="Nästa sida"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      )}

      {/* Tiny page indicator when toolbar is hidden (very small cards) */}
      {!showToolbar && pdf && (
        <div
          style={{
            position: 'absolute',
            bottom: 2,
            right: 4,
            fontSize: '0.625rem',
            color: '#6b7280',
            background: 'rgba(255,255,255,0.75)',
            padding: '0 0.25rem',
            borderRadius: 2,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {pageNumber}/{numPages}
        </div>
      )}
    </div>
  );
}

function toolbarBtnStyle(disabled: boolean): React.CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 20,
    height: 20,
    border: 'none',
    background: 'transparent',
    cursor: disabled ? 'not-allowed' : 'pointer',
    color: disabled ? '#d1d5db' : '#374151',
    padding: 0,
  };
}
