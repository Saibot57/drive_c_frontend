'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Pencil, Search } from 'lucide-react';
import { commandCenterService } from '@/services/commandCenterService';
import type { CCNote } from '@/services/commandCenterService';
import { useHotkeys } from '@/hooks/useHotkeys';

interface Props {
  refreshKey:    number;
  onEditRequest: (id: string) => void;
  onViewRequest: (id: string) => void;
  isFocused?:    boolean;
}

export function NotesBasket({ refreshKey, onEditRequest, onViewRequest, isFocused = false }: Props) {
  const [notes, setNotes]       = useState<CCNote[]>([]);
  const [search, setSearch]     = useState('');
  const [isLoading, setLoading] = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    commandCenterService.getNotes()
      .then(data  => { if (!cancelled) setNotes(data); })
      .catch(e    => { if (!cancelled) setError(e.message ?? 'Kunde inte hämta anteckningar.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [refreshKey]);

  const filtered = useMemo(() => {
    if (!search.trim()) return notes;
    const q = search.toLowerCase();
    return notes.filter(n =>
      n.title.toLowerCase().includes(q) ||
      n.tags.some(t => t.toLowerCase().includes(q)),
    );
  }, [notes, search]);

  // Scroll selected item into view
  useEffect(() => {
    if (selectedIndex === null || !listRef.current) return;
    const items = listRef.current.querySelectorAll('[data-note-item]');
    items[selectedIndex]?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  // Reset selection when filter changes
  useEffect(() => { setSelectedIndex(null); }, [search]);

  useHotkeys(
    isFocused
      ? [
          {
            key: 'ArrowDown',
            handler: () => setSelectedIndex(prev =>
              prev === null ? 0 : Math.min(prev + 1, filtered.length - 1),
            ),
          },
          {
            key: 'j',
            handler: () => setSelectedIndex(prev =>
              prev === null ? 0 : Math.min(prev + 1, filtered.length - 1),
            ),
          },
          {
            key: 'ArrowUp',
            handler: () => setSelectedIndex(prev =>
              prev === null ? 0 : Math.max((prev ?? 0) - 1, 0),
            ),
          },
          {
            key: 'k',
            handler: () => setSelectedIndex(prev =>
              prev === null ? 0 : Math.max((prev ?? 0) - 1, 0),
            ),
          },
          {
            key: 'Enter',
            handler: () => {
              if (selectedIndex !== null && filtered[selectedIndex]) {
                onViewRequest(filtered[selectedIndex].id);
              }
            },
          },
          {
            key: 'e',
            handler: () => {
              if (selectedIndex !== null && filtered[selectedIndex]) {
                onEditRequest(filtered[selectedIndex].id);
              }
            },
          },
          {
            key: '/',
            handler: () => searchRef.current?.focus(),
          },
          {
            key: 'Escape',
            handler: () => {
              if (search) {
                setSearch('');
              } else {
                setSelectedIndex(null);
              }
            },
            allowInInput: true,
          },
        ]
      : [],
    [isFocused, selectedIndex, filtered, search, onViewRequest, onEditRequest],
  );

  return (
    <div className="flex flex-col h-full min-h-0">

      {/* Header row */}
      <div className="flex items-center justify-end mb-2 shrink-0">
        <span className="text-2xs text-gray-500 font-mono tabular-nums">
          {notes.length} st
        </span>
      </div>

      {/* Search */}
      <div className="relative mb-2 shrink-0">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-gray-400 pointer-events-none" />
        <input
          ref={searchRef}
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Sök titel eller tagg…"
          className="w-full pl-7 pr-3 py-1.5 text-xs border-2 border-black bg-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-black"
        />
      </div>

      {/* List */}
      <div ref={listRef} className="flex-1 overflow-auto space-y-2 pr-0.5 min-h-0">
        {isLoading && <p className="text-xs text-gray-400 pt-1">Laddar…</p>}
        {error     && <p className="text-xs text-red-500  pt-1">{error}</p>}

        {!isLoading && !error && filtered.length === 0 && (
          <p className="text-xs text-gray-400 pt-1">
            {search
              ? 'Inga träffar.'
              : 'Inga anteckningar. Prova: note "Min titel"'}
          </p>
        )}

        {filtered.map((note, idx) => (
          <div
            key={note.id}
            data-note-item
            onClick={() => onViewRequest(note.id)}
            className={`border-2 border-black bg-white p-2.5 shadow-[2px_2px_0px_0px_black] group cursor-pointer hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none transition-all ${
              isFocused && selectedIndex === idx ? 'ring-2 ring-black ring-offset-2' : ''
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <span className="text-xs font-bold leading-snug flex-1 min-w-0 truncate">
                {note.title}
              </span>
              <button
                onClick={(e) => { e.stopPropagation(); onEditRequest(note.id); }}
                className={`shrink-0 ${isFocused && selectedIndex === idx ? 'opacity-100' : 'opacity-0'} group-hover:opacity-100 transition-opacity p-1 hover:bg-black hover:text-white`}
                title="Redigera"
              >
                <Pencil className="h-3 w-3" />
              </button>
            </div>

            {note.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1.5">
                {note.tags.map(tag => (
                  <span
                    key={tag}
                    className="text-2xs px-1.5 py-0.5 border border-black bg-[#fef9c3] font-mono leading-tight"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}

            {note.content && (
              <p className="text-2xs text-gray-500 mt-1.5 line-clamp-2 leading-relaxed">
                {note.content}
              </p>
            )}

            <p className="text-2xs text-gray-300 mt-1.5 font-mono">{note.id.slice(0, 8)}…</p>
          </div>
        ))}
      </div>
    </div>
  );
}
