'use client';

import { useEffect, useRef, useState } from 'react';
import { RefreshCw, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MINDMAP_ICONS, MINDMAP_NOTE_MAX_LENGTH, type MindmapIcon, type MindmapNode } from '@/types/mindmap';
import type { MindmapImageState } from '@/hooks/useMindmapImages';
import { MINDMAP_EXTRA_METRICS } from '@/utils/mindmap/mindmapLayout';
import {
  IMAGE_WIDTHS,
  imageLinkError,
  imageSourceLabel,
  normalizeLink,
  parseImageSource,
} from '@/utils/mindmapImage';
import { MINDMAP_ICON_COMPONENTS, MINDMAP_ICON_LABELS } from './mindmapIcons';

export type MindmapPanelField = 'note' | 'link' | 'image';

interface MindmapNodePanelProps {
  /** Den markerade noden, eller `null` när ingen är markerad. */
  node: MindmapNode | null;
  /** Fältet som ska få fokus. `tick` byts vid varje begäran, också för samma fält. */
  focus: { field: MindmapPanelField; tick: number } | null;
  /** Läget för nodens bild, om den har en. */
  imageState?: MindmapImageState;
  onNote: (note: string) => void;
  onLink: (link: string | null) => void;
  onImage: (image: NonNullable<MindmapNode['image']> | null) => void;
  onIcon: (icon: MindmapIcon | null) => void;
  onRetryImage: () => void;
  onClose: () => void;
  /** Esc i ett fält: tillbaka till kartan, panelen står kvar. */
  onReturn: () => void;
}

const field = 'sp-input w-full rounded-ui-sm bg-ui-paper px-2 py-1 text-sm text-ui-ink';

/**
 * Panelen till höger om kartan: anteckning, länk, bild och ikon för den
 * markerade noden. En panel och inte en dialog, så att den kan stå öppen
 * medan man går runt i kartan och skriver.
 */
