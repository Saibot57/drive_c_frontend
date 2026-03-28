'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { Search, X, Type, Table2, GitBranchPlus, List, Kanban, StickyNote } from 'lucide-react';
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
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingTop: '6rem',
        background: 'rgba(0,0,0,0.3)',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '32rem',
          maxHeight: '24rem',
          background: '#ffffff',
          borderRadius: '0.75rem',
          border: '1px solid #e5e7eb',
          boxShadow: '0 8px 30px rgba(0,0,0,0.12)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search input */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.75rem 1rem',
            borderBottom: '1px solid #f3f4f6',
          }}
        >
          <Search size={16} style={{ color: '#9ca3af', flexShrink: 0 }} />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => handleChange(e.target.value)}
            placeholder="Sök element..."
            style={{
              flex: 1,
              border: 'none',
              outline: 'none',
              fontSize: '0.875rem',
              background: 'transparent',
              color: '#111827',
            }}
            onKeyDown={(e) => {
              if (e.key === 'Escape') onClose();
            }}
          />
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: '#9ca3af',
              padding: 0,
              display: 'flex',
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Results */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0.25rem 0' }}>
          {loading && (
            <p style={{ padding: '1rem', color: '#9ca3af', fontSize: '0.8125rem', textAlign: 'center' }}>
              Söker...
            </p>
          )}
          {!loading && query && results.length === 0 && (
            <p style={{ padding: '1rem', color: '#9ca3af', fontSize: '0.8125rem', textAlign: 'center' }}>
              Inga resultat
            </p>
          )}
          {results.map((r) => (
            <button
              key={r.id}
              onClick={() => handleSelect(r)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.625rem',
                width: '100%',
                padding: '0.5rem 1rem',
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                textAlign: 'left',
                fontSize: '0.8125rem',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.background = '#f9fafb';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.background = 'transparent';
              }}
            >
              <span style={{ color: '#9ca3af', flexShrink: 0 }}>{typeIcons[r.type]}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 500, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {r.title}
                </div>
                {r.surfaces.length > 0 && (
                  <div style={{ fontSize: '0.6875rem', color: '#9ca3af', marginTop: '0.125rem' }}>
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
