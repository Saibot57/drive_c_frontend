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
        <ImageIcon size={28} strokeWidth={1.5} />
        <div style={{ textAlign: 'center', maxWidth: '16rem' }}>
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
      {/* Image area */}
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
            Laddar bild…
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
        {!loading && !error && blobUrl && (
          <img
            src={blobUrl}
            alt={content.fileName || 'Bild'}
            draggable={false}
            onError={() => {
              setError('Bilden kunde inte visas. Kontrollera att länken pekar direkt till en bildfil.');
              setBlobUrl(null);
            }}
            style={{
              maxWidth: '100%',
              maxHeight: '100%',
              objectFit: 'contain',
              display: 'block',
              userSelect: 'none',
            }}
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
          style={{
            position: 'absolute',
            top: 4,
            right: 4,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 24,
            height: 24,
            border: '1px solid #d1d5db',
            borderRadius: '0.25rem',
            background: 'rgba(255,255,255,0.9)',
            cursor: isLocked ? 'not-allowed' : 'pointer',
            color: '#374151',
            padding: 0,
          }}
        >
          <RefreshCw size={12} />
        </button>
      )}
    </div>
  );
}
