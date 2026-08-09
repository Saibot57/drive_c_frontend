'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { Search, X, Type, Table2, GitBranchPlus, List, Kanban, StickyNote, FileText, ImageIcon, Link as LinkIcon, PieChart } from 'lucide-react';
import { workspaceService } from '../services/workspaceService';
import type { WorkspaceElement, ElementType } from '../types/workspace.types';

interface SearchResult extends WorkspaceElement {
  surfaces: { id: string; name: string }[];
}

interface SearchOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (surfaceId: string, elementId: string) => void;
}

const typeIcons: Record<ElementType, React.ReactNode> = {
  text: <Type size={14} />,
  table: <Table2 size={14} />,
  mindmap: <GitBranchPlus size={14} />,
  list: <List size={14} />,
  kanban: <Kanban size={14} />,
  sticky: <StickyNote size={14} />,
  pdf: <FileText size={14} />,
  image: <ImageIcon size={14} />,
  link: <LinkIcon size={14} />,
  wheel_ref: <PieChart size={14} />,
  wheel_part: <PieChart size={14} />,
};

export default function SearchOverlay({
  isOpen,
  onClose,
  onNavigate,
}: SearchOverlayProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setResults([]);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults([]);
      return;
    }
    setLoading(true);
    try {
      const res = await workspaceService.search({ q, deep: true });
      setResults(res);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleChange = useCallback(
    (value: string) => {
      setQuery(value);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => doSearch(value), 300);
    },
    [doSearch],
  );

  const handleSelect = useCallback(
    (result: SearchResult) => {
      const surfaceId = result.surfaces[0]?.id;
      if (surfaceId) {
        onNavigate(surfaceId, result.id);
      }
      onClose();
    },
    [onNavigate, onClose],
  );

  if (!isOpen) return null;

  return (
    <div className="ws-overlay-backdrop ws-overlay-backdrop--top" onClick={onClose}>
      <div className="ws-dialog ws-dialog--md" onClick={(e) => e.stopPropagation()}>
        <div className="ws-search-field">
          <Search size={16} />
          <input
            ref={inputRef}
            className="ws-search-field__input"
            value={query}
            onChange={(e) => handleChange(e.target.value)}
            placeholder="Sök element..."
            onKeyDown={(e) => {
              if (e.key === 'Escape') onClose();
            }}
          />
          <button className="ws-icon-btn" onClick={onClose} aria-label="Stäng">
            <X size={16} />
          </button>
        </div>

        <div className="ws-search-results">
          {loading && <p className="ws-dialog__empty">Söker...</p>}
          {!loading && query && results.length === 0 && (
            <p className="ws-dialog__empty">Inga resultat</p>
          )}
          {results.map((r) => (
            <button key={r.id} className="ws-result" onClick={() => handleSelect(r)}>
              <span className="ws-result__icon">{typeIcons[r.type]}</span>
              <div className="ws-result__main">
                <div className="ws-result__title">{r.title}</div>
                {r.surfaces.length > 0 && (
                  <div className="ws-result__meta">
                    {r.surfaces.map((s) => s.name).join(', ')}
                  </div>
                )}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
