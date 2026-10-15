'use client';

import { useCallback, useRef, useState, useEffect } from 'react';
import { Link as LinkIcon, ExternalLink, Pencil, Check, X } from 'lucide-react';
import type { LinkContent } from '../../types/link.types';

interface LinkEditorProps {
  content: LinkContent | null;
  isLocked: boolean;
  isSelected: boolean;
  onChange: (content: LinkContent) => void;
  /** Räknare från högerklickets "Redigera". Ett nytt värde öppnar formuläret. */
  editSignal?: number;
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

export default function LinkEditor({ content, isLocked, isSelected, onChange, editSignal }: LinkEditorProps) {
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

  /*
   * Menyvalet "Redigera" gör samma sak som pennknappen. Signalen jämförs mot ett
   * ref i stället för att bara ligga i effektens beroenden: startEditing byter
   * identitet varje gång innehållet ändras, och en effekt som lyssnade på den
   * hade öppnat formuläret igen mitt i skrivandet.
   */
  const handledEditSignal = useRef(editSignal);
  useEffect(() => {
    if (editSignal === handledEditSignal.current) return;
    handledEditSignal.current = editSignal;
    startEditing();
  }, [editSignal, startEditing]);

  const interactive = isSelected;
  const pointerStyle: React.CSSProperties = interactive
    ? { pointerEvents: 'auto' }
    : { pointerEvents: 'none' };

  // ── Empty / editing state ──
  if (!url || editing) {
    return (
      <div className="ws-source-form ws-source-form--stacked" style={pointerStyle}>
        <label className="ws-source-form__label">URL</label>
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
          className="ws-source-form__input"
        />

        <label className="ws-source-form__label">Titel (valfritt)</label>
        <input
          type="text"
          value={titleInput}
          onChange={(e) => setTitleInput(e.target.value)}
          placeholder="Visningstitel"
          disabled={isLocked}
          className="ws-source-form__input"
        />

        <label className="ws-source-form__label">Beskrivning (valfritt)</label>
        <input
          type="text"
          value={descInput}
          onChange={(e) => setDescInput(e.target.value)}
          placeholder="Kort beskrivning"
          disabled={isLocked}
          className="ws-source-form__input"
        />

        <label className="ws-source-form__label">Thumbnail-URL (valfritt)</label>
        <input
          type="text"
          value={thumbInput}
          onChange={(e) => setThumbInput(e.target.value)}
          placeholder="https://…/image.png"
          disabled={isLocked}
          className="ws-source-form__input"
        />

        <div className="ws-source-form__actions">
          <button
            type="button"
            onClick={handleSave}
            disabled={isLocked || !urlInput.trim()}
            className="ws-source-form__button ws-source-form__button--primary"
          >
            <Check size={12} />
            Spara
          </button>
          {url && (
            <button type="button" onClick={handleCancel} disabled={isLocked} className="ws-source-form__button">
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
    <div className="ws-link" style={pointerStyle}>
      <a href={url} target="_blank" rel="noopener noreferrer" className="ws-link__anchor">
        {showThumb && (
          <div className="ws-link__thumb">
            <img
              src={thumbnailUrl}
              alt=""
              draggable={false}
              onError={() => setThumbError(true)}
              className="ws-link__thumb-img"
            />
          </div>
        )}

        <div className={`ws-link__body${showThumb ? ' ws-link__body--below-thumb' : ''}`}>
          <div className="ws-link__host">
            <LinkIcon size={11} />
            <span className="ws-link__host-name">{host}</span>
            <ExternalLink size={11} className="ws-link__external" />
          </div>
          <div className="ws-link__title">{displayTitle}</div>
          {description && <div className="ws-link__desc">{description}</div>}
        </div>
      </a>

      {isSelected && !isLocked && (
        <button
          type="button"
          onClick={startEditing}
          title="Redigera länk"
          className="ws-corner-btn"
        >
          <Pencil size={12} />
        </button>
      )}
    </div>
  );
}
