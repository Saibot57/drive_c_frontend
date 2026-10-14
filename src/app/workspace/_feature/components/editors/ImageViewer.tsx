'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ImageIcon, Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import type { ImageContent } from '../../types/image.types';
import { parseSource, fetchImageBytes } from '../../services/imageProxyService';

interface ImageViewerProps {
  content: ImageContent;
  isLocked: boolean;
  isSelected: boolean;
  onChange: (content: ImageContent) => void;
}

export default function ImageViewer({ content, isLocked, isSelected, onChange }: ImageViewerProps) {
  const source = content?.source ?? null;

  const containerRef = useRef<HTMLDivElement>(null);
  const blobUrlRef = useRef<string | null>(null);

  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [urlInput, setUrlInput] = useState('');

  // ── Load image when source changes ──
  useEffect(() => {
    if (!source) {
      setBlobUrl(null);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const blob = await fetchImageBytes(source);
        if (cancelled) return;

        // Revoke previous blob URL
        if (blobUrlRef.current) {
          URL.revokeObjectURL(blobUrlRef.current);
        }

        const url = URL.createObjectURL(blob);
        blobUrlRef.current = url;
        setBlobUrl(url);
      } catch (e) {
        if (!cancelled) {
          const msg = e instanceof Error ? e.message : String(e);
          setError(msg || 'Kunde inte ladda bilden.');
          setBlobUrl(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [source]);

  // ── Cleanup blob URL on unmount ──
  useEffect(() => {
    return () => {
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
    };
  }, []);

  const handleLoadUrl = useCallback(() => {
    const parsed = parseSource(urlInput);
    if (!parsed) {
      setError('Okänt länkformat. Klistra in en Google Drive-, OneDrive- eller direkt bildlänk.');
      return;
    }
    setError(null);
    onChange({ source: parsed, fileName: undefined });
  }, [urlInput, onChange]);

  const handleClearSource = useCallback(() => {
    setUrlInput('');
    setError(null);
    onChange({ source: null });
  }, [onChange]);

  const interactive = isSelected;
  const pointerStyle: React.CSSProperties = interactive
    ? { pointerEvents: 'auto' }
    : { pointerEvents: 'none' };

  // ── Empty state ──
  if (!source) {
    return (
      <div ref={containerRef} className="ws-source-form ws-source-form--centered" style={pointerStyle}>
        <ImageIcon size={28} strokeWidth={1.5} />
        <div className="ws-source-form__hint">
          Klistra in en delningslänk till en bild (Google Drive, OneDrive eller direkt URL).
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
          className="ws-source-form__input"
        />
        <button
          type="button"
          onClick={handleLoadUrl}
          disabled={isLocked || !urlInput.trim()}
          className="ws-source-form__button"
        >
          Öppna
        </button>
        {error && (
          <div className="ws-source-form__error">
            <AlertCircle size={12} />
            {error}
          </div>
        )}
      </div>
    );
  }

  // ── Loaded state ──
  return (
    <div ref={containerRef} className="ws-media" style={pointerStyle}>
      {/* Image area */}
      <div className="ws-media__stage">
        {loading && (
          <div className="ws-media__loading">
            <Loader2 size={14} className="ws-spin" />
            Laddar bild…
          </div>
        )}
        {!loading && error && (
          <div className="ws-media__error">
            <AlertCircle size={16} />
            <div>{error}</div>
            <button
              type="button"
              onClick={handleClearSource}
              disabled={isLocked}
              className="ws-media__retry"
            >
              Byt länk
            </button>
          </div>
        )}
        {!loading && !error && blobUrl && (
          <img
            src={blobUrl}
            alt={content.fileName || 'Bild'}
            draggable={false}
            onError={() => {
              setError('Bilden kunde inte visas. Kontrollera att länken pekar direkt till en bildfil.');
              setBlobUrl(null);
            }}
            className="ws-media__image"
          />
        )}
      </div>

      {/* Change-image button — only visible when selected */}
      {isSelected && blobUrl && !loading && !error && (
        <button
          type="button"
          onClick={handleClearSource}
          disabled={isLocked}
          title="Byt bild"
          className="ws-corner-btn"
        >
          <RefreshCw size={12} />
        </button>
      )}
    </div>
  );
}