export function MindmapNodePanel({
  node,
  focus,
  imageState,
  onNote,
  onLink,
  onImage,
  onIcon,
  onRetryImage,
  onClose,
  onReturn,
}: MindmapNodePanelProps) {
  const noteRef = useRef<HTMLTextAreaElement>(null);
  const linkRef = useRef<HTMLInputElement>(null);
  const imageRef = useRef<HTMLInputElement>(null);

  const [linkDraft, setLinkDraft] = useState(node?.link ?? '');
  const [linkError, setLinkError] = useState<string | null>(null);
  const [imageDraft, setImageDraft] = useState('');
  const [imageError, setImageError] = useState<string | null>(null);

  // En annan nod, eller en länk som ändrats av ångra: fälten visar nodens värden.
  useEffect(() => {
    setLinkDraft(node?.link ?? '');
    setLinkError(null);
  }, [node?.id, node?.link]);
  useEffect(() => {
    setImageDraft('');
    setImageError(null);
  }, [node?.id]);

  const focusTick = focus?.tick;
  const focusField = focus?.field;
  useEffect(() => {
    if (!focusField) return;
    const target = focusField === 'note' ? noteRef.current : focusField === 'link' ? linkRef.current : imageRef.current;
    target?.focus({ preventScroll: true });
  }, [focusField, focusTick]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== 'Escape') return;
    e.preventDefault();
    e.stopPropagation();
    onReturn();
  };

  const commitLink = () => {
    if (!node) return;
    const link = normalizeLink(linkDraft);
    if (link === null) {
      setLinkError('Det ser inte ut som en webbadress. Börja med https://.');
      return;
    }
    setLinkError(null);
    if ((node.link ?? '') !== link) onLink(link || null);
    setLinkDraft(link);
  };

  const commitImage = () => {
    if (!node || !imageDraft.trim()) return;
    const source = parseImageSource(imageDraft);
    if (!source) {
      setImageError(imageLinkError(imageDraft));
      return;
    }
    setImageError(null);
    setImageDraft('');
    // Bredden behålls när bilden byts; måtten mäts om för den nya bilden.
    onImage({ source, width: node.image?.width ?? MINDMAP_EXTRA_METRICS.imageWidth });
  };

  const imageWidth = node?.image?.width ?? MINDMAP_EXTRA_METRICS.imageWidth;

  return (
    <aside className="mm__panel" aria-label="Nodens anteckning, länk, bild och ikon" onKeyDown={handleKeyDown}>
      <div className="mm__panel-head">
        <h3 className="min-w-0 truncate text-sm font-semibold" title={node?.label}>
          {node ? node.label || 'Ny nod' : 'Ingen nod markerad'}
        </h3>
        <Button size="sm" variant="neutral" className="sp-btn h-7 w-7 shrink-0 p-0" onClick={onClose} title="Stäng panelen" aria-label="Stäng panelen">
          <X size={14} />
        </Button>
      </div>

      {!node ? (
        <p className="p-3 text-sm text-ui-muted">Markera en nod i kartan.</p>
      ) : (
        <div className="mm__panel-body">
          <label className="mm__panel-label" htmlFor="mm-note">Anteckning <kbd>Alt+N</kbd></label>
          <textarea
            id="mm-note"
            ref={noteRef}
            className={`${field} min-h-[8rem] resize-y`}
            value={node.note ?? ''}
            maxLength={MINDMAP_NOTE_MAX_LENGTH}
            placeholder="Längre text bakom noden. Följer med när kartan kopieras som punktlista."
            onChange={(e) => onNote(e.target.value)}
          />

          <label className="mm__panel-label" htmlFor="mm-link">Länk <kbd>Alt+L</kbd></label>
          <input
            id="mm-link"
            ref={linkRef}
            className={field}
            value={linkDraft}
            inputMode="url"
            placeholder="https://"
            aria-invalid={linkError !== null}
            onChange={(e) => {
              setLinkDraft(e.target.value);
              setLinkError(null);
            }}
            onBlur={commitLink}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                commitLink();
              }
            }}
          />
          {linkError && <p className="mm__panel-error" role="alert">{linkError}</p>}

          <label className="mm__panel-label" htmlFor="mm-image">Bild <kbd>Alt+I</kbd></label>
          <div className="flex gap-2">
            <input
              id="mm-image"
              ref={imageRef}
              className={`${field} min-w-0 flex-1`}
              value={imageDraft}
              inputMode="url"
              placeholder={node.image ? 'Byt bild: klistra in en länk' : 'Länk till en bild eller en fil i Drive'}
              aria-invalid={imageError !== null}
              onChange={(e) => {
                setImageDraft(e.target.value);
                setImageError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  commitImage();
                }
              }}
            />
            <Button size="sm" variant="neutral" className="sp-btn h-8 shrink-0" onClick={commitImage} disabled={!imageDraft.trim()}>
              Lägg in
            </Button>
          </div>
          {imageError && <p className="mm__panel-error" role="alert">{imageError}</p>}
          {node.image && (
            <div className="mm__panel-image">
              <p className="min-w-0 truncate text-xs text-ui-muted" title={imageSourceLabel(node.image.source)}>
                {imageSourceLabel(node.image.source)}
              </p>
              {imageState?.status === 'error' && (
                <p className="mm__panel-error" role="alert">
                  {imageState.error ?? 'Kunde inte hämta bild.'}{' '}
                  <button type="button" className="underline" onClick={onRetryImage}>
                    <RefreshCw size={11} className="inline" /> Försök igen
                  </button>
                </p>
              )}
              <div className="flex flex-wrap items-center gap-1">
                {IMAGE_WIDTHS.map((option) => (
                  <Button
                    key={option.width}
                    size="sm"
                    variant="neutral"
                    className="sp-btn h-7 px-2 text-xs"
                    aria-pressed={imageWidth === option.width}
                    onClick={() => onImage({ ...node.image!, width: option.width })}
                  >
                    {option.label}
                  </Button>
                ))}
                <Button size="sm" variant="neutral" className="sp-btn ml-auto h-7 px-2 text-xs" onClick={() => onImage(null)}>
                  <Trash2 size={12} /> Ta bort
                </Button>
              </div>
            </div>
          )}

          <span className="mm__panel-label">Ikon <kbd>Alt+Shift+1–8</kbd></span>
          <div className="flex flex-wrap gap-1">
            {MINDMAP_ICONS.map((icon, index) => {
              const Icon = MINDMAP_ICON_COMPONENTS[icon];
              return (
                <Button
                  key={icon}
                  size="sm"
                  variant="neutral"
                  className="sp-btn h-8 w-8 p-0"
                  aria-pressed={node.icon === icon}
                  title={`${MINDMAP_ICON_LABELS[icon]} (Alt+Shift+${index + 1})`}
                  aria-label={MINDMAP_ICON_LABELS[icon]}
                  onClick={() => onIcon(node.icon === icon ? null : icon)}
                >
                  <Icon size={15} />
                </Button>
              );
            })}
            <Button
              size="sm"
              variant="neutral"
              className="sp-btn h-8 w-8 p-0"
              title="Ingen ikon (Alt+Shift+9)"
              aria-label="Ingen ikon"
              onClick={() => onIcon(null)}
              disabled={!node.icon}
            >
              <X size={15} />
            </Button>
          </div>
        </div>
      )}
    </aside>
  );
}
