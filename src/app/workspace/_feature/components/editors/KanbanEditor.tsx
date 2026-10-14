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
    <div className="ws-kanban">
      {cols.map((col) => (
        <div
          key={col.id}
          onDragOver={handleDragOver}
          onDrop={(e) => handleDrop(col.id, e)}
          className="ws-kanban__column"
        >
          {/* Column header */}
          <div className="ws-kanban__column-head">
            <input
              value={col.title}
              onChange={(e) => renameColumn(col.id, e.target.value)}
              disabled={isLocked}
              className="ws-editor-bare-input ws-kanban__column-title"
            />
            {!isLocked && (
              <button
                onClick={() => removeColumn(col.id)}
                className="ws-editor-icon-btn ws-kanban__remove-column"
                title="Ta bort kolumn"
              >
                <X size={10} />
              </button>
            )}
          </div>

          {/* Cards */}
          <div className="ws-kanban__cards">
            {col.cards.map((card) => (
              <div
                key={card.id}
                draggable={!isLocked}
                onDragStart={(e) => handleDragStart(card.id, col.id, e)}
                className={`ws-kanban__card${isLocked ? ' ws-kanban__card--locked' : ''}`}
              >
                <input
                  value={card.text}
                  onChange={(e) => updateCard(col.id, card.id, e.target.value)}
                  disabled={isLocked}
                  placeholder="Korttext…"
                  className="ws-editor-bare-input ws-kanban__card-text"
                />
                {!isLocked && (
                  <button
                    onClick={() => removeCard(col.id, card.id)}
                    className="ws-editor-icon-btn ws-kanban__card-remove"
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
            <button onClick={() => addCard(col.id)} className="ws-editor-add ws-kanban__add-card">
              <Plus size={10} /> Kort
            </button>
          )}
        </div>
      ))}

      {/* Add column */}
      {!isLocked && (
        <button
          onClick={addColumn}
          className="ws-editor-icon-btn ws-kanban__add-column"
          title="Ny kolumn"
        >
          <Plus size={14} />
        </button>
      )}
    </div>
  );
}
