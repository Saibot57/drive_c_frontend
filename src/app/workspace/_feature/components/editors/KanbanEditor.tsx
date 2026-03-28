'use client';

import { useRef } from 'react';
import { Plus, X } from 'lucide-react';

export interface KanbanCard {
  id: string;
  text: string;
}

export interface KanbanColumn {
  id: string;
  title: string;
  cards: KanbanCard[];
}

export interface KanbanContent {
  columns: KanbanColumn[];
}

interface KanbanEditorProps {
  content: KanbanContent;
  isLocked: boolean;
  onChange: (content: KanbanContent) => void;
}

let nextId = Date.now();
function uid() {
  return String(++nextId);
}

export default function KanbanEditor({ content, isLocked, onChange }: KanbanEditorProps) {
  const dragRef = useRef<{ cardId: string; fromColId: string } | null>(null);

  const cols = content?.columns ?? [];

  // ── Column ops ──
  const addColumn = () => {
    onChange({
      columns: [...cols, { id: uid(), title: 'Ny kolumn', cards: [] }],
    });
  };

  const removeColumn = (colId: string) => {
    onChange({ columns: cols.filter((c) => c.id !== colId) });
  };

  const renameColumn = (colId: string, title: string) => {
    onChange({
      columns: cols.map((c) => (c.id === colId ? { ...c, title } : c)),
    });
  };

  // ── Card ops ──
  const addCard = (colId: string) => {
    onChange({
      columns: cols.map((c) =>
        c.id === colId
          ? { ...c, cards: [...c.cards, { id: uid(), text: '' }] }
          : c,
      ),
    });
  };

  const updateCard = (colId: string, cardId: string, text: string) => {
    onChange({
      columns: cols.map((c) =>
        c.id === colId
          ? { ...c, cards: c.cards.map((k) => (k.id === cardId ? { ...k, text } : k)) }
          : c,
      ),
    });
  };

  const removeCard = (colId: string, cardId: string) => {
    onChange({
      columns: cols.map((c) =>
        c.id === colId
          ? { ...c, cards: c.cards.filter((k) => k.id !== cardId) }
          : c,
      ),
    });
  };

  // ── Drag & drop ──
  const handleDragStart = (cardId: string, fromColId: string, e: React.DragEvent) => {
    e.stopPropagation();
    dragRef.current = { cardId, fromColId };
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (toColId: string, e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const drag = dragRef.current;
    if (!drag || drag.fromColId === toColId) {
      dragRef.current = null;
      return;
    }
    const fromCol = cols.find((c) => c.id === drag.fromColId);
    const card = fromCol?.cards.find((k) => k.id === drag.cardId);
    if (!card) return;

    onChange({
      columns: cols.map((c) => {
        if (c.id === drag.fromColId) {
          return { ...c, cards: c.cards.filter((k) => k.id !== drag.cardId) };
        }
        if (c.id === toColId) {
          return { ...c, cards: [...c.cards, card] };
        }
        return c;
      }),
    });
    dragRef.current = null;
  };

  return (
    <div style={{ display: 'flex', gap: '0.5rem', height: '100%', minWidth: 'max-content' }}>
      {cols.map((col) => (
        <div
          key={col.id}
          onDragOver={handleDragOver}
          onDrop={(e) => handleDrop(col.id, e)}
          style={{
            width: '11rem',
            minWidth: '11rem',
            display: 'flex',
            flexDirection: 'column',
            background: '#f9fafb',
            borderRadius: '0.5rem',
            padding: '0.5rem',
            gap: '0.375rem',
          }}
        >
          {/* Column header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.25rem' }}>
            <input
              value={col.title}
              onChange={(e) => renameColumn(col.id, e.target.value)}
              disabled={isLocked}
              style={{
                flex: 1,
                minWidth: 0,
                fontSize: '0.6875rem',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                color: '#6b7280',
                background: 'transparent',
                border: 'none',
                outline: 'none',
                padding: '0.125rem 0',
              }}
            />
            {!isLocked && (
              <button
                onClick={() => removeColumn(col.id)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#d1d5db', padding: '2px' }}
                title="Ta bort kolumn"
              >
                <X size={10} />
              </button>
            )}
          </div>

          {/* Cards */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.25rem', overflowY: 'auto' }}>
            {col.cards.map((card) => (
              <div
                key={card.id}
                draggable={!isLocked}
                onDragStart={(e) => handleDragStart(card.id, col.id, e)}
                style={{
                  background: '#ffffff',
                  border: '1px solid #e5e7eb',
                  borderRadius: '0.375rem',
                  padding: '0.375rem 0.5rem',
                  fontSize: '0.75rem',
                  cursor: isLocked ? 'default' : 'grab',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '0.25rem',
                }}
              >
                <input
                  value={card.text}
                  onChange={(e) => updateCard(col.id, card.id, e.target.value)}
                  disabled={isLocked}
                  placeholder="Korttext…"
                  style={{
                    flex: 1,
                    minWidth: 0,
                    fontSize: 'inherit',
                    color: '#374151',
                    background: 'transparent',
                    border: 'none',
                    outline: 'none',
                    padding: 0,
                  }}
                />
                {!isLocked && (
                  <button
                    onClick={() => removeCard(col.id, card.id)}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: '#d1d5db',
                      padding: '1px',
                      flexShrink: 0,
                      opacity: 0,
                      transition: 'opacity 150ms',
                    }}
                    className="kanban-card-delete"
                    title="Ta bort"
                  >
                    <X size={10} />
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Add card */}
          {!isLocked && (
            <button
              onClick={() => addCard(col.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.25rem',
                fontSize: '0.6875rem',
                color: '#9ca3af',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '0.25rem 0',
              }}
            >
              <Plus size={10} /> Kort
            </button>
          )}
        </div>
      ))}

      {/* Add column */}
      {!isLocked && (
        <button
          onClick={addColumn}
          style={{
            width: '2rem',
            minWidth: '2rem',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'center',
            paddingTop: '0.5rem',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: '#d1d5db',
            borderRadius: '0.5rem',
          }}
          title="Ny kolumn"
        >
          <Plus size={14} />
        </button>
      )}
    </div>
  );
}
