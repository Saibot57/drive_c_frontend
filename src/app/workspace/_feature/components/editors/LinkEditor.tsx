'use client';

import { useCallback, useState, useEffect } from 'react';
import { Link as LinkIcon, ExternalLink, Pencil, Check, X } from 'lucide-react';
import type { LinkContent } from '../../types/link.types';

interface LinkEditorProps {
  content: LinkContent | null;
  isLocked: boolean;
  isSelected: boolean;
  onChange: (content: LinkContent) => void;
}

function normalizeUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function hostnameFromUrl(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

export default function LinkEditor({ content, isLocked, isSelected, onChange }: LinkEditorProps) {
  const url = content?.url ?? '';
  const title = content?.title ?? '';
  const description = content?.description ?? '';
  const thumbnailUrl = content?.thumbnailUrl ?? '';

  const [editing, setEditing] = useState(false);
  const [urlInput, setUrlInput] = useState(url);
  const [titleInput, setTitleInput] = useState(title);
  const [descInput, setDescInput] = useState(description);
  const [thumbInput, setThumbInput] = useState(thumbnailUrl);
  const [thumbError, setThumbError] = useState(false);

  useEffect(() => {
    setThumbError(false);
  }, [thumbnailUrl]);

  const handleSave = useCallback(() => {
    const normalized = normalizeUrl(urlInput);
    if (!normalized) return;
    onChange({
      url: normalized,
      title: titleInput.trim() || undefined,
      description: descInput.trim() || undefined,
      thumbnailUrl: thumbInput.trim() || undefined,
    });
    setEditing(false);
  }, [urlInput, titleInput, descInput, thumbInput, onChange]);

  const handleCancel = useCallback(() => {
    setUrlInput(url);
    setTitleInput(title);
    setDescInput(description);
    setThumbInput(thumbnailUrl);
    setEditing(false);
  }, [url, title, description, thumbnailUrl]);

  const startEditing = useCallback(() => {
    setUrlInput(url);
    setTitleInput(title);
    setDescInput(description);
    setThumbInput(thumbnailUrl);
    setEditing(true);
  }, [url, title, description, thumbnailUrl]);

  const interactive = isSelected;
  const pointerStyle: React.CSSProperties = interactive
    ? { pointerEvents: 'auto' }
    : { pointerEvents: 'none' };

  // ── Empty / editing state ──
  if (!url || editing) {
    return (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.375rem',
          padding: '0.75rem',
          overflow: 'auto',
          ...pointerStyle,
        }}
      >
        <label style={{ fontSize: '0.6875rem', color: '#6b7280' }}>URL</label>
        <input
          type="text"
          value={urlInput}
          onChange={(e) => setUrlInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleSave();
            }
          }}
          placeholder="https://…"
          disabled={isLocked}
          autoFocus
          style={inputStyle}
        />

        <label style={{ fontSize: '0.6875rem', color: '#6b7280' }}>Titel (valfritt)</label>
        <input
          type="text"
          value={titleInput}
          onChange={(e) => setTitleInput(e.target.value)}
          placeholder="Visningstitel"
          disabled={isLocked}
          style={inputStyle}
        />

        <label style={{ fontSize: '0.6875rem', color: '#6b7280' }}>Beskrivning (valfritt)</label>
        <input
          type="text"
          value={descInput}
          onChange={(e) => setDescInput(e.target.value)}
          placeholder="Kort beskrivning"
          disabled={isLocked}
          style={inputStyle}
        />

        <label style={{ fontSize: '0.6875rem', color: '#6b7280' }}>Thumbnail-URL (valfritt)</label>
        <input
          type="text"
          value={thumbInput}
          onChange={(e) => setThumbInput(e.target.value)}
          placeholder="https://…/image.png"
          disabled={isLocked}
          style={inputStyle}
        />

        <div style={{ display: 'flex', gap: '0.375rem', marginTop: '0.25rem' }}>
          <button
            type="button"
            onClick={handleSave}
            disabled={isLocked || !urlInput.trim()}
            style={{
              ...btnStyle,
              background: '#111827',
              color: '#ffffff',
              borderColor: '#111827',
              cursor: isLocked || !urlInput.trim() ? 'not-allowed' : 'pointer',
            }}
          >
            <Check size={12} />
            Spara
          </button>
          {url && (
            <button type="button" onClick={handleCancel} disabled={isLocked} style={btnStyle}>
              <X size={12} />
              Avbryt
            </button>
          )}
        </div>
      </div>
    );
  }

  // ── Display state ──
  const displayTitle = title || hostnameFromUrl(url);
  const host = hostnameFromUrl(url);
  const showThumb = !!thumbnailUrl && !thumbError;

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        background: '#ffffff',
        ...pointerStyle,
      }}
    >
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          display: 'flex',
          flexDirection: 'column',
          flex: 1,
          minHeight: 0,
          textDecoration: 'none',
          color: 'inherit',
        }}
      >
        {showThumb && (
          <div
            style={{
              flex: 1,
              minHeight: 0,
              background: '#f3f4f6',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
            }}
          >
            <img
              src={thumbnailUrl}
              alt=""
              draggable={false}
              onError={() => setThumbError(true)}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                display: 'block',
                userSelect: 'none',
              }}
            />
          </div>
        )}

        <div
          style={{
            padding: '0.5rem 0.625rem',
            borderTop: showThumb ? '1px solid #e5e7eb' : 'none',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.125rem',
            minWidth: 0,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.375rem',
              fontSize: '0.6875rem',
              color: '#6b7280',
              minWidth: 0,
            }}
          >
            <LinkIcon size={11} />
            <span
              style={{
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {host}
            </span>
            <ExternalLink size={11} style={{ marginLeft: 'auto', flexShrink: 0 }} />
          </div>
          <div
            style={{
              fontSize: '0.875rem',
              fontWeight: 600,
              color: '#111827',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {displayTitle}
          </div>
          {description && (
            <div
              style={{
                fontSize: '0.75rem',
                color: '#4b5563',
                overflow: 'hidden',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
              }}
            >
              {description}
            </div>
          )}
        </div>
      </a>

      {isSelected && !isLocked && (
        <button
          type="button"
          onClick={startEditing}
          title="Redigera länk"
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
            cursor: 'pointer',
            color: '#374151',
            padding: 0,
          }}
        >
          <Pencil size={12} />
        </button>
      )}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  fontSize: '0.75rem',
  padding: '0.375rem 0.5rem',
  border: '1px solid #e5e7eb',
  borderRadius: '0.375rem',
  outline: 'none',
};

const btnStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '0.25rem',
  fontSize: '0.75rem',
  padding: '0.375rem 0.625rem',
  border: '1px solid #d1d5db',
  borderRadius: '0.375rem',
  background: '#f9fafb',
  cursor: 'pointer',
  color: '#111827',
};
